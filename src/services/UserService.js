class UserService {
    constructor(database) {
        this.db = database;
    }

    async createUser(userId, phoneNumber, name) {
        const sql = `
            INSERT OR REPLACE INTO users (user_id, phone_number, name, status, updated_at)
            VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP)
        `;
        return await this.db.run(sql, [userId, phoneNumber, name]);
    }

    async getUser(userId) {
        const sql = 'SELECT * FROM users WHERE user_id = ?';
        return await this.db.get(sql, [userId]);
    }

    async updateUserStatus(userId, status) {
        const sql = `
            UPDATE users 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `;
        return await this.db.run(sql, [status, userId]);
    }

    async incrementRemovalCount(userId) {
        const sql = `
            UPDATE users 
            SET removal_count = removal_count + 1, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `;
        return await this.db.run(sql, [userId]);
    }

    async updateLastSubmission(userId, date) {
        const sql = `
            UPDATE users 
            SET last_submission_date = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `;
        return await this.db.run(sql, [date, userId]);
    }

    async incrementSubmissionCount(userId) {
        const sql = `
            UPDATE users 
            SET total_submissions = total_submissions + 1, updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `;
        return await this.db.run(sql, [userId]);
    }

    async getAllUsers() {
        const sql = 'SELECT * FROM users ORDER BY name';
        return await this.db.all(sql);
    }

    async getActiveUsers() {
        const sql = 'SELECT * FROM users WHERE status = "active" ORDER BY name';
        return await this.db.all(sql);
    }

    async getRemovedUsers() {
        const sql = 'SELECT * FROM users WHERE status = "removed" ORDER BY name';
        return await this.db.all(sql);
    }

    async getUserStats(userId) {
        const sql = `
            SELECT 
                u.*,
                COUNT(ds.id) as submissions_this_month,
                MAX(ds.submission_date) as last_submission
            FROM users u
            LEFT JOIN daily_submissions ds ON u.user_id = ds.user_id 
                AND ds.submission_date >= date('now', 'start of month')
            WHERE u.user_id = ?
            GROUP BY u.user_id
        `;
        return await this.db.get(sql, [userId]);
    }
}

module.exports = UserService;