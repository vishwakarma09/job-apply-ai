import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { jobsAPI, profilesAPI, conversationsAPI } from "../services/api";
import { Sparkles, ArrowLeft, Building2, MapPin, DollarSign, ExternalLink, Calendar, MessageSquare, Send } from "lucide-react";

const JobDetailPage = () => {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [coverLetter, setCoverLetter] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [msgSender, setMsgSender] = useState("Recruiter");
  const [loading, setLoading] = useState(true);
  const [tailoring, setTailoring] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchData = async () => {
    try {
      const jobData = await jobsAPI.getDetail(id);
      setJob(jobData);
      if (jobData.cover_letter) {
        setCoverLetter(jobData.cover_letter);
      }
      
      const convos = await conversationsAPI.getList(id);
      setConversations(convos);

      const profilesData = await profilesAPI.getAll();
      setProfiles(profilesData);
      
      const active = profilesData.find(p => p.is_active);
      if (active) {
        setSelectedProfileId(active.id);
      }
    } catch (err) {
      console.error("Failed to load job details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleTailor = async () => {
    if (!jobDescription || !selectedProfileId) {
      alert("Please provide the job description and select a profile.");
      return;
    }
    setTailoring(true);
    try {
      const cl = await jobsAPI.tailorApplication(id, parseInt(selectedProfileId), jobDescription);
      setCoverLetter(cl);
      alert("Cover letter tailored successfully!");
    } catch (err) {
      alert("Failed to tailor cover letter");
    } finally {
      setTailoring(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await jobsAPI.update(id, { status: newStatus });
      await fetchData();
    } catch (err) {
      alert("Failed to update status");
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg) return;
    try {
      await conversationsAPI.add(id, {
        sender: msgSender,
        message_text: newMsg,
        platform: "email"
      });
      setNewMsg("");
      await fetchData();
    } catch (err) {
      alert("Failed to add message to timeline");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-20 text-[#908fa0]">
        Job application not found. <Link to="/jobs" className="text-indigo-400">Go back</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Back button */}
      <div>
        <Link to="/jobs" className="flex items-center gap-1 text-xs text-[#908fa0] hover:text-white transition-colors">
          <ArrowLeft size={14} /> Back to Tracker
        </Link>
      </div>

      {/* Header card */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col md:flex-row justify-between md:items-center gap-6">
        <div>
          <h1 className="text-2xl font-black text-white">{job.title}</h1>
          <div className="flex items-center gap-4 text-xs text-[#908fa0] mt-2 flex-wrap">
            <span className="flex items-center gap-1"><Building2 size={14} /> {job.company_name}</span>
            {job.location && <span className="flex items-center gap-1"><MapPin size={14} /> {job.location}</span>}
            {job.salary && <span className="flex items-center gap-1"><DollarSign size={14} /> {job.salary}</span>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 min-w-[150px]">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Application Status</label>
          <select
            value={job.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            disabled={statusUpdating}
            className="bg-black/60 border border-white/10 rounded-xl py-2 px-3 text-xs text-indigo-300 focus:outline-none focus:border-indigo-500 font-bold cursor-pointer"
          >
            <option value="applied">Applied</option>
            <option value="in-progress">In Progress</option>
            <option value="first round">First Round</option>
            <option value="second round">Second Round</option>
            <option value="offer letter received">Offer Received</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Main Grid: Tailoring & Conversations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left columns: AI Tailor area */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Sparkles size={18} className="text-indigo-400" /> AI Application Tailoring
            </h3>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Select Job Profile</label>
                <select 
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl py-2 px-3 text-xs text-white"
                >
                  <option value="">Select profile</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Job Description</label>
                <textarea 
                  rows={4}
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job requirements or posting description here..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs text-[#e0e3e5] focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button 
                onClick={handleTailor}
                disabled={tailoring}
                className="glow-btn py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2"
              >
                <Sparkles size={14} />
                {tailoring ? "Regenerating..." : "Tailor Cover Letter"}
              </button>
            </div>
          </div>

          {/* Generated Cover Letter output */}
          {coverLetter && (
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white">Tailored Cover Letter</h3>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(coverLetter.content);
                    alert("Cover letter copied to clipboard!");
                  }}
                  className="text-xs text-indigo-400 hover:text-white"
                >
                  Copy Text
                </button>
              </div>
              <div className="bg-black/60 border border-white/5 rounded-xl p-5 text-xs font-mono text-[#e0e3e5] whitespace-pre-line leading-relaxed max-h-96 overflow-y-auto">
                {coverLetter.content}
              </div>
            </div>
          )}
        </div>

        {/* Right column: Timeline conversations */}
        <div className="md:col-span-1 glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
          <h3 className="text-base font-bold text-white flex items-center gap-1.5">
            <MessageSquare size={18} className="text-indigo-400" /> Recruiter Conversations
          </h3>
          
          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[300px] pr-1">
            {conversations.map(c => (
              <div 
                key={c.id} 
                className={`p-3 rounded-xl border max-w-[85%] text-xs flex flex-col gap-1 ${
                  c.sender === "Candidate" 
                    ? "self-end bg-indigo-500/10 border-indigo-500/20 text-indigo-300"
                    : "self-start bg-white/5 border-white/10 text-[#e0e3e5]"
                }`}
              >
                <div className="flex justify-between items-center text-[9px] opacity-65 font-bold uppercase tracking-wider">
                  <span>{c.sender}</span>
                </div>
                <p className="leading-relaxed mt-0.5">{c.message_text}</p>
              </div>
            ))}
            
            {conversations.length === 0 && (
              <div className="text-center py-12 text-[10px] text-[#908fa0]">
                No logged communications. Add an email or message log below.
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="pt-4 border-t border-white/5 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">Sender</label>
              <div className="flex items-center gap-2">
                <button 
                  type="button"
                  onClick={() => setMsgSender("Recruiter")}
                  className={`text-[9px] uppercase px-2 py-0.5 rounded border ${
                    msgSender === "Recruiter" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-white/5 text-[#908fa0]"
                  }`}
                >
                  Recruiter
                </button>
                <button 
                  type="button"
                  onClick={() => setMsgSender("Candidate")}
                  className={`text-[9px] uppercase px-2 py-0.5 rounded border ${
                    msgSender === "Candidate" ? "border-indigo-500 text-indigo-300 bg-indigo-500/10" : "border-white/5 text-[#908fa0]"
                  }`}
                >
                  Candidate
                </button>
              </div>
            </div>

            <div className="relative">
              <input 
                type="text"
                required
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Log email or message content..."
                className="w-full bg-black/40 border border-white/10 rounded-xl py-2 pl-4 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
              <button 
                type="submit"
                className="absolute right-2.5 top-1.5 text-indigo-400 hover:text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default JobDetailPage;
