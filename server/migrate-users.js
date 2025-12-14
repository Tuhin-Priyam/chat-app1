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
    console.log("Updating users table schema...");
    db.run("ALTER TABLE users ADD COLUMN avatar TEXT", (err) => {
        if (err && !err.message.includes("duplicate column")) console.error("Error adding avatar column:", err.message);
        else console.log("Added avatar column.");
    });
});
