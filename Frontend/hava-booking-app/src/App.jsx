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
import StudioSettings from "./pages/StudioAdminPage/StudioSettings/StudioSettings";
import DevelopmentDashboard from "./pages/DevAdminPage/DeveloperDashboard";
import ClientDashboard from "./pages/ClientPage/Dashboard/ClientDashboard";
import ClientDashboardLayout from "./pages/ClientPage/layout/DashboardLayout";
import StudioLocation from "./pages/StudioPage/StudioLocation";
import StudioDetails from "./pages/StudioPage/components/StudioDetails";
import ClientAccountSettings from "./pages/ClientPage/ManageAccount/ManageAccount";
import DashboardLayout from "./pages/StudioAdminPage/layout/DashboardLayout";
import StudioActivities from "./pages/StudioAdminPage/StudioActivities/ManageStudio";
import AdminAccountSettings from "./pages/StudioAdminPage/Account/AccountSettings";
import ManageClient from "./pages/ClientPage/ClientActivities/ManageClient";
import BookTheClass from "./pages/ClientPage/ClientActivities/components/BookClass/components/BookTheClass";
import ManageBooking from "./pages/ClientPage/ClientActivities/components/ManageBooking/ManageBooking";

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
            <Route element={<ClientDashboardLayout />}>
              <Route path='/client-dashboard' element={<ClientDashboard />} />
              <Route path='/book-the-class' element={<BookTheClass />} />
              <Route path='/client-activities' element={<ManageClient />} />
              <Route
                path='/client-account-settings'
                element={<ClientAccountSettings />}
              />
            </Route>
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
                element={<AdminAccountSettings />}
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
