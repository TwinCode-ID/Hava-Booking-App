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
  Activity,
  Globe,
  Ban,
  X,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import BookingModal from "./BookingModal";
import { useAuth } from "../../../../../../context/AuthContext";
import socket from "../../../../../../utils/socket";

const BookTheClass = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [studios, setStudios] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  const [bookedClassIds, setBookedClassIds] = useState(new Set());
  const [hasValidMedical, setHasValidMedical] = useState(false);
  const [showMedicalWarning, setShowMedicalWarning] = useState(false);

  const [selectedStudio, setSelectedStudio] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [cart, setCart] = useState([]);
  const [showBookingModal, setShowBookingModal] = useState(false);

  const fetchData = async () => {
    try {
      if (classes.length === 0) setLoading(true);

      const myBookingsUrl = API_PATHS.BOOKING?.GET_MY_BOOKINGS;

      const [studiosRes, classesRes, medicalRes, bookingsRes] =
        await Promise.all([
          axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
          axiosInstance.get(API_PATHS.SCHEDULE.GET_ALL),
          axiosInstance
            .get(API_PATHS.AUTH.MEDICAL_INFO(user._id))
            .catch(() => ({ data: null })),
          axiosInstance.get(myBookingsUrl).catch(() => ({ data: [] })),
        ]);

      setStudios(studiosRes.data);
      setClasses(classesRes.data);

      if (medicalRes.data && medicalRes.data.termsAndConditions) {
        setHasValidMedical(true);
      } else {
        setHasValidMedical(false);
      }

      if (bookingsRes.data) {
        const bIds = new Set(
          bookingsRes.data.map((b) => b.classId?._id || b.classId),
        );
        setBookedClassIds(bIds);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleScheduleUpdate = () => {
      fetchData();
    };

    if (!socket.connected) socket.connect();
    socket.on("schedule_updated", handleScheduleUpdate);

    return () => {
      socket.off("schedule_updated", handleScheduleUpdate);
    };
  }, [currentMonth, user._id]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  const dailyClasses = classes.filter((c) => {
    const isStudioMatch =
      selectedStudio === "ALL" ||
      (selectedStudio && c.studioId?._id === selectedStudio._id);
    const isDateMatch = isSameDay(new Date(c.startTime), selectedDate);
    const isNotBooked = !bookedClassIds.has(c._id);
    return isStudioMatch && isDateMatch && c.isActive && isNotBooked;
  });

  const allUpcomingClasses = classes
    .filter((c) => {
      const isStudioMatch =
        selectedStudio === "ALL" ||
        (selectedStudio && c.studioId?._id === selectedStudio._id);
      const isFuture = new Date(c.startTime) >= new Date();
      const isNotBooked = !bookedClassIds.has(c._id);
      return isStudioMatch && isFuture && c.isActive && isNotBooked;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const formatTime = (isoString) => format(new Date(isoString), "h:mm a");

  const toggleCart = (cls) => {
    if (!hasValidMedical) {
      setShowMedicalWarning(true);
      return;
    }
    if (cart.some((c) => c._id === cls._id)) {
      setCart(cart.filter((c) => c._id !== cls._id));
    } else {
      setCart([...cart, cls]);
    }
  };

  // Reusable Calendar Widget for both Mobile (top) and Desktop (sidebar)
  const renderCalendar = () => (
    <div className='bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 shrink-0 w-full'>
      <div className='flex items-center justify-between mb-4 md:mb-6'>
        <button
          onClick={handlePrevMonth}
          className='p-2 -ml-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full'>
          <ChevronLeft className='w-6 h-6 md:w-5 md:h-5' />
        </button>
        <h2 className='text-base md:text-lg font-bold text-gray-900'>
          {format(currentMonth, "MMMM yyyy")}
        </h2>
        <button
          onClick={handleNextMonth}
          className='p-2 -mr-2 text-gray-400 hover:text-gray-900 transition-colors rounded-full'>
          <ChevronRight className='w-6 h-6 md:w-5 md:h-5' />
        </button>
      </div>
      <div className='grid grid-cols-7 mb-2'>
        {weekDays.map((day) => (
          <div
            key={day}
            className='h-8 md:h-10 flex items-center justify-center text-[10px] md:text-xs font-bold text-gray-400'>
            {day}
          </div>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-y-1.5 md:gap-y-2'>
        {calendarDays.map((day, idx) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isTodayDate = isToday(day);
          return (
            <div key={idx} className='flex justify-center'>
              <button
                onClick={() => setSelectedDate(day)}
                className={`w-10 h-10 md:w-10 md:h-10 rounded-full flex items-center justify-center text-sm md:text-sm font-medium transition-all ${isSelected ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/20" : isTodayDate ? "bg-emerald-50 text-emerald-700 font-bold" : "hover:bg-gray-50 text-gray-700"} ${!isCurrentMonth && "text-gray-300"}`}>
                {format(day, "d")}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  // STUDIO SELECTION VIEW
  if (!selectedStudio) {
    return (
      <div className='min-h-screen bg-gray-50 font-sans p-4 md:p-6 lg:p-10 pb-safe'>
        <div className='max-w-6xl mx-auto'>
          <div className='flex items-center gap-3 md:gap-4 mb-6 md:mb-8'>
            <button
              onClick={() => navigate(-1)}
              className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
              <ArrowLeft className='w-6 h-6 md:w-5 md:h-5' />
            </button>
            <div>
              <h1 className='text-2xl md:text-3xl font-bold text-gray-900 tracking-tight'>
                Select a Studio
              </h1>
              <p className='text-sm md:text-base text-gray-500 mt-0.5 md:mt-1'>
                Where would you like to practice today?
              </p>
            </div>
          </div>
          {loading ? (
            <div className='h-64 flex items-center justify-center'>
              <LoadingSpinner />
            </div>
          ) : (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8'>
              {/* ALL LOCATIONS CARD */}
              <div
                onClick={() => setSelectedStudio("ALL")}
                className='bg-gray-900 rounded-3xl border border-gray-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col group'>
                <div className='relative h-48 md:h-56 w-full bg-gray-800 overflow-hidden flex flex-col items-center justify-center'>
                  <Globe className='w-14 h-14 md:w-16 md:h-16 text-emerald-400 group-hover:scale-110 transition-transform duration-500 mb-2' />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent'></div>
                  <div className='absolute bottom-5 left-5 right-5 text-white'>
                    <h3 className='text-lg md:text-xl font-bold leading-tight shadow-sm'>
                      All Locations
                    </h3>
                  </div>
                </div>
                <div className='p-5 md:p-6 flex-1 flex flex-col justify-center'>
                  <p className='text-gray-400 text-xs md:text-sm leading-relaxed font-medium'>
                    View the complete schedule and all available classes across
                    every studio location.
                  </p>
                </div>
              </div>

              {/* INDIVIDUAL STUDIOS */}
              {studios.map((studio) => {
                const firstImage = studio.studioPictures?.[0]?.[0] || null;
                return (
                  <div
                    key={studio._id}
                    onClick={() => setSelectedStudio(studio)}
                    className='bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col group'>
                    <div className='relative h-48 md:h-56 w-full bg-gray-100 overflow-hidden'>
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
                      <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent'></div>
                      <div className='absolute bottom-5 left-5 right-5 text-white'>
                        <h3 className='text-lg md:text-xl font-bold leading-tight shadow-sm'>
                          {studio.studioName}
                        </h3>
                      </div>
                    </div>
                    <div className='p-5 md:p-6 flex-1 flex flex-col'>
                      <div className='flex items-start gap-3 text-sm text-gray-600 mb-4 md:mb-6'>
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
                      {studio.contactNumber && (
                        <div className='flex items-center gap-3 text-sm text-gray-600 mt-auto'>
                          <div className='p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0'>
                            <Phone className='w-4 h-4' />
                          </div>
                          <a
                            href={`tel:+${studio.contactNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            className='font-bold text-gray-900 hover:text-emerald-600 transition-colors p-1'>
                            +{studio.contactNumber}
                          </a>
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

  // BOOKING VIEW
  return (
    <>
      <div className='min-h-screen bg-gray-50 font-sans p-4 md:p-6 lg:p-10 pb-40 md:pb-32 relative'>
        <div className='max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 md:gap-8 items-start'>
          {/* --- LEFT: MAIN CONTENT --- */}
          <div className='flex-1 w-full min-w-0'>
            {/* Header */}
            <div className='flex items-center gap-3 md:gap-4 mb-6'>
              <button
                onClick={() => setSelectedStudio(null)}
                className='p-2 md:p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
                <ArrowLeft className='w-6 h-6 md:w-5 md:h-5' />
              </button>
              <div>
                <h1 className='text-xl md:text-2xl font-bold text-gray-900 line-clamp-1'>
                  {selectedStudio === "ALL"
                    ? "All Locations"
                    : selectedStudio.studioName}
                </h1>
                <p className='text-xs md:text-sm text-gray-500 font-medium'>
                  {format(selectedDate, "EEEE, MMMM do, yyyy")}
                </p>
              </div>
            </div>

            {/* Mobile Calendar (Hidden on lg desktop) */}
            <div className='block lg:hidden mb-6 w-full max-w-sm mx-auto'>
              {renderCalendar()}
            </div>

            {/* Daily Classes List */}
            {loading ? (
              <div className='h-64 flex items-center justify-center'>
                <LoadingSpinner />
              </div>
            ) : (
              <div className='space-y-4 md:space-y-4'>
                {dailyClasses.length > 0 ? (
                  dailyClasses.map((cls) => {
                    const isExpired = new Date(cls.startTime) < new Date();
                    const isFull = cls.currentEnrollment >= cls.capacity;
                    const inCart = cart.some((c) => c._id === cls._id);

                    return (
                      <div
                        key={cls._id}
                        className={`bg-white rounded-2xl p-4 md:p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 ${isExpired ? "border-gray-100 opacity-60 grayscale-[0.5]" : "border-gray-100 hover:shadow-md"} ${inCart ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""}`}>
                        {/* Time Badge */}
                        <div
                          className={`flex flex-row md:flex-col items-center justify-between md:justify-center rounded-xl p-3 md:p-4 w-full md:min-w-[90px] md:w-auto md:h-full border transition-colors ${isExpired ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-gray-50 border-gray-100 text-gray-900"}`}>
                          <span className='text-base md:text-lg font-bold'>
                            {formatTime(cls.startTime)}
                          </span>
                          <span className='text-[10px] md:text-[10px] font-bold text-gray-400 md:text-gray-400 uppercase tracking-wider mt-0 md:mt-1'>
                            {cls.duration} min
                          </span>
                        </div>

                        {/* Details */}
                        <div className='flex-1 w-full'>
                          <div className='flex items-center gap-2 mb-2 flex-wrap'>
                            <span
                              className={`text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${cls.classType === "Private" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                              {cls.classType}
                            </span>
                            <span className='text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider'>
                              {cls.instructorType}
                            </span>
                            {selectedStudio === "ALL" && (
                              <span className='text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider flex items-center gap-1'>
                                <MapPin className='w-3 h-3' />{" "}
                                {cls.studioId?.studioName}
                              </span>
                            )}
                          </div>
                          <h3
                            className={`text-base md:text-lg font-bold mb-1 ${isExpired ? "text-gray-500" : "text-gray-900"}`}>
                            {cls.className}
                          </h3>
                          <div className='flex items-center gap-1.5 text-xs md:text-sm text-gray-500 mt-2'>
                            <User className='w-4 h-4 text-gray-400 shrink-0' />
                            <span className='truncate'>
                              {cls.instructorId?.fullName || "Instructor"}
                            </span>
                          </div>
                        </div>

                        {/* Action Container */}
                        <div className='flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center w-full md:w-auto gap-3 mt-1 md:mt-0'>
                          <div className='flex items-center gap-1.5 text-[11px] md:text-xs font-bold text-gray-500 bg-gray-50 px-2.5 py-1.5 md:px-3 md:py-1.5 rounded-lg'>
                            <Users className='w-3.5 h-3.5' />
                            <span>
                              {cls.capacity - cls.currentEnrollment} left
                            </span>
                          </div>
                          <button
                            onClick={() =>
                              !isExpired && !isFull && toggleCart(cls)
                            }
                            disabled={isFull || isExpired}
                            className={`flex-1 md:flex-none md:w-full py-2.5 md:py-3 px-4 font-bold rounded-xl transition-all text-xs md:text-sm flex items-center justify-center gap-2 ${isExpired || isFull ? "bg-gray-100 text-gray-400 cursor-not-allowed" : inCart ? "bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-emerald-200 group" : "bg-gray-900 text-white hover:bg-emerald-600 shadow-md active:scale-95"}`}>
                            {isExpired ? (
                              "Closed"
                            ) : isFull ? (
                              "Waitlist"
                            ) : inCart ? (
                              <>
                                <Check className='w-4 h-4 md:group-hover:hidden' />
                                <span className='md:group-hover:hidden'>
                                  Added
                                </span>
                                <span className='hidden md:group-hover:block'>
                                  Remove
                                </span>
                              </>
                            ) : (
                              <>
                                <Plus className='w-4 h-4' /> Add
                                <span className='hidden sm:inline'>
                                  to Cart
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='flex flex-col items-center justify-center py-16 md:py-20 bg-white rounded-3xl border border-dashed border-gray-200 mx-auto'>
                    <div className='bg-gray-50 w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center mb-4 md:mb-6'>
                      <CalendarIcon className='w-6 h-6 md:w-8 md:h-8 text-gray-300' />
                    </div>
                    <h3 className='text-gray-900 font-bold text-lg md:text-xl'>
                      No classes scheduled
                    </h3>
                    <p className='text-gray-500 text-xs md:text-sm mt-2 max-w-[250px] md:max-w-xs text-center leading-relaxed'>
                      No classes available on {format(selectedDate, "MMMM do")}{" "}
                      at this location.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- RIGHT: SIDEBAR (Calendar + Upcoming) --- */}
          <aside className='w-full lg:w-[380px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]'>
            {/* Desktop Calendar (Hidden on mobile) */}
            <div className='hidden lg:block'>{renderCalendar()}</div>

            {/* All Upcoming Classes */}
            <div className='bg-white rounded-3xl p-5 md:p-6 shadow-sm border border-gray-100 flex-1 flex flex-col min-h-[400px] lg:min-h-0'>
              <h3 className='text-base md:text-lg font-bold text-gray-900 mb-4 shrink-0'>
                All Upcoming Classes
              </h3>
              <div className='overflow-y-auto pr-2 space-y-3 custom-scrollbar flex-1'>
                {allUpcomingClasses.length > 0 ? (
                  allUpcomingClasses.map((cls) => {
                    const isFull = cls.currentEnrollment >= cls.capacity;
                    const inCart = cart.some((c) => c._id === cls._id);

                    return (
                      <div
                        key={cls._id}
                        className={`p-3.5 md:p-4 rounded-2xl border transition-all ${inCart ? "border-emerald-500 bg-emerald-50/20" : "border-gray-100 hover:border-emerald-200"}`}>
                        <div className='flex justify-between items-start mb-2'>
                          <div>
                            <h4
                              className='font-bold text-gray-900 text-sm line-clamp-1 pr-2'
                              title={cls.className}>
                              {cls.className}
                            </h4>
                            <p className='text-xs text-emerald-600 font-bold mt-0.5'>
                              {format(
                                new Date(cls.startTime),
                                "MMM do, h:mm a",
                              )}
                            </p>
                          </div>
                          <span
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${cls.classType === "Private" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
                            {cls.classType}
                          </span>
                        </div>

                        {selectedStudio === "ALL" && (
                          <div className='flex items-center gap-1 text-[10px] text-gray-500 mb-2'>
                            <MapPin className='w-3 h-3' />
                            <span className='truncate'>
                              {cls.studioId?.studioName}
                            </span>
                          </div>
                        )}

                        <div className='flex items-center justify-between mt-3 pt-3 border-t border-gray-50'>
                          <div className='flex items-center gap-1.5 text-xs text-gray-500'>
                            <User className='w-3.5 h-3.5 text-gray-400 shrink-0' />{" "}
                            <span className='truncate max-w-[140px]'>
                              {cls.instructorId?.fullName || "Instructor"}
                            </span>
                          </div>
                          <button
                            onClick={() => !isFull && toggleCart(cls)}
                            disabled={isFull}
                            className={`p-2 rounded-xl transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                              isFull
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : inCart
                                  ? "bg-red-50 text-red-600 hover:bg-red-100"
                                  : "bg-gray-900 text-white hover:bg-emerald-600"
                            }`}
                            title={
                              isFull
                                ? "Class Full"
                                : inCart
                                  ? "Remove from cart"
                                  : "Add to cart"
                            }>
                            {isFull ? (
                              <Users className='w-4 h-4' />
                            ) : inCart ? (
                              <X className='w-4 h-4' />
                            ) : (
                              <Plus className='w-4 h-4' />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='flex flex-col items-center justify-center py-10 h-full text-center'>
                    <CalendarIcon className='w-8 h-8 text-gray-200 mb-3' />
                    <p className='text-sm font-medium text-gray-500'>
                      No upcoming classes available.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        {/* --- BOTTOM FLOATING CART --- */}
        {cart.length > 0 && (
          <div className='fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] md:w-full max-w-2xl z-40 animate-in slide-in-from-bottom-6 duration-300 pb-[env(safe-area-inset-bottom)]'>
            <div className='bg-gray-900 text-white p-3 md:p-4 rounded-2xl shadow-2xl shadow-gray-900/30 flex items-center justify-between border border-gray-800'>
              <div className='flex items-center gap-3 md:gap-4'>
                <div className='relative shrink-0'>
                  <div className='bg-emerald-500 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-white'>
                    <ShoppingCart className='w-4 h-4 md:w-5 md:h-5' />
                  </div>
                  <div className='absolute -top-1.5 -right-1.5 md:-top-2 md:-right-2 bg-red-500 text-white text-[9px] md:text-[10px] font-bold w-4 h-4 md:w-5 md:h-5 rounded-full flex items-center justify-center shadow-sm'>
                    {cart.length}
                  </div>
                </div>
                <div>
                  <p className='font-bold text-sm md:text-base'>
                    Ready to Checkout?
                  </p>
                  <p className='text-[11px] md:text-xs text-gray-400'>
                    {cart.length} {cart.length === 1 ? "class" : "classes"}{" "}
                    selected
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBookingModal(true)}
                className='bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2.5 md:px-6 md:py-3 rounded-xl font-bold text-xs md:text-sm transition-colors shadow-lg active:scale-95 shrink-0'>
                Review & Book
              </button>
            </div>
          </div>
        )}

        {showBookingModal && (
          <BookingModal
            classes={cart}
            onClose={() => setShowBookingModal(false)}
            onConfirm={() => {
              setShowBookingModal(false);
              setCart([]);
              alert("Booking Successful!");
              fetchData();
            }}
          />
        )}
      </div>

      {/* --- MEDICAL WARNING MODAL --- */}
      {showMedicalWarning && (
        <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]'>
          <div className='bg-white w-full max-w-md rounded-[2rem] shadow-2xl p-6 md:p-8 text-center animate-in zoom-in-95'>
            <div className='w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5'>
              <Activity className='w-8 h-8' />
            </div>
            <h3 className='text-xl md:text-2xl font-bold text-gray-900 mb-2'>
              Action Required
            </h3>
            <p className='text-sm md:text-base text-gray-600 mb-6 md:mb-8 leading-relaxed'>
              Before booking a class, you must complete your Medical Profile and
              accept our Terms & Conditions for your safety.
            </p>
            <div className='flex flex-col-reverse sm:flex-row gap-3'>
              <button
                onClick={() => setShowMedicalWarning(false)}
                className='flex-1 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm md:text-base'>
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMedicalWarning(false);
                  navigate("/client-account-settings");
                }}
                className='flex-1 py-3.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg transition-colors text-sm md:text-base'>
                Go to Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BookTheClass;
