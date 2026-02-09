import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Ticket,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import { useAuth } from "../../../../../../context/AuthContext";
import MarketplaceModal from "./MarketplaceModal";

const BookingModal = ({ classes, onClose, onConfirm }) => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [passes, setPasses] = useState([]);
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [fetchingPasses, setFetchingPasses] = useState(true);
  const [error, setError] = useState("");
  const [showMarketplace, setShowMarketplace] = useState(false);

  // --- ANALYSIS: Check consistency of selected classes ---
  const firstClass = classes[0];
  const isUniformType = classes.every(
    (c) => c.classType === firstClass.classType,
  );
  const isUniformInstructor = classes.every(
    (c) => c.instructorType === firstClass.instructorType,
  );
  const totalCreditsNeeded = classes.length;

  const fetchPasses = async () => {
    setFetchingPasses(true);
    try {
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id),
      );
      const activePasses = res.data.filter(
        (ps) => ps.isActive && ps.remainingCredits > 0,
      );
      setPasses(activePasses);

      // Auto-select best pass
      const bestPass = activePasses.find((p) => {
        // Pass must cover ALL selected classes
        // Simplification: Check against the first class requirements
        const validClass = p.classType.includes(firstClass.classType);
        const validInstr = p.instructorType.includes(firstClass.instructorType);
        const validStudio = p.issuingStudio._id === firstClass.studioId._id;
        const enoughCredits = p.remainingCredits >= totalCreditsNeeded;

        return validClass && validInstr && validStudio && enoughCredits;
      });

      if (bestPass) setSelectedPassId(bestPass._id);
    } catch (err) {
      console.error("Failed to fetch passes", err);
      setError("Could not load packages.");
    } finally {
      setFetchingPasses(false);
    }
  };

  useEffect(() => {
    fetchPasses();
    const handleUpdate = () => {
      setShowMarketplace(false);
      fetchPasses();
    };
    window.addEventListener("credits-updated", handleUpdate);
    return () => window.removeEventListener("credits-updated", handleUpdate);
  }, []);

  const handleBook = async () => {
    if (!selectedPassId) return setError("Select a pass.");
    setLoading(true);
    setError("");

    try {
      // --- FIX: Execute bookings SEQUENTIALLY ---
      // We use a for...of loop instead of Promise.all to prevent database write conflicts
      // (VersionError) when updating the same pass multiple times in milliseconds.

      for (const cls of classes) {
        try {
          await axiosInstance.post(API_PATHS.BOOKING.CREATE_BOOKING, {
            classId: cls._id,
            passId: selectedPassId,
          });
        } catch (err) {
          // If a specific booking fails (e.g. class full), stop and alert
          console.error(`Booking failed for ${cls.className}`, err);
          throw new Error(
            `Failed to book ${cls.className}: ${err.response?.data?.error || "Unknown error"}`,
          );
        }
      }

      // If loop finishes, all good
      onConfirm();
    } catch (err) {
      console.error(err);
      setError(
        err.message || "Some bookings failed. Please check your schedule.",
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter valid passes that have enough credits
  const validPasses = passes.filter((p) => {
    return (
      p.classType.includes(firstClass.classType) &&
      p.instructorType.includes(firstClass.instructorType)
    );
  });

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
        <div className='bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
          {/* Header */}
          <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
            <div>
              <h2 className='text-xl font-bold text-gray-900'>
                Confirm Booking
              </h2>
              <p className='text-xs text-gray-500 mt-1'>
                {classes.length} {classes.length > 1 ? "Classes" : "Class"}{" "}
                Selected
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-200 rounded-full'>
              <X className='w-5 h-5 text-gray-500' />
            </button>
          </div>

          <div className='p-6 overflow-y-auto flex-1'>
            {/* List of Classes */}
            <div className='bg-gray-50 rounded-xl p-4 mb-6 border border-gray-100 max-h-48 overflow-y-auto'>
              <div className='space-y-3'>
                {classes.map((c, i) => (
                  <div
                    key={i}
                    className='flex justify-between items-start text-sm'>
                    <div>
                      <p className='font-bold text-gray-800'>{c.className}</p>
                      <p className='text-xs text-gray-500'>
                        {format(new Date(c.startTime), "EEE, d MMM • h:mm a")}
                      </p>
                    </div>
                    <span className='text-[10px] bg-white border border-gray-200 px-2 py-1 rounded text-gray-500 font-medium'>
                      {c.classType}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning if Mixed Types */}
            {(!isUniformType || !isUniformInstructor) && (
              <div className='mb-6 bg-amber-50 p-3 rounded-xl border border-amber-100 flex gap-3'>
                <AlertTriangle className='w-5 h-5 text-amber-600 shrink-0' />
                <p className='text-xs text-amber-800 leading-relaxed'>
                  You selected mixed class types. Ensure your pass covers{" "}
                  <strong>all</strong> of them, or book separately.
                </p>
              </div>
            )}

            {/* Pass Selection */}
            <div className='mb-6'>
              <h3 className='text-sm font-bold text-gray-900 mb-3 flex items-center gap-2'>
                <Ticket className='w-4 h-4 text-emerald-600' /> Select Package
              </h3>

              {fetchingPasses ? (
                <div className='text-center py-4 text-xs text-gray-400'>
                  Loading...
                </div>
              ) : validPasses.length > 0 ? (
                <div className='space-y-2'>
                  {validPasses.map((pass) => {
                    const hasEnough =
                      pass.remainingCredits >= totalCreditsNeeded;
                    return (
                      <label
                        key={pass._id}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedPassId === pass._id ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20" : hasEnough ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 bg-gray-50 opacity-60"}`}>
                        <div className='flex items-center gap-3'>
                          <input
                            type='radio'
                            name='passSelect'
                            className='accent-emerald-600 w-4 h-4'
                            checked={selectedPassId === pass._id}
                            onChange={() =>
                              hasEnough && setSelectedPassId(pass._id)
                            }
                            disabled={!hasEnough}
                          />
                          <div>
                            <p className='text-sm font-bold text-gray-900'>
                              {pass.packageId?.packageName}
                            </p>
                            <p className='text-xs text-gray-500'>
                              {pass.remainingCredits} Credits Available
                            </p>
                          </div>
                        </div>
                        {!hasEnough && (
                          <span className='text-[10px] text-red-500 font-bold'>
                            Need {totalCreditsNeeded}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className='p-4 bg-red-50 border border-red-100 rounded-xl text-center'>
                  <p className='text-sm text-red-600 font-bold'>
                    No suitable packages
                  </p>
                  <p className='text-xs text-red-500 mt-1'>
                    You need a package with at least{" "}
                    <strong>{totalCreditsNeeded} credits</strong>.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className='text-red-600 text-sm mb-4 text-center bg-red-50 p-2 rounded-lg'>
                {error}
              </p>
            )}

            {validPasses.some(
              (p) => p.remainingCredits >= totalCreditsNeeded,
            ) ? (
              <button
                onClick={handleBook}
                disabled={loading}
                className='w-full py-3.5 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 shadow-lg'>
                {loading
                  ? "Processing..."
                  : `Confirm Booking (${totalCreditsNeeded} Credits)`}
              </button>
            ) : (
              <button
                onClick={() => setShowMarketplace(true)}
                className='w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 shadow-lg flex items-center justify-center gap-2'>
                <ShoppingBag className='w-4 h-4' /> Buy Credits
              </button>
            )}
          </div>
        </div>
      </div>

      {showMarketplace && (
        <MarketplaceModal
          user={user}
          onClose={() => setShowMarketplace(false)}
          onPurchaseSuccess={() => {
            setShowMarketplace(false);
            fetchPasses();
          }}
          requiredInstructorType={firstClass.instructorType}
          requiredClassType={firstClass.classType}
          requiredStudioId={firstClass.studioId._id}
        />
      )}
    </>
  );
};

export default BookingModal;
