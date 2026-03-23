import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Minus,
  X,
  Check,
  CreditCard,
  Banknote,
  Scan,
  UserPlus,
  ChevronDown,
  Building,
  TicketPercent,
  ShoppingBag,
  User as UserIcon,
  QrCode,
  ArrowRight,
  Tag,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { useAuth } from "../../../context/AuthContext";

// Ensure these are correctly exported from your helpers file
import { INDONESIAN_BANKS } from "../../../utils/helper";
import { getBankLogo } from "../../../utils/helpers";

const CashierDashboard = () => {
  const { user } = useAuth();

  // --- STATE ---
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [availablePromos, setAvailablePromos] = useState([]); // Real promos from DB
  const [categories, setCategories] = useState(["All"]);

  const [searchPackage, setSearchPackage] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const [cart, setCart] = useState({}); // { packageId: quantity }
  const [selectedClients, setSelectedClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [showClientDropdown, setShowClientDropdown] = useState(false);

  const [promoCode, setPromoCode] = useState("");

  // Modal States
  const [showClientListModal, setShowClientListModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);

  const dropdownRef = useRef(null);

  // --- FETCH DATA (Users, Packages, Promos) ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const studioId = user?.adminStudioLocation;
        if (!studioId) return;

        const [usersRes, packagesRes, promosRes] = await Promise.all([
          axiosInstance.get(API_PATHS.AUTH.GET_ALL_USERS),
          axiosInstance.get(API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(studioId)),
          axiosInstance.get(`/api/promos/studio/${studioId}`), // Fetch Real Promos
        ]);

        if (usersRes.data)
          setUsers(usersRes.data.filter((u) => u.role === "client"));
        if (promosRes.data)
          setAvailablePromos(promosRes.data.filter((p) => p.isActive));

        if (packagesRes.data) {
          setPackages(packagesRes.data);
          const uniqueCategories = new Set(["All"]);
          packagesRes.data.forEach((pkg) => {
            if (pkg.classType && pkg.classType.length > 0) {
              pkg.classType.forEach((type) => uniqueCategories.add(type));
            } else {
              uniqueCategories.add("Standard");
            }
          });
          setCategories(Array.from(uniqueCategories));
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- CART & CLIENT LOGIC ---
  const updateCart = (pkgId, delta) => {
    setCart((prev) => {
      const currentQty = prev[pkgId] || 0;
      const newQty = currentQty + delta;
      if (newQty <= 0) {
        const newCart = { ...prev };
        delete newCart[pkgId];
        return newCart;
      }
      return { ...prev, [pkgId]: newQty };
    });
  };

  const handleToggleClient = (userObj) => {
    const isSelected = selectedClients.some((c) => c._id === userObj._id);
    if (isSelected) {
      setSelectedClients(selectedClients.filter((c) => c._id !== userObj._id));
    } else {
      setSelectedClients([...selectedClients, userObj]);
    }
  };

  const removeClient = (userId) =>
    setSelectedClients(selectedClients.filter((c) => c._id !== userId));

  const clearTransaction = () => {
    setCart({});
    setSelectedClients([]);
    setPromoCode("");
  };

  // --- REACTIVE MATH (CLIENT MULTIPLIER & REAL DB DISCOUNTS) ---
  const cartItems = Object.entries(cart).map(([pkgId, qty]) => {
    const pkg = packages.find((p) => p._id === pkgId) || {};
    return { ...pkg, qty };
  });

  const baseCartTotal = cartItems.reduce(
    (sum, item) => sum + Number(item.packagePrice || 0) * item.qty,
    0,
  );
  const clientMultiplier =
    selectedClients.length > 0 ? selectedClients.length : 1;
  const subtotal = baseCartTotal * clientMultiplier;

  const totalBaseQty = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalItemsPurchased = totalBaseQty * clientMultiplier;

  // Calculate discount dynamically based on current cart and real Promo rules
  let discount = 0;
  if (promoCode) {
    const activePromo = availablePromos.find(
      (p) => p.code === promoCode.toUpperCase(),
    );

    if (activePromo) {
      if (activePromo.discountType === "percentage") {
        discount = subtotal * (activePromo.discountValue / 100);
      } else if (activePromo.discountType === "fixed") {
        discount = activePromo.discountValue;
      } else if (activePromo.discountType === "buy_x_get_y") {
        let eligiblePrices = [];
        cartItems.forEach((item) => {
          for (let i = 0; i < item.qty * clientMultiplier; i++) {
            eligiblePrices.push(Number(item.packagePrice || 0));
          }
        });
        eligiblePrices.sort((a, b) => a - b); // Cheapest items are free

        const groupSize = activePromo.buyX + activePromo.getY;
        const freeGroups = Math.floor(eligiblePrices.length / groupSize);
        const freeItemsCount = freeGroups * activePromo.getY;

        for (let i = 0; i < freeItemsCount; i++) discount += eligiblePrices[i];
      }
    }
  }

  // Ensure discount doesn't exceed subtotal
  discount = Math.min(discount, subtotal);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleProceedPayment = () => {
    if (selectedClients.length === 0)
      return alert("Please select at least one client.");
    if (Object.keys(cart).length === 0)
      return alert("Please add packages to the cart.");
    setShowPaymentModal(true);
  };

  // --- FILTERING ---
  const filteredPackages = packages.filter((p) => {
    const pkgCategory =
      p.classType && p.classType.length > 0 ? p.classType[0] : "Standard";
    const matchesCategory =
      activeCategory === "All" || pkgCategory === activeCategory;
    const matchesSearch = (p.packageName || "")
      .toLowerCase()
      .includes(searchPackage.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className='flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#F8FAFC] font-sans text-slate-800 w-full'>
      {/* ================= LEFT MAIN AREA (PACKAGES) ================= */}
      <div className='flex-1 flex flex-col h-full min-h-[50vh] md:min-h-0 min-w-0 border-r border-slate-200'>
        <div className='bg-white p-4 md:p-6 border-b border-slate-200 shrink-0 w-full'>
          <div className='flex flex-col md:flex-row md:justify-between md:items-center mb-4 md:mb-6 gap-4'>
            <div>
              <h1 className='text-xl md:text-[24px] font-extrabold text-slate-900 tracking-tight'>
                Packages Menu
              </h1>
              <p className='text-xs md:text-sm text-slate-500 mt-1 font-medium'>
                Select items to build the order
              </p>
            </div>
            <div className='relative w-full md:w-80 shrink-0'>
              <Search className='w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' />
              <input
                type='text'
                placeholder='Search packages...'
                className='w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-[14px] text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm font-medium'
                value={searchPackage}
                onChange={(e) => setSearchPackage(e.target.value)}
              />
            </div>
          </div>

          <div className='flex gap-3 overflow-x-auto pb-2 custom-scrollbar w-full'>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-5 py-2.5 rounded-[12px] text-[13px] font-bold border transition-all whitespace-nowrap shrink-0 ${activeCategory === cat ? "bg-emerald-50 border-[#1a4d3e] text-[#1a4d3e] shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50"}`}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Packages Grid */}
        <div className='flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar w-full'>
          {filteredPackages.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full text-slate-400'>
              <ShoppingBag className='w-12 h-12 mb-3 text-slate-300' />
              <p className='text-sm font-medium'>No packages found.</p>
            </div>
          ) : (
            <div className='grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-5 w-full'>
              {filteredPackages.map((pkg) => {
                const qty = cart[pkg._id] || 0;
                const pkgCategory =
                  pkg.classType && pkg.classType.length > 0
                    ? pkg.classType[0]
                    : "Standard";
                const price = Number(pkg.packagePrice || 0);

                return (
                  <div
                    key={pkg._id}
                    className='bg-white border border-slate-200 rounded-[20px] p-4 flex flex-col h-48 md:h-52 shadow-sm hover:shadow-md transition-all hover:border-[#1a4d3e]/30 group relative w-full min-w-0'>
                    <div className='h-12 bg-slate-50 rounded-xl mb-3 flex items-center justify-center border border-slate-100 relative overflow-hidden shrink-0'>
                      <div className='absolute inset-0 bg-[#1a4d3e]/5 group-hover:bg-[#1a4d3e]/10 transition-colors'></div>
                      <span className='font-bold text-slate-400 text-[9px] md:text-[10px] tracking-widest uppercase'>
                        {pkgCategory}
                      </span>
                    </div>
                    <div className='flex-1 min-h-0 w-full'>
                      <h3 className='font-extrabold text-xs md:text-sm text-slate-800 leading-tight mb-1 truncate'>
                        {pkg.packageName}
                      </h3>
                      <p className='text-[10px] md:text-xs text-slate-500 font-medium'>
                        {pkg.credits} Credits • {pkg.validityDays} Days
                      </p>
                    </div>
                    <div className='flex items-center justify-between mt-auto pt-3 border-t border-slate-100 shrink-0 w-full'>
                      <span className='font-extrabold text-[12px] md:text-[14px] text-slate-900 truncate'>
                        Rp {(price / 1000).toLocaleString()}k
                      </span>
                      {qty === 0 ? (
                        <button
                          onClick={() => updateCart(pkg._id, 1)}
                          className='w-7 h-7 md:w-8 md:h-8 rounded-[10px] bg-[#1a4d3e]/5 border border-[#1a4d3e]/10 hover:bg-[#1a4d3e]/10 text-[#1a4d3e] flex items-center justify-center transition-colors shrink-0'>
                          <Plus className='w-4 h-4' />
                        </button>
                      ) : (
                        <div className='flex items-center gap-1 bg-emerald-50 rounded-[10px] p-1 border border-emerald-100 shrink-0'>
                          <button
                            onClick={() => updateCart(pkg._id, -1)}
                            className='w-5 h-5 md:w-6 md:h-6 rounded-md bg-white text-emerald-600 flex items-center justify-center shadow-sm hover:bg-slate-50'>
                            <Minus className='w-3 h-3' />
                          </button>
                          <span className='text-xs font-extrabold text-emerald-800 w-4 text-center'>
                            {qty}
                          </span>
                          <button
                            onClick={() => updateCart(pkg._id, 1)}
                            className='w-5 h-5 md:w-6 md:h-6 rounded-md bg-[#1a4d3e] text-white flex items-center justify-center shadow-sm hover:bg-[#133d31]'>
                            <Plus className='w-3 h-3' />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= RIGHT SIDEBAR (CART) ================= */}
      <div className='w-full md:w-[380px] lg:w-[420px] bg-[#F8FAFC] flex flex-col h-full shrink-0 z-10'>
        <div className='p-6 flex justify-between items-center shrink-0 w-full'>
          <div>
            <h2 className='text-xl font-extrabold text-slate-900'>
              Current Order
            </h2>
            <p className='text-[13px] font-medium text-slate-500 mt-0.5'>
              {totalBaseQty} Items Selected
            </p>
          </div>
          <button
            onClick={clearTransaction}
            className='text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors'>
            Clear All
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-6 space-y-6 custom-scrollbar w-full min-h-0'>
          {/* 1. Selected Packages */}
          <div className='w-full'>
            <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3'>
              1. Selected Packages
            </h3>
            {cartItems.length === 0 ? (
              <div className='text-center p-6 bg-white border border-slate-200 border-dashed rounded-[16px] text-slate-400 text-sm font-medium'>
                Add packages from the menu.
              </div>
            ) : (
              <div className='space-y-3 w-full'>
                {cartItems.map((item) => (
                  <div
                    key={item._id}
                    className='flex justify-between items-center text-sm bg-white p-4 rounded-[16px] border border-slate-200 shadow-sm w-full min-w-0'>
                    <div className='flex items-center gap-3 pr-2 min-w-0 flex-1'>
                      <span className='font-bold text-emerald-700 bg-emerald-50 border border-emerald-100/50 px-2 py-1 rounded-md shrink-0'>
                        {item.qty}x
                      </span>
                      <div className='min-w-0 flex-1'>
                        <p className='font-bold text-slate-900 leading-tight truncate'>
                          {item.packageName}
                        </p>
                        <p className='text-[11px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider'>
                          IDR {Number(item.packagePrice || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className='font-bold text-slate-900 shrink-0 pl-2'>
                      {(
                        Number(item.packagePrice || 0) * item.qty
                      ).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 2. Assign Clients */}
          <div className='w-full'>
            <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3'>
              2. Assign to Clients
            </h3>
            <button
              onClick={() => setShowClientListModal(true)}
              className='w-full flex items-center gap-3 px-4 py-3.5 bg-white border border-slate-300 rounded-[14px] hover:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm group min-w-0'>
              <UserPlus className='w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0' />
              <span className='text-slate-500 font-medium text-[14px] truncate'>
                Search or select clients...
              </span>
            </button>
            {selectedClients.length > 0 && (
              <div className='flex flex-wrap gap-2 mt-3 w-full'>
                {selectedClients.map((client) => (
                  <div
                    key={client._id}
                    className='flex items-center gap-2 bg-[#1e293b] text-white px-3 py-1.5 rounded-lg text-[11px] font-semibold shadow-sm max-w-full'>
                    <span className='truncate'>{client.fullName}</span>
                    <button
                      onClick={() => removeClient(client._id)}
                      className='text-slate-400 hover:text-white shrink-0'>
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Totals & Proceed Footer */}
        <div className='p-6 bg-[#F8FAFC] shrink-0 w-full'>
          {/* Promo Selector Button */}
          <div className='mb-6'>
            {promoCode ? (
              <div className='flex items-center justify-between bg-emerald-50 border border-emerald-200 px-4 py-3 rounded-[12px]'>
                <div className='flex items-center gap-2 text-emerald-700'>
                  <TicketPercent className='w-5 h-5' />
                  <span className='font-bold text-sm tracking-wide'>
                    {promoCode.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => setPromoCode("")}
                  className='text-emerald-600 hover:bg-emerald-100 p-1 rounded-md transition-colors'>
                  <X className='w-4 h-4' />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPromoModal(true)}
                className='w-full flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-600 font-bold px-4 py-3 rounded-[12px] shadow-sm transition-all text-sm'>
                <Tag className='w-4 h-4' /> Select Promo Code
              </button>
            )}
          </div>

          <div className='space-y-3 mb-6 text-[13px] w-full'>
            <div className='flex justify-between text-slate-500 font-medium'>
              <span>Cart Total ({totalBaseQty}x packages)</span>
              <span className='font-bold text-slate-700'>
                Rp {baseCartTotal.toLocaleString()}
              </span>
            </div>
            {clientMultiplier > 1 && (
              <div className='flex justify-between text-slate-500 font-medium'>
                <span>Client Multiplier</span>
                <span className='font-bold text-slate-700'>
                  x {clientMultiplier} Clients
                </span>
              </div>
            )}
            <div className='flex justify-between text-slate-500 font-medium pt-2 border-t border-slate-200/60'>
              <span>Subtotal</span>
              <span className='font-bold text-slate-700'>
                Rp {subtotal.toLocaleString()}
              </span>
            </div>
            {discount > 0 && (
              <div className='flex justify-between text-emerald-600 font-bold'>
                <span>Discount</span>
                <span>- Rp {discount.toLocaleString()}</span>
              </div>
            )}
            <div className='flex justify-between items-end pt-3 mt-1'>
              <span className='font-extrabold text-slate-900'>
                Total Payable
              </span>
              <span className='text-3xl font-black text-[#10b981] tracking-tight'>
                Rp {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handleProceedPayment}
            disabled={selectedClients.length === 0 || cartItems.length === 0}
            className='w-full bg-[#1a4d3e] hover:bg-[#133d31] disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold py-4 rounded-[14px] flex items-center justify-center gap-2 transition-all shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] disabled:shadow-none text-[15px]'>
            <span>Proceed to Payment</span>
            <ArrowRight className='w-5 h-5 ml-1' />
          </button>
        </div>
      </div>

      {/* --- MODALS --- */}
      <AnimatePresence>
        {showClientListModal && (
          <ClientSelectionModal
            users={users}
            selectedClients={selectedClients}
            onToggleClient={handleToggleClient}
            onClose={() => setShowClientListModal(false)}
          />
        )}

        {showPromoModal && (
          <PromoSelectionModal
            onClose={() => setShowPromoModal(false)}
            onApply={(code) => {
              setPromoCode(code);
              setShowPromoModal(false);
            }}
            totalItemsPurchased={totalItemsPurchased}
            availablePromos={availablePromos}
          />
        )}

        {showPaymentModal && (
          <PaymentModal
            onClose={() => setShowPaymentModal(false)}
            grandTotal={grandTotal}
            promoCode={promoCode}
            discount={discount}
            cart={cart}
            selectedClients={selectedClients}
            clearTransaction={clearTransaction}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// --- PROMO SELECTION MODAL ---
const PromoSelectionModal = ({
  onClose,
  onApply,
  totalItemsPurchased,
  availablePromos,
}) => {
  const [manualCode, setManualCode] = useState("");

  const handleSelect = (promo) => {
    if (totalItemsPurchased < promo.minItemsRequired) {
      alert(
        `This promo requires at least ${promo.minItemsRequired} total package(s) across all clients.`,
      );
      return;
    }
    onApply(promo.code);
  };

  const handleManualApply = () => {
    if (!manualCode.trim()) return;
    const found = availablePromos.find(
      (p) => p.code === manualCode.trim().toUpperCase(),
    );
    if (!found) return alert("Invalid promo code.");
    if (totalItemsPurchased < found.minItemsRequired) {
      return alert(
        `This promo requires at least ${found.minItemsRequired} total package(s).`,
      );
    }
    onApply(manualCode.trim().toUpperCase());
  };

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className='bg-white w-full max-w-md rounded-[28px] shadow-2xl overflow-hidden'>
        <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white'>
          <h3 className='text-lg font-extrabold text-gray-900'>Select Promo</h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>

        <div className='p-6 bg-slate-50/50 space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar'>
          {availablePromos.length === 0 && (
            <p className='text-center text-sm text-slate-400 font-medium py-4'>
              No active promos available.
            </p>
          )}
          {availablePromos.map((promo) => {
            const isEligible = totalItemsPurchased >= promo.minItemsRequired;
            return (
              <button
                key={promo.code}
                onClick={() => handleSelect(promo)}
                className={`w-full text-left p-4 border rounded-2xl transition-all flex justify-between items-center ${isEligible ? "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer group" : "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"}`}>
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <TicketPercent
                      className={`w-4 h-4 ${isEligible ? "text-emerald-600" : "text-slate-400"}`}
                    />
                    <span className='font-extrabold text-slate-800'>
                      {promo.code}
                    </span>
                  </div>
                  <p className='text-xs text-slate-500 font-medium'>
                    {promo.title}
                  </p>
                  <p className='text-[10px] text-slate-400 mt-1'>
                    Requires {promo.minItemsRequired} items.
                  </p>
                </div>
                {isEligible && (
                  <ArrowRight className='w-4 h-4 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />
                )}
              </button>
            );
          })}
        </div>

        <div className='p-6 bg-white border-t border-gray-100'>
          <p className='text-xs font-bold text-slate-400 uppercase tracking-widest mb-3'>
            Manual Entry
          </p>
          <div className='flex gap-2'>
            <input
              type='text'
              placeholder='Enter code...'
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className='flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-[12px] text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:normal-case placeholder:font-medium'
            />
            <button
              onClick={handleManualApply}
              className='px-6 py-3 bg-slate-800 text-white font-bold rounded-[12px] hover:bg-slate-900 transition-colors'>
              Apply
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// --- PAYMENT COMPLETION MODAL ---
const PaymentModal = ({
  onClose,
  grandTotal,
  promoCode,
  discount,
  cart,
  selectedClients,
  clearTransaction,
}) => {
  const [paymentMethod, setPaymentMethod] = useState("transfer");
  const [isLoading, setIsLoading] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const [paymentDetails, setPaymentDetails] = useState({
    edcType: "credit",
    last4: "",
    approvalCode: "",
    bank: "BCA",
  });

  const handleCompleteTransaction = async () => {
    if (
      paymentMethod === "edc" &&
      (paymentDetails.last4.length !== 4 || !paymentDetails.approvalCode)
    ) {
      return alert(
        "Please enter the 4-digit card number and approval code for EDC payment.",
      );
    }
    setIsLoading(true);

    try {
      let packageIds = [];
      Object.entries(cart).forEach(([id, qty]) => {
        for (let i = 0; i < qty; i++) packageIds.push(id);
      });

      let notesArr = [];
      if (promoCode) notesArr.push(`Promo: ${promoCode} (-${discount})`);
      if (paymentMethod === "edc")
        notesArr.push(
          `EDC (${paymentDetails.edcType.toUpperCase()}) | Card: **${paymentDetails.last4} | AppCode: ${paymentDetails.approvalCode}`,
        );
      if (paymentMethod === "bank_transfer")
        notesArr.push(`Bank Transfer: ${paymentDetails.bank}`);
      if (paymentMethod === "qris") notesArr.push(`QRIS Payment`);

      const payload = {
        userIds: selectedClients.map((c) => c._id),
        packageIds: packageIds,
        paymentMethod:
          paymentMethod === "transfer" ? "bank_transfer" : paymentMethod, // mapping to db enum
        totalAmount: grandTotal,
        notes: notesArr.join(" | "),
      };

      const response = await axiosInstance.post(
        API_PATHS.PURCHASES.CASHIER_BULK || "/api/purchases/cashier-bulk",
        payload,
      );

      if (response.data) {
        alert("Transaction successful!");
        clearTransaction();
        onClose();
      }
    } catch (error) {
      console.error(error);
      const errMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "An error occurred.";
      alert(`Error: ${errMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-[500px] rounded-[24px] shadow-2xl flex flex-col overflow-visible'>
        <div className='px-6 py-5 flex justify-between items-center relative'>
          <h3 className='text-lg font-extrabold text-slate-900'>
            Complete Payment
          </h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='px-8 pb-6 text-center'>
          <p className='text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mb-1'>
            Total to Charge
          </p>
          <p className='text-[36px] font-black text-[#10b981] tracking-tight'>
            Rp {grandTotal.toLocaleString()}
          </p>
        </div>

        <div className='px-6 pb-2'>
          <p className='text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3'>
            Select Method
          </p>
          <div className='flex gap-2 mb-6'>
            {[
              { id: "cash", icon: Banknote, label: "Cash" },
              { id: "edc", icon: CreditCard, label: "Card/EDC" },
              { id: "transfer", icon: Scan, label: "Transfer" },
              { id: "qris", icon: QrCode, label: "QRIS" },
            ].map((method) => {
              const Icon = method.icon;
              const isActive = paymentMethod === method.id;
              return (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex-1 flex flex-col items-center justify-center py-4 rounded-[16px] border-[1.5px] transition-all ${isActive ? "border-[#10b981] bg-emerald-50 text-[#10b981]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                  <Icon className='w-5 h-5 mb-2' />
                  <span className='text-[10px] font-bold uppercase tracking-wider'>
                    {method.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className='min-h-[120px]'>
            <AnimatePresence mode='wait'>
              {paymentMethod === "edc" && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className='space-y-3'>
                  <div className='flex gap-2 mb-4'>
                    <button
                      onClick={() =>
                        setPaymentDetails({
                          ...paymentDetails,
                          edcType: "credit",
                        })
                      }
                      className={`flex-1 py-3 text-[12px] font-extrabold rounded-xl transition-all border ${paymentDetails.edcType === "credit" ? "bg-white shadow-sm border-slate-300 text-slate-800" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
                      Credit Card
                    </button>
                    <button
                      onClick={() =>
                        setPaymentDetails({
                          ...paymentDetails,
                          edcType: "debit",
                        })
                      }
                      className={`flex-1 py-3 text-[12px] font-extrabold rounded-xl transition-all border ${paymentDetails.edcType === "debit" ? "bg-white shadow-sm border-slate-300 text-slate-800" : "bg-slate-50 border-slate-100 text-slate-400"}`}>
                      Debit Card
                    </button>
                  </div>
                  <div className='flex gap-3'>
                    <div className='flex-1'>
                      <p className='text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1'>
                        Last 4 Digits
                      </p>
                      <input
                        type='text'
                        maxLength='4'
                        placeholder='****'
                        value={paymentDetails.last4}
                        onChange={(e) =>
                          setPaymentDetails({
                            ...paymentDetails,
                            last4: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        className='w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 text-center tracking-[0.3em] placeholder:tracking-normal'
                      />
                    </div>
                    <div className='flex-1'>
                      <p className='text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1'>
                        Approval Code
                      </p>
                      <input
                        type='text'
                        placeholder='CODE'
                        value={paymentDetails.approvalCode}
                        onChange={(e) =>
                          setPaymentDetails({
                            ...paymentDetails,
                            approvalCode: e.target.value.toUpperCase(),
                          })
                        }
                        className='w-full p-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-emerald-500 text-center uppercase'
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {paymentMethod === "transfer" && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className='relative pt-2'>
                  <button
                    onClick={() => setShowBankDropdown(!showBankDropdown)}
                    className='w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-[14px] text-sm font-bold text-slate-700 shadow-sm'>
                    <div className='flex items-center gap-3'>
                      <div className='w-9 h-6'>
                        {getBankLogo(paymentDetails.bank)}
                      </div>
                      {paymentDetails.bank}
                    </div>
                    <ChevronDown className='w-4 h-4 text-slate-400' />
                  </button>
                  {showBankDropdown && (
                    <div className='absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-200 shadow-xl rounded-[16px] z-50 max-h-[200px] overflow-y-auto custom-scrollbar'>
                      {INDONESIAN_BANKS.map((bank) => (
                        <div
                          key={bank}
                          onClick={() => {
                            setPaymentDetails({ ...paymentDetails, bank });
                            setShowBankDropdown(false);
                          }}
                          className='flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0'>
                          {bank !== "OTHER" ? (
                            <div className='w-9 h-6'>{getBankLogo(bank)}</div>
                          ) : (
                            <Building className='w-5 h-5 ml-2 mr-2 text-slate-400' />
                          )}
                          <span className='text-[13px] font-bold text-slate-700'>
                            {bank}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}

              {paymentMethod === "qris" && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className='flex items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-[16px] bg-slate-50 mt-2'>
                  <div className='text-center'>
                    <QrCode className='w-10 h-10 mx-auto text-emerald-600 mb-2' />
                    <p className='text-sm font-bold text-slate-600'>
                      Awaiting QRIS Scan
                    </p>
                    <p className='text-[11px] font-medium text-slate-400 mt-1'>
                      Verify payment on EDC before submitting.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className='p-6'>
          <button
            onClick={handleCompleteTransaction}
            disabled={isLoading}
            className='w-full bg-[#1a4d3e] hover:bg-[#133d31] disabled:bg-slate-300 disabled:text-slate-500 text-white font-extrabold py-4 rounded-[14px] shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] disabled:shadow-none text-[15px] transition-all'>
            {isLoading ? "Processing..." : "Complete Transaction"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// --- CLIENT SELECTION MODAL ---
const ClientSelectionModal = ({
  users,
  selectedClients,
  onToggleClient,
  onClose,
}) => {
  const [localSearch, setLocalSearch] = useState("");

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        (u.fullName || "").toLowerCase().includes(localSearch.toLowerCase()) ||
        (u.phoneNumber || "").includes(localSearch) ||
        (u.email || "").toLowerCase().includes(localSearch.toLowerCase()),
    );
  }, [users, localSearch]);

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-lg rounded-[28px] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden'>
        <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white'>
          <h3 className='text-lg font-extrabold text-gray-900'>
            Select Clients
          </h3>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-slate-100'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <div className='p-4 border-b border-gray-100 bg-slate-50/50'>
          <div className='relative'>
            <Search className='w-4 h-4 absolute left-3 top-3 text-slate-400' />
            <input
              type='text'
              placeholder='Search name or phone...'
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm'
              autoFocus
            />
          </div>
        </div>
        <div className='overflow-y-auto custom-scrollbar flex-1 bg-white p-2'>
          {filteredUsers.length > 0 ? (
            <div className='space-y-1'>
              {filteredUsers.map((user) => {
                const isSelected = selectedClients.some(
                  (c) => c._id === user._id,
                );
                return (
                  <div
                    key={user._id}
                    onClick={() => onToggleClient(user)}
                    className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all border ${isSelected ? "bg-emerald-50/50 border-emerald-200 shadow-sm" : "bg-white border-transparent hover:bg-slate-50"}`}>
                    <div className='flex items-center gap-3'>
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm uppercase ${isSelected ? "bg-emerald-200 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p
                          className={`font-bold text-sm ${isSelected ? "text-emerald-900" : "text-slate-800"}`}>
                          {user.fullName}
                        </p>
                        <p className='text-xs text-slate-500 font-medium'>
                          {user.phoneNumber || user.email}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                      {isSelected && (
                        <Check
                          className='w-3.5 h-3.5 text-white'
                          strokeWidth={3}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className='py-12 text-center text-slate-400'>
              <UserIcon className='w-10 h-10 mx-auto mb-3 text-slate-300' />
              <p>No clients found.</p>
            </div>
          )}
        </div>
        <div className='p-5 border-t border-gray-100 bg-white'>
          <button
            onClick={onClose}
            className='w-full py-3.5 bg-[#1a4d3e] text-white font-bold rounded-xl shadow-lg'>
            Done Selecting ({selectedClients.length})
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default CashierDashboard;
