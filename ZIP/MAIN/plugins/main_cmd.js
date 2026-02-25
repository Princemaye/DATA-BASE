// ============================= R E Q U E S T =============================
const config = require('../config');
const os = require('os');
const fetch = require("node-fetch");
const { cmd, commands } = require('../command');
const {getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson, getDateAndTime, tr, formatMessage, getContextInfo} = require('../lib/functions');
const si = require('systeminformation');
const emojiRegex = require('emoji-regex');
const { storenumrepdata } = require('../lib/numreply-db');


const DBM = require("../lib/database");
const dbData = require("../lib/config");
const ymd_db = new DBM();
const botName = config.BOT_NAME && config.BOT_NAME !== "default" ? config.BOT_NAME : null;

// ============================= C U S T O M   F O N T S =============================
const { toSmallCaps, toBold } = require('../lib/fonts');

// ============================= L A N G U A G E =============================
var allLangs = require("../lib/language.json");
var LANG = config.LANG === 'EN' ? 'EN' 
         : config.LANG === 'FR' ? 'FR' 
         : 'EN';

var lang = allLangs[LANG];
var { errorMg, ownerMg, needCmd, needNumber, pairCodeMis, pairExpireAlert, pairExpireMg, owner, ownerNb, platform, timeLang, dateLang, catLang, upLang, ramLang, versionLang, cpuLang, engiLang, noResultsFound, providechannellink, invalidchannellink, faildtofectchanneljid } = lang;

    lang = "en";
if(config.LANG === "FR"){
   lang = "fr";
}
// ============================= C M D =============================
cmd({
    pattern: "alive",
    alias: ["bot", "online"],
    react: "⚡",
    desc: "Check if the bot is online and running",
    category: "main",
    filename: __filename
  }, async (conn, mek, m, { from, pushname, reply, sender, senderNumber, prefix, isGroup, q }) => {
    try {
      const dateAndTime = await getDateAndTime(config.TIME_ZONE || "Asia/Colombo");
      const hour = new Date().getHours();
      let greeting = "Good night";
      if (hour >= 5 && hour < 12) greeting = "Good morning";
      else if (hour >= 12 && hour < 17) greeting = "Good afternoon";
      else if (hour >= 17 && hour < 21) greeting = "Good evening";

      const runtimes = (s) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
        return `${h}h ${m}m ${sec}s`;
      };

      let resolvedJid = (m.key.participantPn || sender || '').replace(/:.*@/, '@');

      if (resolvedJid.endsWith('@lid') && isGroup) {
          try {
              const groupMeta = await conn.groupMetadata(from);
              const participant = groupMeta.participants.find(p => p.id === resolvedJid || p.lid === resolvedJid);
              if (participant && (participant.pn || participant.jid)) {
                  resolvedJid = participant.pn || participant.jid;
              }
          } catch {}
      }

      if (resolvedJid.endsWith('@lid') && !isGroup) {
          if (from.includes('@s.whatsapp.net')) {
              resolvedJid = from;
          }
      }

      const senderNum = resolvedJid.split('@')[0].split(':')[0];
      const mentionJid = senderNum.match(/^\d+$/) ? `${senderNum}@s.whatsapp.net` : resolvedJid;

      const memUsage = `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${Math.round(os.totalmem() / 1024 / 1024)}MB`;
      const date = dateAndTime.date || '';
      const time = dateAndTime.time || '';
      const runtime = runtimes(process.uptime());
      const user = isGroup ? `@${senderNum}` : pushname;
      const version = dbData.VERSION || require("../package.json").version;
      const ownerNumber = config.OWNER_NUMBER;
      const ownerName = config.OWNER_NAME;
      const hostname = dbData.HOST_NAME;
      const totalCmds = commands.length || 0;

      let aliveText = (config.ALIVE_MESSAGE !== 'default')
              ? formatMessage(config.ALIVE_MESSAGE,{ user, date, time, version, memUsage, hostname, runtime, prefix, ownerName, ownerNumber }) :
  `*${greeting}, ${user}!* 🌟\n\n` +
  `╭━━━━━━━━━━━━━━━━╮\n` +
  `┃  ⚡ *${botName || 'Prince MDX'}*\n` +
  `┃  _I'm alive and running smooth!_\n` +
  `╰━━━━━━━━━━━━━━━━╯\n\n` +
  `┌─❒ *ʙᴏᴛ sᴛᴀᴛᴜs*\n` +
  `│ *${dateLang}:* ${date}\n` +
  `│ *${timeLang}:* ${time}\n` +
  `│ *${upLang}:* ${runtime}\n` +
  `│ *${ramLang}:* ${memUsage}\n` +
  `│ *${platform}:* ${hostname}\n` +
  `│ *${versionLang}:* ${version}\n` +
  `│ *Commands:* ${totalCmds}\n` +
  `│ *Owner:* ${ownerName}\n` +
  `│ *Prefix:* [ ${prefix} ]\n` +
  `└─────────────❒`;

      await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO }, caption: aliveText + `\n\n> ${config.FOOTER}` },
          { quoted: mek, mentions: [mentionJid] },
      );

    } catch (err) {
      console.error(err);
      await conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: 'An error occurred, please try again later ❌' },{ quoted: mek });
    }
  });

cmd({
    pattern: "alive_setup",
    react: "🧩",
    alias: ["aliveset", "setalive", "exalive"],
    desc: "Show Alive message variable keys.",
    category: "main",
    use: "alive_setup",
    filename: __filename
},
async (conn, mek, m, { from, prefix, pushname, reply, isOwners }) => {
    try {

        if (!isOwners) return await reply(ownerMg);

        const keysList = [
            "*${userTag}* - Sender name or @tag",
            "*${date}* - Current date",
            "*${time}* - Current time",
            "*${version}* - Bot version",
            "*${memUsage}* - Memory usage",
            "*${hostname}* - Server hostname",
            "*${runtime}* - Bot uptime",
            "*${prefix}* - Current command prefix",
            "*${ownerName}* - Owner name",
            "*${ownerNumber}* - Owner contact"
        ];

        const msgText = `🛠️ *Alive Message Keys Guide*\n\n` +
            `You can use the following variables in your *ALIVE_MESSAGE*:\n\n` +
            keysList.map(k => "🔹 " + k).join("\n") +
            `\n\n📌 After setting the message, use *${prefix}apply* to apply changes.\n` +
            "\n💡 *Example:* \nHello ${userTag}, I'm alive at ${time} on ${date}!\n";

        const sentMsg = await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: msgText,
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '🧩', key: sentMsg.key } });

    } catch (e) {
        console.log(e);
        await reply(errorMg);
    }
});

cmd({
    pattern: "channelid",
    use: ".channelid <channel-link>",
    desc: "Get WhatsApp channel JID",
    category: "main",
    filename: __filename,
},
async (conn, mek, m, { from, q, reply }) => {
try {
    if (!q) return reply(providechannellink)

    // Extract channel ID safely
    const channelId = q.split("/").pop()
    if (!channelId) return reply(invalidchannellink)

    const res = await conn.newsletterMetadata("invite", channelId)
    if (!res?.id) return reply(faildtofectchanneljid)

    await reply(res.id)

} catch (e) {
     console.error("❌ Error fetching system info:", e);
            await reply(errorMg);
}
})


cmd({
    pattern: "repo",
    react: "🍬",
    alias: ["sc", "script", "bot_sc"],
    desc: "Check bot repo.",
    category: "main",
    use: "repo",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {

        // Extract owner & repo name from URL
        const repoUrl = dbData.REPO.replace("https://github.com/", "").replace(/\/$/, "");
        const [owner, repo] = repoUrl.split("/");

        // Fetch repo data from GitHub API
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`);
        const data = await res.json();

        if (!data || data.message) {
            return reply("❌ Failed to fetch repository information.");
        }

        const captionText = `
╭───「 Repository Info 」──
┃➠ Name        : ${data.name}
┃➠ Owner       : ${data.owner.login}
┃➠ Stars       : ⭐ ${data.stargazers_count}
┃➠ Forks       : 🍴 ${data.forks_count}
┃➠ Watchers    : 👁️ ${data.watchers_count}
┃➠ Issues      : 🧩 ${data.open_issues_count}
┃➠ Version     : ${dbData.VERSION}
┃➠ Framework   : Baileys Multi-Device
┃➠ Developer   : ᴘʀɪɴᴄᴇ ᴛᴇᴄʜ
┃➠ GitHub      : ${dbData.REPO}
┃➠ Website     : ${dbData.OFFICIAL_SITE}
┃➠ Support     : https://chat.whatsapp.com/${dbData.SUPPORT_GROUP}
┃➠ Channel     : ${dbData.OFFICIAL_CHANNEL}
╰─────────────────────

⭐ Star the repository to support development!
`;

        const sentMsg = await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO },
            caption: captionText
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "🧩", key: sentMsg.key }
        });

    } catch (e) {
        console.log(e);
        await reply(errorMg);
    }
});

cmd({
        pattern: "ping",
        react: "📟",
        alias: ["speed"],
        desc: "Check bot\'s ping",
        category: "main",
        use: 'ping',
        filename: __filename
    },
    async (conn, mek, m, {
        from,
        reply
    }) => {
        try {
            const startTime = process.hrtime();
            await new Promise(resolve => setTimeout(resolve, Math.floor(80 + Math.random() * 420)));
            const elapsed = process.hrtime(startTime);
            const responseTime = Math.floor((elapsed[0] * 1000) + (elapsed[1] / 1000000));

            await conn.sendMessage(from, {
                text: `⚡ Pong: ${responseTime}ms`,
                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null)
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e) {
            await reply(errorMg)
            console.log(e)
        }
    })


    cmd({ 
        pattern: "system",
        react: "🖥️",
        alias: ["s_info"],
        desc: "To Check bot's System information",
        category: "main",
        use: 'system',
        filename: __filename
    },
    async (conn, mek, m, { from, reply }) => {
        try {
            const ccp = await si.cpu();
            const cinfo = await si.version();
            const plat = dbData.HOST_NAME;
            const dateAndTime = await getDateAndTime(config.TIME_ZONE || "Asia/Colombo");
            const date = dateAndTime.date || '';
            const time = dateAndTime.time || '';
            
            const infomsg = `
╭━━ ${botName || "PRINCE-MDX"} SYSTEM ━━╮
┃➠ ${platform}      : ${plat}
┃➠ ${upLang}        : ${runtime(process.uptime())}
┃➠ ${ramLang}     : ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)}MB / ${Math.round(require('os').totalmem() / 1024 / 1024)}MB
┃➠ ${versionLang}       : ${dbData.VERSION}
┃➠ ${cpuLang}     : ${ccp.speed} GHz
┃➠ ${engiLang}        : ${cinfo}
┃➠ ${dateLang}          : ${date}
┃➠ ${timeLang}          : ${time}

╭────────────────
┃➠ ʙᴏᴛ ʀᴜɴɴɪɴɢ ꜱᴍᴏᴏᴛʜʟʏ!
╰────────────────
`;
    
            const imageUrl = "https://files.catbox.moe/y51vgu.jpg";
    
            await conn.sendMessage(from, {
                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: imageUrl },
                caption: infomsg
            }, { quoted: mek });
    
        } catch (e) {
            console.error("❌ Error fetching system info:", e);
            await reply(errorMg);
        }
    });

cmd({
    pattern: "menu",
    alias: ["panel", "cmds", "lits", "cmd"],
    react: "📑",
    desc: "Show all available commands in a categorized menu",
    category: "main",
    use: "menu",
    filename: __filename
}, async (conn, mek, m, { from, reply, prefix }) => {
    try {

        const menuSections = [
            { id: "1", name: "📥Download", category: "download", logo: "" },
            { id: "2", name: "🔎Search", category: "search", logo: "" },
            { id: "3", name: "👑Owner", category: "owner", logo: "" },
            { id: "4", name: "👥Group", category: "group", logo: "" },
            { id: "5", name: "🔁Convert", category: "convert", logo: "" },
            { id: "6", name: "🏠Main", category: "main", logo: "" },
            { id: "7", name: "🤖AI", category: "ai", logo: "" },
            { id: "8", name: "🎮Games", category: "games", logo: "" },
            { id: "9", name: "🎉Fun", category: "fun", logo: "" },
            { id: "10", name: "🎨Logo", category: "logo", logo: "" },
            { id: "11", name: "🎌Anime", category: "anime", logo: "" },
            { id: "12", name: "⚽Sports", category: "sports", logo: "" },
            { id: "13", name: "📦Other", category: "other", logo: "" }
        ];

        const dateAndTime = await getDateAndTime(config.TIME_ZONE || "Asia/Colombo");
        const date = dateAndTime.date || "";
        const time = dateAndTime.time || "";
        const hostname = dbData.HOST_NAME;

        const botTitle = toBold(botName || "PRINCE-MDX");
        
        let menuText = `
╭───❖ ${botTitle} ❖───╮
│ ${toSmallCaps("Owner")}   : ${config.OWNER_NAME}
│ ${toSmallCaps("Host")}    : ${hostname}
│ ${toSmallCaps("Uptime")}  : ${runtime(process.uptime())}
│ ${toSmallCaps("Prefix")}  : ${config.PREFIX}
│ ${toSmallCaps("Time")}    : ${time}
│ ${toSmallCaps("Date")}    : ${date}
│ ${toSmallCaps("Categories")} : ${menuSections.length}
╰──────────────────╯
🟢 ${toBold("Deploy here")}👇
> host.princetechn.com

📂 ${toBold("Command Categories")}

`;

            menuSections.forEach(section => {
                menuText += `• ${section.id}  *${section.name}*\n`;
            });

            menuText += `
────────────────
${config.FOOTER}
`;

            const sentMsg = await conn.sendMessage(from, {
                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: config.LOGO },
                caption: menuText
            }, { quoted: mek });

            await conn.sendMessage(from, {
                react: { text: "✨", key: sentMsg.key }
            });

            const numrep = menuSections.map(section =>
                `${prefix}menu_list ${section.category} ${section.logo || config.LOGO}=${section.name}`
            );

            const jsonmsg = {
                key: sentMsg.key,
                numrep,
                method: "nondecimal"
            };

            await storenumrepdata(jsonmsg);

    } catch (e) {
        console.error(e);
        await reply(errorMg);
    }
});





cmd({
    pattern: "menu_list",
    dontAddCommandList: true,
    filename: __filename
}, async (conn, mek, m, { from, quoted, q, prefix, reply }) => {
    try {
        let cat = q?.split(" ")[0];
        let logo = q?.split(" ")[1].split("=")[0] || config.LOGO;
        let name = q?.includes("=") ? q.split("=")[1] : cat;

        function extractEmojis(text) {
            const regex = emojiRegex();
            return [...text.matchAll(regex)].map(match => match[0]);
        }

        const emojisOnly = extractEmojis(name || "");
        const emoji = emojisOnly[0] || "📄";

        await conn.sendMessage(from, {
            react: { text: emoji, key: mek.key }
        });

        // ---- GET COMMANDS FROM CATEGORY (NO DESC, CLEAN LIST) ----
        const getCategoryList = (category) => {
            let list = "";
            let total = 0;

            for (let cmd of commands) {
                if (cmd.category === category && !cmd.dontAddCommandList) {
                    list += `┃➠ ${toSmallCaps(cmd.pattern)}\n`;
                    total++;
                }
            }

            return { list: list || "", total };
        };

        const result = getCategoryList(cat);

        // ------------------ NEW DESIGN ----------------------
        let responseMsg = `╔═〘 ${toBold(name.toUpperCase())} 〙═╗\n`;
        responseMsg += `┃➠ ${toSmallCaps("Category")}       : ${cat}\n`;
        responseMsg += `┃➠ ${toSmallCaps("Total Commands")} : ${result.total}\n`;
        responseMsg += `╚═══════════════════╝\n\n`;

        if (result.total > 0) {
            responseMsg += `╭━━━━❮ ${toBold(cat.toUpperCase())} ❯━⊷\n`;
            responseMsg += result.list;
            responseMsg += `╰━━━━━━━━━━━━━━━━━⊷\n`;
        } else {
            responseMsg += `⚠️ No commands found under *${cat}* category!\n`;
        }

        responseMsg += `\n${config.FOOTER}`;

        await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: logo },
            caption: responseMsg
        }, { quoted: mek });

    } catch (e) {
        console.error(e);
        reply(errorMg);
    }
});






cmd({
    pattern: "pair",
    alias: ["paircode"],
    react: "🔗",
    desc: "Generate pair code for a given number",
    category: "main",
    use: ".pair <number>",
    filename: __filename
},
async (conn, mek, m, { reply, q, from, isOwner }) => {
    try { 
        
        if (!q) return await reply(needNumber);

        const num = q.replace(/[^0-9]/g, '').trim();
        const res = await fetch(`${dbData.PAIR_API}${num}`);
        const getPair = await res.json();

        if (res.status === 429 || getPair?.error === 'Try again after 5 minutes.') {
            return reply(await tr("⏳ Try again after 5 minutes."));
        }
        const pairCode = getPair?.code;
        if (!pairCode) return await reply(pairCodeMis);

        const msg = await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `🔗 *Pair Code Generated!*\n\n📞 Number: ${num}\n🧾 Code: ${pairCode}\n\n⌛ ${pairExpireAlert}`
        }, { quoted: mek });

        const msg2 = await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `${pairCode}`
        }, { quoted: msg });

        setTimeout(async () => {
            await conn.sendMessage(from, {
                contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), text: `⛔ *Expired!*\n\n📞 Number: ${num}\n💤 ${pairExpireMg}`,
                edit: msg.key
            });
            await conn.sendMessage(from, {
                delete: msg2.key
            });
        }, 1000 * 60);   

    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log(e);
        await reply(errorMg);
    }
});

cmd({
    pattern: "owner",
    react: "🤵",
    alias: ["creator"],
    desc: "Get the bot owner's contact details.",
    category: "main",
    use: "owner",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        const contact = {
            displayName: "PRINCE TECH",
            vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${config.OWNER_NAME || "PRINCE TECH"}\nTEL;waid=${config.OWNER_NUMBER || "237682698517"}:+${config.OWNER_NUMBER || "237682698517"}\nEND:VCARD`
        };

        return await conn.sendMessage(from, {
            contacts: { displayName: contact.displayName, contacts: [contact] }
        }, { quoted: mek });

} catch (e) {
await conn.sendMessage(from, { react: { text: '❌', key: mek.key } })
console.log(e)
await reply(errorMg)
}
})

cmd({
    pattern: "help",
    alias: ["menuu"],
    react: "👨‍💻",
    desc: "Show this help menu",
    category: "menu",
    use: "help or .help <command>",
    filename: __filename,
}, 
async (conn, mek, m, { reply, q, prefix, lang }) => {
    try {
        if (!q) return reply(needCmd);

        let name = q.toLowerCase();
        let command = commands.find(cmd =>
            cmd.pattern === name || (cmd.alias && cmd.alias.includes(name))
        );

        if (!command) return reply("❌ Command not found.");

        let helpText = `➠ ${await tr("Command", lang)} : ${prefix}${command.pattern}\n`;
        helpText += `➠ ${await tr("Description", lang)} : ${await tr(command.desc || 'No description', lang)}\n`;
        helpText += `➠ ${await tr("Category", lang)} : ${command.category}\n`;
        helpText += `➠ ${await tr("Usage", lang)} : ${prefix}${command.use || 'Not specified'}\n`;
        helpText += `➠ ${await tr("File", lang)} : ${command.filename}`;

        return reply(helpText);
        
    } catch (e) {
        console.error(e);
        reply(errorMg);
    }
});


cmd({
    pattern: "jid",
    desc: "Get chat or user JID",
    category: "main",
    use: 'jid [reply to user]',
    filename: __filename
},
async(conn, mek, m, { from, sender, reply, isGroup }) => {
try {
    let targetJid;
    let label;
    
    if (m.quoted && m.quoted.sender) {
        const quotedParticipant = m.quoted.sender;
        if (isGroup) {
            const groupMeta = await conn.groupMetadata(from).catch(() => null);
            const participant = groupMeta?.participants?.find(p => 
                p.id === quotedParticipant || p.lid === quotedParticipant || p.jid === quotedParticipant
            );
            targetJid = participant?.jid || participant?.pn || quotedParticipant;
            label = "Quoted User JID";
        } else {
            targetJid = quotedParticipant;
            label = "User JID";
        }
    } else if (isGroup) {
        targetJid = from;
        label = "Group JID";
    } else {
        targetJid = from;
        label = "Chat JID";
    }
    
    if (!targetJid || !targetJid.includes("@")) {
        return await reply("❌ Could not retrieve JID");
    }
    
    await reply(`📋 *${label}:*\n\`\`\`${targetJid}\`\`\``);
    
} catch (e) {
    await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    console.log(e);
    reply(errorMg);
}
})

cmd({
    pattern: "lid",
    desc: "Get user LID (Linked ID)",
    category: "main",
    use: 'lid [reply to user]',
    filename: __filename
},
async(conn, mek, m, { from, sender, reply, isGroup }) => {
try {
    let targetLid;
    let label;
    
    if (m.quoted && m.quoted.sender) {
        const quotedParticipant = m.quoted.sender;
        if (isGroup) {
            const groupMeta = await conn.groupMetadata(from).catch(() => null);
            const participant = groupMeta?.participants?.find(p => 
                p.id === quotedParticipant || p.lid === quotedParticipant || p.jid === quotedParticipant
            );
            targetLid = participant?.lid || participant?.id || quotedParticipant;
            label = "Quoted User LID";
        } else {
            targetLid = quotedParticipant;
            label = "User LID";
        }
    } else if (isGroup) {
        const groupMeta = await conn.groupMetadata(from).catch(() => null);
        const myParticipant = groupMeta?.participants?.find(p => 
            p.jid === sender || p.id === sender || p.lid === sender
        );
        targetLid = myParticipant?.lid || myParticipant?.id || sender;
        label = "Your LID";
    } else {
        targetLid = sender;
        label = "Your ID";
    }
    
    if (!targetLid || !targetLid.includes("@")) {
        return await reply("❌ Could not retrieve LID. Try replying to a user's message.");
    }
    
    const isLidFormat = targetLid.endsWith("@lid");
    await reply(`📋 *${label}:*\n\`\`\`${targetLid}\`\`\`\n${isLidFormat ? "✅ LID format" : "ℹ️ JID format (LID not available)"}`);
    
} catch (e) {
    await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    console.log(e);
    reply(errorMg);
}
})


cmd({
    pattern: "allmenu",
    alias: ["allpanel", "allcmds", "alllits", "allcmd"],
    react: "📂",
    category: "main",
    use: `allmenu`,
    filename: __filename
}, async (conn, mek, m, { from, prefix, reply }) => {
    try {
        const logo = config.LOGO;
        const categories = {};
        let total = 0;

        // Group commands by category
        for (let cmd of commands) {
            if (!cmd.dontAddCommandList && cmd.pattern) {
                total++;
                if (!categories[cmd.category]) categories[cmd.category] = [];
                categories[cmd.category].push(cmd.pattern);
            }
        }
         const dateAndTime = await getDateAndTime(config.TIME_ZONE || "Asia/Colombo");
        const date = dateAndTime.date || '';
        const time = dateAndTime.time || '';
        const hostname = dbData.HOST_NAME;

        let responseMsg = `╔═❖🔹 ${toBold(botName || "PRINCE-MDX")} 🔹❖═╗\n`;
responseMsg += `┃➠ ${toSmallCaps("Owner")}      : ${config.OWNER_NAME}\n`;      
responseMsg += `┃➠ ${toSmallCaps("Platform")}   : ${hostname}\n`;
responseMsg += `┃➠ ${toSmallCaps("Uptime")}     : ${runtime(process.uptime())}\n`;
responseMsg += `┃➠ ${toSmallCaps("Prefix")}     : ${config.PREFIX}\n`;
responseMsg += `┃➠ ${toSmallCaps("Time")}       : ${time}\n`;
responseMsg += `┃➠ ${toSmallCaps("Date")}       : ${date}\n`;
responseMsg += `┃➠ ${toSmallCaps("Total cmds")} : ${total}\n`;        
responseMsg += `╚══════════════════╝\n`;

        // Build each section without descriptions
        for (let cat of Object.keys(categories)) {
            responseMsg += `\n╭━━━━❮ ${toBold(cat.toUpperCase())} ❯━⊷\n`;
            for (let cmd of categories[cat]) {
                responseMsg += `┃➠ ${toSmallCaps(cmd)}\n`;
            }
            responseMsg += `╰━━━━━━━━━━━━━━━━━⊷\n`;
        }

        responseMsg += `\n${config.FOOTER}`;

        await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null),
            image: { url: logo },
            caption: responseMsg
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(errorMg);
    }
});


/*
cmd({
    pattern: "team",
    alias: ["developers", "devs"],
    react: "👨‍💻",
    desc: "Get information about the developer team",
    category: "main",
    use: `team`,
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    
    const devTeam = [
        { name: "Yasiya", role: "Founder & Developer", pattern: `${config.PREFIX}yasiya` },
        { name: "Sadeepa", role: "CO-Owner", pattern: `${config.PREFIX}sadeepa` },
        { name: "Chamiya", role: "CO-Owner", pattern: `${config.PREFIX}chamiya` },
    ];

    const TEAM_IMAGE_URL = "https://i.ibb.co/MD35gHrC/download-3.jpg";
    
    let teamMessage = `📋 🥷🏻 *Developer Team* 🥷🏻 📋\n\n`;
    devTeam.forEach((dev) => {
        teamMessage += `🧑🏻‍💻 *Name:* ${dev.name}\n📌 *Role:* ${dev.role}\n🔹 *Pattern:* ${dev.pattern}\n\n`;
    });
    teamMessage += `> ${config.FOOTER}`;

    await conn.sendMessage(from, {
        contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: TEAM_IMAGE_URL },
        caption: teamMessage
    }, { quoted: mek });
});

const developers = [
    {
        name: "sadeepa",
        role: "CO-Owner",
        imageUrl: "https://i.ibb.co/0VtMzV4z/Whats-App-Image-2025-03-22-at-20-46-40-6dae2493.jpg",
        github: "https://github.com/Sadeepa206",
        contact: "https://wa.me/94740952096",
    },
    {
        name: "Yasiya",
        role: "Founder & Developer",
        imageUrl: "https://i.ibb.co/XZGP21qG/198083536.jpg",
        github: "https://github.com/Dark-Yasiya",
        contact: "https://wa.me/94743548986",
    },
    {
        name: "Chamiya",
        role: "Co-Owner",
        imageUrl: "https://avatars.githubusercontent.com/u/88298450?v=4",
        github: "https://github.com/chamiofficial",
        contact: "https://wa.me/94775512050",
    } 
];


developers.forEach(dev => {
    cmd({
        pattern: dev.name.toLowerCase(),
        alias: [`dev${dev.name.toLowerCase()}`],
        react: "🥷",
        desc: `Get information about ${dev.name}`,
        category: "info",
        use: `${config.PREFIX}${dev.name.toLowerCase()}`,
        filename: __filename
    }, async (conn, mek, m, { from }) => {
        await conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: { url: dev.imageUrl },
            caption: `🥷🏻 *${dev.name}*\n(⚒ ${dev.role} ⚒)\n\n🔱 *GitHub:* ${dev.github}\n\n📱 *Contact:* ${dev.contact}\n\n${config.FOOTER}`
        }, { quoted: mek });
    });
});
*/

// ============================= FETCH =============================
cmd({
    pattern: "fetch",
    alias: ["get", "testapi", "curl"],
    react: "🌐",
    desc: "Fetch and display content from a URL",
    category: "main",
    use: "fetch <url>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply("❌ Provide a valid URL to fetch.");

        const axios = require("axios");
        const response = await axios.get(q, {
            responseType: "arraybuffer",
            validateStatus: () => true,
            timeout: 60000,
            maxContentLength: 100 * 1024 * 1024,
        });

        const contentType = response.headers["content-type"] || "application/octet-stream";
        const buffer = Buffer.from(response.data);

        const urlParts = q.split("?")[0].split("/");
        let filename = urlParts.pop() || "file";
        if (filename.length > 100) filename = filename.substring(0, 100);

        if (!filename.includes(".") || filename.startsWith(".")) {
            const mimeMap = { "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif", "image/webp": ".webp", "video/mp4": ".mp4", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "application/pdf": ".pdf", "application/json": ".json", "text/html": ".html", "text/plain": ".txt" };
            const ext = Object.entries(mimeMap).find(([k]) => contentType.includes(k))?.[1] || ".bin";
            filename = filename.replace(/^\.+/, "") || "file";
            filename += ext;
        }

        if (contentType.includes("image/")) {
            return conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), image: buffer, caption: q }, { quoted: mek });
        }

        if (contentType.includes("video/")) {
            return conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), video: buffer, caption: q }, { quoted: mek });
        }

        if (contentType.includes("audio/")) {
            return conn.sendMessage(from, { contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), audio: buffer, mimetype: contentType.split(";")[0], fileName: filename }, { quoted: mek });
        }

        const textTypes = ["text/", "application/json", "application/javascript", "application/xml", "application/yaml", "application/sql"];
        if (textTypes.some(t => contentType.includes(t))) {
            const textContent = buffer.toString("utf-8");

            if (contentType.includes("json")) {
                try {
                    const json = JSON.parse(textContent);
                    const formatted = JSON.stringify(json, null, 2);
                    return reply("```json\n" + formatted + "\n```");
                } catch {
                    return reply(textContent);
                }
            }

            const lang = contentType.includes("javascript") ? "javascript"
                : contentType.includes("css") ? "css"
                : contentType.includes("xml") ? "xml"
                : contentType.includes("sql") ? "sql"
                : contentType.includes("yaml") ? "yaml"
                : "";
            if (lang) return reply("```" + lang + "\n" + textContent + "\n```");
            return reply(textContent);
        }

        return conn.sendMessage(from, {
            contextInfo: getContextInfo(config.BOT_NAME !== 'default' ? config.BOT_NAME : null), document: buffer,
            mimetype: contentType.split(";")[0] || "application/octet-stream",
            fileName: filename,
        }, { quoted: mek });

    } catch (err) {
        console.error("fetch error:", err);
        return reply("❌ Failed to fetch: " + (err.message || "Unknown error"));
    }
});
