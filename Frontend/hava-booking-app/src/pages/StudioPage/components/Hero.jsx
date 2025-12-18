import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, MapPin } from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import LoadingSpinner from "../../../components/LoadingSpinner";

const Hero = () => {
  const [studios, setStudios] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStudios = async () => {
      try {
        const response = await axiosInstance.get(API_PATHS.STUDIOS.GET_ALL);
        setStudios(response.data);
      } catch (error) {
        console.error("Error fetching studios:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchStudios();
  }, []);

  if (error)
    return <div className='text-center py-20 text-red-500'>Error: {error}</div>;

  return (
    <section className='min-h-screen bg-white flex items-center py-20'>
      {isLoading ? (
        <LoadingSpinner />
      ) : (
        <div className='container mx-auto overflow-x-auto px-6 md:px-12 py-12 flex gap-8 snap-x snap-mandatory scrollbar-hide justify-start md:justify-center items-stretch'>
          {studios.map((studio, index) => (
            <motion.div
              key={studio._id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className='shrink-0 snap-center h-full'>
              <div className='w-[340px] h-full bg-white rounded-[40px] shadow-xl overflow-hidden hover:scale-[1.02] transition-transform duration-300 ease-in-out flex flex-col'>
                {/* Image Section */}
                <div className='h-[280px] w-full relative'>
                  <img
                    src={
                      "https://www.advantour.com/img/japan/tokyo/tokyo-tower.jpg"
                    }
                    alt={"Demo Image"}
                    className='w-full h-full object-cover'
                  />
                </div>
                <div className='p-8 flex-1 flex flex-col'>
                  {/* Header Section */}

                  <div className='mb-8'>
                    {/* FIX 1: Reserved height for Title (approx 2 lines) */}
                    <h2 className='text-xl font-bold text-gray-900 tracking-tight leading-tight flex items-center'>
                      {studio.studioName}
                    </h2>
                    <p className='text-gray-400 text-lg font-medium mt-1'>
                      {studio.address.city}
                    </p>
                  </div>

                  {/* Phone Section */}
                  <div className='flex items-start gap-4 mb-4'>
                    <div className='w-6 shrink-0 flex justify-center'>
                      <Phone className='w-5 h-5 text-gray-400 rotate-90' />
                    </div>
                    <span className='font-semibold text-lg text-gray-700 break-all'>
                      {studio.contactNumber || "N/A"}
                    </span>
                  </div>

                  {/* Address Section */}
                  <div className='flex items-start gap-4 mb-4'>
                    <div className='w-6 shrink-0 flex justify-center mt-1'>
                      <MapPin className='w-5 h-5 text-gray-400' />
                    </div>
                    {/* FIX 2: Reserved height for Address (approx 3 lines) + block + line-clamp */}
                    <span className='font-light text-sm tracking-wide text-gray-700 leading-relaxed block min-h-18 line-clamp-3'>
                      {studio.address.street}
                    </span>
                  </div>

                  {/* Button Section */}
                  <div className='grid grid-cols-2 gap-2 mx-auto w-full justify-center'>
                    {/* WhatsApp Button: Added 'flex items-center justify-center gap-2' */}
                    <button
                      className='w-full bg-emerald-900 text-white text-lg font-medium py-4 rounded-3xl hover:bg-emerald-800 transition-colors shadow-lg flex items-center justify-center gap-2'
                      onClick={() => {
                        // FIX 1: Use window.open for external links
                        // FIX 2: Corrected the URL (use 'https' and removed double slash)
                        window.open(
                          `https://wa.me/${studio.contactNumber}`,
                          "_blank"
                        );
                      }}>
                      {/* Removed the extra div wrapper and margins to fix alignment */}
                      <FontAwesomeIcon icon={faWhatsapp} className='w-6 h-6' />
                      <span className='font-semibold text-lg text-white'>
                        WhatsApp
                      </span>
                    </button>

                    <button className='w-full text-emerald-900 text-lg font-medium py-4 rounded-3xl hover:text-emerald-800 transition-colors'>
                      Show more
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </section>
  );
};

export default Hero;
