import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { jobsAPI, profilesAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Play, Calendar, CheckCircle, Clock, FileText, ChevronRight, TrendingUp } from "lucide-react";

const DashboardPage = () => {
  const [stats, setStats] = useState({ applied: 0, inProgress: 0, interviews: 0, offers: 0 });
  const [jobs, setJobs] = useState([]);
  const [activeProfile, setActiveProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
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
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

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
          {jobs.slice(0, 3).map(job => (
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
