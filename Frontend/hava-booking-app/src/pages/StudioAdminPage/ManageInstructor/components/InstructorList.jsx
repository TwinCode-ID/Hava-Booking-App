import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  MoreHorizontal,
  User,
  MapPin,
  Clock,
  Briefcase,
  Star,
  Calendar,
  X,
  Edit2,
  Trash2,
  Power,
  Building2,
  Save,
  Eye,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useAuth } from "../../../../context/AuthContext";

const ManageInstructors = () => {
  const { user } = useAuth();
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // --- Modal States ---
  const [scheduleModalData, setScheduleModalData] = useState(null);
  const [studiosModalData, setStudiosModalData] = useState(null);
  const [editModalData, setEditModalData] = useState(null);
  const [viewDetailsData, setViewDetailsData] = useState(null);

  // --- UI States ---
  const [actionMenuOpen, setActionMenuOpen] = useState(null); // Stores ID of open menu

  // --- 1. Fetch & Filter Logic ---
  const fetchInstructors = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(API_PATHS.INSTRUCTOR.GET_ALL);

      // Filter: Only show instructors assigned to this Admin's Studio
      const myStudioId = user.adminStudioLocation;
      const filteredByStudio = response.data.filter((inst) =>
        inst.assignedStudiosId.some((studio) => studio._id === myStudioId)
      );

      setInstructors(filteredByStudio);
    } catch (err) {
      console.error("Failed to fetch instructors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.adminStudioLocation) {
      fetchInstructors();
    }
  }, [user.adminStudioLocation]);

  // --- 2. Action Handlers ---

  // Toggle Active Status
  const handleToggleStatus = async (instructor) => {
    try {
      const newStatus = !instructor.isActive;
      // Optimistic Update
      setInstructors((prev) =>
        prev.map((i) =>
          i._id === instructor._id ? { ...i, isActive: newStatus } : i
        )
      );
      setActionMenuOpen(null);

      await axiosInstance.put(API_PATHS.INSTRUCTOR.UPDATE(instructor._id), {
        isActive: newStatus,
      });
    } catch (error) {
      console.error("Update failed", error);
      fetchInstructors(); // Revert
      alert("Failed to update status");
    }
  };

  // Delete Instructor
  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this instructor? This action cannot be undone."
      )
    )
      return;
    try {
      setActionMenuOpen(null);
      setInstructors((prev) => prev.filter((i) => i._id !== id)); // Optimistic
      await axiosInstance.delete(API_PATHS.INSTRUCTOR.DELETE(id));
    } catch (error) {
      console.error("Delete failed", error);
      fetchInstructors(); // Revert
      alert("Failed to delete instructor");
    }
  };

  // Save Edit Form
  const handleSaveEdit = async (updatedData) => {
    try {
      const { _id, ...payload } = updatedData;
      // Optimistic Update
      setInstructors((prev) =>
        prev.map((i) => (i._id === _id ? { ...i, ...payload } : i))
      );
      setEditModalData(null);

      await axiosInstance.put(API_PATHS.INSTRUCTOR.UPDATE(_id), payload);
    } catch (error) {
      console.error("Edit failed", error);
      fetchInstructors();
      alert("Failed to update instructor details");
    }
  };

  // --- 3. Client-Side Search ---
  const filteredInstructors = useMemo(() => {
    return instructors.filter(
      (inst) =>
        inst.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inst.instructorType.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [instructors, searchQuery]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => setActionMenuOpen(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const getWeeklyShiftCount = (hours) => {
    if (!hours) return 0;
    return Object.values(hours).reduce(
      (acc, dayShifts) => acc + dayShifts.length,
      0
    );
  };

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white flex items-center justify-center font-sans'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans relative'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Manage Instructors
          </h1>
          <p className='text-gray-500 text-sm mt-1'>
            View and manage instructors assigned to your studio.
          </p>
        </div>
        <button className='flex items-center gap-2 bg-emerald-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20'>
          <Plus className='w-4 h-4' /> Add Instructor
        </button>
      </div>

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
        <div className='text-sm text-gray-500 font-medium'>
          Showing{" "}
          <span className='text-gray-900 font-bold'>
            {filteredInstructors.length}
          </span>{" "}
          instructors
        </div>
      </div>

      {/* Instructors Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20'>
        <AnimatePresence>
          {filteredInstructors.length > 0 ? (
            filteredInstructors.map((inst) => (
              <InstructorCard
                key={inst._id}
                instructor={inst}
                getShifts={getWeeklyShiftCount}
                onViewSchedule={() =>
                  setScheduleModalData({
                    instructor: inst,
                    adminStudioId: user.adminStudioLocation,
                  })
                }
                onViewStudios={() => setStudiosModalData(inst)}
                isMenuOpen={actionMenuOpen === inst._id}
                onToggleMenu={(e) => {
                  e.stopPropagation();
                  setActionMenuOpen(
                    actionMenuOpen === inst._id ? null : inst._id
                  );
                }}
                onEdit={() => {
                  setEditModalData(inst);
                  setActionMenuOpen(null);
                }}
                onViewDetails={() => {
                  setViewDetailsData(inst);
                  setActionMenuOpen(null);
                }}
                onDelete={() => handleDelete(inst._id)}
                onToggleStatus={() => handleToggleStatus(inst)}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='col-span-full py-20 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300'>
              <User className='w-10 h-10 mx-auto mb-3 opacity-20' />
              <p>No instructors found matching your search.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {scheduleModalData && (
          <ScheduleModal
            instructor={scheduleModalData.instructor}
            adminStudioId={scheduleModalData.adminStudioId}
            onClose={() => setScheduleModalData(null)}
          />
        )}
        {studiosModalData && (
          <StudiosListModal
            instructor={studiosModalData}
            onClose={() => setStudiosModalData(null)}
          />
        )}
        {editModalData && (
          <EditInstructorModal
            instructor={editModalData}
            onClose={() => setEditModalData(null)}
            onSave={handleSaveEdit}
          />
        )}
        {viewDetailsData && (
          <ViewInstructorModal
            instructor={viewDetailsData}
            onClose={() => setViewDetailsData(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Component: Instructor Card ---
const InstructorCard = ({
  instructor,
  getShifts,
  onViewSchedule,
  onViewStudios,
  isMenuOpen,
  onToggleMenu,
  onEdit,
  onViewDetails,
  onDelete,
  onToggleStatus,
}) => {
  const getTypeColor = (type) => {
    if (type?.includes("Master"))
      return "bg-purple-50 text-purple-700 border-purple-100";
    if (type?.includes("Senior"))
      return "bg-blue-50 text-blue-700 border-blue-100";
    return "bg-emerald-50 text-emerald-700 border-emerald-100";
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className='bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all relative'>
      {/* Action Menu */}
      {isMenuOpen && (
        <div className='absolute top-12 right-6 bg-white shadow-xl border border-gray-100 rounded-xl z-20 overflow-hidden w-44 flex flex-col animate-in fade-in zoom-in duration-200'>
          <button
            onClick={onViewDetails}
            className='flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 text-left'>
            <Eye className='w-4 h-4' /> View Details
          </button>
          <button
            onClick={onEdit}
            className='flex items-center gap-2 px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 text-left'>
            <Edit2 className='w-4 h-4' /> Edit Profile
          </button>
          <button
            onClick={onToggleStatus}
            className={`flex items-center gap-2 px-4 py-3 text-sm text-left hover:bg-gray-50 ${
              instructor.isActive ? "text-amber-600" : "text-emerald-600"
            }`}>
            <Power className='w-4 h-4' />{" "}
            {instructor.isActive ? "Deactivate" : "Activate"}
          </button>
          <div className='h-px bg-gray-100 my-1'></div>
          <button
            onClick={onDelete}
            className='flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 text-left'>
            <Trash2 className='w-4 h-4' /> Delete
          </button>
        </div>
      )}

      {/* Header */}
      <div className='flex justify-between items-start mb-4'>
        <div className='flex gap-4'>
          <div className='w-14 h-14 rounded-2xl bg-gray-100 overflow-hidden relative'>
            {instructor.avatar ? (
              <img
                src={instructor.avatar}
                alt={instructor.fullName}
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center bg-emerald-100 text-emerald-800 font-bold text-xl'>
                {instructor.fullName.charAt(0)}
              </div>
            )}
            <div
              className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                instructor.isActive ? "bg-green-500" : "bg-gray-300"
              }`}></div>
          </div>
          <div>
            <h3 className='font-bold text-gray-900 text-lg leading-tight'>
              {instructor.fullName}
            </h3>
            <p className='text-xs text-gray-500 mt-1 line-clamp-1'>
              {instructor.bio || "Master Instructor"}
            </p>
          </div>
        </div>
        <button
          onClick={onToggleMenu}
          className='p-1 text-gray-300 hover:text-emerald-700 transition-colors rounded-full hover:bg-gray-50'>
          <MoreHorizontal className='w-6 h-6' />
        </button>
      </div>

      {/* Badges */}
      <div className='flex flex-wrap gap-2 mb-6'>
        <span
          className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${getTypeColor(
            instructor.instructorType
          )}`}>
          {instructor.instructorType}
        </span>
        <span className='px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-700 border border-amber-100 flex items-center gap-1'>
          <Star className='w-3 h-3 fill-amber-700' /> Tier{" "}
          {instructor.instructorTier}
        </span>
      </div>

      {/* Stats Links */}
      <div className='space-y-3 pt-4 border-t border-gray-50'>
        <div
          className='flex items-center justify-between text-sm cursor-pointer group/studio'
          onClick={onViewStudios}>
          <div className='flex items-center gap-2 text-gray-500 group-hover/studio:text-emerald-700 transition-colors'>
            <Building2 className='w-4 h-4' />
            <span className='underline decoration-dotted decoration-gray-300 group-hover/studio:decoration-emerald-500'>
              Assigned Studios
            </span>
          </div>
          <span className='font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded-md group-hover/studio:bg-emerald-50 group-hover/studio:text-emerald-700 transition-colors'>
            {instructor.assignedStudiosId?.length || 0}
          </span>
        </div>
        <div className='flex items-center justify-between text-sm'>
          <div className='flex items-center gap-2 text-gray-500'>
            <Calendar className='w-4 h-4' />
            <span>Weekly Shifts</span>
          </div>
          <span className='font-bold text-gray-900'>
            {getShifts(instructor.workingHours)}
          </span>
        </div>
      </div>

      <div className='mt-6'>
        <button
          onClick={onViewSchedule}
          className='w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm hover:shadow'>
          View Schedule
        </button>
      </div>
    </motion.div>
  );
};

// --- Modal 1: Edit Instructor ---
const EditInstructorModal = ({ instructor, onClose, onSave }) => {
  const [formData, setFormData] = useState({ ...instructor });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
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
        <div className='p-6 border-b border-gray-100 flex justify-between items-center'>
          <h3 className='text-lg font-bold text-gray-900'>Edit Instructor</h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-xs font-bold text-gray-700 mb-1'>
              Full Name
            </label>
            <input
              type='text'
              name='fullName'
              value={formData.fullName}
              onChange={handleChange}
              className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'
            />
          </div>
          <div>
            <label className='block text-xs font-bold text-gray-700 mb-1'>
              Bio
            </label>
            <textarea
              name='bio'
              value={formData.bio}
              onChange={handleChange}
              className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'
              rows='3'
            />
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-bold text-gray-700 mb-1'>
                Type
              </label>
              <select
                name='instructorType'
                value={formData.instructorType}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'>
                <option value='Apprentice Instructor'>Apprentice</option>
                <option value='Junior Instructor'>Junior</option>
                <option value='Senior Instructor'>Senior</option>
                <option value='Master Instructor'>Master</option>
              </select>
            </div>
            <div>
              <label className='block text-xs font-bold text-gray-700 mb-1'>
                Tier
              </label>
              <input
                type='number'
                name='instructorTier'
                value={formData.instructorTier}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'
              />
            </div>
          </div>
          <div className='pt-4 flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-lg'>
              Cancel
            </button>
            <button
              type='submit'
              className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-lg shadow-lg'>
              <Save className='w-4 h-4 inline mr-2' /> Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Modal 2: View Full Details ---
const ViewInstructorModal = ({ instructor, onClose }) => {
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
        className='relative bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50'>
          <div className='flex gap-4'>
            <div className='w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold text-2xl'>
              {instructor.fullName.charAt(0)}
            </div>
            <div>
              <h3 className='text-xl font-bold text-gray-900'>
                {instructor.fullName}
              </h3>
              <p className='text-sm text-gray-500'>
                {instructor.instructorType} • Tier {instructor.instructorTier}
              </p>
              <div
                className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  instructor.isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-red-100 text-red-700"
                }`}>
                {instructor.isActive ? (
                  <CheckCircle2 className='w-3 h-3' />
                ) : (
                  <AlertCircle className='w-3 h-3' />
                )}
                {instructor.isActive ? "Active Account" : "Inactive Account"}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='p-6 space-y-6'>
          <div>
            <h4 className='text-xs font-bold text-gray-400 uppercase mb-2'>
              Biography
            </h4>
            <p className='text-sm text-gray-700 leading-relaxed bg-gray-50 p-4 rounded-xl border border-gray-100'>
              {instructor.bio || "No biography provided."}
            </p>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='p-4 rounded-xl border border-gray-100'>
              <p className='text-xs text-gray-400 mb-1'>Total Studios</p>
              <p className='text-lg font-bold text-gray-900'>
                {instructor.assignedStudiosId?.length || 0}
              </p>
            </div>
            <div className='p-4 rounded-xl border border-gray-100'>
              <p className='text-xs text-gray-400 mb-1'>Created On</p>
              <p className='text-lg font-bold text-gray-900'>
                {new Date(instructor.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
        <div className='p-4 border-t border-gray-100 text-center bg-gray-50'>
          <button
            onClick={onClose}
            className='px-6 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold rounded-lg'>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- Modal 3: Schedule Modal ---
const ScheduleModal = ({ instructor, adminStudioId, onClose }) => {
  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
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
        className='relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[85vh] flex flex-col'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>Weekly Schedule</h3>
            <p className='text-xs text-gray-500'>{instructor.fullName}</p>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='overflow-y-auto p-6 space-y-4'>
          {days.map((day) => {
            const shifts = instructor.workingHours?.[day] || [];
            if (shifts.length === 0) return null;
            return (
              <div
                key={day}
                className='flex gap-4 border-b border-gray-50 pb-4 last:border-0'>
                <div className='w-24 pt-1'>
                  <span className='text-sm font-bold text-gray-400 capitalize'>
                    {day}
                  </span>
                </div>
                <div className='flex-1 space-y-2'>
                  {shifts.map((shift) => {
                    const isMyStudio = shift.location?._id === adminStudioId;
                    return (
                      <div
                        key={shift._id}
                        className={`p-3 rounded-xl border flex justify-between items-center ${
                          isMyStudio
                            ? "bg-emerald-50 border-emerald-100"
                            : "bg-white border-gray-100"
                        }`}>
                        <div className='flex items-center gap-3'>
                          <div
                            className={`p-1.5 rounded-lg ${
                              isMyStudio
                                ? "bg-emerald-100 text-emerald-600"
                                : "bg-gray-100 text-gray-400"
                            }`}>
                            <Clock className='w-4 h-4' />
                          </div>
                          <div>
                            <p className='text-sm font-bold text-gray-900'>
                              {shift.start} - {shift.end}
                            </p>
                            <p className='text-xs text-gray-500 flex items-center gap-1'>
                              <MapPin className='w-3 h-3' />{" "}
                              {shift.location?.studioName || "Unknown"}{" "}
                              {isMyStudio && (
                                <span className='text-emerald-600 font-bold ml-1'>
                                  (Current)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Object.values(instructor.workingHours || {}).flat().length === 0 && (
            <p className='text-center text-gray-400 py-8'>
              No shifts assigned.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// --- Modal 4: Assigned Studios ---
const StudiosListModal = ({ instructor, onClose }) => {
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
        <div className='p-6 border-b border-gray-100 flex justify-between items-center'>
          <h3 className='text-lg font-bold text-gray-900'>Assigned Studios</h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='p-4 space-y-2 max-h-[60vh] overflow-y-auto'>
          {instructor.assignedStudiosId?.map((studio) => (
            <div
              key={studio._id}
              className='p-4 border border-gray-100 rounded-xl flex items-start gap-3 hover:bg-gray-50 transition-colors'>
              <div className='p-2 bg-blue-50 text-blue-600 rounded-lg mt-0.5'>
                <Building2 className='w-5 h-5' />
              </div>
              <div>
                <p className='text-sm font-bold text-gray-900'>
                  {studio.studioName}
                </p>
                <p className='text-xs text-gray-500 mt-0.5'>
                  {studio.address?.street}, {studio.address?.city}
                </p>
              </div>
            </div>
          ))}
          {(!instructor.assignedStudiosId ||
            instructor.assignedStudiosId.length === 0) && (
            <p className='text-center text-gray-400 py-4'>
              No studios assigned.
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ManageInstructors;
