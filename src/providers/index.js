/**
 * Subtitle Providers Module
 * 
 * This module provides a provider abstraction layer for subtitle fetching.
 * It allows adding multiple providers independently and decouples the
 * subtitle logic from any specific provider implementation.
 * 
 * Usage:
 * ```javascript
 * const { providerManager, WyzieProvider } = require('./providers');
 * 
 * // Register providers
 * providerManager.register(new WyzieProvider());
 * 
 * // Search all providers
 * const subtitles = await providerManager.searchAll({
 *   imdbId: 'tt1234567',
 *   season: 1,
 *   episode: 5
 * });
 * ```
 * 
 * Adding a new provider:
 * 1. Create a new file (e.g., OpenSubtitlesProvider.js)
 * 2. Extend BaseProvider and implement search()
 * 3. Register in the manager
 */

const { BaseProvider, SubtitleResult } = require('./BaseProvider');
const { ProviderManager, providerManager } = require('./ProviderManager');
const WyzieProvider = require('./WyzieProvider');
const BetaSeriesProvider = require('./BetaSeriesProvider');
const YIFYProvider = require('./YIFYProvider');
const TVsubtitlesProvider = require('./TVsubtitlesProvider');

/**
 * Check if a provider is enabled in SUBTITLE_SOURCES
 * @param {string} providerName - Name of the provider to check
 * @returns {boolean} - Whether provider is enabled
 */
function isProviderEnabled(providerName) {
    const sources = process.env.SUBTITLE_SOURCES;
    if (!sources) {
        // If no sources specified, enable all providers
        return true;
    }
    const sourceList = sources.split(',').map(s => s.trim().toLowerCase());
    return sourceList.includes(providerName.toLowerCase());
}

// Initialize default providers
function initializeDefaultProviders() {
    if (!providerManager.get('wyzie') && isProviderEnabled('wyzie')) {
        providerManager.register(new WyzieProvider());
    }
    
    if (!providerManager.get('betaseries') && isProviderEnabled('betaseries')) {
        if (process.env.BETASERIES_API_KEY) {
            providerManager.register(new BetaSeriesProvider());
        }
    }
    
    // YIFY provider for movie subtitles
    if (!providerManager.get('yify') && isProviderEnabled('yify')) {
        providerManager.register(new YIFYProvider());
    }
    
    // TVsubtitles provider for TV series subtitles
    if (!providerManager.get('tvsubtitles') && isProviderEnabled('tvsubtitles')) {
        providerManager.register(new TVsubtitlesProvider());
    }
}

initializeDefaultProviders();

module.exports = {
    providerManager,
    WyzieProvider,
    BetaSeriesProvider,
    YIFYProvider,
    TVsubtitlesProvider
};
