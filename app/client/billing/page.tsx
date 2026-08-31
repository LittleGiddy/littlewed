'use client';
import { useEffect, useState } from 'react';
import { Coins, TrendingUp, MessageCircle, Phone, RefreshCw, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import RequestCreditsButton from '@/app/components/RequestCreditsButton';

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [hasPending, setHasPending] = useState(false);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const [billingRes, pendingRes] = await Promise.all([
        fetch('/api/tenant/billing', { credentials: 'include' }),
        fetch('/api/credits/pending', { credentials: 'include' }),
      ]);
      const billingData = await billingRes.json();
      const pendingData = await pendingRes.json();
      setBalance(billingData.tenant?.credits ?? 0);
      setUsage(billingData.usage || []);
      setHasPending(!!pendingData.pending);
    } catch {
      toast.error('Failed to load billing data');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalSpent = usage.reduce((sum: number, u: any) => sum + (u.cost || 0), 0);
  const whatsappCount = usage.filter((u: any) => u.channel === 'whatsapp').length;
  const smsCount = usage.filter((u: any) => u.channel === 'sms').length;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 animate-[fadeUp_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ─── Page Header ─── */}
      <div className="flex items-start justify-between mb-7 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">
            <span className="w-[5px] h-[5px] rounded-full bg-[#FF6B5C]" />
            Billing
          </div>
          <h1 className="font-serif text-[30px] font-black text-gray-900 leading-tight tracking-tight m-0 mb-1.5">
            Credits &amp; <span className="text-[#FF6B5C]">Billing</span>
          </h1>
          <p className="text-sm text-gray-400 m-0">Request credits from admin to send invitations via WhatsApp or SMS.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loadingData}
          className={`flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-500 text-[13px] font-bold font-sans cursor-pointer shrink-0 transition-all hover:border-[#0D4B4B] hover:text-[#0D4B4B] ${loadingData ? '[&_svg]:animate-spin' : ''}`}
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* ─── Balance Card ─── */}
      <div className="bg-white border border-gray-200 rounded-[22px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.05)] mb-5">
        <div className="h-1 bg-gradient-to-r from-[#0D4B4B] to-pink-400" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider m-0">Available balance</p>
              {loadingData ? (
                <div className="w-[140px] h-[52px] bg-gray-100 rounded-[10px] mt-1 animate-pulse" />
              ) : (
                <div className="font-serif text-[52px] font-black text-[#0D4B4B] leading-none tracking-tight mt-1">
                  {balance?.toLocaleString() ?? 0}
                  <span className="text-lg text-gray-400 font-semibold ml-1.5 font-sans">credits</span>
                </div>
              )}
            </div>
            <div className="w-[72px] h-[72px] rounded-[20px] shrink-0 bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 flex items-center justify-center text-[#0D4B4B]">
              <Coins size={32} />
            </div>
          </div>

          <div className="flex gap-4 mt-4 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-gray-500">
              <MessageCircle size={13} className="text-[#0D4B4B]" />
              WhatsApp: <strong className="text-gray-900 ml-0.5">{whatsappCount}</strong>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-gray-500">
              <Phone size={13} className="text-amber-600" />
              SMS: <strong className="text-gray-900 ml-0.5">{smsCount}</strong>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-[10px] px-3.5 py-2 text-[12.5px] font-semibold text-gray-500">
              <TrendingUp size={13} className="text-violet-600" />
              Total spent: <strong className="text-gray-900 ml-0.5">{totalSpent.toLocaleString()} TZS</strong>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Request Credits Card ─── */}
      <div className="bg-white border border-gray-200 rounded-[22px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.05)] mb-5">
        <div className="h-1 bg-gradient-to-r from-[#0D4B4B] to-pink-400" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-[17px] font-extrabold text-gray-800 tracking-tight m-0">Request Credits</h2>
            {hasPending && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <Clock size={11} /> Pending
              </span>
            )}
          </div>

          {hasPending ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center mb-4">
              <Clock size={28} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm font-bold text-amber-800">Request Under Review</p>
              <p className="text-xs text-amber-600 mt-1">Your credit request is being reviewed by the admin. You&apos;ll be notified when it&apos;s approved. Need it sooner? WhatsApp +255702529514.</p>
            </div>
          ) : (
            <div className="bg-[#0D4B4B]/5/50 border border-[#0D4B4B]/10 rounded-2xl p-5 text-center mb-4">
              <Send size={28} className="text-[#0D4B4B] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#0A3939]">Need more credits?</p>
              <p className="text-xs text-[#0D4B4B] mt-1">Send a request to the admin with your desired amount. Each credit costs 500 TZS.</p>
            </div>
          )}

          <div className="flex justify-center">
            <RequestCreditsButton hasPending={hasPending} onRequestSent={() => loadData()} />
          </div>

          <p className="text-[11.5px] text-gray-400 mt-3 text-center leading-relaxed">
            1 credit = <strong className="text-gray-500">500 TZS</strong> · Credits are granted by the super admin
          </p>
        </div>
      </div>

      {/* ─── Usage Card ─── */}
      <div className="bg-white border border-gray-200 rounded-[22px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.05)]">
        <div className="h-1 bg-gradient-to-r from-green-600 to-[#0D4B4B]/70" />
        <div className="p-6 sm:p-7">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2.5">
            <h2 className="font-serif text-[17px] font-extrabold text-gray-800 tracking-tight m-0">Recent Usage</h2>
            {usage.length > 0 && (
              <span className="text-[11px] font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 px-2.5 py-1 rounded-full">
                {usage.length} record{usage.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {loadingData ? (
            <div className="flex flex-col gap-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="h-3.5 flex-1 bg-gray-100 rounded-md animate-pulse" />
                  <div className="h-3.5 w-20 bg-gray-100 rounded-md animate-pulse" />
                  <div className="h-3.5 w-16 bg-gray-100 rounded-md animate-pulse" />
                </div>
              ))}
            </div>
          ) : usage.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-[52px] h-[52px] rounded-[15px] mx-auto mb-3.5 bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 flex items-center justify-center text-[#0D4B4B]">
                <TrendingUp size={22} />
              </div>
              <h3 className="font-serif text-base font-extrabold text-gray-800 mb-1">No usage yet</h3>
              <p className="text-[13px] text-gray-400">Send invitations to see usage records here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="bg-gray-50 border-b">
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider text-gray-400 uppercase">Date</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider text-gray-400 uppercase">Event</th>
                    <th className="px-3.5 py-2.5 text-left text-[10.5px] font-bold tracking-wider text-gray-400 uppercase">Channel</th>
                    <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold tracking-wider text-gray-400 uppercase">Cost (TZS)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {usage.map((u: any) => (
                    <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-3.5 py-3 text-xs text-gray-400">
                        {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-3.5 py-3 font-bold text-gray-800">{u.event?.name || '-'}</td>
                      <td className="px-3.5 py-3">
                        <span className={`inline-flex items-center gap-1 text-[11.5px] font-bold px-2.5 py-[3px] rounded-full ${
                          u.channel === 'whatsapp'
                            ? 'text-[#0D4B4B] bg-[#0D4B4B]/5 border border-[#0D4B4B]/10'
                            : 'text-amber-600 bg-amber-50 border border-amber-100'
                        }`}>
                          {u.channel === 'whatsapp'
                            ? <><MessageCircle size={11} /> WhatsApp</>
                            : <><Phone size={11} /> SMS</>
                          }
                        </span>
                      </td>
                      <td className="px-3.5 py-3 text-right font-bold text-gray-800">{(u.cost || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
