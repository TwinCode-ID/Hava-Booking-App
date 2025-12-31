import { useState, useEffect, Children } from "react";
import { Building2, LogOut, Menu, X, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  NAVIGATION_MENU_ADMIN,
  NAVIGATION_MENU_CLIENT,
  NAVIGATION_MENU_DEV,
} from "../../utils/data";
import ProfileDropdown from "../layout/DashboardProfileDropdown";

const NavigationItem = ({ item, isActive, onClick, isCollapsed }) => {
  const Icon = item.icon;

  return (
    <button
      onClick={() => onClick(item.id)}
      className={`w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 group ${
        isActive
          ? "bg-emerald-800 text-white shadow-sm shadow-emerald-100"
          : "text-gray-600 hover:bg-gray-50 hover:text-emerald-700"
      }`}>
      <Icon
        className={`h-5 w-5 shrink-0 ${
          isActive ? "text-white" : "text-gray-500"
        }`}
      />
      {!isCollapsed && <span className='ml-3 truncate'>{item.name}</span>}
    </button>
  );
};

const DashboardLayout = ({ activeMenu, children, role }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeNavItem, setActiveNavItem] = useState(activeMenu || "dashboard");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (profileDropdownOpen) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [profileDropdownOpen]);

  const handleNavigation = (itemId) => {
    setActiveNavItem(itemId);
    navigate(`/${itemId}`);
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const sidebarCollapsed = !isMobile && false;

  return (
    <div className='flex h-screen bg-gray-50'>
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 transform ${
          isMobile
            ? sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
            : "translate-x-0"
        } ${
          sidebarCollapsed ? "w-16" : "w-64"
        } bg-white border-r border-gray-200`}>
        {/* Company Logo */}
        <div className='flex items-center h-16 border-b border-gray-200 pl-6'>
          {!sidebarCollapsed ? (
            <Link className='flex items-center space-x-3' to='/'>
              <div className='h-8 w-8 bg-emerald-900 rounded-lg flex items-center justify-center'>
                <User className='h-5 w-5 text-white' />
              </div>
              {user.role === "studioAdmin" ? (
                <span className='text-gray-900 font-bold text-xl'>
                  Admin Dashboard
                </span>
              ) : user.role === "client" ? (
                <span className='text-gray-900 font-bold text-xl'>
                  Client Dashboard
                </span>
              ) : (
                <span className='text-gray-900 font-bold text-xl'>
                  Dev Dashboard
                </span>
              )}
            </Link>
          ) : (
            <div className='h-8 w-8 bg-emerald-900 rounded-lg flex items-center justify-center'>
              <Building2 className='h-5 w-5 text-white' />
            </div>
          )}
        </div>

        {/* Navigation */}
        {user.role === "studioAdmin" ? (
          <nav className='p-4 space-y-2'>
            {NAVIGATION_MENU_ADMIN.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={activeNavItem === item.id}
                onClick={handleNavigation}
                isCollapsed={sidebarCollapsed}
              />
            ))}
          </nav>
        ) : user.role === "client" ? (
          <nav className='p-4 space-y-2'>
            {NAVIGATION_MENU_CLIENT.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={activeNavItem === item.id}
                onClick={handleNavigation}
                isCollapsed={sidebarCollapsed}
              />
            ))}
          </nav>
        ) : (
          <nav className='p-4 space-y-2'>
            {NAVIGATION_MENU_DEV.map((item) => (
              <NavigationItem
                key={item.id}
                item={item}
                isActive={activeNavItem === item.id}
                onClick={handleNavigation}
                isCollapsed={sidebarCollapsed}
              />
            ))}
          </nav>
        )}

        {/* Logout */}
        <div className='absolute bottom-4 left-4 right-4'>
          <button
            className='w-full flex items-center px-3 py-2.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 hover:text-emerald-700 transition-all duration-200'
            onClick={logout}>
            <LogOut className='h-5 w-5 shrink-0 text-gray-500' />
            {!sidebarCollapsed && <span className='ml-3'>Sign out</span>}
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div
          className='fixed inset-0 bg-black bg-opacity-25 z-40 backdrop-blur-sm'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          isMobile ? "ml-0" : sidebarCollapsed ? "ml-16" : "ml-64"
        }`}>
        {/* Top navbar */}
        <header className='bg-white/80 backdrop-blur-sm border-b border-gray-200 h-16 flex items-center justify-between px-6 sticky top-0 z-30'>
          <div className='flex items-center space-x-4'>
            {isMobile && (
              <button
                onClick={toggleSidebar}
                className='p-2 rounded-xl hover:bg-gray-100 transition-colors duration-200'>
                {sidebarOpen ? (
                  <X className='h-5 w-5 text-gray-600' />
                ) : (
                  <Menu className='h-5 w-5 text-gray-600' />
                )}
              </button>
            )}
            <div>
              <h1 className='text-base font-semibold text-gray-900'>
                Welcome Back
              </h1>
              <p className='text-sm text-gray-500 hidden sm:block'>
                Here's what's happening with your studio today.
              </p>
            </div>
          </div>

          <div className='flex items-center space-x-3'>
            {/* Profile dropdown */}
            <ProfileDropdown
              isOpen={profileDropdownOpen}
              onToggle={(e) => {
                e.stopPropagation();
                setProfileDropdownOpen(!profileDropdownOpen);
              }}
              avatar={user?.avatar || ""}
              fullName={user?.fullName || ""}
              email={user?.email || ""}
              role={user?.role || ""}
              onLogout={logout}
            />
          </div>
        </header>

        {/* Main content  are*/}
        <main className='flex-1 overflow-auto p-6'>{children}</main>
      </div>
    </div>
  );
};
export default DashboardLayout;
