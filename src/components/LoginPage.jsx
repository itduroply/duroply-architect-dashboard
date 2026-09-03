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

  // OTP step state
  const [step, setStep] = useState('mobile'); // 'mobile' | 'otp'
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1: mobile number check (same master_architect + commission_ledger
  // eligibility rules as before) now runs inside the architect-send-otp
  // edge function; on success it sends the OTP and moves to the OTP step.
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
      const { data, error: fnError } = await supabase.functions.invoke('architect-send-otp', {
        body: { mobile_number: cleanMobile },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        if (data.denialReason) {
          setDenialReason(data.denialReason);
          setShowModal(true);
        } else {
          setError(data.error || 'Unable to send OTP. Please try again.');
        }
        return;
      }

      setOtp('');
      setOtpError('');
      setStep('otp');
      setResendCooldown(30);
    } catch (err) {
      console.error('Authentication process exception:', err);
      setError('A connection error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: verify the OTP the architect received via SMS
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError('');

    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setOtpError('OTP is required to proceed');
      return;
    }

    setOtpLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('architect-verify-otp', {
        body: { mobile_number: mobile.trim(), otp: cleanOtp },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setOtpError(data.error || 'Invalid OTP. Please try again.');
        return;
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.data);
      }
    } catch (err) {
      console.error('OTP verification exception:', err);
      setOtpError('A connection error occurred. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpError('');
    setOtpLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('architect-send-otp', {
        body: { mobile_number: mobile.trim() },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        setOtpError(data.error || 'Unable to resend OTP. Please try again.');
        return;
      }

      setResendCooldown(30);
    } catch (err) {
      console.error('Resend OTP exception:', err);
      setOtpError('A connection error occurred. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  };

  const handleChangeNumber = () => {
    setStep('mobile');
    setOtp('');
    setOtpError('');
    setResendCooldown(0);
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

          {step === 'mobile' ? (
            <>
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
                  {loading ? 'Sending OTP...' : 'Sign In'} <FaChevronRight className="btn-arrow" />
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="form-header">
                <h2>Verify OTP</h2>
                <p>Enter the code sent to <strong>{mobile}</strong></p>
              </div>

              <form onSubmit={handleVerifyOtp} noValidate>
                <div className="custom-input-group">
                  <label className="input-label">OTP</label>
                  <div className={`input-wrapper ${otpError ? 'input-error-border' : ''}`}>
                    <FaMobileAlt className="field-icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="main-input"
                      disabled={otpLoading}
                    />
                  </div>
                  {otpError && <span className="compulsion-msg">{otpError}</span>}
                </div>

                <button type="submit" className="action-submit-btn" disabled={otpLoading}>
                  {otpLoading ? 'Verifying...' : 'Verify OTP'} <FaChevronRight className="btn-arrow" />
                </button>
              </form>

              <div className="otp-helper-row">
                <button type="button" className="otp-link-btn" onClick={handleChangeNumber} disabled={otpLoading}>
                  Change number
                </button>
                <button
                  type="button"
                  className="otp-link-btn"
                  onClick={handleResendOtp}
                  disabled={otpLoading || resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                </button>
              </div>
            </>
          )}

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