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
  parseISO,
  setHours,
  setMinutes,
  getDay,
  addMinutes,
  startOfMonth,
  endOfMonth,
  isSameMonth,
  differenceInMinutes,
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
  BadgeCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Users,
  Check,
  Layers,
  Loader2,
  MapPin,
  Lock,
  Building2,
  CalendarDays,
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

  // --- VIEW MODE STATE (ALL vs LOCAL) ---
  const [viewMode, setViewMode] = useState("LOCAL");

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

  // 1. Fetch Instructors
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

  // 2. Fetch Schedules
  useEffect(() => {
    if (instructors.length > 0) {
      fetchAllSchedules();
    } else {
      fetchLocalSchedule();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, user.adminStudioLocation, instructors]);

  const fetchLocalSchedule = async () => {
    try {
      const res = await axiosInstance.get(
        API_PATHS.SCHEDULE.GET_BY_STUDIO_ID(user.adminStudioLocation),
        { params: { studioId: user.adminStudioLocation } },
      );
      return res.data;
    } catch (error) {
      console.error("Local schedule error", error);
      return [];
    }
  };

  const fetchAllSchedules = async () => {
    setLoading(true);
    try {
      // A. Fetch Local Studio Schedule
      const localData = await fetchLocalSchedule();

      // B. Fetch External Schedules
      const otherStudioIds = new Set();
      instructors.forEach((inst) => {
        if (inst.assignedStudiosId && Array.isArray(inst.assignedStudiosId)) {
          inst.assignedStudiosId.forEach((studio) => {
            const sId = typeof studio === "object" ? studio._id : studio;
            if (sId !== user.adminStudioLocation) {
              otherStudioIds.add(sId);
            }
          });
        }
      });

      const externalPromises = Array.from(otherStudioIds).map((sId) =>
        axiosInstance
          .get(API_PATHS.SCHEDULE.GET_BY_STUDIO_ID(sId), {
            params: { studioId: sId },
          })
          .then((res) => res.data)
          .catch(() => []),
      );

      const externalResults = await Promise.all(externalPromises);
      const allExternalClasses = externalResults.flat();

      const ourInstructorIds = new Set(instructors.map((i) => i._id));
      const relevantExternalClasses = allExternalClasses.filter((cls) => {
        const iId =
          typeof cls.instructorId === "object"
            ? cls.instructorId._id
            : cls.instructorId;
        return ourInstructorIds.has(iId);
      });

      setClasses([...localData, ...relevantExternalClasses]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // --- FILTER LOGIC ---
  const filteredClasses = useMemo(() => {
    if (viewMode === "ALL") return classes;
    return classes.filter((cls) => {
      const clsStudioId =
        typeof cls.studioId === "object" ? cls.studioId._id : cls.studioId;
      return clsStudioId === user.adminStudioLocation;
    });
  }, [classes, viewMode, user.adminStudioLocation]);

  const handleClassClick = (cls) => {
    const clsStudioId =
      typeof cls.studioId === "object" ? cls.studioId._id : cls.studioId;
    const isExternal = clsStudioId !== user.adminStudioLocation;
    setSelectedClass({ ...cls, isExternal });
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

  // --- PDF GENERATION ---
  const handleGenerateMasterPDF = async () => {
    setIsPrinting(true);
    try {
      const bookingsRes = await axiosInstance.get(
        API_PATHS.BOOKING.GET_STUDIO_BOOKING,
      );
      const allBookings = bookingsRes.data;

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

      const instructorColumns = activeInstructors.map((inst) => ({
        header: inst.fullName.toUpperCase(),
        dataKey: inst._id,
      }));

      const columns = [
        { header: "TIME", dataKey: "time" },
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

        // Header Styling
        doc.setFillColor(6, 78, 59); // Emerald 900
        doc.rect(0, 0, 297, 24, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(format(dayDate, "EEEE, dd MMMM yyyy"), 14, 16);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Generated: ${format(new Date(), "dd MMM yyyy HH:mm")}`,
          282,
          16,
          { align: "right" },
        );

        let dayTableData = [];
        let occupied = {};

        hours.forEach((hour) => {
          const row = {
            time: `${hour.toString().padStart(2, "0")}:00`,
          };

          activeInstructors.forEach((inst) => {
            if (occupied[inst._id] && occupied[inst._id] > 0) {
              occupied[inst._id]--;
              return;
            }

            const foundClass = filteredClasses.find((cls) => {
              const clsDate = parseISO(cls.startTime);
              const clsInstrId = cls.instructorId?._id || cls.instructorId;
              return (
                isSameDay(clsDate, dayDate) &&
                clsDate.getHours() === hour &&
                clsInstrId === inst._id
              );
            });

            if (foundClass) {
              const start = parseISO(foundClass.startTime);
              const end = parseISO(foundClass.endTime);
              const durationMinutes = differenceInMinutes(end, start);
              let span = Math.ceil(durationMinutes / 60);
              if (span < 1) span = 1;

              const students = getStudentNames(foundClass._id);
              const startStr = format(start, "HH:mm");
              const endStr = format(end, "HH:mm");

              let cellContent = `${startStr} - ${endStr}\n${foundClass.className}\n[${foundClass.classType}]`;
              if (students) {
                cellContent += `\n\nStudents: ${students}`;
              }

              row[inst._id] = {
                content: cellContent,
                rowSpan: span,
                styles: {
                  valign: "middle",
                  halign: "center",
                  fillColor: [255, 255, 255],
                },
              };

              if (span > 1) {
                occupied[inst._id] = span - 1;
              }
            } else {
              row[inst._id] = "";
            }
          });
          dayTableData.push(row);
        });

        autoTable(doc, {
          columns: columns,
          body: dayTableData,
          startY: 30,
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            halign: "center",
            valign: "middle",
            lineColor: [220, 220, 220],
            lineWidth: 0.1,
            overflow: "linebreak",
          },
          headStyles: {
            fillColor: [16, 185, 129],
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            minCellHeight: 10,
          },
          columnStyles: {
            time: {
              fillColor: [245, 245, 245],
              fontStyle: "bold",
              cellWidth: 18,
              textColor: [50, 50, 50],
            },
          },
          alternateRowStyles: {
            fillColor: [250, 253, 250],
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
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 min-h-screen relative`}>
      {/* --- Header Controls --- */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-20'>
        <div className='flex items-center gap-4 relative w-full md:w-auto'>
          <div className='relative' ref={headerCalendarRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all border ${
                showDatePicker
                  ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100"
                  : "bg-white border-transparent hover:bg-gray-100"
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
                  <HeaderWeekCalendar
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
            className='text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors ml-2 whitespace-nowrap hidden md:block'>
            Current Week
          </button>
        </div>

        <div className='flex items-center justify-end gap-3 w-full md:w-auto'>
          {/* --- Studio Filter --- */}
          <div className='flex bg-white p-1 rounded-xl border border-gray-200 shadow-sm'>
            <button
              onClick={() => setViewMode("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${viewMode === "ALL" ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              <Layers className='w-3.5 h-3.5' /> All
            </button>
            <button
              onClick={() => setViewMode("LOCAL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${viewMode === "LOCAL" ? "bg-emerald-50 text-emerald-700" : "text-gray-500 hover:text-gray-700"}`}>
              <Building2 className='w-3.5 h-3.5' /> My Studio
            </button>
          </div>

          <button
            disabled={isPrinting}
            onClick={handleGenerateMasterPDF}
            className='flex items-center gap-2 bg-white text-gray-700 border border-gray-200 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait whitespace-nowrap'>
            {isPrinting ? (
              <Loader2 className='w-5 h-5 animate-spin' />
            ) : (
              <Printer className='w-5 h-5' />
            )}
            <span className='hidden md:inline'>
              {isPrinting ? "Printing..." : "Print"}
            </span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-shadow shadow-lg shadow-gray-900/20 whitespace-nowrap'>
            <Plus className='w-5 h-5' /> Schedule
          </button>
        </div>
      </div>

      {/* --- Calendar Container --- */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        {/* Header Row */}
        <div className='grid grid-cols-7 border-b border-gray-100 bg-gray-50/80'>
          {weekDays.map((day) => {
            const isToday = isSameDay(day, new Date());
            return (
              <div
                key={day.toString()}
                className={`py-4 text-center border-r border-gray-100 last:border-r-0 ${isToday ? "bg-emerald-50/50" : ""}`}>
                <p
                  className={`text-xs font-bold uppercase mb-1 ${isToday ? "text-emerald-600" : "text-gray-400"}`}>
                  {format(day, "EEE")}
                </p>
                <div className='flex justify-center'>
                  <span
                    className={`text-sm font-bold px-2 py-1 rounded-full ${
                      isToday
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-gray-900"
                    }`}>
                    {format(day, "dd MMM")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Calendar Grid Body */}
        {loading ? (
          <div className='p-20'>
            <LoadingSpinner />
          </div>
        ) : (
          <div className='grid grid-cols-7 divide-x divide-gray-100 min-h-[500px]'>
            {weekDays.map((day) => {
              const dayClasses = filteredClasses
                .filter((c) => isSameDay(parseISO(c.startTime), day))
                .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

              return (
                <div
                  key={day.toString()}
                  className={`p-2 space-y-3 ${isSameDay(day, new Date()) ? "bg-gray-50/30" : ""}`}>
                  {dayClasses.map((cls) => {
                    const clsStudioId =
                      typeof cls.studioId === "object"
                        ? cls.studioId._id
                        : cls.studioId;
                    const isExternal = clsStudioId !== user.adminStudioLocation;
                    const studioName =
                      typeof cls.studioId === "object"
                        ? cls.studioId.studioName
                        : "External Studio";

                    return (
                      <motion.div
                        key={cls._id}
                        onClick={() => handleClassClick(cls)}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`p-3 rounded-xl border border-l-4 shadow-sm transition-all relative group
                            ${
                              isExternal
                                ? "bg-gray-50 border-gray-200 border-l-gray-400 opacity-80"
                                : `cursor-pointer hover:shadow-md bg-white border-gray-200 ${!cls.isActive ? "opacity-60 grayscale bg-gray-50" : "border-l-emerald-500"}`
                            }`}>
                        <div className='flex justify-between items-start mb-1'>
                          <p
                            className={`text-xs font-bold flex items-center gap-1 ${isExternal ? "text-gray-500" : "text-emerald-700"}`}>
                            <Clock className='w-3 h-3' />
                            {format(parseISO(cls.startTime), "HH:mm")}
                          </p>
                          {cls.isRecurring && !isExternal && (
                            <Repeat className='w-3 h-3 text-gray-300' />
                          )}
                          {isExternal && (
                            <Lock className='w-3 h-3 text-gray-300' />
                          )}
                        </div>

                        <h4
                          className={`font-bold text-sm leading-tight mb-1 ${isExternal || !cls.isActive ? "text-gray-500" : "text-gray-900"}`}>
                          {cls.className}
                        </h4>
                        <p className='text-xs text-gray-500 mb-2 truncate'>
                          {cls.instructorId?.fullName || "No Instructor"}
                        </p>

                        <div className='flex items-center gap-1.5 pt-2 border-t border-gray-100'>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              isExternal
                                ? "bg-gray-200 text-gray-600"
                                : cls.classType === "Private"
                                  ? "bg-purple-50 text-purple-700 border border-purple-100"
                                  : "bg-blue-50 text-blue-700 border border-blue-100"
                            }`}>
                            {cls.classType}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {/* ... (Modals) ... */}
        {showCreateModal && (
          <CreateClassModal
            onClose={handleModalClose}
            instructors={instructors}
            studioId={user.adminStudioLocation}
            existingClasses={classes}
            initialData={editingClass}
            onSuccess={() => {
              handleModalClose();
              fetchAllSchedules();
            }}
          />
        )}

        {showDetailModal && selectedClass && (
          <ClassDetailsModal
            classData={selectedClass}
            onClose={() => setShowDetailModal(false)}
            onEdit={() => handleEditClick(selectedClass)}
            onRefresh={fetchAllSchedules}
            canEdit={!selectedClass.isExternal}
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

// --- 1. HEADER WEEK CALENDAR (For top navigation) ---
const HeaderWeekCalendar = ({ selectedDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, "d");
      const cloneDay = day;
      const isWeekSelected = isSameWeek(day, selectedDate, { weekStartsOn: 1 });
      const isSpecificDay = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <button
          key={day.toString()}
          type='button' // Important: Prevents form submission
          onClick={() => onChange(cloneDay)}
          className={`
            w-full h-9 flex items-center justify-center text-xs font-bold transition-all relative
            ${isWeekSelected ? "bg-emerald-50 text-emerald-900" : "hover:bg-gray-50 text-gray-700"}
            ${!isCurrentMonth && !isWeekSelected ? "text-gray-300" : ""}
            ${isWeekSelected && i === 0 ? "rounded-l-lg" : ""}
            ${isWeekSelected && i === 6 ? "rounded-r-lg" : ""}
          `}>
          <span
            className={`
            flex items-center justify-center w-7 h-7 rounded-full
            ${isSpecificDay ? "bg-emerald-600 text-white shadow-md" : ""}
          `}>
            {formattedDate}
          </span>
        </button>,
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div
        className='grid grid-cols-7 gap-y-1 gap-x-0 mb-1'
        key={day.toString()}>
        {days}
      </div>,
    );
    days = [];
  }

  return (
    <div className='p-2'>
      <div className='flex justify-between items-center mb-4 px-1'>
        <h3 className='font-bold text-gray-900'>
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className='flex gap-1'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              prevMonth();
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronLeft className='w-4 h-4' />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              nextMonth();
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronRight className='w-4 h-4' />
          </button>
        </div>
      </div>
      <div className='grid grid-cols-7 gap-x-0 mb-2 text-center'>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div
            key={d}
            className='text-[10px] font-bold text-gray-400 uppercase'>
            {d}
          </div>
        ))}
      </div>
      <div>{rows}</div>
    </div>
  );
};

// --- 2. INPUT DATE PICKER (For Modal Form) ---
const InputDatePicker = ({ selectedDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);

  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = "";

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, "d");
      const cloneDay = day;
      const isSpecificDay = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);

      days.push(
        <button
          key={day.toString()}
          type='button' // CRITICAL: PREVENTS FORM SUBMISSION
          onClick={(e) => {
            e.stopPropagation(); // Stop bubbling
            e.preventDefault(); // Stop default form action
            onChange(cloneDay);
          }}
          className={`
            w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full transition-all
            ${!isCurrentMonth ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"}
            ${isSpecificDay ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700" : ""}
          `}>
          {formattedDate}
        </button>,
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className='flex justify-between mb-1' key={day.toString()}>
        {days}
      </div>,
    );
    days = [];
  }

  return (
    <div className='p-3'>
      <div className='flex justify-between items-center mb-4 px-1'>
        <h3 className='font-bold text-gray-900 text-sm'>
          {format(currentMonth, "MMMM yyyy")}
        </h3>
        <div className='flex gap-1'>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              prevMonth();
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronLeft className='w-4 h-4' />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              nextMonth();
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronRight className='w-4 h-4' />
          </button>
        </div>
      </div>
      <div className='flex justify-between mb-2 text-center'>
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div
            key={d}
            className='w-8 text-[10px] font-bold text-gray-400 uppercase'>
            {d}
          </div>
        ))}
      </div>
      <div>{rows}</div>
    </div>
  );
};

// --- CLASS DETAILS MODAL ---
const ClassDetailsModal = ({
  classData,
  onClose,
  onEdit,
  onRefresh,
  canEdit = true,
}) => {
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
        const passStudioId =
          typeof p.issuingStudio === "object"
            ? p.issuingStudio._id
            : p.issuingStudio;
        const currentStudioId = user.adminStudioLocation;

        // --- FIX: ARRAY LOGIC START ---

        // 1. Check Class Type (Pass has Array, Class has String)
        // Ensure p.classType is treated as an array
        const passClassTypes = Array.isArray(p.classType)
          ? p.classType
          : [p.classType]; // Fallback for legacy string data

        const isClassTypeValid = passClassTypes.includes(classData.classType);

        // 2. Check Instructor Type (Pass has Array, Class has String)
        // Get the instructor level of the class we are trying to book
        const targetInstructorLevel =
          classData.instructorId?.instructorType || classData.instructorType;

        // Ensure p.instructorType is treated as an array
        const passInstructorTypes = Array.isArray(p.instructorType)
          ? p.instructorType
          : [p.instructorType]; // Fallback for legacy string data

        const isInstructorTypeValid = passInstructorTypes.includes(
          targetInstructorLevel,
        );

        // --- FIX END ---

        return (
          p.isActive &&
          p.remainingCredits > 0 &&
          isClassTypeValid &&
          isInstructorTypeValid &&
          new Date(p.expiryDate) > new Date() &&
          String(passStudioId) === String(currentStudioId)
        );
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
    if (!window.confirm("Remove?")) return;
    try {
      await axiosInstance.post(API_PATHS.BOOKING.CANCEL_BOOKING, { bookingId });
      fetchBookings();
      onRefresh();
    } catch (error) {
      alert("Cancel failed");
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
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <div className='bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-xl'>
        {/* Header */}
        <div className='flex justify-between items-center p-4 border-b'>
          <div className='flex gap-4'>
            <button
              onClick={() => setActiveTab("details")}
              className={`font-bold text-sm pb-1 border-b-2 transition-colors ${activeTab === "details" ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-400"}`}>
              Details
            </button>
            <button
              onClick={() => setActiveTab("attendees")}
              className={`font-bold text-sm pb-1 border-b-2 transition-colors ${activeTab === "attendees" ? "border-emerald-500 text-emerald-700" : "border-transparent text-gray-400"}`}>
              Attendees
            </button>
          </div>
          <button
            onClick={onClose}
            className='p-1 hover:bg-gray-100 rounded-full'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        {/* Content */}
        <div className='flex-1 overflow-y-auto'>
          {activeTab === "details" && (
            <div className='p-6 space-y-4'>
              <div className='flex items-center gap-3'>
                <div className='bg-blue-50 p-2 rounded-lg text-blue-600'>
                  <Clock className='w-5 h-5' />
                </div>
                <div>
                  <p className='text-xs font-bold text-gray-400 uppercase'>
                    Time
                  </p>
                  <p className='font-bold text-gray-900'>
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
                  <p className='text-xs font-bold text-gray-400 uppercase'>
                    Instructor
                  </p>
                  <p className='font-medium text-gray-900'>
                    {classData.instructorId?.fullName} -{" "}
                    {classData.instructorId?.instructorType}
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-3'>
                <div className='bg-purple-50 p-2 rounded-lg text-purple-600'>
                  <Users className='w-5 h-5' />
                </div>
                <div>
                  <p className='text-xs font-bold text-gray-400 uppercase'>
                    Capacity
                  </p>
                  <p className='font-bold text-gray-900'>
                    {classData.currentEnrollment} / {classData.capacity}
                  </p>
                </div>
              </div>

              <div className='flex items-center gap-3'>
                <div className='bg-gray-100 p-2 rounded-lg text-gray-600'>
                  <MapPin className='w-5 h-5' />
                </div>
                <div>
                  <p className='text-xs font-bold text-gray-400 uppercase'>
                    Location
                  </p>
                  <p className='font-medium text-gray-900'>
                    {typeof classData.studioId === "object"
                      ? classData.studioId.studioName
                      : "External Studio"}
                  </p>
                </div>
              </div>

              {canEdit && (
                <div className='pt-6 border-t flex gap-2'>
                  <button
                    onClick={() => handleInitialClick("toggle")}
                    className={`flex-1 py-3 font-bold rounded-xl ${classData.isActive ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {classData.isActive ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    onClick={onEdit}
                    className='flex-1 py-3 font-bold bg-blue-50 text-blue-700 rounded-xl'>
                    Edit
                  </button>
                  <button
                    onClick={() => handleInitialClick("delete")}
                    className='px-4 py-3 bg-red-50 text-red-700 rounded-xl'>
                    <Trash2 className='w-5 h-5' />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "attendees" && (
            <div className='p-0 h-full flex flex-col'>
              {canEdit ? (
                <>
                  {/* Add Student Header */}
                  {!showAddStudent ? (
                    <div className='p-4 flex justify-between items-center border-b'>
                      <h4 className='font-bold'>Roster</h4>
                      <button
                        onClick={() => {
                          setShowAddStudent(true);
                          fetchUsers();
                        }}
                        className='flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold'>
                        <Plus className='w-3 h-3' /> Add Student
                      </button>
                    </div>
                  ) : (
                    <div className='p-4 border-b bg-gray-50'>
                      <div className='flex justify-between mb-2'>
                        <h4 className='font-bold text-sm'>Add Booking</h4>
                        <button onClick={() => setShowAddStudent(false)}>
                          <X className='w-4 h-4' />
                        </button>
                      </div>
                      <CustomSelect
                        label='Student'
                        options={users}
                        getLabel={(u) => u.fullName}
                        getValue={(u) => u._id}
                        onChange={handleUserSelect}
                        value={selectedUser?._id}
                        placeholder='Search student...'
                        searchable
                      />
                      {selectedUser && (
                        <div className='mt-3 space-y-2'>
                          {userPasses.length > 0 ? (
                            <div className='grid gap-3'>
                              {userPasses.map((p) => {
                                const isSelected = selectedPass === p._id;
                                return (
                                  <div
                                    key={p._id}
                                    onClick={() => setSelectedPass(p._id)}
                                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer group ${
                                      isSelected
                                        ? "border-emerald-500 bg-emerald-50/50 shadow-sm"
                                        : "border-gray-100 bg-white hover:border-emerald-200"
                                    }`}>
                                    {/* Header: Name & Credits */}
                                    <div className='flex justify-between items-start mb-2'>
                                      <div>
                                        <h5
                                          className={`font-bold text-sm ${isSelected ? "text-emerald-900" : "text-gray-900"}`}>
                                          {p.packageId?.packageName ||
                                            "Unnamed Pass"}
                                        </h5>
                                        <p className='text-[10px] text-gray-500 mt-0.5'>
                                          Expires:{" "}
                                          <span className='font-medium text-gray-700'>
                                            {p.expiryDate
                                              ? format(
                                                  new Date(p.expiryDate),
                                                  "dd MMM yyyy",
                                                )
                                              : "No Expiry"}
                                          </span>
                                        </p>
                                      </div>
                                      <div
                                        className={`text-right ${isSelected ? "text-emerald-700" : "text-gray-600"}`}>
                                        <span className='text-xl font-bold'>
                                          {p.remainingCredits}
                                        </span>
                                        <span className='text-[10px] font-bold block uppercase tracking-wider opacity-60'>
                                          Credits
                                        </span>
                                      </div>
                                    </div>

                                    {/* Tags Section */}
                                    <div className='space-y-1.5 pt-2 border-t border-gray-100/50'>
                                      {/* Class Types */}
                                      <div className='flex flex-wrap gap-1'>
                                        {p.classType &&
                                          p.classType.map((type, i) => (
                                            <span
                                              key={i}
                                              className='px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold uppercase tracking-wide border border-blue-100'>
                                              {type}
                                            </span>
                                          ))}
                                      </div>
                                      {/* Instructor Levels */}
                                      <div className='flex flex-wrap gap-1'>
                                        {p.instructorType &&
                                          p.instructorType.map((type, i) => (
                                            <span
                                              key={i}
                                              className='px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[9px] font-bold uppercase tracking-wide border border-purple-100'>
                                              {type}
                                            </span>
                                          ))}
                                      </div>
                                    </div>

                                    {/* Selection Checkmark */}
                                    {isSelected && (
                                      <div className='absolute bottom-3 right-3 bg-emerald-500 text-white rounded-full p-0.5'>
                                        <Check className='w-3 h-3' />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className='text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200'>
                              <p className='text-gray-400 text-xs font-medium'>
                                No valid passes available for this class.
                              </p>
                            </div>
                          )}
                          <button
                            disabled={!selectedPass || bookingProcessing}
                            onClick={handleAddStudent}
                            className='w-full py-2 bg-emerald-900 text-white rounded-lg text-xs font-bold mt-2'>
                            Confirm
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* List */}
                  <div className='flex-1 overflow-y-auto p-4 space-y-2'>
                    {bookings.map((b) => (
                      <div
                        key={b._id}
                        className='flex justify-between items-center p-3 border rounded-xl'>
                        <div>
                          <p className='font-bold text-sm'>
                            {b.userId.fullName}
                          </p>
                          <p className='text-xs text-gray-500'>
                            {b.passId?.passName}
                          </p>
                        </div>
                        <div className='flex gap-2'>
                          <button
                            onClick={() => handleCheckIn(b._id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border ${b.isAttend ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white border-gray-200"}`}>
                            {b.isAttend ? "Present" : "Check In"}
                          </button>
                          <button
                            onClick={() => handleCancelBooking(b._id)}
                            className='p-1 text-gray-400 hover:text-red-500'>
                            <Trash2 className='w-4 h-4' />
                          </button>
                        </div>
                      </div>
                    ))}
                    {bookings.length === 0 && (
                      <div className='text-center text-gray-400 py-10'>
                        No bookings yet.
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className='flex flex-col items-center justify-center h-full text-center p-8 text-gray-500'>
                  <Lock className='w-8 h-8 mb-2 text-gray-300' />
                  <p className='font-bold'>View Only</p>
                  <p className='text-xs'>
                    Attendee list is restricted for external studios.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Confirmations */}
        <AnimatePresence>
          {confirmationData && (
            <div className='absolute inset-0 bg-white/90 z-50 flex items-center justify-center'>
              <div className='text-center p-6'>
                <h3 className='font-bold text-lg mb-4'>Are you sure?</h3>
                <div className='flex gap-3 justify-center'>
                  <button
                    onClick={() => setConfirmationData(null)}
                    className='text-gray-500 font-bold'>
                    Cancel
                  </button>
                  <button
                    onClick={executeAction}
                    className='bg-red-600 text-white px-6 py-2 rounded-xl font-bold'>
                    Confirm
                  </button>
                </div>
              </div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

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

// --- MODIFIED CREATE CLASS MODAL WITH CUSTOM DATE PICKER ---
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

  // --- NEW: State for Date Picker Popover ---
  const [showCalendarPopover, setShowCalendarPopover] = useState(false);
  const calendarRef = useRef(null);

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

  // Handle outside click for calendar popover
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setShowCalendarPopover(false);
      }
    };
    if (showCalendarPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendarPopover]);

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
    // ... (Availability check logic remains exact same as previous) ...
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
    setShowCalendarPopover(false); // Close popover on selection
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

  // --- RECURRING TOGGLE LOGIC ---
  const showRecurringSection =
    !initialData || (initialData && initialData.isRecurring);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div
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
                  getLabel={(option) => option}
                  getValue={(option) => option}
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

              {/* --- CUSTOM DATE PICKER (REPLACED NATIVE) --- */}
              <div className='relative'>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Date
                </label>
                <div ref={calendarRef}>
                  <button
                    type='button'
                    onClick={() => setShowCalendarPopover(!showCalendarPopover)}
                    className='w-full p-3 border rounded-xl text-left flex items-center gap-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none'>
                    <CalendarDays className='w-4 h-4 text-emerald-600' />
                    {form.startTime
                      ? format(parseISO(form.startTime), "dd/MM/yyyy")
                      : "Select Date"}
                  </button>
                  <AnimatePresence>
                    {showCalendarPopover && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className='absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-4 w-[320px] z-50'>
                        <InputDatePicker
                          selectedDate={parseISO(form.startTime)}
                          onChange={handleDateChange}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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

            {/* ... Rest of the form logic ... */}
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

            {/* --- UPDATED RECURRING SECTION --- */}
            {showRecurringSection && (
              <div className='bg-gray-50 p-4 rounded-xl border border-gray-200 transition-all'>
                {!initialData ? (
                  <div className='flex items-center gap-2 mb-4'>
                    <input
                      type='checkbox'
                      id='recurring'
                      className='w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600'
                      onChange={(e) =>
                        setForm({ ...form, isRecurring: e.target.checked })
                      }
                    />
                    <label
                      htmlFor='recurring'
                      className='font-bold text-gray-900 text-sm select-none cursor-pointer'>
                      Recurring Class
                    </label>
                  </div>
                ) : initialData && initialData.isRecurring ? (
                  <div className='flex items-center gap-2 mb-4'>
                    <input
                      type='checkbox'
                      id='recurring'
                      checked={true}
                      disabled={initialData.isRecurring}
                      className='w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600'
                      onChange={(e) =>
                        setForm({ ...form, isRecurring: e.target.checked })
                      }
                    />
                    <label
                      htmlFor='recurring'
                      className='font-bold text-gray-900 text-sm select-none cursor-pointer'>
                      Recurring Class
                    </label>
                  </div>
                ) : null}

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
                      Class will repeat for {form.recurrenceCount || 1} week(s)
                      on selected days.
                    </p>
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

        {/* ... (Confirmation Overlays) ... */}
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

export default SchedulesList;
