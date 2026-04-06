import { Routes, Route, Navigate } from "react-router-dom";
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
      <Route path="/admin" element={<PlacementOfficerDashboard />} />
      <Route path="/faculty" element={<AdminDashboard />} />
      <Route path="/placement-officer" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
