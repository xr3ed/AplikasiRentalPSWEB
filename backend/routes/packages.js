const express = require('express');
const router = express.Router();
const packageController = require('../controllers/packageController');
const { validatePackage } = require('../middleware/validator');

// GET all packages
router.get('/', packageController.getAllPackages);

// POST a new package
router.post('/', validatePackage, packageController.createPackage);

module.exports = router;