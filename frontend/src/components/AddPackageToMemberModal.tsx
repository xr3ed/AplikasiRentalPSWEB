'use client';

import React, { useState, useEffect, useRef } from 'react';
import ErrorMessage from './ErrorMessage';
import { soundEffects } from '../utils/soundEffects';

interface Package {
    id: number;
    name: string;
    price: number;
    duration_minutes: number;
}

interface Member {
    id: number;
    name: string;
    phone_number: string;
    remaining_time?: number;
    last_login?: string;
    total_packages?: number;
    status?: string;
    created_at?: string;
}

interface AddPackageToMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddPackageToMemberModal({ isOpen, onClose, onSuccess }: AddPackageToMemberModalProps) {
    // Custom scrollbar styles
    React.useEffect(() => {
        const style = document.createElement('style');
        style.textContent = `
            .custom-scrollbar::-webkit-scrollbar {
                width: 6px;
            }
            .custom-scrollbar::-webkit-scrollbar-track {
                background: transparent;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb {
                background: rgba(255, 255, 255, 0.15);
                border-radius: 3px;
                transition: all 0.3s ease;
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                background: rgba(255, 255, 255, 0.25);
            }
            .custom-scrollbar::-webkit-scrollbar-thumb:active {
                background: rgba(255, 255, 255, 0.35);
            }
        `;
        document.head.appendChild(style);

        return () => {
            document.head.removeChild(style);
        };
    }, []);
    const [members, setMembers] = useState<Member[]>([]);
    const [packages, setPackages] = useState<Package[]>([]);
    const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [memberSearch, setMemberSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [membersLoading, setMembersLoading] = useState(false);
    const [packagesLoading, setPackagesLoading] = useState(false);
    const [memberDetailsLoading, setMemberDetailsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [isSummaryClosing, setIsSummaryClosing] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);



    useEffect(() => {
        if (isOpen) {
            fetchMembers();
            fetchPackages();
            // Reset form
            setSelectedMember(null);
            setSelectedPackageId(null);
            setQuantity(1);
            setMemberSearch('');
            setError('');
            setSuccess(false);

            // Play modal open sound
            soundEffects.playModalOpen();

            // Auto-focus search input
            setTimeout(() => {
                searchInputRef.current?.focus();
            }, 100);
        }
    }, [isOpen]);

    // Handle ESC key to close modal
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isOpen && !isClosing) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
            return () => {
                document.removeEventListener('keydown', handleEscKey);
            };
        }
    }, [isOpen, isClosing]);

    // Enhanced close function with animation
    const handleClose = () => {
        setIsClosing(true);
        soundEffects.playModalClose();

        // Add closing animation
        setTimeout(() => {
            onClose();
            setIsClosing(false);
        }, 300);
    };

    // Enhanced summary close function with animation
    const handleSummaryClose = () => {
        setIsSummaryClosing(true);
        soundEffects.playButtonClick();

        // Add closing animation
        setTimeout(() => {
            setSelectedMember(null);
            setSelectedPackageId(null);
            setIsSummaryClosing(false);
        }, 300);
    };

    useEffect(() => {
        // Filter members based on search
        if (memberSearch.trim() === '') {
            setFilteredMembers(members);
        } else {
            const filtered = members.filter(member => 
                member.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
                member.phone_number.includes(memberSearch)
            );
            setFilteredMembers(filtered);
        }
    }, [memberSearch, members]);

    const fetchMembers = async () => {
        try {
            setMembersLoading(true);
            const response = await fetch('http://localhost:3001/api/members');
            if (response.ok) {
                const result = await response.json();
                setMembers(result.data);
            } else {
                setError('Gagal mengambil data member');
            }
        } catch (err) {
            setError('Terjadi kesalahan saat mengambil data member');
        } finally {
            setMembersLoading(false);
        }
    };

    const fetchPackages = async () => {
        try {
            setPackagesLoading(true);
            const response = await fetch('http://localhost:3001/api/packages');
            if (response.ok) {
                const result = await response.json();
                setPackages(result.data);
            } else {
                setError('Gagal mengambil data paket');
            }
        } catch (err) {
            setError('Terjadi kesalahan saat mengambil data paket');
        } finally {
            setPackagesLoading(false);
        }
    };

    const fetchMemberDetails = async (member: Member) => {
        setMemberDetailsLoading(true);
        try {
            // Fetch member packages to calculate remaining time
            const packagesResponse = await fetch(`http://localhost:3001/api/members/${member.id}/packages`);
            if (packagesResponse.ok) {
                const packagesData = await packagesResponse.json();
                const memberPackages = packagesData.data || [];

                // Calculate total remaining time
                const totalRemainingTime = memberPackages.reduce((total: number, pkg: any) => {
                    return total + (pkg.remaining_minutes || 0);
                }, 0);

                // Update member with additional details
                const updatedMember: Member = {
                    ...member,
                    remaining_time: totalRemainingTime,
                    total_packages: memberPackages.length,
                    status: totalRemainingTime > 0 ? 'aktif' : 'tidak aktif',
                    // For now, we'll use created_at as last_login since we don't have that field
                    last_login: member.created_at
                };

                setSelectedMember(updatedMember);
            } else {
                // If we can't fetch packages, just set the member with basic info
                setSelectedMember({
                    ...member,
                    remaining_time: 0,
                    total_packages: 0,
                    status: 'tidak aktif'
                });
            }
        } catch (error) {
            console.error('Error fetching member details:', error);
            // Set member with basic info on error
            setSelectedMember({
                ...member,
                remaining_time: 0,
                total_packages: 0,
                status: 'tidak aktif'
            });
        } finally {
            setMemberDetailsLoading(false);
        }
    };

    const selectedPackage = packages.find(p => p.id === selectedPackageId);
    const totalAmount = selectedPackage ? selectedPackage.price * quantity : 0;
    const totalMinutes = selectedPackage ? selectedPackage.duration_minutes * quantity : 0;

    const handleSubmit = async () => {
        if (!selectedMember || !selectedPackageId) {
            setError('Pilih member dan paket terlebih dahulu');
            return;
        }

        try {
            setLoading(true);
            setError('');

            const response = await fetch(`http://localhost:3001/api/members/${selectedMember.id}/packages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    package_id: selectedPackageId,
                    quantity: quantity,
                    total_amount: totalAmount
                }),
            });

            if (response.ok) {
                // Show success message briefly before closing
                setError('');
                setSuccess(true);
                soundEffects.playTransactionSuccess();
                onSuccess();
                // Small delay to show success state
                setTimeout(() => {
                    soundEffects.playModalClose();
                    onClose();
                }, 1000);
            } else {
                const errorData = await response.json();
                setError(errorData.error || 'Gagal menambahkan paket');
                soundEffects.playError();
            }
        } catch (err) {
            setError('Terjadi kesalahan saat menambahkan paket');
            soundEffects.playError();
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div
            className={`fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 transition-opacity duration-300 ${
                isClosing ? 'animate-modal-fade-out' : 'animate-backdrop-fade-in'
            }`}
            onClick={handleClose}
        >
            <div
                className={`bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-purple-500/10 relative max-w-4xl w-full max-h-[85vh] min-h-[500px] flex flex-col z-[10000] transition-all duration-300 ${
                    isClosing ? 'animate-modal-scale-out' : 'animate-modal-scale-in'
                }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 z-10"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Fixed Header */}
                <div className="flex items-center space-x-4 p-6 pb-4 border-b border-gray-700/30 flex-shrink-0">
                    <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                        <span className="text-xl">💎</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold gradient-text">Tambah Paket Member</h2>
                        <p className="text-gray-400 text-sm">Pilih member dan paket untuk ditambahkan</p>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col px-6 py-4 min-h-0">
                    <div className="space-y-4 flex-shrink-0">
                    {error && <ErrorMessage message={error} />}

                    {success && (
                        <div className="p-4 bg-green-600/20 border border-green-500/30 rounded-lg">
                            <div className="flex items-center space-x-2">
                                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <p className="text-green-400 font-medium">Paket berhasil ditambahkan!</p>
                            </div>
                        </div>
                    )}

                    {/* Member Selection Section */}
                    <div className="space-y-3">
                        <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                                <span className="text-sm">👤</span>
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Pilih Member</h3>
                                <p className="text-sm text-gray-400">Cari dan pilih member yang akan ditambahkan paket</p>
                            </div>
                        </div>

                        <div className="relative">
                            <input
                                ref={searchInputRef}
                                type="text"
                                placeholder="Cari member (nama atau nomor telepon)..."
                                value={memberSearch}
                                onChange={(e) => setMemberSearch(e.target.value)}
                                className="w-full bg-gray-900/50 border border-gray-600/30 rounded-xl py-3 px-4 pr-10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/70 transition-all duration-300"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>



                        {/* Member Area - Always Fixed Height */}
                        <div className="h-48 relative">
                            {selectedMember ? (
                                /* Selected Member Profile Card */
                                <div className="absolute inset-0 rounded-xl overflow-hidden animate-fade-in">
                                    {memberDetailsLoading ? (
                                        <div className="h-full flex items-center justify-center bg-gradient-to-br from-purple-900/30 to-blue-900/30 border border-purple-500/30">
                                            <div className="text-center text-purple-300">
                                                <div className="relative">
                                                    <div className="animate-spin w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                                    <div className="absolute inset-0 animate-ping w-8 h-8 border border-purple-400 rounded-full mx-auto opacity-20"></div>
                                                </div>
                                                <span className="font-medium">Memuat profil member...</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-full flex">
                                            {/* Left Profile Section */}
                                            <div className="w-32 bg-gradient-to-br from-purple-600 to-blue-600 flex flex-col items-center justify-center relative overflow-hidden">
                                                {/* Background Pattern */}
                                                <div className="absolute inset-0 opacity-10">
                                                    <div className="absolute top-2 left-2 w-4 h-4 border-2 border-white rounded-full"></div>
                                                    <div className="absolute top-8 right-3 w-2 h-2 bg-white rounded-full"></div>
                                                    <div className="absolute bottom-6 left-4 w-3 h-3 border border-white rotate-45"></div>
                                                    <div className="absolute bottom-3 right-2 w-6 h-6 border-2 border-white rounded-full"></div>
                                                </div>

                                                {/* Profile Avatar */}
                                                <div className="relative mb-2">
                                                    <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center border-2 border-white/30">
                                                        <span className="text-2xl">👤</span>
                                                    </div>
                                                    {/* Status Indicator */}
                                                    <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center ${
                                                        selectedMember.remaining_time > 0 ? 'bg-green-500' : 'bg-red-500'
                                                    }`}>
                                                        <div className="w-2 h-2 bg-white rounded-full"></div>
                                                    </div>
                                                </div>

                                                {/* Member Name */}
                                                <h3 className="text-white font-bold text-sm text-center leading-tight mb-1">
                                                    {selectedMember.name}
                                                </h3>

                                                {/* Member Status */}
                                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                    selectedMember.remaining_time > 0
                                                        ? 'bg-green-500/20 text-green-200 border border-green-400/30'
                                                        : 'bg-red-500/20 text-red-200 border border-red-400/30'
                                                }`}>
                                                    {selectedMember.remaining_time > 0 ? 'Aktif' : 'Tidak Aktif'}
                                                </div>

                                                {/* Member ID */}
                                                <div className="mt-2 text-center">
                                                    <div className="text-xs text-white/60 uppercase tracking-wide">Member ID</div>
                                                    <div className="text-white font-mono text-sm">#{String(selectedMember.id).padStart(4, '0')}</div>
                                                </div>
                                            </div>

                                            {/* Right Info Section */}
                                            <div className="flex-1 bg-gradient-to-br from-gray-800/95 to-gray-900/95 border border-gray-700/50 relative">
                                                {/* Close Button */}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        soundEffects.playButtonClick();
                                                        setSelectedMember(null);
                                                        setMemberSearch('');
                                                    }}
                                                    className="absolute top-2 right-2 text-gray-400 hover:text-white transition-colors p-1.5 hover:bg-gray-700/50 rounded-lg z-10"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>

                                                <div className="p-4 h-full">
                                                    {/* Contact Info Section */}
                                                    <div className="mb-4">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center">
                                                                <span className="text-xs">📞</span>
                                                            </div>
                                                            <h4 className="text-blue-400 font-semibold text-sm">Informasi Kontak</h4>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Nama Lengkap</div>
                                                                <div className="text-white font-medium">{selectedMember.name}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Nomor Telepon</div>
                                                                <div className="text-white font-mono">{selectedMember.phone_number}</div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Package Info Section */}
                                                    <div className="mb-4">
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <div className="w-6 h-6 bg-green-600 rounded-lg flex items-center justify-center">
                                                                <span className="text-xs">📦</span>
                                                            </div>
                                                            <h4 className="text-green-400 font-semibold text-sm">Informasi Paket</h4>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Sisa Waktu</div>
                                                                <div className="text-green-400 font-bold text-lg">
                                                                    {selectedMember.remaining_time || 0} <span className="text-sm font-normal">menit</span>
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Total Paket</div>
                                                                <div className="text-purple-400 font-bold text-lg">
                                                                    {selectedMember.total_packages || 0} <span className="text-sm font-normal">paket</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Activity Stats */}
                                                    <div>
                                                        <div className="flex items-center space-x-2 mb-2">
                                                            <div className="w-6 h-6 bg-orange-600 rounded-lg flex items-center justify-center">
                                                                <span className="text-xs">📊</span>
                                                            </div>
                                                            <h4 className="text-orange-400 font-semibold text-sm">Statistik Aktivitas</h4>
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-3 text-xs">
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Bergabung Sejak</div>
                                                                <div className="text-gray-300 font-medium">
                                                                    {selectedMember.created_at ?
                                                                        new Date(selectedMember.created_at).toLocaleDateString('id-ID', {
                                                                            day: '2-digit',
                                                                            month: 'short',
                                                                            year: 'numeric'
                                                                        }) : 'N/A'
                                                                    }
                                                                </div>
                                                            </div>
                                                            <div>
                                                                <div className="text-gray-400 uppercase tracking-wide mb-1">Terakhir Aktif</div>
                                                                <div className="text-gray-300 font-medium">
                                                                    {selectedMember.last_login ?
                                                                        new Date(selectedMember.last_login).toLocaleDateString('id-ID', {
                                                                            day: '2-digit',
                                                                            month: 'short'
                                                                        }) : 'Belum pernah'
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : memberSearch ? (
                                /* Search Results */
                                <div className="absolute inset-0 border border-purple-500/20 rounded-xl overflow-hidden animate-fade-in bg-gradient-to-br from-gray-800/95 to-gray-900/95">
                                    <div className="h-full overflow-y-auto">
                                        {membersLoading ? (
                                            <div className="p-4 text-center text-purple-300 h-full flex flex-col items-center justify-center">
                                                <div className="relative">
                                                    <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                                                    <div className="absolute inset-0 animate-ping w-6 h-6 border border-purple-400 rounded-full mx-auto opacity-20"></div>
                                                </div>
                                                <span className="font-medium">Mencari member...</span>
                                            </div>
                                        ) : filteredMembers.length > 0 ? (
                                            <div className="p-3 space-y-2">
                                                <div className="flex items-center space-x-2 px-2 mb-1">
                                                    <div className="w-5 h-5 bg-purple-600 rounded-lg flex items-center justify-center">
                                                        <span className="text-xs">🔍</span>
                                                    </div>
                                                    <h4 className="text-purple-400 font-semibold text-xs">Hasil Pencarian</h4>
                                                </div>

                                                {filteredMembers.map(member => (
                                                    <button
                                                        key={member.id}
                                                        onClick={() => {
                                                            soundEffects.playButtonClick();
                                                            fetchMemberDetails(member);
                                                        }}
                                                        className="w-full p-3 bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/30 hover:border-purple-500/30 rounded-lg transition-all duration-200 text-left group"
                                                    >
                                                        <div className="flex items-center space-x-3">
                                                            <div className="bg-gradient-to-br from-purple-600/80 to-blue-600/80 p-2 rounded-lg group-hover:from-purple-500 group-hover:to-blue-500 transition-all duration-300">
                                                                <span className="text-sm">👤</span>
                                                            </div>
                                                            <div className="flex-1">
                                                                <h4 className="font-medium text-white group-hover:text-purple-200 transition-colors">{member.name}</h4>
                                                                <div className="flex items-center justify-between">
                                                                    <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">{member.phone_number}</p>
                                                                    <span className="text-xs text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">Pilih Member</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 text-center text-gray-400 h-full flex flex-col items-center justify-center">
                                                <div className="w-16 h-16 bg-gray-800/80 rounded-full flex items-center justify-center mb-3 border border-gray-700/50">
                                                    <span className="text-2xl">🔍</span>
                                                </div>
                                                <p className="text-gray-300 font-medium">Tidak ada member yang ditemukan</p>
                                                <p className="text-xs text-gray-500 mt-1">Coba kata kunci lain</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                /* Empty State */
                                <div className="absolute inset-0 border-2 border-dashed border-purple-500/20 rounded-xl flex items-center justify-center bg-gradient-to-br from-gray-800/30 to-gray-900/30">
                                    <div className="text-center text-gray-400">
                                        <div className="relative mb-4">
                                            <div className="w-20 h-20 bg-gradient-to-br from-purple-600/20 to-blue-600/20 rounded-full flex items-center justify-center mx-auto border border-purple-500/30">
                                                <span className="text-3xl">🔍</span>
                                            </div>
                                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                                                <span className="text-xs">👤</span>
                                            </div>
                                        </div>
                                        <h3 className="text-gray-300 font-semibold mb-1">Cari Member</h3>
                                        <p className="text-sm text-gray-500">Ketik nama atau nomor telepon untuk mencari member</p>
                                        <div className="mt-3 flex items-center justify-center space-x-2 text-xs text-gray-600">
                                            <span>💡</span>
                                            <span>Tip: Gunakan nama lengkap atau nomor HP</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Package Selection */}
                    <div className="space-y-4">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-indigo-600/20 border border-purple-500/30 rounded-xl p-4">
                            <div className="flex items-center space-x-4">
                                <div className="bg-gradient-to-br from-purple-500 via-blue-500 to-indigo-500 p-3 rounded-xl shadow-lg">
                                    <span className="text-xl">🎮</span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-xl font-bold bg-gradient-to-r from-purple-200 via-blue-200 to-indigo-200 bg-clip-text text-transparent">
                                        Pilih Paket Gaming
                                    </h3>
                                    <p className="text-sm text-purple-200">
                                        Pilih paket yang diinginkan untuk member
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs uppercase tracking-wide text-purple-300">
                                        Tersedia
                                    </div>
                                    <div className="font-bold text-lg text-purple-400">
                                        {packages.length} Paket
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Package Grid - With scroll for overflow */}
                        <div
                            className="flex-1 min-h-0 max-h-[350px] overflow-y-auto custom-scrollbar"
                            style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: 'rgba(255, 255, 255, 0.15) transparent'
                            }}
                        >
                            {packagesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                    <span className="ml-3 text-gray-400">Memuat paket...</span>
                                </div>
                            ) : packages.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">
                                    <span className="text-4xl mb-2 block">📦</span>
                                    Tidak ada paket tersedia
                                </div>
                            ) : (
                                <div
                                    className="grid gap-3 pb-2"
                                    style={{
                                        gridTemplateColumns: 'repeat(3, 1fr)',
                                        gridAutoRows: 'minmax(90px, auto)'
                                    }}
                                >
                                    {packages.map((pkg, index) => {
                                        const isSelected = selectedPackageId === pkg.id;

                                        // Dynamic gradient colors based on package index
                                        const gradientColors = [
                                            'from-purple-500/20 via-pink-500/20 to-red-500/20',
                                            'from-blue-500/20 via-cyan-500/20 to-teal-500/20',
                                            'from-green-500/20 via-emerald-500/20 to-lime-500/20',
                                            'from-yellow-500/20 via-orange-500/20 to-red-500/20',
                                            'from-indigo-500/20 via-purple-500/20 to-pink-500/20',
                                            'from-rose-500/20 via-pink-500/20 to-fuchsia-500/20'
                                        ];

                                        const borderColors = [
                                            'border-purple-400/30 hover:border-purple-400/60',
                                            'border-blue-400/30 hover:border-blue-400/60',
                                            'border-green-400/30 hover:border-green-400/60',
                                            'border-orange-400/30 hover:border-orange-400/60',
                                            'border-indigo-400/30 hover:border-indigo-400/60',
                                            'border-rose-400/30 hover:border-rose-400/60'
                                        ];

                                        const glowColors = [
                                            'hover:shadow-purple-500/30',
                                            'hover:shadow-blue-500/30',
                                            'hover:shadow-green-500/30',
                                            'hover:shadow-orange-500/30',
                                            'hover:shadow-indigo-500/30',
                                            'hover:shadow-rose-500/30'
                                        ];

                                        const colorIndex = index % 6;

                                        return (
                                            <button
                                                key={pkg.id}
                                                onClick={() => {
                                                    soundEffects.playButtonClick();
                                                    setSelectedPackageId(pkg.id);
                                                }}
                                                className={`
                                                    relative p-3 rounded-xl text-left transition-all duration-500 h-[90px] flex flex-col justify-between
                                                    border backdrop-blur-sm focus:outline-none group overflow-hidden
                                                    ${isSelected
                                                        ? `bg-gradient-to-br ${gradientColors[colorIndex]} border-white/40 shadow-2xl shadow-white/20 ring-2 ring-white/30`
                                                        : `bg-gradient-to-br from-gray-800/40 to-gray-900/60 ${borderColors[colorIndex]} hover:shadow-xl ${glowColors[colorIndex]}`
                                                    }
                                                `}
                                                style={{
                                                    animationDelay: `${index * 50}ms`
                                                }}
                                            >
                                                {/* Animated Background Pattern */}
                                                <div className="absolute inset-0 opacity-10">
                                                    <div className="absolute top-0 right-0 w-8 h-8 bg-white/20 rounded-full blur-sm group-hover:scale-150 transition-transform duration-700"></div>
                                                    <div className="absolute bottom-0 left-0 w-6 h-6 bg-white/10 rounded-full blur-sm group-hover:scale-125 transition-transform duration-500"></div>
                                                </div>

                                                {/* Package Name - Top */}
                                                <div className="relative z-10">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-white font-bold text-sm leading-tight truncate pr-2">
                                                            {pkg.name}
                                                        </h3>
                                                        {isSelected && (
                                                            <div className="bg-white/20 rounded-full p-1 animate-pulse">
                                                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                                </svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Duration & Price - Bottom */}
                                                <div className="relative z-10 flex items-end justify-between">
                                                    {/* Duration */}
                                                    <div className="flex flex-col">
                                                        <span className="text-gray-300 text-xs font-medium">
                                                            {pkg.duration_minutes} menit
                                                        </span>
                                                        <span className="text-gray-400 text-[10px]">
                                                            Durasi
                                                        </span>
                                                    </div>

                                                    {/* Price */}
                                                    <div className="flex flex-col text-right">
                                                        <span className="text-white font-bold text-sm">
                                                            Rp {(pkg.price / 1000).toFixed(0)}k
                                                        </span>
                                                        <span className="text-gray-400 text-[10px]">
                                                            Harga
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Selection Indicator */}
                                                {isSelected && (
                                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10 pointer-events-none"></div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Enhanced Flying Summary Modal with Advanced Focus Effects */}
        {selectedMember && selectedPackage && (
            <>
                {/* Multi-Layer Background Effects */}
                {/* Base Dark Overlay */}
                <div className={`fixed inset-0 bg-black/70 z-[9999] transition-opacity duration-300 ${
                    isSummaryClosing ? 'animate-modal-fade-out' : 'animate-backdrop-fade-in'
                }`} />

                {/* Vignette Effect */}
                <div className={`fixed inset-0 z-[9999] transition-opacity duration-300 ${
                    isSummaryClosing ? 'animate-modal-fade-out' : 'animate-fade-in'
                }`}
                     style={{
                         background: 'radial-gradient(circle at center, transparent 20%, rgba(0,0,0,0.8) 70%)'
                     }} />

                {/* Spotlight Effect */}
                <div className={`fixed inset-0 z-[10000] transition-opacity duration-300 ${
                    isSummaryClosing ? 'animate-modal-fade-out' : 'animate-fade-in'
                }`}
                     style={{
                         background: 'radial-gradient(circle at center, rgba(147,51,234,0.1) 0%, rgba(147,51,234,0.05) 30%, transparent 50%)'
                     }} />

                {/* Flying Modal - Perfect Center with Glow */}
                <div className={`fixed inset-0 flex items-center justify-center z-[10001] px-4 sm:px-0 transition-all duration-300 ${
                    isSummaryClosing ? 'animate-modal-scale-out' : 'animate-modal-scale-in'
                }`}>
                    {/* Outer Glow Ring */}
                    <div className="absolute inset-0 flex items-center justify-center animate-glow-pulse">
                        <div className="w-[380px] h-[380px] rounded-full bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-indigo-500/20 blur-3xl"></div>
                    </div>

                    {/* Modal Container */}
                    <div className="relative bg-gradient-to-br from-gray-800/98 via-gray-900/98 to-gray-800/98 border-2 border-purple-500/60 rounded-3xl shadow-2xl p-2 sm:p-3 w-full sm:w-[320px] lg:w-[340px] max-w-[80vw] animate-glow-border"
                         style={{
                             backdropFilter: 'blur(20px)',
                             boxShadow: '0 0 60px rgba(147, 51, 234, 0.4), 0 0 120px rgba(147, 51, 234, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                         }}>
                        {/* Enhanced Decorative Background Elements */}
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-600/8 via-blue-600/8 to-indigo-600/8 rounded-3xl" />

                        {/* Floating Orbs */}
                        <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/15 to-transparent rounded-full blur-2xl animate-pulse" />
                        <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-blue-500/15 to-transparent rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
                        <div className="absolute top-1/2 right-8 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full blur-lg animate-pulse" style={{ animationDelay: '2s' }} />

                        {/* Floating Particles */}
                        <div className="absolute top-12 left-12 w-2 h-2 bg-purple-400/30 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                        <div className="absolute top-20 right-16 w-1.5 h-1.5 bg-blue-400/40 rounded-full animate-bounce" style={{ animationDelay: '1.5s' }} />
                        <div className="absolute bottom-16 left-20 w-1 h-1 bg-indigo-400/50 rounded-full animate-bounce" style={{ animationDelay: '2.5s' }} />

                        {/* Content Container */}
                        <div className="relative z-10">
                            {/* Compact Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                    {/* Compact Icon Container */}
                                    <div className="relative">
                                        <div className="bg-gradient-to-br from-purple-600 via-blue-600 to-indigo-600 p-2 rounded-xl shadow-lg shadow-purple-500/20">
                                            <span className="text-sm">📋</span>
                                        </div>
                                        {/* Status Dot */}
                                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full" />
                                    </div>

                                    <div className="space-y-0.5">
                                        <h3 className="text-sm font-bold bg-gradient-to-r from-purple-200 via-blue-200 to-indigo-200 bg-clip-text text-transparent">
                                            Ringkasan Pembelian
                                        </h3>
                                        <div className="flex items-center space-x-2">
                                            <p className="text-xs text-gray-400">Member #{selectedMember.id}</p>
                                            <div className="w-1 h-1 bg-gray-500 rounded-full" />
                                            <span className="text-xs text-green-400 font-medium">Aktif</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Enhanced Close Button */}
                                <button
                                    onClick={handleSummaryClose}
                                    className="group relative p-3 bg-gray-700/60 hover:bg-red-600/20 border border-gray-600/40 hover:border-red-500/50 rounded-xl transition-all duration-300 text-gray-400 hover:text-red-400"
                                >
                                    <svg className="w-5 h-5 transition-transform duration-300 group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    {/* Hover Effect */}
                                    <div className="absolute inset-0 bg-red-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                </button>
                            </div>

                            {/* Enhanced Content */}
                            <div className="space-y-2 mb-3">
                                {/* Member & Package Info Cards - Horizontal Layout */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Member Card - Ultra Compact */}
                                    <div className="relative bg-gradient-to-br from-purple-600/15 via-purple-700/10 to-purple-800/15 border border-purple-500/30 rounded-lg p-2 overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex items-center space-x-1 mb-1">
                                                <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-1 rounded shadow-lg">
                                                    <span className="text-xs">👤</span>
                                                </div>
                                                <span className="text-xs text-purple-300 uppercase tracking-wider font-bold">Member</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-white font-bold text-xs truncate">{selectedMember.name}</div>
                                                <div className="text-xs text-purple-200 truncate">{selectedMember.phone_number}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Package Card - Ultra Compact */}
                                    <div className="relative bg-gradient-to-br from-blue-600/15 via-blue-700/10 to-indigo-800/15 border border-blue-500/30 rounded-lg p-2 overflow-hidden">
                                        <div className="relative z-10">
                                            <div className="flex items-center space-x-1 mb-1">
                                                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-1 rounded shadow-lg">
                                                    <span className="text-xs">📦</span>
                                                </div>
                                                <span className="text-xs text-blue-300 uppercase tracking-wider font-bold">Paket</span>
                                            </div>
                                            <div className="space-y-0.5">
                                                <div className="text-white font-bold text-xs truncate">{selectedPackage.name}</div>
                                                <div className="text-xs text-blue-200">{selectedPackage.duration_minutes} menit</div>
                                                <div className="text-xs text-green-400 font-bold">Rp {selectedPackage.price.toLocaleString('id-ID')}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantity Controls - Compact */}
                                <div className="relative bg-gradient-to-br from-orange-600/15 via-red-600/10 to-pink-600/15 border border-orange-500/30 rounded-lg p-3 overflow-hidden">
                                    {/* Background Effects */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />

                                    <div className="relative z-10">
                                        {/* Header - Compact */}
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex items-center space-x-2">
                                                <div className="bg-gradient-to-br from-orange-500 to-red-500 p-1.5 rounded-lg shadow-lg">
                                                    <span className="text-sm">🔢</span>
                                                </div>
                                                <span className="text-xs text-orange-300 uppercase tracking-wider font-bold">Jumlah Paket</span>
                                            </div>
                                            <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg px-2 py-1">
                                                <div className="text-orange-300 font-bold text-lg">{quantity}x</div>
                                            </div>
                                        </div>

                                        {/* Quantity Controls - Compact */}
                                        <div className="flex items-center justify-center space-x-3 mb-3">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    soundEffects.playButtonClick();
                                                    setQuantity(Math.max(1, quantity - 1));
                                                }}
                                                disabled={quantity <= 1}
                                                className="group relative p-2 bg-gray-800/70 hover:bg-gray-700/70 disabled:bg-gray-800/30 border border-gray-600/50 hover:border-orange-500/60 disabled:border-gray-600/20 rounded-lg transition-all duration-300 text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                </svg>
                                            </button>

                                            <div className="relative bg-gray-800/70 border border-gray-600/50 rounded-lg px-4 py-2 min-w-[80px] shadow-inner">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="99"
                                                    value={quantity}
                                                    onChange={(e) => {
                                                        const newValue = Math.max(1, Math.min(99, parseInt(e.target.value) || 1));
                                                        setQuantity(newValue);
                                                        soundEffects.playButtonClick();
                                                    }}
                                                    className="w-full bg-transparent text-white text-center text-lg font-bold focus:outline-none placeholder-gray-500"
                                                    placeholder="1"
                                                />
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    soundEffects.playButtonClick();
                                                    setQuantity(Math.min(99, quantity + 1));
                                                }}
                                                disabled={quantity >= 99}
                                                className="group relative p-2 bg-gray-800/70 hover:bg-gray-700/70 disabled:bg-gray-800/30 border border-gray-600/50 hover:border-orange-500/60 disabled:border-gray-600/20 rounded-lg transition-all duration-300 text-gray-300 hover:text-white disabled:text-gray-500 disabled:cursor-not-allowed transform hover:scale-105 active:scale-95"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                                </svg>
                                            </button>
                                        </div>

                                        {/* Calculation Breakdown - Compact */}
                                        <div className="bg-gradient-to-r from-gray-700/30 via-gray-800/30 to-gray-700/30 border border-gray-600/40 rounded-lg p-2">
                                            <div className="text-center">
                                                <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Perhitungan</div>
                                                <div className="text-white font-semibold text-sm">
                                                    Total: {quantity}x {selectedPackage.name}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Summary Details - Compact */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Total Time Card - Compact */}
                                    <div className="relative bg-gradient-to-br from-blue-600/15 via-blue-700/10 to-cyan-600/15 border border-blue-500/30 rounded-lg p-2 overflow-hidden">
                                        <div className="relative z-10 text-center">
                                            <div className="flex items-center justify-center space-x-1 mb-1">
                                                <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-1 rounded-lg">
                                                    <span className="text-xs">⏱️</span>
                                                </div>
                                                <span className="text-xs text-blue-300 uppercase tracking-wider font-bold">Total Waktu</span>
                                            </div>
                                            <div className="text-blue-400 font-bold text-sm">{totalMinutes} menit</div>
                                            <div className="text-xs text-blue-200">{Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</div>
                                        </div>
                                    </div>

                                    {/* Unit Price Card - Compact */}
                                    <div className="relative bg-gradient-to-br from-green-600/15 via-green-700/10 to-emerald-600/15 border border-green-500/30 rounded-lg p-2 overflow-hidden">
                                        <div className="relative z-10 text-center">
                                            <div className="flex items-center justify-center space-x-1 mb-1">
                                                <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-1 rounded-lg">
                                                    <span className="text-xs">💰</span>
                                                </div>
                                                <span className="text-xs text-green-300 uppercase tracking-wider font-bold">Harga Satuan</span>
                                            </div>
                                            <div className="text-green-400 font-bold text-sm">Rp {selectedPackage.price.toLocaleString('id-ID')}</div>
                                            <div className="text-xs text-green-200">per paket</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Total Payment - Compact */}
                                <div className="relative bg-gradient-to-br from-emerald-600/20 via-green-600/15 to-teal-600/20 border border-emerald-500/40 rounded-lg p-3 overflow-hidden">
                                    <div className="relative z-10 text-center">
                                        <div className="flex items-center justify-center space-x-2 mb-2">
                                            <div className="bg-gradient-to-br from-emerald-500 to-green-600 p-1.5 rounded-lg shadow-xl">
                                                <span className="text-xs">💳</span>
                                            </div>
                                            <span className="text-xs text-emerald-300 uppercase tracking-wider font-bold">Total Pembayaran</span>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="text-emerald-400 font-bold text-lg tracking-tight">
                                                Rp {totalAmount.toLocaleString('id-ID')}
                                            </div>
                                            <div className="text-emerald-200 text-xs font-medium">
                                                {quantity}x Rp {selectedPackage.price.toLocaleString('id-ID')}
                                            </div>
                                            <div className="text-xs text-gray-400 bg-gray-800/30 rounded px-2 py-0.5 inline-block">
                                                Termasuk {totalMinutes} menit waktu bermain
                                            </div>
                                        </div>
                                    </div>
                                </div>
                    </div>

                            {/* Actions - Compact */}
                            <div className="flex flex-col sm:flex-row gap-2 pt-3">
                                {/* Cancel Button - Compact */}
                                <button
                                    onClick={handleSummaryClose}
                                    className="
                                        group relative flex-1 px-3 py-2 bg-gradient-to-r from-gray-700/70 to-gray-800/70
                                        hover:from-gray-600/70 hover:to-gray-700/70 border border-gray-600/50
                                        hover:border-gray-500/60 rounded-lg transition-all duration-300
                                        text-gray-300 hover:text-white font-semibold overflow-hidden
                                        focus:outline-none focus:ring-2 focus:ring-gray-500/50
                                        transform hover:scale-105 active:scale-95
                                    "
                                >
                                    <div className="relative z-10 flex items-center justify-center space-x-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        <span className="text-sm">Batal</span>
                                    </div>
                                </button>

                                {/* Primary Action Button - Compact */}
                                <button
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="
                                        group relative flex-[2] overflow-hidden px-4 py-2
                                        bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600
                                        hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700
                                        text-white font-bold rounded-lg transition-all duration-300
                                        transform hover:scale-105 active:scale-95
                                        disabled:from-gray-600 disabled:via-gray-700 disabled:to-gray-800
                                        disabled:cursor-not-allowed disabled:transform-none
                                        disabled:hover:scale-100 disabled:opacity-50
                                        focus:outline-none focus:ring-2 focus:ring-purple-500/50
                                        shadow-lg shadow-purple-500/40
                                    "
                                >
                                    {loading ? (
                                        <div className="flex items-center justify-center space-x-2">
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            <span className="font-bold text-sm">Memproses...</span>
                                        </div>
                                    ) : (
                                        <div className="relative z-10 flex items-center justify-center space-x-2">
                                            <span className="text-sm">💳</span>
                                            <div className="text-left">
                                                <div className="font-bold text-sm">Bayar & Tambah Paket</div>
                                                <div className="text-xs text-white/90 font-medium">
                                                    Rp {totalAmount.toLocaleString('id-ID')} • {quantity} paket
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Multiple Layer Effects */}
                                    {!loading && (
                                        <>
                                            {/* Shine Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1200 ease-out" />

                                            {/* Pulse Effect */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/30 via-blue-600/30 to-indigo-600/30 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                            {/* Glow Effect */}
                                            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600/50 via-blue-600/50 to-indigo-600/50 rounded-2xl blur opacity-0 group-hover:opacity-75 transition-opacity duration-500" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        )}
        </>
    );
}
