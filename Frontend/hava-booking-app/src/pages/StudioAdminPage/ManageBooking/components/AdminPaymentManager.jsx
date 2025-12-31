import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, Search } from "lucide-react";
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

  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState(null);

  // --- Fetch & Action Handlers ---
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

  useEffect(() => {
    fetchPurchases();
  }, [user.adminStudioLocation]);

  const handleReview = async (action) => {
    if (!selectedPurchase) return;
    setProcessingId(selectedPurchase._id);
    try {
      await axiosInstance.post(
        API_PATHS.PURCHASES.REVIEW_PURCHASE(selectedPurchase._id),
        {
          action,
          rejectionReason: action === "reject" ? rejectionReason : null,
        }
      );
      setPurchases((prev) =>
        prev.map((p) =>
          p._id === selectedPurchase._id
            ? {
                ...p,
                status: action === "approve" ? "confirmed" : "payment_rejected",
              }
            : p
        )
      );
      setSelectedPurchase(null);
    } catch (error) {
      alert(error.response?.data?.error || "Action failed");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredPurchases = purchases.filter((p) => {
    // 1. Filter by Payment Method (Must match exact tab unless 'all')
    const matchesMethod =
      filterStatus === "all" ? true : p.paymentMethod === filterStatus;

    // --- HELPER: Removes spaces, hyphens, and underscores ---
    // Example: "Drop In - Master" becomes "dropinmaster"
    const cleanText = (text) =>
      (text || "").toLowerCase().replace(/[\s\-_]/g, "");

    // 2. Prepare Variables (Clean both the query and the data)
    const query = cleanText(searchQuery);

    const userName = cleanText(p.userId?.fullName);
    const packageName = cleanText(p.packageId?.packageName); // Now this is clean too!
    const paymentIssuer = cleanText(p.paymentIssuer);
    const paymentMethod = cleanText(p.paymentMethod);

    // 3. Search Logic
    const matchesSearch =
      userName.includes(query) ||
      packageName.includes(query) ||
      paymentIssuer.includes(query) ||
      paymentMethod.includes(query);

    return matchesMethod && matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-amber-50 text-amber-600 border-amber-100";
      case "waiting_confirmation":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "confirmed":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "payment_rejected":
        return "bg-red-50 text-red-600 border-red-100";
      default:
        return "bg-gray-100 text-gray-500";
    }
  };

  const filterOptions = [
    { id: "all", label: "All" },
    { id: "QRIS", label: "QRIS" },
    { id: "manual_transfer", label: "Transfer" },
    { id: "pay_at_studio", label: "Studio" },
  ];

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white  flex items-center font-sans'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      {/* --- HEADER --- */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 relative z-20'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Payment Reviews</h1>
          <p className='text-gray-500 text-sm mt-1'>
            Manage incoming package purchases.
          </p>
        </div>

        {/* Right Side: Actions Group */}
        <div className='flex items-center justify-end gap-3 w-full md:w-auto overflow-hidden'>
          {/* 1. Search Bar (Will shrink/move when pushed) */}
          <motion.div layout className='relative flex-1 md:w-64 transition-all'>
            <Search className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
            <input
              type='text'
              placeholder='Search transactions...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:border-2 transition-all shadow-sm whitespace-nowrap'
            />
          </motion.div>

          {/* 2. Filter Group */}
          <div className='flex items-center gap-2'>
            {/* The Animated Menu (Now pushes content) */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className='flex items-center gap-1 overflow-hidden'>
                  <div className='flex gap-1 bg-white p-1 rounded-xl border border-gray-200 shadow-sm'>
                    {filterOptions.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setFilterStatus(opt.id);
                          // setIsFilterOpen(false); // Optional: keep open to select multiple or close immediately
                        }}
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

            {/* The Trigger Button */}
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

      {/* --- LIST CONTENT --- */}
      <div className='grid grid-cols-1 gap-4 pb-20'>
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
                <p>No transactions found.</p>
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

export default AdminPaymentManager;
