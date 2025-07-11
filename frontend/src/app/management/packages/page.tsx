'use client';

import { useEffect, useState } from 'react';

interface Package {
    id: number;
    name: string;
    duration_minutes: number;
    price: number;
}

export default function PackageManagementPage() {
    const [packages, setPackages] = useState<Package[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDuration, setNewDuration] = useState(0);
    const [newPrice, setNewPrice] = useState(0);
    const [editingPackage, setEditingPackage] = useState<Package | null>(null);

    const fetchPackages = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/packages', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
                setPackages(result.data);
            } else {
                setError('Failed to fetch packages');
            }
        } catch (err) {
            setError('An error occurred');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPackages();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/packages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ name: newName, duration_minutes: newDuration, price: newPrice }),
            });

            if (res.ok) {
                setShowForm(false);
                setNewName('');
                setNewDuration(0);
                setNewPrice(0);
                fetchPackages(); // Refresh the list
            } else {
                const result = await res.json();
                setError(result.message || 'Failed to create package');
            }
        } catch (err) {
            setError('An error occurred while creating package');
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingPackage) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/packages/${editingPackage.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ 
                        name: editingPackage.name, 
                        duration_minutes: editingPackage.duration_minutes, 
                        price: editingPackage.price 
                    }),
                });

            if (res.ok) {
                setEditingPackage(null);
                fetchPackages(); // Refresh the list
            } else {
                const result = await res.json();
                setError(result.message || 'Failed to update package');
            }
        } catch (err) {
            setError('An error occurred while updating package');
        }
    };

    const handleDelete = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this package?')) {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/packages/${id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (res.ok) {
                    fetchPackages(); // Refresh the list
                } else {
                    const result = await res.json();
                setError(result.message || 'Failed to delete package');
                }
            } catch (err) {
                setError('An error occurred while deleting package');
            }
        }
    };

    const startEdit = (pkg: Package) => {
        setEditingPackage({ ...pkg });
    };

    const cancelEdit = () => {
        setEditingPackage(null);
    };


    if (loading) return <p className="text-white">Loading...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="p-6">
            <h1 className="text-3xl font-bold text-white mb-8">Manajemen Paket</h1>

            <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mb-6"
            >
                {showForm ? 'Batal' : 'Tambah Paket Baru'}
            </button>

            {showForm && (
                <div className="bg-black border border-gray-800 rounded-lg p-8 mb-8">
                    <form onSubmit={handleCreate}>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="name">
                                Nama Paket
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
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="duration">
                                Durasi (menit)
                            </label>
                            <input 
                                id="duration"
                                type="number"
                                value={newDuration}
                                onChange={(e) => setNewDuration(parseInt(e.target.value))}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="price">
                                Harga
                            </label>
                            <input 
                                id="price"
                                type="number"
                                value={newPrice}
                                onChange={(e) => setNewPrice(parseFloat(e.target.value))}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required
                            />
                        </div>
                        <div className="flex items-center justify-end">
                            <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline">
                                Buat Paket
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {editingPackage && (
                <div className="bg-black border border-gray-800 rounded-lg p-8 mb-8">
                    <form onSubmit={handleUpdate}>
                        <h2 className="text-2xl font-bold mb-6 text-white">Edit Paket</h2>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="name">
                                Nama Paket
                            </label>
                            <input 
                                id="name"
                                type="text"
                                value={editingPackage.name}
                                onChange={(e) => setEditingPackage({...editingPackage, name: e.target.value})}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-4">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="duration">
                                Durasi (menit)
                            </label>
                            <input 
                                id="duration"
                                type="number"
                                value={editingPackage.duration_minutes}
                                onChange={(e) => setEditingPackage({...editingPackage, duration_minutes: parseInt(e.target.value)})}
                                className="bg-gray-900 border border-gray-700 rounded w-full py-2 px-3 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                                required 
                            />
                        </div>
                        <div className="mb-6">
                            <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="price">
                                Harga
                            </label>
                            <input 
                                id="price"
                                type="number"
                                value={editingPackage.price}
                                onChange={(e) => setEditingPackage({...editingPackage, price: parseFloat(e.target.value)})}
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
                            <th className="py-3 px-6 text-left">Durasi (min)</th>
                            <th className="py-3 px-6 text-right">Harga</th>
                            <th className="py-3 px-6 text-center">Aksi</th>
                        </tr>
                    </thead>
                    <tbody className="text-white text-sm font-light">
                        {packages.map(pkg => (
                            <tr key={pkg.id} className="border-b border-gray-800 hover:bg-gray-900">
                                <td className="py-3 px-6 text-left whitespace-nowrap">{pkg.id}</td>
                                <td className="py-3 px-6 text-left">{pkg.name}</td>
                                <td className="py-3 px-6 text-left">{pkg.duration_minutes}</td>
                                <td className="py-3 px-6 text-right">{new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(pkg.price)}</td>
                                <td className="py-3 px-6 text-center">
                                    <div className="flex item-center justify-center space-x-4">
                                        <button onClick={() => startEdit(pkg)} className="text-gray-400 hover:text-red-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.536L16.732 3.732z" />
                                            </svg>
                                        </button>
                                        <button onClick={() => handleDelete(pkg.id)} className="text-gray-400 hover:text-red-500">
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