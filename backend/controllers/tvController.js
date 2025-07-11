const os = require('os');
const tvService = require('../services/tvService');
const { generateQRCode } = require('../utils/qrCodeUtils');

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
    try {
        const { status, package_id } = req.body;
        const { id } = req.params;

        let result;
        if (status === 'on') {
            if (package_id) {
                result = await tvService.startPackageSession(id, package_id);
            } else {
                result = await tvService.startRegularSession(id);
            }
        } else if (status === 'off') {
            result = await tvService.stopSession(id);
        } else {
            return res.status(400).json({ error: 'Invalid status provided.' });
        }
        res.json(result);
    } catch (err) {
        if (err.message === 'Invalid package.') {
            return res.status(400).json({ error: err.message });
        }
        if (err.message === 'TV not found') {
            return res.status(404).json({ error: err.message });
        }
        next(err);
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

exports.deleteTv = async (req, res, next) => {
    try {
        const result = await tvService.deleteTv(req.params.id);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

exports.ping = (req, res) => {
    console.log(`Received ping from ${req.ip}`);
    res.status(200).json({ message: 'pong' });
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