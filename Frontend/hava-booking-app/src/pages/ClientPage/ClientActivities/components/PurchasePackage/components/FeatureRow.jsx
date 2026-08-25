const FeatureRow = ({ icon: Icon, text }) => (
  <div className='flex items-center gap-3 text-stone-600'>
    <div className='p-2 rounded-full bg-stone-50 text-stone-800'>
      <Icon className='w-4 h-4' />
    </div>
    <span className='text-sm font-medium'>{text}</span>
  </div>
);

export default FeatureRow;
