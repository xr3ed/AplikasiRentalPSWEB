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
exports.addTvWithADB = async (req, res, next) => {
    try {
        const { ipAddress, name } = req.body;

        if (!ipAddress) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        // Create TV entry first
        const newTv = await tvService.createTv(name || `TV_${ipAddress}`, 'inactive', ipAddress);

        // Setup TV with ADB
        const setupResult = await adbService.setupTvComplete(ipAddress, newTv.id);

        res.status(201).json({
            tv: newTv,
            adbSetup: setupResult
        });
    } catch (err) {
        next(err);
    }
};

exports.checkADBStatus = async (req, res, next) => {
    try {
        const { ipAddress } = req.params;

        if (!ipAddress) {
            return res.status(400).json({ error: 'IP address is required' });
        }

        const status = await adbService.checkDeviceStatus(ipAddress);
        res.json(status);
    } catch (err) {
        next(err);
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