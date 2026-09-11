import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Loader2, Smartphone, Mail, X, AlertCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  actionName: string;
}

export default function OTPAuthModal({ isOpen, onClose, onVerified, actionName }: Props) {
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [method, setMethod] = useState<'email' | 'sms'>('email');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (isOpen) {
      const fetchAuthSettings = async () => {
        const user = auth.currentUser;
        if (!user) return;
        try {
          const docSnap = await getDoc(doc(db, 'settings', user.uid));
          if (docSnap.exists()) {
            const data = docSnap.data().authSettings;
            if (data) {
              setMethod(data.otpMethod || 'email');
              setPhoneNumber(data.phoneNumber || '');
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchAuthSettings();
      setStep('request');
      setCode('');
      setError('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  const handleRequest = () => {
    setLoading(true);
    // Simulate sending OTP
    setTimeout(() => {
      setStep('verify');
      setLoading(false);
      setTimer(60);
      console.log('SIMULATED OTP: 123456');
    }, 1500);
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Realistic simulation: checking against a hardcoded demo code
    setTimeout(() => {
      if (code === '123456') {
        onVerified();
        onClose();
      } else {
        setError('Invalid authorization code. Please try again.');
        setLoading(false);
      }
    }, 1000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden"
      >
        <div className="p-8 text-center">
          <div className="w-16 h-16 bg-[#5A5A40] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#5A5A40]/20">
            <ShieldCheck className="text-white" size={32} />
          </div>
          
          <h3 className="text-2xl font-serif font-bold text-[#1a1a1a] mb-2">Authorization Required</h3>
          <p className="text-sm text-gray-500 mb-8">
            To proceed with <strong>{actionName}</strong>, please verify your identity as the farm owner.
          </p>

          <AnimatePresence mode="wait">
            {step === 'request' ? (
              <motion.div 
                key="request"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="p-4 bg-gray-50 rounded-2xl flex items-center gap-4 text-left border border-gray-100">
                  <div className="p-3 bg-white rounded-xl text-[#5A5A40]">
                    {method === 'email' ? <Mail size={24} /> : <Smartphone size={24} />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Send Code Via</p>
                    <p className="font-bold text-gray-900">
                      {method === 'email' ? auth.currentUser?.email : (phoneNumber || 'Your Phone Number')}
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleRequest}
                  disabled={loading}
                  className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#5A5A40]/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Send Authorization Code'}
                </button>
              </motion.div>
            ) : (
              <motion.form 
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerify}
                className="space-y-6"
              >
                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm text-left">
                    <AlertCircle size={18} className="shrink-0" />
                    <p>{error}</p>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Enter 6-Digit Code</label>
                  <input 
                    autoFocus
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    className="w-full text-center text-4xl tracking-[0.4em] font-mono py-4 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] rounded-2xl outline-none"
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={loading || code.length !== 6}
                    className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#5A5A40]/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify Code'}
                  </button>
                  
                  <button 
                    type="button"
                    disabled={timer > 0}
                    onClick={handleRequest}
                    className="text-sm font-bold text-[#5A5A40] hover:underline disabled:text-gray-400"
                  >
                    {timer > 0 ? `Resend code in ${timer}s` : 'Resend Code'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
          
          <button 
            onClick={onClose}
            className="mt-6 p-2 text-gray-400 hover:text-gray-600"
          >
            <X size={24} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}
