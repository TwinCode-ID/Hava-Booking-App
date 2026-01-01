import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import MedicalList from "./components/MedicalList";

const MedicalRecords = () => {
  return (
    <DashboardLayout activeMenu={"medical-records"}>
      <MedicalList />
    </DashboardLayout>
  );
};

export default MedicalRecords;
