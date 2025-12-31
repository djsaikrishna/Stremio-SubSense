/**
 * Input Validation Utilities - Security Layer
 * Validates and sanitizes user input for API endpoints
 */

// IMDB ID pattern: tt followed by 7-8 digits
const IMDB_PATTERN = /^tt\d{7,8}$/;

// Language code pattern: 2-3 lowercase letters
const LANG_PATTERN = /^[a-z]{2,3}$/i;

// Maximum pagination limit
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Validate IMDB ID format
 * @param {string} imdbId - The IMDB ID to validate
 * @returns {Object} { valid: boolean, value: string|null, error: string|null }
 */
function validateImdbId(imdbId) {
    if (!imdbId || typeof imdbId !== 'string') {
        return { valid: false, value: null, error: 'IMDB ID is required' };
    }
    
    const trimmed = imdbId.trim().toLowerCase();
    
    if (!IMDB_PATTERN.test(trimmed)) {
        return { 
            valid: false, 
            value: null, 
            error: 'Invalid IMDB ID format. Expected: tt followed by 7-8 digits (e.g., tt0111161)' 
        };
    }
    
    return { valid: true, value: trimmed, error: null };
}

/**
 * Validate language code format
 * @param {string} langCode - The language code to validate
 * @returns {Object} { valid: boolean, value: string|null, error: string|null }
 */
function validateLanguageCode(langCode) {
    if (!langCode || typeof langCode !== 'string') {
        return { valid: false, value: null, error: 'Language code is required' };
    }
    
    const trimmed = langCode.trim().toLowerCase();
    
    if (!LANG_PATTERN.test(trimmed)) {
        return { 
            valid: false, 
            value: null, 
            error: 'Invalid language code. Expected: 2-3 letters (e.g., en, eng, fr)' 
        };
    }
    
    return { valid: true, value: trimmed, error: null };
}

/**
 * Validate and normalize pagination parameters
 * @param {Object} params - { page, limit }
 * @returns {Object} { page: number, limit: number, offset: number }
 */
function validatePagination(params = {}) {
    let page = parseInt(params.page, 10);
    let limit = parseInt(params.limit, 10);
    
    // Sanitize page number
    if (isNaN(page) || page < 1) {
        page = 1;
    }
    if (page > 10000) {
        page = 10000; // Reasonable upper limit
    }
    
    // Sanitize limit
    if (isNaN(limit) || limit < 1) {
        limit = DEFAULT_PAGE_SIZE;
    }
    if (limit > MAX_PAGE_SIZE) {
        limit = MAX_PAGE_SIZE;
    }
    
    const offset = (page - 1) * limit;
    
    return { page, limit, offset };
}

/**
 * Validate season/episode numbers
 * @param {*} value - The value to validate
 * @returns {number|null} Validated number or null
 */
function validateSeasonEpisode(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    
    const num = parseInt(value, 10);
    
    if (isNaN(num) || num < 0 || num > 9999) {
        return null;
    }
    
    return num;
}

/**
 * Validate date format (YYYY-MM-DD)
 * @param {string} date - Date string
 * @returns {Object} { valid: boolean, value: string|null, error: string|null }
 */
function validateDate(date) {
    if (!date || typeof date !== 'string') {
        return { valid: false, value: null, error: 'Date is required' };
    }
    
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(date)) {
        return { 
            valid: false, 
            value: null, 
            error: 'Invalid date format. Expected: YYYY-MM-DD' 
        };
    }
    
    // Verify it's a real date
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) {
        return { valid: false, value: null, error: 'Invalid date' };
    }
    
    return { valid: true, value: date, error: null };
}

/**
 * Sanitize string for safe logging/display
 * Removes potentially dangerous characters
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum length (default: 255)
 * @returns {string} Sanitized string
 */
function sanitizeString(str, maxLength = 255) {
    if (!str || typeof str !== 'string') {
        return '';
    }
    
    return str
        .slice(0, maxLength)
        .replace(/[<>\"\'\\]/g, '') // Remove potential XSS characters
        .trim();
}

module.exports = {
    validateImdbId,
    validateLanguageCode,
    validatePagination,
    validateSeasonEpisode,
    validateDate,
    sanitizeString,
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE
};
