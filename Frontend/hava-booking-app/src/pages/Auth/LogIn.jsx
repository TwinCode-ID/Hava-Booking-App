import React, { useState, useEffect, useRef } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
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
  Fingerprint,
} from "lucide-react";
import { validateEmail } from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import { startAuthentication } from "@simplewebauthn/browser";

const ROLE_DESTINATIONS = {
  studioAdmin: "/admin-dashboard",
  client: "/client-dashboard",
  devTeam: "/development-dashboard",
};

const getSafeReturnPath = (role) => {
  if (role !== "client") return null;
  const candidate = new URLSearchParams(window.location.search).get(
    "returnUrl",
  );
  return typeof candidate === "string" &&
    /^\/shared-pass\/[A-Za-z0-9_-]{43}$/.test(candidate)
    ? candidate
    : null;
};

const createOAuthState = () => {
  const bytes = new Uint8Array(24);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
};

const Login = () => {
  const { login } = useAuth();
  const appleAuthState = useRef(null);

  if (!appleAuthState.current && window.crypto?.getRandomValues) {
    appleAuthState.current = createOAuthState();
  }

  // Steps: 0 = Email, 1 = Password, 2 = OTP, 3 = Create Password
  const [step, setStep] = useState(0);
  const [hasPassword, setHasPassword] = useState(true);
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendPopup, setShowResendPopup] = useState(false);
  const [preAuthFlow, setPreAuthFlow] = useState(null);

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

  const getPreAuthFlow = (data) => {
    if (
      typeof data?.preAuthToken !== "string" ||
      typeof data?.purpose !== "string"
    ) {
      throw new Error("The server did not return a verification session.");
    }
    return { token: data.preAuthToken, purpose: data.purpose };
  };

  const getOtpFlowPayload = (flow = preAuthFlow) => {
    if (!flow?.token || !flow?.purpose) {
      throw new Error("The verification session has expired.");
    }
    return {
      email: formData.email,
      preAuthToken: flow.token,
      purpose: flow.purpose,
    };
  };

  const restartLogin = () => {
    setPreAuthFlow(null);
    setFormData((prev) => ({ ...prev, password: "", otp: "" }));
    setStep(0);
  };

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

  // --- INITIALIZE THIRD-PARTY LOGINS ---
  useEffect(() => {
    // 1. Initialize Apple Sign In
    if (window.AppleID) {
      window.AppleID.auth.init({
        clientId: import.meta.env.VITE_APPLE_CLIENT_ID,
        scope: "name email",
        redirectURI: import.meta.env.VITE_APPLE_REDIRECT_URI,
        state: appleAuthState.current,
        usePopup: true,
      });
    }

    // 2. Initialize Google Sign In
    const initGoogle = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });

        const googleButtonDiv = document.getElementById("google-button-div");
        if (googleButtonDiv) {
          // Calculate the exact pixel width of the container
          const buttonWidth = googleButtonDiv.offsetWidth;

          window.google.accounts.id.renderButton(googleButtonDiv, {
            theme: "outline",
            size: "large",
            width: buttonWidth, // Use exact pixels instead of "100%"
            locale: "en", // Force the text to English
            text: "signin_with", // Ensure it says "Sign in with Google"
            shape: "rectangular",
            logo_alignment: "center",
          });
        }
      }
    };

    // Small delay to ensure the external script has loaded if it's asynchronous
    setTimeout(initGoogle, 300);
  }, [step]); // Re-run if step changes to ensure the button renders when coming back to step 0

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

  // --- GOOGLE SIGN-IN HANDLER ---
  const handleGoogleResponse = async (response) => {
    try {
      setFormState((prev) => ({ ...prev, loading: true }));

      // response.credential contains the Google Identity Token
      const res = await axiosInstance.post(API_PATHS.GOOGLE.LOGIN, {
        idToken: response.credential,
      });

      await finalizeLogin(res.data);
    } catch {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Failed to sign in with Google." },
      }));
    }
  };

  // --- APPLE SIGN-IN HANDLER ---
  const handleAppleLogin = async () => {
    try {
      setFormState((prev) => ({ ...prev, loading: true }));

      const response = await window.AppleID.auth.signIn();
      if (
        !appleAuthState.current ||
        response.authorization.state !== appleAuthState.current
      ) {
        throw new Error("Apple sign-in state validation failed.");
      }
      const identityToken = response.authorization.id_token;

      let fullName = "";
      if (response.user) {
        fullName =
          `${response.user.name.firstName} ${response.user.name.lastName}`.trim();
      }

      const res = await axiosInstance.post(API_PATHS.APPLE.LOGIN, {
        identityToken,
        fullName,
      });

      await finalizeLogin(res.data);
    } catch {
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

      const startRes = await axiosInstance.post(
        API_PATHS.PASSKEY.LOGIN_START,
        {},
      );
      const { ceremonyId, options } = startRes.data;
      if (typeof ceremonyId !== "string" || !options) {
        throw new Error("The server returned an invalid passkey request.");
      }

      const authResp = await startAuthentication({ optionsJSON: options });

      const finishRes = await axiosInstance.post(
        API_PATHS.PASSKEY.LOGIN_FINISH,
        {
          ceremonyId,
          response: authResp,
        },
      );

      if (!finishRes.data.verified || !finishRes.data.token) {
        throw new Error("Passkey verification failed.");
      }

      await finalizeLogin(finishRes.data);
    } catch (error) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            error?.response?.data?.error ||
            error?.response?.data?.message ||
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
        setPreAuthFlow(null);
        setStep(1);
      } else {
        const flow = getPreAuthFlow(response.data);
        await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
          ...getOtpFlowPayload(flow),
        });
        setPreAuthFlow(flow);
        setStep(2);
        setResendTimer(60);
      }

      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
    } catch {
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
      const loginResponse = await axiosInstance.post(API_PATHS.AUTH.LOGIN, {
        email: formData.email,
        password: formData.password,
      });
      const flow = getPreAuthFlow(loginResponse.data);
      setFormData((prev) => ({ ...prev, password: "" }));
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        ...getOtpFlowPayload(flow),
      });
      setPreAuthFlow(flow);
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
        ...getOtpFlowPayload(),
        otp: formData.otp,
      });
      setPreAuthFlow(null);

      if (!hasPassword) {
        await login(response.data.token);
        setFormData((prev) => ({ ...prev, otp: "" }));
        setStep(3);
        setFormState((prev) => ({ ...prev, loading: false }));
      } else {
        setFormData((prev) => ({ ...prev, otp: "" }));
        await finalizeLogin(response.data);
      }
    } catch (error) {
      const flowExpired =
        error?.response?.data?.code === "INVALID_OTP_FLOW" || !preAuthFlow;
      if (flowExpired) setPreAuthFlow(null);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit: flowExpired
            ? "Verification session expired. Return to sign in and try again."
            : "Invalid or expired OTP.",
        },
      }));
    }
  };

  // --- STEP 3: CREATE PASSWORD ---
  const handleCreatePasswordSubmit = async (e) => {
    e.preventDefault();

    if (formData.newPassword.length < 8) {
      setFormState((prev) => ({
        ...prev,
        errors: { newPassword: "Password must be at least 8 characters" },
      }));
      return;
    }
    if (formData.newPassword.length > 128) {
      setFormState((prev) => ({
        ...prev,
        errors: {
          newPassword: "Password must be no more than 128 characters",
        },
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
      setFormData((prev) => ({
        ...prev,
        newPassword: "",
        confirmPassword: "",
      }));
      await finalizeLogin({ role: meRes.data.role });
    } catch {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "Failed to set password." },
      }));
    }
  };

  const finalizeLogin = async (data) => {
    const authenticatedUser = data.token ? await login(data.token) : null;
    const role = authenticatedUser?.role || data.role;
    const destination = getSafeReturnPath(role) || ROLE_DESTINATIONS[role];

    if (!destination) {
      throw new Error("Unsupported account role.");
    }

    setFormState((prev) => ({ ...prev, loading: false, success: true }));

    setTimeout(() => {
      window.location.assign(destination);
    }, 1500);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0) return;
    setFormState((prev) => ({ ...prev, loading: true }));
    try {
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        ...getOtpFlowPayload(),
      });
      setFormState((prev) => ({ ...prev, loading: false }));
      setResendTimer(60);
      setShowResendPopup(true);
      setTimeout(() => setShowResendPopup(false), 3000);
    } catch (error) {
      const flowExpired =
        error?.response?.data?.code === "INVALID_OTP_FLOW" || !preAuthFlow;
      if (flowExpired) setPreAuthFlow(null);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit: flowExpired
            ? "Verification session expired. Return to sign in and try again."
            : "Failed to resend.",
        },
      }));
    }
  };

  if (formState.success) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-white px-4'>
        <Motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className='bg-white p-10 rounded-3xl shadow-2xl shadow-stone-600/10 border border-stone-100 max-w-md w-full text-center'>
          <div className='w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-5'>
            <CheckCircle className='w-8 h-8 text-stone-800' />
          </div>
          <h2 className='text-2xl font-extrabold text-stone-900 mb-2 tracking-tight'>
            Success!
          </h2>
          <p className='text-stone-500 mb-6'>Redirecting...</p>
          <Loader className='w-6 h-6 animate-spin mx-auto text-stone-800' />
        </Motion.div>
      </div>
    );
  }

  return (
    <div className='min-h-screen w-full flex bg-white'>
      {/* LEFT — BRAND PANEL */}
      <div className='hidden lg:flex lg:w-[44%] relative overflow-hidden bg-stone-50 p-12 flex-col justify-between'>
        <div className='absolute -top-24 -left-24 w-96 h-96 bg-stone-300/30 rounded-full blur-3xl pointer-events-none' />
        <div className='absolute bottom-0 right-0 w-80 h-80 bg-stone-300/30 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none' />

        <div className='relative z-10 max-w-sm'>
          <h1 className='text-stone-800 text-[34px] leading-[1.15] font-extrabold tracking-tight mb-4'>
            Connect with your strongest self.
          </h1>
          <p className='text-stone-600 text-[15px] leading-relaxed'>
            Sign in to book classes, manage passes, and track every session —
            all in one place.
          </p>
        </div>

        <div className='relative z-10 flex items-center gap-4 text-stone-500 text-[11px] font-bold uppercase tracking-widest'>
          <span>500+ Active Students</span>
          <span className='w-1 h-1 rounded-full bg-stone-500/60' />
          <span>25+ Instructors</span>
        </div>
      </div>

      {/* RIGHT — FORM PANEL */}
      <div className='flex-1 flex items-center justify-center px-4 py-10 sm:px-6 lg:px-16 bg-white'>
        <div className='w-full max-w-md relative'>
          {/* Resend Popup */}
          <AnimatePresence>
            {showResendPopup && (
              <Motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -20, opacity: 0 }}
                className='absolute -top-4 left-0 right-0 mx-auto w-max z-20'>
                <div className='bg-stone-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-medium'>
                  <Send className='w-4 h-4 mr-2' /> Code sent!
                </div>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* Header Section */}
          <div className='mb-9'>
            <div className='w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-5'>
              {step === 0 && <User className='w-7 h-7 text-stone-800' />}
              {step === 1 && <Lock className='w-7 h-7 text-stone-800' />}
              {step === 2 && <ShieldCheck className='w-7 h-7 text-stone-800' />}
              {step === 3 && <Key className='w-7 h-7 text-stone-800' />}
            </div>
            <h2 className='text-[28px] font-extrabold text-stone-900 mb-2 tracking-tight'>
              {step === 0
                ? "Welcome back"
                : step === 1
                  ? "Enter password"
                  : step === 2
                    ? "Verification"
                    : "Create password"}
            </h2>
            <p className='text-stone-500 text-[15px]'>
              {step === 0
                ? "Enter your email or use a passkey"
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
            {/* --- STEP 0: EMAIL INPUT & SOCIAL LOGINS --- */}
            {step === 0 && (
              <Motion.div
                key='step0'
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className='space-y-6'>
                <form onSubmit={handleEmailSubmit} className='space-y-6'>
                  <div>
                    <label className='block text-sm font-bold text-stone-700 mb-2'>
                      Email Address
                    </label>
                    <div className='relative'>
                      <Mail className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                      <input
                        type='email'
                        name='email'
                        autoComplete='username'
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-12 py-3.5 rounded-xl border ${
                          formState.errors.email
                            ? "border-red-500"
                            : "border-stone-200"
                        } focus:ring-2 focus:ring-stone-500 outline-none transition-all`}
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
                    className='w-full bg-stone-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
                    {formState.loading ? (
                      <Loader className='w-5 h-5 animate-spin' />
                    ) : (
                      <>
                        Continue <ArrowRight className='w-5 h-5' />
                      </>
                    )}
                  </button>
                </form>

                {/* Social Login Divider */}
                <div className='flex items-center gap-3 my-6'>
                  <div className='h-px bg-stone-200 flex-1'></div>
                  <span className='text-xs font-bold text-stone-400 uppercase tracking-wider'>
                    OR
                  </span>
                  <div className='h-px bg-stone-200 flex-1'></div>
                </div>

                {/* Social Buttons Container */}
                <div className='flex flex-col gap-3 pl-6'>
                  {/* Google Sign-In Target Div */}
                  <div
                    id='google-button-div'
                    className='w-full h-10 flex items-center justify-center overflow-hidden pl-6'></div>

                  {/* Apple Sign-In Button */}
                  <button
                    type='button'
                    onClick={handleAppleLogin}
                    disabled={formState.loading}
                    // Changed h-[52px] to h-[40px] and adjusted padding so it matches Google exactly
                    className='w-100 bg-black text-white px-6 h-10 rounded border border-black font-medium hover:bg-stone-700 transition-all flex items-center justify-center gap-3 disabled:opacity-50'>
                    <svg viewBox='0 0 384 512' className='w-5 h-5 fill-current'>
                      <path d='M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 24 184.8 8.8 245.8c-10.4 41.8-6.4 96.6 22.8 141.2 16.4 25.1 39.1 52.5 67.2 51.5 26.6-1.1 36.6-17.1 68.7-17.1 32 0 41.4 17.1 69.1 16.7 29.1-.4 49-25.1 65.2-48.8 19-27.8 26.9-54.8 27.5-56.2-.2-.2-41.5-15.6-41.8-64.4zM263.2 89.6c14.6-17.8 24.5-42.6 21.8-67.6-20.8 1.1-47.1 14.3-62.3 32.1-13.4 15.6-24.8 41.3-21.6 65.4 23.3 1.9 47.5-12.1 62.1-29.9z' />
                    </svg>
                    Sign in with Apple
                  </button>

                  <button
                    type='button'
                    onClick={handlePasskeyLogin}
                    disabled={formState.loading}
                    className='w-100 bg-white border border-stone-200 text-stone-800 px-6 h-10 rounded font-medium hover:bg-stone-50 hover:border-stone-400 transition-all flex items-center justify-center gap-3 disabled:opacity-50'>
                    <Fingerprint className='w-5 h-5 text-stone-800' />
                    Sign in with Passkey
                  </button>
                </div>

                <p className='text-center text-sm text-stone-600'>
                  Don&apos;t have an account?{" "}
                  <a
                    href='/signup'
                    className='text-stone-900 hover:text-stone-800 font-bold'>
                    Sign up
                  </a>
                </p>
              </Motion.div>
            )}

            {/* --- STEP 1: PASSWORD LOGIN --- */}
            {step === 1 && (
              <Motion.div
                key='step1'
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className='space-y-6'>
                <form onSubmit={handlePasswordSubmit} className='space-y-6'>
                  <div>
                    <label className='block text-sm font-bold text-stone-700 mb-2'>
                      Password
                    </label>
                    <div className='relative'>
                      <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                      <input
                        type={formState.showPassword ? "text" : "password"}
                        name='password'
                        autoComplete='current-password'
                        value={formData.password}
                        maxLength={128}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                          formState.errors.password
                            ? "border-red-500"
                            : "border-stone-200"
                        } focus:ring-2 focus:ring-stone-500 outline-none transition-all`}
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
                        className='absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600'>
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
                      onClick={restartLogin}
                      className='w-12 flex items-center justify-center rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors'>
                      <ArrowLeft className='w-5 h-5 text-stone-600' />
                    </button>
                    <button
                      type='submit'
                      disabled={formState.loading}
                      className='flex-1 bg-stone-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
                      {formState.loading ? (
                        <Loader className='w-5 h-5 animate-spin' />
                      ) : (
                        "Sign In"
                      )}
                    </button>
                  </div>
                </form>
              </Motion.div>
            )}

            {/* --- STEP 2: OTP INPUT --- */}
            {step === 2 && (
              <Motion.form
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
                    autoComplete='one-time-code'
                    inputMode='numeric'
                    value={formData.otp}
                    onChange={handleInputChange}
                    maxLength={6}
                    className={`w-full text-center text-3xl tracking-[0.5em] font-bold py-4 rounded-xl border ${
                      formState.errors.otp
                        ? "border-red-500"
                        : "border-stone-200"
                    } focus:ring-2 focus:ring-stone-500 outline-none transition-all uppercase`}
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
                    onClick={restartLogin}
                    className='w-12 flex items-center justify-center rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors'>
                    <ArrowLeft className='w-5 h-5 text-stone-600' />
                  </button>
                  <button
                    type='submit'
                    disabled={formState.loading}
                    className='flex-1 bg-stone-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
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
                        ? "text-stone-400 cursor-not-allowed"
                        : "text-stone-800 hover:text-stone-900"
                    }`}>
                    {resendTimer > 0
                      ? `Resend code in ${resendTimer}s`
                      : "Resend Code"}
                  </button>
                </div>
              </Motion.form>
            )}

            {/* --- STEP 3: CREATE PASSWORD --- */}
            {step === 3 && (
              <Motion.form
                key='step3'
                onSubmit={handleCreatePasswordSubmit}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className='space-y-5'>
                <div>
                  <label className='block text-sm font-bold text-stone-700 mb-2'>
                    New Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                    <input
                      type={formState.showPassword ? "text" : "password"}
                      name='newPassword'
                      autoComplete='new-password'
                      value={formData.newPassword}
                      maxLength={128}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                        formState.errors.newPassword
                          ? "border-red-500"
                          : "border-stone-200"
                      } focus:ring-2 focus:ring-stone-500 outline-none transition-all`}
                      placeholder='At least 8 characters'
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
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600'>
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
                  <label className='block text-sm font-bold text-stone-700 mb-2'>
                    Confirm Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                    <input
                      type={formState.showPassword ? "text" : "password"}
                      name='confirmPassword'
                      autoComplete='new-password'
                      value={formData.confirmPassword}
                      maxLength={128}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                        formState.errors.confirmPassword
                          ? "border-red-500"
                          : "border-stone-200"
                      } focus:ring-2 focus:ring-stone-500 outline-none transition-all`}
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
                  className='w-full bg-stone-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
                  {formState.loading ? (
                    <Loader className='w-5 h-5 animate-spin' />
                  ) : (
                    "Set Password & Login"
                  )}
                </button>
              </Motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Login;
