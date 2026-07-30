import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';

// Declare the PaystackPop global loaded from the CDN script
declare global {
  interface Window {
    PaystackPop: {
      setup(options: {
        key: string;
        email: string;
        amount: number;
        ref: string;
        access_code?: string;
        onClose: () => void;
        callback: (response: { reference: string; status: string }) => void;
      }): { openIframe(): void };
    };
  }
}

interface Provider {
  id: string;
  name: string;
  slug: string;
  description: string;
  phone: string;
  email: string;
  address: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: string;
  isFeatured: boolean;
}

interface Staff {
  id: string;
  name: string;
  title: string;
  bio: string;
  rating: number;
  services?: Array<{ serviceId: string }>;
}

interface Slot {
  startTime: string;
  endTime: string;
  dateTimeISO: string;
}

interface Booking {
  id: string;
  startTime: string;
  status: string;
  totalAmount: string;
  provider: { name: string; address: string };
  staff: { name: string; title: string };
  service: { name: string; duration: number };
  payments: Array<{ status: string; gateway: string; transactionId: string }>;
}

// ─── Paystack Public Key (test mode) ─────────────────────────────────────────
// Set VITE_PAYSTACK_PUBLIC_KEY in frontend/.env to your Paystack PUBLIC key (pk_test_...)
const PAYSTACK_PUBLIC_KEY = (import.meta.env.VITE_PAYSTACK_PUBLIC_KEY as string) || '';

export const CustomerPortal: React.FC = () => {
  const { token, user } = useAuth();

  // Navigation tabs: 'explore' | 'bookings'
  const [activeTab, setActiveTab] = useState<'explore' | 'bookings'>('explore');

  // Marketplace & Search states
  const [providers, setProviders] = useState<Provider[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Booking Flow states
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);

  // Booking Selection
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<Staff | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');

  // Checkout & Payment states
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<any>(null);
  const [processingBooking, setProcessingBooking] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'initializing' | 'awaiting_popup' | 'verifying'>('idle');

  // Customer Bookings states
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Fetch providers on mount
  useEffect(() => {
    fetchProviders();
  }, []);

  // Fetch customer bookings when activeTab changes to 'bookings'
  useEffect(() => {
    if (activeTab === 'bookings' && token) {
      fetchMyBookings();
    }
  }, [activeTab, token]);

  // Fetch slots when service, staff, and date are selected
  useEffect(() => {
    if (selectedProvider && selectedService && selectedStaff && selectedDate) {
      fetchSlots();
    }
  }, [selectedService, selectedStaff, selectedDate]);

  const fetchProviders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    try {
      setLoadingBookings(true);
      const res = await fetch('/api/bookings', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMyBookings(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  };

  const startBookingFlow = async (provider: Provider) => {
    setSelectedProvider(provider);
    setSelectedService(null);
    setSelectedStaff(null);
    setSelectedDate('');
    setSlots([]);
    setSelectedSlot(null);
    setBookingError('');
    setBookingSuccess(null);
    setPaymentStep('idle');

    try {
      const res = await fetch(`/api/providers/profile/${provider.slug}`);
      if (res.ok) {
        const data = await res.json();
        setServices(data.services || []);
        setStaffList(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load profile details', err);
    }
  };

  const fetchSlots = async () => {
    if (!selectedProvider || !selectedStaff || !selectedService || !selectedDate) return;
    try {
      const res = await fetch(
        `/api/bookings/availability?providerSlug=${selectedProvider.slug}&staffId=${selectedStaff.id}&serviceId=${selectedService.id}&date=${selectedDate}`
      );
      if (res.ok) {
        const data = await res.json();
        setSlots(data);
        setSelectedSlot(null);
      }
    } catch (err) {
      console.error('Failed to load available slots', err);
    }
  };

  /**
   * Complete booking after Paystack confirms the payment.
   * Sends paystackReference to the backend which then verifies it with Paystack.
   */
  const completeBooking = useCallback(
    async (paystackReference: string) => {
      if (!selectedProvider || !selectedStaff || !selectedService || !selectedSlot || !token) {
        setBookingError('Booking data is incomplete. Please try again.');
        setPaymentStep('idle');
        return;
      }

      setPaymentStep('verifying');
      setBookingError('');

      try {
        const res = await fetch('/api/bookings/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            providerId: selectedProvider.id,
            staffId: selectedStaff.id,
            serviceId: selectedService.id,
            startTime: selectedSlot.dateTimeISO,
            notes,
            paystackReference,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setBookingError(data.error || 'Booking confirmation failed after payment');
        } else {
          setBookingSuccess(data);
          fetchMyBookings();
        }
      } catch (err) {
        setBookingError('Network error during booking confirmation. Please contact support with your payment reference: ' + paystackReference);
      } finally {
        setProcessingBooking(false);
        setPaymentStep('idle');
      }
    },
    [selectedProvider, selectedStaff, selectedService, selectedSlot, notes, token]
  );

  /**
   * Step 1: Initialize payment on backend → get access_code
   * Step 2: Launch Paystack popup
   * Step 3: On success, call completeBooking with reference
   */
  const handlePaystackCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProvider || !selectedStaff || !selectedService || !selectedSlot || !token) {
      setBookingError('Please complete all scheduling steps first.');
      return;
    }

    if (!window.PaystackPop) {
      setBookingError('Paystack is not loaded. Please refresh the page and try again.');
      return;
    }

    setProcessingBooking(true);
    setPaymentStep('initializing');
    setBookingError('');

    try {
      // 1. Ask our backend to initialize a Paystack transaction
      const initRes = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          providerId: selectedProvider.id,
        }),
      });

      const initData = await initRes.json();

      if (!initRes.ok) {
        setBookingError(initData.error || 'Payment initialization failed');
        setProcessingBooking(false);
        setPaymentStep('idle');
        return;
      }

      setPaymentStep('awaiting_popup');

      // 2. Launch the Paystack inline popup
      const handler = window.PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY,
        email: user?.email || '',
        amount: Math.round(Number(selectedService.price) * 100),
        ref: initData.reference,
        access_code: initData.access_code,
        onClose: () => {
          setProcessingBooking(false);
          setPaymentStep('idle');
          setBookingError('Payment was cancelled. You can try again.');
        },
        callback: (response) => {
          if (response.status === 'success') {
            completeBooking(response.reference);
          } else {
            setBookingError('Payment was not successful. Please try again.');
            setProcessingBooking(false);
            setPaymentStep('idle');
          }
        },
      });

      handler.openIframe();
    } catch (err) {
      console.error(err);
      setBookingError('Failed to open payment gateway. Please try again.');
      setProcessingBooking(false);
      setPaymentStep('idle');
    }
  };

  const cancelAppointment = async (bookingId: string) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        alert('Appointment cancelled successfully.');
        fetchMyBookings();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to cancel appointment');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Filter providers by search query
  const filteredProviders = providers.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Generate date list for picking (today + next 6 days)
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateISO = d.toISOString().substring(0, 10);
    const label = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return { dateISO, label };
  });

  // Payment status label helper
  const getPaymentStepLabel = () => {
    switch (paymentStep) {
      case 'initializing': return '⚡ Connecting to Paystack...';
      case 'awaiting_popup': return '💳 Complete payment in the Paystack popup...';
      case 'verifying': return '🔍 Verifying payment with Paystack...';
      default: return '';
    }
  };

  return (
    <div className="animate-fade-in-up" style={{ paddingBottom: '60px' }}>
      {/* Sub Navbar Tab Bar */}
      <div style={{ display: 'flex', gap: '20px', borderBottom: '2px solid var(--border)', marginBottom: '24px', paddingBottom: '10px' }}>
        <button
          onClick={() => { setActiveTab('explore'); setSelectedProvider(null); }}
          className={`btn ${activeTab === 'explore' ? 'btn-primary' : 'btn-secondary'}`}
        >
          🔍 Browse Salons &amp; Spas
        </button>
        {token && (
          <button
            onClick={() => setActiveTab('bookings')}
            className={`btn ${activeTab === 'bookings' ? 'btn-primary' : 'btn-secondary'}`}
          >
            🗓️ My Appointments
          </button>
        )}
      </div>

      {activeTab === 'explore' && !selectedProvider && (
        <div>
          <div className="card-glass" style={{ padding: '30px', marginBottom: '32px', textAlign: 'center', color: 'var(--text-main)' }}>
            <h1 style={{ fontWeight: 800, fontSize: '2.2rem', marginBottom: '10px' }}>Find and Book Organic Local Services</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Book appointments instantly with multi-tenant verified premium service providers.</p>
            <div style={{ display: 'flex', maxWidth: '600px', margin: '0 auto', gap: '10px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search salons, barbershops, spas, or addresses..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ borderRadius: '30px', paddingLeft: '20px' }}
              />
            </div>
          </div>

          {loading ? (
            <p className="text-center" style={{ color: 'var(--text-muted)' }}>Loading providers catalog...</p>
          ) : filteredProviders.length === 0 ? (
            <p className="text-center" style={{ color: 'var(--text-muted)' }}>No service providers match your search.</p>
          ) : (
            <div className="grid-auto-fit">
              {filteredProviders.map((provider) => (
                <div key={provider.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{provider.name}</h3>
                      <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>Verified</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px', minHeight: '40px' }}>
                      {provider.description || 'No description available.'}
                    </p>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', marginBottom: '16px' }}>
                      <p>📍 {provider.address || 'Online / Remote'}</p>
                      <p>📞 {provider.phone || 'No phone listed'}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => startBookingFlow(provider)}
                    className="btn btn-primary w-full"
                    style={{ marginTop: '10px' }}
                  >
                    Select &amp; Book Slots
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Booking Flow Screen */}
      {activeTab === 'explore' && selectedProvider && (
        <div className="animate-scale-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <button
            onClick={() => setSelectedProvider(null)}
            className="btn btn-secondary"
            style={{ marginBottom: '20px' }}
          >
            ← Back to Marketplace
          </button>

          <div className="card" style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedProvider.name}</h2>
            <p style={{ color: 'var(--text-muted)' }}>📍 {selectedProvider.address}</p>
          </div>

          {!token ? (
            <div className="card text-center" style={{ padding: '40px' }}>
              <h3 style={{ marginBottom: '12px' }}>Authentication Required</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>You must be registered or logged in as a customer to schedule appointments.</p>
              <p style={{ fontWeight: 600 }}>Please use the Account options at the top right to Log In.</p>
            </div>
          ) : bookingSuccess ? (
            <div className="card text-center animate-scale-in" style={{ borderColor: 'var(--success)', borderWidth: '2px', padding: '40px' }}>
              <span style={{ fontSize: '3rem' }}>🌱</span>
              <h2 style={{ color: 'var(--success)', margin: '15px 0' }}>Booking Confirmed!</h2>
              <p style={{ marginBottom: '10px', fontSize: '1.1rem' }}>
                Your appointment for <strong>{selectedService?.name}</strong> has been secured for{' '}
                <strong>{new Date(selectedSlot?.dateTimeISO || '').toLocaleString()}</strong>.
              </p>
              <div style={{ background: 'var(--primary-lightest)', padding: '15px', borderRadius: '8px', margin: '20px auto', maxWidth: '500px', textAlign: 'left', fontSize: '0.85rem' }}>
                <p><strong>Paystack Reference:</strong> {bookingSuccess.payment.transactionId}</p>
                <p><strong>Amount Paid:</strong> ₦{Number(bookingSuccess.payment.amount).toFixed(2)}</p>
                <p><strong>Commission Charged (to Shop):</strong> ₦{Number(bookingSuccess.payment.platformCommission).toFixed(2)}</p>
                <p><strong>Net Provider Remittance:</strong> ₦{Number(bookingSuccess.payment.providerShare).toFixed(2)}</p>
                <p style={{ marginTop: '10px', color: 'var(--success)', fontWeight: 'bold' }}>✓ Payment verified by Paystack.</p>
                <p style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Email confirmation dispatched via SendGrid simulation.</p>
              </div>
              <button
                onClick={() => {
                  setSelectedProvider(null);
                  setActiveTab('bookings');
                }}
                className="btn btn-primary"
              >
                Go to My Appointments
              </button>
            </div>
          ) : (
            <div>
              {/* Step 1: Select Service */}
              <div className="card" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>1. Select a Service</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {services.map((service) => (
                    <div
                      key={service.id}
                      onClick={() => {
                        setSelectedService(service);
                        setSelectedStaff(null);
                        setSelectedSlot(null);
                      }}
                      style={{
                        padding: '16px',
                        border: selectedService?.id === service.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        background: selectedService?.id === service.id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 700 }}>{service.name}</span>
                          {service.isFeatured && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Featured</span>}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{service.description}</p>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>⏱ {service.duration} mins</p>
                      </div>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--primary)' }}>₦{Number(service.price).toFixed(2)}</span>
                    </div>
                  ))}
                  {services.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No services available.</p>}
                </div>
              </div>

              {/* Step 2: Select Staff */}
              {selectedService && (
                <div className="card animate-fade-in-up" style={{ marginBottom: '20px' }}>
                  <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>2. Select Professional Staff</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
                    {staffList
                      .filter((s) => s.services ? s.services.some((link: { serviceId: string }) => link.serviceId === selectedService.id) : true)
                      .map((staff) => (
                        <div
                          key={staff.id}
                          onClick={() => {
                            setSelectedStaff(staff);
                            setSelectedSlot(null);
                          }}
                          style={{
                            padding: '14px',
                            border: selectedStaff?.id === staff.id ? '2px solid var(--primary)' : '1px solid var(--border)',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            background: selectedStaff?.id === staff.id ? 'var(--primary-lightest)' : 'var(--bg-card)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <p style={{ fontWeight: 700 }}>{staff.name}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{staff.title || 'Stylist'}</p>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', minHeight: '32px' }}>{staff.bio}</p>
                          <span style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 'bold' }}>★ {staff.rating.toFixed(1)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Step 3: Choose Date & Time */}
              {selectedService && selectedStaff && (
                <div className="card animate-fade-in-up" style={{ marginBottom: '20px' }}>
                  <h3 style={{ marginBottom: '15px', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>3. Pick Date &amp; Available Slot</h3>
                  <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '15px' }}>
                    {dateOptions.map((opt) => (
                      <button
                        key={opt.dateISO}
                        onClick={() => setSelectedDate(opt.dateISO)}
                        className={`btn ${selectedDate === opt.dateISO ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ whiteSpace: 'nowrap', padding: '8px 12px' }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {selectedDate && (
                    <div>
                      {slots.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                          No available slots for this day. The professional may be fully booked or off-duty.
                        </p>
                      ) : (
                        <div className="slots-grid">
                          {slots.map((slot, index) => (
                            <div
                              key={index}
                              onClick={() => setSelectedSlot(slot)}
                              className={`slot-pill ${selectedSlot?.startTime === slot.startTime ? 'selected' : ''}`}
                            >
                              {slot.startTime}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 4: Checkout — Paystack Secure Payment */}
              {selectedService && selectedStaff && selectedSlot && (
                <div className="card animate-fade-in-up" style={{ borderTop: '4px solid var(--primary)' }}>
                  <h3 style={{ marginBottom: '15px' }}>4. Checkout &amp; Secure Payment</h3>

                  {/* Order Summary */}
                  <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
                    <p><strong>Merchant:</strong> {selectedProvider.name}</p>
                    <p><strong>Service:</strong> {selectedService.name} ({selectedService.duration} mins)</p>
                    <p><strong>Staff Specialist:</strong> {selectedStaff.name}</p>
                    <p><strong>Date/Time:</strong> {new Date(selectedSlot.dateTimeISO).toLocaleString()}</p>
                    <p style={{ fontSize: '1.2rem', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      <strong>Total Amount Due:</strong>{' '}
                      <span style={{ color: 'var(--primary)', fontWeight: 800 }}>₦{Number(selectedService.price).toFixed(2)}</span>
                    </p>
                  </div>

                  {/* Paystack branding badge */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: 'linear-gradient(135deg, #011B33 0%, #012a52 100%)',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    marginBottom: '20px',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="5" fill="#00C3F7"/>
                      <path d="M6 9h12M6 12h8M6 15h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    <div>
                      <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', margin: 0 }}>Secured by Paystack</p>
                      <p style={{ color: '#a0c4e0', fontSize: '0.75rem', margin: 0 }}>Your card details are encrypted and never stored on our servers.</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                      {['Visa', 'MC', 'GTB'].map((card) => (
                        <span key={card} style={{
                          background: 'rgba(255,255,255,0.15)',
                          color: 'white',
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '3px 7px',
                          borderRadius: '4px',
                          letterSpacing: '0.05em'
                        }}>{card}</span>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handlePaystackCheckout}>
                    {/* Appointment Notes */}
                    <div className="form-group">
                      <label className="form-label">Appointment Notes (Optional)</label>
                      <textarea
                        className="form-control"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Allergies, styling requests, preferences..."
                      />
                    </div>

                    {/* Payment step status */}
                    {paymentStep !== 'idle' && (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'var(--primary-lightest)',
                        borderRadius: '8px',
                        padding: '12px 16px',
                        marginBottom: '16px',
                        fontSize: '0.9rem',
                        color: 'var(--primary)',
                        fontWeight: 600,
                      }}>
                        <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                        {getPaymentStepLabel()}
                      </div>
                    )}

                    {bookingError && (
                      <div style={{ color: 'var(--danger)', fontWeight: 'bold', marginBottom: '15px', fontSize: '0.9rem' }}>
                        ❌ {bookingError}
                      </div>
                    )}

                    <button
                      id="paystack-checkout-btn"
                      type="submit"
                      disabled={processingBooking}
                      className="btn btn-primary w-full"
                      style={{
                        fontSize: '1.05rem',
                        padding: '14px',
                        background: processingBooking ? 'var(--text-muted)' : 'linear-gradient(135deg, #00C3F7 0%, #0080b0 100%)',
                        borderColor: 'transparent',
                      }}
                    >
                      {processingBooking
                        ? getPaymentStepLabel() || 'Processing...'
                        : `🔒 Pay ₦${Number(selectedService.price).toFixed(2)} with Paystack`}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '10px' }}>
                      By clicking pay, a secure Paystack popup will open to complete your payment.
                    </p>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bookings Listing Tab */}
      {activeTab === 'bookings' && (
        <div className="animate-scale-in">
          <h2 style={{ marginBottom: '20px' }}>Your Appointments History</h2>

          {loadingBookings ? (
            <p className="text-center" style={{ color: 'var(--text-muted)' }}>Loading appointments...</p>
          ) : myBookings.length === 0 ? (
            <p className="text-center" style={{ color: 'var(--text-muted)' }}>You haven't scheduled any appointments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {myBookings.map((booking) => {
                const bookingDate = new Date(booking.startTime);
                const isUpcoming = bookingDate.getTime() > Date.now() && booking.status !== 'CANCELLED';
                return (
                  <div
                    key={booking.id}
                    className="card"
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderColor: booking.status === 'CANCELLED' ? 'var(--border)' : 'var(--primary)',
                      borderLeftWidth: '5px',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{booking.service.name}</h4>
                        <span className={`badge ${
                          booking.status === 'CONFIRMED' ? 'badge-success' :
                          booking.status === 'COMPLETED' ? 'badge-info' : 'badge-danger'
                        }`}>
                          {booking.status}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>🏢 <strong>{booking.provider.name}</strong> ({booking.provider.address})</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>💇 Specialist: {booking.staff.name} ({booking.staff.title})</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>📅 Time: {bookingDate.toLocaleString()} ({booking.service.duration} mins)</p>
                      {booking.payments && booking.payments[0] && (
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          💳 Paid via {booking.payments[0].gateway} | Ref: {booking.payments[0].transactionId || 'PENDING'}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                      <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>₦{Number(booking.totalAmount).toFixed(2)}</span>
                      {isUpcoming && (
                        <button
                          onClick={() => cancelAppointment(booking.id)}
                          className="btn btn-danger"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Cancel Appointment
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
