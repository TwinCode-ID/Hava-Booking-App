import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
} from "lucide-react";
import axiosInstance from "../../../../utils/axiosInstance";
import { API_PATHS } from "../../../../utils/apiPath";
import LoadingSpinner from "../../../../components/LoadingSpinner";
import { useAuth } from "../../../../context/AuthContext";

const PackageList = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState("active"); // "active" | "history"
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState(null); // ID of transaction being uploaded

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      // Fetch user's purchase history
      const response = await axiosInstance.get(
        API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id)
      ); // Update path
      setTransactions(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleFileUpload = async (event, transactionId) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      setUploadingId(transactionId);
      const formData = new FormData();
      formData.append("proofOfPayment", file);

      // Upload API call
      await axiosInstance.post(
        `/purchases/${transactionId}/upload-proof`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      alert("Proof uploaded successfully!");
      fetchTransactions(); // Refresh status
    } catch (error) {
      console.error("Upload failed", error);
      alert("Failed to upload proof.");
    } finally {
      setUploadingId(null);
    }
  };

  const filteredData = transactions.filter((t) =>
    activeTab === "active"
      ? t.isActive && new Date(t.expiryDate) > new Date()
      : !t.isActive && new Date(t.expiryDate) < new Date()
  );

  return (
    <div className='p-6 md:p-10 bg-gray-50 min-h-screen font-sans'>
      <h1 className='text-2xl font-bold text-gray-900 mb-6'>Manage Packages</h1>

      {/* Tabs */}
      <div className='flex gap-1 bg-white p-1 rounded-xl w-fit mb-6 border border-gray-200'>
        {["active", "history"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
              activeTab === tab
                ? "bg-emerald-50 text-emerald-700"
                : "text-gray-500 hover:bg-gray-50"
            }`}>
            {tab === "active" ? "Active Passes" : "Passes History"}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className='space-y-4'>
          {filteredData.map((trx) => (
            <div
              key={trx._id}
              className='bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6'>
              {/* Left: Info */}
              <div>
                <div className='flex items-center gap-3 mb-2'>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase ${
                      trx.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}>
                    {trx.isActive ? "Active" : "Expired"}
                  </span>
                </div>
                <h3 className='text-lg font-bold text-gray-900'>
                  {trx.packageId?.packageName}
                </h3>
                <p className='text-sm text-gray-500 mt-1'>
                  Purchased: {new Date(trx.purchaseDate).toLocaleDateString()}
                </p>
                <p className='text-sm text-gray-500 mt-1'>
                  Valid thru : {new Date(trx.expiryDate).toLocaleDateString()}
                </p>
                <p className='text-sm text-gray-500 mt-1'>
                  Issuing studio : {trx.issuingStudio.studioName}
                </p>
              </div>

              <div className='flex flex-col items-end gap-3 w-full md:w-auto'>
                <div className='text-right'>
                  <p className='text-xs text-gray-400'>
                    {trx.remainingCredits} Credits
                  </p>
                </div>
              </div>
            </div>
          ))}

          {filteredData.length === 0 && (
            <div className='text-center py-12 text-gray-400'>
              No records found.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PackageList;
