import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Calendar,
  X,
  Edit2,
  Trash2,
  Power,
  Building2,
  Save,
  CheckCircle2,
  AlertTriangle,
  User,
  AlertCircle,
  Clock,
  PlusCircle,
  MapPin,
  Camera,
  Lock,
  Settings,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import CustomSelect from "../../../layout/CustomSelect";
import uploadStudio from "../../../../../utils/uploadStudio";
import { fetchImage } from "../../../../../utils/helper";

const ManageInstructors = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [config, setConfig] = useState({ instructorTypes: [] });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [instructors, setInstructors] = useState([]);
  const [studios, setStudios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Modal States ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [actionMenuOpen, setActionMenuOpen] = useState(null);

  // --- Alert State ---
  const [alertState, setAlertState] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "error",
  });

  const showAlert = (title, message, type = "error") => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, isOpen: false }));
  };

  // --- 1. Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const [instRes, studiosRes, configRes] = await Promise.all([
        axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL),
        axiosInstance.get(API_PATHS.STUDIO.GET_ALL),
        axiosInstance.get(API_PATHS.CONFIG.GET(user.adminStudioLocation)),
      ]);

      setInstructors(instRes.data);
      setConfig(configRes.data);
      setStudios(studiosRes.data);
    } catch (err) {
      console.error("Failed to fetch data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.adminStudioLocation) {
      fetchData();
    }
  }, [user.adminStudioLocation]);

  // --- 2. Actions ---
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

  const handleToggleStatus = async (instructor) => {
    try {
      setActionMenuOpen(null);
      await axiosInstance.put(
        API_PATHS.INSTRUCTOR.TOGGLE_INSTRUCTOR(instructor._id),
        { isActive: !instructor.isActive },
      );
      fetchData();
    } catch (error) {
      showAlert("Update Failed", "Could not update status.");
    }
  };

  const handleFormSubmit = async (formData) => {
    try {
      let avatarUrl = formData.avatar;

      if (formData.avatar instanceof File) {
        try {
          const imgUploadRes = await uploadStudio(
            formData.avatar,
            user.adminStudioLocation,
          );
          avatarUrl = imgUploadRes.imageUrl || "";
        } catch (uploadError) {
          showAlert("Upload Failed", "Failed to upload the profile picture.");
          return;
        }
      }

      const payload = {
        fullName: formData.fullName,
        bio: formData.bio,
        instructorType: formData.instructorType,
        assignedStudiosId: formData.assignedStudiosId,
        avatar: avatarUrl,
        workingHours: formData.workingHours,
      };

      if (editingInstructor) {
        await axiosInstance.put(
          API_PATHS.INSTRUCTOR.UPDATE_INSTRUCTOR(editingInstructor._id),
          payload,
        );
      } else {
        await axiosInstance.post(
          API_PATHS.INSTRUCTOR.CREATE_INSTRUCTOR,
          payload,
        );
      }
      setIsFormOpen(false);
      setEditingInstructor(null);
      fetchData();
    } catch (error) {
      console.error("Save failed", error);
      showAlert(
        "Save Failed",
        error.response?.data?.message || "Failed to save instructor data.",
      );
    }
  };

  // --- 3. Filter ---
  const filteredInstructors = useMemo(() => {
    return instructors.filter(
      (inst) =>
        inst.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.instructorType.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [instructors, searchQuery]);

  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${
        isEmbedded ? "pt-8" : ""
      } bg-gray-50 relative min-h-screen`}>
      {/* Header */}
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

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search by name or type...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
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
            onClick={() => setIsConfigModalOpen(true)}
            className='bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors font-bold text-sm shadow-sm'>
            <Settings className='w-4 h-4' /> Class Type Setting
          </button>

          <button
            onClick={() => {
              setEditingInstructor(null);
              setIsFormOpen(true);
            }}
            className='flex items-center gap-2 bg-emerald-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20 whitespace-nowrap'>
            <Plus className='w-4 h-4' /> Add Instructor
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20'>
        <AnimatePresence>
          {filteredInstructors.map((inst) => (
            <InstructorCard
              key={inst._id}
              instructor={inst}
              isMenuOpen={actionMenuOpen === inst._id}
              onToggleMenu={(e) => {
                e.stopPropagation();
                setActionMenuOpen(
                  actionMenuOpen === inst._id ? null : inst._id,
                );
              }}
              onEdit={() => {
                setEditingInstructor(inst);
                setIsFormOpen(true);
                setActionMenuOpen(null);
              }}
              onDelete={() => {
                setDeleteId(inst._id);
                setActionMenuOpen(null);
              }}
              onToggleStatus={() => handleToggleStatus(inst)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {isFormOpen && (
          <InstructorFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            initialData={editingInstructor}
            studios={studios}
            onSubmit={handleFormSubmit}
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

      {/* --- CUSTOM ALERT MODAL --- */}
      <AnimatePresence>
        {alertState.isOpen && (
          <GenericAlertModal
            title={alertState.title}
            message={alertState.message}
            type={alertState.type}
            onClose={closeAlert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isConfigModalOpen && (
          <ManageTypesModal
            isOpen={isConfigModalOpen}
            onClose={() => setIsConfigModalOpen(false)}
            config={config}
            studioId={user.adminStudioLocation}
            onUpdate={(newConfig) => setConfig(newConfig)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Component: Instructor Card ---
const InstructorCard = ({ instructor, onEdit, onDelete, onToggleStatus }) => {
  const getTypeColor = (type) => {
    if (type?.includes("Master"))
      return "bg-purple-50 text-purple-700 border-purple-100";
    if (type?.includes("Senior"))
      return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  const shiftCount = Object.values(instructor.workingHours || {}).flat().length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className='bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative group'>
      <div className='flex justify-between items-start mb-4'>
        <div className='flex gap-4'>
          <div className='w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden relative'>
            {instructor.avatar ? (
              <img
                src={fetchImage(instructor.avatar)}
                alt={instructor.fullName}
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-xl'>
                {instructor.fullName.charAt(0)}
              </div>
            )}
          </div>
          <div>
            <h3 className='font-bold text-gray-900 text-lg leading-tight'>
              {instructor.fullName}
            </h3>
            <p className='text-xs text-gray-500 mt-1 line-clamp-1'>
              {instructor.bio || "No bio available"}
            </p>
          </div>
        </div>
        <div className='absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2'>
          <button
            onClick={onEdit}
            className='p-2 bg-emerald-100 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 rounded-lg'>
            <Edit2 className='w-4 h-4' />
          </button>
          <button
            onClick={onToggleStatus}
            className='p-2 bg-blue-100 hover:bg-blue-50 text-blue-500 hover:text-blue-700 rounded-lg'>
            <Power className='w-4 h-4' />
          </button>
          <button
            onClick={onDelete}
            className='p-2 bg-red-50 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg'>
            <Trash2 className='w-4 h-4' />
          </button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2 mb-6'>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
            instructor.isActive
              ? "bg-emerald-50 text-emerald-700 border border-emerald-100 "
              : "bg-red-50 text-red-500 border border-red-100"
          }   flex items-center gap-1`}>
          {instructor.isActive ? "Active" : "Inactive"}
        </span>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getTypeColor(
            instructor.instructorType,
          )}`}>
          {instructor.instructorType}
        </span>
        <span className='px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-50 text-gray-600 border border-gray-100 flex items-center gap-1'>
          <Building2 className='w-3 h-3' />{" "}
          {instructor.assignedStudiosId?.length || 0} Studios
        </span>
      </div>

      <div className='flex items-center justify-between pt-4 border-t border-gray-50'>
        <div className='flex items-center gap-2 text-sm text-gray-500'>
          <Calendar className='w-4 h-4' />
          <span>
            Weekly Shifts:{" "}
            <span className='font-bold text-gray-900'>{shiftCount}</span>
          </span>
        </div>
        <button
          onClick={onEdit}
          className='text-xs font-bold text-emerald-700 hover:underline'>
          View Details
        </button>
      </div>
    </motion.div>
  );
};

// --- Sub-Component: Create/Edit Modal ---
const InstructorFormModal = ({
  onClose,
  initialData,
  studios,
  onSubmit,
  showAlert,
}) => {
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    fullName: initialData?.fullName || "",
    bio: initialData?.bio || "",
    instructorType: initialData?.instructorType || "Apprentice Instructor",
    // Default to admin studio if creating new
    assignedStudiosId:
      initialData?.assignedStudiosId?.map((s) =>
        typeof s === "object" ? s._id : s,
      ) || (user?.adminStudioLocation ? [user.adminStudioLocation] : []),
    avatar: initialData?.avatar || "",
    workingHours: initialData?.workingHours || {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
      saturday: [],
      sunday: [],
    },
  });

  const [shiftDay, setShiftDay] = useState("monday");
  const [shiftStart, setShiftStart] = useState("");
  const [shiftEnd, setShiftEnd] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(initialData?.avatar || "");
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Auto-set the shift location to the admin's studio
  const shiftLocation = user?.adminStudioLocation;

  const currentStudioName =
    studios.find((s) => s._id === user.adminStudioLocation)?.studioName ||
    "Current Studio";

  const inputClass =
    "w-full h-[46px] px-3 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-gray-400 flex items-center";
  const textareaClass =
    "w-full p-3 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all placeholder:text-gray-400";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setAvatarPreview(previewUrl);
      setFormData((prev) => ({ ...prev, avatar: file }));
    }
  };

  const toggleStudio = (studioId) => {
    setFormData((prev) => {
      const current = prev.assignedStudiosId;
      if (current.includes(studioId)) {
        return {
          ...prev,
          assignedStudiosId: current.filter((id) => id !== studioId),
        };
      } else {
        return { ...prev, assignedStudiosId: [...current, studioId] };
      }
    });
  };

  const isOverlapping = (start1, end1, start2, end2) => {
    return start1 < end2 && start2 < end1;
  };

  const addShift = () => {
    if (!shiftStart || !shiftEnd) {
      showAlert("Missing Information", "Please fill in start and end time.");
      return;
    }

    if (shiftStart >= shiftEnd) {
      showAlert("Invalid Time", "End time must be later than start time.");
      return;
    }

    const existingShifts = formData.workingHours[shiftDay] || [];
    const hasCollision = existingShifts.some((existing) =>
      isOverlapping(shiftStart, shiftEnd, existing.start, existing.end),
    );

    if (hasCollision) {
      showAlert(
        "Schedule Conflict",
        `This shift overlaps with an existing shift on ${
          shiftDay.charAt(0).toUpperCase() + shiftDay.slice(1)
        }.`,
      );
      return;
    }

    setFormData((prev) => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [shiftDay]: [
          ...(prev.workingHours[shiftDay] || []),
          { start: shiftStart, end: shiftEnd, location: shiftLocation },
        ].sort((a, b) => a.start.localeCompare(b.start)),
      },
    }));
    setShiftStart("");
    setShiftEnd("");
  };

  const removeShift = (day, index) => {
    setFormData((prev) => {
      const updatedDay = [...prev.workingHours[day]];
      updatedDay.splice(index, 1);
      return {
        ...prev,
        workingHours: { ...prev.workingHours, [day]: updatedDay },
      };
    });
  };

  const handleSaveClick = (e) => {
    e.preventDefault();
    if (!formData.fullName) {
      showAlert("Missing Name", "Please enter a full name.");
      return;
    }
    setShowSaveConfirm(true);
  };

  const handleCancelClick = () => {
    if (JSON.stringify(formData) !== JSON.stringify(initialData || {})) {
      setShowCancelConfirm(true);
    } else {
      onClose();
    }
  };

  const confirmSave = () => {
    onSubmit(formData);
    setShowSaveConfirm(false);
  };

  const confirmCancel = () => {
    onClose();
    setShowCancelConfirm(false);
  };

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const typeOptions = [
    "Apprentice Instructor",
    "Junior Instructor",
    "Senior Instructor",
    "Master Instructor",
  ];
  const getDayLabel = (d) => d.charAt(0).toUpperCase() + d.slice(1);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className='bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <h2 className='text-xl font-bold text-gray-900'>
            {initialData ? "Edit Instructor" : "Create Instructor"}
          </h2>
          <button
            onClick={handleCancelClick}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar'>
          <div className='space-y-4'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Basic Information
            </h3>
            <div className='flex items-center gap-4'>
              <div className='relative w-20 h-20 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden shrink-0 group'>
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt='Preview'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  <User className='w-8 h-8 text-gray-400' />
                )}
                <div className='absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer'>
                  <Camera className='w-6 h-6 text-white' />
                </div>
                <input
                  type='file'
                  accept='image/*'
                  onChange={handleFileChange}
                  className='absolute inset-0 opacity-0 cursor-pointer'
                />
              </div>
              <div className='flex-1'>
                <p className='text-sm font-bold text-gray-900'>Profile Photo</p>
                <p className='text-xs text-gray-500 mb-2'>
                  Click to upload. PNG, JPG or GIF (max. 2MB)
                </p>
              </div>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Full Name
                </label>
                <input
                  type='text'
                  name='fullName'
                  value={formData.fullName}
                  onChange={handleInputChange}
                  className={inputClass}
                  placeholder='e.g. John Doe'
                />
              </div>
              <div>
                <CustomSelect
                  label='Instructor Type'
                  value={formData.instructorType}
                  options={typeOptions}
                  onChange={(val) =>
                    setFormData((prev) => ({ ...prev, instructorType: val }))
                  }
                  placeholder='Select Type'
                />
              </div>
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Bio
              </label>
              <textarea
                name='bio'
                value={formData.bio}
                onChange={handleInputChange}
                rows='3'
                className={textareaClass}
                placeholder='Short biography...'
              />
            </div>
          </div>

          <div className='space-y-3'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Assigned Locations
            </h3>
            <div className='flex flex-wrap gap-2'>
              {studios.map((studio) => {
                const isSelected = formData.assignedStudiosId.includes(
                  studio._id,
                );
                // Strict check: IDs must match exactly as strings
                const isAllowed =
                  String(studio._id) === String(user.adminStudioLocation);

                return (
                  <button
                    key={studio._id}
                    type='button'
                    disabled={!isAllowed}
                    onClick={() => toggleStudio(studio._id)}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 
                      ${
                        isSelected && isAllowed
                          ? "bg-emerald-100 border-emerald-200 text-emerald-800"
                          : ""
                      } 
                      ${
                        isSelected && !isAllowed
                          ? "bg-gray-100 border-gray-200 text-gray-500 opacity-70 cursor-not-allowed"
                          : ""
                      }
                      ${
                        !isSelected && isAllowed
                          ? "bg-white border-gray-200 text-gray-500 hover:border-emerald-300 cursor-pointer"
                          : ""
                      }
                      ${
                        !isSelected && !isAllowed
                          ? "bg-gray-50 border-gray-100 text-gray-300 opacity-50 cursor-not-allowed"
                          : ""
                      }
                    `}>
                    {isSelected ? (
                      isAllowed ? (
                        <CheckCircle2 className='w-4 h-4' />
                      ) : (
                        <Lock className='w-3.5 h-3.5' />
                      )
                    ) : !isAllowed ? (
                      <Lock className='w-3.5 h-3.5' />
                    ) : (
                      <div className='w-4 h-4 rounded-full border border-gray-300' />
                    )}
                    {studio.address.city}
                  </button>
                );
              })}
            </div>
          </div>

          <div className='space-y-4 pt-2 border-t border-gray-100'>
            <h3 className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Manage Schedule
            </h3>
            {/* Shift Input Box */}
            <div className='bg-gray-50 p-4 rounded-2xl border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end'>
              <div className='md:col-span-3'>
                <CustomSelect
                  label='Day'
                  value={getDayLabel(shiftDay)}
                  options={days.map(getDayLabel)}
                  onChange={(val) => setShiftDay(val.toLowerCase())}
                />
              </div>
              <div className='md:col-span-3'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Start Time
                </label>
                <input
                  type='time'
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className='md:col-span-3'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  End Time
                </label>
                <input
                  type='time'
                  value={shiftEnd}
                  onChange={(e) => setShiftEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
              {/* Auto-Locked Location Display */}
              <div className='md:col-span-3'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Location
                </label>
                <div className='w-full h-[46px] px-3 border border-gray-200 bg-gray-100 text-gray-500 rounded-xl text-xs flex items-center font-bold cursor-not-allowed select-none'>
                  <MapPin className='w-3.5 h-3.5 mr-2 shrink-0' />
                  <span>{currentStudioName}</span>
                </div>
              </div>
              <div className='md:col-span-12 mt-2'>
                <button
                  type='button'
                  onClick={addShift}
                  className='w-full h-11 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10 flex items-center justify-center gap-2'>
                  <Plus className='w-4 h-4' /> Add Shift
                </button>
              </div>
            </div>

            {/* Shift List */}
            <div className='space-y-2 mt-4'>
              {days.map((day) => {
                const shifts = formData.workingHours[day] || [];
                if (shifts.length === 0) return null;
                return (
                  <div
                    key={day}
                    className='flex items-start gap-4 py-3 border-b border-gray-50 last:border-0'>
                    <div className='w-20 pt-1.5 text-xs font-bold text-gray-400 uppercase'>
                      {day.slice(0, 3)}
                    </div>
                    <div className='flex-1 flex flex-wrap gap-2'>
                      {shifts.map((shift, idx) => {
                        const shiftLocId =
                          typeof shift.location === "object"
                            ? shift.location._id
                            : shift.location;
                        const isMyStudio =
                          String(shiftLocId) ===
                          String(user.adminStudioLocation);

                        // Find studio name safely
                        const studioObj = studios.find(
                          (s) => String(s._id) === String(shiftLocId),
                        );
                        const studioName =
                          studioObj?.studioName ||
                          (typeof shift.location === "object"
                            ? shift.location.studioName
                            : "Unknown");

                        return (
                          <div
                            key={idx}
                            className={`group flex items-center gap-2 border pl-3 pr-2 py-1.5 rounded-lg text-xs shadow-sm transition-colors ${
                              isMyStudio
                                ? "bg-white border-gray-200 hover:border-emerald-200"
                                : "bg-gray-50 border-gray-100 text-gray-500 opacity-80"
                            }`}>
                            <Clock
                              className={`w-3 h-3 ${isMyStudio ? "text-emerald-600" : "text-gray-400"}`}
                            />
                            <span
                              className={`font-bold ${isMyStudio ? "text-gray-900" : "text-gray-500"}`}>
                              {shift.start} - {shift.end}
                            </span>
                            <span className='text-gray-300 mx-1'>|</span>
                            <span
                              className={`${isMyStudio ? "text-gray-500" : "text-gray-400"} truncate max-w-[150px]`}>
                              {studioName}
                            </span>

                            {/* Only allow deleting if it's the admin's studio */}
                            {isMyStudio ? (
                              <button
                                onClick={() => removeShift(day, idx)}
                                className='ml-1 p-1 rounded-md text-gray-300 hover:text-red-600 hover:bg-red-50 transition-colors'>
                                <X className='w-3 h-3' />
                              </button>
                            ) : (
                              <div className='ml-1 p-1'>
                                <Lock className='w-3 h-3 text-gray-300' />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className='p-4 border-t border-gray-100 flex gap-3 bg-white'>
          <button
            onClick={handleCancelClick}
            className='flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors'>
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all'>
            {initialData ? "Save Changes" : "Create Instructor"}
          </button>
        </div>
      </motion.div>

      {/* Confirmation Modals nested inside the form modal */}
      <AnimatePresence>
        {showSaveConfirm && (
          <ConfirmationModal
            title='Save Changes?'
            message='Are you sure you want to save these changes?'
            confirmText='Yes, Save'
            confirmColor='bg-emerald-600 hover:bg-emerald-700'
            icon={<Save className='w-6 h-6' />}
            iconColor='text-emerald-600 bg-emerald-100'
            onClose={() => setShowSaveConfirm(false)}
            onConfirm={confirmSave}
          />
        )}
        {showCancelConfirm && (
          <ConfirmationModal
            title='Discard Changes?'
            message='You have unsaved changes. Are you sure you want to discard them?'
            confirmText='Yes, Discard'
            confirmColor='bg-red-600 hover:bg-red-700'
            icon={<AlertTriangle className='w-6 h-6' />}
            iconColor='text-amber-600 bg-amber-100'
            onClose={() => setShowCancelConfirm(false)}
            onConfirm={confirmCancel}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Generic Alert Modal ---
const GenericAlertModal = ({ title, message, type, onClose }) => {
  return (
    <div className='fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs'>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center border border-gray-100'>
        <div
          className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${
            type === "error"
              ? "bg-red-100 text-red-600"
              : "bg-blue-100 text-blue-600"
          }`}>
          {type === "error" ? (
            <AlertCircle className='w-6 h-6' />
          ) : (
            <AlertTriangle className='w-6 h-6' />
          )}
        </div>
        <h3 className='text-lg font-bold text-gray-900 mb-2'>{title}</h3>
        <p className='text-gray-500 text-sm mb-6'>{message}</p>
        <button
          onClick={onClose}
          className='w-full py-2.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-all'>
          Close
        </button>
      </motion.div>
    </div>
  );
};

// --- Generic Confirmation Modal ---
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
  <div className='fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/20 backdrop-blur-[2px]'>
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

const ManageTypesModal = ({ isOpen, onClose, config, studioId, onUpdate }) => {
  const [activeTab] = useState("classTypes");
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    setLoading(true);
    try {
      const res = await axiosInstance.post(API_PATHS.CONFIG.ADD(studioId), {
        category: activeTab,
        type: newItem,
      });
      onUpdate(res.data);
      setNewItem("");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (type) => {
    if (!window.confirm(`Delete "${type}"?`)) return;
    try {
      const res = await axiosInstance.post(API_PATHS.CONFIG.REMOVE(studioId), {
        category: activeTab,
        type: type,
      });
      onUpdate(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className='fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className='bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl overflow-hidden'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-xl font-bold'>Manage Class Types</h3>
          <button onClick={onClose}>
            <X className='text-gray-400 hover:text-gray-600' />
          </button>
        </div>

        <form onSubmit={handleAdd} className='flex gap-2 mb-4'>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder={`New ${activeTab === "classTypes" ? "Class" : "Level"}...`}
            className='flex-1 border border-gray-300 rounded-xl px-4 outline-none focus:border-emerald-500'
          />
          <button
            disabled={loading}
            className='bg-emerald-900 text-white p-3 rounded-xl hover:bg-emerald-800 disabled:opacity-50'>
            <PlusCircle className='w-5 h-5' />
          </button>
        </form>

        <div className='space-y-2 max-h-60 overflow-y-auto custom-scrollbar'>
          {config[activeTab]?.map((item) => (
            <div
              key={item}
              className='flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 group'>
              <span className='font-medium text-gray-700 text-sm'>{item}</span>
              <button
                onClick={() => handleRemove(item)}
                className='text-gray-300 hover:text-red-500'>
                <Trash2 className='w-4 h-4' />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ManageInstructors;
