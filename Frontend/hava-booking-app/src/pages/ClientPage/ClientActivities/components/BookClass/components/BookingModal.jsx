import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Ticket,
  User,
  ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import { useAuth } from "../../../../../../context/AuthContext";
// Import the new modal
import MarketplaceModal from "./MarketplaceModal";

const BookingModal = ({ cls, onClose, onConfirm }) => {
  const { user } = useAuth();

  // --- STATE ---
  const [loading, setLoading] = useState(false);
  const [passes, setPasses] = useState([]);
  const [selectedPassId, setSelectedPassId] = useState(null);
  const [fetchingPasses, setFetchingPasses] = useState(true);
  const [error, setError] = useState("");

  // NEW: State to control the popup visibility
  const [showMarketplace, setShowMarketplace] = useState(false);

  // --- LOGIC ---

  // 1. Refactored Fetch Function (so we can call it again after purchase)
  const fetchPasses = async () => {
    setFetchingPasses(true);
    try {
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id)
      );

      // Filter: Active AND has remaining credits
      const passList = res.data.filter(
        (ps) => ps.isActive && ps.remainingCredits > 0
      );

      setPasses(passList);

      // Auto-select a valid pass for THIS class if one exists
      // This ensures if they just bought one, it gets selected immediately
      const validForThisClass = passList.find(
        (p) =>
          p.classType === cls.classType &&
          p.instructorType === cls.instructorType
      );

      if (validForThisClass) {
        setSelectedPassId(validForThisClass._id);
      }
    } catch (err) {
      console.error("Failed to fetch passes", err);
      setError("Could not load your packages.");
    } finally {
      setFetchingPasses(false);
    }
  };

  // 2. Initial Fetch on Mount
  useEffect(() => {
    fetchPasses();
  }, []);

  // 3. Callback when purchase completes in the popup
  const handlePurchaseComplete = () => {
    setShowMarketplace(false); // Close the popup
    fetchPasses(); // Re-fetch data to show the new credits
  };

  // 4. Booking Logic
  const handleBook = async () => {
    if (!selectedPassId) {
      setError("Please select a pass to use for booking.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axiosInstance.post(API_PATHS.BOOKING.CREATE_BOOKING, {
        classId: cls._id,
        passId: selectedPassId,
      });

      onConfirm();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Booking failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // Filter for UI Display
  const validPasses = passes.filter(
    (pass) =>
      pass.classType === cls.classType &&
      pass.instructorType === cls.instructorType
  );

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
        <div className='bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto'>
          {/* Header */}
          <div className='h-32 bg-emerald-900 relative shrink-0'>
            <button
              onClick={onClose}
              className='absolute top-4 right-4 bg-black/20 hover:bg-black/40 text-white p-2 rounded-full transition-colors backdrop-blur-md'>
              <X className='w-5 h-5' />
            </button>
            <div className='absolute bottom-4 left-6 text-white'>
              <span className='bg-emerald-500/20 backdrop-blur-md border border-emerald-400/30 text-emerald-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 inline-block'>
                {cls.classType}
              </span>
              <h2 className='text-xl font-bold'>{cls.className}</h2>
            </div>
          </div>

          {/* Content */}
          <div className='p-6'>
            {/* Class Info */}
            <div className='space-y-4 mb-6 border-b border-gray-100 pb-6'>
              <div className='flex items-start gap-3 text-gray-600'>
                <Calendar className='w-5 h-5 text-emerald-700 shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-bold text-gray-900'>
                    {format(new Date(cls.startTime), "EEEE, MMMM do, yyyy")}
                  </p>
                  <p className='text-xs'>Date</p>
                </div>
              </div>

              <div className='flex items-start gap-3 text-gray-600'>
                <Clock className='w-5 h-5 text-emerald-700 shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-bold text-gray-900'>
                    {format(new Date(cls.startTime), "h:mm a")} -{" "}
                    {format(new Date(cls.endTime), "h:mm a")}
                  </p>
                  <p className='text-xs'>Time ({cls.duration} mins)</p>
                </div>
              </div>

              <div className='flex items-start gap-3 text-gray-600'>
                <MapPin className='w-5 h-5 text-emerald-700 shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-bold text-gray-900'>
                    {cls.studioId?.studioName}
                  </p>
                  <p className='text-xs'>Location</p>
                </div>
              </div>

              <div className='flex items-start gap-3 text-gray-600'>
                <User className='w-5 h-5 text-emerald-700 shrink-0 mt-0.5' />
                <div>
                  <p className='text-sm font-bold text-gray-900'>
                    {cls.instructorId?.fullName}
                  </p>
                  <p className='text-xs'>Instructor</p>
                </div>
              </div>
            </div>

            {/* Pass Selection Section */}
            <div className='mb-6'>
              <h3 className='text-sm font-bold text-gray-900 mb-3 flex items-center gap-2'>
                <Ticket className='w-4 h-4 text-emerald-600' /> Select Package
              </h3>

              {fetchingPasses ? (
                <div className='text-center py-4 text-xs text-gray-400'>
                  Loading your packages...
                </div>
              ) : validPasses.length > 0 ? (
                <div className='space-y-2 max-h-40 overflow-y-auto pr-1'>
                  {validPasses.map((pass) => (
                    <label
                      key={pass._id}
                      className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedPassId === pass._id
                          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20"
                          : "border-gray-200 hover:border-emerald-200 hover:bg-gray-50"
                      }`}>
                      <div className='flex items-center gap-3'>
                        <input
                          type='radio'
                          name='passSelect'
                          className='accent-emerald-600 w-4 h-4'
                          checked={selectedPassId === pass._id}
                          onChange={() => setSelectedPassId(pass._id)}
                        />
                        <div>
                          <p className='text-sm font-bold text-gray-900'>
                            {pass.packageId?.packageName || "Standard Package"}
                          </p>
                          <p className='text-xs text-gray-500'>
                            {pass.instructorType} Access
                          </p>
                        </div>
                      </div>
                      <div className='text-right'>
                        <span className='block text-xs font-bold bg-white border px-2 py-1 rounded-md text-emerald-700'>
                          {pass.remainingCredits} Credits
                        </span>
                      </div>
                    </label>
                  ))}

                  <div className='bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6'>
                    <p className='text-amber-800 text-xs font-medium flex items-center gap-2'>
                      <CheckCircle2 className='w-4 h-4' />1 Credit will be
                      deducted.
                    </p>
                  </div>
                </div>
              ) : (
                <div className='p-4 bg-red-50 border border-red-100 rounded-xl text-center'>
                  <p className='text-sm text-red-600 font-bold'>
                    Insufficient Credits
                  </p>
                  <p className='text-xs text-red-500 mt-1 mb-3'>
                    You need a <strong>{cls.instructorType}</strong> package to
                    book this class.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <p className='text-red-600 text-sm mb-4 text-center bg-red-50 p-2 rounded-lg border border-red-100'>
                {error}
              </p>
            )}

            {validPasses.length > 0 ? (
              <button
                onClick={handleBook}
                disabled={loading || passes.length === 0}
                className='w-full py-3.5 bg-emerald-900 text-white font-bold rounded-xl hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/10'>
                {loading ? "Confirming..." : "Confirm Booking"}
              </button>
            ) : (
              // This Button now opens the POPUP
              <button
                onClick={() => setShowMarketplace(true)}
                className='w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2'>
                <ShoppingBag className='w-4 h-4' /> Buy Credits Now
              </button>
            )}
          </div>
        </div>
      </div>

      {/* --- RENDER THE MARKETPLACE POPUP CONDITIONALLY --- */}
      {showMarketplace && (
        <MarketplaceModal
          user={user}
          onClose={() => setShowMarketplace(false)}
          onPurchaseSuccess={handlePurchaseComplete}
          requiredInstructorType={cls.instructorType}
          requiredClassType={cls.classType}
        />
      )}
    </>
  );
};

export default BookingModal;
