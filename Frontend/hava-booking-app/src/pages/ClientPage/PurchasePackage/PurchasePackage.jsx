import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import { useAuth } from "../../../context/AuthContext";
import PackageSelector from "./components/PackageSelector";

const PurchasePackage = () => {
  return (
    <DashboardLayout activeMenu={"purchase-packages"}>
      <PackageSelector />
    </DashboardLayout>
  );
};

export default PurchasePackage;
