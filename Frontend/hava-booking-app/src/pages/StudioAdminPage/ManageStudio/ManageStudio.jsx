import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import StudioDetails from "./components/StudioDetails";

const ManageStudio = () => {
  return (
    <DashboardLayout activeMenu={"manage-studio"}>
      <StudioDetails />
    </DashboardLayout>
  );
};

export default ManageStudio;
