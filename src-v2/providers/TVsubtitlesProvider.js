'use strict';

const { BaseProvider } = require('./BaseProvider');
const V1TVsubtitles = require('../../src/providers/TVsubtitlesProvider');

class TVsubtitlesProvider extends BaseProvider {
    constructor(options = {}) {
        super('tvsubtitles', options);
        this._impl = new V1TVsubtitles(options);
    }

    getSources() {
        return this._impl.getSources();
    }

    async search(query) {
        if (!this.enabled) return { subtitles: [] };
        if (query.season == null || query.episode == null) return { subtitles: [] };

        const languages = Array.isArray(query.languages) && query.languages.length > 0
            ? query.languages
            : [null];

        const startedAt = Date.now();
        try {
            const perLang = await Promise.all(
                languages.map((lang) =>
                    this._impl.search({
                        imdbId: query.imdbId,
                        season: query.season,
                        episode: query.episode,
                        language: lang
                    })
                )
            );
            const subtitles = dedupeById(perLang.flat());
            this._recordRequest(true, Date.now() - startedAt, subtitles.length);
            return { subtitles };
        } catch (err) {
            this._recordRequest(false, Date.now() - startedAt, 0, err);
            return { subtitles: [] };
        }
    }

    async getDownloadUrl(subtitle) {
        return this._impl.getDownloadUrl(subtitle);
    }
}

function dedupeById(list) {
    const seen = new Set();
    const out = [];
    for (const sub of list) {
        const key = sub.id;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        out.push(sub);
    }
    return out;
}

module.exports = TVsubtitlesProvider;
