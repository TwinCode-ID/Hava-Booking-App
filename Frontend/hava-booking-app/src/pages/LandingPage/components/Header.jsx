import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Menu, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const Header = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        // Added 'transition-all' here so background/border changes are smooth
        className='fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-100 transition-all duration-100 ease-in-out'
      >
        {/* Added 'transition-all' here so padding changes smoothly */}
        <div className='container mx-auto px-4 transition-all duration-300 ease-in-out'>
          <div className='flex items-center h-16 justify-between'>
            
            {/* Mobile Toggle Button */}
            <div className='md:hidden '>
              <button 
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className='text-gray-600 hover:text-gray-900 focus:outline-none transition-transform duration-100 active:scale-95'
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>

            {/* Logo Section */}
            <div className='flex items-center space-x-3 cursor-pointer' onClick={() => navigate("/")}>
              <div className='w-8 h-8 rounded-lg bg-emerald-900 flex items-center justify-center transition-transform duration-300 hover:scale-105 md: ml-3'>
                <MapPin className='w-5 h-5 text-white' />
              </div>
              <span className='text-xl font-bold text-gray-900'>Booking Service</span>
            </div>

            {/* Desktop Nav - Added transition classes */}
            <nav className='hidden md:flex items-center space-x-8 ml-8 transition-all duration-100 ease-in-out'>
              <a onClick={() => navigate("/")} className='text-gray-600 hover:text-emerald-800 transition-colors duration-300 font-medium cursor-pointer'>
                Studio Location
              </a>
              <a onClick={() => navigate("/")} className='text-gray-600 hover:text-emerald-800 transition-colors duration-300 font-medium cursor-pointer'>
                Book Class
              </a>
            </nav>

            {/* Desktop Auth - Added transition classes */}
            <div className='md:flex items-center space-x-3 ml-auto transition-all duration-100 ease-in-out'>
              <a href='/login' className='text-gray-600 hover:text-emerald-800 transition-colors duration-300 font-medium px-4 py-2 rounded-lg hover:bg-gray-50'>
                Login
              </a>
              <a href='/signup' className='bg-emerald-900 text-white px-6 py-2 rounded-lg font-medium hover:bg-emerald-800 transition-all duration-300 shadow-sm hover:shadow-md'>
                Sign Up
              </a>
            </div>
          </div>
        </div>

        {/* Mobile Menu & Blur Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              {/* Blur Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className='fixed inset-0 top-16 bg-black/30 backdrop-blur-md z-40 md:hidden'
              />

              {/* Dropdown Menu Panel */}
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className='md:hidden bg-white border-t border-gray-100 overflow-hidden absolute left-0 right-0 z-50 shadow-lg'
              >
                <div className='container mx-auto px-4 py-6 space-y-4 flex flex-col'>
                  <a onClick={() => { navigate("/"); setIsMobileMenuOpen(false); }} className='text-gray-600 hover:text-emerald-800 font-medium cursor-pointer block text-lg'>
                    Studio Location
                  </a>
                  <a onClick={() => { navigate("/"); setIsMobileMenuOpen(false); }} className='text-gray-600 hover:text-emerald-800 font-medium cursor-pointer block text-lg'>
                    Book Class
                  </a> 
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </motion.header>
    </>
  );
};

export default Header;