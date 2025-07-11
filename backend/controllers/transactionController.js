const transactionService = require('../services/transactionService');

/**
 * @desc    Get all transactions
 * @route   GET /api/transactions
 * @access  Private/Admin
 */
const getAllTransactions = async (req, res) => {
    try {
        const transactions = await transactionService.getAllTransactions();
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getAllTransactions,
};