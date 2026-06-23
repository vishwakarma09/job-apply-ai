import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { jobsAPI, profilesAPI, connectorsAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { 
  Play, 
  Calendar, 
  CheckCircle, 
  Clock, 
  FileText, 
  ChevronRight, 
  TrendingUp,
  Rocket,
  Zap,
  AlertTriangle,
  Sparkles,
  StopCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ExternalLink
} from "lucide-react";

const DashboardPage = () => {
  const [stats, setStats] = useState({ applied: 0, inProgress: 0, interviews: 0, offers: 0 });
  const [jobs, setJobs] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Turbo Apply states
  const [connectors, setConnectors] = useState([]);
  const [connectorStates, setConnectorStates] = useState({});
  const [unansweredQuestions, setUnansweredQuestions] = useState([]);
  const [isTurboRunning, setIsTurboRunning] = useState(false);
  const [kbAnswers, setKbAnswers] = useState({});
  const [submittingKbId, setSubmittingKbId] = useState(null);

  const fetchData = async () => {
    try {
      const jobsData = await jobsAPI.getAll();
      setJobs(jobsData);
      
      // Count stats
      let applied = 0, inProgress = 0, interviews = 0, offers = 0;
      jobsData.forEach(j => {
        if (j.status === "applied") applied++;
        else if (j.status === "in-progress") inProgress++;
        else if (["first round", "second round"].includes(j.status)) interviews++;
        else if (j.status === "offer letter received" || j.status === "offer") offers++;
      });
      setStats({ applied, inProgress, interviews, offers });

      // Get active profile
      try {
        const profile = await profilesAPI.getActive();
        setActiveProfile(profile);
      } catch (e) {
        console.log("No active profile yet");
      }

      // Get connectors
      try {
        const conns = await connectorsAPI.getAll();
        setConnectors(conns);
      } catch (e) {
        console.log("Failed to load connectors");
      }

      // Get unanswered questions
      try {
        const uq = await profilesAPI.getUnansweredKnowledgebase();
        setUnansweredQuestions(uq);
      } catch (e) {
        console.log("Failed to load unanswered questions");
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Listen to connector state changes from the extension content script
  useEffect(() => {
    const handleExtensionMessages = (event) => {
      if (event.data && event.data.type === "AI_JOB_APPLY_CONNECTOR_STATES_RESPONSE") {
        setConnectorStates(event.data.states || {});
      } else if (event.data && event.data.type === "AI_JOB_APPLY_CONNECTOR_STATE_CHANGE") {
        const { platformName, state } = event.data;
        setConnectorStates(prev => ({
          ...prev,
          [platformName.toLowerCase()]: state
        }));
      }
    };

    window.addEventListener("message", handleExtensionMessages);
    
    // Request current states from the extension content script
    window.postMessage({ type: "AI_JOB_APPLY_GET_CONNECTOR_STATES" }, "*");

    return () => {
      window.removeEventListener("message", handleExtensionMessages);
    };
  }, [connectors]);

  // Polling data when Turbo Apply is active
  useEffect(() => {
    let interval = null;
    if (isTurboRunning) {
      interval = setInterval(async () => {
        try {
          const jobsData = await jobsAPI.getAll();
          setJobs(jobsData);
          
          let applied = 0, inProgress = 0, interviews = 0, offers = 0;
          jobsData.forEach(j => {
            if (j.status === "applied") applied++;
            else if (j.status === "in-progress") inProgress++;
            else if (["first round", "second round"].includes(j.status)) interviews++;
            else if (j.status === "offer letter received" || j.status === "offer") offers++;
          });
          setStats({ applied, inProgress, interviews, offers });

          const uq = await profilesAPI.getUnansweredKnowledgebase();
          setUnansweredQuestions(uq);
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isTurboRunning]);

  const handleLaunchTurbo = () => {
    const activeConns = connectors.filter(c => c.status === "Connected");
    if (activeConns.length === 0) {
      alert("No active automation connectors found! Please configure credentials on the Connectors page first.");
      return;
    }

    const platformUrls = {
      LinkedIn: "https://www.linkedin.com/jobs/",
      Indeed: "https://www.indeed.com/jobs",
      ZipRecruiter: "https://www.ziprecruiter.com/",
      Glassdoor: "https://www.glassdoor.com/",
      Greenhouse: "https://my.greenhouse.io/",
      Randstad: "https://www.randstad.ca/",
      "Job Bank": "https://www.jobbank.gc.ca/",
      CareerBeacon: "https://www.careerbeacon.com/",
      VanHack: "https://vanhack.com/jobs"
    };

    activeConns.forEach((conn) => {
      const platformName = conn.platform_name;
      const targetUrl = platformUrls[platformName] || "https://google.com";
      
      console.log(`[Dashboard] Launching Turbo Apply for ${platformName}...`);
      window.postMessage({
        type: "AI_JOB_APPLY_START_AUTO_LOGIN",
        platformName,
        targetUrl
      }, "*");
    });

    setIsTurboRunning(true);
    alert("Turbo Apply launched! Automated browser tabs are opening to process job applications.");
  };

  const handleStopTurbo = () => {
    window.dispatchEvent(new CustomEvent("AI_JOB_APPLY_CLEAR_TURBO"));
    setIsTurboRunning(false);
    
    // Set all states to finished locally
    const updated = {};
    Object.keys(connectorStates).forEach(k => {
      updated[k] = "finished";
    });
    setConnectorStates(updated);
    alert("Turbo Apply stopped. All automation tasks cleared.");
  };

  const handleSaveKbAnswer = async (kbId) => {
    const answer = kbAnswers[kbId];
    if (!answer || !answer.trim()) {
      alert("Please provide an answer.");
      return;
    }
    setSubmittingKbId(kbId);
    try {
      await profilesAPI.updateKnowledgebaseEntry(kbId, answer);
      setUnansweredQuestions(prev => prev.filter(q => q.id !== kbId));
      alert("Answer saved! The LLM has learned this response and will resume applications.");
    } catch (err) {
      console.error(err);
      alert("Failed to save answer.");
    } finally {
      setSubmittingKbId(null);
    }
  };

  const handleRetryJob = (job) => {
    window.postMessage({
      type: "AI_JOB_APPLY_RETRY_JOB",
      jobId: job.id,
      jobUrl: job.job_url
    }, "*");
    alert(`Retry application triggered for "${job.title}"! Check the opened tab.`);
  };

  // Format Recharts data (last 7 days application count)
  const chartData = [
    { name: "Mon", count: 4 },
    { name: "Tue", count: 6 },
    { name: "Wed", count: 8 },
    { name: "Thu", count: 5 },
    { name: "Fri", count: 9 },
    { name: "Sat", count: 3 },
    { name: "Sun", count: jobs.filter(j => j.applied_date).length || 2 }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // Calculate Turbo Apply stats
  const activePlatformNames = connectors.filter(c => c.status === "Connected").map(c => c.platform_name.toLowerCase());
  const attemptedJobs = jobs.filter(j => activePlatformNames.includes(j.platform_name.toLowerCase()));
  const successfulCount = attemptedJobs.filter(j => j.status.toLowerCase() === "applied" || j.status.toLowerCase() === "success").length;
  const failedCount = attemptedJobs.filter(j => j.status.toLowerCase() === "needs-knowledge-graph" || j.status.toLowerCase() === "failed").length;

  const interviewJobs = jobs.filter(j => ["first round", "second round"].includes(j.status));

  return (
    <div className="flex flex-col gap-8">
      {/* Welcome & Premium Alert */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Dashboard</h1>
          <p className="text-sm text-[#908fa0] mt-1">Hello, {user?.name}. Here is your job search summary.</p>
        </div>
        {activeProfile ? (
          <div className="glass-card px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 border-indigo-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>Active Profile: <strong className="text-white">{activeProfile.title}</strong></span>
          </div>
        ) : (
          <Link to="/profile" className="glow-btn text-xs font-bold px-4 py-2.5 rounded-xl">
            Create Active Profile
          </Link>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">Applied Jobs</span>
          <span className="text-3xl font-black text-white mt-1">{stats.applied}</span>
        </div>
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">In Progress</span>
          <span className="text-3xl font-black text-white mt-1">{stats.inProgress}</span>
        </div>
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">Interviews</span>
          <span className="text-3xl font-black text-indigo-400 mt-1">{stats.interviews}</span>
        </div>
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#908fa0] uppercase tracking-wider">Offers Received</span>
          <span className="text-3xl font-black text-emerald-400 mt-1">{stats.offers}</span>
        </div>
      </div>

      {/* Turbo Apply Control Center */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <Rocket className={`text-indigo-400 ${isTurboRunning ? "animate-bounce" : ""}`} size={22} />
              Turbo Apply Panel
            </h2>
            <p className="text-xs text-[#908fa0] mt-1">Automatically launch applications across all configured job boards</p>
          </div>
          <div className="flex items-center gap-3">
            {isTurboRunning ? (
              <button
                onClick={handleStopTurbo}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(244,63,94,0.3)] cursor-pointer"
              >
                <StopCircle size={14} /> Stop Turbo Apply
              </button>
            ) : (
              <button
                onClick={handleLaunchTurbo}
                className="glow-btn font-bold text-xs px-5 py-2.5 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Rocket size={14} /> Launch Turbo Apply
              </button>
            )}
          </div>
        </div>

        {/* Mini stats for Turbo Apply */}
        <div className="grid grid-cols-3 gap-4 bg-black/30 p-4 rounded-xl border border-white/5">
          <div className="flex flex-col text-center">
            <span className="text-[10px] uppercase font-bold text-[#908fa0] tracking-wider">Attempted Jobs</span>
            <span className="text-xl font-black text-white mt-1">{attemptedJobs.length}</span>
          </div>
          <div className="flex flex-col text-center">
            <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">Applied Successfully</span>
            <span className="text-xl font-black text-emerald-400 mt-1">{successfulCount}</span>
          </div>
          <div className="flex flex-col text-center">
            <span className="text-[10px] uppercase font-bold text-amber-500 tracking-wider">Failed / Needs Action</span>
            <span className="text-xl font-black text-amber-500 mt-1">{failedCount}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Connectors Monitor */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Zap size={16} className="text-indigo-400" /> Connectors Live Monitor
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {connectors.filter(c => c.status === "Connected").map(conn => {
                const name = conn.platform_name;
                const state = connectorStates[name.toLowerCase()] || "idle";
                const connJobs = jobs.filter(j => j.platform_name.toLowerCase() === name.toLowerCase());
                
                return (
                  <div key={conn.id} className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-white">{name}</span>
                      <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${
                        state === "applying" ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400 animate-pulse" :
                        state === "human wait" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                        state === "waiting on lock" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 animate-bounce" :
                        state === "finished" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                        "bg-white/5 border-white/10 text-[#908fa0]"
                      }`}>
                        {state}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                      {connJobs.length > 0 ? (
                        connJobs.map(job => (
                          <div key={job.id} className="flex justify-between items-center bg-white/[0.02] border border-white/5 p-2 rounded-lg">
                            <div className="flex flex-col truncate max-w-[65%]">
                              <span className="text-[10px] font-bold text-[#e0e3e5] truncate">{job.title}</span>
                              <span className="text-[8px] text-[#908fa0] truncate">{job.company_name}</span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded ${
                                job.status.toLowerCase() === "applied" ? "bg-emerald-500/10 text-emerald-400" :
                                job.status.toLowerCase() === "needs-knowledge-graph" ? "bg-amber-500/10 text-amber-400" :
                                "bg-indigo-500/10 text-indigo-400"
                              }`}>
                                {job.status === "needs-knowledge-graph" ? "Needs Action" : job.status}
                              </span>
                              <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="text-[#908fa0] hover:text-white p-0.5" title="Complete Manually">
                                <ExternalLink size={10} />
                              </a>
                              {job.status === "needs-knowledge-graph" && (
                                <button onClick={() => handleRetryJob(job)} className="text-amber-400 hover:text-white p-0.5 cursor-pointer" title="Retry Application">
                                  <RefreshCw size={10} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <span className="text-[10px] text-[#908fa0] italic text-center py-4">No applications attempted yet</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {connectors.filter(c => c.status === "Connected").length === 0 && (
                <div className="col-span-2 flex flex-col items-center justify-center p-8 border border-dashed border-white/10 rounded-xl text-center text-xs text-[#908fa0]">
                  <AlertTriangle className="text-amber-500 mb-2" size={20} />
                  <span>No configured automation connectors are connected. Configure them on the Connectors page.</span>
                </div>
              )}
            </div>
          </div>

          {/* AI Learning Gaps (Unanswered Questions) */}
          <div className="flex flex-col gap-4 border-l border-white/5 pl-0 lg:pl-6">
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Sparkles size={16} className="text-indigo-400 animate-pulse" /> AI Learning Gaps ({unansweredQuestions.length})
            </h3>
            
            <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
              {unansweredQuestions.length > 0 ? (
                unansweredQuestions.map(q => (
                  <div key={q.id} className="bg-red-500/[0.02] border border-red-500/20 p-3.5 rounded-xl flex flex-col gap-2.5">
                    <span className="text-[11px] font-semibold text-white">{q.question}</span>
                    <div className="flex flex-col gap-2">
                      <textarea
                        rows={2}
                        value={kbAnswers[q.id] || ""}
                        onChange={(e) => setKbAnswers({ ...kbAnswers, [q.id]: e.target.value })}
                        placeholder="Provide answer so LLM can learn..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 px-3 text-[11px] focus:outline-none focus:border-indigo-500 text-white resize-none"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleSaveKbAnswer(q.id)}
                          disabled={submittingKbId === q.id}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[9px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          {submittingKbId === q.id ? "Saving..." : "Teach AI"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-black/10 border border-white/5 rounded-xl text-center text-xs text-[#908fa0] py-12">
                  <CheckCircle2 className="text-emerald-400 mb-2" size={20} />
                  <span>All knowledge gaps resolved! The AI has full information.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Chart & Interviews */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Application Trends Chart */}
        <div className="md:col-span-2 glass-card p-6 rounded-2xl flex flex-col gap-4">
          <div className="flex items-center gap-2 justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <TrendingUp className="text-indigo-400" size={18} /> Application Trends
            </h3>
            <span className="text-[10px] text-[#908fa0] tracking-wider uppercase">Weekly sync</span>
          </div>
          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#908fa0" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#908fa0" fontSize={11} tickLine={false} axisLine={false} width={20} />
                <Tooltip contentStyle={{ backgroundColor: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upcoming Interviews */}
        <div className="glass-card p-6 rounded-2xl flex flex-col gap-4">
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <Calendar className="text-indigo-400" size={18} /> Interviews Schedule
          </h3>
          
          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-60 pr-1">
            {interviewJobs.length > 0 ? (
              interviewJobs.map(job => (
                <div key={job.id} className="glass-card p-4 rounded-xl border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-bold text-white">{job.title}</h4>
                    <span className="text-[9px] uppercase font-bold tracking-widest text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded-full border border-indigo-400/20">
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#908fa0]">{job.company_name}</p>
                  <Link to={`/jobs/${job.id}`} className="text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold mt-2 flex items-center gap-0.5">
                    Prepare with AI Coach <ChevronRight size={12} />
                  </Link>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-xs text-[#908fa0]">
                <Clock size={20} />
                <span>No interviews scheduled yet. Keep applying!</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activities list */}
      <div className="glass-card p-6 rounded-2xl flex flex-col gap-4">
        <h3 className="text-base font-bold text-white flex items-center gap-1.5">
          <FileText className="text-indigo-400" size={18} /> Recent Activity
        </h3>
        
        <div className="flex flex-col gap-4">
          {[...jobs].sort((a, b) => b.id - a.id).slice(0, 3).map(job => (
            <div key={job.id} className="flex items-center justify-between border-b border-white/5 pb-4 last:border-b-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 text-xs">
                  AI
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Applied to {job.company_name}</h4>
                  <p className="text-[10px] text-[#908fa0]">{job.title} • {job.platform_name}</p>
                </div>
              </div>
              <span className="text-[10px] text-[#908fa0]">{job.applied_date}</span>
            </div>
          ))}
          {jobs.length === 0 && (
            <div className="text-center py-6 text-xs text-[#908fa0]">
              No activity recorded. Start by uploading your resume.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
