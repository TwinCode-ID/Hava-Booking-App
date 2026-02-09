import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Edit2,
  ArrowUpDown,
  Settings,
  Check, // Added Check icon
  Calendar as CalendarIcon, // Renamed to avoid conflict
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import CustomSelect from "../Layout/CustomSelect";

const ClientManager = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "clientName",
    direction: "asc",
  });

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [viewingPass, setViewingPass] = useState(null);
  const [editingPass, setEditingPass] = useState(null);

  // Config State for dynamic dropdowns
  const [config, setConfig] = useState({ classTypes: [], instructorTypes: [] });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [res, configRes] = await Promise.all([
        axiosInstance.get(
          API_PATHS.PASSES.GET_ALL_ADMIN(user.adminStudioLocation),
        ),
        axiosInstance.get(API_PATHS.CONFIG.GET(user.adminStudioLocation)),
      ]);
      setPurchases(res.data);
      setConfig(configRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.adminStudioLocation]);

  // --- Filtering & Sorting ---
  const filteredData = useMemo(() => {
    let filtered = purchases.filter((item) => {
      const clean = (str) => (str || "").toLowerCase().replace(/[\s\-_]/g, "");
      const query = clean(searchQuery);
      const clientName = clean(item.userId?.fullName);
      const packageName = clean(item.packageId?.packageName);
      return clientName.includes(query) || packageName.includes(query);
    });

    if (filterStatus === "active")
      filtered = filtered.filter((i) => i.isActive);
    if (filterStatus === "inactive")
      filtered = filtered.filter((i) => !i.isActive);

    return filtered.sort((a, b) => {
      let aValue, bValue;
      if (sortConfig.key === "clientName") {
        aValue = (a.userId?.fullName || "").toLowerCase();
        bValue = (b.userId?.fullName || "").toLowerCase();
      } else if (sortConfig.key === "expiryDate") {
        aValue = new Date(a.expiryDate);
        bValue = new Date(b.expiryDate);
      } else if (sortConfig.key === "remainingCredits") {
        aValue = a.remainingCredits || 0;
        bValue = b.remainingCredits || 0;
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [purchases, searchQuery, filterStatus, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleAssignSubmit = async (formData) => {
    try {
      setLoading(true);
      let targetUserId = formData.userId;

      if (formData.isNewClient) {
        const userRes = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
          ...formData.newClientData,
          role: "client",
          password: "",
        });
        targetUserId = userRes.data.user?._id || userRes.data._id;
      }

      await axiosInstance.post(API_PATHS.PURCHASES.CREATE, {
        userId: targetUserId,
        packageId: formData.packageId,
        paymentMethod: "direct_payment",
        totalAmount: formData.totalAmount,
        paymentIssuer: formData.paymentIssuer,
        proofOfPayment: "Manual Assignment",
        issuingStudio: user.adminStudioLocation,
        status: "confirmed",
      });

      alert("Pass assigned successfully!");
      setShowAssignModal(false);
      fetchData();
    } catch (error) {
      console.error("Assign failed", error);
      alert(error.response?.data?.message || "Failed to assign pass");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

  const renderArrayTag = (arr) => {
    if (!arr || arr.length === 0)
      return <span className='text-gray-400 text-xs italic'>All Access</span>;
    return (
      <div className='flex flex-wrap gap-1'>
        {arr.slice(0, 2).map((item, idx) => (
          <span
            key={idx}
            className='text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap font-medium'>
            {item}
          </span>
        ))}
        {arr.length > 2 && (
          <span className='text-[10px] text-gray-400'>
            +{arr.length - 2} more
          </span>
        )}
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 relative min-h-screen`}>
      {!isEmbedded && (
        <div className='flex justify-between items-center mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>
            Client Management
          </h1>
        </div>
      )}

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4'>
        <div className='relative w-full md:w-80'>
          <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search client...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 shadow-sm'
          />
        </div>
        <div className='flex gap-3'>
          <button
            onClick={() => setShowAssignModal(true)}
            className='px-4 py-2.5 bg-emerald-900 text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 transition-all'>
            <Plus className='w-4 h-4' /> Assign Pass
          </button>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2.5 rounded-xl border transition-colors ${isFilterOpen ? "bg-gray-800 text-white border-gray-800" : "bg-white border-gray-200 hover:bg-gray-50"}`}>
            <Filter className='w-5 h-5' />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <table className='w-full text-left'>
          <thead className='bg-gray-50 border-b border-gray-100'>
            <tr>
              <th
                onClick={() => handleSort("clientName")}
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors'>
                Client
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Package
              </th>
              <th
                onClick={() => handleSort("remainingCredits")}
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors'>
                Credits
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Classes
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Instructors
              </th>
              <th
                onClick={() => handleSort("expiryDate")}
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100 transition-colors'>
                Expiry
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Status
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-gray-100'>
            {filteredData.map((item) => (
              <tr
                key={item._id}
                onClick={() => setViewingPass(item)}
                className='hover:bg-emerald-50/50 transition-colors cursor-pointer group'>
                <td className='py-4 px-6 font-bold text-gray-900'>
                  {item.userId?.fullName}
                </td>
                <td className='py-4 px-6 text-sm text-gray-600'>
                  {item.packageId?.packageName}
                </td>
                <td className='py-4 px-6 font-mono font-bold text-emerald-900'>
                  {item.remainingCredits}
                </td>
                <td className='py-4 px-6'>{renderArrayTag(item.classType)}</td>
                <td className='py-4 px-6'>
                  {renderArrayTag(item.instructorType)}
                </td>
                <td className='py-4 px-6 text-sm text-gray-500'>
                  {formatDate(item.expiryDate)}
                </td>
                <td className='py-4 px-6'>
                  {item.isActive ? (
                    <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700'>
                      <CheckCircle2 className='w-3 h-3' /> Active
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500'>
                      <XCircle className='w-3 h-3' /> Inactive
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {viewingPass && (
          <PassDetailsModal
            pass={viewingPass}
            onClose={() => setViewingPass(null)}
            onEdit={() => {
              setEditingPass(viewingPass);
              setViewingPass(null);
            }}
          />
        )}
        {editingPass && (
          <EditPassModal
            pass={editingPass}
            config={config} // Pass the config for dynamic checkboxes
            onClose={() => setEditingPass(null)}
            onSubmit={() => {
              setEditingPass(null);
              fetchData();
            }}
          />
        )}
        {showAssignModal && (
          <AssignPassModal
            onClose={() => setShowAssignModal(false)}
            onSubmit={handleAssignSubmit}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- 1. Pass Details Modal (Redesigned) ---
const PassDetailsModal = ({ pass, onClose, onEdit }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className='bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden'>
      {/* Header */}
      <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center'>
        <h3 className='text-lg font-bold text-gray-900'>Pass Details</h3>
        <button
          onClick={onClose}
          className='p-1 rounded-full hover:bg-gray-100 transition-colors'>
          <X className='w-5 h-5 text-gray-400' />
        </button>
      </div>

      <div className='p-6 space-y-6'>
        {/* Active Banner */}
        <div
          className={`p-5 rounded-2xl flex items-center justify-between ${pass.isActive ? "bg-emerald-50" : "bg-gray-50"}`}>
          <div>
            <h4
              className={`text-lg font-bold ${pass.isActive ? "text-emerald-900" : "text-gray-900"}`}>
              {pass.isActive ? "Active" : "Inactive"}
            </h4>
            <p
              className={`text-sm ${pass.isActive ? "text-emerald-700" : "text-gray-500"}`}>
              {pass.isActive
                ? `Expires: ${new Date(pass.expiryDate).toLocaleDateString("en-GB")}`
                : "This pass is no longer valid"}
            </p>
          </div>
          <div className='text-right'>
            <span
              className={`text-3xl font-bold ${pass.isActive ? "text-emerald-900" : "text-gray-900"}`}>
              {pass.remainingCredits}
            </span>
            <p className='text-[10px] font-bold uppercase tracking-wider text-gray-400'>
              CREDITS
            </p>
          </div>
        </div>

        {/* Allowed Access Section */}
        <div className='bg-blue-50/50 p-5 rounded-2xl border border-blue-100/50'>
          <div className='flex items-start gap-3'>
            <Settings className='w-5 h-5 text-blue-500 mt-0.5 shrink-0' />
            <div className='w-full'>
              <h4 className='text-sm font-bold text-blue-900 mb-3'>
                Allowed Access
              </h4>

              <div className='mb-3'>
                <p className='text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5'>
                  Classes
                </p>
                <div className='flex flex-wrap gap-2'>
                  {(!pass.classType || pass.classType.length === 0) && (
                    <span className='text-sm text-gray-400 italic'>
                      No restrictions
                    </span>
                  )}
                  {pass.classType &&
                    pass.classType.map((t) => (
                      <span
                        key={t}
                        className='px-2.5 py-1 bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shadow-sm'>
                        {t}
                      </span>
                    ))}
                </div>
              </div>

              <div>
                <p className='text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1.5'>
                  Instructors
                </p>
                <div className='flex flex-wrap gap-2'>
                  {(!pass.instructorType ||
                    pass.instructorType.length === 0) && (
                    <span className='text-sm text-gray-400 italic'>
                      No restrictions
                    </span>
                  )}
                  {pass.instructorType &&
                    pass.instructorType.map((t) => (
                      <span
                        key={t}
                        className='px-2.5 py-1 bg-white text-blue-700 text-xs font-bold rounded-lg border border-blue-100 shadow-sm'>
                        {t}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='p-5 border-t border-gray-100 flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-3 font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-all'>
          Close
        </button>
        <button
          onClick={onEdit}
          className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 transition-all flex justify-center items-center gap-2'>
          <Edit2 className='w-4 h-4' /> Edit Pass
        </button>
      </div>
    </motion.div>
  </div>
);

// --- 2. Edit Pass Modal (Redesigned with Custom Date Picker & Checkboxes) ---
const EditPassModal = ({ pass, config, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    remainingCredits: pass.remainingCredits,
    expiryDate: pass.expiryDate ? pass.expiryDate.split("T")[0] : "",
    instructorType: Array.isArray(pass.instructorType)
      ? pass.instructorType
      : [],
    classType: Array.isArray(pass.classType) ? pass.classType : [],
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fallback options if config is empty
  const availableInstructors =
    config?.instructorTypes?.length > 0
      ? config.instructorTypes
      : ["Apprentice Instructor", "Junior Instructor", "Senior Instructor"];
  const availableClasses =
    config?.classTypes?.length > 0
      ? config.classTypes
      : ["Group", "Private", "Duet"];

  const handleToggle = (field, value) => {
    setFormData((prev) => {
      const currentArray = prev[field];
      if (currentArray.includes(value)) {
        return {
          ...prev,
          [field]: currentArray.filter((item) => item !== value),
        };
      } else {
        return { ...prev, [field]: [...currentArray, value] };
      }
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await axiosInstance.put(API_PATHS.PASSES.UPDATE_PASS(pass._id), formData);
      onSubmit();
    } catch (error) {
      console.error(error);
      alert("Failed to update pass");
    } finally {
      setIsLoading(false);
    }
  };

  // Custom Checkbox Component matching Screenshot
  const SelectionItem = ({ label, isSelected, onClick }) => (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200
        ${
          isSelected
            ? "border-blue-500 bg-blue-50/50"
            : "border-gray-200 bg-white hover:border-gray-300"
        }
      `}>
      <div
        className={`
        w-5 h-5 rounded-[6px] flex items-center justify-center transition-colors border
        ${isSelected ? "bg-blue-500 border-blue-500" : "bg-white border-gray-300"}
      `}>
        {isSelected && (
          <Check size={14} className='text-white' strokeWidth={4} />
        )}
      </div>
      <span
        className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-gray-600"}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className='bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col'>
        <div className='px-6 py-5 border-b border-gray-100 bg-white'>
          <h3 className='text-xl font-bold text-gray-900'>Edit Pass</h3>
        </div>

        <form
          onSubmit={handleSave}
          className='flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar'>
          {/* Top Row: Credits & Date */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1'>
                CREDITS
              </label>
              <div className='relative'>
                <input
                  type='number'
                  value={formData.remainingCredits}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      remainingCredits: e.target.value,
                    })
                  }
                  className='w-full h-12 px-4 border-2 border-gray-200 rounded-xl font-bold text-gray-900 focus:border-gray-900 focus:outline-none transition-colors'
                />
              </div>
            </div>

            {/* Custom Styled Date Picker Trigger */}
            <div>
              <label className='block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1'>
                EXPIRY DATE
              </label>
              <div className='relative group'>
                <input
                  type='date'
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value })
                  }
                  className='w-full h-12 px-4 border-2 border-gray-200 rounded-xl font-bold text-gray-900 focus:border-gray-900 focus:outline-none transition-colors appearance-none bg-white relative z-10'
                />
                <CalendarIcon className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-0 pointer-events-none group-hover:text-gray-600 transition-colors' />
              </div>
            </div>
          </div>

          <hr className='border-gray-100' />

          {/* Classes Grid */}
          <div>
            <p className='text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide'>
              Allowed Class Types
            </p>
            <div className='grid grid-cols-2 gap-3'>
              {availableClasses.map((cls) => (
                <SelectionItem
                  key={cls}
                  label={cls}
                  isSelected={formData.classType.includes(cls)}
                  onClick={() => handleToggle("classType", cls)}
                />
              ))}
            </div>
          </div>

          {/* Instructors Grid */}
          <div>
            <p className='text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide'>
              Allowed Instructor Levels
            </p>
            <div className='grid grid-cols-2 gap-3'>
              {availableInstructors.map((inst) => (
                <SelectionItem
                  key={inst}
                  label={inst}
                  isSelected={formData.instructorType.includes(inst)}
                  onClick={() => handleToggle("instructorType", inst)}
                />
              ))}
            </div>
          </div>
        </form>

        <div className='p-5 border-t border-gray-100 bg-gray-50 flex gap-3'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 py-3.5 text-gray-600 font-bold hover:bg-gray-200 rounded-xl transition-colors text-sm'>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className='flex-1 py-3.5 bg-emerald-900 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-800 transition-colors text-sm disabled:opacity-50'>
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- 3. Assign Pass Modal ---
const AssignPassModal = ({ onClose, onSubmit }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("existing");
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [formData, setFormData] = useState({
    userId: "",
    packageId: "",
    paymentIssuer: "",
    totalAmount: "",
    isNewClient: false,
    newClientData: { fullName: "", email: "", phone: "" },
  });

  useEffect(() => {
    const init = async () => {
      try {
        const [u, p] = await Promise.all([
          axiosInstance.get(API_PATHS.AUTH.GET_ALL_USERS),
          axiosInstance.get(
            API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(user.adminStudioLocation),
          ),
        ]);
        setUsers(u.data);
        setPackages(p.data);
      } catch (err) {
        console.error("Failed to load options", err);
      } finally {
        setIsLoadingData(false);
      }
    };
    init();
  }, [user.adminStudioLocation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      isNewClient: activeTab === "new",
      userId: activeTab === "new" ? null : formData.userId,
    });
  };

  const isFormValid =
    formData.packageId &&
    formData.paymentIssuer &&
    (activeTab === "existing"
      ? formData.userId
      : formData.newClientData.fullName && formData.newClientData.email);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className='bg-white w-full max-w-xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between mb-6 border-b pb-4'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>Assign Pass</h2>
            <p className='text-sm text-gray-500'>
              Manually assign a package to a client
            </p>
          </div>
          <button onClick={onClose}>
            <X className='text-gray-400 hover:text-gray-600' />
          </button>
        </div>

        <div className='flex p-1 bg-gray-100 rounded-xl mb-6'>
          <button
            type='button'
            onClick={() => setActiveTab("existing")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "existing" ? "bg-white shadow text-emerald-900" : "text-gray-500"}`}>
            Existing Client
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("new")}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${activeTab === "new" ? "bg-white shadow text-emerald-900" : "text-gray-500"}`}>
            New Client
          </button>
        </div>

        <form onSubmit={handleSubmit} className='space-y-5'>
          <div>
            <CustomSelect
              label='Select Package'
              options={packages}
              placeholder={
                isLoadingData ? "Loading packages..." : "Choose a package"
              }
              getLabel={(p) =>
                `${p.packageName} (${p.credits} Credits) - ${parseInt(p.packagePrice).toLocaleString()} IDR`
              }
              getValue={(p) => p._id}
              value={formData.packageId}
              onChange={(val) => {
                const pkg = packages.find((p) => p._id === val);
                setFormData({
                  ...formData,
                  packageId: val,
                  totalAmount: pkg?.packagePrice || "",
                });
              }}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-sm font-bold text-gray-700 mb-1'>
                Price (IDR)
              </label>
              <input
                type='number'
                disabled
                value={formData.totalAmount}
                className='w-full p-3 bg-gray-50 text-gray-500 rounded-xl border border-gray-200'
              />
            </div>
            <div>
              <label className='block text-sm font-bold text-gray-700 mb-1'>
                Payment Method
              </label>
              <input
                type='text'
                placeholder='e.g. Cash, BCA, QRIS'
                value={formData.paymentIssuer}
                onChange={(e) =>
                  setFormData({ ...formData, paymentIssuer: e.target.value })
                }
                className='w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500'
              />
            </div>
          </div>

          <div className='pt-4 border-t border-gray-100'>
            {activeTab === "existing" ? (
              <CustomSelect
                label='Select Client'
                options={users}
                searchable
                placeholder={
                  isLoadingData ? "Loading clients..." : "Search by name..."
                }
                getLabel={(u) => `${u.fullName} (${u.email})`}
                getValue={(u) => u._id}
                value={formData.userId}
                onChange={(val) => setFormData({ ...formData, userId: val })}
              />
            ) : (
              <div className='space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-200'>
                <p className='text-xs font-bold text-emerald-700 uppercase'>
                  New Client Details
                </p>
                <input
                  name='fullName'
                  placeholder='Full Name'
                  className='w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-emerald-500'
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      newClientData: {
                        ...formData.newClientData,
                        fullName: e.target.value,
                      },
                    })
                  }
                />
                <input
                  name='email'
                  placeholder='Email Address'
                  className='w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-emerald-500'
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      newClientData: {
                        ...formData.newClientData,
                        email: e.target.value,
                      },
                    })
                  }
                />
                <input
                  name='phone'
                  placeholder='Phone Number (Optional)'
                  className='w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-emerald-500'
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      newClientData: {
                        ...formData.newClientData,
                        phone: e.target.value,
                      },
                    })
                  }
                />
              </div>
            )}
          </div>

          <button
            type='submit'
            disabled={!isFormValid}
            className='w-full py-3.5 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50 mt-4'>
            Confirm Assignment
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default ClientManager;
