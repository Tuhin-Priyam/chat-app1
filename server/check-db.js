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
    console.log("--- USERS ---");
    db.all("SELECT * FROM users", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });

    console.log("\n--- MESSAGES ---");
    db.all("SELECT * FROM messages", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });
});
