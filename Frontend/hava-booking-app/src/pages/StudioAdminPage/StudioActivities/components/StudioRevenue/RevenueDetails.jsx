import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Lock,
  Wallet,
  CreditCard,
  TrendingUp,
  Users,
  ChevronDown,
  Check,
  FileText,
  FileSpreadsheet,
  X,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  TrendingDown,
  RefreshCw,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axiosInstance from "../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../context/AuthContext";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { API_PATHS } from "../../../../../utils/apiPath";

// --- Custom Select Component ---
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select option",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

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

  return (
    <div className='relative w-full' ref={containerRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10.5 px-4 rounded-xl border bg-white flex items-center justify-between transition-all outline-none text-sm font-medium shadow-sm ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span
          className={`block truncate ${
            value ? "text-gray-900" : "text-gray-400"
          }`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto'>
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                  value === option
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-emerald-800"
                }`}>
                {option}
                {value === option && (
                  <Check className='w-3.5 h-3.5 text-emerald-600' />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Helper: Currency Formatter ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// --- Sub-Component: Password Gate ---
const PasswordGate = ({ onUnlock, error, setError }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError("");

    try {
      const response = await axiosInstance.post(
        API_PATHS.AUTH.VERIFY_PASSWORD,
        {
          email: user.email,
          password: password,
        },
      );
      if (response.data.success || response.status === 200) {
        onUnlock();
      }
    } catch (err) {
      if (err.response && err.response.status === 401) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className='flex flex-col items-center justify-center h-[60vh] text-center p-6'>
      <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-md w-full'>
        <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6'>
          <Lock className='w-8 h-8 text-emerald-600' />
        </div>
        <h2 className='text-xl font-bold text-gray-900 mb-2'>
          Restricted Access
        </h2>
        <p className='text-gray-500 mb-6 text-sm'>
          To view sensitive revenue data, please confirm your admin password.
        </p>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <input
            type='password'
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder='Enter Admin Password'
            className='w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all'
            autoFocus
          />
          {error && <p className='text-red-500 text-xs'>{error}</p>}
          <button
            disabled={verifying}
            type='submit'
            className='w-full py-3 bg-emerald-900 text-white rounded-xl font-semibold hover:bg-emerald-800 transition-colors flex justify-center items-center gap-2'>
            {verifying ? "Verifying..." : "Unlock Revenue Data"}
          </button>
        </form>
      </div>
    </div>
  );
};

// --- Modals (Transaction & Client List) ---
const TransactionDetailsModal = ({ transaction, onClose }) => {
  if (!transaction) return null;
  const isConfirmed = transaction.status === "confirmed";
  const isPending =
    transaction.status === "pending" ||
    transaction.status === "waiting_confirmation";

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50'>
          <div>
            <h3 className='text-lg font-bold text-gray-900'>
              Transaction Details
            </h3>
            <p className='text-xs text-gray-500 font-mono mt-1'>
              {transaction.transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-200 transition-colors'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='p-6 space-y-6'>
          <div
            className={`flex items-center gap-3 p-4 rounded-xl border ${
              isConfirmed
                ? "bg-emerald-50 border-emerald-100"
                : isPending
                  ? "bg-amber-50 border-amber-100"
                  : "bg-red-50 border-red-100"
            }`}>
            <div
              className={`p-2 rounded-full ${
                isConfirmed
                  ? "bg-emerald-100 text-emerald-600"
                  : isPending
                    ? "bg-amber-100 text-amber-600"
                    : "bg-red-100 text-red-600"
              }`}>
              {isConfirmed ? (
                <CheckCircle2 className='w-5 h-5' />
              ) : isPending ? (
                <Clock className='w-5 h-5' />
              ) : (
                <AlertCircle className='w-5 h-5' />
              )}
            </div>
            <div>
              <p className='text-sm font-bold text-gray-900'>
                Payment{" "}
                {transaction.status === "confirmed"
                  ? "Successful"
                  : transaction.status}
              </p>
              <p className='text-xs text-gray-500'>
                Processed via {transaction.paymentIssuer || "Others"}
              </p>
            </div>
            <div className='ml-auto text-right'>
              <p className='text-lg font-bold text-gray-900'>
                {formatCurrency(transaction.totalAmount)}
              </p>
            </div>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='p-3 bg-gray-50 rounded-xl border border-gray-100'>
              <span className='text-xs text-gray-500 flex items-center gap-1 mb-1'>
                <User className='w-3 h-3' /> Customer
              </span>
              <p className='text-sm font-bold text-gray-900'>
                {transaction.userId?.fullName}
              </p>
              <p className='text-xs text-gray-400'>
                {transaction.userId?.email}
              </p>
            </div>
            <div className='p-3 bg-gray-50 rounded-xl border border-gray-100'>
              <span className='text-xs text-gray-500 flex items-center gap-1 mb-1'>
                <CreditCard className='w-3 h-3' /> Package
              </span>
              <p className='text-sm font-bold text-gray-900'>
                {transaction.packageId?.packageName}
              </p>
              <p className='text-xs text-gray-400'>
                {transaction.creditsPurchased} Credits
              </p>
            </div>
            <div className='p-3 bg-gray-50 rounded-xl border border-gray-100'>
              <span className='text-xs text-gray-500 flex items-center gap-1 mb-1'>
                <Calendar className='w-3 h-3' /> Date
              </span>
              <p className='text-sm font-bold text-gray-900'>
                {new Date(transaction.createdAt).toLocaleDateString()}
              </p>
              <p className='text-xs text-gray-400'>
                {new Date(transaction.createdAt).toLocaleTimeString()}
              </p>
            </div>
            <div className='p-3 bg-gray-50 rounded-xl border border-gray-100'>
              <span className='text-xs text-gray-500 flex items-center gap-1 mb-1'>
                <Wallet className='w-3 h-3' /> Method
              </span>
              <p className='text-sm font-bold text-gray-900 capitalize'>
                {transaction.paymentMethod?.replace(/_/g, " ")}
              </p>
              <p className='text-xs text-gray-400'>
                {transaction.paymentIssuer}
              </p>
            </div>
          </div>
        </div>
        <div className='p-4 border-t border-gray-100 bg-gray-50 flex justify-end'>
          <button
            onClick={onClose}
            className='px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl shadow-sm hover:bg-gray-50'>
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const ClientListModal = ({ clients, onClose }) => {
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50'>
          <h3 className='text-lg font-bold text-gray-900'>
            Paying Clients{" "}
            <span className='text-sm font-normal text-gray-500 ml-1'>
              ({clients.length})
            </span>
          </h3>
          <button onClick={onClose}>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>
        <div className='overflow-y-auto flex-1 p-0'>
          {clients.map((client, idx) => (
            <div
              key={idx}
              className='flex items-center gap-3 p-4 border-b border-gray-50 hover:bg-gray-50 transition-colors'>
              <div className='w-10 h-10 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm'>
                {client.fullName?.charAt(0)}
              </div>
              <div>
                <p className='text-sm font-bold text-gray-900'>
                  {client.fullName}
                </p>
                <p className='text-xs text-gray-500'>{client.email}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

const RevenueDetails = () => {
  const { user } = useAuth();

  // -- State --
  const [isLocked, setIsLocked] = useState(true);
  const [passwordError, setPasswordError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // -- Interactive States --
  const [methodFilter, setMethodFilter] = useState("All");
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [showClientList, setShowClientList] = useState(false);

  // -- Preview State --
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // -- Options Logic --
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  // Generate last 5 years
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => currentYear - i);
  }, []);

  const availableMonths = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonthIdx = now.getMonth();

    if (selectedYear === currentYear) {
      return monthNames.slice(0, currentMonthIdx + 1);
    }
    return monthNames;
  }, [selectedYear]);

  // -- Effect: Reset Month if Invalid --
  useEffect(() => {
    // If selected month is not in available months (e.g. switch 2025 Dec -> 2026)
    if (selectedMonth >= availableMonths.length) {
      setSelectedMonth(availableMonths.length - 1); // Set to latest available (e.g. January)
    }
  }, [selectedYear, availableMonths]);

  // -- Data Fetching --
  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get(
        API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation),
      );
      setTransactions(response.data);
    } catch (error) {
      console.error("Failed to fetch revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLocked) {
      fetchRevenueData();
    }
  }, [isLocked, user.adminStudioLocation]);

  // -- Computations --
  const { stats, tableData } = useMemo(() => {
    // 1. ISOLATE STATS DATA
    const currentMonthTransactions = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return (
        d.getMonth() === selectedMonth &&
        d.getFullYear() === selectedYear &&
        t.status === "confirmed"
      );
    });

    const prevMonthDate = new Date(selectedYear, selectedMonth - 1);
    const prevMonthTransactions = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return (
        d.getMonth() === prevMonthDate.getMonth() &&
        d.getFullYear() === prevMonthDate.getFullYear() &&
        t.status === "confirmed"
      );
    });

    const totalRevenue = currentMonthTransactions.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0,
    );
    const prevRevenue = prevMonthTransactions.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0,
    );

    let growthPercent = 0;
    if (prevRevenue > 0) {
      growthPercent = ((totalRevenue - prevRevenue) / prevRevenue) * 100;
    } else if (totalRevenue > 0) {
      growthPercent = 100;
    }

    const uniqueClientsList = Array.from(
      new Map(
        currentMonthTransactions.map((item) => [
          item.userId["_id"],
          item.userId,
        ]),
      ).values(),
    );

    const methodStats = currentMonthTransactions.reduce(
      (acc, curr) => {
        let key = "Others";
        if (curr.paymentMethod === "pay_at_studio") key = "Pay at Studio";
        else if (curr.paymentMethod === "manual_transfer") key = "Transfer";
        else if (curr.paymentMethod === "QRIS" || curr.paymentMethod === "qris")
          key = "QRIS";

        acc[key] = (acc[key] || 0) + curr.totalAmount;
        return acc;
      },
      { "Pay at Studio": 0, Transfer: 0, QRIS: 0 },
    );

    const breakdown = Object.keys(methodStats).map((key) => ({
      name: key,
      amount: methodStats[key],
      percentage:
        totalRevenue === 0
          ? 0
          : Math.round((methodStats[key] / totalRevenue) * 100),
      color:
        key === "Pay at Studio"
          ? "bg-emerald-500"
          : key === "Transfer"
            ? "bg-blue-500"
            : "bg-purple-500",
    }));

    // 2. ISOLATE TABLE DATA
    let filteredList = currentMonthTransactions.filter((t) => {
      const clean = (str) => (str || "").toLowerCase();
      const query = clean(searchQuery);
      const isSearchMatch =
        clean(t.userId?.fullName).includes(query) ||
        clean(t.transactionId).includes(query) ||
        clean(t.packageId?.packageName).includes(query) ||
        clean(t.paymentIssuer).includes(query);

      let isMethodMatch = true;
      if (methodFilter !== "All") {
        if (methodFilter === "Pay at Studio")
          isMethodMatch = t.paymentMethod === "pay_at_studio";
        else if (methodFilter === "Transfer")
          isMethodMatch = t.paymentMethod === "manual_transfer";
        else if (methodFilter === "QRIS")
          isMethodMatch = t.paymentMethod.toLowerCase().includes("qris");
      }

      return isSearchMatch && isMethodMatch;
    });

    return {
      stats: {
        totalRevenue,
        prevRevenue,
        growthPercent,
        totalTransactions: currentMonthTransactions.length,
        uniqueClientsList,
        breakdown,
      },
      tableData: filteredList,
    };
  }, [transactions, selectedMonth, selectedYear, methodFilter, searchQuery]);

  // -- PDF Generator --
  const generatePDF = () => {
    const doc = new jsPDF();
    const monthName = new Date(selectedYear, selectedMonth).toLocaleString(
      "default",
      { month: "long", year: "numeric" },
    );

    doc.setFontSize(18);
    doc.text("Studio Revenue Report", 14, 20);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Period: ${monthName}`, 14, 28);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 34);

    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 40, 180, 20, 3, 3, "FD");

    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text("Total Revenue", 20, 52);
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(stats.totalRevenue), 50, 52);

    let yPos = 70;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Revenue Breakdown", 14, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    stats.breakdown.forEach((b) => {
      if (b.amount >= 0) {
        doc.text(`• ${b.name}:`, 20, yPos);
        doc.text(`${formatCurrency(b.amount)}`, 70, yPos);
        doc.setTextColor(100);
        doc.text(`(${b.percentage}%)`, 110, yPos);
        doc.setTextColor(0);
        yPos += 6;
      }
    });

    const tableColumn = ["Date", "Client", "Package", "Method", "Amount"];
    const tableRows = tableData.map((t) => [
      new Date(t.createdAt).toLocaleDateString(),
      t.userId?.fullName || "Unknown",
      t.packageId?.packageName || "Unknown",
      t.paymentMethod.replace(/_/g, " "),
      formatCurrency(t.totalAmount),
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: yPos + 10,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 9 },
    });

    return doc;
  };

  const handlePreview = () => {
    if (tableData.length === 0) return;
    const doc = generatePDF();
    const blob = doc.output("bloburl");
    setPdfUrl(blob);
    setShowPdfPreview(true);
    setIsExportOpen(false);
  };

  const handleDownloadPDF = () => {
    const doc = generatePDF();
    doc.save(`Revenue_Report_${selectedMonth + 1}_${selectedYear}.pdf`);
  };

  const exportCSV = () => {
    if (tableData.length === 0) return;
    const headers = [
      "Date",
      "Transaction ID",
      "Customer Name",
      "Package",
      "Payment Method",
      "Issuer",
      "Amount",
      "Status",
    ];
    const rows = tableData.map((t) => [
      new Date(t.createdAt).toLocaleDateString(),
      t.transactionId,
      t.userId?.fullName || "Unknown",
      t.packageId?.packageName || "Unknown",
      t.paymentMethod,
      t.paymentIssuer,
      t.totalAmount,
      t.status,
    ]);
    const csvContent = [
      headers.join(","),
      ...rows.map((r) => r.join(",")),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Revenue_Report_${selectedMonth + 1}_${selectedYear}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setIsExportOpen(false);
  };

  if (isLocked)
    return (
      <PasswordGate
        onUnlock={() => setIsLocked(false)}
        error={passwordError}
        setError={setPasswordError}
      />
    );
  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen relative'>
      {/* Header & Controls */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search transactions...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
          />
        </div>

        <div className='flex gap-3 items-center'>
          {/* Year Select (New) */}
          <div className='w-28'>
            <CustomSelect
              value={selectedYear}
              onChange={(val) => setSelectedYear(val)}
              options={yearOptions}
            />
          </div>

          {/* Month Select (Smart) */}
          <div className='w-36'>
            <CustomSelect
              value={monthNames[selectedMonth]}
              onChange={(val) => setSelectedMonth(monthNames.indexOf(val))}
              options={availableMonths}
            />
          </div>

          <div className='relative'>
            <button
              onClick={() => setIsExportOpen(!isExportOpen)}
              className='flex items-center gap-2 bg-emerald-900 text-white border border-emerald-900 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-sm hover:bg-emerald-800 transition-colors'>
              <Download className='w-4 h-4' /> Export
            </button>
            {isExportOpen && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 5 }}
                className='absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-20'>
                <button
                  onClick={exportCSV}
                  className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2'>
                  <FileSpreadsheet className='w-4 h-4 text-green-600' />{" "}
                  Download CSV
                </button>
                <button
                  onClick={handlePreview}
                  className='w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50'>
                  <FileText className='w-4 h-4 text-red-600' /> Preview PDF
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-8'>
        {/* Card 1: Total Revenue */}
        <div className='bg-emerald-900 text-white p-6 rounded-2xl shadow-lg relative overflow-hidden'>
          <div className='relative z-10'>
            <p className='text-emerald-200 text-sm font-medium mb-1'>
              Total Revenue (Confirmed)
            </p>
            <h3 className='text-3xl font-bold'>
              {formatCurrency(stats.totalRevenue)}
            </h3>

            <div className='flex items-center gap-2 mt-3'>
              {stats.growthPercent > 0 ? (
                <span className='flex items-center gap-1 text-emerald-300 text-xs font-bold bg-emerald-800/50 px-2 py-1 rounded-lg'>
                  <TrendingUp className='w-3 h-3' /> +
                  {stats.growthPercent.toFixed(1)}%
                </span>
              ) : stats.growthPercent < 0 ? (
                <span className='flex items-center gap-1 text-red-300 text-xs font-bold bg-red-800/50 px-2 py-1 rounded-lg'>
                  <TrendingDown className='w-3 h-3' />{" "}
                  {stats.growthPercent.toFixed(1)}%
                </span>
              ) : (
                <span className='text-gray-400 text-xs bg-gray-800/50 px-2 py-1 rounded-lg'>
                  No change
                </span>
              )}
              <span className='text-white text-xs'>vs last month</span>
            </div>
          </div>
          <Wallet className='absolute right-4 bottom-4 w-24 h-24 text-white' />
        </div>

        {/* Card 2: Transactions */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center'>
          <div className='flex items-center gap-4 mb-4'>
            <div className='p-3 bg-blue-50 text-blue-600 rounded-lg'>
              <TrendingUp className='w-6 h-6' />
            </div>
            <div>
              <p className='text-gray-500 text-xs uppercase tracking-wider font-semibold'>
                Transactions
              </p>
              <p className='text-xl font-bold text-gray-900'>
                {stats.totalTransactions}{" "}
                <span className='text-sm font-normal text-gray-400'>
                  orders
                </span>
              </p>
            </div>
          </div>
          <div className='h-px bg-gray-100 w-full mb-4'></div>
          <motion.div
            onClick={() => setShowClientList(true)}
            className='flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 -mx-2 rounded-lg transition-colors'>
            <div className='p-3 bg-purple-50 text-purple-600 rounded-lg'>
              <Users className='w-6 h-6' />
            </div>
            <div>
              <p className='text-gray-500 text-xs uppercase tracking-wider font-semibold'>
                Paying Clients
              </p>
              <p className='text-xl font-bold text-gray-900'>
                {stats.uniqueClientsList.length}{" "}
                <span className='text-sm font-normal text-gray-400'>
                  people
                </span>
              </p>
            </div>
          </motion.div>
        </div>

        {/* Card 3: Payment Breakdown */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <div className='flex justify-between items-center mb-4'>
            <h4 className='text-gray-900 font-bold flex items-center gap-2'>
              <CreditCard className='w-4 h-4 text-gray-400' /> Payment Methods
            </h4>
            {methodFilter !== "All" && (
              <button
                onClick={() => setMethodFilter("All")}
                className='flex items-center gap-1 text-[10px] font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-md transition-colors'>
                <RefreshCw className='w-3 h-3' /> Clear
              </button>
            )}
          </div>

          <div className='flex flex-col gap-2'>
            {stats.breakdown.map((item) => (
              <motion.div
                key={item.name}
                whileHover={{ scale: 1.02 }}
                onClick={() => setMethodFilter(item.name)}
                className={`cursor-pointer rounded-lg p-2 transition-colors border ${
                  methodFilter === item.name
                    ? "bg-gray-50 border-emerald-200 ring-1 ring-emerald-500"
                    : "bg-white border-transparent hover:bg-gray-50"
                }`}>
                <div className='flex justify-between text-sm mb-1'>
                  <span className='text-gray-600'>{item.name}</span>
                  <span className='font-semibold text-gray-900'>
                    {item.percentage}%
                  </span>
                </div>
                <div className='w-full bg-gray-100 rounded-full h-2 overflow-hidden'>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    className={`h-full rounded-full ${item.color}`}
                  />
                </div>
                <p className='text-xs text-right text-gray-400 mt-1'>
                  {formatCurrency(item.amount)}
                </p>
              </motion.div>
            ))}
            {stats.totalRevenue === 0 && (
              <p className='text-sm text-gray-400 italic'>
                No confirmed revenue.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Transaction List */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50'>
          <h3 className='font-bold text-gray-800'>Transaction History</h3>
          <span className='text-xs font-medium px-2 py-1 bg-gray-200 rounded-md text-gray-600'>
            {new Date(selectedYear, selectedMonth).toLocaleString("default", {
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 bg-gray-50/30'>
                <th className='px-6 py-4 font-semibold'>Date</th>
                <th className='px-6 py-4 font-semibold'>Client</th>
                <th className='px-6 py-4 font-semibold'>Package</th>
                <th className='px-6 py-4 font-semibold'>Method</th>
                <th className='px-6 py-4 font-semibold text-right'>Amount</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              <AnimatePresence>
                {tableData.length > 0 ? (
                  tableData.map((trx, index) => (
                    <motion.tr
                      key={trx._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedTransaction(trx)}
                      className='hover:bg-emerald-50/50 transition-colors cursor-pointer group'>
                      <td className='px-6 py-4 text-sm text-gray-600 whitespace-nowrap'>
                        <div className='flex flex-col'>
                          <span className='font-medium text-gray-900'>
                            {new Date(trx.createdAt).toLocaleDateString(
                              "en-GB",
                              { day: "numeric", month: "short" },
                            )}
                          </span>
                          <span className='text-xs text-gray-400'>
                            {new Date(trx.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>
                      <td className='px-6 py-4 text-sm'>
                        <div className='font-medium text-gray-900'>
                          {trx.userId?.fullName}
                        </div>
                        <div className='text-xs text-gray-400 font-mono'>
                          {trx.transactionId}
                        </div>
                      </td>
                      <td className='px-6 py-4 text-sm text-gray-600'>
                        <span className='px-2 py-1 bg-emerald-50 text-emerald-700 rounded-md text-xs font-medium border border-emerald-100'>
                          {trx.packageId?.packageName}
                        </span>
                      </td>
                      <td className='px-6 py-4 text-sm text-gray-600'>
                        <div className='flex items-center gap-2'>
                          <span
                            className={`w-2 h-2 rounded-full ${
                              trx.paymentMethod === "pay_at_studio"
                                ? "bg-emerald-400"
                                : trx.paymentMethod === "manual_transfer"
                                  ? "bg-blue-400"
                                  : "bg-purple-400"
                            }`}></span>
                          <span className='capitalize'>
                            {trx.paymentMethod?.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className='text-xs text-gray-400 pl-4'>
                          {trx.paymentIssuer}
                        </div>
                      </td>
                      <td className='px-6 py-4 text-right'>
                        <div className='font-bold text-gray-900'>
                          {formatCurrency(trx.totalAmount)}
                        </div>
                        <div className='text-xs text-emerald-600 font-medium bg-emerald-50 inline-block px-2 rounded-full mt-1'>
                          Confirmed
                        </div>
                      </td>
                    </motion.tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan='5'
                      className='px-6 py-12 text-center text-gray-400'>
                      No confirmed transactions found matching criteria.
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
        {showPdfPreview && pdfUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md'>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col'>
              <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
                <h2 className='text-lg font-bold text-gray-900'>
                  Report Preview
                </h2>
                <div className='flex gap-2'>
                  <button
                    onClick={handleDownloadPDF}
                    className='px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex gap-2 items-center hover:bg-emerald-700'>
                    <Download className='w-4 h-4' /> Download PDF
                  </button>
                  <button
                    onClick={() => setShowPdfPreview(false)}
                    className='p-2 hover:bg-gray-100 rounded-lg'>
                    <X className='w-5 h-5 text-gray-500' />
                  </button>
                </div>
              </div>
              <iframe
                src={pdfUrl}
                className='w-full flex-1'
                title='PDF Preview'
              />
            </motion.div>
          </motion.div>
        )}
        {selectedTransaction && (
          <TransactionDetailsModal
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
        {showClientList && (
          <ClientListModal
            clients={stats.uniqueClientsList}
            onClose={() => setShowClientList(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default RevenueDetails;
