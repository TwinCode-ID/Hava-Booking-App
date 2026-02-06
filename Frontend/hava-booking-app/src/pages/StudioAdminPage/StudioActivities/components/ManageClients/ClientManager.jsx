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
  Eye,
  Settings,
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

  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ADMIN(user.adminStudioLocation),
      );
      setPurchases(res.data);
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
    // ... (Use previous implementation or standard assign logic)
    // NOTE: Ensure your assign logic sends Arrays for types now
    setShowAssignModal(false);
    fetchData();
  };

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

  // Helper to display arrays nicely in table
  const renderArrayTag = (arr) => {
    if (!arr || arr.length === 0)
      return <span className='text-gray-400 text-xs'>None</span>;
    // Join with comma if multiple
    return (
      <div className='flex flex-wrap gap-1'>
        {arr.map((item, idx) => (
          <span
            key={idx}
            className='text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200 whitespace-nowrap'>
            {item}
          </span>
        ))}
      </div>
    );
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 relative`}>
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
            className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500'
          />
        </div>
        <div className='flex gap-3'>
          <button
            onClick={() => setShowAssignModal(true)}
            className='px-4 py-2.5 bg-emerald-900 text-white rounded-xl text-sm font-bold flex items-center gap-2'>
            <Plus className='w-4 h-4' /> Assign Pass
          </button>
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`p-2.5 rounded-xl border ${isFilterOpen ? "bg-gray-800 text-white" : "bg-white"}`}>
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
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer'>
                Client
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Package
              </th>
              <th
                onClick={() => handleSort("remainingCredits")}
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer'>
                Credits
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Allowed Classes
              </th>
              <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                Allowed Instructors
              </th>
              <th
                onClick={() => handleSort("expiryDate")}
                className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer'>
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
                className='hover:bg-emerald-50 transition-colors cursor-pointer'>
                <td className='py-4 px-6 font-bold text-gray-900'>
                  {item.userId?.fullName}
                </td>
                <td className='py-4 px-6 text-sm text-gray-700'>
                  {item.packageId?.packageName}
                </td>
                <td className='py-4 px-6 font-mono font-bold'>
                  {item.remainingCredits}
                </td>

                {/* Display Arrays */}
                <td className='py-4 px-6'>{renderArrayTag(item.classType)}</td>
                <td className='py-4 px-6'>
                  {renderArrayTag(item.instructorType)}
                </td>

                <td className='py-4 px-6 text-sm text-gray-500'>
                  {formatDate(item.expiryDate)}
                </td>
                <td className='py-4 px-6'>
                  {item.isActive ? (
                    <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700'>
                      <CheckCircle2 className='w-3 h-3' /> Active
                    </span>
                  ) : (
                    <span className='inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500'>
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
        {/* Pass Details Modal */}
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
        {/* Edit Pass Modal - Supports Arrays */}
        {editingPass && (
          <EditPassModal
            pass={editingPass}
            onClose={() => setEditingPass(null)}
            onSubmit={() => {
              setEditingPass(null);
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- View Details Modal ---
const PassDetailsModal = ({ pass, onClose, onEdit }) => (
  <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
    <motion.div
      initial={{ scale: 0.95 }}
      animate={{ scale: 1 }}
      className='bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden'>
      <div className='p-6 border-b flex justify-between items-center'>
        <h3 className='text-lg font-bold'>Pass Details</h3>
        <button onClick={onClose}>
          <X className='w-5 h-5 text-gray-500' />
        </button>
      </div>

      <div className='p-6 space-y-6'>
        {/* Status Banner */}
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 ${pass.isActive ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"}`}>
          <div>
            <p className='font-bold'>{pass.isActive ? "Active" : "Inactive"}</p>
            <p className='text-xs text-gray-500'>
              {pass.isActive
                ? `Expires: ${new Date(pass.expiryDate).toLocaleDateString()}`
                : "Expired/Empty"}
            </p>
          </div>
          <div className='ml-auto text-right'>
            <p className='text-2xl font-bold'>{pass.remainingCredits}</p>
            <p className='text-xs font-bold text-gray-400 uppercase'>Credits</p>
          </div>
        </div>

        {/* RESTRICTIONS DISPLAY (ARRAYS) */}
        <div className='bg-blue-50 p-4 rounded-xl border border-blue-100'>
          <div className='flex items-start gap-3'>
            <Settings className='w-5 h-5 text-blue-600 mt-0.5' />
            <div>
              <h4 className='text-sm font-bold text-blue-900'>
                Allowed Access
              </h4>

              <div className='mt-2'>
                <p className='text-xs text-blue-700 font-bold mb-1'>Classes:</p>
                <div className='flex flex-wrap gap-1'>
                  {pass.classType &&
                    pass.classType.map((t) => (
                      <span
                        key={t}
                        className='px-2 py-0.5 bg-white text-blue-800 text-xs rounded border border-blue-200'>
                        {t}
                      </span>
                    ))}
                </div>
              </div>

              <div className='mt-2'>
                <p className='text-xs text-blue-700 font-bold mb-1'>
                  Instructors:
                </p>
                <div className='flex flex-wrap gap-1'>
                  {pass.instructorType &&
                    pass.instructorType.map((t) => (
                      <span
                        key={t}
                        className='px-2 py-0.5 bg-white text-blue-800 text-xs rounded border border-blue-200'>
                        {t}
                      </span>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className='p-4 bg-gray-50 flex gap-3'>
        <button
          onClick={onClose}
          className='flex-1 py-2 font-bold text-gray-600 hover:bg-gray-200 rounded-xl'>
          Close
        </button>
        <button
          onClick={onEdit}
          className='flex-1 py-2 bg-emerald-900 text-white font-bold rounded-xl flex justify-center items-center gap-2'>
          <Edit2 className='w-4 h-4' /> Edit Pass
        </button>
      </div>
    </motion.div>
  </div>
);

// --- Edit Pass Modal (Supports Multiple Selection) ---
const EditPassModal = ({ pass, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    remainingCredits: pass.remainingCredits,
    expiryDate: pass.expiryDate ? pass.expiryDate.split("T")[0] : "",
    // Ensure these are arrays
    instructorType: Array.isArray(pass.instructorType)
      ? pass.instructorType
      : [],
    classType: Array.isArray(pass.classType) ? pass.classType : [],
  });
  const [isLoading, setIsLoading] = useState(false);

  // Available Options (You can add to this list freely now without DB errors)
  const availableInstructors = [
    "Apprentice Instructor",
    "Junior Instructor",
    "Senior Instructor",
    "Master Instructor",
    "Principal Instructor",
    "Special Instructor",
    "Visiting Expert", // Example of a new one
  ];

  const availableClasses = [
    "Group",
    "Mat Group",
    "Private",
    "Duet",
    "Workshop",
    "Special Event", // Example of new ones
  ];

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
      alert("Pass updated successfully");
      onSubmit();
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update pass");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto'>
        <div className='p-6 border-b bg-gray-50'>
          <h3 className='text-lg font-bold'>Edit Pass</h3>
        </div>

        <form onSubmit={handleSave} className='p-6 space-y-4'>
          {/* Credits & Date */}
          <div className='grid grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
                Credits
              </label>
              <input
                type='number'
                value={formData.remainingCredits}
                onChange={(e) =>
                  setFormData({ ...formData, remainingCredits: e.target.value })
                }
                className='w-full p-2 border rounded-lg'
              />
            </div>
            <div>
              <label className='block text-xs font-bold text-gray-500 uppercase mb-1'>
                Expiry Date
              </label>
              <input
                type='date'
                value={formData.expiryDate}
                onChange={(e) =>
                  setFormData({ ...formData, expiryDate: e.target.value })
                }
                className='w-full p-2 border rounded-lg'
              />
            </div>
          </div>

          {/* Multi-Select for Classes */}
          <div className='pt-2 border-t'>
            <p className='text-sm font-bold text-gray-900 mb-2'>
              Allowed Class Types
            </p>
            <div className='grid grid-cols-2 gap-2'>
              {availableClasses.map((cls) => (
                <label
                  key={cls}
                  className='flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={formData.classType.includes(cls)}
                    onChange={() => handleToggle("classType", cls)}
                    className='w-4 h-4 text-emerald-600 rounded'
                  />
                  <span className='text-xs font-medium'>{cls}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Multi-Select for Instructors */}
          <div className='pt-2 border-t'>
            <p className='text-sm font-bold text-gray-900 mb-2'>
              Allowed Instructor Levels
            </p>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-2'>
              {availableInstructors.map((inst) => (
                <label
                  key={inst}
                  className='flex items-center gap-2 p-2 border rounded-lg hover:bg-gray-50 cursor-pointer'>
                  <input
                    type='checkbox'
                    checked={formData.instructorType.includes(inst)}
                    onChange={() => handleToggle("instructorType", inst)}
                    className='w-4 h-4 text-emerald-600 rounded'
                  />
                  <span className='text-xs font-medium'>{inst}</span>
                </label>
              ))}
            </div>
          </div>

          <div className='flex gap-3 pt-6 border-t mt-4'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={isLoading}
              className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl shadow-lg'>
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ClientManager;
