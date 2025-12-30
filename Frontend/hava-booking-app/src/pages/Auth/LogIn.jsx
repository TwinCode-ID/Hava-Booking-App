import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Send, // Added icon for the popup
} from "lucide-react";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const { login } = useAuth();

  // 1 = Credentials, 2 = OTP
  const [step, setStep] = useState(1);

  // --- NEW: Timer & Popup State ---
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendPopup, setShowResendPopup] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
    otp: "",
  });

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
    success: false,
  });

  // --- NEW: Handle Timer Countdown ---
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    return "";
  };

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

  // --- STEP 1: Validate Credentials & Request OTP ---
  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();

    const errors = {
      email: validateEmail(formData.email),
      password: validatePassword(formData.password),
    };

    Object.keys(errors).forEach((key) => !errors[key] && delete errors[key]);

    if (Object.keys(errors).length > 0) {
      setFormState((prev) => ({ ...prev, errors }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      // 1. Login
      await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      try {
        // 2. Request OTP
        await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
          email: formData.email,
        });
        setStep(2);
        setResendTimer(60);
        setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
      } catch (error) {
        const serverErrorMessage =
          error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to send OTP.";

        setFormState((prev) => ({
          ...prev,
          loading: false,
          errors: { submit: serverErrorMessage },
        }));
      }
    } catch (error) {
      const serverErrorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Invalid credentials. Please try again.";

      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: serverErrorMessage },
      }));
    }
  };

  // --- NEW: Handle Resend OTP (With Timer & Popup) ---
  const handleResendOtp = async () => {
    if (resendTimer > 0) return; // Prevent clicking if timer is active

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        email: formData.email,
      });

      // Reset loading
      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));

      // Start Timer (60 seconds)
      setResendTimer(60);

      // Show Popup
      setShowResendPopup(true);
      setTimeout(() => setShowResendPopup(false), 3000); // Hide after 3s
    } catch (error) {
      const serverErrorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to resend OTP.";

      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: serverErrorMessage },
      }));
    }
  };

  // --- STEP 2: Verify OTP & Finalize Login ---
  const handleOtpSubmit = async (e) => {
    e.preventDefault();

    if (!formData.otp || formData.otp.length < 4) {
      setFormState((prev) => ({
        ...prev,
        errors: { otp: "Please enter a valid OTP code" },
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.VERIFY_OTP, {
        email: formData.email,
        otp: formData.otp,
      });

      setFormState((prev) => ({
        ...prev,
        loading: false,
        success: true,
        errors: {},
      }));

      const { role, token } = response.data;

      if (token) {
        login(token);
        setTimeout(() => {
          window.location.href =
            role === "studioAdmin"
              ? "/admin-dashboard"
              : role === "client"
              ? "/client-dashboard"
              : "/development-dashboard";
        }, 2000);
      }
    } catch (error) {
      const serverErrorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Invalid OTP. Please try again.";

      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: serverErrorMessage },
      }));
    }
  };

  // Render Success State
  if (formState.success) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center'>
          <CheckCircle className='w-16 h-16 text-emerald-800 mx-auto mb-4' />
          <h2 className='text-2xl font-bold text-emerald-800 mb-2'>
            Login Successful
          </h2>
          <p className='text-gray-600 mb-4'>Redirecting you to dashboard...</p>
          <div className='animate-spin w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full mx-auto' />
        </motion.div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
      <div className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full relative'>
        {/* --- NEW: Resend Success Popup --- */}
        <AnimatePresence>
          {showResendPopup && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className='absolute top-4 left-0 right-0 mx-auto w-max z-20'>
              <div className='bg-emerald-800 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-medium'>
                <Send className='w-4 h-4 mr-2' />
                OTP code sent successfully!
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode='wait'>
          {/* --- STEP 1: EMAIL & PASSWORD --- */}
          {step === 1 && (
            <motion.div
              key='step1'
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}>
              <div className='text-center mb-8'>
                <h2 className='text-2xl font-bold text-emerald-800 mb-2'>
                  Welcome Back
                </h2>
                <p className='text-gray-600'>Sign in to your account</p>
              </div>

              <form onSubmit={handleCredentialsSubmit} className='space-y-6'>
                {/* Email Input */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Email Address
                  </label>
                  <div className='relative'>
                    <Mail className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
                    <input
                      type='email'
                      name='email'
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                        formState.errors.email
                          ? "border-red-500"
                          : "border-gray-300"
                      } focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors`}
                      placeholder='Enter your email'
                    />
                  </div>
                  {formState.errors.email && (
                    <p className='text-red-500 text-sm mt-1 flex items-center'>
                      <AlertCircle className='w-4 h-4 mr-1' />
                      {formState.errors.email}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2'>
                    Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5' />
                    <input
                      type={formState.showPassword ? "text" : "password"}
                      name='password'
                      value={formData.password}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3 rounded-lg border ${
                        formState.errors.password
                          ? "border-red-500"
                          : "border-gray-300"
                      } focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors`}
                      placeholder='Enter your password'
                    />
                    <button
                      type='button'
                      onClick={() =>
                        setFormState((prev) => ({
                          ...prev,
                          showPassword: !prev.showPassword,
                        }))
                      }
                      className='absolute right-3 top-1/2 transform -translate-y-1/2 hover:text-gray-600'>
                      {formState.showPassword ? (
                        <EyeOff className='w-5 h-5' />
                      ) : (
                        <Eye className='w-5 h-5' />
                      )}
                    </button>
                  </div>
                  {formState.errors.password && (
                    <p className='text-red-500 text-sm mt-1 flex items-center'>
                      <AlertCircle className='w-4 h-4 mr-1' />
                      {formState.errors.password}
                    </p>
                  )}
                </div>

                {/* Global Error */}
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
                  className='w-full bg-emerald-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2'>
                  {formState.loading ? (
                    <>
                      <Loader className='w-5 h-5 animate-spin' />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <span>Continue</span>
                  )}
                </button>

                <div className='text-center'>
                  <p className='text-gray-600'>
                    Don't have an account?{" "}
                    <a
                      href='/signup'
                      className='text-emerald-800 hover:text-emerald-600 font-medium'>
                      Create one here
                    </a>
                  </p>
                </div>
              </form>
            </motion.div>
          )}

          {/* --- STEP 2: OTP VERIFICATION --- */}
          {step === 2 && (
            <motion.div
              key='step2'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}>
              <div className='text-center mb-8 mt-6'>
                <div className='w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4'>
                  <ShieldCheck className='w-8 h-8 text-emerald-800' />
                </div>
                <h2 className='text-2xl font-bold text-emerald-800 mb-2'>
                  Verification Required
                </h2>
                <p className='text-gray-600'>
                  Enter the code sent to{" "}
                  <span className='font-semibold text-emerald-800'>
                    {formData.email}
                  </span>
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className='space-y-6'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-2 text-center'>
                    One-Time Password
                  </label>
                  <input
                    type='text'
                    name='otp'
                    value={formData.otp}
                    onChange={handleInputChange}
                    maxLength={6}
                    className={`w-full text-center text-2xl tracking-[0.5em] font-bold py-3 rounded-lg border ${
                      formState.errors.otp || formState.errors.submit
                        ? "border-red-500"
                        : "border-gray-300"
                    } focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-colors uppercase`}
                    placeholder='••••••'
                  />
                  {formState.errors.otp && (
                    <p className='text-red-500 text-sm mt-1 text-center'>
                      {formState.errors.otp}
                    </p>
                  )}
                </div>

                {/* Global Error for OTP Step */}
                {formState.errors.submit && (
                  <div className='bg-red-50 border border-red-200 rounded-lg p-3'>
                    <p className='text-red-700 text-sm flex items-center justify-center'>
                      <AlertCircle className='w-4 h-4 mr-2' />
                      {formState.errors.submit}
                    </p>
                  </div>
                )}

                <button
                  type='submit'
                  disabled={formState.loading}
                  className='w-full bg-emerald-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-emerald-800 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2'>
                  {formState.loading ? (
                    <>
                      <Loader className='w-5 h-5 animate-spin' />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Verify & Login</span>
                  )}
                </button>

                {/* --- UPDATED RESEND SECTION --- */}
                <div className='text-center'>
                  <p className='text-sm text-gray-600'>
                    Didn't receive the code?{" "}
                    <button
                      type='button'
                      onClick={handleResendOtp}
                      disabled={resendTimer > 0 || formState.loading}
                      className={`font-medium transition-colors ${
                        resendTimer > 0 || formState.loading
                          ? "text-gray-400 cursor-not-allowed"
                          : "text-emerald-800 hover:text-emerald-600"
                      }`}>
                      {resendTimer > 0
                        ? `Resend in ${resendTimer}s`
                        : "Resend Code"}
                    </button>
                  </p>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Login;
