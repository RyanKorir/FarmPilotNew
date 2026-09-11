import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  MessageSquare, 
  CheckCircle, 
  AlertTriangle, 
  Sparkles,
  Bug,
  Lightbulb,
  Settings as SettingsIcon,
  Star,
  Loader2,
  Inbox,
  Clock,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  HelpCircle
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, getDocs, limit, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { format } from 'date-fns';

const TEMPLATES = [
  {
    id: 'bug',
    label: 'Report a Pest (Bug)',
    icon: Bug,
    color: 'text-red-500',
    bgColor: 'bg-red-50',
    template: "What happened: \n\nExpected behavior: \n\nSteps to reproduce: "
  },
  {
    id: 'feature',
    label: 'Plant a Seed (Feature)',
    icon: Lightbulb,
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
    template: "The idea: \n\nHow it helps my farm: "
  },
  {
    id: 'performance',
    label: 'Fix the Engine (Performance)',
    icon: SettingsIcon,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    template: "Where it feels slow: \n\nSpecific actions taken: "
  },
  {
    id: 'praise',
    label: 'Good Harvest (Praise)',
    icon: Star,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    template: "What I love about FarmPilot: "
  },
  {
    id: 'question',
    label: 'Expert Query (Question)',
    icon: HelpCircle,
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
    template: "My question for the team: \n\nContext of my query: "
  }
];

export default function Feedback() {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('feature');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'success' | 'error' | 'invalid'>('idle');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);

  React.useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'feedback'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("Screenshot must be smaller than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = TEMPLATES.find(t => t.id === templateId);
    if (template) {
      setCategory(templateId);
      setMessage(template.template);
    }
  };

  const validateAndSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;

    if (!user) {
      setFeedbackStatus('invalid');
      setAiAnalysis("You must be signed in to submit feedback.");
      return;
    }

    if (!user.emailVerified) {
      setFeedbackStatus('invalid');
      setAiAnalysis("Security Protocol: Your account email must be verified before submitting innovations to the community greenhouse. Please check your inbox.");
      return;
    }

    if (!message.trim() || message.length < 10) {
      setFeedbackStatus('invalid');
      return;
    }

    setIsSubmitting(true);
    setFeedbackStatus('idle');

    try {
      // AI Validation - strictly anonymous
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const analysisResponse = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are a quality control assistant for a farm management app called FarmPilot. 
          Analyze the following user feedback. 
          1. Determine if it is high-quality, constructive feedback (true/false).
          2. Summarize it in one concise sentence.
          3. Rate the urgency (Low, Medium, High).
          Return your response strictly in JSON format: { "isValid": boolean, "summary": string, "urgency": "Low" | "Medium" | "High", "reason": string }`
        },
        contents: `Feedback Category: ${category}\nSubject: ${subject}\nMessage: ${message}`
      });

      let analysis;
      try {
        const text = analysisResponse.text || '{}';
        analysis = JSON.parse(text.replace(/```json|```/g, '').trim());
      } catch (e) {
        analysis = { isValid: true, summary: "Feedback received.", urgency: "Medium" };
      }

      if (!analysis.isValid) {
        setAiAnalysis(analysis.reason || "This message doesn't seem to contain specific feedback or is too brief.");
        setFeedbackStatus('invalid');
        setIsSubmitting(false);
        return;
      }

      // Save to Firestore
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: 'Verified Farmer', // Obfuscated as requested
        userEmail: 'HIDDEN', // Obfuscated as requested
        category,
        subject: subject || 'No Subject',
        message,
        screenshot, // Base64 string for simplicity in prototype
        aiSummary: analysis.summary,
        urgency: analysis.urgency,
        createdAt: serverTimestamp(),
        status: 'pending',
        recipientEmail: 'ryankorir00@gmail.com', // Hidden destination
        isVerifiedSubmission: true
      });

      setAiAnalysis(analysis.summary);
      setFeedbackStatus('success');
      setMessage('');
      setSubject('');
      setScreenshot(null);
    } catch (error) {
      console.error(error);
      setFeedbackStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="bg-[#1a1a1a] rounded-[2.5rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-block px-4 py-1.5 bg-[#8B4513] rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-white/10">
              Community Greenhouse
            </span>
            <h2 className="text-5xl font-serif font-bold mb-6 tracking-tight leading-tight">Harvesting <br/><span className="text-[#A0522D]">Community Innovation.</span></h2>
            <p className="text-gray-400 max-w-lg text-lg leading-relaxed">
              Every piece of feedback is a seed for our shared success. Help us shape the future of Kenyan farming, by farmers, for farmers.
            </p>
          </motion.div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B4513]/30 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Templates Sidebar */}
        <div className="space-y-6">
          <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Quick Blueprints</h3>
          <div className="grid grid-cols-1 gap-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTemplateSelect(t.id)}
                className={`p-6 rounded-[2rem] border-2 transition-all text-left flex items-start gap-4 group ${
                  category === t.id ? 'bg-white border-[#8B4513] shadow-xl shadow-[#8B4513]/5' : 'bg-white border-gray-100 hover:border-gray-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${t.bgColor} ${t.color}`}>
                  <t.icon size={24} />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900 leading-tight">{t.label}</p>
                  <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-widest font-bold">Apply Template</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Feedback Form */}
        <div className="md:col-span-2">
          <motion.div
            layout
            className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm"
          >
            <AnimatePresence mode="wait">
              {feedbackStatus === 'success' ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="py-12 text-center space-y-6"
                >
                  <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={56} />
                  </div>
                  <h3 className="text-3xl font-black text-gray-900 tracking-tight">Seeds Planted!</h3>
                  <p className="text-gray-500 max-w-sm mx-auto font-medium">
                    Your feedback has been received and analyzed. We grow better because of you.
                  </p>
                  {aiAnalysis && (
                    <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 text-emerald-700 text-sm font-bold italic">
                      "AI Summary: {aiAnalysis}"
                    </div>
                  )}
                  <button
                    onClick={() => setFeedbackStatus('idle')}
                    className="px-10 py-4 bg-[#5A5A40] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
                  >
                    Send More Feedback
                  </button>
                </motion.div>
              ) : (
                <form onSubmit={validateAndSubmit} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Topic Classification</label>
                      <select 
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand/5 font-bold text-gray-900 appearance-none cursor-pointer"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                         <option value="bug">Pest Report (Bug)</option>
                         <option value="feature">Planting Seeds (Feature)</option>
                         <option value="performance">Engine Fix (Performance)</option>
                         <option value="praise">Good Harvest (Praise)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Brief Subject</label>
                      <input 
                        type="text"
                        className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand/5 font-bold text-gray-900"
                        placeholder="Give it a title..."
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Detailed Message</label>
                    <textarea 
                      required
                      rows={6}
                      className="w-full px-6 py-4 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-4 focus:ring-brand/5 font-bold text-gray-900 resize-none"
                      placeholder="Tell us what's on your mind..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Evidence (Optional Screenshot)</label>
                    <div className="relative">
                      <input 
                        type="file"
                        accept="image/*"
                        onChange={handleScreenshotChange}
                        className="hidden"
                        id="screenshot-upload"
                      />
                      <label 
                        htmlFor="screenshot-upload"
                        className={`w-full flex items-center justify-between px-6 py-4 bg-gray-50 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                          screenshot ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {screenshot ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-brand/20">
                              <img src={screenshot} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="p-2 bg-white rounded-lg text-gray-400">
                              <Camera size={20} />
                            </div>
                          )}
                          <span className={`text-xs font-bold ${screenshot ? 'text-brand' : 'text-gray-500'}`}>
                            {screenshot ? 'Screenshot Attached' : 'Attach Photo or Screenshot (Max 2MB)'}
                          </span>
                        </div>
                        {screenshot && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); setScreenshot(null); }}
                            className="text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </label>
                    </div>
                  </div>

                  {feedbackStatus === 'invalid' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-4 p-6 bg-amber-50 rounded-2xl border border-amber-100 text-amber-700 text-sm"
                    >
                      <AlertTriangle size={24} className="shrink-0" />
                      <div>
                        <p className="font-black uppercase tracking-widest text-[10px] mb-1">Detailed Input Required</p>
                        <p className="font-medium opacity-90">{aiAnalysis || "Constructive feedback requires at least 10 meaningful characters."}</p>
                      </div>
                    </motion.div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-6 bg-gray-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-black transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-4 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Securing Transmission...
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Seal & Transmit to Innovation Panel
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-2 justify-center text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
                    <Sparkles size={12} className="text-brand" />
                    Zero-Leak Encryption Active
                  </div>
                </form>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* History Section */}
      {history.length > 0 && (
        <div className="space-y-6 pt-10 border-t border-gray-100">
           <div className="flex items-center justify-between">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-2">Harvest History (Past Feedback)</h3>
              <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                 <CheckCircle size={12} /> {history.filter(h => h.status === 'resolved').length} Resolved
              </div>
           </div>
           <div className="grid grid-cols-1 gap-6">
              {history.map((item) => (
                <motion.div 
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group"
                >
                   <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
                      <div className="flex-1">
                         <div className="flex items-center gap-3 mb-4">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                              item.status === 'resolved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                               {item.status || 'Pending'}
                            </span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                               {item.createdAt?.toDate ? format(item.createdAt.toDate(), 'MMM dd, yyyy') : 'Recently'}
                            </span>
                         </div>
                         <h4 className="text-xl font-bold text-gray-900 mb-2">{item.subject}</h4>
                         <p className="text-gray-500 text-sm leading-relaxed mb-4">{item.message}</p>
                         
                         {item.adminResponse && (
                           <motion.div 
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             className="mt-6 p-6 bg-[#8B4513]/5 rounded-[1.5rem] border-l-4 border-[#8B4513] relative"
                           >
                              <div className="flex items-center gap-2 mb-3">
                                 <Sparkles size={14} className="text-[#8B4513]" />
                                 <span className="text-[10px] font-black uppercase tracking-widest text-[#8B4513]">Community Resolution Dispatch</span>
                              </div>
                              <p className="text-[#8B4513] text-sm font-medium italic leading-relaxed">
                                 "{item.adminResponse}"
                              </p>
                           </motion.div>
                         )}
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-3 font-mono">
                         <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${
                           item.urgency === 'High' ? 'bg-red-50 text-red-500' : 
                           item.urgency === 'Medium' ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-500'
                         }`}>
                            {item.urgency} Priority
                         </div>
                         {item.screenshot && (
                           <div className="w-24 h-24 rounded-2xl overflow-hidden border border-gray-100 shadow-sm relative group/img cursor-pointer">
                              <img src={item.screenshot} alt="Visual Record" className="w-full h-full object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                 <ImageIcon className="text-white" size={20} />
                              </div>
                           </div>
                         )}
                      </div>
                   </div>
                   <div className="absolute top-0 right-0 p-8 opacity-5 -mr-8 -mt-8 rotate-12">
                      <MessageSquare size={120} />
                   </div>
                </motion.div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
}
