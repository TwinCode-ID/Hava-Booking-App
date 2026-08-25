import { MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className='relative bg-stone-50 text-stone-900 overflow-hidden'>
      <div className='relative z-10 px-6 py-16'>
        <div className='max-w-6xl mx-auto'>
          {/* Main Footer Content */}
          <div className='text-center space-y-8'>
            {/* Copyright */}
            <div className='space-y-2'>
              <p className={"text-sm text-stone-600"}>
                © {new Date().getFullYear()} Pilates Studio Indonesia
              </p>
              <p className={"text-xs text-stone-500"}>All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
