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

module.exports = {
    getAllPackages,
    createPackage
};