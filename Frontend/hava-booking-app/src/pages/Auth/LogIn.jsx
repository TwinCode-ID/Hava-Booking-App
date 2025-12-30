import React, { useState } from "react";
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
} from "lucide-react";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const { login } = useAuth();

  // 1 = Credentials, 2 = OTP
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
    otp: "", // Added OTP to form data
  });

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
    success: false,
  });

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

    // Remove empty errors
    Object.keys(errors).forEach((key) => !errors[key] && delete errors[key]);

    if (Object.keys(errors).length > 0) {
      setFormState((prev) => ({ ...prev, errors }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      // NOTE: Adjust API path if your backend separates "Login" from "Send OTP"
      // We assume the first login call validates credentials and triggers the OTP email
      await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: formData.email,
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      // If successful, move to Step 2 instead of logging in immediately
      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        email: formData.email,
      });
      setStep(2);
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            error.response?.data?.message ||
            "Invalid credentials. Please try again.",
        },
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
      // NOTE: You will likely need a specific endpoint for OTP verification
      // Example: API_PATHS.AUTH.VERIFY_OTP
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

      const { token } = response.data;

      if (token) {
        login(token);
        const { user, isAuthenticated } = useAuth();
        // Redirect logic
        if (isAuthenticated && user) {
          setTimeout(() => {
            window.location.href =
              user.role === "studioAdmin"
                ? "/admin-dashboard"
                : user.role === "client"
                ? "/client-dashboard"
                : "/development-dashboard";
          }, 2000);
        }
      }
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            error.response?.data?.message || "Invalid OTP. Please try again.",
        },
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
      <div className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full relative overflow-hidden'>
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
              <button
                onClick={() => {
                  setStep(1);
                  setFormState((prev) => ({ ...prev, errors: {} }));
                }}
                className='absolute top-0 left-0 p-2 text-gray-500 hover:text-emerald-800 flex items-center transition-colors'>
                <ArrowLeft className='w-5 h-5 mr-1' /> Back
              </button>

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

                <div className='text-center'>
                  <p className='text-sm text-gray-600'>
                    Didn't receive the code?{" "}
                    <button
                      type='button'
                      onClick={handleCredentialsSubmit} // Re-trigger send OTP logic
                      className='text-emerald-800 hover:text-emerald-600 font-medium'>
                      Resend
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
