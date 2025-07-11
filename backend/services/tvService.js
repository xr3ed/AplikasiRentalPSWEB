const db = require('../database').getInstance();
const transactionService = require('./transactionService');

const getAllTvs = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM tvs ORDER BY name", [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const createTv = (name, status, ipAddress) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM tvs WHERE ip_address = ?", [ipAddress], (err, row) => {
            if (err) {
                return reject(err);
            }
            if (row) {
                // TV with this IP already exists, just return it
                return resolve(row);
            } else {
                // TV doesn't exist, create it
                db.run(`INSERT INTO tvs (name, status, ip_address) VALUES (?, ?, ?)`, [name, status || 'off', ipAddress], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve({ id: this.lastID, name: name, status: status || 'off', ip_address: ipAddress });
                    }
                });
            }
        });
    });
};

const getTvByName = (name) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM tvs WHERE name = ?", [name], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const getTvById = (id) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM tvs WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

const startMemberSession = async (tvId, memberId, memberPackageId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT package_id, remaining_duration FROM member_packages WHERE id = ? AND member_id = ?', [memberPackageId, memberId], async (err, memberPackage) => {
            if (err || !memberPackage) {
                return reject(err || new Error('Member package not found or does not belong to the member.'));
            }

            const { package_id, remaining_duration } = memberPackage;

            if (remaining_duration <= 0) {
                return reject(new Error('Member package has no remaining duration.'));
            }

            try {
                // Create a transaction for using the member's package (amount can be 0 as it's pre-paid)
                await transactionService.createTransaction({
                    type: 'session_member',
                    amount: 0, // Or fetch package price if you want to track value
                    tv_id: tvId,
                    member_id: memberId,
                    package_id: package_id,
                    duration_minutes: remaining_duration, // Or a fixed duration if packages are used in chunks
                });

                const startTime = new Date();
                // Assuming the entire remaining duration is used at once.
                const endTime = new Date(startTime.getTime() + remaining_duration * 60000);

                db.serialize(() => {
                    db.run('BEGIN TRANSACTION');

                    const updateTvSql = `
                        UPDATE tvs 
                        SET status = 'active', session_start_time = ?, session_end_time = ?, 
                            current_member_id = ?, active_member_package_id = ?, notification_sent = 0
                        WHERE id = ?`;
                    db.run(updateTvSql, [startTime.toISOString(), endTime.toISOString(), memberId, memberPackageId, tvId]);

                    // Set remaining duration to 0 as it's fully used.
                    const updatePackageSql = `UPDATE member_packages SET remaining_duration = 0 WHERE id = ?`;
                    db.run(updatePackageSql, [memberPackageId]);

                    db.run('COMMIT', (err) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return reject(err);
                        }
                        resolve({ message: 'Member session started successfully.' });
                    });
                });
            } catch (transactionError) {
                reject(transactionError);
            }
        });
    });
};

const startPackageSession = async (tvId, packageId) => {
    const tv = await getTvById(tvId);
    if (!tv) {
        throw new Error('TV not found');
    }
    return new Promise((resolve, reject) => {
        // Also fetch price for transaction logging
        db.get('SELECT duration_minutes, price FROM packages WHERE id = ?', [packageId], async (err, pkg) => {
            if (err) return reject(err);
            if (!pkg) {
                return reject(new Error('Invalid package.'));
            }

            try {
                // Create a transaction record for the session
                await transactionService.createTransaction({
                    type: 'session_regular',
                    amount: pkg.price,
                    tv_id: tvId,
                    package_id: packageId,
                    duration_minutes: pkg.duration_minutes,
                });

                const startTime = new Date();
                const endTime = new Date(startTime.getTime() + pkg.duration_minutes * 60000);

                const sql = `
                    UPDATE tvs 
                    SET status = 'active', session_start_time = ?, session_end_time = ?, 
                        current_member_id = NULL, active_member_package_id = ?, notification_sent = 0
                    WHERE id = ?`;
                db.run(sql, [startTime.toISOString(), endTime.toISOString(), packageId, tvId], (err) => {
                    if (err) {
                        // Note: This doesn't roll back the created transaction. A more robust implementation would be needed for production.
                        return reject(err);
                    }
                    resolve({ message: 'Package session started successfully.' });
                });
            } catch (transactionError) {
                reject(transactionError);
            }
        });
    });
};

const startRegularSession = async (tvId, duration, price) => {
    const tv = await getTvById(tvId);
    if (!tv) {
        throw new Error('TV not found');
    }
    // Create a transaction record
    await transactionService.createTransaction({
        type: 'session_regular',
        amount: price,
        tv_id: tvId,
        duration_minutes: duration,
    });

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + duration * 60000);

    const sql = `
        UPDATE tvs 
        SET status = 'active', session_start_time = ?, session_end_time = ?, 
            current_member_id = NULL, active_member_package_id = NULL, notification_sent = 0
        WHERE id = ?`;

    return new Promise((resolve, reject) => {
        db.run(sql, [startTime.toISOString(), endTime.toISOString(), tvId], (err) => {
            if (err) return reject(err);
            resolve({ message: 'Regular session started successfully.' });
        });
    });
};

const updateTvName = (id, name) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE tvs SET name = ? WHERE id = ?`;
        db.run(sql, [name, id], function(err) {
            if (err) {
                return reject(err);
            }
            if (this.changes === 0) {
                return resolve(null); // No TV found with that ID
            }
            resolve({ id, name });
        });
    });
};

const updateTvStatus = (id, status) => {
    return new Promise((resolve, reject) => {
        const sql = `UPDATE tvs SET status = ? WHERE id = ?`;
        db.run(sql, [status, id], function(err) {
            if (err) {
                return reject(err);
            }
            resolve({ id, status });
        });
    });
};

const stopSession = async (tvId) => {
    const tv = await getTvById(tvId);
    if (!tv) {
        throw new Error('TV not found');
    }
    return new Promise((resolve, reject) => {
        // TODO: Add logic to calculate remaining time for member sessions
        const sql = `UPDATE tvs SET status = 'inactive', session_end_time = ?, current_member_id = NULL, active_member_package_id = NULL WHERE id = ?`;
        db.run(sql, [new Date().toISOString(), tvId], function(err) {
            if (err) reject(err);
            else resolve({ message: 'Session stopped.', changes: this.changes });
        });
    });
};

const deleteTv = (id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM tvs WHERE id = ?`, id, function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
        });
    });
};

module.exports = {
    getAllTvs,
    createTv,
    getTvById,
    getTvByName,
    updateTvName,
    updateTvStatus,
    startPackageSession,
    startRegularSession,
    stopSession,
    deleteTv,
    startMemberSession
};