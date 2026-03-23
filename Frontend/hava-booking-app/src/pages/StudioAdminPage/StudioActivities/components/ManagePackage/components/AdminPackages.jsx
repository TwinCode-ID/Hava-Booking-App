import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../../../../../../utils/apiPath";
import {
  Plus,
  Edit2,
  Trash2,
  NotepadText,
  PersonStandingIcon,
  Layers,
  Calendar,
  Search,
  Power,
  X,
  PlusCircle,
  AlertTriangle,
  Package,
  Settings,
  Check,
  ChevronDown,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../../context/AuthContext";
// Removed CustomSelect import as we are using a custom MultiSelect here

// --- NEW COMPONENT: MultiSelect ---
const MultiSelect = ({ label, options, value = [], onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
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

  const toggleOption = (option) => {
    if (value.includes(option)) {
      onChange(value.filter((item) => item !== option));
    } else {
      onChange([...value, option]);
    }
  };

  return (
    <div className='relative' ref={containerRef}>
      <label className='block text-sm font-medium text-gray-700 mb-1'>
        {label}
      </label>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='w-full min-h-[48px] px-3 py-2 bg-white border border-gray-200 rounded-xl text-left focus:ring-2 focus:ring-emerald-500 outline-none flex justify-between items-center'>
        <div className='flex flex-wrap gap-1'>
          {value.length > 0 ? (
            value.map((item, idx) => (
              <span
                key={idx}
                className='bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-md font-bold'>
                {item}
              </span>
            ))
          ) : (
            <span className='text-gray-400'>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar p-1'>
          {options.map((option) => {
            const isSelected = value.includes(option);
            return (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer rounded-lg text-sm transition-colors ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : "text-gray-600 hover:bg-gray-50"
                }`}>
                <div
                  className={`w-4 h-4 rounded border flex items-center justify-center ${
                    isSelected
                      ? "bg-emerald-600 border-emerald-600"
                      : "border-gray-300"
                  }`}>
                  {isSelected && <Check className='w-3 h-3 text-white' />}
                </div>
                {option}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AdminPackages = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [config, setConfig] = useState({ classTypes: [] });
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toggleId, setToggleId] = useState(null);
  const [packageStatus, setPackageStatus] = useState(null);

  const fetchPackages = async () => {
    try {
      const [pkgResult, configResult] = await Promise.allSettled([
        axiosInstance.get(
          API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(user.adminStudioLocation),
        ),
        axiosInstance.get(API_PATHS.CONFIG.GET(user.adminStudioLocation)),
      ]);

      // Check if packages succeeded
      if (pkgResult.status === "fulfilled") {
        setPackages(pkgResult.value.data);
      } else {
        setPackages([]); // Fallback for 404
      }

      // Check if config succeeded
      if (configResult.status === "fulfilled") {
        setConfig(configResult.value.data);
      } else {
        setConfig({}); // Fallback for 404
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPackages();
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(API_PATHS.PACKAGES.DELETE_PACKAGE(deleteId));
      await fetchPackages();
      setDeleteId(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleId) return;
    try {
      await axiosInstance.put(API_PATHS.PACKAGES.SET_PACKAGE_STATUS(toggleId));
      await fetchPackages();
      setToggleId(null);
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const filteredPackages = packages.filter((pkg) =>
    pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 relative min-h-screen`}>
      {/* Top Bar */}
      {!isEmbedded && (
        <div className='flex flex-col md:flex-row justify-between items-center mb-8 gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>
              Package Management
            </h1>
            <p className='text-gray-500 text-sm mt-1'>
              Create and manage studio pricing tiers
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search packages...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
          />
        </div>

        <div className='flex items-center gap-4 w-full md:w-auto justify-end'>
          <div className='text-sm text-gray-500 font-medium whitespace-nowrap hidden md:block'>
            Showing{" "}
            <span className='text-gray-900 font-bold'>
              {filteredPackages.length}
            </span>{" "}
            packages
          </div>

          <button
            onClick={() => setIsConfigModalOpen(true)}
            className='bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-gray-50 transition-colors font-bold text-sm shadow-sm'>
            <Settings className='w-4 h-4' /> Class Type Setting
          </button>

          <button
            onClick={() => {
              setEditingPackage(null);
              setIsFormOpen(true);
            }}
            className='bg-emerald-900 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20 whitespace-nowrap text-sm font-bold'>
            <Plus className='w-4 h-4' /> New Package
          </button>
        </div>
      </div>

      {/* Packages Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20'>
        {filteredPackages.length > 0 ? (
          filteredPackages.map((pkg) => (
            <AdminPackageCard
              key={pkg._id}
              pkg={pkg}
              onEdit={() => {
                setEditingPackage(pkg);
                setIsFormOpen(true);
                setIsEditing(true);
              }}
              onDelete={() => setDeleteId(pkg._id)}
              isActive={() => {
                setToggleId(pkg._id);
                setPackageStatus(pkg.isActive);
              }}
            />
          ))
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='col-span-full py-20 text-center text-gray-400 bg-white rounded-2xl border border-dashed border-gray-300'>
            <Package className='w-10 h-10 mx-auto mb-3 opacity-20' />
            <p>No packages found.</p>
          </motion.div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {deleteId && (
          <DeleteConfirmationModal
            onClose={() => setDeleteId(null)}
            onConfirm={handleDeleteConfirm}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toggleId && (
          <ToggleConfirmationModal
            onClose={() => {
              setToggleId(null);
              setPackageStatus(null);
            }}
            onConfirm={handleToggleConfirm}
            status={packageStatus}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isFormOpen && (
          <PackageFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            initialData={editingPackage}
            config={config} // Pass config to form for dynamic options
            isEdit={isEditing}
            onSuccess={() => {
              fetchPackages();
              setIsEditing(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Config Modal Reuse */}
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

// --- UPDATED Package Card to show Multiple Badges ---
const AdminPackageCard = ({ pkg, onEdit, onDelete, isActive }) => (
  <div
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative group'>
    <div className='absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2'>
      <button
        onClick={onEdit}
        className='p-2 bg-emerald-100 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 rounded-lg'>
        <Edit2 className='w-4 h-4' />
      </button>
      <button
        onClick={isActive}
        className='p-2 bg-blue-100 hover:bg-blue-50 text-blue-500 hover:text-blue-700 rounded-lg'>
        <Power className='w-4 h-4' />
      </button>
      <button
        onClick={onDelete}
        className='p-2 bg-red-50 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg'>
        <Trash2 className='w-4 h-4' />
      </button>
    </div>

    <div className='flex items-start justify-between mb-4'>
      <div
        className={`px-3 py-1 rounded-full text-xs font-bold ${pkg.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
        {pkg.isActive ? "ACTIVE" : "INACTIVE"}
      </div>
    </div>

    <h3 className='text-lg font-bold text-gray-900'>{pkg.packageName}</h3>
    <div className='text-2xl font-bold text-emerald-900 mt-2 mb-4'>
      {parseInt(pkg.packagePrice).toLocaleString("id-ID")} {pkg.currency}
    </div>

    <div className='grid grid-cols-1 gap-3 text-sm text-gray-500 border-t border-gray-100 pt-4'>
      <div className='flex items-start gap-2'>
        <NotepadText className='w-4 h-4 text-gray-400 mt-0.5 shrink-0' />{" "}
        <span className='line-clamp-2'>{pkg.packageDescription}</span>
      </div>

      {/* Updated: Display Instructor Types as Badges */}
      <div className='flex items-start gap-2'>
        <PersonStandingIcon className='w-4 h-4 text-gray-400 mt-1 shrink-0' />
        <div className='flex flex-wrap gap-1'>
          {pkg.instructorType && pkg.instructorType.length > 0 ? (
            pkg.instructorType.map((type, i) => (
              <span
                key={i}
                className='px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded border border-blue-100'>
                {type}
              </span>
            ))
          ) : (
            <span className='text-gray-400 italic'>No instructors</span>
          )}
        </div>
      </div>

      {/* Updated: Display Class Types as Badges */}
      <div className='flex items-start gap-2'>
        {/* Using Settings Icon for Class Type generally, or utilize a specific icon */}
        <Settings className='w-4 h-4 text-gray-400 mt-1 shrink-0' />
        <div className='flex flex-wrap gap-1'>
          {pkg.classType && pkg.classType.length > 0 ? (
            pkg.classType.map((type, i) => (
              <span
                key={i}
                className='px-1.5 py-0.5 bg-purple-50 text-purple-700 text-xs rounded border border-purple-100'>
                {type}
              </span>
            ))
          ) : (
            <span className='text-gray-400 italic'>No class types</span>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <Layers className='w-4 h-4 text-gray-400' /> {pkg.credits} Credits
      </div>
      <div className='flex items-center gap-2'>
        <Calendar className='w-4 h-4 text-gray-400' /> {pkg.validityDays} Days
        Validity
      </div>
    </div>
  </div>
);

// --- UPDATED Form Modal ---
const PackageFormModal = ({
  isOpen,
  isEdit,
  onClose,
  initialData,
  onSuccess,
  config,
}) => {
  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    success: false,
  });

  // Ensure initial data is an array for multi-select
  const [formData, setFormData] = useState({
    packageName: initialData?.packageName || "",
    packageDescription: initialData?.packageDescription || "",
    packagePrice: initialData?.packagePrice || "",
    currency: initialData?.currency || "IDR",
    validityDays: initialData?.validityDays || "",
    credits: initialData?.credits || "",
    // If it's legacy data (string), wrap in array. If undefined, empty array.
    instructorType: Array.isArray(initialData?.instructorType)
      ? initialData.instructorType
      : initialData?.instructorType
        ? [initialData.instructorType]
        : [],

    classType: Array.isArray(initialData?.classType)
      ? initialData.classType
      : initialData?.classType
        ? [initialData.classType]
        : [],
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleNewPackageSubmit = async (e) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      // Basic Validation
      if (formData.instructorType.length === 0) {
        throw new Error("Please select at least one instructor type");
      }
      if (formData.classType.length === 0) {
        throw new Error("Please select at least one class type");
      }

      const payload = {
        ...formData,
        packagePrice: Number(formData.packagePrice),
        validityDays: Number(formData.validityDays),
        credits: Number(formData.credits),
      };

      if (!initialData) {
        await axiosInstance.post(API_PATHS.PACKAGES.CREATE_PACKAGE, payload);
      } else {
        await axiosInstance.put(
          API_PATHS.PACKAGES.UPDATE_PACKAGE(initialData._id),
          payload,
        );
      }
      setFormState((prev) => ({ ...prev, loading: false, success: true }));
      if (onSuccess) await onSuccess();
      onClose();
    } catch (error) {
      alert(error.message);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { ...prev.errors, submit: error.message },
      }));
    }
  };

  const instructorOptions = [
    "Apprentice Instructor",
    "Junior Instructor",
    "Senior Instructor",
    "Master Instructor",
    "Principal Instructor",
    "Special Instructor",
  ];

  // Merge default options with dynamic config options if you want,
  // or just use defaults + config.classTypes
  const classTypeOptions = [
    "Group",
    "Mat Group",
    "Private",
    "Duet",
    ...(config?.classTypes || []),
  ];
  // Remove duplicates just in case
  const uniqueClassTypes = [...new Set(classTypeOptions)];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
      <motion.div className='bg-white rounded-3xl w-full max-w-lg p-8 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto custom-scrollbar'>
        <h2 className='text-2xl font-bold text-gray-900 mb-6'>
          {initialData ? "Edit Package" : "Create New Package"}
        </h2>

        <form onSubmit={handleNewPackageSubmit} className='space-y-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Package Name
            </label>
            <input
              type='text'
              name='packageName'
              required
              value={formData.packageName}
              onChange={handleInputChange}
              className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Package Description
            </label>
            <textarea
              name='packageDescription'
              value={formData.packageDescription}
              onChange={handleInputChange}
              className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
            />
          </div>

          <div className='grid grid-cols-1 gap-4'>
            {/* Use MultiSelect for Class Type */}
            <div>
              <MultiSelect
                label='Class Types'
                options={uniqueClassTypes}
                value={formData.classType}
                onChange={(val) => setFormData({ ...formData, classType: val })}
                placeholder='Select Class Types'
              />
            </div>
            {/* Use MultiSelect for Instructor Type */}
            <div>
              <MultiSelect
                label='Instructor Levels'
                options={instructorOptions}
                value={formData.instructorType}
                onChange={(val) =>
                  setFormData({ ...formData, instructorType: val })
                }
                placeholder='Select Instructor Levels'
              />
            </div>
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Price (IDR)
              </label>
              <input
                type='number'
                name='packagePrice'
                value={formData.packagePrice}
                onChange={handleInputChange}
                className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Credits
              </label>
              <input
                type='number'
                name='credits'
                value={formData.credits}
                onChange={handleInputChange}
                className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
              />
            </div>
            <div className='col-span-2'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Validity (Days)
              </label>
              <input
                type='number'
                name='validityDays'
                value={formData.validityDays}
                onChange={handleInputChange}
                className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
              />
            </div>
          </div>

          <div className='flex gap-3 mt-auto pt-6'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={formState.loading}
              className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 disabled:opacity-50'>
              {formState.loading ? "Saving..." : "Save Package"}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

// ... (Previous Modals for Delete/Toggle/ManageTypes remain unchanged)
const DeleteConfirmationModal = ({ onClose, onConfirm }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
    <motion.div
      initial={{ scale: 0.95, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.95, y: 20 }}
      className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center'>
      <div className='w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600'>
        <AlertTriangle className='w-6 h-6' />
      </div>
      <h3 className='text-lg font-bold text-gray-900 mb-2'>Delete Package?</h3>
      <p className='text-gray-500 text-sm mb-6'>
        Are you sure you want to delete this package? This action cannot be
        undone.
      </p>
      <div className='flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors'>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className='flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all'>
          Delete
        </button>
      </div>
    </motion.div>
  </motion.div>
);

const ToggleConfirmationModal = ({ onClose, onConfirm, status }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
    <motion.div
      initial={{ scale: 0.95, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.95, y: 20 }}
      className='bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center'>
      <div className='w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600'>
        <AlertTriangle className='w-6 h-6' />
      </div>
      <h3 className='text-lg font-bold text-gray-900 mb-2'>
        {status ? "Deactivate Package?" : "Activate Package?"}
      </h3>
      <p className='text-gray-500 text-sm mb-6'>
        Are you sure you want to {status ? "deactivate" : "activate"} this
        package?
      </p>
      <div className='flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors'>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className='flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-600/20 transition-all'>
          {status ? "Deactivate" : "Activate"}
        </button>
      </div>
    </motion.div>
  </motion.div>
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

export default AdminPackages;
