import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import QRCode from "react-qr-code";
import {
  MapPin,
  X,
  Check,
  SlidersHorizontal,
  ShoppingBag,
  Tag,
  CalendarDays,
  Clock,
  Info,
  Users,
  CheckCircle2,
  HeartPulse,
  Ticket,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  History,
  CreditCard,
  ChevronRight,
  ChevronLeft,
  UploadCloud,
  Hash,
  Search,
  Filter,
  PhoneCall,
  ShieldCheck,
  Ban,
  AlertCircle,
  FileText,
  FileIcon,
  Loader2,
  Image as ImageIcon,
  Printer,
  WalletCards,
  QrCode,
  Copy,
  Zap,
  Snowflake,
  TriangleAlert,
  AlignLeft,
  Settings2,
  User,
  Share2,
  Mail,
  AlertTriangle,
  UserMinus,
  Hourglass,
  XCircle,
  Layers,
  Activity,
  Save,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import PurchaseForm from "./PurchaseForm";
import { useAuth } from "../../../../../../context/AuthContext";
import uploadProof from "../../../../../../utils/uploadProof";
import CustomSelect from "../../../../layout/CustomSelect";

// ============================================================================
// STATUS CONFIGURATIONS
// ============================================================================
const STATUS_STYLES = {
  pending: {
    color: "text-amber-900",
    bg: "bg-amber-50",
    icon: Clock,
    label: "Payment Pending",
  },
  waiting_confirmation: {
    color: "text-amber-900",
    bg: "bg-amber-50",
    icon: Clock,
    label: "Pending Verification",
  },
  confirmed: {
    color: "text-[#1E5D40]",
    bg: "bg-[#E8F5EE]",
    icon: CheckCircle2,
    label: "Confirmed",
  },
  payment_rejected: {
    color: "text-red-950",
    bg: "bg-red-50",
    icon: Ban,
    label: "Rejected",
  },
  expired: {
    color: "text-gray-600",
    bg: "bg-gray-100",
    icon: X,
    label: "Pass Expired",
  },
};

// ============================================================================
// REUSABLE IN-LINE MEDICAL WARNING CARD
// ============================================================================
const InlineMedicalWarning = ({ onOpenModal }) => {
  return (
    <div className='bg-white p-6 md:p-8 border border-gray-100 rounded-3xl shadow-sm text-center relative overflow-hidden'>
      <div className='absolute -top-24 -right-24 w-48 h-48 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none' />

      <div className='relative z-10 w-20 h-20 bg-gradient-to-br from-amber-50 to-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner border border-amber-200/50'>
        <Activity className='w-10 h-10' />
      </div>

      <h3 className='relative z-10 text-2xl font-extrabold text-gray-900 mb-3 tracking-tight'>
        Health & Safety First
      </h3>

      <p className='relative z-10 text-gray-500 mb-8 leading-relaxed text-[15px]'>
        To ensure your safety during sessions, we require all members to
        complete their <strong>Medical Profile</strong> and accept the{" "}
        <strong>Terms & Conditions</strong> before proceeding to checkout.
      </p>

      <button
        onClick={onOpenModal}
        className='relative z-10 w-full py-3.5 bg-[#1D3D36] text-white font-bold rounded-xl hover:bg-[#0F2922] shadow-lg shadow-[#1D3D36]/20 transition-all active:scale-[0.98]'>
        Complete Medical Profile
      </button>
    </div>
  );
};

// ============================================================================
// PARENT COMPONENT: MANAGE PACKAGE
// ============================================================================
export default function ManagePackage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("packages");

  const tabs = [
    { id: "packages", label: "Marketplace", icon: ShoppingBag },
    { id: "my-passes", label: "My Studio Passes", icon: WalletCards },
    { id: "history", label: "Order History", icon: History },
  ];

  return (
    <div className='min-h-screen bg-[#F9FAFB] font-sans text-gray-900 flex flex-col'>
      {/* Header & Tabs */}
      <div className='bg-white border-b border-gray-200 pt-8 sticky top-0 z-40 shadow-sm'>
        <div className='container mx-auto px-4 md:px-6'>
          <div className='flex items-center gap-10 overflow-x-auto no-scrollbar'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className='relative pb-4 group flex items-center gap-2.5 font-bold text-[15px] transition-colors whitespace-nowrap'>
                <span
                  className={`${
                    activeTab === tab.id ? "text-[#1D3D36]" : "text-gray-400"
                  } group-hover:text-[#2D8A60] transition-colors duration-300 flex items-center gap-2.5`}>
                  <tab.icon
                    className={`w-[18px] h-[18px] ${activeTab === tab.id ? "stroke-[2.5px]" : "stroke-2"}`}
                  />
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId='activeTab'
                    className='absolute bottom-0 left-0 right-0 h-[3px] bg-[#1D3D36] rounded-t-full'
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className='flex-1'>
        <AnimatePresence mode='wait'>
          {activeTab === "packages" ? (
            <motion.div
              key='packages'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}>
              <PackageSelectorView user={user} />
            </motion.div>
          ) : activeTab === "my-passes" ? (
            <motion.div
              key='my-passes'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}>
              <UserPassesView user={user} />
            </motion.div>
          ) : (
            <motion.div
              key='history'
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}>
              <PurchaseHistoryView user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW 1: PACKAGE SELECTOR (Marketplace)
// ============================================================================
function PackageSelectorView({ user }) {
  const navigate = useNavigate();
  const [studios, setStudios] = useState([]);
  const [packages, setPackages] = useState([]);
  const [purchasedPackageIds, setPurchasedPackageIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPackageId = searchParams.get("packageId");

  // Medical Record Check State
  const [hasValidMedical, setHasValidMedical] = useState(true);
  const [isMedicalModalOpen, setIsMedicalModalOpen] = useState(false);

  const [selectedInstructorTypes, setSelectedInstructorTypes] = useState([]);
  const [selectedStudioLocations, setSelectedStudioLocations] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studiosRes, packagesRes, purchasesRes, medicalRes] =
          await Promise.all([
            axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
            axiosInstance.get(API_PATHS.PACKAGES.GET_ALL),
            axiosInstance.get(API_PATHS.PURCHASES.GET_ALL_USER(user._id)),
            axiosInstance
              .get(API_PATHS.AUTH.MEDICAL_INFO(user._id))
              .catch(() => ({ data: null })),
          ]);

        setStudios(studiosRes.data);
        setPackages(packagesRes.data);

        const boughtIds = purchasesRes.data
          .filter(
            (tx) =>
              tx.status !== "payment_rejected" && tx.status !== "rejected",
          )
          .map((tx) => tx.packageId?._id || tx.packageId);

        setPurchasedPackageIds(boughtIds);

        // Verify medical record & T&C
        if (medicalRes.data && medicalRes.data.termsAndConditions) {
          setHasValidMedical(true);
        } else {
          setHasValidMedical(false);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user._id]);

  const uniqueInstructorTypes = [
    ...new Set(packages.flatMap((p) => p.instructorType || [])),
  ].filter(Boolean);
  const uniqueStudioLocation = [
    ...new Set(
      packages.map((p) => p.studioLocation?.studioName).filter(Boolean),
    ),
  ];

  const filteredPackages = packages
    .filter((pkg) => {
      if (pkg.isOneTimePurchase && purchasedPackageIds.includes(pkg._id))
        return false;
      const matchesStudio =
        selectedStudioLocations.length === 0 ||
        selectedStudioLocations.includes(pkg.studioLocation?.studioName);
      const matchesActive = pkg.isActive;
      const matchesInstructor =
        selectedInstructorTypes.length === 0 ||
        (Array.isArray(pkg.instructorType)
          ? pkg.instructorType.some((type) =>
              selectedInstructorTypes.includes(type),
            )
          : selectedInstructorTypes.includes(pkg.instructorType));
      const price = parseInt(pkg.isPromo ? pkg.promoPrice : pkg.packagePrice);
      const min = priceMin === "" ? 0 : parseInt(priceMin);
      const max = priceMax === "" ? Infinity : parseInt(priceMax);
      const matchesPrice = price >= min && price <= max;
      return (
        matchesStudio && matchesActive && matchesInstructor && matchesPrice
      );
    })
    .sort((a, b) => {
      const priceA = parseInt(a.isPromo ? a.promoPrice : a.packagePrice);
      const priceB = parseInt(b.isPromo ? b.promoPrice : b.packagePrice);
      if (sortOrder === "asc") return priceA - priceB;
      if (sortOrder === "desc") return priceB - priceA;
      return 0;
    });

  const selectedPackage = packages.find((p) => p._id === selectedPackageId);

  const toggleFilter = (state, setter, value) => {
    setter((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  const handleOpenPurchase = (pkgId) => {
    setSearchParams({ packageId: pkgId });
    setPromoCode("");
    setAppliedPromo(null);
    setPromoMessage(null);
  };

  const handleClosePurchase = () => {
    setSearchParams({});
    setPromoCode("");
    setAppliedPromo(null);
    setPromoMessage(null);
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
      if (validPromo.discountType === "percentage")
        discount = originalPrice * (validPromo.discountValue / 100);
      else if (validPromo.discountType === "fixed")
        discount = validPromo.discountValue;

      const newTotal = Math.max(0, originalPrice - discount);
      setAppliedPromo({
        ...validPromo,
        appliedCode: promoCode.toUpperCase().trim(),
        discountAmount: discount,
        newTotal: newTotal,
      });
      setPromoMessage({
        type: "success",
        text: `Promo applied: ${validPromo.title} (-${discount.toLocaleString("id-ID")} IDR)`,
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

  if (loading)
    return (
      <div className='h-[60vh] flex flex-col items-center justify-center gap-4'>
        <LoadingSpinner />
        <p className='text-gray-500 text-sm font-medium'>
          Loading marketplace, please wait...
        </p>
      </div>
    );

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
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
        {/* SIDEBAR FILTERS (Hidden when a package is selected for checkout) */}
        {!selectedPackage && (
          <aside
            className={`lg:w-64 xl:w-72 shrink-0 space-y-10 ${
              showMobileFilters
                ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
                : "hidden lg:block"
            }`}>
            <div className='flex items-center justify-between lg:hidden mb-8'>
              <h3 className='font-bold text-xl'>Refine Marketplace</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className='p-2 bg-gray-100 rounded-full'>
                <X className='w-5 h-5' />
              </button>
            </div>

            <div className='space-y-4'>
              <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
                <MapPin className='w-4 h-4 text-[#2D8A60]' /> Studio
              </h3>
              <div className='space-y-2.5 mt-3'>
                {uniqueStudioLocation.map((type) => (
                  <label
                    key={type}
                    className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                        selectedStudioLocations.includes(type)
                          ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                          : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                      }`}>
                      {selectedStudioLocations.includes(type) && (
                        <Check className='w-3.5 h-3.5 text-white' />
                      )}
                    </div>
                    <input
                      type='checkbox'
                      className='hidden'
                      checked={selectedStudioLocations.includes(type)}
                      onChange={() =>
                        toggleFilter(
                          selectedStudioLocations,
                          setSelectedStudioLocations,
                          type,
                        )
                      }
                    />
                    <span
                      className={`text-[15px] ${
                        selectedStudioLocations.includes(type)
                          ? "text-gray-900 font-bold"
                          : "text-gray-600 font-medium"
                      }`}>
                      {type}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <hr className='border-gray-200' />
            <div className='space-y-4'>
              <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
                <Users className='w-4 h-4 text-[#2D8A60]' /> Skill Level
              </h3>
              <div className='space-y-2 mt-3'>
                {uniqueInstructorTypes.map((type) => {
                  const isSelected = selectedInstructorTypes.includes(type);
                  return (
                    <label
                      key={type}
                      className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                      <div
                        className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                          isSelected
                            ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                            : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                        }`}>
                        {isSelected && (
                          <Check className='w-3.5 h-3.5 text-white' />
                        )}
                      </div>
                      <input
                        type='checkbox'
                        className='hidden'
                        checked={isSelected}
                        onChange={() =>
                          toggleFilter(
                            selectedInstructorTypes,
                            setSelectedInstructorTypes,
                            type,
                          )
                        }
                      />
                      <span
                        className={`text-[15px] ${
                          isSelected
                            ? "text-gray-900 font-bold"
                            : "text-gray-600 font-medium"
                        }`}>
                        {type}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
            <hr className='border-gray-200' />
            <div className='space-y-4'>
              <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
                <SlidersHorizontal className='w-4 h-4 text-[#2D8A60]' /> Price
                Rank
              </h3>
              <div className='flex gap-3 mt-3'>
                <button
                  onClick={() => setSortOrder("asc")}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${
                    sortOrder === "asc"
                      ? "bg-[#1D3D36] text-white border-[#1D3D36]"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}>
                  <ArrowUpNarrowWide className='w-4 h-4' /> Lowest
                </button>
                <button
                  onClick={() => setSortOrder("desc")}
                  className={`flex-1 py-2.5 px-4 rounded-xl border text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${
                    sortOrder === "desc"
                      ? "bg-[#1D3D36] text-white border-[#1D3D36]"
                      : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                  }`}>
                  <ArrowDownNarrowWide className='w-4 h-4' /> Highest
                </button>
              </div>
            </div>
            <div className='space-y-4'>
              <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
                <Tag className='w-4 h-4 text-[#2D8A60]' /> Price Range
              </h3>
              <div className='flex items-center gap-3 mt-3'>
                <input
                  type='number'
                  placeholder='Min (IDR)'
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className='w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60]'
                />
                <span className='text-gray-400 font-medium'>—</span>
                <input
                  type='number'
                  placeholder='Max (IDR)'
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className='w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60]'
                />
              </div>
            </div>
          </aside>
        )}

        {/* MAIN CONTENT AREA */}
        <div className='flex-1'>
          {!selectedPackage ? (
            <>
              {/* GRID VIEW HEADER */}
              <div className='flex items-center justify-between mb-10 pb-4 border-b border-gray-200'>
                <p className='text-gray-500 text-[15px] font-medium'>
                  Displaying{" "}
                  <span className='font-bold text-gray-900'>
                    {filteredPackages.length}
                  </span>{" "}
                  options from{" "}
                  <span className='font-bold text-gray-900'>
                    {selectedStudioLocations.length > 0
                      ? selectedStudioLocations.join(", ")
                      : "All Studios"}
                  </span>
                </p>
                <button
                  className='lg:hidden flex items-center gap-2.5 text-sm font-bold text-gray-900 bg-white border border-gray-200 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors shadow-sm'
                  onClick={() => setShowMobileFilters(true)}>
                  <Filter className='w-4 h-4 text-[#2D8A60]' /> Filter Results
                </button>
              </div>

              {/* GRID VIEW CARDS */}
              <div className='grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-10'>
                {filteredPackages.length > 0 ? (
                  filteredPackages.map((pkg) => (
                    <PackageCardMinimal
                      key={pkg._id}
                      pkg={pkg}
                      onPurchase={() => handleOpenPurchase(pkg._id)}
                    />
                  ))
                ) : (
                  <div className='col-span-full py-24 text-center bg-white rounded-3xl border border-gray-200 shadow-sm'>
                    <div className='w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 text-gray-300'>
                      <ShoppingBag className='w-8 h-8' />
                    </div>
                    <h3 className='text-xl font-bold text-gray-900'>
                      No matching options found
                    </h3>
                    <p className='text-gray-500 mt-2 text-[15px]'>
                      Try adjusting your filters, price range, or clearing them.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* SIDE-BY-SIDE CHECKOUT VIEW */
            <div className='animate-in slide-in-from-right-8 duration-300'>
              <div className='flex items-center gap-4 mb-8 pb-6 border-b border-gray-200'>
                <button
                  onClick={handleClosePurchase}
                  className='p-2.5 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm'>
                  <ChevronLeft className='w-5 h-5 text-gray-600' />
                </button>
                <h2 className='text-2xl font-bold text-gray-900'>
                  Package Details & Checkout
                </h2>
              </div>

              <div className='flex flex-col lg:flex-row gap-8 items-start'>
                {/* LEFT COLUMN: Details & Promo */}
                <div className='flex-1 flex flex-col gap-6 w-full'>
                  {/* DETAILS CARD */}
                  <div className='bg-white p-6 md:p-8 border border-gray-100 rounded-3xl shadow-sm'>
                    <h3 className='text-lg font-bold text-gray-900 mb-5 border-b border-gray-100 pb-3'>
                      Package Details
                    </h3>

                    <div className='flex flex-wrap gap-2 mb-6'>
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
                      className={`font-semibold text-[28px] leading-tight tracking-tight mb-3 ${isSelectedCombo ? "text-[#111827]" : "text-[#1D3D36]"}`}>
                      {selectedPackage.packageName}
                    </h3>

                    <div className='flex items-center gap-3 mb-6'>
                      {(isSelectedPromo || appliedPromo) && (
                        <span className='text-[18px] text-[#9CA3AF] line-through font-bold'>
                          {originalPriceFormattedModal} IDR
                        </span>
                      )}
                      <span className='font-semibold text-[#1D3D36] text-[32px] tracking-tight'>
                        {parseInt(modalDisplayPrice).toLocaleString("id-ID")}{" "}
                        IDR
                      </span>
                    </div>

                    <div className='text-[#4B5563] mb-8 text-[15px]'>
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
                                  <CheckCircle2 className='w-[20px] h-[20px] text-[#2D8A60] shrink-0 mt-[2px]' />
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
                            <CheckCircle2 className='w-[20px] h-[20px] text-[#2D8A60] shrink-0 mt-[2px]' />
                            <span className='leading-relaxed font-medium'>
                              {desc}
                            </span>
                          </div>
                        );
                      })()}
                    </div>

                    <div className='flex gap-4 mb-8 bg-[#F9FAFB] p-5 rounded-2xl border border-gray-100'>
                      <CalendarDays className='w-[22px] h-[22px] text-gray-400 shrink-0 mt-0.5' />
                      <div>
                        <p className='text-[15px] font-bold text-gray-900'>
                          Valid for {selectedPackage.validityDays} days from
                          date of first class booking
                        </p>
                        <p className='text-[12px] text-gray-500 mt-1 font-medium'>
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
                            <span className='text-[16px] font-bold text-gray-900'>
                              {modalTotalCredits} Credits
                            </span>
                          </div>
                          <div className='flex flex-wrap gap-2.5'>
                            {selectedPackage.instructorType &&
                              selectedPackage.instructorType.length > 0 && (
                                <span className='flex items-center gap-1.5 text-[#374151] text-[13px] font-semibold tracking-wide rounded-md'>
                                  <User className='w-4 h-4 text-[#9CA3AF]' />{" "}
                                  {selectedPackage.instructorType.join(", ")}
                                </span>
                              )}
                            {selectedPackage.classType &&
                              selectedPackage.classType.length > 0 && (
                                <span className='flex items-center gap-1.5 text-[#374151] text-[13px] font-semibold tracking-wide rounded-md'>
                                  <Settings2 className='w-4 h-4 text-[#9CA3AF]' />{" "}
                                  {selectedPackage.classType.join(", ")}
                                </span>
                              )}
                          </div>
                        </div>
                      ) : (
                        <div className='bg-[#F9FAFB] rounded-2xl p-6 border border-gray-100'>
                          <p className='text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-5'>
                            Combo Includes
                          </p>
                          <div className='space-y-3'>
                            {selectedPackage.comboItems?.map((item, idx) => (
                              <div
                                key={idx}
                                className='bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center gap-6'>
                                <p className='font-bold text-[#111827] text-[16px] sm:w-24 shrink-0'>
                                  {item.credits} Credits
                                </p>
                                <div className='flex flex-col gap-y-3 text-[14px] text-[#4B5563] flex-1'>
                                  <div className='flex items-start gap-3 font-medium'>
                                    <User className='w-[18px] h-[18px] text-[#9CA3AF] shrink-0 mt-[2px]' />
                                    <span className='leading-relaxed'>
                                      {item.instructorType?.join(", ")}
                                    </span>
                                  </div>
                                  <div className='flex items-start gap-3 font-medium'>
                                    <Settings2 className='w-[18px] h-[18px] text-[#9CA3AF] shrink-0 mt-[2px]' />
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

                  {/* PROMO CARD (Only shown if medical is valid, although whole left side requires it technically) */}
                  {hasValidMedical && (
                    <div className='bg-white p-6 rounded-3xl border border-gray-100 shadow-sm'>
                      <h4 className='text-[13px] font-bold text-gray-900 mb-3 uppercase tracking-wider flex items-center gap-2'>
                        <Tag className='w-4 h-4 text-[#2D8A60]' /> Promo /
                        Voucher Code
                      </h4>
                      <div className='flex gap-3'>
                        <input
                          type='text'
                          placeholder='ENTER CODE'
                          value={promoCode}
                          onChange={(e) =>
                            setPromoCode(e.target.value.toUpperCase())
                          }
                          disabled={appliedPromo !== null}
                          className='flex-1 px-4 py-3 bg-[#F9FAFB] border border-gray-200 rounded-xl text-[15px] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60] disabled:opacity-70 disabled:cursor-not-allowed'
                        />
                        {!appliedPromo ? (
                          <button
                            onClick={handleApplyPromo}
                            disabled={!promoCode.trim() || promoLoading}
                            className='px-6 py-3 bg-[#1D3D36] hover:bg-[#0F2922] text-white text-[15px] font-bold rounded-xl transition-colors disabled:bg-gray-300 disabled:text-gray-500 flex items-center justify-center min-w-[100px] shadow-sm'>
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
                            className='px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 text-[14px] font-bold rounded-xl transition-colors flex items-center justify-center min-w-[100px] border border-red-100'>
                            Remove
                          </button>
                        )}
                      </div>
                      {promoMessage && (
                        <motion.p
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`mt-3 text-[13px] font-bold flex items-center gap-1.5 ${
                            promoMessage.type === "success"
                              ? "text-[#2D8A60]"
                              : "text-red-500"
                          }`}>
                          {promoMessage.type === "success" ? (
                            <CheckCircle2 className='w-4 h-4' />
                          ) : (
                            <AlertCircle className='w-4 h-4' />
                          )}
                          {promoMessage.text}
                        </motion.p>
                      )}
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN: Checkout Form OR Medical Warning */}
                <div className='w-full lg:w-[420px] xl:w-[480px] shrink-0 sticky top-6'>
                  {hasValidMedical ? (
                    <div className='bg-white p-6 md:p-8 border border-gray-100 rounded-3xl shadow-sm'>
                      <h3 className='font-bold text-[22px] text-gray-900 mb-6'>
                        Checkout
                      </h3>
                      {paymentLoading && (
                        <div className='absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-3xl'>
                          <LoadingSpinner size='lg' />
                          <p className='text-gray-600 font-bold mt-4'>
                            Processing your payment...
                          </p>
                        </div>
                      )}
                      <PurchaseForm
                        pkg={selectedPackage}
                        appliedPromo={appliedPromo}
                        onCancel={handleClosePurchase}
                        onSuccess={handleClosePurchase}
                        userId={user._id}
                        setPaymentLoading={setPaymentLoading}
                      />
                    </div>
                  ) : (
                    /* IN-LINE MEDICAL WARNING CARD */
                    <InlineMedicalWarning
                      onOpenModal={() => setIsMedicalModalOpen(true)}
                    />
                  )}
                </div>
              </div>
              <AnimatePresence>
                {isMedicalModalOpen && (
                  <MedicalProfileModal
                    user={user}
                    onClose={() => setIsMedicalModalOpen(false)}
                    onSuccess={() => {
                      setHasValidMedical(true);
                      setIsMedicalModalOpen(false);
                    }}
                  />
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SLEEK, MINIMALIST PACKAGE CARD (Grid View Component)
// ============================================================================
function PackageCardMinimal({ pkg, onPurchase }) {
  const isPromo = pkg.isPromo && pkg.promoPrice;
  const displayPrice = isPromo ? pkg.promoPrice : pkg.packagePrice;
  const originalPriceFormatted = parseInt(pkg.packagePrice).toLocaleString(
    "id-ID",
  );
  const priceFormatted = parseInt(displayPrice).toLocaleString("id-ID");

  const isCombo = pkg.isCombo;
  const totalCredits = isCombo
    ? pkg.comboItems?.reduce((acc, item) => acc + item.credits, 0) || 0
    : pkg.credits || 0;
  const descParts = pkg.packageDescription
    ? pkg.packageDescription
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  return (
    <div
      onClick={onPurchase}
      className={`group bg-white rounded-[24px] p-7 md:p-8 transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col h-full border relative overflow-hidden ${
        isCombo ? "border-[#2D8A60] shadow-sm" : "border-gray-200"
      }`}>
      {isCombo && (
        <div className='absolute top-0 left-0 w-2.5 h-full bg-[#2D8A60]' />
      )}

      <div className={`flex-1 mb-6 ${isCombo ? "ml-3" : ""}`}>
        <h3
          className={`text-[24px] font-semibold mb-3 tracking-tight transition-colors ${
            isCombo
              ? "text-[#2D8A60]"
              : "text-[#111827] group-hover:text-[#2D8A60]"
          }`}>
          {pkg.packageName}
        </h3>

        <div className='text-[#6B7280] text-[15px] font-medium mb-8 min-h-[44px]'>
          {descParts.length > 1 ? (
            <ul className='space-y-2'>
              {descParts.slice(0, 3).map((part, idx) => (
                <li key={idx} className='flex items-start gap-2.5'>
                  <div className='w-1.5 h-1.5 rounded-full bg-[#6B7280] mt-2 shrink-0' />
                  <span className='line-clamp-1'>{part}</span>
                </li>
              ))}
              {descParts.length > 3 && (
                <li className='text-[12px] text-[#2D8A60] font-bold pl-4'>
                  + {descParts.length - 3} more items
                </li>
              )}
            </ul>
          ) : (
            <p className='line-clamp-2 leading-relaxed'>
              {pkg.packageDescription}
            </p>
          )}
        </div>

        <div className='space-y-4 mb-8'>
          <div className='flex items-center gap-3 text-[#374151] text-[15px] font-bold'>
            <CalendarDays className='w-5 h-5 text-gray-400' />
            <span>{totalCredits} Sessions</span>
          </div>
          <div className='flex items-center gap-3 text-[#374151] text-[15px] font-bold'>
            <Clock className='w-5 h-5 text-gray-400' />
            <span>{pkg.validityDays} Days</span>
          </div>
        </div>

        {!isCombo && pkg.instructorType && pkg.instructorType.length > 0 && (
          <div className='flex flex-wrap gap-2'>
            <span className='bg-[#E8F5EE] text-[#1E5D40] text-[10px] font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-md'>
              {pkg.instructorType.join(", ")}
            </span>
          </div>
        )}
      </div>

      <div className={`mt-auto ${isCombo ? "ml-3" : ""}`}>
        <hr className='border-gray-100 mb-6' />
        <div className='flex items-end justify-between'>
          <div>
            <p className='text-[11px] text-gray-400 font-bold uppercase tracking-wider mb-1.5'>
              Total
            </p>
            {isPromo ? (
              <div className='flex items-center gap-2.5'>
                <span className='text-[#9CA3AF] line-through text-[16px] font-bold'>
                  IDR {originalPriceFormatted}
                </span>
                <span className='text-[#1D3D36] font-semibold text-[26px] tracking-tight'>
                  IDR {priceFormatted}
                </span>
              </div>
            ) : (
              <p className='text-[#1D3D36] font-semibold text-[26px] tracking-tight'>
                IDR {priceFormatted}
              </p>
            )}
          </div>

          <button
            className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all shadow-sm group-hover:shadow-md ${
              isCombo
                ? "bg-[#2D8A60] text-white hover:bg-[#1E5D40]"
                : "bg-[#111827] text-white group-hover:bg-[#2D8A60]"
            }`}>
            <ShoppingBag className='w-[22px] h-[22px]' />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// VIEW 2: MY PASSES (User's Active/Expired Packages)
// ============================================================================
function UserPassesView({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPassGroup, setSelectedPassGroup] = useState(null);
  const [selectedStatusFilters, setSelectedStatusFilters] = useState([
    "active",
  ]);
  const [selectedStudios, setSelectedStudios] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTransactions = async () => {
    try {
      if (transactions.length === 0) setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id),
      );
      setTransactions(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const handleUpdate = () => fetchTransactions();
    window.addEventListener("pass-freeze-updated", handleUpdate);
    window.addEventListener("credits-updated", handleUpdate);

    return () => {
      window.removeEventListener("pass-freeze-updated", handleUpdate);
      window.removeEventListener("credits-updated", handleUpdate);
    };
  }, [user._id]);

  const uniqueStudios = [
    ...new Set(
      transactions.map((t) => t.issuingStudio?.studioName).filter(Boolean),
    ),
  ];

  const filteredData = transactions.filter((t) => {
    const isActuallyActive = t.isActive && new Date(t.expiryDate) > new Date();
    let statusMatch = false;

    if (selectedStatusFilters.length === 0) {
      statusMatch = true;
    } else {
      if (selectedStatusFilters.includes("active") && isActuallyActive)
        statusMatch = true;
      if (selectedStatusFilters.includes("history") && !isActuallyActive)
        statusMatch = true;
    }

    const studioMatch =
      selectedStudios.length === 0 ||
      selectedStudios.includes(t.issuingStudio?.studioName);

    const query = searchQuery.toLowerCase();
    const searchMatch =
      t.packageId?.packageName?.toLowerCase().includes(query) ||
      t.packageNameSnapshot?.toLowerCase().includes(query);

    return statusMatch && studioMatch && searchMatch;
  });

  const groupedDataMap = new Map();
  filteredData.forEach((pass) => {
    const pkgId = pass.packageId?._id || pass.packageId || "unknown";
    const timeKey = new Date(pass.purchaseDate).getTime();
    const key = `${pkgId}_${timeKey}`;

    if (!groupedDataMap.has(key)) {
      groupedDataMap.set(key, {
        id: key,
        isGroup: false,
        passes: [pass],
        mainPass: pass,
        totalRemaining: pass.remainingCredits,
        totalInitial: pass.initialCredits || pass.remainingCredits,
      });
    } else {
      const group = groupedDataMap.get(key);
      group.isGroup = true;
      group.passes.push(pass);
      group.totalRemaining += pass.remainingCredits;
      group.totalInitial += pass.initialCredits || pass.remainingCredits;
    }
  });

  const displayPasses = Array.from(groupedDataMap.values());

  useEffect(() => {
    if (selectedPassGroup && displayPasses.length > 0) {
      const updatedGroup = displayPasses.find(
        (g) => g.id === selectedPassGroup.id,
      );
      if (updatedGroup) {
        setSelectedPassGroup(updatedGroup);
      }
    }
  }, [transactions]);

  const toggleStudioFilter = (studioName) => {
    setSelectedStudios((prev) =>
      prev.includes(studioName)
        ? prev.filter((item) => item !== studioName)
        : [...prev, studioName],
    );
  };

  const toggleStatusFilter = (status) => {
    setSelectedStatusFilters((prev) =>
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status],
    );
  };

  if (loading && transactions.length === 0)
    return (
      <div className='h-[60vh] flex-col flex items-center justify-center gap-4'>
        <LoadingSpinner />
        <p className='text-gray-500 text-sm font-medium'>
          Accessing studio passes...
        </p>
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
        <aside
          className={`lg:w-64 xl:w-72 shrink-0 space-y-10 ${
            showMobileFilters
              ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden lg:block"
          }`}>
          <div className='flex items-center justify-between lg:hidden mb-8'>
            <h3 className='font-bold text-xl'>Refine Passes</h3>
            <button
              onClick={() => setShowMobileFilters(false)}
              className='p-2 bg-gray-100 rounded-full'>
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
              <MapPin className='w-4 h-4 text-[#2D8A60]' /> Studio
            </h3>
            <div className='space-y-2 mt-3'>
              {uniqueStudios.length > 0 ? (
                uniqueStudios.map((studio) => (
                  <label
                    key={studio}
                    className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                    <div
                      className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                        selectedStudios.includes(studio)
                          ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                          : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                      }`}>
                      {selectedStudios.includes(studio) && (
                        <Check className='w-3.5 h-3.5 text-white' />
                      )}
                    </div>
                    <input
                      type='checkbox'
                      className='hidden'
                      checked={selectedStudios.includes(studio)}
                      onChange={() => toggleStudioFilter(studio)}
                    />
                    <span
                      className={`text-[15px] ${
                        selectedStudios.includes(studio)
                          ? "text-gray-900 font-bold"
                          : "text-gray-600 font-medium"
                      }`}>
                      {studio}
                    </span>
                  </label>
                ))
              ) : (
                <p className='text-sm text-gray-400 italic'>
                  No locations available
                </p>
              )}
            </div>
          </div>

          <hr className='border-gray-200' />

          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
              <Ticket className='w-4 h-4 text-[#2D8A60]' /> Status
            </h3>
            <div className='space-y-2 mt-3'>
              <label className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                    selectedStatusFilters.includes("active")
                      ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                      : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                  }`}>
                  {selectedStatusFilters.includes("active") && (
                    <Check className='w-3.5 h-3.5 text-white' />
                  )}
                </div>
                <input
                  type='checkbox'
                  className='hidden'
                  checked={selectedStatusFilters.includes("active")}
                  onChange={() => toggleStatusFilter("active")}
                />
                <span
                  className={`text-[15px] ${
                    selectedStatusFilters.includes("active")
                      ? "text-gray-900 font-bold"
                      : "text-gray-600 font-medium"
                  }`}>
                  Active Passes
                </span>
              </label>

              <label className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                <div
                  className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                    selectedStatusFilters.includes("history")
                      ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                      : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                  }`}>
                  {selectedStatusFilters.includes("history") && (
                    <Check className='w-3.5 h-3.5 text-white' />
                  )}
                </div>
                <input
                  type='checkbox'
                  className='hidden'
                  checked={selectedStatusFilters.includes("history")}
                  onChange={() => toggleStatusFilter("history")}
                />
                <span
                  className={`text-[15px] ${
                    selectedStatusFilters.includes("history")
                      ? "text-gray-900 font-bold"
                      : "text-gray-600 font-medium"
                  }`}>
                  Pass History / Expired
                </span>
              </label>
            </div>
          </div>
        </aside>

        <div className='flex-1'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-4 border-b border-gray-200'>
            <p className='text-gray-500 text-[15px] font-medium'>
              Showing{" "}
              <span className='font-bold text-gray-900'>
                {displayPasses.length}
              </span>{" "}
              passes
            </p>
            <div className='flex gap-2.5 w-full md:w-auto'>
              <div className='relative flex-1 md:w-72'>
                <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search by pass name...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60] shadow-sm'
                />
              </div>
              <button
                className='lg:hidden flex items-center gap-2.5 text-sm font-bold text-gray-900 bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm'
                onClick={() => setShowMobileFilters(true)}>
                <Filter className='w-4 h-4 text-[#2D8A60]' /> Filter Passes
              </button>
            </div>
          </div>

          <div className='space-y-6'>
            {displayPasses.length > 0 ? (
              displayPasses.map((group) => (
                <PassCard
                  key={group.id}
                  group={group}
                  onClick={() => setSelectedPassGroup(group)}
                />
              ))
            ) : (
              <div className='py-24 text-center bg-white rounded-3xl border border-gray-200 shadow-sm'>
                <div className='w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 text-gray-300'>
                  <WalletCards className='w-8 h-8' />
                </div>
                <h3 className='text-xl font-bold text-gray-900 mb-2'>
                  No studio passes available
                </h3>
                <p className='text-gray-500 text-[15px]'>
                  Adjust filters, search queries, or clear them to view passes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedPassGroup && (
          <PassDetailModal
            group={selectedPassGroup}
            onClose={() => {
              setSelectedPassGroup(null);
              fetchTransactions();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// VIEW 3: PURCHASE HISTORY (Transactions)
// ============================================================================
function PurchaseHistoryView({ user }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchTransactions = async () => {
    try {
      if (transactions.length === 0) setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.PURCHASES.GET_ALL_USER(user._id),
      );
      setTransactions(response.data);
    } catch (error) {
      console.error("Failed to load transaction history", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();

    const handleUpdate = () => fetchTransactions();
    window.addEventListener("credits-updated", handleUpdate);
    window.addEventListener("payment-rejected", handleUpdate);

    return () => {
      window.removeEventListener("credits-updated", handleUpdate);
      window.removeEventListener("payment-rejected", handleUpdate);
    };
  }, [user._id]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(tx.status);
    const query = searchQuery.toLowerCase();
    const packageName =
      tx.packageId?.packageName?.toLowerCase() ||
      tx.packageNameSnapshot?.toLowerCase() ||
      "";
    const transactionId = tx.transactionId?.toLowerCase() || "";
    const matchesSearch =
      transactionId.includes(query) || packageName.includes(query);
    return matchesStatus && matchesSearch;
  });

  const toggleFilter = (value) => {
    setSelectedStatuses((prev) =>
      prev.includes(value)
        ? prev.filter((item) => item !== value)
        : [...prev, value],
    );
  };

  if (loading && transactions.length === 0)
    return (
      <div className='h-[60vh] flex flex-col items-center justify-center gap-4'>
        <LoadingSpinner />
        <p className='text-gray-500 text-sm font-medium'>
          Retrieving order history...
        </p>
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
        {/* --- SIDEBAR FILTERS --- */}
        <aside
          className={`lg:w-64 xl:w-72 shrink-0 space-y-10 ${
            showMobileFilters
              ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden lg:block"
          }`}>
          <div className='flex items-center justify-between lg:hidden mb-8'>
            <h3 className='font-bold text-xl'>Refine Orders</h3>
            <button
              onClick={() => setShowMobileFilters(false)}
              className='p-2 bg-gray-100 rounded-full'>
              <X className='w-5 h-5' />
            </button>
          </div>

          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-[#1D3D36] uppercase tracking-wider flex items-center gap-2'>
              <History className='w-4 h-4 text-[#2D8A60]' /> Payment Status
            </h3>
            <div className='space-y-2 mt-3'>
              {[
                { key: "confirmed", label: "Confirmed" },
                { key: "waiting_confirmation", label: "Pending Verification" },
                { key: "pending", label: "Payment Pending" },
                { key: "payment_rejected", label: "Rejected" },
              ].map((status) => (
                <label
                  key={status.key}
                  className='flex items-center gap-3.5 cursor-pointer group py-1.5'>
                  <div
                    className={`w-5 h-5 rounded flex items-center justify-center transition-all border ${
                      selectedStatuses.includes(status.key)
                        ? "bg-[#1D3D36] border-[#1D3D36] shadow"
                        : "border-gray-300 group-hover:border-[#2D8A60] bg-white"
                    }`}>
                    {selectedStatuses.includes(status.key) && (
                      <Check className='w-3.5 h-3.5 text-white' />
                    )}
                  </div>
                  <input
                    type='checkbox'
                    className='hidden'
                    checked={selectedStatuses.includes(status.key)}
                    onChange={() => toggleFilter(status.key)}
                  />
                  <span
                    className={`text-[15px] capitalize ${
                      selectedStatuses.includes(status.key)
                        ? "text-gray-900 font-bold"
                        : "text-gray-600 font-medium"
                    }`}>
                    {status.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* --- MAIN GRID --- */}
        <div className='flex-1'>
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10 pb-4 border-b border-gray-200'>
            <div>
              <p className='text-gray-500 text-[15px] font-medium'>
                Showing{" "}
                <span className='font-bold text-gray-900'>
                  {filteredTransactions.length}
                </span>{" "}
                orders
              </p>
            </div>
            <div className='flex gap-2.5 w-full md:w-auto'>
              <div className='relative flex-1 md:w-72'>
                <Search className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search ID or package name...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[14px] focus:outline-none focus:ring-2 focus:ring-[#2D8A60] focus:border-[#2D8A60] shadow-sm'
                />
              </div>
              <button
                className='lg:hidden flex items-center gap-2.5 text-sm font-bold text-gray-900 bg-white border border-gray-200 px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm'
                onClick={() => setShowMobileFilters(true)}>
                <Filter className='w-4 h-4 text-[#2D8A60]' /> Filter Orders
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8'>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <TransactionCard
                  key={tx._id}
                  tx={tx}
                  onClick={() => setSelectedTransaction(tx)}
                />
              ))
            ) : (
              <div className='col-span-full py-24 text-center bg-white rounded-3xl border border-gray-200 shadow-sm'>
                <div className='w-16 h-16 bg-gray-50 border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-5 text-gray-300'>
                  <History className='w-8 h-8' />
                </div>
                <h3 className='text-xl font-bold text-gray-900 mb-2'>
                  No orders found
                </h3>
                <p className='text-gray-500 text-[15px]'>
                  Adjust filters, search queries, or clear them to view order
                  history.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedTransaction && (
          <TransactionDetailModal
            tx={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// OTHER SHARED COMPONENTS
// ============================================================================

function PassCard({ group, onClick }) {
  const trx = group.mainPass;
  const isExpired = !trx.isActive || new Date(trx.expiryDate) < new Date();

  // Safe extraction of freeze statuses
  const freezeStatus = trx.freeze?.status || "none";
  const isPending = freezeStatus === "requested";
  const isFrozen = freezeStatus === "approved";

  const progressPercent = Math.min(
    (group.totalRemaining / (group.totalInitial || 1)) * 100,
    100,
  );

  let pkgName = "Deleted Package";
  if (
    trx.packageNameSnapshot &&
    trx.packageNameSnapshot !== "Unknown Package" &&
    trx.packageNameSnapshot !== "Deleted Package"
  ) {
    pkgName = trx.packageNameSnapshot;
  } else if (
    trx.packageId?.packageName &&
    trx.packageId.packageName !== "Unknown Package"
  ) {
    pkgName = trx.packageId.packageName;
  }

  const formatClasses = () => {
    let classes = [];
    if (group.isGroup) {
      group.passes.forEach((p) => {
        if (p.classType && p.classType.length > 0) classes.push(...p.classType);
      });
      classes = [...new Set(classes)];
    } else {
      if (trx.classType && trx.classType.length > 0)
        classes = [...trx.classType];
    }
    return classes.length > 0 ? classes.join(", ") : "Private Sessions";
  };

  return (
    <div
      onClick={onClick}
      className='bg-white rounded-[24px] border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex overflow-hidden cursor-pointer'>
      <div
        className={`w-[10px] shrink-0 ${isExpired ? "bg-gray-400" : progressPercent < 15 ? "bg-rose-500" : "bg-[#2D8A60]"}`}></div>
      <div className='flex-1 p-5 md:p-7 flex flex-col md:flex-row justify-between items-center gap-6'>
        <div className='flex-1 w-full md:pr-6 md:border-r border-dashed border-gray-200 flex flex-col justify-center h-full'>
          <div className='mb-2.5 flex flex-wrap items-center gap-2'>
            <span
              className={`text-[10px] font-semibold px-2.5 py-1 rounded tracking-wider ${isExpired ? "bg-gray-100 text-gray-600" : "bg-[#E8F5EE] text-[#1E5D40]"}`}>
              {isExpired ? "PASS EXPIRED" : "ACTIVE PASS"}
            </span>
            {isFrozen && !isExpired && (
              <span className='text-[10px] font-bold px-2 py-1 rounded tracking-wider bg-[#ECFEFF] text-[#155E75] flex items-center gap-1.5'>
                <Snowflake size={12} /> FROZEN
              </span>
            )}
            {isPending && !isExpired && (
              <span className='text-[10px] font-bold px-2 py-1 rounded tracking-wider bg-indigo-50 text-indigo-700 flex items-center gap-1.5'>
                <Hourglass size={12} /> REQUESTED
              </span>
            )}
          </div>
          <h3
            className='text-[22px] md:text-[26px] font-semibold mb-5 text-[#111827] tracking-tight leading-snug pr-4 md:pr-8 group-hover:text-[#2D8A60] transition-colors'
            title={pkgName}>
            {pkgName}
          </h3>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-[14px] text-gray-600 font-medium'>
            <div className='flex items-center gap-2.5'>
              <CalendarDays size={18} className='text-[#2D8A60] shrink-0' />
              <span className='truncate'>
                Booked:{" "}
                {new Date(trx.purchaseDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className='flex items-center gap-2.5'>
              <Clock size={18} className='text-rose-500 shrink-0' />
              <span className='truncate'>
                Ends:{" "}
                {new Date(trx.expiryDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className='flex items-center gap-2.5'>
              <MapPin size={18} className='text-gray-400 shrink-0' />
              <span className='truncate' title={trx.issuingStudio?.studioName}>
                {trx.issuingStudio?.studioName}
              </span>
            </div>
            <div className='flex items-center gap-2.5'>
              <Users size={18} className='text-gray-400 shrink-0' />
              <span className='truncate' title={formatClasses()}>
                {formatClasses()}
              </span>
            </div>
          </div>
        </div>

        <div className='md:hidden w-full h-px border-t border-dashed border-gray-200'></div>

        <div className='w-full md:w-56 md:pl-6 flex flex-col justify-center items-center md:items-end md:pr-10 relative'>
          {!isExpired && (
            <div className='absolute -top-5 md:top-1/2 md:-translate-y-1/2 md:-left-6 z-10'>
              <button className='p-3 bg-[#E8F5EE] text-[#2D8A60] rounded-full hover:bg-[#D1EAE0] transition-colors shadow-sm'>
                <QrCode size={20} />
              </button>
            </div>
          )}

          <div className='flex flex-col items-center mt-3 md:mt-0'>
            <span
              className={`text-[64px] leading-none font-semibold tracking-tighter ${isExpired ? "text-gray-400" : "text-[#0F2922]"}`}>
              {group.totalRemaining}
            </span>
            <span className='text-[12px] font-bold text-gray-500 tracking-[0.15em] mt-2 uppercase'>
              BALANCE LEFT
            </span>
          </div>

          {!isExpired && (
            <div className='w-full max-w-[120px] bg-gray-200 h-1.5 rounded-full mt-5 overflow-hidden'>
              <div
                className={`${progressPercent < 15 ? "bg-rose-500" : "bg-[#2D8A60]"} h-full rounded-full transition-all`}
                style={{ width: `${progressPercent}%` }}></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PassDetailModal({ group, onClose }) {
  const [activeTab, setActiveTab] = useState("qr");
  const [selectedSubPassId, setSelectedSubPassId] = useState(
    group.passes[0]._id,
  );

  const activePass =
    group.passes.find((p) => p._id === selectedSubPassId) || group.passes[0];
  const isExpired =
    !activePass.isActive || new Date(activePass.expiryDate) < new Date();

  let snapshotName = "Deleted Package";
  if (
    activePass.packageNameSnapshot &&
    activePass.packageNameSnapshot !== "Unknown Package" &&
    activePass.packageNameSnapshot !== "Deleted Package"
  ) {
    snapshotName = activePass.packageNameSnapshot;
  } else if (
    activePass.packageId?.packageName &&
    activePass.packageId.packageName !== "Unknown Package"
  ) {
    snapshotName = activePass.packageId.packageName;
  }

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ type: "spring", damping: 25, stiffness: 350 }}
        className='relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
        {/* Header */}
        <div className='p-8 pb-6 border-b border-gray-100 flex justify-between items-start bg-white shrink-0'>
          <div className='space-y-1'>
            <h3 className='font-semibold text-[26px] text-[#111827] tracking-tight leading-tight'>
              {snapshotName}
            </h3>
            <p className='text-xs text-gray-500 font-mono tracking-wide'>
              Pass ID: {activePass._id}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors ml-4 shrink-0'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        {/* Multi-Session / Bundle Sub-Pass Selector */}
        {group.isGroup && (
          <div className='bg-white px-8 pt-4 pb-3 border-b border-gray-100 shrink-0'>
            <p className='text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
              Select Session Type
            </p>
            <div className='flex gap-2 overflow-x-auto no-scrollbar pb-2'>
              {group.passes.map((p) => (
                <button
                  key={p._id}
                  onClick={() => setSelectedSubPassId(p._id)}
                  className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-[13px] font-bold transition-all ${
                    selectedSubPassId === p._id
                      ? "bg-[#E8F5EE] border-[#2D8A60] text-[#1D3D36] shadow-sm"
                      : "bg-white border-gray-200 text-gray-500 hover:border-[#2D8A60]"
                  }`}>
                  {p.remainingCredits}x {p.classType?.join(", ") || "Session"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Modal Tabs */}
        {!isExpired && (
          <div className='flex border-b border-gray-100 bg-white px-8 pt-2 gap-8 shrink-0'>
            <button
              onClick={() => setActiveTab("qr")}
              className={`pb-4 text-[15px] font-bold transition-colors relative ${activeTab === "qr" ? "text-[#1D3D36]" : "text-gray-400 hover:text-gray-700"}`}>
              Check-in QR
              {activeTab === "qr" && (
                <div className='absolute bottom-0 left-0 w-full h-[3px] bg-[#1D3D36] rounded-t-full' />
              )}
            </button>
            <button
              onClick={() => setActiveTab("share")}
              className={`pb-4 text-[15px] font-bold transition-colors relative ${activeTab === "share" ? "text-[#1D3D36]" : "text-gray-400 hover:text-gray-700"}`}>
              Share Pass
              {activeTab === "share" && (
                <div className='absolute bottom-0 left-0 w-full h-[3px] bg-[#1D3D36] rounded-t-full' />
              )}
            </button>
            <button
              onClick={() => setActiveTab("freeze")}
              className={`pb-4 text-[15px] font-bold transition-colors relative ${activeTab === "freeze" ? "text-[#1D3D36]" : "text-gray-400 hover:text-gray-700"}`}>
              Freeze Request
              {activeTab === "freeze" && (
                <div className='absolute bottom-0 left-0 w-full h-[3px] bg-[#1D3D36] rounded-t-full' />
              )}
            </button>
          </div>
        )}

        <div className='p-8 overflow-y-auto bg-[#F9FAFB] flex-1'>
          {activeTab === "qr" && (
            <PassQRView pass={activePass} isExpired={isExpired} />
          )}
          {activeTab === "share" && <PassShareView pass={activePass} />}
          {activeTab === "freeze" && <PassFreezeView group={group} />}
        </div>
      </motion.div>
    </div>
  );
}

function PassQRView({ pass, isExpired }) {
  const qrValue = pass._id || "pass-no-id";
  const isFrozen = pass.freeze?.status === "approved";

  return (
    <div className='flex flex-col items-center text-center h-full justify-center'>
      <div
        className={`mb-8 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${
          isExpired
            ? "bg-gray-100 text-gray-700"
            : isFrozen
              ? "bg-[#ECFEFF] text-[#155E75]"
              : "bg-[#E8F5EE] text-[#1E5D40]"
        }`}>
        {isExpired ? (
          <Clock className='w-3.5 h-3.5' />
        ) : isFrozen ? (
          <Snowflake className='w-3.5 h-3.5' />
        ) : (
          <Clock className='w-3.5 h-3.5' />
        )}
        {isExpired
          ? "Pass Expired"
          : isFrozen
            ? "Pass Frozen"
            : "Ready for Studio Check-in"}
      </div>

      <div className='relative'>
        <div
          className={`w-64 h-64 rounded-[32px] flex items-center justify-center mb-8 border-2 border-dashed mx-auto p-4 transition-colors shadow-sm ${
            isExpired || isFrozen
              ? "bg-gray-50 border-gray-200"
              : "bg-white border-[#2D8A60]"
          }`}>
          <div
            className={`w-full h-full rounded-2xl overflow-hidden flex items-center justify-center transition-opacity ${isExpired || isFrozen ? "opacity-30" : "opacity-100"}`}>
            <QRCode
              size={256}
              style={{
                height: "auto",
                maxWidth: "100%",
                width: "100%",
                background: "white",
              }}
              value={qrValue}
              viewBox={`0 0 256 256`}
            />
          </div>
          {isExpired && <Ban className='absolute w-16 h-16 text-rose-500/80' />}
          {isFrozen && !isExpired && (
            <Snowflake className='absolute w-16 h-16 text-[#155E75]/80' />
          )}
        </div>
      </div>

      <p className='text-[15px] text-gray-500 mb-8 font-medium'>
        Present this QR code to the studio desk representative for check-in.
      </p>

      <div className='grid grid-cols-2 gap-5 w-full mt-auto'>
        <div className='bg-white p-5 rounded-2xl border border-gray-100 text-center shadow-sm'>
          <p className='text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1'>
            Balance Left
          </p>
          <p
            className={`text-[32px] font-semibold ${isExpired ? "text-gray-400" : "text-[#111827]"} tracking-tight leading-none`}>
            {pass.remainingCredits}{" "}
            <span className='text-[15px] font-semibold text-gray-500'>
              Sessions
            </span>
          </p>
        </div>
        <div className='bg-white p-5 rounded-2xl border border-gray-100 flex flex-col items-center justify-center shadow-sm'>
          <CalendarDays className='w-5 h-5 text-rose-500 mb-1.5' />
          <p className='text-[11px] text-gray-500 font-bold uppercase tracking-wider mb-1'>
            Valid Until
          </p>
          <p
            className={`text-[16px] font-bold ${isExpired ? "text-gray-400" : "text-[#111827]"}`}>
            {new Date(pass.expiryDate).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

function PassShareView({ pass }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [detachLoading, setDetachLoading] = useState(false);
  const [link, setLink] = useState(
    pass.shareCode
      ? `${window.location.origin}/shared-pass/${pass.shareCode}`
      : "",
  );
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  const isOwner = pass.userId?._id === user?._id || pass.userId === user?._id;

  const freezeStatus = pass.freeze?.status || "none";
  const isFrozen = freezeStatus === "approved";

  const handleGenerateShare = async () => {
    setLoading(true);
    try {
      const url = `/api/passes/share/${pass._id}`;
      const res = await axiosInstance.post(url);
      const newLink = `${window.location.origin}/shared-pass/${res.data.pass.shareCode}`;
      setLink(newLink);

      pass.shareCode = res.data.pass.shareCode;
      pass.isShared = res.data.pass.isShared;
    } catch (err) {
      try {
        const fbUrl = `/api/user-passes/share/${pass._id}`;
        const res = await axiosInstance.post(fbUrl);
        const newLink = `${window.location.origin}/shared-pass/${res.data.pass.shareCode}`;
        setLink(newLink);
        pass.shareCode = res.data.pass.shareCode;
        pass.isShared = res.data.pass.isShared;
      } catch (fallbackErr) {
        alert(
          fallbackErr.response?.data?.message || "Failed to generate link.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    alert("Link copied to clipboard!");
  };

  const sendEmail = async () => {
    if (!email.includes("@")) return alert("Enter valid email");
    setEmailLoading(true);
    try {
      const url = `/api/passes/share/${pass._id}/email`;
      await axiosInstance.post(url, { email, shareLink: link });
      alert("Email sent successfully!");
      setEmail("");
    } catch (err) {
      try {
        const fbUrl = `/api/user-passes/share/${pass._id}/email`;
        await axiosInstance.post(fbUrl, { email, shareLink: link });
        alert("Email sent successfully!");
        setEmail("");
      } catch (fallbackErr) {
        alert(fallbackErr.response?.data?.message || "Failed to send email");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleDetach = async (userIdToDetach, isSelf) => {
    const confirmMsg = isSelf
      ? "Are you sure you want to leave this shared pass? You will immediately lose access to its credits."
      : "Are you sure you want to remove this user? They will lose access to this pass immediately.";

    if (!window.confirm(confirmMsg)) return;

    setDetachLoading(true);
    try {
      try {
        await axiosInstance.put(`/api/passes/shared/${pass._id}/detach`, {
          userIdToDetach,
        });
      } catch (err) {
        await axiosInstance.put(`/api/user-passes/shared/${pass._id}/detach`, {
          userIdToDetach,
        });
      }

      alert(
        isSelf
          ? "You have left the shared pass."
          : "User removed successfully.",
      );
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to remove user.");
    } finally {
      setDetachLoading(false);
    }
  };

  return (
    <div className='flex flex-col h-full space-y-8'>
      {!isOwner ? (
        <div className='bg-amber-50 rounded-2xl p-6 border border-amber-100 flex flex-col items-center justify-center text-center py-8'>
          <AlertTriangle className='w-10 h-10 text-amber-500 mb-3' />
          <h4 className='text-lg font-bold text-amber-900 mb-2'>Shared Pass</h4>
          <p className='text-[14px] text-amber-700 font-medium max-w-sm mb-6'>
            You are currently using a shared pass. Only the original pass owner
            can generate new share links or invite other members.
          </p>
          <button
            onClick={() => handleDetach(user._id, true)}
            disabled={detachLoading}
            className='px-6 py-2.5 bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm w-full'>
            {detachLoading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <>
                <UserMinus className='w-4 h-4' /> Leave Shared Pass
              </>
            )}
          </button>
        </div>
      ) : isFrozen ? (
        <div className='bg-blue-50 border border-blue-200 rounded-3xl p-8 text-center shadow-sm'>
          <div className='w-16 h-16 bg-blue-100/80 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Snowflake className='w-8 h-8 text-[#155E75]' />
          </div>
          <h3 className='font-semibold text-[#155E75] text-xl mb-2'>
            Sharing Disabled
          </h3>
          <p className='text-[15px] font-medium text-cyan-800 leading-relaxed max-w-sm mx-auto'>
            Your package is currently frozen. You cannot generate new share
            links or invite users until the freeze period is over.
          </p>
        </div>
      ) : (
        <>
          <div>
            <h4 className='text-[15px] font-bold text-gray-900 mb-2 flex items-center gap-2'>
              <Share2 className='w-4 h-4 text-[#2D8A60]' /> Generate Share Link
            </h4>
            <p className='text-[14px] text-gray-500 mb-5 leading-relaxed font-medium'>
              Create a unique link to share your remaining credits with friends
              or family. They must have an account to accept.
            </p>

            {!link ? (
              <button
                onClick={handleGenerateShare}
                disabled={loading}
                className='w-full py-4 bg-[#1D3D36] text-white rounded-xl font-bold text-[15px] hover:bg-[#0F2922] transition-colors flex justify-center items-center gap-2 shadow-sm'>
                {loading ? (
                  <Loader2 className='w-5 h-5 animate-spin' />
                ) : (
                  "Generate Sharing Link"
                )}
              </button>
            ) : (
              <div className='flex gap-3'>
                <input
                  type='text'
                  readOnly
                  value={link}
                  className='flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-[14px] font-mono text-gray-600 focus:outline-none shadow-sm'
                />
                <button
                  onClick={handleCopy}
                  className='px-5 py-3 bg-[#E8F5EE] text-[#1E5D40] rounded-xl font-bold text-[14px] hover:bg-[#2D8A60] hover:text-white transition-colors border border-[#2D8A60]'>
                  Copy
                </button>
              </div>
            )}
          </div>

          {link && (
            <div className='pt-6 border-t border-gray-200'>
              <h4 className='text-[15px] font-bold text-gray-900 mb-4 flex items-center gap-2'>
                <Mail className='w-4 h-4 text-[#2D8A60]' /> Send via Email
              </h4>
              <div className='flex gap-3'>
                <input
                  type='email'
                  placeholder='friend@example.com'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className='flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#2D8A60]/20 shadow-sm'
                />
                <button
                  onClick={sendEmail}
                  disabled={emailLoading || !email}
                  className='px-6 py-3 bg-[#1D3D36] text-white rounded-xl font-bold text-[15px] hover:bg-[#0F2922] transition-colors disabled:bg-gray-300 flex items-center justify-center min-w-[90px] shadow-sm'>
                  {emailLoading ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    "Send"
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {pass.sharedWith && pass.sharedWith.length > 0 && (
        <div className='pt-6 border-t border-gray-200'>
          <h4 className='text-[15px] font-bold text-gray-900 mb-4 flex items-center gap-2'>
            <Users className='w-4 h-4 text-[#2D8A60]' /> Shared With
          </h4>
          <div className='space-y-3'>
            {pass.sharedWith.map((u, i) => (
              <div
                key={i}
                className='flex items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm'>
                <div className='flex items-center gap-4'>
                  <div className='w-10 h-10 rounded-full bg-[#E8F5EE] flex items-center justify-center text-[#1E5D40] font-semibold text-sm shrink-0'>
                    {u.fullName?.charAt(0) || "U"}
                  </div>
                  <div>
                    <p className='text-[15px] font-bold text-gray-900'>
                      {u.fullName || "User"}
                    </p>
                    <p className='text-[13px] text-gray-500 font-medium line-clamp-1'>
                      {u.email}
                    </p>
                  </div>
                </div>

                {isOwner && (
                  <button
                    onClick={() => handleDetach(u._id, false)}
                    disabled={detachLoading}
                    className='ml-3 px-3 py-1.5 text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100 shrink-0'>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PassFreezeView({ group }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState(null);
  const [customDays, setCustomDays] = useState("");

  const firstPass = group.passes[0];
  const isOwner =
    firstPass?.userId?._id === user?._id || firstPass?.userId === user?._id;

  const isPending = group.passes.some((p) => p.freeze?.status === "requested");
  const isFrozen = group.passes.some((p) => p.freeze?.status === "approved");
  const isRejected =
    group.passes.some((p) => p.freeze?.status === "rejected") &&
    !isPending &&
    !isFrozen;
  const usedAllowance =
    group.passes.some((p) => p.freeze?.hasBeenFrozen) &&
    !isPending &&
    !isFrozen;

  const activeEndDate = group.passes.find(
    (p) => p.freeze?.status === "approved",
  )?.freeze?.endDate;

  const handleFreezeRequest = async () => {
    let days = 0;
    if (mode === "week") days = 7;
    else if (mode === "month") days = 30;
    else if (mode === "custom") days = parseInt(customDays);

    if (!days || days <= 0) return alert("Please select a valid duration.");

    if (
      !window.confirm(
        `Submit freeze request for ${days} days? This will be reviewed by the studio admin.`,
      )
    )
      return;

    setLoading(true);
    try {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + days);

      const freezePromises = group.passes.map(async (p) => {
        try {
          return await axiosInstance.put(`/api/passes/freeze/${p._id}`, {
            action: "request",
            startDate: start,
            endDate: end,
          });
        } catch (e) {
          return await axiosInstance.put(`/api/user-passes/freeze/${p._id}`, {
            action: "request",
            startDate: start,
            endDate: end,
          });
        }
      });

      await Promise.all(freezePromises);

      alert("Freeze request submitted to the studio successfully!");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Failed to submit request.");
    } finally {
      setLoading(false);
    }
  };

  const SelectionCard = ({ title, desc, value, icon: Icon }) => {
    const isSelected = mode === value;
    return (
      <div
        onClick={() => setMode(value)}
        className={`cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 flex flex-col items-center justify-center gap-2 text-center shadow-sm
          ${
            isSelected
              ? "border-[#2D8A60] bg-[#E8F5EE]"
              : "border-gray-100 bg-white hover:border-[#2D8A60]/30 hover:bg-gray-50"
          }`}>
        <Icon
          className={`w-6 h-6 ${isSelected ? "text-[#1E5D40]" : "text-gray-400"}`}
        />
        <div>
          <p
            className={`font-bold text-[14px] ${isSelected ? "text-[#1D3D36]" : "text-gray-700"}`}>
            {title}
          </p>
          <p
            className={`text-[12px] font-medium mt-0.5 ${isSelected ? "text-[#2D8A60]" : "text-gray-500"}`}>
            {desc}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className='flex flex-col h-full space-y-6'>
      <div className='bg-[#ECFEFF] border border-cyan-200 rounded-2xl p-6'>
        <h4 className='text-[15px] font-bold text-cyan-900 mb-3 flex items-center gap-2'>
          <Info className='w-4 h-4 text-cyan-600' /> Freeze Policy
        </h4>
        <ul className='text-[13.5px] text-cyan-800 space-y-2 list-disc pl-4 font-medium leading-relaxed'>
          <li>
            You may request to freeze your pass to temporarily pause expiration.
          </li>
          <li>
            Once approved by the studio, it extends the validity of remaining
            credits.
          </li>
          <li>
            You generally only have <strong>one</strong> freeze allowance per
            pass.
          </li>
        </ul>
      </div>

      {!isOwner ? (
        <div className='bg-amber-50 rounded-2xl p-6 border border-amber-100 flex flex-col items-center justify-center text-center py-10'>
          <AlertTriangle className='w-10 h-10 text-amber-500 mb-3' />
          <h4 className='text-lg font-bold text-amber-900 mb-2'>Shared Pass</h4>
          <p className='text-[14px] text-amber-700 font-medium max-w-sm'>
            You are currently using a shared pass. Only the original pass owner
            can request to freeze or unfreeze this package.
          </p>
        </div>
      ) : isPending ? (
        <div className='bg-indigo-50 border border-indigo-200 rounded-3xl p-8 text-center shadow-sm mt-4'>
          <div className='w-16 h-16 bg-indigo-100/80 rounded-full flex items-center justify-center mx-auto mb-4'>
            <Hourglass className='w-8 h-8 text-indigo-600 animate-pulse' />
          </div>
          <h3 className='font-bold text-indigo-900 text-xl mb-2'>
            Request Already Submitted
          </h3>
          <p className='text-[14px] font-medium text-indigo-700/90 mb-6 leading-relaxed max-w-sm mx-auto'>
            Your freeze request is currently awaiting review by the studio
            admin.
          </p>
          <div className='bg-white/70 rounded-xl p-4 border border-indigo-100/50 inline-block'>
            <p className='text-[12px] text-indigo-800 font-bold flex items-center gap-2'>
              <Info className='w-4 h-4 text-indigo-600' />
              You cannot submit another request until this one is processed.
            </p>
          </div>
        </div>
      ) : isFrozen ? (
        <div className='bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-sm mt-4'>
          <Snowflake className='w-12 h-12 text-[#155E75] mx-auto mb-4' />
          <h3 className='font-semibold text-[#155E75] text-xl mb-2'>
            Package is currently frozen
          </h3>
          <p className='text-[15px] font-medium text-cyan-800 mb-4'>
            Unfreezes on:{" "}
            {activeEndDate
              ? new Date(activeEndDate).toLocaleDateString("en-GB")
              : "Unknown"}
          </p>
        </div>
      ) : usedAllowance ? (
        <div className='bg-white border border-gray-200 rounded-3xl p-8 text-center shadow-sm mt-4'>
          <AlertCircle className='w-10 h-10 text-gray-400 mx-auto mb-4' />
          <p className='text-[15px] font-bold text-gray-600'>
            You have already used the freeze allowance for this package.
          </p>
        </div>
      ) : (
        <div className='space-y-6'>
          {isRejected && (
            <div className='bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3'>
              <XCircle className='w-5 h-5 text-red-600 shrink-0 mt-0.5' />
              <div>
                <p className='font-bold text-red-900 text-[14px]'>
                  Previous Request Declined
                </p>
                <p className='text-red-700 text-[13px] mt-1'>
                  The studio admin declined your previous freeze request. You
                  may submit a new request below.
                </p>
              </div>
            </div>
          )}

          <div>
            <h4 className='text-[15px] font-bold text-gray-900 mb-4'>
              Select Freeze Duration
            </h4>
            <div className='grid grid-cols-3 gap-3'>
              <SelectionCard
                title='1 Week'
                desc='7 Days'
                value='week'
                icon={CalendarDays}
              />
              <SelectionCard
                title='1 Month'
                desc='30 Days'
                value='month'
                icon={CalendarDays}
              />
              <SelectionCard
                title='Custom'
                desc='Enter days'
                value='custom'
                icon={Settings2}
              />
            </div>

            <AnimatePresence>
              {mode === "custom" && (
                <motion.div
                  initial={{ opacity: 0, height: 0, marginTop: 0 }}
                  animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                  exit={{ opacity: 0, height: 0, marginTop: 0 }}
                  className='overflow-hidden'>
                  <div className='bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4'>
                    <span className='text-[14px] font-bold text-gray-700 whitespace-nowrap'>
                      Duration (Days):
                    </span>
                    <input
                      type='number'
                      min='1'
                      max='90'
                      placeholder='e.g., 14'
                      value={customDays}
                      onChange={(e) => setCustomDays(e.target.value)}
                      className='w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[15px] font-bold focus:outline-none focus:ring-2 focus:ring-[#2D8A60]/20 shadow-inner'
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className='pt-6 border-t border-gray-200'>
            <button
              onClick={handleFreezeRequest}
              disabled={loading || !mode || (mode === "custom" && !customDays)}
              className='w-full py-4 bg-[#1D3D36] text-white rounded-xl font-bold text-[15px] hover:bg-[#0F2922] flex justify-center items-center shadow-lg transition-all disabled:opacity-50 disabled:shadow-none'>
              {loading ? (
                <Loader2 className='w-5 h-5 animate-spin' />
              ) : (
                "Submit Freeze Request"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TransactionCard({ tx, onClick }) {
  const config = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
  const StatusIcon = config.icon;
  const priceFormatted = tx.totalAmount.toLocaleString("id-ID");
  const dateFormatted = new Date(tx.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  let pkgName = "Deleted Package";
  if (
    tx.packageNameSnapshot &&
    tx.packageNameSnapshot !== "Unknown Package" &&
    tx.packageNameSnapshot !== "Deleted Package"
  ) {
    pkgName = tx.packageNameSnapshot;
  } else if (
    tx.packageId?.packageName &&
    tx.packageId.packageName !== "Unknown Package"
  ) {
    pkgName = tx.packageId.packageName;
  }

  return (
    <div
      onClick={onClick}
      className='group flex flex-col h-full cursor-pointer bg-white border border-gray-200 rounded-3xl p-8 transition-all duration-300 hover:shadow-xl hover:border-emerald-300 relative overflow-hidden shadow-sm'>
      <div className='flex justify-between items-center mb-6 gap-3'>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-wider ${config.bg} ${config.color}`}>
          <StatusIcon className='w-3.5 h-3.5' />
          {config.label}
        </div>
        <span className='text-xs text-gray-400 font-mono tracking-tight font-medium'>
          {dateFormatted}
        </span>
      </div>
      <div className='flex-1 mb-8 space-y-3'>
        <h3 className='font-semibold text-gray-900 text-[20px] mb-2 group-hover:text-[#2D8A60] transition-colors line-clamp-2 tracking-tight'>
          {pkgName}
        </h3>
        <p className='text-xs text-gray-500 font-mono tracking-wide'>
          Transaction ID: {tx.transactionId}
        </p>
        <div className='flex items-center gap-2.5 text-[13px] font-bold text-gray-700 bg-gray-50 border border-gray-100 p-4 rounded-xl shadow-sm'>
          <CreditCard className='w-4 h-4 text-[#2D8A60]' />
          <span className='capitalize'>
            {tx.paymentMethod?.replace(/_/g, " ")} Payment
          </span>
          {tx.promoCodeApplied && (
            <span className='bg-pink-100 text-pink-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ml-auto'>
              Promo: {tx.promoCodeApplied}
            </span>
          )}
        </div>
      </div>
      <div className='pt-6 border-t border-gray-100 flex items-end justify-between gap-3'>
        <div>
          <p className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1'>
            Order Amount
          </p>
          <p className='text-gray-900 font-semibold font-mono text-[26px] tracking-tighter'>
            {priceFormatted} IDR
          </p>
        </div>
        <button className='w-12 h-12 rounded-full bg-white border border-gray-200 group-hover:border-[#2D8A60] text-gray-400 group-hover:text-white flex items-center justify-center group-hover:bg-[#2D8A60] transition-all shadow-sm group-hover:shadow-md'>
          <ChevronRight className='w-5 h-5' />
        </button>
      </div>
    </div>
  );
}

function InvoicePreviewModal({ tx, onClose }) {
  const handlePrint = () => window.print();

  const displayId = tx.transactionId || tx._id;
  const amount = tx.totalAmount ? parseInt(tx.totalAmount) : 0;
  const method = tx.paymentMethod
    ? tx.paymentMethod.replace(/_/g, " ")
    : "Manual";
  const credits = tx.creditsPurchased || "N/A";
  const description = tx.packageId?.packageDescription || "Package order";
  const discountAmount = tx.discountAmount ? parseInt(tx.discountAmount) : 0;
  const preDiscountAmount = amount + discountAmount;

  const formattedDate = new Date(tx.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let pkgName = "Deleted Package";
  if (
    tx.packageNameSnapshot &&
    tx.packageNameSnapshot !== "Unknown Package" &&
    tx.packageNameSnapshot !== "Deleted Package"
  ) {
    pkgName = tx.packageNameSnapshot;
  } else if (
    tx.packageId?.packageName &&
    tx.packageId.packageName !== "Unknown Package"
  ) {
    pkgName = tx.packageId.packageName;
  }

  return (
    <div className='fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 print:p-0 print:bg-white print:static'>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible; }
          #invoice-content { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 30px; overflow: visible; }
          #invoice-actions { display: none; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-4xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh] print:shadow-none print:max-h-none print:rounded-none'>
        <div
          id='invoice-actions'
          className='flex justify-between items-center px-8 py-5 border-b border-gray-100 bg-gray-50/50'>
          <h2 className='font-bold text-gray-950 flex items-center gap-2.5'>
            <FileText className='w-5 h-5 text-[#2D8A60]' />
            Invoice Receipt Preview
          </h2>
          <div className='flex gap-3'>
            <button
              onClick={handlePrint}
              className='flex items-center gap-2 px-5 py-2.5 bg-[#1D3D36] hover:bg-[#0F2922] text-white text-sm font-bold rounded-xl transition-colors shadow-sm'>
              <Printer className='w-4 h-4' /> Print / Download PDF
            </button>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-100 rounded-full transition-colors'>
              <X className='w-5 h-5 text-gray-500' />
            </button>
          </div>
        </div>

        <div
          id='invoice-content'
          className='p-12 overflow-y-auto bg-white font-sans text-gray-900'>
          <div className='flex justify-between items-start mb-16 gap-5'>
            <div className='space-y-1'>
              <h1 className='text-[32px] font-semibold text-[#1D3D36] tracking-tight'>
                {tx.issuingStudio?.studioName || "Pilates Studio"}
              </h1>
              <p className='text-gray-500 text-[15px] font-medium'>
                Access Premium Pilates Sessions
              </p>
            </div>
            <div className='text-right'>
              <h2 className='text-2xl font-semibold text-gray-200 uppercase tracking-widest'>
                Invoice
              </h2>
              <p className='font-mono text-gray-500 mt-2 text-[14px]'>
                No: {displayId.slice(-8).toUpperCase()}
              </p>
            </div>
          </div>

          <div className='flex justify-between mb-16 gap-8'>
            <div>
              <p className='text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
                Billing Information
              </p>
              <h3 className='font-semibold text-gray-900 text-xl tracking-tight'>
                {tx.userId?.fullName || "Valued Member"}
              </h3>
              <p className='text-gray-500 text-[14px] mt-1 font-medium'>
                Member ID: {tx.userId?._id.slice(-6).toUpperCase() || "N/A"}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5'>
                Purchase Metadata
              </p>
              <p className='text-gray-950 font-bold text-[15px]'>
                {formattedDate}
              </p>
              <p className='text-gray-600 font-medium capitalize text-[14px] mt-1.5'>
                Method: {method} Payment
              </p>
            </div>
          </div>

          <div className='mb-16'>
            <table className='w-full border-collapse'>
              <thead>
                <tr className='border-b-2 border-gray-100'>
                  <th className='text-left py-4 px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider'>
                    Product Description
                  </th>
                  <th className='text-center py-4 px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider'>
                    Package Sessions
                  </th>
                  <th className='text-right py-4 px-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider'>
                    Amount Paid
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className='border-b border-gray-100'>
                  <td className='py-6 px-2'>
                    <p className='font-bold text-gray-900 text-[16px]'>
                      {pkgName}
                    </p>
                    <p className='text-[14px] text-gray-500 mt-1 max-w-md'>
                      {description}
                    </p>
                  </td>
                  <td className='text-center py-6 px-2 text-gray-700 font-bold text-[16px]'>
                    {credits}
                  </td>
                  <td className='text-right py-6 px-2 font-semibold font-mono text-[#1D3D36] text-[18px] tracking-tight'>
                    {preDiscountAmount.toLocaleString("id-ID")} IDR
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className='flex justify-end mb-16'>
            <div className='w-80 space-y-3 bg-[#F9FAFB] rounded-[24px] p-8 border border-gray-100 shadow-sm'>
              <div className='flex justify-between items-center'>
                <span className='text-gray-500 text-[15px] font-bold'>
                  Subtotal Amount
                </span>
                <span className='font-bold text-gray-900 text-[15px]'>
                  {preDiscountAmount.toLocaleString("id-ID")} IDR
                </span>
              </div>
              {tx.promoCodeApplied && (
                <div className='flex justify-between items-center'>
                  <span className='text-gray-500 text-[15px] font-bold'>
                    Discount ({tx.promoCodeApplied})
                  </span>
                  <span className='font-bold text-rose-500 text-[15px]'>
                    - {discountAmount.toLocaleString("id-ID")} IDR
                  </span>
                </div>
              )}
              <div className='flex justify-between items-center py-5 border-t border-gray-200 mt-2'>
                <span className='font-semibold text-gray-900 text-[18px]'>
                  Total Payment
                </span>
                <span className='font-semibold text-[#2D8A60] font-mono text-3xl tracking-tighter'>
                  {amount.toLocaleString("id-ID")} IDR
                </span>
              </div>
            </div>
          </div>

          <div className='border-t border-gray-200 pt-10 text-center space-y-2.5'>
            <p className='text-[#1D3D36] font-semibold text-xl'>
              Thank you for investing in your well-being with us!
            </p>
            <p className='text-gray-500 text-[13px] max-w-md mx-auto leading-relaxed'>
              Should you have any questions regarding this statement, please do
              not hesitate to contact our customer support team or studio admin.
              <br />
              Hava Pilates Studio, Indonesia.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function MedicalProfileModal({ onClose, onSuccess, user }) {
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  // Lock state: If true, user cannot uncheck the box anymore
  const [termsLocked, setTermsLocked] = useState(false);

  // Modals state (Nested within this main modal)
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy'
  const [showValidationModal, setShowValidationModal] = useState(false);

  const [medical, setMedical] = useState({
    dateOfBirth: "",
    sex: "",
    maritalStatus: "",
    occupation: "",
    address: "",
    dailyActivity: "",
    physicalConcern: "",
    termsAndConditions: false,
  });

  // --- Fetch Existing Data ---
  useEffect(() => {
    const fetchMedical = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          API_PATHS.AUTH.MEDICAL_INFO(user._id),
        );

        if (res.data) {
          setHasRecord(true);
          const isTermsAccepted = res.data.termsAndConditions || false;

          if (isTermsAccepted) {
            setTermsLocked(true);
          }

          setMedical({
            dateOfBirth: res.data.dateOfBirth
              ? new Date(res.data.dateOfBirth).toISOString().split("T")[0]
              : "",
            sex: res.data.sex || "",
            maritalStatus: res.data.maritalStatus || "",
            occupation: res.data.occupation || "",
            address: res.data.address || "",
            dailyActivity: res.data.dailyActivity || "",
            physicalConcern: res.data.physicalConcern || "",
            termsAndConditions: isTermsAccepted,
          });
        }
      } catch (err) {
        console.log("No existing medical record found, starting fresh.");
      } finally {
        setLoading(false);
      }
    };
    fetchMedical();
  }, [user._id]);

  // --- Handle Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!medical.termsAndConditions) {
      setShowValidationModal(true);
      return;
    }

    try {
      setSubmitLoading(true);
      // Using POST as requested in your MedicalList logic
      await axiosInstance.post(API_PATHS.AUTH.MEDICAL_INFO(user._id), medical);

      setHasRecord(true);
      setTermsLocked(true);

      // Unlock the checkout flow and close the modal
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Failed to save medical record. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6'>
      {/* Background Overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/60 backdrop-blur-sm'
      />

      {/* Main Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className='relative w-full max-w-5xl bg-[#F9FAFB] rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]'>
        {/* Header */}
        <div className='px-6 md:px-10 py-6 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0'>
          <div className='flex items-center gap-4'>
            <div className='w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100'>
              <Activity className='w-6 h-6' />
            </div>
            <div>
              <h2 className='text-2xl font-bold text-gray-900 tracking-tight'>
                Complete Medical Profile
              </h2>
              <p className='text-sm text-gray-500 font-medium'>
                Required for studio safety and checkout
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2.5 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors'>
            <X className='w-6 h-6 text-gray-500' />
          </button>
        </div>

        {/* Body Content */}
        <div className='p-6 md:p-10 overflow-y-auto flex-1'>
          {loading ? (
            <div className='h-64 flex flex-col items-center justify-center'>
              <LoadingSpinner size='lg' />
              <p className='text-gray-500 font-medium mt-4'>
                Accessing your health records...
              </p>
            </div>
          ) : (
            <form
              id='complete-medical-form'
              onSubmit={handleSubmit}
              className='grid grid-cols-1 lg:grid-cols-2 gap-8'>
              {/* --- COL 1: Personal Details --- */}
              <div className='bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm h-full flex flex-col'>
                <h3 className='text-lg font-bold text-gray-900 mb-6 flex items-center gap-3'>
                  <span className='w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-extrabold'>
                    1
                  </span>
                  Personal Details
                </h3>
                <div className='space-y-6 flex-1'>
                  <div>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Date of Birth
                    </label>
                    <input
                      type='date'
                      required
                      value={medical.dateOfBirth}
                      onChange={(e) =>
                        setMedical({ ...medical, dateOfBirth: e.target.value })
                      }
                      className='w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium'
                    />
                  </div>
                  <div className='grid grid-cols-2 gap-5'>
                    <CustomSelect
                      label='Sex'
                      value={medical.sex}
                      options={["Male", "Female", "Prefer not to say"]}
                      placeholder='Gender'
                      onChange={(val) => setMedical({ ...medical, sex: val })}
                    />
                    <CustomSelect
                      label='Marital Status'
                      value={medical.maritalStatus}
                      options={["Single", "Married", "Divorced", "Widowed"]}
                      placeholder='Status'
                      onChange={(val) =>
                        setMedical({ ...medical, maritalStatus: val })
                      }
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Occupation
                    </label>
                    <input
                      type='text'
                      value={medical.occupation}
                      onChange={(e) =>
                        setMedical({ ...medical, occupation: e.target.value })
                      }
                      className='w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-medium'
                      placeholder='e.g. Graphic Designer'
                    />
                  </div>
                  <div>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Address
                    </label>
                    <textarea
                      value={medical.address}
                      onChange={(e) =>
                        setMedical({ ...medical, address: e.target.value })
                      }
                      rows='3'
                      className='w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none font-medium'
                      placeholder='Enter your full address...'
                    />
                  </div>
                </div>
              </div>

              {/* --- COL 2: Physical Health --- */}
              <div className='bg-white p-6 md:p-8 rounded-3xl border border-gray-200 shadow-sm h-full flex flex-col'>
                <h3 className='text-lg font-bold text-gray-900 mb-6 flex items-center gap-3'>
                  <span className='w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-extrabold'>
                    2
                  </span>
                  Physical Health
                </h3>
                <div className='space-y-6 flex-1 flex flex-col'>
                  <div className='flex-1 flex flex-col'>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Daily Activity
                    </label>
                    <textarea
                      value={medical.dailyActivity}
                      onChange={(e) =>
                        setMedical({
                          ...medical,
                          dailyActivity: e.target.value,
                        })
                      }
                      placeholder='e.g. Sedentary work, mostly sitting, gym 3x a week...'
                      className='w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1 font-medium min-h-[120px]'
                    />
                  </div>
                  <div className='flex-1 flex flex-col'>
                    <label className='block text-sm font-bold text-gray-700 mb-2'>
                      Physical Concerns / Injuries
                    </label>
                    <textarea
                      value={medical.physicalConcern}
                      onChange={(e) =>
                        setMedical({
                          ...medical,
                          physicalConcern: e.target.value,
                        })
                      }
                      placeholder='e.g. Lower back pain, recovering from knee surgery, stiff neck...'
                      className='w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1 font-medium min-h-[120px]'
                    />
                  </div>
                </div>
              </div>

              {/* --- Terms & Conditions --- */}
              <div
                className={`lg:col-span-2 bg-white p-6 rounded-3xl border border-gray-200 shadow-sm ${
                  termsLocked ? "opacity-80 bg-gray-50/50" : ""
                }`}>
                <label
                  className={`flex items-start gap-4 group ${
                    termsLocked ? "cursor-default" : "cursor-pointer"
                  }`}>
                  <div className='relative flex items-center mt-1 shrink-0'>
                    <input
                      type='checkbox'
                      disabled={termsLocked}
                      checked={medical.termsAndConditions}
                      onChange={(e) => {
                        setMedical({
                          ...medical,
                          termsAndConditions: e.target.checked,
                        });
                        if (e.target.checked) setShowValidationModal(false);
                      }}
                      className='peer sr-only'
                    />
                    <div
                      className={`
                      w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shadow-sm
                      ${
                        medical.termsAndConditions || termsLocked
                          ? "bg-emerald-600 border-emerald-600"
                          : "bg-white border-gray-300 group-hover:border-emerald-400"
                      }
                    `}>
                      <Check
                        strokeWidth={3}
                        className={`w-3.5 h-3.5 text-white transition-transform duration-200 
                          ${
                            medical.termsAndConditions || termsLocked
                              ? "scale-100 opacity-100"
                              : "scale-50 opacity-0"
                          }
                        `}
                      />
                    </div>
                  </div>

                  <div className='text-[15px] text-gray-600 leading-relaxed font-medium'>
                    <span className='font-bold text-gray-900 block mb-1.5 flex items-center gap-2'>
                      Agreement & Liability Waiver
                      {termsLocked && (
                        <span className='text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md'>
                          Accepted
                        </span>
                      )}
                    </span>
                    I confirm that the information provided above is accurate. I
                    understand that physical exercise involves potential risks,
                    and I agree to assume full responsibility for any injuries
                    or damages incurred. I agree to the{" "}
                    <button
                      type='button'
                      onClick={() => setActiveModal("terms")}
                      className='text-emerald-600 font-bold hover:underline focus:outline-none relative z-10'>
                      Terms & Conditions
                    </button>{" "}
                    and{" "}
                    <button
                      type='button'
                      onClick={() => setActiveModal("privacy")}
                      className='text-emerald-600 font-bold hover:underline focus:outline-none relative z-10'>
                      Privacy Policy
                    </button>{" "}
                    of Hava Booking Service.
                  </div>
                </label>
              </div>
            </form>
          )}
        </div>

        {/* Footer Actions */}
        <div className='px-6 md:px-10 py-6 border-t border-gray-200 bg-white sticky bottom-0 z-10 flex justify-end gap-4 shrink-0'>
          <button
            type='button'
            onClick={onClose}
            className='px-6 py-3.5 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors'>
            Cancel
          </button>
          <button
            type='submit'
            form='complete-medical-form'
            disabled={submitLoading || loading}
            className='px-8 py-3.5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 min-w-[200px]'>
            {submitLoading ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' /> Processing...
              </>
            ) : (
              <>
                <Save className='w-5 h-5' /> Save & Continue to Checkout
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* --- NESTED VALIDATION MODAL --- */}
      <AnimatePresence>
        {showValidationModal && (
          <div className='absolute inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className='bg-white w-full max-w-sm rounded-3xl shadow-2xl p-8 border-t-4 border-red-500'>
              <div className='flex flex-col items-center text-center'>
                <div className='w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mb-5 text-red-600'>
                  <AlertTriangle className='w-8 h-8' />
                </div>
                <h3 className='text-xl font-bold text-gray-900 mb-2'>
                  Action Required
                </h3>
                <p className='text-gray-500 text-[15px] mb-8 font-medium leading-relaxed'>
                  You must agree to the Terms & Conditions and Privacy Policy
                  before saving your medical record.
                </p>
                <button
                  onClick={() => setShowValidationModal(false)}
                  className='w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-sm'>
                  I Understand
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- NESTED TEXT MODALS (Terms / Privacy) --- */}
      <AnimatePresence>
        {activeModal && (
          <div className='absolute inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className='bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]'>
              <div className='flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-gray-50'>
                <h3 className='text-xl font-bold text-gray-900'>
                  {activeModal === "terms"
                    ? "Terms & Conditions"
                    : "Privacy Policy"}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>
              <div className='p-8 overflow-y-auto'>
                <p className='italic text-gray-400 font-medium'>
                  [
                  {activeModal === "terms"
                    ? "Terms Content"
                    : "Privacy Policy Content"}{" "}
                  Placeholder]
                </p>
              </div>
              <div className='p-6 border-t border-gray-100 flex justify-end bg-white'>
                <button
                  onClick={() => setActiveModal(null)}
                  className='px-8 py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-sm'>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TransactionDetailModal({ tx, onClose }) {
  const config = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
  const fileInputRef = useRef(null);

  const [showInvoice, setShowInvoice] = useState(false);
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleTriggerFileSelect = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const handleConfirmUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);

    try {
      let paymentUrl = "";

      if (selectedFile) {
        const imgUploadRes = await uploadProof(selectedFile, user._id);
        paymentUrl = imgUploadRes.imageUrl || "";
      }
      await axiosInstance.put(API_PATHS.PURCHASES.UPLOAD_PROOF(tx._id), {
        proofUrl: paymentUrl,
      });
      alert("Verification successful!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to confirm verification");
    } finally {
      setUploading(false);
    }
  };

  const isRejected =
    tx.status === "payment_rejected" || tx.status === "rejected";

  let pkgName = "Deleted Package";
  if (
    tx.packageNameSnapshot &&
    tx.packageNameSnapshot !== "Unknown Package" &&
    tx.packageNameSnapshot !== "Deleted Package"
  ) {
    pkgName = tx.packageNameSnapshot;
  } else if (
    tx.packageId?.packageName &&
    tx.packageId.packageName !== "Unknown Package"
  ) {
    pkgName = tx.packageId.packageName;
  }

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 sm:p-6'>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className='absolute inset-0 bg-black/70 backdrop-blur-sm'
        />
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className='relative bg-white w-full max-w-3xl rounded-t-4xl md:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]'>
          <div className='flex justify-between items-center px-10 py-7 border-b border-gray-100 bg-white z-10 shrink-0'>
            <div>
              <h2 className='text-[20px] font-semibold text-gray-900 flex gap-3 items-center'>
                <History className='w-[22px] h-[22px] text-[#2D8A60]' /> Order
                Verification
              </h2>
              <p className='text-xs text-gray-500 font-mono mt-1.5 font-medium'>
                Reference ID: {tx.transactionId}
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-100 rounded-full transition-colors'>
              <X className='w-6 h-6 text-gray-500' />
            </button>
          </div>

          <div className='p-8 md:p-10 overflow-y-auto bg-[#F9FAFB] space-y-8'>
            <div
              className={`rounded-2xl border p-6 ${
                isRejected
                  ? "border-red-200 bg-red-50/60"
                  : tx.status === "confirmed"
                    ? "border-[#A7F3D0] bg-[#ECFDF5]"
                    : "border-amber-200 bg-amber-50/80"
              }`}>
              {isRejected ? (
                <>
                  <div className='flex items-center gap-3 mb-4'>
                    <Ban className='w-6 h-6 text-red-700' />
                    <h4 className='font-bold text-[16px] text-red-950 uppercase tracking-tight'>
                      Payment Declined
                    </h4>
                  </div>
                  <div className='bg-white border border-red-100 rounded-xl p-5 shadow-sm'>
                    <p className='text-[13px] font-bold text-red-900 mb-1.5 uppercase tracking-wider'>
                      Decline Reason
                    </p>
                    <p className='text-[15px] text-red-800 font-medium'>
                      {" "}
                      {tx.rejectionReason ||
                        "Please double check your receipt details or contact your bank."}{" "}
                    </p>
                  </div>
                </>
              ) : (
                <div className='flex items-center gap-4'>
                  <div
                    className={`p-2 rounded-full bg-white shadow-sm border ${tx.status === "confirmed" ? "border-[#6EE7B7]" : "border-amber-200"}`}>
                    <config.icon
                      className={`w-7 h-7 shrink-0 ${config.color}`}
                    />
                  </div>
                  <div>
                    <h4
                      className={`font-bold text-[16px] ${config.color} uppercase tracking-wider`}>
                      {config.label}
                    </h4>
                    <p
                      className={`text-[15px] ${config.color} mt-1 font-medium leading-relaxed`}>
                      {tx.status === "pending"
                        ? "Waiting for you to complete the payment step."
                        : tx.status === "confirmed"
                          ? "Verified successfully. Sessions added to account."
                          : "Received. Please allow up to 24 hours for confirmation."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className='bg-white px-8 py-7 border border-gray-100 shadow-sm rounded-2xl'>
              <div className='flex flex-col md:flex-row justify-between items-start mb-8 gap-5 border-b border-gray-100 pb-8'>
                <div className='flex-1 space-y-1.5'>
                  <p className='text-[11px] font-bold text-gray-400 uppercase tracking-wider'>
                    Package
                  </p>
                  <h3 className='font-semibold text-gray-900 text-[26px] tracking-tight leading-tight'>
                    {pkgName}
                  </h3>
                  {tx.promoCodeApplied && (
                    <span className='inline-block mt-2 bg-pink-100 text-pink-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider'>
                      Promo: {tx.promoCodeApplied} (-{" "}
                      {parseInt(tx.discountAmount || 0).toLocaleString("id-ID")}{" "}
                      IDR)
                    </span>
                  )}
                </div>
                <div className='text-left md:text-right shrink-0'>
                  <p className='text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                    Total Price
                  </p>
                  <h3 className='font-semibold text-[#1D3D36] text-[32px] tracking-tighter leading-none'>
                    {parseInt(tx.totalAmount).toLocaleString("id-ID")} IDR
                  </h3>
                </div>
              </div>
              <div className='grid grid-cols-2 lg:grid-cols-3 gap-6'>
                <div className='flex items-center gap-3.5'>
                  <Hash className='w-5 h-5 text-[#2D8A60] shrink-0' />
                  <div>
                    <p className='text-[10px] font-bold text-gray-400 uppercase'>
                      Total Sessions
                    </p>
                    <span className='font-bold text-gray-900 text-[15px]'>
                      {tx.creditsPurchased} Credits
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-3.5'>
                  <CreditCard className='w-5 h-5 text-[#2D8A60] shrink-0' />
                  <div>
                    <p className='text-[10px] font-bold text-gray-400 uppercase'>
                      Payment Method
                    </p>
                    <span className='font-bold text-gray-900 text-[15px] capitalize'>
                      {tx.paymentMethod?.replace(/_/g, " ")}
                    </span>
                  </div>
                </div>
                <div className='flex items-center gap-3.5 col-span-2 lg:col-span-1'>
                  <CalendarDays className='w-5 h-5 text-[#2D8A60] shrink-0' />
                  <div>
                    <p className='text-[10px] font-bold text-gray-400 uppercase'>
                      Order Date
                    </p>
                    <span className='font-bold text-gray-900 text-[15px]'>
                      {new Date(tx.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              {!isRejected && tx.status !== "confirmed" && (
                <div className='space-y-6'>
                  <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className='hidden'
                    accept='image/jpeg,image/png,application/pdf'
                  />
                  <div
                    onClick={handleTriggerFileSelect}
                    className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all ${
                      selectedFile
                        ? "border-[#2D8A60] bg-[#E8F5EE]"
                        : "border-gray-300 bg-white hover:border-[#2D8A60] hover:bg-[#F9FAFB] shadow-sm"
                    }`}>
                    {selectedFile ? (
                      <div className='text-center w-full'>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt='Receipt Preview'
                            className='h-32 mx-auto mb-6 object-contain rounded-xl shadow-lg bg-white p-2 border border-gray-100'
                          />
                        ) : (
                          <div className='w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm text-[#2D8A60] border border-gray-100'>
                            <FileIcon className='w-8 h-8' />
                          </div>
                        )}
                        <div className='flex items-center justify-center gap-2.5 text-[#1D3D36] font-semibold text-[18px] mb-2'>
                          <CheckCircle2 className='w-6 h-6 text-[#2D8A60]' />
                          <span>{selectedFile.name}</span>
                        </div>
                        <p className='text-[#2D8A60] text-[14px] font-bold'>
                          {" "}
                          Tap to re-select file{" "}
                        </p>
                      </div>
                    ) : (
                      <div className='text-center'>
                        <div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-gray-200 text-gray-400 shadow-sm'>
                          <ImageIcon className='w-8 h-8' />
                        </div>
                        <p className='text-gray-900 font-bold text-[18px]'>
                          Upload Payment Receipt
                        </p>
                        <p className='text-[14px] text-gray-500 mt-2 max-w-xs mx-auto font-medium leading-relaxed'>
                          {" "}
                          Supports JPG, PNG, or PDF formats{" "}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <button
                      onClick={handleConfirmUpload}
                      disabled={uploading}
                      className='w-full py-4 bg-[#1D3D36] hover:bg-[#0F2922] disabled:bg-gray-400 text-white rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg transition-all text-[16px]'>
                      {uploading ? (
                        <>
                          {" "}
                          <Loader2 className='w-6 h-6 animate-spin' />{" "}
                          Verifying...{" "}
                        </>
                      ) : (
                        <>
                          {" "}
                          <UploadCloud className='w-6 h-6' /> Submit Receipt for
                          Approval{" "}
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {tx.status === "confirmed" && (
                <button
                  onClick={() => setShowInvoice(true)}
                  className='w-full py-5 bg-white border border-gray-200 shadow-sm hover:bg-gray-50 text-gray-900 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-[16px]'>
                  <FileText className='w-5 h-5 text-[#2D8A60]' /> Print Order
                  Receipt / Invoice
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showInvoice && (
          <InvoicePreviewModal tx={tx} onClose={() => setShowInvoice(false)} />
        )}
      </AnimatePresence>
    </>
  );
}
