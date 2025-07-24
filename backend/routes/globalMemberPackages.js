const express = require('express');
const router = express.Router();
const memberPackageController = require('../controllers/memberPackageController');

// POST /api/member-packages (with member_id in body)
router.post('/', (req, res, next) => {
    // Set memberId from body for global endpoint
    req.params.memberId = req.body.member_id;
    memberPackageController.addPackageToMember(req, res, next);
});

module.exports = router;
