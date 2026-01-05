import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, CreditCard, User, Clock } from "lucide-react";

const PurchaseRow = ({ purchase, getStatusColor, onReview }) => {
  const date = new Date(purchase.createdAt).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className='bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row items-center justify-between gap-4'>
      {/* Left: User & Pack Info */}
      <div className='flex items-center gap-4 w-full md:w-auto'>
        <div className='w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 shrink-0'>
          <User className='w-6 h-6' />
        </div>
        <div>
          <h3 className='font-bold text-gray-900'>
            {purchase.userId?.fullName || "Unknown User"}
          </h3>
          <p className='text-sm text-gray-500 flex items-center gap-2'>
            <span className='bg-gray-100 px-2 py-0.5 rounded text-xs text-gray-600 font-medium font-mono'>
              {purchase.transactionId}
            </span>
            <span className='text-gray-300'>•</span>
            <span className='flex items-center gap-1 text-xs'>
              <Clock className='w-3 h-3' /> {date}
            </span>
          </p>
        </div>
      </div>

      {/* Middle: Details */}
      <div className='flex flex-wrap gap-6 text-sm text-gray-600 w-full md:w-auto'>
        <div className='flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200'>
          <CreditCard className='w-4 h-4 text-emerald-600' />
          {purchase.packageId?.packageName || "Deleted Package"}
        </div>
        <div className='font-mono font-bold text-gray-900 flex items-center bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200'>
          IDR {purchase.totalAmount?.toLocaleString()}
        </div>
      </div>

      {/* Right: Status & Action */}
      <div className='flex items-center gap-4 w-full md:w-auto justify-between md:justify-end'>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold border capitalize whitespace-nowrap ${getStatusColor(
            purchase.status
          )}`}>
          {purchase.status.replace("_", " ")}
        </span>

        {/* --- UPDATED: Only show REVIEW if status is 'waiting_confirmation' --- */}

        <button
          onClick={onReview}
          className='flex items-center gap-2 bg-emerald-900 text-white px-5 py-2 rounded-xl text-sm font-bold hover:bg-emerald-800 transition-colors shadow-lg shadow-emerald-900/20 active:scale-95'>
          <Eye className='w-4 h-4' /> Review
        </button>
      </div>
    </motion.div>
  );
};

export default PurchaseRow;
