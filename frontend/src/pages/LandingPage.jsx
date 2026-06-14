import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Shield, Rocket, Clock, Kanban, CheckCircle } from "lucide-react";

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] relative overflow-hidden font-sans">
      {/* Background Aura Glowing Effects */}
      <div className="ai-glow-bg w-[500px] h-[500px] top-[-10%] left-[-10%]"></div>
      <div className="ai-glow-bg w-[600px] h-[600px] bottom-[-10%] right-[-10%]" style={{ animationDelay: "-3s" }}></div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full glass-card border-x-0 border-t-0 border-white/5 bg-[#0A0A0A]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              J
            </div>
            <span className="font-bold text-lg tracking-wider text-white">AI Job Apply</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-semibold hover:text-white transition-colors">
              Sign In
            </Link>
            <Link to="/register" className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-indigo-500 hover:text-white transition-all duration-300">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center relative z-10">
        <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 rounded-full text-indigo-400 font-semibold text-xs mb-8">
          <Sparkles size={14} /> AI-Powered Autonomous Job Hunter
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
          Apply to 100s of Jobs <br/>
          <span className="glow-text">Automatically</span>
        </h1>
        
        <p className="text-lg text-[#908fa0] max-w-xl mx-auto mb-10 leading-relaxed">
          Upload your resume. Tailor cover letters matching descriptions instantly using Cerebras Cloud inference. Track applications on a smart Kanban board.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/register" className="glow-btn px-8 py-3.5 rounded-full font-bold flex items-center gap-2 w-full sm:w-auto justify-center text-sm">
            Get Started Now <ArrowRight size={16} />
          </Link>
          <Link to="/pricing" className="glass-card bg-white/5 border-white/10 px-8 py-3.5 rounded-full font-bold hover:bg-white/10 transition-colors w-full sm:w-auto text-sm">
            View Pricing Plans
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10">
        <h2 className="text-3xl font-bold text-white text-center mb-16">Features Built for Success</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-2xl flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Rocket size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Direct Resume Parsing</h3>
            <p className="text-sm text-[#908fa0] leading-relaxed">
              Upload PDF resumes. Our engine automatically parses structure and experience to match job parameters.
            </p>
          </div>
          
          <div className="glass-card p-8 rounded-2xl flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400">
              <Sparkles size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Cerebras AI Tailoring</h3>
            <p className="text-sm text-[#908fa0] leading-relaxed">
              Generate custom cover letters using Cerebras Llama 3.1-8B model based on exact role requirements.
            </p>
          </div>
          
          <div className="glass-card p-8 rounded-2xl flex flex-col gap-4">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 flex items-center justify-center text-pink-400">
              <Kanban size={24} />
            </div>
            <h3 className="text-xl font-bold text-white">Smart Kanban Board</h3>
            <p className="text-sm text-[#908fa0] leading-relaxed">
              Organize your active job hunts with status tracker columns: Applied, Interviewing, Offer.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="max-w-4xl mx-auto px-6 py-20 relative z-10 text-center">
        <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-[32px] p-12 border border-white/5 backdrop-blur-3xl">
          <h2 className="text-3xl font-black text-white mb-4">Ready to automate the queue?</h2>
          <p className="text-sm text-[#908fa0] mb-8 max-w-md mx-auto">
            Get premium features or run one-time free trials using promocodes. Start applying now.
          </p>
          <Link to="/register" className="bg-white text-black px-10 py-3.5 rounded-full font-bold hover:bg-indigo-500 hover:text-white transition-all duration-300 inline-block text-sm">
            Get Started
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 text-center text-xs text-[#908fa0] bg-[#0A0A0A]/50">
        <p>© 2026 AI Job Apply. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
