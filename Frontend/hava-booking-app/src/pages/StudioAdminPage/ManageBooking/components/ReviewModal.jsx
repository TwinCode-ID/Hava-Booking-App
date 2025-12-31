import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Download, AlertCircle } from "lucide-react";

import LoadingSpinner from "../../../../components/LoadingSpinner";
import DetailItem from "./DetailItem";

const ReviewModal = ({
  purchase,
  onClose,
  onApprove,
  onReject,
  rejectionReason,
  setRejectionReason,
  isProcessing,
}) => {
  const [rejectMode, setRejectMode] = useState(false);

  return (
    <div className='fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className='bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]'>
        {/* Modal Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <div>
            <h2 className='text-xl font-bold text-gray-900'>
              Review Payment Proof
            </h2>
            <p className='text-sm text-gray-500'>
              Transaction ID: {purchase.transactionId}
            </p>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-200 rounded-full text-gray-500'>
            <XCircle className='w-6 h-6' />
          </button>
        </div>

        {/* Modal Content - Scrollable */}
        <div className='p-6 overflow-y-auto grow'>
          <div className='flex flex-col md:flex-row gap-6'>
            {/* Image Preview */}
            <div className='flex-1 bg-gray-100 rounded-2xl flex items-center justify-center min-h-[300px] overflow-hidden relative group border border-gray-200'>
              {purchase.proofOfPayment ? (
                <a
                  href={purchase.proofOfPayment}
                  target='_blank'
                  rel='noreferrer'>
                  <img
                    src={purchase.proofOfPayment}
                    alt='Proof'
                    className='w-full h-full object-contain max-h-[400px]'
                  />
                  <div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-medium'>
                    Click to Open Original <Download className='ml-2 w-4 h-4' />
                  </div>
                </a>
              ) : (
                <div className='text-gray-400 flex flex-col items-center'>
                  <AlertCircle className='w-10 h-10 mb-2 opacity-50' />
                  <span className='text-sm'>No Proof Uploaded</span>
                </div>
              )}
            </div>

            {/* Transaction Details */}
            <div className='w-full md:w-1/3 space-y-5'>
              <div className='bg-gray-50 p-4 rounded-xl space-y-3'>
                <DetailItem
                  label='User Name'
                  value={purchase.userId?.fullName}
                />
                <DetailItem
                  label='Payment Method'
                  value={purchase.paymentMethod}
                />
                <DetailItem
                  label='Payment Issuer'
                  value={purchase.paymentIssuer}
                />
                <DetailItem
                  label='Amount'
                  value={`IDR ${purchase.totalAmount?.toLocaleString()}`}
                />
                <DetailItem
                  label='Date'
                  value={new Date(purchase.createdAt).toLocaleDateString()}
                />
              </div>

              <div className=''>
                <p className='text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-1'>
                  Package Details
                </p>
                <div className='bg-emerald-50 p-4 rounded-xl border border-emerald-100'>
                  <p className='font-bold text-emerald-900 text-sm'>
                    {purchase.packageId?.packageName}
                  </p>
                  <p className='text-xs text-emerald-700 mt-1 font-medium'>
                    {purchase.creditsPurchased} Credits
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Rejection Input */}
          <AnimatePresence>
            {rejectMode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className='overflow-hidden mt-6'>
                <label className='block text-sm font-bold text-red-700 mb-2'>
                  Reason for Rejection{" "}
                  <span className='text-red-400 font-normal'>(Required)</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className='w-full p-3 rounded-xl border border-red-200 bg-red-50 focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-20'
                  placeholder='e.g. Image is blurry, Incorrect amount transfer, etc.'
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Modal Footer (Actions) */}
        <div className='p-6 border-t border-gray-100 bg-white flex justify-end gap-3'>
          {isProcessing ? (
            <div className='flex items-center text-emerald-800 font-medium px-4 bg-emerald-50 rounded-lg py-2'>
              <LoadingSpinner size='sm' />
              <span className='ml-2'>Processing...</span>
            </div>
          ) : (
            <>
              {purchase.status === "waiting_confirmation" ? (
                <>
                  {!rejectMode ? (
                    <>
                      <button
                        onClick={() => setRejectMode(true)}
                        className='px-6 py-3 rounded-xl font-bold text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all'>
                        Reject Payment
                      </button>
                      <button
                        onClick={onApprove}
                        className='px-6 py-3 rounded-xl font-bold bg-emerald-900 text-white hover:bg-emerald-800 shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-2 active:scale-95'>
                        <CheckCircle className='w-5 h-5' /> Confirm Payment
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setRejectMode(false)}
                        className='px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100'>
                        Cancel
                      </button>
                      <button
                        onClick={onReject}
                        disabled={!rejectionReason}
                        className='px-6 py-3 rounded-xl font-bold bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all'>
                        Confirm Rejection
                      </button>
                    </>
                  )}
                </>
              ) : (
                <></>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default ReviewModal;
