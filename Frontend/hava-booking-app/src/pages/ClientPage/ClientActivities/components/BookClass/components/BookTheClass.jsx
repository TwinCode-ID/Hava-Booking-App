import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  format,
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
import {
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  User,
  Calendar as CalendarIcon,
  ArrowLeft,
  Building2,
  ShoppingCart,
  Plus,
  Check,
  Phone,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import BookingModal from "./BookingModal";

const BookTheClass = () => {
  const navigate = useNavigate();

  // --- Data States ---
  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- Flow States ---
  const [selectedStudio, setSelectedStudio] = useState(null); // Step 1: Pick Studio
  const [selectedDate, setSelectedDate] = useState(new Date()); // Step 2: Pick Date
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // --- Cart State ---
  const [cart, setCart] = useState([]); // Replaces the old selection logic
  const [showBookingModal, setShowBookingModal] = useState(false);

  // --- Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch both studios and schedule simultaneously
        const [studiosRes, classesRes] = await Promise.all([
          axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
          axiosInstance.get(API_PATHS.SCHEDULE.GET_ALL),
        ]);
        setStudios(studiosRes.data);
        setClasses(classesRes.data);
      } catch (error) {
        console.error("Failed to fetch data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [currentMonth]); // Kept currentMonth dependency in case your API fetches per month

  // --- Calendar Logic ---
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  // --- Filtering Logic ---
  // Only show classes for the selected studio AND selected date
  const dailyClasses = classes.filter(
    (c) =>
      selectedStudio &&
      c.studioId?._id === selectedStudio._id &&
      isSameDay(new Date(c.startTime), selectedDate) &&
      c.isActive,
  );

  const formatTime = (isoString) => format(new Date(isoString), "h:mm a");

  // --- Cart Handlers ---
  const toggleCart = (cls) => {
    if (cart.some((c) => c._id === cls._id)) {
      setCart(cart.filter((c) => c._id !== cls._id)); // Remove from cart
    } else {
      setCart([...cart, cls]); // Add to cart
    }
  };

  // ==========================================================================
  // VIEW 1: STUDIO SELECTION
  // ==========================================================================
  if (!selectedStudio) {
    return (
      <div className='min-h-screen bg-gray-50 font-sans p-6 md:p-10'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex items-center gap-4 mb-8'>
            <button
              onClick={() => navigate(-1)}
              className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
              <ArrowLeft className='w-5 h-5' />
            </button>
            <div>
              <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
                Select a Studio
              </h1>
              <p className='text-gray-500 mt-1'>
                Where would you like to practice today?
              </p>
            </div>
          </div>

          {loading ? (
            <div className='h-64 flex items-center justify-center'>
              <LoadingSpinner />
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8'>
              {studios.map((studio) => {
                // Handle nested arrays from your API structure safely
                const firstImage = studio.studioPictures?.[0]?.[0] || null;
                const facilityList = studio.facilities?.[0] || [];

                return (
                  <div
                    key={studio._id}
                    onClick={() => setSelectedStudio(studio)}
                    className='bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col group'>
                    {/* Header Image */}
                    <div className='relative h-56 w-full bg-gray-100 overflow-hidden'>
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={studio.studioName}
                          className='w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'
                        />
                      ) : (
                        <div className='w-full h-full flex flex-col items-center justify-center text-gray-400 bg-emerald-50/50'>
                          <Building2 className='w-12 h-12 mb-2 text-emerald-600/50' />
                        </div>
                      )}

                      {/* Gradient Overlay for Text Readability */}
                      <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent'></div>

                      {/* Title over Image */}
                      <div className='absolute bottom-5 left-5 right-5 text-white'>
                        <h3 className='text-xl font-bold leading-tight shadow-sm'>
                          {studio.studioName}
                        </h3>
                      </div>
                    </div>

                    {/* Content Body */}
                    <div className='p-6 flex-1 flex flex-col'>
                      {/* Location Details */}
                      <div className='flex items-start gap-3 text-sm text-gray-600 mb-6'>
                        <div className='p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0 mt-0.5'>
                          <MapPin className='w-4 h-4' />
                        </div>
                        <p className='leading-relaxed'>
                          {studio.address?.street ? (
                            <>
                              <span className='block font-medium text-gray-900'>
                                {studio.address.city}
                              </span>
                              <span className='text-gray-500 text-xs mt-0.5 block'>
                                {studio.address.street}
                              </span>
                            </>
                          ) : (
                            "Location not provided"
                          )}
                        </p>
                      </div>
                      {/* Contact Details (Only shows if contactNumber exists) */}
                      {studio.contactNumber && (
                        <div className='flex items-center gap-3 text-sm text-gray-600 mb-6'>
                          <div className='p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0'>
                            <Phone className='w-4 h-4' />
                          </div>
                          <a
                            href={`tel:+${studio.contactNumber}`}
                            onClick={(e) => e.stopPropagation()} // Prevents the card from clicking when they tap the phone number
                            className='font-bold text-gray-900 hover:text-emerald-600 transition-colors'>
                            +{studio.contactNumber}
                          </a>
                        </div>
                      )}
                      {/* Amenities / Facilities */}
                      {facilityList.length > 0 && (
                        <div className='mt-auto pt-4 border-t border-gray-100'>
                          <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3'>
                            Studio Amenities
                          </p>
                          <div className='flex flex-wrap gap-2'>
                            {facilityList.slice(0, 4).map((facility, idx) => (
                              <span
                                key={idx}
                                className='bg-gray-50 text-gray-600 border border-gray-200 text-xs font-medium px-2.5 py-1 rounded-lg'>
                                {facility}
                              </span>
                            ))}
                            {facilityList.length > 4 && (
                              <span className='bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold px-2.5 py-1 rounded-lg'>
                                +{facilityList.length - 4}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================================================
  // VIEW 2: CLASS SCHEDULE & CALENDAR
  // ==========================================================================
  return (
    <div className='min-h-screen bg-gray-50 font-sans p-6 md:p-10 pb-32 relative'>
      <div className='max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start'>
        {/* --- LEFT: MAIN CONTENT (Class List) --- */}
        <div className='flex-1 w-full min-w-0'>
          {/* Header */}
          <div className='flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4'>
            <div className='flex items-center gap-4'>
              <button
                onClick={() => setSelectedStudio(null)} // Go back to studio list
                className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
                <ArrowLeft className='w-5 h-5' />
              </button>
              <div>
                <h1 className='text-2xl font-bold text-gray-900'>
                  {selectedStudio.studioName}
                </h1>
                <p className='text-sm text-gray-500 font-medium'>
                  {format(selectedDate, "EEEE, MMMM do, yyyy")}
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className='h-64 flex items-center justify-center'>
              <LoadingSpinner />
            </div>
          ) : (
            <div className='space-y-4'>
              {dailyClasses.length > 0 ? (
                dailyClasses.map((cls) => {
                  const isExpired = new Date(cls.startTime) < new Date();
                  const isFull = cls.currentEnrollment >= cls.capacity;
                  const inCart = cart.some((c) => c._id === cls._id);

                  return (
                    <div
                      key={cls._id}
                      className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-6
                        ${isExpired ? "border-gray-100 opacity-60 grayscale-[0.5]" : "border-gray-100 hover:shadow-md"}
                        ${inCart ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""}
                      `}>
                      {/* Time Column */}
                      <div
                        className={`flex flex-col items-center justify-center rounded-2xl p-4 min-w-[90px] h-full border transition-colors ${isExpired ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-gray-50 border-gray-100 text-gray-900"}`}>
                        <span className='text-lg font-bold'>
                          {formatTime(cls.startTime)}
                        </span>
                        <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1'>
                          {cls.duration} min
                        </span>
                      </div>

                      {/* Details Column */}
                      <div className='flex-1'>
                        <div className='flex items-center gap-2 mb-2'>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${cls.classType === "Private" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                            {cls.classType}
                          </span>
                          <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider'>
                            {cls.instructorType}
                          </span>
                        </div>
                        <h3
                          className={`text-lg font-bold mb-1 ${isExpired ? "text-gray-500" : "text-gray-900"}`}>
                          {cls.className}
                        </h3>
                        <div className='flex items-center gap-1.5 text-sm text-gray-500 mt-2'>
                          <User className='w-4 h-4 text-gray-400' />
                          {cls.instructorId?.fullName || "Instructor"}
                        </div>
                      </div>

                      {/* Action Column (Cart Toggle) */}
                      <div className='flex flex-col items-end gap-3 min-w-[140px] w-full md:w-auto mt-4 md:mt-0'>
                        <div className='flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg'>
                          <Users className='w-3.5 h-3.5' />
                          <span>
                            {cls.capacity - cls.currentEnrollment} spots left
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            !isExpired && !isFull && toggleCart(cls)
                          }
                          disabled={isFull || isExpired}
                          className={`w-full py-3 px-4 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 
                            ${
                              isExpired
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : isFull
                                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  : inCart
                                    ? "bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-emerald-200 group"
                                    : "bg-gray-900 text-white hover:bg-emerald-600 shadow-md active:scale-95"
                            }`}>
                          {isExpired ? (
                            "Closed"
                          ) : isFull ? (
                            "Waitlist"
                          ) : inCart ? (
                            <>
                              <Check className='w-4 h-4 group-hover:hidden' />
                              <span className='group-hover:hidden'>Added</span>
                              <span className='hidden group-hover:block'>
                                Remove
                              </span>
                            </>
                          ) : (
                            <>
                              <Plus className='w-4 h-4' /> Add to Cart
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className='flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200'>
                  <div className='bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mb-6'>
                    <CalendarIcon className='w-8 h-8 text-gray-300' />
                  </div>
                  <h3 className='text-gray-900 font-bold text-xl'>
                    No classes scheduled
                  </h3>
                  <p className='text-gray-500 text-sm mt-2 max-w-xs text-center leading-relaxed'>
                    No classes available on {format(selectedDate, "MMMM do")} at
                    this studio.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- RIGHT SIDEBAR (Calendar) --- */}
        <aside className='w-full lg:w-[380px] shrink-0 space-y-6 lg:sticky lg:top-6'>
          <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-100'>
            <div className='flex items-center justify-between mb-6'>
              <button
                onClick={handlePrevMonth}
                className='p-1 text-gray-400 hover:text-gray-900 transition-colors'>
                <ChevronLeft className='w-5 h-5' />
              </button>
              <h2 className='text-lg font-bold text-gray-900'>
                {format(currentMonth, "MMMM yyyy")}
              </h2>
              <button
                onClick={handleNextMonth}
                className='p-1 text-gray-400 hover:text-gray-900 transition-colors'>
                <ChevronRight className='w-5 h-5' />
              </button>
            </div>
            <div className='grid grid-cols-7 mb-2'>
              {weekDays.map((day) => (
                <div
                  key={day}
                  className='h-10 flex items-center justify-center text-xs font-bold text-gray-400'>
                  {day}
                </div>
              ))}
            </div>
            <div className='grid grid-cols-7 gap-y-2'>
              {calendarDays.map((day, idx) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);
                return (
                  <div key={idx} className='flex justify-center'>
                    <button
                      onClick={() => setSelectedDate(day)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${isSelected ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/20" : isTodayDate ? "bg-emerald-50 text-emerald-700 font-bold" : "hover:bg-gray-50 text-gray-700"} ${!isCurrentMonth && "text-gray-300"}`}>
                      {format(day, "d")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* --- FLOATING CART ACTION BAR --- */}
      {cart.length > 0 && (
        <div className='fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40 animate-in slide-in-from-bottom-6 duration-300'>
          <div className='bg-gray-900 text-white p-4 rounded-2xl shadow-2xl shadow-gray-900/30 flex items-center justify-between border border-gray-800'>
            <div className='flex items-center gap-4'>
              <div className='relative'>
                <div className='bg-emerald-500 w-12 h-12 rounded-xl flex items-center justify-center text-white'>
                  <ShoppingCart className='w-5 h-5' />
                </div>
                <div className='absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-sm'>
                  {cart.length}
                </div>
              </div>
              <div>
                <p className='font-bold text-sm'>Ready to Checkout?</p>
                <p className='text-xs text-gray-400'>
                  {cart.length} {cart.length === 1 ? "class" : "classes"}{" "}
                  selected
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowBookingModal(true)}
              className='bg-emerald-500 hover:bg-emerald-400 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors shadow-lg active:scale-95'>
              Review & Book
            </button>
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {showBookingModal && (
        <BookingModal
          classes={cart}
          onClose={() => setShowBookingModal(false)}
          onConfirm={() => {
            setShowBookingModal(false);
            setCart([]);
            alert("Booking Successful!");
          }}
        />
      )}
    </div>
  );
};

export default BookTheClass;
