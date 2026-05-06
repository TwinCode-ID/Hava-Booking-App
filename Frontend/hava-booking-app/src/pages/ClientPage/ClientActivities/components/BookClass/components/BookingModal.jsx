import React, { useState, useEffect } from "react";
import {
  X,
  Clock,
  Ticket,
  ShoppingBag,
  AlertTriangle,
  Edit2,
  AlertCircle,
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
    if (Object.values(classPassMap).some((passId) => passId === null))
      return setError("One or more classes are missing a valid pass.");
    setLoading(true);
    setError("");

    try {
      for (const cls of classes) {
        const assignedPassId = classPassMap[cls._id];
        try {
          await axiosInstance.post(API_PATHS.BOOKING.CREATE_BOOKING, {
            classId: cls._id,
            passId: assignedPassId,
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

  // Identify the exact class missing a pass so we can pre-filter the marketplace
  const firstMissingClass = classes.find((c) => classPassMap[c._id] === null);

  return (
    <>
      <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200'>
        <div className='bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
          <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0'>
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

          <div className='p-6 overflow-y-auto flex-1 custom-scrollbar'>
            {fetchingPasses ? (
              <div className='text-center py-10 flex flex-col items-center'>
                <div className='w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3'></div>
                <p className='text-sm text-gray-500 font-medium'>
                  Calculating passes...
                </p>
              </div>
            ) : (
              <div className='space-y-6'>
                {classes.map((cls) => {
                  const assignedPassId = classPassMap[cls._id];
                  const assignedPass = passes.find(
                    (p) => p._id === assignedPassId,
                  );
                  const isEditing = editingClassId === cls._id;
                  const eligiblePasses = getEligiblePassesForClass(cls);

                  return (
                    <div
                      key={cls._id}
                      className={`rounded-2xl border transition-all ${assignedPass ? "border-gray-200" : "border-red-200 bg-red-50/30"}`}>
                      <div className='p-4 border-b border-gray-100/50 bg-gray-50/50 rounded-t-2xl'>
                        <div className='flex justify-between items-start'>
                          <div>
                            <h3 className='font-bold text-gray-900'>
                              {cls.className}
                            </h3>
                            <div className='flex items-center gap-2 mt-1 text-xs text-gray-500'>
                              <Clock className='w-3.5 h-3.5' />
                              {format(
                                new Date(cls.startTime),
                                "EEE, d MMM • h:mm a",
                              )}
                            </div>
                          </div>
                          <div className='flex flex-col items-end gap-1'>
                            <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-600 uppercase tracking-wider'>
                              {cls.classType}
                            </span>
                            <span className='text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-700 uppercase tracking-wider'>
                              {cls.instructorType}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className='p-4'>
                        {!isEditing && assignedPass && (
                          <div className='flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3 rounded-xl'>
                            <div className='flex items-center gap-3'>
                              <div className='bg-emerald-600 text-white p-1.5 rounded-lg'>
                                <Ticket className='w-4 h-4' />
                              </div>
                              <div>
                                <p className='text-sm font-bold text-emerald-900'>
                                  {assignedPass.packageId?.packageName}
                                </p>
                                <p className='text-xs text-emerald-700 mt-0.5'>
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
                              className='text-xs font-bold text-emerald-600 hover:text-emerald-800 flex items-center gap-1 bg-white px-2 py-1 rounded border border-emerald-200'>
                              <Edit2 className='w-3 h-3' /> Change
                            </button>
                          </div>
                        )}

                        {!isEditing && !assignedPass && (
                          <div className='flex items-center justify-between bg-red-50 border border-red-100 p-3 rounded-xl'>
                            <div className='flex items-center gap-3 text-red-700'>
                              <AlertCircle className='w-5 h-5' />
                              <p className='text-sm font-bold'>
                                No valid pass available
                              </p>
                            </div>
                            {eligiblePasses.length > 0 && (
                              <button
                                onClick={() => setEditingClassId(cls._id)}
                                className='text-xs font-bold text-red-600 underline'>
                                View Options
                              </button>
                            )}
                          </div>
                        )}

                        {isEditing && (
                          <div className='space-y-2 animate-in slide-in-from-top-2'>
                            <div className='flex items-center justify-between mb-2'>
                              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider'>
                                Select Pass for this class
                              </p>
                              <button
                                onClick={() => setEditingClassId(null)}
                                className='text-xs text-gray-400 hover:text-gray-600'>
                                Cancel
                              </button>
                            </div>
                            {eligiblePasses.map((pass) => {
                              const availableCredits =
                                getAvailableCreditsForClass(pass._id, cls._id);
                              const isSelectable =
                                availableCredits > 0 ||
                                assignedPassId === pass._id;
                              return (
                                <label
                                  key={pass._id}
                                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${assignedPassId === pass._id ? "border-emerald-500 bg-emerald-50" : isSelectable ? "border-gray-200 hover:bg-gray-50" : "border-gray-100 bg-gray-50 opacity-50"}`}>
                                  <div className='flex items-center gap-3'>
                                    <input
                                      type='radio'
                                      name={`pass-${cls._id}`}
                                      className='accent-emerald-600 w-4 h-4'
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
                                      <p className='text-sm font-bold text-gray-900'>
                                        {pass.packageId?.packageName}
                                      </p>
                                      <p className='text-xs text-gray-500'>
                                        Exp:{" "}
                                        {format(
                                          new Date(pass.expiryDate),
                                          "dd MMM yyyy",
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                  <div className='text-right'>
                                    <p
                                      className={`text-sm font-bold ${availableCredits > 0 ? "text-emerald-600" : "text-red-500"}`}>
                                      {availableCredits}
                                    </p>
                                    <p className='text-[10px] text-gray-400 uppercase tracking-wider'>
                                      Left
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                            {eligiblePasses.length === 0 && (
                              <p className='text-sm text-gray-500 italic p-2 text-center'>
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
              <div className='mt-6 bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-2 text-red-600 text-sm'>
                <AlertTriangle className='w-5 h-5 shrink-0 mt-0.5' />
                <p>{error}</p>
              </div>
            )}
          </div>

          <div className='p-6 border-t border-gray-100 bg-white shrink-0'>
            {!fetchingPasses &&
              (isCartFullyCovered ? (
                <button
                  onClick={handleBook}
                  disabled={loading}
                  className='w-full py-4 bg-gray-900 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 shadow-lg transition-colors flex items-center justify-center gap-2'>
                  {loading ? (
                    <>
                      <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>{" "}
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
                    className='w-full py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-500 shadow-lg flex items-center justify-center gap-2'>
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
