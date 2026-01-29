import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
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
  Ticket,
  ArrowUpNarrowWide,
  ArrowDownNarrowWide,
  History,
  CreditCard,
  ChevronRight,
  UploadCloud,
  Hash,
  Search,
  Filter,
  Ban,
  AlertCircle,
  FileText,
  Package,
  FileIcon,
  Loader2,
  Image as ImageIcon,
  Printer,
  WalletCards,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import Footer from "../../../../../../components/Footer";
import { API_PATHS } from "../../../../../../utils/apiPath";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import PurchaseForm from "../../PurchasePackage/components/PurchaseForm";
import { useAuth } from "../../../../../../context/AuthContext";

// --- PARENT COMPONENT: MANAGE PACKAGE ---
const ManagePackage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("packages");

  const tabs = [
    { id: "packages", label: "Buy Packages", icon: Package },
    { id: "my-passes", label: "My Passes", icon: WalletCards },
    { id: "history", label: "Transactions", icon: History },
  ];

  return (
    <div className='min-h-screen bg-white font-sans text-gray-900 flex flex-col'>
      {/* Header & Tabs */}
      <div className='bg-white border-b border-gray-100 pt-8 sticky top-0 z-40'>
        <div className='container mx-auto px-4 md:px-6'>
          <div className='flex items-center gap-8 overflow-x-auto no-scrollbar'>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className='relative pb-4 px-2 group flex items-center gap-2 font-medium text-sm transition-colors whitespace-nowrap'>
                <span
                  className={`${
                    activeTab === tab.id ? "text-emerald-700" : "text-gray-500"
                  } group-hover:text-emerald-600 transition-colors duration-300 flex items-center gap-2`}>
                  <tab.icon
                    className={`w-4 h-4 ${
                      activeTab === tab.id ? "stroke-[2.5px]" : "stroke-2"
                    }`}
                  />
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId='activeTab'
                    className='absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full'
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
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}>
              <PackageSelectorView user={user} />
            </motion.div>
          ) : activeTab === "my-passes" ? (
            <motion.div
              key='my-passes'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              <UserPassesView user={user} />
            </motion.div>
          ) : (
            <motion.div
              key='history'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}>
              <PurchaseHistoryView user={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  );
};

// ============================================================================
// VIEW 1: PACKAGE SELECTOR (Marketplace)
// ============================================================================
const PackageSelectorView = ({ user }) => {
  const [studios, setStudios] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPackageId = searchParams.get("packageId");

  const [selectedInstructorTypes, setSelectedInstructorTypes] = useState([]);
  const [selectedStudioLocations, setSelectedStudioLocations] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studiosRes, packagesRes] = await Promise.all([
          axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
          axiosInstance.get(API_PATHS.PACKAGES.GET_ALL),
        ]);
        setStudios(studiosRes.data);
        setPackages(packagesRes.data);
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const uniqueInstructorTypes = [
    ...new Set(packages.map((p) => p.instructorType).filter(Boolean)),
  ];
  const uniqueStudioLocation = [
    ...new Set(
      packages.map((p) => p.studioLocation?.studioName).filter(Boolean),
    ),
  ];

  const filteredPackages = packages
    .filter((pkg) => {
      const matchesStudio =
        selectedStudioLocations.length === 0 ||
        selectedStudioLocations.includes(pkg.studioLocation?.studioName);
      const matchesActive = pkg.isActive;
      const matchesInstructor =
        selectedInstructorTypes.length === 0 ||
        selectedInstructorTypes.includes(pkg.instructorType);
      const price = parseInt(pkg.packagePrice);
      const min = priceMin === "" ? 0 : parseInt(priceMin);
      const max = priceMax === "" ? Infinity : parseInt(priceMax);
      const matchesPrice = price >= min && price <= max;
      return (
        matchesStudio && matchesActive && matchesInstructor && matchesPrice
      );
    })
    .sort((a, b) => {
      const priceA = parseInt(a.packagePrice);
      const priceB = parseInt(b.packagePrice);
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

  const handleOpenPurchase = (pkgId) => setSearchParams({ packageId: pkgId });
  const handleClosePurchase = () => setSearchParams({});

  if (loading)
    return (
      <div className='h-[60vh] flex items-center justify-center'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
        {/* --- SIDEBAR FILTERS --- */}
        <aside
          className={`lg:w-64 xl:w-72 shrink-0 space-y-8 ${
            showMobileFilters
              ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden lg:block"
          }`}>
          {/* ... (Filters content same as before) ... */}
          <div className='flex items-center justify-between lg:hidden mb-8'>
            <h3 className='font-bold text-xl'>Filters</h3>
            <button
              onClick={() => setShowMobileFilters(false)}
              className='p-2 bg-gray-100 rounded-full'>
              <X className='w-5 h-5' />
            </button>
          </div>
          {/* ... Rest of filters ... */}
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <Info className='w-4 h-4 text-gray-400' /> Package Details
            </h3>
            <div className='bg-gray-50 p-4 rounded-xl text-sm text-gray-600 space-y-3 border border-gray-100'>
              <p className='flex items-start gap-2'>
                <CheckCircle2 className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span>All packages include access to studio amenities.</span>
              </p>
              <p className='flex items-start gap-2'>
                <CheckCircle2 className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span>Validity starts from the date of first booking.</span>
              </p>
            </div>
          </div>
          <hr className='border-gray-100' />
          <div className='space-y-0.5'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <MapPin className='w-4 h-4 text-gray-400' /> Studio Location
            </h3>
            <div className='space-y-2'>
              {uniqueStudioLocation.map((type) => (
                <label
                  key={type}
                  className='flex items-center gap-3 cursor-pointer group py-1'>
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedStudioLocations.includes(type)
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-gray-300 bg-white group-hover:border-emerald-400"
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
                    className={`text-sm ${
                      selectedStudioLocations.includes(type)
                        ? "text-gray-900 font-medium"
                        : "text-gray-600"
                    }`}>
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <hr className='border-gray-100' />
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <Users className='w-4 h-4 text-gray-400' /> Instructor Level
            </h3>
            <div className='space-y-2'>
              {uniqueInstructorTypes.map((type) => (
                <label
                  key={type}
                  className='flex items-center gap-3 cursor-pointer group py-1'>
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedInstructorTypes.includes(type)
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-gray-300 bg-white group-hover:border-emerald-400"
                    }`}>
                    {selectedInstructorTypes.includes(type) && (
                      <Check className='w-3.5 h-3.5 text-white' />
                    )}
                  </div>
                  <input
                    type='checkbox'
                    className='hidden'
                    checked={selectedInstructorTypes.includes(type)}
                    onChange={() =>
                      toggleFilter(
                        selectedInstructorTypes,
                        setSelectedInstructorTypes,
                        type,
                      )
                    }
                  />
                  <span
                    className={`text-sm ${
                      selectedInstructorTypes.includes(type)
                        ? "text-gray-900 font-medium"
                        : "text-gray-600"
                    }`}>
                    {type}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <hr className='border-gray-100' />
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <SlidersHorizontal className='w-4 h-4 text-gray-400' /> Sort Price
            </h3>
            <div className='flex gap-2'>
              <button
                onClick={() => setSortOrder("asc")}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  sortOrder === "asc"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                <ArrowUpNarrowWide className='w-4 h-4' /> Lowest
              </button>
              <button
                onClick={() => setSortOrder("desc")}
                className={`flex-1 py-2 px-3 rounded-lg border text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                  sortOrder === "desc"
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}>
                <ArrowDownNarrowWide className='w-4 h-4' /> Highest
              </button>
            </div>
          </div>
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <Tag className='w-4 h-4 text-gray-400' /> Price Range (IDR)
            </h3>
            <div className='flex items-center gap-2'>
              <div className='relative flex-1'>
                <input
                  type='number'
                  placeholder='Min'
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className='w-full pl-3 pr-2 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
                />
              </div>
              <span className='text-gray-400'>-</span>
              <div className='relative flex-1'>
                <input
                  type='number'
                  placeholder='Max'
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className='w-full pl-3 pr-2 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
                />
              </div>
            </div>
          </div>
        </aside>

        {/* --- MAIN GRID --- */}
        <div className='flex-1'>
          <div className='flex items-center justify-between mb-8 pb-4 border-b border-gray-100'>
            <p className='text-gray-500 text-sm'>
              Showing{" "}
              <span className='font-bold text-gray-900'>
                {filteredPackages.length}
              </span>{" "}
              results
            </p>
            <button
              className='lg:hidden flex items-center gap-2 text-sm font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors'
              onClick={() => setShowMobileFilters(true)}>
              <SlidersHorizontal className='w-4 h-4' /> Filters
            </button>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10'>
            {filteredPackages.length > 0 ? (
              filteredPackages.map((pkg) => (
                <PackageCardMinimal
                  key={pkg._id}
                  pkg={pkg}
                  onPurchase={() => handleOpenPurchase(pkg._id)}
                />
              ))
            ) : (
              <div className='col-span-full py-20 text-center'>
                <div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300'>
                  <ShoppingBag className='w-8 h-8' />
                </div>
                <h3 className='text-lg font-bold text-gray-900'>
                  No packages found
                </h3>
                <p className='text-gray-500'>
                  Try adjusting your price range or filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- PURCHASE MODAL --- */}
      <AnimatePresence>
        {selectedPackage && (
          <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 sm:p-6'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePurchase}
              className='absolute inset-0 bg-black/50 backdrop-blur-sm'
            />
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className='relative bg-white w-full max-w-2xl rounded-t-4xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
              <div className='flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white z-10'>
                <h2 className='text-xl font-bold text-gray-900'>Checkout</h2>
                <button
                  onClick={handleClosePurchase}
                  className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
                  <X className='w-6 h-6 text-gray-500' />
                </button>
              </div>

              {/* Added flex-1 to ensure correct scrolling */}
              <div className='p-4 overflow-y-auto flex-1'>
                <div className='bg-emerald-50 px-8 py-6 border-b border-gray-100 rounded-2xl'>
                  <div className='flex flex-col md:flex-row justify-between items-start mb-6 gap-4'>
                    <div className='flex-1'>
                      <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                        Selected Package
                      </p>
                      <h3 className='font-bold text-gray-900 text-lg leading-tight'>
                        {selectedPackage.packageName}
                      </h3>
                      <p className='text-xs text-gray-500 mt-1'>
                        {selectedPackage.packageDescription}
                      </p>
                    </div>
                    <div className='text-left md:text-right shrink-0'>
                      <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                        Total
                      </p>
                      <h3 className='font-bold text-emerald-600 text-2xl font-mono'>
                        IDR{" "}
                        {parseInt(selectedPackage.packagePrice).toLocaleString(
                          "id-ID",
                        )}
                      </h3>
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-4'>
                    <div className='bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm'>
                      <MapPin className='w-5 h-5 text-emerald-600 mb-2' />
                      <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5'>
                        Studio Location
                      </span>
                      <span className='font-bold text-gray-900 text-sm'>
                        {selectedPackage.studioLocation?.studioName}
                      </span>
                    </div>
                    <div className='bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm'>
                      <Ticket className='w-5 h-5 text-emerald-600 mb-2' />
                      <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5'>
                        Total Credits
                      </span>
                      <span className='font-bold text-gray-900 text-sm'>
                        {selectedPackage.credits}{" "}
                        {selectedPackage.credits !== 1 ? "Sessions" : "Session"}
                      </span>
                    </div>
                    <div className='bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm'>
                      <Clock className='w-5 h-5 text-emerald-600 mb-2' />
                      <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5'>
                        Package Validity
                      </span>
                      <span className='font-bold text-gray-900 text-sm'>
                        {selectedPackage.validityDays}{" "}
                        {selectedPackage.validityDays !== 1 ? "Days" : "Day"}
                      </span>
                    </div>
                    <div className='bg-white p-4 rounded-xl border border-gray-200 flex flex-col justify-center items-center text-center shadow-sm'>
                      <Users className='w-5 h-5 text-emerald-600 mb-2' />
                      <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5'>
                        Instructor Category
                      </span>
                      <span className='font-bold text-gray-900 text-sm'>
                        {selectedPackage.instructorType.split(" ")[0]}
                      </span>
                    </div>
                  </div>
                </div>

                <PurchaseForm
                  pkg={selectedPackage}
                  onCancel={handleClosePurchase}
                  userId={user._id}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ============================================================================
// VIEW 2: MY PASSES (User's Active/Expired Packages)
// ============================================================================
const UserPassesView = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [activeSubTab, setActiveSubTab] = useState("active"); // "active" | "history"
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true);
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
    fetchTransactions();
  }, [user._id]);

  const filteredData = transactions.filter((t) =>
    activeSubTab === "active"
      ? t.isActive && new Date(t.expiryDate) > new Date()
      : !t.isActive || new Date(t.expiryDate) < new Date(),
  );

  if (loading)
    return (
      <div className='h-[60vh] flex items-center justify-center'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='max-w-4xl mx-auto'>
        {/* Sub-Tabs */}
        <div className='flex gap-1 bg-gray-50 p-1 rounded-xl w-fit mb-8 border border-gray-100'>
          {["active", "history"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab)}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                activeSubTab === tab
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 hover:bg-white/50"
              }`}>
              {tab === "active" ? "Active Passes" : "Passes History"}
            </button>
          ))}
        </div>

        <motion.div layout className='space-y-4'>
          <AnimatePresence mode='popLayout'>
            {filteredData.length > 0 ? (
              filteredData.map((trx) => (
                <motion.div
                  key={trx._id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
                  {/* Left: Info */}
                  <div className='flex-1'>
                    <div className='flex items-center gap-3 mb-3'>
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          trx.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-gray-100 text-gray-500 border border-gray-200"
                        }`}>
                        {trx.isActive ? "Active" : "Expired"}
                      </span>
                    </div>
                    <h3 className='text-lg font-bold text-gray-900 mb-1'>
                      {trx.packageId?.packageName}
                    </h3>
                    <div className='flex flex-col gap-1'>
                      <p className='text-xs text-gray-500 font-medium flex items-center gap-2'>
                        <CalendarDays className='w-3.5 h-3.5' /> Purchased:{" "}
                        {new Date(trx.purchaseDate).toLocaleDateString("id-ID")}
                      </p>
                      <p className='text-xs text-gray-500 font-medium flex items-center gap-2'>
                        <Clock className='w-3.5 h-3.5' /> Valid thru:{" "}
                        {new Date(trx.expiryDate).toLocaleDateString("id-ID")}
                      </p>
                      <p className='text-xs text-gray-500 font-medium flex items-center gap-2'>
                        <MapPin className='w-3.5 h-3.5' />{" "}
                        {trx.issuingStudio?.studioName}
                      </p>
                    </div>
                  </div>

                  {/* Right: Credits */}
                  <div className='flex flex-col items-end gap-3 w-full md:w-auto'>
                    <div className='text-right'>
                      <p className='text-2xl font-bold text-gray-900'>
                        {trx.remainingCredits}
                      </p>
                      <p className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                        Credits Left
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className='py-20 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200'>
                <div className='w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 shadow-sm text-gray-300'>
                  <Ticket className='w-6 h-6' />
                </div>
                <p className='text-gray-500 font-medium'>
                  No {activeSubTab} passes found.
                </p>
              </div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};

// ============================================================================
// VIEW 3: PURCHASE HISTORY (Transactions)
// ============================================================================

const STATUS_STYLES = {
  pending: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: Clock,
    label: "Pending Payment",
  },
  waiting_confirmation: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    icon: Clock,
    label: "Pending Verification",
  },
  confirmed: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    icon: CheckCircle2,
    label: "Confirmed",
  },
  payment_rejected: {
    color: "text-red-800",
    bg: "bg-red-50",
    border: "border-red-200",
    icon: Ban,
    label: "Rejected",
  },
  expired: {
    color: "text-gray-500",
    bg: "bg-gray-100",
    border: "border-gray-200",
    icon: X,
    label: "Expired",
  },
};

const PurchaseHistoryView = ({ user }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
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
    fetchData();
  }, [user._id]);

  const filteredTransactions = transactions.filter((tx) => {
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(tx.status);
    const query = searchQuery.toLowerCase();
    const packageName = tx.packageId?.packageName?.toLowerCase() || "";
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

  if (loading)
    return (
      <div className='h-[60vh] flex items-center justify-center'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-12'>
      <div className='flex flex-col lg:flex-row gap-12 xl:gap-16'>
        {/* --- SIDEBAR FILTERS --- */}
        <aside
          className={`lg:w-64 xl:w-72 shrink-0 space-y-8 ${
            showMobileFilters
              ? "block fixed inset-0 z-50 bg-white p-6 overflow-y-auto"
              : "hidden lg:block"
          }`}>
          {/* ... filters content same as before ... */}
          <div className='flex items-center justify-between lg:hidden mb-8'>
            <h3 className='font-bold text-xl'>Filters</h3>
            <button
              onClick={() => setShowMobileFilters(false)}
              className='p-2 bg-gray-100 rounded-full'>
              <X className='w-5 h-5' />
            </button>
          </div>
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <Info className='w-4 h-4 text-gray-400' /> History Guide
            </h3>
            <div className='bg-gray-50 p-4 rounded-xl text-sm text-gray-600 space-y-3 border border-gray-100'>
              <p className='flex items-start gap-2'>
                <CheckCircle2 className='w-4 h-4 text-emerald-600 mt-0.5 shrink-0' />
                <span>
                  Approved transactions automatically add credits to your
                  account.
                </span>
              </p>
              <p className='flex items-start gap-2'>
                <AlertCircle className='w-4 h-4 text-red-500 mt-0.5 shrink-0' />
                <span>If rejected, check the reason and re-upload proof.</span>
              </p>
            </div>
          </div>
          <hr className='border-gray-100' />
          <div className='space-y-4'>
            <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2'>
              <Filter className='w-4 h-4 text-gray-400' /> Payment Status
            </h3>
            <div className='space-y-2'>
              {[
                { key: "pending", label: "Pending Payment" },
                { key: "waiting_confirmation", label: "Pending Verification" },
                { key: "confirmed", label: "Confirmed" },
                { key: "payment_rejected", label: "Rejected" },
              ].map((status) => (
                <label
                  key={status.key}
                  className='flex items-center gap-3 cursor-pointer group py-1 capitalize'>
                  <div
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                      selectedStatuses.includes(status.key)
                        ? "bg-emerald-600 border-emerald-600"
                        : "border-gray-300 bg-white group-hover:border-emerald-400"
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
                    className={`text-sm ${
                      selectedStatuses.includes(status.key)
                        ? "text-gray-900 font-medium"
                        : "text-gray-600"
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
          <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-gray-100'>
            <div>
              <p className='text-gray-500 text-sm'>
                Showing{" "}
                <span className='font-bold text-gray-900'>
                  {filteredTransactions.length}
                </span>{" "}
                transactions
              </p>
            </div>
            <div className='flex gap-2 w-full md:w-auto'>
              <div className='relative flex-1 md:w-64'>
                <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type='text'
                  placeholder='Search ID or Package...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className='w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500'
                />
              </div>
              <button
                className='lg:hidden flex items-center gap-2 text-sm font-bold text-gray-900 bg-gray-100 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors'
                onClick={() => setShowMobileFilters(true)}>
                <Filter className='w-4 h-4' />
              </button>
            </div>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-10'>
            {filteredTransactions.length > 0 ? (
              filteredTransactions.map((tx) => (
                <TransactionCard
                  key={tx._id}
                  tx={tx}
                  onClick={() => setSelectedTransaction(tx)}
                />
              ))
            ) : (
              <div className='col-span-full py-20 text-center'>
                <div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300'>
                  <History className='w-8 h-8' />
                </div>
                <h3 className='text-lg font-bold text-gray-900'>
                  No transactions found
                </h3>
                <p className='text-gray-500'>
                  Try adjusting your filters or search.
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
};

// ============================================================================
// SHARED & SUB COMPONENTS
// ============================================================================

const PackageCardMinimal = ({ pkg, onPurchase }) => {
  const priceFormatted = parseInt(pkg.packagePrice).toLocaleString("id-ID");
  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='group flex flex-col h-full cursor-pointer bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-emerald-500 transition-all duration-300 relative overflow-hidden'
      onClick={onPurchase}>
      <div className='absolute top-0 left-0 w-1 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />
      <div className='mb-4'>
        <span className='inline-block bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md'>
          {pkg.instructorType}
        </span>
      </div>
      <div className='flex-1 mb-6'>
        <h3 className='font-bold text-gray-900 text-xl mb-2 group-hover:text-emerald-700 transition-colors'>
          {pkg.packageName}
        </h3>
        <p className='text-gray-500 text-sm line-clamp-2 mb-4'>
          {pkg.packageDescription}
        </p>
        <div className='grid grid-cols-2 gap-4 text-sm mt-auto pt-2'>
          <div className='flex items-center gap-2 text-gray-700 bg-gray-50 px-1 py-3 rounded-lg'>
            <CalendarDays className='w-4 h-4 text-gray-400' />
            <span className='font-medium'>{pkg.credits} Sessions</span>
          </div>
          <div className='flex items-center gap-2 text-gray-700 bg-gray-50 px-1 py-3 rounded-lg'>
            <Clock className='w-4 h-4 text-gray-400' />
            <span className='font-medium'>{pkg.validityDays} Days</span>
          </div>
        </div>
      </div>
      <div className='pt-4 border-t border-gray-100 flex items-end justify-between'>
        <div>
          <p className='text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5'>
            Total
          </p>
          <p className='text-gray-900 font-mono font-bold text-lg'>
            IDR {priceFormatted}
          </p>
        </div>
        <button className='w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center group-hover:bg-emerald-600 transition-all shadow-md group-hover:shadow-lg group-hover:scale-110'>
          <ShoppingBag className='w-5 h-5' />
        </button>
      </div>
    </motion.div>
  );
};

const TransactionCard = ({ tx, onClick }) => {
  const config = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
  const StatusIcon = config.icon;
  const priceFormatted = tx.totalAmount.toLocaleString("id-ID");
  const dateFormatted = new Date(tx.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className='group flex flex-col h-full cursor-pointer bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-xl hover:border-emerald-500 transition-all duration-300 relative overflow-hidden'
      onClick={onClick}>
      <div className='flex justify-between items-start mb-4'>
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${config.bg} ${config.color} ${config.border}`}>
          <StatusIcon className='w-3 h-3' />
          {config.label}
        </div>
        <span className='text-xs text-gray-400 font-mono'>{dateFormatted}</span>
      </div>
      <div className='flex-1 mb-6'>
        <h3 className='font-bold text-gray-900 text-lg mb-2 group-hover:text-emerald-700 transition-colors line-clamp-2'>
          {tx.packageId?.packageName || "Unknown Package"}
        </h3>
        <p className='text-gray-400 text-xs font-mono mb-4'>
          {tx.transactionId}
        </p>
        <div className='flex items-center gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg'>
          <CreditCard className='w-4 h-4 text-gray-400' />
          <span className='capitalize'>
            {tx.paymentMethod?.replace(/_/g, " ")}
          </span>
        </div>
      </div>
      <div className='pt-4 border-t border-gray-100 flex items-end justify-between'>
        <div>
          <p className='text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5'>
            Amount
          </p>
          <p className='text-gray-900 font-mono font-bold text-lg'>
            IDR {priceFormatted}
          </p>
        </div>
        <button className='w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center group-hover:bg-emerald-600 transition-all shadow-md group-hover:shadow-lg group-hover:scale-110'>
          <ChevronRight className='w-5 h-5' />
        </button>
      </div>
    </motion.div>
  );
};

// ============================================================================
// INVOICE PREVIEW MODAL
// ============================================================================

const InvoicePreviewModal = ({ tx, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(tx.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className='fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4 print:p-0 print:bg-white print:static'>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-content, #invoice-content * { visibility: visible; }
          #invoice-content { position: absolute; left: 0; top: 0; width: 100%; height: 100%; margin: 0; padding: 20px; overflow: visible; }
          #invoice-actions { display: none; }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:shadow-none print:max-h-none print:rounded-none'>
        {/* Invoice Header Actions */}
        <div
          id='invoice-actions'
          className='flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50'>
          <h2 className='font-bold text-gray-900 flex items-center gap-2'>
            <FileText className='w-5 h-5 text-emerald-600' /> Invoice Preview
          </h2>
          <div className='flex gap-2'>
            <button
              onClick={handlePrint}
              className='flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg transition-colors'>
              <Printer className='w-4 h-4' /> Download PDF / Print
            </button>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
              <X className='w-5 h-5 text-gray-500' />
            </button>
          </div>
        </div>

        {/* Invoice Content - Added flex-1 for scrolling if needed */}
        <div
          id='invoice-content'
          className='p-10 overflow-y-auto bg-white font-sans text-gray-900 flex-1'>
          {/* Brand Header */}
          <div className='flex justify-between items-start mb-12'>
            <div>
              <h1 className='text-3xl font-bold text-emerald-950'>HAVA</h1>
              <p className='text-gray-500 text-sm mt-1'>
                Pilates & Wellness Studio
              </p>
            </div>
            <div className='text-right'>
              <h2 className='text-2xl font-bold text-gray-200 uppercase tracking-widest'>
                Invoice
              </h2>
              <p className='font-mono text-gray-500 mt-2'>
                #{tx.transactionId}
              </p>
            </div>
          </div>

          {/* Bill To / From */}
          <div className='flex justify-between mb-12'>
            <div>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
                Billed To
              </p>
              <h3 className='font-bold text-gray-900 text-lg'>
                {tx.userId?.fullName || "Valued Client"}
              </h3>
              <p className='text-gray-500 text-sm mt-1'>
                Member ID: {tx.userId?._id?.slice(-6).toUpperCase()}
              </p>
            </div>
            <div className='text-right'>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2'>
                Date Issued
              </p>
              <p className='text-gray-900 font-medium'>{formattedDate}</p>
              <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mt-4 mb-2'>
                Payment Method
              </p>
              <p className='text-gray-900 font-medium capitalize'>
                {tx.paymentMethod?.replace(/_/g, " ")}
              </p>
            </div>
          </div>

          {/* Line Items */}
          <div className='mb-12'>
            <table className='w-full'>
              <thead>
                <tr className='border-b-2 border-gray-100'>
                  <th className='text-left py-3 text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    Description
                  </th>
                  <th className='text-center py-3 text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    Credits
                  </th>
                  <th className='text-right py-3 text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className='border-b border-gray-50'>
                  <td className='py-4'>
                    <p className='font-bold text-gray-900'>
                      {tx.packageId?.packageName}
                    </p>
                    <p className='text-xs text-gray-500 mt-0.5'>
                      {tx.packageId?.packageDescription}
                    </p>
                  </td>
                  <td className='text-center py-4 text-gray-600'>
                    {tx.creditsPurchased} Sessions
                  </td>
                  <td className='text-right py-4 font-mono font-medium'>
                    IDR {parseInt(tx.totalAmount).toLocaleString("id-ID")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Total */}
          <div className='flex justify-end mb-12'>
            <div className='w-64'>
              <div className='flex justify-between py-2 border-b border-gray-100'>
                <span className='text-gray-500 text-sm'>Subtotal</span>
                <span className='font-mono text-gray-900'>
                  IDR {parseInt(tx.totalAmount).toLocaleString("id-ID")}
                </span>
              </div>
              <div className='flex justify-between py-4'>
                <span className='font-bold text-gray-900'>Total Paid</span>
                <span className='font-bold text-emerald-600 font-mono text-xl'>
                  IDR {parseInt(tx.totalAmount).toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className='border-t border-gray-100 pt-8 text-center'>
            <p className='text-emerald-900 font-bold mb-2'>
              Thank you for practicing with us!
            </p>
            <p className='text-gray-400 text-xs'>
              If you have any questions about this invoice, please contact our
              studio admin.
              <br />
              Hava Pilates Studio, Indonesia.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ============================================================================
// TRANSACTION DETAIL MODAL
// ============================================================================

const TransactionDetailModal = ({ tx, onClose }) => {
  const config = STATUS_STYLES[tx.status] || STATUS_STYLES.pending;
  const fileInputRef = useRef(null);

  // State for Invoice Modal
  const [showInvoice, setShowInvoice] = useState(false);

  // State for file upload UI
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
    // ... upload logic ...
  };

  const isRejected =
    tx.status === "payment_rejected" || tx.status === "rejected";

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 sm:p-6'>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        />
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.95 }}
          className='relative bg-white w-full max-w-2xl rounded-t-4xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
          {/* Header */}
          <div className='flex justify-between items-center px-8 py-6 border-b border-gray-100 bg-white z-10'>
            <div>
              <h2 className='text-xl font-bold text-gray-900'>
                Transaction Details
              </h2>
              <p className='text-xs text-gray-500 font-mono mt-1'>
                {tx.transactionId}
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
              <X className='w-6 h-6 text-gray-500' />
            </button>
          </div>

          {/* ADDED flex-1 HERE to fix scrolling */}
          <div className='p-8 overflow-y-auto flex-1'>
            {/* Status Alert Block */}
            <div
              className={`rounded-xl border p-5 mb-8 ${
                isRejected
                  ? "border-red-200 bg-[#FEF2F2]"
                  : "border-orange-100 bg-[#FFFBEB]"
              }`}>
              {isRejected ? (
                <>
                  <div className='flex items-center gap-2 mb-3'>
                    <div className='text-red-700'>
                      <Ban className='w-5 h-5' />
                    </div>
                    <h4 className='font-bold text-sm text-red-700 uppercase tracking-wide'>
                      Payment Rejected
                    </h4>
                  </div>
                  <div className='bg-red-100/50 border border-red-200 rounded-lg p-4'>
                    <p className='text-sm font-bold text-red-900 mb-1'>
                      Reason for Rejection:
                    </p>
                    <p className='text-sm text-red-800'>
                      {tx.rejectionReason || "Please contact admin."}
                    </p>
                  </div>
                </>
              ) : (
                <div className='flex items-center gap-2'>
                  <div className='text-amber-700'>
                    <Clock className='w-5 h-5' />
                  </div>
                  <div>
                    <h4 className='font-bold text-sm text-amber-700 uppercase tracking-wide'>
                      {config.label}
                    </h4>
                    <p className='text-sm text-amber-900/80 mt-1'>
                      {tx.status === "pending"
                        ? "Please complete your payment."
                        : "Waiting for verification."}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Details Summary */}
            <div className='bg-gray-50 px-8 py-6 border border-gray-100 rounded-2xl mb-8'>
              <div className='flex flex-col md:flex-row justify-between items-start mb-6 gap-4'>
                <div className='flex-1'>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                    Package
                  </p>
                  <h3 className='font-bold text-gray-900 text-lg leading-tight'>
                    {tx.packageId?.packageName}
                  </h3>
                </div>
                <div className='text-left md:text-right shrink-0'>
                  <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5'>
                    Total Paid
                  </p>
                  <h3 className='font-bold text-emerald-600 text-2xl font-mono'>
                    IDR {parseInt(tx.totalAmount).toLocaleString("id-ID")}
                  </h3>
                </div>
              </div>
              <div className='grid grid-cols-2 gap-6'>
                <div className='flex flex-col'>
                  <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1'>
                    Credits
                  </span>
                  <span className='font-bold text-gray-900 text-sm flex items-center gap-2'>
                    <Hash className='w-4 h-4 text-emerald-600' />
                    {tx.creditsPurchased} Sessions
                  </span>
                </div>
                <div className='flex flex-col'>
                  <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1'>
                    Payment Method
                  </span>
                  <span className='font-bold text-gray-900 text-sm flex items-center gap-2 capitalize'>
                    <CreditCard className='w-4 h-4 text-emerald-600' />
                    {tx.paymentMethod?.replace(/_/g, " ")}
                  </span>
                </div>
                <div className='flex flex-col'>
                  <span className='text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1'>
                    Date
                  </span>
                  <span className='font-bold text-gray-900 text-sm flex items-center gap-2'>
                    <CalendarDays className='w-4 h-4 text-emerald-600' />
                    {new Date(tx.createdAt).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div>
              {isRejected && (
                <div className='space-y-4'>
                  <input
                    type='file'
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className='hidden'
                    accept='image/jpeg,image/png,application/pdf'
                  />
                  <div
                    onClick={handleTriggerFileSelect}
                    className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                      selectedFile
                        ? "border-emerald-500 bg-emerald-50"
                        : "border-gray-300 bg-gray-50 hover:bg-gray-100"
                    }`}>
                    {selectedFile ? (
                      <div className='text-center w-full'>
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt='Preview'
                            className='h-24 mx-auto mb-4 object-contain rounded-lg shadow-sm bg-white'
                          />
                        ) : (
                          <div className='w-16 h-16 bg-white rounded-lg flex items-center justify-center mx-auto mb-4 shadow-sm text-emerald-600'>
                            <FileIcon className='w-8 h-8' />
                          </div>
                        )}
                        <div className='flex items-center justify-center gap-2 text-emerald-800 font-medium mb-1'>
                          <CheckCircle2 className='w-5 h-5' />
                          <span>{selectedFile.name}</span>
                        </div>
                        <p className='text-emerald-600 text-sm'>
                          Changed? Click to replace
                        </p>
                      </div>
                    ) : (
                      <div className='text-center'>
                        <div className='w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm text-gray-400 border border-gray-100'>
                          <ImageIcon className='w-6 h-6' />
                        </div>
                        <p className='text-gray-600 font-medium'>
                          Click to upload image
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedFile && (
                    <button
                      onClick={handleConfirmUpload}
                      disabled={uploading}
                      className='w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all'>
                      {uploading ? (
                        <>
                          <Loader2 className='w-5 h-5 animate-spin' />{" "}
                          Uploading...
                        </>
                      ) : (
                        <>
                          <UploadCloud className='w-5 h-5' /> Re-upload Proof of
                          Payment
                        </>
                      )}
                    </button>
                  )}
                </div>
              )}

              {tx.status === "confirmed" && (
                <button
                  onClick={() => setShowInvoice(true)}
                  className='w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-xl font-bold flex items-center justify-center gap-2 transition-all'>
                  <FileText className='w-5 h-5' /> View & Download Invoice
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* INVOICE PREVIEW MODAL */}
      <AnimatePresence>
        {showInvoice && (
          <InvoicePreviewModal tx={tx} onClose={() => setShowInvoice(false)} />
        )}
      </AnimatePresence>
    </>
  );
};

export default ManagePackage;
