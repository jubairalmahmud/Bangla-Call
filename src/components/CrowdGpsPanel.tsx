import React, { useState, useEffect } from 'react';
import {
  Radio,
  MapPin,
  Compass,
  Signal,
  Wifi,
  Users,
  ShieldCheck,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Share2,
  Navigation,
  Activity,
  Layers,
  Search,
  Crosshair,
  RefreshCw,
  Globe,
  Smartphone,
  Eye,
  Lock,
} from 'lucide-react';
import { MeshNode, LanguageMode } from '../types/mesh';

export interface CrowdGpsBeacon {
  id: string;
  ownerName: string;
  beaconType: 'EMERGENCY_SOS' | 'LOST_DEVICE' | 'ASSET_TRACKER' | 'PERSON_LOCATOR';
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  rssi: number; // dBm
  lastRelayedBy: string; // Node Name of passerby node
  passerbyCount: number;
  batteryLevel: number;
  timestamp: number;
  status: 'ACTIVE' | 'RESOLVED' | 'SEARCHING';
  locationName: string;
}

interface CrowdGpsPanelProps {
  lang: LanguageMode;
  nodes: MeshNode[];
  myNodeId: string;
  onSendSosAlert?: (msg: string) => void;
}

export const CrowdGpsPanel: React.FC<CrowdGpsPanelProps> = ({
  lang,
  nodes,
  myNodeId,
}) => {
  const [isBeaconActive, setIsBeaconActive] = useState(false);
  const [isPassiveRelayEnabled, setIsPassiveRelayEnabled] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBeaconId, setSelectedBeaconId] = useState<string | null>('beacon-01');
  const [radarPulse, setRadarPulse] = useState(0);

  // Simulated Crowd GPS Beacons in the Mesh Network
  const [beacons, setBeacons] = useState<CrowdGpsBeacon[]>([
    {
      id: 'beacon-01',
      ownerName: 'রাহাত খান (অফলাইন ইউজার - ১০ কিমি দূরে)',
      beaconType: 'EMERGENCY_SOS',
      latitude: 23.8103,
      longitude: 90.4125,
      locationName: 'মিরপুর ১০ ইমার্জেন্সি রিলে জোন',
      accuracyMeters: 12,
      rssi: -68,
      lastRelayedBy: 'নোড ব্রাভো (পথচারী ২য় ফোন)',
      passerbyCount: 18,
      batteryLevel: 42,
      timestamp: Date.now() - 1000 * 45,
      status: 'ACTIVE',
    },
    {
      id: 'beacon-02',
      ownerName: 'টিম আলফা সার্চ ট্র্যাকার',
      beaconType: 'ASSET_TRACKER',
      latitude: 23.794,
      longitude: 90.4043,
      locationName: 'বনানী ক্রাউড হটস্পট',
      accuracyMeters: 5,
      rssi: -52,
      lastRelayedBy: 'নোড চার্লি (বেস স্টেশন)',
      passerbyCount: 42,
      batteryLevel: 88,
      timestamp: Date.now() - 1000 * 120,
      status: 'ACTIVE',
    },
    {
      id: 'beacon-03',
      ownerName: 'জরুরী উদ্ধার সরঞ্জাম জিপিএস',
      beaconType: 'LOST_DEVICE',
      latitude: 23.7771,
      longitude: 90.3994,
      locationName: 'মহাখালী মেস রিলে টাওয়ার',
      accuracyMeters: 25,
      rssi: -84,
      lastRelayedBy: 'নোড ডেল্টা (পথচারী ইউজার)',
      passerbyCount: 9,
      batteryLevel: 15,
      timestamp: Date.now() - 1000 * 300,
      status: 'SEARCHING',
    },
  ]);

  // Radar Animation Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarPulse((prev) => (prev + 1) % 100);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Handle Beacon Toggle for Self
  const toggleMyBeacon = () => {
    if (!isBeaconActive) {
      const myNode = nodes.find((n) => n.id === myNodeId);
      const newBeacon: CrowdGpsBeacon = {
        id: `my-beacon-${Date.now()}`,
        ownerName: `${myNode?.name || 'আমার ডিভাইস'} (আপনার লাইভ ক্রাউড বিওকন)`,
        beaconType: 'EMERGENCY_SOS',
        latitude: 23.8115,
        longitude: 90.415,
        locationName: 'আপনার বর্তমান অবস্থান (ক্রাউড রিলে দ্বারা পরিবেষ্টিত)',
        accuracyMeters: 8,
        rssi: -45,
        lastRelayedBy: 'আপনার নিজস্ব ডিভাইস',
        passerbyCount: nodes.length,
        batteryLevel: myNode?.batteryLevel || 95,
        timestamp: Date.now(),
        status: 'ACTIVE',
      };
      setBeacons([newBeacon, ...beacons]);
      setSelectedBeaconId(newBeacon.id);
      setIsBeaconActive(true);
    } else {
      setBeacons(beacons.filter((b) => !b.id.startsWith('my-beacon-')));
      setIsBeaconActive(false);
    }
  };

  const selectedBeacon = beacons.find((b) => b.id === selectedBeaconId) || beacons[0];

  return (
    <div className="bg-[#14161B] border border-[#2D3139] p-5 shadow-2xl flex flex-col gap-5 font-mono text-[#E1E4EA] text-left">
      {/* Crowd GPS Title Header */}
      <div className="bg-[#0A0B0E] border border-[#00FF9C]/40 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start space-x-3">
          <div className="w-10 h-10 bg-[#00FF9C]/20 border border-[#00FF9C] text-[#00FF9C] flex items-center justify-center shrink-0">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-white uppercase tracking-wider">
                📡 ক্রাউড জিপিএস নেটওয়ার্ক (Crowd GPS Mesh Tracking)
              </h2>
              <span className="text-[10px] px-2 py-0.5 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/30 font-bold uppercase">
                অফলাইন জিপিএস ট্র্যাকিং
              </span>
            </div>
            <p className="text-xs text-[#8A909D] mt-1 leading-relaxed">
              ইন্টারনেট বা সিম নেটওয়ার্ক না থাকলেও আশেপাশের পথচারীদের ডিভাইস (Crowd Relays) এর মাধ্যমে অফলাইন জিপিএস সিগন্যাল রিলে করে স্থান ও ট্র্যাকিং করা সম্ভব।
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={toggleMyBeacon}
            className={`px-4 py-2 border font-extrabold text-xs uppercase transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              isBeaconActive
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-rose-600/30'
                : 'bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black border-[#00FF9C] shadow-[#00FF9C]/20'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>{isBeaconActive ? '🔴 ক্রাউড বিওকন বন্ধ করুন' : '📡 আমার ক্রাউড জিপিএস বিওকন অন করুন'}</span>
          </button>

          <button
            onClick={() => setIsPassiveRelayEnabled(!isPassiveRelayEnabled)}
            className={`px-3.5 py-2 border font-bold text-xs uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
              isPassiveRelayEnabled
                ? 'bg-[#14161B] text-[#00FF9C] border-[#00FF9C]/50'
                : 'bg-[#0E1014] text-[#8A909D] border-[#2D3139]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#00FF9C]" />
            <span>{isPassiveRelayEnabled ? '🟢 ক্রাউড প্যাসিভ রিলে: অন' : '⚪ প্যাসিভ রিলে: অফ'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Live Crowd Radar & Map Canvas (7 Cols) */}
        <div className="lg:col-span-7 bg-[#0E1014] border border-[#2D3139] p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#2D3139] pb-2 text-xs">
            <div className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#00FF9C]" />
              <span className="font-bold text-white uppercase">লাইভ ক্রাউড জিপিএস রাডার ও স্থান ট্র্যাকার</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#8A909D]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00FF9C] inline-block animate-ping" />
                সক্রিয় রিলে নোড: <strong className="text-white">{nodes.length}</strong>
              </span>
            </div>
          </div>

          {/* Interactive Radar Screen */}
          <div className="relative w-full h-80 bg-[#07080A] border border-[#00FF9C]/30 overflow-hidden flex items-center justify-center">
            {/* Concentric Circles */}
            <div className="absolute w-72 h-72 rounded-full border border-[#00FF9C]/10" />
            <div className="absolute w-52 h-52 rounded-full border border-[#00FF9C]/20" />
            <div className="absolute w-32 h-32 rounded-full border border-[#00FF9C]/30" />
            <div className="absolute w-12 h-12 rounded-full border border-[#00FF9C]/50 bg-[#00FF9C]/5" />

            {/* Radar Crosshair Lines */}
            <div className="absolute w-full h-[1px] bg-[#00FF9C]/20" />
            <div className="absolute h-full w-[1px] bg-[#00FF9C]/20" />

            {/* Sweeping Radar Scanner */}
            <div
              className="absolute w-full h-full rounded-full border-t border-l border-[#00FF9C]/60 bg-gradient-to-tr from-transparent via-[#00FF9C]/5 to-[#00FF9C]/20"
              style={{
                transform: `rotate(${radarPulse * 3.6}deg)`,
                transformOrigin: 'center center',
              }}
            />

            {/* Center Self Node Icon */}
            <div className="absolute z-20 flex flex-col items-center">
              <div className="w-5 h-5 rounded-full bg-[#00FF9C] border-2 border-black flex items-center justify-center shadow-[0_0_12px_#00FF9C]">
                <Smartphone className="w-3 h-3 text-black" />
              </div>
              <span className="text-[9px] bg-black/80 px-1 text-[#00FF9C] font-bold mt-1 border border-[#00FF9C]/30">
                আপনি (Base Relay)
              </span>
            </div>

            {/* Render Simulated Crowd GPS Beacons on Canvas */}
            {beacons.map((beacon, idx) => {
              // Calculate radar positioning based on lat/lng or fixed offsets
              const offsets = [
                { top: '25%', left: '70%' },
                { top: '65%', left: '30%' },
                { top: '75%', left: '75%' },
                { top: '30%', left: '25%' },
              ];
              const pos = offsets[idx % offsets.length];
              const isSelected = beacon.id === selectedBeaconId;

              return (
                <div
                  key={beacon.id}
                  onClick={() => setSelectedBeaconId(beacon.id)}
                  style={{ top: pos.top, left: pos.left }}
                  className={`absolute z-30 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all ${
                    isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                  }`}
                >
                  <div className="relative flex flex-col items-center">
                    {/* Ping Effect for Emergency SOS */}
                    {beacon.beaconType === 'EMERGENCY_SOS' && (
                      <span className="absolute w-8 h-8 rounded-full bg-rose-500/40 animate-ping" />
                    )}

                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shadow-lg ${
                        beacon.beaconType === 'EMERGENCY_SOS'
                          ? 'bg-rose-600 border-rose-300 text-white'
                          : 'bg-amber-500 border-amber-200 text-black'
                      }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </div>

                    <div className="bg-[#0A0B0E]/95 border border-[#00FF9C]/40 px-1.5 py-0.5 text-[9px] font-bold text-white mt-1 whitespace-nowrap shadow-md">
                      {beacon.ownerName.split(' ')[0]} ({beacon.rssi} dBm)
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Radar Corner Overlay Info */}
            <div className="absolute top-2 left-2 bg-[#0A0B0E]/90 border border-[#2D3139] px-2 py-1 text-[10px] text-[#00FF9C]">
              🛰️ CROWD BEACON RADAR | RSSI SENSITIVITY: -110 dBm
            </div>
          </div>

          {/* Beacon List & Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase">শনাক্তকৃত বিওকন সমূহ ({beacons.length}):</span>
              <span className="text-[10px] text-[#00FF9C] uppercase">
                সবগুলো ই-টু-ই এনক্রিপ্টেড (E2EE)
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {beacons.map((beacon) => {
                const isSelected = beacon.id === selectedBeaconId;
                return (
                  <div
                    key={beacon.id}
                    onClick={() => setSelectedBeaconId(beacon.id)}
                    className={`p-3 border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                      isSelected
                        ? 'bg-[#00FF9C]/15 border-[#00FF9C] text-white shadow-md'
                        : 'bg-[#14161B] hover:bg-[#1A1D24] border-[#2D3139] text-[#8A909D]'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`w-3 h-3 rounded-full shrink-0 ${
                          beacon.beaconType === 'EMERGENCY_SOS'
                            ? 'bg-rose-500 animate-ping'
                            : 'bg-amber-400'
                        }`}
                      />
                      <div>
                        <span className="font-extrabold text-white block">{beacon.ownerName}</span>
                        <span className="text-[10px] text-[#8A909D] block">
                          📍 {beacon.locationName} • পথচারী নোড: {beacon.passerbyCount} টি
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] font-bold text-[#00FF9C] block font-mono">
                        {beacon.rssi} dBm
                      </span>
                      <span className="text-[9px] text-[#8A909D] block uppercase">
                        সঠিকতা: ±{beacon.accuracyMeters} মিটার
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Beacon Details & Crowd GPS Technology Guide (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Selected Beacon Details Card */}
          {selectedBeacon && (
            <div className="bg-[#0E1014] border border-[#00FF9C]/50 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-[#2D3139] pb-2 text-xs">
                <span className="font-extrabold text-[#00FF9C] uppercase flex items-center gap-1.5">
                  <Navigation className="w-4 h-4" />
                  বিওকন বিস্তারিত ট্র্যাকিং ডাটা
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/30 uppercase font-bold">
                  {selectedBeacon.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[10px] text-[#8A909D] uppercase block">ডিভাইস/বিওকন নাম:</span>
                  <strong className="text-white text-sm font-bold block">{selectedBeacon.ownerName}</strong>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-[#14161B] p-2.5 border border-[#2D3139] text-[11px]">
                  <div>
                    <span className="text-[9px] text-[#8A909D] uppercase block">জিপিএস স্থানাঙ্ক:</span>
                    <span className="text-[#00FF9C] font-mono font-bold">
                      {selectedBeacon.latitude}, {selectedBeacon.longitude}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8A909D] uppercase block">সংকেত তীব্রতা (RSSI):</span>
                    <span className="text-[#00FF9C] font-mono font-bold">{selectedBeacon.rssi} dBm</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8A909D] uppercase block">সর্বশেষ রিলেড বাই:</span>
                    <span className="text-white font-bold">{selectedBeacon.lastRelayedBy}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#8A909D] uppercase block">পথচারী ক্রাউড নোড:</span>
                    <span className="text-amber-400 font-bold">{selectedBeacon.passerbyCount} জন</span>
                  </div>
                </div>

                <div className="bg-[#0A0B0E] p-2.5 border border-[#00FF9C]/30 text-[11px] text-[#8A909D] space-y-1">
                  <span className="text-white font-bold block flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-[#00FF9C]" />
                    ক্রাউড জিপিএস সুরক্ষা (Zero-Knowledge Privacy):
                  </span>
                  <p className="text-[10px]">
                    যেসব পথচারীদের মোবাইল বা রিলে নোড এই সিগন্যালটি রিসিভ করেছে, তারা কেউ আপনার অবস্থান বা পরিচয় পড়তে পারেনি। এনক্রিপ্টেড প্যাকেটটি কেবল আপনার ও টার্গেট রিসিভারের কাছে ডিক্রিপ্ট হয়েছে।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Crowd GPS Architecture Deep Dive Guide */}
          <div className="bg-[#0E1014] border border-[#2D3139] p-4 space-y-3 text-xs">
            <h3 className="font-extrabold text-[#00FF9C] uppercase text-sm border-b border-[#2D3139] pb-2 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>ক্রাউড জিপিএস (Crowd GPS Network) কীভাবে কাজ করে?</span>
            </h3>

            <div className="space-y-2.5 text-[#8A909D] text-[11px] leading-relaxed">
              <div className="bg-[#14161B] p-2.5 border-l-2 border-[#00FF9C]">
                <strong className="text-white block uppercase mb-0.5">১. অ্যাপল/স্যামসাং স্টাইল প্যাসিভ ক্রাউড লিসেনিং:</strong>
                আপনার ফোন বা জরুরি জিপিএস ট্যাগ ইন্টারনেটের বাইরে থাকলেও প্রতি কয়েক সেকেন্ডে খুব কম শক্তিতে BLE Beacon ফ্রেম পাঠাতে থাকে।
              </div>

              <div className="bg-[#14161B] p-2.5 border-l-2 border-[#00FF9C]">
                <strong className="text-white block uppercase mb-0.5">২. হাজার হাজার পথচারীর অফলাইন সাহায্য:</strong>
                রাস্তায় বা আসেপাশে থাকা যেকোনো MeshTalk অ্যাপ ইউজার পাশ দিয়ে হেঁটে যাওয়ার সময় সেই বিওকন সংকেতটি নিজে থেকে গ্রহণ করে এবং মেস নেটওয়ার্কের রিলেতে যুক্ত করে দেয়।
              </div>

              <div className="bg-[#14161B] p-2.5 border-l-2 border-[#00FF9C]">
                <strong className="text-white block uppercase mb-0.5">৩. ১০০+ কিমি কভারেজ:</strong>
                এর ফলে কোনো একটি ডিভাইস ৫০ বা ১০০ কিমি দূরে কোনো নির্জন স্থানে থাকলেও আশেপাশের পথচারী বা রিলে নোডের মাধ্যমে তার জিপিএস লোকেশন বেস স্টেশনে বা জরুরি উদ্ধারকারীর কাছে চলে আসে।
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
