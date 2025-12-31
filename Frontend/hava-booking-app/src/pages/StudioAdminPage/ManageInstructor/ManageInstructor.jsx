import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import InstructorList from "./components/InstructorList";

const ManageInstructor = () => {
  return (
    <DashboardLayout activeMenu={"manage-instructors"}>
      <InstructorList />
    </DashboardLayout>
  );
};

export default ManageInstructor;
