import React, { useState } from 'react';
import { Activity, ShieldCheck, Zap, Radio, Search, Filter } from 'lucide-react';
import { MeshPacket, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface PacketLogsPanelProps {
  packets: MeshPacket[];
  lang: LanguageMode;
  onInspectPacket: (packet: MeshPacket) => void;
}

export const PacketLogsPanel: React.FC<PacketLogsPanelProps> = ({
  packets,
  lang,
  onInspectPacket,
}) => {
  const t = translations[lang];
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPackets = packets.filter((p) => {
    const matchesType = filterType === 'ALL' || p.type === filterType;
    const matchesSearch =
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.senderName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.targetId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="bg-[#14161B] border border-[#2D3139] p-5 shadow-2xl flex flex-col gap-4 font-mono">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#0E1014] text-[#00FF9C] border border-[#2D3139] flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{t.tabLogs}</h2>
            <p className="text-xs text-[#8A909D]">মেস প্যাকেটের রিয়েল-টাইম ট্রাফিক লগ</p>
          </div>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#8A909D] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="প্যাকেট বা প্রেরক খুঁজুন..."
              className="bg-[#0A0B0E] text-white text-xs pl-8 pr-3 py-1.5 border border-[#2D3139] focus:outline-none focus:border-[#00FF9C]"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-[#0A0B0E] text-[#E1E4EA] text-xs px-3 py-1.5 border border-[#2D3139] focus:outline-none focus:border-[#00FF9C] font-bold uppercase"
          >
            <option value="ALL">সব প্রকার</option>
            <option value="CHAT_TEXT">CHAT_TEXT</option>
            <option value="VOICE_STREAM">VOICE_STREAM</option>
            <option value="EMERGENCY_SOS">EMERGENCY_SOS</option>
          </select>
        </div>
      </div>

      {/* Packet Table */}
      <div className="overflow-x-auto border border-[#2D3139] bg-[#0A0B0E]">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#14161B] border-b border-[#2D3139] text-[#8A909D] uppercase">
            <tr>
              <th className="p-3">Packet ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Sender</th>
              <th className="p-3">Recipient</th>
              <th className="p-3">TTL / Hops</th>
              <th className="p-3">Route Trace</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2D3139] text-[#E1E4EA]">
            {filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[#8A909D]">
                  কোন প্যাকেট ডাটা পাওয়া যায়নি।
                </td>
              </tr>
            ) : (
              filteredPackets.map((packet) => (
                <tr key={packet.id} className="hover:bg-[#14161B] transition-colors">
                  <td className="p-3 text-[#00FF9C] font-bold">{packet.id}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold border ${
                        packet.type === 'EMERGENCY_SOS'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                          : packet.type === 'VOICE_STREAM'
                          ? 'bg-[#00FF9C]/20 text-[#00FF9C] border-[#00FF9C]/40'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                      }`}
                    >
                      {packet.type}
                    </span>
                  </td>
                  <td className="p-3">{packet.senderName}</td>
                  <td className="p-3 text-[#8A909D]">{packet.targetId}</td>
                  <td className="p-3 text-amber-400">
                    TTL: {packet.ttl} | Hops: {packet.hopCount}
                  </td>
                  <td className="p-3 text-[#8A909D] truncate max-w-xs">
                    {packet.routingTrace.join(' → ')}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => onInspectPacket(packet)}
                      className="px-2.5 py-1 bg-[#14161B] hover:bg-[#2D3139] text-[#00FF9C] border border-[#2D3139] transition-all font-bold uppercase text-[10px]"
                    >
                      Inspect 🔍
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
