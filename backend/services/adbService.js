const path = require('path');
const fs = require('fs').promises;
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

// Path ke adb.exe
const ADB_PATH = path.join(__dirname, '..', 'platform-tools', 'adb.exe');
const execAsync = promisify(exec);

// Helper app configuration
const HELPER_APP_PACKAGE = 'com.example.helperandroidtv';
const HELPER_APP_ACTIVITY = 'com.example.helperandroidtv.MainActivity';
// Use relative path to helperAndroidTV build output (works on any computer)
const APK_PATH = path.join(__dirname, '..', '..', 'helperAndroidTV', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');

class ADBService {
    constructor() {
        this.initializeClient();
    }

    /**
     * Initialize ADB client
     */
    async initializeClient() {
        try {
            // Verify APK path on startup
            await this.verifyApkPath();
            console.log('✅ [ADB Service] Initialized successfully');
        } catch (error) {
            console.error('❌ [ADB Service] Failed to initialize:', error);
            // Don't throw error to allow service to start, just log warning
        }
    }

    /**
     * Verify APK path exists and provide helpful information
     */
    async verifyApkPath() {
        try {
            await fs.access(APK_PATH);
            const stats = await fs.stat(APK_PATH);
            const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            const relativePath = path.relative(process.cwd(), APK_PATH);
            console.log(`📱 [ADB Service] Helper APK found: ${relativePath} (${fileSizeMB} MB)`);
            return true;
        } catch (error) {
            const relativePath = path.relative(process.cwd(), APK_PATH);
            console.warn(`⚠️ [ADB Service] Helper APK not found: ${relativePath}`);
            console.warn(`💡 [ADB Service] To build APK: cd helperAndroidTV && ./gradlew assembleDebug`);
            return false;
        }
    }

    /**
     * Connect to Android TV via IP address and request debugging permission
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Connection result
     */
    async connectToTV(ipAddress, port = 5555) {
        try {
            // Validate IP address format
            if (!this.isValidIPAddress(ipAddress)) {
                return {
                    success: false,
                    status: 'invalid_ip',
                    message: 'Format alamat IP tidak valid. Contoh: 192.168.1.100',
                    deviceId: `${ipAddress}:${port}`
                };
            }

            const deviceId = `${ipAddress}:${port}`;

            // First, test network connectivity
            const networkTest = await this.testNetworkConnectivity(ipAddress);

            if (!networkTest.reachable) {
                return {
                    success: false,
                    status: 'network_unreachable',
                    message: 'TV tidak dapat dijangkau melalui jaringan. Periksa koneksi dan IP address.',
                    deviceId: deviceId,
                    networkTest: networkTest,
                    troubleshooting: [
                        'Periksa apakah TV terhubung ke WiFi yang sama',
                        'Verifikasi IP address TV di pengaturan jaringan',
                        'Pastikan tidak ada firewall yang memblokir koneksi',
                        'Coba restart router dan TV'
                    ]
                };
            }

            // Network is reachable, now try ADB connection
            try {
                // Use adb connect command with timeout
                const connectResult = await Promise.race([
                    this.executeAdbCommand(['connect', deviceId]),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Connection timeout')), 15000)
                    )
                ]);

                if (connectResult.includes('connected') || connectResult.includes('already connected')) {
                    // Wait for device to be recognized and potentially show debugging dialog
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check if device is authorized using adb devices command
                    const devicesResult = await this.executeAdbCommand(['devices']);
                    const deviceLines = devicesResult.split('\n').filter(line => line.includes(deviceId));

                    if (deviceLines.length > 0) {
                        const deviceLine = deviceLines[0];

                        if (deviceLine.includes('device') && !deviceLine.includes('unauthorized')) {
                            return {
                                success: true,
                                status: 'authorized',
                                message: 'TV berhasil terhubung dan diotorisasi',
                                deviceId: deviceId,
                                connectOutput: connectResult
                            };
                        } else if (deviceLine.includes('unauthorized')) {
                            return {
                                success: false,
                                status: 'unauthorized',
                                message: 'TV terhubung tetapi belum diotorisasi. Dialog debugging harus muncul di TV.',
                                deviceId: deviceId,
                                connectOutput: connectResult,
                                instructions: [
                                    'Lihat layar TV untuk dialog konfirmasi debugging',
                                    'Pilih "Allow" atau "Izinkan" pada dialog tersebut',
                                    'Centang "Always allow from this computer" jika tersedia',
                                    'Dialog mungkin muncul beberapa detik setelah koneksi'
                                ]
                            };
                        }
                    }

                    // Connection successful but device not showing up yet
                    return {
                        success: false,
                        status: 'connecting',
                        message: 'Koneksi berhasil, menunggu TV muncul dalam daftar perangkat. Dialog debugging mungkin akan muncul.',
                        deviceId: deviceId,
                        connectOutput: connectResult,
                        instructions: [
                            'Tunggu beberapa detik untuk dialog debugging muncul di TV',
                            'Jika dialog tidak muncul, periksa pengaturan Developer Options',
                            'Pastikan USB Debugging aktif di TV'
                        ]
                    };
                } else if (connectResult.includes('cannot connect') || connectResult.includes('failed to connect')) {
                    return {
                        success: false,
                        status: 'connection_refused',
                        message: 'Koneksi ditolak. Pastikan ADB debugging aktif di TV.',
                        deviceId: deviceId,
                        connectOutput: connectResult,
                        troubleshooting: [
                            'Buka Settings > Device Preferences > Developer options',
                            'Aktifkan "USB debugging"',
                            'Pastikan TV terhubung ke jaringan yang sama',
                            'Restart TV setelah mengaktifkan debugging'
                        ]
                    };
                } else {
                    return {
                        success: false,
                        status: 'connection_failed',
                        message: 'Gagal terhubung ke TV. Periksa alamat IP dan pengaturan jaringan.',
                        deviceId: deviceId,
                        connectOutput: connectResult
                    };
                }
            } catch (timeoutError) {
                if (timeoutError.message === 'Connection timeout') {
                    return {
                        success: false,
                        status: 'timeout',
                        message: 'Koneksi timeout. TV mungkin tidak dapat dijangkau atau sedang sibuk.',
                        deviceId: deviceId,
                        troubleshooting: [
                            'Pastikan TV dalam keadaan hidup',
                            'Periksa koneksi jaringan TV',
                            'Coba restart TV dan coba lagi'
                        ]
                    };
                }
                throw timeoutError;
            }
        } catch (error) {
            console.error('Error connecting to TV:', error);

            // Categorize different types of errors
            let errorMessage = 'Terjadi kesalahan saat menghubungkan ke TV';
            let errorStatus = 'error';
            let troubleshooting = [];

            if (error.message.includes('ENOTFOUND') || error.message.includes('EHOSTUNREACH')) {
                errorMessage = 'TV tidak dapat dijangkau. Periksa alamat IP dan koneksi jaringan.';
                errorStatus = 'network_error';
                troubleshooting = [
                    'Pastikan TV terhubung ke jaringan WiFi',
                    'Periksa alamat IP TV di pengaturan jaringan',
                    'Pastikan komputer dan TV dalam jaringan yang sama'
                ];
            } else if (error.message.includes('ECONNREFUSED')) {
                errorMessage = 'Koneksi ditolak. ADB debugging mungkin tidak aktif.';
                errorStatus = 'connection_refused';
                troubleshooting = [
                    'Aktifkan Developer Options di TV',
                    'Aktifkan USB Debugging',
                    'Restart TV setelah mengaktifkan debugging'
                ];
            } else if (error.message.includes('spawn') || error.message.includes('ENOENT')) {
                errorMessage = 'ADB tidak dapat dijalankan. Periksa instalasi ADB.';
                errorStatus = 'adb_error';
            }

            return {
                success: false,
                status: errorStatus,
                message: errorMessage,
                deviceId: `${ipAddress}:${port}`,
                error: error.message,
                troubleshooting: troubleshooting
            };
        }
    }

    /**
     * Validate IP address format
     * @param {string} ip - IP address to validate
     * @returns {boolean} True if valid IP address
     */
    isValidIPAddress(ip) {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    }

    /**
     * Test network connectivity to TV
     * @param {string} ipAddress - IP address to test
     * @returns {Promise<Object>} Network test result
     */
    async testNetworkConnectivity(ipAddress) {
        try {
            // Use ping to test basic connectivity (Windows)
            const pingResult = await this.executeCommand('ping', ['-n', '2', ipAddress]);

            const isReachable = pingResult.includes('Reply from') || pingResult.includes('bytes from');

            return {
                reachable: isReachable,
                pingOutput: pingResult,
                message: isReachable ? 'TV dapat dijangkau melalui jaringan' : 'TV tidak dapat dijangkau melalui jaringan'
            };
        } catch (error) {
            console.error(`❌ [ADB Service] Network test error:`, error);
            return {
                reachable: false,
                error: error.message,
                message: 'Gagal melakukan test konektivitas jaringan'
            };
        }
    }

    /**
     * Execute general command (not just ADB)
     * @param {string} command - Command to execute
     * @param {Array} args - Command arguments
     * @returns {Promise<string>} Command output
     */
    async executeCommand(command, args) {
        return new Promise((resolve, reject) => {
            const process = spawn(command, args);
            let output = '';
            let errorOutput = '';

            process.stdout.on('data', (data) => {
                output += data.toString();
            });

            process.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            process.on('close', (code) => {
                if (code === 0 || output.length > 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(errorOutput.trim() || `Command failed with code ${code}`));
                }
            });

            process.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Check if device is connected and authorized
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Device status
     */
    async checkDeviceStatus(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            // Get list of connected devices
            const devicesResult = await this.executeAdbCommand(['devices']);

            const deviceLines = devicesResult.split('\n').filter(line => line.includes(deviceId));

            if (deviceLines.length > 0) {
                const deviceLine = deviceLines[0];

                // More precise status detection
                const parts = deviceLine.trim().split(/\s+/);
                const status = parts[1] || 'unknown';
                const isAuthorized = status === 'device';

                const result = {
                    connected: true,
                    authorized: isAuthorized,
                    status: status,
                    deviceId: deviceId,
                    rawLine: deviceLine.trim()
                };

                return result;
            } else {
                return {
                    connected: false,
                    authorized: false,
                    status: 'disconnected',
                    deviceId: deviceId
                };
            }
        } catch (error) {
            console.error('❌ [ADB Service] Error checking device status:', error);
            return {
                connected: false,
                authorized: false,
                status: 'error',
                error: error.message,
                deviceId: `${ipAddress}:${port}`
            };
        }
    }

    /**
     * Disconnect from Android TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Disconnect result
     */
    async disconnectFromTV(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;
            const disconnectResult = await this.executeAdbCommand(['disconnect', deviceId]);
            
            return {
                success: true,
                message: 'TV berhasil diputus koneksinya',
                result: disconnectResult
            };
        } catch (error) {
            console.error('Error disconnecting from TV:', error);
            return {
                success: false,
                message: `Error: ${error.message}`
            };
        }
    }

    /**
     * Execute ADB command
     * @param {Array} args - ADB command arguments
     * @returns {Promise<string>} Command output
     */
    async executeAdbCommand(args) {
        return new Promise((resolve, reject) => {
            const adbProcess = spawn(ADB_PATH, args);
            let output = '';
            let errorOutput = '';

            adbProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            adbProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            adbProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(output.trim());
                } else {
                    reject(new Error(errorOutput.trim() || `ADB command failed with code ${code}`));
                }
            });

            adbProcess.on('error', (error) => {
                reject(error);
            });
        });
    }

    /**
     * Get list of connected devices
     * @returns {Promise<Array>} List of connected devices
     */
    async getConnectedDevices() {
        try {
            const devicesResult = await this.executeAdbCommand(['devices']);
            const deviceLines = devicesResult.split('\n')
                .filter(line => line.trim() && !line.includes('List of devices'))
                .map(line => line.trim());

            return deviceLines.map(line => {
                const parts = line.split('\t');
                const id = parts[0];
                const status = parts[1] || 'unknown';

                return {
                    id: id,
                    type: status,
                    authorized: status === 'device'
                };
            });
        } catch (error) {
            console.error('Error getting connected devices:', error);
            throw error;
        }
    }

    /**
     * Complete TV setup - install Helper app and configure TV ID
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} tvId - TV ID from database
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Setup result
     */
    async setupTvComplete(ipAddress, tvId, port = 5555) {
        try {
            console.log(`🔧 [ADB Setup] Starting complete TV setup for ${ipAddress} with TV ID ${tvId}`);

            const deviceId = `${ipAddress}:${port}`;
            const setupResults = {
                deviceId: deviceId,
                tvId: tvId,
                steps: {}
            };

            // Step 1: Check if Helper app is installed
            console.log(`📱 [ADB Setup] Checking if Helper app is installed...`);
            const isInstalled = await this.checkHelperAppInstalled(ipAddress, port);
            setupResults.steps.appInstalled = isInstalled;

            if (!isInstalled) {
                // Step 2: Install Helper app
                console.log(`📦 [ADB Setup] Installing Helper app...`);
                const installResult = await this.installHelperApp(ipAddress, port);
                setupResults.steps.appInstallation = installResult;

                if (!installResult.success) {
                    throw new Error(`Failed to install Helper app: ${installResult.error}`);
                }
            } else {
                console.log(`✅ [ADB Setup] Helper app already installed`);
                setupResults.steps.appInstallation = { success: true, message: 'Already installed' };
            }

            // Step 3: Grant overlay permission
            console.log(`🔐 [ADB Setup] Granting overlay permission...`);
            const overlayResult = await this.grantOverlayPermission(ipAddress, port);
            setupResults.steps.overlayPermission = overlayResult;

            // Step 4: Configure TV ID
            console.log(`🆔 [ADB Setup] Configuring TV ID...`);
            const configResult = await this.configureTvId(ipAddress, tvId, port);
            setupResults.steps.tvIdConfiguration = configResult;

            // Step 5: Launch Helper app
            console.log(`🚀 [ADB Setup] Launching Helper app...`);
            const launchResult = await this.launchHelperApp(ipAddress, port);
            setupResults.steps.appLaunch = launchResult;

            console.log(`✅ [ADB Setup] Complete TV setup finished successfully for ${ipAddress}`);

            return {
                success: true,
                message: 'TV setup completed successfully',
                details: setupResults
            };

        } catch (error) {
            console.error(`❌ [ADB Setup] Error during complete TV setup for ${ipAddress}:`, error);
            return {
                success: false,
                message: `Setup failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Check if Helper app is installed on the TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<boolean>} True if app is installed
     */
    async checkHelperAppInstalled(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'pm', 'list', 'packages', HELPER_APP_PACKAGE
            ]);

            const isInstalled = result.includes(HELPER_APP_PACKAGE);
            console.log(`📱 [ADB Setup] Helper app installed check: ${isInstalled}`);
            return isInstalled;

        } catch (error) {
            console.error(`❌ [ADB Setup] Error checking app installation:`, error);
            return false;
        }
    }

    /**
     * Install Helper app APK on the TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Installation result
     */
    async installHelperApp(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            // Check if APK file exists and get file info
            try {
                await fs.access(APK_PATH);
                const stats = await fs.stat(APK_PATH);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                console.log(`📦 [ADB Setup] Found APK: ${APK_PATH} (${fileSizeMB} MB)`);
            } catch (error) {
                const relativePath = path.relative(process.cwd(), APK_PATH);
                throw new Error(`APK file not found at ${relativePath}. Please build the Android project first: cd helperAndroidTV && ./gradlew assembleDebug`);
            }

            console.log(`📦 [ADB Setup] Installing Helper app to ${deviceId}...`);

            // Install APK with replace flag
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'install', '-r', APK_PATH
            ]);

            if (result.includes('Success') || result.includes('success')) {
                console.log(`✅ [ADB Setup] Helper app installed successfully`);
                return {
                    success: true,
                    message: 'Helper app installed successfully',
                    apkPath: path.relative(process.cwd(), APK_PATH)
                };
            } else {
                throw new Error(`Installation failed: ${result}`);
            }

        } catch (error) {
            console.error(`❌ [ADB Setup] Error installing Helper app:`, error);
            return {
                success: false,
                error: error.message,
                apkPath: path.relative(process.cwd(), APK_PATH)
            };
        }
    }

    /**
     * Grant overlay permission to Helper app
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Permission grant result
     */
    async grantOverlayPermission(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            console.log(`🔐 [ADB Setup] Granting overlay permission...`);

            // Grant SYSTEM_ALERT_WINDOW permission
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'appops', 'set', HELPER_APP_PACKAGE,
                'SYSTEM_ALERT_WINDOW', 'allow'
            ]);

            console.log(`✅ [ADB Setup] Overlay permission granted`);
            return {
                success: true,
                message: 'Overlay permission granted successfully'
            };

        } catch (error) {
            console.error(`❌ [ADB Setup] Error granting overlay permission:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Configure TV ID in Helper app via broadcast
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} tvId - TV ID from database
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Configuration result
     */
    async configureTvId(ipAddress, tvId, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            console.log(`🆔 [ADB Setup] Configuring TV ID ${tvId}...`);

            // Send broadcast intent with TV ID
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'am', 'broadcast',
                '-a', 'com.example.helperandroidtv.SET_TV_ID',
                '--es', 'tv_id', tvId.toString()
            ]);

            if (result.includes('Broadcast completed')) {
                console.log(`✅ [ADB Setup] TV ID configured successfully`);
                return {
                    success: true,
                    message: 'TV ID configured successfully'
                };
            } else {
                throw new Error(`Broadcast failed: ${result}`);
            }

        } catch (error) {
            console.error(`❌ [ADB Setup] Error configuring TV ID:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Launch Helper app on the TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<boolean>} True if launch successful
     */
    async launchHelperApp(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            console.log(`🚀 [ADB Monitoring] Launching Helper app on ${ipAddress}...`);

            // Launch main activity
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'am', 'start',
                '-n', `${HELPER_APP_PACKAGE}/${HELPER_APP_ACTIVITY}`
            ]);

            const success = result.includes('Starting') || result.includes('Activity');

            if (success) {
                console.log(`✅ [ADB Monitoring] Helper app launched successfully on ${ipAddress}`);
            } else {
                console.log(`❌ [ADB Monitoring] Failed to launch Helper app on ${ipAddress}: ${result}`);
            }

            return success;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error launching Helper app on ${ipAddress}:`, error);
            return false;
        }
    }

    /**
     * Check if Helper app process is running on the TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<boolean>} True if process is running
     */
    async checkHelperAppProcess(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            // Method 1: Check running processes
            try {
                const psResult = await this.executeAdbCommand([
                    '-s', deviceId,
                    'shell', 'ps | grep', HELPER_APP_PACKAGE
                ]);

                if (psResult && psResult.includes(HELPER_APP_PACKAGE)) {
                    console.log(`✅ [ADB Monitoring] Helper app process running on ${ipAddress}`);
                    return true;
                }
            } catch (psError) {
                // ps command might fail, try alternative method
                console.log(`[ADB Monitoring] ps command failed for ${ipAddress}, trying alternative method`);
            }

            // Method 2: Check activity stack (alternative approach)
            try {
                const activityResult = await this.executeAdbCommand([
                    '-s', deviceId,
                    'shell', 'dumpsys', 'activity', 'activities'
                ]);

                if (activityResult && activityResult.includes(HELPER_APP_PACKAGE)) {
                    console.log(`✅ [ADB Monitoring] Helper app activity found on ${ipAddress}`);
                    return true;
                }
            } catch (activityError) {
                console.log(`[ADB Monitoring] Activity check failed for ${ipAddress}`);
            }

            // Method 3: Check if package is in foreground
            try {
                const foregroundResult = await this.executeAdbCommand([
                    '-s', deviceId,
                    'shell', 'dumpsys', 'activity', 'top'
                ]);

                if (foregroundResult && foregroundResult.includes(HELPER_APP_PACKAGE)) {
                    console.log(`✅ [ADB Monitoring] Helper app in foreground on ${ipAddress}`);
                    return true;
                }
            } catch (foregroundError) {
                console.log(`[ADB Monitoring] Foreground check failed for ${ipAddress}`);
            }

            console.log(`❌ [ADB Monitoring] Helper app process not found on ${ipAddress}`);
            return false;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error checking Helper app process on ${ipAddress}:`, error);
            return false;
        }
    }

    /**
     * Force stop Helper app on the TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<boolean>} True if force stop successful
     */
    async forceStopHelperApp(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            console.log(`🛑 [ADB Monitoring] Force stopping Helper app on ${ipAddress}...`);

            // Force stop the application
            await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'am', 'force-stop', HELPER_APP_PACKAGE
            ]);

            // Force stop command usually doesn't return specific success message
            // We'll assume success if no error was thrown
            console.log(`✅ [ADB Monitoring] Helper app force stopped on ${ipAddress}`);
            return true;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error force stopping Helper app on ${ipAddress}:`, error);
            return false;
        }
    }

    /**
     * Get detailed process information for Helper app
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<Object>} Process information
     */
    async getHelperAppProcessInfo(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            const processInfo = {
                isRunning: false,
                processId: null,
                memoryUsage: null,
                cpuUsage: null,
                activityState: 'unknown'
            };

            // Get process list with detailed info
            try {
                const psResult = await this.executeAdbCommand([
                    '-s', deviceId,
                    'shell', 'ps -A | grep', HELPER_APP_PACKAGE
                ]);

                if (psResult && psResult.includes(HELPER_APP_PACKAGE)) {
                    processInfo.isRunning = true;

                    // Extract process ID from ps output
                    const psLines = psResult.split('\n');
                    for (const line of psLines) {
                        if (line.includes(HELPER_APP_PACKAGE)) {
                            const parts = line.trim().split(/\s+/);
                            if (parts.length >= 2) {
                                processInfo.processId = parts[1]; // PID is usually second column
                            }
                            break;
                        }
                    }
                }
            } catch (psError) {
                console.log(`[ADB Monitoring] Detailed ps command failed for ${ipAddress}`);
            }

            // Get activity state
            try {
                const activityResult = await this.executeAdbCommand([
                    '-s', deviceId,
                    'shell', 'dumpsys', 'activity', 'activities', '|', 'grep', HELPER_APP_PACKAGE
                ]);

                if (activityResult) {
                    if (activityResult.includes('mResumedActivity')) {
                        processInfo.activityState = 'resumed';
                    } else if (activityResult.includes('mPausedActivity')) {
                        processInfo.activityState = 'paused';
                    } else if (activityResult.includes(HELPER_APP_PACKAGE)) {
                        processInfo.activityState = 'background';
                    }
                }
            } catch (activityError) {
                console.log(`[ADB Monitoring] Activity state check failed for ${ipAddress}`);
            }

            return processInfo;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error getting process info for ${ipAddress}:`, error);
            return {
                isRunning: false,
                processId: null,
                memoryUsage: null,
                cpuUsage: null,
                activityState: 'error',
                error: error.message
            };
        }
    }

    /**
     * Restart Helper app (force stop + launch)
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @returns {Promise<boolean>} True if restart successful
     */
    async restartHelperApp(ipAddress, port = 5555) {
        try {
            console.log(`🔄 [ADB Monitoring] Restarting Helper app on ${ipAddress}...`);

            // Step 1: Force stop
            const stopSuccess = await this.forceStopHelperApp(ipAddress, port);

            if (!stopSuccess) {
                console.log(`⚠️ [ADB Monitoring] Force stop failed, but continuing with launch...`);
            }

            // Step 2: Wait a moment
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Step 3: Launch
            const launchSuccess = await this.launchHelperApp(ipAddress, port);

            if (launchSuccess) {
                console.log(`✅ [ADB Monitoring] Helper app restarted successfully on ${ipAddress}`);
            } else {
                console.log(`❌ [ADB Monitoring] Helper app restart failed on ${ipAddress}`);
            }

            return launchSuccess;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error restarting Helper app on ${ipAddress}:`, error);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new ADBService();
