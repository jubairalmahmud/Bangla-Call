import React, { useState, useRef } from 'react';
import {
  Send,
  Lock,
  Radio,
  Mic,
  Paperclip,
  CheckCheck,
  Zap,
  Info,
  ShieldCheck,
  AlertCircle,
  FileText,
  Volume2,
} from 'lucide-react';
import { MeshNode, ChatMessage, MeshPacket, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface ChatPanelProps {
  nodes: MeshNode[];
  messages: ChatMessage[];
  lang: LanguageMode;
  selectedTargetId: string;
  onSelectTargetNode: (id: string) => void;
  onSendMessage: (content: string, type?: 'TEXT' | 'VOICE' | 'FILE') => void;
  onInspectPacket: (packet: MeshPacket) => void;
  packets: MeshPacket[];
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  nodes,
  messages,
  lang,
  selectedTargetId,
  onSelectTargetNode,
  onSendMessage,
  onInspectPacket,
  packets,
}) => {
  const t = translations[lang];
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const selectedTarget = nodes.find((n) => n.id === selectedTargetId);
  const selfNode = nodes.find((n) => n.isSelf) || nodes[0];

  const isTargetOfflineOrOutOfRange =
    selectedTarget &&
    (selectedTarget.status === 'OFFLINE' ||
      !selfNode?.connectedPeers.includes(selectedTarget.id));

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim(), 'TEXT');
    setInputText('');
  };

  const handleStartVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        onSendMessage('🎙️ [মেস ভয়েস নোট - Encrypted Voice Memo]', 'VOICE');
        setIsRecording(false);
      };

      mediaRecorder.start();
    } catch (err) {
      console.warn('Microphone permission denied or not available:', err);
      // Fallback voice memo simulation
      onSendMessage('🎙️ [অফলাইন ভয়েস রেকর্ডিং মেস প্যাকেট - 4.2 sec]', 'VOICE');
    }
  };

  const handleStopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    } else {
      setIsRecording(false);
    }
  };

  return (
    <div className="bg-[#14161B] border border-[#2D3139] flex flex-col h-[620px] shadow-2xl overflow-hidden font-mono">
      {/* Header Bar */}
      <div className="bg-[#0A0B0E] p-3.5 border-b border-[#2D3139] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/40 flex items-center justify-center">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">{t.chatTitle}</h2>
              <span className="px-2 py-0.5 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/30 text-[10px] font-bold uppercase flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#00FF9C]" />
                {t.e2eeBadge}
              </span>
            </div>
            <p className="text-xs text-[#8A909D]">{t.selectNode}</p>
          </div>
        </div>

        {/* Target Node Selector Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedTargetId}
            onChange={(e) => onSelectTargetNode(e.target.value)}
            className="bg-[#0E1014] text-[#E1E4EA] border border-[#2D3139] px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[#00FF9C]"
          >
            <option value="BROADCAST">{t.allBroadcast}</option>
            {nodes
              .filter((n) => !n.isSelf)
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name} {node.connectedPeers.includes(selfNode?.id || '') ? ' (Direct)' : ' (Relay)'}
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Store and Forward Alert Banner if Target Out of Range */}
      {isTargetOfflineOrOutOfRange && (
        <div className="bg-amber-950/70 border-b border-amber-500/40 px-4 py-2 text-xs text-amber-300 flex items-center gap-2 font-mono uppercase font-bold">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{t.storeAndForwardAlert}</span>
        </div>
      )}

      {/* Chat Messages Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-[#0A0B0E]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-[#8A909D] text-xs font-mono">
            <Radio className="w-10 h-10 text-[#2D3139] mb-2 animate-pulse" />
            <p className="uppercase">কোন মেস মেসেজ নেই। নিচে টাইপ করুন।</p>
          </div>
        ) : (
          messages.map((msg) => {
            const correspondingPacket = packets.find((p) => p.id === msg.id) || {
              id: msg.id,
              type: 'CHAT_TEXT',
              senderId: msg.senderId,
              senderName: msg.senderName,
              targetId: msg.targetId,
              encryptedPayload: msg.encryptedContent,
              iv: 'Z2NtX2l2X2V4YW1wbGUyMDI2',
              timestamp: msg.timestamp,
              ttl: 5,
              hopCount: msg.hopCount,
              routingTrace: msg.routingTrace,
              sequenceNumber: 104,
              signature: '8f9a2b1c4e7d',
            };

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] p-3 text-xs shadow-2xl relative border ${
                    msg.isSelf
                      ? 'bg-[#1A1D24] border-[#00FF9C] text-[#E1E4EA]'
                      : 'bg-[#14161B] border-[#2D3139] text-[#E1E4EA]'
                  }`}
                >
                  {/* Sender Name & Hops Badge */}
                  <div className="flex items-center justify-between gap-3 text-[10px] text-[#8A909D] mb-1 font-mono uppercase">
                    <span className="font-bold text-[#00FF9C]">{msg.senderName}</span>
                    <span className="px-1.5 py-0.2 bg-[#0A0B0E] border border-[#2D3139] text-white">
                      {msg.hopCount === 0 ? 'DIRECT HOP' : `${msg.hopCount} RELAY HOPS`}
                    </span>
                  </div>

                  {/* Content */}
                  <p className="text-xs text-[#E1E4EA] font-sans font-medium leading-relaxed my-1">
                    {msg.content}
                  </p>

                  {/* Relay Route Trace */}
                  {msg.routingTrace.length > 1 && (
                    <div className="mt-2 pt-1.5 border-t border-[#2D3139] text-[10px] text-amber-300 flex items-center gap-1 font-mono uppercase">
                      <Zap className="w-3 h-3 text-amber-400" />
                      <span>{t.relayedBy}</span>
                      <span className="truncate">{msg.routingTrace.join(' → ')}</span>
                    </div>
                  )}

                  {/* Message Footer: Timestamp, Encryption Tag & Inspector */}
                  <div className="mt-2 pt-1 border-t border-[#2D3139] flex items-center justify-between gap-2 text-[10px] text-[#8A909D] font-mono">
                    <span className="flex items-center gap-1 text-[#00FF9C]">
                      <Lock className="w-3 h-3 text-[#00FF9C]" />
                      AES-256-GCM
                    </span>

                    <button
                      onClick={() => onInspectPacket(correspondingPacket as MeshPacket)}
                      className="px-2 py-0.5 bg-[#0A0B0E] hover:bg-[#2D3139] text-[#E1E4EA] border border-[#2D3139] transition-all uppercase font-bold text-[9px]"
                    >
                      {t.inspectPacket} 🔍
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input Section */}
      <form onSubmit={handleSend} className="p-3 bg-[#14161B] border-t border-[#2D3139]">
        <div className="flex items-center gap-2">
          {/* File Attachment Simulation */}
          <button
            type="button"
            onClick={() => onSendMessage('📁 [মেস ফাইল ট্রান্সফার - schematic.pdf 1.2MB]', 'FILE')}
            className="p-2.5 text-[#8A909D] hover:text-[#00FF9C] bg-[#0E1014] hover:bg-[#1A1D24] transition-all border border-[#2D3139]"
            title="Send File over Mesh"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice Memo Button */}
          <button
            type="button"
            onClick={isRecording ? handleStopVoiceRecording : handleStartVoiceRecording}
            className={`p-2.5 transition-all border ${
              isRecording
                ? 'bg-rose-600 text-white animate-pulse border-rose-500'
                : 'text-[#8A909D] hover:text-[#00FF9C] bg-[#0E1014] hover:bg-[#1A1D24] border-[#2D3139]'
            }`}
            title="Record Voice Memo"
          >
            <Mic className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t.typePlaceholder}
            className="flex-1 bg-[#0A0B0E] text-white placeholder-[#8A909D] text-xs px-3.5 py-2.5 border border-[#2D3139] focus:outline-none focus:border-[#00FF9C] font-mono"
          />

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="px-4 py-2.5 bg-[#00FF9C] hover:bg-[#00FF9C]/90 disabled:opacity-40 text-black font-extrabold uppercase text-xs transition-all border border-[#00FF9C] shadow-[0_0_10px_rgba(0,255,156,0.2)] flex items-center gap-1.5"
          >
            <span>{t.sendBtn}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
