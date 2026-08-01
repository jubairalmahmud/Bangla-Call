import React from 'react';
import { X, Lock, ShieldCheck, Zap, Layers, Cpu, Copy, Check } from 'lucide-react';
import { MeshPacket, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface PacketInspectorModalProps {
  packet: MeshPacket | null;
  onClose: () => void;
  lang: LanguageMode;
}

export const PacketInspectorModal: React.FC<PacketInspectorModalProps> = ({
  packet,
  onClose,
  lang,
}) => {
  const t = translations[lang];
  const [copied, setCopied] = React.useState(false);

  if (!packet) return null;

  const rawJson = JSON.stringify(packet, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
      <div className="bg-[#14161B] border border-[#2D3139] w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#0A0B0E] p-3.5 border-b border-[#2D3139] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/40 flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.wireInspectorTitle}</h3>
              <p className="text-[11px] text-[#8A909D]">PACKET ID: {packet.id}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#8A909D] hover:text-white bg-[#0E1014] hover:bg-[#2D3139] border border-[#2D3139] transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Key Cryptographic Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#0A0B0E] p-3 border border-[#2D3139]">
              <span className="text-[10px] text-[#8A909D] uppercase">{t.ivIv}</span>
              <p className="font-mono text-[#00FF9C] font-bold mt-1 break-all">
                {packet.iv || 'Z2NtX2l2X2V4YW1wbGUyMDI2'}
              </p>
            </div>

            <div className="bg-[#0A0B0E] p-3 border border-[#2D3139]">
              <span className="text-[10px] text-[#8A909D] uppercase">{t.signatureHash}</span>
              <p className="font-mono text-sky-400 font-bold mt-1 break-all">
                {packet.signature || '8f9a2b1c4e7d'}
              </p>
            </div>

            <div className="bg-[#0A0B0E] p-3 border border-[#2D3139]">
              <span className="text-[10px] text-[#8A909D] uppercase">{t.ttlHops}</span>
              <p className="font-mono text-amber-400 font-bold mt-1">
                TTL: {packet.ttl} | Hop Count: {packet.hopCount}
              </p>
            </div>

            <div className="bg-[#0A0B0E] p-3 border border-[#2D3139]">
              <span className="text-[10px] text-[#8A909D] uppercase">প্রোটোকল ভার্সন:</span>
              <p className="font-mono text-[#00FF9C] font-bold mt-1">
                BLE_MESH_V2_AES256
              </p>
            </div>
          </div>

          {/* Hop Trace List */}
          <div className="bg-[#0A0B0E] p-3.5 border border-[#2D3139]">
            <span className="text-[10px] text-[#8A909D] block mb-1.5 uppercase">{t.packetTrace}</span>
            <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
              {packet.routingTrace.map((nodeId, idx) => (
                <React.Fragment key={idx}>
                  <span className="px-2 py-1 bg-[#14161B] border border-[#2D3139] text-[#00FF9C]">
                    {nodeId}
                  </span>
                  {idx < packet.routingTrace.length - 1 && (
                    <span className="text-[#8A909D]">→</span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Raw JSON Block */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-[#8A909D] mb-1.5 uppercase font-bold">
              <span>{t.rawCiphertext}</span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[#00FF9C] hover:underline font-mono"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Raw Wire Data'}</span>
              </button>
            </div>
            <pre className="bg-[#0A0B0E] p-4 border border-[#2D3139] font-mono text-[11px] text-[#00FF9C] overflow-x-auto max-h-52">
              {rawJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
