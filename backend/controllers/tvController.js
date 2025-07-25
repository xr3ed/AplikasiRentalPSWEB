const os = require('os');
const tvService = require('../services/tvService');
const db = require('../database').getInstance();
const { generateQRCode } = require('../utils/qrCodeUtils');
const adbService = require('../services/adbService');
const adbStartupService = require('../services/adbStartupService');

exports.getAllTvs = async (req, res, next) => {
    try {
        const tvs = await tvService.getAllTvs();
        res.json({ data: tvs });
    } catch (err) {
        next(err);
    }
};

exports.createTv = async (req, res, next) => {
    try {
        const ipAddress = req.ip;
        // Creates a TV entry in a 'pairing' state without a final name.
        const newTv = await tvService.createTv(`TV_PAIRING_${Date.now()}`, 'pairing', ipAddress);
        res.status(201).json(newTv);
    } catch (err) {
        next(err);
    }
};

exports.pairTv = async (req, res, next) => {
    try {
        const { tvId, clientName } = req.body;
        if (!tvId || !clientName) {
            return res.status(400).json({ error: 'tvId and clientName are required.' });
        }

        const updatedTv = await tvService.updateTvName(tvId, clientName);
        if (!updatedTv) {
            return res.status(404).json({ error: 'TV not found or could not be updated.' });
        }

        // Optionally, update status from 'pairing' to 'off' or 'inactive'
        await tvService.updateTvStatus(tvId, 'inactive');

        res.json({ message: 'TV paired successfully', tv: updatedTv });
    } catch (err) {
        next(err);
    }
};

exports.getTvByName = async (req, res, next) => {
    try {
        const { name } = req.params;
        let tv = await tvService.getTvByName(name);
        // This function might need re-evaluation. For now, it just fetches.
        if (!tv) {
            return res.status(404).json({ error: 'TV not found.' });
        }
        res.json({ data: tv });
    } catch (err) {
        next(err);
    }
};

exports.getTvById = async (req, res, next) => {
    try {
        const tv = await tvService.getTvById(req.params.id);
        res.json(tv);
    } catch (err) {
        next(err);
    }
};

exports.updateTv = async (req, res, next) => {
    const { id } = req.params;
    const { status, package_id, member_id } = req.body;

    console.log(`[updateTv] Received request for TV ID: ${id}`);
    console.log(`[updateTv] Request body:`, req.body);

    try {
        let result;
        if (status === 'on') {
            if (!package_id) {
                return res.status(400).json({ error: 'Package ID is required to start a session.' });
            }
            const parsedPackageId = parseInt(package_id, 10);
            if (isNaN(parsedPackageId)) {
                return res.status(400).json({ error: 'Invalid package_id format.' });
            }
            const io = req.app.get('io');
            if (member_id) {
                result = await tvService.startPackageSession(id, parsedPackageId, member_id, io);
            } else {
                // Regular session using a package
                const packageDetails = await tvService.getPackageById(parsedPackageId);
                if (!packageDetails) {
                    return res.status(404).json({ error: 'Package not found.' });
                }
                result = await tvService.startRegularSession(id, packageDetails.duration_minutes, packageDetails.price, io);
            }
        } else if (status === 'off') {
            const io = req.app.get('io');
            result = await tvService.stopSession(id, io);
        } else {
            return res.status(400).json({ error: 'Invalid status provided.' });
        }
        console.log(`[updateTv] Successfully processed request for TV ID: ${id}. Result:`, result);

        // The service function now handles emitting the event.
        // const io = req.app.get('io');
        // const updatedTv = await tvService.getTvById(id);
        // io.emit('tv_updated', updatedTv);

        res.json(result);
    } catch (err) {
        console.error(`[updateTv] Error processing request for TV ID: ${id}.`, err);
        res.status(500).json({ message: err.message || 'An unexpected error occurred.' });
    }
};

exports.getTvQRCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tv = await tvService.getTvById(id);
        if (!tv) {
            return res.status(404).json({ error: 'TV not found' });
        }

        const pairingUrl = `http://${req.headers.host.split(':')[0]}:3000/pair-tv?tvId=${tv.id}`;
        const qrCodeDataUrl = await generateQRCode(pairingUrl);
        console.log('Generated QR Code URL:', qrCodeDataUrl); // Logging for debug
        res.json({ qrCode: qrCodeDataUrl, pairingUrl: pairingUrl });
    } catch (err) {
        next(err);
    }
};

exports.getMemberLoginQRCode = async (req, res, next) => {
    try {
        const { id } = req.params;
        const tv = await tvService.getTvById(id);
        if (!tv) {
            return res.status(404).json({ error: 'TV not found' });
        }

        // Gunakan nomor dari environment variable jika ada, jika tidak gunakan placeholder
        const whatsAppNumber = process.env.WHATSAPP_NUMBER || '6281234567890';
        const message = `TV${tv.id}`;
        const waUrl = `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(message)}`;

        const qrCodeDataUrl = await generateQRCode(waUrl);
        res.json({ qrCode: qrCodeDataUrl, waUrl: waUrl });
    } catch (err) {
        next(err);
    }
};

exports.generateLoginCodeForTv = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Get TV details for logging
        const tv = await tvService.getTvById(id);
        const tvName = tv ? tv.name : `TV ${id}`;

        const code = await tvService.generateLoginCode(id);

        // Log code generation (RESTORED MISSING FEATURE)
        console.log(`🔑 Memberikan login code ${code} ke ${tvName} (ID: ${id})`);

        const whatsAppNumber = process.env.WHATSAPP_NUMBER || '6281234567890'; // Fallback
        res.json({ code, whatsAppNumber });
    } catch (err) {
        console.error(`❌ Error generating login code for TV ${id}:`, err);
        next(err);
    }
};

exports.updateTvDetails = async (req, res, next) => {
    const { id } = req.params;
    const { name, status } = req.body; // Assuming name and status can be updated.

    try {
        const updatedTv = await tvService.updateTvDetails(id, { name, status });
        if (!updatedTv) {
            return res.status(404).json({ error: 'TV not found or could not be updated.' });
        }

        const io = req.app.get('io');
        io.emit('tv_updated', updatedTv);

        res.json({ message: 'TV details updated successfully', tv: updatedTv });
    } catch (err) {
        console.error(`[updateTvDetails] Error processing request for TV ID: ${id}.`, err);
        res.status(500).json({ error: err.message || 'An unexpected error occurred.' });
    }
};

// NEW: Update TV IP address
exports.updateTvIpAddress = async (req, res, next) => {
    const { id } = req.params;
    const { ip_address } = req.body;

    if (!ip_address) {
        return res.status(400).json({ error: 'IP address is required' });
    }

    try {
        const updatedTv = await tvService.updateTvIpAddress(id, ip_address);
        if (!updatedTv) {
            return res.status(404).json({ error: 'TV not found' });
        }

        const io = req.app.get('io');
        io.emit('tv_updated', updatedTv);

        res.json({
            message: 'TV IP address updated successfully',
            tv: updatedTv,
            old_ip: req.body.old_ip || 'unknown',
            new_ip: ip_address
        });
    } catch (err) {
        console.error(`[updateTvIpAddress] Error updating IP for TV ID: ${id}`, err);
        res.status(500).json({ error: err.message || 'Failed to update TV IP address' });
    }
};

exports.deleteTv = async (req, res, next) => {
    try {
        const result = await tvService.deleteTv(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.ping = async (req, res, next) => {
    try {
        const { id } = req.params;
        const isOnline = await tvService.pingTv(id);
        res.status(200).json({ isOnline });
    } catch (error) {
        next(error);
    }
};

exports.getServerIp = (req, res) => {
    const networkInterfaces = os.networkInterfaces();
    let serverIp = '127.0.0.1'; // Default to localhost

    // Iterate over network interfaces to find a non-internal IPv4 address
    for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        for (const iface of interfaces) {
            if (!iface.internal && iface.family === 'IPv4') {
                serverIp = iface.address;
                break;
            }
        }
        if (serverIp !== '127.0.0.1') {
            break;
        }
    }

    res.json({ serverIp });
};

// ADB-related controller functions

// NEW: Setup TV only (without database operations) - for "Setup TV Otomatis"
exports.setupTvOnly = async (req, res, next) => {
    try {
        const { ipAddress, name } = req.body;

        if (!ipAddress) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'TV name is required'
            });
        }

        console.log(`🔧 [Setup Only] Setting up TV: ${name} at ${ipAddress}`);

        // STEP 1: Ping check first
        const ping = require('ping');
        console.log(`📡 [Setup Only] Checking network connectivity to ${ipAddress}...`);

        const pingResult = await ping.promise.probe(ipAddress, {
            timeout: 5,
            extra: ['-n', '3'] // Windows style: -n instead of -c
        });

        if (!pingResult.alive) {
            console.log(`❌ [Setup Only] Ping failed to ${ipAddress}`);
            return res.status(400).json({
                success: false,
                error: 'IP address tidak dapat dijangkau',
                message: `Tidak dapat melakukan ping ke ${ipAddress}. Pastikan TV sudah terhubung ke jaringan dan IP address benar.`,
                pingResult: {
                    alive: false,
                    time: pingResult.time,
                    host: ipAddress
                }
            });
        }

        console.log(`✅ [Setup Only] Ping successful to ${ipAddress} (${pingResult.time}ms)`);

        // STEP 2: Setup TV with ADB (without database operations)
        console.log(`🔧 [Setup Only] Setting up ADB connection...`);

        // Get Socket.IO instance for real-time updates
        const io = req.app.get('io');

        // Create status callback for real-time updates
        const statusCallback = (status) => {
            console.log(`📡 [Setup Only] [WebSocket] Broadcasting status:`, status);
            io.emit('tv-setup-status', {
                ipAddress: ipAddress,
                name: name,
                setupType: 'setup-only',
                ...status
            });
        };

        // Call setup without TV ID (will be configured later)
        const setupResult = await adbService.setupTvWithoutLaunch(ipAddress, 5555, statusCallback);
        console.log(`✅ [Setup Only] ADB setup completed:`, setupResult);

        if (setupResult.success) {
            res.status(200).json({
                success: true,
                message: `Setup TV "${name}" berhasil diselesaikan`,
                setupResult: setupResult,
                pingResult: {
                    alive: true,
                    time: pingResult.time,
                    host: ipAddress
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: setupResult.message || 'Setup failed',
                details: setupResult
            });
        }

    } catch (error) {
        console.error(`❌ [Setup Only] Error during TV setup:`, error);
        next(error);
    }
};

exports.addTvWithADB = async (req, res, next) => {
    try {
        const { ipAddress, name } = req.body;

        if (!ipAddress) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        if (!name || name.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'TV name is required'
            });
        }

        console.log(`📺 [Add TV] Adding TV to database: ${name} at ${ipAddress}`);

        // STEP 1: Validate input and check for duplicates
        console.log(`🔍 [Add TV] Checking for duplicate TV...`);

        // Check if TV with same name exists
        const existingTvs = await tvService.getAllTvs();
        const duplicateName = existingTvs.find(tv => tv.name.toLowerCase() === name.trim().toLowerCase());
        if (duplicateName) {
            return res.status(400).json({
                success: false,
                error: 'Nama TV sudah digunakan',
                message: `TV dengan nama "${name}" sudah terdaftar dalam sistem.`
            });
        }

        // Check if TV with same IP exists
        const duplicateIp = existingTvs.find(tv => tv.ip_address === ipAddress);
        if (duplicateIp) {
            return res.status(400).json({
                success: false,
                error: 'IP address sudah terdaftar',
                message: `TV dengan IP address ${ipAddress} sudah terdaftar dengan nama "${duplicateIp.name}".`
            });
        }

        // STEP 2: Create TV entry in database
        console.log(`📺 [Add TV] Creating TV entry in database...`);
        const newTv = await tvService.createTv(name.trim(), 'inactive', ipAddress);
        console.log(`✅ [Add TV] TV created: ${newTv.name} (ID: ${newTv.id})`);

        // STEP 3: Configure TV ID and Launch Helper App
        console.log(`🔧 [Add TV] Configuring TV ID and launching Helper app...`);

        // Get Socket.IO instance for real-time updates
        const io = req.app.get('io');

        // Create status callback for real-time updates
        const statusCallback = (status) => {
            console.log(`📡 [Add TV] [WebSocket] Broadcasting status:`, status);
            io.emit('tv-setup-status', {
                tvId: newTv.id,
                ipAddress: ipAddress,
                name: name,
                setupType: 'add-tv',
                ...status
            });
        };

        // Configure TV ID and launch app
        const finalStepsResult = await adbService.configureTvIdAndLaunch(ipAddress, newTv.id, 5555, statusCallback);
        console.log(`✅ [Add TV] Final steps completed:`, finalStepsResult);

        if (finalStepsResult.success) {
            // Update TV status to active
            await tvService.updateTvStatus(newTv.id, 'active');

            res.status(201).json({
                success: true,
                message: `TV "${name}" berhasil ditambahkan ke sistem`,
                tv: { ...newTv, status: 'active' },
                finalSteps: finalStepsResult
            });
        } else {
            // If final steps failed, we might want to keep the TV in database but mark as inactive
            res.status(400).json({
                success: false,
                error: finalStepsResult.message || 'Gagal mengkonfigurasi TV',
                message: `TV "${name}" telah ditambahkan ke database tetapi gagal dikonfigurasi. ${finalStepsResult.message}`,
                tv: newTv,
                details: finalStepsResult
            });
        }
    } catch (err) {
        console.error(`❌ Error adding TV:`, err);

        // Enhanced error response
        let errorMessage = 'Gagal menambahkan TV';
        let errorDetails = err.message;

        if (err.message.includes('UNIQUE constraint failed')) {
            errorMessage = 'TV dengan IP address ini sudah ada';
            errorDetails = `IP address ${req.body.ipAddress} sudah digunakan oleh TV lain`;
        } else if (err.message.includes('ADB')) {
            errorMessage = 'Gagal setup ADB connection';
            errorDetails = 'Pastikan TV sudah mengaktifkan USB Debugging dan terhubung ke jaringan';
        } else if (err.message.includes('timeout')) {
            errorMessage = 'Timeout connecting to TV';
            errorDetails = 'TV tidak merespons dalam waktu yang ditentukan';
        }

        res.status(500).json({
            success: false,
            error: errorMessage,
            message: errorDetails,
            details: err.message
        });
    }
};

// NEW: Retry TV setup for existing TV entry
exports.retryTvSetup = async (req, res, next) => {
    try {
        const { tvId } = req.params;

        if (!tvId) {
            return res.status(400).json({
                success: false,
                error: 'TV ID is required'
            });
        }

        console.log(`🔄 Retrying TV setup for ID: ${tvId}`);

        // Get TV from database
        const tv = await tvService.getTvById(tvId);
        if (!tv) {
            return res.status(404).json({
                success: false,
                error: 'TV not found'
            });
        }

        console.log(`🔄 Retrying setup for TV: ${tv.name} at ${tv.ip_address}`);

        // Get Socket.IO instance for real-time updates
        const io = req.app.get('io');

        // Create status callback for real-time updates
        const statusCallback = (status) => {
            console.log(`📡 [WebSocket] Broadcasting retry status:`, status);
            io.emit('tv-setup-status', {
                tvId: tv.id,
                ipAddress: tv.ip_address,
                name: tv.name,
                isRetry: true,
                ...status
            });
        };

        // Retry setup
        const setupResult = await adbService.setupTvComplete(tv.ip_address, tv.id, 5555, statusCallback);
        console.log(`✅ Retry setup completed:`, setupResult);

        if (setupResult.success) {
            res.status(200).json({
                success: true,
                message: `Setup TV "${tv.name}" berhasil diselesaikan`,
                tv: tv,
                adbSetup: setupResult
            });
        } else {
            // Retry failed
            let errorType = 'retry_failed';
            let retryable = true;

            if (setupResult.message && setupResult.message.includes('Authorization failed')) {
                errorType = 'authorization_failed';
            } else if (setupResult.message && setupResult.message.includes('timeout')) {
                errorType = 'authorization_timeout';
            } else if (setupResult.message && setupResult.message.includes('Connection failed')) {
                errorType = 'connection_failed';
            }

            res.status(400).json({
                success: false,
                error: setupResult.message,
                errorType: errorType,
                retryable: retryable,
                tv: tv,
                details: setupResult.error || setupResult.message
            });
        }

    } catch (err) {
        console.error('❌ Error during TV setup retry:', err);

        let errorMessage = 'Terjadi kesalahan saat retry setup TV';
        let errorDetails = err.message;

        res.status(500).json({
            success: false,
            error: errorMessage,
            message: errorDetails,
            details: err.message
        });
    }
};

// NEW: Add test TV without ping check (for testing only)
exports.addTestTv = async (req, res, next) => {
    try {
        const { ipAddress, name } = req.body;

        if (!ipAddress || !name) {
            return res.status(400).json({
                success: false,
                error: 'IP address and name are required'
            });
        }

        console.log(`🧪 Adding test TV: ${name} at ${ipAddress}`);

        // Create TV entry directly without ping check
        const newTv = await tvService.createTv(name.trim(), 'inactive', ipAddress);
        console.log(`✅ Test TV created: ${newTv.name} (ID: ${newTv.id})`);

        res.status(201).json({
            success: true,
            message: `Test TV "${name}" berhasil ditambahkan`,
            tv: newTv
        });
    } catch (err) {
        console.error(`❌ Error adding test TV:`, err);
        res.status(500).json({
            success: false,
            error: 'Gagal menambahkan test TV',
            details: err.message
        });
    }
};

// NEW: Ping check endpoint
exports.pingCheck = async (req, res, next) => {
    try {
        const { ipAddress } = req.body;

        if (!ipAddress) {
            return res.status(400).json({
                success: false,
                error: 'IP address is required'
            });
        }

        console.log(`📡 Ping check request for ${ipAddress}`);

        const ping = require('ping');
        const pingResult = await ping.promise.probe(ipAddress, {
            timeout: 5,
            extra: ['-n', '3'] // Windows style: -n instead of -c
        });

        const response = {
            success: true,
            ipAddress: ipAddress,
            alive: pingResult.alive,
            time: pingResult.time,
            message: pingResult.alive
                ? `✅ IP ${ipAddress} dapat dijangkau (${pingResult.time}ms)`
                : `❌ IP ${ipAddress} tidak dapat dijangkau`
        };

        console.log(`📡 Ping result:`, response);
        res.json(response);
    } catch (err) {
        console.error(`❌ Ping check error:`, err);
        res.status(500).json({
            success: false,
            error: 'Ping check failed',
            message: err.message
        });
    }
};

// NEW: Detailed status check endpoint
exports.getDetailedStatus = async (req, res, next) => {
    console.log(`🔍 [Detailed Status] REQUEST RECEIVED - Method: ${req.method}, URL: ${req.url}`);
    console.log(`🔍 [Detailed Status] Headers:`, req.headers);
    console.log(`🔍 [Detailed Status] Params:`, req.params);

    try {
        const { id } = req.params;
        console.log(`🔍 [Detailed Status] Starting check for TV ID: ${id}`);

        // Get TV info
        const tv = await tvService.getTvById(id);
        if (!tv) {
            console.log(`❌ [Detailed Status] TV not found: ${id}`);
            return res.status(404).json({
                success: false,
                error: 'TV not found'
            });
        }

        console.log(`🔍 [Detailed Status] TV found: ${tv.name} at ${tv.ip_address}`);

        const statusChecks = {
            tvInfo: {
                id: tv.id,
                name: tv.name,
                ipAddress: tv.ip_address,
                status: tv.status
            },
            checks: [],
            summary: {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                warningChecks: 0,
                overallStatus: 'unknown',
                conclusion: ''
            }
        };

        // CHECK 1: Network Ping
        console.log(`📡 Checking network connectivity...`);
        try {
            const ping = require('ping');
            const pingResult = await ping.promise.probe(tv.ip_address, {
                timeout: 5,
                extra: ['-n', '3'] // Windows style: -n instead of -c
            });

            statusChecks.checks.push({
                name: 'Network Ping',
                icon: '📡',
                status: pingResult.alive ? 'ok' : 'fail',
                message: pingResult.alive
                    ? `OK (${pingResult.time}ms)`
                    : 'FAIL (Tidak dapat dijangkau)',
                details: {
                    latency: pingResult.time,
                    alive: pingResult.alive,
                    host: tv.ip_address
                }
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'Network Ping',
                icon: '📡',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 2: ADB Connection
        console.log(`🔧 Checking ADB connection...`);
        try {
            const adbStatus = await adbService.checkDeviceStatus(tv.ip_address);
            const isConnected = adbStatus.connected || adbStatus.status === 'connected';

            statusChecks.checks.push({
                name: 'ADB Connection',
                icon: '🔧',
                status: isConnected ? 'ok' : 'fail',
                message: isConnected ? 'OK (Connected)' : 'FAIL (Not connected)',
                details: adbStatus
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'ADB Connection',
                icon: '🔧',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 3: Helper App Process
        console.log(`📱 Checking Helper App process...`);
        try {
            const isRunning = await adbService.checkHelperAppProcess(tv.ip_address);

            statusChecks.checks.push({
                name: 'Helper App Process',
                icon: '📱',
                status: isRunning ? 'ok' : 'fail',
                message: isRunning ? 'OK (Running)' : 'FAIL (Not running)',
                details: { running: isRunning }
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'Helper App Process',
                icon: '📱',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 4: Heartbeat Status
        console.log(`💓 Checking heartbeat status...`);
        const heartbeatCheck = () => {
            if (!tv.last_heartbeat_time) {
                return {
                    status: 'warning',
                    message: 'WARNING (No heartbeat recorded)',
                    details: { lastHeartbeat: null }
                };
            }

            const lastHeartbeat = new Date(tv.last_heartbeat_time);
            const now = new Date();
            const timeDiff = (now.getTime() - lastHeartbeat.getTime()) / 1000; // seconds

            if (timeDiff <= 30) {
                return {
                    status: 'ok',
                    message: `OK (${Math.round(timeDiff)}s ago)`,
                    details: { lastHeartbeat: tv.last_heartbeat_time, secondsAgo: Math.round(timeDiff) }
                };
            } else if (timeDiff <= 300) { // 5 minutes
                return {
                    status: 'warning',
                    message: `WARNING (${Math.round(timeDiff)}s ago)`,
                    details: { lastHeartbeat: tv.last_heartbeat_time, secondsAgo: Math.round(timeDiff) }
                };
            } else {
                return {
                    status: 'fail',
                    message: `FAIL (${Math.round(timeDiff)}s ago)`,
                    details: { lastHeartbeat: tv.last_heartbeat_time, secondsAgo: Math.round(timeDiff) }
                };
            }
        };

        const heartbeatResult = heartbeatCheck();
        statusChecks.checks.push({
            name: 'Heartbeat Status',
            icon: '💓',
            status: heartbeatResult.status,
            message: heartbeatResult.message,
            details: heartbeatResult.details
        });

        // CHECK 5: Database Status
        console.log(`🗄️ Checking database status...`);
        statusChecks.checks.push({
            name: 'Database Status',
            icon: '🗄️',
            status: 'ok',
            message: 'OK (Connected)',
            details: {
                tvId: tv.id,
                lastUpdated: tv.updated_at || 'Unknown'
            }
        });

        // Calculate summary
        statusChecks.summary.totalChecks = statusChecks.checks.length;
        statusChecks.summary.passedChecks = statusChecks.checks.filter(c => c.status === 'ok').length;
        statusChecks.summary.failedChecks = statusChecks.checks.filter(c => c.status === 'fail').length;
        statusChecks.summary.warningChecks = statusChecks.checks.filter(c => c.status === 'warning').length;

        // Determine overall status and conclusion
        if (statusChecks.summary.failedChecks === 0 && statusChecks.summary.warningChecks === 0) {
            statusChecks.summary.overallStatus = 'healthy';
            statusChecks.summary.conclusion = '✅ TV berfungsi normal, semua sistem OK';
        } else if (statusChecks.summary.failedChecks === 0) {
            statusChecks.summary.overallStatus = 'warning';
            statusChecks.summary.conclusion = '⚠️ TV berfungsi dengan beberapa peringatan';
        } else if (statusChecks.summary.passedChecks > statusChecks.summary.failedChecks) {
            statusChecks.summary.overallStatus = 'degraded';
            statusChecks.summary.conclusion = '🔧 TV mengalami masalah, perlu perhatian';
        } else {
            statusChecks.summary.overallStatus = 'critical';
            statusChecks.summary.conclusion = '❌ TV mengalami masalah serius, perlu perbaikan segera';
        }

        console.log(`✅ Status check completed for TV ${id}: ${statusChecks.summary.overallStatus}`);

        res.json({
            success: true,
            data: statusChecks
        });

    } catch (err) {
        console.error(`❌ Error in detailed status check:`, err);
        res.status(500).json({
            success: false,
            error: 'Failed to perform status check',
            message: err.message
        });
    }
};

exports.checkADBStatus = async (req, res, next) => {
    try {
        const { ipAddress } = req.params;

        if (!ipAddress) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        console.log(`🔍 [ADB Status Check] Checking ADB status for ${ipAddress}`);

        // Step 1: Validate IP format
        if (!adbService.isValidIPAddress(ipAddress)) {
            return res.json({
                connected: false,
                authorized: false,
                status: 'invalid_ip',
                deviceId: `${ipAddress}:5555`,
                error: 'Invalid IP address format'
            });
        }

        // Step 2: Test network connectivity first
        const networkTest = await adbService.testNetworkConnectivity(ipAddress);
        console.log(`📡 [ADB Status Check] Network test result:`, networkTest);

        if (!networkTest.reachable) {
            return res.json({
                connected: false,
                authorized: false,
                status: 'network_unreachable',
                deviceId: `${ipAddress}:5555`,
                networkTest: networkTest,
                error: 'Network unreachable - IP address cannot be reached'
            });
        }

        // Step 3: Check ADB device status
        const status = await adbService.checkDeviceStatus(ipAddress);
        console.log(`🔧 [ADB Status Check] ADB status result:`, status);

        // Add network test info to response
        status.networkTest = networkTest;

        res.json(status);
    } catch (err) {
        console.error(`❌ [ADB Status Check] Error checking ADB status for ${ipAddress}:`, err);
        res.json({
            connected: false,
            authorized: false,
            status: 'error',
            deviceId: `${ipAddress}:5555`,
            error: err.message
        });
    }
};

exports.getADBSystemStatus = async (req, res, next) => {
    try {
        // Get comprehensive ADB system status
        const adbStatus = await adbStartupService.getStatus();
        const devices = await adbService.getConnectedDevices();

        res.json({
            success: true,
            adbStatus: {
                processRunning: adbStatus.processRunning,
                executableWorking: adbStatus.executableWorking,
                initialized: adbStatus.initialized,
                ready: adbStatus.ready,
                connectedDevices: devices,
                deviceCount: devices.length
            }
        });
    } catch (err) {
        console.error('Error getting ADB system status:', err);
        res.json({
            success: false,
            error: err.message,
            adbStatus: {
                processRunning: false,
                executableWorking: false,
                initialized: false,
                ready: false,
                connectedDevices: [],
                deviceCount: 0
            }
        });
    }
};

exports.restartADBSystem = async (req, res, next) => {
    try {
        console.log('🔄 ADB system restart requested');

        // Force restart ADB system
        const restartSuccess = await adbStartupService.initializeADB(true);

        if (restartSuccess) {
            console.log('✅ ADB system restarted successfully');

            // Try to auto-connect to existing TVs
            await autoConnectToTVs();

            res.json({
                success: true,
                message: 'ADB system restarted successfully'
            });
        } else {
            console.log('❌ ADB system restart failed');
            res.json({
                success: false,
                message: 'ADB system restart failed'
            });
        }
    } catch (err) {
        console.error('Error restarting ADB system:', err);
        res.json({
            success: false,
            message: `ADB restart error: ${err.message}`
        });
    }
};

// Helper function to auto-connect to existing TVs
async function autoConnectToTVs() {
    try {
        const tvs = await tvService.getAllTvs();
        console.log(`🔗 Attempting to auto-connect to ${tvs.length} TVs...`);

        for (const tv of tvs) {
            if (tv.ip_address) {
                try {
                    console.log(`🔗 Connecting to TV ${tv.id} (${tv.name}) at ${tv.ip_address}...`);
                    const connectResult = await adbService.connectToTV(tv.ip_address);

                    if (connectResult.success) {
                        console.log(`✅ Connected to TV ${tv.id} successfully`);
                    } else {
                        console.log(`⚠️ Failed to connect to TV ${tv.id}: ${connectResult.message}`);
                    }
                } catch (error) {
                    console.log(`❌ Error connecting to TV ${tv.id}: ${error.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error in auto-connect to TVs:', error);
    }
}

// NEW: Check detailed status for new TV (before adding to database)
exports.checkDetailedStatusForNewTV = async (req, res, next) => {
    console.log(`🔍 [New TV Detailed Status] REQUEST RECEIVED - Method: ${req.method}, URL: ${req.url}`);
    console.log(`🔍 [New TV Detailed Status] Headers:`, req.headers);
    console.log(`🔍 [New TV Detailed Status] Body:`, req.body);

    try {
        const { name, ipAddress } = req.body;

        if (!name || !ipAddress) {
            console.log(`❌ [New TV Detailed Status] Missing required fields`);
            return res.status(400).json({
                success: false,
                error: 'Name and IP address are required'
            });
        }

        console.log(`🔍 [New TV Detailed Status] Starting check for new TV: ${name} at ${ipAddress}`);

        const statusChecks = {
            tvInfo: {
                id: 'NEW',
                name: name,
                ipAddress: ipAddress,
                status: 'inactive'
            },
            checks: [],
            summary: {
                totalChecks: 0,
                passedChecks: 0,
                failedChecks: 0,
                warningChecks: 0,
                overallStatus: 'unknown',
                conclusion: ''
            }
        };

        // CHECK 1: Network Ping
        console.log(`📡 Checking network connectivity...`);
        try {
            const ping = require('ping');
            const pingResult = await ping.promise.probe(ipAddress, {
                timeout: 5,
                extra: ['-n', '3'] // Windows style: -n instead of -c
            });

            statusChecks.checks.push({
                name: 'Network Ping',
                icon: '📡',
                status: pingResult.alive ? 'ok' : 'fail',
                message: pingResult.alive
                    ? `OK (${pingResult.time}ms)`
                    : 'FAIL (Tidak dapat dijangkau)',
                details: {
                    latency: pingResult.time,
                    alive: pingResult.alive,
                    host: ipAddress
                }
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'Network Ping',
                icon: '📡',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 2: ADB Connection
        console.log(`🔧 Checking ADB connection...`);
        try {
            const adbStatus = await adbService.checkDeviceStatus(ipAddress);
            const isConnected = adbStatus.connected || adbStatus.status === 'connected';

            statusChecks.checks.push({
                name: 'ADB Connection',
                icon: '🔧',
                status: isConnected ? 'ok' : 'fail',
                message: isConnected ? 'OK (Connected)' : 'FAIL (Not connected)',
                details: adbStatus
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'ADB Connection',
                icon: '🔧',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 3: Helper App Process
        console.log(`📱 Checking Helper App process...`);
        try {
            const isRunning = await adbService.checkHelperAppProcess(ipAddress);

            statusChecks.checks.push({
                name: 'Helper App Process',
                icon: '📱',
                status: isRunning ? 'ok' : 'fail',
                message: isRunning ? 'OK (Running)' : 'FAIL (Not running)',
                details: { running: isRunning }
            });
        } catch (error) {
            statusChecks.checks.push({
                name: 'Helper App Process',
                icon: '📱',
                status: 'fail',
                message: 'FAIL (Error)',
                details: { error: error.message }
            });
        }

        // CHECK 4: Heartbeat Status (for new TV, this will always be warning)
        console.log(`💓 Checking heartbeat status...`);
        statusChecks.checks.push({
            name: 'Heartbeat Status',
            icon: '💓',
            status: 'warning',
            message: 'WARNING (TV belum ditambahkan)',
            details: {
                lastHeartbeat: null,
                reason: 'TV belum ditambahkan ke database'
            }
        });

        // CHECK 5: Database Status (for new TV, this will always be warning)
        console.log(`🗄️ Checking database status...`);
        statusChecks.checks.push({
            name: 'Database Status',
            icon: '🗄️',
            status: 'warning',
            message: 'WARNING (TV belum terdaftar)',
            details: {
                tvId: null,
                reason: 'TV belum ditambahkan ke database'
            }
        });

        // Calculate summary
        statusChecks.summary.totalChecks = statusChecks.checks.length;
        statusChecks.summary.passedChecks = statusChecks.checks.filter(c => c.status === 'ok').length;
        statusChecks.summary.failedChecks = statusChecks.checks.filter(c => c.status === 'fail').length;
        statusChecks.summary.warningChecks = statusChecks.checks.filter(c => c.status === 'warning').length;

        // Determine overall status and conclusion
        if (statusChecks.summary.failedChecks === 0 && statusChecks.summary.warningChecks <= 2) {
            // Allow 2 warnings for new TV (heartbeat and database)
            statusChecks.summary.overallStatus = 'ready';
            statusChecks.summary.conclusion = '✅ TV siap ditambahkan - koneksi dan ADB OK';
        } else if (statusChecks.summary.failedChecks === 0) {
            statusChecks.summary.overallStatus = 'warning';
            statusChecks.summary.conclusion = '⚠️ TV dapat ditambahkan dengan beberapa peringatan';
        } else if (statusChecks.summary.passedChecks > statusChecks.summary.failedChecks) {
            statusChecks.summary.overallStatus = 'degraded';
            statusChecks.summary.conclusion = '🔧 TV mengalami masalah, periksa koneksi';
        } else {
            statusChecks.summary.overallStatus = 'critical';
            statusChecks.summary.conclusion = '❌ TV tidak dapat ditambahkan - periksa IP dan koneksi';
        }

        console.log(`✅ Status check completed for new TV ${name}: ${statusChecks.summary.overallStatus}`);

        res.json(statusChecks);

    } catch (err) {
        console.error(`❌ Error in new TV detailed status check:`, err);
        res.status(500).json({
            success: false,
            error: 'Failed to perform status check',
            message: err.message
        });
    }
};