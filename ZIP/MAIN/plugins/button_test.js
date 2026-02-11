const config = require('../config');
const { cmd } = require('../command');
const { createButton, createSection } = require('prince-btns');

cmd({
    pattern: "testbutton",
    alias: ["btntest", "buttontest"],
    react: "🔘",
    desc: "Test interactive buttons",
    category: "test",
    filename: __filename
}, async (conn, mek, m, { from, prefix, reply }) => {
    try {
        const buttons = [
            createButton('reply', 'Click Me! 👆', `${prefix}ping`),
            createButton('url', 'Visit GitHub 🌐', 'https://github.com'),
            createButton('copy', 'Copy Code 📋', 'PRINCE-MDX-2024')
        ];

        await conn.sendButtonMessage(from, buttons, mek, {
            header: '🔘 Button Test',
            body: '*Testing Interactive Buttons!*\n\nIf you can see clickable buttons below, then buttons are working correctly! ✅',
            footer: config.FOOTER || 'Prince MDX Bot'
        });

    } catch (err) {
        console.error('Button test error:', err);
        reply('❌ Error testing buttons: ' + err.message);
    }
});

cmd({
    pattern: "testlist",
    alias: ["listtest", "menutest"],
    react: "📋",
    desc: "Test list/menu messages",
    category: "test",
    filename: __filename
}, async (conn, mek, m, { from, prefix, reply }) => {
    try {
        const sections = [
            createSection('🎮 Fun Commands', [
                { title: 'Ping', description: 'Check bot speed', id: `${prefix}ping` },
                { title: 'Alive', description: 'Check if bot is online', id: `${prefix}alive` }
            ]),
            createSection('🛠️ Utility Commands', [
                { title: 'Menu', description: 'Show all commands', id: `${prefix}menu` },
                { title: 'System', description: 'System information', id: `${prefix}system` }
            ])
        ];

        await conn.sendListMessage(from, sections, mek, {
            header: '📋 List Test',
            body: '*Testing List Menu!*\n\nIf you can see a dropdown menu below, then list messages are working correctly! ✅',
            footer: config.FOOTER || 'Prince MDX Bot',
            buttonText: 'Select Option 📂'
        });

    } catch (err) {
        console.error('List test error:', err);
        reply('❌ Error testing list: ' + err.message);
    }
});

cmd({
    pattern: "testbuttonimg",
    alias: ["btnimgtest"],
    react: "🖼️",
    desc: "Test buttons with image",
    category: "test",
    filename: __filename
}, async (conn, mek, m, { from, prefix, reply }) => {
    try {
        const buttons = [
            createButton('reply', 'Get Menu 📑', `${prefix}menu`),
            createButton('reply', 'Check Speed ⚡', `${prefix}ping`)
        ];

        await conn.sendButtonMessage(from, buttons, mek, {
            header: '🖼️ Image Button Test',
            body: '*Testing Buttons with Image!*\n\nIf you see an image with buttons, everything works! ✅',
            footer: config.FOOTER || 'Prince MDX Bot',
            image: config.LOGO || 'https://i.ibb.co/8gxqHM2/prince-mdx.jpg'
        });

    } catch (err) {
        console.error('Image button test error:', err);
        reply('❌ Error testing image buttons: ' + err.message);
    }
});
