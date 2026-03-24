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
} from "lucide-react";
import axiosInstance from "../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../context/AuthContext";
import { AnimatePresence, motion } from "framer-motion";

const ManagePromos = () => {
  const { user } = useAuth();
  const [promos, setPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  // New state to track which promo is being edited. If null, we are creating a new one.
  const [editingPromoId, setEditingPromoId] = useState(null);

  const defaultFormData = {
    code: "",
    title: "",
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

  // Combined function to handle both Create and Update
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingPromoId) {
        // UPDATE Existing Promo
        await axiosInstance.put(`/api/promos/${editingPromoId}`, formData);
        alert("Promo Updated Successfully!");
      } else {
        // CREATE New Promo
        await axiosInstance.post("/api/promos", formData);
        alert("Promo Created Successfully!");
      }
      handleCloseModal();
      fetchPromos();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to save promo");
    }
  };

  // Pre-fills the form with data for editing
  const handleEditClick = (promo) => {
    setEditingPromoId(promo._id);
    setFormData({
      code: promo.code,
      title: promo.title,
      description: promo.description,
      discountType: promo.discountType,
      discountValue: promo.discountValue || 0,
      buyX: promo.buyX || 0,
      getY: promo.getY || 0,
      minItemsRequired: promo.minItemsRequired || 1,
    });
    setShowModal(true);
  };

  // New function to handle modal closing and state reset
  const handleCloseModal = () => {
    setShowModal(false);
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
    if (
      !window.confirm(
        "Are you sure you want to delete this promo? This cannot be undone.",
      )
    )
      return;
    try {
      await axiosInstance.delete(`/api/promos/${id}`);
      fetchPromos();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredPromos = promos.filter(
    (p) =>
      p.code.toLowerCase().includes(search.toLowerCase()) ||
      p.title.toLowerCase().includes(search.toLowerCase()),
  );

  // UI Helper to describe a promo compactly
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
    // Elevated UI with subtle shadow and sharper corners
    <div className='p-6 h-full flex flex-col bg-white rounded-lg shadow-subtle border border-slate-100 m-4'>
      {/* Header Section */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 shrink-0'>
        <div>
          <h2 className='text-xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2'>
            <TicketPercent className='w-6 h-6 text-emerald-600' />
            Promo Management
          </h2>
          <p className='text-sm text-slate-500 font-medium mt-1'>
            Create, edit, and deactivate discount codes for the studio's POS
            system.
          </p>
        </div>
        <div className='flex gap-3 w-full md:w-auto'>
          <div className='relative flex-1 md:w-72'>
            <Search className='w-4 h-4 absolute left-3.5 top-3 text-slate-400' />
            <input
              type='text'
              placeholder='Search by promo code or title...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none focus:border-emerald-500 transition-colors shadow-inner font-medium'
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className='flex items-center gap-2 bg-[#1a4d3e] hover:bg-[#133d31] text-white px-5 py-2.5 rounded-md text-sm font-bold shadow-md transition-colors shrink-0'>
            <Plus className='w-4 h-4' /> New Promo
          </button>
        </div>
      </div>

      {/* Promos Table */}
      <div className='flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-md shadow-inner bg-slate-50/20'>
        <table className='w-full text-left border-collapse table-auto'>
          <thead className='bg-white sticky top-0 z-10 border-b border-slate-200'>
            <tr>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Promo Code
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Discount Rule
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Cart Condition
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
                  className='p-10 text-center text-slate-400 font-medium text-sm'>
                  Loading studio promos...
                </td>
              </tr>
            ) : filteredPromos.length === 0 ? (
              <tr>
                <td
                  colSpan='5'
                  className='p-10 text-center text-slate-400 font-medium text-sm'>
                  No promo codes found for this studio.
                </td>
              </tr>
            ) : (
              filteredPromos.map((promo) => (
                <tr
                  key={promo._id}
                  className='hover:bg-slate-50/50 transition-colors'>
                  <td className='p-4'>
                    <p className='font-extrabold text-emerald-800 bg-emerald-100/60 w-fit px-2.5 py-1 rounded-md text-sm tracking-tight'>
                      {promo.code}
                    </p>
                    <p className='text-xs text-slate-500 font-semibold mt-1.5'>
                      {promo.title}
                    </p>
                  </td>
                  <td className='p-4'>
                    <span className='text-sm font-bold text-slate-800 tracking-tight'>
                      {getPromoValueString(promo)}
                    </span>
                  </td>
                  <td className='p-4 text-sm text-slate-700 font-medium'>
                    Min. {promo.minItemsRequired} items in cart
                  </td>
                  <td className='p-4'>
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold tracking-tight shadow-inner ${promo.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                      {promo.isActive ? (
                        <Check className='w-3.5 h-3.5' />
                      ) : (
                        <X className='w-3.5 h-3.5' />
                      )}
                      {promo.isActive ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </td>
                  <td className='p-4 flex items-center justify-end gap-2 text-right'>
                    {/* EDIT BUTTON */}
                    <button
                      onClick={() => handleEditClick(promo)}
                      className='p-2.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-md transition-colors shadow-sm bg-white'
                      title='Edit Promo'>
                      <Edit2 className='w-4 h-4' />
                    </button>
                    {/* STATUS BUTTON */}
                    <button
                      onClick={() => toggleStatus(promo._id)}
                      className='p-2.5 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors shadow-sm bg-white'
                      title={promo.isActive ? "Deactivate" : "Activate"}>
                      <Power className='w-4 h-4' />
                    </button>
                    {/* DELETE BUTTON */}
                    <button
                      onClick={() => deletePromo(promo._id)}
                      className='p-2.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors shadow-sm bg-white'
                      title='Delete Promo'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE / EDIT MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className='bg-white w-full max-w-lg rounded-lg shadow-2xl flex flex-col overflow-hidden border border-slate-200'>
              {/* Modal Header */}
              <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-slate-50'>
                <h3 className='text-lg font-extrabold text-slate-950 tracking-tight'>
                  {editingPromoId
                    ? `Edit Promo: ${formData.code}`
                    : "Create New Studio Promo"}
                </h3>
                <button
                  onClick={handleCloseModal}
                  className='p-2 rounded-md hover:bg-slate-200 text-slate-400 transition-colors'>
                  <X className='w-5 h-5' />
                </button>
              </div>

              {/* Modal Form with clearer instructions */}
              <form
                onSubmit={handleSubmit}
                className='p-6 overflow-y-auto max-h-[75vh] custom-scrollbar space-y-6'>
                <div className='grid grid-cols-2 gap-5'>
                  <div>
                    <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-2.5'>
                      Promo Code
                    </label>
                    <input
                      required
                      type='text'
                      placeholder='e.g., WINTERSALE50'
                      value={formData.code}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          code: e.target.value.toUpperCase(),
                        })
                      }
                      className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold uppercase focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none shadow-inner'
                    />
                    <p className='text-[11px] text-slate-400 mt-1.5 font-medium'>
                      This is the code the admin will type at the POS (e.g.,
                      BLACKFRIDAY).
                    </p>
                  </div>
                  <div>
                    <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-2.5'>
                      Promo Title
                    </label>
                    <input
                      required
                      type='text'
                      placeholder='e.g., Black Friday 10% Off'
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none shadow-inner'
                    />
                    <p className='text-[11px] text-slate-400 mt-1.5 font-medium'>
                      A clear name for reports (e.g., Black Friday Studio Launch
                      Offer).
                    </p>
                  </div>
                </div>

                <div>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-2.5'>
                    Internal Description
                  </label>
                  <textarea
                    rows='2'
                    placeholder='Describe the terms, conditions, or reason for this promo code...'
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none resize-none shadow-inner'></textarea>
                </div>

                <div className='border-t border-slate-100 pt-6'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-2.5'>
                    Step 1: Select Discount Type
                  </label>
                  <select
                    value={formData.discountType}
                    onChange={(e) =>
                      setFormData({ ...formData, discountType: e.target.value })
                    }
                    className='w-full p-4 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200 outline-none shadow-inner cursor-pointer'>
                    <option value='percentage'>
                      Percentage (%) - Takes a percentage off the cart total
                    </option>
                    <option value='fixed'>
                      Fixed Amount (IDR) - Takes a static IDR amount off the
                      cart total
                    </option>
                    <option value='buy_x_get_y'>
                      Buy X Get Y Free - Automatic 'grouping' logic (e.g., BOGO)
                    </option>
                  </select>
                </div>

                <div className='bg-slate-50 border border-slate-200 rounded-lg p-5'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-3'>
                    Step 2: Set the Discount Value
                  </label>

                  {formData.discountType === "percentage" && (
                    <div>
                      <p className='text-xs text-slate-500 font-medium mb-2.5'>
                        Enter the percentage (%) to deduct from the Total
                        Payable.
                      </p>
                      <div className='relative'>
                        <input
                          type='number'
                          min='1'
                          max='100'
                          value={formData.discountValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              discountValue: e.target.value,
                            })
                          }
                          className='w-full p-3.5 pl-4 pr-10 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none shadow-md'
                        />
                        <span className='absolute right-4 top-4 font-bold text-slate-500'>
                          %
                        </span>
                      </div>
                    </div>
                  )}

                  {formData.discountType === "fixed" && (
                    <div>
                      <p className='text-xs text-slate-500 font-medium mb-2.5'>
                        Enter the static IDR amount to deduct from the Total
                        Payable.
                      </p>
                      <div className='relative'>
                        <span className='absolute left-4 top-4 font-bold text-slate-500'>
                          Rp
                        </span>
                        <input
                          type='number'
                          min='0'
                          value={formData.discountValue}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              discountValue: e.target.value,
                            })
                          }
                          className='w-full p-3.5 pl-12 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none shadow-md'
                        />
                      </div>
                    </div>
                  )}

                  {formData.discountType === "buy_x_get_y" && (
                    <div>
                      <p className='text-xs text-slate-500 font-medium mb-3'>
                        Example for BOGO (Buy 1 Get 1): Set 'Buy (X)' to 1 and
                        'Get (Y)' to 1. The POS will automatically make the
                        cheapest group free.
                      </p>
                      <div className='grid grid-cols-2 gap-4'>
                        <div>
                          <label className='block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2'>
                            Buy (X) Items
                          </label>
                          <input
                            type='number'
                            min='1'
                            value={formData.buyX}
                            onChange={(e) =>
                              setFormData({ ...formData, buyX: e.target.value })
                            }
                            className='w-full p-3 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none shadow-md'
                          />
                        </div>
                        <div>
                          <label className='block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2'>
                            Get (Y) Items Free
                          </label>
                          <input
                            type='number'
                            min='1'
                            value={formData.getY}
                            onChange={(e) =>
                              setFormData({ ...formData, getY: e.target.value })
                            }
                            className='w-full p-3 bg-white border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none shadow-md'
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className='pt-2'>
                  <label className='block text-xs font-extrabold text-slate-600 uppercase tracking-widest mb-2.5'>
                    Step 3: Cart Condition
                  </label>
                  <input
                    type='number'
                    min='1'
                    value={formData.minItemsRequired}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        minItemsRequired: e.target.value,
                      })
                    }
                    className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-md text-sm font-bold focus:border-emerald-500 outline-none shadow-inner'
                  />
                  <p className='text-[11px] text-slate-400 mt-1.5 font-medium'>
                    The total quantity of all packages in the cart required to
                    activate this promo (e.g., for BOGO, set this to 2).
                  </p>
                </div>

                {/* Submit button dynamically changes based on Create vs Update */}
                <div className='pt-5 border-t border-slate-100 bg-white sticky bottom-0 -mx-6 -mb-6 p-6'>
                  <button
                    type='submit'
                    className='w-full bg-[#1a4d3e] hover:bg-[#133d31] text-white font-extrabold py-4 rounded-md shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] transition-all tracking-tight'>
                    {editingPromoId
                      ? "Update Promo Details"
                      : "Create Studio Promo"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ManagePromos;
