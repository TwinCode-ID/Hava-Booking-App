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
  Package as PackageIcon,
  Settings,
  Check,
  ChevronDown,
  ListPlus,
  Tag,
  Snowflake,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../../context/AuthContext";

const MultiSelect = ({ label, options, value = [], onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target))
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleOption = (option) => {
    if (value.includes(option))
      onChange(value.filter((item) => item !== option));
    else onChange([...value, option]);
  };

  return (
    <div className='relative' ref={containerRef}>
      <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
        {label}
      </label>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className='w-full min-h-[42px] px-3 py-2 bg-white border border-gray-300 rounded-md text-left focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none flex justify-between items-center transition-shadow'>
        <div className='flex flex-wrap gap-1'>
          {value.length > 0 ? (
            value.map((item, idx) => (
              <span
                key={idx}
                className='bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded-sm font-medium'>
                {item}
              </span>
            ))
          ) : (
            <span className='text-gray-400 text-sm'>{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto p-1'>
          {options.map((option) => {
            const isSelected = value.includes(option);
            return (
              <div
                key={option}
                onClick={() => toggleOption(option)}
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-sm text-sm transition-colors ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-900 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}>
                <div
                  className={`w-4 h-4 rounded-sm border flex items-center justify-center ${isSelected ? "bg-emerald-600 border-emerald-600" : "border-gray-300"}`}>
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

      if (pkgResult.status === "fulfilled") setPackages(pkgResult.value.data);
      else setPackages([]);

      if (configResult.status === "fulfilled")
        setConfig(configResult.value.data);
      else setConfig({});
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
      console.error("Status toggle failed", error);
    }
  };

  const filteredPackages = packages.filter((pkg) =>
    pkg.packageName.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className={`p-6 md:p-8 ${isEmbedded ? "pt-6" : ""} bg-gray-50/50 relative min-h-screen`}>
      {!isEmbedded && (
        <div className='flex flex-col md:flex-row justify-between items-start mb-8 gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900 tracking-tight'>
              Package Management
            </h1>
            <p className='text-gray-500 text-sm mt-1'>
              Create and manage studio pricing tiers & combinations
            </p>
          </div>
        </div>
      )}

      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search packages...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-md text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm'
          />
        </div>

        <div className='flex items-center gap-3 w-full md:w-auto justify-end'>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className='bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2 hover:bg-gray-50 transition-colors font-medium text-sm shadow-sm'>
            <Settings className='w-4 h-4' /> Categories
          </button>
          <button
            onClick={() => {
              setEditingPackage(null);
              setIsFormOpen(true);
            }}
            className='bg-emerald-800 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-emerald-900 transition-colors shadow-sm whitespace-nowrap text-sm font-medium'>
            <Plus className='w-4 h-4' /> New Package
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 pb-20'>
        {filteredPackages.length > 0 ? (
          filteredPackages.map((pkg) => (
            <AdminPackageCard
              key={pkg._id}
              pkg={pkg}
              onEdit={() => {
                setEditingPackage(pkg);
                setIsFormOpen(true);
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
            className='col-span-full py-16 text-center text-gray-500 bg-white rounded-lg border border-dashed border-gray-300'>
            <PackageIcon className='w-8 h-8 mx-auto mb-3 text-gray-300' />
            <p className='text-sm'>No packages found.</p>
          </motion.div>
        )}
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
      <AnimatePresence>
        {isFormOpen && (
          <PackageFormModal
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            initialData={editingPackage}
            config={config}
            onSuccess={fetchPackages}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isConfigModalOpen && (
          <ManageTypesModal
            onClose={() => setIsConfigModalOpen(false)}
            config={config}
            studioId={user.adminStudioLocation}
            onUpdate={setConfig}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const AdminPackageCard = ({ pkg, onEdit, onDelete, isActive }) => (
  <div
    layout
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.98 }}
    className='bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:border-emerald-200 transition-colors relative group flex flex-col'>
    <div className='absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1.5'>
      <button
        onClick={onEdit}
        className='p-1.5 bg-gray-50 hover:bg-emerald-50 text-gray-500 hover:text-emerald-700 rounded-md border border-gray-200'>
        <Edit2 className='w-3.5 h-3.5' />
      </button>
      <button
        onClick={isActive}
        className='p-1.5 bg-gray-50 hover:bg-blue-50 text-gray-500 hover:text-blue-700 rounded-md border border-gray-200'>
        <Power className='w-3.5 h-3.5' />
      </button>
      <button
        onClick={onDelete}
        className='p-1.5 bg-gray-50 hover:bg-red-50 text-gray-500 hover:text-red-700 rounded-md border border-gray-200'>
        <Trash2 className='w-3.5 h-3.5' />
      </button>
    </div>

    <div className='flex flex-wrap items-center gap-2 mb-3'>
      <div
        className={`px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider ${pkg.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"}`}>
        {pkg.isActive ? "ACTIVE" : "INACTIVE"}
      </div>

      {pkg.packageCategory?.map((cat, idx) => (
        <div
          key={idx}
          className={`px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider ${cat === "Student" ? "bg-blue-100 text-blue-800" : "bg-orange-100 text-orange-800"}`}>
          {cat.toUpperCase()}
        </div>
      ))}

      {pkg.isOneTimePurchase && (
        <div className='px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider bg-amber-100 text-amber-800 flex items-center gap-1'>
          <AlertTriangle className='w-3 h-3' /> ONE-TIME
        </div>
      )}

      {pkg.isAvailableToFreeze && (
        <div className='px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider bg-cyan-100 text-cyan-800 flex items-center gap-1'>
          <Snowflake className='w-3 h-3' /> FREEZABLE
        </div>
      )}

      {pkg.isCombo && (
        <div className='px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider bg-purple-100 text-purple-800 flex items-center gap-1'>
          <ListPlus className='w-3 h-3' /> COMBO
        </div>
      )}

      {pkg.isPromo && (
        <div className='px-2 py-0.5 rounded-sm text-[10px] font-bold tracking-wider bg-pink-100 text-pink-800 flex items-center gap-1'>
          <Tag className='w-3 h-3' /> PROMO
        </div>
      )}
    </div>

    <h3 className='text-base font-bold text-gray-900'>{pkg.packageName}</h3>

    {pkg.isPromo ? (
      <div className='mt-1 mb-3'>
        <span className='text-sm text-gray-400 line-through mr-2'>
          {parseInt(pkg.packagePrice).toLocaleString("id-ID")} {pkg.currency}
        </span>
        <span className='text-xl font-bold text-emerald-800'>
          {parseInt(pkg.promoPrice).toLocaleString("id-ID")} {pkg.currency}
        </span>
      </div>
    ) : (
      <div className='text-xl font-bold text-emerald-800 mt-1 mb-3'>
        {parseInt(pkg.packagePrice).toLocaleString("id-ID")} {pkg.currency}
      </div>
    )}

    <div className='flex-1 border-t border-gray-100 pt-3'>
      <p className='text-sm text-gray-600 mb-4 line-clamp-2'>
        {pkg.packageDescription}
      </p>

      <div className='flex items-center gap-2 text-sm text-gray-600 mb-4 font-medium'>
        <Calendar className='w-4 h-4 text-gray-400' /> Valid for{" "}
        {pkg.validityDays} Days
      </div>

      {pkg.isCombo ? (
        <div className='space-y-2 bg-gray-50/50 p-3 rounded-md border border-gray-100'>
          <div className='text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2'>
            Combo Includes
          </div>
          {pkg.comboItems?.map((item, idx) => (
            <div
              key={idx}
              className='bg-white p-2.5 rounded-sm border border-gray-200 shadow-sm'>
              <div className='font-bold text-sm text-gray-800 mb-1.5'>
                {item.credits} Credits
              </div>
              <div className='flex flex-col gap-1 text-xs'>
                <div className='flex items-start gap-1.5'>
                  <PersonStandingIcon className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                  <span className='text-gray-600 leading-tight'>
                    {item.instructorType.join(", ")}
                  </span>
                </div>
                <div className='flex items-start gap-1.5'>
                  <Settings className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                  <span className='text-gray-600 leading-tight'>
                    {item.classType.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-2.5 text-sm'>
          <div className='flex items-start gap-2'>
            <Layers className='w-4 h-4 text-gray-400 mt-0.5 shrink-0' />
            <span className='font-medium text-gray-700'>
              {pkg.credits} Credits
            </span>
          </div>
          <div className='flex items-start gap-2'>
            <PersonStandingIcon className='w-4 h-4 text-gray-400 mt-0.5 shrink-0' />
            <div className='flex flex-wrap gap-1'>
              {pkg.instructorType?.map((type, i) => (
                <span
                  key={i}
                  className='px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[11px] rounded-sm border border-blue-100'>
                  {type}
                </span>
              ))}
            </div>
          </div>
          <div className='flex items-start gap-2'>
            <Settings className='w-4 h-4 text-gray-400 mt-0.5 shrink-0' />
            <div className='flex flex-wrap gap-1'>
              {pkg.classType?.map((type, i) => (
                <span
                  key={i}
                  className='px-1.5 py-0.5 bg-purple-50 text-purple-700 text-[11px] rounded-sm border border-purple-100'>
                  {type}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);

const PackageFormModal = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
  config,
}) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    packageName: initialData?.packageName || "",
    packageDescription: initialData?.packageDescription || "",
    packagePrice: initialData?.packagePrice || "",
    currency: initialData?.currency || "IDR",
    validityDays: initialData?.validityDays || "",
    isCombo: initialData?.isCombo || false,
    credits: initialData?.credits || "",

    packageCategory: Array.isArray(initialData?.packageCategory)
      ? initialData.packageCategory
      : ["Regular"],

    isOneTimePurchase: initialData?.isOneTimePurchase || false,
    isAvailableToFreeze: initialData?.isAvailableToFreeze || false,

    isPromo: initialData?.isPromo || false,
    promoPrice: initialData?.promoPrice || "",
    enableExpiryReminder: initialData?.enableExpiryReminder || false,
    reminderDaysBefore: initialData?.reminderDaysBefore || 7,
    instructorType: Array.isArray(initialData?.instructorType)
      ? initialData.instructorType
      : [],
    classType: Array.isArray(initialData?.classType)
      ? initialData.classType
      : [],
    comboItems: initialData?.comboItems?.length
      ? initialData.comboItems
      : [{ credits: "", instructorType: [], classType: [] }],
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleComboItemChange = (index, field, value) => {
    const newItems = [...formData.comboItems];
    newItems[index][field] = value;
    setFormData({ ...formData, comboItems: newItems });
  };

  const addComboItem = () =>
    setFormData({
      ...formData,
      comboItems: [
        ...formData.comboItems,
        { credits: "", instructorType: [], classType: [] },
      ],
    });
  const removeComboItem = (index) =>
    setFormData({
      ...formData,
      comboItems: formData.comboItems.filter((_, i) => i !== index),
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...formData,
        packagePrice: Number(formData.packagePrice),
        validityDays: Number(formData.validityDays),
        credits: formData.isCombo ? 0 : Number(formData.credits),
        comboItems: formData.isCombo ? formData.comboItems : [],
        promoPrice: formData.isPromo ? Number(formData.promoPrice) : undefined,
        enableExpiryReminder: formData.enableExpiryReminder,
        reminderDaysBefore: formData.enableExpiryReminder
          ? Number(formData.reminderDaysBefore)
          : 0,
      };

      if (!initialData)
        await axiosInstance.post(API_PATHS.PACKAGES.CREATE_PACKAGE, payload);
      else
        await axiosInstance.put(
          API_PATHS.PACKAGES.UPDATE_PACKAGE(initialData._id),
          payload,
        );

      if (onSuccess) await onSuccess();
      onClose();
    } catch (error) {
      alert(error.response?.data?.message || error.message);
    } finally {
      setLoading(false);
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
  const classTypeOptions = [
    ...new Set([
      "Group",
      "Mat Group",
      "Private",
      "Duet",
      ...(config?.classTypes || []),
    ]),
  ];

  return (
    <div className='fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className='bg-white rounded-lg w-full max-w-2xl shadow-2xl flex flex-col max-h-[90vh]'>
        <div className='flex justify-between items-center p-6 border-b border-gray-100'>
          <h2 className='text-xl font-bold text-gray-900'>
            {initialData ? "Edit Package" : "Create Package"}
          </h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='overflow-y-auto p-6 custom-scrollbar'>
          <form id='package-form' onSubmit={handleSubmit} className='space-y-5'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              <div className='md:col-span-2'>
                <MultiSelect
                  label='Package Category'
                  options={["Regular", "Student"]}
                  value={formData.packageCategory}
                  onChange={(val) =>
                    setFormData({ ...formData, packageCategory: val })
                  }
                  placeholder='Select Categories...'
                />
              </div>

              <div className='md:col-span-2'>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                  Package Name
                </label>
                <input
                  type='text'
                  name='packageName'
                  required
                  value={formData.packageName}
                  onChange={handleInputChange}
                  className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm'
                />
              </div>
              <div className='md:col-span-2'>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                  Description
                </label>
                <textarea
                  name='packageDescription'
                  rows='2'
                  value={formData.packageDescription}
                  onChange={handleInputChange}
                  className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                  {formData.isPromo ? "Original Price" : "Price"} (
                  {formData.currency})
                </label>
                <input
                  type='number'
                  name='packagePrice'
                  required
                  value={formData.packagePrice}
                  onChange={handleInputChange}
                  className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm'
                />
              </div>
              <div>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                  Validity (Days)
                </label>
                <input
                  type='number'
                  name='validityDays'
                  required
                  value={formData.validityDays}
                  onChange={handleInputChange}
                  className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm'
                />
              </div>
            </div>

            <hr className='border-gray-100' />

            <div className='flex items-center justify-between bg-amber-50 p-4 rounded-md border border-amber-100'>
              <div>
                <h4 className='font-bold text-amber-900 text-sm'>
                  One-Time Purchase Limit
                </h4>
                <p className='text-xs text-amber-700 mt-0.5'>
                  Restrict clients to buying this package only once per account.
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={formData.isOneTimePurchase}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isOneTimePurchase: e.target.checked,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            <div className='flex items-center justify-between bg-indigo-50 p-4 rounded-md border border-indigo-100'>
              <div>
                <h4 className='font-bold text-indigo-900 text-sm'>
                  Automated Expiry Reminder
                </h4>
                <p className='text-xs text-indigo-700 mt-0.5'>
                  Send push notifications to clients before this package
                  expires.
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={formData.enableExpiryReminder}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      enableExpiryReminder: e.target.checked,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>

            {/* EXPIRY REMINDER SETTINGS (Only visible if toggled on) */}
            {formData.enableExpiryReminder && (
              <div className='p-4 bg-white border border-indigo-100 rounded-md shadow-sm'>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3'>
                  Remind client before expiry:
                </label>

                {/* Presets */}
                <div className='flex flex-wrap gap-2 mb-4'>
                  {[
                    { label: "1 Day", value: 1 },
                    { label: "1 Week", value: 7 },
                    { label: "1 Month", value: 30 },
                  ].map((preset) => (
                    <button
                      key={preset.value}
                      type='button'
                      onClick={() =>
                        setFormData({
                          ...formData,
                          reminderDaysBefore: preset.value,
                        })
                      }
                      className={`px-4 py-2 text-xs font-bold rounded-md transition-colors border ${
                        Number(formData.reminderDaysBefore) === preset.value
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}>
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Custom Input */}
                <div className='flex items-center gap-3 pt-3 border-t border-gray-100'>
                  <span className='text-xs font-medium text-gray-500'>
                    Custom Days:
                  </span>
                  <input
                    type='number'
                    name='reminderDaysBefore'
                    min='1'
                    required={formData.enableExpiryReminder}
                    value={formData.reminderDaysBefore}
                    onChange={handleInputChange}
                    className='w-24 p-2 rounded-md border border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm font-bold bg-indigo-50/30'
                  />
                </div>
              </div>
            )}

            <div className='flex items-center justify-between bg-cyan-50 p-4 rounded-md border border-cyan-100'>
              <div>
                <h4 className='font-bold text-cyan-900 text-sm'>
                  Freezable Package
                </h4>
                <p className='text-xs text-cyan-700 mt-0.5'>
                  Allow clients to pause the validity period of this package.
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={formData.isAvailableToFreeze}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      isAvailableToFreeze: e.target.checked,
                    })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-600"></div>
              </label>
            </div>

            <div className='flex items-center justify-between bg-emerald-50 p-4 rounded-md border border-emerald-100'>
              <div>
                <h4 className='font-bold text-emerald-900 text-sm'>
                  Promo Package
                </h4>
                <p className='text-xs text-emerald-700 mt-0.5'>
                  Enable this to apply a discounted price.
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={formData.isPromo}
                  onChange={(e) =>
                    setFormData({ ...formData, isPromo: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {formData.isPromo && (
              <div>
                <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                  Promo Price ({formData.currency})
                </label>
                <input
                  type='number'
                  name='promoPrice'
                  required={formData.isPromo}
                  value={formData.promoPrice}
                  onChange={handleInputChange}
                  className='w-full p-2.5 rounded-md border border-emerald-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm bg-emerald-50/30'
                />
              </div>
            )}

            <hr className='border-gray-100' />

            <div className='flex items-center justify-between bg-gray-50 p-4 rounded-md border border-gray-200'>
              <div>
                <h4 className='font-bold text-gray-900 text-sm'>
                  Combination Package
                </h4>
                <p className='text-xs text-gray-500 mt-0.5'>
                  Enable this to mix different class and instructor types in one
                  package.
                </p>
              </div>
              <label className='relative inline-flex items-center cursor-pointer'>
                <input
                  type='checkbox'
                  className='sr-only peer'
                  checked={formData.isCombo}
                  onChange={(e) =>
                    setFormData({ ...formData, isCombo: e.target.checked })
                  }
                />
                <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            {!formData.isCombo ? (
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 border border-gray-200 rounded-md'>
                <div className='md:col-span-2'>
                  <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                    Total Credits
                  </label>
                  <input
                    type='number'
                    name='credits'
                    required={!formData.isCombo}
                    value={formData.credits}
                    onChange={handleInputChange}
                    className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none text-sm'
                  />
                </div>
                <div>
                  <MultiSelect
                    label='Class Types'
                    options={classTypeOptions}
                    value={formData.classType}
                    onChange={(val) =>
                      setFormData({ ...formData, classType: val })
                    }
                    placeholder='Select...'
                  />
                </div>
                <div>
                  <MultiSelect
                    label='Instructor Levels'
                    options={instructorOptions}
                    value={formData.instructorType}
                    onChange={(val) =>
                      setFormData({ ...formData, instructorType: val })
                    }
                    placeholder='Select...'
                  />
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                {formData.comboItems.map((item, index) => (
                  <div
                    key={index}
                    className='relative bg-white p-4 border border-gray-200 rounded-md shadow-sm'>
                    {formData.comboItems.length > 1 && (
                      <button
                        type='button'
                        onClick={() => removeComboItem(index)}
                        className='absolute top-3 right-3 text-gray-400 hover:text-red-500'>
                        <Trash2 className='w-4 h-4' />
                      </button>
                    )}
                    <h5 className='text-xs font-bold text-gray-800 uppercase tracking-wider mb-3'>
                      Pass Segment {index + 1}
                    </h5>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                      <div className='md:col-span-2'>
                        <label className='block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1'>
                          Credits for this segment
                        </label>
                        <input
                          type='number'
                          required
                          value={item.credits}
                          onChange={(e) =>
                            handleComboItemChange(
                              index,
                              "credits",
                              e.target.value,
                            )
                          }
                          className='w-full p-2.5 rounded-md border border-gray-300 focus:border-emerald-500 outline-none text-sm'
                        />
                      </div>
                      <div>
                        <MultiSelect
                          label='Class Types'
                          options={classTypeOptions}
                          value={item.classType}
                          onChange={(val) =>
                            handleComboItemChange(index, "classType", val)
                          }
                          placeholder='Select...'
                        />
                      </div>
                      <div>
                        <MultiSelect
                          label='Instructors'
                          options={instructorOptions}
                          value={item.instructorType}
                          onChange={(val) =>
                            handleComboItemChange(index, "instructorType", val)
                          }
                          placeholder='Select...'
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type='button'
                  onClick={addComboItem}
                  className='w-full py-3 border-2 border-dashed border-gray-300 text-gray-600 font-medium rounded-md hover:bg-gray-50 hover:border-gray-400 transition-colors flex items-center justify-center gap-2 text-sm'>
                  <PlusCircle className='w-4 h-4' /> Add Another Pass Segment
                </button>
              </div>
            )}
          </form>
        </div>

        <div className='p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-md text-sm transition-colors'>
            Cancel
          </button>
          <button
            type='submit'
            form='package-form'
            disabled={loading}
            className='px-6 py-2.5 bg-emerald-800 text-white font-medium rounded-md hover:bg-emerald-900 shadow-sm disabled:opacity-50 text-sm transition-colors'>
            {loading ? "Saving..." : "Save Package"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DeleteConfirmationModal = ({ onClose, onConfirm }) => (
  <div className='fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className='bg-white rounded-lg w-full max-w-sm p-6 shadow-xl text-center'>
      <div className='w-10 h-10 bg-red-50 border border-red-100 rounded-md flex items-center justify-center mx-auto mb-4 text-red-600'>
        <AlertTriangle className='w-5 h-5' />
      </div>
      <h3 className='text-lg font-bold text-gray-900 mb-1'>Delete Package?</h3>
      <p className='text-gray-500 text-sm mb-6'>
        This action cannot be undone.
      </p>
      <div className='flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-md border border-gray-200 text-sm'>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className='flex-1 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 text-sm'>
          Delete
        </button>
      </div>
    </motion.div>
  </div>
);

const ToggleConfirmationModal = ({ onClose, onConfirm, status }) => (
  <div className='fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
    <motion.div
      initial={{ scale: 0.98, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className='bg-white rounded-lg w-full max-w-sm p-6 shadow-xl text-center'>
      <div className='w-10 h-10 bg-blue-50 border border-blue-100 rounded-md flex items-center justify-center mx-auto mb-4 text-blue-600'>
        <Power className='w-5 h-5' />
      </div>
      <h3 className='text-lg font-bold text-gray-900 mb-1'>
        {status ? "Deactivate" : "Activate"} Package?
      </h3>
      <p className='text-gray-500 text-sm mb-6'>
        Are you sure you want to change this status?
      </p>
      <div className='flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2 text-gray-700 font-medium hover:bg-gray-100 border border-gray-200 rounded-md text-sm'>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className='flex-1 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 text-sm'>
          Confirm
        </button>
      </div>
    </motion.div>
  </div>
);

const ManageTypesModal = ({ onClose, config, studioId, onUpdate }) => {
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
      alert(err.response?.data?.error || "Failed");
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
    <div className='fixed inset-0 bg-gray-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className='bg-white rounded-lg w-full max-w-md p-6 shadow-xl'>
        <div className='flex justify-between items-center mb-5'>
          <h3 className='text-lg font-bold text-gray-900'>Categories</h3>
          <button onClick={onClose}>
            <X className='text-gray-400 hover:text-gray-600 w-5 h-5' />
          </button>
        </div>
        <form onSubmit={handleAdd} className='flex gap-2 mb-4'>
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder='New Class Type...'
            className='flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm outline-none focus:border-emerald-500'
          />
          <button
            disabled={loading}
            className='bg-emerald-800 text-white px-4 py-2 rounded-md hover:bg-emerald-900 text-sm font-medium'>
            Add
          </button>
        </form>
        <div className='space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1'>
          {config[activeTab]?.map((item) => (
            <div
              key={item}
              className='flex justify-between items-center px-3 py-2 bg-gray-50 rounded-md border border-gray-200'>
              <span className='font-medium text-gray-700 text-sm'>{item}</span>
              <button
                onClick={() => handleRemove(item)}
                className='text-gray-400 hover:text-red-500'>
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
