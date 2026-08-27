'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import { Palette, Plus, Trash2, RefreshCw, Image, Upload, X } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  imageUrl: string;
}

export default function AdminTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch {
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  const addTemplate = async () => {
    if (!name.trim() || !imageUrl.trim()) return toast.error('Name and image URL are required');
    setSubmitting(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), imageUrl: imageUrl.trim() }),
      });
      if (res.ok) {
        toast.success('Template added successfully');
        fetchTemplates();
        setName('');
        setImageUrl('');
      } else {
        toast.error('Failed to add template');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTemplate = async (id: string, templateName: string) => {
    const ok = await confirmToast({ title: `Delete template "${templateName}"?`, confirmText: 'Delete', danger: true });
    if (!ok) return;
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Template deleted');
        setTemplates(prev => prev.filter(t => t.id !== id));
      } else {
        toast.error('Failed to delete template');
      }
    } catch {
      toast.error('Network error');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Invitation Templates</h1>
        <p className="text-sm text-gray-500 mt-1">Manage invitation card templates for events</p>
      </div>

      {/* Add New Template */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center">
            <Plus size={16} className="text-[#0D4B4B]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Add New Template</h2>
            <p className="text-xs text-gray-400">Create a new invitation card template</p>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Template Name</label>
              <input
                type="text"
                placeholder="e.g. Floral Garden"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Image URL</label>
              <input
                type="url"
                placeholder="https://example.com/template.jpg"
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
              />
            </div>
          </div>
          {imageUrl && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Preview</label>
              <div className="w-32 h-40 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                <img
                  src={imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
            </div>
          )}
          <button
            onClick={addTemplate}
            disabled={submitting || !name.trim() || !imageUrl.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D4B4B] text-white text-sm font-semibold rounded-xl hover:bg-[#0D4B4B] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            Add Template
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Palette size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">All Templates</h2>
              <p className="text-xs text-gray-400">{templates.length} template{templates.length !== 1 ? 's' : ''} available</p>
            </div>
          </div>
          <button
            onClick={fetchTemplates}
            disabled={loading}
            className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <div className="aspect-[3/4] bg-gray-100 rounded-xl animate-pulse" />
                  <div className="h-4 bg-gray-100 rounded-full w-2/3 animate-pulse" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Image size={24} className="text-gray-300" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">No templates yet</p>
                  <p className="text-xs text-gray-400 mt-1">Add your first template above</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {templates.map((template) => (
                <div key={template.id} className="group relative bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200">
                  <div className="aspect-[3/4] bg-gray-50 overflow-hidden">
                    <img
                      src={template.imageUrl}
                      alt={template.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        if (target.parentElement) {
                          target.parentElement.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-gray-100"><svg class="w-8 h-8 text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';
                        }
                      }}
                    />
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 truncate">{template.name}</p>
                    <button
                      onClick={() => deleteTemplate(template.id, template.name)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
