'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  FileText, Download, Search, RefreshCw, Building2,
  Calendar, Users, UserCheck, Mail, Loader2, AlertCircle,
  BarChart3, TrendingUp,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TenantReport {
  id: string;
  name: string;
  plan: string;
  totalEvents: number;
  totalGuests: number;
  checkedIn: number;
  invitationsSent: number;
  credits: number;
}

interface ReportsData {
  totalTenants: number;
  totalEvents: number;
  totalGuests: number;
  checkedIn: number;
  invitationsSent: number;
  tenants: TenantReport[];
}

export default function AdminReportsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session || (session.user as any)?.role !== 'SUPER_ADMIN') {
      router.push('/login');
    }
  }, [session, sessionStatus, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const json = await res.json();
      const tenants: TenantReport[] = (json.tenants || []).sort(
        (a: TenantReport, b: TenantReport) => b.totalEvents - a.totalEvents
      );
      setData({ ...json, tenants });
    } catch (err: any) {
      toast.error(err.message || 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredTenants = (data?.tenants || []).filter(
    t => t.name.toLowerCase().includes(search.toLowerCase()) ||
         t.plan.toLowerCase().includes(search.toLowerCase())
  );

  const maxGuests = Math.max(...filteredTenants.map(t => t.totalGuests), 1);

  const exportExcel = async () => {
    setExporting('excel');
    try {
      const XLSX = await import('xlsx');
      const wsData = [
        ['Tenant', 'Plan', 'Events', 'Guests', 'Checked In', 'Invitations', 'Credits'],
        ...filteredTenants.map(t => [
          t.name, t.plan, t.totalEvents, t.totalGuests, t.checkedIn, t.invitationsSent, t.credits,
        ]),
      ];
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = [
        { wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 10 },
        { wch: 12 }, { wch: 14 }, { wch: 10 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Reports');
      XLSX.writeFile(wb, `admin-reports-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Excel exported');
    } catch {
      toast.error('Failed to export Excel');
    } finally {
      setExporting(null);
    }
  };

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting('pdf');
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);
      const canvas = await html2canvas(reportRef.current, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = (canvas.height * pdfW) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfW, pdfH);
      pdf.save(`admin-reports-${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('PDF exported');
    } catch {
      toast.error('Failed to export PDF');
    } finally {
      setExporting(null);
    }
  };

  const exportWord = async () => {
    setExporting('word');
    try {
      const docx = await import('docx');
      const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        WidthType, AlignmentType, HeadingLevel, BorderStyle } = docx;

      const headerCell = (text: string) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, color: 'FFFFFF' })] })],
          shading: { fill: '0D4B4B' },
          width: { size: 14, type: WidthType.PERCENTAGE },
        });

      const dataCell = (text: string) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
          width: { size: 14, type: WidthType.PERCENTAGE },
        });

      const doc = new Document({
        sections: [{
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun({ text: 'Admin Reports', bold: true, size: 32, color: '0D4B4B' })],
              spacing: { after: 200 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Generated: ${new Date().toLocaleDateString()}`, size: 20, color: '666666' }),
              ],
              spacing: { after: 300 },
            }),
            new Paragraph({
              children: [
                new TextRun({ text: `Total Tenants: ${data?.totalTenants ?? 0}  |  `, bold: true, size: 22 }),
                new TextRun({ text: `Total Events: ${data?.totalEvents ?? 0}  |  `, bold: true, size: 22 }),
                new TextRun({ text: `Total Guests: ${data?.totalGuests ?? 0}`, bold: true, size: 22 }),
              ],
              spacing: { after: 400 },
            }),
            new Table({
              rows: [
                new TableRow({
                  children: [
                    headerCell('Tenant'), headerCell('Plan'), headerCell('Events'),
                    headerCell('Guests'), headerCell('Checked In'), headerCell('Invitations'),
                    headerCell('Credits'),
                  ],
                }),
                ...filteredTenants.map(t =>
                  new TableRow({
                    children: [
                      dataCell(t.name), dataCell(t.plan), dataCell(String(t.totalEvents)),
                      dataCell(String(t.totalGuests)), dataCell(String(t.checkedIn)),
                      dataCell(String(t.invitationsSent)), dataCell(String(t.credits)),
                    ],
                  })
                ),
              ],
              width: { size: 100, type: WidthType.PERCENTAGE },
            }),
          ],
        }],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `admin-reports-${new Date().toISOString().slice(0, 10)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Word exported');
    } catch {
      toast.error('Failed to export Word');
    } finally {
      setExporting(null);
    }
  };

  if (sessionStatus === 'loading' || (!data && loading)) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={28} className="animate-spin text-[#0D4B4B]" />
      </div>
    );
  }

  if (!data && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
          <AlertCircle size={24} className="text-red-500" />
        </div>
        <p className="text-sm font-semibold text-gray-900">Failed to load reports</p>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-[#0D4B4B] text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const summaryCards = [
    { label: 'Total Tenants', value: data!.totalTenants, icon: Building2, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
    { label: 'Total Events', value: data!.totalEvents, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Total Guests', value: data!.totalGuests, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Checked In', value: data!.checkedIn, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Invitations Sent', value: data!.invitationsSent, icon: Mail, color: 'text-[#FF6B5C]', bg: 'bg-[#FF6B5C]/5' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-serif">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Platform-wide analytics across all tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportPDF}
            disabled={!!exporting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            PDF
          </button>
          <button
            onClick={exportExcel}
            disabled={!!exporting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting === 'excel' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Excel
          </button>
          <button
            onClick={exportWord}
            disabled={!!exporting}
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {exporting === 'word' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            Word
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {summaryCards.map(card => (
          <div
            key={card.label}
            className="bg-white rounded-[20px] border border-gray-200 p-5 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                <card.icon size={18} className={card.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{card.value.toLocaleString()}</p>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{card.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Refresh */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
          />
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Report Table */}
      <div ref={reportRef} className="bg-white rounded-[20px] border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Events</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Guests</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Checked In</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Invitations</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Guest Distribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={8} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Building2 size={24} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No tenants found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] flex-shrink-0">
                          <Building2 size={16} />
                        </div>
                        <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{tenant.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{tenant.plan}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Calendar size={13} className="text-gray-400" />
                        {tenant.totalEvents}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Users size={13} className="text-gray-400" />
                        {tenant.totalGuests}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <UserCheck size={13} className="text-green-500" />
                        {tenant.checkedIn}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <Mail size={13} className="text-[#FF6B5C]" />
                        {tenant.invitationsSent}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="text-sm font-semibold text-violet-600">{tenant.credits}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="w-full max-w-[160px]">
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#0D4B4B] to-[#0D4B4B]/70 rounded-full transition-all duration-500"
                            style={{ width: `${Math.max((tenant.totalGuests / maxGuests) * 100, 2)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-gray-400 mt-1">{tenant.totalGuests.toLocaleString()} guests</p>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {!loading && data && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {filteredTenants.length} of {data.tenants.length} tenants</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <TrendingUp size={12} />
            Sorted by most active (events)
          </span>
        </div>
      )}
    </div>
  );
}
