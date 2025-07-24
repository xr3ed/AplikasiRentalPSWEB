const fetch = require('node-fetch');

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

async function addPackages() {
    const baseUrl = 'http://localhost:3001/api';
    
    try {
        // First, get existing packages to clear them
        console.log('Fetching existing packages...');
        const existingResponse = await fetch(`${baseUrl}/packages`);
        const existingPackages = await existingResponse.json();
        
        // Delete existing packages
        for (const pkg of existingPackages) {
            console.log(`Deleting package: ${pkg.name}`);
            await fetch(`${baseUrl}/packages/${pkg.id}`, {
                method: 'DELETE'
            });
        }
        
        console.log('Cleared existing packages');
        
        // Add new packages
        for (let i = 0; i < dummyPackages.length; i++) {
            const pkg = dummyPackages[i];
            console.log(`Adding package ${i + 1}: ${pkg.name}`);
            
            const response = await fetch(`${baseUrl}/packages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(pkg)
            });
            
            if (response.ok) {
                console.log(`✓ Added: ${pkg.name}`);
            } else {
                console.error(`✗ Failed to add: ${pkg.name}`, await response.text());
            }
        }
        
        console.log(`\nSuccessfully added ${dummyPackages.length} dummy packages!`);
        
        // Show all packages
        const finalResponse = await fetch(`${baseUrl}/packages`);
        const finalPackages = await finalResponse.json();
        
        console.log('\nAll packages in database:');
        finalPackages
            .sort((a, b) => a.duration_minutes - b.duration_minutes)
            .forEach(pkg => {
                console.log(`- ${pkg.name}: ${pkg.duration_minutes} menit, Rp ${pkg.price.toLocaleString('id-ID')}`);
            });
            
    } catch (error) {
        console.error('Error adding packages via API:', error.message);
        console.log('Make sure the backend server is running on port 3001');
    }
}

addPackages();
