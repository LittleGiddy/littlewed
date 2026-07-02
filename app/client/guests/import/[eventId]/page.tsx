'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Upload, FileSpreadsheet, X, AlertCircle, Loader2, Users, Download, Check, ChevronDown, AlertTriangle, CheckCircle, Eye, EyeOff, Phone, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

interface ParsedGuest {
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  isValid: boolean;
  statusMessage?: string;
}

interface ColumnMapping {
  [key: string]: 'name' | 'phone' | 'email' | 'skip';
}

export default function ImportGuestsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [parsedGuests, setParsedGuests] = useState<ParsedGuest[]>([]);
  const [rawData, setRawData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [uploading, setUploading] = useState(false);
  const [importStatus, setImportStatus] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [eventDetails, setEventDetails] = useState<{ guestCount: number; totalGuests: number } | null>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [showValidOnly, setShowValidOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`/api/events/${eventId}/guests/count`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setEventDetails(data))
      .catch(() => toast.error('Could not load guest limit'));
  }, [eventId]);

  // ─── Phone normalization ──────────────────────────────────────────────
  const normalizePhone = (phone: string): { normalized: string; isValid: boolean; message?: string } => {
    if (!phone) return { normalized: '', isValid: false, message: 'Empty phone number' };
    let cleaned = phone.replace(/[\s\-()\.]/g, '');
    let hasPlus = cleaned.startsWith('+');
    if (hasPlus) cleaned = cleaned.substring(1);
    cleaned = cleaned.replace(/\D/g, '');
    if (!cleaned) return { normalized: '', isValid: false, message: 'No digits found' };

    if (cleaned.startsWith('0')) {
      if (cleaned.length === 10) {
        cleaned = '255' + cleaned.substring(1);
      } else {
        return { normalized: '', isValid: false, message: 'Invalid local number format (expected 10 digits after 0)' };
      }
    } else if (cleaned.startsWith('255')) {
      if (cleaned.length !== 12 && cleaned.length !== 13) {
        return { normalized: '', isValid: false, message: 'Invalid length for international number' };
      }
    } else if (cleaned.length === 9) {
      cleaned = '255' + cleaned;
    } else if (cleaned.length === 10 && !cleaned.startsWith('255')) {
      cleaned = '255' + cleaned.substring(1);
    } else {
      return { normalized: '+' + cleaned, isValid: false, message: 'Unknown format, imported as is' };
    }
    if (!cleaned.startsWith('255')) {
      return { normalized: '+' + cleaned, isValid: false, message: 'Does not start with Tanzanian country code (255)' };
    }
    if (cleaned.length < 12 || cleaned.length > 13) {
      return { normalized: '+' + cleaned, isValid: false, message: 'Invalid length (expected 12-13 digits)' };
    }
    return { normalized: '+' + cleaned, isValid: true };
  };

  // ─── Sample CSV download ───────────────────────────────────────────────
  const downloadSampleCSV = () => {
    const headers = ['name', 'phone', 'email'];
    const sampleData = [
      ['John Doe', '+255712345678', 'john@example.com'],
      ['Jane Smith', '+255755123456', 'jane@example.com'],
    ];
    const csv = [headers.join(','), ...sampleData.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-guests.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── File handling ──────────────────────────────────────────────────────

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
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'vcf') {
      toast.error('Please upload a CSV, Excel, or VCF file');
      return;
    }
    setFile(file);
    setError('');
    setLimitWarning(null);
    parseFile(file);
  };

  // ─── Import from Phone Contacts ──────────────────────────────────────

  const importFromPhone = async () => {
    if (!('contacts' in navigator)) {
      toast.error('Your browser does not support contact import');
      return;
    }
    try {
      setUploading(true);
      setImportStatus('Loading contacts...');
      const contacts = await (navigator as any).contacts.select(['name', 'tel', 'email'], { multiple: true });
      setImportStatus('Formatting contacts...');
      const guests: ParsedGuest[] = contacts
        .map((c: any) => {
          const name = c.name?.[0] || '';
          const phone = c.tel?.[0] || '';
          const email = c.email?.[0] || '';
          const norm = normalizePhone(phone);
          return {
            name,
            phone,
            normalizedPhone: norm.normalized,
            isValid: norm.isValid,
            statusMessage: norm.message,
            email,
          };
        })
        .filter((g: ParsedGuest) => g.name && g.phone); // ✅ explicit type
      setParsedGuests(guests);
      checkLimit(guests.filter(g => g.isValid).length);
      setStep('preview');
      setImportStatus('');
      toast.success(`Imported ${guests.length} contacts`);
    } catch (err) {
      toast.error('Failed to import contacts');
    } finally {
      setUploading(false);
      setImportStatus('');
    }
  };

  // ─── Parsing ────────────────────────────────────────────────────────────

  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const data = results.data as any[];
          if (data.length === 0) {
            setError('CSV is empty');
            return;
          }
          const headers = Object.keys(data[0]);
          setHeaders(headers);
          setRawData(data);
          const autoMap: ColumnMapping = {};
          headers.forEach(h => {
            const lower = h.toLowerCase().trim();
            if (['name', 'full name', 'fullname', 'guest name', 'names'].includes(lower)) autoMap[h] = 'name';
            else if (['phone', 'mobile', 'telephone', 'phone number', 'tel', 'cell'].includes(lower)) autoMap[h] = 'phone';
            else if (['email', 'mail', 'e-mail', 'email address'].includes(lower)) autoMap[h] = 'email';
            else autoMap[h] = 'skip';
          });
          setMapping(autoMap);
          setStep('map');
          toast.success(`CSV parsed: ${data.length} rows found`);
        },
        error: (err) => {
          setError('Failed to parse CSV: ' + err.message);
        },
      });
    } else if (ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(sheet);
          if (jsonData.length === 0) {
            setError('Excel file is empty');
            return;
          }
          const headers = Object.keys(jsonData[0] as any);
          setHeaders(headers);
          setRawData(jsonData as any[]);
          const autoMap: ColumnMapping = {};
          headers.forEach(h => {
            const lower = h.toLowerCase().trim();
            if (['name', 'full name', 'fullname', 'guest name', 'names'].includes(lower)) autoMap[h] = 'name';
            else if (['phone', 'mobile', 'telephone', 'phone number', 'tel', 'cell'].includes(lower)) autoMap[h] = 'phone';
            else if (['email', 'mail', 'e-mail', 'email address'].includes(lower)) autoMap[h] = 'email';
            else autoMap[h] = 'skip';
          });
          setMapping(autoMap);
          setStep('map');
          toast.success(`Excel parsed: ${jsonData.length} rows found`);
        } catch (err) {
          setError('Failed to parse Excel: ' + (err as Error).message);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'vcf') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const vcfData = e.target?.result as string;
          const guests = parseVCard(vcfData);
          const normalized = guests.map(g => {
            const norm = normalizePhone(g.phone);
            return {
              ...g,
              normalizedPhone: norm.normalized,
              isValid: norm.isValid,
              statusMessage: norm.message,
            };
          });
          setParsedGuests(normalized);
          checkLimit(normalized.filter(g => g.isValid).length);
          setStep('preview');
          toast.success(`Parsed ${normalized.length} guests from vCard`);
        } catch (err) {
          setError('Failed to parse vCard: ' + (err as Error).message);
        }
      };
      reader.readAsText(file);
    }
  };

  // ─── vCard parser ──────────────────────────────────────────────────────
  const parseVCard = (vcfData: string): { name: string; phone: string; email?: string }[] => {
    const guests: { name: string; phone: string; email?: string }[] = [];
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

  // ─── Apply mapping ──────────────────────────────────────────────────────

  const applyMapping = () => {
    const nameCol = Object.keys(mapping).find(k => mapping[k] === 'name');
    const phoneCol = Object.keys(mapping).find(k => mapping[k] === 'phone');
    const emailCol = Object.keys(mapping).find(k => mapping[k] === 'email');
    if (!nameCol || !phoneCol) {
      setError('Please map the "name" and "phone" columns.');
      return;
    }
    const guests: ParsedGuest[] = rawData.map(row => {
      const name = row[nameCol]?.toString().trim() || '';
      const phone = row[phoneCol]?.toString().trim() || '';
      const email = emailCol ? row[emailCol]?.toString().trim() : undefined;
      const norm = normalizePhone(phone);
      return {
        name,
        phone,
        normalizedPhone: norm.normalized,
        isValid: norm.isValid,
        statusMessage: norm.message,
        email,
      };
    }).filter(g => g.name && g.phone);
    setParsedGuests(guests);
    checkLimit(guests.filter(g => g.isValid).length);
    setStep('preview');
    toast.success(`Mapped ${guests.length} guests (${guests.filter(g => g.isValid).length} valid)`);
  };

  // ─── Import ─────────────────────────────────────────────────────────────

  const handleImport = async () => {
    const validGuests = parsedGuests.filter(g => g.isValid);
    if (validGuests.length === 0) {
      toast.error('No valid guests to import');
      return;
    }
    if (limitWarning) {
      toast.error('Cannot import – exceeds guest limit');
      return;
    }
    const guestsToImport = validGuests.map(g => ({
      name: g.name,
      phone: g.normalizedPhone,
      email: g.email,
    }));
    setUploading(true);
    setImportStatus('Importing guests...');
    try {
      const res = await fetch('/api/guests/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests: guestsToImport, eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`✅ ${data.count} guests imported successfully!`);
        router.push(`/client/events/${eventId}`);
      } else {
        toast.error(data.error || 'Import failed');
        if (data.error?.includes('limit') || data.error?.includes('exceeds')) {
          setLimitWarning(data.error);
        }
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUploading(false);
      setImportStatus('');
    }
  };

  // ─── Remove file ──────────────────────────────────────────────────────

  const removeFile = () => {
    setFile(null);
    setParsedGuests([]);
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setLimitWarning(null);
    setError('');
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Export invalid guests ─────────────────────────────────────────────

  const downloadInvalid = () => {
    const invalid = parsedGuests.filter(g => !g.isValid);
    if (invalid.length === 0) {
      toast('No invalid guests to export', { icon: 'ℹ️' });
      return;
    }
    const header = 'Name,Original Phone,Reason';
    const rows = invalid.map(g => `${g.name},${g.phone},${g.statusMessage || 'Invalid'}`);
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invalid-guests.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ─── Render ────────────────────────────────────────────────────────────

  const validCount = parsedGuests.filter(g => g.isValid).length;
  const invalidCount = parsedGuests.filter(g => !g.isValid).length;

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20">
      {/* Back button */}
      <Link
        href={`/client/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6"
      >
        <ArrowLeft size={14} /> Back to Event
      </Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Import Guests</h1>
        <button
          onClick={downloadSampleCSV}
          className="text-sm text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] px-3 py-1.5 rounded-lg hover:bg-[rgba(13,79,79,0.14)] transition flex items-center gap-1"
        >
          <Download size={14} /> Sample CSV
        </button>
      </div>
      <p className="text-gray-500 mb-6">
        Upload a <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>, or <strong>vCard (.vcf)</strong> file, or import from your phone contacts.
        For CSV/Excel, you'll be able to map columns to our fields. Phone numbers will be auto‑formatted to international format.
      </p>

      {/* Import from Phone Contacts (mobile) */}
      {'contacts' in navigator && step === 'upload' && (
        <button
          onClick={importFromPhone}
          disabled={uploading}
          className="w-full mb-4 py-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-blue-100 transition disabled:opacity-50"
        >
          <Phone size={18} /> Import from Phone Contacts
        </button>
      )}

      {/* Drag & Drop Area */}
      {step === 'upload' && (
        <div
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${
            dragActive ? 'border-[#0D4F4F] bg-[rgba(13,79,79,0.04)]' : 'border-gray-300 bg-white hover:bg-gray-50'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Drag & drop your file here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Supports CSV, Excel, and VCF</p>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.vcf" onChange={handleFileSelect} className="hidden" />
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>
      )}

      {/* Column Mapping Step */}
      {step === 'map' && rawData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">{file?.name}</span>
              <span className="text-xs text-gray-500">({rawData.length} rows)</span>
            </div>
            <button onClick={removeFile} className="text-gray-400 hover:text-red-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
            <h2 className="font-semibold px-4 py-3 border-b">Map Columns</h2>
            <div className="p-4">
              <p className="text-sm text-gray-600 mb-4">
                Map the columns in your file to our fields. Select <strong>Skip</strong> for columns you don't need.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {headers.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate w-1/2">{h}</span>
                    <select
                      className="border rounded-md px-2 py-1 text-sm"
                      value={mapping[h] || 'skip'}
                      onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as any })}
                    >
                      <option value="skip">Skip</option>
                      <option value="name">Name</option>
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                ))}
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <button
                onClick={applyMapping}
                className="mt-4 bg-[#0D4F4F] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0A3D3D] transition"
              >
                Apply Mapping & Preview
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Preview and Import */}
      {step === 'preview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex items-center justify-between bg-gray-50 rounded-xl p-3 mb-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">{file?.name}</span>
              <span className="text-xs text-gray-500">({parsedGuests.length} guests)</span>
            </div>
            <button onClick={removeFile} className="text-gray-400 hover:text-red-500">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Summary */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">{validCount} valid</span>
            </div>
            {invalidCount > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">{invalidCount} invalid</span>
                <button
                  onClick={downloadInvalid}
                  className="text-xs text-amber-700 underline hover:no-underline"
                >
                  Export invalid
                </button>
              </div>
            )}
            <div className="text-sm text-gray-500">
              Remaining slots: {eventDetails ? Math.max(0, eventDetails.guestCount - eventDetails.totalGuests) : '—'}
            </div>
          </div>

          {eventDetails && (
            <div className="text-sm text-gray-600 mb-4">
              <span className="font-semibold">Guest limit:</span> {eventDetails.guestCount}
              <span className="mx-2">•</span>
              <span className="font-semibold">Current guests:</span> {eventDetails.totalGuests}
            </div>
          )}

          {limitWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> {limitWarning}
            </div>
          )}

          {parsedGuests.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <h2 className="font-semibold px-4 py-3 border-b flex items-center justify-between">
                <span>Preview ({parsedGuests.length} guests)</span>
                <label className="flex items-center gap-2 text-sm font-normal">
                  <input
                    type="checkbox"
                    checked={skipInvalid}
                    onChange={() => setSkipInvalid(!skipInvalid)}
                  />
                  Skip invalid
                </label>
              </h2>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Phone (normalized)</th>
                      <th className="px-4 py-2 text-left">Email</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(showValidOnly ? parsedGuests.filter(g => g.isValid) : parsedGuests).slice(0, 20).map((guest, idx) => (
                      <tr key={idx} className={guest.isValid ? '' : 'bg-amber-50/50'}>
                        <td className="px-4 py-2">{guest.name}</td>
                        <td className="px-4 py-2 font-mono text-sm">
                          {guest.normalizedPhone || guest.phone}
                        </td>
                        <td className="px-4 py-2">{guest.email || '—'}</td>
                        <td className="px-4 py-2">
                          {guest.isValid ? (
                            <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                              <CheckCircle size={12} /> Valid
                            </span>
                          ) : (
                            <span className="text-amber-600 text-xs font-medium flex items-center gap-1">
                              <AlertTriangle size={12} /> {guest.statusMessage || 'Invalid'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {parsedGuests.length > 20 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-gray-400 text-center">
                          + {parsedGuests.length - 20} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center px-4 py-2 border-t">
                <button
                  onClick={() => setShowValidOnly(!showValidOnly)}
                  className="text-sm text-[#0D4F4F] hover:underline"
                >
                  {showValidOnly ? 'Show all' : 'Show valid only'}
                </button>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3 justify-end">
            <button
              onClick={removeFile}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={uploading || validCount === 0 || !!limitWarning}
              className="px-6 py-2 bg-[#0D4F4F] text-white rounded-lg hover:bg-[#0A3D3D] disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {importStatus || 'Importing...'}
                </>
              ) : (
                <>Import {skipInvalid ? validCount : parsedGuests.length} guests</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}