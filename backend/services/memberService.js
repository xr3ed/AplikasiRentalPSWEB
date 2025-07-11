const db = require('../database').getInstance();

const getMemberByPhone = (phone) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM members WHERE phone_number = ?";
        db.get(sql, [phone], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const createMemberInternal = (memberData) => {
    return new Promise((resolve, reject) => {
        const { name, phone } = memberData;
        const sql = 'INSERT INTO members (name, phone_number) VALUES (?,?)';
        db.run(sql, [name, phone], function (err) {
            if (err) {
                reject(err);
            } else {
                resolve({ id: this.lastID, ...memberData });
            }
        });
    });
};

const getAllMembers = () => {
    return new Promise((resolve, reject) => {
        const sql = "select * from members";
        db.all(sql, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

module.exports = {
    getMemberByPhone,
    createMember: createMemberInternal, // Tetap ekspor sebagai createMember untuk API
    createMemberInternal, // Ekspor untuk penggunaan internal seperti whatsapp.js
    getAllMembers
};