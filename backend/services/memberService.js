const db = require('../database').getInstance();

const getMemberByPhone = (phone) => {
    return new Promise((resolve, reject) => {
        // Clean phone number - remove @c.us suffix if present
        let cleanPhone = phone;
        if (cleanPhone.includes('@c.us')) {
            cleanPhone = cleanPhone.replace('@c.us', '');
        }

        // Add + prefix if not present
        if (!cleanPhone.startsWith('+')) {
            cleanPhone = '+' + cleanPhone;
        }

        const sql = "SELECT * FROM members WHERE phone_number = ?";
        db.get(sql, [cleanPhone], (err, row) => {
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

const getMemberById = (id) => {
    return new Promise((resolve, reject) => {
        const sql = "SELECT * FROM members WHERE id = ?";
        db.get(sql, [id], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
};

const updateMember = (id, memberData) => {
    return new Promise((resolve, reject) => {
        const { name, phone_number } = memberData;
        const sql = 'UPDATE members SET name = ?, phone_number = ? WHERE id = ?';
        db.run(sql, [name, phone_number, id], function (err) {
            if (err) {
                reject(err);
            } else if (this.changes === 0) {
                resolve(null);
            } else {
                resolve({ id, ...memberData });
            }
        });
    });
};

const deleteMember = (id) => {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM members WHERE id = ?';
        db.run(sql, [id], function (err) {
            if (err) {
                reject(err);
            } else if (this.changes === 0) {
                resolve(null);
            } else {
                resolve({ changes: this.changes });
            }
        });
    });
};

module.exports = {
    getMemberByPhone,
    createMember: createMemberInternal, // Tetap ekspor sebagai createMember untuk API
    createMemberInternal, // Ekspor untuk penggunaan internal seperti whatsapp.js
    getAllMembers,
    getMemberById,
    updateMember,
    deleteMember
};