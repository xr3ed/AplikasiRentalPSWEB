const summaryService = require('../services/summaryService');
const db = require('../database').getInstance();

exports.getSummary = async (req, res, next) => {
    try {
        const summary = await summaryService.getSummaryData();
        const io = req.app.get('io');
        io.emit('summary_updated', summary);
        res.json(summary);
    } catch (error) {
        next(error);
    }
};