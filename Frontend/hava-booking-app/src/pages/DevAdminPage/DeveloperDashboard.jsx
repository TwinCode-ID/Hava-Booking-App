import React, { useState, useEffect } from "react";
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
  ArrowUpRight,
  Cpu,
  Mail,
  Phone,
  MapPin,
  Search,
  CheckCircle2,
  AlertCircle,
  LayoutGrid,
  ShieldCheck,
} from "lucide-react";
import { BASE_URL, API_PATHS } from "../../utils/apiPath";
import { useAuth } from "../../context/AuthContext";

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
      u.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()),
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
    <div className='min-h-screen bg-slate-50 text-slate-900 p-6 md:p-10 font-sans selection:bg-blue-100 overflow-y-auto'>
      <div className='max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700'>
        {/* HEADER */}
        <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[2rem] border border-slate-200 shadow-sm sticky top-6 z-30'>
          <div className='space-y-2'>
            <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500'>
              <div className='w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse' />
              System Admin
            </div>
            <h1 className='text-3xl font-light tracking-tight text-slate-900'>
              Admin <span className='font-semibold'>Dashboard</span>
            </h1>
            <p className='text-slate-500 text-sm font-medium'>
              Managing {usersList.length} users across {studiosList.length}{" "}
              studios.
            </p>
          </div>

          <div className='flex items-center gap-4'>
            <div className='relative hidden md:block'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
              <input
                type='text'
                placeholder='Search users...'
                className='pl-11 pr-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:bg-white focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none w-64 text-slate-900 placeholder:text-slate-400'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button
              onClick={fetchData}
              className='h-12 px-6 bg-slate-900 text-white rounded-2xl font-medium hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-slate-900/10'>
              <Activity
                className={`w-4 h-4 ${isLoading ? "animate-spin text-blue-400" : ""}`}
              />
              {isLoading ? "Syncing..." : "Sync Database"}
            </button>
          </div>
        </header>

        {/* KPI GRID */}
        <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
          <StatCard
            icon={<Users />}
            title='Total Users'
            value={usersList.length}
            sub='Registered accounts'
            color='blue'
          />
          <StatCard
            icon={<Building2 />}
            title='Total Studios'
            value={studiosList.length}
            sub='Active locations'
            color='emerald'
          />
          <StatCard
            icon={<Database />}
            title='System Status'
            value='Stable'
            sub='Database connected'
            color='indigo'
          />
        </div>

        {/* MAIN INTERFACE */}
        <div className='bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col'>
          <nav className='flex items-center gap-2 p-4 border-b border-slate-100 bg-slate-50/50'>
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
          </nav>

          <div className='p-8 md:p-10 flex-1'>
            {activeTab === "overview" && (
              <SystemMetricsTab getAuthHeaders={getAuthHeaders} />
            )}

            {activeTab === "studios" && (
              <div className='animate-in fade-in slide-in-from-bottom-4 duration-500'>
                <div className='flex justify-between items-center mb-8'>
                  <h2 className='text-2xl font-light text-slate-900 tracking-wide'>
                    Manage <span className='font-semibold'>Studios</span>
                  </h2>
                  <button
                    onClick={() => setIsCreateStudioOpen(true)}
                    className='flex items-center gap-2 bg-white border border-slate-200 text-slate-700 shadow-sm px-6 py-3 rounded-xl font-medium hover:bg-slate-50 transition-all text-sm'>
                    <Plus className='w-4 h-4' /> New Studio
                  </button>
                </div>
                <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-6'>
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
              <div className='animate-in fade-in slide-in-from-bottom-4 duration-500'>
                <div className='flex justify-between items-center mb-8'>
                  <h2 className='text-2xl font-light text-slate-900 tracking-wide'>
                    User <span className='font-semibold'>Directory</span>
                  </h2>
                  <button
                    onClick={() => setIsCreateUserOpen(true)}
                    className='flex items-center gap-2 bg-slate-900 text-white shadow-md shadow-slate-900/10 px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-all text-sm'>
                    <Plus className='w-4 h-4' /> New User
                  </button>
                </div>
                <div className='overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm'>
                  <table className='w-full text-left border-collapse'>
                    <thead>
                      <tr className='text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200 bg-slate-50'>
                        <th className='py-5 px-8'>User</th>
                        <th className='py-5 px-8'>Role</th>
                        <th className='py-5 px-8 text-right'>Actions</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-slate-100'>
                      {filteredUsers.map((u) => (
                        <tr
                          key={u._id}
                          className='hover:bg-slate-50 transition-colors group'>
                          <td className='py-5 px-8'>
                            <div className='flex items-center gap-4'>
                              <div className='w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-sm group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:border-blue-200 transition-all duration-300'>
                                {u.fullName.charAt(0)}
                              </div>
                              <div>
                                <p className='font-semibold text-slate-900 text-sm mb-0.5'>
                                  {u.fullName}
                                </p>
                                <p className='text-slate-500 text-xs font-medium'>
                                  {u.email}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className='py-5 px-8'>
                            <span
                              className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border
                              ${
                                u.role === "devTeam"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                                  : u.role === "studioAdmin"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}>
                              {u.role || "client"}
                            </span>
                          </td>
                          <td className='py-5 px-8 text-right'>
                            <div className='flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-all'>
                              <ActionButton
                                icon={<Eye />}
                                onClick={() => setViewingUser(u)}
                                hoverColor='hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50'
                              />
                              <ActionButton
                                icon={<Edit />}
                                onClick={() => setEditingUser(u)}
                                hoverColor='hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50'
                              />
                              <ActionButton
                                icon={<Trash2 />}
                                onClick={() => handleDeleteUser(u._id)}
                                hoverColor='hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50'
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}
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
      </div>
    </div>
  );
};

/* --- SUBCOMPONENTS --- */

const StatCard = ({ icon, title, value, sub, color }) => {
  const colorMap = {
    blue: "text-blue-600 bg-blue-50 border-blue-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    indigo: "text-indigo-600 bg-indigo-50 border-indigo-100",
  };

  return (
    <div className='relative p-8 rounded-[2rem] bg-white border border-slate-200 shadow-sm hover:shadow-md group transition-all duration-300'>
      <div className='flex justify-between items-start mb-6'>
        <div className={`p-3 rounded-2xl border ${colorMap[color]}`}>
          {React.cloneElement(icon, { className: "w-6 h-6 stroke-[2]" })}
        </div>
      </div>
      <div>
        <h3 className='text-4xl font-light text-slate-900 tracking-tight mb-1'>
          {value}
        </h3>
        <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400'>
          {title}
        </p>
        <p className='text-xs font-medium text-slate-500 mt-2'>{sub}</p>
      </div>
    </div>
  );
};

const TabButton = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`px-6 py-3 rounded-xl text-xs font-bold uppercase tracking-widest flex items-center gap-2 transition-all duration-300
    ${active ? "bg-white text-slate-900 shadow-sm border border-slate-200/60" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"}`}>
    {React.cloneElement(icon, { className: "w-4 h-4 stroke-[2]" })} {label}
  </button>
);

const ActionButton = ({ icon, onClick, hoverColor }) => (
  <button
    onClick={onClick}
    className={`p-2.5 bg-white border border-slate-200 rounded-xl transition-all ${hoverColor} text-slate-500 shadow-sm`}>
    {React.cloneElement(icon, { className: "w-4 h-4 stroke-[2]" })}
  </button>
);

const StudioCard = ({ studio, onEdit, onDelete }) => (
  <div className='bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all group relative flex flex-col'>
    <div className='flex items-start gap-5 mb-6'>
      <div className='w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shrink-0 flex items-center justify-center'>
        {studio.studioPictures?.[0]?.[0] ? (
          <img
            src={studio.studioPictures[0][0]}
            className='w-full h-full object-cover'
            alt='Studio'
          />
        ) : (
          <Building2 className='w-6 h-6 text-slate-300 stroke-[2]' />
        )}
      </div>
      <div>
        <h3 className='text-lg font-semibold text-slate-900 tracking-wide mb-1'>
          {studio.studioName}
        </h3>
        <p className='text-xs font-medium text-slate-500 flex items-center gap-1.5'>
          <MapPin className='w-3 h-3' />{" "}
          {studio.address?.city || "Unknown Location"}
        </p>
      </div>
    </div>
    <div className='flex gap-2 mt-auto pt-4 border-t border-slate-100'>
      <button
        onClick={onEdit}
        className='flex-1 py-2.5 bg-slate-50 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all border border-slate-200'>
        Edit
      </button>
      <button
        onClick={onDelete}
        className='p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-all border border-rose-100'>
        <Trash2 className='w-4 h-4 stroke-[2]' />
      </button>
    </div>
  </div>
);

/* --- 1. SYSTEM METRICS TAB --- */
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
        <Activity className='animate-spin text-slate-400 w-10 h-10' />
      </div>
    );

  return (
    <div className='animate-in fade-in duration-700 grid grid-cols-1 lg:grid-cols-2 gap-6'>
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
    <div className='bg-slate-50/50 p-8 rounded-[2rem] border border-slate-200 relative overflow-hidden group hover:border-slate-300 transition-all'>
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center mb-8 border ${colorMap[color]}`}>
        {React.cloneElement(icon, { className: "w-5 h-5 stroke-[2]" })}
      </div>
      <p className='text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2'>
        {label}
      </p>
      <div className='flex items-end gap-4'>
        <h3 className='text-6xl font-light text-slate-900 tracking-tighter'>
          {value}
        </h3>
        <div className='flex items-center gap-2 text-emerald-600 font-bold text-[10px] uppercase tracking-widest mb-2'>
          <span className='w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping' />{" "}
          LIVE
        </div>
      </div>
      {hasProgress && (
        <div className='w-full bg-slate-200 h-1.5 rounded-full mt-8 overflow-hidden'>
          <div
            className='bg-blue-500 h-full rounded-full transition-all duration-1000'
            style={{ width: `${progressValue}%` }}
          />
        </div>
      )}
    </div>
  );
};

/* --- 2. MODALS --- */
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
          const managedStudio = studiosList.find(
            (s) => s._id === user.adminStudioLocation,
          );
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
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in-95 duration-200'>
      <div className='bg-white rounded-[2rem] p-8 w-full max-w-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[85vh]'>
        <div className='mb-8 flex justify-between items-start border-b border-slate-100 pb-6'>
          <div>
            <h2 className='text-2xl font-light text-slate-900 tracking-wide mb-2'>
              {user.fullName}
            </h2>
            <span className='px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] inline-flex items-center gap-2'>
              <ShieldCheck className='w-3 h-3 text-blue-500' /> {user.role} Role
            </span>
          </div>
          <button
            onClick={onClose}
            className='p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8'>
          {loading ? (
            <div className='py-20 flex flex-col items-center gap-4 text-slate-400'>
              <Activity className='w-8 h-8 animate-spin' />
              <p className='text-[10px] font-bold uppercase tracking-[0.2em]'>
                Loading Data...
              </p>
            </div>
          ) : user.role === "client" ? (
            <>
              <div className='grid grid-cols-2 gap-4'>
                <div className='bg-slate-50 p-6 rounded-2xl border border-slate-100'>
                  <p className='text-[10px] uppercase text-slate-500 font-bold tracking-[0.2em] mb-2'>
                    Total Credits
                  </p>
                  <h4 className='text-3xl font-light text-slate-900'>
                    {totalCredits}
                  </h4>
                </div>
                <div className='bg-slate-50 p-6 rounded-2xl border border-slate-100'>
                  <p className='text-[10px] uppercase text-slate-500 font-bold tracking-[0.2em] mb-2'>
                    Active Passes
                  </p>
                  <h4 className='text-3xl font-light text-slate-900'>
                    {data?.length || 0}
                  </h4>
                </div>
              </div>

              <div className='space-y-4'>
                <h3 className='text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                  <LayoutGrid className='w-4 h-4' /> Package Passes
                </h3>
                <div className='grid grid-cols-1 gap-3'>
                  {data?.length > 0 ? (
                    data.map((p, i) => (
                      <div
                        key={i}
                        className='p-5 bg-white border border-slate-200 rounded-2xl flex justify-between items-center shadow-sm'>
                        <div className='flex items-center gap-4'>
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center border ${p.remainingCredits > 0 ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-rose-50 text-rose-600 border-rose-200"}`}>
                            {p.remainingCredits > 0 ? (
                              <CheckCircle2 className='w-5 h-5' />
                            ) : (
                              <AlertCircle className='w-5 h-5' />
                            )}
                          </div>
                          <div>
                            <p className='font-semibold text-slate-900 text-sm'>
                              {p?.packageId?.packageName || "Standard Pass"}
                            </p>
                            <p className='text-[10px] text-slate-500 uppercase font-medium tracking-wider'>
                              Active
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p
                            className={`text-xl font-light ${p.remainingCredits > 0 ? "text-slate-900" : "text-slate-400"}`}>
                            {p.remainingCredits}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-500 text-sm py-8 font-medium'>
                      No active passes.
                    </p>
                  )}
                </div>
              </div>

              <div className='p-6 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl'>
                <p className='text-[10px] uppercase tracking-[0.2em] mb-4 text-blue-400 font-bold'>
                  Contact Info
                </p>
                <div className='space-y-3 text-sm font-medium text-slate-300'>
                  <div className='flex items-center gap-3'>
                    <Mail className='w-4 h-4 text-slate-500' /> {user.email}
                  </div>
                  {user.phoneNumber && (
                    <div className='flex items-center gap-3'>
                      <Phone className='w-4 h-4 text-slate-500' />{" "}
                      {user.phoneNumber}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : user.role === "studioAdmin" ? (
            <>
              <div className='p-8 bg-emerald-50 rounded-2xl border border-emerald-100 relative overflow-hidden'>
                <p className='text-[10px] uppercase tracking-[0.2em] text-emerald-600 font-bold mb-2'>
                  Assigned Studio
                </p>
                <h3 className='text-2xl font-light text-slate-900 tracking-wide'>
                  {data?.studio?.studioName || "Not Assigned"}
                </h3>
                <div className='flex items-center gap-2 mt-2 text-slate-500 text-xs font-medium'>
                  <MapPin className='w-3 h-3' />{" "}
                  {data?.studio?.address?.city || "Unknown Location"}
                </div>
              </div>

              <div className='space-y-4'>
                <h3 className='text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                  <Users className='w-4 h-4' /> Managed Users
                </h3>
                <div className='grid grid-cols-1 gap-2'>
                  {data?.clients?.length > 0 ? (
                    data.clients.map((c, i) => (
                      <div
                        key={i}
                        className='p-4 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center hover:bg-slate-100 transition-colors'>
                        <div className='flex items-center gap-3'>
                          <div className='w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-600 font-medium text-xs'>
                            {c.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className='font-semibold text-slate-900 text-sm'>
                              {c.fullName}
                            </p>
                            <p className='text-[10px] font-medium text-slate-500'>
                              {c.email}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-500 text-sm py-8 font-medium'>
                      No users found for this studio.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className='text-center py-20'>
              <Server className='w-16 h-16 text-slate-200 mx-auto mb-4' />
              <p className='text-slate-400 text-xs font-bold uppercase tracking-[0.2em]'>
                Dev Team Access.
              </p>
            </div>
          )}
        </div>
      </div>
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
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-[2rem] p-8 w-full max-w-2xl border border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto'>
        <div className='flex justify-between items-center mb-8 border-b border-slate-100 pb-6'>
          <h2 className='text-xl font-light text-slate-900 tracking-wide'>
            {isEdit ? "Edit Studio" : "New Studio"}
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='grid grid-cols-2 gap-5'>
          <div className='col-span-2'>
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
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />
          <Input
            label='Zip Code'
            value={formData.zip}
            onChange={(e) => setFormData({ ...formData, zip: e.target.value })}
          />
          <Input
            label='Contact Number'
            value={formData.contactNumber}
            onChange={(e) =>
              setFormData({ ...formData, contactNumber: e.target.value })
            }
          />
          <div className='col-span-2'>
            <Input
              label='Facilities (comma separated)'
              value={formData.facilities}
              onChange={(e) =>
                setFormData({ ...formData, facilities: e.target.value })
              }
            />
          </div>
          <div className='col-span-2'>
            <Input
              label='Image URL'
              value={formData.pictureUrl}
              onChange={(e) =>
                setFormData({ ...formData, pictureUrl: e.target.value })
              }
            />
          </div>
          <div className='col-span-2 pt-4'>
            <button className='w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10'>
              Save Studio
            </button>
          </div>
        </form>
      </div>
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
  const [formData, setFormData] = useState({
    fullName: userToEdit?.fullName || "",
    email: userToEdit?.email || "",
    password: "",
    role: userToEdit?.role || "client",
    adminStudioLocation: userToEdit?.adminStudioLocation || "",
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const url = isEdit
      ? `${BASE_URL}${API_PATHS.AUTH.UPDATE_PROFILE_ADMIN(userToEdit._id)}`
      : `${BASE_URL}${API_PATHS.AUTH.REGISTER}`;
    const payload = {
      fullName: formData.fullName,
      role: formData.role,
      adminStudioLocation:
        formData.role === "studioAdmin" ? formData.adminStudioLocation : "",
      ...(formData.password && { password: formData.password }),
      ...(!isEdit && { email: formData.email }),
    };
    try {
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      if (res.ok) onSuccess();
      else alert("Failed to save user");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-[2rem] p-8 w-full max-w-md border border-slate-200 shadow-2xl'>
        <div className='flex justify-between items-center mb-8 border-b border-slate-100 pb-6'>
          <h2 className='text-xl font-light text-slate-900 tracking-wide'>
            {isEdit ? "Edit User" : "New User"}
          </h2>
          <button
            onClick={onClose}
            className='p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-5'>
          <Input
            label='Full Name'
            required
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
          />
          <Input
            label='Email Address'
            required
            disabled={isEdit}
            type='email'
            value={formData.email}
            className={
              isEdit ? "opacity-50 cursor-not-allowed bg-slate-100" : ""
            }
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <Input
            label={isEdit ? "New Password" : "Password"}
            type='password'
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <div className='space-y-1.5'>
            <label className='text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] ml-1'>
              Role
            </label>
            <select
              value={formData.role}
              className='w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all'
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }>
              <option value='client'>Client</option>
              <option value='studioAdmin'>Studio Admin</option>
              <option value='devTeam'>Dev Team</option>
            </select>
          </div>

          {formData.role === "studioAdmin" && (
            <div className='space-y-1.5 animate-in slide-in-from-top-2'>
              <label className='text-[10px] font-bold uppercase text-emerald-600 tracking-[0.2em] ml-1'>
                Assign Studio
              </label>
              <select
                required
                value={formData.adminStudioLocation}
                className='w-full p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl font-medium text-emerald-900 outline-none focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 transition-all'
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    adminStudioLocation: e.target.value,
                  })
                }>
                <option value=''>Select Studio...</option>
                {studiosList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.studioName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className='pt-4'>
            <button
              type='submit'
              disabled={loading}
              className='w-full bg-slate-900 border border-slate-800 text-white py-4 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10'>
              {loading ? "Saving..." : "Save User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Input = ({ label, className, ...props }) => (
  <div className='space-y-1.5'>
    <label className='text-[10px] font-bold uppercase text-slate-500 tracking-[0.2em] ml-1'>
      {label}
    </label>
    <input
      {...props}
      className={`w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none placeholder:text-slate-400 ${className || ""}`}
    />
  </div>
);

export default DevelopmentDashboard;
