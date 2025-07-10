const express = require('express');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const sessionManager = require('../services/sessionManager');
const router = express.Router();

// Get all sessions
router.get('/', authenticateToken, (req, res) => {
  const { page = 1, limit = 20, status = 'all', tvId = '', memberId = '' } = req.query;
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT s.*, 
           m.phone as member_phone, 
           m.name as member_name,
           p.name as package_name,
           p.duration_minutes as package_duration,
           p.price as package_price,
           t.name as tv_name
    FROM sessions s
    LEFT JOIN members m ON s.member_id = m.id
    LEFT JOIN packages p ON s.package_id = p.id
    LEFT JOIN tvs t ON s.tv_id = t.tv_id
    WHERE 1=1
  `;
  
  let params = [];
  
  if (status !== 'all') {
    query += ' AND s.status = ?';
    params.push(status);
  }
  
  if (tvId) {
    query += ' AND s.tv_id LIKE ?';
    params.push(`%${tvId}%`);
  }
  
  if (memberId) {
    query += ' AND s.member_id = ?';
    params.push(memberId);
  }
  
  query += ' ORDER BY s.start_time DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);
  
  db.all(query, params, (err, sessions) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM sessions s WHERE 1=1';
    let countParams = [];
    
    if (status !== 'all') {
      countQuery += ' AND s.status = ?';
      countParams.push(status);
    }
    
    if (tvId) {
      countQuery += ' AND s.tv_id LIKE ?';
      countParams.push(`%${tvId}%`);
    }
    
    if (memberId) {
      countQuery += ' AND s.member_id = ?';
      countParams.push(memberId);
    }
    
    db.get(countQuery, countParams, (err, countResult) => {
      const total = countResult ? countResult.total : 0;
      
      res.json({
        success: true,
        sessions,
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

// Get active sessions
router.get('/active', authenticateToken, (req, res) => {
  const activeSessions = sessionManager.getAllActiveSessions();
  res.json({
    success: true,
    sessions: activeSessions
  });
});

// Get session by ID
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  db.get(
    `SELECT s.*, 
            m.phone as member_phone, 
            m.name as member_name,
            p.name as package_name,
            p.duration_minutes as package_duration,
            p.price as package_price,
            t.name as tv_name
     FROM sessions s
     LEFT JOIN members m ON s.member_id = m.id
     LEFT JOIN packages p ON s.package_id = p.id
     LEFT JOIN tvs t ON s.tv_id = t.tv_id
     WHERE s.id = ?`,
    [id],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // If session is active, get real-time info
      if (session.status === 'active') {
        const activeSession = sessionManager.getSessionByTvId(session.tv_id);
        if (activeSession) {
          session.remainingTime = activeSession.remainingTime;
          session.remainingMinutes = activeSession.remainingMinutes;
        }
      }
      
      res.json({
        success: true,
        session
      });
    }
  );
});

// Start new session
router.post('/start', authenticateToken, (req, res) => {
  const { tvId, memberId, packageId, duration, notes } = req.body;
  
  if (!tvId || !duration) {
    return res.status(400).json({ error: 'TV ID and duration required' });
  }
  
  // Check if TV exists and is paired
  db.get(
    'SELECT * FROM tvs WHERE tv_id = ? AND is_paired = 1',
    [tvId],
    (err, tv) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!tv) {
        return res.status(404).json({ error: 'TV not found or not paired' });
      }
      
      // Check if TV is already in use
      const activeSession = sessionManager.getSessionByTvId(tvId);
      if (activeSession) {
        return res.status(400).json({ error: 'TV is already in use' });
      }
      
      // Validate member if provided
      if (memberId) {
        db.get(
          'SELECT * FROM members WHERE id = ?',
          [memberId],
          (err, member) => {
            if (err) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (!member) {
              return res.status(404).json({ error: 'Member not found' });
            }
            
            createSession();
          }
        );
      } else {
        createSession();
      }
      
      function createSession() {
        const startTime = new Date().toISOString();
        const endTime = new Date(Date.now() + duration * 60000).toISOString();
        
        db.run(
          `INSERT INTO sessions (tv_id, member_id, package_id, duration_minutes, start_time, end_time, created_by, notes) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [tvId, memberId || null, packageId || null, duration, startTime, endTime, req.user.username, notes || null],
          function(err) {
            if (err) {
              return res.status(500).json({ error: 'Failed to create session' });
            }
            
            const sessionData = {
              id: this.lastID,
              tvId,
              memberId,
              packageId,
              duration,
              startTime,
              endTime
            };
            
            // Start session in session manager
            sessionManager.startSession(sessionData);
            
            res.json({
              success: true,
              message: 'Session started successfully',
              session: sessionData
            });
          }
        );
      }
    }
  );
});

// End session
router.post('/:id/end', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { reason = 'manual' } = req.body;
  
  db.get(
    'SELECT * FROM sessions WHERE id = ? AND status = "active"',
    [id],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(404).json({ error: 'Active session not found' });
      }
      
      // End session
      sessionManager.endSession(session.tv_id, reason);
      
      res.json({
        success: true,
        message: 'Session ended successfully'
      });
    }
  );
});

// End session by TV ID
router.post('/tv/:tvId/end', authenticateToken, (req, res) => {
  const { tvId } = req.params;
  const { reason = 'manual' } = req.body;
  
  const activeSession = sessionManager.getSessionByTvId(tvId);
  if (!activeSession) {
    return res.status(404).json({ error: 'No active session found for this TV' });
  }
  
  sessionManager.endSession(tvId, reason);
  
  res.json({
    success: true,
    message: 'Session ended successfully'
  });
});

// Extend session
router.post('/:id/extend', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { additionalMinutes } = req.body;
  
  if (!additionalMinutes || additionalMinutes < 1) {
    return res.status(400).json({ error: 'Valid additional minutes required' });
  }
  
  db.get(
    'SELECT * FROM sessions WHERE id = ? AND status = "active"',
    [id],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(404).json({ error: 'Active session not found' });
      }
      
      const success = sessionManager.extendSession(session.tv_id, additionalMinutes);
      
      if (success) {
        res.json({
          success: true,
          message: `Session extended by ${additionalMinutes} minutes`
        });
      } else {
        res.status(500).json({ error: 'Failed to extend session' });
      }
    }
  );
});

// Extend session by TV ID
router.post('/tv/:tvId/extend', authenticateToken, (req, res) => {
  const { tvId } = req.params;
  const { additionalMinutes } = req.body;
  
  if (!additionalMinutes || additionalMinutes < 1) {
    return res.status(400).json({ error: 'Valid additional minutes required' });
  }
  
  const activeSession = sessionManager.getSessionByTvId(tvId);
  if (!activeSession) {
    return res.status(404).json({ error: 'No active session found for this TV' });
  }
  
  const success = sessionManager.extendSession(tvId, additionalMinutes);
  
  if (success) {
    res.json({
      success: true,
      message: `Session extended by ${additionalMinutes} minutes`
    });
  } else {
    res.status(500).json({ error: 'Failed to extend session' });
  }
});

// Get session statistics
router.get('/stats/overview', authenticateToken, (req, res) => {
  const { period = 'today' } = req.query;
  
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
  }
  
  const queries = [
    `SELECT COUNT(*) as total FROM sessions s WHERE 1=1 ${dateFilter}`,
    `SELECT COUNT(*) as active FROM sessions s WHERE s.status = 'active' ${dateFilter}`,
    `SELECT COUNT(*) as completed FROM sessions s WHERE s.status = 'completed' ${dateFilter}`,
    `SELECT SUM(s.duration_minutes) as total_minutes FROM sessions s WHERE 1=1 ${dateFilter}`,
    `SELECT AVG(s.duration_minutes) as avg_duration FROM sessions s WHERE 1=1 ${dateFilter}`
  ];
  
  Promise.all(queries.map(query => {
    return new Promise((resolve) => {
      db.get(query, params, (err, result) => {
        resolve(err ? 0 : Object.values(result)[0] || 0);
      });
    });
  })).then(([total, active, completed, totalMinutes, avgDuration]) => {
    res.json({
      success: true,
      stats: {
        total,
        active,
        completed,
        totalMinutes: totalMinutes || 0,
        totalHours: Math.round((totalMinutes || 0) / 60 * 100) / 100,
        avgDuration: Math.round((avgDuration || 0) * 100) / 100
      },
      period
    });
  });
});

// Get revenue statistics
router.get('/stats/revenue', authenticateToken, (req, res) => {
  const { period = 'today' } = req.query;
  
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
  }
  
  db.all(
    `SELECT 
       COUNT(*) as session_count,
       SUM(p.price) as total_revenue,
       p.name as package_name,
       p.price as package_price
     FROM sessions s
     JOIN packages p ON s.package_id = p.id
     WHERE s.package_id IS NOT NULL ${dateFilter}
     GROUP BY s.package_id, p.name, p.price
     ORDER BY total_revenue DESC`,
    params,
    (err, packageStats) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get total revenue
      db.get(
        `SELECT SUM(p.price) as total_revenue
         FROM sessions s
         JOIN packages p ON s.package_id = p.id
         WHERE s.package_id IS NOT NULL ${dateFilter}`,
        params,
        (err, totalResult) => {
          const totalRevenue = totalResult ? totalResult.total_revenue || 0 : 0;
          
          res.json({
            success: true,
            revenue: {
              total: totalRevenue,
              byPackage: packageStats || []
            },
            period
          });
        }
      );
    }
  );
});

// Delete session (admin only)
router.delete('/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { id } = req.params;
  
  db.get(
    'SELECT * FROM sessions WHERE id = ?',
    [id],
    (err, session) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      
      // If session is active, end it first
      if (session.status === 'active') {
        sessionManager.endSession(session.tv_id, 'deleted');
      }
      
      db.run(
        'DELETE FROM sessions WHERE id = ?',
        [id],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to delete session' });
          }
          
          res.json({
            success: true,
            message: 'Session deleted successfully'
          });
        }
      );
    }
  );
});

module.exports = router;