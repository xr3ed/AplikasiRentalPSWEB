const db = require('../database').getInstance();

console.log('🔍 Verifying database schema...\n');

// Check transactions table schema
db.all("PRAGMA table_info(transactions)", (err, columns) => {
    if (err) {
        console.error('❌ Error checking transactions table:', err);
        return;
    }
    
    console.log('📊 Transactions table schema:');
    columns.forEach(col => {
        console.log(`  - ${col.name}: ${col.type} ${col.dflt_value ? `(default: ${col.dflt_value})` : ''} ${col.notnull ? '(NOT NULL)' : ''}`);
    });
    
    // Check if status column exists
    const hasStatusColumn = columns.some(col => col.name === 'status');
    if (hasStatusColumn) {
        console.log('✅ Status column exists in transactions table');
    } else {
        console.log('❌ Status column missing in transactions table');
    }
    
    console.log('\n🔍 Checking sample transactions...');
    
    // Check sample transactions
    db.all("SELECT * FROM transactions LIMIT 5", (err, rows) => {
        if (err) {
            console.error('❌ Error querying transactions:', err);
            return;
        }
        
        if (rows.length === 0) {
            console.log('📝 No transactions found in database');
        } else {
            console.log(`📝 Found ${rows.length} sample transactions:`);
            rows.forEach((row, index) => {
                console.log(`  ${index + 1}. ID: ${row.id}, Type: ${row.type}, Status: ${row.status || 'NULL'}, Amount: ${row.amount}`);
            });
        }
        
        console.log('\n✅ Schema verification complete!');
        process.exit(0);
    });
});

// Check other related tables
console.log('🔍 Checking related tables...\n');

db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) {
        console.error('❌ Error listing tables:', err);
        return;
    }
    
    console.log('📋 Available tables:');
    tables.forEach(table => {
        console.log(`  - ${table.name}`);
    });
    console.log('');
});
