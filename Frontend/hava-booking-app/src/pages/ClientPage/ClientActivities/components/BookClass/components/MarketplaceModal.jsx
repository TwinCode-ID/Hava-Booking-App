// src/..../MarketplaceModal.jsx (Adjust path as needed)
import React, { useState, useEffect } from "react";
import { X, ShoppingBag, Loader2, CheckCircle2 } from "lucide-react";
import axiosInstance from "../../../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../../../utils/apiPath";
import PurchaseForm from "../../PurchasePackage/components/PurchaseForm"; // Ensure this path points to your existing PurchaseForm

const MarketplaceModal = ({
  user,
  onClose,
  onPurchaseSuccess,
  requiredClassType,
  requiredInstructorType,
  requiredStudioId,
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackage, setSelectedPackage] = useState(null);

  // 1. Fetch Packages on Mount
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await axiosInstance.get(API_PATHS.PACKAGES.GET_ALL);
        setPackages(res.data);
      } catch (error) {
        console.error("Failed to load packages", error);
      } finally {
        setLoading(false);
      }
    };
    fetchPackages();
  }, []);

  // 2. Filter Packages based on the Class requirements
  const filteredPackages = packages
    .filter((pkg) => {
      // Must be active
      if (!pkg.isActive) return false;

      // Filter by Instructor Type (Strict match)
      if (
        pkg.studioLocation._id === requiredStudioId &&
        requiredInstructorType &&
        pkg.instructorType !== requiredInstructorType
      ) {
        return false;
      }

      // Filter by Class Type (Optional: only if your packages specify class types)
      // If your packages are generic for all class types, remove the inner if statement.
      if (
        pkg.studioLocation._id === requiredStudioId &&
        requiredClassType &&
        pkg.classType &&
        pkg.classType !== requiredClassType
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => parseInt(a.packagePrice) - parseInt(b.packagePrice)); // Sort cheap to expensive

  const handleSuccess = async () => {
    setSelectedPackage(null);
    onPurchaseSuccess();
  };

  return (
    // Z-Index 60 to sit ON TOP of BookingModal (which is usually 50)
    <div className='fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200'>
      <div className='bg-white w-full max-w-5xl h-[85vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200'>
        {/* Header */}
        <div className='p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0'>
          <div>
            <h2 className='text-xl font-bold text-gray-900 flex items-center gap-2'>
              <ShoppingBag className='w-5 h-5 text-emerald-600' />
              Buy Credits
            </h2>
            <div className='flex gap-2 mt-1'>
              <span className='text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200'>
                Filter: {requiredInstructorType}
              </span>
              {requiredClassType && (
                <span className='text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200'>
                  {requiredClassType}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-2 hover:bg-gray-200 rounded-full transition-colors'>
            <X className='w-6 h-6 text-gray-400' />
          </button>
        </div>

        {/* Content: List of Packages */}
        <div className='flex-1 overflow-y-auto p-6 bg-gray-50/50'>
          {loading ? (
            <div className='h-full flex items-center justify-center flex-col gap-2'>
              <Loader2 className='w-8 h-8 animate-spin text-emerald-600' />
              <p className='text-sm text-gray-400'>Loading packages...</p>
            </div>
          ) : filteredPackages.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
              {filteredPackages.map((pkg) => (
                <div
                  key={pkg._id}
                  onClick={() => setSelectedPackage(pkg)}
                  className='bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-emerald-500 hover:shadow-lg transition-all group relative overflow-hidden flex flex-col h-full'>
                  {/* Selection Indicator */}
                  <div className='absolute top-0 left-0 w-1.5 h-full bg-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity' />

                  <div className='flex-1'>
                    <h3 className='font-bold text-gray-900 text-lg mb-1'>
                      {pkg.packageName}
                    </h3>
                    <p className='text-xs text-gray-500 mb-4 line-clamp-2'>
                      {pkg.packageDescription}
                    </p>

                    <div className='flex flex-wrap gap-2 mb-4'>
                      <span className='text-[10px] bg-emerald-50 text-emerald-700 px-2 py-1 rounded font-bold uppercase border border-emerald-100'>
                        {pkg.credits} Sessions
                      </span>
                      <span className='text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-bold uppercase border border-gray-200'>
                        {pkg.validityDays} Days
                      </span>
                    </div>
                  </div>

                  <div className='mt-auto pt-4 border-t border-gray-50'>
                    <p className='text-xl font-mono font-bold text-gray-900'>
                      IDR {parseInt(pkg.packagePrice).toLocaleString("id-ID")}
                    </p>
                    <button className='mt-3 w-full py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold group-hover:bg-emerald-600 transition-colors shadow-lg shadow-gray-200'>
                      Select Package
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className='h-full flex flex-col items-center justify-center text-center'>
              <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
                <ShoppingBag className='w-8 h-8 text-gray-300' />
              </div>
              <h3 className='text-lg font-bold text-gray-900'>
                No matching packages found
              </h3>
              <p className='text-gray-500 max-w-xs mt-2'>
                We couldn't find a package specifically for{" "}
                <strong>{requiredInstructorType}</strong>. Please contact the
                studio.
              </p>
              <button
                onClick={onClose}
                className='mt-6 text-emerald-600 font-bold hover:underline'>
                Go Back
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Nested Modal: Purchase Form */}
      {/* This renders ON TOP of the marketplace if a package is selected */}
      {selectedPackage && (
        <div className='absolute inset-0 z-[70] flex items-center justify-center bg-white/60 backdrop-blur-md p-4 animate-in fade-in duration-200'>
          <div className='bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200'>
            <div className='p-4 border-b flex justify-between items-center bg-gray-50'>
              <h3 className='font-bold text-gray-900'>Checkout</h3>
              <button
                onClick={() => setSelectedPackage(null)}
                className='p-1 hover:bg-gray-200 rounded-full'>
                <X className='w-5 h-5' />
              </button>
            </div>
            <div className='p-4 overflow-y-auto'>
              <PurchaseForm
                pkg={selectedPackage}
                userId={user._id}
                onCancel={() => setSelectedPackage(null)}
                onSuccess={handleSuccess}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketplaceModal;
