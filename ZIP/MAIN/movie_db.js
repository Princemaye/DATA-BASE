const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "movie-db.json");

// 🔹 Load DB
function loadDB() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(
      dbPath,
      JSON.stringify({ id: 1, is_download: false, name: "", time: "" }, null, 2)
    );
  }
  return JSON.parse(fs.readFileSync(dbPath, "utf-8"));
}

// 🔹 Save DB
function saveDB(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// 🔹 Insert / Update movie
async function inputMovie(is_download, name, time) {
  let db = loadDB();
  db = { id: 1, is_download, name, time };
  saveDB(db);
  return db;
}

// 🔹 Get movie
async function getMovie() {
  const db = loadDB();
  if (!db || db.id !== 1) return false;
  return db;
}

// 🔹 Reset movie
async function resetMovie() {
  const defaultData = { id: 1, is_download: false, name: "", time: "" };
  saveDB(defaultData);
  return defaultData;
}

module.exports = { inputMovie, getMovie, resetMovie };
