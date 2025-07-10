const express = require('express');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const router = express.Router();

// Get all packages
router.get('/', authenticateToken, (req, res) => {
  const { includeInactive = false } = req.query;
  
  let query = 'SELECT * FROM packages';
  let params = [];
  
  if (!includeInactive) {
    query += ' WHERE is_active = 1';
  }
  
  query += ' ORDER BY duration_minutes ASC';
  
  db.all(query, params, (err, packages) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({
      success: true,
      packages
    });
  });
});

// Get package by ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM packages WHERE id = ?',
    [id],
    (err, package) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!package) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      // Get usage statistics
      db.all(
        `SELECT 
           COUNT(*) as usage_count,
           SUM(duration_minutes) as total_minutes,
           DATE(start_time) as date
         FROM sessions 
         WHERE package_id = ? 
         GROUP BY DATE(start_time) 
         ORDER BY date DESC 
         LIMIT 30`,
        [id],
        (err, usageStats) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to get usage statistics' });
          }
          
          // Get total usage
          db.get(
            `SELECT 
               COUNT(*) as total_sessions,
               SUM(duration_minutes) as total_minutes,
               COUNT(DISTINCT member_id) as unique_members
             FROM sessions 
             WHERE package_id = ?`,
            [id],
            (err, totalStats) => {
              if (err) {
                return res.status(500).json({ error: 'Failed to get total statistics' });
              }
              
              res.json({
                success: true,
                package: {
                  ...package,
                  usageStats: usageStats || [],
                  totalStats: totalStats || {
                    total_sessions: 0,
                    total_minutes: 0,
                    unique_members: 0
                  }
                }
              });
            }
          );
        }
      );
    }
  );
});

// Create new package
router.post('/', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { name, duration_minutes, price = 0, description = '' } = req.body;
  
  if (!name || !duration_minutes) {
    return res.status(400).json({ error: 'Name and duration required' });
  }
  
  if (duration_minutes < 1) {
    return res.status(400).json({ error: 'Duration must be at least 1 minute' });
  }
  
  if (price < 0) {
    return res.status(400).json({ error: 'Price cannot be negative' });
  }
  
  db.run(
    'INSERT INTO packages (name, duration_minutes, price, description) VALUES (?, ?, ?, ?)',
    [name, duration_minutes, price, description],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Package name already exists' });
        }
        return res.status(500).json({ error: 'Failed to create package' });
      }
      
      res.json({
        success: true,
        message: 'Package created successfully',
        package: {
          id: this.lastID,
          name,
          duration_minutes,
          price,
          description,
          is_active: 1
        }
      });
    }
  );
});

// Update package
router.put('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  const { name, duration_minutes, price, description, is_active } = req.body;
  
  // Check if package exists
  db.get(
    'SELECT * FROM packages WHERE id = ?',
    [id],
    (err, package) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!package) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      // Validate inputs
      if (duration_minutes !== undefined && duration_minutes < 1) {
        return res.status(400).json({ error: 'Duration must be at least 1 minute' });
      }
      
      if (price !== undefined && price < 0) {
        return res.status(400).json({ error: 'Price cannot be negative' });
      }
      
      // Build update query
      const updates = [];
      const params = [];
      
      if (name !== undefined) {
        updates.push('name = ?');
        params.push(name);
      }
      
      if (duration_minutes !== undefined) {
        updates.push('duration_minutes = ?');
        params.push(duration_minutes);
      }
      
      if (price !== undefined) {
        updates.push('price = ?');
        params.push(price);
      }
      
      if (description !== undefined) {
        updates.push('description = ?');
        params.push(description);
      }
      
      if (is_active !== undefined) {
        updates.push('is_active = ?');
        params.push(is_active ? 1 : 0);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      params.push(id);
      
      db.run(
        `UPDATE packages SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to update package' });
          }
          
          res.json({
            success: true,
            message: 'Package updated successfully'
          });
        }
      );
    }
  );
});

// Toggle package status
router.post('/:id/toggle', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM packages WHERE id = ?',
    [id],
    (err, package) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!package) {
        return res.status(404).json({ error: 'Package not found' });
      }
      
      const newStatus = package.is_active === 1 ? 0 : 1;
      
      db.run(
        'UPDATE packages SET is_active = ? WHERE id = ?',
        [newStatus, id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to toggle package status' });
          }
          
          res.json({
            success: true,
            message: `Package ${newStatus ? 'activated' : 'deactivated'} successfully`,
            is_active: newStatus === 1
          });
        }
      );
    }
  );
});

// Delete package
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  // Check if package is being used
  db.get(
    'SELECT COUNT(*) as count FROM sessions WHERE package_id = ?',
    [id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ 
          error: 'Cannot delete package that has been used in sessions',
          suggestion: 'Consider deactivating the package instead'
        });
      }
      
      // Check if package is in member packages
      db.get(
        'SELECT COUNT(*) as count FROM member_packages WHERE package_id = ?',
        [id],
        (err, memberResult) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (memberResult.count > 0) {
            return res.status(400).json({ 
              error: 'Cannot delete package that is owned by members',
              suggestion: 'Consider deactivating the package instead'
            });
          }
          
          // Safe to delete
          db.run(
            'DELETE FROM packages WHERE id = ?',
            [id],
            function(err) {
              if (err) {
                return res.status(500).json({ error: 'Failed to delete package' });
              }
              
              if (this.changes === 0) {
                return res.status(404).json({ error: 'Package not found' });
              }
              
              res.json({
                success: true,
                message: 'Package deleted successfully'
              });
            }
          );
        }
      );
    }
  );
});

// Get package statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const { period = 'all' } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  if (period !== 'all') {
    const now = new Date();
    
    switch (period) {
      case 'today':
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = 'AND s.start_time >= ?';
        params.push(today.toISOString());
        break;
      case 'week':
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        dateFilter = 'AND s.start_time >= ?';
        params.push(weekAgo.toISOString());
        break;
      case 'month':
        const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        dateFilter = 'AND s.start_time >= ?';
        params.push(monthAgo.toISOString());
        break;
    }
  }
  
  // Get package usage statistics
  db.all(
    `SELECT 
       p.id,
       p.name,
       p.duration_minutes,
       p.price,
       p.is_active,
       COUNT(s.id) as usage_count,
       SUM(s.duration_minutes) as total_minutes,
       SUM(p.price) as total_revenue,
       COUNT(DISTINCT s.member_id) as unique_members
     FROM packages p
     LEFT JOIN sessions s ON p.id = s.package_id ${dateFilter}
     GROUP BY p.id, p.name, p.duration_minutes, p.price, p.is_active
     ORDER BY usage_count DESC`,
    params,
    (err, packageStats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get overall statistics
      const queries = [
        'SELECT COUNT(*) as total FROM packages',
        'SELECT COUNT(*) as active FROM packages WHERE is_active = 1',
        'SELECT COUNT(*) as inactive FROM packages WHERE is_active = 0'
      ];
      
      Promise.all(queries.map(query => {
        return new Promise((resolve) => {
          db.get(query, [], (err, result) => {
            resolve(err ? 0 : Object.values(result)[0] || 0);
          });
        });
      })).then(([total, active, inactive]) => {
        res.json({
          success: true,
          stats: {
            total,
            active,
            inactive,
            packageStats: packageStats || []
          },
          period
        });
      });
    }
  );
});

// Get popular packages
router.get('/stats/popular', authenticateToken, (req, res) => {
  const { limit = 5, period = 'month' } = req.query;
  
  let dateFilter = '';
  let params = [];
  
  const now = new Date();
  
  switch (period) {
    case 'today':
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      dateFilter = 'AND s.start_time >= ?';
      params.push(today.toISOString());
      break;
    case 'week':
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = 'AND s.start_time >= ?';
      params.push(weekAgo.toISOString());
      break;
    case 'month':
      const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      dateFilter = 'AND s.start_time >= ?';
      params.push(monthAgo.toISOString());
      break;
    case 'all':
    default:
      // No date filter
      break;
  }
  
  params.push(parseInt(limit));
  
  db.all(
    `SELECT 
       p.id,
       p.name,
       p.duration_minutes,
       p.price,
       COUNT(s.id) as usage_count,
       SUM(p.price) as total_revenue,
       ROUND(AVG(s.duration_minutes), 2) as avg_actual_duration
     FROM packages p
     JOIN sessions s ON p.id = s.package_id
     WHERE 1=1 ${dateFilter}
     GROUP BY p.id, p.name, p.duration_minutes, p.price
     ORDER BY usage_count DESC
     LIMIT ?`,
    params,
    (err, popularPackages) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({
        success: true,
        popularPackages: popularPackages || [],
        period
      });
    }
  );
});

// Bulk update packages
router.post('/bulk-update', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { packages, action } = req.body; // packages: array of IDs, action: 'activate', 'deactivate', 'delete'
  
  if (!packages || !Array.isArray(packages) || packages.length === 0) {
    return res.status(400).json({ error: 'Package IDs array required' });
  }
  
  if (!['activate', 'deactivate', 'delete'].includes(action)) {
    return res.status(400).json({ error: 'Invalid action' });
  }
  
  const placeholders = packages.map(() => '?').join(',');
  
  if (action === 'delete') {
    // Check if any package is being used
    db.get(
      `SELECT COUNT(*) as count FROM sessions WHERE package_id IN (${placeholders})`,
      packages,
      (err, result) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.count > 0) {
          return res.status(400).json({ 
            error: 'Cannot delete packages that have been used in sessions'
          });
        }
        
        // Check member packages
        db.get(
          `SELECT COUNT(*) as count FROM member_packages WHERE package_id IN (${placeholders})`,
          packages,
          (err, memberResult) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (memberResult.count > 0) {
              return res.status(400).json({ 
                error: 'Cannot delete packages that are owned by members'
              });
            }
            
            // Safe to delete
            db.run(
              `DELETE FROM packages WHERE id IN (${placeholders})`,
              packages,
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Failed to delete packages' });
                }
                
                res.json({
                  success: true,
                  message: `${this.changes} package(s) deleted successfully`
                });
              }
            );
          }
        );
      }
    );
  } else {
    // Activate or deactivate
    const newStatus = action === 'activate' ? 1 : 0;
    
    db.run(
      `UPDATE packages SET is_active = ? WHERE id IN (${placeholders})`,
      [newStatus, ...packages],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update packages' });
        }
        
        res.json({
          success: true,
          message: `${this.changes} package(s) ${action}d successfully`
        });
      }
    );
  }
});

module.exports = router;