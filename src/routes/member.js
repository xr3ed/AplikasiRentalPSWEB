const express = require('express');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all members
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 20, search = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT m.*, 
           COUNT(mp.id) as total_packages,
           SUM(mp.quantity) as total_quantity,
           COUNT(s.id) as total_sessions
    FROM members m
    LEFT JOIN member_packages mp ON m.id = mp.member_id
    LEFT JOIN sessions s ON m.id = s.member_id
  `;
  
  let params = [];
  
  if (search) {
    query += ' WHERE m.phone LIKE ? OR m.name LIKE ?';
    params.push(`%${search}%`, `%${search}%`);
  }
  
  query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  db.all(query, params, (err, members) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM members';
    let countParams = [];
    
    if (search) {
      countQuery += ' WHERE phone LIKE ? OR name LIKE ?';
      countParams.push(`%${search}%`, `%${search}%`);
    }
    
    db.get(countQuery, countParams, (err, countResult) => {
      const total = countResult ? countResult.total : 0;
      
      res.json({
        success: true,
        members,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    });
  });
});

// Get member by ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM members WHERE id = ?',
    [id],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Get member packages
      db.all(
        `SELECT mp.*, p.name, p.duration_minutes, p.price, p.description
         FROM member_packages mp
         JOIN packages p ON mp.package_id = p.id
         WHERE mp.member_id = ? AND mp.quantity > 0
         ORDER BY mp.created_at DESC`,
        [id],
        (err, packages) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to get member packages' });
          }
          
          // Get member sessions
          db.all(
            `SELECT s.*, p.name as package_name
             FROM sessions s
             LEFT JOIN packages p ON s.package_id = p.id
             WHERE s.member_id = ?
             ORDER BY s.start_time DESC
             LIMIT 10`,
            [id],
            (err, sessions) => {
              if (err) {
                return res.status(500).json({ error: 'Failed to get member sessions' });
              }
              
              res.json({
                success: true,
                member: {
                  ...member,
                  packages,
                  recentSessions: sessions
                }
              });
            }
          );
        }
      );
    }
  );
});

// Create or update member
router.post('/', authenticateToken, (req, res) => {
  const { phone, name } = req.body;
  
  if (!phone) {
    return res.status(400).json({ error: 'Phone number required' });
  }
  
  // Check if member exists
  db.get(
    'SELECT * FROM members WHERE phone = ?',
    [phone],
    (err, existingMember) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingMember) {
        // Update existing member
        db.run(
          'UPDATE members SET name = ? WHERE phone = ?',
          [name || existingMember.name, phone],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update member' });
            }
            
            res.json({
              success: true,
              message: 'Member updated successfully',
              member: {
                id: existingMember.id,
                phone,
                name: name || existingMember.name
              }
            });
          }
        );
      } else {
        // Create new member
        db.run(
          'INSERT INTO members (phone, name) VALUES (?, ?)',
          [phone, name],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create member' });
            }
            
            res.json({
              success: true,
              message: 'Member created successfully',
              member: {
                id: this.lastID,
                phone,
                name
              }
            });
          }
        );
      }
    }
  );
});

// Add package to member
router.post('/:id/packages', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { packageId, quantity = 1 } = req.body;
  
  if (!packageId || quantity < 1) {
    return res.status(400).json({ error: 'Valid package ID and quantity required' });
  }
  
  // Check if member exists
  db.get(
    'SELECT * FROM members WHERE id = ?',
    [id],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Check if package exists
      db.get(
        'SELECT * FROM packages WHERE id = ? AND is_active = 1',
        [packageId],
        (err, package) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (!package) {
            return res.status(404).json({ error: 'Package not found or inactive' });
          }
          
          // Check if member already has this package
          db.get(
            'SELECT * FROM member_packages WHERE member_id = ? AND package_id = ?',
            [id, packageId],
            (err, existingPackage) => {
              if (err) {
                return res.status(500).json({ error: 'Database error' });
              }
              
              if (existingPackage) {
                // Update quantity
                db.run(
                  'UPDATE member_packages SET quantity = quantity + ? WHERE id = ?',
                  [quantity, existingPackage.id],
                  (err) => {
                    if (err) {
                      return res.status(500).json({ error: 'Failed to update package quantity' });
                    }
                    
                    res.json({
                      success: true,
                      message: `Added ${quantity} ${package.name} package(s) to member`,
                      newQuantity: existingPackage.quantity + quantity
                    });
                  }
                );
              } else {
                // Create new member package
                db.run(
                  'INSERT INTO member_packages (member_id, package_id, quantity) VALUES (?, ?, ?)',
                  [id, packageId, quantity],
                  function(err) {
                    if (err) {
                      return res.status(500).json({ error: 'Failed to add package to member' });
                    }
                    
                    res.json({
                      success: true,
                      message: `Added ${quantity} ${package.name} package(s) to member`,
                      memberPackageId: this.lastID
                    });
                  }
                );
              }
            }
          );
        }
      );
    }
  );
});

// Remove package from member
router.delete('/:id/packages/:packageId', authenticateToken, (req, res) => {
  const { id, packageId } = req.params;
  const { quantity = 1 } = req.body;
  
  db.get(
    'SELECT * FROM member_packages WHERE member_id = ? AND package_id = ?',
    [id, packageId],
    (err, memberPackage) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!memberPackage) {
        return res.status(404).json({ error: 'Member package not found' });
      }
      
      if (memberPackage.quantity <= quantity) {
        // Remove completely
        db.run(
          'DELETE FROM member_packages WHERE id = ?',
          [memberPackage.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to remove package' });
            }
            
            res.json({
              success: true,
              message: 'Package removed from member'
            });
          }
        );
      } else {
        // Decrease quantity
        db.run(
          'UPDATE member_packages SET quantity = quantity - ? WHERE id = ?',
          [quantity, memberPackage.id],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update package quantity' });
            }
            
            res.json({
              success: true,
              message: `Removed ${quantity} package(s) from member`,
              remainingQuantity: memberPackage.quantity - quantity
            });
          }
        );
      }
    }
  );
});

// Get member by phone
router.get('/phone/:phone', authenticateToken, (req, res) => {
  const { phone } = req.params;
  
  db.get(
    'SELECT * FROM members WHERE phone = ?',
    [phone],
    (err, member) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }
      
      // Get member packages
      db.all(
        `SELECT mp.*, p.name, p.duration_minutes, p.price
         FROM member_packages mp
         JOIN packages p ON mp.package_id = p.id
         WHERE mp.member_id = ? AND mp.quantity > 0`,
        [member.id],
        (err, packages) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to get member packages' });
          }
          
          res.json({
            success: true,
            member: {
              ...member,
              packages
            }
          });
        }
      );
    }
  );
});

// Delete member
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  // Check for active sessions
  db.get(
    'SELECT COUNT(*) as count FROM sessions WHERE member_id = ? AND status = "active"',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ error: 'Cannot delete member with active sessions' });
      }
      
      // Delete member packages first
      db.run(
        'DELETE FROM member_packages WHERE member_id = ?',
        [id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete member packages' });
          }
          
          // Delete member
          db.run(
            'DELETE FROM members WHERE id = ?',
            [id],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to delete member' });
              }
              
              if (this.changes === 0) {
                return res.status(404).json({ error: 'Member not found' });
              }
              
              res.json({
                success: true,
                message: 'Member deleted successfully'
              });
            }
          );
        }
      );
    }
  );
});

// Get member statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total FROM members',
    'SELECT COUNT(DISTINCT member_id) as active FROM sessions WHERE status = "active"',
    'SELECT COUNT(*) as total_packages FROM member_packages WHERE quantity > 0',
    'SELECT SUM(quantity) as total_quantity FROM member_packages'
  ];
  
  Promise.all(queries.map(query => {
    return new Promise((resolve) => {
      db.get(query, [], (err, result) => {
        resolve(err ? 0 : Object.values(result)[0] || 0);
      });
    });
  })).then(([total, active, totalPackages, totalQuantity]) => {
    res.json({
      success: true,
      stats: {
        total,
        active,
        totalPackages,
        totalQuantity
      }
    });
  });
});

module.exports = router;