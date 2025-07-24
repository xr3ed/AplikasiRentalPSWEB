'use client';

import { useState, useEffect } from 'react';
import ErrorMessage from './ErrorMessage';

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
}

interface AddPackageModalProps {
    isOpen: boolean;
    onClose: () => void;
    member: Member | null;
    onSuccess: () => void;
}

export const AddPackageModal = ({ isOpen, onClose, member, onSuccess }: AddPackageModalProps) => {
    const [packages, setPackages] = useState<Package[]>([]);
    const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [packagesLoading, setPackagesLoading] = useState(true);

    // Fetch packages when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchPackages();
        }
    }, [isOpen]);

    const fetchPackages = async () => {
        try {
            setPackagesLoading(true);
            const token = localStorage.getItem('token');
            const res = await fetch('http://localhost:3001/api/packages', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const result = await res.json();
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

    const selectedPackage = packages.find(p => p.id === selectedPackageId);
    const totalAmount = selectedPackage ? selectedPackage.price * quantity : 0;
    const totalMinutes = selectedPackage ? selectedPackage.duration_minutes * quantity : 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPackageId || !member) return;

        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            
            // Add package to member
            const res = await fetch('http://localhost:3001/api/member-packages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    member_id: member.id,
                    package_id: selectedPackageId,
                    quantity: quantity,
                    total_amount: totalAmount
                }),
            });

            if (res.ok) {
                onSuccess();
                onClose();
                // Reset form
                setSelectedPackageId(null);
                setQuantity(1);
            } else {
                const result = await res.json();
                setError(result.message || 'Gagal menambahkan paket');
            }
        } catch (err) {
            setError('Terjadi kesalahan saat menambahkan paket');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedPackageId(null);
        setQuantity(1);
        setError('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-white">💎 Tambah Paket Member</h2>
                    <button
                        onClick={handleClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {member && (
                    <div className="mb-4 p-3 bg-gray-700 rounded-lg">
                        <p className="text-white font-semibold">{member.name}</p>
                        <p className="text-gray-400 text-sm">{member.phone_number}</p>
                    </div>
                )}

                {error && (
                    <ErrorMessage 
                        message={error} 
                        type="error" 
                        onClose={() => setError('')}
                        className="mb-4"
                    />
                )}

                <form onSubmit={handleSubmit}>
                    {/* Package Selection */}
                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm font-bold mb-2">
                            Pilih Paket
                        </label>
                        {packagesLoading ? (
                            <div className="bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-gray-400">
                                Memuat paket...
                            </div>
                        ) : (
                            <select
                                value={selectedPackageId || ''}
                                onChange={(e) => setSelectedPackageId(Number(e.target.value))}
                                className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                required
                            >
                                <option value="">Pilih paket...</option>
                                {packages.map(pkg => (
                                    <option key={pkg.id} value={pkg.id}>
                                        {pkg.name} - Rp {pkg.price.toLocaleString('id-ID')} ({pkg.duration_minutes} menit)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Quantity */}
                    <div className="mb-4">
                        <label className="block text-gray-400 text-sm font-bold mb-2">
                            Jumlah
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="10"
                            value={quantity}
                            onChange={(e) => setQuantity(Number(e.target.value))}
                            className="w-full bg-gray-900 border border-gray-700 rounded-lg py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                        />
                    </div>

                    {/* Summary */}
                    {selectedPackage && (
                        <div className="mb-6 p-3 bg-gray-700 rounded-lg">
                            <h3 className="text-white font-semibold mb-2">Ringkasan:</h3>
                            <div className="text-sm text-gray-300 space-y-1">
                                <p>Paket: {selectedPackage.name}</p>
                                <p>Jumlah: {quantity}x</p>
                                <p>Total Durasi: {totalMinutes} menit</p>
                                <p className="font-bold text-white">Total Harga: Rp {totalAmount.toLocaleString('id-ID')}</p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex space-x-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedPackageId}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
                        >
                            {loading ? 'Memproses...' : 'Tambah Paket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddPackageModal;
