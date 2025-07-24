'use client';

import { useState, useEffect } from 'react';


// Define the Transaction type
interface Transaction {
  id: number;
  type: 'session_regular' | 'session_member' | 'package_purchase';
  amount: number;
  created_at: string;
  tv_name?: string;
  member_name?: string;
  package_name?: string;
  duration_minutes?: number;
}

const TransactionsPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  useEffect(() => {
    const fetchTransactions = async () => {
      try {
                const res = await fetch('http://localhost:3001/api/transactions');

        if (!res.ok) {
                    throw new Error('Gagal mengambil data transaksi');
        }

        const data = await res.json();
        setTransactions(data.data);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
                    setError('Terjadi kesalahan yang tidak diketahui');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  const formatType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(amount);
  };

  if (loading) return <div className="text-center p-8 text-white">Memuat transaksi...</div>;
  if (error) return <div className="text-center p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-white mb-8">Laporan Keuangan</h1>
      <div className="bg-black border border-gray-800 rounded-lg overflow-x-auto">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="bg-gray-900">
              <th className="px-5 py-3 border-b-2 border-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tanggal</th>
              <th className="px-5 py-3 border-b-2 border-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tipe</th>
              <th className="px-5 py-3 border-b-2 border-gray-800 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Detail</th>
              <th className="px-5 py-3 border-b-2 border-gray-800 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Jumlah</th>
            </tr>
          </thead>
          <tbody className="text-white">
            {transactions.map((tx) => (
              <tr key={tx.id} className="hover:bg-gray-900">
                <td className="px-5 py-4 border-b border-gray-800 text-sm">
                  {new Date(tx.created_at).toLocaleString('id-ID')}
                </td>
                <td className="px-5 py-4 border-b border-gray-800 text-sm">
                  <span className="relative inline-block px-3 py-1 font-semibold leading-tight">
                    <span aria-hidden className={`absolute inset-0 ${tx.type.includes('session') ? 'bg-red-900' : 'bg-blue-900'} opacity-50 rounded-full`}></span>
                    <span className="relative text-xs text-gray-300">{formatType(tx.type)}</span>
                  </span>
                </td>
                <td className="px-5 py-4 border-b border-gray-800 text-sm">
                    {tx.tv_name && <p>TV: <strong className="text-red-400">{tx.tv_name}</strong></p>}
                    {tx.member_name && <p>Anggota: <strong className="text-red-400">{tx.member_name}</strong></p>}
                    {tx.package_name && <p>Paket: <strong className="text-red-400">{tx.package_name}</strong></p>}
                    {tx.duration_minutes && <p>Durasi: <strong>{tx.duration_minutes} menit</strong></p>}
                </td>
                <td className="px-5 py-4 border-b border-gray-800 text-sm text-right font-semibold">
                  {formatCurrency(tx.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TransactionsPage;