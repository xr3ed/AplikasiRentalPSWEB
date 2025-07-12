const util = require('util');
const db = require('../database').getInstance();

const dbGet = util.promisify(db.get.bind(db));
const dbAll = util.promisify(db.all.bind(db));

exports.getSummaryData = async () => {
    try {
        const [totalTvsRow, activeTvsRow, totalMembersRow, totalPackagesRow] = await Promise.all([
            dbGet("SELECT COUNT(*) as count FROM tvs"),
            dbGet("SELECT COUNT(*) as count FROM tvs WHERE status = 'active'"),
            dbGet("SELECT COUNT(*) as count FROM members"),
            dbGet("SELECT COUNT(*) as count FROM packages"),
        ]);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const last7days = new Date(today);
        last7days.setDate(last7days.getDate() - 7);

        const last30days = new Date(today);
        last30days.setDate(last30days.getDate() - 30);

        const [revenueToday, revenue7Days, revenue30Days] = await Promise.all([
            getRevenueSince(today.toISOString()),
            getRevenueSince(last7days.toISOString()),
            getRevenueSince(last30days.toISOString()),
        ]);

        return {
            totalTvs: totalTvsRow.count,
            activeTvs: activeTvsRow.count,
            totalMembers: totalMembersRow.count,
            totalPackages: totalPackagesRow.count,
            revenue: {
                today: revenueToday,
                last7days: revenue7Days,
                last30days: revenue30Days,
            },
        };
    } catch (error) {
        console.error("Error getting summary data:", error);
        throw error;
    }
};

async function getRevenueSince(date) {
    const row = await dbGet("SELECT SUM(amount) as total FROM transactions WHERE created_at >= ?", [date]);
    return row.total || 0;
}