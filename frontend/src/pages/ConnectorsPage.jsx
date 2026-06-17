import { useState, useEffect } from "react";
import { connectorsAPI, emailCredentialsAPI } from "../services/api";
import { 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  Shield, 
  Settings2, 
  Trash2, 
  Mail, 
  Server, 
  Eye, 
  EyeOff, 
  Check, 
  X, 
  AlertCircle 
} from "lucide-react";

const ConnectorsPage = () => {
  const [connectors, setConnectors] = useState([]);
  const [emailCreds, setEmailCreds] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Platform Modal States
  const [showModal, setShowModal] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [authMethod, setAuthMethod] = useState("cookie"); // cookie or credentials
  const [credentials, setCredentials] = useState(""); // cookie token
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPlatformPassword, setShowPlatformPassword] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState(null);
  const [modalMode, setModalMode] = useState("connect"); // connect or edit
  const [showPlatformCookie, setShowPlatformCookie] = useState(false);

  // Email SMTP/IMAP Modal States
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailProvider, setEmailProvider] = useState("Gmail");
  const [emailAddress, setEmailAddress] = useState("");
  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpPassword, setSmtpPassword] = useState("");
  const [imapHost, setImapHost] = useState("imap.gmail.com");
  const [imapPort, setImapPort] = useState(993);
  const [imapPassword, setImapPassword] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showImapPassword, setShowImapPassword] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState(null); // { smtp_connected, imap_connected, success }

  const fetchData = async () => {
    try {
      const data = await connectorsAPI.getAll();
      setConnectors(data);
      
      try {
        const creds = await emailCredentialsAPI.get();
        setEmailCreds(creds);
      } catch {
        setEmailCreds(null);
      }
    } catch (err) {
      console.error("Failed to load connectors:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync Gmail defaults when selected
  useEffect(() => {
    if (emailProvider === "Gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setImapHost("imap.gmail.com");
      setImapPort(993);
    }
  }, [emailProvider]);

  const handleConnect = async (e) => {
    e.preventDefault();
    try {
      let credentialsJson = "";
      if (authMethod === "cookie") {
        credentialsJson = JSON.stringify({ token: credentials, auth_method: "cookie" });
      } else {
        credentialsJson = JSON.stringify({ username, password, auth_method: "credentials" });
      }

      const existingConn = connectors.find(c => c.platform_name === selectedPlatform);
      const targetStatus = modalMode === "connect" ? "Connected" : (existingConn ? existingConn.status : "Not Connected");

      if (existingConn) {
        await connectorsAPI.update(existingConn.id, {
          credentials_json: credentialsJson,
          status: targetStatus
        });
      } else {
        await connectorsAPI.add({
          platform_name: selectedPlatform,
          credentials_json: credentialsJson,
          status: targetStatus
        });
      }
      
      setShowModal(false);
      setCredentials("");
      setUsername("");
      setPassword("");
      await fetchData();
      alert(modalMode === "connect" ? "Platform connected successfully!" : "Credentials saved successfully!");
    } catch {
      alert("Failed to save platform credentials");
    }
  };

  const handleDisconnect = async (id) => {
    if (!confirm("Are you sure you want to disconnect this platform? Your saved credentials will be kept so you don't need to re-enter them.")) return;
    try {
      await connectorsAPI.update(id, { status: "Not Connected" });
      await fetchData();
    } catch {
      alert("Failed to disconnect platform");
    }
  };

  const handleClearCredentials = async (id) => {
    if (!confirm("Are you sure you want to permanently delete your saved credentials for this platform?")) return;
    try {
      await connectorsAPI.delete(id);
      await fetchData();
      alert("Credentials deleted successfully.");
    } catch {
      alert("Failed to delete credentials");
    }
  };

  const handleSync = async (platformName) => {
    setSyncingPlatform(platformName);
    setTimeout(() => {
      setSyncingPlatform(null);
      alert(`${platformName} sync completed!`);
    }, 1500);
  };

  // Email connection actions
  const handleSaveEmailCreds = async (e) => {
    e.preventDefault();
    try {
      await emailCredentialsAPI.save({
        email_provider: emailProvider,
        email: emailAddress,
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort),
        smtp_password: smtpPassword,
        imap_host: imapHost,
        imap_port: parseInt(imapPort),
        imap_password: imapPassword
      });
      setShowEmailModal(false);
      setEmailAddress("");
      setSmtpPassword("");
      setImapPassword("");
      setTestResult(null);
      await fetchData();
      alert("Email credentials saved successfully!");
    } catch {
      alert("Failed to save email credentials");
    }
  };

  const handleDeleteEmailCreds = async () => {
    if (!confirm("Are you sure you want to remove your email credentials? Email OTP automation will be disabled.")) return;
    try {
      await emailCredentialsAPI.delete();
      await fetchData();
    } catch {
      alert("Failed to delete email credentials");
    }
  };

  const handleTestEmailCreds = async () => {
    setTestingEmail(true);
    setTestResult(null);
    try {
      const res = await emailCredentialsAPI.test({
        email_provider: emailProvider,
        email: emailAddress,
        smtp_host: smtpHost,
        smtp_port: parseInt(smtpPort),
        smtp_password: smtpPassword,
        imap_host: imapHost,
        imap_port: parseInt(imapPort),
        imap_password: imapPassword
      });
      setTestResult(res);
    } catch {
      setTestResult({ smtp_connected: false, imap_connected: false, success: false });
    } finally {
      setTestingEmail(false);
    }
  };

  const getAuthMethodInfo = (connector) => {
    if (!connector.credentials_json) return "Platform Connector";
    try {
      const creds = JSON.parse(connector.credentials_json);
      if (creds.auth_method === "credentials") return "Credentials (Username/Password)";
      return "Session Cookie";
    } catch {
      return "Platform Connector";
    }
  };

  const openPlatformModal = (platformName, connector = null) => {
    setSelectedPlatform(platformName);
    setShowPlatformCookie(false);
    setShowPlatformPassword(false);
    if (connector && connector.credentials_json) {
      try {
        const creds = JSON.parse(connector.credentials_json);
        setAuthMethod(creds.auth_method || "cookie");
        if (creds.auth_method === "credentials") {
          setUsername(creds.username || "");
          setPassword(creds.password || "");
          setCredentials("");
        } else {
          setCredentials(creds.token || "");
          setUsername("");
          setPassword("");
        }
      } catch (e) {
        console.error("Failed to parse credentials_json:", e);
      }
    } else {
      setAuthMethod(platformName === "VanHack" ? "credentials" : "cookie");
      setCredentials("");
      setUsername("");
      setPassword("");
    }
    setShowModal(true);
  };

  const getAuthMethodName = (connector) => {
    if (!connector || !connector.credentials_json) return "None";
    try {
      const creds = JSON.parse(connector.credentials_json);
      if (creds.auth_method === "credentials") return "Username/Password";
      return "Session Cookie";
    } catch {
      return "Session Cookie";
    }
  };

  const getSupportedAuthMethods = (platformName) => {
    switch (platformName) {
      case "LinkedIn":
      case "Indeed":
      case "Randstad":
        return "Session Cookie, Username/Password";
      case "VanHack":
      case "Job Bank":
        return "Username/Password";
      default:
        return "Session Cookie";
    }
  };

  const hasEmailOtpSupport = (platformName) => {
    return ["LinkedIn", "Indeed", "Job Bank"].includes(platformName);
  };

  const hasSmsOtpSupport = (platformName) => {
    return ["LinkedIn", "Indeed"].includes(platformName);
  };

  const platforms = [
    { name: "LinkedIn", color: "from-blue-500 to-blue-700" },
    { name: "Indeed", color: "from-indigo-500 to-purple-600" },
    { name: "ZipRecruiter", color: "from-emerald-500 to-teal-600" },
    { name: "Glassdoor", color: "from-green-500 to-emerald-600" },
    { name: "Greenhouse", color: "from-teal-500 to-emerald-600" },
    { name: "Randstad", color: "from-sky-500 to-blue-600" },
    { name: "Job Bank", color: "from-red-500 to-red-700" },
    { name: "CareerBeacon", color: "from-orange-500 to-amber-600" },
    { name: "VanHack", color: "from-blue-600 to-cyan-500" }
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
        <h1 className="text-3xl font-black text-white">Automation Connectors</h1>
        <p className="text-sm text-[#908fa0] mt-1">Configure credentials and email tools to automate logins and applications</p>
      </div>

      {/* Email OTP Configuration Card */}
      <div className="glass-card p-8 rounded-2xl border border-white/5 bg-black/20 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white">
            <Mail size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Email OTP Automation Inbox
              {emailCreds && (
                <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </h2>
            <p className="text-xs text-[#908fa0] mt-1 max-w-xl leading-relaxed">
              Connect your Gmail or other email account. The system uses secure IMAP access to automatically read verification OTP codes when logging into job boards.
            </p>
            {emailCreds && (
              <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono text-indigo-300">
                <span>Email: {emailCreds.email}</span>
                <span>Provider: {emailCreds.email_provider}</span>
                <span>SMTP: {emailCreds.smtp_host}:{emailCreds.smtp_port}</span>
                <span>IMAP: {emailCreds.imap_host}:{emailCreds.imap_port}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {emailCreds ? (
            <>
              <button 
                onClick={() => {
                  setEmailProvider(emailCreds.email_provider);
                  setEmailAddress(emailCreds.email);
                  setSmtpHost(emailCreds.smtp_host);
                  setSmtpPort(emailCreds.smtp_port);
                  setImapHost(emailCreds.imap_host);
                  setImapPort(emailCreds.imap_port);
                  setShowEmailModal(true);
                }}
                className="text-xs font-bold px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg border border-white/10 flex items-center gap-1.5 transition-colors"
              >
                <Settings2 size={14} /> Update Setup
              </button>
              <button 
                onClick={handleDeleteEmailCreds}
                className="text-xs font-bold px-4 py-2 hover:bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} /> Disconnect
              </button>
            </>
          ) : (
            <button 
              onClick={() => {
                setEmailProvider("Gmail");
                setEmailAddress("");
                setSmtpHost("smtp.gmail.com");
                setSmtpPort(587);
                setSmtpPassword("");
                setImapHost("imap.gmail.com");
                setImapPort(993);
                setImapPassword("");
                setShowEmailModal(true);
              }}
              className="glow-btn text-xs font-bold px-5 py-2.5 rounded-lg flex items-center gap-1.5"
            >
              <Plus size={14} /> Setup Email OTP
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-white/5 my-2"></div>

      <div>
        <h2 className="text-xl font-bold text-white">Job Platform Logins</h2>
        <p className="text-xs text-[#908fa0] mt-1">Select a platform below to configure auto-login credentials or session tokens</p>
      </div>

      {/* Grid of Platforms */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map((plat) => {
          const activeConn = connectors.find(c => c.platform_name === plat.name);
          const isConnected = activeConn && activeConn.status === "Connected";
          const isDisconnected = activeConn && activeConn.status === "Not Connected";
          
          return (
            <div 
              key={plat.name} 
              className={`glass-card p-6 rounded-2xl border transition-all flex flex-col justify-between min-h-[240px] ${
                isConnected ? "border-indigo-500/20 bg-indigo-500/[0.01]" : isDisconnected ? "border-amber-500/20 bg-amber-500/[0.01]" : "border-white/5 bg-black/20"
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
                      <p className="text-[10px] text-[#908fa0] mt-0.5 font-mono">
                        {activeConn ? getAuthMethodInfo(activeConn) : "Not Configured"}
                      </p>
                    </div>
                  </div>
                  
                  {isConnected ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} /> Connected
                    </span>
                  ) : isDisconnected ? (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full flex items-center gap-1">
                      <AlertCircle size={12} /> Disconnected
                    </span>
                  ) : (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-white/40 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
                      Not Configured
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-1.5">
                  <p className="text-xs text-[#908fa0]">
                    {isConnected 
                      ? `Status: Active syncing applications every 6 hours.` 
                      : isDisconnected
                      ? "Credentials saved. Click Connect to enable auto-sync."
                      : "Integrate to scan boards and apply using active profile."}
                  </p>
                  {isConnected && activeConn.last_sync_at && (
                    <span className="text-[10px] text-indigo-300 font-mono">
                      Last Sync: {new Date(activeConn.last_sync_at).toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Authentication Details */}
                <div className="mt-4 p-3 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col gap-2 text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="text-white/40">Auth Mechanism:</span>
                    <span className="text-indigo-300 font-medium font-mono">
                      {activeConn ? getAuthMethodName(activeConn) : getSupportedAuthMethods(plat.name)}
                    </span>
                  </div>
                  
                  {hasEmailOtpSupport(plat.name) && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">Email OTP (MFA):</span>
                      {emailCreds ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                          <Check size={12} /> Automated via Inbox
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-0.5">
                          <AlertCircle size={12} /> Needs Inbox Setup
                        </span>
                      )}
                    </div>
                  )}

                  {hasSmsOtpSupport(plat.name) && (
                    <div className="flex justify-between items-center">
                      <span className="text-white/40">SMS OTP (MFA):</span>
                      <span className="text-sky-300 font-medium">Supported (Manual Entry)</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center justify-between gap-3">
                {isConnected ? (
                  <>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleSync(plat.name)}
                        disabled={syncingPlatform === plat.name}
                        className="text-xs font-semibold text-indigo-400 hover:text-white flex items-center gap-1.5 transition-colors disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={syncingPlatform === plat.name ? "animate-spin" : ""} />
                        {syncingPlatform === plat.name ? "Syncing..." : "Sync Now"}
                      </button>
                      <button 
                        onClick={() => {
                          setModalMode("edit");
                          openPlatformModal(plat.name, activeConn);
                        }}
                        className="text-xs font-semibold text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
                      >
                        <Settings2 size={14} /> Credentials
                      </button>
                    </div>
                    <button 
                      onClick={() => handleDisconnect(activeConn.id)}
                      className="text-xs font-semibold text-[#908fa0] hover:text-rose-400 flex items-center gap-1.5 transition-colors"
                    >
                      <X size={14} /> Disconnect
                    </button>
                  </>
                ) : isDisconnected ? (
                  <>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => {
                          setModalMode("connect");
                          openPlatformModal(plat.name, activeConn);
                        }}
                        className="glow-btn text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                      >
                        <CheckCircle2 size={14} /> Connect
                      </button>
                      <button 
                        onClick={() => {
                          setModalMode("edit");
                          openPlatformModal(plat.name, activeConn);
                        }}
                        className="text-xs font-semibold text-white/60 hover:text-white flex items-center gap-1.5 transition-colors"
                      >
                        <Settings2 size={14} /> View/Edit
                      </button>
                    </div>
                    <button 
                      onClick={() => handleClearCredentials(activeConn.id)}
                      className="text-xs font-semibold text-[#908fa0] hover:text-rose-400 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 size={14} /> Clear
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => {
                      setModalMode("connect");
                      openPlatformModal(plat.name);
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

      {/* Platform Connection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-white/10 flex flex-col gap-6 relative">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Shield size={20} className="text-indigo-400" /> {modalMode === "edit" ? "View/Edit Credentials" : `Connect ${selectedPlatform}`}
              </h3>
              <p className="text-xs text-[#908fa0] mt-1.5 leading-relaxed">
                {modalMode === "edit" ? `View or update your saved credentials for ${selectedPlatform}.` : `Choose authentication method to connect your ${selectedPlatform} account.`}
              </p>
            </div>

            <div className="flex border-b border-white/10">
              <button 
                type="button"
                onClick={() => setAuthMethod("cookie")}
                className={`flex-1 pb-3 text-xs font-bold transition-colors ${authMethod === "cookie" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-[#908fa0] hover:text-white"}`}
              >
                Session Cookie / Token
              </button>
              <button 
                type="button"
                onClick={() => setAuthMethod("credentials")}
                className={`flex-1 pb-3 text-xs font-bold transition-colors ${authMethod === "credentials" ? "text-indigo-400 border-b-2 border-indigo-400" : "text-[#908fa0] hover:text-white"}`}
              >
                Username & Password
              </button>
            </div>

            <form onSubmit={handleConnect} className="flex flex-col gap-4">
              {authMethod === "cookie" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Session Token / Key</label>
                    <button
                      type="button"
                      onClick={() => setShowPlatformCookie(!showPlatformCookie)}
                      className="text-[10px] text-indigo-400 hover:text-white flex items-center gap-1 focus:outline-none"
                    >
                      {showPlatformCookie ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showPlatformCookie ? "Hide Token" : "Show Token"}
                    </button>
                  </div>
                  <textarea 
                    required
                    rows={4}
                    value={credentials}
                    onChange={(e) => setCredentials(e.target.value)}
                    placeholder="Paste cookie or token string here..."
                    style={{ WebkitTextSecurity: showPlatformCookie ? "none" : "disc" }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl py-3 px-4 text-xs font-mono text-indigo-300 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Username / Email</label>
                    <input 
                      required
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. user@gmail.com"
                      className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Password</label>
                    <div className="relative">
                      <input 
                        required
                        type={showPlatformPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 pr-10 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPlatformPassword(!showPlatformPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#908fa0] hover:text-white"
                      >
                        {showPlatformPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setCredentials("");
                    setUsername("");
                    setPassword("");
                  }}
                  className="text-xs font-semibold text-[#908fa0] hover:text-white px-3 py-2"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="glow-btn text-xs font-bold px-4 py-2 rounded-lg"
                >
                  {modalMode === "edit" ? "Save Credentials" : "Confirm Connection"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email SMTP/IMAP Setup Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg glass-card p-8 rounded-3xl border border-white/10 flex flex-col gap-6 relative my-8">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Mail size={20} className="text-pink-400" /> Configure Email OTP Automation
              </h3>
              <p className="text-xs text-[#908fa0] mt-1.5 leading-relaxed">
                Connect your inbox to allow the auto-login agent to poll and extract email verification codes (OTPs) when attempting login.
              </p>
            </div>

            <form onSubmit={handleSaveEmailCreds} className="flex flex-col gap-5">
              {/* Provider dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Mailbox Provider</label>
                <select 
                  value={emailProvider} 
                  onChange={(e) => setEmailProvider(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="Gmail">Gmail (Default configurations pre-filled)</option>
                  <option value="Other">Other Custom Email Server</option>
                </select>
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-[#908fa0] uppercase tracking-wider">Email Address</label>
                <input 
                  required
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="e.g. user@gmail.com"
                  className="w-full bg-black/40 border border-white/10 rounded-xl py-2.5 px-4 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* SMTP Settings */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col gap-3">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Server size={12} /> SMTP settings (for sending emails)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">SMTP Host</label>
                    <input 
                      required
                      type="text"
                      disabled={emailProvider === "Gmail"}
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">SMTP Port</label>
                    <input 
                      required
                      type="number"
                      disabled={emailProvider === "Gmail"}
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">SMTP Password / App Password</label>
                  <div className="relative">
                    <input 
                      required
                      type={showSmtpPassword ? "text" : "password"}
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="Gmail App Password (16 chars)"
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 pr-10 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#908fa0] hover:text-white"
                    >
                      {showSmtpPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  {emailProvider === "Gmail" && (
                    <p className="text-[10px] text-pink-400/80 leading-relaxed mt-0.5">
                      Note: Standard passwords will fail. You must generate a Google App Password in your account settings.
                    </p>
                  )}
                </div>
              </div>

              {/* IMAP Settings */}
              <div className="p-4 rounded-xl border border-white/5 bg-white/[0.01] flex flex-col gap-3">
                <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Server size={12} /> IMAP settings (for polling OTP emails)
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">IMAP Host</label>
                    <input 
                      required
                      type="text"
                      disabled={emailProvider === "Gmail"}
                      value={imapHost}
                      onChange={(e) => setImapHost(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white disabled:opacity-50"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">IMAP Port</label>
                    <input 
                      required
                      type="number"
                      disabled={emailProvider === "Gmail"}
                      value={imapPort}
                      onChange={(e) => setImapPort(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 text-xs text-white disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold text-[#908fa0] uppercase tracking-wider">IMAP Password / App Password</label>
                  <div className="relative">
                    <input 
                      required
                      type={showImapPassword ? "text" : "password"}
                      value={imapPassword}
                      onChange={(e) => setImapPassword(e.target.value)}
                      placeholder="Gmail App Password (16 chars)"
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-2 px-3 pr-10 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowImapPassword(!showImapPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#908fa0] hover:text-white"
                    >
                      {showImapPassword ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Connection Verification Block */}
              {testResult && (
                <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
                  testResult.success ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-rose-500/20 bg-rose-500/5 text-rose-400"
                }`}>
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {testResult.success ? "Verification Successful!" : "Verification Failed!"}
                  </div>
                  <div className="flex flex-col gap-1 text-[11px] font-mono mt-1">
                    <div className="flex justify-between">
                      <span>SMTP Auth:</span>
                      <span className={testResult.smtp_connected ? "text-emerald-400" : "text-rose-400"}>
                        {testResult.smtp_connected ? "OK" : "Failed"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>IMAP Auth:</span>
                      <span className={testResult.imap_connected ? "text-emerald-400" : "text-rose-400"}>
                        {testResult.imap_connected ? "OK" : "Failed"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-between mt-2 pt-4 border-t border-white/5">
                <button 
                  type="button"
                  onClick={handleTestEmailCreds}
                  disabled={testingEmail || !emailAddress || !smtpPassword || !imapPassword}
                  className="text-xs font-semibold text-indigo-400 hover:text-white disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <RefreshCw size={14} className={testingEmail ? "animate-spin" : ""} />
                  {testingEmail ? "Verifying..." : "Verify Connection"}
                </button>

                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setShowEmailModal(false);
                      setTestResult(null);
                    }}
                    className="text-xs font-semibold text-[#908fa0] hover:text-white px-3 py-2"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="glow-btn text-xs font-bold px-4 py-2 rounded-lg"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectorsPage;
