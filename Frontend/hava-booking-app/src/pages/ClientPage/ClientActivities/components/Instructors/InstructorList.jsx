import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Search,
  Filter,
  Users,
  Calendar,
  Check,
  X,
  Star,
  Clock,
  ChevronRight,
  Info,
  CheckCircle2,
  CalendarDays,
  UserCircle,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { fetchImage } from "../../../../../utils/helper";

const InstructorList = () => {
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [selectedInstructor, setSelectedInstructor] = useState(null);

  // --- Filter States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  const [selectedStudios, setSelectedStudios] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]);

  const DAYS = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL);
        setInstructors(response.data);
      } catch (error) {
        console.error("Failed to load instructors", error);
      } finally {
        setLoading(false);
      }
    };
    fetchInstructors();
  }, []);

  // --- Derived Options ---
  const uniqueTypes = [
    ...new Set(instructors.map((i) => i.instructorType).filter(Boolean)),
  ];

  const uniqueStudios = [
    ...new Set(
      instructors
        .flatMap((i) => i.assignedStudiosId.map((s) => s.studioName))
        .filter(Boolean),
    ),
  ];

  // --- Filtering Logic ---
  const filteredInstructors = instructors.filter((instructor) => {
    const matchSearch = instructor.fullName
      .toLowerCase()
      .includes(searchQuery.toLowerCase());

    const matchType =
      selectedTypes.length === 0 ||
      selectedTypes.includes(instructor.instructorType);

    const instructorStudios = instructor.assignedStudiosId.map(
      (s) => s.studioName,
    );
    const matchStudio =
      selectedStudios.length === 0 ||
      selectedStudios.some((s) => instructorStudios.includes(s));

    const matchDay =
      selectedDays.length === 0 ||
      selectedDays.some(
        (day) =>
          instructor.workingHours &&
          instructor.workingHours[day] &&
          instructor.workingHours[day].length > 0,
      );

    return matchSearch && matchType && matchStudio && matchDay;
  });

  const toggleFilter = (state, setter, value) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const getActiveFilterCount = () => {
    return selectedTypes.length + selectedStudios.length + selectedDays.length;
  };

  const clearAllFilters = () => {
    setSelectedTypes([]);
    setSelectedStudios([]);
    setSelectedDays([]);
    setSearchQuery("");
  };

  // --- Shared Filter UI Component ---
  const renderFilters = () => (
    <div className='space-y-8'>
      {/* Filter: Instructor Level */}
      <div className='space-y-4'>
        <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
          <Star className='w-4 h-4 text-gray-400' /> Level
        </h3>
        <div className='space-y-3 md:space-y-2'>
          {uniqueTypes.map((type) => (
            <label
              key={type}
              className='flex items-center gap-3 cursor-pointer group py-1'>
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                  selectedTypes.includes(type)
                    ? "bg-emerald-600 border-emerald-600"
                    : "border-gray-300 bg-white group-hover:border-emerald-400"
                }`}>
                {selectedTypes.includes(type) && (
                  <Check className='w-3.5 h-3.5 text-white' />
                )}
              </div>
              <input
                type='checkbox'
                className='hidden'
                checked={selectedTypes.includes(type)}
                onChange={() =>
                  toggleFilter(selectedTypes, setSelectedTypes, type)
                }
              />
              <span
                className={`text-sm md:text-[15px] ${
                  selectedTypes.includes(type)
                    ? "font-bold text-gray-900"
                    : "font-medium text-gray-600"
                }`}>
                {type}
              </span>
            </label>
          ))}
        </div>
      </div>

      <hr className='border-gray-100' />

      {/* Filter: Studio */}
      <div className='space-y-4'>
        <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
          <MapPin className='w-4 h-4 text-gray-400' /> Studio Location
        </h3>
        <div className='space-y-3 md:space-y-2'>
          {uniqueStudios.map((studio) => (
            <label
              key={studio}
              className='flex items-center gap-3 cursor-pointer group py-1'>
              <div
                className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                  selectedStudios.includes(studio)
                    ? "bg-emerald-600 border-emerald-600"
                    : "border-gray-300 bg-white group-hover:border-emerald-400"
                }`}>
                {selectedStudios.includes(studio) && (
                  <Check className='w-3.5 h-3.5 text-white' />
                )}
              </div>
              <input
                type='checkbox'
                className='hidden'
                checked={selectedStudios.includes(studio)}
                onChange={() =>
                  toggleFilter(selectedStudios, setSelectedStudios, studio)
                }
              />
              <span
                className={`text-sm md:text-[15px] ${
                  selectedStudios.includes(studio)
                    ? "font-bold text-gray-900"
                    : "font-medium text-gray-600"
                }`}>
                {studio}
              </span>
            </label>
          ))}
        </div>
      </div>

      <hr className='border-gray-100' />

      {/* Filter: Availability (Day) */}
      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
            <Calendar className='w-4 h-4 text-gray-400' /> Available On
          </h3>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          {DAYS.map((day) => {
            const isSelected = selectedDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => toggleFilter(selectedDays, setSelectedDays, day)}
                className={`px-3 py-2.5 md:py-2 rounded-xl md:rounded-lg text-xs md:text-[13px] font-bold capitalize transition-all border ${
                  isSelected
                    ? "bg-gray-900 text-white border-gray-900 shadow-md"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  if (loading)
    return (
      <div className='min-h-[60vh] flex flex-col items-center justify-center'>
        <LoadingSpinner />
        <p className='text-gray-500 font-medium mt-4 text-sm'>
          Loading instructors...
        </p>
      </div>
    );

  return (
    <div className='min-h-screen bg-gray-50/50 font-sans text-gray-900 flex flex-col'>
      <div className='container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-7xl'>
        <div className='flex flex-col lg:flex-row gap-8 xl:gap-12'>
          {/* --- LEFT SIDEBAR (Desktop Filters) --- */}
          <aside className='hidden lg:block lg:w-64 xl:w-72 shrink-0 sticky top-24 h-fit'>
            <div className='bg-white border border-gray-200 rounded-3xl p-6 shadow-sm'>
              <div className='flex items-center justify-between mb-6'>
                <h3 className='font-bold text-lg'>Filters</h3>
                {getActiveFilterCount() > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className='text-xs font-bold text-emerald-600 hover:text-emerald-700'>
                    Clear All
                  </button>
                )}
              </div>
              <hr className='border-gray-100 mb-6' />
              {renderFilters()}
            </div>
          </aside>

          {/* --- MAIN GRID --- */}
          <div className='flex-1 min-w-0'>
            {/* Header Area: Search */}
            <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8 pb-4 md:pb-6 border-b border-gray-200/60'>
              <div>
                <h1 className='text-2xl md:text-3xl font-bold text-gray-900 tracking-tight'>
                  Our Instructors
                </h1>
                <p className='text-gray-500 text-sm mt-1'>
                  Showing{" "}
                  <span className='font-bold text-gray-900'>
                    {filteredInstructors.length}
                  </span>{" "}
                  instructors
                </p>
              </div>

              <div className='flex gap-3 w-full sm:w-auto'>
                <div className='relative flex-1 sm:w-64 md:w-72'>
                  <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-gray-400' />
                  <input
                    type='text'
                    placeholder='Search instructor...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full pl-10 pr-4 py-3 md:py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm'
                  />
                </div>
                <button
                  className='lg:hidden flex items-center justify-center gap-2 text-sm font-bold text-gray-900 bg-white border border-gray-200 px-4 py-3 rounded-xl hover:bg-gray-50 transition-colors shadow-sm relative shrink-0'
                  onClick={() => setShowMobileFilters(true)}>
                  <Filter className='w-4 h-4' />
                  {getActiveFilterCount() > 0 && (
                    <span className='absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white'>
                      {getActiveFilterCount()}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 lg:gap-8'>
              {filteredInstructors.length > 0 ? (
                filteredInstructors.map((instructor) => (
                  <InstructorCard
                    key={instructor._id}
                    data={instructor}
                    onClick={() => setSelectedInstructor(instructor)}
                  />
                ))
              ) : (
                <div className='col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200'>
                  <div className='w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-gray-300'>
                    <UserCircle className='w-8 h-8' />
                  </div>
                  <h3 className='text-lg font-bold text-gray-900 mb-2'>
                    No instructors found
                  </h3>
                  <p className='text-sm text-gray-500 max-w-sm mx-auto'>
                    We couldn't find any instructors matching your current
                    filters or search criteria.
                  </p>
                  {getActiveFilterCount() > 0 && (
                    <button
                      onClick={clearAllFilters}
                      className='mt-6 px-6 py-2.5 bg-emerald-50 text-emerald-700 font-bold rounded-xl text-sm hover:bg-emerald-100 transition-colors'>
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* --- MOBILE FILTERS SHEET --- */}
      <AnimatePresence>
        {showMobileFilters && (
          <div className='fixed inset-0 z-50 flex items-end justify-center lg:hidden p-0 bg-black/60 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileFilters(false)}
              className='absolute inset-0'
            />
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className='relative bg-white w-full max-h-[90vh] rounded-t-[2rem] shadow-2xl flex flex-col pb-safe overflow-hidden'>
              {/* Drag Handle */}
              <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 shrink-0' />

              {/* Header */}
              <div className='flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0'>
                <div>
                  <h3 className='font-bold text-xl'>Filters</h3>
                  {getActiveFilterCount() > 0 && (
                    <p className='text-xs text-gray-500 mt-0.5'>
                      {getActiveFilterCount()} active filters
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className='p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors'>
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>

              {/* Scrollable Filters */}
              <div className='p-6 overflow-y-auto flex-1 custom-scrollbar overscroll-contain'>
                {renderFilters()}
              </div>

              {/* Sticky Footer */}
              <div className='p-4 md:p-6 border-t border-gray-100 bg-white shrink-0 flex gap-3'>
                <button
                  onClick={clearAllFilters}
                  disabled={getActiveFilterCount() === 0}
                  className='px-6 py-3.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200 transition-colors disabled:opacity-50 flex-1 md:flex-none'>
                  Reset
                </button>
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className='flex-[2] py-3.5 bg-gray-900 text-white font-bold rounded-xl text-sm hover:bg-emerald-600 transition-colors shadow-lg shadow-gray-200'>
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- INSTRUCTOR DETAIL MODAL --- */}
      <AnimatePresence>
        {selectedInstructor && (
          <InstructorDetailModal
            instructor={selectedInstructor}
            onClose={() => setSelectedInstructor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Component: Clickable Instructor Card ---
const InstructorCard = ({ data, onClick }) => {
  const activeDays = Object.keys(data.workingHours || {}).filter(
    (day) => data.workingHours[day] && data.workingHours[day].length > 0,
  );

  return (
    <div
      onClick={onClick}
      className='group flex flex-col h-full cursor-pointer bg-white border border-gray-200 rounded-3xl p-5 md:p-6 hover:shadow-xl hover:border-emerald-500 transition-all duration-300 relative overflow-hidden active:scale-[0.98] md:active:scale-100'>
      {/* Accent Strip */}
      <div className='absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />

      <div className='flex items-start justify-between mb-5 md:mb-6'>
        <div className='w-14 h-14 md:w-16 md:h-16 rounded-full p-1 bg-gradient-to-br from-emerald-100 to-white shadow-sm shrink-0'>
          <img
            src={fetchImage(data.avatar) || "https://via.placeholder.com/150"}
            alt={data.fullName}
            className='w-full h-full object-cover rounded-full bg-gray-100'
          />
        </div>
        <div className='text-right ml-3'>
          <span className='inline-block bg-emerald-50 text-emerald-800 text-[9px] md:text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border border-emerald-100'>
            {data.instructorType}
          </span>
        </div>
      </div>

      <div className='flex-1 mb-5 md:mb-6'>
        <h3 className='font-bold text-gray-900 text-lg md:text-xl mb-1.5 md:mb-2 group-hover:text-emerald-700 transition-colors line-clamp-1'>
          {data.fullName}
        </h3>

        {/* Short Bio Snippet */}
        <p className='text-gray-500 text-[13px] md:text-sm line-clamp-2 h-10'>
          {data.bio ||
            "Experience professional training with our certified instructor."}
        </p>

        <div className='grid grid-cols-2 gap-3 md:gap-4 text-sm mt-5 md:mt-6 pt-2'>
          <div className='flex items-center gap-1.5 md:gap-2 text-gray-700'>
            <MapPin className='w-[14px] h-[14px] md:w-4 md:h-4 text-gray-400 shrink-0' />
            <span className='font-medium text-[11px] md:text-xs truncate'>
              {data.assignedStudiosId.length}{" "}
              {data.assignedStudiosId.length === 1 ? "Studio" : "Studios"}
            </span>
          </div>
          <div className='flex items-center gap-1.5 md:gap-2 text-gray-700'>
            <CalendarDays className='w-[14px] h-[14px] md:w-4 md:h-4 text-gray-400 shrink-0' />
            <span className='font-medium text-[11px] md:text-xs truncate'>
              {activeDays.length > 0
                ? `${activeDays.length} Days/Week`
                : "Unavailable"}
            </span>
          </div>
        </div>
      </div>

      <div className='pt-4 border-t border-gray-100 flex items-center justify-between mt-auto'>
        <div className='flex items-center gap-1.5 md:gap-2'>
          {data.isActive ? (
            <>
              <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
              <span className='text-[10px] md:text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Active Now
              </span>
            </>
          ) : (
            <span className='text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Offline
            </span>
          )}
        </div>
        <button className='w-8 h-8 md:w-9 md:h-9 rounded-full bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 transition-all'>
          <ChevronRight className='w-4 h-4 md:w-5 md:h-5' />
        </button>
      </div>
    </div>
  );
};

// --- Sub-Component: Detail Modal ---
const InstructorDetailModal = ({ instructor, onClose }) => {
  const DAYS_ORDER = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  const hasSchedule =
    instructor.workingHours &&
    Object.values(instructor.workingHours).some((day) => day?.length > 0);

  return (
    <div className='fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0'
      />
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className='relative bg-white w-full max-w-xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh]'>
        {/* Mobile Drag Handle */}
        <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 hidden max-md:block shrink-0' />

        {/* Header */}
        <div className='flex justify-between items-center px-6 py-4 md:p-6 border-b border-gray-100 bg-white shrink-0 z-10'>
          <div>
            <h2 className='text-lg md:text-xl font-bold text-gray-900'>
              Instructor Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full transition-colors'>
            <X className='w-6 h-6 md:w-5 md:h-5 text-gray-500' />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className='p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar overscroll-contain pb-safe'>
          {/* Avatar & Name */}
          <div className='flex flex-col items-center text-center mb-8'>
            <div className='w-20 h-20 md:w-24 md:h-24 rounded-full p-1 bg-gradient-to-br from-emerald-200 to-emerald-50 mb-4 md:mb-5 shadow-lg shrink-0'>
              <img
                src={
                  fetchImage(instructor.avatar) ||
                  "https://via.placeholder.com/150"
                }
                alt={instructor.fullName}
                className='w-full h-full object-cover rounded-full bg-white border-[3px] border-white'
              />
            </div>
            <h2 className='text-xl md:text-2xl font-bold text-gray-900'>
              {instructor.fullName}
            </h2>
            <div className='mt-2'>
              <span className='px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded-md border border-emerald-100'>
                {instructor.instructorType}
              </span>
            </div>
          </div>

          <div className='space-y-6 md:space-y-8'>
            {/* Bio */}
            <div>
              <h4 className='text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-2'>
                Biography
              </h4>
              <div className='bg-gray-50/80 p-4 md:p-5 rounded-2xl border border-gray-100'>
                <p className='text-gray-600 text-[13px] md:text-sm leading-relaxed'>
                  {instructor.bio ||
                    "No biography available for this instructor at the moment."}
                </p>
              </div>
            </div>

            {/* Teaching Locations */}
            <div>
              <h4 className='text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-2'>
                Teaching Locations
              </h4>
              <div className='grid grid-cols-1 gap-2 md:gap-3'>
                {instructor.assignedStudiosId.length > 0 ? (
                  instructor.assignedStudiosId.map((studio) => (
                    <div
                      key={studio._id}
                      className='px-4 py-3.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 shadow-sm flex items-center gap-3'>
                      <div className='p-2 bg-emerald-50 rounded-full text-emerald-600 shrink-0'>
                        <MapPin className='w-4 h-4' />
                      </div>
                      <span className='font-bold text-[13px] md:text-sm'>
                        {studio.studioName}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-gray-500 italic px-2'>
                    No studios assigned.
                  </p>
                )}
              </div>
            </div>

            {/* Schedule */}
            <div>
              <h4 className='text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 md:mb-3 flex items-center gap-2'>
                <Clock className='w-3 h-3 md:w-3.5 md:h-3.5' /> Weekly Schedule
              </h4>
              <div className='bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm'>
                {hasSchedule ? (
                  DAYS_ORDER.map((day) => {
                    const timeSlots = instructor.workingHours?.[day] || [];
                    if (timeSlots.length === 0) return null;

                    return (
                      <div
                        key={day}
                        className='flex flex-col sm:flex-row sm:items-start p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors'>
                        <div className='sm:w-28 shrink-0 mb-3 sm:mb-0'>
                          <span className='text-[13px] md:text-sm font-bold text-gray-900 capitalize block mt-0.5'>
                            {day}
                          </span>
                        </div>
                        <div className='flex flex-wrap gap-2 flex-1'>
                          {timeSlots.map((slot, index) => (
                            <span
                              key={slot._id || index}
                              className='px-2.5 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] md:text-xs font-bold rounded-lg border border-emerald-100'>
                              {slot.start} - {slot.end}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className='p-6 text-center text-gray-500 text-sm italic'>
                    No schedule available currently.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className='p-4 md:p-6 bg-white border-t border-gray-100 shrink-0 pb-safe'>
          <button
            onClick={onClose}
            className='w-full py-3.5 md:py-3 bg-gray-900 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-gray-200 active:scale-[0.98] md:active:scale-100'>
            Close Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default InstructorList;
