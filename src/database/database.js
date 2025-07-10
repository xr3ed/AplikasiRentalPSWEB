const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/billing.db');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const init = () => {
  // Users table (admin & operator)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      permissions TEXT DEFAULT '[]',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // TVs table
  db.run(`
    CREATE TABLE IF NOT EXISTS tvs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tv_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      ip_address TEXT,
      status TEXT DEFAULT 'offline',
      is_paired INTEGER DEFAULT 0,
      pairing_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME
    )
  `);

  // Members table
  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Packages table
  db.run(`
    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price DECIMAL(10,2) DEFAULT 0,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Member packages (paket yang dimiliki member)
  db.run(`
    CREATE TABLE IF NOT EXISTS member_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER NOT NULL,
      package_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members (id),
      FOREIGN KEY (package_id) REFERENCES packages (id)
    )
  `);

  // Sessions table
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tv_id TEXT NOT NULL,
      member_id INTEGER,
      package_id INTEGER,
      duration_minutes INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME,
      status TEXT DEFAULT 'active',
      created_by TEXT,
      notes TEXT,
      FOREIGN KEY (member_id) REFERENCES members (id),
      FOREIGN KEY (package_id) REFERENCES packages (id)
    )
  `);

  // WhatsApp messages log
  db.run(`
    CREATE TABLE IF NOT EXISTS wa_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'incoming',
      processed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Insert default admin user
  db.run(`
    INSERT OR IGNORE INTO users (username, password, role, permissions) 
    VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', '[]')
  `, (err) => {
    if (err) {
      console.log('Admin user already exists');
    } else {
      console.log('✅ Default admin user created (admin/ikbal)');
    }
  });

  // Insert default packages
  const defaultPackages = [
    { name: '1 Jam', duration: 60, price: 5000, description: 'Paket 1 jam bermain' },
    { name: '2 Jam', duration: 120, price: 9000, description: 'Paket 2 jam bermain' },
    { name: '3 Jam', duration: 180, price: 13000, description: 'Paket 3 jam bermain' },
    { name: '5 Jam', duration: 300, price: 20000, description: 'Paket 5 jam bermain' },
    { name: 'Overnight', duration: 480, price: 30000, description: 'Paket overnight 8 jam' }
  ];

  defaultPackages.forEach(pkg => {
    db.run(`
      INSERT OR IGNORE INTO packages (name, duration_minutes, price, description) 
      VALUES (?, ?, ?, ?)
    `, [pkg.name, pkg.duration, pkg.price, pkg.description]);
  });

  console.log('✅ Database initialized successfully');
};

module.exports = {
  db,
  init
};