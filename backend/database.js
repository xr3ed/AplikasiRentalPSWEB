require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();

const DBSOURCE = process.env.DB_FILE || "db.sqlite";

let db = null;

const initDatabase = () => {
    if (db) return db;

    db = new sqlite3.Database(DBSOURCE, (err) => {
    if (err) {
        // Cannot open database
        console.error(err.message);
        throw err;
    } else {
        console.log('Connected to the SQLite database.');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS tvs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                ip_address TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'inactive',
                session_start_time DATETIME,
                session_end_time DATETIME,
                current_member_id INTEGER,
                active_member_package_id INTEGER,
                notification_sent BOOLEAN DEFAULT 0,
                FOREIGN KEY (current_member_id) REFERENCES members(id) ON DELETE SET NULL,
                FOREIGN KEY (active_member_package_id) REFERENCES member_packages(id) ON DELETE SET NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone_number TEXT NOT NULL UNIQUE
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                price REAL NOT NULL
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS roles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE
            )`, (err) => {
                if (!err) {
                    // Seed roles
                    db.run(`INSERT OR IGNORE INTO roles (name) VALUES ('admin'), ('operator')`);
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role_id INTEGER NOT NULL,
                FOREIGN KEY (role_id) REFERENCES roles(id)
            )`, (err) => {
                if (!err) {
                    // Seed default admin user
                    const bcrypt = require('bcryptjs');
                    const salt = bcrypt.genSaltSync(10);
                    const adminPassword = bcrypt.hashSync('ikbal', salt);
                    db.run(`INSERT OR IGNORE INTO users (username, password_hash, role_id) VALUES (?, ?, (SELECT id FROM roles WHERE name = 'admin'))`, ['admin', adminPassword]);
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS member_packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                member_id INTEGER NOT NULL,
                package_id INTEGER NOT NULL,
                remaining_minutes INTEGER NOT NULL,
                purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (member_id) REFERENCES members(id),
                FOREIGN KEY (package_id) REFERENCES packages(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL, -- 'session_regular', 'session_member', 'package_purchase'
                tv_id INTEGER,
                member_id INTEGER,
                package_id INTEGER,
                duration_minutes INTEGER,
                amount INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tv_id) REFERENCES tvs(id),
                FOREIGN KEY (member_id) REFERENCES members(id),
                FOREIGN KEY (package_id) REFERENCES packages(id)
            )`);
        });
    }
    });
};

module.exports = {
    getInstance: () => {
        if (!db) {
            initDatabase();
        }
        return db;
    },
    initDatabase
};