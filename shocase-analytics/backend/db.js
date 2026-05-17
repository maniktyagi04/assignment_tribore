const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data/ directory exists next to this file
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'events.db');
const db = new Database(dbPath);

// Create the events table if it doesn't exist yet
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    demo_id     TEXT    NOT NULL,
    viewer_id   TEXT    NOT NULL,
    event_type  TEXT    NOT NULL,
    timestamp   TEXT    NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
