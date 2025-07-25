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
                    console.log(`✅ [ADB Connect] Connection successful: ${connectResult.trim()}`);

                    // Wait for device to be recognized and potentially show debugging dialog
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check if device is authorized using adb devices command
                    const devicesResult = await this.executeAdbCommand(['devices']);
                    console.log(`📱 [ADB Devices] Result: ${devicesResult.trim()}`);

                    const deviceLines = devicesResult.split('\n').filter(line => line.includes(deviceId));
                    console.log(`🔍 [ADB Devices] Found device lines: ${JSON.stringify(deviceLines)}`);

                    if (deviceLines.length > 0) {
                        const deviceLine = deviceLines[0];
                        console.log(`📋 [ADB Devices] Device line: "${deviceLine.trim()}"`);

                        if (deviceLine.includes('device') && !deviceLine.includes('unauthorized')) {
                            console.log(`✅ [ADB Connect] Device authorized immediately`);
                            return {
                                success: true,
                                status: 'authorized',
                                message: 'TV berhasil terhubung dan diotorisasi',
                                deviceId: deviceId,
                                connectOutput: connectResult
                            };
                        } else if (deviceLine.includes('unauthorized')) {
                            console.log(`🔐 [ADB Connect] Device connected but unauthorized - waiting for user approval`);
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
                        } else {
                            console.log(`⚠️ [ADB Connect] Device found but unknown status: "${deviceLine.trim()}"`);
                            // Device found but unknown status - still try to wait for authorization
                            return {
                                success: false,
                                status: 'connecting',
                                message: 'TV terhubung dengan status tidak dikenal. Menunggu dialog debugging...',
                                deviceId: deviceId,
                                connectOutput: connectResult,
                                deviceLine: deviceLine.trim()
                            };
                        }
                    }

                    // Connection successful but device not showing up yet - this is NORMAL for first connection
                    console.log(`⏳ [ADB Connect] Connection successful but device not in list yet - waiting for authorization dialog`);
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
                    console.log(`❌ [ADB Connect] Connection refused: ${connectResult.trim()}`);
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
                    // Unknown adb connect output - log it and treat as connecting (not failed!)
                    console.log(`⚠️ [ADB Connect] Unknown connect result: "${connectResult.trim()}" - treating as connecting`);
                    return {
                        success: false,
                        status: 'connecting',
                        message: 'Koneksi dalam proses. Menunggu dialog debugging muncul di TV...',
                        deviceId: deviceId,
                        connectOutput: connectResult,
                        note: 'Unknown connect result - treated as connecting to allow authorization wait'
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
     * Wait for user to authorize ADB debugging on TV
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @param {number} maxWaitTime - Maximum wait time in milliseconds (default: 60000)
     * @param {Function} statusCallback - Optional callback for status updates
     * @returns {Promise<Object>} Authorization result
     */
    async waitForAuthorization(ipAddress, port = 5555, maxWaitTime = 60000, statusCallback = null) {
        try {
            const startTime = Date.now();
            const deviceId = `${ipAddress}:${port}`;
            let lastStatus = null;

            console.log(`⏳ [ADB Auth] Waiting for user authorization on ${ipAddress} (timeout: ${maxWaitTime/1000}s)`);

            if (statusCallback) {
                statusCallback({
                    type: 'waiting_authorization',
                    message: 'Menunggu persetujuan debugging di TV...',
                    instructions: [
                        'Lihat layar TV untuk dialog konfirmasi debugging',
                        'Pilih "Allow" atau "Izinkan" pada dialog tersebut',
                        'Centang "Always allow from this computer" jika tersedia'
                    ]
                });
            }

            while (Date.now() - startTime < maxWaitTime) {
                const status = await this.checkDeviceStatus(ipAddress, port);

                // Log status change
                if (status.status !== lastStatus) {
                    console.log(`📱 [ADB Auth] Device status changed: ${lastStatus} → ${status.status}`);
                    lastStatus = status.status;

                    if (statusCallback) {
                        statusCallback({
                            type: 'status_update',
                            status: status.status,
                            authorized: status.authorized,
                            connected: status.connected
                        });
                    }
                }

                if (status.authorized && status.status === 'device') {
                    console.log(`✅ [ADB Auth] TV authorized successfully at ${ipAddress}`);

                    if (statusCallback) {
                        statusCallback({
                            type: 'authorized',
                            message: 'TV berhasil diotorisasi! Melanjutkan setup...'
                        });
                    }

                    return {
                        success: true,
                        message: 'TV berhasil diotorisasi',
                        deviceId: deviceId,
                        waitTime: Date.now() - startTime
                    };
                }

                if (status.status === 'unauthorized') {
                    // Masih menunggu user accept
                    const elapsed = Math.floor((Date.now() - startTime) / 1000);
                    const remaining = Math.floor((maxWaitTime - (Date.now() - startTime)) / 1000);

                    if (statusCallback && elapsed % 10 === 0) { // Update setiap 10 detik
                        statusCallback({
                            type: 'waiting_progress',
                            message: `Menunggu persetujuan... (${remaining}s tersisa)`,
                            elapsed: elapsed,
                            remaining: remaining
                        });
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000)); // Poll setiap 2 detik
                    continue;
                }

                if (!status.connected) {
                    console.log(`❌ [ADB Auth] Connection lost to ${ipAddress}`);

                    if (statusCallback) {
                        statusCallback({
                            type: 'connection_lost',
                            message: 'Koneksi ke TV terputus'
                        });
                    }

                    return {
                        success: false,
                        message: 'Koneksi ke TV terputus selama menunggu otorisasi',
                        deviceId: deviceId,
                        status: status.status
                    };
                }

                // Status lain yang tidak diharapkan
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            // Timeout
            console.log(`⏰ [ADB Auth] Authorization timeout for ${ipAddress} after ${maxWaitTime/1000}s`);

            if (statusCallback) {
                statusCallback({
                    type: 'timeout',
                    message: 'Timeout menunggu persetujuan debugging'
                });
            }

            return {
                success: false,
                message: `Timeout menunggu otorisasi debugging (${maxWaitTime/1000}s)`,
                deviceId: deviceId,
                timeout: true
            };

        } catch (error) {
            console.error(`❌ [ADB Auth] Error waiting for authorization:`, error);

            if (statusCallback) {
                statusCallback({
                    type: 'error',
                    message: `Error: ${error.message}`
                });
            }

            return {
                success: false,
                message: `Error menunggu otorisasi: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Setup TV without launching app - for "Setup TV Otomatis"
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} port - ADB port (default: 5555)
     * @param {Function} statusCallback - Optional callback for status updates
     * @returns {Promise<Object>} Setup result
     */
    async setupTvWithoutLaunch(ipAddress, port = 5555, statusCallback = null) {
        try {
            console.log(`🔧 [ADB Setup Without Launch] Starting TV setup for ${ipAddress}`);

            const deviceId = `${ipAddress}:${port}`;
            const setupResults = {
                deviceId: deviceId,
                steps: {}
            };

            // Step 1: Connect to TV
            console.log(`🔌 [ADB Setup] Connecting to TV...`);
            if (statusCallback) {
                statusCallback({
                    type: 'connecting',
                    message: 'Menghubungkan ke TV...'
                });
            }

            const connectResult = await this.connectToTV(ipAddress, port);
            setupResults.steps.connection = connectResult;

            // Step 1.5: Wait for authorization if needed
            if (connectResult.status === 'unauthorized') {
                console.log(`🔐 [ADB Setup] TV not authorized, waiting for user acceptance...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${authResult.message}`);
                }
            } else if (connectResult.status === 'connecting') {
                console.log(`🔄 [ADB Setup] TV connecting, waiting for authorization dialog...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${authResult.message}`);
                }
            } else if (connectResult.success && connectResult.status === 'authorized') {
                console.log(`✅ [ADB Setup] TV already authorized`);
                setupResults.steps.authorization = { success: true, message: 'Already authorized' };
            } else if (!connectResult.success && ['network_unreachable', 'connection_refused', 'timeout'].includes(connectResult.status)) {
                // Only throw error for REAL connection failures (removed 'connection_failed' since we changed it to 'connecting')
                throw new Error(`Connection failed: ${connectResult.message}`);
            } else {
                // For any other status, try to wait for authorization as fallback
                console.log(`🔄 [ADB Setup] Unknown status '${connectResult.status}', attempting authorization wait...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${connectResult.message || authResult.message}`);
                }
            }

            // Step 2: Check if Helper app is installed
            console.log(`📱 [ADB Setup] Checking if Helper app is installed...`);
            const isInstalled = await this.checkHelperAppInstalled(ipAddress, port);
            setupResults.steps.appInstalled = isInstalled;

            if (!isInstalled) {
                // Step 3: Install Helper app
                console.log(`📦 [ADB Setup] Installing Helper app...`);
                if (statusCallback) {
                    statusCallback({
                        type: 'installing_app',
                        message: 'Menginstall aplikasi Helper...'
                    });
                }

                const installResult = await this.installHelperApp(ipAddress, port);
                setupResults.steps.appInstallation = installResult;

                if (!installResult.success) {
                    throw new Error(`Failed to install Helper app: ${installResult.error}`);
                }
            } else {
                console.log(`✅ [ADB Setup] Helper app already installed`);
                setupResults.steps.appInstallation = { success: true, message: 'Already installed' };
            }

            // Step 4: Grant overlay permission
            console.log(`🔐 [ADB Setup] Granting overlay permission...`);
            if (statusCallback) {
                statusCallback({
                    type: 'granting_permission',
                    message: 'Memberikan izin overlay...'
                });
            }

            const overlayResult = await this.grantOverlayPermission(ipAddress, port);
            setupResults.steps.overlayPermission = overlayResult;

            console.log(`✅ [ADB Setup Without Launch] Setup completed successfully for ${ipAddress}`);

            if (statusCallback) {
                statusCallback({
                    type: 'setup_completed',
                    message: 'Setup berhasil diselesaikan!'
                });
            }

            return {
                success: true,
                message: 'TV setup completed successfully (without launch)',
                details: setupResults
            };

        } catch (error) {
            console.error(`❌ [ADB Setup Without Launch] Error during TV setup for ${ipAddress}:`, error);
            return {
                success: false,
                message: `Setup failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Configure TV ID and Launch Helper App - for "Tambah TV" final steps
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} tvId - TV ID from database
     * @param {number} port - ADB port (default: 5555)
     * @param {Function} statusCallback - Optional callback for status updates
     * @returns {Promise<Object>} Configuration result
     */
    async configureTvIdAndLaunch(ipAddress, tvId, port = 5555, statusCallback = null) {
        try {
            console.log(`🔧 [Configure & Launch] Starting final steps for TV ${tvId} at ${ipAddress}`);

            const deviceId = `${ipAddress}:${port}`;
            const finalStepsResults = {
                deviceId: deviceId,
                tvId: tvId,
                steps: {}
            };

            // Step 1: Configure TV ID
            console.log(`🆔 [Configure & Launch] Configuring TV ID...`);
            if (statusCallback) {
                statusCallback({
                    type: 'configuring_tv_id',
                    message: 'Mengkonfigurasi ID TV...'
                });
            }

            const configResult = await this.configureTvId(ipAddress, tvId, port);
            finalStepsResults.steps.tvIdConfiguration = configResult;

            if (!configResult.success) {
                throw new Error(`Failed to configure TV ID: ${configResult.message}`);
            }

            // Step 2: Launch Helper app
            console.log(`🚀 [Configure & Launch] Launching Helper app...`);
            if (statusCallback) {
                statusCallback({
                    type: 'launching_app',
                    message: 'Meluncurkan aplikasi Helper...'
                });
            }

            const launchResult = await this.launchHelperApp(ipAddress, port);
            finalStepsResults.steps.appLaunch = launchResult;

            if (!launchResult.success) {
                throw new Error(`Failed to launch Helper app: ${launchResult.message}`);
            }

            console.log(`✅ [Configure & Launch] Final steps completed successfully for TV ${tvId}`);

            if (statusCallback) {
                statusCallback({
                    type: 'completed',
                    message: 'TV berhasil ditambahkan ke sistem!'
                });
            }

            return {
                success: true,
                message: 'TV configuration and launch completed successfully',
                details: finalStepsResults
            };

        } catch (error) {
            console.error(`❌ [Configure & Launch] Error during final steps for TV ${tvId}:`, error);
            return {
                success: false,
                message: `Final steps failed: ${error.message}`,
                error: error.message
            };
        }
    }

    /**
     * Complete TV setup - install Helper app and configure TV ID
     * @param {string} ipAddress - IP address of the Android TV
     * @param {number} tvId - TV ID from database
     * @param {number} port - ADB port (default: 5555)
     * @param {Function} statusCallback - Optional callback for status updates
     * @returns {Promise<Object>} Setup result
     */
    async setupTvComplete(ipAddress, tvId, port = 5555, statusCallback = null) {
        try {
            console.log(`🔧 [ADB Setup] Starting complete TV setup for ${ipAddress} with TV ID ${tvId}`);

            const deviceId = `${ipAddress}:${port}`;
            const setupResults = {
                deviceId: deviceId,
                tvId: tvId,
                steps: {}
            };

            // Step 1: Connect to TV
            console.log(`🔌 [ADB Setup] Connecting to TV...`);
            if (statusCallback) {
                statusCallback({
                    type: 'connecting',
                    message: 'Menghubungkan ke TV...'
                });
            }

            const connectResult = await this.connectToTV(ipAddress, port);
            setupResults.steps.connection = connectResult;

            // Step 1.5: Wait for authorization if needed
            if (connectResult.status === 'unauthorized') {
                console.log(`🔐 [ADB Setup] TV not authorized, waiting for user acceptance...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${authResult.message}`);
                }
            } else if (connectResult.status === 'connecting') {
                console.log(`🔄 [ADB Setup] TV connecting, waiting for authorization dialog...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${authResult.message}`);
                }
            } else if (connectResult.success && connectResult.status === 'authorized') {
                console.log(`✅ [ADB Setup] TV already authorized`);
                setupResults.steps.authorization = { success: true, message: 'Already authorized' };
            } else if (!connectResult.success && ['network_unreachable', 'connection_refused', 'timeout'].includes(connectResult.status)) {
                // Only throw error for REAL connection failures (removed 'connection_failed' since we changed it to 'connecting')
                throw new Error(`Connection failed: ${connectResult.message}`);
            } else {
                // For any other status, try to wait for authorization as fallback
                console.log(`🔄 [ADB Setup] Unknown status '${connectResult.status}', attempting authorization wait...`);

                const authResult = await this.waitForAuthorization(ipAddress, port, 60000, statusCallback);
                setupResults.steps.authorization = authResult;

                if (!authResult.success) {
                    throw new Error(`Authorization failed: ${connectResult.message || authResult.message}`);
                }
            }

            // Step 2: Check if Helper app is installed
            console.log(`📱 [ADB Setup] Checking if Helper app is installed...`);
            const isInstalled = await this.checkHelperAppInstalled(ipAddress, port);
            setupResults.steps.appInstalled = isInstalled;

            if (!isInstalled) {
                // Step 3: Install Helper app
                console.log(`📦 [ADB Setup] Installing Helper app...`);
                if (statusCallback) {
                    statusCallback({
                        type: 'installing_app',
                        message: 'Menginstall aplikasi Helper...'
                    });
                }

                const installResult = await this.installHelperApp(ipAddress, port);
                setupResults.steps.appInstallation = installResult;

                if (!installResult.success) {
                    throw new Error(`Failed to install Helper app: ${installResult.error}`);
                }
            } else {
                console.log(`✅ [ADB Setup] Helper app already installed`);
                setupResults.steps.appInstallation = { success: true, message: 'Already installed' };
            }

            // Step 4: Grant overlay permission
            console.log(`🔐 [ADB Setup] Granting overlay permission...`);
            if (statusCallback) {
                statusCallback({
                    type: 'granting_permission',
                    message: 'Memberikan izin overlay...'
                });
            }

            const overlayResult = await this.grantOverlayPermission(ipAddress, port);
            setupResults.steps.overlayPermission = overlayResult;

            // Step 5: Configure TV ID
            console.log(`🆔 [ADB Setup] Configuring TV ID...`);
            if (statusCallback) {
                statusCallback({
                    type: 'configuring_tv_id',
                    message: 'Mengkonfigurasi ID TV...'
                });
            }

            const configResult = await this.configureTvId(ipAddress, tvId, port);
            setupResults.steps.tvIdConfiguration = configResult;

            // Step 6: Launch Helper app
            console.log(`🚀 [ADB Setup] Launching Helper app...`);
            if (statusCallback) {
                statusCallback({
                    type: 'launching_app',
                    message: 'Meluncurkan aplikasi Helper...'
                });
            }

            const launchResult = await this.launchHelperApp(ipAddress, port);
            setupResults.steps.appLaunch = launchResult;

            if (!launchResult.success) {
                throw new Error(`Failed to launch Helper app: ${launchResult.message}`);
            }

            console.log(`✅ [ADB Setup] Complete TV setup finished successfully for ${ipAddress}`);

            if (statusCallback) {
                statusCallback({
                    type: 'completed',
                    message: 'Setup TV berhasil diselesaikan!'
                });
            }

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
     * @returns {Promise<Object>} Launch result with success status and message
     */
    async launchHelperApp(ipAddress, port = 5555) {
        try {
            const deviceId = `${ipAddress}:${port}`;

            console.log(`🚀 [ADB Launch] Launching Helper app on ${ipAddress}...`);

            // Launch main activity
            const result = await this.executeAdbCommand([
                '-s', deviceId,
                'shell', 'am', 'start',
                '-n', `${HELPER_APP_PACKAGE}/${HELPER_APP_ACTIVITY}`
            ]);

            const success = result.includes('Starting') || result.includes('Activity');

            if (success) {
                console.log(`✅ [ADB Launch] Helper app launched successfully on ${ipAddress}`);
                return {
                    success: true,
                    message: 'Helper app launched successfully'
                };
            } else {
                console.log(`❌ [ADB Launch] Failed to launch Helper app on ${ipAddress}: ${result}`);
                return {
                    success: false,
                    message: `Failed to launch Helper app: ${result}`
                };
            }

        } catch (error) {
            console.error(`❌ [ADB Launch] Error launching Helper app on ${ipAddress}:`, error);
            return {
                success: false,
                message: `Launch error: ${error.message}`
            };
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
            const launchResult = await this.launchHelperApp(ipAddress, port);

            if (launchResult.success) {
                console.log(`✅ [ADB Monitoring] Helper app restarted successfully on ${ipAddress}`);
            } else {
                console.log(`❌ [ADB Monitoring] Helper app restart failed on ${ipAddress}: ${launchResult.message}`);
            }

            return launchResult.success;

        } catch (error) {
            console.error(`❌ [ADB Monitoring] Error restarting Helper app on ${ipAddress}:`, error);
            return false;
        }
    }
}

// Export singleton instance
module.exports = new ADBService();
