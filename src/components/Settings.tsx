import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth, updatePassword } from '../firebase';
import { 
  Bell, 
  Shield, 
  Eye, 
  Moon, 
  Sun, 
  Smartphone, 
  Lock, 
  CheckCircle, 
  AlertCircle, 
  Mail,
  Zap,
  Crown,
  Sparkles,
  BookOpen,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import PremiumThemeStore from './PremiumThemeStore';

export default function Settings() {
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [notifications, setNotifications] = useState({
    lowFeed: true,
    expiringMedicine: true,
    productionDrops: true,
    mortalityAlerts: true,
    marketUpdates: false,
    emailSchedules: true,
    notificationEmail: '',
    reminderBuffer: 7
  });
  const [authSettings, setAuthSettings] = useState({
    otpMethod: 'email' as 'email' | 'sms',
    phoneNumber: '',
    requireAuthForEdits: true
  });
  const [visualEffects, setVisualEffects] = useState({
    interactiveClicks: true
  });
  const [theme, setTheme] = useState('light');
  const [loading, setLoading] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const path = `settings/${user.uid}`;
      try {
        const docRef = doc(db, 'settings', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setNotifications(data.notifications || notifications);
          setAuthSettings(data.authSettings || authSettings);
          setVisualEffects(data.visualEffects || visualEffects);
          setTheme(data.theme || 'light');
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const saveSettings = async (newNotifications: any, newAuth?: any, newVisualEffects?: any, newTheme?: string) => {
    const user = auth.currentUser;
    if (!user) return;

    const path = `settings/${user.uid}`;
    try {
      await setDoc(doc(db, 'settings', user.uid), {
        notifications: newNotifications,
        authSettings: newAuth || authSettings,
        visualEffects: newVisualEffects || visualEffects,
        theme: newTheme || theme,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const toggleNotification = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    saveSettings(updated);
  };

  const updateDetailedNotification = (updates: Partial<typeof notifications>) => {
    const updated = { ...notifications, ...updates };
    setNotifications(updated);
    saveSettings(updated);
  };

  const updateAuthSettings = (updates: Partial<typeof authSettings>) => {
    const updated = { ...authSettings, ...updates };
    setAuthSettings(updated);
    saveSettings(notifications, updated);
  };

  const toggleVisualEffect = (key: keyof typeof visualEffects) => {
    const updated = { ...visualEffects, [key]: !visualEffects[key] };
    setVisualEffects(updated);
    saveSettings(notifications, updated);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: 'Password must be at least 6 characters' });
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordStatus({ type: null, message: '' });

    try {
      const user = auth.currentUser;
      if (user) {
        await updatePassword(user, newPassword);
        setPasswordStatus({ type: 'success', message: 'Password updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (error: any) {
      if (error.code === 'auth/requires-recent-login') {
        setPasswordStatus({ type: 'error', message: 'For security, please sign out and sign back in before changing your password.' });
      } else {
        setPasswordStatus({ type: 'error', message: error.message });
      }
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20 text-[#5A5A40] font-black uppercase tracking-widest text-xs">Synchronizing Vault...</div>;

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-10">
      {/* Premium & Guidance Section */}
      <div className="bg-[#5A5A40] rounded-3xl p-8 text-white shadow-xl shadow-[#5A5A40]/30 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="text-white/60" size={24} />
            <h3 className="text-2xl font-serif font-black tracking-tight">Elite</h3>
          </div>
          <p className="text-white/80 text-sm leading-relaxed mb-6 max-w-sm italic">
            Unlock professional aesthetics and advanced environmental effects.
          </p>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setIsStoreOpen(true)}
              className="px-6 py-3 bg-white text-[#5A5A40] rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-gray-100 transition-all shadow-lg flex items-center gap-2"
            >
              <Sparkles size={14} />
              Store
            </button>
            <button 
              onClick={() => {
                localStorage.removeItem('farmpilot_onboarding_v2');
                window.location.reload();
              }}
              className="px-6 py-3 bg-[#4A4A30] text-white border border-white/20 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-[#3A3A20] transition-all flex items-center gap-2"
            >
              <BookOpen size={14} />
              Tour
            </button>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl transition-transform group-hover:scale-110" />
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Moon className="text-[#5A5A40]" size={18} />
          <h3 className="text-lg font-serif font-bold text-[#1a1a1a]">Aesthetic</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => { setTheme('light'); saveSettings(notifications, authSettings, visualEffects, 'light'); }}
            className={cn(
              "p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2",
              theme === 'light' ? "border-[#5A5A40] bg-[#5A5A40]/5" : "border-gray-100 hover:border-gray-200"
            )}
          >
            <Sun size={24} className={theme === 'light' ? "text-[#5A5A40]" : "text-gray-300"} />
            <span className="text-[9px] font-black uppercase tracking-widest">Heritage</span>
          </button>
          <button 
            disabled
            className="p-4 rounded-2xl border-2 border-gray-100 transition-all flex flex-col items-center gap-2 opacity-40 cursor-not-allowed group relative"
          >
            <Moon size={24} className="text-gray-300" />
            <span className="text-[9px] font-black uppercase tracking-widest text-gray-300">Midnight</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="text-[#5A5A40]" size={18} />
          <h3 className="text-lg font-serif font-bold text-[#1a1a1a]">Notifications</h3>
        </div>
        
        <div className="space-y-4">
          <ToggleItem 
            title="Low Feed Alerts" 
            description="Get notified when feed inventory drops below threshold."
            active={notifications.lowFeed}
            onToggle={() => toggleNotification('lowFeed')}
          />
          <ToggleItem 
            title="Expiring Medicine" 
            description="Alerts for medicine reaching expiration dates."
            active={notifications.expiringMedicine}
            onToggle={() => toggleNotification('expiringMedicine')}
          />
          <ToggleItem 
            title="Production Drops" 
            description="Notifications if egg or milk production decreases significantly."
            active={notifications.productionDrops}
            onToggle={() => toggleNotification('productionDrops')}
          />
          <ToggleItem 
            title="Mortality Alerts" 
            description="Immediate alerts for any reported livestock deaths."
            active={notifications.mortalityAlerts}
            onToggle={() => toggleNotification('mortalityAlerts')}
          />
        </div>

        <div className="mt-6 pt-6 border-t border-gray-50 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Smartphone className="text-[#5A5A40]" size={16} />
            <h4 className="font-bold text-gray-900 text-sm">Schedule</h4>
          </div>
          
          <ToggleItem 
            title="Automated Email Reminders" 
            description="Send scheduled reminders (vaccinations, breeding) to email."
            active={notifications.emailSchedules}
            onToggle={() => toggleNotification('emailSchedules')}
          />

          {notifications.emailSchedules && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 pl-4 border-l-2 border-gray-100"
            >
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Notification Email</label>
                <input 
                  type="email"
                  placeholder={auth.currentUser?.email || "Enter notification email"}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-medium"
                  value={notifications.notificationEmail}
                  onChange={e => updateDetailedNotification({ notificationEmail: e.target.value })}
                />
                <p className="text-[10px] text-gray-400 mt-1 italic">Defaults to your account email if empty.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Reminder Lead Time: {notifications.reminderBuffer} Days</label>
                <input 
                  type="range"
                  min="1"
                  max="30"
                  className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#5A5A40]"
                  value={notifications.reminderBuffer}
                  onChange={e => updateDetailedNotification({ reminderBuffer: parseInt(e.target.value) })}
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold px-1">
                  <span>1 DAY</span>
                  <span>15 DAYS</span>
                  <span>30 DAYS</span>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  onClick={() => window.dispatchEvent(new CustomEvent('trigger-schedule'))}
                  className="w-full py-3 bg-gray-50 border border-gray-100 text-[#5A5A40] rounded-xl font-bold text-xs hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                  <Mail size={16} />
                  Force Review & Dispatch Now
                </button>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Manually triggers a check for upcoming tasks and sends a report to {notifications.notificationEmail || auth.currentUser?.email}.</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 mb-6">
          <Eye className="text-[#5A5A40]" size={24} />
          <h3 className="text-xl font-serif font-bold text-[#1a1a1a]">Visual Experience</h3>
        </div>
        <div className="space-y-4">
          <ToggleItem 
            title="Interactive Click Effects" 
            description="Show falling flower petals when clicking empty spaces."
            active={visualEffects.interactiveClicks}
            onToggle={() => toggleVisualEffect('interactiveClicks')}
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="text-[#5A5A40]" size={18} />
          <h3 className="text-lg font-serif font-bold text-[#1a1a1a]">Security</h3>
        </div>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-2xl space-y-3">
             <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">OTP for Edits</p>
                  <p className="text-[10px] text-gray-500">Authorization code required for updates.</p>
                </div>
                <button 
                  onClick={() => updateAuthSettings({ requireAuthForEdits: !authSettings.requireAuthForEdits })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${authSettings.requireAuthForEdits ? 'bg-[#5A5A40]' : 'bg-gray-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${authSettings.requireAuthForEdits ? 'left-7' : 'left-1'}`} />
                </button>
             </div>
             <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">OTP Delivery Method</label>
                <div className="flex gap-2">
                   <button 
                    onClick={() => updateAuthSettings({ otpMethod: 'email' })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${authSettings.otpMethod === 'email' ? 'bg-[#5A5A40] text-white' : 'bg-white border border-gray-200 text-gray-400'}`}
                   >
                     Email
                   </button>
                   <button 
                    onClick={() => updateAuthSettings({ otpMethod: 'sms' })}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${authSettings.otpMethod === 'sms' ? 'bg-[#5A5A40] text-white' : 'bg-white border border-gray-200 text-gray-400'}`}
                   >
                     SMS
                   </button>
                </div>
             </div>
             {authSettings.otpMethod === 'sms' && (
               <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Phone Number</label>
                  <input 
                    type="tel"
                    placeholder="+254 700 000000"
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-[#5A5A40] outline-none text-sm font-bold"
                    value={authSettings.phoneNumber}
                    onChange={e => updateAuthSettings({ phoneNumber: e.target.value })}
                    onBlur={() => updateAuthSettings({})}
                  />
               </div>
             )}
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
            <div>
              <p className="text-sm font-medium text-gray-900">2FA</p>
              <p className="text-[10px] text-gray-500">Extra layer of security.</p>
            </div>
            <button className="px-3 py-1.5 bg-gray-200 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest">Enable</button>
          </div>

          {auth.currentUser?.providerData.some(p => p.providerId === 'password') && (
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <Lock size={14} className="text-[#5A5A40]" />
                <h4 className="font-bold text-gray-900 text-sm">Passkey</h4>
              </div>
              
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-0.5">New</label>
                    <input 
                      required
                      type="password"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#5A5A40] outline-none text-xs"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-black text-gray-400 uppercase mb-0.5">Confirm</label>
                    <input 
                      required
                      type="password"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-1 focus:ring-[#5A5A40] outline-none text-xs"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>

                {passwordStatus.type && (
                  <div className={`flex items-center gap-2 p-2 rounded-lg text-[10px] ${
                    passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                  }`}>
                    {passwordStatus.type === 'success' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                    <p>{passwordStatus.message}</p>
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full py-2 bg-[#5A5A40] text-white rounded-lg font-black text-[10px] uppercase tracking-widest hover:bg-[#4A4A30] transition-colors disabled:opacity-50"
                >
                  {isUpdatingPassword ? 'Updating...' : 'Update'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
      
      <PremiumThemeStore isOpen={isStoreOpen} onClose={() => setIsStoreOpen(false)} />
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

function ToggleItem({ title, description, active, onToggle }: any) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-900 leading-none mb-1">{title}</p>
        <p className="text-[10px] text-gray-500 leading-tight">{description}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`w-10 h-5 rounded-full transition-colors relative ${active ? 'bg-[#5A5A40]' : 'bg-gray-300'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${active ? 'left-5.5' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
