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
  setDay,
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
  Layers,
  Search,
  Loader2,
  User,
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

  // Printing State
  const [isPrinting, setIsPrinting] = useState(false);

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

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        headerCalendarRef.current &&
        !headerCalendarRef.current.contains(event.target)
      ) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      const res = await axiosInstance.get(
        API_PATHS.SCHEDULE.GET_BY_STUDIO_ID(user.adminStudioLocation),
        { params: { studioId: user.adminStudioLocation } },
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

  // --- Master Grid PDF Generation ---
  const handleGenerateMasterPDF = async () => {
    setIsPrinting(true);
    try {
      const bookingsRes = await axiosInstance.get(
        API_PATHS.BOOKING.GET_STUDIO_BOOKING,
      );
      const allBookings = bookingsRes.data;

      // Helper: Get UNIQUE student names for a specific class ID
      const getStudentNames = (classId) => {
        const classBookings = allBookings.filter((b) => {
          const bClassId =
            typeof b.classId === "object" ? b.classId._id : b.classId;
          return String(bClassId) === String(classId);
        });

        if (classBookings.length === 0) return "";

        const uniqueNames = new Set(
          classBookings.map((b) => b.userId?.fullName).filter(Boolean),
        );
        return Array.from(uniqueNames).join(", ");
      };

      const doc = new jsPDF({ orientation: "landscape" });

      const activeInstructors = instructors.sort((a, b) =>
        a.fullName.localeCompare(b.fullName),
      );

      const instructorColumns = activeInstructors.map((inst) => {
        return {
          header: `${inst.fullName.split(" ")[0].toUpperCase()}`,
          dataKey: inst._id,
        };
      });

      const columns = [
        { header: "Time", dataKey: "time" },
        ...instructorColumns,
      ];

      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekDays = Array.from({ length: 7 }).map((_, i) =>
        addDays(weekStart, i),
      );

      const hours = Array.from({ length: 13 }, (_, i) => i + 7);

      weekDays.forEach((dayDate, dayIndex) => {
        if (dayIndex > 0) {
          doc.addPage();
        }

        doc.setFontSize(14);
        doc.setTextColor(50, 50, 50);
        doc.text(format(dayDate, "EEEE, dd MMMM yyyy"), 14, 15);

        let dayTableData = [];

        hours.forEach((hour) => {
          const row = {
            time: `${hour.toString().padStart(2, "0")}.00`,
          };

          activeInstructors.forEach((inst) => {
            const foundClass = classes.find((cls) => {
              const clsDate = parseISO(cls.startTime);
              const clsInstrId = cls.instructorId?._id || cls.instructorId;
              return (
                isSameDay(clsDate, dayDate) &&
                clsDate.getHours() === hour &&
                clsInstrId === inst._id
              );
            });

            if (foundClass) {
              const students = getStudentNames(foundClass._id);
              let cellContent = foundClass.className;
              if (students) {
                cellContent += `\n(${students})`;
              }
              row[inst._id] = cellContent;
            } else {
              row[inst._id] = "";
            }
          });
          dayTableData.push(row);
        });

        autoTable(doc, {
          columns: columns,
          body: dayTableData,
          startY: 20,
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 3,
            lineColor: [200, 200, 200],
            lineWidth: 0.1,
            halign: "center",
            valign: "middle",
            textColor: [0, 0, 0],
            overflow: "linebreak",
            cellWidth: "auto",
          },
          headStyles: {
            fillColor: [240, 240, 240],
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
            lineColor: [180, 180, 180],
            lineWidth: 0.1,
          },
          columnStyles: {
            time: {
              fillColor: [250, 250, 250],
              fontStyle: "bold",
              cellWidth: 15,
            },
          },
          alternateRowStyles: {
            fillColor: [255, 255, 255],
          },
        });
      });

      setPdfUrl(doc.output("bloburl"));
      setShowPdfPreview(true);
    } catch (error) {
      console.error("Error printing schedule:", error);
      alert("Failed to load student data for print.");
    } finally {
      setIsPrinting(false);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(weekStart, i),
  );
  const nextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const prevWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  return (
    <div
      className={`h-full flex flex-col bg-gray-50 ${isEmbedded ? "p-8" : "p-6"}`}>
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
          {/* Direct Print Button */}
          <button
            disabled={isPrinting}
            onClick={handleGenerateMasterPDF}
            className='flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait'>
            {isPrinting ? (
              <Loader2 className='w-5 h-5 animate-spin' />
            ) : (
              <Printer className='w-5 h-5' />
            )}
            <span className='hidden md:inline'>
              {isPrinting ? "Generating..." : "Print Master Schedule"}
            </span>
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
                  className={`text-xs font-bold uppercase mb-1 ${isToday ? "text-emerald-600" : "text-gray-400"}`}>
                  {format(day, "EEE")}
                </p>
                <div className='flex justify-center'>
                  <span
                    className={`text-lg font-bold w-8 h-8 flex items-center justify-center rounded-full ${isToday ? "bg-emerald-500 text-white shadow-md shadow-emerald-200" : "text-gray-900"}`}>
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
            <div className='grid grid-cols-7 h-full min-h-125'>
              {weekDays.map((day) => {
                const dayClasses = classes.filter((c) =>
                  isSameDay(parseISO(c.startTime), day),
                );
                return (
                  <div
                    key={day.toString()}
                    className={`px-2 py-2 border-r border-gray-100 last:border-r-0 space-y-3 ${isSameDay(day, new Date()) ? "bg-gray-50/30" : ""}`}>
                    {dayClasses.map((cls) => (
                      <motion.div
                        key={cls._id}
                        onClick={() => handleClassClick(cls)}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`p-3 rounded-xl border border-l-4 shadow-sm cursor-pointer transition-all bg-white hover:shadow-md ${!cls.isActive ? "opacity-60 grayscale bg-gray-50 border-gray-200" : "border-l-emerald-500 border-gray-200"}`}>
                        <p className='text-xs font-bold text-emerald-700 mb-1 flex items-center gap-1'>
                          <Clock className='w-3 h-3' />
                          {format(parseISO(cls.startTime), "HH:mm")} -{" "}
                          {format(parseISO(cls.endTime), "HH:mm")}
                        </p>
                        <h4
                          className={`font-bold text-sm leading-tight mb-1 ${!cls.isActive ? "text-gray-500" : "text-gray-900"}`}>
                          {cls.className}
                        </h4>
                        <p className='text-xs text-gray-500 mb-2 truncate'>
                          {cls.instructorId?.fullName || "No Instructor"}
                        </p>
                        <div className='flex items-center justify-between pt-2 border-t border-gray-100'>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${cls.classType === "Private" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
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

// --- COMPONENT: Class Details Modal with Client Management ---
const ClassDetailsModal = ({ classData, onClose, onEdit, onRefresh }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("details");
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPasses, setUserPasses] = useState([]);
  const [selectedPass, setSelectedPass] = useState(null);
  const [bookingProcessing, setBookingProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showRecurrenceOption, setShowRecurrenceOption] = useState(null);
  const [confirmationData, setConfirmationData] = useState(null);

  const fetchBookings = async () => {
    setLoadingBookings(true);
    try {
      const res = await axiosInstance.get(
        API_PATHS.BOOKING.GET_CLASS_BOOKINGS(classData._id),
      );
      setBookings(res.data);
    } catch (error) {
      console.error("Failed to fetch bookings", error);
    } finally {
      setLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (activeTab === "attendees") fetchBookings();
  }, [activeTab, classData._id]);

  const fetchUsers = async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.AUTH.GET_ALL_USERS);
      setUsers(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUserSelect = async (userId) => {
    if (!userId) {
      setSelectedUser(null);
      setSelectedPass(null);
      setUserPasses([]);
      return;
    }

    const userObj = users.find((u) => u._id === userId);
    setSelectedUser(userObj);
    setSelectedPass(null);
    if (!userObj) return;

    try {
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(userId),
        { params: { studioId: user.adminStudioLocation } },
      );

      const validPasses = res.data.filter((p) => {
        const isActive =
          p.isActive &&
          p.remainingCredits > 0 &&
          p.classType.toLowerCase() === classData.classType.toLowerCase() &&
          p.instructorType.toLowerCase() ===
            classData.instructorType.toLowerCase() &&
          new Date(p.expiryDate) > new Date();

        const passStudioId =
          typeof p.issuingStudio === "object"
            ? p.issuingStudio._id
            : p.issuingStudio;
        const currentStudioId = user.adminStudioLocation;
        const isStudioMatch = String(passStudioId) === String(currentStudioId);

        return isActive && isStudioMatch;
      });

      setUserPasses(validPasses);
    } catch (e) {
      console.error(e);
      setUserPasses([]);
    }
  };

  const handleAddStudent = async () => {
    if (!selectedUser || !selectedPass) return;
    setBookingProcessing(true);
    try {
      await axiosInstance.post(API_PATHS.BOOKING.CREATE_BOOKING, {
        classId: classData._id,
        passId: selectedPass,
        targetUserId: selectedUser._id,
      });
      setShowAddStudent(false);
      setSelectedUser(null);
      setSelectedPass(null);
      fetchBookings();
      onRefresh();
    } catch (error) {
      alert(error.response?.data?.error || "Booking failed");
    } finally {
      setBookingProcessing(false);
    }
  };

  const handleCheckIn = async (bookingId) => {
    try {
      await axiosInstance.put(API_PATHS.BOOKING.STUDENT_CHECK_IN(bookingId));
      fetchBookings();
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelBooking = async (bookingId) => {
    if (!window.confirm("Remove student? Credits will be refunded.")) return;
    try {
      await axiosInstance.post(API_PATHS.BOOKING.CANCEL_BOOKING, { bookingId });
      fetchBookings();
      onRefresh();
    } catch (error) {
      alert(error.response?.data?.error || "Cancel failed");
    }
  };

  const handleInitialClick = (actionType) => {
    if (classData.isRecurring) setShowRecurrenceOption(actionType);
    else setConfirmationData({ type: actionType, mode: "single" });
  };

  const executeAction = async () => {
    if (!confirmationData) return;
    setActionLoading(true);
    const { type, mode } = confirmationData;
    try {
      if (type === "delete")
        await axiosInstance.delete(
          API_PATHS.SCHEDULE.DELETE_SCHEDULE(classData._id),
          { data: { deleteMode: mode } },
        );
      else if (type === "toggle")
        await axiosInstance.put(
          API_PATHS.SCHEDULE.TOGGLE_ISACTIVE_SCHEDULE(classData._id),
          { toggleMode: mode },
        );
      onClose();
      onRefresh();
    } catch (error) {
      alert("Action failed");
    } finally {
      setActionLoading(false);
      setConfirmationData(null);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className='relative bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]'>
        <div className='border-b bg-white z-10'>
          <div className='flex justify-between items-center p-4 pb-0'>
            <div className='flex gap-4'>
              <button
                onClick={() => setActiveTab("details")}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "details" ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-400"}`}>
                Details
              </button>
              <button
                onClick={() => setActiveTab("attendees")}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${activeTab === "attendees" ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-400"}`}>
                Attendees ({classData.currentEnrollment}/{classData.capacity})
              </button>
            </div>
            <button onClick={onClose} className='mb-3'>
              <X className='w-6 h-6 text-gray-400' />
            </button>
          </div>
        </div>

        {activeTab === "details" && (
          <div className='p-6 space-y-4 overflow-y-auto'>
            <div className='flex items-center gap-3'>
              <div className='bg-blue-50 p-2 rounded-lg text-blue-600'>
                <Clock className='w-5 h-5' />
              </div>
              <div>
                <p className='text-xs text-gray-400 font-bold uppercase'>
                  Time
                </p>
                <p className='font-medium text-gray-900'>
                  {format(parseISO(classData.startTime), "EEEE, dd MMM")} •{" "}
                  {format(parseISO(classData.startTime), "HH:mm")}
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
              </div>
            </div>
            <div className='flex items-center gap-3'>
              <div className='bg-purple-50 p-2 rounded-lg text-purple-600'>
                <Users className='w-5 h-5' />
              </div>
              <div>
                <p className='text-xs text-gray-400 font-bold uppercase'>
                  Info
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
            <div className='pt-6 border-t border-gray-100 flex gap-2'>
              <button
                onClick={() => handleInitialClick("toggle")}
                className={`flex-1 py-3 rounded-xl font-bold ${classData.isActive ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                {classData.isActive ? "Deactivate" : "Activate"}
              </button>
              <button
                onClick={onEdit}
                className='flex-1 py-3 rounded-xl bg-blue-50 text-blue-700 font-bold'>
                Edit
              </button>
              <button
                onClick={() => handleInitialClick("delete")}
                className='px-4 py-3 rounded-xl bg-red-50 text-red-700 font-bold'>
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          </div>
        )}

        {/* --- IMPROVED ATTENDEES VIEW --- */}
        {activeTab === "attendees" && (
          <div className='flex-1 flex flex-col h-full overflow-hidden bg-gray-50'>
            {/* Header / Add Form Area */}
            <div className='bg-white border-b border-gray-100 z-10 shrink-0'>
              {!showAddStudent ? (
                <div className='p-4 flex justify-between items-center'>
                  <div>
                    <h4 className='text-sm font-bold text-gray-900'>
                      Class Roster
                    </h4>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      {bookings.length} / {classData.capacity} spots filled
                    </p>
                  </div>
                  <button
                    disabled={classData.currentEnrollment >= classData.capacity}
                    onClick={() => {
                      setShowAddStudent(true);
                      fetchUsers();
                    }}
                    className='flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-200'>
                    <Plus className='w-4 h-4' /> Add Student
                  </button>
                </div>
              ) : (
                <div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className='p-5 space-y-4 bg-white shadow-sm relative'>
                  <div className='flex justify-between items-center mb-2'>
                    <h4 className='text-sm font-bold text-gray-900'>
                      Add New Booking
                    </h4>
                    <button
                      onClick={() => {
                        setShowAddStudent(false);
                        setSelectedUser(null);
                        setSelectedPass(null);
                      }}
                      className='p-1 hover:bg-gray-100 rounded-full transition-colors'>
                      <X className='w-5 h-5 text-gray-400' />
                    </button>
                  </div>

                  <div className='relative'>
                    <CustomSelect
                      label='Select Student'
                      options={users}
                      getLabel={(u) => `${u.fullName}`}
                      getValue={(u) => u._id}
                      value={selectedUser?._id}
                      onChange={handleUserSelect}
                      placeholder='Search by name...'
                      searchable={true}
                    />
                  </div>

                  <AnimatePresence>
                    {selectedUser && (
                      <div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className='space-y-3'>
                        <div className='flex justify-between items-end'>
                          <label className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                            Available Passes
                          </label>
                        </div>

                        {userPasses.length > 0 ? (
                          <div className='grid gap-3 max-h-48 overflow-y-auto pr-1'>
                            {userPasses.map((pass) => {
                              const isSelected = selectedPass === pass._id;
                              return (
                                <div
                                  key={pass._id}
                                  onClick={() => setSelectedPass(pass._id)}
                                  className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${isSelected ? "border-emerald-500 bg-emerald-50/50 shadow-sm" : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm"}`}>
                                  <div className='flex justify-between items-start'>
                                    <div>
                                      <p
                                        className={`text-sm font-bold ${isSelected ? "text-emerald-900" : "text-gray-800"}`}>
                                        {pass.passName || pass.instructorType}
                                      </p>
                                      <p className='text-xs text-gray-500 mt-0.5'>
                                        Expires:{" "}
                                        {format(
                                          new Date(pass.expiryDate),
                                          "dd MMM yyyy",
                                        )}
                                      </p>
                                    </div>
                                    <div
                                      className={`px-2 py-1 rounded-lg text-xs font-bold ${isSelected ? "bg-emerald-200 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
                                      {pass.remainingCredits} Credits
                                    </div>
                                  </div>
                                  {isSelected && (
                                    <div className='absolute -top-2 -right-2 bg-emerald-500 text-white p-1 rounded-full shadow-sm'>
                                      <Check className='w-3 h-3' />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className='p-4 rounded-xl bg-red-50 border border-red-100 flex items-start gap-3'>
                            <AlertCircle className='w-5 h-5 text-red-500 mt-0.5 shrink-0' />
                            <div>
                              <p className='text-sm font-bold text-red-800'>
                                No Eligible Passes
                              </p>
                              <p className='text-xs text-red-600 mt-1'>
                                Student has no active passes matching class type
                                ({classData.classType}).
                              </p>
                            </div>
                          </div>
                        )}

                        <button
                          disabled={
                            !selectedUser || !selectedPass || bookingProcessing
                          }
                          onClick={handleAddStudent}
                          className='w-full py-3.5 bg-emerald-900 text-white rounded-xl text-sm font-bold disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed hover:bg-emerald-800 hover:shadow-lg transition-all flex justify-center items-center gap-2'>
                          {bookingProcessing ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                          ) : (
                            <CheckCircle2 className='w-4 h-4' />
                          )}
                          {bookingProcessing
                            ? "Processing..."
                            : "Confirm Booking"}
                        </button>
                      </div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Roster List */}
            <div className='flex-1 overflow-y-auto p-4 md:p-6 space-y-3'>
              {loadingBookings ? (
                <div className='flex justify-center py-10'>
                  <LoadingSpinner />
                </div>
              ) : bookings.length === 0 ? (
                <div className='flex flex-col items-center justify-center h-full text-center py-10 opacity-50'>
                  <div className='w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4'>
                    <Users className='w-8 h-8 text-gray-400' />
                  </div>
                  <p className='text-gray-900 font-bold'>Class is Empty</p>
                  <p className='text-sm text-gray-500 mt-1'>
                    Add students to get started.
                  </p>
                </div>
              ) : (
                bookings.map((booking) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={booking._id}
                    className='group bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex items-center justify-between'>
                    <div className='flex items-center gap-4'>
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${booking.isAttend ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {booking.userId.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className='text-sm font-bold text-gray-900'>
                          {booking.userId.fullName}
                        </p>
                        <div className='flex items-center gap-2 mt-0.5'>
                          <span className='text-[10px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200'>
                            {booking.passId?.passName || "Pass Used"}
                          </span>
                          {booking.isAttend && (
                            <span className='text-[10px] font-bold text-emerald-600 flex items-center gap-1'>
                              <CheckCircle2 className='w-3 h-3' /> Present
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <button
                        onClick={() => handleCheckIn(booking._id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${booking.isAttend ? "bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"}`}>
                        {booking.isAttend ? "Checked In" : "Check In"}
                      </button>
                      <button
                        onClick={() => handleCancelBooking(booking._id)}
                        className='p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors'
                        title='Remove Student'>
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ... (Recurrence/Confirmation Modals remain the same) ... */}
        <AnimatePresence>
          {showRecurrenceOption && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center'>
              <h3 className='font-bold text-lg mb-4'>Recurring Class</h3>
              <button
                onClick={() => {
                  setConfirmationData({
                    type: showRecurrenceOption,
                    mode: "single",
                  });
                  setShowRecurrenceOption(null);
                }}
                className='w-full py-3 border rounded-xl mb-2'>
                This Class Only
              </button>
              <button
                onClick={() => {
                  setConfirmationData({
                    type: showRecurrenceOption,
                    mode: "all",
                  });
                  setShowRecurrenceOption(null);
                }}
                className='w-full py-3 bg-gray-900 text-white rounded-xl'>
                Entire Series
              </button>
              <button
                onClick={() => setShowRecurrenceOption(null)}
                className='mt-2 text-sm text-gray-500'>
                Cancel
              </button>
            </motion.div>
          )}
          {confirmationData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-50 flex flex-col items-center justify-center p-6 text-center'>
              <h3 className='font-bold text-xl mb-4'>Are you sure?</h3>
              <button
                onClick={executeAction}
                disabled={actionLoading}
                className='w-full py-3 bg-red-600 text-white rounded-xl mb-2 font-bold'>
                Yes, Confirm
              </button>
              <button
                onClick={() => setConfirmationData(null)}
                className='w-full py-3 border rounded-xl'>
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

// ... (CreateClassModal, WeekPicker, PDFPreviewModal, CustomDatePicker, CustomTimePicker) ...
// Use existing implementations.

const CreateClassModal = ({
  onClose,
  instructors,
  studioId,
  existingClasses = [],
  onSuccess,
  initialData,
}) => {
  const [loading, setLoading] = useState(false);
  const [updateMode, setUpdateMode] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showRecurrenceSelect, setShowRecurrenceSelect] = useState(false);

  // New State for Multi-Select Days
  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState([]);

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
    recurrenceRule: "Weekly",
    recurrenceCount: "",
  });

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
        recurrenceRule: "Weekly",
        recurrenceCount: initialData.recurrenceCount || 1,
      });
      if (initialData.selectedDays && Array.isArray(initialData.selectedDays)) {
        setSelectedRecurrenceDays(initialData.selectedDays);
      } else {
        setSelectedRecurrenceDays([getDay(parseISO(initialData.startTime))]);
      }
    } else {
      setSelectedRecurrenceDays([getDay(new Date())]);
    }
  }, [initialData]);

  // Sync day with date picker
  useEffect(() => {
    if (!initialData && !form.isRecurring) {
      setSelectedRecurrenceDays([getDay(parseISO(form.startTime))]);
    }
  }, [form.startTime, initialData, form.isRecurring]);

  // ... (Availability Logic from original) ...
  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [workingHoursDisplay, setWorkingHoursDisplay] = useState([]);
  const [availableDaysSuggestion, setAvailableDaysSuggestion] = useState("");

  const weekDayButtons = [
    { label: "Sun", value: 0 },
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
  ];

  const classTypeOptions = ["Group", "Mat Group", "Private", "Duet"];

  const availableInstructors = useMemo(() => {
    return instructors.filter((inst) =>
      inst.assignedStudiosId.some((s) => s._id === studioId),
    );
  }, [instructors, studioId]);

  const toggleDay = (dayIndex) => {
    setSelectedRecurrenceDays((prev) => {
      if (prev.includes(dayIndex)) {
        if (prev.length === 1) return prev;
        return prev.filter((d) => d !== dayIndex);
      } else {
        return [...prev, dayIndex].sort();
      }
    });
  };

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
    selectedRecurrenceDays,
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
      const weeksToRun = parseInt(form.recurrenceCount) || 1;
      for (let i = 0; i < weeksToRun; i++) {
        const weekBase = startOfWeek(addWeeks(startDate, i), {
          weekStartsOn: 0,
        });
        selectedRecurrenceDays.forEach((dayIndex) => {
          const targetDate = addDays(weekBase, dayIndex);
          datesToCheck.push(targetDate);
        });
      }
    }

    let notWorkingDates = [];
    let timeConflicts = [];
    let overlapConflicts = [];

    for (const dateObj of datesToCheck) {
      const dayKey = format(dateObj, "EEEE").toLowerCase();
      const dailyShifts = instructor.workingHours?.[dayKey] || [];
      const studioShifts = dailyShifts.filter(
        (shift) => shift.location?._id === studioId,
      );

      if (datesToCheck.indexOf(dateObj) === 0)
        setWorkingHoursDisplay(studioShifts);

      if (studioShifts.length === 0) {
        notWorkingDates.push(format(dateObj, "d MMM"));
        continue;
      }

      const classStart = new Date(dateObj);
      classStart.setHours(new Date(form.startTime).getHours());
      classStart.setMinutes(new Date(form.startTime).getMinutes());

      const classEnd = addMinutes(classStart, parseInt(form.duration) || 0);
      const classStartMins =
        classStart.getHours() * 60 + classStart.getMinutes();
      const classEndMins = classStartMins + (parseInt(form.duration) || 0);

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
        timeConflicts.push(format(classStart, "d MMM"));
        continue;
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
          overlapConflicts.push(
            `${format(classStart, "d MMM")} (${existingClass.className})`,
          );
          break;
        }
      }
    }

    if (
      notWorkingDates.length > 0 ||
      timeConflicts.length > 0 ||
      overlapConflicts.length > 0
    ) {
      setIsAvailable(false);
      let messages = [];
      if (notWorkingDates.length > 0)
        messages.push(
          `Instructor not working on: ${notWorkingDates.join(", ")}.`,
        );
      if (timeConflicts.length > 0)
        messages.push(
          `Time outside working hours on: ${timeConflicts.join(", ")}.`,
        );
      if (overlapConflicts.length > 0)
        messages.push(
          `Conflict with classes on: ${overlapConflicts.join(", ")}.`,
        );
      setAvailabilityMessage(messages.join(" "));
    } else {
      setIsAvailable(true);
      setAvailabilityMessage("Instructor is available for all sessions.");
    }
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
      setShowRecurrenceSelect(true);
      return;
    }
    setShowConfirmation(true);
  };

  const handleRecurrenceChoice = (mode) => {
    setUpdateMode(mode);
    setShowRecurrenceSelect(false);
    setShowConfirmation(true);
  };

  const handleConfirmCreate = () => {
    setShowConfirmation(false);
    handleFinalSubmit(updateMode);
  };

  const handleFinalSubmit = async (mode) => {
    setLoading(true);
    try {
      const payload = {
        ...form,
        studioId: studioId,
        isRecurring: Boolean(form.isRecurring),
        recurrenceRule: "Weekly",
        selectedDays: selectedRecurrenceDays,
        updateMode: mode || "single",
      };

      if (initialData) {
        await axiosInstance.put(
          API_PATHS.SCHEDULE.UPDATE_SCHEDULE(initialData._id),
          payload,
        );
      } else {
        await axiosInstance.post(API_PATHS.SCHEDULE.CREATE_SCHEDULE, payload);
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
                {/* FIX: getValue logic for simple string array */}
                <CustomSelect
                  label='Class Type'
                  placeholder='Select Type'
                  options={classTypeOptions}
                  getLabel={(option) => option} // String is the label
                  getValue={(option) => option} // String is the value
                  value={form.classType}
                  onChange={(val) => setForm({ ...form, classType: val })}
                />
              </div>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Capacity
                </label>
                <input
                  type='string'
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
                  Duration (minutes)
                </label>
                <input
                  type='string'
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
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`p-4 rounded-2xl border flex items-start gap-4 ${
                  isAvailable
                    ? "bg-emerald-50 border-emerald-100"
                    : "bg-red-50 border-red-100"
                }`}>
                <div
                  className={`mt-0.5 p-1.5 rounded-full shrink-0 ${
                    isAvailable
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-red-100 text-red-600"
                  }`}>
                  {isAvailable ? (
                    <CheckCircle2 className='w-5 h-5' />
                  ) : (
                    <AlertCircle className='w-5 h-5' />
                  )}
                </div>
                <div>
                  <h4
                    className={`font-bold text-base leading-tight ${
                      isAvailable ? "text-emerald-900" : "text-red-900"
                    }`}>
                    {isAvailable ? "Available" : "Unavailable"}
                  </h4>
                  <p
                    className={`text-sm mt-1 font-medium leading-relaxed ${
                      isAvailable ? "text-emerald-700" : "text-red-700"
                    }`}>
                    {availabilityMessage}
                  </p>
                  {!isAvailable && availableDaysSuggestion && (
                    <p className='text-xs mt-2 text-red-500 font-semibold bg-red-100/50 px-2 py-1 rounded-md inline-block'>
                      {availableDaysSuggestion}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <div className='bg-gray-50 p-4 rounded-xl border border-gray-200 transition-all'>
              <div className='flex items-center gap-2 mb-4'>
                <input
                  type='checkbox'
                  id='recurring'
                  className='w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600'
                  onChange={(e) =>
                    setForm({ ...form, isRecurring: e.target.checked })
                  }
                  checked={form.isRecurring}
                />
                <label
                  htmlFor='recurring'
                  className='font-bold text-gray-900 text-sm select-none cursor-pointer'>
                  Recurring Class
                </label>
              </div>

              {form.isRecurring && (
                <div className='mt-4 animate-in fade-in slide-in-from-top-2 duration-300'>
                  <div className='flex flex-col md:flex-row gap-6 items-start'>
                    {/* Day Selector */}
                    <div className='flex-1'>
                      <label className='block text-xs font-bold text-gray-500 mb-2'>
                        Select Days
                      </label>
                      <div className='flex flex-wrap gap-2'>
                        {weekDayButtons.map((day) => {
                          const isSelected = selectedRecurrenceDays.includes(
                            day.value,
                          );
                          return (
                            <button
                              key={day.value}
                              type='button'
                              onClick={() => toggleDay(day.value)}
                              className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${
                                isSelected
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                  : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"
                              }`}>
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weeks Input */}
                    <div className='w-full md:w-32 shrink-0'>
                      <label className='block text-xs font-bold text-gray-500 mb-2'>
                        Duration (Weeks)
                      </label>
                      <input
                        type='string'
                        className='w-full p-2.5 border rounded-xl text-sm bg-white text-center font-bold outline-none focus:ring-2 focus:ring-emerald-500'
                        value={form.recurrenceCount}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            recurrenceCount: e.target.value,
                          })
                        }
                        placeholder='1'
                      />
                    </div>
                  </div>
                  <p className='text-[10px] text-gray-400 mt-2'>
                    Class will repeat for {form.recurrenceCount || 1} week(s) on
                    selected days.
                  </p>
                </div>
              )}
            </div>

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

        {/* ... (Confirmation Overlays remain the same) ... */}
        <AnimatePresence>
          {showRecurrenceSelect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center'>
              <div className='bg-blue-50 p-4 rounded-full mb-4 shadow-sm text-blue-600'>
                <Layers className='w-8 h-8' />
              </div>
              <h3 className='font-bold text-xl text-gray-900 mb-2'>
                Recurring Class
              </h3>
              <p className='text-gray-500 mb-8 max-w-xs mx-auto leading-relaxed'>
                This class is part of a series. How would you like to apply your
                changes?
              </p>
              <div className='flex flex-col w-full max-w-xs gap-3'>
                <button
                  type='button'
                  onClick={() => handleRecurrenceChoice("single")}
                  className='w-full py-3.5 bg-white border border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-all'>
                  Update This Class Only
                </button>
                <button
                  type='button'
                  onClick={() => handleRecurrenceChoice("all")}
                  className='w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all shadow-lg shadow-gray-900/20'>
                  Update Entire Series
                </button>
                <button
                  type='button'
                  onClick={() => setShowRecurrenceSelect(false)}
                  className='text-sm text-gray-400 mt-2 hover:text-gray-600'>
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
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
              <div className='flex flex-col w-full max-w-xs gap-3'>
                <button
                  type='button'
                  onClick={handleConfirmCreate}
                  className='w-full py-3.5 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20 transform active:scale-95'>
                  {initialData ? "Yes, Update Class" : "Yes, Create Schedule"}
                </button>
                <button
                  type='button'
                  onClick={() => {
                    setShowConfirmation(false);
                    setUpdateMode(null);
                  }}
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

const WeekPicker = ({ selectedDate, onChange }) => {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  return (
    <div className='grid grid-cols-7 gap-1 text-center'>
      {days.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`p-2 rounded-lg ${isSameDay(d, selectedDate) ? "bg-emerald-100 text-emerald-700 font-bold" : "hover:bg-gray-100"}`}>
          {format(d, "d")}
        </button>
      ))}
    </div>
  );
};

const PDFPreviewModal = ({ pdfUrl, onClose }) => (
  <div className='fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/75'>
    <div className='bg-white w-full max-w-4xl h-[85vh] rounded-3xl overflow-hidden flex flex-col'>
      <div className='flex justify-between p-4 border-b'>
        <h3 className='font-bold'>Preview</h3>
        <button onClick={onClose}>
          <X />
        </button>
      </div>
      <iframe src={pdfUrl} className='w-full h-full' title='PDF' />
    </div>
  </div>
);

const CustomDatePicker = ({ label, value, onChange }) => (
  <div>
    <label className='text-xs font-bold'>{label}</label>
    <input
      type='date'
      className='w-full p-3 border rounded-xl'
      value={value ? format(new Date(value), "yyyy-MM-dd") : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

const CustomTimePicker = ({ label, value, onChange }) => (
  <div>
    <label className='text-xs font-bold'>{label}</label>
    <input
      type='time'
      className='w-full p-3 border rounded-xl'
      value={value ? format(new Date(value), "HH:mm") : ""}
      onChange={(e) => onChange(e.target.value)}
    />
  </div>
);

export default SchedulesList;
