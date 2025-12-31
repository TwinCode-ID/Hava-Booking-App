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
import axiosInstance from "../../../../utils/axiosInstance"; // Adjust path
import Footer from "../../../../components/Footer"; // Adjust path
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner"; // Adjust path
import PackageCard from "./PackageCard";

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

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white  flex items-center font-sans'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col font-sans'>
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
                    ? "bg-emerald-900 text-white shadow-md"
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

export default PackageSelector;
