'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface MemberPackage {
  id: number;
  name: string;
  remaining_minutes: number;
  purchase_date: string;
}

interface Package {
    id: number;
    name: string;
    duration_minutes: number;
    price: number;
}

interface Member {
    id: number;
    name: string;
    phone_number: string;
}

export default function MemberDetailPage() {
  const params = useParams();
  const memberId = params.memberId as string;

  const [member, setMember] = useState<Member | null>(null);
  const [packages, setPackages] = useState<MemberPackage[]>([]);
  const [availablePackages, setAvailablePackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => {
    if (!memberId) return;

    const fetchMemberDetails = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/members`);
            if (!res.ok) throw new Error('Failed to fetch members');
            const allMembers = await res.json();
            const currentMember = allMembers.data.find((m: Member) => m.id.toString() === memberId);
            setMember(currentMember);
        } catch (e: any) {
            setError(e.message);
        }
    };

    const fetchMemberPackages = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/members/${memberId}/packages`);
        if (!res.ok) throw new Error('Failed to fetch member packages');
        const data = await res.json();
        setPackages(data.data);
      } catch (e: any) {
        setError(e.message);
      }
    };

    const fetchAvailablePackages = async () => {
        try {
            const res = await fetch(`${apiBaseUrl}/packages`);
            if (!res.ok) throw new Error('Failed to fetch available packages');
            const data = await res.json();
            setAvailablePackages(data.data);
        } catch (e: any) {
            setError(e.message);
        }
    };

    constfetchAllData = async () => {
        setLoading(true);
        await Promise.all([
            fetchMemberDetails(),
            fetchMemberPackages(),
            fetchAvailablePackages()
        ]);
        setLoading(false);
    }

    fetchAllData();
  }, [memberId, apiBaseUrl]);

  const handleAddPackage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackage) return;

    try {
      const res = await fetch(`${apiBaseUrl}/members/${memberId}/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: parseInt(selectedPackage, 10) }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to add package');
      }

      // Refresh packages list
      const updatedPackagesRes = await fetch(`${apiBaseUrl}/members/${memberId}/packages`);
      const updatedData = await updatedPackagesRes.json();
      setPackages(updatedData.data);
      setSelectedPackage('');

    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) return <p className="text-center text-gray-400">Loading...</p>;
  if (error) return <p className="text-center text-red-500">Error: {error}</p>;
  if (!member) return <p className="text-center text-gray-400">Member not found.</p>

  return (
    <div className="container mx-auto p-4 bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4 text-red-500">Manage Packages for {member.name}</h1>
      <p className="mb-6 text-gray-400">Phone: {member.phone_number}</p>

      <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
        <h2 className="text-2xl font-semibold mb-4">Add New Package</h2>
        <form onSubmit={handleAddPackage} className="flex items-center space-x-4">
          <select
            value={selectedPackage}
            onChange={(e) => setSelectedPackage(e.target.value)}
            className="bg-gray-700 text-white p-2 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="" disabled>Select a package</option>
            {availablePackages.map((pkg) => (
              <option key={pkg.id} value={pkg.id}>
                {pkg.name} ({pkg.duration_minutes} mins) - Rp{pkg.price}
              </option>
            ))}
          </select>
          <button 
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-md transition duration-300"
          >
            Add Package
          </button>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Owned Packages</h2>
        {packages.length > 0 ? (
          <ul className="space-y-4">
            {packages.map((pkg) => (
              <li key={pkg.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center shadow-md">
                <div>
                  <p className="font-bold text-lg">{pkg.name}</p>
                  <p className="text-sm text-gray-400">
                    Remaining: {pkg.remaining_minutes} minutes
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Purchased on: {new Date(pkg.purchase_date).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">This member does not own any packages yet.</p>
        )}
      </div>
    </div>
  );
}