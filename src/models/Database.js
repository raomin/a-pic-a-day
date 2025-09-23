const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { logger } = require('../utils/logger');
const config = require('../utils/config');

class Database {
    constructor() {
        this.db = null;
        this.dbPath = config.DATABASE_PATH || './database.db';
    }

    async initialize() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    logger.error('Error opening database:', err);
                    reject(err);
                } else {
                    logger.info(`Connected to SQLite database: ${this.dbPath}`);
                    this.createTables().then(resolve).catch(reject);
                }
            });
        });
    }

    async createTables() {
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                phone_number TEXT,
                name TEXT,
                status TEXT DEFAULT 'active',
                last_submission_date TEXT,
                total_submissions INTEGER DEFAULT 0,
                removal_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const createSubmissionsTable = `
            CREATE TABLE IF NOT EXISTS daily_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT,
                submission_date TEXT,
                message_id TEXT,
                has_picture BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (user_id),
                UNIQUE(user_id, submission_date)
            )
        `;

        const createGroupSettingsTable = `
            CREATE TABLE IF NOT EXISTS group_settings (
                group_id TEXT PRIMARY KEY,
                deadline_hour INTEGER DEFAULT 23,
                deadline_minute INTEGER DEFAULT 59,
                grace_period_minutes INTEGER DEFAULT 60,
                active BOOLEAN DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        try {
            await this.run(createUsersTable);
            await this.run(createSubmissionsTable);
            await this.run(createGroupSettingsTable);
            logger.info('Database tables created successfully');
        } catch (error) {
            logger.error('Error creating tables:', error);
            throw error;
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        logger.error('Error closing database:', err);
                        reject(err);
                    } else {
                        logger.info('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = Database;