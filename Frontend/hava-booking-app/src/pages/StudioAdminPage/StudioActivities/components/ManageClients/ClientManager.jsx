import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search,
  Filter,
  Download,
  User,
  CreditCard,
  CheckCircle2,
  XCircle,
  Package,
  Plus,
  X,
  Save,
  Calendar,
  Clock,
  Edit2,
  ChevronRight,
  UserPlus,
  Users,
  ArrowUpDown,
  Eye,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import CustomSelect from "../Layout/CustomSelect";

// --- Main Component ---
const ClientManager = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Sort State
  const [sortConfig, setSortConfig] = useState({
    key: "clientName",
    direction: "asc",
  });

  // Modals
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [viewingPass, setViewingPass] = useState(null);
  const [editingPass, setEditingPass] = useState(null);
  const [viewingStat, setViewingStat] = useState(null);

  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ADMIN(user.adminStudioLocation)
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
  const { filteredData, stats } = useMemo(() => {
    let filtered = purchases.filter((item) => {
      const clean = (str) => (str || "").toLowerCase().replace(/[\s\-_]/g, "");
      const query = clean(searchQuery);
      const clientName = clean(item.userId?.fullName);
      const packageName = clean(item.packageId?.packageName);
      const matchesSearch =
        clientName.includes(query) || packageName.includes(query);

      // ROBUST FILTER LOGIC
      let matchesFilter = true;
      if (filterStatus === "active") {
        matchesFilter = Boolean(item.isActive);
      } else if (filterStatus === "inactive") {
        matchesFilter = !item.isActive;
      }

      return matchesSearch && matchesFilter;
    });

    filtered = filtered.sort((a, b) => {
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

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const revenueList = purchases.filter((curr) => {
      const pDate = new Date(curr.purchaseDate);
      return (
        pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear
      );
    });
    const totalRevenue = revenueList.reduce(
      (acc, curr) => acc + parseFloat(curr.packageId?.packagePrice || 0),
      0
    );
    const clientList = Array.from(
      new Set(purchases.map((p) => p.userId?._id).filter(Boolean))
    );

    return {
      filteredData: filtered,
      stats: {
        totalClients: clientList.length,
        activePackages: purchases.filter((i) => i.isActive).length,
        revenueDisplay: new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(totalRevenue),
      },
    };
  }, [purchases, searchQuery, filterStatus, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // --- PDF Logic ---
  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setTextColor(6, 78, 59);
    doc.text("Client Pass Report", 14, 22);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);

    const tableColumn = [
      "Client Name",
      "Package",
      "Credits",
      "Expiry Date",
      "Status",
      "Price",
    ];
    const tableRows = filteredData.map((pass) => [
      pass.userId?.fullName || "Unknown",
      pass.packageId?.packageName || "Unknown",
      pass.remainingCredits,
      new Date(pass.expiryDate).toLocaleDateString("en-GB"),
      pass.isActive ? "Active" : "Inactive",
      new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(pass.packageId?.packagePrice || 0),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8 },
    });
    return doc;
  };

  const handlePreviewReport = () => {
    if (filteredData.length === 0) return alert("No data available.");
    const doc = generatePDF();
    setPdfUrl(doc.output("bloburl"));
    setShowPdfPreview(true);
  };

  // --- Assign Pass Handler ---
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
        proofOfPayment: formData.paymentIssuer,
        issuingStudio: user.adminStudioLocation,
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

  const formatDate = (d) =>
    d
      ? new Date(d)
          .toLocaleDateString("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
          .replace(/ /g, "-")
      : "-";

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 relative`}>
      {!isEmbedded && (
        <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>
              Client Management
            </h1>
            <p className='text-gray-500 text-sm mt-1'>
              Manage passes, assign packages, and track revenue.
            </p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-20'>
        <div className='flex gap-3 w-full md:w-auto order-2 md:order-1'>
          <div className='relative flex-1 md:w-80'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
            <input
              type='text'
              placeholder='Search client or package...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
            />
          </div>
        </div>

        <div className='flex items-center justify-end gap-3 w-full md:w-auto overflow-hidden order-1 md:order-2'>
          <div className='text-sm text-gray-500 font-medium whitespace-nowrap hidden md:block'>
            Showing{" "}
            <span className='text-gray-900 font-bold'>
              {filteredData.length}
            </span>{" "}
            passes
          </div>

          <button
            onClick={handlePreviewReport}
            className='flex-1 md:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm'>
            <Eye className='w-4 h-4' /> Export
          </button>

          <button
            onClick={() => setShowAssignModal(true)}
            className='flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-900 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20'>
            <Plus className='w-4 h-4' /> Assign Pass
          </button>

          {/* --- RESTORED: Filter Dropdown Menu --- */}
          <div className='flex items-center gap-2'>
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0, x: 20 }}
                  animate={{ width: "auto", opacity: 1, x: 0 }}
                  exit={{ width: 0, opacity: 0, x: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className='flex items-center gap-1 overflow-hidden mr-2'>
                  <div className='flex gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm'>
                    {[
                      { id: "all", label: "All" },
                      { id: "active", label: "Active" },
                      { id: "inactive", label: "Inactive" },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setFilterStatus(opt.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          filterStatus === opt.id
                            ? "bg-emerald-100 text-emerald-800"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        }`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              layout
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors shadow-sm border shrink-0 ${
                isFilterOpen
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-emerald-900 text-white border-emerald-900 hover:bg-emerald-800"
              }`}>
              {isFilterOpen ? (
                <X className='w-5 h-5' />
              ) : (
                <Filter className='w-5 h-5' />
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead className='bg-gray-50 border-b border-gray-100'>
              <tr>
                <th
                  onClick={() => handleSort("clientName")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100'>
                  <div className='flex items-center gap-2'>
                    Client Name{" "}
                    <ArrowUpDown className='w-4 h-4 text-gray-400' />
                  </div>
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Package
                </th>
                <th
                  onClick={() => handleSort("remainingCredits")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100'>
                  <div className='flex items-center gap-2'>
                    Credits <ArrowUpDown className='w-4 h-4 text-gray-400' />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("expiryDate")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase cursor-pointer hover:bg-gray-100'>
                  <div className='flex items-center gap-2'>
                    Expiry <ArrowUpDown className='w-4 h-4 text-gray-400' />
                  </div>
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Status
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <motion.tr
                    key={item._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setViewingPass(item)}
                    className='hover:bg-emerald-50 transition-colors cursor-pointer group'>
                    <td className='py-4 px-6'>
                      <div className='flex items-center gap-3'>
                        <div className='w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs'>
                          {item.userId?.fullName?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className='text-sm font-bold text-gray-900'>
                            {item.userId?.fullName || "Unknown"}
                          </p>
                          <p className='text-xs text-gray-400'>
                            ID: {item.userId?._id?.slice(-4)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className='py-4 px-6'>
                      <p className='text-sm font-medium text-gray-900'>
                        {item.packageId?.packageName}
                      </p>
                    </td>
                    <td className='py-4 px-6'>
                      <span className='font-mono font-bold text-gray-700'>
                        {item.remainingCredits}
                      </span>
                    </td>
                    <td className='py-4 px-6 text-sm text-gray-500'>
                      {formatDate(item.expiryDate)}
                    </td>
                    <td className='py-4 px-6'>
                      {item.isActive ? (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100'>
                          <CheckCircle2 className='w-3 h-3' /> Active
                        </span>
                      ) : (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500 border border-gray-200'>
                          <XCircle className='w-3 h-3' /> Inactive
                        </span>
                      )}
                    </td>
                  </motion.tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='6'
                    className='py-12 text-center text-gray-400 text-sm'>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PDF Preview */}
      <AnimatePresence>
        {showPdfPreview && pdfUrl && (
          <motion.div className='fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md'>
            <motion.div className='bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative'>
              <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                <h2 className='text-xl font-bold'>Report Preview</h2>
                <button
                  onClick={() => setShowPdfPreview(false)}
                  className='p-2 bg-gray-100 rounded-full'>
                  <X />
                </button>
              </div>
              <iframe src={pdfUrl} className='w-full h-full' title='Preview' />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {showAssignModal && (
          <AssignPassModal
            onClose={() => setShowAssignModal(false)}
            onSubmit={handleAssignSubmit}
          />
        )}
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
            onClose={() => setEditingPass(null)}
            onSubmit={(data) => {
              console.log(data);
              setEditingPass(null);
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const AssignPassModal = ({ onClose, onSubmit }) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("existing");
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Added paymentIssuer to state
  const [formData, setFormData] = useState({
    userId: "",
    packageId: "",
    paymentIssuer: "",
    totalAmount: "",
    isNewClient: false,
    newClientData: { fullName: "", email: "", phone: "" },
  });

  // ... (useEffect and handlers remain same) ...
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, packagesRes] = await Promise.all([
          axiosInstance.get(API_PATHS.AUTH.GET_ALL_USERS),
          axiosInstance.get(
            API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(user.adminStudioLocation)
          ),
        ]);
        setUsers(usersRes.data);
        setPackages(packagesRes.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingData(false);
      }
    };
    fetchOptions();
  }, []);

  const handleNewClientChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      newClientData: { ...prev.newClientData, [name]: value },
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const isNew = activeTab === "new";
    onSubmit({
      ...formData,
      isNewClient: isNew,
      userId: isNew ? null : formData.userId,
    });
  };

  const isFormValid =
    formData.packageId &&
    formData.totalAmount &&
    formData.paymentIssuer &&
    ((activeTab === "existing" && formData.userId) ||
      (activeTab === "new" &&
        formData.newClientData.fullName &&
        formData.newClientData.email));

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
        // CHANGED: max-w-md -> max-w-2xl for wider modal
        className='relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50'>
          <div>
            <h3 className='text-2xl font-bold text-gray-900'>
              Assign New Pass
            </h3>
            <p className='text-gray-500 text-sm mt-1'>
              Manually assign a package to a client
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-200 transition-colors'>
            <X className='w-6 h-6 text-gray-500' />
          </button>
        </div>

        <div className='p-8'>
          {/* Tab Switcher */}
          <div className='flex p-1 bg-gray-100 rounded-xl mb-8'>
            <button
              type='button'
              onClick={() => setActiveTab("existing")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
                activeTab === "existing"
                  ? "bg-white text-emerald-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              <Users className='w-4 h-4' /> Existing Client
            </button>
            <button
              type='button'
              onClick={() => setActiveTab("new")}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-bold rounded-lg transition-all ${
                activeTab === "new"
                  ? "bg-white text-emerald-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}>
              <UserPlus className='w-4 h-4' /> New Client
            </button>
          </div>

          <form onSubmit={handleSubmit} className='space-y-6'>
            {/* 2-Column Grid for inputs */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
              <div className='col-span-1 md:col-span-2'>
                <CustomSelect
                  label='Select Package'
                  placeholder='Choose package...'
                  options={packages}
                  getLabel={(p) => p.packageName}
                  getValue={(p) => p._id}
                  value={formData.packageId}
                  onChange={(val) => {
                    // 1. Find the full package object using the ID (val)
                    const selectedPackage = packages.find(
                      (pkg) => pkg._id === val
                    );

                    // 2. Update state with ID and the Price from the found object
                    setFormData({
                      ...formData,
                      packageId: val,
                      totalAmount: selectedPackage.packagePrice,
                    });
                  }}
                />
              </div>

              <div className='col-span-1 md:col-span-2'>
                <label className='block text-sm font-bold text-gray-700 mb-2'>
                  Payment Details <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  value={formData.paymentIssuer}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentIssuer: e.target.value })
                  }
                  className='w-full p-3 border rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors'
                  placeholder='e.g. Cash, BCA EDC, QRIS...'
                />
              </div>

              {activeTab === "existing" ? (
                <div className='col-span-1 md:col-span-2'>
                  <CustomSelect
                    label='Select Client'
                    placeholder={
                      loadingData ? "Loading..." : "Search client..."
                    }
                    options={users}
                    searchable={true}
                    getLabel={(u) => `${u.fullName} (${u.email})`}
                    getValue={(u) => u._id}
                    value={formData.userId}
                    onChange={(val) =>
                      setFormData({ ...formData, userId: val })
                    }
                  />
                </div>
              ) : (
                <>
                  <div className='col-span-1 md:col-span-2 bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-start gap-3'>
                    <CheckCircle2 className='w-5 h-5 text-emerald-600 mt-0.5 shrink-0' />
                    <div>
                      <p className='text-sm font-bold text-emerald-900'>
                        Auto-Account Creation
                      </p>
                      <p className='text-xs text-emerald-700 mt-1'>
                        A new account will be created immediately. The client
                        can log in using their email and OTP (no password
                        required initially).
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Full Name <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='text'
                      name='fullName'
                      value={formData.newClientData.fullName}
                      onChange={handleNewClientChange}
                      className='w-full p-3 border rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:border-emerald-500'
                      placeholder='e.g. John Doe'
                    />
                  </div>

                  <div>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Email Address <span className='text-red-500'>*</span>
                    </label>
                    <input
                      type='email'
                      name='email'
                      value={formData.newClientData.email}
                      onChange={handleNewClientChange}
                      className='w-full p-3 border rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:border-emerald-500'
                      placeholder='e.g. john@example.com'
                    />
                  </div>

                  <div className='col-span-1 md:col-span-2'>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Phone (Optional)
                    </label>
                    <input
                      type='text'
                      name='phone'
                      value={formData.newClientData.phone}
                      onChange={handleNewClientChange}
                      className='w-full p-3 border rounded-xl text-sm bg-gray-50 focus:bg-white transition-colors outline-none focus:border-emerald-500'
                      placeholder='081...'
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className='pt-6 flex gap-4 border-t border-gray-100 mt-8'>
              <button
                type='button'
                onClick={onClose}
                className='flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors border border-gray-200'>
                Cancel
              </button>
              <button
                type='submit'
                disabled={!isFormValid}
                className='flex-1 py-3 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
                {activeTab === "new" ? "Create & Assign" : "Assign Pass"}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// ... (Rest of file same as before: PassDetailsModal, EditPassModal, export)
const PassDetailsModal = ({ pass, onClose, onEdit }) => {
  const formatMoney = (val) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : "-";

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        className='relative bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>Pass Details</h3>
            <p className='text-xs text-gray-500 font-mono mt-1 uppercase tracking-wider'>
              ID: {pass.transactionId || pass._id}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-200 transition-colors'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        <div className='p-6 space-y-6'>
          {/* Status Banner */}
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              pass.isActive
                ? "bg-emerald-50 border-emerald-100"
                : "bg-gray-50 border-gray-200"
            }`}>
            <div
              className={`p-2 rounded-full ${
                pass.isActive
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-gray-200 text-gray-500"
              }`}>
              {pass.isActive ? (
                <CheckCircle2 className='w-5 h-5' />
              ) : (
                <XCircle className='w-5 h-5' />
              )}
            </div>
            <div>
              <p className='text-sm font-bold text-gray-900'>
                {pass.isActive ? "Active Pass" : "Inactive Pass"}
              </p>
              <p className='text-xs text-gray-500'>
                {pass.isActive
                  ? `Expires on ${formatDate(pass.expiryDate)}`
                  : "This pass is no longer valid"}
              </p>
            </div>
            <div className='ml-auto text-right'>
              <p className='text-2xl font-bold text-gray-900'>
                {pass.remainingCredits}
              </p>
              <p className='text-xs text-gray-500 uppercase font-bold tracking-wider'>
                Credits
              </p>
            </div>
          </div>

          {/* Info Grid */}
          <div className='grid grid-cols-2 gap-6'>
            {/* Column 1 */}
            <div className='space-y-4'>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  Client
                </label>
                <div className='flex items-center gap-2 mt-1'>
                  <div className='w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs'>
                    {pass.userId?.fullName?.charAt(0)}
                  </div>
                  <div>
                    <p className='text-sm font-bold text-gray-900'>
                      {pass.userId?.fullName}
                    </p>
                    <p className='text-xs text-gray-500'>
                      {pass.userId?.email}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  Purchase Date
                </label>
                <div className='flex items-center gap-2 mt-1'>
                  <Calendar className='w-4 h-4 text-gray-400' />
                  <p className='text-sm text-gray-700'>
                    {formatDate(pass.purchaseDate)}
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2 */}
            <div className='space-y-4'>
              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  Package
                </label>
                <p className='text-sm font-bold text-gray-900 mt-1'>
                  {pass.packageId?.packageName}
                </p>
                <p className='text-xs text-emerald-600 font-medium'>
                  {formatMoney(pass.packageId?.packagePrice)}
                </p>
              </div>

              <div>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  Expiry Date
                </label>
                <div className='flex items-center gap-2 mt-1'>
                  <Calendar className='w-4 h-4 text-gray-400' />
                  <p className='text-sm text-gray-700'>
                    {formatDate(pass.expiryDate)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='p-4 bg-gray-50 border-t border-gray-100 flex gap-3'>
          <button
            onClick={onClose}
            className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all'>
            Close
          </button>
          <button
            onClick={onEdit}
            className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-transform active:scale-95'>
            <Edit2 className='w-4 h-4' /> Edit Details
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EditPassModal = ({ pass, onClose, onSubmit }) => {
  // ... (same implementation as previous Turn 11 code) ...
  const [credits, setCredits] = useState(pass.remainingCredits);
  const [expiry, setExpiry] = useState(pass.expiryDate?.split("T")[0]);
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
      />
      <motion.div className='relative bg-white p-6 rounded-2xl max-w-md w-full'>
        <h3 className='font-bold mb-4'>Edit Pass</h3>
        <input
          type='number'
          value={credits}
          onChange={(e) => setCredits(e.target.value)}
          className='w-full border p-2 mb-2 rounded'
        />
        <input
          type='date'
          value={expiry}
          onChange={(e) => setExpiry(e.target.value)}
          className='w-full border p-2 mb-4 rounded'
        />
        <button
          onClick={() =>
            onSubmit({ ...pass, remainingCredits: credits, expiryDate: expiry })
          }
          className='w-full bg-emerald-900 text-white py-2 rounded'>
          Save
        </button>
      </motion.div>
    </div>
  );
};

export default ClientManager;
