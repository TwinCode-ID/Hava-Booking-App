import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom"; // 1. Import useNavigate
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
  History,
  Calendar as CalendarIcon,
  ArrowLeft, // 2. Import ArrowLeft
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import BookingModal from "./BookingModal";

const BookTheClass = () => {
  const navigate = useNavigate(); // 3. Initialize hook

  // --- States ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState(null);

  // --- Fetch Classes ---
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_PATHS.SCHEDULE.GET_ALL);
        setClasses(response.data);
      } catch (error) {
        console.error("Failed to fetch schedule", error);
      } finally {
        setLoading(false);
      }
    };
    fetchClasses();
  }, [currentMonth]);

  // --- Calendar Logic ---
  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const weekDays = ["S", "M", "T", "W", "T", "F", "S"];

  // --- Filtering Logic ---
  const dailyClasses = classes.filter(
    (c) => isSameDay(new Date(c.startTime), selectedDate) && c.isActive
  );

  const formatTime = (isoString) => format(new Date(isoString), "h:mm a");

  return (
    <div className='min-h-screen bg-gray-50 font-sans p-6 md:p-10'>
      <div className='max-w-7xl mx-auto flex flex-col lg:flex-row gap-8 items-start'>
        {/* --- MAIN CONTENT (Class List) --- */}
        <div className='flex-1 w-full min-w-0'>
          {/* Header with Back Button */}
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-4'>
              <button
                onClick={() => navigate(-1)}
                className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-colors shadow-sm'>
                <ArrowLeft className='w-5 h-5' />
              </button>
              <h1 className='text-2xl font-bold text-gray-900'>
                Available Classes
              </h1>
            </div>
            <span className='text-gray-500 text-sm font-medium hidden sm:block'>
              {format(selectedDate, "EEEE, d MMMM yyyy")}
            </span>
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

                  return (
                    <div
                      key={cls._id}
                      className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-6 group 
                        ${
                          isExpired
                            ? "border-gray-100 opacity-60 grayscale-[0.5] hover:shadow-none cursor-not-allowed"
                            : "border-gray-100 hover:shadow-md hover:border-emerald-100"
                        }`}>
                      {/* Time Column */}
                      <div
                        className={`flex flex-col items-center justify-center rounded-2xl p-4 min-w-[90px] h-full border transition-colors ${
                          isExpired
                            ? "bg-gray-100 border-gray-200 text-gray-400"
                            : "bg-gray-50 border-gray-100 group-hover:bg-emerald-50/50 group-hover:border-emerald-200 text-gray-900"
                        }`}>
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
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                              cls.classType === "Private"
                                ? "bg-purple-50 text-purple-700 border-purple-100"
                                : "bg-blue-50 text-blue-700 border-blue-100"
                            }`}>
                            {cls.classType}
                          </span>
                          <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider'>
                            {cls.instructorType}
                          </span>
                        </div>

                        <h3
                          className={`text-lg font-bold mb-1 ${
                            isExpired ? "text-gray-500" : "text-gray-900"
                          }`}>
                          {cls.className}
                        </h3>

                        <div className='flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 mt-2'>
                          <div className='flex items-center gap-1.5'>
                            <MapPin className='w-4 h-4 text-gray-400' />
                            {cls.studioId?.studioName || "Unknown Studio"}
                          </div>
                          <div className='flex items-center gap-1.5'>
                            <User className='w-4 h-4 text-gray-400' />
                            {cls.instructorId?.fullName || "Instructor"}
                          </div>
                        </div>
                      </div>

                      {/* Action Column */}
                      <div className='flex flex-col items-end gap-3 min-w-[140px] w-full md:w-auto'>
                        <div className='flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg'>
                          <Users className='w-3.5 h-3.5' />
                          <span>
                            {cls.capacity - cls.currentEnrollment} spots left
                          </span>
                        </div>

                        <button
                          onClick={() => !isExpired && setSelectedClass(cls)}
                          disabled={isFull || isExpired}
                          className={`w-full py-3 px-6 font-bold rounded-xl transition-all text-sm
                            ${
                              isExpired
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-emerald-900 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-900/10 active:scale-95"
                            }
                            disabled:opacity-70 disabled:cursor-not-allowed
                          `}>
                          {isExpired
                            ? "Closed"
                            : isFull
                            ? "Waitlist"
                            : "Book Class"}
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
                    There are no classes available for{" "}
                    {format(selectedDate, "MMMM do")}. Try selecting another
                    date from the calendar.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* --- RIGHT SIDEBAR (Calendar & Activity) --- */}
        <aside className='w-full lg:w-[380px] shrink-0 space-y-6 sticky top-6'>
          {/* 1. Monthly Calendar Widget */}
          <div className='bg-white rounded-3xl p-6 shadow-sm border border-gray-100'>
            {/* Header */}
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

            {/* Days Header */}
            <div className='grid grid-cols-7 mb-2'>
              {weekDays.map((day) => (
                <div
                  key={day}
                  className='h-10 flex items-center justify-center text-xs font-bold text-gray-400'>
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className='grid grid-cols-7 gap-y-2'>
              {calendarDays.map((day, idx) => {
                const isSelected = isSameDay(day, selectedDate);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                  <div key={idx} className='flex justify-center'>
                    <button
                      onClick={() => setSelectedDate(day)}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                        ${
                          isSelected
                            ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/20"
                            : isTodayDate
                            ? "bg-emerald-50 text-emerald-700 font-bold"
                            : "hover:bg-gray-50 text-gray-700"
                        }
                        ${!isCurrentMonth && "text-gray-300"}
                      `}>
                      {format(day, "d")}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>

      {/* Booking Confirmation Modal */}
      {selectedClass && (
        <BookingModal
          cls={selectedClass}
          onClose={() => setSelectedClass(null)}
          onConfirm={() => {
            setSelectedClass(null);
            alert("Booking Successful!");
          }}
        />
      )}
    </div>
  );
};

export default BookTheClass;
