import React, { useState, useEffect } from 'react';
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

  const [relayedCount, setRelayedCount] = useState<number>(
    () => packets.filter((p) => p.hopCount > 1).length + 42
  );
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const relayUrl = `${window.location.origin}?mode=relay`;

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
                            onClick={() => onStartCall(userNode.id, userNode.name)}
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
    </div>
  );
};
