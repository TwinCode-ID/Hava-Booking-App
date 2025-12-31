import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import AdminPaymentManager from "./components/AdminPaymentManager";

const ManageBooking = () => {
  return (
    <DashboardLayout activeMenu={"manage-bookings"}>
      <AdminPaymentManager />
    </DashboardLayout>
  );
};

export default ManageBooking;
