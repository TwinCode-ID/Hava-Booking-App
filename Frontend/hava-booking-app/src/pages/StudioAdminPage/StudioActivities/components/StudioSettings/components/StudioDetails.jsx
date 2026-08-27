import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Phone,
  Wifi,
  Car,
  Droplets,
  CheckCircle2,
  Edit2,
  Save,
  X,
  Building2,
  ImageIcon,
  Trash2,
  UploadCloud,
  CreditCard,
  Building,
  Landmark,
  Copy,
  Cog,
  Wallet,
  Plus,
  ChevronDown,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import { useAuth } from "../../../../../../context/AuthContext";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import uploadStudio from "../../../../../../utils/uploadStudio";
import FinancialAccessGate from "../../../../../../components/FinancialAccessGate";
import useFinancialStepUp from "../../../../../../utils/useFinancialStepUp";

import { fetchImage, INDONESIAN_BANKS } from "../../../../../../utils/helper";
import { getBankLogo } from "../../../../../../utils/helpers";

// --- Custom Bank Dropdown Component ---
const CustomBankDropdown = ({ value, onChange, isCustom }) => {
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

  // Display "OTHER" if custom, otherwise the bank name
  const displayValue = isCustom ? "OTHER" : value;

  return (
    <div className='relative' ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className='w-full p-2.5 border border-stone-200 rounded-lg text-sm bg-white cursor-pointer flex items-center justify-between hover:border-stone-500 transition-colors'>
        <div className='flex items-center gap-3'>
          {displayValue ? (
            <>
              <div className='w-8 h-5 flex items-center justify-center shrink-0'>
                {getBankLogo(displayValue)}
              </div>
              <span className='font-medium text-stone-700'>{displayValue}</span>
            </>
          ) : (
            <span className='text-stone-400'>Select Bank...</span>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white border border-stone-100 rounded-xl shadow-xl max-h-60 overflow-y-auto custom-scrollbar py-2'>
            {INDONESIAN_BANKS.map((bank) => (
              <div
                key={bank}
                onClick={() => {
                  onChange(bank);
                  setIsOpen(false);
                }}
                className='flex items-center gap-3 px-4 py-2.5 hover:bg-stone-100 cursor-pointer transition-colors'>
                <div className='w-8 h-5 flex items-center justify-center shrink-0'>
                  {getBankLogo(bank)}
                </div>
                <span className='text-sm font-medium text-stone-700'>
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

const StudioDetails = () => {
  const { user } = useAuth();
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [bankDetailsLoading, setBankDetailsLoading] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [financialPasswordError, setFinancialPasswordError] = useState("");
  const financialAccess = useFinancialStepUp();

  useEffect(() => {
    financialAccess.lock();
  }, [financialAccess.lock, user?._id, user?.adminStudioLocation]);

  const fetchStudio = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.STUDIO.GET_STUDIO_BY_ID(user.adminStudioLocation),
      );
      setStudio(response.data);
    } catch (err) {
      console.error("Failed to fetch studio", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudio();
  }, [user]);

  useEffect(() => {
    let isCurrent = true;

    const fetchPaymentInstructions = async () => {
      if (!financialAccess.isUnlocked || !user?.adminStudioLocation) return;

      setBankDetailsLoading(true);
      try {
        const response = await axiosInstance.get(
          API_PATHS.STUDIO.GET_PAYMENT_INSTRUCTIONS(
            user.adminStudioLocation,
          ),
          { headers: financialAccess.requestHeaders },
        );
        if (!isCurrent) return;
        setStudio((currentStudio) =>
          currentStudio
            ? {
                ...currentStudio,
                bankDetails: response.data?.bankDetails || [],
              }
            : currentStudio,
        );
      } catch (err) {
        if (isCurrent) console.error("Failed to fetch payment instructions", err);
      } finally {
        if (isCurrent) setBankDetailsLoading(false);
      }
    };

    fetchPaymentInstructions();
    return () => {
      isCurrent = false;
    };
  }, [
    financialAccess.isUnlocked,
    financialAccess.requestHeaders,
    user?.adminStudioLocation,
  ]);

  const handleUpdateStudio = async ({ formData, newFiles }) => {
    try {
      setIsSaving(true);
      let uploadedUrls = [];

      if (newFiles && newFiles.length > 0) {
        uploadedUrls = await Promise.all(
          newFiles.map(async (file) => {
            const response = await uploadStudio(file, user.adminStudioLocation);
            const finalUrl = response?.imageUrl || response?.url || response;
            if (typeof finalUrl !== "string") throw new Error("Invalid URL");
            return finalUrl;
          }),
        );
      }

      const finalImageArray = [
        ...(formData.studioPictures || []),
        ...uploadedUrls,
      ];

      // Strip out the 'isCustom' UI flag before sending to the backend
      const cleanBankDetails = formData.bankDetails.map((b) => {
        const { isCustom, ...rest } = b;
        return rest;
      });

      const payload = {
        ...formData,
        studioPictures: finalImageArray,
        bankDetails: cleanBankDetails,
      };

      const response = await axiosInstance.put(
        API_PATHS.STUDIO.UPDATE_STUDIO_BY_ID(studio._id),
        payload,
        { headers: financialAccess.requestHeaders },
      );
      setStudio(response.data);
      setIsEditModalOpen(false);
      alert("Studio updated successfully!");
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update studio details.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || (financialAccess.isUnlocked && bankDetailsLoading))
    return (
      <div className='min-h-screen flex justify-center items-center'>
        <LoadingSpinner />
      </div>
    );
  if (!studio) return <div className='p-10 text-center'>Studio not found.</div>;
  if (!financialAccess.isUnlocked) {
    return (
      <FinancialAccessGate
        description='Confirm your password before editing studio payment instructions.'
        error={financialPasswordError}
        onUnlock={financialAccess.unlock}
        setError={setFinancialPasswordError}
        title='Unlock Studio Settings'
      />
    );
  }

  const facilitiesList = studio?.facilities?.flat() || [];
  const allImages = studio?.studioPictures?.flat() || [];
  const bankDetails = studio?.bankDetails?.flat() || [];
  const activeImage = allImages[0] || "";
  const [lat, lng] = studio?.address?.coordinates || [0, 0];

  return (
    <div className='p-6 md:p-10 bg-canvas min-h-screen font-sans'>
      <div className='max-w-7xl mx-auto'>
        {/* TOP: Full Width Image Gallery */}
        <div className='bg-white rounded-2xl p-4 border border-stone-100 shadow-sm mb-8'>
          <div className='h-[40vh] w-full rounded-xl overflow-hidden bg-stone-100 relative group'>
            {activeImage ? (
              <img
                src={fetchImage(activeImage)}
                alt='Studio Hero'
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='flex items-center justify-center h-full text-stone-400 bg-stone-50'>
                <ImageIcon className='w-12 h-12 opacity-50' />
              </div>
            )}
            <div className='absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent p-5 sm:p-8 pt-28 sm:pt-32'>
              <div className='flex flex-col sm:flex-row sm:items-end justify-between gap-5'>
                {/* Text Section */}
                <div className='flex flex-col gap-1.5 min-w-0'>
                  <h2 className='text-white text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight truncate'>
                    {studio.studioName}
                  </h2>
                  <p className='text-white/80 text-sm sm:text-base flex items-center gap-2 font-medium'>
                    <MapPin className='w-4 h-4 text-white shrink-0' />
                    <span className='truncate'>
                      {studio.address?.city}, Indonesia
                    </span>
                  </p>
                </div>

                {/* Action Section */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className='flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-stone-800 transition-all shadow-[0_4px_14px_-4px_rgba(28,25,23,0.4)] active:scale-95 w-full sm:w-auto shrink-0'>
                  <Edit2 className='w-4 h-4' /> Edit Details
                </button>
              </div>
            </div>
          </div>
          {allImages.length > 1 && (
            <div className='flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-hide'>
              {allImages.map((img, idx) => (
                <img
                  key={idx}
                  src={fetchImage(img)}
                  alt={`Gallery ${idx}`}
                  className='w-24 h-24 rounded-lg object-cover border border-stone-200 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0'
                />
              ))}
            </div>
          )}
        </div>

        {/* BOTTOM: Two Column Layout */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
          <div className='lg:col-span-2 space-y-8'>
            <div className='bg-white p-6 md:p-8 rounded-2xl border border-stone-100 shadow-sm'>
              <h3 className='font-bold text-stone-900 mb-6 flex items-center gap-2 text-lg'>
                <CheckCircle2 className='w-5 h-5 text-stone-800' /> Facilities
              </h3>
              <div className='flex flex-wrap gap-3'>
                {facilitiesList.length > 0 ? (
                  facilitiesList.map((facility, index) => (
                    <span
                      key={index}
                      className='inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-100 text-stone-900 text-sm font-semibold border border-stone-200'>
                      <CheckCircle2 className='w-4 h-4' /> {facility}
                    </span>
                  ))
                ) : (
                  <p className='text-sm text-stone-400 italic'>
                    No facilities listed.
                  </p>
                )}
              </div>
            </div>

            {/* Bank Details Display */}
            <div className='bg-white p-6 md:p-8 rounded-2xl border border-stone-100 shadow-sm'>
              <h3 className='font-bold text-stone-900 mb-6 flex items-center gap-2 text-lg'>
                <CreditCard className='w-5 h-5 text-stone-800' /> Bank Details
              </h3>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                {bankDetails.length > 0 ? (
                  bankDetails.map((detail) => (
                    <div
                      key={detail._id}
                      className='group relative flex items-center justify-between p-5 bg-white border border-stone-200 rounded-xl shadow-sm hover:shadow-md hover:border-stone-300 transition-all duration-200 overflow-hidden'>
                      <div className='flex items-center gap-4 overflow-hidden'>
                        <div className='w-12 h-8 flex items-center justify-center bg-white rounded-md border border-stone-200 p-1 shrink-0 group-hover:scale-105 transition-transform duration-200'>
                          {getBankLogo(detail.bankName)}
                        </div>
                        <div className='flex flex-col min-w-0'>
                          <p className='text-xs font-bold text-stone-500 uppercase tracking-wider truncate'>
                            {detail.bankName}
                          </p>
                          <p className='text-base font-bold text-stone-900 tracking-tight truncate'>
                            {detail.accountNumber}
                          </p>
                          <p className='text-sm text-stone-600 truncate'>
                            a/n{" "}
                            <span className='font-medium text-stone-800'>
                              {detail.accountHolderName}
                            </span>
                          </p>
                        </div>
                      </div>
                      <button
                        className='flex-shrink-0 p-2 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100'
                        title='Copy Account Number'>
                        <Copy className='w-4 h-4' />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className='text-sm text-stone-500 italic'>
                    No bank details available.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className='lg:col-span-1 space-y-8'>
            <div className='sticky top-8 space-y-8'>
              <div className='bg-white p-6 rounded-2xl border border-stone-100 shadow-sm'>
                <h3 className='font-bold text-stone-900 mb-5 flex items-center gap-2'>
                  <Building2 className='w-5 h-5 text-stone-800' /> Contact &
                  Address
                </h3>
                <div className='space-y-5'>
                  <div>
                    <p className='text-xs text-stone-400 font-bold uppercase tracking-wider mb-1'>
                      Full Address
                    </p>
                    <p className='text-sm text-stone-800 leading-relaxed font-medium'>
                      {studio.address?.street}
                      <br />
                      {studio.address?.city} {studio.address?.zip}
                    </p>
                  </div>
                  <div>
                    <p className='text-xs text-stone-400 font-bold uppercase tracking-wider mb-1'>
                      Contact Number
                    </p>
                    <p className='text-sm text-stone-800 font-mono font-medium flex items-center gap-2'>
                      <Phone className='w-4 h-4 text-stone-800' /> +
                      {studio.contactNumber}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <EditStudioModal
          studio={studio}
          isSaving={isSaving}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateStudio}
        />
      )}
    </div>
  );
};

// --- Sub-Component: Edit Modal ---
const EditStudioModal = ({ studio, onClose, onSave, isSaving }) => {
  const [formData, setFormData] = useState({
    studioName: studio.studioName,
    contactNumber: studio.contactNumber,
    address: { ...studio.address },
    facilities: studio.facilities?.flat() || [],
    studioPictures: studio.studioPictures?.flat() || [],

    // Evaluate if the saved bank is custom or from our list
    bankDetails:
      studio.bankDetails?.flat().map((b) => ({
        ...b,
        isCustom: b.bankName && !INDONESIAN_BANKS.includes(b.bankName),
      })) || [],
  });

  const [newFiles, setNewFiles] = useState([]);
  const [newFacility, setNewFacility] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleCoordinateChange = (index, value) => {
    const newCoords = [...formData.address.coordinates];
    newCoords[index] = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, coordinates: newCoords },
    }));
  };

  const addFacility = () => {
    if (newFacility.trim()) {
      setFormData((prev) => ({
        ...prev,
        facilities: [...prev.facilities, newFacility.trim()],
      }));
      setNewFacility("");
    }
  };
  const removeFacility = (idx) =>
    setFormData((prev) => ({
      ...prev,
      facilities: prev.facilities.filter((_, i) => i !== idx),
    }));

  const handleBankChange = (index, field, value) => {
    const updatedBanks = [...formData.bankDetails];
    updatedBanks[index] = { ...updatedBanks[index], [field]: value };
    setFormData((prev) => ({ ...prev, bankDetails: updatedBanks }));
  };

  const addBankDetail = () => {
    setFormData((prev) => ({
      ...prev,
      bankDetails: [
        ...prev.bankDetails,
        {
          bankName: "",
          accountNumber: "",
          accountHolderName: "",
          isCustom: false,
        },
      ],
    }));
  };

  const removeBankDetail = (index) => {
    setFormData((prev) => ({
      ...prev,
      bankDetails: prev.bankDetails.filter((_, i) => i !== index),
    }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) setNewFiles((prev) => [...prev, ...files]);
  };
  const removeExistingImage = (idx) =>
    setFormData((prev) => ({
      ...prev,
      studioPictures: prev.studioPictures.filter((_, i) => i !== idx),
    }));
  const removeNewFile = (idx) =>
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({ formData, newFiles });
  };

  const SectionHeader = ({ title }) => (
    <div className='bg-stone-50 -mx-6 px-6 py-2 border-y border-stone-100 mb-4 mt-6 first:mt-0'>
      <p className='text-xs font-bold text-stone-500 uppercase tracking-widest'>
        {title}
      </p>
    </div>
  );

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={!isSaving ? onClose : undefined}></div>

      <div className='relative bg-white w-full max-w-3xl rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col'>
        {isSaving && (
          <div className='absolute inset-0 z-50 bg-white/90 flex flex-col items-center justify-center'>
            <LoadingSpinner />
            <p className='mt-4 text-stone-900 font-bold animate-pulse'>
              Uploading & Saving...
            </p>
          </div>
        )}

        <div className='p-5 border-b border-stone-100 flex justify-between items-center bg-white shrink-0'>
          <h3 className='text-xl font-bold text-stone-900'>Edit Studio</h3>
          {!isSaving && (
            <button
              onClick={onClose}
              className='p-2 rounded-full hover:bg-stone-100 transition-colors'>
              <X className='w-5 h-5 text-stone-500' />
            </button>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className='p-6 space-y-2 overflow-y-auto flex-1 custom-scrollbar'>
          {/* ... Basic Info & Address sections remain identical ... */}
          <SectionHeader title='Basic Information' />
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-bold text-stone-700 mb-1'>
                Studio Name
              </label>
              <input
                type='text'
                name='studioName'
                value={formData.studioName}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-stone-500 outline-none transition-all'
              />
            </div>
            <div>
              <label className='block text-xs font-bold text-stone-700 mb-1'>
                Contact Number
              </label>
              <input
                type='text'
                name='contactNumber'
                value={formData.contactNumber}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-stone-50 focus:bg-white focus:ring-2 focus:ring-stone-500 outline-none transition-all'
              />
            </div>
          </div>

          <SectionHeader title='Bank Details' />
          <div className='space-y-4'>
            {formData.bankDetails.map((bank, index) => (
              <div
                key={index}
                className='relative p-4 border border-stone-200 rounded-xl bg-stone-50/50'>
                <button
                  type='button'
                  onClick={() => removeBankDetail(index)}
                  className='absolute top-3 right-3 p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors'>
                  <Trash2 className='w-4 h-4' />
                </button>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4 pr-8'>
                  <div>
                    <label className='block text-xs font-bold text-stone-600 mb-1'>
                      Bank Name
                    </label>
                    <CustomBankDropdown
                      value={bank.bankName}
                      isCustom={bank.isCustom}
                      onChange={(val) => {
                        if (val === "OTHER") {
                          handleBankChange(index, "isCustom", true);
                          handleBankChange(index, "bankName", "");
                        } else {
                          handleBankChange(index, "isCustom", false);
                          handleBankChange(index, "bankName", val);
                        }
                      }}
                    />

                    {/* Animated custom input if "OTHER" is selected */}
                    <AnimatePresence>
                      {bank.isCustom && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}>
                          <input
                            type='text'
                            value={bank.bankName}
                            onChange={(e) =>
                              handleBankChange(
                                index,
                                "bankName",
                                e.target.value,
                              )
                            }
                            placeholder='e.g. Bank Jateng'
                            className='mt-3 w-full p-2.5 border rounded-lg text-sm outline-none focus:border-stone-500 bg-white'
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className='block text-xs font-bold text-stone-600 mb-1'>
                      Account Number
                    </label>
                    <input
                      type='text'
                      value={bank.accountNumber}
                      onChange={(e) =>
                        handleBankChange(index, "accountNumber", e.target.value)
                      }
                      placeholder='e.g. 1234567890'
                      className='w-full p-2.5 border rounded-lg text-sm outline-none focus:border-stone-500'
                    />
                  </div>
                  <div className='md:col-span-2'>
                    <label className='block text-xs font-bold text-stone-600 mb-1'>
                      Account Holder Name
                    </label>
                    <input
                      type='text'
                      value={bank.accountHolderName}
                      onChange={(e) =>
                        handleBankChange(
                          index,
                          "accountHolderName",
                          e.target.value,
                        )
                      }
                      placeholder='e.g. CV Gerak Selaras'
                      className='w-full p-2.5 border rounded-lg text-sm outline-none focus:border-stone-500'
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type='button'
              onClick={addBankDetail}
              className='w-full py-3 border-2 border-dashed border-stone-300 rounded-xl text-sm font-bold text-stone-500 flex justify-center items-center gap-2 hover:bg-stone-50 hover:border-stone-400 transition-all'>
              <Plus className='w-4 h-4' /> Add Bank Account
            </button>
          </div>

          <SectionHeader title='Studio Images' />
          {/* ... Upload section remains identical ... */}
          <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 pb-4'>
            {formData.studioPictures.map((pic, idx) => (
              <div
                key={`exist-${idx}`}
                className='relative group aspect-square rounded-xl overflow-hidden border border-stone-200'>
                <img
                  src={fetchImage(pic)}
                  alt='Preview'
                  className='w-full h-full object-cover'
                />
                <div className='absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all backdrop-blur-sm'>
                  <button
                    type='button'
                    onClick={() => removeExistingImage(idx)}
                    className='p-2 bg-white rounded-full text-red-500 hover:scale-110 transition-transform shadow-lg'>
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>
            ))}
            {newFiles.map((file, idx) => (
              <div
                key={`new-${idx}`}
                className='relative group aspect-square rounded-xl overflow-hidden border-2 border-stone-500'>
                <img
                  src={URL.createObjectURL(file)}
                  alt='New Upload'
                  className='w-full h-full object-cover'
                />
                <div className='absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center transition-all backdrop-blur-sm'>
                  <button
                    type='button'
                    onClick={() => removeNewFile(idx)}
                    className='p-2 bg-white rounded-full text-red-500 hover:scale-110 transition-transform shadow-lg'>
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>
            ))}
            <label className='aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-500 hover:bg-stone-100 transition-all text-stone-400 hover:text-stone-800'>
              <UploadCloud className='w-8 h-8 mb-2' />
              <span className='text-xs font-bold'>Upload Image</span>
              <input
                type='file'
                multiple
                accept='image/*'
                className='hidden'
                onChange={handleFileSelect}
              />
            </label>
          </div>
        </form>

        <div className='p-5 bg-stone-50 flex justify-end gap-3 border-t border-stone-200 shrink-0'>
          <button
            type='button'
            onClick={onClose}
            disabled={isSaving}
            className='px-6 py-2.5 text-stone-600 font-bold hover:bg-stone-200 rounded-xl disabled:opacity-50 transition-colors'>
            Cancel
          </button>
          <button
            type='submit'
            onClick={handleSubmit}
            disabled={isSaving}
            className='px-8 py-2.5 bg-stone-900 text-white font-bold hover:bg-stone-800 rounded-xl shadow-lg flex items-center justify-center gap-2 disabled:bg-stone-300 disabled:cursor-wait transition-all'>
            {isSaving ? (
              <LoadingSpinner size='sm' />
            ) : (
              <>
                <Save className='w-4 h-4' /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudioDetails;
