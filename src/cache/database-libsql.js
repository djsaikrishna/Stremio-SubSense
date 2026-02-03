/**
 * Async SQLite Database using LibSQL
 */
const { createClient } = require('@libsql/client');
const path = require('path');
const fs = require('fs');
const { log } = require('../utils');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/subsense.db');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    log('info', `[Cache] Created data directory: ${dataDir}`);
}

const client = createClient({
    url: `file:${DB_PATH}`,
    intMode: 'number'
});

log('info', `[Cache] LibSQL client initialized: ${DB_PATH}`);

const schema = `
CREATE TABLE IF NOT EXISTS subtitle_cache (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imdb_id TEXT NOT NULL,
    season INTEGER,
    episode INTEGER,
    language TEXT NOT NULL,
    subtitle_id TEXT,
    title TEXT,
    url TEXT NOT NULL,
    format TEXT,
    needs_conversion INTEGER,
    rating REAL,
    source TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(imdb_id, season, episode, language, subtitle_id)
);

CREATE INDEX IF NOT EXISTS idx_cache_lookup 
ON subtitle_cache(imdb_id, season, episode, language);

CREATE INDEX IF NOT EXISTS idx_cache_updated 
ON subtitle_cache(updated_at);

CREATE TABLE IF NOT EXISTS cache_stats_summary (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    total_entries INTEGER DEFAULT 0,
    unique_content INTEGER DEFAULT 0,
    unique_languages INTEGER DEFAULT 0,
    unique_sources INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    source_distribution TEXT DEFAULT '{}',
    language_distribution TEXT DEFAULT '{}',
    oldest_timestamp INTEGER DEFAULT 0,
    newest_timestamp INTEGER DEFAULT 0,
    avg_age_seconds REAL DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    computed_at INTEGER DEFAULT (strftime('%s', 'now')),
    computation_time_ms INTEGER DEFAULT 0
);

INSERT OR IGNORE INTO cache_stats_summary (id) VALUES (1);

CREATE INDEX IF NOT EXISTS idx_cache_language 
ON subtitle_cache(language);

CREATE INDEX IF NOT EXISTS idx_cache_source 
ON subtitle_cache(source);

CREATE TABLE IF NOT EXISTS stats (
    stat_key TEXT PRIMARY KEY,
    stat_value INTEGER DEFAULT 0,
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS stats_daily (
    date TEXT NOT NULL,
    requests INTEGER DEFAULT 0,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    conversions INTEGER DEFAULT 0,
    movies INTEGER DEFAULT 0,
    series INTEGER DEFAULT 0,
    PRIMARY KEY (date)
);

CREATE TABLE IF NOT EXISTS request_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    imdb_id TEXT NOT NULL,
    content_type TEXT,
    languages TEXT,
    result_count INTEGER,
    cache_hit INTEGER,
    response_time_ms INTEGER,
    any_preferred_found INTEGER DEFAULT 0,
    all_preferred_found INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_request_log_created 
ON request_log(created_at);

CREATE TABLE IF NOT EXISTS provider_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_name TEXT NOT NULL,
    date TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    successful_requests INTEGER DEFAULT 0,
    failed_requests INTEGER DEFAULT 0,
    avg_response_ms INTEGER DEFAULT 0,
    subtitles_returned INTEGER DEFAULT 0,
    UNIQUE(provider_name, date)
);

CREATE INDEX IF NOT EXISTS idx_provider_stats_date 
ON provider_stats(date);

CREATE TABLE IF NOT EXISTS language_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    language_code TEXT NOT NULL,
    date TEXT NOT NULL,
    priority TEXT DEFAULT 'preferred', 
    requests_for INTEGER DEFAULT 0,
    found_count INTEGER DEFAULT 0,
    not_found_count INTEGER DEFAULT 0,
    UNIQUE(language_code, date, priority)
);

CREATE INDEX IF NOT EXISTS idx_language_stats_date 
ON language_stats(date);

CREATE INDEX IF NOT EXISTS idx_language_stats_priority 
ON language_stats(priority);

CREATE TABLE IF NOT EXISTS user_tracking (
    user_id TEXT PRIMARY KEY,
    languages TEXT NOT NULL,
    total_requests INTEGER DEFAULT 0,
    movie_requests INTEGER DEFAULT 0,
    series_requests INTEGER DEFAULT 0,
    first_seen INTEGER DEFAULT (strftime('%s', 'now')),
    last_active INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_user_tracking_last_active 
ON user_tracking(last_active);

CREATE TABLE IF NOT EXISTS user_content_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    imdb_id TEXT NOT NULL,
    content_type TEXT,
    season INTEGER,
    episode INTEGER,
    requested_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES user_tracking(user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_content_log_user 
ON user_content_log(user_id);

CREATE INDEX IF NOT EXISTS idx_user_content_log_imdb 
ON user_content_log(imdb_id);
`;

let initialized = false;

async function initializeDatabase() {
    if (initialized) return client;
    
    try {
        await client.executeMultiple(schema);
        await client.execute("PRAGMA journal_mode = WAL");
        initialized = true;
        log('info', '[Cache] LibSQL database schema initialized');
    } catch (err) {
        if (!err.message.includes('already exists')) {
            throw err;
        }
        initialized = true;
    }
    
    return client;
}

async function execute(sql, args = []) {
    await initializeDatabase();
    return client.execute({ sql, args });
}

async function executeMultiple(sql) {
    await initializeDatabase();
    return client.executeMultiple(sql);
}

async function batch(statements, mode = 'write') {
    await initializeDatabase();
    return client.batch(statements, mode);
}

async function transaction(mode = 'write') {
    await initializeDatabase();
    return client.transaction(mode);
}

function close() {
    client.close();
    initialized = false;
    log('info', '[Cache] LibSQL client closed');
}

module.exports = {
    client,
    initializeDatabase,
    execute,
    executeMultiple,
    batch,
    transaction,
    close,
    DB_PATH
};
