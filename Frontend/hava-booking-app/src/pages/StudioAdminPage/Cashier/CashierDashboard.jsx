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
  ChevronsUpDown,
  Building,
  TicketPercent,
  ShoppingBag,
  User as UserIcon,
  QrCode,
  ArrowRight,
  Tag,
  AlertTriangle,
  Lock,
  Info,
  UserPlus2,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { useAuth } from "../../../context/AuthContext";
import { INDONESIAN_BANKS } from "../../../utils/helper";
import { getBankLogo } from "../../../utils/helpers";

const getEffectivePrice = (pkg) => {
  return pkg.isPromo && pkg.promoPrice
    ? Number(pkg.promoPrice)
    : Number(pkg.packagePrice || 0);
};

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className='relative w-full sm:w-auto min-w-[160px]'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='w-full flex items-center justify-between gap-3 px-3.5 py-2 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors'>
        <span className='truncate'>
          {value === "All" ? placeholder : value}
        </span>
        <ChevronsUpDown className='w-4 h-4 text-slate-400 shrink-0' />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className='absolute top-full mt-1.5 left-0 w-full bg-white border border-slate-200 rounded-xl shadow-lg z-50 py-1.5 max-h-60 overflow-y-auto custom-scrollbar'>
            {options.map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  value === opt
                    ? "bg-emerald-50 text-emerald-700 font-bold"
                    : "text-slate-700 hover:bg-slate-50 font-medium"
                }`}>
                {opt === "All" ? placeholder : opt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const CashierDashboard = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [availablePromos, setAvailablePromos] = useState([]);
  const [categories, setCategories] = useState(["All"]);
  const [classTypes, setClassTypes] = useState(["All"]);
  const [instructorTypes, setInstructorTypes] = useState(["All"]);
  const [searchPackage, setSearchPackage] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeClassType, setActiveClassType] = useState("All");
  const [activeInstructorType, setActiveInstructorType] = useState("All");
  const [clientOwnership, setClientOwnership] = useState({});
  const [cart, setCart] = useState({});
  const [selectedClients, setSelectedClients] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [showClientListModal, setShowClientListModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [selectedPackageDetails, setSelectedPackageDetails] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const studioId = user?.adminStudioLocation;
        if (!studioId) return;

        const promosPromise = axiosInstance
          .get(`/api/promos/studio/${studioId}`)
          .catch(() => ({ data: [] }));
        const purchasesPromise = axiosInstance
          .get(`/api/purchases/studio/${studioId}`)
          .catch(() => ({ data: [] }));
        const passesPromise = axiosInstance
          .get(`/api/user-passes/studio/${studioId}`)
          .catch(() => ({ data: [] }));

        const [usersRes, packagesRes, promosRes, purchasesRes, passesRes] =
          await Promise.all([
            axiosInstance.get(API_PATHS.AUTH.GET_ALL_USERS),
            axiosInstance.get(
              API_PATHS.PACKAGES.GET_PACKAGE_BY_STUDIO(studioId),
            ),
            promosPromise,
            purchasesPromise,
            passesPromise,
          ]);

        if (usersRes.data)
          setUsers(usersRes.data.filter((u) => u.role === "client"));

        if (promosRes.data) {
          // --- FIX: Only allow Cashier to see "admin" type promos ---
          setAvailablePromos(
            promosRes.data.filter((p) => p.isActive && p.promoType === "admin"),
          );
        }

        if (packagesRes.data) {
          setPackages(packagesRes.data);

          const uniqueCategories = new Set(["All"]);
          const uniqueClassTypes = new Set(["All"]);
          const uniqueInstructorTypes = new Set(["All"]);

          packagesRes.data.forEach((pkg) => {
            if (pkg.packageCategory && pkg.packageCategory.length > 0) {
              pkg.packageCategory.forEach((type) => uniqueCategories.add(type));
            } else {
              uniqueCategories.add("Regular");
            }

            if (pkg.isCombo) {
              pkg.comboItems?.forEach((item) => {
                item.classType?.forEach((ct) => uniqueClassTypes.add(ct));
                item.instructorType?.forEach((it) =>
                  uniqueInstructorTypes.add(it),
                );
              });
            } else {
              pkg.classType?.forEach((ct) => uniqueClassTypes.add(ct));
              pkg.instructorType?.forEach((it) =>
                uniqueInstructorTypes.add(it),
              );
            }
          });

          setCategories(Array.from(uniqueCategories));
          setClassTypes(Array.from(uniqueClassTypes));
          setInstructorTypes(Array.from(uniqueInstructorTypes));
        }

        const ownership = {};
        const registerOwnership = (uid, pid) => {
          if (!uid || !pid) return;
          const uStr = String(uid._id || uid);
          const pStr = String(pid._id || pid);
          if (!ownership[uStr]) ownership[uStr] = new Set();
          ownership[uStr].add(pStr);
        };

        if (purchasesRes.data) {
          purchasesRes.data.forEach((p) => {
            if (p.status !== "payment_rejected" && p.status !== "expired") {
              registerOwnership(p.userId, p.packageId);
            }
          });
        }
        if (passesRes.data) {
          passesRes.data.forEach((p) =>
            registerOwnership(p.userId, p.packageId),
          );
        }

        setClientOwnership(ownership);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      }
    };
    fetchData();
  }, [user]);

  const handleClientCreated = (newUser) => {
    setUsers((prev) => [newUser, ...prev]);
    setSelectedClients((prev) => [...prev, newUser]);
  };

  const cartItems = Object.entries(cart).map(([pkgId, qty]) => {
    const pkg = packages.find((p) => p._id === pkgId) || {};
    return { ...pkg, qty };
  });

  const updateCart = (pkgId, delta) => {
    const pkg = packages.find((p) => p._id === pkgId);

    if (delta > 0 && pkg?.isOneTimePurchase) {
      if (cart[pkgId] >= 1)
        return alert(
          "This package is a one-time purchase and is limited to 1 per transaction.",
        );

      const alreadyOwnedClient = selectedClients.find((client) => {
        return clientOwnership[String(client._id)]?.has(String(pkgId));
      });

      if (alreadyOwnedClient)
        return alert(
          `Cannot add. Client ${alreadyOwnedClient.fullName} has already purchased this one-time package in the past.`,
        );
    }

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
      const userStrId = String(userObj._id);
      const conflictingPackage = cartItems.find((item) => {
        return (
          item.isOneTimePurchase &&
          clientOwnership[userStrId]?.has(String(item._id))
        );
      });

      if (conflictingPackage) {
        return alert(
          `Cannot select ${userObj.fullName}. They already own the one-time package: ${conflictingPackage.packageName}.`,
        );
      }

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

  const baseCartTotal = cartItems.reduce(
    (sum, item) => sum + getEffectivePrice(item) * item.qty,
    0,
  );
  const clientMultiplier =
    selectedClients.length > 0 ? selectedClients.length : 1;
  const subtotal = baseCartTotal * clientMultiplier;
  const totalBaseQty = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const totalItemsPurchased = totalBaseQty * clientMultiplier;

  // --- FIX: Use .staticCode for calculating discount logic since it's an Admin promo ---
  let discount = 0;
  if (promoCode) {
    const upperCode = promoCode.toUpperCase().trim();
    const activePromo = availablePromos.find((p) => p.staticCode === upperCode);

    if (activePromo) {
      if (activePromo.discountType === "percentage") {
        discount = subtotal * (activePromo.discountValue / 100);
      } else if (activePromo.discountType === "fixed") {
        discount = activePromo.discountValue;
      } else if (activePromo.discountType === "buy_x_get_y") {
        let eligiblePrices = [];
        cartItems.forEach((item) => {
          for (let i = 0; i < item.qty * clientMultiplier; i++)
            eligiblePrices.push(getEffectivePrice(item));
        });
        eligiblePrices.sort((a, b) => a - b);
        const groupSize = activePromo.buyX + activePromo.getY;
        const freeGroups = Math.floor(eligiblePrices.length / groupSize);
        const freeItemsCount = freeGroups * activePromo.getY;
        for (let i = 0; i < freeItemsCount; i++) discount += eligiblePrices[i];
      }
    }
  }

  discount = Math.min(discount, subtotal);
  const grandTotal = Math.max(0, subtotal - discount);

  const handleProceedPayment = () => {
    if (selectedClients.length === 0)
      return alert("Please select at least one client.");
    if (Object.keys(cart).length === 0)
      return alert("Please add packages to the cart.");
    setShowPaymentModal(true);
  };

  const filteredPackages = packages.filter((p) => {
    const pCats = p.packageCategory?.length ? p.packageCategory : ["Regular"];
    const matchCat = activeCategory === "All" || pCats.includes(activeCategory);

    let pClassTypes = [];
    let pInstTypes = [];

    if (p.isCombo) {
      p.comboItems?.forEach((item) => {
        pClassTypes.push(...(item.classType || []));
        pInstTypes.push(...(item.instructorType || []));
      });
    } else {
      pClassTypes = p.classType || [];
      pInstTypes = p.instructorType || [];
    }

    const matchClass =
      activeClassType === "All" || pClassTypes.includes(activeClassType);
    const matchInst =
      activeInstructorType === "All" ||
      pInstTypes.includes(activeInstructorType);
    const matchesSearch = (p.packageName || "")
      .toLowerCase()
      .includes(searchPackage.toLowerCase());

    return matchCat && matchClass && matchInst && matchesSearch;
  });

  return (
    <div className='flex flex-col md:flex-row min-h-screen md:h-screen md:overflow-hidden bg-[#F8FAFC] font-sans text-slate-800 w-full'>
      <div className='flex-1 flex flex-col h-full min-h-[50vh] md:min-h-0 min-w-0 border-r border-slate-200 bg-white'>
        <div className='p-6 border-b border-slate-100 shrink-0 w-full shadow-sm z-10'>
          <div className='flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4'>
            <div>
              <h1 className='text-2xl font-extrabold text-slate-900 tracking-tight'>
                Packages Menu
              </h1>
              <p className='text-sm text-slate-500 mt-1 font-medium'>
                Select items to build the order
              </p>
            </div>
            <div className='relative w-full md:w-80 shrink-0'>
              <Search className='w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' />
              <input
                type='text'
                placeholder='Search packages...'
                className='w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all font-medium shadow-sm'
                value={searchPackage}
                onChange={(e) => setSearchPackage(e.target.value)}
              />
            </div>
          </div>

          <div className='flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between w-full'>
            <div className='flex gap-2 overflow-x-auto pb-1 custom-scrollbar flex-1 w-full'>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-full text-sm font-bold border transition-all whitespace-nowrap shrink-0 ${activeCategory === cat ? "bg-white border-[#1a4d3e] text-[#1a4d3e] shadow-sm" : "bg-transparent border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"}`}>
                  {cat}
                </button>
              ))}
            </div>

            <div className='flex gap-3 w-full sm:w-auto shrink-0'>
              <CustomSelect
                value={activeClassType}
                onChange={setActiveClassType}
                options={classTypes}
                placeholder='All Classes'
              />
              <CustomSelect
                value={activeInstructorType}
                onChange={setActiveInstructorType}
                options={instructorTypes}
                placeholder='All Instructors'
              />
            </div>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-6 custom-scrollbar w-full bg-[#F8FAFC]'>
          {filteredPackages.length === 0 ? (
            <div className='flex flex-col items-center justify-center h-full text-slate-400'>
              <ShoppingBag className='w-12 h-12 mb-3 text-slate-300' />
              <p className='text-sm font-medium'>No packages match filters.</p>
            </div>
          ) : (
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-3 w-full items-stretch'>
              {filteredPackages.map((pkg) => {
                const qty = cart[pkg._id] || 0;
                const activePrice = getEffectivePrice(pkg);
                const totalPkgCredits = pkg.isCombo
                  ? pkg.comboItems?.reduce(
                      (acc, item) => acc + (item.credits || 0),
                      0,
                    )
                  : pkg.credits;
                const primaryCat = (
                  pkg.packageCategory?.length
                    ? pkg.packageCategory
                    : ["Regular"]
                )[0];

                return (
                  <div
                    key={pkg._id}
                    className='bg-white border border-slate-200 rounded-2xl p-5 flex flex-col h-full min-h-[12rem] shadow-sm hover:shadow-md transition-all hover:border-[#1a4d3e]/40 group w-full'>
                    <div className='flex items-start justify-between mb-4'>
                      <div className='flex items-center gap-1.5'>
                        <span className='flex items-center h-6 px-2.5 bg-slate-50 border border-slate-200 text-slate-600 font-extrabold text-[8px] tracking-widest uppercase rounded-md'>
                          {primaryCat}
                        </span>

                        {pkg.isOneTimePurchase && (
                          <span className='flex items-center gap-1 h-6 px-2.5 bg-[#fff8eb] border border-amber-200/60 text-amber-600 font-extrabold text-[8px] tracking-widest uppercase rounded-md'>
                            <AlertTriangle className='w-3 h-3' /> 1-TIME
                          </span>
                        )}

                        {pkg.isPromo && (
                          <span className='flex items-center gap-1 h-6 px-2.5 bg-pink-50 border border-pink-100 text-pink-600 font-extrabold text-[8px] tracking-widest uppercase rounded-md'>
                            <Tag className='w-3 h-3' /> PROMO
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedPackageDetails(pkg)}
                        className='text-slate-400 hover:text-[#1a4d3e] p-1 rounded-full transition-colors shrink-0'
                        title='View Details'>
                        <Info className='w-[18px] h-[18px]' />
                      </button>
                    </div>

                    <div className='flex-1 flex flex-col min-h-0 w-full mb-2'>
                      <h3 className='font-extrabold text-[15px] text-slate-900 leading-snug mb-1.5'>
                        {pkg.packageName}
                      </h3>
                      <p className='text-xs text-slate-500 font-semibold mb-4'>
                        {pkg.isCombo ? "Combo Package" : ""}{" "}
                        {totalPkgCredits > 0
                          ? `• ${totalPkgCredits} Credits`
                          : ""}{" "}
                        • {pkg.validityDays} Days
                      </p>
                    </div>

                    <div className='flex items-center justify-between mt-auto pt-4 border-t border-slate-100 shrink-0 w-full min-h-[44px]'>
                      <div className='flex flex-col'>
                        {pkg.isPromo && (
                          <span className='text-xs text-slate-400 line-through leading-none mb-1'>
                            Rp {(pkg.packagePrice / 1000).toLocaleString()}k
                          </span>
                        )}
                        <span
                          className={`font-black text-[14px] leading-none ${pkg.isPromo ? "text-[#10b981]" : "text-slate-900"}`}>
                          Rp {(activePrice / 1000).toLocaleString()}k
                        </span>
                      </div>

                      {qty === 0 ? (
                        <button
                          onClick={() => updateCart(pkg._id, 1)}
                          className='w-8 h-8 rounded-full bg-slate-50 border border-slate-200 hover:bg-[#1a4d3e] hover:text-white hover:border-[#1a4d3e] text-slate-500 font-bold flex items-center justify-center transition-colors shrink-0 shadow-sm'>
                          <Plus className='w-4 h-4' />
                        </button>
                      ) : (
                        <div className='flex items-center h-8 gap-1 bg-[#eefbf4] rounded-full p-1 border border-emerald-100 shrink-0'>
                          <button
                            onClick={() => updateCart(pkg._id, -1)}
                            className='w-6 h-6 rounded-full bg-white text-emerald-600 flex items-center justify-center shadow-sm hover:bg-emerald-50 transition-colors'>
                            <Minus className='w-3.5 h-3.5' />
                          </button>
                          <span className='text-xs font-black text-emerald-900 w-5 text-center leading-none'>
                            {qty}
                          </span>
                          <button
                            onClick={() => updateCart(pkg._id, 1)}
                            className='w-6 h-6 rounded-full bg-[#1a4d3e] text-white flex items-center justify-center shadow-sm hover:bg-[#133d31] transition-colors'>
                            <Plus className='w-3.5 h-3.5' />
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

      <div className='w-full md:w-[400px] lg:w-[440px] bg-white flex flex-col h-full shrink-0 z-20 shadow-[-4px_0_24px_-10px_rgba(0,0,0,0.05)] border-l border-slate-200'>
        <div className='p-6 flex justify-between items-center shrink-0 w-full border-b border-slate-100 bg-white'>
          <div>
            <h2 className='text-xl font-extrabold text-slate-900'>
              Current Order
            </h2>
            <p className='text-sm font-medium text-slate-500 mt-0.5'>
              {totalBaseQty} Items Selected
            </p>
          </div>
          <button
            onClick={clearTransaction}
            className='text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors'>
            Clear All
          </button>
        </div>

        <div className='flex-1 overflow-y-auto px-6 py-6 space-y-8 custom-scrollbar w-full min-h-0 bg-[#F8FAFC]'>
          <div className='w-full mb-8'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold'>
                1
              </div>
              <h3 className='text-xs font-extrabold text-slate-400 uppercase tracking-widest'>
                Selected Packages
              </h3>
            </div>

            {cartItems.length === 0 ? (
              <div className='text-center p-6 bg-white border border-slate-200 border-dashed rounded-xl text-slate-400 text-sm font-medium'>
                Add packages from the menu.
              </div>
            ) : (
              <div className='space-y-3 w-full'>
                {cartItems.map((item) => {
                  const itemPrice = getEffectivePrice(item);
                  return (
                    <div
                      key={item._id}
                      className='relative flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm w-full min-w-0 group'>
                      <div className='flex items-center gap-3.5 pr-2 min-w-0 flex-1'>
                        <div className='w-11 h-11 rounded-lg bg-[#eefbf4] text-[#10b981] flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-100/50'>
                          {item.qty}x
                        </div>
                        <div className='min-w-0 flex-1'>
                          <p className='font-bold text-sm text-slate-900 leading-tight truncate'>
                            {item.packageName}
                          </p>
                          <div className='flex items-center gap-2 mt-1'>
                            <p className='text-[11px] font-medium text-slate-500 uppercase tracking-wider'>
                              IDR {itemPrice.toLocaleString()}
                            </p>
                            {item.isPromo && (
                              <span className='text-[9px] bg-pink-50 text-pink-600 px-1.5 py-0.5 rounded border border-pink-100 font-bold tracking-wider'>
                                PROMO
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className='flex items-center gap-2 shrink-0'>
                        <span className='font-bold text-[14px] text-slate-900'>
                          {(itemPrice * item.qty).toLocaleString()}
                        </span>
                        <button
                          onClick={() => updateCart(item._id, -item.qty)}
                          className='text-slate-300 hover:text-rose-500 p-1.5 hover:bg-rose-50 rounded-md transition-all opacity-0 group-hover:opacity-100'
                          title='Remove Item'>
                          <X className='w-4 h-4' />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className='p-6 bg-white border-t border-slate-100 shrink-0 w-full shadow-[0_-4px_10px_rgba(0,0,0,0.02)]'>
          <div className='flex items-center gap-3 mb-4'>
            <div className='w-5 h-5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[10px] font-bold'>
              2
            </div>
            <h3 className='text-xs font-extrabold text-slate-400 uppercase tracking-widest'>
              Assign & Discount
            </h3>
          </div>

          {selectedClients.length > 0 && (
            <div className='flex flex-wrap gap-2 mb-3 w-full max-h-[80px] overflow-y-auto custom-scrollbar'>
              {selectedClients.map((client) => (
                <div
                  key={client._id}
                  className='flex items-center gap-1.5 bg-slate-800 text-white pl-2.5 pr-1 py-1 rounded-lg text-xs font-medium shadow-sm max-w-full'>
                  <span className='truncate'>{client.fullName}</span>
                  <button
                    onClick={() => removeClient(client._id)}
                    className='text-slate-400 hover:text-white shrink-0 p-0.5 transition-colors'>
                    <X className='w-3.5 h-3.5' />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className='flex flex-row gap-3 w-full mb-6'>
            <button
              onClick={() => setShowClientListModal(true)}
              className='flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-white border border-slate-200 rounded-xl hover:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all shadow-sm group min-w-0'>
              <UserPlus className='w-4 h-4 text-slate-400 group-hover:text-emerald-500 transition-colors shrink-0' />
              <span className='text-slate-600 font-bold text-xs truncate'>
                Select Clients
              </span>
            </button>

            {promoCode ? (
              <div className='flex-1 flex items-center justify-between bg-emerald-50 border border-emerald-200 px-3 py-3 rounded-xl shadow-sm min-w-0'>
                <div className='flex items-center gap-1.5 text-emerald-700 min-w-0'>
                  <TicketPercent className='w-4 h-4 shrink-0' />
                  <span className='font-bold text-xs tracking-wide truncate'>
                    {promoCode.toUpperCase()}
                  </span>
                </div>
                <button
                  onClick={() => setPromoCode("")}
                  className='text-emerald-600 hover:bg-emerald-100 p-1 rounded-md transition-colors shrink-0'>
                  <X className='w-3.5 h-3.5' />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPromoModal(true)}
                className='flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 font-bold shadow-sm transition-all text-xs group min-w-0'>
                <Tag className='w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0' />
                <span className='truncate'>Promo Code</span>
              </button>
            )}
          </div>

          <div className='space-y-3 mb-6 text-sm w-full'>
            <div className='flex justify-between text-slate-500 font-medium'>
              <span>Cart Total ({totalBaseQty}x)</span>
              <span className='font-bold text-slate-900'>
                Rp {baseCartTotal.toLocaleString()}
              </span>
            </div>
            {clientMultiplier > 1 && (
              <div className='flex justify-between text-slate-500 font-medium'>
                <span>Client Multiplier</span>
                <span className='font-bold text-slate-900'>
                  x {clientMultiplier}
                </span>
              </div>
            )}
            <div className='flex justify-between text-slate-500 font-medium pt-3 border-t border-slate-100'>
              <span>Subtotal</span>
              <span className='font-bold text-slate-900'>
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
              <span className='text-[28px] font-black text-[#10b981] tracking-tight leading-none'>
                Rp {grandTotal.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={handleProceedPayment}
            disabled={selectedClients.length === 0 || cartItems.length === 0}
            className='w-full bg-[#1a4d3e] hover:bg-[#133d31] disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:shadow-none text-[15px]'>
            <span>Proceed to Payment</span>
            <ArrowRight className='w-5 h-5 ml-1' />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {selectedPackageDetails && (
          <PackageDetailsModal
            pkg={selectedPackageDetails}
            onClose={() => setSelectedPackageDetails(null)}
            cartQty={cart[selectedPackageDetails._id] || 0}
            onUpdateCart={updateCart}
          />
        )}
        {showClientListModal && (
          <ClientSelectionModal
            users={users}
            selectedClients={selectedClients}
            onToggleClient={handleToggleClient}
            onClose={() => setShowClientListModal(false)}
            cartItems={cartItems}
            clientOwnership={clientOwnership}
            onClientCreated={handleClientCreated}
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
            packages={packages}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const PackageDetailsModal = ({ pkg, onClose, cartQty, onUpdateCart }) => {
  if (!pkg) return null;
  const activePrice = getEffectivePrice(pkg);
  const totalPkgCredits = pkg.isCombo
    ? pkg.comboItems?.reduce((acc, item) => acc + (item.credits || 0), 0)
    : pkg.credits;

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden'>
        <div className='px-6 py-5 flex justify-between items-center border-b border-slate-100 bg-white shrink-0'>
          <h3 className='text-lg font-extrabold text-slate-900'>
            Package Details
          </h3>
          <button
            onClick={onClose}
            className='p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='p-6 overflow-y-auto max-h-[60vh] custom-scrollbar bg-[#F8FAFC]'>
          <div className='mb-6'>
            <h4 className='text-xl font-black text-slate-900 mb-1.5 leading-snug'>
              {pkg.packageName}
            </h4>
            <p className='text-sm text-slate-500 font-bold'>
              {pkg.isCombo
                ? `Combo Package • ${totalPkgCredits} Credits`
                : `${totalPkgCredits} Credits`}{" "}
              • {pkg.validityDays} Days
            </p>
          </div>

          <div className='space-y-4'>
            <h5 className='text-xs font-extrabold text-slate-400 uppercase tracking-widest'>
              Included Passes & Rules
            </h5>

            {pkg.isCombo ? (
              <div className='space-y-3'>
                {pkg.comboItems?.map((item, idx) => (
                  <div
                    key={idx}
                    className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-1.5'>
                    <span className='font-bold text-sm text-slate-800'>
                      {item.credits}x {item.classType.join(", ")}
                    </span>
                    <span className='text-xs text-slate-500 font-medium'>
                      {item.instructorType.join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4'>
                <div>
                  <span className='font-extrabold text-slate-400 block text-[10px] uppercase tracking-wider mb-1.5'>
                    Eligible Classes
                  </span>
                  <p className='text-slate-800 text-sm font-bold leading-tight'>
                    {pkg.classType?.join(", ") || "-"}
                  </p>
                </div>
                <div>
                  <span className='font-extrabold text-slate-400 block text-[10px] uppercase tracking-wider mb-1.5'>
                    Eligible Instructors
                  </span>
                  <p className='text-slate-800 text-sm font-bold leading-tight'>
                    {pkg.instructorType?.join(", ") || "-"}
                  </p>
                </div>
              </div>
            )}

            {pkg.packageDescription && (
              <div className='bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4'>
                <span className='font-extrabold text-slate-400 block text-[10px] uppercase tracking-wider mb-2'>
                  Description
                </span>
                <p className='text-slate-600 text-sm leading-relaxed whitespace-pre-wrap'>
                  {pkg.packageDescription}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='p-6 bg-white border-t border-slate-100 flex items-center justify-between shrink-0 min-h-[96px]'>
          <div className='flex flex-col'>
            {pkg.isPromo && (
              <span className='text-xs text-slate-400 line-through leading-none mb-1.5'>
                Rp {(pkg.packagePrice / 1000).toLocaleString()}k
              </span>
            )}
            <span
              className={`font-black text-2xl leading-none ${pkg.isPromo ? "text-[#10b981]" : "text-slate-900"}`}>
              Rp {(activePrice / 1000).toLocaleString()}k
            </span>
          </div>

          {cartQty === 0 ? (
            <button
              onClick={() => onUpdateCart(pkg._id, 1)}
              className='h-11 px-6 rounded-xl bg-[#1a4d3e] hover:bg-[#133d31] text-white font-bold flex items-center justify-center transition-colors shadow-md'>
              Add to Cart
            </button>
          ) : (
            <div className='flex items-center h-11 gap-1 bg-[#eefbf4] rounded-xl p-1.5 border border-emerald-200'>
              <button
                onClick={() => onUpdateCart(pkg._id, -1)}
                className='w-8 h-8 rounded-lg bg-white text-emerald-600 flex items-center justify-center shadow-sm hover:bg-emerald-50 transition-colors'>
                <Minus className='w-4 h-4' />
              </button>
              <span className='text-sm font-black text-emerald-900 w-6 text-center leading-none'>
                {cartQty}
              </span>
              <button
                onClick={() => onUpdateCart(pkg._id, 1)}
                className='w-8 h-8 rounded-lg bg-[#1a4d3e] text-white flex items-center justify-center shadow-sm hover:bg-[#133d31] transition-colors'>
                <Plus className='w-4 h-4' />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const ClientSelectionModal = ({
  users,
  selectedClients,
  onToggleClient,
  onClose,
  cartItems,
  clientOwnership,
  onClientCreated,
}) => {
  const [localSearch, setLocalSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [newClient, setNewClient] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
  });

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        (u.fullName || "").toLowerCase().includes(localSearch.toLowerCase()) ||
        (u.phoneNumber || "").includes(localSearch) ||
        (u.email || "").toLowerCase().includes(localSearch.toLowerCase()),
    );
  }, [users, localSearch]);

  const getConflictingPackage = (user) => {
    const userStrId = String(user._id);
    return cartItems.find((item) => {
      return (
        item.isOneTimePurchase &&
        clientOwnership[userStrId]?.has(String(item._id))
      );
    });
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    if (!newClient.fullName || !newClient.email || !newClient.phoneNumber)
      return alert("Please fill all fields.");
    setIsSaving(true);
    try {
      const payload = {
        ...newClient,
        role: "client",
        password: "HavaPilatesClient123!",
      };
      const res = await axiosInstance.post(
        API_PATHS.AUTH.REGISTER || "/api/auth/register",
        payload,
      );

      const createdUser = res.data.user || res.data;
      onClientCreated(createdUser);
      setIsAdding(false);
      setNewClient({ fullName: "", email: "", phoneNumber: "" });
    } catch (err) {
      alert(
        `Error creating client: ${err.response?.data?.message || err.response?.data?.error || err.message}`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden'>
        <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white shrink-0'>
          <h3 className='text-lg font-extrabold text-gray-900'>
            {isAdding ? "Register New Client" : "Select Clients"}
          </h3>
          <div className='flex items-center gap-2'>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className='flex items-center gap-1.5 text-emerald-600 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors'>
                <UserPlus2 className='w-4 h-4' /> New
              </button>
            )}
            <button
              onClick={onClose}
              className='p-2 rounded-full hover:bg-slate-100'>
              <X className='w-5 h-5 text-slate-400' />
            </button>
          </div>
        </div>

        {isAdding ? (
          <div className='flex-1 overflow-y-auto p-6 bg-slate-50/50'>
            <form
              id='new-client-form'
              onSubmit={handleCreateClient}
              className='space-y-4'>
              <div>
                <label className='block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5'>
                  Full Name
                </label>
                <input
                  required
                  type='text'
                  value={newClient.fullName}
                  onChange={(e) =>
                    setNewClient({ ...newClient, fullName: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm'
                  placeholder='John Doe'
                />
              </div>
              <div>
                <label className='block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5'>
                  Email
                </label>
                <input
                  required
                  type='email'
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm'
                  placeholder='john@example.com'
                />
              </div>
              <div>
                <label className='block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1.5'>
                  Phone Number
                </label>
                <input
                  required
                  type='tel'
                  value={newClient.phoneNumber}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phoneNumber: e.target.value })
                  }
                  className='w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 text-sm'
                  placeholder='08123456789'
                />
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className='p-4 border-b border-gray-100 bg-slate-50/50 shrink-0'>
              <div className='relative'>
                <Search className='w-4 h-4 absolute left-3 top-3 text-slate-400' />
                <input
                  type='text'
                  placeholder='Search name or phone...'
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className='w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm'
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
                    const conflictPackage = getConflictingPackage(user);
                    const isDisabled = !!conflictPackage && !isSelected;

                    return (
                      <div
                        key={user._id}
                        onClick={() => !isDisabled && onToggleClient(user)}
                        className={`p-3 rounded-xl flex justify-between items-center transition-all border ${
                          isDisabled
                            ? "bg-slate-50 border-slate-100 opacity-60 cursor-not-allowed"
                            : isSelected
                              ? "bg-emerald-50/50 border-emerald-200 shadow-sm cursor-pointer"
                              : "bg-white border-transparent hover:bg-slate-50 cursor-pointer"
                        }`}>
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
                            {isDisabled && (
                              <p className='text-[10px] text-amber-600 font-bold flex items-center gap-1 mt-1'>
                                <Lock className='w-3 h-3' /> Owns 1-Time Pkg:{" "}
                                {conflictPackage.packageName}
                              </p>
                            )}
                          </div>
                        </div>
                        {!isDisabled && (
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`}>
                            {isSelected && (
                              <Check
                                className='w-3.5 h-3.5 text-white'
                                strokeWidth={3}
                              />
                            )}
                          </div>
                        )}
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
          </>
        )}

        <div className='p-5 border-t border-gray-100 bg-white shrink-0'>
          {isAdding ? (
            <div className='flex gap-3'>
              <button
                onClick={() => setIsAdding(false)}
                className='flex-1 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors'>
                Cancel
              </button>
              <button
                type='submit'
                form='new-client-form'
                disabled={isSaving}
                className='flex-1 py-3.5 bg-[#1a4d3e] text-white font-bold rounded-xl shadow-lg hover:bg-[#133d31] transition-colors disabled:opacity-50'>
                {isSaving ? "Saving..." : "Save & Select"}
              </button>
            </div>
          ) : (
            <button
              onClick={onClose}
              className='w-full py-3.5 bg-[#1a4d3e] hover:bg-[#133d31] transition-colors text-white font-bold rounded-xl shadow-lg'>
              Done Selecting ({selectedClients.length})
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const PromoSelectionModal = ({
  onClose,
  onApply,
  totalItemsPurchased,
  availablePromos,
}) => {
  const [manualCode, setManualCode] = useState("");

  const handleSelect = (promo) => {
    if (totalItemsPurchased < promo.minItemsRequired)
      return alert(
        `This promo requires at least ${promo.minItemsRequired} total package(s) across all clients.`,
      );
    // --- FIX: Pass staticCode because Cashier ONLY sees admin promos ---
    onApply(promo.staticCode);
  };

  const handleManualApply = async () => {
    if (!manualCode.trim()) return;
    onApply(manualCode.trim().toUpperCase());
  };

  return (
    <div className='fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className='bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden'>
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
                key={promo._id}
                onClick={() => handleSelect(promo)}
                className={`w-full text-left p-4 border rounded-xl transition-all flex justify-between items-center ${isEligible ? "bg-white border-slate-200 hover:border-emerald-400 hover:shadow-md cursor-pointer group" : "bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed"}`}>
                <div>
                  <div className='flex items-center gap-2 mb-1'>
                    <TicketPercent
                      className={`w-4 h-4 ${isEligible ? "text-emerald-600" : "text-slate-400"}`}
                    />
                    {/* --- FIX: Display staticCode --- */}
                    <span className='font-extrabold text-slate-800'>
                      {promo.staticCode}
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
              className='flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none uppercase placeholder:normal-case placeholder:font-medium'
            />
            <button
              onClick={handleManualApply}
              className='px-6 py-3 bg-slate-800 text-white font-bold rounded-xl hover:bg-slate-900 transition-colors'>
              Apply
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const PaymentModal = ({
  onClose,
  grandTotal,
  promoCode,
  discount,
  cart,
  selectedClients,
  clearTransaction,
  packages,
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
      let legacyPackageIds = [];
      Object.entries(cart).forEach(([id, qty]) => {
        for (let i = 0; i < qty; i++) legacyPackageIds.push(id);
      });

      const purchasedPackages = Object.entries(cart).map(([id, qty]) => {
        const pkg = packages.find((p) => p._id === id);
        return {
          packageId: id,
          qty,
          priceAtPurchase: pkg ? getEffectivePrice(pkg) : 0,
        };
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
        packageIds: legacyPackageIds,
        purchasedPackages: purchasedPackages,
        paymentMethod:
          paymentMethod === "transfer" ? "bank_transfer" : paymentMethod,
        paymentDetails: paymentDetails || {},
        totalAmount: grandTotal,
        discountAmount: discount || 0,
        promoCode: promoCode || null,
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
      alert(
        `Error: ${error.response?.data?.error || error.response?.data?.message || "An error occurred."}`,
      );
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
                  className={`flex-1 flex flex-col items-center justify-center py-4 rounded-xl border-[1.5px] transition-all ${isActive ? "border-[#10b981] bg-emerald-50 text-[#10b981]" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
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
                    className='w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 shadow-sm'>
                    <div className='flex items-center gap-3'>
                      <div className='w-9 h-6'>
                        {getBankLogo(paymentDetails.bank)}
                      </div>
                      {paymentDetails.bank}
                    </div>
                    <ChevronDown className='w-4 h-4 text-slate-400' />
                  </button>
                  {showBankDropdown && (
                    <div className='absolute bottom-full mb-2 left-0 w-full bg-white border border-slate-200 shadow-xl rounded-xl z-50 max-h-[200px] overflow-y-auto custom-scrollbar'>
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
                  className='flex items-center justify-center p-6 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 mt-2'>
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

export default CashierDashboard;
