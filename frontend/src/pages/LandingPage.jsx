import React from "react";
import { Link } from "react-router-dom";
import { 
  ArrowRight, Sparkles, Shield, Rocket, Clock, Kanban, CheckCircle, Github,
  Linkedin, Search, Building2, Briefcase, Sprout, Landmark, Radio, Users2, Plane, Cpu, Chrome 
} from "lucide-react";
import { useAuth } from "../context/AuthContext";

const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] relative overflow-hidden font-sans">
      {/* Background Aura Glowing Effects */}
      <div className="ai-glow-bg w-[500px] h-[500px] top-[-10%] left-[-10%]"></div>
      <div className="ai-glow-bg w-[600px] h-[600px] bottom-[-10%] right-[-10%]" style={{ animationDelay: "-3s" }}></div>

      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full glass-card border-x-0 border-t-0 border-white/5 bg-[#0A0A0A]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AI Job Apply Logo" className="w-8 h-8 rounded-lg object-contain shadow-lg shadow-indigo-500/20" />
            <span className="font-bold text-lg tracking-wider text-white">AI Job Apply</span>
          </div>
          
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
            {isAuthenticated ? (
              <Link to="/dashboard" className="bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-indigo-500 transition-all duration-300">
                Dashboard
              </Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-semibold hover:text-white transition-colors">
                  Sign In
                </Link>
                <Link to="/register" className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-indigo-500 hover:text-white transition-all duration-300">
                  Register
                </Link>
              </>
            )}
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
          {isAuthenticated ? (
            <Link to="/dashboard" className="glow-btn px-8 py-3.5 rounded-full font-bold flex items-center gap-2 w-full sm:w-auto justify-center text-sm">
              Go to Dashboard <ArrowRight size={16} />
            </Link>
          ) : (
            <Link to="/register" className="glow-btn px-8 py-3.5 rounded-full font-bold flex items-center gap-2 w-full sm:w-auto justify-center text-sm">
              Get Started Now <ArrowRight size={16} />
            </Link>
          )}
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

      {/* Chrome Extension Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 border-t border-white/5 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 font-semibold text-xs">
              <Chrome size={12} /> Chrome Browser Extension
            </div>
            
            <h2 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">
              Apply Instantly Right From <br />
              <span className="glow-text">Your Web Browser</span>
            </h2>
            
            <p className="text-[#908fa0] text-sm leading-relaxed max-w-xl">
              Don't copy-paste your details anymore. Our Chrome Extension seamlessly integrates with your active profile. It auto-fills lengthy forms on Workday, Greenhouse, Lever, and LinkedIn with tailored answers generated by our Cerebras AI model.
            </p>

            <div className="space-y-3">
              {[
                "Instant form detection on top Applicant Tracking Systems (ATS)",
                "One-click auto-fill for personal details, work history, and custom questions",
                "Dynamic keyword insertion to bypass automated ATS filters",
                "100% secure, keeping your credentials and personal data local and private"
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle size={10} className="text-indigo-400" />
                  </div>
                  <span className="text-xs text-[#b8bac7]">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-4">
              <a 
                href="https://chromewebstore.google.com/detail/iabebcgkdahlmlhbegjdikpllcedligo" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="glow-btn px-8 py-3.5 rounded-full font-bold flex items-center justify-center gap-2 text-sm sm:w-auto hover:scale-[1.02] active:scale-[0.98] transition-transform duration-200"
              >
                <Chrome size={16} /> Add to Chrome (Free)
              </a>
              <div className="text-left">
                <div className="text-xs text-white font-semibold">Chrome Web Store</div>
                <div className="text-[10px] text-[#908fa0] mt-0.5">ID: iabebcgkdahlmlhbegjdikpllcedligo</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 flex justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 via-purple-500/5 to-transparent rounded-3xl filter blur-xl"></div>
            
            {/* The Extension UI Mockup */}
            <div className="relative glass-card bg-black/40 border-white/10 p-5 rounded-[24px] w-full max-w-[340px] shadow-2xl transition-all duration-500 hover:translate-y-[-4px] hover:border-indigo-500/30">
              <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="AI Job Apply" className="w-6 h-6 rounded-lg object-contain shadow-md shadow-indigo-500/20" />
                  <span className="font-bold text-xs tracking-wider text-white">AI Job Apply</span>
                </div>
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>

              <div className="space-y-4">
                <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 space-y-1">
                  <div className="text-[9px] text-indigo-400 font-extrabold tracking-widest uppercase">Job Board Detected</div>
                  <div className="font-bold text-sm text-white">Senior Software Engineer</div>
                  <div className="text-[10px] text-[#908fa0] flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00B074]"></span> Greenhouse Application
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full bg-indigo-600/90 border border-indigo-500/30 p-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/20">
                    <Sparkles size={13} className="text-indigo-200 animate-pulse" />
                    Auto-Fill Application
                  </div>
                  <div className="w-full bg-white/5 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer hover:bg-white/10 transition-colors">
                    Tailor Resume with AI
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 space-y-2">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-[#908fa0]">Selected Profile:</span>
                    <span className="text-white font-medium">Software Engineer v2</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-[#908fa0]">Autofill Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1 h-1 rounded-full bg-emerald-400"></span> Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Inspiration & Need Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 font-semibold text-xs mb-4">
              Our Inspiration
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6 leading-tight font-sans">
              Why We Built AI Job Apply
            </h2>
            <p className="text-[#908fa0] text-sm leading-relaxed mb-6">
              Let's face it: the modern job application process is broken. Job seekers spend hours copy-pasting the exact same information from their resumes into endless, repetitive web forms. Instead of spending time preparing for interviews or honing skills, candidate energy is drained by the sheer volume of mindless data entry.
            </p>
            <p className="text-[#908fa0] text-sm leading-relaxed">
              We believed there had to be a better way. By combining state-of-the-art AI parsing with a secure browser extension architecture, we created AI Job Apply. It automates the mechanical form-filling process while ensuring every single application is tailored with custom cover letters and resumes suited for that exact role.
            </p>
          </div>
          <div className="glass-card p-8 rounded-3xl border-white/5 bg-gradient-to-br from-indigo-500/5 to-transparent">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl"></div>
            <h3 className="text-lg font-bold text-white mb-4">The Job Hunter's Dilemma</h3>
            <div className="space-y-4">
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0 text-xs font-bold">1</div>
                <div>
                  <h4 className="text-white font-semibold text-xs">Mindless Repetitive Forms</h4>
                  <p className="text-[11px] text-[#908fa0] mt-0.5">Filling Workday, Greenhouse, and Lever forms over and over again.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-rose-500/15 flex items-center justify-center text-rose-400 shrink-0 text-xs font-bold">2</div>
                <div>
                  <h4 className="text-white font-semibold text-xs">Generic CVs Fail ATS</h4>
                  <p className="text-[11px] text-[#908fa0] mt-0.5">Submitting standard resumes that lack tailored keywords for specific jobs.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-6 h-6 rounded-full bg-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0 text-xs font-bold">✓</div>
                <div>
                  <h4 className="text-white font-semibold text-xs">The Solution: Autonomous Applying</h4>
                  <p className="text-[11px] text-[#908fa0] mt-0.5">Let AI adapt your profile dynamically in seconds and submit seamlessly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Kanban Style Job Board Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/30 px-3 py-1 rounded-full text-violet-400 font-semibold text-xs mb-4">
            Unified Pipeline
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Visual Kanban Job Tracker</h2>
          <p className="text-sm text-[#908fa0]">
            Say goodbye to messy spreadsheets. Track every single automatically submitted job through a smart Kanban pipeline that reflects your progress in real-time.
          </p>
        </div>

        {/* Mock Kanban Board Layout */}
        <div className="glass-card p-6 rounded-3xl border-white/5 bg-black/30 overflow-hidden">
          <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar select-none">
            {/* Column 1: Applied */}
            <div className="flex-1 min-w-[250px] bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Applied
                </span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-[#908fa0]">2</span>
              </div>
              
              {/* Card 1 */}
              <div className="glass-card bg-white/5 border-white/5 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-[#908fa0] font-semibold font-sans">Google</span>
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded border border-indigo-500/30">AI OPTIMIZED</span>
                </div>
                <h4 className="text-xs font-bold text-white">Senior Frontend Dev</h4>
                <div className="flex items-center justify-between text-[10px] text-[#908fa0] mt-2 pt-2 border-t border-white/5">
                  <span>Applied Oct 24</span>
                  <span className="text-white font-medium">$160k - $190k</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="glass-card bg-white/5 border-white/5 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-[#908fa0] font-semibold font-sans">Airbnb</span>
                  <span className="text-[9px] bg-violet-500/20 text-violet-300 font-bold px-1.5 py-0.5 rounded border border-violet-500/30">TAILORED</span>
                </div>
                <h4 className="text-xs font-bold text-white">Design Systems Lead</h4>
                <div className="flex items-center justify-between text-[10px] text-[#908fa0] mt-2 pt-2 border-t border-white/5">
                  <span>Applied Oct 20</span>
                  <span className="text-white font-medium">$180k - $220k</span>
                </div>
              </div>
            </div>

            {/* Column 2: In Progress */}
            <div className="flex-1 min-w-[250px] bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span> In Progress
                </span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-[#908fa0]">1</span>
              </div>
              
              {/* Card 1 */}
              <div className="glass-card bg-white/5 border-white/5 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-[#908fa0] font-semibold font-sans">OpenAI</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">SUBMITTING</span>
                </div>
                <h4 className="text-xs font-bold text-white">Product Lead</h4>
                <div className="flex items-center justify-between text-[10px] text-[#908fa0] mt-2 pt-2 border-t border-white/5">
                  <span>Syncing CV...</span>
                  <span className="text-white font-medium">$300k - $380k</span>
                </div>
              </div>
            </div>

            {/* Column 3: Interviews */}
            <div className="flex-1 min-w-[250px] bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400"></span> Interviews
                </span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-[#908fa0]">1</span>
              </div>
              
              {/* Card 1 */}
              <div className="glass-card bg-indigo-500/5 border-indigo-500/20 p-4 rounded-xl flex flex-col gap-2 relative overflow-hidden">
                <div className="absolute inset-0 border border-indigo-500/10 animate-pulse rounded-xl"></div>
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-indigo-400 font-bold font-sans">Apple</span>
                  <span className="text-[9px] bg-rose-500/20 text-rose-300 font-bold px-1.5 py-0.5 rounded border border-rose-500/30">LIVE ROUND</span>
                </div>
                <h4 className="text-xs font-bold text-white">Creative Director</h4>
                <div className="bg-white/5 p-2 rounded border border-white/5 text-[10px] text-[#908fa0] mt-1 font-sans">
                  📅 Tomorrow, 10:00 AM
                </div>
                <div className="flex items-center justify-between text-[10px] text-[#908fa0] mt-2 pt-2 border-t border-white/5">
                  <span>First Round</span>
                  <span className="text-white font-medium">$250k - $300k</span>
                </div>
              </div>
            </div>

            {/* Column 4: Offer */}
            <div className="flex-1 min-w-[250px] bg-white/[0.01] border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-white tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Offer
                </span>
                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-[#908fa0]">1</span>
              </div>
              
              {/* Card 1 */}
              <div className="glass-card bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/30 p-4 rounded-xl flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] text-[#908fa0] font-semibold font-sans">Stripe</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">CONGRATS!</span>
                </div>
                <h4 className="text-xs font-bold text-white">Principal Designer</h4>
                <div className="space-y-1 mt-1 text-[10px]">
                  <div className="flex justify-between text-[#908fa0]">
                    <span>Base Salary</span>
                    <span className="text-white font-bold">$210,000</span>
                  </div>
                  <div className="flex justify-between text-[#908fa0]">
                    <span>Equity</span>
                    <span className="text-white font-bold">$450k (4yr)</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Supported Connectors Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 font-semibold text-xs mb-4">
            Direct Platform Sync
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Supported Connectors</h2>
          <p className="text-sm text-[#908fa0]">
            AI Job Apply integrates seamlessly with major job boards and applicant tracking systems. Add credentials and toggle automation on any connector.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[
            { name: "LinkedIn", desc: "Global Professional Network", icon: Linkedin, color: "text-[#0A66C2] bg-[#0A66C2]/10" },
            { name: "Indeed", desc: "Comprehensive Job Board", icon: Search, color: "text-[#2164F3] bg-[#2164F3]/10" },
            { name: "Glassdoor", desc: "Company Reviews & Jobs", icon: Building2, color: "text-[#0CAA41] bg-[#0CAA41]/10" },
            { name: "ZipRecruiter", desc: "Direct Recruiter Link", icon: Briefcase, color: "text-[#00A7E1] bg-[#00A7E1]/10" },
            { name: "Greenhouse", desc: "Corporate Portal System", icon: Sprout, color: "text-[#00B074] bg-[#00B074]/10" },
            { name: "Canada Job Bank", desc: "Federal & Regional Roles", icon: Landmark, color: "text-rose-400 bg-rose-400/10" },
            { name: "CareerBeacon", desc: "Regional Tech Listings", icon: Radio, color: "text-cyan-400 bg-cyan-400/10" },
            { name: "Randstad", desc: "Global Staffing Agency", icon: Users2, color: "text-amber-400 bg-amber-400/10" },
            { name: "VanHack", desc: "Global Relocation Opportunities", icon: Plane, color: "text-indigo-400 bg-indigo-400/10" },
            { name: "More Coming", desc: "Custom Platform API", icon: Cpu, color: "text-purple-400 bg-purple-400/10" },
          ].map((connector, i) => {
            const IconComponent = connector.icon;
            return (
              <div key={i} className="glass-card p-5 rounded-2xl flex flex-col gap-3 hover:translate-y-[-2px] transition-transform duration-300">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${connector.color} border border-white/5`}>
                  <IconComponent size={20} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{connector.name}</h4>
                  <p className="text-[10px] text-[#908fa0] mt-1 leading-relaxed">{connector.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Open Architecture & Contribute Section */}
      <section className="max-w-5xl mx-auto px-6 py-20 relative z-10 border-t border-white/5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="glass-card rounded-3xl p-8 border-white/5 bg-black/40 font-mono text-[11px] text-indigo-300 leading-relaxed shadow-lg">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4 text-[#908fa0]">
              <div className="flex gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/50"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/50"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/50"></span>
              </div>
              <span>connectors/linkedin/index.js</span>
            </div>
            <p className="text-[#908fa0]">// Add a new platform connector in JavaScript</p>
            <p><span className="text-[#8B5CF6]">async function</span> <span className="text-[#6366F1]">applyToJob</span>(page, jobData) {"{"}</p>
            <p className="pl-4">await page.goto(jobData.url);</p>
            <p className="pl-4">// Automate text inputs with AI solver</p>
            <p className="pl-4">await autofillFields(page, jobData.profile);</p>
            <p className="pl-4">await page.click(<span className="text-[#d0bcff]">"button[type='submit']"</span>);</p>
            <p>{"}"}</p>
            <p className="mt-4 text-[#908fa0]">// Export connector hooks</p>
            <p><span className="text-[#8B5CF6]">module.exports</span> = {"{"} applyToJob {"}"};</p>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full text-indigo-400 font-semibold text-xs mb-4">
              Open Source Architecture
            </div>
            <h2 className="text-3xl font-bold text-white mb-6 leading-tight">
              Open Architecture First
            </h2>
            <p className="text-[#908fa0] text-sm leading-relaxed mb-6">
              AI Job Apply is designed with a decentralized, open architecture. The browser extension coordinates directly with the local/cloud backend, making it incredibly secure and extensible. 
            </p>
            <p className="text-[#908fa0] text-sm leading-relaxed mb-8">
              We welcome and actively encourage community developer contributions! You can build custom connectors for new job boards under the <code>browser-extension/connectors</code> directory by writing clean browser automation scripts.
            </p>
            
            <a 
              href="https://github.com/vishwakarma09/job-apply-ai" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="glow-btn px-6 py-3 rounded-full font-bold inline-flex items-center gap-2 text-xs"
            >
              <Github size={16} /> Contribute on GitHub
            </a>
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
          {isAuthenticated ? (
            <Link to="/dashboard" className="bg-white text-black px-10 py-3.5 rounded-full font-bold hover:bg-indigo-500 hover:text-white transition-all duration-300 inline-block text-sm">
              Go to Dashboard
            </Link>
          ) : (
            <Link to="/register" className="bg-white text-black px-10 py-3.5 rounded-full font-bold hover:bg-indigo-500 hover:text-white transition-all duration-300 inline-block text-sm">
              Get Started
            </Link>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 text-center text-xs text-[#908fa0] bg-[#0A0A0A]/50">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 AI Job Apply. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/support" className="hover:text-white transition-colors">Support & FAQs</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <a 
              href="https://github.com/vishwakarma09/job-apply-ai" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
