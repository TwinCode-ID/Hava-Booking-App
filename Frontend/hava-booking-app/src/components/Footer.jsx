import { MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className='relative bg-gray-50 text-gray-900 overflow-hidden'>
      <div className='relative z-10 px-6 py-16'>
        <div className='max-w-6xl mx-auto'>
          {/* Main Footer Content */}
          <div className='text-center space-y-8'>
            {/* Copyright */}
            <div className='space-y-2'>
              <p className={"text-sm text-gray-600"}>
                © {new Date().getFullYear()} HAVA Pilates Conservatory Indonesia
              </p>
              <p className={"text-xs text-gray-500"}>All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
