'use strict';

const { BaseProvider } = require('./BaseProvider');
const V1Wyzie = require('../../src/providers/WyzieProvider');

/**
 * Wyzie aggregates many upstream sources and runs its own fast-first race
 * across them per language. 
 */
class WyzieProvider extends BaseProvider {
    constructor(options = {}) {
        super('wyzie', options);
        this._impl = new V1Wyzie(options);
    }

    getSources() {
        return this._impl.getSources();
    }

    refreshSources() {
        if (typeof this._impl.refreshSources === 'function') {
            this._impl.refreshSources();
        }
    }

    async search(query) {
        if (!this.enabled) return { subtitles: [] };

        const languages = Array.isArray(query.languages) ? query.languages : [];
        const startedAt = Date.now();

        try {
            if (languages.length === 0) {
                const subs = await this._impl.search({
                    imdbId: query.imdbId,
                    season: query.season,
                    episode: query.episode,
                    language: null
                });
                this._recordRequest(true, Date.now() - startedAt, subs.length);
                return { subtitles: subs };
            }

            const result = await this._impl.searchFastFirstMulti(
                {
                    imdbId: query.imdbId,
                    season: query.season,
                    episode: query.episode
                },
                languages
            );
            this._recordRequest(true, Date.now() - startedAt, result.subtitles.length);
            return {
                subtitles: result.subtitles,
                backgroundPromise: result.backgroundPromise || null
            };
        } catch (err) {
            this._recordRequest(false, Date.now() - startedAt, 0, err);
            return { subtitles: [] };
        }
    }
}

WyzieProvider.initWyzieSources = V1Wyzie.initWyzieSources;
WyzieProvider.getActiveSources = V1Wyzie.getActiveSources;
WyzieProvider.getActiveSourcesMetadata = V1Wyzie.getActiveSourcesMetadata;
WyzieProvider.getSourceDisplayName = V1Wyzie.getSourceDisplayName;
WyzieProvider.SOURCE_METADATA = V1Wyzie.SOURCE_METADATA;
WyzieProvider.FALLBACK_SOURCES = V1Wyzie.FALLBACK_SOURCES;

module.exports = WyzieProvider;
