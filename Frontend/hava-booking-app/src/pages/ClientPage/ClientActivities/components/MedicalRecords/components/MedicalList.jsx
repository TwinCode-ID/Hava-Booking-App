import React, { useState, useEffect } from "react";
import { Save, Loader2, Check, X, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import axiosInstance from "../../../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";
import CustomSelect from "../../../../layout/CustomSelect";
import { API_PATHS } from "../../../../../../utils/apiPath";
import { useAuth } from "../../../../../../context/AuthContext";

const MedicalList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  // Lock state: If true, user cannot uncheck the box anymore
  const [termsLocked, setTermsLocked] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'privacy'
  const [showValidationModal, setShowValidationModal] = useState(false);

  const [medical, setMedical] = useState({
    dateOfBirth: "",
    sex: "",
    maritalStatus: "",
    occupation: "",
    address: "",
    dailyActivity: "",
    physicalConcern: "",
    termsAndConditions: false,
  });

  // --- Fetch Existing Data ---
  useEffect(() => {
    const fetchMedical = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          API_PATHS.AUTH.MEDICAL_INFO(user._id),
        );

        if (res.data) {
          setHasRecord(true);
          const isTermsAccepted = res.data.termsAndConditions || false;

          if (isTermsAccepted) {
            setTermsLocked(true);
          }

          setMedical({
            dateOfBirth: res.data.dateOfBirth
              ? new Date(res.data.dateOfBirth).toISOString().split("T")[0]
              : "",
            sex: res.data.sex || "",
            maritalStatus: res.data.maritalStatus || "",
            occupation: res.data.occupation || "",
            address: res.data.address || "",
            dailyActivity: res.data.dailyActivity || "",
            physicalConcern: res.data.physicalConcern || "",
            termsAndConditions: isTermsAccepted,
          });
        }
      } catch (err) {
        console.log("No existing medical record found.");
      } finally {
        setLoading(false);
      }
    };
    fetchMedical();
  }, [user._id]);

  // --- Handle Submit ---
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!medical.termsAndConditions) {
      setShowValidationModal(true);
      return;
    }

    try {
      setSubmitLoading(true);
      if (hasRecord) {
        await axiosInstance.post(
          API_PATHS.AUTH.MEDICAL_INFO(user._id),
          medical,
        );
      } else {
        await axiosInstance.post(
          API_PATHS.AUTH.MEDICAL_INFO(user._id),
          medical,
        );
        setHasRecord(true);
        setTermsLocked(true); // Lock it immediately after saving
      }
      alert("Medical record saved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save medical record. Please try again.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading)
    return (
      <div className='h-[60vh] flex flex-col items-center justify-center gap-4'>
        <LoadingSpinner />
        <p className='text-gray-500 text-sm font-medium'>
          Loading medical records data...
        </p>
      </div>
    );

  return (
    <div className='container mx-auto px-4 md:px-6 py-8 md:py-12 max-w-7xl'>
      <form
        onSubmit={handleSubmit}
        className='grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500'>
        {/* --- COL 1: Personal Details --- */}
        <div className='bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col'>
          <h3 className='text-base md:text-lg font-bold text-gray-900 mb-5 md:mb-6 flex items-center gap-3'>
            <span className='w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0'>
              1
            </span>
            Personal Details
          </h3>
          <div className='space-y-5 md:space-y-6 flex-1'>
            <div>
              <label className='block text-xs md:text-sm font-bold text-gray-700 mb-1.5'>
                Date of Birth
              </label>
              <input
                type='date'
                required
                value={medical.dateOfBirth}
                onChange={(e) =>
                  setMedical({ ...medical, dateOfBirth: e.target.value })
                }
                className='w-full px-4 py-3.5 md:py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 text-sm md:text-[15px] outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all'
              />
            </div>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-5 md:gap-4'>
              <CustomSelect
                label='Sex'
                value={medical.sex}
                options={["Male", "Female", "Prefer not to say"]}
                placeholder='Gender'
                onChange={(val) => setMedical({ ...medical, sex: val })}
              />
              <CustomSelect
                label='Marital Status'
                value={medical.maritalStatus}
                options={["Single", "Married", "Divorced", "Widowed"]}
                placeholder='Status'
                onChange={(val) =>
                  setMedical({ ...medical, maritalStatus: val })
                }
              />
            </div>
            <div>
              <label className='block text-xs md:text-sm font-bold text-gray-700 mb-1.5'>
                Occupation
              </label>
              <input
                type='text'
                value={medical.occupation}
                onChange={(e) =>
                  setMedical({ ...medical, occupation: e.target.value })
                }
                className='w-full px-4 py-3.5 md:py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm md:text-[15px] outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all'
                placeholder='e.g. Graphic Designer'
              />
            </div>
            <div>
              <label className='block text-xs md:text-sm font-bold text-gray-700 mb-1.5'>
                Address
              </label>
              <textarea
                value={medical.address}
                onChange={(e) =>
                  setMedical({ ...medical, address: e.target.value })
                }
                rows='3'
                className='w-full px-4 py-3.5 md:py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm md:text-[15px] outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none'
                placeholder='Enter your full address...'
              />
            </div>
          </div>
        </div>

        {/* --- COL 2: Physical Health --- */}
        <div className='bg-white p-5 md:p-8 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm h-full flex flex-col'>
          <h3 className='text-base md:text-lg font-bold text-gray-900 mb-5 md:mb-6 flex items-center gap-3'>
            <span className='w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold shrink-0'>
              2
            </span>
            Physical Health
          </h3>
          <div className='space-y-5 md:space-y-6 flex-1 flex flex-col'>
            <div className='flex-1 flex flex-col'>
              <label className='block text-xs md:text-sm font-bold text-gray-700 mb-1.5'>
                Daily Activity
              </label>
              <textarea
                value={medical.dailyActivity}
                onChange={(e) =>
                  setMedical({ ...medical, dailyActivity: e.target.value })
                }
                rows='4'
                placeholder='e.g. Sedentary work, mostly sitting, gym 3x a week...'
                className='w-full px-4 py-3.5 md:py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm md:text-[15px] outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1 min-h-[100px]'
              />
            </div>
            <div className='flex-1 flex flex-col'>
              <label className='block text-xs md:text-sm font-bold text-gray-700 mb-1.5'>
                Physical Concerns / Injuries
              </label>
              <textarea
                value={medical.physicalConcern}
                onChange={(e) =>
                  setMedical({ ...medical, physicalConcern: e.target.value })
                }
                rows='4'
                placeholder='e.g. Lower back pain, recovering from knee surgery, stiff neck...'
                className='w-full px-4 py-3.5 md:py-3 rounded-xl border border-gray-200 bg-gray-50/50 text-sm md:text-[15px] outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1 min-h-[100px]'
              />
            </div>
          </div>
        </div>

        {/* --- Terms & Conditions --- */}
        <div
          className={`lg:col-span-2 bg-gray-50 p-5 md:p-6 rounded-2xl md:rounded-3xl border border-gray-200 ${
            termsLocked ? "opacity-80" : ""
          }`}>
          <label
            className={`flex items-start gap-4 group ${
              termsLocked ? "cursor-default" : "cursor-pointer"
            }`}>
            <div className='relative flex items-center mt-1 shrink-0'>
              <input
                type='checkbox'
                disabled={termsLocked}
                checked={medical.termsAndConditions}
                onChange={(e) => {
                  setMedical({
                    ...medical,
                    termsAndConditions: e.target.checked,
                  });
                  if (e.target.checked) setShowValidationModal(false);
                }}
                className='peer sr-only'
              />
              <div
                className={`w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center shadow-sm ${
                  medical.termsAndConditions || termsLocked
                    ? "bg-emerald-600 border-emerald-600"
                    : "bg-white border-gray-300 group-hover:border-emerald-400"
                }`}>
                <Check
                  strokeWidth={3}
                  className={`w-3.5 h-3.5 text-white transition-transform duration-200 ${
                    medical.termsAndConditions || termsLocked
                      ? "scale-100 opacity-100"
                      : "scale-50 opacity-0"
                  }`}
                />
              </div>
            </div>

            <div className='text-sm text-gray-600 leading-relaxed'>
              <span className='font-bold text-gray-900 flex flex-wrap items-center gap-2 mb-1.5 md:mb-1'>
                Agreement & Liability Waiver
                {termsLocked && (
                  <span className='text-[9px] md:text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md'>
                    Accepted
                  </span>
                )}
              </span>
              I confirm that the information provided above is accurate. I
              understand that physical exercise involves potential risks, and I
              agree to assume full responsibility for any injuries or damages
              incurred. I agree to the{" "}
              <button
                type='button'
                onClick={() => setActiveModal("terms")}
                className='text-emerald-600 font-bold hover:underline focus:outline-none relative z-10'>
                Terms & Conditions
              </button>{" "}
              and{" "}
              <button
                type='button'
                onClick={() => setActiveModal("privacy")}
                className='text-emerald-600 font-bold hover:underline focus:outline-none relative z-10'>
                Privacy Policy
              </button>{" "}
              of Hava Booking Service.
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className='lg:col-span-2 flex justify-end pt-2 pb-safe'>
          <button
            type='submit'
            disabled={submitLoading}
            className='w-full md:w-auto px-8 py-4 md:py-3.5 bg-emerald-700 text-white font-bold rounded-xl md:rounded-2xl hover:bg-emerald-800 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 active:scale-[0.98] md:active:scale-100'>
            {submitLoading ? (
              <>
                <Loader2 className='w-5 h-5 animate-spin' /> Saving...
              </>
            ) : (
              <>
                <Save className='w-5 h-5' /> Save Medical Record
              </>
            )}
          </button>
        </div>
      </form>

      {/* --- VALIDATION MODAL (Mobile Bottom Sheet / Desktop Modal) --- */}
      <AnimatePresence>
        {showValidationModal && (
          <div className='fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-[2px]'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowValidationModal(false)}
              className='absolute inset-0'
            />
            <motion.div
              initial={{ opacity: 0, y: "100%", scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className='relative bg-white w-full max-w-sm rounded-t-[2rem] md:rounded-3xl shadow-2xl p-6 md:p-8 pb-safe md:pb-8 flex flex-col items-center text-center'>
              <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6 hidden max-md:block shrink-0' />

              <div className='w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mb-4 text-red-600 shadow-inner'>
                <AlertTriangle className='w-7 h-7' />
              </div>
              <h3 className='text-lg md:text-xl font-bold text-gray-900 mb-2'>
                Action Required
              </h3>
              <p className='text-gray-600 text-sm mb-8 leading-relaxed'>
                You must agree to the Terms & Conditions and Privacy Policy
                before saving your medical record.
              </p>
              <button
                onClick={() => setShowValidationModal(false)}
                className='w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors active:scale-[0.98] md:active:scale-100 shadow-sm'>
                I Understand
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* --- TEXT MODALS (Terms / Privacy - Mobile Bottom Sheet / Desktop Modal) --- */}
      <AnimatePresence>
        {activeModal && (
          <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModal(null)}
              className='absolute inset-0'
            />
            <motion.div
              initial={{ opacity: 0, y: "100%", scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: "100%", scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className='relative bg-white w-full max-w-2xl rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[80vh]'>
              <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 hidden max-md:block shrink-0' />

              <div className='flex justify-between items-center px-6 md:px-8 py-4 md:py-6 border-b border-gray-100 bg-white shrink-0'>
                <h3 className='text-lg md:text-xl font-bold text-gray-900'>
                  {activeModal === "terms"
                    ? "Terms & Conditions"
                    : "Privacy Policy"}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className='p-2 hover:bg-gray-100 rounded-full transition-colors'>
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>

              <div className='p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar overscroll-contain bg-gray-50/30'>
                <p className='italic text-gray-400'>
                  [
                  {activeModal === "terms"
                    ? "Terms Content"
                    : "Privacy Policy Content"}{" "}
                  Placeholder]
                </p>
              </div>

              <div className='p-4 md:p-6 border-t border-gray-100 flex justify-end bg-white shrink-0 pb-safe'>
                <button
                  onClick={() => setActiveModal(null)}
                  className='w-full md:w-auto px-8 py-3.5 md:py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors active:scale-[0.98] md:active:scale-100 shadow-sm'>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MedicalList;
