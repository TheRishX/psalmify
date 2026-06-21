import React, { useState, useEffect } from 'react';
import { db, auth, googleProvider, handleFirestoreError, OperationType } from '../utils/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { signInWithPopup } from 'firebase/auth';
import { 
  User, Check, ShieldCheck, Mail, Phone, MapPin, 
  Church, FileText, Loader2, Sparkles, AlertCircle
} from 'lucide-react';

interface ProfileData {
  uid: string;
  email: string;
  displayName: string;
  churchName: string;
  churchLocation: string;
  phoneNumber: string;
  additionalData: string;
  updatedAt?: string;
}

interface ProfileTabProps {
  user: any;
  onRefreshUser?: () => void;
}

export default function ProfileTab({ user }: ProfileTabProps) {
  const [profile, setProfile] = useState<ProfileData>({
    uid: '',
    email: '',
    displayName: '',
    churchName: '',
    churchLocation: '',
    phoneNumber: '',
    additionalData: '',
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch / load user profile from Firestore
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const profileDocRef = doc(db, 'user_profiles', user.uid);
        const docSnap = await getDoc(profileDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data() as ProfileData;
          setProfile({
            uid: data.uid || user.uid,
            email: data.email || user.email || '',
            displayName: data.displayName || user.displayName || '',
            churchName: data.churchName || '',
            churchLocation: data.churchLocation || '',
            phoneNumber: data.phoneNumber || '',
            additionalData: data.additionalData || '',
          });
        } else {
          // Default profile if newly joined
          setProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            churchName: '',
            churchLocation: '',
            phoneNumber: '',
            additionalData: '',
          });
        }
      } catch (err: any) {
        console.error('Error fetching user profile:', err);
        setErrorMsg('Could not fetch profile. If you just set up, rules might be deploying.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      console.error("Sign-In failed:", e);
      alert("Authentication error: " + e.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSaveSuccess(false);
    setErrorMsg('');

    try {
      const profileDocRef = doc(db, 'user_profiles', user.uid);
      const payload = {
        ...profile,
        uid: user.uid,
        email: user.email || profile.email,
        updatedAt: new Date().toISOString()
      };

      await setDoc(profileDocRef, payload, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `user_profiles/${user.uid}`);
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setErrorMsg(err.message || 'Error occurred while updating profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof ProfileData, value: string) => {
    setProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // 1. NOT AUTHENTICATED STATE
  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12" id="unauthenticated-profile-view">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-8 text-center space-y-6 shadow-sm">
          <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-white mx-auto shadow-sm">
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Your Worship Identity</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Create your personal profile to store your church details, locations, and activate customized title templates inside the PowerPoint companion.
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full py-3 bg-slate-900 border border-slate-950 hover:bg-slate-850 text-white rounded-2xl text-xs font-mono font-bold flex items-center justify-center gap-2 transition cursor-pointer shadow-sm active:scale-[0.99]"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
            </svg>
            <span>Connect via Google Auth</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. LOADING STATE
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4" id="profile-loading-panel">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        <span className="text-xs font-mono text-slate-400">Loading Profile Data from Cloud Firestore...</span>
      </div>
    );
  }

  // 3. EDITABLE PROFILE STATE
  return (
    <div className="max-w-2xl mx-auto my-6" id="authenticated-profile-view">
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-sm space-y-8">
        
        {/* Dynamic header banner info */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-xs relative flex-shrink-0">
              <User className="w-6 h-6" />
              <span className="absolute -bottom-1 -right-1 p-0.5 bg-emerald-500 rounded-full border-2 border-white">
                <Check className="w-2.5 h-2.5 text-white" />
              </span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">Your Worship Profile</h2>
              <p className="text-xs text-slate-400 font-mono">Manage default settings, templates & location details</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 border border-slate-200 text-[10px] font-mono font-bold text-slate-600 rounded-xl">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Verified User Account</span>
          </span>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs flex items-center gap-2.5 font-mono">
            <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* First Name Display Field */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Bro. David Matthew"
                  value={profile.displayName}
                  onChange={(e) => handleChange('displayName', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-slate-400 focus:bg-white rounded-xl outline-none transition font-sans"
                />
              </div>
            </div>

            {/* Email (Read only) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  disabled
                  value={profile.email}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-100 border border-slate-200 text-slate-400 rounded-xl outline-none cursor-not-allowed font-mono"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Church Name */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Church Affiliation Name</label>
              <div className="relative">
                <Church className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Grace Fellowship Church"
                  value={profile.churchName}
                  onChange={(e) => handleChange('churchName', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-slate-400 focus:bg-white rounded-xl outline-none transition font-sans"
                />
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Church Location / Region</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="e.g. North Delhi, India"
                  value={profile.churchLocation}
                  onChange={(e) => handleChange('churchLocation', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-slate-400 focus:bg-white rounded-xl outline-none transition font-sans"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Phone Number */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Contact Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="e.g. +91 98765 43210"
                  value={profile.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-slate-400 focus:bg-white rounded-xl outline-none transition font-mono"
                />
              </div>
            </div>

            {/* Other / Additional description details */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold text-slate-550 uppercase tracking-widest block">Your Role / Ministry Title</label>
              <div className="relative">
                <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="e.g. Main Choir Director, Worship Pastor"
                  value={profile.additionalData}
                  onChange={(e) => handleChange('additionalData', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 text-xs bg-slate-50 border border-slate-200/90 focus:border-slate-400 focus:bg-white rounded-xl outline-none transition font-sans"
                />
              </div>
            </div>
          </div>

          {/* Sync callout to show usefulness */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex gap-3">
            <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0 animate-pulse" />
            <p className="text-[11px] text-slate-550 leading-relaxed font-mono">
              💡 <strong>Instant Presentation Integration:</strong> Your registered <strong>Church Name</strong> is compiled dynamically as the primary presentation host in the <strong>PPT Editor tab</strong> first slide.
            </p>
          </div>

          {/* Submission and Saving Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            {saveSuccess && (
              <span className="text-emerald-600 text-xs font-mono font-bold flex items-center gap-1 animate-fade-in">
                <Check className="w-4 h-4" /> Profile Persistent Saved!
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-slate-900 border border-slate-950 hover:bg-slate-850 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl shadow-md transition cursor-pointer flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <span>Save Profile Settings</span>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
