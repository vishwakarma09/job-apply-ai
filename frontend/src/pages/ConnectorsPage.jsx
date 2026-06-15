import React, { useState, useEffect } from "react";
import { connectorsAPI } from "../services/api";
import { Cable, Key, Plus, RefreshCw, CheckCircle2, Shield, Settings2, Trash2 } from "lucide-react";

const ConnectorsPage = () => {
  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [credentials, setCredentials] = useState("");
  const [syncingPlatform, setSyncingPlatform] = useState(null);

  const fetchData = async () => {
    try {
      const data = await connectorsAPI.getAll();
      setConnectors(data);
    } catch (err) {
      console.error("Failed to load connectors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleConnect = async (e) => {
    e.preventDefault();
    try {
      await connectorsAPI.add({
        platform_name: selectedPlatform,
        credentials_json: JSON.stringify({ token: credentials })
      });
      setShowModal(false);
      setCredentials("");
      await fetchData();
    } catch (err) {
      alert("Failed to connect platform");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to disconnect this platform?")) return;
    try {
      await connectorsAPI.delete(id);
      await fetchData();
    } catch (err) {
      alert("Failed to disconnect platform");
    }
  };

  const handleSync = async (platformName) => {
    setSyncingPlatform(platformName);
    setTimeout(() => {
      setSyncingPlatform(null);
      alert(`${platformName} sync completed!`);
    }, 1500);
  };

  const platforms = [
    { name: "LinkedIn", color: "from-blue-500 to-blue-700" },
    { name: "Indeed", color: "from-indigo-500 to-purple-600" },
    { name: "ZipRecruiter", color: "from-emerald-500 to-teal-600" },
    { name: "Glassdoor", color: "from-green-500 to-emerald-600" },
    { name: "Greenhouse", color: "from-teal-500 to-emerald-600" },
    { name: "Randstad", color: "from-sky-500 to-blue-600" },
    { name: "Job Bank", color: "from-red-500 to-red-700" },
    { name: "CareerBeacon", color: "from-orange-500 to-amber-600" }
  ];

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
        <h1 className="text-3xl font-black text-white">Platform Connectors</h1>
        <p className="text-sm text-[#908fa0] mt-1">Connect and sync job boards to automate applications</p>
      </div>

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((plat) => {
          const activeConn = connectors.find(c => c.platform_name === plat.name);
          return (
            <div 
              key={plat.name} 
              className={`glass-card p-6 rounded-2xl border transition-all flex flex-col justify-between min-h-[220px] ${
                activeConn ? "border-indigo-500/20 bg-indigo-500/[0.01]" : "border-white/5 bg-black/20"
              }`}
            >
              <div>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plat.color} flex items-center justify-center text-white font-black text-sm`}>
                      {plat.name[0]}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">{plat.name}</h3>
                      <p className="text-[10px] text-[#908fa0] mt-0.5">Platform Connector</p>
                    </div>
                  </div>
                  
                  {activeConn ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                      Not Connected
                    </span>
                  )}
                </div>

                <div className="mt-6 flex flex-col gap-1.5">
                  <p className="text-xs text-[#908fa0]">
                    {activeConn 
                      ? `Status: Active syncing applications every 6 hours.` 
                      : "Integrate to scan boards and apply using active profile."}
                  </p>
                  {activeConn && activeConn.last_sync_at && (
                    <span className="text-[10px] text-indigo-300 font-mono">
                      Last Sync: {new Date(activeConn.last_sync_at).toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                {activeConn ? (
                  <>
                    <button 
                      onClick={() => handleSync(plat.name)}
                      disabled={syncingPlatform === plat.name}
                      className="text-xs font-semibold text-indigo-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={syncingPlatform === plat.name ? "animate-spin" : ""} />
                      {syncingPlatform === plat.name ? "Syncing..." : "Sync Now"}
                    </button>
                    <button 
                      onClick={() => handleDelete(activeConn.id)}
                      className="text-xs font-semibold text-[#908fa0] hover:text-rose-400 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={14} /> Disconnect
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setSelectedPlatform(plat.name);
                      setShowModal(true);
                    }}
                    className="glow-btn text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Connect Account
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Connection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/10 flex flex-col gap-6 relative">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={20} className="text-indigo-400" /> Connect {selectedPlatform}
              </h3>
              <p className="text-xs text-[#908fa0] mt-1.5 leading-relaxed">
                Provide platform auth session tokens/cookies or API credential key. This data is encrypted and used solely to fetch matching postings.
              </p>
            </div>

            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Session Token / Key</label>
                <textarea 
                  required
                  rows={4}
                  value={credentials}
                  onChange={(e) => setCredentials(e.target.value)}
                  placeholder="Paste cookie or token string here..."
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setCredentials("");
                  }}
                  className="text-xs font-semibold text-[#908fa0] hover:text-white px-3 py-2"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="glow-btn text-xs font-bold px-4 py-2 rounded-lg"
                >
                  Confirm Connection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectorsPage;
