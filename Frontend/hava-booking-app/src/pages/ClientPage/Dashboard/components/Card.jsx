import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  CreditCard,
  Activity,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import axiosInstance from "../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { API_PATHS } from "../../../../utils/apiPath";

const Card = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // State
  const [stats, setStats] = useState({
    credits: 0,
    upcomingCount: 0,
    totalBookings: 0,
  });
  const [nextClass, setNextClass] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Bookings
        const bookingRes = await axiosInstance.get(API_PATHS.BOOKING.GET_ALL);
        const allBookings = bookingRes.data;

        const now = new Date();
        const upcoming = allBookings
          .filter(
            (b) =>
              new Date(b.classId.startTime) > now && b.status !== "Cancelled"
          )
          .sort(
            (a, b) =>
              new Date(a.classId.startTime) - new Date(b.classId.startTime)
          );

        const totalSession = allBookings.filter(
          (b) => b.status !== "Cancelled"
        );

        // 2. Fetch Passes
        const passRes = await axiosInstance.get(
          API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id)
        );
        const passes = passRes.data;
        const totalCredits = passes.reduce(
          (sum, p) => sum + p.remainingCredits,
          0
        );

        // 3. Set State
        setStats({
          credits: totalCredits,
          upcomingCount: upcoming.length,
          totalBookings: totalSession.length,
        });

        setNextClass(upcoming.length > 0 ? upcoming[0] : null);

        // Sort activity by created date (newest first)
        const sortedActivity = [...allBookings].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        setRecentActivity(sortedActivity.slice(0, 4)); // Show top 4
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user._id]);

  if (loading)
    return (
      <div className='h-screen flex items-center justify-center bg-gray-50'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='p-6 md:p-10 bg-[#FAFAFA] min-h-screen font-sans'>
      {/* --- HEADER --- */}
      <div className='mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
            Welcome, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className='text-gray-500 mt-2 text-base'>
            You have{" "}
            <span className='font-bold text-gray-900'>
              {stats.credits} credits
            </span>{" "}
            available. Ready to move?
          </p>
        </div>
        <button
          onClick={() => navigate("/book-class")}
          className='flex items-center gap-2 bg-[#0f392b] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-900/10 active:scale-95 group'>
          <Plus className='w-5 h-5' />
          <span>Book New Class</span>
        </button>
      </div>

      {/* --- STATS ROW --- */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-10'>
        <StatCard
          icon={<CreditCard className='w-5 h-5 text-blue-600' />}
          bg='bg-blue-50'
          label='Active Credits'
          value={stats.credits}
          delay={0}
        />
        <StatCard
          icon={<Calendar className='w-5 h-5 text-emerald-600' />}
          bg='bg-emerald-50'
          label='Upcoming Classes'
          value={stats.upcomingCount}
          delay={0.1}
        />
        <StatCard
          icon={<Activity className='w-5 h-5 text-purple-600' />}
          bg='bg-purple-50'
          label='Total Sessions'
          value={stats.totalBookings}
          delay={0.2}
        />
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* LEFT COL: Next Session & Banner */}
        <div className='lg:col-span-2 space-y-8'>
          {/* Section Title */}
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-bold text-gray-900'>Your Schedule</h2>
            <button
              onClick={() => navigate("/manage-bookings")}
              className='text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1'>
              View Calendar <ChevronRight className='w-4 h-4' />
            </button>
          </div>

          {nextClass ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className='bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden relative group'>
              {/* Decorative Accent */}
              <div className='absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-500 to-[#0f392b]' />

              <div className='p-8'>
                <div className='flex items-start justify-between mb-6'>
                  <div className='flex gap-2 items-center'>
                    <span className='flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse'></span>
                    <span className='text-xs font-bold text-emerald-600 uppercase tracking-wider'>
                      Up Next
                    </span>
                  </div>
                  {/* Status Badge */}
                  <span
                    className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      nextClass.status === "Confirmed"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-gray-100 text-gray-600"
                    }`}>
                    {nextClass.status || "Confirmed"}
                  </span>
                </div>

                <div className='flex flex-col md:flex-row gap-8 items-start md:items-center'>
                  {/* Date Box */}
                  <div className='bg-gray-50 rounded-2xl p-5 min-w-[110px] text-center border border-gray-100'>
                    <span className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                      {format(new Date(nextClass.classId.startTime), "MMMM")}
                    </span>
                    <span className='block text-4xl font-bold text-gray-900 leading-none mb-1'>
                      {format(new Date(nextClass.classId.startTime), "dd")}
                    </span>
                    <span className='block text-sm font-medium text-gray-500'>
                      {format(new Date(nextClass.classId.startTime), "EEEE")}
                    </span>
                  </div>

                  {/* Details */}
                  <div className='flex-1 space-y-3'>
                    <h3 className='text-2xl font-bold text-gray-900 leading-tight'>
                      {nextClass.classId.className}
                    </h3>

                    <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600'>
                      <div className='flex items-center gap-2'>
                        <Clock className='w-4 h-4 text-emerald-600' />
                        {format(
                          new Date(nextClass.classId.startTime),
                          "h:mm a"
                        )}{" "}
                        -{" "}
                        {format(new Date(nextClass.classId.endTime), "h:mm a")}
                      </div>
                      <div className='flex items-center gap-2'>
                        <MapPin className='w-4 h-4 text-emerald-600' />
                        {nextClass.studioId?.studioName}
                      </div>
                    </div>

                    {/* Instructor */}
                    <div className='flex items-center gap-2 pt-1'>
                      <div className='w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500'>
                        {nextClass.instructorId?.fullName?.charAt(0) || "I"}
                      </div>
                      <span className='text-sm font-medium text-gray-700'>
                        {nextClass.instructorId?.fullName || "Instructor"}
                      </span>
                    </div>
                  </div>

                  {/* Action */}
                  <button
                    onClick={() => navigate("/manage-bookings")}
                    className='w-full md:w-auto px-6 py-3 bg-white border border-gray-200 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm'>
                    Manage
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            // --- EMPTY STATE BANNER ---
            <div className='bg-gradient-to-br from-[#0f392b] to-emerald-900 rounded-[2rem] p-10 text-white relative overflow-hidden shadow-lg'>
              <div className='relative z-10 max-w-lg'>
                <h2 className='text-3xl font-bold mb-3'>Start your journey</h2>
                <p className='text-emerald-100 mb-8 text-base opacity-90 leading-relaxed max-w-sm'>
                  You have {stats.credits} credits ready to use. Browse our
                  schedule and book your next session today.
                </p>
                <button
                  className='bg-white text-emerald-900 px-8 py-3.5 rounded-xl font-bold hover:bg-emerald-50 transition-all shadow-lg flex items-center gap-2 group'
                  onClick={() => navigate("/book-class")}>
                  Find a Class{" "}
                  <ArrowRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
                </button>
              </div>

              {/* Decorative Circles */}
              <div className='absolute -right-12 -bottom-32 w-80 h-80 bg-emerald-500/20 rounded-full blur-3xl'></div>
              <div className='absolute right-20 -top-20 w-60 h-60 bg-white/5 rounded-full blur-2xl'></div>
            </div>
          )}
        </div>

        {/* RIGHT COL: Recent Activity */}
        <div className='space-y-6'>
          <div className='flex items-center justify-between'>
            <h2 className='text-lg font-bold text-gray-900'>Recent Activity</h2>
          </div>

          <div className='bg-white rounded-[2rem] border border-gray-100 shadow-sm p-8 h-full min-h-[400px]'>
            <div className='relative pl-2'>
              {/* Vertical Line */}
              <div className='absolute top-2 bottom-2 left-[7px] w-0.5 bg-gray-100 rounded-full'></div>

              {recentActivity.length > 0 ? (
                <div className='space-y-8'>
                  {recentActivity.map((activity) => (
                    <div key={activity._id} className='relative pl-8 group'>
                      {/* Dot */}
                      <div
                        className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-[3px] border-white shadow-sm z-10 ${
                          activity.status === "Cancelled"
                            ? "bg-red-500"
                            : "bg-emerald-500"
                        }`}></div>

                      {/* Content */}
                      <div>
                        <p
                          className={`text-sm font-bold ${
                            activity.status === "Cancelled"
                              ? "text-red-600"
                              : "text-gray-900"
                          }`}>
                          {activity.status === "Cancelled"
                            ? "Class Cancelled"
                            : "Class Booked"}
                        </p>
                        <p className='text-xs text-gray-500 mt-1 font-medium'>
                          {activity.classId.className}
                        </p>
                        <div className='flex items-center gap-2 mt-2'>
                          <span className='text-[10px] text-gray-400 font-mono bg-gray-50 px-1.5 py-0.5 rounded'>
                            {format(
                              new Date(
                                activity.createdAt || activity.bookingDate
                              ),
                              "MMM dd"
                            )}
                          </span>
                          <span className='text-[10px] text-gray-400'>
                            {format(
                              new Date(
                                activity.createdAt || activity.bookingDate
                              ),
                              "h:mm a"
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center h-40 text-center'>
                  <div className='w-10 h-10 bg-gray-50 rounded-full flex items-center justify-center mb-2'>
                    <Activity className='w-5 h-5 text-gray-300' />
                  </div>
                  <p className='text-sm text-gray-400'>No recent activity.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Helper Component for Stats ---
const StatCard = ({ icon, bg, label, value, delay }) => (
  <motion.div
    initial={{ y: 20, opacity: 0 }}
    animate={{ y: 0, opacity: 1 }}
    transition={{ delay }}
    className='bg-white p-6 rounded-[1.5rem] border border-gray-100 shadow-sm flex flex-col justify-between h-32 hover:shadow-md transition-shadow'>
    <div className='flex justify-between items-start'>
      <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
      {/* Optional: Add trend arrow here later */}
    </div>
    <div>
      <h3 className='text-3xl font-bold text-gray-900'>{value}</h3>
      <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-1'>
        {label}
      </p>
    </div>
  </motion.div>
);

export default Card;
