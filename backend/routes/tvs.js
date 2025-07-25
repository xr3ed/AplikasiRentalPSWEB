const express = require('express');
const router = express.Router();
const tvController = require('../controllers/tvController');
const { validateTv, validateTvStatus } = require('../middleware/validator');

// Routes for TVs
router.get('/ping', tvController.ping);
router.get('/server-ip', tvController.getServerIp);
router.get('/', tvController.getAllTvs);
router.post('/', tvController.createTv);
// ADB routes - now implemented
router.post('/setup-only', tvController.setupTvOnly); // NEW: Setup TV without database operations
router.post('/add-adb', tvController.addTvWithADB);
router.post('/add-test', tvController.addTestTv); // NEW: Add test TV without ping check
router.post('/ping-check', tvController.pingCheck); // NEW: Ping check endpoint
router.post('/retry-setup/:tvId', tvController.retryTvSetup); // NEW: Retry TV setup
router.get('/adb-status/:ipAddress', tvController.checkADBStatus);
router.get('/adb-system/status', tvController.getADBSystemStatus);
router.post('/adb-system/restart', tvController.restartADBSystem);
router.get('/name/:name', tvController.getTvByName);

// Check detailed status for new TV (before adding to database)
router.post('/check-detailed-status', tvController.checkDetailedStatusForNewTV); // NEW: Check detailed status for new TV

// Specific ID routes must come before the general ID route
router.get('/:id/detailed-status', tvController.getDetailedStatus); // NEW: Detailed status check
router.get('/:id/member-login-qr', tvController.getMemberLoginQRCode);
router.put('/:id/status', validateTvStatus, tvController.updateTv);
router.put('/:id/update-ip', tvController.updateTvIpAddress); // NEW: Update IP address
router.get('/:id/ping', tvController.ping);
router.post('/:id/generate-login-code', tvController.generateLoginCodeForTv);
// router.post('/:id/heartbeat', tvController.updateHeartbeat); // Function not implemented

// General ID route last
router.get('/:id', tvController.getTvById);
router.put('/:id', tvController.updateTvDetails);
router.delete('/:id', tvController.deleteTv);

module.exports = router;