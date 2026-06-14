import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Mail, Lock, Sparkles, AlertTriangle } from "lucide-react";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleResponse = async (response) => {
    try {
      setError("");
      setSubmitting(true);
      await loginWithGoogle(response.credential);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Google SSO Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    // Load Google Identity script
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: "52677516043-hsgbgvt1utri5c2ottm0sa60piv5ilta.apps.googleusercontent.com",
          callback: handleGoogleResponse,
        });
        window.google.accounts.id.renderButton(
          document.getElementById("google-signin-btn"),
          { theme: "dark", size: "large", width: "320px" }
        );
      }
    };
    
    return () => {
      try {
        document.body.removeChild(script);
      } catch (e) {}
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid email or password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="ai-glow-bg w-[400px] h-[400px] top-[10%] left-[10%]"></div>
      
      <div className="w-full max-w-md glass-card p-10 rounded-3xl relative z-10 border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 mb-4">
            J
          </div>
          <h2 className="text-2xl font-black text-white">Sign In</h2>
          <p className="text-sm text-[#908fa0] mt-1">Welcome back to AI Job Apply</p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-xs flex items-center gap-2 mb-6">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-[#908fa0]">
                <Mail size={16} />
              </span>
              <input 
                type="email" 
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">Password</label>
              <Link to="/forgot-password" className="text-xs text-indigo-400 hover:text-indigo-300">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-3.5 text-[#908fa0]">
                <Lock size={16} />
              </span>
              <input 
                type="password" 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-black/40 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="glow-btn w-full py-3.5 rounded-xl font-bold text-sm mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <div className="relative my-8 text-center">
          <hr className="border-white/5"/>
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#0A0A0A] px-4 text-xs text-[#908fa0] uppercase tracking-widest">or continue with</span>
        </div>

        <div className="flex justify-center mb-6">
          <div id="google-signin-btn" className="w-full max-w-[320px]"></div>
        </div>

        <p className="text-center text-xs text-[#908fa0]">
          Don't have an account?{" "}
          <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
            Register now
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
