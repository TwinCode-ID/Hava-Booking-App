import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Activity,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  ChevronLeft, // Added
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Plus,
  User,
  XCircle,
  Ticket,
  Info,
  X, // Added
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import {
  format,
  differenceInHours,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";
import axiosInstance from "../../../utils/axiosInstance";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { API_PATHS } from "../../../utils/apiPath";

const ClientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // --- State ---
  const [credits, setCredits] = useState(0);
  const [nextClasses, setNextClasses] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  // --- Calendar State ---
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // --- Modal State ---
  const [selectedClass, setSelectedClass] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  // --- 1. Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch Bookings
      const bookingRes = await axiosInstance.get(API_PATHS.BOOKING.GET_ALL);
      const allBookings = bookingRes.data;

      const now = new Date();
      const upcoming = allBookings
        .filter(
          (b) =>
            new Date(b.classId?.startTime) > now && b.status !== "Cancelled"
        )
        .sort(
          (a, b) =>
            new Date(a.classId?.startTime) - new Date(b.classId?.startTime)
        );

      // Fetch Passes
      const passRes = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id)
      );
      const passes = passRes.data;
      const totalCredits = passes.reduce(
        (sum, p) => sum + p.remainingCredits,
        0
      );

      // Set State
      setCredits(totalCredits);
      setNextClasses(upcoming);

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

  useEffect(() => {
    fetchData();
  }, [user._id]);

  // --- 2. Action Logic ---
  const handleCancelClass = async (booking) => {
    if (booking.isAttend) {
      alert("Cannot cancel a class you have already checked in to.");
      return;
    }
    const hoursUntil = differenceInHours(
      new Date(booking.classId?.startTime),
      new Date()
    );
    if (hoursUntil < 24) {
      alert("Cancellation is not allowed less than 24 hours before class.");
      return;
    }
    if (!window.confirm("Are you sure you want to cancel this booking?"))
      return;

    setCancellingId(booking._id);
    try {
      await axiosInstance.post(API_PATHS.BOOKING.CANCEL_BOOKING, {
        bookingId: booking._id,
        classId: booking.classId?._id,
        passId: booking.passId,
      });
      alert("Booking cancelled successfully.");
      setSelectedClass(null);
      fetchData();
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Cancellation failed.");
    } finally {
      setCancellingId(null);
    }
  };

  // --- 3. Calendar Logic ---
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  if (loading)
    return (
      <div className='h-screen flex items-center justify-center bg-gray-50'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='p-6 md:p-10 bg-[#FAFAFA] min-h-full font-sans'>
      {/* --- HEADER --- */}

      <div className='mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
            Welcome, {user?.fullName?.split(" ")[0]}!
          </h1>
          <p className='text-gray-500 mt-2 text-base'>{user?.email}</p>
        </div>
        {nextClasses.length > 0 && (
          <button
            onClick={() => navigate("/book-the-class")}
            className='flex items-center gap-2 bg-[#0f392b] text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-emerald-900 transition-all shadow-xl shadow-emerald-900/10 active:scale-95 group'>
            <Plus className='w-5 h-5' />
            <span>Book New Class</span>
          </button>
        )}
      </div>

      {/* --- MAIN CONTENT GRID --- */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* === LEFT COL (2/3): Upcoming Classes === */}
        <div className='lg:col-span-3 space-y-8'>
          {nextClasses.length > 0 ? (
            <div className='space-y-6'>
              {nextClasses.map((item, index) => (
                <motion.div
                  key={item._id || index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className='bg-white rounded-4xl border border-gray-100 shadow-sm overflow-hidden relative group'>
                  <div className='p-8'>
                    <div className='flex items-start justify-between mb-6'>
                      <div className='flex gap-2 items-center'>
                        {/* Only show "Up Next" pulse for the very first class */}
                        {index === 0 ? (
                          <>
                            <span className='flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse'></span>
                            <span className='text-xs font-bold text-emerald-600 uppercase tracking-wider'>
                              Up Next
                            </span>
                          </>
                        ) : (
                          <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                            Upcoming
                          </span>
                        )}
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          item.status === "Confirmed"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                        {item.status || "Confirmed"}
                      </span>
                    </div>

                    <div className='flex flex-col md:flex-row gap-8 items-start md:items-center'>
                      {/* Date Box */}
                      <div className='bg-gray-50 rounded-2xl p-5 min-w-27.5 text-center border border-gray-100'>
                        <span className='block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                          {format(new Date(item.classId.startTime), "MMMM")}
                        </span>
                        <span className='block text-4xl font-bold text-gray-900 leading-none mb-1'>
                          {format(new Date(item.classId.startTime), "dd")}
                        </span>
                        <span className='block text-sm font-medium text-gray-500'>
                          {format(new Date(item.classId.startTime), "EEEE")}
                        </span>
                      </div>

                      {/* Details */}
                      <div className='flex-1 space-y-3'>
                        <h3 className='text-2xl font-bold text-gray-900 leading-tight'>
                          {item.classId.className}
                        </h3>

                        <div className='flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600'>
                          <div className='flex items-center gap-2'>
                            <Clock className='w-4 h-4 text-emerald-600' />
                            {format(
                              new Date(item.classId.startTime),
                              "h:mm a"
                            )}{" "}
                            - {format(new Date(item.classId.endTime), "h:mm a")}
                          </div>
                          <div className='flex items-center gap-2'>
                            <MapPin className='w-4 h-4 text-emerald-600' />
                            {item.studioId?.studioName}
                          </div>
                        </div>

                        <div className='flex items-center gap-2 pt-1'>
                          <div className='w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500'>
                            {item.instructorId?.fullName?.charAt(0) || "I"}
                          </div>
                          <span className='text-sm font-medium text-gray-700'>
                            {item.instructorId?.fullName || "Instructor"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSelectedClass(item)}
                        className='w-full md:w-auto px-6 py-3 bg-white border border-gray-200 text-gray-900 font-bold rounded-xl hover:bg-gray-50 transition-all shadow-sm'>
                        View Details
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center h-64 bg-white rounded-4xl border border-gray-100 border-dashed text-center p-6'>
              <div className='w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4'>
                <Calendar className='w-6 h-6 text-gray-300' />
              </div>
              <h3 className='text-lg font-bold text-gray-900'>
                No upcoming classes
              </h3>
              <p className='text-gray-500 text-sm mt-1 mb-4'>
                You haven't booked any sessions yet.
              </p>
              <button
                onClick={() => navigate("/book-the-class")}
                className='text-sm font-bold text-emerald-700 bg-emerald-50 p-4 rounded-2xl hover:text-emerald-800 flex items-center gap-1'>
                Find a class <ArrowRight className='w-4 h-4' />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* --- DETAILS MODAL POPUP --- */}
      <AnimatePresence>
        {selectedClass && (
          <ClassDetailsModal
            booking={selectedClass}
            onClose={() => setSelectedClass(null)}
            onCancel={handleCancelClass}
            cancellingId={cancellingId}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Helper Component: Details Modal (Refined Style) ---
const ClassDetailsModal = ({ booking, onClose, onCancel, cancellingId }) => {
  const startTime = new Date(booking.classId?.startTime);
  const endTime = new Date(booking.classId?.endTime);
  const now = new Date();

  const isCompleted = now > endTime;
  const isCancelled = booking.status === "Cancelled";
  const hoursUntil = differenceInHours(startTime, now);
  const canCancel =
    !booking.isAttend && !isCancelled && !isCompleted && hoursUntil >= 24;

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='relative bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center'>
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors'>
          <X className='w-5 h-5 text-gray-500' />
        </button>

        {/* Header Icon */}
        <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4'>
          <Ticket className='w-8 h-8 text-emerald-600' />
        </div>

        <h2 className='text-xl font-bold text-gray-900 mb-1'>
          {booking.classId?.className}
        </h2>
        <div className='flex justify-center mb-6'>
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              isCancelled
                ? "bg-red-50 text-red-600"
                : "bg-emerald-50 text-emerald-600"
            }`}>
            {isCancelled ? "Cancelled" : "Confirmed Booking"}
          </span>
        </div>

        {/* Info Grid */}
        <div className='bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6'>
          <div className='flex justify-between items-center border-b border-gray-100 pb-2'>
            <span className='text-xs font-bold text-gray-400 uppercase'>
              Instructor
            </span>
            <span className='text-sm font-bold text-gray-900'>
              {booking.instructorId?.fullName}
            </span>
          </div>
          <div className='flex justify-between items-center border-b border-gray-100 pb-2'>
            <span className='text-xs font-bold text-gray-400 uppercase'>
              Date
            </span>
            <span className='text-sm font-bold text-gray-900'>
              {format(startTime, "MMM do, yyyy")}
            </span>
          </div>
          <div className='flex justify-between items-center border-b border-gray-100 pb-2'>
            <span className='text-xs font-bold text-gray-400 uppercase'>
              Time
            </span>
            <span className='text-sm font-bold text-gray-900'>
              {format(startTime, "h:mm a")}
            </span>
          </div>
          <div className='flex justify-between items-center'>
            <span className='text-xs font-bold text-gray-400 uppercase'>
              Studio
            </span>
            <span className='text-sm font-bold text-gray-900'>
              {booking.studioId?.studioName}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className='flex flex-col gap-3'>
          {canCancel && (
            <button
              onClick={() => onCancel(booking)}
              disabled={cancellingId === booking._id}
              className='w-full py-3 bg-white border border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors text-sm'>
              {cancellingId === booking._id
                ? "Processing..."
                : "Cancel Booking"}
            </button>
          )}

          <button
            onClick={onClose}
            className='w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors text-sm'>
            Close Details
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ClientDashboard;
