const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const { getInstance } = require('../database');

class AutoUpdateService {
    constructor(io) {
        this.io = io;
        this.db = getInstance();

        // Debug database connection
        console.log('🔄 Auto-Update Service database connection:', this.db ? 'OK' : 'FAILED');

        // Support both debug and release APKs
        this.apkBasePath = path.join(__dirname, '../../helperAndroidTV/app/build/outputs/apk');
        this.debugPath = path.join(this.apkBasePath, 'debug');
        this.releasePath = path.join(this.apkBasePath, 'release');

        this.latestApkPath = null;
        this.latestTimestamp = null; // Use timestamp instead of version
        this.buildType = null; // 'debug' or 'release'
        this.isUpdating = new Set(); // Track TVs currently being updated

        console.log('🔄 Auto-Update Service initialized');
        console.log(`📁 Debug path: ${this.debugPath}`);
        console.log(`📁 Release path: ${this.releasePath}`);

        // Test database query
        this.testDatabaseConnection();

        this.scanForLatestAPK();
    }

    /**
     * Test database connection and queries (sqlite3 compatible)
     */
    testDatabaseConnection() {
        console.log('🧪 Testing database connection...');

        // Test basic query
        this.db.get('SELECT COUNT(*) as count FROM tvs', [], (err, result) => {
            if (err) {
                console.error('🧪 Count query failed:', err.message);
            } else {
                console.log('🧪 Total TVs in database:', result);
            }
        });

        // Test specific query
        this.db.all('SELECT id, name, ip_address, monitoring_status FROM tvs LIMIT 3', [], (err, tvs) => {
            if (err) {
                console.error('🧪 Sample query failed:', err.message);
            } else {
                console.log('🧪 Sample TVs:', JSON.stringify(tvs, null, 2));
            }
        });

        // Test the exact query we use in checkAllTVsForUpdates
        this.db.all(`
            SELECT id, name, ip_address, app_version, monitoring_status
            FROM tvs
            WHERE monitoring_status = 'active'
        `, [], (err, activeTVs) => {
            if (err) {
                console.error('🧪 Active TVs query failed:', err.message);
            } else {
                console.log('🧪 Active TVs query result:', JSON.stringify(activeTVs, null, 2));
                console.log('🧪 Active TVs type:', typeof activeTVs, Array.isArray(activeTVs));
                console.log('✅ Database connection test completed');
            }
        });
    }

    /**
     * Scan for latest APK in both debug and release folders
     */
    scanForLatestAPK() {
        try {
            const allApkFiles = [];

            // Scan debug folder
            if (fs.existsSync(this.debugPath)) {
                const debugFiles = fs.readdirSync(this.debugPath)
                    .filter(file => file.endsWith('.apk'))
                    .map(file => {
                        const filePath = path.join(this.debugPath, file);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            mtime: stats.mtime,
                            size: stats.size,
                            buildType: 'debug'
                        };
                    });
                allApkFiles.push(...debugFiles);
                console.log(`📱 Found ${debugFiles.length} debug APK(s)`);
            } else {
                console.log('⚠️ Debug APK folder not found:', this.debugPath);
            }

            // Scan release folder
            if (fs.existsSync(this.releasePath)) {
                const releaseFiles = fs.readdirSync(this.releasePath)
                    .filter(file => file.endsWith('.apk'))
                    .map(file => {
                        const filePath = path.join(this.releasePath, file);
                        const stats = fs.statSync(filePath);
                        return {
                            name: file,
                            path: filePath,
                            mtime: stats.mtime,
                            size: stats.size,
                            buildType: 'release'
                        };
                    });
                allApkFiles.push(...releaseFiles);
                console.log(`📱 Found ${releaseFiles.length} release APK(s)`);
            } else {
                console.log('⚠️ Release APK folder not found:', this.releasePath);
            }

            // Sort by modification time, newest first
            allApkFiles.sort((a, b) => b.mtime - a.mtime);

            if (allApkFiles.length > 0) {
                const latestApk = allApkFiles[0];
                this.latestApkPath = latestApk.path;
                this.latestTimestamp = latestApk.mtime.getTime(); // Use timestamp for comparison
                this.buildType = latestApk.buildType;

                console.log(`📱 Latest APK found: ${latestApk.name}`);
                console.log(`📱 Build type: ${this.buildType.toUpperCase()}`);
                console.log(`📱 Latest timestamp: ${this.latestTimestamp} (${latestApk.mtime.toISOString()})`);
                console.log(`📱 APK size: ${(latestApk.size / 1024 / 1024).toFixed(2)} MB`);
                console.log(`📱 APK path: ${this.latestApkPath}`);
            } else {
                console.log('⚠️ No APK files found in debug or release folders');
            }
        } catch (error) {
            console.error('❌ Error scanning for latest APK:', error.message);
        }
    }

    // Version extraction not needed anymore - using timestamp-based updates

    /**
     * Find aapt tool path
     */
    findAaptPath() {
        const possiblePaths = [
            path.join(__dirname, '../platform-tools/aapt.exe'),
            path.join(__dirname, '../platform-tools/aapt'),
            'aapt.exe',
            'aapt'
        ];

        for (const aaptPath of possiblePaths) {
            try {
                execSync(`"${aaptPath}" version`, { stdio: 'ignore' });
                return aaptPath;
            } catch (error) {
                // Continue to next path
            }
        }

        return null;
    }

    /**
     * Check if TV needs update based on timestamp
     */
    async checkTVNeedsUpdate(tvId, lastUpdateTimestamp) {
        if (!this.latestTimestamp) {
            return false;
        }

        // Convert lastUpdateTimestamp to number if it's a string
        const tvTimestamp = lastUpdateTimestamp ? parseInt(lastUpdateTimestamp) : 0;

        // TV needs update if APK is newer than TV's last update
        const needsUpdate = this.latestTimestamp > tvTimestamp;

        if (needsUpdate) {
            const apkDate = new Date(this.latestTimestamp).toISOString();
            const tvDate = tvTimestamp ? new Date(tvTimestamp).toISOString() : 'never';
            console.log(`🔄 TV ${tvId} needs update: APK ${apkDate} > TV ${tvDate}`);
        }

        return needsUpdate;
    }

    /**
     * Auto-update TV with latest APK
     */
    async autoUpdateTV(tvId, tvIpAddress) {
        if (this.isUpdating.has(tvId)) {
            console.log(`⏳ TV ${tvId} is already being updated`);
            return { success: false, message: 'Update already in progress' };
        }

        if (!this.latestApkPath || !fs.existsSync(this.latestApkPath)) {
            console.log(`❌ No APK available for TV ${tvId} update`);
            return { success: false, message: 'No APK available' };
        }

        this.isUpdating.add(tvId);

        try {
            console.log(`🚀 Starting auto-update for TV ${tvId} (${tvIpAddress})`);
            
            // Emit update started event
            this.emitUpdateEvent(tvId, 'update-started', {
                currentVersion: 'unknown',
                targetVersion: this.latestVersion,
                apkSize: fs.statSync(this.latestApkPath).size
            });

            // Step 1: Connect to TV via ADB
            const connectResult = await this.connectToTV(tvIpAddress);
            if (!connectResult.success) {
                throw new Error(`ADB connection failed: ${connectResult.message}`);
            }

            // Step 2: Push APK to TV
            this.emitUpdateEvent(tvId, 'update-progress', { 
                step: 'pushing', 
                message: 'Pushing APK to TV...' 
            });
            
            const pushResult = await this.pushAPKToTV(tvIpAddress);
            if (!pushResult.success) {
                throw new Error(`APK push failed: ${pushResult.message}`);
            }

            // Step 3: Install APK
            this.emitUpdateEvent(tvId, 'update-progress', { 
                step: 'installing', 
                message: 'Installing APK...' 
            });
            
            const installResult = await this.installAPKOnTV(tvIpAddress);
            if (!installResult.success) {
                throw new Error(`APK installation failed: ${installResult.message}`);
            }

            // Step 4: Start the app
            this.emitUpdateEvent(tvId, 'update-progress', { 
                step: 'starting', 
                message: 'Starting updated app...' 
            });
            
            await this.startHelperApp(tvIpAddress);

            // Update database with current timestamp
            await this.updateTVTimestamp(tvId, this.latestTimestamp);

            console.log(`✅ TV ${tvId} successfully updated to timestamp ${this.latestTimestamp}`);

            this.emitUpdateEvent(tvId, 'update-completed', {
                newTimestamp: this.latestTimestamp,
                message: 'Update completed successfully'
            });

            return { 
                success: true, 
                message: 'Update completed successfully',
                newVersion: this.latestVersion
            };

        } catch (error) {
            console.error(`❌ Auto-update failed for TV ${tvId}:`, error.message);
            
            this.emitUpdateEvent(tvId, 'update-failed', {
                error: error.message,
                message: 'Update failed'
            });

            return { 
                success: false, 
                message: error.message 
            };
        } finally {
            this.isUpdating.delete(tvId);
        }
    }

    /**
     * Connect to TV via ADB
     */
    async connectToTV(ipAddress) {
        return new Promise((resolve) => {
            const adbPath = this.getADBPath();
            const connectProcess = spawn(adbPath, ['connect', `${ipAddress}:5555`]);
            
            let output = '';
            let errorOutput = '';

            connectProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            connectProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            connectProcess.on('close', (code) => {
                if (code === 0 && output.includes('connected')) {
                    resolve({ success: true, message: 'Connected successfully' });
                } else {
                    resolve({ 
                        success: false, 
                        message: errorOutput || output || 'Connection failed' 
                    });
                }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                connectProcess.kill();
                resolve({ success: false, message: 'Connection timeout' });
            }, 10000);
        });
    }

    /**
     * Push APK to TV
     */
    async pushAPKToTV(ipAddress) {
        return new Promise((resolve) => {
            const adbPath = this.getADBPath();
            const remotePath = '/data/local/tmp/helper_update.apk';
            const pushProcess = spawn(adbPath, ['-s', `${ipAddress}:5555`, 'push', this.latestApkPath, remotePath]);
            
            let output = '';
            let errorOutput = '';

            pushProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pushProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pushProcess.on('close', (code) => {
                if (code === 0) {
                    resolve({ success: true, message: 'APK pushed successfully' });
                } else {
                    resolve({ 
                        success: false, 
                        message: errorOutput || output || 'Push failed' 
                    });
                }
            });

            // Timeout after 60 seconds (APK might be large)
            setTimeout(() => {
                pushProcess.kill();
                resolve({ success: false, message: 'Push timeout' });
            }, 60000);
        });
    }

    /**
     * Install APK on TV
     */
    async installAPKOnTV(ipAddress) {
        return new Promise((resolve) => {
            const adbPath = this.getADBPath();
            const remotePath = '/data/local/tmp/helper_update.apk';
            const installProcess = spawn(adbPath, ['-s', `${ipAddress}:5555`, 'shell', 'pm', 'install', '-r', remotePath]);
            
            let output = '';
            let errorOutput = '';

            installProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            installProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            installProcess.on('close', (code) => {
                if (code === 0 && output.includes('Success')) {
                    resolve({ success: true, message: 'APK installed successfully' });
                } else {
                    resolve({ 
                        success: false, 
                        message: errorOutput || output || 'Installation failed' 
                    });
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                installProcess.kill();
                resolve({ success: false, message: 'Installation timeout' });
            }, 30000);
        });
    }

    /**
     * Start helper app on TV
     */
    async startHelperApp(ipAddress) {
        return new Promise((resolve) => {
            const adbPath = this.getADBPath();
            const packageName = 'com.example.helperandroidtv';
            const activityName = 'com.example.helperandroidtv.MainActivity';
            
            const startProcess = spawn(adbPath, [
                '-s', `${ipAddress}:5555`, 
                'shell', 'am', 'start', 
                '-n', `${packageName}/${activityName}`
            ]);
            
            startProcess.on('close', (code) => {
                resolve({ success: code === 0 });
            });

            // Timeout after 10 seconds
            setTimeout(() => {
                startProcess.kill();
                resolve({ success: false });
            }, 10000);
        });
    }

    /**
     * Get ADB path
     */
    getADBPath() {
        const possiblePaths = [
            path.join(__dirname, '../platform-tools/adb.exe'),
            path.join(__dirname, '../platform-tools/adb'),
            'adb.exe',
            'adb'
        ];

        for (const adbPath of possiblePaths) {
            try {
                execSync(`"${adbPath}" version`, { stdio: 'ignore' });
                return adbPath;
            } catch (error) {
                // Continue to next path
            }
        }

        return 'adb'; // Fallback to system PATH
    }

    /**
     * Update TV timestamp in database (sqlite3 compatible)
     */
    async updateTVTimestamp(tvId, timestamp) {
        return new Promise((resolve, reject) => {
            this.db.run(`
                UPDATE tvs
                SET app_version = ?
                WHERE id = ?
            `, [timestamp.toString(), tvId], function(err) {
                if (err) {
                    console.error(`❌ Error updating TV ${tvId} timestamp in database:`, err.message);
                    reject(err);
                } else {
                    console.log(`📱 TV ${tvId} timestamp updated to ${timestamp} in database`);
                    resolve();
                }
            });
        });
    }

    /**
     * Emit update event via Socket.IO
     */
    emitUpdateEvent(tvId, eventType, data) {
        if (this.io) {
            this.io.emit('tv-update-event', {
                tvId,
                eventType,
                timestamp: new Date().toISOString(),
                ...data
            });
        }
    }

    /**
     * Check all TVs for updates based on timestamp (sqlite3 compatible)
     */
    async checkAllTVsForUpdates() {
        return new Promise((resolve, reject) => {
            try {
                const query = `
                    SELECT id, name, ip_address, app_version, monitoring_status
                    FROM tvs
                    WHERE monitoring_status = 'active'
                `;

                this.db.all(query, [], async (err, activeTVs) => {
                    if (err) {
                        console.error('❌ Database query error:', err.message);
                        reject(err);
                        return;
                    }

                    console.log(`🔍 Checking ${activeTVs ? activeTVs.length : 0} active TVs for updates...`);
                    console.log(`📊 Active TVs data:`, JSON.stringify(activeTVs, null, 2));

                    if (activeTVs && Array.isArray(activeTVs)) {
                        for (const tv of activeTVs) {
                            console.log(`🔍 Checking TV ${tv.id} (${tv.name}) at ${tv.ip_address}`);
                            // Use app_version field to store timestamp
                            const needsUpdate = await this.checkTVNeedsUpdate(tv.id, tv.app_version);
                            if (needsUpdate) {
                                console.log(`🔄 Scheduling auto-update for TV ${tv.id} (${tv.name}) at ${tv.ip_address}`);
                                // Schedule update (don't await to avoid blocking)
                                this.autoUpdateTV(tv.id, tv.ip_address).catch(error => {
                                    console.error(`❌ Auto-update failed for TV ${tv.id}:`, error.message);
                                });
                            } else {
                                console.log(`✅ TV ${tv.id} is already up to date`);
                            }
                        }
                        resolve();
                    } else {
                        console.error('❌ activeTVs is not an array:', typeof activeTVs, activeTVs);
                        resolve();
                    }
                });
            } catch (error) {
                console.error('❌ Error checking TVs for updates:', error.message);
                console.error('❌ Error stack:', error.stack);
                reject(error);
            }
        });
    }

    /**
     * Watch for new APK builds in both debug and release folders
     */
    startAPKWatcher() {
        const watchFolders = [];

        // Add debug folder if exists
        if (fs.existsSync(this.debugPath)) {
            watchFolders.push({ path: this.debugPath, type: 'debug' });
        }

        // Add release folder if exists
        if (fs.existsSync(this.releasePath)) {
            watchFolders.push({ path: this.releasePath, type: 'release' });
        }

        if (watchFolders.length === 0) {
            console.log('⚠️ No APK output folders found, skipping watcher');
            return;
        }

        watchFolders.forEach(folder => {
            console.log(`👀 Watching for new ${folder.type.toUpperCase()} APK builds in: ${folder.path}`);

            fs.watch(folder.path, (eventType, filename) => {
                if (filename && filename.endsWith('.apk')) {
                    console.log(`📱 New ${folder.type.toUpperCase()} APK detected: ${filename}`);

                    // Wait a bit for file to be fully written
                    setTimeout(() => {
                        this.scanForLatestAPK();

                        // Auto-check all TVs for updates
                        setTimeout(() => {
                            this.checkAllTVsForUpdates();
                        }, 2000);
                    }, 1000);
                }
            });
        });
    }
}

module.exports = AutoUpdateService;
