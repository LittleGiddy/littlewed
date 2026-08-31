'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Upload, FileSpreadsheet, X, AlertCircle, Loader2, Download,
  AlertTriangle, CheckCircle, Phone, ArrowLeft, Pencil, Save, XCircle, FileText, Plus
} from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import RequestCreditsModal from '@/app/components/RequestCreditsModal';

interface ParsedGuest {
  name: string;
  phone: string;
  normalizedPhone: string;
  email?: string;
  guestType?: string;
  title?: string;
  cardGroupId?: string;
  isValid: boolean;
  statusMessage?: string;
  cardNumber?: string;
}

interface ColumnMapping {
  [key: string]: 'name' | 'phone' | 'email' | 'guestType' | 'title' | 'cardGroupId' | 'skip';
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
  const [eventDetails, setEventDetails] = useState<{ guestCount: number; totalGuests: number; credits: number } | null>(null);
  const [creditDeficit, setCreditDeficit] = useState(0);
  const [showCreditRequest, setShowCreditRequest] = useState(false);
  const [step, setStep] = useState<'upload' | 'map' | 'preview'>('upload');
  const [skipInvalid, setSkipInvalid] = useState(true);
  const [showValidOnly, setShowValidOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Editing state ──────────────────────────────────────────────────
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editField, setEditField] = useState<'name' | 'title' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [detectWhatsApp, setDetectWhatsApp] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${eventId}/guests/count`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setEventDetails(data))
      .catch(() => toast.error('Could not load guest limit'));
  }, [eventId]);

  const normalizePhone = (phone: string): { normalized: string; isValid: boolean; message?: string } => {
    if (!phone) return { normalized: '', isValid: false, message: 'Empty phone number' };
    let cleaned = phone.replace(/[\s\-()\.]/g, '');
    const hasPlus = cleaned.startsWith('+');
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

  // ─── Title Extraction Helper ──────────────────────────────────────────
  const extractTitle = (name: string): { cleanName: string; title?: string } => {
    const titlePatterns = [
      { pattern: /^(MR\.?\s+)/i, title: 'Mr' },
      { pattern: /^(MRS\.?\s+)/i, title: 'Mrs' },
      { pattern: /^(MS\.?\s+)/i, title: 'Ms' },
      { pattern: /^(MISS\.?\s+)/i, title: 'Miss' },
      { pattern: /^(DR\.?\s+)/i, title: 'Dr' },
      { pattern: /^(PROF\.?\s+)/i, title: 'Prof' },
      { pattern: /^(SIR\.?\s+)/i, title: 'Sir' },
      { pattern: /^(MR\/MRS\.?\s+)/i, title: 'Mr/Mrs' },
      { pattern: /^(MR\s+&\s+MRS\.?\s+)/i, title: 'Mr & Mrs' },
      { pattern: /^(MR\.?\s+&\s+MRS\.?\s+)/i, title: 'Mr & Mrs' },
      { pattern: /^(MR\.?\s+AND\s+MRS\.?\s+)/i, title: 'Mr & Mrs' },
      { pattern: /^(R\/MRS\.?\s+)/i, title: 'Mr/Mrs' },
      { pattern: /^([A-Z]+\/[A-Z]+\.?\s+)/i, title: 'Mr/Mrs' },
      { pattern: /^([A-Z]+\s+&\s+[A-Z]+\.?\s+)/i, title: 'Mr & Mrs' },
    ];

    for (const { pattern, title } of titlePatterns) {
      if (pattern.test(name)) {
        const cleanName = name.replace(pattern, '').trim();
        return { cleanName, title };
      }
    }

    return { cleanName: name };
  };

  // ─── Edit Functions ──────────────────────────────────────────────────
  const startEditing = (index: number, field: 'name' | 'title', currentValue: string) => {
    setEditingIndex(index);
    setEditField(field);
    setEditValue(currentValue);
  };

  const saveEdit = (index: number) => {
    const updated = [...parsedGuests];
    const field = editField;
    if (field === 'name') {
      updated[index].name = editValue.trim() || updated[index].name;
    } else if (field === 'title') {
      updated[index].title = editValue.trim() || updated[index].title;
    }
    setParsedGuests(updated);
    setEditingIndex(null);
    setEditField(null);
    setEditValue('');
    toast.success(`${field === 'name' ? 'Name' : 'Title'} updated`);
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditField(null);
    setEditValue('');
  };

  // ─── PDF Parser (Enhanced for Tables) ──────────────────────────────
  const parsePDFGuests = (text: string): { name: string; phone: string; cardNumber: string; guestType: string; title?: string }[] => {
    const guests: { name: string; phone: string; cardNumber: string; guestType: string; title?: string }[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 5) continue;

      // Skip header rows
      if (/^(SN|NO|#|S\/N|NAME|PHONE|CARD|TYPE|GUEST|TITLE)/i.test(trimmed)) continue;

      // Pattern 1: SN NAME PHONE CARD (e.g., "1 ADRIAN 766084935 DOUBLE")
      let match = trimmed.match(/^(\d+)\s+([A-Za-z\s\.&]+)\s+(\+\d+|\d+)\s+([A-Z]+)$/);
      if (match) {
        const name = match[2].trim();
        const phone = match[3];
        const cardType = match[4];
        const { cleanName, title } = extractTitle(name);

        guests.push({
          name: cleanName,
          phone,
          cardNumber: match[1],
          guestType: cardType,
          title: title || '', // ✅ Empty string if no title
        });
        continue;
      }

      // Pattern 2: NAME PHONE CARD (without SN)
      match = trimmed.match(/^([A-Za-z\s\.&]+)\s+(\+\d+|\d+)\s+([A-Z]+)$/);
      if (match) {
        const name = match[1].trim();
        const phone = match[2];
        const cardType = match[3];
        const { cleanName, title } = extractTitle(name);

        guests.push({
          name: cleanName,
          phone,
          cardNumber: '',
          guestType: cardType,
          title: title || '', // ✅ Empty string if no title
        });
        continue;
      }

      // Pattern 3: NAME PHONE (without card type)
      match = trimmed.match(/^([A-Za-z\s\.&]+)\s+(\+\d+|\d{9,13})$/);
      if (match) {
        const name = match[1].trim();
        const phone = match[2];
        const { cleanName, title } = extractTitle(name);

        guests.push({
          name: cleanName,
          phone,
          cardNumber: '',
          guestType: 'SINGLE',
          title: title || '', // ✅ Empty string if no title
        });
        continue;
      }

      // Pattern 4: Table format with possible extra spaces
      const phoneMatch = trimmed.match(/(\+\d{10,13}|\d{9,13})/);
      if (phoneMatch) {
        const phone = phoneMatch[1];
        let name = trimmed.replace(phone, '').trim();
        name = name.replace(/^\d+\s*/, '').replace(/\s*\d+$/, '').trim();

        if (name && name.length > 2) {
          let cardType = 'SINGLE';
          const cardMatch = name.match(/\b(SINGLE|DOUBLE|COUPLE|FAMILY)\b/i);
          if (cardMatch) {
            cardType = cardMatch[1].toUpperCase();
            name = name.replace(/\b(SINGLE|DOUBLE|COUPLE|FAMILY)\b/i, '').trim();
          }

          const { cleanName, title } = extractTitle(name);

          guests.push({
            name: cleanName,
            phone,
            cardNumber: '',
            guestType: cardType,
            title: title || '', // ✅ Empty string if no title
          });
        }
      }
    }

    return guests;
  };

  // ─── PDF handler: sends file to server API route for parsing ────────
  const parsePDFFile = async (file: File) => {
    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/guests/parse-pdf', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to parse PDF');
        setUploading(false);
        return;
      }

      const text = data.text || '';
      console.log('PDF text extracted (first 300 chars):', text.substring(0, 300));

      const rawGuests = parsePDFGuests(text);

      if (rawGuests.length === 0) {
        setError('No guest data found in the PDF. Please ensure the format matches the sample.');
        setUploading(false);
        return;
      }

      const guests: ParsedGuest[] = rawGuests.map(g => {
        const norm = normalizePhone(g.phone);
        return {
          name: g.name,
          phone: g.phone,
          normalizedPhone: norm.normalized,
          isValid: norm.isValid,
          statusMessage: norm.message,
          guestType: g.guestType || 'SINGLE',
          cardNumber: g.cardNumber || '',
          title: g.title || '', // ✅ Empty string if no title
        };
      });

      setParsedGuests(guests);
      checkLimit(guests.filter(g => g.isValid).length);
      setStep('preview');
      setUploading(false);
      toast.success(`Parsed ${guests.length} guests from PDF`);
    } catch (err) {
      console.error('PDF parsing error:', err);
      setError('Failed to parse PDF: ' + (err as Error).message);
      setUploading(false);
    }
  };

  // ─── File Parser ────────────────────────────────────────────────────
  const parseFile = (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'pdf') {
      parsePDFFile(file);
      return;
    }

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
            else if (['type', 'guest type', 'single/double', 'single or double', 'category'].includes(lower)) autoMap[h] = 'guestType';
            else if (['title', 'salutation', 'prefix'].includes(lower)) autoMap[h] = 'title';
            else if (['card group', 'cardgroup', 'card group id', 'pair', 'group id', 'groupid'].includes(lower)) autoMap[h] = 'cardGroupId';
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
            else if (['type', 'guest type', 'single/double', 'single or double', 'category'].includes(lower)) autoMap[h] = 'guestType';
            else if (['title', 'salutation', 'prefix'].includes(lower)) autoMap[h] = 'title';
            else if (['card group', 'cardgroup', 'card group id', 'pair', 'group id', 'groupid'].includes(lower)) autoMap[h] = 'cardGroupId';
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
          const raw = parseVCard(vcfData);
          const normalized = raw.map(g => {
            const norm = normalizePhone(g.phone);
            return {
              ...g,
              normalizedPhone: norm.normalized,
              isValid: norm.isValid,
              statusMessage: norm.message,
              title: g.title || '', // ✅ Empty string if no title
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

  const parseVCard = (vcfData: string): { name: string; phone: string; email?: string; guestType?: string; title?: string }[] => {
    const guests: { name: string; phone: string; email?: string; guestType?: string; title?: string }[] = [];
    const cards = vcfData.split(/BEGIN:VCARD/i).filter(card => card.trim());

    for (const card of cards) {
      const lines = card.split(/\r?\n/);
      let name = '';
      let phone = '';
      let email = '';
      let guestType = '';
      let title = '';

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
          if (telParts.length > 1) phone = telParts.slice(1).join(':').trim();
        } else if (trimmed.startsWith('EMAIL') && !email) {
          const emailParts = trimmed.split(':');
          if (emailParts.length > 1) email = emailParts.slice(1).join(':').trim();
        } else if (trimmed.startsWith('X-GUEST-TYPE:')) {
          const parts = trimmed.split(':');
          if (parts.length > 1) guestType = parts.slice(1).join(':').trim();
        } else if (trimmed.startsWith('X-TITLE:')) {
          const parts = trimmed.split(':');
          if (parts.length > 1) title = parts.slice(1).join(':').trim();
        }
      }
      if (name && phone) guests.push({ name, phone, email: email || undefined, guestType: guestType || undefined, title: title || undefined });
    }
    return guests;
  };

  const checkLimit = (newCount: number) => {
    if (!eventDetails) return;
    const { credits } = eventDetails;
    if (credits >= 0 && newCount > credits) {
      const deficit = newCount - credits;
      setCreditDeficit(deficit);
      setLimitWarning(
        `You're importing ${newCount} guest${newCount === 1 ? '' : 's'} but only have ${credits} credit${credits === 1 ? '' : 's'} left. Credits are used 1 per guest - request ${deficit} more credits from the admin to import all of these.`
      );
    } else {
      setCreditDeficit(0);
      setLimitWarning(null);
    }
  };

  // ─── Refresh credits after a request is sent so the user can retry ──
  const refreshCredits = () => {
    fetch(`/api/events/${eventId}/guests/count`, { credentials: 'include' })
      .then(res => res.json())
      .then((data) => {
        setEventDetails(data);
        const stillValid = parsedGuests.filter(g => g.isValid).length;
        checkLimit(stillValid);
      })
      .catch(() => toast.error('Could not refresh credits'));
  };

  const downloadSampleCSV = () => {
    const headers = ['title', 'name', 'phone', 'email', 'guestType', 'cardGroupId'];
    const sampleData = [
      ['Mr', 'John Doe', '+255712345678', 'john@example.com', 'single', ''],
      ['', 'Jane Smith', '+255755123456', 'jane@example.com', 'double', ''],
      ['MRS', 'Alice Brown', '+255782345678', 'alice@example.com', 'double', 'pair-1'],
      ['MR', 'Bob Brown', '+255786345679', 'bob@example.com', 'double', 'pair-1'],
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

  const downloadSamplePDF = () => {
    const sampleData = [
      'SN  TITLE    NAME                   PHONE       CARD',
      '1   Mr       JOHN DOE               712345678   SINGLE',
      '2   Mrs      AGNES LWAMBANO         713502010   DOUBLE',
      '3   Mr       PETER JONES            715164791   DOUBLE',
      '4            ALIPHONSINA            715164792   SINGLE',
    ].join('\n');

    const blob = new Blob([sampleData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample-guests-format.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Sample format downloaded (paste into PDF)');
  };

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
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'vcf' && ext !== 'pdf') {
      toast.error('Please upload a CSV, Excel, VCF, or PDF file');
      return;
    }
    setFile(file);
    setError('');
    setLimitWarning(null);
    parseFile(file);
  };

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
          const { cleanName, title } = extractTitle(name);
          return {
            name: cleanName,
            phone,
            normalizedPhone: norm.normalized,
            isValid: norm.isValid,
            statusMessage: norm.message,
            email,
            title: title || '', // ✅ Empty string if no title
          };
        })
        .filter((g: ParsedGuest) => g.name && g.phone);
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

  const applyMapping = () => {
    const nameCol = Object.keys(mapping).find(k => mapping[k] === 'name');
    const phoneCol = Object.keys(mapping).find(k => mapping[k] === 'phone');
    const emailCol = Object.keys(mapping).find(k => mapping[k] === 'email');
    const guestTypeCol = Object.keys(mapping).find(k => mapping[k] === 'guestType');
    const titleCol = Object.keys(mapping).find(k => mapping[k] === 'title');
    const cardGroupIdCol = Object.keys(mapping).find(k => mapping[k] === 'cardGroupId');

    if (!nameCol || !phoneCol) {
      setError('Please map the "name" and "phone" columns.');
      return;
    }
    const guests: ParsedGuest[] = rawData.map(row => {
      const name = row[nameCol]?.toString().trim() || '';
      const phone = row[phoneCol]?.toString().trim() || '';
      const email = emailCol ? row[emailCol]?.toString().trim() : undefined;
      const guestType = guestTypeCol ? row[guestTypeCol]?.toString().trim() : undefined;
      const title = titleCol ? row[titleCol]?.toString().trim() : undefined;
      const cardGroupId = cardGroupIdCol ? String(row[cardGroupIdCol] ?? '').trim() : undefined;
      const norm = normalizePhone(phone);
      const { cleanName } = extractTitle(name);
      return {
        name: cleanName,
        phone,
        normalizedPhone: norm.normalized,
        isValid: norm.isValid,
        statusMessage: norm.message,
        email,
        guestType,
        title: title || '', // ✅ Empty string if no title
        cardGroupId: cardGroupId || undefined,
      };
    }).filter(g => g.name && g.phone);
    setParsedGuests(guests);
    checkLimit(guests.filter(g => g.isValid).length);
    setStep('preview');
    toast.success(`Mapped ${guests.length} guests (${guests.filter(g => g.isValid).length} valid)`);
  };

  const handleImport = async () => {
  const validGuests = parsedGuests.filter(g => g.isValid);
  if (validGuests.length === 0) {
    toast.error('No valid guests to import');
    return;
  }
  if (limitWarning) {
    toast.error('Cannot import - exceeds guest limit');
    return;
  }
  const guestsToImport = validGuests.map(g => ({
    name: g.name,
    phone: g.normalizedPhone,
    email: g.email,
    guestType: g.guestType,
    cardNumber: g.cardNumber,
    title: g.title || '',
    cardGroupId: g.cardGroupId,
  }));
  setUploading(true);
  setImportStatus('Importing guests...');
  try {
    const res = await fetch('/api/guests/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        guests: guestsToImport, 
        eventId,
        detectWhatsApp, // ✅ Pass the toggle value
      }),
      credentials: 'include',
    });
    const data = await res.json();
    if (res.ok) {
      let successMsg = `${data.count} guests imported successfully!`;
      if (data.whatsappCount !== undefined) {
        successMsg += ` ${data.whatsappCount} on WhatsApp, ${data.smsCount} on SMS.`;
      }
      toast.success(successMsg);
      router.push(`/client/events/${eventId}`);
    } else if (data.needsCredits) {
      // Friendly inline flow: open the request-credits modal directly,
      // pre-filled with the shortfall, instead of navigating the user away.
      setCreditDeficit(Math.max(1, (data.needed ?? 0) - (data.credits ?? 0) || creditDeficit || 1));
      setShowCreditRequest(true);
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

  const downloadInvalid = () => {
    const invalid = parsedGuests.filter(g => !g.isValid);
    if (invalid.length === 0) {
      toast('No invalid guests to export', { icon: <FileSpreadsheet size={16} className="text-gray-400" /> });
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

  const validCount = parsedGuests.filter(g => g.isValid).length;
  const invalidCount = parsedGuests.filter(g => !g.isValid).length;

  const displayGuests = showValidOnly ? parsedGuests.filter(g => g.isValid) : parsedGuests;
  const shown = displayGuests.slice(0, 50);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
      <Link
        href={`/client/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4B4B] bg-[rgba(13,75,75,0.08)] border border-[rgba(13,75,75,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,75,75,0.14)] mb-6"
      >
        <ArrowLeft size={14} /> Back to Event
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Import Guests</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={downloadSampleCSV}
            className="inline-flex items-center justify-center gap-1 text-sm text-[#0D4B4B] bg-[rgba(13,75,75,0.08)] border border-[rgba(13,75,75,0.12)] px-4 py-2 rounded-lg hover:bg-[rgba(13,75,75,0.14)] transition"
          >
            <Download size={14} /> Sample CSV
          </button>
          <button
            onClick={downloadSamplePDF}
            className="inline-flex items-center justify-center gap-1 text-sm text-[#0D4B4B] bg-[rgba(13,75,75,0.08)] border border-[rgba(13,75,75,0.12)] px-4 py-2 rounded-lg hover:bg-[rgba(13,75,75,0.14)] transition"
          >
            <FileText size={14} /> PDF Format
          </button>
        </div>
      </div>

      <p className="text-gray-500 text-sm sm:text-base mb-6">
        Upload a <strong>CSV</strong>, <strong>Excel (.xlsx)</strong>, <strong>vCard (.vcf)</strong>, or <strong>PDF</strong> file, or import from your phone contacts.
        For CSV/Excel, you'll be able to map columns to our fields. Phone numbers will be auto‑formatted to international format.
        <span className="block text-xs text-gray-400 mt-1">Leave <strong>Title</strong> column empty if you don't want to use titles.</span>
        <span className="block text-xs text-gray-400 mt-1">
          To create a shared 2-person DOUBLE card, put the same value in a <strong>Card Group</strong> column for two rows.
        </span>
      </p>

      {step === 'upload' && (
        <>
          {'contacts' in navigator && (
            <button
              onClick={importFromPhone}
              disabled={uploading}
              className="w-full mb-4 py-3 bg-[rgba(13,75,75,0.08)] text-[#0D4B4B] border border-[rgba(13,75,75,0.2)] rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[rgba(13,75,75,0.14)] transition disabled:opacity-50"
            >
              <Phone size={18} /> Import from Phone Contacts
            </button>
          )}

          <div
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition ${dragActive ? 'border-[#0D4B4B] bg-[rgba(13,75,75,0.04)]' : 'border-gray-300 bg-white hover:bg-gray-50'
              }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600">Drag & drop your file here, or click to browse</p>
            <p className="text-xs text-gray-400 mt-1">Supports CSV, Excel, VCF, and PDF</p>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.vcf,.pdf" onChange={handleFileSelect} className="hidden" />
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>

          {/* ─── WhatsApp Detection Toggle ─── */}
          <div className="mt-4 flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={detectWhatsApp}
                onChange={(e) => setDetectWhatsApp(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#0D4B4B] focus:ring-[#0D4B4B]"
              />
              <span className="text-sm font-medium text-gray-700">
                Auto-detect WhatsApp numbers
              </span>
            </label>
            <span className="text-xs text-gray-400">
              (Slower import, but auto-routes guests to WhatsApp)
            </span>
          </div>


          {/* PDF Format Guide */}
          <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
            <h3 className="font-semibold text-sm flex items-center gap-2 mb-2">
              <FileText size={16} className="text-[#0D4B4B]" />
              PDF Format Guide
            </h3>
            <p className="text-xs text-gray-600 mb-2">
              Your PDF should follow this format:
            </p>
            <div className="bg-white p-3 rounded-lg font-mono text-xs text-gray-700 border border-gray-200 overflow-x-auto">
              <pre>
                {`SN  TITLE    NAME                   PHONE       CARD
1   Mr       JOHN DOE               712345678   SINGLE
2   Mrs      AGNES LWAMBANO         713502010   DOUBLE
3   Mr       PETER JONES            715164791   DOUBLE
4            ALIPHONSINA            715164792   SINGLE`}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Supported titles: Mr, Mrs, Ms, Miss, Dr, Prof, Sir, Mr/Mrs, Mr & Mrs.<br />
              Leave title column empty for guests without titles.
            </p>
          </div>
        </>
      )}

      {step === 'map' && rawData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 rounded-xl p-3 mb-4 gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium truncate">{file?.name}</span>
              <span className="text-xs text-gray-500">({rawData.length} rows)</span>
            </div>
            <button onClick={removeFile} className="text-gray-400 hover:text-red-500 flex-shrink-0">
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
                  <div key={h} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                    <span className="text-sm font-medium truncate w-32 sm:w-auto">{h}</span>
                    <select
                      className="border rounded-md px-2 py-1 text-sm flex-1"
                      value={mapping[h] || 'skip'}
                      onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as any })}
                    >
                      <option value="skip">Skip</option>
                      <option value="name">Name</option>
                      <option value="phone">Phone</option>
                      <option value="email">Email</option>
                      <option value="guestType">Guest Type</option>
                      <option value="title">Title (Mr/Mrs/etc.)</option>
                      <option value="cardGroupId">Card Group (pair)</option>
                    </select>
                  </div>
                ))}
              </div>
              {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
              <button
                onClick={applyMapping}
                className="mt-4 w-full sm:w-auto bg-[#0D4B4B] text-white px-6 py-2 rounded-lg font-semibold hover:bg-[#0A3939] transition"
              >
                Apply Mapping & Preview
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {step === 'preview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-50 rounded-xl p-3 mb-4 gap-2">
            <div className="flex items-center gap-2">
              {file?.name?.endsWith('.pdf') ? (
                <FileText className="w-5 h-5 text-red-600" />
              ) : (
                <FileSpreadsheet className="w-5 h-5 text-green-600" />
              )}
              <span className="text-sm font-medium truncate">{file?.name}</span>
              <span className="text-xs text-gray-500">({parsedGuests.length} guests)</span>
            </div>
            <button onClick={removeFile} className="text-gray-400 hover:text-red-500 flex-shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="bg-[#EDFAF4] border border-[#A8D5C4] rounded-xl px-4 py-2 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#1A7A4A]" />
              <span className="text-sm font-medium text-[#1A7A4A]">{validCount} valid</span>
            </div>
            {invalidCount > 0 && (
              <div className="bg-[#FEF6EC] border border-[#F5D6B8] rounded-xl px-4 py-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[#C07A20]" />
                <span className="text-sm font-medium text-[#C07A20]">{invalidCount} invalid</span>
                <button
                  onClick={downloadInvalid}
                  className="text-xs text-[#0D4B4B] underline hover:no-underline"
                >
                  Export invalid
                </button>
              </div>
            )}
            <div className="text-sm text-gray-500 flex items-center">
          {eventDetails ? (
            eventDetails.credits < 0
              ? 'Unlimited (payment bypassed)'
              : `${eventDetails.credits} credit${eventDetails.credits === 1 ? '' : 's'} left`
          ) : '-'}
        </div>
      </div>

      {eventDetails && (
        <div className="text-sm text-gray-600 mb-4 flex flex-wrap gap-2">
          {eventDetails.credits < 0 ? (
            <span><span className="font-semibold">Limit:</span> Unlimited</span>
          ) : (
            <span><span className="font-semibold">Credits remaining:</span> {eventDetails.credits} (1 credit = 1 guest)</span>
          )}
          <span>•</span>
          <span><span className="font-semibold">Current guests:</span> {eventDetails.totalGuests}</span>
        </div>
      )}

          {limitWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-xl mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-sm">{limitWarning}</div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowCreditRequest(true)}
                  className="inline-flex items-center gap-1.5 bg-[#0D4B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3939] transition"
                >
                  <Plus size={15} /> Request {creditDeficit > 0 ? `${creditDeficit} ` : ''}Credits
                </button>
                <a
                  href="/client/billing"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#0D4B4B] bg-white border border-[#0D4B4B]/20 hover:bg-[rgba(13,75,75,0.06)] transition"
                >
                  Billing
                </a>
              </div>
            </div>
          )}

          {parsedGuests.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <h2 className="font-semibold px-4 py-3 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

              {/* ─── Mobile card view ──────────────────────────────────── */}
              <div className="sm:hidden divide-y divide-gray-100 max-h-96 overflow-y-auto">
                {shown.map((guest) => {
                  const originalIndex = parsedGuests.indexOf(guest);
                  const isEditingName = editingIndex === originalIndex && editField === 'name';
                  const isEditingTitle = editingIndex === originalIndex && editField === 'title';
                  return (
                    <div key={originalIndex} className={`px-4 py-3 ${guest.isValid ? '' : 'bg-amber-50/50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          {/* Title with always-visible edit button */}
                          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                            {isEditingTitle ? (
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="border rounded px-2 py-0.5 w-20 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]"
                                  placeholder="Title"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(originalIndex);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => saveEdit(originalIndex)}
                                  className="text-[#1A7A4A] hover:text-[#0D4B4B] transition"
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-500 hover:text-red-700 transition"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {guest.title || '-'}
                                </span>
                                <button
                                  onClick={() => startEditing(originalIndex, 'title', guest.title || '')}
                                  className="text-gray-400 hover:text-[#0D4B4B] transition"
                                  title="Edit title"
                                >
                                  <Pencil size={12} />
                                </button>
                              </>
                            )}
                          </div>
                          {/* Name with always-visible edit button */}
                          <div className="flex items-center gap-1.5">
                            {isEditingName ? (
                              <div className="flex items-center gap-1 w-full">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]"
                                  placeholder="Name"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(originalIndex);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => saveEdit(originalIndex)}
                                  className="text-[#1A7A4A] hover:text-[#0D4B4B] transition"
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-500 hover:text-red-700 transition"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <p className="font-medium text-gray-800 break-words">{guest.name}</p>
                                <button
                                  onClick={() => startEditing(originalIndex, 'name', guest.name)}
                                  className="text-gray-400 hover:text-[#0D4B4B] transition flex-shrink-0"
                                  title="Edit name"
                                >
                                  <Pencil size={14} />
                                </button>
                              </>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{guest.normalizedPhone || guest.phone}</p>
                          {guest.email && <p className="text-xs text-gray-400 mt-0.5 truncate">{guest.email}</p>}
                          {guest.guestType && (
                            <p className="text-xs text-gray-600 mt-0.5">Type: {guest.guestType}</p>
                          )}
                          {guest.cardNumber && (
                            <p className="text-xs text-gray-400 mt-0.5">Card: {guest.cardNumber}</p>
                          )}
                          <div className="mt-1">
                            {guest.isValid ? (
                              <span className="text-green-600 text-xs font-medium flex items-center gap-1">
                                <CheckCircle size={12} /> Valid
                              </span>
                            ) : (
                              <span className="text-amber-600 text-xs font-medium flex items-center gap-1">
                                <AlertTriangle size={12} /> {guest.statusMessage || 'Invalid'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ─── Desktop table view ────────────────────────────────── */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Title</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Name</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Phone</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Email</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Type</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Card</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {shown.map((guest) => {
                      const originalIndex = parsedGuests.indexOf(guest);
                      const isEditingName = editingIndex === originalIndex && editField === 'name';
                      const isEditingTitle = editingIndex === originalIndex && editField === 'title';
                      return (
                        <tr key={originalIndex} className={guest.isValid ? '' : 'bg-amber-50/50'}>
                          <td className="px-4 py-2">
                            {isEditingTitle ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="border rounded px-2 py-0.5 w-20 text-xs focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]"
                                  placeholder="Title"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(originalIndex);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => saveEdit(originalIndex)}
                                  className="text-[#1A7A4A] hover:text-[#0D4B4B] transition"
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-500 hover:text-red-700 transition"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {guest.title || '-'}
                                </span>
                                <button
                                  onClick={() => startEditing(originalIndex, 'title', guest.title || '')}
                                  className="text-gray-400 hover:text-[#0D4B4B] transition"
                                  title="Edit title"
                                >
                                  <Pencil size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {isEditingName ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]"
                                  placeholder="Name"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit(originalIndex);
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                />
                                <button
                                  onClick={() => saveEdit(originalIndex)}
                                  className="text-[#1A7A4A] hover:text-[#0D4B4B] transition"
                                  title="Save"
                                >
                                  <Save size={14} />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-500 hover:text-red-700 transition"
                                  title="Cancel"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span className="break-words">{guest.name}</span>
                                <button
                                  onClick={() => startEditing(originalIndex, 'name', guest.name)}
                                  className="text-gray-400 hover:text-[#0D4B4B] transition flex-shrink-0"
                                  title="Edit name"
                                >
                                  <Pencil size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs break-all">{guest.normalizedPhone || guest.phone}</td>
                          <td className="px-4 py-2 break-words">{guest.email || '-'}</td>
                          <td className="px-4 py-2">
                            {guest.guestType ? (
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${guest.guestType.toLowerCase() === 'double' ? 'bg-purple-100 text-purple-700' :
                                  guest.guestType.toLowerCase() === 'single' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                }`}>
                                {guest.guestType}
                              </span>
                            ) : '-'}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs">{guest.cardNumber || '-'}</td>
                          <td className="px-4 py-2">
                            {guest.isValid ? (
                              <span className="text-green-600 text-xs font-medium flex items-center gap-1 whitespace-nowrap">
                                <CheckCircle size={12} /> Valid
                              </span>
                            ) : (
                              <span className="text-amber-600 text-xs font-medium flex items-center gap-1 whitespace-nowrap">
                                <AlertTriangle size={12} /> {guest.statusMessage || 'Invalid'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {displayGuests.length > 50 && (
                <div className="px-4 py-2 text-center text-gray-400 text-sm border-t">
                  + {displayGuests.length - 50} more guests
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-between items-center px-4 py-2 border-t gap-2">
                <button
                  onClick={() => setShowValidOnly(!showValidOnly)}
                  className="text-sm text-[#0D4B4B] hover:underline"
                >
                  {showValidOnly ? 'Show all' : 'Show valid only'}
                </button>
                <span className="text-xs text-gray-400">
                  {validCount} valid, {invalidCount} invalid
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
            <button
              onClick={removeFile}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={uploading || validCount === 0 || !!limitWarning}
              className="px-6 py-2 bg-[#0D4B4B] text-white rounded-lg hover:bg-[#0A3939] disabled:opacity-50 transition flex items-center justify-center gap-2"
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

      <RequestCreditsModal
        isOpen={showCreditRequest}
        onClose={() => setShowCreditRequest(false)}
        onRequestSent={refreshCredits}
        requiredCredits={creditDeficit}
      />
    </div>
  );
}