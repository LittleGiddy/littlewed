'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  BarChart3, Download, FileText, FileSpreadsheet, File,
  Calendar, Users, CheckCircle, Send, Coins, Filter,
  TrendingUp, Loader2, AlertCircle, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface MonthData {
  month: string;
  events: number;
  guests: number;
  checkedIn: number;
  invitationsSent: number;
  creditsUsed: number;
  creditsRemaining: number;
}

interface ReportData {
  tenant: { name: string; plan: string; credits: number };
  months: MonthData[];
  summary: {
    totalEvents: number;
    totalGuests: number;
    totalCheckedIn: number;
    totalInvitationsSent: number;
    totalCreditsUsed: number;
  };
}

export default function ReportsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | 'word' | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      try {
        const res = await fetch('/api/tenant/reports', { credentials: 'include' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err?.message || 'Failed to load reports');
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    })();
  }, [status]);

  const filteredMonths = useMemo(() => {
    if (!data) return [];
    if (selectedMonth === 'all') return data.months;
    return data.months.filter((m) => m.month === selectedMonth);
  }, [data, selectedMonth]);

  const maxGuests = useMemo(() => {
    if (!filteredMonths.length) return 1;
    return Math.max(...filteredMonths.map((m) => m.guests), 1);
  }, [filteredMonths]);

  const summary = useMemo(() => {
    if (!filteredMonths.length) return { totalEvents: 0, totalGuests: 0, totalCheckedIn: 0, totalInvitationsSent: 0, totalCreditsUsed: 0 };
    return filteredMonths.reduce(
      (acc, m) => ({
        totalEvents: acc.totalEvents + m.events,
        totalGuests: acc.totalGuests + m.guests,
        totalCheckedIn: acc.totalCheckedIn + m.checkedIn,
        totalInvitationsSent: acc.totalInvitationsSent + m.invitationsSent,
        totalCreditsUsed: acc.totalCreditsUsed + m.creditsUsed,
      }),
      { totalEvents: 0, totalGuests: 0, totalCheckedIn: 0, totalInvitationsSent: 0, totalCreditsUsed: 0 }
    );
  }, [filteredMonths]);

  const handleExportExcel = async () => {
    if (!data) return;
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();
      const rows = filteredMonths.map((m) => ({
        Month: m.month, Events: m.events, Guests: m.guests,
        'Checked In': m.checkedIn, Invitations: m.invitationsSent, 'Credits Used': m.creditsUsed,
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report');
      XLSX.writeFile(wb, `LittleWed-Report-${data.tenant.name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel report downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(null); }
  };

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setExporting('pdf');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const w = pdf.internal.pageSize.getWidth();
      const h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 10, w, h);
      pdf.save(`LittleWed-Report-${data?.tenant?.name}-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF report downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(null); }
  };

  const handleExportWord = async () => {
    if (!data) return;
    setExporting('word');
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType } = docx;
      const headerCells = ['Month', 'Events', 'Guests', 'Checked In', 'Invitations', 'Credits Used'].map(
        (h) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 20 })] })], shading: { fill: '0D4B4B' }, width: { size: 15, type: WidthType.PERCENTAGE } })
      );
      const rows = filteredMonths.map((m) =>
        new TableRow({ children: [m.month, m.events, m.guests, m.checkedIn, m.invitationsSent, m.creditsUsed].map(
          (v) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: String(v), size: 20 })] })], width: { size: 15, type: WidthType.PERCENTAGE } })
        ) })
      );
      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({ children: [new TextRun({ text: 'LittleWed Monthly Report', bold: true, size: 32, color: '0D4B4B' })], heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: `${data.tenant.name} - ${data.tenant.plan} Plan`, size: 22, color: '666666' })], alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
            new Paragraph({ children: [new TextRun({ text: `Total: ${summary.totalEvents} events, ${summary.totalGuests} guests, ${summary.totalCheckedIn} checked in`, size: 20 })], spacing: { after: 300 } }),
            new Table({ rows: [new TableRow({ children: headerCells, tableHeader: true }), ...rows] }),
          ],
        }],
      });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `LittleWed-Report-${data.tenant.name}-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click(); URL.revokeObjectURL(url);
      toast.success('Word report downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(null); }
  };

  const statCards = [
    { label: 'Total Events', value: summary.totalEvents, icon: Calendar, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
    { label: 'Total Guests', value: summary.totalGuests, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Checked In', value: summary.totalCheckedIn, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Invitations Sent', value: summary.totalInvitationsSent, icon: Send, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Credits Used', value: summary.totalCreditsUsed, icon: Coins, color: 'text-[#FF6B5C]', bg: 'bg-[#FF6B5C]/10' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500 font-medium">Loading reports...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full shadow-sm border border-gray-100">
          <AlertCircle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-semibold mb-1">Failed to load reports</p>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button onClick={() => { setLoading(true); setError(null); window.location.reload(); }} className="px-5 py-2 bg-[#0D4B4B] text-white rounded-xl text-sm font-semibold hover:bg-[#0A3939] transition">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1">
              <BarChart3 size={14} /> Analytics
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-black text-gray-900">Monthly Report</h1>
            <p className="text-sm text-gray-500 mt-1">{data?.tenant?.name} - {data?.tenant?.plan} Plan</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
                className="pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] appearance-none cursor-pointer">
                <option value="all">All Months</option>
                {data?.months?.map((m) => <option key={m.month} value={m.month}>{m.month}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {statCards.map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className={`w-9 h-9 rounded-xl ${card.bg} flex items-center justify-center mb-2.5`}>
                <card.icon size={17} className={card.color} />
              </div>
              <p className="font-serif text-2xl font-black text-gray-900">{card.value.toLocaleString()}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Export Bar */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Export:</span>
          <button onClick={handleExportPDF} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50">
            {exporting === 'pdf' ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />} PDF
          </button>
          <button onClick={handleExportExcel} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50">
            {exporting === 'excel' ? <Loader2 size={13} className="animate-spin" /> : <FileSpreadsheet size={13} />} Excel
          </button>
          <button onClick={handleExportWord} disabled={!!exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition disabled:opacity-50">
            {exporting === 'word' ? <Loader2 size={13} className="animate-spin" /> : <File size={13} />} Word
          </button>
        </div>

        {/* Report Content (captured for PDF) */}
        <div ref={reportRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Bar Chart */}
          <div className="p-5 border-b border-gray-50">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <TrendingUp size={15} className="text-[#0D4B4B]" /> Guest Activity by Month
            </h3>
            <div className="flex items-end gap-1.5 h-40">
              {filteredMonths.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex flex-col items-center justify-end h-32">
                    <div
                      className="w-full max-w-[40px] rounded-t-lg bg-gradient-to-t from-[#0D4B4B] to-[#0D4B4B]/70 transition-all duration-500"
                      style={{ height: `${(m.guests / maxGuests) * 100}%`, minHeight: m.guests > 0 ? '4px' : '0' }}
                      title={`${m.guests} guests`}
                    />
                  </div>
                  <span className="text-[9px] font-medium text-gray-400 truncate w-full text-center">{m.month.split(' ')[0]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80">
                  {['Month', 'Events', 'Guests', 'Checked In', 'Invitations', 'Credits Used'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredMonths.map((m) => (
                  <tr key={m.month} className="hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3 font-semibold text-gray-800">{m.month}</td>
                    <td className="px-4 py-3 text-gray-600">{m.events}</td>
                    <td className="px-4 py-3 text-gray-600">{m.guests}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-green-600 font-medium">
                        <CheckCircle size={12} /> {m.checkedIn}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.invitationsSent}</td>
                    <td className="px-4 py-3 text-[#FF6B5C] font-semibold">{m.creditsUsed}</td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-[#0D4B4B]/5 font-bold">
                  <td className="px-4 py-3 text-[#0D4B4B]">Total</td>
                  <td className="px-4 py-3 text-[#0D4B4B]">{summary.totalEvents}</td>
                  <td className="px-4 py-3 text-[#0D4B4B]">{summary.totalGuests}</td>
                  <td className="px-4 py-3 text-[#0D4B4B]">{summary.totalCheckedIn}</td>
                  <td className="px-4 py-3 text-[#0D4B4B]">{summary.totalInvitationsSent}</td>
                  <td className="px-4 py-3 text-[#FF6B5C] font-black">{summary.totalCreditsUsed}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Report generated on {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  );
}
