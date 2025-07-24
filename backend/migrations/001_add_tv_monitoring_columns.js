/**
 * Migration: Add TV Monitoring Columns
 * Adds comprehensive monitoring columns to the tvs table for real-time status tracking
 */

const sqlite3 = require('sqlite3').verbose();

const addTvMonitoringColumns = (db) => {
    return new Promise((resolve, reject) => {
        console.log('Starting TV monitoring columns migration...');
        
        // Check existing columns first
        db.all("PRAGMA table_info(tvs)", (err, columns) => {
            if (err) {
                console.error("Error checking tvs table schema:", err.message);
                return reject(err);
            }

            const existingColumns = columns.map(col => col.name);
            const columnsToAdd = [
                {
                    name: 'monitoring_status',
                    definition: 'TEXT DEFAULT "unknown"',
                    description: 'Current monitoring status: active, disconnected, offline, recovering, error'
                },
                {
                    name: 'last_ping_time',
                    definition: 'DATETIME',
                    description: 'Last successful network ping timestamp'
                },
                {
                    name: 'last_heartbeat_time',
                    definition: 'DATETIME',
                    description: 'Last heartbeat from helper app'
                },
                {
                    name: 'process_status',
                    definition: 'TEXT DEFAULT "unknown"',
                    description: 'Helper app process status: running, stopped, crashed'
                },
                {
                    name: 'auto_recovery_attempts',
                    definition: 'INTEGER DEFAULT 0',
                    description: 'Number of auto-recovery attempts in current window'
                },
                {
                    name: 'last_recovery_time',
                    definition: 'DATETIME',
                    description: 'Last auto-recovery attempt timestamp'
                },
                {
                    name: 'network_latency_ms',
                    definition: 'INTEGER',
                    description: 'Network ping latency in milliseconds'
                },
                {
                    name: 'socket_connection_id',
                    definition: 'TEXT',
                    description: 'Current Socket.IO connection ID from helper app'
                },
                {
                    name: 'monitoring_enabled',
                    definition: 'BOOLEAN DEFAULT 1',
                    description: 'Whether monitoring is enabled for this TV'
                }
            ];

            let addedColumns = 0;
            let totalColumns = columnsToAdd.length;

            const addNextColumn = (index) => {
                if (index >= totalColumns) {
                    console.log(`TV monitoring migration completed. Added ${addedColumns} new columns.`);
                    return resolve(addedColumns);
                }

                const column = columnsToAdd[index];
                
                if (existingColumns.includes(column.name)) {
                    console.log(`Column '${column.name}' already exists, skipping...`);
                    addNextColumn(index + 1);
                    return;
                }

                const sql = `ALTER TABLE tvs ADD COLUMN ${column.name} ${column.definition}`;
                
                db.run(sql, (alterErr) => {
                    if (alterErr) {
                        console.error(`Error adding column '${column.name}':`, alterErr.message);
                        return reject(alterErr);
                    }
                    
                    console.log(`✓ Added column '${column.name}' - ${column.description}`);
                    addedColumns++;
                    addNextColumn(index + 1);
                });
            };

            addNextColumn(0);
        });
    });
};

const rollbackTvMonitoringColumns = (db) => {
    return new Promise((resolve, reject) => {
        console.log('Rolling back TV monitoring columns...');
        
        // SQLite doesn't support DROP COLUMN directly, so we'd need to recreate the table
        // For now, we'll just log the rollback attempt
        console.log('Rollback not implemented for SQLite. Manual intervention required.');
        resolve();
    });
};

// Export for use in other scripts
module.exports = {
    up: addTvMonitoringColumns,
    down: rollbackTvMonitoringColumns
};

// If run directly, execute the migration
if (require.main === module) {
    const { getInstance } = require('../database');
    const db = getInstance();
    
    addTvMonitoringColumns(db)
        .then((addedColumns) => {
            console.log(`Migration completed successfully. Added ${addedColumns} columns.`);
            process.exit(0);
        })
        .catch((error) => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}
