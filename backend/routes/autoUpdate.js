const express = require('express');
const router = express.Router();

// This will be set by the main server
let autoUpdateService = null;

// Set the auto-update service instance
const setAutoUpdateService = (service) => {
    autoUpdateService = service;
};

// GET /api/auto-update/status - Get auto-update system status
router.get('/status', (req, res) => {
    try {
        if (!autoUpdateService) {
            return res.status(503).json({
                success: false,
                message: 'Auto-update service not available'
            });
        }

        const status = {
            latestVersion: autoUpdateService.latestVersion,
            latestApkPath: autoUpdateService.latestApkPath,
            isServiceRunning: true,
            updatingTVs: Array.from(autoUpdateService.isUpdating)
        };

        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting auto-update status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST /api/auto-update/scan - Manually scan for new APK
router.post('/scan', (req, res) => {
    try {
        if (!autoUpdateService) {
            return res.status(503).json({
                success: false,
                message: 'Auto-update service not available'
            });
        }

        autoUpdateService.scanForLatestAPK();
        
        res.json({
            success: true,
            message: 'APK scan completed',
            data: {
                latestVersion: autoUpdateService.latestVersion,
                latestApkPath: autoUpdateService.latestApkPath
            }
        });
    } catch (error) {
        console.error('Error scanning for APK:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST /api/auto-update/check-all - Check all TVs for updates
router.post('/check-all', async (req, res) => {
    try {
        if (!autoUpdateService) {
            return res.status(503).json({
                success: false,
                message: 'Auto-update service not available'
            });
        }

        // Trigger check for all TVs (async)
        autoUpdateService.checkAllTVsForUpdates().catch(error => {
            console.error('Error checking all TVs for updates:', error);
        });
        
        res.json({
            success: true,
            message: 'Update check initiated for all active TVs'
        });
    } catch (error) {
        console.error('Error checking all TVs for updates:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// POST /api/auto-update/tv/:id - Manually trigger update for specific TV
router.post('/tv/:id', async (req, res) => {
    try {
        const tvId = parseInt(req.params.id);
        
        if (!autoUpdateService) {
            return res.status(503).json({
                success: false,
                message: 'Auto-update service not available'
            });
        }

        // Get TV info from database
        const { getInstance } = require('../database');
        const db = getInstance();
        const stmt = db.prepare('SELECT id, name, ip_address, app_version FROM tvs WHERE id = ?');
        const tv = stmt.get(tvId);

        if (!tv) {
            return res.status(404).json({
                success: false,
                message: 'TV not found'
            });
        }

        if (!tv.ip_address) {
            return res.status(400).json({
                success: false,
                message: 'TV IP address not available'
            });
        }

        // Trigger update (async)
        autoUpdateService.autoUpdateTV(tvId, tv.ip_address)
            .then(result => {
                console.log(`Manual update result for TV ${tvId}:`, result);
            })
            .catch(error => {
                console.error(`Manual update failed for TV ${tvId}:`, error);
            });
        
        res.json({
            success: true,
            message: `Update initiated for TV ${tvId} (${tv.name})`,
            data: {
                tvId: tv.id,
                tvName: tv.name,
                currentVersion: tv.app_version,
                targetVersion: autoUpdateService.latestVersion
            }
        });
    } catch (error) {
        console.error('Error triggering manual update:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// GET /api/auto-update/tv/:id/status - Get update status for specific TV
router.get('/tv/:id/status', (req, res) => {
    try {
        const tvId = parseInt(req.params.id);
        
        if (!autoUpdateService) {
            return res.status(503).json({
                success: false,
                message: 'Auto-update service not available'
            });
        }

        const isUpdating = autoUpdateService.isUpdating.has(tvId);
        
        // Get TV info from database
        const { getInstance } = require('../database');
        const db = getInstance();
        const stmt = db.prepare('SELECT id, name, app_version FROM tvs WHERE id = ?');
        const tv = stmt.get(tvId);

        if (!tv) {
            return res.status(404).json({
                success: false,
                message: 'TV not found'
            });
        }

        const needsUpdate = autoUpdateService.latestVersion && 
                           tv.app_version && 
                           tv.app_version !== autoUpdateService.latestVersion;

        res.json({
            success: true,
            data: {
                tvId: tv.id,
                tvName: tv.name,
                currentVersion: tv.app_version,
                latestVersion: autoUpdateService.latestVersion,
                needsUpdate,
                isUpdating
            }
        });
    } catch (error) {
        console.error('Error getting TV update status:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = { router, setAutoUpdateService };
