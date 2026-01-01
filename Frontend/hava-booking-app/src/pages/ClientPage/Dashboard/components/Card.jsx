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
} from "lucide-react";
import { useAuth } from "../../../../context/AuthContext"; // Adjust path
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import axiosInstance from "../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../components/LoadingSpinner"; // Adjust path
import { API_PATHS } from "../../../../utils/apiPath";

const Card = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // State for Real Data
  const [stats, setStats] = useState({
    credits: 0,
    upcomingCount: 0,
    totalBookings: 0,
  });
  const [nextClass, setNextClass] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [activePass, setActivePass] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // 1. Fetch Bookings (for Upcoming, History, Next Class)
        // Assuming you have the GET /api/bookings route working now
        const bookingRes = await axiosInstance.get(API_PATHS.BOOKING.GET_ALL);
        const allBookings = bookingRes.data;

        // Filter Upcoming vs Past
        const now = new Date();
        const upcoming = allBookings
          .filter(
            (b) =>
              new Date(b.classId.startTime) > now && b.status !== "Cancelled"
          )
          .sort(
            (a, b) =>
              new Date(a.classId.startTime) - new Date(b.classId.startTime)
          ); // Sort nearest first

        const history = allBookings.filter(
          (b) => new Date(b.classId.startTime) < now || b.status === "Cancelled"
        );

        const totalSession = allBookings.filter(
          (b) => b.status !== "Cancelled"
        );

        // 2. Fetch Passes (for Credits)
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
        setActivePass(passes.length > 0 ? passes[0] : null); // Primary pass
        setRecentActivity(allBookings.slice(0, 3)); // Top 3 most recent actions
      } catch (error) {
        console.error("Dashboard fetch error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      {/* Header */}
      <div className='mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Welcome Back, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className='text-gray-500 text-sm mt-1'>
            Here is what is happening with your schedule today.
          </p>
        </div>
        <button
          onClick={() => navigate("/book-class")} // Check your route path
          className='bg-emerald-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/10 active:scale-95'>
          Book New Class
        </button>
      </div>

      {/* Top Stats Grid */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
        {/* Credits Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4'>
          <div className='p-3 rounded-xl bg-blue-50 text-blue-600'>
            <CreditCard className='w-6 h-6' />
          </div>
          <div>
            <p className='text-sm text-gray-500 font-medium'>Active Credits</p>
            <h3 className='text-2xl font-bold text-gray-900'>
              {stats.credits}
            </h3>
          </div>
        </motion.div>

        {/* Upcoming Count Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4'>
          <div className='p-3 rounded-xl bg-emerald-50 text-emerald-600'>
            <Calendar className='w-6 h-6' />
          </div>
          <div>
            <p className='text-sm text-gray-500 font-medium'>
              Upcoming Classes
            </p>
            <h3 className='text-2xl font-bold text-gray-900'>
              {stats.upcomingCount}
            </h3>
          </div>
        </motion.div>

        {/* Total Activity Card */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4'>
          <div className='p-3 rounded-xl bg-purple-50 text-purple-600'>
            <Activity className='w-6 h-6' />
          </div>
          <div>
            <p className='text-sm text-gray-500 font-medium'>Total Sessions</p>
            <h3 className='text-2xl font-bold text-gray-900'>
              {stats.totalBookings}
            </h3>
          </div>
        </motion.div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* MAIN COLUMN: Next Class & Banner */}
        <div className='lg:col-span-2 space-y-6'>
          {/* NEXT CLASS HIGHLIGHT */}
          {nextClass ? (
            <div className='bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden'>
              <div className='bg-emerald-900/5 p-6 border-b border-gray-100 flex justify-between items-center'>
                <h2 className='font-bold text-gray-900 flex items-center gap-2'>
                  <Clock className='w-5 h-5 text-emerald-700' /> Your Next
                  Session
                </h2>
                <span className='bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full uppercase'>
                  {nextClass.status}
                </span>
              </div>
              <div className='p-8'>
                <div className='flex flex-col md:flex-row gap-6 md:items-center'>
                  <div className='bg-gray-50 rounded-2xl p-4 min-w-[100px] text-center border border-gray-200'>
                    <span className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                      {format(new Date(nextClass.classId.startTime), "MMM")}
                    </span>
                    <span className='block text-3xl font-bold text-gray-900'>
                      {format(new Date(nextClass.classId.startTime), "dd")}
                    </span>
                    <span className='block text-xs font-medium text-emerald-600 mt-1'>
                      {format(new Date(nextClass.classId.startTime), "EEE")}
                    </span>
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-xl font-bold text-gray-900 mb-2'>
                      {nextClass.classId.className}
                    </h3>
                    <div className='space-y-2'>
                      <p className='text-sm text-gray-500 flex items-center gap-2'>
                        <Clock className='w-4 h-4' />
                        {format(
                          new Date(nextClass.classId.startTime),
                          "h:mm a"
                        )}{" "}
                        -{" "}
                        {format(new Date(nextClass.classId.endTime), "h:mm a")}
                      </p>
                      <p className='text-sm text-gray-500 flex items-center gap-2'>
                        <MapPin className='w-4 h-4' />
                        {nextClass.studioId?.studioName}
                      </p>
                    </div>
                  </div>
                  <div>
                    <button
                      onClick={() => navigate("/manage-bookings")}
                      className='w-full md:w-auto px-6 py-2.5 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors'>
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Banner if NO upcoming class
            <div className='bg-emerald-900 rounded-3xl p-8 text-white relative overflow-hidden'>
              <div className='relative z-10 max-w-lg'>
                <h2 className='text-2xl font-bold mb-2'>
                  Start your journey today
                </h2>
                <p className='text-emerald-100 mb-6 text-sm opacity-90 leading-relaxed'>
                  You have {stats.credits} credits remaining. Browse our
                  schedule and book your first class to get moving!
                </p>
                <button
                  className='bg-white text-emerald-900 px-6 py-3 rounded-xl font-bold hover:bg-emerald-50 transition-colors shadow-lg'
                  onClick={() => navigate("/class-booking")}>
                  Find a Class
                </button>
              </div>
              <div className='absolute -right-10 -bottom-20 w-64 h-64 bg-emerald-800 rounded-full opacity-50 blur-2xl'></div>
            </div>
          )}
        </div>

        {/* SIDE COLUMN: Recent Activity */}
        <div className='space-y-6'>
          <div className='bg-white rounded-3xl border border-gray-100 shadow-sm p-6 h-full'>
            <h3 className='font-bold text-gray-900 mb-6'>Recent Activity</h3>
            <div className='space-y-6'>
              {recentActivity.length > 0 ? (
                recentActivity.map((activity) => (
                  <div
                    key={activity._id}
                    className='flex gap-4 items-start relative pb-6 border-l-2 border-gray-100 last:border-0 last:pb-0 pl-4'>
                    <div
                      className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white ${
                        activity.status === "Cancelled"
                          ? "bg-red-400"
                          : "bg-emerald-400"
                      }`}></div>
                    <div>
                      <p className='text-sm font-bold text-gray-800'>
                        {activity.status === "Cancelled"
                          ? "Class Cancelled"
                          : "Class Booked"}
                      </p>
                      <p className='text-xs text-gray-500 mt-0.5 line-clamp-1'>
                        {activity.classId.className}
                      </p>
                      <p className='text-[10px] text-gray-400 mt-2'>
                        {format(
                          new Date(activity.createdAt || activity.bookingDate),
                          "MMM dd, h:mm a"
                        )}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className='text-sm text-gray-400 text-center py-4'>
                  No recent activity.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Card;
