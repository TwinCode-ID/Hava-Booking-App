import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  X,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  DollarSign,
  Send,
  Info,
  CreditCard,
  Building2,
  QrCode,
  ChevronDown,
} from "lucide-react";
import { fetchImage } from "../../../../../../utils/helper";

// --- Custom Select Component for rendering Logos ---
const CustomSelect = ({
  options,
  value,
  onChange,
  placeholder,
  icon: Icon,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((opt) => opt.id === value);

  return (
    <div className='relative' ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className='w-full p-2.5 pl-9 pr-8 rounded-lg border border-gray-200 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:border-emerald-500 outline-none text-sm font-medium bg-white flex items-center justify-between cursor-pointer shadow-sm'>
        {Icon && (
          <Icon className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
        )}

        <div className='flex items-center gap-3 overflow-hidden'>
          {selectedOption?.logo && (
            <img
              src={selectedOption.logo}
              alt={selectedOption.name}
              className='h-4 w-auto object-contain max-w-[40px]'
            />
          )}
          <span
            className={`truncate ${selectedOption ? "text-gray-900 font-bold" : "text-gray-500"}`}>
            {selectedOption ? selectedOption.name : placeholder}
          </span>
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform absolute right-3 top-1/2 -translate-y-1/2 ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      {isOpen && (
        <div className='absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto py-1 animate-in fade-in slide-in-from-top-1'>
          {options.map((opt) => (
            <div
              key={opt.id}
              onClick={() => {
                onChange(opt.id);
                setIsOpen(false);
              }}
              className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${value === opt.id ? "bg-emerald-50 text-emerald-800" : "text-gray-700 hover:bg-gray-50"}`}>
              {opt.logo ? (
                <img
                  src={opt.logo}
                  alt={opt.name}
                  className='h-5 w-8 object-contain shrink-0'
                />
              ) : (
                <div className='h-5 w-8 shrink-0 flex items-center justify-center bg-gray-100 rounded text-[10px] font-bold text-gray-400'>
                  N/A
                </div>
              )}
              <span
                className={`text-sm ${value === opt.id ? "font-bold" : "font-medium"}`}>
                {opt.name}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- Pre-defined issuer lists with Logos ---
const BANK_OPTIONS = [
  {
    id: "BCA",
    name: "BCA",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg",
  },
  {
    id: "Mandiri",
    name: "Mandiri",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg",
  },
  {
    id: "BNI",
    name: "BNI",
    logo: "https://upload.wikimedia.org/wikipedia/commons/9/97/Logo_BNI_%28Bank_Negara_Indonesia%29.svg",
  },
  {
    id: "BRI",
    name: "BRI",
    logo: "https://upload.wikimedia.org/wikipedia/commons/2/2e/BRI_2020.svg",
  },
  {
    id: "CIMB Niaga",
    name: "CIMB Niaga",
    logo: "https://upload.wikimedia.org/wikipedia/commons/b/ba/CIMB_Niaga_logo.svg",
  },
  {
    id: "Permata",
    name: "Permata",
    logo: "https://upload.wikimedia.org/wikipedia/id/8/84/PermataBank_logo.svg",
  },
  {
    id: "BSI",
    name: "BSI",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Bank_Syariah_Indonesia.svg",
  },
  { id: "Other", name: "Other", logo: null },
];

const QRIS_OPTIONS = [
  {
    id: "Gopay",
    name: "Gopay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/86/Gopay_logo.svg",
  },
  {
    id: "OVO",
    name: "OVO",
    logo: "https://upload.wikimedia.org/wikipedia/commons/e/eb/Logo_ovo_purple.svg",
  },
  {
    id: "ShopeePay",
    name: "ShopeePay",
    logo: "https://upload.wikimedia.org/wikipedia/commons/f/fe/Shopee.svg",
  },
  {
    id: "DANA",
    name: "DANA",
    logo: "https://upload.wikimedia.org/wikipedia/commons/7/72/Logo_dana_blue.svg",
  },
  {
    id: "LinkAja",
    name: "LinkAja",
    logo: "https://upload.wikimedia.org/wikipedia/commons/8/85/LinkAja.svg",
  },
  {
    id: "BCA Mobile",
    name: "BCA Mobile",
    logo: "https://upload.wikimedia.org/wikipedia/commons/5/5c/Bank_Central_Asia.svg",
  },
  {
    id: "Livin' by Mandiri",
    name: "Livin' by Mandiri",
    logo: "https://upload.wikimedia.org/wikipedia/commons/a/ad/Bank_Mandiri_logo_2016.svg",
  },
  { id: "Other", name: "Other", logo: null },
];

const ReviewModal = ({
  purchase,
  onClose,
  onApprove,
  onReject,
  rejectionReason,
  setRejectionReason,
  isProcessing,
}) => {
  // Payment States
  const [paymentType, setPaymentType] = useState("Cash");
  const [appliCode, setAppliCode] = useState("");
  const [last4Card, setLast4Card] = useState("");
  const [qrisIssuer, setQrisIssuer] = useState("");
  const [bankIssuer, setBankIssuer] = useState("");
  const [customIssuer, setCustomIssuer] = useState("");

  const [confirmationStep, setConfirmationStep] = useState("initial");

  const isPayAtStudio = purchase.paymentMethod === "pay_at_studio";
  const status = purchase.status;
  const isConfirmed = status === "confirmed";
  const isRejected = status === "payment_rejected";
  const isExpired = purchase.paymentWindowExpiry
    ? new Date(purchase.paymentWindowExpiry) < new Date() &&
      status === "pending"
    : false;

  const showReviewActions = !isConfirmed && !isRejected && !isExpired;

  // Validation
  const isApproveDisabled = () => {
    if (!isPayAtStudio) return false;
    if (paymentType === "EDC")
      return !appliCode.trim() || last4Card.trim().length !== 4;
    if (paymentType === "QRIS") return !qrisIssuer;
    if (paymentType === "Transfer") return !bankIssuer;
    if (paymentType === "Other") return !customIssuer.trim();
    return false;
  };

  const handleConfirmApprove = () => {
    let finalIssuer = paymentType;

    // Format the issuer string based on the selected type to send to backend
    if (isPayAtStudio) {
      if (paymentType === "EDC") {
        finalIssuer = `EDC (Appli: ${appliCode}, Card: ****${last4Card})`;
      } else if (paymentType === "QRIS") {
        finalIssuer = `QRIS - ${qrisIssuer}`;
      } else if (paymentType === "Transfer") {
        finalIssuer = `Transfer - ${bankIssuer}`;
      } else if (paymentType === "Other") {
        finalIssuer = customIssuer;
      }
    }

    const payload = isPayAtStudio ? { paymentIssuer: finalIssuer } : {};
    onApprove(payload);
  };

  const handleNotifyClient = () => {
    alert("Notification sent to client!");
    onClose();
  };

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

        <div className='p-6 overflow-y-auto'>
          <div className='flex flex-col md:flex-row gap-6'>
            <div className='flex-1'>
              {isPayAtStudio ? (
                <div className='bg-emerald-50 rounded-xl p-6 border border-emerald-100 h-full flex flex-col'>
                  <div className='flex items-center gap-2 mb-6 text-emerald-800 font-bold'>
                    <DollarSign className='w-5 h-5' />
                    <span>Studio Payment Details</span>
                  </div>

                  {showReviewActions ? (
                    <div className='flex-1'>
                      <label className='block text-sm font-medium text-emerald-900 mb-3'>
                        Payment Received Via{" "}
                        <span className='text-red-500'>*</span>
                      </label>

                      {/* Payment Method Pills */}
                      <div className='grid grid-cols-3 gap-2 mb-4'>
                        {["Cash", "QRIS", "EDC", "Transfer", "Other"].map(
                          (type) => (
                            <button
                              key={type}
                              onClick={() => {
                                setPaymentType(type);
                                // Reset specific fields when switching
                                if (type !== "EDC") {
                                  setAppliCode("");
                                  setLast4Card("");
                                }
                                if (type !== "QRIS") setQrisIssuer("");
                                if (type !== "Transfer") setBankIssuer("");
                                if (type !== "Other") setCustomIssuer("");
                              }}
                              className={`py-2 px-3 rounded-lg border text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                                paymentType === type
                                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                                  : "bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-100"
                              }`}>
                              {type}
                            </button>
                          ),
                        )}
                      </div>

                      {/* Dynamic Inputs Based on Selection */}
                      <div className='animate-in fade-in slide-in-from-top-2 duration-200'>
                        {/* Custom QRIS Select */}
                        {paymentType === "QRIS" && (
                          <div className='space-y-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-sm'>
                            <label className='block text-xs font-bold text-gray-600'>
                              QRIS Issuer{" "}
                              <span className='text-red-500'>*</span>
                            </label>
                            <CustomSelect
                              options={QRIS_OPTIONS}
                              value={qrisIssuer}
                              onChange={setQrisIssuer}
                              placeholder='Select an issuer...'
                              icon={QrCode}
                            />
                          </div>
                        )}

                        {/* Custom Transfer Select */}
                        {paymentType === "Transfer" && (
                          <div className='space-y-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-sm'>
                            <label className='block text-xs font-bold text-gray-600'>
                              Bank Issuer{" "}
                              <span className='text-red-500'>*</span>
                            </label>
                            <CustomSelect
                              options={BANK_OPTIONS}
                              value={bankIssuer}
                              onChange={setBankIssuer}
                              placeholder='Select a bank...'
                              icon={Building2}
                            />
                          </div>
                        )}

                        {/* EDC Inputs */}
                        {paymentType === "EDC" && (
                          <div className='space-y-3 bg-white p-4 rounded-xl border border-emerald-100 shadow-sm'>
                            <div>
                              <label className='block text-xs font-bold text-gray-600 mb-1'>
                                Appli Code{" "}
                                <span className='text-red-500'>*</span>
                              </label>
                              <input
                                type='text'
                                value={appliCode}
                                onChange={(e) => setAppliCode(e.target.value)}
                                placeholder='e.g. 123456'
                                className='w-full p-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium'
                              />
                            </div>
                            <div>
                              <label className='block text-xs font-bold text-gray-600 mb-1'>
                                Last 4 Digits of Card{" "}
                                <span className='text-red-500'>*</span>
                              </label>
                              <div className='relative'>
                                <CreditCard className='w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
                                <input
                                  type='text'
                                  maxLength={4}
                                  value={last4Card}
                                  onChange={(e) =>
                                    setLast4Card(
                                      e.target.value.replace(/\D/g, ""),
                                    )
                                  }
                                  placeholder='e.g. 9876'
                                  className='w-full p-2.5 pl-9 rounded-lg border border-gray-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-mono'
                                />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Other Input */}
                        {paymentType === "Other" && (
                          <input
                            type='text'
                            value={customIssuer}
                            onChange={(e) => setCustomIssuer(e.target.value)}
                            placeholder='Specify custom payment method...'
                            className='w-full p-3 rounded-lg border border-emerald-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm bg-white'
                          />
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className='bg-white p-4 rounded-xl border border-emerald-100 mt-auto shadow-sm'>
                      <p className='text-xs text-emerald-600 font-bold uppercase mb-1'>
                        Received Via
                      </p>
                      <p className='text-emerald-900 font-medium'>
                        {purchase.paymentIssuer || "Not specified"}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className='bg-gray-100 rounded-xl overflow-hidden border border-gray-200 min-h-[300px] flex items-center justify-center relative'>
                  {purchase.proofOfPayment ? (
                    <img
                      src={fetchImage(purchase.proofOfPayment)}
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
                {purchase.promoCodeApplied && (
                  <div>
                    <label className='text-xs text-gray-500 uppercase font-bold'>
                      Promo Applied
                    </label>
                    <p className='font-medium text-pink-600'>
                      {purchase.promoCodeApplied} (- IDR{" "}
                      {(purchase.discountAmount || 0).toLocaleString()})
                    </p>
                  </div>
                )}
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
                {purchase.paymentIssuer && !isPayAtStudio && (
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

              <div className='mt-auto space-y-3'>
                {showReviewActions && confirmationStep === "initial" && (
                  <>
                    <button
                      onClick={() => setConfirmationStep("confirm_approve")}
                      disabled={isApproveDisabled()}
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
