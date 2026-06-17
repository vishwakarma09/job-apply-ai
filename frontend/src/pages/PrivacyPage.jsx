import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield } from "lucide-react";

const PrivacyPage = () => {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#e0e3e5] relative overflow-hidden font-sans pb-16">
      {/* Background Aura Glowing Effects */}
      <div className="ai-glow-bg w-[500px] h-[500px] top-[-10%] left-[-10%]"></div>
      <div className="ai-glow-bg w-[600px] h-[600px] bottom-[-10%] right-[-10%]" style={{ animationDelay: "-3s" }}></div>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full glass-card border-x-0 border-t-0 border-white/5 bg-[#0A0A0A]/70 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.png" alt="AI Job Apply Logo" className="w-8 h-8 rounded-lg object-contain shadow-lg shadow-indigo-500/20" />
            <span className="font-bold text-lg tracking-wider text-white">AI Job Apply</span>
          </Link>
          <Link to="/" className="text-xs font-bold text-indigo-400 hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft size={14} /> Back to Home
          </Link>
        </div>
      </header>

      {/* Content Container */}
      <main className="max-w-3xl mx-auto px-6 pt-16 relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
            <p className="text-xs text-[#908fa0] mt-1">Last Updated: June 17, 2026</p>
          </div>
        </div>

        <div className="glass-card p-8 md:p-10 rounded-[32px] border border-white/5 bg-black/40 shadow-xl flex flex-col gap-6 text-xs text-[#908fa0] leading-relaxed">
          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">1. Introduction</h2>
            <p>
              Welcome to AI Job Apply ("we", "our", or "us"). We are committed to protecting your privacy. This Privacy Policy explains how our browser extension ("AI Job Apply Assistant") and web application collect, use, and safeguard your personal information when you use our service.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">2. Data We Collect</h2>
            <p className="mb-2">
              To provide our automated job application assistance service, we collect the following types of information:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-2">
              <li>
                <strong className="text-white">Personally Identifiable Information (PII):</strong> Your name, email, phone number, location, work authorization status, and skills listed in your Job Profile, which are necessary to auto-fill application forms.
              </li>
              <li>
                <strong className="text-white">Authentication Information:</strong> Session tokens and encrypted account credentials for connected job boards (such as LinkedIn or Indeed) to allow automatic login and application status tracking.
              </li>
              <li>
                <strong className="text-white">Website Content:</strong> The text of the active job description page that you are viewing when you trigger the helper extension, which is used solely to generate tailored application responses and cover letters.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">3. How We Use Your Data</h2>
            <p className="mb-2">
              We process your data strictly to fulfill the service's primary purpose:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li>To auto-fill job application forms on your behalf on supported platforms.</li>
              <li>To analyze job requirements and generate tailored, relevant cover letters.</li>
              <li>To sync your application status (e.g. applied, interviewing) to your central Kanban dashboard.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">4. Data Storage and Security</h2>
            <p>
              Your personal information, profiles, and credentials are securely stored in our encrypted databases. We employ standard technical and administrative safeguards to protect your personal data from unauthorized access, loss, or alteration.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">5. Data Sharing and Disclosures</h2>
            <p className="mb-2">
              We respect your privacy and enforce strict data sharing rules:
            </p>
            <ul className="list-disc pl-5 flex flex-col gap-1.5">
              <li><strong className="text-white">No Selling:</strong> We never sell, trade, or rent your personal data to third parties.</li>
              <li><strong className="text-white">Application Delivery:</strong> Your application data is only submitted to the job boards (e.g., LinkedIn, Indeed) that you explicitly instruct the extension to apply to.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">6. Your Rights and Choices</h2>
            <p>
              You can access, modify, or permanently delete your profile data, uploaded resumes, and connected credentials at any time directly through your user Profile page on our platform, or by contacting our Support desk.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-bold text-white mb-2 uppercase tracking-wide">7. Contact Us</h2>
            <p>
              If you have any questions or concerns regarding this Privacy Policy or your data usage, you can open a ticket on our <Link to="/support" className="text-indigo-400 hover:text-white underline">Support Page</Link> or email us at <a href="mailto:support@owera.ca" className="text-indigo-400 hover:text-white underline">support@owera.ca</a>.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPage;
