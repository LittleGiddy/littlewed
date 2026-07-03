'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Send, CheckCircle, XCircle, Clock, MessageCircle, Phone, Image } from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  invitationCard: string | null;
  smsCode: string | null;
  invitationSentAt: string | null;
}

export default function SendPage() {
  const { eventId } = useParams();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ guestId: string; name: string; success: boolean; error?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [customMessage, setCustomMessage] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }).then(r => r.json()),
      fetch(`/api/events/${eventId}/settings`, { credentials: 'include' }).then(r => r.json()),
    ]).then(([guestsData, settings]) => {
      setGuests(guestsData);
      setCustomMessage(settings.customMessage || "You're invited! Scan the QR code at the entrance.");
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load data');
      setLoading(false);
    });
  }, [eventId]);

  const sendToGuest = async (guest: Guest) => {
    try {
      const res = await fetch('/api/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      return { success: res.ok, error: data.error };
    } catch {
      return { success: false, error: 'Network error' };
    }
  };

  const broadcast = async () => {
    if (guests.length === 0) {
      toast.error('No guests to send to');
      return;
    }
    setSending(true);
    setResults([]);
    let successCount = 0;
    const newResults: typeof results = [];
    for (const guest of guests) {
      const result = await sendToGuest(guest);
      newResults.push({
        guestId: guest.id,
        name: guest.name,
        success: result.success,
        error: result.error,
      });
      if (result.success) successCount++;
      setResults([...newResults]);
      await new Promise(r => setTimeout(r, 300));
    }
    toast.success(`Sent to ${successCount} of ${guests.length} guests`);
    setSending(false);
  };

  const getStatus = (guest: Guest) => {
    const result = results.find(r => r.guestId === guest.id);
    if (result) {
      return result.success ? 'sent' : 'failed';
    }
    if (guest.invitationSentAt) return 'sent';
    return 'pending';
  };

  if (loading) return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .chat-container {
          background: #e5ddd5;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23e5ddd5'/%3E%3C/svg%3E");
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid #e2eaf0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
        }

        .message-bubble {
          max-width: 75%;
          padding: 10px 14px;
          border-radius: 12px;
          position: relative;
          word-wrap: break-word;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }
        .message-bubble.sent {
          background: #dcf8c6;
          align-self: flex-end;
          border-bottom-right-radius: 4px;
        }
        .message-bubble.received {
          background: white;
          align-self: flex-start;
          border-bottom-left-radius: 4px;
        }
        .message-bubble .card-preview {
          max-width: 200px;
          border-radius: 8px;
          margin-top: 6px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .message-bubble .timestamp {
          font-size: 10px;
          color: #999;
          margin-top: 4px;
          text-align: right;
        }
        .status-icon {
          display: inline-block;
          margin-left: 6px;
        }
        .guest-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #0D4F4F;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 700;
          flex-shrink: 0;
        }
        .chat-header {
          background: #0D4F4F;
          color: white;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .chat-footer {
          background: #f0f4f8;
          padding: 12px 16px;
          border-top: 1px solid #e2eaf0;
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .chat-footer textarea {
          flex: 1;
          border: 1px solid #e2eaf0;
          border-radius: 20px;
          padding: 8px 14px;
          resize: none;
          outline: none;
          font-family: inherit;
          font-size: 14px;
          background: white;
          max-height: 60px;
        }
        .chat-footer textarea:focus {
          border-color: #0D4F4F;
          box-shadow: 0 0 0 3px rgba(13,79,79,0.08);
        }
        .message-list {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-height: 500px;
          overflow-y: auto;
        }
        .guest-message-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .guest-message-group .guest-label {
          font-size: 11px;
          font-weight: 600;
          color: #4A6072;
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 2px;
          padding-left: 4px;
        }
        .guest-message-group .guest-label .channel-icon {
          color: #9BAAB8;
        }
        .send-btn {
          background: #0D4F4F;
          color: white;
          border: none;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background 0.15s, transform 0.15s;
          flex-shrink: 0;
        }
        .send-btn:hover:not(:disabled) {
          background: #0A3D3D;
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .send-btn .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      <h1 className="font-serif text-3xl font-black text-gray-900 mb-2">Send Invitations</h1>
      <p className="text-gray-500 mb-4">Broadcast invitation messages with QR cards to all guests.</p>

      <div className="chat-container">
        <div className="chat-header">
          <MessageCircle size={20} />
          <span className="font-semibold">Broadcast to {guests.length} guests</span>
          <span className="ml-auto text-sm opacity-80">
            {results.filter(r => r.success).length} / {guests.length} sent
          </span>
        </div>

        <div className="message-list">
          {guests.map((guest) => {
            const status = getStatus(guest);
            const result = results.find(r => r.guestId === guest.id);
            const channelIcon = guest.routingChannel === 'whatsapp' ? <MessageCircle size={12} /> : <Phone size={12} />;
            const isSent = status === 'sent';
            const isFailed = status === 'failed';
            const isPending = status === 'pending';
            return (
              <div key={guest.id} className="guest-message-group">
                <div className="guest-label">
                  <span className="guest-avatar">{guest.name.charAt(0).toUpperCase()}</span>
                  <span>{guest.name}</span>
                  <span className="channel-icon">{channelIcon}</span>
                  {isSent && <CheckCircle size={12} className="text-green-600" />}
                  {isFailed && <XCircle size={12} className="text-red-500" />}
                  {isPending && <Clock size={12} className="text-amber-500" />}
                </div>
                <div className={`message-bubble ${isSent || isPending ? 'sent' : 'received'}`}>
                  <div className="text-sm">{customMessage}</div>
                  {guest.invitationCard && (
                    <img
                      src={guest.invitationCard}
                      alt="Invitation Card"
                      className="card-preview w-full max-w-[180px]"
                    />
                  )}
                  <div className="timestamp">
                    {isSent ? 'Sent' : isFailed ? (result?.error || 'Failed') : 'Queued'}
                  </div>
                </div>
              </div>
            );
          })}
          {guests.length === 0 && (
            <div className="text-center py-8 text-gray-500">No guests to send invitations to.</div>
          )}
        </div>

        <div className="chat-footer">
          <textarea
            rows={1}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Custom invitation message..."
            className="flex-1"
          />
          <button
            onClick={broadcast}
            disabled={sending || guests.length === 0}
            className="send-btn"
          >
            {sending ? <div className="spinner" /> : <Send size={20} />}
          </button>
        </div>
      </div>

      {results.length > 0 && (
        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-200">
          <p className="text-sm font-medium text-gray-700">Broadcast results:</p>
          <div className="flex gap-4 text-sm mt-1">
            <span className="text-green-600">✓ {results.filter(r => r.success).length} sent</span>
            <span className="text-red-500">✗ {results.filter(r => !r.success).length} failed</span>
          </div>
        </div>
      )}
    </div>
  );
}