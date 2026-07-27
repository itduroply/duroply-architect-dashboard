import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Layout and Core Screens
import LoginPage from './components/LoginPage';
import MainLayout from './components/MainLayout';
import MainProfile from './components/MainProfile'; // Dashboard View
import Remittance from './components/Remittance';
import Locations from './components/Locations';
import Catalogues from './components/Catalogues';
import Profile from './components/Profile';
import MasterSheet from './components/MasterSheet';
import Query from './components/QueryRaise';
function App() {
  const [userSession, setUserSession] = useState(() => {
    const saved = localStorage.getItem('architect_session');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLoginSuccess = (user) => {
    localStorage.setItem('architect_session', JSON.stringify(user));
    setUserSession(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('architect_session');
    setUserSession(null);
  };

  // Safely extract the valid account identifier
  const activeAccountNumber = userSession 
    ? (userSession.account_number || userSession) 
    : null;

  // Structural Guard Wrapper
  const ProtectedLayout = () => {
    if (!activeAccountNumber) {
      return <Navigate to="/login" replace />;
    }
   return (
    <MainLayout 
      onLogout={handleLogout} 
      account_number={activeAccountNumber} // <-- Add the prop here
    />
  );
  };

  return (
    <Router>
      <Routes>
        {/* Public Login Route */}
        <Route 
          path="/login" 
          element={
            activeAccountNumber ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLoginSuccess={handleLoginSuccess} />
            )
          } 
        />

        {/* System Protected App Tree */}
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<MainProfile account_number={activeAccountNumber} />} />
          <Route path="/remittance" element={<Remittance account_number={activeAccountNumber} />} />
          <Route path="/locations" element={<Locations account_number={activeAccountNumber} />} />
          <Route path="/catalogues" element={<Catalogues account_number={activeAccountNumber} />} />
          <Route path="/profile" element={<Profile account_number={activeAccountNumber} />} />
          <Route path="/master" element={<MasterSheet account_number={activeAccountNumber} />} />
          <Route path="/query" element={<Query account_number={activeAccountNumber} />} />
        </Route>

        {/* Fallback Catch-All Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;