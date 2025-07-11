const db = require('../database').getInstance();

/**
 * Mencatat transaksi baru.
 * @param {object} transactionData - Data transaksi.
 * @param {string} transactionData.type - Tipe transaksi ('session_regular', 'session_member', 'package_purchase').
 * @param {number} transactionData.amount - Jumlah transaksi.
 * @param {number|null} transactionData.tv_id - ID TV (jika berlaku).
 * @param {number|null} transactionData.member_id - ID Member (jika berlaku).
 * @param {number|null} transactionData.package_id - ID Paket (jika berlaku).
 * @param {number|null} transactionData.duration_minutes - Durasi dalam menit (jika berlaku).
 * @returns {Promise<number>} - ID dari transaksi yang baru dibuat.
 */
const createTransaction = (transactionData) => {
    return new Promise((resolve, reject) => {
        const {
            type,
            amount,
            tv_id = null,
            member_id = null,
            package_id = null,
            duration_minutes = null
        } = transactionData;

        const stmt = db.prepare(`
            INSERT INTO transactions (type, amount, tv_id, member_id, package_id, duration_minutes)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        stmt.run(type, amount, tv_id, member_id, package_id, duration_minutes, function(err) {
            if (err) {
                console.error('Error creating transaction:', err.message);
                return reject(err);
            }
            resolve(this.lastID);
        });
        stmt.finalize();
    });
};

/**
 * Mengambil semua transaksi dengan opsi filter dan paginasi.
 * @returns {Promise<object[]>}
 */
const getAllTransactions = () => {
    return new Promise((resolve, reject) => {
        const query = `
            SELECT t.*, tv.name as tv_name, m.name as member_name, p.name as package_name
            FROM transactions t
            LEFT JOIN tvs tv ON t.tv_id = tv.id
            LEFT JOIN members m ON t.member_id = m.id
            LEFT JOIN packages p ON t.package_id = p.id
            ORDER BY t.created_at DESC
        `;
        db.all(query, [], (err, rows) => {
            if (err) {
                return reject(err);
            }
            resolve(rows);
        });
    });
};

module.exports = {
    createTransaction,
    getAllTransactions,
};