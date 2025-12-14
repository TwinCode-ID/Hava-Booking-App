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
import ManagePackage from "./pages/StudioAdminPage/ManagePackage";
import ManageBooking from "./pages/StudioAdminPage/ManageBooking";
import ManageStudio from "./pages/StudioAdminPage/ManageStudio";
import DevelopmentDashboard from "./pages/DevAdminPage/DeveloperDashboard";
import ClientDashboard from "./pages/ClientPage/ClientDashboard";

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
            <Route path='/manage-package' element={<ManagePackage />} />
            <Route path='/manage-booking' element={<ManageBooking />} />
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
