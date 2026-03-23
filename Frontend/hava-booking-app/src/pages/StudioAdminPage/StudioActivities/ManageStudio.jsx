import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  CreditCard,
  Briefcase,
  Package,
  Calendar,
  DollarSign,
  ChevronRight,
  ChevronLeft,
  TicketPercent, // <-- New icon for Promos
} from "lucide-react";

// Components (Ensure paths are correct)
import ManageInstructors from "./components/ManageInstructors/ManageInstructors";
import ClientManager from "./components/ManageClients/ClientManager";
import AdminPaymentManager from "./components/ManagePurchases/AdminPaymentManager";
import ManagePackage from "./components/ManagePackage/ManagePackage";
import RevenueDetails from "./components/StudioRevenue/RevenueDetails";
import SchedulesList from "./components/ManageSchedules/SchedulesList";
import ManagePromos from "./components/ManagePromos/ManagePromos";

const StudioActivities = () => {
  const [activeTab, setActiveTab] = useState("package");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setIsExpanded(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const mainTabs = [
    {
      id: "package",
      label: "Packages",
      icon: Package,
      color: "text-emerald-600",
    },
    {
      id: "promos",
      label: "Promos",
      icon: TicketPercent,
      color: "text-rose-500",
    },
    {
      id: "schedule",
      label: "Schedules",
      icon: Calendar,
      color: "text-blue-600",
    },
  ];

  const extraTabs = [
    {
      id: "payments",
      label: "Payments",
      icon: CreditCard,
      color: "text-purple-600",
    },
    {
      id: "instructors",
      label: "Instructors",
      icon: Briefcase,
      color: "text-orange-600",
    },
    { id: "clients", label: "Clients", icon: Users, color: "text-pink-600" },
    {
      id: "revenue",
      label: "Revenue",
      icon: DollarSign,
      color: "text-teal-600",
    },
  ];

  const displayedTabs = isMobile
    ? isExpanded
      ? extraTabs
      : mainTabs
    : [...mainTabs, ...extraTabs];

  const renderTabButton = (tab) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-xl transition-all duration-200 border whitespace-nowrap ${
          isActive
            ? `bg-gray-900 text-white border-gray-900 shadow-md`
            : "bg-white border-transparent hover:bg-gray-50 text-gray-500 hover:text-gray-900"
        }`}>
        <Icon className={`w-5 h-5 ${isActive ? "text-white" : tab.color}`} />
        <span className='text-sm font-bold'>{tab.label}</span>
      </button>
    );
  };

  return (
    <div className='h-[100dvh] bg-gray-50 overflow-hidden flex flex-col'>
      {/* --- HEADER --- */}
      <div className='bg-white px-6 pt-6 pb-2 shrink-0'>
        <h1 className='text-2xl font-bold text-gray-900'>Studio Management</h1>
        <p className='text-gray-500 text-sm'>
          Centralized control for your studio's operations.
        </p>
      </div>

      {/* --- NAVIGATION --- */}
      <div className='bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center gap-3 relative z-20 shadow-sm shrink-0'>
        <div className='overflow-hidden min-w-0 flex-1'>
          <div className='flex gap-2 overflow-x-auto scrollbar-hide w-full'>
            <AnimatePresence>
              {displayedTabs.map(renderTabButton)}
            </AnimatePresence>
          </div>
        </div>

        {isMobile && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 text-gray-500 transition-colors shadow-sm bg-white shrink-0 ${
              isExpanded ? "bg-gray-100 ring-2 ring-gray-200" : ""
            }`}>
            {isExpanded ? (
              <ChevronLeft className='w-5 h-5' />
            ) : (
              <ChevronRight className='w-5 h-5' />
            )}
          </button>
        )}
      </div>

      {/* --- CONTENT AREA --- */}
      <div className='flex-1 overflow-y-auto p-0 relative w-full'>
        <AnimatePresence>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className='min-h-full'>
            {activeTab === "package" && <ManagePackage isEmbedded={true} />}
            {activeTab === "promos" && <ManagePromos isEmbedded={true} />}
            {activeTab === "schedule" && <SchedulesList isEmbedded={true} />}
            {/* <-- New Tab Component Render */}
            {activeTab === "instructors" && (
              <ManageInstructors isEmbedded={true} />
            )}
            {activeTab === "clients" && <ClientManager isEmbedded={true} />}
            {activeTab === "payments" && (
              <AdminPaymentManager isEmbedded={true} />
            )}
            {activeTab === "revenue" && <RevenueDetails isEmbedded={true} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default StudioActivities;
