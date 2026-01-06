import React, { useState, useRef } from "react";
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
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import CustomSelect from "../../layout/CustomSelect";
import uploadProof from "../../../../utils/uploadProof";

const PurchaseForm = ({ pkg, onCancel, userId }) => {
  // --- Payment Method State ---
  const [paymentMethod, setPaymentMethod] = useState("manual_transfer");

  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // --- Form Data ---
  const [formData, setFormData] = useState({
    paymentIssuer: "BCA", // Default to BCA for transfer
    customIssuer: "", // For "OTHER" input
    proofOfPayment: "",
  });

  const fileInputRef = useRef(null);

  const issuerOptions = ["BCA", "BNI", "MANDIRI", "BRI", "OTHER"];

  const formattedPrice = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(pkg.packagePrice);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size too large (Max 5MB)");
        return;
      }
      setFormData((prev) => ({ ...prev, proofOfPayment: selectedFile }));
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate: Only require file if NOT paying at studio
    if (paymentMethod !== "pay_at_studio" && !formData.proofOfPayment) {
      setError("Please upload your payment proof.");
      return;
    }

    // Validate: Custom Issuer if "OTHER" selected
    if (
      paymentMethod === "manual_transfer" &&
      formData.paymentIssuer === "OTHER" &&
      !formData.customIssuer.trim()
    ) {
      setError("Please specify your payment issuer.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      let paymentUrl = "";

      if (formData.proofOfPayment) {
        const imgUploadRes = await uploadProof(formData.proofOfPayment, userId);
        paymentUrl = imgUploadRes.imageUrl || "";
      }

      // Determine final issuer string
      let finalIssuer = formData.paymentIssuer;
      if (
        paymentMethod === "manual_transfer" &&
        formData.paymentIssuer === "OTHER"
      ) {
        finalIssuer = formData.customIssuer;
      } else if (paymentMethod === "QRIS") {
        finalIssuer = "QRIS";
      } else if (paymentMethod === "pay_at_studio") {
        finalIssuer = ""; // Or leave empty/handle on backend
      }

      await axiosInstance.post(API_PATHS.PURCHASES.CREATE, {
        packageId: pkg._id,
        totalAmount: pkg.packagePrice,
        paymentMethod: paymentMethod,
        paymentIssuer: finalIssuer,
        issuingStudio: pkg.studioLocation,
        proofOfPayment: paymentUrl,
      });

      setSuccess(true);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || "Purchase failed. Please try again."
      );
    } finally {
      setLoading(false);
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
          onClick={onCancel}
          className='bg-emerald-900 text-white px-8 py-3 rounded-xl font-bold'>
          Done
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-6'>
      {/* 1. Order Summary */}
      <div className='bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center'>
        <div>
          <p className='text-xs text-gray-500 font-bold uppercase tracking-wide'>
            Package
          </p>
          <p className='font-bold text-gray-900'>{pkg.packageName}</p>
        </div>
        <div className='text-right'>
          <p className='text-xs text-gray-500 font-bold uppercase tracking-wide'>
            Total
          </p>
          <p className='font-bold text-emerald-700 text-lg'>{formattedPrice}</p>
        </div>
      </div>

      {/* 2. Payment Method Selector */}
      <div>
        <label className='text-sm font-bold text-gray-900 mb-3 block'>
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
            <CustomSelect
              label='Transfer From (Bank Name)'
              options={issuerOptions}
              value={formData.paymentIssuer}
              onChange={(val) =>
                setFormData({ ...formData, paymentIssuer: val })
              }
              placeholder='Select Bank'
            />

            {/* Show Text Input if "OTHER" is selected */}
            {formData.paymentIssuer === "OTHER" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
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
      <div className='bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 relative transition-all'>
        {/* VIEW: Manual Transfer */}
        {paymentMethod === "manual_transfer" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='flex justify-between items-start'>
            <div>
              <p className='text-sm text-gray-500'>Bank Central Asia (BCA)</p>
              <p className='text-lg font-mono font-bold text-gray-900 mt-1'>
                8290-123-456
              </p>
              <p className='text-xs text-gray-400 mt-1'>
                a.n. Hava Pilates Studio
              </p>
            </div>
            <CopyButton text='8290123456' />
          </motion.div>
        )}

        {/* VIEW: QR Payment */}
        {paymentMethod === "QRIS" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className='flex flex-col items-center text-center py-2'>
            <div className='bg-gray-100 p-2 rounded-lg mb-3'>
              {/* Replace with your real QR Image */}
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

      {/* 4. Proof Upload (Hidden for 'At Studio') */}
      <AnimatePresence>
        {paymentMethod !== "pay_at_studio" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className='overflow-hidden'>
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
      <div className='flex gap-3 pt-2'>
        <button
          type='button'
          onClick={onCancel}
          disabled={loading}
          className='flex-1 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50'>
          Cancel
        </button>
        <button
          type='submit'
          disabled={
            loading ||
            (paymentMethod !== "pay_at_studio" && !formData.proofOfPayment)
          }
          className='flex-1 py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
          {loading ? (
            <LoadingSpinner size='sm' color='white' />
          ) : paymentMethod === "pay_at_studio" ? (
            "Confirm Booking"
          ) : (
            "Confirm Payment"
          )}
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
    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
      active
        ? "border-emerald-500 bg-emerald-50 text-emerald-900"
        : "border-gray-200 hover:border-emerald-200 text-gray-500"
    }`}>
    <Icon
      className={`w-5 h-5 ${active ? "text-emerald-600" : "text-gray-400"}`}
    />
    <span className='text-xs font-bold'>{label}</span>
  </button>
);

const CopyButton = ({ text }) => (
  <button
    type='button'
    onClick={() => navigator.clipboard.writeText(text)}
    className='text-emerald-600 text-xs font-bold hover:underline flex items-center gap-1 bg-emerald-50 px-2 py-1 rounded-lg'>
    <Copy className='w-3 h-3' /> Copy
  </button>
);

export default PurchaseForm;
