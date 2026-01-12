import React, { useState, useEffect } from "react";
import { Save, Loader2, CheckCircle2, X } from "lucide-react";
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

  // Modal State: 'terms' | 'privacy' | null
  const [activeModal, setActiveModal] = useState(null);

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
          API_PATHS.AUTH.MEDICAL_INFO(user._id)
        );

        if (res.data) {
          setHasRecord(true);
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
            termsAndConditions: res.data.termsAndConditions || false,
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
      alert("You must agree to the Terms & Conditions to proceed.");
      return;
    }

    try {
      setSubmitLoading(true);
      if (hasRecord) {
        await axiosInstance.put("/medical-records/update", medical);
      } else {
        await axiosInstance.post("/medical-records/create", medical);
        setHasRecord(true);
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
      <div className='h-[50vh] flex items-center justify-center'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='container mx-auto px-2 md:px-4 py-12 max-w-7xl'>
      <form
        onSubmit={handleSubmit}
        className='grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500'>
        {/* --- COL 1: Personal Details --- */}
        <div className='bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col'>
          <h3 className='text-lg font-bold text-gray-900 mb-6 flex items-center gap-2'>
            <span className='w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold'>
              1
            </span>
            Personal Details
          </h3>

          <div className='space-y-6 flex-1'>
            {/* Date of Birth */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Date of Birth
              </label>
              <input
                type='date'
                required
                value={medical.dateOfBirth}
                onChange={(e) =>
                  setMedical({ ...medical, dateOfBirth: e.target.value })
                }
                className='w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 text-gray-900 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all'
              />
            </div>

            <div className='grid grid-cols-2 gap-4'>
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

            {/* Occupation */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Occupation
              </label>
              <input
                type='text'
                value={medical.occupation}
                onChange={(e) =>
                  setMedical({ ...medical, occupation: e.target.value })
                }
                className='w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all'
                placeholder='e.g. Graphic Designer'
              />
            </div>

            {/* Address */}
            <div>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Address
              </label>
              <textarea
                value={medical.address}
                onChange={(e) =>
                  setMedical({ ...medical, address: e.target.value })
                }
                rows='3'
                className='w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none'
                placeholder='Enter your full address...'
              />
            </div>
          </div>
        </div>

        {/* --- COL 2: Physical Health --- */}
        <div className='bg-white p-6 md:p-8 rounded-2xl border border-gray-100 shadow-sm h-full flex flex-col'>
          <h3 className='text-lg font-bold text-gray-900 mb-6 flex items-center gap-2'>
            <span className='w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm font-bold'>
              2
            </span>
            Physical Health
          </h3>

          <div className='space-y-6 flex-1'>
            <div className='flex-1 flex flex-col'>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Daily Activity
              </label>
              <textarea
                value={medical.dailyActivity}
                onChange={(e) =>
                  setMedical({ ...medical, dailyActivity: e.target.value })
                }
                rows='5'
                placeholder='e.g. Sedentary work, mostly sitting, gym 3x a week...'
                className='w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1'
              />
            </div>

            <div className='flex-1 flex flex-col'>
              <label className='block text-sm font-medium text-gray-700 mb-1.5'>
                Physical Concerns / Injuries
              </label>
              <textarea
                value={medical.physicalConcern}
                onChange={(e) =>
                  setMedical({ ...medical, physicalConcern: e.target.value })
                }
                rows='5'
                placeholder='e.g. Lower back pain, recovering from knee surgery, stiff neck...'
                className='w-full p-3 rounded-xl border border-gray-200 bg-gray-50/50 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none flex-1'
              />
            </div>
          </div>
        </div>

        {/* --- Full Width: Terms & Conditions --- */}
        <div className='lg:col-span-2 bg-gray-50 p-6 rounded-2xl border border-gray-200'>
          <label className='flex items-start gap-4 cursor-pointer group'>
            <div className='relative flex items-center mt-1'>
              <input
                type='checkbox'
                required
                checked={medical.termsAndConditions}
                onChange={(e) =>
                  setMedical({
                    ...medical,
                    termsAndConditions: e.target.checked,
                  })
                }
                className='peer sr-only'
              />
              <div className='w-6 h-6 bg-white border-2 border-gray-300 rounded-lg peer-checked:bg-emerald-600 peer-checked:border-emerald-600 transition-all flex items-center justify-center'>
                <CheckCircle2 className='w-4 h-4 text-white opacity-0 peer-checked:opacity-100 transition-opacity' />
              </div>
            </div>
            <div className='text-sm text-gray-600 leading-relaxed'>
              <span className='font-bold text-gray-900 block mb-1'>
                Agreement & Liability Waiver
              </span>
              I confirm that the information provided above is accurate. I
              understand that physical exercise involves potential risks, and I
              agree to assume full responsibility for any injuries or damages
              incurred. I agree to the{" "}
              <button
                type='button'
                onClick={() => setActiveModal("terms")}
                className='text-emerald-600 font-bold hover:underline focus:outline-none'>
                Terms & Conditions
              </button>{" "}
              and{" "}
              <button
                type='button'
                onClick={() => setActiveModal("privacy")}
                className='text-emerald-600 font-bold hover:underline focus:outline-none'>
                Privacy Policy
              </button>{" "}
              of Hava Booking Service.
            </div>
          </label>
        </div>

        {/* Submit Button */}
        <div className='lg:col-span-2 flex justify-end pt-2'>
          <button
            type='submit'
            disabled={submitLoading}
            className='px-8 py-3.5 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:bg-emerald-400 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-emerald-900/10 hover:shadow-emerald-900/20 transform active:scale-95'>
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

      {/* --- INFO MODALS --- */}
      <AnimatePresence>
        {activeModal && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className='bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]'>
              {/* Modal Header */}
              <div className='flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50'>
                <h3 className='text-lg font-bold text-gray-900'>
                  {activeModal === "terms"
                    ? "Terms & Conditions"
                    : "Privacy Policy"}
                </h3>
                <button
                  onClick={() => setActiveModal(null)}
                  className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
                  <X className='w-5 h-5 text-gray-500' />
                </button>
              </div>

              {/* Modal Content (Blank/Placeholder) */}
              <div className='p-6 overflow-y-auto'>
                {activeModal === "terms" ? (
                  <div className='prose prose-sm text-gray-600'>
                    {/* FILL T&C HERE */}
                    <p className='italic text-gray-400'>
                      [Terms and Conditions Content will be inserted here]
                    </p>
                  </div>
                ) : (
                  <div className='prose prose-sm text-gray-600'>
                    {/* FILL PRIVACY POLICY HERE */}
                    <p className='italic text-gray-400'>
                      [Privacy Policy Content will be inserted here]
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className='p-4 border-t border-gray-100 flex justify-end'>
                <button
                  onClick={() => setActiveModal(null)}
                  className='px-6 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors'>
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
