const axios = require("axios");
const { cmd } = require("../command");

// ================= CONFIG =================
const config = require("../config");

// ================= LANGUAGE =================
const allLangs = require("../lib/language.json");
const LANG = config.LANG === 'EN' ? 'EN' 
         : config.LANG === 'FR' ? 'FR' 
         : 'EN';
const lang = allLangs[LANG];

// Import game strings
const {
    flagGameStarted, flagGameAlreadyRunning, flagGameNotRunning, flagGameHostOnlyStop, flagGameStopped,
    flagRoundText, flagCorrectAnswer, flagWrongAnswer, flagTimeExceeded, flagGameOver, flagAlreadyJoined,
    flagJoined, flagGameCancelled,
    
    triviaGameStarted, triviaGameAlreadyRunning, triviaRoundText, triviaCorrect, triviaWrong,
    triviaTimeExceeded, triviaGameOver, triviaGameCancelled,
    
    guessGameStarted, guessGameAlreadyRunning, guessRoundText, guessCorrect, guessWrong,
    guessTimeExceeded, guessGameOver, guessGameCancelled,
    
    tttGameStart, tttWinner, tttDraw, tttGameEnded, tttNoGame, tttReplyToStart,
    tttCantPlaySelf, tttPlayerAlreadyInGame, tttNotYourTurn, tttPositionUsed,
    
    gameOnlyInGroups, triviaOnlyInGroups, guessOnlyInGroups
} = lang;

// Helper function to format strings with placeholders
function formatString(template, replacements) {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    }
    return result;
}

// ================= GAME STATE =================
const flagGames = new Map();
const triviaGames = new Map();
const guessGames = new Map();

// ================= FLAG CACHE =================
const FLAG_DATA_URL =
  "https://raw.githubusercontent.com/Mayelprince/games/refs/heads/main/flaggame/flags.json";

let flagCache = null;
let lastFetch = 0;
const CACHE_TIME = 5 * 60 * 1000;

// ================= FETCH FLAGS =================
async function fetchFlags() {
  const now = Date.now();
  if (flagCache && now - lastFetch < CACHE_TIME) return flagCache;

  try {
    const res = await axios.get(FLAG_DATA_URL, { timeout: 10000 });
    if (Array.isArray(res.data)) {
      flagCache = res.data;
      lastFetch = now;
      return flagCache;
    }
  } catch (e) {
    console.log("Failed to fetch flags:", e.message);
  }

  return [
    {
      flag: "🇺🇸",
      country: "United States",
      capital: "Washington D.C.",
      continent: "North America",
      options: ["United States", "Canada", "Mexico", "Brazil"]
    },
    {
      flag: "🇬🇧",
      country: "United Kingdom",
      capital: "London",
      continent: "Europe",
      options: ["United Kingdom", "France", "Germany", "Spain"]
    },
    {
      flag: "🇯🇵",
      country: "Japan",
      capital: "Tokyo",
      continent: "Asia",
      options: ["Japan", "China", "South Korea", "Thailand"]
    }
  ];
}

// ================= FLAG GAME FUNCTIONS =================
function nextFlagTurn(game) {
  game.currentIndex++;
  if (game.currentIndex >= game.players.length) {
    game.currentIndex = 0;
    game.round++;
  }
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function startFlagRound(conn, from) {
  const game = flagGames.get(from);
  if (!game) return;

  if (game.round > game.maxRounds) {
    await endFlagGame(conn, from);
    return;
  }

  const flags = await fetchFlags();
  const unused = flags.filter(f => !game.used.includes(f.country));

  const flag =
    unused.length > 0
      ? unused[Math.floor(Math.random() * unused.length)]
      : flags[Math.floor(Math.random() * flags.length)];

  // Shuffle options and store with their original indices
  const shuffledOptions = shuffleArray([...flag.options]);
  const correctIndex = shuffledOptions.findIndex(opt => opt === flag.country);
  
  game.used.push(flag.country);
  game.currentFlag = {
    ...flag,
    shuffledOptions,
    correctNumber: correctIndex + 1 // Store as 1-based index for user
  };

  const player = game.players[game.currentIndex];
  const optionsText = shuffledOptions.map((o, i) => `• ${i + 1}. ${o}`).join("\n");

  await conn.sendMessage(from, {
    text: formatString(flagRoundText, {
      round: game.round,
      maxRounds: game.maxRounds,
      flag: flag.flag,
      options: optionsText,
      player: player.id.split("@")[0]
    }),
    mentions: [player.id]
  });

  // === PLAYER TIMER ===
  if (game.turnTimeout) clearTimeout(game.turnTimeout);

  game.turnTimeout = setTimeout(async () => {
    if (!flagGames.has(from)) return;
    
    await conn.sendMessage(from, {
      text: formatString(flagTimeExceeded, {
        player: player.id.split("@")[0],
        country: flag.country
      }),
      mentions: [player.id]
    });
    
    nextFlagTurn(game);
    await startFlagRound(conn, from);
  }, 30000);
}

async function endFlagGame(conn, from) {
  const game = flagGames.get(from);
  if (!game) return;

  const scoresArray = Array.from(game.scores.entries());
  scoresArray.sort((a, b) => b[1] - a[1]);
  
  let scoresText = "";
  const mentions = [];
  
  scoresArray.forEach(([id, score], i) => {
    mentions.push(id);
    scoresText += `${i + 1}. @${id.split("@")[0]} → ${score} pts\n`;
  });

  await conn.sendMessage(from, {
    text: formatString(flagGameOver, { scores: scoresText }),
    mentions
  });
  
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  flagGames.delete(from);
}

// ================= FLAG GAME INPUT HANDLER =================
async function handleFlagInput(conn, m, from, sender, text) {
  const game = flagGames.get(from);
  if (!game) return false;

  // Allow bot owner to play (don't skip fromMe)

  // ================= JOIN PHASE =================
  if (game.joinPhase && text === "join") {
    const alreadyJoined = game.players.find(p => p.id === sender);
    if (alreadyJoined) {
      await conn.sendMessage(from, {
        text: formatString(flagAlreadyJoined, {
          player: sender.split("@")[0],
          players: game.players.length
        }),
        mentions: [sender]
      });
      return true;
    }

    game.players.push({ id: sender });
    game.scores.set(sender, 0);

    await conn.sendMessage(from, {
      text: formatString(flagJoined, {
        player: sender.split("@")[0],
        players: game.players.length
      }),
      mentions: [sender]
    });
    return true;
  }

  if (game.joinPhase || !game.currentFlag) return true;

  // Clear turn timer on input
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
    game.turnTimeout = null;
  }

  const currentPlayer = game.players[game.currentIndex];
  if (!currentPlayer || currentPlayer.id !== sender) return true;

  const guess = text.trim();
  const correctAnswer = game.currentFlag.country;
  let isCorrect = false;

  // ================= CHECK NUMBER INPUT (1-4) =================
  if (/^[1-4]$/.test(guess)) {
    const selectedIndex = parseInt(guess) - 1;
    const selectedOption = game.currentFlag.shuffledOptions[selectedIndex];
    
    if (selectedOption && selectedOption === correctAnswer) {
      isCorrect = true;
    }
  } 
  // ================= CHECK COUNTRY NAME INPUT =================
  else {
    // Check if guess matches the correct country (case-insensitive)
    if (guess.toLowerCase() === correctAnswer.toLowerCase()) {
      isCorrect = true;
    }
  }

  // ================= CORRECT ANSWER =================
  if (isCorrect) {
    const score = (game.scores.get(sender) || 0) + 10;
    game.scores.set(sender, score);

    await conn.sendMessage(from, {
      text: formatString(flagCorrectAnswer, {
        country: game.currentFlag.country,
        player: sender.split("@")[0]
      }),
      mentions: [sender]
    });

    nextFlagTurn(game);
    await startFlagRound(conn, from);
  } 
  // ================= WRONG ANSWER =================
  else {
    await conn.sendMessage(from, {
      text: formatString(flagWrongAnswer, { country: game.currentFlag.country })
    });

    nextFlagTurn(game);
    await startFlagRound(conn, from);
  }
  return true;
}

// ================= FLAG GAME COMMANDS =================
cmd({
  pattern: "flaggame",
  desc: "Start flag guessing game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
  if (!isGroup) return reply(gameOnlyInGroups);
  if (flagGames.has(from)) return reply(flagGameAlreadyRunning);

  const game = {
    host: sender,
    players: [{ id: sender }],
    scores: new Map([[sender, 0]]),
    round: 1,
    maxRounds: 5,
    currentIndex: 0,
    currentFlag: null,
    joinPhase: true,
    used: [],
    turnTimeout: null
  };

  flagGames.set(from, game);

  await conn.sendMessage(from, {
    text: formatString(flagGameStarted, { host: sender.split("@")[0] }),
    mentions: [sender]
  }, { quoted: mek });

  setTimeout(async () => {
    const g = flagGames.get(from);
    if (!g || !g.joinPhase) return;

    g.joinPhase = false;

    if (g.players.length < 2) {
      flagGames.delete(from);
      return conn.sendMessage(from, {
        text: flagGameCancelled
      });
    }

    await startFlagRound(conn, from);
  }, 30000);
});

cmd({
  pattern: "stopflag",
  desc: "Stop flag game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const game = flagGames.get(from);
  if (!game) return reply(flagGameNotRunning);

  if (game.host !== sender) {
    return reply(flagGameHostOnlyStop);
  }

  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  
  await conn.sendMessage(from, {
    text: formatString(flagGameStopped, { host: sender.split("@")[0] }),
    mentions: [sender]
  });
  
  flagGames.delete(from);
});

// ================= TIC-TAC-TOE MANAGER ==================
class TicTacToeManager {
  constructor() {
    this.games = new Map();
    this.turnTimeouts = new Map();
    this.gameTimeout = 5 * 60 * 1000;
    this.turnTimeout = 60 * 1000; // 60 seconds per turn
    this.conn = null; // Will be set when game starts
  }

  // Normalize ID to base number for comparison
  normalizeId(id) {
    if (!id) return null;
    // Extract the number part before @
    return id.split("@")[0];
  }

  // Check if two IDs match (handles LID vs JID)
  idsMatch(id1, id2) {
    if (!id1 || !id2) return false;
    if (id1 === id2) return true;
    return this.normalizeId(id1) === this.normalizeId(id2);
  }

  // Find player in game by any ID format
  findPlayerInGame(game, playerId) {
    for (const p of game.players) {
      if (this.idsMatch(p, playerId)) {
        return p; // Return the stored player ID
      }
    }
    return null;
  }

  createGame(chatId, p1, p2, conn) {
    if (!this.games.has(chatId)) this.games.set(chatId, new Map());
    const games = this.games.get(chatId);
    this.conn = conn;

    // Check if either player is already in a game
    for (const game of games.values()) {
      if (this.findPlayerInGame(game, p1) || this.findPlayerInGame(game, p2)) {
        return { success: false, message: tttPlayerAlreadyInGame };
      }
    }

    const gameId = `${this.normalizeId(p1)}:${this.normalizeId(p2)}`;
    const state = {
      players: [p1, p2],
      board: Array(9).fill(null),
      currentPlayer: p1,
      symbols: { [p1]: "❌", [p2]: "⭕" },
      lastMove: Date.now(),
      chatId: chatId
    };

    games.set(gameId, state);
    this.setTurnTimeout(chatId, gameId, state);

    return { success: true, gameId, state };
  }

  getGame(chatId, player) {
    if (!this.games.has(chatId)) return null;
    for (const [id, game] of this.games.get(chatId)) {
      const foundPlayer = this.findPlayerInGame(game, player);
      if (foundPlayer) {
        return { id, game, matchedPlayer: foundPlayer };
      }
    }
    return null;
  }

  makeMove(chatId, player, pos) {
    const data = this.getGame(chatId, player);
    if (!data) return { success: false, message: tttNoGame };

    const { id, game, matchedPlayer } = data;

    // Check if it's this player's turn (using matched ID)
    if (!this.idsMatch(game.currentPlayer, player)) {
      return { success: false, message: tttNotYourTurn };
    }

    if (game.board[pos] !== null)
      return { success: false, message: tttPositionUsed };

    // Use the stored player ID for the symbol
    game.board[pos] = game.symbols[matchedPlayer];
    game.lastMove = Date.now();

    const winner = this.checkWinner(game.board);

    if (winner) {
      this.clearTurnTimeout(chatId, id);
      this.endInternal(chatId, id);
      return { success: true, board: game.board, win: matchedPlayer, players: game.players };
    }

    if (!game.board.includes(null)) {
      this.clearTurnTimeout(chatId, id);
      this.endInternal(chatId, id);
      return { success: true, board: game.board, draw: true, players: game.players };
    }

    // Switch to next player
    game.currentPlayer = game.players.find(p => !this.idsMatch(p, matchedPlayer));
    
    // Reset turn timeout for next player
    this.setTurnTimeout(chatId, id, game);
    
    return { success: true, board: game.board, next: game.currentPlayer, players: game.players };
  }

  end(chatId, player) {
    const data = this.getGame(chatId, player);
    if (!data) return { success: false, message: tttNoGame };

    const { matchedPlayer } = data;
    const opponent = data.game.players.find(p => !this.idsMatch(p, matchedPlayer));
    this.clearTurnTimeout(chatId, data.id);
    this.endInternal(chatId, data.id);

    return {
      success: true,
      text: formatString(tttGameEnded, { opponent: opponent.split("@")[0] }),
      opponent
    };
  }

  endInternal(chatId, gameId) {
    if (this.games.has(chatId)) {
      this.games.get(chatId).delete(gameId);
      if (this.games.get(chatId).size === 0) this.games.delete(chatId);
    }
    this.clearTurnTimeout(chatId, gameId);
  }

  checkWinner(b) {
    const w = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    for (const [a, b1, c] of w) {
      if (b[a] && b[a] === b[b1] && b[a] === b[c]) {
        return true;
      }
    }
    return false;
  }

  formatBoard(board) {
    const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
    let out = "┄┄┄┄┄┄┄┄┄┄\n";
    for (let i = 0; i < 3; i++) {
      out += "┃ ";
      for (let j = 0; j < 3; j++) {
        const p = i * 3 + j;
        out += (board[p] || nums[p]) + " ┃ ";
      }
      out += "\n";
      if (i < 2) out += "┄┄┄┄┄┄┄┄┄┄\n";
    }
    return out + "┄┄┄┄┄┄┄┄┄┄";
  }

  setTurnTimeout(chatId, gameId, game) {
    this.clearTurnTimeout(chatId, gameId);
    
    const timeoutId = setTimeout(async () => {
      // Check if game still exists
      if (!this.games.has(chatId)) return;
      const games = this.games.get(chatId);
      if (!games.has(gameId)) return;
      
      const currentGame = games.get(gameId);
      const timedOutPlayer = currentGame.currentPlayer;
      const winner = currentGame.players.find(p => !this.idsMatch(p, timedOutPlayer));
      
      // Send timeout message
      if (this.conn) {
        try {
          await this.conn.sendMessage(chatId, {
            text: `⏰ *Time's up!*\n\n@${timedOutPlayer.split("@")[0]} took too long to play.\n\n🏆 @${winner.split("@")[0]} wins by timeout!`,
            mentions: [timedOutPlayer, winner]
          });
        } catch (e) {
          console.log("TTT timeout message error:", e.message);
        }
      }
      
      // End the game
      this.endInternal(chatId, gameId);
      
    }, this.turnTimeout);
    
    this.turnTimeouts.set(`${chatId}:${gameId}`, timeoutId);
  }

  clearTurnTimeout(chatId, gameId) {
    const key = `${chatId}:${gameId}`;
    if (this.turnTimeouts.has(key)) {
      clearTimeout(this.turnTimeouts.get(key));
      this.turnTimeouts.delete(key);
    }
  }
}

const ttt = new TicTacToeManager();

// ================== TIC-TAC-TOE COMMANDS ==================
cmd({
  pattern: "ttt",
  alias: ["tictactoe"],
  desc: "Start TicTacToe (reply to someone)",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, quoted, reply }) => {
  if (!quoted) return reply(tttReplyToStart);
  
  // Check if trying to play with self (normalize IDs)
  const senderNum = sender.split("@")[0];
  const quotedNum = quoted.sender.split("@")[0];
  if (senderNum === quotedNum) return reply(tttCantPlaySelf);

  const res = ttt.createGame(from, sender, quoted.sender, conn);
  if (!res.success) return reply(res.message);

  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE* ❌⭕
├━━━━━━━━━━━━━━━┤
│ ❌ @${senderNum}
│ ⭕ @${quotedNum}
├━━━━━━━━━━━━━━━┤
${ttt.formatBoard(res.state.board)}
├━━━━━━━━━━━━━━━┤
│ 🎮 @${senderNum}'s turn
│ ⏱️ 60 seconds per move
╰━━━━━━━━━━━━━━━╯

_Reply with a number (1-9) to play!_`,
    mentions: [sender, quoted.sender]
  });
});

cmd({
  pattern: "ttend",
  desc: "End TicTacToe",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const res = ttt.end(from, sender);
  if (!res.success) return reply(res.message);

  await conn.sendMessage(from, {
    text: res.text,
    mentions: [sender, res.opponent]
  });
});

cmd({
  pattern: "stopttt",
  desc: "Stop TicTacToe game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const res = ttt.end(from, sender);
  if (!res.success) return reply(tttNoGame);

  await conn.sendMessage(from, {
    text: res.text,
    mentions: [sender, res.opponent]
  });
});

// ================= TTT AI GAME =================
const tttAiGames = new Map();

function tttAiGetBestMove(board) {
  const winning = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  
  for (const [a, b, c] of winning) {
    if (board[a] === "⭕" && board[b] === "⭕" && board[c] === null) return c;
    if (board[a] === "⭕" && board[c] === "⭕" && board[b] === null) return b;
    if (board[b] === "⭕" && board[c] === "⭕" && board[a] === null) return a;
  }
  
  for (const [a, b, c] of winning) {
    if (board[a] === "❌" && board[b] === "❌" && board[c] === null) return c;
    if (board[a] === "❌" && board[c] === "❌" && board[b] === null) return b;
    if (board[b] === "❌" && board[c] === "❌" && board[a] === null) return a;
  }
  
  if (board[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter(i => board[i] === null);
  if (corners.length > 0) return corners[Math.floor(Math.random() * corners.length)];
  const available = board.map((v, i) => v === null ? i : -1).filter(i => i !== -1);
  return available[Math.floor(Math.random() * available.length)];
}

function tttAiCheckWinner(board) {
  const w = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a, b, c] of w) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

function tttAiFormatBoard(board) {
  const nums = ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];
  let out = "┄┄┄┄┄┄┄┄┄┄\n";
  for (let i = 0; i < 3; i++) {
    out += "┃ ";
    for (let j = 0; j < 3; j++) {
      const p = i * 3 + j;
      out += (board[p] || nums[p]) + " ┃ ";
    }
    out += "\n";
    if (i < 2) out += "┄┄┄┄┄┄┄┄┄┄\n";
  }
  return out + "┄┄┄┄┄┄┄┄┄┄";
}

cmd({
  pattern: "tttai",
  alias: ["tictactoeai", "tttvs"],
  desc: "Play TicTacToe against AI",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  if (tttAiGames.has(from + sender)) return reply("⚠️ You already have a game! Finish it or use .stoptttai");
  
  const game = {
    board: Array(9).fill(null),
    player: sender,
    playerSymbol: "❌",
    aiSymbol: "⭕",
    turn: "player"
  };
  
  tttAiGames.set(from + sender, game);
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
│ ❌ You (@${sender.split("@")[0]})
│ ⭕ AI (Bot)
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🎮 Your turn!
│ ⏱️ Reply with 1-9 to play
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  }, { quoted: mek });
});

cmd({
  pattern: "stoptttai",
  alias: ["endtttai"],
  desc: "Stop TicTacToe AI game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  if (!tttAiGames.has(from + sender)) return reply("❌ You don't have an active AI game.");
  tttAiGames.delete(from + sender);
  await reply("🛑 TicTacToe AI game ended.");
});

// ================= WORD CHAIN AI GAME =================
const wordChainAiGames = new Map();

const wordChainAiWordList = {
  a: ["apple", "amazing", "anchor", "animal", "arrow", "autumn", "artist"],
  b: ["banana", "bridge", "bright", "butter", "button", "bubble", "basket"],
  c: ["castle", "candle", "carpet", "cheese", "cherry", "coffee", "cotton"],
  d: ["diamond", "dragon", "dinner", "doctor", "donkey", "dancer", "desert"],
  e: ["elephant", "engine", "evening", "energy", "escape", "empire", "eagle"],
  f: ["flower", "forest", "frozen", "falcon", "family", "finger", "fountain"],
  g: ["garden", "guitar", "golden", "galaxy", "ginger", "glitter", "glacier"],
  h: ["hammer", "heaven", "hollow", "hunter", "honey", "harbor", "history"],
  i: ["island", "iceberg", "insect", "imagine", "inspire", "instant", "ivory"],
  j: ["jungle", "jacket", "jasmine", "journey", "justice", "joyful", "juggle"],
  k: ["kitchen", "kingdom", "kitten", "kernel", "kindred", "keeper", "knight"],
  l: ["lemon", "letter", "library", "lighter", "lizard", "lobster", "lantern"],
  m: ["monkey", "mirror", "mountain", "mystery", "magnet", "marble", "meadow"],
  n: ["nature", "needle", "napkin", "nectar", "network", "normal", "nuclear"],
  o: ["orange", "ocean", "option", "oxygen", "oyster", "oracle", "outline"],
  p: ["pepper", "planet", "purple", "palace", "parrot", "pumpkin", "puzzle"],
  q: ["queen", "quartz", "quality", "quantum", "quarter", "quilted", "quiver"],
  r: ["rabbit", "rainbow", "rocket", "river", "random", "ribbon", "reptile"],
  s: ["silver", "sunset", "spider", "shadow", "singer", "summer", "system"],
  t: ["tiger", "thunder", "trophy", "tunnel", "temple", "timber", "tornado"],
  u: ["umbrella", "unicorn", "uniform", "unique", "useful", "update", "urgent"],
  v: ["violet", "village", "victory", "velvet", "volcano", "voyage", "vintage"],
  w: ["window", "winter", "wonder", "wizard", "whisper", "warrior", "weather"],
  x: ["xylophone", "xenon"],
  y: ["yellow", "yogurt", "yonder", "yearly"],
  z: ["zebra", "zipper", "zenith", "zombie", "zodiac", "zephyr"]
};

function getAiWord(startLetter, usedWords) {
  const letter = startLetter.toLowerCase();
  const words = wordChainAiWordList[letter] || [];
  const available = words.filter(w => !usedWords.has(w));
  if (available.length === 0) return null;
  return available[Math.floor(Math.random() * available.length)];
}

cmd({
  pattern: "wordchainai",
  alias: ["wchainai", "chainwordai"],
  desc: "Play Word Chain against AI",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  if (wordChainAiGames.has(from + sender)) return reply("⚠️ You already have a game! Use .stopchainai to end it.");
  
  const game = {
    player: sender,
    usedWords: new Set(),
    lastWord: null,
    playerScore: 0,
    aiScore: 0,
    chainLength: 0,
    turn: "player",
    turnTimeout: null
  };
  
  wordChainAiGames.set(from + sender, game);
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN vs AI*
├━━━━━━━━━━━━━━━┤
│ 👤 You: @${sender.split("@")[0]}
│ 🤖 AI: Bot
│
│ 📜 *RULES:*
│ • Say a word starting with
│   the last letter of the
│   previous word
│ • No repeated words
│ • Must be real English words
│ • 45 seconds per turn
│ • Score = word length
│
│ 🎮 *Your turn - start with ANY word!*
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  }, { quoted: mek });
  
  startWordChainAiTimer(conn, from, sender);
});

cmd({
  pattern: "stopchainai",
  alias: ["endchainai", "stopwordchainai"],
  desc: "Stop Word Chain AI game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const key = from + sender;
  if (!wordChainAiGames.has(key)) return reply("❌ You don't have an active AI game.");
  
  const game = wordChainAiGames.get(key);
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  wordChainAiGames.delete(key);
  
  await reply(`🛑 Word Chain AI game ended.\n\n📊 *Final Score:*\n👤 You: ${game.playerScore} pts\n🤖 AI: ${game.aiScore} pts`);
});

function startWordChainAiTimer(conn, from, sender) {
  const key = from + sender;
  const game = wordChainAiGames.get(key);
  if (!game) return;
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  game.turnTimeout = setTimeout(async () => {
    if (!wordChainAiGames.has(key)) return;
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN - GAME OVER*
├━━━━━━━━━━━━━━━┤
│ ⏰ Time's up @${sender.split("@")[0]}!
├━━━━━━━━━━━━━━━┤
│ 📊 *FINAL SCORES:*
│ 👤 You: ${game.playerScore} pts
│ 🤖 AI: ${game.aiScore} pts
│ 🏆 ${game.aiScore > game.playerScore ? "AI Wins!" : game.playerScore > game.aiScore ? "You Win!" : "Draw!"}
│ 📝 Chain: ${game.chainLength} words
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    
    wordChainAiGames.delete(key);
  }, 45000);
}

async function handleWordChainAiInput(conn, mek, from, sender, text) {
  const key = from + sender;
  const game = wordChainAiGames.get(key);
  if (!game || game.turn !== "player") return false;
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  const word = text.toLowerCase().trim();
  
  if (!/^[a-z]{2,}$/.test(word)) {
    await conn.sendMessage(from, { text: `❌ Invalid! Words must be letters only (min 2 characters).` });
    startWordChainAiTimer(conn, from, sender);
    return true;
  }
  
  if (game.usedWords.has(word)) {
    await conn.sendMessage(from, { text: `❌ *"${word}"* was already used! Try another word.` });
    startWordChainAiTimer(conn, from, sender);
    return true;
  }
  
  if (game.lastWord) {
    const requiredLetter = game.lastWord.slice(-1);
    if (word[0] !== requiredLetter) {
      await conn.sendMessage(from, { text: `❌ Word must start with *"${requiredLetter.toUpperCase()}"*!` });
      startWordChainAiTimer(conn, from, sender);
      return true;
    }
  }
  
  const isValid = await isValidWord(word);
  if (!isValid) {
    await conn.sendMessage(from, { text: `❌ *"${word}"* is not a valid English word!` });
    startWordChainAiTimer(conn, from, sender);
    return true;
  }
  
  game.usedWords.add(word);
  game.lastWord = word;
  game.playerScore += word.length;
  game.chainLength++;
  
  const nextLetter = word.slice(-1);
  const aiWord = getAiWord(nextLetter, game.usedWords);
  
  if (!aiWord) {
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN - YOU WIN!*
├━━━━━━━━━━━━━━━┤
│ ✅ You: *${word}* (+${word.length} pts)
│ 🤖 AI couldn't find a word!
├━━━━━━━━━━━━━━━┤
│ 📊 *FINAL SCORES:*
│ 👤 You: ${game.playerScore} pts
│ 🤖 AI: ${game.aiScore} pts
│ 🏆 You Win!
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    wordChainAiGames.delete(key);
    return true;
  }
  
  game.usedWords.add(aiWord);
  game.lastWord = aiWord;
  game.aiScore += aiWord.length;
  game.chainLength++;
  
  const playerNextLetter = aiWord.slice(-1).toUpperCase();
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN vs AI*
├━━━━━━━━━━━━━━━┤
│ ✅ You: *${word}* (+${word.length} pts)
│ 🤖 AI: *${aiWord}* (+${aiWord.length} pts)
├━━━━━━━━━━━━━━━┤
│ 📊 You: ${game.playerScore} | AI: ${game.aiScore}
│ 🔤 Next letter: *${playerNextLetter}*
│ 🎮 Your turn!
│ ⏱️ 45 seconds
│ 📝 Chain: ${game.chainLength} words
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  });
  
  startWordChainAiTimer(conn, from, sender);
  return true;
}

// ================= TRIVIA GAME FUNCTIONS =================
async function fetchTriviaQuestion() {
  try {
    const res = await axios.get(
      "https://opentdb.com/api.php?amount=1&type=multiple",
      { timeout: 10000 }
    );
    const q = res.data.results[0];
    const correct = q.correct_answer;
    const options = [...q.incorrect_answers, correct];
    
    // Shuffle options
    const shuffledOptions = shuffleArray([...options]);

    // Decode HTML entities for display
    const decodeHTML = (text) => {
      return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&eacute;/g, 'é')
        .replace(/&ouml;/g, 'ö')
        .replace(/&uuml;/g, 'ü')
        .replace(/&ldquo;/g, '"')
        .replace(/&rdquo;/g, '"')
        .replace(/&shy;/g, '-')
        .replace(/&hellip;/g, '...');
    };

    return {
      question: decodeHTML(q.question),
      correct: decodeHTML(correct),
      options: shuffledOptions.map(opt => decodeHTML(opt))
    };
  } catch (e) {
    return {
      question: "What is 2 + 2?",
      correct: "4",
      options: ["1", "2", "3", "4"]
    };
  }
}

function nextTriviaTurn(game) {
  game.currentIndex++;
  if (game.currentIndex >= game.players.length) {
    game.currentIndex = 0;
    game.round++;
  }
}

async function startTriviaRound(conn, from) {
  const game = triviaGames.get(from);
  if (!game) return;

  if (game.round > game.maxRounds) {
    await endTriviaGame(conn, from);
    return;
  }

  const q = await fetchTriviaQuestion();
  const player = game.players[game.currentIndex];

  game.currentQuestion = q;
  game.currentPlayer = player;
  game.turnStarted = Date.now();

  if (game.turnTimeout) clearTimeout(game.turnTimeout);

  const optionsText = q.options.map((o, i) => `• ${i + 1}. ${o}`).join("\n");

  await conn.sendMessage(from, {
    text: formatString(triviaRoundText, {
      round: game.round,
      maxRounds: game.maxRounds,
      question: q.question,
      options: optionsText,
      player: player.split("@")[0]
    }),
    mentions: [player]
  });

  // TURN TIMER (30s)
  game.turnTimeout = setTimeout(async () => {
    if (!triviaGames.has(from)) return;
    
    await conn.sendMessage(from, {
      text: formatString(triviaTimeExceeded, {
        player: player.split("@")[0],
        correct: q.correct
      }),
      mentions: [player]
    });

    nextTriviaTurn(game);
    await startTriviaRound(conn, from);
  }, 30000);
}

async function endTriviaGame(conn, from) {
  const game = triviaGames.get(from);
  if (!game) return;

  const scoresArray = Array.from(game.scores.entries());
  scoresArray.sort((a, b) => b[1] - a[1]);
  
  let scoresText = "";
  const mentions = [];
  
  scoresArray.forEach(([id, score], i) => {
    mentions.push(id);
    scoresText += `${i + 1}. @${id.split("@")[0]} → ${score} pts\n`;
  });

  await conn.sendMessage(from, {
    text: formatString(triviaGameOver, { scores: scoresText }),
    mentions
  });
  
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  triviaGames.delete(from);
}

// ================= TRIVIA INPUT HANDLER =================
async function handleTriviaInput(conn, m, from, sender, text) {
  const game = triviaGames.get(from);
  if (!game) return false;

  // Allow bot owner to play (don't skip fromMe)

  // ================= JOIN PHASE =================
  if (game.joinPhase && text === "join") {
    if (game.players.includes(sender)) {
      await conn.sendMessage(from, {
        text: formatString(flagAlreadyJoined, {
          player: sender.split("@")[0],
          players: game.players.length
        }),
        mentions: [sender]
      });
      return true;
    }

    game.players.push(sender);
    game.scores.set(sender, 0);

    await conn.sendMessage(from, {
      text: formatString(flagJoined, {
        player: sender.split("@")[0],
        players: game.players.length
      }),
      mentions: [sender]
    });
    return true;
  }

  if (game.joinPhase) return true;

  // ================= TURN CHECK =================
  if (game.currentPlayer !== sender) return true;

  // Clear timer
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
    game.turnTimeout = null;
  }

  const answer = text.trim();
  const correctAnswer = game.currentQuestion.correct;
  let isCorrect = false;

  // ================= CHECK NUMBER INPUT (1-4) =================
  if (/^[1-4]$/.test(answer)) {
    const selectedIndex = parseInt(answer) - 1;
    const selectedOption = game.currentQuestion.options[selectedIndex];
    
    if (selectedOption && selectedOption.toLowerCase() === correctAnswer.toLowerCase()) {
      isCorrect = true;
    }
  } 
  // ================= CHECK TEXT INPUT =================
  else {
    // Direct match with correct answer (case-insensitive)
    if (answer.toLowerCase() === correctAnswer.toLowerCase()) {
      isCorrect = true;
    }
  }

  if (isCorrect) {
    const score = (game.scores.get(sender) || 0) + 10;
    game.scores.set(sender, score);

    await conn.sendMessage(from, {
      text: formatString(triviaCorrect, { player: sender.split("@")[0] }),
      mentions: [sender]
    });
  } else {
    await conn.sendMessage(from, {
      text: formatString(triviaWrong, { correct: game.currentQuestion.correct }),
      mentions: [sender]
    });
  }

  nextTriviaTurn(game);
  await startTriviaRound(conn, from);
  return true;
}

// ================= TRIVIA COMMANDS =================
cmd({
  pattern: "triviagame",
  desc: "Start multiplayer trivia game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
  if (!isGroup) return reply(triviaOnlyInGroups);
  if (triviaGames.has(from)) return reply(triviaGameAlreadyRunning);

  const game = {
    host: sender,
    players: [sender],
    scores: new Map([[sender, 0]]),
    round: 1,
    maxRounds: 5,
    currentIndex: 0,
    currentPlayer: null,
    currentQuestion: null,
    joinPhase: true,
    turnTimeout: null
  };

  triviaGames.set(from, game);

  await conn.sendMessage(from, {
    text: formatString(triviaGameStarted, { host: sender.split("@")[0] }),
    mentions: [sender]
  });

  // JOIN PHASE TIMER
  setTimeout(async () => {
    const g = triviaGames.get(from);
    if (!g || !g.joinPhase) return;

    g.joinPhase = false;

    if (g.players.length < 2) {
      triviaGames.delete(from);
      return conn.sendMessage(from, {
        text: triviaGameCancelled
      });
    }

    await startTriviaRound(conn, from);
  }, 30000);
});

cmd({
  pattern: "stoptrivia",
  desc: "Stop trivia game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const game = triviaGames.get(from);
  if (!game) return reply(flagGameNotRunning);

  if (game.host !== sender) {
    return reply(flagGameHostOnlyStop);
  }

  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  
  await conn.sendMessage(from, {
    text: formatString(flagGameStopped, { host: sender.split("@")[0] }),
    mentions: [sender]
  });
  
  triviaGames.delete(from);
});

// ================= WORD LIST =================
const WORDS = [
  "banana", "elephant", "computer", "pineapple",
  "whatsapp", "robotics", "telegram", "internet",
  "javascript", "developer", "keyboard", "monitor",
  "headphone", "microphone", "network", "database",
  "algorithm", "function", "variable", "programming",
  "android", "technology", "software", "hardware",
  "laptop", "printer", "scanner", "security",
  "encryption", "firewall", "terminal", "server"
];

// ================= GUESS WORD FUNCTIONS =================
function shuffleWord(word) {
  return word.split("").sort(() => Math.random() - 0.5).join("");
}

function nextGuessTurn(game) {
  game.currentIndex++;
  if (game.currentIndex >= game.players.length) {
    game.currentIndex = 0;
    game.round++;
  }
}

async function startGuessRound(conn, from) {
  const game = guessGames.get(from);
  if (!game) return;

  if (game.round > game.maxRounds) {
    await endGuessGame(conn, from);
    return;
  }

  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const scrambled = shuffleWord(word);
  const player = game.players[game.currentIndex];

  game.currentWord = word;
  game.currentPlayer = player;
  game.turnStarted = Date.now();

  if (game.turnTimeout) clearTimeout(game.turnTimeout);

  await conn.sendMessage(from, {
    text: formatString(guessRoundText, {
      round: game.round,
      maxRounds: game.maxRounds,
      scrambled: scrambled,
      player: player.split("@")[0]
    }),
    mentions: [player]
  });

  // TURN TIMER (30s)
  game.turnTimeout = setTimeout(async () => {
    if (!guessGames.has(from)) return;
    
    await conn.sendMessage(from, {
      text: formatString(guessTimeExceeded, {
        player: player.split("@")[0],
        word: word
      }),
      mentions: [player]
    });

    nextGuessTurn(game);
    await startGuessRound(conn, from);
  }, 30000);
}

async function endGuessGame(conn, from) {
  const game = guessGames.get(from);
  if (!game) return;

  const scoresArray = Array.from(game.scores.entries());
  scoresArray.sort((a, b) => b[1] - a[1]);
  
  let scoresText = "";
  const mentions = [];
  
  scoresArray.forEach(([id, score], i) => {
    mentions.push(id);
    scoresText += `${i + 1}. @${id.split("@")[0]} → ${score} pts\n`;
  });

  await conn.sendMessage(from, {
    text: formatString(guessGameOver, { scores: scoresText }),
    mentions
  });
  
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  guessGames.delete(from);
}

// ================= GUESS WORD INPUT HANDLER =================
async function handleGuessInput(conn, m, from, sender, text) {
  const game = guessGames.get(from);
  if (!game) return false;

  // Allow bot owner to play (don't skip fromMe)

  // ================= JOIN PHASE =================
  if (game.joinPhase && text === "join") {
    if (game.players.includes(sender)) {
      await conn.sendMessage(from, {
        text: formatString(flagAlreadyJoined, {
          player: sender.split("@")[0],
          players: game.players.length
        }),
        mentions: [sender]
      });
      return true;
    }

    game.players.push(sender);
    game.scores.set(sender, 0);

    await conn.sendMessage(from, {
      text: formatString(flagJoined, {
        player: sender.split("@")[0],
        players: game.players.length
      }),
      mentions: [sender]
    });
    return true;
  }

  if (game.joinPhase) return true;

  // ================= TURN CHECK =================
  if (game.currentPlayer !== sender) return true;

  // Clear timer
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
    game.turnTimeout = null;
  }

  // ================= ANSWER CHECK =================
  if (text.toLowerCase() === game.currentWord.toLowerCase()) {
    const score = (game.scores.get(sender) || 0) + 10;
    game.scores.set(sender, score);

    await conn.sendMessage(from, {
      text: formatString(guessCorrect, { player: sender.split("@")[0] }),
      mentions: [sender]
    });
  } else {
    await conn.sendMessage(from, {
      text: formatString(guessWrong, { word: game.currentWord }),
      mentions: [sender]
    });
  }

  nextGuessTurn(game);
  await startGuessRound(conn, from);
  return true;
}

// ================= GUESS WORD COMMANDS =================
cmd({
  pattern: "guessword",
  desc: "Start multiplayer Guess Word game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
  if (!isGroup) return reply(guessOnlyInGroups);
  if (guessGames.has(from)) return reply(guessGameAlreadyRunning);

  const game = {
    host: sender,
    players: [sender],
    scores: new Map([[sender, 0]]),
    round: 1,
    maxRounds: 5,
    currentIndex: 0,
    currentPlayer: null,
    currentWord: null,
    joinPhase: true,
    turnTimeout: null
  };

  guessGames.set(from, game);

  await conn.sendMessage(from, {
    text: formatString(guessGameStarted, { host: sender.split("@")[0] }),
    mentions: [sender]
  });

  // JOIN PHASE TIMER
  setTimeout(async () => {
    const g = guessGames.get(from);
    if (!g || !g.joinPhase) return;

    g.joinPhase = false;

    if (g.players.length < 2) {
      guessGames.delete(from);
      return conn.sendMessage(from, {
        text: guessGameCancelled
      });
    }

    await startGuessRound(conn, from);
  }, 30000);
});

cmd({
  pattern: "stopguess",
  desc: "Stop GuessWord game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const game = guessGames.get(from);
  if (!game) return reply(flagGameNotRunning);

  if (game.host !== sender) {
    return reply(flagGameHostOnlyStop);
  }

  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
  }
  
  await conn.sendMessage(from, {
    text: formatString(flagGameStopped, { host: sender.split("@")[0] }),
    mentions: [sender]
  });
  
  guessGames.delete(from);
});

// ================= UNIVERSAL BODY HANDLER =================
cmd({
  on: "body"
}, async (conn, mek, m, { from, sender, body }) => {
  try {
    if (!from || !sender) return;
    
    const text = (body || "").trim();
    const textLower = text.toLowerCase();
    
    // Skip bot's own formatted response messages (contain box characters or are multi-line)
    if (text.includes("╭") || text.includes("│") || text.includes("╰") || 
        text.includes("┃") || text.includes("├") || text.includes("┄") ||
        text.startsWith("❌") || text.startsWith("✅") || text.startsWith("⏰") ||
        text.split("\n").length > 2) {
      return;
    }
    
    // First check for join command
    if (textLower === "join") {
      // Check which game is active
      if (flagGames.has(from)) {
        await handleFlagInput(conn, mek, from, sender, textLower);
        return;
      }
      if (triviaGames.has(from)) {
        await handleTriviaInput(conn, mek, from, sender, textLower);
        return;
      }
      if (guessGames.has(from)) {
        await handleGuessInput(conn, mek, from, sender, textLower);
        return;
      }
      if (diceGames.has(from)) {
        await handleDiceJoin(conn, from, sender);
        return;
      }
    }
    
    // Check for dice game throw command
    if ((textLower === "throw" || textLower === "roll") && diceGames.has(from)) {
      await handleDiceRoll(conn, from, sender);
      return;
    }
    
    // Check for active games BEFORE Tic-Tac-Toe
    if (flagGames.has(from)) {
      // For flag game, check if input is number 1-4 or text
      if (/^[1-4]$/.test(text) || /^[a-zA-Z\s]+$/.test(text)) {
        await handleFlagInput(conn, mek, from, sender, textLower);
      }
      return;
    }
    
    if (triviaGames.has(from)) {
      // For trivia game, check if input is number 1-4 or text
      if (/^[1-4]$/.test(text) || /^[a-zA-Z0-9\s\?\.,!]+$/.test(text)) {
        await handleTriviaInput(conn, mek, from, sender, textLower);
      }
      return;
    }
    
    if (guessGames.has(from)) {
      await handleGuessInput(conn, mek, from, sender, textLower);
      return;
    }
    
    // Handle Math Quiz answers (number answers)
    if (mathGames.has(from)) {
      const game = mathGames.get(from);
      // Convert answer to string for comparison
      if (text === String(game.answer)) {
        const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(1);
        mathGames.delete(from);
        await conn.sendMessage(from, {
          text: `✅ *Correct!* @${sender.split("@")[0]}\n\n⏱️ Time: ${timeTaken}s\n🎯 Answer: ${game.answer}`,
          mentions: [sender]
        });
      } else if (/^-?\d+$/.test(text)) {
        await conn.sendMessage(from, {
          text: `❌ Wrong! Try again...`
        });
      }
      return;
    }
    
    // Handle Emoji Guess answers
    if (emojiGames.has(from)) {
      const game = emojiGames.get(from);
      
      if (textLower === "hint" || textLower === ".hint") {
        if (!game.hintUsed) {
          game.hintUsed = true;
          await conn.sendMessage(from, { text: `💡 *Hint:* ${game.hint}` });
        } else {
          await conn.sendMessage(from, { text: `💡 Hint already used: ${game.hint}` });
        }
        return;
      }
      
      if (textLower === game.answer || textLower.includes(game.answer)) {
        const timeTaken = ((Date.now() - game.startTime) / 1000).toFixed(1);
        emojiGames.delete(from);
        await conn.sendMessage(from, {
          text: `🎉 *Correct!* @${sender.split("@")[0]}\n\n🎬 Movie: *${game.answer.toUpperCase()}*\n⏱️ Time: ${timeTaken}s`,
          mentions: [sender]
        });
      }
      return;
    }
    
    // Handle Would You Rather responses (A/B or 1/2)
    if (wyrGames.has(from)) {
      const game = wyrGames.get(from);
      const choice = textLower;
      let selectedOption = null;
      
      if (choice === "a" || choice === "1") {
        selectedOption = "a";
      } else if (choice === "b" || choice === "2") {
        selectedOption = "b";
      }
      
      if (selectedOption) {
        const alreadyVoted = game.votes.a.includes(sender) || game.votes.b.includes(sender);
        if (alreadyVoted) {
          await conn.sendMessage(from, { text: `⚠️ @${sender.split("@")[0]}, you already voted!`, mentions: [sender] });
          return;
        }
        
        game.votes[selectedOption].push(sender);
        const optionText = selectedOption === "a" ? game.question.a : game.question.b;
        const emoji = selectedOption === "a" ? "🅰️" : "🅱️";
        
        await conn.sendMessage(from, {
          text: `${emoji} @${sender.split("@")[0]} chose: *${optionText}*\n\n📊 Votes: 🅰️ ${game.votes.a.length} | 🅱️ ${game.votes.b.length}`,
          mentions: [sender]
        });
      }
      return;
    }
    
    // Only check Tic-Tac-Toe if no other game is active
    if (/^[1-9]$/.test(text)) {
      // Update connection reference for timeout messages
      ttt.conn = conn;
      
      const res = ttt.makeMove(from, sender, Number(text) - 1);
      if (!res?.success) return;

      const board = ttt.formatBoard(res.board);

      const getDisplayNumber = (id) => {
        if (!id) return "Unknown";
        return id.split("@")[0];
      };

      const player1 = res.players?.[0] || sender;
      const player2 = res.players?.[1] || sender;
      const p1Num = getDisplayNumber(player1);
      const p2Num = getDisplayNumber(player2);

      if (res.win) {
        return conn.sendMessage(from, {
          text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE* ❌⭕
├━━━━━━━━━━━━━━━┤
${board}
├━━━━━━━━━━━━━━━┤
│ 🏆 @${getDisplayNumber(res.win)} *WINS!*
╰━━━━━━━━━━━━━━━╯`,
          mentions: [player1, player2]
        });
      }

      if (res.draw) {
        return conn.sendMessage(from, {
          text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE* ❌⭕
├━━━━━━━━━━━━━━━┤
${board}
├━━━━━━━━━━━━━━━┤
│ 🤝 *It's a DRAW!*
╰━━━━━━━━━━━━━━━╯`,
          mentions: [player1, player2]
        });
      }

      return conn.sendMessage(from, {
        text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE* ❌⭕
├━━━━━━━━━━━━━━━┤
│ ❌ @${p1Num}
│ ⭕ @${p2Num}
├━━━━━━━━━━━━━━━┤
${board}
├━━━━━━━━━━━━━━━┤
│ 🎮 @${getDisplayNumber(res.next)}'s turn
│ ⏱️ 60 seconds to move
╰━━━━━━━━━━━━━━━╯`,
        mentions: [player1, player2]
      });
    }
    
  } catch (e) {
    console.log("❌ Game handler error:", e.message);
  }
});

// ================= ROCK PAPER SCISSORS =================
const rpsGames = new Map();
const RPS_CHOICES = ['rock', 'paper', 'scissors'];
const RPS_EMOJIS = { rock: '🪨', paper: '📄', scissors: '✂️' };

cmd({
  pattern: "rps",
  alias: ["rockpaperscissors"],
  desc: "Play Rock Paper Scissors",
  category: "games",
  use: ".rps [rock/paper/scissors]",
  filename: __filename
}, async (conn, mek, m, { from, sender, args, reply, isGroup }) => {
  try {
    const choice = args[0]?.toLowerCase();
    
    if (!choice || !RPS_CHOICES.includes(choice)) {
      return reply(`🎮 *Rock Paper Scissors*\n\nUsage: .rps [rock/paper/scissors]\n\nExample:\n• .rps rock\n• .rps paper\n• .rps scissors`);
    }
    
    const botChoice = RPS_CHOICES[Math.floor(Math.random() * 3)];
    const playerEmoji = RPS_EMOJIS[choice];
    const botEmoji = RPS_EMOJIS[botChoice];
    
    let result, emoji;
    
    if (choice === botChoice) {
      result = "It's a TIE! 🤝";
      emoji = "🤝";
    } else if (
      (choice === 'rock' && botChoice === 'scissors') ||
      (choice === 'paper' && botChoice === 'rock') ||
      (choice === 'scissors' && botChoice === 'paper')
    ) {
      result = "You WIN! 🎉";
      emoji = "🏆";
    } else {
      result = "You LOSE! 😢";
      emoji = "💔";
    }
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🎮 *ROCK PAPER SCISSORS*
├━━━━━━━━━━━━━━━┤
│ You: ${playerEmoji} ${choice.toUpperCase()}
│ Bot: ${botEmoji} ${botChoice.toUpperCase()}
├━━━━━━━━━━━━━━━┤
│ ${emoji} *${result}*
╰━━━━━━━━━━━━━━━╯`
    }, { quoted: mek });
    
  } catch (e) {
    console.error("RPS error:", e);
    reply("❌ An error occurred.");
  }
});

// ================= MATH QUIZ =================
const mathGames = new Map();

function generateMathQuestion(difficulty = 'easy') {
  let num1, num2, operator, answer;
  
  if (difficulty === 'easy') {
    num1 = Math.floor(Math.random() * 20) + 1;
    num2 = Math.floor(Math.random() * 20) + 1;
    operator = ['+', '-'][Math.floor(Math.random() * 2)];
  } else if (difficulty === 'medium') {
    num1 = Math.floor(Math.random() * 50) + 10;
    num2 = Math.floor(Math.random() * 20) + 1;
    operator = ['+', '-', '*'][Math.floor(Math.random() * 3)];
  } else {
    num1 = Math.floor(Math.random() * 100) + 20;
    num2 = Math.floor(Math.random() * 50) + 5;
    operator = ['+', '-', '*'][Math.floor(Math.random() * 3)];
  }
  
  switch (operator) {
    case '+': answer = num1 + num2; break;
    case '-': answer = num1 - num2; break;
    case '*': answer = num1 * num2; break;
  }
  
  return { question: `${num1} ${operator} ${num2}`, answer: answer.toString() };
}

cmd({
  pattern: "mathquiz",
  alias: ["math", "quickmath"],
  desc: "Start a quick math quiz",
  category: "games",
  use: ".mathquiz [easy/medium/hard]",
  filename: __filename
}, async (conn, mek, m, { from, sender, args, reply }) => {
  try {
    if (mathGames.has(from)) {
      return reply("⚠️ A math quiz is already running! Answer the current question first.");
    }
    
    const difficulty = ['easy', 'medium', 'hard'].includes(args[0]?.toLowerCase()) 
      ? args[0].toLowerCase() 
      : 'easy';
    
    const { question, answer } = generateMathQuestion(difficulty);
    
    mathGames.set(from, {
      answer,
      difficulty,
      startTime: Date.now(),
      sender
    });
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🧮 *MATH QUIZ*
├━━━━━━━━━━━━━━━┤
│ Difficulty: ${difficulty.toUpperCase()}
│ 
│ ❓ What is: *${question} = ?*
│ 
│ ⏱️ You have 30 seconds!
╰━━━━━━━━━━━━━━━╯

_Reply with the answer..._`
    }, { quoted: mek });
    
    // Auto-timeout after 30 seconds
    setTimeout(async () => {
      if (mathGames.has(from) && mathGames.get(from).answer === answer) {
        mathGames.delete(from);
        await conn.sendMessage(from, {
          text: `⏰ *Time's up!*\n\nThe correct answer was: *${answer}*`
        });
      }
    }, 30000);
    
  } catch (e) {
    console.error("Math quiz error:", e);
    reply("❌ An error occurred.");
  }
});

// ================= EMOJI GUESS =================
const emojiGames = new Map();
const EMOJI_MOVIES = [
  { emoji: "🦁👑", answer: "lion king", hint: "Disney animated classic" },
  { emoji: "🕷️🦸‍♂️", answer: "spiderman", hint: "Marvel superhero" },
  { emoji: "❄️👸", answer: "frozen", hint: "Let it go!" },
  { emoji: "🧙‍♂️💍", answer: "lord of the rings", hint: "One ring to rule them all" },
  { emoji: "🦈", answer: "jaws", hint: "Classic shark movie" },
  { emoji: "👻👻👻", answer: "ghostbusters", hint: "Who you gonna call?" },
  { emoji: "🏠👦😱", answer: "home alone", hint: "Kevin!" },
  { emoji: "🚢❄️💔", answer: "titanic", hint: "Jack and Rose" },
  { emoji: "🧔🔫", answer: "john wick", hint: "Don't touch his dog" },
  { emoji: "🦇🃏", answer: "batman", hint: "Dark Knight" },
  { emoji: "🐀👨‍🍳", answer: "ratatouille", hint: "Rat chef in Paris" },
  { emoji: "🐟🔍", answer: "finding nemo", hint: "Keep swimming" },
  { emoji: "👽☎️🏠", answer: "et", hint: "Phone home" },
  { emoji: "🤖❤️🌱", answer: "wall-e", hint: "Lonely robot" },
  { emoji: "🧞‍♂️🏺", answer: "aladdin", hint: "A whole new world" },
  { emoji: "🐘✈️", answer: "dumbo", hint: "Flying elephant" },
  { emoji: "🦖🏝️", answer: "jurassic park", hint: "Life finds a way" },
  { emoji: "⚡🧙‍♂️👓", answer: "harry potter", hint: "The boy who lived" },
  { emoji: "🏎️💨", answer: "fast and furious", hint: "Family!" },
  { emoji: "🦍🏙️", answer: "king kong", hint: "Giant ape in New York" }
];

cmd({
  pattern: "emojiguess",
  alias: ["guessemoji", "movieemoji"],
  desc: "Guess the movie from emojis",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  try {
    if (emojiGames.has(from)) {
      return reply("⚠️ An emoji guess game is already running! Answer or use .stopemoji");
    }
    
    const movie = EMOJI_MOVIES[Math.floor(Math.random() * EMOJI_MOVIES.length)];
    
    emojiGames.set(from, {
      answer: movie.answer,
      hint: movie.hint,
      startTime: Date.now(),
      hintUsed: false
    });
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🎬 *EMOJI MOVIE GUESS*
├━━━━━━━━━━━━━━━┤
│ 
│ ${movie.emoji}
│ 
│ 🎯 Guess the movie!
│ 💡 Hint: ${movie.hint}
│ ⏱️ 60 seconds to answer
╰━━━━━━━━━━━━━━━╯

_Reply with the movie name..._`
    }, { quoted: mek });
    
    // Auto-timeout
    setTimeout(async () => {
      if (emojiGames.has(from)) {
        const game = emojiGames.get(from);
        if (game.answer === movie.answer) {
          emojiGames.delete(from);
          await conn.sendMessage(from, {
            text: `⏰ *Time's up!*\n\nThe movie was: *${movie.answer.toUpperCase()}*`
          });
        }
      }
    }, 60000);
    
  } catch (e) {
    console.error("Emoji guess error:", e);
    reply("❌ An error occurred.");
  }
});

cmd({
  pattern: "stopemoji",
  desc: "Stop emoji guess game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  if (!emojiGames.has(from)) {
    return reply("❌ No emoji game is running.");
  }
  const game = emojiGames.get(from);
  emojiGames.delete(from);
  reply(`🛑 Game stopped! The answer was: *${game.answer.toUpperCase()}*`);
});

// ================= WOULD YOU RATHER =================
const WYR_QUESTIONS = [
  { a: "Be able to fly", b: "Be invisible" },
  { a: "Have unlimited money", b: "Have unlimited time" },
  { a: "Live in the past", b: "Live in the future" },
  { a: "Be famous", b: "Be powerful" },
  { a: "Never use social media again", b: "Never watch TV/movies again" },
  { a: "Always be hot", b: "Always be cold" },
  { a: "Speak all languages", b: "Play all instruments" },
  { a: "Be a genius", b: "Be extremely attractive" },
  { a: "Live in the city", b: "Live in the countryside" },
  { a: "Have super strength", b: "Have super speed" },
  { a: "Travel the world free", b: "Have a dream house" },
  { a: "Read minds", b: "See the future" },
  { a: "Be able to teleport", b: "Be able to time travel" },
  { a: "Have no phone", b: "Have no car" },
  { a: "Be immortal", b: "Live 3 perfect lives" }
];

const wyrGames = new Map();

cmd({
  pattern: "wyr",
  alias: ["wouldyourather", "rather"],
  desc: "Would You Rather game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, reply }) => {
  try {
    const q = WYR_QUESTIONS[Math.floor(Math.random() * WYR_QUESTIONS.length)];
    
    // Store the question for tracking responses
    wyrGames.set(from, {
      question: q,
      votes: { a: [], b: [] },
      startTime: Date.now()
    });
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🤔 *WOULD YOU RATHER*
├━━━━━━━━━━━━━━━┤
│
│ 🅰️ ${q.a}
│
│       *OR*
│
│ 🅱️ ${q.b}
│
╰━━━━━━━━━━━━━━━╯

_Reply with A, B, 1, or 2!_`
    }, { quoted: mek });
    
    // Auto-expire after 2 minutes
    setTimeout(() => {
      if (wyrGames.has(from)) {
        wyrGames.delete(from);
      }
    }, 120000);
    
  } catch (e) {
    console.error("WYR error:", e);
    reply("❌ An error occurred.");
  }
});

// ================= TRUTH OR DARE =================
const TRUTHS = [
  "What's your biggest fear?",
  "What's the most embarrassing thing you've done?",
  "What's a secret you've never told anyone?",
  "Who was your first crush?",
  "What's the weirdest dream you've had?",
  "Have you ever lied to get out of trouble?",
  "What's your guilty pleasure?",
  "What's the last lie you told?",
  "What's the most childish thing you still do?",
  "What's the worst gift you've received?",
  "Have you ever cheated on a test?",
  "What's your most embarrassing nickname?",
  "What's the longest you've gone without showering?",
  "What's the silliest thing you're afraid of?",
  "Who do you secretly envy?"
];

const DARES = [
  "Send a voice note singing your favorite song",
  "Change your profile picture to something funny for 1 hour",
  "Send a selfie with a funny face",
  "Text your crush and say hi",
  "Post an embarrassing status",
  "Don't reply to anyone for 10 minutes",
  "Send a message in ONLY emojis for the next 5 messages",
  "Tell a joke and make everyone laugh",
  "Describe yourself in 3 emojis",
  "Send a voice note in a funny accent",
  "Compliment everyone in the group",
  "Share your screen time report",
  "Send the oldest photo in your gallery",
  "Type with your eyes closed for the next message",
  "Share the last YouTube video you watched"
];

cmd({
  pattern: "truth",
  desc: "Get a truth question",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender }) => {
  const truth = TRUTHS[Math.floor(Math.random() * TRUTHS.length)];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎭 *TRUTH*
├━━━━━━━━━━━━━━━┤
│
│ @${sender.split("@")[0]}
│
│ ❓ ${truth}
│
╰━━━━━━━━━━━━━━━╯

_Answer honestly!_`,
    mentions: [sender]
  }, { quoted: mek });
});

cmd({
  pattern: "dare",
  desc: "Get a dare challenge",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender }) => {
  const dare = DARES[Math.floor(Math.random() * DARES.length)];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎭 *DARE*
├━━━━━━━━━━━━━━━┤
│
│ @${sender.split("@")[0]}
│
│ 🔥 ${dare}
│
╰━━━━━━━━━━━━━━━╯

_Complete the dare!_`,
    mentions: [sender]
  }, { quoted: mek });
});

cmd({
  pattern: "tod",
  alias: ["truthordare"],
  desc: "Random Truth or Dare",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender }) => {
  const isTruth = Math.random() > 0.5;
  const content = isTruth 
    ? TRUTHS[Math.floor(Math.random() * TRUTHS.length)]
    : DARES[Math.floor(Math.random() * DARES.length)];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎭 *${isTruth ? 'TRUTH' : 'DARE'}*
├━━━━━━━━━━━━━━━┤
│
│ @${sender.split("@")[0]}
│
│ ${isTruth ? '❓' : '🔥'} ${content}
│
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  }, { quoted: mek });
});

// ================= COIN FLIP =================
cmd({
  pattern: "coinflip",
  alias: ["flip", "coin"],
  desc: "Flip a coin",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from }) => {
  const result = Math.random() > 0.5 ? "HEADS" : "TAILS";
  const emoji = result === "HEADS" ? "🪙" : "💿";
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🪙 *COIN FLIP*
├━━━━━━━━━━━━━━━┤
│
│ ${emoji} *${result}!*
│
╰━━━━━━━━━━━━━━━╯`
  }, { quoted: mek });
});

// ================= DICE ROLL (Simple) =================
cmd({
  pattern: "roll",
  alias: ["rolldice"],
  desc: "Roll a dice",
  category: "games",
  use: ".roll [number of dice]",
  filename: __filename
}, async (conn, mek, m, { from, args }) => {
  const numDice = Math.min(parseInt(args[0]) || 1, 6);
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  
  let results = [];
  let total = 0;
  
  for (let i = 0; i < numDice; i++) {
    const roll = Math.floor(Math.random() * 6) + 1;
    results.push({ value: roll, emoji: diceEmojis[roll - 1] });
    total += roll;
  }
  
  const diceDisplay = results.map(r => `${r.emoji} (${r.value})`).join('  ');
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎲 *DICE ROLL*
├━━━━━━━━━━━━━━━┤
│
│ ${diceDisplay}
│
│ Total: *${total}*
╰━━━━━━━━━━━━━━━╯`
  }, { quoted: mek });
});

// ================= MULTIPLAYER DICE GAME =================
const diceGames = new Map();

cmd({
  pattern: "dice",
  alias: ["dicegame", "dicewar"],
  desc: "Start multiplayer dice game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
  if (!isGroup) return reply("❌ Dice game can only be played in groups!");
  if (diceGames.has(from)) return reply("⚠️ A dice game is already running! Use .stopdice to end it.");
  
  const game = {
    host: sender,
    players: [{ id: sender, score: 0, rolls: [] }],
    currentIndex: 0,
    round: 1,
    maxRounds: 3,
    joinPhase: true,
    turnTimeout: null
  };
  
  diceGames.set(from, game);
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎲 *DICE GAME*
├━━━━━━━━━━━━━━━┤
│ @${sender.split("@")[0]} started a game!
│
│ 📜 *RULES:*
│ • Each player rolls 2 dice
│ • 3 rounds per game
│ • Highest total score wins!
│ • 30 seconds per turn
│
│ ⏱️ 30 seconds to join
│ 👥 Type *join* to play!
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  }, { quoted: mek });
  
  setTimeout(async () => {
    const g = diceGames.get(from);
    if (!g || !g.joinPhase) return;
    
    g.joinPhase = false;
    
    if (g.players.length < 2) {
      diceGames.delete(from);
      return conn.sendMessage(from, {
        text: "❌ Dice game cancelled - need at least 2 players!"
      });
    }
    
    for (let i = g.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [g.players[i], g.players[j]] = [g.players[j], g.players[i]];
    }
    
    await startDiceRound(conn, from);
  }, 30000);
});

async function handleDiceJoin(conn, from, sender) {
  const game = diceGames.get(from);
  if (!game || !game.joinPhase) return;
  
  if (game.players.some(p => p.id === sender)) {
    await conn.sendMessage(from, {
      text: `⚠️ @${sender.split("@")[0]}, you already joined! (${game.players.length} players)`,
      mentions: [sender]
    });
    return;
  }
  
  game.players.push({ id: sender, score: 0, rolls: [] });
  await conn.sendMessage(from, {
    text: `✅ @${sender.split("@")[0]} joined the Dice Game! (${game.players.length} players)\n\n_Type "join" to join..._`,
    mentions: [sender]
  });
}

async function startDiceRound(conn, from) {
  const game = diceGames.get(from);
  if (!game) return;
  
  if (game.round > game.maxRounds) {
    await endDiceGame(conn, from);
    return;
  }
  
  const currentPlayer = game.players[game.currentIndex];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎲 *DICE GAME - Round ${game.round}/${game.maxRounds}*
├━━━━━━━━━━━━━━━┤
│ 🎮 @${currentPlayer.id.split("@")[0]}'s turn!
│
│ 🎯 Type *throw* to roll dice
│ ⏱️ 30 seconds
╰━━━━━━━━━━━━━━━╯`,
    mentions: [currentPlayer.id]
  });
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  game.turnTimeout = setTimeout(async () => {
    if (!diceGames.has(from)) return;
    
    await conn.sendMessage(from, {
      text: `⏰ @${currentPlayer.id.split("@")[0]} ran out of time! Rolling automatically...`,
      mentions: [currentPlayer.id]
    });
    
    await handleDiceRoll(conn, from, currentPlayer.id, true);
  }, 30000);
}

async function handleDiceRoll(conn, from, sender, auto = false) {
  const game = diceGames.get(from);
  if (!game || game.joinPhase) return false;
  
  const currentPlayer = game.players[game.currentIndex];
  if (!currentPlayer || currentPlayer.id !== sender) return false;
  
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
    game.turnTimeout = null;
  }
  
  const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
  const dice1 = Math.floor(Math.random() * 6) + 1;
  const dice2 = Math.floor(Math.random() * 6) + 1;
  const total = dice1 + dice2;
  
  currentPlayer.score += total;
  currentPlayer.rolls.push(total);
  
  const emoji1 = diceEmojis[dice1 - 1];
  const emoji2 = diceEmojis[dice2 - 1];
  
  let bonusText = "";
  if (dice1 === dice2) {
    bonusText = "\n│ 🎉 *DOUBLES!*";
  }
  if (total === 12) {
    bonusText = "\n│ 👑 *PERFECT ROLL!*";
  }
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎲 @${sender.split("@")[0]} rolled!
├━━━━━━━━━━━━━━━┤
│
│ ${emoji1} + ${emoji2} = *${total}*${bonusText}
│
│ 📊 Total Score: *${currentPlayer.score}*
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  });
  
  game.currentIndex++;
  if (game.currentIndex >= game.players.length) {
    game.currentIndex = 0;
    game.round++;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1500));
  await startDiceRound(conn, from);
  
  return true;
}

async function endDiceGame(conn, from) {
  const game = diceGames.get(from);
  if (!game) return;
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
  
  let scoresText = "";
  const mentions = [];
  
  sortedPlayers.forEach((p, i) => {
    mentions.push(p.id);
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▪️";
    const rolls = p.rolls.join(" + ") || "0";
    scoresText += `│ ${medal} @${p.id.split("@")[0]} → *${p.score}* (${rolls})\n`;
  });
  
  const winner = sortedPlayers[0];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎲 *DICE GAME - OVER!*
├━━━━━━━━━━━━━━━┤
│ 🏆 @${winner.id.split("@")[0]} WINS!
├━━━━━━━━━━━━━━━┤
│ 📊 *FINAL SCORES:*
${scoresText}╰━━━━━━━━━━━━━━━╯`,
    mentions
  });
  
  diceGames.delete(from);
}

cmd({
  pattern: "stopdice",
  alias: ["enddice", "stopdg"],
  desc: "Stop dice game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const game = diceGames.get(from);
  if (!game) return reply("❌ No dice game is running.");
  
  if (game.host !== sender) {
    return reply("❌ Only the host can stop the game!");
  }
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  await conn.sendMessage(from, {
    text: `🛑 Dice game stopped by @${sender.split("@")[0]}`,
    mentions: [sender]
  });
  
  diceGames.delete(from);
});

// ================= 8 BALL =================
const EIGHT_BALL_RESPONSES = [
  "It is certain ✅",
  "Without a doubt ✅",
  "Yes definitely ✅",
  "You may rely on it ✅",
  "As I see it, yes ✅",
  "Most likely ✅",
  "Outlook good ✅",
  "Yes ✅",
  "Signs point to yes ✅",
  "Reply hazy, try again 🔄",
  "Ask again later 🔄",
  "Better not tell you now 🔄",
  "Cannot predict now 🔄",
  "Concentrate and ask again 🔄",
  "Don't count on it ❌",
  "My reply is no ❌",
  "My sources say no ❌",
  "Outlook not so good ❌",
  "Very doubtful ❌"
];

cmd({
  pattern: "8ball",
  alias: ["eightball", "ask"],
  desc: "Ask the magic 8 ball",
  category: "games",
  use: ".8ball [question]",
  filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
  const question = args.join(" ");
  if (!question) {
    return reply("❓ Please ask a question!\n\nExample: .8ball Will I be rich?");
  }
  
  const answer = EIGHT_BALL_RESPONSES[Math.floor(Math.random() * EIGHT_BALL_RESPONSES.length)];
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🎱 *MAGIC 8 BALL*
├━━━━━━━━━━━━━━━┤
│
│ ❓ ${question}
│
│ 🎱 ${answer}
│
╰━━━━━━━━━━━━━━━╯`
  }, { quoted: mek });
});

// ================= GAMES MENU =================
cmd({
  pattern: "gamesmenu",
  alias: ["games", "gamehelp", "gamelist"],
  desc: "Show all available games",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, prefix }) => {
  const menuText = `╭━━━━━━━━━━━━━━━╮
│ 🎮 *GAMES MENU* 🎮
╰━━━━━━━━━━━━━━━╯

*🏆 MULTIPLAYER GAMES:*
┃ ${prefix}flaggame - Flag guessing
┃ ${prefix}triviagame - Trivia quiz
┃ ${prefix}guessword - Word guessing
┃ ${prefix}wordchain - Word chain
┃ ${prefix}dice - Dice game (MP)
┃ ${prefix}tictactoe - Tic Tac Toe

*🎯 QUICK GAMES:*
┃ ${prefix}rps - Rock Paper Scissors
┃ ${prefix}mathquiz - Math challenge
┃ ${prefix}emojiguess - Guess movie
┃ ${prefix}coinflip - Flip a coin
┃ ${prefix}roll - Roll dice
┃ ${prefix}8ball - Magic 8 ball

*🎭 PARTY GAMES:*
┃ ${prefix}truth - Truth question
┃ ${prefix}dare - Dare challenge
┃ ${prefix}tod - Random Truth or Dare
┃ ${prefix}wyr - Would You Rather

*📋 GAME CONTROLS:*
┃ ${prefix}stopflag - Stop flag game
┃ ${prefix}stoptrivia - Stop trivia
┃ ${prefix}stopguess - Stop word game
┃ ${prefix}stopchain - Stop word chain
┃ ${prefix}stopdice - Stop dice game
┃ ${prefix}stopemoji - Stop emoji game
┃ ${prefix}stopttt - End Tic Tac Toe

╰━━━━━━━━━━━━━━━╯`;

  await conn.sendMessage(from, {
    text: menuText
  }, { quoted: mek });
});

// ================= WORD CHAIN GAME =================
const wordChainGames = new Map();

// Validate word using dictionary API
async function isValidWord(word) {
  try {
    const response = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, {
      timeout: 5000
    });
    return response.status === 200 && Array.isArray(response.data) && response.data.length > 0;
  } catch (e) {
    // If API fails, use backup validation (basic check)
    return false;
  }
}

// Word Chain input handler
async function handleWordChainInput(conn, m, from, sender, text) {
  const game = wordChainGames.get(from);
  if (!game) return false;
  
  // Allow bot owner to play (don't skip fromMe)
  
  // JOIN PHASE
  if (game.joinPhase && text.toLowerCase() === "join") {
    if (game.players.some(p => p.id === sender)) {
      await conn.sendMessage(from, {
        text: `⚠️ @${sender.split("@")[0]}, you already joined! (${game.players.length} players)`,
        mentions: [sender]
      });
      return true;
    }
    
    game.players.push({ id: sender, score: 0 });
    await conn.sendMessage(from, {
      text: `✅ @${sender.split("@")[0]} joined the Word Chain! (${game.players.length} players)\n\n_Type "join" to join..._`,
      mentions: [sender]
    });
    return true;
  }
  
  if (game.joinPhase) return true;
  
  // GAME PHASE - Check if it's the current player's turn
  const currentPlayer = game.players[game.currentIndex];
  if (!currentPlayer || currentPlayer.id !== sender) return true;
  
  // Clear turn timer
  if (game.turnTimeout) {
    clearTimeout(game.turnTimeout);
    game.turnTimeout = null;
  }
  
  const word = text.toLowerCase().trim();
  
  // Validate word format (letters only, min 2 chars)
  if (!/^[a-z]{2,}$/.test(word)) {
    await conn.sendMessage(from, {
      text: `❌ Invalid! Words must be letters only (min 2 characters).`
    });
    startWordChainTimer(conn, from, game);
    return true;
  }
  
  // Check if word was already used
  if (game.usedWords.has(word)) {
    await conn.sendMessage(from, {
      text: `❌ *"${word}"* was already used! Try another word.\n\n📝 Used: ${game.usedWords.size} words`
    });
    startWordChainTimer(conn, from, game);
    return true;
  }
  
  // Check chain rule (must start with last letter of previous word)
  if (game.lastWord) {
    const requiredLetter = game.lastWord.slice(-1);
    if (word[0] !== requiredLetter) {
      await conn.sendMessage(from, {
        text: `❌ Word must start with *"${requiredLetter.toUpperCase()}"*!\n\nLast word: *${game.lastWord}*`
      });
      startWordChainTimer(conn, from, game);
      return true;
    }
  }
  
  // Validate word using dictionary API
  const isValid = await isValidWord(word);
  if (!isValid) {
    await conn.sendMessage(from, {
      text: `❌ *"${word}"* is not a valid English word! Try again.`
    });
    startWordChainTimer(conn, from, game);
    return true;
  }
  
  // Word is valid! Add to used words and update game state
  game.usedWords.add(word);
  game.lastWord = word;
  currentPlayer.score += word.length; // Score = word length
  game.chainLength++;
  
  // Move to next player
  game.currentIndex = (game.currentIndex + 1) % game.players.length;
  const nextPlayer = game.players[game.currentIndex];
  const nextLetter = word.slice(-1).toUpperCase();
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN*
├━━━━━━━━━━━━━━━┤
│ ✅ @${sender.split("@")[0]}: *${word}*
│ 📊 +${word.length} pts (Total: ${currentPlayer.score})
├━━━━━━━━━━━━━━━┤
│ 🔤 Next letter: *${nextLetter}*
│ 🎮 @${nextPlayer.id.split("@")[0]}'s turn
│ ⏱️ 30 seconds
│ 📝 Chain: ${game.chainLength} words
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender, nextPlayer.id]
  });
  
  // Start timer for next player
  startWordChainTimer(conn, from, game);
  
  return true;
}

function startWordChainTimer(conn, from, game) {
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  game.turnTimeout = setTimeout(async () => {
    if (!wordChainGames.has(from)) return;
    
    const timedOutPlayer = game.players[game.currentIndex];
    
    // End game - player ran out of time
    await endWordChainGame(conn, from, timedOutPlayer, "timeout");
  }, 30000);
}

async function endWordChainGame(conn, from, loser, reason) {
  const game = wordChainGames.get(from);
  if (!game) return;
  
  if (game.turnTimeout) clearTimeout(game.turnTimeout);
  
  // Sort players by score
  const sortedPlayers = [...game.players].sort((a, b) => b.score - a.score);
  
  let scoresText = "";
  const mentions = [];
  
  sortedPlayers.forEach((p, i) => {
    mentions.push(p.id);
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "▪️";
    scoresText += `${medal} @${p.id.split("@")[0]} → ${p.score} pts\n`;
  });
  
  let reasonText = "";
  if (reason === "timeout") {
    reasonText = `⏰ @${loser.id.split("@")[0]} ran out of time!`;
    mentions.push(loser.id);
  } else if (reason === "stopped") {
    reasonText = `🛑 Game stopped by host`;
  }
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN - GAME OVER*
├━━━━━━━━━━━━━━━┤
│ ${reasonText}
├━━━━━━━━━━━━━━━┤
│ 📊 *FINAL SCORES:*
${scoresText}
│ 📝 Total chain: ${game.chainLength} words
│ 🔤 Words used: ${game.usedWords.size}
╰━━━━━━━━━━━━━━━╯`,
    mentions
  });
  
  wordChainGames.delete(from);
}

// Word Chain Commands
cmd({
  pattern: "wordchain",
  alias: ["wchain", "chainword"],
  desc: "Start Word Chain game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, isGroup, sender, reply }) => {
  if (!isGroup) return reply("❌ Word Chain can only be played in groups!");
  if (wordChainGames.has(from)) return reply("⚠️ A Word Chain game is already running! Use .stopchain to end it.");
  
  const game = {
    host: sender,
    players: [{ id: sender, score: 0 }],
    usedWords: new Set(),
    lastWord: null,
    currentIndex: 0,
    chainLength: 0,
    joinPhase: true,
    turnTimeout: null
  };
  
  wordChainGames.set(from, game);
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN*
├━━━━━━━━━━━━━━━┤
│ @${sender.split("@")[0]} started a game!
│
│ 📜 *RULES:*
│ • Say a word starting with
│   the last letter of the
│   previous word
│ • No repeated words
│ • Must be real English words
│ • 30 seconds per turn
│ • Score = word length
│
│ ⏱️ 30 seconds to join
│ 👥 Type *join* to play!
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  }, { quoted: mek });
  
  // Join phase timer (30 seconds)
  setTimeout(async () => {
    const g = wordChainGames.get(from);
    if (!g || !g.joinPhase) return;
    
    g.joinPhase = false;
    
    if (g.players.length < 2) {
      wordChainGames.delete(from);
      return conn.sendMessage(from, {
        text: "❌ Word Chain cancelled - need at least 2 players!"
      });
    }
    
    // Shuffle players for random order
    for (let i = g.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [g.players[i], g.players[j]] = [g.players[j], g.players[i]];
    }
    
    const firstPlayer = g.players[0];
    const playerList = g.players.map((p, i) => `${i + 1}. @${p.id.split("@")[0]}`).join("\n");
    
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ 🔗 *WORD CHAIN STARTS!*
├━━━━━━━━━━━━━━━┤
│ 👥 *Players:*
${playerList}
├━━━━━━━━━━━━━━━┤
│ 🎮 @${firstPlayer.id.split("@")[0]} goes first!
│ 🔤 Start with ANY word
│ ⏱️ 30 seconds
╰━━━━━━━━━━━━━━━╯`,
      mentions: g.players.map(p => p.id)
    });
    
    // Start turn timer
    startWordChainTimer(conn, from, g);
  }, 30000);
});

cmd({
  pattern: "stopchain",
  alias: ["endchain", "stopwordchain"],
  desc: "Stop Word Chain game",
  category: "games",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply }) => {
  const game = wordChainGames.get(from);
  if (!game) return reply("❌ No Word Chain game is running.");
  
  if (game.host !== sender) {
    return reply("❌ Only the host can stop the game!");
  }
  
  await endWordChainGame(conn, from, null, "stopped");
});

// Update the body handler to include Word Chain and AI games
cmd({
  on: "body",
  dontAddCommandList: true
}, async (conn, mek, m, { from, sender, body }) => {
  try {
    if (!from || !sender) return;
    const text = (body || "").trim();
    
    // Skip bot's own formatted response messages
    if (text.includes("╭") || text.includes("│") || text.includes("╰") || 
        text.includes("┃") || text.includes("├") || text.includes("┄") ||
        text.startsWith("❌") || text.startsWith("✅") || text.startsWith("⏰") ||
        text.split("\n").length > 2) {
      return;
    }
    
    // Check for Word Chain game
    if (wordChainGames.has(from)) {
      await handleWordChainInput(conn, mek, from, sender, text);
    }
    
    // Check for TTT AI game
    const tttAiKey = from + sender;
    if (tttAiGames.has(tttAiKey)) {
      const move = parseInt(text);
      if (move >= 1 && move <= 9) {
        await handleTttAiMove(conn, from, sender, move - 1);
      }
    }
    
    // Check for Word Chain AI game
    if (wordChainAiGames.has(tttAiKey)) {
      await handleWordChainAiInput(conn, mek, from, sender, text);
    }
  } catch (e) {
    // Silent error handling
  }
});

// Handle TTT AI moves
async function handleTttAiMove(conn, from, sender, pos) {
  const key = from + sender;
  const game = tttAiGames.get(key);
  if (!game || game.turn !== "player") return;
  
  if (game.board[pos] !== null) {
    await conn.sendMessage(from, { text: "❌ That position is already taken! Choose another (1-9)." });
    return;
  }
  
  game.board[pos] = game.playerSymbol;
  
  let winner = tttAiCheckWinner(game.board);
  if (winner) {
    tttAiGames.delete(key);
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🏆 *YOU WIN!* 🎉
│ Congratulations @${sender.split("@")[0]}!
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    return;
  }
  
  if (!game.board.includes(null)) {
    tttAiGames.delete(key);
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🤝 *IT'S A DRAW!*
│ Good game @${sender.split("@")[0]}!
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    return;
  }
  
  const aiMove = tttAiGetBestMove(game.board);
  game.board[aiMove] = game.aiSymbol;
  
  winner = tttAiCheckWinner(game.board);
  if (winner) {
    tttAiGames.delete(key);
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🤖 *AI WINS!*
│ Better luck next time @${sender.split("@")[0]}!
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    return;
  }
  
  if (!game.board.includes(null)) {
    tttAiGames.delete(key);
    await conn.sendMessage(from, {
      text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🤝 *IT'S A DRAW!*
│ Good game @${sender.split("@")[0]}!
╰━━━━━━━━━━━━━━━╯`,
      mentions: [sender]
    });
    return;
  }
  
  await conn.sendMessage(from, {
    text: `╭━━━━━━━━━━━━━━━╮
│ ⭕❌ *TIC-TAC-TOE vs AI* ❌⭕
├━━━━━━━━━━━━━━━┤
${tttAiFormatBoard(game.board)}
├━━━━━━━━━━━━━━━┤
│ 🎮 Your turn @${sender.split("@")[0]}!
│ ⏱️ Reply with 1-9 to play
╰━━━━━━━━━━━━━━━╯`,
    mentions: [sender]
  });
}

module.exports = {
  triviaGames,
  handleTriviaInput,
  flagGames,
  handleFlagInput,
  guessGames,
  handleGuessInput,
  mathGames,
  emojiGames,
  wordChainGames,
  handleWordChainInput,
  tttAiGames,
  wordChainAiGames,
  diceGames,
  handleDiceJoin,
  handleDiceRoll
};
