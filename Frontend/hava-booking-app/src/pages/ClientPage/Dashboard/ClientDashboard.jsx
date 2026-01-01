import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import Card from "./components/Card";

const ClientDashboard = () => {
  return (
    <DashboardLayout activeMenu={"client-dashboard"}>
      <Card />
    </DashboardLayout>
  );
};

export default ClientDashboard;
