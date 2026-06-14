import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { billingAPI } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Check, Sparkles, CreditCard, Tag } from "lucide-react";

const PricingPage = () => {
  const [plans, setPlans] = useState([]);
  const [promoCode, setPromoCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const data = await billingAPI.getPlans();
        setPlans(data);
      } catch (err) {
        console.error("Failed to load plans:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, []);

  const handleCheckout = async (planId) => {
    setCheckingOut(true);
    try {
      const order = await billingAPI.checkout(planId, promoCode);
      if (order.status === "completed") {
        alert("Free trial activated! You are now a premium user.");
        // Reload user details (implicitly handled by context reload)
        window.location.href = "/dashboard";
      } else if (order.stripe_session_id) {
        // Redirect to Stripe checkout URL
        window.location.href = order.stripe_session_id;
      }
    } catch (err) {
      alert(err.response?.data?.detail || "Checkout process failed");
    } finally {
      setCheckingOut(false);
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
      <div className="text-center">
        <h1 className="text-3xl font-black text-white">Choose Your Plan</h1>
        <p className="text-sm text-[#908fa0] mt-1">Unlock premium AI-assisted job hunting features</p>
      </div>

      {/* Promocode Box */}
      <div className="max-w-md mx-auto w-full glass-card p-5 rounded-2xl border border-white/10 flex items-center gap-3">
        <span className="text-indigo-400"><Tag size={20} /></span>
        <input 
          type="text" 
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Promo code (e.g. FREETRIAL)"
          className="flex-1 bg-transparent border-0 text-xs text-white focus:outline-none placeholder-[#908fa0] uppercase"
        />
        {promoCode && (
          <span className="text-[10px] uppercase font-bold text-indigo-400 animate-pulse bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
            Applying
          </span>
        )}
      </div>

      {/* Grid of Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto w-full mt-4">
        {plans.map((plan) => {
          const features = JSON.parse(plan.features_json);
          return (
            <div 
              key={plan.id}
              className={`glass-card p-8 rounded-3xl border flex flex-col justify-between min-h-[420px] transition-all relative ${
                plan.name === "Pro" 
                  ? "border-indigo-500/40 bg-indigo-500/[0.02] shadow-xl shadow-indigo-500/5" 
                  : "border-white/5 bg-black/20"
              }`}
            >
              {plan.name === "Pro" && (
                <span className="absolute top-4 right-4 text-[9px] uppercase tracking-wider font-bold text-indigo-400 bg-indigo-500/15 border border-indigo-500/30 px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles size={10} /> Popular
                </span>
              )}

              <div>
                <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-black text-white">${plan.price}</span>
                  <span className="text-xs text-[#908fa0] ml-1">/month</span>
                </div>

                <div className="mt-8 flex flex-col gap-3.5">
                  {features.map((feat, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <span className="text-indigo-400"><Check size={14} /></span>
                      <span className="text-[#e0e3e5]">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-8 pt-4">
                <button 
                  onClick={() => handleCheckout(plan.id)}
                  disabled={checkingOut}
                  className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                    plan.name === "Pro" 
                      ? "glow-btn" 
                      : "bg-white/5 border border-white/10 hover:bg-white/10 text-white"
                  }`}
                >
                  <CreditCard size={14} />
                  {checkingOut ? "Processing..." : `Upgrade to ${plan.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PricingPage;
