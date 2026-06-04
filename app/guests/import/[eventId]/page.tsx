'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'

interface GuestRow {
  name: string
  email: string
  phone: string
  table?: string
}

export default function ImportGuestsPage({ params }: { params: { eventId: string } }) {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<GuestRow[]>([])
  const [importing, setImporting] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'text/csv') {
      setFile(droppedFile)
      parseCSV(droppedFile)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseCSV(selectedFile)
    }
  }

  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as GuestRow[]
        setPreview(data.slice(0, 5)) // Show first 5 rows
      }
    })
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('eventId', params.eventId)

    const res = await fetch('/api/guests/import', {
      method: 'POST',
      body: formData
    })

    if (res.ok) {
      router.push(`/guests/${params.eventId}`)
    } else {
      alert('Import failed')
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Import Guests</h1>
        <p className="text-gray-600 mt-1">Upload a CSV file with guest names, emails, and phone numbers</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">CSV Format Requirements</h2>
          <p className="text-sm text-gray-600 mt-1">Your CSV should have these columns:</p>
          <div className="mt-3 flex gap-4 text-sm">
            <code className="bg-gray-100 px-2 py-1 rounded">name</code>
            <code className="bg-gray-100 px-2 py-1 rounded">email</code>
            <code className="bg-gray-100 px-2 py-1 rounded">phone</code>
            <code className="bg-gray-100 px-2 py-1 rounded">table (optional)</code>
          </div>
        </div>

        <div className="p-6">
          {/* Drag & Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition ${
              dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex flex-col items-center">
              <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600">Drag & drop your CSV file here</p>
              <p className="text-sm text-gray-400 mt-1">or</p>
              <label className="mt-2 cursor-pointer">
                <span className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-block">
                  Browse Files
                </span>
                <input type="file" accept=".csv" onChange={handleFileSelect} className="hidden" />
              </label>
            </div>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Preview (first 5 rows)</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Email</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Phone</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Table</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {preview.map((row, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-sm">{row.name}</td>
                        <td className="px-4 py-2 text-sm">{row.email}</td>
                        <td className="px-4 py-2 text-sm">{row.phone}</td>
                        <td className="px-4 py-2 text-sm">{row.table || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Import Button */}
          {file && (
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setFile(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {importing ? 'Importing...' : `Import ${preview.length} guests`}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}