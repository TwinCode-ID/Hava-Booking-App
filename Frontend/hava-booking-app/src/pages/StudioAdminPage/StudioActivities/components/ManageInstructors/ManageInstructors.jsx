import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format,
  startOfWeek,
  endOfWeek,
  addDays,
  subMonths,
  addMonths,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
} from "date-fns";
import {
  Search,
  Plus,
  X,
  Trash2,
  Power,
  CheckCircle2,
  AlertCircle,
  Clock,
  MapPin,
  Camera,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CalendarX,
  ArrowRightLeft,
  ChevronDown,
  User,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import { fetchImage } from "../../../../../utils/helper";

const getBasePath = () => {
  let base = API_PATHS.INSTRUCTOR.GET_ALL.split("?")[0];
  if (base.endsWith("/")) base = base.slice(0, -1);
  if (base.endsWith("/get-all")) base = base.replace("/get-all", "");
  return base;
};

// ============================================================================
// CUSTOM SLEEK UI COMPONENTS
// ============================================================================
const SleekSelect = ({
  value,
  onChange,
  options,
  placeholder,
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(
    (opt) => (typeof opt === "string" ? opt : opt.value) === value,
  );
  const displayLabel = selectedOption
    ? typeof selectedOption === "string"
      ? selectedOption
      : selectedOption.label
    : placeholder;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center justify-between w-full p-3.5 border border-gray-200 rounded-xl bg-white cursor-pointer hover:border-gray-300 transition-colors shadow-sm'>
        <span
          className={`text-[14px] truncate ${!value ? "text-gray-400" : "text-gray-900 font-medium"}`}>
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className='absolute z-[100] w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto'>
            {options.map((opt, idx) => {
              const optValue = typeof opt === "string" ? opt : opt.value;
              const optLabel = typeof opt === "string" ? opt : opt.label;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    onChange(optValue);
                    setIsOpen(false);
                  }}
                  className={`px-4 py-3 text-[14px] cursor-pointer hover:bg-gray-50 transition-colors ${value === optValue ? "bg-gray-50 font-bold text-gray-900" : "text-gray-700"}`}>
                  {optLabel}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
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
          className={`w-8 h-8 flex items-center justify-center text-xs font-bold rounded-lg transition-all ${!isCurrentMonth ? "text-gray-300" : "text-gray-700 hover:bg-gray-100"} ${isSpecificDay ? "bg-[#045D43] text-white shadow-md hover:bg-[#034d36]" : ""}`}>
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

const DateSelectPopover = ({
  value,
  onChange,
  placeholder = "Select Date",
}) => {
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
    <div className='relative w-full' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='w-full p-3.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none transition-all flex items-center justify-between bg-white hover:border-gray-300 shadow-sm'>
        <div className='flex items-center gap-2'>
          <CalendarDays className='w-4 h-4 text-gray-400' />
          {value ? (
            format(parseISO(value), "dd MMMM yyyy")
          ) : (
            <span className='text-gray-400'>{placeholder}</span>
          )}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className='absolute z-[100] mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-[280px]'>
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

const DateRangePopover = ({
  startDate,
  endDate,
  onChange,
  placeholder = "Select Date Range",
}) => {
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    startDate ? parseISO(startDate) : new Date(),
  );
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleDayClick = (day) => {
    if (!startDate || (startDate && endDate)) {
      onChange({ start: day.toISOString(), end: null });
    } else {
      const start = parseISO(startDate);
      if (day < start) {
        onChange({ start: day.toISOString(), end: startDate });
      } else {
        onChange({ start: startDate, end: day.toISOString() });
      }
      setTimeout(() => setOpen(false), 300);
    }
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const calStartDate = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calEndDate = endOfWeek(endOfMonth(monthStart), { weekStartsOn: 1 });

    const rows = [];
    let day = calStartDate;

    while (day <= calEndDate) {
      let days = [];
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const isCurrentMonth = isSameMonth(day, monthStart);

        let isSelectedStart = startDate && isSameDay(day, parseISO(startDate));
        let isSelectedEnd = endDate && isSameDay(day, parseISO(endDate));
        let isBetween =
          startDate &&
          endDate &&
          isWithinInterval(day, {
            start: parseISO(startDate),
            end: parseISO(endDate),
          });

        let baseStyle =
          "w-8 h-8 flex items-center justify-center text-xs font-bold transition-all ";
        if (!isCurrentMonth) baseStyle += "text-gray-300 ";
        else baseStyle += "text-gray-700 hover:bg-gray-100 ";

        if (isSelectedStart || isSelectedEnd) {
          baseStyle =
            "w-8 h-8 flex items-center justify-center text-xs font-bold bg-[#045D43] text-white shadow-md rounded-lg z-10 relative";
        } else if (isBetween) {
          baseStyle =
            "w-8 h-8 flex items-center justify-center text-xs font-bold bg-[#dcfce7] text-[#045D43] rounded-none";
        } else {
          baseStyle += " rounded-lg";
        }

        days.push(
          <button
            key={day.toString()}
            type='button'
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleDayClick(cloneDay);
            }}
            className={baseStyle}>
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

  const displayText = startDate ? (
    endDate ? (
      `${format(parseISO(startDate), "d MMM")} - ${format(parseISO(endDate), "d MMM yyyy")}`
    ) : (
      format(parseISO(startDate), "dd MMMM yyyy")
    )
  ) : (
    <span className='text-gray-400'>{placeholder}</span>
  );

  return (
    <div className='relative w-full' ref={ref}>
      <button
        type='button'
        onClick={() => setOpen(!open)}
        className='w-full p-3.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 outline-none transition-all flex items-center justify-between bg-white hover:border-gray-300 shadow-sm'>
        <div className='flex items-center gap-2'>
          <CalendarDays className='w-4 h-4 text-gray-400' />
          {displayText}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className='absolute z-[100] mt-1 bg-white rounded-xl shadow-xl border border-gray-100 p-2 w-[280px]'>
            {renderCalendar()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
const ManageInstructors = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [instructors, setInstructors] = useState([]);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreateFormOpen, setIsCreateFormOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);

  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });
  const showAlert = (title, message, type = "error") =>
    setAlertState({ isOpen: true, title, message, type });
  const closeAlert = () =>
    setAlertState((prev) => ({ ...prev, isOpen: false }));

  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, studiosRes] = await Promise.all([
        axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL),
        axiosInstance.get(API_PATHS.STUDIO.GET_ALL),
      ]);
      setInstructors(instRes.data);
      setStudios(studiosRes.data);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.adminStudioLocation) fetchData();
  }, [user.adminStudioLocation]);

  useEffect(() => {
    if (editingInstructor) {
      const updated = instructors.find((i) => i._id === editingInstructor._id);
      if (updated) setEditingInstructor(updated);
    }
  }, [instructors]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(
        API_PATHS.INSTRUCTOR.DELETE_INSTRUCTOR(deleteId),
      );
      fetchData();
      setDeleteId(null);
    } catch (error) {
      showAlert("Delete Failed", "Could not delete the instructor.");
    }
  };

  const filteredInstructors = useMemo(() => {
    return instructors.filter(
      (inst) =>
        inst.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.instructorType.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [instructors, searchQuery]);

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-[#f8fafc] relative min-h-screen`}>
      {!isEmbedded && (
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Manage Instructors
          </h1>
          <p className='text-gray-500 text-sm mt-1'>
            View and manage instructors assigned to your studio.
          </p>
        </div>
      )}

      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search by name...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#045D43] transition-all shadow-sm'
          />
        </div>
        <div className='flex items-center gap-4 w-full md:w-auto justify-end'>
          <div className='text-sm text-gray-500 font-medium whitespace-nowrap hidden md:block'>
            Showing{" "}
            <span className='text-gray-900 font-bold'>
              {filteredInstructors.length}
            </span>{" "}
            instructors
          </div>
          <button
            onClick={() => setIsCreateFormOpen(true)}
            className='flex items-center gap-2 bg-[#045D43] text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-[#034d36] transition-colors shadow-md'>
            <Plus className='w-4 h-4' /> Add Instructor
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20'>
        {filteredInstructors.map((inst) => (
          <InstructorCard
            key={inst._id}
            instructor={inst}
            onEdit={() => setEditingInstructor(inst)}
            onDelete={() => setDeleteId(inst._id)}
          />
        ))}
      </div>

      <AnimatePresence>
        {editingInstructor && (
          <InstructorDashboardModal
            user={user}
            instructor={editingInstructor}
            studios={studios}
            onClose={() => setEditingInstructor(null)}
            refreshData={fetchData}
            showAlert={showAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <ConfirmationModal
            title='Delete Instructor?'
            message='Are you sure you want to delete this profile? This action cannot be undone.'
            confirmText='Delete'
            confirmColor='bg-red-600 hover:bg-red-700'
            icon={<Trash2 className='w-6 h-6' />}
            iconColor='text-red-600 bg-red-100'
            onClose={() => setDeleteId(null)}
            onConfirm={handleDelete}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {alertState.isOpen && (
          <GenericAlertModal {...alertState} onClose={closeAlert} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// CENTERED MODAL DASHBOARD
// ============================================================================
const InstructorDashboardModal = ({
  user,
  instructor,
  studios,
  onClose,
  refreshData,
  showAlert,
}) => {
  const DAYS_ORDER = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const INSTRUCTOR_TYPES = [
    { value: "Apprentice Instructor", label: "Apprentice Instructor" },
    { value: "Junior Instructor", label: "Junior Instructor" },
    { value: "Senior Instructor", label: "Senior Instructor" },
    { value: "Master Instructor", label: "Master Instructor" },
    { value: "Principal Instructor", label: "Principal Instructor" },
    { value: "Special Instructor", label: "Special Instructor" },
  ];

  const myStudioId = String(user?.adminStudioLocation);
  const myStudioName =
    studios.find((s) => String(s._id) === myStudioId)?.studioName ||
    "My Studio";

  const [activeTab, setActiveTab] = useState("Schedule");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAddShift, setShowAddShift] = useState(false);

  // Action Modals
  const [actionSetup, setActionSetup] = useState(null);
  const [actionConfig, setActionConfig] = useState({
    mode: "range",
    startDate: "",
    endDate: "",
    targetStudioId: "",
  });

  const [profileForm, setProfileForm] = useState({
    fullName: instructor.fullName || "",
    instructorType: instructor.instructorType || "",
    bio: instructor.bio || "",
  });

  const [assignForm, setAssignForm] = useState({
    day: "monday",
    start: "",
    end: "",
    studioId: myStudioId,
  });

  const hasSchedule =
    instructor.workingHours &&
    Object.values(instructor.workingHours).some((day) => day?.length > 0);
  const basePath = getBasePath();

  useEffect(() => {
    if (instructor) {
      setProfileForm({
        fullName: instructor.fullName || "",
        instructorType: instructor.instructorType || "",
        bio: instructor.bio || "",
      });
    }
  }, [instructor._id]);

  const handleProfileSave = async () => {
    try {
      setIsProcessing(true);
      await axiosInstance.put(
        `${basePath}/${instructor._id}/update-profile`,
        profileForm,
      );
      await refreshData();
      showAlert("Success", "Profile changes saved successfully.", "success");
    } catch (error) {
      showAlert(
        "Failed to save",
        error.response?.data?.error || error.message,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();

    const dayKey = assignForm.day.toLowerCase();

    const newStartMins =
      parseInt(assignForm.start.split(":")[0]) * 60 +
      parseInt(assignForm.start.split(":")[1]);
    const newEndMins =
      parseInt(assignForm.end.split(":")[0]) * 60 +
      parseInt(assignForm.end.split(":")[1]);

    if (newStartMins >= newEndMins) {
      showAlert("Invalid Time", "End time must be after start time.", "error");
      return;
    }

    // Strict overlap check across all active shifts in all studios for this day
    const existingShifts = instructor.workingHours?.[dayKey] || [];
    const hasConflict = existingShifts.some((shift) => {
      if (shift.isActive === false) return false;
      const sStartMins =
        parseInt(shift.start.split(":")[0]) * 60 +
        parseInt(shift.start.split(":")[1]);
      const sEndMins =
        parseInt(shift.end.split(":")[0]) * 60 +
        parseInt(shift.end.split(":")[1]);
      return newStartMins < sEndMins && newEndMins > sStartMins;
    });

    if (hasConflict) {
      showAlert(
        "Schedule Conflict",
        "Instructor is already assigned to a shift during this time across studios.",
        "error",
      );
      return;
    }

    try {
      setIsProcessing(true);
      const newWorkingHours = JSON.parse(
        JSON.stringify(instructor.workingHours || {}),
      );
      if (!newWorkingHours[dayKey]) newWorkingHours[dayKey] = [];

      newWorkingHours[dayKey].push({
        start: assignForm.start,
        end: assignForm.end,
        location: assignForm.studioId,
        isActive: true,
      });

      let newAssignedStudios = [...(instructor.assignedStudiosId || [])].map(
        (s) => s._id || s,
      );
      if (!newAssignedStudios.includes(assignForm.studioId))
        newAssignedStudios.push(assignForm.studioId);

      await axiosInstance.put(`${basePath}/${instructor._id}/update-profile`, {
        workingHours: newWorkingHours,
        assignedStudiosId: newAssignedStudios,
      });

      await refreshData();
      setShowAddShift(false);
      setAssignForm({
        day: "monday",
        start: "",
        end: "",
        studioId: myStudioId,
      });
      showAlert("Success", "New schedule block added.", "success");
    } catch (error) {
      showAlert(
        "Action Failed",
        error.response?.data?.error || "Failed to add shift.",
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const executeAction = async () => {
    try {
      if (
        actionSetup.type === "bulk_reassign" ||
        actionSetup.type === "pause"
      ) {
        if (actionConfig.mode === "range") {
          if (!actionConfig.startDate)
            return showAlert("Error", "Please select a date range.", "error");

          const rStart = new Date(actionConfig.startDate).getTime();
          const rEnd = new Date(
            actionConfig.endDate || actionConfig.startDate,
          ).getTime();

          let hasCollision = false;
          DAYS_ORDER.forEach((d) => {
            (instructor.workingHours[d] || []).forEach((slot) => {
              const loc =
                typeof slot.location === "object"
                  ? slot.location._id
                  : slot.location;
              if (String(loc) === myStudioId) {
                (slot.exceptions || []).forEach((ex) => {
                  if (ex.type === "reassign" || ex.type === "pause") {
                    const exStart = new Date(ex.startDate).getTime();
                    const exEnd = new Date(ex.endDate).getTime();
                    if (rStart <= exEnd && rEnd >= exStart) {
                      hasCollision = true;
                    }
                  }
                });
              }
            });
          });

          if (hasCollision) {
            return showAlert(
              "Date Collision",
              "Instructor already has a reassignment or pause during this date range.",
              "error",
            );
          }
        }
      }

      setIsProcessing(true);
      const toggleUrlBase = `${basePath}/${instructor._id}/shift`;

      if (actionSetup.type === "pause") {
        const toggleUrl = `${toggleUrlBase}/${actionSetup.shiftId}/toggle`;
        if (actionConfig.mode === "range") {
          await axiosInstance.put(toggleUrl, {
            day: actionSetup.day,
            updateMode: "range",
            startDate: actionConfig.startDate,
            endDate: actionConfig.endDate || actionConfig.startDate,
            isActive: false,
          });
          showAlert(
            "Success",
            `Class temporarily paused and refunded.`,
            "success",
          );
        } else {
          await axiosInstance.put(toggleUrl, {
            day: actionSetup.day,
            updateMode: "all",
            isActive: false,
          });
        }
      } else if (actionSetup.type === "bulk_reassign") {
        if (!actionConfig.startDate || !actionConfig.targetStudioId) {
          setIsProcessing(false);
          return showAlert("Error", "Please fill all fields.", "error");
        }

        await axiosInstance.put(`${toggleUrlBase}/bulk_reassign/toggle`, {
          startDate: actionConfig.startDate,
          endDate: actionConfig.endDate || actionConfig.startDate,
          sourceStudioId: myStudioId,
          targetStudioId: actionConfig.targetStudioId,
        });

        showAlert(
          "Success",
          `Instructor globally reassigned for the selected range.`,
          "success",
        );
      }

      await refreshData();
    } catch (error) {
      showAlert(
        "Action Failed",
        error.response?.data?.error || error.message,
        "error",
      );
    } finally {
      setIsProcessing(false);
      setActionSetup(null);
      setActionConfig({
        mode: "range",
        startDate: "",
        endDate: "",
        targetStudioId: "",
      });
    }
  };

  const handleBulkUndoGlobal = async (startDateStr, sourceId) => {
    try {
      setIsProcessing(true);
      await axiosInstance.put(
        `${basePath}/${instructor._id}/shift/bulk_undo/toggle`,
        {
          startDate: startDateStr,
          sourceStudioId: sourceId || myStudioId,
        },
      );
      await refreshData();
    } catch (error) {
      showAlert(
        "Action Failed",
        error.response?.data?.error || error.message,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const executeTurnOn = async (shiftId, day) => {
    try {
      setIsProcessing(true);
      const toggleUrl = `${basePath}/${instructor._id}/shift/${shiftId}/toggle`;
      await axiosInstance.put(toggleUrl, {
        day,
        updateMode: "all",
        targetDate: null,
        isActive: true,
      });
      await refreshData();
    } catch (error) {
      showAlert(
        "Action Failed",
        error.response?.data?.error || error.message,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOff = async (shiftId, day) => {
    if (!window.confirm("Delete this shift permanently?")) return;
    try {
      setIsProcessing(true);
      const newWorkingHours = JSON.parse(
        JSON.stringify(instructor.workingHours || {}),
      );
      newWorkingHours[day] = newWorkingHours[day].filter(
        (s) => s._id !== shiftId,
      );

      await axiosInstance.put(`${basePath}/${instructor._id}/update-profile`, {
        workingHours: newWorkingHours,
      });
      await refreshData();
    } catch (error) {
      showAlert(
        "Action Failed",
        error.response?.data?.error || error.message,
        "error",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Group all identical outbound exceptions together for the global section
  const aggregatedExceptions = useMemo(() => {
    const map = new Map();
    const todayMs = new Date().setHours(0, 0, 0, 0);

    DAYS_ORDER.forEach((day) => {
      (instructor.workingHours?.[day] || []).forEach((slot) => {
        if (String(slot.location?._id || slot.location) === myStudioId) {
          (slot.exceptions || []).forEach((ex) => {
            if (
              (ex.type === "reassign" || ex.type === "pause") &&
              new Date(ex.endDate).getTime() >= todayMs
            ) {
              const key = `${ex.type}_${ex.startDate}_${ex.endDate}_${ex.targetStudioId || "pause"}`;
              if (!map.has(key)) {
                map.set(key, {
                  startDate: ex.startDate,
                  endDate: ex.endDate,
                  log: ex,
                  shifts: [],
                });
              }
              map
                .get(key)
                .shifts.push({ shiftId: slot._id, day, exceptionId: ex._id });
            }
          });
        }
      });
    });
    return Array.from(map.values());
  }, [instructor, myStudioId]);

  // Group all incoming temporary shifts together for the global section
  const aggregatedIncomingTemp = useMemo(() => {
    const map = new Map();
    const todayMs = new Date().setHours(0, 0, 0, 0);

    DAYS_ORDER.forEach((day) => {
      (instructor.workingHours?.[day] || []).forEach((slot) => {
        if (String(slot.location?._id || slot.location) === myStudioId) {
          const incomingEx = (slot.exceptions || []).find(
            (e) => e.type === "temp_incoming",
          );
          if (incomingEx && new Date(incomingEx.endDate).getTime() >= todayMs) {
            const key = `${incomingEx.startDate}_${incomingEx.endDate}_${incomingEx.originalStudioId}`;
            if (!map.has(key)) {
              map.set(key, {
                log: incomingEx,
                originalStudioName:
                  studios.find(
                    (s) =>
                      String(s._id) === String(incomingEx.originalStudioId),
                  )?.studioName || "Another Studio",
              });
            }
          }
        }
      });
    });
    return Array.from(map.values());
  }, [instructor, myStudioId, studios]);

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-8 bg-black/40 backdrop-blur-sm'>
      {/* ACTION POPUPS OVERLAY */}
      <AnimatePresence>
        {actionSetup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='absolute inset-0 z-[80] flex items-center justify-center p-4 bg-white/60 backdrop-blur-sm'>
            <div className='bg-white border border-gray-200 shadow-2xl rounded-2xl w-full max-w-md p-8'>
              <div className='flex justify-between items-center mb-6'>
                <h3 className='text-xl font-bold text-gray-900'>
                  {actionSetup.type === "pause"
                    ? "Deactivate Shift"
                    : actionSetup.type === "bulk_reassign"
                      ? "Global Reassignment"
                      : "Reassign Class Date"}
                </h3>
                <button
                  onClick={() => setActionSetup(null)}
                  className='text-gray-400 hover:text-gray-700 transition-colors'>
                  <X className='w-5 h-5' />
                </button>
              </div>

              {actionSetup.type === "pause" ? (
                <>
                  <p className='text-gray-500 text-sm mb-6'>
                    Canceling a schedule will automatically refund passes for
                    affected bookings.
                  </p>
                  <div className='space-y-4 mb-8'>
                    <label
                      className={`block p-4 border rounded-xl cursor-pointer transition-all ${actionConfig.mode === "range" ? "border-[#045D43] bg-[#f0fdf4]" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className='flex items-center gap-3'>
                        <input
                          type='radio'
                          checked={actionConfig.mode === "range"}
                          onChange={() =>
                            setActionConfig({ ...actionConfig, mode: "range" })
                          }
                          className='accent-[#045D43] w-4 h-4'
                        />
                        <span className='font-semibold text-gray-900 text-sm'>
                          Specific Dates (Refunds Pass)
                        </span>
                      </div>
                      {actionConfig.mode === "range" && (
                        <div className='mt-4 ml-7'>
                          <DateRangePopover
                            startDate={actionConfig.startDate}
                            endDate={actionConfig.endDate}
                            onChange={(res) =>
                              setActionConfig({
                                ...actionConfig,
                                startDate: res.start,
                                endDate: res.end,
                              })
                            }
                          />
                        </div>
                      )}
                    </label>
                    <label
                      className={`block p-4 border rounded-xl cursor-pointer transition-all ${actionConfig.mode === "all" ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-300"}`}>
                      <div className='flex items-center gap-3'>
                        <input
                          type='radio'
                          checked={actionConfig.mode === "all"}
                          onChange={() =>
                            setActionConfig({ ...actionConfig, mode: "all" })
                          }
                          className='accent-red-600 w-4 h-4'
                        />
                        <span className='font-semibold text-gray-900 text-sm'>
                          Entire Series Permanently
                        </span>
                      </div>
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <p className='text-gray-500 text-sm mb-6'>
                    {actionSetup.type === "bulk_reassign"
                      ? "Temporarily reassign this instructor from all active shifts in your studio to a different studio for a specific date range."
                      : "Temporarily assign this instructor to a different studio for a specific date range."}
                  </p>
                  <div className='space-y-5 mb-8'>
                    <div>
                      <label className='block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block'>
                        Select Date(s)
                      </label>
                      <DateRangePopover
                        startDate={actionConfig.startDate}
                        endDate={actionConfig.endDate}
                        onChange={(res) =>
                          setActionConfig({
                            ...actionConfig,
                            startDate: res.start,
                            endDate: res.end,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className='block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 block'>
                        Target Studio
                      </label>
                      <SleekSelect
                        value={actionConfig.targetStudioId}
                        options={studios
                          .filter((s) => String(s._id) !== myStudioId)
                          .map((s) => ({
                            value: s._id,
                            label: s.studioName,
                          }))}
                        onChange={(val) =>
                          setActionConfig({
                            ...actionConfig,
                            targetStudioId: val,
                          })
                        }
                        placeholder='Select Studio'
                      />
                    </div>
                  </div>
                </>
              )}

              <div className='flex gap-3'>
                <button
                  disabled={isProcessing}
                  onClick={() => setActionSetup(null)}
                  className='flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors'>
                  Cancel
                </button>
                <button
                  disabled={isProcessing}
                  onClick={executeAction}
                  className='flex-1 py-3.5 bg-[#111827] hover:bg-gray-800 text-white font-bold rounded-xl transition-colors'>
                  {isProcessing ? "Processing..." : "Confirm"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, scale: 0.98 }}
        className='w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]'>
        {/* Modal Header */}
        <div className='flex justify-between items-center px-8 py-5 border-b border-gray-100 shrink-0 bg-white z-10'>
          <div className='flex items-center gap-4'>
            <div className='flex items-center gap-2'>
              <ChevronLeft className='w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors' />
              <ChevronRight className='w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600 transition-colors' />
            </div>
            <span className='text-[14px] font-bold text-gray-400'>
              Instructor Management Dashboard
            </span>
          </div>
          <div className='flex items-center gap-4'>
            <button
              disabled={isProcessing}
              onClick={handleProfileSave}
              className='px-6 py-2 bg-[#045D43] hover:bg-[#034d36] text-white text-[13px] font-bold rounded-lg transition-colors shadow-sm'>
              {isProcessing ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={onClose}
              className='p-1 hover:bg-gray-100 rounded-full transition-colors'>
              <X className='w-6 h-6 text-gray-400' />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className='flex-1 overflow-y-auto'>
          {/* Profile Header Block */}
          <div className='px-10 py-8 flex justify-between bg-white items-start'>
            <div className='flex gap-6'>
              <div className='w-[88px] h-[88px] rounded-full border border-gray-100 overflow-hidden bg-gray-50 flex items-center justify-center relative group shrink-0'>
                {instructor.avatar ? (
                  <img
                    src={fetchImage(instructor.avatar)}
                    alt='avatar'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <span className='text-3xl font-bold text-gray-300'>
                    {instructor.fullName.charAt(0).toUpperCase()}
                  </span>
                )}
                <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer'>
                  <Camera className='w-6 h-6 text-white' />
                </div>
                <input
                  type='file'
                  accept='image/*'
                  className='absolute inset-0 opacity-0 cursor-pointer'
                />
              </div>

              <div className='flex flex-col justify-center gap-2'>
                <div className='flex items-center gap-3'>
                  <h2 className='text-2xl font-bold text-gray-900 tracking-tight'>
                    {instructor.fullName}
                  </h2>
                  <div className='flex items-center gap-1.5 px-2.5 py-0.5 bg-[#dcfce7] rounded-md text-[11px] font-bold text-[#166534]'>
                    <div className='w-1.5 h-1.5 rounded-full bg-[#166534]'></div>{" "}
                    Active
                  </div>
                </div>
                <div className='flex gap-12 text-[13px] mt-1 mb-2'>
                  <div>
                    <p className='text-gray-400 font-semibold mb-0.5'>Title</p>
                    <p className='font-bold text-gray-900'>
                      {instructor.instructorType}
                    </p>
                  </div>
                  <div>
                    <p className='text-gray-400 font-semibold mb-0.5'>
                      Locations
                    </p>
                    <p className='font-bold text-gray-900'>
                      {instructor.assignedStudiosId.length} Studios
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Reassign Button at Top Profile Level */}
            <div className='flex flex-col items-end gap-3'>
              <button
                onClick={() => setActionSetup({ type: "bulk_reassign" })}
                className='px-4 py-2 border border-[#045D43] text-[#045D43] hover:bg-emerald-50 rounded-lg text-sm font-bold transition-colors shadow-sm'>
                Reassign Date
              </button>
            </div>
          </div>

          {/* Clean Border Tabs */}
          <div className='px-10 border-b border-gray-100 flex gap-4 bg-white'>
            <button
              onClick={() => setActiveTab("Schedule")}
              className={`pb-4 px-2 text-[14px] font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "Schedule" ? "border-[#111827] text-[#111827]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              <CalendarDays className='w-4 h-4' /> Schedule
            </button>
            <button
              onClick={() => setActiveTab("Personal Information")}
              className={`pb-4 px-2 text-[14px] font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "Personal Information" ? "border-[#111827] text-[#111827]" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
              <User className='w-4 h-4' /> Personal Information
            </button>
          </div>

          {/* Active Tab Content Area */}
          <div className='p-10 bg-[#fafafa] min-h-full'>
            {/* SCHEDULE VIEW */}
            {activeTab === "Schedule" && (
              <div className='max-w-3xl mx-auto'>
                <div className='space-y-4'>
                  {hasSchedule ? (
                    (() => {
                      const allShiftsRender = [];
                      const todayMs = new Date().setHours(0, 0, 0, 0);

                      DAYS_ORDER.forEach((day) => {
                        const timeSlots = instructor.workingHours?.[day] || [];
                        timeSlots.forEach((slot) => {
                          const slotLocationStr = String(
                            slot.location?._id || slot.location,
                          );
                          const isMyLocation = slotLocationStr === myStudioId;
                          const displayLocationName =
                            studios.find(
                              (s) => String(s._id) === slotLocationStr,
                            )?.studioName || "Another Studio";

                          const exceptions = slot.exceptions || [];
                          const isTempIncoming = exceptions.some(
                            (e) => e.type === "temp_incoming",
                          );

                          // Exclude ALL temporary incoming shifts from this main list.
                          if (isTempIncoming) return;

                          allShiftsRender.push({
                            ...slot,
                            day,
                            displayLocationName,
                            isMyRegularShift: isMyLocation,
                            isExternal: !isMyLocation,
                            isActive: slot.isActive !== false,
                          });
                        });
                      });

                      return (
                        <>
                          {allShiftsRender.length === 0 &&
                          aggregatedExceptions.length === 0 &&
                          aggregatedIncomingTemp.length === 0 ? (
                            <div className='text-center py-10 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium'>
                              No shifts currently assigned.
                            </div>
                          ) : (
                            allShiftsRender.map((slot) => {
                              const day = slot.day;
                              let boxDay = day.substring(0, 3).toUpperCase();

                              return (
                                <div
                                  key={slot._id}
                                  className={`bg-white border rounded-2xl p-6 transition-all shadow-sm hover:border-gray-300 ${slot.isExternal ? "border-gray-200 bg-gray-50/40" : "border-gray-200"}`}>
                                  <div className='flex gap-4 mb-5'>
                                    <div
                                      className={`flex flex-col justify-center min-h-[56px] border rounded-xl shrink-0 px-4 py-2 text-center ${slot.isExternal ? "border-gray-200 bg-white" : "border-gray-200 bg-white"}`}>
                                      <span
                                        className={`text-[12px] font-bold uppercase tracking-widest leading-none whitespace-nowrap ${slot.isExternal ? "text-gray-500" : "text-gray-500"}`}>
                                        {boxDay}
                                      </span>
                                    </div>
                                    <div className='flex flex-col justify-center'>
                                      <h3
                                        className={`text-[18px] font-bold tracking-tight ${slot.isExternal ? "text-gray-900" : slot.isActive ? "text-gray-900" : "text-gray-400 line-through"}`}>
                                        {slot.displayLocationName}
                                      </h3>
                                      <p
                                        className={`text-[15px] font-medium mt-0.5 ${slot.isExternal ? "text-gray-500" : slot.isActive ? "text-gray-500" : "text-gray-400"}`}>
                                        {slot.start} - {slot.end}
                                      </p>
                                    </div>
                                  </div>

                                  <hr
                                    className={`border-t mb-4 ${slot.isExternal ? "border-gray-200" : "border-gray-100"}`}
                                  />

                                  <div className='flex items-center justify-between'>
                                    <div className='flex gap-12'>
                                      <div>
                                        <p
                                          className={`text-[11px] font-bold mb-1.5 uppercase ${slot.isExternal ? "text-gray-400" : "text-gray-400"}`}>
                                          Status
                                        </p>
                                        <div className='flex items-center gap-1.5'>
                                          {slot.isExternal ? (
                                            <>
                                              <div className='w-1.5 h-1.5 rounded-full bg-gray-400'></div>
                                              <span className='text-[13px] font-bold text-gray-500'>
                                                External Shift
                                              </span>
                                            </>
                                          ) : (
                                            <>
                                              <div
                                                className={`w-1.5 h-1.5 rounded-full ${slot.isActive ? "bg-[#10b981]" : "bg-red-500"}`}></div>
                                              <span
                                                className={`text-[13px] font-bold ${slot.isActive ? "text-[#10b981]" : "text-red-500"}`}>
                                                {slot.isActive
                                                  ? "Active Shift"
                                                  : "Inactive"}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className='flex items-center gap-3'>
                                      {!slot.isExternal && (
                                        <>
                                          {slot.isActive ? (
                                            <button
                                              onClick={() =>
                                                setActionSetup({
                                                  type: "pause",
                                                  shiftId: slot._id,
                                                  day,
                                                })
                                              }
                                              className='text-[13px] font-bold text-gray-700 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors'>
                                              Turn Off
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() =>
                                                executeTurnOn(slot._id, day)
                                              }
                                              className='text-[13px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 px-4 py-2 rounded-lg transition-colors'>
                                              Turn On
                                            </button>
                                          )}

                                          <button
                                            onClick={() =>
                                              handleSignOff(slot._id, day)
                                            }
                                            className='p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg ml-1 transition-colors'>
                                            <Trash2 className='w-[18px] h-[18px]' />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}

                          {/* Dedicated Aggregated Section for Reassignments & Exceptions */}
                          {(aggregatedExceptions.length > 0 ||
                            aggregatedIncomingTemp.length > 0) && (
                            <div className='mt-8'>
                              <hr className='border-gray-200 mb-6 border-dashed' />
                              <h4 className='text-[15px] font-bold text-gray-900 mb-4'>
                                Exceptions & Temporary Reassignments
                              </h4>
                              <div className='space-y-4'>
                                {/* OUTBOUND EXCEPTIONS (Pause & Reassign) */}
                                {aggregatedExceptions.map((item, idx) => {
                                  const { log, shifts } = item;
                                  const sDate = parseISO(log.startDate);
                                  const eDate = parseISO(log.endDate);
                                  const isSameD = isSameDay(sDate, eDate);

                                  const startDateStr = format(
                                    sDate,
                                    "dd/MM/yyyy",
                                  );
                                  const endDateStr = format(
                                    eDate,
                                    "dd/MM/yyyy",
                                  );
                                  const dateRangeStr = isSameD
                                    ? startDateStr
                                    : `${startDateStr} - ${endDateStr}`;

                                  const sDay = format(
                                    sDate,
                                    "EEE",
                                  ).toUpperCase();
                                  const eDay = format(
                                    eDate,
                                    "EEE",
                                  ).toUpperCase();
                                  const dayRangeStr = isSameD
                                    ? sDay
                                    : `${sDay} - ${eDay}`;

                                  const isPause = log.type === "pause";
                                  const targetStudioName = isPause
                                    ? "Shift Paused"
                                    : studios.find(
                                        (s) =>
                                          String(s._id) ===
                                          String(log.targetStudioId),
                                      )?.studioName || "Another Studio";

                                  return (
                                    <div
                                      key={`exc-${idx}`}
                                      className='bg-white border border-gray-200 rounded-2xl p-6 transition-all shadow-sm hover:border-gray-300'>
                                      <div className='flex gap-4 mb-5'>
                                        <div className='flex flex-col justify-center min-h-[56px] border border-gray-200 bg-white rounded-xl shrink-0 px-4 py-2 text-left'>
                                          <span className='text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5 text-gray-400 whitespace-nowrap'>
                                            {dayRangeStr}
                                          </span>
                                          <span
                                            className={`font-bold leading-none text-gray-900 whitespace-nowrap ${isSameD ? "text-[18px]" : "text-[13px]"}`}>
                                            {dateRangeStr}
                                          </span>
                                        </div>
                                        <div className='flex flex-col justify-center'>
                                          <h3 className='text-[18px] font-bold tracking-tight text-gray-900'>
                                            {targetStudioName}
                                          </h3>
                                          <p className='text-[15px] font-medium mt-0.5 text-gray-500'>
                                            Original Shifts: {shifts.length}{" "}
                                            shift(s) affected
                                          </p>
                                        </div>
                                      </div>

                                      <hr className='border-t border-gray-100 mb-4' />

                                      <div className='flex items-center justify-between'>
                                        <div>
                                          <p className='text-[11px] font-bold mb-1.5 uppercase text-gray-400'>
                                            Status
                                          </p>
                                          <div className='flex items-center gap-1.5'>
                                            <div
                                              className={`w-1.5 h-1.5 rounded-full ${isPause ? "bg-red-500" : "bg-[#10b981]"}`}></div>
                                            <span
                                              className={`text-[13px] font-bold ${isPause ? "text-red-500" : "text-[#10b981]"}`}>
                                              {isPause
                                                ? "Temporarily Paused"
                                                : "Temporary Reassignment"}
                                            </span>
                                          </div>
                                        </div>

                                        <div className='flex items-center gap-3'>
                                          <button
                                            onClick={() =>
                                              handleBulkUndoGlobal(
                                                log.startDate,
                                                myStudioId, // <--- Corrected to explicitly use myStudioId as source
                                              )
                                            }
                                            className={`text-[13px] font-bold px-4 py-2 rounded-lg transition-colors ${
                                              isPause
                                                ? "text-red-700 border border-red-200 hover:bg-red-50"
                                                : "text-[#045D43] border border-[#045D43] hover:bg-emerald-50"
                                            }`}>
                                            {isPause
                                              ? "Undo Pause"
                                              : "Cancel Reassignment"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}

                                {/* INBOUND (Temporary Incoming) */}
                                {aggregatedIncomingTemp.map((item, idx) => {
                                  const { log, originalStudioName } = item;
                                  const sDate = parseISO(log.startDate);
                                  const eDate = parseISO(log.endDate);
                                  const isSameD = isSameDay(sDate, eDate);

                                  const startDateStr = format(
                                    sDate,
                                    "dd/MM/yyyy",
                                  );
                                  const endDateStr = format(
                                    eDate,
                                    "dd/MM/yyyy",
                                  );
                                  const dateRangeStr = isSameD
                                    ? startDateStr
                                    : `${startDateStr} - ${endDateStr}`;

                                  const sDay = format(
                                    sDate,
                                    "EEE",
                                  ).toUpperCase();
                                  const eDay = format(
                                    eDate,
                                    "EEE",
                                  ).toUpperCase();
                                  const dayRangeStr = isSameD
                                    ? sDay
                                    : `${sDay} - ${eDay}`;

                                  return (
                                    <div
                                      key={`in-${idx}`}
                                      className='bg-white border border-gray-200 rounded-2xl p-6 transition-all shadow-sm hover:border-gray-300'>
                                      <div className='flex gap-4 mb-5'>
                                        <div className='flex flex-col justify-center min-h-[56px] border border-gray-200 bg-white rounded-xl shrink-0 px-4 py-2 text-left'>
                                          <span className='text-[10px] font-bold uppercase tracking-widest leading-none mb-1.5 text-gray-400 whitespace-nowrap'>
                                            {dayRangeStr}
                                          </span>
                                          <span
                                            className={`font-bold leading-none text-gray-900 whitespace-nowrap ${isSameD ? "text-[18px]" : "text-[13px]"}`}>
                                            {dateRangeStr}
                                          </span>
                                        </div>
                                        <div className='flex flex-col justify-center'>
                                          <h3 className='text-[18px] font-bold tracking-tight text-gray-900'>
                                            {myStudioName}
                                          </h3>
                                          <p className='text-[15px] font-medium mt-0.5 text-gray-500'>
                                            From: {originalStudioName}
                                          </p>
                                        </div>
                                      </div>
                                      <hr className='border-t border-gray-100 mb-4' />
                                      <div className='flex items-center justify-between'>
                                        <div>
                                          <p className='text-[11px] font-bold mb-1.5 uppercase text-gray-400'>
                                            Status
                                          </p>
                                          <div className='flex items-center gap-1.5'>
                                            <div className='w-1.5 h-1.5 rounded-full bg-[#10b981]'></div>
                                            <span className='text-[13px] font-bold text-[#10b981]'>
                                              Temporary Reassignment
                                            </span>
                                          </div>
                                        </div>
                                        <div className='flex items-center gap-3'>
                                          {/* We trigger bulk_undo but explicitly target the original studio to unlink it */}
                                          <button
                                            onClick={() => {
                                              axiosInstance
                                                .put(
                                                  `${basePath}/${instructor._id}/shift/bulk_undo/toggle`,
                                                  {
                                                    startDate: log.startDate,
                                                    sourceStudioId:
                                                      log.originalStudioId,
                                                  },
                                                )
                                                .then(() => refreshData())
                                                .catch((e) =>
                                                  showAlert(
                                                    "Action Failed",
                                                    e.response?.data?.error ||
                                                      e.message,
                                                    "error",
                                                  ),
                                                );
                                            }}
                                            className='text-[13px] font-bold px-4 py-2 rounded-lg transition-colors text-[#045D43] border border-[#045D43] hover:bg-emerald-50'>
                                            Return to Original Studio
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()
                  ) : (
                    <div className='text-center py-10 border border-dashed border-gray-300 rounded-xl text-gray-500 text-sm font-medium'>
                      No shifts currently assigned.
                    </div>
                  )}

                  {/* Add Shift Action Area */}
                  <div className='pt-4'>
                    {!showAddShift ? (
                      <button
                        onClick={() => setShowAddShift(true)}
                        className='flex items-center gap-2 text-[14px] font-bold text-gray-700 bg-white border border-gray-200 px-5 py-2.5 rounded-xl hover:bg-gray-50 shadow-sm transition-colors'>
                        <Plus className='w-4 h-4' /> Add Schedule Block
                      </button>
                    ) : (
                      <form
                        onSubmit={handleAssignSubmit}
                        className='bg-white border border-gray-200 rounded-2xl p-6 shadow-sm mt-4'>
                        <h4 className='font-bold text-gray-900 mb-6 text-[16px]'>
                          Add New Shift
                        </h4>
                        <div className='grid grid-cols-4 gap-4 mb-6'>
                          <SleekSelect
                            value={assignForm.day}
                            options={DAYS_ORDER.map((d) => ({
                              value: d,
                              label: d.charAt(0).toUpperCase() + d.slice(1),
                            }))}
                            onChange={(val) =>
                              setAssignForm({ ...assignForm, day: val })
                            }
                          />
                          <input
                            type='time'
                            required
                            className='p-3.5 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:border-[#045D43]'
                            value={assignForm.start}
                            onChange={(e) =>
                              setAssignForm({
                                ...assignForm,
                                start: e.target.value,
                              })
                            }
                          />
                          <input
                            type='time'
                            required
                            className='p-3.5 border border-gray-200 rounded-xl text-sm outline-none bg-white focus:border-[#045D43]'
                            value={assignForm.end}
                            onChange={(e) =>
                              setAssignForm({
                                ...assignForm,
                                end: e.target.value,
                              })
                            }
                          />
                          <div className='relative w-full'>
                            <div className='flex items-center justify-between w-full p-3.5 border border-gray-200 rounded-xl bg-gray-50 shadow-sm'>
                              <span className='text-[14px] text-gray-500 font-medium truncate'>
                                {myStudioName}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className='flex gap-3 justify-end'>
                          <button
                            type='button'
                            onClick={() => setShowAddShift(false)}
                            className='px-6 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-200 rounded-xl transition-colors'>
                            Cancel
                          </button>
                          <button
                            type='submit'
                            disabled={isProcessing}
                            className='px-8 py-2.5 bg-[#045D43] text-white text-[14px] font-bold rounded-xl hover:bg-[#034d36] transition-colors shadow-md'>
                            Save Shift
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* PERSONAL INFORMATION TAB */}
            {activeTab === "Personal Information" && (
              <div className='max-w-3xl mx-auto'>
                <div className='bg-white border border-gray-200 rounded-2xl p-8 shadow-sm space-y-10'>
                  <div className='space-y-6'>
                    <div>
                      <label className='text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block'>
                        FULL NAME
                      </label>
                      <input
                        type='text'
                        className='w-full p-4 border border-gray-200 rounded-xl text-[14px] font-medium text-gray-900 bg-white outline-none focus:border-[#045D43] transition-all shadow-sm'
                        value={profileForm.fullName}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            fullName: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className='text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2 block'>
                        LEVEL
                      </label>
                      <SleekSelect
                        className='shadow-sm border-gray-200 rounded-xl p-4'
                        value={profileForm.instructorType}
                        options={INSTRUCTOR_TYPES}
                        onChange={(val) =>
                          setProfileForm({
                            ...profileForm,
                            instructorType: val,
                          })
                        }
                      />
                    </div>
                  </div>

                  <hr className='border-gray-200' />

                  <div>
                    <h3 className='text-[16px] font-bold text-gray-900 mb-5'>
                      Assigned Locations
                    </h3>
                    <div className='space-y-4'>
                      {instructor.assignedStudiosId.length > 0 ? (
                        instructor.assignedStudiosId.map((studio) => (
                          <div
                            key={studio._id}
                            className='flex items-center gap-3 text-[14px] font-medium text-gray-900 bg-white p-4 border border-gray-200 rounded-xl shadow-sm'>
                            <MapPin className='w-4 h-4 text-gray-400 shrink-0' />
                            {studio.studioName.replace("BASI Pilates ", "")}
                          </div>
                        ))
                      ) : (
                        <span className='text-[14px] text-gray-400'>
                          No studios assigned
                        </span>
                      )}
                    </div>
                  </div>

                  <hr className='border-gray-200' />

                  <div>
                    <h3 className='text-[16px] font-bold text-gray-900 mb-4'>
                      Notes
                    </h3>
                    <textarea
                      rows='5'
                      className='w-full p-4 border border-gray-200 rounded-xl text-[14px] text-gray-700 bg-white outline-none focus:border-[#045D43] resize-none transition-all shadow-sm'
                      value={profileForm.bio}
                      onChange={(e) =>
                        setProfileForm({ ...profileForm, bio: e.target.value })
                      }
                      placeholder='Write a note...'
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// INSTRUCTOR CARD COMPONENT
// ============================================================================
const InstructorCard = React.memo(({ instructor, onEdit, onDelete }) => {
  const getTypeColor = (type) => {
    if (type?.includes("Master"))
      return "bg-purple-50 text-purple-700 border-purple-100";
    if (type?.includes("Senior"))
      return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-[#dcfce7] text-[#166534] border-[#bbf7d0]";
  };

  const shiftCount = Object.values(instructor.workingHours || {})
    .flat()
    .filter((s) => s.isActive !== false).length;

  return (
    <div
      className={`bg-white rounded-2xl p-6 border transition-all relative cursor-pointer hover:shadow-lg ${instructor.isActive === false ? "opacity-70 border-red-200 bg-red-50/20" : "border-gray-200 hover:border-[#045D43]"}`}
      onClick={onEdit}>
      <div className='flex justify-between items-start mb-4'>
        <div className='flex gap-4'>
          <div className='w-14 h-14 rounded-full bg-gray-100 border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center'>
            {instructor.avatar ? (
              <img
                src={fetchImage(instructor.avatar)}
                className='w-full h-full object-cover'
                alt=''
              />
            ) : (
              <span className='text-xl font-bold text-gray-400'>
                {instructor.fullName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className='min-w-0 pt-1'>
            <h3
              className={`font-bold text-[17px] leading-tight truncate text-[#045D43] ${instructor.isActive === false ? "text-red-900 line-through" : ""}`}>
              {instructor.fullName}
            </h3>
            <span
              className={`px-3 py-1 rounded-md text-[10px] uppercase font-bold border tracking-widest inline-block mt-2 ${getTypeColor(instructor.instructorType)}`}>
              {instructor.instructorType}
            </span>
          </div>
        </div>
      </div>

      <div className='flex items-center justify-between pt-4 mt-6 border-t border-gray-100'>
        <div className='flex items-center gap-2 text-[14px] text-gray-500'>
          <CalendarDays className='w-4 h-4' />
          <span>
            Active Shifts:{" "}
            <span className='font-bold text-gray-900'>{shiftCount}</span>
          </span>
        </div>
        <span className='text-[13px] font-bold text-[#045D43] hover:underline'>
          View Details
        </span>
      </div>
    </div>
  );
});

// ============================================================================
// HELPER COMPONENTS (Alerts)
// ============================================================================
const GenericAlertModal = ({ title, message, type, onClose }) => {
  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs'>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center border border-gray-100'>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${type === "error" ? "bg-red-100 text-red-600" : "bg-[#dcfce7] text-[#166534]"}`}>
          {type === "error" ? (
            <AlertCircle className='w-6 h-6' />
          ) : (
            <CheckCircle2 className='w-6 h-6' />
          )}
        </div>
        <h3 className='text-lg font-bold text-gray-900 mb-2'>{title}</h3>
        <p className='text-gray-500 text-sm mb-6'>{message}</p>
        <button
          onClick={onClose}
          className='w-full py-2.5 bg-[#111827] text-white font-bold rounded-xl hover:bg-gray-800 transition-all'>
          Close
        </button>
      </motion.div>
    </div>
  );
};

const ConfirmationModal = ({
  title,
  message,
  confirmText,
  confirmColor,
  icon,
  iconColor,
  onClose,
  onConfirm,
}) => (
  <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]'>
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center border border-gray-100'>
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${iconColor}`}>
        {icon}
      </div>
      <h3 className='text-lg font-bold text-gray-900 mb-2'>{title}</h3>
      <p className='text-gray-500 text-sm mb-6'>{message}</p>
      <div className='flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors'>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className={`flex-1 py-2.5 text-white font-bold rounded-xl shadow-lg transition-all ${confirmColor}`}>
          {confirmText}
        </button>
      </div>
    </motion.div>
  </div>
);

export default ManageInstructors;
