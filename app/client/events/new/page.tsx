'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, Coins, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import RequestCreditsModal from '@/app/components/RequestCreditsModal';

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    date: '',
    venue: '',
    address: '',
    guestCount: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [hasPending, setHasPending] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState(0);

  const guestCount = parseInt(form.guestCount, 10) || 0;
  const commissionPerGuest = 500;
  const totalCommission = guestCount * commissionPerGuest;

  const fetchCredits = () => {
    Promise.all([
      fetch('/api/tenant/billing', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/credits/pending', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([billing, pending]) => {
        setCredits(billing.tenant?.credits ?? 0);
        setHasPending(!!pending.pending);
      })
      .catch(() => console.error('Failed to fetch credits'));
  };

  useEffect(() => { fetchCredits(); }, []);

  const isLabelUp = (fieldName: string) => {
    if (focused === fieldName) return true;
    const value = form[fieldName as keyof typeof form];
    return value !== undefined && value !== null && value !== '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const localDate = new Date(form.date);
    if (isNaN(localDate.getTime())) {
      setError('Please select a valid date and time.');
      setLoading(false);
      return;
    }
    const offsetMinutes = localDate.getTimezoneOffset();
    const sign = offsetMinutes <= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetMinutes);
    const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
    const offsetM = String(absOffset % 60).padStart(2, '0');
    const utcDateString = `${form.date}:00${sign}${offsetH}:${offsetM}`;

    const parsedGuestCount = parseInt(form.guestCount, 10);
    if (!parsedGuestCount || parsedGuestCount < 1) {
      setError('Please enter a valid number of guests (minimum 1).');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/events/create-with-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: form.name,
          date: utcDateString,
          venue: form.venue,
          address: form.address,
          guestCount: parsedGuestCount,
        }),
      });
      const data = await res.json();

      if (res.ok && data.eventId) {
        toast.success(`Event created using ${data.creditsUsed || parsedGuestCount} credits`);
        router.push(`/client/events/${data.eventId}`);
        return;
      }

      if (res.status === 400 && data.error === 'Insufficient credits') {
        setRequiredCredits(data.required || parsedGuestCount);
        setShowRequestModal(true);
        setLoading(false);
        return;
      }

      setError(data.error || 'Failed to create event');
      setLoading(false);
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 700;
          color: #0D4B4B;
          text-decoration: none;
          margin-bottom: 24px;
          padding: 7px 14px;
          background: rgba(13, 79, 79, 0.08);
          border: 1px solid rgba(13, 79, 79, 0.12);
          border-radius: 10px;
          transition: background 0.15s;
        }
        .back-link:hover {
          background: rgba(13, 79, 79, 0.14);
        }

        .page-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #0D4B4B;
          margin-bottom: 6px;
        }

        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 900;
          color: #0D1B1B;
          line-height: 1.1;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
        }

        .page-title span {
          color: #FF6B5C;
        }

        .page-sub {
          color: #7A8FA6;
          font-size: 14px;
          font-weight: 400;
          margin-bottom: 28px;
        }

        .form-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .form-body {
          padding: 28px;
        }

        .field-wrap {
          position: relative;
          margin-bottom: 20px;
        }

        .field-label {
          position: absolute;
          left: 14px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #5F6C7A;
          pointer-events: none;
          background: white;
          padding: 0 4px;
          font-weight: 500;
          transition: top 0.2s ease, font-size 0.2s ease, color 0.2s ease;
          z-index: 2;
          line-height: 1;
        }

        .field-label.up {
          top: 0;
          font-size: 11px;
          color: #0D4B4B;
          font-weight: 700;
          letter-spacing: 0.2px;
        }

        .field-input,
        .field-textarea {
          width: 100%;
          padding: 14px;
          border: 1.5px solid #E2EAF0;
          border-radius: 13px;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          color: #0D1B1B;
          background: white;
          font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
          position: relative;
          z-index: 1;
        }

        .field-input:focus,
        .field-textarea:focus {
          border-color: #0D4B4B;
          box-shadow: 0 0 0 4px rgba(13, 79, 79, 0.08);
        }

        .field-textarea {
          resize: vertical;
          min-height: 80px;
        }

        .field-hint {
          font-size: 11.5px;
          color: #9BAAB8;
          margin-top: 6px;
          font-weight: 400;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
          padding: 20px;
          background: #F7FAFA;
          border-radius: 14px;
          margin: 20px 0;
        }

        .summary-item {
          padding: 12px;
          background: white;
          border-radius: 10px;
          border: 1px solid #E2EAF0;
        }

        .summary-label {
          font-size: 11px;
          font-weight: 700;
          color: #9BAAB8;
          letter-spacing: 0.2px;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .summary-value {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 900;
          color: #0D1B1B;
        }

        .total-section {
          padding: 16px;
          background: linear-gradient(135deg, rgba(13, 79, 79, 0.08), rgba(232, 165, 152, 0.05));
          border-radius: 12px;
          border: 1px solid rgba(13, 79, 79, 0.12);
          margin: 20px 0;
        }

        .total-label {
          font-size: 12px;
          font-weight: 600;
          color: #9BAAB8;
          margin-bottom: 6px;
        }

        .total-value {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 900;
          color: #0D4B4B;
        }

        .total-hint {
          font-size: 11px;
          color: #9BAAB8;
          margin-top: 6px;
          font-weight: 500;
        }

        .err-banner {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #C0392B;
          padding: 12px 14px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 20px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          animation: shake 0.35s ease;
        }

        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
        }

        .credits-display {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #F7FAFA;
          padding: 12px 16px;
          border-radius: 12px;
          margin-bottom: 20px;
        }

        .credits-label {
          font-size: 14px;
          color: #5F6C7A;
        }

        .credits-value {
          font-weight: 700;
          color: #0D4B4B;
        }

        .submit-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #0D4B4B, #0A3939);
          color: white;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          box-shadow: 0 4px 16px rgba(13,75,75,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          position: relative;
          overflow: hidden;
        }

        .submit-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }

        .submit-btn:hover:not(:disabled)::after {
          opacity: 1;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(13,75,75,0.4);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @media (max-width: 640px) {
          .page-title { font-size: 26px; }
          .form-body { padding: 20px; }
          .summary-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <Link href="/client/events" className="back-link">
        <ArrowLeft size={14} /> Back to Events
      </Link>

      <div style={{ marginBottom: 28 }}>
        <div className="page-eyebrow">Create</div>
        <h1 className="page-title">
          New <span>Event</span>
        </h1>
        <p className="page-sub">
          Set up your event details. Credits are used 1-per-guest when you add or import guests.
        </p>
      </div>

      <div className="form-card">
        <div className="form-body">
          {error && (
            <div className="err-banner">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              {error}
            </div>
          )}

          {/* Credit display + request button */}
          <div className="credits-display">
            <div>
              <span className="credits-label">Available Credits</span>
              <span className="credits-value ml-2">{credits !== null ? credits : 'Loading...'}</span>
            </div>
            <button
              type="button"
              onClick={() => setShowRequestModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0D4B4B] text-white text-xs font-bold rounded-lg hover:bg-[#0A3939] transition-colors"
            >
              <Send size={12} /> Request
            </button>
          </div>

          {hasPending && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4 text-xs font-semibold text-amber-700">
              <Clock size={14} /> You have a pending credit request under review.
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="field-wrap">
              <label className={`field-label ${isLabelUp('name') ? 'up' : ''}`}>Event Name</label>
              <input
                type="text"
                required
                className="field-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                onFocus={() => setFocused('name')}
                onBlur={() => setFocused(null)}
              />
            </div>

            <div className="field-wrap">
              <label className={`field-label ${isLabelUp('date') ? 'up' : ''}`}>Date & Time</label>
              <input
                type="datetime-local"
                required
                className="field-input"
                value={form.date}
                min={new Date().toISOString().slice(0, 16)}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                onFocus={() => setFocused('date')}
                onBlur={() => setFocused(null)}
              />
            </div>

            <div className="field-wrap">
              <label className={`field-label ${isLabelUp('venue') ? 'up' : ''}`}>Venue Name</label>
              <input
                type="text"
                required
                className="field-input"
                value={form.venue}
                onChange={(e) => setForm({ ...form, venue: e.target.value })}
                onFocus={() => setFocused('venue')}
                onBlur={() => setFocused(null)}
              />
            </div>

            <div className="field-wrap">
              <label className={`field-label ${isLabelUp('address') ? 'up' : ''}`}>Address</label>
              <textarea
                required
                className="field-textarea"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                onFocus={() => setFocused('address')}
                onBlur={() => setFocused(null)}
              />
            </div>

            <div className="field-wrap">
              <label className={`field-label ${isLabelUp('guestCount') ? 'up' : ''}`}>Number of Guests</label>
              <input
                type="number"
                required
                min="1"
                className="field-input"
                value={form.guestCount}
                onChange={(e) => setForm({ ...form, guestCount: e.target.value })}
                onFocus={() => setFocused('guestCount')}
                onBlur={() => setFocused(null)}
                placeholder="e.g., 100"
              />
              <p className="field-hint">You can add more guests later during event setup</p>
            </div>

            {form.guestCount && (
              <div className="summary-grid">
                <div className="summary-item">
                  <div className="summary-label">Guests</div>
                  <div className="summary-value">{guestCount}</div>
                </div>
                <div className="summary-item">
                  <div className="summary-label">Rate</div>
                  <div className="summary-value" style={{ fontSize: 16 }}>
                    {commissionPerGuest.toLocaleString()} TZS
                  </div>
                </div>
              </div>
            )}

            {form.guestCount && (
              <div className="total-section">
                <div className="total-label">TOTAL COST</div>
                <div className="total-value">{totalCommission.toLocaleString()} TZS</div>
                <p className="total-hint">Estimated cost for your planned guests. Credits are used 1-per-guest as you add or import them.</p>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={loading || guestCount === 0}>
              {loading ? (
                <>
                  <div className="spinner" /> Creating...
                </>
              ) : (
                <>
                  <Coins size={16} /> Create Event
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Request Credits Modal */}
      <RequestCreditsModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          fetchCredits();
        }}
        onRequestSent={() => fetchCredits()}
        hasPending={hasPending}
      />
    </div>
  );
}
