'use strict';

const { BaseProvider } = require('./BaseProvider');
const V1BetaSeries = require('../../src/providers/BetaSeriesProvider');

const SUPPORTED = new Set(['fr', 'fre', 'en', 'eng']);

class BetaSeriesProvider extends BaseProvider {
    constructor(options = {}) {
        super('betaseries', options);
        this._impl = new V1BetaSeries(options);
        this.enabled = this.enabled && this._impl.enabled;
    }

    getSources() {
        return this._impl.getSources();
    }

    async search(query) {
        if (!this.enabled) return { subtitles: [] };
        if (query.season == null || query.episode == null) return { subtitles: [] };

        const languages = Array.isArray(query.languages) && query.languages.length > 0
            ? query.languages.filter((l) => SUPPORTED.has(l.toLowerCase()))
            : [null];

        if (languages.length === 0) return { subtitles: [] };

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
            const subtitles = dedupeByUrl(perLang.flat());
            this._recordRequest(true, Date.now() - startedAt, subtitles.length);
            return { subtitles };
        } catch (err) {
            this._recordRequest(false, Date.now() - startedAt, 0, err);
            return { subtitles: [] };
        }
    }
}

function dedupeByUrl(list) {
    const seen = new Set();
    const out = [];
    for (const sub of list) {
        const key = sub.url || sub.id;
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        out.push(sub);
    }
    return out;
}

module.exports = BetaSeriesProvider;
