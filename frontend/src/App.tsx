import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CustomerPortal } from './portals/customer/CustomerPortal';
import { ProviderPortal } from './portals/provider/ProviderPortal';
import { PlatformPortal } from './portals/platform/PlatformPortal';

const AppContent: React.FC = () => {
  const { user, login, registerUser, logout, loading } = useAuth();
  
  // Modal states
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authError, setAuthError] = useState('');

  // Portal view override (e.g. letting admins toggle to Customer view)
  const [viewOverride, setViewOverride] = useState<'customer' | 'admin' | null>(null);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (isRegisterMode) {
      const res = await registerUser(authName, authEmail, authPassword, authPhone);
      if (!res.success) {
        setAuthError(res.error || 'Registration failed');
      } else {
        // Automatically switch to login mode on successful registration
        setIsRegisterMode(false);
        setAuthName('');
        setAuthPhone('');
        setAuthError('✓ Account created! Please log in.');
      }
    } else {
      const res = await login(authEmail, authPassword);
      if (!res.success) {
        setAuthError(res.error || 'Login failed');
      } else {
        setShowAuthModal(false);
        setAuthEmail('');
        setAuthPassword('');
        setAuthError('');
        setViewOverride(null); // Reset override on fresh login
      }
    }
  };

  const renderActivePortal = () => {
    if (loading) {
      return (
        <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column' }}>
          <div style={{ border: '4px solid var(--border)', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Synchronizing secure sessions...</p>
        </div>
      );
    }

    // Handle role override preview
    if (viewOverride === 'customer') {
      return <CustomerPortal />;
    }

    if (!user) {
      return <CustomerPortal />;
    }

    switch (user.role) {
      case 'CUSTOMER':
        return <CustomerPortal />;
      case 'PROVIDER_ADMIN':
      case 'STAFF':
        return <ProviderPortal />;
      case 'PLATFORM_ADMIN':
        return <PlatformPortal />;
      default:
        return <CustomerPortal />;
    }
  };

  return (
    <div>
      {/* Top Navbar */}
      <nav className="navbar">
        <div className="logo-container">
          <span>🌱</span> BookFlow
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          {user && (user.role === 'PROVIDER_ADMIN' || user.role === 'PLATFORM_ADMIN' || user.role === 'STAFF') && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setViewOverride(viewOverride === 'customer' ? 'admin' : 'customer')}
                className="btn btn-outline-primary"
                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
              >
                {viewOverride === 'customer' ? '👁 View Admin Console' : '👁 Preview Shop View'}
              </button>
            </div>
          )}

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ textAlign: 'right', fontSize: '0.8rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{user.name}</div>
                <div style={{ color: 'var(--text-muted)' }}>{user.role.replace('_', ' ')}</div>
              </div>
              <button onClick={logout} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={() => { setShowAuthModal(true); setIsRegisterMode(false); setAuthError(''); }} className="btn btn-primary">
              Sign In / Register
            </button>
          )}
        </div>
      </nav>

      {/* Main Body view */}
      <div className="container" style={{ marginTop: '30px' }}>
        {renderActivePortal()}
      </div>

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="flex-center" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000 }}>
          <div className="card animate-scale-in" style={{ width: '100%', maxWidth: '420px', position: 'relative' }}>
            <button
              onClick={() => setShowAuthModal(false)}
              style={{ position: 'absolute', top: '15px', right: '15px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.25rem' }}
            >
              ✕
            </button>
            
            <h2 style={{ textAlign: 'center', marginBottom: '20px', fontWeight: 800 }}>
              {isRegisterMode ? 'Create Customer Account' : 'Sign In to BookFlow'}
            </h2>

            <form onSubmit={handleAuthSubmit}>
              {isRegisterMode && (
                <>
                  <div className="form-group">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={authPhone}
                      placeholder="+15550009999"
                      onChange={(e) => setAuthPhone(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input
                  type="email"
                  className="form-control"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
              </div>

              {authError && (
                <div style={{
                  color: authError.startsWith('✓') ? 'var(--success)' : 'var(--danger)',
                  marginBottom: '15px',
                  fontWeight: 'bold',
                  fontSize: '0.85rem'
                }}>
                  {authError}
                </div>
              )}

              <button type="submit" className="btn btn-primary w-full">
                {isRegisterMode ? 'Complete Registration' : 'Secure Login'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {isRegisterMode ? (
                <p>
                  Already have an account?{' '}
                  <span
                    onClick={() => { setIsRegisterMode(false); setAuthError(''); }}
                    style={{ color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Sign In
                  </span>
                </p>
              ) : (
                <p>
                  New to BookFlow?{' '}
                  <span
                    onClick={() => { setIsRegisterMode(true); setAuthError(''); }}
                    style={{ color: 'var(--primary)', fontWeight: 'bold', cursor: 'pointer' }}
                  >
                    Register here
                  </span>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
