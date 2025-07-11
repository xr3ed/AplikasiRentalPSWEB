'use client';

import { useEffect, useState } from 'react';

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

    const fetchMembers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/members', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
                setMembers(result.data);
            } else {
                setError('Failed to fetch members');
            }
        } catch (err) {
            setError('An error occurred');
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
            const res = await fetch('/api/members', {
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
                setError(result.message || 'Failed to create member');
            }
        } catch (err) {
            setError('An error occurred while creating member');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingMember) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/members/${editingMember.id}`,
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
                setError(result.message || 'Failed to update member');
            }
        } catch (err) {
            setError('An error occurred while updating member');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this member?')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/members/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (res.ok) {
                    fetchMembers(); // Refresh the list
                } else {
                    const result = await res.json();
                setError(result.message || 'Failed to delete member');
                }
            } catch (err) {
                setError('An error occurred while deleting member');
            }
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
                            <tr key={member.id} className="border-b border-gray-800 hover:bg-gray-900">
                                <td className="py-3 px-6 text-left whitespace-nowrap">{member.id}</td>
                                <td className="py-3 px-6 text-left">{member.name}</td>
                                <td className="py-3 px-6 text-left">{member.phone_number}</td>
                                <td className="py-3 px-6 text-center">
                                    <div className="flex item-center justify-center space-x-4">
                                        <button onClick={() => startEdit(member)} className="text-gray-400 hover:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDelete(member.id)} className="text-gray-400 hover:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    );
}