import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom"
import LandingPage from "./pages/LandingPage/LandingPage"

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />}/>
      </Routes>
    </Router>
  )
}

export default App