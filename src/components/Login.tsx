import React, { useState } from 'react';
import { 
  auth, 
  signIn, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail 
} from '../firebase';
import { Bird, Mail, Lock, User, ArrowRight, AlertCircle, Loader2, Github, ShieldCheck, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import TermsAndConditions from './TermsAndConditions';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptTerms && !isReset) {
      setError('Please accept the Terms and Conditions to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (isReset) {
        await sendPasswordResetEmail(auth, email);
        setMessage('Password reset email sent! Check your inbox.');
        setIsReset(false);
      } else if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save initial settings and USER PROFILE
        if (userCredential.user) {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            email: userCredential.user.email,
            name: userCredential.user.email?.split('@')[0],
            role: 'user',
            createdAt: new Date().toISOString()
          });

          await setDoc(doc(db, 'settings', userCredential.user.uid), {
            authSettings: {
              otpMethod: phoneNumber ? 'sms' : 'email',
              phoneNumber: phoneNumber || '',
              requireAuthForEdits: true
            },
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!mfaRequired) setLoading(false);
    }
  };

  const handleMfaVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate verification delay
    setTimeout(() => {
      if (mfaCode === '123456') {
        setMfaRequired(false);
        setLoading(false);
      } else {
        setError('Invalid 2FA code. Please try again.');
        setLoading(false);
      }
    }, 1000);
  };

  const handleGoogleSignIn = async () => {
    if (!acceptTerms) {
      setError('Please accept the Terms and Conditions to continue.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // signIn() triggers a redirect — page will reload on return.
      // Profile creation is handled in Layout's onAuthStateChanged.
      await signIn();
      // Execution here only if redirect didn't navigate away (e.g. popup fallback)
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl p-10 text-center"
        >
          <div className="w-20 h-20 bg-[#5A5A40] rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg">
            <ShieldCheck className="text-white w-10 h-10" />
          </div>
          <h2 className="text-2xl font-serif font-bold mb-2">Two-Factor Authentication</h2>
          <p className="text-gray-500 mb-8 text-sm">Please enter the 6-digit code sent to your device.</p>
          
          <form onSubmit={handleMfaVerify} className="space-y-6">
            <input 
              type="text"
              maxLength={6}
              placeholder="000000"
              className="w-full text-center text-3xl tracking-[0.5em] font-mono py-4 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] rounded-2xl outline-none"
              value={mfaCode}
              onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
            />
            <button
              type="submit"
              disabled={loading || mfaCode.length !== 6}
              className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2 shadow-xl disabled:opacity-50"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Sign In'}
            </button>
            <button 
              type="button"
              onClick={() => setMfaRequired(false)}
              className="text-sm text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F0] flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-[#5A5A40]/10 p-10 relative overflow-hidden"
      >
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#5A5A40]/5 rounded-full -mr-16 -mt-16" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#5A5A40]/5 rounded-full -ml-12 -mb-12" />

        <div className="relative z-10 text-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-[#5A5A40] rounded-2xl flex items-center justify-center mx-auto mb-10 shadow-xl shadow-[#5A5A40]/20"
          >
            <Bird className="text-white w-8 h-8" />
          </motion.div>
          
          <h1 className="text-3xl font-serif font-black text-[#1a1a1a] mb-3 tracking-tight">
            {isReset ? 'Restore Access' : isLogin ? 'Welcome back to FarmPilot' : 'Unified Agricultural Control'}
          </h1>
          <p className="text-[#5A5A40] mb-12 text-[9px] font-black uppercase tracking-[0.3em] opacity-40">
            {isReset ? 'Secure Identity Recovery' : 'Cultivating Intelligence — Est. 2026'}
          </p>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm text-left"
              >
                <AlertCircle size={18} className="shrink-0" />
                <p>{error}</p>
              </motion.div>
            )}
            {message && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-600 text-sm text-left"
              >
                <Bird size={18} className="shrink-0" />
                <p>{message}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase ml-4">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  required
                  type="email"
                  placeholder="name@example.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white rounded-2xl outline-none transition-all"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {!isReset && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-4">Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    required
                    type="password"
                    placeholder="••••••••"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white rounded-2xl outline-none transition-all"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!isLogin && !isReset && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-400 uppercase ml-4">Phone Number (Optional)</label>
                <div className="relative">
                  <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input 
                    type="tel"
                    placeholder="+254 700 000000"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-transparent focus:border-[#5A5A40] focus:bg-white rounded-2xl outline-none transition-all"
                    value={phoneNumber}
                    onChange={e => setPhoneNumber(e.target.value)}
                  />
                </div>
              </div>
            )}

            {!isReset && (
              <div className="flex items-start gap-3 px-2 py-2">
                <div className="flex items-center h-5">
                  <input
                    id="terms"
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    className="w-4 h-4 text-[#5A5A40] border-gray-300 rounded focus:ring-[#5A5A40] cursor-pointer"
                  />
                </div>
                <div className="text-xs">
                  <label htmlFor="terms" className="text-gray-500 font-medium cursor-pointer">
                    I accept the{' '}
                    <button
                      type="button"
                      onClick={() => setShowTerms(true)}
                      className="text-[#5A5A40] font-bold hover:underline"
                    >
                      Terms and Conditions
                    </button>
                    {' '}and acknowledge the Data Protection Act (Kenya).
                  </label>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (!acceptTerms && !isReset)}
              className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-bold hover:bg-[#4A4A30] transition-all flex items-center justify-center gap-2 shadow-xl shadow-[#5A5A40]/20 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  {isReset ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          {!isReset && (
            <>
              <div className="mt-8 relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-4 text-gray-300 font-black tracking-widest">Digital Identity</span>
                </div>
              </div>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full mt-6 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-3 shadow-sm hover:shadow-md disabled:opacity-50 group"
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-1 .67-2.28 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.67-.35-1.39-.35-2.09s.13-1.42.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                </div>
                <span className="font-bold">Sign in with Google</span>
              </button>
            </>
          )}

          <div className="mt-10 space-y-4">
            <div className="flex flex-col items-center gap-2">
              {!isReset && (
                <button 
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-xs font-black uppercase tracking-widest text-[#5A5A40] hover:underline"
                >
                  {isLogin ? "Create an account" : "Sign in to account"}
                </button>
              )}
              <button 
                onClick={() => {
                  setIsReset(!isReset);
                  setError('');
                  setMessage('');
                }}
                className="text-[9px] font-black uppercase tracking-widest text-gray-300 hover:text-gray-400"
              >
                {isReset ? 'Return to authentication' : 'Access recovery'}
              </button>
            </div>
            
            <div className="pt-6 border-t border-gray-50 flex justify-center gap-4 text-[8px] font-black uppercase tracking-widest text-gray-300">
              <button onClick={() => setShowTerms(true)} className="hover:text-gray-400 decoration-[#5A5A40] underline underline-offset-4">Legal Policy</button>
              <button className="hover:text-gray-400 decoration-[#5A5A40] underline underline-offset-4">Privacy Framework</button>
            </div>
          </div>
        </div>
      </motion.div>
      
      <TermsAndConditions 
        isOpen={showTerms} 
        onClose={() => setShowTerms(false)} 
      />
      
      <p className="mt-8 text-gray-300 text-[9px] font-black uppercase tracking-[0.3em]">
        Operational Registry v2.4 — 2026
      </p>
    </div>
  );
}
