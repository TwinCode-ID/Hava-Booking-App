import React, { useState, useEffect } from "react";
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
  Plus,
  Trash2,
  UploadCloud, // New Icon
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import { useAuth } from "../../../../context/AuthContext";
import LoadingSpinner from "../../../../components/LoadingSpinner";

const StudioDetails = () => {
  const { user } = useAuth();
  const [studio, setStudio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // --- 1. Fetch Studio Data ---
  const fetchStudio = async () => {
    try {
      setLoading(true);

      const response = await axiosInstance.get(
        API_PATHS.STUDIO.GET_STUDIO_BY_ID(user.adminStudioLocation)
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

  // --- 2. Edit Handler (Supports Files) ---
  const handleUpdateStudio = async (formDataPayload) => {
    try {
      // If formDataPayload is a FormData object (contains files), send as multipart
      // Otherwise send as JSON
      const config = {
        headers: {
          "Content-Type":
            formDataPayload instanceof FormData
              ? "multipart/form-data"
              : "application/json",
        },
      };

      await axiosInstance.put(`/studio/${studio._id}`, formDataPayload, config);

      alert("Studio updated successfully!");
      setIsEditModalOpen(false);
      fetchStudio(); // Refresh data to get new image URLs from server
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update studio details.");
    }
  };

  // --- 3. Data Parsers ---
  const facilitiesList = studio?.facilities?.flat() || [];
  const allImages = studio?.studioPictures?.flat() || [];
  const activeImage = allImages[0] || "";
  const [lat, lng] = studio?.address?.coordinates || [0, 0];

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white flex items-center justify-center font-sans'>
        <LoadingSpinner />
      </div>
    );

  if (!studio) return <div className='p-10 text-center'>Studio not found.</div>;

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      {/* Header */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Studio Settings</h1>
          <p className='text-gray-500 text-sm mt-1'>
            Update location details, images, and facilities.
          </p>
        </div>
        <button
          onClick={() => setIsEditModalOpen(true)}
          className='flex items-center gap-2 bg-emerald-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20'>
          <Edit2 className='w-4 h-4' /> Edit Details
        </button>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Left Col: Main Info */}
        <div className='lg:col-span-2 space-y-8'>
          {/* Hero Image Card */}
          <div className='bg-white rounded-2xl p-4 border border-gray-100 shadow-sm'>
            <div className='h-64 w-full rounded-xl overflow-hidden bg-gray-100 relative group'>
              {activeImage ? (
                <img
                  src={activeImage}
                  alt='Studio Hero'
                  className='w-full h-full object-cover'
                />
              ) : (
                <div className='flex items-center justify-center h-full text-gray-400 bg-gray-50'>
                  <ImageIcon className='w-12 h-12 opacity-50' />
                </div>
              )}
              <div className='absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 via-black/40 to-transparent p-6 pt-20'>
                <h2 className='text-white text-2xl font-bold'>
                  {studio.studioName}
                </h2>
                <p className='text-white/80 text-sm flex items-center gap-1.5 mt-1'>
                  <MapPin className='w-4 h-4' /> {studio.address?.city},
                  Indonesia
                </p>
              </div>
            </div>

            {/* Image Gallery Thumbnails */}
            {allImages.length > 1 && (
              <div className='flex gap-2 mt-4 overflow-x-auto pb-2'>
                {allImages.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Gallery ${idx}`}
                    className='w-20 h-20 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity'
                  />
                ))}
              </div>
            )}
          </div>

          {/* Details Grid */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
            {/* Contact Info */}
            <div className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm'>
              <h3 className='font-bold text-gray-900 mb-4 flex items-center gap-2'>
                <Building2 className='w-5 h-5 text-emerald-600' /> Studio
                Details
              </h3>
              <div className='space-y-4'>
                <div>
                  <p className='text-xs text-gray-400 font-bold uppercase tracking-wider mb-1'>
                    Full Address
                  </p>
                  <p className='text-sm text-gray-700 leading-relaxed'>
                    {studio.address?.street}
                    <br />
                    {studio.address?.city} {studio.address?.zip}
                  </p>
                </div>
                <div>
                  <p className='text-xs text-gray-400 font-bold uppercase tracking-wider mb-1'>
                    Contact Number
                  </p>
                  <p className='text-sm text-gray-700 font-mono flex items-center gap-2'>
                    <Phone className='w-3 h-3 text-gray-400' /> +
                    {studio.contactNumber}
                  </p>
                </div>
              </div>
            </div>

            {/* Facilities */}
            <div className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm'>
              <h3 className='font-bold text-gray-900 mb-4 flex items-center gap-2'>
                <CheckCircle2 className='w-5 h-5 text-emerald-600' /> Facilities
              </h3>
              <div className='flex flex-wrap gap-2'>
                {facilitiesList.length > 0 ? (
                  facilitiesList.map((facility, index) => (
                    <span
                      key={index}
                      className='inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100'>
                      {getFacilityIcon(facility)} {facility}
                    </span>
                  ))
                ) : (
                  <p className='text-sm text-gray-400 italic'>
                    No facilities listed.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Google Map */}
        <div className='lg:col-span-1'>
          <div className='bg-white p-4 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col'>
            <div className='flex justify-between items-center mb-4 px-2'>
              <h3 className='font-bold text-gray-900'>Location</h3>
              <span className='text-xs font-mono text-gray-400'>
                {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>
            <div className='flex-1 w-full min-h-[400px] bg-gray-100 rounded-xl overflow-hidden relative border border-gray-200'>
              <iframe
                title='Studio Location'
                width='100%'
                height='100%'
                frameBorder='0'
                style={{ border: 0, minHeight: "400px" }}
                src={`https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`}
                allowFullScreen></iframe>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <EditStudioModal
          studio={studio}
          onClose={() => setIsEditModalOpen(false)}
          onSave={handleUpdateStudio}
        />
      )}
    </div>
  );
};

// --- Helper Functions ---
const getFacilityIcon = (name) => {
  const n = (name || "").toLowerCase();
  if (n.includes("wifi")) return <Wifi className='w-3 h-3' />;
  if (n.includes("parking")) return <Car className='w-3 h-3' />;
  if (n.includes("water") || n.includes("drink"))
    return <Droplets className='w-3 h-3' />;
  return <CheckCircle2 className='w-3 h-3' />;
};

// --- Sub-Component: Edit Modal (Updated for File Upload) ---
const EditStudioModal = ({ studio, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    studioName: studio.studioName,
    contactNumber: studio.contactNumber,
    address: { ...studio.address },
    facilities: studio.facilities?.flat() || [],
    studioPictures: studio.studioPictures?.flat() || [], // Existing URLs
  });

  const [newFiles, setNewFiles] = useState([]); // Stores newly selected File objects
  const [newFacility, setNewFacility] = useState("");

  // Field Handlers
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

  // Facility Handlers
  const addFacility = () => {
    if (newFacility.trim()) {
      setFormData((prev) => ({
        ...prev,
        facilities: [...prev.facilities, newFacility.trim()],
      }));
      setNewFacility("");
    }
  };
  const removeFacility = (idx) => {
    setFormData((prev) => ({
      ...prev,
      facilities: prev.facilities.filter((_, i) => i !== idx),
    }));
  };

  // --- Image Handling (File Upload) ---

  // 1. Handle File Selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      setNewFiles((prev) => [...prev, ...files]);
    }
  };

  // 2. Remove Existing Image URL
  const removeExistingImage = (idx) => {
    setFormData((prev) => ({
      ...prev,
      studioPictures: prev.studioPictures.filter((_, i) => i !== idx),
    }));
  };

  // 3. Remove Newly Added File
  const removeNewFile = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // 4. Submit Logic (FormData)
  const handleSubmit = (e) => {
    e.preventDefault();

    // If we have new files, we MUST use FormData
    if (newFiles.length > 0) {
      const data = new FormData();

      // Append basic fields (stringify nested objects)
      data.append("studioName", formData.studioName);
      data.append("contactNumber", formData.contactNumber);
      data.append("address[street]", formData.address.street);
      data.append("address[city]", formData.address.city);
      data.append("address[zip]", formData.address.zip);
      data.append("address[coordinates][0]", formData.address.coordinates[0]);
      data.append("address[coordinates][1]", formData.address.coordinates[1]);

      // Append Facilities
      formData.facilities.forEach((fac) => data.append("facilities[]", fac));

      // Append Existing Images (that weren't deleted)
      formData.studioPictures.forEach((pic) =>
        data.append("existingImages[]", pic)
      );

      // Append New Files
      newFiles.forEach((file) => data.append("studioPictures", file));

      onSave(data); // Send FormData
    } else {
      // If no new files, send JSON (cleaner) or FormData depending on backend preference
      // Here assuming JSON is fine if no files are involved, but let's be consistent and format properly
      const payload = {
        ...formData,
        facilities: [formData.facilities],
        studioPictures: [formData.studioPictures],
      };
      onSave(payload);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <div
        className='absolute inset-0 bg-black/50 backdrop-blur-sm'
        onClick={onClose}></div>
      <div className='relative bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10'>
          <h3 className='text-lg font-bold text-gray-900'>
            Edit Studio Details
          </h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-500' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-6'>
          {/* Basic Info */}
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            <div>
              <label className='block text-xs font-bold text-gray-700 mb-1'>
                Studio Name
              </label>
              <input
                type='text'
                name='studioName'
                value={formData.studioName}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'
              />
            </div>
            <div>
              <label className='block text-xs font-bold text-gray-700 mb-1'>
                Contact Number
              </label>
              <input
                type='text'
                name='contactNumber'
                value={formData.contactNumber}
                onChange={handleChange}
                className='w-full p-2.5 border rounded-lg text-sm bg-gray-50 focus:bg-white'
              />
            </div>
          </div>

          {/* Address Section */}
          <div className='pt-4 border-t border-gray-100'>
            <p className='text-xs font-bold text-gray-400 uppercase mb-3'>
              Address & Location
            </p>
            <div className='space-y-3'>
              <textarea
                name='address.street'
                value={formData.address.street}
                onChange={handleChange}
                rows='2'
                className='w-full p-2.5 border rounded-lg text-sm'
                placeholder='Street Address'
              />
              <div className='grid grid-cols-2 gap-3'>
                <input
                  type='text'
                  name='address.city'
                  value={formData.address.city}
                  onChange={handleChange}
                  className='w-full p-2.5 border rounded-lg text-sm'
                  placeholder='City'
                />
                <input
                  type='text'
                  name='address.zip'
                  value={formData.address.zip}
                  onChange={handleChange}
                  className='w-full p-2.5 border rounded-lg text-sm'
                  placeholder='ZIP'
                />
              </div>
              <div className='grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-lg'>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    Latitude
                  </label>
                  <input
                    type='number'
                    step='any'
                    value={formData.address.coordinates[0]}
                    onChange={(e) => handleCoordinateChange(0, e.target.value)}
                    className='w-full p-2 border rounded text-sm bg-white'
                  />
                </div>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    Longitude
                  </label>
                  <input
                    type='number'
                    step='any'
                    value={formData.address.coordinates[1]}
                    onChange={(e) => handleCoordinateChange(1, e.target.value)}
                    className='w-full p-2 border rounded text-sm bg-white'
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Facilities */}
          <div className='pt-4 border-t border-gray-100'>
            <p className='text-xs font-bold text-gray-400 uppercase mb-3'>
              Facilities
            </p>
            <div className='flex flex-wrap gap-2 mb-3'>
              {formData.facilities.map((fac, idx) => (
                <span
                  key={idx}
                  className='inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded text-xs font-bold border border-emerald-100'>
                  {fac}{" "}
                  <X
                    className='w-3 h-3 cursor-pointer hover:text-red-500'
                    onClick={() => removeFacility(idx)}
                  />
                </span>
              ))}
            </div>
            <div className='flex gap-2'>
              <input
                type='text'
                placeholder='Add facility...'
                value={newFacility}
                onChange={(e) => setNewFacility(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addFacility())
                }
                className='flex-1 p-2 text-sm border rounded-lg'
              />
              <button
                type='button'
                onClick={addFacility}
                className='px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-200'>
                Add
              </button>
            </div>
          </div>

          {/* Images Section (UPDATED) */}
          <div className='pt-4 border-t border-gray-100'>
            <p className='text-xs font-bold text-gray-400 uppercase mb-3'>
              Studio Images
            </p>
            <div className='grid grid-cols-4 gap-3 mb-3'>
              {/* Existing Images */}
              {formData.studioPictures.map((pic, idx) => (
                <div
                  key={`exist-${idx}`}
                  className='relative group aspect-square rounded-lg overflow-hidden border border-gray-200'>
                  <img
                    src={pic}
                    alt='Preview'
                    className='w-full h-full object-cover'
                  />
                  <div className='absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center transition-all'>
                    <button
                      type='button'
                      onClick={() => removeExistingImage(idx)}
                      className='p-1.5 bg-white rounded-full text-red-500 hover:bg-red-50'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>
              ))}

              {/* New File Previews */}
              {newFiles.map((file, idx) => (
                <div
                  key={`new-${idx}`}
                  className='relative group aspect-square rounded-lg overflow-hidden border-2 border-emerald-500'>
                  <img
                    src={URL.createObjectURL(file)}
                    alt='New Upload'
                    className='w-full h-full object-cover'
                  />
                  <div className='absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center transition-all'>
                    <button
                      type='button'
                      onClick={() => removeNewFile(idx)}
                      className='p-1.5 bg-white rounded-full text-red-500 hover:bg-red-50'>
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                  <div className='absolute top-1 right-1 w-2 h-2 bg-emerald-500 rounded-full'></div>
                </div>
              ))}

              {/* Upload Button */}
              <label className='aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all text-gray-400 hover:text-emerald-600'>
                <UploadCloud className='w-6 h-6 mb-1' />
                <span className='text-[10px] font-bold'>Upload</span>
                <input
                  type='file'
                  multiple
                  accept='image/*'
                  className='hidden'
                  onChange={handleFileSelect}
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className='pt-4 flex gap-3 border-t border-gray-100 sticky bottom-0 bg-white'>
            <button
              type='button'
              onClick={onClose}
              className='flex-1 py-2.5 text-gray-600 font-bold hover:bg-gray-50 rounded-lg'>
              Cancel
            </button>
            <button
              type='submit'
              className='flex-1 py-2.5 bg-emerald-900 text-white font-bold hover:bg-emerald-800 rounded-lg shadow-lg flex items-center justify-center gap-2'>
              <Save className='w-4 h-4' /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudioDetails;
