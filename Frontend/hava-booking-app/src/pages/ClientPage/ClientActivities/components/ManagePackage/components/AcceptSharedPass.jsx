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
        navigate("/my-passes");
      }, 3000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to claim pass.");
    } finally {
      setClaiming(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className='min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className='bg-white rounded-[24px] shadow-xl border border-gray-100 p-8 max-w-md w-full text-center'>
        {error ? (
          <div className='flex flex-col items-center'>
            <div className='w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4'>
              <AlertCircle className='w-8 h-8' />
            </div>
            <h2 className='text-xl font-extrabold text-gray-900 mb-2'>Oops!</h2>
            <p className='text-sm text-gray-500 mb-6'>{error}</p>
            <button
              onClick={() => navigate("/")}
              className='bg-gray-100 text-gray-700 font-bold px-6 py-3 rounded-xl hover:bg-gray-200 transition-colors w-full'>
              Go to Home
            </button>
          </div>
        ) : success ? (
          <div className='flex flex-col items-center'>
            <div className='w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mb-4'>
              <CheckCircle2 className='w-10 h-10' />
            </div>
            <h2 className='text-2xl font-extrabold text-gray-900 mb-2'>
              Pass Claimed!
            </h2>
            <p className='text-sm text-gray-500 mb-6'>
              The package has been successfully added to your account.
            </p>
            <p className='text-xs text-gray-400 animate-pulse'>
              Redirecting to your dashboard...
            </p>
          </div>
        ) : (
          <div>
            <div className='w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 border border-emerald-100'>
              <ShoppingBag className='w-7 h-7' />
            </div>

            <h2 className='text-2xl font-extrabold text-gray-900 mb-1'>
              You've received a Pass!
            </h2>
            <p className='text-sm text-gray-500 mb-8'>
              <span className='font-bold text-gray-800'>
                {passDetails.userId?.fullName}
              </span>{" "}
              has shared a Pilates package with you.
            </p>

            <div className='bg-slate-50 border border-slate-100 rounded-xl p-5 mb-8 text-left space-y-4'>
              <div>
                <p className='text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                  Package Name
                </p>
                <p className='text-[15px] font-bold text-gray-900'>
                  {passDetails.packageId?.packageName}
                </p>
              </div>

              <div className='flex gap-4 border-t border-gray-200/60 pt-4'>
                <div className='flex-1'>
                  <div className='flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                    <Layers className='w-3.5 h-3.5' /> Credits
                  </div>
                  <p className='text-[15px] font-bold text-emerald-600'>
                    {passDetails.remainingCredits} Available
                  </p>
                </div>
                <div className='flex-1 border-l border-gray-200/60 pl-4'>
                  <div className='flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1'>
                    <Calendar className='w-3.5 h-3.5' /> Valid Until
                  </div>
                  <p className='text-[15px] font-bold text-gray-900'>
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
              className='w-full bg-[#1a4d3e] text-white font-bold py-4 rounded-xl shadow-lg hover:bg-[#133d31] transition-all flex items-center justify-center gap-2 disabled:opacity-50'>
              {claiming
                ? "Processing..."
                : user
                  ? "Claim Pass to My Account"
                  : "Login & Claim Pass"}
              {!claiming && <ArrowRight className='w-4 h-4' />}
            </button>

            {!user && (
              <p className='text-xs text-gray-400 mt-4'>
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
