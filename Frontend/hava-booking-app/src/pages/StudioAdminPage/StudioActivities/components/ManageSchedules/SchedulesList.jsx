import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  subMonths,
  addMonths,
  isSameDay,
  isSameWeek,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  parseISO,
  setHours,
  setMinutes,
  isValid,
  getDay,
  addMinutes,
  isWithinInterval,
} from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Repeat,
  X,
  Printer,
  FileText,
  ChevronDown,
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Edit,
  Power,
  Users,
  Check,
  AlertTriangle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import CustomSelect from "../Layout/CustomSelect";

const SchedulesList = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modals State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [editingClass, setEditingClass] = useState(null);

  // Header Calendar State
  const [showDatePicker, setShowDatePicker] = useState(false);
  const headerCalendarRef = useRef(null);

  const [instructors, setInstructors] = useState([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // Close header calendar on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        headerCalendarRef.current &&
        !headerCalendarRef.current.contains(event.target)
      ) {
        setShowDatePicker(false);
      }
    };
    if (showDatePicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  useEffect(() => {
    fetchSchedule();
  }, [currentDate, user.adminStudioLocation]);

  useEffect(() => {
    const fetchInstructors = async () => {
      try {
        const res = await axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL);
        setInstructors(res.data);
      } catch (e) {
        console.error("Failed to load instructors", e);
      }
    };
    fetchInstructors();
  }, []);

  const fetchSchedule = async () => {
    setLoading(true);
    try {
      // FIX: Used API_PATHS correctly
      const res = await axiosInstance.get(
        API_PATHS.SCHEDULE.GET_BY_STUDIO_ID(user.adminStudioLocation),
        {
          params: { studioId: user.adminStudioLocation },
        }
      );
      setClasses(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
    setShowDetailModal(true);
  };

  const handleEditClick = (cls) => {
    setShowDetailModal(false);
    setEditingClass(cls);
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingClass(null);
  };

  const handleGeneratePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(6, 78, 59);
    doc.text("Weekly Class Schedule", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    const startStr = format(
      startOfWeek(currentDate, { weekStartsOn: 1 }),
      "dd MMM yyyy"
    );
    const endStr = format(
      endOfWeek(currentDate, { weekStartsOn: 1 }),
      "dd MMM yyyy"
    );
    doc.text(`Week: ${startStr} - ${endStr}`, 14, 30);
    const tableRows = classes.map((cls) => [
      format(parseISO(cls.startTime), "EEE, dd MMM"),
      format(parseISO(cls.startTime), "HH:mm"),
      cls.className,
      cls.instructorId?.fullName || "N/A",
      cls.classType,
      cls.capacity,
    ]);
    autoTable(doc, {
      head: [["Date", "Time", "Class", "Instructor", "Type", "Cap"]],
      body: tableRows,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 9 },
    });
    setPdfUrl(doc.output("bloburl"));
    setShowPdfPreview(true);
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(weekStart, i)
  );
  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div
      className={`h-full flex flex-col bg-gray-50 ${
        isEmbedded ? "p-8" : "p-6"
      }`}>
      {/* Header Controls */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm shrink-0 z-30 relative'>
        <div className='flex items-center gap-4 relative'>
          <div className='relative' ref={headerCalendarRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all border ${
                showDatePicker
                  ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100"
                  : "bg-white border-transparent hover:bg-gray-50"
              }`}>
              <div className='bg-emerald-100 text-emerald-700 p-2 rounded-lg'>
                <CalendarIcon className='w-5 h-5' />
              </div>
              <div className='text-left'>
                <div className='flex items-center gap-2'>
                  <h2 className='text-lg font-bold text-gray-900 leading-tight'>
                    {format(weekStart, "MMMM yyyy")}
                  </h2>
                  <div
                    className='flex items-center gap-1 ml-1'
                    onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={prevWeek}
                      className='p-1 hover:bg-gray-200 rounded-md text-gray-500 transition-colors'>
                      <ChevronLeft className='w-4 h-4' />
                    </button>
                    <button
                      onClick={nextWeek}
                      className='p-1 hover:bg-gray-200 rounded-md text-gray-500 transition-colors'>
                      <ChevronRight className='w-4 h-4' />
                    </button>
                  </div>
                </div>
                <p className='text-xs text-gray-500 font-medium'>
                  Week: {format(weekStart, "d MMM")} -{" "}
                  {format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")}
                </p>
              </div>
            </button>
            <AnimatePresence>
              {showDatePicker && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className='absolute top-full left-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-[320px] z-50'>
                  <WeekPicker
                    selectedDate={currentDate}
                    onChange={(date) => {
                      setCurrentDate(date);
                      setShowDatePicker(false);
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button
            onClick={goToToday}
            className='text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors ml-2'>
            Jump to Current Week
          </button>
        </div>
        <div className='flex items-center gap-3'>
          <button
            onClick={handleGeneratePDF}
            className='flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm'>
            <Printer className='w-5 h-5' />{" "}
            <span className='hidden md:inline'>Print Schedule</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-shadow shadow-lg shadow-gray-900/20'>
            <Plus className='w-5 h-5' /> Schedule Class
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className='flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col min-h-0 z-0'>
        <div className='grid grid-cols-7 border-b border-gray-100 bg-gray-50/50 sticky top-0 z-20'>
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toString()}
                className={`py-4 text-center border-r border-gray-100 last:border-r-0 transition-colors ${
                  isToday ? "bg-emerald-50/60" : ""
                }`}>
                <p
                  className={`text-xs font-bold uppercase mb-1 ${
                    isToday ? "text-emerald-600" : "text-gray-400"
                  }`}>
                  {format(day, "EEE")}
                </p>
                <div className='flex justify-center'>
                  <span
                    className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${
                      isToday
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                        : "text-gray-900"
                    }`}>
                    {format(day, "d")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Scrollable Schedule Body */}
        <div className='flex-1 overflow-y-auto py-2'>
          {loading ? (
            <LoadingSpinner />
          ) : (
            // Use h-full min-h-[500px] to ensure it fits and scrolls if needed
            <div className='grid grid-cols-7 h-full min-h-125'>
              {weekDays.map((day) => {
                const dayClasses = classes.filter((c) =>
                  isSameDay(parseISO(c.startTime), day)
                );
                return (
                  <div
                    key={day.toString()}
                    className={`px-2 py-2 border-r border-gray-100 last:border-r-0 space-y-3 ${
                      isSameDay(day, new Date()) ? "bg-gray-50/30" : ""
                    }`}>
                    {dayClasses.map((cls) => (
                      <motion.div
                        key={cls._id}
                        onClick={() => handleClassClick(cls)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`p-3 rounded-xl border border-l-4 shadow-sm cursor-pointer transition-all bg-white hover:shadow-md ${
                          !cls.isActive
                            ? "opacity-60 grayscale bg-gray-50 border-gray-200"
                            : "border-l-emerald-500 border-gray-200"
                        }`}>
                        <p className='text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1'>
                          <Clock className='w-3 h-3' />
                          {format(parseISO(cls.startTime), "HH:mm")} -{" "}
                          {format(parseISO(cls.endTime), "HH:mm")}
                        </p>
                        <h4
                          className={`font-bold text-sm leading-tight mb-1 ${
                            !cls.isActive ? "text-gray-500" : "text-gray-900"
                          }`}>
                          {cls.className}
                        </h4>
                        <p className='text-xs text-gray-500 mb-2 truncate'>
                          {cls.instructorId?.fullName || "No Instructor"}
                        </p>
                        <div className='flex items-center justify-between pt-2 border-t border-gray-100'>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              cls.classType === "Private"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                            {cls.classType}
                          </span>
                          {cls.isRecurring && (
                            <Repeat className='w-3 h-3 text-gray-400' />
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <CreateClassModal
            onClose={handleModalClose}
            instructors={instructors}
            studioId={user.adminStudioLocation}
            existingClasses={classes}
            initialData={editingClass}
            onSuccess={() => {
              handleModalClose();
              fetchSchedule();
            }}
          />
        )}

        {showDetailModal && selectedClass && (
          <ClassDetailsModal
            classData={selectedClass}
            onClose={() => setShowDetailModal(false)}
            onEdit={() => handleEditClick(selectedClass)}
            onRefresh={fetchSchedule}
          />
        )}

        {showPdfPreview && (
          <PDFPreviewModal
            pdfUrl={pdfUrl}
            onClose={() => setShowPdfPreview(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- COMPONENT: Class Details Modal ---
const ClassDetailsModal = ({ classData, onClose, onEdit, onRefresh }) => {
  const [actionLoading, setActionLoading] = useState(false);
  const [showRecurrenceOption, setShowRecurrenceOption] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);

  const handleInitialClick = (actionType) => {
    if (classData.isRecurring) {
      setShowRecurrenceOption(actionType);
    } else {
      setConfirmationData({ type: actionType, mode: "single" });
    }
  };

  const handleRecurrenceSelection = (mode) => {
    const type = showRecurrenceOption;
    setShowRecurrenceOption(null);
    setConfirmationData({ type, mode });
  };

  const executeAction = async () => {
    if (!confirmationData) return;
    setActionLoading(true);
    const { type, mode } = confirmationData;

    try {
      if (type === "delete") {
        // FIX: Using API_PATHS
        await axiosInstance.delete(
          API_PATHS.SCHEDULE.DELETE_SCHEDULE(classData._id),
          { data: { deleteMode: mode } }
        );
      } else if (type === "toggle") {
        // FIX: Using API_PATHS
        await axiosInstance.put(
          API_PATHS.SCHEDULE.TOGGLE_ISACTIVE_SCHEDULE(classData._id),
          { toggleMode: mode }
        );
      }
      onClose();
      onRefresh();
    } catch (error) {
      console.error(error);
      alert("Action failed: " + (error.response?.data?.error || error.message));
    } finally {
      setActionLoading(false);
      setConfirmationData(null);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className='relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden'>
        {/* Header */}
        <div
          className={`p-6 border-b ${
            classData.isActive ? "bg-white" : "bg-gray-100"
          }`}>
          <div className='flex justify-between items-start'>
            <div>
              <h2
                className={`text-xl font-bold ${
                  classData.isActive ? "text-gray-900" : "text-gray-500"
                }`}>
                {classData.className}
              </h2>
              <p className='text-sm text-gray-500 mt-1 flex items-center gap-1'>
                {classData.isActive ? (
                  <CheckCircle2 className='w-4 h-4 text-emerald-600' />
                ) : (
                  <AlertCircle className='w-4 h-4 text-red-500' />
                )}
                {classData.isActive ? "Active" : "Inactive"}
              </p>
            </div>
            <button onClick={onClose}>
              <X className='w-6 h-6 text-gray-400 hover:text-gray-600' />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className='p-6 space-y-4'>
          <div className='flex items-center gap-3'>
            <div className='bg-blue-50 p-2 rounded-lg text-blue-600'>
              <Clock className='w-5 h-5' />
            </div>
            <div>
              <p className='text-xs text-gray-400 font-bold uppercase'>Time</p>
              <p className='font-medium text-gray-900'>
                {format(parseISO(classData.startTime), "EEEE, dd MMM yyyy")}{" "}
                <br />
                {format(parseISO(classData.startTime), "HH:mm")} -{" "}
                {format(
                  addMinutes(parseISO(classData.startTime), classData.duration),
                  "HH:mm"
                )}{" "}
                ({classData.duration} min)
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <div className='bg-orange-50 p-2 rounded-lg text-orange-600'>
              <BadgeCheck className='w-5 h-5' />
            </div>
            <div>
              <p className='text-xs text-gray-400 font-bold uppercase'>
                Instructor
              </p>
              <p className='font-medium text-gray-900'>
                {classData.instructorId?.fullName || "Unassigned"}
              </p>
              <p className='text-xs text-gray-500'>
                {classData.instructorType}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3'>
            <div className='bg-purple-50 p-2 rounded-lg text-purple-600'>
              <Users className='w-5 h-5' />
            </div>
            <div>
              <p className='text-xs text-gray-400 font-bold uppercase'>
                Details
              </p>
              <p className='font-medium text-gray-900'>
                {classData.classType} • Capacity: {classData.capacity}
              </p>
            </div>
          </div>
          {classData.description && (
            <div className='bg-gray-50 p-3 rounded-xl text-sm text-gray-600 italic'>
              "{classData.description}"
            </div>
          )}
        </div>

        {/* --- OVERLAY 1: Recurrence Option --- */}
        <AnimatePresence>
          {showRecurrenceOption && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center p-6 text-center'>
              <h3 className='font-bold text-lg text-gray-900 mb-2'>
                {showRecurrenceOption === "delete"
                  ? "Delete Class"
                  : "Change Status"}
              </h3>
              <p className='text-sm text-gray-500 mb-6'>
                This is a repeating class. Apply to just this one, or the entire
                series?
              </p>
              <div className='flex flex-col gap-3 w-full'>
                <button
                  onClick={() => handleRecurrenceSelection("single")}
                  className='w-full py-3 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50'>
                  This Class Only
                </button>
                <button
                  onClick={() => handleRecurrenceSelection("all")}
                  className='w-full py-3 rounded-xl bg-gray-900 text-white font-bold hover:bg-gray-800'>
                  Entire Series
                </button>
                <button
                  onClick={() => setShowRecurrenceOption(null)}
                  className='text-sm text-gray-400 mt-2 hover:text-gray-600'>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- OVERLAY 2: Final Confirmation --- */}
        <AnimatePresence>
          {confirmationData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-20 flex flex-col items-center justify-center p-6 text-center'>
              <div
                className={`p-4 rounded-full mb-4 ${
                  confirmationData.type === "delete"
                    ? "bg-red-50 text-red-600"
                    : "bg-amber-50 text-amber-600"
                }`}>
                {confirmationData.type === "delete" ? (
                  <Trash2 className='w-8 h-8' />
                ) : (
                  <AlertTriangle className='w-8 h-8' />
                )}
              </div>
              <h3 className='font-bold text-xl text-gray-900 mb-2'>
                Are you sure?
              </h3>
              <p className='text-sm text-gray-500 mb-6 max-w-xs'>
                {confirmationData.type === "delete"
                  ? `You are about to delete ${
                      confirmationData.mode === "all"
                        ? "the entire series of"
                        : "this"
                    } class.`
                  : `You are about to ${
                      classData.isActive ? "deactivate" : "activate"
                    } ${
                      confirmationData.mode === "all"
                        ? "the entire series"
                        : "this class"
                    }.`}
              </p>
              <div className='flex flex-col gap-3 w-full'>
                <button
                  onClick={executeAction}
                  disabled={actionLoading}
                  className={`w-full py-3 rounded-xl text-white font-bold transition-colors shadow-lg ${
                    confirmationData.type === "delete"
                      ? "bg-red-600 hover:bg-red-700 shadow-red-200"
                      : "bg-amber-500 hover:bg-amber-600 shadow-amber-200"
                  }`}>
                  {actionLoading ? "Processing..." : "Yes, Confirm"}
                </button>
                <button
                  onClick={() => setConfirmationData(null)}
                  disabled={actionLoading}
                  className='w-full py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50'>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer Actions */}
        <div className='p-4 border-t border-gray-100 flex gap-2'>
          <button
            onClick={() => handleInitialClick("toggle")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-colors ${
              classData.isActive
                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}>
            <Power className='w-4 h-4' />{" "}
            {classData.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={onEdit}
            className='flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold hover:bg-blue-100 transition-colors'>
            <Edit className='w-4 h-4' /> Edit
          </button>
          <button
            onClick={() => handleInitialClick("delete")}
            className='flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold hover:bg-red-100 transition-colors'>
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- UPDATED CreateClassModal (Handles CREATE & EDIT with Fixes) ---
const CreateClassModal = ({
  onClose,
  instructors,
  studioId,
  existingClasses = [],
  onSuccess,
  initialData,
}) => {
  const [loading, setLoading] = useState(false);
  const [updateMode, setUpdateMode] = useState(null); // 'single' or 'all'
  const [showConfirmation, setShowConfirmation] = useState(false);

  const [form, setForm] = useState({
    className: "",
    description: "",
    instructorId: "",
    instructorType: "",
    classType: "Private",
    startTime: new Date().toISOString(),
    duration: "",
    capacity: "",
    isRecurring: false,
    isActive: true,
    recurrenceRule: "Daily",
    recurrenceCount: "",
  });

  // Populate form if editing
  useEffect(() => {
    if (initialData) {
      setForm({
        className: initialData.className,
        description: initialData.description || "",
        instructorId: initialData.instructorId?._id || initialData.instructorId,
        instructorType: initialData.instructorType,
        classType: initialData.classType,
        startTime: initialData.startTime,
        duration: initialData.duration,
        capacity: initialData.capacity,
        isRecurring: initialData.isRecurring,
        recurrenceRule: initialData.recurrenceRule,
        recurrenceCount: initialData.recurrenceCount || 1,
      });
    }
  }, [initialData]);

  // State for Availability
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [workingHoursDisplay, setWorkingHoursDisplay] = useState([]);
  const [availableDaysSuggestion, setAvailableDaysSuggestion] = useState("");

  const availableInstructors = useMemo(() => {
    return instructors.filter((inst) =>
      inst.assignedStudiosId.some((s) => s._id === studioId)
    );
  }, [instructors, studioId]);

  const classTypeOptions = ["Group", "Private", "Duet"];
  const recurrenceOptions = ["Daily", "Weekly", "Monthly"];

  const getMinutes = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
  };

  useEffect(() => {
    checkAvailability();
  }, [
    form.instructorId,
    form.startTime,
    form.duration,
    form.isRecurring,
    form.recurrenceRule,
    form.recurrenceCount,
    existingClasses,
  ]);

  const checkAvailability = () => {
    setAvailableDaysSuggestion("");
    setWorkingHoursDisplay([]);
    setIsAvailable(true);
    setAvailabilityMessage("");

    if (!form.instructorId || !form.startTime) return;

    const instructor = instructors.find((i) => i._id === form.instructorId);
    if (!instructor) return;

    let datesToCheck = [];
    const startDate = new Date(form.startTime);

    if (!form.isRecurring || (initialData && updateMode === "single")) {
      datesToCheck.push(startDate);
    } else {
      const count = parseInt(form.recurrenceCount) || 1;
      for (let i = 0; i < count; i++) {
        let nextDate = new Date(startDate);
        if (form.recurrenceRule === "Daily") nextDate = addDays(startDate, i);
        else if (form.recurrenceRule === "Weekly")
          nextDate = addWeeks(startDate, i);
        else if (form.recurrenceRule === "Monthly")
          nextDate = addMonths(startDate, i);
        datesToCheck.push(nextDate);
      }
    }

    for (const dateObj of datesToCheck) {
      const dayKey = format(dateObj, "EEEE").toLowerCase();
      const dailyShifts = instructor.workingHours?.[dayKey] || [];
      const studioShifts = dailyShifts.filter(
        (shift) => shift.location?._id === studioId
      );

      if (isSameDay(dateObj, startDate)) setWorkingHoursDisplay(studioShifts);

      if (studioShifts.length === 0) {
        setIsAvailable(false);
        setAvailabilityMessage(`Instructor is not working on ${dayKey}s.`);
        const allDays = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];
        const activeDays = allDays
          .filter((day) =>
            instructor.workingHours?.[day]?.some(
              (s) => s.location?._id === studioId
            )
          )
          .map((d) => d.charAt(0).toUpperCase() + d.slice(1));
        setAvailableDaysSuggestion(
          activeDays.length > 0
            ? `Working days: ${activeDays.join(", ")}`
            : "No working hours assigned."
        );
        return;
      }

      const classStart = dateObj;
      const classEnd = addMinutes(dateObj, parseInt(form.duration));
      const classStartMins =
        classStart.getHours() * 60 + classStart.getMinutes();
      const classEndMins = classStartMins + parseInt(form.duration);

      let fitsInShift = false;
      for (let shift of studioShifts) {
        const shiftStartMins = getMinutes(shift.start);
        const shiftEndMins = getMinutes(shift.end);
        if (classStartMins >= shiftStartMins && classEndMins <= shiftEndMins) {
          fitsInShift = true;
          break;
        }
      }

      if (!fitsInShift) {
        setIsAvailable(false);
        setAvailabilityMessage(`Time is outside working hours.`);
        return;
      }

      const instructorClasses = existingClasses.filter((cls) => {
        const clsInstructorId = cls.instructorId?._id || cls.instructorId;
        const isSelf = initialData && cls._id === initialData._id;
        return (
          !isSelf &&
          clsInstructorId === form.instructorId &&
          isSameDay(parseISO(cls.startTime), dateObj)
        );
      });

      for (let existingClass of instructorClasses) {
        const existingStart = parseISO(existingClass.startTime);
        const existingEnd = addMinutes(existingStart, existingClass.duration);
        if (classStart < existingEnd && classEnd > existingStart) {
          setIsAvailable(false);
          setAvailabilityMessage(`Conflict with "${existingClass.className}"`);
          return;
        }
      }
    }
    setIsAvailable(true);
    setAvailabilityMessage("Instructor is available.");
  };

  const handleInstructorSelect = (selectedId) => {
    const selectedInstructor = instructors.find((i) => i._id === selectedId);
    const type =
      selectedInstructor?.role ||
      selectedInstructor?.instructorType ||
      "Instructor";
    setForm((prev) => ({
      ...prev,
      instructorId: selectedId,
      instructorType: type,
    }));
  };

  const handleDateChange = (newDate) => {
    const current = new Date(form.startTime);
    const updated = new Date(newDate);
    updated.setHours(current.getHours(), current.getMinutes());
    setForm({ ...form, startTime: updated.toISOString() });
  };

  const handleTimeChange = (timeStr) => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const current = new Date(form.startTime);
    const updated = setHours(setMinutes(current, minutes), hours);
    setForm({ ...form, startTime: updated.toISOString() });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isAvailable) return;

    if (initialData?.isRecurring && !updateMode) {
      const userChoice = window.confirm(
        "Update entire series? OK for Yes, Cancel for Just This Class"
      );
      setUpdateMode(userChoice ? "all" : "single");
      handleFinalSubmit(userChoice ? "all" : "single");
      return;
    }

    if (!initialData) {
      setShowConfirmation(true);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmCreate = () => {
    setShowConfirmation(false);
    handleFinalSubmit(updateMode);
  };

  const handleFinalSubmit = async (mode) => {
    setLoading(true);
    try {
      if (initialData) {
        // FIX: Use initialData._id, NOT classData._id to avoid ReferenceError
        await axiosInstance.put(
          API_PATHS.SCHEDULE.UPDATE_SCHEDULE(initialData._id),
          { ...form, updateMode: mode || "single" }
        );
      } else {
        await axiosInstance.post(API_PATHS.SCHEDULE.CREATE_SCHEDULE, {
          ...form,
          studioId: studioId,
          isRecurring: Boolean(form.isRecurring),
        });
      }
      onSuccess();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Error saving class");
    } finally {
      setLoading(false);
      setUpdateMode(null);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className='relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0'>
          <h3 className='font-bold text-xl text-gray-900'>
            {initialData ? "Edit Class" : "Schedule New Class"}
          </h3>
          <button
            onClick={onClose}
            className='p-1 hover:bg-gray-200 rounded-full'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        <div className='overflow-y-auto p-6'>
          <form onSubmit={handleSubmit} className='space-y-6'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              <div className='col-span-2'>
                <label className='block text-sm font-bold text-gray-700 mb-1'>
                  Class Name
                </label>
                <input
                  className='w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500'
                  placeholder='e.g. Master - Private Class'
                  value={form.className}
                  onChange={(e) =>
                    setForm({ ...form, className: e.target.value })
                  }
                  required
                />
              </div>
              <div className='col-span-2'>
                <label className='block text-sm font-bold text-gray-700 mb-1'>
                  Description
                </label>
                <textarea
                  className='w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 h-24 resize-none'
                  placeholder='Details about the class...'
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <div>
                <CustomSelect
                  label='Instructor'
                  placeholder='Select Instructor'
                  options={availableInstructors}
                  getLabel={(i) => i.fullName}
                  getValue={(i) => i._id}
                  value={form.instructorId}
                  onChange={handleInstructorSelect}
                />
              </div>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Instructor Type
                </label>
                <div className='w-full h-10.5 px-3 border bg-gray-50 rounded-xl flex items-center gap-2 text-gray-500'>
                  <BadgeCheck className='w-4 h-4 text-emerald-600' />
                  <span className='text-sm font-medium'>
                    {form.instructorType || "Auto-detected"}
                  </span>
                </div>
              </div>
              <div>
                <CustomSelect
                  label='Class Type'
                  placeholder='Select Type'
                  options={classTypeOptions}
                  value={form.classType}
                  onChange={(val) => setForm({ ...form, classType: val })}
                />
              </div>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Capacity
                </label>
                <input
                  type='number'
                  className='w-full h-10.5 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500'
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <CustomDatePicker
                  label='Date'
                  value={form.startTime}
                  onChange={handleDateChange}
                />
              </div>
              <div>
                <CustomTimePicker
                  label='Start Time'
                  value={form.startTime}
                  onChange={handleTimeChange}
                />
              </div>
              <div className='col-span-1 md:col-span-2'>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Duration (min)
                </label>
                <input
                  type='number'
                  className='w-full h-10.5 p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500'
                  value={form.duration}
                  onChange={(e) =>
                    setForm({ ...form, duration: e.target.value })
                  }
                  required
                />
              </div>
            </div>

            {form.instructorId && (
              <div
                className={`p-4 rounded-xl border flex items-start gap-3 ${
                  isAvailable
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}>
                {isAvailable ? (
                  <CheckCircle2 className='w-5 h-5 shrink-0 mt-0.5' />
                ) : (
                  <AlertCircle className='w-5 h-5 shrink-0 mt-0.5' />
                )}
                <div className='flex-1'>
                  <p className='font-bold text-sm'>
                    {isAvailable ? "Available" : "Unavailable"}
                  </p>
                  <p className='text-xs mt-1 font-medium'>
                    {availabilityMessage}
                  </p>
                  {!isAvailable && availableDaysSuggestion && (
                    <p className='text-xs mt-1 opacity-80'>
                      {availableDaysSuggestion}
                    </p>
                  )}
                  {workingHoursDisplay.length > 0 && (
                    <div className='mt-2 pt-2 border-t border-black/10'>
                      <p className='text-xs font-bold uppercase tracking-wider opacity-70 mb-1'>
                        Working Hours on{" "}
                        {format(new Date(form.startTime), "EEEE")}
                      </p>
                      <div className='flex flex-wrap gap-2'>
                        {workingHoursDisplay.map((slot, idx) => (
                          <span
                            key={idx}
                            className='text-xs bg-white/50 px-2 py-1 rounded border border-black/10'>
                            {slot.start} - {slot.end}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!initialData && (
              <div className='bg-gray-50 p-4 rounded-xl border border-gray-200'>
                <div className='flex items-center gap-2 mb-4'>
                  <input
                    type='checkbox'
                    id='recurring'
                    className='w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500'
                    checked={form.isRecurring}
                    onChange={(e) =>
                      setForm({ ...form, isRecurring: e.target.checked })
                    }
                  />
                  <label
                    htmlFor='recurring'
                    className='font-bold text-gray-900 text-sm select-none cursor-pointer'>
                    Repeat this class
                  </label>
                </div>
                {form.isRecurring && (
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <CustomSelect
                        label='Frequency'
                        options={recurrenceOptions}
                        value={form.recurrenceRule}
                        onChange={(val) =>
                          setForm({ ...form, recurrenceRule: val })
                        }
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-bold text-gray-500 mb-1'>
                        Occurrences
                      </label>
                      <input
                        type='number'
                        className='w-full h-10.5 p-3 border rounded-xl text-sm bg-white'
                        value={form.recurrenceCount}
                        onChange={(e) =>
                          setForm({ ...form, recurrenceCount: e.target.value })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className='pt-2 flex gap-3 pb-2'>
              <button
                type='button'
                onClick={onClose}
                className='flex-1 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors'>
                Cancel
              </button>
              <button
                type='submit'
                disabled={loading || !isAvailable}
                className={`flex-1 py-3 font-bold text-white rounded-xl shadow-lg transition-all ${
                  isAvailable
                    ? "bg-emerald-900 hover:bg-emerald-800"
                    : "bg-gray-400 cursor-not-allowed"
                }`}>
                {loading
                  ? "Saving..."
                  : initialData
                  ? "Update Class"
                  : "Create Schedule"}
              </button>
            </div>
          </form>
        </div>

        {/* Confirmation Overlay */}
        <AnimatePresence>
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center'>
              <div className='bg-emerald-50 p-4 rounded-full mb-4 shadow-sm'>
                <Check className='w-8 h-8 text-emerald-600' />
              </div>
              <h3 className='font-bold text-xl text-gray-900 mb-2'>
                {initialData ? "Confirm Update?" : "Confirm Class Creation?"}
              </h3>
              <p className='text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed'>
                You are about to {initialData ? "update" : "schedule"} <br />
                <strong className='text-gray-900'>
                  {form.className}
                </strong>. <br />
                {form.isRecurring && (
                  <span className='text-emerald-600 font-medium text-sm block mt-1'>
                    This is a recurring class ({form.recurrenceRule}).
                  </span>
                )}
              </p>
              <div className='flex flex-col w-full max-w-xs gap-3'>
                <button
                  type='button'
                  onClick={handleConfirmCreate}
                  className='w-full py-3.5 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20 transform active:scale-95'>
                  {initialData ? "Yes, Update Class" : "Yes, Create Schedule"}
                </button>
                <button
                  type='button'
                  onClick={() => setShowConfirmation(false)}
                  className='w-full py-3.5 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition-colors'>
                  Back to Edit
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ... (WeekPicker, PDFPreviewModal, CustomDatePicker, CustomTimePicker, CalendarSinglePicker)
// IMPORTANT: Paste the helper components from the previous response here.
// I have included placeholders to remind you, but for the code to run, they must be present.

const WeekPicker = ({ selectedDate, onChange }) => {
  const [viewDate, setViewDate] = useState(selectedDate);
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const rows = [];
  let days = [];
  let day = startDate;
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isSelectedWeek = isSameWeek(day, selectedDate, { weekStartsOn: 1 });
      const isToday = isSameDay(day, new Date());
      const isCurrentMonth = isSameMonth(day, monthStart);
      days.push(
        <div
          key={day}
          onClick={() => onChange(cloneDay)}
          className={`relative w-9 h-9 flex items-center justify-center text-sm font-medium cursor-pointer rounded-full z-10 transition-all ${
            !isCurrentMonth ? "text-gray-300" : "text-gray-700"
          } ${isToday ? "font-bold text-emerald-600" : ""} ${
            isSelectedWeek ? "text-emerald-900 font-bold" : "hover:bg-gray-100"
          }`}>
          {format(day, "d")}
          {isToday && (
            <div className='absolute bottom-1 w-1 h-1 bg-emerald-500 rounded-full'></div>
          )}
        </div>
      );
      day = addDays(day, 1);
    }
    const rowStart = subWeeks(day, 1);
    const isRowSelected = isSameWeek(rowStart, selectedDate, {
      weekStartsOn: 1,
    });
    rows.push(
      <div
        key={day}
        className={`grid grid-cols-7 relative p-1 rounded-lg transition-colors group ${
          isRowSelected ? "bg-emerald-50" : "hover:bg-gray-50"
        }`}>
        {isRowSelected && (
          <div className='absolute inset-0 border-2 border-emerald-100 rounded-lg pointer-events-none' />
        )}
        {days}
      </div>
    );
    days = [];
  }
  return (
    <div className='select-none'>
      <div className='flex items-center justify-between mb-4 px-1'>
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className='p-1 hover:bg-gray-100 rounded-full'>
          <ChevronLeft className='w-4 h-4 text-gray-600' />
        </button>
        <span className='text-sm font-bold text-gray-900'>
          {format(viewDate, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className='p-1 hover:bg-gray-100 rounded-full'>
          <ChevronRight className='w-4 h-4 text-gray-600' />
        </button>
      </div>
      <div className='grid grid-cols-7 mb-2 text-center'>
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className='text-xs font-bold text-gray-400'>
            {d}
          </span>
        ))}
      </div>
      <div className='space-y-1'>{rows}</div>
    </div>
  );
};

const PDFPreviewModal = ({ pdfUrl, onClose }) => {
  return (
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
            <FileText className='w-5 h-5 text-emerald-600' /> Schedule Preview
          </h3>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full'>
            <X className='w-5 h-5' />
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
};

const CustomDatePicker = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const dateValue = value ? new Date(value) : new Date();
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  return (
    <div className='relative w-full' ref={containerRef}>
      <label className='block text-xs font-bold text-gray-700 mb-1'>
        {label}
      </label>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10.5 px-3 border rounded-xl flex items-center justify-between transition-all bg-white ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span className='text-sm font-medium text-gray-900 flex items-center gap-2'>
          <CalendarIcon className='w-4 h-4 text-gray-500' />
          {value ? format(dateValue, "dd MMM yyyy") : "Select Date"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 p-4 min-w-75'>
            <CalendarSinglePicker
              selectedDate={dateValue}
              onChange={(d) => {
                onChange(d);
                setIsOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CustomTimePicker = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [inputValue, setInputValue] = useState("");
  useEffect(() => {
    if (value) {
      const dateVal = new Date(value);
      if (!isNaN(dateVal.getTime())) {
        setInputValue(format(dateVal, "HH:mm"));
      }
    }
  }, [value]);
  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputValue(text);
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (timeRegex.test(text)) {
      onChange(text);
    }
  };
  const timeSlots = [];
  for (let h = 6; h <= 21; h++) {
    for (let m = 0; m < 60; m += 15) {
      timeSlots.push(
        `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      );
    }
  }
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        if (value) setInputValue(format(new Date(value), "HH:mm"));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [value]);
  return (
    <div className='relative w-full' ref={containerRef}>
      <label className='block text-xs font-bold text-gray-700 mb-1'>
        {label}
      </label>
      <div
        className={`w-full h-10.5 px-3 border rounded-xl flex items-center justify-between transition-all bg-white ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <div className='flex items-center gap-2 flex-1'>
          <Clock className='w-4 h-4 text-gray-500 shrink-0' />
          <input
            type='text'
            value={inputValue}
            onChange={handleInputChange}
            onFocus={() => setIsOpen(true)}
            placeholder='00:00'
            maxLength={5}
            className='w-full text-sm font-medium text-gray-900 outline-none bg-transparent placeholder-gray-300'
          />
        </div>
        <button
          type='button'
          onClick={() => setIsOpen(!isOpen)}
          className='p-1 -mr-1 text-gray-400 hover:text-emerald-600 transition-colors'>
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto w-full'>
            <div className='p-2 text-xs text-gray-400 font-bold uppercase tracking-wider bg-gray-50 border-b border-gray-100'>
              Suggested Times
            </div>
            {timeSlots.map((time) => (
              <button
                key={time}
                type='button'
                onClick={() => {
                  onChange(time);
                  setInputValue(time);
                  setIsOpen(false);
                }}
                className={`w-full px-4 py-2.5 text-left text-sm hover:bg-emerald-50 hover:text-emerald-900 transition-colors ${
                  inputValue === time
                    ? "bg-emerald-100 font-bold text-emerald-900"
                    : "text-gray-700"
                }`}>
                {time}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CalendarSinglePicker = ({ selectedDate, onChange }) => {
  const [viewDate, setViewDate] = useState(selectedDate);
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const rows = [];
  let days = [];
  let day = startDate;
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isSelected = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      days.push(
        <div
          key={day}
          onClick={() => onChange(cloneDay)}
          className={`w-9 h-9 flex items-center justify-center text-sm rounded-lg cursor-pointer transition-all ${
            !isCurrentMonth
              ? "text-gray-300"
              : "text-gray-700 hover:bg-gray-100"
          } ${
            isSelected
              ? "bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-md"
              : ""
          }`}>
          {format(day, "d")}
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div key={day} className='grid grid-cols-7 gap-1'>
        {days}
      </div>
    );
    days = [];
  }
  return (
    <div className='select-none p-1'>
      <div className='flex items-center justify-between mb-3'>
        <button
          onClick={() => setViewDate(subMonths(viewDate, 1))}
          className='p-1 hover:bg-gray-100 rounded-full'>
          <ChevronLeft className='w-4 h-4' />
        </button>
        <span className='text-sm font-bold'>
          {format(viewDate, "MMMM yyyy")}
        </span>
        <button
          onClick={() => setViewDate(addMonths(viewDate, 1))}
          className='p-1 hover:bg-gray-100 rounded-full'>
          <ChevronRight className='w-4 h-4' />
        </button>
      </div>
      <div className='grid grid-cols-7 mb-2 text-center text-xs font-bold text-gray-400'>
        {["M", "T", "W", "T", "F", "S", "S"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className='space-y-1'>{rows}</div>
    </div>
  );
};

export default SchedulesList;
