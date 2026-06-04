'use client';

import { useState } from 'react';

export default function UploadFormPage() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/upload-simple', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (res.ok) {
      setResult(`Uploaded: ${data.url}`);
    } else {
      setResult(`Error: ${data.error}`);
    }
    setUploading(false);
  };

  return (
    <div className="p-8">
      <h1>Test Upload (FormData)</h1>
      <form onSubmit={handleSubmit} encType="multipart/form-data">
        <input type="file" name="file" accept="image/*" required />
        <input type="text" name="eventId" placeholder="Event ID" required />
        <button type="submit" disabled={uploading}>Upload</button>
      </form>
      {result && <pre>{result}</pre>}
    </div>
  );
}