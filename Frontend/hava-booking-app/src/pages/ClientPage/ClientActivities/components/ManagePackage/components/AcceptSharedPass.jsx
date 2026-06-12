import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  AlertCircle,
  ShoppingBag,
  Layers,
  Calendar,
  ArrowRight,
  Ticket,
} from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../../context/AuthContext";
import LoadingSpinner from "../../../../../../components/LoadingSpinner";

const AcceptSharedPass = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [passDetails, setPassDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchPassDetails = async () => {
      try {
        const res = await axiosInstance.get(`/api/passes/shared/${code}`);
        setPassDetails(res.data);
      } catch (err) {
        setError(err.response?.data?.message || "Invalid or expired link.");
      } finally {
        setLoading(false);
      }
    };
    fetchPassDetails();
  }, [code]);

  const handleClaimPass = async () => {
    if (!user) {
      return navigate(`/login?returnUrl=/shared-pass/${code}`);
    }

    setClaiming(true);
    try {
      await axiosInstance.post(`/api/passes/shared/${code}/accept`);
      setSuccess(true);
      setTimeout(() => {
        navigate("/client-dashboard");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to claim pass.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    // Use 100dvh to handle mobile browser UI shifts (e.g. Safari address bar)
    <div className='min-h-[100dvh] bg-[#F8FAFC] flex flex-col items-center justify-center p-4 md:p-6'>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className='bg-white rounded-3xl md:rounded-[2rem] shadow-xl md:shadow-2xl border border-gray-100 p-6 md:p-8 max-w-md w-full text-center relative overflow-hidden'>
        {/* Subtle background decoration */}
        <div className='absolute -top-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl opacity-60 pointer-events-none' />

        {error ? (
          <div className='flex flex-col items-center relative z-10 py-4'>
            <div className='w-16 h-16 md:w-20 md:h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-5'>
              <AlertCircle className='w-8 h-8 md:w-10 md:h-10' />
            </div>
            <h2 className='text-2xl md:text-3xl font-extrabold text-gray-900 mb-2'>
              Oops!
            </h2>
            <p className='text-sm md:text-base text-gray-500 mb-8 px-4'>
              {error}
            </p>
            <button
              onClick={() => navigate("/")}
              className='bg-gray-100 text-gray-700 font-bold px-6 py-4 md:py-3.5 rounded-xl hover:bg-gray-200 transition-colors w-full active:scale-[0.98]'>
              Go to Home
            </button>
          </div>
        ) : success ? (
          <div className='flex flex-col items-center relative z-10 py-4'>
            <div className='w-20 h-20 md:w-24 md:h-24 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-5'>
              <CheckCircle2 className='w-10 h-10 md:w-12 md:h-12' />
            </div>
            <h2 className='text-2xl md:text-3xl font-extrabold text-gray-900 mb-2'>
              Pass Claimed!
            </h2>
            <p className='text-sm md:text-base text-gray-500 mb-8 px-4'>
              The package has been successfully added to your account.
            </p>
            <div className='flex items-center justify-center gap-2 text-xs md:text-sm font-bold text-emerald-600 bg-emerald-50 py-2 px-4 rounded-full animate-pulse'>
              <div className='w-1.5 h-1.5 bg-emerald-600 rounded-full' />
              Redirecting to dashboard...
            </div>
          </div>
        ) : (
          <div className='relative z-10'>
            <div className='w-16 h-16 md:w-20 md:h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 md:mb-6 border border-emerald-100 shadow-inner'>
              <Ticket className='w-8 h-8 md:w-10 md:h-10 transform -rotate-45' />
            </div>

            <h2 className='text-2xl md:text-[28px] leading-tight font-extrabold text-gray-900 mb-2'>
              You've received a Pass!
            </h2>
            <p className='text-sm md:text-base text-gray-500 mb-6 md:mb-8'>
              <span className='font-bold text-gray-900'>
                {passDetails.userId?.fullName}
              </span>{" "}
              has shared a Pilates package with you.
            </p>

            {/* Ticket-styled Details Box */}
            <div className='relative bg-slate-50 border border-slate-200/60 rounded-2xl p-5 md:p-6 mb-6 md:mb-8 text-left shadow-sm'>
              {/* Ticket Cutouts */}
              <div className='absolute -left-3 top-[55%] -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-200/60 border-l-0' />
              <div className='absolute -right-3 top-[55%] -translate-y-1/2 w-6 h-6 bg-white rounded-full border border-slate-200/60 border-r-0' />

              <div className='mb-5'>
                <p className='text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'>
                  Package Name
                </p>
                <p className='text-base md:text-lg font-bold text-gray-900 leading-tight'>
                  {passDetails.packageId?.packageName}
                </p>
              </div>

              {/* Dashed Line separator for ticket look */}
              <div className='border-t-2 border-dashed border-gray-200 mb-5' />

              <div className='flex gap-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'>
                    <Layers className='w-3.5 h-3.5' /> Credits
                  </div>
                  <p className='text-sm md:text-base font-bold text-emerald-600'>
                    {passDetails.remainingCredits} Available
                  </p>
                </div>
                <div className='flex-1 border-l border-gray-200/60 pl-4'>
                  <div className='flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'>
                    <Calendar className='w-3.5 h-3.5' /> Valid Until
                  </div>
                  <p className='text-sm md:text-base font-bold text-gray-900'>
                    {new Date(passDetails.expiryDate).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" },
                    )}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleClaimPass}
              disabled={claiming}
              className='w-full bg-[#1D3D36] text-white font-bold py-4 md:py-3.5 rounded-xl shadow-lg hover:bg-[#0F2922] transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98]'>
              {claiming
                ? "Processing..."
                : user
                  ? "Claim Pass to My Account"
                  : "Login & Claim Pass"}
              {!claiming && <ArrowRight className='w-4 h-4 md:w-5 md:h-5' />}
            </button>

            {!user && (
              <p className='text-[11px] md:text-xs text-gray-400 mt-4 px-2 leading-relaxed'>
                Don't have an account? You'll be able to create one on the next
                screen.
              </p>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default AcceptSharedPass;
