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
  Power,
  FileEdit,
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
  const [viewMode, setViewMode] = useState("LOCAL");
  const [isPrinting, setIsPrinting] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [editingClass, setEditingClass] = useState(null);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const headerCalendarRef = useRef(null);

  const [instructors, setInstructors] = useState([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        headerCalendarRef.current &&
        !headerCalendarRef.current.contains(event.target)
      )
        setShowDatePicker(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchInstructors = async () => {
    try {
      const res = await axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL);
      setInstructors(res.data);
    } catch (e) {
      console.error("Failed to load instructors", e);
    }
  };

  useEffect(() => {
    fetchInstructors();
  }, []);

  useEffect(() => {
    if (instructors.length > 0) fetchAllSchedules();
    else fetchLocalSchedule();
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
      const localData = await fetchLocalSchedule();
      const otherStudioIds = new Set();
      instructors.forEach((inst) => {
        if (inst.assignedStudiosId && Array.isArray(inst.assignedStudiosId)) {
          inst.assignedStudiosId.forEach((studio) => {
            const sId = typeof studio === "object" ? studio._id : studio;
            if (sId !== user.adminStudioLocation) otherStudioIds.add(sId);
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

  const openCreateModal = async () => {
    await fetchInstructors();
    setShowCreateModal(true);
  };

  const handleEditClick = async (cls) => {
    await fetchInstructors();
    setShowDetailModal(false);
    setEditingClass(cls);
    setShowCreateModal(true);
  };

  const handleModalClose = () => {
    setShowCreateModal(false);
    setEditingClass(null);
  };

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
        if (dayIndex > 0) doc.addPage();

        doc.setFillColor(6, 78, 59);
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
          const row = { time: `${hour.toString().padStart(2, "0")}:00` };
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
              let span = Math.ceil(differenceInMinutes(end, start) / 60);
              if (span < 1) span = 1;
              const students = getStudentNames(foundClass._id);
              let cellContent = `${format(start, "HH:mm")} - ${format(end, "HH:mm")}\n${foundClass.className}\n[${foundClass.classType}]`;
              if (students) cellContent += `\n\nStudents: ${students}`;

              row[inst._id] = {
                content: cellContent,
                rowSpan: span,
                styles: {
                  valign: "middle",
                  halign: "center",
                  fillColor: [255, 255, 255],
                },
              };
              if (span > 1) occupied[inst._id] = span - 1;
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
          alternateRowStyles: { fillColor: [250, 253, 250] },
        });
      });

      setPdfUrl(doc.output("bloburl"));
      setShowPdfPreview(true);
    } catch (error) {
      alert("Failed to load data for print.");
    } finally {
      setIsPrinting(false);
    }
  };

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }).map((_, i) =>
    addDays(weekStart, i),
  );

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 min-h-screen relative`}>
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-20'>
        <div className='flex items-center gap-4 relative w-full md:w-auto'>
          <div className='relative' ref={headerCalendarRef}>
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all border ${showDatePicker ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-100" : "bg-white border-transparent hover:bg-gray-100"}`}>
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
                      onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
                      className='p-1 hover:bg-gray-200 rounded-md text-gray-500 transition-colors'>
                      <ChevronLeft className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
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
            onClick={() => setCurrentDate(new Date())}
            className='text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors ml-2 whitespace-nowrap hidden md:block'>
            Current Week
          </button>
        </div>

        <div className='flex items-center justify-end gap-3 w-full md:w-auto'>
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
            onClick={openCreateModal}
            className='flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-gray-800 transition-shadow shadow-lg shadow-gray-900/20 whitespace-nowrap'>
            <Plus className='w-5 h-5' /> Schedule
          </button>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
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
                    className={`text-sm font-bold px-2 py-1 rounded-full ${isToday ? "bg-emerald-500 text-white shadow-sm" : "text-gray-900"}`}>
                    {format(day, "dd MMM")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

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

                    return (
                      <motion.div
                        key={cls._id}
                        onClick={() => handleClassClick(cls)}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.02, y: -2 }}
                        className={`p-3 rounded-xl border border-l-4 shadow-sm transition-all relative group ${isExternal ? "bg-gray-50 border-gray-200 border-l-gray-400 opacity-80" : `cursor-pointer hover:shadow-md bg-white border-gray-200 ${!cls.isActive ? "opacity-60 bg-red-50/30 border-l-red-400" : "border-l-emerald-500"}`}`}>
                        <div className='flex justify-between items-start mb-1'>
                          <p
                            className={`text-xs font-bold flex items-center gap-1 ${isExternal ? "text-gray-500" : !cls.isActive ? "text-red-700" : "text-emerald-700"}`}>
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
                          className={`font-bold text-sm leading-tight mb-1 ${isExternal || !cls.isActive ? "text-gray-500" : "text-gray-900"} ${!cls.isActive && !isExternal ? "line-through opacity-80" : ""}`}>
                          {cls.className}
                        </h4>
                        <p className='text-xs text-gray-500 mb-2 truncate'>
                          {cls.instructorId?.fullName || "No Instructor"}
                        </p>
                        <div className='flex items-center gap-1.5 pt-2 border-t border-gray-100'>
                          {!cls.isActive && !isExternal ? (
                            <span className='px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200'>
                              INACTIVE
                            </span>
                          ) : (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${isExternal ? "bg-gray-200 text-gray-600" : cls.classType === "Private" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
                              {cls.classType}
                            </span>
                          )}
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
            onUpdateLocalClass={(updates) =>
              setSelectedClass((prev) => ({ ...prev, ...updates }))
            }
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

// --- HELPER COMPONENTS ---
const HeaderWeekCalendar = ({ selectedDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

  const rows = [];
  let day = startDate;
  while (day <= endDate) {
    let days = [];
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isWeekSelected = isSameWeek(day, selectedDate, { weekStartsOn: 1 });
      const isSpecificDay = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      days.push(
        <button
          key={day.toString()}
          type='button'
          onClick={() => onChange(cloneDay)}
          className={`w-full h-9 flex items-center justify-center text-xs font-bold transition-all relative ${isWeekSelected ? "bg-emerald-50 text-emerald-900" : "hover:bg-gray-50 text-gray-700"} ${!isCurrentMonth && !isWeekSelected ? "text-gray-300" : ""} ${isWeekSelected && i === 0 ? "rounded-l-lg" : ""} ${isWeekSelected && i === 6 ? "rounded-r-lg" : ""}`}>
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-full ${isSpecificDay ? "bg-emerald-600 text-white shadow-md" : ""}`}>
            {format(day, "d")}
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
              setCurrentMonth(subMonths(currentMonth, 1));
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronLeft className='w-4 h-4' />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              setCurrentMonth(addMonths(currentMonth, 1));
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

const InputDatePicker = ({ selectedDate, onChange }) => {
  const [currentMonth, setCurrentMonth] = useState(selectedDate);
  useEffect(() => {
    setCurrentMonth(selectedDate);
  }, [selectedDate]);
  const monthStart = startOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

  const rows = [];
  let day = startDate;
  while (day <= endDate) {
    let days = [];
    for (let i = 0; i < 7; i++) {
      const cloneDay = day;
      const isSpecificDay = isSameDay(day, selectedDate);
      const isCurrentMonth = isSameMonth(day, monthStart);
      days.push(
        <button
          key={day.toString()}
          type='button'
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onChange(cloneDay);
          }}
          className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-full transition-all ${!isCurrentMonth ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"} ${isSpecificDay ? "bg-emerald-600 text-white shadow-md hover:bg-emerald-700" : ""}`}>
          {format(day, "d")}
        </button>,
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className='flex justify-between mb-1' key={day.toString()}>
        {days}
      </div>,
    );
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
              setCurrentMonth(subMonths(currentMonth, 1));
            }}
            className='p-1 hover:bg-gray-100 rounded-lg text-gray-500'>
            <ChevronLeft className='w-4 h-4' />
          </button>
          <button
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              setCurrentMonth(addMonths(currentMonth, 1));
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

const DateSelectPopover = ({ value, onChange, label }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className='relative' ref={ref}>
      <label className='block text-xs font-bold text-gray-500 mb-1.5 uppercase tracking-wider'>
        {label}
      </label>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='w-full p-3.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all flex items-center justify-between bg-white shadow-sm hover:bg-gray-50'>
        <div className='flex items-center gap-2'>
          <CalendarDays className='w-4 h-4 text-emerald-600' />
          {value ? format(parseISO(value), "dd MMMM yyyy") : "Select Date"}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className='absolute z-[100] mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 p-2 w-[300px] left-1/2 -translate-x-1/2 bottom-full mb-2'>
            <InputDatePicker
              selectedDate={value ? parseISO(value) : new Date()}
              onChange={(d) => {
                onChange(d.toISOString());
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const RecurrenceActionCards = ({
  actionType,
  isActivating,
  onConfirm,
  onCancel,
  loading,
}) => {
  const [mode, setMode] = useState("all");
  const [targetDate, setTargetDate] = useState("");

  let actionText = "";
  if (actionType === "delete") actionText = "Delete";
  else if (actionType === "toggle")
    actionText = isActivating ? "Activate" : "Deactivate";
  else actionText = "Update";

  const options = [
    {
      id: "single",
      title: "This Class Only",
      desc: `Applies this ${actionText.toLowerCase()} to a specific date only.`,
      icon: <CalendarDays className='w-5 h-5' />,
    },
    {
      id: "all",
      title: "Entire Series",
      desc: `Applies this ${actionText.toLowerCase()} to all scheduled future classes in this series.`,
      icon: <Layers className='w-5 h-5' />,
    },
  ];

  return (
    <div className='space-y-4 text-left w-full max-w-sm mx-auto mt-4'>
      <div className='space-y-3'>
        {options.map((opt) => (
          <div
            key={opt.id}
            onClick={() => setMode(opt.id)}
            className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === opt.id ? "border-emerald-500 bg-emerald-50/50 shadow-sm" : "border-gray-100 bg-white hover:border-emerald-200"}`}>
            <div
              className={`mt-0.5 ${mode === opt.id ? "text-emerald-600" : "text-gray-400"}`}>
              {opt.icon}
            </div>
            <div>
              <h4
                className={`text-sm font-bold ${mode === opt.id ? "text-emerald-900" : "text-gray-700"}`}>
                {opt.title}
              </h4>
              <p
                className={`text-xs mt-1 ${mode === opt.id ? "text-emerald-700" : "text-gray-500"}`}>
                {opt.desc}
              </p>
            </div>
            {mode === opt.id && (
              <div className='ml-auto mt-0.5 text-emerald-600'>
                <CheckCircle2 className='w-5 h-5' />
              </div>
            )}
          </div>
        ))}
      </div>

      <AnimatePresence>
        {mode === "single" && actionType === "toggle" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-visible'>
            <div className='pt-2 pb-1'>
              <DateSelectPopover
                value={targetDate}
                onChange={setTargetDate}
                label={`Select Date to ${actionText}`}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className='flex gap-3 pt-4 border-t border-gray-100'>
        <button
          onClick={onCancel}
          className='flex-1 py-3 bg-white text-gray-600 border border-gray-200 font-bold rounded-xl hover:bg-gray-50 transition-colors'>
          Cancel
        </button>
        <button
          onClick={() => onConfirm(mode, targetDate)}
          disabled={
            loading ||
            (mode === "single" && actionType === "toggle" && !targetDate)
          }
          className={`flex-1 py-3 font-bold rounded-xl transition-all shadow-lg active:scale-95 text-white ${actionType === "delete" ? "bg-red-600 hover:bg-red-700 shadow-red-600/20" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20"} disabled:opacity-50`}>
          {loading ? "Processing..." : `Confirm ${actionText}`}
        </button>
      </div>
    </div>
  );
};

// --- CLASS DETAILS MODAL ---
const ClassDetailsModal = ({
  classData,
  onClose,
  onEdit,
  onRefresh,
  onUpdateLocalClass,
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
        const passClassTypes = Array.isArray(p.classType)
          ? p.classType
          : [p.classType];
        const isClassTypeValid = passClassTypes.includes(classData.classType);
        const targetInstructorLevel =
          classData.instructorId?.instructorType || classData.instructorType;
        const passInstructorTypes = Array.isArray(p.instructorType)
          ? p.instructorType
          : [p.instructorType];
        const isInstructorTypeValid = passInstructorTypes.includes(
          targetInstructorLevel,
        );

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

  const executeAction = async (modeOverride = null, targetDate = null) => {
    const type = confirmationData?.type || showRecurrenceOption;
    const mode = modeOverride || confirmationData?.mode;
    if (!type || !mode) return;

    setActionLoading(true);
    try {
      if (type === "delete") {
        await axiosInstance.delete(
          API_PATHS.SCHEDULE.DELETE_SCHEDULE(classData._id),
          { data: { deleteMode: mode, targetDate } },
        );
        onClose();
        onRefresh();
      } else if (type === "toggle") {
        await axiosInstance.put(
          API_PATHS.SCHEDULE.TOGGLE_ISACTIVE_SCHEDULE(classData._id),
          { toggleMode: mode, targetDate },
        );

        if (onUpdateLocalClass)
          onUpdateLocalClass({ isActive: !classData.isActive });
        onRefresh();
        setShowRecurrenceOption(null);
        setConfirmationData(null);
      }
    } catch (error) {
      alert(error.response?.data?.error || "Action failed");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <div className='bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-xl'>
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

        <div className='flex-1 overflow-y-auto'>
          {activeTab === "details" && (
            <div className='p-6 space-y-4'>
              {!classData.isActive && (
                <div className='mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3'>
                  <div className='bg-red-100 text-red-600 p-2 rounded-full shrink-0'>
                    <Power className='w-5 h-5' />
                  </div>
                  <div>
                    <h4 className='font-bold text-red-900 leading-tight'>
                      Class Inactive
                    </h4>
                    <p className='text-sm text-red-700 mt-1'>
                      This class is currently inactive for{" "}
                      <span className='font-bold'>
                        {format(
                          parseISO(classData.startTime),
                          "EEEE, dd MMMM yyyy",
                        )}
                      </span>
                      . No bookings can be made.
                    </p>
                  </div>
                </div>
              )}

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
                                    className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer group ${isSelected ? "border-emerald-500 bg-emerald-50/50 shadow-sm" : "border-gray-100 bg-white hover:border-emerald-200"}`}>
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
                                    <div className='space-y-1.5 pt-2 border-t border-gray-100/50'>
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

        {/* --- CONFIRMATION MODALS (Single Edit) --- */}
        <AnimatePresence>
          {confirmationData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-[70] flex items-center justify-center backdrop-blur-sm'>
              <div className='text-center p-6 w-full max-w-sm'>
                <div
                  className={`mx-auto flex items-center justify-center w-12 h-12 rounded-full mb-4 ${confirmationData.type === "delete" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                  {confirmationData.type === "delete" ? (
                    <Trash2 className='w-6 h-6' />
                  ) : (
                    <Power className='w-6 h-6' />
                  )}
                </div>
                <h3 className='font-bold text-lg text-gray-900 mb-2'>
                  Are you sure?
                </h3>
                <p className='text-sm text-gray-500 mb-6'>
                  You are about to{" "}
                  {confirmationData.type === "delete"
                    ? "permanently delete"
                    : classData.isActive
                      ? "deactivate"
                      : "activate"}{" "}
                  this class.
                </p>
                <div className='flex gap-3 justify-center'>
                  <button
                    onClick={() => setConfirmationData(null)}
                    className='flex-1 py-3 text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-50'>
                    Cancel
                  </button>
                  <button
                    onClick={() => executeAction()}
                    className={`flex-1 py-3 text-white rounded-xl font-bold shadow-lg ${confirmationData.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
                    Confirm
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- RECURRENCE OVERLAY (Toggle/Delete) --- */}
        <AnimatePresence>
          {showRecurrenceOption && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 z-[70] flex flex-col items-center justify-center p-6 backdrop-blur-sm'>
              <div
                className={`flex items-center justify-center w-12 h-12 rounded-full mb-4 ${showRecurrenceOption === "delete" ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>
                {showRecurrenceOption === "delete" ? (
                  <Trash2 className='w-6 h-6' />
                ) : (
                  <Power className='w-6 h-6' />
                )}
              </div>
              <h3 className='text-xl font-bold text-gray-900 mb-2'>
                Recurring Class
              </h3>
              <p className='text-sm text-gray-500 mb-2 text-center max-w-xs'>
                This class is part of an ongoing series. How would you like to
                apply this action?
              </p>
              <RecurrenceActionCards
                actionType={showRecurrenceOption}
                isActivating={!classData.isActive}
                onConfirm={(mode, targetDate) =>
                  executeAction(mode, targetDate)
                }
                onCancel={() => setShowRecurrenceOption(null)}
                loading={actionLoading}
              />
            </motion.div>
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

// --- CREATE CLASS MODAL ---
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

  const [selectedRecurrenceDays, setSelectedRecurrenceDays] = useState([]);
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
    isAlways: false,
  });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target))
        setShowCalendarPopover(false);
    };
    if (showCalendarPopover)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCalendarPopover]);

  useEffect(() => {
    if (initialData) {
      const isBulk = initialData.recurrenceCount >= 52;
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
        recurrenceCount: isBulk ? "" : initialData.recurrenceCount || 1,
        isAlways: isBulk,
      });
      if (initialData.selectedDays && Array.isArray(initialData.selectedDays))
        setSelectedRecurrenceDays(initialData.selectedDays);
      else setSelectedRecurrenceDays([getDay(parseISO(initialData.startTime))]);
    } else {
      setSelectedRecurrenceDays([getDay(new Date())]);
    }
  }, [initialData]);

  useEffect(() => {
    if (!initialData && !form.isRecurring)
      setSelectedRecurrenceDays([getDay(parseISO(form.startTime))]);
  }, [form.startTime, initialData, form.isRecurring]);

  const [isAvailable, setIsAvailable] = useState(true);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

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
      if (prev.includes(dayIndex))
        return prev.length === 1 ? prev : prev.filter((d) => d !== dayIndex);
      else return [...prev, dayIndex].sort();
    });
  };

  const getTargetDates = () => {
    let datesToCheck = [];
    const startDate = new Date(form.startTime);
    const startOfDay = new Date(startDate).setHours(0, 0, 0, 0);

    if (
      !form.isRecurring ||
      (initialData && updateMode === "single") ||
      selectedRecurrenceDays.length === 0
    ) {
      datesToCheck.push(startDate);
    } else {
      const weeksToRun = form.isAlways
        ? 52
        : parseInt(form.recurrenceCount) || 1;
      for (let i = 0; i < weeksToRun; i++) {
        const weekBase = startOfWeek(addWeeks(startDate, i), {
          weekStartsOn: 0,
        });
        selectedRecurrenceDays.forEach((dayIndex) => {
          const targetDate = addDays(weekBase, dayIndex);
          targetDate.setHours(
            startDate.getHours(),
            startDate.getMinutes(),
            0,
            0,
          );

          if (targetDate.getTime() >= startOfDay) {
            datesToCheck.push(targetDate);
          }
        });
      }
    }
    return datesToCheck.sort((a, b) => a.getTime() - b.getTime());
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
    form.recurrenceCount,
    form.isAlways,
    selectedRecurrenceDays,
    existingClasses,
  ]);

  const checkAvailability = () => {
    setIsAvailable(true);
    setAvailabilityMessage("");

    if (!form.instructorId) {
      setIsAvailable(false);
      setAvailabilityMessage("Please select an instructor first.");
      return;
    }
    if (!form.startTime || !form.duration) {
      setIsAvailable(false);
      setAvailabilityMessage("Please completely fill the time and duration.");
      return;
    }

    const instructor = instructors.find((i) => i._id === form.instructorId);
    if (!instructor) return;

    if (instructor.isActive === false) {
      setIsAvailable(false);
      setAvailabilityMessage(
        "Instructor profile is globally inactive. They cannot be scheduled.",
      );
      return;
    }

    const datesToCheck = getTargetDates();
    const isSingleClass = datesToCheck.length <= 1;

    let notWorkingDates = [];
    let timeConflicts = [];
    let overlapConflicts = [];

    for (const dateObj of datesToCheck) {
      const dayKey = format(dateObj, "EEEE").toLowerCase();
      const dailyShifts = instructor.workingHours?.[dayKey] || [];

      const classStart = new Date(dateObj);
      const classEnd = addMinutes(classStart, parseInt(form.duration) || 0);
      const classStartMins =
        classStart.getHours() * 60 + classStart.getMinutes();
      const classEndMins = classStartMins + (parseInt(form.duration) || 0);

      const instructorClasses = existingClasses.filter((cls) => {
        const clsInstructorId = cls.instructorId?._id || cls.instructorId;
        const isSelf = initialData && cls._id === initialData._id;
        return (
          !isSelf &&
          cls.isActive === true &&
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

      if (overlapConflicts.length > 0) continue;

      if (!isSingleClass) {
        const studioShifts = dailyShifts.filter((shift) => {
          const shiftLocId =
            typeof shift.location === "object"
              ? shift.location._id
              : shift.location;
          return (
            String(shiftLocId) === String(studioId) && shift.isActive !== false
          );
        });

        if (studioShifts.length === 0) {
          notWorkingDates.push(format(dateObj, "d MMM"));
          continue;
        }

        let fitsInShift = false;
        for (let shift of studioShifts) {
          const shiftStartMins = getMinutes(shift.start);
          const shiftEndMins = getMinutes(shift.end);
          if (
            classStartMins >= shiftStartMins &&
            classEndMins <= shiftEndMins
          ) {
            fitsInShift = true;
            break;
          }
        }

        if (!fitsInShift) {
          timeConflicts.push(format(classStart, "d MMM"));
          continue;
        }
      } else {
        const otherStudioShifts = dailyShifts.filter((shift) => {
          const shiftLocId =
            typeof shift.location === "object"
              ? shift.location._id
              : shift.location;
          return (
            String(shiftLocId) !== String(studioId) && shift.isActive !== false
          );
        });

        let boundToOtherStudio = false;
        for (let shift of otherStudioShifts) {
          const shiftStartMins = getMinutes(shift.start);
          const shiftEndMins = getMinutes(shift.end);
          if (classStartMins < shiftEndMins && classEndMins > shiftStartMins) {
            boundToOtherStudio = true;
            break;
          }
        }

        if (boundToOtherStudio) {
          timeConflicts.push(
            format(classStart, "d MMM") + " (Shift at another studio)",
          );
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
          `Instructor missing shift for recurring series on: ${notWorkingDates.join(", ")}.`,
        );
      if (timeConflicts.length > 0)
        messages.push(
          `Time conflicts detected on: ${timeConflicts.join(", ")}.`,
        );
      if (overlapConflicts.length > 0)
        messages.push(
          `Conflict with active classes on: ${overlapConflicts.join(", ")}.`,
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
    setShowCalendarPopover(false);
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

    if (form.isRecurring && selectedRecurrenceDays.length === 0) {
      alert("Please select at least one day for the recurring class.");
      return;
    }

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
      const finalRecurrenceCount = form.isAlways
        ? 52
        : parseInt(form.recurrenceCount) || 1;
      const scheduleDates = getTargetDates().map((d) => d.toISOString());

      const payload = {
        ...form,
        studioId: studioId,
        isRecurring: Boolean(form.isRecurring),
        recurrenceRule: "Weekly",
        recurrenceCount: finalRecurrenceCount,
        selectedDays: selectedRecurrenceDays,
        updateMode: mode || "single",
        scheduleDates,
      };

      if (initialData)
        await axiosInstance.put(
          API_PATHS.SCHEDULE.UPDATE_SCHEDULE(initialData._id),
          payload,
        );
      else
        await axiosInstance.post(API_PATHS.SCHEDULE.CREATE_SCHEDULE, payload);
      onSuccess();
    } catch (err) {
      alert(err.response?.data?.error || "Error saving class");
    } finally {
      setLoading(false);
      setUpdateMode(null);
    }
  };

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
            {/* --- Schedule Type Selection --- */}
            {!initialData && (
              <div className='flex gap-2 p-1.5 bg-gray-100 rounded-xl mb-4'>
                <button
                  type='button'
                  onClick={() => setForm({ ...form, isRecurring: false })}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!form.isRecurring ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  Single Class
                </button>
                <button
                  type='button'
                  onClick={() => setForm({ ...form, isRecurring: true })}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${form.isRecurring ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
                  Recurring Series
                </button>
              </div>
            )}

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
                <div className='w-full h-[46px] px-3 border bg-gray-50 rounded-xl flex items-center gap-2 text-gray-500'>
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
                  className='w-full h-[46px] p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500'
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                  required
                />
              </div>

              <div className='relative'>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Date
                </label>
                <div ref={calendarRef}>
                  <button
                    type='button'
                    onClick={() => setShowCalendarPopover(!showCalendarPopover)}
                    className='w-full h-[46px] px-3 border rounded-xl text-left flex items-center gap-2 text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-emerald-500 outline-none'>
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
                  className='w-full h-[46px] p-3 border rounded-xl outline-none focus:ring-2 focus:ring-emerald-500'
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
                className={`p-4 rounded-2xl border flex items-start gap-4 ${isAvailable ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
                <div
                  className={`mt-0.5 p-1.5 rounded-full shrink-0 ${isAvailable ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-600"}`}>
                  {isAvailable ? (
                    <CheckCircle2 className='w-5 h-5' />
                  ) : (
                    <AlertCircle className='w-5 h-5' />
                  )}
                </div>
                <div>
                  <h4
                    className={`font-bold text-base leading-tight ${isAvailable ? "text-emerald-900" : "text-red-900"}`}>
                    {isAvailable ? "Available" : "Unavailable"}
                  </h4>
                  <p
                    className={`text-sm mt-1 font-medium leading-relaxed ${isAvailable ? "text-emerald-700" : "text-red-700"}`}>
                    {availabilityMessage}
                  </p>
                </div>
              </motion.div>
            )}

            {showRecurringSection &&
              (form.isRecurring ? (
                <div className='bg-gray-50 p-4 rounded-xl border border-gray-200 transition-all'>
                  <div className='animate-in fade-in slide-in-from-top-2 duration-300'>
                    <div className='flex flex-col md:flex-row gap-6 items-start'>
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
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all border ${isSelected ? "bg-emerald-600 text-white border-emerald-600 shadow-md" : "bg-white text-gray-500 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50"}`}>
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className='w-full md:w-48 shrink-0'>
                        <div className='flex justify-between items-end mb-2'>
                          <label className='block text-xs font-bold text-gray-500'>
                            Duration
                          </label>
                          <div className='flex items-center gap-1.5'>
                            <input
                              type='checkbox'
                              id='isAlways'
                              checked={form.isAlways}
                              onChange={(e) =>
                                setForm({ ...form, isAlways: e.target.checked })
                              }
                              className='w-3.5 h-3.5 text-emerald-600 rounded focus:ring-emerald-500 accent-emerald-600'
                            />
                            <label
                              htmlFor='isAlways'
                              className='text-[10px] font-bold text-gray-600 cursor-pointer uppercase tracking-wider'>
                              Ongoing
                            </label>
                          </div>
                        </div>

                        {!form.isAlways ? (
                          <div className='relative'>
                            <input
                              type='number'
                              min='1'
                              className='w-full p-2.5 pr-14 border rounded-xl text-sm bg-white text-center font-bold outline-none focus:ring-2 focus:ring-emerald-500'
                              value={form.recurrenceCount}
                              onChange={(e) =>
                                setForm({
                                  ...form,
                                  recurrenceCount: e.target.value,
                                })
                              }
                              placeholder='1'
                            />
                            <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-bold pointer-events-none'>
                              Weeks
                            </span>
                          </div>
                        ) : (
                          <div className='w-full h-[42px] px-3 border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2'>
                            <Repeat className='w-4 h-4' /> Always
                          </div>
                        )}
                      </div>
                    </div>
                    <p className='text-[10px] text-gray-400 mt-2'>
                      {form.isAlways
                        ? "Class will repeat continuously (generated for 1 year ahead) on selected days."
                        : `Class will repeat for ${form.recurrenceCount || 1} week(s) on selected days.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className='p-4 bg-blue-50/50 text-blue-800 rounded-xl text-xs border border-blue-100 mb-6'>
                  <span className='font-bold block mb-1'>
                    Single Day Exception
                  </span>
                  This class will only happen once on the selected date. You can
                  schedule this even if the instructor doesn't have a regular
                  shift at your studio today, as long as they are completely
                  free across all locations.
                </div>
              ))}

            <div className='pt-2 flex gap-3 pb-2'>
              <button
                type='button'
                onClick={onClose}
                className='flex-1 py-3 font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors'>
                Cancel
              </button>
              <button
                type='submit'
                disabled={
                  loading ||
                  !isAvailable ||
                  (form.isRecurring && selectedRecurrenceDays.length === 0)
                }
                className={`flex-1 py-3 font-bold text-white rounded-xl shadow-lg transition-all ${isAvailable && (!form.isRecurring || selectedRecurrenceDays.length > 0) ? "bg-emerald-900 hover:bg-emerald-800" : "bg-gray-400 cursor-not-allowed"}`}>
                {loading
                  ? "Saving..."
                  : initialData
                    ? "Update Class"
                    : "Create Schedule"}
              </button>
            </div>
          </form>
        </div>

        {/* --- CONFIRMATION MODALS (Form Edits) --- */}
        <AnimatePresence>
          {showRecurrenceSelect && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 backdrop-blur-sm z-[70] flex flex-col items-center justify-center p-8 text-center'>
              <div className='bg-blue-50 p-4 rounded-full mb-4 shadow-sm text-blue-600'>
                <FileEdit className='w-8 h-8' />
              </div>
              <h3 className='font-bold text-xl text-gray-900 mb-2'>
                Edit Recurring Class
              </h3>
              <p className='text-sm text-gray-500 mb-6 max-w-xs mx-auto'>
                This class is part of a series. How would you like to apply your
                changes?
              </p>

              <RecurrenceActionCards
                actionType='edit'
                onConfirm={handleRecurrenceChoice}
                onCancel={() => setShowRecurrenceSelect(false)}
                loading={false}
              />
            </motion.div>
          )}
          {showConfirmation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className='absolute inset-0 bg-white/95 backdrop-blur-sm z-[70] flex flex-col items-center justify-center p-8 text-center'>
              <div className='bg-emerald-50 p-4 rounded-full mb-4 shadow-sm'>
                <Check className='w-8 h-8 text-emerald-600' />
              </div>
              <h3 className='font-bold text-xl text-gray-900 mb-2'>
                {initialData ? "Confirm Update?" : "Confirm Class Creation?"}
              </h3>
              <div className='flex flex-col w-full max-w-xs gap-3 mt-4'>
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
