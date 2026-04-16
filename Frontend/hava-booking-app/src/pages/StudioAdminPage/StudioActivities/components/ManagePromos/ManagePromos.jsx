import React, { useState, useEffect } from "react";
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  TicketPercent,
  Check,
  X,
  Power,
  List,
  Printer,
  Mail,
  MessageCircle,
  ChevronsUpDown,
  Users,
  KeyRound,
  ShieldCheck,
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";

const ManagePromos = () => {
  const { user } = useAuth();
  const [promos, setPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showFormModal, setShowFormModal] = useState(false);
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [selectedPromoForCodes, setSelectedPromoForCodes] = useState(null);
  const [editingPromoId, setEditingPromoId] = useState(null);

  const defaultFormData = {
    title: "",
    promoType: "bulk",
    prefix: "",
    quantity: 1,
    generateMoreQuantity: 0,
    staticCode: "",
    maxUsageLimit: 100,
    description: "",
    discountType: "percentage",
    discountValue: 0,
    buyX: 0,
    getY: 0,
    minItemsRequired: 1,
  };

  const [formData, setFormData] = useState(defaultFormData);

  const fetchPromos = async () => {
    try {
      const studioId = user?.adminStudioLocation;
      if (!studioId) return;
      const res = await axiosInstance.get(`/api/promos/studio/${studioId}`);
      setPromos(res.data);
    } catch (error) {
      console.error("Error fetching promos", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPromoId) {
        await axiosInstance.put(`/api/promos/${editingPromoId}`, formData);
        alert("Promo Campaign Updated!");
      } else {
        await axiosInstance.post("/api/promos", formData);
        alert("Promo Campaign Created!");
      }
      handleCloseFormModal();
      fetchPromos();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save promo");
    }
  };

  const handleEditClick = (promo) => {
    setEditingPromoId(promo._id);
    setFormData({
      title: promo.title,
      promoType: promo.promoType || "bulk",
      prefix: promo.prefix || "",
      quantity: 0,
      generateMoreQuantity: 0,
      staticCode: promo.staticCode || "",
      maxUsageLimit: promo.maxUsageLimit || 100,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue || 0,
      buyX: promo.buyX || 0,
      getY: promo.getY || 0,
      minItemsRequired: promo.minItemsRequired || 1,
    });
    setShowFormModal(true);
  };

  const handleCloseFormModal = () => {
    setShowFormModal(false);
    setEditingPromoId(null);
    setFormData(defaultFormData);
  };

  const toggleStatus = async (id) => {
    try {
      await axiosInstance.put(`/api/promos/${id}/status`);
      fetchPromos();
    } catch (error) {
      console.error(error);
    }
  };

  const deletePromo = async (id) => {
    if (!window.confirm("Delete this entire campaign?")) return;
    try {
      await axiosInstance.delete(`/api/promos/${id}`);
      fetchPromos();
    } catch (error) {
      console.error(error);
    }
  };

  // --- VOUCHER PRINTING LOGIC --- //

  const generateVoucherHTML = (promo, codeStr) => {
    let bigValue = "";
    let subValue = "";

    if (promo.discountType === "percentage") {
      bigValue = `${promo.discountValue}<span>*</span>`;
      subValue = "% OFF";
    } else if (promo.discountType === "fixed") {
      bigValue = `${promo.discountValue / 1000}<span>K*</span>`;
      subValue = "IDR OFF";
    } else {
      bigValue = `BOGO`;
      subValue = `Buy ${promo.buyX} Get ${promo.getY}`;
    }

    return `
      <div class="voucher">
        <div class="ribbon">PROMO</div>
        <div class="left-section">
          <p class="desc-text"><strong>${promo.title}</strong><br/>${promo.description || "Enjoy this exclusive reward at our studio. Present this code at the receptionist or enter it during checkout."}</p>
          <div style="display: flex; align-items: baseline; gap: 10px;">
            <div class="big-discount">${bigValue}</div>
            <div style="font-size: 16px; font-weight: 800; color: #9ca3af; text-transform: uppercase;">${subValue}</div>
          </div>
          <p class="footer-text">*Valid for a limited time. T&C apply.</p>
        </div>
        
        <div class="right-section">
          <div class="badge">
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #059669;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
          <div style="margin-bottom: 25px;">
              <h4 class="about-title">HOW TO USE</h4>
              <p class="about-text">Bring this voucher to the studio or apply the unique code below in the app checkout page to redeem your reward.</p>
          </div>
          <div>
              <p class="code-label">USE CODE</p>
              <div class="code-box">${codeStr}</div>
          </div>
        </div>
      </div>
    `;
  };

  const openPrintWindow = (vouchersHTML) => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Print Vouchers</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            @page { size: A4; margin: 15mm; }
            
            body { 
                font-family: 'Inter', sans-serif; 
                background: #f4f4f4; 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
                margin: 0; 
                padding: 20px;
                display: flex; 
                justify-content: center;
            }
            
            .page-container {
                display: grid;
                grid-template-columns: 1fr;
                gap: 20mm;
                width: 100%;
                max-width: 170mm; /* A4 width minus margins */
            }

            .voucher { 
                display: flex; 
                background: #fff; 
                border-radius: 12px; 
                box-shadow: 0 4px 15px rgba(0,0,0,0.08); 
                width: 100%; 
                height: 85mm; 
                position: relative; 
                overflow: hidden; 
                page-break-inside: avoid; 
            }

            .ribbon { 
                position: absolute; 
                top: 20px; 
                left: -35px; 
                background: #ef4444; 
                color: white; 
                padding: 6px 40px; 
                font-size: 11px; 
                font-weight: 800; 
                text-transform: uppercase; 
                transform: rotate(-45deg); 
                letter-spacing: 1.5px; 
            }

            .left-section { 
                flex: 1; 
                padding: 30px 40px; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
            }

            .right-section { 
                width: 65mm; 
                border-left: 2px dashed #e5e7eb; 
                padding: 30px; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                position: relative; 
                background: #fafafa;
            }

            .right-section::before, .right-section::after { 
                content: ''; 
                position: absolute; 
                left: -11px; 
                width: 20px; 
                height: 20px; 
                background: #f4f4f4; 
                border-radius: 50%; 
            }
            .right-section::before { top: -10px; }
            .right-section::after { bottom: -10px; }

            .badge { 
                position: absolute; 
                left: -25px; 
                top: 50%; 
                transform: translateY(-50%); 
                width: 50px; 
                height: 50px; 
                background: white; 
                border-radius: 8px; 
                box-shadow: 0 4px 10px rgba(0,0,0,0.1); 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                border: 1px solid #f3f4f6; 
                z-index: 10;
            }

            .desc-text { font-size: 11px; color: #6b7280; line-height: 1.6; margin-bottom: 20px; max-width: 85%; }
            .big-discount { font-size: 80px; font-weight: 800; color: #4b5563; line-height: 1; letter-spacing: -2px; }
            .big-discount span { font-size: 30px; vertical-align: super; color: #9ca3af; }
            .footer-text { font-size: 9px; color: #9ca3af; margin-top: auto; }

            .about-title { font-size: 11px; font-weight: 800; color: #4b5563; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; margin-top:0;}
            .about-title::after { content: ''; display: block; width: 15px; height: 2.5px; background: #ef4444; margin-top: 6px; }
            .about-text { font-size: 10px; color: #6b7280; line-height: 1.6; margin-bottom: 0; }

            .code-label { font-size: 9px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
            .code-box { border: 1.5px solid #ef4444; color: #ef4444; font-size: 16px; font-weight: 800; padding: 10px; text-align: center; border-radius: 6px; letter-spacing: 2px; background: #fff;}
          </style>
        </head>
        <body>
          <div class="page-container">
            ${vouchersHTML}
          </div>
          <script>
            window.onload = () => { 
                setTimeout(() => {
                    window.print(); 
                    window.close(); 
                }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintSingleVoucher = (promo, codeStr) => {
    const html = generateVoucherHTML(promo, codeStr);
    openPrintWindow(html);
  };

  const handlePrintAllAvailableVouchers = (promo) => {
    const availableCodes = (promo.codes || []).filter((c) => !c.isUsed);
    if (availableCodes.length === 0)
      return alert("No unused codes available to print.");

    const html = availableCodes
      .map((c) => generateVoucherHTML(promo, c.code))
      .join("");
    openPrintWindow(html);
  };

  const shareWhatsApp = (promo, codeStr) => {
    const msg = `Here is your promo for ${getPromoValueString(promo)}!\n\nPromo: *${promo.title}*\nCode: *${codeStr}*\n\nApply this at checkout.`;
    window.open(
      `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`,
      "_blank",
    );
  };

  const shareEmail = (promo, codeStr) => {
    const subject = `Your Promo Code: ${promo.title}`;
    const body = `Here is your promo for ${getPromoValueString(promo)}!\n\nCode: ${codeStr}\n\nApply this at checkout.`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const filteredPromos = promos.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()),
  );

  const getPromoValueString = (promo) => {
    switch (promo.discountType) {
      case "percentage":
        return `${promo.discountValue}% Off Total`;
      case "fixed":
        return `Rp ${promo.discountValue.toLocaleString()} Off Total`;
      case "buy_x_get_y":
        return `Buy ${promo.buyX} Get ${promo.getY} Free`;
      default:
        return "";
    }
  };

  return (
    <div className='p-6 h-full flex flex-col bg-white rounded-lg shadow-subtle border border-slate-100 m-4'>
      <div className='flex flex-col md:flex-row justify-end items-start md:items-center gap-4 mb-8 shrink-0'>
        <div className='flex gap-3 w-full md:w-auto'>
          <div className='relative flex-1 md:w-72'>
            <Search className='w-4 h-4 absolute left-3.5 top-3 text-slate-400' />
            <input
              type='text'
              placeholder='Search campaigns...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-500 font-medium'
            />
          </div>
          <button
            onClick={() => setShowFormModal(true)}
            className='flex items-center gap-2 bg-[#1a4d3e] hover:bg-[#133d31] text-white px-5 py-2.5 rounded-md text-sm font-bold shadow-md transition-colors shrink-0'>
            <Plus className='w-4 h-4' /> New Campaign
          </button>
        </div>
      </div>

      <div className='flex-1 overflow-auto border border-slate-200 rounded-md shadow-inner bg-slate-50/20'>
        <table className='w-full text-left border-collapse table-auto'>
          <thead className='bg-white sticky top-0 z-10 border-b border-slate-200'>
            <tr>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Campaign & Type
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Discount
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Usage / Availability
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Status
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-100 bg-white'>
            {isLoading ? (
              <tr>
                <td
                  colSpan='5'
                  className='p-10 text-center text-slate-400 font-medium'>
                  Loading campaigns...
                </td>
              </tr>
            ) : filteredPromos.length === 0 ? (
              <tr>
                <td
                  colSpan='5'
                  className='p-10 text-center text-slate-400 font-medium'>
                  No campaigns found.
                </td>
              </tr>
            ) : (
              filteredPromos.map((promo) => {
                const isStatic = promo.promoType === "static";
                const isAdmin = promo.promoType === "admin";

                const promoCodes = promo.codes || [];
                const totalBulk = promoCodes.length;
                const availableBulk = promoCodes.filter(
                  (c) => !c.isUsed,
                ).length;

                const limitReached =
                  isStatic && promo.currentUsageCount >= promo.maxUsageLimit;

                return (
                  <tr
                    key={promo._id}
                    className='hover:bg-slate-50/50 transition-colors'>
                    <td className='p-4'>
                      <p className='font-bold text-slate-800 tracking-tight flex items-center gap-2'>
                        {promo.title}
                      </p>
                      <div className='flex items-center gap-1.5 mt-1'>
                        {isAdmin ? (
                          <span className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded'>
                            <ShieldCheck className='w-3 h-3' /> Cashier Code
                          </span>
                        ) : isStatic ? (
                          <span className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 px-2 py-0.5 rounded'>
                            <Users className='w-3 h-3' /> Static Client Code
                          </span>
                        ) : (
                          <span className='flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded'>
                            <KeyRound className='w-3 h-3' /> Bulk Vouchers
                          </span>
                        )}
                      </div>
                    </td>
                    <td className='p-4 text-sm font-bold text-slate-700'>
                      {getPromoValueString(promo)}
                    </td>
                    <td className='p-4'>
                      {isAdmin ? (
                        <div className='flex flex-col'>
                          <span className='px-2 py-1 rounded w-fit text-xs font-bold bg-amber-50 text-amber-700'>
                            Unlimited Usage
                          </span>
                          <span className='text-[10px] font-medium text-slate-400 mt-1'>
                            {promo.currentUsageCount} used so far
                          </span>
                        </div>
                      ) : isStatic ? (
                        <div className='flex flex-col'>
                          <span
                            className={`px-2 py-1 rounded w-fit text-xs font-bold ${limitReached ? "bg-rose-50 text-rose-700" : "bg-sky-50 text-sky-700"}`}>
                            {promo.currentUsageCount} / {promo.maxUsageLimit}{" "}
                            Used
                          </span>
                          <span className='text-[10px] font-medium text-slate-400 mt-1'>
                            1 per user
                          </span>
                        </div>
                      ) : (
                        <span
                          className={`px-2 py-1 rounded w-fit text-xs font-bold ${availableBulk > 0 ? "bg-purple-50 text-purple-700" : "bg-rose-50 text-rose-700"}`}>
                          {availableBulk} / {totalBulk} Left
                        </span>
                      )}
                    </td>
                    <td className='p-4'>
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold tracking-tight ${promo.isActive && !limitReached ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                        {promo.isActive && !limitReached ? (
                          <Check className='w-3.5 h-3.5' />
                        ) : (
                          <X className='w-3.5 h-3.5' />
                        )}
                        {promo.isActive && !limitReached
                          ? "ACTIVE"
                          : limitReached
                            ? "LIMIT REACHED"
                            : "INACTIVE"}
                      </span>
                    </td>
                    <td className='p-4 flex items-center justify-end gap-2 text-right'>
                      <button
                        onClick={() => {
                          setSelectedPromoForCodes(promo);
                          setShowCodesModal(true);
                        }}
                        className='p-2.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors bg-white border border-slate-200'
                        title='View & Share'>
                        <List className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => handleEditClick(promo)}
                        className='p-2.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors bg-white'
                        title='Edit Campaign Rules'>
                        <Edit2 className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => toggleStatus(promo._id)}
                        className='p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors bg-white'
                        title='Toggle Status'>
                        <Power className='w-4 h-4' />
                      </button>
                      <button
                        onClick={() => deletePromo(promo._id)}
                        className='p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors bg-white'
                        title='Delete Campaign'>
                        <Trash2 className='w-4 h-4' />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showFormModal && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className='bg-white w-full max-w-3xl rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 max-h-[90vh]'>
              <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-slate-50'>
                <h3 className='text-lg font-extrabold text-slate-950 tracking-tight'>
                  {editingPromoId
                    ? "Edit Campaign Rules"
                    : "Create Promo Campaign"}
                </h3>
                <button
                  onClick={handleCloseFormModal}
                  className='p-2 rounded-md hover:bg-slate-200 text-slate-400'>
                  <X className='w-5 h-5' />
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className='p-6 overflow-y-auto custom-scrollbar space-y-6'>
                <div className='col-span-2'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                    Campaign Title
                  </label>
                  <input
                    required
                    type='text'
                    placeholder='e.g., Summer Sale 2026'
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none'
                  />
                </div>

                <div className='border-t border-slate-100 pt-6'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase mb-3'>
                    Promo Strategy
                  </label>
                  <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-5'>
                    <button
                      type='button'
                      disabled={!!editingPromoId}
                      onClick={() =>
                        setFormData({ ...formData, promoType: "bulk" })
                      }
                      className={`p-4 rounded-lg border text-left transition-all ${formData.promoType === "bulk" ? "border-purple-500 bg-purple-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <KeyRound
                        className={`w-5 h-5 mb-2 ${formData.promoType === "bulk" ? "text-purple-600" : "text-slate-400"}`}
                      />
                      <p
                        className={`text-sm font-bold ${formData.promoType === "bulk" ? "text-purple-900" : "text-slate-700"}`}>
                        Bulk Vouchers
                      </p>
                      <p className='text-xs text-slate-500 mt-1 font-medium'>
                        Unique 1-time codes for distribution.
                      </p>
                    </button>
                    <button
                      type='button'
                      disabled={!!editingPromoId}
                      onClick={() =>
                        setFormData({ ...formData, promoType: "static" })
                      }
                      className={`p-4 rounded-lg border text-left transition-all ${formData.promoType === "static" ? "border-sky-500 bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <Users
                        className={`w-5 h-5 mb-2 ${formData.promoType === "static" ? "text-sky-600" : "text-slate-400"}`}
                      />
                      <p
                        className={`text-sm font-bold ${formData.promoType === "static" ? "text-sky-900" : "text-slate-700"}`}>
                        Client Code
                      </p>
                      <p className='text-xs text-slate-500 mt-1 font-medium'>
                        Public code. Limited usage. 1 per user.
                      </p>
                    </button>
                    <button
                      type='button'
                      disabled={!!editingPromoId}
                      onClick={() =>
                        setFormData({ ...formData, promoType: "admin" })
                      }
                      className={`p-4 rounded-lg border text-left transition-all ${formData.promoType === "admin" ? "border-amber-500 bg-amber-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                      <ShieldCheck
                        className={`w-5 h-5 mb-2 ${formData.promoType === "admin" ? "text-amber-600" : "text-slate-400"}`}
                      />
                      <p
                        className={`text-sm font-bold ${formData.promoType === "admin" ? "text-amber-900" : "text-slate-700"}`}>
                        Cashier Code
                      </p>
                      <p className='text-xs text-slate-500 mt-1 font-medium'>
                        Hidden from clients. Unlimited POS usage.
                      </p>
                    </button>
                  </div>

                  <div className='grid grid-cols-2 gap-5 p-5 bg-slate-50 rounded-lg border border-slate-200'>
                    {formData.promoType === "bulk" ? (
                      <>
                        <div>
                          <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                            Code Prefix (Optional)
                          </label>
                          <input
                            type='text'
                            placeholder='e.g., SUM'
                            value={formData.prefix}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                prefix: e.target.value.toUpperCase(),
                              })
                            }
                            className='w-full p-3.5 bg-white border border-slate-200 rounded-md text-sm font-bold uppercase focus:border-purple-500 outline-none'
                            disabled={!!editingPromoId}
                          />
                        </div>
                        <div>
                          <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                            {editingPromoId
                              ? "Generate More Codes"
                              : "Quantity"}
                          </label>
                          <input
                            type='number'
                            min={editingPromoId ? "0" : "1"}
                            value={
                              editingPromoId
                                ? formData.generateMoreQuantity
                                : formData.quantity
                            }
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              editingPromoId
                                ? setFormData({
                                    ...formData,
                                    generateMoreQuantity: val,
                                  })
                                : setFormData({ ...formData, quantity: val });
                            }}
                            className='w-full p-3.5 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-purple-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                            Static Code String
                          </label>
                          <input
                            required
                            type='text'
                            placeholder='e.g., SUMMER2026'
                            value={formData.staticCode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                staticCode: e.target.value.toUpperCase(),
                              })
                            }
                            className='w-full p-3.5 bg-white border border-slate-200 rounded-md text-sm font-bold uppercase focus:border-emerald-500 outline-none'
                            disabled={!!editingPromoId}
                          />
                        </div>

                        {formData.promoType === "static" && (
                          <div>
                            <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                              Total Global Uses
                            </label>
                            <input
                              required
                              type='number'
                              min='1'
                              value={formData.maxUsageLimit}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  maxUsageLimit: parseInt(e.target.value) || 1,
                                })
                              }
                              className='w-full p-3.5 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-sky-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                            />
                            <p className='text-[10px] text-slate-500 mt-1'>
                              Total times this code can be claimed across ALL
                              users.
                            </p>
                          </div>
                        )}

                        {formData.promoType === "admin" && (
                          <div className='flex flex-col justify-center px-4 bg-amber-100/50 border border-amber-200 rounded-md'>
                            <p className='text-sm font-bold text-amber-800'>
                              Unlimited Uses
                            </p>
                            <p className='text-[10px] font-medium text-amber-700 mt-0.5'>
                              This code has no cap and will stay active until
                              toggled off.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className='border-t border-slate-100 pt-6 pb-3'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase mb-2.5'>
                    Discount Setup
                  </label>
                  <div className='relative mb-4'>
                    <select
                      value={formData.discountType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountType: e.target.value,
                        })
                      }
                      className='w-full h-[50px] pl-4 pr-11 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none appearance-none cursor-pointer'>
                      <option value='percentage'>Percentage (%)</option>
                      <option value='fixed'>Fixed Amount (IDR)</option>
                      <option value='buy_x_get_y'>Buy X Get Y Free</option>
                    </select>
                    <ChevronsUpDown className='w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none' />
                  </div>

                  {formData.discountType === "percentage" && (
                    <input
                      type='number'
                      placeholder='Percentage (e.g., 10)'
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountValue: e.target.value,
                        })
                      }
                      className='w-full h-[50px] px-4 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                    />
                  )}
                  {formData.discountType === "fixed" && (
                    <input
                      type='number'
                      placeholder='IDR Amount (e.g., 50000)'
                      value={formData.discountValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          discountValue: e.target.value,
                        })
                      }
                      className='w-full h-[50px] px-4 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                    />
                  )}
                  {formData.discountType === "buy_x_get_y" && (
                    <div className='grid grid-cols-2 gap-4'>
                      <input
                        type='number'
                        placeholder='Buy (X)'
                        value={formData.buyX}
                        onChange={(e) =>
                          setFormData({ ...formData, buyX: e.target.value })
                        }
                        className='w-full h-[50px] px-4 border border-slate-200 rounded-md text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                      />
                      <input
                        type='number'
                        placeholder='Get (Y)'
                        value={formData.getY}
                        onChange={(e) =>
                          setFormData({ ...formData, getY: e.target.value })
                        }
                        className='w-full h-[50px] px-4 border border-slate-200 rounded-md text-sm font-bold outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                      />
                    </div>
                  )}
                </div>

                <div className='pt-5 border-t border-slate-100 bg-white sticky bottom-0 -mx-6 -mb-6 p-6'>
                  <button
                    type='submit'
                    className='w-full bg-[#1a4d3e] hover:bg-[#133d31] text-white font-extrabold py-4 rounded-md shadow-md transition-all tracking-tight'>
                    {editingPromoId ? "Save Changes" : "Create Campaign"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCodesModal && selectedPromoForCodes && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className='bg-white w-full max-w-4xl rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200 max-h-[85vh]'>
              <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-slate-50'>
                <div>
                  <h3 className='text-lg font-extrabold text-slate-950 tracking-tight'>
                    Campaign: {selectedPromoForCodes.title}
                  </h3>
                  {selectedPromoForCodes.promoType === "admin" ? (
                    <p className='text-xs text-amber-600 mt-1 font-bold'>
                      Unlimited Cashier Promo
                    </p>
                  ) : selectedPromoForCodes.promoType === "static" ? (
                    <p className='text-xs text-slate-500 mt-1'>
                      {selectedPromoForCodes.currentUsageCount} out of{" "}
                      {selectedPromoForCodes.maxUsageLimit} global uses claimed.
                    </p>
                  ) : (
                    <p className='text-xs text-slate-500 mt-1'>
                      {
                        (selectedPromoForCodes.codes || []).filter(
                          (c) => !c.isUsed,
                        ).length
                      }{" "}
                      available unique codes.
                    </p>
                  )}
                </div>

                {/* Print All Button injected here for Bulk promos */}
                <div className='flex items-center gap-3'>
                  {selectedPromoForCodes.promoType === "bulk" && (
                    <button
                      onClick={() =>
                        handlePrintAllAvailableVouchers(selectedPromoForCodes)
                      }
                      className='flex items-center gap-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-4 py-2 rounded-md text-xs font-bold transition-colors'>
                      <Printer className='w-3.5 h-3.5' /> Print All Available
                    </button>
                  )}
                  <button
                    onClick={() => setShowCodesModal(false)}
                    className='p-2 rounded-md hover:bg-slate-200 text-slate-400'>
                    <X className='w-5 h-5' />
                  </button>
                </div>
              </div>

              <div className='p-6 overflow-y-auto custom-scrollbar flex-1'>
                {selectedPromoForCodes.promoType === "admin" ? (
                  <div className='flex flex-col items-center justify-center p-10 bg-amber-50/50 rounded-lg border border-amber-200 border-dashed text-center'>
                    <ShieldCheck className='w-12 h-12 text-amber-300 mb-4' />
                    <h4 className='text-sm font-bold text-amber-700 uppercase tracking-widest mb-2'>
                      Cashier Checkout Code
                    </h4>
                    <div className='bg-white px-8 py-4 border border-amber-200 rounded-lg shadow-sm mb-6'>
                      <span className='font-mono text-3xl font-extrabold text-amber-900 tracking-widest'>
                        {selectedPromoForCodes.staticCode}
                      </span>
                    </div>
                    <p className='text-sm text-slate-600 max-w-md font-medium'>
                      This code is intended for admin and cashier use only. It
                      can be applied an unlimited number of times at checkout.
                    </p>
                  </div>
                ) : selectedPromoForCodes.promoType === "static" ? (
                  <div className='flex flex-col items-center justify-center p-10 bg-slate-50 rounded-lg border border-slate-200 border-dashed text-center'>
                    <Users className='w-12 h-12 text-sky-300 mb-4' />
                    <h4 className='text-sm font-bold text-slate-500 uppercase tracking-widest mb-2'>
                      Master Code
                    </h4>
                    <div className='bg-white px-8 py-4 border border-slate-200 rounded-lg shadow-sm mb-6'>
                      <span className='font-mono text-3xl font-extrabold text-slate-800 tracking-widest'>
                        {selectedPromoForCodes.staticCode}
                      </span>
                    </div>
                    <p className='text-sm text-slate-600 max-w-md font-medium mb-6'>
                      Share this code with your clients. Each user can only
                      claim it once during checkout until the global limit of{" "}
                      {selectedPromoForCodes.maxUsageLimit} is reached.
                    </p>

                    <div className='flex gap-2'>
                      <button
                        onClick={() =>
                          handlePrintSingleVoucher(
                            selectedPromoForCodes,
                            selectedPromoForCodes.staticCode,
                          )
                        }
                        className='flex items-center gap-2 px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-sm font-bold transition-colors'>
                        <Printer className='w-4 h-4' /> Print Design
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                    {(selectedPromoForCodes.codes || []).map((item) => (
                      <div
                        key={item._id}
                        className={`border rounded-lg p-4 flex flex-col justify-between ${item.isUsed ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-emerald-200 shadow-sm"}`}>
                        <div className='flex justify-between items-start mb-4'>
                          <div>
                            <p className='font-mono text-lg font-bold text-slate-900'>
                              {item.code}
                            </p>
                            <p className='text-xs font-medium text-slate-500 mt-1'>
                              {item.isUsed
                                ? `Used on: ${new Date(item.usedAt).toLocaleDateString()}`
                                : "Available"}
                            </p>
                          </div>
                          {item.isUsed ? (
                            <span className='bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider'>
                              Claimed
                            </span>
                          ) : (
                            <span className='bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider'>
                              Valid
                            </span>
                          )}
                        </div>

                        {!item.isUsed && (
                          <div className='flex gap-2 border-t border-slate-100 pt-3'>
                            <button
                              onClick={() =>
                                shareWhatsApp(selectedPromoForCodes, item.code)
                              }
                              className='flex-1 flex justify-center items-center gap-1.5 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 rounded text-xs font-bold transition-colors'>
                              <MessageCircle className='w-3.5 h-3.5' /> WA
                            </button>
                            <button
                              onClick={() =>
                                shareEmail(selectedPromoForCodes, item.code)
                              }
                              className='flex-1 flex justify-center items-center gap-1.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 rounded text-xs font-bold transition-colors'>
                              <Mail className='w-3.5 h-3.5' /> Email
                            </button>
                            <button
                              onClick={() =>
                                handlePrintSingleVoucher(
                                  selectedPromoForCodes,
                                  item.code,
                                )
                              }
                              className='flex-1 flex justify-center items-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors'>
                              <Printer className='w-3.5 h-3.5' /> Print
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagePromos;
