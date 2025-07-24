const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to database
const db = new sqlite3.Database(path.join(__dirname, 'database.db'));

// Dummy packages data
const dummyPackages = [
    { name: 'Paket 1 Jam', duration_minutes: 60, price: 5000 },
    { name: 'Paket 2 Jam', duration_minutes: 120, price: 9000 },
    { name: 'Paket 3 Jam', duration_minutes: 180, price: 13000 },
    { name: 'Paket 5 Jam', duration_minutes: 300, price: 20000 },
    { name: 'Paket 1 Menit', duration_minutes: 1, price: 100 },
    { name: 'Paket 2 Menit', duration_minutes: 2, price: 200 },
    { name: 'Paket 30 Menit', duration_minutes: 30, price: 3000 },
    { name: 'Paket 45 Menit', duration_minutes: 45, price: 4000 },
    { name: 'Paket 90 Menit', duration_minutes: 90, price: 7000 },
    { name: 'Paket 4 Jam', duration_minutes: 240, price: 16000 },
    { name: 'Paket 6 Jam', duration_minutes: 360, price: 24000 },
    { name: 'Paket 8 Jam', duration_minutes: 480, price: 32000 },
    { name: 'Paket 10 Jam', duration_minutes: 600, price: 40000 },
    { name: 'Paket 12 Jam', duration_minutes: 720, price: 48000 },
    { name: 'Paket 24 Jam', duration_minutes: 1440, price: 80000 }
];

// Clear existing packages first
db.run('DELETE FROM packages', (err) => {
    if (err) {
        console.error('Error clearing packages:', err);
        return;
    }
    console.log('Cleared existing packages');

    // Insert dummy packages
    const insertPackage = db.prepare(`
        INSERT INTO packages (name, duration_minutes, price, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);

    let completed = 0;
    dummyPackages.forEach((pkg, index) => {
        insertPackage.run(pkg.name, pkg.duration_minutes, pkg.price, (err) => {
            if (err) {
                console.error(`Error adding package ${pkg.name}:`, err);
                return;
            }
            console.log(`Added package ${index + 1}: ${pkg.name}`);
            completed++;

            if (completed === dummyPackages.length) {
                console.log(`\nSuccessfully added ${dummyPackages.length} dummy packages!`);

                // Show all packages
                db.all('SELECT * FROM packages ORDER BY duration_minutes', (err, packages) => {
                    if (err) {
                        console.error('Error fetching packages:', err);
                        return;
                    }

                    console.log('\nAll packages in database:');
                    packages.forEach(pkg => {
                        console.log(`- ${pkg.name}: ${pkg.duration_minutes} menit, Rp ${pkg.price.toLocaleString('id-ID')}`);
                    });

                    db.close();
                });
            }
        });
    });

    insertPackage.finalize();
});
