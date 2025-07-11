'use client';

import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

export default function PairTvPage() {
    const searchParams = useSearchParams();
    const tvId = searchParams.get('tvId');
    const [clientName, setClientName] = useState('');
    const [pairedTvName, setPairedTvName] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handlePairing = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setMessage('');

        if (!tvId) {
            setError('TV ID is missing from the URL.');
            return;
        }

        if (!clientName) {
            setError('Please enter a name for the TV.');
            return;
        }

        try {
            const res = await fetch('/api/tvs/pair', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tvId, clientName }),
            });

            const data = await res.json();

            if (res.ok) {
                setPairedTvName(clientName);
                setMessage('TV paired successfully!');
                setClientName('');
            } else {
                setError(data.error || 'Failed to pair TV.');
            }
        } catch (err) {
            setError('An error occurred while pairing the TV.');
        }
    };

    if (message) {
        return (
            <div className="min-h-screen bg-black flex flex-col items-center justify-center text-center p-4">
                <h1 className="text-3xl font-bold text-green-500 mb-4">Pairing Berhasil!</h1>
                <p className="text-gray-400 mb-8">TV dengan nama "{pairedTvName}" telah berhasil dipasangkan. Halaman ini sekarang dapat ditutup.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white">Pairing TV Baru</h1>
                    <p className="text-gray-500 mt-2">Silakan masukkan nama untuk TV yang akan dipasangkan.</p>
                </div>

                <form onSubmit={handlePairing} className="bg-gray-900 border border-gray-800 rounded-lg p-8">
                    <div className="mb-6">
                        <label className="block text-gray-400 text-sm font-bold mb-2" htmlFor="clientName">
                            Nama TV
                        </label>
                        <input
                            id="clientName"
                            type="text"
                            value={clientName}
                            onChange={(e) => setClientName(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded w-full py-3 px-4 text-white leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            placeholder=""
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-300"
                    >
                        Pasangkan TV
                    </button>
                </form>

                {error && <p className="text-red-500 text-center mt-6">{error}</p>}
            </div>
        </div>
    );
}