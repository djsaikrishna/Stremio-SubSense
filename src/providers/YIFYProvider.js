/**
 * YIFYProvider - Subtitle provider for YIFY/YTS subtitles
 * 
 * Supports: Movies only
 * Languages: Multiple (40+ languages)
 * 
 * URL Structure:
 * - yts-subs.com uses Base64-encoded data-link attribute for downloads
 * - Download URL pattern: https://subtitles.yts-subs.com/subtitles/{name}.zip
 * 
 * Flow:
 * 1. Fetch movie page: https://yts-subs.com/movie-imdb/{imdbId}
 * 2. Parse table for subtitle links (grouped by language)
 * 3. For download: fetch subtitle detail page, decode Base64 data-link
 * 4. Return direct ZIP download URL
 */

const cheerio = require('cheerio');
const { BaseProvider, SubtitleResult } = require('./BaseProvider');
const { log } = require('../utils');

const BASE_URL = 'https://yts-subs.com';
const TIMEOUT = 15000;

// Language code mapping for YIFY (they use full language names)
const LANGUAGE_MAP = {
    'english': { code: 'en', display: 'English' },
    'spanish': { code: 'es', display: 'Spanish' },
    'french': { code: 'fr', display: 'French' },
    'german': { code: 'de', display: 'German' },
    'portuguese': { code: 'pt', display: 'Portuguese' },
    'brazilian': { code: 'pt-BR', display: 'Portuguese (BR)' },
    'brazilian-portuguese': { code: 'pt-BR', display: 'Portuguese (BR)' },
    'italian': { code: 'it', display: 'Italian' },
    'dutch': { code: 'nl', display: 'Dutch' },
    'polish': { code: 'pl', display: 'Polish' },
    'russian': { code: 'ru', display: 'Russian' },
    'turkish': { code: 'tr', display: 'Turkish' },
    'arabic': { code: 'ar', display: 'Arabic' },
    'chinese': { code: 'zh', display: 'Chinese' },
    'japanese': { code: 'ja', display: 'Japanese' },
    'korean': { code: 'ko', display: 'Korean' },
    'vietnamese': { code: 'vi', display: 'Vietnamese' },
    'thai': { code: 'th', display: 'Thai' },
    'indonesian': { code: 'id', display: 'Indonesian' },
    'malay': { code: 'ms', display: 'Malay' },
    'greek': { code: 'el', display: 'Greek' },
    'romanian': { code: 'ro', display: 'Romanian' },
    'czech': { code: 'cs', display: 'Czech' },
    'hungarian': { code: 'hu', display: 'Hungarian' },
    'swedish': { code: 'sv', display: 'Swedish' },
    'danish': { code: 'da', display: 'Danish' },
    'norwegian': { code: 'no', display: 'Norwegian' },
    'finnish': { code: 'fi', display: 'Finnish' },
    'hebrew': { code: 'he', display: 'Hebrew' },
    'persian': { code: 'fa', display: 'Persian' },
    'farsi': { code: 'fa', display: 'Persian' },
    'hindi': { code: 'hi', display: 'Hindi' },
    'bengali': { code: 'bn', display: 'Bengali' },
    'serbian': { code: 'sr', display: 'Serbian' },
    'croatian': { code: 'hr', display: 'Croatian' },
    'slovenian': { code: 'sl', display: 'Slovenian' },
    'bulgarian': { code: 'bg', display: 'Bulgarian' },
    'ukrainian': { code: 'uk', display: 'Ukrainian' },
    'albanian': { code: 'sq', display: 'Albanian' },
    'icelandic': { code: 'is', display: 'Icelandic' }
};

class YIFYProvider extends BaseProvider {
    /**
     * @param {Object} options
     * @param {boolean} options.enabled - Whether provider is enabled
     * @param {string} options.baseUrl - SubSense public URL for proxy
     */
    constructor(options = {}) {
        super('yify', options);
        this.supportedTypes = ['movie'];
        this.baseUrl = options.baseUrl || process.env.SUBSENSE_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3100}`;
    }

    /**
     * Get configured sources
     * @returns {Array<string>}
     */
    getSources() {
        return ['yts-subs.com'];
    }

    /**
     * Search for subtitles
     * 
     * @param {Object} query
     * @param {string} query.imdbId - IMDB ID
     * @param {number|null} query.season - Season number (ignored - movies only)
     * @param {number|null} query.episode - Episode number (ignored - movies only)
     * @param {string|null} query.language - Optional language filter
     * @returns {Promise<Array<SubtitleResult>>}
     */
    async search(query) {
        if (!this.enabled) {
            log('debug', `[YIFYProvider] Provider is disabled`);
            return [];
        }

        // YIFY only supports movies
        if (query.season != null || query.episode != null) {
            log('debug', `[YIFYProvider] Skipping - YIFY only supports movies`);
            return [];
        }

        const startTime = Date.now();

        try {
            const results = await this._searchSubtitles(query.imdbId, query.language);
            const fetchTimeMs = Date.now() - startTime;
            this.updateStats(true, fetchTimeMs, results.length);
            
            log('debug', `[YIFYProvider] Found ${results.length} subtitles in ${fetchTimeMs}ms`);
            return results;

        } catch (error) {
            const fetchTimeMs = Date.now() - startTime;
            this.updateStats(false, fetchTimeMs, 0, error);
            log('error', `[YIFYProvider] Search failed: ${error.message}`);
            return [];
        }
    }

    /**
     * Internal search implementation
     * @private
     */
    async _searchSubtitles(imdbId, languageFilter = null) {
        const movieUrl = `${BASE_URL}/movie-imdb/${imdbId}`;
        log('debug', `[YIFYProvider] Fetching: ${movieUrl}`);

        const response = await fetch(movieUrl, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(TIMEOUT)
        });

        if (!response.ok) {
            if (response.status === 404) {
                log('debug', `[YIFYProvider] Movie not found: ${imdbId}`);
                return [];
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];

        // Parse subtitle table
        $('table.other-subs tbody tr, table tbody tr').each((i, row) => {
            try {
                const $row = $(row);
                const $link = $row.find('a[href*="/subtitles/"]').first();
                const href = $link.attr('href');
                
                if (!href) return;

                // Get language from .sub-lang cell
                const langText = $row.find('.sub-lang').text().trim().toLowerCase();
                const langInfo = LANGUAGE_MAP[langText] || { 
                    code: langText.substring(0, 2), 
                    display: langText.charAt(0).toUpperCase() + langText.slice(1)
                };

                // Apply language filter if specified
                if (languageFilter) {
                    const filterLower = languageFilter.toLowerCase();
                    if (langText !== filterLower && 
                        langInfo.code !== filterLower && 
                        !langText.includes(filterLower)) {
                        return;
                    }
                }

                // Get rating/upvotes
                const ratingText = $row.find('.rating-cell, td:nth-child(3)').text().trim();
                const rating = parseInt(ratingText) || null;

                // Extract subtitle ID from URL for proxy
                const idMatch = href.match(/subtitles\/([^/]+)$/);
                const subtitleId = idMatch ? idMatch[1] : `yify-${i}`;

                // Build proxy URL - the proxy will handle page fetching, ZIP download, and extraction
                const proxyUrl = `${this.baseUrl}/api/yify/proxy/${subtitleId}`;

                results.push(new SubtitleResult({
                    id: `yify-${subtitleId}`,
                    // URL points to our proxy endpoint which handles all the heavy lifting
                    url: proxyUrl,
                    language: langInfo.code,
                    languageCode: langInfo.code,
                    source: 'yts-subs',
                    provider: 'yify',
                    releaseName: this._extractReleaseName(subtitleId),
                    rating: rating,
                    display: langInfo.display,
                    format: 'srt',  // YIFY subtitles are typically SRT in ZIP
                    needsConversion: false
                }));

            } catch (err) {
                log('debug', `[YIFYProvider] Error parsing row: ${err.message}`);
            }
        });

        return results;
    }

    /**
     * Get direct download URL from subtitle page
     * The subtitle page has a Base64-encoded data-link attribute
     * 
     * @param {string} subtitlePageUrl - URL to the subtitle detail page
     * @returns {Promise<string>} Direct download URL for the ZIP file
     */
    async getDownloadUrl(subtitlePageUrl) {
        log('debug', `[YIFYProvider] Getting download URL from: ${subtitlePageUrl}`);

        const response = await fetch(subtitlePageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: AbortSignal.timeout(TIMEOUT)
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch subtitle page: HTTP ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Find download button with data-link attribute
        const downloadBtn = $('a.download-subtitle, a[data-link]').first();
        const dataLink = downloadBtn.attr('data-link');

        if (!dataLink) {
            throw new Error('No data-link attribute found on subtitle page');
        }

        // Decode Base64 to get actual download URL
        const downloadUrl = Buffer.from(dataLink, 'base64').toString('utf-8');
        log('debug', `[YIFYProvider] Decoded download URL: ${downloadUrl}`);

        return downloadUrl;
    }

    /**
     * Extract release name from subtitle ID
     * @private
     */
    _extractReleaseName(subtitleId) {
        // e.g., "the-matrix-1999-english-yify-119099" -> "The Matrix 1999"
        const parts = subtitleId.split('-');
        if (parts.length >= 3) {
            // Remove language, 'yify', and ID at the end
            const nameParts = parts.slice(0, -3);
            return nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
        return subtitleId;
    }
}

module.exports = YIFYProvider;
