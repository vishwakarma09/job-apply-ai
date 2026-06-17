import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, HelpCircle, Mail, Send, CheckCircle2, MessageSquare, ChevronDown } from "lucide-react";
import { supportAPI } from "../services/api";


const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="glass-card border border-white/5 bg-black/20 rounded-2xl overflow-hidden transition-all duration-300">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="font-bold text-sm text-white pr-4">{question}</span>
        <ChevronDown 
          size={18} 
          className={`text-indigo-400 transition-transform duration-300 flex-shrink-0 ${isOpen ? "rotate-180" : ""}`} 
        />
      </button>
      <div 
        className={`transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[300px] border-t border-white/5 opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        }`}
      >
        <p className="px-6 py-5 text-xs text-[#908fa0] leading-relaxed">
          {answer}
        </p>
      </div>
    </div>
  );
};

const SupportPage = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "General Inquiry",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await supportAPI.submitTicket(formData);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to submit ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const faqs = [
    {
      question: "How does AI Job Apply automate my job applications?",
      answer: "AI Job Apply uses a lightweight browser extension that connects with your secure backend. When you start an auto-apply flow, the extension logs into target platforms (like LinkedIn, Indeed, or greenhouse) and automatically answers screening questions using Cerebras LLM cloud inference to tailor your cover letter and responses."
    },
    {
      question: "Is my personal data secure?",
      answer: "Yes, security is our priority. Your login credentials, session tokens, and profiles are encrypted and stored in your local/private database. The extension only executes commands directly on your browser tab under your visibility."
    },
    {
      question: "How do I configure my custom AI Connector?",
      answer: "Go to your Profile page and enter your custom API key (e.g. OpenAI or Cerebras). Once saved, you can configure auto-apply rules on the Connectors page and start automated job searching."
    },
    {
      question: "Can I cancel my subscription at any time?",
      answer: "Absolutely. You can manage your subscription directly from the Pricing page or by contacting our support billing desk. There are no cancellation fees or long-term contracts."
    },
    {
      question: "What platforms are currently supported?",
      answer: "We support LinkedIn, Indeed, Canada Job Bank, CareerBeacon, Randstad, and VanHack, with Greenhouse/Workday corporate portals support in active development."
    }
  ];

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

      {/* Hero Header */}
      <section className="max-w-4xl mx-auto px-6 pt-16 pb-8 text-center relative z-10">
        <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/30 px-4 py-1.5 rounded-full text-indigo-400 font-semibold text-xs mb-6">
          <HelpCircle size={14} /> Help Center & Support Desk
        </div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white mb-4">
          How can we <span className="glow-text">help you?</span>
        </h1>
        <p className="text-sm text-[#908fa0] max-w-lg mx-auto">
          Need help setting up your browser extension, database connectors, or subscription billing? Send a ticket or browse the FAQ below.
        </p>
      </section>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8 relative z-10">
        
        {/* FAQs Accordion Section */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare size={18} className="text-indigo-400" />
            <h2 className="text-lg font-bold text-white">Frequently Asked Questions</h2>
          </div>
          
          <div className="flex flex-col gap-3">
            {faqs.map((faq, index) => (
              <FAQItem key={index} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Contact/Support Form Section */}
        <div className="lg:col-span-5">
          <div className="glass-card p-8 rounded-3xl border border-white/5 bg-black/40 shadow-xl relative overflow-hidden">
            <div className="flex items-center gap-2 mb-6">
              <Mail size={18} className="text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Contact Support</h2>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center text-center py-8 animate-fadeIn">
                <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-base font-bold text-white mb-2">Message Sent Successfully!</h3>
                <p className="text-xs text-[#908fa0] leading-relaxed max-w-[280px]">
                  Thank you for reaching out. A support engineer will respond to your registered email address (<strong>{formData.email}</strong>) within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setFormData({ name: "", email: "", subject: "General Inquiry", message: "" });
                  }}
                  className="mt-6 text-xs text-indigo-400 hover:text-white transition-colors"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#908fa0] mb-1.5 tracking-wider">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter your name"
                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#908fa0] mb-1.5 tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#908fa0] mb-1.5 tracking-wider">
                    Subject
                  </label>
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-[#0E0E10] border border-white/5 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all"
                  >
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Billing & Pricing">Billing & Pricing</option>
                    <option value="Technical Bug / Issue">Technical Bug / Issue</option>
                    <option value="Extension Setup Help">Extension Setup Help</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-[#908fa0] mb-1.5 tracking-wider">
                    How can we help?
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Describe your issue or query..."
                    className="w-full bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 text-xs text-white placeholder-white/20 focus:outline-none focus:border-indigo-500/50 focus:bg-white/[0.05] transition-all resize-none"
                  />
                </div>

                {error && (
                  <div className="text-rose-400 text-xs bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-xl">
                    {error}
                  </div>
                )}

                <button
                  type="submit"

                  disabled={loading}
                  className="w-full glow-btn py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50"
                >
                  <Send size={14} />
                  {loading ? "Sending Ticket..." : "Submit Ticket"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
