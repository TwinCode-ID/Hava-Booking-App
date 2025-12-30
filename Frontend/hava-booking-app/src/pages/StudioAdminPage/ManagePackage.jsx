import React from "react";
import DashboardLayout from "../../components/layout/DashboardLayout";
import AdminPackages from "./components/AdminPackages";

const ManagePackage = () => {
  return (
    <DashboardLayout activeMenu={"manage-packages"}>
      <AdminPackages />
    </DashboardLayout>
  );
};

export default ManagePackage;
