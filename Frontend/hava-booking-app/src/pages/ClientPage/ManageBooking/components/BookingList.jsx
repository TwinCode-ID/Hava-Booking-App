import React, { useState, useEffect } from "react";
import { format, differenceInHours } from "date-fns";
import { Calendar, Clock, MapPin, AlertCircle, XCircle } from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { API_PATHS } from "../../../../utils/apiPath"; // Ensure you add BOOKING paths here

const BookingList = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [cancellingId, setCancellingId] = useState(null);

  // --- 1. Fetch Bookings ---
  const fetchBookings = async () => {
    try {
      setLoading(true);
      // Use the route we defined above
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

  // --- 2. Cancel Handler ---
  const handleCancel = async (booking) => {
    if (
      !window.confirm(
        "Are you sure you want to cancel? Credits will be refunded."
      )
    )
      return;

    setCancellingId(booking._id);
    try {
      await axiosInstance.post(API_PATHS.BOOKING.CANCEL_BOOKING, {
        bookingId: booking._id,
        // Backend 'cancelBooking' needs classId to find schedule details
        classId: booking.classId._id,
        passId: booking.passId,
      });
      alert("Booking cancelled successfully.");
      fetchBookings(); // Refresh list
    } catch (error) {
      alert(error.response?.data?.error || "Cancellation failed.");
    } finally {
      setCancellingId(null);
    }
  };

  // --- 3. Filter Logic (Upcoming vs History) ---
  const now = new Date();

  const filteredBookings = bookings.filter((b) => {
    // Safety check if classId is null (e.g. deleted class)
    if (!b.classId) return false;

    const classTime = new Date(b.classId.startTime);

    if (activeTab === "upcoming") {
      // Show if in future AND not cancelled
      return classTime >= now && b.status !== "Cancelled";
    } else {
      // Show if in past OR cancelled
      return (
        classTime < now || b.status === "Cancelled" || b.status === "Completed"
      );
    }
  });

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      <h1 className='text-2xl font-bold text-gray-900 mb-6'>Manage Bookings</h1>

      {/* Tabs */}
      <div className='flex gap-1 bg-white p-1 rounded-xl w-fit mb-8 border border-gray-200'>
        {["upcoming", "history"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
              activeTab === tab
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-500 hover:bg-gray-50"
            }`}>
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className='space-y-4'>
          {filteredBookings.length > 0 ? (
            filteredBookings.map((booking) => (
              <BookingCard
                key={booking._id}
                booking={booking}
                onCancel={handleCancel}
                isCancelling={cancellingId === booking._id}
                isHistory={activeTab === "history"}
              />
            ))
          ) : (
            <div className='text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200'>
              <p className='text-gray-400'>No {activeTab} bookings found.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Sub-Component: Booking Card ---
const BookingCard = ({ booking, onCancel, isCancelling, isHistory }) => {
  // Safety check for null class data
  if (!booking.classId) return null;

  const classDate = new Date(booking.classId.startTime);
  const now = new Date();

  // Check 24 Hour Logic
  const hoursUntilClass = differenceInHours(classDate, now);
  const canCancel = hoursUntilClass >= 24;

  return (
    <div
      className={`bg-white p-6 rounded-2xl border transition-all flex flex-col md:flex-row gap-6 ${
        booking.status === "Cancelled"
          ? "border-red-100 bg-red-50/10"
          : "border-gray-100 shadow-sm hover:shadow-md"
      }`}>
      {/* Date Box */}
      <div
        className={`flex flex-col items-center justify-center rounded-xl p-4 min-w-[100px] border ${
          booking.status === "Cancelled"
            ? "bg-red-50 border-red-100 text-red-400"
            : booking.status === "Completed"
            ? "bg-emerald-50 border-emerald-100 text-emerald-900"
            : "bg-blue-50 border-blue-100 text-blue-900"
        }`}>
        <span className='text-xs font-bold uppercase'>
          {format(classDate, "MMM")}
        </span>
        <span className='text-2xl font-bold'>{format(classDate, "dd")}</span>
        <span className='text-xs'>{format(classDate, "EEE")}</span>
      </div>

      {/* Info */}
      <div className='flex-1'>
        <div className='flex items-center gap-2 mb-2'>
          {booking.status === "Cancelled" && (
            <span className='bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase'>
              Cancelled
            </span>
          )}
          {booking.status === "Completed" && (
            <span className='bg-emerald-50 text-emerald-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase'>
              Completed
            </span>
          )}
          {booking.status === "Booked" && (
            <span className='bg-blue-50 text-blue-900 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase'>
              Booked
            </span>
          )}
          <span className='bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase'>
            {booking.classId.classType}
          </span>
        </div>

        <h3 className='text-lg font-bold text-gray-900 mb-2'>
          {booking.classId.className}
        </h3>

        <div className='space-y-1 text-sm text-gray-500'>
          <div className='flex items-center gap-2'>
            <Clock className='w-4 h-4 text-emerald-600' />
            {format(classDate, "h:mm a")} -{" "}
            {format(new Date(booking.classId.endTime), "h:mm a")}
          </div>
          <div className='flex items-center gap-2'>
            <MapPin className='w-4 h-4 text-emerald-600' />
            {booking.studioId?.studioName || "Studio Location"}
          </div>
        </div>
      </div>

      {/* Action Area */}
      {!isHistory && booking.status !== "Cancelled" && (
        <div className='flex flex-col items-end justify-center min-w-40'>
          {canCancel ? (
            <button
              onClick={() => onCancel(booking)}
              disabled={isCancelling}
              className='w-full py-2.5 px-4 border border-red-200 text-red-600 font-bold rounded-xl hover:bg-red-50 hover:border-red-300 transition-all flex items-center justify-center gap-2'>
              {isCancelling ? (
                "Processing..."
              ) : (
                <>
                  <XCircle className='w-4 h-4' /> Cancel Booking
                </>
              )}
            </button>
          ) : (
            <div className='w-full bg-gray-50 border border-gray-200 p-3 rounded-xl text-center'>
              <div className='flex items-center justify-center gap-2 text-gray-500 font-bold text-sm mb-1'>
                <AlertCircle className='w-4 h-4' /> Too Late to Cancel
              </div>
              <p className='text-[10px] text-gray-400 leading-tight'>
                Cancellations closed
                <br />
                (Less than 24h left)
              </p>
            </div>
          )}
          {canCancel && (
            <p className='text-[10px] text-gray-400 mt-2 text-center w-full'>
              Free cancellation available
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingList;
