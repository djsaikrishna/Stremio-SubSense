/**
 * Subtitle Providers Module
 * 
 * This module provides a provider abstraction layer for subtitle fetching.
 * It allows adding multiple providers independently and decouples the
 * subtitle logic from any specific provider implementation.
 * 
 * Usage:
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
const SubSourceProvider = require('./SubSourceProvider');

/**
 * Check if a provider is enabled in SUBTITLE_SOURCES
 * @param {string} providerName - Name of the provider to check
 * @returns {boolean} - Whether provider is enabled
 */
function isProviderEnabled(providerName) {
    const sources = process.env.SUBTITLE_SOURCES;
    if (!sources) {
        return true;  // If no sources specified, enable all providers
    }
    const sourceList = sources.split(',').map(s => s.trim().toLowerCase());
    return sourceList.includes(providerName.toLowerCase());
}

function initializeDefaultProviders() {
    // Wyzie provider for general subtitles
    if (!providerManager.get('wyzie') && isProviderEnabled('wyzie')) {
        providerManager.register(new WyzieProvider());
    }
    
    // BetaSeries provider for TV series subtitles in French and English
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
    
    // SubSource provider - requires user API key per request
    if (!providerManager.get('subsource') && isProviderEnabled('subsource')) {
        providerManager.register(new SubSourceProvider());
    }
}

initializeDefaultProviders();

module.exports = {
    providerManager,
    WyzieProvider,
    BetaSeriesProvider,
    YIFYProvider,
    TVsubtitlesProvider,
    SubSourceProvider
};
