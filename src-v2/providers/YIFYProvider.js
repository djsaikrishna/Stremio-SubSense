'use strict';

const { BaseProvider } = require('./BaseProvider');
const V1YIFY = require('../../src/providers/YIFYProvider');

/**
 * YIFY is movie-only and ignores the language list (one fetch returns all
 * languages). Language filtering happens downstream in ResponseCache.
 */
class YIFYProvider extends BaseProvider {
    constructor(options = {}) {
        super('yify', options);
        this._impl = new V1YIFY(options);
    }

    getSources() {
        return this._impl.getSources();
    }

    async search(query) {
        if (!this.enabled) return { subtitles: [] };
        if (query.season != null || query.episode != null) return { subtitles: [] };

        const startedAt = Date.now();
        try {
            const subs = await this._impl.search({
                imdbId: query.imdbId,
                season: null,
                episode: null,
                language: null
            });
            this._recordRequest(true, Date.now() - startedAt, subs.length);
            return { subtitles: subs };
        } catch (err) {
            this._recordRequest(false, Date.now() - startedAt, 0, err);
            return { subtitles: [] };
        }
    }

    async getDownloadUrl(subtitlePageUrl) {
        return this._impl.getDownloadUrl(subtitlePageUrl);
    }
}

module.exports = YIFYProvider;
