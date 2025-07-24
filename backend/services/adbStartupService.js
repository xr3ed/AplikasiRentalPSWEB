const { exec } = require('child_process');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);
const ADB_PATH = path.join(__dirname, '..', 'platform-tools', 'adb.exe');

class ADBStartupService {
    constructor() {
        this.isInitialized = false;
        this.initializationPromise = null;
    }

    /**
     * Check if ADB process is running in Task Manager
     * @returns {Promise<boolean>} True if adb.exe process is running
     */
    async isADBProcessRunning() {
        try {
            // Use tasklist to check for adb.exe processes
            const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq adb.exe" /FO CSV');

            // Parse CSV output to check if adb.exe is listed
            const lines = stdout.split('\n');
            const adbProcesses = lines.filter(line =>
                line.toLowerCase().includes('adb.exe') &&
                !line.toLowerCase().includes('info: no tasks')
            );

            return adbProcesses.length > 0;
        } catch (error) {
            console.error('❌ [ADB Startup] Error checking ADB processes:', error.message);
            return false;
        }
    }

    /**
     * Start ADB server
     * @returns {Promise<boolean>} True if ADB server started successfully
     */
    async startADBServer() {
        try {
            // Execute adb start-server command
            const { stderr } = await execAsync(`"${ADB_PATH}" start-server`);

            if (stderr) {
                console.error('ADB start-server error:', stderr);
            }

            // Wait a moment for the server to fully start
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Verify that ADB server is now running
            const isRunning = await this.isADBProcessRunning();

            return isRunning;
            
        } catch (error) {
            console.error('❌ [ADB Startup] Failed to start ADB server:', error.message);
            return false;
        }
    }

    /**
     * Kill existing ADB server (for cleanup)
     * @returns {Promise<boolean>} True if ADB server killed successfully
     */
    async killADBServer() {
        try {
            const { stderr } = await execAsync(`"${ADB_PATH}" kill-server`);

            if (stderr) {
                console.error('ADB kill-server error:', stderr);
            }

            // Wait for processes to terminate
            await new Promise(resolve => setTimeout(resolve, 1000));

            return true;
        } catch (error) {
            console.error('❌ [ADB Startup] Error killing ADB server:', error.message);
            return false;
        }
    }

    /**
     * Verify ADB executable exists and is functional
     * @returns {Promise<boolean>} True if ADB executable is working
     */
    async verifyADBExecutable() {
        try {
            const { stdout } = await execAsync(`"${ADB_PATH}" version`);

            return stdout.includes('Android Debug Bridge');
        } catch (error) {
            console.error('❌ [ADB Startup] ADB executable not found or not working:', error.message);
            return false;
        }
    }

    /**
     * Initialize ADB system - main entry point
     * @param {boolean} forceRestart - Force restart ADB server even if running
     * @returns {Promise<boolean>} True if ADB is ready for use
     */
    async initializeADB(forceRestart = false) {
        // Prevent multiple simultaneous initializations
        if (this.initializationPromise) {
            return await this.initializationPromise;
        }

        this.initializationPromise = this._performInitialization(forceRestart);
        const result = await this.initializationPromise;
        this.initializationPromise = null;
        
        return result;
    }

    /**
     * Internal initialization logic
     * @param {boolean} forceRestart 
     * @returns {Promise<boolean>}
     */
    async _performInitialization(forceRestart) {
        try {
            // Step 1: Verify ADB executable exists and works
            const isExecutableWorking = await this.verifyADBExecutable();
            if (!isExecutableWorking) {
                console.error('ADB executable not working - cannot proceed');
                return false;
            }

            // Step 2: Check if ADB is already running
            const isCurrentlyRunning = await this.isADBProcessRunning();

            if (isCurrentlyRunning && !forceRestart) {
                this.isInitialized = true;
                return true;
            }

            // Step 3: If force restart or not running, restart ADB
            if (forceRestart && isCurrentlyRunning) {
                await this.killADBServer();
            }

            // Step 4: Start ADB server
            const startSuccess = await this.startADBServer();

            if (startSuccess) {
                this.isInitialized = true;
                return true;
            } else {
                console.error('ADB system initialization failed');
                return false;
            }

        } catch (error) {
            console.error('❌ [ADB Startup] Unexpected error during ADB initialization:', error);
            return false;
        }
    }

    /**
     * Get current ADB status
     * @returns {Promise<Object>} Status information
     */
    async getStatus() {
        const isRunning = await this.isADBProcessRunning();
        const isExecutableWorking = await this.verifyADBExecutable();
        
        return {
            processRunning: isRunning,
            executableWorking: isExecutableWorking,
            initialized: this.isInitialized,
            ready: isRunning && isExecutableWorking
        };
    }
}

// Export singleton instance
module.exports = new ADBStartupService();
