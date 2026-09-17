import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import LandingLogin from './screens/LandingLogin';
import UploadReport from './screens/UploadReport';
import MyReports from './screens/MyReports';
import ReportDetail from './screens/ReportDetail';
import OfficerDashboard from './screens/OfficerDashboard';
import { authApi } from './api';
import { LanguageProvider } from './context/LanguageContext';

export default function App() {
  const [activeScreen, setActiveScreen] = useState('landing');
  const [selectedReportId, setSelectedReportId] = useState(null);
  const [justSubmittedId, setJustSubmittedId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // Check existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('dumpsense_token');
    if (token) {
      authApi.getMe()
        .then((user) => {
          setCurrentUser(user);
          // Set appropriate landing screen depending on role
          if (user.role === 'officer') {
            setActiveScreen('officer');
          } else {
            setActiveScreen('upload');
          }
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
    // Part 2E: Role-based redirect
    if (data.role === 'officer') {
      setActiveScreen('officer');
    } else {
      setActiveScreen('upload');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('dumpsense_token');
    setCurrentUser(null);
    setActiveScreen('landing');
  };

  const handleSelectReport = (id) => {
    setSelectedReportId(id);
    setActiveScreen('detail');
  };

  const handleReportSuccess = (reportId) => {
    setJustSubmittedId(reportId);
    setActiveScreen('my_reports');
  };

  // Safe navigation with strict role guards (Part 2B)
  const setScreenGuarded = (screen) => {
    if (screen === 'officer' && currentUser?.role === 'citizen') {
      setActiveScreen('my_reports');
      return;
    }
    if ((screen === 'upload' || screen === 'my_reports') && currentUser?.role === 'officer') {
      setActiveScreen('officer');
      return;
    }
    setActiveScreen(screen);
  };

  return (
    <LanguageProvider>
      <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent selection:text-white">
        {/* Top Navbar adhering to #1E293B */}
        <Navbar
          activeScreen={activeScreen}
          setActiveScreen={setScreenGuarded}
          currentUser={currentUser}
          onLogout={handleLogout}
        />

        {/* Main Content Body */}
        <main className="flex-1 flex flex-col interactive-transition">
          {activeScreen === 'landing' && (
            <LandingLogin
              onLoginSuccess={handleLoginSuccess}
            />
          )}

          {activeScreen === 'upload' && (
            <UploadReport
              onReportSuccess={handleReportSuccess}
            />
          )}

          {activeScreen === 'my_reports' && (
            <MyReports
              currentUser={currentUser}
              justSubmittedId={justSubmittedId}
              onNavigateReport={() => setActiveScreen('upload')}
            />
          )}

          {activeScreen === 'detail' && (
            <ReportDetail
              reportId={selectedReportId}
              onBack={() => {
                if (currentUser?.role === 'officer') {
                  setActiveScreen('officer');
                } else {
                  setActiveScreen('my_reports');
                }
              }}
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
    </LanguageProvider>
  );
}
