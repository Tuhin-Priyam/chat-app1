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
            time TEXT NOT NULL,
            status TEXT DEFAULT 'sent',
            read_at TEXT
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
        const query = `INSERT INTO messages (room, author, message, time, type, status) VALUES (?, ?, ?, ?, ?, 'sent')`;
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

// NEW: Get recent chats for a user (distinct rooms)
function getRecentChats(phone) {
    return new Promise((resolve, reject) => {
        // Find rooms where phone is part of the room ID (e.g. phone_other or other_phone)
        // Since room ID is simplistic (phone_phone), we can check LIKE pattern
        // This is a naive implementation but works for this scope.
        // We need to fetch the LAST message for each such room.
        const query = `
            SELECT m.*, 
            MAX(m.id) as last_msg_id
            FROM messages m 
            WHERE m.room LIKE ? OR m.room LIKE ?
            GROUP BY m.room
            ORDER BY m.id DESC
        `;
        const pattern1 = `${phone}_%`;
        const pattern2 = `%_${phone}`;

        db.all(query, [pattern1, pattern2], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// NEW: Mark messages as read
function markMessagesRead(room, readerPhone) {
    return new Promise((resolve, reject) => {
        // Update all messages in this room that were NOT authored by readerPhone
        // and are not yet 'read'
        const time = new Date().toISOString();
        const query = `UPDATE messages SET status = 'read', read_at = ? WHERE room = ? AND author != (SELECT username FROM users WHERE phone = ?) AND status != 'read'`;

        // Wait, author in messages is username (display name). 
        // We need to be careful. The current saveMessage stores 'author' as username.
        // But we want to exclude messages sent by ME (the reader).
        // Best way: pass the reader's USERNAME to this function if possible, or look it up.
        // For efficiency, let's assume we pass readerUsername.
        // But the signature I planned was (room, userPhone). 
        // Let's change the signature to accept readerUsername instead, or handle it.
        // Actually, let's just update all messages where author != 'readerUsername'.
        // To do that, I need readerUsername.
        // I will update the function signature below.
        // Or I can subquery: AND author != (SELECT username FROM users WHERE phone = ?)

        db.run(query, [time, room, readerPhone], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// NEW: Update user avatar
function updateUserAvatar(phone, avatarPath) {
    return new Promise((resolve, reject) => {
        const query = `UPDATE users SET avatar = ? WHERE phone = ?`;
        db.run(query, [avatarPath, phone], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
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
    getRecentChats,
    markMessagesRead,
    createUser,
    verifyUser,
    updateUserAvatar,
    deleteMessage,
    resetRoom
};
