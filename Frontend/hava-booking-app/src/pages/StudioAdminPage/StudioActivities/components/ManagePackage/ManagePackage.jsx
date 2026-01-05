import React from "react";
import AdminPackages from "./components/AdminPackages";

const ManagePackage = ({ isEmbedded = false }) => {
  return <AdminPackages isEmbedded={isEmbedded} />;
};

export default ManagePackage;
