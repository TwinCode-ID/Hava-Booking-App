import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { LogOut, Menu, X, User, Building2 } from "lucide-react";
import { NAVIGATION_MENU_ADMIN } from "../../../utils/data";
import { useAuth } from "../../../context/AuthContext";
import { fetchImage } from "../../../utils/helper";

const DashboardLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className='flex h-screen bg-canvas font-sans overflow-hidden'>
      {/* --- MOBILE HEADER --- */}
      <header className='md:hidden fixed top-0 left-0 right-0 h-16 bg-white/85 backdrop-blur-md border-b border-stone-200 z-50 flex items-center justify-between gap-3 px-4'>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label={isMobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={isMobileOpen}
          className='shrink-0 -mr-1 w-11 h-11 rounded-xl flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition-colors'>
          {isMobileOpen ? (
            <X className='w-5 h-5' />
          ) : (
            <Menu className='w-5 h-5' />
          )}
        </button>
        <div className='flex items-center gap-3 min-w-0'>
          <div className='min-w-0 leading-tight'>
            <p className='font-bold text-[15px] text-stone-900 truncate'>
              Admin Panel
            </p>
            <p className='text-[11px] text-stone-500 truncate'>
              {user?.fullName || "Studio administrator"}
            </p>
          </div>
          <div className='w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0'>
            <Building2 className='w-[18px] h-[18px]' />
          </div>
        </div>
      </header>

      {/* --- SIDEBAR --- */}
      <aside
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        className={`fixed inset-y-0 left-0 z-50 bg-white text-stone-900 border-r border-stone-200 transition-all duration-300 ease-in-out flex flex-col shadow-sm
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
        {/* --- PROFILE SECTION (Navigates to Page) --- */}
        <div
          onClick={() => {
            navigate("/admin-account-settings"); // <--- Navigate to page
            setIsMobileOpen(false);
          }}
          className='h-24 flex items-center px-4 border-b border-stone-200 whitespace-nowrap overflow-hidden shrink-0 cursor-pointer hover:bg-stone-50 transition-colors group'>
          <div className='flex items-center gap-3'>
            <div className='relative'>
              <div
                className={`w-10 h-10 rounded-full ${
                  user?.avatar ? "" : "bg-stone-200"
                }  flex items-center justify-center text-stone-900 font-bold shrink-0 overflow-hidden border-2 border-transparent group-hover:border-stone-400 transition-all`}>
                {user?.avatar ? (
                  <img
                    src={fetchImage(user.avatar)}
                    alt='Profile'
                    className='w-full h-full object-cover'
                  />
                ) : (
                  user?.fullName?.charAt(0) || "A"
                )}
              </div>
              <div className='absolute -bottom-1 -right-1 bg-stone-900 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity'>
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
              <p className='text-xs text-stone-500 truncate w-40'>
                Edit Profile
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className='flex-1 py-6 space-y-3 px-4 overflow-y-auto overflow-x-hidden'>
          {NAVIGATION_MENU_ADMIN.map((item) => {
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
              ? "bg-blue-50 text-blue-600 font-bold"
              : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
          }`}>
                {isActive && (
                  <div className='absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-r-full opacity-0 md:opacity-100 transition-opacity' />
                )}

                <Icon
                  className={`w-6 h-6 shrink-0 transition-colors duration-300 ${
                    isActive
                      ? "text-blue-600"
                      : "text-stone-400 group-hover:text-stone-700"
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

        {/* Logout */}
        <div className='p-4 border-t border-stone-200 shrink-0'>
          <button
            onClick={logout}
            className='w-full flex items-center p-3 rounded-xl text-stone-600 hover:bg-red-50 hover:text-red-600 transition-colors whitespace-nowrap'>
            <LogOut className='w-6 h-6 shrink-0' />
            <span
              className={`ml-4 font-medium transition-all duration-200 
              ${isHovered || isMobile ? "opacity-100" : "opacity-0 hidden"}`}>
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* --- OVERLAY FOR MOBILE --- */}
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
        <div className='flex-1 overflow-auto bg-canvas'>
          <div className='w-full h-full'>
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
