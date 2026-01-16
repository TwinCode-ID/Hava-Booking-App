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
// Assuming you want the Footer here as well since it was in the reference

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
        .filter(Boolean)
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
      (s) => s.studioName
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
          instructor.workingHours[day].length > 0
      );

    return matchSearch && matchType && matchStudio && matchDay;
  });

  const toggleFilter = (state, setter, value) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value]
    );
  };

  if (loading)
    return (
      <div className='h-screen flex items-center justify-center bg-white'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='min-h-screen bg-white font-sans text-gray-900 flex flex-col'>
      <div className='container mx-auto px-4 md:px-6 py-12'>
        <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
          {/* --- LEFT SIDEBAR (Filters) --- */}
          <aside
            className={`lg:w-64 xl:w-72 shrink-0 space-y-8 ${
              showMobileFilters
                ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto block"
                : "hidden lg:block sticky top-32 h-fit"
            }`}>
            <div className='flex items-center justify-between lg:hidden mb-8'>
              <h3 className='font-bold text-xl'>Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className='p-2 bg-gray-100 rounded-full'>
                <X className='w-5 h-5' />
              </button>
            </div>

            <hr className='border-gray-100' />

            {/* Filter: Instructor Level */}
            <div className='space-y-4'>
              <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
                <Star className='w-4 h-4 text-gray-400' /> Level
              </h3>
              <div className='space-y-2'>
                {uniqueTypes.map((type) => (
                  <label
                    key={type}
                    className='flex items-center gap-3 cursor-pointer group py-1'>
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
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
                      className={`text-sm ${
                        selectedTypes.includes(type)
                          ? "font-medium text-gray-900"
                          : "text-gray-600"
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
              <div className='space-y-2'>
                {uniqueStudios.map((studio) => (
                  <label
                    key={studio}
                    className='flex items-center gap-3 cursor-pointer group py-1'>
                    <div
                      className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
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
                        toggleFilter(
                          selectedStudios,
                          setSelectedStudios,
                          studio
                        )
                      }
                    />
                    <span
                      className={`text-sm ${
                        selectedStudios.includes(studio)
                          ? "font-medium text-gray-900"
                          : "text-gray-600"
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
              <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
                <Calendar className='w-4 h-4 text-gray-400' /> Available On
              </h3>
              <div className='grid grid-cols-2 gap-2'>
                {DAYS.map((day) => {
                  const isSelected = selectedDays.includes(day);
                  return (
                    <button
                      key={day}
                      onClick={() =>
                        toggleFilter(selectedDays, setSelectedDays, day)
                      }
                      className={`px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all border ${
                        isSelected
                          ? "bg-gray-900 text-white border-gray-900"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}>
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* --- MAIN GRID --- */}
          <div className='flex-1'>
            {/* Header Area: Search */}
            <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-100'>
              <p className='text-gray-500 text-sm'>
                Showing{" "}
                <span className='font-bold text-gray-900'>
                  {filteredInstructors.length}
                </span>{" "}
                instructors
              </p>

              <div className='flex gap-2 w-full md:w-auto'>
                <div className='relative flex-1 md:w-64'>
                  <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                  <input
                    type='text'
                    placeholder='Search instructor...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className='w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
                  />
                </div>
                <button
                  className='lg:hidden flex items-center gap-2 text-sm font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors'
                  onClick={() => setShowMobileFilters(true)}>
                  <Filter className='w-4 h-4' />
                </button>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10'>
              {filteredInstructors.length > 0 ? (
                filteredInstructors.map((instructor) => (
                  <InstructorCard
                    key={instructor._id}
                    data={instructor}
                    onClick={() => setSelectedInstructor(instructor)}
                  />
                ))
              ) : (
                <div className='col-span-full py-20 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200'>
                  <div className='w-16 h-16 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm text-gray-300'>
                    <UserCircle className='w-8 h-8' />
                  </div>
                  <h3 className='text-lg font-bold text-gray-900 mb-2'>
                    No instructors found
                  </h3>
                  <p className='text-gray-500'>
                    Try adjusting your filters or search.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
    (day) => data.workingHours[day] && data.workingHours[day].length > 0
  );

  return (
    <div
      onClick={onClick}
      className='group flex flex-col h-full cursor-pointer bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-emerald-500 transition-all duration-300 relative overflow-hidden'>
      {/* Accent Strip */}
      <div className='absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />

      <div className='flex items-start justify-between mb-6'>
        <div className='w-16 h-16 rounded-full p-1 bg-gradient-to-br from-emerald-100 to-white shadow-sm'>
          <img
            src={data.avatar || "https://via.placeholder.com/150"}
            alt={data.fullName}
            className='w-full h-full object-cover rounded-full bg-gray-100'
          />
        </div>
        <div>
          <span className='inline-block bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md'>
            {data.instructorType}
          </span>
        </div>
      </div>

      <div className='flex-1 mb-6'>
        <h3 className='font-bold text-gray-900 text-xl mb-2 group-hover:text-emerald-700 transition-colors'>
          {data.fullName}
        </h3>
        {/* Short Bio Snippet */}
        <p className='text-gray-500 text-sm line-clamp-2 mb-4 h-10'>
          {data.bio ||
            "Experience professional training with our certified instructor."}
        </p>

        <div className='grid grid-cols-2 gap-4 text-sm mt-auto pt-2'>
          <div className='flex items-center gap-2 text-gray-700'>
            <MapPin className='w-4 h-4 text-gray-400' />
            <span className='font-medium text-xs'>
              {data.assignedStudiosId.length}{" "}
              {data.assignedStudiosId.length === 1 ? "Studio" : "Studios"}
            </span>
          </div>
          <div className='flex items-center gap-2 text-gray-700'>
            <CalendarDays className='w-4 h-4 text-gray-400' />
            <span className='font-medium text-xs'>
              {activeDays.length > 0
                ? `${activeDays.length} Days/Week`
                : "Unavailable"}
            </span>
          </div>
        </div>
      </div>

      <div className='pt-4 border-t border-gray-100 flex items-center justify-between'>
        <div className='flex items-center gap-1.5'>
          {data.isActive ? (
            <>
              <div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse'></div>
              <span className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                Active Now
              </span>
            </>
          ) : (
            <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Offline
            </span>
          )}
        </div>
        <button className='w-8 h-8 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all'>
          <ChevronRight className='w-5 h-5' />
        </button>
      </div>
    </div>
  );
};

// --- Sub-Component: Detail Modal (Matches ManagePackage Modal Style) ---
const InstructorDetailModal = ({ instructor, onClose }) => {
  // Helper to ensure days are ordered correctly
  const DAYS_ORDER = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];

  // Check if there are any working hours in any of the days
  const hasSchedule =
    instructor.workingHours &&
    Object.values(instructor.workingHours).some((day) => day?.length > 0);

  return (
    <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 sm:p-6'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ opacity: 0, y: 100, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 100, scale: 0.95 }}
        className='relative bg-white w-full max-w-lg rounded-t-[2rem] md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
        {/* Header */}
        <div className='flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white z-10'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>
              Instructor Profile
            </h2>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
            <X className='w-6 h-6 text-gray-500' />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className='p-8 overflow-y-auto'>
          {/* Avatar & Name */}
          <div className='flex flex-col items-center text-center mb-8'>
            <div className='w-24 h-24 rounded-full p-1 bg-gradient-to-br from-emerald-200 to-emerald-50 mb-4 shadow-lg'>
              <img
                src={instructor.avatar || "https://via.placeholder.com/150"}
                alt={instructor.fullName}
                className='w-full h-full object-cover rounded-full bg-white border-4 border-white'
              />
            </div>
            <h2 className='text-2xl font-bold text-gray-900'>
              {instructor.fullName}
            </h2>
            <div className='mt-2'>
              <span className='px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider rounded-md border border-emerald-100'>
                {instructor.instructorType}
              </span>
            </div>
          </div>

          <div className='space-y-6'>
            {/* Bio */}
            <div>
              <h4 className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2'>
                Biography
              </h4>
              <div className='bg-gray-50 p-5 rounded-xl border border-gray-100'>
                <p className='text-gray-600 text-sm leading-relaxed'>
                  {instructor.bio ||
                    "No biography available for this instructor."}
                </p>
              </div>
            </div>

            {/* Teaching Locations */}
            <div>
              <h4 className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2'>
                Teaching Locations
              </h4>
              <div className='grid grid-cols-1 gap-2'>
                {instructor.assignedStudiosId.length > 0 ? (
                  instructor.assignedStudiosId.map((studio) => (
                    <div
                      key={studio._id}
                      className='px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 shadow-sm flex items-center gap-3'>
                      <div className='p-2 bg-emerald-50 rounded-full text-emerald-600'>
                        <MapPin className='w-4 h-4' />
                      </div>
                      <span className='font-medium'>{studio.studioName}</span>
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-gray-500 italic'>
                    No studios assigned.
                  </p>
                )}
              </div>
            </div>

            {/* --- FIXED SECTION: SCHEDULE --- */}
            <div>
              <h4 className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2'>
                <Clock className='w-3 h-3' /> Weekly Schedule
              </h4>
              <div className='bg-white border border-gray-200 rounded-xl overflow-hidden'>
                {hasSchedule ? (
                  DAYS_ORDER.map((day) => {
                    const timeSlots = instructor.workingHours?.[day] || [];
                    if (timeSlots.length === 0) return null;

                    return (
                      <div
                        key={day}
                        className='flex flex-col sm:flex-row sm:items-start p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors'>
                        <div className='w-24 shrink-0 mb-2 sm:mb-0'>
                          <span className='text-sm font-bold text-gray-900 capitalize block'>
                            {day}
                          </span>
                        </div>
                        <div className='flex flex-wrap gap-2 flex-1'>
                          {timeSlots.map((slot, index) => (
                            <span
                              key={slot._id || index}
                              className='px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-md border border-emerald-100'>
                              {/* RENDER OBJECT PROPERTIES INSTEAD OF OBJECT DIRECTLY */}
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
            {/* --------------------------- */}
          </div>
        </div>

        <div className='p-4 bg-gray-50 border-t border-gray-100 flex justify-end'>
          <button
            onClick={onClose}
            className='px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-xl font-bold text-sm transition-colors shadow-lg'>
            Close Profile
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default InstructorList;
