'use strict';

const { BaseProvider } = require('./BaseProvider');
const V1SubSource = require('../../src/providers/SubSourceProvider');

/**
 * SubSource requires a per-user API key. When no key is present the ResponseCache
 * stores a placeholder URL that is either rewritten with the requesting user's
 * key or stripped entirely at delivery time.
 */
class SubSourceProvider extends BaseProvider {
    constructor(options = {}) {
        super('subsource', options);
        this._impl = new V1SubSource(options);
    }

    getSources() {
        return this._impl.getSources();
    }

    async search(query) {
        if (!this.enabled) return { subtitles: [] };

        const apiKey = query.apiKeys && query.apiKeys.subsource;
        if (!apiKey) return { subtitles: [] };

        const languages = Array.isArray(query.languages) && query.languages.length > 0
            ? query.languages
            : [null];

        const baseQuery = {
            imdbId: query.imdbId,
            season: query.season,
            episode: query.episode,
            apiKey,
            encryptedApiKey: query.encryptedApiKeys && query.encryptedApiKeys.subsource,
            filename: query.filename || null
        };

        const startedAt = Date.now();
        try {
            const perLang = await Promise.all(
                languages.map((lang) => this._impl.search({ ...baseQuery, language: lang }))
            );
            const subtitles = dedupeById(perLang.flat());
            this._recordRequest(true, Date.now() - startedAt, subtitles.length);
            return { subtitles };
        } catch (err) {
            this._recordRequest(false, Date.now() - startedAt, 0, err);
            return { subtitles: [] };
        }
    }

    async validateApiKey(apiKey) {
        return this._impl.validateApiKey(apiKey);
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

module.exports = SubSourceProvider;
