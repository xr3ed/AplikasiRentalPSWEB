const { getInstance } = require('../database');

function addAppVersionColumn() {
    const db = getInstance();
    
    try {
        // Check if column already exists
        const tableInfo = db.prepare("PRAGMA table_info(tvs)").all();
        const hasAppVersionColumn = Array.isArray(tableInfo) && tableInfo.some(column => column.name === 'app_version');
        
        if (!hasAppVersionColumn) {
            console.log('📱 Adding app_version column to tvs table...');

            try {
                // Add app_version column
                db.exec(`
                    ALTER TABLE tvs
                    ADD COLUMN app_version TEXT DEFAULT NULL
                `);

                console.log('✅ app_version column added successfully');
            } catch (error) {
                if (error.message.includes('duplicate column name')) {
                    console.log('📱 app_version column already exists (caught duplicate error)');
                } else {
                    throw error;
                }
            }
        } else {
            console.log('📱 app_version column already exists');
        }
        
    } catch (error) {
        console.error('❌ Error adding app_version column:', error.message);
        throw error;
    }
}

module.exports = { addAppVersionColumn };
