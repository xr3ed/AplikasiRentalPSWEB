'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Member {
    id: number;
    name: string;
    phone_number: string;
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


    if (loading) return <p className="text-white">Memuat...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <>
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
                    <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 shadow-lg max-w-sm w-full">
                        <h3 className="text-xl font-bold text-white mb-4">Konfirmasi Hapus</h3>
                        <p className="text-gray-300 mb-6">Apakah Anda yakin ingin menghapus anggota ini?</p>
                        <div className="flex justify-end gap-4">
                            <button 
                                onClick={() => setShowDeleteConfirm(false)} 
                                className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={confirmDelete} 
                                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-8">Manajemen Member</h1>

            <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-6"
            >
                {showForm ? 'Batal' : 'Tambah Member Baru'}
            </button>

            {showForm && (
                <div className="bg-black border border-gray-800 rounded-lg p-8 mb-8">
                    <form onSubmit={handleCreate}>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="name">
                                Nama Member
                            </label>
                            <input 
                                id="name"
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="phone_number">
                                Nomor Telepon
                            </label>
                            <input 
                                id="phone_number"
                                type="text"
                                value={newPhoneNumber}
                                onChange={(e) => setNewPhoneNumber(e.target.value)}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-end">
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                Buat Member
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {editingMember && (
                <div className="bg-black border border-gray-800 rounded-lg p-8 mb-8">
                    <form onSubmit={handleUpdate}>
                        <h2 className="text-2xl font-bold mb-6 text-white">Edit Member</h2>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="name">
                                Nama Member
                            </label>
                            <input 
                                id="name"
                                type="text"
                                value={editingMember.name}
                                onChange={(e) => setEditingMember({...editingMember, name: e.target.value})}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="phone_number">
                                Nomor Telepon
                            </label>
                            <input 
                                id="phone_number"
                                type="text"
                                value={editingMember.phone_number}
                                onChange={(e) => setEditingMember({...editingMember, phone_number: e.target.value})}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-end space-x-4">
                             <button type="button" onClick={cancelEdit} className="bg-transparent border border-gray-700 hover:bg-gray-800 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                Batal
                            </button>
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                Simpan Perubahan
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-black border border-gray-800 rounded-lg overflow-hidden">
                <table className="min-w-full table-auto">
                    <thead>
                        <tr className="bg-gray-900 text-gray-400 uppercase text-sm leading-normal">
                            <th className="py-3 px-6 text-left">ID</th>
                            <th className="py-3 px-6 text-left">Nama</th>
                            <th className="py-3 px-6 text-left">Nomor Telepon</th>
                            <th className="py-3 px-6 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-white text-sm font-light">
                        {members.map(member => (
                            <tr key={member.id}>
                                 <td className="p-4 border-b border-gray-800 text-white">{member.id}</td>
                                 <td className="p-4 border-b border-gray-800 text-white">{member.name}</td>
                                 <td className="p-4 border-b border-gray-800 text-white">{member.phone_number}</td>
                                 <td className="p-4 border-b border-gray-800 text-white">
                                     <Link href={`/management/members/${member.id}`}>
                                         <button className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded mr-2">
                                             Lihat Detail
                                         </button>
                                     </Link>
                                     <button 
                                         onClick={() => startEdit(member)}
                                         className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-1 px-3 rounded mr-2"
                                     >
                                         Edit
                                     </button>
                                     <button 
                                         onClick={() => handleDelete(member.id)}
                                         className="bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded"
                                     >
                                         Hapus
                                     </button>
                                 </td>
                             </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
        </>
    );
}