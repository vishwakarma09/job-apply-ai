import React, { useState, useEffect } from "react";
import { profilesAPI } from "../services/api";
import { Upload, Plus, FileText, ToggleLeft, ToggleRight, Trash2, Edit2, AlertCircle } from "lucide-react";

const ProfilePage = () => {
  const [resumes, setResumes] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState("");
  const [activeResumeText, setActiveResumeText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const resumesData = await profilesAPI.getResumes();
      setResumes(resumesData);
      
      const profilesData = await profilesAPI.getAll();
      setProfiles(profilesData);
      
      // Get extracted text of active profile's resume
      const active = profilesData.find(p => p.is_active);
      if (active && active.resume_id) {
        const matchingResume = resumesData.find(r => r.id === active.resume_id);
        if (matchingResume) {
          setActiveResumeText(matchingResume.extracted_text || "");
        }
      }
    } catch (err) {
      console.error("Failed to load profiles/resumes:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await profilesAPI.uploadResume(file);
      await fetchData();
    } catch (err) {
      alert("Failed to upload resume. Ensure it is a PDF or TXT file.");
    } finally {
      setUploading(false);
    }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!newTitle) return;
    
    setCreating(true);
    try {
      await profilesAPI.create({
        title: newTitle,
        is_active: profiles.length === 0, // set active if it's the first profile
        resume_id: selectedResumeId ? parseInt(selectedResumeId) : null
      });
      setNewTitle("");
      setSelectedResumeId("");
      await fetchData();
    } catch (err) {
      alert("Failed to create job profile");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (profileId) => {
    try {
      await profilesAPI.update(profileId, { is_active: true });
      await fetchData();
    } catch (err) {
      alert("Failed to toggle active profile");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-black text-white">Job Profiles</h1>
        <p className="text-sm text-[#908fa0] mt-1">Upload resumes and configure tailored personas</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* left column: upload & create */}
        <div className="md:col-span-1 flex flex-col gap-6">
          {/* Resume Upload Box */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Upload size={18} className="text-indigo-400" /> Upload Resume
            </h3>
            
            <label className="border-2 border-dashed border-white/10 hover:border-indigo-500/50 rounded-xl p-8 flex flex-col items-center gap-2 cursor-pointer transition-colors bg-black/20 text-center">
              <span className="material-symbols-outlined text-indigo-400 text-3xl mb-1">cloud_upload</span>
              <span className="text-xs font-semibold text-white">Upload PDF, DOCX, or TXT</span>
              <span className="text-[10px] text-[#908fa0]">Max size 5MB</span>
              <input 
                type="file" 
                className="hidden" 
                accept=".pdf,.txt,.docx"
                onChange={handleFileUpload} 
                disabled={uploading}
              />
            </label>
            {uploading && (
              <span className="text-xs text-indigo-400 animate-pulse text-center">Parsing resume text...</span>
            )}
          </div>

          {/* Create Profile Persona */}
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-base font-bold text-white flex items-center gap-1.5">
              <Plus size={18} className="text-indigo-400" /> New Job Profile
            </h3>
            
            <form onSubmit={handleCreateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Profile Title</label>
                <input 
                  type="text" 
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Node JS Developer"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Attach Resume</label>
                <select 
                  value={selectedResumeId}
                  onChange={(e) => setSelectedResumeId(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
                >
                  <option value="">Select an uploaded resume</option>
                  {resumes.map(r => (
                    <option key={r.id} value={r.id}>{r.filename}</option>
                  ))}
                </select>
              </div>

              <button 
                type="submit"
                disabled={creating}
                className="glow-btn py-2.5 rounded-xl font-bold text-xs"
              >
                {creating ? "Creating..." : "Create Profile"}
              </button>
            </form>
          </div>
        </div>

        {/* middle column: list profiles */}
        <div className="md:col-span-2 flex flex-col gap-6">
          <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">Active Personas</h3>
            
            <div className="flex flex-col gap-4">
              {profiles.map(p => {
                const attachedResume = resumes.find(r => r.id === p.resume_id);
                return (
                  <div 
                    key={p.id} 
                    className={`glass-card p-5 rounded-xl border flex items-center justify-between transition-all ${
                      p.is_active ? "border-indigo-500/30 bg-indigo-500/[0.02]" : "border-white/5 bg-black/20"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{p.title}</h4>
                        <p className="text-[10px] text-[#908fa0] mt-0.5">
                          Resume: {attachedResume ? attachedResume.filename : "None attached"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleToggleActive(p.id)}
                        className={`transition-colors p-1 ${p.is_active ? "text-indigo-400" : "text-[#908fa0] hover:text-white"}`}
                        title={p.is_active ? "Active Profile" : "Set Active"}
                      >
                        {p.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                      </button>
                    </div>
                  </div>
                );
              })}
              
              {profiles.length === 0 && (
                <div className="text-center py-10 text-xs text-[#908fa0]">
                  No job profiles created yet. Use the sidebar to create one.
                </div>
              )}
            </div>
          </div>

          {/* extracted resume text preview */}
          {activeResumeText && (
            <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-4">
              <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                <AlertCircle size={18} className="text-indigo-400" /> Extracted Resume Text
              </h3>
              <div className="bg-black/60 border border-white/5 rounded-xl p-5 text-xs font-mono text-[#908fa0] max-h-60 overflow-y-auto whitespace-pre-line leading-relaxed">
                {activeResumeText}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
