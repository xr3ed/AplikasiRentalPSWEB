const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

// Import modules
const db = require('./src/database/database');
const authRoutes = require('./src/routes/auth');
const tvRoutes = require('./src/routes/tv');
const memberRoutes = require('./src/routes/member');
const sessionRoutes = require('./src/routes/session');
const packageRoutes = require('./src/routes/package');
const whatsappService = require('./src/services/whatsapp');
const sessionManager = require('./src/services/sessionManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tv', tvRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/package', packageRoutes);

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('tv-register', (data) => {
    console.log('TV registered:', data);
    socket.join('tv-' + data.tvId);
  });
  
  socket.on('admin-connect', () => {
    socket.join('admin');
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize database
db.init();

// Initialize WhatsApp service
whatsappService.init(io);

// Initialize session manager
sessionManager.init(io);

// Cron job untuk reset harian
cron.schedule('0 0 * * *', () => {
  console.log('Running daily reset...');
  sessionManager.dailyReset();
});

// Serve main dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// TV display endpoint
app.get('/tv/:tvId', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tv.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log(`📺 TV Display: http://localhost:${PORT}/tv/TV01`);
});

// Export io for use in other modules
module.exports = { io };