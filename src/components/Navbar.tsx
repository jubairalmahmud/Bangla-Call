import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  ShieldCheck,
  Globe,
  Sliders,
  MessageSquare,
  PhoneCall,
  MapPin,
  Code2,
  AlertTriangle,
  Activity,
  Zap,
  Crown,
  Smartphone,
  Share2,
  Copy,
  Check,
  X,
  Link,
} from 'lucide-react';
import { LanguageMode, ActiveTab } from '../types/mesh';
import { translations } from '../lib/translations';

export type ViewMode = 'MASTER' | 'SIMPLE_USER' | 'RELAY_NODE';

interface NavbarProps {
  lang: LanguageMode;
  setLang: (l: LanguageMode) => void;
  activeTab: ActiveTab;
  setActiveTab: (t: ActiveTab) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  nodesCount: number;
  myNodeName?: string;
  openSosModal: () => void;
  isConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  lang,
  setLang,
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  nodesCount,
  myNodeName,
  openSosModal,
  isConnected,
}) => {
  const t = translations[lang];
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const baseUrl = window.location.origin;
  const userUrl = `${baseUrl}?mode=user`;
  const relayUrl = `${baseUrl}?mode=relay`;
  const masterUrl = `${baseUrl}?mode=master`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <header className="bg-[#14161B] border-b border-[#2D3139] text-[#E1E4EA] sticky top-0 z-40 shadow-2xl">
      {/* Top Banner Status Bar */}
      <div className="bg-[#0A0B0E] border-b border-[#2D3139] px-4 py-1 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-none bg-[#00FF9C]/10 border border-[#00FF9C]/40 text-[#00FF9C] font-semibold tracking-wider uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF9C] animate-ping" />
            {t.offGridActive}
          </span>
          {myNodeName && (
            <span className="px-2 py-0.5 bg-[#14161B] border border-[#00FF9C]/50 text-[#00FF9C] font-bold uppercase">
              আপনার ডিভাইস: {myNodeName}
            </span>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 text-[#8A909D]">
            <Radio className="w-3.5 h-3.5 text-[#00FF9C]" />
            BLE 5.3 + Wi-Fi Direct Mesh
          </span>
        </div>

        <div className="flex items-center space-x-4 text-[#8A909D]">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-[#00FF9C]" />
            <span>
              {t.connectedNodes}: <strong className="text-[#00FF9C] font-mono">{nodesCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {t.activeHops}: <strong className="text-[#E1E4EA] font-mono">7 Relay Hops</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-[#00FF9C]" />
            <span className="text-[#00FF9C] font-semibold tracking-wide">{t.e2eeBadge}</span>
          </div>
        </div>
      </div>

      {/* Mode Switcher Header Bar (Visible for Master Controller in all tabs, hidden for pure ?mode=user links) */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') !== 'user' && (
        <div className="bg-[#0E1014] border-b border-[#2D3139] px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
          <span className="text-[#8A909D] font-bold flex items-center gap-1.5 uppercase">
            <span>ইন্টারফেস মোড:</span>
          </span>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setViewMode('MASTER')}
              className={`px-3 py-1 font-bold uppercase text-[11px] border transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'MASTER'
                  ? 'bg-amber-500 text-black border-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                  : 'bg-[#14161B] text-[#8A909D] border-[#2D3139] hover:text-white'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>👑 মাস্টার কন্ট্রোল</span>
            </button>

            <button
              onClick={() => setViewMode('SIMPLE_USER')}
              className={`px-3 py-1 font-bold uppercase text-[11px] border transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'SIMPLE_USER'
                  ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-extrabold shadow-[0_0_12px_rgba(0,255,156,0.3)]'
                  : 'bg-[#14161B] text-[#8A909D] border-[#2D3139] hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 সাধারণ ইউজার (Call & SMS)</span>
            </button>

            <button
              onClick={() => setViewMode('RELAY_NODE')}
              className={`px-3 py-1 font-bold uppercase text-[11px] border transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'RELAY_NODE'
                  ? 'bg-cyan-400 text-black border-cyan-300 font-extrabold shadow-[0_0_12px_rgba(34,211,238,0.3)]'
                  : 'bg-[#14161B] text-[#8A909D] border-[#2D3139] hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>📡 রিলে নোড লিঙ্ক</span>
            </button>

            <button
              onClick={() => setIsShareModalOpen(true)}
              className="px-3 py-1 bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/50 font-extrabold uppercase text-[11px] transition-all flex items-center gap-1.5 cursor-pointer rounded shadow-[0_0_10px_rgba(0,255,156,0.2)]"
            >
              <Share2 className="w-3.5 h-3.5 animate-pulse" />
              <span>🔗 ইউজার ও রিলে লিঙ্ক শেয়ার করুন</span>
            </button>
          </div>
        </div>
      )}

      {/* Share Links Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-[#14161B] border-2 border-[#00FF9C] max-w-lg w-full p-6 rounded space-y-5 shadow-[0_0_50px_rgba(0,255,156,0.3)] relative">
            <button
              onClick={() => setIsShareModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-[#2D3139] pb-3 space-y-1">
              <div className="flex items-center gap-2 text-[#00FF9C] font-extrabold text-sm uppercase">
                <Share2 className="w-5 h-5" />
                <span>নেটওয়ার্ক এক্সেস লিঙ্কসমূহ (Shareable Links)</span>
              </div>
              <p className="text-xs text-[#8A909D]">
                নিচের লিঙ্কগুলো বন্ধুদের বা অন্যান্য ফোনে শেয়ার করে মেস নেটওয়ার্কে যুক্ত করুন:
              </p>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Simple User Link */}
              <div className="bg-[#0E1014] border border-[#00FF9C]/40 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-[#00FF9C] uppercase flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>১. সাধারণ ইউজার লিঙ্ক (General User Link):</span>
                  </span>
                  <span className="text-[10px] bg-[#00FF9C]/20 text-[#00FF9C] px-2 py-0.5 rounded font-bold">
                    নাম + ৬ ডিজিট কোড
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  সাধারণ ব্যবহারকারীরা এই লিংকে ঢুকে তাদের নাম এবং ৬ সংখ্যার কোড দিয়ে সরাসরি কল ও টেক্সট করতে পারবে।
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={userUrl}
                    className="flex-1 bg-[#14161B] border border-[#2D3139] text-white px-2.5 py-1.5 text-xs font-mono rounded"
                  />
                  <button
                    onClick={() => copyToClipboard(userUrl, 'user')}
                    className="px-3 py-1.5 bg-[#00FF9C] text-black font-extrabold uppercase rounded flex items-center gap-1 hover:bg-[#00FF9C]/90 cursor-pointer shrink-0"
                  >
                    {copiedType === 'user' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'user' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
              </div>

              {/* 2. Relay Node Link */}
              <div className="bg-[#0E1014] border border-cyan-500/40 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-cyan-400 uppercase flex items-center gap-1.5">
                    <Radio className="w-4 h-4" />
                    <span>২. রিলে নোড লিঙ্ক (Relay Tower Link):</span>
                  </span>
                  <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded font-bold">
                    নেটওয়ার্ক বিস্তার
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  যেসব ফোন বা ল্যাপটপ কোনো মানুষের ব্যবহারের জন্য নয়, কেবল নেটওয়ার্ক রেঞ্জ বাড়ানোর জন্য রিলে টাওয়ার হিসেবে রাখা হবে।
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={relayUrl}
                    className="flex-1 bg-[#14161B] border border-[#2D3139] text-white px-2.5 py-1.5 text-xs font-mono rounded"
                  />
                  <button
                    onClick={() => copyToClipboard(relayUrl, 'relay')}
                    className="px-3 py-1.5 bg-cyan-400 text-black font-extrabold uppercase rounded flex items-center gap-1 hover:bg-cyan-300 cursor-pointer shrink-0"
                  >
                    {copiedType === 'relay' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'relay' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
              </div>

              {/* 3. Master Control Link */}
              <div className="bg-[#0E1014] border border-amber-500/40 p-3 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-amber-400 uppercase flex items-center gap-1.5">
                    <Crown className="w-4 h-4" />
                    <span>৩. মাস্টার কন্ট্রোল অ্যাডমিন লিঙ্ক (Master Control):</span>
                  </span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                    অ্যাডমিন কেবল
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  সম্পূর্ণ নেটওয়ার্কের ম্যাপ, প্যাকেট ইন্সপেক্টর ও টপোলজি গ্রাফ পর্যবেক্ষণ করার মাস্টার কন্ট্রোল।
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={masterUrl}
                    className="flex-1 bg-[#14161B] border border-[#2D3139] text-white px-2.5 py-1.5 text-xs font-mono rounded"
                  />
                  <button
                    onClick={() => copyToClipboard(masterUrl, 'master')}
                    className="px-3 py-1.5 bg-amber-500 text-black font-extrabold uppercase rounded flex items-center gap-1 hover:bg-amber-400 cursor-pointer shrink-0"
                  >
                    {copiedType === 'master' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedType === 'master' ? 'কপি হয়েছে' : 'কপি'}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase rounded cursor-pointer"
              >
                বন্ধ করুন
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Brand Title */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-none bg-[#1A1D24] border border-[#00FF9C]/50 flex items-center justify-center shadow-[0_0_12px_rgba(0,255,156,0.15)]">
            <Radio className="w-5 h-5 text-[#00FF9C]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-white tracking-wide uppercase font-mono">{t.appTitle}</h1>
              <span className="text-[10px] px-1.5 py-0.2 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/30 font-mono tracking-wider">
                v2.4 MESH
              </span>
            </div>
            <p className="text-[11px] text-[#8A909D] font-mono">{t.appSubtitle}</p>
          </div>
        </div>

        {/* Navigation Tabs (Only rendered for Master View Mode) */}
        {viewMode === 'MASTER' && (
          <nav className="flex items-center bg-[#0E1014] p-1 border border-[#2D3139] text-xs font-mono overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('TOPOLOGY')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'TOPOLOGY'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabTopology}</span>
          </button>

          <button
            onClick={() => setActiveTab('CHAT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'CHAT'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabChat}</span>
          </button>

          <button
            onClick={() => setActiveTab('WALKIE_TALKIE')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'WALKIE_TALKIE'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabWalkieTalkie}</span>
          </button>

          <button
            onClick={() => setActiveTab('CROWD_GPS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'CROWD_GPS'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabCrowdGps}</span>
          </button>

          <button
            onClick={() => setActiveTab('REACT_NATIVE_EXPORT')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'REACT_NATIVE_EXPORT'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabReactNativeExport}</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 border transition-all ${
              activeTab === 'LOGS'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-bold shadow-[0_0_10px_rgba(0,255,156,0.25)]'
                : 'bg-transparent text-[#8A909D] border-transparent hover:text-white hover:bg-[#1A1D24]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="uppercase">{t.tabLogs}</span>
          </button>
        </nav>
        )}

        {/* Action Controls: SOS Alert & Language Toggle */}
        <div className="flex items-center space-x-2 font-mono">
          {/* Emergency SOS Button */}
          <button
            onClick={openSosModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/60 text-xs font-bold uppercase transition-all hover:scale-105 active:scale-95 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
          >
            <AlertTriangle className="w-4 h-4 text-rose-400 animate-bounce" />
            <span>SOS</span>
          </button>

          {/* Language Switcher */}
          <div className="flex items-center bg-[#0E1014] p-0.5 border border-[#2D3139] text-xs">
            <button
              onClick={() => setLang('BN')}
              className={`px-2 py-1 font-bold transition-all ${
                lang === 'BN' ? 'bg-[#00FF9C] text-black' : 'text-[#8A909D] hover:text-white'
              }`}
            >
              বাংলা
            </button>
            <button
              onClick={() => setLang('EN')}
              className={`px-2 py-1 font-bold transition-all ${
                lang === 'EN' ? 'bg-[#00FF9C] text-black' : 'text-[#8A909D] hover:text-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

