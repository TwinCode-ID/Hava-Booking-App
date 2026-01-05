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
  Send,
  ArrowRight,
  ArrowLeft,
  User,
  Key,
} from "lucide-react";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const { login } = useAuth();

  // Steps: 0 = Email, 1 = Password, 2 = OTP, 3 = Create Password
  const [step, setStep] = useState(0);

  // State to track if user has password
  const [hasPassword, setHasPassword] = useState(true);

  // Timer & Popup State
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendPopup, setShowResendPopup] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    otp: "",
    newPassword: "", // For Step 3
    confirmPassword: "", // For Step 3
  });

  const [formState, setFormState] = useState({
    loading: false,
    errors: {},
    showPassword: false,
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
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formState.errors[name] || formState.errors.submit) {
      setFormState((prev) => ({
        ...prev,
        errors: { ...prev.errors, [name]: "", submit: "" },
      }));
    }
  };

  // --- STEP 0: CHECK EMAIL & DETERMINE FLOW ---
  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    const emailError = validateEmail(formData.email);
    if (emailError) {
      setFormState((prev) => ({ ...prev, errors: { email: emailError } }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.CHECK_STATUS, {
        email: formData.email,
      });
      const userHasPassword = response.data.hasPassword;

      setHasPassword(userHasPassword);

      console.log(userHasPassword);
      console.log(response.data.password);

      if (userHasPassword) {
        setStep(1);
      } else {
        // No Password (Studio User) -> Trigger OTP
        await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
          email: formData.email,
        });
        setStep(2); // Go to OTP Input
        setResendTimer(60);
      }

      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
    } catch (error) {
      setStep(0);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { email: "User not found" },
      }));
    }
  };

  // --- STEP 1: PASSWORD LOGIN ---
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!formData.password) {
      setFormState((prev) => ({
        ...prev,
        errors: { password: "Password is required" },
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: formData.email,
        password: formData.password,
      });
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        email: formData.email,
      });
      setStep(2);
      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit: error.response?.data?.message || "Invalid credentials.",
        },
      }));
    }
  };

  // --- STEP 2: OTP LOGIN ---
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    if (formData.otp.length < 4) {
      setFormState((prev) => ({ ...prev, errors: { otp: "Invalid Code" } }));
      return;
    }
    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      const response = await axiosInstance.post(API_PATHS.AUTH.VERIFY_OTP, {
        email: formData.email,
        otp: formData.otp,
      });

      // Check flow: If user had no password initially, force creation
      if (!hasPassword) {
        // Save the token temporarily (e.g. in context or just use it for the next call)
        // Ideally, login() sets it in localStorage so axiosInstance can use it
        login(response.data.token);
        setStep(3); // Go to Create Password Step
        setFormState((prev) => ({ ...prev, loading: false }));
      } else {
        finalizeLogin(response.data);
      }
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Invalid or expired OTP." },
      }));
    }
  };

  // --- STEP 3: CREATE PASSWORD ---
  const handleCreatePasswordSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword.length < 6) {
      setFormState((prev) => ({
        ...prev,
        errors: { newPassword: "Password must be at least 6 characters" },
      }));
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setFormState((prev) => ({
        ...prev,
        errors: { confirmPassword: "Passwords do not match" },
      }));
      return;
    }

    setFormState((prev) => ({ ...prev, loading: true }));

    try {
      // Call endpoint to set password. Token should be available from Step 2 login() call.
      // Adjust API_PATHS.AUTH.SET_PASSWORD to your actual endpoint (e.g., /users/profile or /auth/set-password)
      await axiosInstance.put(API_PATHS.AUTH.SET_NEW_PASSWORD, {
        password: formData.newPassword,
      });

      const meRes = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
      console.log(meRes.data.role);
      finalizeLogin({ role: meRes.data.role, token: null }); // Token already set
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Failed to set password." },
      }));
    }
  };

  const finalizeLogin = (data) => {
    setFormState((prev) => ({ ...prev, loading: false, success: true }));
    // If token passed, set it (Step 1 & 2 standard flow). Step 3 already set it.
    if (data.token) login(data.token);

    const role = data.role; // Ensure your backend returns 'role'

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
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          className='bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center'>
          <CheckCircle className='w-16 h-16 text-emerald-800 mx-auto mb-4' />
          <h2 className='text-2xl font-bold text-emerald-800 mb-2'>Success!</h2>
          <p className='text-gray-600 mb-4'>Redirecting...</p>
          <Loader className='w-6 h-6 animate-spin mx-auto text-emerald-600' />
        </motion.div>
      </div>
    );
  }

  return (
    <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
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

        {/* Header Section */}
        <div className='text-center mb-8'>
          <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4'>
            {step === 0 && <User className='w-8 h-8 text-emerald-700' />}
            {step === 1 && <Lock className='w-8 h-8 text-emerald-700' />}
            {step === 2 && <ShieldCheck className='w-8 h-8 text-emerald-700' />}
            {step === 3 && <Key className='w-8 h-8 text-emerald-700' />}
          </div>
          <h2 className='text-2xl font-bold text-emerald-900 mb-2'>
            {step === 0
              ? "Welcome Back"
              : step === 1
              ? "Enter Password"
              : step === 2
              ? "Verification"
              : "Create Password"}
          </h2>
          <p className='text-gray-500 text-sm'>
            {step === 0
              ? "Enter your email to continue"
              : step === 1
              ? `Welcome back, ${formData.email}`
              : step === 2
              ? `Code sent to ${formData.email}`
              : "Secure your account with a password"}
          </p>
        </div>

        <AnimatePresence mode='wait'>
          {/* --- STEP 0: EMAIL INPUT --- */}
          {step === 0 && (
            <motion.form
              key='step0'
              onSubmit={handleEmailSubmit}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-6'>
              <div>
                <label className='block text-sm font-bold text-gray-700 mb-2'>
                  Email Address
                </label>
                <div className='relative'>
                  <Mail className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type='email'
                    name='email'
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-4 py-3.5 rounded-xl border ${
                      formState.errors.email
                        ? "border-red-500"
                        : "border-gray-200"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                    placeholder='name@example.com'
                    autoFocus
                  />
                </div>
                {formState.errors.email && (
                  <p className='text-red-500 text-xs mt-1.5 ml-1'>
                    {formState.errors.email}
                  </p>
                )}
              </div>

              <button
                type='submit'
                disabled={formState.loading}
                className='w-full bg-emerald-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-emerald-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 disabled:opacity-50'>
                {formState.loading ? (
                  <Loader className='w-5 h-5 animate-spin' />
                ) : (
                  <>
                    Continue <ArrowRight className='w-5 h-5' />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {/* --- STEP 1: PASSWORD INPUT --- */}
          {step === 1 && (
            <motion.form
              key='step1'
              onSubmit={handlePasswordSubmit}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-6'>
              <div>
                <label className='block text-sm font-bold text-gray-700 mb-2'>
                  Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type={formState.showPassword ? "text" : "password"}
                    name='password'
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                      formState.errors.password
                        ? "border-red-500"
                        : "border-gray-200"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                    placeholder='••••••••'
                    autoFocus
                  />
                  <button
                    type='button'
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        showPassword: !p.showPassword,
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
                  <p className='text-red-500 text-xs mt-1.5 ml-1'>
                    {formState.errors.password}
                  </p>
                )}
              </div>

              {formState.errors.submit && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2'>
                  <AlertCircle className='w-4 h-4 text-red-600' />
                  <p className='text-red-600 text-sm font-medium'>
                    {formState.errors.submit}
                  </p>
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
                    "Sign In"
                  )}
                </button>
              </div>
            </motion.form>
          )}

          {/* --- STEP 2: OTP INPUT --- */}
          {step === 2 && (
            <motion.form
              key='step2'
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
                    "Verify Code"
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

          {/* --- STEP 3: CREATE PASSWORD (NEW) --- */}
          {step === 3 && (
            <motion.form
              key='step3'
              onSubmit={handleCreatePasswordSubmit}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-5'>
              <div>
                <label className='block text-sm font-bold text-gray-700 mb-2'>
                  New Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type={formState.showPassword ? "text" : "password"}
                    name='newPassword'
                    value={formData.newPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                      formState.errors.newPassword
                        ? "border-red-500"
                        : "border-gray-200"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                    placeholder='At least 6 characters'
                    autoFocus
                  />
                  <button
                    type='button'
                    onClick={() =>
                      setFormState((p) => ({
                        ...p,
                        showPassword: !p.showPassword,
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
                {formState.errors.newPassword && (
                  <p className='text-red-500 text-xs mt-1.5 ml-1'>
                    {formState.errors.newPassword}
                  </p>
                )}
              </div>

              <div>
                <label className='block text-sm font-bold text-gray-700 mb-2'>
                  Confirm Password
                </label>
                <div className='relative'>
                  <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5' />
                  <input
                    type={formState.showPassword ? "text" : "password"}
                    name='confirmPassword'
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                      formState.errors.confirmPassword
                        ? "border-red-500"
                        : "border-gray-200"
                    } focus:ring-2 focus:ring-emerald-500 outline-none transition-all`}
                    placeholder='Repeat password'
                  />
                </div>
                {formState.errors.confirmPassword && (
                  <p className='text-red-500 text-xs mt-1.5 ml-1'>
                    {formState.errors.confirmPassword}
                  </p>
                )}
              </div>

              {formState.errors.submit && (
                <div className='bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2'>
                  <AlertCircle className='w-4 h-4 text-red-600' />
                  <p className='text-red-600 text-sm font-medium'>
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
                  "Set Password & Login"
                )}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default Login;
