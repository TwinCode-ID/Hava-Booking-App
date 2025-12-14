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
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPath";
import DashboardLayout from "../../components/layout/DashboardLayout";
import LoadingSpinner from "../../components/LoadingSpinner";
import { useAuth } from "../../context/AuthContext";

const Card = ({ title, headerAction, subtitle, className, children }) => {
  return (
    <div
      className={`bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-200 ${className}`}>
      {(title || headerAction) && (
        <div className='flex items-center justify-between p-6 pb-4'>
          <div>
            {title && (
              <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
            )}
            {subtitle && (
              <p className='text-sm text-gray-500 mt-1'>{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div className={title ? "px-6 pb-6" : "p-6"}>{children}</div>
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  color = "blue",
}) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    red: "from-red-500 to-red-600",
    green: "from-emerald-500 to-emerald-600",
    orange: "from-orange-500 to-orange-600",
  };

  return (
    <Card
      className={`bg-linear-to-br ${colorClasses[color]} text-white border-0`}>
      <div className='flex items-center justify-between'>
        <div>
          <p className='text-white/80 text-sm font-medium'>{title}</p>
          <p className='text-3xl font-bold mt-1'>{value}</p>
          {trend && (
            <div className='flex items-center mt-2 text-sm'>
              <TrendingUp className='h-4 w-4 mr-1' />
              <span className='font-medium'>{trendValue}</span>
            </div>
          )}
        </div>
        <div className='bg-white/10 p-3 rounded-xl'>
          <Icon className='h-6 w-6' />
        </div>
      </div>
    </Card>
  );
};

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
