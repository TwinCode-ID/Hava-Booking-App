import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  DollarSign,
  Send,
  Info,
} from "lucide-react";

const ReviewModal = ({
  purchase,
  onClose,
  onApprove,
  onReject,
  rejectionReason,
  setRejectionReason,
  isProcessing,
}) => {
  // 1. Initialize with existing issuer if available
  const [studioIssuer, setStudioIssuer] = useState(
    purchase.paymentIssuer || ""
  );
  const [confirmationStep, setConfirmationStep] = useState("initial");

  const isPayAtStudio = purchase.paymentMethod === "pay_at_studio";

  // 2. Status Logic
  const status = purchase.status;
  const isConfirmed = status === "confirmed";
  const isRejected = status === "payment_rejected";
  const isExpired = purchase.paymentWindowExpiry
    ? new Date(purchase.paymentWindowExpiry) < new Date() &&
      status === "pending"
    : false;

  // Determine if actions (Approve/Reject) should be shown
  const showReviewActions = !isConfirmed && !isRejected && !isExpired;

  // Handle final approval click
  const handleConfirmApprove = () => {
    const payload = isPayAtStudio ? { paymentIssuer: studioIssuer } : {};
    onApprove(payload);
  };

  // Mock Notification Handler
  const handleNotifyClient = () => {
    alert("Notification sent to client!");
    onClose();
  };

  // Helper to render Status Badge
  const renderStatusBadge = () => {
    if (isConfirmed) {
      return (
        <span className='inline-flex items-center gap-1.5 text-emerald-600 font-bold text-sm bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100'>
          <CheckCircle2 className='w-4 h-4' /> Confirmed
        </span>
      );
    }
    if (isRejected) {
      return (
        <span className='inline-flex items-center gap-1.5 text-red-600 font-bold text-sm bg-red-50 px-2 py-1 rounded-md border border-red-100'>
          <XCircle className='w-4 h-4' /> Rejected
        </span>
      );
    }
    if (status === "waiting_confirmation") {
      return (
        <span className='inline-flex items-center gap-1.5 text-amber-600 font-bold text-sm bg-amber-50 px-2 py-1 rounded-md border border-amber-100'>
          <AlertTriangle className='w-4 h-4' /> Verify Payment
        </span>
      );
    }
    if (status === "pending") {
      return (
        <span className='inline-flex items-center gap-1.5 text-blue-600 font-bold text-sm bg-blue-50 px-2 py-1 rounded-md border border-blue-100'>
          <Info className='w-4 h-4' /> Pay at Studio
        </span>
      );
    }
    return <span className='text-gray-500 font-medium'>Unknown Status</span>;
  };

  return (
    <div className='fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-start'>
          <div>
            <h3 className='text-xl font-bold text-gray-900'>Review Payment</h3>
            <p className='text-sm text-gray-500 font-mono mt-1'>
              ID: {purchase.transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-100 transition-colors'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6 overflow-y-auto'>
          <div className='flex flex-col md:flex-row gap-6'>
            {/* Left Side: Proof or Input */}
            <div className='flex-1'>
              {isPayAtStudio ? (
                // --- PAY AT STUDIO VIEW (Input) ---
                <div className='bg-emerald-50 rounded-xl p-6 border border-emerald-100 h-full flex flex-col justify-center'>
                  <div className='flex items-center gap-2 mb-4 text-emerald-800 font-bold'>
                    <DollarSign className='w-5 h-5' />
                    <span>Studio Payment Details</span>
                  </div>
                  <label className='block text-sm font-medium text-emerald-900 mb-2'>
                    Payment Received Via <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='text'
                    value={studioIssuer}
                    onChange={(e) => setStudioIssuer(e.target.value)}
                    placeholder='e.g. Cash, BCA EDC, QRIS...'
                    disabled={!showReviewActions} // Disable editing if not reviewable
                    className='w-full p-3 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none disabled:bg-emerald-100 disabled:text-emerald-700'
                  />
                  {showReviewActions && (
                    <p className='text-xs text-emerald-600 mt-2'>
                      Please specify how the customer paid.
                    </p>
                  )}
                </div>
              ) : (
                // --- ONLINE/TRANSFER VIEW (Image) ---
                <div className='bg-gray-100 rounded-xl overflow-hidden border border-gray-200 min-h-[300px] flex items-center justify-center relative'>
                  {purchase.proofOfPayment ? (
                    <img
                      src={purchase.proofOfPayment}
                      alt='Proof'
                      className='w-full h-full object-contain'
                    />
                  ) : (
                    <div className='text-center text-gray-400'>
                      <p>No Proof Uploaded</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Side: Details */}
            <div className='w-full md:w-72 flex flex-col gap-4'>
              <div className='p-4 bg-gray-50 rounded-xl space-y-3'>
                <div>
                  <label className='text-xs text-gray-500 uppercase font-bold'>
                    Customer
                  </label>
                  <p className='font-medium text-gray-900'>
                    {purchase.userId?.fullName}
                  </p>
                </div>
                <div>
                  <label className='text-xs text-gray-500 uppercase font-bold'>
                    Package
                  </label>
                  <p className='font-medium text-gray-900'>
                    {purchase.packageId?.packageName}
                  </p>
                </div>
                <div>
                  <label className='text-xs text-gray-500 uppercase font-bold'>
                    Amount
                  </label>
                  <p className='font-bold text-lg text-emerald-700'>
                    {new Intl.NumberFormat("id-ID", {
                      style: "currency",
                      currency: "IDR",
                      minimumFractionDigits: 0,
                    }).format(purchase.totalAmount)}
                  </p>
                </div>
                <div>
                  <label className='text-xs text-gray-500 uppercase font-bold'>
                    Method
                  </label>
                  <p className='font-medium text-gray-900 capitalize'>
                    {purchase.paymentMethod?.replace(/_/g, " ")}
                  </p>
                </div>
                {purchase.paymentIssuer && (
                  <div>
                    <label className='text-xs text-gray-500 uppercase font-bold'>
                      Issuer (Bank / QRIS)
                    </label>
                    <p className='font-medium text-gray-900 capitalize'>
                      {purchase.paymentIssuer?.replace(/_/g, " ")}
                    </p>
                  </div>
                )}
                <div>
                  <label className='text-xs text-gray-500 uppercase font-bold mb-1 block'>
                    Status
                  </label>
                  {renderStatusBadge()}
                </div>
              </div>

              {/* --- ACTION AREA --- */}
              <div className='mt-auto space-y-3'>
                {/* Scenario 1: Reviewable (Pending/Waiting) */}
                {showReviewActions && confirmationStep === "initial" && (
                  <>
                    <button
                      onClick={() => setConfirmationStep("confirm_approve")}
                      disabled={isPayAtStudio && !studioIssuer.trim()}
                      className='w-full py-3 bg-emerald-900 text-white rounded-xl font-bold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex justify-center items-center gap-2'>
                      <CheckCircle2 className='w-4 h-4' /> Approve Payment
                    </button>
                    <button
                      onClick={() => setConfirmationStep("reject")}
                      className='w-full py-3 bg-white border border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-50 transition-all flex justify-center items-center gap-2'>
                      <XCircle className='w-4 h-4' /> Reject
                    </button>
                  </>
                )}

                {/* Scenario 2: Confirm Approve */}
                {showReviewActions &&
                  confirmationStep === "confirm_approve" && (
                    <div className='bg-amber-50 p-4 rounded-xl border border-amber-100 animate-in fade-in slide-in-from-bottom-2'>
                      <div className='flex items-start gap-3 mb-3'>
                        <AlertTriangle className='w-5 h-5 text-amber-600 shrink-0' />
                        <div>
                          <p className='text-sm font-bold text-amber-800'>
                            Irreversible Action
                          </p>
                          <p className='text-xs text-amber-700 mt-1'>
                            Confirm payment?
                          </p>
                        </div>
                      </div>
                      <div className='flex gap-2'>
                        <button
                          onClick={() => setConfirmationStep("initial")}
                          className='flex-1 py-2 bg-white border border-amber-200 text-amber-700 rounded-lg text-sm font-bold hover:bg-amber-100'>
                          Cancel
                        </button>
                        <button
                          onClick={handleConfirmApprove}
                          disabled={isProcessing}
                          className='flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50'>
                          {isProcessing ? "Processing..." : "Yes"}
                        </button>
                      </div>
                    </div>
                  )}

                {/* Scenario 3: Reject Reason */}
                {showReviewActions && confirmationStep === "reject" && (
                  <div className='animate-in fade-in slide-in-from-bottom-2'>
                    <textarea
                      placeholder='Reason...'
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className='w-full p-3 rounded-xl border border-gray-300 text-sm mb-3 focus:border-red-500 outline-none'
                      rows={2}
                    />
                    <div className='flex gap-2'>
                      <button
                        onClick={() => setConfirmationStep("initial")}
                        className='flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200'>
                        Cancel
                      </button>
                      <button
                        onClick={onReject}
                        disabled={!rejectionReason.trim() || isProcessing}
                        className='flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 disabled:opacity-50'>
                        {isProcessing ? "Processing..." : "Confirm"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Scenario 4: Rejected State (Notify Client) */}
                {isRejected && (
                  <>
                    <button
                      onClick={handleNotifyClient}
                      className='w-full py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold hover:bg-red-100 transition-colors flex justify-center items-center gap-2'>
                      <Send className='w-4 h-4' /> Notify Client
                    </button>
                    <button
                      onClick={onClose}
                      className='w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200'>
                      Close
                    </button>
                  </>
                )}

                {/* Scenario 5: Confirmed/Expired (Close Only) */}
                {(isConfirmed || isExpired) && (
                  <button
                    onClick={onClose}
                    className='w-full py-3 bg-gray-100 text-gray-700 font-bold rounded-xl mt-auto hover:bg-gray-200'>
                    Close
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ReviewModal;
