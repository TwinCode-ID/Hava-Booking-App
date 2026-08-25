import React, { useState } from "react";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axiosInstance from "../utils/axiosInstance";
import { API_PATHS } from "../utils/apiPath";
import { FINANCIAL_READ_SCOPE } from "../utils/useFinancialStepUp";

const FinancialAccessGate = ({
  description = "Confirm your password to access financial data.",
  error,
  onUnlock,
  setError,
  scope = FINANCIAL_READ_SCOPE,
  title = "Unlock Financial Data",
}) => {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setVerifying(true);
    setError("");

    try {
      const response = await axiosInstance.post(
        API_PATHS.AUTH.VERIFY_PASSWORD,
        { password, scope },
      );
      if (
        response.data.success &&
        onUnlock(
          response.data.stepUpToken,
          response.data.stepUpExpiresIn,
        )
      ) {
        setPassword("");
      } else {
        setError("Verification did not return a valid authorization.");
      }
    } catch (requestError) {
      if (requestError.response?.data?.code === "PASSWORD_NOT_SET") {
        setError("Create a password in Account Settings first.");
      } else if (requestError.response?.status === 401) {
        setError("Incorrect password. Please try again.");
      } else {
        setError("Verification failed. Please try again.");
      }
    } finally {
      setVerifying(false);
    }
  };

  if (!user?.hasPassword) {
    return (
      <div className='flex min-h-[60vh] items-center justify-center p-6 text-center'>
        <div className='w-full max-w-md rounded-2xl border border-stone-100 bg-white p-8 shadow-sm'>
          <div className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50'>
            <Lock className='h-8 w-8 text-amber-600' />
          </div>
          <h2 className='mb-2 text-xl font-bold text-stone-900'>
            Create a Password First
          </h2>
          <p className='mb-6 text-sm text-stone-500'>
            Create a password before accessing financial data.
          </p>
          <Link
            to='/admin-account-settings'
            className='flex w-full items-center justify-center rounded-xl bg-stone-600 py-3 font-semibold text-white transition-colors hover:bg-stone-700'>
            Create Password
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className='flex min-h-[60vh] items-center justify-center p-6 text-center'>
      <div className='w-full max-w-md rounded-2xl border border-stone-100 bg-white p-8 shadow-sm'>
        <div className='mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-stone-100'>
          <Lock className='h-8 w-8 text-stone-800' />
        </div>
        <h2 className='mb-2 text-xl font-bold text-stone-900'>{title}</h2>
        <p className='mb-6 text-sm text-stone-500'>{description}</p>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <input
            type='password'
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder='Admin Password'
            autoComplete='current-password'
            autoFocus
            required
            className='w-full rounded-xl border border-stone-200 px-4 py-3 outline-none transition-all focus:border-stone-500 focus:ring-2 focus:ring-stone-300'
          />
          {error && <p className='text-xs text-red-500'>{error}</p>}
          <button
            disabled={verifying || !password}
            type='submit'
            className='flex w-full items-center justify-center rounded-xl bg-stone-600 py-3 font-semibold text-white transition-colors hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60'>
            {verifying ? "Verifying..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FinancialAccessGate;
