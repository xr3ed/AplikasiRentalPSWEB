'use client';

import { useState, useEffect } from 'react';

interface ADBStatus {
    processRunning: boolean;
    executableWorking: boolean;
    initialized: boolean;
    ready: boolean;
}

interface ADBStatusResponse {
    success: boolean;
    adbStatus: ADBStatus;
    message: string;
    timestamp: string;
    recommendations?: string[];
}

export default function ADBStatusMonitor() {
    const [status, setStatus] = useState<ADBStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string>('');
    const [lastChecked, setLastChecked] = useState<string>('');
    const [restarting, setRestarting] = useState(false);

    const checkADBStatus = async () => {
        setLoading(true);
        setError('');
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/tvs/adb-system/status', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            const data: ADBStatusResponse = await response.json();
            
            if (data.success) {
                setStatus(data.adbStatus);
                setLastChecked(new Date().toLocaleTimeString());
            } else {
                setError('Failed to get ADB status');
            }
        } catch (err) {
            setError('Error checking ADB status');
            console.error('ADB status check error:', err);
        } finally {
            setLoading(false);
        }
    };

    const restartADBSystem = async () => {
        setRestarting(true);
        setError('');
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:3001/api/tvs/adb-system/restart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Refresh status after restart
                setTimeout(() => {
                    checkADBStatus();
                }, 2000);
            } else {
                setError('Failed to restart ADB system');
            }
        } catch (err) {
            setError('Error restarting ADB system');
            console.error('ADB restart error:', err);
        } finally {
            setRestarting(false);
        }
    };

    useEffect(() => {
        checkADBStatus();
        
        // Auto-refresh every 30 seconds
        const interval = setInterval(checkADBStatus, 30000);
        
        return () => clearInterval(interval);
    }, []);

    const getStatusColor = (isGood: boolean) => {
        return isGood ? 'text-green-400' : 'text-red-400';
    };

    const getStatusIcon = (isGood: boolean) => {
        return isGood ? '✅' : '❌';
    };

    return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center">
                    📱 ADB System Status
                </h3>
                <div className="flex space-x-2">
                    <button
                        onClick={checkADBStatus}
                        disabled={loading}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm px-3 py-1 rounded transition-colors"
                    >
                        {loading ? '🔄' : '🔍'} Refresh
                    </button>
                    <button
                        onClick={restartADBSystem}
                        disabled={restarting || loading}
                        className="bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-sm px-3 py-1 rounded transition-colors"
                    >
                        {restarting ? '⏳' : '🔄'} Restart
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-400 text-sm">
                    ❌ {error}
                </div>
            )}

            {status && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-gray-400 text-xs mb-1">Executable</div>
                            <div className={`text-sm font-medium ${getStatusColor(status.executableWorking)}`}>
                                {getStatusIcon(status.executableWorking)} {status.executableWorking ? 'Working' : 'Not Working'}
                            </div>
                        </div>
                        
                        <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-gray-400 text-xs mb-1">Process Running</div>
                            <div className={`text-sm font-medium ${getStatusColor(status.processRunning)}`}>
                                {getStatusIcon(status.processRunning)} {status.processRunning ? 'Running' : 'Not Running'}
                            </div>
                        </div>
                        
                        <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-gray-400 text-xs mb-1">Initialized</div>
                            <div className={`text-sm font-medium ${getStatusColor(status.initialized)}`}>
                                {getStatusIcon(status.initialized)} {status.initialized ? 'Yes' : 'No'}
                            </div>
                        </div>
                        
                        <div className="bg-gray-900/50 p-3 rounded">
                            <div className="text-gray-400 text-xs mb-1">Overall Status</div>
                            <div className={`text-sm font-medium ${getStatusColor(status.ready)}`}>
                                {getStatusIcon(status.ready)} {status.ready ? 'Ready' : 'Not Ready'}
                            </div>
                        </div>
                    </div>

                    {!status.ready && (
                        <div className="p-3 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-300 text-sm">
                            ⚠️ <strong>ADB System Issues Detected:</strong>
                            <ul className="mt-2 ml-4 list-disc space-y-1">
                                {!status.executableWorking && <li>ADB executable not working - check installation</li>}
                                {!status.processRunning && <li>ADB server not running - try restart</li>}
                                {!status.initialized && <li>ADB system not initialized - restart may help</li>}
                            </ul>
                        </div>
                    )}

                    {status.ready && (
                        <div className="p-3 bg-green-900/30 border border-green-700/50 rounded text-green-300 text-sm">
                            ✅ <strong>ADB System Ready:</strong> TV integration is available and should work properly.
                        </div>
                    )}

                    {lastChecked && (
                        <div className="text-gray-500 text-xs">
                            Last checked: {lastChecked}
                        </div>
                    )}
                </div>
            )}

            {loading && !status && (
                <div className="text-center py-4">
                    <div className="text-gray-400">🔄 Checking ADB status...</div>
                </div>
            )}
        </div>
    );
}
