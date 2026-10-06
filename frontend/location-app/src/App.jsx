import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.jsx";
import AdminDashboard from "./pages/AdminDashboard.jsx";
import CustomerDashboard from "./pages/CustomerDashboard.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import WorkerDashboard from "./pages/WorkerDashboard.jsx";
import HomePage from "./pages/HomePage.jsx";

function HomeRedirect() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "ADMIN") return <Navigate to="/admin" replace />;
  if (user.role === "WORKER") return <Navigate to="/worker" replace />;

  return <Navigate to="/customer" replace />;
}

function CustomerRoute() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "CUSTOMER"
    ? <CustomerDashboard />
    : <HomeRedirect />;
}

function WorkerRoute() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "WORKER"
    ? <WorkerDashboard />
    : <HomeRedirect />;
}

function AdminRoute() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  return user.role === "ADMIN"
    ? <AdminDashboard />
    : <HomeRedirect />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/customer" element={<CustomerRoute />} />
          <Route path="/worker" element={<WorkerRoute />} />
          <Route path="/admin" element={<AdminRoute />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
