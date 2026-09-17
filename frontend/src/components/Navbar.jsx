import React from 'react';
import { Flame, MapPin, PlusCircle, ShieldAlert, Sparkles, User, LogOut, Shield } from 'lucide-react';

export default function Navbar({ activeScreen, setActiveScreen, currentUser, onLogout, onQuickSwitchRole }) {
  return (
    <header className="bg-header text-white sticky top-0 z-50 shadow-md border-b border-slate-700/50">
      <div className="max-w-app mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Left: Brand / Logo */}
        <div 
          onClick={() => setActiveScreen('landing')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-element bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:scale-105 transition-transform duration-smooth">
            <Flame className="w-6 h-6 text-accent animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-white">DumpSense</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-accent/20 text-accent border border-accent/30 font-medium">AI</span>
            </div>
            <p className="text-[11px] text-slate-400 font-normal leading-none hidden sm:block">Coimbatore Waste & Burn Intelligence</p>
          </div>
        </div>

        {/* Center: Navigation tabs */}
        <nav className="hidden md:flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-element border border-slate-700/60" aria-label="Main Navigation">
          <button
            onClick={() => setActiveScreen('map')}
            className={`px-3 py-1.5 rounded-element text-xs font-medium flex items-center gap-2 transition-all duration-smooth ${
              activeScreen === 'map' 
                ? 'bg-accent text-white shadow-sm font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            Live Map
          </button>

          <button
            onClick={() => setActiveScreen('upload')}
            className={`px-3 py-1.5 rounded-element text-xs font-medium flex items-center gap-2 transition-all duration-smooth ${
              activeScreen === 'upload' 
                ? 'bg-accent text-white shadow-sm font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            Report Incident
          </button>

          <button
            onClick={() => setActiveScreen('officer')}
            className={`px-3 py-1.5 rounded-element text-xs font-medium flex items-center gap-2 transition-all duration-smooth ${
              activeScreen === 'officer' 
                ? 'bg-accent text-white shadow-sm font-semibold' 
                : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Officer Dashboard
          </button>
        </nav>

        {/* Right: User status & Quick Demo Role Switcher */}
        <div className="flex items-center gap-2.5">
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-2.5 py-1 rounded-element">
                <div className={`w-2 h-2 rounded-full ${currentUser.role === 'officer' ? 'bg-status-safe' : 'bg-accent'}`} />
                <span className="text-xs text-slate-200 capitalize font-medium hidden sm:inline">
                  {currentUser.role}
                </span>
                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">
                  ★ {currentUser.trust_score ?? 10}
                </span>
              </div>

              {/* Quick Switch for Demo Judges */}
              <button
                onClick={onQuickSwitchRole}
                title="Switch between Citizen and Ward Officer demo profiles"
                className="hidden lg:flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-2.5 py-1 rounded-element border border-slate-700 transition-colors"
              >
                <Shield className="w-3 h-3 text-accent" />
                Switch to {currentUser.role === 'officer' ? 'Citizen' : 'Officer'}
              </button>

              <button
                onClick={onLogout}
                aria-label="Logout"
                title="Logout"
                className="p-1.5 rounded-element text-slate-400 hover:text-status-confirmed hover:bg-slate-800 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setActiveScreen('landing')}
              className="px-3.5 py-1.5 rounded-element text-xs font-semibold bg-accent text-white hover:bg-accent-hover transition-colors shadow-sm"
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile navigation bar */}
      <div className="flex md:hidden border-t border-slate-800 bg-slate-900/90 px-2 py-1.5 justify-around">
        <button
          onClick={() => setActiveScreen('map')}
          className={`flex flex-col items-center py-1 px-3 text-[11px] rounded-element ${
            activeScreen === 'map' ? 'text-accent font-semibold' : 'text-slate-400'
          }`}
        >
          <MapPin className="w-4 h-4 mb-0.5" />
          Live Map
        </button>
        <button
          onClick={() => setActiveScreen('upload')}
          className={`flex flex-col items-center py-1 px-3 text-[11px] rounded-element ${
            activeScreen === 'upload' ? 'text-accent font-semibold' : 'text-slate-400'
          }`}
        >
          <PlusCircle className="w-4 h-4 mb-0.5" />
          Report
        </button>
        <button
          onClick={() => setActiveScreen('officer')}
          className={`flex flex-col items-center py-1 px-3 text-[11px] rounded-element ${
            activeScreen === 'officer' ? 'text-accent font-semibold' : 'text-slate-400'
          }`}
        >
          <ShieldAlert className="w-4 h-4 mb-0.5" />
          Dashboard
        </button>
      </div>
    </header>
  );
}
