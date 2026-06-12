import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Ticket,
  ShoppingBag,
  AlertTriangle,
  Edit2,
  AlertCircle,
  Share2,
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
  const [fetchingPasses, setFetchingPasses] = useState(true);
  const [error, setError] = useState("");
  const [showMarketplace, setShowMarketplace] = useState(false);
  const [classPassMap, setClassPassMap] = useState({});
  const [editingClassId, setEditingClassId] = useState(null);

  const fetchPasses = async () => {
    setFetchingPasses(true);
    try {
      const res = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id),
      );
      const activePasses = res.data.filter(
        (ps) =>
          ps.isActive &&
          ps.remainingCredits > 0 &&
          new Date(ps.expiryDate) > new Date(),
      );
      setPasses(activePasses);
      autoAssignPasses(activePasses, classes);
    } catch (err) {
      console.error("Failed to fetch passes", err);
      setError("Could not load packages.");
    } finally {
      setFetchingPasses(false);
    }
  };

  const autoAssignPasses = (availablePasses, cartClasses) => {
    const newMap = {};
    const virtualCredits = availablePasses.reduce((acc, p) => {
      acc[p._id] = p.remainingCredits;
      return acc;
    }, {});

    const sortedPasses = [...availablePasses].sort(
      (a, b) => new Date(a.expiryDate) - new Date(b.expiryDate),
    );

    cartClasses.forEach((cls) => {
      const validPass = sortedPasses.find((p) => {
        const matchesClass = p.classType.includes(cls.classType);
        const matchesInstructor = p.instructorType.includes(cls.instructorType);
        const matchesStudio =
          p.issuingStudio._id === (cls.studioId?._id || cls.studioId);
        const hasCredits = virtualCredits[p._id] > 0;
        return matchesClass && matchesInstructor && matchesStudio && hasCredits;
      });

      if (validPass) {
        newMap[cls._id] = validPass._id;
        virtualCredits[validPass._id] -= 1;
      } else {
        newMap[cls._id] = null;
      }
    });

    setClassPassMap(newMap);
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

  const getAvailableCreditsForClass = (passId, targetClassId) => {
    const pass = passes.find((p) => p._id === passId);
    if (!pass) return 0;
    let usedCredits = 0;
    Object.entries(classPassMap).forEach(([cId, pId]) => {
      if (pId === passId && cId !== targetClassId) usedCredits += 1;
    });
    return pass.remainingCredits - usedCredits;
  };

  const getEligiblePassesForClass = (cls) => {
    return passes.filter((p) => {
      const matchesClass = p.classType.includes(cls.classType);
      const matchesInstructor = p.instructorType.includes(cls.instructorType);
      const matchesStudio =
        p.issuingStudio._id === (cls.studioId?._id || cls.studioId);
      return matchesClass && matchesInstructor && matchesStudio;
    });
  };

  const handleManualPassChange = (classId, passId) => {
    setClassPassMap((prev) => ({ ...prev, [classId]: passId }));
    setEditingClassId(null);
  };

  const handleBook = async () => {
    if (Object.values(classPassMap).some((passId) => !passId)) {
      return setError("Please select a valid pass for all classes.");
    }

    setLoading(true);
    setError("");

    try {
      for (const cls of classes) {
        const assignedPassId = classPassMap[cls._id];
        try {
          await axiosInstance.post(API_PATHS.BOOKING.CREATE_BOOKING, {
            classId: cls._id,
            passId: assignedPassId,
            targetUserId: user._id,
          });
        } catch (err) {
          throw new Error(
            `Failed to book ${cls.className}: ${err.response?.data?.error || "Unknown error"}`,
          );
        }
      }
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

  const isCartFullyCovered = Object.values(classPassMap).every(
    (val) => val !== null,
  );
  const classesMissingPasses = Object.values(classPassMap).filter(
    (val) => val === null,
  ).length;

  const firstMissingClass = classes.find((c) => classPassMap[c._id] === null);

  const checkIsShared = (passUserId) => {
    if (!passUserId) return false;
    const ownerId =
      typeof passUserId === "object" ? passUserId._id : passUserId;
    return ownerId !== user._id;
  };

  return (
    <>
      {/* Overlay: Bottom sheet on mobile, centered modal on desktop */}
      <div className='fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
        {/* Modal Container */}
        <div className='bg-white w-full max-w-lg rounded-t-[2rem] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] md:max-h-[85vh] animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0'>
          {/* Mobile Handle Indicator */}
          <div className='w-12 h-1.5 bg-gray-200 rounded-full mx-auto mt-3 hidden max-md:block shrink-0' />

          {/* Header */}
          <div className='p-4 md:p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0'>
            <div>
              <h2 className='text-xl font-bold text-gray-900'>
                Confirm Booking
              </h2>
              <p className='text-sm text-gray-500 mt-1'>
                {classes.length} {classes.length > 1 ? "Classes" : "Class"}{" "}
                Selected
              </p>
            </div>
            <button
              onClick={onClose}
              className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
              <X className='w-6 h-6 md:w-5 md:h-5 text-gray-500' />
            </button>
          </div>

          {/* Body */}
          <div className='p-4 md:p-6 overflow-y-auto flex-1 custom-scrollbar overscroll-contain'>
            {fetchingPasses ? (
              <div className='text-center py-10 flex flex-col items-center'>
                <div className='w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3'></div>
                <p className='text-sm text-gray-500 font-medium'>
                  Calculating passes...
                </p>
              </div>
            ) : (
              <div className='space-y-5 md:space-y-6'>
                {classes.map((cls) => {
                  const assignedPassId = classPassMap[cls._id];
                  const assignedPass = passes.find(
                    (p) => p._id === assignedPassId,
                  );
                  const isEditing = editingClassId === cls._id;
                  const eligiblePasses = getEligiblePassesForClass(cls);
                  const isAssignedShared =
                    assignedPass && checkIsShared(assignedPass.userId);

                  return (
                    <div
                      key={cls._id}
                      className={`rounded-2xl border transition-all ${assignedPass ? "border-gray-200" : "border-red-200 bg-red-50/30"}`}>
                      {/* Class Details */}
                      <div className='p-4 border-b border-gray-100/50 bg-gray-50/50 rounded-t-2xl flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3'>
                        <div>
                          <h3 className='font-bold text-gray-900 text-base'>
                            {cls.className}
                          </h3>
                          <div className='flex items-center gap-2 mt-1 text-sm text-gray-500'>
                            <Clock className='w-4 h-4' />
                            {format(
                              new Date(cls.startTime),
                              "EEE, d MMM • h:mm a",
                            )}
                          </div>
                        </div>
                        <div className='flex flex-row sm:flex-col items-center sm:items-end gap-2'>
                          <span className='text-[11px] md:text-xs font-bold px-2 py-1 rounded-md bg-white border border-gray-200 text-gray-600 uppercase tracking-wider'>
                            {cls.classType}
                          </span>
                          <span className='text-[11px] md:text-xs font-bold px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 uppercase tracking-wider'>
                            {cls.instructorType}
                          </span>
                        </div>
                      </div>

                      <div className='p-4'>
                        {/* Assigned Pass State */}
                        {!isEditing && assignedPass && (
                          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50 border border-emerald-100 p-3.5 md:p-3 rounded-xl'>
                            <div className='flex items-center gap-3'>
                              <div className='bg-emerald-600 text-white p-2 md:p-1.5 rounded-lg shrink-0'>
                                <Ticket className='w-5 h-5 md:w-4 md:h-4' />
                              </div>
                              <div>
                                <div className='flex items-center gap-2 flex-wrap'>
                                  <p className='text-sm md:text-base font-bold text-emerald-900'>
                                    {assignedPass.packageId?.packageName}
                                  </p>
                                  {isAssignedShared && (
                                    <span className='px-1.5 py-0.5 bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold uppercase rounded flex items-center gap-1'>
                                      <Share2 className='w-3 h-3 md:w-2.5 md:h-2.5' />{" "}
                                      Shared
                                    </span>
                                  )}
                                </div>
                                <p className='text-xs md:text-sm text-emerald-700 mt-0.5'>
                                  Exp:{" "}
                                  {format(
                                    new Date(assignedPass.expiryDate),
                                    "dd MMM yyyy",
                                  )}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingClassId(cls._id)}
                              className='text-sm md:text-xs font-bold text-emerald-600 hover:text-emerald-800 flex justify-center items-center gap-1 bg-white px-3 py-2 md:px-2 md:py-1 rounded-lg border border-emerald-200 transition-colors w-full sm:w-auto'>
                              <Edit2 className='w-4 h-4 md:w-3 md:h-3' /> Change
                            </button>
                          </div>
                        )}

                        {/* Missing Pass State */}
                        {!isEditing && !assignedPass && (
                          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-red-50 border border-red-100 p-4 md:p-3 rounded-xl'>
                            <div className='flex items-center gap-3 text-red-700'>
                              <AlertCircle className='w-6 h-6 md:w-5 md:h-5 shrink-0' />
                              <p className='text-sm md:text-base font-bold'>
                                No valid pass available
                              </p>
                            </div>
                            {eligiblePasses.length > 0 && (
                              <button
                                onClick={() => setEditingClassId(cls._id)}
                                className='text-sm md:text-xs font-bold text-red-600 underline w-full sm:w-auto text-left sm:text-right'>
                                View Options
                              </button>
                            )}
                          </div>
                        )}

                        {/* Pass Selection (Editing) State */}
                        {isEditing && (
                          <div className='space-y-3 animate-in slide-in-from-top-2'>
                            <div className='flex items-center justify-between mb-2'>
                              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                                Select Pass for this class
                              </p>
                              <button
                                onClick={() => setEditingClassId(null)}
                                className='text-sm md:text-xs text-gray-400 hover:text-gray-600 py-1 px-2'>
                                Cancel
                              </button>
                            </div>
                            {eligiblePasses.map((pass) => {
                              const availableCredits =
                                getAvailableCreditsForClass(pass._id, cls._id);
                              const isSelectable =
                                availableCredits > 0 ||
                                assignedPassId === pass._id;
                              const isPassShared = checkIsShared(pass.userId);

                              return (
                                <label
                                  key={pass._id}
                                  className={`flex items-center justify-between p-4 md:p-3 rounded-xl border cursor-pointer transition-all ${assignedPassId === pass._id ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500" : isSelectable ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 bg-gray-50 opacity-50"}`}>
                                  <div className='flex items-center gap-4 md:gap-3'>
                                    <input
                                      type='radio'
                                      name={`pass-${cls._id}`}
                                      className='accent-emerald-600 w-5 h-5 md:w-4 md:h-4 shrink-0'
                                      checked={assignedPassId === pass._id}
                                      onChange={() =>
                                        isSelectable &&
                                        handleManualPassChange(
                                          cls._id,
                                          pass._id,
                                        )
                                      }
                                      disabled={!isSelectable}
                                    />
                                    <div>
                                      <div className='flex items-center gap-2 flex-wrap'>
                                        <p className='text-sm md:text-base font-bold text-gray-900'>
                                          {pass.packageId?.packageName}
                                        </p>
                                        {isPassShared && (
                                          <span className='px-1.5 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 text-[10px] font-bold uppercase rounded flex items-center gap-1'>
                                            <Share2 className='w-3 h-3 md:w-2.5 md:h-2.5' />{" "}
                                            Shared
                                          </span>
                                        )}
                                      </div>
                                      <p className='text-xs text-gray-500 mt-0.5'>
                                        Exp:{" "}
                                        {format(
                                          new Date(pass.expiryDate),
                                          "dd MMM yyyy",
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className='text-right shrink-0'>
                                    <p
                                      className={`text-base md:text-sm font-bold ${availableCredits > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                      {availableCredits}
                                    </p>
                                    <p className='text-[10px] md:text-xs text-gray-400 uppercase tracking-wider'>
                                      Left
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                            {eligiblePasses.length === 0 && (
                              <p className='text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-xl'>
                                You have no packages that meet the requirements
                                for this class.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {error && (
              <div className='mt-6 bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 text-red-600 text-sm'>
                <AlertTriangle className='w-5 h-5 shrink-0 mt-0.5' />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className='p-4 md:p-6 border-t border-gray-100 bg-white shrink-0 pb-safe md:pb-6'>
            {!fetchingPasses &&
              (isCartFullyCovered ? (
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className='w-full py-4 text-base bg-gray-900 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 shadow-lg transition-colors flex items-center justify-center gap-2'>
                  {loading ? (
                    <>
                      <div className='w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin'></div>{" "}
                      Processing...
                    </>
                  ) : (
                    <>
                      Confirm Booking ({classes.length}{" "}
                      {classes.length > 1 ? "Credits" : "Credit"})
                    </>
                  )}
                </button>
              ) : (
                <div className='space-y-3'>
                  <p className='text-sm text-red-600 font-medium text-center'>
                    You are short on credits for {classesMissingPasses}{" "}
                    {classesMissingPasses > 1 ? "classes" : "class"}.
                  </p>
                  <button
                    onClick={() => setShowMarketplace(true)}
                    className='w-full py-4 text-base bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg flex items-center justify-center gap-2 transition-colors'>
                    <ShoppingBag className='w-5 h-5' /> Buy More Credits
                  </button>
                </div>
              ))}
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
          requiredInstructorType={firstMissingClass?.instructorType}
          requiredClassType={firstMissingClass?.classType}
          requiredStudioId={
            firstMissingClass?.studioId?._id || firstMissingClass?.studioId
          }
        />
      )}
    </>
  );
};

export default BookingModal;
