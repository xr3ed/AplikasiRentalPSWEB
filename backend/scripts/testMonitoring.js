/**
 * Script to test TV monitoring system
 */

const TvMonitoringService = require('../services/tvMonitoringService');
const tvService = require('../services/tvService');

console.log('🧪 Testing TV Monitoring System...');

// Mock Socket.IO for testing
const mockIo = {
    emit: (event, data) => {
        console.log(`📡 Socket.IO Event: ${event}`, JSON.stringify(data, null, 2));
    }
};

async function testMonitoring() {
    try {
        // Initialize monitoring service
        const monitoringService = new TvMonitoringService(mockIo);
        
        console.log('\n1. Testing monitoring service initialization...');
        console.log('✅ Monitoring service created successfully');
        
        console.log('\n2. Testing monitoring statistics...');
        const stats = await monitoringService.getMonitoringStats();
        console.log('📊 Monitoring Stats:', stats);
        
        console.log('\n3. Testing single monitoring cycle...');
        await monitoringService.runMonitoringCycle();
        console.log('✅ Monitoring cycle completed');
        
        console.log('\n4. Testing heartbeat update...');
        // Get first TV for testing
        const tvs = await tvService.getAllTvs();
        if (tvs.data && tvs.data.length > 0) {
            const testTv = tvs.data[0];
            await monitoringService.updateHeartbeat(testTv.id, 'test-socket-id');
            console.log(`✅ Heartbeat updated for TV ${testTv.id}`);
        } else {
            console.log('⚠️ No TVs found for heartbeat test');
        }
        
        console.log('\n5. Testing monitoring stats after updates...');
        const updatedStats = await monitoringService.getMonitoringStats();
        console.log('📊 Updated Stats:', updatedStats);
        
        console.log('\n✅ All monitoring tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Monitoring test failed:', error.message);
        console.error(error.stack);
    }
}

// Run tests
testMonitoring().then(() => {
    console.log('\n🎉 Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
});
