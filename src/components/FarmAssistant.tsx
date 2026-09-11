import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, User, Sparkles, Loader2, Search, Info, Minus, Plus } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useFarm } from '../context/FarmContext';
import Markdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  text: string;
  sources?: { title: string; uri: string }[];
}

interface FarmAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FarmAssistant({ isOpen, onClose }: FarmAssistantProps) {
  const { selectedFarm } = useFarm();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Hello! I'm your AI Farm Assistant. I'm currently looking at your records for "${selectedFarm?.name || 'this estate'}". How can I help you today?` }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [farmContext, setFarmContext] = useState<string>('');
  const [dimensions, setDimensions] = useState({ width: 500, height: 600 });
  const [isResizing, setIsResizing] = useState(false);
  const [rotation, setRotation] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const assistantRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (selectedFarm?.id) {
      setMessages([
        { role: 'model', text: `Farm Context Switched: I'm now assisting with "${selectedFarm.name}". Previous history cleared for data integrity.` }
      ]);
      fetchFarmContext();
    }
  }, [selectedFarm?.id]);

  useEffect(() => {
    if (isOpen) {
      fetchFarmContext();
    }
  }, [isOpen]);

  const fetchFarmContext = async () => {
    const user = auth.currentUser;
    if (!user || !selectedFarm?.id) return;

    try {
      // Fetch comprehensive context from all collections filtered by current farm estate
      const [livestockSnap, inventorySnap, productionSnap, financeSnap] = await Promise.all([
        getDocs(query(collection(db, 'livestock'), where('ownerId', '==', user.uid), where('farmId', '==', selectedFarm.id))),
        getDocs(query(collection(db, 'inventory'), where('ownerId', '==', user.uid), where('farmId', '==', selectedFarm.id))),
        getDocs(query(collection(db, 'production'), where('ownerId', '==', user.uid), where('farmId', '==', selectedFarm.id))),
        getDocs(query(collection(db, 'transactions'), where('ownerId', '==', user.uid), where('farmId', '==', selectedFarm.id)))
      ]);

      const livestockData = livestockSnap.docs.map(d => {
        const data = d.data();
        return `${data.type} (${data.breed || 'Unknown breed'}): ${data.count} heads, Status: ${data.status}`;
      }).join('\n');

      const inventoryData = inventorySnap.docs.map(d => {
        const data = d.data();
        return `${data.name} (${data.category}): ${data.quantity} ${data.unit} (Min Threshold: ${data.minThreshold})`;
      }).join('\n');

      const productionData = productionSnap.docs.map(d => {
        const data = d.data();
        return `${data.date} - ${data.type}: ${data.quantity} units (${data.notes || 'No notes'})`;
      }).slice(0, 10).join('\n'); // Last 10 production records

      const financeData = financeSnap.docs.map(d => {
        const data = d.data();
        return `${data.date} - ${data.type}: $${data.amount} (${data.category}: ${data.description})`;
      }).slice(0, 10).join('\n'); // Last 10 financial records
      
      const context = `
        CURRENT ESTATE CONTEXT: ${selectedFarm.name} (${selectedFarm.location})
        USER PROFILE & FARM DATA (READ-ONLY ACCESS):
        Farmer Name: ${user.displayName || 'Farmer'}
        
        LIVESTOCK INVENTORY:
        ${livestockData || 'No livestock records found.'}
        
        STOCK & INVENTORY LEVELS:
        ${inventoryData || 'No inventory records found.'}
        
        RECENT PRODUCTION LOGS:
        ${productionData || 'No production records found.'}
        
        RECENT FINANCIAL TRANSACTIONS:
        ${financeData || 'No financial records found.'}
      `;
      setFarmContext(context);
    } catch (error) {
      console.error("Error fetching farm context:", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // TODO Slice 5: Move this call behind a server-side Edge Function so the
      // API key is never in the client bundle. For now it reads from the env var.
      const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY as string });
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `Question: ${userMessage}\n\nMy Farm Data for Analysis:\n${farmContext}` }] }
        ],
        config: {
          systemInstruction: `You are an expert AI Farm Assistant. 
          
          CORE RULES:
          1. READ-ONLY ACCESS: You can read all provided farm data but you CANNOT write or modify any data in the system.
          2. DATA-DRIVEN ADVICE: Use the provided "LIVESTOCK INVENTORY", "STOCK & INVENTORY LEVELS", etc., to give specific, accurate advice. 
          3. EXAMPLE CAPABILITIES: If asked "How many animals do I have?", sum the livestock counts. If asked "What should I buy?", check inventory levels against min thresholds.
          4. REALISM: Provide practical, scalable advice suitable for a farm in Kenya (considering the context of the app).
          5. GROUNDING: Use Google Search for external agricultural knowledge, but always prioritize the user's specific farm data for internal questions.
          6. PRIVACY: Acknowledge that you are processing this data securely under the Kenya Data Protection Act 2019.
          
          Be concise, professional, and helpful.`,
          tools: [{ googleSearch: {} }]
        }
      });

      const text = response.text || "I'm sorry, I couldn't generate a response.";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(chunk => ({
        title: chunk.web?.title || 'Source',
        uri: chunk.web?.uri || '#'
      })).filter(s => s.uri !== '#');

      setMessages(prev => [...prev, { role: 'model', text, sources }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "I encountered an error while processing your request. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResize = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setDimensions({
        width: Math.max(350, startWidth + deltaX),
        height: Math.max(400, startHeight + deltaY)
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[150] pointer-events-none">
          <motion.div 
            ref={assistantRef}
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ 
              scale: 1, 
              opacity: 1, 
              rotate: rotation,
              width: isMinimized ? 300 : dimensions.width,
              height: isMinimized ? 80 : dimensions.height
            }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            drag
            dragControls={dragControls}
            dragListener={false}
            dragMomentum={false}
            className="bg-white rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden pointer-events-auto absolute"
            style={{
              maxHeight: '90vh',
              maxWidth: '95vw',
              border: '2px solid #8B4513',
              top: '10vh',
              left: '50%',
              transform: 'translateX(-50%)' // Center it initially
            }}
          >
            {/* Header (Drag area) */}
            <div 
              onPointerDown={(e) => dragControls.start(e)}
              className="p-4 cursor-move border-b border-gray-100 flex items-center justify-between bg-[#8B4513] text-white select-none"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <Bot size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-serif font-bold">Farm Assistant</h3>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <span className="text-[8px] font-bold uppercase tracking-wider text-white/70">Online</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                  title={isMinimized ? "Expand" : "Minimize"}
                >
                  {isMinimized ? <Plus size={16} /> : <Minus size={16} />}
                </button>
                <button 
                  onClick={() => setRotation(prev => prev + 15)}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
                  title="Rotate Right"
                >
                  <Sparkles size={16} />
                </button>
                <button 
                  onClick={onClose} 
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Messages */}
            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#FDF5E6]/50">
                  {messages.map((msg, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={idx} 
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[90%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[#8B4513] text-white' : 'bg-white border border-[#8B4513]/20 text-[#8B4513]'}`}>
                          {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                        </div>
                        <div className={`space-y-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className={`p-3 rounded-2xl text-xs leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-[#8B4513] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                            <div className="markdown-body prose prose-sm max-w-none prose-headings:text-sm prose-p:text-xs">
                              <Markdown>{msg.text}</Markdown>
                            </div>
                          </div>
                          
                          {msg.sources && msg.sources.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {msg.sources.map((source, sIdx) => (
                                <a 
                                  key={sIdx}
                                  href={source.uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 px-1.5 py-0.5 bg-white border border-gray-100 rounded-lg text-[8px] font-bold text-[#8B4513] hover:bg-gray-50 transition-colors"
                                >
                                  <Search size={8} />
                                  {source.title}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="flex gap-2 items-center bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <Loader2 size={14} className="animate-spin text-[#8B4513]" />
                        <span className="text-[10px] font-medium text-gray-500 italic">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-4 border-t border-gray-100 bg-white">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Ask your Farm Assistant..."
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border-2 border-transparent focus:border-[#8B4513] focus:bg-white rounded-xl outline-none transition-all text-xs"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <button 
                      onClick={handleSend}
                      disabled={!input.trim() || isLoading}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-[#8B4513] text-white rounded-lg hover:bg-[#A0522D] transition-all disabled:opacity-50"
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>

                {/* Resize Handle */}
                <div 
                  onMouseDown={(e) => handleResize(e, 'se')}
                  className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center hover:bg-[#8B4513]/10 rounded-tl-xl transition-colors"
                >
                  <div className="w-2 h-2 border-r-2 border-b-2 border-gray-300 mr-1 mb-1" />
                </div>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
