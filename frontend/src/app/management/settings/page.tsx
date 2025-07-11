import React from 'react';
import Link from 'next/link';

const SettingsPage = () => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pengaturan</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/management/packages" className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors">
          <h2 className="text-xl font-semibold">Manajemen Paket</h2>
          <p className="text-gray-400">Atur paket rental yang tersedia.</p>
        </Link>
        <Link href="/management/tvs" className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors">
          <h2 className="text-xl font-semibold">Manajemen TV</h2>
          <p className="text-gray-400">Kelola daftar TV yang terhubung.</p>
        </Link>
        <Link href="/management/members" className="bg-gray-800 p-4 rounded-lg hover:bg-gray-700 transition-colors">
          <h2 className="text-xl font-semibold">Manajemen Member</h2>
          <p className="text-gray-400">Lihat dan kelola data member.</p>
        </Link>
      </div>
    </div>
  );
};

export default SettingsPage;