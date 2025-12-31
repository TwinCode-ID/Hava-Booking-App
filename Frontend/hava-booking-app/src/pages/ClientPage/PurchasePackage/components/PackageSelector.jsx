import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom"; // 1. Import this
import { MapPin, X } from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import Footer from "../../../../components/Footer";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import PackageCard from "./PackageCard";
import PurchaseForm from "./PurchaseForm";
import { useAuth } from "../../../../context/AuthContext";

const PackageSelector = () => {
  const { user } = useAuth();
  const [studios, setStudios] = useState([]);
  const [packages, setPackages] = useState([]);
  const [selectedStudioId, setSelectedStudioId] = useState(null);
  const [loading, setLoading] = useState(true);

  // 2. Use URL Params instead of simple State
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedPackageId = searchParams.get("packageId");

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [studiosRes, packagesRes] = await Promise.all([
          axiosInstance.get(API_PATHS.STUDIOS.GET_ALL),
          axiosInstance.get(API_PATHS.PACKAGES.GET_ALL),
        ]);
        setStudios(studiosRes.data);
        setPackages(packagesRes.data);

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

  const filteredPackages = packages.filter(
    (pkg) => pkg.studioLocation === selectedStudioId && pkg.isActive
  );

  // 3. Find the full package object based on the ID in the URL
  const selectedPackage = packages.find((p) => p._id === selectedPackageId);

  // Handler to Open Modal (Updates URL)
  const handleOpenPurchase = (pkgId) => {
    setSearchParams({ packageId: pkgId }); // This adds ?packageId=... to URL
  };

  // Handler to Close Modal (Clears URL)
  const handleClosePurchase = () => {
    setSearchParams({}); // This removes the param, closing the modal
  };

  if (loading)
    return (
      <div className='min-h-screen rounded-2xl bg-white flex items-center justify-center font-sans'>
        <div className='min-h-screen rounded-2xl bg-white  flex items-center font-sans'>
          <LoadingSpinner />
        </div>
      </div>
    );

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col font-sans relative'>
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

        {/* Studio Tabs */}
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
                <PackageCard
                  key={pkg._id}
                  pkg={pkg}
                  // 4. Update the click handler
                  onPurchase={() => handleOpenPurchase(pkg._id)}
                />
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

      {/* 5. Modal Overlay - Only shows if selectedPackage exists */}
      <AnimatePresence>
        {selectedPackage && (
          <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClosePurchase}
              className='absolute inset-0 bg-black/60 backdrop-blur-sm'
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className='relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]'>
              <div className='flex justify-between items-center p-6 border-b border-gray-100'>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>
                    Confirm Purchase
                  </h2>
                  <p className='text-sm text-gray-500'>
                    You are selecting {selectedPackage.packageName}
                  </p>
                </div>
                <button
                  onClick={handleClosePurchase}
                  className='p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors'>
                  <X className='w-5 h-5 text-gray-600' />
                </button>
              </div>

              <div className='p-6 overflow-y-auto'>
                {/* Pass the package and the close handler to your form */}
                <PurchaseForm
                  pkg={selectedPackage}
                  onCancel={handleClosePurchase}
                  userId={user._id}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PackageSelector;
