import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import SettingList from "./components/SettingList";

const ManageAccount = () => {
  return (
    <DashboardLayout activeMenu={"manage-account"}>
      <SettingList />
    </DashboardLayout>
  );
};

export default ManageAccount;
