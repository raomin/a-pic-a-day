const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const cron = require('node-cron');
const Database = require('./models/Database');
const UserService = require('./services/UserService');
const GroupService = require('./services/GroupService');
const SubmissionService = require('./services/SubmissionService');
const { logger } = require('./utils/logger');
const config = require('./utils/config');

class APicADayBot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        
        this.database = new Database();
        this.userService = new UserService(this.database);
        this.groupService = new GroupService(this.database);
        this.submissionService = new SubmissionService(this.database);
        
        this.targetGroupId = null;
        this.isReady = false;
        
        this.setupEventHandlers();
        this.setupCronJobs();
    }

    setupEventHandlers() {
        this.client.on('qr', (qr) => {
            logger.info('QR Code received, scan it with your phone:');
            qrcode.generate(qr, { small: true });
        });

        this.client.on('ready', () => {
            logger.info('WhatsApp Bot is ready!');
            this.isReady = true;
            this.findTargetGroup();
        });

        this.client.on('message', async (message) => {
            await this.handleMessage(message);
        });

        this.client.on('group_join', async (notification) => {
            await this.handleGroupJoin(notification);
        });

        this.client.on('group_leave', async (notification) => {
            await this.handleGroupLeave(notification);
        });
    }

    async findTargetGroup() {
        try {
            const chats = await this.client.getChats();
            const groups = chats.filter(chat => chat.isGroup);
            
            if (config.TARGET_GROUP_ID) {
                const group = groups.find(g => g.id._serialized === config.TARGET_GROUP_ID);
                if (group) {
                    this.targetGroupId = config.TARGET_GROUP_ID;
                    logger.info(`Connected to target group: ${group.name}`);
                } else {
                    logger.error('Configured target group not found');
                }
            } else {
                logger.info('Available groups:');
                groups.forEach((group, index) => {
                    logger.info(`${index + 1}. ${group.name} - ID: ${group.id._serialized}`);
                });
                logger.info('Please set TARGET_GROUP_ID in your .env file');
            }
        } catch (error) {
            logger.error('Error finding family group:', error);
        }
    }

    async handleMessage(message) {
        try {
            const chat = await message.getChat();
            const contact = await message.getContact();
            
            // Handle group messages
            if (chat.isGroup && chat.id._serialized === this.targetGroupId) {
                await this.handleGroupMessage(message, contact);
            }
            // Handle private messages (re-entry submissions)
            else if (!chat.isGroup) {
                await this.handlePrivateMessage(message, contact);
            }
        } catch (error) {
            logger.error('Error handling message:', error);
        }
    }

    async handleGroupMessage(message, contact) {
        const userId = contact.id._serialized;
        const hasMedia = message.hasMedia && (message.type === 'image' || message.type === 'video');
        const messageText = message.body.toLowerCase().trim();
        
        // Handle bot commands in group
        if (messageText.startsWith('!')) {
            await this.handleBotCommand(message, contact, messageText);
            return;
        }
        
        if (hasMedia) {
            await this.submissionService.recordSubmission(userId, contact.pushname || contact.number);
            const mediaType = message.type === 'video' ? 'Video' : 'Picture';
            logger.info(`${mediaType} submission recorded for ${contact.pushname || contact.number}`);
            
            // Send a confirmation reaction/message
            const emoji = message.type === 'video' ? '🎥' : '📸';
            await message.react(emoji);
        }
    }

    async handlePrivateMessage(message, contact) {
        const userId = contact.id._serialized;
        const user = await this.userService.getUser(userId);
        const messageText = message.body.toLowerCase().trim();
        
        // Handle bot commands in private messages
        if (messageText.startsWith('/') || messageText.startsWith('!')) {
            await this.handleBotCommand(message, contact, messageText);
            return;
        }
        
        // Check if user is removed and trying to re-enter
        if (user && user.status === 'removed' && message.hasMedia && (message.type === 'image' || message.type === 'video')) {
            await this.processReentrySubmission(message, contact);
        } else if (!user || user.status !== 'removed') {
            // Send instructions to active users who message the bot
            await this.sendInstructions(contact);
        }
    }

    async handleBotCommand(message, contact, commandText) {
        try {
            const chat = await message.getChat();
            const userId = contact.id._serialized;
            const command = commandText.replace(/[!/]/g, '').split(' ')[0];
            
            switch (command) {
                case 'status':
                    await this.handleStatusCommand(message, chat);
                    break;
                case 'stats':
                    await this.handleStatsCommand(message, chat, userId);
                    break;
                case 'help':
                    await this.handleHelpCommand(message, chat);
                    break;
                case 'myinfo':
                    await this.handleMyInfoCommand(message, contact);
                    break;
                case 'remind':
                    // Admin-only command to test reminders
                    logger.info(`Admin check: contact.number='${contact.number}', BOT_ADMIN_PHONE='${config.BOT_ADMIN_PHONE}'`);
                    if (config.BOT_ADMIN_PHONE && contact.number === config.BOT_ADMIN_PHONE.replace('+', '')) {
                        await this.sendDailyReminders();
                        await message.reply('📢 Daily reminders sent manually!');
                    } else {
                        await message.reply('🔒 Admin-only command.');
                    }
                    break;
                case 'testdm':
                    // Admin-only command to test DM functionality
                    logger.info(`Admin check: contact.number='${contact.number}', BOT_ADMIN_PHONE='${config.BOT_ADMIN_PHONE}'`);
                    if (config.BOT_ADMIN_PHONE && contact.number === config.BOT_ADMIN_PHONE.replace('+', '')) {
                        await this.sendTestDM(contact);
                        await message.reply('📱 Test DM sent to you!');
                    } else {
                        await message.reply('🔒 Admin-only command.');
                    }
                    break;
                case 'members':
                    // Admin-only command to see family member management
                    if (config.BOT_ADMIN_PHONE && contact.number === config.BOT_ADMIN_PHONE.replace('+', '')) {
                        await this.handleMembersCommand(message);
                    } else {
                        await message.reply('🔒 Admin-only command.');
                    }
                    break;
                case 'whoami':
                    // Debug command to show user's phone number
                    await message.reply(`🔍 Debug Info:\n• Your number: ${contact.number}\n• Your name: ${contact.pushname || 'Unknown'}\n• Expected admin: ${config.BOT_ADMIN_PHONE}\n• Match: ${contact.number === config.BOT_ADMIN_PHONE.replace('+', '') ? 'YES' : 'NO'}`);
                    break;
                case 'settings':
                    // Admin-only command to show current settings
                    if (config.BOT_ADMIN_PHONE && contact.number === config.BOT_ADMIN_PHONE.replace('+', '')) {
                        await message.reply(`⚙️ *Bot Settings*

📊 *Daily Summary Settings:*
• Perfect Day Summary: ${config.SEND_DAILY_SUMMARY_ON_PERFECT_DAY ? '✅ Enabled' : '❌ Disabled'}

📢 *Reminder Settings:*
• Group Reminders: ${config.SEND_GROUP_REMINDERS ? '✅ Enabled' : '❌ Disabled'}
• Individual DMs: ✅ Always Enabled

⏰ *Schedule:*
• Reminders: ${config.DAILY_REMINDER_HOUR}:00, ${config.DAILY_REMINDER_HOUR_2}:00, ${config.DAILY_REMINDER_HOUR_3}:00
• Deadline: ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}
• Timezone: ${config.TIMEZONE}

💡 *To change settings:* Edit .env file and restart the service`);
                    } else {
                        await message.reply('🔒 Admin-only command.');
                    }
                    break;
                default:
                    await message.reply('❓ Unknown command. Type `!help` to see available commands.');
            }
        } catch (error) {
            logger.error('Error handling bot command:', error);
            await message.reply('❌ Sorry, there was an error processing your command.');
        }
    }

    async handleStatusCommand(message, chat) {
        try {
            if (chat.isGroup && chat.id._serialized === this.targetGroupId) {
                const today = new Date().toISOString().split('T')[0];
                const submissions = await this.submissionService.getTodaysSubmissions();
                
                // Get current group participants
                const participants = chat.participants;
                const submittedUserIds = new Set(submissions.map(sub => sub.user_id));
                
                // Find who hasn't submitted yet
                const notSubmitted = [];
                for (const participant of participants) {
                    const userId = participant.id._serialized;
                    // Skip bot itself
                    if (userId === this.client.info.wid._serialized) continue;
                    
                    if (!submittedUserIds.has(userId)) {
                        // Try to get contact name
                        try {
                            const contact = await this.client.getContactById(userId);
                            notSubmitted.push({
                                userId: userId,
                                name: contact.pushname || contact.number || userId.split('@')[0]
                            });
                        } catch (error) {
                            notSubmitted.push({
                                userId: userId,
                                name: userId.split('@')[0]
                            });
                        }
                    }
                }
                
                let statusMessage = `📊 *Daily Status Report* (${new Date().toLocaleDateString()})\n\n`;
                
                if (submissions.length > 0) {
                    statusMessage += `✅ *Submitted Today (${submissions.length}):*\n`;
                    submissions.forEach(sub => {
                        const time = new Date(sub.created_at).toLocaleTimeString('en-US', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        });
                        statusMessage += `📸 ${sub.name || sub.user_id} - ${time}\n`;
                    });
                    statusMessage += '\n';
                }
                
                if (notSubmitted.length > 0) {
                    statusMessage += `❌ *Not Submitted Yet (${notSubmitted.length}):*\n`;
                    notSubmitted.forEach(user => {
                        statusMessage += `⏰ ${user.name}\n`;
                    });
                    statusMessage += '\n';
                }
                
                // Add progress summary
                const totalMembers = participants.length - 1; // Exclude bot
                const progress = totalMembers > 0 ? Math.round((submissions.length / totalMembers) * 100) : 0;
                statusMessage += `📈 *Progress:* ${submissions.length}/${totalMembers} (${progress}%)\n`;
                
                const deadline = `${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}`;
                statusMessage += `⏰ *Deadline:* ${deadline}\n`;
                statusMessage += `🌍 *Timezone:* ${config.TIMEZONE}`;
                
                await message.reply(statusMessage);
            } else {
                await message.reply('📱 Use this command in the group or send me a private message for your personal status.');
            }
        } catch (error) {
            logger.error('Error in status command:', error);
            await message.reply('❌ Error retrieving status information.');
        }
    }

    async handleStatsCommand(message, chat, userId) {
        try {
            const overallStats = await this.submissionService.getOverallStats();
            const userStats = await this.submissionService.getSubmissionStats(userId);
            
            let statsMessage = `📈 *Statistics*\n\n`;
            
            // Overall stats
            statsMessage += `🌍 *Overall:*\n`;
            statsMessage += `👥 Total users: ${overallStats.total_users}\n`;
            statsMessage += `📸 Total submissions: ${overallStats.total_submissions}\n`;
            if (overallStats.first_submission_date) {
                statsMessage += `📅 First submission: ${new Date(overallStats.first_submission_date).toLocaleDateString()}\n`;
            }
            statsMessage += '\n';
            
            // User personal stats
            if (userStats) {
                statsMessage += `👤 *Your Stats:*\n`;
                statsMessage += `📸 Last 30 days: ${userStats.submissions_last_30_days} submissions\n`;
                if (userStats.last_submission_date) {
                    statsMessage += `📅 Last submission: ${new Date(userStats.last_submission_date).toLocaleDateString()}\n`;
                }
            }
            
            await message.reply(statsMessage);
        } catch (error) {
            logger.error('Error in stats command:', error);
            await message.reply('❌ Error retrieving statistics.');
        }
    }

    async handleHelpCommand(message, chat) {
        const isGroup = chat.isGroup && chat.id._serialized === this.targetGroupId;
        
        let helpMessage = `🤖 *A Pic a Day Bot Commands*\n\n`;
        
        if (isGroup) {
            helpMessage += `📋 *Group Commands:*\n`;
            helpMessage += `• \`!status\` - See today's submission status\n`;
            helpMessage += `• \`!stats\` - View submission statistics\n`;
            helpMessage += `• \`!help\` - Show this help message\n\n`;
        }
        
        helpMessage += `📱 *Private Commands:*\n`;
        helpMessage += `• \`/myinfo\` or \`!myinfo\` - Your personal submission info\n`;
        helpMessage += `• \`/help\` or \`!help\` - Show help message\n\n`;
        
        helpMessage += `📸 *How it works:*\n`;
        helpMessage += `• Post 1 picture or video daily before ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}\n`;
        helpMessage += `• Miss a day? You'll be removed automatically\n`;
        helpMessage += `• Send a picture or video to this bot privately to rejoin\n\n`;
        
        helpMessage += `💡 *Tips:*\n`;
        helpMessage += `• Media must be images or videos (not documents)\n`;
        helpMessage += `• One submission per day counts\n`;
        helpMessage += `• Bot reactions confirm your submission 📸🎥\n\n`;
        
        helpMessage += `Have fun sharing your daily moments! 📱✨`;
        
        await message.reply(helpMessage);
    }

    async handleMyInfoCommand(message, contact) {
        try {
            const userId = contact.id._serialized;
            const user = await this.userService.getUserStats(userId);
            const hasSubmittedToday = await this.submissionService.hasSubmittedToday(userId);
            
            let infoMessage = `👤 *Your Profile*\n\n`;
            
            if (user) {
                infoMessage += `📋 *Status:* ${user.status === 'active' ? '✅ Active' : user.status === 'removed' ? '❌ Removed' : '⏳ Pending'}\n`;
                infoMessage += `📸 *Today:* ${hasSubmittedToday ? '✅ Submitted' : '❌ Not submitted yet'}\n`;
                infoMessage += `📊 *This month:* ${user.submissions_this_month || 0} submissions\n`;
                infoMessage += `🔢 *Total submissions:* ${user.total_submissions || 0}\n`;
                
                if (user.removal_count > 0) {
                    infoMessage += `⚠️ *Times removed:* ${user.removal_count}\n`;
                }
                
                if (user.last_submission) {
                    infoMessage += `📅 *Last submission:* ${new Date(user.last_submission).toLocaleDateString()}\n`;
                }
            } else {
                infoMessage += `ℹ️ No data found. Send a picture or video to get started!`;
            }
            
            await message.reply(infoMessage);
        } catch (error) {
            logger.error('Error in myinfo command:', error);
            await message.reply('❌ Error retrieving your information.');
        }
    }

    async processReentrySubmission(message, contact) {
        try {
            const userId = contact.id._serialized;
            const media = await message.downloadMedia();
            
            // Post the image to the group
            const familyChat = await this.client.getChatById(this.targetGroupId);
            const messageMedia = new MessageMedia(media.mimetype, media.data, media.filename);
            
            await familyChat.sendMessage(messageMedia, {
                caption: `📸 Re-entry submission from ${contact.pushname || contact.number}`
            });
            
            // Re-invite user to group
            await this.groupService.addUserToGroup(this.targetGroupId, userId);
            
            // Update user status
            await this.userService.updateUserStatus(userId, 'active');
            await this.submissionService.recordSubmission(userId, contact.pushname || contact.number);
            
            // Send confirmation
            const mediaType = message.type === 'video' ? 'video' : 'picture';
            await message.reply(`✅ Your ${mediaType} has been posted to the group and you have been re-invited!`);
            
            logger.info(`Re-entry processed for ${contact.pushname || contact.number}`);
        } catch (error) {
            logger.error('Error processing re-entry submission:', error);
            await message.reply('❌ There was an error processing your submission. Please try again.');
        }
    }

    async sendInstructions(contact) {
        const instructions = `
🤖 *A Pic a Day Bot*

This bot manages daily picture sharing groups for friends and family.

📋 *Rules:*
• Post one picture or video per day before ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}
• If you miss a day, you'll be removed from the group
• Send a picture or video directly to this bot to rejoin

💡 *Commands:*
• \`/myinfo\` - Check your submission status and stats
• \`/help\` - Show this help message
• \`!status\` - Check group status (in group chat)
• \`!stats\` - View submission statistics

📸 *Tips:*
• Media must be sent as images or videos, not documents
• Bot will react with 📸 when your submission is recorded
• You can check group status anytime with \`!status\`

Have a great day! 📸✨
        `;
        
        const contactChat = await contact.getChat();
        await contactChat.sendMessage(instructions);
    }

    setupCronJobs() {
        // Daily enforcement job - runs at the deadline time
        const cronTime = `${config.DAILY_DEADLINE_MINUTE} ${config.DAILY_DEADLINE_HOUR} * * *`;
        cron.schedule(cronTime, async () => {
            await this.runDailyEnforcement();
        });

        // Multiple daily reminder jobs
        const reminderTimes = [
            { hour: config.DAILY_REMINDER_HOUR, label: 'first' },
            { hour: config.DAILY_REMINDER_HOUR_2, label: 'second' },
            { hour: config.DAILY_REMINDER_HOUR_3, label: 'final' }
        ];

        reminderTimes.forEach(reminder => {
            const reminderCron = `0 ${reminder.hour} * * *`;
            cron.schedule(reminderCron, async () => {
                await this.sendDailyReminders(reminder.label);
            });
        });

        logger.info(`Daily enforcement scheduled for ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}`);
        logger.info(`Daily reminders scheduled for: ${reminderTimes.map(r => `${r.hour}:00 (${r.label})`).join(', ')}`);
    }

    async runDailyEnforcement() {
        if (!this.isReady || !this.targetGroupId) {
            logger.warn('Bot not ready or group not configured for daily enforcement');
            return;
        }

        try {
            logger.info('Running daily enforcement...');
            
            // Get all group members
            const chat = await this.client.getChatById(this.targetGroupId);
            const participants = chat.participants;
            
            // Check submissions for today
            const today = new Date().toISOString().split('T')[0];
            const nonSubmitters = [];
            
            for (const participant of participants) {
                const userId = participant.id._serialized;
                
                // Skip bot itself
                if (userId === this.client.info.wid._serialized) continue;
                
                const hasSubmitted = await this.submissionService.hasSubmittedToday(userId);
                if (!hasSubmitted) {
                    nonSubmitters.push(participant);
                }
            }
            
            // Remove non-submitters
            for (const participant of nonSubmitters) {
                try {
                    await this.groupService.removeUserFromGroup(this.targetGroupId, participant.id._serialized);
                    await this.userService.updateUserStatus(participant.id._serialized, 'removed');
                    
                    // Send removal notification
                    const contact = await this.client.getContactById(participant.id._serialized);
                    const contactChat = await contact.getChat();
                    await contactChat.sendMessage(`
😔 *Oh no! You've been removed from the group*

📸 *Reason:* No picture or video posted today

🔄 *To rejoin:*
• Send any picture or video directly to this bot
• You'll be automatically re-invited!

Don't forget - one picture per day keeps you in the group! 📱✨
                    `);
                    
                    logger.info(`Removed ${contact.pushname || contact.number} for not submitting`);
                } catch (error) {
                    logger.error(`Error removing user ${participant.id._serialized}:`, error);
                }
            }
            
            // Send summary to group
            if (nonSubmitters.length > 0) {
                // Always send summary when people are removed
                const submittersList = submissions.length > 0 ? 
                    submissions.map(s => `📸 ${s.name || 'Unknown'}`).join('\n') : 
                    'None yet today';
                
                await chat.sendMessage(`
📊 *Daily Enforcement Report* 
🗓️ ${new Date().toLocaleDateString()}

✅ *Submitted today (${submissions.length}):*
${submittersList}

❌ *Removed for missing deadline (${nonSubmitters.length}):*
${nonSubmitters.map(p => `👋 ${p.id.user}`).join('\n')}

⏰ *Next deadline:* Tomorrow at ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}
📋 *Tip:* Use \`!status\` to check submissions anytime!
                `);
            } else if (config.SEND_DAILY_SUMMARY_ON_PERFECT_DAY) {
                // Only send "perfect day" summary if the option is enabled
                await chat.sendMessage(`
🎉 *Perfect Day!* 🎉

✅ All ${participants.length - 1} members posted their pictures today!

🏆 *Achievement Unlocked:* 100% Group Participation
📸 Keep the streak going tomorrow!

⏰ *Next deadline:* Tomorrow at ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}
                `);
            }
            
        } catch (error) {
            logger.error('Error in daily enforcement:', error);
        }
    }

    async sendDailyReminders(reminderType = 'first') {
        if (!this.isReady || !this.targetGroupId) {
            logger.warn('Bot not ready or group not configured for daily reminders');
            return;
        }

        try {
            logger.info(`Sending ${reminderType} daily reminders...`);
            
            // Get all group members
            const chat = await this.client.getChatById(this.targetGroupId);
            const participants = chat.participants;
            
            // Check who hasn't submitted today
            const nonSubmitters = [];
            
            for (const participant of participants) {
                const userId = participant.id._serialized;
                
                // Skip bot itself
                if (userId === this.client.info.wid._serialized) continue;
                
                const hasSubmitted = await this.submissionService.hasSubmittedToday(userId);
                if (!hasSubmitted) {
                    nonSubmitters.push(participant);
                }
            }
            
            // Send reminder to each non-submitter
            for (const participant of nonSubmitters) {
                try {
                    const contact = await this.client.getContactById(participant.id._serialized);
                    const contactChat = await contact.getChat();
                    const user = await this.userService.getUser(participant.id._serialized);
                    
                    const timeLeft = this.getTimeUntilDeadline();
                    const reminderMessage = this.getReminderMessage(reminderType, contact, timeLeft);
                    
                    await contactChat.sendMessage(reminderMessage);
                    logger.info(`${reminderType} reminder sent to ${contact.pushname || contact.number}`);
                    
                    // Small delay to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                } catch (error) {
                    logger.error(`Error sending ${reminderType} reminder to ${participant.id._serialized}:`, error);
                }
            }
            
            logger.info(`${reminderType} reminders sent to ${nonSubmitters.length} users`);
            
            // Send different group summaries based on reminder type
            if (config.SEND_GROUP_REMINDERS && nonSubmitters.length > 0) {
                const submissions = await this.submissionService.getTodaysSubmissions();
                const timeLeft = this.getTimeUntilDeadline();
                
                await chat.sendMessage(this.getGroupReminderMessage(reminderType, submissions.length, nonSubmitters.length, timeLeft));
            }
            
        } catch (error) {
            logger.error(`Error sending ${reminderType} daily reminders:`, error);
        }
    }

    getReminderMessage(reminderType, contact, timeLeft) {
        const messages = {
            first: `
� *Daily Picture Reminder*

👋 Hi ${contact.pushname || contact.number}!

⏰ You haven't posted your daily picture yet.
🕕 Time left: ${timeLeft}

� *Quick reminder:*
• Post any picture in the group
• Must be sent as an image (not document)
• Deadline: ${config.DAILY_DEADLINE_HOUR}:${config.DAILY_DEADLINE_MINUTE.toString().padStart(2, '0')}

💡 *Tip:* Even a simple selfie, food pic, or view counts! 😊

Don't let your friends down! 📷✨
            `,
            
            second: `
📸 *Second Reminder* ⚡

⏰ Hey ${contact.pushname || contact.number}!

🚨 Still waiting for your daily picture!
🕕 Time left: ${timeLeft}

📸 *Options:*
• Quick selfie 🤳
• What you're eating 🍽️
• Your current view 🌅
• Something interesting nearby �

⚠️ *Warning:* Deadline approaching fast!

Post now to stay in the group! 📱
            `,
            
            final: `
📸 *FINAL REMINDER* 🚨

⏰ Last chance ${contact.pushname || contact.number}!

🔴 Time left: ${timeLeft}
🔴 You will be REMOVED at midnight if no picture is posted!

📱 *Post ANY picture NOW:*
• Literally anything counts
• Takes 30 seconds
• Don't get removed!

⏳ This is your final warning! 

📷 POST NOW! 📷
            `
        };
        
        return messages[reminderType] || messages.first;
    }

    getGroupReminderMessage(reminderType, submitted, pending, timeLeft) {
        const messages = {
            first: `
📢 *6 PM Reminder Sent* 

📊 Current status:
✅ Submitted: ${submitted}
⏰ Pending: ${pending}

🕕 Time left: ${timeLeft}
💌 Friendly reminders sent to those who haven't posted yet!
            `,
            
            second: `
⚡ *8 PM - Second Reminder* 

📊 Status update:
✅ Submitted: ${submitted}
🚨 Still pending: ${pending}

⚠️ Getting closer to deadline!
📱 Come on team, let's see those pictures! 📸
            `,
            
            final: `
🚨 *FINAL CALL - 10 PM* 

📊 Last chance status:
✅ Submitted: ${submitted}
🔴 About to be removed: ${pending}

⏰ Time left: ${timeLeft}
🚨 Final warnings sent - post now or get removed at midnight!
            `
        };
        
        return messages[reminderType] || messages.first;
    }

    getTimeUntilDeadline() {
        const now = new Date();
        const today = new Date(now);
        today.setHours(config.DAILY_DEADLINE_HOUR, config.DAILY_DEADLINE_MINUTE, 0, 0);
        
        // If deadline has passed today, show time until tomorrow's deadline
        if (now > today) {
            today.setDate(today.getDate() + 1);
        }
        
        const timeDiff = today - now;
        const hours = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    async start() {
        try {
            await this.database.initialize();
            logger.info('Database initialized');
            
            await this.client.initialize();
            logger.info('WhatsApp client started');
        } catch (error) {
            logger.error('Error starting bot:', error);
            process.exit(1);
        }
    }

    async stop() {
        try {
            await this.client.destroy();
            await this.database.close();
            logger.info('Bot stopped successfully');
        } catch (error) {
            logger.error('Error stopping bot:', error);
        }
    }

    async sendTestDM(contact) {
        try {
            const contactChat = await contact.getChat();
            const timeLeft = this.getTimeUntilDeadline();
            
            const testMessage = `
🧪 *Test DM from A Pic a Day Bot*

👋 Hi ${contact.pushname || contact.number}!

This is a test to verify that Direct Messages are working correctly.

⏰ Current time left until deadline: ${timeLeft}

📱 If you receive this message, the DM functionality is working!

🔧 Test sent at: ${new Date().toLocaleString('en-US', { timeZone: config.TIMEZONE })}
            `;
            
            await contactChat.sendMessage(testMessage);
            logger.info(`Test DM sent successfully to ${contact.pushname || contact.number}`);
        } catch (error) {
            logger.error(`Error sending test DM to ${contact.pushname || contact.number}:`, error);
            throw error;
        }
    }
}

module.exports = APicADayBot;