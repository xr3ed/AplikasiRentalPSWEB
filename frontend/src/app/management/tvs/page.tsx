'use client';

import { useEffect, useState } from 'react';

interface TV {
    id: number;
    name: string;
    ip_address: string;
    status: string;
}

export default function TVManagementPage() {
    const [tvs, setTvs] = useState<TV[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingTv, setEditingTv] = useState<TV | null>(null);

    const fetchTvs = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/tvs', {
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
        } catch (err) {
            setError('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTvs();
    }, []);



    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTv) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/tvs/${editingTv.id}`,
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
        } catch (err) {
            setError('An error occurred while updating TV');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this TV?')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/tvs/${id}`, {
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
            } catch (err) {
                setError('An error occurred while deleting TV');
            }
        }
    };

    const startEdit = (tv: TV) => {
        setEditingTv({ ...tv });
    };

    const cancelEdit = () => {
        setEditingTv(null);
    };


    if (loading) return <p className="text-white">Memuat...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-8">Manajemen TV</h1>

            {editingTv && (
                <div className="bg-black border border-gray-800 rounded-lg p-8 mb-8">
                    <form onSubmit={handleUpdate}>
                        <h2 className="text-2xl font-bold mb-6 text-white">Edit TV</h2>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="name">
                                Nama TV
                            </label>
                            <input 
                                id="name"
                                type="text"
                                value={editingTv.name}
                                onChange={(e) => setEditingTv({...editingTv, name: e.target.value})}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="ip_address">
                                Alamat IP
                            </label>
                            <input 
                                id="ip_address"
                                type="text"
                                value={editingTv.ip_address}
                                onChange={(e) => setEditingTv({...editingTv, ip_address: e.target.value})}
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
                            <th className="py-3 px-6 text-left">Alamat IP</th>
                            <th className="py-3 px-6 text-center">Status</th>
                            <th className="py-3 px-6 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-white text-sm font-light">
                        {tvs.map(tv => (
                            <tr key={tv.id} className="border-b border-gray-800 hover:bg-gray-900">
                                <td className="py-3 px-6 text-left whitespace-nowrap">{tv.id}</td>
                                <td className="py-3 px-6 text-left">{tv.name}</td>
                                <td className="py-3 px-6 text-left">{tv.ip_address}</td>
                                <td className="py-3 px-6 text-center">
                                    <span className={`py-1 px-3 rounded-full text-xs ${tv.status === 'active' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                        {tv.status}
                                    </span>
                                </td>
                                <td className="py-3 px-6 text-center">
                                    <div className="flex item-center justify-center space-x-4">
                                        <button onClick={() => startEdit(tv)} className="text-gray-400 hover:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDelete(tv.id)} className="text-gray-400 hover:text-red-500">
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