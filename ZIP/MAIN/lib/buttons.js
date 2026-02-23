const { sendButtons: _sendButtons, sendInteractiveMessage: _sendInteractiveMessage } = require('gifted-btns');

const _origLog = console.log;
const _suppressPatterns = [
    'Interactive send', 'interactive send', 'sendButtons', 'sendInteractive',
    'native_flow', 'buttonParamsJson', 'nativeFlowMessage', 'additionalNodes',
    'biz_bot', 'interactive_flag', 'type:', 'nodes:', 'private:'
];

function _shouldSuppress(args) {
    const msg = args.map(a => typeof a === 'string' ? a : '').join(' ');
    if (_suppressPatterns.some(p => msg.includes(p))) return true;
    if (args.length > 0 && typeof args[0] === 'object' && args[0] !== null) {
        try {
            const str = JSON.stringify(args[0]).slice(0, 300);
            if (_suppressPatterns.some(p => str.includes(p))) return true;
        } catch {}
    }
    return false;
}

async function sendButtons(conn, jid, content, options) {
    const prev = console.log;
    console.log = function(...args) { if (!_shouldSuppress(args)) _origLog.apply(console, args); };
    try { return await _sendButtons(conn, jid, content, options); }
    finally { console.log = prev; }
}

async function sendInteractiveMessage(conn, jid, content, options) {
    const prev = console.log;
    console.log = function(...args) { if (!_shouldSuppress(args)) _origLog.apply(console, args); };
    try { return await _sendInteractiveMessage(conn, jid, content, options); }
    finally { console.log = prev; }
}

function createButton(type, text, data) {
    switch (type) {
        case 'reply':
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: text, id: data })
            };
        case 'url':
            return {
                name: 'cta_url',
                buttonParamsJson: JSON.stringify({ display_text: text, url: data })
            };
        case 'copy':
            return {
                name: 'cta_copy',
                buttonParamsJson: JSON.stringify({ display_text: text, copy_code: data })
            };
        case 'call':
            return {
                name: 'cta_call',
                buttonParamsJson: JSON.stringify({ display_text: text, phone_number: data })
            };
        default:
            return {
                name: 'quick_reply',
                buttonParamsJson: JSON.stringify({ display_text: text, id: data })
            };
    }
}

function createSection(title, rows) {
    return { title, rows };
}

async function sendButtonMessage(conn, jid, buttons, quoted, opts = {}) {
    const content = {
        text: opts.body || '',
        footer: opts.footer || '',
        title: opts.header || '',
        buttons: buttons
    };

    if (opts.image) {
        content.image = typeof opts.image === 'string' ? { url: opts.image } : opts.image;
    }

    await sendButtons(conn, jid, content, { quoted });
}

async function sendListMessage(conn, jid, sections, quoted, opts = {}) {
    const content = {
        text: opts.body || '',
        footer: opts.footer || '',
        title: opts.header || '',
        interactiveButtons: [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify({
                    title: opts.buttonText || 'Select Option',
                    sections: sections
                })
            }
        ]
    };

    if (opts.image) {
        content.image = typeof opts.image === 'string' ? { url: opts.image } : opts.image;
    }

    await sendInteractiveMessage(conn, jid, content, { quoted });
}

async function sendNativeFlowButtons(conn, jid, listData, quoted, opts = {}) {
    const content = {
        text: opts.body || opts.caption || '',
        footer: opts.footer || '',
        title: opts.header || '',
        interactiveButtons: [
            {
                name: 'single_select',
                buttonParamsJson: JSON.stringify(listData)
            }
        ]
    };

    if (opts.image) {
        content.image = typeof opts.image === 'string' ? { url: opts.image } : opts.image;
    }

    if (opts.contextInfo) {
        content.contextInfo = opts.contextInfo;
    }

    await sendInteractiveMessage(conn, jid, content, { quoted });
}

async function sendQuickReplyButtons(conn, jid, buttons, quoted, opts = {}) {
    const legacyButtons = buttons.map(btn => {
        if (btn.buttonId) {
            return {
                id: btn.buttonId,
                text: btn.buttonText?.displayText || btn.text || ''
            };
        }
        if (btn.name === 'quick_reply') {
            try {
                const params = typeof btn.buttonParamsJson === 'string' ? JSON.parse(btn.buttonParamsJson) : btn.buttonParamsJson;
                return { id: params.id || '', text: params.display_text || '' };
            } catch { return btn; }
        }
        return btn;
    });

    const content = {
        text: opts.body || opts.caption || '',
        footer: opts.footer || '',
        title: opts.header || '',
        buttons: legacyButtons
    };

    if (opts.image) {
        content.image = typeof opts.image === 'string' ? { url: opts.image } : opts.image;
    }

    if (opts.contextInfo) {
        content.contextInfo = opts.contextInfo;
    }

    await sendButtons(conn, jid, content, { quoted });
}

function isAlreadyGiftedFormat(buttons) {
    return buttons.every(b => b.name && b.buttonParamsJson);
}

function patchBaileysSocket(conn) {
    const originalSendMessage = conn.sendMessage.bind(conn);
    
    conn.sendMessage = async function(jid, content, options = {}) {
        if (!content?.buttons || !Array.isArray(content.buttons) || content.buttons.length === 0) {
            return originalSendMessage(jid, content, options);
        }

        if (isAlreadyGiftedFormat(content.buttons)) {
            return originalSendMessage(jid, content, options);
        }

        const quoted = options?.quoted;

        const hasNativeFlow = content.buttons.some(b => b.nativeFlowInfo);
        if (hasNativeFlow) {
            const interactiveButtons = [];
            for (const btn of content.buttons) {
                if (btn.nativeFlowInfo) {
                    interactiveButtons.push({
                        name: btn.nativeFlowInfo.name,
                        buttonParamsJson: btn.nativeFlowInfo.paramsJson
                    });
                }
            }

            const msgContent = {
                text: content.caption || content.text || '',
                footer: content.footer || '',
                interactiveButtons: interactiveButtons
            };

            if (content.image) {
                msgContent.image = content.image;
            }
            if (content.contextInfo) {
                msgContent.contextInfo = content.contextInfo;
            }

            return sendInteractiveMessage(conn, jid, msgContent, { quoted });
        }

        const isOldQuickReply = content.buttons.some(b => b.buttonId && (b.type === 1 || !b.type));
        if (isOldQuickReply) {
            const opts = {
                body: content.caption || content.text || '',
                footer: content.footer || '',
                header: content.header || ''
            };

            if (content.image) {
                opts.image = content.image;
            }
            if (content.contextInfo) {
                opts.contextInfo = content.contextInfo;
            }

            return sendQuickReplyButtons(conn, jid, content.buttons, quoted, opts);
        }

        return originalSendMessage(jid, content, options);
    };

    conn.sendButtonMessage = async function(jid, buttons, quoted, opts = {}) {
        await sendButtonMessage(conn, jid, buttons, quoted, opts);
    };

    conn.sendListMessage = async function(jid, sections, quoted, opts = {}) {
        await sendListMessage(conn, jid, sections, quoted, opts);
    };
}

module.exports = {
    createButton,
    createSection,
    sendButtonMessage,
    sendListMessage,
    sendNativeFlowButtons,
    sendQuickReplyButtons,
    patchBaileysSocket,
    sendButtons,
    sendInteractiveMessage
};
