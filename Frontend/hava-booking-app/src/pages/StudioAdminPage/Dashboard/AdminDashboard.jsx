import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  Activity,
  User,
  TrendingUp,
  X,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { useAuth } from "../../../context/AuthContext";
import LoadingSpinner from "../../../components/LoadingSpinner";
import DashboardLayout from "../../../components/layout/DashboardLayout";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState([]);
  const [viewingStat, setViewingStat] = useState(null);

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(
          API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation)
        );
        setPurchases(response.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user.adminStudioLocation]);

  // --- 2. Calculate Real Stats & Trends ---
  const { stats, trends, lists } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Calculate Previous Month correctly (handle Jan -> Dec wrap)
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    // --- Helper to filter data by month ---
    const getMonthData = (data, m, y) => {
      return data.filter((p) => {
        const d = new Date(p.createdAt);
        return d.getMonth() === m && d.getFullYear() === y;
      });
    };

    // 1. Split Data into Periods
    const thisMonthData = getMonthData(purchases, currentMonth, currentYear);
    const lastMonthData = getMonthData(purchases, lastMonth, lastMonthYear);

    // 2. Helper to Calculate Trend Percentage
    const calcTrend = (currentCount, prevCount) => {
      if (prevCount === 0) return currentCount > 0 ? 100 : 0; // 100% growth if started from 0
      return Math.round(((currentCount - prevCount) / prevCount) * 100);
    };

    // 3. Metric Calculations (This Month vs Last Month)

    // A. Total Transactions Volume
    const trendTotal = calcTrend(thisMonthData.length, lastMonthData.length);

    // B. Pending (Incoming Workload Trend)
    // We compare how many "Pending" items were created this month vs last month
    const thisMonthPending = thisMonthData.length; // Proxy: New requests = Pending workload
    const lastMonthPending = lastMonthData.length;
    const trendPending = calcTrend(thisMonthPending, lastMonthPending);

    // C. Confirmed (Success Rate Trend)
    // Count items that are currently confirmed/active that were purchased in specific months
    const getConfirmed = (arr) =>
      arr.filter((p) => p.status === "confirmed" || p.isActive).length;
    const trendConfirmed = calcTrend(
      getConfirmed(thisMonthData),
      getConfirmed(lastMonthData)
    );

    // 4. Global Lists for Modals
    const pendingList = purchases.filter(
      (p) => p.status === "waiting_confirmation" || p.status === "pending"
    );
    const confirmedList = purchases.filter(
      (p) => p.status === "confirmed" || p.isActive
    );
    const allList = [...purchases].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    return {
      lists: {
        all: allList,
        pending: pendingList,
        confirmed: confirmedList,
      },
      trends: {
        total: trendTotal,
        pending: trendPending,
        confirmed: trendConfirmed,
      },
      stats: {
        total: purchases.length,
        pending: pendingList.length,
        confirmed: confirmedList.length,
        revenue: purchases.reduce((acc, curr) => {
          if (
            curr.status === "pending" ||
            curr.status === "waiting_confirmation"
          ) {
            return acc;
          }
          return acc + (parseFloat(curr.totalAmount) || 0);
        }, 0),
      },
    };
  }, [purchases]);

  const formatMoney = (amount) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);

  return (
    <div>
      <DashboardLayout activeMenu='admin-dashboard' role={user?.role || ""}>
        {loading ? (
          <div className='min-h-screen rounded-2xl bg-white flex items-center justify-center font-sans'>
            <LoadingSpinner />
          </div>
        ) : (
          <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans relative'>
            <div className='mb-8'>
              <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
              <p className='text-gray-500 text-sm mt-1'>
                Welcome back, here's what's happening with your studio today.
              </p>
            </div>

            {/* --- Top Stats Cards with Real Trends --- */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
              <DashboardCard
                title='Total Transactions'
                value={stats.total}
                trend={trends.total}
                icon={Briefcase}
                color='bg-blue-600'
                iconBg='bg-blue-500/30'
                onClick={() =>
                  setViewingStat({ title: "All Transactions", data: lists.all })
                }
              />

              <DashboardCard
                title='Waiting for Confirmation'
                value={stats.pending}
                trend={trends.pending} // Uses volume trend as proxy
                icon={Clock}
                color='bg-red-600'
                iconBg='bg-red-500/30'
                onClick={() =>
                  setViewingStat({
                    title: "Pending Approvals",
                    data: lists.pending,
                  })
                }
              />

              <DashboardCard
                title='Passes Confirmed'
                value={stats.confirmed}
                trend={trends.confirmed}
                icon={CheckCircle2}
                color='bg-emerald-500'
                iconBg='bg-emerald-400/30'
                onClick={() =>
                  setViewingStat({
                    title: "Confirmed Bookings",
                    data: lists.confirmed,
                  })
                }
              />
            </div>

            {/* --- Section 2: Revenue & Recent Activity --- */}
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
              <motion.div
                whileHover={{
                  y: -4,
                  boxShadow: "0 10px 30px -10px rgba(0,0,0,0.1)",
                }}
                whileTap={{ scale: 0.98 }}
                onClick={() =>
                  setViewingStat({ title: "Revenue History", data: lists.all })
                }
                className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm cursor-pointer group h-full'>
                <div className='flex items-center gap-3 mb-4'>
                  <div className='p-2 bg-purple-50 rounded-lg text-purple-600 group-hover:bg-purple-100 transition-colors'>
                    <DollarSign className='w-6 h-6' />
                  </div>
                  <h3 className='text-lg font-bold text-gray-900'>
                    Total Revenue
                  </h3>
                </div>
                <p className='text-3xl font-bold text-gray-900 tracking-tight group-hover:text-purple-700 transition-colors'>
                  {formatMoney(stats.revenue)}
                </p>
                <p className='text-sm text-gray-400 mt-1'>
                  Gross revenue from all time
                </p>

                <div className='mt-4 flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-3 py-1 rounded-full'>
                  <TrendingUp className='w-3 h-3' /> Growing
                </div>
              </motion.div>

              {/* Right Column: Recent Activity List */}
              <div className='lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm'>
                <div className='flex justify-between items-center mb-6'>
                  <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
                    <Activity className='w-5 h-5 text-gray-400' /> Recent
                    Activity
                  </h3>
                  <button
                    onClick={() =>
                      setViewingStat({
                        title: "Recent Activity Log",
                        data: lists.all,
                      })
                    }
                    className='text-sm text-emerald-700 font-bold hover:underline'>
                    View All
                  </button>
                </div>

                <div className='overflow-hidden'>
                  <table className='w-full text-left text-sm'>
                    <thead className='bg-gray-50/50 text-gray-500 font-medium border-b border-gray-100'>
                      <tr>
                        <th className='pb-3 pl-2'>Client</th>
                        <th className='pb-3'>Package</th>
                        <th className='pb-3'>Date</th>
                        <th className='pb-3 text-right'>Amount</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-50'>
                      {purchases.slice(0, 5).map((item) => (
                        <tr
                          key={item._id}
                          className='group hover:bg-gray-50 transition-colors cursor-default'>
                          <td className='py-3 pl-2'>
                            <div className='flex items-center gap-3'>
                              <div className='w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-white group-hover:shadow-sm transition-all'>
                                {item.userId?.fullName?.charAt(0) || (
                                  <User className='w-4 h-4' />
                                )}
                              </div>
                              <span className='font-bold text-gray-900'>
                                {item.userId?.fullName || "Guest"}
                              </span>
                            </div>
                          </td>
                          <td className='py-3 text-gray-600'>
                            <span className='font-medium text-gray-900'>
                              {item.packageId?.packageName}
                            </span>
                          </td>
                          <td className='py-3 text-gray-400 text-xs'>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td className='py-3 text-right font-medium text-emerald-700'>
                            {formatMoney(item.totalAmount)}
                          </td>
                        </tr>
                      ))}
                      {purchases.length === 0 && (
                        <tr>
                          <td
                            colSpan='4'
                            className='py-8 text-center text-gray-400'>
                            No recent activity found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {viewingStat && (
                <DashboardModal
                  title={viewingStat.title}
                  data={viewingStat.data}
                  onClose={() => setViewingStat(null)}
                />
              )}
            </AnimatePresence>
          </div>
        )}
      </DashboardLayout>
    </div>
  );
};

// --- Updated Dashboard Card (Handles + or - Trends) ---
const DashboardCard = ({
  title,
  value,
  trend,
  icon: Icon,
  color,
  iconBg,
  onClick,
}) => {
  const isPositive = trend >= 0;
  const TrendIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={`${color} p-6 rounded-2xl shadow-lg shadow-gray-200/50 text-white relative overflow-hidden cursor-pointer`}>
      <div className='absolute -right-6 -top-6 w-32 h-32 bg-white opacity-10 rounded-full blur-2xl pointer-events-none'></div>
      <div className='flex justify-between items-start mb-4 relative z-10'>
        <div>
          <p className='text-white/80 text-sm font-medium mb-1'>{title}</p>
          <h2 className='text-3xl font-bold'>{value}</h2>
        </div>
        <div className={`p-3 rounded-xl ${iconBg} backdrop-blur-sm`}>
          <Icon className='w-6 h-6 text-white' />
        </div>
      </div>
      <div className='flex items-center gap-1 text-sm font-medium text-white/90 relative z-10'>
        <div
          className={`flex items-center ${
            isPositive ? "text-white" : "text-white/70"
          }`}>
          <TrendIcon className='w-4 h-4 mr-1' />
          <span>{Math.abs(trend)}%</span>
        </div>
        <span className='text-white/60 font-normal ml-1'>vs last month</span>
      </div>
    </motion.div>
  );
};

const DashboardModal = ({ title, data, onClose }) => {
  const formatMoney = (val) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className='relative bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>{title}</h3>
            <p className='text-xs text-gray-500'>
              Detailed list of records ({data.length})
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='overflow-y-auto p-0 flex-1'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-white sticky top-0 z-10 shadow-sm'>
              <tr>
                <th className='p-4 bg-gray-50 text-gray-500'>Date</th>
                <th className='p-4 bg-gray-50 text-gray-500'>Client</th>
                <th className='p-4 bg-gray-50 text-gray-500'>Package</th>
                <th className='p-4 bg-gray-50 text-gray-500'>Status</th>
                <th className='p-4 bg-gray-50 text-gray-500 text-right'>
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {data.length > 0 ? (
                data.map((item, idx) => (
                  <tr key={idx} className='hover:bg-gray-50 transition-colors'>
                    <td className='p-4 text-gray-500 whitespace-nowrap'>
                      {formatDate(item.createdAt)}
                    </td>
                    <td className='p-4 font-bold text-gray-900'>
                      {item.userId?.fullName}
                      <div className='text-xs text-gray-400 font-normal'>
                        {item.userId?.email}
                      </div>
                    </td>
                    <td className='p-4 text-gray-600'>
                      {item.packageId?.packageName}
                    </td>
                    <td className='p-4'>
                      {item.status === "confirmed" || item.isActive ? (
                        <span className='text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full'>
                          Confirmed
                        </span>
                      ) : (
                        <span className='text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full'>
                          Pending
                        </span>
                      )}
                    </td>
                    <td className='p-4 text-right font-mono font-bold text-gray-700'>
                      {formatMoney(item.totalAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan='5' className='p-8 text-center text-gray-400'>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='p-4 border-t border-gray-100 text-center'>
          <button
            onClick={onClose}
            className='px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors'>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminDashboard;
