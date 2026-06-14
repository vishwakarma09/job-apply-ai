import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { jobsAPI } from "../services/api";
import { Kanban, Search, Sparkles, Filter, ChevronRight, Plus } from "lucide-react";

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
    { id: "applied", name: "Applied", color: "border-indigo-500/20" },
    { id: "in-progress", name: "In Progress", color: "border-sky-500/20" },
    { id: "first round", name: "First Round", color: "border-purple-500/20" },
    { id: "second round", name: "Second Round", color: "border-fuchsia-500/20" },
    { id: "offer letter received", name: "Offer", color: "border-emerald-500/20" }
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
                <span className="text-xs font-bold text-white uppercase tracking-wider">{col.name}</span>
                <span className="text-[10px] bg-white/5 border border-white/10 text-indigo-300 px-2 py-0.5 rounded-full font-bold">
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
