const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database
const dbPath = path.resolve(__dirname, 'chat.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Could not connect to database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Initialize database table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            author TEXT NOT NULL,
            message TEXT NOT NULL,
            time TEXT NOT NULL
        )
    `);
});

// Save a message to the database
function saveMessage(data) {
    return new Promise((resolve, reject) => {
        const { room, author, message, time } = data;
        const query = `INSERT INTO messages (room, author, message, time) VALUES (?, ?, ?, ?)`;
        db.run(query, [room, author, message, time], function (err) {
            if (err) {
                console.error('Error saving message:', err);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

// Get messages for a specific room
function getMessagesForRoom(room) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM messages WHERE room = ? ORDER BY id ASC`;
        db.all(query, [room], (err, rows) => {
            if (err) {
                console.error('Error retrieving messages:', err);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

module.exports = {
    saveMessage,
    getMessagesForRoom
};
