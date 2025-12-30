import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Clock,
  CreditCard,
  CheckCircle2,
  Sparkles,
  ShoppingBag,
  Ticket,
} from "lucide-react";
import axiosInstance from "../../../utils/axiosInstance"; // Adjust path
import Header from "../../../components/Header"; // Adjust path
import Footer from "../../../components/Footer"; // Adjust path
import { API_PATHS } from "../../../utils/apiPath";
import LoadingSpinner from "../../../components/LoadingSpinner"; // Adjust path

const PackageSelector = () => {
  const [studios, setStudios] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedStudioId, setSelectedStudioId] = useState(null);
  const [loading, setLoading] = useState(true);

  // 1. Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch Studios & Packages in parallel
        const [studiosRes, packagesRes] = await Promise.all([
          axiosInstance.get(API_PATHS.STUDIOS.GET_ALL), // Adjust endpoint
          axiosInstance.get(API_PATHS.PACKAGES.GET_ALL), // Adjust endpoint
        ]);

        setStudios(studiosRes.data);
        setPackages(packagesRes.data);

        // Default to first studio
        if (studiosRes.data.length > 0) {
          setSelectedStudioId(studiosRes.data[0]._id);
        }
      } catch (error) {
        console.error("Failed to load data", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter packages based on selected studio
  const filteredPackages = packages.filter(
    (pkg) => pkg.studioLocation === selectedStudioId && pkg.isActive
  );

  if (loading) return <LoadingSpinner />;

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col font-sans'>
      <Header />

      <main className='grow pt-24 pb-20 px-4 md:px-6 container mx-auto'>
        <div className='text-center mb-12'>
          <h1 className='text-3xl md:text-4xl font-bold text-emerald-900 mb-4'>
            Choose Your Plan
          </h1>
          <p className='text-gray-500 max-w-lg mx-auto'>
            Flexible packages designed for your lifestyle. Select a studio
            location to see available classes.
          </p>
        </div>

        {/* Studio Location Tabs */}
        <div className='flex justify-center mb-10'>
          <div className='bg-white p-1.5 rounded-full shadow-sm border border-gray-100 inline-flex gap-2 overflow-x-auto max-w-full'>
            {studios.map((studio) => (
              <button
                key={studio._id}
                onClick={() => setSelectedStudioId(studio._id)}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 whitespace-nowrap flex items-center gap-2 ${
                  selectedStudioId === studio._id
                    ? "bg-emerald-900 text-white shadow-md transform scale-105"
                    : "text-gray-500 hover:bg-gray-50 hover:text-emerald-800"
                }`}>
                <MapPin className='w-4 h-4' />
                {studio.studioName || studio.address.city}
              </button>
            ))}
          </div>
        </div>

        {/* Packages Grid */}
        <motion.div
          layout
          className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
          <AnimatePresence mode='popLayout'>
            {filteredPackages.length > 0 ? (
              filteredPackages.map((pkg) => (
                <PackageCard key={pkg._id} pkg={pkg} />
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className='col-span-full text-center py-20 text-gray-400'>
                No packages available for this location yet.
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
};

// --- Sub-Component: Modern Package Card ---
const PackageCard = ({ pkg }) => {
  // Format Price to IDR
  const formatPrice = (price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isBestValue = pkg.credits >= 10; // Logic for highlighting "Best Value"

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      className={`relative bg-white rounded-3xl p-6 md:p-8 shadow-sm hover:shadow-xl transition-all border ${
        isBestValue
          ? "border-emerald-500 ring-1 ring-emerald-500/20"
          : "border-gray-100"
      }`}>
      {/* "Best Value" Badge */}
      {isBestValue && (
        <div className='absolute -top-3 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-md flex items-center gap-1'>
          <Sparkles className='w-3 h-3' /> BEST VALUE
        </div>
      )}

      {/* Header */}
      <div className='mb-6'>
        <h3 className='text-xl font-bold text-gray-900 mb-2'>
          {pkg.packageName}
        </h3>
        <p className='text-gray-500 text-sm line-clamp-2 min-h-10'>
          {pkg.packageDescription}
        </p>
      </div>

      {/* Price */}
      <div className='mb-8'>
        <span className='text-3xl font-bold text-emerald-900'>
          {formatPrice(pkg.packagePrice)}
        </span>
        <span className='text-gray-400 text-sm'> / package</span>
      </div>

      {/* Features List */}
      <div className='space-y-4 mb-8'>
        <FeatureRow icon={Ticket} text={`${pkg.credits} Session Credits`} />
        <FeatureRow icon={Clock} text={`Valid for ${pkg.validityDays} Days`} />
        <FeatureRow icon={Sparkles} text={`${pkg.instructorType}`} />
      </div>

      {/* Action Button */}
      <button
        onClick={() => console.log("Navigate to checkout", pkg._id)}
        className={`w-full py-4 rounded-xl font-bold text-sm transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${
          isBestValue
            ? "bg-emerald-900 text-white hover:bg-emerald-800 shadow-emerald-900/20"
            : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
        }`}>
        <ShoppingBag className='w-4 h-4' />
        Purchase Now
      </button>
    </motion.div>
  );
};

const FeatureRow = ({ icon: Icon, text }) => (
  <div className='flex items-center gap-3 text-gray-600'>
    <div className='p-2 rounded-full bg-gray-50 text-emerald-600'>
      <Icon className='w-4 h-4' />
    </div>
    <span className='text-sm font-medium'>{text}</span>
  </div>
);

export default PackageSelector;
