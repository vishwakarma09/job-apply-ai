import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, CheckCircle, ArrowLeft } from "lucide-react";

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Mimic API request delay
    setTimeout(() => {
      setSuccess(true);
      setSubmitting(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] flex items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="ai-glow-bg w-[400px] h-[400px] top-[10%] left-[10%]"></div>
      
      <div className="w-full max-w-md glass-card p-10 rounded-3xl relative z-10 border border-white/10">
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 mb-4">
            J
          </div>
          <h2 className="text-2xl font-black text-white">Reset Password</h2>
          <p className="text-sm text-[#908fa0] mt-1">
            Enter your email and we'll send you a password reset link
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <CheckCircle className="text-indigo-400" size={48} />
            <h3 className="text-lg font-bold text-white">Check your email</h3>
            <p className="text-sm text-[#908fa0] leading-relaxed">
              We have sent a password reset link to <strong>{email}</strong>.
            </p>
            <Link 
              to="/login"
              className="mt-6 flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </div>
        ) : (
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

            <button 
              type="submit"
              disabled={submitting}
              className="glow-btn w-full py-3.5 rounded-xl font-bold text-sm mt-2 disabled:opacity-50"
            >
              {submitting ? "Sending Link..." : "Send Reset Link"}
            </button>

            <Link 
              to="/login"
              className="text-center flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-[#908fa0] font-semibold mt-4 transition-colors"
            >
              <ArrowLeft size={14} /> Back to Sign In
            </Link>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
