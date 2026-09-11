import React from 'react';
import { motion } from 'motion/react';
import { X, Shield, Lock, Eye, FileText, Scale, Sparkles, Clock } from 'lucide-react';

interface TermsAndConditionsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function TermsAndConditions({ isOpen, onClose }: TermsAndConditionsProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-3xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#5A5A40] via-[#8C8C78] to-[#5A5A40]" />
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-[#5A5A40] text-white rounded-[1.25rem] shadow-xl shadow-[#5A5A40]/30 flex items-center justify-center">
              <Shield size={28} />
            </div>
            <div>
              <h2 className="text-3xl font-serif font-black text-[#1a1a1a] tracking-tight">Legal Protocols</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[8px] font-black uppercase tracking-widest rounded-full border border-emerald-100">DPA 2019 Compliant</span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Version 2.5.1 • Updated March 2026</p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 bg-gray-50 hover:bg-gray-100 rounded-2xl transition-all text-gray-400 group"
          >
            <X size={20} className="group-hover:rotate-90 transition-transform" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar bg-white">
          {/* Summary Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 bg-[#F9F9F7] rounded-3xl border border-gray-100">
               <Lock className="text-[#5A5A40] mb-3" size={20} />
               <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2">Zero Leakage</h4>
               <p className="text-[11px] text-gray-500 leading-relaxed">Your agricultural data is never shared with third parties or used for external model training.</p>
            </div>
            <div className="p-6 bg-[#F9F9F7] rounded-3xl border border-gray-100">
               <Eye className="text-[#5A5A40] mb-3" size={20} />
               <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2">Full Transparency</h4>
               <p className="text-[11px] text-gray-500 leading-relaxed">Access, correct, or export your entire data vault at any time through our verified protocols.</p>
            </div>
            <div className="p-6 bg-[#F9F9F7] rounded-3xl border border-gray-100">
               <Scale className="text-[#5A5A40] mb-3" size={20} />
               <h4 className="text-xs font-black text-gray-900 uppercase tracking-widest mb-2">Legal Sovereignty</h4>
               <p className="text-[11px] text-gray-500 leading-relaxed">Governed by the Kenya Data Protection Act, ensuring your rights as a data subject are paramount.</p>
            </div>
          </div>

          <div className="space-y-12 max-w-2xl mx-auto">
            <section className="space-y-6">
              <h3 className="text-lg font-serif font-black text-gray-900 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#5A5A40] text-xs font-black">01</span>
                Service Governance & Estate Context
              </h3>
              <div className="pl-11 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  FarmPilot operates as a technical infrastructure provider for multi-estate agricultural management. By utilizing this platform, you acknowledge that data is strictly partitioned by "Farm Estate" identifiers. AI modules and reporting tools are context-restricted to the currently active estate to prevent cross-contamination of historical or biological data.
                </p>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-lg font-serif font-black text-gray-900 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#5A5A40] text-xs font-black">02</span>
                Privacy Protection Protocols
              </h3>
              <div className="pl-11 space-y-6">
                <p className="text-sm text-gray-600 leading-relaxed italic">
                  In compliance with the Data Protection Act (2019), we operate under the following strict mandates:
                </p>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="mt-1"><div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full" /></div>
                    <div>
                        <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-1">Purpose Binding</h5>
                        <p className="text-xs text-gray-500 leading-relaxed">Agricultural metrics (Livestock IDs, health logs, production yields) are processed solely for the fulfillment of farm management efficiency.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1"><div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full" /></div>
                    <div>
                        <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-1">Cross-Border Transfers</h5>
                        <p className="text-xs text-gray-500 leading-relaxed">Data resides on Google Cloud infrastructure. Trans-border flows are encrypted and protected under Standard Contractual Clauses (SCCs).</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1"><div className="w-1.5 h-1.5 bg-[#5A5A40] rounded-full" /></div>
                    <div>
                        <h5 className="text-[11px] font-black text-gray-900 uppercase tracking-widest mb-1">Identity Masking</h5>
                        <p className="text-xs text-gray-500 leading-relaxed">Community-facing signals (Inovations/Forum) are strictly anonymized unless explicit 'Premium Visibility' is toggled by the creator.</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-lg font-serif font-black text-gray-900 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#5A5A40] text-xs font-black">03</span>
                Artificial Intelligence Ethics & Precision
              </h3>
              <div className="pl-11 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  The 'Greenhouse AI' module operates on a 'Zero-Retention' policy for prompt context. Smart Assistant results are grounded exclusively in the data associated with your active Farm Estate. Veterinary pedigree certifications and production yield forecasting are provided as verified digital assets based on your authenticated input logs.
                </p>
              </div>
            </section>

            <section className="space-y-6">
              <h3 className="text-lg font-serif font-black text-gray-900 flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-[#5A5A40] text-xs font-black">04</span>
                Premium Modules & Monetization
              </h3>
              <div className="pl-11 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Monetized updates (Legacy Elite) grant access to advanced UI architectural layers. Subscription fees support infrastructure maintenance and cross-border security compliance. All standard agricultural management features remain accessible to verified community members globally.
                </p>
              </div>
            </section>
          </div>

          <div className="p-10 bg-[#F9F9F7] rounded-[3rem] border border-gray-100 flex flex-col items-center text-center">
            <Shield className="text-[#5A5A40]/20 mb-6" size={48} />
            <p className="text-sm font-serif font-bold text-gray-900 max-w-md italic mb-4">
              "We believe the farmer's data is their most valuable asset. FarmPilot is not a harvester; we are the vault."
            </p>
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em] font-sans">— System Core Directive</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-10 border-t border-gray-100 bg-white flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 text-[10px] text-gray-400 font-black uppercase tracking-widest">
              <Lock size={14} className="text-emerald-500" />
              Encryption: AES-256 Bit GCM
            </div>
            <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest">Security Audit Clearance: PASS/PROD-2026-ESTATE</p>
          </div>
          <button
            onClick={onClose}
            className="w-full md:w-auto px-12 py-5 bg-[#5A5A40] text-white rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.2em] hover:bg-black hover:scale-105 transition-all shadow-2xl shadow-[#5A5A40]/30"
          >
            Acknowledge & Sync
          </button>
        </div>
      </motion.div>
    </div>
  );
}
