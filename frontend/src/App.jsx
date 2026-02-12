import { Routes, Route } from "react-router-dom";
import Login from "./pages/login";
import StudentDashboard from "./pages/StudentDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PlacementOfficerDashboard from "./pages/PlacementOfficerDashboard";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/student" element={<StudentDashboard />} />
      <Route path="/student/:regNo" element={<StudentDashboard />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/placement-officer" element={<PlacementOfficerDashboard />} />
    </Routes>
  );
}
