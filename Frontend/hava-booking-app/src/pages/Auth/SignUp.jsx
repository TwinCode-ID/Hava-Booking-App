import React, { useState, useEffect } from "react";
import { motion as Motion, AnimatePresence } from "framer-motion";
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
  validateNationalPhoneNumber,
  validatePassword,
} from "../../utils/helper";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
// Ensure this path is correct based on your file structure
import uploadProfile from "../../utils/uploadProfile";
import PhoneNumberInput from "../../components/PhoneNumberInput";
import {
  DEFAULT_COUNTRY,
  formatPhoneNumber,
  toE164,
} from "../../utils/countryCodes";

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

const SignUp = () => {
  const { login } = useAuth();

  // Step 0: Register Form, Step 1: OTP Verification
  const [step, setStep] = useState(0);

  // Which contact detail identifies the account. Email registrations verify
  // themselves with a mailbox code; phone registrations cannot, so they are
  // activated by studio staff instead.
  const [identifierType, setIdentifierType] = useState("email");
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [awaitingApproval, setAwaitingApproval] = useState(false);

  // Timer & Popup State
  const [resendTimer, setResendTimer] = useState(0);
  const [showResendPopup, setShowResendPopup] = useState(false);
  const [preAuthFlow, setPreAuthFlow] = useState(null);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    phoneNumber: "",
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

  const restartRegistration = () => {
    setPreAuthFlow(null);
    setFormData((prev) => ({ ...prev, otp: "" }));
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

  const switchIdentifierType = (type) => {
    if (type === identifierType) return;
    setIdentifierType(type);
    setFormState((prev) => ({ ...prev, errors: {} }));
  };

  const validateForm = () => {
    const registeringWithEmail = identifierType === "email";
    const errors = {
      fullName: !formData.fullName ? "Enter full name" : "",
      password: validatePassword(formData.password),
      // An email registration may still carry a number, and it is checked only
      // when one was actually entered.
      email: registeringWithEmail ? validateEmail(formData.email) : "",
      phoneNumber:
        registeringWithEmail && !formData.phoneNumber
          ? ""
          : validateNationalPhoneNumber(formData.phoneNumber),
      avatar: "",
    };

    Object.keys(errors).forEach((key) => {
      if (!errors[key]) delete errors[key];
    });

    setFormState((prev) => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  // Shared tail of every successful route into an account: the avatar can only
  // be uploaded once a session exists and a user id is known.
  const completeSignIn = async (token, fallbackId) => {
    if (!token) {
      throw new Error("Verification did not return an access token.");
    }

    const authenticatedUser = await login(token);
    const userId = authenticatedUser._id || fallbackId;

    if (formData.avatar && userId) {
      try {
        const uploadRes = await uploadProfile(formData.avatar, userId);
        const avatarUrl = uploadRes?.imageUrl || uploadRes?.url || uploadRes;
        if (avatarUrl) {
          await axiosInstance.put(API_PATHS.AUTH.UPDATE_PROFILE, {
            avatar: avatarUrl,
          });
        }
      } catch {
        console.error("Avatar upload/update failed.");
      }
    }

    setFormData((prev) => ({ ...prev, password: "", otp: "" }));
    finalizeLogin({ role: authenticatedUser.role });
  };

  // The number already identifies an account that has never had a password —
  // typically someone the studio added at the front desk. A second account
  // would split their passes and history, and would leave the number matching
  // two accounts, which stops phone sign-in working for either. So the
  // password just chosen is set on the existing account and the member is
  // signed into it.
  const claimExistingAccount = async (grant, phoneNumber, password) => {
    const response = await axiosInstance.post(
      API_PATHS.AUTH.PHONE_SET_PASSWORD,
      { phoneNumber, preAuthToken: grant.preAuthToken, password },
    );
    await completeSignIn(response.data?.token, response.data?._id);
  };

  // --- STEP 0: REGISTER SUBMIT ---
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setFormState((prev) => ({ ...prev, loading: true }));
    let createdFlow = null;

    const submittedPhoneNumber = formData.phoneNumber
      ? toE164(country.dialCode, formData.phoneNumber)
      : "";

    try {
      // 1. Save an expiring registration candidate. The account is created
      // only after the mailbox OTP is verified.
      const response = await axiosInstance.post(API_PATHS.AUTH.REGISTER, {
        fullName: formData.fullName,
        email: identifierType === "email" ? formData.email : "",
        password: formData.password,
        phoneNumber: submittedPhoneNumber,
        avatar: "",
      });

      // The number turned out to belong to an account that has no password
      // yet, so this registration links into it instead of creating another.
      if (response.data?.claimable) {
        await claimExistingAccount(
          response.data,
          submittedPhoneNumber,
          formData.password,
        );
        return;
      }

      // A phone registration has no code to verify. It waits in the studio's
      // approval queue instead, so there is no OTP step to advance to.
      if (identifierType === "phone") {
        setAwaitingApproval(true);
        setFormData((prev) => ({ ...prev, password: "" }));
        setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
        return;
      }

      createdFlow = getPreAuthFlow(response.data);
      setPreAuthFlow(createdFlow);
      setFormData((prev) => ({ ...prev, password: "" }));

      // 3. TRIGGER OTP
      await axiosInstance.post(API_PATHS.AUTH.REQUEST_OTP, {
        ...getOtpFlowPayload(createdFlow),
      });

      // 4. Move to OTP Step
      setStep(1);
      setResendTimer(60);
      setFormState((prev) => ({ ...prev, loading: false, errors: {} }));
    } catch (error) {
      if (createdFlow) {
        setStep(1);
        setResendTimer(error?.response?.data?.retryAfter || 60);
      }
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit:
            (createdFlow
              ? "Your registration was saved, but the code could not be sent. Please retry when resend becomes available."
              : error.response?.data?.message) ||
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
        ...getOtpFlowPayload(),
        otp: formData.otp,
      });
      setPreAuthFlow(null);

      const { token, _id } = response.data;
      await completeSignIn(token, _id);
    } catch (error) {
      const flowExpired =
        error?.response?.data?.code === "INVALID_OTP_FLOW" || !preAuthFlow;
      if (flowExpired) setPreAuthFlow(null);
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: {
          submit: flowExpired
            ? "Verification session expired. Return to registration and submit the form again."
            : "Invalid or expired OTP.",
        },
      }));
    }
  };

  const finalizeLogin = (data) => {
    const destination =
      getSafeReturnPath(data.role) || ROLE_DESTINATIONS[data.role];
    if (!destination) {
      setFormState((prev) => ({
        ...prev,
        loading: false,
        errors: { submit: "This account role is not supported." },
      }));
      return;
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
            ? "Verification session expired. Return to registration and submit the form again."
            : "Failed to resend.",
        },
      }));
    }
  };

  if (awaitingApproval) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-white px-4'>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='bg-white p-10 rounded-3xl shadow-2xl shadow-stone-600/10 border border-stone-100 max-w-md w-full text-center'>
          <div className='w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-5'>
            <ShieldCheck className='w-8 h-8 text-stone-800' />
          </div>
          <h2 className='text-2xl font-extrabold text-stone-900 mb-2 tracking-tight'>
            Almost there
          </h2>
          <p className='text-stone-500 mb-6 leading-relaxed'>
            We saved your details for{" "}
            <span className='font-bold text-stone-800'>
              {formatPhoneNumber(country.dialCode, formData.phoneNumber)}
            </span>
            . Studio staff will activate your account on your next visit — after
            that, sign in with your phone number and the password you just
            chose.
          </p>
          <a
            href='/login'
            className='inline-flex items-center justify-center w-full bg-stone-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-800 transition-all'>
            Back to sign in
          </a>
        </Motion.div>
      </div>
    );
  }

  if (formState.success) {
    return (
      <div className='min-h-screen flex items-center justify-center bg-white px-4'>
        <Motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className='bg-white p-10 rounded-3xl shadow-2xl shadow-stone-600/10 border border-stone-100 max-w-md w-full text-center'>
          <div className='w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center mx-auto mb-5'>
            <CheckCircle className='w-8 h-8 text-stone-800' />
          </div>
          <h2 className='text-2xl font-extrabold text-stone-900 mb-2 tracking-tight'>
            Welcome!
          </h2>
          <p className='text-stone-500 mb-6'>
            Account created & verified. Redirecting...
          </p>
          <div className='animate-spin w-6 h-6 border-2 border-stone-600 border-t-transparent rounded-full mx-auto' />
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
            Join thousands finding their strength.
          </h1>
          <p className='text-stone-600 text-[15px] leading-relaxed'>
            Create your account to book classes, track credits, and manage every
            pass in one place.
          </p>
        </div>

        <div className='relative z-10 flex items-center gap-4 text-stone-500 text-[11px] font-bold uppercase tracking-widest'>
          <span>500+ Active Students</span>
          <span className='w-1 h-1 rounded-full bg-stone-900/60' />
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
                <div className='bg-stone-900 text-white px-4 py-2 rounded-full shadow-lg flex items-center text-sm font-medium'>
                  <Send className='w-4 h-4 mr-2' /> Code sent!
                </div>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* Header */}
          <div className='mb-9'>
            <div className='w-14 h-14 bg-stone-100 rounded-2xl flex items-center justify-center mb-5'>
              {step === 0 ? (
                <User className='w-7 h-7 text-stone-800' />
              ) : (
                <ShieldCheck className='w-7 h-7 text-stone-800' />
              )}
            </div>
            <h2 className='text-[28px] font-extrabold text-stone-900 mb-2 tracking-tight'>
              {step === 0 ? "Create account" : "Verify email"}
            </h2>
            <p className='text-[15px] text-stone-500'>
              {step === 0
                ? "Join thousands finding their strength."
                : `Enter the code sent to ${formData.email}`}
            </p>
          </div>

          <AnimatePresence mode='wait'>
            {/* --- STEP 0: REGISTRATION FORM --- */}
            {step === 0 && (
              <Motion.form
                key='step0'
                onSubmit={handleRegisterSubmit}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className='space-y-5'>
                {/* Identifier type */}
                <div className='grid grid-cols-2 gap-1 p-1 bg-stone-100 rounded-xl'>
                  {["email", "phone"].map((id) => (
                    <button
                      key={id}
                      type='button'
                      onClick={() => switchIdentifierType(id)}
                      aria-pressed={identifierType === id}
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                        identifierType === id
                          ? "bg-white text-stone-900 shadow-sm"
                          : "text-stone-500 hover:text-stone-700"
                      }`}>
                      {id === "email" ? (
                        <Mail className='w-4 h-4' />
                      ) : (
                        <Phone className='w-4 h-4' />
                      )}
                      {id}
                    </button>
                  ))}
                </div>

                {/* Full Name */}
                <div>
                  <label
                    htmlFor='signup-full-name'
                    className='block text-sm font-bold text-stone-700 mb-2'>
                    Full Name
                  </label>
                  <div className='relative'>
                    <User className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                    <input
                      id='signup-full-name'
                      type='text'
                      name='fullName'
                      autoComplete='name'
                      value={formData.fullName}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-4 py-3.5 rounded-xl border ${
                        formState.errors.fullName
                          ? "border-red-500"
                          : "border-stone-200"
                      } focus:ring-2 focus:ring-stone-500 outline-none transition-colors`}
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
                {identifierType === "email" && (
                  <div>
                    <label
                      htmlFor='signup-email'
                      className='block text-sm font-bold text-stone-700 mb-2'>
                      Email Address
                    </label>
                    <div className='relative'>
                      <Mail className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                      <input
                        id='signup-email'
                        type='email'
                        name='email'
                        autoComplete='username'
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full pl-10 pr-4 py-3.5 rounded-xl border ${
                          formState.errors.email
                            ? "border-red-500"
                            : "border-stone-200"
                        } focus:ring-2 focus:ring-stone-500 outline-none transition-colors`}
                        placeholder='name@example.com'
                      />
                    </div>
                    {formState.errors.email && (
                      <p className='text-red-500 text-xs mt-1'>
                        {formState.errors.email}
                      </p>
                    )}
                  </div>
                )}

                {/* Phone */}
                <div>
                  <label
                    htmlFor='signup-phone-number'
                    className='flex items-center justify-between text-sm font-bold text-stone-700 mb-2'>
                    Phone Number
                    {identifierType === "email" && (
                      <span className='font-medium text-stone-400'>
                        Optional
                      </span>
                    )}
                  </label>
                  <PhoneNumberInput
                    inputId='signup-phone-number'
                    country={country}
                    onCountryChange={setCountry}
                    value={formData.phoneNumber}
                    onChange={(nationalNumber) => {
                      setFormData((prev) => ({
                        ...prev,
                        phoneNumber: nationalNumber,
                      }));
                      if (
                        formState.errors.phoneNumber ||
                        formState.errors.submit
                      ) {
                        setFormState((prev) => ({
                          ...prev,
                          errors: {
                            ...prev.errors,
                            phoneNumber: "",
                            submit: "",
                          },
                        }));
                      }
                    }}
                    error={formState.errors.phoneNumber}
                    disabled={formState.loading}
                  />
                  {formState.errors.phoneNumber && (
                    <p className='text-red-500 text-xs mt-1'>
                      {formState.errors.phoneNumber}
                    </p>
                  )}
                  {identifierType === "phone" && (
                    <p className='text-xs text-stone-500 mt-2 leading-relaxed'>
                      Studio staff activate phone registrations in person, so
                      your account becomes usable on your next visit.
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label
                    htmlFor='signup-password'
                    className='block text-sm font-bold text-stone-700 mb-2'>
                    Password
                  </label>
                  <div className='relative'>
                    <Lock className='absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5' />
                    <input
                      id='signup-password'
                      type={formState.showPassword ? "text" : "password"}
                      name='password'
                      autoComplete='new-password'
                      value={formData.password}
                      maxLength={128}
                      onChange={handleInputChange}
                      className={`w-full pl-10 pr-10 py-3.5 rounded-xl border ${
                        formState.errors.password
                          ? "border-red-500"
                          : "border-stone-200"
                      } focus:ring-2 focus:ring-stone-500 outline-none transition-colors`}
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
                      className='absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600'>
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

                {/* Avatar */}
                <div>
                  <label
                    htmlFor='avatar'
                    className='flex items-center justify-between text-sm font-bold text-stone-700 mb-2'>
                    Profile Picture
                    <span className='font-medium text-stone-400'>Optional</span>
                  </label>
                  <div className='flex items-center space-x-4'>
                    <div className='w-14 h-14 rounded-full bg-stone-100 flex items-center justify-center overflow-hidden border border-stone-200'>
                      {formState.avatarPreview ? (
                        <img
                          src={formState.avatarPreview}
                          alt='Preview'
                          className='w-full h-full object-cover'
                        />
                      ) : (
                        <User className='w-6 h-6 text-stone-400' />
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
                        className='cursor-pointer inline-flex items-center px-4 py-2.5 border border-stone-200 rounded-xl text-sm font-bold text-stone-700 bg-white hover:bg-stone-50 transition-colors'>
                        <Upload className='w-4 h-4 mr-2' /> Upload
                      </label>
                    </div>
                  </div>
                </div>

                {formState.errors.submit && (
                  <div className='bg-red-50 border border-red-200 rounded-xl p-3.5'>
                    <p className='text-red-700 text-sm flex items-center'>
                      <AlertCircle className='w-4 h-4 mr-2' />
                      {formState.errors.submit}
                    </p>
                  </div>
                )}

                <button
                  type='submit'
                  disabled={formState.loading}
                  className='w-full bg-stone-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
                  {formState.loading ? (
                    <Loader className='w-5 h-5 animate-spin' />
                  ) : (
                    "Create Account"
                  )}
                </button>

                <p className='text-center text-sm text-stone-600'>
                  Already have an account?{" "}
                  <a
                    href='/login'
                    className='text-stone-900 hover:text-stone-800 font-bold'>
                    Sign in
                  </a>
                </p>
              </Motion.form>
            )}

            {/* --- STEP 1: OTP VERIFICATION --- */}
            {step === 1 && (
              <Motion.form
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
                  <div className='bg-red-50 border border-red-200 rounded-xl p-3.5 text-center text-red-600 text-sm font-medium'>
                    {formState.errors.submit}
                  </div>
                )}

                <div className='flex gap-3'>
                  <button
                    type='button'
                    onClick={restartRegistration}
                    className='w-12 flex items-center justify-center rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors'>
                    <ArrowLeft className='w-5 h-5 text-stone-600' />
                  </button>
                  <button
                    type='submit'
                    disabled={formState.loading}
                    className='flex-1 bg-stone-900 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-stone-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-stone-600/25 disabled:opacity-50'>
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
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
