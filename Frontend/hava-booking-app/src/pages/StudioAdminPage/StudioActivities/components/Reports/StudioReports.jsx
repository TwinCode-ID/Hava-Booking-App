import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Lock,
  Wallet,
  CreditCard,
  TrendingUp,
  ChevronDown,
  Check,
  CheckCircle,
  XCircle,
  X,
  CalendarX,
  Clock,
  AlertCircle,
  Search,
  TrendingDown,
  RefreshCw,
  BarChart3,
  ClipboardList,
  Briefcase,
  Ticket,
  FileDown,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
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
        className={`w-full h-10.5 px-4 py-2.5 rounded-xl border bg-white flex items-center justify-between transition-all outline-none text-sm font-medium shadow-sm ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span
          className={`block truncate ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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

// --- Sub-Component: Inline Password Gate ---
const PasswordGateInline = ({ onUnlock, error, setError }) => {
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
        { email: user.email, password },
      );
      if (response.data.success || response.status === 200) onUnlock();
    } catch (err) {
      if (err.response && err.response.status === 401)
        setError("Incorrect password.");
      else setError("Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center py-16 group hover:border-emerald-200 transition-colors'>
      <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform'>
        <Lock className='w-8 h-8 text-emerald-600' />
      </div>
      <h2 className='text-xl font-bold text-gray-900 mb-2'>
        Unlock Financial Data
      </h2>
      <p className='text-gray-500 mb-6 text-sm max-w-sm'>
        To view revenue details and include financial data in your PDF export,
        please confirm your admin password.
      </p>
      <form onSubmit={handleSubmit} className='w-full max-w-sm space-y-4'>
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='Admin Password'
          className='w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all'
        />
        {error && <p className='text-red-500 text-xs'>{error}</p>}
        <button
          disabled={verifying}
          type='submit'
          className='w-full py-3 bg-emerald-900 text-white rounded-xl font-semibold hover:bg-emerald-800 transition-colors flex justify-center items-center gap-2'>
          {verifying ? "Verifying..." : "Unlock Revenue"}
        </button>
      </form>
    </div>
  );
};

// ==========================================
// MODAL COMPONENT: Stylized Receipt / Invoice
// ==========================================
const InvoiceReceiptModal = ({ transaction, onClose }) => {
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

  const getReceiptNo = (id) => {
    if (!id) return "";
    const parts = id.split("-");
    if (parts.length > 2) {
      return `${parts[1].slice(-2)}-${parts[2]}`;
    }
    return id.slice(-6).toUpperCase();
  };

  const handleDownloadPDF = () => {
    setDownloading(true);

    try {
      // 1. Setup PDF (80mm width = Standard Thermal Receipt size)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 160],
      });

      const textDark = "#111827";
      const textGray = "#6B7280";

      let y = 14;

      // 2. Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(textDark);
      doc.text("Hava Studio", 8, y);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(textGray);
      doc.text(
        `RECEIPT NO. ${getReceiptNo(transaction.transactionId)}`,
        72,
        y - 3,
        { align: "right" },
      );

      doc.setFont("helvetica", "normal");
      doc.text(
        new Date(transaction.createdAt).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        72,
        y,
        { align: "right" },
      );

      y += 14;

      // 3. Greeting
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(textDark);
      doc.text("Thanks for", 8, y);
      y += 6;
      doc.text("your purchase!", 8, y);

      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(textGray);
      doc.text(`Order #${transaction.transactionId}`, 8, y);

      y += 6;

      // 4. Dashed Divider
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.5);
      doc.setLineDash([1.5, 1.5], 0);
      doc.line(8, y, 72, y);
      doc.setLineDash([]); // Reset dash

      y += 8;

      // 5. Order Item (With Wrap support so it never overlaps the price)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(textDark);
      doc.text("1", 8, y);

      const pkgName = transaction.packageId?.packageName || "Custom Package";
      const splitPkgName = doc.splitTextToSize(pkgName, 35); // Wrap text at 35mm wide to avoid price overlap

      doc.text(splitPkgName, 13, y);
      doc.text(formatCurrency(transaction.totalAmount), 72, y, {
        align: "right",
      });

      // Move Y down based on how many lines the package name took
      y += splitPkgName.length * 4 + 1;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(textGray);
      doc.text(`1 x ${formatCurrency(transaction.totalAmount)}`, 13, y);

      y += 8;

      // 6. Total Gray Box
      doc.setFillColor(243, 244, 246); // Tailwind gray-100
      doc.roundedRect(8, y, 64, 26, 2, 2, "F");

      y += 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(textDark);
      doc.text("Total", 12, y);

      doc.setFontSize(14);
      doc.text(formatCurrency(transaction.totalAmount), 70, y, {
        align: "right",
      });

      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(textGray);
      doc.text("Payment Method", 12, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(textDark);
      doc.text(
        (transaction.paymentMethod?.replace(/_/g, " ") || "").toUpperCase(),
        70,
        y,
        { align: "right" },
      );

      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(textGray);
      doc.text("Status", 12, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text((transaction.status || "Confirmed").toUpperCase(), 70, y, {
        align: "right",
      });

      y += 12;

      // 7. QR Code Integration
      const qrCanvas = document.getElementById("qr-canvas");
      if (qrCanvas) {
        const qrDataUrl = qrCanvas.toDataURL("image/png");
        doc.addImage(qrDataUrl, "PNG", 8, y, 20, 20);
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(textDark);
      doc.text("Verify Transaction", 32, y + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(textGray);
      doc.text("Scan the QR code to securely", 32, y + 8);
      doc.text("view and verify these details", 32, y + 11);
      doc.text("online.", 32, y + 14);

      y += 28;

      // 8. Footer
      doc.setFontSize(6);
      doc.text("www.havastudio.id", 40, Math.min(y, 155), { align: "center" }); // Keep within bounds

      // 9. Save natively generated PDF
      doc.save(`Receipt_${transaction.transactionId}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    } finally {
      setDownloading(false);
    }
  };

  const qrUrl = `${window.location.origin}/verify/${transaction.transactionId}`;

  return (
    <div className='fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 30 }}
        className='flex flex-col items-center max-h-[95vh] overflow-y-auto w-full no-scrollbar pb-6 mt-6'>
        {/* Clean, Modern UI Receipt Container */}
        <div className='w-full max-w-[400px] bg-white rounded-[24px] overflow-hidden shadow-2xl relative font-sans pb-8'>
          <div className='p-8 pb-6'>
            <div className='flex justify-between items-start mb-8'>
              <div className='flex items-center gap-2.5'>
                <div className='grid grid-cols-3 gap-[3px]'>
                  {[...Array(9)].map((_, i) => (
                    <div
                      key={i}
                      className='w-1.5 h-1.5 bg-gray-900 rounded-full'></div>
                  ))}
                </div>
                <span className='font-bold text-gray-900 text-[20px] tracking-tight'>
                  Hava Studio
                </span>
              </div>
              <div className='text-right'>
                <p className='text-[10px] text-gray-500 font-bold tracking-wider uppercase'>
                  Receipt No. {getReceiptNo(transaction.transactionId)}
                </p>
                <p className='text-[11px] text-gray-400 font-medium mt-0.5'>
                  {new Date(transaction.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            <h2 className='text-[32px] font-extrabold text-gray-900 mb-3 leading-[1.1] tracking-tight'>
              Thanks for
              <br />
              your purchase!
            </h2>
            <p className='text-[14px] text-gray-500 font-medium leading-relaxed'>
              Your order{" "}
              <span className='text-blue-600 font-bold'>
                #{transaction.transactionId}
              </span>{" "}
              has been successfully processed.
            </p>
          </div>

          {/* Simple Dashed Divider */}
          <div className='w-full border-t-[2px] border-dashed border-gray-200'></div>

          <div className='p-8 pt-8'>
            <div className='flex justify-between items-start mb-8'>
              <div className='flex gap-4 pr-4'>
                <span className='font-bold text-lg text-gray-900'>1</span>
                <div>
                  <p className='font-bold text-[16px] text-gray-900 leading-snug mb-1'>
                    {transaction.packageId?.packageName || "Custom Package"}
                  </p>
                  <p className='text-[13px] text-gray-500 font-medium'>
                    1 × {formatCurrency(transaction.totalAmount)}
                  </p>
                </div>
              </div>
              <span className='font-bold text-[16px] text-gray-900 whitespace-nowrap'>
                {formatCurrency(transaction.totalAmount)}
              </span>
            </div>

            {/* Total Area Box */}
            <div className='bg-[#F3F4F6] p-6 rounded-[20px] mb-8'>
              <div className='flex justify-between items-end mb-6'>
                <span className='font-bold text-xl text-gray-800'>Total</span>
                <span className='font-extrabold text-[26px] text-gray-900 tracking-tight leading-none'>
                  {formatCurrency(transaction.totalAmount)}
                </span>
              </div>
              <div className='flex justify-between items-center text-[13px] font-bold mb-3'>
                <span className='text-gray-500'>Payment Method</span>
                <span className='text-gray-800 capitalize'>
                  {transaction.paymentMethod?.replace(/_/g, " ")}
                </span>
              </div>
              <div className='flex justify-between items-center text-[13px] font-bold'>
                <span className='text-gray-500'>Status</span>
                <span className='text-emerald-600 capitalize'>
                  {transaction.status || "Confirmed"}
                </span>
              </div>
            </div>

            {/* Verification Box & QR */}
            <div className='flex items-center justify-between gap-4 bg-white rounded-[16px] p-4 border border-gray-200'>
              <div className='flex-1 pr-2'>
                <h3 className='font-bold text-[14px] text-gray-900 mb-1'>
                  Verify Transaction
                </h3>
                <p className='text-[12px] text-gray-500 leading-relaxed'>
                  Scan the QR code to securely view and verify these details
                  online.
                </p>
              </div>
              <div className='shrink-0'>
                {/* Important: Using QRCodeCanvas so jsPDF can snapshot it natively */}
                <QRCodeCanvas
                  id='qr-canvas'
                  value={qrUrl}
                  size={64}
                  level='M'
                />
              </div>
            </div>
          </div>
        </div>

        {/* Buttons now placed cleanly at the bottom */}
        <div className='flex gap-3 w-full max-w-[400px] mt-6'>
          <button
            onClick={onClose}
            className='flex-1 py-3.5 bg-white text-gray-800 border border-gray-200 rounded-xl text-[15px] font-bold hover:bg-gray-50 transition-colors shadow-sm'>
            Close
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className='flex-[2] flex justify-center items-center gap-2 py-3.5 bg-emerald-500 text-white rounded-xl text-[15px] font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-500/20'>
            <Download className='w-4 h-4' />{" "}
            {downloading ? "Generating..." : "Download Invoice"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// MODAL COMPONENT: Transaction Details
// ==========================================
const TransactionDetailsModal = ({ transaction, onClose, onOpenReceipt }) => {
  if (!transaction) return null;

  return (
    <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className='bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-white shrink-0'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center'>
              <Wallet className='w-6 h-6' />
            </div>
            <div>
              <h3 className='text-xl font-bold text-gray-900'>
                Transaction Details
              </h3>
              <p className='text-sm font-medium text-gray-500 font-mono mt-0.5'>
                ID: {transaction.transactionId || "N/A"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-500'>
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className='p-6 overflow-y-auto flex-1 space-y-6 bg-white'>
          {/* Top Info Cards */}
          <div className='grid grid-cols-2 gap-4'>
            <div className='p-5 bg-[#f8f9fa] rounded-2xl border border-gray-100'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-2'>
                Amount Paid
              </p>
              <p className='text-3xl font-extrabold text-emerald-600 tracking-tight'>
                {formatCurrency(transaction.totalAmount)}
              </p>
            </div>
            <div className='p-5 bg-[#f8f9fa] rounded-2xl border border-gray-100'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-2'>
                Status
              </p>
              <div className='flex items-center gap-2'>
                <CheckCircle className='w-6 h-6 text-emerald-500' />
                <p className='text-xl font-bold text-gray-900 capitalize'>
                  {transaction.status || "Confirmed"}
                </p>
              </div>
            </div>
          </div>

          {/* Detailed Data Grid */}
          <div className='bg-white border border-gray-200 rounded-2xl overflow-hidden'>
            <div className='px-5 py-4 bg-[#f8f9fa] border-b border-gray-200'>
              <h4 className='text-[15px] font-bold text-gray-900'>
                Purchase Information
              </h4>
            </div>
            <div className='divide-y divide-gray-100'>
              <div className='grid grid-cols-3 p-5 items-center'>
                <span className='text-[15px] font-semibold text-gray-500'>
                  Client Name
                </span>
                <span className='text-[15px] font-bold text-gray-900 col-span-2'>
                  {transaction.userId?.fullName || "N/A"}
                </span>
              </div>
              <div className='grid grid-cols-3 p-5 items-center'>
                <span className='text-[15px] font-semibold text-gray-500'>
                  Package
                </span>
                <span className='text-[15px] font-medium text-gray-900 col-span-2 flex'>
                  <span className='bg-[#f1f3f5] px-3 py-1.5 rounded-lg border border-gray-200 text-sm font-bold'>
                    {transaction.packageId?.packageName || "N/A"}
                  </span>
                </span>
              </div>
              <div className='grid grid-cols-3 p-5 items-center'>
                <span className='text-[15px] font-semibold text-gray-500'>
                  Payment Method
                </span>
                <span className='text-[15px] font-bold text-gray-900 capitalize col-span-2'>
                  {transaction.paymentMethod?.replace(/_/g, " ")}
                </span>
              </div>
              <div className='grid grid-cols-3 p-5 items-center'>
                <span className='text-[15px] font-semibold text-gray-500'>
                  Purchase Date
                </span>
                <span className='text-[15px] font-bold text-gray-900 col-span-2'>
                  {new Date(transaction.createdAt).toLocaleString("en-GB", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Credits & Lifecycle Data */}
          <div className='bg-white border border-gray-200 rounded-2xl overflow-hidden'>
            <div className='px-5 py-4 bg-[#f8f9fa] border-b border-gray-200'>
              <h4 className='text-[15px] font-bold text-gray-900'>
                Package Lifecycle & Credits
              </h4>
            </div>
            <div className='divide-y divide-gray-100'>
              <div className='grid grid-cols-3 p-5 items-center'>
                <span className='text-[15px] font-semibold text-gray-500'>
                  Credits
                </span>
                <span className='text-[15px] font-bold text-gray-900 col-span-2'>
                  {transaction.remainingCredits} Remaining /{" "}
                  {transaction.creditsPurchased} Total
                </span>
              </div>
              {transaction.mustActivateBy && (
                <div className='grid grid-cols-3 p-5 items-center'>
                  <span className='text-[15px] font-semibold text-gray-500'>
                    Must Activate By
                  </span>
                  <span className='text-[15px] font-bold text-amber-700 col-span-2'>
                    {new Date(transaction.mustActivateBy).toLocaleDateString(
                      "en-GB",
                    )}
                  </span>
                </div>
              )}
              {transaction.expiryDate && (
                <div className='grid grid-cols-3 p-5 items-center'>
                  <span className='text-[15px] font-semibold text-gray-500'>
                    Expiry Date
                  </span>
                  <span className='text-[15px] font-bold text-red-600 col-span-2'>
                    {new Date(transaction.expiryDate).toLocaleDateString(
                      "en-GB",
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className='p-6 bg-white shrink-0'>
          <button
            onClick={() => onOpenReceipt(transaction)}
            className='w-full py-4 bg-[#0f172a] text-white rounded-xl font-bold hover:bg-gray-800 transition-colors flex justify-center items-center gap-2 shadow-md'>
            <FileText className='w-5 h-5' /> Generate Stylized Receipt
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// SECTION COMPONENTS
// ==========================================

const RevenueSection = ({
  stats,
  tableData,
  selectedMonth,
  selectedYear,
  onRowSelected,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");

  const filteredData = useMemo(() => {
    return tableData.filter((t) => {
      const q = searchQuery.toLowerCase();
      const match =
        (t.userId?.fullName || "").toLowerCase().includes(q) ||
        (t.packageId?.packageName || "").toLowerCase().includes(q);

      const methodStr = (t.paymentMethod || "").toLowerCase();
      const isPayAtStudio = methodStr === "pay_at_studio";
      const isTransfer = methodStr === "manual_transfer";
      const isQris = methodStr.includes("qris");
      const isOthers = !isPayAtStudio && !isTransfer && !isQris;

      let isMethodMatch = true;
      if (methodFilter === "Pay at Studio") isMethodMatch = isPayAtStudio;
      else if (methodFilter === "Transfer") isMethodMatch = isTransfer;
      else if (methodFilter === "QRIS") isMethodMatch = isQris;
      else if (methodFilter === "Others") isMethodMatch = isOthers;

      return match && isMethodMatch;
    });
  }, [tableData, searchQuery, methodFilter]);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
        <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
          <Wallet className='w-5 h-5 text-emerald-600' /> Financial Overview
        </h3>
        <div className='relative w-full md:w-80'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search transactions...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all shadow-sm'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-6 rounded-2xl shadow-md relative overflow-hidden'>
          <div className='relative z-10'>
            <p className='text-emerald-200 text-sm font-medium mb-1'>
              Total Confirmed Revenue
            </p>
            <h3 className='text-3xl font-extrabold'>
              {formatCurrency(stats.totalRevenue)}
            </h3>
          </div>
          <Wallet className='absolute right-4 bottom-4 w-24 h-24 text-white opacity-10' />
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center'>
          <div className='flex items-center gap-4'>
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
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <div className='flex justify-between items-center mb-4'>
            <h4 className='text-gray-900 font-bold flex items-center gap-2 text-sm'>
              <CreditCard className='w-4 h-4 text-gray-400' /> Payment Methods
            </h4>
            {methodFilter !== "All" && (
              <button
                onClick={() => setMethodFilter("All")}
                className='text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded'>
                Clear
              </button>
            )}
          </div>
          <div className='flex flex-col gap-2'>
            {stats.breakdown.map((item) => (
              <div
                key={item.name}
                onClick={() => setMethodFilter(item.name)}
                className={`cursor-pointer rounded-lg p-2 transition-colors border ${methodFilter === item.name ? "bg-gray-50 border-emerald-200" : "border-transparent hover:bg-gray-50"}`}>
                <div className='flex justify-between text-xs mb-1'>
                  <span className='text-gray-600'>{item.name}</span>
                  <span className='font-semibold text-gray-900'>
                    {item.percentage}%
                  </span>
                </div>
                <div className='w-full bg-gray-100 rounded-full h-1.5'>
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 bg-gray-50/50'>
                <th className='px-6 py-4 font-bold'>Date</th>
                <th className='px-6 py-4 font-bold'>Client</th>
                <th className='px-6 py-4 font-bold'>Package</th>
                <th className='px-6 py-4 font-bold'>Method</th>
                <th className='px-6 py-4 font-bold text-right'>Amount</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <tr
                    key={trx._id}
                    onClick={() => onRowSelected(trx)}
                    className='hover:bg-emerald-50/80 cursor-pointer transition-colors group'>
                    <td className='px-6 py-4 text-sm text-gray-500 group-hover:text-emerald-700 transition-colors'>
                      {new Date(trx.createdAt).toLocaleDateString()}
                    </td>
                    <td className='px-6 py-4 text-sm font-semibold text-gray-900 group-hover:text-emerald-800 transition-colors'>
                      {trx.userId?.fullName}
                    </td>
                    <td className='px-6 py-4 text-sm'>
                      <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200 group-hover:bg-white transition-colors'>
                        {trx.packageId?.packageName}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-sm capitalize text-gray-600'>
                      {trx.paymentMethod?.replace(/_/g, " ")}
                    </td>
                    <td className='px-6 py-4 text-sm text-right font-bold text-gray-900'>
                      {formatCurrency(trx.totalAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No successful transactions found for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AttendanceSection = ({
  bookings,
  stats,
  onClearStudent,
  selectedStudentName,
}) => {
  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
          <ClipboardList className='w-5 h-5 text-blue-600' /> Class Attendance
        </h3>
        {selectedStudentName && (
          <div className='flex items-center gap-3'>
            <span className='text-sm px-3 py-1 bg-blue-50 text-blue-800 rounded-full font-semibold border border-blue-100'>
              Showing for: {selectedStudentName}
            </span>
            <button
              onClick={onClearStudent}
              className='p-1 hover:bg-red-50 text-red-500 rounded'>
              <X className='w-4 h-4' />
            </button>
          </div>
        )}
      </div>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Total Bookings
            </p>
            <div className='p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-gray-600 transition-colors'>
              <Ticket className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.total}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Total Attended
            </p>
            <div className='p-2 bg-emerald-50 rounded-lg text-emerald-500'>
              <CheckCircle className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-emerald-600'>
            {stats.attended}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-red-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Cancellations
            </p>
            <div className='p-2 bg-red-50 rounded-lg text-red-500'>
              <XCircle className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-red-600'>
            {stats.cancelled}
          </h3>
        </div>
        <div className='bg-gradient-to-br from-blue-800 to-blue-950 p-6 rounded-2xl shadow-md relative overflow-hidden'>
          <div className='absolute top-0 right-0 p-4 opacity-10'>
            <TrendingUp className='w-24 h-24 text-white -mt-4 -mr-4' />
          </div>
          <div className='relative z-10'>
            <p className='text-blue-100 text-xs font-bold tracking-wider uppercase mb-4'>
              Attendance Rate
            </p>
            <h3 className='text-4xl font-extrabold text-white'>
              {stats.rate}%
            </h3>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50'>
          <h3 className='font-bold text-gray-800 text-sm'>
            {selectedStudentName
              ? "Student Attendance Details"
              : "Recent Class Bookings"}
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-400 bg-gray-50/30 uppercase'>
                <th className='px-6 py-4'>Date</th>
                {!selectedStudentName && (
                  <th className='px-6 py-4'>Client Name</th>
                )}
                <th className='px-6 py-4'>Class</th>
                <th className='px-6 py-4'>Instructor</th>
                <th className='px-6 py-4'>Status</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {bookings.slice(0, 30).map((b) => (
                <tr
                  key={b._id}
                  className='hover:bg-gray-50/80 transition-colors'>
                  <td className='px-6 py-4 text-sm text-gray-500'>
                    {new Date(b.bookingDate).toLocaleDateString()}
                  </td>
                  {!selectedStudentName && (
                    <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                      {b.userId?.fullName || "N/A"}
                    </td>
                  )}
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200'>
                      {b.classId?.className || "Class Removed"}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {b.instructorId?.fullName || "-"}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    {b.status === "Cancelled" ? (
                      <span className='px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-100'>
                        Cancelled
                      </span>
                    ) : b.isAttend ? (
                      <span className='px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100'>
                        Checked In
                      </span>
                    ) : (
                      <span className='px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-100'>
                        Booked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan='5' className='px-6 py-16 text-center'>
                    <div className='flex flex-col items-center justify-center text-gray-400'>
                      <div className='bg-gray-50 p-4 rounded-full mb-3 border border-gray-100'>
                        <CalendarX className='w-8 h-8 text-gray-300' />
                      </div>
                      <p className='text-gray-900 font-medium text-base'>
                        No bookings yet
                      </p>
                      <p className='text-sm mt-1'>
                        When students book classes, they will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const InstructorSection = ({ stats, classesCount }) => {
  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
        <Briefcase className='w-5 h-5 text-orange-600' /> Instructor Workload
      </h3>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Active Instructors
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.length}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Classes Scheduled
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {classesCount}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Total Students Enrolled
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.reduce((acc, curr) => acc + curr.students, 0)}
          </h3>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50'>
          <h3 className='font-bold text-gray-800 text-sm'>
            Instructor Workload Details
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-500 bg-gray-50/30 uppercase'>
                <th className='px-6 py-4'>Instructor Name</th>
                <th className='px-6 py-4'>Type</th>
                <th className='px-6 py-4 text-center'>Classes Taught</th>
                <th className='px-6 py-4 text-center'>Total Students</th>
                <th className='px-6 py-4 text-right'>Total Hours</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {stats.map((inst, idx) => (
                <tr key={idx} className='hover:bg-gray-50/80 transition-colors'>
                  <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                    {inst.name}
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {inst.type || "N/A"}
                  </td>
                  <td className='px-6 py-4 text-sm text-center font-bold text-gray-700'>
                    {inst.classCount}
                  </td>
                  <td className='px-6 py-4 text-sm text-center text-gray-700'>
                    {inst.students}
                  </td>
                  <td className='px-6 py-4 text-sm text-right font-bold text-emerald-600'>
                    {(inst.totalDuration / 60).toFixed(1)} hrs
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No instructor data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PackageUsageSection = ({ passes, onRowClick }) => {
  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
        <Ticket className='w-5 h-5 text-purple-600' /> Package Distribution &
        Usage
      </h3>
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center'>
          <h3 className='font-bold text-gray-800 text-sm'>
            Issued Passes & Credits Summary
          </h3>
          <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md'>
            Click a row to view student history
          </span>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-400 bg-gray-50/50 uppercase'>
                <th className='px-6 py-4'>Owner</th>
                <th className='px-6 py-4'>Package Name</th>
                <th className='px-6 py-4'>Credits Left</th>
                <th className='px-6 py-4'>Expiry</th>
                <th className='px-6 py-4'>Status</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {passes.slice(0, 50).map((pass) => (
                <tr
                  key={pass._id}
                  onClick={() => pass.userId?._id && onRowClick(pass.userId)}
                  className='hover:bg-purple-50/50 cursor-pointer transition-colors group'>
                  <td className='px-6 py-4 text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors'>
                    {pass.userId?.fullName || "N/A"}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200'>
                      {pass.packageId?.packageName || "Custom Pass"}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-sm font-extrabold text-gray-700'>
                    {pass.remainingCredits} / {pass.initialCredits}
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {new Date(pass.expiryDate).toLocaleDateString()}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    {pass.isActive ? (
                      <span className='px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100'>
                        Active
                      </span>
                    ) : (
                      <span className='px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold border border-gray-200'>
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {passes.length === 0 && (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No pass data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StudentAttendanceModal = ({ student, allBookings, onClose }) => {
  const studentBookings = useMemo(() => {
    return allBookings
      .filter((b) => b.userId?._id === student._id)
      .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
  }, [allBookings, student._id]);

  const stats = useMemo(() => {
    const total = studentBookings.length;
    const attended = studentBookings.filter((b) => b.isAttend).length;
    const cancelled = studentBookings.filter(
      (b) => b.status === "Cancelled",
    ).length;
    const missed = studentBookings.filter(
      (b) =>
        !b.isAttend &&
        b.status !== "Cancelled" &&
        new Date(b.bookingDate) < new Date(),
    ).length;
    return { total, attended, cancelled, missed };
  }, [studentBookings]);

  const generateStudentPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [126, 34, 206];

    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(`Student Report: ${student.fullName}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Bookings: ${stats.total}`, 14, 42);
    doc.text(`Classes Attended: ${stats.attended}`, 70, 42);
    doc.text(`Cancellations: ${stats.cancelled}`, 130, 42);

    let currentY = 52;
    if (studentBookings.length > 0) {
      const cols = ["Date", "Class", "Instructor", "Status"];
      const rows = studentBookings.map((b) => [
        new Date(b.bookingDate).toLocaleDateString(),
        b.classId?.className || "N/A",
        b.instructorId?.fullName || "N/A",
        b.status === "Cancelled"
          ? "Cancelled"
          : b.isAttend
            ? "Checked In"
            : new Date(b.bookingDate) < new Date()
              ? "Absent/Missed"
              : "Booked",
      ]);
      autoTable(doc, {
        head: [cols],
        body: rows,
        startY: currentY,
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 9 },
      });
    } else {
      doc.text("No booking history found for this student.", 14, currentY);
    }

    doc.save(`Student_Report_${student.fullName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className='bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-xl'>
              {student.fullName.charAt(0)}
            </div>
            <div>
              <h3 className='text-xl font-bold text-gray-900'>
                {student.fullName}
              </h3>
              <p className='text-sm text-gray-500'>
                Attendance History & Detail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500'>
            <X className='w-6 h-6' />
          </button>
        </div>
        <div className='p-6 overflow-y-auto flex-1 space-y-6'>
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 text-center'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-1'>
                Total Booked
              </p>
              <p className='text-2xl font-extrabold text-gray-900'>
                {stats.total}
              </p>
            </div>
            <div className='p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center'>
              <p className='text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1'>
                Attended
              </p>
              <p className='text-2xl font-extrabold text-emerald-700'>
                {stats.attended}
              </p>
            </div>
            <div className='p-4 bg-red-50 rounded-xl border border-red-100 text-center'>
              <p className='text-xs font-bold text-red-600 uppercase tracking-wider mb-1'>
                Cancelled
              </p>
              <p className='text-2xl font-extrabold text-red-700'>
                {stats.cancelled}
              </p>
            </div>
            <div className='p-4 bg-amber-50 rounded-xl border border-amber-100 text-center'>
              <p className='text-xs font-bold text-amber-600 uppercase tracking-wider mb-1'>
                Missed/Absent
              </p>
              <p className='text-2xl font-extrabold text-amber-700'>
                {stats.missed}
              </p>
            </div>
          </div>
          <div className='border border-gray-200 rounded-xl overflow-hidden'>
            <table className='w-full text-left border-collapse'>
              <thead>
                <tr className='bg-gray-50/80 border-b border-gray-200 text-xs font-bold tracking-wider text-gray-500 uppercase'>
                  <th className='px-4 py-3'>Date</th>
                  <th className='px-4 py-3'>Class Name</th>
                  <th className='px-4 py-3'>Instructor</th>
                  <th className='px-4 py-3'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {studentBookings.map((b) => {
                  const isPast = new Date(b.bookingDate) < new Date();
                  const isAbsent =
                    !b.isAttend && b.status !== "Cancelled" && isPast;
                  return (
                    <tr
                      key={b._id}
                      className='hover:bg-gray-50 transition-colors'>
                      <td className='px-4 py-3 text-sm text-gray-600'>
                        {new Date(b.bookingDate).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-3 text-sm font-semibold text-gray-900'>
                        {b.classId?.className || "Removed"}
                      </td>
                      <td className='px-4 py-3 text-sm text-gray-600'>
                        {b.instructorId?.fullName || "-"}
                      </td>
                      <td className='px-4 py-3 text-sm'>
                        {b.status === "Cancelled" ? (
                          <span className='text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100'>
                            Cancelled
                          </span>
                        ) : b.isAttend ? (
                          <span className='text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100'>
                            Checked In
                          </span>
                        ) : isAbsent ? (
                          <span className='text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100'>
                            Absent
                          </span>
                        ) : (
                          <span className='text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200'>
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {studentBookings.length === 0 && (
                  <tr>
                    <td colSpan='4' className='text-center py-8 text-gray-400'>
                      No bookings recorded for this student.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className='p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0'>
          <button
            onClick={generateStudentPDF}
            className='flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition-colors shadow-sm'>
            <FileText className='w-4 h-4' /> Download Student PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT: STUDIO REPORTS
// ==========================================
const StudioReports = () => {
  const { user } = useAuth();

  // --- Global State ---
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // --- Modal State ---
  const [selectedStudentId, setSelectedStudentId] = useState("All");
  const [modalStudent, setModalStudent] = useState(null);
  const [selectedTx, setSelectedTx] = useState(null);
  const [receiptTx, setReceiptTx] = useState(null);

  // --- Revenue State (Gated) ---
  const [isRevenueLocked, setIsRevenueLocked] = useState(true);
  const [revenuePasswordError, setRevenuePasswordError] = useState("");
  const [transactions, setTransactions] = useState([]);

  // --- Public Data State ---
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [passes, setPasses] = useState([]);

  // --- Constants ---
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
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i),
    [],
  );
  const availableMonths = useMemo(
    () =>
      selectedYear === new Date().getFullYear()
        ? monthNames.slice(0, new Date().getMonth() + 1)
        : monthNames,
    [selectedYear],
  );

  useEffect(() => {
    if (selectedMonth >= availableMonths.length)
      setSelectedMonth(availableMonths.length - 1);
  }, [selectedYear, availableMonths]);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchAllPublicData = async () => {
      setLoading(true);
      try {
        const [bookRes, classRes, passRes] = await Promise.all([
          axiosInstance.get(`/api/bookings/studio`),
          axiosInstance.get(`/api/schedule/${user.adminStudioLocation}`),
          axiosInstance.get(`/api/passes/history/${user.adminStudioLocation}`),
        ]);
        if (bookRes.data) setBookings(bookRes.data);
        if (classRes.data) setClasses(classRes.data);
        if (passRes.data) setPasses(passRes.data);
      } catch (error) {
        console.error("Failed to fetch public report data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllPublicData();
  }, [user.adminStudioLocation]);

  useEffect(() => {
    const fetchRevenueData = async () => {
      if (isRevenueLocked) return;
      try {
        const res = await axiosInstance.get(
          API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation),
        );
        if (res.data) setTransactions(res.data);
      } catch (error) {
        console.error("Failed to fetch revenue:", error);
      }
    };
    fetchRevenueData();
  }, [isRevenueLocked, user.adminStudioLocation]);

  // --- Derived Stats Calculations ---
  const studentOptions = useMemo(() => {
    const distinctStudents = Array.from(
      new Map(
        bookings.map((item) => [item.userId?._id, item.userId?.fullName]),
      ).entries(),
    );
    return [
      { value: "All", label: "All Students" },
      ...distinctStudents.map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [bookings]);

  const selectedStudentName = useMemo(() => {
    if (selectedStudentId === "All") return null;
    return studentOptions.find((o) => o.value === selectedStudentId)?.label;
  }, [selectedStudentId, studentOptions]);

  const revenueStats = useMemo(() => {
    const currentMonth = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      const validStatuses = [
        "approved",
        "confirmed",
        "active",
        "queued",
        "completed",
        "success",
      ];
      const isSuccess = validStatuses.includes((t.status || "").toLowerCase());
      return (
        d.getMonth() === selectedMonth &&
        d.getFullYear() === selectedYear &&
        isSuccess
      );
    });
    const totalRevenue = currentMonth.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0,
    );
    const methodStats = currentMonth.reduce(
      (acc, curr) => {
        let key = "Others";
        if (curr.paymentMethod === "pay_at_studio") key = "Pay at Studio";
        else if (curr.paymentMethod === "manual_transfer") key = "Transfer";
        else if (curr.paymentMethod.toLowerCase().includes("qris"))
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

    return {
      totalRevenue,
      totalTransactions: currentMonth.length,
      breakdown,
      tableData: currentMonth,
    };
  }, [transactions, selectedMonth, selectedYear]);

  const attendanceStats = useMemo(() => {
    const periodFilteredBookings = bookings.filter((b) => {
      const d = new Date(b.bookingDate);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    let finalBookings = periodFilteredBookings;
    if (selectedStudentId !== "All") {
      finalBookings = periodFilteredBookings.filter(
        (b) => b.userId?._id === selectedStudentId,
      );
    }

    const total = finalBookings.length;
    const attended = finalBookings.filter((b) => b.isAttend).length;
    const cancelled = finalBookings.filter(
      (b) => b.status === "Cancelled",
    ).length;
    const rate =
      total > 0 ? Math.round((attended / (total - cancelled)) * 100) || 0 : 0;

    return { data: finalBookings, stats: { total, attended, cancelled, rate } };
  }, [bookings, selectedMonth, selectedYear, selectedStudentId]);

  const instructorStats = useMemo(() => {
    const filteredClasses = classes.filter((c) => {
      const d = new Date(c.startTime);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    const map = {};
    filteredClasses.forEach((cls) => {
      if (!cls.instructorId) return;
      const id = cls.instructorId._id;
      if (!map[id])
        map[id] = {
          name: cls.instructorId.fullName,
          type: cls.instructorType,
          classCount: 0,
          totalDuration: 0,
          students: 0,
        };
      map[id].classCount += 1;
      map[id].totalDuration += cls.duration || 0;
      map[id].students += cls.currentEnrollment || 0;
    });
    return {
      data: Object.values(map).sort((a, b) => b.classCount - a.classCount),
      totalClasses: filteredClasses.length,
    };
  }, [classes, selectedMonth, selectedYear]);

  const packageFiltered = useMemo(() => {
    return passes.filter((p) => {
      const d = new Date(p.purchaseDate || p.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [passes, selectedMonth, selectedYear]);

  const generateMasterPDF = () => {
    if (isRevenueLocked) {
      alert(
        "Please unlock the Revenue section before exporting the comprehensive master report.",
      );
      return;
    }
    const doc = new jsPDF();
    const monthName = monthNames[selectedMonth];
    const reportTitle = `Studio Master Report - ${monthName} ${selectedYear}`;
    const primaryColor = [6, 78, 59];
    const secondaryColor = [100, 116, 139];

    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(14, 36, 196, 36);

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("1. Financial Overview", 14, 50);
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Revenue: ${formatCurrency(revenueStats.totalRevenue)}`,
      14,
      58,
    );
    doc.text(`Total Transactions: ${revenueStats.totalTransactions}`, 14, 64);

    let currentY = 72;
    if (revenueStats.tableData.length > 0) {
      const revCols = ["Date", "Client", "Package", "Method", "Amount"];
      const revRows = revenueStats.tableData.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.userId?.fullName || "N/A",
        t.packageId?.packageName || "N/A",
        t.paymentMethod.replace(/_/g, " "),
        formatCurrency(t.totalAmount),
      ]);
      autoTable(doc, {
        head: [revCols],
        body: revRows,
        startY: currentY,
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No transactions recorded for this period.", 14, currentY);
      currentY += 18;
    }

    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text(
      selectedStudentName
        ? `2. Attendance: ${selectedStudentName}`
        : "2. Class Attendance Overview",
      14,
      currentY,
    );
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    currentY += 10;
    doc.text(`Total Bookings: ${attendanceStats.stats.total}`, 14, currentY);
    doc.text(`Total Attended: ${attendanceStats.stats.attended}`, 70, currentY);
    doc.text(
      `Cancellations: ${attendanceStats.stats.cancelled}`,
      120,
      currentY,
    );
    doc.text(`Attendance Rate: ${attendanceStats.stats.rate}%`, 170, currentY);
    currentY += 10;

    if (attendanceStats.data.length > 0) {
      const attCols = selectedStudentName
        ? ["Date", "Class", "Instructor", "Status"]
        : ["Date", "Client", "Class", "Instructor", "Status"];
      const attRows = attendanceStats.data.map((b) => {
        const row = [
          new Date(b.bookingDate).toLocaleDateString(),
          b.classId?.className || "N/A",
          b.instructorId?.fullName || "N/A",
          b.status === "Cancelled"
            ? "Cancelled"
            : b.isAttend
              ? "Checked In"
              : "Booked",
        ];
        if (!selectedStudentName) row.splice(1, 0, b.userId?.fullName || "N/A");
        return row;
      });
      autoTable(doc, {
        head: [attCols],
        body: attRows,
        startY: currentY,
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No booking data found.", 14, currentY);
      currentY += 18;
    }

    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("3. Instructor Workload", 14, currentY);
    currentY += 10;
    if (instructorStats.data.length > 0) {
      const instCols = [
        "Instructor Name",
        "Type",
        "Classes Taught",
        "Total Students",
        "Total Hours",
      ];
      const instRows = instructorStats.data.map((i) => [
        i.name,
        i.type || "N/A",
        i.classCount.toString(),
        i.students.toString(),
        `${(i.totalDuration / 60).toFixed(1)} hrs`,
      ]);
      autoTable(doc, {
        head: [instCols],
        body: instRows,
        startY: currentY,
        headStyles: { fillColor: [234, 88, 12] },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No instructor data found for this period.", 14, currentY);
      currentY += 18;
    }

    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("4. Issued Packages", 14, currentY);
    currentY += 10;
    if (packageFiltered.length > 0) {
      const packCols = [
        "Owner",
        "Package Name",
        "Credits Left",
        "Expiry",
        "Status",
      ];
      const packRows = packageFiltered.map((p) => [
        p.userId?.fullName || "N/A",
        p.packageId?.packageName || "Custom",
        `${p.remainingCredits} / ${p.initialCredits}`,
        new Date(p.expiryDate).toLocaleDateString(),
        p.isActive ? "Active" : "Inactive",
      ]);
      autoTable(doc, {
        head: [packCols],
        body: packRows,
        startY: currentY,
        headStyles: { fillColor: [147, 51, 234] },
        styles: { fontSize: 8 },
      });
    } else {
      doc.text("No new packages issued during this period.", 14, currentY);
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(...secondaryColor);
      doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: "right" });
    }
    doc.save(`Studio_Master_Report_${monthName}_${selectedYear}.pdf`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 h-full overflow-y-auto relative'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-gray-200 pb-8 bg-white p-6 rounded-2xl shadow-sm'>
        <div>
          <h2 className='text-3xl font-extrabold text-gray-900 tracking-tight'>
            Master Studio Report
          </h2>
          <p className='text-gray-500 mt-1 max-w-lg'>
            Comprehensive performance data across financials, attendance,
            instructors, and packages. Apply filters below to customize the
            view.
          </p>
        </div>
        <div className='flex flex-wrap gap-3 items-center w-full md:w-auto'>
          <div className='w-28'>
            <CustomSelect
              value={selectedYear}
              onChange={setSelectedYear}
              options={yearOptions}
              placeholder='Year'
            />
          </div>
          <div className='w-36'>
            <CustomSelect
              value={monthNames[selectedMonth]}
              onChange={(val) => setSelectedMonth(monthNames.indexOf(val))}
              options={availableMonths}
              placeholder='Month'
            />
          </div>
          <div className='w-56'>
            <CustomSelect
              value={
                studentOptions.find((o) => o.value === selectedStudentId)
                  ?.label || "All Students"
              }
              onChange={setSelectedStudentId}
              options={studentOptions}
              placeholder='Filter Student'
            />
          </div>
          <button
            onClick={generateMasterPDF}
            className='flex items-center gap-2 bg-emerald-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-800 transition-colors w-full md:w-auto justify-center group'>
            <FileDown className='w-4 h-4 group-hover:-translate-y-0.5 transition-transform' />{" "}
            Export Master PDF
          </button>
        </div>
      </div>

      <div className='space-y-12 pb-20'>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          {isRevenueLocked ? (
            <PasswordGateInline
              onUnlock={() => setIsRevenueLocked(false)}
              error={revenuePasswordError}
              setError={setRevenuePasswordError}
            />
          ) : (
            <RevenueSection
              stats={revenueStats}
              tableData={revenueStats.tableData}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onRowSelected={(trx) => setSelectedTx(trx)}
            />
          )}
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <AttendanceSection
            bookings={attendanceStats.data}
            stats={attendanceStats.stats}
            onClearStudent={() => setSelectedStudentId("All")}
            selectedStudentName={selectedStudentName}
          />
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <InstructorSection
            stats={instructorStats.data}
            classesCount={instructorStats.totalClasses}
          />
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <PackageUsageSection
            passes={packageFiltered}
            onRowClick={setModalStudent}
          />
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedTx && !receiptTx && (
          <TransactionDetailsModal
            transaction={selectedTx}
            onClose={() => setSelectedTx(null)}
            onOpenReceipt={(tx) => setReceiptTx(tx)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {receiptTx && (
          <InvoiceReceiptModal
            transaction={receiptTx}
            onClose={() => setReceiptTx(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalStudent && (
          <StudentAttendanceModal
            student={modalStudent}
            allBookings={bookings}
            onClose={() => setModalStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioReports;
