const express = require('express');
const router = express.Router();
const memberController = require('../controllers/memberController');
const { validateMember } = require('../middleware/validator');
const memberPackageRouter = require('./memberPackages');

// Nested route for member packages
router.use('/:memberId/packages', memberPackageRouter);

// GET /api/members
router.get('/', memberController.getAllMembers);

// POST /api/members
router.post('/', validateMember, memberController.createMember);

module.exports = router;