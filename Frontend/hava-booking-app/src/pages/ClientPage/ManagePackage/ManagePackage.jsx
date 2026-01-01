import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import PackageList from "./components/PackageList";

const ManagePackage = () => {
  return (
    <DashboardLayout activeMenu={"manage-packages"}>
      <PackageList />
    </DashboardLayout>
  );
};

export default ManagePackage;
