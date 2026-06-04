'use client';
import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ImportGuestsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setError('');
    } else {
      setError('Please select a valid CSV file');
      setFile(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('eventId', eventId as string);
    try {
      const res = await fetch('/api/guests/import', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok) {
        router.push(`/client/events/${eventId}`);
      } else {
        setError(data.error || 'Import failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pb-20">
      <Link href={`/client/events/${eventId}`} className="text-indigo-600 text-sm">← Back to Event</Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">Import Guests (CSV)</h1>
      <p className="text-gray-500 text-sm mb-6">Columns: name, phone, email (optional)</p>
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 cursor-pointer hover:border-indigo-500 transition"
        >
          {file ? <p className="font-medium">{file.name}</p> : <p>Click to select CSV</p>}
        </div>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full bg-indigo-600 text-white py-2 rounded-xl"
          >
            {uploading ? 'Uploading...' : 'Upload & Validate'}
          </button>
        )}
        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
      </div>
    </div>
  );
}