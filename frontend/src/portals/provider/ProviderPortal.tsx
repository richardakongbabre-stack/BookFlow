import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

interface ProviderInfo {
  name: string;
  subscriptionPlan: string;
  status: string;
  staffCount: number;
  servicesCount: number;
  commissionRate: string;
}

interface SummaryStats {
  totalBookings: number;
  pendingBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  monthBookings: number;
  monthBookingsCap: number;
  grossEarnings: string;
  netEarnings: string;
  platformCommissionPaid: string;
}

interface ServiceMetrics {
  name: string;
  bookingsCount: number;
  revenue: number;
}

interface StaffMetrics {
  name: string;
  title: string;
  bookingsCount: number;
}

interface Booking {
  id: string;
  startTime: string;
  status: string;
  totalAmount: string;
  notes?: string;
  customer: { name: string; email: string; phone: string };
  staff: { name: string; title: string };
  service: { name: string; duration: number };
  payments?: Array<{ status: string; gateway: string; transactionId: string }>;
}

interface StaffMember {
  id: string;
  name: string;
  title: string;
  bio: string;
  rating: number;
  user: { email: string };
  schedules: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: string;
  isFeatured: boolean;
}

export const ProviderPortal: React.FC = () => {
  const { user, token, logout } = useAuth();
  
  // Tab control: 'dashboard' | 'bookings' | 'services' | 'staff' | 'schedules' | 'subscription'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'bookings' | 'services' | 'staff' | 'schedules' | 'subscription'>('dashboard');

  // Onboarding states (if owner doesn't have a provider yet)
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [bizName, setBizName] = useState('');
  const [bizSlug, setBizSlug] = useState('');
  const [bizDesc, setBizDesc] = useState('');
  const [bizPhone, setBizPhone] = useState('');
  const [bizEmail, setBizEmail] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [bizPlan, setBizPlan] = useState('FREE');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [onboardError, setOnboardError] = useState('');
  const [onboardSuccess, setOnboardSuccess] = useState(false);

  // Main Dashboard Data
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [servicesMetrics, setServicesMetrics] = useState<ServiceMetrics[]>([]);
  const [staffMetrics, setStaffMetrics] = useState<StaffMetrics[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Lists Management
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Creators states
  const [staffName, setStaffName] = useState('');
  const [staffTitle, setStaffTitle] = useState('');
  const [staffBio, setStaffBio] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffError, setStaffError] = useState('');

  const [serviceName, setServiceName] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState(50);
  const [serviceFeatured, setServiceFeatured] = useState(false);
  const [serviceError, setServiceError] = useState('');

  // Schedule Scheduler States
  const [selectedStaffForSched, setSelectedStaffForSched] = useState<StaffMember | null>(null);
  const [workHours, setWorkHours] = useState<Array<{ dayOfWeek: number; active: boolean; start: string; end: string }>>([
    { dayOfWeek: 1, active: true, start: '09:00', end: '17:00' }, // Mon
    { dayOfWeek: 2, active: true, start: '09:00', end: '17:00' }, // Tue
    { dayOfWeek: 3, active: true, start: '09:00', end: '17:00' }, // Wed
    { dayOfWeek: 4, active: true, start: '09:00', end: '17:00' }, // Thu
    { dayOfWeek: 5, active: true, start: '09:00', end: '17:00' }, // Fri
    { dayOfWeek: 6, active: false, start: '09:00', end: '17:00' }, // Sat
    { dayOfWeek: 0, active: false, start: '09:00', end: '17:00' }, // Sun
  ]);
  const [exceptionDate, setExceptionDate] = useState('');
  const [exceptionWorking, setExceptionWorking] = useState(false);
  const [exceptionStart, setExceptionStart] = useState('09:00');
  const [exceptionEnd, setExceptionEnd] = useState('17:00');
  const [schedMessage, setSchedMessage] = useState('');

  // Fetch Dashboard metrics
  useEffect(() => {
    if (token && user?.providerId) {
      fetchDashboardData();
    }
  }, [token, user?.providerId]);

  // Fetch data lists based on active tabs
  useEffect(() => {
    if (!token || !user?.providerId) return;
    if (activeTab === 'bookings') fetchBookings();
    if (activeTab === 'staff') fetchStaffMembers();
    if (activeTab === 'services') fetchServices();
    if (activeTab === 'schedules') fetchStaffMembers();
  }, [activeTab, token, user?.providerId]);

  const fetchDashboardData = async () => {
    try {
      setLoadingDashboard(true);
      const res = await fetch('/api/admin/provider/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setProviderInfo(data.providerInfo);
        setStats(data.summary);
        setServicesMetrics(data.servicesMetrics || []);
        setStaffMetrics(data.staffMetrics || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDashboard(false);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoadingList(true);
      const res = await fetch('/api/bookings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchStaffMembers = async () => {
    try {
      setLoadingList(true);
      const res = await fetch('/api/providers/staff', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStaffMembers(data);
        if (data.length > 0 && !selectedStaffForSched) {
          selectStaffForSchedule(data[0]);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchServices = async () => {
    try {
      setLoadingList(true);
      const res = await fetch('/api/providers/services', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setServices(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingList(false);
    }
  };

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOnboardError('');
    setOnboardSuccess(false);

    try {
      const res = await fetch('/api/providers/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bizName,
          slug: bizSlug,
          description: bizDesc,
          phone: bizPhone,
          email: bizEmail,
          address: bizAddress,
          subscriptionPlan: bizPlan,
          ownerName,
          ownerEmail,
          ownerPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setOnboardError(data.error || 'Onboarding failed');
      } else {
        setOnboardSuccess(true);
        logout(); // Force login with new credentials
      }
    } catch (err) {
      setOnboardError('Network error during onboarding');
    }
  };

  const handleAddStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffError('');
    try {
      const res = await fetch('/api/providers/staff/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: staffName,
          title: staffTitle,
          bio: staffBio,
          email: staffEmail,
          password: staffPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStaffError(data.error || 'Failed to create staff');
      } else {
        // Reset form
        setStaffName('');
        setStaffTitle('');
        setStaffBio('');
        setStaffEmail('');
        setStaffPassword('');
        fetchStaffMembers();
        fetchDashboardData();
      }
    } catch (err) {
      setStaffError('Network error');
    }
  };

  const handleAddServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServiceError('');
    try {
      const res = await fetch('/api/providers/services/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: serviceName,
          description: serviceDesc,
          duration: Number(serviceDuration),
          price: Number(servicePrice),
          isFeatured: serviceFeatured,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServiceError(data.error || 'Failed to create service');
      } else {
        setServiceName('');
        setServiceDesc('');
        setServiceDuration(30);
        setServicePrice(50);
        setServiceFeatured(false);
        fetchServices();
        fetchDashboardData();
      }
    } catch (err) {
      setServiceError('Network error');
    }
  };

  const selectStaffForSchedule = (staff: StaffMember) => {
    setSelectedStaffForSched(staff);
    // Populate workHours from staff's existing schedules
    const mapped = workHours.map((wh) => {
      const matched = staff.schedules.find((s) => s.dayOfWeek === wh.dayOfWeek);
      if (matched) {
        return { dayOfWeek: wh.dayOfWeek, active: true, start: matched.startTime, end: matched.endTime };
      }
      return { ...wh, active: false };
    });
    setWorkHours(mapped);
    setSchedMessage('');
  };

  const handleSaveSchedule = async () => {
    if (!selectedStaffForSched) return;
    setSchedMessage('');

    // Filter only active schedules to save
    const activeScheds = workHours
      .filter((wh) => wh.active)
      .map((wh) => ({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.start,
        endTime: wh.end,
      }));

    try {
      const res = await fetch(`/api/providers/staff/${selectedStaffForSched.id}/schedule`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ schedules: activeScheds }),
      });

      if (res.ok) {
        setSchedMessage('✓ Schedule template updated successfully.');
        fetchStaffMembers();
      } else {
        const data = await res.json();
        setSchedMessage(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setSchedMessage('❌ Network request error');
    }
  };

  const handleAddException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffForSched || !exceptionDate) return;
    setSchedMessage('');

    try {
      const res = await fetch(`/api/providers/staff/${selectedStaffForSched.id}/exception`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          date: exceptionDate,
          isWorking: exceptionWorking,
          startTime: exceptionWorking ? exceptionStart : undefined,
          endTime: exceptionWorking ? exceptionEnd : undefined,
        }),
      });

      if (res.ok) {
        setSchedMessage('✓ Availability exception date added successfully.');
        setExceptionDate('');
      } else {
        const data = await res.json();
        setSchedMessage(`❌ Exception Error: ${data.error}`);
      }
    } catch (err) {
      setSchedMessage('❌ Network request error');
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!window.confirm('Cancel this customer booking?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        alert('Booking cancelled.');
        fetchBookings();
        fetchDashboardData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePlanUpgrade = async (plan: string) => {
    if (!window.confirm(`Switch your subscription to the ${plan} plan?`)) return;
    try {
      const res = await fetch('/api/providers/subscription', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (res.ok) {
        alert('Subscription updated!');
        fetchDashboardData();
      } else {
        alert(data.error || 'Failed to update plan');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // If the user does not have an active tenant profile
  if (!user?.providerId && !isOnboarding) {
    return (
      <div className="card text-center animate-fade-in-up" style={{ maxWidth: '600px', margin: '60px auto', padding: '40px' }}>
        <span style={{ fontSize: '3rem' }}>🏢</span>
        <h2 style={{ marginTop: '20px', marginBottom: '12px' }}>Start Your Business Portal</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
          Onboard your business, configure salon staff, design service menus, and start scheduling customers.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
          <button onClick={() => setIsOnboarding(true)} className="btn btn-primary">Onboard New Business</button>
          <button onClick={logout} className="btn btn-secondary">Log Out</button>
        </div>
      </div>
    );
  }

  // Register New Provider Panel
  if (isOnboarding) {
    return (
      <div className="card animate-scale-in" style={{ maxWidth: '700px', margin: '40px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h2>Onboard Your Business Platform</h2>
          <button onClick={() => setIsOnboarding(false)} className="btn btn-secondary">Cancel</button>
        </div>

        {onboardSuccess ? (
          <div className="text-center" style={{ color: 'var(--success)', padding: '20px' }}>
            <h3>✓ Business Registered Successfully!</h3>
            <p style={{ color: 'var(--text-main)', marginTop: '10px' }}>
              Your business and administrator accounts are set up. Please log in using your owner email (<strong>{ownerEmail}</strong>) and password.
            </p>
            <button onClick={() => setIsOnboarding(false)} className="btn btn-primary" style={{ marginTop: '20px' }}>Proceed to Log In</button>
          </div>
        ) : (
          <form onSubmit={handleOnboardSubmit}>
            <h4 style={{ color: 'var(--primary)', marginBottom: '10px' }}>1. Business Profile Details</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Business Name</label>
                <input type="text" className="form-control" value={bizName} onChange={(e) => setBizName(e.target.value)} required placeholder="e.g. Sage Beauty Lounge" />
              </div>
              <div className="form-group">
                <label className="form-label">Unique Slug (URL path)</label>
                <input type="text" className="form-control" value={bizSlug} onChange={(e) => setBizSlug(e.target.value)} required placeholder="e.g. sage-beauty" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" className="form-control" value={bizAddress} onChange={(e) => setBizAddress(e.target.value)} placeholder="e.g. 50 Emerald Way" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label className="form-label">Business Email</label>
                <input type="email" className="form-control" value={bizEmail} onChange={(e) => setBizEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Business Phone</label>
                <input type="text" className="form-control" value={bizPhone} onChange={(e) => setBizPhone(e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" value={bizDesc} onChange={(e) => setBizDesc(e.target.value)} rows={2} />
            </div>

            <div className="form-group">
              <label className="form-label">Subscription Tier Plan</label>
              <select className="form-control" value={bizPlan} onChange={(e) => setBizPlan(e.target.value)}>
                <option value="FREE">Free Tier ($0/mo - Capped, email only)</option>
                <option value="STARTER">Starter ($29/mo - 3 staff, 5 services)</option>
                <option value="PROFESSIONAL">Professional ($79/mo - 10 staff, SMS enabled)</option>
                <option value="ENTERPRISE">Enterprise ($199/mo - Unlimited, 3% commission)</option>
              </select>
            </div>

            <h4 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '10px' }}>2. Business Owner Administrator Account</h4>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input type="text" className="form-control" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div className="form-group">
                <label className="form-label">Owner Login Email</label>
                <input type="email" className="form-control" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Owner Account Password</label>
                <input type="password" className="form-control" value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)} required />
              </div>
            </div>

            {onboardError && <div style={{ color: 'var(--danger)', marginBottom: '15px', fontWeight: 'bold' }}>❌ {onboardError}</div>}

            <button type="submit" className="btn btn-primary w-full">Complete Onboarding & Set Up Salon</button>
          </form>
        )}
      </div>
    );
  }

  // Active Dashboard Layout
  const bookingsPercentage = stats ? Math.min(100, Math.round((stats.monthBookings / stats.monthBookingsCap) * 100)) : 0;

  return (
    <div className="dashboard-layout animate-fade-in-up">
      {/* Sidebar Navigation */}
      <div className="sidebar">
        <div className="sidebar-brand">🌱 {providerInfo?.name || 'BookFlow'}</div>
        <div style={{ marginBottom: '15px', fontSize: '0.8rem', color: '#888' }}>
          Plan: <span className="badge badge-success">{providerInfo?.subscriptionPlan}</span>
        </div>
        
        <div className="sidebar-menu">
          <div onClick={() => setActiveTab('dashboard')} className={`sidebar-link ${activeTab === 'dashboard' ? 'active' : ''}`}>📊 Dashboard Metrics</div>
          <div onClick={() => setActiveTab('bookings')} className={`sidebar-link ${activeTab === 'bookings' ? 'active' : ''}`}>🗓️ Bookings Calendar</div>
          <div onClick={() => setActiveTab('services')} className={`sidebar-link ${activeTab === 'services' ? 'active' : ''}`}>💇 Service Menu</div>
          {user?.role === 'PROVIDER_ADMIN' && (
            <>
              <div onClick={() => setActiveTab('staff')} className={`sidebar-link ${activeTab === 'staff' ? 'active' : ''}`}>👥 Staff Members</div>
              <div onClick={() => setActiveTab('schedules')} className={`sidebar-link ${activeTab === 'schedules' ? 'active' : ''}`}>⏰ Working Hours</div>
              <div onClick={() => setActiveTab('subscription')} className={`sidebar-link ${activeTab === 'subscription' ? 'active' : ''}`}>💳 Subscriptions</div>
            </>
          )}
        </div>
        <button onClick={logout} className="btn btn-secondary" style={{ marginTop: '20px' }}>Log Out</button>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content">
        {loadingDashboard ? (
          <p>Gathering dashboard information...</p>
        ) : (
          <div>
            {/* TAB: DASHBOARD */}
            {activeTab === 'dashboard' && stats && (
              <div>
                <div className="dashboard-header">
                  <div>
                    <h1>Welcome Back, {user?.name}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Real-time tenant overview and analytics</p>
                  </div>
                  <span className="badge badge-success" style={{ fontSize: '0.85rem' }}>✓ System Online</span>
                </div>

                {/* Metrics Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                  <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>GROSS VOLUME (ALL PAYMENTS)</p>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>${Number(stats.grossEarnings).toFixed(2)}</h2>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>NET REMITTANCE SHARE (YOURS)</p>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>${Number(stats.netEarnings).toFixed(2)}</h2>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>PLATFORM COMMISSION CUT</p>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--warning)' }}>${Number(stats.platformCommissionPaid).toFixed(2)}</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rate: {(Number(providerInfo?.commissionRate) * 100).toFixed(0)}%</span>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid var(--info)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>TOTAL BOOKINGS</p>
                    <h2 style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--info)' }}>{stats.totalBookings}</h2>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.confirmedBookings} Confirmed | {stats.cancelledBookings} Cancelled</span>
                  </div>
                </div>

                {/* Free Tier / Starter usage limit indicator */}
                <div className="card" style={{ marginBottom: '32px', borderTop: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>Monthly Booking Usage (Plan Threshold)</strong>
                    <span>{stats.monthBookings} / {stats.monthBookingsCap} Bookings</span>
                  </div>
                  <div style={{ background: '#ddd', height: '12px', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ background: 'var(--primary)', width: `${bookingsPercentage}%`, height: '100%', borderRadius: '6px' }} />
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                    If you exceed this cap, customers will be blocked from scheduling online slots. Upgrade in the <strong>Subscriptions</strong> tab for unlimited bookings.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>Service Popularity</h3>
                    {servicesMetrics.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No service bookings recorded yet.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 0' }}>Service</th>
                            <th>Bookings</th>
                            <th style={{ textAlign: 'right' }}>Revenue</th>
                          </tr>
                        </thead>
                        <tbody>
                          {servicesMetrics.map((sm, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 0', fontWeight: 600 }}>{sm.name}</td>
                              <td>{sm.bookingsCount}</td>
                              <td style={{ textAlign: 'right', color: 'var(--primary)', fontWeight: 'bold' }}>${sm.revenue.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="card">
                    <h3 style={{ marginBottom: '16px' }}>Staff Appointments</h3>
                    {staffMetrics.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No staff bookings recorded yet.</p>
                    ) : (
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border)' }}>
                            <th style={{ padding: '8px 0' }}>Staff Member</th>
                            <th>Appointments</th>
                          </tr>
                        </thead>
                        <tbody>
                          {staffMetrics.map((sm, index) => (
                            <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '10px 0', fontWeight: 600 }}>{sm.name}</td>
                              <td>{sm.bookingsCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: BOOKINGS */}
            {activeTab === 'bookings' && (
              <div>
                <h2 style={{ marginBottom: '20px' }}>Bookings & Appointment Logs</h2>
                {loadingList ? (
                  <p>Loading bookings...</p>
                ) : bookings.length === 0 ? (
                  <p>No bookings scheduled yet.</p>
                ) : (
                  <div className="card" style={{ padding: '0', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ backgroundColor: 'var(--bg-app)', borderBottom: '2px solid var(--border)' }}>
                          <th style={{ padding: '12px 16px' }}>Client</th>
                          <th>Service</th>
                          <th>Professional</th>
                          <th>Date / Time</th>
                          <th>Payment Status</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right', paddingRight: '16px' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bookings.map((booking) => {
                          const dateObj = new Date(booking.startTime);
                          const canCancel = booking.status !== 'CANCELLED' && dateObj.getTime() > Date.now();
                          return (
                            <tr key={booking.id} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '16px' }}>
                                <strong>{booking.customer.name}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{booking.customer.email} | {booking.customer.phone || 'No phone'}</div>
                              </td>
                              <td>
                                {booking.service.name}
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>⏱ {booking.service.duration} mins | ${Number(booking.totalAmount).toFixed(2)}</div>
                              </td>
                              <td>{booking.staff.name}</td>
                              <td>{dateObj.toLocaleString()}</td>
                              <td>
                                <span className={`badge ${booking.payments && booking.payments[0]?.status === 'SUCCESSFUL' ? 'badge-success' : 'badge-danger'}`}>
                                  {booking.payments && booking.payments[0] ? booking.payments[0].status : 'UNPAID'}
                                </span>
                              </td>
                              <td>
                                <span className={`badge ${
                                  booking.status === 'CONFIRMED' ? 'badge-success' :
                                  booking.status === 'COMPLETED' ? 'badge-info' : 'badge-danger'
                                }`}>
                                  {booking.status}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', paddingRight: '16px' }}>
                                {canCancel && (
                                  <button
                                    onClick={() => handleCancelBooking(booking.id)}
                                    className="btn btn-danger"
                                    style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                                  >
                                    Cancel
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB: SERVICES */}
            {activeTab === 'services' && (
              <div>
                <h2 style={{ marginBottom: '20px' }}>Service Catalog Builder</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  {/* Create Service Form */}
                  <div className="card">
                    <h3 style={{ marginBottom: '15px' }}>Add Service</h3>
                    <form onSubmit={handleAddServiceSubmit}>
                      <div className="form-group">
                        <label className="form-label">Service Title</label>
                        <input type="text" className="form-control" value={serviceName} onChange={(e) => setServiceName(e.target.value)} required placeholder="e.g. Organic Blowdry" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Duration (Minutes)</label>
                        <input type="number" className="form-control" value={serviceDuration} onChange={(e) => setServiceDuration(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Price ($ USD)</label>
                        <input type="number" className="form-control" value={servicePrice} onChange={(e) => setServicePrice(Number(e.target.value))} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Description</label>
                        <textarea className="form-control" value={serviceDesc} onChange={(e) => setServiceDesc(e.target.value)} rows={2} />
                      </div>
                      <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={serviceFeatured} onChange={(e) => setServiceFeatured(e.target.checked)} id="featured-checkbox" />
                        <label htmlFor="featured-checkbox" style={{ fontWeight: 550, fontSize: '0.85rem' }}>Feature on Listing Profile</label>
                      </div>

                      {serviceError && <div style={{ color: 'var(--danger)', marginBottom: '15px', fontWeight: 'bold', fontSize: '0.85rem' }}>❌ {serviceError}</div>}

                      <button type="submit" className="btn btn-primary w-full">Create Service</button>
                    </form>
                  </div>

                  {/* List Services */}
                  <div>
                    {loadingList ? (
                      <p>Loading services...</p>
                    ) : (
                      <div className="grid-auto-fit">
                        {services.map((service) => (
                          <div key={service.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                              <h4>{service.name}</h4>
                              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>${Number(service.price).toFixed(2)}</span>
                            </div>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minHeight: '36px' }}>{service.description}</p>
                            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <span>⏱ {service.duration} mins</span>
                              {service.isFeatured && <span className="badge badge-success">Featured</span>}
                            </div>
                          </div>
                        ))}
                        {services.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No services set up yet.</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: STAFF */}
            {activeTab === 'staff' && (
              <div>
                <h2 style={{ marginBottom: '20px' }}>Staff Profiles Manager</h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                  {/* Create Staff Form */}
                  <div className="card">
                    <h3 style={{ marginBottom: '15px' }}>Add Professional Staff</h3>
                    <form onSubmit={handleAddStaffSubmit}>
                      <div className="form-group">
                        <label className="form-label">Full Name</label>
                        <input type="text" className="form-control" value={staffName} onChange={(e) => setStaffName(e.target.value)} required placeholder="e.g. Clara Oswald" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Professional Title</label>
                        <input type="text" className="form-control" value={staffTitle} onChange={(e) => setStaffTitle(e.target.value)} placeholder="e.g. Color Specialist" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Bio (Details)</label>
                        <textarea className="form-control" value={staffBio} onChange={(e) => setStaffBio(e.target.value)} rows={2} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Staff Account Login Email</label>
                        <input type="email" className="form-control" value={staffEmail} onChange={(e) => setStaffEmail(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Login Password</label>
                        <input type="password" className="form-control" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} required />
                      </div>

                      {staffError && <div style={{ color: 'var(--danger)', marginBottom: '15px', fontWeight: 'bold', fontSize: '0.85rem' }}>❌ {staffError}</div>}

                      <button type="submit" className="btn btn-primary w-full">Provision Staff Profile</button>
                    </form>
                  </div>

                  {/* List Staff */}
                  <div>
                    {loadingList ? (
                      <p>Loading staff...</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {staffMembers.map((staff) => (
                          <div key={staff.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4>{staff.name}</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{staff.title || 'Staff Member'}</p>
                              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>Email: {staff.user.email}</p>
                              <p style={{ fontSize: '0.8rem', marginTop: '6px' }}>{staff.bio}</p>
                            </div>
                            <span style={{ fontSize: '1.1rem', color: 'var(--warning)', fontWeight: 'bold' }}>★ {staff.rating.toFixed(1)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB: SCHEDULES */}
            {activeTab === 'schedules' && (
              <div>
                <h2 style={{ marginBottom: '20px' }}>Staff Availability Scheduler</h2>

                {staffMembers.length === 0 ? (
                  <p>You need to create a staff member first before scheduling hours.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
                    {/* Staff selection side panel */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <h3>Select Staff</h3>
                      {staffMembers.map((staff) => (
                        <div
                          key={staff.id}
                          onClick={() => selectStaffForSchedule(staff)}
                          style={{
                            padding: '12px',
                            border: selectedStaffForSched?.id === staff.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: selectedStaffForSched?.id === staff.id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                          }}
                        >
                          <strong>{staff.name}</strong>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{staff.title || 'Stylist'}</p>
                        </div>
                      ))}
                    </div>

                    {/* Sched Hours form & Exceptions */}
                    {selectedStaffForSched && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {/* Weekly Schedule template */}
                        <div className="card">
                          <h3>Weekly Working Hours: {selectedStaffForSched.name}</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Configure weekly operational templates.</p>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                            {workHours.map((wh, idx) => {
                              const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                              return (
                                <div key={wh.dayOfWeek} style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingBottom: '10px', borderBottom: '1px solid var(--border)' }}>
                                  <div style={{ width: '120px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="checkbox"
                                      checked={wh.active}
                                      onChange={(e) => {
                                        const copy = [...workHours];
                                        copy[idx].active = e.target.checked;
                                        setWorkHours(copy);
                                      }}
                                      id={`check-${wh.dayOfWeek}`}
                                    />
                                    <label htmlFor={`check-${wh.dayOfWeek}`} style={{ fontWeight: 600 }}>{dayNames[wh.dayOfWeek]}</label>
                                  </div>
                                  {wh.active && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                      <input
                                        type="text"
                                        className="form-control"
                                        style={{ width: '80px', padding: '6px' }}
                                        value={wh.start}
                                        onChange={(e) => {
                                          const copy = [...workHours];
                                          copy[idx].start = e.target.value;
                                          setWorkHours(copy);
                                        }}
                                      />
                                      <span>to</span>
                                      <input
                                        type="text"
                                        className="form-control"
                                        style={{ width: '80px', padding: '6px' }}
                                        value={wh.end}
                                        onChange={(e) => {
                                          const copy = [...workHours];
                                          copy[idx].end = e.target.value;
                                          setWorkHours(copy);
                                        }}
                                      />
                                    </div>
                                  )}
                                  {!wh.active && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Closed / Off Duty</span>}
                                </div>
                              );
                            })}
                          </div>

                          <button onClick={handleSaveSchedule} className="btn btn-primary">Save Weekly Hours</button>
                        </div>

                        {/* Special Exception dates */}
                        <div className="card">
                          <h3>Add Date Exception (Time off / Overtime)</h3>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '20px' }}>Insert holiday/sick leave overrides.</p>
                          <form onSubmit={handleAddException}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                              <div className="form-group">
                                <label className="form-label">Exception Date</label>
                                <input type="date" className="form-control" value={exceptionDate} onChange={(e) => setExceptionDate(e.target.value)} required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Duty Status</label>
                                <select className="form-control" value={exceptionWorking ? 'true' : 'false'} onChange={(e) => setExceptionWorking(e.target.value === 'true')}>
                                  <option value="false">Off-Duty / Vacation (Closed)</option>
                                  <option value="true">Active Working Override Hours</option>
                                </select>
                              </div>
                            </div>

                            {exceptionWorking && (
                              <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                <div className="form-group">
                                  <label className="form-label">Start Time (HH:MM)</label>
                                  <input type="text" className="form-control" value={exceptionStart} onChange={(e) => setExceptionStart(e.target.value)} />
                                </div>
                                <div className="form-group">
                                  <label className="form-label">End Time (HH:MM)</label>
                                  <input type="text" className="form-control" value={exceptionEnd} onChange={(e) => setExceptionEnd(e.target.value)} />
                                </div>
                              </div>
                            )}

                            <button type="submit" className="btn btn-secondary">Apply Date Exception</button>
                          </form>
                        </div>

                        {schedMessage && (
                          <div style={{ padding: '12px', borderRadius: '6px', background: 'var(--primary-lightest)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            {schedMessage}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB: SUBSCRIPTION SETTINGS */}
            {activeTab === 'subscription' && (
              <div>
                <h2 style={{ marginBottom: '20px' }}>Subscription Plan Settings</h2>
                <div className="card" style={{ marginBottom: '24px' }}>
                  <p>Your business is currently subscribed to: <span className="badge badge-success" style={{ fontSize: '0.9rem' }}>{providerInfo?.subscriptionPlan} Tier</span></p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>Commission cut on bookings: {(Number(providerInfo?.commissionRate) * 100).toFixed(0)}% | Operational status: {providerInfo?.status}</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                  {/* FREE PLAN */}
                  <div className="card" style={{ border: providerInfo?.subscriptionPlan === 'FREE' ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <h3>Free Plan</h3>
                    <h2 style={{ margin: '15px 0' }}>$0 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span></h2>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <li>Max 1 staff member</li>
                      <li>Max 3 services cataloged</li>
                      <li>Cap: 30 bookings/month</li>
                      <li>Email notifications only</li>
                      <li>0% Booking Commission</li>
                    </ul>
                    {providerInfo?.subscriptionPlan === 'FREE' ? (
                      <button disabled className="btn btn-secondary w-full">Current Plan</button>
                    ) : (
                      <button onClick={() => handlePlanUpgrade('FREE')} className="btn btn-outline-primary w-full">Downgrade to Free</button>
                    )}
                  </div>

                  {/* STARTER */}
                  <div className="card" style={{ border: providerInfo?.subscriptionPlan === 'STARTER' ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <h3>Starter Plan</h3>
                    <h2 style={{ margin: '15px 0' }}>$29 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span></h2>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <li>Max 3 staff members</li>
                      <li>Max 5 services cataloged</li>
                      <li>Cap: 150 bookings/month</li>
                      <li>Email + Basic SMS alerts</li>
                      <li>5% Booking Commission</li>
                    </ul>
                    {providerInfo?.subscriptionPlan === 'STARTER' ? (
                      <button disabled className="btn btn-secondary w-full">Current Plan</button>
                    ) : (
                      <button onClick={() => handlePlanUpgrade('STARTER')} className="btn btn-outline-primary w-full">Select Starter</button>
                    )}
                  </div>

                  {/* PROFESSIONAL */}
                  <div className="card" style={{ border: providerInfo?.subscriptionPlan === 'PROFESSIONAL' ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <h3>Professional</h3>
                    <h2 style={{ margin: '15px 0' }}>$79 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span></h2>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <li>Max 10 staff members</li>
                      <li>Unlimited services</li>
                      <li>Unlimited booking volume</li>
                      <li>Email & full SMS triggers</li>
                      <li>5% Booking Commission</li>
                    </ul>
                    {providerInfo?.subscriptionPlan === 'PROFESSIONAL' ? (
                      <button disabled className="btn btn-secondary w-full">Current Plan</button>
                    ) : (
                      <button onClick={() => handlePlanUpgrade('PROFESSIONAL')} className="btn btn-primary w-full">Upgrade Professional</button>
                    )}
                  </div>

                  {/* ENTERPRISE */}
                  <div className="card" style={{ border: providerInfo?.subscriptionPlan === 'ENTERPRISE' ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                    <h3>Enterprise</h3>
                    <h2 style={{ margin: '15px 0' }}>$199 <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ month</span></h2>
                    <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                      <li>Unlimited staff & services</li>
                      <li>Unlimited booking volume</li>
                      <li>White-label custom domain</li>
                      <li>Email & dedicated API</li>
                      <li>3% Booking Commission</li>
                    </ul>
                    {providerInfo?.subscriptionPlan === 'ENTERPRISE' ? (
                      <button disabled className="btn btn-secondary w-full">Current Plan</button>
                    ) : (
                      <button onClick={() => handlePlanUpgrade('ENTERPRISE')} className="btn btn-outline-primary w-full">Upgrade Enterprise</button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
