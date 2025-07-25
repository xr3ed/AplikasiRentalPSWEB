'use client';

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import ADBStatusMonitor from '../../../components/ADBStatusMonitor';
import '../../../styles/dashboard.css';

interface TV {
    id: number;
    name: string;
    ip_address: string;
    status: string;
    // Monitoring fields
    monitoring_status?: string;
    last_ping_time?: string;
    last_heartbeat_time?: string;
    process_status?: string;
    auto_recovery_attempts?: number;
    last_recovery_time?: string;
    network_latency_ms?: number;
    socket_connection_id?: string;
    monitoring_enabled?: boolean;
}

interface MonitoringStats {
    total: number;
    active: number;
    disconnected: number;
    offline: number;
    recovering: number;
    error: number;
    unknown: number;
    averageLatency: number;
}

export default function TVManagementPage() {
    const [tvs, setTvs] = useState<TV[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingTv, setEditingTv] = useState<TV | null>(null);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newTvData, setNewTvData] = useState({ name: '', ipAddress: '' });
    const [addingTv, setAddingTv] = useState(false);

    const [isPolling, setIsPolling] = useState(false);
    const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

    // New states for enhanced button effects
    const [isButtonClicked, setIsButtonClicked] = useState(false);
    const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
    const [showDebugModal, setShowDebugModal] = useState(false);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [statusModalData, setStatusModalData] = useState({ type: '', message: '', title: '', context: '' });
    const [isClosingModal, setIsClosingModal] = useState(false);
    const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
    const [showRipple, setShowRipple] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [statusChecked, setStatusChecked] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

    // TV Setup status for real-time updates
    const [setupStatus, setSetupStatus] = useState<{
        type: string;
        message: string;
        instructions?: string[];
        elapsed?: number;
        remaining?: number;
    } | null>(null);

    // Setup completion tracking
    const [setupProgress, setSetupProgress] = useState<{
        isRunning: boolean;
        currentStep: number;
        totalSteps: number;
        steps: {
            name: string;
            status: 'pending' | 'running' | 'success' | 'error';
            message?: string;
            icon: string;
        }[];
        isComplete: boolean;
        hasError: boolean;
    }>({
        isRunning: false,
        currentStep: 0,
        totalSteps: 4,
        steps: [
            { name: 'Network Ping', status: 'pending', icon: '🏓' },
            { name: 'ADB Connection', status: 'pending', icon: '🔌' },
            { name: 'Helper App', status: 'pending', icon: '📱' },
            { name: 'Configuration', status: 'pending', icon: '⚙️' }
        ],
        isComplete: false,
        hasError: false
    });

    // ADB Connection real-time state
    const [adbConnectionState, setAdbConnectionState] = useState({
        isWaiting: false,
        timeRemaining: 60,
        canStop: false,
        isRestarting: false
    });

    // Retry modal state
    const [retryModal, setRetryModal] = useState({
        isVisible: false,
        isProcessing: false,
        message: ''
    });

    // Retry mechanism state
    const [retryableError, setRetryableError] = useState<{
        tvId: number;
        tvName: string;
        ipAddress: string;
        errorType: string;
        errorMessage: string;
        instructions?: string[];
    } | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    // Monitoring states
    const [monitoringStats, setMonitoringStats] = useState<MonitoringStats>({
        total: 0,
        active: 0,
        disconnected: 0,
        offline: 0,
        recovering: 0,
        error: 0,
        unknown: 0,
        averageLatency: 0
    });
    const [socket, setSocket] = useState<Socket | null>(null);

    // Use refs to track current state in async functions
    const isAuthorizedRef = useRef(false);
    const currentIpRef = useRef('');

    // Notification debouncing system
    const [notificationCooldowns, setNotificationCooldowns] = useState<Map<string, number>>(new Map());

    // Detailed Status Modal States
    const [showDetailedStatus, setShowDetailedStatus] = useState(false);
    const [detailedStatusData, setDetailedStatusData] = useState<any>(null);
    const [loadingDetailedStatus, setLoadingDetailedStatus] = useState(false);

    // Setup TV Modal States - NEW: Creative modal for setup progress
    const [showSetupModal, setShowSetupModal] = useState(false);
    const [setupModalClosing, setSetupModalClosing] = useState(false);

    // Per-IP Setup State Management
    const [ipSetupStates, setIpSetupStates] = useState<{
        [ipAddress: string]: {
            isSetupComplete: boolean;
            setupData?: any;
            lastSetupTime?: number;
            canAddToDatabase: boolean;
            lastError?: string;
            canRetry: boolean;
        }
    }>({});



    // Helper function to show toast messages with debouncing
    const showToastMessage = (message: string, tvId?: number) => {
        // Create a unique key for this notification
        const notificationKey = tvId ? `${tvId}-${message}` : message;
        const now = Date.now();

        // Check if this notification is in cooldown (prevent spam within 3 seconds)
        const lastNotificationTime = notificationCooldowns.get(notificationKey);
        if (lastNotificationTime && (now - lastNotificationTime) < 3000) {
            console.log(`🔇 Management notification blocked (cooldown): ${message}`);
            return;
        }

        // Update cooldown
        setNotificationCooldowns(prev => new Map(prev.set(notificationKey, now)));

        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3000);

        // Clean up old cooldowns (older than 10 seconds)
        setTimeout(() => {
            setNotificationCooldowns(prev => {
                const newMap = new Map(prev);
                for (const [key, timestamp] of newMap.entries()) {
                    if (now - timestamp > 10000) {
                        newMap.delete(key);
                    }
                }
                return newMap;
            });
        }, 10000);
    };

    // Get monitoring status badge
    const getMonitoringStatusBadge = (tv: TV) => {
        const status = tv.monitoring_status || 'unknown';

        const statusConfig = {
            active: { color: 'green', icon: '🟢', label: 'ACTIVE' },
            disconnected: { color: 'yellow', icon: '🟡', label: 'DISCONNECTED' },
            offline: { color: 'red', icon: '🔴', label: 'OFFLINE' },
            recovering: { color: 'blue', icon: '🔄', label: 'RECOVERING' },
            error: { color: 'orange', icon: '⚠️', label: 'ERROR' },
            unknown: { color: 'gray', icon: '❓', label: 'UNKNOWN' }
        };

        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.unknown;

        return (
            <div className="flex flex-col items-center space-y-1">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    config.color === 'green' ? 'bg-green-900/50 text-green-300 border border-green-500/50' :
                    config.color === 'yellow' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-500/50' :
                    config.color === 'red' ? 'bg-red-900/50 text-red-300 border border-red-500/50' :
                    config.color === 'blue' ? 'bg-blue-900/50 text-blue-300 border border-blue-500/50' :
                    config.color === 'orange' ? 'bg-orange-900/50 text-orange-300 border border-orange-500/50' :
                    'bg-gray-900/50 text-gray-300 border border-gray-500/50'
                }`}>
                    <span className="mr-1">{config.icon}</span>
                    {config.label}
                </span>
                {tv.network_latency_ms && (
                    <span className="text-xs text-gray-400">
                        {tv.network_latency_ms}ms
                    </span>
                )}
            </div>
        );
    };

    // Trigger manual recovery for a TV
    const triggerRecovery = (tvId: number) => {
        if (socket) {
            socket.emit('trigger-tv-recovery', { tvId });
            showToastMessage(`🔧 Manual recovery triggered for TV ${tvId}`, tvId);
        }
    };

    // Reset recovery attempts for a TV
    const resetRecoveryAttempts = (tvId: number) => {
        if (socket) {
            socket.emit('reset-recovery-attempts', { tvId });
        }
    };

    const fetchTvs = async () => {
        try {
            // REAL IMPLEMENTATION - Load from backend
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:3001/api/tvs', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
                console.log('📺 Loaded TVs from backend:', result.data);
                setTvs(result.data || []);
            } else {
                console.error('❌ Failed to fetch TVs:', res.status);
                setError('Failed to fetch TVs');
            }

            // FALLBACK: Add dummy TVs if no TVs in backend
            /*
            const dummyTvs: TV[] = [
                {
                    id: 1,
                    name: 'TV Ruang Utama',
                    status: 'inactive',
                    ip_address: '192.168.1.100',
                    monitoring_status: 'offline',
                    network_latency_ms: undefined,
                    last_ping_time: undefined,
                    last_heartbeat_time: undefined,
                    process_status: 'unknown'
                },
                {
                    id: 2,
                    name: 'TV VIP Room',
                    status: 'active',
                    ip_address: '192.168.1.101',
                    monitoring_status: 'active',
                    network_latency_ms: 25,
                    last_ping_time: new Date().toISOString(),
                    last_heartbeat_time: new Date().toISOString(),
                    process_status: 'running'
                }
            ];

            setTvs(dummyTvs);
            */
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTvs();

        // Initialize Socket.IO connection for real-time monitoring
        const socketConnection = io('http://localhost:3001');
        setSocket(socketConnection);

        // Listen for TV status updates
        socketConnection.on('tv-status-update', (data) => {
            const { tvId, status, networkStatus, processStatus, heartbeatStatus, latency, timestamp } = data;

            setTvs(prevTvs => prevTvs.map(tv => {
                if (tv.id === tvId) {
                    return {
                        ...tv,
                        monitoring_status: status,
                        network_latency_ms: latency,
                        last_ping_time: networkStatus ? timestamp : tv.last_ping_time,
                        last_heartbeat_time: heartbeatStatus ? timestamp : tv.last_heartbeat_time,
                        process_status: processStatus
                    };
                }
                return tv;
            }));
        });

        // Listen for recovery events (with debouncing)
        socketConnection.on('tv-recovery-event', (data) => {
            const { tvId, eventType } = data;

            if (eventType === 'recovery-started') {
                setTvs(prevTvs => prevTvs.map(tv => {
                    if (tv.id === tvId) {
                        return { ...tv, monitoring_status: 'recovering' };
                    }
                    return tv;
                }));

                showToastMessage(`🔧 Recovery started for TV ${tvId}`, tvId);
            } else if (eventType === 'recovery-success') {
                showToastMessage(`✅ Recovery successful for TV ${tvId}`, tvId);
            } else if (eventType === 'recovery-failed') {
                showToastMessage(`❌ Recovery failed for TV ${tvId}`, tvId);
            }
        });

        // Listen for monitoring stats updates
        socketConnection.on('monitoring-stats', (stats) => {
            setMonitoringStats(stats);
        });

        // Listen for TV setup status updates (real-time)
        socketConnection.on('tv-setup-status', (data) => {
            console.log('📡 [WebSocket] Received setup status:', data);
            setSetupStatus({
                type: data.type,
                message: data.message,
                instructions: data.instructions,
                elapsed: data.elapsed,
                remaining: data.remaining
            });
        });

        // Listen for recovery attempts reset response (with debouncing)
        socketConnection.on('recovery-attempts-reset', (data) => {
            const { tvId, success } = data;
            if (success) {
                setTvs(prevTvs => prevTvs.map(tv => {
                    if (tv.id === tvId) {
                        return { ...tv, auto_recovery_attempts: 0 };
                    }
                    return tv;
                }));
                showToastMessage(`✅ Recovery attempts reset for TV ${tvId}`, tvId);
            } else {
                showToastMessage(`❌ Failed to reset recovery attempts for TV ${tvId}`, tvId);
            }
        });

        // Request initial monitoring stats
        socketConnection.emit('get-monitoring-stats');

        return () => {
            socketConnection.disconnect();
        };
    }, []);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleEscapeKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showSetupModal && !setupProgress.isRunning) {
                    // Only allow closing setup modal if setup is not running
                    closeSetupModal();
                } else if (showDetailedStatus) {
                    setShowDetailedStatus(false);
                } else if (showAddForm) {
                    cancelAddTv();
                }
            }
        };

        if (showAddForm || showDetailedStatus || showSetupModal) {
            document.addEventListener('keydown', handleEscapeKey);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'unset';
        };
    }, [showAddForm, showDetailedStatus, showSetupModal, setupProgress.isRunning]);

    // Reset ADB state when IP address changes
    useEffect(() => {
        if (statusChecked) {
            resetAdbState();
        }
    }, [newTvData.ipAddress]);

    // Cleanup polling on component unmount
    useEffect(() => {
        return () => {
            stopPolling();
        };
    }, []);



    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTv) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/tvs/${editingTv.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name: editingTv.name, ip_address: editingTv.ip_address }),
                });

            if (res.ok) {
                setEditingTv(null);
                fetchTvs(); // Refresh the list
            } else {
                const data = await res.json();
                setError(data.message || 'Failed to update TV');
            }
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError('An unknown error occurred while updating TV');
            }
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this TV?')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`http://localhost:3001/api/tvs/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (res.ok) {
                    fetchTvs(); // Refresh the list
                } else {
                    const data = await res.json();
                    setError(data.message || 'Failed to delete TV');
                }
            } catch (err: unknown) {
                if (err instanceof Error) {
                    setError(err.message);
                } else {
                    setError('An unknown error occurred while deleting TV');
                }
            }
        }
    };

    const startEdit = (tv: TV) => {
        setEditingTv({ ...tv });
    };

    const cancelEdit = () => {
        setEditingTv(null);
    };

    const stopPolling = () => {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            setPollingInterval(null);
        }
        setIsPolling(false);
    };

    const resetAdbState = () => {
        stopPolling();
        setStatusChecked(false);
        setIsAuthorized(false);
        isAuthorizedRef.current = false;
        currentIpRef.current = '';
    };

    // 🎯 RESET SETUP PROGRESS - Clean state management
    const resetSetupProgress = () => {
        setSetupProgress({
            currentStep: 0,
            totalSteps: 4,
            isRunning: false,
            isComplete: false,
            hasError: false,
            steps: [
                { name: 'Network Ping', status: 'pending', icon: '🏓' },
                { name: 'ADB Connection', status: 'pending', icon: '🔌' },
                { name: 'Helper App', status: 'pending', icon: '📱' },
                { name: 'Configuration', status: 'pending', icon: '⚙️' }
            ]
        });

        // Clear any existing status messages and setup status
        setSetupStatus(null); // Clear setup status to prevent ghost messages

        console.log('🧹 Setup progress and status reset to clean state');
    };

    // 🔄 RESTART ADB SYSTEM - Full restart with loading indicator
    const restartAdbSystem = async () => {
        console.log('🔄 Starting ADB system restart...');
        setAdbConnectionState(prev => ({ ...prev, isRestarting: true }));

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
                console.log('✅ ADB system restarted successfully');
                // Wait for ADB to be fully ready
                await new Promise(resolve => setTimeout(resolve, 3000));
                return true;
            } else {
                console.error('❌ Failed to restart ADB system:', data.message);
                return false;
            }
        } catch (error) {
            console.error('❌ Error restarting ADB system:', error);
            return false;
        } finally {
            setAdbConnectionState(prev => ({ ...prev, isRestarting: false }));
        }
    };

    // 🛑 STOP ADB CONNECTION - Stop waiting for authorization
    const stopAdbConnection = () => {
        console.log('🛑 Stopping ADB connection process...');

        // Clear timer
        if ((window as any).adbConnectionTimer) {
            clearInterval((window as any).adbConnectionTimer);
            (window as any).adbConnectionTimer = null;
        }

        setAdbConnectionState({
            isWaiting: false,
            timeRemaining: 60,
            canStop: false,
            isRestarting: false
        });

        // Update setup progress to show stopped state
        setSetupProgress(prev => ({
            ...prev,
            isRunning: false,
            hasError: true,
            steps: prev.steps.map((step, index) => {
                if (index === 1) { // ADB Connection step
                    return { ...step, status: 'error', message: 'ADB request dihentikan oleh user' };
                }
                return step;
            })
        }));
    };

    // ⏱️ START ADB CONNECTION TIMER - Real-time countdown
    const startAdbConnectionTimer = () => {
        let timeLeft = 60;

        const timer = setInterval(() => {
            timeLeft -= 1;

            setAdbConnectionState(prev => ({
                ...prev,
                timeRemaining: timeLeft
            }));

            // Update setup progress with remaining time
            setSetupProgress(prev => ({
                ...prev,
                steps: prev.steps.map((step, index) => {
                    if (index === 1 && step.status === 'running') {
                        return {
                            ...step,
                            message: `ADB request dikirim, tunggu persetujuan di TV... (${timeLeft}s tersisa)`
                        };
                    }
                    return step;
                })
            }));

            // Timeout reached
            if (timeLeft <= 0) {
                clearInterval(timer);

                // Only trigger timeout if still waiting
                setAdbConnectionState(prev => {
                    if (prev.isWaiting) {
                        // Set timeout error
                        setSetupProgress(prevSetup => ({
                            ...prevSetup,
                            isRunning: false,
                            hasError: true,
                            steps: prevSetup.steps.map((step, index) => {
                                if (index === 1) {
                                    return {
                                        ...step,
                                        status: 'error',
                                        message: 'Timeout - TV tidak merespons dalam 60 detik. Periksa koneksi dan coba lagi.'
                                    };
                                }
                                return step;
                            })
                        }));

                        return {
                            isWaiting: false,
                            timeRemaining: 0,
                            canStop: false,
                            isRestarting: false
                        };
                    }
                    return prev;
                });
            }
        }, 1000);

        // Store timer reference for cleanup
        (window as any).adbConnectionTimer = timer;
    };

    // NEW: Fetch compact status for a NEW TV (before adding to database)
    const fetchCompactStatusForNewTV = async () => {
        console.log(`🚀 "Setup TV Otomatis" clicked - Opening CREATIVE SETUP MODAL for: ${newTvData.name} (${newTvData.ipAddress})`);

        // Validate input first
        const validation = validateInput();
        if (!validation.isValid && validation.error) {
            showStatusMessage('error', validation.error.title, validation.error.message);
            return;
        }

        // Close any existing modals first
        setShowStatusModal(false);

        // 🎯 IMMEDIATE STATE RESET - Prevent ghost state
        resetSetupProgress();

        // Additional state cleanup to prevent ghost messages
        setSetupStatus(null);
        setStatusModalData({ type: 'info', title: '', message: '', context: '' });

        // 🎨 TAMPILKAN MODAL SETUP YANG KREATIF!
        console.log(`🎭 Opening creative setup modal...`);
        setShowSetupModal(true);

        // Short loading state delay, then start setup
        setTimeout(async () => {
            await startAutomatedSetup();
        }, 200);
    };

    // NEW: Fetch detailed status for an EXISTING TV (from database)
    const fetchDetailedStatus = async (tvId: number) => {
        console.log(`🔍 Starting detailed status check for TV ${tvId}`);

        // Close any existing modals first
        setShowStatusModal(false);

        setLoadingDetailedStatus(true);
        setShowDetailedStatus(true);
        setDetailedStatusData(null);

        // REAL IMPLEMENTATION - Try backend first
        try {
            const token = localStorage.getItem('token');
            const url = `http://localhost:3001/api/tvs/${tvId}/detailed-status`;
            console.log(`📡 Fetching: ${url}`);

            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            console.log(`📡 Response status: ${response.status}`);
            const data = await response.json();
            console.log(`📡 Response data:`, data);

            if (response.ok && data.success) {
                console.log(`✅ Status check successful`);
                setDetailedStatusData(data.data);
                setLoadingDetailedStatus(false);
                return; // Success, exit early
            } else {
                console.log(`❌ Status check failed:`, data);
                throw new Error(data.error || data.message || 'Backend returned error');
            }
        } catch (error: any) {
            console.error('❌ Error fetching detailed status from backend:', error);
            console.log('🔄 Falling back to mock data...');

            // FALLBACK: Mock data when backend fails
            const tv = tvs.find(t => t.id === tvId);
            const mockData = {
                tvInfo: {
                    id: tvId,
                    name: tv?.name || `TV ${tvId}`,
                    ipAddress: tv?.ip_address || '192.168.1.100',
                    status: tv?.status || 'inactive'
                },
                checks: [
                    {
                        name: 'Network Ping',
                        icon: '📡',
                        status: 'fail',
                        message: 'FAIL (Backend unavailable)',
                        details: {
                            error: 'Cannot connect to backend server',
                            host: tv?.ip_address || '192.168.1.100'
                        }
                    },
                    {
                        name: 'ADB Connection',
                        icon: '🔧',
                        status: 'fail',
                        message: 'FAIL (Cannot check)',
                        details: {
                            error: 'Backend server not responding'
                        }
                    },
                    {
                        name: 'Helper App Process',
                        icon: '📱',
                        status: 'fail',
                        message: 'FAIL (Cannot check)',
                        details: {
                            error: 'Backend server not responding'
                        }
                    },
                    {
                        name: 'Heartbeat Status',
                        icon: '💓',
                        status: 'fail',
                        message: 'FAIL (Cannot check)',
                        details: {
                            error: 'Backend server not responding'
                        }
                    },
                    {
                        name: 'Database Status',
                        icon: '🗄️',
                        status: 'fail',
                        message: 'FAIL (Backend offline)',
                        details: {
                            error: 'Cannot connect to backend server'
                        }
                    }
                ],
                summary: {
                    totalChecks: 5,
                    passedChecks: 0,
                    failedChecks: 5,
                    warningChecks: 0,
                    overallStatus: 'critical',
                    conclusion: '🚨 Backend server tidak tersedia - tidak dapat melakukan pemeriksaan'
                }
            };

            // Simulate loading delay for mock - NO showStatusMessage call
            setTimeout(() => {
                console.log(`✅ Mock status check completed (fallback)`);
                setDetailedStatusData(mockData);
                setLoadingDetailedStatus(false);
                // Keep detailed status modal open, don't show old status modal
            }, 1000);
        }
    };

    const handleAddTv = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate input first
        const validation = validateInput();
        if (!validation.isValid && validation.error) {
            showStatusMessage('error', validation.error.title, validation.error.message);
            return;
        }

        // Check if setup is complete for this specific IP
        const currentIpState = ipSetupStates[newTvData.ipAddress];
        if (!currentIpState?.isSetupComplete || !currentIpState?.canAddToDatabase) {
            showStatusMessage('warning', 'Setup Diperlukan',
                'Silakan lakukan "Setup TV Otomatis" terlebih dahulu untuk IP address ini sebelum menambahkan TV ke sistem.');
            return;
        }

        setAddingTv(true);
        setSetupStatus(null); // Reset setup status

        try {
            const token = localStorage.getItem('token');

            // Setup WebSocket listener for real-time updates
            const socket = io('http://localhost:3001');

            socket.on('tv-setup-status', (data) => {
                console.log('📡 [Add TV] [WebSocket] Received status:', data);

                if (data.ipAddress === newTvData.ipAddress && data.setupType === 'add-tv') {
                    // Update setup status for real-time feedback
                    if (data.type === 'configuring_tv_id') {
                        setSetupStatus({
                            type: 'configuring_tv_id',
                            message: data.message,
                            instructions: []
                        });
                    } else if (data.type === 'launching_app') {
                        setSetupStatus({
                            type: 'launching_app',
                            message: data.message,
                            instructions: []
                        });
                    } else if (data.type === 'completed') {
                        setSetupStatus({
                            type: 'completed',
                            message: data.message,
                            instructions: []
                        });

                        socket.disconnect();

                        // Show success animation and toast
                        setTimeout(() => {
                            setShowSuccessAnimation(true);
                            setToastMessage(`TV "${newTvData.name}" berhasil ditambahkan ke sistem!`);
                            setShowToast(true);

                            // Hide toast after 3 seconds
                            setTimeout(() => {
                                setShowToast(false);
                            }, 3000);

                            // Reset form and close after success animation
                            setTimeout(() => {
                                setNewTvData({ name: '', ipAddress: '' });
                                resetAdbState();
                                setShowAddForm(false);
                                setShowSuccessAnimation(false);
                                fetchTvs(); // Refresh the list
                            }, 2000);
                        }, 500);
                    }
                }
            });

            // Call the modified add-adb endpoint (now database-focused)
            const res = await fetch('http://localhost:3001/api/tvs/add-adb', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: newTvData.name,
                    ipAddress: newTvData.ipAddress
                }),
            });

            const data = await res.json();
            console.log('📺 Add TV response:', data);

            if (res.ok && data.success) {
                console.log('✅ TV successfully added to database');
                // Success handling is done via WebSocket
            } else {
                socket.disconnect();

                // Handle different types of errors
                let errorTitle = 'Gagal Menambahkan TV';
                let errorMessage = data.message || data.error || 'Terjadi kesalahan saat menambahkan TV';

                if (data.error?.includes('sudah digunakan')) {
                    errorTitle = 'Nama TV Sudah Ada';
                    errorMessage = `❌ ${data.error}`;
                } else if (data.error?.includes('sudah terdaftar')) {
                    errorTitle = 'IP Address Sudah Ada';
                    errorMessage = `❌ ${data.error}`;
                } else if (data.error?.includes('Gagal mengkonfigurasi')) {
                    errorTitle = 'Konfigurasi Gagal';
                    errorMessage = `❌ ${data.error}\n\nTV telah ditambahkan ke database tetapi gagal dikonfigurasi.`;
                }

                showStatusMessage('error', errorTitle, errorMessage);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat menambahkan TV';
            console.error('❌ Error adding TV:', errorMessage);
            showStatusMessage('error', 'Network Error', `❌ Gagal menghubungi server\n\nError: ${errorMessage}`);
        } finally {
            setAddingTv(false);
            // Reset setup status after completion (success or error)
            setTimeout(() => {
                setSetupStatus(null);
            }, 3000); // Keep status visible for 3 seconds after completion
        }
    };

    // Retry TV setup function
    const handleRetrySetup = async () => {
        if (!retryableError) return;

        setIsRetrying(true);
        setSetupStatus(null); // Reset setup status

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/tvs/retry-setup/${retryableError.tvId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
            });

            const data = await res.json();
            console.log('Retry setup response:', data);

            if (res.ok && data.success) {
                // Success - clear retry error and show success
                setRetryableError(null);
                setToastMessage(`✅ Setup TV "${retryableError.tvName}" berhasil diselesaikan!`);
                setShowToast(true);

                // Hide toast after 3 seconds
                setTimeout(() => {
                    setShowToast(false);
                }, 3000);

                // Refresh TV list
                fetchTvs();

            } else {
                // Retry failed
                let errorTitle = 'Retry Setup Gagal';
                let errorMessage = data.error || 'Gagal melakukan retry setup TV';

                if (data.errorType === 'authorization_failed') {
                    errorTitle = 'Otorisasi Debugging Ditolak Lagi';
                    errorMessage = `❌ ${data.error}\n\nUser menolak permintaan debugging di TV lagi.`;
                } else if (data.errorType === 'authorization_timeout') {
                    errorTitle = 'Timeout Lagi';
                    errorMessage = `❌ ${data.error}\n\nTidak ada respons dari user dalam 60 detik.`;
                } else if (data.errorType === 'connection_failed') {
                    errorTitle = 'Koneksi Masih Gagal';
                    errorMessage = `❌ ${data.error}\n\nMasih tidak dapat terhubung ke TV via ADB.`;
                }

                errorMessage += '\n\nAnda dapat mencoba lagi atau periksa:\n';
                errorMessage += '• TV dalam keadaan hidup dan terhubung jaringan\n';
                errorMessage += '• Pengaturan Developer Options aktif\n';
                errorMessage += '• Tidak ada firewall yang memblokir koneksi';

                showStatusMessage('error', errorTitle, errorMessage);
            }

        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat retry setup';
            showStatusMessage('error', 'Kesalahan Sistem', errorMessage);
        } finally {
            setIsRetrying(false);
            // Reset setup status after completion
            setTimeout(() => {
                setSetupStatus(null);
            }, 3000);
        }
    };

    // Cancel retry (remove TV from database)
    const handleCancelRetry = () => {
        setRetryableError(null);
        setSetupStatus(null);
        // Optionally refresh TV list to show the TV entry that was created
        fetchTvs();
    };

    const checkADBStatusOnce = async (): Promise<boolean> => {
        const currentIp = currentIpRef.current || newTvData.ipAddress;
        // Check if IP has changed during polling (but allow initial empty ref)
        if (currentIpRef.current && currentIp !== newTvData.ipAddress) {
            return true; // Stop polling if IP changed
        }

        // Update ref if it was empty
        if (!currentIpRef.current) {
            currentIpRef.current = newTvData.ipAddress;
        }

        try {
            const token = localStorage.getItem('token');

            const res = await fetch(`http://localhost:3001/api/tvs/adb-status/${currentIp}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!res.ok) {
                console.error(`ADB status check failed: ${res.status} ${res.statusText}`);
                const errorText = await res.text();
                console.error(`Error response: ${errorText}`);
                throw new Error(`HTTP ${res.status}: ${res.statusText}`);
            }

            const data = await res.json();

            // Process response data (res.ok already checked above)
            if (data.status.authorized) {
                isAuthorizedRef.current = true;
                setIsAuthorized(true);
                showStatusMessage('success', 'TV Siap Ditambahkan', '✅ TV siap ditambahkan! Silakan klik "Tambah TV".');
                return true; // Stop polling
            } else if (data.status.connected) {
                isAuthorizedRef.current = false;
                setIsAuthorized(false);
                showStatusMessage('warning', 'Menunggu Otorisasi', '⏳ TV terhubung tetapi belum diotorisasi. Periksa layar TV untuk dialog debugging!');
                return false; // Continue polling
            } else if (data.status.status === 'connecting') {
                isAuthorizedRef.current = false;
                setIsAuthorized(false);
                showStatusMessage('info', 'Menghubungkan', '🔄 Koneksi berhasil! Dialog debugging akan muncul di TV dalam beberapa detik...');
                return false; // Continue polling
            } else if (data.status.status === 'unauthorized') {
                // IMPORTANT: unauthorized is NOT an error - it means ADB is connected but waiting for user approval
                isAuthorizedRef.current = false;
                setIsAuthorized(false);
                showStatusMessage('warning', 'Menunggu Persetujuan', '⏳ ADB terhubung, menunggu persetujuan debugging di TV...\n\n💡 Periksa layar TV untuk dialog "Allow USB debugging?"');
                return false; // Continue polling - this is NOT an error!
            } else {
                isAuthorizedRef.current = false;
                setIsAuthorized(false);

                let errorMessage = '❌ TV tidak terhubung. ';
                if (data.connectionAttempt) {
                    if (data.connectionAttempt.status === 'network_unreachable') {
                        errorMessage += 'TV tidak dapat dijangkau melalui jaringan.';
                    } else if (data.connectionAttempt.status === 'connection_refused') {
                        errorMessage += 'Koneksi ditolak. Pastikan USB Debugging aktif di TV.';
                    } else {
                        errorMessage += 'Periksa IP address dan pengaturan jaringan.';
                    }
                } else {
                    errorMessage += 'Pastikan IP benar dan ADB debugging aktif.';
                }

                showStatusMessage('error', 'TV Tidak Terhubung', errorMessage);
                return true; // Stop polling on error
            }
        } catch (err: unknown) {
            console.error(`❌ [ADB Polling] Network error:`, err);
            isAuthorizedRef.current = false;
            setIsAuthorized(false);
            let errorMessage = 'Terjadi kesalahan saat memeriksa status';
            if (err instanceof Error) {
                errorMessage = `Error: ${err.message}`;
                console.error(`❌ [ADB Polling] Error details:`, {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                });
            } else {
                console.error(`❌ [ADB Polling] Unknown error type:`, err);
            }

            showStatusMessage('error', 'Kesalahan Jaringan', errorMessage);
            return true; // Stop polling on error
        }
    };

    const startPolling = () => {
        const currentIp = newTvData.ipAddress;
        currentIpRef.current = currentIp;
        setIsPolling(true);
        let pollCount = 0;
        const maxPolls = 30; // 60 seconds with 2-second intervals (increased from 15)

        const interval = setInterval(async () => {
            pollCount++;
            // Don't calculate timeRemaining here - let the main timer handle it
            console.log(`🔄 ADB Polling attempt ${pollCount}/${maxPolls}`);

            const shouldStop = await checkADBStatusOnce();

            if (shouldStop || pollCount >= maxPolls) {
                clearInterval(interval);
                setPollingInterval(null);
                setIsPolling(false);

                if (pollCount >= maxPolls && !isAuthorizedRef.current) {
                    console.log('⏰ ADB Polling timeout reached after 60 seconds');
                    showStatusMessage('warning', 'Timeout - Masih Menunggu',
                        '⏰ TV belum memberikan otorisasi dalam 60 detik.\n\n' +
                        '💡 Tips:\n' +
                        '• Periksa layar TV untuk dialog debugging\n' +
                        '• Pastikan TV tidak dalam mode sleep\n' +
                        '• Coba restart TV jika tidak ada dialog\n\n' +
                        'Anda dapat mencoba lagi atau setup manual.'
                    );
                }
            } else {
                // Update real-time feedback during polling (every 10 seconds)
                if (pollCount % 5 === 0) {
                    showStatusMessage('info', 'Masih Menunggu Otorisasi',
                        `⏳ Menunggu persetujuan debugging di TV...\n\n` +
                        '💡 Periksa layar TV untuk dialog debugging!'
                    );
                }
            }
        }, 2000); // Poll every 2 seconds

        setPollingInterval(interval);
    };

    const checkADBStatus = async () => {
        // Validate input first
        const validation = validateInput();
        if (!validation.isValid && validation.error) {
            showStatusMessage('error', validation.error.title, validation.error.message);
            return;
        }

        // Stop any existing polling
        stopPolling();

        // Set the current IP reference for polling
        currentIpRef.current = newTvData.ipAddress;

        setAddingTv(true);
        showStatusMessage('info', 'Memeriksa Status', '🔍 Memeriksa status ADB...');
        setStatusChecked(true);

        try {
            // Check ADB system status first
            const token = localStorage.getItem('token');
            const adbSystemRes = await fetch(`http://localhost:3001/api/tvs/adb-system/status`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (!adbSystemRes.ok) {
                console.error(`ADB system check failed: ${adbSystemRes.status}`);
                showStatusMessage('error', 'ADB System Error', '❌ ADB system tidak tersedia. Restart server dan coba lagi.');
                return;
            }

            const adbSystemData = await adbSystemRes.json();

            if (!adbSystemData.adbStatus?.ready) {
                console.error('ADB system not ready:', adbSystemData);
                showStatusMessage('error', 'ADB System Belum Siap', '❌ ADB system belum siap. Tunggu beberapa detik dan coba lagi.');
                return;
            }

            // First TV status check
            const shouldStop = await checkADBStatusOnce();

            // Check the current status after the API call
            if (!shouldStop) {
                showStatusMessage('warning', 'Menunggu Otorisasi', '⏳ TV terhubung tetapi belum diotorisasi. Menunggu persetujuan debugging di TV...');
                startPolling();
            }
        } catch (err: unknown) {
            console.error(`❌ [ADB Check] Error during status check:`, err);

            let errorMessage = 'Terjadi kesalahan saat memeriksa status';
            if (err instanceof Error) {
                errorMessage = `Error: ${err.message}`;
                console.error(`❌ [ADB Check] Error details:`, {
                    name: err.name,
                    message: err.message,
                    stack: err.stack
                });
            } else {
                console.error(`❌ [ADB Check] Unknown error type:`, err);
            }

            showStatusMessage('error', 'Kesalahan Pemeriksaan Status', errorMessage);
        } finally {
            setAddingTv(false);
        }
    };

    const cancelAddTv = () => {
        setIsClosingModal(true);
        setTimeout(() => {
            stopPolling();
            setShowAddForm(false);
            setNewTvData({ name: '', ipAddress: '' });
            resetAdbState();
            // Reset setup status to prevent ghost messages
            setSetupStatus(null);
            setIsClosingModal(false);
        }, 300); // Match animation duration
    };

    // Close Setup Modal with animation
    const closeSetupModal = () => {
        if (setupProgress.isRunning) {
            // Don't allow closing while setup is running
            showStatusMessage('warning', 'Setup Sedang Berjalan', 'Tunggu hingga setup selesai sebelum menutup modal');
            return;
        }

        // Clean up ADB connection timer
        if ((window as any).adbConnectionTimer) {
            clearInterval((window as any).adbConnectionTimer);
            (window as any).adbConnectionTimer = null;
        }

        setSetupModalClosing(true);
        setTimeout(() => {
            setShowSetupModal(false);
            setSetupModalClosing(false);

            // Reset setup progress when modal is closed
            setSetupProgress({
                isRunning: false,
                currentStep: 0,
                totalSteps: 4,
                steps: [
                    { name: 'Network Ping', status: 'pending', icon: '🏓' },
                    { name: 'ADB Connection', status: 'pending', icon: '🔌' },
                    { name: 'Helper App', status: 'pending', icon: '📱' },
                    { name: 'Configuration', status: 'pending', icon: '⚙️' }
                ],
                isComplete: false,
                hasError: false
            });

            // Reset ADB connection state
            setAdbConnectionState({
                isWaiting: false,
                timeRemaining: 60,
                canStop: false,
                isRestarting: false
            });
        }, 300);
    };

    // Function to play click sound
    const playClickSound = () => {
        try {
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            // Silently fail if audio context is not supported
            console.log('Audio not supported');
        }
    };

    // Automated TV Setup Sequence - Updated to use setup-only endpoint
    const startAutomatedSetup = async () => {
        console.log('🚀 Starting automated TV setup sequence (setup-only)...');

        // Reset setup progress
        setSetupProgress({
            isRunning: true,
            currentStep: 0,
            totalSteps: 4,
            steps: [
                { name: 'Network Ping', status: 'running', icon: '🏓', message: 'Testing network connectivity...' },
                { name: 'ADB Connection', status: 'pending', icon: '🔌' },
                { name: 'Helper App Install', status: 'pending', icon: '📱' },
                { name: 'Grant Permissions', status: 'pending', icon: '🔐' }
            ],
            isComplete: false,
            hasError: false
        });

        try {
            const token = localStorage.getItem('token');

            // Setup WebSocket listener for real-time updates
            const socket = io('http://localhost:3001');

            socket.on('tv-setup-status', (data) => {
                console.log('📡 [WebSocket] Received setup status:', data);

                if (data.ipAddress === newTvData.ipAddress && data.setupType === 'setup-only') {
                    // Update progress based on real backend status
                    if (data.type === 'connecting') {
                        setSetupProgress(prev => ({
                            ...prev,
                            currentStep: 1,
                            steps: prev.steps.map((step, index) =>
                                index === 0 ? { ...step, status: 'success', message: '✅ Network connectivity OK' } :
                                index === 1 ? { ...step, status: 'running', message: data.message } : step
                            )
                        }));

                        // Start ADB connection real-time monitoring
                        setAdbConnectionState({
                            isWaiting: true,
                            timeRemaining: 60,
                            canStop: true,
                            isRestarting: false
                        });

                        // Start countdown timer
                        startAdbConnectionTimer();
                    } else if (data.type === 'installing_app') {
                        // Clear ADB connection timer - connection successful
                        if ((window as any).adbConnectionTimer) {
                            clearInterval((window as any).adbConnectionTimer);
                            (window as any).adbConnectionTimer = null;
                        }

                        setAdbConnectionState({
                            isWaiting: false,
                            timeRemaining: 60,
                            canStop: false,
                            isRestarting: false
                        });

                        setSetupProgress(prev => ({
                            ...prev,
                            currentStep: 2,
                            steps: prev.steps.map((step, index) =>
                                index === 1 ? { ...step, status: 'success', message: '✅ ADB connection established' } :
                                index === 2 ? { ...step, status: 'running', message: data.message } : step
                            )
                        }));
                    } else if (data.type === 'granting_permission') {
                        setSetupProgress(prev => ({
                            ...prev,
                            currentStep: 3,
                            steps: prev.steps.map((step, index) =>
                                index === 2 ? { ...step, status: 'success', message: '✅ Helper app ready' } :
                                index === 3 ? { ...step, status: 'running', message: data.message } : step
                            )
                        }));
                    } else if (data.type === 'setup_completed') {
                        setSetupProgress(prev => ({
                            ...prev,
                            currentStep: 4,
                            steps: prev.steps.map((step, index) =>
                                index === 3 ? { ...step, status: 'success', message: '✅ Permissions granted' } : step
                            ),
                            isComplete: true,
                            isRunning: false
                        }));

                        // Update per-IP setup state
                        setIpSetupStates(prev => ({
                            ...prev,
                            [newTvData.ipAddress]: {
                                isSetupComplete: true,
                                setupData: data,
                                lastSetupTime: Date.now(),
                                canAddToDatabase: true,
                                canRetry: false
                            }
                        }));

                        socket.disconnect();

                        // Show simple success message and close modal after 1 second
                        setTimeout(() => {
                            setShowSetupModal(false);
                        }, 1000);
                    }
                }
            });

            // Call the new setup-only endpoint
            const setupResponse = await fetch('http://localhost:3001/api/tvs/setup-only', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    name: newTvData.name,
                    ipAddress: newTvData.ipAddress
                }),
            });

            const setupData = await setupResponse.json();
            console.log('🔧 Setup-only response:', setupData);

            if (!setupData.success) {
                socket.disconnect();
                throw new Error(setupData.error || setupData.message || 'Setup failed');
            }

            console.log('✅ TV setup-only completed successfully');

        } catch (error: any) {
            console.error('❌ Setup failed:', error);

            // Update per-IP setup state with error
            setIpSetupStates(prev => ({
                ...prev,
                [newTvData.ipAddress]: {
                    isSetupComplete: false,
                    lastSetupTime: Date.now(),
                    canAddToDatabase: false,
                    lastError: error.message,
                    canRetry: true
                }
            }));

            // Mark current step as error
            setSetupProgress(prev => ({
                ...prev,
                steps: prev.steps.map((step, index) =>
                    index === prev.currentStep
                        ? { ...step, status: 'error', message: `❌ ${error.message}` }
                        : step
                ),
                hasError: true,
                isRunning: false
            }));
        }
    };

    // Enhanced button click handler with visual effects
    const handleAddTvButtonClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        // Play click sound
        playClickSound();

        // Create ripple effect
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        setRipplePosition({ x, y });
        setShowRipple(true);
        setIsButtonClicked(true);

        // Reset ripple after animation
        setTimeout(() => {
            setShowRipple(false);
        }, 600);

        // Reset click state
        setTimeout(() => {
            setIsButtonClicked(false);
        }, 200);

        // Show modal with animation
        setTimeout(() => {
            // Reset all states to prevent ghost messages
            setSetupStatus(null);
            setStatusModalData({ type: 'info', title: '', message: '', context: '' });
            setAddingTv(false);

            setShowAddForm(true);
        }, 150);
    };

    // Handle modal backdrop click
    const handleModalBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            cancelAddTv();
        }
    };

    // Show status modal with context-aware subtitle
    const showStatusMessage = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string, context?: string) => {
        setStatusModalData({
            type,
            title,
            message,
            context: context || (
                title.includes('Setup') ? 'Setup TV Otomatis' :
                title.includes('Tambah') || title.includes('Menambah') ? 'Tambah TV ke Sistem' :
                title.includes('Nama') || title.includes('IP') ? 'Validasi Input' :
                'Status Sistem'
            )
        });
        setShowStatusModal(true);
    };

    // Validate IP address format
    const isValidIPAddress = (ip: string): boolean => {
        const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return ipRegex.test(ip);
    };

    // Check if IP is already used by another TV
    const isIPAddressUsed = (ip: string): boolean => {
        return tvs.some(tv => tv.ip_address === ip);
    };

    // Validate input before checking ADB status
    const validateInput = (): { isValid: boolean; error?: { title: string; message: string } } => {
        // Check if IP address is provided
        if (!newTvData.ipAddress.trim()) {
            return {
                isValid: false,
                error: {
                    title: 'IP Address Diperlukan',
                    message: '❌ Masukkan alamat IP terlebih dahulu sebelum melakukan pengecekan status.'
                }
            };
        }

        // Check if TV name is provided
        if (!newTvData.name.trim()) {
            return {
                isValid: false,
                error: {
                    title: 'Nama TV Diperlukan',
                    message: '❌ Masukkan nama TV terlebih dahulu sebelum melakukan pengecekan status.'
                }
            };
        }

        // Validate TV name length
        if (newTvData.name.trim().length < 3) {
            return {
                isValid: false,
                error: {
                    title: 'Nama TV Terlalu Pendek',
                    message: '❌ Nama TV harus minimal 3 karakter.\n\nContoh nama yang baik:\n• TV Ruang Tamu\n• PlayStation Kamar\n• TV Utama'
                }
            };
        }

        if (newTvData.name.trim().length > 50) {
            return {
                isValid: false,
                error: {
                    title: 'Nama TV Terlalu Panjang',
                    message: '❌ Nama TV maksimal 50 karakter.\n\nSingkat nama TV agar lebih mudah diingat dan dikelola.'
                }
            };
        }

        // Check if TV name is already used
        if (isTvNameUsed(newTvData.name.trim())) {
            return {
                isValid: false,
                error: {
                    title: 'Nama TV Sudah Digunakan',
                    message: `❌ Nama TV "${newTvData.name.trim()}" sudah digunakan.\n\nSilakan gunakan nama yang berbeda untuk membedakan TV ini dari yang sudah ada.`
                }
            };
        }

        // Validate IP address format
        if (!isValidIPAddress(newTvData.ipAddress.trim())) {
            return {
                isValid: false,
                error: {
                    title: 'Format IP Tidak Valid',
                    message: '❌ Format alamat IP tidak valid. Gunakan format yang benar seperti: 192.168.1.100\n\nContoh format yang benar:\n• 192.168.1.100\n• 10.0.0.50\n• 172.16.0.25'
                }
            };
        }

        // Check if IP address is already used
        if (isIPAddressUsed(newTvData.ipAddress.trim())) {
            const existingTv = tvs.find(tv => tv.ip_address === newTvData.ipAddress.trim());
            return {
                isValid: false,
                error: {
                    title: 'IP Address Sudah Digunakan',
                    message: `❌ Alamat IP ${newTvData.ipAddress} sudah digunakan oleh TV "${existingTv?.name}".\n\nSilakan gunakan alamat IP yang berbeda atau hapus TV yang sudah ada terlebih dahulu.`
                }
            };
        }

        // Check for reserved/invalid IP ranges
        const ipParts = newTvData.ipAddress.split('.').map(Number);

        // Check for localhost
        if (ipParts[0] === 127) {
            return {
                isValid: false,
                error: {
                    title: 'IP Address Tidak Valid',
                    message: '❌ Alamat IP localhost (127.x.x.x) tidak dapat digunakan untuk TV.\n\nGunakan alamat IP jaringan lokal seperti:\n• 192.168.x.x\n• 10.x.x.x\n• 172.16-31.x.x'
                }
            };
        }

        // Check for broadcast addresses
        if (ipParts[3] === 0 || ipParts[3] === 255) {
            return {
                isValid: false,
                error: {
                    title: 'IP Address Tidak Valid',
                    message: '❌ Alamat IP yang berakhir dengan .0 atau .255 adalah alamat khusus jaringan.\n\nGunakan alamat IP antara .1 sampai .254, contoh:\n• 192.168.1.100\n• 10.0.0.50'
                }
            };
        }

        return { isValid: true };
    };

    // Get input validation status for real-time feedback
    const getInputValidationStatus = () => {
        if (!newTvData.ipAddress.trim()) return { isValid: true, message: '' };

        if (!isValidIPAddress(newTvData.ipAddress.trim())) {
            return {
                isValid: false,
                message: 'Format IP tidak valid (contoh: 192.168.1.100)'
            };
        }

        if (isIPAddressUsed(newTvData.ipAddress.trim())) {
            const existingTv = tvs.find(tv => tv.ip_address === newTvData.ipAddress.trim());
            return {
                isValid: false,
                message: `IP sudah digunakan oleh TV "${existingTv?.name}"`
            };
        }

        return { isValid: true, message: 'Format IP valid' };
    };

    // Check if TV name is already used
    const isTvNameUsed = (name: string): boolean => {
        return tvs.some(tv => tv.name.toLowerCase() === name.toLowerCase().trim());
    };

    // Get TV name validation status
    const getTvNameValidationStatus = () => {
        if (!newTvData.name.trim()) return { isValid: true, message: '' };

        if (newTvData.name.trim().length < 3) {
            return {
                isValid: false,
                message: 'Nama TV minimal 3 karakter'
            };
        }

        if (newTvData.name.trim().length > 50) {
            return {
                isValid: false,
                message: 'Nama TV maksimal 50 karakter'
            };
        }

        if (isTvNameUsed(newTvData.name.trim())) {
            return {
                isValid: false,
                message: 'Nama TV sudah digunakan'
            };
        }

        return { isValid: true, message: 'Nama TV tersedia' };
    };

    // Check if all inputs are valid for enabling buttons
    const areAllInputsValid = (): boolean => {
        const nameValid = Boolean(newTvData.name.trim()) && getTvNameValidationStatus().isValid;
        const ipValid = Boolean(newTvData.ipAddress.trim()) && getInputValidationStatus().isValid;
        return nameValid && ipValid;
    };


    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="glass-card p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Memuat data TV...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="glass-card p-8 text-center border-red-500/30">
                <div className="text-red-400 text-4xl mb-4">⚠️</div>
                <p className="text-red-400 font-medium">{error}</p>
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="glass-card p-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                    <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                            <span className="text-2xl">📺</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold gradient-text">Manajemen TV</h1>
                            <p className="text-gray-400 text-sm">Kelola TV dan sesi gaming</p>
                        </div>
                    </div>
                    <button
                        onClick={handleAddTvButtonClick}
                        className={`
                            relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6
                            rounded-xl transition-all duration-300 transform hover:scale-105
                            focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                            shadow-purple-500/25 active:scale-95
                            ${isButtonClicked ? 'animate-pulse scale-95' : ''}
                        `}
                        disabled={showAddForm}
                    >
                        {/* Ripple Effect */}
                        {showRipple && (
                            <span
                                className="absolute bg-white/30 rounded-full animate-ping"
                                style={{
                                    left: ripplePosition.x - 10,
                                    top: ripplePosition.y - 10,
                                    width: '20px',
                                    height: '20px',
                                    animation: 'ripple 0.6s linear'
                                }}
                            />
                        )}

                        {/* Button Content */}
                        <span className="relative z-10 flex items-center">
                            <span className={`mr-2 transition-transform duration-200 ${isButtonClicked ? 'scale-110' : ''}`}>
                                📺
                            </span>
                            <span className={`transition-all duration-200 ${isButtonClicked ? 'tracking-wider' : ''}`}>
                                {showAddForm ? 'Form Terbuka' : 'Tambah TV'}
                            </span>
                        </span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                    </button>
                </div>
            </div>

            {/* Monitoring Statistics Dashboard */}
            <div className="glass-card p-6 mb-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-2">TV Monitoring Status</h2>
                        <p className="text-gray-400">Real-time monitoring status untuk semua TV</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">{monitoringStats.total}</div>
                        <div className="text-sm text-gray-400">Total TVs</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">🟢</div>
                        <div className="text-2xl font-bold text-green-300">{monitoringStats.active}</div>
                        <div className="text-xs text-green-400 uppercase tracking-wide">Active</div>
                    </div>

                    <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">🟡</div>
                        <div className="text-2xl font-bold text-yellow-300">{monitoringStats.disconnected}</div>
                        <div className="text-xs text-yellow-400 uppercase tracking-wide">Disconnected</div>
                    </div>

                    <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">🔴</div>
                        <div className="text-2xl font-bold text-red-300">{monitoringStats.offline}</div>
                        <div className="text-xs text-red-400 uppercase tracking-wide">Offline</div>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">🔄</div>
                        <div className="text-2xl font-bold text-blue-300">{monitoringStats.recovering}</div>
                        <div className="text-xs text-blue-400 uppercase tracking-wide">Recovering</div>
                    </div>

                    <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">⚠️</div>
                        <div className="text-2xl font-bold text-orange-300">{monitoringStats.error}</div>
                        <div className="text-xs text-orange-400 uppercase tracking-wide">Error</div>
                    </div>

                    <div className="bg-gray-900/20 border border-gray-500/30 rounded-xl p-4 text-center">
                        <div className="text-2xl mb-2">❓</div>
                        <div className="text-2xl font-bold text-gray-300">{monitoringStats.unknown}</div>
                        <div className="text-xs text-gray-400 uppercase tracking-wide">Unknown</div>
                    </div>
                </div>

                {monitoringStats.averageLatency > 0 && (
                    <div className="mt-4 text-center">
                        <span className="text-sm text-gray-400">
                            Average Network Latency: <span className="text-white font-medium">{monitoringStats.averageLatency}ms</span>
                        </span>
                    </div>
                )}
            </div>

            {/* ADB Status Monitor */}
            <div className="glass-card p-6">
                <ADBStatusMonitor />
            </div>

            {/* Modal Overlay */}
            {showAddForm && (
                <div
                    className={`fixed inset-0 modal-backdrop-enhanced flex items-center justify-center z-[9999] p-4 ${
                        isClosingModal ? 'animate-modal-fade-out' : 'animate-modal-fade-in'
                    }`}
                    onClick={handleModalBackdropClick}
                >
                    <div
                        className={`bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-purple-500/10 relative max-w-6xl w-full max-h-[90vh] flex flex-col z-[10000] ${
                            isClosingModal ? 'animate-modal-scale-out' : 'animate-modal-scale-in'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Success Animation Overlay */}
                        {showSuccessAnimation && (
                            <div className="absolute inset-0 bg-green-900/20 backdrop-blur-sm rounded-xl flex items-center justify-center z-50">
                                <div className="text-center animate-success-bounce">
                                    <div className="w-20 h-20 mx-auto mb-4 bg-green-500 rounded-full flex items-center justify-center animate-pulse-glow">
                                        <svg
                                            className="w-10 h-10 text-white animate-success-checkmark"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M5 13l4 4L19 7"
                                            />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-green-400 mb-2">TV Berhasil Ditambahkan!</h3>
                                    <p className="text-green-300 text-sm">Modal akan ditutup secara otomatis...</p>
                                </div>
                            </div>
                        )}

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={cancelAddTv}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 z-10"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>

                        {/* Fixed Header */}
                        <div className="flex items-center space-x-4 p-8 pb-6 border-b border-gray-700/30 flex-shrink-0">
                            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                                <span className="text-xl">📺</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold gradient-text">Tambah TV dengan ADB</h2>
                                <p className="text-gray-400 text-sm">Konfigurasi TV baru dengan Android Debug Bridge</p>
                            </div>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
                            <form onSubmit={handleAddTv} className="space-y-6" id="addTvForm">

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="newTvName">
                                    Nama TV
                                </label>
                                <div className="relative">
                                    <input
                                        id="newTvName"
                                        type="text"
                                        value={newTvData.name}
                                        onChange={(e) => setNewTvData({...newTvData, name: e.target.value})}
                                        className={`w-full bg-gray-900/50 border rounded-xl py-3 px-4 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:bg-gray-900/70 transition-all duration-300 ${
                                            newTvData.name.trim() ? (
                                                getTvNameValidationStatus().isValid
                                                    ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50'
                                                    : 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                                            ) : 'border-gray-600/30 focus:ring-purple-500/50 focus:border-purple-500/50'
                                        }`}
                                        placeholder="Masukkan nama TV (contoh: PS TV 1)"
                                        required
                                    />
                                    {newTvData.name.trim() && (
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {getTvNameValidationStatus().isValid ? (
                                                <span className="text-green-400 text-lg">✓</span>
                                            ) : (
                                                <span className="text-red-400 text-lg">✗</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {newTvData.name.trim() && !getTvNameValidationStatus().isValid && (
                                    <p className="mt-2 text-sm text-red-400 flex items-center">
                                        <span className="mr-2">⚠️</span>
                                        {getTvNameValidationStatus().message}
                                    </p>
                                )}
                                {newTvData.name.trim() && getTvNameValidationStatus().isValid && (
                                    <p className="mt-2 text-sm text-green-400 flex items-center">
                                        <span className="mr-2">✅</span>
                                        {getTvNameValidationStatus().message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="newTvIp">
                                    Alamat IP TV
                                </label>
                                <div className="relative">
                                    <input
                                        id="newTvIp"
                                        type="text"
                                        value={newTvData.ipAddress}
                                        onChange={(e) => setNewTvData({...newTvData, ipAddress: e.target.value})}
                                        className={`w-full bg-gray-900/50 border rounded-xl py-3 px-4 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:bg-gray-900/70 transition-all duration-300 ${
                                            newTvData.ipAddress.trim() ? (
                                                getInputValidationStatus().isValid
                                                    ? 'border-green-500/50 focus:ring-green-500/50 focus:border-green-500/50'
                                                    : 'border-red-500/50 focus:ring-red-500/50 focus:border-red-500/50'
                                            ) : 'border-gray-600/30 focus:ring-purple-500/50 focus:border-purple-500/50'
                                        }`}
                                        placeholder="192.168.1.100"
                                        required
                                    />
                                    {newTvData.ipAddress.trim() && (
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                            {getInputValidationStatus().isValid ? (
                                                <span className="text-green-400 text-lg">✓</span>
                                            ) : (
                                                <span className="text-red-400 text-lg">✗</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {newTvData.ipAddress.trim() && !getInputValidationStatus().isValid && (
                                    <p className="mt-2 text-sm text-red-400 flex items-center">
                                        <span className="mr-2">⚠️</span>
                                        {getInputValidationStatus().message}
                                    </p>
                                )}
                                {newTvData.ipAddress.trim() && getInputValidationStatus().isValid && (
                                    <p className="mt-2 text-sm text-green-400 flex items-center">
                                        <span className="mr-2">✅</span>
                                        {getInputValidationStatus().message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium">
                                    &nbsp;
                                </label>
                                <button
                                    type="button"
                                    onClick={fetchCompactStatusForNewTV}
                                    disabled={addingTv || isPolling || !areAllInputsValid()}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-700 disabled:to-gray-800 text-white font-medium py-3 px-4 rounded-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg shadow-purple-500/25 disabled:shadow-none"
                                >
                                    {isPolling ? (
                                        <>
                                            <span className="inline-block animate-spin mr-2">🔄</span>
                                            Polling...
                                        </>
                                    ) : addingTv ? (
                                        <>
                                            <span className="mr-2">⏳</span>
                                            Checking...
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2">🚀</span>
                                            Setup TV Otomatis
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>



                        <div className="bg-gray-900/30 border border-gray-700/30 rounded-xl p-6 backdrop-blur-sm">
                            <div className="flex items-center space-x-3 mb-4">
                                <span className="text-2xl">📋</span>
                                <h3 className="text-white font-semibold text-lg">Petunjuk Konfigurasi</h3>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <h4 className="text-purple-300 font-medium text-sm uppercase tracking-wide">Langkah Persiapan</h4>
                                    <ol className="text-gray-300 text-sm space-y-2">
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                                            <span>Pastikan Android TV terhubung ke jaringan WiFi yang sama dengan server</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                                            <span>Aktifkan Developer Options: Settings → Device Preferences → About → Build (tekan 7x)</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-purple-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                                            <span>Aktifkan USB Debugging: Settings → Device Preferences → Developer Options → USB Debugging</span>
                                        </li>
                                    </ol>
                                </div>

                                <div className="space-y-3">
                                    <h4 className="text-blue-300 font-medium text-sm uppercase tracking-wide">Langkah Koneksi</h4>
                                    <ol className="text-gray-300 text-sm space-y-2">
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                                            <span>Masukkan nama TV dan alamat IP yang benar, lalu klik "Setup TV Otomatis"</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                                            <span><strong>Dialog debugging akan muncul di TV</strong> - pilih "Allow" atau "Izinkan"</span>
                                        </li>
                                        <li className="flex items-start space-x-2">
                                            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">6</span>
                                            <span>Sistem akan otomatis mendeteksi saat TV diotorisasi</span>
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
                                <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-3">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-lg">💡</span>
                                        <span className="text-blue-300 font-medium text-sm">Auto-Detection</span>
                                    </div>
                                    <p className="text-blue-200 text-xs">Sistem akan mencoba koneksi ADB dan memantau status selama 30 detik</p>
                                </div>

                                <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-lg p-3">
                                    <div className="flex items-center space-x-2 mb-2">
                                        <span className="text-lg">⚠️</span>
                                        <span className="text-yellow-300 font-medium text-sm">Penting</span>
                                    </div>
                                    <p className="text-yellow-200 text-xs">Dialog debugging harus muncul di layar TV setelah klik "Setup TV Otomatis". Jika tidak muncul, periksa pengaturan Developer Options.</p>
                                </div>
                            </div>

                            {/* Debug Button */}
                            <div className="mt-4 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setShowDebugModal(true)}
                                    className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-600/30 text-gray-400 hover:text-gray-300 font-medium py-2 px-4 rounded-lg transition-all duration-300 text-sm flex items-center space-x-2"
                                >
                                    <span className="text-sm">🔧</span>
                                    <span>Debug Info</span>
                                </button>
                            </div>
                        </div>

                            </form>
                        </div>

                        {/* Real-time Setup Status - Only show during addTv process, not in modal */}
                        {setupStatus && addingTv && (
                            <div className="px-8 py-4 border-t border-gray-700/30 bg-gray-800/50 backdrop-blur-sm">
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        {setupStatus.type === 'connecting' && (
                                            <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                                                <span className="text-xs">🔌</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'waiting_authorization' && (
                                            <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center animate-bounce">
                                                <span className="text-xs">⏳</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'installing_app' && (
                                            <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center animate-spin">
                                                <span className="text-xs">📱</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'granting_permission' && (
                                            <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center animate-pulse">
                                                <span className="text-xs">🔐</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'configuring_tv_id' && (
                                            <div className="w-6 h-6 bg-cyan-600 rounded-full flex items-center justify-center animate-pulse">
                                                <span className="text-xs">🆔</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'launching_app' && (
                                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center animate-bounce">
                                                <span className="text-xs">🚀</span>
                                            </div>
                                        )}
                                        {setupStatus.type === 'completed' && (
                                            <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                                                <span className="text-xs">✅</span>
                                            </div>
                                        )}
                                        {(setupStatus.type === 'error' || setupStatus.type === 'timeout') && (
                                            <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                                                <span className="text-xs">❌</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white">
                                            {setupStatus.message}
                                        </p>

                                        {setupStatus.instructions && setupStatus.instructions.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {setupStatus.instructions.map((instruction, index) => (
                                                    <p key={index} className="text-xs text-gray-300 flex items-start">
                                                        <span className="mr-2 text-gray-500">•</span>
                                                        {instruction}
                                                    </p>
                                                ))}
                                            </div>
                                        )}

                                        {setupStatus.remaining && setupStatus.remaining > 0 && (
                                            <div className="mt-2">
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex-1 bg-gray-700 rounded-full h-2">
                                                        <div
                                                            className="bg-gradient-to-r from-yellow-500 to-orange-500 h-2 rounded-full transition-all duration-1000"
                                                            style={{
                                                                width: `${Math.max(0, Math.min(100, ((60 - setupStatus.remaining) / 60) * 100))}%`
                                                            }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-400 min-w-0">
                                                        {setupStatus.remaining}s
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Fixed Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 p-8 pt-6 border-t border-gray-700/30 flex-shrink-0 bg-gray-800/95 backdrop-blur-xl rounded-b-xl">
                            <button
                                type="button"
                                onClick={cancelAddTv}
                                className="w-full sm:w-auto bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                            >
                                <span className="mr-2">✕</span>
                                Batal
                            </button>
                            <div className="relative w-full sm:w-auto">
                                <button
                                    type="submit"
                                    form="addTvForm"
                                    disabled={addingTv || !areAllInputsValid() || !ipSetupStates[newTvData.ipAddress]?.canAddToDatabase}
                                    className={`
                                        relative overflow-hidden w-full sm:w-auto transition-all duration-300 transform
                                        hover:scale-105 focus:outline-none focus:ring-2 shadow-lg
                                        disabled:transform-none disabled:shadow-none active:scale-95 font-bold py-3 px-8 rounded-xl
                                        ${addingTv ? 'animate-pulse' : ''}
                                        ${!areAllInputsValid() || !ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ?
                                            'bg-gradient-to-r from-gray-600 to-gray-700 text-gray-300 cursor-not-allowed shadow-gray-500/25' :
                                            addingTv ?
                                            'bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white shadow-yellow-500/25 focus:ring-yellow-500/50' :
                                            'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-green-500/25 focus:ring-green-500/50'
                                        }
                                    `}
                                    title={
                                        !areAllInputsValid() ? 'Pastikan nama TV dan alamat IP sudah valid' :
                                        !ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ? 'Lakukan setup TV terlebih dahulu untuk IP address ini' :
                                        addingTv ? 'Menambahkan TV ke sistem...' :
                                        'TV siap ditambahkan ke sistem'
                                    }
                                >
                                    {/* Loading Progress Bar */}
                                    {addingTv && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-purple-700 to-blue-700 opacity-50">
                                            <div className="h-full bg-gradient-to-r from-white/20 to-transparent animate-shimmer" />
                                        </div>
                                    )}

                                    {/* Button Content */}
                                    <span className="relative z-10 flex items-center justify-center">
                                        {addingTv ? (
                                            <>
                                                <span className="inline-block animate-spin mr-2">⏳</span>
                                                <span className="animate-pulse">Menambahkan...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span className="mr-2 transition-transform duration-200 hover:scale-110">
                                                    {!ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ? '🔒' :
                                                     addingTv ? '⏳' :
                                                     '✅'}
                                                </span>
                                                <span>
                                                    {!ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ? 'Setup Required' :
                                                     addingTv ? 'Adding TV...' :
                                                     'Tambah TV'}
                                                </span>
                                            </>
                                        )}
                                    </span>

                                    {/* Shine Effect */}
                                    {!addingTv && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                                    )}
                                </button>
                                {/* Setup Status Indicator */}
                                <div className="absolute -bottom-8 left-0 right-0 text-center">
                                    <span className={`text-xs px-3 py-1 rounded-lg ${
                                        !ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ? 'text-gray-400 bg-gray-800/80' :
                                        addingTv ? 'text-yellow-400 bg-yellow-900/30 border border-yellow-500/50' :
                                        ipSetupStates[newTvData.ipAddress]?.lastError ? 'text-red-400 bg-red-900/30 border border-red-500/50' :
                                        'text-green-400 bg-green-900/30 border border-green-500/50'
                                    }`}>
                                        {!ipSetupStates[newTvData.ipAddress]?.canAddToDatabase ? 'Lakukan setup TV terlebih dahulu untuk IP ini' :
                                         addingTv ? 'Menambahkan TV ke sistem...' :
                                         ipSetupStates[newTvData.ipAddress]?.lastError ? 'Setup gagal, ulangi setup' :
                                         'TV siap ditambahkan!'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Retry Setup Modal */}
            {retryableError && (
                <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[10100] p-4">
                    <div className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-orange-500/10 p-8 max-w-2xl w-full animate-modal-scale-in">
                        {/* Header */}
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="bg-gradient-to-br from-orange-600 to-red-600 p-3 rounded-xl shadow-lg shadow-orange-500/25">
                                <span className="text-xl">🔄</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold gradient-text">Setup TV Gagal</h2>
                                <p className="text-gray-400 text-sm">TV sudah terdaftar, tapi setup belum selesai</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="space-y-6">
                            {/* TV Info */}
                            <div className="bg-gray-900/30 border border-gray-700/30 rounded-xl p-4">
                                <div className="flex items-center space-x-3 mb-3">
                                    <span className="text-lg">📺</span>
                                    <h3 className="text-white font-semibold">Informasi TV</h3>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <div>
                                        <span className="text-gray-400">Nama:</span>
                                        <span className="text-white ml-2 font-medium">{retryableError.tvName}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400">IP Address:</span>
                                        <span className="text-white ml-2 font-mono">{retryableError.ipAddress}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Error Info */}
                            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
                                <div className="flex items-center space-x-3 mb-3">
                                    <span className="text-lg">❌</span>
                                    <h3 className="text-red-300 font-semibold">Error Details</h3>
                                </div>
                                <p className="text-red-200 text-sm mb-3">{retryableError.errorMessage}</p>

                                {retryableError.instructions && retryableError.instructions.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-red-300 text-sm font-medium">Petunjuk:</p>
                                        <ul className="space-y-1">
                                            {retryableError.instructions.map((instruction, index) => (
                                                <li key={index} className="text-red-200 text-sm flex items-start">
                                                    <span className="mr-2 text-red-400">•</span>
                                                    {instruction}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            {/* Real-time Setup Status for Retry */}
                            {setupStatus && isRetrying && (
                                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                                    <div className="flex items-start space-x-3">
                                        <div className="flex-shrink-0">
                                            {setupStatus.type === 'connecting' && (
                                                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center animate-pulse">
                                                    <span className="text-xs">🔌</span>
                                                </div>
                                            )}
                                            {setupStatus.type === 'waiting_authorization' && (
                                                <div className="w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center animate-bounce">
                                                    <span className="text-xs">⏳</span>
                                                </div>
                                            )}
                                            {/* Add other status types as needed */}
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-blue-200">{setupStatus.message}</p>
                                            {setupStatus.remaining && setupStatus.remaining > 0 && (
                                                <div className="mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <div className="flex-1 bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                                                                style={{
                                                                    width: `${Math.max(0, Math.min(100, ((60 - setupStatus.remaining) / 60) * 100))}%`
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="text-xs text-gray-400">{setupStatus.remaining}s</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-8">
                            <button
                                type="button"
                                onClick={handleCancelRetry}
                                disabled={isRetrying}
                                className="w-full sm:w-auto bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 text-gray-300 hover:text-white font-medium py-3 px-6 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500/50 disabled:opacity-50"
                            >
                                <span className="mr-2">✕</span>
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleRetrySetup}
                                disabled={isRetrying}
                                className={`
                                    relative overflow-hidden w-full sm:w-auto bg-gradient-to-r from-orange-600 to-red-600
                                    hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700
                                    text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform
                                    hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-lg
                                    shadow-orange-500/25 disabled:transform-none disabled:shadow-none active:scale-95
                                    ${isRetrying ? 'animate-pulse' : ''}
                                `}
                            >
                                {/* Loading Progress Bar */}
                                {isRetrying && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-orange-700 to-red-700 opacity-50">
                                        <div className="h-full bg-gradient-to-r from-white/20 to-transparent animate-shimmer" />
                                    </div>
                                )}

                                {/* Button Content */}
                                <span className="relative z-10 flex items-center justify-center">
                                    {isRetrying ? (
                                        <>
                                            <span className="inline-block animate-spin mr-2">🔄</span>
                                            <span className="animate-pulse">Mencoba Lagi...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="mr-2 transition-transform duration-200 hover:scale-110">🔄</span>
                                            <span>Retry Setup</span>
                                        </>
                                    )}
                                </span>

                                {/* Shine Effect */}
                                {!isRetrying && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Debug Modal */}
            {showDebugModal && (
                <div
                    className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[10100] p-4"
                    onClick={() => setShowDebugModal(false)}
                >
                    <div
                        className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-purple-500/10 p-6 max-w-2xl w-full animate-modal-scale-in z-[10200]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Debug Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className="bg-gradient-to-r from-gray-600 to-gray-700 p-2 rounded-lg">
                                    <span className="text-lg">🔧</span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Debug Information</h3>
                                    <p className="text-gray-400 text-sm">Status koneksi dan debugging ADB</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowDebugModal(false)}
                                className="text-gray-400 hover:text-white transition-colors duration-200 p-2 hover:bg-gray-700/50 rounded-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Debug Content */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <span className="text-sm">📡</span>
                                        <span className="text-gray-300 font-medium text-sm">Status Polling</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-2 h-2 rounded-full ${isPolling ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`}></div>
                                        <span className={`text-sm font-medium ${isPolling ? 'text-green-400' : 'text-gray-500'}`}>
                                            {isPolling ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <span className="text-sm">✅</span>
                                        <span className="text-gray-300 font-medium text-sm">Status Checked</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-2 h-2 rounded-full ${statusChecked ? 'bg-green-400' : 'bg-gray-500'}`}></div>
                                        <span className={`text-sm font-medium ${statusChecked ? 'text-green-400' : 'text-gray-500'}`}>
                                            {statusChecked ? 'Yes' : 'No'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <span className="text-sm">🔐</span>
                                        <span className="text-gray-300 font-medium text-sm">Authorization</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className={`w-2 h-2 rounded-full ${isAuthorized ? 'bg-green-400' : 'bg-red-400'}`}></div>
                                        <span className={`text-sm font-medium ${isAuthorized ? 'text-green-400' : 'text-red-400'}`}>
                                            {isAuthorized ? 'Authorized' : 'Not Authorized'}
                                        </span>
                                    </div>
                                </div>

                                <div className="bg-gray-900/50 border border-gray-600/30 rounded-lg p-4">
                                    <div className="flex items-center space-x-2 mb-3">
                                        <span className="text-sm">📊</span>
                                        <span className="text-gray-300 font-medium text-sm">Current Status</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                                        <span className="text-sm font-medium text-blue-400">
                                            {statusModalData.type || 'None'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Additional Debug Info */}
                            <div className="bg-gray-900/30 border border-gray-600/20 rounded-lg p-4">
                                <div className="flex items-center space-x-2 mb-3">
                                    <span className="text-sm">📝</span>
                                    <span className="text-gray-300 font-medium text-sm">Connection Details</span>
                                </div>
                                <div className="space-y-2 text-xs text-gray-400">
                                    <div>IP Address: <span className="text-gray-300">{newTvData.ipAddress || 'Not set'}</span></div>
                                    <div>TV Name: <span className="text-gray-300">{newTvData.name || 'Not set'}</span></div>
                                    <div>Last Check: <span className="text-gray-300">{statusChecked ? 'Recently' : 'Never'}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Debug Modal Footer */}
                        <div className="flex justify-end mt-6 pt-4 border-t border-gray-700/30">
                            <button
                                onClick={() => setShowDebugModal(false)}
                                className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 text-gray-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingTv && (
                <div className="glass-card p-8">
                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="bg-gradient-to-br from-orange-600 to-red-600 p-3 rounded-xl shadow-lg shadow-orange-500/25">
                                <span className="text-xl">✏️</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold gradient-text">Edit TV</h2>
                                <p className="text-gray-400 text-sm">Perbarui informasi TV yang sudah ada</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="name">
                                    Nama TV
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={editingTv.name}
                                    onChange={(e) => setEditingTv({...editingTv, name: e.target.value})}
                                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="ip_address">
                                    Alamat IP
                                </label>
                                <input
                                    id="ip_address"
                                    type="text"
                                    value={editingTv.ip_address}
                                    onChange={(e) => setEditingTv({...editingTv, ip_address: e.target.value})}
                                    className="w-full bg-gray-800/50 border border-gray-600/50 rounded-xl py-3 px-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                                    required
                                />
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-600/50">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="w-full sm:w-auto bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 text-gray-300 font-medium py-3 px-6 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-gray-500/50"
                            >
                                <span className="mr-2">✕</span>
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="w-full sm:w-auto bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-500/50 shadow-lg shadow-orange-500/25"
                            >
                                <span className="mr-2">💾</span>
                                Simpan Perubahan
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* TV List */}
            <div className="glass-card p-6">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="bg-gradient-to-br from-green-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-green-500/25">
                        <span className="text-xl">📋</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold gradient-text">Daftar TV</h2>
                        <p className="text-gray-400 text-sm">Total {tvs.length} TV terdaftar</p>
                    </div>
                </div>

                {tvs.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">📺</div>
                        <h3 className="text-xl font-semibold text-gray-300 mb-2">Belum ada TV terdaftar</h3>
                        <p className="text-gray-400 mb-6">Tambahkan TV pertama Anda untuk memulai</p>
                        <button
                            onClick={handleAddTvButtonClick}
                            className={`
                                relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600
                                hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6
                                rounded-xl transition-all duration-300 transform hover:scale-105
                                focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                                shadow-purple-500/25 active:scale-95
                                ${isButtonClicked ? 'animate-pulse scale-95' : ''}
                            `}
                            disabled={showAddForm}
                        >
                            {/* Ripple Effect */}
                            {showRipple && (
                                <span
                                    className="absolute bg-white/30 rounded-full animate-ping"
                                    style={{
                                        left: ripplePosition.x - 10,
                                        top: ripplePosition.y - 10,
                                        width: '20px',
                                        height: '20px',
                                        animation: 'ripple 0.6s linear'
                                    }}
                                />
                            )}

                            {/* Button Content */}
                            <span className="relative z-10 flex items-center">
                                <span className={`mr-2 transition-transform duration-200 ${isButtonClicked ? 'scale-110' : ''}`}>
                                    📺
                                </span>
                                <span className={`transition-all duration-200 ${isButtonClicked ? 'tracking-wider' : ''}`}>
                                    {showAddForm ? 'Form Terbuka' : 'Tambah TV Pertama'}
                                </span>
                            </span>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-gray-600/50">
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">ID</th>
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">Nama</th>
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">Alamat IP</th>
                                    <th className="py-4 px-6 text-center text-gray-300 font-medium text-sm uppercase tracking-wide">Session Status</th>
                                    <th className="py-4 px-6 text-center text-gray-300 font-medium text-sm uppercase tracking-wide">Monitoring Status</th>
                                    <th className="py-4 px-6 text-center text-gray-300 font-medium text-sm uppercase tracking-wide">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {tvs.map(tv => (
                                    <tr key={tv.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                                        <td className="py-4 px-6 text-white font-mono text-sm">{tv.id}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg">
                                                    <span className="text-sm">📺</span>
                                                </div>
                                                <span className="text-white font-medium">{tv.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-gray-300 font-mono text-sm bg-gray-800/50 px-3 py-1 rounded-lg">{tv.ip_address}</span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                                tv.status === 'active'
                                                    ? 'bg-green-900/50 text-green-300 border border-green-500/50'
                                                    : 'bg-red-900/50 text-red-300 border border-red-500/50'
                                            }`}>
                                                <span className={`w-2 h-2 rounded-full mr-2 ${
                                                    tv.status === 'active' ? 'bg-green-400' : 'bg-red-400'
                                                }`}></span>
                                                {tv.status}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            {getMonitoringStatusBadge(tv)}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center space-x-2">
                                                {/* Recovery Actions */}
                                                {(tv.monitoring_status === 'disconnected' || tv.monitoring_status === 'error' || tv.monitoring_status === 'offline') && (
                                                    <button
                                                        onClick={() => triggerRecovery(tv.id)}
                                                        className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                        title="Trigger Recovery"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                        </svg>
                                                    </button>
                                                )}

                                                {tv.auto_recovery_attempts && tv.auto_recovery_attempts > 0 && (
                                                    <button
                                                        onClick={() => resetRecoveryAttempts(tv.id)}
                                                        className="bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 hover:text-purple-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                        title={`Reset Recovery Attempts (${tv.auto_recovery_attempts})`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                                                        </svg>
                                                    </button>
                                                )}

                                                <button
                                                    onClick={() => fetchDetailedStatus(tv.id)}
                                                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                    title="Cek Status Detail"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => startEdit(tv)}
                                                    className="bg-orange-600/20 hover:bg-orange-600/40 text-orange-300 hover:text-orange-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                    title="Edit TV"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(tv.id)}
                                                    className="bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-red-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                                    title="Hapus TV"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Success Toast Notification */}
            {showToast && (
                <div className="fixed top-4 right-4 z-50 animate-toast-slide-in">
                    <div className="bg-green-600/90 backdrop-blur-sm border border-green-500/50 text-white px-6 py-4 rounded-xl shadow-lg shadow-green-500/25 flex items-center space-x-3 max-w-sm hover:shadow-xl transition-shadow duration-300">
                        <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center animate-bounce">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="font-medium text-sm">{toastMessage}</p>
                        </div>
                        <button
                            onClick={() => setShowToast(false)}
                            className="flex-shrink-0 text-green-200 hover:text-white transition-colors duration-200"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Status Modal */}
            {showStatusModal && (
                <div
                    className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[10300] p-4"
                    onClick={() => setShowStatusModal(false)}
                >
                    <div
                        className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-purple-500/10 p-6 max-w-lg w-full animate-modal-scale-in z-[10400]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Status Modal Header */}
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center space-x-3">
                                <div className={`p-2 rounded-lg ${
                                    statusModalData.type === 'success' ? 'bg-gradient-to-r from-green-600 to-green-700' :
                                    statusModalData.type === 'error' ? 'bg-gradient-to-r from-red-600 to-red-700' :
                                    statusModalData.type === 'warning' ? 'bg-gradient-to-r from-yellow-600 to-yellow-700' :
                                    'bg-gradient-to-r from-blue-600 to-blue-700'
                                }`}>
                                    <span className="text-lg">
                                        {statusModalData.type === 'success' ? '✅' :
                                         statusModalData.type === 'error' ? '❌' :
                                         statusModalData.type === 'warning' ? '⚠️' : 'ℹ️'}
                                    </span>
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{statusModalData.title}</h3>
                                    <p className="text-gray-400 text-sm">{statusModalData.context || 'Status Sistem'}</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="text-gray-400 hover:text-white transition-colors duration-200 p-2 hover:bg-gray-700/50 rounded-lg"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Status Content */}
                        <div className={`p-4 rounded-xl backdrop-blur-sm border ${
                            statusModalData.type === 'success' ? 'bg-green-900/30 border-green-500/50' :
                            statusModalData.type === 'error' ? 'bg-red-900/30 border-red-500/50' :
                            statusModalData.type === 'warning' ? 'bg-yellow-900/30 border-yellow-500/50' :
                            'bg-blue-900/30 border-blue-500/50'
                        }`}>
                            <div className="flex items-start space-x-3">
                                <span className={`text-xl flex-shrink-0 mt-0.5 ${
                                    statusModalData.type === 'success' ? 'text-green-300' :
                                    statusModalData.type === 'error' ? 'text-red-300' :
                                    statusModalData.type === 'warning' ? 'text-yellow-300' :
                                    'text-blue-300'
                                }`}>
                                    {statusModalData.type === 'success' ? '✅' :
                                     statusModalData.type === 'error' ? '❌' :
                                     statusModalData.type === 'warning' ? '⚠️' : 'ℹ️'}
                                </span>
                                <div className="flex-1">
                                    <div className={`whitespace-pre-line font-medium ${
                                        statusModalData.type === 'success' ? 'text-green-300' :
                                        statusModalData.type === 'error' ? 'text-red-300' :
                                        statusModalData.type === 'warning' ? 'text-yellow-300' :
                                        'text-blue-300'
                                    }`}>
                                        {statusModalData.message}
                                    </div>

                                    {/* Polling indicator */}
                                    {isPolling && statusModalData.type === 'warning' && (
                                        <div className="mt-3 flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                                            <div className="flex items-center space-x-2">
                                                <span className="inline-block animate-spin text-lg">🔄</span>
                                                <span className="text-sm text-gray-300">Menunggu respons dari TV... (akan berhenti otomatis dalam 30 detik)</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={stopPolling}
                                                className="text-yellow-300 hover:text-yellow-100 underline text-sm font-medium transition-colors duration-200"
                                            >
                                                Hentikan
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Status Modal Footer */}
                        <div className="flex justify-end mt-6 pt-4 border-t border-gray-700/30">
                            <button
                                onClick={() => setShowStatusModal(false)}
                                className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 text-gray-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 🎨 CREATIVE SETUP TV MODAL */}
            {showSetupModal && (
                <div className={`fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[10500] p-4 ${
                    setupModalClosing ? 'animate-fade-out' : 'animate-fade-in'
                }`}>
                    <div className={`relative bg-gradient-to-br from-gray-900/95 via-gray-800/95 to-gray-900/95
                        backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl shadow-purple-500/20
                        max-w-2xl w-full h-[600px] min-h-[600px] max-h-[600px] overflow-hidden flex flex-col ${
                        setupModalClosing ? 'animate-scale-out' : 'animate-scale-in'
                    }`}>

                        {/* Animated Background Pattern */}
                        <div className="absolute inset-0 opacity-10">
                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 animate-gradient-x"></div>
                            <div className="absolute top-0 left-0 w-full h-full">
                                <div className="absolute top-4 left-4 w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                <div className="absolute top-8 right-8 w-1 h-1 bg-purple-400 rounded-full animate-pulse" style={{animationDelay: '0.5s'}}></div>
                                <div className="absolute bottom-8 left-8 w-1.5 h-1.5 bg-blue-300 rounded-full animate-pulse" style={{animationDelay: '1s'}}></div>
                                <div className="absolute bottom-4 right-4 w-2 h-2 bg-purple-300 rounded-full animate-pulse" style={{animationDelay: '1.5s'}}></div>
                            </div>
                        </div>

                        {/* Header Section */}
                        <div className="flex-shrink-0 relative bg-gradient-to-r from-purple-600/30 via-blue-600/30 to-purple-600/30 border-b border-gray-700/50 p-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-4">
                                    {/* Animated TV Icon */}
                                    <div className="relative">
                                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-4 rounded-xl shadow-lg shadow-purple-500/25 transform hover:scale-105 transition-transform duration-300">
                                            <div className="text-2xl animate-bounce">📺</div>
                                        </div>
                                        {/* Pulse Ring */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl animate-ping opacity-20"></div>
                                    </div>

                                    <div>
                                        <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 bg-clip-text text-transparent animate-gradient-x">
                                            Setup TV Otomatis
                                        </h2>
                                        <p className="text-gray-300 text-sm mt-1">
                                            <span className="font-medium text-blue-400">{newTvData.name}</span> •
                                            <span className="font-mono text-purple-400 ml-1">{newTvData.ipAddress}</span>
                                        </p>
                                    </div>
                                </div>

                                {/* Close Button - Only show if setup is not running */}
                                {!setupProgress.isRunning && (
                                    <button
                                        onClick={closeSetupModal}
                                        className="text-gray-400 hover:text-white transition-all duration-200 p-2 hover:bg-gray-700/50 rounded-lg group"
                                    >
                                        <svg className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
                            {/* Overall Progress Bar */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-300">Progress Setup</span>
                                    <span className="text-sm text-gray-400">
                                        {setupProgress.currentStep}/{setupProgress.totalSteps} langkah
                                    </span>
                                </div>

                                {/* Animated Progress Bar */}
                                <div className="relative w-full h-3 bg-gray-700/50 rounded-full overflow-hidden">
                                    <div className="absolute inset-0 bg-gradient-to-r from-gray-700 to-gray-600 rounded-full"></div>
                                    <div
                                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ease-out ${
                                            setupProgress.hasError
                                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                                : setupProgress.isComplete
                                                    ? 'bg-gradient-to-r from-green-500 to-green-600'
                                                    : 'bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 animate-gradient-x'
                                        }`}
                                        style={{
                                            width: `${(setupProgress.currentStep / setupProgress.totalSteps) * 100}%`
                                        }}
                                    >
                                        {/* Shimmer Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"></div>
                                    </div>
                                </div>
                            </div>

                            {/* Setup Steps */}
                            <div className="space-y-4">
                                {setupProgress.steps.map((step, index) => (
                                    <div key={index} className={`relative p-4 rounded-xl border transition-all duration-500 ${
                                        step.status === 'success'
                                            ? 'bg-green-900/20 border-green-500/50 shadow-lg shadow-green-500/10'
                                            : step.status === 'running'
                                                ? 'bg-blue-900/20 border-blue-500/50 shadow-lg shadow-blue-500/20 animate-pulse'
                                                : step.status === 'error'
                                                    ? 'bg-red-900/20 border-red-500/50 shadow-lg shadow-red-500/10'
                                                    : 'bg-gray-800/30 border-gray-600/30'
                                    }`}>

                                        {/* Step Content */}
                                        <div className="flex items-center space-x-4">
                                            {/* Step Icon with Animation */}
                                            <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold transition-all duration-500 ${
                                                step.status === 'success'
                                                    ? 'bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                                                    : step.status === 'running'
                                                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 animate-bounce'
                                                        : step.status === 'error'
                                                            ? 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25'
                                                            : 'bg-gray-700 text-gray-400'
                                            }`}>
                                                {step.status === 'success' ? (
                                                    <span className="animate-scale-in">✓</span>
                                                ) : step.status === 'error' ? (
                                                    <span className="animate-shake">✗</span>
                                                ) : step.status === 'running' ? (
                                                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                ) : (
                                                    <span>{step.icon}</span>
                                                )}

                                                {/* Pulse Ring for Running State */}
                                                {step.status === 'running' && (
                                                    <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>
                                                )}
                                            </div>

                                            {/* Step Info */}
                                            <div className="flex-1">
                                                <div className="flex items-center space-x-2">
                                                    <h4 className={`font-semibold transition-colors duration-300 ${
                                                        step.status === 'success' ? 'text-green-400' :
                                                        step.status === 'running' ? 'text-blue-400' :
                                                        step.status === 'error' ? 'text-red-400' :
                                                        'text-gray-400'
                                                    }`}>
                                                        {step.name}
                                                    </h4>

                                                    {/* Status Badge */}
                                                    <span className={`px-2 py-1 text-xs font-medium rounded-full transition-all duration-300 ${
                                                        step.status === 'success'
                                                            ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                            : step.status === 'running'
                                                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30 animate-pulse'
                                                                : step.status === 'error'
                                                                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                                                    : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                                                    }`}>
                                                        {step.status === 'success' ? 'SELESAI' :
                                                         step.status === 'running' ? 'BERJALAN' :
                                                         step.status === 'error' ? 'GAGAL' : 'MENUNGGU'}
                                                    </span>
                                                </div>

                                                {/* Step Message */}
                                                {step.message && (
                                                    <p className="text-sm text-gray-300 mt-1 animate-fade-in">
                                                        {step.message}
                                                    </p>
                                                )}

                                                {/* ADB Connection Enhanced UI */}
                                                {step.name === 'ADB Connection' && step.status === 'running' && adbConnectionState.isWaiting && (
                                                    <div className="mt-3 space-y-2">
                                                        {/* Progress Bar */}
                                                        <div className="flex items-center space-x-3">
                                                            <div className="flex-1 bg-gray-700 rounded-full h-2">
                                                                <div
                                                                    className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-1000"
                                                                    style={{
                                                                        width: `${((60 - adbConnectionState.timeRemaining) / 60) * 100}%`
                                                                    }}
                                                                />
                                                            </div>
                                                            <span className="text-xs text-gray-400 min-w-0 font-mono">
                                                                {adbConnectionState.timeRemaining}s
                                                            </span>
                                                        </div>

                                                        {/* Instructions and Stop Button */}
                                                        <div className="flex items-center justify-between">
                                                            <div className="text-xs text-gray-400">
                                                                💡 Periksa layar TV untuk dialog debugging
                                                            </div>
                                                            {adbConnectionState.canStop && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        console.log('🛑 Stop button clicked');
                                                                        stopAdbConnection();
                                                                    }}
                                                                    className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-500/30 rounded transition-all duration-200 cursor-pointer z-10 relative"
                                                                    style={{ pointerEvents: 'auto' }}
                                                                >
                                                                    🛑 Hentikan
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right side - Additional controls for specific steps */}
                                            {step.name === 'ADB Connection' && step.status === 'error' && (
                                                <div className="flex-shrink-0">
                                                    <div className="text-xs text-gray-400 text-right">
                                                        <div className="mb-1">💡 Troubleshooting:</div>
                                                        <div className="text-xs text-gray-500 space-y-1">
                                                            <div>• Pastikan TV terhubung ke WiFi</div>
                                                            <div>• Aktifkan Developer Options</div>
                                                            <div>• Aktifkan USB Debugging</div>
                                                            <div>• Periksa firewall/antivirus</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Animated Border for Running State */}
                                        {step.status === 'running' && (
                                            <div className="absolute inset-0 rounded-xl border-2 border-blue-500/50 animate-pulse"></div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Status Messages */}
                            {setupProgress.isComplete && (
                                <div className="p-4 bg-gradient-to-r from-green-900/30 to-green-800/30 border border-green-500/50 rounded-xl animate-fade-in">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center animate-bounce">
                                            <span className="text-white text-sm font-bold">🎉</span>
                                        </div>
                                        <div>
                                            <h4 className="text-green-400 font-semibold">Setup Berhasil!</h4>
                                            <p className="text-green-300 text-sm">TV siap ditambahkan ke sistem</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {setupProgress.hasError && (
                                <div className="p-4 bg-gradient-to-r from-red-900/30 to-red-800/30 border border-red-500/50 rounded-xl animate-fade-in">
                                    <div className="flex items-center space-x-3">
                                        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center animate-shake">
                                            <span className="text-white text-sm font-bold">❌</span>
                                        </div>
                                        <div>
                                            <h4 className="text-red-400 font-semibold">Setup Gagal</h4>
                                            <p className="text-red-300 text-sm">Periksa koneksi dan coba lagi</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex-shrink-0 bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-t border-gray-700/50 p-6">
                            <div className="flex items-center justify-between">
                                {/* Left Side - Status Info */}
                                <div className="flex items-center space-x-3">
                                    {setupProgress.isRunning && (
                                        <div className="flex items-center space-x-2 text-blue-400">
                                            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                                            <span className="text-sm font-medium">Setup sedang berjalan...</span>
                                        </div>
                                    )}

                                    {setupProgress.isComplete && (
                                        <div className="flex items-center space-x-2 text-green-400">
                                            <span className="text-lg animate-bounce">✅</span>
                                            <span className="text-sm font-medium">Setup selesai!</span>
                                        </div>
                                    )}

                                    {setupProgress.hasError && (
                                        <div className="flex items-center space-x-2 text-red-400">
                                            <span className="text-lg animate-shake">❌</span>
                                            <span className="text-sm font-medium">Setup gagal</span>
                                        </div>
                                    )}
                                </div>

                                {/* Right Side - Action Buttons */}
                                <div className="flex items-center space-x-3">
                                    {setupProgress.hasError && !setupProgress.isRunning && (
                                        <button
                                            type="button"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('🔄 Retry button clicked - showing retry modal...');

                                                // Show retry modal
                                                setRetryModal({
                                                    isVisible: true,
                                                    isProcessing: true,
                                                    message: 'Sedang mencoba menghubungkan kembali...'
                                                });

                                                // Wait a bit for visual feedback
                                                await new Promise(resolve => setTimeout(resolve, 1500));

                                                // Restart ADB system first
                                                const restartSuccess = await restartAdbSystem();

                                                if (restartSuccess) {
                                                    setRetryModal(prev => ({
                                                        ...prev,
                                                        message: 'ADB berhasil direstart, memulai setup otomatis...'
                                                    }));

                                                    // Wait a bit more
                                                    await new Promise(resolve => setTimeout(resolve, 1000));

                                                    // Hide retry modal
                                                    setRetryModal({
                                                        isVisible: false,
                                                        isProcessing: false,
                                                        message: ''
                                                    });

                                                    // Reset to normal setup steps
                                                    setSetupProgress({
                                                        isRunning: false,
                                                        currentStep: 0,
                                                        totalSteps: 4,
                                                        steps: [
                                                            { name: 'Network Ping', status: 'pending', icon: '🏓' },
                                                            { name: 'ADB Connection', status: 'pending', icon: '🔌' },
                                                            { name: 'Helper App', status: 'pending', icon: '📱' },
                                                            { name: 'Configuration', status: 'pending', icon: '⚙️' }
                                                        ],
                                                        isComplete: false,
                                                        hasError: false
                                                    });

                                                    // Start setup after ADB is ready
                                                    setTimeout(() => startAutomatedSetup(), 1000);
                                                } else {
                                                    // ADB restart failed
                                                    setRetryModal({
                                                        isVisible: false,
                                                        isProcessing: false,
                                                        message: ''
                                                    });

                                                    setSetupProgress(prev => ({
                                                        ...prev,
                                                        isRunning: false,
                                                        hasError: true,
                                                        steps: prev.steps.map((step, index) => {
                                                            if (index === 0) {
                                                                return { ...step, status: 'error', message: 'ADB system restart failed' };
                                                            }
                                                            return step;
                                                        })
                                                    }));
                                                }
                                            }}
                                            disabled={setupProgress.isRunning || adbConnectionState.isRestarting || retryModal.isVisible}
                                            className={`px-4 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 shadow-lg shadow-orange-500/25 cursor-pointer z-10 relative ${
                                                (setupProgress.isRunning || adbConnectionState.isRestarting || retryModal.isVisible) ? 'opacity-50 cursor-not-allowed transform-none' : ''
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            {retryModal.isVisible ? '⏳ Mencoba Lagi...' : '🔄 Coba Lagi'}
                                        </button>
                                    )}

                                    {!setupProgress.isRunning && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                console.log('❌ Cancel/Close button clicked');
                                                closeSetupModal();
                                            }}
                                            disabled={setupProgress.isRunning}
                                            className={`px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all duration-200 cursor-pointer z-10 relative ${
                                                setupProgress.isRunning ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                            style={{ pointerEvents: 'auto' }}
                                        >
                                            {setupProgress.isComplete ? '✅ Selesai' : '❌ Tutup'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}



            {/* Detailed Status Modal */}
            {showDetailedStatus && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700/50 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        {/* Modal Header */}
                        <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-gray-700/50 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Status Detail TV</h2>
                                    {detailedStatusData && (
                                        <p className="text-gray-400">
                                            {detailedStatusData.tvInfo.name} ({detailedStatusData.tvInfo.ipAddress})
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => setShowDetailedStatus(false)}
                                    className="text-gray-400 hover:text-white transition-colors duration-200 p-2 hover:bg-gray-700/50 rounded-lg"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                            {loadingDetailedStatus ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                                    <span className="ml-4 text-gray-400">Mengecek status...</span>
                                </div>
                            ) : detailedStatusData ? (
                                <div className="space-y-6">
                                    {/* Summary */}
                                    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/30">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-lg font-semibold text-white">Ringkasan Status</h3>
                                            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
                                                detailedStatusData.summary.overallStatus === 'healthy' ? 'bg-green-600/20 text-green-300 border border-green-500/30' :
                                                detailedStatusData.summary.overallStatus === 'warning' ? 'bg-yellow-600/20 text-yellow-300 border border-yellow-500/30' :
                                                detailedStatusData.summary.overallStatus === 'degraded' ? 'bg-orange-600/20 text-orange-300 border border-orange-500/30' :
                                                'bg-red-600/20 text-red-300 border border-red-500/30'
                                            }`}>
                                                {detailedStatusData.summary.overallStatus.toUpperCase()}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-4 mb-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-400">{detailedStatusData.summary.passedChecks}</div>
                                                <div className="text-sm text-gray-400">Passed</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-yellow-400">{detailedStatusData.summary.warningChecks}</div>
                                                <div className="text-sm text-gray-400">Warning</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-red-400">{detailedStatusData.summary.failedChecks}</div>
                                                <div className="text-sm text-gray-400">Failed</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-400">{detailedStatusData.summary.totalChecks}</div>
                                                <div className="text-sm text-gray-400">Total</div>
                                            </div>
                                        </div>

                                        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600/30">
                                            <p className="text-white font-medium">{detailedStatusData.summary.conclusion}</p>
                                        </div>
                                    </div>

                                    {/* Detailed Checks */}
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-white">Detail Pemeriksaan</h3>
                                        {detailedStatusData.checks.map((check: any, index: number) => (
                                            <div key={index} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/30">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center space-x-3">
                                                        <span className="text-2xl">{check.icon}</span>
                                                        <span className="text-white font-medium">{check.name}</span>
                                                    </div>
                                                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                        check.status === 'ok' ? 'bg-green-600/20 text-green-300' :
                                                        check.status === 'warning' ? 'bg-yellow-600/20 text-yellow-300' :
                                                        'bg-red-600/20 text-red-300'
                                                    }`}>
                                                        {check.message}
                                                    </div>
                                                </div>
                                                {check.details && (
                                                    <div className="mt-3 bg-gray-900/50 rounded-lg p-3 border border-gray-600/30">
                                                        <pre className="text-sm text-gray-400 whitespace-pre-wrap">
                                                            {JSON.stringify(check.details, null, 2)}
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <div className="text-red-400 text-lg mb-2">❌ Gagal memuat status</div>
                                    <p className="text-gray-400">Terjadi kesalahan saat mengambil data status</p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-800/50 border-t border-gray-700/50 p-6">
                            <div className="flex justify-between">
                                <button
                                    onClick={() => detailedStatusData && fetchDetailedStatus(detailedStatusData.tvInfo.id)}
                                    disabled={loadingDetailedStatus}
                                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 border border-blue-500/30 font-medium py-2 px-4 rounded-lg transition-all duration-300 disabled:opacity-50"
                                >
                                    🔄 Refresh
                                </button>
                                <button
                                    onClick={() => setShowDetailedStatus(false)}
                                    className="bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/30 text-gray-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-300"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 🚀 SUPER CREATIVE RETRY MODAL */}
            {retryModal.isVisible && (
                <div className="fixed inset-0 bg-gradient-to-br from-gray-900/95 via-slate-800/95 to-gray-900/95 backdrop-blur-xl flex items-center justify-center z-[10600] overflow-hidden">
                    {/* Animated Background Particles */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-to-r from-cyan-400/20 to-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                        <div className="absolute top-3/4 right-1/4 w-24 h-24 bg-gradient-to-r from-purple-400/20 to-pink-500/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }}></div>
                        <div className="absolute bottom-1/4 left-1/3 w-20 h-20 bg-gradient-to-r from-orange-400/20 to-red-500/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s' }}></div>

                        {/* Floating Geometric Shapes */}
                        <div className="absolute top-1/3 right-1/3 w-4 h-4 bg-cyan-400/30 rotate-45 animate-bounce" style={{ animationDelay: '0.5s' }}></div>
                        <div className="absolute bottom-1/3 left-1/2 w-3 h-3 bg-purple-400/30 rounded-full animate-ping" style={{ animationDelay: '1.5s' }}></div>
                        <div className="absolute top-1/2 left-1/4 w-2 h-8 bg-gradient-to-b from-blue-400/30 to-transparent animate-pulse" style={{ animationDelay: '0.8s' }}></div>
                    </div>

                    {/* Main Modal Container */}
                    <div className="relative bg-gradient-to-br from-gray-900/90 via-slate-800/90 to-gray-900/90 backdrop-blur-2xl border border-cyan-500/30 rounded-3xl shadow-2xl shadow-cyan-500/20 p-8 max-w-lg w-full mx-4 transform animate-in fade-in-0 zoom-in-95 duration-500 overflow-hidden">

                        {/* Animated Border Glow */}
                        <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-sm animate-pulse"></div>
                        <div className="absolute inset-[1px] rounded-3xl bg-gradient-to-br from-gray-900/95 via-slate-800/95 to-gray-900/95 backdrop-blur-xl"></div>

                        {/* Content Container */}
                        <div className="relative z-10">
                            {/* Futuristic Header */}
                            <div className="text-center mb-8">
                                {/* Main Icon with Orbital Animation */}
                                <div className="relative w-24 h-24 mx-auto mb-6">
                                    {/* Outer Orbit Ring */}
                                    <div className="absolute inset-0 border-2 border-cyan-400/30 rounded-full animate-spin" style={{ animationDuration: '3s' }}></div>
                                    <div className="absolute inset-2 border border-purple-400/30 rounded-full animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }}></div>

                                    {/* Central Core */}
                                    <div className="absolute inset-4 bg-gradient-to-br from-cyan-500 via-blue-600 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50 animate-pulse">
                                        <span className="text-2xl animate-spin" style={{ animationDuration: '1s' }}>⚡</span>
                                    </div>

                                    {/* Orbiting Particles */}
                                    <div className="absolute top-0 left-1/2 w-2 h-2 bg-cyan-400 rounded-full animate-spin" style={{ animationDuration: '2s', transformOrigin: '0 48px' }}></div>
                                    <div className="absolute bottom-0 right-1/2 w-1.5 h-1.5 bg-purple-400 rounded-full animate-spin" style={{ animationDuration: '2.5s', transformOrigin: '0 -48px' }}></div>
                                </div>

                                {/* Dynamic Title */}
                                <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-3 animate-pulse">
                                    🔄 Mencoba Lagi
                                </h3>
                                <p className="text-gray-300 text-sm font-medium">Mohon tunggu sebentar...</p>
                            </div>

                            {/* Progress Section with Holographic Effect */}
                            <div className="relative mb-8">
                                <div className="bg-gradient-to-r from-slate-800/50 via-gray-800/50 to-slate-800/50 backdrop-blur-sm rounded-2xl p-6 border border-cyan-500/20">
                                    {/* Holographic Scan Line */}
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/10 to-transparent animate-pulse rounded-2xl"></div>

                                    <div className="relative z-10">
                                        {/* Status Indicator */}
                                        <div className="flex items-center space-x-4 mb-4">
                                            <div className="flex space-x-1">
                                                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-ping"></div>
                                                <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping" style={{ animationDelay: '0.2s' }}></div>
                                                <div className="w-2 h-2 bg-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.4s' }}></div>
                                            </div>
                                            <div className="text-cyan-400 text-xs font-mono uppercase tracking-wider">PROCESSING</div>
                                        </div>

                                        {/* Message Display */}
                                        <p className="text-gray-200 text-sm leading-relaxed font-medium">
                                            {retryModal.message}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Advanced Loading Animation */}
                            <div className="text-center">
                                {/* Simple Loading Spinner */}
                                <div className="relative w-16 h-16 mx-auto mb-4">
                                    <div className="w-16 h-16 border-4 border-gray-600 border-t-cyan-400 rounded-full animate-spin"></div>
                                    <div className="absolute inset-2 w-12 h-12 border-2 border-gray-700 border-t-blue-400 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
                                </div>

                                {/* Progress Bars */}
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Menghubungkan</span>
                                        <span>Memproses...</span>
                                    </div>
                                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full animate-pulse" style={{ width: '75%' }}></div>
                                    </div>
                                </div>

                                {/* Tech-style Footer */}
                                <div className="mt-6 text-center">
                                    <div className="inline-flex items-center space-x-2 text-xs text-gray-400 font-mono">
                                        <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                                        <span>SYSTEM.RECOVERY.ACTIVE</span>
                                        <div className="w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}