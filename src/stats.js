/**
 * Statistics tracking service
 */

// Database stats module (lazy-loaded)
let statsDB = null;
function getStatsDB() {
    if (!statsDB) {
        try {
            const cache = require('./cache');
            statsDB = cache.statsDB;
        } catch (e) {
            // Cache not available
        }
    }
    return statsDB;
}

// In-memory stats for real-time updates (volatile)
const stats = {
    startedAt: new Date(),
    requests: {
        total: 0,
        movie: 0,
        series: 0,
        byDate: {}
    },
    subtitles: {
        total: 0,
        bySource: {},
        byLanguage: {}
    },
    languageMatching: {
        totalRequests: 0,
        found: 0,
        notFound: 0,
        byLanguageSuccess: {} // Track which languages are frequently found
    },
    timing: {
        totalMs: 0,
        count: 0,
        minMs: Infinity,
        maxMs: 0,
        history: [] // Keep last 100 fetch times
    },
    errors: {
        total: 0,
        recent: [] // Keep last 10 errors
    }
};

const HISTORY_LIMIT = 100;
const ERROR_LIMIT = 10;

/**
 * Get today's date key for daily stats (uses local timezone)
 */
function getDateKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`; // YYYY-MM-DD in local time
}

/**
 * Track a subtitle request
 * @param {Object} data - Request data
 * @param {string} data.type - Content type (movie/series)
 * @param {number} data.fetchTimeMs - Time taken to fetch subtitles
 * @param {number} data.subtitleCount - Number of subtitles returned
 * @param {Array} data.subtitles - Subtitle objects with source info
 * @param {Object} data.languageMatch - Language matching results
 */
function trackRequest({ type, fetchTimeMs, subtitleCount, subtitles = [], languageMatch = null }) {
    const dateKey = getDateKey();

    // Track request counts
    stats.requests.total++;
    if (type === 'movie') stats.requests.movie++;
    if (type === 'series') stats.requests.series++;

    // Track by date
    if (!stats.requests.byDate[dateKey]) {
        stats.requests.byDate[dateKey] = { total: 0, movie: 0, series: 0 };
    }
    stats.requests.byDate[dateKey].total++;
    stats.requests.byDate[dateKey][type]++;

    // Track subtitle counts
    stats.subtitles.total += subtitleCount;

    // Track by source
    subtitles.forEach(sub => {
        const source = sub.source || 'unknown';
        stats.subtitles.bySource[source] = (stats.subtitles.bySource[source] || 0) + 1;
        
        const lang = sub.lang || 'unknown';
        stats.subtitles.byLanguage[lang] = (stats.subtitles.byLanguage[lang] || 0) + 1;
    });

    // Track language matching results (new model - all languages equal priority)
    if (languageMatch) {
        // Track each language requested
        if (languageMatch.languages && Array.isArray(languageMatch.languages)) {
            languageMatch.languages.forEach(lang => {
                stats.languageMatching.totalRequests++;
                if (languageMatch.found && languageMatch.found.includes(lang)) {
                    stats.languageMatching.found++;
                    stats.languageMatching.byLanguageSuccess[lang] = 
                        (stats.languageMatching.byLanguageSuccess[lang] || 0) + 1;
                } else {
                    stats.languageMatching.notFound++;
                }
            });
        } else {
            // Legacy fallback - single language check
            const lang = languageMatch.primaryLang || languageMatch.language;
            if (lang) {
                stats.languageMatching.totalRequests++;
                if (languageMatch.primaryFound || languageMatch.found) {
                    stats.languageMatching.found++;
                    stats.languageMatching.byLanguageSuccess[lang] = 
                        (stats.languageMatching.byLanguageSuccess[lang] || 0) + 1;
                } else {
                    stats.languageMatching.notFound++;
                }
            }
        }
    }

    // Track timing
    if (fetchTimeMs !== undefined) {
        stats.timing.totalMs += fetchTimeMs;
        stats.timing.count++;
        stats.timing.minMs = Math.min(stats.timing.minMs, fetchTimeMs);
        stats.timing.maxMs = Math.max(stats.timing.maxMs, fetchTimeMs);
        
        stats.timing.history.push(fetchTimeMs);
        if (stats.timing.history.length > HISTORY_LIMIT) {
            stats.timing.history.shift();
        }
    }
    
    // Persist key counters to database
    const db = getStatsDB();
    if (db) {
        db.increment('total_requests');
        if (type === 'movie') db.increment('total_movies');
        if (type === 'series') db.increment('total_series');
        db.increment('total_subtitles', subtitleCount);
    }
}

/**
 * Track an error
 * @param {Error} error - The error object
 * @param {Object} context - Additional context
 */
function trackError(error, context = {}) {
    stats.errors.total++;
    stats.errors.recent.push({
        message: error.message,
        timestamp: new Date().toISOString(),
        context
    });
    
    if (stats.errors.recent.length > ERROR_LIMIT) {
        stats.errors.recent.shift();
    }
}

/**
 * Get current statistics
 * Merges in-memory (session) stats with persistent (database) stats
 * @returns {Object} Statistics object
 */
function getStats() {
    const uptime = Date.now() - stats.startedAt.getTime();
    const avgMs = stats.timing.count > 0 
        ? Math.round(stats.timing.totalMs / stats.timing.count) 
        : 0;

    // Get persistent counters from database
    let persistentStats = {};
    let dailyStats = [];
    let languageMatchSummary = null;
    let topLanguages = {};
    let sourceStats = {};
    let langDistribution = {};
    
    const db = getStatsDB();
    if (db) {
        persistentStats = db.getAll();
        dailyStats = db.getDailyStats(30); // Last 30 days
        languageMatchSummary = db.getLanguageMatchSummary(30);
        topLanguages = db.getTopSuccessfulLanguages(30, 10);
        
        // Get source and language distribution from subtitle cache
        try {
            const dbConn = require('./cache/database');
            
            // Get subtitles by source
            const sourceRows = dbConn.prepare(`
                SELECT source, COUNT(*) as count 
                FROM subtitle_cache 
                WHERE source IS NOT NULL 
                GROUP BY source
            `).all();
            sourceRows.forEach(row => {
                sourceStats[row.source] = row.count;
            });
            
            // Get subtitles by language
            const langRows = dbConn.prepare(`
                SELECT language, COUNT(*) as count 
                FROM subtitle_cache 
                WHERE language IS NOT NULL 
                GROUP BY language
                ORDER BY count DESC
            `).all();
            langRows.forEach(row => {
                langDistribution[row.language] = row.count;
            });
        } catch (e) {
            // Fallback to in-memory
        }
    }
    
    // Use persistent stats for totals, fallback to in-memory
    const totalRequests = persistentStats.total_requests || stats.requests.total;
    const totalMovies = persistentStats.total_movies || stats.requests.movie;
    const totalSeries = persistentStats.total_series || stats.requests.series;
    const totalSubtitles = persistentStats.total_subtitles || stats.subtitles.total;

    // New model: get language match stats and active sessions from DB
    let langTotalRequests = 0;
    let langFound = 0;
    let langNotFound = 0;
    let successRate = 0;
    let byLanguageSuccess = {};
    let activeSessionCount = 0;
    let perLanguage = [];
    let anyPreferredRate = 0;
    let allPreferredRate = 0;
    let popularCombinations = [];
    
    if (languageMatchSummary) {
        langTotalRequests = languageMatchSummary.totalRequests || 0;
        langFound = languageMatchSummary.found || 0;
        langNotFound = languageMatchSummary.notFound || 0;
        successRate = languageMatchSummary.successRate || 0;
        byLanguageSuccess = topLanguages;
        perLanguage = languageMatchSummary.perLanguage || [];
    } else {
        // Fallback to in-memory
        langTotalRequests = stats.languageMatching.totalRequests || 0;
        langFound = stats.languageMatching.found || 0;
        langNotFound = stats.languageMatching.notFound || 0;
        successRate = langTotalRequests > 0 
            ? Math.round((langFound / langTotalRequests) * 100) 
            : 0;
        byLanguageSuccess = stats.languageMatching.byLanguageSuccess;
    }
    
    // Get active sessions count and language success rates
    if (db) {
        try {
            const userStats = db.getAggregateUserStats();
            activeSessionCount = userStats?.activeSessions?.last30Days || 0;
            
            // Get any/all preferred rates
            const successRates = db.getLanguageSuccessRates(30);
            anyPreferredRate = successRates.anyPreferredRate || 0;
            allPreferredRate = successRates.allPreferredRate || 0;
            
            // Get popular language combinations
            popularCombinations = db.getPopularLanguageCombinations(30, 10);
        } catch (e) {
            // Fallback to 0
        }
    }

    // Build daily activity from DB or in-memory
    let byDate = {};
    if (dailyStats.length > 0) {
        dailyStats.forEach(d => {
            byDate[d.date] = {
                total: d.requests,
                movie: d.movies || 0,
                series: d.series || 0,
                cacheHits: d.cache_hits,
                cacheMisses: d.cache_misses
            };
        });
    } else {
        byDate = getLast30Days(stats.requests.byDate);
    }

    // Use DB-backed source/language stats if available
    const subtitlesBySource = Object.keys(sourceStats).length > 0 ? sourceStats : stats.subtitles.bySource;
    const subtitlesByLanguage = Object.keys(langDistribution).length > 0 ? langDistribution : stats.subtitles.byLanguage;

    return {
        uptime: {
            ms: uptime,
            formatted: formatUptime(uptime)
        },
        startedAt: stats.startedAt.toISOString(),
        requests: {
            total: totalRequests,
            movie: totalMovies,
            series: totalSeries,
            // Use DB-backed byDate if available
            byDate: byDate
        },
        subtitles: {
            total: totalSubtitles,
            bySource: subtitlesBySource,
            byLanguage: subtitlesByLanguage
        },
        languageMatching: {
            totalRequests: langTotalRequests,
            found: langFound,
            notFound: langNotFound,
            successRate,
            byLanguageSuccess,
            activeSessionCount,
            perLanguage,
            anyPreferredRate,
            allPreferredRate,
            popularCombinations
        },
        timing: {
            avgMs,
            minMs: stats.timing.minMs === Infinity ? 0 : stats.timing.minMs,
            maxMs: stats.timing.maxMs,
            recentHistory: stats.timing.history.slice(-20) // Last 20 for charts
        },
        errors: stats.errors
    };
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
    if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

/**
 * Get last 30 days of data
 */
function getLast30Days(byDate) {
    const result = {};
    const now = new Date();
    
    for (let i = 0; i < 30; i++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const key = date.toISOString().split('T')[0];
        if (byDate[key]) {
            result[key] = byDate[key];
        }
    }
    
    return result;
}

/**
 * Reset statistics (useful for testing)
 */
function resetStats() {
    stats.startedAt = new Date();
    stats.requests = { total: 0, movie: 0, series: 0, byDate: {} };
    stats.subtitles = { total: 0, bySource: {}, byLanguage: {} };
    stats.languageMatching = { totalRequests: 0, found: 0, notFound: 0, byLanguageSuccess: {} };
    stats.timing = { totalMs: 0, count: 0, minMs: Infinity, maxMs: 0, history: [] };
    stats.errors = { total: 0, recent: [] };
}

module.exports = {
    trackRequest,
    trackError,
    getStats
};
