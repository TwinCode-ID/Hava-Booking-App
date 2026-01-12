const FeatureRow = ({ icon: Icon, text }) => (
  <div className='flex items-center gap-3 text-gray-600'>
    <div className='p-2 rounded-full bg-gray-50 text-emerald-600'>
      <Icon className='w-4 h-4' />
    </div>
    <span className='text-sm font-medium'>{text}</span>
  </div>
);

export default FeatureRow;
