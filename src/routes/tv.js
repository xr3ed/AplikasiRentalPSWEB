const express = require('express');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const { db } = require('../database/database');
const { authenticateToken } = require('./auth');
const sessionManager = require('../services/sessionManager');
const router = express.Router();

// Get all TVs with status
router.get('/', authenticateToken, async (req, res) => {
  try {
    const tvs = await sessionManager.getTVStatus();
    res.json({ success: true, tvs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get TV status' });
  }
});

// Register/Pair TV
router.post('/register', (req, res) => {
  const { ip, deviceInfo } = req.body;
  
  if (!ip) {
    return res.status(400).json({ error: 'IP address required' });
  }

  // Check if TV with this IP already exists
  db.get(
    'SELECT * FROM tvs WHERE ip_address = ?',
    [ip],
    (err, existingTv) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (existingTv) {
        // Update existing TV
        db.run(
          'UPDATE tvs SET status = ?, last_seen = ? WHERE ip_address = ?',
          ['online', new Date().toISOString(), ip],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Failed to update TV' });
            }

            res.json({
              success: true,
              tv: {
                id: existingTv.id,
                tvId: existingTv.tv_id,
                name: existingTv.name,
                isPaired: existingTv.is_paired === 1,
                pairingToken: existingTv.pairing_token
              }
            });
          }
        );
      } else {
        // Create new TV
        const tvCount = db.get(
          'SELECT COUNT(*) as count FROM tvs',
          [],
          (err, result) => {
            const nextNumber = (result?.count || 0) + 1;
            const tvId = `TV${nextNumber.toString().padStart(2, '0')}`;
            const pairingToken = uuidv4();

            db.run(
              'INSERT INTO tvs (tv_id, name, ip_address, status, pairing_token, last_seen) VALUES (?, ?, ?, ?, ?, ?)',
              [tvId, `TV ${nextNumber}`, ip, 'online', pairingToken, new Date().toISOString()],
              function(err) {
                if (err) {
                  return res.status(500).json({ error: 'Failed to register TV' });
                }

                res.json({
                  success: true,
                  tv: {
                    id: this.lastID,
                    tvId,
                    name: `TV ${nextNumber}`,
                    isPaired: false,
                    pairingToken
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

// Pair TV (admin only)
router.post('/:tvId/pair', authenticateToken, (req, res) => {
  const { tvId } = req.params;
  const { name } = req.body;

  db.get(
    'SELECT * FROM tvs WHERE tv_id = ?',
    [tvId],
    (err, tv) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!tv) {
        return res.status(404).json({ error: 'TV not found' });
      }

      const newName = name || tv.name;
      
      db.run(
        'UPDATE tvs SET is_paired = 1, name = ? WHERE tv_id = ?',
        [newName, tvId],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to pair TV' });
          }

          // Notify TV about pairing
          const { io } = require('../../server');
          io.to('tv-' + tvId).emit('tv-paired', {
            tvId,
            name: newName,
            isPaired: true
          });

          res.json({
            success: true,
            message: 'TV paired successfully',
            tv: {
              tvId,
              name: newName,
              isPaired: true
            }
          });
        }
      );
    }
  );
});

// Unpair TV (admin only)
router.post('/:tvId/unpair', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { tvId } = req.params;

  db.run(
    'UPDATE tvs SET is_paired = 0, pairing_token = ? WHERE tv_id = ?',
    [uuidv4(), tvId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to unpair TV' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'TV not found' });
      }

      // End any active session
      sessionManager.endSession(tvId, 'unpaired');

      // Notify TV about unpairing
      const { io } = require('../../server');
      io.to('tv-' + tvId).emit('tv-unpaired', { tvId });

      res.json({
        success: true,
        message: 'TV unpaired successfully'
      });
    }
  );
});

// Get TV info for display
router.get('/:tvId/info', (req, res) => {
  const { tvId } = req.params;

  db.get(
    'SELECT * FROM tvs WHERE tv_id = ?',
    [tvId],
    (err, tv) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!tv) {
        return res.status(404).json({ error: 'TV not found' });
      }

      const session = sessionManager.getSessionByTvId(tvId);
      
      res.json({
        success: true,
        tv: {
          tvId: tv.tv_id,
          name: tv.name,
          isPaired: tv.is_paired === 1,
          status: tv.status,
          pairingToken: tv.pairing_token
        },
        session
      });
    }
  );
});

// Generate QR code for TV
router.get('/:tvId/qr', async (req, res) => {
  const { tvId } = req.params;
  const { type = 'login' } = req.query; // 'login' or 'pairing'

  try {
    db.get(
      'SELECT * FROM tvs WHERE tv_id = ?',
      [tvId],
      async (err, tv) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!tv) {
          return res.status(404).json({ error: 'TV not found' });
        }

        let qrData;
        
        if (type === 'pairing') {
          // QR for pairing (admin use)
          qrData = JSON.stringify({
            type: 'pairing',
            tvId,
            token: tv.pairing_token,
            timestamp: Date.now()
          });
        } else {
          // QR for member login via WhatsApp
          const waNumber = '6281234567890'; // Replace with actual WhatsApp number
          qrData = `https://wa.me/${waNumber}?text=${tvId}`;
        }

        const qrCodeDataURL = await QRCode.toDataURL(qrData, {
          width: 300,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        res.json({
          success: true,
          qrCode: qrCodeDataURL,
          qrData,
          type
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// Update TV status (heartbeat)
router.post('/:tvId/heartbeat', (req, res) => {
  const { tvId } = req.params;
  const { status = 'online' } = req.body;

  db.run(
    'UPDATE tvs SET status = ?, last_seen = ? WHERE tv_id = ?',
    [status, new Date().toISOString(), tvId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update TV status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'TV not found' });
      }

      res.json({ success: true, message: 'Heartbeat received' });
    }
  );
});

// Control TV (admin/operator)
router.post('/:tvId/control', authenticateToken, (req, res) => {
  const { tvId } = req.params;
  const { action, value } = req.body; // action: 'volume', 'power', 'lock', 'unlock'

  if (!action) {
    return res.status(400).json({ error: 'Action required' });
  }

  // Check if user has permission
  const hasPermission = req.user.role === 'admin' || 
    req.user.permissions.includes('tv_control');
  
  if (!hasPermission) {
    return res.status(403).json({ error: 'Permission denied' });
  }

  // Send control command to TV
  const { io } = require('../../server');
  io.to('tv-' + tvId).emit('tv-control', {
    action,
    value,
    timestamp: Date.now()
  });

  res.json({
    success: true,
    message: `Control command sent to ${tvId}`,
    action,
    value
  });
});

// Delete TV (admin only)
router.delete('/:tvId', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { tvId } = req.params;

  // End any active session first
  sessionManager.endSession(tvId, 'tv_deleted');

  db.run(
    'DELETE FROM tvs WHERE tv_id = ?',
    [tvId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete TV' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'TV not found' });
      }

      // Notify TV about deletion
      const { io } = require('../../server');
      io.to('tv-' + tvId).emit('tv-deleted', { tvId });

      res.json({
        success: true,
        message: 'TV deleted successfully'
      });
    }
  );
});

// Get TV statistics
router.get('/stats', authenticateToken, (req, res) => {
  const queries = [
    'SELECT COUNT(*) as total FROM tvs',
    'SELECT COUNT(*) as paired FROM tvs WHERE is_paired = 1',
    'SELECT COUNT(*) as online FROM tvs WHERE status = "online"',
    'SELECT COUNT(*) as active FROM sessions WHERE status = "active"'
  ];

  Promise.all(queries.map(query => {
    return new Promise((resolve) => {
      db.get(query, [], (err, result) => {
        resolve(err ? 0 : Object.values(result)[0]);
      });
    });
  })).then(([total, paired, online, active]) => {
    res.json({
      success: true,
      stats: {
        total,
        paired,
        online,
        active,
        offline: total - online
      }
    });
  });
});

module.exports = router;