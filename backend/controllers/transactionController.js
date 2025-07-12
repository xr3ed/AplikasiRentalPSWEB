const transactionService = require('../services/transactionService');

/**
 * @desc    Get all transactions
 * @route   GET /api/transactions
 * @access  Private/Admin
 */
const getAllTransactions = async (req, res) => {
    try {
        const options = {};
        if (req.query.limit) {
            options.limit = parseInt(req.query.limit, 10);
        }
        const transactions = await transactionService.getAllTransactions(options);
        res.json({ success: true, data: transactions });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getAllTransactions,
};