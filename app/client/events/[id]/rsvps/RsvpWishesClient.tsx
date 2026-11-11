'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, Calendar, MapPin, PartyPopper, Heart, CheckCircle,
  XCircle, CircleHelp, MessageSquareHeart, Trash2, Share2, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import WishBubbleList, { type WishBubble } from '@/components/WishBubbleList';

export interface RsvpItem {
  id: string;
  guestName: string;
  status: string;
  channel: string;
  createdAt: string;
}

export interface WishItem {
  id: string;
  guestId: string | null;
  guestName: string;
  message: string;
  attending: string | null;
  createdAt: string;
}

interface EventInfo {
  id: string;
  name: string;
  date: string;
  venue: string;
}

interface Props {
  event: EventInfo;
  rsvps: RsvpItem[];
  wishes: WishItem[];
}

const PDF_STATUS_LABEL: Record<string, string> = {
  yes: 'Attending',
  no: 'Not Attending',
  pending: 'Pending',
};

export default function RsvpWishesClient({ event, rsvps, wishes }: Props) {
  const [rsvpRows, setRsvpRows] = useState<RsvpItem[]>(rsvps);
  const [wishRows, setWishRows] = useState<WishItem[]>(wishes);
  const [deletingRsvpId, setDeletingRsvpId] = useState<string | null>(null);
  const [deletingWishId, setDeletingWishId] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  const attendingCount = rsvpRows.filter(r => r.status === 'yes').length;
  const declinedCount = rsvpRows.filter(r => r.status === 'no').length;
  const maybeCount = rsvpRows.filter(r => r.status === 'pending').length;

  const wishBubbles = useMemo<WishBubble[]>(
    () => wishRows.map(w => ({ ...w, createdAt: new Date(w.createdAt) })),
    [wishRows]
  );

  const statusChip = (status: string) => {
    if (status === 'yes') return { label: 'Attending', cls: 'bg-success-soft text-success ring-green-200', Icon: CheckCircle };
    if (status === 'no') return { label: 'Declined', cls: 'bg-danger-soft text-danger ring-red-200', Icon: XCircle };
    return { label: 'Maybe', cls: 'bg-warn-soft text-warn ring-amber-200', Icon: CircleHelp };
  };

  const handleDeleteRsvp = async (row: RsvpItem) => {
    const ok = await confirmToast({
      title: 'Delete this RSVP?',
      message: `Remove ${row.guestName}'s response? The guest will be marked as pending again.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setDeletingRsvpId(row.id);
    try {
      const res = await fetch(`/api/events/${event.id}/rsvps/${row.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete RSVP');
        return;
      }
      setRsvpRows(prev => prev.filter(r => r.id !== row.id));
      toast.success('RSVP deleted');
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingRsvpId(null);
    }
  };

  const handleDeleteWish = async (wish: WishBubble) => {
    const ok = await confirmToast({
      title: 'Delete this comment?',
      message: `Remove ${wish.guestName}'s wish? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    setDeletingWishId(wish.id);
    try {
      const res = await fetch(`/api/events/${event.id}/wishes/${wish.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || 'Failed to delete comment');
        return;
      }
      setWishRows(prev => prev.filter(w => w.id !== wish.id));
      toast.success('Comment deleted');
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingWishId(null);
    }
  };

  const sharePdf = async () => {
    if (rsvpRows.length === 0) {
      toast.error('There are no RSVPs to export yet');
      return;
    }

    setSharing(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const colWidths = [14, 124, 44];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      let y = margin;

      const drawTableHeader = () => {
        doc.setFillColor(13, 75, 75);
        doc.rect(margin, y, tableWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const headers = ['S/N', 'Guest Name', 'Status'];
        let x = margin;
        headers.forEach((header, i) => {
          doc.text(header, x + 3, y + 5.3);
          x += colWidths[i];
        });
        y += 8;
      };

      const drawPageHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        doc.text('RSVP List', margin, y + 2);
        y += 7;

        doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
        const nameLines = doc.splitTextToSize(event.name, tableWidth);
        doc.text(nameLines, margin, y + 2);
        y += nameLines.length * 5 + 2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        const meta = `${format(new Date(event.date), 'PPP')}  ·  ${event.venue}`;
        const metaLines = doc.splitTextToSize(meta, tableWidth);
        doc.text(metaLines, margin, y + 2);
        y += metaLines.length * 4.5 + 1;

        const summary = `${rsvpRows.length} response${rsvpRows.length === 1 ? '' : 's'}  ·  ${attendingCount} attending  ·  ${declinedCount} not attending  ·  ${maybeCount} pending`;
        doc.text(summary, margin, y + 2);
        y += 7;

        drawTableHeader();
      };

      drawPageHeader();

      let serial = 0;
      rsvpRows.forEach((row) => {
        serial += 1;
        const nameLines = doc.splitTextToSize(row.guestName || '—', colWidths[1] - 6);
        const rowHeight = Math.max(8, nameLines.length * 4.6 + 3);

        if (y + rowHeight > pageHeight - margin - 10) {
          doc.addPage();
          y = margin;
          drawPageHeader();
        }

        if (serial % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, tableWidth, rowHeight, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(String(serial), margin + 3, y + 5);

        doc.setTextColor(17, 24, 39);
        doc.text(nameLines, margin + colWidths[0] + 3, y + 5);

        const status = PDF_STATUS_LABEL[row.status] || row.status;
        if (row.status === 'yes') doc.setTextColor(21, 128, 61);
        else if (row.status === 'no') doc.setTextColor(185, 28, 28);
        else doc.setTextColor(180, 83, 9);
        doc.setFont('helvetica', 'bold');
        doc.text(status, margin + colWidths[0] + colWidths[1] + 3, y + 5);

        doc.setDrawColor(229, 231, 235);
        doc.line(margin, y + rowHeight, margin + tableWidth, y + rowHeight);
        y += rowHeight;
      });

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(156, 163, 175);
        doc.text(`Generated ${format(new Date(), 'PPpp')}`, margin, pageHeight - 8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
      }

      const safeName = event.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'event';
      const fileName = `RSVPs-${safeName}-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
      const file = new File([doc.output('blob')], fileName, { type: 'application/pdf' });

      const nav = navigator as Navigator & {
        canShare?: (data?: { files?: File[] }) => boolean;
      };
      if (typeof navigator.share === 'function' && nav.canShare?.({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            title: `RSVPs — ${event.name}`,
            text: `RSVP list for ${event.name}`,
          });
          toast.success('RSVP PDF shared');
          return;
        } catch (err) {
          // Closing the share sheet is not a failure; fall back to download
          // for anything else.
          if (err instanceof Error && err.name === 'AbortError') return;
        }
      }

      doc.save(fileName);
      toast.success('RSVP PDF downloaded');
    } catch {
      toast.error('Could not create the PDF');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Header ─── */}
      <div className="mb-6">
        <Link
          href={`/client/events/${event.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-brandtext transition mb-4"
        >
          <ArrowLeft size={16} /> Back to event
        </Link>
        <h1 className="font-display text-3xl sm:text-4xl font-black text-gray-900 leading-tight">RSVPs &amp; Wishes</h1>
        <p className="text-sm text-gray-400 mt-1">{event.name}</p>
        <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <Calendar size={15} className="text-brandtext" />
            {format(new Date(event.date), 'PPP')}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin size={15} className="text-brandtext" />
            {event.venue}
          </span>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div className="bg-white rounded-tap border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-gray-900">{rsvpRows.length}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Total Responses</p>
        </div>
        <div className="bg-white rounded-tap border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-success">{attendingCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Attending</p>
        </div>
        <div className="bg-white rounded-tap border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-danger">{declinedCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Declined</p>
        </div>
        <div className="bg-white rounded-tap border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-warn">{maybeCount}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Maybe</p>
        </div>
        <div className="bg-white rounded-tap border border-gray-100 p-4 text-center shadow-sm">
          <p className="text-2xl font-bold text-brandtext">{wishRows.length}</p>
          <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wider">Wishes</p>
        </div>
      </div>

      {rsvpRows.length === 0 && wishRows.length === 0 && (
        <div className="bg-white rounded-card border border-gray-100 shadow-sm py-16 text-center text-gray-400">
          <MessageSquareHeart size={40} className="mx-auto mb-3 opacity-30" />
          <p>No RSVPs or wishes yet.</p>
          <p className="text-sm">Once guests open their invitation and respond, their replies will appear here.</p>
        </div>
      )}

      {/* ─── RSVP list ─── */}
      {rsvpRows.length > 0 && (
        <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-tap bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <PartyPopper size={18} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">RSVP Responses</p>
                <p className="text-xs text-gray-400">
                  {rsvpRows.length} response{rsvpRows.length !== 1 ? 's' : ''} · {attendingCount} attending
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={sharePdf}
              disabled={sharing}
              className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-tap bg-brand text-white hover:bg-brand-800 active:bg-brand-deep transition disabled:opacity-45 disabled:pointer-events-none"
            >
              {sharing ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
              {sharing ? 'Preparing…' : 'Share PDF'}
            </button>
          </div>
          <div className="divide-y divide-gray-50 max-h-[32rem] overflow-y-auto">
            {rsvpRows.map(row => {
              const chip = statusChip(row.status);
              return (
                <div key={row.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50 transition">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{row.guestName}</p>
                    <p className="text-[11px] text-gray-400">
                      {format(new Date(row.createdAt), 'MMM d, yyyy · h:mm a')} · {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })} · {row.channel === 'WHATSAPP' ? 'WhatsApp' : 'Web'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full ring-1 ${chip.cls}`}>
                      <chip.Icon size={13} /> {chip.label}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRsvp(row)}
                      disabled={deletingRsvpId === row.id}
                      aria-label={`Delete RSVP from ${row.guestName}`}
                      title="Delete RSVP"
                      className="p-2 -mr-1 rounded-tap text-gray-400 hover:text-danger hover:bg-danger-soft transition disabled:opacity-50"
                    >
                      {deletingRsvpId === row.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Wishes list ─── */}
      {wishRows.length > 0 && (
        <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-tap bg-brandbg/[0.07] text-brandtext flex items-center justify-center shrink-0">
                <Heart size={18} />
              </div>
              <div>
                <p className="font-bold text-sm text-gray-800">Guest Wishes</p>
                <p className="text-xs text-gray-400">{wishRows.length} wish{wishRows.length !== 1 ? 'es' : ''}</p>
              </div>
            </div>
          </div>
          <div className="max-h-[32rem] overflow-y-auto p-4 sm:p-5">
            <WishBubbleList
              wishes={wishBubbles}
              primaryColor="#BE185D"
              accentColor="#F6C445"
              variant="tenant"
              renderAction={(wish) => (
                <button
                  type="button"
                  onClick={() => handleDeleteWish(wish)}
                  disabled={deletingWishId === wish.id}
                  aria-label={`Delete comment from ${wish.guestName}`}
                  className="mt-1 inline-flex items-center gap-1 px-1 text-[10px] font-semibold text-gray-400 hover:text-danger transition disabled:opacity-50"
                >
                  {deletingWishId === wish.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                  {deletingWishId === wish.id ? 'Deleting…' : 'Delete'}
                </button>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
