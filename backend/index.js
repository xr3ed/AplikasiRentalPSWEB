require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { initDatabase } = require('./database');
const cors = require('cors');
const tvRoutes = require('./routes/tvs');
const memberRoutes = require('./routes/members');
const memberPackageRoutes = require('./routes/memberPackages');
const globalMemberPackageRoutes = require('./routes/globalMemberPackages');
const packageRoutes = require('./routes/packages');
const transactionRoutes = require('./routes/transactions');
const summaryRoutes = require('./routes/summary');
const monitoringRoutes = require('./routes/monitoring');
const { router: autoUpdateRoutes, setAutoUpdateService } = require('./routes/autoUpdate');
const { initializeWhatsAppClient } = require('./whatsapp');
const { startNotificationService } = require('./services/notificationService');
// const { startDiscovery } = require('./services/discoveryService'); // mDNS dinonaktifkan
const { startUdpDiscovery } = require('./services/udpDiscoveryService'); // Penemuan UDP kustom
const adbStartupService = require('./services/adbStartupService'); // ADB startup service
const TvMonitoringService = require('./services/tvMonitoringService');
const AutoUpdateService = require('./services/autoUpdateService'); // TV monitoring service
const cron = require('node-cron');
const tvService = require('./services/tvService');

// Initialize Database
initDatabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:3000", // Allow frontend origin
        methods: ["GET", "POST", "PUT"]
    }
});
const port = process.env.PORT || 3001;

// Make io instance available to other modules
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/tvs', tvRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/member-packages', globalMemberPackageRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/summary', summaryRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/auto-update', autoUpdateRoutes);

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

// Initialize TV Monitoring Service
let tvMonitoringService = null;
let autoUpdateService = null;

// Track socket connections for immediate disconnect detection
const socketToTvMap = new Map(); // socketId -> tvId
const tvToSocketMap = new Map(); // tvId -> socketId

// Rate limiting for immediate connect events (prevent spam)
const immediateConnectCooldowns = new Map(); // tvId -> timestamp
const IMMEDIATE_CONNECT_COOLDOWN_MS = 2000; // 2 seconds cooldown

// Socket.IO connection
io.on('connection', (socket) => {
    console.log(`📡 Client connected: ${socket.id}`);

    // Handle TV helper app initial connection (immediate connect detection)
    socket.on('tv-connect', async (data) => {
        try {
            const { tvId, appVersion, deviceInfo, isRecovery } = data;
            if (tvId && tvMonitoringService) {
                // Detect if this is a recovery connection based on recent recovery launches
                const isRecoveryConnection = isRecovery || tvMonitoringService.isRecentRecoveryLaunch(tvId);
                // Check if TV already has an active connection (prevent duplicates)
                const existingSocketId = tvToSocketMap.get(tvId);
                if (existingSocketId && existingSocketId !== socket.id) {
                    console.log(`🔇 TV ${tvId} already has active connection (${existingSocketId}), ignoring duplicate`);
                    return;
                }

                // Rate limiting for immediate connect events
                const now = Date.now();
                const lastConnectTime = immediateConnectCooldowns.get(tvId);
                if (lastConnectTime && (now - lastConnectTime) < IMMEDIATE_CONNECT_COOLDOWN_MS) {
                    console.log(`🔇 TV ${tvId} immediate connect blocked (cooldown)`);
                    return;
                }

                // Update cooldown
                immediateConnectCooldowns.set(tvId, now);

                // Log connection type
                const connectType = isRecoveryConnection ? 'via recovery' : 'immediately';
                console.log(`🚀 TV ${tvId} helper app connected ${connectType}`);

                // Track socket-TV mapping
                socketToTvMap.set(socket.id, tvId);
                tvToSocketMap.set(tvId, socket.id);

                // Check for auto-update if service is available
                if (autoUpdateService) {
                    try {
                        // Get current timestamp from TV's database record (sqlite3 compatible)
                        const { getInstance } = require('./database');
                        const db = getInstance();

                        db.get('SELECT ip_address, app_version FROM tvs WHERE id = ?', [tvId], async (err, tvData) => {
                            if (err) {
                                console.error(`❌ Database query error for TV ${tvId}:`, err.message);
                                return;
                            }

                            console.log(`📊 TV ${tvId} data from database:`, JSON.stringify(tvData, null, 2));

                            if (tvData && tvData.ip_address) {
                                console.log(`🔍 Checking update for TV ${tvId} at ${tvData.ip_address}`);
                                const needsUpdate = await autoUpdateService.checkTVNeedsUpdate(tvId, tvData.app_version);
                                if (needsUpdate) {
                                    console.log(`🔄 TV ${tvId} needs update, triggering auto-update...`);
                                    // Trigger auto-update (don't await to avoid blocking connection)
                                    autoUpdateService.autoUpdateTV(tvId, tvData.ip_address).catch(error => {
                                        console.error(`❌ Auto-update failed for TV ${tvId}:`, error.message);
                                    });
                                } else {
                                    console.log(`✅ TV ${tvId} is already up to date`);
                                }
                            } else {
                                console.error(`❌ TV ${tvId} data not found or missing IP address:`, tvData);
                            }
                        });
                    } catch (error) {
                        console.error(`❌ Database query error for TV ${tvId}:`, error.message);
                    }
                }

                // Use monitoring service to handle connect (immediate or recovery)
                const success = await tvMonitoringService.handleImmediateConnect(tvId, socket.id, {
                    appVersion,
                    deviceInfo
                }, isRecoveryConnection);

                if (success) {
                    // Send confirmation back to helper app
                    socket.emit('tv-connect-confirmed', {
                        tvId,
                        status: 'active',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    throw new Error('Failed to update TV status');
                }
            }
        } catch (error) {
            console.error('Error handling TV connect:', error);
            socket.emit('tv-connect-error', {
                tvId: data.tvId,
                error: error.message
            });
        }
    });

    // Handle TV heartbeat from helper apps (regular heartbeat)
    socket.on('tv-heartbeat', async (data) => {
        try {
            const { tvId } = data;
            if (tvId && tvMonitoringService) {
                // Track socket-TV mapping for immediate disconnect detection
                socketToTvMap.set(socket.id, tvId);
                tvToSocketMap.set(tvId, socket.id);

                await tvMonitoringService.updateHeartbeat(tvId, socket.id);
                // Reduced logging for regular heartbeats to avoid spam
            }
        } catch (error) {
            console.error('Error handling TV heartbeat:', error);
        }
    });

    // Handle manual recovery request from dashboard
    socket.on('trigger-tv-recovery', async (data) => {
        try {
            const { tvId } = data;
            if (tvId && tvMonitoringService) {
                console.log(`🔧 Manual recovery requested for TV ${tvId}`);
                // Trigger recovery by temporarily setting status to error
                await tvService.updateMonitoringStatus(tvId, {
                    monitoring_status: 'error'
                });
                // The monitoring service will pick this up in next cycle
            }
        } catch (error) {
            console.error('Error triggering TV recovery:', error);
        }
    });

    // Handle monitoring stats request
    socket.on('get-monitoring-stats', async () => {
        try {
            if (tvMonitoringService) {
                const stats = await tvMonitoringService.getMonitoringStats();
                socket.emit('monitoring-stats', stats);
            }
        } catch (error) {
            console.error('Error getting monitoring stats:', error);
        }
    });

    // Handle reset recovery attempts request
    socket.on('reset-recovery-attempts', async (data) => {
        try {
            const { tvId } = data;
            if (tvId && tvMonitoringService) {
                await tvMonitoringService.resetRecoveryAttempts(tvId);
                console.log(`🔄 Recovery attempts reset for TV ${tvId}`);
                socket.emit('recovery-attempts-reset', { tvId, success: true });
            }
        } catch (error) {
            console.error('Error resetting recovery attempts:', error);
            socket.emit('recovery-attempts-reset', { tvId: data.tvId, success: false, error: error.message });
        }
    });

    socket.on('disconnect', async () => {
        console.log(`📡 Client disconnected: ${socket.id}`);

        // Check if this was a TV helper app
        const tvId = socketToTvMap.get(socket.id);
        if (tvId && tvMonitoringService) {
            // Check if this socket is still the active one for this TV (prevent duplicate disconnect events)
            const currentActiveSocket = tvToSocketMap.get(tvId);
            if (currentActiveSocket !== socket.id) {
                console.log(`🔇 TV ${tvId} disconnect ignored - not the active socket (active: ${currentActiveSocket})`);
                socketToTvMap.delete(socket.id); // Clean up only this socket mapping
                return;
            }

            console.log(`📺 TV ${tvId} helper app disconnected - immediate status update`);

            // Clean up mappings
            socketToTvMap.delete(socket.id);
            tvToSocketMap.delete(tvId);

            // Immediately update status to disconnected
            try {
                await tvMonitoringService.updateTvMonitoringStatus(tvId, {
                    monitoring_status: 'disconnected',
                    socket_connection_id: null
                });

                // Emit immediate status update
                tvMonitoringService.emitStatusUpdate(tvId, {
                    status: 'disconnected',
                    networkStatus: true, // Assume network is still up
                    processStatus: 'stopped',
                    heartbeatStatus: false,
                    latency: null,
                    timestamp: new Date().toISOString()
                });

                console.log(`✅ TV ${tvId} status immediately updated to DISCONNECTED`);

                // INSTANT RECOVERY: Trigger immediate recovery when helper app disconnects
                console.log(`🚀 Triggering INSTANT RECOVERY for TV ${tvId} (helper app disconnected)`);

                // Don't await to avoid blocking disconnect handler
                tvMonitoringService.triggerInstantRecovery(tvId).catch(error => {
                    console.error(`❌ Instant recovery failed for TV ${tvId}:`, error);
                });

            } catch (error) {
                console.error(`❌ Error updating TV ${tvId} status on disconnect:`, error);
            }
        }
    });
});

server.listen(port, async () => {
    console.log(`🚀 Server is running on port ${port}`);
    const localIp = Object.values(require('os').networkInterfaces())
        .flat()
        .filter(item => !item.internal && item.family === 'IPv4' && !item.address.startsWith('169.254.'))
        .find(Boolean)?.address;
    console.log(`🌐 Server is also available on http://${localIp}:${port}`);

    // Initialize ADB system first
    console.log('\n📱 Initializing ADB system...');
    try {
        const adbReady = await adbStartupService.initializeADB();
        if (adbReady) {
            console.log('✅ ADB system ready for TV integration');

            // Auto-connect to existing TVs after ADB is ready
            setTimeout(async () => {
                try {
                    const tvService = require('./services/tvService');
                    const adbService = require('./services/adbService');
                    const tvs = await tvService.getAllTvs();

                    if (tvs.length > 0) {
                        console.log(`🔗 Auto-connecting to ${tvs.length} existing TVs...`);
                        for (const tv of tvs) {
                            if (tv.ip_address) {
                                try {
                                    const connectResult = await adbService.connectToTV(tv.ip_address);
                                    if (connectResult.success) {
                                        console.log(`✅ Auto-connected to TV ${tv.id} (${tv.name})`);
                                    }
                                } catch (error) {
                                    // Silent fail for auto-connect
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log('⚠️ Auto-connect to TVs failed:', error.message);
                }
            }, 3000); // Wait 3 seconds after ADB is ready
        } else {
            console.log('⚠️ ADB system initialization failed - TV integration may not work properly');
            console.log('💡 You can manually start ADB server later or check ADB installation');
        }
    } catch (error) {
        console.error('❌ Error initializing ADB system:', error.message);
        console.log('⚠️ Server will continue without ADB - TV integration will be limited');
    }

    // Initialize TV Monitoring Service
    console.log('\n📺 Initializing TV Monitoring Service...');
    try {
        tvMonitoringService = new TvMonitoringService(io);
        tvMonitoringService.startMonitoring();
        console.log('✅ TV Monitoring Service started successfully');
    } catch (error) {
        console.error('❌ Error starting TV Monitoring Service:', error.message);
        console.log('⚠️ Server will continue without TV monitoring');
    }

    // Initialize Auto-Update Service
    console.log('\n🔄 Initializing Auto-Update Service...');
    try {
        autoUpdateService = new AutoUpdateService(io);
        autoUpdateService.startAPKWatcher();

        // Set the service instance for API routes
        setAutoUpdateService(autoUpdateService);

        console.log('✅ Auto-Update Service started successfully');

        // Check for updates every 30 minutes
        setInterval(() => {
            autoUpdateService.checkAllTVsForUpdates();
        }, 30 * 60 * 1000);
    } catch (error) {
        console.error('❌ Error starting Auto-Update Service:', error.message);
        console.log('⚠️ Server will continue without auto-update functionality');
    }

    // Initialize WhatsApp client and other services
    console.log('\n📞 Initializing WhatsApp and other services...');
    initializeWhatsAppClient(io);
    startNotificationService();
    // startDiscovery(port, localIp); // mDNS dinonaktifkan
    startUdpDiscovery(port); // Mengaktifkan penemuan UDP kustom

    // Start cleanup job for expired/used login codes (every 5 minutes)
    cron.schedule('*/5 * * * *', async () => {
        const startTime = Date.now();
        console.log('🧹 Starting login code cleanup job...');

        try {
            // First, notify Android TV Helpers about expired codes via Socket.IO
            const notificationResult = await tvService.checkAndNotifyExpiredLoginCodes(io);

            // Then cleanup expired/used codes from database
            const cleanupResult = await tvService.cleanupExpiredLoginCodes();

            const totalDuration = Date.now() - startTime;

            if (cleanupResult.changes > 0 || notificationResult.notified > 0) {
                console.log(`✅ Cleanup completed in ${totalDuration}ms:`);
                console.log(`   📡 Notifications: ${notificationResult.notified} sent, ${notificationResult.skipped} skipped`);
                console.log(`   🗑️ Database: ${cleanupResult.changes} codes deleted`);
            }

            // Alert if excessive cleanup
            if (cleanupResult.changes > 50) {
                console.warn(`⚠️ HIGH CLEANUP VOLUME: ${cleanupResult.changes} codes deleted - investigate potential issues`);
            }

        } catch (error) {
            console.error('❌ Error during login code cleanup:', error);
        }
    });

    // Start cleanup job for expired TV locks (every 1 minute)
    cron.schedule('*/1 * * * *', async () => {
        try {
            const lockCleanupResult = await tvService.cleanupExpiredLocks();

            if (lockCleanupResult.cleaned > 0) {
                console.log(`🔓 Cleaned up ${lockCleanupResult.cleaned} expired TV locks`);

                // Trigger QR refresh for unlocked TVs
                // Note: In a real implementation, you'd want to track which TVs were unlocked
                // and only refresh those specific QRs
            }
        } catch (error) {
            console.error('❌ Error during TV lock cleanup:', error);
        }
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
        console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

        if (tvMonitoringService) {
            console.log('📺 Stopping TV Monitoring Service...');
            tvMonitoringService.stopMonitoring();
        }

        server.close(() => {
            console.log('✅ Server closed gracefully');
            process.exit(0);
        });

        // Force exit after 10 seconds
        setTimeout(() => {
            console.log('⚠️ Forcing exit after timeout');
            process.exit(1);
        }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});