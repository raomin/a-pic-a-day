class SubmissionService {
    constructor(database) {
        this.db = database;
    }

    async recordSubmission(userId, userName, messageId = null) {
        const today = new Date().toISOString().split('T')[0];
        
        try {
            // First, ensure user exists
            await this.ensureUserExists(userId, userName);
            
            // Record the submission
            const sql = `
                INSERT OR REPLACE INTO daily_submissions 
                (user_id, submission_date, message_id, has_picture)
                VALUES (?, ?, ?, 1)
            `;
            await this.db.run(sql, [userId, today, messageId]);
            
            // Update user's last submission date and increment counter
            await this.updateUserSubmissionData(userId, today);
            
            return true;
        } catch (error) {
            console.error('Error recording submission:', error);
            return false;
        }
    }

    async ensureUserExists(userId, userName) {
        const userExists = await this.db.get('SELECT user_id FROM users WHERE user_id = ?', [userId]);
        
        if (!userExists) {
            await this.db.run(`
                INSERT INTO users (user_id, name, status, created_at, updated_at)
                VALUES (?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [userId, userName]);
        }
    }

    async updateUserSubmissionData(userId, date) {
        await this.db.run(`
            UPDATE users 
            SET last_submission_date = ?, 
                total_submissions = total_submissions + 1,
                updated_at = CURRENT_TIMESTAMP 
            WHERE user_id = ?
        `, [date, userId]);
    }

    async hasSubmittedToday(userId) {
        const today = new Date().toISOString().split('T')[0];
        const sql = `
            SELECT COUNT(*) as count 
            FROM daily_submissions 
            WHERE user_id = ? AND submission_date = ?
        `;
        const result = await this.db.get(sql, [userId, today]);
        return result.count > 0;
    }

    async hasSubmittedOnDate(userId, date) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM daily_submissions 
            WHERE user_id = ? AND submission_date = ?
        `;
        const result = await this.db.get(sql, [userId, date]);
        return result.count > 0;
    }

    async getSubmissionsForDate(date) {
        const sql = `
            SELECT ds.*, u.name, u.phone_number
            FROM daily_submissions ds
            JOIN users u ON ds.user_id = u.user_id
            WHERE ds.submission_date = ?
            ORDER BY ds.created_at
        `;
        return await this.db.all(sql, [date]);
    }

    async getTodaysSubmissions() {
        const today = new Date().toISOString().split('T')[0];
        return await this.getSubmissionsForDate(today);
    }

    async getUserSubmissionHistory(userId, limit = 30) {
        const sql = `
            SELECT * FROM daily_submissions 
            WHERE user_id = ? 
            ORDER BY submission_date DESC 
            LIMIT ?
        `;
        return await this.db.all(sql, [userId, limit]);
    }

    async getSubmissionStats(userId) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];
        
        const sql = `
            SELECT 
                COUNT(*) as submissions_last_30_days,
                MAX(submission_date) as last_submission_date,
                MIN(submission_date) as first_submission_date
            FROM daily_submissions 
            WHERE user_id = ? AND submission_date >= ?
        `;
        return await this.db.get(sql, [userId, thirtyDaysAgoStr]);
    }

    async getOverallStats() {
        const sql = `
            SELECT 
                COUNT(DISTINCT user_id) as total_users,
                COUNT(*) as total_submissions,
                MAX(submission_date) as last_submission_date,
                MIN(submission_date) as first_submission_date
            FROM daily_submissions
        `;
        return await this.db.get(sql);
    }

    async getMissedSubmissions(date) {
        // Get all active users who didn't submit on a specific date
        const sql = `
            SELECT u.user_id, u.name, u.phone_number
            FROM users u
            WHERE u.status = 'active'
            AND u.user_id NOT IN (
                SELECT ds.user_id 
                FROM daily_submissions ds 
                WHERE ds.submission_date = ?
            )
        `;
        return await this.db.all(sql, [date]);
    }

    async getTodaysMissedSubmissions() {
        const today = new Date().toISOString().split('T')[0];
        return await this.getMissedSubmissions(today);
    }
}

module.exports = SubmissionService;