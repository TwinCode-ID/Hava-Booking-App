import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  Lock,
  Wallet,
  CreditCard,
  TrendingUp,
  ChevronDown,
  Check,
  CheckCircle,
  XCircle,
  X,
  CalendarX,
  CheckCircle2,
  Clock,
  AlertCircle,
  Search,
  TrendingDown,
  RefreshCw,
  BarChart3,
  ClipboardList,
  Briefcase,
  Ticket,
  FileDown,
  FileText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axiosInstance from "../../../../../utils/axiosInstance";
import { useAuth } from "../../../../../context/AuthContext";
import LoadingSpinner from "../../../../../components/LoadingSpinner";
import { API_PATHS } from "../../../../../utils/apiPath";

// --- Custom Select Component ---
const CustomSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select option",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className='relative w-full' ref={containerRef}>
      <button
        type='button'
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-10.5 px-4 py-2.5 rounded-xl border bg-white flex items-center justify-between transition-all outline-none text-sm font-medium shadow-sm ${
          isOpen
            ? "border-emerald-500 ring-2 ring-emerald-500/20"
            : "border-gray-200 hover:border-emerald-500"
        }`}>
        <span
          className={`block truncate ${value ? "text-gray-900" : "text-gray-400"}`}>
          {value || placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className='absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto'>
            {options.map((option) => (
              <div
                key={option}
                onClick={() => {
                  onChange(option);
                  setIsOpen(false);
                }}
                className={`px-4 py-2.5 text-sm cursor-pointer flex items-center justify-between transition-colors ${
                  value === option
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : "text-gray-700 hover:bg-gray-50 hover:text-emerald-800"
                }`}>
                {option}
                {value === option && (
                  <Check className='w-3.5 h-3.5 text-emerald-600' />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Helper: Currency Formatter ---
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// --- Sub-Component: Inline Password Gate ---
const PasswordGateInline = ({ onUnlock, error, setError }) => {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError("");
    try {
      const response = await axiosInstance.post(
        API_PATHS.AUTH.VERIFY_PASSWORD,
        { email: user.email, password },
      );
      if (response.data.success || response.status === 200) onUnlock();
    } catch (err) {
      if (err.response && err.response.status === 401)
        setError("Incorrect password.");
      else setError("Verification failed.");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className='bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center py-16 group hover:border-emerald-200 transition-colors'>
      <div className='w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform'>
        <Lock className='w-8 h-8 text-emerald-600' />
      </div>
      <h2 className='text-xl font-bold text-gray-900 mb-2'>
        Unlock Financial Data
      </h2>
      <p className='text-gray-500 mb-6 text-sm max-w-sm'>
        To view revenue details and include financial data in your PDF export,
        please confirm your admin password.
      </p>
      <form onSubmit={handleSubmit} className='w-full max-w-sm space-y-4'>
        <input
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder='Admin Password'
          className='w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none transition-all'
        />
        {error && <p className='text-red-500 text-xs'>{error}</p>}
        <button
          disabled={verifying}
          type='submit'
          className='w-full py-3 bg-emerald-900 text-white rounded-xl font-semibold hover:bg-emerald-800 transition-colors flex justify-center items-center gap-2'>
          {verifying ? "Verifying..." : "Unlock Revenue"}
        </button>
      </form>
    </div>
  );
};

// ==========================================
// SECTION COMPONENTS
// ==========================================

const RevenueSection = ({ stats, tableData, selectedMonth, selectedYear }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState("All");

  const filteredData = useMemo(() => {
    return tableData.filter((t) => {
      const q = searchQuery.toLowerCase();
      const match =
        (t.userId?.fullName || "").toLowerCase().includes(q) ||
        (t.packageId?.packageName || "").toLowerCase().includes(q);
      const isMethodMatch =
        methodFilter === "All" ||
        (methodFilter === "Pay at Studio" &&
          t.paymentMethod === "pay_at_studio") ||
        (methodFilter === "Transfer" &&
          t.paymentMethod === "manual_transfer") ||
        (methodFilter === "QRIS" &&
          t.paymentMethod.toLowerCase().includes("qris"));
      return match && isMethodMatch;
    });
  }, [tableData, searchQuery, methodFilter]);

  return (
    <div className='space-y-6'>
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center gap-4'>
        <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
          <Wallet className='w-5 h-5 text-emerald-600' /> Financial Overview
        </h3>
        <div className='relative w-full md:w-80'>
          <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4' />
          <input
            type='text'
            placeholder='Search transactions...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className='w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-500 transition-all shadow-sm'
          />
        </div>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-6 rounded-2xl shadow-md relative overflow-hidden'>
          <div className='relative z-10'>
            <p className='text-emerald-200 text-sm font-medium mb-1'>
              Total Confirmed Revenue
            </p>
            <h3 className='text-3xl font-extrabold'>
              {formatCurrency(stats.totalRevenue)}
            </h3>
          </div>
          <Wallet className='absolute right-4 bottom-4 w-24 h-24 text-white opacity-10' />
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center'>
          <div className='flex items-center gap-4'>
            <div className='p-3 bg-blue-50 text-blue-600 rounded-lg'>
              <TrendingUp className='w-6 h-6' />
            </div>
            <div>
              <p className='text-gray-500 text-xs uppercase tracking-wider font-semibold'>
                Transactions
              </p>
              <p className='text-xl font-bold text-gray-900'>
                {stats.totalTransactions}{" "}
                <span className='text-sm font-normal text-gray-400'>
                  orders
                </span>
              </p>
            </div>
          </div>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <div className='flex justify-between items-center mb-4'>
            <h4 className='text-gray-900 font-bold flex items-center gap-2 text-sm'>
              <CreditCard className='w-4 h-4 text-gray-400' /> Payment Methods
            </h4>
            {methodFilter !== "All" && (
              <button
                onClick={() => setMethodFilter("All")}
                className='text-[10px] text-red-500 bg-red-50 px-2 py-1 rounded'>
                Clear
              </button>
            )}
          </div>
          <div className='flex flex-col gap-2'>
            {stats.breakdown.map((item) => (
              <div
                key={item.name}
                onClick={() => setMethodFilter(item.name)}
                className={`cursor-pointer rounded-lg p-2 transition-colors border ${methodFilter === item.name ? "bg-gray-50 border-emerald-200" : "border-transparent hover:bg-gray-50"}`}>
                <div className='flex justify-between text-xs mb-1'>
                  <span className='text-gray-600'>{item.name}</span>
                  <span className='font-semibold text-gray-900'>
                    {item.percentage}%
                  </span>
                </div>
                <div className='w-full bg-gray-100 rounded-full h-1.5'>
                  <div
                    className={`h-full rounded-full ${item.color}`}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 bg-gray-50/50'>
                <th className='px-6 py-4 font-bold'>Date</th>
                <th className='px-6 py-4 font-bold'>Client</th>
                <th className='px-6 py-4 font-bold'>Package</th>
                <th className='px-6 py-4 font-bold'>Method</th>
                <th className='px-6 py-4 font-bold text-right'>Amount</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {filteredData.length > 0 ? (
                filteredData.map((trx) => (
                  <tr
                    key={trx._id}
                    className='hover:bg-emerald-50/80 transition-colors'>
                    <td className='px-6 py-4 text-sm text-gray-500'>
                      {new Date(trx.createdAt).toLocaleDateString()}
                    </td>
                    <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                      {trx.userId?.fullName}
                    </td>
                    <td className='px-6 py-4 text-sm'>
                      <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200'>
                        {trx.packageId?.packageName}
                      </span>
                    </td>
                    <td className='px-6 py-4 text-sm capitalize text-gray-600'>
                      {trx.paymentMethod?.replace(/_/g, " ")}
                    </td>
                    <td className='px-6 py-4 text-sm text-right font-bold text-gray-900'>
                      {formatCurrency(trx.totalAmount)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AttendanceSection = ({
  bookings,
  stats,
  onClearStudent,
  selectedStudentName,
}) => {
  return (
    <div className='space-y-6'>
      <div className='flex justify-between items-center'>
        <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
          <ClipboardList className='w-5 h-5 text-blue-600' /> Class Attendance
        </h3>
        {selectedStudentName && (
          <div className='flex items-center gap-3'>
            <span className='text-sm px-3 py-1 bg-blue-50 text-blue-800 rounded-full font-semibold border border-blue-100'>
              Showing for: {selectedStudentName}
            </span>
            <button
              onClick={onClearStudent}
              className='p-1 hover:bg-red-50 text-red-500 rounded'>
              <X className='w-4 h-4' />
            </button>
          </div>
        )}
      </div>
      <div className='grid grid-cols-1 md:grid-cols-4 gap-6'>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Total Bookings
            </p>
            <div className='p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-gray-600 transition-colors'>
              <Ticket className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.total}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-emerald-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Total Attended
            </p>
            <div className='p-2 bg-emerald-50 rounded-lg text-emerald-500'>
              <CheckCircle className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-emerald-600'>
            {stats.attended}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:border-red-200 transition-colors'>
          <div className='flex justify-between items-start mb-4'>
            <p className='text-gray-500 text-xs font-bold tracking-wider uppercase'>
              Cancellations
            </p>
            <div className='p-2 bg-red-50 rounded-lg text-red-500'>
              <XCircle className='w-5 h-5' />
            </div>
          </div>
          <h3 className='text-3xl font-extrabold text-red-600'>
            {stats.cancelled}
          </h3>
        </div>
        <div className='bg-gradient-to-br from-blue-800 to-blue-950 p-6 rounded-2xl shadow-md relative overflow-hidden'>
          <div className='absolute top-0 right-0 p-4 opacity-10'>
            <TrendingUp className='w-24 h-24 text-white -mt-4 -mr-4' />
          </div>
          <div className='relative z-10'>
            <p className='text-blue-100 text-xs font-bold tracking-wider uppercase mb-4'>
              Attendance Rate
            </p>
            <h3 className='text-4xl font-extrabold text-white'>
              {stats.rate}%
            </h3>
          </div>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50'>
          <h3 className='font-bold text-gray-800 text-sm'>
            {selectedStudentName
              ? "Student Attendance Details"
              : "Recent Class Bookings"}
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-400 bg-gray-50/30 uppercase'>
                <th className='px-6 py-4'>Date</th>
                {!selectedStudentName && (
                  <th className='px-6 py-4'>Client Name</th>
                )}
                <th className='px-6 py-4'>Class</th>
                <th className='px-6 py-4'>Instructor</th>
                <th className='px-6 py-4'>Status</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {bookings.slice(0, 30).map((b) => (
                <tr
                  key={b._id}
                  className='hover:bg-gray-50/80 transition-colors'>
                  <td className='px-6 py-4 text-sm text-gray-500'>
                    {new Date(b.bookingDate).toLocaleDateString()}
                  </td>
                  {!selectedStudentName && (
                    <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                      {b.userId?.fullName || "N/A"}
                    </td>
                  )}
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200'>
                      {b.classId?.className || "Class Removed"}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {b.instructorId?.fullName || "-"}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    {b.status === "Cancelled" ? (
                      <span className='px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-semibold border border-red-100'>
                        Cancelled
                      </span>
                    ) : b.isAttend ? (
                      <span className='px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100'>
                        Checked In
                      </span>
                    ) : (
                      <span className='px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-100'>
                        Booked
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {bookings.length === 0 && (
                <tr>
                  <td colSpan='5' className='px-6 py-16 text-center'>
                    <div className='flex flex-col items-center justify-center text-gray-400'>
                      <div className='bg-gray-50 p-4 rounded-full mb-3 border border-gray-100'>
                        <CalendarX className='w-8 h-8 text-gray-300' />
                      </div>
                      <p className='text-gray-900 font-medium text-base'>
                        No bookings yet
                      </p>
                      <p className='text-sm mt-1'>
                        When students book classes, they will appear here.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const InstructorSection = ({ stats, classesCount }) => {
  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
        <Briefcase className='w-5 h-5 text-orange-600' /> Instructor Workload
      </h3>
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Active Instructors
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.length}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Classes Scheduled
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {classesCount}
          </h3>
        </div>
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <p className='text-gray-500 text-xs uppercase font-bold tracking-wider mb-1'>
            Total Students Enrolled
          </p>
          <h3 className='text-3xl font-extrabold text-gray-900'>
            {stats.reduce((acc, curr) => acc + curr.students, 0)}
          </h3>
        </div>
      </div>

      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50'>
          <h3 className='font-bold text-gray-800 text-sm'>
            Instructor Workload Details
          </h3>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-500 bg-gray-50/30 uppercase'>
                <th className='px-6 py-4'>Instructor Name</th>
                <th className='px-6 py-4'>Type</th>
                <th className='px-6 py-4 text-center'>Classes Taught</th>
                <th className='px-6 py-4 text-center'>Total Students</th>
                <th className='px-6 py-4 text-right'>Total Hours</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {stats.map((inst, idx) => (
                <tr key={idx} className='hover:bg-gray-50/80 transition-colors'>
                  <td className='px-6 py-4 text-sm font-semibold text-gray-900'>
                    {inst.name}
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {inst.type || "N/A"}
                  </td>
                  <td className='px-6 py-4 text-sm text-center font-bold text-gray-700'>
                    {inst.classCount}
                  </td>
                  <td className='px-6 py-4 text-sm text-center text-gray-700'>
                    {inst.students}
                  </td>
                  <td className='px-6 py-4 text-sm text-right font-bold text-emerald-600'>
                    {(inst.totalDuration / 60).toFixed(1)} hrs
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No instructor data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const PackageUsageSection = ({ passes, onRowClick }) => {
  return (
    <div className='space-y-6'>
      <h3 className='text-lg font-bold text-gray-900 flex items-center gap-2'>
        <Ticket className='w-5 h-5 text-purple-600' /> Package Distribution &
        Usage
      </h3>
      <div className='bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden'>
        <div className='px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center'>
          <h3 className='font-bold text-gray-800 text-sm'>
            Issued Passes & Credits Summary
          </h3>
          <span className='text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md'>
            Click a row to view student history
          </span>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left border-collapse'>
            <thead>
              <tr className='border-b border-gray-100 text-xs font-bold tracking-wider text-gray-400 bg-gray-50/50 uppercase'>
                <th className='px-6 py-4'>Owner</th>
                <th className='px-6 py-4'>Package Name</th>
                <th className='px-6 py-4'>Credits Left</th>
                <th className='px-6 py-4'>Expiry</th>
                <th className='px-6 py-4'>Status</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-gray-50'>
              {passes.slice(0, 50).map((pass) => (
                <tr
                  key={pass._id}
                  onClick={() => pass.userId?._id && onRowClick(pass.userId)}
                  className='hover:bg-purple-50/50 cursor-pointer transition-colors group'>
                  <td className='px-6 py-4 text-sm font-semibold text-gray-900 group-hover:text-purple-700 transition-colors'>
                    {pass.userId?.fullName || "N/A"}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    <span className='px-2.5 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium border border-gray-200'>
                      {pass.packageId?.packageName || "Custom Pass"}
                    </span>
                  </td>
                  <td className='px-6 py-4 text-sm font-extrabold text-gray-700'>
                    {pass.remainingCredits} / {pass.initialCredits}
                  </td>
                  <td className='px-6 py-4 text-sm text-gray-600'>
                    {new Date(pass.expiryDate).toLocaleDateString()}
                  </td>
                  <td className='px-6 py-4 text-sm'>
                    {pass.isActive ? (
                      <span className='px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold border border-emerald-100'>
                        Active
                      </span>
                    ) : (
                      <span className='px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold border border-gray-200'>
                        Inactive
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {passes.length === 0 && (
                <tr>
                  <td
                    colSpan='5'
                    className='px-6 py-8 text-center text-gray-400'>
                    No pass data found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// MODAL COMPONENT: Student Attendance Details
// ==========================================
const StudentAttendanceModal = ({ student, allBookings, onClose }) => {
  // Filter bookings for this specific student
  const studentBookings = useMemo(() => {
    return allBookings
      .filter((b) => b.userId?._id === student._id)
      .sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate));
  }, [allBookings, student._id]);

  const stats = useMemo(() => {
    const total = studentBookings.length;
    const attended = studentBookings.filter((b) => b.isAttend).length;
    const cancelled = studentBookings.filter(
      (b) => b.status === "Cancelled",
    ).length;
    const missed = studentBookings.filter(
      (b) =>
        !b.isAttend &&
        b.status !== "Cancelled" &&
        new Date(b.bookingDate) < new Date(),
    ).length;
    return { total, attended, cancelled, missed };
  }, [studentBookings]);

  const generateStudentPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [126, 34, 206]; // Purple 700

    doc.setFontSize(20);
    doc.setTextColor(0, 0, 0);
    doc.text(`Student Report: ${student.fullName}`, 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

    doc.setDrawColor(...primaryColor);
    doc.setLineWidth(0.5);
    doc.line(14, 32, 196, 32);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total Bookings: ${stats.total}`, 14, 42);
    doc.text(`Classes Attended: ${stats.attended}`, 70, 42);
    doc.text(`Cancellations: ${stats.cancelled}`, 130, 42);

    let currentY = 52;
    if (studentBookings.length > 0) {
      const cols = ["Date", "Class", "Instructor", "Status"];
      const rows = studentBookings.map((b) => [
        new Date(b.bookingDate).toLocaleDateString(),
        b.classId?.className || "N/A",
        b.instructorId?.fullName || "N/A",
        b.status === "Cancelled"
          ? "Cancelled"
          : b.isAttend
            ? "Checked In"
            : new Date(b.bookingDate) < new Date()
              ? "Absent/Missed"
              : "Booked",
      ]);
      autoTable(doc, {
        head: [cols],
        body: rows,
        startY: currentY,
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 9 },
      });
    } else {
      doc.text("No booking history found for this student.", 14, currentY);
    }

    doc.save(`Student_Report_${student.fullName.replace(/\s+/g, "_")}.pdf`);
  };

  return (
    <div className='fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className='bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0'>
          <div className='flex items-center gap-3'>
            <div className='w-12 h-12 bg-purple-100 text-purple-700 rounded-full flex items-center justify-center font-bold text-xl'>
              {student.fullName.charAt(0)}
            </div>
            <div>
              <h3 className='text-xl font-bold text-gray-900'>
                {student.fullName}
              </h3>
              <p className='text-sm text-gray-500'>
                Attendance History & Detail
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 rounded-full hover:bg-gray-200 transition-colors text-gray-500'>
            <X className='w-6 h-6' />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className='p-6 overflow-y-auto flex-1 space-y-6'>
          {/* Stats Row */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
            <div className='p-4 bg-gray-50 rounded-xl border border-gray-100 text-center'>
              <p className='text-xs font-bold text-gray-500 uppercase tracking-wider mb-1'>
                Total Booked
              </p>
              <p className='text-2xl font-extrabold text-gray-900'>
                {stats.total}
              </p>
            </div>
            <div className='p-4 bg-emerald-50 rounded-xl border border-emerald-100 text-center'>
              <p className='text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1'>
                Attended
              </p>
              <p className='text-2xl font-extrabold text-emerald-700'>
                {stats.attended}
              </p>
            </div>
            <div className='p-4 bg-red-50 rounded-xl border border-red-100 text-center'>
              <p className='text-xs font-bold text-red-600 uppercase tracking-wider mb-1'>
                Cancelled
              </p>
              <p className='text-2xl font-extrabold text-red-700'>
                {stats.cancelled}
              </p>
            </div>
            <div className='p-4 bg-amber-50 rounded-xl border border-amber-100 text-center'>
              <p className='text-xs font-bold text-amber-600 uppercase tracking-wider mb-1'>
                Missed/Absent
              </p>
              <p className='text-2xl font-extrabold text-amber-700'>
                {stats.missed}
              </p>
            </div>
          </div>

          {/* Detailed Table */}
          <div className='border border-gray-200 rounded-xl overflow-hidden'>
            <table className='w-full text-left border-collapse'>
              <thead>
                <tr className='bg-gray-50/80 border-b border-gray-200 text-xs font-bold tracking-wider text-gray-500 uppercase'>
                  <th className='px-4 py-3'>Date</th>
                  <th className='px-4 py-3'>Class Name</th>
                  <th className='px-4 py-3'>Instructor</th>
                  <th className='px-4 py-3'>Status</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {studentBookings.map((b) => {
                  const isPast = new Date(b.bookingDate) < new Date();
                  const isAbsent =
                    !b.isAttend && b.status !== "Cancelled" && isPast;

                  return (
                    <tr
                      key={b._id}
                      className='hover:bg-gray-50 transition-colors'>
                      <td className='px-4 py-3 text-sm text-gray-600'>
                        {new Date(b.bookingDate).toLocaleDateString()}
                      </td>
                      <td className='px-4 py-3 text-sm font-semibold text-gray-900'>
                        {b.classId?.className || "Removed"}
                      </td>
                      <td className='px-4 py-3 text-sm text-gray-600'>
                        {b.instructorId?.fullName || "-"}
                      </td>
                      <td className='px-4 py-3 text-sm'>
                        {b.status === "Cancelled" ? (
                          <span className='text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100'>
                            Cancelled
                          </span>
                        ) : b.isAttend ? (
                          <span className='text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded border border-emerald-100'>
                            Checked In
                          </span>
                        ) : isAbsent ? (
                          <span className='text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-100'>
                            Absent
                          </span>
                        ) : (
                          <span className='text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded border border-gray-200'>
                            Upcoming
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {studentBookings.length === 0 && (
                  <tr>
                    <td colSpan='4' className='text-center py-8 text-gray-400'>
                      No bookings recorded for this student.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Actions */}
        <div className='p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0'>
          <button
            onClick={generateStudentPDF}
            className='flex items-center gap-2 px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl transition-colors shadow-sm'>
            <FileText className='w-4 h-4' /> Download Student PDF
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// MAIN COMPONENT: STUDIO REPORTS (Single Page)
// ==========================================
const StudioReports = () => {
  const { user } = useAuth();

  // --- Global State ---
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // --- Student Specific State (For Main Section) ---
  const [selectedStudentId, setSelectedStudentId] = useState("All");

  // --- Modal State ---
  const [modalStudent, setModalStudent] = useState(null);

  // --- Revenue State (Gated) ---
  const [isRevenueLocked, setIsRevenueLocked] = useState(true);
  const [revenuePasswordError, setRevenuePasswordError] = useState("");
  const [transactions, setTransactions] = useState([]);

  // --- Public Data State ---
  const [bookings, setBookings] = useState([]);
  const [classes, setClasses] = useState([]);
  const [passes, setPasses] = useState([]);

  // --- Constants ---
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i),
    [],
  );
  const availableMonths = useMemo(
    () =>
      selectedYear === new Date().getFullYear()
        ? monthNames.slice(0, new Date().getMonth() + 1)
        : monthNames,
    [selectedYear],
  );

  useEffect(() => {
    if (selectedMonth >= availableMonths.length)
      setSelectedMonth(availableMonths.length - 1);
  }, [selectedYear, availableMonths]);

  // --- Data Fetching ---
  useEffect(() => {
    const fetchAllPublicData = async () => {
      setLoading(true);
      try {
        const [bookRes, classRes, passRes] = await Promise.all([
          axiosInstance.get(`/api/bookings/studio`),
          axiosInstance.get(`/api/schedule/${user.adminStudioLocation}`),
          axiosInstance.get(`/api/passes/history/${user.adminStudioLocation}`),
        ]);
        if (bookRes.data) setBookings(bookRes.data);
        if (classRes.data) setClasses(classRes.data);
        if (passRes.data) setPasses(passRes.data);
      } catch (error) {
        console.error("Failed to fetch public report data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllPublicData();
  }, [user.adminStudioLocation]);

  useEffect(() => {
    const fetchRevenueData = async () => {
      if (isRevenueLocked) return;
      try {
        const res = await axiosInstance.get(
          API_PATHS.PURCHASES.GET_ALL_ADMIN(user.adminStudioLocation),
        );
        if (res.data) setTransactions(res.data);
      } catch (error) {
        console.error("Failed to fetch revenue:", error);
      }
    };
    fetchRevenueData();
  }, [isRevenueLocked, user.adminStudioLocation]);

  // --- Derived Stats Calculations ---

  const studentOptions = useMemo(() => {
    const distinctStudents = Array.from(
      new Map(
        bookings.map((item) => [item.userId?._id, item.userId?.fullName]),
      ).entries(),
    );
    return [
      { value: "All", label: "All Students" },
      ...distinctStudents.map(([id, name]) => ({ value: id, label: name })),
    ];
  }, [bookings]);

  const selectedStudentName = useMemo(() => {
    if (selectedStudentId === "All") return null;
    return studentOptions.find((o) => o.value === selectedStudentId)?.label;
  }, [selectedStudentId, studentOptions]);

  const revenueStats = useMemo(() => {
    const currentMonth = transactions.filter((t) => {
      const d = new Date(t.createdAt);
      return (
        d.getMonth() === selectedMonth &&
        d.getFullYear() === selectedYear &&
        t.status === "confirmed"
      );
    });
    const totalRevenue = currentMonth.reduce(
      (acc, curr) => acc + curr.totalAmount,
      0,
    );
    const methodStats = currentMonth.reduce(
      (acc, curr) => {
        let key = "Others";
        if (curr.paymentMethod === "pay_at_studio") key = "Pay at Studio";
        else if (curr.paymentMethod === "manual_transfer") key = "Transfer";
        else if (curr.paymentMethod.toLowerCase().includes("qris"))
          key = "QRIS";
        acc[key] = (acc[key] || 0) + curr.totalAmount;
        return acc;
      },
      { "Pay at Studio": 0, Transfer: 0, QRIS: 0 },
    );

    const breakdown = Object.keys(methodStats).map((key) => ({
      name: key,
      amount: methodStats[key],
      percentage:
        totalRevenue === 0
          ? 0
          : Math.round((methodStats[key] / totalRevenue) * 100),
      color:
        key === "Pay at Studio"
          ? "bg-emerald-500"
          : key === "Transfer"
            ? "bg-blue-500"
            : "bg-purple-500",
    }));

    return {
      totalRevenue,
      totalTransactions: currentMonth.length,
      breakdown,
      tableData: currentMonth,
    };
  }, [transactions, selectedMonth, selectedYear]);

  const attendanceStats = useMemo(() => {
    // Filter bookings by selected month/year
    const periodFilteredBookings = bookings.filter((b) => {
      const d = new Date(b.bookingDate);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });

    // Apply Student Filter if active
    let finalBookings = periodFilteredBookings;
    if (selectedStudentId !== "All") {
      finalBookings = periodFilteredBookings.filter(
        (b) => b.userId?._id === selectedStudentId,
      );
    }

    const total = finalBookings.length;
    const attended = finalBookings.filter((b) => b.isAttend).length;
    const cancelled = finalBookings.filter(
      (b) => b.status === "Cancelled",
    ).length;
    const rate =
      total > 0 ? Math.round((attended / (total - cancelled)) * 100) || 0 : 0;
    return { data: finalBookings, stats: { total, attended, cancelled, rate } };
  }, [bookings, selectedMonth, selectedYear, selectedStudentId]);

  const instructorStats = useMemo(() => {
    // Filter classes by selected month/year
    const filteredClasses = classes.filter((c) => {
      const d = new Date(c.startTime);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
    const map = {};
    filteredClasses.forEach((cls) => {
      if (!cls.instructorId) return;
      const id = cls.instructorId._id;
      if (!map[id])
        map[id] = {
          name: cls.instructorId.fullName,
          type: cls.instructorType,
          classCount: 0,
          totalDuration: 0,
          students: 0,
        };
      map[id].classCount += 1;
      map[id].totalDuration += cls.duration || 0;
      map[id].students += cls.currentEnrollment || 0;
    });
    return {
      data: Object.values(map).sort((a, b) => b.classCount - a.classCount),
      totalClasses: filteredClasses.length,
    };
  }, [classes, selectedMonth, selectedYear]);

  const packageFiltered = useMemo(() => {
    return passes.filter((p) => {
      const d = new Date(p.purchaseDate || p.createdAt);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [passes, selectedMonth, selectedYear]);

  // --- Master PDF Generation ---
  const generateMasterPDF = () => {
    if (isRevenueLocked) {
      alert(
        "Please unlock the Revenue section before exporting the comprehensive master report.",
      );
      return;
    }

    const doc = new jsPDF();
    const monthName = monthNames[selectedMonth];
    const reportTitle = `Studio Master Report - ${monthName} ${selectedYear}`;

    // Brand Colors
    const primaryColor = [6, 78, 59]; // Emerald 900
    const secondaryColor = [100, 116, 139]; // Slate 500

    // --- Page Header ---
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 0);
    doc.text(reportTitle, 14, 25);
    doc.setFontSize(10);
    doc.setTextColor(...secondaryColor);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 32);
    doc.setLineWidth(0.5);
    doc.setDrawColor(...primaryColor);
    doc.line(14, 36, 196, 36);

    // --- 1. Financial Overview ---
    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("1. Financial Overview", 14, 50);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Total Revenue: ${formatCurrency(revenueStats.totalRevenue)}`,
      14,
      58,
    );
    doc.text(`Total Transactions: ${revenueStats.totalTransactions}`, 14, 64);

    let currentY = 72;

    // Revenue Table
    if (revenueStats.tableData.length > 0) {
      const revCols = ["Date", "Client", "Package", "Method", "Amount"];
      const revRows = revenueStats.tableData.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.userId?.fullName || "N/A",
        t.packageId?.packageName || "N/A",
        t.paymentMethod.replace(/_/g, " "),
        formatCurrency(t.totalAmount),
      ]);
      autoTable(doc, {
        head: [revCols],
        body: revRows,
        startY: currentY,
        headStyles: { fillColor: primaryColor },
        styles: { fontSize: 8 },
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No transactions recorded for this period.", 14, currentY);
      currentY += 18;
    }

    // --- 2. Class Attendance ---
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    const attTitle = selectedStudentName
      ? `2. Attendance: ${selectedStudentName}`
      : "2. Class Attendance Overview";
    doc.text(attTitle, 14, currentY);

    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    currentY += 10;
    doc.text(`Total Bookings: ${attendanceStats.stats.total}`, 14, currentY);
    doc.text(`Total Attended: ${attendanceStats.stats.attended}`, 70, currentY);
    doc.text(
      `Cancellations: ${attendanceStats.stats.cancelled}`,
      120,
      currentY,
    );
    doc.text(`Attendance Rate: ${attendanceStats.stats.rate}%`, 170, currentY);
    currentY += 10;

    if (attendanceStats.data.length > 0) {
      const attCols = selectedStudentName
        ? ["Date", "Class", "Instructor", "Status"]
        : ["Date", "Client", "Class", "Instructor", "Status"];
      const attRows = attendanceStats.data.map((b) => {
        const row = [
          new Date(b.bookingDate).toLocaleDateString(),
          b.classId?.className || "N/A",
          b.instructorId?.fullName || "N/A",
          b.status === "Cancelled"
            ? "Cancelled"
            : b.isAttend
              ? "Checked In"
              : "Booked",
        ];
        if (!selectedStudentName) row.splice(1, 0, b.userId?.fullName || "N/A");
        return row;
      });
      autoTable(doc, {
        head: [attCols],
        body: attRows,
        startY: currentY,
        headStyles: { fillColor: [37, 99, 235] },
        styles: { fontSize: 8 }, // Blue header
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No booking data found.", 14, currentY);
      currentY += 18;
    }

    // --- 3. Instructor Workload ---
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("3. Instructor Workload", 14, currentY);
    currentY += 10;

    if (instructorStats.data.length > 0) {
      const instCols = [
        "Instructor Name",
        "Type",
        "Classes Taught",
        "Total Students",
        "Total Hours",
      ];
      const instRows = instructorStats.data.map((i) => [
        i.name,
        i.type || "N/A",
        i.classCount.toString(),
        i.students.toString(),
        `${(i.totalDuration / 60).toFixed(1)} hrs`,
      ]);
      autoTable(doc, {
        head: [instCols],
        body: instRows,
        startY: currentY,
        headStyles: { fillColor: [234, 88, 12] },
        styles: { fontSize: 8 }, // Orange header
      });
      currentY = doc.lastAutoTable.finalY + 18;
    } else {
      doc.text("No instructor data found for this period.", 14, currentY);
      currentY += 18;
    }

    // --- 4. Package Usage ---
    if (currentY > 250) {
      doc.addPage();
      currentY = 25;
    }

    doc.setFontSize(16);
    doc.setTextColor(...primaryColor);
    doc.setFont("helvetica", "bold");
    doc.text("4. Issued Packages", 14, currentY);
    currentY += 10;

    if (packageFiltered.length > 0) {
      const packCols = [
        "Owner",
        "Package Name",
        "Credits Left",
        "Expiry",
        "Status",
      ];
      const packRows = packageFiltered.map((p) => [
        p.userId?.fullName || "N/A",
        p.packageId?.packageName || "Custom",
        `${p.remainingCredits} / ${p.initialCredits}`,
        new Date(p.expiryDate).toLocaleDateString(),
        p.isActive ? "Active" : "Inactive",
      ]);
      autoTable(doc, {
        head: [packCols],
        body: packRows,
        startY: currentY,
        headStyles: { fillColor: [147, 51, 234] },
        styles: { fontSize: 8 }, // Purple header
      });
    } else {
      doc.text("No new packages issued during this period.", 14, currentY);
    }

    // --- Footer with Page Number ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(...secondaryColor);
      doc.text(`Page ${i} of ${pageCount}`, 196, 290, { align: "right" });
    }

    doc.save(`Studio_Master_Report_${monthName}_${selectedYear}.pdf`);
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className='p-6 md:p-10 bg-gray-50 h-full overflow-y-auto relative'>
      {/* Header & Controls */}
      <div className='flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 border-b border-gray-200 pb-8 bg-white p-6 rounded-2xl shadow-sm'>
        <div>
          <h2 className='text-3xl font-extrabold text-gray-900 tracking-tight'>
            Master Studio Report
          </h2>
          <p className='text-gray-500 mt-1 max-w-lg'>
            Comprehensive performance data across financials, attendance,
            instructors, and packages. Apply filters below to customize the
            view.
          </p>
        </div>

        <div className='flex flex-wrap gap-3 items-center w-full md:w-auto'>
          <div className='w-28'>
            <CustomSelect
              value={selectedYear}
              onChange={setSelectedYear}
              options={yearOptions}
              placeholder='Year'
            />
          </div>
          <div className='w-36'>
            <CustomSelect
              value={monthNames[selectedMonth]}
              onChange={(val) => setSelectedMonth(monthNames.indexOf(val))}
              options={availableMonths}
              placeholder='Month'
            />
          </div>
          <div className='w-56'>
            <CustomSelect
              value={
                studentOptions.find((o) => o.value === selectedStudentId)
                  ?.label || "All Students"
              }
              onChange={setSelectedStudentId}
              options={studentOptions}
              placeholder='Filter Student'
            />
          </div>
          <button
            onClick={generateMasterPDF}
            className='flex items-center gap-2 bg-emerald-900 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md hover:bg-emerald-800 transition-colors w-full md:w-auto justify-center group'>
            <FileDown className='w-4 h-4 group-hover:-translate-y-0.5 transition-transform' />{" "}
            Export Master PDF
          </button>
        </div>
      </div>

      {/* Sections Stacked */}
      <div className='space-y-12 pb-20'>
        {/* 1. Revenue */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          {isRevenueLocked ? (
            <PasswordGateInline
              onUnlock={() => setIsRevenueLocked(false)}
              error={revenuePasswordError}
              setError={setRevenuePasswordError}
            />
          ) : (
            <RevenueSection
              stats={revenueStats}
              tableData={revenueStats.tableData}
            />
          )}
        </div>

        {/* 2. Attendance */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <AttendanceSection
            bookings={attendanceStats.data}
            stats={attendanceStats.stats}
            onClearStudent={() => setSelectedStudentId("All")}
            selectedStudentName={selectedStudentName}
          />
        </div>

        {/* 3. Instructors */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <InstructorSection
            stats={instructorStats.data}
            classesCount={instructorStats.totalClasses}
          />
        </div>

        {/* 4. Packages */}
        <div className='bg-white p-6 rounded-2xl shadow-sm border border-gray-100'>
          <PackageUsageSection
            passes={packageFiltered}
            onRowClick={setModalStudent}
          />
        </div>
      </div>

      {/* Student Details Modal */}
      <AnimatePresence>
        {modalStudent && (
          <StudentAttendanceModal
            student={modalStudent}
            allBookings={bookings}
            onClose={() => setModalStudent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudioReports;
