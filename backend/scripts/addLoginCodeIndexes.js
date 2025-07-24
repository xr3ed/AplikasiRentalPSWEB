const { initDatabase } = require('../database');

console.log('🔧 Adding performance indexes for tv_login_codes table...\n');

// Initialize database first
initDatabase();
const db = require('../database').getInstance();

// Wait for database initialization
setTimeout(() => {
    // Add indexes for better query performance
    const indexes = [
        {
            name: 'idx_tv_login_codes_tv_id_created',
            sql: 'CREATE INDEX IF NOT EXISTS idx_tv_login_codes_tv_id_created ON tv_login_codes(tv_id, created_at DESC)'
        },
        {
            name: 'idx_tv_login_codes_created_used',
            sql: 'CREATE INDEX IF NOT EXISTS idx_tv_login_codes_created_used ON tv_login_codes(created_at, used)'
        },
        {
            name: 'idx_tv_login_codes_code_used',
            sql: 'CREATE INDEX IF NOT EXISTS idx_tv_login_codes_code_used ON tv_login_codes(code, used)'
        }
    ];

    let completed = 0;

    indexes.forEach((index, i) => {
        db.run(index.sql, (err) => {
            if (err) {
                console.error(`❌ Failed to create ${index.name}:`, err);
            } else {
                console.log(`✅ Created index: ${index.name}`);
            }

            completed++;
            if (completed === indexes.length) {
                console.log('\n🎉 All indexes created successfully!');

                // Test query performance
                console.log('\n🔍 Testing query performance...');

                const testQuery = `
                    SELECT tv_id, COUNT(*) as code_count
                    FROM tv_login_codes
                    WHERE datetime(created_at, '+5 minutes') > CURRENT_TIMESTAMP
                    GROUP BY tv_id
                    ORDER BY code_count DESC
                `;

                const startTime = Date.now();
                db.all(testQuery, [], (err, rows) => {
                    const duration = Date.now() - startTime;

                    if (err) {
                        console.error('❌ Test query failed:', err);
                    } else {
                        console.log(`✅ Test query completed in ${duration}ms`);
                        if (rows.length > 0) {
                            console.log('📊 Active login codes by TV:');
                            rows.forEach(row => {
                                console.log(`   TV ${row.tv_id}: ${row.code_count} active codes`);
                            });
                        } else {
                            console.log('📝 No active login codes found');
                        }
                    }

                    process.exit(0);
                });
            }
        });
    });
}, 2000); // Wait 2 seconds for database initialization
