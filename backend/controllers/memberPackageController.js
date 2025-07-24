const db = require('../database').getInstance();
const whatsappNotificationService = require('../services/whatsappNotificationService');

// Get all packages for a specific member
exports.getMemberPackages = (req, res, next) => {
    const { memberId } = req.params;
    const sql = `
        SELECT mp.id, p.name, p.duration_minutes, mp.remaining_minutes, mp.purchase_date
        FROM member_packages mp
        JOIN packages p ON mp.package_id = p.id
        WHERE mp.member_id = ? AND mp.remaining_minutes > 0
        ORDER BY mp.purchase_date DESC
    `;

    db.all(sql, [memberId], (err, rows) => {
        if (err) {
            return next(err);
        }
        res.json({ data: rows });
    });
};

// Add a package to a member
exports.addPackageToMember = (req, res, next) => {
    const { memberId } = req.params;
    const { package_id, quantity = 1, total_amount } = req.body;

    if (!package_id) {
        return res.status(400).json({ error: 'package_id is required' });
    }

    // First, get the package details
    db.get('SELECT * FROM packages WHERE id = ?', [package_id], (err, package) => {
        if (err) {
            return next(err);
        }
        if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const totalMinutes = package.duration_minutes * quantity;
        const calculatedAmount = package.price * quantity;
        const finalAmount = total_amount || calculatedAmount;

        // Start transaction
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            // Check if member already has this package type
            db.get(
                'SELECT * FROM member_packages WHERE member_id = ? AND package_id = ?',
                [memberId, package_id],
                (err, existingPackage) => {
                    if (err) {
                        db.run('ROLLBACK');
                        return next(err);
                    }

                    if (existingPackage) {
                        // Update existing package - add minutes
                        const newRemainingMinutes = existingPackage.remaining_minutes + totalMinutes;
                        db.run(
                            'UPDATE member_packages SET remaining_minutes = ? WHERE id = ?',
                            [newRemainingMinutes, existingPackage.id],
                            function (updateErr) {
                                if (updateErr) {
                                    db.run('ROLLBACK');
                                    return next(updateErr);
                                }

                                // Log transaction
                                db.run(
                                    'INSERT INTO transactions (member_id, package_id, amount, type, status) VALUES (?, ?, ?, ?, ?)',
                                    [memberId, package_id, finalAmount, 'package_purchase', 'paid'],
                                    function (transErr) {
                                        if (transErr) {
                                            db.run('ROLLBACK');
                                            return next(transErr);
                                        }

                                        db.run('COMMIT');

                                        // Kirim notifikasi WhatsApp setelah paket berhasil ditambahkan
                                        const packageData = {
                                            packageName: package.name,
                                            duration: package.duration_minutes,
                                            price: package.price,
                                            purchaseDate: new Date(),
                                            quantity: quantity
                                        };

                                        // Kirim notifikasi secara asinkron (tidak mengganggu response)
                                        whatsappNotificationService.sendPackageActivatedNotification(memberId, packageData)
                                            .then(result => {
                                                if (result.success) {
                                                    console.log('Package activation notification sent successfully');
                                                } else {
                                                    console.error('Failed to send package activation notification:', result.error);
                                                }
                                            })
                                            .catch(error => {
                                                console.error('Error sending package activation notification:', error);
                                            });

                                        res.status(201).json({
                                            message: 'Package added successfully',
                                            data: {
                                                member_id: memberId,
                                                package_id,
                                                quantity,
                                                total_minutes: totalMinutes,
                                                total_amount: finalAmount,
                                                remaining_minutes: newRemainingMinutes
                                            }
                                        });
                                    }
                                );
                            }
                        );
                    } else {
                        // Create new package entry
                        db.run(
                            'INSERT INTO member_packages (member_id, package_id, remaining_minutes) VALUES (?, ?, ?)',
                            [memberId, package_id, totalMinutes],
                            function (insertErr) {
                                if (insertErr) {
                                    db.run('ROLLBACK');
                                    return next(insertErr);
                                }

                                // Log transaction
                                db.run(
                                    'INSERT INTO transactions (member_id, package_id, amount, type, status) VALUES (?, ?, ?, ?, ?)',
                                    [memberId, package_id, finalAmount, 'package_purchase', 'paid'],
                                    function (transErr) {
                                        if (transErr) {
                                            db.run('ROLLBACK');
                                            return next(transErr);
                                        }

                                        db.run('COMMIT');

                                        // Kirim notifikasi WhatsApp setelah paket berhasil ditambahkan
                                        const packageData = {
                                            packageName: package.name,
                                            duration: package.duration_minutes,
                                            price: package.price,
                                            purchaseDate: new Date(),
                                            quantity: quantity
                                        };

                                        // Kirim notifikasi secara asinkron (tidak mengganggu response)
                                        whatsappNotificationService.sendPackageActivatedNotification(memberId, packageData)
                                            .then(result => {
                                                if (result.success) {
                                                    console.log('Package activation notification sent successfully');
                                                } else {
                                                    console.error('Failed to send package activation notification:', result.error);
                                                }
                                            })
                                            .catch(error => {
                                                console.error('Error sending package activation notification:', error);
                                            });

                                        res.status(201).json({
                                            message: 'Package added successfully',
                                            data: {
                                                id: this.lastID,
                                                member_id: memberId,
                                                package_id,
                                                quantity,
                                                total_minutes: totalMinutes,
                                                total_amount: finalAmount,
                                                remaining_minutes: totalMinutes
                                            }
                                        });
                                    }
                                );
                            }
                        );
                    }
                }
            );
        });
    });
};