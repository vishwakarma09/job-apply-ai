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

          {/* Profile Auto-Fill Knowledge Base */}
          {profiles.find(p => p.is_active) && (() => {
            const activeProfile = profiles.find(p => p.is_active);
            // Local state inside a wrapper block to load once active profile loads
            return (
              <>
                <ProfileMetadataForm 
                  activeProfile={activeProfile} 
                  onUpdate={fetchData} 
                />
                <KnowledgeGraphQuestions />
              </>
            );
          })()}

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

// Subcomponent to handle active profile auto-fill details editing
const ProfileMetadataForm = ({ activeProfile, onUpdate }) => {
  const [phone, setPhone] = useState(activeProfile.phone || "");
  const [email, setEmail] = useState(activeProfile.email || "");
  const [nationality, setNationality] = useState(activeProfile.nationality || "");
  const [visa, setVisa] = useState(activeProfile.visa_sponsorship || "");
  const [disability, setDisability] = useState(activeProfile.disability_status || "");
  const [veteran, setVeteran] = useState(activeProfile.veteran_status || "");
  const [ethnicity, setEthnicity] = useState(activeProfile.ethnicity || "");
  const [gender, setGender] = useState(activeProfile.gender || "");
  const [languages, setLanguages] = useState(activeProfile.languages || "");
  const [skills, setSkills] = useState(activeProfile.skills || "");
  const [workAuth, setWorkAuth] = useState(activeProfile.work_authorization || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPhone(activeProfile.phone || "");
    setEmail(activeProfile.email || "");
    setNationality(activeProfile.nationality || "");
    setVisa(activeProfile.visa_sponsorship || "");
    setDisability(activeProfile.disability_status || "");
    setVeteran(activeProfile.veteran_status || "");
    setEthnicity(activeProfile.ethnicity || "");
    setGender(activeProfile.gender || "");
    setLanguages(activeProfile.languages || "");
    setSkills(activeProfile.skills || "");
    setWorkAuth(activeProfile.work_authorization || "");
  }, [activeProfile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await profilesAPI.update(activeProfile.id, {
        phone,
        email,
        nationality,
        visa_sponsorship: visa,
        disability_status: disability,
        veteran_status: veteran,
        ethnicity,
        gender,
        languages,
        skills,
        work_authorization: workAuth
      });
      alert("Auto-Fill metadata saved successfully!");
      onUpdate();
    } catch (err) {
      alert("Failed to save auto-fill settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-6">
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-1.5">
          <Edit2 size={18} className="text-indigo-400" /> Auto-Fill Persona Settings
        </h3>
        <p className="text-[10px] text-[#908fa0] mt-1">Configure automated credentials for Easy Apply forms.</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Contact Email</label>
          <input 
            type="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. kkumar.sandeep89@gmail.com"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Contact Phone</label>
          <input 
            type="text" 
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. (647) 395-0215"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Nationality</label>
          <input 
            type="text" 
            value={nationality}
            onChange={(e) => setNationality(e.target.value)}
            placeholder="e.g. Canadian"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Work Auth Country</label>
          <input 
            type="text" 
            value={workAuth}
            onChange={(e) => setWorkAuth(e.target.value)}
            placeholder="e.g. Canada, USA"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Requires Visa Sponsorship</label>
          <select 
            value={visa}
            onChange={(e) => setVisa(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          >
            <option value="">Select option</option>
            <option value="No">No (Does not require sponsorship)</option>
            <option value="Yes">Yes (Requires sponsorship)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Gender</label>
          <select 
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          >
            <option value="">Select option</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Non-Binary">Non-Binary</option>
            <option value="Decline">I choose not to self-identify</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Disability Status</label>
          <select 
            value={disability}
            onChange={(e) => setDisability(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          >
            <option value="">Select option</option>
            <option value="No">No, I do not have a disability</option>
            <option value="Yes">Yes, I have a disability</option>
            <option value="Decline">I choose not to self-identify</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Veteran Status</label>
          <select 
            value={veteran}
            onChange={(e) => setVeteran(e.target.value)}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          >
            <option value="">Select option</option>
            <option value="No">No, am not a protected veteran</option>
            <option value="Yes">Yes, am a protected veteran</option>
            <option value="Decline">I choose not to self-identify</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Ethnicity / Race</label>
          <input 
            type="text" 
            value={ethnicity}
            onChange={(e) => setEthnicity(e.target.value)}
            placeholder="e.g. South Asian, Caucasian"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Languages spoken</label>
          <input 
            type="text" 
            value={languages}
            onChange={(e) => setLanguages(e.target.value)}
            placeholder="e.g. English, Hindi"
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white"
          />
        </div>

        <div className="flex flex-col gap-1.5 md:col-span-2">
          <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Additional Skills / Technologies (for screening experience checks)</label>
          <textarea 
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="e.g. Node: 5 years, React: 3 years, FastAPI: 2 years"
            rows={3}
            className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white font-mono"
          />
        </div>

        <button 
          type="submit"
          disabled={saving}
          className="glow-btn py-2.5 rounded-xl font-bold text-xs md:col-span-2 mt-2"
        >
          {saving ? "Saving Auto-Fill details..." : "Update Auto-Fill settings"}
        </button>
      </form>
    </div>
  );
};

// Subcomponent to list and update custom RAG vector memory questions
const KnowledgeGraphQuestions = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchQuestions = async () => {
    try {
      const data = await profilesAPI.getKnowledgebase();
      setQuestions(data);
      // Initialize edit answers state
      const initialAnswers = {};
      data.forEach(q => {
        initialAnswers[q.id] = q.answer;
      });
      setAnswers(initialAnswers);
    } catch (err) {
      console.error("Failed to load knowledgebase:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleSaveAnswer = async (id) => {
    try {
      await profilesAPI.updateKnowledgebaseEntry(id, answers[id] || "");
      alert("Answer saved successfully!");
      fetchQuestions();
    } catch (err) {
      alert("Failed to save answer");
    }
  };

  if (loading) return null;

  const unanswered = questions.filter(q => q.answer === "");
  const answered = questions.filter(q => q.answer !== "");

  return (
    <div className="glass-card p-6 rounded-2xl border border-white/10 flex flex-col gap-6 mt-6">
      <div>
        <h3 className="text-base font-bold text-white flex items-center gap-1.5">
          <Edit2 size={18} className="text-indigo-400" /> Custom Knowledge Base
        </h3>
        <p className="text-[10px] text-[#908fa0] mt-1">
          Answer custom screening questions encountered during applications to update the AI's semantic memory.
        </p>
      </div>

      {unanswered.length > 0 && (
        <div className="flex flex-col gap-4">
          <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
            <AlertCircle size={14} /> Unanswered Questions ({unanswered.length})
          </h4>
          <div className="flex flex-col gap-3">
            {unanswered.map(q => (
              <div key={q.id} className="p-4 rounded-xl bg-red-500/[0.02] border border-red-500/20 flex flex-col gap-3">
                <span className="text-xs font-semibold text-white">{q.question}</span>
                <div className="flex flex-col gap-2.5">
                  <textarea
                    rows={2}
                    value={answers[q.id] || ""}
                    onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                    placeholder="Provide a detailed answer to enrich your knowledge base..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white resize-y"
                  />
                  <div className="flex justify-end">
                    <button
                      onClick={() => handleSaveAnswer(q.id)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2 rounded-xl transition-colors"
                    >
                      Save Answer
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h4 className="text-xs font-bold text-[#908fa0]">Answered Questions ({answered.length})</h4>
        <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
          {answered.map(q => (
            <div key={q.id} className="p-4 rounded-xl bg-white/5 border border-white/5 flex flex-col gap-3">
              <span className="text-xs font-semibold text-white/90">{q.question}</span>
              <div className="flex flex-col gap-2.5">
                <textarea
                  rows={2}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                  className="w-full bg-black/20 border border-white/5 rounded-lg py-2.5 px-4 text-xs focus:outline-none focus:border-indigo-500 text-white/70 resize-y"
                />
                <div className="flex justify-end">
                  <button
                    onClick={() => handleSaveAnswer(q.id)}
                    className="bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] px-4 py-1.5 rounded-lg transition-colors"
                  >
                    Update Answer
                  </button>
                </div>
              </div>
            </div>
          ))}
          {answered.length === 0 && (
            <div className="text-center py-4 text-xs text-[#908fa0]">
              No answered questions yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
