import React, { useState, useEffect } from "react";
import { Save } from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import CustomSelect from "../../layout/CustomSelect"; // Your custom component
import { API_PATHS } from "../../../../utils/apiPath";
import { useAuth } from "../../../../context/AuthContext";

const MedicalList = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasRecord, setHasRecord] = useState(false);
  const [medical, setMedical] = useState({
    dateOfBirth: "",
    sex: "",
    maritalStatus: "",
    occupation: "",
    address: "",
    dailyActivity: "",
    physicalConcern: "",
  });

  // Fetch Medical Data
  useEffect(() => {
    const fetchMedical = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get(
          API_PATHS.AUTH.MEDICAL_INFO(user._id)
        );

        if (res.data) {
          setHasRecord(true);
          setMedical({
            dateOfBirth: res.data.dateOfBirth
              ? res.data.dateOfBirth.split("T")[0]
              : "",
            sex: res.data.sex || "",
            maritalStatus: res.data.maritalStatus || "",
            occupation: res.data.occupation || "",
            address: res.data.address || "",
            dailyActivity: res.data.dailyActivity || "",
            physicalConcern: res.data.physicalConcern || "",
          });
        }
      } catch (err) {
        // 404 is expected for new users without records
        console.log("No medical record found, defaulting to empty state.");
      } finally {
        setLoading(false);
      }
    };
    fetchMedical();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (hasRecord) {
        await axiosInstance.put("/medical-records/update", medical);
      } else {
        await axiosInstance.post("/medical-records/create", medical);
        setHasRecord(true);
      }
      alert("Medical record saved successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save medical record.");
    }
  };

  if (loading)
    return (
      <div className='py-10'>
        <LoadingSpinner />
      </div>
    );

  return (
    <form onSubmit={handleSubmit} className='space-y-6 animate-in fade-in'>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
        {/* Date of Birth */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Date of Birth
          </label>
          <input
            type='date'
            value={medical.dateOfBirth}
            onChange={(e) =>
              setMedical({ ...medical, dateOfBirth: e.target.value })
            }
            className='w-full p-3 rounded-xl border border-gray-200 bg-white text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all'
          />
        </div>

        {/* Custom Select: SEX */}
        <CustomSelect
          label='Sex'
          value={medical.sex}
          options={["Male", "Female"]}
          placeholder='Select Gender'
          onChange={(val) => setMedical({ ...medical, sex: val })}
        />

        {/* Custom Select: MARITAL STATUS */}
        <CustomSelect
          label='Marital Status'
          value={medical.maritalStatus}
          options={["Single", "Married", "Divorced", "Widowed"]}
          placeholder='Select Status'
          onChange={(val) => setMedical({ ...medical, maritalStatus: val })}
        />

        {/* Occupation */}
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Occupation
          </label>
          <input
            type='text'
            value={medical.occupation}
            onChange={(e) =>
              setMedical({ ...medical, occupation: e.target.value })
            }
            className='w-full p-3 rounded-xl border border-gray-200 bg-white outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
            placeholder='e.g. Graphic Designer'
          />
        </div>

        {/* Full Width Fields */}
        <div className='md:col-span-2'>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Address
          </label>
          <textarea
            value={medical.address}
            onChange={(e) =>
              setMedical({ ...medical, address: e.target.value })
            }
            rows='2'
            className='w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
          />
        </div>

        <div className='md:col-span-2'>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Daily Activity
          </label>
          <textarea
            value={medical.dailyActivity}
            onChange={(e) =>
              setMedical({ ...medical, dailyActivity: e.target.value })
            }
            rows='2'
            placeholder='e.g. Sedentary work, mostly sitting...'
            className='w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
          />
        </div>

        <div className='md:col-span-2'>
          <label className='block text-sm font-medium text-gray-700 mb-1'>
            Physical Concerns / Injuries
          </label>
          <textarea
            value={medical.physicalConcern}
            onChange={(e) =>
              setMedical({ ...medical, physicalConcern: e.target.value })
            }
            rows='2'
            placeholder='e.g. Shoulder pain, stiff neck...'
            className='w-full p-3 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
          />
        </div>
      </div>

      <div className='pt-4 border-t border-gray-100'>
        <button
          type='submit'
          className='px-6 py-3 bg-emerald-700 text-white font-bold rounded-xl hover:bg-emerald-800 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/10'>
          <Save className='w-4 h-4' /> Save Medical Record
        </button>
      </div>
    </form>
  );
};

export default MedicalList;
