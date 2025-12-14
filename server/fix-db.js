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
    console.log("Dropping users table...");
    db.run("DROP TABLE IF EXISTS users", (err) => {
        if (err) console.error("Error dropping table:", err);
    });

    console.log("Recreating users table...");
    // Schema matches database.js
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `, (err) => {
        if (err) console.error("Error creating table:", err);
        else console.log("Users table recreated successfully.");
    });
});
