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
  Fingerprint, // Added Fingerprint for Passkey
} from "lucide-react";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

// Import the WebAuthn browser library for Passkeys
import { startAuthentication } from "@simplewebauthn/browser";

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
    newPassword: "",
    confirmPassword: "",
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

  // --- INITIALIZE APPLE SIGN IN ---
  useEffect(() => {
    // Make sure to replace these with your actual Apple Developer credentials
    if (window.AppleID) {
      window.AppleID.auth.init({
        clientId: process.env.REACT_APP_APPLE_CLIENT_ID,
        scope: "name email",
        redirectURI: process.env.REACT_APP_APPLE_REDIRECT_URI,
        state: "origin:web",
        usePopup: true,
      });
    }
  }, []);

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

  // --- APPLE SIGN-IN HANDLER ---
  const handleAppleLogin = async () => {
    try {
      setFormState((prev) => ({ ...prev, loading: true }));

      const response = await window.AppleID.auth.signIn();
      const identityToken = response.authorization.id_token;

      // Apple only returns user object on the very first sign-in
      let fullName = "";
      if (response.user) {
        fullName =
          `${response.user.name.firstName} ${response.user.name.lastName}`.trim();
      }

      const res = await axiosInstance.post(API_PATHS.APPLE.LOGIN, {
        // Update path based on your routes
        identityToken,
        fullName,
      });

      finalizeLogin(res.data);
    } catch (error) {
      console.error("Apple Login Error:", error);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Failed to sign in with Apple." },
      }));
    }
  };

  // --- PASSKEY SIGN-IN HANDLER ---
  const handlePasskeyLogin = async () => {
    try {
      setFormState((prev) => ({ ...prev, loading: true, errors: {} }));

      // 1. Get authentication options from backend
      const startRes = await axiosInstance.post(API_PATHS.PASSKEY.LOGIN_START, {
        email: formData.email,
      });

      // 2. Trigger browser's WebAuthn prompt
      const authResp = await startAuthentication(startRes.data);

      // 3. Send response back to backend for verification
      const finishRes = await axiosInstance.post(
        API_PATHS.PASSKEY.LOGIN_FINISH,
        {
          email: formData.email,
          response: authResp,
        },
      );

      if (finishRes.data.verified) {
        login(finishRes.data.token);

        // Fetch user profile to get their role for redirection
        const meRes = await axiosInstance.get("/api/auth/me");

        finalizeLogin({ token: finishRes.data.token, role: meRes.data.role });
      }
    } catch (error) {
      console.error("Passkey Login Error:", error);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            error?.response?.data?.error ||
            "Passkey authentication failed or cancelled.",
        },
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

      if (userHasPassword) {
        setStep(1);
      } else {
        await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
          email: formData.email,
        });
        setStep(2);
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

      if (!hasPassword) {
        login(response.data.token);
        setStep(3);
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
      await axiosInstance.put(API_PATHS.AUTH.SET_NEW_PASSWORD, {
        password: formData.newPassword,
      });

      const meRes = await axiosInstance.get(API_PATHS.AUTH.GET_PROFILE);
      finalizeLogin({ role: meRes.data.role, token: null });
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
    if (data.token) login(data.token);

    const role = data.role;

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

        {formState.errors.submit && step === 0 && (
          <div className='mb-6 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2'>
            <AlertCircle className='w-4 h-4 text-red-600 shrink-0' />
            <p className='text-red-600 text-sm font-medium'>
              {formState.errors.submit}
            </p>
          </div>
        )}

        <AnimatePresence mode='wait'>
          {/* --- STEP 0: EMAIL INPUT & APPLE LOGIN --- */}
          {step === 0 && (
            <motion.div
              key='step0'
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-6'>
              <form onSubmit={handleEmailSubmit} className='space-y-6'>
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
              </form>

              {/* Apple Sign-In Divider */}
              <div className='flex items-center gap-3 my-6'>
                <div className='h-px bg-gray-200 flex-1'></div>
                <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                  OR
                </span>
                <div className='h-px bg-gray-200 flex-1'></div>
              </div>

              {/* Apple Sign-In Button */}
              <button
                type='button'
                onClick={handleAppleLogin}
                disabled={formState.loading}
                className='w-full bg-black text-white px-6 py-3.5 rounded-xl font-medium hover:bg-gray-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50'>
                {/* Standard Apple SVG Icon */}
                <svg viewBox='0 0 384 512' className='w-5 h-5 fill-current'>
                  <path d='M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8.8 245.8c-10.4 41.8-6.4 96.6 22.8 141.2 16.4 25.1 39.1 52.5 67.2 51.5 26.6-1.1 36.6-17.1 68.7-17.1 32 0 41.4 17.1 69.1 16.7 29.1-.4 49-25.1 65.2-48.8 19-27.8 26.9-54.8 27.5-56.2-.2-.2-41.5-15.6-41.8-64.4zM263.2 89.6c14.6-17.8 24.5-42.6 21.8-67.6-20.8 1.1-47.1 14.3-62.3 32.1-13.4 15.6-24.8 41.3-21.6 65.4 23.3 1.9 47.5-12.1 62.1-29.9z' />
                </svg>
                Sign in with Apple
              </button>
            </motion.div>
          )}

          {/* --- STEP 1: PASSWORD & PASSKEY LOGIN --- */}
          {step === 1 && (
            <motion.div
              key='step1'
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className='space-y-6'>
              <form onSubmit={handlePasswordSubmit} className='space-y-6'>
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
                    <AlertCircle className='w-4 h-4 text-red-600 shrink-0' />
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
              </form>

              {/* Passkey Login Button */}
              <div className='flex flex-col gap-4'>
                <div className='flex items-center gap-3 mt-2'>
                  <div className='h-px bg-gray-200 flex-1'></div>
                  <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
                    OR
                  </span>
                  <div className='h-px bg-gray-200 flex-1'></div>
                </div>

                <button
                  type='button'
                  onClick={handlePasskeyLogin}
                  disabled={formState.loading}
                  className='w-full bg-white border border-gray-200 text-gray-800 px-6 py-3.5 rounded-xl font-bold hover:bg-gray-50 hover:border-emerald-300 transition-all flex items-center justify-center gap-3 disabled:opacity-50'>
                  <Fingerprint className='w-5 h-5 text-emerald-600' />
                  Sign in with Passkey
                </button>
              </div>
            </motion.div>
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

          {/* --- STEP 3: CREATE PASSWORD --- */}
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
                  <AlertCircle className='w-4 h-4 text-red-600 shrink-0' />
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
