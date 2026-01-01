import React, { useState, useEffect, useRef } from "react";
import {
  Save,
  Camera,
  Lock,
  Mail,
  Edit2,
  X,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import CustomSelect from "../../layout/CustomSelect";
import { AnimatePresence, motion } from "framer-motion";

const SettingList = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [studios, setStudios] = useState([]);

  const [profile, setProfile] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    preferredStudioId: "",
    role: "",
    avatar: "",
  });

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [userRes, studioRes] = await Promise.all([
          axiosInstance.get(API_PATHS.AUTH.GET_PROFILE),
          axiosInstance.get(API_PATHS.STUDIO.GET_ALL),
        ]);
        const userData = userRes.data;
        setProfile({
          fullName: userData.fullName || "",
          email: userData.email || "",
          phoneNumber: userData.phoneNumber || "",
          preferredStudioId: userData.preferredStudioId || "",
          role: userData.role,
          avatar: userData.avatar,
        });
        setStudios(studioRes.data);
      } catch (error) {
        console.error("Failed to load profile data", error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axiosInstance.put("/users/update-profile", {
        fullName: profile.fullName,
        phoneNumber: profile.phoneNumber,
        preferredStudioId: profile.preferredStudioId,
      });
      alert("Profile updated successfully!");
    } catch (error) {
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const res = await axiosInstance.post("/users/upload-avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setProfile((prev) => ({ ...prev, avatar: res.data.avatar }));
      alert("Avatar updated!");
    } catch (error) {
      alert("Failed to upload avatar.");
    }
  };

  const studioOptions = studios.map((s) => s.studioName);
  const currentStudioName =
    studios.find((s) => s._id === profile.preferredStudioId)?.studioName || "";

  const handleStudioChange = (selectedName) => {
    const selectedStudio = studios.find((s) => s.studioName === selectedName);
    if (selectedStudio) {
      setProfile({ ...profile, preferredStudioId: selectedStudio._id });
    }
  };

  if (loading)
    return (
      <div className='py-10'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='animate-in fade-in'>
      {/* Top Section: Avatar & Role */}
      <div className='flex items-center gap-6 mb-8'>
        <div className='relative group'>
          <div className='w-20 h-20 rounded-full bg-gray-100 border-2 border-emerald-100 overflow-hidden shadow-sm'>
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt='Profile'
                className='w-full h-full object-cover'
              />
            ) : (
              <div className='w-full h-full flex items-center justify-center text-emerald-800 font-bold text-2xl'>
                {profile.fullName.charAt(0)}
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current.click()}
            className='absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white'>
            <Camera className='w-6 h-6' />
          </button>
          <input
            type='file'
            ref={fileInputRef}
            className='hidden'
            accept='image/*'
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <h3 className='text-xl font-bold text-gray-900'>
            {profile.fullName}
          </h3>
          <span className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 capitalize mt-1 border border-emerald-100'>
            {profile.role === "studioAdmin" ? "Studio Admin" : profile.role}
          </span>
          <p className='text-xs text-gray-400 mt-2'>
            Click image to change avatar
          </p>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleProfileUpdate} className='space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
          <div>
            <label className='block text-xs font-bold text-gray-700 mb-1'>
              Full Name
            </label>
            <input
              type='text'
              value={profile.fullName}
              onChange={(e) =>
                setProfile({ ...profile, fullName: e.target.value })
              }
              className='w-full p-3 border rounded-xl text-sm bg-white focus:border-emerald-500 outline-none transition-all'
            />
          </div>
          <div>
            <label className='block text-xs font-bold text-gray-700 mb-1'>
              Phone Number
            </label>
            <input
              type='text'
              value={profile.phoneNumber}
              onChange={(e) =>
                setProfile({ ...profile, phoneNumber: e.target.value })
              }
              className='w-full p-3 border rounded-xl text-sm bg-white focus:border-emerald-500 outline-none transition-all'
            />
          </div>
          <div className='relative'>
            <label className='block text-xs font-bold text-gray-700 mb-1'>
              Email Address
            </label>
            <div className='flex gap-2'>
              <div className='relative flex-1'>
                <Mail className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
                <input
                  type='email'
                  value={profile.email}
                  disabled
                  className='w-full pl-10 p-3 border rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed'
                />
              </div>
              <button
                type='button'
                onClick={() => setShowEmailModal(true)}
                className='px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-all'>
                Change
              </button>
            </div>
          </div>
          <div>
            <CustomSelect
              label='Preferred Studio'
              placeholder='Select a studio'
              options={studioOptions}
              value={currentStudioName}
              onChange={handleStudioChange}
            />
          </div>
        </div>
        <div className='pt-6 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4'>
          <button
            type='button'
            onClick={() => setShowPasswordModal(true)}
            className='flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-emerald-700 transition-colors'>
            <Lock className='w-4 h-4' /> Change Password
          </button>
          <button
            type='submit'
            disabled={saving}
            className='w-full md:w-auto px-8 py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-70 flex items-center justify-center gap-2'>
            {saving ? (
              <LoadingSpinner size='sm' color='white' />
            ) : (
              <>
                <Save className='w-4 h-4' /> Save Changes
              </>
            )}
          </button>
        </div>
      </form>

      {/* --- Modals with AnimatePresence --- */}
      <AnimatePresence>
        {showEmailModal && (
          <ChangeEmailModal
            currentEmail={profile.email}
            onClose={() => setShowEmailModal(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPasswordModal && (
          <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />
        )}
      </AnimatePresence>
    </div>
  );
};

// ==========================================
// 1. CHANGE EMAIL MODAL (Animated)
// ==========================================
const ChangeEmailModal = ({ currentEmail, onClose }) => {
  const [step, setStep] = useState(1);
  const [newEmail, setNewEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/change-email-request", { newEmail });
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || "Email invalid.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/change-email-verify", { newEmail, otp });
      alert("Email changed!");
      window.location.reload();
    } catch (err) {
      setError("Invalid OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-md'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className='relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-lg font-bold text-gray-900'>
            Change Email Address
          </h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        {step === 1 ? (
          <form onSubmit={handleRequestOtp} className='space-y-4'>
            <div className='bg-blue-50 p-3 rounded-lg flex gap-3'>
              <AlertCircle className='w-5 h-5 text-blue-600' />
              <p className='text-xs text-blue-700'>
                We will send a verification code to the new email address.
              </p>
            </div>
            <div>
              <label className='block text-xs font-bold text-gray-700 mb-1'>
                New Email
              </label>
              <input
                type='email'
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className='w-full p-3 border rounded-xl text-sm focus:border-emerald-500 outline-none'
                placeholder='name@example.com'
              />
            </div>
            {error && <p className='text-xs text-red-600'>{error}</p>}
            <button
              disabled={loading}
              className='w-full py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition-all'>
              {loading ? "Sending..." : "Send Code"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className='space-y-4'>
            <p className='text-sm text-center text-gray-600'>
              Enter code sent to <b>{newEmail}</b>
            </p>
            <input
              type='text'
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className='w-full p-3 border rounded-xl text-center text-lg tracking-widest'
              placeholder='000000'
            />
            {error && (
              <p className='text-xs text-red-600 text-center'>{error}</p>
            )}
            <button
              disabled={loading}
              className='w-full py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition-all'>
              {loading ? "Verifying..." : "Verify"}
            </button>
            <button
              type='button'
              onClick={() => setStep(1)}
              className='w-full text-xs text-gray-500 underline text-center'>
              Back
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

// ==========================================
// 2. CHANGE PASSWORD MODAL (Animated)
// ==========================================
const ChangePasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirmPassword)
      return setError("Passwords do not match.");
    setError("");
    setLoading(true);
    try {
      await axiosInstance.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      alert("Password changed.");
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className='absolute inset-0 bg-black/50 backdrop-blur-md'
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className='relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden p-6'>
        <div className='flex justify-between items-center mb-6'>
          <h3 className='text-lg font-bold text-gray-900'>Change Password</h3>
          <button
            onClick={onClose}
            className='p-1 rounded-full hover:bg-gray-100'>
            <X className='w-5 h-5 text-gray-400' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <input
            type='password'
            required
            placeholder='Current Password'
            value={form.currentPassword}
            onChange={(e) =>
              setForm({ ...form, currentPassword: e.target.value })
            }
            className='w-full p-3 border rounded-xl text-sm outline-none focus:border-emerald-500'
          />
          <input
            type='password'
            required
            placeholder='New Password'
            value={form.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
            className='w-full p-3 border rounded-xl text-sm outline-none focus:border-emerald-500'
          />
          <input
            type='password'
            required
            placeholder='Confirm Password'
            value={form.confirmPassword}
            onChange={(e) =>
              setForm({ ...form, confirmPassword: e.target.value })
            }
            className='w-full p-3 border rounded-xl text-sm outline-none focus:border-emerald-500'
          />
          {error && (
            <p className='text-xs text-red-600 bg-red-50 p-2 rounded'>
              {error}
            </p>
          )}
          <button
            disabled={loading}
            className='w-full py-3 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 transition-all'>
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </motion.div>
    </div>
  );
};

export default SettingList;
