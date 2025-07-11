const mDNS = require('multicast-dns');
const os = require('os');

let mdns;

function getIPAddress() {
    const interfaces = os.networkInterfaces();
    let fallbackAddress = null;

    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            const { address, family, internal } = iface;
            if (family === 'IPv4' && !internal) {
                // Prefer private LAN IP addresses, which are more likely to be correct.
                if (address.startsWith('192.168.')) {
                    return address;
                }
                // Store the first found address as a fallback.
                if (!fallbackAddress) {
                    fallbackAddress = address;
                }
            }
        }
    }
    // Return the fallback or localhost.
    return fallbackAddress || '127.0.0.1';
}

function startDiscoveryService(port) {
    if (mdns) {
        console.log('Discovery service is already running.');
        return;
    }

    const ipAddress = getIPAddress();
    const serviceName = 'rental-ps-server';
    const serviceType = '_http._tcp.local';

    mdns = mDNS();

    mdns.on('query', (query) => {
        console.log('mDNS query received:', JSON.stringify(query, null, 2));
        const serviceFullName = `${serviceName}.${serviceType}`;
        const targetName = `${serviceName}.local`;

        query.questions.forEach((question) => {
            console.log(`  -> Question: name=${question.name}, type=${question.type}`);
            // PTR query for the service type
            if (question.type === 'PTR' && question.name === serviceType) {
                const response = {
                    answers: [{ name: serviceType, type: 'PTR', ttl: 28800, data: serviceFullName }],
                    additionals: [
                        { name: serviceFullName, type: 'SRV', ttl: 120, data: { port: port, target: targetName } },
                        { name: targetName, type: 'A', ttl: 120, data: ipAddress }
                    ]
                };
                console.log('  <- Responding to PTR query with:', JSON.stringify(response, null, 2));
                mdns.respond(response);
            }
            // SRV query for the service instance name
            else if (question.type === 'SRV' && question.name === serviceFullName) {
                const response = {
                    answers: [{ name: serviceFullName, type: 'SRV', ttl: 120, data: { port: port, target: targetName } }],
                    additionals: [{ name: targetName, type: 'A', ttl: 120, data: ipAddress }]
                };
                console.log('  <- Responding to SRV query with:', JSON.stringify(response, null, 2));
                mdns.respond(response);
            }
            // A query for the target host name
            else if (question.type === 'A' && question.name === targetName) {
                const response = {
                    answers: [{ name: targetName, type: 'A', ttl: 120, data: ipAddress }]
                };
                console.log('  <- Responding to A query with:', JSON.stringify(response, null, 2));
                mdns.respond(response);
            }
        });
    });

    console.log(`Discovery service (mDNS) started. Advertising ${serviceName} at ${ipAddress}:${port}`);
}

function stopDiscoveryService() {
    if (mdns) {
        mdns.destroy(() => {
            mdns = null;
            console.log('Discovery service stopped.');
        });
    }
}

module.exports = { startDiscoveryService, stopDiscoveryService };