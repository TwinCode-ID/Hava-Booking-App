import React, { useState, useEffect } from "react";
import {
  X,
  ShoppingBag,
  Loader2,
  CheckCircle2,
  Activity,
  ChevronLeft,
  CalendarDays,
  Clock,
  MapPin,
  Users,
  Settings2,
  Layers,
  User,
  Tag,
  AlertCircle,
  TriangleAlert,
  Snowflake,
  AlignLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import PurchaseForm from "../../PurchasePackage/components/PurchaseForm";

const MarketplaceModal = ({
  user,
  onClose,
  onPurchaseSuccess,
  requiredClassType,
  requiredInstructorType,
  requiredStudioId,
}) => {
  const navigate = useNavigate();
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // Medical Verification States
  const [hasValidMedical, setHasValidMedical] = useState(false);
  const [showMedicalWarning, setShowMedicalWarning] = useState(false);

  // Promo States
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState(null);

  useEffect(() => {
    const fetchPackagesAndMedical = async () => {
      try {
        const [packagesRes, medicalRes] = await Promise.all([
          axiosInstance.get(API_PATHS.PACKAGES.GET_ALL),
          axiosInstance
            .get(API_PATHS.AUTH.MEDICAL_INFO(user._id))
            .catch(() => ({ data: null })),
        ]);

        setPackages(packagesRes.data);

        // Verify medical
        if (medicalRes.data && medicalRes.data.termsAndConditions) {
          setHasValidMedical(true);
        } else {
          setHasValidMedical(false);
        }
      } catch (error) {
        console.error("Failed to load packages", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackagesAndMedical();
  }, [user._id]);

  // SMART FILTERING LOGIC
  const filteredPackages = packages
    .filter((pkg) => {
      if (!pkg.isActive) return false;

      const pStudioId = pkg.studioLocation?._id || pkg.studioLocation;
      if (requiredStudioId && pStudioId !== requiredStudioId) return false;

      let hasMatchingCredits = false;

      if (pkg.isCombo) {
        hasMatchingCredits = pkg.comboItems.some((item) => {
          const matchInst =
            !requiredInstructorType ||
            item.instructorType.includes(requiredInstructorType);
          const matchClass =
            !requiredClassType || item.classType.includes(requiredClassType);
          return matchInst && matchClass;
        });
      } else {
        const matchInst =
          !requiredInstructorType ||
          !pkg.instructorType ||
          pkg.instructorType.length === 0 ||
          pkg.instructorType.includes(requiredInstructorType);
        const matchClass =
          !requiredClassType ||
          !pkg.classType ||
          pkg.classType.length === 0 ||
          pkg.classType.includes(requiredClassType);
        hasMatchingCredits = matchInst && matchClass;
      }

      return hasMatchingCredits;
    })
    .sort((a, b) => parseInt(a.packagePrice) - parseInt(b.packagePrice));

  const handleSelectPackage = (pkg) => {
    if (!hasValidMedical) {
      setShowMedicalWarning(true);
      return;
    }
    setSelectedPackage(pkg);
    setPromoCode("");
    setAppliedPromo(null);
    setPromoMessage(null);
  };

  const handleBackToList = () => {
    setSelectedPackage(null);
    setPromoCode("");
    setAppliedPromo(null);
    setPromoMessage(null);
  };

  const handleSuccess = async () => {
    setSelectedPackage(null);
    onPurchaseSuccess();
  };

  const handleApplyPromo = async () => {
    if (!promoCode.trim() || !selectedPackage) return;
    setPromoLoading(true);
    setPromoMessage(null);

    try {
      const studioId =
        selectedPackage.studioLocation?._id || selectedPackage.studioLocation;
      const res = await axiosInstance.post("/api/promos/validate", {
        code: promoCode.trim(),
        studioId: studioId,
      });

      const validPromo = res.data;
      let discount = 0;
      const originalPrice = parseInt(
        selectedPackage.isPromo
          ? selectedPackage.promoPrice
          : selectedPackage.packagePrice,
      );

      if (validPromo.discountType === "percentage") {
        discount = originalPrice * (validPromo.discountValue / 100);
      } else if (validPromo.discountType === "fixed") {
        discount = validPromo.discountValue;
      }

      const newTotal = Math.max(0, originalPrice - discount);
      setAppliedPromo({
        ...validPromo,
        appliedCode: promoCode.toUpperCase().trim(),
        discountAmount: discount,
        newTotal: newTotal,
      });
      setPromoMessage({
        type: "success",
        text: `Promo applied: ${validPromo.title} (-${discount.toLocaleString(
          "id-ID",
        )} IDR)`,
      });
    } catch (err) {
      setPromoMessage({
        type: "error",
        text: err.response?.data?.message || "Invalid or expired promo code.",
      });
      setAppliedPromo(null);
    } finally {
      setPromoLoading(false);
    }
  };

  // Safe extractors for the side-by-side view
  const isSelectedCombo = selectedPackage?.isCombo;
  const isSelectedPromo =
    selectedPackage?.isPromo && selectedPackage?.promoPrice;
  const originalPriceFormattedModal = selectedPackage?.packagePrice
    ? parseInt(selectedPackage.packagePrice).toLocaleString("id-ID")
    : "";
  const modalDisplayPrice = appliedPromo
    ? appliedPromo.newTotal
    : isSelectedPromo
      ? selectedPackage.promoPrice
      : selectedPackage?.packagePrice;
  const modalTotalCredits = isSelectedCombo
    ? selectedPackage.comboItems?.reduce(
        (acc, item) => acc + item.credits,
        0,
      ) || 0
    : selectedPackage?.credits || 0;

  return (
    <div className='fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200'>
      {/* Modal Container */}
      <div className='bg-white w-full max-w-6xl h-[90vh] md:h-[85vh] rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200'>
        {/* Mobile Drag Handle Indicator */}
        <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 hidden max-md:block shrink-0' />

        {/* =========================================================
            HEADER (Adapts based on view)
        ========================================================= */}
        <div className='p-4 md:p-6 border-b border-gray-100 flex justify-between items-start md:items-center bg-white shrink-0 shadow-sm z-10'>
          {!selectedPackage ? (
            <div>
              <h2 className='text-lg md:text-xl font-bold text-gray-900 flex items-center gap-2'>
                <ShoppingBag className='w-5 h-5 text-emerald-600' /> Buy Credits
              </h2>
              <div className='flex flex-wrap gap-2 mt-1.5 md:mt-1'>
                <span className='text-[11px] md:text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200'>
                  Filter: {requiredInstructorType || "All"}
                </span>
                {requiredClassType && (
                  <span className='text-[11px] md:text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200'>
                    {requiredClassType}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className='flex items-center gap-3 md:gap-4'>
              <button
                onClick={handleBackToList}
                className='p-2 md:p-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full transition-colors'>
                <ChevronLeft className='w-5 h-5 text-gray-600' />
              </button>
              <h2 className='text-lg md:text-xl font-bold text-gray-900 line-clamp-1 pr-2'>
                Package Details & Checkout
              </h2>
            </div>
          )}
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0'>
            <X className='w-6 h-6 md:w-5 md:h-5 text-gray-500' />
          </button>
        </div>

        {/* =========================================================
            CONTENT BODY (List View OR Side-by-Side Checkout)
        ========================================================= */}
        <div className='flex-1 overflow-y-auto custom-scrollbar overscroll-contain bg-[#F9FAFB] relative pb-safe'>
          {/* VIEW 1: PACKAGE LIST */}
          {!selectedPackage && (
            <div className='p-4 md:p-6'>
              {loading ? (
                <div className='h-full flex items-center justify-center flex-col gap-3 pt-20'>
                  <Loader2 className='w-8 h-8 animate-spin text-emerald-600' />
                  <p className='text-sm text-gray-400'>Loading packages...</p>
                </div>
              ) : filteredPackages.length > 0 ? (
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6'>
                  {filteredPackages.map((pkg) => (
                    <div
                      key={pkg._id}
                      onClick={() => handleSelectPackage(pkg)}
                      className='bg-white border border-gray-200 rounded-2xl p-4 md:p-5 cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all group relative overflow-hidden flex flex-col h-full'>
                      <div className='absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />
                      <div className='flex-1'>
                        <h3 className='font-bold text-gray-900 text-lg md:text-lg mb-1'>
                          {pkg.packageName}
                        </h3>
                        <p className='text-xs text-gray-500 mb-4 line-clamp-2 md:line-clamp-3'>
                          {pkg.packageDescription}
                        </p>
                        <div className='flex flex-wrap gap-2 mb-4'>
                          <span className='text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold uppercase border border-emerald-100'>
                            {pkg.isCombo
                              ? "Combo Package"
                              : `${pkg.credits} Sessions`}
                          </span>
                          <span className='text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold uppercase border border-gray-200'>
                            {pkg.validityDays} Days Validity
                          </span>
                        </div>
                      </div>
                      <div className='mt-auto pt-4 border-t border-gray-50'>
                        <p className='text-lg md:text-xl font-mono font-bold text-gray-900'>
                          IDR{" "}
                          {parseInt(pkg.packagePrice).toLocaleString("id-ID")}
                        </p>
                        <button className='mt-3 w-full py-3 md:py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold md:group-hover:bg-emerald-600 transition-colors shadow-lg shadow-gray-200 active:scale-[0.98] md:active:scale-100'>
                          Select Package
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='h-full flex flex-col items-center justify-center text-center pt-20 px-4'>
                  <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
                    <ShoppingBag className='w-8 h-8 text-gray-300' />
                  </div>
                  <h3 className='text-lg md:text-xl font-bold text-gray-900'>
                    No matching packages found
                  </h3>
                  <p className='text-sm md:text-base text-gray-500 max-w-sm mt-2'>
                    We couldn't find a package specifically for{" "}
                    <strong>{requiredInstructorType}</strong> in this studio.
                    Please contact the studio.
                  </p>
                  <button
                    onClick={onClose}
                    className='mt-6 text-sm md:text-base text-emerald-600 font-bold hover:underline p-2'>
                    Go Back
                  </button>
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: SIDE-BY-SIDE CHECKOUT */}
          {selectedPackage && (
            <div className='p-4 md:p-6 lg:p-8 animate-in slide-in-from-right-8 duration-300 pb-10 md:pb-8'>
              <div className='flex flex-col lg:flex-row gap-6 md:gap-8 max-w-6xl mx-auto items-start'>
                {/* LEFT COLUMN: Package Details */}
                <div className='flex-1 flex flex-col gap-6 w-full'>
                  <div className='bg-white p-5 md:p-8 border border-gray-100 rounded-2xl md:rounded-3xl shadow-sm'>
                    <h3 className='text-base md:text-lg font-bold text-gray-900 mb-4 md:mb-5 border-b border-gray-100 pb-3'>
                      Package Details
                    </h3>

                    <div className='flex flex-wrap gap-2 mb-4 md:mb-6'>
                      {selectedPackage.isActive && (
                        <span className='inline-flex items-center gap-1.5 bg-[#E8F5EE] text-[#1E5D40] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          Active
                        </span>
                      )}
                      {selectedPackage.packageCategory?.includes("Regular") && (
                        <span className='inline-flex items-center gap-1.5 bg-[#FFF4ED] text-[#9A3412] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          Studio Regular
                        </span>
                      )}
                      {selectedPackage.isOneTimePurchase && (
                        <span className='inline-flex items-center gap-1.5 bg-[#FFFBEB] text-[#92400E] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          <TriangleAlert className='w-3 h-3' /> Limit: 1
                        </span>
                      )}
                      {selectedPackage.isAvailableToFreeze && (
                        <span className='inline-flex items-center gap-1.5 bg-[#ECFEFF] text-[#155E75] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          <Snowflake className='w-3 h-3' /> Freezable
                        </span>
                      )}
                      {isSelectedCombo && (
                        <span className='inline-flex items-center gap-1.5 bg-[#FAF5FF] text-[#6B21A8] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          <AlignLeft className='w-3 h-3' /> Combo
                        </span>
                      )}
                      {isSelectedPromo && (
                        <span className='inline-flex items-center gap-1.5 bg-[#FDF2F8] text-[#BE185D] text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded'>
                          <Tag className='w-3 h-3' /> Promo
                        </span>
                      )}
                    </div>

                    <h3
                      className={`font-semibold text-2xl md:text-[28px] leading-tight tracking-tight mb-3 ${isSelectedCombo ? "text-[#111827]" : "text-[#1D3D36]"}`}>
                      {selectedPackage.packageName}
                    </h3>

                    <div className='flex items-center flex-wrap gap-3 mb-6'>
                      {(isSelectedPromo || appliedPromo) && (
                        <span className='text-base md:text-[18px] text-[#9CA3AF] line-through font-bold'>
                          {originalPriceFormattedModal} IDR
                        </span>
                      )}
                      <span className='font-semibold text-[#1D3D36] text-3xl md:text-[32px] tracking-tight'>
                        {parseInt(modalDisplayPrice).toLocaleString("id-ID")}{" "}
                        IDR
                      </span>
                    </div>

                    <div className='text-[#4B5563] mb-6 md:mb-8 text-sm md:text-[15px]'>
                      {(() => {
                        const desc = selectedPackage.packageDescription || "";
                        const descParts = desc
                          ? desc
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean)
                          : [];

                        if (descParts.length > 1) {
                          return (
                            <ul className='space-y-3'>
                              {descParts.map((part, idx) => (
                                <li
                                  key={idx}
                                  className='flex items-start gap-3'>
                                  <CheckCircle2 className='w-5 h-5 text-[#2D8A60] shrink-0 mt-[2px]' />
                                  <span className='leading-relaxed font-medium'>
                                    {part}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          );
                        }
                        return (
                          <div className='flex items-start gap-3'>
                            <CheckCircle2 className='w-5 h-5 text-[#2D8A60] shrink-0 mt-[2px]' />
                            <span className='leading-relaxed font-medium'>
                              {desc}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className='flex items-start gap-3 md:gap-4 mb-6 md:mb-8 bg-[#F9FAFB] p-4 md:p-5 rounded-2xl border border-gray-100'>
                      <CalendarDays className='w-5 h-5 md:w-[22px] md:h-[22px] text-gray-400 shrink-0 mt-0.5' />
                      <div>
                        <p className='text-sm md:text-[15px] font-bold text-gray-900'>
                          Valid for {selectedPackage.validityDays} days from
                          date of first class booking
                        </p>
                        <p className='text-xs text-gray-500 mt-1.5 md:mt-1 font-medium'>
                          *Must activate first class within{" "}
                          {selectedPackage.activationPeriodDays || 30} days of
                          purchase
                        </p>
                      </div>
                    </div>

                    <div>
                      {!isSelectedCombo ? (
                        <div className='flex flex-col sm:flex-row gap-x-8 gap-y-4 pt-2'>
                          <div className='flex items-center gap-3'>
                            <Layers className='w-[20px] h-[20px] text-[#2D8A60] shrink-0' />
                            <span className='text-[15px] md:text-[16px] font-bold text-gray-900'>
                              {modalTotalCredits} Credits
                            </span>
                          </div>
                          <div className='flex flex-col md:flex-row flex-wrap gap-3 md:gap-2.5'>
                            {selectedPackage.instructorType &&
                              selectedPackage.instructorType.length > 0 && (
                                <span className='flex items-start md:items-center gap-1.5 text-[#374151] text-[13px] font-semibold tracking-wide rounded-md'>
                                  <User className='w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5 md:mt-0' />{" "}
                                  {selectedPackage.instructorType.join(", ")}
                                </span>
                              )}
                            {selectedPackage.classType &&
                              selectedPackage.classType.length > 0 && (
                                <span className='flex items-start md:items-center gap-1.5 text-[#374151] text-[13px] font-semibold tracking-wide rounded-md'>
                                  <Settings2 className='w-4 h-4 text-[#9CA3AF] shrink-0 mt-0.5 md:mt-0' />{" "}
                                  {selectedPackage.classType.join(", ")}
                                </span>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className='bg-[#F9FAFB] rounded-2xl p-4 md:p-6 border border-gray-100'>
                          <p className='text-[10px] md:text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-4 md:mb-5'>
                            Combo Includes
                          </p>
                          <div className='space-y-3'>
                            {selectedPackage.comboItems?.map((item, idx) => (
                              <div
                                key={idx}
                                className='bg-white rounded-2xl p-4 md:p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6'>
                                <p className='font-bold text-[#111827] text-[15px] md:text-[16px] sm:w-24 shrink-0'>
                                  {item.credits} Credits
                                </p>
                                <div className='flex flex-col gap-y-2.5 md:gap-y-3 text-[13px] md:text-[14px] text-[#4B5563] flex-1'>
                                  <div className='flex items-start gap-2.5 md:gap-3 font-medium'>
                                    <User className='w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#9CA3AF] shrink-0 mt-[2px]' />
                                    <span className='leading-relaxed'>
                                      {item.instructorType?.join(", ")}
                                    </span>
                                  </div>
                                  <div className='flex items-start gap-2.5 md:gap-3 font-medium'>
                                    <Settings2 className='w-[16px] h-[16px] md:w-[18px] md:h-[18px] text-[#9CA3AF] shrink-0 mt-[2px]' />
                                    <span className='leading-relaxed'>
                                      {item.classType?.join(", ")}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Promo Section directly below Details */}
                  <div className='bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm'>
                    <h4 className='text-[12px] md:text-[13px] font-bold text-gray-900 mb-3 md:mb-4 uppercase tracking-wider flex items-center gap-2'>
                      <Tag className='w-4 h-4 text-[#2D8A60]' /> Promo / Voucher
                      Code
                    </h4>
                    <div className='flex flex-col sm:flex-row gap-3'>
                      <input
                        type='text'
                        placeholder='ENTER CODE'
                        value={promoCode}
                        onChange={(e) =>
                          setPromoCode(e.target.value.toUpperCase())
                        }
                        disabled={appliedPromo !== null}
                        className='flex-1 px-4 py-3 md:py-3.5 bg-[#F9FAFB] border border-gray-200 rounded-xl text-sm md:text-[15px] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60] disabled:opacity-70 disabled:cursor-not-allowed'
                      />
                      {!appliedPromo ? (
                        <button
                          onClick={handleApplyPromo}
                          disabled={!promoCode.trim() || promoLoading}
                          className='w-full sm:w-auto px-6 py-3.5 bg-[#1D3D36] hover:bg-[#0F2922] text-white text-[14px] md:text-[15px] font-bold rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center min-w-[120px] shadow-sm'>
                          {promoLoading ? (
                            <Loader2 className='w-4 h-4 animate-spin' />
                          ) : (
                            "Apply"
                          )}
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAppliedPromo(null);
                            setPromoCode("");
                            setPromoMessage(null);
                          }}
                          className='w-full sm:w-auto px-6 py-3.5 bg-red-50 hover:bg-red-100 text-red-600 text-[14px] font-bold rounded-xl transition-colors flex items-center justify-center min-w-[120px] border border-red-100'>
                          Remove
                        </button>
                      )}
                    </div>
                    {promoMessage && (
                      <motion.p
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`mt-3 text-[12px] md:text-[13px] font-bold flex items-center gap-1.5 ${
                          promoMessage.type === "success"
                            ? "text-[#2D8A60]"
                            : "text-red-500"
                        }`}>
                        {promoMessage.type === "success" ? (
                          <CheckCircle2 className='w-4 h-4 shrink-0' />
                        ) : (
                          <AlertCircle className='w-4 h-4 shrink-0' />
                        )}
                        {promoMessage.text}
                      </motion.p>
                    )}
                  </div>
                </div>

                {/* RIGHT COLUMN: Checkout Form */}
                <div className='w-full lg:w-[420px] xl:w-[480px] shrink-0'>
                  <div className='bg-white p-5 md:p-8 border border-gray-100 rounded-2xl md:rounded-3xl shadow-sm lg:sticky lg:top-6'>
                    <h3 className='font-bold text-xl md:text-[22px] text-gray-900 mb-5 md:mb-6'>
                      Checkout
                    </h3>
                    <PurchaseForm
                      pkg={selectedPackage}
                      appliedPromo={appliedPromo}
                      onCancel={handleBackToList}
                      onSuccess={handleSuccess}
                      userId={user._id}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MEDICAL WARNING MODAL (Overlay on top of Marketplace) */}
      <AnimatePresence>
        {showMedicalWarning && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px]'>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className='bg-white w-full max-w-md rounded-[24px] md:rounded-[28px] shadow-2xl p-6 md:p-8 text-center relative overflow-hidden'>
              <div className='absolute -top-24 -right-24 w-48 h-48 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none' />

              <div className='relative z-10 w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-5 md:mb-6 shadow-inner border border-amber-200/50'>
                <Activity className='w-8 h-8 md:w-10 md:h-10' />
              </div>
              <h3 className='relative z-10 text-xl md:text-2xl font-extrabold text-gray-900 mb-2 md:mb-3 tracking-tight'>
                Health & Safety First
              </h3>
              <p className='relative z-10 text-gray-500 mb-6 md:mb-8 leading-relaxed text-sm md:text-[15px]'>
                To ensure your safety during sessions, we require all members to
                complete their <strong>Medical Profile</strong> and accept the{" "}
                <strong>Terms & Conditions</strong> before purchasing packages.
              </p>

              <div className='relative z-10 flex flex-col gap-3'>
                <button
                  onClick={() => {
                    onClose();
                    navigate("/client-account-settings");
                  }}
                  className='w-full py-3.5 bg-[#1D3D36] text-white text-sm md:text-base font-bold rounded-xl hover:bg-[#0F2922] shadow-lg shadow-[#1D3D36]/20 transition-all active:scale-[0.98]'>
                  Complete Medical Profile
                </button>
                <button
                  onClick={() => setShowMedicalWarning(false)}
                  className='w-full py-3.5 bg-gray-50 text-gray-600 text-sm md:text-base font-bold rounded-xl hover:bg-gray-100 transition-colors'>
                  Maybe Later
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MarketplaceModal;
