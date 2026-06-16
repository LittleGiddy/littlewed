'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

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
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) handleFile(selectedFile);
  };

  const handleFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'vcf') {
      toast.error('Please upload a CSV or VCF file');
      return;
    }
    setFile(file);
    setError('');
    setLimitWarning(null);
    parseFile(file);
  };

  const parseVCard = (vcfData: string): ParsedGuest[] => {
    const guests: ParsedGuest[] = [];
    const cards = vcfData.split(/BEGIN:VCARD/i).filter(card => card.trim());

    for (const card of cards) {
      const lines = card.split(/\r?\n/);
      let name = '';
      let phone = '';
      let email = '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('FN:') || trimmed.startsWith('FN;')) {
          const fnParts = trimmed.split(':');
          if (fnParts.length > 1) name = fnParts.slice(1).join(':').trim();
        } else if (trimmed.startsWith('N:') || trimmed.startsWith('N;')) {
          const nParts = trimmed.split(':');
          if (nParts.length > 1) {
            const nameParts = nParts.slice(1).join(':').split(';');
            if (nameParts.length >= 2) {
              const first = nameParts[1]?.trim() || '';
              const last = nameParts[0]?.trim() || '';
              if (first || last) name = `${first} ${last}`.trim();
            }
          }
        } else if (trimmed.startsWith('TEL') && !phone) {
          const telParts = trimmed.split(':');
          if (telParts.length > 1) {
            phone = telParts.slice(1).join(':').trim();
            phone = phone.replace(/[^0-9+]/g, '');
          }
        } else if (trimmed.startsWith('EMAIL') && !email) {
          const emailParts = trimmed.split(':');
          if (emailParts.length > 1) {
            email = emailParts.slice(1).join(':').trim();
          }
        }
      }

      if (name && phone) {
        guests.push({ name, phone, email: email || undefined });
      }
    }

    return guests;
  };

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          const guests: ParsedGuest[] = data
            .map((row) => ({
              name: row.name || row.Name || row.fullName || '',
              phone: row.phone || row.Phone || row.phoneNumber || '',
              email: row.email || row.Email || '',
            }))
            .filter((g: ParsedGuest) => g.name && g.phone);
          setParsedGuests(guests);
          checkLimit(guests.length);
          toast.success(`Parsed ${guests.length} guests from CSV`);
        },
        error: (err) => {
          setError('Failed to parse CSV: ' + err.message);
        },
      });
    } else if (ext === 'vcf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const vcfData = e.target?.result as string;
          const guests = parseVCard(vcfData);
          setParsedGuests(guests);
          checkLimit(guests.length);
          toast.success(`Parsed ${guests.length} guests from vCard`);
        } catch (err) {
          setError('Failed to parse vCard: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
    }
  };

  const checkLimit = (newCount: number) => {
    if (!eventDetails) return;
    const { guestCount, totalGuests } = eventDetails;
    const currentTotal = totalGuests || 0;
    const newTotal = currentTotal + newCount;
    if (guestCount > 0 && newTotal > guestCount) {
      setLimitWarning(
        `This would exceed the paid guest limit (${guestCount}). You can add up to ${
          guestCount - currentTotal
        } more guests.`
      );
    } else {
      setLimitWarning(null);
    }
  };

  const handleImport = async () => {
    if (!file || parsedGuests.length === 0) {
      toast.error('No guests to import');
      return;
    }
    if (limitWarning) {
      toast.error('Cannot import – exceeds guest limit');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId as string);

    try {
      const res = await fetch('/api/guests/import', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        if (data.invalidCount > 0) {
          toast.error(`⚠️ ${data.invalidCount} invalid phone number${data.invalidCount > 1 ? 's' : ''} skipped.`);
        }
        if (data.skipped > 0) {
          let duplicateMsg = `${data.skipped} duplicate${data.skipped > 1 ? 's' : ''} skipped.`;
          if (data.duplicateNames && data.duplicateNames.length > 0) {
            const names = data.duplicateNames.join(', ');
            const displayNames = names.length > 100 ? names.slice(0, 100) + '...' : names;
            duplicateMsg += ` Duplicates: ${displayNames}`;
          }
          toast(`⚠️ ${duplicateMsg}`, { icon: '⚠️' });
        }
        if (data.count > 0) {
          toast.success(`✅ ${data.count} guest${data.count > 1 ? 's' : ''} imported successfully!`);
        } else if (data.skipped > 0 && data.invalidCount === 0) {
          toast('ℹ️ All guests were duplicates. No new guests added.', { icon: 'ℹ️' });
        } else if (data.skipped === 0 && data.invalidCount > 0) {
          toast('ℹ️ No valid guests to import.', { icon: 'ℹ️' });
        } else {
          toast.success(data.message || 'Import completed');
        }
        router.push(`/client/events/${eventId}`);
      } else {
        toast.error(data.error || 'Import failed');
        if (data.error?.includes('limit') || data.error?.includes('exceeds')) {
          setLimitWarning(data.error);
        }
      }
    } catch (err) {
      console.error('Import fetch error:', err);
      toast.error('Network error: Could not reach server.');
    } finally {
      setUploading(false);
    }
  };

  const importFromContacts = async () => {
    if (!('contacts' in navigator)) {
      toast.error('Your browser does not support contact import');
      return;
    }
    try {
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
      const guests: ParsedGuest[] = contacts
        .map((c: any) => ({
          name: c.name?.[0] || '',
          phone: c.tel?.[0] || '',
          email: c.email?.[0] || '',
        }))
        .filter((g: ParsedGuest) => g.name && g.phone);
      setParsedGuests(guests);
      checkLimit(guests.length);
      toast.success(`Imported ${guests.length} contacts`);
    } catch (err) {
      toast.error('Failed to import contacts');
    }
  };

  const removeFile = () => {
    setFile(null);
    setParsedGuests([]);
    setLimitWarning(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pb-20">
      <h1 className="text-2xl font-bold mb-2">Import Guests</h1>
      <p className="text-gray-500 mb-6">
        Upload a <strong>CSV</strong> or <strong>vCard (.vcf)</strong> file, or import from your phone contacts.
        <br />
        <span className="text-sm text-amber-600">Phone numbers must start with '+' and include the country code (e.g., +255712345678).</span>
      </p>

      <div
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
          dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:bg-gray-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">Drag & drop your file here, or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">Supports CSV and VCF</p>
        <input ref={fileInputRef} type="file" accept=".csv,.vcf" onChange={handleFileSelect} className="hidden" />
      </div>

      {'contacts' in navigator && (
        <button
          onClick={importFromContacts}
          className="mt-4 w-full py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition"
        >
          <Users className="w-4 h-4" /> Import from Phone Contacts
        </button>
      )}

      {file && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">{file.name}</span>
              <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
            <button onClick={removeFile} className="text-gray-400 hover:text-red-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {eventDetails && (
            <div className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">Guest limit:</span> {eventDetails.guestCount}
              <span className="mx-2">•</span>
              <span className="font-semibold">Current guests:</span> {eventDetails.totalGuests}
              <span className="mx-2">•</span>
              <span className="font-semibold">Remaining:</span>{' '}
              {Math.max(0, eventDetails.guestCount - eventDetails.totalGuests)}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          {limitWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {limitWarning}
            </div>
          )}

          {parsedGuests.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <h2 className="font-semibold px-4 py-3 border-b">Preview ({parsedGuests.length} guests)</h2>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {parsedGuests.slice(0, 10).map((guest, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{guest.name}</td>
                      <td className="px-4 py-2">{guest.phone}</td>
                      <td className="px-4 py-2">{guest.email || '—'}</td>
                    </tr>
                  ))}
                  {parsedGuests.length > 10 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-2 text-gray-400 text-center">
                        + {parsedGuests.length - 10} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={removeFile}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={uploading || !!limitWarning || parsedGuests.length === 0}
              className="px-6 py-2 bg-[#0D4F4F] text-white rounded-lg hover:bg-[#0A3D3D] disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                </>
              ) : (
                <>Import {parsedGuests.length} guests</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}