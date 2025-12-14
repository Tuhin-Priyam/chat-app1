const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    }
});

db.serialize(() => {
    db.all("PRAGMA table_info(users)", (err, rows) => {
        if (err) console.error(err);
        else console.table(rows);
    });
});
