import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { jobsAPI } from "../services/api";
import { Kanban, Search, Sparkles, Filter, ChevronRight, Plus, AlertTriangle, XCircle } from "lucide-react";

const JobsKanbanPage = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    try {
      const data = await jobsAPI.getAll();
      setJobs(data);
    } catch (err) {
      console.error("Failed to load applied jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const columns = [
    { 
      id: "needs-knowledge-graph", 
      name: "Needs Info", 
      color: "border-amber-500/20",
      dotColor: "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]", 
      badgeColor: "text-amber-300 border-amber-500/20 bg-amber-500/10"
    },
    { 
      id: "applied", 
      name: "Applied", 
      color: "border-indigo-500/20",
      dotColor: "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]", 
      badgeColor: "text-indigo-300 border-indigo-500/20 bg-indigo-500/10"
    },
    { 
      id: "in-progress", 
      name: "In Progress", 
      color: "border-sky-500/20",
      dotColor: "bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.5)]", 
      badgeColor: "text-sky-300 border-sky-500/20 bg-sky-500/10"
    },
    { 
      id: "first round", 
      name: "First Round", 
      color: "border-purple-500/20",
      dotColor: "bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]", 
      badgeColor: "text-purple-300 border-purple-500/20 bg-purple-500/10"
    },
    { 
      id: "second round", 
      name: "Second Round", 
      color: "border-fuchsia-500/20",
      dotColor: "bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)]", 
      badgeColor: "text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/10"
    },
    { 
      id: "offer letter received", 
      name: "Offer", 
      color: "border-emerald-500/20",
      dotColor: "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]", 
      badgeColor: "text-emerald-300 border-emerald-500/20 bg-emerald-500/10"
    },
    { 
      id: "rejected", 
      name: "Rejected", 
      color: "border-rose-500/20",
      dotColor: "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]", 
      badgeColor: "text-rose-300 border-rose-500/20 bg-rose-500/10"
    }
  ];

  const filteredJobs = jobs.filter(j => 
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    j.company_name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white">Application Tracker</h1>
          <p className="text-sm text-[#908fa0] mt-1">Monitor and status-track active job applications</p>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-3 text-[#908fa0]">
            <Search size={16} />
          </span>
          <input 
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or company..."
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 pl-11 pr-4 text-xs text-white focus:outline-none focus:border-indigo-500"
          />
        </div>
        <button className="glass-card p-3 rounded-xl border border-white/10 text-[#908fa0] hover:text-white transition-colors">
          <Filter size={16} />
        </button>
      </div>

      {/* Kanban Board Container */}
      <div className="flex gap-4 overflow-x-auto pb-4 max-w-full">
        {columns.map((col) => {
          const colJobs = filteredJobs.filter(j => j.status.toLowerCase() === col.id.toLowerCase());
          return (
            <div 
              key={col.id}
              className="flex-1 min-w-[280px] max-w-[320px] bg-black/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-4"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dotColor}`}></span>
                  <span className="text-xs font-bold text-white uppercase tracking-wider">{col.name}</span>
                </div>
                <span className={`text-[10px] border px-2 py-0.5 rounded-full font-bold ${col.badgeColor}`}>
                  {colJobs.length}
                </span>
              </div>

              {/* Column Cards */}
              <div className="flex flex-col gap-3 overflow-y-auto max-h-[60vh] pr-1">
                {colJobs.map((job) => (
                  <Link 
                    key={job.id}
                    to={`/jobs/${job.id}`}
                    className={`glass-card p-4 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-all flex flex-col gap-2 relative group`}
                  >
                    <div className="flex justify-between items-start">
                      <h4 className="text-xs font-bold text-white group-hover:text-indigo-400 transition-colors line-clamp-1">
                        {job.title}
                      </h4>
                      <ChevronRight size={14} className="text-[#908fa0] group-hover:translate-x-0.5 transition-transform" />
                    </div>
                    
                    <p className="text-[10px] text-[#908fa0]">{job.company_name}</p>
                    
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/5 text-[9px] text-[#908fa0]">
                      <span>{job.salary || "N/A"}</span>
                      <span>{job.applied_date}</span>
                    </div>

                    {/* AI Tag */}
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[8px] uppercase tracking-wider font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Sparkles size={8} /> Resume Tailored
                      </span>
                      {job.status.toLowerCase() === "needs-knowledge-graph" && (
                        <span className="text-[8px] uppercase tracking-wider font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertTriangle size={8} /> Needs Info
                        </span>
                      )}
                      {job.status.toLowerCase() === "rejected" && (
                        <span className="text-[8px] uppercase tracking-wider font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <XCircle size={8} /> Rejected
                        </span>
                      )}
                    </div>
                  </Link>
                ))}

                {colJobs.length === 0 && (
                  <div className="text-center py-10 text-[10px] text-[#908fa0] border border-dashed border-white/5 rounded-xl">
                    No jobs here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default JobsKanbanPage;
