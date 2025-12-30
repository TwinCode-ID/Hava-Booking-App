import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Eye,
  CreditCard,
  User,
  Download,
  AlertCircle,
  Clock,
  Filter,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { useAuth } from "../../../context/AuthContext";
import { API_PATHS } from "../../../utils/apiPath";

const AdminPaymentManager = () => {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);

  // Default view: "waiting_confirmation" because that's what admins need to act on
  const [filterStatus, setFilterStatus] = useState("all");

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // --- 1. Fetch All Purchases ---
  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        const response = await axiosInstance.get(
          API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation)
        );
        setPurchases(response.data);
      } catch (error) {
        console.error("Error fetching purchases:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPurchases();
  }, [user.adminStudioLocation]);

  // --- 2. Handle Approve/Reject ---
  const handleReview = async (action) => {
    if (!selectedPurchase) return;

    setProcessingId(selectedPurchase._id);

    try {
      await axiosInstance.post(
        API_PATHS.PURCHASES.REVIEW_PURCHASE(selectedPurchase._id),
        {
          action, // 'approve' or 'reject'
          rejectionReason: action === "reject" ? rejectionReason : null,
        }
      );

      // Update Local State immediately
      setPurchases((prev) =>
        prev.map((p) =>
          p._id === selectedPurchase._id
            ? {
                ...p,
                status: action === "approve" ? "confirmed" : "payment_rejected",
                rejectionReason: action === "reject" ? rejectionReason : null,
              }
            : p
        )
      );

      // Close Modal
      setSelectedPurchase(null);
      setRejectionReason("");
    } catch (error) {
      alert(error.response?.data?.error || "Action failed");
    } finally {
      setProcessingId(null);
    }
  };

  // Filter Logic
  const filteredPurchases = purchases.filter((p) =>
    filterStatus === "all" ? true : p.status === filterStatus
  );

  // --- UPDATED: Status Colors based on your Enum ---
  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-600 border-amber-100"; // Created but no proof yet
      case "waiting_confirmation":
        return "bg-blue-100 text-blue-700 border-blue-200"; // Action needed
      case "confirmed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200"; // Success
      case "payment_rejected":
        return "bg-red-50 text-red-600 border-red-100"; // Failed
      case "expired":
        return "bg-gray-100 text-gray-500 border-gray-200"; // Dead
      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Payment Reviews</h1>
          <p className='text-gray-500 text-sm mt-1'>
            Manage incoming package purchases and verify proofs.
          </p>
        </div>

        {/* --- UPDATED: Tabs based on Enum --- */}
        <div className='flex p-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto max-w-full'>
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending" },
            { id: "waiting_confirmation", label: "Needs Review" },
            { id: "confirmed", label: "Confirmed" },
            { id: "payment_rejected", label: "Rejected" },
            { id: "expired", label: "Expired" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFilterStatus(tab.id);
                fetchPurchases();
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                filterStatus === tab.id
                  ? "bg-emerald-50 text-emerald-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main List */}
      <div className='grid grid-cols-1 gap-4'>
        <AnimatePresence mode='popLayout'>
          {filteredPurchases.length > 0 ? (
            filteredPurchases.map((purchase) => (
              <PurchaseRow
                key={purchase._id}
                purchase={purchase}
                getStatusColor={getStatusColor}
                onReview={() => setSelectedPurchase(purchase)}
              />
            ))
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className='text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300'>
              <div className='flex flex-col items-center justify-center text-gray-400'>
                <Filter className='w-10 h-10 mb-2 opacity-20' />
                <p>No transactions found for this status.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedPurchase && (
          <ReviewModal
            purchase={selectedPurchase}
            onClose={() => setSelectedPurchase(null)}
            onApprove={() => handleReview("approve")}
            onReject={() => handleReview("reject")}
            rejectionReason={rejectionReason}
            setRejectionReason={setRejectionReason}
            isProcessing={processingId === selectedPurchase._id}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Sub-Component: List Row ---
const PurchaseRow = ({ purchase, getStatusColor, onReview }) => {
  const date = new Date(purchase.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-center justify-between gap-4'>
      {/* Left: User & Pack Info */}
      <div className='flex items-center gap-4 w-full md:w-auto'>
        <div className='w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 shrink-0'>
          <User className='w-6 h-6' />
        </div>
        <div>
          <h3 className='font-bold text-gray-900'>
            {purchase.userId?.fullName || "Unknown User"}
          </h3>
          <p className='text-sm text-gray-500 flex items-center gap-2'>
            <span className='bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600 font-medium font-mono'>
              {purchase.transactionId}
            </span>
            <span className='text-gray-300'>•</span>
            <span className='flex items-center gap-1 text-xs'>
              <Clock className='w-3 h-3' /> {date}
            </span>
          </p>
        </div>
      </div>

      {/* Middle: Details */}
      <div className='flex flex-wrap gap-6 text-sm text-gray-600 w-full md:w-auto'>
        <div className='flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200'>
          <CreditCard className='w-4 h-4 text-emerald-600' />
          {purchase.packageId?.packageName || "Deleted Package"}
        </div>
        <div className='font-mono font-bold text-gray-900 flex items-center bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200'>
          IDR {purchase.totalAmount?.toLocaleString()}
        </div>
      </div>

      {/* Right: Status & Action */}
      <div className='flex items-center gap-4 w-full md:w-auto justify-between md:justify-end'>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border capitalize whitespace-nowrap ${getStatusColor(
            purchase.status
          )}`}>
          {purchase.status.replace("_", " ")}
        </span>

        {/* --- UPDATED: Only show REVIEW if status is 'waiting_confirmation' --- */}

        <button
          onClick={onReview}
          className='flex items-center gap-2 bg-emerald-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20 active:scale-95'>
          <Eye className='w-4 h-4' /> Review
        </button>
      </div>
    </motion.div>
  );
};

// --- Sub-Component: Review Modal (Unchanged mostly, just ensure correct field access) ---
const ReviewModal = ({
  purchase,
  onClose,
  onApprove,
  onReject,
  rejectionReason,
  setRejectionReason,
  isProcessing,
}) => {
  const [rejectMode, setRejectMode] = useState(false);

  return (
    <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]'>
        {/* Modal Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>
              Review Payment Proof
            </h2>
            <p className='text-sm text-gray-500'>
              Transaction ID: {purchase.transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-200 rounded-full text-gray-500'>
            <XCircle className='w-6 h-6' />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className='p-6 overflow-y-auto grow'>
          <div className='flex flex-col md:flex-row gap-6'>
            {/* Image Preview */}
            <div className='flex-1 bg-gray-100 rounded-2xl flex items-center justify-center min-h-[300px] overflow-hidden relative group border border-gray-200'>
              {purchase.proofOfPayment ? (
                <a
                  href={purchase.proofOfPayment}
                  target='_blank'
                  rel='noreferrer'>
                  <img
                    src={purchase.proofOfPayment}
                    alt='Proof'
                    className='w-full h-full object-contain max-h-[400px]'
                  />
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium'>
                    Click to Open Original <Download className='ml-2 w-4 h-4' />
                  </div>
                </a>
              ) : (
                <div className='text-gray-400 flex flex-col items-center'>
                  <AlertCircle className='w-10 h-10 mb-2 opacity-50' />
                  <span className='text-sm'>No Proof Uploaded</span>
                </div>
              )}
            </div>

            {/* Transaction Details */}
            <div className='w-full md:w-1/3 space-y-5'>
              <div className='bg-gray-50 p-4 rounded-xl space-y-3'>
                <DetailItem
                  label='User Name'
                  value={purchase.userId?.fullName}
                />
                <DetailItem
                  label='Payment Method'
                  value={purchase.paymentMethod}
                />
                <DetailItem
                  label='Payment Issuer'
                  value={purchase.paymentIssuer}
                />
                <DetailItem
                  label='Amount'
                  value={`IDR ${purchase.totalAmount?.toLocaleString()}`}
                />
                <DetailItem
                  label='Date'
                  value={new Date(purchase.createdAt).toLocaleDateString()}
                />
              </div>

              <div className=''>
                <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1'>
                  Package Details
                </p>
                <div className='bg-emerald-50 p-4 rounded-xl border border-emerald-100'>
                  <p className='font-bold text-emerald-900 text-sm'>
                    {purchase.packageId?.packageName}
                  </p>
                  <p className='text-xs text-emerald-700 mt-1 font-medium'>
                    {purchase.creditsPurchased} Credits
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rejection Input */}
          <AnimatePresence>
            {rejectMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className='overflow-hidden mt-6'>
                <label className='block text-sm font-bold text-red-700 mb-2'>
                  Reason for Rejection{" "}
                  <span className='text-red-400 font-normal'>(Required)</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className='w-full p-3 rounded-xl border border-red-200 bg-red-50 focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-20'
                  placeholder='e.g. Image is blurry, Incorrect amount transfer, etc.'
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer (Actions) */}
        <div className='p-6 border-t border-gray-100 bg-white flex justify-end gap-3'>
          {isProcessing ? (
            <div className='flex items-center text-emerald-800 font-medium px-4 bg-emerald-50 rounded-lg py-2'>
              <LoadingSpinner size='sm' />
              <span className='ml-2'>Processing...</span>
            </div>
          ) : (
            <>
              {purchase.status === "waiting_confirmation" ? (
                <>
                  {!rejectMode ? (
                    <>
                      <button
                        onClick={() => setRejectMode(true)}
                        className='px-6 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all'>
                        Reject Payment
                      </button>
                      <button
                        onClick={onApprove}
                        className='px-6 py-3 rounded-xl font-bold bg-emerald-900 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 active:scale-95'>
                        <CheckCircle className='w-5 h-5' /> Confirm Payment
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setRejectMode(false)}
                        className='px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100'>
                        Cancel
                      </button>
                      <button
                        onClick={onReject}
                        disabled={!rejectionReason}
                        className='px-6 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
                        Confirm Rejection
                      </button>
                    </>
                  )}
                </>
              ) : (
                <></>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const DetailItem = ({ label, value }) => (
  <div className='flex justify-between items-center border-b border-gray-100 last:border-0 pb-2 last:pb-0'>
    <p className='text-xs text-gray-400'>{label}</p>
    <p className='text-sm font-semibold text-gray-800 text-right'>
      {value || "-"}
    </p>
  </div>
);

export default AdminPaymentManager;
