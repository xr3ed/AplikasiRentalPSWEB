const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');

// Rute untuk mendapatkan semua transaksi, hanya untuk admin
router.get('/', transactionController.getAllTransactions);

module.exports = router;