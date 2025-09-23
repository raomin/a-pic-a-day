const APicADayBot = require('./bot');
const { logger } = require('./utils/logger');

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    if (bot) {
        await bot.stop();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    if (bot) {
        await bot.stop();
    }
    process.exit(0);
});

// Start the bot
const bot = new APicADayBot();

async function main() {
    try {
        logger.info('Starting A Pic a Day Bot...');
        await bot.start();
    } catch (error) {
        logger.error('Failed to start bot:', error);
        process.exit(1);
    }
}

main();