import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Building2,
  Activity,
  Server,
  Trash2,
  Plus,
  X,
  Edit,
  Eye,
  Database,
  Globe,
  Cpu,
  Mail,
  Phone,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import { BASE_URL, API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";
import LoadingSpinner from "../../components/LoadingSpinner";

const DevelopmentDashboard = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");

  // Data States
  const [usersList, setUsersList] = useState([]);
  const [studiosList, setStudiosList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal States
  const [isCreateStudioOpen, setIsCreateStudioOpen] = useState(false);
  const [editingStudio, setEditingStudio] = useState(null);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  const getAuthHeaders = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const usersRes = await fetch(
        `${BASE_URL}${API_PATHS.AUTH.GET_ALL_USERS}`,
        { headers: getAuthHeaders() },
      );
      const usersData = await usersRes.json();
      if (usersRes.ok) setUsersList(usersData.data || usersData);

      const studiosRes = await fetch(`${BASE_URL}${API_PATHS.STUDIOS.GET_ALL}`);
      const studiosData = await studiosRes.json();
      if (studiosRes.ok) setStudiosList(studiosData.data || studiosData);
    } catch (error) {
      console.error("Sync Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredUsers = usersList.filter(
    (u) =>
      (u.fullName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Permanently delete this account?")) return;
    try {
      const res = await fetch(
        `${BASE_URL}${API_PATHS.AUTH.DELETE_USER(userId)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) setUsersList(usersList.filter((u) => u._id !== userId));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStudio = async (studioId) => {
    if (!window.confirm("Permanently delete this studio?")) return;
    try {
      const res = await fetch(
        `${BASE_URL}${API_PATHS.STUDIOS.DELETE(studioId)}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        },
      );
      if (res.ok) setStudiosList(studiosList.filter((s) => s._id !== studioId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className='min-h-screen bg-[#F8FAFC] text-slate-900 p-4 md:p-8 lg:p-10 font-sans w-full max-w-[100vw] overflow-x-hidden custom-scrollbar'>
      <div className='flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8'>
        <div>
          <h1 className='text-[26px] font-extrabold text-slate-900 tracking-tight'>
            System Administration
          </h1>
          <div className='flex items-center gap-2 mt-1'>
            <span className='flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-[10px] font-bold uppercase tracking-widest text-emerald-700'>
              <div className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
              Dev Team Access
            </span>
            <span className='text-xs font-medium text-slate-500'>
              Managing {usersList.length} users & {studiosList.length} studios
            </span>
          </div>
        </div>

        <button
          onClick={fetchData}
          className='px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all'>
          <Activity
            className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-500" : ""}`}
          />
          {isLoading ? "Syncing..." : "Sync Database"}
        </button>
      </div>

      <div className='flex gap-3 overflow-x-auto pb-4 custom-scrollbar mb-4 -mx-4 px-4 md:mx-0 md:px-0'>
        <TabButton
          active={activeTab === "overview"}
          onClick={() => setActiveTab("overview")}
          label='Overview'
          icon={<Activity />}
        />
        <TabButton
          active={activeTab === "studios"}
          onClick={() => setActiveTab("studios")}
          label='Studios'
          icon={<Building2 />}
        />
        <TabButton
          active={activeTab === "users"}
          onClick={() => setActiveTab("users")}
          label='Users'
          icon={<Users />}
        />
      </div>

      <div className='w-full'>
        {activeTab === "overview" && (
          <div className='space-y-8 animate-in fade-in duration-500'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-5'>
              <StatCard
                icon={<Users />}
                title='Total Users'
                value={usersList.length}
                color='blue'
              />
              <StatCard
                icon={<Building2 />}
                title='Total Studios'
                value={studiosList.length}
                color='emerald'
              />
              <StatCard
                icon={<Database />}
                title='System Status'
                value='Stable'
                color='indigo'
              />
            </div>
            <SystemMetricsTab getAuthHeaders={getAuthHeaders} />
          </div>
        )}

        {activeTab === "studios" && (
          <div className='animate-in fade-in duration-500'>
            <div className='flex justify-between items-center mb-6'>
              <h2 className='text-lg font-extrabold text-slate-900'>
                Active Studios
              </h2>
              <button
                onClick={() => setIsCreateStudioOpen(true)}
                className='px-5 py-2.5 bg-[#1a4d3e] text-white rounded-[14px] text-sm font-bold flex items-center gap-2 shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] transition-all active:scale-[0.98]'>
                <Plus className='w-4 h-4' /> New Studio
              </button>
            </div>
            <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5'>
              {studiosList.map((s) => (
                <StudioCard
                  key={s._id}
                  studio={s}
                  onEdit={() => setEditingStudio(s)}
                  onDelete={() => handleDeleteStudio(s._id)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className='animate-in fade-in duration-500 flex flex-col gap-6'>
            <div className='flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4'>
              <div className='relative w-full sm:w-96'>
                <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4' />
                <input
                  type='text'
                  placeholder='Search users by name or email...'
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className='w-full pl-11 pr-4 py-3 bg-white border border-slate-200/80 rounded-[14px] text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm font-medium'
                />
              </div>
              <button
                onClick={() => setIsCreateUserOpen(true)}
                className='px-5 py-3 bg-[#1a4d3e] text-white rounded-[14px] text-sm font-bold flex items-center justify-center gap-2 shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] transition-all active:scale-[0.98]'>
                <Plus className='w-4 h-4' /> New User
              </button>
            </div>

            <div className='bg-white rounded-3xl border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden w-full'>
              <div className='overflow-x-auto w-full custom-scrollbar'>
                <table className='w-full text-left border-collapse min-w-max'>
                  <thead className='bg-slate-50/50 border-b border-slate-100'>
                    <tr>
                      <th className='py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest'>
                        User Profile
                      </th>
                      <th className='py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest'>
                        Role
                      </th>
                      <th className='py-4 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-widest text-right'>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-50'>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u._id}
                        className='hover:bg-slate-50/80 transition-colors group'>
                        <td className='py-4 px-6'>
                          <div className='flex items-center gap-4'>
                            <div className='w-10 h-10 shrink-0 rounded-xl bg-linear-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center font-extrabold text-sm uppercase shadow-sm border border-slate-300/30'>
                              {u.fullName.charAt(0)}
                            </div>
                            <div className='flex flex-col min-w-0'>
                              <p className='font-bold text-slate-900 text-[14px] mb-0.5 truncate'>
                                {u.fullName}
                              </p>
                              <p className='text-slate-400 text-xs font-medium truncate'>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className='py-4 px-6'>
                          <span
                            className={`inline-flex items-center px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest border ${
                              u.role === "devTeam"
                                ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                : u.role === "studioAdmin"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                                  : "bg-slate-50 text-slate-600 border-slate-200"
                            }`}>
                            {u.role || "client"}
                          </span>
                        </td>
                        <td className='py-4 px-6 text-right'>
                          <div className='flex justify-end gap-2'>
                            <ActionButton
                              icon={<Eye />}
                              onClick={() => setViewingUser(u)}
                              hoverColor='hover:text-blue-600 hover:bg-blue-50'
                            />
                            <ActionButton
                              icon={<Edit />}
                              onClick={() => setEditingUser(u)}
                              hoverColor='hover:text-emerald-600 hover:bg-emerald-50'
                            />
                            <ActionButton
                              icon={<Trash2 />}
                              onClick={() => handleDeleteUser(u._id)}
                              hoverColor='hover:text-rose-600 hover:bg-rose-50'
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan='3' className='py-16 text-center'>
                          <div className='flex flex-col items-center justify-center'>
                            <UserIcon className='w-10 h-10 text-slate-200 mb-3' />
                            <p className='text-sm font-medium text-slate-500'>
                              No users found.
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {(isCreateStudioOpen || editingStudio) && (
          <StudioModal
            studio={editingStudio}
            onClose={() => {
              setIsCreateStudioOpen(false);
              setEditingStudio(null);
            }}
            onSuccess={() => {
              setIsCreateStudioOpen(false);
              setEditingStudio(null);
              fetchData();
            }}
            getAuthHeaders={getAuthHeaders}
          />
        )}
        {(isCreateUserOpen || editingUser) && (
          <UserModal
            userToEdit={editingUser}
            studiosList={studiosList}
            onClose={() => {
              setIsCreateUserOpen(false);
              setEditingUser(null);
            }}
            onSuccess={() => {
              setIsCreateUserOpen(false);
              setEditingUser(null);
              fetchData();
            }}
            getAuthHeaders={getAuthHeaders}
          />
        )}
        {viewingUser && (
          <DetailsModal
            user={viewingUser}
            allUsers={usersList}
            studiosList={studiosList}
            onClose={() => setViewingUser(null)}
            getAuthHeaders={getAuthHeaders}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

/* --- SUBCOMPONENTS --- */

const StatCard = ({ icon, title, value, color }) => {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
  };

  return (
    <div className='p-6 rounded-[24px] bg-white border border-slate-100 shadow-sm flex items-center gap-5'>
      <div
        className={`w-14 h-14 rounded-[16px] flex items-center justify-center border shrink-0 ${colorMap[color]}`}>
        {React.cloneElement(icon, { className: "w-6 h-6 stroke-[2.5]" })}
      </div>
      <div>
        <p className='text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1'>
          {title}
        </p>
        <h3 className='text-3xl font-extrabold text-slate-900 leading-none'>
          {value}
        </h3>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`px-5 py-2.5 rounded-[14px] text-[13px] font-bold transition-all whitespace-nowrap flex items-center gap-2 shrink-0 ${
      active
        ? "bg-[#1a4d3e] text-white shadow-md"
        : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"
    }`}>
    {React.cloneElement(icon, { className: "w-4 h-4" })} {label}
  </button>
);

const ActionButton = ({ icon, onClick, hoverColor }) => (
  <button
    onClick={onClick}
    className={`p-2 bg-white border border-slate-200 rounded-[10px] transition-all text-slate-400 shadow-sm ${hoverColor}`}>
    {React.cloneElement(icon, { className: "w-4 h-4" })}
  </button>
);

const StudioCard = ({ studio, onEdit, onDelete }) => (
  <div className='bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col'>
    <div className='flex items-center gap-4 mb-6'>
      <div className='w-14 h-14 rounded-[16px] bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center'>
        {studio.studioPictures?.[0]?.[0] ? (
          <img
            src={studio.studioPictures[0][0]}
            className='w-full h-full object-cover'
            alt='Studio'
          />
        ) : (
          <Building2 className='w-6 h-6 text-slate-300' />
        )}
      </div>
      <div className='min-w-0'>
        <h3 className='text-[16px] font-extrabold text-slate-900 truncate'>
          {studio.studioName}
        </h3>
        <p className='text-[11px] font-bold text-slate-400 mt-1 flex items-center gap-1.5 uppercase tracking-wider truncate'>
          <MapPin className='w-3 h-3' />{" "}
          {studio.address?.city || "Unknown Location"}
        </p>
      </div>
    </div>
    <div className='flex gap-3 mt-auto pt-4 border-t border-slate-50'>
      <button
        onClick={onEdit}
        className='flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-[12px] text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200'>
        Edit
      </button>
      <button
        onClick={onDelete}
        className='p-2.5 bg-rose-50 text-rose-600 rounded-[12px] hover:bg-rose-100 transition-all border border-rose-100'>
        <Trash2 className='w-4 h-4' />
      </button>
    </div>
  </div>
);

/* --- SYSTEM METRICS TAB --- */
const SystemMetricsTab = ({ getAuthHeaders }) => {
  const [metrics, setMetrics] = useState({ activeVisitors: 0, serverLoad: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch(`${BASE_URL}${API_PATHS.DEV.GET_METRICS}`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) setMetrics(await res.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLive();
    const interval = setInterval(fetchLive, 8000);
    return () => clearInterval(interval);
  }, []);

  if (loading && metrics.activeVisitors === 0)
    return (
      <div className='py-20 flex justify-center'>
        <LoadingSpinner />
      </div>
    );

  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
      <MetricBox
        icon={<Globe />}
        label='Active Users (24H)'
        value={metrics.activeVisitors}
        color='emerald'
      />
      <MetricBox
        icon={<Cpu />}
        label='Server RAM Usage'
        value={`${metrics.serverLoad}%`}
        color='blue'
        hasProgress
        progressValue={metrics.serverLoad}
      />
    </div>
  );
};

const MetricBox = ({
  icon,
  label,
  value,
  color,
  hasProgress,
  progressValue,
}) => {
  const colorMap = {
    blue: "text-blue-600 border-blue-200 bg-blue-50",
    emerald: "text-emerald-600 border-emerald-200 bg-emerald-50",
  };

  return (
    <div className='bg-white p-8 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden'>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 border ${colorMap[color]}`}>
        {React.cloneElement(icon, { className: "w-5 h-5" })}
      </div>
      <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2'>
        {label}
      </p>
      <div className='flex items-end gap-4'>
        <h3 className='text-[40px] font-extrabold text-slate-900 tracking-tight leading-none'>
          {value}
        </h3>
        <div className='flex items-center gap-1.5 text-emerald-600 font-bold text-[10px] uppercase tracking-widest mb-1.5 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100'>
          <span className='w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping' />{" "}
          LIVE
        </div>
      </div>
      {hasProgress && (
        <div className='w-full bg-slate-100 h-2 rounded-full mt-6 overflow-hidden'>
          <div
            className='bg-blue-500 h-full rounded-full transition-all duration-1000'
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
};

/* --- MODALS --- */
const DetailsModal = ({
  user,
  allUsers,
  studiosList,
  onClose,
  getAuthHeaders,
}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      setLoading(true);
      try {
        if (user.role === "client") {
          const res = await fetch(
            `${BASE_URL}${API_PATHS.PASSES.GET_ALL_ACTIVE_PASS(user._id)}`,
            { headers: getAuthHeaders() },
          );
          const d = await res.json();
          setData(d.data || d);
        } else if (user.role === "studioAdmin") {
          const studioId =
            user.adminStudioLocation?._id || user.adminStudioLocation;
          const managedStudio = studiosList.find((s) => s._id === studioId);
          const clients = allUsers
            .filter((u) => u.role === "client")
            .slice(0, 10);
          setData({ studio: managedStudio, clients });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [user]);

  const totalCredits =
    user.role === "client" && data
      ? data.reduce((acc, p) => acc + (p.remainingCredits || 0), 0)
      : 0;

  return (
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white rounded-[32px] w-full max-w-2xl border border-white/20 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden'>
        <div className='p-6 md:p-8 flex justify-between items-center border-b border-slate-100 bg-white shrink-0'>
          <div>
            <h2 className='text-2xl font-extrabold text-slate-900 tracking-tight mb-1.5'>
              {user.fullName}
            </h2>
            <span className='px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-lg text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5'>
              <ShieldCheck className='w-3 h-3 text-emerald-500' /> {user.role}
            </span>
          </div>
          <button
            onClick={onClose}
            className='p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-full transition-all'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/30 custom-scrollbar space-y-6'>
          {loading ? (
            <div className='py-20 flex flex-col items-center justify-center'>
              <LoadingSpinner />
            </div>
          ) : user.role === "client" ? (
            <>
              <div className='grid grid-cols-2 gap-4'>
                <div className='bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm'>
                  <p className='text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1'>
                    Total Credits
                  </p>
                  <h4 className='text-3xl font-extrabold text-slate-900'>
                    {totalCredits}
                  </h4>
                </div>
                <div className='bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm'>
                  <p className='text-[10px] uppercase text-slate-400 font-bold tracking-widest mb-1'>
                    Active Passes
                  </p>
                  <h4 className='text-3xl font-extrabold text-slate-900'>
                    {data?.length || 0}
                  </h4>
                </div>
              </div>
              <div className='space-y-4'>
                <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                  <LayoutGrid className='w-4 h-4' /> Package Passes
                </h3>
                <div className='space-y-3'>
                  {data?.length > 0 ? (
                    data.map((p, i) => (
                      <div
                        key={i}
                        className='p-4 bg-white border border-slate-200 rounded-[16px] flex justify-between items-center shadow-sm'>
                        <div className='flex items-center gap-4'>
                          <div
                            className={`w-10 h-10 rounded-[12px] flex items-center justify-center border ${p.remainingCredits > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                            {p.remainingCredits > 0 ? (
                              <CheckCircle2 className='w-5 h-5' />
                            ) : (
                              <AlertCircle className='w-5 h-5' />
                            )}
                          </div>
                          <div>
                            <p className='font-extrabold text-slate-900 text-[14px]'>
                              {p?.packageId?.packageName || "Standard Pass"}
                            </p>
                            <p className='text-[10px] text-emerald-500 font-bold uppercase tracking-wider mt-0.5'>
                              Active
                            </p>
                          </div>
                        </div>
                        <p
                          className={`text-[20px] font-extrabold ${p.remainingCredits > 0 ? "text-slate-900" : "text-slate-400"}`}>
                          {p.remainingCredits}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-400 text-sm py-6 font-medium'>
                      No active passes.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : user.role === "studioAdmin" ? (
            <>
              <div className='p-6 bg-emerald-50 rounded-[24px] border border-emerald-100'>
                <p className='text-[10px] uppercase tracking-widest text-emerald-600 font-bold mb-2'>
                  Assigned Studio
                </p>
                <h3 className='text-[20px] font-extrabold text-slate-900'>
                  {data?.studio?.studioName || "Not Assigned"}
                </h3>
                <div className='flex items-center gap-1.5 mt-2 text-emerald-700 text-xs font-bold'>
                  <MapPin className='w-3.5 h-3.5' />{" "}
                  {data?.studio?.address?.city || "Unknown Location"}
                </div>
              </div>
              <div className='space-y-4'>
                <h3 className='text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                  <Users className='w-4 h-4' /> Managed Users
                </h3>
                <div className='space-y-2'>
                  {data?.clients?.length > 0 ? (
                    data.clients.map((c, i) => (
                      <div
                        key={i}
                        className='p-3.5 bg-white border border-slate-200 rounded-[14px] flex items-center gap-3 shadow-sm'>
                        <div className='w-8 h-8 rounded-[10px] bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-xs uppercase'>
                          {c.fullName.charAt(0)}
                        </div>
                        <div className='min-w-0'>
                          <p className='font-bold text-slate-900 text-sm truncate'>
                            {c.fullName}
                          </p>
                          <p className='text-[11px] font-medium text-slate-500 truncate'>
                            {c.email}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-400 text-sm py-6 font-medium'>
                      No users found.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className='text-center py-20 flex flex-col items-center'>
              <Server className='w-12 h-12 text-slate-300 mb-4' />
              <p className='text-slate-400 text-[11px] font-bold uppercase tracking-widest'>
                Dev Team Access
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const StudioModal = ({ studio, onClose, onSuccess, getAuthHeaders }) => {
  const isEdit = !!studio;
  const [formData, setFormData] = useState({
    studioName: studio?.studioName || "",
    street: studio?.address?.street || "",
    city: studio?.address?.city || "",
    zip: studio?.address?.zip || "",
    lat: studio?.address?.coordinates?.[0] || "",
    lng: studio?.address?.coordinates?.[1] || "",
    facilities: studio?.facilities?.join(", ") || "",
    contactNumber: studio?.contactNumber || "",
    pictureUrl: studio?.studioPictures?.[0]?.[0] || "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      studioName: formData.studioName,
      address: {
        street: formData.street,
        city: formData.city,
        zip: formData.zip,
        coordinates: [
          parseFloat(formData.lat) || 0,
          parseFloat(formData.lng) || 0,
        ],
      },
      studioPictures: formData.pictureUrl ? [[formData.pictureUrl]] : [],
      facilities: formData.facilities
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      contactNumber: formData.contactNumber,
    };
    const url = isEdit
      ? `${BASE_URL}${API_PATHS.STUDIOS.UPDATE(studio._id)}`
      : `${BASE_URL}${API_PATHS.STUDIOS.CREATE}`;
    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.ok) onSuccess();
    else alert("Failed to save studio");
  };

  return (
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white rounded-[32px] w-full max-w-2xl border border-white/20 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden'>
        <div className='p-6 md:p-8 flex justify-between items-center border-b border-slate-100 bg-white shrink-0'>
          <h2 className='text-xl font-extrabold text-slate-900'>
            {isEdit ? "Edit Studio" : "New Studio"}
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>
        <form
          onSubmit={handleSubmit}
          className='flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/30 custom-scrollbar'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-5'>
            <div className='col-span-1 sm:col-span-2'>
              <Input
                label='Studio Name'
                required
                value={formData.studioName}
                onChange={(e) =>
                  setFormData({ ...formData, studioName: e.target.value })
                }
              />
            </div>
            <Input
              label='Street Address'
              required
              value={formData.street}
              onChange={(e) =>
                setFormData({ ...formData, street: e.target.value })
              }
            />
            <Input
              label='City'
              required
              value={formData.city}
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
            />
            <Input
              label='Zip Code'
              value={formData.zip}
              onChange={(e) =>
                setFormData({ ...formData, zip: e.target.value })
              }
            />
            <Input
              label='Contact Number'
              value={formData.contactNumber}
              onChange={(e) =>
                setFormData({ ...formData, contactNumber: e.target.value })
              }
            />
            <div className='col-span-1 sm:col-span-2'>
              <Input
                label='Facilities (comma separated)'
                value={formData.facilities}
                onChange={(e) =>
                  setFormData({ ...formData, facilities: e.target.value })
                }
              />
            </div>
            <div className='col-span-1 sm:col-span-2'>
              <Input
                label='Image URL'
                value={formData.pictureUrl}
                onChange={(e) =>
                  setFormData({ ...formData, pictureUrl: e.target.value })
                }
              />
            </div>
          </div>
        </form>
        <div className='p-6 border-t border-slate-100 bg-white shrink-0'>
          <button
            type='submit'
            onClick={handleSubmit}
            className='w-full bg-[#1a4d3e] text-white py-4 rounded-[16px] font-bold text-[15px] hover:bg-[#133d31] transition-all shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)]'>
            Save Studio
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const UserModal = ({
  userToEdit,
  studiosList,
  onClose,
  onSuccess,
  getAuthHeaders,
}) => {
  const isEdit = !!userToEdit;

  // Make sure we pull out just the ID if it happens to be populated
  const initialStudioLocation =
    typeof userToEdit?.adminStudioLocation === "object"
      ? userToEdit?.adminStudioLocation?._id
      : userToEdit?.adminStudioLocation;

  const [formData, setFormData] = useState({
    fullName: userToEdit?.fullName || "",
    email: userToEdit?.email || "",
    password: "",
    role: userToEdit?.role || "client",
    adminStudioLocation: initialStudioLocation || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.role === "studioAdmin" && !formData.adminStudioLocation) {
      alert("Please select an assigned studio for the Studio Admin.");
      return;
    }

    setLoading(true);
    const url = isEdit
      ? `${BASE_URL}${API_PATHS.AUTH.UPDATE_PROFILE_ADMIN(userToEdit._id)}`
      : `${BASE_URL}${API_PATHS.AUTH.REGISTER}`;

    const payload = {
      fullName: formData.fullName,
      role: formData.role,
      isStudent: false, // Fallback to prevent backend issues
      ...(formData.password && { password: formData.password }),
      ...(!isEdit && { email: formData.email }),
      // FIX: Force null if it's an empty string or not a studio admin to prevent MongoDB CastError
      adminStudioLocation:
        formData.role === "studioAdmin" && formData.adminStudioLocation
          ? formData.adminStudioLocation
          : null,
    };

    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const resData = await res.json();

        // FIX: If creating a NEW Studio Admin, forcefully apply the studio location via PUT
        // since standard Register routes often ignore adminStudioLocation fields.
        if (
          !isEdit &&
          formData.role === "studioAdmin" &&
          formData.adminStudioLocation
        ) {
          const newUserId =
            resData?.user?._id || resData?._id || resData?.data?._id;

          if (newUserId) {
            await fetch(
              `${BASE_URL}${API_PATHS.AUTH.UPDATE_PROFILE_ADMIN(newUserId)}`,
              {
                method: "PUT",
                headers: getAuthHeaders(),
                body: JSON.stringify({
                  adminStudioLocation: formData.adminStudioLocation,
                }),
              },
            );
          }
        }

        onSuccess();
      } else {
        const errData = await res.json();
        alert(
          `Failed to save user: ${errData.message || errData.error || "Unknown server error"}`,
        );
      }
    } catch (err) {
      console.error(err);
      alert("A network error occurred while trying to save the user.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4'>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className='bg-white rounded-[24px] w-full max-w-md border border-white/20 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden'>
        <div className='px-8 py-6 border-b border-slate-100 bg-white shrink-0 flex justify-between items-center'>
          <h2 className='text-xl font-extrabold text-slate-900'>
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className='flex-1 overflow-y-auto p-8 bg-white custom-scrollbar space-y-6'>
          <div className='space-y-2'>
            <label className='text-[10px] font-extrabold uppercase text-slate-500 tracking-widest pl-1'>
              Full Name
            </label>
            <input
              required
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              className='w-full p-4 bg-white border border-slate-200 rounded-[14px] font-bold text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-[10px] font-extrabold uppercase text-slate-500 tracking-widest pl-1'>
              Email Address
            </label>
            <input
              required
              disabled={isEdit}
              type='email'
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className={`w-full p-4 border rounded-[14px] font-bold text-sm outline-none transition-all shadow-sm ${isEdit ? "bg-slate-50 border-slate-100 text-slate-500 cursor-not-allowed" : "bg-white border-slate-200 text-slate-900 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"}`}
            />
          </div>

          <div className='space-y-2'>
            <label className='text-[10px] font-extrabold uppercase text-slate-500 tracking-widest pl-1'>
              {isEdit ? "New Password" : "Password"}
            </label>
            <input
              type='password'
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className='w-full p-4 bg-white border border-slate-200 rounded-[14px] font-bold text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-[10px] font-extrabold uppercase text-slate-500 tracking-widest pl-1'>
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  role: e.target.value,
                  adminStudioLocation:
                    e.target.value !== "studioAdmin"
                      ? ""
                      : formData.adminStudioLocation,
                })
              }
              className='w-full p-4 bg-white border border-slate-200 rounded-[14px] font-bold text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none'>
              <option value='client'>Client</option>
              <option value='studioAdmin'>Studio Admin</option>
              <option value='devTeam'>Dev Team</option>
            </select>
          </div>

          {formData.role === "studioAdmin" && (
            <div className='space-y-2 animate-in fade-in slide-in-from-top-2'>
              <label className='text-[10px] font-extrabold uppercase text-emerald-600 tracking-widest pl-1'>
                Assign Studio
              </label>
              <select
                required
                value={formData.adminStudioLocation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    adminStudioLocation: e.target.value,
                  })
                }
                className='w-full p-4 bg-emerald-50/50 border border-emerald-200 rounded-[14px] font-bold text-sm text-emerald-900 outline-none focus:bg-emerald-50 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm appearance-none'>
                <option value='' disabled>
                  Select Studio...
                </option>
                {studiosList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.studioName}
                  </option>
                ))}
              </select>
            </div>
          )}
        </form>

        <div className='p-6 border-t border-slate-100 bg-white shrink-0 flex gap-4'>
          <button
            type='button'
            onClick={onClose}
            className='flex-1 py-4 text-slate-600 font-bold bg-slate-50 hover:bg-slate-100 rounded-[16px] transition-colors text-[14px]'>
            Cancel
          </button>
          <button
            type='submit'
            onClick={handleSubmit}
            disabled={loading}
            className='flex-1 py-4 bg-[#1a4d3e] text-white font-bold rounded-[16px] shadow-[0_4px_14px_-4px_rgba(26,77,62,0.4)] hover:bg-[#133d31] transition-all text-[14px] disabled:opacity-50 disabled:shadow-none'>
            {loading ? "Saving..." : "Save User"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const Input = ({ label, className, ...props }) => (
  <div className='space-y-2'>
    <label className='text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] ml-1'>
      {label}
    </label>
    <input
      {...props}
      className={`w-full p-4 bg-white border border-slate-200 rounded-[14px] font-bold text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all shadow-sm placeholder:text-slate-300 ${className || ""}`}
    />
  </div>
);

export default DevelopmentDashboard;
