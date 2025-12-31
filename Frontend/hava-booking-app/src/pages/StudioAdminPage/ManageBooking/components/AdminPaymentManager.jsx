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
import axiosInstance from "../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useAuth } from "../../../../context/AuthContext";
import { API_PATHS } from "../../../../utils/apiPath";
import PurchaseRow from "./PurchaseRow";
import ReviewModal from "./ReviewModal";

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

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white  flex items-center font-sans'>
        <LoadingSpinner />
      </div>
    );

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

// --- Sub-Component: Review Modal (Unchanged mostly, just ensure correct field access) ---

export default AdminPaymentManager;
