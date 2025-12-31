import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API_PATHS } from "../../../../utils/apiPath";
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
  AlertTriangle,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { useAuth } from "../../../../context/AuthContext";
import CustomSelect from "../../layout/CustomSelect";

const AdminPackages = () => {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [toggleId, setToggleId] = useState(null);
  const [packageStatus, setPackageStatus] = useState(null);

  // --- 1. DEFINE FETCH FUNCTION OUTSIDE USEEFFECT ---
  const fetchPackages = async () => {
    try {
      const response = await axiosInstance.get(
        API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(user.adminStudioLocation)
      );
      setPackages(response.data);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. CALL IT ON MOUNT ---
  useEffect(() => {
    fetchPackages();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDeleteConfirm = async () => {
    if (!deleteId) return;
    try {
      await axiosInstance.delete(API_PATHS.PACKAGES.DELETE_PACKAGE(deleteId));
      await fetchPackages(); // Refresh list
      setDeleteId(null); // Close modal
    } catch (error) {
      console.error("Delete failed", error);
    }
  };

  const handleToggleConfirm = async () => {
    if (!toggleId) return;
    try {
      await axiosInstance.put(API_PATHS.PACKAGES.SET_PACKAGE_STATUS(toggleId));
      await fetchPackages(); // Refresh list
      setToggleId(null); // Close modal
    } catch (error) {
      console.error("Delete failed", error);
    }
  };
  // Filter for Search
  const filteredPackages = packages.filter((pkg) =>
    pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen'>
      {/* Top Bar */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Package Management
          </h1>
          <p className='text-gray-500 text-sm mt-1'>
            Create and manage studio pricing tiers
          </p>
        </div>

        <button
          onClick={() => {
            setEditingPackage(null);
            setIsFormOpen(true);
          }}
          className='bg-emerald-900 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20'>
          <Plus className='w-4 h-4' /> New Package
        </button>
      </div>

      {/* Search Bar */}
      <div className='relative mb-6'>
        <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
        <input
          type='text'
          placeholder='Search packages...'
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className='w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
        />
      </div>

      {/* Packages Grid */}
      <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6'>
        {filteredPackages.map((pkg) => (
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
        ))}
      </div>

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

      {/* Create/Edit Modal Overlay */}
      <AnimatePresence>
        {isFormOpen && (
          <PackageFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            initialData={editingPackage}
            isEdit={isEditing}
            // --- 3. PASS THE REFRESH FUNCTION AS A PROP ---
            onSuccess={() => {
              fetchPackages();
              setIsEditing(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

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
      {status ? (
        <h3 className='text-lg font-bold text-gray-900 mb-2'>
          Deactivate Package?
        </h3>
      ) : (
        <h3 className='text-lg font-bold text-gray-900 mb-2'>
          Activate Package?
        </h3>
      )}
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

// --- Sub-Component: Admin Card (Unchanged) ---
const AdminPackageCard = ({ pkg, onEdit, onDelete, isActive }) => (
  <motion.div
    layout
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
        className={`px-3 py-1 rounded-full text-xs font-bold ${
          pkg.isActive
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500"
        }`}>
        {pkg.isActive ? "ACTIVE" : "INACTIVE"}
      </div>
    </div>

    <h3 className='text-lg font-bold text-gray-900'>{pkg.packageName}</h3>
    <div className='text-2xl font-bold text-emerald-900 mt-2 mb-4'>
      {parseInt(pkg.packagePrice).toLocaleString("id-ID")} {pkg.currency}
    </div>

    <div className='space-y-2 text-sm text-gray-500 border-t border-gray-100 pt-4'>
      <div className='flex items-center gap-2'>
        <NotepadText className='w-4 h-4 text-gray-400' />
        {pkg.packageDescription}
      </div>
      <div className='flex items-center gap-2'>
        <PersonStandingIcon className='w-4 h-4 text-gray-400' />
        {pkg.instructorType}
      </div>
      <div className='flex items-center gap-2'>
        <Layers className='w-4 h-4 text-gray-400' />
        {pkg.credits} Credits
      </div>
      <div className='flex items-center gap-2'>
        <Calendar className='w-4 h-4 text-gray-400' />
        {pkg.validityDays} Days Validity
      </div>
    </div>
  </motion.div>
);

// --- Sub-Component: Modal Form ---
const PackageFormModal = ({
  isOpen,
  isEdit,
  onClose,
  initialData,
  onSuccess,
}) => {
  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    success: false,
  });

  const [formData, setFormData] = useState({
    packageName: initialData?.packageName || "",
    packageDescription: initialData?.packageDescription || "",
    packagePrice: initialData?.packagePrice || "",
    currency: initialData?.currency || "IDR",
    validityDays: initialData?.validityDays || "",
    credits: initialData?.credits || "",
    instructorType: initialData?.instructorType || "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formState.errors[name] || formState.errors.submit) {
      setFormState((prev) => ({
        ...prev,
        errors: { ...prev.errors, [name]: "", submit: "" },
      }));
    }
  };

  const handleNewPackageSubmit = async (e) => {
    e.preventDefault();
    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      if (!isEdit) {
        await axiosInstance.post(API_PATHS.PACKAGES.CREATE_PACKAGE, {
          packageName: formData.packageName,
          packageDescription: formData.packageDescription,
          packagePrice: Number(formData.packagePrice),
          currency: formData.currency,
          validityDays: Number(formData.validityDays),
          credits: Number(formData.credits),
          instructorType: formData.instructorType,
        });
      } else {
        await axiosInstance.put(
          API_PATHS.PACKAGES.UPDATE_PACKAGE(initialData._id),
          {
            packageName: formData.packageName,
            packageDescription: formData.packageDescription,
            packagePrice: Number(formData.packagePrice),
            currency: formData.currency,
            validityDays: Number(formData.validityDays),
            credits: Number(formData.credits),
            instructorType: formData.instructorType,
          }
        );
      }

      setFormState((prev) => ({
        ...prev,
        loading: false,
        success: true,
      }));

      // --- 4. CALL THE REFRESH FUNCTION FROM PARENT ---
      if (onSuccess) {
        await onSuccess();
      }

      onClose();
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { ...prev.errors, submit: error.message },
      }));
    }
  };

  const instructorOptions = [
    "Principal Instructor",
    "Master Instructor",
    "Junior Instructor",
    "Apprentice Instructor",
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className='bg-white rounded-3xl h-full w-full max-w-lg p-8 shadow-2xl overflow-hidden'>
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
              value={formData.packageName}
              onChange={handleInputChange}
              className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
              placeholder='e.g. Drop In - Master'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>
              Package Description
            </label>
            <input
              type='text'
              name='packageDescription'
              value={formData.packageDescription}
              onChange={handleInputChange}
              className='w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-emerald-500 outline-none'
            />
          </div>
          <div className='grid grid-cols-1 gap-4'>
            <div>
              <CustomSelect
                label='Instructor Category'
                options={instructorOptions}
                value={formData.instructorType}
                onChange={(val) =>
                  setFormData({ ...formData, instructorType: val })
                }
                placeholder='Select Type'
              />
            </div>
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1'>
                Price (IDR){" "}
                <span className='text-xs text-red-500 font-bold'>
                  Insert only numbers, without commas or dot*
                </span>
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
            <div>
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
              className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 shadow-lg shadow-emerald-900/20'>
              Save Package
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

export default AdminPackages;
