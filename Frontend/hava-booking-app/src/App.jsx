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
import AdminDashboard from "./pages/StudioAdminPage/AdminDashboard";
import ManagePackages from "./pages/StudioAdminPage/ManagePackage";
import ManageBookings from "./pages/StudioAdminPage/ManageBooking";
import ManageInstructors from "./pages/StudioAdminPage/ManageInstructor";
import ManageStudio from "./pages/StudioAdminPage/ManageStudio";
import DevelopmentDashboard from "./pages/DevAdminPage/DeveloperDashboard";
import ClientDashboard from "./pages/ClientPage/ClientDashboard";
import StudioLocation from "./pages/StudioPage/StudioLocation";

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
          {/*Protected Routes */}
          <Route element={<ProtectedRoute requiredRole='client' />}>
            <Route path='/client-dashboard' element={<ClientDashboard />} />
          </Route>
          <Route element={<ProtectedRoute requiredRole='devTeam' />}>
            <Route
              path='/development-dashboard'
              element={<DevelopmentDashboard />}
            />
          </Route>
          <Route element={<ProtectedRoute requiredRole='studioAdmin' />}>
            <Route path='/admin-dashboard' element={<AdminDashboard />} />
            <Route path='/manage-packages' element={<ManagePackages />} />
            <Route path='/manage-bookings' element={<ManageBookings />} />
            <Route path='/manage-instructors' element={<ManageInstructors />} />
            <Route path='/manage-studio' element={<ManageStudio />} />
          </Route>
          {/*Catch All Routes */}
          <Route path='*' element={<Navigate to='/' />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
