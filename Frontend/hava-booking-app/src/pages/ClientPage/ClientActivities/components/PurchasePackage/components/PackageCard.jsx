import { motion } from "framer-motion";
import { Clock, Sparkles, ShoppingBag, Ticket } from "lucide-react";
import FeatureRow from "./FeatureRow";

// --- Sub-Component: Modern Package Card ---
const PackageCard = ({ pkg, onPurchase }) => {
  // Format Price to IDR
  const formatPrice = (price) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(price);
  };

  const isBestValue = pkg.credits >= 10; // Logic for highlighting "Best Value"

  // Safely handle instructor type whether it's an array or a string
  const instructorText = Array.isArray(pkg.instructorType)
    ? pkg.instructorType.join(", ")
    : pkg.instructorType;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      className={`relative bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 transition-all duration-300 flex flex-col h-full ${
        isBestValue
          ? "border-emerald-500 ring-1 ring-emerald-500/20 shadow-lg shadow-emerald-900/5"
          : "border-gray-100 border shadow-sm hover:shadow-xl hover:border-emerald-200"
      }`}>
      {/* "Best Value" Badge */}
      {isBestValue && (
        <div className='absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-emerald-500 text-white text-[10px] md:text-xs font-bold px-3.5 md:px-4 py-1 md:py-1.5 rounded-full shadow-md flex items-center gap-1.5 whitespace-nowrap z-10'>
          <Sparkles className='w-3 h-3 md:w-3.5 md:h-3.5' /> BEST VALUE
        </div>
      )}

      {/* Header */}
      <div className='mb-5 md:mb-6 mt-2 md:mt-0'>
        <h3 className='text-lg md:text-xl font-bold text-gray-900 mb-1.5 md:mb-2 line-clamp-2'>
          {pkg.packageName}
        </h3>
        <p className='text-gray-500 text-xs md:text-sm line-clamp-2 min-h-[32px] md:min-h-[40px] leading-relaxed'>
          {pkg.packageDescription}
        </p>
      </div>

      {/* Price */}
      <div className='mb-6 md:mb-8 flex items-baseline flex-wrap gap-1'>
        <span className='text-2xl md:text-3xl font-bold text-[#1D3D36] tracking-tight'>
          {formatPrice(pkg.packagePrice)}
        </span>
        <span className='text-gray-400 text-xs md:text-sm font-medium'>
          {" "}
          / package
        </span>
      </div>

      {/* Features List */}
      <div className='space-y-3 md:space-y-4 mb-6 md:mb-8 flex-1'>
        <FeatureRow icon={Ticket} text={`${pkg.credits} Session Credits`} />
        <FeatureRow icon={Clock} text={`Valid for ${pkg.validityDays} Days`} />
        {instructorText && <FeatureRow icon={Sparkles} text={instructorText} />}
      </div>

      {/* Action Button */}
      <button
        onClick={onPurchase}
        className={`w-full py-3.5 md:py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] md:active:scale-95 mt-auto ${
          isBestValue
            ? "bg-[#1D3D36] text-white hover:bg-[#0F2922] shadow-lg shadow-[#1D3D36]/20"
            : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 border border-emerald-100"
        }`}>
        <ShoppingBag className='w-4 h-4 md:w-[18px] md:h-[18px]' />
        Purchase Now
      </button>
    </motion.div>
  );
};

export default PackageCard;
