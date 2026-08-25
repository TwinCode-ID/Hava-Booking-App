const DetailItem = ({ label, value }) => (
  <div className='flex justify-between items-center border-b border-stone-100 last:border-0 pb-2 last:pb-0'>
    <p className='text-xs text-stone-400'>{label}</p>
    <p className='text-sm font-semibold text-stone-800 text-right'>
      {value || "-"}
    </p>
  </div>
);

export default DetailItem;
