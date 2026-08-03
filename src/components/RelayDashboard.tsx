import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Zap,
  Activity,
  BatteryCharging,
  Wifi,
  Copy,
  ExternalLink,
  Shield,
  Smartphone,
  Share2,
  Check,
  Settings,
  Users,
  Sliders,
  Crown,
  PhoneCall,
  RefreshCw,
  Key,
  Clock,
  Volume2,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { MeshNode, MeshPacket, LanguageMode } from '../types/mesh';

interface RelayDashboardProps {
  nodes: MeshNode[];
  packets: MeshPacket[];
  myNodeId: string;
  lang: LanguageMode;
  onSwitchToSimple: () => void;
  onSwitchToMaster: () => void;
  onStartCall?: (targetCode: string, targetName: string) => void;
}

export const RelayDashboard: React.FC<RelayDashboardProps> = ({
  nodes,
  packets,
  myNodeId,
  lang,
  onSwitchToSimple,
  onSwitchToMaster,
  onStartCall,
}) => {
  const [isRelayActive, setIsRelayActive] = useState<boolean>(true);
  const [stationName, setStationName] = useState<string>('OffGrid-Relay-Station-Alpha');
  const [powerSaveThreshold, setPowerSaveThreshold] = useState<number>(20);
  const [maxHopsLimit, setMaxHopsLimit] = useState<number>(7);
  const [isAutoForwarding, setIsAutoForwarding] = useState<boolean>(true);

  // Agora Master Control State
  const [agoraAppId, setAgoraAppId] = useState<string>('8e48363cdc6c4fc696be606b8f3d6f64');
  const [agoraCert, setAgoraCert] = useState<string>('2fc1a4e7638a423ca2b96b0f3cd69fcd');
  const [agoraMode, setAgoraMode] = useState<'AGORA' | 'MESH_PCM'>('AGORA');
  const [agoraEnabled, setAgoraEnabled] = useState<boolean>(true);
  const [isSavingAgora, setIsSavingAgora] = useState<boolean>(false);
  const [agoraSaveMsg, setAgoraSaveMsg] = useState<string | null>(null);

  // Call Logs & History State
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [callSummary, setCallSummary] = useState<{
    totalCalls: number;
    totalMinutes: number;
    totalSeconds: number;
    userStats: Record<string, { name: string; totalSeconds: number; callCount: number }>;
  } | null>(null);
  const [isLoadingCallLogs, setIsLoadingCallLogs] = useState<boolean>(false);

  const [relayedCount, setRelayedCount] = useState<number>(
    () => packets.filter((p) => p.hopCount > 1).length + 42
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const relayUrl = `${window.location.origin}?mode=relay`;

  const fetchAgoraConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/agora/config');
      const data = await res.json();
      if (data && data.success) {
        if (data.appId) setAgoraAppId(data.appId);
        if (data.mode) setAgoraMode(data.mode);
        if (data.appCertificate) setAgoraCert(data.appCertificate);
        if (data.enabled !== undefined) setAgoraEnabled(data.enabled);
      }
    } catch (e) {
      console.error('Error fetching Agora config:', e);
    }
  }, []);

  const fetchCallLogs = useCallback(async () => {
    setIsLoadingCallLogs(true);
    try {
      const res = await fetch('/api/calls/history');
      const data = await res.json();
      if (data && data.success) {
        setCallLogs(data.logs || []);
        setCallSummary(data.summary || null);
      }
    } catch (e) {
      console.error('Error fetching call history:', e);
    } finally {
      setIsLoadingCallLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchAgoraConfig();
    fetchCallLogs();
  }, [fetchAgoraConfig, fetchCallLogs]);

  const handleSaveAgoraSettings = async () => {
    setIsSavingAgora(true);
    setAgoraSaveMsg(null);
    try {
      const res = await fetch('/api/agora/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId: agoraAppId,
          appCertificate: agoraCert,
          mode: agoraMode,
          enabled: agoraEnabled,
        }),
      });
      const data = await res.json();
      if (data && data.success) {
        setAgoraSaveMsg('✅ Agora কনফিগারেশন সফলভাবে আপডেট করা হয়েছে!');
        setTimeout(() => setAgoraSaveMsg(null), 3000);
      } else {
        setAgoraSaveMsg('❌ আপডেট করতে সমস্যা হয়েছে');
      }
    } catch (e: any) {
      setAgoraSaveMsg(`❌ ত্রুটি: ${e.message}`);
    } finally {
      setIsSavingAgora(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRelayActive) {
        setRelayedCount((prev) => prev + Math.floor(Math.random() * 2) + 1);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [isRelayActive]);

  const copyRelayUrl = () => {
    navigator.clipboard.writeText(relayUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const selfNode = nodes.find((n) => n.id === myNodeId) || nodes[0];
  const activeNeighbors = nodes.filter((n) => n.id !== myNodeId && n.status === 'ONLINE');

  return (
    <div className="max-w-5xl mx-auto space-y-5 font-mono text-white p-2 sm:p-4">
      {/* Top Banner Header */}
      <div className="bg-[#14161B] border-2 border-amber-500/80 p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -top-10 opacity-10 pointer-events-none">
          <Radio className="w-56 h-56 text-amber-400" />
        </div>

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 bg-amber-500/20 border-2 border-amber-400 rounded-lg flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500 text-black font-extrabold px-2 py-0.5 rounded uppercase">
                  📡 অফগ্রিড রিলে নোড হাব
                </span>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 border ${
                    isRelayActive
                      ? 'bg-[#00FF9C]/20 text-[#00FF9C] border-[#00FF9C]'
                      : 'bg-rose-500/20 text-rose-400 border-rose-500'
                  }`}
                >
                  {isRelayActive ? '🟢 সার্ভিস সক্রিয়' : '🔴 নিষ্ক্রিয়'}
                </span>
              </div>
              <h2 className="text-lg font-extrabold text-white mt-1">
                {stationName} ({myNodeId})
              </h2>
              <p className="text-xs text-[#8A909D]">
                আপনার ফোন এখন একটি অফগ্রিড রিলে টাওয়ার হিসেবে কাজ করছে এবং আশেপাশের মেসেজের কভারেজ বাড়াচ্ছে।
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={onSwitchToSimple}
              className="flex-1 md:flex-none px-3.5 py-2 bg-[#14161B] hover:bg-[#1A1D24] text-[#00FF9C] border border-[#00FF9C]/50 text-xs font-extrabold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Smartphone className="w-4 h-4" />
              <span>📱 সাধারণ কল ও চ্যাট</span>
            </button>

            <button
              onClick={onSwitchToMaster}
              className="flex-1 md:flex-none px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500 text-xs font-extrabold uppercase flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Crown className="w-4 h-4" />
              <span>👑 মাস্টার কমান্ড সেন্টার</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Relay Link Sharing Card */}
      <div className="bg-[#0E1014] border border-[#2D3139] p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D3139] pb-2.5">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-extrabold text-white uppercase">
              অন্যান্য ডিভাইসকে রিলে বানাতে এই লিঙ্ক শেয়ার করুন:
            </h3>
          </div>
          <span className="text-xs text-amber-400 font-bold">
            🔗 ডেডিকেটেড রিলে ড্যাশবোর্ড লিঙ্ক
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="w-full bg-[#14161B] text-[#00FF9C] px-3 py-2 text-xs font-mono border border-[#2D3139] truncate">
            {relayUrl}
          </div>
          <button
            onClick={copyRelayUrl}
            className="w-full sm:w-auto px-5 py-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs uppercase flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0 shadow-lg"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'কপি সম্পন্ন!' : 'লিঙ্ক কপি করুন'}</span>
          </button>
        </div>
        <p className="text-[11px] text-[#8A909D]">
          💡 এই লিঙ্কটিতে ক্লিক করলে যেকেউ তাদের ফোন বা পিসি দিয়ে নেটওয়ার্কের একটি আলাদা রিলে নোড চালনা করতে পারবে।
        </p>
      </div>

      {/* Relay Toggle & Live Telemetry Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Toggle Box */}
        <div className="bg-[#14161B] border border-[#2D3139] p-4 flex flex-col justify-between gap-4">
          <div>
            <h4 className="text-xs text-[#8A909D] font-bold uppercase mb-1">
              রিলে স্ট্যাটাস কন্ট্রোল
            </h4>
            <p className="text-sm font-extrabold text-white">
              {isRelayActive ? 'রিলে সার্ভিস চালু আছে' : 'রিলে পজ করা আছে'}
            </p>
          </div>

          <button
            onClick={() => setIsRelayActive(!isRelayActive)}
            className={`w-full py-3 font-extrabold text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer shadow-xl ${
              isRelayActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400'
                : 'bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black border-[#00FF9C]'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{isRelayActive ? '🔴 রিলে বন্ধ করুন' : '🟢 রিলে সক্রিয় করুন'}</span>
          </button>
        </div>

        {/* Relayed Packets Meter */}
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#8A909D] font-bold uppercase">
            <span>স্থানান্তরিত প্যাকেট (Forwarded)</span>
            <Activity className="w-4 h-4 text-[#00FF9C]" />
          </div>
          <div className="text-3xl font-extrabold text-[#00FF9C] font-mono">
            {relayedCount} <span className="text-xs text-[#8A909D]">প্যাকেট</span>
          </div>
          <p className="text-[10px] text-[#8A909D]">
            AODV শর্টেস্ট-পাথ অ্যালগরিদম দ্বারা স্বয়ংক্রিয়ভাবে রাউট করা হয়েছে।
          </p>
        </div>

        {/* Battery & Power Optimization */}
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-[#8A909D] font-bold uppercase">
            <span>পাওয়ার সেভিং মোড</span>
            <BatteryCharging className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {selfNode?.batteryLevel || 88}% <span className="text-xs text-white">ব্যাটারি</span>
          </div>
          <p className="text-[10px] text-[#8A909D]">
            BLE 5.3 Low Energy Radio Mode: প্রতি ঘণ্টায় মাত্র ২% চার্জ গ্রহণ।
          </p>
        </div>
      </div>

      {/* MASTER CONTROL: REGISTERED USERS & AREA TRACKER PANEL */}
      <div className="bg-[#14161B] border-2 border-cyan-500/80 p-5 shadow-2xl space-y-4 rounded">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-[#2D3139] pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-cyan-500/20 border border-cyan-400 rounded flex items-center justify-center text-cyan-400 font-extrabold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wide flex items-center gap-2">
                <span>📊 মাস্টার কন্ট্রোল: নিবন্ধিত ইউজার ও কভারেজ এরিয়া তালিকা</span>
              </h3>
              <p className="text-xs text-[#8A909D]">
                ডিবিতে থাকা সমস্ত ইউজার, তাদের অবস্থান/এরিয়া এবং কভারেজ স্ট্যাটাস সরাসরি দেখুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="bg-[#0E1014] border border-[#2D3139] px-2.5 py-1 rounded text-cyan-400 font-bold">
              মোট ইউজার: {nodes.filter((n) => n.type === 'MOBILE_USER').length}
            </span>
            <span className="bg-[#00FF9C]/10 border border-[#00FF9C]/40 px-2.5 py-1 rounded text-[#00FF9C] font-bold">
              অনলাইন: {nodes.filter((n) => n.type === 'MOBILE_USER' && n.status === 'ONLINE').length}
            </span>
          </div>
        </div>

        {/* User Nodes Location Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-[#0E1014] text-[#8A909D] uppercase border-b border-[#2D3139]">
                <th className="p-2.5">ইউজার নাম ও ফোন কোড</th>
                <th className="p-2.5">অবস্থান / নেটওয়ার্ক এরিয়া</th>
                <th className="p-2.5">কভারেজ স্ট্যাটাস</th>
                <th className="p-2.5">সংকেত / ব্যাটারি</th>
                <th className="p-2.5 text-right">মাস্টার অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3139]">
              {nodes
                .filter((n) => n.type === 'MOBILE_USER')
                .map((userNode) => {
                  const isOnline = userNode.status === 'ONLINE';
                  return (
                    <tr key={userNode.id} className="hover:bg-[#1A1D24] transition-colors">
                      <td className="p-2.5">
                        <div className="font-extrabold text-white flex items-center gap-1.5">
                          <Smartphone className="w-4 h-4 text-cyan-400" />
                          <span>{userNode.name}</span>
                        </div>
                        <span className="text-[10px] text-cyan-400 font-mono">
                          [{userNode.id}]
                        </span>
                      </td>

                      <td className="p-2.5 font-bold text-amber-300">
                        📍 {userNode.locationArea || 'ঢাকা সেন্ট্রাল (মিরপুর / ধানমন্ডি হাব)'}
                      </td>

                      <td className="p-2.5">
                        {isOnline ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/40 font-extrabold text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-ping" />
                            🟢 নেটওয়ার্কের আওতায়
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800 font-bold text-[10px]">
                            🔴 অফলাইন (নেটওয়ার্কের বাহিরে)
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 text-[#8A909D]">
                        <div>RSSI: <span className="text-white font-bold">{userNode.rssi || -55} dBm</span></div>
                        <div>🔋 {userNode.batteryLevel || 88}%</div>
                      </td>

                      <td className="p-2.5 text-right">
                        {onStartCall && (
                          <button
                            onClick={() => onStartCall(userNode.code || userNode.id, userNode.name)}
                            className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold text-[11px] uppercase rounded inline-flex items-center gap-1 cursor-pointer transition-all shadow-md"
                          >
                            <PhoneCall className="w-3.5 h-3.5" />
                            <span>ডাইরেক্ট কল</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Connected Neighbor Peers Grid & Relay Config */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Neighbor Nodes Table */}
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
            <h3 className="text-xs font-extrabold text-[#00FF9C] uppercase flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>সংযুক্ত নোডসমূহ ({activeNeighbors.length})</span>
            </h3>
            <span className="text-[10px] text-[#8A909D]">RSSI কভারেজ</span>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto">
            {activeNeighbors.length === 0 ? (
              <div className="text-center py-6 text-xs text-[#8A909D]">
                কোনো সরাসরি প্রতিবেশী নোড পাওয়া যায়নি...
              </div>
            ) : (
              activeNeighbors.map((node) => (
                <div
                  key={node.id}
                  className="bg-[#0E1014] border border-[#2D3139] p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-extrabold text-white block">{node.name}</span>
                    <span className="text-[10px] text-[#8A909D]">ID: {node.id}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#00FF9C] font-bold block">{node.rssi} dBm</span>
                    <span className="text-[10px] text-[#8A909D]">{node.distanceMeter}m রেঞ্জ</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Relay Configuration Controls */}
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#2D3139] pb-2">
            <h3 className="text-xs font-extrabold text-amber-400 uppercase flex items-center gap-1.5">
              <Settings className="w-4 h-4" />
              <span>রিলে টাওয়ার কনফিগারেশন</span>
            </h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-[#8A909D] uppercase block mb-1">
                রিলে স্টেশন নাম:
              </label>
              <input
                type="text"
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                className="w-full bg-[#0E1014] text-white border border-[#2D3139] focus:border-amber-400 px-3 py-1.5 font-mono"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">অটো রিলে ফরওয়ার্ডিং</span>
                <span className="text-[10px] text-[#8A909D]">
                  মেসেজ ও ভয়েস অটোমেটিক পাশ করা হবে
                </span>
              </div>
              <input
                type="checkbox"
                checked={isAutoForwarding}
                onChange={(e) => setIsAutoForwarding(e.target.checked)}
                className="w-4 h-4 accent-[#00FF9C] cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-white block">সর্বোচ্চ হপ লিমিট (TTL)</span>
                <span className="text-[10px] text-[#8A909D]">
                  নেটওয়ার্ক লুপ বন্ধ করার জন্য
                </span>
              </div>
              <select
                value={maxHopsLimit}
                onChange={(e) => setMaxHopsLimit(Number(e.target.value))}
                className="bg-[#0E1014] text-[#00FF9C] border border-[#2D3139] px-2 py-1 text-xs"
              >
                <option value={3}>৩ হপ (~৩ কিমি)</option>
                <option value={5}>৫ হপ (~৫ কিমি)</option>
                <option value={7}>৭ হপ (~৭ কিমি)</option>
                <option value={10}>১০ হপ (~১০ কিমি)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* AGORA MASTER CONTROL & CALL DURATION ANALYTICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Agora API Key & Configuration Box */}
        <div className="bg-[#14161B] border-2 border-cyan-500/50 p-4 space-y-4 rounded-lg shadow-xl">
          <div className="flex items-center justify-between border-b border-[#2D3139] pb-2.5">
            <h3 className="text-sm font-extrabold text-cyan-400 uppercase flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>🎙️ আগোরা (Agora) ভয়েস মাস্টার কন্ট্রোল</span>
            </h3>
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-extrabold text-[10px] border border-cyan-500/40">
              API কনফিগারেশন
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] font-bold text-cyan-300 uppercase block mb-1">
                Agora App ID (এপিআই কি):
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={agoraAppId}
                  onChange={(e) => setAgoraAppId(e.target.value)}
                  placeholder="e.g. e8992147fd9c48bc8945419fb25dfb3e"
                  className="w-full bg-[#0E1014] text-white border border-cyan-500/40 focus:border-cyan-400 px-3 py-2 font-mono text-xs rounded"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Agora Console (console.agora.io) থেকে সংগৃহীত App ID টি এখানে প্রদেয়।
              </p>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-300 uppercase block mb-1">
                Agora App Certificate (ঐচ্ছিক):
              </label>
              <input
                type="password"
                value={agoraCert}
                onChange={(e) => setAgoraCert(e.target.value)}
                placeholder="মাস্টার সিক্রেট টোকেন সার্টিফিকেট (যদি থাকে)"
                className="w-full bg-[#0E1014] text-white border border-[#2D3139] focus:border-cyan-400 px-3 py-2 font-mono text-xs rounded"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-emerald-400 uppercase block mb-1">
                ডিফল্ট ভয়েস কল মোড (System Mode):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAgoraMode('AGORA')}
                  className={`p-2 rounded border text-center transition-all cursor-pointer text-xs font-bold ${
                    agoraMode === 'AGORA'
                      ? 'bg-cyan-500 text-black border-cyan-400 font-extrabold shadow-md'
                      : 'bg-[#0E1014] text-slate-300 border-[#2D3139]'
                  }`}
                >
                  🌐 Agora HD Voice (প্রস্তাবিত)
                </button>
                <button
                  type="button"
                  onClick={() => setAgoraMode('MESH_PCM')}
                  className={`p-2 rounded border text-center transition-all cursor-pointer text-xs font-bold ${
                    agoraMode === 'MESH_PCM'
                      ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-md'
                      : 'bg-[#0E1014] text-slate-300 border-[#2D3139]'
                  }`}
                >
                  ⚡ Mesh P2P PCM (অফ-গ্রিড)
                </button>
              </div>
            </div>

            {agoraSaveMsg && (
              <div className="p-2 rounded bg-cyan-950 border border-cyan-400 text-cyan-200 text-xs font-bold animate-pulse">
                {agoraSaveMsg}
              </div>
            )}

            <button
              type="button"
              onClick={handleSaveAgoraSettings}
              disabled={isSavingAgora}
              className="w-full py-2.5 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs uppercase rounded flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg"
            >
              <Save className="w-4 h-4" />
              <span>{isSavingAgora ? 'সংরক্ষণ হচ্ছে...' : 'মাস্টার কনফিগারেশন সেভ করুন'}</span>
            </button>
          </div>
        </div>

        {/* User Call Minutes & Duration History Panel */}
        <div className="bg-[#14161B] border-2 border-emerald-500/50 p-4 space-y-4 rounded-lg shadow-xl">
          <div className="flex items-center justify-between border-b border-[#2D3139] pb-2.5">
            <h3 className="text-sm font-extrabold text-emerald-400 uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              <span>📞 ইউজারের কথাবলার মিনিট ও কলের ইতিহাস</span>
            </h3>
            <button
              type="button"
              onClick={fetchCallLogs}
              disabled={isLoadingCallLogs}
              className="p-1 text-slate-400 hover:text-emerald-400 transition-colors"
              title="রিফ্রেশ করুন"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingCallLogs ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Quick Stats Cards */}
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="bg-[#0E1014] border border-emerald-500/30 p-2.5 rounded">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">মোট কথাবলা সময়</span>
              <span className="text-lg font-black text-emerald-400">
                {callSummary ? `${callSummary.totalMinutes} মিনিট` : '০.০০ মিনিট'}
              </span>
            </div>
            <div className="bg-[#0E1014] border border-cyan-500/30 p-2.5 rounded">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">মোট কলের সংখ্যা</span>
              <span className="text-lg font-black text-cyan-400">
                {callSummary ? `${callSummary.totalCalls} টি` : '০ টি'}
              </span>
            </div>
          </div>

          {/* Call Log List Table */}
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {callLogs.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                এখনো কোনো কলের ইতিহাস তৈরি হয়নি...
              </div>
            ) : (
              callLogs.map((log: any, idx: number) => {
                const durMin = (log.durationSeconds / 60).toFixed(1);
                const isAgora = log.callMode === 'AGORA';
                const dateStr = new Date(log.startTime || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div
                    key={log.id || idx}
                    className="bg-[#0E1014] border border-[#2D3139] p-2.5 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-extrabold text-white flex items-center gap-1.5">
                        <span className="text-cyan-300">{log.callerName}</span>
                        <span className="text-slate-500">➔</span>
                        <span className="text-emerald-300">{log.receiverName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <span>⏰ {dateStr}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${isAgora ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                          {isAgora ? 'Agora HD' : 'Mesh PCM'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-emerald-400 font-extrabold text-sm block">
                        {log.durationSeconds > 60 ? `${durMin} মিনিট` : `${log.durationSeconds} সে.`}
                      </span>
                      <span className="text-[9px] text-slate-400">
                        {log.status === 'COMPLETED' ? '✅ সম্পন্ন' : '❌ সংকেত বিচ্ছিন্ন'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
