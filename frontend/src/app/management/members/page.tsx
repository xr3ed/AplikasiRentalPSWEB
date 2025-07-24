'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AddPackageToMemberModal from '../../../components/AddPackageToMemberModal';
import '../../../styles/dashboard.css';

interface Member {
    id: number;
    name: string;
    phone_number: string;
    created_at?: string;
}

export default function MemberManagementPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPhoneNumber, setNewPhoneNumber] = useState('');
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
    const [showAddPackageModal, setShowAddPackageModal] = useState(false);
    const [selectedMemberDetail, setSelectedMemberDetail] = useState<Member | null>(null);

    const fetchMembers = async () => {
        try {
            const token = localStorage.getItem('token');
                        const res = await fetch('http://localhost:3001/api/members', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
                setMembers(result.data);
            } else {
                                setError('Gagal mengambil data anggota');
            }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                        setError('Terjadi kesalahan');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
                        const res = await fetch('http://localhost:3001/api/members', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newName, phone_number: newPhoneNumber }),
            });

            if (res.ok) {
                setShowForm(false);
                setNewName('');
                setNewPhoneNumber('');
                fetchMembers(); // Refresh the list
            } else {
                const result = await res.json();
                                setError(result.message || 'Gagal membuat anggota');
            }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                        setError('Terjadi kesalahan saat membuat anggota');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;

        try {
            const token = localStorage.getItem('token');
                        const res = await fetch(`http://localhost:3001/api/members/${editingMember.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ name: editingMember.name, phone_number: editingMember.phone_number }),
                });

            if (res.ok) {
                setEditingMember(null);
                fetchMembers(); // Refresh the list
            } else {
                const result = await res.json();
                                setError(result.message || 'Gagal memperbarui anggota');
            }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
                        setError('Terjadi kesalahan saat memperbarui anggota');
        }
    };

    const handleDelete = (id: number) => {
        setMemberToDelete(id);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!memberToDelete) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3001/api/members/${memberToDelete}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                fetchMembers(); // Refresh the list
            } else {
                const result = await res.json();
                setError(result.message || 'Gagal menghapus anggota');
            }
        } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
            setError('Terjadi kesalahan saat menghapus anggota');
        } finally {
            setShowDeleteConfirm(false);
            setMemberToDelete(null);
        }
    };

    const startEdit = (member: Member) => {
        setEditingMember({ ...member });
    };

    const cancelEdit = () => {
        setEditingMember(null);
    };


    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="glass-card p-8 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Memuat data member...</p>
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
        <>
            {showDeleteConfirm && (
                <div
                    className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[10300] p-4"
                    onClick={() => setShowDeleteConfirm(false)}
                >
                    <div
                        className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-red-500/10 p-6 max-w-lg w-full animate-modal-scale-in"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center space-x-4 mb-6">
                            <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 rounded-xl shadow-lg shadow-red-500/25">
                                <span className="text-xl">⚠️</span>
                            </div>
                            <div>
                                <h3 className="text-xl font-bold gradient-text">Konfirmasi Hapus</h3>
                                <p className="text-gray-400 text-sm">Tindakan ini tidak dapat dibatalkan</p>
                            </div>
                        </div>

                        <p className="text-gray-300 mb-6">Apakah Anda yakin ingin menghapus member ini? Semua data terkait akan hilang secara permanen.</p>

                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 hover:border-gray-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-white"
                            >
                                Batal
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="
                                    relative overflow-hidden bg-gradient-to-r from-red-600 to-red-700
                                    hover:from-red-700 hover:to-red-800 text-white font-bold py-3 px-6
                                    rounded-xl transition-all duration-300 transform hover:scale-105
                                    focus:outline-none focus:ring-2 focus:ring-red-500/50 shadow-lg
                                    shadow-red-500/25 active:scale-95
                                "
                            >
                                {/* Button Content */}
                                <span className="relative z-10 flex items-center">
                                    <span className="mr-2">🗑️</span>
                                    <span>Hapus Member</span>
                                </span>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

        <div className="space-y-6">
            {/* Header Section */}
            <div className="glass-card p-6">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
                    <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                            <span className="text-2xl">👥</span>
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold gradient-text">Manajemen Member</h1>
                            <p className="text-gray-400 text-sm">Kelola member dan paket gaming</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddPackageModal(true)}
                        className="
                            relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6
                            rounded-xl transition-all duration-300 transform hover:scale-105
                            focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                            shadow-purple-500/25 active:scale-95
                        "
                    >
                        {/* Button Content */}
                        <span className="relative z-10 flex items-center">
                            <span className="mr-2">💎</span>
                            <span>Tambah Paket</span>
                        </span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                    </button>
                </div>
            </div>

            {/* Member List */}
            <div className="glass-card p-6">
                <div className="flex items-center space-x-4 mb-6">
                    <div className="bg-gradient-to-br from-green-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-green-500/25">
                        <span className="text-xl">📋</span>
                    </div>
                    <div>
                        <h2 className="text-xl font-bold gradient-text">Daftar Member</h2>
                        <p className="text-gray-400 text-sm">Total {members.length} member terdaftar</p>
                    </div>
                </div>

                <div className="mb-6">
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="
                            relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6
                            rounded-xl transition-all duration-300 transform hover:scale-105
                            focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                            shadow-purple-500/25 active:scale-95
                        "
                    >
                        {/* Button Content */}
                        <span className="relative z-10 flex items-center">
                            <span className="mr-2">{showForm ? '❌' : '➕'}</span>
                            <span>{showForm ? 'Batal' : 'Tambah Member Baru'}</span>
                        </span>

                        {/* Shine Effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                    </button>
                </div>

            {showForm && (
                <div className="glass-card p-8 mb-6">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                            <span className="text-xl">➕</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold gradient-text">Tambah Member Baru</h2>
                            <p className="text-gray-400 text-sm">Daftarkan member baru ke sistem</p>
                        </div>
                    </div>

                    <form onSubmit={handleCreate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="name">
                                    Nama Member
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-600/30 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-gray-900/70 transition-all duration-300"
                                    placeholder="Masukkan nama lengkap member"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="phone_number">
                                    Nomor Telepon
                                </label>
                                <input
                                    id="phone_number"
                                    type="text"
                                    value={newPhoneNumber}
                                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                                    className="w-full bg-gray-900/50 border border-gray-600/30 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 focus:bg-gray-900/70 transition-all duration-300"
                                    placeholder="Contoh: +62812345678"
                                    required
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 hover:border-gray-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-white"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="
                                    relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600
                                    hover:from-green-700 hover:to-emerald-700 text-white font-bold py-3 px-6
                                    rounded-xl transition-all duration-300 transform hover:scale-105
                                    focus:outline-none focus:ring-2 focus:ring-green-500/50 shadow-lg
                                    shadow-green-500/25 active:scale-95
                                "
                            >
                                {/* Button Content */}
                                <span className="relative z-10 flex items-center">
                                    <span className="mr-2">➕</span>
                                    <span>Buat Member</span>
                                </span>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {editingMember && (
                <div className="glass-card p-8 mb-6 animate-fade-in">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-3 rounded-xl shadow-lg shadow-blue-500/25 animate-pulse-glow">
                            <span className="text-xl">✏️</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold gradient-text">Edit Member</h2>
                            <p className="text-gray-400 text-sm">Perbarui informasi member</p>
                        </div>
                    </div>

                    <form onSubmit={handleUpdate} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 animate-slide-in-left">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="edit-name">
                                    Nama Member
                                </label>
                                <div className="relative group">
                                    <input
                                        id="edit-name"
                                        type="text"
                                        value={editingMember.name}
                                        onChange={(e) => setEditingMember({...editingMember, name: e.target.value})}
                                        className="w-full bg-gray-900/50 border border-gray-600/30 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/70 transition-all duration-300 group-hover:border-blue-500/30"
                                        placeholder="Masukkan nama lengkap member"
                                        required
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                </div>
                            </div>
                            <div className="space-y-2 animate-slide-in-right">
                                <label className="block text-gray-300 text-sm font-medium" htmlFor="edit-phone">
                                    Nomor Telepon
                                </label>
                                <div className="relative group">
                                    <input
                                        id="edit-phone"
                                        type="text"
                                        value={editingMember.phone_number}
                                        onChange={(e) => setEditingMember({...editingMember, phone_number: e.target.value})}
                                        className="w-full bg-gray-900/50 border border-gray-600/30 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 focus:bg-gray-900/70 transition-all duration-300 group-hover:border-blue-500/30"
                                        placeholder="Contoh: +62812345678"
                                        required
                                    />
                                    <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center justify-end space-x-3">
                            <button
                                type="button"
                                onClick={cancelEdit}
                                className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 hover:border-gray-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-white"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                className="
                                    relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600
                                    hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6
                                    rounded-xl transition-all duration-300 transform hover:scale-105
                                    focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg
                                    shadow-blue-500/25 active:scale-95
                                "
                            >
                                {/* Button Content */}
                                <span className="relative z-10 flex items-center">
                                    <span className="mr-2">💾</span>
                                    <span>Simpan Perubahan</span>
                                </span>

                                {/* Shine Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                            </button>
                        </div>
                    </form>
                </div>
            )}

                {members.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-6xl mb-4">👥</div>
                        <h3 className="text-xl font-semibold text-gray-300 mb-2">Belum ada member terdaftar</h3>
                        <p className="text-gray-400 mb-6">Tambahkan member pertama Anda untuk memulai</p>
                        <button
                            onClick={() => setShowForm(true)}
                            className="
                                relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600
                                hover:from-purple-700 hover:to-blue-700 text-white font-bold py-3 px-6
                                rounded-xl transition-all duration-300 transform hover:scale-105
                                focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg
                                shadow-purple-500/25 active:scale-95
                            "
                        >
                            {/* Button Content */}
                            <span className="relative z-10 flex items-center">
                                <span className="mr-2">➕</span>
                                <span>Tambah Member Pertama</span>
                            </span>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                        </button>
                    </div>
                ) : (
                    <div className="glass-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                            <thead>
                                <tr className="border-b border-gray-600/50">
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">ID</th>
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">Nama</th>
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">Nomor Telepon</th>
                                    <th className="py-4 px-6 text-left text-gray-300 font-medium text-sm uppercase tracking-wide">Tanggal Daftar</th>
                                    <th className="py-4 px-6 text-center text-gray-300 font-medium text-sm uppercase tracking-wide">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {members.map(member => (
                                    <tr key={member.id} className="hover:bg-gray-800/30 transition-colors duration-200">
                                        <td className="py-4 px-6 text-white font-mono text-sm">{member.id}</td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center space-x-3">
                                                <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2 rounded-lg">
                                                    <span className="text-sm">👤</span>
                                                </div>
                                                <span className="text-white font-medium">{member.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="text-gray-300 font-mono text-sm bg-gray-800/50 px-3 py-1 rounded-lg">{member.phone_number}</span>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center space-x-2">
                                                <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-1.5 rounded-lg">
                                                    <span className="text-xs">📅</span>
                                                </div>
                                                <div className="text-sm">
                                                    <div className="text-white font-medium">
                                                        {member.created_at ? new Date(member.created_at).toLocaleDateString('id-ID', {
                                                            day: '2-digit',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        }) : 'Tidak diketahui'}
                                                    </div>
                                                    <div className="text-gray-400 text-xs">
                                                        {member.created_at ? new Date(member.created_at).toLocaleTimeString('id-ID', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        }) : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex items-center justify-center space-x-2">
                                                <button
                                                    onClick={() => startEdit(member)}
                                                    className="bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 hover:text-blue-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                                    title="Edit Member"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => setSelectedMemberDetail(member)}
                                                    className="bg-green-600/20 hover:bg-green-600/40 text-green-300 hover:text-green-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500/50"
                                                    title="Detail Member"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(member.id)}
                                                    className="bg-red-600/20 hover:bg-red-600/40 text-red-300 hover:text-red-200 p-2 rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500/50"
                                                    title="Hapus Member"
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
                    </div>
                )}
            </div>
        </div>

        {/* Add Package Modal */}
        <AddPackageToMemberModal
            isOpen={showAddPackageModal}
            onClose={() => setShowAddPackageModal(false)}
            onSuccess={() => {
                fetchMembers(); // Refresh member list
                setShowAddPackageModal(false);
            }}
        />

        {/* Member Detail Modal */}
        {selectedMemberDetail && (
            <div
                className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
                onClick={() => setSelectedMemberDetail(null)}
            >
                <div
                    className="bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl shadow-purple-500/10 relative max-w-4xl w-full max-h-[90vh] flex flex-col z-[10000] animate-modal-scale-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Close Button */}
                    <button
                        type="button"
                        onClick={() => setSelectedMemberDetail(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors duration-200 z-10"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Fixed Header */}
                    <div className="flex items-center space-x-4 p-8 pb-6 border-b border-gray-700/30 flex-shrink-0">
                        <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-3 rounded-xl shadow-lg shadow-purple-500/25">
                            <span className="text-xl">👤</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold gradient-text">Detail Member</h2>
                            <p className="text-gray-400 text-sm">Informasi lengkap member</p>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-8 py-6 min-h-0">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Profile Section */}
                            <div className="lg:col-span-1">
                                <div className="glass-card p-6 text-center">
                                    {/* Profile Photo Placeholder */}
                                    <div className="relative mx-auto mb-6">
                                        <div className="w-32 h-32 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/25">
                                            <span className="text-4xl">👤</span>
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-green-500 w-8 h-8 rounded-full border-4 border-gray-800 flex items-center justify-center">
                                            <span className="text-xs">✓</span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2">{selectedMemberDetail.name}</h3>
                                    <p className="text-gray-400 text-sm mb-4">Member Aktif</p>

                                    <div className="space-y-3">
                                        <div className="bg-gray-800/50 rounded-lg p-3">
                                            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Member ID</div>
                                            <div className="text-white font-mono">#{selectedMemberDetail.id.toString().padStart(4, '0')}</div>
                                        </div>

                                        <div className="bg-gray-800/50 rounded-lg p-3">
                                            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Status</div>
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                                <span className="text-green-400 font-medium">Aktif</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Information Section */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Contact Information */}
                                <div className="glass-card p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-lg">
                                            <span className="text-sm">📞</span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-white">Informasi Kontak</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase tracking-wide">Nama Lengkap</label>
                                            <div className="bg-gray-800/50 rounded-lg p-3">
                                                <span className="text-white font-medium">{selectedMemberDetail.name}</span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase tracking-wide">Nomor Telepon</label>
                                            <div className="bg-gray-800/50 rounded-lg p-3">
                                                <span className="text-white font-mono">{selectedMemberDetail.phone_number}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Registration Information */}
                                <div className="glass-card p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="bg-gradient-to-br from-green-600 to-emerald-600 p-2 rounded-lg">
                                            <span className="text-sm">📅</span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-white">Informasi Pendaftaran</h4>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase tracking-wide">Tanggal Daftar</label>
                                            <div className="bg-gray-800/50 rounded-lg p-3">
                                                <span className="text-white font-medium">
                                                    {selectedMemberDetail.created_at ? new Date(selectedMemberDetail.created_at).toLocaleDateString('id-ID', {
                                                        weekday: 'long',
                                                        day: '2-digit',
                                                        month: 'long',
                                                        year: 'numeric'
                                                    }) : 'Tidak diketahui'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-400 uppercase tracking-wide">Waktu Daftar</label>
                                            <div className="bg-gray-800/50 rounded-lg p-3">
                                                <span className="text-white font-medium">
                                                    {selectedMemberDetail.created_at ? new Date(selectedMemberDetail.created_at).toLocaleTimeString('id-ID', {
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                        second: '2-digit'
                                                    }) : 'Tidak diketahui'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quick Stats */}
                                <div className="glass-card p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="bg-gradient-to-br from-orange-600 to-red-600 p-2 rounded-lg">
                                            <span className="text-sm">📊</span>
                                        </div>
                                        <h4 className="text-lg font-semibold text-white">Statistik Singkat</h4>
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-blue-400">0</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wide">Total Paket</div>
                                        </div>

                                        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-green-400">0</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wide">Sesi Aktif</div>
                                        </div>

                                        <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                            <div className="text-2xl font-bold text-purple-400">0</div>
                                            <div className="text-xs text-gray-400 uppercase tracking-wide">Total Transaksi</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-8 pt-6 border-t border-gray-700/30 flex justify-end space-x-3 flex-shrink-0">
                        <button
                            onClick={() => setSelectedMemberDetail(null)}
                            className="px-6 py-3 bg-gray-700/50 hover:bg-gray-600/50 border border-gray-600/50 hover:border-gray-500/50 rounded-xl transition-all duration-300 text-gray-300 hover:text-white"
                        >
                            Tutup
                        </button>
                        <button
                            onClick={() => {
                                setSelectedMemberDetail(null);
                                startEdit(selectedMemberDetail);
                            }}
                            className="
                                relative overflow-hidden bg-gradient-to-r from-blue-600 to-indigo-600
                                hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6
                                rounded-xl transition-all duration-300 transform hover:scale-105
                                focus:outline-none focus:ring-2 focus:ring-blue-500/50 shadow-lg
                                shadow-blue-500/25 active:scale-95
                            "
                        >
                            {/* Button Content */}
                            <span className="relative z-10 flex items-center">
                                <span className="mr-2">✏️</span>
                                <span>Edit Member</span>
                            </span>

                            {/* Shine Effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent transform -skew-x-12 -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out" />
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}