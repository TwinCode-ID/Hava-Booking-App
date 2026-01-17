import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { LogOut, Menu, X, User, AlertCircle } from "lucide-react";
import { NAVIGATION_MENU_CLIENT } from "../../../utils/data";
import { useAuth } from "../../../context/AuthContext";

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // --- NEW: State for Logout Modal ---
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  return (
    <div className='flex h-screen w-screen bg-gray-50 font-sans overflow-hidden'>
      {/* --- MOBILE HEADER --- */}
      <div className='md:hidden fixed top-0 left-0 right-0 h-16 bg-emerald-900 z-50 flex items-center justify-between px-4 text-white shadow-md'>
        <div className='font-bold text-lg'>User Panel</div>
        <button onClick={() => setIsMobileOpen(!isMobileOpen)}>
          {isMobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      {/* --- SIDEBAR --- */}
      <aside
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 bg-emerald-900 text-white transition-all duration-300 ease-in-out flex flex-col shadow-xl
          ${
            isMobile
              ? isMobileOpen
                ? "translate-x-0 w-64 pt-16"
                : "-translate-x-full w-64"
              : isHovered
              ? "w-64"
              : "w-20"
          }
        `}>
        {/* --- PROFILE SECTION --- */}
        <div
          onClick={() => {
            navigate("/client-account-settings");
            setIsMobileOpen(false);
          }}
          className='h-24 flex items-center px-4 border-b border-emerald-800/50 whitespace-nowrap overflow-hidden shrink-0 cursor-pointer hover:bg-emerald-800 transition-colors group'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <div
                className={`w-10 h-10 rounded-full ${
                  user?.avatar ? "" : "bg-emerald-100"
                }  flex items-center justify-center text-emerald-900 font-bold shrink-0 overflow-hidden border-2 border-transparent group-hover:border-emerald-400 transition-all`}>
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt='Profile'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  user?.fullName?.charAt(0) || "A"
                )}
              </div>
              <div className='absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
                <User className='w-2 h-2 text-white' />
              </div>
            </div>

            <div
              className={`transition-opacity duration-200 ${
                isHovered || isMobile ? "opacity-100" : "opacity-0 hidden"
              }`}>
              <p className='font-bold text-sm truncate w-40'>
                {user?.fullName}
              </p>
              <p className='text-xs text-emerald-300 truncate w-40'>
                Edit Profile
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className='flex-1 py-6 space-y-3 px-4 overflow-y-auto overflow-x-hidden'>
          {NAVIGATION_MENU_CLIENT.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.includes(item.id);

            return (
              <button
                key={item.id}
                onClick={() => {
                  navigate(`/${item.id}`);
                  setIsMobileOpen(false);
                }}
                className={`w-full flex items-center p-3.5 rounded-2xl transition-all duration-300 ease-out group whitespace-nowrap relative
          ${
            isActive
              ? "bg-white text-emerald-900 shadow-xl shadow-emerald-900/10 scale-[1.02] font-bold"
              : "text-emerald-100 hover:bg-white/10 hover:text-white hover:shadow-inner"
          }`}>
                {isActive && (
                  <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-emerald-500 rounded-r-full opacity-0 md:opacity-100 transition-opacity' />
                )}

                <Icon
                  className={`w-6 h-6 shrink-0 transition-colors duration-300 ${
                    isActive
                      ? "text-emerald-600"
                      : "text-emerald-300 group-hover:text-white"
                  }`}
                />
                <span
                  className={`ml-4 text-sm font-medium transition-all duration-300 
          ${
            isHovered || isMobile
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-4 absolute pointer-events-none"
          }`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Logout Button (Modified to trigger popup) */}
        <div className='p-4 border-t border-emerald-800/50 shrink-0'>
          <button
            onClick={() => setShowLogoutConfirm(true)} // Changed here
            className='w-full flex items-center p-3 rounded-xl text-emerald-200 hover:bg-emerald-800 hover:text-red-300 transition-colors whitespace-nowrap'>
            <LogOut className='w-6 h-6 shrink-0' />
            <span
              className={`ml-4 font-medium transition-all duration-200 
              ${isHovered || isMobile ? "opacity-100" : "opacity-0 hidden"}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* --- OVERLAY FOR MOBILE SIDEBAR --- */}
      {isMobile && isMobileOpen && (
        <div
          className='fixed inset-0 bg-black/50 z-40 backdrop-blur-sm'
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* --- MAIN CONTENT --- */}
      <main
        className={`flex-1 transition-all duration-300 h-screen overflow-hidden flex flex-col 
          ${isMobile ? "ml-0 pt-16" : isHovered ? "ml-64" : "ml-20"}
        `}>
        <div className='flex-1 overflow-auto bg-gray-50'>
          <div className='w-full h-full'>
            <Outlet />
          </div>
        </div>
      </main>

      {/* --- LOGOUT CONFIRMATION MODAL --- */}
      {showLogoutConfirm && (
        <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-emerald-900/40 backdrop-blur-sm'>
          <div
            className='bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all scale-100'
            onClick={(e) => e.stopPropagation()}>
            <div className='p-8 text-center'>
              <div className='mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-6'>
                <LogOut className='w-8 h-8 text-red-500' />
              </div>

              <h3 className='text-xl font-bold text-gray-900 mb-2'>
                Sign Out?
              </h3>
              <p className='text-gray-500 text-sm leading-relaxed mb-8'>
                Are you sure you want to end your session? You will need to log
                in again to access your account.
              </p>

              <div className='flex gap-3'>
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className='flex-1 px-4 py-3 bg-gray-50 text-gray-700 font-bold rounded-xl hover:bg-gray-100 transition-colors text-sm'>
                  Cancel
                </button>
                <button
                  onClick={handleLogout}
                  className='flex-1 px-4 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all transform active:scale-95 text-sm'>
                  Yes, Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout;
