import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import ClientManager from "./components/ClientManaget";

const ManageClient = () => {
  return (
    <DashboardLayout activeMenu={"manage-client"}>
      <ClientManager />
    </DashboardLayout>
  );
};

export default ManageClient;
