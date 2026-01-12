import React, { useState, useEffect } from "react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  isSameDay,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  addMonths,
  subMonths,
  formatDistanceToNow,
  differenceInHours,
} from "date-fns";
import {
  Clock,
  MapPin,
  User,
  ChevronRight,
  ChevronLeft,
  FileText,
  Printer,
  XCircle,
  Filter,
  Search,
  X,
  History,
  AlertCircle,
  Calendar,
  Ticket,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Mock Data / API Placeholders ---
import axiosInstance from "../../../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import { API_PATHS } from "../../../../../../utils/apiPath";

const BookingList = () => {
  // --- State ---
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  // Search State
  const [searchTerm, setSearchTerm] = useState("");

  // Modal States
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // --- 1. Fetch Data ---
  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(API_PATHS.BOOKING.GET_ALL);
      setBookings(response.data);
    } catch (error) {
      console.error("Failed to fetch bookings", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // --- 2. Action Logic (Cancel) ---
  const handleCancel = async (booking) => {
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

      setBookings((prev) =>
        prev.map((b) =>
          b._id === booking._id ? { ...b, status: "Cancelled" } : b
        )
      );

      setSelectedBooking(null);
      alert("Booking cancelled successfully.");
    } catch (error) {
      console.error(error);
      alert(error.response?.data?.error || "Cancellation failed.");
    } finally {
      setCancellingId(null);
    }
  };

  // --- 3. Filter Logic ---
  const filteredBookings = bookings.filter((b) => {
    if (!b.classId) return false;

    if (searchTerm.trim() !== "") {
      const query = searchTerm.toLowerCase();
      // Safe access with optional chaining
      const className = b.classId.className?.toLowerCase() || "";
      const instructor = b.instructorId?.fullName?.toLowerCase() || "";
      const location = b.studioId?.studioName?.toLowerCase() || "";
      return (
        className.includes(query) ||
        instructor.includes(query) ||
        location.includes(query)
      );
    }

    const bookingDate = new Date(b.classId.startTime);
    return isSameDay(bookingDate, currentDate);
  });

  // --- 4. Export Logic ---
  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(6, 78, 59);
    doc.text("Class Schedule Export", 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(
      searchTerm
        ? `Search Results for: "${searchTerm}"`
        : `Date: ${format(currentDate, "dd MMMM yyyy")}`,
      14,
      30
    );

    const tableRows = filteredBookings.map((b) => [
      format(new Date(b.classId?.startTime), "HH:mm"),
      b.classId?.className || "Unknown Class",
      b.instructorId?.fullName || "Unassigned", // Safe access
      b.studioId?.studioName || "Unknown Location", // Safe access
      b.status,
    ]);

    autoTable(doc, {
      head: [["Time", "Class", "Instructor", "Location", "Status"]],
      body: tableRows,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
    });

    setPdfUrl(doc.output("bloburl"));
    setShowPdfPreview(true);
  };

  return (
    <div className='bg-gray-50 min-h-screen p-6 font-sans flex flex-col items-center'>
      <div className='w-full max-w-7xl flex flex-col lg:flex-row gap-8'>
        {/* --- LEFT SIDE: MAIN LIST CONTENT --- */}
        <div className='flex-1 bg-white rounded-[2.5rem] shadow-sm border border-gray-200 overflow-hidden flex flex-col min-h-100 order-2 lg:order-1'>
          <div className='p-8 pb-0 flex flex-col gap-6'>
            {/* Header */}
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
              <div>
                <h1 className='text-2xl font-bold text-gray-900'>
                  Class Schedule
                </h1>
                <p className='text-gray-500 text-sm'>
                  Manage bookings and check-ins.
                </p>
              </div>
              <div className='flex gap-3'>
                <button
                  onClick={handleGeneratePDF}
                  className='px-4 py-2 bg-white border border-gray-200 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-50 flex items-center gap-2 transition-colors'>
                  <Printer className='w-4 h-4' /> Export
                </button>
              </div>
            </div>

            {/* Search */}
            <div className='relative w-full'>
              <input
                type='text'
                placeholder='Search class, instructor, or studio...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className='w-full pl-12 pr-10 py-4 rounded-2xl bg-gray-50 border border-transparent focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all text-sm font-medium'
              />
              <Search className='w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2' />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className='absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors'>
                  <X className='w-4 h-4 text-gray-500' />
                </button>
              )}
            </div>

            {/* Info Bar */}
            <div className='flex items-center justify-between pt-2'>
              <div className='flex items-center gap-2'>
                {searchTerm ? (
                  <h3 className='font-bold text-gray-900'>
                    Search results for{" "}
                    <span className='text-emerald-700'>"{searchTerm}"</span>
                  </h3>
                ) : (
                  <h3 className='font-bold text-gray-900'>
                    Classes for{" "}
                    <span className='text-emerald-700 underline decoration-emerald-200 underline-offset-4'>
                      {format(currentDate, "MMMM do, yyyy")}
                    </span>
                  </h3>
                )}
                <span className='bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-md'>
                  {filteredBookings.length}
                </span>
              </div>
            </div>
          </div>

          {/* List Content */}
          <div className='flex-1 p-8 pt-4 overflow-y-auto'>
            <div className='grid grid-cols-12 gap-4 px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100 mb-2'>
              <div className='col-span-2'>Time</div>
              <div className='col-span-4'>Class Details</div>
              <div className='col-span-3'>Location</div>
              <div className='col-span-2'>Date</div>
              <div className='col-span-1 text-right'>Status</div>
            </div>

            {loading ? (
              <div className='py-20 flex justify-center'>
                <LoadingSpinner />
              </div>
            ) : filteredBookings.length > 0 ? (
              <div className='space-y-3'>
                {filteredBookings
                  .sort(
                    (a, b) =>
                      new Date(a.classId?.startTime) -
                      new Date(b.classId?.startTime)
                  )
                  .map((booking) => (
                    <BookingRow
                      key={booking._id}
                      booking={booking}
                      onClick={() => setSelectedBooking(booking)}
                    />
                  ))}
              </div>
            ) : (
              <EmptyState isSearch={!!searchTerm} />
            )}
          </div>
        </div>

        {/* --- RIGHT SIDE: SIDEBAR --- */}
        <div className='w-full lg:w-80 shrink-0 space-y-6 order-1 lg:order-2'>
          {/* Calendar Widget */}
          <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-200'>
            <SideCalendar
              selectedDate={currentDate}
              onChange={(date) => {
                setCurrentDate(date);
                setSearchTerm("");
              }}
            />
          </div>

          {/* Activity Widget */}
          <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-200'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-bold text-gray-900'>Your Activity</h3>
              <History className='w-4 h-4 text-gray-400' />
            </div>
            <RecentActivityList bookings={bookings} />
          </div>
        </div>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {selectedBooking && (
          <BookingDetailsModal
            booking={selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onCancel={handleCancel}
            cancellingId={cancellingId}
          />
        )}
        {showPdfPreview && (
          <PdfPreviewModal
            pdfUrl={pdfUrl}
            onClose={() => setShowPdfPreview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Components ---

const SideCalendar = ({ selectedDate, onChange }) => {
  const [viewDate, setViewDate] = useState(selectedDate);

  useEffect(() => {
    setViewDate(selectedDate);
  }, [selectedDate]);

  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isSelected = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      const isToday = isSameDay(day, new Date());

      days.push(
        <div key={day.toString()} className='flex justify-center py-1'>
          <button
            onClick={() => onChange(cloneDay)}
            className={`
                w-8 h-8 flex items-center justify-center text-sm rounded-full transition-all relative
                ${
                  !isCurrentMonth
                    ? "text-gray-300"
                    : "text-gray-700 hover:bg-gray-100 font-medium"
                }
                ${
                  isSelected
                    ? "bg-[#0f392b]! text-white! font-bold shadow-md hover:bg-[#0f392b]!"
                    : ""
                }
                ${
                  isToday && !isSelected
                    ? "text-emerald-600 font-bold bg-emerald-50"
                    : ""
                }
            `}>
            {format(day, "d")}
          </button>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day} className='grid grid-cols-7 mb-1'>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div>
      <div className='flex items-center justify-between mb-6 px-1'>
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors'>
          <ChevronLeft className='w-5 h-5' />
        </button>
        <div className='flex items-center gap-1'>
          <span className='text-base font-bold text-gray-900'>
            {format(viewDate, "MMMM")}
          </span>
          <span className='text-base font-bold text-gray-900'>
            {format(viewDate, "yyyy")}
          </span>
        </div>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className='p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors'>
          <ChevronRight className='w-5 h-5' />
        </button>
      </div>
      <div className='grid grid-cols-7 mb-2 text-center'>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i} className='text-xs font-bold text-gray-400'>
            {d}
          </span>
        ))}
      </div>
      <div>{rows}</div>
    </div>
  );
};

const RecentActivityList = ({ bookings = [] }) => {
  const sortedActivities = [...bookings]
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 6);

  if (sortedActivities.length === 0) {
    return (
      <div className='text-gray-400 text-sm text-center py-4'>
        No recent activity
      </div>
    );
  }

  return (
    <div className='space-y-4'>
      {sortedActivities.map((booking) => {
        let action = "booked";
        let colorClass = "bg-emerald-100 text-emerald-700";

        if (booking.status === "Cancelled") {
          action = "cancelled";
          colorClass = "bg-red-100 text-red-700";
        } else if (booking.isAttend) {
          action = "checked-in";
          colorClass = "bg-blue-100 text-blue-700";
        }

        const timeAgo = formatDistanceToNow(new Date(booking.updatedAt), {
          addSuffix: true,
        });

        // Safe instructor access
        const instructorName = booking.instructorId?.fullName || "Unassigned";

        return (
          <div key={booking._id} className='flex items-start gap-3 text-sm'>
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${colorClass}`}>
              Me
            </div>
            <div>
              <p className='text-gray-900 leading-tight'>
                You <span className='font-bold'>{action}</span>
                <span className='text-gray-500'> </span>
                <span className='font-medium text-gray-800'>
                  {booking.classId?.className || "Class"}
                </span>
                <span className='text-xs text-gray-400 block mt-0.5'>
                  with {instructorName}
                </span>
              </p>
              <p className='text-[10px] text-gray-400 mt-1'>{timeAgo}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

const BookingRow = ({ booking, onClick }) => {
  const startTime = new Date(booking.classId?.startTime);
  const endTime = new Date(booking.classId?.endTime);
  const now = new Date();
  const isCompleted = now > endTime;

  let status = {
    label: "Booked",
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-100",
  };

  if (booking.status === "Cancelled") {
    status = {
      label: "Cancelled",
      bg: "bg-red-50",
      text: "text-red-700",
      border: "border-red-100",
    };
  } else if (booking.isAttend) {
    status = {
      label: "Checked In",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
      border: "border-emerald-100",
    };
  } else if (isCompleted) {
    status = {
      label: "Completed",
      bg: "bg-gray-50",
      text: "text-gray-500",
      border: "border-gray-200",
    };
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.005, backgroundColor: "#fff" }}
      onClick={onClick}
      className={`bg-white rounded-xl border border-gray-100 p-5 grid grid-cols-12 gap-4 items-center cursor-pointer shadow-sm hover:shadow-md transition-all group relative overflow-hidden`}>
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${status.text
          .replace("text", "bg")
          .replace("700", "500")}`}
      />
      <div className='col-span-2 font-medium text-gray-900 text-sm flex flex-col'>
        <span>{format(startTime, "HH:mm")}</span>
        <span className='text-xs text-gray-400'>
          {format(endTime, "HH:mm")}
        </span>
      </div>
      <div className='col-span-4'>
        <h4 className='font-bold text-gray-900 text-sm group-hover:text-emerald-700 transition-colors'>
          {booking.classId?.className || "Unknown Class"}
        </h4>
        <div className='flex items-center gap-1 text-xs text-gray-500 mt-0.5'>
          <User className='w-3 h-3' />
          {/* SAFE ACCESS HERE */}
          {booking.instructorId?.fullName || "Unassigned"}
        </div>
      </div>
      <div className='col-span-3 text-sm text-gray-600 truncate flex items-center gap-1'>
        <MapPin className='w-3 h-3 text-gray-400' />
        {/* SAFE ACCESS HERE */}
        {booking.studioId?.studioName || "Unknown Location"}
      </div>
      <div className='col-span-2 text-sm text-gray-600'>
        {format(startTime, "d MMM yyyy")}
      </div>
      <div className='col-span-1 flex justify-end'>
        <span
          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase whitespace-nowrap border ${status.bg} ${status.text} ${status.border}`}>
          {status.label}
        </span>
      </div>
    </motion.div>
  );
};

// --- UPDATED BOOKING DETAILS MODAL (More Detail) ---
const BookingDetailsModal = ({ booking, onClose, onCancel, cancellingId }) => {
  const startTime = new Date(booking.classId?.startTime);
  const endTime = new Date(booking.classId?.endTime);
  const now = new Date();

  const isCompleted = now > endTime;
  const isCancelled = booking.status === "Cancelled";
  const hoursUntil = differenceInHours(startTime, now);

  const canCancel =
    !booking.isAttend && !isCancelled && !isCompleted && hoursUntil >= 24;

  let statusBadge = {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Active",
    desc: "This booking is confirmed.",
  };
  if (isCancelled)
    statusBadge = {
      bg: "bg-red-100",
      text: "text-red-700",
      label: "Cancelled",
      desc: "This booking has been cancelled.",
    };
  else if (booking.isAttend)
    statusBadge = {
      bg: "bg-blue-100",
      text: "text-blue-700",
      label: "Checked In",
      desc: "You have successfully checked in.",
    };
  else if (isCompleted)
    statusBadge = {
      bg: "bg-gray-100",
      text: "text-gray-500",
      label: "Completed",
      desc: "This class has ended.",
    };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/40 backdrop-blur-sm'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className='relative bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden'>
        {/* Header Section */}
        <div className='p-6 border-b border-gray-100'>
          <div className='flex justify-between items-start mb-1'>
            <div>
              <span
                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mb-2 ${statusBadge.bg} ${statusBadge.text}`}>
                {statusBadge.label}
              </span>
              <h2 className='text-2xl font-bold text-gray-900'>
                {booking.classId?.className || "Unknown Class"}
              </h2>
              <p className='text-xs text-gray-500 mt-1'>{statusBadge.desc}</p>
            </div>
            <button
              onClick={onClose}
              className='p-1 hover:bg-gray-100 rounded-full transition-colors'>
              <XCircle className='w-6 h-6 text-gray-300 hover:text-gray-500' />
            </button>
          </div>
        </div>

        {/* Details Section */}
        <div className='p-6 space-y-6'>
          {/* Main Info Grid */}
          <div className='grid grid-cols-2 gap-y-6 gap-x-4'>
            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                Date & Time
              </p>
              <div className='flex gap-2 items-start text-sm text-gray-700'>
                <Clock className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span>
                  <span className='font-bold block text-gray-900'>
                    {format(startTime, "EEEE, MMM do")}
                  </span>
                  {format(startTime, "HH:mm")} - {format(endTime, "HH:mm")}
                </span>
              </div>
            </div>

            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                Instructor
              </p>
              <div className='flex gap-2 items-start text-sm text-gray-700'>
                <User className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span className='font-bold text-gray-900'>
                  {booking.instructorId?.fullName || "Unassigned"}
                </span>
              </div>
            </div>

            <div className='col-span-2'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-1'>
                Location
              </p>
              <div className='flex gap-2 items-start text-sm text-gray-700'>
                <MapPin className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span>
                  {booking.studioId?.studioName || "Unknown Location"}
                </span>
              </div>
            </div>
          </div>

          {/* Additional Meta Data */}
          <div className='bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-4 border border-gray-100'>
            <div>
              <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1'>
                Ref ID
              </p>
              <div className='flex items-center gap-1.5 text-xs text-gray-700 font-mono'>
                <Ticket className='w-3 h-3 text-gray-400' />#
                {booking._id.slice(-8).toUpperCase()}
              </div>
            </div>
            <div>
              <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1'>
                Booked On
              </p>
              <div className='flex items-center gap-1.5 text-xs text-gray-700'>
                <Calendar className='w-3 h-3 text-gray-400' />
                {format(new Date(booking.createdAt), "dd MMM yyyy, HH:mm")}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className='flex flex-col gap-3 pt-2'>
            {canCancel ? (
              <button
                onClick={() => onCancel(booking)}
                disabled={cancellingId === booking._id}
                className='w-full py-3.5 bg-white border border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-200 transition-all shadow-sm flex justify-center items-center gap-2 text-sm'>
                {cancellingId === booking._id ? (
                  <>Processing...</>
                ) : (
                  <>Cancel Booking</>
                )}
              </button>
            ) : (
              !isCancelled &&
              !booking.isAttend &&
              !isCompleted && (
                <div className='flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs font-bold text-amber-700 justify-center'>
                  <AlertCircle className='w-4 h-4' />
                  Cancellation period closed (&lt; 24h)
                </div>
              )
            )}

            <button
              onClick={onClose}
              className='w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/10 text-sm'>
              Close Details
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PdfPreviewModal = ({ pdfUrl, onClose }) => (
  <div className='fixed inset-0 z-60 flex items-center justify-center p-4'>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className='absolute inset-0 bg-black/75 backdrop-blur-sm'
    />
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className='relative bg-white w-full max-w-4xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col'>
      <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
        <h3 className='text-lg font-bold flex items-center gap-2'>
          <FileText className='w-5 h-5 text-emerald-600' /> Export Preview
        </h3>
        <button
          onClick={onClose}
          className='p-2 hover:bg-gray-100 rounded-full'>
          <XCircle className='w-5 h-5' />
        </button>
      </div>
      <div className='flex-1 bg-gray-100 p-4'>
        <iframe
          src={pdfUrl}
          className='w-full h-full rounded-xl shadow-inner bg-white'
          title='PDF Preview'></iframe>
      </div>
    </motion.div>
  </div>
);

const EmptyState = ({ isSearch }) => (
  <div className='flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-dashed border-gray-200'>
    <div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4'>
      <Filter className='w-6 h-6 text-gray-300' />
    </div>
    <h3 className='text-gray-900 font-bold'>No bookings found</h3>
    <p className='text-gray-400 text-sm mt-1'>
      {isSearch
        ? "Try adjusting your search terms."
        : "Try selecting a different date."}
    </p>
  </div>
);

export default BookingList;
