import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.js';
import { LandingPage } from './pages/LandingPage.js';
import { AudiencePage } from './pages/AudiencePage.js';
import { PresenterViewPage } from './pages/PresenterViewPage.js';
import { HostLoginPage } from './pages/HostLoginPage.js';
import { HostDashboardPage } from './pages/HostDashboardPage.js';
import { HostSessionManagePage } from './pages/HostSessionManagePage.js';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/session/:code" element={<AudiencePage />} />
          <Route path="/presenter/:code" element={<PresenterViewPage />} />
          <Route path="/host/login" element={<HostLoginPage />} />
          <Route path="/host" element={<HostDashboardPage />} />
          <Route path="/host/session/:code" element={<HostSessionManagePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
