'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import StatusBadge from '../../../../components/StatusBadge';
import ErrorMessage from '../../../../components/ErrorMessage';
import { LoadingSkeleton } from '../../../../components/LoadingSkeleton';

interface MemberPackage {
  id: number;
  name: string;
  remaining_minutes: number;
  purchase_date: string;
  duration_minutes: number;
}

interface Transaction {
  id: number;
  amount: number;
  type: string;
  status: string;
  created_at: string;
  package_name?: string;
}

interface Member {
  id: number;
  name: string;
  phone_number: string;
  created_at: string;
  status?: string;
  total_sessions?: number;
  total_spent?: number;
  last_activity?: string;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.memberId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  useEffect(() => {
    if (!memberId) return;
    fetchAllData();
  }, [memberId]);

  const fetchMemberDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/members/${memberId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch member details');
      const data = await res.json();
      setMember(data.data);
      setEditName(data.data.name);
      setEditPhone(data.data.phone_number);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchMemberPackages = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/members/${memberId}/packages`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch member packages');
      const data = await res.json();
      setPackages(data.data);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/members/${memberId}/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to fetch transactions');
      const data = await res.json();
      setTransactions(data.data || []);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([
        fetchMemberDetails(),
        fetchMemberPackages(),
        fetchTransactions()
      ]);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) {
      setError('Nama tidak boleh kosong');
      return;
    }

    setSaveLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:3001/api/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName.trim(),
          phone_number: editPhone.trim()
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Failed to update member');
      }

      // Refresh member data
      await fetchMemberDetails();
      setIsEditing(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancelEdit = () => {
    if (member) {
      setEditName(member.name);
      setEditPhone(member.phone_number);
    }
    setIsEditing(false);
    setError('');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR'
    }).format(amount);
  };

  const getMembershipDuration = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      return `${diffDays} hari`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return `${months} bulan`;
    } else {
      const years = Math.floor(diffDays / 365);
      return `${years} tahun`;
    }
  };

  if (loading) return (
    <div className="container mx-auto p-6 bg-gray-900 min-h-screen" suppressHydrationWarning={true}>
      <div className="mb-6" suppressHydrationWarning={true}>
        <Link href="/management/members" className="text-blue-400 hover:text-blue-300 flex items-center space-x-2">
          <span>←</span>
          <span>Kembali ke Daftar Member</span>
        </Link>
      </div>
      <LoadingSkeleton rows={8} type="card" />
    </div>
  );

  if (error) return (
    <div className="container mx-auto p-6 bg-gray-900 min-h-screen">
      <div className="mb-6">
        <Link href="/management/members" className="text-blue-400 hover:text-blue-300 flex items-center space-x-2">
          <span>←</span>
          <span>Kembali ke Daftar Member</span>
        </Link>
      </div>
      <ErrorMessage message={error} type="error" onClose={() => setError('')} />
    </div>
  );

  if (!member) return (
    <div className="container mx-auto p-6 bg-gray-900 min-h-screen">
      <div className="mb-6">
        <Link href="/management/members" className="text-blue-400 hover:text-blue-300 flex items-center space-x-2">
          <span>←</span>
          <span>Kembali ke Daftar Member</span>
        </Link>
      </div>
      <div className="text-center text-gray-400">Member tidak ditemukan</div>
    </div>
  );

  return (
    <div className="container mx-auto p-6 bg-gray-900 min-h-screen text-white">
      {/* Navigation */}
      <div className="mb-6">
        <Link href="/management/members" className="text-blue-400 hover:text-blue-300 flex items-center space-x-2 transition-colors">
          <span>←</span>
          <span>Kembali ke Daftar Member</span>
        </Link>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Detail Member</h1>
        <p className="text-gray-400">Informasi lengkap dan manajemen member</p>
      </div>

      {error && (
        <ErrorMessage
          message={error}
          type="error"
          onClose={() => setError('')}
          className="mb-6"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Member Information */}
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Informasi Member</h2>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
              >
                Edit
              </button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleSaveMember} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-2">
                  Nama Member
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-2">
                  Nomor Telepon
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  {saveLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded transition-colors"
                >
                  Batal
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-1">Nama</label>
                <p className="text-white text-lg">{member.name}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-1">Nomor Telepon</label>
                <p className="text-white text-lg">{member.phone_number}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-1">Tanggal Daftar</label>
                <p className="text-white">{formatDate(member.created_at)}</p>
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-bold mb-1">Status</label>
                <StatusBadge status={member.status || 'tidak aktif'} size="sm" />
              </div>
            </div>
          )}
        </div>

        {/* Member Statistics */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-6">Statistik Member</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Sesi</p>
              <p className="text-white text-2xl font-bold">{member.total_sessions || 0}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Total Spending</p>
              <p className="text-white text-2xl font-bold">{formatCurrency(member.total_spent || 0)}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Member Sejak</p>
              <p className="text-white text-lg font-bold">{getMembershipDuration(member.created_at)}</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <p className="text-gray-400 text-sm">Aktivitas Terakhir</p>
              <p className="text-white text-sm">{member.last_activity ? formatDate(member.last_activity) : 'Belum ada'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Packages Section */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Paket Tersedia</h2>
          <Link href="/management/members" className="text-blue-400 hover:text-blue-300 text-sm">
            Tambah paket dari halaman daftar member
          </Link>
        </div>

        {packages.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {packages.map((pkg) => (
              <div key={pkg.id} className="bg-gray-700 rounded-lg p-4">
                <h3 className="text-white font-bold text-lg mb-2">{pkg.name}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sisa Menit:</span>
                    <span className={`font-bold ${pkg.remaining_minutes > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pkg.remaining_minutes > 0 ? `${pkg.remaining_minutes} menit` : 'Habis'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tanggal Beli:</span>
                    <span className="text-white">{formatDate(pkg.purchase_date)}</span>
                  </div>
                  <div className="w-full bg-gray-600 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${pkg.remaining_minutes > 0 ? 'bg-green-500' : 'bg-red-500'}`}
                      style={{
                        width: `${Math.max(0, (pkg.remaining_minutes / pkg.duration_minutes) * 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">Member ini belum memiliki paket</p>
            <Link
              href="/management/members"
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded transition-colors"
            >
              Tambah Paket
            </Link>
          </div>
        )}
      </div>

      {/* Transactions History */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">History Transaksi</h2>

        {transactions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 py-3">Tanggal</th>
                  <th className="text-left text-gray-400 py-3">Tipe</th>
                  <th className="text-left text-gray-400 py-3">Paket</th>
                  <th className="text-left text-gray-400 py-3">Jumlah</th>
                  <th className="text-left text-gray-400 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-700">
                    <td className="py-3 text-white">{formatDate(transaction.created_at)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === 'package_purchase'
                          ? 'bg-purple-900 text-purple-300'
                          : 'bg-blue-900 text-blue-300'
                      }`}>
                        {transaction.type === 'package_purchase' ? 'Pembelian Paket' : transaction.type}
                      </span>
                    </td>
                    <td className="py-3 text-white">{transaction.package_name || '-'}</td>
                    <td className="py-3 text-white font-bold">{formatCurrency(transaction.amount)}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.status === 'paid'
                          ? 'bg-green-900 text-green-300'
                          : transaction.status === 'pending'
                          ? 'bg-yellow-900 text-yellow-300'
                          : 'bg-red-900 text-red-300'
                      }`}>
                        {transaction.status === 'paid' ? 'Lunas' :
                         transaction.status === 'pending' ? 'Pending' : 'Gagal'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-400">Belum ada transaksi</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/management/members"
            className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">💎</div>
            <div className="font-bold">Tambah Paket</div>
            <div className="text-sm text-purple-200">Beli paket baru untuk member</div>
          </Link>

          <button className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-lg text-center transition-colors">
            <div className="text-2xl mb-2">🎮</div>
            <div className="font-bold">Start Gaming</div>
            <div className="text-sm text-green-200">Mulai sesi gaming</div>
          </button>

          <Link
            href="/management/members"
            className="bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg text-center transition-colors"
          >
            <div className="text-2xl mb-2">📊</div>
            <div className="font-bold">Lihat Laporan</div>
            <div className="text-sm text-blue-200">Detail aktivitas member</div>
          </Link>
        </div>
      </div>
    </div>
  );
}