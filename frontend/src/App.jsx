import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingLogin from './screens/LandingLogin';
import UploadReport from './screens/UploadReport';
import LiveMap from './screens/LiveMap';
import ReportDetail from './screens/ReportDetail';
import OfficerDashboard from './screens/OfficerDashboard';
import { authApi } from './api';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('landing');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('dumpsense_token');
    if (token) {
      authApi.getMe()
        .then((user) => {
          setCurrentUser(user);
        })
        .catch(() => {
          localStorage.removeItem('dumpsense_token');
          setCurrentUser(null);
        });
    }
  }, []);

  const handleLoginSuccess = (data) => {
    setCurrentUser({
      id: data.user_id,
      email: data.email,
      role: data.role,
      trust_score: data.trust_score,
    });
    // If officer, go to dashboard; if citizen, go to live map
    if (data.role === 'officer') {
      setActiveScreen('officer');
    } else {
      setActiveScreen('map');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dumpsense_token');
    setCurrentUser(null);
    setActiveScreen('landing');
  };

  const handleQuickSwitchRole = async () => {
    const targetRole = currentUser?.role === 'officer' ? 'citizen' : 'officer';
    const email = targetRole === 'officer' ? 'officer@dumpsense.ai' : 'citizen@dumpsense.ai';
    try {
      const data = await authApi.login(email, 'password123');
      localStorage.setItem('dumpsense_token', data.access_token);
      setCurrentUser({
        id: data.user_id,
        email: data.email,
        role: data.role,
        trust_score: data.trust_score,
      });
      if (targetRole === 'officer') {
        setActiveScreen('officer');
      } else {
        setActiveScreen('map');
      }
    } catch (e) {
      console.error('Role switch failed:', e);
    }
  };

  const handleSelectReport = (id) => {
    setSelectedReportId(id);
    setActiveScreen('detail');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent selection:text-white">
      {/* Top Navbar adhering to #1E293B */}
      <Navbar
        activeScreen={activeScreen}
        setActiveScreen={setActiveScreen}
        currentUser={currentUser}
        onLogout={handleLogout}
        onQuickSwitchRole={handleQuickSwitchRole}
      />

      {/* Main Content Body with smooth screen transitions */}
      <main className="flex-1 flex flex-col interactive-transition">
        {activeScreen === 'landing' && (
          <LandingLogin
            onLoginSuccess={handleLoginSuccess}
            onExploreMap={() => setActiveScreen('map')}
          />
        )}

        {activeScreen === 'upload' && (
          <UploadReport
            onReportSuccess={() => {}}
            onViewMap={() => setActiveScreen('map')}
          />
        )}

        {activeScreen === 'map' && (
          <LiveMap
            onSelectReport={handleSelectReport}
          />
        )}

        {activeScreen === 'detail' && (
          <ReportDetail
            reportId={selectedReportId}
            onBack={() => setActiveScreen('map')}
            currentUser={currentUser}
            onReportUpdated={() => {}}
          />
        )}

        {activeScreen === 'officer' && (
          <OfficerDashboard
            onSelectReport={handleSelectReport}
          />
        )}
      </main>
    </div>
  );
}
