/**
 * TV Monitoring Service
 * Comprehensive real-time monitoring system for PS Rental TVs
 * Implements three-layer monitoring architecture with auto-recovery
 */

const ping = require('ping');
const { getInstance } = require('../database');
const adbService = require('./adbService');
const tvService = require('./tvService');

class TvMonitoringService {
    constructor(io) {
        this.io = io; // Socket.IO instance for real-time updates
        this.db = getInstance();
        this.monitoringInterval = null;
        this.isMonitoring = false;
        this.monitoringIntervalMs = 45000; // 45 seconds for optimized performance
        this.heartbeatTimeoutMs = 60000; // 60 seconds (adjusted for longer interval)
        this.maxRecoveryAttempts = Infinity; // No limit on recovery attempts
        this.recoveryWindowMs = 10 * 60 * 1000; // 10 minutes
        
        // Status constants
        this.STATUS = {
            ACTIVE: 'active',
            DISCONNECTED: 'disconnected', 
            OFFLINE: 'offline',
            RECOVERING: 'recovering',
            ERROR: 'error',
            UNKNOWN: 'unknown'
        };

        // Process status constants
        this.PROCESS_STATUS = {
            RUNNING: 'running',
            STOPPED: 'stopped',
            CRASHED: 'crashed',
            UNKNOWN: 'unknown'
        };

        // Rate limiting for recovery events (prevent spam)
        this.recoveryEventCooldowns = new Map();
        this.RECOVERY_EVENT_COOLDOWN_MS = 3000; // 3 seconds cooldown

        // Rate limiting for immediate connect events (prevent spam)
        this.immediateConnectCooldowns = new Map();
        this.IMMEDIATE_CONNECT_COOLDOWN_MS = 2000; // 2 seconds cooldown

        // Track recovery launches to detect recovery connections
        this.recoveryLaunches = new Map(); // tvId -> timestamp
        this.RECOVERY_DETECTION_WINDOW_MS = 10000; // 10 seconds window

        console.log('TV Monitoring Service initialized');
    }

    /**
     * Start the monitoring service
     */
    startMonitoring() {
        if (this.isMonitoring) {
            console.log('TV Monitoring already running');
            return;
        }

        console.log('Starting TV Monitoring Service...');
        this.isMonitoring = true;
        
        // Run initial monitoring check
        this.runMonitoringCycle();
        
        // Set up recurring monitoring
        this.monitoringInterval = setInterval(() => {
            this.runMonitoringCycle();
        }, this.monitoringIntervalMs);

        console.log(`TV Monitoring Service started with ${this.monitoringIntervalMs/1000}s interval`);
    }

    /**
     * Stop the monitoring service
     */
    stopMonitoring() {
        if (!this.isMonitoring) {
            console.log('TV Monitoring not running');
            return;
        }

        console.log('Stopping TV Monitoring Service...');
        this.isMonitoring = false;
        
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }

        console.log('TV Monitoring Service stopped');
    }

    /**
     * Main monitoring cycle - processes all TVs
     */
    async runMonitoringCycle() {
        try {
            console.log('Running TV monitoring cycle...');
            
            // Get all TVs that have monitoring enabled
            const tvs = await this.getAllMonitoredTvs();
            
            if (tvs.length === 0) {
                console.log('No TVs to monitor');
                return;
            }

            console.log(`Monitoring ${tvs.length} TVs...`);
            
            // Process TVs in parallel for efficiency
            const monitoringPromises = tvs.map(tv => this.monitorSingleTv(tv));
            await Promise.allSettled(monitoringPromises);
            
            console.log('TV monitoring cycle completed');
            
        } catch (error) {
            console.error('Error in monitoring cycle:', error);
        }
    }

    /**
     * Get all TVs that should be monitored
     */
    getAllMonitoredTvs() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT id, name, ip_address, status, monitoring_status, 
                       last_ping_time, last_heartbeat_time, process_status,
                       auto_recovery_attempts, last_recovery_time, monitoring_enabled
                FROM tvs 
                WHERE monitoring_enabled = 1 OR monitoring_enabled IS NULL
            `;
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows || []);
                }
            });
        });
    }

    /**
     * Monitor a single TV through three-layer architecture
     */
    async monitorSingleTv(tv) {
        try {
            console.log(`Monitoring TV ${tv.id} (${tv.name}) at ${tv.ip_address}`);
            
            const monitoringResult = {
                tvId: tv.id,
                networkStatus: false,
                processStatus: this.PROCESS_STATUS.UNKNOWN,
                heartbeatStatus: false,
                latency: null,
                timestamp: new Date().toISOString()
            };

            // Layer 1: Network Connectivity Check
            const networkResult = await this.checkNetworkConnectivity(tv.ip_address);
            monitoringResult.networkStatus = networkResult.isAlive;
            monitoringResult.latency = networkResult.latency;

            // Layer 2: Helper App Process Detection (only if network is up)
            if (monitoringResult.networkStatus) {
                monitoringResult.processStatus = await this.checkHelperAppProcess(tv.ip_address);
            }

            // Layer 3: Application Health Check
            monitoringResult.heartbeatStatus = this.checkHeartbeatStatus(tv.last_heartbeat_time);

            // Determine overall status
            const overallStatus = this.determineOverallStatus(monitoringResult);
            
            // Update database with monitoring results
            await this.updateTvMonitoringStatus(tv.id, {
                monitoring_status: overallStatus,
                last_ping_time: monitoringResult.networkStatus ? monitoringResult.timestamp : null,
                network_latency_ms: monitoringResult.latency,
                process_status: monitoringResult.processStatus
            });

            // Trigger auto-recovery if needed
            if (this.shouldTriggerRecovery(tv, overallStatus)) {
                await this.triggerAutoRecovery(tv, monitoringResult);
            }

            // Emit real-time update
            this.emitStatusUpdate(tv.id, {
                status: overallStatus,
                networkStatus: monitoringResult.networkStatus,
                processStatus: monitoringResult.processStatus,
                heartbeatStatus: monitoringResult.heartbeatStatus,
                latency: monitoringResult.latency,
                timestamp: monitoringResult.timestamp
            });

            console.log(`TV ${tv.id} monitoring completed: ${overallStatus}`);
            
        } catch (error) {
            console.error(`Error monitoring TV ${tv.id}:`, error);
            
            // Update status to error
            await this.updateTvMonitoringStatus(tv.id, {
                monitoring_status: this.STATUS.ERROR
            });
        }
    }

    /**
     * Layer 1: Check network connectivity with ping
     */
    async checkNetworkConnectivity(ipAddress, timeout = 3000, retries = 2) {
        const cleanIp = ipAddress.replace('::ffff:', '');
        
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const result = await ping.promise.probe(cleanIp, {
                    timeout: timeout / 1000,
                    min_reply: 1
                });
                
                if (result.alive) {
                    return {
                        isAlive: true,
                        latency: Math.round(parseFloat(result.avg) || 0)
                    };
                }
                
                if (attempt < retries) {
                    console.log(`Ping attempt ${attempt + 1} failed for ${cleanIp}, retrying...`);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
                
            } catch (error) {
                console.error(`Ping error for ${cleanIp} (attempt ${attempt + 1}):`, error.message);
                if (attempt === retries) {
                    break;
                }
            }
        }
        
        return { isAlive: false, latency: null };
    }

    /**
     * Layer 2: Check helper app process status via ADB
     */
    async checkHelperAppProcess(ipAddress) {
        try {
            const cleanIp = ipAddress.replace('::ffff:', '');
            
            // Check if helper app process is running
            const isRunning = await adbService.checkHelperAppProcess(cleanIp);
            
            if (isRunning) {
                return this.PROCESS_STATUS.RUNNING;
            } else {
                return this.PROCESS_STATUS.STOPPED;
            }
            
        } catch (error) {
            console.error(`Error checking process for ${ipAddress}:`, error.message);
            return this.PROCESS_STATUS.UNKNOWN;
        }
    }

    /**
     * Layer 3: Check application health via heartbeat
     */
    checkHeartbeatStatus(lastHeartbeatTime) {
        if (!lastHeartbeatTime) {
            return false;
        }
        
        const lastHeartbeat = new Date(lastHeartbeatTime);
        const now = new Date();
        const timeDiff = now - lastHeartbeat;
        
        return timeDiff <= this.heartbeatTimeoutMs;
    }

    /**
     * Determine overall TV status based on monitoring results
     */
    determineOverallStatus(monitoringResult) {
        const { networkStatus, processStatus, heartbeatStatus } = monitoringResult;
        
        // Network is down
        if (!networkStatus) {
            return this.STATUS.OFFLINE;
        }
        
        // Network is up, process is running, heartbeat is good
        if (networkStatus && processStatus === this.PROCESS_STATUS.RUNNING && heartbeatStatus) {
            return this.STATUS.ACTIVE;
        }
        
        // Network is up but process is not running or heartbeat is stale
        if (networkStatus && (processStatus !== this.PROCESS_STATUS.RUNNING || !heartbeatStatus)) {
            return this.STATUS.DISCONNECTED;
        }
        
        // Process is running but heartbeat is stale (app might be hanging)
        if (networkStatus && processStatus === this.PROCESS_STATUS.RUNNING && !heartbeatStatus) {
            return this.STATUS.ERROR;
        }
        
        return this.STATUS.UNKNOWN;
    }

    /**
     * Check if auto-recovery should be triggered
     */
    shouldTriggerRecovery(tv, currentStatus) {
        // Don't recover if already recovering or if network is down
        if (currentStatus === this.STATUS.RECOVERING || currentStatus === this.STATUS.OFFLINE) {
            return false;
        }

        // Only recover for disconnected or error states
        if (currentStatus !== this.STATUS.DISCONNECTED && currentStatus !== this.STATUS.ERROR) {
            return false;
        }

        // Check recovery rate limiting
        const now = new Date();
        const lastRecovery = tv.last_recovery_time ? new Date(tv.last_recovery_time) : null;

        if (lastRecovery) {
            const timeSinceLastRecovery = now - lastRecovery;

            // Reset attempts counter if recovery window has passed
            if (timeSinceLastRecovery > this.recoveryWindowMs) {
                return true; // Allow recovery, attempts will be reset
            }

            // No limit on recovery attempts - always allow recovery
        }

        return true;
    }

    /**
     * Trigger auto-recovery for a TV
     */
    async triggerAutoRecovery(tv, monitoringResult) {
        try {
            console.log(`Triggering auto-recovery for TV ${tv.id} (${tv.name})`);

            // Update status to recovering
            await this.updateTvMonitoringStatus(tv.id, {
                monitoring_status: this.STATUS.RECOVERING
            });

            // Emit recovery started event
            this.emitRecoveryEvent(tv.id, 'recovery-started', {
                reason: `Status: ${monitoringResult.processStatus}, Network: ${monitoringResult.networkStatus}`,
                attempt: tv.auto_recovery_attempts + 1
            });

            const cleanIp = tv.ip_address.replace('::ffff:', '');
            let recoverySuccess = false;

            // Track recovery launch for detection
            this.recoveryLaunches.set(tv.id, Date.now());

            // Recovery strategy based on monitoring results
            if (monitoringResult.processStatus === this.PROCESS_STATUS.STOPPED) {
                // Process Recovery: Launch helper app
                console.log(`Attempting to launch helper app for TV ${tv.id}`);
                recoverySuccess = await adbService.launchHelperApp(cleanIp);

            } else if (monitoringResult.processStatus === this.PROCESS_STATUS.RUNNING && !monitoringResult.heartbeatStatus) {
                // App Recovery: Force stop and restart
                console.log(`Attempting to restart helper app for TV ${tv.id}`);
                await adbService.forceStopHelperApp(cleanIp);
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                recoverySuccess = await adbService.launchHelperApp(cleanIp);

            } else {
                // Generic recovery: Try launching app
                console.log(`Attempting generic recovery for TV ${tv.id}`);
                recoverySuccess = await adbService.launchHelperApp(cleanIp);
            }

            // Update recovery statistics
            const now = new Date().toISOString();
            const newAttempts = (tv.auto_recovery_attempts || 0) + 1;

            await this.updateTvMonitoringStatus(tv.id, {
                auto_recovery_attempts: newAttempts,
                last_recovery_time: now,
                monitoring_status: recoverySuccess ? this.STATUS.ACTIVE : this.STATUS.ERROR
            });

            // Emit recovery result
            this.emitRecoveryEvent(tv.id, recoverySuccess ? 'recovery-success' : 'recovery-failed', {
                attempt: newAttempts,
                totalAttempts: newAttempts
            });

            console.log(`Auto-recovery for TV ${tv.id} ${recoverySuccess ? 'succeeded' : 'failed'}`);

        } catch (error) {
            console.error(`Auto-recovery failed for TV ${tv.id}:`, error);

            await this.updateTvMonitoringStatus(tv.id, {
                monitoring_status: this.STATUS.ERROR
            });

            this.emitRecoveryEvent(tv.id, 'recovery-error', {
                error: error.message
            });
        }
    }

    /**
     * Update TV monitoring status in database
     */
    updateTvMonitoringStatus(tvId, updates) {
        return new Promise((resolve, reject) => {
            const fields = Object.keys(updates);
            const values = Object.values(updates);
            const setClause = fields.map(field => `${field} = ?`).join(', ');

            const sql = `UPDATE tvs SET ${setClause} WHERE id = ?`;
            values.push(tvId);

            this.db.run(sql, values, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes);
                }
            });
        });
    }

    /**
     * Update heartbeat timestamp for a TV
     */
    async updateHeartbeat(tvId, socketId = null) {
        const updates = {
            last_heartbeat_time: new Date().toISOString()
        };

        if (socketId) {
            updates.socket_connection_id = socketId;
        }

        await this.updateTvMonitoringStatus(tvId, updates);
        console.log(`Heartbeat updated for TV ${tvId}`);
    }

    /**
     * Emit real-time status update via Socket.IO
     */
    emitStatusUpdate(tvId, statusData) {
        if (this.io) {
            this.io.emit('tv-status-update', {
                tvId,
                ...statusData
            });
        }
    }

    /**
     * Handle immediate connect event and update status
     * @param {number} tvId - TV ID
     * @param {string} socketId - Socket connection ID
     * @param {object} appInfo - App information
     * @param {boolean} isRecovery - Whether this is from auto-recovery (default: false)
     */
    async handleImmediateConnect(tvId, socketId, appInfo = {}, isRecovery = false) {
        try {
            // Update database with immediate active status
            await this.updateTvMonitoringStatus(tvId, {
                monitoring_status: 'active',
                socket_connection_id: socketId,
                last_heartbeat_time: new Date().toISOString(),
                process_status: 'running'
            });

            // Emit status update
            this.emitStatusUpdate(tvId, {
                status: 'active',
                networkStatus: true,
                processStatus: 'running',
                heartbeatStatus: true,
                latency: null,
                timestamp: new Date().toISOString()
            });

            // Emit immediate connect event ONLY for genuine immediate connects (NOT recovery)
            if (this.io && !isRecovery) {
                const now = Date.now();
                const lastEventTime = this.immediateConnectCooldowns.get(tvId);

                if (!lastEventTime || (now - lastEventTime) >= this.IMMEDIATE_CONNECT_COOLDOWN_MS) {
                    this.immediateConnectCooldowns.set(tvId, now);

                    this.io.emit('tv-immediate-connect', {
                        tvId,
                        timestamp: new Date().toISOString(),
                        ...appInfo
                    });

                    console.log(`🚀 Immediate connect event emitted for TV ${tvId}`);
                } else {
                    console.log(`🔇 Immediate connect event blocked (cooldown): TV ${tvId}`);
                }
            } else if (isRecovery) {
                console.log(`🔄 Recovery connect handled for TV ${tvId} (no immediate notification)`);
            }

            const connectType = isRecovery ? 'Recovery' : 'Immediate';
            console.log(`🚀 ${connectType} connect handled for TV ${tvId}`);
            return true;
        } catch (error) {
            console.error(`Error handling immediate connect for TV ${tvId}:`, error);
            return false;
        }
    }

    /**
     * Handle recovery connect event (separate from immediate connect)
     */
    async handleRecoveryConnect(tvId, socketId, appInfo = {}) {
        return await this.handleImmediateConnect(tvId, socketId, appInfo, true);
    }

    /**
     * Check if a TV had a recent recovery launch (within detection window)
     */
    isRecentRecoveryLaunch(tvId) {
        const launchTime = this.recoveryLaunches.get(tvId);
        if (!launchTime) return false;

        const now = Date.now();
        const isRecent = (now - launchTime) <= this.RECOVERY_DETECTION_WINDOW_MS;

        // Clean up old entries
        if (!isRecent) {
            this.recoveryLaunches.delete(tvId);
        }

        return isRecent;
    }

    /**
     * Trigger instant recovery when helper app disconnects
     */
    async triggerInstantRecovery(tvId) {
        try {
            console.log(`🚀 INSTANT RECOVERY triggered for TV ${tvId}`);

            // Get TV data
            const tv = await this.getTvById(tvId);
            if (!tv || !tv.ip_address) {
                console.error(`❌ TV ${tvId} not found or missing IP address`);
                return false;
            }

            const cleanIp = tv.ip_address.replace('::ffff:', '');

            // Track recovery launch for detection
            this.recoveryLaunches.set(tvId, Date.now());

            // Launch helper app immediately
            console.log(`🚀 Launching helper app instantly for TV ${tvId} at ${cleanIp}`);
            const recoverySuccess = await adbService.launchHelperApp(cleanIp);

            // Update recovery statistics
            const now = new Date().toISOString();
            const newAttempts = (tv.auto_recovery_attempts || 0) + 1;

            await this.updateTvMonitoringStatus(tvId, {
                auto_recovery_attempts: newAttempts,
                last_recovery_time: now,
                monitoring_status: recoverySuccess ? this.STATUS.ACTIVE : this.STATUS.ERROR
            });

            // Emit recovery event with rate limiting
            this.emitRecoveryEvent(tvId, 'instant_recovery', {
                success: recoverySuccess,
                attempts: newAttempts,
                timestamp: now,
                trigger: 'immediate_disconnect'
            });

            if (recoverySuccess) {
                console.log(`✅ INSTANT RECOVERY succeeded for TV ${tvId}`);
            } else {
                console.log(`❌ INSTANT RECOVERY failed for TV ${tvId}`);
            }

            return recoverySuccess;

        } catch (error) {
            console.error(`❌ Error during instant recovery for TV ${tvId}:`, error);
            return false;
        }
    }

    /**
     * Get TV by ID (helper method for instant recovery)
     */
    getTvById(tvId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM tvs WHERE id = ?', [tvId], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    /**
     * Emit recovery event via Socket.IO with rate limiting
     */
    emitRecoveryEvent(tvId, eventType, data) {
        if (!this.io) return;

        // Create unique key for this event type and TV
        const eventKey = `${tvId}-${eventType}`;
        const now = Date.now();

        // Check if this event is in cooldown
        const lastEventTime = this.recoveryEventCooldowns.get(eventKey);
        if (lastEventTime && (now - lastEventTime) < this.RECOVERY_EVENT_COOLDOWN_MS) {
            console.log(`🔇 Recovery event blocked (cooldown): TV ${tvId} - ${eventType}`);
            return;
        }

        // Update cooldown
        this.recoveryEventCooldowns.set(eventKey, now);

        // Emit the event
        this.io.emit('tv-recovery-event', {
            tvId,
            eventType,
            timestamp: new Date().toISOString(),
            ...data
        });

        // Clean up old cooldowns (older than 10 seconds)
        setTimeout(() => {
            for (const [key, timestamp] of this.recoveryEventCooldowns.entries()) {
                if (now - timestamp > 10000) {
                    this.recoveryEventCooldowns.delete(key);
                }
            }
        }, 10000);
    }

    /**
     * Get monitoring statistics
     */
    async getMonitoringStats() {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT
                    monitoring_status,
                    COUNT(*) as count
                FROM tvs
                WHERE monitoring_enabled = 1 OR monitoring_enabled IS NULL
                GROUP BY monitoring_status
            `;

            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const stats = {
                        total: 0,
                        active: 0,
                        disconnected: 0,
                        offline: 0,
                        recovering: 0,
                        error: 0,
                        unknown: 0
                    };

                    rows.forEach(row => {
                        stats.total += row.count;
                        stats[row.monitoring_status || 'unknown'] = row.count;
                    });

                    resolve(stats);
                }
            });
        });
    }

    /**
     * Reset recovery attempts for a TV (manual intervention)
     */
    async resetRecoveryAttempts(tvId) {
        await this.updateTvMonitoringStatus(tvId, {
            auto_recovery_attempts: 0,
            last_recovery_time: null
        });

        console.log(`Recovery attempts reset for TV ${tvId}`);
    }

    /**
     * Enable/disable monitoring for a TV
     */
    async setMonitoringEnabled(tvId, enabled) {
        await this.updateTvMonitoringStatus(tvId, {
            monitoring_enabled: enabled ? 1 : 0
        });

        console.log(`Monitoring ${enabled ? 'enabled' : 'disabled'} for TV ${tvId}`);
    }
}

module.exports = TvMonitoringService;
