const db = require('../database').getInstance();
const transactionService = require('./transactionService');
const ping = require('ping');
const crypto = require('crypto');

const getAllTvs = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM tvs ORDER BY name", [], (err, rows) => {
            if (err) {
                return reject(err);
            }

            const now = new Date();
            const detailedTvs = rows.map(tv => {
                if ((tv.status === 'on' || tv.status === 'active') && tv.session_end_time) {
                    const endTime = new Date(tv.session_end_time);
                    const remaining_seconds = Math.max(0, Math.floor((endTime.getTime() - now.getTime()) / 1000));
                    return { ...tv, remaining_seconds };
                } else {
                    return { ...tv, remaining_seconds: 0 };
                }
            });

            resolve(detailedTvs);
        });
    });
};

const generateLoginCode = (tvId) => {
    return new Promise((resolve, reject) => {
        // RESTORED FEATURE: Check for existing valid codes first (code reuse mechanism)
        const checkExistingSql = `
            SELECT code
            FROM tv_login_codes
            WHERE tv_id = ?
            AND used = 0
            AND datetime(created_at, '+5 minutes') > CURRENT_TIMESTAMP
            ORDER BY created_at DESC
            LIMIT 1
        `;

        db.get(checkExistingSql, [tvId], (err, existingCode) => {
            if (err) return reject(err);

            if (existingCode) {
                console.log(`♻️ Reusing existing valid code ${existingCode.code} for TV ${tvId}`);
                return resolve(existingCode.code);
            }

            // RESTORED FEATURE: Rate limiting check (max 3 codes per 30 seconds)
            const rateLimitSql = `
                SELECT COUNT(*) as count
                FROM tv_login_codes
                WHERE tv_id = ?
                AND datetime(created_at, '+30 seconds') > CURRENT_TIMESTAMP
            `;

            db.get(rateLimitSql, [tvId], (rateLimitErr, rateLimitResult) => {
                if (rateLimitErr) return reject(rateLimitErr);

                if (rateLimitResult.count >= 3) {
                    console.log(`🚫 Rate limit exceeded for TV ${tvId}: ${rateLimitResult.count} codes in 30 seconds`);
                    return reject(new Error('Rate limit exceeded. Maximum 3 codes per 30 seconds.'));
                }

                // Generate new code
                const code = crypto.randomBytes(4).toString('hex').toUpperCase();
                db.run('INSERT INTO tv_login_codes (tv_id, code) VALUES (?, ?)', [tvId, code], function(insertErr) {
                    if (insertErr) return reject(insertErr);
                    console.log(`🆕 Generated new login code ${code} for TV ${tvId}`);
                    resolve(code);
                });
            });
        });
    });
};

const getTvByLoginCode = (code) => {
    return new Promise((resolve, reject) => {
        // CONDITIONAL EXPIRATION: Kode expired HANYA jika TV sedang digunakan
        const sql = `
            SELECT tvs.*
            FROM tv_login_codes
            JOIN tvs ON tvs.id = tv_login_codes.tv_id
            WHERE tv_login_codes.code = ?
            AND tv_login_codes.used = 0
            AND (
                tvs.status = 'inactive' OR  -- TV idle = kode valid
                datetime(tv_login_codes.created_at, '+30 minutes') > CURRENT_TIMESTAMP  -- Fallback 30 menit
            )
        `;
        db.get(sql, [code], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

// Mark login code as used (RESTORED MISSING FUNCTION)
const markLoginCodeAsUsed = (code) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE tv_login_codes SET used = 1, used_at = CURRENT_TIMESTAMP WHERE code = ?", [code], function(err) {
            if (err) {
                reject(err);
            } else {
                console.log(`🔒 Login code ${code} marked as used`);
                resolve({ changes: this.changes });
            }
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

const getActiveTvByMemberId = (memberId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM tvs WHERE current_member_id = ? AND status = 'on'", [memberId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
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

const updateTvDetails = (id, details) => {
    return new Promise((resolve, reject) => {
        const fields = [];
        const values = [];

        if (details.name !== undefined && details.name !== null) {
            fields.push('name = ?');
            values.push(details.name);
        }

        if (details.status !== undefined && details.status !== null) {
            fields.push('status = ?');
            values.push(details.status);
        }

        if (fields.length === 0) {
            // Nothing to update, but we can return the current state.
            return getTvById(id).then(resolve).catch(reject);
        }

        values.push(id);

        const sql = `UPDATE tvs SET ${fields.join(', ')} WHERE id = ?`;

        db.run(sql, values, function(err) {
            if (err) {
                return reject(err);
            }
            if (this.changes === 0) {
                return resolve(null); // Indicates that the TV was not found
            }
            getTvById(id).then(resolve).catch(reject);
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

const startMemberSession = async (tvId, memberId, memberPackageId, io) => {
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
                        SET status = 'on', session_start_time = ?, session_end_time = ?, 
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
                        // After successful commit, fetch the updated TV and emit events
                        getTvById(tvId).then(async (updatedTv) => {
                            const summary = await require('./summaryService').getSummaryData();

                            // Enhance the TV object with session details for the frontend
                            const detailedTv = {
                                ...updatedTv,
                                session_end_time: endTime.toISOString(),
                                remaining_seconds: remaining_duration * 60
                            };

                            io.emit('tv_updated', detailedTv);
                            io.emit('summary_updated', summary);

                            // CRITICAL FIX: Emit session_started event to helper app
                            io.emit(`tv_status_${tvId}`, {
                                type: 'session_started',
                                status: 'on',
                                session_start_time: startTime.toISOString(),
                                session_end_time: endTime.toISOString(),
                                member_id: memberId,
                                package_id: package_id,
                                remaining_seconds: remaining_duration * 60,
                                timestamp: new Date().toISOString()
                            });

                            console.log(`[startMemberSession] Events emitted for TV ${tvId}, including session_started to helper app.`);

                            resolve({ message: 'Member session started successfully.' });
                        }).catch(error => {
                            console.error("Error fetching updated TV after session start:", error);
                            resolve({ message: 'Member session started successfully, but failed to emit update.' });
                        });
                    });
                });
            } catch (transactionError) {
                reject(transactionError);
            }
        });
    });
};

const startPackageSession = async (tvId, memberPackageId, memberId, io) => {
    console.log(`[startPackageSession] Initiating for TV: ${tvId}, Member Package ID: ${memberPackageId}, Member: ${memberId}`);

    // Get the specific member package
    const selectedMemberPackage = await new Promise((resolve, reject) => {
        const sql = `
            SELECT mp.id, mp.package_id, p.name as package_name, p.price, mp.remaining_minutes
            FROM member_packages mp
            JOIN packages p ON mp.package_id = p.id
            WHERE mp.id = ? AND mp.member_id = ?`;
        db.get(sql, [memberPackageId, memberId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });

    if (!selectedMemberPackage) {
        console.error(`[startPackageSession] Member package with ID ${memberPackageId} not found for member ${memberId}.`);
        throw new Error('Member package not found or does not belong to the member.');
    }

    if (selectedMemberPackage.remaining_minutes <= 0) {
        throw new Error('This package has no time remaining.');
    }

    const tv = await getTvById(tvId);
    if (!tv) {
        console.error(`[startPackageSession] TV with ID ${tvId} not found.`);
        throw new Error('TV not found');
    }

    console.log(`[startPackageSession] Found TV: ${tv.name}, Package: ${selectedMemberPackage.package_name}, Remaining time: ${selectedMemberPackage.remaining_minutes} minutes`);

    const sessionDurationSeconds = selectedMemberPackage.remaining_minutes * 60;

    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + sessionDurationSeconds * 1000);

    try {
        // Use a transaction to ensure data integrity
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);

                // 1. Create the session transaction log
                transactionService.createTransaction({
                    type: 'session_package',
                    amount: 0, // It's a pre-paid package, so no new charge
                    tv_id: tvId,
                    member_id: memberId,
                    package_id: selectedMemberPackage.package_id,
                    duration_minutes: selectedMemberPackage.remaining_minutes,
                })
                .then(() => {
                    // 2. Update the TV status
                    const updateTvSql = `
                        UPDATE tvs 
                        SET status = 'on', session_start_time = ?, session_end_time = ?, 
                            current_member_id = ?, current_package_id = ?, active_member_package_id = ?, notification_sent = 0
                        WHERE id = ?`;
                    
                    db.run(updateTvSql, [startTime.toISOString(), endTime.toISOString(), memberId, selectedMemberPackage.package_id, selectedMemberPackage.id, tvId], function(err) {
                        if (err) {
                            console.error('[startPackageSession] DB Error during TV update:', err);
                            return db.run('ROLLBACK', () => reject(err));
                        }
                        console.log(`[startPackageSession] TV ${tvId} status updated.`);
                        db.run('COMMIT', (err) => {
                            if (err) {
                                return db.run('ROLLBACK', () => reject(err));
                            }
                            resolve();
                        });
                    });
                })
                .catch(err => {
                    console.error('[startPackageSession] Error during transaction creation:', err);
                    db.run('ROLLBACK', () => reject(err));
                });
            });
        });

        const updatedTv = await getTvById(tvId);
        const summary = await require('./summaryService').getSummaryData();

        const detailedTv = {
            ...updatedTv,
            session_end_time: endTime.toISOString(),
            remaining_seconds: sessionDurationSeconds
        };

        io.emit('tv_updated', detailedTv);
        io.emit('summary_updated', summary);

        // CRITICAL FIX: Emit session_started event to helper app
        io.emit(`tv_status_${tvId}`, {
            type: 'session_started',
            status: 'on',
            session_start_time: startTime.toISOString(),
            session_end_time: endTime.toISOString(),
            member_id: memberId,
            package_id: selectedMemberPackage.package_id,
            remaining_seconds: sessionDurationSeconds,
            timestamp: new Date().toISOString()
        });

        console.log(`[startPackageSession] Events emitted for TV ${tvId}, including session_started to helper app.`);

        return { message: 'Package session started successfully.', tv: detailedTv };

    } catch (error) {
        console.error(`[startPackageSession] Error during transaction or update for TV ${tvId}:`, error);
        throw error;
    }
};

const getPackageById = (id) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM packages WHERE id = ?", [id], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

// Login code cleanup functions
const checkAndNotifyExpiredLoginCodes = async (io) => {
    return new Promise((resolve, reject) => {
        // Find expired codes that haven't been notified yet
        const sql = `
            SELECT DISTINCT tv_id, code
            FROM tv_login_codes
            WHERE datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP
            AND (used = 0 OR used IS NULL)
            AND (notified = 0 OR notified IS NULL)
        `;

        db.all(sql, [], (err, expiredCodes) => {
            if (err) {
                return reject(err);
            }

            let notified = 0;
            let skipped = 0;

            if (expiredCodes.length === 0) {
                return resolve({ notified: 0, skipped: 0 });
            }

            // Notify each TV about expired codes via Socket.IO
            expiredCodes.forEach(({ tv_id, code }) => {
                if (io) {
                    io.emit(`tv_login_code_expired_${tv_id}`, {
                        tvId: tv_id,
                        expiredCode: code,
                        timestamp: new Date().toISOString()
                    });

                    // Also emit general event
                    io.emit('login_code_expired', {
                        tvId: tv_id,
                        expiredCode: code,
                        timestamp: new Date().toISOString()
                    });

                    notified++;
                } else {
                    skipped++;
                }
            });

            // Mark codes as notified
            if (notified > 0) {
                const codes = expiredCodes.map(c => c.code);
                const placeholders = codes.map(() => '?').join(',');
                const updateSql = `UPDATE tv_login_codes SET notified = 1 WHERE code IN (${placeholders})`;

                db.run(updateSql, codes, (updateErr) => {
                    if (updateErr) {
                        console.error('Error marking codes as notified:', updateErr);
                    }
                });
            }

            resolve({ notified, skipped });
        });
    });
};

const cleanupExpiredLoginCodes = () => {
    return new Promise((resolve, reject) => {
        const sql = `
            DELETE FROM tv_login_codes
            WHERE datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP
            OR used = 1
        `;

        db.run(sql, [], function(err) {
            if (err) {
                return reject(err);
            }
            resolve({ changes: this.changes });
        });
    });
};

const startRegularSession = async (tvId, duration, price, io) => {
    const tv = await getTvById(tvId);
    if (!tv) {
        throw new Error('TV not found');
    }

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
        SET status = 'on', session_start_time = ?, session_end_time = ?, 
            current_package_id = NULL, current_member_id = NULL, active_member_package_id = NULL, notification_sent = 0
        WHERE id = ?`;

    await new Promise((resolve, reject) => {
        db.run(sql, [startTime.toISOString(), endTime.toISOString(), tvId], (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    const updatedTv = await getTvById(tvId);
    const summary = await require('./summaryService').getSummaryData();

    const detailedTv = {
        ...updatedTv,
        session_end_time: endTime.toISOString(),
        remaining_seconds: duration * 60
    };

    io.emit('tv_updated', detailedTv);
    io.emit('summary_updated', summary);

    // CRITICAL FIX: Emit session_started event to helper app
    io.emit(`tv_status_${tvId}`, {
        type: 'session_started',
        status: 'on',
        session_start_time: startTime.toISOString(),
        session_end_time: endTime.toISOString(),
        duration_minutes: duration,
        remaining_seconds: duration * 60,
        timestamp: new Date().toISOString()
    });

    console.log(`[startRegularSession] Events emitted for TV ${tvId}, including session_started to helper app.`);

    return { message: 'Regular session started successfully.', tv: detailedTv };
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

const stopSession = async (tvId, io) => {
    const tv = await getTvById(tvId);
    if (!tv) {
        throw new Error('TV not found');
    }

    if (tv.status !== 'active' && tv.status !== 'on') {
        throw new Error('No active session on this TV.');
    }

    const sessionStartTime = new Date(tv.session_start_time);
    const now = new Date();
    const usedDurationMs = now.getTime() - sessionStartTime.getTime();
    const usedDurationMinutes = Math.round(usedDurationMs / 60000);

    // Use a helper function to run DB commands in a transaction
    const runInTransaction = (actions) => {
        return new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) return reject(err);

                actions()
                    .then(() => {
                        db.run('COMMIT', (err) => {
                            if (err) {
                                db.run('ROLLBACK', () => reject(err));
                            } else {
                                resolve();
                            }
                        });
                    })
                    .catch((error) => {
                        db.run('ROLLBACK', () => reject(error));
                    });
            });
        });
    };

    await runInTransaction(async () => {
        // If it was a member session, update their package
        if (tv.current_member_id && tv.current_package_id) {
            const memberPackage = await new Promise((res, rej) => {
                db.get('SELECT id, remaining_minutes FROM member_packages WHERE member_id = ? AND package_id = ?',
                    [tv.current_member_id, tv.current_package_id], (err, row) => err ? rej(err) : res(row));
            });

            if (memberPackage) {
                // Calculate remaining time in seconds
                const sessionEndTime = new Date(tv.session_end_time);
                const remainingMs = sessionEndTime.getTime() - now.getTime();
                const remainingSeconds = Math.max(0, Math.floor(remainingMs / 1000));

                if (remainingSeconds <= 0) {
                    // If time is up or over, delete the package
                    await new Promise((res, rej) => db.run('DELETE FROM member_packages WHERE id = ?', [memberPackage.id], (err) => err ? rej(err) : res()));
                } else {
                    // Otherwise, update the remaining minutes, rounding up
                    const newRemainingMinutes = Math.floor(remainingSeconds / 60);
                    await new Promise((res, rej) => db.run('UPDATE member_packages SET remaining_minutes = ? WHERE id = ?', [newRemainingMinutes, memberPackage.id], (err) => err ? rej(err) : res()));
                }
            }
        }

        // Reset TV status
        const updateTvSql = `
            UPDATE tvs 
            SET status = 'off', session_start_time = NULL, session_end_time = NULL, 
                current_member_id = NULL, current_package_id = NULL, active_member_package_id = NULL, notification_sent = 0
            WHERE id = ?`;
        await new Promise((res, rej) => db.run(updateTvSql, [tvId], (err) => err ? rej(err) : res()));
    });

    // After stopping, fetch the updated TV and summary, then emit updates
    const updatedTv = await getTvById(tvId);
        const summary = await require('./summaryService').getSummaryData();

    io.emit('tv_updated', updatedTv);
    io.emit('summary_updated', summary);

    // CRITICAL FIX: Emit session_ended event to helper app
    io.emit(`tv_status_${tvId}`, {
        type: 'session_ended',
        status: 'inactive',
        session_end_time: new Date().toISOString(),
        timestamp: new Date().toISOString()
    });

    // Generate new login code and trigger QR refresh after session ends
    const newCode = await generateLoginCode(tvId);
    io.emit(`tv_status_${tvId}`, {
        type: 'qr_refresh',
        new_code: newCode,
        reason: 'session_ended',
        timestamp: new Date().toISOString()
    });

    console.log(`[stopSession] Events emitted for TV ${tvId}, including session_ended and QR refresh (new code: ${newCode}).`);

    return { message: 'Session stopped successfully.' };
};

const deleteTv = (id) => {
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM tvs WHERE id = ?`, id, function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
        });
    });
};

const pingTv = (tvId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT ip_address FROM tvs WHERE id = ?', [tvId], async (err, row) => {
            if (err) {
                return reject(new Error('Failed to get TV IP address.'));
            }
            if (!row || !row.ip_address) {
                return resolve(false); // Resolve with false if no TV or IP
            }

            const ip = row.ip_address.replace('::ffff:', ''); // Clean up IPv6 prefix if present

            try {
                const res = await ping.promise.probe(ip, {
                    timeout: 2, // 2 seconds timeout
                    extra: ['-n', '1'], // Send only 1 echo request on Windows
                });
                resolve(res.alive);
            } catch (error) {
                resolve(false);
            }
        });
    });
};

// TV Lock Management Functions
const lockTvForUser = (tvId, userPhone, durationSeconds = 120) => {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT OR REPLACE INTO tv_locks
            (tv_id, user_phone, expires_at)
            VALUES (?, ?, datetime('now', '+${durationSeconds} seconds'))
        `;
        db.run(sql, [tvId, userPhone], function(err) {
            if (err) return reject(err);
            console.log(`🔒 TV ${tvId} locked for user ${userPhone} (${durationSeconds}s)`);
            resolve({ tvId, userPhone, duration: durationSeconds });
        });
    });
};

const getTvLock = (tvId) => {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT * FROM tv_locks
            WHERE tv_id = ?
            AND expires_at > CURRENT_TIMESTAMP
        `;
        db.get(sql, [tvId], (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

const unlockTv = (tvId) => {
    return new Promise((resolve, reject) => {
        const sql = `DELETE FROM tv_locks WHERE tv_id = ?`;
        db.run(sql, [tvId], function(err) {
            if (err) return reject(err);
            console.log(`🔓 TV ${tvId} unlocked`);
            resolve({ tvId, unlocked: true });
        });
    });
};

const cleanupExpiredLocks = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            // First, get expired locks for notification
            const expiredLocks = await new Promise((resolve, reject) => {
                const sql = `
                    SELECT tl.*, tvs.name as tv_name
                    FROM tv_locks tl
                    JOIN tvs ON tvs.id = tl.tv_id
                    WHERE tl.expires_at <= CURRENT_TIMESTAMP
                `;
                db.all(sql, [], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows);
                });
            });

            // Send timeout notifications
            if (expiredLocks.length > 0) {
                const whatsappNotificationService = require('./whatsappNotificationService');

                for (const lock of expiredLocks) {
                    try {
                        // Clean phone number - remove @c.us suffix
                        let cleanPhone = lock.user_phone;
                        if (cleanPhone.includes('@c.us')) {
                            cleanPhone = cleanPhone.replace('@c.us', '');
                        }

                        // Get member name from clean phone number
                        const member = await new Promise((resolve, reject) => {
                            db.get('SELECT name FROM members WHERE phone_number = ?', [cleanPhone], (err, row) => {
                                if (err) return reject(err);
                                resolve(row);
                            });
                        });

                        if (member) {
                            await whatsappNotificationService.sendTimeoutNotification(
                                lock.user_phone, // Keep original format for WhatsApp sending
                                member.name,
                                lock.tv_name,
                                2 // 2 minutes timeout
                            );
                        }
                    } catch (error) {
                        console.error(`Error sending timeout notification for ${lock.user_phone}:`, error);
                    }
                }
            }

            // Then delete expired locks
            const sql = `DELETE FROM tv_locks WHERE expires_at <= CURRENT_TIMESTAMP`;
            db.run(sql, [], function(err) {
                if (err) return reject(err);
                if (this.changes > 0) {
                    console.log(`🧹 Cleaned up ${this.changes} expired TV locks (with notifications)`);
                }
                resolve({ cleaned: this.changes, notified: expiredLocks.length });
            });

        } catch (error) {
            reject(error);
        }
    });
};

// User Eligibility Check
const checkUserEligibility = async (phone) => {
    try {
        // Clean phone number - remove @c.us suffix if present
        let cleanPhone = phone;
        if (cleanPhone.includes('@c.us')) {
            cleanPhone = cleanPhone.replace('@c.us', '');
        }

        // Check if member exists (FIXED: Use correct column name phone_number)
        const member = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM members WHERE phone_number = ?', [cleanPhone], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!member) {
            return {
                eligible: false,
                reason: 'not_registered',
                message: 'Nomor belum terdaftar'
            };
        }

        // Check if member has packages
        const packages = await new Promise((resolve, reject) => {
            db.all(`
                SELECT mp.*, p.name as package_name, p.price, p.duration_minutes
                FROM member_packages mp
                JOIN packages p ON mp.package_id = p.id
                WHERE mp.member_id = ? AND mp.remaining_minutes > 0
                ORDER BY mp.remaining_minutes DESC
            `, [member.id], (err, rows) => {
                if (err) return reject(err);
                resolve(rows);
            });
        });

        if (!packages || packages.length === 0) {
            return {
                eligible: false,
                reason: 'no_packages',
                message: 'Tidak ada paket tersedia'
            };
        }

        return {
            eligible: true,
            member: member,
            packages: packages
        };

    } catch (error) {
        console.error('Error checking user eligibility:', error);
        return {
            eligible: false,
            reason: 'system_error',
            message: 'Terjadi kesalahan sistem'
        };
    }
};

module.exports = {
    updateTvDetails,
    generateLoginCode,
    getTvByLoginCode,
    markLoginCodeAsUsed,
    getActiveTvByMemberId,
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
    startMemberSession,
    pingTv,
    getPackageById,
    checkAndNotifyExpiredLoginCodes,
    cleanupExpiredLoginCodes,
    // TV Lock functions
    lockTvForUser,
    getTvLock,
    unlockTv,
    cleanupExpiredLocks,
    checkUserEligibility
};