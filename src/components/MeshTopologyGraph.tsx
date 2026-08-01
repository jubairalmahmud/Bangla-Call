import React, { useState } from 'react';
import {
  Radio,
  Wifi,
  Smartphone,
  Server,
  AlertTriangle,
  Plus,
  RotateCcw,
  Battery,
  Layers,
  ArrowRight,
  Zap,
  Info,
  Sliders,
} from 'lucide-react';
import { MeshNode, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface MeshTopologyGraphProps {
  nodes: MeshNode[];
  lang: LanguageMode;
  onUpdateNodePosition: (id: string, x: number, y: number, status?: any) => void;
  onAddRelayNode: () => void;
  onResetTopology: () => void;
  selectedSourceId: string;
  selectedTargetId: string;
  onSelectNode: (id: string) => void;
}

export const MeshTopologyGraph: React.FC<MeshTopologyGraphProps> = ({
  nodes,
  lang,
  onUpdateNodePosition,
  onAddRelayNode,
  onResetTopology,
  selectedSourceId,
  selectedTargetId,
  onSelectNode,
}) => {
  const t = translations[lang];
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [showSignalRanges, setShowSignalRanges] = useState(true);

  // Calculate links based on connectedPeers
  const links: { from: MeshNode; to: MeshNode; isMultiHopRoute: boolean }[] = [];
  const linkSet = new Set<string>();

  nodes.forEach((node) => {
    if (node.status === 'OFFLINE') return;
    node.connectedPeers.forEach((peerId) => {
      const peer = nodes.find((n) => n.id === peerId);
      if (peer && peer.status !== 'OFFLINE') {
        const key = [node.id, peer.id].sort().join('--');
        if (!linkSet.has(key)) {
          linkSet.add(key);
          links.push({
            from: node,
            to: peer,
            isMultiHopRoute:
              (node.id === selectedSourceId && peer.id === selectedTargetId) ||
              (node.id === selectedTargetId && peer.id === selectedSourceId),
          });
        }
      }
    });
  });

  const handleMouseDown = (nodeId: string) => {
    setDraggingNodeId(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggingNodeId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));
    onUpdateNodePosition(draggingNodeId, x, y);
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const selectedSource = nodes.find((n) => n.id === selectedSourceId);
  const selectedTarget = nodes.find((n) => n.id === selectedTargetId);

  return (
    <div className="bg-[#14161B] border border-[#2D3139] p-4 md:p-5 shadow-2xl font-mono">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-[#00FF9C]" />
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{t.meshTopologyTitle}</h2>
          </div>
          <p className="text-xs text-[#8A909D] mt-1 max-w-2xl">{t.topologyDesc}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setShowSignalRanges(!showSignalRanges)}
            className={`px-3 py-1.5 border transition-all flex items-center gap-1.5 font-bold uppercase ${
              showSignalRanges
                ? 'bg-[#00FF9C]/10 text-[#00FF9C] border-[#00FF9C]/40'
                : 'bg-[#0E1014] text-[#8A909D] border-[#2D3139]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showSignalRanges ? 'SIGNAL RANGES: ON' : 'SIGNAL RANGES: OFF'}</span>
          </button>

          <button
            onClick={onAddRelayNode}
            className="px-3 py-1.5 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black border border-[#00FF9C] font-extrabold uppercase transition-all shadow-[0_0_10px_rgba(0,255,156,0.2)] flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addRelayNode}</span>
          </button>

          <button
            onClick={onResetTopology}
            className="px-3 py-1.5 bg-[#0E1014] hover:bg-[#1A1D24] text-[#E1E4EA] font-semibold border border-[#2D3139] uppercase transition-all flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetNetwork}</span>
          </button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div
        className="relative w-full h-[450px] md:h-[520px] bg-[#0A0B0E] border border-[#2D3139] overflow-hidden cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Tactical Grid Background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#2D313925_1px,transparent_1px),linear-gradient(to_bottom,#2D313925_1px,transparent_1px)] bg-[size:20px_20px]" />

        {/* Links SVG Layer */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <linearGradient id="linkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FF9C" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="2" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Connected Mesh Links */}
          {links.map((link, idx) => (
            <g key={idx}>
              <line
                x1={`${link.from.x}%`}
                y1={`${link.from.y}%`}
                x2={`${link.to.x}%`}
                y2={`${link.to.y}%`}
                stroke="url(#linkGrad)"
                strokeWidth={link.isMultiHopRoute ? '3.5' : '1.8'}
                strokeDasharray={link.isMultiHopRoute ? '6,6' : '3,3'}
                className={link.isMultiHopRoute ? 'animate-pulse' : ''}
                filter="url(#glow)"
              />
            </g>
          ))}
        </svg>

        {/* Nodes Layer */}
        {nodes.map((node) => {
          const isSelectedSource = node.id === selectedSourceId;
          const isSelectedTarget = node.id === selectedTargetId;
          const isOffline = node.status === 'OFFLINE';

          return (
            <div key={node.id}>
              {/* Signal Range Circle */}
              {showSignalRanges && !isOffline && (
                <div
                  className="absolute rounded-full border border-[#00FF9C]/20 bg-[#00FF9C]/5 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    width: `${node.signalRange * 3.2}%`,
                    height: `${node.signalRange * 3.2}%`,
                  }}
                />
              )}

              {/* Node Card */}
              <div
                onMouseDown={() => handleMouseDown(node.id)}
                onClick={() => onSelectNode(node.id)}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-200 cursor-grab active:cursor-grabbing group ${
                  draggingNodeId === node.id ? 'scale-110 z-30' : 'z-20 hover:scale-105'
                }`}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <div
                  className={`p-2.5 border flex flex-col items-center shadow-2xl font-mono ${
                    isOffline
                      ? 'bg-[#14161B]/90 border-[#2D3139] text-[#8A909D] opacity-60'
                      : node.type === 'EMERGENCY_BEACON'
                      ? 'bg-rose-950/90 border-rose-500 text-rose-200 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : isSelectedSource
                      ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C] shadow-[0_0_15px_rgba(0,255,156,0.3)]'
                      : isSelectedTarget
                      ? 'bg-emerald-950/90 border-[#00FF9C] text-emerald-200 shadow-[0_0_15px_rgba(0,255,156,0.2)]'
                      : node.type === 'RELAY_TOWER'
                      ? 'bg-[#14161B]/90 border-amber-500/60 text-amber-300'
                      : 'bg-[#14161B]/90 border-[#2D3139] text-[#E1E4EA]'
                  }`}
                >
                  {/* Icon Badge */}
                  <div className="relative mb-1">
                    <div
                      className={`w-8 h-8 flex items-center justify-center border ${
                        node.type === 'EMERGENCY_BEACON'
                          ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-pulse'
                          : node.type === 'RELAY_TOWER'
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/50'
                          : 'bg-[#00FF9C]/10 text-[#00FF9C] border-[#00FF9C]/40'
                      }`}
                    >
                      {node.type === 'MOBILE_USER' && <Smartphone className="w-4 h-4" />}
                      {node.type === 'RELAY_TOWER' && <Server className="w-4 h-4" />}
                      {node.type === 'EMERGENCY_BEACON' && <AlertTriangle className="w-4 h-4" />}
                      {node.type === 'BASE_STATION' && <Radio className="w-4 h-4" />}
                    </div>

                    {/* Status Dot */}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-black ${
                        isOffline
                          ? 'bg-[#8A909D]'
                          : node.status === 'EMERGENCY_BEACON'
                          ? 'bg-rose-500 animate-ping'
                          : 'bg-[#00FF9C]'
                      }`}
                    />
                  </div>

                  {/* Name Label */}
                  <span className="text-[11px] font-bold tracking-tight whitespace-nowrap uppercase">{node.name}</span>

                  {/* RSSI & Battery subtext */}
                  <div className="flex items-center gap-1.5 mt-1 text-[9px] text-[#8A909D] font-mono">
                    <span className="flex items-center gap-0.5">
                      <Wifi className="w-2.5 h-2.5 text-[#00FF9C]" />
                      {node.rssi}dBm
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Battery className="w-2.5 h-2.5 text-[#00FF9C]" />
                      {node.batteryLevel}%
                    </span>
                  </div>

                  {/* Power Toggle Button on hover */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateNodePosition(
                        node.id,
                        node.x,
                        node.y,
                        node.status === 'OFFLINE' ? 'ONLINE' : 'OFFLINE'
                      );
                    }}
                    title={t.triggerFailure}
                    className="mt-1.5 px-1.5 py-0.5 bg-[#0E1014] hover:bg-[#2D3139] text-[9px] text-white border border-[#2D3139] transition-all opacity-0 group-hover:opacity-100 font-mono uppercase font-bold"
                  >
                    {isOffline ? 'Power ON' : 'Power OFF'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Route & Multi-Hop Legend Bar */}
      <div className="mt-4 pt-3 border-t border-[#2D3139] flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-[#8A909D] font-mono">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#00FF9C]" />
            <span>{t.directRange} (RSSI &gt; -65dBm)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500" />
            <span>{t.relayNode}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-rose-500" />
            <span>{t.multiHopRoute}</span>
          </div>
        </div>

        {/* Selected Route Info */}
        {selectedSource && selectedTarget && (
          <div className="flex items-center gap-2 px-2.5 py-1 bg-[#0A0B0E] border border-[#2D3139] text-[#00FF9C] font-mono uppercase font-bold">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {selectedSource.name.split(' ')[0]} <ArrowRight className="w-3 h-3 inline text-[#8A909D]" />{' '}
              {selectedTarget.name.split(' ')[0]}
            </span>
            <span className="text-[#2D3139]">|</span>
            <span className="text-[#00FF9C]">2 RELAY HOPS</span>
          </div>
        )}
      </div>
    </div>
  );
};
