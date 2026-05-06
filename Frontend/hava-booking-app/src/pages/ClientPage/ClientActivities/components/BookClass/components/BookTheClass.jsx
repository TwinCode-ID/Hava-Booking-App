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

  // Medical Record Status
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
      const [studiosRes, classesRes, medicalRes] = await Promise.all([
        axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
        axiosInstance.get(API_PATHS.SCHEDULE.GET_ALL),
        axiosInstance
          .get(API_PATHS.AUTH.MEDICAL_INFO(user._id))
          .catch(() => ({ data: null })),
      ]);
      setStudios(studiosRes.data);
      setClasses(classesRes.data);

      if (medicalRes.data && medicalRes.data.termsAndConditions) {
        setHasValidMedical(true);
      } else {
        setHasValidMedical(false);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // REAL-TIME SOCKET LISTENER: Instantly updates class capacities
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

  // Filter classes by Date AND Studio for the main left section
  const dailyClasses = classes.filter((c) => {
    const isStudioMatch =
      selectedStudio === "ALL" ||
      (selectedStudio && c.studioId?._id === selectedStudio._id);
    const isDateMatch = isSameDay(new Date(c.startTime), selectedDate);
    return isStudioMatch && isDateMatch && c.isActive;
  });

  // NEW: Filter ALL upcoming classes for the selected studio (ignoring the calendar date)
  const allUpcomingClasses = classes
    .filter((c) => {
      const isStudioMatch =
        selectedStudio === "ALL" ||
        (selectedStudio && c.studioId?._id === selectedStudio._id);
      const isFuture = new Date(c.startTime) >= new Date(); // Only show future classes
      return isStudioMatch && isFuture && c.isActive;
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
              {/* ALL LOCATIONS CARD */}
              <div
                onClick={() => setSelectedStudio("ALL")}
                className='bg-gray-900 rounded-3xl border border-gray-800 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col group'>
                <div className='relative h-56 w-full bg-gray-800 overflow-hidden flex flex-col items-center justify-center'>
                  <Globe className='w-16 h-16 text-emerald-400 group-hover:scale-110 transition-transform duration-500 mb-2' />
                  <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent'></div>
                  <div className='absolute bottom-5 left-5 right-5 text-white'>
                    <h3 className='text-xl font-bold leading-tight shadow-sm'>
                      All Locations
                    </h3>
                  </div>
                </div>
                <div className='p-6 flex-1 flex flex-col justify-center'>
                  <p className='text-gray-400 text-sm leading-relaxed font-medium'>
                    View the complete schedule and all available classes across
                    every studio location.
                  </p>
                </div>
              </div>

              {/* INDIVIDUAL STUDIOS */}
              {studios.map((studio) => {
                const firstImage = studio.studioPictures?.[0]?.[0] || null;
                const facilityList = studio.facilities?.[0] || [];
                return (
                  <div
                    key={studio._id}
                    onClick={() => setSelectedStudio(studio)}
                    className='bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col group'>
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
                      <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent'></div>
                      <div className='absolute bottom-5 left-5 right-5 text-white'>
                        <h3 className='text-xl font-bold leading-tight shadow-sm'>
                          {studio.studioName}
                        </h3>
                      </div>
                    </div>
                    <div className='p-6 flex-1 flex flex-col'>
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
                      {studio.contactNumber && (
                        <div className='flex items-center gap-3 text-sm text-gray-600 mb-6'>
                          <div className='p-2 bg-emerald-50 rounded-lg text-emerald-600 shrink-0'>
                            <Phone className='w-4 h-4' />
                          </div>
                          <a
                            href={`tel:+${studio.contactNumber}`}
                            onClick={(e) => e.stopPropagation()}
                            className='font-bold text-gray-900 hover:text-emerald-600 transition-colors'>
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

  return (
    <>
      <div className='min-h-screen bg-gray-50 font-sans p-6 md:p-10 pb-32 relative'>
        <div className='max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start'>
          {/* --- LEFT: SPECIFIC DATE CLASSES --- */}
          <div className='flex-1 w-full min-w-0'>
            <div className='flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4'>
              <div className='flex items-center gap-4'>
                <button
                  onClick={() => setSelectedStudio(null)}
                  className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
                  <ArrowLeft className='w-5 h-5' />
                </button>
                <div>
                  <h1 className='text-2xl font-bold text-gray-900'>
                    {selectedStudio === "ALL"
                      ? "All Locations"
                      : selectedStudio.studioName}
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
                        className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-6 ${isExpired ? "border-gray-100 opacity-60 grayscale-[0.5]" : "border-gray-100 hover:shadow-md"} ${inCart ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""}`}>
                        <div
                          className={`flex flex-col items-center justify-center rounded-2xl p-4 min-w-[90px] h-full border transition-colors ${isExpired ? "bg-gray-100 border-gray-200 text-gray-400" : "bg-gray-50 border-gray-100 text-gray-900"}`}>
                          <span className='text-lg font-bold'>
                            {formatTime(cls.startTime)}
                          </span>
                          <span className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mt-1'>
                            {cls.duration} min
                          </span>
                        </div>
                        <div className='flex-1'>
                          <div className='flex items-center gap-2 mb-2'>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${cls.classType === "Private" ? "bg-purple-50 text-purple-700 border-purple-100" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                              {cls.classType}
                            </span>
                            <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider'>
                              {cls.instructorType}
                            </span>
                            {selectedStudio === "ALL" && (
                              <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200 uppercase tracking-wider flex items-center gap-1'>
                                <MapPin className='w-3 h-3' />{" "}
                                {cls.studioId?.studioName}
                              </span>
                            )}
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
                            className={`w-full py-3 px-4 font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 ${isExpired || isFull ? "bg-gray-100 text-gray-400 cursor-not-allowed" : inCart ? "bg-emerald-100 text-emerald-800 hover:bg-red-50 hover:text-red-600 hover:border-red-100 border border-emerald-200 group" : "bg-gray-900 text-white hover:bg-emerald-600 shadow-md active:scale-95"}`}>
                            {isExpired ? (
                              "Closed"
                            ) : isFull ? (
                              "Waitlist"
                            ) : inCart ? (
                              <>
                                <Check className='w-4 h-4 group-hover:hidden' />
                                <span className='group-hover:hidden'>
                                  Added
                                </span>
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
                      No classes available on {format(selectedDate, "MMMM do")}{" "}
                      at this location.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* --- RIGHT: CALENDAR AND ALL CLASSES LIST --- */}
          <aside className='w-full lg:w-[380px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-6 lg:h-[calc(100vh-48px)]'>
            {/* Calendar Widget */}
            <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-100 shrink-0'>
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

            {/* All Upcoming Classes (Ignores selected date) */}
            <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex-1 flex flex-col min-h-0'>
              <h3 className='text-lg font-bold text-gray-900 mb-4 shrink-0'>
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
                        className={`p-4 rounded-2xl border transition-all ${inCart ? "border-emerald-500 bg-emerald-50/20" : "border-gray-100 hover:border-emerald-200"}`}>
                        <div className='flex justify-between items-start mb-2'>
                          <div>
                            <h4
                              className='font-bold text-gray-900 text-sm line-clamp-1'
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
                            className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${cls.classType === "Private" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
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
                            <User className='w-3.5 h-3.5 text-gray-400' />{" "}
                            <span className='truncate max-w-[120px]'>
                              {cls.instructorId?.fullName || "Instructor"}
                            </span>
                          </div>
                          <button
                            onClick={() => !isFull && toggleCart(cls)}
                            disabled={isFull}
                            className={`p-2 rounded-xl transition-colors ${
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

      {showMedicalWarning && (
        <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]'>
          <div className='bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 text-center animate-in zoom-in-95'>
            <div className='w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4'>
              <Activity className='w-8 h-8' />
            </div>
            <h3 className='text-2xl font-bold text-gray-900 mb-2'>
              Action Required
            </h3>
            <p className='text-gray-600 mb-6 leading-relaxed'>
              Before booking a class, you must complete your Medical Profile and
              accept our Terms & Conditions for your safety.
            </p>
            <div className='flex gap-3'>
              <button
                onClick={() => setShowMedicalWarning(false)}
                className='flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200'>
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowMedicalWarning(false);
                  navigate("/client-account-settings");
                }}
                className='flex-1 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg'>
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
