const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log("Updating messages table schema...");

    // Add status column
    db.run("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'", (err) => {
        if (err && !err.message.includes("duplicate column")) console.error("Error adding status column:", err.message);
        else console.log("Added status column.");
    });

    // Add read_at column
    db.run("ALTER TABLE messages ADD COLUMN read_at TEXT", (err) => {
        if (err && !err.message.includes("duplicate column")) console.error("Error adding read_at column:", err.message);
        else console.log("Added read_at column.");
    });
});
