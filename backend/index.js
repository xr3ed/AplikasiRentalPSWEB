require('dotenv').config();
const express = require('express');
const { initDatabase } = require('./database');
const cors = require('cors');
const tvRoutes = require('./routes/tvs');
const memberRoutes = require('./routes/members');
const packageRoutes = require('./routes/packages');
const transactionRoutes = require('./routes/transactions');
const summaryRoutes = require('./routes/summary');
const { initializeWhatsAppClient } = require('./whatsapp');
const { startNotificationService } = require('./services/notificationService');
// const { startDiscovery } = require('./services/discoveryService'); // mDNS dinonaktifkan
const { startUdpDiscovery } = require('./services/udpDiscoveryService'); // Penemuan UDP kustom

// Initialize Database
initDatabase();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tvs', tvRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/summary', summaryRoutes);

// Contoh endpoint sederhana
app.get('/', (req, res) => {
  res.send('Backend Server untuk Aplikasi Rental PS');
});

// Middleware untuk menangani 404 Not Found
app.use((req, res, next) => {
    res.status(404).json({ error: 'Resource tidak ditemukan' });
});

// Middleware untuk menangani kesalahan
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
    const localIp = Object.values(require('os').networkInterfaces())
        .flat()
        .filter(item => !item.internal && item.family === 'IPv4' && !item.address.startsWith('169.254.'))
        .find(Boolean)?.address;
    console.log(`Server is also available on http://${localIp}:${port}`);
    
    initializeWhatsAppClient();
    startNotificationService();
    // startDiscovery(port, localIp); // mDNS dinonaktifkan
    startUdpDiscovery(port); // Mengaktifkan penemuan UDP kustom
});