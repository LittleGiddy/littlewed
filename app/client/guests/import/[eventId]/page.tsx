'use client';
import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ImportGuestsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId);
    try {
      const res = await fetch('/api/guests/import', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(`✅ Imported ${data.count} guests! Redirecting...`);
        setTimeout(() => router.push(`/client/events/${eventId}`), 2000);
      } else {
        setStatus(`❌ Error: ${data.error}`);
      }
    } catch {
      setStatus('❌ Network error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <Link href={`/client/events/${eventId}`} className="text-indigo-600 hover:underline">← Back to Event</Link>
      <h1 className="text-2xl font-bold mt-4">Import Guests</h1>
      <p className="text-gray-600 mb-4">Upload a CSV with columns: name, phone, email (optional)</p>
      <input type="file" accept=".csv" onChange={handleFileChange} className="mb-4" />
      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
      >
        {uploading ? 'Importing...' : 'Upload & Import'}
      </button>
      {status && <p className="mt-4 text-sm">{status}</p>}
    </div>
  );
}