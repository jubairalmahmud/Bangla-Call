import React, { useState, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';
import { Navbar, ViewMode } from './components/Navbar';
import { MeshTopologyGraph } from './components/MeshTopologyGraph';
import { ChatPanel } from './components/ChatPanel';
import { WalkieTalkiePanel } from './components/WalkieTalkiePanel';
import { CrowdGpsPanel } from './components/CrowdGpsPanel';
import { SimpleUserView } from './components/SimpleUserView';
import { RelayDashboard } from './components/RelayDashboard';
import { ReactNativeExportPanel } from './components/ReactNativeExportPanel';
import { PacketLogsPanel } from './components/PacketLogsPanel';
import { PacketInspectorModal } from './components/PacketInspectorModal';
import { EmergencyBeaconModal } from './components/EmergencyBeaconModal';
import {
  MeshNode,
  MeshPacket,
  ChatMessage,
  EmergencyAlert,
  LanguageMode,
  ActiveTab,
} from './types/mesh';
import { encryptMeshPayload, decryptMeshPayload, generatePacketSignature } from './lib/crypto';
import { translations } from './lib/translations';

export default function App() {
  const [lang, setLang] = useState<LanguageMode>('BN');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    if (mode === 'user') return 'SIMPLE_USER';
    if (mode === 'relay') return 'RELAY_NODE';
    return 'MASTER';
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>('TOPOLOGY');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('node-alpha-self');
  const selectedSourceIdRef = useRef<string>('node-alpha-self');
  useEffect(() => {
    selectedSourceIdRef.current = selectedSourceId;
  }, [selectedSourceId]);

  const [selectedTargetId, setSelectedTargetId] = useState<string>('BROADCAST');
  const [onlineCount, setOnlineCount] = useState<number>(1);

  const [nodes, setNodes] = useState<MeshNode[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [packets, setPackets] = useState<MeshPacket[]>([]);
  const [inspectedPacket, setInspectedPacket] = useState<MeshPacket | null>(null);
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [incomingVoiceChunk, setIncomingVoiceChunk] = useState<{
    audioData?: string;
    mimeType?: string;
    pcmData?: number[];
    base64Pcm?: string;
    sampleRate?: number;
    senderName: string;
    senderId?: string;
    timestamp: number;
  } | null>(null);

  // Global Realtime Voice Audio Engine
  const globalPlaybackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);
  const speakerTimeoutRef = useRef<any>(null);
  const [globalReceivingSpeaker, setGlobalReceivingSpeaker] = useState<string | null>(null);
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(
    () => localStorage.getItem('mesh_speaker_unlocked') === 'true'
  );

  const unlockAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!globalPlaybackCtxRef.current || globalPlaybackCtxRef.current.state === 'closed') {
        globalPlaybackCtxRef.current = new AudioCtx();
      }
      const ctx = globalPlaybackCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);

      setIsAudioUnlocked(true);
      localStorage.setItem('mesh_speaker_unlocked', 'true');
    } catch (e) {
      console.error('Audio unlock error:', e);
    }
  };

  // Global auto-unlock on user gesture
  useEffect(() => {
    const handleFirstGesture = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture);
    window.addEventListener('touchstart', handleFirstGesture);
    window.addEventListener('click', handleFirstGesture);
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('touchstart', handleFirstGesture);
      window.removeEventListener('click', handleFirstGesture);
    };
  }, []);

  const wsRef = useRef<WebSocket | null>(null);

  const processNodes = (rawNodes: MeshNode[], currentSourceId: string): MeshNode[] => {
    return rawNodes.map((n) => ({
      ...n,
      isSelf: n.id === currentSourceId,
    }));
  };

  const [authError, setAuthError] = useState<string>('');

  // Initialize WebSocket connection to backend
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[MeshTalk WS] Connected to Off-Grid Mesh Signal Hub');
      setIsConnected(true);
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'AUTH_FAILED') {
          setAuthError(data.error || '⚠️ অথেনটিকেশন ব্যর্থ হয়েছে। পিন ভুল বা নাম্বার নিবন্ধিত।');
          localStorage.removeItem('mesh_user_code');
          localStorage.removeItem('mesh_user_pin');
        } else if (data.type === 'AUTH_SUCCESS') {
          setAuthError('');
        } else if (data.type === 'INIT_STATE') {
          const savedCode = localStorage.getItem('mesh_user_code');
          const savedName = localStorage.getItem('mesh_user_name');
          const savedPin = localStorage.getItem('mesh_user_pin') || '1234';
          const urlParams = new URLSearchParams(window.location.search);
          const roleParam = urlParams.get('role');
          const savedRole = sessionStorage.getItem('my_mesh_node_id');
          const myRole = roleParam || savedCode || savedRole || data.assignedNodeId || '';

          setSelectedSourceId(myRole);
          selectedSourceIdRef.current = myRole;
          sessionStorage.setItem('my_mesh_node_id', myRole);

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                type: 'REGISTER_USER',
                nodeId: myRole,
                code: myRole,
                name: savedName || myRole,
                pin: savedPin,
              })
            );
          }

          setNodes(processNodes(data.nodes || [], myRole));
          if (data.packets) setPackets(data.packets);
          if (data.onlineCount) setOnlineCount(data.onlineCount);
          setSelectedTargetId('BROADCAST');
        } else if (data.type === 'TOPOLOGY_UPDATED') {
          const currentMyRole = selectedSourceIdRef.current;
          setNodes((prev) => processNodes(data.nodes, currentMyRole));
          if (data.onlineCount) setOnlineCount(data.onlineCount);
        } else if (data.type === 'PACKET_RELAYED') {
          const packet: MeshPacket = data.packet;
          setPackets((prev) => [packet, ...prev]);

          // Decrypt payload for chat UI
          const decryptedText = await decryptMeshPayload(packet.encryptedPayload, packet.iv);

          const currentMyRole = selectedSourceIdRef.current;

          const newChatMsg: ChatMessage = {
            id: packet.id,
            senderId: packet.senderId,
            senderName: packet.senderName,
            targetId: packet.targetId,
            content: decryptedText,
            encryptedContent: packet.encryptedPayload,
            timestamp: packet.timestamp,
            isDelivered: true,
            hopCount: packet.hopCount,
            routingTrace: packet.routingTrace,
            type: packet.type === 'VOICE_MEMO' ? 'VOICE' : 'TEXT',
            isEncrypted: true,
            isSelf: packet.senderId === currentMyRole,
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === packet.id)) return prev;
            return [...prev, newChatMsg];
          });
        } else if (data.type === 'EMERGENCY_ALERT_RECEIVED') {
          const alert: EmergencyAlert = data.alert;
          const currentMyRole = selectedSourceIdRef.current;
          const sosMsg: ChatMessage = {
            id: alert.id,
            senderId: alert.senderId,
            senderName: alert.senderName,
            targetId: 'BROADCAST',
            content: `🚨 [জরুরী SOS ফ্ল্যাশ অ্যালার্ট]: ${alert.message} (${alert.locationName})`,
            encryptedContent: '0xSOS_HIGH_PRIORITY_FLOOD_UNENCRYPTED_EMERGENCY',
            timestamp: alert.timestamp,
            isDelivered: true,
            hopCount: 1,
            routingTrace: alert.hopTrace,
            type: 'SOS',
            isEncrypted: false,
            isSelf: alert.senderId === currentMyRole,
          };
          setMessages((prev) => [...prev, sosMsg]);
        } else if (data.type === 'VOICE_CHUNK_RECEIVED') {
          if (data.chunk) {
            const chunk = data.chunk;
            setIncomingVoiceChunk({
              audioData: chunk.audioData,
              mimeType: chunk.mimeType,
              pcmData: chunk.pcmData,
              base64Pcm: chunk.base64Pcm,
              sampleRate: chunk.sampleRate,
              senderName: chunk.senderName || 'Peer Node',
              senderId: chunk.senderId,
              timestamp: Date.now(),
            });

            // Set active banner
            setGlobalReceivingSpeaker(chunk.senderName || 'অফলাইন নোড');
            if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
            speakerTimeoutRef.current = setTimeout(() => {
              setGlobalReceivingSpeaker(null);
            }, 2500);

            // 1. Play HTML5 Audio element if compressed audio chunk is present (most reliable on mobile)
            if (chunk.audioData) {
              try {
                const audio = new Audio(chunk.audioData);
                audio.volume = 1.0;
                audio.play().catch((err) => console.log('Audio Autoplay policy:', err));
              } catch (e) {
                console.error('Audio element playback error:', e);
              }
            }

            // 2. Decode & Play PCM audio live if present
            let floatData: Float32Array | null = null;
            if (chunk.base64Pcm) {
              try {
                const binary = atob(chunk.base64Pcm);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                  bytes[i] = binary.charCodeAt(i);
                }
                const int16 = new Int16Array(bytes.buffer);
                floatData = new Float32Array(int16.length);
                for (let i = 0; i < int16.length; i++) {
                  floatData[i] = int16[i] < 0 ? int16[i] / 32768 : int16[i] / 32767;
                }
              } catch (e) {
                console.error('Base64 decode error:', e);
              }
            } else if (chunk.pcmData && chunk.pcmData.length > 0) {
              floatData = new Float32Array(chunk.pcmData);
            }

            if (floatData && floatData.length > 0) {
              try {
                const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
                if (!globalPlaybackCtxRef.current || globalPlaybackCtxRef.current.state === 'closed') {
                  globalPlaybackCtxRef.current = new AudioCtx();
                }
                const ctx = globalPlaybackCtxRef.current;
                if (ctx.state === 'suspended') {
                  ctx.resume().catch(() => {});
                }

                const sampleRate = chunk.sampleRate || ctx.sampleRate || 44100;
                const buffer = ctx.createBuffer(1, floatData.length, sampleRate);
                buffer.getChannelData(0).set(floatData);

                const source = ctx.createBufferSource();
                source.buffer = buffer;
                source.connect(ctx.destination);

                const now = ctx.currentTime;
                const startTime = Math.max(now, nextPlayTimeRef.current);
                source.start(startTime);
                nextPlayTimeRef.current = startTime + buffer.duration;
              } catch (err) {
                console.error('Global PCM Audio Playback Error:', err);
              }
            }
          }
        }
      } catch (err) {
        console.error('WS parse error:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, []);

  // Send mesh packet through WebSocket
  const handleSendMessage = async (content: string, type: 'TEXT' | 'VOICE' | 'FILE' = 'TEXT') => {
    const currentSourceId = selectedSourceIdRef.current;
    const myNodeObj = nodes.find((n) => n.id === currentSourceId);
    const senderName = myNodeObj ? myNodeObj.name : (currentSourceId === 'node-alpha-self' ? 'আলফা মোবাইল (Self)' : currentSourceId);

    const { ciphertext, iv } = await encryptMeshPayload(content);
    const signature = await generatePacketSignature(ciphertext, currentSourceId);

    const packetId = `pkt-${Date.now().toString().slice(-6)}`;
    const newPacket: MeshPacket = {
      id: packetId,
      type: type === 'VOICE' ? 'VOICE_MEMO' : 'CHAT_TEXT',
      senderId: currentSourceId,
      senderName: senderName,
      targetId: selectedTargetId,
      encryptedPayload: ciphertext,
      iv,
      timestamp: Date.now(),
      ttl: 5,
      hopCount: selectedTargetId === 'node-bravo' ? 0 : 2,
      routingTrace:
        selectedTargetId === 'node-bravo'
          ? [currentSourceId, 'node-bravo']
          : [currentSourceId, 'node-relay-01', 'node-relay-02', selectedTargetId],
      sequenceNumber: Math.floor(Math.random() * 900) + 100,
      signature,
    };

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SEND_MESH_PACKET',
          packet: newPacket,
        })
      );
    } else {
      // Fallback local update
      setPackets((prev) => [newPacket, ...prev]);
      const newMsg: ChatMessage = {
        id: newPacket.id,
        senderId: currentSourceId,
        senderName: senderName,
        targetId: selectedTargetId,
        content,
        encryptedContent: ciphertext,
        timestamp: Date.now(),
        isDelivered: true,
        hopCount: newPacket.hopCount,
        routingTrace: newPacket.routingTrace,
        type,
        isEncrypted: true,
        isSelf: true,
      };
      setMessages((prev) => [...prev, newMsg]);
    }
  };

  const handleUpdateNodePosition = (id: string, x: number, y: number, status?: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'UPDATE_NODE_POSITION',
          id,
          x,
          y,
          status,
        })
      );
    }
  };

  const handleAddRelayNode = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'ADD_RELAY_NODE',
          x: 50 + (Math.random() * 20 - 10),
          y: 50 + (Math.random() * 20 - 10),
        })
      );
    }
  };

  const handleResetTopology = () => {
    fetch('/api/mesh/reset', { method: 'POST' }).catch((e) => console.error(e));
  };

  const handleSendSosAlert = (alert: EmergencyAlert) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'EMERGENCY_SOS_BROADCAST',
          alert,
        })
      );
    }
  };

  const handleSelectMyNode = (nodeId: string) => {
    setSelectedSourceId(nodeId);
    selectedSourceIdRef.current = nodeId;
    sessionStorage.setItem('my_mesh_node_id', nodeId);
    setNodes((prev) => prev.map((n) => ({ ...n, isSelf: n.id === nodeId })));

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'SET_MY_NODE',
          nodeId,
        })
      );
    }

    if (selectedTargetId === nodeId) {
      if (nodeId === 'node-alpha-self') {
        setSelectedTargetId('node-bravo');
      } else {
        setSelectedTargetId('node-alpha-self');
      }
    }
  };

  const handleUpdateNodeName = (nodeId: string, name: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, name } : n)));
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'UPDATE_NODE_NAME',
          id: nodeId,
          name,
        })
      );
    }
  };

  const handleRegisterUser = (name: string, code: string, pin: string) => {
    setSelectedSourceId(code);
    selectedSourceIdRef.current = code;
    localStorage.setItem('mesh_user_name', name);
    localStorage.setItem('mesh_user_code', code);
    localStorage.setItem('mesh_user_pin', pin);
    sessionStorage.setItem('my_mesh_node_id', code);

    setNodes((prev) => {
      const existing = prev.find((n) => n.id === code);
      if (existing) {
        return prev.map((n) =>
          n.id === code ? { ...n, name, status: 'ONLINE', isSelf: true } : { ...n, isSelf: false }
        );
      }
      const newNode: MeshNode = {
        id: code,
        name,
        type: 'MOBILE_USER',
        status: 'ONLINE',
        batteryLevel: 98,
        x: Math.floor(Math.random() * 50) + 25,
        y: Math.floor(Math.random() * 50) + 25,
        signalRange: 35,
        rssi: -45,
        connectedPeers: ['node-relay-01', 'node-relay-02'],
        publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${code}`,
        lastSeen: Date.now(),
        isSelf: true,
      };
      return [...prev.map((n) => ({ ...n, isSelf: false })), newNode];
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'REGISTER_USER',
          name,
          code,
          nodeId: code,
          pin,
        })
      );
    }
  };

  const handleSendVoiceChunk = (chunk: {
    audioData?: string;
    mimeType?: string;
    pcmData?: number[];
    base64Pcm?: string;
    sampleRate?: number;
    senderName: string;
  }) => {
    const currentSourceId = selectedSourceIdRef.current;
    const myNodeObj = nodes.find((n) => n.id === currentSourceId);
    const senderName = myNodeObj ? myNodeObj.name : chunk.senderName || currentSourceId;

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'VOICE_CHUNK_STREAM',
          chunk: {
            ...chunk,
            senderId: currentSourceId,
            senderName,
          },
        })
      );
    }
  };

  const t = translations[lang];
  const myNodeObj = nodes.find((n) => n.id === selectedSourceId);

  return (
    <div className="min-h-screen bg-[#0A0B0E] text-[#E1E4EA] flex flex-col font-sans antialiased selection:bg-[#00FF9C] selection:text-black">
      {/* Top Header Navbar */}
      <Navbar
        lang={lang}
        setLang={setLang}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        nodesCount={nodes.length}
        myNodeName={myNodeObj ? myNodeObj.name : 'Device 1'}
        openSosModal={() => setIsSosModalOpen(true)}
        isConnected={isConnected}
      />

      {/* Global Speaker Unlock Alert Banner */}
      {!isAudioUnlocked && (
        <div className="bg-amber-500/20 border-b border-amber-500/80 px-4 py-2.5 text-center text-amber-300 text-xs font-bold uppercase flex flex-wrap items-center justify-center gap-3 animate-pulse">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>🔊 অন্য ফোনের কথা শুনতে প্রথমে ১বার এখানে ক্লিক করে স্পিকার পারমিশন আনলক করুন:</span>
          </div>
          <button
            onClick={unlockAudio}
            className="px-3 py-1 bg-amber-400 hover:bg-amber-300 text-black rounded font-extrabold text-xs cursor-pointer shadow transition-all"
          >
            স্পিকার আনলক করুন
          </button>
        </div>
      )}

      {/* Global Active Live Voice Stream Alert Banner */}
      {globalReceivingSpeaker && (
        <div className="bg-[#00FF9C]/20 border-b-2 border-[#00FF9C] px-4 py-3 text-center text-[#00FF9C] shadow-[0_0_25px_rgba(0,255,156,0.5)] animate-pulse flex flex-col items-center justify-center gap-1 z-50">
          <div className="flex items-center gap-2 font-black text-sm uppercase">
            <Volume2 className="w-5 h-5 text-amber-400 animate-bounce" />
            <span>🎙️ ইনকামিং অফলাইন ভয়েস আসছে: [{globalReceivingSpeaker}] কথা বলছেন...</span>
          </div>
          <p className="text-[11px] text-white/90 font-mono">
            মেস নেটওয়ার্ক লাইভ স্পিকার স্ট্রিম চালু আছে
          </p>
          <div className="flex items-center justify-center gap-1.5 h-4 mt-1">
            {[40, 85, 100, 65, 95, 50, 90, 70, 100, 45].map((h, i) => (
              <span
                key={i}
                className="w-1 bg-[#00FF9C] rounded-full animate-pulse"
                style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 md:p-5">
        {viewMode === 'SIMPLE_USER' && (
          <SimpleUserView
            nodes={nodes}
            messages={messages}
            myNodeId={selectedSourceId}
            lang={lang}
            onSendMessage={handleSendMessage}
            onSendSosAlert={handleSendSosAlert}
            onSwitchToMaster={() => setViewMode('MASTER')}
            onOpenRelayDashboard={() => setViewMode('RELAY_NODE')}
            onRegisterUser={handleRegisterUser}
            authError={authError}
          />
        )}

        {viewMode === 'RELAY_NODE' && (
          <RelayDashboard
            nodes={nodes}
            packets={packets}
            myNodeId={selectedSourceId}
            lang={lang}
            onSwitchToSimple={() => setViewMode('SIMPLE_USER')}
            onSwitchToMaster={() => setViewMode('MASTER')}
          />
        )}

        {viewMode === 'MASTER' && (
          <>
            {activeTab === 'TOPOLOGY' && (
              <MeshTopologyGraph
                nodes={nodes}
                lang={lang}
                onUpdateNodePosition={handleUpdateNodePosition}
                onAddRelayNode={handleAddRelayNode}
                onResetTopology={handleResetTopology}
                selectedSourceId={selectedSourceId}
                selectedTargetId={selectedTargetId}
                onSelectNode={(id) => setSelectedTargetId(id)}
              />
            )}

            {activeTab === 'CHAT' && (
              <ChatPanel
                nodes={nodes}
                messages={messages}
                lang={lang}
                selectedTargetId={selectedTargetId}
                onSelectTargetNode={(id) => setSelectedTargetId(id)}
                onSendMessage={handleSendMessage}
                onInspectPacket={(pkt) => setInspectedPacket(pkt)}
                packets={packets}
              />
            )}

            {activeTab === 'WALKIE_TALKIE' && (
              <WalkieTalkiePanel
                nodes={nodes}
                lang={lang}
                myNodeId={selectedSourceId}
                onSelectMyNode={handleSelectMyNode}
                onUpdateNodeName={handleUpdateNodeName}
                selectedTargetId={selectedTargetId}
                onSelectTargetNode={(id) => setSelectedTargetId(id)}
                onlineCount={onlineCount}
                onSendVoiceChunk={handleSendVoiceChunk}
                incomingVoiceChunk={incomingVoiceChunk}
              />
            )}

            {activeTab === 'CROWD_GPS' && (
              <CrowdGpsPanel
                nodes={nodes}
                lang={lang}
                myNodeId={selectedSourceId}
                onSendSosAlert={handleSendSosAlert}
              />
            )}

            {activeTab === 'REACT_NATIVE_EXPORT' && <ReactNativeExportPanel lang={lang} />}

            {activeTab === 'LOGS' && (
              <PacketLogsPanel
                packets={packets}
                lang={lang}
                onInspectPacket={(pkt) => setInspectedPacket(pkt)}
              />
            )}
          </>
        )}
      </main>

      {/* High Density Tactical Footer Bar */}
      <footer className="h-7 bg-[#00FF9C] text-black px-4 flex items-center justify-between text-[10px] font-mono font-black uppercase shrink-0 border-t border-[#00FF9C]">
        <div className="flex items-center gap-4">
          <span>● MESH LINK: OPERATIONAL</span>
          <span className="hidden sm:inline">SIGNAL HUB: LOCALHOST:3000</span>
          <span>E2EE: AES-256-GCM / RSA-4096</span>
        </div>
        <div className="flex items-center gap-3">
          <span>HOP DELAY: ~12ms</span>
          <span className="hidden md:inline">OFF-GRID PROXIMITY MODE</span>
        </div>
      </footer>

      {/* Modals */}
      <PacketInspectorModal
        packet={inspectedPacket}
        onClose={() => setInspectedPacket(null)}
        lang={lang}
      />

      <EmergencyBeaconModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        onSendAlert={handleSendSosAlert}
        lang={lang}
        selfNodeName="আলফা মোবাইল (Self)"
      />
    </div>
  );
}
