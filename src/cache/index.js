/**
 * Cache Module Exports
 */
const subtitleCache = require('./subtitle-cache');
const statsDB = require('./stats-db');
const { startCleaner } = require('./cache-cleaner');
const db = require('./database-libsql');

module.exports = {
    subtitleCache,
    statsDB,
    startCleaner,
    initializeDatabase: db.initializeDatabase,
    closeDatabase: db.close
};
