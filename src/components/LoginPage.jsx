// src/components/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { FaMobileAlt, FaUserTie, FaChevronRight, FaExclamationTriangle, FaTimes } from 'react-icons/fa';
import { supabase } from '../supabaseClient'; 
import duroplyLogo from './image8.png'; 
import './LoginStyles.css';

const LoginPage = ({ onLoginSuccess }) => {
  const [mobile, setMobile] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  // Tracks why access was blocked: 'not_registered' or 'ineligible'
  const [denialReason, setDenialReason] = useState(''); 

  useEffect(() => {
    const savedArchitect = localStorage.getItem('architect_session');
    if (savedArchitect) {
      try {
        const parsedArchitect = JSON.parse(savedArchitect);
        if (parsedArchitect && parsedArchitect.mobile_number) {
          if (onLoginSuccess) onLoginSuccess(parsedArchitect);
        }
      } catch (e) {
        localStorage.removeItem('architect_session');
      }
    }
  }, [onLoginSuccess]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    
    const cleanMobile = mobile.trim();
    if (!cleanMobile) {
      setError('Mobile number is required to proceed');
      return;
    }

    setLoading(true);

    try {
      // 1. Locate the master architect profile (Removed is_active check)
      const { data: architectData, error: dbError } = await supabase
        .from('master_architect')
        .select('*')
        .eq('mobile_number', cleanMobile)
        .maybeSingle();

      if (dbError) throw dbError;

      if (!architectData) {
        setDenialReason('not_registered');
        setShowModal(true);
        setLoading(false);
        return;
      }

      // 2. Extract account number and verify ledger eligibility
      const targetAccountNumber = architectData.account_number;
      
      if (!targetAccountNumber) {
        setError('Profile error: Associated account number not found.');
        setLoading(false);
        return;
      }

      // Queries rows where architect_name contains the account number string (e.g. "2511001131 | Rajusharma")
      const { data: ledgerRows, error: ledgerError } = await supabase
        .from('commission_ledger')
        .select('status, architect_name')
        .ilike('architect_name', `%${targetAccountNumber}%`);

      if (ledgerError) throw ledgerError;

      // Check if any matching ledger record is confirmed as 'eligible'
      const isEligibleUser = ledgerRows && ledgerRows.length > 0 && ledgerRows.some(
        row => row.status && row.status.trim().toLowerCase() === 'eligible'
      );

      if (!isEligibleUser) {
        setDenialReason('ineligible');
        setShowModal(true);
        setLoading(false);
        return;
      }

      // 3. Update the last_login timestamp on successful clearance
      const { error: updateError } = await supabase
        .from('master_architect')
        .update({ last_login: new Date().toISOString() }) 
        .eq('mobile_number', cleanMobile);

      if (updateError) {
        console.error('Failed to update last_login:', updateError);
      }

      // 4. Proceed with successful portal entry
      if (onLoginSuccess) {
        onLoginSuccess(architectData);
      }

    } catch (err) {
      console.error('Authentication process exception:', err);
      setError('A connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="full-page-wrapper">
      <div className="split-container">
        <div className="left-brand-pane">
          <div className="brand-overlay-content">
            <div className="brand-badge">
              <span className="badge-text">D+</span>
            </div>
            <div className="architect-carving-card">
              <div className="carving-symbol-wrapper">
                <FaUserTie className="carving-icon" />
              </div>
              <h1 className="carving-main-title">Duroply Architect</h1>
              <p className="carving-sub-title">Program Info View</p>
            </div>
            <ul className="feature-list">
              <li><span className="bullet">▪</span> Auto-validation registry module</li>
              <li><span className="bullet">▪</span> Live premium architect dashboard access</li>
              <li><span className="bullet">▪</span> Tier-based program analytic tracking</li>
              <li><span className="bullet">▪</span> Instant project credentials processing</li>
            </ul>
          </div>
          <div className="pane-footer">
            © 2026 DUROPLY INDUSTRIES LTD. • v4.0
          </div>
        </div>

        <div className="right-form-pane">
          <div className="top-logo-row">
            <img src={duroplyLogo} alt="Duroply Logo" className="brand-logo-img" />
          </div>

          <div className="form-header">
            <h2>Welcome back</h2>
            <p>Sign in to access your secure architect portal</p>
          </div>

          <form onSubmit={handleSignIn} noValidate>
            <div className="custom-input-group">
              <label className="input-label">REGISTERED MOBILE NUMBER</label>
              <div className={`input-wrapper ${error ? 'input-error-border' : ''}`}>
                <FaMobileAlt className="field-icon" />
                <input 
                  type="tel" 
                  placeholder="Enter your registered mobile" 
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="main-input"
                  disabled={loading}
                />
              </div>
              {error && <span className="compulsion-msg">{error}</span>}
            </div>

            <button type="submit" className="action-submit-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Sign In'} <FaChevronRight className="btn-arrow" />
            </button>
          </form>

          <div className="security-notice">
            🔒 Secured connection. Unauthorized access is strictly logged.
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-container warning-modal">
            <button className="modal-close-btn" onClick={() => setShowModal(false)}>
              <FaTimes />
            </button>
            <div className="modal-icon-wrapper">
              <FaExclamationTriangle className="modal-warning-icon" />
            </div>
            <h3 className="modal-title">Access Denied</h3>
            
            {denialReason === 'not_registered' ? (
              <>
                <p className="modal-message">
                  The mobile number <strong>{mobile}</strong> is not registered in our database.
                </p>
                <p className="modal-sub-message">
                  Please check the number or contact your dealer administration to complete your onboarding process.
                </p>
              </>
            ) : (
              <>
                <p className="modal-message">
                  Your profile is registered, but your current payout status is marked as <strong>Ineligible</strong> in the system records.
                </p>
                <p className="modal-sub-message">
                  Access to the console is limited to clear profiles. Please contact your account representative to check your verification ledger status.
                </p>
              </>
            )}

            <button className="modal-action-btn" onClick={() => setShowModal(false)}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;