'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Copy, CheckCircle, XCircle, Loader2, AlertTriangle, MessageCircle, Phone, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  invitationCard: string | null;
  smsCode: string | null;
}

interface BroadcastResult {
  guestId: string;
  name: string;
  channel: string;
  success: boolean;
  error?: string;
}

export default function SendInvitationsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BroadcastResult[]>([]);
  const [credits, setCredits] = useState<number | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number>(0);

  // Load guests and credit balance
  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }).then(res => res.json()),
      fetch('/api/tenant/billing', { credentials: 'include' }).then(res => res.json()),
    ]).then(([guestsData, billingData]) => {
      setGuests(guestsData);
      setCredits(billingData.tenant?.credits ?? 0);
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load data');
      setLoading(false);
    });
  }, [eventId]);

  // Calculate estimated cost
  useEffect(() => {
    const cost = guests.reduce((sum, g) => {
      if (!g.phone) return sum;
      return sum + (g.routingChannel === 'whatsapp' ? 50 : 25);
    }, 0);
    setEstimatedCost(cost);
  }, [guests]);

  const broadcast = async () => {
    const eligibleCount = guests.filter(g => g.phone).length;
    if (eligibleCount === 0) {
      toast.error('No guests with phone numbers to send to.');
      return;
    }
    if (credits !== null && credits < estimatedCost) {
      toast.error(`Insufficient credits. Need ${estimatedCost} TZS, you have ${credits} TZS.`);
      return;
    }
    const confirm = window.confirm(
      `Send invitations to ${eligibleCount} guests?\nEstimated cost: ${estimatedCost} TZS.\nWhatsApp guests will receive QR cards, SMS guests will receive numeric codes.`
    );
    if (!confirm) return;

    setSending(true);
    setResults([]);
    try {
      const res = await fetch('/api/invitations/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.results) {
        setResults(data.results);
        // Refresh credit balance
        const billingRes = await fetch('/api/tenant/billing', { credentials: 'include' });
        const billingData = await billingRes.json();
        setCredits(billingData.tenant?.credits ?? 0);
        toast.success(`Broadcast completed! ${data.results.filter((r: BroadcastResult) => r.success).length} sent.`);
      } else {
        toast.error(data.error || 'Broadcast failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  };

  const getGuestStatus = (guest: Guest) => {
    const result = results.find((r: BroadcastResult) => r.guestId === guest.id);
    if (result) {
      return {
        text: result.success ? 'Sent' : (result.error || 'Failed'),
        icon: result.success ? <CheckCircle size={14} style={{ color: '#1A7A4A' }} /> : <XCircle size={14} style={{ color: '#C0392B' }} />
      };
    }
    if (guest.routingChannel === 'whatsapp') {
      return guest.invitationCard
        ? { text: 'QR ready', icon: null }
        : { text: 'No QR', icon: <AlertTriangle size={14} style={{ color: '#C07A20' }} /> };
    } else {
      return guest.smsCode
        ? { text: 'Code ready', icon: null }
        : { text: 'No code', icon: <AlertTriangle size={14} style={{ color: '#C07A20' }} /> };
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/invite/${eventId}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied!');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, border: '3px solid #E2EAF0', borderTopColor: '#0D4F4F', borderRadius: '50%', animation: 'spin 0.7s linear infinite', margin: '0 auto 12px' }} />
          <p style={{ color: '#9BAAB8', fontSize: 14, fontWeight: 500 }}>Loading guests…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const eligibleCount = guests.filter(g => g.phone).length;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F4F8',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      paddingBottom: 100,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .wrap {
          max-width: 900px; margin: 0 auto;
          padding: 40px 24px 32px;
          animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          text-decoration: none; margin-bottom: 24px;
          padding: 7px 14px;
          background: rgba(13,79,79,0.08);
          border: 1px solid rgba(13,79,79,0.12);
          border-radius: 10px;
          transition: background 0.15s;
        }
        .back-link:hover { background: rgba(13,79,79,0.14); }

        .header-flex {
          display: flex; justify-content: space-between; align-items: flex-start;
          margin-bottom: 24px;
          flex-wrap: wrap; gap: 12px;
        }

        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px;
        }

        .copy-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          border-radius: 30px; padding: 6px 14px;
          cursor: pointer; transition: background 0.15s;
        }
        .copy-btn:hover { background: rgba(13,79,79,0.14); }

        .card {
          background: white; border-radius: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          padding: 20px 24px;
          margin-bottom: 28px;
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .credit-row {
          display: flex; justify-content: space-between; align-items: center;
          flex-wrap: wrap; gap: 12px;
        }

        .credit-label {
          font-size: 13px; color: #7A8FA6; font-weight: 500;
        }

        .credit-amount {
          font-size: 26px; font-weight: 800; color: #0D4F4F;
          font-family: 'Playfair Display', serif;
        }

        .cost-amount {
          font-size: 20px; font-weight: 800; color: #0D1B1B;
        }

        .warning {
          color: #C07A20; font-size: 12px; margin-top: 6px;
        }

        .broadcast-btn {
          width: 100%; border: none; border-radius: 14px;
          padding: 16px 20px; font-size: 15px; font-weight: 700;
          font-family: inherit; display: flex; align-items: center;
          justify-content: center; gap: 8px; cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; box-shadow: 0 4px 12px rgba(13,79,79,0.3);
          margin-bottom: 28px;
        }
        .broadcast-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13,79,79,0.35); }
        .broadcast-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Guest list */
        .guest-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; padding-bottom: 12px;
          border-bottom: 1.5px solid #F0F4F8;
        }
        .guest-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 800; color: #0D1B1B;
        }
        .guest-badge {
          font-size: 12px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); padding: 3px 10px;
          border-radius: 20px;
        }

        .guest-list {
          max-height: 500px; overflow-y: auto;
        }
        .guest-row {
          padding: 14px 0; border-bottom: 1px solid #F7F9FB;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px;
        }
        .guest-row:last-child { border-bottom: none; }
        .guest-info { flex: 1; min-width: 0; }
        .guest-name { font-size: 14px; font-weight: 700; color: #0D1B1B; }
        .guest-phone { font-size: 12px; color: #9BAAB8; margin-top: 2px; }
        .guest-channel {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.07); padding: 2px 8px;
          border-radius: 12px; margin-top: 4px;
        }
        .guest-status { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .guest-status-text { font-size: 13px; font-weight: 500; color: #4A6072; }

        @media (max-width: 640px) {
          .wrap { padding: 24px 16px 20px; }
          .page-title { font-size: 26px; }
          .card { padding: 16px; }
          .credit-amount { font-size: 22px; }
          .cost-amount { font-size: 18px; }
        }
      `}</style>

      <div className="wrap">
        {/* Back link */}
        <Link href={`/client/events/${eventId}`} className="back-link">
          <ArrowLeft size={14} /> Back to Event
        </Link>

        <div className="header-flex">
          <h1 className="page-title">Send Invitations</h1>
          <button onClick={copyInviteLink} className="copy-btn">
            <Copy size={14} /> Copy link
          </button>
        </div>

        {/* Credit info card */}
        <div className="card">
          <div className="credit-row">
            <div>
              <div className="credit-label">Your credit balance</div>
              <div className="credit-amount">{credits?.toLocaleString() ?? '?'} TZS</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="credit-label">Estimated cost</div>
              <div className="cost-amount">{estimatedCost.toLocaleString()} TZS</div>
              {credits !== null && credits < estimatedCost && (
                <div className="warning">⚠️ Insufficient credits</div>
              )}
            </div>
          </div>
        </div>

        {/* Broadcast button */}
        <button
          className="broadcast-btn"
          onClick={broadcast}
          disabled={sending || eligibleCount === 0 || (credits !== null && credits < estimatedCost)}
        >
          {sending ? (
            <><Loader2 size={18} style={{ animation: 'spin 0.7s linear infinite' }} /> Broadcasting...</>
          ) : (
            <><Send size={18} /> Broadcast All ({eligibleCount} guests)</>
          )}
        </button>

        {/* Guest list card */}
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="guest-header">
            <h2 className="guest-title">Guest List</h2>
            <div className="guest-badge">{guests.length} guest{guests.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="guest-list">
            {guests.map(guest => {
              const status = getGuestStatus(guest);
              return (
                <div key={guest.id} className="guest-row">
                  <div className="guest-info">
                    <div className="guest-name">{guest.name}</div>
                    {guest.phone && <div className="guest-phone">{guest.phone}</div>}
                    <div className="guest-channel">
                      {guest.routingChannel === 'whatsapp' ? (
                        <><MessageCircle size={11} /> WhatsApp</>
                      ) : (
                        <><Phone size={11} /> SMS</>
                      )}
                    </div>
                  </div>
                  <div className="guest-status">
                    {status.icon}
                    <span className="guest-status-text">{status.text}</span>
                  </div>
                </div>
              );
            })}
            {guests.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#9BAAB8' }}>
                No guests found. Add guests first.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}