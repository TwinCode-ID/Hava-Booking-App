import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  CheckCircle2,
  CreditCard,
  AlertCircle,
  FileImage,
  Copy,
  Store,
  QrCode,
  ChevronDown,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import uploadProof from "../../../../../../utils/uploadProof";
import { INDONESIAN_BANKS } from "../../../../../../utils/helper";
import { getBankLogo } from "../../../../../../utils/helpers";

// --- CUSTOM BANK DROPDOWN COMPONENT ---
const CustomBankDropdown = ({ value, onChange }) => {
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

  return (
    <div className='relative' ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className='w-full p-3 border border-gray-200 rounded-xl text-sm bg-white cursor-pointer flex items-center justify-between hover:border-emerald-500 transition-colors'>
        <div className='flex items-center gap-3'>
          {value ? (
            <>
              {value !== "OTHER" && (
                <div className='w-8 h-5 flex items-center justify-center shrink-0'>
                  {getBankLogo(value)}
                </div>
              )}
              <span className='font-medium text-gray-700'>{value}</span>
            </>
          ) : (
            <span className='text-gray-400'>Select Bank...</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar py-2'>
            {INDONESIAN_BANKS.map((bank) => (
              <div
                key={bank}
                onClick={() => {
                  onChange(bank);
                  setIsOpen(false);
                }}
                className='flex items-center gap-3 px-4 py-2.5 hover:bg-emerald-50 cursor-pointer transition-colors'>
                {bank !== "OTHER" && (
                  <div className='w-8 h-5 flex items-center justify-center shrink-0'>
                    {getBankLogo(bank)}
                  </div>
                )}
                <span className='text-sm font-medium text-gray-700'>
                  {bank}
                </span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- MAIN COMPONENT ---
const PurchaseForm = ({
  pkg,
  bankDetails = pkg?.studioLocation?.bankDetails
    ? [pkg.studioLocation.bankDetails].flat()
    : [],
  appliedPromo, // ADDED PROMO PROP
  onCancel,
  userId,
  onSuccess,
  setPaymentLoading,
}) => {
  const [paymentMethod, setPaymentMethod] = useState("manual_transfer");
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    paymentIssuer: "BCA",
    customIssuer: "",
    proofOfPayment: "",
  });

  const fileInputRef = useRef(null);

  // --- PRICE CALCULATION ---
  const effectivePrice =
    pkg?.isPromo && pkg?.promoPrice ? pkg.promoPrice : pkg?.packagePrice;
  const finalPrice = appliedPromo ? appliedPromo.newTotal : effectivePrice;

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        setError("File size too large (Max 50MB)");
        return;
      }
      setFormData((prev) => ({ ...prev, proofOfPayment: selectedFile }));
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (paymentMethod !== "pay_at_studio" && !formData.proofOfPayment) {
      setError("Please upload your payment proof.");
      return;
    }

    if (
      paymentMethod === "manual_transfer" &&
      formData.paymentIssuer === "OTHER" &&
      !formData.customIssuer.trim()
    ) {
      setError("Please specify your payment issuer.");
      return;
    }

    setLoading(true);
    if (setPaymentLoading) setPaymentLoading(true);
    setError("");

    try {
      let paymentUrl = "";

      if (formData.proofOfPayment) {
        const imgUploadRes = await uploadProof(formData.proofOfPayment, userId);
        paymentUrl = imgUploadRes.imageUrl || "";
      }

      let finalIssuer = formData.paymentIssuer;
      if (
        paymentMethod === "manual_transfer" &&
        formData.paymentIssuer === "OTHER"
      ) {
        finalIssuer = formData.customIssuer;
      } else if (paymentMethod === "QRIS") {
        finalIssuer = "QRIS";
      } else if (paymentMethod === "pay_at_studio") {
        finalIssuer = "";
      }

      // FIXED PAYLOAD: Using the correct variables from state & adding promo data
      await axiosInstance.post(API_PATHS.PURCHASES.CREATE, {
        packageId: pkg._id,
        totalAmount: finalPrice,
        promoCodeApplied: appliedPromo ? appliedPromo.appliedCode : null,
        discountAmount: appliedPromo ? appliedPromo.discountAmount : 0,
        paymentMethod: paymentMethod,
        paymentIssuer: finalIssuer,
        proofOfPayment: paymentUrl,
        issuingStudio: pkg.studioLocation?._id || pkg.studioLocation,
        userId: userId,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Purchase failed. Please try again.",
      );
    } finally {
      setLoading(false);
      if (setPaymentLoading) setPaymentLoading(false);
    }
  };

  if (success) {
    return (
      <div className='flex flex-col items-center justify-center py-12 text-center'>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className='w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 text-emerald-600'>
          <CheckCircle2 className='w-10 h-10' />
        </motion.div>
        <h3 className='text-2xl font-bold text-gray-900 mb-2'>
          Order Submitted!
        </h3>
        <p className='text-gray-500 max-w-xs mx-auto mb-8'>
          {paymentMethod === "pay_at_studio"
            ? "Please complete your payment at the front desk before your class."
            : "Your payment proof has been sent. We will verify it shortly."}
        </p>
        <button
          onClick={onSuccess}
          className='bg-emerald-900 text-white px-8 py-3 rounded-xl font-bold'>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6 p-4'>
      {/* 2. Payment Method Selector */}
      <div>
        <label className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block'>
          Select Payment Method
        </label>
        <div className='grid grid-cols-3 gap-3'>
          <PaymentOption
            active={paymentMethod === "manual_transfer"}
            onClick={() => setPaymentMethod("manual_transfer")}
            icon={CreditCard}
            label='Manual Transfer'
          />
          <PaymentOption
            active={paymentMethod === "QRIS"}
            onClick={() => setPaymentMethod("QRIS")}
            icon={QrCode}
            label='QRIS'
          />
          <PaymentOption
            active={paymentMethod === "pay_at_studio"}
            onClick={() => setPaymentMethod("pay_at_studio")}
            icon={Store}
            label='At Studio'
          />
        </div>
      </div>

      {/* --- CONDITIONAL ISSUER SELECT --- */}
      <AnimatePresence>
        {paymentMethod === "manual_transfer" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className='space-y-3'>
            <label className='text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1'>
              Transfer From (Your Bank)
            </label>
            <CustomBankDropdown
              value={formData.paymentIssuer}
              onChange={(val) =>
                setFormData({ ...formData, paymentIssuer: val })
              }
            />

            {formData.paymentIssuer === "OTHER" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block'>
                  Specify Bank Name
                </label>
                <input
                  type='text'
                  value={formData.customIssuer}
                  onChange={(e) =>
                    setFormData({ ...formData, customIssuer: e.target.value })
                  }
                  className='w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-all text-sm'
                  placeholder='e.g. Bank Jago, SeaBank...'
                />
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Conditional Content Based on Method */}
      <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block'>
        Transfer to Studio Account:
      </p>
      <div className='bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 relative transition-all'>
        {/* VIEW: Manual Transfer */}
        {paymentMethod === "manual_transfer" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar'>
            {bankDetails.length > 0 ? (
              bankDetails.map((bank) => (
                <div
                  key={bank._id}
                  className='flex justify-between items-center p-3 border border-gray-100 rounded-xl bg-gray-50 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors'>
                  {/* Container for Logo + Details */}
                  <div className='flex items-center gap-4'>
                    <div className='w-12 h-8 flex items-center justify-center bg-white rounded-md border border-gray-200 p-1 shrink-0'>
                      {getBankLogo(bank.bankName)}
                    </div>
                    <div>
                      <p className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                        {bank.bankName}
                      </p>
                      <p className='text-lg font-mono font-bold text-gray-900 mt-0.5'>
                        {bank.accountNumber}
                      </p>
                      <p className='text-xs text-gray-600 mt-0.5'>
                        a/n{" "}
                        <span className='font-medium text-gray-800'>
                          {bank.accountHolderName}
                        </span>
                      </p>
                    </div>
                  </div>

                  <CopyButton text={bank.accountNumber} />
                </div>
              ))
            ) : (
              <p className='text-sm text-gray-500 italic py-2'>
                No bank details available. Please contact the studio.
              </p>
            )}
          </motion.div>
        )}

        {/* VIEW: QR Payment */}
        {paymentMethod === "QRIS" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='flex flex-col items-center text-center py-2'>
            <div className='bg-gray-100 p-2 rounded-lg mb-3'>
              <QrCode className='w-24 h-24 text-gray-800' />
            </div>
            <p className='text-sm font-bold text-gray-900'>Scan QRIS to Pay</p>
            <p className='text-xs text-gray-500'>
              Accepts GoPay, OVO, BCA Mobile
            </p>
          </motion.div>
        )}

        {/* VIEW: Pay at Studio */}
        {paymentMethod === "pay_at_studio" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='flex flex-col items-center text-center py-4'>
            <Store className='w-10 h-10 text-emerald-600 mb-2' />
            <p className='text-sm font-bold text-gray-900'>Pay at Front Desk</p>
            <p className='text-xs text-gray-500 max-w-50'>
              Please make payment at the studio reception before your session
              begins.
            </p>
          </motion.div>
        )}
      </div>

      {/* Added clear transfer instructions matching the screenshot */}
      {(paymentMethod === "manual_transfer" || paymentMethod === "QRIS") && (
        <div className='bg-[#FFFBEB] border border-amber-200 rounded-xl p-4 mt-2'>
          <h4 className='text-[#92400E] text-[13px] font-bold mb-1'>
            Transfer Instructions
          </h4>
          <p className='text-[#92400E] text-[13px]'>
            Please transfer the exact amount of{" "}
            <strong>
              {new Intl.NumberFormat("id-ID").format(finalPrice)} IDR
            </strong>{" "}
            to the studio's account. Upload your receipt below to complete the
            purchase.
          </p>
        </div>
      )}

      {/* 4. Proof Upload */}
      <AnimatePresence>
        {paymentMethod !== "pay_at_studio" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-hidden pt-2'>
            <h3 className='text-sm font-bold text-gray-900 mb-3 flex items-center gap-2'>
              <Upload className='w-4 h-4 text-emerald-600' />
              Upload Payment Proof
            </h3>

            <div
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer min-h-30 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 transition-all ${
                previewUrl
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
              }`}>
              {previewUrl ? (
                <div className='relative w-full flex flex-col items-center'>
                  <img
                    src={previewUrl}
                    alt='Preview'
                    className='h-24 object-contain rounded-lg shadow-sm'
                  />
                  <p className='text-xs text-emerald-700 mt-2 font-medium flex items-center gap-1'>
                    <CheckCircle2 className='w-3 h-3' /> Changed? Click to
                    replace
                  </p>
                </div>
              ) : (
                <>
                  <FileImage className='w-8 h-8 text-gray-400 mb-2' />
                  <p className='text-xs font-medium text-gray-700'>
                    Click to upload image
                  </p>
                </>
              )}
              <input
                type='file'
                id='proofOfPayment'
                ref={fileInputRef}
                accept='image/png, image/jpeg, image/jpg'
                onChange={handleFileChange}
                className='hidden'
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <p className='text-red-500 text-xs text-center font-medium bg-red-50 p-2 rounded-lg'>
          <AlertCircle className='w-3 h-3 inline mr-1' /> {error}
        </p>
      )}

      {/* 5. Actions */}
      <div className='flex gap-3 pt-2 border-t border-gray-100 mt-6'>
        <button
          type='button'
          onClick={onCancel}
          disabled={loading}
          className='w-1/3 py-3.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50'>
          Cancel
        </button>
        <button
          type='submit'
          disabled={
            loading ||
            (paymentMethod !== "pay_at_studio" && !formData.proofOfPayment)
          }
          className='w-2/3 py-3.5 bg-[#1D3D36] text-white font-bold rounded-xl hover:bg-[#0F2922] shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
          <CreditCard className='w-5 h-5' />
          Pay {new Intl.NumberFormat("id-ID").format(finalPrice)} IDR
        </button>
      </div>
    </form>
  );
};

// --- Sub-Components ---
const PaymentOption = ({ active, onClick, icon: Icon, label }) => (
  <button
    type='button'
    onClick={onClick}
    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${active ? "border-emerald-500 bg-emerald-50 text-emerald-900" : "border-gray-200 hover:border-emerald-200 text-gray-500"}`}>
    <Icon
      className={`w-5 h-5 ${active ? "text-emerald-600" : "text-gray-400"}`}
    />
    <span className='text-xs font-bold'>{label}</span>
  </button>
);

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type='button'
      onClick={handleCopy}
      className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${copied ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"}`}>
      {copied ? (
        <CheckCircle2 className='w-3.5 h-3.5' />
      ) : (
        <Copy className='w-3.5 h-3.5' />
      )}
      {copied ? "Copied!" : "Copy"}
    </button>
  );
};

export default PurchaseForm;
