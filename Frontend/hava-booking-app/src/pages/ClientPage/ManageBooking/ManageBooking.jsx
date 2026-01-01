import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import BookingList from "./components/BookingList";

const ManageBooking = () => {
  return (
    <DashboardLayout activeMenu={"manage-bookings"}>
      <BookingList />
    </DashboardLayout>
  );
};

export default ManageBooking;
