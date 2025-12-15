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
            room TEXT,
            author TEXT,
            message TEXT,
            type TEXT,
            time TEXT,
            status TEXT DEFAULT 'sent',
            avatar TEXT
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT
        )
    `);
    db.run(`
        CREATE TABLE IF NOT EXISTS subscriptions (
            phone TEXT PRIMARY KEY,
            subscription TEXT
        )
    `);
    console.log("Database initialized.");
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

// Get recent chats for a user (distinct rooms)
function getRecentChats(phone) {
    return new Promise((resolve, reject) => {
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

// Mark messages as read
function markMessagesRead(room, readerPhone) {
    return new Promise((resolve, reject) => {
        const time = new Date().toISOString();
        // Update messages in this room that are NOT from the reader
        const query = `UPDATE messages SET status = 'read', read_at = ? WHERE room = ? AND author != (SELECT username FROM users WHERE phone = ?) AND status != 'read'`;

        db.run(query, [time, room, readerPhone], function (err) {
            if (err) reject(err);
            else resolve(this.changes);
        });
    });
}

// Update user avatar
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
                    reject(err);
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
                resolve(row);
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

// --- Subscription Helpers ---
const saveSubscription = (phone, subscription) => {
    return new Promise((resolve, reject) => {
        const subStr = JSON.stringify(subscription);
        db.run(
            `INSERT INTO subscriptions (phone, subscription) VALUES (?, ?) 
             ON CONFLICT(phone) DO UPDATE SET subscription = excluded.subscription`,
            [phone, subStr],
            (err) => {
                if (err) reject(err);
                else resolve();
            }
        );
    });
};

const getSubscription = (phone) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT subscription FROM subscriptions WHERE phone = ?", [phone], (err, row) => {
            if (err) reject(err);
            else resolve(row ? JSON.parse(row.subscription) : null);
        });
    });
};


module.exports = {
    saveMessage,
    getMessagesForRoom,
    createUser,
    verifyUser,
    deleteMessage,
    resetRoom,
    getRecentChats,
    markMessagesRead,
    updateUserAvatar,
    saveSubscription,
    getSubscription
};
