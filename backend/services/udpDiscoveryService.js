const dgram = require('dgram');
const os = require('os');

const DISCOVERY_PORT = 1988; // Port kustom untuk penemuan
const DISCOVERY_MULTICAST_ADDRESS = '239.255.255.251'; // Alamat multicast kustom
const DISCOVERY_MESSAGE = 'RENTAL_PS_DISCOVERY_REQUEST';

function startUdpDiscovery(serverPort) {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    socket.on('error', (err) => {
        console.error(`UDP socket error:\n${err.stack}`);
        socket.close();
    });

    socket.on('message', (msg, rinfo) => {
        console.log(`UDP Discovery: Received message "${msg}" from ${rinfo.address}:${rinfo.port}`);
        if (msg.toString() === DISCOVERY_MESSAGE) {
            console.log('UDP Discovery: Valid discovery request received. Responding...');
            const interfaces = os.networkInterfaces();
            let serverIp = '';
            // Temukan alamat IPv4 non-internal
            for (const name of Object.keys(interfaces)) {
                for (const net of interfaces[name]) {
                    // Filter keluar alamat APIPA (169.254.x.x) dan alamat loopback
                    if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
                        serverIp = net.address;
                        break;
                    }
                }
                if (serverIp) break;
            }

            if (serverIp) {
                const response = JSON.stringify({ serverUrl: `http://${serverIp}:${serverPort}` });
                const responseBuffer = Buffer.from(response);

                socket.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address, (err) => {
                    if (err) {
                        console.error('UDP Discovery: Error sending response:', err);
                    } else {
                        console.log(`UDP Discovery: Sent response to ${rinfo.address}:${rinfo.port}`);
                    }
                });
            } else {
                console.error('UDP Discovery: Could not find a suitable IP address to respond with.');
            }
        }
    });

    socket.on('listening', () => {
        try {
            socket.addMembership(DISCOVERY_MULTICAST_ADDRESS);
            const address = socket.address();
            console.log(`UDP Discovery service listening on ${address.address}:${address.port}`);
        } catch (e) {
            console.error('UDP Discovery: Failed to add multicast membership.', e);
        }
    });

    socket.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        console.log(`UDP Discovery service bound to port ${DISCOVERY_PORT}`);
    });

    return socket;
}

module.exports = { startUdpDiscovery };