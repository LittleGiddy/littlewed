'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, X, AlertCircle, Users, ArrowLeft, CheckCircle, FileText } from 'lucide-react';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface ParsedGuest {
  name: string;
  phone: string;
  email?: string;
}

export default function ImportGuestsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<{ guestCount: number; totalGuests: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/guests/count`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setEventDetails(data))
      .catch(() => toast.error('Could not load guest limit'));
  }, [eventId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'vcf') { toast.error('Please upload a CSV or VCF file'); return; }
    setFile(f); setError(''); setLimitWarning(null);
    parseFile(f);
  };

  const parseVCard = (vcfData: string): ParsedGuest[] => {
    const guests: ParsedGuest[] = [];
    const cards = vcfData.split(/BEGIN:VCARD/i).filter(c => c.trim());
    for (const card of cards) {
      const lines = card.split(/\r?\n/);
      let name = '', phone = '', email = '';
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith('FN:') || t.startsWith('FN;')) {
          name = t.split(':').slice(1).join(':').trim();
        } else if ((t.startsWith('N:') || t.startsWith('N;')) && !name) {
          const parts = t.split(':').slice(1).join(':').split(';');
          if (parts.length >= 2) name = `${parts[1]?.trim() || ''} ${parts[0]?.trim() || ''}`.trim();
        } else if (t.startsWith('TEL') && !phone) {
          phone = t.split(':').slice(1).join(':').trim().replace(/[^0-9+]/g, '');
        } else if (t.startsWith('EMAIL') && !email) {
          email = t.split(':').slice(1).join(':').trim();
        }
      }
      if (name && phone) guests.push({ name, phone, email: email || undefined });
    }
    return guests;
  };

  const parseFile = (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') {
      Papa.parse(f, {
        header: true, skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          const guests: ParsedGuest[] = data
            .map(row => ({ name: row.name || row.Name || row.fullName || '', phone: row.phone || row.Phone || row.phoneNumber || '', email: row.email || row.Email || '' }))
            .filter((g: ParsedGuest) => g.name && g.phone);
          setParsedGuests(guests);
          checkLimit(guests.length);
          toast.success(`Parsed ${guests.length} guests from CSV`);
        },
        error: (err) => setError('Failed to parse CSV: ' + err.message),
      });
    } else if (ext === 'vcf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const guests = parseVCard(e.target?.result as string);
          setParsedGuests(guests);
          checkLimit(guests.length);
          toast.success(`Parsed ${guests.length} guests from vCard`);
        } catch (err) { setError('Failed to parse vCard: ' + (err as Error).message); }
      };
      reader.readAsText(f);
    }
  };

  const checkLimit = (newCount: number) => {
    if (!eventDetails) return;
    const { guestCount, totalGuests } = eventDetails;
    const newTotal = (totalGuests || 0) + newCount;
    if (guestCount > 0 && newTotal > guestCount) {
      setLimitWarning(`This would exceed the paid guest limit (${guestCount}). You can add up to ${guestCount - totalGuests} more guests.`);
    } else { setLimitWarning(null); }
  };

  const handleImport = async () => {
    if (!file || parsedGuests.length === 0) { toast.error('No guests to import'); return; }
    if (limitWarning) { toast.error('Cannot import – exceeds guest limit'); return; }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId as string);
    try {
      const res = await fetch('/api/guests/import', { method: 'POST', body: formData, credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        if (data.invalidCount > 0) toast.error(`⚠️ ${data.invalidCount} invalid phone number${data.invalidCount > 1 ? 's' : ''} skipped.`);
        if (data.skipped > 0) {
          let msg = `${data.skipped} duplicate${data.skipped > 1 ? 's' : ''} skipped.`;
          if (data.duplicateNames?.length) { const n = data.duplicateNames.join(', '); msg += ` Duplicates: ${n.length > 100 ? n.slice(0, 100) + '…' : n}`; }
          toast(`⚠️ ${msg}`, { icon: '⚠️' });
        }
        if (data.count > 0) toast.success(`✅ ${data.count} guest${data.count > 1 ? 's' : ''} imported!`);
        else if (data.skipped > 0) toast('ℹ️ All guests were duplicates.', { icon: 'ℹ️' });
        else toast.success(data.message || 'Import completed');
        router.push(`/client/events/${eventId}`);
      } else {
        toast.error(data.error || 'Import failed');
        if (data.error?.includes('limit') || data.error?.includes('exceeds')) setLimitWarning(data.error);
      }
    } catch { toast.error('Network error: Could not reach server.'); }
    finally { setUploading(false); }
  };

  const importFromContacts = async () => {
    if (!('contacts' in navigator)) { toast.error('Your browser does not support contact import'); return; }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
      const guests: ParsedGuest[] = contacts
        .map((c: any) => ({ name: c.name?.[0] || '', phone: c.tel?.[0] || '', email: c.email?.[0] || '' }))
        .filter((g: ParsedGuest) => g.name && g.phone);
      setParsedGuests(guests);
      checkLimit(guests.length);
      toast.success(`Imported ${guests.length} contacts`);
    } catch { toast.error('Failed to import contacts'); }
  };

  const removeFile = () => {
    setFile(null); setParsedGuests([]); setLimitWarning(''); setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const remaining = eventDetails ? Math.max(0, eventDetails.guestCount - eventDetails.totalGuests) : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .ig-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 680px; margin: 0 auto; padding: 40px 24px 72px;
          animation: igFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes igFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Back link */
        .ig-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F; text-decoration: none;
          background: rgba(13,79,79,0.07); border: 1.5px solid rgba(13,79,79,0.12);
          border-radius: 11px; padding: 7px 14px; margin-bottom: 28px;
          transition: background 0.15s;
        }
        .ig-back:hover { background: rgba(13,79,79,0.13); }

        /* Header */
        .ig-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .ig-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }
        .ig-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.4px; margin: 0 0 6px;
        }
        .ig-title span { color: #E8A598; }
        .ig-subtitle { font-size: 14px; color: #7A8FA6; line-height: 1.6; margin: 0 0 10px; }
        .ig-phone-hint {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 12px; font-weight: 600; color: #C07A20;
          background: rgba(192,122,32,0.08); border: 1px solid rgba(192,122,32,0.2);
          border-radius: 8px; padding: 5px 10px; margin-bottom: 28px;
        }

        /* Card */
        .ig-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
          margin-bottom: 16px;
          animation: igCardIn 0.55s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes igCardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ig-card-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .ig-card-body { padding: 28px; }

        /* Drop zone */
        .ig-dropzone {
          border: 2px dashed #E2EAF0; border-radius: 16px;
          padding: 40px 24px; text-align: center; cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: #FAFCFF;
        }
        .ig-dropzone:hover, .ig-dropzone.active {
          border-color: #0D4F4F; background: rgba(13,79,79,0.03);
        }
        .ig-dropzone.active { border-style: solid; }

        .ig-drop-icon {
          width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px;
          background: rgba(13,79,79,0.08); border: 1.5px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
          transition: transform 0.2s;
        }
        .ig-dropzone:hover .ig-drop-icon, .ig-dropzone.active .ig-drop-icon {
          transform: translateY(-3px);
        }
        .ig-drop-title { font-size: 15px; font-weight: 700; color: #0D1B1B; margin-bottom: 4px; }
        .ig-drop-sub { font-size: 13px; color: #9BAAB8; font-weight: 500; }
        .ig-drop-types {
          display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 12px;
        }
        .ig-type-pill {
          font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
          background: rgba(13,79,79,0.08); color: #0D4F4F;
          border: 1px solid rgba(13,79,79,0.15);
        }

        /* Contact import btn */
        .ig-contacts-btn {
          width: 100%; padding: 13px; border-radius: 13px;
          border: 1.5px solid #E2EAF0; background: white;
          color: #4A6072; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          margin-top: 12px; transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .ig-contacts-btn:hover { border-color: #0D4F4F; color: #0D4F4F; background: rgba(13,79,79,0.03); }

        /* File row */
        .ig-file-row {
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(13,79,79,0.04); border: 1.5px solid rgba(13,79,79,0.12);
          border-radius: 13px; padding: 12px 16px; margin-bottom: 16px;
        }
        .ig-file-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .ig-file-icon {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          background: rgba(13,79,79,0.1); display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .ig-file-name { font-size: 14px; font-weight: 700; color: #0D1B1B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ig-file-size { font-size: 11.5px; color: #9BAAB8; margin-top: 1px; }
        .ig-file-remove {
          background: none; border: none; cursor: pointer;
          color: #C8D4DE; padding: 4px; transition: color 0.15s; flex-shrink: 0;
        }
        .ig-file-remove:hover { color: #C0392B; }

        /* Limit bar */
        .ig-limit-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 14px;
          padding: 14px 18px; margin-bottom: 14px;
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .ig-limit-stat { font-size: 13px; color: #7A8FA6; }
        .ig-limit-stat strong { color: #0D1B1B; font-weight: 700; }
        .ig-limit-sep { width: 1px; height: 20px; background: #E2EAF0; flex-shrink: 0; }

        /* Alerts */
        .ig-alert {
          display: flex; align-items: flex-start; gap: 10px;
          border-radius: 13px; padding: 13px 16px; margin-bottom: 14px;
          font-size: 13px; font-weight: 600; line-height: 1.55;
        }
        .ig-alert.error {
          background: #FEF2F2; border: 1.5px solid #FECACA; color: #C0392B;
        }
        .ig-alert.warning {
          background: rgba(192,122,32,0.07); border: 1.5px solid rgba(192,122,32,0.25); color: #92580A;
        }
        .ig-alert-icon { flex-shrink: 0; margin-top: 1px; }

        /* Preview table */
        .ig-preview-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 18px;
          overflow: hidden; margin-bottom: 20px;
        }
        .ig-preview-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 20px; border-bottom: 1.5px solid #F0F4F8;
        }
        .ig-preview-title {
          font-family: 'Playfair Display', serif;
          font-size: 15px; font-weight: 800; color: #0D1B1B;
        }
        .ig-preview-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 10px; border-radius: 20px;
        }
        .ig-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .ig-table th {
          padding: 10px 18px; text-align: left; background: #F7F9FB;
          font-size: 10.5px; font-weight: 700; letter-spacing: 1px;
          color: #9BAAB8; text-transform: uppercase; border-bottom: 1.5px solid #F0F4F8;
        }
        .ig-table td { padding: 12px 18px; border-bottom: 1px solid #F7F9FB; color: #0D1B1B; font-weight: 500; }
        .ig-table tr:last-child td { border-bottom: none; }
        .ig-table tbody tr { transition: background 0.12s; }
        .ig-table tbody tr:hover { background: #F7FAFA; }
        .ig-table-more { padding: 12px 18px; text-align: center; font-size: 12.5px; color: #9BAAB8; font-weight: 600; }

        /* Action buttons */
        .ig-actions { display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }

        .ig-cancel-btn {
          padding: 12px 20px; border-radius: 12px;
          border: 1.5px solid #E2EAF0; background: white;
          color: #4A6072; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .ig-cancel-btn:hover { border-color: #0D4F4F; color: #0D4F4F; }

        .ig-import-btn {
          padding: 12px 24px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(13,79,79,0.32);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
        }
        .ig-import-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.4); }
        .ig-import-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ig-spinner {
          width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: igSpin 0.7s linear infinite;
        }
        @keyframes igSpin { to { transform: rotate(360deg); } }

        @media (max-width: 520px) {
          .ig-wrap { padding: 24px 16px 56px; }
          .ig-title { font-size: 26px; }
          .ig-card-body { padding: 20px 18px; }
          .ig-limit-sep { display: none; }
          .ig-actions { flex-direction: column-reverse; }
          .ig-cancel-btn, .ig-import-btn { width: 100%; justify-content: center; }
        }
      `}</style>

      <div className="ig-wrap">

        {/* Back */}
        <Link href={`/client/events/${eventId}`} className="ig-back">
          <ArrowLeft size={14} /> Back to Event
        </Link>

        {/* Header */}
        <div className="ig-eyebrow"><div className="ig-eyebrow-dot" />Guest Import</div>
        <h1 className="ig-title">Import <span>Guests</span></h1>
        <p className="ig-subtitle">
          Upload a <strong>CSV</strong> or <strong>vCard (.vcf)</strong> file, or import directly from your phone contacts.
        </p>
        <div className="ig-phone-hint">
          <AlertCircle size={13} />
          Phone numbers must start with + and include country code — e.g. +255712345678
        </div>

        {/* Upload card */}
        <div className="ig-card">
          <div className="ig-card-bar" />
          <div className="ig-card-body">

            {!file ? (
              <>
                {/* Drop zone */}
                <div
                  className={`ig-dropzone${dragActive ? ' active' : ''}`}
                  onDragEnter={handleDrag} onDragLeave={handleDrag}
                  onDragOver={handleDrag} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="ig-drop-icon"><Upload size={24} /></div>
                  <div className="ig-drop-title">Drop your file here, or click to browse</div>
                  <div className="ig-drop-sub">CSV columns: name, phone, email</div>
                  <div className="ig-drop-types">
                    <span className="ig-type-pill">CSV</span>
                    <span className="ig-type-pill">VCF</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".csv,.vcf" onChange={handleFileSelect} style={{ display: 'none' }} />
                </div>

                {/* Phone contacts */}
                {'contacts' in navigator && (
                  <button className="ig-contacts-btn" onClick={importFromContacts}>
                    <Users size={15} /> Import from Phone Contacts
                  </button>
                )}
              </>
            ) : (
              <>
                {/* File row */}
                <div className="ig-file-row">
                  <div className="ig-file-left">
                    <div className="ig-file-icon"><FileSpreadsheet size={18} /></div>
                    <div>
                      <div className="ig-file-name">{file.name}</div>
                      <div className="ig-file-size">{(file.size / 1024).toFixed(1)} KB</div>
                    </div>
                  </div>
                  <button className="ig-file-remove" onClick={removeFile} title="Remove file">
                    <X size={18} />
                  </button>
                </div>

                {/* Limit bar */}
                {eventDetails && (
                  <div className="ig-limit-card">
                    <div className="ig-limit-stat">Guest limit: <strong>{eventDetails.guestCount}</strong></div>
                    <div className="ig-limit-sep" />
                    <div className="ig-limit-stat">Current: <strong>{eventDetails.totalGuests}</strong></div>
                    <div className="ig-limit-sep" />
                    <div className="ig-limit-stat">Remaining: <strong style={{ color: remaining === 0 ? '#C0392B' : '#1A7A4A' }}>{remaining}</strong></div>
                  </div>
                )}

                {/* Alerts */}
                {error && (
                  <div className="ig-alert error">
                    <AlertCircle size={15} className="ig-alert-icon" /> {error}
                  </div>
                )}
                {limitWarning && (
                  <div className="ig-alert warning">
                    <AlertCircle size={15} className="ig-alert-icon" /> {limitWarning}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Preview table */}
        {parsedGuests.length > 0 && (
          <div className="ig-preview-card" style={{ animation: 'igCardIn 0.45s cubic-bezier(0.16,1,0.3,1) both' }}>
            <div className="ig-preview-header">
              <div className="ig-preview-title">Preview</div>
              <div className="ig-preview-badge">{parsedGuests.length} guest{parsedGuests.length !== 1 ? 's' : ''}</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="ig-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedGuests.slice(0, 10).map((guest, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700 }}>{guest.name}</td>
                      <td>{guest.phone}</td>
                      <td style={{ color: guest.email ? '#0D1B1B' : '#C8D4DE' }}>{guest.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedGuests.length > 10 && (
                <div className="ig-table-more">+ {parsedGuests.length - 10} more guests not shown</div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {file && (
          <div className="ig-actions">
            <button className="ig-cancel-btn" onClick={removeFile}>Cancel</button>
            <button
              className="ig-import-btn"
              onClick={handleImport}
              disabled={uploading || !!limitWarning || parsedGuests.length === 0}
            >
              {uploading ? (
                <><div className="ig-spinner" /> Importing…</>
              ) : (
                <><CheckCircle size={15} /> Import {parsedGuests.length} guest{parsedGuests.length !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        )}

      </div>
    </>
  );
}