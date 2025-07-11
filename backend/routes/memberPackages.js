const express = require('express');
const router = express.Router({ mergeParams: true });
const memberPackageController = require('../controllers/memberPackageController');

// GET /api/members/:memberId/packages
router.get('/', memberPackageController.getMemberPackages);

// POST /api/members/:memberId/packages
router.post('/', memberPackageController.addPackageToMember);

module.exports = router;