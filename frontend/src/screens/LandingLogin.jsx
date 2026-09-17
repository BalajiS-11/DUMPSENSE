import React, { useState } from 'react';
import { Flame, Shield, ArrowRight, Lock, Mail, Activity, AlertTriangle } from 'lucide-react';
import { authApi } from '../api';
import { useLanguage } from '../context/LanguageContext';

export default function LandingLogin({ onLoginSuccess }) {
  const { t } = useLanguage();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('citizen');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      let data;
      if (isRegister) {
        data = await authApi.register(email, password, role);
      } else {
        data = await authApi.login(email, password);
      }
      localStorage.setItem('dumpsense_token', data.access_token);
      onLoginSuccess(data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.response?.data?.detail || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoLogin = async (demoRole) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const demoEmail = demoRole === 'officer' ? 'officer@dumpsense.ai' : 'citizen@dumpsense.ai';
      const data = await authApi.login(demoEmail, 'password123');
      localStorage.setItem('dumpsense_token', data.access_token);
      onLoginSuccess(data);
    } catch (err) {
      console.error(err);
      setErrorMsg('Demo login failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 overflow-hidden">
      
      {/* Subtle Animated Background Grid & Ambient Glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-sky-200/40 filter blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-sky-100/60 filter blur-3xl" />
        <svg className="absolute inset-0 w-full h-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dot_grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1.5" fill="#94A3B8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dot_grid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-app mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
        
        {/* Left column: Lean, High-Impact Hero Copy (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-300/60 text-accent text-xs font-semibold">
            <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
            CIVIC SURVEILLANCE • COIMBATORE
          </div>

          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-red-600 block">
              Critical Municipal Challenge
            </span>
            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
              129 tonnes of untreated waste, <span className="text-red-600 underline decoration-red-200 decoration-4 underline-offset-8">every single day.</span>
            </h1>
          </div>

          {/* Single bold sentence */}
          <p className="text-lg sm:text-xl font-semibold text-slate-800 leading-snug">
            {t('landing_headline')} Coimbatore.
          </p>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-3 gap-3 pt-2 max-w-lg">
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-card border border-slate-200 shadow-sm">
              <span className="text-[11px] text-slate-500 font-medium block">{t('landing_stat1')}</span>
              <span className="text-2xl font-black text-slate-800">1,293 T</span>
            </div>
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-card border border-slate-200 shadow-sm">
              <span className="text-[11px] text-slate-500 font-medium block">{t('landing_stat2')}</span>
              <span className="text-2xl font-black text-status-safe">1,164 T</span>
            </div>
            <div className="bg-white/95 backdrop-blur-sm p-4 rounded-card border border-red-200 shadow-sm bg-red-50/30">
              <span className="text-[11px] text-red-600 font-medium block">{t('landing_stat3')}</span>
              <span className="text-2xl font-black text-status-confirmed">129 T/day</span>
            </div>
          </div>

          {/* Credibility Strip (Part 1E) */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-element bg-slate-900/90 text-slate-200 border border-slate-700/80 text-xs shadow-sm">
              <span className="text-accent font-bold">📋 Data Sources:</span>
              <span className="text-slate-300 font-normal">
                CCMC Commissioner Annexure (Official) · NGT Ruling Sept 2026 · Citizen Reports (Real-time)
              </span>
            </div>
          </div>

        </div>

        {/* Right column: Auth & Demo Login Panel (5 cols) */}
        <div className="lg:col-span-5">
          <div className="bg-white/95 backdrop-blur-md rounded-card border border-slate-200 shadow-2xl p-6 sm:p-8 space-y-5">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {isRegister ? 'Register Citizen Account' : 'Portal Access'}
                </h2>
                <p className="text-xs text-slate-500">
                  {isRegister ? 'Join Coimbatore citizen reporter grid' : 'Sign in as Citizen Reporter or Ward Officer'}
                </p>
              </div>
              <div className="w-9 h-9 rounded-element bg-slate-100 flex items-center justify-center text-slate-700">
                <Lock className="w-4 h-4 text-slate-600" />
              </div>
            </div>

            {/* Fast-Track Demo Switcher for Judges */}
            <div className="bg-slate-50 p-3 rounded-card border border-slate-200 space-y-2">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase block">
                ⚡ EXPO FAST-TRACK (FOR JUDGES)
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin('citizen')}
                  className="px-3 py-2 rounded-element text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs flex items-center justify-center gap-1.5 transition-all duration-smooth active:scale-95"
                >
                  <Flame className="w-3.5 h-3.5 text-status-pending" />
                  Citizen Profile
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickDemoLogin('officer')}
                  className="px-3 py-2 rounded-element text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 shadow-xs flex items-center justify-center gap-1.5 transition-all duration-smooth active:scale-95"
                >
                  <Shield className="w-3.5 h-3.5 text-accent" />
                  Officer Profile
                </button>
              </div>
            </div>

            {/* Error banner */}
            {errorMsg && (
              <div className="p-3 rounded-element bg-red-50 border border-red-200 text-status-confirmed text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@dumpsense.ai"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-element border border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-element border border-slate-300 focus:border-accent focus:ring-1 focus:ring-accent"
                  />
                </div>
              </div>

              {isRegister && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-element border border-slate-300 focus:border-accent"
                  >
                    <option value="citizen">Citizen Reporter</option>
                    <option value="officer">Ward Officer</option>
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-element text-xs font-semibold bg-accent hover:bg-accent-hover text-white shadow-sm flex items-center justify-center gap-2 transition-all duration-smooth active:scale-98 disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isRegister ? 'Create Account' : 'Sign In'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            <div className="text-center pt-1 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setErrorMsg(null);
                }}
                className="text-xs text-accent hover:underline font-medium"
              >
                {isRegister ? 'Already have an account? Sign in' : "New user? Register as citizen"}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
