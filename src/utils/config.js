require('dotenv').config();

const config = {
    // WhatsApp Group Configuration
    TARGET_GROUP_ID: process.env.TARGET_GROUP_ID || '',
    
    // Database Configuration
    DATABASE_PATH: process.env.DATABASE_PATH || './database.db',
    
    // Bot Settings
    DAILY_DEADLINE_HOUR: parseInt(process.env.DAILY_DEADLINE_HOUR) || 23,
    DAILY_DEADLINE_MINUTE: parseInt(process.env.DAILY_DEADLINE_MINUTE) || 59,
    DAILY_REMINDER_HOUR: parseInt(process.env.DAILY_REMINDER_HOUR) || 18,
    DAILY_REMINDER_HOUR_2: parseInt(process.env.DAILY_REMINDER_HOUR_2) || (parseInt(process.env.DAILY_REMINDER_HOUR) || 18) + 2,
    DAILY_REMINDER_HOUR_3: parseInt(process.env.DAILY_REMINDER_HOUR_3) || (parseInt(process.env.DAILY_REMINDER_HOUR) || 18) + 4,
    TIMEZONE: process.env.TIMEZONE || 'America/New_York',
    GRACE_PERIOD_MINUTES: parseInt(process.env.GRACE_PERIOD_MINUTES) || 60,
    
    // Admin Settings
    BOT_ADMIN_PHONE: process.env.BOT_ADMIN_PHONE || '',
    
    // Daily Summary Settings
    SEND_DAILY_SUMMARY_ON_PERFECT_DAY: process.env.SEND_DAILY_SUMMARY_ON_PERFECT_DAY !== 'false', // Default: true
    SEND_GROUP_REMINDERS: process.env.SEND_GROUP_REMINDERS !== 'false', // Default: true
    
    // Debug and Development
    DEBUG: process.env.DEBUG === 'true',
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Webhook Settings (for future web interface)
    WEBHOOK_PORT: parseInt(process.env.WEBHOOK_PORT) || 3000,
    WEBHOOK_PATH: process.env.WEBHOOK_PATH || '/webhook',
};

// Validate required configuration
const requiredConfig = [];

if (!config.TARGET_GROUP_ID && config.NODE_ENV === 'production') {
    console.warn('Warning: TARGET_GROUP_ID not set. Bot will show available groups on startup.');
}

// Log configuration in debug mode
if (config.DEBUG) {
    console.log('Bot Configuration:');
    console.log('- Daily deadline:', `${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}`);
    console.log('- Daily reminders:', `${config.DAILY_REMINDER_HOUR}:00, ${config.DAILY_REMINDER_HOUR_2}:00, ${config.DAILY_REMINDER_HOUR_3}:00`);
    console.log('- Grace period:', `${config.GRACE_PERIOD_MINUTES} minutes`);
    console.log('- Timezone:', config.TIMEZONE);
    console.log('- Debug mode:', config.DEBUG);
    if (config.TARGET_GROUP_ID) {
        console.log('- Group ID configured:', config.TARGET_GROUP_ID.substring(0, 20) + '...');
    }
}

module.exports = config;