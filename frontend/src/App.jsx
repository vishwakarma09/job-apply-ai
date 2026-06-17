import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import ProfilePage from "./pages/ProfilePage";
import ConnectorsPage from "./pages/ConnectorsPage";
import JobsKanbanPage from "./pages/JobsKanbanPage";
import JobDetailPage from "./pages/JobDetailPage";
import PricingPage from "./pages/PricingPage";
import SupportPage from "./pages/SupportPage";
import PrivacyPage from "./pages/PrivacyPage";
import ChatBubble from "./components/ChatBubble";

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/support" element={<SupportPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />



          {/* Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <PrivateRoute>
                <DashboardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <PrivateRoute>
                <JobsKanbanPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs/:id"
            element={
              <PrivateRoute>
                <JobDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/connectors"
            element={
              <PrivateRoute>
                <ConnectorsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <PrivateRoute>
                <PricingPage />
              </PrivateRoute>
            }
          />

          {/* Catch-all Route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <ChatBubble />
      </AuthProvider>
    </Router>
  );
}

export default App;

