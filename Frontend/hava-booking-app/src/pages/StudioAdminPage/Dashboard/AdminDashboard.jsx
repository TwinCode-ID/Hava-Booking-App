import { Children, useEffect, useState } from "react";
import {
  Plus,
  Briefcase,
  Users,
  Building2,
  TrendingUp,
  CheckCircle2,
  Icon,
} from "lucide-react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import axiosInstance from "../../../utils/axiosInstance";
import { API_PATHS } from "../../../utils/apiPath";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import LoadingSpinner from "../../../components/LoadingSpinner";
import { useAuth } from "../../../context/AuthContext";
import StatCard from "./components/Card";

const AdminDashboard = () => {
  const navigate = useNavigate();

  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  return (
    <div>
      <DashboardLayout activeMenu='admin-dashboard' role={user?.role || ""}>
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <div className='max-w-7xl mx-auto space-y-8 mb-96'>
            <div className=' grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6'>
              <StatCard
                title='Total Bookings'
                value={20}
                icon={Briefcase}
                trend={true}
                trendValue={"+12%"}
                color='blue'
              />

              <StatCard
                title='Waiting for Payment Approval'
                value={5}
                icon={Users}
                trend={true}
                trendValue={"+8%"}
                color='red'
              />

              <StatCard
                title='Booking Confirmed'
                value={15}
                icon={Users}
                trend={true}
                trendValue={"+25%"}
                color='green'
              />
            </div>
          </div>
        )}
      </DashboardLayout>
    </div>
  );
};

export default AdminDashboard;
