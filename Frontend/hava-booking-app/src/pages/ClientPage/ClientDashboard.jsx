import React from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import { useAuth } from "../../context/AuthContext";

const ClientDashboard = () => {
  return (
    <DashboardLayout activeMenu={"client-dashboard"}>
      Client Dashboard
    </DashboardLayout>
  );
};

export default ClientDashboard;
