const db = require('../database');

// Get all packages for a specific member
exports.getMemberPackages = (req, res, next) => {
    const { memberId } = req.params;
    const sql = `
        SELECT mp.id, p.name, p.duration_minutes, mp.remaining_minutes, mp.purchase_date
        FROM member_packages mp
        JOIN packages p ON mp.package_id = p.id
        WHERE mp.member_id = ?
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
    const { package_id } = req.body;

    if (!package_id) {
        return res.status(400).json({ error: 'package_id is required' });
    }

    // First, get the package details to find its duration
    db.get('SELECT duration_minutes FROM packages WHERE id = ?', [package_id], (err, package) => {
        if (err) {
            return next(err);
        }
        if (!package) {
            return res.status(404).json({ error: 'Package not found' });
        }

        const remaining_minutes = package.duration_minutes;
        const sql = 'INSERT INTO member_packages (member_id, package_id, remaining_minutes) VALUES (?, ?, ?)';
        const params = [memberId, package_id, remaining_minutes];

        db.run(sql, params, function (err) {
            if (err) {
                return next(err);
            }
            res.status(201).json({ 
                message: 'Package added successfully',
                data: { id: this.lastID, member_id: memberId, package_id, remaining_minutes }
            });
        });
    });
};