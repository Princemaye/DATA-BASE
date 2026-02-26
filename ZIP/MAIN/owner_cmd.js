// ============================= R E Q U E S T =============================
const config = require("../config");
const os = require("os");
const fs = require("fs");
const path = require("path");
const { downloadMediaMessage } = require("prince-baileys");
const { writeFile } = require("fs/promises");
const { exec } = require("child_process");
const { cmd, commands } = require("../command");
const {getBuffer,
    getGroupAdmins,
    getRandom,
    h2k,
    isUrl,
    Json,
    runtime,
    sleep,
    fetchJson,
    getDateAndTime,
    tr,
    getMyGroupDetails,
    formatMessage,
    platformAwareRestart,
    uploadToCatbox, getContextInfo} = require("../lib/functions");

const {
    saveAutoReply,
    deleteAutoReply,
    updateAutoReply,
    deleteAllAutoReplies,
    getAllReplies,
    findReplies,
    handleAutoReply,
} = require("../lib/mongodb");
const DBM = require("../lib/user-db");
const GitHubDB = require("../lib/auto_function");
const dbData = require("../lib/config");
const { toSmallCaps, toBold } = require("../lib/fonts");
const { resetMovie } = require("../lib/movie_db");
const moment = require("moment-timezone");
const ymd_db = new DBM(dbData.TOKEN, dbData.USER_NAME, dbData.REPO_NAME);
const auto_rep = new GitHubDB(
    dbData.TOKEN,
    dbData.USER_NAME,
    dbData.REPO_NAME,
    dbData.AUTO_REP_DATA,
);
const tableName = dbData.tableName;
const key = dbData.key;
const { storenumrepdata } = require("../lib/numreply-db");
function formatNumber(num) {
    return String(num).padStart(2, "0");
}

const botName =
    config.BOT_NAME && config.BOT_NAME !== "default" ? config.BOT_NAME : null;

// ============================= F U N C T I O N S =============================
function getMimeTypeFromExtension(extension) {
    const mimeMap = {
        ".mp4": "video/mp4",
        ".mkv": "video/x-matroska",
        ".mp3": "audio/mpeg",
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".zip": "application/zip",
        ".rar": "application/x-rar-compressed",
        ".txt": "text/plain",
        ".js": "application/javascript",
    };
    // Ensure the extension is lowercase for reliable lookup
    return mimeMap[extension.toLowerCase()] || null;
}

// ============================= L A N G U A G E =============================
var allLangs = require("../lib/language.json");
var LANG = config.LANG === "EN" ? "EN" : config.LANG === "FR" ? "FR" : "EN";

var lang = allLangs[LANG];
var {
    errorMg,
    ownerMg,
    replyMg,
    invalidReply,
    validLinkMg,
    pfError,
    pfInvalid,
    pfNotFound,
    pfMention,
    badApply,
    restartMg,
    rsMg,
    dbReset,
    latestHave,
} = lang;

lang = "en";
if (config.LANG === "FR") {
    lang = "fr";
}

// ============================= C M D =============================

// Warning management commands
cmd(
    {
        pattern: "warnings",
        alias: ["warnlist", "checkwarns"],
        desc: "Check warnings for yourself or mentioned user",
        category: "group",
        use: ".warnings [@user]",
        react: "⚠️",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        {
            from,
            reply,
            isGroup,
            sender,
            senderNumber,
            isAdmins,
            isBotAdmins,
            isOwners,
            warning_db,
        },
    ) => {
        try {
            if (!isGroup) return reply("*This command only works in groups.*");

            let targetUser = sender;
            let targetNumber = senderNumber;

            // Check if user is mentioned
            if (m.quoted) {
                targetUser = m.quoted.sender;
                targetNumber = targetUser.split("@")[0];
            } else if (m.mentionUser && m.mentionUser[0]) {
                targetUser = m.mentionUser[0];
                targetNumber = targetUser.split("@")[0];
            }

            // Only admins can check others' warnings
            if (targetUser !== sender && !(isAdmins || isOwners)) {
                return reply(
                    "*Only admins can check warnings of other users.*",
                );
            }

            const warnings = await warning_db.getUserWarnings(from, targetUser);

            if (warnings.count === 0) {
                await reply(`✅ @${targetNumber} has no warnings.`, {
                    mentions: [targetUser],
                });
            } else {
                const lastWarn = warnings.lastWarning
                    ? new Date(warnings.lastWarning).toLocaleString()
                    : "Never";
                let warningText = `⚠️ *Warning Status for @${targetNumber}*\n\n`;
                warningText += `📊 Total Warnings: ${warnings.count}\n`;
                warningText += `⏰ Last Warning: ${lastWarn}\n\n`;

                // Show recent warnings (last 5)
                if (warnings.warnings.length > 0) {
                    warningText += `📝 Recent Warnings:\n`;
                    const recentWarns = warnings.warnings.slice(-5).reverse();
                    recentWarns.forEach((warn, index) => {
                        const time = new Date(warn.timestamp).toLocaleString();
                        warningText += `${index + 1}. ${warn.reason} - ${time}\n`;
                    });
                }

                warningText += `\n⚠️ Warning: ${3 - warnings.count} more warnings will result in removal from group.`;

                await reply(warningText, { mentions: [targetUser] });
            }
        } catch (e) {
            console.error("Warnings command error:", e);
            await reply("*Error checking warnings.*");
        }
    },
);

cmd(
    {
        pattern: "resetwarn",
        alias: ["clearwarns", "removewarnings"],
        desc: "Reset warnings for a user",
        category: "group",
        use: ".resetwarn @user",
        react: "🔄",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, reply, isGroup, isAdmins, isOwners, warning_db },
    ) => {
        try {
            if (!isGroup) return reply("*This command only works in groups.*");
            if (!isOwners)
                return reply("*Only bot owners can reset warnings.*"); // Changed to isOwners only

            let targetUser = null;

            if (m.quoted) {
                targetUser = m.quoted.sender;
            } else if (m.mentionUser && m.mentionUser[0]) {
                targetUser = m.mentionUser[0];
            }

            if (!targetUser) {
                return reply(
                    "*Please mention or reply to a user to reset their warnings.*",
                );
            }

            const targetNumber = targetUser.split("@")[0];
            await warning_db.resetWarnings(from, targetUser);

            await reply(`✅ Warnings have been reset for @${targetNumber}.`, {
                mentions: [targetUser],
            });
        } catch (e) {
            console.error("Resetwarn command error:", e);
            await reply("*Error resetting warnings.*");
        }
    },
);

cmd(
    {
        pattern: "warn",
        alias: ["addwarn", "warnuser"],
        desc: "Manually add a warning to a user",
        category: "group",
        use: ".warn @user [reason]",
        react: "⚠️",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        {
            from,
            reply,
            isGroup,
            isAdmins,
            isOwners,
            q,
            warning_db,
            senderNumber,
            botNumber2,
            botNumber,
            config,
            dbData,
            sender,
        },
    ) => {
        try {
            if (!isGroup) return reply("*This command only works in groups.*");
            if (!isOwners) return reply("*Only bot owners can warn users.*");

            let targetUser = null;
            let reason = "Manual warning by admin";

            if (m.quoted) {
                targetUser = m.quoted.sender;
                reason = q || reason;
            } else if (m.mentionUser && m.mentionUser[0]) {
                targetUser = m.mentionUser[0];
                const parts = q.split(" ");
                if (parts.length > 1) {
                    reason = parts.slice(1).join(" ");
                }
            }

            if (!targetUser) {
                return reply(
                    "*Please mention or reply to a user to warn them.*",
                );
            }

            const targetNumber = targetUser.split("@")[0];

            // CHECK 1: Don't allow warning yourself
            if (targetUser === sender) {
                return reply(`🤨 *Seriously?* You can't warn yourself!`);
            }

            // CHECK 2: Don't allow warning the bot
            const botJid = conn.user.id || botNumber2;
            if (targetUser === botJid) {
                return reply(`🤖 *Bot Protection*: You can't warn me!`);
            }

            // CHECK 3: Check if target user is an owner/developer using the SAME LOGIC as isOwners

            // Extract target number (remove @s.whatsapp.net or @lid)
            const targetNum = targetNumber;

            // Check if target is a developer (from dbData.DEVELOPER_NUMBERS)
            const isTargetDev =
                Array.isArray(dbData.DEVELOPER_NUMBERS) &&
                dbData.DEVELOPER_NUMBERS.includes(targetNum);

            // Check if target is in config.OWNER_NUMBER (this might be string or array)
            const ownerNumber = config?.OWNER_NUMBER || "";
            const isTargetOwner = Array.isArray(ownerNumber)
                ? ownerNumber.includes(targetNum)
                : ownerNumber === targetNum;

            // Check if target is the bot (already covered above, but using same logic)
            const isTargetBot =
                targetNum === botNumber || (botJid && targetUser === botJid);

            // Check if target is in config.SUDO_NUMBERS
            const sudoNumbers = config?.SUDO_NUMBERS || [];
            const isTargetSudo =
                sudoNumbers.includes(targetUser) ||
                sudoNumbers.includes(targetNum);

            // Combine all owner checks (same logic as isOwners in main file)
            const isTargetAnOwner =
                isTargetDev || isTargetOwner || isTargetBot || isTargetSudo;

            if (isTargetAnOwner) {
                return reply(
                    `👑 *Owner/Developer Protection*\nYou can't warn my owner/developer (@${targetNum})!`,
                );
            }

            // CHECK 4: Don't allow warning admins (optional - you can remove this if you want)
            const groupMetadata = await conn
                .groupMetadata(from)
                .catch(() => null);
            if (groupMetadata) {
                const admins = groupMetadata.participants
                    .filter((p) => p.admin)
                    .map((p) => p.id);
                if (admins.includes(targetUser)) {
                    return reply(
                        `🛡️ *Admin Protection*\n@${targetNum} is a group admin. You cannot warn group admins.`,
                    );
                }
            }

            // If all checks pass, add warning
            const newWarningCount = await warning_db.addWarning(
                from,
                targetUser,
                reason,
                "manual",
            );

            if (newWarningCount >= 3) {
                await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `🚫 *Final Warning Exceeded!*\n@${targetNumber}, You have received 3 warnings and have been removed from the group.`,
                    mentions: [targetUser],
                });
                await conn.groupParticipantsUpdate(
                    from,
                    [targetUser],
                    "remove",
                );
                await warning_db.resetWarnings(from, targetUser);
            } else {
                await reply(
                    `⚠️ Warning added to @${targetNumber}\nTotal warnings: ${newWarningCount}/3\nReason: ${reason}`,
                    { mentions: [targetUser] },
                );
            }
        } catch (e) {
            console.error("Warn command error:", e);
            await reply("*Error adding warning.*");
        }
    },
);

cmd(
    {
        pattern: "groupwarns",
        alias: ["allwarnings", "warnstats"],
        desc: "Show all warnings in the group",
        category: "group", // Changed from admin to owner
        use: ".groupwarns",
        react: "📊",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, reply, isGroup, isAdmins, isOwners, warning_db },
    ) => {
        try {
            if (!isGroup) return reply("*This command only works in groups.*");
            if (!isOwners)
                return reply("*Only bot owners can view all warnings.*"); // Changed to isOwners only

            const groupWarnings = await warning_db.getGroupWarnings(from);

            if (Object.keys(groupWarnings).length === 0) {
                return reply("✅ No users have warnings in this group.");
            }

            let warningText = `📊 *Group Warning Statistics*\n\n`;
            warningText += `👥 Total Users with Warnings: ${Object.keys(groupWarnings).length}\n\n`;

            // Sort by warning count (descending)
            const sortedWarnings = Object.entries(groupWarnings).sort(
                (a, b) => b[1].count - a[1].count,
            );

            sortedWarnings.forEach(([userId, data], index) => {
                const userNumber =
                    userId.split("_")[1]?.split("@")[0] || userId;
                warningText += `${index + 1}. @${userNumber} - ${data.count} warning${data.count !== 1 ? "s" : ""}\n`;
            });

            await reply(warningText, {
                mentions: sortedWarnings
                    .map(([userId]) => {
                        const userNumber =
                            userId.split("_")[1]?.split("@")[0] || userId;
                        return `${userNumber}@s.whatsapp.net`;
                    })
                    .filter(Boolean),
            });
        } catch (e) {
            console.error("Groupwarns command error:", e);
            await reply("*Error fetching group warnings.*");
        }
    },
);

cmd(
    {
        pattern: "clearallwarnings",
        alias: ["resetallwarns", "wipewarnings"],
        desc: "Clear ALL warnings from database",
        category: "group",
        use: ".clearallwarnings",
        react: "🗑️",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, warning_db }) => {
        try {
            if (!isOwners)
                return reply("*Only bot owners can clear all warnings.*");

            // Add confirmation
            await reply(
                `⚠️ *DANGER: This will delete ALL warnings from the database!*\n\nType "YES" to confirm.`,
            );

            // You would need to implement a confirmation system here
            // For now, we'll just show a warning
            await reply(
                "*To clear all warnings, please use the export command first, then manually clear the database file on GitHub.*",
            );
        } catch (e) {
            console.error("Clear warnings error:", e);
            await reply("*Error clearing warnings.*");
        }
    },
);

cmd(
    {
        pattern: "apply",
        react: "🗃",
        alias: ["set"],
        desc: "Apply a setting or tag a message (text/audio/video/image)",
        category: "owner",
        use: "apply < Reply to text/media >",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, prefix, q, sender }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const quoted = m?.quoted;
            if (!quoted) {
                const msg = await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `*${await tr("Please reply to a message (text/sticker/audio/video/image) ❌", lang)}*`,
                    },
                    { quoted: mek },
                );
                await conn.sendMessage(from, {
                    react: { text: "❓", key: msg.key },
                });
                return;
            }

            const mtype =
                quoted.mtype ||
                quoted.type ||
                Object.keys(quoted.message || {})[0] ||
                "";
            let text =
                quoted.text || quoted.conversation || quoted.caption || "";

            const isSticker = mtype.includes("sticker");
            const isAudio =
                mtype.includes("audio") || quoted.mimetype?.includes("audio");
            const isVideo =
                mtype.includes("video") || quoted.mimetype?.includes("video");
            const isImage =
                mtype.includes("image") || quoted.mimetype?.includes("image");
            const isMedia = isAudio || isVideo || isImage || isSticker;

            if (!text && !isMedia) {
                const msg = await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `*${await tr("Please reply to a text or media message ❌", lang)}*\n\n_Supported: Text, Sticker, Image, Video, Audio_`,
                    },
                    { quoted: mek },
                );
                await conn.sendMessage(from, {
                    react: { text: "❓", key: msg.key },
                });
                return;
            }

            // For media, upload to catbox and use URL as text
            if (isMedia) {
                try {
                    const buffer = await quoted.download();
                    const ext = isAudio
                        ? "mp3"
                        : isVideo
                          ? "mp4"
                          : isSticker
                            ? "webp"
                            : "jpg";
                    //  await reply("⏳ Uploading media to catbox...");
                    const mediaUrl = await uploadToCatbox(
                        buffer,
                        `file.${ext}`,
                    );
                    if (!mediaUrl) {
                        await reply("❌ Failed to upload media to catbox.");
                        return;
                    }
                    // Use URL as text for all options
                    text = mediaUrl;
                } catch (e) {
                    console.log("Upload error:", e.message);
                    await reply("❌ Error uploading media: " + e.message);
                    return;
                }
            }

            let info = `\`${toBold(botName || "PRINCE-MDX")} DB\`\n`;
            const mediaTypeLabel = isAudio
                ? "Audio"
                : isVideo
                  ? "Video"
                  : isSticker
                    ? "Sticker"
                    : isImage
                      ? "Image"
                      : "Text";
            // info += `\n📎 ${mediaTypeLabel} detected\n`;
            // info += `\n_Select where to apply:_`;

            let numrep = [];

            // Show all options - all use the same text/URL value
            numrep = [
                `${prefix}setenv PREFIX ${text}`,
                `${prefix}setenv OWNER_NUMBER ${text}`,
                `${prefix}setenv OWNER_NAME ${text}`,
                `${prefix}setenv OWNER_REACT_EMOJI ${text}`,
                `${prefix}setenv ANTI_DELETE_SEND ${text}`,
                `${prefix}setenv ANTI_BAD_VALUE ${text}`,
                `${prefix}setenv ANTI_LINK_VALUE ${text}`,
                `${prefix}setenv ANTI_MENTION_MESSAGE ${text}`,
                `${prefix}setenv SEEDR_EMAIL ${text}`,
                `${prefix}setenv SEEDR_PASSWORD ${text}`,
                `${prefix}setenv TIME_ZONE ${text}`,
                `${prefix}setenv AUTOSEND_TVSERIES_JID ${text}`,
                `${prefix}setenv CINESUBZ_API_KEY ${text}`,
            ];

            const labels = [
                "PREFIX",
                "OWNER_NUMBER",
                "OWNER_NAME",
                "OWNER_REACT_EMOJI",
                "ANTI_DELETE_SEND",
                "ANTI_BAD_VALUE",
                "ANTI_LINK_VALUE",
                "ANTI_MENTION_MESSAGE",
                "SEEDR_EMAIL",
                "SEEDR_PASSWORD",
                "TIME_ZONE",
                "AUTOSEND_TVSERIES_JID",
                "CINESUBZ_API_KEY",
            ];

            info += `\n📎 ${mediaTypeLabel} detected\n`;
            info += `\n_Select where to apply:_\n\n`;
            labels.forEach((label, i) => {
                info += `${formatNumber(i + 1)}. ${label}\n`;
            });
            info += `\n> ${config.FOOTER}`;

            const sentMsg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO }, caption: info },
                { quoted: mek },
            );
            await storenumrepdata({
                key: sentMsg.key,
                numrep,
                method: "nondecimal",
            });

        } catch (e) {
            console.log(e);
            await reply(errorMg, "❌");
        }
    },
);

cmd(
    {
        pattern: "customize",
        react: "🗃",
        alias: ["cus"],
        desc: "Customize bot",
        category: "owner",
        use: "customize < Reply to text >",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, prefix }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const text =
                m?.quoted?.type === "conversation"
                    ? m?.quoted?.conversation
                    : false;

            if (!text) {
                const msg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `*Please reply to a text message ❌*` },
                    { quoted: mek },
                );
                await conn.sendMessage(from, {
                    react: { text: "❓", key: msg.key },
                });
                return;
            }

            const bot_title = botName || "PRINCE-MDX";

            // All customizable options
            const numrep = [
                `${prefix}setenv BOT_NAME ${text}`,
                `${prefix}setenv MENU_MESSAGE ${text}`,
                `${prefix}setenv SYSTEM_MESSAGE ${text}`,
                `${prefix}setenv ALIVE_MESSAGE ${text}`,
                `${prefix}setenv LOGO ${text}`,
                `${prefix}setenv FOOTER ${text}`,
                `${prefix}setenv CAPTION ${text}`,
                `${prefix}setenv FILE_NAME ${text}`,
                `${prefix}setenv MOVIE_DETAILS_CARD ${text}`,
                `${prefix}setenv EPISODE_DETAILS_CARD ${text}`,
                `${prefix}setenv TIKTOK_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv FB_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv SONG_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv VIDEO_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv TWITTER_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv PORNHUB_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv XVIDEO_DETAILS_MESSAGE ${text}`,
                `${prefix}setenv OMDB_DETAILS_CARD ${text}`,
                `${prefix}setenv TMDB_DETAILS_CARD ${text}`,
            ];

            const rows = numrep.map((cmd) => ({
                title: cmd.split(" ")[1],
                description: "Tap to apply",
                id: cmd,
            }));

            const listData = {
                title: "Customize Bot Settings",
                sections: [
                    {
                        title: "Options",
                        rows,
                    },
                ],
            };

            // BUTTON MODE

            // NORMAL MODE (YOUR NEW DESIGN)
            let info = `╔══〘 *${bot_title}* 〙══╗
➠ Text Provided : ${text}
➠ Total Options : ${numrep.length}
╚══════════════════╝

╭━━━━❮ *CUSTOMIZABLE* ❯━⊷
`;

            info += numrep
                .map(
                    (cmd, i) =>
                        `┃➠ ${(i + 1).toString().padStart(2, "0")}. ${cmd.split(" ")[1]}`,
                )
                .join("\n");

            info += `\n╰━━━━━━━━━━━━━━━━━⊷\n${config.FOOTER}`;

            const sentMsg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO }, caption: info },
                { quoted: mek },
            );

            await conn.sendMessage(from, {
                react: { text: "🎨", key: sentMsg.key },
            });

            await storenumrepdata({
                key: sentMsg.key,
                numrep,
                method: "nondecimal",
            });
        } catch (e) {
            console.log(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "setting",
        react: "🗃",
        alias: ["settings"],
        desc: "Manage bot settings",
        category: "owner",
        use: "setting",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, prefix }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const header = `╔════〘 ${toBold("SETTINGS")} 〙════╗\n`;

            const settingsList = [
                {
                    key: "ANTI_CALL",
                    name: "Block Calls",
                    type: "boolean",
                    desc: "Automatically reject incoming WhatsApp calls",
                },
                {
                    key: "ANTI_LINK_ACTION",
                    name: "Link Guard",
                    options: ["delete", "kick", "warn"],
                    desc: "Action to take when someone sends links in groups",
                },
                {
                    key: "ANTI_BAD_ACTION",
                    name: "Bad Word Guard",
                    options: ["delete", "kick", "warn"],
                    desc: "Action to take when someone uses bad words",
                },
                {
                    key: "STATUS_MENTION_ACTION",
                    name: "Status Mention",
                    options: ["delete", "kick", "warn", "false"],
                    desc: "Action when bot is mentioned in status",
                },
                {
                    key: "ANTI_CALL_ACTION",
                    name: "Call Action",
                    options: ["cut", "block"],
                    desc: "Cut the call or block the caller",
                },
                {
                    key: "ANTI_DELETE",
                    name: "Anti Delete",
                    type: "boolean",
                    desc: "Recover and resend deleted messages",
                },
                {
                    key: "AUTO_REACT",
                    name: "Auto React",
                    type: "boolean",
                    desc: "Automatically react to incoming messages",
                },
                {
                    key: "AUTO_BLOCK",
                    name: "Auto Block",
                    type: "boolean",
                    desc: "Block unknown numbers automatically",
                },
                {
                    key: "AUTO_READ_MESSAGE",
                    name: "Read Msgs",
                    type: "boolean",
                    desc: "Automatically mark messages as read",
                },
                {
                    key: "AUTO_READ_STATUS",
                    name: "View Status",
                    type: "boolean",
                    desc: "Automatically view contacts status updates",
                },
                {
                    key: "AUTO_REACT_STATUS",
                    name: "React Status",
                    type: "boolean",
                    desc: "Automatically react to status updates",
                },
                {
                    key: "AUTO_SEND_WELCOME_MESSAGE",
                    name: "Welcome Msg",
                    type: "boolean",
                    desc: "Send welcome message to new group members",
                },
                {
                    key: "AUTO_VOICE",
                    name: "Auto Voice",
                    type: "boolean",
                    desc: "Convert text messages to voice notes",
                },
                {
                    key: "AUTO_STICKER",
                    name: "Auto Sticker",
                    type: "boolean",
                    desc: "Automatically convert images to stickers",
                },
                {
                    key: "AUTO_REPLY",
                    name: "Auto Reply",
                    type: "boolean",
                    desc: "Enable automatic replies to messages",
                },
                {
                    key: "AUTO_RECORDING",
                    name: "Recording",
                    type: "boolean",
                    desc: "Show recording status while processing",
                },
                {
                    key: "AUTO_TYPING",
                    name: "Typing",
                    type: "boolean",
                    desc: "Show typing indicator while processing",
                },
                {
                    key: "ALLWAYS_ONLINE",
                    name: "Always Online",
                    type: "boolean",
                    desc: "Keep bot online status always visible",
                },
                {
                    key: "WORK_TYPE",
                    name: "Work Mode",
                    options: ["public", "private", "only_group", "inbox"],
                    desc: "Who can use bot: everyone, owner only, groups, or inbox",
                },
                {
                    key: "LANG",
                    name: "Language",
                    options: ["EN", "FR"],
                    desc: "Bot response language",
                },
                {
                    key: "AI_MODE",
                    name: "Chat Bot Mode",
                    type: "boolean",
                    desc: "Enable AI chatbot responses",
                },
                {
                    key: "OWNER_REACT",
                    name: "Owner React",
                    type: "boolean",
                    desc: "React to owner messages only",
                },
                {
                    key: "XVIDEO_DL",
                    name: "Adult DL",
                    type: "boolean",
                    desc: "Enable adult content downloads",
                },
                {
                    key: "MOVIE_DL",
                    name: "Movie DL",
                    options: ["only_me", "only_owners", "all", "disable"],
                    desc: "Who can use movie download feature",
                },
                {
                    key: "ANTI_DELETE_WORK",
                    name: "Anti-Del Scope",
                    options: ["only_inbox", "only_group", "all"],
                    desc: "Where anti-delete should work",
                },
                {
                    key: "ANTI_MENTION",
                    name: "Anti Mention",
                    type: "boolean",
                    desc: "Auto-reply when bot is mentioned in groups",
                },
            ];

            let info = header + `\n`;
            const numrep = [];

            settingsList.forEach((s, i) => {
                const idx = i + 1;
                info += `╭━━❮ ${toBold(s.name)} ❯━━╮\n`;
                if (s.type === "boolean") {
                    info += `┃ ${idx}.1  ${toSmallCaps("enable")}\n`;
                    info += `┃ ${idx}.2  ${toSmallCaps("disable")}\n`;
                    numrep.push(`${idx}.1 ${prefix}setenv ${s.key} true`);
                    numrep.push(`${idx}.2 ${prefix}setenv ${s.key} false`);
                } else if (s.options) {
                    s.options.forEach((opt, oi) => {
                        info += `┃ ${idx}.${oi + 1}  ${toSmallCaps(opt)}\n`;
                        numrep.push(`${idx}.${oi + 1} ${prefix}setenv ${s.key} ${opt}`);
                    });
                }
                info += `╰━━━━━━━━━━━╯\n`;
            });

            info += `> ${config.FOOTER}`;

            const sentMsg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO }, caption: info },
                { quoted: mek },
            );

            await storenumrepdata({
                key: sentMsg.key,
                numrep,
                method: "decimal",
            });

        } catch (e) {
            console.log(e);
            reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "sudo",
        react: "👨🏻‍🔧",
        alias: ["setsudo"],
        desc: "Change sudo access",
        category: "owner",
        use: "sudo < Mention user ||  >",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, prefix, isGroup }) => {
        try {
            if (!isOwners) return await reply(ownerMg);
            let user = null;

            if (isGroup) {
                user = m.quoted?.sender || m?.mentionUser?.[0] || from;
            } else {
                user = from;
            }

            if (
                !user ||
                (!user.endsWith("@g.us") &&
                    !user.endsWith("@s.whatsapp.net") &&
                    !user.endsWith("@lid"))
            ) {
                const msg = await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `*${await tr("Please specify a valid user. ❌", lang)}*`,
                    },
                    { quoted: mek },
                );
                await conn.sendMessage(from, {
                    react: { text: "❓", key: msg.key },
                });
                return;
            }

            let userTag = "User Jid";
            if (user.endsWith("@g.us")) userTag = "Group Jid";
            else if (user.endsWith("@lid")) userTag = "User Lid";

            let info = `╔════〘 ${toBold("SUDO")} 〙════╗\n\n`;
            info += `👤 *${userTag}:* ${user}\n\n`;
            const numrep = [];

            if (user.endsWith("@g.us")) {
                info += `╭━━❮ ${toBold("Sudo Groups")} ❯━━╮\n`;
                info += `┃ 1.1  ${toSmallCaps("add")}\n`;
                info += `┃ 1.2  ${toSmallCaps("remove")}\n`;
                info += `╰━━━━━━━━━━━╯\n`;
                numrep.push(`1.1 ${prefix}set_sudo SUDO_GROUPS add ${user}`);
                numrep.push(`1.2 ${prefix}set_sudo SUDO_GROUPS remove ${user}`);

                info += `╭━━❮ ${toBold("Band Groups")} ❯━━╮\n`;
                info += `┃ 2.1  ${toSmallCaps("add")}\n`;
                info += `┃ 2.2  ${toSmallCaps("remove")}\n`;
                info += `╰━━━━━━━━━━━╯\n`;
                numrep.push(`2.1 ${prefix}set_sudo BAND_GROUPS add ${user}`);
                numrep.push(`2.2 ${prefix}set_sudo BAND_GROUPS remove ${user}`);
            } else {
                info += `╭━━❮ ${toBold("Sudo Numbers")} ❯━━╮\n`;
                info += `┃ 1.1  ${toSmallCaps("add")}\n`;
                info += `┃ 1.2  ${toSmallCaps("remove")}\n`;
                info += `╰━━━━━━━━━━━╯\n`;
                numrep.push(`1.1 ${prefix}set_sudo SUDO_NUMBERS add ${user}`);
                numrep.push(`1.2 ${prefix}set_sudo SUDO_NUMBERS remove ${user}`);

                info += `╭━━❮ ${toBold("Band Users")} ❯━━╮\n`;
                info += `┃ 2.1  ${toSmallCaps("add")}\n`;
                info += `┃ 2.2  ${toSmallCaps("remove")}\n`;
                info += `╰━━━━━━━━━━━╯\n`;
                numrep.push(`2.1 ${prefix}set_sudo BAND_USERS add ${user}`);
                numrep.push(`2.2 ${prefix}set_sudo BAND_USERS remove ${user}`);
            }

            info += `\n> ${config.FOOTER}`;

            const sentMsg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO }, caption: info },
                { quoted: mek },
            );

            await storenumrepdata({
                key: sentMsg.key,
                numrep,
                method: "decimal",
            });

        } catch (e) {
            console.log(e);
            await reply(errorMg, "❌");
        }
    },
);

cmd(
    {
        pattern: "setenv",
        react: "👨🏻‍🔧",
        ontAddCommandList: true,
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, args }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const [setting, ...valueParts] = args;
            const data = valueParts.join(" ").trim();

            if (!setting || !data) {
                return reply(
                    `⚠️ Usage: ${config.PREFIX}setenv <setting> <value>`,
                );
            }

            if (setting === "PREFIX") {
                const allowedPattern =
                    /^[a-zA-Z0-9~@#$%^&*()_+{}|":<>?/.,';\][=\-]{1}$/;
                if (!allowedPattern.test(data))
                    return reply(setting + badApply);
            } else if (setting === "LOGO") {
                if (!data.startsWith("https://"))
                    return reply(setting + badApply);
            } else if (setting === "OWNER_NUMBER") {
                if (!/^\d{10,15}$/.test(data)) return reply(setting + badApply);
            } else if (setting === "OWNER_REACT_EMOJI") {
                if (!/\p{Emoji}/u.test(data)) return reply(setting + badApply);
            } else if (setting === "TIME_ZONE") {
                if (!moment.tz.zone(data)) return reply(setting + badApply);
            }

            let olddata = await ymd_db.get(tableName, setting);
            if (data === olddata) {
                return reply(`*${await tr("This is already set", lang)} ✔*`);
            }

            await ymd_db.input(tableName, setting, data);
            // Update in-memory config immediately
            config[setting] = data;
            await reply(
                `*🔁 ${setting.toUpperCase()} UPDATE:*\n\n👨🏻‍🔧 ➠ [ "${data}" ]`,
            );

            await conn.sendMessage(from, {
                react: { text: "✔", key: mek.key },
            });

            if (setting === "LANG" || setting === "CINESUBZ_API_KEY") {
                await reply(restartMg);
                platformAwareRestart();
            } else if (setting === "XVIDEO_DL" && data === "true") {
                await reply(
                    `*${await tr("Please note that PRINCE-MD owners do not assume any responsibility for enabling the 18+ downloader. ‼️", lang)}*`,
                );
            }
        } catch (e) {
            console.error("❌ setenv command error:", e);
            await reply(
                `*${await tr("❌ An error occurred while updating.", lang)}*`,
            );
        }
    },
);

cmd(
    {
        pattern: "botpic",
        alias: ["botimg"],
        react: "🖼️",
        desc: "Set bot picture/logo URL",
        category: "owner",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, args, q }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const quoted = m?.quoted;
            const isQuotedImage = quoted && (
                quoted.mtype?.includes("image") ||
                quoted.type?.includes("image") ||
                quoted.mimetype?.includes("image") ||
                (quoted.message && Object.keys(quoted.message)[0]?.includes("image"))
            );

            if (isQuotedImage) {
                await reply(`*🖼️ Uploading image, please wait...*`);
                const buffer = await quoted.download();
                const url = await uploadToCatbox(buffer, 'botpic.jpg');
                if (!url || !isUrl(url)) {
                    return await reply(`*❌ Failed to upload image. Try again or use a URL instead.*`);
                }

                await ymd_db.input(tableName, "ALIVE_LOGO", url);
                config.ALIVE_LOGO = url;
                config.LOGO = url;
                config.CONTEXT_LOGO = url;

                await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: url },
                    caption: `*🖼️ Bot picture updated successfully ✔*\n\n${toSmallCaps("url")}: ${url}`,
                }, { quoted: mek });

                return await conn.sendMessage(from, { react: { text: "✔", key: mek.key } });
            }

            const url = q?.trim();

            if (!url) {
                const currentPic = config.LOGO || "Not set";
                return await reply(
                    `${toBold("🖼️ Bot Picture Settings")}\n\n` +
                    `${toSmallCaps("current")}: ${currentPic}\n\n` +
                    `${toSmallCaps("usage")}:\n` +
                    `• Reply to an image with .botpic\n` +
                    `• .botpic <image_url> - Set new bot picture\n` +
                    `• .botpic reset - Reset to default`
                );
            }

            if (url.toLowerCase() === "reset") {
                await ymd_db.input(tableName, "ALIVE_LOGO", "");
                config.ALIVE_LOGO = "";
                config.LOGO = config.DEFAULT_LOGO || "";
                config.CONTEXT_LOGO = config.DEFAULT_LOGO || "";
                await reply(`*🖼️ Bot picture has been reset to default ✔*`);
                return await conn.sendMessage(from, { react: { text: "✔", key: mek.key } });
            }

            if (!isUrl(url)) {
                return await reply(`*❌ Please provide a valid image URL.*`);
            }

            await ymd_db.input(tableName, "ALIVE_LOGO", url);
            config.ALIVE_LOGO = url;
            config.LOGO = url;
            config.CONTEXT_LOGO = url;

            await conn.sendMessage(from, {
                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: url },
                caption: `*🖼️ Bot picture updated successfully ✔*\n\n${toSmallCaps("url")}: ${url}`,
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: "✔", key: mek.key } });
        } catch (e) {
            console.error("❌ botpic command error:", e);
            await reply(`*❌ Failed to set bot picture. Make sure the URL or image is valid.*`);
        }
    },
);

cmd(
    {
        pattern: "set_sudo",
        react: "👨🏻‍🔧",
        dontAddCommandList: true,
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, args }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const [setting, action, ...valueParts] = args;
            const data = valueParts.join(" ").trim();

            if (!setting || !action || !data) {
                return reply(
                    `⚠️ Usage: ${config.PREFIX}set_sudo <setting> <add/remove> <value>`,
                );
            }

            // Validate data format
            let isValid = false;

            if (setting === "SUDO_NUMBERS" || setting === "BAND_USERS") {
                isValid = /^\d{10,20}@(s\.whatsapp\.net|lid)$/.test(data);
            } else if (setting === "SUDO_GROUPS" || setting === "BAND_GROUPS") {
                isValid = /^\d{10,20}@g\.us$/.test(data);
            }

            if (!isValid)
                return reply(
                    await tr(`*❌ Invalid value format for ${setting}*`, lang),
                );

            // Utility
            const isInList = async () => {
                const getdata = await ymd_db.get(tableName, setting);
                if (!Array.isArray(getdata)) return false;
                return getdata.includes(data);
            };

            let olddata = await ymd_db.get(tableName, setting);
            if (!Array.isArray(olddata)) olddata = [];

            if (action === "add") {
                if (await isInList())
                    return await reply(await tr("*⚠️ Already Exists*", lang));

                olddata.push(data);
                await ymd_db.input(tableName, setting, olddata);
                await reply(`✅ *${data} added to ${setting}*`);
                await conn.sendMessage(from, {
                    react: { text: "✔", key: mek.key },
                });
            } else if (action === "delete") {
                if (!(await isInList()))
                    return await reply(
                        await tr("*⚠️ Not Found in List*", lang),
                    );

                const index = olddata.indexOf(data);
                if (index !== -1) olddata.splice(index, 1);

                await ymd_db.input(tableName, setting, olddata);
                await reply(`✅ *${data} removed from ${setting}*`);
                await conn.sendMessage(from, {
                    react: { text: "✔", key: mek.key },
                });
            } else {
                return await reply(
                    await tr("⚠️ Action must be `add` or `delete`.", lang),
                );
            }
        } catch (e) {
            console.error("❌ set_sudo command error:", e);
            await reply(
                `*${await tr("An error occurred while updating.", lang)}*`,
            );
        }
    },
);

cmd(
    {
        pattern: "setreact",
        react: "⚡",
        alias: ["addreact"],
        desc: "Set a custom react emoji for a JID",
        category: "owner",
        use: "<jid> <emoji>",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, args }) => {
        try {
            if (!isOwners) return reply(ownerMg);

            const [jid, emoji] = args;
            if (!jid || !emoji) {
                return reply(
                    `⚠️ Usage: ${config.PREFIX}setreact <jid> <emoji>`,
                );
            }

            // ✅ allow only @s.whatsapp.net or @lid
            if (!jid.endsWith("@s.whatsapp.net") && !jid.endsWith("@lid")) {
                return await reply(
                    await tr(
                        "❌ Only @s.whatsapp.net or @lid JIDs are allowed.",
                        lang,
                    ),
                );
            }

            // ✅ take only number part before "@"
            const cleanJid = jid.includes("@") ? jid.split("@")[0] : jid;

            let reacts = (await ymd_db.get(tableName, "CUSTOM_REACTS")) || [];

            // Check duplicate
            if (reacts.find((r) => r.jid === cleanJid)) {
                return await reply(
                    await tr(
                        `⚠️ React for *${cleanJid}* already exists.`,
                        lang,
                    ),
                );
            }

            // Save
            reacts.push({ jid: cleanJid, emoji });
            await ymd_db.input(tableName, "CUSTOM_REACTS", reacts);

            await reply(`✅ React for *${cleanJid}* set as *${emoji}*`);
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "removereact",
        react: "🗑️",
        alias: ["delreact", "rmreact"],
        desc: "Remove a saved react for a JID",
        category: "owner",
        use: "removereact <jid>",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, args }) => {
        try {
            if (!isOwners) return reply(ownerMg);

            const [jid] = args;
            if (!jid)
                return reply(`⚠️ Usage: ${config.PREFIX}removereact <jid>`);

            const cleanJid = jid.includes("@") ? jid.split("@")[0] : jid;

            let reacts = (await ymd_db.get(tableName, "CUSTOM_REACTS")) || [];

            const index = reacts.findIndex((r) => r.jid === cleanJid);
            if (index === -1)
                return await reply(
                    await tr(`⚠️ No react found for *${cleanJid}*`, lang),
                );

            reacts.splice(index, 1);
            await ymd_db.input(tableName, "CUSTOM_REACTS", reacts);

            await reply(`✅ React for *${cleanJid}* removed successfully.`);
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "listreact",
        react: "📄",
        alias: ["reacts", "showreact", "reactlist"],
        desc: "List all saved reacts",
        category: "owner",
        use: "listreact",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners }) => {
        try {
            if (!isOwners) return reply(ownerMg);

            const reacts = (await ymd_db.get(tableName, "CUSTOM_REACTS")) || [];

            if (!reacts.length)
                return await reply(await tr("⚠️ No reacts found.", lang));

            let text = `📌 *${toSmallCaps("Saved Reacts")}:*\n\n`;
            reacts.forEach((r, i) => {
                text += `${i + 1}. ${toSmallCaps("JID")}: ${r.jid}\n   ${toSmallCaps("Emoji")}: ${r.emoji}\n\n`;
            });

            await reply(text);
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "resetreact",
        react: "♻️",
        alias: ["clearreact", "resetreactions", "reactclear"],
        desc: "Reset all saved reacts",
        category: "owner",
        use: "resetreact",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners }) => {
        try {
            if (!isOwners) return reply(ownerMg);

            await ymd_db.input(tableName, "CUSTOM_REACTS", []);

            await reply("♻️ All saved reacts have been reset successfully.");
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "restart",
        react: "🔁",
        desc: "To restart bot",
        category: "owner",
        use: "restart",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, from }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const { exec } = require("child_process");
            await reply(restartMg);

            if (
                (dbData.HOST_NAME && dbData.HOST_NAME == "Mizta Cloud") ||
                dbData.HOST_NAME == "nightwabot"
            )
                return await reply(
                    "Since this has been deployed from Mizta Cloud, if you need to restart, please restart from the Mizta Cloud Site. ⚠️",
                );

            await reply(rsMg);
            platformAwareRestart();
        } catch (e) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key },
            });
            console.log(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "resetdb",
        react: "🗃️",
        desc: "Reset database and restart bot.",
        category: "owner",
        use: "resetdb",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, from }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            await ymd_db.resetFile(dbData.tableName, "Database Reseted 🔁");
            await reply(dbReset);
            await m.react("✅");

            if (dbData.HOST_NAME && dbData.HOST_NAME == "Mizta Cloud")
                return await reply(
                    "Since this has been deployed from Mizta Cloud, if you need to restart, please restart from the Mizta Cloud Site. ⚠️",
                );

            platformAwareRestart();
        } catch (e) {
            console.error(e);
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key },
            });
            await reply(errorMg || "❌ Something went wrong!");
        }
    },
);

cmd(
    {
        pattern: "resetmvdb",
        react: "🗃️",
        desc: "Reset movie database",
        category: "owner",
        use: "resetmvdb",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, from }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            await resetMovie(dbReset);
            await m.react("✅");
        } catch (e) {
            console.error(e);
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key },
            });
            await reply(errorMg || "❌ Something went wrong!");
        }
    },
);

cmd(
    {
        pattern: "id",
        react: "⚜",
        alias: ["getdeviceid"],
        desc: "Get message id",
        category: "owner",
        use: "id",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            if (!m.quoted) return reply("*Please reply a Message... ℹ️*");
            await reply(m?.quoted?.id);
        } catch (e) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key },
            });
            console.log(e);
            reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "vv2",
        react: "👁️",
        alias: ["getvv2", "viewonce2"],
        desc: "View once media extractor",
        category: "owner",
        use: "vv <reply to view once>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        {
            from,
            l,
            isDev,
            msg,
            quoted,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            botNumber,
            pushname,
            isMe,
            isOwner,
            groupMetadata,
            groupName,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
        },
    ) => {
        if (!isOwner) return await reply(ownerMg);

        if (!m.quoted) {
            return await reply(
                await tr(
                    "Reply to a View Once Photo / Video or Audio ..❗.",
                    lang,
                ),
            );
        }

        try {
            // Get the owner's chat ID (your private chat)
            const ownerChatId = conn.user.id; // This is your bot's user ID (owner's chat)

            // Send notification that media will be sent to owner's chat
            //await reply(await tr('📥 Downloading view once media... It will be sent to the owner\'s private chat.', lang));

            // Check if it's a view once message
            if (
                m.quoted?.type === "viewOnceMessageV2" ||
                m.quoted?.type === "viewOnceMessage"
            ) {
                // Get the media from the view once message
                const viewOnceContent =
                    m.quoted.message?.viewOnceMessageV2?.message ||
                    m.quoted.message?.viewOnceMessage?.message;

                if (viewOnceContent?.videoMessage) {
                    // It's a video
                    const caption = viewOnceContent.videoMessage?.caption || "";
                    await conn.sendMessage(ownerChatId, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: await m.quoted.download(),
                        caption:
                            `*🎬 View Once Video*\n\n` +
                            `*👤 From:* ${pushname}\n` +
                            `*📞 Sender:* ${senderNumber}\n` +
                            `*💬 In:* ${isGroup ? groupName : "Private Chat"}\n` +
                            (isGroup ? `*🏷️ Group ID:* ${from}\n` : "") +
                            `*📅 Time:* ${getDateAndTime()}\n\n` +
                            (caption ? `*📝 Caption:* ${caption}\n` : "") +
                            `${config.CAP || ""}`,
                        mimetype:
                            viewOnceContent.videoMessage?.mimetype ||
                            "video/mp4",
                    });
                } else if (viewOnceContent?.imageMessage) {
                    // It's an image
                    const caption = viewOnceContent.imageMessage?.caption || "";
                    await conn.sendMessage(ownerChatId, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: await m.quoted.download(),
                        caption:
                            `*🖼️ View Once Image*\n\n` +
                            `*👤 From:* ${pushname}\n` +
                            `*📞 Sender:* ${senderNumber}\n` +
                            `*💬 In:* ${isGroup ? groupName : "Private Chat"}\n` +
                            (isGroup ? `*🏷️ Group ID:* ${from}\n` : "") +
                            `*📅 Time:* ${getDateAndTime()}\n\n` +
                            (caption ? `*📝 Caption:* ${caption}\n` : "") +
                            `${config.CAP || ""}`,
                    });
                } else if (viewOnceContent?.audioMessage) {
                    // It's an audio
                    await conn.sendMessage(ownerChatId, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), audio: await m.quoted.download(),
                        mimetype:
                            viewOnceContent.audioMessage?.mimetype ||
                            "audio/mpeg",
                        caption:
                            `*🎵 View Once Audio*\n\n` +
                            `*👤 From:* ${pushname}\n` +
                            `*📞 Sender:* ${senderNumber}\n` +
                            `*💬 In:* ${isGroup ? groupName : "Private Chat"}\n` +
                            (isGroup ? `*🏷️ Group ID:* ${from}\n` : "") +
                            `*📅 Time:* ${getDateAndTime()}\n\n` +
                            `${config.CAP || ""}`,
                    });
                } else {
                    return await reply(
                        await tr(
                            "❌ Unsupported media type in view once message.",
                            lang,
                        ),
                    );
                }
            } else {
                // If it's not a view once message but might be regular media with view once flag
                if (
                    m.quoted?.videoMessage?.viewOnce ||
                    m.quoted?.imageMessage?.viewOnce
                ) {
                    // Handle regular media marked as view once
                    if (m.quoted?.videoMessage) {
                        const caption = m.quoted.videoMessage?.caption || "";
                        await conn.sendMessage(ownerChatId, {
                            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: await m.quoted.download(),
                            caption:
                                `*🎬 View Once Video*\n\n` +
                                `*👤 From:* ${pushname}\n` +
                                `*📞 Sender:* ${senderNumber}\n` +
                                `*💬 In:* ${isGroup ? groupName : "Private Chat"}\n` +
                                (isGroup ? `*🏷️ Group ID:* ${from}\n` : "") +
                                `*📅 Time:* ${getDateAndTime()}\n\n` +
                                (caption ? `*📝 Caption:* ${caption}\n` : "") +
                                `${config.CAP || ""}`,
                            mimetype:
                                m.quoted.videoMessage?.mimetype || "video/mp4",
                        });
                    } else if (m.quoted?.imageMessage) {
                        const caption = m.quoted.imageMessage?.caption || "";
                        await conn.sendMessage(ownerChatId, {
                            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: await m.quoted.download(),
                            caption:
                                `*🖼️ View Once Image*\n\n` +
                                `*👤 From:* ${pushname}\n` +
                                `*📞 Sender:* ${senderNumber}\n` +
                                `*💬 In:* ${isGroup ? groupName : "Private Chat"}\n` +
                                (isGroup ? `*🏷️ Group ID:* ${from}\n` : "") +
                                `*📅 Time:* ${getDateAndTime()}\n\n` +
                                (caption ? `*📝 Caption:* ${caption}\n` : "") +
                                `${config.CAP || ""}`,
                        });
                    }
                } else {
                    return await reply(
                        await tr(
                            '❌ This is not a "View Once" media. Reply to a View Once Image / Video or Audio.',
                            lang,
                        ),
                    );
                }
            }

            // Send confirmation to the original chat
            // await reply(await tr('✅ View once media has been downloaded and sent to the owner\'s private chat.', lang));
        } catch (error) {
            console.error("View Once Error:", error);
            return await reply(
                await tr(
                    "❌ Error processing the View Once media: " + error.message,
                    lang,
                ),
            );
        }
    },
);

cmd(
    {
        pattern: "vv",
        react: "👁️",
        alias: ["getvv", "viewonce"],
        desc: "View once media extractor",
        category: "owner",
        use: "vv <reply to view once>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        {
            from,
            l,
            isDev,
            msg,
            quoted,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            botNumber,
            pushname,
            isMe,
            isOwner,
            groupMetadata,
            groupName,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
        },
    ) => {
        if (!isOwner) return await reply(ownerMg);

        if (!m.quoted) {
            return await reply(
                await tr(
                    "Reply to a View Once Photo / Video or Audio to upload it as normal media type..❗.",
                    lang,
                ),
            );
        }

        try {
            // Check if it's a view once message
            if (
                m.quoted?.type === "viewOnceMessageV2" ||
                m.quoted?.type === "viewOnceMessage"
            ) {
                // Get the media from the view once message
                const viewOnceContent =
                    m.quoted.message?.viewOnceMessageV2?.message ||
                    m.quoted.message?.viewOnceMessage?.message;

                if (viewOnceContent?.videoMessage) {
                    // It's a video
                    await conn.sendMessage(from, {
                            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: await m.quoted.download(),
                            caption:
                                viewOnceContent.videoMessage?.caption || "",
                            mimetype:
                                viewOnceContent.videoMessage?.mimetype ||
                                "video/mp4",
                        },
                        { quoted: mek },
                    );
                } else if (viewOnceContent?.imageMessage) {
                    // It's an image
                    await conn.sendMessage(from, {
                            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: await m.quoted.download(),
                            caption:
                                viewOnceContent.imageMessage?.caption || "",
                        },
                        { quoted: mek },
                    );
                } else if (viewOnceContent?.audioMessage) {
                    // It's an audio
                    await conn.sendMessage(from, {
                            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), audio: await m.quoted.download(),
                            mimetype:
                                viewOnceContent.audioMessage?.mimetype ||
                                "audio/mpeg",
                        },
                        { quoted: mek },
                    );
                } else {
                    return await reply(
                        await tr(
                            "❌ Unsupported media type in view once message.",
                            lang,
                        ),
                    );
                }
            } else {
                // If it's not a view once message but might be regular media with view once flag
                if (
                    m.quoted?.videoMessage?.viewOnce ||
                    m.quoted?.imageMessage?.viewOnce
                ) {
                    // Handle regular media marked as view once
                    if (m.quoted?.videoMessage) {
                        await conn.sendMessage(from, {
                                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: await m.quoted.download(),
                                caption: m.quoted.videoMessage?.caption || "",
                                mimetype:
                                    m.quoted.videoMessage?.mimetype ||
                                    "video/mp4",
                            },
                            { quoted: mek },
                        );
                    } else if (m.quoted?.imageMessage) {
                        await conn.sendMessage(from, {
                                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: await m.quoted.download(),
                                caption: m.quoted.imageMessage?.caption || "",
                            },
                            { quoted: mek },
                        );
                    }
                } else {
                    return await reply(
                        await tr(
                            '❌ This is not a "View Once" media. Reply to a View Once Image / Video or Audio.',
                            lang,
                        ),
                    );
                }
            }
        } catch (error) {
            console.error("View Once Error:", error);
            return await reply(
                await tr(
                    "❌ Error processing the View Once media: " + error.message,
                    lang,
                ),
            );
        }
    },
);

cmd(
    {
        pattern: "getpp",
        alias: ["getdp", "pic"],
        desc: "Extract profile pic of mentioned user or number",
        category: "owner",
        use: "ppurl @user / .ppurl 2376XXXXXXX",
        react: "🖼️",
        filename: __filename,
    },
    async (conn, mek, m, { reply, args, from, isOwners }) => {
        try {
            if (!isOwners) return await reply(ownerMg);
            let targetJid;

            if (m.mentionedJid && m.mentionedJid.length > 0) {
                targetJid = m.mentionedJid[0];
            } else if (args[0]) {
                const raw = args[0].replace(/[^0-9]/g, "");
                if (raw.length < 8) return await reply(pfInvalid);
                targetJid = raw + "@s.whatsapp.net";
            } else if (mek.quoted?.sender) {
                targetJid = mek.quoted.sender;
            } else {
                return await reply(pfMention);
            }

            const url = await conn
                .profilePictureUrl(targetJid, "image")
                .catch(() => null);

            if (!url) return await reply(pfNotfound);

            const sent = await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url },
                    caption: `🖼️ *Profile picture of:* \`${targetJid.split("@")[0]}\`\n\n${config.FOOTER}`,
                },
                { quoted: mek },
            );

            await conn.sendMessage(from, {
                react: {
                    text: "🖼️",
                    key: sent.key,
                },
            });
        } catch (err) {
            console.log("PPURL Error:", err);
            await reply(pfError);
        }
    },
);

cmd(
    {
        pattern: "whois",
        alias: ["profile"],
        react: "👀",
        desc: "Get someone's full profile details",
        category: "owner",
        use: "Reply to a user's message with .whois",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, isGroup }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            if (!m.quoted) {
                return await reply("❌ Please reply to a user's message!");
            }

            let targetUser = m.quoted.sender;
            let realJid = targetUser;

            if (targetUser.endsWith("@lid")) {
                try {
                    const jid = await conn.getJidFromLid(targetUser);
                    if (jid) realJid = jid;
                } catch {}

                if (realJid === targetUser) {
                    const senderPn =
                        m.msg?.contextInfo?.senderPn ||
                        mek?.message?.[Object.keys(mek.message || {})[0]]
                            ?.contextInfo?.senderPn;
                    if (senderPn && senderPn.includes("@s.whatsapp.net")) {
                        realJid = senderPn;
                    }
                }

                if (realJid === targetUser && isGroup) {
                    try {
                        const groupMeta = await conn.groupMetadata(from);
                        const participant = groupMeta.participants.find(
                            (p) => p.id === targetUser || p.lid === targetUser,
                        );
                        if (
                            participant &&
                            (participant.pn || participant.jid)
                        ) {
                            realJid = participant.pn || participant.jid;
                        }
                    } catch {}
                }

                if (realJid === targetUser && !isGroup) {
                    if (from.includes("@s.whatsapp.net")) {
                        realJid = from;
                    }
                }
            }

            const number = realJid
                .replace(/@s\.whatsapp\.net$/, "")
                .replace(/@lid$/, "")
                .split(":")[0];
            const mentionJid = number.match(/^\d+$/)
                ? `${number}@s.whatsapp.net`
                : realJid;

            let profilePictureUrl;
            try {
                profilePictureUrl = await conn.profilePictureUrl(
                    targetUser,
                    "image",
                );
            } catch {
                try {
                    profilePictureUrl = await conn.profilePictureUrl(
                        mentionJid,
                        "image",
                    );
                } catch {
                    profilePictureUrl =
                        "https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg";
                }
            }

            let statusText = "Not Found";
            let formattedDate = "Not Available";
            try {
                let statusData = null;
                try {
                    statusData = await conn.fetchStatus(targetUser);
                } catch {}
                if (
                    (!statusData || !statusData.length) &&
                    mentionJid !== targetUser
                ) {
                    try {
                        statusData = await conn.fetchStatus(mentionJid);
                    } catch {}
                }
                if (
                    statusData &&
                    statusData.length > 0 &&
                    statusData[0].status
                ) {
                    statusText = statusData[0].status.status || "Not Found";
                    const rawSetAt = statusData[0].status.setAt;
                    if (rawSetAt) {
                        const ts =
                            rawSetAt instanceof Date
                                ? rawSetAt.getTime()
                                : typeof rawSetAt === "number"
                                  ? rawSetAt < 1e12
                                      ? rawSetAt * 1000
                                      : rawSetAt
                                  : new Date(rawSetAt).getTime();
                        formattedDate = moment(ts)
                            .tz(config.TIME_ZONE || "Africa/douala")
                            .format("dddd, MMMM Do YYYY, h:mm A z");
                    }
                }
            } catch {}

            await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: profilePictureUrl },
                    caption:
                        `*👤 User Profile Information*\n\n` +
                        `*• Name:* @${number}\n` +
                        `*• Number:* ${number}\n` +
                        `*• About:* ${statusText}\n` +
                        `*• Last Updated:* ${formattedDate}\n\n` +
                        `_${config.FOOTER}_`,
                    contextInfo: {
                        mentionedJid: [mentionJid],
                    },
                },
                { quoted: mek },
            );

            await conn.sendMessage(from, {
                react: { text: "✅", key: mek.key },
            });
        } catch (error) {
            console.error("Error in whois command:", error);
            await reply(
                `❌ An error occurred while fetching profile information.\nError: ${error.message}`,
            );
        }
    },
);

cmd(
    {
        pattern: "privacysettings",
        alias: ["privacy", "myprivacy"],
        react: "🔐",
        desc: "Shows bot's current WhatsApp privacy settings",
        category: "owner",
        use: "privacysettings",
        filename: __filename,
    },
    async (conn, mek, m, { from, isOwners, reply, botNumber2 }) => {
        try {
            if (!isOwners) return await reply(ownerMg);
            const {
                readreceipts,
                profile,
                status,
                online,
                last,
                groupadd,
                calladd,
            } = await conn.fetchPrivacySettings(true);

            const privacyText = `
Current Privacy Settings

➠ Name          : ${conn.user.name}
➠ Online        : ${online}
➠ Profile Pic   : ${profile}
➠ Last Seen     : ${last}
➠ Read Receipts : ${readreceipts}
➠ Group Add     : ${groupadd}
➠ Status        : ${status}
➠ Call Add      : ${calladd}
`;

            const avatar = await conn
                .profilePictureUrl(botNumber2, "image")
                .catch(() => "https://files.catbox.moe/y51vgu.jpg");

            await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: avatar },
                    caption: privacyText,
                },
                { quoted: mek },
            );
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "block",
        alias: ["bye"],
        react: "🚫",
        desc: "Block a user",
        category: "owner",
        use: "block <@tag | number | reply>",
        filename: __filename,
    },
    async (conn, mek, m, { args, isOwners, reply, isGroup, from }) => {
        if (!isOwners) return await reply(ownerMg);

        let userToBlock;

        if (!isGroup) {
            userToBlock = from;
        } else if (m.quoted) {
            userToBlock = m.quoted.sender;
        } else if (args[0]) {
            userToBlock = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        } else {
            return await reply("⚠️ Tag, reply or provide a number to block.");
        }

        try {
            await conn.updateBlockStatus(userToBlock, "block");
            await reply(`✅ Blocked: @${userToBlock.split("@")[0]}`, {
                mentions: [userToBlock],
            });
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "unblock",
        alias: ["unblocks"],
        react: "🛑",
        desc: "Unblock a user",
        category: "owner",
        use: "unblock <@tag | number | reply>",
        filename: __filename,
    },
    async (conn, mek, m, { args, isOwners, reply, isGroup, from }) => {
        if (!isOwners) return await reply(ownerMg);

        let userToUnblock;

        if (!isGroup) {
            userToUnblock = from;
        } else if (m.quoted) {
            userToUnblock = m.quoted.sender;
        } else if (args[0]) {
            userToUnblock = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
        } else {
            return await reply("⚠️ Tag, reply or provide a number to unblock.");
        }

        try {
            await conn.updateBlockStatus(userToUnblock, "unblock");
            await reply(`✅ Unblocked: @${userToUnblock.split("@")[0]}`, {
                mentions: [userToUnblock],
            });
        } catch (e) {
            console.error(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "rename",
        react: "⏭️",
        alias: ["r", "rn", "chang", "ussamu", "tarahawennaepa"],
        desc: "Change file name and caption",
        category: "other",
        use: "rename <filename> [caption]",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        {
            from,
            l,
            isDev,
            quoted,
            body,
            isCmd,
            command,
            args,
            q,
            isGroup,
            sender,
            senderNumber,
            botNumber2,
            botNumber,
            pushname,
            isMe,
            isOwners,
            groupMetadata,
            groupName,
            participants,
            groupAdmins,
            isBotAdmins,
            isAdmins,
            reply,
        },
    ) => {
        try {
            if (!isOwners) return await reply(ownerMg);
            if (!q || q.trim() === "") {
                return reply(
                    "*Please provide a filename*\n\nUsage: .rename <filename> [caption]\nExample: .rename movie.mp4\nExample: .rename movie.mp4 My favorite movie",
                );
            }

            let chat = m.chat;
            let filename, caption;

            const firstSpaceIndex = q.indexOf(" ");
            if (firstSpaceIndex === -1) {
                filename = q.trim();
                caption = config.FOOTER || "";
            } else {
                filename = q.substring(0, firstSpaceIndex).trim();
                const userCaption = q.substring(firstSpaceIndex + 1).trim();
                caption = userCaption
                    ? userCaption + `\n\n${config.FOOTER}`
                    : config.FOOTER || "";
            }

            // --- Document Message Path Extraction & Validation ---
            let documentMessage =
                mek?.quoted?.documentWithCaptionMessage?.message
                    ?.documentMessage ||
                mek?.quoted?.documentMessage ||
                mek?.quoted?.ephemeralMessage?.message?.documentMessage;

            if (!documentMessage) {
                return reply("*Please Reply to a Document Message..❗*");
            }

            // --- Core Logic for MIME Type Change ---
            const lastDotIndex = filename.lastIndexOf(".");
            let newMimeType = null;

            // . එකක් තිබේ නම් සහ එය අවසාන අකුර නොවේ නම් extension එක ගනියි
            if (lastDotIndex > 0 && lastDotIndex < filename.length - 1) {
                const extension = filename
                    .substring(lastDotIndex)
                    .toLowerCase();
                newMimeType = getMimeTypeFromExtension(extension);
            }

            // 1. Update the document's filename and caption
            documentMessage.fileName = filename;
            documentMessage.caption = caption;

            // 2. Update the document's MIME type if a valid one was found
            if (newMimeType) {
                documentMessage.mimetype = newMimeType;
            }
            // Note: නව MIME Type එකක් හඳුනා නොගත්තොත්, පරණ MIME Type එක එලෙසම තිබේ.

            // --- Prepare and Forward Message ---

            let message = {};
            message.key = {
                remoteJid: chat,
                fromMe: true,
                // ID එක නිවැරදිව ලබා ගැනීමට paths දෙකම පරීක්ෂා කරයි
                id: mek.quoted?.fakeObj?.key?.id || mek.quoted?.key?.id,
                participant: botNumber2,
            };

            // යාවත්කාලීන කළ documentMessage එක නැවත quoted message structure එකට ඇතුළත් කරයි
            if (mek?.quoted?.documentWithCaptionMessage) {
                mek.quoted.documentWithCaptionMessage.message.documentMessage =
                    documentMessage;
            } else if (mek?.quoted?.ephemeralMessage?.message) {
                mek.quoted.ephemeralMessage.message.documentMessage =
                    documentMessage;
            } else {
                mek.quoted.documentMessage = documentMessage;
            }

            message.message = mek.quoted;

            // Send the modified message
            await conn.forwardMessage(chat, message, false);
            await reply(
                `✅ Document successfully renamed and forwarded to ${chat}!`,
            );
        } catch (e) {
            console.error("Error in rename command:", e);
            await reply(`An error occurred: ${e.message || e}`);
        }
    },
);

cmd(
    {
        pattern: "forward",
        react: "⏭️",
        alias: ["f", "share", "sendfile"],
        desc: "Forward quoted media/message to given JID(s)",
        category: "owner",
        use: "forward <jid or jid1,jid2,...>",
        filename: __filename,
    },
    async (conn, mek, m, { from, q, isOwners, reply }) => {
        try {
            if (!isOwners) return await reply(ownerMg);
            if (!m.quoted)
                return await reply(
                    "*Please reply to a file or message to forward.* ❓",
                );

            const sendList = [];

            // Get quoted message type
            const qMsgType = m.quoted.type;
            const isImage = qMsgType === "imageMessage";
            const isVideo = qMsgType === "videoMessage";

            // Prepare target list
            let targets = [];
            if (!q) {
                targets.push(from);
            } else if (q.includes(",")) {
                targets = q.split(",").map((j) => j.trim());
            } else {
                targets.push(q.trim());
            }

            let message = {};
            message.key = {
                remoteJid: from,
                fromMe: true,
                id: mek?.quoted?.fakeObj.key,
                participant:
                    conn.user.lid.split(":")[0] + "@lid" || botNummber2,
            };

            message.message = mek.quoted;

            // Forward to each target
            for (let jid of targets) {
                if (isImage) {
                    await conn.sendMessage(jid, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: await m.quoted.download(),
                        caption: m.quoted.imageMessage?.caption || "",
                    });
                } else if (isVideo) {
                    await conn.sendMessage(jid, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: await m.quoted.download(),
                        caption: m.quoted.videoMessage?.caption || "",
                    });
                } else {
                    await conn.forwardMessage(jid, message, false);
                }
                sendList.push(jid);
            }

            // React & reply
            await conn.sendMessage(from, {
                react: { text: "✔", key: mek.key },
            });
            await reply(
                `*✅ File sent to:*\n${sendList.map((x) => `• ${x}`).join("\n")}`,
            );
        } catch (e) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: mek.key },
            });
            await reply(errorMg);
            console.error(e);
        }
    },
);

cmd(
    {
        pattern: "update",
        react: "🔁",
        desc: "To Update Bot",
        category: "owner",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isOwners, userName, repoName }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const data = await fetchJson(
                `https://raw.githubusercontent.com/${userName}/${repoName}/refs/heads/main/BOT-DATA/data.json`,
            );
            if (
                !dbData.AUTO_UPDATE &&
                dbData.VERSION === data?.releaseVersion
            ) {
                reply(latestHave);
                return;
            }

            const msg = await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: "🧹 Cleaning old files..." },
                { quoted: mek },
            );

            // Helper to remove folders or files from root
            const rootPath = path.resolve(__dirname, ".."); // go one level up from plugins/

            const removeDir = async (relative, label) => {
                const fullPath = path.join(rootPath, relative);
                if (fs.existsSync(fullPath)) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `✅ ${label} removed.`,
                        edit: msg.key,
                    });
                } else {
                    await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `⚠️ ${label} not found.`,
                        edit: msg.key,
                    });
                }
            };

            const removeFile = async (relative, label) => {
                const fullPath = path.join(rootPath, relative);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `✅ ${label} removed.`,
                        edit: msg.key,
                    });
                } else {
                    await conn.sendMessage(from, {
                        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `⚠️ ${label} not found.`,
                        edit: msg.key,
                    });
                }
            };

            // Remove folders and file
            await removeDir("lib", "Lib folder");
            await sleep(1000);

            await removeDir("plugins", "Plugins folder");
            await sleep(1000);

            await removeFile("index.js", "index.js file");
            await sleep(1000);

            // 🔄 Restart
            await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: restartMg, edit: msg.key });
            await sleep(1000);

            platformAwareRestart();
        } catch (error) {
            console.error("❌ Update failed:", error);
            await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: "❌ Update Failed! Check Logs." },
                { quoted: mek },
            );
        }
    },
);

cmd(
    {
        pattern: "movie_setup",
        react: "🧩",
        alias: ["movieset", "moviealive", "exmovie"],
        desc: "Show Movie details variable keys.",
        category: "owner",
        use: "movie_setup",
        filename: __filename,
    },
    async (conn, mek, m, { from, prefix, pushname, reply, isOwners }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const keysList = [
                "`${movieTitle}` - Movie title",
                "`${movieReleasedate}` - Release date",
                "`${movieCountry}` - Country",
                "`${movieRuntime}` - Runtime",
                "`${movieCategories}` - Categories",
                "`${movieImdbRate}` - IMDb rating",
                "`${movieDirector}` - Director",
                "`${movieCast}` - Main cast",
            ];

            const msgText =
                `Movie Details Keys Guide

You can use the following variables in your MOVIE_DETAILS_CARD:

` +
                keysList.map((k) => "➠ " + k).join("\n") +
                `

Example:
➠ Title       : ${movieTitle}
➠ Released    : ${movieReleasedate}
➠ Country     : ${movieCountry}
➠ Duration    : ${movieRuntime}
➠ Genre       : ${movieCategories}
➠ IMDb Rating : ${movieImdbRate}
➠ Directed By : ${movieDirector}
➠ Cast        : ${movieCast}

➠ After setting the message, use ${prefix}apply to apply changes.
`;

            const sentMsg = await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: msgText,
                },
                { quoted: mek },
            );
        } catch (e) {
            console.log(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "episode_setup",
        react: "🧩",
        alias: ["episodeset", "epset", "ep_setup"],
        desc: "Show Episode details variable keys.",
        category: "owner",
        use: "episode_setup",
        filename: __filename,
    },
    async (conn, mek, m, { from, prefix, pushname, reply, isOwners }) => {
        try {
            if (!isOwners) return await reply(ownerMg);

            const keysList = [
                "`${epTitle}` -  Episode Title",
                "`${epOriginalTitle}` - Episode Original Title",
                "`${epReleasedate}` - Episode Release Date",
                "`${epUrl}` - Episode Url",
            ];

            const msgText =
                `Episode Details Keys Guide

You can use the following variables in your EPISODE_DETAILS_CARD:

` +
                keysList.map((k) => "➠ " + k).join("\n") +
                `

Example:

➠ ${epOriginalTitle}
➠ Episode Title : ${epTitle}
➠ Release Date  : ${epReleasedate}
➠ Watch Now     : ${epUrl}

➠ After setting the message, use ${prefix}apply to apply changes.
`;
            const sentMsg = await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: msgText,
                },
                { quoted: mek },
            );
        } catch (e) {
            console.log(e);
            await reply(errorMg);
        }
    },
);

cmd(
    {
        pattern: "allgroup",
        alias: ["allgroups", "mygroups", "listgroup", "grouplist"],
        desc: "List all groups the bot is in",
        category: "owner",
        use: ".allgroup",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners }) => {
        try {
            if (!isOwners)
                return reply("❌ Only bot owner can use this command.");

            const myGroups = await getMyGroupDetails(conn);

            if (myGroups.length === 0)
                return reply("🤖 I'm not in any groups.");

            let groupList = `📄 *Bot is in ${myGroups.length} groups:*\n\n`;

            myGroups.forEach((g, i) => {
                groupList += `${i + 1}. *${g.name}*\n📍 ${g.jid}\n\n`;
            });

            return reply(groupList.trim());
        } catch (e) {
            console.error(e);
            reply("❌ Error occurred while fetching group list.");
        }
    },
);

cmd(
    {
        pattern: "setname",
        desc: "Change bot name",
        category: "owner",
        react: "🦹‍♀️",
        use: ".setname NewName",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, q }) => {
        try {
            if (!isOwners) return reply(ownerMg);
            if (!q)
                return reply(
                    "❗ Please provide a name.\nExample: .setname PRINCE-MDX",
                );

            await conn.updateProfileName(q);
            reply(`✅ Bot name updated to: *${q}*`);
        } catch (e) {
            console.error(e);
            await reply(errorMg, "❌");
        }
    },
);

cmd(
    {
        pattern: "setabout",
        desc: "Change bot about",
        category: "owner",
        react: "💫",
        use: ".setabout NewAbout",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners, q }) => {
        try {
            if (!isOwners) return reply(ownetMg);
            if (!q)
                return reply(
                    "❗ Please provide about text.\nExample: .setabout Powerd By Dark",
                );

            await conn.updateProfileStatus(q);
            reply("✅ Bot about updated successfully!");
        } catch (e) {
            console.error(e);
            await reply(errorMg, "❌");
        }
    },
);

cmd(
    {
        pattern: "setpp",
        alias: ["pp", "botpp"],
        desc: "Change bot profile picture",
        react: "🔮",
        category: "owner",
        use: ".setpp (reply to image)",
        filename: __filename,
    },
    async (conn, mek, m, { reply, isOwners }) => {
        try {
            if (!isOwners) return reply(ownerMg);
            if (!m.quoted || m.quoted.type !== "imageMessage")
                return reply("*Please reply to an image!*");

            let img = await m.quoted.download();
            await conn.updateProfilePicture(conn.user.id, img);

            await reply(await tr("✅ Bot profile picture updated!", lang));
        } catch (e) {
            console.error(e);
            await reply(errorMg, "❌");
        }
    },
);

cmd(
    {
        pattern: "gcpp",
        alias: ["setgcpp", "gcfullpp", "fullgcpp", "grouppp"],
        desc: "Set group profile picture (full image, no crop)",
        react: "🔮",
        category: "group",
        use: ".gcpp (reply to image)",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
        try {
            if (!isGroup)
                return reply("*This command can only be used in groups!*");
            if (!isAdmins) return reply("*Admin only command!*");
            if (!isBotAdmins)
                return reply(
                    "*I need to be an admin to update the group picture!*",
                );
            if (!m.quoted || m.quoted.type !== "imageMessage")
                return reply("*Please reply to an image!*");

            const buffer = await m.quoted.download();
            const sharp = require("sharp");

            const resized = await sharp(buffer)
                .resize(720, 720, {
                    fit: "contain",
                    background: { r: 0, g: 0, b: 0, alpha: 1 },
                })
                .jpeg()
                .toBuffer();

            await conn.updateProfilePicture(from, resized);
            await reply("✅ Group profile picture updated successfully!");
        } catch (e) {
            console.error("Error updating group profile picture:", e);
            if (
                e.message?.includes("not-authorized") ||
                e.message?.includes("forbidden")
            ) {
                await reply(
                    "*I need to be an admin to update the group picture!*",
                );
            } else {
                await reply(
                    `❌ Failed to update group profile picture: ${e.message}`,
                );
            }
        }
    },
);

cmd(
    {
        pattern: "getgcpp",
        alias: ["gcpic", "grouppic", "groupicon"],
        desc: "Get the group's profile picture",
        react: "📸",
        category: "group",
        use: ".getgcpp",
        filename: __filename,
    },
    async (conn, mek, m, { from, reply, isGroup, pushname }) => {
        try {
            if (!isGroup)
                return reply("*This command can only be used in groups!*");

            let ppUrl;
            try {
                ppUrl = await conn.profilePictureUrl(from, "image");
            } catch {
                return reply("*This group has no profile picture!*");
            }

            const metadata = await conn.groupMetadata(from).catch(() => null);
            const groupName = metadata?.subject || "Unknown Group";

            await conn.sendMessage(from, {
                    contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: ppUrl },
                    caption: `📸 *${groupName}*\n\n_Group profile picture_`,
                },
                { quoted: mek },
            );
        } catch (e) {
            console.error("Error getting group profile picture:", e);
            await reply(`❌ ${e.message}`);
        }
    },
);

cmd(
    {
        pattern: "setautoreply",
        react: "💾",
        alias: ["setreply", "addreply"],
        desc: "Set an auto-reply trigger and its response.",
        category: "owner",
        use: "setautoreply <trigger>➕<response>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            let [trigger, response] = q.split("➕");

            if (!trigger || !response) {
                return reply(
                    "⚠ *Usage:* `setautoreply <trigger>➕<response>`",
                );
            }

            trigger = trigger.trim().toUpperCase();
            response = response.trim();

            await auto_rep.saveAutoReply(trigger, response);
            await reply(
                `✅ *Auto-reply saved!*\n\n📌 *Trigger:* ${trigger}\n💬 *Response:* ${response}`,
            );
            await m.react("💾");
        } catch (error) {
            console.error("❌ Error in setautoreply:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

cmd(
    {
        pattern: "delautoreply",
        react: "🚮",
        alias: ["delreply", "delreply"],
        desc: "Delete a specific auto-reply by its trigger.",
        category: "owner",
        use: "delautoreply <trigger>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            if (!q) {
                return reply("⚠ *Usage:* `delautoreply <trigger>`");
            }

            var trigger = q.trim().toUpperCase();
            const deleted = await auto_rep.deleteAutoReply(trigger);

            if (deleted) {
                await reply(
                    `✅ *Auto-reply Deleted!*\n\n📌 *Trigger:* ${trigger}`,
                );
                await m.react("✅");
            } else {
                await reply(`❌ *No auto-reply found for trigger:* ${trigger}`);
                await m.react("❌");
            }
        } catch (error) {
            console.error("❌ Error in delautoreply:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

cmd(
    {
        pattern: "delallautoreply",
        react: "🗑",
        alias: ["delallreply", "delallreply"],
        desc: "Delete all auto-replies.",
        category: "owner",
        use: "delallautoreply",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            // We need to add this method to GitHubDB
            await auto_rep.deleteAllAutoReplies();
            await reply("✅ All auto-replies deleted!");
            await m.react("🗑");
        } catch (error) {
            console.error("❌ Error in delallautoreply:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

cmd(
    {
        pattern: "getallreplies",
        react: "📜",
        alias: ["listautoreplies", "showautoreplies"],
        desc: "Get all stored auto-replies.",
        category: "owner",
        use: "getallreplies",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            const autoReplies = await auto_rep.getAllReplies();

            if (autoReplies && Object.keys(autoReplies).length > 0) {
                let msg = `📜 *${toSmallCaps("List of All Auto-Replies")}:*\n\n`;

                Object.entries(autoReplies).forEach(([trigger, data]) => {
                    msg += `📌 *${toSmallCaps("Trigger")}:* ${trigger}\n💬 *${toSmallCaps("Response")}:* ${data.response}\n\n`;
                });

                await reply(msg);
                await m.react("📜");
            } else {
                await reply("❌ No auto-replies found.");
                await m.react("❌");
            }
        } catch (error) {
            console.error("❌ Error in getallreplies:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

// Command to update an existing auto-reply
cmd(
    {
        pattern: "updateautoreply",
        react: "🔄",
        alias: ["editreply", "editautoreply"],
        desc: "Update an existing auto-reply.",
        category: "owner",
        use: "updateautoreply <trigger>➕<new_response>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            let [trigger, newResponse] = q.split("➕");

            if (!trigger || !newResponse) {
                return reply(
                    "⚠ *Usage:* `updateautoreply <trigger>➕<new_response>`",
                );
            }

            trigger = trigger.trim().toUpperCase();
            newResponse = newResponse.trim();

            const updated = await auto_rep.updateAutoReply(
                trigger,
                newResponse,
            );
            if (updated) {
                await reply(
                    `✅ *Auto-reply updated!*\n\n📌 *Trigger:* ${trigger}\n💬 *New Response:* ${newResponse}`,
                );
                await m.react("🔄");
            } else {
                await reply(`❌ *No auto-reply found for trigger:* ${trigger}`);
                await m.react("❌");
            }
        } catch (error) {
            console.error("❌ Error in updateautoreply:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

// Command to check if a specific trigger exists
cmd(
    {
        pattern: "checkautoreply",
        react: "🔍",
        alias: ["checkreply", "findreply"],
        desc: "Check if a specific auto-reply trigger exists.",
        category: "owner",
        use: "checkautoreply <trigger>",
        filename: __filename,
    },
    async (
        conn,
        mek,
        m,
        { from, args, reply, prefix, q, senderNumber, isOwners, client },
    ) => {
        if (!isOwners) return reply(ownerMg);

        try {
            if (!q) {
                return reply("⚠ *Usage:* `checkautoreply <trigger>`");
            }

            const trigger = q.trim().toUpperCase();
            const replyData = await auto_rep.findReply(trigger);

            if (replyData) {
                await reply(
                    `✅ *Auto-reply found!*\n\n📌 *Trigger:* ${trigger}\n💬 *Response:* ${replyData.response}\n📅 *Created/Updated:* ${replyData.timestamp}`,
                );
                await m.react("✅");
            } else {
                await reply(`❌ *No auto-reply found for trigger:* ${trigger}`);
                await m.react("❌");
            }
        } catch (error) {
            console.error("❌ Error in checkautoreply:", error);
            await reply(`❌ Error: ${error.message}`);
        }
    },
);

// ============================================= BODY ============================================= //

// Delete message command (owner only)
cmd(
    {
        pattern: "delete",
        alias: ["del"],
        desc: "Delete a message (reply to the message)",
        category: "owner",
        use: ".del (reply to message)",
        react: "🗑️",
        filename: __filename,
    },
    async (conn, mek, m, { from, quoted, reply, isOwners }) => {
        try {
            if (!isOwners) return reply(ownerMg);
            if (!quoted) return reply("*Reply to a message to delete it.*");

            const key = {
                remoteJid: from,
                fromMe: quoted.fromMe,
                id: quoted.id,
                participant: quoted.sender,
            };

            await conn.sendMessage(from, { delete: key });
        } catch (e) {
            console.log("Delete error:", e.message);
            reply("*Failed to delete message.*");
        }
    },
);

// Update the auto-reply handler to use GitHubDB
cmd(
    {
        on: "body",
    },
    async (conn, mek, m, { from, isOwners, client }) => {
        try {
            if (mek.key && config.AUTO_REPLY === "true" && !isOwners) {
                // Use GitHubDB's handleAutoReply method
                await auto_rep.handleAutoReply(conn, mek, isOwners);
            }
        } catch (e) {
            console.log("❌ Error in auto reply handler:", e.message);
        }
    },
);
