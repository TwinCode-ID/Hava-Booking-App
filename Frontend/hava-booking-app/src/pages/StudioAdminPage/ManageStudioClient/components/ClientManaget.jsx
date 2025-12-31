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
  MoreHorizontal,
  Save,
  Calendar,
  Clock,
  Edit2,
  ChevronRight,
  UserPlus,
  Users,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useAuth } from "../../../../context/AuthContext";
import CustomSelect from "../../layout/CustomSelect";

const ClientManager = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- UI States ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // --- Modal States ---
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [viewingPass, setViewingPass] = useState(null);
  const [editingPass, setEditingPass] = useState(null);
  const [viewingStat, setViewingStat] = useState(null);

  // --- 1. Fetch Data ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ADMIN(user.adminStudioLocation)
      );
      setPurchases(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- 2. Data Processing ---
  const { filteredData, stats, statDatasets } = useMemo(() => {
    // Filter Logic
    const filtered = purchases.filter((item) => {
      const clean = (str) => (str || "").toLowerCase().replace(/[\s\-_]/g, "");
      const query = clean(searchQuery);
      const clientName = clean(item.userId?.fullName);
      const packageName = clean(item.packageId?.packageName);
      const matchesSearch =
        clientName.includes(query) || packageName.includes(query);

      let matchesFilter = true;
      if (filterStatus === "active") matchesFilter = item.isActive === true;
      if (filterStatus === "inactive") matchesFilter = item.isActive === false;

      return matchesSearch && matchesFilter;
    });

    // Stats Logic
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
    const activeList = purchases.filter((i) => i.isActive);

    const clientMap = new Map();
    purchases.forEach((p) => {
      if (p.userId && !clientMap.has(p.userId._id)) {
        clientMap.set(p.userId._id, {
          ...p.userId,
          lastActive: p.purchaseDate,
        });
      }
    });
    const clientList = Array.from(clientMap.values());

    return {
      filteredData: filtered,
      statDatasets: { revenueList, activeList, clientList },
      stats: {
        totalClients: clientList.length,
        activePackages: activeList.length,
        revenueDisplay: new Intl.NumberFormat("id-ID", {
          style: "currency",
          currency: "IDR",
          maximumFractionDigits: 0,
        }).format(totalRevenue),
      },
    };
  }, [purchases, searchQuery, filterStatus]);

  // --- 3. Handlers ---
  const handleExportPDF = () => {
    if (filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }

    try {
      const doc = new jsPDF();

      // 1. Add Title
      doc.setFontSize(18);
      doc.setTextColor(6, 78, 59); // Emerald-900
      doc.text("Client Pass Report", 14, 22);

      // 2. Add Stats Header (Adjusted Y coordinates to prevent overlap)
      doc.setFontSize(10);
      doc.setTextColor(100);

      const dateStr = new Date().toLocaleString();
      doc.text(`Generated on: ${dateStr}`, 14, 32);

      // Use the 'stats' object calculated in your useMemo
      doc.text(`Total Records: ${filteredData.length}`, 14, 38);
      doc.text(`Total Clients: ${stats.totalClients}`, 14, 44);
      doc.text(`Total Revenue: ${stats.revenueDisplay}`, 14, 50);

      // 3. Define Table Columns
      const tableColumn = [
        "Client Name",
        "Package",
        "Credits",
        "Expiry Date",
        "Status",
        "Price",
      ];
      const tableRows = [];

      // 4. Map Data to Rows
      filteredData.forEach((pass) => {
        const passData = [
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
        ];
        tableRows.push(passData);
      });

      // 5. Generate Table (Start Y is pushed down to accommodate header)
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 55, // Increased from 40 to 55 to fit the new text lines
        theme: "grid",
        headStyles: { fillColor: [6, 78, 59] },
        alternateRowStyles: { fillColor: [236, 253, 245] },
        styles: { fontSize: 8, cellPadding: 3 },
      });

      // 6. Save File
      doc.save(`Client_Report_${new Date().toISOString().split("T")[0]}.pdf`);
    } catch (error) {
      console.error("Export failed:", error);
      alert("An error occurred while exporting the PDF.");
    }
  };

  // --- HANDLE ASSIGN (Supports New & Existing) ---
  const handleAssignSubmit = async (formData) => {
    try {
      setLoading(true);
      let targetUserId = formData.userId;

      // 1. If New Client, Create User First
      if (formData.isNewClient) {
        console.log("Creating new client...", formData.newClientData);
        // Replace with your actual register endpoint
        const userRes = await axiosInstance.post("/auth/register", {
          ...formData.newClientData,
          role: "user",
        });
        // Assuming response structure: { user: { _id: ... } } or { _id: ... }
        targetUserId = userRes.data.user?._id || userRes.data._id;

        if (!targetUserId) throw new Error("Failed to retrieve new user ID.");
      }

      // 2. Create Pass for the User (New or Existing)
      console.log("Assigning pass to:", targetUserId);
      await axiosInstance.post(API_PATHS.PURCHASES.CREATE, {
        // Ensure this path is correct
        userId: targetUserId,
        packageId: formData.packageId,
        paymentMethod: "manual_admin", // Mark as admin assignment
        status: "confirmed", // Auto-confirm for admin actions
      });

      alert("Pass assigned successfully!");
      setShowAssignModal(false);
      fetchData();
    } catch (error) {
      console.error("Assign failed", error);
      const msg =
        error.response?.data?.message ||
        error.message ||
        "Failed to assign pass";
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) =>
    !d
      ? "-"
      : new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans relative'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>
            Client Management
          </h1>
          <p className='text-gray-500 text-sm mt-1'>
            Manage passes, assign packages, and track revenue.
          </p>
        </div>
        <div className='flex gap-3'>
          <button
            onClick={handleExportPDF}
            className='flex items-center gap-2 bg-white border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors shadow-sm'>
            <Download className='w-4 h-4' /> Export Report
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className='flex items-center gap-2 bg-emerald-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20'>
            <Plus className='w-4 h-4' /> Assign Pass
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-8'>
        <StatCard
          icon={User}
          label='Unique Clients'
          value={stats.totalClients}
          color='blue'
          onClick={() =>
            setViewingStat({
              title: "Unique Clients",
              type: "clients",
              data: statDatasets.clientList,
            })
          }
        />
        <StatCard
          icon={Package}
          label='Active Packages'
          value={stats.activePackages}
          color='emerald'
          onClick={() =>
            setViewingStat({
              title: "Active Packages",
              type: "active",
              data: statDatasets.activeList,
            })
          }
        />
        <StatCard
          icon={CreditCard}
          label='Revenue (This Month)'
          value={stats.revenueDisplay}
          color='purple'
          onClick={() =>
            setViewingStat({
              title: "Monthly Revenue",
              type: "revenue",
              data: statDatasets.revenueList,
            })
          }
        />
      </div>

      {/* Toolbar */}
      <div className='flex flex-col md:flex-row justify-end items-center mb-6 gap-4 relative z-20'>
        <div className='flex items-center justify-end gap-3 w-full md:w-auto overflow-hidden'>
          <motion.div layout className='relative flex-1 md:w-80 transition-all'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
            <input
              type='text'
              placeholder='Search client or package...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
            />
          </motion.div>
          <div className='flex items-center gap-2'>
            <button
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
            </button>
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className='flex items-center gap-1 overflow-hidden ml-2'>
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
                          : "bg-white border text-gray-500 hover:bg-gray-50"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead className='bg-gray-50 border-b border-gray-100'>
              <tr>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Client Name
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Package
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Credits
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Expiry
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase'>
                  Status
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase text-right'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              <AnimatePresence>
                {filteredData.length > 0 ? (
                  filteredData.map((item) => (
                    <motion.tr
                      key={item._id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className='hover:bg-gray-50 transition-colors'>
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
                      <td className='py-4 px-6 text-right'>
                        <button
                          onClick={() => setViewingPass(item)}
                          className='p-2 text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg'>
                          <MoreHorizontal className='w-5 h-5' />
                        </button>
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
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Modals --- */}
      <AnimatePresence>
        {viewingStat && (
          <StatDetailsModal
            title={viewingStat.title}
            type={viewingStat.type}
            data={viewingStat.data}
            onClose={() => setViewingStat(null)}
          />
        )}

        {/* Updated Assign Modal with New/Existing Logic */}
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
              console.log("Save", data);
              setEditingPass(null);
              fetchData();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- SUB-COMPONENTS ---

const StatCard = ({ icon: Icon, label, value, color, onClick }) => {
  const colorStyles = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <motion.button
      whileHover={{ y: -4, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 text-left w-full transition-all cursor-pointer group'>
      <div
        className={`p-3 rounded-xl ${colorStyles[color]} group-hover:scale-110 transition-transform`}>
        <Icon className='w-6 h-6' />
      </div>
      <div>
        <p className='text-sm text-gray-500 font-medium group-hover:text-emerald-700 transition-colors flex items-center gap-1'>
          {label}{" "}
          <ChevronRight className='w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity' />
        </p>
        <p className='text-2xl font-bold text-gray-900'>{value}</p>
      </div>
    </motion.button>
  );
};

// --- UPDATED ASSIGN PASS MODAL ---
const AssignPassModal = ({ onClose, onSubmit }) => {
  const [activeTab, setActiveTab] = useState("existing"); // "existing" or "new"
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form States
  const [formData, setFormData] = useState({
    userId: "",
    packageId: "",
    isNewClient: false,
    newClientData: { fullName: "", email: "", phone: "", password: "" },
  });

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [usersRes, packagesRes] = await Promise.all([
          axiosInstance.get("/users/all"),
          axiosInstance.get(API_PATHS.PACKAGES.GET_ALL),
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
    ((activeTab === "existing" && formData.userId) ||
      (activeTab === "new" &&
        formData.newClientData.fullName &&
        formData.newClientData.email &&
        formData.newClientData.password));

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
        className='relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto'>
        {/* Modal Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center'>
          <h3 className='text-lg font-bold text-gray-900'>Assign New Pass</h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* Tabs */}
        <div className='flex p-1 mx-6 mt-4 bg-gray-100 rounded-lg'>
          <button
            type='button'
            onClick={() => setActiveTab("existing")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "existing"
                ? "bg-white text-emerald-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}>
            <Users className='w-4 h-4' /> Existing Client
          </button>
          <button
            type='button'
            onClick={() => setActiveTab("new")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-md transition-all ${
              activeTab === "new"
                ? "bg-white text-emerald-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}>
            <UserPlus className='w-4 h-4' /> New Client
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          {/* PACKAGE SELECT (Common) */}
          <CustomSelect
            label='Select Package'
            placeholder='Choose package...'
            options={packages}
            getLabel={(p) => p.packageName}
            getValue={(p) => p._id}
            value={formData.packageId}
            onChange={(val) => setFormData({ ...formData, packageId: val })}
          />

          {/* DYNAMIC CONTENT */}
          {activeTab === "existing" ? (
            <CustomSelect
              label='Select Client'
              placeholder={loadingData ? "Loading..." : "Search client..."}
              options={users}
              searchable={true}
              getLabel={(u) => `${u.fullName} (${u.email})`}
              getValue={(u) => u._id}
              value={formData.userId}
              onChange={(val) => setFormData({ ...formData, userId: val })}
            />
          ) : (
            <div className='space-y-3 pt-2'>
              <p className='text-xs text-emerald-600 font-medium bg-emerald-50 p-2 rounded-lg'>
                New client account will be created automatically.
              </p>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Full Name *
                </label>
                <input
                  type='text'
                  name='fullName'
                  value={formData.newClientData.fullName}
                  onChange={handleNewClientChange}
                  className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors'
                  placeholder='e.g. John Doe'
                />
              </div>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Email Address *
                </label>
                <input
                  type='email'
                  name='email'
                  value={formData.newClientData.email}
                  onChange={handleNewClientChange}
                  className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors'
                  placeholder='e.g. john@example.com'
                />
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    Phone (Optional)
                  </label>
                  <input
                    type='text'
                    name='phone'
                    value={formData.newClientData.phone}
                    onChange={handleNewClientChange}
                    className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors'
                    placeholder='081...'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    Password *
                  </label>
                  <input
                    type='password'
                    name='password'
                    value={formData.newClientData.password}
                    onChange={handleNewClientChange}
                    className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white transition-colors'
                    placeholder='Create password'
                  />
                </div>
              </div>
            </div>
          )}

          <div className='pt-4 flex gap-3 border-t mt-4'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-lg transition-colors'>
              Cancel
            </button>
            <button
              type='submit'
              disabled={!isFormValid}
              className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
              {activeTab === "new" ? "Create & Assign" : "Assign Pass"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

// --- Other StatDetailsModal, PassDetailsModal, EditPassModal remain the same as previous correct response ---
const StatDetailsModal = ({ title, type, data, onClose }) => {
  const formatMoney = (val) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(val);
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
            <h3 className='text-lg font-bold text-gray-900'>{title}</h3>
            <p className='text-xs text-gray-500'>
              Showing {data.length} records
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='overflow-y-auto p-0 flex-1'>
          <table className='w-full text-left text-sm'>
            <thead className='bg-white sticky top-0 z-10 shadow-sm'>
              <tr>
                {type === "clients" && (
                  <>
                    <th className='p-4 bg-gray-50 text-gray-500'>Name</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>Email</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>
                      Last Active
                    </th>
                  </>
                )}
                {type === "active" && (
                  <>
                    <th className='p-4 bg-gray-50 text-gray-500'>Client</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>Package</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>Expires</th>
                  </>
                )}
                {type === "revenue" && (
                  <>
                    <th className='p-4 bg-gray-50 text-gray-500'>Date</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>Client</th>
                    <th className='p-4 bg-gray-50 text-gray-500'>Package</th>
                    <th className='p-4 bg-gray-50 text-gray-500 text-right'>
                      Amount
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>
              {data.length > 0 ? (
                data.map((item, idx) => (
                  <tr key={idx} className='hover:bg-gray-50 transition-colors'>
                    {type === "clients" && (
                      <>
                        <td className='p-4 font-bold text-gray-900'>
                          {item.fullName}
                        </td>
                        <td className='p-4 text-gray-600'>{item.email}</td>
                        <td className='p-4 text-gray-500'>
                          {formatDate(item.lastActive)}
                        </td>
                      </>
                    )}
                    {type === "active" && (
                      <>
                        <td className='p-4 font-bold text-gray-900'>
                          {item.userId?.fullName}
                        </td>
                        <td className='p-4 text-gray-600'>
                          {item.packageId?.packageName}
                        </td>
                        <td className='p-4 text-emerald-600 font-medium'>
                          {formatDate(item.expiryDate)}
                        </td>
                      </>
                    )}
                    {type === "revenue" && (
                      <>
                        <td className='p-4 text-gray-500'>
                          {formatDate(item.purchaseDate)}
                        </td>
                        <td className='p-4 font-bold text-gray-900'>
                          {item.userId?.fullName}
                        </td>
                        <td className='p-4 text-gray-600'>
                          {item.packageId?.packageName}
                        </td>
                        <td className='p-4 text-right font-mono font-bold text-emerald-700'>
                          {formatMoney(item.packageId?.packagePrice)}
                        </td>
                      </>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan='4' className='p-8 text-center text-gray-400'>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='p-4 border-t border-gray-100 text-center'>
          <button
            onClick={onClose}
            className='px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors'>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PassDetailsModal = ({ pass, onClose, onEdit }) => {
  const formatMoney = (amount) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

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
            <div className='w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg'>
              {pass.userId?.fullName?.charAt(0) || "U"}
            </div>
            <div>
              <h3 className='text-lg font-bold text-gray-900'>
                {pass.userId?.fullName}
              </h3>
              <p className='text-sm text-gray-500'>
                {pass.userId?.email || "No email"}
              </p>
              <span className='text-xs text-gray-400 font-mono'>
                ID: {pass.userId?._id?.slice(-6)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='p-6 space-y-6'>
          <div
            className={`flex items-center justify-between p-4 rounded-xl border ${
              pass.isActive
                ? "bg-emerald-50 border-emerald-100"
                : "bg-gray-50 border-gray-200"
            }`}>
            <div className='flex items-center gap-3'>
              <div
                className={`p-2 rounded-full ${
                  pass.isActive
                    ? "bg-emerald-100 text-emerald-600"
                    : "bg-gray-200 text-gray-500"
                }`}>
                <Package className='w-5 h-5' />
              </div>
              <div>
                <p className='text-sm font-bold text-gray-900'>
                  {pass.packageId?.packageName}
                </p>
                <p className='text-xs text-gray-500'>
                  {pass.isActive ? "Active Pass" : "Inactive Pass"}
                </p>
              </div>
            </div>
            <div className='text-right'>
              <p className='text-2xl font-bold text-gray-900'>
                {pass.remainingCredits}
              </p>
              <p className='text-xs text-gray-500'>Credits Left</p>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='flex gap-3'>
              <Calendar className='w-4 h-4 text-gray-400 mt-1' />
              <div>
                <p className='text-xs text-gray-500'>Purchased</p>
                <p className='text-sm font-bold'>
                  {formatDate(pass.purchaseDate)}
                </p>
              </div>
            </div>
            <div className='flex gap-3'>
              <Clock className='w-4 h-4 text-gray-400 mt-1' />
              <div>
                <p className='text-xs text-gray-500'>Expires</p>
                <p className='text-sm font-bold'>
                  {formatDate(pass.expiryDate)}
                </p>
              </div>
            </div>
            <div className='flex gap-3'>
              <CreditCard className='w-4 h-4 text-gray-400 mt-1' />
              <div>
                <p className='text-xs text-gray-500'>Price</p>
                <p className='text-sm font-bold'>
                  {formatMoney(pass.packageId?.packagePrice || 0)}
                </p>
              </div>
            </div>
            <div className='flex gap-3'>
              <User className='w-4 h-4 text-gray-400 mt-1' />
              <div>
                <p className='text-xs text-gray-500'>Type</p>
                <p className='text-sm font-bold'>
                  {pass.packageId?.instructorType}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className='p-4 bg-gray-50 border-t border-gray-100 flex gap-3'>
          <button
            onClick={onClose}
            className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-white border border-transparent hover:border-gray-200 rounded-xl transition-all'>
            Close
          </button>
          <button
            onClick={onEdit}
            className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-xl shadow-lg flex items-center justify-center gap-2'>
            <Edit2 className='w-4 h-4' /> Edit Pass
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EditPassModal = ({ pass, onClose, onSubmit }) => {
  const [credits, setCredits] = useState(pass.remainingCredits);
  const [expiry, setExpiry] = useState(pass.expiryDate?.split("T")[0]);
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...pass, remainingCredits: credits, expiryDate: expiry });
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className='relative bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>
              Edit Pass Details
            </h3>
            <p className='text-xs text-gray-500'>
              {pass.packageId?.packageName}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-bold text-gray-700 mb-1'>
              Credits
            </label>
            <input
              type='number'
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className='w-full p-2 border rounded-lg text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-bold text-gray-700 mb-1'>
              Expiry
            </label>
            <input
              type='date'
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className='w-full p-2 border rounded-lg text-sm'
            />
          </div>
          <div className='pt-2 flex gap-3'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-lg'>
              Cancel
            </button>
            <button
              type='submit'
              className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-lg flex items-center justify-center gap-2'>
              <Save className='w-4 h-4' /> Save Changes
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default ClientManager;
