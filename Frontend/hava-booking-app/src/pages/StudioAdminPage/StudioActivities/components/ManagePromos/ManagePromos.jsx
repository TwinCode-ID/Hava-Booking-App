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

const ManagePromos = () => {
  const { user } = useAuth();
  const [promos, setPromos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    code: "",
    title: "",
    description: "",
    discountType: "percentage",
    discountValue: 0,
    buyX: 0,
    getY: 0,
    minItemsRequired: 1,
  });

  const fetchPromos = async () => {
    try {
      const studioId = user?.adminStudioLocation;
      if (!studioId) return;
      // Note: Make sure to add this path to your API_PATHS config file
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
      await axiosInstance.post("/api/promos", formData);
      alert("Promo Created!");
      setShowModal(false);
      fetchPromos();
      // Reset Form
      setFormData({
        code: "",
        title: "",
        description: "",
        discountType: "percentage",
        discountValue: 0,
        buyX: 0,
        getY: 0,
        minItemsRequired: 1,
      });
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create promo");
    }
  };

  const toggleStatus = async (id) => {
    try {
      await axiosInstance.patch(`/api/promos/${id}/status`);
      fetchPromos();
    } catch (error) {
      console.error(error);
    }
  };

  const deletePromo = async (id) => {
    if (!window.confirm("Are you sure you want to delete this promo?")) return;
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

  return (
    <div className='p-6 h-full flex flex-col bg-white rounded-2xl shadow-sm border border-slate-100 m-4'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 shrink-0'>
        <div>
          <h2 className='text-xl font-extrabold text-slate-900 flex items-center gap-2'>
            <TicketPercent className='w-6 h-6 text-emerald-600' />
            Promo Management
          </h2>
          <p className='text-sm text-slate-500 font-medium mt-1'>
            Create and manage discount codes for the POS.
          </p>
        </div>
        <div className='flex gap-3 w-full md:w-auto'>
          <div className='relative flex-1 md:w-64'>
            <Search className='w-4 h-4 absolute left-3 top-2.5 text-slate-400' />
            <input
              type='text'
              placeholder='Search codes...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className='w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-500 transition-colors'
            />
          </div>
          <button
            onClick={() => setShowModal(true)}
            className='flex items-center gap-2 bg-[#1a4d3e] hover:bg-[#133d31] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-colors shrink-0'>
            <Plus className='w-4 h-4' /> New Promo
          </button>
        </div>
      </div>

      {/* Table */}
      <div className='flex-1 overflow-auto custom-scrollbar border border-slate-200 rounded-xl'>
        <table className='w-full text-left border-collapse'>
          <thead className='bg-slate-50 sticky top-0 z-10 border-b border-slate-200'>
            <tr>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Promo Code
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Type & Value
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Requirements
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider'>
                Status
              </th>
              <th className='p-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right'>
                Actions
              </th>
            </tr>
          </thead>
          <tbody className='divide-y divide-slate-100'>
            {isLoading ? (
              <tr>
                <td
                  colSpan='5'
                  className='p-8 text-center text-slate-400 font-medium'>
                  Loading promos...
                </td>
              </tr>
            ) : filteredPromos.length === 0 ? (
              <tr>
                <td
                  colSpan='5'
                  className='p-8 text-center text-slate-400 font-medium'>
                  No promos found.
                </td>
              </tr>
            ) : (
              filteredPromos.map((promo) => (
                <tr
                  key={promo._id}
                  className='hover:bg-slate-50 transition-colors'>
                  <td className='p-4'>
                    <p className='font-extrabold text-emerald-700 bg-emerald-50 w-fit px-2 py-1 rounded-md text-sm'>
                      {promo.code}
                    </p>
                    <p className='text-xs text-slate-500 font-medium mt-1'>
                      {promo.title}
                    </p>
                  </td>
                  <td className='p-4'>
                    {promo.discountType === "percentage" && (
                      <span className='text-sm font-bold text-slate-700'>
                        {promo.discountValue}% Off
                      </span>
                    )}
                    {promo.discountType === "fixed" && (
                      <span className='text-sm font-bold text-slate-700'>
                        Rp {promo.discountValue.toLocaleString()} Off
                      </span>
                    )}
                    {promo.discountType === "buy_x_get_y" && (
                      <span className='text-sm font-bold text-slate-700'>
                        Buy {promo.buyX} Get {promo.getY} Free
                      </span>
                    )}
                  </td>
                  <td className='p-4 text-sm text-slate-600 font-medium'>
                    Min. {promo.minItemsRequired} items
                  </td>
                  <td className='p-4'>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${promo.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {promo.isActive ? (
                        <Check className='w-3 h-3' />
                      ) : (
                        <X className='w-3 h-3' />
                      )}
                      {promo.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className='p-4 flex items-center justify-end gap-2'>
                    <button
                      onClick={() => toggleStatus(promo._id)}
                      className='p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors'
                      title='Toggle Status'>
                      <Power className='w-4 h-4' />
                    </button>
                    <button
                      onClick={() => deletePromo(promo._id)}
                      className='p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors'
                      title='Delete'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE MODAL */}
      {showModal && (
        <div className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm'>
          <div className='bg-white w-full max-w-lg rounded-[24px] shadow-2xl flex flex-col overflow-hidden'>
            <div className='px-6 py-5 border-b border-gray-100 flex justify-between items-center'>
              <h3 className='text-lg font-extrabold text-slate-900'>
                Create New Promo
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className='p-2 rounded-full hover:bg-slate-100'>
                <X className='w-5 h-5 text-slate-400' />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className='p-6 overflow-y-auto max-h-[70vh] custom-scrollbar space-y-4'>
              <div className='grid grid-cols-2 gap-4'>
                <div>
                  <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                    Code
                  </label>
                  <input
                    required
                    type='text'
                    placeholder='e.g. SUMMER10'
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold uppercase focus:border-emerald-500 outline-none'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                    Title
                  </label>
                  <input
                    required
                    type='text'
                    placeholder='e.g. Summer Sale 10%'
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                  Description
                </label>
                <textarea
                  rows='2'
                  placeholder='Details about this promo...'
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-emerald-500 outline-none resize-none'></textarea>
              </div>

              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                  Discount Type
                </label>
                <select
                  value={formData.discountType}
                  onChange={(e) =>
                    setFormData({ ...formData, discountType: e.target.value })
                  }
                  className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'>
                  <option value='percentage'>Percentage (%)</option>
                  <option value='fixed'>Fixed Amount (IDR)</option>
                  <option value='buy_x_get_y'>Buy X Get Y Free</option>
                </select>
              </div>

              {formData.discountType === "percentage" && (
                <div>
                  <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                    Percentage Value (%)
                  </label>
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
                    className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                  />
                </div>
              )}

              {formData.discountType === "fixed" && (
                <div>
                  <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                    Discount Amount (IDR)
                  </label>
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
                    className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                  />
                </div>
              )}

              {formData.discountType === "buy_x_get_y" && (
                <div className='grid grid-cols-2 gap-4'>
                  <div>
                    <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                      Buy (X) Items
                    </label>
                    <input
                      type='number'
                      min='1'
                      value={formData.buyX}
                      onChange={(e) =>
                        setFormData({ ...formData, buyX: e.target.value })
                      }
                      className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                    />
                  </div>
                  <div>
                    <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                      Get (Y) Free
                    </label>
                    <input
                      type='number'
                      min='1'
                      value={formData.getY}
                      onChange={(e) =>
                        setFormData({ ...formData, getY: e.target.value })
                      }
                      className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                    />
                  </div>
                </div>
              )}

              <div>
                <label className='block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2'>
                  Minimum Cart Items Required
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
                  className='w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:border-emerald-500 outline-none'
                />
              </div>

              <div className='pt-4 border-t border-slate-100'>
                <button
                  type='submit'
                  className='w-full bg-[#1a4d3e] hover:bg-[#133d31] text-white font-extrabold py-3.5 rounded-xl shadow-md transition-all'>
                  Create Promo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagePromos;
