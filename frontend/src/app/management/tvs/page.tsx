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
    const [statusModalData, setStatusModalData] = useState({ type: '', message: '', title: '' });
    const [isClosingModal, setIsClosingModal] = useState(false);
    const [ripplePosition, setRipplePosition] = useState({ x: 0, y: 0 });
    const [showRipple, setShowRipple] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [statusChecked, setStatusChecked] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(false);

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
            const token = localStorage.getItem('token');
                        const res = await fetch('http://localhost:3001/api/tvs', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
                setTvs(result.data);
            } else {
                setError('Failed to fetch TVs');
            }
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
            if (event.key === 'Escape' && showAddForm) {
                cancelAddTv();
            }
        };

        if (showAddForm) {
            document.addEventListener('keydown', handleEscapeKey);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
            document.body.style.overflow = 'unset';
        };
    }, [showAddForm]);

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

    const handleAddTv = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate input first
        const validation = validateInput();
        if (!validation.isValid && validation.error) {
            showStatusMessage('error', validation.error.title, validation.error.message);
            return;
        }

        setAddingTv(true);

        try {
            const token = localStorage.getItem('token');
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

            if (res.ok) {
                if (data.success) {
                    // Show success animation and toast
                    setShowSuccessAnimation(true);
                    setToastMessage(`TV "${newTvData.name}" berhasil ditambahkan!`);
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
                } else {
                    showStatusMessage('warning', 'Menunggu Konfirmasi', data.message);
                }
            } else {
                let errorMessage = data.message || 'Gagal menambahkan TV';

                // Add troubleshooting tips if available
                if (data.troubleshooting && data.troubleshooting.length > 0) {
                    errorMessage += '\n\nSolusi yang dapat dicoba:\n' +
                        data.troubleshooting.map((tip: string, index: number) => `${index + 1}. ${tip}`).join('\n');
                }

                if (data.instructions && data.instructions.length > 0) {
                    errorMessage += '\n\nLangkah-langkah:\n' +
                        data.instructions.map((instruction: string, index: number) => `${index + 1}. ${instruction}`).join('\n');
                }

                showStatusMessage('error', 'Gagal Menambahkan TV', errorMessage);
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Terjadi kesalahan saat menambahkan TV';
            showStatusMessage('error', 'Kesalahan Sistem', errorMessage);
        } finally {
            setAddingTv(false);
        }
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
        const maxPolls = 15; // 30 seconds with 2-second intervals

        const interval = setInterval(async () => {
            pollCount++;

            const shouldStop = await checkADBStatusOnce();

            if (shouldStop || pollCount >= maxPolls) {
                clearInterval(interval);
                setPollingInterval(null);
                setIsPolling(false);

                if (pollCount >= maxPolls && !isAuthorizedRef.current) {
                    // Only show timeout message once, don't keep showing it
                    console.log('⏰ Polling timeout reached. User can click "Cek Status" to retry.');
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
            setIsClosingModal(false);
        }, 300); // Match animation duration
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
            setShowAddForm(true);
        }, 150);
    };

    // Handle modal backdrop click
    const handleModalBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) {
            cancelAddTv();
        }
    };

    // Show status modal
    const showStatusMessage = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
        setStatusModalData({ type, title, message });
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
                                    onClick={checkADBStatus}
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
                                            <span className="mr-2">🔍</span>
                                            Cek Status
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
                                            <span>Masukkan nama TV dan alamat IP yang benar, lalu klik "Cek Status"</span>
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
                                    <p className="text-yellow-200 text-xs">Dialog debugging harus muncul di layar TV setelah klik "Cek Status". Jika tidak muncul, periksa pengaturan Developer Options.</p>
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
                                    disabled={addingTv || !areAllInputsValid() || !statusChecked || !isAuthorized || isPolling}
                                    className={`
                                        relative overflow-hidden w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600
                                        hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700
                                        text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 transform
                                        hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                                        shadow-purple-500/25 disabled:transform-none disabled:shadow-none active:scale-95
                                        ${addingTv ? 'animate-pulse' : ''}
                                    `}
                                    title={
                                        !areAllInputsValid() ? 'Pastikan nama TV dan alamat IP sudah valid' :
                                        !statusChecked ? 'Klik "Cek Status" terlebih dahulu' :
                                        !isAuthorized ? 'TV belum diotorisasi. Terima permintaan debugging di TV.' :
                                        isPolling ? 'Menunggu otorisasi dari TV...' :
                                        'Klik untuk menambahkan TV'
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
                                                <span className="mr-2 transition-transform duration-200 hover:scale-110">📺</span>
                                                <span>Tambah TV</span>
                                            </>
                                        )}
                                    </span>

                                    {/* Shine Effect */}
                                    {!addingTv && (
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                                    )}
                                </button>
                                {(!statusChecked || !isAuthorized) && (
                                    <div className="absolute -bottom-8 left-0 right-0 text-center">
                                        <span className="text-xs text-gray-400 bg-gray-800/80 px-3 py-1 rounded-lg">
                                            {!statusChecked ? 'Cek status terlebih dahulu' :
                                             !isAuthorized ? 'Menunggu otorisasi TV' : ''}
                                        </span>
                                    </div>
                                )}
                            </div>
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
                                    <p className="text-gray-400 text-sm">Status koneksi ADB</p>
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
        </div>
    );
}