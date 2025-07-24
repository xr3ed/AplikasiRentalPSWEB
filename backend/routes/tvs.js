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
router.post('/add-adb', tvController.addTvWithADB);
router.get('/adb-status/:ipAddress', tvController.checkADBStatus);
router.get('/adb-system/status', tvController.getADBSystemStatus);
router.post('/adb-system/restart', tvController.restartADBSystem);
router.get('/name/:name', tvController.getTvByName);

// Specific ID routes must come before the general ID route
router.get('/:id/member-login-qr', tvController.getMemberLoginQRCode);
router.put('/:id/status', validateTvStatus, tvController.updateTv);
router.get('/:id/ping', tvController.ping);
router.post('/:id/generate-login-code', tvController.generateLoginCodeForTv);
// router.post('/:id/heartbeat', tvController.updateHeartbeat); // Function not implemented

// General ID route last
router.get('/:id', tvController.getTvById);
router.put('/:id', tvController.updateTvDetails);
router.delete('/:id', tvController.deleteTv);

module.exports = router;