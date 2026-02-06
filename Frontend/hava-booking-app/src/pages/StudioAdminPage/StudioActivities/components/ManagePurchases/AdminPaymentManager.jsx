import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  Download,
  X,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Eye,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { useAuth } from "../../../../../context/AuthContext";
import { API_PATHS } from "../../../../../utils/apiPath";
import ReviewModal from "./components/ReviewModal";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// --- Helpers ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return "-";
  return new Date(dateString)
    .toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
    .replace(/ /g, "-");
};

const AdminPaymentManager = ({ isEmbedded = false }) => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIssuer, setFilterIssuer] = useState("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "date",
    direction: "desc",
  });

  // Modal States
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // PDF States
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // --- 1. FETCH DATA ---
  const fetchPurchases = async () => {
    try {
      if (!user?.adminStudioLocation) return;
      // console.log("🔄 Fetching Admin Purchases..."); // Debug log
      const response = await axiosInstance.get(
        API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation),
      );
      setPurchases(response.data);
    } catch (error) {
      console.error("Error fetching purchases:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- 2. LISTEN FOR GLOBAL UPDATES ---
  useEffect(() => {
    // Initial Load
    fetchPurchases();

    // Event Handler
    const handleAdminUpdate = () => {
      console.log("⚡ [ADMIN] Socket event received. Refetching...");
      fetchPurchases();
    };

    // Add Listener
    window.addEventListener("admin-data-updated", handleAdminUpdate);

    // Cleanup
    return () => {
      window.removeEventListener("admin-data-updated", handleAdminUpdate);
    };
  }, [fetchPurchases]);

  // ... (Rest of your component logic: Filtering, Sorting, PDF, JSX) ...
  // This part of your code was fine, no changes needed below here.

  // --- FILTERING & SORTING ---
  const filteredData = useMemo(() => {
    let data = purchases.filter((p) => {
      const matchesIssuer =
        filterIssuer === "all" ? true : p.paymentIssuer === filterIssuer;

      const cleanText = (text) =>
        (text || "").toLowerCase().replace(/[\s\-_]/g, "");

      const query = cleanText(searchQuery);
      const userName = cleanText(p.userId?.fullName);
      const packageName = cleanText(p.packageId?.packageName);
      const trxId = cleanText(p.transactionId);

      const matchesSearch =
        userName.includes(query) ||
        packageName.includes(query) ||
        trxId.includes(query);

      return matchesIssuer && matchesSearch;
    });

    data = data.sort((a, b) => {
      let aValue, bValue;
      switch (sortConfig.key) {
        case "clientName":
          aValue = (a.userId?.fullName || "").toLowerCase();
          bValue = (b.userId?.fullName || "").toLowerCase();
          break;
        case "amount":
          aValue = a.totalAmount || 0;
          bValue = b.totalAmount || 0;
          break;
        case "date":
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        default:
          return 0;
      }
      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return data;
  }, [purchases, searchQuery, filterIssuer, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  // ... (Keep handlePreviewReport, handleDownloadReport, handleReview, issuerOptions) ...

  // Copying your Review Logic back in to ensure it's complete
  const handleReview = async (action, extraData = {}) => {
    if (!selectedPurchase) return;
    setProcessingId(selectedPurchase._id);

    try {
      await axiosInstance.post(
        API_PATHS.PURCHASES.REVIEW_PURCHASE(selectedPurchase._id),
        {
          action,
          rejectionReason: action === "reject" ? rejectionReason : null,
          ...extraData,
        },
      );

      // Optimistic Update
      setPurchases((prev) =>
        prev.map((p) =>
          p._id === selectedPurchase._id
            ? {
                ...p,
                status: action === "approve" ? "confirmed" : "payment_rejected",
                paymentIssuer: extraData.paymentIssuer || p.paymentIssuer,
              }
            : p,
        ),
      );
      setSelectedPurchase(null);
      setRejectionReason("");
    } catch (error) {
      alert(error.response?.data?.error || "Action failed");
    } finally {
      setProcessingId(null);
    }
  };

  const issuerOptions = useMemo(() => {
    const issuers = new Set(
      purchases.map((p) => p.paymentIssuer).filter(Boolean),
    );
    return [
      { id: "all", label: "All" },
      ...Array.from(issuers).map((i) => ({ id: i, label: i })),
    ];
  }, [purchases]);

  // ... (Keep handlePreviewReport and handleDownloadReport from your previous code) ...
  const handlePreviewReport = () => {
    if (filteredData.length === 0) {
      alert("No data available to export.");
      return;
    }
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Payment Transaction Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    const tableColumn = [
      "Date",
      "Transaction ID",
      "Client",
      "Package",
      "Issuer",
      "Amount",
      "Status",
    ];
    const tableRows = filteredData.map((p) => [
      new Date(p.createdAt).toLocaleDateString("en-GB"),
      p.transactionId,
      p.userId?.fullName || "Unknown",
      p.packageId?.packageName || "Unknown",
      p.paymentIssuer || "-",
      formatCurrency(p.totalAmount),
      p.status,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8 },
    });

    const blob = doc.output("bloburl");
    setPdfUrl(blob);
    setShowPdfPreview(true);
  };

  const handleDownloadReport = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Payment Transaction Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    const tableColumn = [
      "Date",
      "Transaction ID",
      "Client",
      "Package",
      "Issuer",
      "Amount",
      "Status",
    ];
    const tableRows = filteredData.map((p) => [
      new Date(p.createdAt).toLocaleDateString("en-GB"),
      p.transactionId,
      p.userId?.fullName || "Unknown",
      p.packageId?.packageName || "Unknown",
      p.paymentIssuer || "-",
      formatCurrency(p.totalAmount),
      p.status,
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 35,
      theme: "grid",
      headStyles: { fillColor: [6, 78, 59] },
      styles: { fontSize: 8 },
    });

    doc.save(`Transactions_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div
      className={`p-6 md:p-10 ${isEmbedded ? "pt-8" : ""} bg-gray-50 min-h-screen relative`}>
      {/* --- HEADER --- */}
      {!isEmbedded && (
        <div className='mb-8'>
          <h1 className='text-2xl font-bold text-gray-900'>Payment Reviews</h1>
          <p className='text-gray-500 text-sm mt-1'>
            Manage incoming package purchases.
          </p>
        </div>
      )}

      {/* --- TOOLBAR --- */}
      <div className='flex flex-col md:flex-row justify-between items-center mb-6 gap-4 relative z-20'>
        {/* Left: Search */}
        <div className='relative w-full md:w-96'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search transaction or client...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm'
          />
        </div>

        {/* Right: Actions */}
        <div className='flex items-center justify-end gap-3 w-full md:w-auto'>
          <span className='text-sm text-gray-500 font-medium whitespace-nowrap hidden md:block mr-2'>
            Showing{" "}
            <span className='text-gray-900 font-bold'>
              {filteredData.length}
            </span>{" "}
            transactions
          </span>

          <button
            onClick={handlePreviewReport}
            className='flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-colors whitespace-nowrap'>
            <Eye className='w-4 h-4' /> Export
          </button>

          {isFilterOpen && (
            <div className='overflow-hidden origin-right animate-in slide-in-from-right-2 duration-200'>
              <div className='flex gap-1 bg-white p-1 rounded-lg border border-gray-200 shadow-sm whitespace-nowrap'>
                {issuerOptions.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setFilterIssuer(opt.id)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                      filterIssuer === opt.id
                        ? "bg-emerald-100 text-emerald-800"
                        : "text-gray-500 hover:bg-gray-50"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors shadow-sm border border-transparent shrink-0 ${isFilterOpen ? "bg-gray-800 text-white" : "bg-emerald-900 text-white hover:bg-emerald-800"}`}>
            {isFilterOpen ? (
              <X className='w-5 h-5' />
            ) : (
              <Filter className='w-5 h-5' />
            )}
          </button>
        </div>
      </div>

      {/* --- TABLE --- */}
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead className='bg-gray-50 border-b border-gray-100'>
              <tr>
                <th
                  onClick={() => handleSort("clientName")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors'>
                  <div className='flex items-center gap-2'>
                    Client Name
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${sortConfig.key === "clientName" ? "text-emerald-600" : "text-gray-400"}`}
                    />
                  </div>
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider'>
                  Package
                </th>
                <th
                  onClick={() => handleSort("amount")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors'>
                  <div className='flex items-center gap-2'>
                    Amount
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${sortConfig.key === "amount" ? "text-emerald-600" : "text-gray-400"}`}
                    />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("date")}
                  className='py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors'>
                  <div className='flex items-center gap-2'>
                    Date
                    <ArrowUpDown
                      className={`w-3.5 h-3.5 ${sortConfig.key === "date" ? "text-emerald-600" : "text-gray-400"}`}
                    />
                  </div>
                </th>
                <th className='py-4 px-6 text-xs font-bold text-gray-500 uppercase tracking-wider'>
                  Status
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filteredData.length > 0 ? (
                filteredData.map((item) => (
                  <tr
                    key={item._id}
                    onClick={() => setSelectedPurchase(item)}
                    className='hover:bg-emerald-50/50 transition-colors cursor-pointer group'>
                    <td className='py-4 px-6'>
                      <div className='flex items-center gap-3'>
                        <div className='w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0'>
                          {item.userId?.fullName?.charAt(0) || "?"}
                        </div>
                        <div className='flex flex-col'>
                          <span className='text-sm font-bold text-gray-900 leading-none mb-1'>
                            {item.userId?.fullName || "Unknown"}
                          </span>
                          <span className='text-[10px] text-gray-400 font-mono leading-none'>
                            {item.transactionId}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className='py-4 px-6'>
                      <span className='text-sm font-medium text-gray-900'>
                        {item.packageId?.packageName}
                      </span>
                    </td>
                    <td className='py-4 px-6'>
                      <span className='text-sm font-bold text-gray-900'>
                        {formatCurrency(item.totalAmount)}
                      </span>
                    </td>
                    <td className='py-4 px-6 text-sm text-gray-500'>
                      {formatDate(item.createdAt)}
                    </td>
                    <td className='py-4 px-6'>
                      {item.status === "confirmed" && (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100'>
                          <CheckCircle2 className='w-3 h-3' /> Confirmed
                        </span>
                      )}
                      {item.status === "waiting_confirmation" && (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-600 border border-amber-100'>
                          <AlertTriangle className='w-3 h-3' /> Verify Payment
                        </span>
                      )}
                      {item.status === "pending" && (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-600 border border-blue-100'>
                          <Clock className='w-3 h-3' /> Pay at Studio
                        </span>
                      )}
                      {item.status === "payment_rejected" && (
                        <span className='inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-600 border border-red-100'>
                          <XCircle className='w-3 h-3' /> Rejected
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='5'
                    className='py-12 text-center text-gray-400 text-sm'>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- MODALS --- */}
      {showPdfPreview && pdfUrl && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200'>
          <div className='bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200'>
            <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200'>
              <h2 className='text-lg font-bold text-gray-900'>
                Report Preview
              </h2>
              <div className='flex gap-2'>
                <button
                  onClick={handleDownloadReport}
                  className='px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold flex gap-2 items-center hover:bg-emerald-700'>
                  <Download className='w-4 h-4' /> Download
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
          </div>
        </div>
      )}

      {selectedPurchase && (
        <ReviewModal
          purchase={selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          onApprove={(data) => handleReview("approve", data)}
          onReject={() => handleReview("reject")}
          rejectionReason={rejectionReason}
          setRejectionReason={setRejectionReason}
          isProcessing={processingId === selectedPurchase._id}
        />
      )}
    </div>
  );
};

export default AdminPaymentManager;
