import React from "react";
import DashboardLayout from "../../../components/layout/DashboardLayout";
import BookTheClass from "./components/BookTheClass";

const BookClass = () => {
  return (
    <DashboardLayout activeMenu={"class-booking"}>
      <BookTheClass />
    </DashboardLayout>
  );
};

export default BookClass;
