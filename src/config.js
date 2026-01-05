const { isValidLanguage, toAlpha3B } = require('./languages');
const { log } = require('./utils');

// Maximum number of languages allowed
const MAX_LANGUAGES = 5;

// Default max subtitles per language (0 = unlimited)
const DEFAULT_MAX_SUBTITLES_PER_LANG = 0;

/**
 * Parse and validate user configuration
 * Supports both legacy (primaryLang/secondaryLang) and new (languages array) formats
 * @param {Object|string} config - Config object or comma-separated string
 * @returns {Object} Validated config with languages array and maxSubtitles
 * @throws {Error} If no language is configured
 */
function parseConfig(config) {
    let languages = [];
    let maxSubtitles = DEFAULT_MAX_SUBTITLES_PER_LANG;

    // Handle different config formats
    if (typeof config === 'string' && config.length > 0) {
        // Comma-separated format: "eng,fra,spa" (legacy support)
        const parts = config.split(',').filter(p => p && p !== 'none');
        languages = parts;
    } else if (typeof config === 'object' && config !== null) {
        // New format: { languages: ['eng', 'fra', 'spa'], maxSubtitles: 10 }
        if (Array.isArray(config.languages)) {
            languages = config.languages.filter(l => l && l !== 'none');
        }
        // Legacy format: { primaryLang: 'eng', secondaryLang: 'fra' }
        else if (config.primaryLang) {
            languages.push(config.primaryLang);
            if (config.secondaryLang && config.secondaryLang !== 'none') {
                languages.push(config.secondaryLang);
            }
        }
        
        // Parse maxSubtitles from config
        if (typeof config.maxSubtitles === 'number' && config.maxSubtitles >= 0) {
            maxSubtitles = Math.min(config.maxSubtitles, 100); // Cap at 100
        } else if (typeof config.maxSubtitles === 'string') {
            const parsed = parseInt(config.maxSubtitles, 10);
            if (!isNaN(parsed) && parsed >= 0) {
                maxSubtitles = Math.min(parsed, 100);
            }
        }
    }

    // Normalize all language codes to alpha3B format to prevent duplicates
    // (e.g., both "en" and "eng" become "eng")
    languages = languages.map(lang => {
        const normalized = toAlpha3B(lang);
        return normalized || lang;  // Keep original if normalization fails
    });

    // Remove duplicates while preserving order
    languages = [...new Set(languages)];

    // Require at least one language
    if (languages.length === 0) {
        log('error', 'No languages configured. User must configure addon via /configure page.');
        throw new Error('No languages configured. Please configure the addon first.');
    }

    // Enforce maximum
    if (languages.length > MAX_LANGUAGES) {
        log('warn', `Too many languages (${languages.length}), limiting to ${MAX_LANGUAGES}`);
        languages = languages.slice(0, MAX_LANGUAGES);
    }

    // Validate all languages
    const validLanguages = [];
    for (const lang of languages) {
        if (isValidLanguage(lang)) {
            validLanguages.push(lang);
        } else {
            log('warn', `Invalid language code: ${lang}, skipping`);
        }
    }

    if (validLanguages.length === 0) {
        log('error', 'No valid languages found in configuration');
        throw new Error('No valid languages configured. Please configure the addon again.');
    }

    log('debug', `Config parsed: languages=[${validLanguages.join(', ')}], maxSubtitles=${maxSubtitles || 'unlimited'}`);

    return {
        languages: validLanguages,
        maxSubtitles: maxSubtitles,
        // For backward compatibility, expose first language as primaryLang
        primaryLang: validLanguages[0],
        secondaryLang: validLanguages[1] || 'none'
    };
}

/**
 * Encode config to URL-safe string
 * @param {Object} config - Config object
 * @returns {string} URL-safe config string
 */
function encodeConfig(config) {
    if (config.languages && config.languages.length > 0) {
        return config.languages.join(',');
    }
    // Fallback to legacy format
    const { primaryLang, secondaryLang } = config;
    if (secondaryLang === 'none') {
        return primaryLang;
    }
    return `${primaryLang},${secondaryLang}`;
}

module.exports = {
    parseConfig,
    MAX_LANGUAGES,
    DEFAULT_MAX_SUBTITLES_PER_LANG
};
