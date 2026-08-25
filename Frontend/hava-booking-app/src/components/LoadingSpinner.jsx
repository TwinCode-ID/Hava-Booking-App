import { Briefcase } from "lucide-react";

const LoadingSpinner = () => {
  return (
    <div className='container mx-auto flex items-center justify-center'>
      <div className='text-center'>
        <div className='relative'>
          <div className='animate-spin rounded-full h-16 w-16 border-4 border-stone-300 border-t-stone-600 mx-auto mb-4'></div>
          <div className='absolute inset-0 flex items-center justify-center'>
            <Briefcase className='w-6 h-6 text-stone-800' />
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;
