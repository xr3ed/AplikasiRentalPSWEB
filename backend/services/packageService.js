const db = require('../database').getInstance();

const getAllPackages = () => {
    return new Promise((resolve, reject) => {
        const sql = "select * from packages";
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const createPackage = (packageData) => {
    return new Promise((resolve, reject) => {
        const { name, duration_minutes, price } = packageData;
        const sql = 'INSERT INTO packages (name, duration_minutes, price) VALUES (?,?,?)';
        const params = [name, duration_minutes, price];
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, ...packageData });
            }
        });
    });
};

const getMemberPackages = (memberId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT mp.id, mp.package_id, p.name as package_name, p.duration_minutes, mp.remaining_minutes, mp.purchase_date
            FROM member_packages mp
            JOIN packages p ON mp.package_id = p.id
            WHERE mp.member_id = ? AND mp.remaining_minutes > 0
            ORDER BY mp.purchase_date DESC
        `;
        db.all(sql, [memberId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

const getPackageById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM packages WHERE id = ?";
        db.get(sql, [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

module.exports = {
    getAllPackages,
    createPackage,
    getMemberPackages,
    getPackageById
};