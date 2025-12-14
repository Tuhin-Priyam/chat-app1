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

const bcrypt = require('bcryptjs');

// Initialize database table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            author TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT DEFAULT 'text',
            time TEXT NOT NULL
        )
    `);
    // Added phone column, removed unique constraint from username, made phone unique and required
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);
});

// Save a message to the database
function saveMessage(data) {
    return new Promise((resolve, reject) => {
        const { room, author, message, time, type = 'text' } = data;
        const query = `INSERT INTO messages (room, author, message, time, type) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [room, author, message, time, type], function (err) {
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

// User Management
function createUser(username, phone, password) {
    return new Promise(async (resolve, reject) => {
        try {
            const hash = await bcrypt.hash(password, 10);
            const query = `INSERT INTO users (username, phone, password) VALUES (?, ?, ?)`;
            db.run(query, [username, phone, hash], function (err) {
                if (err) {
                    reject(err); // Likely unique constraint violation on phone
                } else {
                    resolve(this.lastID);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
}

function verifyUser(phone, password) {
    return new Promise((resolve, reject) => {
        const query = `SELECT * FROM users WHERE phone = ?`;
        db.get(query, [phone], async (err, row) => {
            if (err) reject(err);
            if (!row) return resolve(false);

            const match = await bcrypt.compare(password, row.password);
            if (match) {
                resolve(row); // Return user object on success
            } else {
                resolve(false);
            }
        });
    });
}

// Message Controls
function deleteMessage(id) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM messages WHERE id = ?`, [id], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

function resetRoom(room) {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM messages WHERE room = ?`, [room], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

module.exports = {
    saveMessage,
    getMessagesForRoom,
    createUser,
    verifyUser,
    deleteMessage,
    resetRoom
};
