const express = require('express');
const router = express.Router();
const db = require('../database').getInstance();

// Get login code statistics
router.get('/login-codes/stats', (req, res) => {
    const queries = {
        overview: `
            SELECT 
                COUNT(*) as total_codes,
                COUNT(CASE WHEN datetime(created_at, '+5 minutes') > CURRENT_TIMESTAMP AND (used = 0 OR used IS NULL) THEN 1 END) as active_codes,
                COUNT(CASE WHEN datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP THEN 1 END) as expired_codes,
                COUNT(CASE WHEN used = 1 THEN 1 END) as used_codes,
                MIN(created_at) as oldest_code,
                MAX(created_at) as newest_code
            FROM tv_login_codes
        `,
        byTv: `
            SELECT 
                tv_id,
                COUNT(*) as total_codes,
                COUNT(CASE WHEN datetime(created_at, '+5 minutes') > CURRENT_TIMESTAMP AND (used = 0 OR used IS NULL) THEN 1 END) as active_codes,
                COUNT(CASE WHEN datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP THEN 1 END) as expired_codes,
                COUNT(CASE WHEN used = 1 THEN 1 END) as used_codes,
                MAX(created_at) as last_generated
            FROM tv_login_codes 
            GROUP BY tv_id
            ORDER BY total_codes DESC
        `,
        recent: `
            SELECT 
                tv_id,
                code,
                created_at,
                used,
                CASE 
                    WHEN used = 1 THEN 'used'
                    WHEN datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP THEN 'expired'
                    ELSE 'active'
                END as status
            FROM tv_login_codes 
            ORDER BY created_at DESC 
            LIMIT 50
        `
    };

    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, sql]) => {
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error(`Error executing ${key} query:`, err);
                results[key] = { error: err.message };
            } else {
                results[key] = key === 'overview' ? rows[0] : rows;
            }
            
            completed++;
            if (completed === totalQueries) {
                res.json({
                    timestamp: new Date().toISOString(),
                    ...results
                });
            }
        });
    });
});

// Get login code history for specific TV
router.get('/login-codes/tv/:tvId', (req, res) => {
    const { tvId } = req.params;
    const { limit = 100, status } = req.query;
    
    let whereClause = 'WHERE tv_id = ?';
    let params = [tvId];
    
    if (status === 'active') {
        whereClause += ' AND datetime(created_at, \'+5 minutes\') > CURRENT_TIMESTAMP AND (used = 0 OR used IS NULL)';
    } else if (status === 'expired') {
        whereClause += ' AND datetime(created_at, \'+5 minutes\') <= CURRENT_TIMESTAMP';
    } else if (status === 'used') {
        whereClause += ' AND used = 1';
    }
    
    const sql = `
        SELECT 
            code,
            created_at,
            used,
            CASE 
                WHEN used = 1 THEN 'used'
                WHEN datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP THEN 'expired'
                ELSE 'active'
            END as status,
            datetime(created_at, '+5 minutes') as expires_at
        FROM tv_login_codes 
        ${whereClause}
        ORDER BY created_at DESC 
        LIMIT ?
    `;
    
    params.push(parseInt(limit));
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error(`Error getting login codes for TV ${tvId}:`, err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            tvId,
            codes: rows,
            total: rows.length,
            timestamp: new Date().toISOString()
        });
    });
});

// Force cleanup expired codes
router.post('/login-codes/cleanup', (req, res) => {
    const startTime = Date.now();
    
    const sql = `
        DELETE FROM tv_login_codes
        WHERE datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP
        OR used = 1
    `;
    
    db.run(sql, [], function(err) {
        if (err) {
            console.error('Error during manual cleanup:', err);
            return res.status(500).json({ error: err.message });
        }
        
        const duration = Date.now() - startTime;
        const result = {
            deleted: this.changes,
            duration: `${duration}ms`,
            timestamp: new Date().toISOString()
        };
        
        console.log(`Manual cleanup completed: ${this.changes} codes deleted in ${duration}ms`);
        res.json(result);
    });
});

// Get problematic TVs (high code generation)
router.get('/login-codes/problematic', (req, res) => {
    const { threshold = 10, hours = 24 } = req.query;
    
    const sql = `
        SELECT 
            tv_id,
            COUNT(*) as code_count,
            COUNT(CASE WHEN datetime(created_at, '+5 minutes') <= CURRENT_TIMESTAMP THEN 1 END) as expired_count,
            COUNT(CASE WHEN used = 1 THEN 1 END) as used_count,
            MIN(created_at) as first_code,
            MAX(created_at) as last_code,
            ROUND((julianday('now') - julianday(MIN(created_at))) * 24, 2) as hours_span,
            ROUND(COUNT(*) / ((julianday('now') - julianday(MIN(created_at))) * 24), 2) as codes_per_hour
        FROM tv_login_codes 
        WHERE datetime(created_at) >= datetime('now', '-${hours} hours')
        GROUP BY tv_id
        HAVING code_count >= ?
        ORDER BY code_count DESC
    `;
    
    db.all(sql, [threshold], (err, rows) => {
        if (err) {
            console.error('Error getting problematic TVs:', err);
            return res.status(500).json({ error: err.message });
        }
        
        res.json({
            threshold,
            hours,
            problematic_tvs: rows,
            count: rows.length,
            timestamp: new Date().toISOString()
        });
    });
});

module.exports = router;
