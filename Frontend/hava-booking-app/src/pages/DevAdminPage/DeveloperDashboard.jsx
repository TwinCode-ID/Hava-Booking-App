import React from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";

const DevelopmentDashboard = () => {
  return (
    <DashboardLayout activeMenu={"development-dashboard"}>
      Development Dashboard
    </DashboardLayout>
  );
};

export default DevelopmentDashboard;
