import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Scanner } from "@yudiel/react-qr-scanner";
import {
  format,
  isSameDay,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  addDays,
  subDays,
  setMonth,
  setYear,
  getYear,
  getMonth,
  parseISO,
} from "date-fns";
import {
  Calendar as CalendarIcon,
  Clock,
  Users,
  X,
  ChevronRight,
  ChevronLeft,
  Briefcase,
  RotateCcw,
  CheckCircle2,
  Circle,
  Save,
  AlertCircle,
  UserCheck,
  Search,
  FileText,
  Download,
  Eye,
  QrCode,
  ScanLine,
  MapPin,
  CalendarClock,
  AlertTriangle,
  Ticket,
  Zap,
} from "lucide-react";

import axiosInstance from "../../../utils/axiosInstance";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { API_PATHS } from "../../../utils/apiPath";
import { useAuth } from "../../../context/AuthContext";

const AdminDashboard = () => {
  const { user } = useAuth();
  const [studio, setStudio] = useState(null);

  // Date States
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [calendarViewDate, setCalendarViewDate] = useState(new Date());

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Scan State
  const [searchQuery, setSearchQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Scanner Result States
  const [scannedBooking, setScannedBooking] = useState(null);
  const [scannedPass, setScannedPass] = useState(null); // NEW: State for scanned general passes
  const [scanError, setScanError] = useState(null);

  // Modals State
  const [selectedClassDetails, setSelectedClassDetails] = useState(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [showAttendanceDetails, setShowAttendanceDetails] = useState(false);

  // PDF Preview State
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);

  // --- Fetch Studio Info ---
  const fetchStudio = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.STUDIO.GET_STUDIO_BY_ID(user.adminStudioLocation),
      );
      setStudio(response.data);
    } catch (err) {
      console.error("Failed to fetch studio", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.adminStudioLocation) {
      fetchStudio();
    }
  }, [user]);

  // --- Fetch Bookings ---
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(
        API_PATHS.BOOKING.GET_STUDIO_BOOKING,
      );
      setBookings(response.data);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Process Data ---
  const { scheduledClasses, dailyStats, dailyBookings } = useMemo(() => {
    const todaysBookings = bookings.filter(
      (b) =>
        isSameDay(new Date(b.classId?.startTime), selectedDate) &&
        b.status !== "Cancelled",
    );

    const classMap = {};

    todaysBookings.forEach((booking) => {
      const clsId = booking.classId._id;
      if (!classMap[clsId]) {
        classMap[clsId] = {
          ...booking.classId,
          studioName: booking.studioId.studioName,
          instructorId: booking.instructorId,
          students: [],
        };
      }

      const studentData = {
        bookingId: booking._id,
        userId: booking.userId._id,
        fullName: booking.userId.fullName,
        email: booking.userId.email,
        phoneNumber: booking.userId.phoneNumber,
        isAttend: booking.isAttend,
        status: booking.status,
        className: booking.classId.className,
        startTime: booking.classId.startTime,
      };

      classMap[clsId].students.push(studentData);
    });

    let classesArray = Object.values(classMap).sort(
      (a, b) => new Date(a.startTime) - new Date(b.startTime),
    );

    if (searchQuery.trim() !== "") {
      const lowerQuery = searchQuery.toLowerCase();
      classesArray = classesArray.filter((cls) => {
        if (cls.className.toLowerCase().includes(lowerQuery)) return true;
        if (cls.studioName.toLowerCase().includes(lowerQuery)) return true;
        const hasStudent = cls.students.some(
          (s) =>
            s.fullName.toLowerCase().includes(lowerQuery) ||
            s.email.toLowerCase().includes(lowerQuery) ||
            s.bookingId.toLowerCase().includes(lowerQuery),
        );
        if (hasStudent) return true;
        return false;
      });
    }

    const totalStudents = todaysBookings.length;
    const totalAttended = todaysBookings.filter((b) => b.isAttend).length;

    return {
      scheduledClasses: classesArray,
      dailyBookings: todaysBookings,
      dailyStats: {
        totalClasses: Object.keys(classMap).length,
        totalStudents,
        totalAttended,
        attendanceRate:
          totalStudents === 0
            ? 0
            : Math.round((totalAttended / totalStudents) * 100),
      },
    };
  }, [bookings, selectedDate, searchQuery]);

  // Handlers
  const handlePrevDay = () => setSelectedDate(subDays(selectedDate, 1));
  const handleNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  const jumpToToday = () => {
    const now = new Date();
    setSelectedDate(now);
    setCalendarViewDate(now);
    setSearchQuery("");
  };

  const isToday = isSameDay(selectedDate, new Date());

  const handleAttendanceSaved = () => {
    fetchData();
    setSelectedClassDetails(null);
  };

  // --- QR Scan Handler (Updated to handle both Bookings and General Passes) ---
  const handleScanResult = async (results) => {
    if (scanError || scannedBooking || scannedPass) return;

    if (!results || results.length === 0) return;
    const rawValue = results[0]?.rawValue;
    if (!rawValue) return;

    const scannedId = rawValue.trim();

    // 1. Check if it's a specific class booking ticket
    const foundBooking = bookings.find((b) => b._id === scannedId);

    if (foundBooking) {
      const today = new Date();
      const classDate = new Date(foundBooking.classId.startTime);

      if (isSameDay(today, classDate)) {
        setScannedBooking(foundBooking);
        setShowScanner(false);
      } else {
        setScanError({
          type: "wrong_date",
          title: "Wrong Class Date",
          message: `This ticket is for a class scheduled on:`,
          detail: format(classDate, "dd MMMM yyyy"),
          icon: <CalendarClock className='w-8 h-8 text-amber-600' />,
          color: "amber",
        });
      }
    } else {
      // 2. If not a booking, check if it is a general Studio Pass
      try {
        const res = await axiosInstance.get(
          `/api/passes/admin/scan/${scannedId}`,
        );
        setScannedPass(res.data);
        setShowScanner(false);
      } catch (err) {
        setScanError({
          type: "not_found",
          title: "Invalid QR Code",
          message: "We couldn't find a valid booking or active pass.",
          detail:
            err.response?.data?.message ||
            "Check studio location and validity.",
          icon: <AlertTriangle className='w-8 h-8 text-red-600' />,
          color: "red",
        });
      }
    }
  };

  // --- PDF GENERATOR ---
  const generatePDF = () => {
    const doc = new jsPDF();
    const dateStr = format(selectedDate, "EEEE, d MMMM yyyy");

    doc.setFontSize(22);
    doc.setTextColor(6, 78, 59);
    doc.text("Daily Studio Report", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 26);

    autoTable(doc, {
      startY: 32,
      head: [["Date", "Studio Location", "Admin"]],
      body: [
        [
          dateStr,
          studio?.studioName || "HAVA Studio",
          user?.fullName || "Admin",
        ],
      ],
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fontStyle: "bold" },
    });

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Summary Stats", 14, doc.lastAutoTable.finalY + 15);

    const statsData = [
      ["Total Classes", dailyStats.totalClasses],
      ["Total Students Booked", dailyStats.totalStudents],
      ["Students Attended", dailyStats.totalAttended],
      ["Students Absent", dailyStats.totalStudents - dailyStats.totalAttended],
      ["Attendance Rate", `${dailyStats.attendanceRate}%`],
    ];

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 5,
      head: [["Metric", "Value"]],
      body: statsData,
      theme: "striped",
      headStyles: { fillColor: [6, 95, 70] },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 } },
    });

    let finalY = doc.lastAutoTable.finalY + 15;

    if (scheduledClasses.length > 0) {
      doc.setFontSize(14);
      doc.text("Class Overview", 14, finalY);

      const classData = scheduledClasses.map((cls) => {
        const instructorName =
          cls.instructorId?.fullName || "Unknown Instructor";
        const attendedCount = cls.students.filter((s) => s.isAttend).length;

        return [
          `${format(new Date(cls.startTime), "HH:mm")} - ${format(new Date(cls.endTime), "HH:mm")}`,
          cls.className,
          instructorName,
          `${attendedCount} / ${cls.capacity || cls.students.length}`,
          cls.classType,
        ];
      });

      autoTable(doc, {
        startY: finalY + 7,
        head: [["Time", "Class Name", "Instructor", "Attendance", "Type"]],
        body: classData,
        theme: "grid",
        headStyles: { fillColor: [31, 41, 55] },
        styles: { fontSize: 9 },
      });

      finalY = doc.lastAutoTable.finalY + 15;

      if (finalY > 250) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(6, 78, 59);
      doc.text("Detailed Student Lists", 14, finalY);
      finalY += 10;

      scheduledClasses.forEach((cls) => {
        const studentBody = cls.students.map((s) => [
          s.fullName,
          s.phoneNumber || "-",
          s.email || "-",
          s.isAttend ? "Present" : "Absent",
        ]);

        if (studentBody.length === 0)
          studentBody.push(["No students enrolled", "-", "-", "-"]);

        if (finalY > 260) {
          doc.addPage();
          finalY = 20;
        }

        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont(undefined, "bold");
        doc.text(
          `${format(new Date(cls.startTime), "HH:mm")} - ${cls.className}`,
          14,
          finalY,
        );
        doc.setFont(undefined, "normal");

        autoTable(doc, {
          startY: finalY + 3,
          head: [["Student Name", "Phone", "Email", "Status"]],
          body: studentBody,
          theme: "grid",
          styles: { fontSize: 9 },
          headStyles: {
            fillColor: [209, 213, 219],
            textColor: 0,
            fontStyle: "bold",
          },
          didParseCell: function (data) {
            if (data.section === "body" && data.column.index === 3) {
              if (data.cell.raw === "Present")
                data.cell.styles.textColor = [5, 150, 105];
              else if (data.cell.raw === "Absent")
                data.cell.styles.textColor = [220, 38, 38];
            }
          },
        });

        finalY = doc.lastAutoTable.finalY + 10;
      });
    } else {
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text("No classes scheduled for this date.", 14, finalY);
      finalY += 20;
    }

    if (finalY > 240) {
      doc.addPage();
      finalY = 40;
    } else {
      finalY += 20;
    }

    const startYFooter = finalY;
    doc.setFont(undefined, "bold");
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Studio Information:", 14, startYFooter);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(studio?.studioName || "HAVA Studio", 14, startYFooter + 6);

    const sigX = 130;
    doc.setFont(undefined, "normal");
    doc.setTextColor(0);
    doc.setFontSize(10);
    doc.text("Verified & Approved By:", sigX, startYFooter);
    doc.setLineWidth(0.5);
    doc.line(sigX, startYFooter + 30, sigX + 60, startYFooter + 30);
    doc.setFont(undefined, "bold");
    doc.text(user?.fullName || "Admin", sigX, startYFooter + 37);
    doc.setFont(undefined, "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(
      `Date: ${format(new Date(), "dd/MM/yyyy")}`,
      sigX,
      startYFooter + 43,
    );

    return doc;
  };

  const handlePreviewReport = () => {
    const doc = generatePDF();
    setPdfUrl(doc.output("bloburl"));
    setShowPdfPreview(true);
  };

  const handleDownloadReport = () => {
    const doc = generatePDF();
    doc.save(`Report_${format(selectedDate, "yyyy-MM-dd")}.pdf`);
  };

  if (loading && bookings.length === 0)
    return (
      <div className='flex h-screen items-center justify-center bg-gray-50'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='max-w-480 mx-auto h-full flex flex-col lg:flex-row bg-gray-50 overflow-hidden relative'>
      {/* LEFT COLUMN */}
      <div className='flex-1 flex flex-col h-full overflow-hidden order-2 lg:order-1'>
        {/* MOBILE HEADER */}
        <div className='lg:hidden bg-white border-b border-gray-200 px-4 py-3 shrink-0 z-20 shadow-sm'>
          <div className='mb-3 relative flex items-center gap-2'>
            <div className='relative flex-1'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
              <input
                type='text'
                placeholder='Search...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-9 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all'
              />
              <button
                onClick={() => setShowScanner(true)}
                className='absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-emerald-600 transition-colors'>
                <QrCode className='w-4 h-4' />
              </button>
            </div>
          </div>
          <div className='flex items-center justify-between mb-3'>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setShowCalendarModal(true)}
                className='p-2 bg-emerald-50 text-emerald-900 rounded-lg hover:bg-emerald-100 transition-colors'>
                <CalendarIcon className='w-5 h-5' />
              </button>
              <div>
                <h2 className='text-lg font-bold text-gray-900 leading-tight'>
                  {format(selectedDate, "EEE, dd MMM")}
                </h2>
                <p className='text-xs text-gray-400 font-medium'>
                  Daily Schedule
                </p>
              </div>
            </div>
            <div className='flex gap-1'>
              <button
                onClick={handlePrevDay}
                className='p-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 text-gray-500'>
                <ChevronLeft className='w-5 h-5' />
              </button>
              <button
                onClick={handleNextDay}
                className='p-1.5 rounded-lg border border-gray-100 hover:bg-gray-50 text-gray-500'>
                <ChevronRight className='w-5 h-5' />
              </button>
            </div>
          </div>
          {/* Mobile Stats */}
          <div
            className={`grid gap-4 ${isToday ? "grid-cols-2" : "grid-cols-3"}`}>
            <div className='flex-1 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100'>
              <div className='w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center'>
                <Users className='w-3 h-3 text-gray-600' />
              </div>
              <div>
                <span className='block text-xs text-gray-400 font-medium uppercase tracking-wider'>
                  Students
                </span>
                <span className='block text-sm font-bold text-gray-900 leading-none'>
                  {dailyStats.totalStudents}
                </span>
              </div>
            </div>
            <div className='flex-1 flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-100'>
              <div className='w-6 h-6 rounded-full bg-white border border-gray-200 flex items-center justify-center'>
                <Briefcase className='w-3 h-3 text-gray-600' />
              </div>
              <div>
                <span className='block text-xs text-gray-400 font-medium uppercase tracking-wider'>
                  Classes
                </span>
                <span className='block text-sm font-bold text-gray-900 leading-none'>
                  {dailyStats.totalClasses}
                </span>
              </div>
            </div>
            {!isToday && (
              <button
                onClick={jumpToToday}
                className='flex flex-col items-center justify-center px-3 py-2 bg-emerald-900 text-white rounded-lg shadow-sm active:scale-95 transition-all'>
                <RotateCcw className='w-4 h-4 mb-0.5' />
                <span className='text-[10px] font-bold uppercase'>Today</span>
              </button>
            )}
          </div>
        </div>

        {/* DESKTOP CONTENT */}
        <div className='flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 custom-scrollbar bg-gray-50'>
          <div className='hidden lg:flex mb-8 justify-between items-end gap-6'>
            <div>
              <h1 className='text-3xl font-bold text-gray-900'>
                {format(selectedDate, "d MMMM, yyyy")}
              </h1>
              <p className='text-gray-500 mt-1 font-medium'>
                Today's Studio Schedule
              </p>
            </div>
            <div className='flex items-center gap-3 flex-1 justify-end'>
              <div className='relative w-full max-w-md group flex items-center gap-2'>
                <div className='relative flex-1'>
                  <div className='absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none'>
                    <Search className='h-5 w-5 text-gray-400' />
                  </div>
                  <input
                    type='text'
                    className='block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 sm:text-sm transition-all shadow-sm'
                    placeholder='Search...'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setShowScanner(true)}
                  className='p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all shadow-md flex items-center gap-2 whitespace-nowrap'>
                  <QrCode className='w-5 h-5' />
                  <span className='text-sm font-bold hidden xl:block'>
                    Scan
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className='space-y-4 pb-20'>
            {scheduledClasses.length > 0 ? (
              scheduledClasses.map((cls) => (
                <div
                  key={cls._id}
                  onClick={() => setSelectedClassDetails(cls)}
                  className='bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group overflow-hidden'>
                  <div
                    className={`h-1.5 w-full ${cls.classType === "Private" ? "bg-purple-500" : "bg-blue-500"}`}></div>
                  <div className='p-5 md:p-6'>
                    <div className='flex justify-between items-start mb-3'>
                      <div className='flex items-center gap-3'>
                        <div className='px-3 py-1.5 bg-gray-900 text-white rounded-lg text-sm font-bold shadow-sm'>
                          {format(new Date(cls.startTime), "HH:mm")}
                          <span className='text-gray-400 font-normal mx-1'>
                            -
                          </span>
                          {format(new Date(cls.endTime), "HH:mm")}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${cls.classType === "Private" ? "bg-purple-50 text-purple-700 border border-purple-100" : "bg-blue-50 text-blue-700 border border-blue-100"}`}>
                          {cls.classType}
                        </span>
                      </div>
                    </div>
                    <div className='flex flex-col md:flex-row md:items-center justify-between gap-4'>
                      <div>
                        <h3 className='text-xl font-bold text-gray-900 mb-2 group-hover:text-emerald-900 transition-colors'>
                          {cls.className}
                        </h3>
                        <div className='flex items-center text-sm text-gray-500 gap-4'>
                          <span className='flex items-center gap-1.5'>
                            <MapPin className='w-4 h-4 text-emerald-600' />{" "}
                            {cls.studioName}
                          </span>
                          <span className='flex items-center gap-1.5'>
                            <Clock className='w-4 h-4 text-emerald-600' />{" "}
                            {cls.duration} min
                          </span>
                        </div>
                      </div>
                      <div className='flex items-center gap-3 mt-2 md:mt-0'>
                        <div className='flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-md border border-gray-100'>
                          <span className='text-xs font-bold text-gray-500'>
                            {cls.students.filter((s) => s.isAttend).length}/
                            {cls.capacity || cls.students.length}
                          </span>
                          <div className='w-2 h-2 rounded-full bg-emerald-500'></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className='flex flex-col items-center justify-center py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200 m-4'>
                <div className='w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4'>
                  <CalendarIcon className='w-8 h-8 text-gray-300' />
                </div>
                <h3 className='text-gray-900 font-bold text-lg'>
                  No classes scheduled
                </h3>
                <p className='text-gray-400 text-sm mt-1 max-w-xs'>
                  There are no active sessions for{" "}
                  {format(selectedDate, "MMMM do")}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN */}
      <div className='hidden lg:flex w-100 xl:w-112.5 bg-white border-l border-gray-200 p-8 flex-col gap-8 h-full overflow-y-auto shrink-0 order-2'>
        <div className='space-y-4'>
          <DigitalClock />
          {!isSameDay(selectedDate, new Date()) && (
            <button
              onClick={jumpToToday}
              className='w-full px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 shadow-sm transition-all active:scale-95 whitespace-nowrap'>
              Jump to Today
            </button>
          )}
          <MiniCalendar
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            forceViewDate={calendarViewDate}
          />

          <div className='grid grid-cols-2 gap-4'>
            <div className='bg-gray-900 text-white p-6 rounded-2xl shadow-xl shadow-gray-200 relative overflow-hidden flex items-center justify-between'>
              <div className='relative z-10'>
                <p className='text-gray-400 text-xs font-bold uppercase tracking-wider'>
                  Total Students
                </p>
                <h2 className='text-4xl font-bold mt-1'>
                  {dailyStats.totalStudents}
                </h2>
              </div>
              <Users className='w-12 h-12 text-white' />
            </div>
            <div className='bg-emerald-50 text-emerald-900 p-6 rounded-2xl border border-emerald-100 flex items-center justify-between'>
              <div>
                <p className='text-emerald-600 text-xs font-bold uppercase tracking-wider'>
                  Total Classes
                </p>
                <h2 className='text-3xl font-bold mt-1'>
                  {dailyStats.totalClasses}
                </h2>
              </div>
              <Clock className='w-12 h-12 text-emerald-600' />
            </div>
          </div>

          <div
            onClick={() => setShowAttendanceDetails(true)}
            className='bg-white border border-gray-200 p-6 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-200 transition-all cursor-pointer group'>
            <div className='flex justify-between mb-2 items-center'>
              <div className='flex items-center gap-2'>
                <div className='p-2 bg-blue-50 text-blue-600 rounded-lg'>
                  <UserCheck className='w-5 h-5' />
                </div>
                <h3 className='font-bold text-gray-900'>Attendance</h3>
              </div>
              <span className='text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md group-hover:bg-blue-100 transition-colors'>
                View Details
              </span>
            </div>
            <div className='mb-2 flex justify-between text-xs font-medium text-gray-500'>
              <span>{dailyStats.totalAttended} Present</span>
              <span>
                {dailyStats.totalStudents - dailyStats.totalAttended} Absent
              </span>
            </div>
            <div className='w-full h-3 bg-gray-100 rounded-full overflow-hidden flex'>
              <div
                className='h-full bg-blue-500 transition-all duration-500'
                style={{ width: `${dailyStats.attendanceRate}%` }}></div>
            </div>
          </div>

          <div className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm'>
            <div className='flex items-center gap-3 mb-4'>
              <div className='p-2 bg-purple-50 rounded-lg text-purple-600'>
                <FileText className='w-5 h-5' />
              </div>
              <div>
                <h3 className='font-bold text-gray-900'>Daily Summary</h3>
                <p className='text-xs text-gray-500'>Preview & Download PDF</p>
              </div>
            </div>
            <button
              onClick={handlePreviewReport}
              className='w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-md'>
              <Eye className='w-4 h-4' /> Preview Report
            </button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* 1. QR Scanner Modal (with Error Overlay) */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm'>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className='bg-white w-full max-w-sm rounded-3xl overflow-hidden relative shadow-2xl flex flex-col h-[500px]'>
              <button
                onClick={() => {
                  setShowScanner(false);
                  setScanError(null);
                }}
                className='absolute top-4 right-4 z-20 p-2 bg-black/30 text-white rounded-full hover:bg-black/50 backdrop-blur-md transition-colors'>
                <X className='w-5 h-5' />
              </button>

              <div className='p-6 pb-2 text-center bg-white z-10 relative'>
                <h3 className='text-xl font-bold text-gray-900'>
                  Scan QR Code
                </h3>
                <p className='text-sm text-gray-500'>
                  Point camera at booking ticket or pass
                </p>
              </div>

              <div className='flex-1 relative bg-black overflow-hidden m-4 rounded-2xl'>
                {!scanError && (
                  <>
                    <Scanner
                      onScan={handleScanResult}
                      components={{
                        audio: false,
                        onOff: false,
                        torch: false,
                        zoom: false,
                        finder: false,
                      }}
                      styles={{
                        container: { width: "100%", height: "100%" },
                        video: {
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        },
                      }}
                    />
                    <div className='absolute inset-0 pointer-events-none flex items-center justify-center z-10'>
                      <div className='w-56 h-56 border-2 border-white/50 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]'>
                        <ScanLine className='w-full h-full text-emerald-500/80 animate-pulse p-4' />
                        <div className='absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-emerald-500 -mt-1 -ml-1 rounded-tl-lg'></div>
                        <div className='absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-emerald-500 -mt-1 -mr-1 rounded-tr-lg'></div>
                        <div className='absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-emerald-500 -mb-1 -ml-1 rounded-bl-lg'></div>
                        <div className='absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-emerald-500 -mb-1 -mr-1 rounded-br-lg'></div>
                      </div>
                    </div>
                  </>
                )}

                {/* ERROR OVERLAY */}
                <AnimatePresence>
                  {scanError && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className='absolute inset-0 z-30 bg-white/10 backdrop-blur-md flex items-center justify-center p-6'>
                      <div className='bg-white w-full rounded-2xl shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200'>
                        <div
                          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${scanError.color === "amber" ? "bg-amber-50" : "bg-red-50"}`}>
                          {scanError.icon}
                        </div>
                        <h4 className='text-xl font-bold text-gray-900 mb-2'>
                          {scanError.title}
                        </h4>
                        <p className='text-sm text-gray-500 mb-1'>
                          {scanError.message}
                        </p>
                        <p className='text-base font-bold text-gray-900 mb-6'>
                          {scanError.detail}
                        </p>
                        <button
                          onClick={() => setScanError(null)}
                          className='w-full py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg'>
                          Scan Again
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. Success Result Modal (For Class Booking Tickets) */}
      <AnimatePresence>
        {scannedBooking && (
          <ScanResultModal
            booking={scannedBooking}
            onClose={() => setScannedBooking(null)}
            onSuccess={() => {
              fetchData();
              setScannedBooking(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* 3. NEW: Success Result Modal (For General Studio Passes) */}
      <AnimatePresence>
        {scannedPass && (
          <PassScanResultModal
            pass={scannedPass}
            scheduledClasses={scheduledClasses}
            onClose={() => setScannedPass(null)}
            onSuccess={() => {
              fetchData();
              setScannedPass(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* 4. Helper Modals */}
      <AnimatePresence>
        {selectedClassDetails && (
          <ClassDetailsModal
            cls={selectedClassDetails}
            onClose={() => setSelectedClassDetails(null)}
            onSaveSuccess={handleAttendanceSaved}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showAttendanceDetails && (
          <AttendanceSummaryModal
            date={selectedDate}
            bookings={dailyBookings}
            onClose={() => setShowAttendanceDetails(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCalendarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'>
            <div className='bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 relative'>
              <button
                onClick={() => setShowCalendarModal(false)}
                className='absolute top-4 right-4 p-2 bg-gray-100 rounded-full'>
                <X className='w-5 h-5 text-gray-600' />
              </button>
              <MiniCalendar
                selectedDate={selectedDate}
                onSelectDate={(d) => {
                  setSelectedDate(d);
                  setShowCalendarModal(false);
                }}
                forceViewDate={calendarViewDate}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showPdfPreview && pdfUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className='fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md'>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className='bg-white w-full max-w-4xl h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col relative'>
              <div className='flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white'>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Report Preview
                  </h2>
                  <p className='text-sm text-gray-500'>
                    {format(selectedDate, "dd MMMM yyyy")}
                  </p>
                </div>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={handleDownloadReport}
                    className='flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm'>
                    <Download className='w-4 h-4' /> Download PDF
                  </button>
                  <button
                    onClick={() => setShowPdfPreview(false)}
                    className='p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors text-gray-600'>
                    <X className='w-5 h-5' />
                  </button>
                </div>
              </div>
              <div className='flex-1 bg-gray-100'>
                <iframe
                  src={pdfUrl}
                  className='w-full h-full border-none'
                  title='PDF Preview'
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- HELPER COMPONENTS ---

const DigitalClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className='bg-gray-900 text-white p-6 rounded-2xl shadow-md flex flex-col items-center text-center'>
      <h3 className='text-4xl font-bold font-mono tracking-wider'>
        {format(time, "HH:mm:ss")}
      </h3>
      <p className='text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1'>
        {format(time, "EEEE, d MMM")}
      </p>
    </div>
  );
};

const ScanResultModal = ({ booking, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const handleCheckIn = async () => {
    setLoading(true);
    try {
      await axiosInstance.put(API_PATHS.BOOKING.STUDENT_CHECK_IN(booking._id), {
        isAttend: !booking.isAttend,
      });
      onSuccess();
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
      setLoading(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md'>
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className='bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden relative'>
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors'>
          <X className='w-5 h-5 text-gray-600' />
        </button>
        <div className='p-8 text-center'>
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${booking.isAttend ? "bg-emerald-100 text-emerald-600" : "bg-blue-100 text-blue-600"}`}>
            {booking.isAttend ? (
              <CheckCircle2 className='w-10 h-10' />
            ) : (
              <UserCheck className='w-10 h-10' />
            )}
          </div>
          <h2 className='text-2xl font-bold text-gray-900 mb-1'>
            {booking.userId?.fullName}
          </h2>
          <p className='text-gray-500 text-sm mb-6'>{booking.userId?.email}</p>
          <div className='bg-gray-50 rounded-2xl p-4 text-left space-y-3 mb-6'>
            <div>
              <p className='text-xs font-bold text-gray-400 uppercase'>Class</p>
              <p className='font-bold text-gray-900'>
                {booking.classId?.className}
              </p>
            </div>
            <div className='flex justify-between'>
              <div>
                <p className='text-xs font-bold text-gray-400 uppercase'>
                  Time
                </p>
                <p className='font-bold text-gray-900'>
                  {booking.classId?.startTime
                    ? format(new Date(booking.classId.startTime), "HH:mm")
                    : "-"}
                </p>
              </div>
              <div className='text-right'>
                <p className='text-xs font-bold text-gray-400 uppercase'>
                  Status
                </p>
                <span
                  className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${booking.isAttend ? "bg-emerald-100 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                  {booking.isAttend ? "Present" : "Not Checked In"}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2 ${booking.isAttend ? "bg-gray-100 text-gray-600 hover:bg-gray-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}>
            {loading ? (
              <LoadingSpinner size='sm' />
            ) : booking.isAttend ? (
              "Undo Check-In"
            ) : (
              "Check In Now"
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// --- NEW COMPONENT: Pass Scan Result Modal ---
const PassScanResultModal = ({
  pass,
  scheduledClasses,
  onClose,
  onSuccess,
}) => {
  const [loadingId, setLoadingId] = useState(null);

  // Filter scheduled classes to find ones eligible for this pass
  const eligibleClasses = scheduledClasses.filter((cls) => {
    const matchInstructor = pass.instructorType?.includes(cls.instructorType);
    const matchClass = pass.classType?.includes(cls.classType);
    // You can optionally filter out full classes: const hasSpace = cls.students.length < (cls.capacity || 99);
    return matchInstructor && matchClass;
  });

  const handleAssignAndDeduct = async (cls) => {
    if (
      !window.confirm(
        `Book and check-in ${pass.userId?.fullName} for ${cls.className}?`,
      )
    )
      return;

    setLoadingId(cls._id);
    try {
      // 1. Create the booking directly via backend
      const bookRes = await axiosInstance.post(
        API_PATHS.BOOKING.CREATE_BOOKING,
        {
          classId: cls._id,
          passId: pass._id,
          targetUserId: pass.userId._id || pass.userId,
        },
      );

      const newBookingId = bookRes.data.booking._id;

      // 2. Immediately mark the booking as attended
      await axiosInstance.put(
        API_PATHS.BOOKING.STUDENT_CHECK_IN(newBookingId),
        {
          isAttend: true,
        },
      );

      alert("Successfully assigned, deducted, and checked in!");
      onSuccess();
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.message ||
          "Failed to assign pass.",
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md'>
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className='bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]'>
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50'>
          <h2 className='text-xl font-bold text-gray-900 flex items-center gap-2'>
            <Ticket className='w-5 h-5 text-emerald-600' /> General Pass Scanned
          </h2>
          <button
            onClick={onClose}
            className='p-2 bg-white rounded-full hover:bg-gray-200 transition-colors shadow-sm'>
            <X className='w-5 h-5 text-gray-600' />
          </button>
        </div>

        <div className='p-6 bg-white border-b border-gray-100 flex items-center gap-4'>
          <div className='w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center font-bold text-xl'>
            {pass.userId?.fullName?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className='flex-1'>
            <h3 className='font-bold text-gray-900 text-lg'>
              {pass.userId?.fullName}
            </h3>
            <p className='text-sm text-gray-500 line-clamp-1'>
              {pass.packageId?.packageName || "Studio Pass"}
            </p>
          </div>
          <div className='text-right'>
            <p className='text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1'>
              Balance
            </p>
            <p className='text-2xl font-bold text-emerald-600 leading-none'>
              {pass.remainingCredits}
            </p>
          </div>
        </div>

        <div className='p-6 flex-1 overflow-y-auto bg-gray-50 custom-scrollbar'>
          <h4 className='text-sm font-bold text-gray-900 mb-4 uppercase tracking-wider'>
            Eligible Classes Today
          </h4>

          {eligibleClasses.length > 0 ? (
            <div className='space-y-3'>
              {eligibleClasses.map((cls) => (
                <div
                  key={cls._id}
                  className='bg-white p-4 rounded-xl border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm'>
                  <div>
                    <h5 className='font-bold text-gray-900'>{cls.className}</h5>
                    <p className='text-sm text-gray-500 font-medium mt-1'>
                      {format(new Date(cls.startTime), "HH:mm")} -{" "}
                      {format(new Date(cls.endTime), "HH:mm")}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAssignAndDeduct(cls)}
                    disabled={loadingId === cls._id}
                    className='w-full sm:w-auto px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition-colors shadow-sm whitespace-nowrap flex justify-center'>
                    {loadingId === cls._id ? (
                      <LoadingSpinner size='sm' />
                    ) : (
                      "Assign & Check-in"
                    )}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200'>
              <AlertCircle className='w-10 h-10 text-gray-300 mx-auto mb-3' />
              <p className='text-gray-900 font-bold'>No Eligible Classes</p>
              <p className='text-gray-500 text-sm mt-1 max-w-xs mx-auto'>
                This pass cannot be used for any remaining classes scheduled for
                today.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

const AttendanceSummaryModal = ({ date, bookings, onClose }) => {
  const present = bookings.filter((b) => b.isAttend);
  const absent = bookings.filter((b) => !b.isAttend);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className='bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 relative flex flex-col max-h-[85vh]'>
        <button
          onClick={onClose}
          className='absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors'>
          <X className='w-5 h-5 text-gray-600' />
        </button>
        <div className='mb-6'>
          <h2 className='text-xl font-bold text-gray-900'>Attendance Log</h2>
          <p className='text-sm text-gray-500'>
            {format(date, "EEEE, d MMMM yyyy")}
          </p>
        </div>
        <div className='flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6'>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <div className='w-2 h-2 rounded-full bg-emerald-500'></div>
              <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider'>
                Present ({present.length})
              </h3>
            </div>
            {present.length > 0 ? (
              <div className='space-y-2'>
                {present.map((p) => (
                  <div
                    key={p._id}
                    className='flex justify-between items-center p-3 bg-emerald-50/50 rounded-xl border border-emerald-100'>
                    <div>
                      <p className='text-sm font-bold text-gray-900'>
                        {p.userId?.fullName}
                      </p>
                      <p className='text-xs text-gray-500'>
                        {p.classId?.className}
                      </p>
                    </div>
                    <span className='text-xs font-mono text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-100'>
                      {format(new Date(p.classId?.startTime), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-gray-400 italic pl-4'>
                No one has checked in yet.
              </p>
            )}
          </div>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <div className='w-2 h-2 rounded-full bg-gray-300'></div>
              <h3 className='text-sm font-bold text-gray-900 uppercase tracking-wider'>
                Not Checked In ({absent.length})
              </h3>
            </div>
            {absent.length > 0 ? (
              <div className='space-y-2'>
                {absent.map((a) => (
                  <div
                    key={a._id}
                    className='flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100 opacity-75'>
                    <div>
                      <p className='text-sm font-bold text-gray-700'>
                        {a.userId?.fullName}
                      </p>
                      <p className='text-xs text-gray-500'>
                        {a.classId?.className}
                      </p>
                    </div>
                    <span className='text-xs font-mono text-gray-500 bg-white px-2 py-1 rounded border border-gray-200'>
                      {format(new Date(a.classId?.startTime), "HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className='text-sm text-gray-400 italic pl-4'>
                Everyone is present!
              </p>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const ClassDetailsModal = ({ cls, onClose, onSaveSuccess }) => {
  const [attendanceState, setAttendanceState] = useState({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    const initial = {};
    cls.students.forEach((s) => {
      initial[s.bookingId] = s.isAttend;
    });
    setAttendanceState(initial);
  }, [cls]);
  const hasChanges = useMemo(() => {
    return cls.students.some(
      (s) => attendanceState[s.bookingId] !== s.isAttend,
    );
  }, [attendanceState, cls]);
  const totalStudents = cls.students.length;
  const attendedCount = Object.values(attendanceState).filter(Boolean).length;
  const progressPercent =
    totalStudents === 0 ? 0 : (attendedCount / totalStudents) * 100;
  const toggleAttendance = (bookingId) => {
    setAttendanceState((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const changedStudents = cls.students.filter(
        (student) => attendanceState[student.bookingId] !== student.isAttend,
      );
      const apiCalls = changedStudents.map((student) => {
        return axiosInstance.put(
          API_PATHS.BOOKING.STUDENT_CHECK_IN(student.bookingId),
          { isAttend: attendanceState[student.bookingId] },
        );
      });
      await Promise.all(apiCalls);
      onSaveSuccess();
    } catch (error) {
      console.error("Save failed", error);
      setIsSaving(false);
      setShowConfirm(false);
    }
  };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className='fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm'>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className='bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]'>
        <div className='p-6 pb-2'>
          <button
            onClick={onClose}
            className='absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors z-10'>
            <X className='w-5 h-5 text-gray-600' />
          </button>
          <span
            className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 ${cls.classType === "Private" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"}`}>
            {cls.classType}
          </span>
          <h2 className='text-2xl font-bold text-gray-900 mb-1 pr-8'>
            {cls.className}
          </h2>
          <p className='text-emerald-700 font-bold'>
            {format(new Date(cls.startTime), "HH:mm")} -{" "}
            {format(new Date(cls.endTime), "HH:mm")}
          </p>
        </div>
        <div className='px-6 py-4 bg-gray-50 border-y border-gray-100'>
          <div className='flex justify-between items-end mb-2'>
            <span className='text-xs font-bold text-gray-400 uppercase tracking-wider'>
              Attendance Progress
            </span>
            <span className='text-sm font-bold text-emerald-900'>
              {attendedCount}{" "}
              <span className='text-gray-400 font-normal'>
                / {totalStudents} present
              </span>
            </span>
          </div>
          <div className='h-2 w-full bg-gray-200 rounded-full overflow-hidden'>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className='h-full bg-emerald-500 rounded-full'
            />
          </div>
        </div>
        <div className='flex-1 overflow-y-auto p-6 custom-scrollbar'>
          <div className='space-y-3'>
            {cls.students.length > 0 ? (
              cls.students.map((student, idx) => {
                const isCheckedIn = attendanceState[student.bookingId];
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isCheckedIn ? "bg-emerald-50 border-emerald-200" : "bg-white border-gray-100"}`}>
                    <div
                      className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${isCheckedIn ? "bg-white border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-100 text-gray-500"}`}>
                      {student.fullName
                        ? student.fullName.charAt(0).toUpperCase()
                        : "U"}
                    </div>
                    <div className='flex-1 min-w-0'>
                      <p
                        className={`text-sm font-bold truncate ${isCheckedIn ? "text-emerald-900" : "text-gray-900"}`}>
                        {student.fullName}
                      </p>
                      <p className='text-xs text-gray-500 truncate'>
                        {student.phoneNumber}
                      </p>
                      <p className='text-xs text-gray-500 truncate'>
                        {student.email}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleAttendance(student.bookingId)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${isCheckedIn ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-200 hover:bg-emerald-600" : "bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50"}`}>
                      {isCheckedIn ? (
                        <>
                          <CheckCircle2 className='w-3.5 h-3.5' /> Checked In
                        </>
                      ) : (
                        <>
                          <Circle className='w-3.5 h-3.5' /> Check In
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            ) : (
              <p className='text-gray-400 text-sm text-center py-4'>
                No students enrolled.
              </p>
            )}
          </div>
        </div>
        <AnimatePresence>
          {hasChanges && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className='p-4 border-t border-gray-100 bg-white'>
              <button
                onClick={() => setShowConfirm(true)}
                className='w-full py-3.5 bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 transition-colors shadow-lg flex items-center justify-center gap-2'>
                <Save className='w-4 h-4' /> Save Changes
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {showConfirm && (
          <div className='absolute inset-0 z-20 bg-white/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in'>
            <div className='bg-white border border-gray-100 shadow-2xl rounded-3xl p-6 w-full max-w-xs text-center'>
              <div className='w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4'>
                <AlertCircle className='w-6 h-6' />
              </div>
              <h3 className='text-lg font-bold text-gray-900 mb-2'>
                Save Changes?
              </h3>
              <div className='flex gap-3 mt-6'>
                <button
                  onClick={() => setShowConfirm(false)}
                  className='flex-1 py-2.5 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200'>
                  Cancel
                </button>
                <button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className='flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700'>
                  {isSaving ? "Saving..." : "Yes, Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

const MiniCalendar = ({ selectedDate, onSelectDate, forceViewDate }) => {
  const [viewDate, setViewDate] = useState(selectedDate);
  useEffect(() => {
    if (forceViewDate) setViewDate(forceViewDate);
  }, [forceViewDate]);
  const monthStart = startOfMonth(viewDate);
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const padding = Array(startDay).fill(null);
  const months = [
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
  const currentYear = getYear(new Date());
  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i);
  const handleMonthChange = (e) =>
    setViewDate(setMonth(viewDate, months.indexOf(e.target.value)));
  const handleYearChange = (e) =>
    setViewDate(setYear(viewDate, parseInt(e.target.value)));
  return (
    <div className='bg-gray-50 p-4 rounded-2xl border border-gray-200 select-none'>
      <div className='flex justify-between items-center mb-4 gap-2'>
        <button
          onClick={() => setViewDate((prev) => addMonths(prev, -1))}
          className='p-1 hover:bg-white hover:shadow-sm rounded-lg'>
          <ChevronLeft className='w-4 h-4 text-gray-600' />
        </button>
        <div className='flex gap-2'>
          <select
            value={months[getMonth(viewDate)]}
            onChange={handleMonthChange}
            className='bg-transparent text-sm font-bold text-gray-900 outline-none cursor-pointer hover:bg-gray-100 p-1 rounded'>
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={getYear(viewDate)}
            onChange={handleYearChange}
            className='bg-transparent text-sm font-bold text-gray-900 outline-none cursor-pointer hover:bg-gray-100 p-1 rounded'>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setViewDate((prev) => addMonths(prev, 1))}
          className='p-1 hover:bg-white hover:shadow-sm rounded-lg'>
          <ChevronRight className='w-4 h-4 text-gray-600' />
        </button>
      </div>
      <div className='grid grid-cols-7 gap-1 text-center mb-2'>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span
            key={i}
            className='text-[10px] font-bold text-gray-400 uppercase'>
            {d}
          </span>
        ))}
      </div>
      <div className='grid grid-cols-7 gap-1'>
        {padding.map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={day.toString()}
              onClick={() => onSelectDate(day)}
              className={`h-8 w-full rounded-lg flex items-center justify-center text-xs font-medium transition-all ${isSelected ? "bg-emerald-900 text-white shadow-md font-bold" : "text-gray-700 hover:bg-white hover:shadow-sm"}`}>
              {format(day, "d")}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboard;
