/**
 * Script to run TV monitoring migration
 */

const path = require('path');
const fs = require('fs');

// Import migration
const migration = require('../migrations/001_add_tv_monitoring_columns');

console.log('🔄 Starting TV Monitoring Migration...');

const dbPath = path.join(__dirname, '..', 'database.db');
const migrationPath = path.join(__dirname, '..', 'migrations', 'add_tv_monitoring_columns.sql');

console.log('Database:', dbPath);
console.log('Migration:', migrationPath);

// Check if database exists
if (!fs.existsSync(dbPath)) {
    console.log('❌ Database file not found:', dbPath);
    console.log('💡 Please start the server first to create the database');
    process.exit(1);
}

// Run migration
migration.up(require('../database').getInstance())
    .then((addedColumns) => {
        console.log(`✅ Migration completed successfully. Added ${addedColumns} columns.`);
        process.exit(0);
    })
    .catch((error) => {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    });
