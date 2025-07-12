const summaryService = require('../services/summaryService');

exports.getSummary = async (req, res, next) => {
    try {
        const summary = await summaryService.getSummaryData();
        res.json(summary);
    } catch (error) {
        next(error);
    }
};