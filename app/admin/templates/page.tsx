'use client';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function AdminTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const fetchTemplates = async () => {
    const res = await fetch('/api/templates');
    const data = await res.json();
    setTemplates(data);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const addTemplate = async () => {
    if (!name || !imageUrl) return toast.error('Name and image URL required');
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, imageUrl }),
    });
    if (res.ok) { toast.success('Template added'); fetchTemplates(); setName(''); setImageUrl(''); }
    else toast.error('Failed');
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); fetchTemplates(); }
    else toast.error('Failed');
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Manage Templates</h1>
      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="font-semibold mb-2">Add New Template</h2>
        <input className="border p-2 w-full mb-2" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
        <input className="border p-2 w-full mb-2" placeholder="Image URL" value={imageUrl} onChange={e => setImageUrl(e.target.value)} />
        <button onClick={addTemplate} className="bg-[#0D4F4F] text-white px-4 py-2 rounded">Add</button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {templates.map(t => (
          <div key={t.id} className="border rounded p-4 bg-white shadow">
            <img src={t.imageUrl} alt={t.name} className="w-full aspect-[3/4] object-cover rounded" />
            <p className="font-semibold mt-2">{t.name}</p>
            <button onClick={() => deleteTemplate(t.id)} className="text-red-500 text-sm">Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}