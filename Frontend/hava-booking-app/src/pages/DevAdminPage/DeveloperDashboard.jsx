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
  Calendar,
  CreditCard,
  ShieldCheck,
  LayoutGrid,
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
    <div className='p-6 md:p-10 max-w-[1600px] mx-auto space-y-10 animate-in fade-in duration-700 h-full overflow-y-auto bg-slate-50/50 min-h-screen'>
      {/* HEADER */}
      <header className='flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] shadow-sm border border-white/20 sticky top-0 z-30'>
        <div className='space-y-1'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 text-white text-[10px] font-bold uppercase tracking-widest'>
            <Server className='w-3 h-3 text-emerald-400' /> System Root
          </div>
          <h1 className='text-3xl font-black text-slate-900 tracking-tight'>
            Control Center
          </h1>
          <p className='text-slate-500 text-sm font-medium'>
            Monitoring {usersList.length} accounts across {studiosList.length}{" "}
            studios.
          </p>
        </div>

        <div className='flex items-center gap-4'>
          <div className='relative hidden md:block'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400' />
            <input
              type='text'
              placeholder='Search directory...'
              className='pl-11 pr-6 py-3.5 bg-slate-100/50 border-transparent rounded-2xl text-sm font-bold focus:bg-white focus:ring-4 focus:ring-slate-900/5 transition-all outline-none w-64'
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={fetchData}
            className='h-14 px-8 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 active:scale-95 transition-all flex items-center gap-3 shadow-xl shadow-slate-900/20'>
            <Activity
              className={`w-5 h-5 ${isLoading ? "animate-spin text-emerald-400" : "text-emerald-400"}`}
            />
            {isLoading ? "Syncing..." : "Sync Database"}
          </button>
        </div>
      </header>

      {/* KPI GRID */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-8'>
        <StatCard
          icon={<Users />}
          title='Identity Vault'
          value={usersList.length}
          color='blue'
          sub='Total system accounts'
        />
        <StatCard
          icon={<Building2 />}
          title='Studio Network'
          value={studiosList.length}
          color='emerald'
          sub='Managed locations'
        />
        <StatCard
          icon={<Database />}
          title='System Health'
          value='Stable'
          color='purple'
          sub='DB status: Connected'
        />
      </div>

      <div className='bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col'>
        <nav className='flex items-center gap-4 p-6 bg-slate-50/50 border-b border-slate-100'>
          <TabButton
            active={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            label='Metrics'
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
            label='Accounts'
            icon={<Users />}
          />
        </nav>

        <div className='p-8 md:p-12 flex-1'>
          {activeTab === "overview" && (
            <SystemMetricsTab getAuthHeaders={getAuthHeaders} />
          )}

          {activeTab === "studios" && (
            <div className='animate-in slide-in-from-bottom-8 duration-500'>
              <div className='flex justify-between items-center mb-12'>
                <h2 className='text-3xl font-black text-slate-900'>Studios</h2>
                <button
                  onClick={() => setIsCreateStudioOpen(true)}
                  className='flex items-center gap-2 bg-emerald-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-emerald-700 transition-all'>
                  <Plus className='w-5 h-5' /> New Location
                </button>
              </div>
              <div className='grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-8'>
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
            <div className='animate-in slide-in-from-bottom-8 duration-500'>
              <div className='flex justify-between items-center mb-12'>
                <h2 className='text-3xl font-black text-slate-900'>
                  User Directory
                </h2>
                <button
                  onClick={() => setIsCreateUserOpen(true)}
                  className='flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-2xl font-black hover:bg-slate-800 transition-all'>
                  <Plus className='w-5 h-5' /> New Account
                </button>
              </div>
              <div className='overflow-x-auto rounded-[2rem] border border-slate-100 bg-white'>
                <table className='w-full text-left border-collapse'>
                  <thead className='bg-slate-50/50'>
                    <tr className='text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100'>
                      <th className='py-6 px-10'>Identity</th>
                      <th className='py-6 px-10'>Role</th>
                      <th className='py-6 px-10 text-right'>Actions</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-slate-100'>
                    {filteredUsers.map((u) => (
                      <tr
                        key={u._id}
                        className='hover:bg-slate-50/30 transition-colors group'>
                        <td className='py-8 px-10'>
                          <div className='flex items-center gap-5'>
                            <div className='w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 font-black group-hover:bg-slate-900 group-hover:text-white transition-all duration-300'>
                              {u.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className='font-black text-slate-900 text-lg leading-none mb-1'>
                                {u.fullName}
                              </p>
                              <p className='text-slate-400 text-sm font-medium'>
                                {u.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className='py-8 px-10'>
                          <span
                            className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider
                            ${
                              u.role === "devTeam"
                                ? "bg-indigo-100 text-indigo-700"
                                : u.role === "studioAdmin"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-blue-100 text-blue-700"
                            }`}>
                            {u.role || "client"}
                          </span>
                        </td>
                        <td className='py-8 px-10 text-right'>
                          <div className='flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0'>
                            <button
                              onClick={() => setViewingUser(u)}
                              className='p-3 bg-white border border-slate-100 rounded-xl hover:text-emerald-600 transition-colors shadow-sm'>
                              <Eye className='w-5 h-5' />
                            </button>
                            <button
                              onClick={() => setEditingUser(u)}
                              className='p-3 bg-white border border-slate-100 rounded-xl hover:text-blue-600 transition-colors shadow-sm'>
                              <Edit className='w-5 h-5' />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u._id)}
                              className='p-3 bg-white border border-slate-100 rounded-xl hover:text-rose-600 transition-colors shadow-sm'>
                              <Trash2 className='w-5 h-5' />
                            </button>
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

      {/* --- MODALS --- */}
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
  );
};

// --- KPI & TABS HELPERS ---
const StatCard = ({ icon, title, value, color, sub }) => (
  <div
    className={`p-8 rounded-[2.5rem] bg-white border border-slate-100 shadow-lg flex items-center gap-6 group hover:-translate-y-2 transition-all duration-500`}>
    <div
      className={`w-20 h-20 rounded-3xl flex items-center justify-center text-3xl transition-transform group-hover:scale-110 duration-500 
            ${color === "blue" ? "bg-blue-50 text-blue-600" : color === "emerald" ? "bg-emerald-50 text-emerald-600" : "bg-purple-50 text-purple-600"}`}>
      {React.cloneElement(icon, { className: "w-8 h-8" })}
    </div>
    <div>
      <p className='text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1'>
        {title}
      </p>
      <h3 className='text-4xl font-black text-slate-900 tracking-tighter'>
        {value}
      </h3>
      <p className='text-xs font-bold text-slate-400 mt-1'>{sub}</p>
    </div>
  </div>
);

const TabButton = ({ active, onClick, label, icon }) => (
  <button
    onClick={onClick}
    className={`px-8 py-4 rounded-2xl text-sm font-black flex items-center gap-3 transition-all ${active ? "bg-white text-slate-900 shadow-xl border border-slate-200" : "text-slate-400 hover:text-slate-600"}`}>
    {React.cloneElement(icon, { className: "w-4 h-4" })} {label}
  </button>
);

const StudioCard = ({ studio, onEdit, onDelete }) => (
  <div className='bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group relative overflow-hidden'>
    <div className='flex items-center gap-6 mb-8 relative z-10'>
      <div className='w-24 h-24 rounded-[2rem] bg-slate-50 border border-slate-100 overflow-hidden shrink-0'>
        {studio.studioPictures?.[0]?.[0] ? (
          <img
            src={studio.studioPictures[0][0]}
            className='w-full h-full object-cover'
          />
        ) : (
          <Building2 className='w-10 h-10 text-slate-200 mx-auto mt-7' />
        )}
      </div>
      <div>
        <h3 className='text-2xl font-black text-slate-900 tracking-tight leading-none mb-2'>
          {studio.studioName}
        </h3>
        <p className='text-sm font-bold text-slate-400 flex items-center gap-1'>
          <MapPin className='w-3.5 h-3.5' /> {studio.address?.city}
        </p>
      </div>
    </div>
    <div className='flex gap-3 relative z-10'>
      <button
        onClick={onEdit}
        className='flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black hover:bg-slate-800 transition-all'>
        Edit
      </button>
      <button
        onClick={onDelete}
        className='p-4 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-all'>
        <Trash2 className='w-5 h-5' />
      </button>
    </div>
  </div>
);

// --- 1. SYSTEM METRICS TAB ---
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
        <Activity className='animate-spin text-slate-200 w-16 h-16' />
      </div>
    );

  return (
    <div className='animate-in fade-in duration-700 grid grid-cols-1 lg:grid-cols-2 gap-12'>
      <MetricBox
        icon={<Globe />}
        label='Users active in last 24h'
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
}) => (
  <div className='bg-white p-12 rounded-[3rem] border border-slate-100 shadow-sm relative overflow-hidden'>
    <div
      className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-10 bg-${color}-50 text-${color}-600 border border-${color}-100`}>
      {React.cloneElement(icon, { className: "w-8 h-8" })}
    </div>
    <p className='text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2'>
      {label}
    </p>
    <div className='flex items-end gap-4'>
      <h3 className='text-8xl font-black text-slate-900 tracking-tighter leading-none'>
        {value}
      </h3>
      <div className='flex items-center gap-2 text-emerald-500 font-black text-xs mb-3'>
        <span className='w-2 h-2 bg-emerald-500 rounded-full animate-ping' />{" "}
        REALTIME
      </div>
    </div>
    {hasProgress && (
      <div className='w-full bg-slate-100 h-4 rounded-full mt-12 overflow-hidden border border-slate-200'>
        <div
          className='bg-blue-600 h-full rounded-full transition-all duration-1000'
          style={{ width: `${progressValue}%` }}
        />
      </div>
    )}
  </div>
);

// --- 2. THE IMPROVED DETAILS MODAL ---
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
          // In a production app, this would be a real query for clients belonging to a studio
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
    <div className='fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-in fade-in zoom-in duration-300'>
      <div className='bg-white rounded-[3.5rem] p-12 w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col relative border border-white/20'>
        {/* Modal Header */}
        <div className='mb-12 flex justify-between items-start'>
          <div>
            <h2 className='text-4xl font-black text-slate-900 tracking-tight leading-none'>
              {user.fullName}
            </h2>
            <div className='flex items-center gap-3 mt-4'>
              <span className='px-3 py-1 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-2'>
                <ShieldCheck className='w-3 h-3 text-emerald-400' /> {user.role}{" "}
                Identity
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-4 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-3xl transition-all'>
            <X className='w-6 h-6' />
          </button>
        </div>

        <div className='flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-10'>
          {loading ? (
            <div className='py-24 flex flex-col items-center justify-center gap-4 text-slate-300'>
              <Activity className='w-12 h-12 animate-spin' />
              <p className='font-black text-[10px] tracking-[0.3em] uppercase opacity-50'>
                Syncing Identity Data...
              </p>
            </div>
          ) : user.role === "client" ? (
            <>
              {/* Client Portfolio Overview */}
              <div className='grid grid-cols-2 gap-6'>
                <div className='bg-emerald-50/50 p-8 rounded-[2.5rem] border border-emerald-100 shadow-sm'>
                  <p className='text-[10px] font-black uppercase text-emerald-600 tracking-[0.2em] mb-2'>
                    Portfolio Credits
                  </p>
                  <h4 className='text-4xl font-black text-emerald-900'>
                    {totalCredits}
                  </h4>
                </div>
                <div className='bg-blue-50/50 p-8 rounded-[2.5rem] border border-blue-100 shadow-sm'>
                  <p className='text-[10px] font-black uppercase text-blue-600 tracking-[0.2em] mb-2'>
                    Asset Count
                  </p>
                  <h4 className='text-4xl font-black text-blue-900'>
                    {data?.length || 0}{" "}
                    <span className='text-sm opacity-30'>Passes</span>
                  </h4>
                </div>
              </div>

              {/* Package Passes Inventory */}
              <div className='space-y-6'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-xl font-black text-slate-900 flex items-center gap-2'>
                    <LayoutGrid className='w-5 h-5 text-slate-400' /> Asset
                    Inventory
                  </h3>
                </div>
                <div className='grid grid-cols-1 gap-4'>
                  {data?.length > 0 ? (
                    data.map((p, i) => (
                      <div
                        key={i}
                        className='group p-8 bg-white border border-slate-100 rounded-[2.5rem] hover:border-slate-900 transition-all flex justify-between items-center shadow-sm'>
                        <div className='flex items-center gap-6'>
                          <div
                            className={`w-16 h-16 rounded-2xl flex items-center justify-center font-black text-2xl ${p.remainingCredits > 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-50 text-rose-300"}`}>
                            {p.remainingCredits > 0 ? (
                              <CheckCircle2 className='w-8 h-8' />
                            ) : (
                              <AlertCircle className='w-8 h-8' />
                            )}
                          </div>
                          <div>
                            <p className='font-black text-slate-900 text-xl leading-none mb-1'>
                              {p?.packageId?.packageName || "Standard Pass"}
                            </p>
                            <p className='text-xs font-bold text-slate-400 tracking-wide'>
                              Verified Smart Asset
                            </p>
                          </div>
                        </div>
                        <div className='text-right'>
                          <p
                            className={`text-3xl font-black ${p.remainingCredits > 0 ? "text-slate-900" : "text-slate-300"}`}>
                            {p.remainingCredits}
                          </p>
                          <p className='text-[10px] font-black uppercase text-slate-400 tracking-widest mt-1'>
                            Remaining
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-400 py-10 font-bold italic opacity-40'>
                      No identity assets found.
                    </p>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className='p-10 bg-slate-900 rounded-[3rem] text-white shadow-2xl shadow-slate-900/20'>
                <p className='text-[10px] font-black uppercase tracking-[0.3em] mb-6 text-emerald-400'>
                  Secure Contact Node
                </p>
                <div className='space-y-4'>
                  <div className='flex items-center gap-4 text-xl font-bold'>
                    <Mail className='w-6 h-6 text-slate-400' /> {user.email}
                  </div>
                  {user.phoneNumber && (
                    <div className='flex items-center gap-4 text-xl font-bold'>
                      <Phone className='w-6 h-6 text-slate-400' />{" "}
                      {user.phoneNumber}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : user.role === "studioAdmin" ? (
            <>
              {/* Admin Jurisdiction Card */}
              <div className='p-10 bg-emerald-900 rounded-[3rem] text-white relative overflow-hidden shadow-2xl shadow-emerald-900/20'>
                <Building2 className='absolute -right-8 -bottom-8 w-48 h-48 opacity-10 rotate-12' />
                <div className='relative z-10'>
                  <p className='text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-3'>
                    Managed Jurisdiction
                  </p>
                  <h3 className='text-4xl font-black leading-tight tracking-tight'>
                    {data?.studio?.studioName || "Standby Status"}
                  </h3>
                  <div className='flex items-center gap-3 mt-4 text-emerald-400 font-black text-sm uppercase tracking-widest'>
                    <MapPin className='w-4 h-4' />{" "}
                    {data?.studio?.address?.city || "Unassigned"}
                  </div>
                </div>
              </div>

              {/* Managed Clients Context */}
              <div className='space-y-6'>
                <div className='flex justify-between items-center'>
                  <h3 className='text-xl font-black text-slate-900 flex items-center gap-2'>
                    <Users className='w-5 h-5 text-slate-400' /> Supervised
                    Entities
                  </h3>
                  <span className='px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black tracking-widest'>
                    {data?.clients?.length} TOTAL
                  </span>
                </div>
                <div className='grid grid-cols-1 gap-3'>
                  {data?.clients?.length > 0 ? (
                    data.clients.map((c, i) => (
                      <div
                        key={i}
                        className='p-6 bg-white border border-slate-100 rounded-[2rem] flex justify-between items-center hover:shadow-lg transition-all'>
                        <div className='flex items-center gap-4'>
                          <div className='w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 text-lg'>
                            {c.fullName.charAt(0)}
                          </div>
                          <div>
                            <p className='font-black text-slate-900 text-lg leading-none mb-1'>
                              {c.fullName}
                            </p>
                            <p className='text-xs font-bold text-slate-400'>
                              {c.email}
                            </p>
                          </div>
                        </div>
                        <button className='p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-xl transition-colors'>
                          <ArrowUpRight className='w-4 h-4' />
                        </button>
                      </div>
                    ))
                  ) : (
                    <p className='text-center text-slate-400 py-10 font-bold opacity-30 italic'>
                      No assigned entities under this jurisdiction.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className='text-center py-24 space-y-6'>
              <Server className='w-24 h-24 text-slate-100 mx-auto' />
              <p className='text-slate-400 font-bold text-sm tracking-widest uppercase opacity-40'>
                Root Privileges Active. End of Portal.
              </p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className='mt-12 w-full bg-slate-900 text-white py-6 rounded-[2rem] font-black text-xl hover:bg-slate-800 transition-all shadow-2xl shadow-slate-900/20 active:scale-95'>
          Close
        </button>
      </div>
    </div>
  );
};

// --- 3. STUDIO & USER MODALS (Consistent UI) ---
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
    else alert("Error saving studio");
  };

  return (
    <div className='fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-[3rem] p-12 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]'>
        <div className='flex justify-between items-center mb-10'>
          <h2 className='text-3xl font-black text-slate-900'>
            {isEdit ? "Edit Studio" : "New Studio"}
          </h2>
          <button
            onClick={onClose}
            className='p-3 hover:bg-slate-100 rounded-2xl transition-colors'>
            <X />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='grid grid-cols-2 gap-6'>
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
            label='Street'
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
            label='Contact #'
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
          <div className='col-span-2 pt-6'>
            <button className='w-full bg-emerald-600 text-white py-6 rounded-3xl font-black text-xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20'>
              Save Studio Data
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
      else alert("Error saving account");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-[3rem] p-12 w-full max-w-md shadow-2xl border border-slate-100'>
        <div className='flex justify-between items-center mb-10'>
          <h2 className='text-3xl font-black text-slate-900'>
            {isEdit ? "Sync User" : "New Account"}
          </h2>
          <button
            onClick={onClose}
            className='p-3 hover:bg-slate-100 rounded-2xl transition-colors'>
            <X />
          </button>
        </div>
        <form onSubmit={handleSubmit} className='space-y-6'>
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
            className={isEdit ? "opacity-50 cursor-not-allowed" : ""}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
          />
          <Input
            label={isEdit ? "New Password (Optional)" : "Password"}
            type='password'
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
          />

          <div className='space-y-2'>
            <label className='text-[10px] font-black uppercase text-slate-400 ml-4 tracking-widest'>
              Assigned Role
            </label>
            <select
              value={formData.role}
              className='w-full p-5 bg-slate-50 border border-slate-200 rounded-[1.5rem] font-bold outline-none'
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }>
              <option value='client'>Client</option>
              <option value='studioAdmin'>Studio Admin</option>
              <option value='devTeam'>Dev Team</option>
            </select>
          </div>

          {formData.role === "studioAdmin" && (
            <div className='space-y-2 animate-in slide-in-from-top-4'>
              <label className='text-[10px] font-black uppercase text-emerald-600 ml-4 tracking-widest'>
                Assign Studio
              </label>
              <select
                required
                value={formData.adminStudioLocation}
                className='w-full p-5 bg-emerald-50/50 border border-emerald-100 rounded-[1.5rem] font-bold text-emerald-900 outline-none'
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
          <button
            type='submit'
            disabled={loading}
            className='w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xl hover:bg-slate-800 transition-all shadow-xl'>
            {loading ? "Processing..." : "Commit Changes"}
          </button>
        </form>
      </div>
    </div>
  );
};

const Input = ({ label, ...props }) => (
  <div className='space-y-2'>
    <label className='text-[10px] font-black uppercase text-slate-400 ml-5 tracking-[0.2em]'>
      {label}
    </label>
    <input
      {...props}
      className='w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-bold text-slate-900 focus:bg-white focus:ring-4 focus:ring-slate-900/5 transition-all outline-none placeholder:text-slate-200'
    />
  </div>
);

export default DevelopmentDashboard;
