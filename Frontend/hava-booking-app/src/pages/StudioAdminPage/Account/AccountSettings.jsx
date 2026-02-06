import React, { useState, useEffect, useMemo } from "react";
import {
  User,
  Camera,
  Save,
  Loader2,
  Mail,
  Phone,
  Shield,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../../context/AuthContext";
import axiosInstance from "../../../utils/axiosInstance";
import uploadStudio from "../../../utils/uploadStudio";
import { API_PATHS } from "../../../utils/apiPath";
import { fetchImage } from "../../../utils/helper";

const SettingList = () => {
  const { user, setUser } = useAuth();

  // --- States ---
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);

  // Profile State
  const [previewImage, setPreviewImage] = useState(user?.avatar || null);

  // 1. NEW: Create a local baseline to compare against.
  // This prevents the "Context Lag" issue.
  const [lastSavedUser, setLastSavedUser] = useState(user || {});

  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    avatar: user?.avatar || "",
    newAvatarFile: null,
  });

  // Password State
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  // --- SYNC ON LOAD ---
  // When the component loads, sync both the Form and the Baseline with the User Context.
  useEffect(() => {
    if (user) {
      const cleanUser = {
        fullName: user.fullName || "",
        phoneNumber: user.phoneNumber || "",
        avatar: user.avatar || "",
        email: user.email || "",
      };

      // Set the Baseline
      setLastSavedUser(cleanUser);

      // Set the Form
      setProfileData((prev) => ({
        ...prev,
        ...cleanUser,
        newAvatarFile: null,
      }));

      if (!profileData.newAvatarFile) {
        setPreviewImage(user.avatar || null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?._id]); // Only re-run if the user ID changes (avoids loops)

  // --- 2. FIXED DIRTY CHECK ---
  // Compare profileData against 'lastSavedUser' (local) instead of 'user' (global)
  const isProfileDirty = useMemo(() => {
    // Helper to ensure we compare strings safely
    const normalize = (val) => String(val || "").trim();

    return (
      normalize(profileData.fullName) !== normalize(lastSavedUser.fullName) ||
      normalize(profileData.phoneNumber) !==
        normalize(lastSavedUser.phoneNumber) ||
      profileData.newAvatarFile !== null
    );
  }, [profileData, lastSavedUser]);

  const isPasswordDirty = useMemo(() => {
    return (
      passwordData.currentPassword !== "" ||
      passwordData.newPassword !== "" ||
      passwordData.confirmPassword !== ""
    );
  }, [passwordData]);

  const isDirty = isProfileDirty || isPasswordDirty;

  // --- 3. BROWSER NAVIGATION BLOCKING (Safe Method) ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes.";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // --- Handlers ---

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setProfileData({ ...profileData, newAvatarFile: file });
      setPreviewImage(URL.createObjectURL(file));
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  // --- API Actions ---

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsLoadingProfile(true);

    try {
      let avatarUrl = profileData.avatar;

      // 1. Upload new image if exists
      if (profileData.newAvatarFile) {
        const uploadRes = await uploadStudio(
          profileData.newAvatarFile,
          user.adminStudioLocation,
        );
        avatarUrl = uploadRes?.imageUrl || uploadRes?.url || uploadRes;
      }

      const payload = {
        fullName: profileData.fullName,
        phoneNumber: profileData.phoneNumber,
        avatar: avatarUrl,
      };

      // 2. Save data to Server
      await axiosInstance.put(API_PATHS.AUTH.UPDATE_PROFILE, payload);

      // 3. Fetch fresh data immediately
      const responseBack = await axiosInstance.get(
        `${API_PATHS.AUTH.GET_PROFILE}?t=${new Date().getTime()}`,
      );
      const fetchedUserData = responseBack.data;

      // 4. Update Global Context (Eventual consistency)
      if (setUser) {
        setUser(fetchedUserData);
      }

      // 5. UPDATE LOCAL STATE IMMEDIATELY (The Fix)
      // We update both the Form and the Baseline to match the fetched data.
      // This forces isDirty to become false instantly.

      const cleanFetched = {
        fullName: fetchedUserData.fullName || "",
        phoneNumber: fetchedUserData.phoneNumber || "",
        avatar: fetchedUserData.avatar || "",
        email: fetchedUserData.email || "",
      };

      setLastSavedUser(cleanFetched); // Update Baseline

      setProfileData({
        ...cleanFetched,
        newAvatarFile: null, // Clear file input
      });

      // Update the preview to the real URL
      setPreviewImage(fetchedUserData.avatar || null);

      alert("Profile updated successfully!");
    } catch (error) {
      console.error("Update failed", error);
      alert("Failed to update profile.");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert("New passwords do not match!");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert("Password must be at least 6 characters long.");
      return;
    }

    setIsLoadingPassword(true);

    try {
      await axiosInstance.put(API_PATHS.AUTH.UPDATE_PASSWORD, {
        password: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      alert("Password changed successfully!");

      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error) {
      console.error("Password update failed", error);
      alert(
        error.response?.data?.message ||
          "Failed to update password. Check your current password.",
      );
    } finally {
      setIsLoadingPassword(false);
    }
  };

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      {/* Header */}
      <div className='mb-10'>
        <h1 className='text-3xl font-bold text-gray-900 tracking-tight'>
          Account Settings
        </h1>
        <p className='text-gray-500 mt-2 text-sm'>
          Manage your personal details and account security settings.
        </p>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-12 gap-8'>
        {/* LEFT COLUMN: Profile Card */}
        <div className='lg:col-span-4 space-y-6'>
          <div className='bg-white rounded-2xl p-8 border border-gray-100 shadow-sm flex flex-col items-center text-center'>
            <div className='relative group cursor-pointer mb-6'>
              <div
                className={`w-32 h-32 rounded-full overflow-hidden border-4 ${
                  !previewImage
                    ? "border-emerald-50 shadow-inner ring-4 ring-transparent group-hover:ring-emerald-50"
                    : "border-white ring-4 ring-transparent group-hover:ring-white"
                }  transition-all duration-300`}>
                {previewImage ? (
                  isProfileDirty ? (
                    <img
                      src={previewImage}
                      alt='Preview'
                      className='w-full h-full object-cover'
                    />
                  ) : (
                    <img
                      src={fetchImage(previewImage)}
                      alt='Preview'
                      className='w-full h-full object-cover'
                    />
                  )
                ) : (
                  <div className='w-full h-full bg-emerald-50 flex items-center justify-center text-emerald-300'>
                    <User className='w-12 h-12' />
                  </div>
                )}
              </div>
              <label className='absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer backdrop-blur-[2px]'>
                <Camera className='w-8 h-8 text-white mb-1' />
                <span className='text-white text-[10px] font-bold uppercase tracking-wider'>
                  Change
                </span>
                <input
                  type='file'
                  className='hidden'
                  accept='image/*'
                  onChange={handleImageChange}
                />
              </label>
            </div>

            <h2 className='text-xl font-bold text-gray-900'>
              {/* Note: This might look stale for a second until context updates, but form will be correct */}
              {user?.fullName || "Admin User"}
            </h2>
            <div className='inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold mt-2 border border-emerald-100'>
              <Shield className='w-3 h-3' /> {user?.role || "Administrator"}
            </div>
          </div>

          <div className='bg-emerald-900 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/20'>
            <h3 className='font-bold text-lg mb-2'>Security Tip</h3>
            <p className='text-emerald-200 text-sm leading-relaxed'>
              Use a strong, unique password to protect your studio's data. We
              recommend changing it every 3 months.
            </p>
          </div>
        </div>

        {/* RIGHT COLUMN: Forms */}
        <div className='lg:col-span-8 space-y-8'>
          {/* 1. PERSONAL INFO CARD */}
          <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
            <div className='px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center'>
              <h3 className='font-bold text-gray-900 flex items-center gap-2.5'>
                <div className='p-2 bg-white border border-gray-200 rounded-lg shadow-sm'>
                  <User className='w-4 h-4 text-emerald-600' />
                </div>
                Personal Information
              </h3>
              {/* Dirty State Indicator */}
              {isProfileDirty && (
                <span className='text-xs text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded'>
                  Unsaved Changes
                </span>
              )}
            </div>

            <form onSubmit={handleUpdateProfile} className='p-8 space-y-6'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='col-span-2 md:col-span-1'>
                  <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                    Full Name
                  </label>
                  <input
                    type='text'
                    name='fullName'
                    value={profileData.fullName}
                    onChange={handleProfileChange}
                    className='w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
                  />
                </div>

                <div className='col-span-2 md:col-span-1'>
                  <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                    Phone Number
                  </label>
                  <div className='relative'>
                    <Phone className='absolute left-3 top-3.5 w-4 h-4 text-gray-400' />
                    <input
                      type='tel'
                      name='phoneNumber'
                      value={profileData.phoneNumber}
                      onChange={handleProfileChange}
                      className='w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
                    />
                  </div>
                </div>

                <div className='col-span-2'>
                  <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                    Email Address
                  </label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-3.5 w-4 h-4 text-gray-400' />
                    <input
                      type='email'
                      name='email'
                      value={profileData.email}
                      disabled
                      className='w-full pl-10 p-3 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed'
                    />
                    <span className='absolute right-3 top-3 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded'>
                      VERIFIED
                    </span>
                  </div>
                  <p className='text-[10px] text-gray-400 mt-1.5 ml-1 flex items-center gap-1'>
                    <Lock className='w-3 h-3' /> Email cannot be changed for
                    security reasons.
                  </p>
                </div>
              </div>

              <div className='pt-4 flex justify-end'>
                <button
                  type='submit'
                  disabled={isLoadingProfile || !isProfileDirty}
                  className='px-6 py-2.5 bg-emerald-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-900/20 hover:bg-emerald-800 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-70 disabled:translate-y-0 disabled:cursor-not-allowed'>
                  {isLoadingProfile ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <CheckCircle2 className='w-4 h-4' />
                  )}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* 2. SECURITY CARD */}
          <div className='bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden'>
            <div className='px-8 py-6 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center'>
              <h3 className='font-bold text-gray-900 flex items-center gap-2.5'>
                <div className='p-2 bg-white border border-gray-200 rounded-lg shadow-sm'>
                  <Lock className='w-4 h-4 text-emerald-600' />
                </div>
                Change Password
              </h3>
            </div>

            <form onSubmit={handleUpdatePassword} className='p-8 space-y-6'>
              <div className='space-y-4'>
                {/* Current Password */}
                <div>
                  <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                    Current Password
                  </label>
                  <div className='relative'>
                    <input
                      type={showPassword.current ? "text" : "password"}
                      name='currentPassword'
                      value={passwordData.currentPassword}
                      onChange={handlePasswordChange}
                      className='w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
                      placeholder='Enter current password'
                    />
                    <button
                      type='button'
                      onClick={() => togglePasswordVisibility("current")}
                      className='absolute right-3 top-3.5 text-gray-400 hover:text-gray-600'>
                      {showPassword.current ? (
                        <EyeOff className='w-4 h-4' />
                      ) : (
                        <Eye className='w-4 h-4' />
                      )}
                    </button>
                  </div>
                </div>

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {/* New Password */}
                  <div>
                    <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                      New Password
                    </label>
                    <div className='relative'>
                      <input
                        type={showPassword.new ? "text" : "password"}
                        name='newPassword'
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        className='w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
                        placeholder='Min. 6 characters'
                      />
                      <button
                        type='button'
                        onClick={() => togglePasswordVisibility("new")}
                        className='absolute right-3 top-3.5 text-gray-400 hover:text-gray-600'>
                        {showPassword.new ? (
                          <EyeOff className='w-4 h-4' />
                        ) : (
                          <Eye className='w-4 h-4' />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className='block text-xs font-bold text-gray-500 uppercase mb-2 ml-1'>
                      Confirm Password
                    </label>
                    <div className='relative'>
                      <input
                        type={showPassword.confirm ? "text" : "password"}
                        name='confirmPassword'
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        className='w-full p-3 pr-10 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all'
                        placeholder='Re-enter new password'
                      />
                      <button
                        type='button'
                        onClick={() => togglePasswordVisibility("confirm")}
                        className='absolute right-3 top-3.5 text-gray-400 hover:text-gray-600'>
                        {showPassword.confirm ? (
                          <EyeOff className='w-4 h-4' />
                        ) : (
                          <Eye className='w-4 h-4' />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className='pt-2 flex justify-end'>
                <button
                  type='submit'
                  disabled={
                    isLoadingPassword ||
                    !passwordData.currentPassword ||
                    !passwordData.newPassword
                  }
                  className='px-6 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:bg-gray-800 hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed'>
                  {isLoadingPassword ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Save className='w-4 h-4' />
                  )}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingList;
