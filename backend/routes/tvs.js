const express = require('express');
const router = express.Router();
const tvController = require('../controllers/tvController');
const { validateTv, validateTvStatus } = require('../middleware/validator');

// Routes for TVs
router.get('/ping', tvController.ping);
router.get('/server-ip', tvController.getServerIp);
router.get('/', tvController.getAllTvs);
router.post('/', tvController.createTv);
router.get('/name/:name', tvController.getTvByName);
router.get('/:id', tvController.getTvById);
router.get('/:id/qrcode', tvController.getTvQRCode);
router.post('/pair', tvController.pairTv);
router.put('/:id/status', validateTvStatus, tvController.updateTv);
router.delete('/:id', tvController.deleteTv);

module.exports = router;