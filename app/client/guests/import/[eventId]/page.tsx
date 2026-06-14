'use client';
import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import Papa from 'papaparse';
import toast from 'react-hot-toast';

export default function ImportGuestsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile);
      parseCSV(droppedFile);
    } else {
      toast.error('Please upload a CSV file');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        setPreview(data.slice(0, 5));
        toast.success(`CSV parsed: ${data.length} rows found`);
      },
      error: (err) => {
        toast.error('Failed to parse CSV: ' + err.message);
      },
    });
  };

  const handleImport = async () => {
    if (!file) return;
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
        toast.success(`✅ ${data.count} guests imported successfully!`);
        router.push(`/client/events/${eventId}`);
      } else {
        toast.error(data.error || 'Import failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUploading(false);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pb-20">
      <h1 className="text-2xl font-bold mb-2">Import Guests (CSV)</h1>
      <p className="text-gray-500 mb-6">
        Upload a CSV file with columns: <code className="bg-gray-100 px-1 rounded">name</code>, <code className="bg-gray-100 px-1 rounded">phone</code>, <code className="bg-gray-100 px-1 rounded">email</code> (optional)
      </p>

      {/* Drag & Drop Area */}
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
        <p className="text-gray-600">Drag & drop your CSV file here, or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">Maximum 10,000 rows</p>
        <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
      </div>

      {/* File Info & Preview */}
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

          {preview.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
              <h2 className="font-semibold px-4 py-3 border-b">Preview (first {preview.length} rows)</h2>
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">Name</th>
                    <th className="px-4 py-2 text-left">Phone</th>
                    <th className="px-4 py-2 text-left">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((row, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-2">{row.name || '—'}</td>
                      <td className="px-4 py-2">{row.phone || '—'}</td>
                      <td className="px-4 py-2">{row.email || '—'}</td>
                    </tr>
                  ))}
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
              disabled={uploading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</>
              ) : (
                <>Import {preview.length} guests</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}