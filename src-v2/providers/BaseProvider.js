'use strict';

/**
 * Standardized provider contract.
 *
 *   async search(query) -> { subtitles: SubtitleResult[], backgroundPromise?: Promise }
 *
 * query shape:
 *   {
 *     imdbId: string,
 *     season: number|null,
 *     episode: number|null,
 *     languages: string[],          // ISO 639-1 lowercase, sorted
 *     filename?: string,
 *     apiKeys?: { subsource?: string },
 *     encryptedApiKeys?: { subsource?: string }
 *   }
 */

class BaseProvider {
    constructor(name, options = {}) {
        if (this.constructor === BaseProvider) {
            throw new Error('BaseProvider is abstract');
        }
        this.name = name;
        this.options = options;
        this.enabled = options.enabled !== false;

        this.stats = {
            requests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            totalSubtitlesReturned: 0,
            totalFetchTimeMs: 0,
            avgFetchTimeMs: 0,
            lastError: null,
            lastRequestAt: null
        };
    }

    async search(_query) {
        throw new Error(`${this.name}.search() not implemented`);
    }

    getSources() {
        return [this.name];
    }

    getStats() {
        return { name: this.name, enabled: this.enabled, ...this.stats };
    }

    resetStats() {
        this.stats.requests = 0;
        this.stats.successfulRequests = 0;
        this.stats.failedRequests = 0;
        this.stats.totalSubtitlesReturned = 0;
        this.stats.totalFetchTimeMs = 0;
        this.stats.avgFetchTimeMs = 0;
        this.stats.lastError = null;
        this.stats.lastRequestAt = null;
    }

    _recordRequest(success, fetchTimeMs, subtitleCount, error = null) {
        this.stats.requests++;
        this.stats.lastRequestAt = new Date().toISOString();
        if (success) {
            this.stats.successfulRequests++;
            this.stats.totalSubtitlesReturned += subtitleCount;
            this.stats.totalFetchTimeMs += fetchTimeMs;
            this.stats.avgFetchTimeMs = Math.round(
                this.stats.totalFetchTimeMs / this.stats.successfulRequests
            );
        } else {
            this.stats.failedRequests++;
            this.stats.lastError = error ? error.message : 'Unknown error';
        }
    }
}

const { SubtitleResult } = require('../../src/providers/BaseProvider');

module.exports = { BaseProvider, SubtitleResult };
