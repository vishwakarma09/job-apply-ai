import React from "react";
import { Navigate, Link, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { LayoutDashboard, ClipboardList, Cable, User, CreditCard, LogOut, Github } from "lucide-react";

const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading, logout, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="font-semibold text-indigo-400">Loading Session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Applications", path: "/jobs", icon: ClipboardList },
    { name: "Connectors", path: "/connectors", icon: Cable },
    { name: "Profile", path: "/profile", icon: User },
    { name: "Pricing", path: "/pricing", icon: CreditCard }
  ];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] pb-24 md:pb-6 relative overflow-x-hidden">
      {/* Background radial glowing effects */}
      <div className="ai-glow-bg w-[500px] h-[500px] top-[-10%] left-[-10%]"></div>
      <div className="ai-glow-bg w-[600px] h-[600px] bottom-[-20%] right-[-10%]" style={{ animationDelay: '-4s' }}></div>

      {/* Top Application Navigation Bar */}
      <header className="sticky top-0 z-50 w-full glass-card border-x-0 border-t-0 border-white/5 bg-[#0A0A0A]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="AI Job Apply Logo" className="w-8 h-8 rounded-lg object-contain shadow-lg shadow-indigo-500/20" />
            <span className="font-bold text-lg tracking-wider text-white">AI Job Apply</span>
          </Link>
          
          <div className="flex items-center gap-4">
            <a 
              href="https://github.com/vishwakarma09/job-apply-ai" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#908fa0] hover:text-white transition-colors p-1"
              aria-label="GitHub Repository"
            >
              <Github size={20} />
            </a>
            <span className="hidden md:inline-block text-xs bg-white/5 border border-white/10 px-3 py-1 rounded-full text-indigo-300 font-semibold">
              {user?.is_premium ? "PRO Subscription" : "Free Trial"}
            </span>
            <button 
              onClick={logout}
              className="flex items-center gap-1.5 text-sm hover:text-rose-400 text-on-surface-variant transition-colors"
            >
              <LogOut size={16} />
              <span className="hidden md:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-8 relative z-10">
        {children}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card border-x-0 border-b-0 border-white/5 bg-[#0A0A0A]/80 backdrop-blur-2xl">
        <div className="max-w-md mx-auto px-6 h-16 flex items-center justify-between">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.path} 
                to={item.path}
                className={`flex flex-col items-center gap-1 transition-all ${
                  isActive ? "text-indigo-400 scale-105 font-semibold" : "text-[#908fa0] hover:text-white"
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default PrivateRoute;
