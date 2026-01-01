import React, { useState, useEffect } from "react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import {
  Calendar,
  MapPin,
  Users,
  ChevronLeft,
  ChevronRight,
  User,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import BookingModal from "./BookingModal";

const BookTheClass = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekStart, setWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
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
  }, [weekStart]);

  // --- Filter Classes for Selected Date ---
  const dailyClasses = classes.filter(
    (c) => isSameDay(new Date(c.startTime), selectedDate) && c.isActive
  );

  // --- Week Navigation ---
  const handlePrevWeek = () => {
    const newStart = addDays(weekStart, -7);
    setWeekStart(newStart);
    setSelectedDate(newStart);
  };

  const handleNextWeek = () => {
    const newStart = addDays(weekStart, 7);
    setWeekStart(newStart);
    setSelectedDate(newStart);
  };

  const formatTime = (isoString) => format(new Date(isoString), "h:mm a");

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      {/* Header */}
      <div className='mb-8'>
        <h1 className='text-2xl font-bold text-gray-900'>Book a Class</h1>
        <p className='text-gray-500 text-sm mt-1'>Find your perfect session.</p>
      </div>

      {/* Weekly Calendar Navigation */}
      <div className='bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-8'>
        <div className='flex items-center justify-between mb-4'>
          <h2 className='font-bold text-lg text-gray-800'>
            {format(weekStart, "MMMM yyyy")}
          </h2>
          <div className='flex gap-2'>
            <button
              onClick={handlePrevWeek}
              className='p-2 hover:bg-gray-100 rounded-lg transition-colors'>
              <ChevronLeft className='w-5 h-5' />
            </button>
            <button
              onClick={handleNextWeek}
              className='p-2 hover:bg-gray-100 rounded-lg transition-colors'>
              <ChevronRight className='w-5 h-5' />
            </button>
          </div>
        </div>

        <div className='grid grid-cols-7 gap-2'>
          {[0, 1, 2, 3, 4, 5, 6].map((dayOffset) => {
            const date = addDays(weekStart, dayOffset);
            const isSelected = isSameDay(date, selectedDate);
            return (
              <button
                key={dayOffset}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
                  isSelected
                    ? "bg-emerald-900 text-white shadow-lg shadow-emerald-900/20 transform scale-105"
                    : "hover:bg-gray-50 text-gray-500"
                }`}>
                <span className='text-xs font-medium uppercase mb-1'>
                  {format(date, "EEE")}
                </span>
                <span
                  className={`text-lg font-bold ${
                    isSelected ? "text-white" : "text-gray-900"
                  }`}>
                  {format(date, "d")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Classes List */}
      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className='space-y-4'>
          {dailyClasses.length > 0 ? (
            dailyClasses.map((cls) => {
              // --- LOGIC TO CHECK EXPIRY ---
              const isExpired = new Date(cls.startTime) < new Date();
              const isFull = cls.currentEnrollment >= cls.capacity;

              return (
                <div
                  key={cls._id}
                  className={`bg-white rounded-2xl p-5 border shadow-sm transition-all flex flex-col md:flex-row items-start md:items-center gap-6 group 
                    ${
                      isExpired
                        ? "border-gray-100 opacity-60 grayscale-[0.5] hover:shadow-none cursor-not-allowed"
                        : "border-gray-100 hover:shadow-md"
                    }`}>
                  {/* Time Column */}
                  <div
                    className={`flex flex-col items-center justify-center rounded-xl p-4 min-w-[100px] border transition-colors ${
                      isExpired
                        ? "bg-gray-100 border-gray-200 text-gray-400"
                        : "bg-gray-50 border-gray-100 group-hover:border-emerald-200 text-gray-900"
                    }`}>
                    <span className='text-lg font-bold'>
                      {formatTime(cls.startTime)}
                    </span>
                    <span className='text-xs opacity-70'>
                      {cls.duration} min
                    </span>
                  </div>

                  {/* Details Column */}
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-1'>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                          cls.classType === "Private"
                            ? "bg-purple-50 text-purple-700 border-purple-100"
                            : "bg-blue-50 text-blue-700 border-blue-100"
                        }`}>
                        {cls.classType}
                      </span>
                      <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wider'>
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
                        {cls.instructorId?.name || "Instructor"}
                      </div>
                    </div>
                  </div>

                  {/* Action Column */}
                  <div className='flex flex-col items-end gap-2 min-w-[140px] w-full md:w-auto'>
                    <div className='flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-50 px-3 py-1 rounded-lg'>
                      <Users className='w-4 h-4' />
                      <span>
                        {cls.capacity - cls.currentEnrollment} spots left
                      </span>
                    </div>

                    <button
                      onClick={() => !isExpired && setSelectedClass(cls)}
                      disabled={isFull || isExpired}
                      className={`w-full py-2.5 px-6 font-bold rounded-xl transition-all 
                        ${
                          isExpired
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-200"
                            : "bg-emerald-900 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-900/10 active:scale-95"
                        }
                        disabled:opacity-70 disabled:cursor-not-allowed
                      `}>
                      {isExpired ? "Closed" : isFull ? "Waitlist" : "Book Now"}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className='text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200'>
              <div className='bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4'>
                <Calendar className='w-8 h-8 text-gray-300' />
              </div>
              <h3 className='text-gray-900 font-bold text-lg'>
                No classes scheduled
              </h3>
              <p className='text-gray-400 text-sm mt-1'>
                Try selecting a different date.
              </p>
            </div>
          )}
        </div>
      )}

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
