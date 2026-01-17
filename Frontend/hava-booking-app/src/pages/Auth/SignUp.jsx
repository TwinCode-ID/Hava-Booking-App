import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  Mail,
  Lock,
  Upload,
  Eye,
  EyeOff,
  Loader,
  CheckCircle,
  AlertCircle,
  Phone,
  ShieldCheck,
  ArrowLeft,
  Send,
} from "lucide-react";
import {
  validateAvatar,
  validateEmail,
  validatePassword,
  validatePhoneNumber,
} from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
// Ensure this path is correct based on your file structure
import uploadProfile from "../../utils/uploadProfile";

const SignUp = () => {
  const { login } = useAuth();

  // Step 0: Register Form, Step 1: OTP Verification
  const [step, setStep] = useState(0);

  // Temporary storage for User ID (received after register, used for upload)
  const [tempUserId, setTempUserId] = useState(null);

  // Timer & Popup State
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendPopup, setShowResendPopup] = useState(false);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
    role: "",
    avatar: null, // Stores the File object
    otp: "",
  });

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
    avatarPreview: null,
    success: false,
  });

  // Handle Timer Countdown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (formState.errors[name] || formState.errors.submit) {
      setFormState((prev) => ({
        ...prev,
        errors: { ...prev.errors, [name]: "", submit: "" },
      }));
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const error = validateAvatar(file);
      if (error) {
        setFormState((prev) => ({
          ...prev,
          errors: { ...prev.errors, avatar: error },
        }));
        return;
      }

      setFormData((prev) => ({ ...prev, avatar: file }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setFormState((prev) => ({
          ...prev,
          avatarPreview: e.target.result,
          errors: { ...prev.errors, avatar: "" },
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const errors = {
      fullName: !formData.fullName ? "Enter full name" : "",
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
      phoneNumber: validatePhoneNumber(formData.phoneNumber),
      role: !formData.role ? "" : "",
      avatar: "",
    };

    Object.keys(errors).forEach((key) => {
      if (!errors[key]) delete errors[key];
    });

    setFormState((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // --- STEP 0: REGISTER SUBMIT ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      // 1. REGISTER USER (Send empty avatar string initially)
      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
        fullName: formData.fullName,
        email: formData.email,
        password: formData.password,
        phoneNumber: formData.phoneNumber,
        role: import.meta.env.VITE_ROLE || "client",
        avatar: "",
      });

      // 2. Store User ID for the next step
      if (response.data && response.data._id) {
        setTempUserId(response.data._id);
      }

      // 3. TRIGGER OTP
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        email: formData.email,
      });

      // 4. Move to OTP Step
      setStep(1);
      setResendTimer(60);
      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            error.response?.data?.message ||
            "Registration failed. Please try again.",
        },
      }));
    }
  };

  // --- STEP 1: OTP SUBMIT ---
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (formData.otp.length < 4) {
      setFormState((prev) => ({ ...prev, errors: { otp: "Invalid Code" } }));
      return;
    }
    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      // 1. Verify OTP
      const response = await axiosInstance.post(API_PATHS.AUTH.VERIFY_OTP, {
        email: formData.email,
        otp: formData.otp,
      });

      const { token, _id } = response.data;
      // Fallback to tempUserId if _id is not in OTP response
      const userId = _id || tempUserId;

      if (token) {
        // 2. Set Token in Context
        login(token);

        // 4. Upload Avatar & Update Profile (If avatar exists)
        if (formData.avatar && userId) {
          try {
            // A. Upload Image
            // We pass userId because your uploadProfile util expects it
            const uploadRes = await uploadProfile(formData.avatar, userId);

            const avatarUrl =
              uploadRes?.imageUrl || uploadRes?.url || uploadRes;

            // B. Update Profile with the new URL
            // This call now has the Bearer token attached
            if (avatarUrl) {
              await axiosInstance.put(API_PATHS.AUTH.UPDATE_PROFILE, {
                avatar: avatarUrl,
              });
            }
          } catch (uploadError) {
            console.error("Avatar upload/update failed:", uploadError);
          }
        }

        // 5. Finish
        finalizeLogin(response.data);
      }
    } catch (error) {
      console.error(error);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Invalid or expired OTP." },
      }));
    }
  };

  const finalizeLogin = (data) => {
    setFormState((prev) => ({ ...prev, loading: false, success: true }));
    const role = data.role || import.meta.env.VITE_ROLE;
    setTimeout(() => {
      if (role === "studioAdmin") window.location.href = "/admin-dashboard";
      else if (role === "client") window.location.href = "/client-dashboard";
      else window.location.href = "/development-dashboard";
    }, 1500);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        email: formData.email,
      });
      setFormState((prev) => ({ ...prev, loading: false }));
      setResendTimer(60);
      setShowResendPopup(true);
      setTimeout(() => setShowResendPopup(false), 3000);
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Failed to resend." },
      }));
    }
  };

  if (formState.success) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center'>
          <CheckCircle className='w-16 h-16 text-emerald-800 mx-auto mb-4' />
          <h2 className='text-2xl font-bold text-emerald-800 mb-2'>Welcome!</h2>
          <p className='text-gray-600 mb-4'>
            Account created & verified. Redirecting...
          </p>
          <div className='animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto' />
        </motion.div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8'>
      <div className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full relative overflow-hidden'>
        {/* Resend Popup */}
        <AnimatePresence>
          {showResendPopup && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className='absolute top-4 left-0 right-0 mx-auto w-max z-20'>
              <div className='bg-emerald-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-medium'>
                <Send className='w-4 h-4 mr-2' /> Code sent!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className='text-center mb-8'>
          <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4'>
            {step === 0 ? (
              <User className='w-8 h-8 text-emerald-700' />
            ) : (
              <ShieldCheck className='w-8 h-8 text-emerald-700' />
            )}
          </div>
          <h2 className='text-2xl font-bold text-emerald-900 mb-2'>
            {step === 0 ? "Create Account" : "Verify Email"}
          </h2>
          <p className='text-sm text-gray-600'>
            {step === 0
              ? "Join thousands finding their strength."
              : `Enter the code sent to ${formData.email}`}
          </p>
        </div>

        <AnimatePresence mode='wait'>
          {/* --- STEP 0: REGISTRATION FORM --- */}
          {step === 0 && (
            <motion.form
              key='step0'
              onSubmit={handleRegisterSubmit}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-5'>
              {/* Full Name */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Full Name
                </label>
                <div className='relative'>
                  <User className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type='text'
                    name='fullName'
                    value={formData.fullName}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                      formState.errors.fullName
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-colors`}
                    placeholder='John Doe'
                  />
                </div>
                {formState.errors.fullName && (
                  <p className='text-red-500 text-xs mt-1'>
                    {formState.errors.fullName}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Email Address
                </label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type='email'
                    name='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                      formState.errors.email
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-colors`}
                    placeholder='name@example.com'
                  />
                </div>
                {formState.errors.email && (
                  <p className='text-red-500 text-xs mt-1'>
                    {formState.errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type={formState.showPassword ? "text" : "password"}
                    name='password'
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 py-3 rounded-lg border ${
                      formState.errors.password
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-colors`}
                    placeholder='Create password'
                  />
                  <button
                    type='button'
                    onClick={() =>
                      setFormState((prev) => ({
                        ...prev,
                        showPassword: !prev.showPassword,
                      }))
                    }
                    className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600'>
                    {formState.showPassword ? (
                      <EyeOff className='w-5 h-5' />
                    ) : (
                      <Eye className='w-5 h-5' />
                    )}
                  </button>
                </div>
                {formState.errors.password && (
                  <p className='text-red-500 text-xs mt-1'>
                    {formState.errors.password}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>
                  Phone Number
                </label>
                <div className='relative'>
                  <Phone className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type='text'
                    name='phoneNumber'
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                      formState.errors.phoneNumber
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-colors`}
                    placeholder='081...'
                  />
                </div>
                {formState.errors.phoneNumber && (
                  <p className='text-red-500 text-xs mt-1'>
                    {formState.errors.phoneNumber}
                  </p>
                )}
              </div>

              {/* Avatar */}
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-2'>
                  Profile Picture
                </label>
                <div className='flex items-center space-x-4'>
                  <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200'>
                    {formState.avatarPreview ? (
                      <img
                        src={formState.avatarPreview}
                        alt='Preview'
                        className='w-full h-full object-cover'
                      />
                    ) : (
                      <User className='w-6 h-6 text-gray-400' />
                    )}
                  </div>
                  <div className='flex-1'>
                    <input
                      type='file'
                      id='avatar'
                      accept='image/png, image/jpeg, image/jpg'
                      onChange={handleAvatarChange}
                      className='hidden'
                    />
                    <label
                      htmlFor='avatar'
                      className='cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50'>
                      <Upload className='w-4 h-4 mr-2' /> Upload
                    </label>
                  </div>
                </div>
              </div>

              {formState.errors.submit && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                  <p className='text-red-700 text-sm flex items-center'>
                    <AlertCircle className='w-4 h-4 mr-2' />
                    {formState.errors.submit}
                  </p>
                </div>
              )}

              <button
                type='submit'
                disabled={formState.loading}
                className='w-full bg-emerald-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50'>
                {formState.loading ? (
                  <Loader className='w-5 h-5 animate-spin' />
                ) : (
                  "Create Account"
                )}
              </button>

              <p className='text-center text-sm text-gray-600'>
                Already have an account?{" "}
                <a
                  href='/login'
                  className='text-emerald-800 hover:text-emerald-600 font-bold'>
                  Sign in
                </a>
              </p>
            </motion.form>
          )}

          {/* --- STEP 1: OTP VERIFICATION --- */}
          {step === 1 && (
            <motion.form
              key='step1'
              onSubmit={handleOtpSubmit}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-6'>
              <div className='flex flex-col items-center'>
                <input
                  type='text'
                  name='otp'
                  value={formData.otp}
                  onChange={handleInputChange}
                  maxLength={6}
                  className={`w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl border ${
                    formState.errors.otp ? "border-red-500" : "border-gray-200"
                  } focus:ring-2 focus:ring-emerald-500 outline-none transition-all uppercase`}
                  placeholder='••••••'
                  autoFocus
                />
                {formState.errors.otp && (
                  <p className='text-red-500 text-sm mt-2 font-medium'>
                    {formState.errors.otp}
                  </p>
                )}
              </div>

              {formState.errors.submit && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3 text-center text-red-600 text-sm font-medium'>
                  {formState.errors.submit}
                </div>
              )}

              <div className='flex gap-3'>
                <button
                  type='button'
                  onClick={() => setStep(0)}
                  className='w-12 flex items-center justify-center rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors'>
                  <ArrowLeft className='w-5 h-5 text-gray-600' />
                </button>
                <button
                  type='submit'
                  disabled={formState.loading}
                  className='flex-1 bg-emerald-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50'>
                  {formState.loading ? (
                    <Loader className='w-5 h-5 animate-spin' />
                  ) : (
                    "Verify & Login"
                  )}
                </button>
              </div>

              <div className='text-center'>
                <button
                  type='button'
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || formState.loading}
                  className={`text-sm font-bold ${
                    resendTimer > 0
                      ? "text-gray-400 cursor-not-allowed"
                      : "text-emerald-700 hover:text-emerald-900"
                  }`}>
                  {resendTimer > 0
                    ? `Resend code in ${resendTimer}s`
                    : "Resend Code"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SignUp;
