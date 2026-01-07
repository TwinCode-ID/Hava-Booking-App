import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage/LandingPage";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/Auth/LogIn";
import SignUp from "./pages/Auth/SignUp";
import BookNow from "./pages/BookingPage/BookNow";
import ProtectedRoute from "./routers/ProtectedRoute";
import AdminDashboard from "./pages/StudioAdminPage/Dashboard/AdminDashboard";
// import ManagePackages from "./pages/StudioAdminPage/StudioActivities/components/ManagePackage/ManagePackage";
// import ManageBookings from "./pages/StudioAdminPage/ManageBooking/ManageBooking";
// import ManageInstructors from "./pages/StudioAdminPage/ManageInstructor/ManageInstructor";
import StudioSettings from "./pages/StudioAdminPage/StudioSettings/StudioSettings";
// import ManageClient from "./pages/StudioAdminPage/ManageStudioClient/ManageClient";
import DevelopmentDashboard from "./pages/DevAdminPage/DeveloperDashboard";
import ClientDashboard from "./pages/ClientPage/Dashboard/ClientDashboard";
import PurchasePackage from "./pages/ClientPage/PurchasePackage/PurchasePackage";
import StudioLocation from "./pages/StudioPage/StudioLocation";
import StudioDetails from "./pages/StudioPage/components/StudioDetails";
import ManagePackage from "./pages/ClientPage/ManagePackage/ManagePackage";
import BookClass from "./pages/ClientPage/BookClass/BookClass";
import ManageBooking from "./pages/ClientPage/ManageBooking/ManageBooking";
import ManageAccount from "./pages/ClientPage/ManageAccount/ManageAccount";
import MedicalRecords from "./pages/ClientPage/MedicalRecords/MedicalRecords";
import DashboardLayout from "./pages/StudioAdminPage/layout/DashboardLayout";
import StudioActivities from "./pages/StudioAdminPage/StudioActivities/ManageStudio";
import AccountSettings from "./pages/StudioAdminPage/Account/AccountSettings";

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/*Public Routes */}
          <Route path='/' element={<LandingPage />} />
          <Route path='/login' element={<Login />} />
          <Route path='/signup' element={<SignUp />} />
          <Route path='/book-now' element={<BookNow />} />
          <Route path='/studio-location' element={<StudioLocation />} />
          <Route path='/studio-details' element={<StudioDetails />} />
          {/*Protected Routes */}
          <Route element={<ProtectedRoute requiredRole='client' />}>
            <Route path='/client-dashboard' element={<ClientDashboard />} />
            <Route path='/purchase-packages' element={<PurchasePackage />} />
            <Route path='/manage-packages' element={<ManagePackage />} />
            <Route path='/class-booking' element={<BookClass />} />
            <Route path='/manage-bookings' element={<ManageBooking />} />
            <Route path='/manage-account' element={<ManageAccount />} />
            <Route path='/medical-records' element={<MedicalRecords />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole='devTeam' />}>
            <Route
              path='/development-dashboard'
              element={<DevelopmentDashboard />}
            />
          </Route>
          <Route element={<ProtectedRoute requiredRole='studioAdmin' />}>
            <Route element={<DashboardLayout />}>
              <Route path='/admin-dashboard' element={<AdminDashboard />} />
              <Route
                path='/admin-account-settings'
                element={<AccountSettings />}
              />
              <Route path='/studio-activities' element={<StudioActivities />} />
              <Route path='/studio-settings' element={<StudioSettings />} />
            </Route>
          </Route>
          {/*Catch All Routes */}
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
