const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database/database');
const router = express.Router();

const JWT_SECRET = 'billing-ps-secret-key-2024';

// Middleware untuk verifikasi token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get(
    'SELECT * FROM users WHERE username = ?',
    [username],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // For default admin, check plain text password
      let isValidPassword = false;
      if (username === 'admin' && password === 'ikbal') {
        isValidPassword = true;
        
        // Hash the password for future use
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(
          'UPDATE users SET password = ? WHERE username = ?',
          [hashedPassword, username]
        );
      } else {
        isValidPassword = await bcrypt.compare(password, user.password);
      }

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username, 
          role: user.role,
          permissions: JSON.parse(user.permissions || '[]')
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: JSON.parse(user.permissions || '[]')
        }
      });
    }
  );
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  db.get(
    'SELECT id, username, role, permissions, created_at FROM users WHERE id = ?',
    [req.user.id],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        success: true,
        user: {
          ...user,
          permissions: JSON.parse(user.permissions || '[]')
        }
      });
    }
  );
});

// Change password
router.post('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current and new password required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  db.get(
    'SELECT * FROM users WHERE id = ?',
    [req.user.id],
    async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedNewPassword, req.user.id],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update password' });
          }

          res.json({ success: true, message: 'Password updated successfully' });
        }
      );
    }
  );
});

// Create operator (admin only)
router.post('/create-operator', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, password, permissions = [] } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  db.run(
    'INSERT INTO users (username, password, role, permissions) VALUES (?, ?, ?, ?)',
    [username, hashedPassword, 'operator', JSON.stringify(permissions)],
    function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') {
          return res.status(400).json({ error: 'Username already exists' });
        }
        return res.status(500).json({ error: 'Failed to create operator' });
      }

      res.json({
        success: true,
        message: 'Operator created successfully',
        operator: {
          id: this.lastID,
          username,
          role: 'operator',
          permissions
        }
      });
    }
  );
});

// Get all operators (admin only)
router.get('/operators', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all(
    'SELECT id, username, role, permissions, created_at FROM users WHERE role = "operator"',
    [],
    (err, operators) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      const result = operators.map(op => ({
        ...op,
        permissions: JSON.parse(op.permissions || '[]')
      }));

      res.json({ success: true, operators: result });
    }
  );
});

// Update operator permissions (admin only)
router.put('/operators/:id/permissions', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { permissions } = req.body;
  const operatorId = req.params.id;

  db.run(
    'UPDATE users SET permissions = ? WHERE id = ? AND role = "operator"',
    [JSON.stringify(permissions || []), operatorId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update permissions' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Operator not found' });
      }

      res.json({ success: true, message: 'Permissions updated successfully' });
    }
  );
});

// Delete operator (admin only)
router.delete('/operators/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const operatorId = req.params.id;

  db.run(
    'DELETE FROM users WHERE id = ? AND role = "operator"',
    [operatorId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete operator' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Operator not found' });
      }

      res.json({ success: true, message: 'Operator deleted successfully' });
    }
  );
});

module.exports = { router, authenticateToken };