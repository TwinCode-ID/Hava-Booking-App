import React, { useCallback, useEffect, useState } from "react";
import { Check, Loader, Phone, UserPlus2, X } from "lucide-react";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";

const formatRequestedAt = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

// People who signed up with a phone number alone cannot prove the number is
// theirs, because the studio has no SMS gateway. Staff confirm them in person
// here, and only then does the account exist.
const PendingSignupApprovals = ({ onApproved }) => {
  const [candidates, setCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const loadCandidates = useCallback(async () => {
    try {
      const response = await axiosInstance.get(API_PATHS.AUTH.PENDING_SIGNUPS);
      setCandidates(Array.isArray(response.data) ? response.data : []);
      setError("");
    } catch {
      // Staff without permission simply see nothing, which is why an empty
      // list and a failed load render the same way.
      setCandidates([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  const resolveCandidate = async (candidate, decision) => {
    setBusyId(candidate._id);
    setError("");
    try {
      if (decision === "approve") {
        const response = await axiosInstance.post(
          API_PATHS.AUTH.APPROVE_PENDING_SIGNUP(candidate._id),
          { isStudent: false },
        );
        onApproved?.(response.data);
      } else {
        await axiosInstance.post(
          API_PATHS.AUTH.REJECT_PENDING_SIGNUP(candidate._id),
        );
      }
      setCandidates((prev) =>
        prev.filter((entry) => entry._id !== candidate._id),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Could not update this registration. Try again.",
      );
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading || candidates.length === 0) return null;

  return (
    <div className='bg-white rounded-[20px] border border-stone-100 shadow-sm overflow-hidden mb-6'>
      <div className='flex items-center gap-2.5 px-5 py-4 border-b border-stone-100 bg-stone-50/50'>
        <UserPlus2 className='w-4 h-4 text-stone-800 shrink-0' />
        <h2 className='text-[13px] font-extrabold text-stone-900'>
          Verify new clients
        </h2>
        <span className='text-[11px] font-bold text-white bg-stone-900 rounded-full px-2 py-0.5'>
          {candidates.length}
        </span>
      </div>

      <p className='px-5 pt-3.5 text-[11px] text-stone-500 leading-relaxed'>
        These people signed up with a phone number only, so nothing has
        confirmed the number is theirs. Check it belongs to them, then verify
        to create their account.
      </p>

      {error && (
        <p className='mx-5 mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2'>
          {error}
        </p>
      )}

      <ul className='divide-y divide-stone-50 mt-2'>
        {candidates.map((candidate) => (
          <li
            key={candidate._id}
            className='flex flex-wrap items-center gap-3 px-5 py-4'>
            <div className='min-w-0 flex-1'>
              <p className='font-bold text-stone-900 text-sm truncate'>
                {candidate.fullName}
              </p>
              <p className='flex items-center gap-1.5 text-xs text-stone-500 mt-0.5'>
                <Phone className='w-3 h-3 shrink-0' />
                {candidate.phoneNumber}
                {candidate.requestedAt && (
                  <span className='text-stone-400'>
                    · {formatRequestedAt(candidate.requestedAt)}
                  </span>
                )}
              </p>
            </div>

            <div className='flex items-center gap-2 shrink-0'>
              <button
                type='button'
                disabled={busyId === candidate._id}
                onClick={() => resolveCandidate(candidate, "reject")}
                className='p-2 rounded-xl border border-stone-200 text-stone-500 hover:bg-stone-50 hover:text-stone-800 transition-colors disabled:opacity-50'
                aria-label={`Reject the registration for ${candidate.fullName}`}>
                <X className='w-4 h-4' />
              </button>
              <button
                type='button'
                disabled={busyId === candidate._id}
                onClick={() => resolveCandidate(candidate, "approve")}
                className='flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-stone-900 text-white text-xs font-bold hover:bg-stone-800 transition-colors disabled:opacity-50'>
                {busyId === candidate._id ? (
                  <Loader className='w-4 h-4 animate-spin' />
                ) : (
                  <Check className='w-4 h-4' />
                )}
                Verify
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PendingSignupApprovals;
