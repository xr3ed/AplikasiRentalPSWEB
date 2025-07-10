const { db } = require('../database/database');
const moment = require('moment');

class SessionManager {
  constructor() {
    this.io = null;
    this.activeSessions = new Map();
    this.timers = new Map();
  }

  init(io) {
    this.io = io;
    this.loadActiveSessions();
    
    // Check sessions every minute
    setInterval(() => {
      this.checkSessions();
    }, 60000);
  }

  loadActiveSessions() {
    db.all(
      `SELECT s.*, m.phone, m.name as member_name, p.name as package_name 
       FROM sessions s 
       LEFT JOIN members m ON s.member_id = m.id 
       LEFT JOIN packages p ON s.package_id = p.id 
       WHERE s.status = 'active'`,
      [],
      (err, sessions) => {
        if (!err && sessions) {
          sessions.forEach(session => {
            this.activeSessions.set(session.tv_id, session);
            this.setupTimer(session);
          });
          console.log(`✅ Loaded ${sessions.length} active sessions`);
        }
      }
    );
  }

  startSession(sessionData) {
    const session = {
      ...sessionData,
      status: 'active',
      remainingTime: sessionData.duration * 60 // in seconds
    };
    
    this.activeSessions.set(sessionData.tvId, session);
    this.setupTimer(session);
    
    // Notify clients
    this.io.emit('session-started', {
      tvId: sessionData.tvId,
      session: this.getSessionInfo(session)
    });
    
    // Notify specific TV
    this.io.to('tv-' + sessionData.tvId).emit('session-update', {
      status: 'active',
      session: this.getSessionInfo(session)
    });
    
    console.log(`🎮 Session started for ${sessionData.tvId}`);
  }

  setupTimer(session) {
    const endTime = new Date(session.endTime || session.end_time);
    const now = new Date();
    const remainingMs = endTime.getTime() - now.getTime();
    
    if (remainingMs <= 0) {
      this.endSession(session.tv_id || session.tvId, 'expired');
      return;
    }
    
    // Clear existing timer
    if (this.timers.has(session.tv_id || session.tvId)) {
      clearTimeout(this.timers.get(session.tv_id || session.tvId));
    }
    
    // Set timer for session end
    const timer = setTimeout(() => {
      this.endSession(session.tv_id || session.tvId, 'expired');
    }, remainingMs);
    
    this.timers.set(session.tv_id || session.tvId, timer);
    
    // Set warning timer (5 minutes before end)
    const warningMs = remainingMs - (5 * 60 * 1000);
    if (warningMs > 0) {
      setTimeout(() => {
        this.sendWarning(session.tv_id || session.tvId);
      }, warningMs);
    }
  }

  endSession(tvId, reason = 'manual') {
    const session = this.activeSessions.get(tvId);
    if (!session) return;
    
    // Update database
    db.run(
      'UPDATE sessions SET status = ?, end_time = ? WHERE id = ?',
      ['completed', new Date().toISOString(), session.id],
      (err) => {
        if (err) {
          console.error('Error updating session:', err);
        }
      }
    );
    
    // Clear timer
    if (this.timers.has(tvId)) {
      clearTimeout(this.timers.get(tvId));
      this.timers.delete(tvId);
    }
    
    // Remove from active sessions
    this.activeSessions.delete(tvId);
    
    // Notify clients
    this.io.emit('session-ended', {
      tvId,
      reason,
      session: this.getSessionInfo(session)
    });
    
    // Notify specific TV
    this.io.to('tv-' + tvId).emit('session-update', {
      status: 'ended',
      reason
    });
    
    console.log(`⏹️ Session ended for ${tvId} (${reason})`);
  }

  extendSession(tvId, additionalMinutes) {
    const session = this.activeSessions.get(tvId);
    if (!session) return false;
    
    const newEndTime = new Date(session.endTime || session.end_time);
    newEndTime.setMinutes(newEndTime.getMinutes() + additionalMinutes);
    
    // Update database
    db.run(
      'UPDATE sessions SET end_time = ?, duration_minutes = duration_minutes + ? WHERE id = ?',
      [newEndTime.toISOString(), additionalMinutes, session.id],
      (err) => {
        if (err) {
          console.error('Error extending session:', err);
          return;
        }
        
        // Update session data
        session.endTime = newEndTime.toISOString();
        session.end_time = newEndTime.toISOString();
        session.duration_minutes = (session.duration_minutes || session.duration) + additionalMinutes;
        
        // Setup new timer
        this.setupTimer(session);
        
        // Notify clients
        this.io.emit('session-extended', {
          tvId,
          additionalMinutes,
          session: this.getSessionInfo(session)
        });
        
        // Notify specific TV
        this.io.to('tv-' + tvId).emit('session-update', {
          status: 'extended',
          session: this.getSessionInfo(session)
        });
        
        console.log(`⏰ Session extended for ${tvId} by ${additionalMinutes} minutes`);
      }
    );
    
    return true;
  }

  sendWarning(tvId) {
    const session = this.activeSessions.get(tvId);
    if (!session) return;
    
    // Notify admin/operator
    this.io.to('admin').emit('session-warning', {
      tvId,
      session: this.getSessionInfo(session),
      message: `Sesi ${tvId} akan berakhir dalam 5 menit`
    });
    
    // Notify TV
    this.io.to('tv-' + tvId).emit('session-warning', {
      message: 'Waktu bermain akan berakhir dalam 5 menit',
      remainingMinutes: 5
    });
    
    console.log(`⚠️ Warning sent for ${tvId}`);
  }

  checkSessions() {
    const now = new Date();
    
    this.activeSessions.forEach((session, tvId) => {
      const endTime = new Date(session.endTime || session.end_time);
      const remainingMs = endTime.getTime() - now.getTime();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      // Update remaining time
      session.remainingTime = Math.max(0, Math.floor(remainingMs / 1000));
      
      // Broadcast updated time to clients
      this.io.emit('session-time-update', {
        tvId,
        remainingTime: session.remainingTime,
        remainingMinutes
      });
      
      // Check if session should end
      if (remainingMs <= 0) {
        this.endSession(tvId, 'expired');
      }
    });
  }

  getSessionInfo(session) {
    const now = new Date();
    const endTime = new Date(session.endTime || session.end_time);
    const remainingMs = Math.max(0, endTime.getTime() - now.getTime());
    
    return {
      id: session.id,
      tvId: session.tv_id || session.tvId,
      memberPhone: session.phone,
      memberName: session.member_name,
      packageName: session.package_name,
      startTime: session.startTime || session.start_time,
      endTime: session.endTime || session.end_time,
      duration: session.duration_minutes || session.duration,
      remainingTime: Math.floor(remainingMs / 1000),
      remainingMinutes: Math.ceil(remainingMs / 60000),
      status: session.status,
      createdBy: session.created_by
    };
  }

  getAllActiveSessions() {
    const sessions = [];
    this.activeSessions.forEach((session, tvId) => {
      sessions.push(this.getSessionInfo(session));
    });
    return sessions;
  }

  getSessionByTvId(tvId) {
    const session = this.activeSessions.get(tvId);
    return session ? this.getSessionInfo(session) : null;
  }

  dailyReset() {
    console.log('🔄 Running daily reset...');
    
    // End all active sessions
    this.activeSessions.forEach((session, tvId) => {
      this.endSession(tvId, 'daily_reset');
    });
    
    // Reset TV status
    db.run('UPDATE tvs SET status = "offline"', (err) => {
      if (!err) {
        console.log('✅ TV status reset completed');
      }
    });
    
    // Clean old messages (keep last 7 days)
    const weekAgo = moment().subtract(7, 'days').toISOString();
    db.run(
      'DELETE FROM wa_messages WHERE created_at < ?',
      [weekAgo],
      function(err) {
        if (!err) {
          console.log(`🗑️ Cleaned ${this.changes} old WhatsApp messages`);
        }
      }
    );
    
    // Notify admin
    this.io.to('admin').emit('daily-reset', {
      message: 'Daily reset completed',
      timestamp: new Date().toISOString()
    });
  }

  getTVStatus() {
    return new Promise((resolve) => {
      db.all(
        `SELECT t.*, 
                CASE WHEN s.id IS NOT NULL THEN 'active' ELSE t.status END as current_status,
                s.id as session_id
         FROM tvs t 
         LEFT JOIN sessions s ON t.tv_id = s.tv_id AND s.status = 'active'
         ORDER BY t.tv_id`,
        [],
        (err, tvs) => {
          if (err) {
            resolve([]);
            return;
          }
          
          const result = tvs.map(tv => {
            const session = this.getSessionByTvId(tv.tv_id);
            return {
              ...tv,
              current_status: session ? 'active' : tv.status,
              session
            };
          });
          
          resolve(result);
        }
      );
    });
  }
}

module.exports = new SessionManager();