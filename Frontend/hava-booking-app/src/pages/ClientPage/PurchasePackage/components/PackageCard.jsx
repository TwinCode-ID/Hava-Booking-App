import { motion } from "framer-motion";
import { Clock, Sparkles, ShoppingBag, Ticket } from "lucide-react";
import FeatureRow from "./FeatureRow";

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

export default PackageCard;
