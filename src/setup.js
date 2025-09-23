const Database = require('./models/Database');
const { logger } = require('./utils/logger');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function setup() {
    console.log('🤖 A Pic a Day Bot Setup\n');
    
    try {
        // Initialize database
        const database = new Database();
        await database.initialize();
        logger.info('Database setup completed');
        
        console.log('✅ Database initialized successfully');
        console.log('\n📋 Next steps:');
        console.log('1. Copy .env.example to .env and configure your settings');
        console.log('2. Run "npm start" to start the bot');
        console.log('3. Scan the QR code with your WhatsApp');
        console.log('4. Add the bot phone number to your group as admin');
        console.log('5. Get the group ID from the bot logs and update your .env file');
        
        await database.close();
        
    } catch (error) {
        logger.error('Setup failed:', error);
        console.error('❌ Setup failed:', error.message);
        process.exit(1);
    }
    
    rl.close();
}

setup();