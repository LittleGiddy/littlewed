'use client';
import { useRef } from 'react';

export default function UploadTest() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    console.log('Button clicked');
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log('File selected:', file?.name);
    if (file) {
      const reader = new FileReader();
      reader.onload = () => console.log('File read successfully');
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="p-8">
      <button onClick={handleClick} className="bg-blue-600 text-white px-4 py-2 rounded">
        Click to Upload
      </button>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
    </div>
  );
}