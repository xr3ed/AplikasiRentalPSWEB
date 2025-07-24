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
                current_package_id INTEGER,
                notification_sent BOOLEAN DEFAULT 0,
                FOREIGN KEY (current_member_id) REFERENCES members(id) ON DELETE SET NULL,
                FOREIGN KEY (active_member_package_id) REFERENCES member_packages(id) ON DELETE SET NULL
            )`);

            // Add current_package_id column to tvs table if it doesn't exist
            db.all("PRAGMA table_info(tvs)", (err, columns) => {
                if (err) {
                    console.error("Error checking table info for tvs:", err.message);
                    return;
                }
                const columnExists = columns.some(col => col.name === 'current_package_id');
                if (!columnExists) {
                    db.run("ALTER TABLE tvs ADD COLUMN current_package_id INTEGER", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding column 'current_package_id' to tvs:", alterErr.message);
                        }
                    });
                }
            });

            db.run(`CREATE TABLE IF NOT EXISTS members (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone_number TEXT NOT NULL UNIQUE,
                status TEXT DEFAULT 'tidak aktif',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Add created_at and status columns to members table if they don't exist
            db.all("PRAGMA table_info(members)", (err, columns) => {
                if (err) {
                    console.error("Error checking table info for members:", err.message);
                    return;
                }

                const createdAtExists = columns.some(col => col.name === 'created_at');
                const statusExists = columns.some(col => col.name === 'status');

                if (!createdAtExists) {
                    db.run("ALTER TABLE members ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding column 'created_at' to members:", alterErr.message);
                        } else {
                            console.log("Added 'created_at' column to members table");
                        }
                    });
                }

                if (!statusExists) {
                    db.run("ALTER TABLE members ADD COLUMN status TEXT DEFAULT 'tidak aktif'", (alterErr) => {
                        if (alterErr) {
                            console.error("Error adding column 'status' to members:", alterErr.message);
                        } else {
                            console.log("Added 'status' column to members table");
                        }
                    });
                }
            });

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
                status TEXT DEFAULT 'pending', -- 'pending', 'paid', 'failed', 'cancelled'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tv_id) REFERENCES tvs(id),
                FOREIGN KEY (member_id) REFERENCES members(id),
                FOREIGN KEY (package_id) REFERENCES packages(id)
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS tv_login_codes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tv_id INTEGER NOT NULL,
                code TEXT NOT NULL UNIQUE,
                used BOOLEAN DEFAULT 0,
                used_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (tv_id) REFERENCES tvs(id) ON DELETE CASCADE
            )`);

            // Create tv_locks table for conditional lock system
            db.run(`CREATE TABLE IF NOT EXISTS tv_locks (
                tv_id INTEGER PRIMARY KEY,
                user_phone TEXT NOT NULL,
                locked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                reason TEXT DEFAULT 'user_scan',
                FOREIGN KEY (tv_id) REFERENCES tvs(id) ON DELETE CASCADE
            )`);

            // Migration: Add 'status' column to transactions table if it doesn't exist
            db.all("PRAGMA table_info(transactions)", (err, columns) => {
                if (err) {
                    console.error('Error checking transactions table schema:', err);
                    return;
                }

                const hasStatusColumn = columns.some(col => col.name === 'status');
                if (!hasStatusColumn) {
                    db.run("ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'pending'", (err) => {
                        if (err) {
                            console.error('Error adding status column to transactions table:', err);
                        } else {
                            console.log("Added 'status' column to transactions table");
                        }
                    });
                }
            });

            // Migration: Add 'used', 'used_at', and 'notified' columns to tv_login_codes table if they don't exist
            db.all("PRAGMA table_info(tv_login_codes)", (err, columns) => {
                if (err) {
                    console.error('Error checking tv_login_codes table schema:', err);
                    return;
                }

                const hasUsedColumn = columns.some(col => col.name === 'used');
                const hasUsedAtColumn = columns.some(col => col.name === 'used_at');
                const hasNotifiedColumn = columns.some(col => col.name === 'notified');

                if (!hasUsedColumn) {
                    db.run("ALTER TABLE tv_login_codes ADD COLUMN used BOOLEAN DEFAULT 0", (err) => {
                        if (err) {
                            console.error('Error adding used column to tv_login_codes table:', err);
                        } else {
                            console.log("Added 'used' column to tv_login_codes table");
                        }
                    });
                }

                if (!hasUsedAtColumn) {
                    db.run("ALTER TABLE tv_login_codes ADD COLUMN used_at DATETIME", (err) => {
                        if (err) {
                            console.error('Error adding used_at column to tv_login_codes table:', err);
                        } else {
                            console.log("Added 'used_at' column to tv_login_codes table");
                        }
                    });
                }

                if (!hasNotifiedColumn) {
                    db.run("ALTER TABLE tv_login_codes ADD COLUMN notified BOOLEAN DEFAULT 0", (err) => {
                        if (err) {
                            console.error('Error adding notified column to tv_login_codes table:', err);
                        } else {
                            console.log("Added 'notified' column to tv_login_codes table");
                        }
                    });
                }
            });

            // Migration: Add TV monitoring columns
            const tvMonitoringMigration = require('./migrations/001_add_tv_monitoring_columns');
            tvMonitoringMigration.up(db).catch(err => {
                console.error('TV monitoring migration failed:', err);
            });

            // Migration: Add app_version column (disabled - column already exists)
            // try {
            //     const { addAppVersionColumn } = require('./migrations/add_app_version_column');
            //     addAppVersionColumn();
            // } catch (err) {
            //     console.error('App version migration failed:', err);
            // }
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