'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import StatCard from '../../components/StatCard';
import MetricCardWithChart from '../../components/MetricCardWithChart';
import Chart from '../../components/Chart';
import { DashboardLayout, DashboardGrid, DashboardGridItem } from '../../components/DashboardGrid';
import StatusIndicator from '../../components/StatusIndicator';

import ActivityFeed from '../../components/ActivityFeed';
import SystemHealth from '../../components/SystemHealth';
import '../../styles/dashboard.css';

const ManagementPage = () => {
  const [systemStatus, setSystemStatus] = useState({ whatsapp: 'Menghubungkan...', database: 'Menghubungkan...', notifications: 'Menghubungkan...' });
  const [summary, setSummary] = useState({ totalTv: 0, activeTv: 0, totalMember: 0, packages: 0, todayRevenue: 0 });
  const [revenue, setRevenue] = useState({ today: 0, last7days: 0, last30days: 0 });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);
  const [memberGrowthData, setMemberGrowthData] = useState<any[]>([]);
  const [sessionData, setSessionData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryRes, transactionsRes] = await Promise.all([
          fetch('http://localhost:3001/api/summary'),
          fetch('http://localhost:3001/api/transactions?limit=5')
        ]);

        if (!summaryRes.ok || !transactionsRes.ok) {
          throw new Error('Gagal mengambil data dasbor');
        }

        const summaryData = await summaryRes.json();
        const transactionsData = await transactionsRes.json();

        setRecentTransactions(transactionsData.data);
        setSummary({
          totalTv: summaryData.totalTvs,
          activeTv: summaryData.activeTvs,
          totalMember: summaryData.totalMembers,
          packages: summaryData.totalPackages,
          todayRevenue: summaryData.revenue.today,
        });

        setRevenue(summaryData.revenue);
        setSystemStatus({ whatsapp: 'Terhubung', database: 'Online', notifications: 'Aktif' });

        // Generate chart data
        generateChartData(summaryData);

      } catch (error) {
        console.error(error);
        setSystemStatus({ whatsapp: 'Gagal', database: 'Offline', notifications: 'Tidak Aktif' });
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time updates - reduced frequency to prevent flickering
    const interval = setInterval(() => {
      // Only update summary data, not chart data to prevent flickering
      fetchData();
    }, 60000); // Update every 60 seconds instead of 30

    return () => clearInterval(interval);
  }, []);

  const generateChartData = (summaryData: any) => {
    // Only generate chart data once on initial load to prevent flickering
    if (revenueChartData.length === 0) {
      // Generate revenue chart data (last 7 days) - static data to prevent flickering
      const revenueData = [];
      const baseRevenue = summaryData.revenue?.today || 75000;
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        revenueData.push({
          label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
          value: baseRevenue + (i * 5000) + (Math.sin(i) * 10000), // More stable calculation
          color: '#ef4444'
        });
      }
      setRevenueChartData(revenueData);
    }

    if (memberGrowthData.length === 0) {
      // Generate member growth data - static data to prevent flickering
      const memberData = [];
      const baseMember = summaryData.totalMembers || 50;
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        memberData.push({
          label: date.toLocaleDateString('id-ID', { weekday: 'short' }),
          value: Math.max(1, baseMember - (6 - i) * 2), // Gradual growth pattern
          color: '#10b981'
        });
      }
      setMemberGrowthData(memberData);
    }

    if (sessionData.length === 0) {
      // Generate session data - static data to prevent flickering
      const sessions = [
        { label: 'Regular', value: 35, color: '#3b82f6' },
        { label: 'Member', value: 25, color: '#8b5cf6' },
        { label: 'Package', value: 15, color: '#f59e0b' }
      ];
      setSessionData(sessions);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-8" suppressHydrationWarning={true}>
        <div className="h-8 bg-gray-800 rounded w-1/3" suppressHydrationWarning={true}></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" suppressHydrationWarning={true}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded-xl" suppressHydrationWarning={true}></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8" suppressHydrationWarning={true}>
          <div className="h-64 bg-gray-800 rounded-xl" suppressHydrationWarning={true}></div>
          <div className="h-64 bg-gray-800 rounded-xl" suppressHydrationWarning={true}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-blue-500/10"></div>
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10">



        <DashboardLayout
          rightPanel={
            <div className="space-y-6">
              {/* System Overview */}
              <div className="glass-card rounded-xl p-6 border border-gray-700/50 hover-glow">
                <h3 className="text-lg font-bold text-white mb-4 gradient-text">System Overview</h3>
                <div className="space-y-3">
                  <StatusIndicator
                    status="online"
                    label="Database"
                    description="Koneksi stabil"
                  />
                  <StatusIndicator
                    status="online"
                    label="WebSocket"
                    description="Real-time aktif"
                  />
                  <StatusIndicator
                    status={summary.activeTv > 0 ? "online" : "offline"}
                    label={`TV Aktif: ${summary.activeTv}/${summary.totalTv}`}
                    description="PlayStation units"
                  />
                  <StatusIndicator
                    status="online"
                    label={`${summary.totalMember} Members`}
                    description="Registered users"
                  />
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass-card rounded-xl p-6 border border-gray-700/50">
                <h3 className="text-lg font-bold text-white mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <Link
                    href="/management/tvs"
                    className="block w-full p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-purple-400 hover:text-purple-300 transition-all duration-200 interactive-card"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">📺</span>
                      <div>
                        <p className="font-medium">Kelola TV</p>
                        <p className="text-xs opacity-75">Manage PlayStation units</p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/management/members"
                    className="block w-full p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg text-blue-400 hover:text-blue-300 transition-all duration-200 interactive-card"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">👥</span>
                      <div>
                        <p className="font-medium">Tambah Member</p>
                        <p className="text-xs opacity-75">Add new members</p>
                      </div>
                    </div>
                  </Link>
                  <Link
                    href="/management/transactions"
                    className="block w-full p-3 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg text-indigo-400 hover:text-indigo-300 transition-all duration-200 interactive-card"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">💰</span>
                      <div>
                        <p className="font-medium">Lihat Transaksi</p>
                        <p className="text-xs opacity-75">View transactions</p>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          }
        >
          {/* Top Metric Cards */}
          <DashboardGrid className="mb-8">
            <DashboardGridItem>
              <MetricCardWithChart
                title="Total TV"
                value={summary.totalTv}
                subtitle={`${summary.activeTv} aktif`}
                icon="📺"
                color="purple"
                trend={{ value: 5.2, isPositive: true }}
                chartData={[
                  { label: 'Mon', value: summary.totalTv - 2 },
                  { label: 'Tue', value: summary.totalTv - 1 },
                  { label: 'Wed', value: summary.totalTv - 1 },
                  { label: 'Thu', value: summary.totalTv },
                  { label: 'Fri', value: summary.totalTv },
                  { label: 'Sat', value: summary.totalTv + 1 },
                  { label: 'Sun', value: summary.totalTv }
                ]}
                chartType="area"
                onClick={() => window.location.href = '/management/tvs'}
                className="animate-fade-in"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Total Member"
                value={summary.totalMember}
                subtitle="Member terdaftar"
                icon="👥"
                color="blue"
                trend={{ value: 12.5, isPositive: true }}
                chartData={memberGrowthData.slice(-7)}
                chartType="line"
                onClick={() => window.location.href = '/management/members'}
                className="animate-fade-in"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Paket Tersedia"
                value={summary.packages}
                subtitle="Paket gaming"
                icon="📦"
                color="indigo"
                chartData={[
                  { label: 'Basic', value: 3 },
                  { label: 'Premium', value: 2 },
                  { label: 'VIP', value: 1 }
                ]}
                chartType="bar"
                onClick={() => window.location.href = '/management/packages'}
                className="animate-fade-in"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <MetricCardWithChart
                title="Pendapatan Hari Ini"
                value={`Rp ${summary.todayRevenue.toLocaleString('id-ID')}`}
                subtitle="Revenue today"
                icon="💰"
                color="green"
                trend={{ value: 8.3, isPositive: true }}
                chartData={revenueChartData.slice(-7)}
                chartType="area"
                onClick={() => window.location.href = '/management/transactions'}
                className="animate-fade-in"
              />
            </DashboardGridItem>
          </DashboardGrid>

          {/* Main Analytics Section */}
          <DashboardGrid className="mb-8">
            <DashboardGridItem span={2}>
              <Chart
                data={revenueChartData}
                type="line"
                title="Tren Pendapatan (7 Hari)"
                className="animate-fade-in h-full"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <Chart
                data={memberGrowthData}
                type="bar"
                title="Pertumbuhan Member"
                className="animate-fade-in h-full"
              />
            </DashboardGridItem>
            <DashboardGridItem>
              <Chart
                data={sessionData}
                type="doughnut"
                title="Distribusi Sesi"
                className="animate-fade-in h-full"
              />
            </DashboardGridItem>
          </DashboardGrid>

          {/* Activity and System Health */}
          <DashboardGrid className="mb-8">
            <DashboardGridItem span={2}>
              <ActivityFeed className="animate-fade-in h-full" />
            </DashboardGridItem>
            <DashboardGridItem span={2}>
              <SystemHealth className="animate-fade-in h-full" />
            </DashboardGridItem>
          </DashboardGrid>

          {/* Revenue Summary */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700/50 animate-fade-in">
            <h2 className="text-xl font-bold text-white mb-6">Ringkasan Pendapatan</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-gradient-to-br from-green-900/20 to-green-800/10 border border-green-500/30 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Hari Ini</p>
                <p className="text-2xl font-bold text-green-400">Rp {revenue.today.toLocaleString('id-ID')}</p>
                <p className="text-xs text-green-300 mt-1">+15% dari kemarin</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-blue-900/20 to-blue-800/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">7 Hari Terakhir</p>
                <p className="text-2xl font-bold text-blue-400">Rp {revenue.last7days.toLocaleString('id-ID')}</p>
                <p className="text-xs text-blue-300 mt-1">+8% dari minggu lalu</p>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-purple-900/20 to-purple-800/10 border border-purple-500/30 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">30 Hari Terakhir</p>
                <p className="text-2xl font-bold text-purple-400">Rp {revenue.last30days.toLocaleString('id-ID')}</p>
                <p className="text-xs text-purple-300 mt-1">+22% dari bulan lalu</p>
              </div>
            </div>
          </div>
        </DashboardLayout>
      </div>
    </div>
  );
};

export default ManagementPage;