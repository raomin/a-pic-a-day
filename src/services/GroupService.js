class GroupService {
    constructor(database) {
        this.db = database;
    }

    async addUserToGroup(groupId, userId) {
        // This would typically involve WhatsApp API calls
        // For now, we'll just log the action
        console.log(`Adding user ${userId} to group ${groupId}`);
        // In a real implementation, you would use the WhatsApp client to add the user
        // await this.client.addParticipant(groupId, userId);
    }

    async removeUserFromGroup(groupId, userId) {
        // This would typically involve WhatsApp API calls
        console.log(`Removing user ${userId} from group ${groupId}`);
        // In a real implementation, you would use the WhatsApp client to remove the user
        // await this.client.removeParticipant(groupId, userId);
    }

    async saveGroupSettings(groupId, settings) {
        const sql = `
            INSERT OR REPLACE INTO group_settings 
            (group_id, deadline_hour, deadline_minute, grace_period_minutes, active, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        return await this.db.run(sql, [
            groupId,
            settings.deadline_hour || 23,
            settings.deadline_minute || 59,
            settings.grace_period_minutes || 60,
            settings.active !== undefined ? settings.active : 1
        ]);
    }

    async getGroupSettings(groupId) {
        const sql = 'SELECT * FROM group_settings WHERE group_id = ?';
        return await this.db.get(sql, [groupId]);
    }

    async updateGroupSettings(groupId, settings) {
        const fields = [];
        const values = [];
        
        if (settings.deadline_hour !== undefined) {
            fields.push('deadline_hour = ?');
            values.push(settings.deadline_hour);
        }
        
        if (settings.deadline_minute !== undefined) {
            fields.push('deadline_minute = ?');
            values.push(settings.deadline_minute);
        }
        
        if (settings.grace_period_minutes !== undefined) {
            fields.push('grace_period_minutes = ?');
            values.push(settings.grace_period_minutes);
        }
        
        if (settings.active !== undefined) {
            fields.push('active = ?');
            values.push(settings.active);
        }
        
        if (fields.length > 0) {
            fields.push('updated_at = CURRENT_TIMESTAMP');
            values.push(groupId);
            
            const sql = `UPDATE group_settings SET ${fields.join(', ')} WHERE group_id = ?`;
            return await this.db.run(sql, values);
        }
    }

    async getAllGroupSettings() {
        const sql = 'SELECT * FROM group_settings ORDER BY group_id';
        return await this.db.all(sql);
    }
}

module.exports = GroupService;