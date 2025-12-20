import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Wifi,
  Droplets,
  Lock,
  Car,
  ArrowLeft,
  Star,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import LoadingSpinner from "../../../components/LoadingSpinner";
import Footer from "../../../components/Footer";
import Header from "../../../components/Header";

const StudioDetails = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const studioId = searchParams.get("id");

  const [studio, setStudio] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const fetchStudioDetails = async () => {
      if (!studioId) return;
      try {
        const response = await axiosInstance.get(
          API_PATHS.STUDIOS.GET_STUDIO_BY_ID(studioId)
        );
        setStudio(response.data);
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStudioDetails();
  }, [studioId]);

  // Handle image array (flattening nested array if necessary)
  const displayImages =
    studio?.studioPictures?.length > 1
      ? studio.studioPictures
      : [...(studio?.studioPictures?.[0] || [])];

  const nextImage = (e) => {
    e?.stopPropagation();
    if (displayImages.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === displayImages.length - 1 ? 0 : prev + 1
      );
    }
  };

  const prevImage = (e) => {
    e?.stopPropagation();
    if (displayImages.length > 0) {
      setCurrentImageIndex((prev) =>
        prev === 0 ? displayImages.length - 1 : prev - 1
      );
    }
  };

  const getFacilityIcon = (name) => {
    const lower = name?.toLowerCase() || "";
    if (lower.includes("wifi")) return <Wifi className='w-4 h-4' />;
    if (lower.includes("water")) return <Droplets className='w-4 h-4' />;
    if (lower.includes("locker")) return <Lock className='w-4 h-4' />;
    if (lower.includes("parking")) return <Car className='w-4 h-4' />;
    return <Star className='w-4 h-4' />;
  };

  if (isLoading) return <LoadingSpinner />;
  if (!studio) return <div className='text-center py-20'>Studio not found</div>;

  const facilityList = Array.isArray(studio.facilities?.[0])
    ? studio.facilities[0]
    : studio.facilities || [];

  return (
    <div className='min-h-screen bg-white flex flex-col'>
      {/* 1. Global Header (Fixed) */}
      <Header />

      {/* 2. Main Content Wrapper */}
      {/* Added pt-20 (padding-top) to prevent Header from covering content */}
      <main className='grow pt-20 md:pt-24'>
        <section className='pb-24'>
          {/* 3. Back Button Row */}
          <div className='container mx-auto px-4 md:px-6 py-4 flex items-center'>
            <button
              onClick={() => navigate(-1)}
              className='p-2 rounded-full hover:bg-gray-100 transition-colors border border-gray-100 shadow-sm'>
              <ArrowLeft className='w-5 h-5 md:w-6 md:h-6 text-gray-800' />
            </button>
            <span className='ml-4 text-lg md:text-xl font-bold text-gray-900'>
              Studio Details
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className='container mx-auto px-4 md:px-6'>
            {/* Image Carousel */}
            <div className='relative w-full h-[300px] md:h-[500px] rounded-4xl overflow-hidden shadow-lg group'>
              <AnimatePresence mode='wait'>
                <motion.img
                  key={currentImageIndex}
                  src={displayImages[currentImageIndex]}
                  alt='Studio View'
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className='w-full h-full object-cover'
                />
              </AnimatePresence>

              {/* Gradient Overlay */}
              <div className='absolute inset-0 bg-linear-to-t from-black/50 to-transparent pointer-events-none z-10' />

              {/* Arrows */}
              {displayImages.length > 1 && (
                <>
                  <button
                    onClick={prevImage}
                    className='absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md p-2 md:p-3 rounded-full text-white hover:bg-white/40 transition-all z-20 border border-white/30'>
                    <ChevronLeft className='w-5 h-5 md:w-6 md:h-6' />
                  </button>

                  <button
                    onClick={nextImage}
                    className='absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 backdrop-blur-md p-2 md:p-3 rounded-full text-white hover:bg-white/40 transition-all z-20 border border-white/30'>
                    <ChevronRight className='w-5 h-5 md:w-6 md:h-6' />
                  </button>

                  {/* Dots */}
                  <div className='absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-20'>
                    {displayImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`h-1.5 md:h-2 rounded-full transition-all duration-300 shadow-sm ${
                          idx === currentImageIndex
                            ? "bg-white w-5 md:w-6"
                            : "bg-white/50 w-1.5 md:w-2 hover:bg-white/80"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Title & Info */}
            <div className='mt-6 md:mt-8'>
              <div className='flex flex-col md:flex-row md:justify-between md:items-start gap-4'>
                <div>
                  <h1 className='text-2xl md:text-3xl font-bold text-emerald-900'>
                    {studio.studioName}
                  </h1>
                  <div className='flex items-center text-gray-500 mt-2'>
                    <MapPin className='w-4 h-4 mr-1 text-emerald-700' />
                    <p>{studio.address.city}</p>
                  </div>
                </div>
              </div>
            </div>

            <hr className='my-6 md:my-8 border-gray-100' />

            {/* Facilities */}
            <div className='mt-6'>
              <h2 className='text-lg md:text-xl font-bold text-emerald-900 mb-4'>
                Studio Facilities
              </h2>
              <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4'>
                {facilityList.map((facility, index) => (
                  <div
                    key={index}
                    className='flex items-center gap-3 p-3 bg-gray-50 rounded-2xl text-gray-600'>
                    <div className='p-2 bg-white rounded-full shadow-sm text-emerald-800 shrink-0'>
                      {getFacilityIcon(facility)}
                    </div>
                    <span className='text-sm font-medium truncate'>
                      {facility}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Location */}
            <div className='mt-8 p-5 md:p-6 bg-gray-50 rounded-3xl mb-8'>
              <h2 className='text-lg md:text-xl font-bold text-emerald-900 mb-4'>
                Location
              </h2>
              <div className='flex items-start gap-3'>
                <MapPin className='w-6 h-6 text-emerald-900 mt-1 shrink-0' />
                <div>
                  <p className='text-gray-700 font-medium'>
                    {studio.address.street}
                  </p>
                  <p className='text-gray-500 text-sm mt-1'>
                    {studio.address.city}, {studio.address.zip}
                  </p>
                </div>
              </div>
            </div>

            {/* Book Button */}
            <div className='pb-8'>
              <button className='w-full bg-emerald-900 text-white font-bold py-4 rounded-full shadow-lg hover:bg-emerald-800 transition-transform active:scale-[0.98] text-lg'>
                Book a Class
              </button>
            </div>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default StudioDetails;
