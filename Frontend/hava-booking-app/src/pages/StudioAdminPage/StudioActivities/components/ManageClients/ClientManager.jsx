import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Search,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Edit2,
  Settings,
  Check,
  Calendar as CalendarIcon,
  ArrowLeft,
  Phone,
  Mail,
  FileText,
  Activity,
  Receipt,
  CreditCard,
  AlertCircle,
  Download,
  ExternalLink,
  User as UserIcon,
  ShoppingBag,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  GraduationCap,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import CustomSelect from "../Layout/CustomSelect";

// --- Safe Data Getters ---
const getSafeClientData = (user) => ({
  _id: user?._id || `unknown-${Math.random().toString(36).substring(7)}`,
  fullName: user?.fullName || "Unknown Client",
  email: user?.email || "",
  phoneNumber: user?.phoneNumber || "",
  avatar: user?.avatar || null,
  isStudent: user?.isStudent || false,
});

const getSafePackageData = (pkg) => ({
  _id: pkg?._id || "unknown",
  packageName: pkg?.packageName || "Custom / Unknown Package",
  credits: pkg?.credits || 0,
  isStudent: pkg?.isStudent || false,
});

const getSafeMedicalData = (med) => ({
  dateOfBirth: med?.dateOfBirth || null,
  sex: med?.sex || "Not specified",
  occupation: med?.occupation || "Not specified",
  maritalStatus: med?.maritalStatus || "Not specified",
  physicalConcern: med?.physicalConcern || "None reported.",
  dailyActivity: med?.dailyActivity || "No details provided.",
  address: med?.address || "No address provided.",
});

const getSafePassData = (pass) => ({
  ...pass,
  userId: getSafeClientData(pass?.userId),
  packageId: getSafePackageData(pass?.packageId),
  remainingCredits: pass?.remainingCredits ?? pass?.initialCredits ?? 0,
  creditsPurchased:
    pass?.initialCredits ??
    pass?.packageId?.credits ??
    pass?.remainingCredits ??
    1,
  isActive: pass?.isActive || pass?.status === "confirmed",
  createdAt: pass?.createdAt || new Date().toISOString(),
  expiryDate: pass?.expiryDate || pass?.paymentWindowExpiry || null,
});

const getSafePurchaseData = (purchase) => ({
  _id: purchase?._id || Math.random().toString(),
  transactionId: purchase?.transactionId || "-",
  packageId: getSafePackageData(purchase?.packageId),
  totalAmount: purchase?.totalAmount || 0,
  creditsPurchased: purchase?.creditsPurchased || 0,
  paymentMethod: purchase?.paymentMethod || "Unknown",
  paymentIssuer: purchase?.paymentIssuer || "",
  proofOfPayment: purchase?.proofOfPayment || null,
  status: purchase?.status || "unknown",
  createdAt: purchase?.createdAt || new Date().toISOString(),
  // Add this line below to safely extract the studio ID
  issuingStudio:
    purchase?.issuingStudio?._id || purchase?.issuingStudio || null,
});

// --- Formatting Helpers ---
const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "-";
const formatDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";
const formatCurrency = (amount) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
const formatPaymentMethod = (method, issuer) => {
  if (!method) return "Unknown";
  const cleanMethod = method
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  const cleanIssuer = issuer ? issuer.toUpperCase() : "";
  return cleanIssuer ? `${cleanMethod} - ${cleanIssuer}` : cleanMethod;
};

const ClientManager = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Sort States
  const [sortConfig, setSortConfig] = useState({
    key: "fullName",
    direction: "asc",
  });
  const [historySortConfig, setHistorySortConfig] = useState({
    key: "createdAt",
    direction: "desc",
  });

  const [selectedClient, setSelectedClient] = useState(null);
  const [medicalData, setMedicalData] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Modal States
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDirectAssignModal, setShowDirectAssignModal] = useState(false);
  const [showAddMedicalModal, setShowAddMedicalModal] = useState(false);
  const [showViewMedicalModal, setShowViewMedicalModal] = useState(false);
  const [viewingCombinedItem, setViewingCombinedItem] = useState(null);
  const [editingPass, setEditingPass] = useState(null);

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
      const safePurchases = (res.data || []).map(getSafePassData);
      setPurchases(safePurchases);
      setConfig(configRes.data || { classTypes: [], instructorTypes: [] });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.adminStudioLocation]);

  const fetchClientDetails = async () => {
    if (!selectedClient) return;
    setLoadingDetails(true);
    try {
      const [medRes, purRes] = await Promise.allSettled([
        axiosInstance.get(API_PATHS.AUTH.MEDICAL_INFO(selectedClient._id)),
        axiosInstance.get(API_PATHS.PURCHASES.GET_ALL_USER(selectedClient._id)),
      ]);

      if (medRes.status === "fulfilled" && medRes.value.data) {
        setMedicalData(getSafeMedicalData(medRes.value.data));
      } else {
        setMedicalData(null);
      }

      if (purRes.status === "fulfilled" && purRes.value.data) {
        setPurchaseHistory(purRes.value.data.map(getSafePurchaseData));
      } else {
        setPurchaseHistory([]);
      }
    } catch (e) {
      console.error("Error fetching client details", e);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchClientDetails();
  }, [selectedClient]);

  // Handle explicit Student status toggle
  const handleToggleStudent = async () => {
    if (!selectedClient) return;
    try {
      const newStatus = !selectedClient.isStudent;
      setSelectedClient((prev) => ({ ...prev, isStudent: newStatus }));

      // Assuming API_PATHS.AUTH.UPDATE_USER exists, or fallback to direct put
      const endpoint = API_PATHS.AUTH.UPDATE_PROFILE_ADMIN(selectedClient._id);

      await axiosInstance.put(endpoint, { isStudent: newStatus });
      fetchData(); // Refresh list silently to sync state
    } catch (e) {
      console.error("Failed to update student status", e);
      setSelectedClient((prev) => ({ ...prev, isStudent: !prev.isStudent }));
      alert("Failed to update student status");
    }
  };

  // --- Core Logic: Combine Passes & Purchases ---
  const combinedHistory = useMemo(() => {
    if (!selectedClient) return [];
    const passes = selectedClient.passes || [];

    // Safely get the current studio ID
    const currentStudioId =
      user?.adminStudioLocation?._id || user?.adminStudioLocation;

    // Filter transactions to only include those from the current studio
    // (We also return true if issuingStudio is missing to support legacy data)
    const txns = (purchaseHistory || []).filter((txn) => {
      if (!txn.issuingStudio) return true;
      return txn.issuingStudio === currentStudioId;
    });

    const usedPassIds = new Set();
    const combined = txns.map((txn) => {
      let matchedPass = passes.find(
        (p) =>
          p.packageId?._id === txn.packageId?._id && !usedPassIds.has(p._id),
      );
      if (matchedPass) usedPassIds.add(matchedPass._id);

      return {
        _id: txn._id,
        isTxn: true,
        txnData: txn,
        passData: matchedPass || null,
        createdAt: txn.createdAt,
      };
    });

    passes.forEach((pass) => {
      if (!usedPassIds.has(pass._id)) {
        combined.push({
          _id: pass._id,
          isTxn: false,
          txnData: null,
          passData: pass,
          createdAt: pass.createdAt,
        });
      }
    });

    // Apply Sort to History
    return combined.sort((a, b) => {
      let aVal, bVal;
      if (historySortConfig.key === "createdAt") {
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
      } else if (historySortConfig.key === "packageName") {
        aVal = (
          a.passData?.packageId?.packageName ||
          a.txnData?.packageId?.packageName ||
          ""
        ).toLowerCase();
        bVal = (
          b.passData?.packageId?.packageName ||
          b.txnData?.packageId?.packageName ||
          ""
        ).toLowerCase();
      } else if (historySortConfig.key === "totalAmount") {
        aVal = a.isTxn ? a.txnData.totalAmount : 0;
        bVal = b.isTxn ? b.txnData.totalAmount : 0;
      }

      if (aVal < bVal) return historySortConfig.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return historySortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [selectedClient, purchaseHistory, historySortConfig, user]);

  const clientsData = useMemo(() => {
    const map = new Map();
    purchases.forEach((pass) => {
      const clientObj = pass.userId;
      if (!map.has(clientObj._id))
        map.set(clientObj._id, {
          ...clientObj,
          passes: [],
          activePassesCount: 0,
        });
      const clientRecord = map.get(clientObj._id);
      clientRecord.passes.push(pass);
      if (pass.isActive) clientRecord.activePassesCount++;
    });
    return Array.from(map.values());
  }, [purchases]);

  const filteredClients = useMemo(() => {
    let filtered = clientsData.filter((client) => {
      const clean = (str) => (str || "").toLowerCase().replace(/[\s\-_]/g, "");
      const query = clean(searchQuery);
      return (
        clean(client.fullName).includes(query) ||
        clean(client.email).includes(query) ||
        clean(client.phoneNumber).includes(query)
      );
    });

    return filtered.sort((a, b) => {
      let aValue = (a[sortConfig.key] || "").toString().toLowerCase();
      let bValue = (b[sortConfig.key] || "").toString().toLowerCase();
      if (sortConfig.key === "activePassesCount") {
        aValue = a.activePassesCount;
        bValue = b.activePassesCount;
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });
  }, [clientsData, searchQuery, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleHistorySort = (key) => {
    setHistorySortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const SortIcon = ({ columnKey, activeConfig }) => {
    if (activeConfig.key !== columnKey)
      return <ArrowUpDown className='w-3 h-3 ml-1.5 opacity-30 inline-block' />;
    return activeConfig.direction === "asc" ? (
      <ArrowUp className='w-3 h-3 ml-1.5 inline-block text-emerald-600' />
    ) : (
      <ArrowDown className='w-3 h-3 ml-1.5 inline-block text-emerald-600' />
    );
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
      setShowAssignModal(false);
      setShowDirectAssignModal(false);
      fetchData();
      if (selectedClient) fetchClientDetails();
    } catch (error) {
      console.error("Assign failed", error);
      alert(error.response?.data?.message || "Failed to assign pass");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedicalSubmit = async (formData) => {
    try {
      setLoadingDetails(true);
      await axiosInstance.post(
        API_PATHS.AUTH.MEDICAL_INFO(selectedClient._id),
        { ...formData },
      );
      setShowAddMedicalModal(false);
      fetchClientDetails();
    } catch (error) {
      console.error("Failed to add medical record", error);
      alert(error.response?.data?.message || "Failed to add medical record");
    } finally {
      setLoadingDetails(false);
    }
  };

  const generateInvoice = (txn, client) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    const brandColor = [26, 77, 62];
    const grayText = [100, 116, 139];
    const darkText = [15, 23, 42];

    doc.setFillColor(...brandColor);
    doc.rect(0, 0, pageWidth, 45, "F");
    doc.setFont("helvetica", "normal");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 16, 28);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Receipt / Transaction Record", pageWidth - 16, 20, {
      align: "right",
    });
    doc.setFontSize(9);
    doc.text(`Date: ${formatDateTime(txn.createdAt)}`, pageWidth - 16, 28, {
      align: "right",
    });
    doc.text(`TRX ID: ${txn.transactionId}`, pageWidth - 16, 34, {
      align: "right",
    });

    doc.setTextColor(...darkText);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Billed To:", 16, 62);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(client.fullName, 16, 70);
    if (client.email) doc.text(client.email, 16, 76);
    if (client.phoneNumber) doc.text(client.phoneNumber, 16, 82);

    const packageName = txn.packageId?.packageName || "Custom Package";
    const credits = txn.creditsPurchased || 0;
    const paymentMethod = formatPaymentMethod(
      txn.paymentMethod,
      txn.paymentIssuer,
    );

    autoTable(doc, {
      startY: 95,
      headStyles: {
        fillColor: [248, 250, 252],
        textColor: grayText,
        fontStyle: "bold",
        halign: "left",
        fontSize: 7,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 55 },
        2: { cellWidth: 30, halign: "left" },
        3: { halign: "left" },
      },
      bodyStyles: {
        textColor: darkText,
        fontSize: 7,
        cellPadding: 6,
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      styles: {
        lineColor: [226, 232, 240],
        lineWidth: 0.1,
        font: "helvetica",
      },
      head: [["DESCRIPTION", "PAYMENT METHOD", "STATUS", "AMOUNT"]],
      body: [
        [
          `${packageName}\n(${credits} Credits)`,
          paymentMethod,
          txn.status.toUpperCase(),
          formatCurrency(txn.totalAmount),
        ],
      ],
    });

    const finalY = doc.lastAutoTable.finalY || 130;

    doc.setFillColor(248, 250, 252);
    doc.rect(pageWidth - 100, finalY + 10, 84, 26, "F");

    doc.setFontSize(11);
    doc.setTextColor(...grayText);
    doc.setFont("helvetica", "normal");
    doc.text("Total Paid:", pageWidth - 92, finalY + 26);

    doc.setFontSize(14);
    doc.setTextColor(...brandColor);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(txn.totalAmount), pageWidth - 24, finalY + 26, {
      align: "right",
    });

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.setFont("helvetica", "normal");
    doc.text("Thank you for your purchase.", pageWidth / 2, finalY + 70, {
      align: "center",
    });

    doc.save(`Invoice-${txn.transactionId}.pdf`);
  };

  const renderStatusBadge = (status, isActive) => {
    if (status === "confirmed" || isActive === true) {
      return (
        <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-700 uppercase tracking-wide border border-emerald-100'>
          <CheckCircle2 className='w-3 h-3' /> Active
        </span>
      );
    }
    if (status === "waiting_confirmation") {
      return (
        <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 uppercase tracking-wide border border-amber-100'>
          <AlertCircle className='w-3 h-3' /> Pending
        </span>
      );
    }
    return (
      <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-extrabold bg-gray-50 text-gray-500 uppercase tracking-wide border border-gray-200'>
        <XCircle className='w-3 h-3' /> Inactive
      </span>
    );
  };

  if (loading && !purchases.length) return <LoadingSpinner />;

  return (
    <div
      className={`p-4 md:p-8 lg:p-10 ${isEmbedded ? "pt-8" : ""} bg-[#F8FAFC] relative min-h-screen font-sans w-full`}>
      {!isEmbedded && !selectedClient && (
        <div className='flex justify-between items-center mb-6 md:mb-8'>
          <h1 className='text-2xl md:text-[24px] font-extrabold text-gray-900 tracking-tight'>
            Client Management
          </h1>
        </div>
      )}

      {/* --- CLIENT LIST VIEW --- */}
      {!selectedClient ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className='flex flex-col md:flex-row justify-between items-stretch md:items-center mb-6 gap-4'>
            <div className='relative w-full md:w-96'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
              <input
                type='text'
                placeholder='Search by name, email, or phone...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-11 pr-4 py-3 bg-white border border-gray-200/80 rounded-[14px] text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]'
              />
            </div>
            <button
              onClick={() => setShowAssignModal(true)}
              className='w-full md:w-auto justify-center px-5 py-3 bg-[#1a4d3e] text-white rounded-[14px] text-sm font-bold flex items-center gap-2 shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] transition-all active:scale-[0.98]'>
              <Plus className='w-4 h-4' /> Assign Pass
            </button>
          </div>

          <div className='bg-white rounded-[20px] border border-gray-100 shadow-sm overflow-hidden'>
            <div className='overflow-x-hidden md:overflow-x-auto w-full custom-scrollbar'>
              {/* DESKTOP TABLE */}
              <table className='w-full text-left border-collapse hidden md:table'>
                <thead className='bg-slate-50/50 border-b border-gray-100'>
                  <tr>
                    <th
                      onClick={() => handleSort("fullName")}
                      className='py-4 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                      <div className='flex items-center'>
                        Client Profile
                        <SortIcon
                          columnKey='fullName'
                          activeConfig={sortConfig}
                        />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("email")}
                      className='py-4 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                      <div className='flex items-center'>
                        Contact Info
                        <SortIcon columnKey='email' activeConfig={sortConfig} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("activePassesCount")}
                      className='py-4 px-6 text-[11px] font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                      <div className='flex items-center'>
                        Activity
                        <SortIcon
                          columnKey='activePassesCount'
                          activeConfig={sortConfig}
                        />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {filteredClients.map((client) => (
                    <tr
                      key={client._id}
                      onClick={() => setSelectedClient(client)}
                      className='hover:bg-slate-50/80 transition-colors cursor-pointer group'>
                      <td className='py-4 px-6'>
                        <div className='flex items-center gap-4'>
                          <div className='w-10 h-10 shrink-0 rounded-[12px] bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-emerald-200/50'>
                            {client.fullName.charAt(0)}
                          </div>
                          <div>
                            <span className='font-bold text-gray-900 text-sm group-hover:text-emerald-700 transition-colors flex items-center gap-1.5'>
                              {client.fullName}
                              {client.isStudent && (
                                <GraduationCap className='w-4 h-4 text-emerald-600' />
                              )}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className='py-4 px-6'>
                        <div className='flex flex-col gap-1 text-xs'>
                          <span className='text-gray-600 font-medium'>
                            {client.email || "—"}
                          </span>
                          <span className='text-gray-400'>
                            {client.phoneNumber || "—"}
                          </span>
                        </div>
                      </td>
                      <td className='py-4 px-6'>
                        <span className='inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50/50 text-blue-700 border border-blue-100/50'>
                          {client.passes.length} Passes
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* MOBILE LIST (Cards) */}
              <div className='block md:hidden divide-y divide-gray-50'>
                {filteredClients.map((client) => (
                  <div
                    key={client._id}
                    onClick={() => setSelectedClient(client)}
                    className='p-4 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-3 group'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 shrink-0 rounded-[12px] bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm uppercase shadow-sm border border-emerald-200/50'>
                          {client.fullName.charAt(0)}
                        </div>
                        <div>
                          <span className='font-bold text-gray-900 text-sm mb-0.5 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5'>
                            {client.fullName}
                            {client.isStudent && (
                              <GraduationCap className='w-3.5 h-3.5 text-emerald-600' />
                            )}
                          </span>
                          <span className='text-xs text-gray-500 font-medium block'>
                            {client.phoneNumber || "—"}
                          </span>
                        </div>
                      </div>
                      <span className='inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50/50 text-blue-700 border border-blue-100/50 whitespace-nowrap'>
                        {client.passes.length} Passes
                      </span>
                    </div>
                    {client.email && (
                      <div className='flex items-center gap-2 text-xs text-gray-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100/50 mt-1'>
                        <Mail className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                        <span className='truncate'>{client.email}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {filteredClients.length === 0 && (
              <div className='py-20 text-center flex flex-col items-center'>
                <UserIcon className='w-12 h-12 text-gray-200 mb-3' />
                <p className='text-gray-500 font-medium'>No clients found.</p>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        /* --- CLIENT DETAIL PAGE VIEW --- */
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className='space-y-6'>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4'>
            <button
              onClick={() => {
                setSelectedClient(null);
                setMedicalData(null);
                setPurchaseHistory([]);
              }}
              className='flex justify-center items-center gap-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-all bg-white px-5 py-2.5 rounded-xl border border-gray-200 shadow-sm hover:shadow w-full sm:w-auto'>
              <ArrowLeft className='w-4 h-4' /> Back to Clients
            </button>
            <button
              onClick={() => setShowDirectAssignModal(true)}
              className='w-full sm:w-auto justify-center px-5 py-2.5 bg-[#1a4d3e] text-white rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] active:scale-95 transition-all'>
              <Plus className='w-4 h-4' /> Assign New Pass
            </button>
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-12 gap-6 items-start'>
            {/* LEFT COLUMN: Client Info & Medical Details */}
            <div className='flex flex-col gap-6 lg:col-span-4 xl:col-span-3 w-full min-w-0'>
              <div className='bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm'>
                <div className='flex items-center gap-4 mb-6'>
                  <div className='w-14 h-14 shrink-0 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-2xl uppercase shadow-sm border border-emerald-200/50'>
                    {selectedClient.fullName.charAt(0)}
                  </div>
                  <div className='overflow-hidden'>
                    <h2 className='text-lg font-extrabold text-gray-900 truncate'>
                      {selectedClient.fullName}
                    </h2>
                    <span className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5 block'>
                      Client Profile
                    </span>
                  </div>
                </div>
                <div className='space-y-2.5'>
                  <div className='flex items-center gap-3 text-sm font-medium text-gray-600 bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-100/50 truncate w-full'>
                    <Mail className='w-4 h-4 text-gray-400 shrink-0' />{" "}
                    {selectedClient.email || (
                      <span className='italic text-gray-400 font-normal'>
                        No email provided
                      </span>
                    )}
                  </div>
                  <div className='flex items-center gap-3 text-sm font-medium text-gray-600 bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-100/50 w-full'>
                    <Phone className='w-4 h-4 text-gray-400 shrink-0' />{" "}
                    {selectedClient.phoneNumber || (
                      <span className='italic text-gray-400 font-normal'>
                        No phone provided
                      </span>
                    )}
                  </div>
                  {/* --- STUDENT STATUS TOGGLE --- */}
                  <div className='flex items-center justify-between text-sm font-medium text-gray-600 bg-slate-50/80 px-4 py-3 rounded-xl border border-slate-100/50 w-full'>
                    <div className='flex items-center gap-3'>
                      <GraduationCap className='w-4 h-4 text-gray-400 shrink-0' />
                      <span>Student Status</span>
                    </div>
                    <button
                      type='button'
                      onClick={handleToggleStudent}
                      className={`w-10 h-6 rounded-full p-1 transition-colors ${
                        selectedClient.isStudent
                          ? "bg-emerald-500"
                          : "bg-slate-300"
                      }`}>
                      <div
                        className={`w-4 h-4 rounded-full bg-white transition-transform ${
                          selectedClient.isStudent
                            ? "translate-x-4"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              <div className='bg-white p-5 md:p-6 rounded-2xl border border-gray-100 shadow-sm'>
                <div className='flex items-center gap-2.5 mb-2'>
                  <Activity className='w-5 h-5 text-rose-500 shrink-0' />
                  <h3 className='font-extrabold text-gray-900 text-[15px]'>
                    Medical Profile
                  </h3>
                </div>

                {medicalData ? (
                  <div className='flex flex-col items-center justify-center py-5 bg-emerald-50/30 rounded-2xl border border-emerald-100/50 mt-4'>
                    <CheckCircle2 className='w-8 h-8 text-emerald-500 mb-2' />
                    <p className='text-sm font-bold text-emerald-900 mb-4'>
                      Record on file
                    </p>
                    <button
                      onClick={() => setShowViewMedicalModal(true)}
                      className='inline-flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-700 shadow-sm border border-emerald-200 text-sm font-bold rounded-xl hover:bg-emerald-50 transition-all active:scale-95'>
                      View Details
                    </button>
                  </div>
                ) : (
                  <div className='text-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-gray-200 flex flex-col items-center justify-center mt-4'>
                    <FileText className='w-8 h-8 text-gray-300 mb-3' />
                    <p className='text-sm font-medium text-gray-500 mb-4'>
                      No medical records yet.
                    </p>
                    <button
                      onClick={() => setShowAddMedicalModal(true)}
                      className='inline-flex items-center gap-2 px-5 py-2 bg-white text-emerald-700 shadow-sm border border-emerald-100 text-xs font-bold rounded-xl hover:bg-emerald-50 transition-all active:scale-95'>
                      <Plus className='w-3.5 h-3.5' /> Add Record
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: Unified Pass & Transaction History Engine */}
            <div className='lg:col-span-8 xl:col-span-9 w-full min-w-0'>
              <section className='bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden w-full'>
                <div className='px-5 md:px-6 py-5 border-b border-gray-50 flex flex-wrap gap-2 items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <ShoppingBag className='w-5 h-5 text-gray-700 shrink-0' />
                    <h3 className='text-[15px] md:text-[16px] font-extrabold text-gray-900'>
                      Purchase & Pass History
                    </h3>
                  </div>
                  <span className='text-[10px] md:text-[11px] font-extrabold tracking-wider bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg'>
                    {combinedHistory.length} RECORDS
                  </span>
                </div>

                <div className='overflow-x-hidden md:overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar w-full'>
                  {/* DESKTOP TABLE */}
                  <table className='w-full text-left border-collapse hidden md:table'>
                    <thead className='bg-[#F8FAFC] sticky top-0 z-10 border-b border-gray-100'>
                      <tr>
                        <th
                          onClick={() => handleHistorySort("createdAt")}
                          className='py-4 px-4 md:px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                          <div className='flex items-center'>
                            Date & ID
                            <SortIcon
                              columnKey='createdAt'
                              activeConfig={historySortConfig}
                            />
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistorySort("packageName")}
                          className='py-4 px-4 md:px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                          <div className='flex items-center'>
                            Package Details
                            <SortIcon
                              columnKey='packageName'
                              activeConfig={historySortConfig}
                            />
                          </div>
                        </th>
                        <th
                          onClick={() => handleHistorySort("totalAmount")}
                          className='py-4 px-4 md:px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors select-none whitespace-nowrap'>
                          <div className='flex items-center'>
                            Payment
                            <SortIcon
                              columnKey='totalAmount'
                              activeConfig={historySortConfig}
                            />
                          </div>
                        </th>
                        <th className='py-4 px-4 md:px-6 text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap'>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-50'>
                      {combinedHistory.map((item, idx) => {
                        const packageObj =
                          item.passData?.packageId ||
                          item.txnData?.packageId ||
                          {};
                        const displayStatus = item.isTxn
                          ? item.txnData.status
                          : item.passData?.isActive
                            ? "confirmed"
                            : "expired";

                        return (
                          <tr
                            key={item._id + idx}
                            onClick={() => setViewingCombinedItem(item)}
                            className='hover:bg-slate-50/80 transition-colors cursor-pointer group'>
                            <td className='py-5 px-4 md:px-6'>
                              <div className='text-[13px] font-extrabold text-gray-900 mb-0.5 whitespace-nowrap'>
                                {formatDate(item.createdAt)}
                              </div>
                              <div
                                className='text-[10px] text-gray-400 font-mono truncate max-w-[100px] md:max-w-[150px]'
                                title={
                                  item.isTxn
                                    ? item.txnData.transactionId
                                    : "Manual Assign"
                                }>
                                {item.isTxn
                                  ? item.txnData.transactionId
                                  : "Manual Assign"}
                              </div>
                            </td>

                            <td className='py-5 px-4 md:px-6 w-56'>
                              <div
                                className='text-sm font-extrabold text-gray-900 mb-2 truncate max-w-[150px] md:max-w-[180px]'
                                title={
                                  packageObj.packageName || "Unknown Package"
                                }>
                                {packageObj.packageName || "Unknown Package"}
                              </div>
                              {item.passData && (
                                <div className='w-full max-w-[140px]'>
                                  <div className='flex items-center justify-between text-[10px] font-bold mb-1.5 whitespace-nowrap'>
                                    <span
                                      className={
                                        item.passData.remainingCredits > 0
                                          ? "text-emerald-600"
                                          : "text-gray-400"
                                      }>
                                      {item.passData.remainingCredits} left
                                    </span>
                                    <span className='text-gray-400'>
                                      / {item.passData.creditsPurchased} total
                                    </span>
                                  </div>
                                  <div className='w-full bg-slate-100 rounded-full h-1.5 overflow-hidden'>
                                    <div
                                      className={`h-1.5 rounded-full transition-all duration-500 ${item.passData.remainingCredits === 0 ? "bg-slate-300" : "bg-emerald-500"}`}
                                      style={{
                                        width: `${Math.min(100, (item.passData.remainingCredits / Math.max(1, item.passData.creditsPurchased)) * 100)}%`,
                                      }}></div>
                                  </div>
                                </div>
                              )}
                              {!item.passData && item.isTxn && (
                                <div className='text-[11px] font-medium text-gray-500 mt-1 whitespace-nowrap'>
                                  {item.txnData.creditsPurchased} Credits
                                </div>
                              )}
                            </td>

                            <td className='py-5 px-4 md:px-6'>
                              {item.isTxn ? (
                                <div>
                                  <span className='font-mono font-bold text-gray-900 text-[13px] block mb-1 whitespace-nowrap'>
                                    {formatCurrency(item.txnData.totalAmount)}
                                  </span>
                                  <div className='flex items-center gap-1.5 text-[10px] font-medium text-gray-500'>
                                    <CreditCard className='w-3 h-3 text-gray-400 shrink-0' />
                                    <span
                                      className='truncate max-w-[100px] md:max-w-[150px]'
                                      title={formatPaymentMethod(
                                        item.txnData.paymentMethod,
                                        item.txnData.paymentIssuer,
                                      )}>
                                      {formatPaymentMethod(
                                        item.txnData.paymentMethod,
                                        item.txnData.paymentIssuer,
                                      )}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className='text-[11px] font-bold text-gray-400 uppercase tracking-widest'>
                                  N/A
                                </span>
                              )}
                            </td>

                            <td className='py-5 px-4 md:px-6 whitespace-nowrap'>
                              {renderStatusBadge(
                                displayStatus,
                                item.passData?.isActive,
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {combinedHistory.length === 0 && (
                        <tr>
                          <td
                            colSpan='4'
                            className='py-16 text-center text-gray-400 text-sm font-medium'>
                            No history found for this client.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {/* MOBILE LIST (Cards) */}
                  <div className='block md:hidden divide-y divide-gray-50'>
                    {combinedHistory.map((item, idx) => {
                      const packageObj =
                        item.passData?.packageId ||
                        item.txnData?.packageId ||
                        {};
                      const displayStatus = item.isTxn
                        ? item.txnData.status
                        : item.passData?.isActive
                          ? "confirmed"
                          : "expired";

                      return (
                        <div
                          key={item._id + idx}
                          onClick={() => setViewingCombinedItem(item)}
                          className='p-4 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col gap-3 group'>
                          {/* Top Row: Date/ID and Status */}
                          <div className='flex justify-between items-start'>
                            <div>
                              <div className='text-[13px] font-extrabold text-gray-900 mb-0.5'>
                                {formatDate(item.createdAt)}
                              </div>
                              <div className='text-[10px] text-gray-400 font-mono'>
                                {item.isTxn
                                  ? item.txnData.transactionId
                                  : "Manual Assign"}
                              </div>
                            </div>
                            <div>
                              {renderStatusBadge(
                                displayStatus,
                                item.passData?.isActive,
                              )}
                            </div>
                          </div>

                          {/* Middle Row: Package Info */}
                          <div>
                            <div className='text-[14px] font-extrabold text-gray-900 mb-2'>
                              {packageObj.packageName || "Unknown Package"}
                            </div>
                            {item.passData && (
                              <div className='w-full'>
                                <div className='flex items-center justify-between text-[10px] font-bold mb-1.5'>
                                  <span
                                    className={
                                      item.passData.remainingCredits > 0
                                        ? "text-emerald-600"
                                        : "text-gray-400"
                                    }>
                                    {item.passData.remainingCredits} left
                                  </span>
                                  <span className='text-gray-400'>
                                    / {item.passData.creditsPurchased} total
                                  </span>
                                </div>
                                <div className='w-full bg-slate-100 rounded-full h-1.5 overflow-hidden'>
                                  <div
                                    className={`h-1.5 rounded-full transition-all duration-500 ${item.passData.remainingCredits === 0 ? "bg-slate-300" : "bg-emerald-500"}`}
                                    style={{
                                      width: `${Math.min(100, (item.passData.remainingCredits / Math.max(1, item.passData.creditsPurchased)) * 100)}%`,
                                    }}></div>
                                </div>
                              </div>
                            )}
                            {!item.passData && item.isTxn && (
                              <div className='text-[11px] font-medium text-gray-500'>
                                {item.txnData.creditsPurchased} Credits
                              </div>
                            )}
                          </div>

                          {/* Bottom Row: Payment Info */}
                          {item.isTxn && (
                            <div className='flex items-center justify-between mt-1 pt-3 border-t border-dashed border-gray-100'>
                              <div className='flex items-center gap-1.5 text-[11px] font-medium text-gray-500'>
                                <CreditCard className='w-3.5 h-3.5 text-gray-400 shrink-0' />
                                <span className='truncate max-w-[150px]'>
                                  {formatPaymentMethod(
                                    item.txnData.paymentMethod,
                                    item.txnData.paymentIssuer,
                                  )}
                                </span>
                              </div>
                              <span className='font-mono font-bold text-gray-900 text-[13px]'>
                                {formatCurrency(item.txnData.totalAmount)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {combinedHistory.length === 0 && (
                      <div className='py-16 text-center text-gray-400 text-sm font-medium'>
                        No history found for this client.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- MODALS OVERLAYS --- */}
      <AnimatePresence>
        {showViewMedicalModal && medicalData && (
          <ViewMedicalModal
            medicalData={medicalData}
            onClose={() => setShowViewMedicalModal(false)}
            formatDate={formatDate}
          />
        )}

        {showAssignModal && !selectedClient && (
          <AssignPassModal
            onClose={() => setShowAssignModal(false)}
            onSubmit={handleAssignSubmit}
          />
        )}

        {showDirectAssignModal && selectedClient && (
          <DirectAssignPassModal
            client={selectedClient}
            onClose={() => setShowDirectAssignModal(false)}
            onSubmit={handleAssignSubmit}
          />
        )}

        {showAddMedicalModal && selectedClient && (
          <AddMedicalModal
            onClose={() => setShowAddMedicalModal(false)}
            onSubmit={handleAddMedicalSubmit}
            isLoading={loadingDetails}
          />
        )}

        {viewingCombinedItem && selectedClient && (
          <UnifiedDetailModal
            item={viewingCombinedItem}
            client={selectedClient}
            onClose={() => setViewingCombinedItem(null)}
            onDownloadInvoice={() =>
              generateInvoice(viewingCombinedItem.txnData, selectedClient)
            }
            onEditPass={() => setEditingPass(viewingCombinedItem.passData)}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            formatCurrency={formatCurrency}
            formatPaymentMethod={formatPaymentMethod}
            renderStatusBadge={renderStatusBadge}
          />
        )}

        {editingPass && (
          <EditPassModal
            pass={editingPass}
            config={config}
            onClose={() => setEditingPass(null)}
            onSubmit={() => {
              setEditingPass(null);
              fetchData();
              fetchClientDetails();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Modals Components ---

const UnifiedDetailModal = ({
  item,
  client,
  onClose,
  onDownloadInvoice,
  onEditPass,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatPaymentMethod,
  renderStatusBadge,
}) => {
  const { isTxn, txnData, passData } = item;
  const displayStatus = isTxn
    ? txnData.status
    : passData?.isActive
      ? "confirmed"
      : "expired";

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className='bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden border border-white/20 flex flex-col max-h-[90vh]'>
        <div className='px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100 flex justify-between items-center bg-white z-10'>
          <h3 className='text-lg sm:text-xl font-extrabold text-gray-900'>
            Package & Transaction Details
          </h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        <div className='overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50 p-5 sm:p-8 space-y-6'>
          {/* Header Summary */}
          <div className='text-center space-y-3 mb-4'>
            {isTxn && (
              <p className='text-[32px] sm:text-[38px] font-extrabold font-mono text-gray-900 tracking-tight leading-none'>
                {formatCurrency(txnData.totalAmount)}
              </p>
            )}
            <div className='flex justify-center mt-1'>
              {renderStatusBadge(displayStatus, passData?.isActive)}
            </div>
            {isTxn && (
              <p className='text-[11px] sm:text-[12px] text-gray-400 font-mono mt-2 tracking-wide select-all break-all px-4'>
                ID: {txnData.transactionId}
              </p>
            )}
          </div>

          {/* Pass Information Card */}
          {passData && (
            <div className='bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200/60'>
              <div className='flex items-center justify-between mb-5 border-b border-gray-100 pb-4'>
                <h4 className='text-[14px] sm:text-[15px] font-extrabold text-gray-900'>
                  Pass Configuration
                </h4>
                <button
                  onClick={onEditPass}
                  className='text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1.5'>
                  <Edit2 className='w-3 h-3' /> Edit
                </button>
              </div>

              <div className='grid grid-cols-2 gap-y-6 gap-x-4 mb-6'>
                <div>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                    Package
                  </p>
                  <p className='text-sm font-bold text-gray-900'>
                    {passData.packageId?.packageName || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                    Expiry Date
                  </p>
                  <p className='text-sm font-bold text-gray-900'>
                    {passData.expiryDate
                      ? formatDate(passData.expiryDate)
                      : "None"}
                  </p>
                </div>
                <div className='col-span-2'>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2'>
                    Credits Status
                  </p>
                  <div className='flex items-center gap-2 mb-1.5 font-medium'>
                    <span
                      className={`text-lg font-bold ${passData.remainingCredits > 0 ? "text-emerald-600" : "text-rose-500"}`}>
                      {passData.remainingCredits}
                    </span>
                    <span className='text-gray-400 text-xs'>
                      / {passData.creditsPurchased} remaining
                    </span>
                  </div>
                  <div className='w-full bg-slate-100 rounded-full h-2 overflow-hidden'>
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${passData.remainingCredits === 0 ? "bg-rose-400" : "bg-emerald-500"}`}
                      style={{
                        width: `${Math.min(100, (passData.remainingCredits / Math.max(1, passData.creditsPurchased)) * 100)}%`,
                      }}></div>
                  </div>
                </div>
              </div>

              <div className='space-y-4 pt-4 border-t border-gray-50'>
                <div>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2'>
                    Allowed Classes
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {(!passData.classType ||
                      passData.classType.length === 0) && (
                      <span className='text-[12px] text-gray-400 font-medium italic'>
                        No restrictions
                      </span>
                    )}
                    {passData.classType?.map((t) => (
                      <span
                        key={t}
                        className='px-3 py-1 bg-slate-50 text-gray-700 text-[11px] font-bold rounded-md border border-gray-200/60'>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2'>
                    Allowed Instructors
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    {(!passData.instructorType ||
                      passData.instructorType.length === 0) && (
                      <span className='text-[12px] text-gray-400 font-medium italic'>
                        No restrictions
                      </span>
                    )}
                    {passData.instructorType?.map((t) => (
                      <span
                        key={t}
                        className='px-3 py-1 bg-slate-50 text-gray-700 text-[11px] font-bold rounded-md border border-gray-200/60'>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Transaction Information Card */}
          {isTxn && (
            <div className='bg-white p-5 sm:p-6 rounded-xl shadow-sm border border-gray-200/60 space-y-4'>
              <h4 className='text-[14px] sm:text-[15px] font-extrabold text-gray-900 mb-2 border-b border-gray-100 pb-4'>
                Payment Details
              </h4>
              <div className='flex justify-between items-center'>
                <span className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest'>
                  Date
                </span>
                <span className='text-[12px] sm:text-[13px] font-bold text-gray-900'>
                  {formatDateTime(txnData.createdAt)}
                </span>
              </div>
              <div className='flex justify-between items-center'>
                <span className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest'>
                  Payment Method
                </span>
                <span
                  className='text-[12px] sm:text-[13px] font-bold text-gray-900 truncate max-w-[130px] sm:max-w-[150px]'
                  title={formatPaymentMethod(
                    txnData.paymentMethod,
                    txnData.paymentIssuer,
                  )}>
                  {formatPaymentMethod(
                    txnData.paymentMethod,
                    txnData.paymentIssuer,
                  )}
                </span>
              </div>
              {txnData.proofOfPayment &&
                txnData.proofOfPayment !== "Manual Assignment" &&
                txnData.proofOfPayment.startsWith("http") && (
                  <div className='flex justify-between items-center pt-3 mt-1 border-t border-dashed border-gray-200'>
                    <span className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest'>
                      Receipt
                    </span>
                    <a
                      href={txnData.proofOfPayment}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-[11px] sm:text-[12px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors'>
                      View Proof <ExternalLink className='w-3.5 h-3.5' />
                    </a>
                  </div>
                )}
            </div>
          )}
        </div>

        <div className='p-5 sm:p-6 border-t border-gray-100 bg-white flex gap-4 shrink-0'>
          <button
            onClick={onClose}
            className='flex-1 py-3.5 font-bold text-gray-600 bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-colors text-[14px]'>
            Close
          </button>
          {isTxn && (
            <button
              onClick={onDownloadInvoice}
              className='flex-1 py-3.5 bg-[#1a4d3e] text-white font-bold rounded-xl shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] transition-all flex justify-center items-center gap-2 text-[15px]'>
              <Download className='w-4 h-4' /> Invoice
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ViewMedicalModal = ({ medicalData, onClose, formatDate }) => (
  <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className='bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-white/20'>
      <div className='px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100/50 flex justify-between items-center bg-white'>
        <div className='flex items-center gap-3'>
          <Activity className='w-6 h-6 text-rose-500' />
          <h3 className='text-lg sm:text-xl font-extrabold text-gray-900'>
            Medical Profile
          </h3>
        </div>
        <button
          onClick={onClose}
          className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
          <X className='w-5 h-5 text-gray-500' />
        </button>
      </div>
      <div className='p-6 sm:p-8 space-y-6 bg-white overflow-y-auto max-h-[70vh] custom-scrollbar'>
        <div className='bg-[#F8FAFC] p-5 sm:p-6 rounded-2xl border border-slate-100'>
          <div className='grid grid-cols-2 gap-y-6 gap-x-4'>
            <div>
              <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                Date of Birth
              </p>
              <p className='text-[13px] sm:text-[14px] font-bold text-gray-900'>
                {medicalData.dateOfBirth
                  ? formatDate(medicalData.dateOfBirth)
                  : "—"}
              </p>
            </div>
            <div>
              <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                Sex
              </p>
              <p className='text-[13px] sm:text-[14px] font-bold text-gray-900'>
                {medicalData.sex || "—"}
              </p>
            </div>
            <div>
              <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                Occupation
              </p>
              <p className='text-[13px] sm:text-[14px] font-bold text-gray-900'>
                {medicalData.occupation || "—"}
              </p>
            </div>
            <div>
              <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                Marital Status
              </p>
              <p className='text-[13px] sm:text-[14px] font-bold text-gray-900'>
                {medicalData.maritalStatus || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className='space-y-5'>
          <div>
            <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 pl-1'>
              Physical Concerns
            </p>
            <div className='p-4 sm:p-5 bg-rose-50/50 text-rose-800 rounded-xl text-[13px] sm:text-[14px] font-medium border border-rose-100/50 leading-relaxed'>
              {medicalData.physicalConcern || "None reported."}
            </div>
          </div>

          <div>
            <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 pl-1'>
              Daily Activity
            </p>
            <div className='p-4 sm:p-5 bg-[#F8FAFC] text-gray-700 rounded-xl text-[13px] sm:text-[14px] font-medium border border-slate-100 leading-relaxed'>
              {medicalData.dailyActivity || "No details provided."}
            </div>
          </div>

          <div>
            <p className='text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 pl-1'>
              Address
            </p>
            <p className='text-[13px] sm:text-[14px] font-medium text-gray-700 leading-relaxed pl-1'>
              {medicalData.address || "—"}
            </p>
          </div>
        </div>
      </div>
      <div className='p-5 sm:p-6 pt-2 bg-white'>
        <button
          onClick={onClose}
          className='w-full py-3.5 sm:py-4 text-gray-700 font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200/60 rounded-xl transition-colors text-[13px] sm:text-[14px]'>
          Close Details
        </button>
      </div>
    </motion.div>
  </div>
);

const EditPassModal = ({ pass, config, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    remainingCredits: pass.remainingCredits || 0,
    expiryDate: pass.expiryDate ? pass.expiryDate.split("T")[0] : "",
    instructorType: Array.isArray(pass.instructorType)
      ? pass.instructorType
      : [],
    classType: Array.isArray(pass.classType) ? pass.classType : [],
  });
  const [isLoading, setIsLoading] = useState(false);

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
      if (currentArray.includes(value))
        return {
          ...prev,
          [field]: currentArray.filter((item) => item !== value),
        };
      return { ...prev, [field]: [...currentArray, value] };
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

  const SelectionItem = ({ label, isSelected, onClick }) => (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 shadow-sm ${isSelected ? "border-emerald-500 bg-emerald-50/30" : "border-gray-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/10"}`}>
      <div
        className={`w-5 h-5 shrink-0 rounded-[6px] flex items-center justify-center transition-colors border ${isSelected ? "bg-emerald-500 border-emerald-500" : "bg-white border-gray-300"}`}>
        {isSelected && (
          <Check size={14} className='text-white' strokeWidth={4} />
        )}
      </div>
      <span
        className={`text-[12px] sm:text-[13px] font-bold ${isSelected ? "text-emerald-900" : "text-gray-600"}`}>
        {label}
      </span>
    </div>
  );

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/20'>
        <div className='px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100 bg-white flex justify-between items-center'>
          <h3 className='text-lg sm:text-xl font-extrabold text-gray-900'>
            Edit Pass Details
          </h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <form
          onSubmit={handleSave}
          className='flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 sm:space-y-8 custom-scrollbar bg-slate-50/30'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6'>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Remaining Credits
              </label>
              <input
                type='number'
                value={formData.remainingCredits}
                onChange={(e) =>
                  setFormData({ ...formData, remainingCredits: e.target.value })
                }
                className='w-full p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl text-base sm:text-lg font-mono font-bold text-gray-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
              />
            </div>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Expiry Date
              </label>
              <div className='relative group'>
                <input
                  type='date'
                  value={formData.expiryDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expiryDate: e.target.value })
                  }
                  className='w-full p-3.5 sm:p-4 bg-white border border-gray-200 rounded-xl text-[14px] sm:text-[15px] font-bold text-gray-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none relative z-10'
                />
                <CalendarIcon className='absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-0 pointer-events-none group-focus-within:text-emerald-600 transition-colors' />
              </div>
            </div>
          </div>
          <hr className='border-gray-100' />
          <div>
            <p className='text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1'>
              Allowed Class Types
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
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
          <div>
            <p className='text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1'>
              Allowed Instructors
            </p>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
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
        <div className='p-5 sm:p-6 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 py-3.5 sm:py-4 text-gray-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-[14px] sm:text-[15px] border border-transparent'>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className='flex-1 py-3.5 sm:py-4 bg-emerald-900 text-white font-bold rounded-xl shadow-[0_4px_14px_-4px_rgba(6,78,59,0.3)] hover:bg-emerald-800 transition-all text-[14px] sm:text-[15px] disabled:opacity-50 disabled:shadow-none'>
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const DirectAssignPassModal = ({ client, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [packages, setPackages] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [formData, setFormData] = useState({
    userId: client._id,
    packageId: "",
    paymentIssuer: "",
    totalAmount: "",
    isNewClient: false,
  });

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await axiosInstance.get(
          API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(user.adminStudioLocation),
        );
        setPackages(res.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoadingData(false);
      }
    };
    fetchPackages();
  }, [user.adminStudioLocation]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };
  const isFormValid = formData.packageId && formData.paymentIssuer;

  // Filter packages based on client's student status
  const filteredPackages = packages.filter(
    (p) => !!p.isStudent === !!client.isStudent,
  );

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white w-full max-w-xl rounded-2xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-white/20 custom-scrollbar'>
        <div className='flex justify-between items-start mb-6 sm:mb-8'>
          <div>
            <h2 className='text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight mb-1'>
              Assign Pass
            </h2>
            <p className='text-xs sm:text-sm text-gray-500 font-medium'>
              Assigning package directly to{" "}
              <span className='font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md'>
                {client.fullName}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-5 sm:space-y-6'>
          <div>
            <CustomSelect
              label='Select Package'
              options={filteredPackages}
              placeholder={isLoadingData ? "Loading..." : "Choose a package"}
              getLabel={(p) =>
                `${p.packageName || "Unknown"} (${p.credits || 0} Credits) - ${parseInt(p.packagePrice || 0).toLocaleString()} IDR`
              }
              getValue={(p) => p._id}
              value={formData.packageId}
              onChange={(val) => {
                const pkg = filteredPackages.find((p) => p._id === val);
                setFormData({
                  ...formData,
                  packageId: val,
                  totalAmount: pkg?.packagePrice || 0,
                });
              }}
            />
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5'>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Price (IDR)
              </label>
              <input
                type='number'
                disabled
                value={formData.totalAmount}
                className='w-full p-3.5 bg-slate-50 text-gray-500 rounded-xl border border-gray-200 font-mono font-bold text-sm'
              />
            </div>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Payment Method
              </label>
              <input
                type='text'
                placeholder='e.g. Cash, BCA, QRIS'
                value={formData.paymentIssuer}
                onChange={(e) =>
                  setFormData({ ...formData, paymentIssuer: e.target.value })
                }
                className='w-full p-3.5 bg-white rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium text-sm'
              />
            </div>
          </div>
          <button
            type='submit'
            disabled={!isFormValid}
            className='w-full py-3.5 sm:py-4 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-[0_4px_14px_-4px_rgba(6,78,59,0.3)] disabled:opacity-50 disabled:shadow-none mt-2 text-[14px] sm:text-[15px]'>
            Confirm Assignment
          </button>
        </form>
      </motion.div>
    </div>
  );
};

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
    newClientData: { fullName: "", email: "", phone: "", isStudent: false },
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
        setUsers(u.data || []);
        setPackages(p.data || []);
      } catch (err) {
        console.error(err);
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

  // Dynamic filter based on selected user status
  const isSelectedStudent =
    activeTab === "existing"
      ? !!users.find((u) => u._id === formData.userId)?.isStudent
      : formData.newClientData.isStudent;

  const filteredPackages = packages.filter(
    (p) => !!p.isStudent === isSelectedStudent,
  );

  return (
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white w-full max-w-xl rounded-2xl p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto border border-white/20 custom-scrollbar'>
        <div className='flex justify-between items-start mb-6'>
          <div>
            <h2 className='text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight'>
              Assign Pass
            </h2>
            <p className='text-xs sm:text-sm font-medium text-gray-500 mt-1'>
              Select a user and assign a new pass package
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <div className='flex p-1.5 bg-slate-100/80 rounded-xl mb-6 sm:mb-8 border border-slate-200/50'>
          <button
            type='button'
            onClick={() => {
              setActiveTab("existing");
              setFormData({ ...formData, packageId: "", totalAmount: "" });
            }}
            className={`flex-1 py-2.5 sm:py-3 text-[12px] sm:text-[13px] font-bold rounded-lg transition-all ${activeTab === "existing" ? "bg-white shadow-sm text-emerald-900 border border-black/5" : "text-gray-500 hover:text-gray-700"}`}>
            Existing Client
          </button>
          <button
            type='button'
            onClick={() => {
              setActiveTab("new");
              setFormData({ ...formData, packageId: "", totalAmount: "" });
            }}
            className={`flex-1 py-2.5 sm:py-3 text-[12px] sm:text-[13px] font-bold rounded-lg transition-all ${activeTab === "new" ? "bg-white shadow-sm text-emerald-900 border border-black/5" : "text-gray-500 hover:text-gray-700"}`}>
            New Client
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-5 sm:space-y-6'>
          <div className='pb-5 border-b border-gray-100'>
            {activeTab === "existing" ? (
              <CustomSelect
                label='Select Client'
                options={users}
                searchable
                placeholder={isLoadingData ? "Loading..." : "Search by name..."}
                getLabel={(u) =>
                  `${u.fullName || "Unknown"} (${u.email || "No email"})`
                }
                getValue={(u) => u._id}
                value={formData.userId}
                onChange={(val) =>
                  setFormData({
                    ...formData,
                    userId: val,
                    packageId: "",
                    totalAmount: "",
                  })
                }
              />
            ) : (
              <div className='space-y-4 sm:space-y-5 bg-slate-50/50 p-5 sm:p-6 rounded-2xl border border-slate-100'>
                <p className='text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-widest'>
                  New Client Details
                </p>
                <input
                  name='fullName'
                  placeholder='Full Name'
                  className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
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
                  className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
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
                  className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
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
                <div className='flex items-center justify-between p-3.5 bg-white border border-gray-200 rounded-xl shadow-sm mt-2'>
                  <span className='text-sm font-medium text-gray-600'>
                    Is this client a student?
                  </span>
                  <button
                    type='button'
                    onClick={() =>
                      setFormData({
                        ...formData,
                        packageId: "",
                        totalAmount: "",
                        newClientData: {
                          ...formData.newClientData,
                          isStudent: !formData.newClientData.isStudent,
                        },
                      })
                    }
                    className={`w-10 h-6 rounded-full p-1 transition-colors ${formData.newClientData.isStudent ? "bg-emerald-500" : "bg-slate-300"}`}>
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${formData.newClientData.isStudent ? "translate-x-4" : "translate-x-0"}`}
                    />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <CustomSelect
              label='Select Package'
              options={filteredPackages}
              placeholder={isLoadingData ? "Loading..." : "Choose a package"}
              getLabel={(p) =>
                `${p.packageName || "Unknown"} (${p.credits || 0} Credits) - ${parseInt(p.packagePrice || 0).toLocaleString()} IDR`
              }
              getValue={(p) => p._id}
              value={formData.packageId}
              onChange={(val) => {
                const pkg = filteredPackages.find((p) => p._id === val);
                setFormData({
                  ...formData,
                  packageId: val,
                  totalAmount: pkg?.packagePrice || 0,
                });
              }}
            />
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5'>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Price (IDR)
              </label>
              <input
                type='number'
                disabled
                value={formData.totalAmount}
                className='w-full p-3.5 bg-slate-50 text-gray-500 rounded-xl border border-gray-200 font-mono font-bold text-sm'
              />
            </div>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2 pl-1'>
                Payment Method
              </label>
              <input
                type='text'
                placeholder='e.g. Cash, BCA, QRIS'
                value={formData.paymentIssuer}
                onChange={(e) =>
                  setFormData({ ...formData, paymentIssuer: e.target.value })
                }
                className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
              />
            </div>
          </div>
          <button
            type='submit'
            disabled={!isFormValid}
            className='w-full py-3.5 sm:py-4 bg-emerald-900 text-white font-bold rounded-xl shadow-[0_4px_14px_-4px_rgba(6,78,59,0.3)] hover:bg-emerald-800 transition-all text-[14px] sm:text-[15px] disabled:opacity-50 disabled:shadow-none mt-2'>
            Confirm Assignment
          </button>
        </form>
      </motion.div>
    </div>
  );
};

const AddMedicalModal = ({ onClose, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    dateOfBirth: "",
    sex: "",
    occupation: "",
    maritalStatus: "",
    physicalConcern: "",
    dailyActivity: "",
    address: "",
  });
  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-white/20'>
        <div className='px-6 sm:px-8 py-5 sm:py-6 border-b border-gray-100 bg-white flex justify-between items-center'>
          <h3 className='text-lg sm:text-xl font-extrabold text-gray-900'>
            Add Medical Record
          </h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100 transition-colors'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className='flex-1 overflow-y-auto p-5 sm:p-8 space-y-5 custom-scrollbar bg-slate-50/30'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5'>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
                Date of Birth
              </label>
              <input
                type='date'
                required
                value={formData.dateOfBirth}
                onChange={(e) =>
                  setFormData({ ...formData, dateOfBirth: e.target.value })
                }
                className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
              />
            </div>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
                Sex
              </label>
              <select
                required
                value={formData.sex}
                onChange={(e) =>
                  setFormData({ ...formData, sex: e.target.value })
                }
                className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none'>
                <option value='' disabled>
                  Select Sex
                </option>
                <option value='Male'>Male</option>
                <option value='Female'>Female</option>
              </select>
            </div>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5'>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
                Occupation
              </label>
              <input
                type='text'
                required
                placeholder='e.g. Graphic Designer'
                value={formData.occupation}
                onChange={(e) =>
                  setFormData({ ...formData, occupation: e.target.value })
                }
                className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
              />
            </div>
            <div>
              <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
                Marital Status
              </label>
              <select
                required
                value={formData.maritalStatus}
                onChange={(e) =>
                  setFormData({ ...formData, maritalStatus: e.target.value })
                }
                className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none'>
                <option value='' disabled>
                  Select Status
                </option>
                <option value='Single'>Single</option>
                <option value='Married'>Married</option>
              </select>
            </div>
          </div>
          <div>
            <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
              Physical Concerns
            </label>
            <textarea
              rows='2'
              placeholder='e.g. Shoulder pain, stiff neck...'
              value={formData.physicalConcern}
              onChange={(e) =>
                setFormData({ ...formData, physicalConcern: e.target.value })
              }
              className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm resize-none'
            />
          </div>
          <div>
            <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
              Daily Activity
            </label>
            <textarea
              rows='2'
              placeholder='e.g. Sedentary work, mostly sitting...'
              value={formData.dailyActivity}
              onChange={(e) =>
                setFormData({ ...formData, dailyActivity: e.target.value })
              }
              className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm resize-none'
            />
          </div>
          <div>
            <label className='block text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2'>
              Address
            </label>
            <textarea
              rows='2'
              placeholder='Full Address'
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
              className='w-full p-3.5 bg-white border border-gray-200 rounded-xl text-sm font-medium outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm resize-none'
            />
          </div>
        </form>
        <div className='p-5 sm:p-6 border-t border-gray-100 bg-white flex flex-col sm:flex-row gap-3 sm:gap-4'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 py-3.5 sm:py-4 text-gray-600 font-bold hover:bg-slate-100 rounded-xl transition-colors text-[14px] sm:text-[15px] border border-transparent'>
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className='flex-1 py-3.5 sm:py-4 bg-emerald-900 text-white font-bold rounded-xl shadow-[0_4px_14px_-4px_rgba(6,78,59,0.3)] hover:bg-emerald-800 transition-all text-[14px] sm:text-[15px] disabled:opacity-50 disabled:shadow-none'>
            {isLoading ? "Saving..." : "Save Record"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ClientManager;
