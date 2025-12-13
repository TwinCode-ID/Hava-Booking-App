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

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/book-now" element={<BookNow />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
