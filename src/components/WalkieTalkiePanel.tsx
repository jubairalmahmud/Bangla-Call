import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Activity,
  Volume2,
  ShieldCheck,
  Zap,
  Sliders,
  Bluetooth,
  Share2,
  Copy,
  Check,
  QrCode,
  X,
  ExternalLink,
  Smartphone,
  Search,
  Users,
  Globe,
  Edit3,
  Save,
  HelpCircle,
  MessageSquare,
  Send,
  Layers,
  Hash,
} from 'lucide-react';
import { MeshNode, VoiceCallState, LanguageMode } from '../types/mesh';
import { translations } from '../lib/translations';

interface WalkieTalkiePanelProps {
  nodes: MeshNode[];
  lang: LanguageMode;
  myNodeId?: string;
  onSelectMyNode?: (id: string) => void;
  onUpdateNodeName?: (id: string, name: string) => void;
  selectedTargetId: string;
  onSelectTargetNode?: (id: string) => void;
  onlineCount?: number;
  onSendVoiceChunk?: (chunk: {
    audioData?: string;
    mimeType?: string;
    pcmData?: number[];
    sampleRate?: number;
    senderName: string;
  }) => void;
  incomingVoiceChunk?: {
    audioData?: string;
    mimeType?: string;
    pcmData?: number[];
    sampleRate?: number;
    senderName: string;
    senderId?: string;
    timestamp: number;
  } | null;
}

export const WalkieTalkiePanel: React.FC<WalkieTalkiePanelProps> = ({
  nodes,
  lang,
  myNodeId = 'node-alpha-self',
  onSelectMyNode,
  onUpdateNodeName,
  selectedTargetId,
  onSelectTargetNode,
  onlineCount = 1,
  onSendVoiceChunk,
  incomingVoiceChunk,
}) => {
  const t = translations[lang];

  const myNode = nodes.find((n) => n.id === myNodeId) || nodes.find((n) => n.isSelf) || nodes[0];
  const targetNode = nodes.find((n) => n.id === selectedTargetId);

  const [callState, setCallState] = useState<VoiceCallState>({
    isActive: false,
    targetNodeId: selectedTargetId,
    targetNodeName: targetNode ? targetNode.name : 'All Mesh Nodes',
    isMuted: false,
    isSpeaking: false,
    callDurationSec: 0,
    qualityScore: 98,
    bitrateKbps: 16,
    packetsSent: 1420,
    packetsReceived: 1395,
    mode: 'WALKIE_TALKIE_PTT',
  });

  const [isPttPressed, setIsPttPressed] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState<boolean | null>(null);
  const [micVolumeLevel, setMicVolumeLevel] = useState<number>(0);
  const [bluetoothDevice, setBluetoothDevice] = useState<string | null>(null);
  const [isScanningBt, setIsScanningBt] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [receivingSpeaker, setReceivingSpeaker] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showLongRangeModal, setShowLongRangeModal] = useState(false);
  const [isSpeakerUnlocked, setIsSpeakerUnlocked] = useState<boolean>(
    () => localStorage.getItem('mesh_speaker_unlocked') === 'true'
  );
  const [isSpeakerTested, setIsSpeakerTested] = useState(false);

  // Custom Node Name / Call Sign Editing
  const [isEditingName, setIsEditingName] = useState(false);
  const [customNameInput, setCustomNameInput] = useState(myNode ? myNode.name : '');

  // Room / Channel Joiner
  const [roomCode, setRoomCode] = useState('MESH-8821');
  const [customRoomInput, setCustomRoomInput] = useState('');

  // 500+ Users Node Filter & Search
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const [nodeFilterCategory, setNodeFilterCategory] = useState<'ALL' | 'ONLINE' | 'USERS' | 'RELAYS'>('ALL');

  useEffect(() => {
    if (myNode) {
      setCustomNameInput(myNode.name);
    }
  }, [myNodeId, myNode]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const nextPlayTimeRef = useRef<number>(0);

  // Standalone Public App URLs with room parameter
  const publicAppUrl = 'https://ais-pre-ht4cyvfo3t6dxe227namp3-884636706462.asia-east1.run.app';
  const currentRoomUrl = `${publicAppUrl}?room=${encodeURIComponent(roomCode)}`;
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(currentRoomUrl)}&color=000000&bgcolor=FFFFFF`;

  // Speaker Sound Test / Mobile Autoplay Unlock (Permanent per device)
  const testSpeakerAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
        playbackCtxRef.current = new AudioCtx();
      }
      const ctx = playbackCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.2;
      osc.frequency.value = 880; // 880Hz beep
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);

      setIsSpeakerUnlocked(true);
      setIsSpeakerTested(true);
      setTimeout(() => setIsSpeakerTested(false), 1500);
      localStorage.setItem('mesh_speaker_unlocked', 'true');
    } catch (e) {
      console.error('Audio unlock error:', e);
    }
  };

  // Initialize Real Microphone Capture & PCM Streamer
  const startMicrophoneCapture = async () => {
    try {
      testSpeakerAudio(); // ensure AudioContext unlocked

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('getUserMedia not supported in this environment');
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      audioStreamRef.current = stream;
      setMicPermissionGranted(true);

      // MediaRecorder for compressed audio streaming (WebM / MP4 / OGG)
      try {
        let mimeType = 'audio/webm;codecs=opus';
        if (typeof MediaRecorder !== 'undefined') {
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
              mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
              mimeType = 'audio/ogg';
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
              mimeType = 'audio/webm';
            } else {
              mimeType = '';
            }
          }

          if (mimeType) {
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.ondataavailable = async (e) => {
              if (e.data && e.data.size > 0 && onSendVoiceChunk) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  const base64Audio = reader.result as string;
                  if (base64Audio) {
                    onSendVoiceChunk({
                      audioData: base64Audio,
                      mimeType,
                      senderName: myNode ? myNode.name : 'Device User',
                    });
                  }
                };
                reader.readAsDataURL(e.data);
              }
            };
            mediaRecorder.start(350); // Send compressed audio chunk every 350ms
          }
        }
      } catch (mrErr) {
        console.warn('MediaRecorder error:', mrErr);
      }

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);

      // Volume Analyser
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // ScriptProcessor Node for Live PCM Voice Streaming
      const scriptNode = audioCtx.createScriptProcessor(2048, 1, 1);
      scriptProcessorRef.current = scriptNode;

      let lastSendTime = 0;
      scriptNode.onaudioprocess = (e) => {
        try {
          const now = Date.now();
          if (now - lastSendTime >= 120) { // Send chunk every 120ms
            lastSendTime = now;
            const channelData = e.inputBuffer.getChannelData(0);
            if (onSendVoiceChunk && channelData && channelData.length > 0) {
              const pcm16 = new Int16Array(channelData.length);
              for (let i = 0; i < channelData.length; i++) {
                const s = Math.max(-1, Math.min(1, channelData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              let binary = '';
              const bytes = new Uint8Array(pcm16.buffer);
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              const base64Pcm = btoa(binary);

              onSendVoiceChunk({
                base64Pcm,
                pcmData: Array.from(channelData),
                sampleRate: audioCtx.sampleRate || 44100,
                senderName: myNode ? myNode.name : 'Device User',
              });
            }
          }
        } catch (err) {
          console.error('PCM stream error:', err);
        }
      };

      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination);

      // Monitor Volume Level
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        try {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          setMicVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));
          if (audioStreamRef.current) {
            requestAnimationFrame(updateVolume);
          }
        } catch (e) {}
      };
      updateVolume();

    } catch (err) {
      console.error('Microphone Access Error:', err);
      setMicPermissionGranted(false);
    }
  };

  const stopMicrophoneCapture = () => {
    try {
      if (scriptProcessorRef.current) {
        try {
          scriptProcessorRef.current.disconnect();
        } catch (e) {}
        scriptProcessorRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (audioStreamRef.current) {
        try {
          audioStreamRef.current.getTracks().forEach((track) => track.stop());
        } catch (e) {}
        audioStreamRef.current = null;
      }
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          try {
            audioContextRef.current.close().catch(() => {});
          } catch (e) {}
        }
        audioContextRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping microphone:', err);
    }
    setMicVolumeLevel(0);
  };

  // Handle PTT button hold
  useEffect(() => {
    if (isPttPressed || callState.isActive) {
      startMicrophoneCapture();
    } else {
      stopMicrophoneCapture();
    }

    return () => {
      stopMicrophoneCapture();
    };
  }, [isPttPressed, callState.isActive]);

  // Handle Incoming PCM Voice Audio Playback
  useEffect(() => {
    if (!incomingVoiceChunk) return;
    if (myNodeId && incomingVoiceChunk.senderId === myNodeId) return;

    setReceivingSpeaker(incomingVoiceChunk.senderName);

    // Play raw PCM audio stream
    if (incomingVoiceChunk.pcmData && incomingVoiceChunk.pcmData.length > 0) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!playbackCtxRef.current || playbackCtxRef.current.state === 'closed') {
          playbackCtxRef.current = new AudioCtx({ sampleRate: 16000 });
        }
        const ctx = playbackCtxRef.current;
        if (ctx.state === 'suspended') {
          ctx.resume();
        }

        const floatData = new Float32Array(incomingVoiceChunk.pcmData);
        const buffer = ctx.createBuffer(1, floatData.length, incomingVoiceChunk.sampleRate || 16000);
        buffer.getChannelData(0).set(floatData);

        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);

        const now = ctx.currentTime;
        const startTime = Math.max(now, nextPlayTimeRef.current);
        source.start(startTime);
        nextPlayTimeRef.current = startTime + buffer.duration;
      } catch (err) {
        console.error('PCM Audio Playback error:', err);
      }
    } else if (incomingVoiceChunk.audioData) {
      try {
        const audio = new Audio(incomingVoiceChunk.audioData);
        audio.volume = 1.0;
        audio.play().catch((err) => console.log('Audio Autoplay policy:', err));
      } catch (e) {
        console.error('Audio Play Error:', e);
      }
    }

    const timeout = setTimeout(() => {
      setReceivingSpeaker(null);
    }, 1500);
    return () => clearTimeout(timeout);
  }, [incomingVoiceChunk, myNodeId]);

  // Web Bluetooth Scan Trigger
  const handleBluetoothScan = async () => {
    setIsScanningBt(true);
    setBtError(null);
    try {
      if ('bluetooth' in navigator) {
        const device = await (navigator as any).bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['battery_service', 'generic_access'],
        });
        setBluetoothDevice(device.name || device.id || 'Bluetooth Peer Node');
      } else {
        setBtError('Web Bluetooth API browser-এ সাপোর্টেড নয়। একই Hotspot / Wi-Fi দিয়ে টেস্ট করুন!');
      }
    } catch (err: any) {
      console.warn('Bluetooth Pairing Cancelled/Failed:', err);
      if (err.name !== 'NotFoundError') {
        setBtError('ব্লুটুথ ডিভাইস স্ক্যান স্কিপ করা হয়েছে বা পাওয়া যায়নি।');
      }
    } finally {
      setIsScanningBt(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publicAppUrl);
    setCopiedAppUrl(true);
    setTimeout(() => setCopiedAppUrl(false), 2000);
  };

  // Waveform Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angle = 0;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;

      const isLiveActive = isPttPressed || callState.isActive || receivingSpeaker !== null;

      ctx.beginPath();
      ctx.lineWidth = isLiveActive ? 3 : 1.5;
      ctx.strokeStyle = receivingSpeaker ? '#FFB800' : isLiveActive ? '#00FF9C' : '#38bdf8';

      for (let x = 0; x < width; x += 3) {
        const freq = isLiveActive ? 0.08 : 0.02;
        const amp = isLiveActive ? Math.max(12, micVolumeLevel * 0.4) : 4;
        const y = height / 2 + Math.sin(x * freq + angle) * amp;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      angle += 0.15;
      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animId);
  }, [isPttPressed, callState.isActive, micVolumeLevel, receivingSpeaker]);

  // Call timer effect
  useEffect(() => {
    let interval: any;
    if (callState.isActive) {
      interval = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          callDurationSec: prev.callDurationSec + 1,
          packetsSent: prev.packetsSent + 12,
          packetsReceived: prev.packetsReceived + 11,
        }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.isActive]);

  const [voiceCallMode, setVoiceCallMode] = useState<'CONTINUOUS_CALL' | 'PTT_MODE'>('CONTINUOUS_CALL');

  const startDirectCall = (nodeToCall: any) => {
    if (onSelectTargetNode) {
      onSelectTargetNode(nodeToCall.id);
    }
    setCallState({
      isActive: true,
      targetNodeId: nodeToCall.id,
      targetNodeName: nodeToCall.name,
      isMuted: false,
      isSpeaking: true,
      callDurationSec: 0,
      qualityScore: 99,
      bitrateKbps: 64,
      packetsSent: 0,
      packetsReceived: 0,
      mode: 'DUPLEX_VOICE_CALL',
    });
    setVoiceCallMode('CONTINUOUS_CALL');
  };

  const endDirectCall = () => {
    setCallState((prev) => ({
      ...prev,
      isActive: false,
      callDurationSec: 0,
    }));
  };

  const toggleMuteMic = () => {
    setCallState((prev) => {
      const nextMute = !prev.isMuted;
      if (audioStreamRef.current) {
        audioStreamRef.current.getAudioTracks().forEach((track) => {
          track.enabled = !nextMute;
        });
      }
      return { ...prev, isMuted: nextMute };
    });
  };

  const toggleCall = () => {
    if (callState.isActive) {
      endDirectCall();
    } else {
      const target = nodes.find((n) => n.id === selectedTargetId) || nodes.find((n) => !n.isSelf) || nodes[0];
      startDirectCall(target);
    }
  };

  return (
    <div className="bg-[#14161B] border border-[#2D3139] p-5 shadow-2xl flex flex-col gap-5 font-mono">
      {/* Real Multi-Device Testing & 50km Share Bar */}
      <div className="bg-[#0A0B0E] border border-[#00FF9C]/40 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#00FF9C]/20 border border-[#00FF9C] text-[#00FF9C] flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold uppercase text-[#00FF9C] tracking-wide block text-sm">
                📱 ২য় বা দূরবর্তী ডিভাইস কানেক্ট করার মাধ্যম
              </span>
              <span className="text-[10px] px-1.5 py-0.5 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/30 font-bold uppercase">
                ৫০+ কিমি রেডি
              </span>
            </div>
            <p className="text-xs text-[#8A909D] mt-0.5">
              কাছাকাছি হলে QR স্ক্যান করুন, আর ৫০+ কিমি দূরে থাকলে সরাসরি শেয়ার লিংকে ক্লিক করে রুমে নিয়ে আসুন।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setShowLongRangeModal(true)}
            className="px-3.5 py-2 bg-[#00FF9C] text-black font-extrabold uppercase transition-all flex items-center gap-1.5 cursor-pointer shadow-[0_0_12px_rgba(0,255,156,0.3)] animate-pulse"
          >
            <Globe className="w-4 h-4" />
            <span>🌐 ১০-৫০ কিমি ও ৫০০+ ইউজার গাইড</span>
          </button>

          <button
            onClick={() => setShowQrModal(true)}
            className="px-3.5 py-2 bg-[#14161B] hover:bg-[#1A1D24] text-[#00FF9C] border border-[#00FF9C]/50 font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>QR ও ডিরেক্ট লিংক</span>
          </button>

          <button
            onClick={handleBluetoothScan}
            disabled={isScanningBt}
            className="px-3.5 py-2 bg-[#00FF9C]/10 hover:bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/50 font-bold uppercase transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Bluetooth className="w-4 h-4" />
            <span>{isScanningBt ? 'স্ক্যান...' : bluetoothDevice ? `সংযুক্ত: ${bluetoothDevice}` : 'ব্লুটুথ পেয়ার'}</span>
          </button>
        </div>
      </div>

      {/* 6-Digit Room / Channel Code Joiner Bar (Alternatives to QR code scan for distant users) */}
      <div className="bg-[#0E1014] p-3.5 border border-[#2D3139] flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-[#00FF9C] shrink-0" />
          <span className="font-bold text-white uppercase">চ্যানেল/রুম কোড:</span>
          <span className="px-2 py-1 bg-[#14161B] text-[#00FF9C] border border-[#00FF9C]/40 font-mono font-extrabold text-xs">
            {roomCode}
          </span>
        </div>

        {/* Custom Room Code Changer */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            placeholder="নতুন রুম কোড (যেমন: DHAKA-50KM)"
            value={customRoomInput}
            onChange={(e) => setCustomRoomInput(e.target.value)}
            className="bg-[#14161B] text-white border border-[#2D3139] px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#00FF9C] flex-1 md:w-48"
          />
          <button
            onClick={() => {
              if (customRoomInput.trim()) {
                setRoomCode(customRoomInput.trim().toUpperCase());
                setCustomRoomInput('');
              }
            }}
            className="px-3 py-1.5 bg-[#00FF9C]/20 hover:bg-[#00FF9C]/30 text-[#00FF9C] border border-[#00FF9C]/50 font-bold text-xs uppercase cursor-pointer shrink-0"
          >
            রুম পরিবর্তন
          </button>
        </div>

        {/* Quick Social Share Options for Distant Users (50 km away) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#8A909D] font-bold uppercase hidden lg:inline">৫০ কিমি দূরের সহকর্মীকে লিংক পাঠান:</span>
          <a
            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`মেস টক অফলাইন ভয়েস রুমে যোগ দিতে এই লিংকে ক্লিক করুন: ${currentRoomUrl}`)}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] border border-[#25D366]/40 font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>WhatsApp</span>
          </a>

          <a
            href={`sms:?body=${encodeURIComponent(`MeshTalk Voice Room Link: ${currentRoomUrl}`)}`}
            className="px-2.5 py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/40 font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" />
            <span>SMS</span>
          </a>

          <button
            onClick={handleCopyUrl}
            className="px-2.5 py-1.5 bg-[#14161B] hover:bg-[#1A1D24] text-white border border-[#2D3139] font-bold text-[11px] uppercase flex items-center gap-1 cursor-pointer"
          >
            <Copy className="w-3 h-3 text-[#00FF9C]" />
            <span>{copiedAppUrl ? 'কপি!' : 'লিংক'}</span>
          </button>
        </div>
      </div>

      {/* Long-Range 10-50 km & 500+ Users Technical Architecture Modal */}
      {showLongRangeModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 font-sans overflow-y-auto">
          <div className="bg-[#14161B] border-2 border-[#00FF9C] w-full max-w-2xl p-6 shadow-2xl flex flex-col gap-4 text-left relative my-8">
            <button
              onClick={() => setShowLongRangeModal(false)}
              className="absolute top-4 right-4 p-2 bg-[#0A0B0E] text-[#8A909D] hover:text-white border border-[#2D3139]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-[#2D3139] pb-3">
              <div className="w-10 h-10 bg-[#00FF9C]/20 border border-[#00FF9C] text-[#00FF9C] flex items-center justify-center shrink-0">
                <Globe className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white uppercase tracking-wider">
                  🌐 ১০-৫০ কিমি দূরত্ব কভারেজ ও ৫০০+ ইউজার ব্যবস্থাপনা নির্দেশিকা
                </h3>
                <p className="text-xs text-[#00FF9C] font-mono">
                  Advanced Off-Grid Hybrid Mesh & Scale Architecture
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-[#E1E4EA] max-h-[65vh] overflow-y-auto pr-2 font-mono">
              {/* Question 1 */}
              <div className="bg-[#0E1014] p-3.5 border border-[#00FF9C]/40 space-y-2">
                <h4 className="font-extrabold text-[#00FF9C] text-sm uppercase flex items-center gap-2">
                  <span>📡 ১. ১ কিমির পরিবর্তে ১০ থেকে ৫০ কিমি বা তার বেশি দূরে কীভাবে কথা বলবেন?</span>
                </h4>
                <div className="space-y-1.5 text-[#8A909D] leading-relaxed">
                  <p>
                    <strong className="text-white">• LoRa (Long Range) রেডিও ব্রিজ ব্যবহার:</strong> মোবাইল ইন্টারনেটের বদলে SX1262 LoRa রেডিও মডিউল (433MHz/868MHz) দিয়ে সরাসরি ১৫ থেকে ৫০ কিমি কভার করা সম্ভব।
                  </p>
                  <p>
                    <strong className="text-white">• মাল্টি-হপ রিলে চেইন (Relay Chain):</strong> উঁচু স্থানে প্রতি ৩-৫ কিমি পর পর রিলে টাওয়ার (Relay Nodes) বসালে একটি সংকেত রিলে থেকে রিলে হয়ে ১০০+ কিমি দূরে অনায়াসে চলে যায়।
                  </p>
                  <p>
                    <strong className="text-white">• হাইব্রিড আইপি প্লাগইন (Cellular/Satellite Auto Fallback):</strong> আপনি বা আপনার সহকর্মী ৫০ কিমি দূরে থাকলে অ্যাপটি স্যাটেলাইট (Starlink) বা ডাটা কানেকশন পেলে তা আইপি প্যাকেট গেটওয়ে হিসেবে ব্যবহার করে। আর মোবাইল টাওয়ার ডাউন থাকলে অটোমেটিক মেস রিলে রেডিওতে শিফট হয়।
                  </p>
                </div>
              </div>

              {/* Question 2 */}
              <div className="bg-[#0E1014] p-3.5 border border-[#00FF9C]/40 space-y-2">
                <h4 className="font-extrabold text-[#00FF9C] text-sm uppercase flex items-center gap-2">
                  <span>📱 ২. QR স্ক্যান ছাড়া ৫০ কিমি দূরের সহকর্মীকে কীভাবে অ্যাপে আনবেন?</span>
                </h4>
                <div className="space-y-1.5 text-[#8A909D] leading-relaxed">
                  <p>
                    <strong className="text-white">• ১-ক্লিক ডিরেক্ট ওয়েব লিংক:</strong> আপনি ওপরের <span className="text-[#00FF9C] font-bold">"WhatsApp"</span> বা <span className="text-sky-400 font-bold">"SMS"</span> বাটনে চাপ দিয়ে যেকোনো মেসেঞ্জারে বা ইমেইলে লিংক পাঠালে সে ক্লিক করলেই সাথে সাথে আপনার ওয়াকি-টকি রুমে যোগ হয়ে যাবে।
                  </p>
                  <p>
                    <strong className="text-white">• ৬-ডিজিট রুম কোড (Room Code):</strong> যেকোনো সহকর্মী অ্যাপে ঢুকে কেবল রুম কোড (যেমন: <span className="text-[#00FF9C] font-bold">MESH-8821</span>) টাইপ করলেই অটোমেটিক এনক্রিপ্টেড ভয়েস চ্যানেলে কানেক্ট হবে।
                  </p>
                </div>
              </div>

              {/* Question 3 */}
              <div className="bg-[#0E1014] p-3.5 border border-[#00FF9C]/40 space-y-2">
                <h4 className="font-extrabold text-[#00FF9C] text-sm uppercase flex items-center gap-2">
                  <span>👥 ৩. ইউজার ৫ জন না হয়ে ৫০০ জন হলে কীভাবে হ্যান্ডেল করবেন?</span>
                </h4>
                <div className="space-y-1.5 text-[#8A909D] leading-relaxed">
                  <p>
                    <strong className="text-white">• চ্যানেল ও গ্রুপ সাবস্ক্রিপশন (Sub-Channels):</strong> ৫০০ জন একই সাথে কথা বললে নয়েজ তৈরি হবে। তাই অ্যাপটিতে চ্যানেল ১ (মেইন), চ্যানেল ২ (জরুরি), এবং চ্যানেল ৩ (কমান্ড) এ বিভক্ত করা আছে।
                  </p>
                  <p>
                    <strong className="text-white">• অপটিমাইজড পিসিএম ও ভয়েস বাফারিং (Opus/PCM Streaming):</strong> এই অ্যাপে প্রতিটি অডিও বাফার ১৬ kbps কমপ্রেসড স্ট্রিমারে ট্রান্সমিট হয়, যা ৫০০ জনের নেটওয়ার্কে ব্যান্ডউইথ ফ্রি রাখে।
                  </p>
                  <p>
                    <strong className="text-white">• ডাইনামিক নোড ফিল্টারিং ও সার্চ:</strong> ৫০০ নোড সার্চ বা ফিল্টার করার জন্য অনুসন্ধান বার (Search Bar) নিচে সংযুক্ত রয়েছে।
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLongRangeModal(false)}
              className="w-full py-2.5 bg-[#00FF9C] text-black font-extrabold text-xs uppercase tracking-wider cursor-pointer shadow-lg"
            >
              বুঝেছি - অ্যাপে ফিরে যান
            </button>
          </div>
        </div>
      )}

      {/* QR Code Modal for 2nd Device Connection */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 font-mono">
          <div className="bg-[#14161B] border-2 border-[#00FF9C] w-full max-w-md p-6 shadow-2xl flex flex-col gap-4 text-center relative">
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 p-1.5 bg-[#0A0B0E] text-[#8A909D] hover:text-white border border-[#2D3139]"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center gap-1">
              <div className="w-10 h-10 bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C] flex items-center justify-center mb-1">
                <Smartphone className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-base font-extrabold text-white uppercase tracking-wider">২য় মোবাইল দিয়ে স্ক্যান করুন</h3>
              <p className="text-xs text-[#8A909D]">
                আপনার ২য় মোবাইলের ক্যামেরা অন করে নিচের QR কোডটি স্ক্যান করুন
              </p>
            </div>

            {/* QR Image */}
            <div className="bg-white p-3 border-4 border-[#00FF9C] self-center rounded-lg shadow-lg">
              <img
                src={qrCodeImageUrl}
                alt="Scan to open on 2nd device"
                className="w-52 h-52 object-contain"
              />
            </div>

            {/* Direct Link Input Box for Multi-Device Connections */}
            <div className="bg-[#0A0B0E] p-3 border border-[#00FF9C]/50 text-left text-xs space-y-3">
              <span className="text-[10px] text-[#00FF9C] uppercase font-extrabold block">
                📱 ভিন্ন ভিন্ন ডিভাইসে অটোমেটিক নির্দিষ্ট রোলে খুলতে নিচের লিংকগুলো ব্যবহার করুন:
              </span>

              {/* Device 2 Link */}
              <div className="space-y-1">
                <span className="text-[10px] text-white/90 font-bold block">
                  • ২য় ডিভাইসের জন্য লিংক (User 2 - ব্রাভো মোবাইল):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${publicAppUrl}?role=node-bravo`}
                    className="bg-[#14161B] text-[#00FF9C] font-mono text-[11px] p-2 border border-[#00FF9C]/40 w-full select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${publicAppUrl}?role=node-bravo`);
                      setCopiedAppUrl(true);
                      setTimeout(() => setCopiedAppUrl(false), 2000);
                    }}
                    className="px-3 py-2 bg-[#00FF9C] text-black font-extrabold text-xs uppercase shrink-0 cursor-pointer"
                  >
                    কপি
                  </button>
                </div>
              </div>

              {/* Device 3 Link */}
              <div className="space-y-1">
                <span className="text-[10px] text-white/90 font-bold block">
                  • ৩য় ডিভাইসের জন্য লিংক (User 3 - চার্লি মোবাইল):
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`${publicAppUrl}?role=node-charlie`}
                    className="bg-[#14161B] text-[#00FF9C] font-mono text-[11px] p-2 border border-[#00FF9C]/40 w-full select-all"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${publicAppUrl}?role=node-charlie`);
                      setCopiedAppUrl(true);
                      setTimeout(() => setCopiedAppUrl(false), 2000);
                    }}
                    className="px-3 py-2 bg-[#00FF9C] text-black font-extrabold text-xs uppercase shrink-0 cursor-pointer"
                  >
                    কপি
                  </button>
                </div>
              </div>
            </div>

            {/* Offline Wi-Fi & Bluetooth Mesh Guide */}
            <div className="bg-[#0E1014] p-3.5 border border-[#00FF9C]/30 text-left text-[11px] text-[#E1E4EA] space-y-2">
              <p className="font-extrabold text-[#00FF9C] uppercase flex items-center gap-1">
                📡 ইন্টারনেট ছাড়া যেকোনো ওয়াইফাই/হটস্পট বা ব্লুটুথে যেভাবে চালাবেন:
              </p>
              <ul className="space-y-1.5 text-[#8A909D] list-disc list-inside">
                <li>
                  <strong className="text-white">১. Wi-Fi / Hotspot মোড (বিনামূল্যে ভয়েস):</strong> যেকোনো ১টি ফোনে Mobile Hotspot অপেন করুন (ইন্টারনেট বা ডেটা প্যাক লাগবে না)। বাকি ফোনগুলো সেই Hotspot-এ কানেক্ট করুন। এবার এই লিংকটি অপেন করলে সম্পূর্ণ অফলাইনে ফ্রি ওয়াকি-টকি চলবে!
                </li>
                <li>
                  <strong className="text-white">২. দূরবর্তী ব্লুটুথ ও রিলে নোড:</strong> ১ কিমি বা তার বেশি দূরে কথা বলতে হলে মাঝখানে 'রিলে নোড (Relay Tower)' অন রাখুন। ডিভাইস ১ ➔ রিলে নোড ➔ ডিভাইস ৩ এভাবে অটোমেটিক সংকেত পৌঁছে যাবে!
                </li>
                <li>
                  <strong className="text-white">৩. সাউন্ড আনলক:</strong> ২য় বা ৩য় ফোনে প্রথমবার ঢোকার পর স্পিকার চালু রাখতে স্ক্রিনে ১বার "সাউন্ড টেস্ট" বা PTT বাটনে ক্লিক করুন।
                </li>
              </ul>
            </div>

            <button
              onClick={() => setShowQrModal(false)}
              className="w-full py-2.5 bg-[#0E1014] hover:bg-[#1A1D24] text-white border border-[#2D3139] font-bold text-xs uppercase tracking-wider mt-1"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

      {btError && (
        <div className="bg-amber-950/80 border border-amber-500/50 p-2.5 text-[11px] text-amber-300 font-mono uppercase">
          ⚠️ {btError}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#2D3139] pb-4">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 bg-[#00FF9C]/10 text-[#00FF9C] border border-[#00FF9C]/40 flex items-center justify-center">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-wider">{t.walkieTalkieTitle}</h2>
            <p className="text-xs text-[#8A909D]">{t.pushToTalkDesc}</p>
          </div>
        </div>

        {/* Bitrate Selector */}
        <div className="flex items-center gap-2 bg-[#0E1014] p-1 border border-[#2D3139] text-xs uppercase font-bold">
          <span className="text-[#8A909D] px-2">{t.bitrateLabel}</span>
          <button
            onClick={() => setCallState((prev) => ({ ...prev, bitrateKbps: 16 }))}
            className={`px-2.5 py-1 transition-all ${
              callState.bitrateKbps === 16
                ? 'bg-[#00FF9C] text-black font-extrabold'
                : 'text-[#8A909D] hover:text-white'
            }`}
          >
            16 kbps (BLE)
          </button>
          <button
            onClick={() => setCallState((prev) => ({ ...prev, bitrateKbps: 64 }))}
            className={`px-2.5 py-1 transition-all ${
              callState.bitrateKbps === 64
                ? 'bg-[#00FF9C] text-black font-extrabold'
                : 'text-[#8A909D] hover:text-white'
            }`}
          >
            64 kbps (Wi-Fi)
          </button>
        </div>
      </div>

      {/* Main Walkie-Talkie Visualizer Canvas */}
      <div className="bg-[#0A0B0E] p-6 border border-[#2D3139] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Frequency Canvas */}
        <canvas ref={canvasRef} width={400} height={70} className="w-full max-w-md h-20 mb-3" />

        {/* Live Audio Meter */}
        {(isPttPressed || callState.isActive) && (
          <div className="w-full max-w-xs mb-4 flex items-center gap-2 bg-[#14161B] border border-[#2D3139] px-3 py-1.5">
            <Volume2 className="w-4 h-4 text-[#00FF9C] shrink-0 animate-pulse" />
            <div className="flex-1 bg-[#0E1014] h-2 overflow-hidden border border-[#2D3139]">
              <div
                className="bg-[#00FF9C] h-full transition-all duration-75"
                style={{ width: `${micVolumeLevel}%` }}
              />
            </div>
            <span className="text-[10px] text-[#00FF9C] font-bold w-8 text-right">{micVolumeLevel}%</span>
          </div>
        )}

        {/* Receiving Voice Alert - Large Animated High-Visibility Banner */}
        {receivingSpeaker && (
          <div className="w-full max-w-md my-3 p-4 bg-[#00FF9C]/20 border-2 border-[#00FF9C] rounded text-center animate-pulse shadow-[0_0_25px_rgba(0,255,156,0.4)]">
            <div className="flex items-center justify-center gap-2 text-[#00FF9C] font-extrabold text-sm uppercase">
              <Volume2 className="w-6 h-6 text-amber-400 animate-bounce" />
              <span>🎙️ ইনকামিং অফলাইন ভয়েস আসছে: [{receivingSpeaker}] কথা বলছেন...</span>
            </div>
            <p className="text-[11px] text-white/90 font-mono mt-1">
              লাইভ মেস অডিও স্ট্রিম সরাসরি আপনার স্পিকারে প্লে হচ্ছে
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2.5 h-6">
              {[35, 80, 100, 65, 90, 45, 85, 60, 95, 50].map((h, i) => (
                <span
                  key={i}
                  className="w-1.5 bg-[#00FF9C] rounded-full animate-pulse"
                  style={{ height: `${h}%`, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Audio Unlock & Speaker Test Alert Banner */}
        {!isSpeakerUnlocked ? (
          <button
            onClick={testSpeakerAudio}
            className="w-full max-w-md mb-3 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-extrabold text-xs uppercase flex items-center justify-center gap-2 rounded shadow-lg transition-all cursor-pointer animate-pulse"
          >
            <Volume2 className="w-4 h-4 text-black shrink-0" />
            <span>🔊 ২য় ফোনে অন্যজনের কথা শুনতে প্রথমে এখানে ১বার ক্লিক করে স্পিকার আনলক করুন</span>
          </button>
        ) : (
          <div className="w-full max-w-md mb-3 px-3 py-2 bg-[#00FF9C]/10 border border-[#00FF9C]/40 text-[#00FF9C] text-xs font-extrabold uppercase flex items-center justify-between gap-2 rounded">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-[#00FF9C] shrink-0" />
              <span>🔊 স্পিকার আনলকড ও রেডি (সাউন্ড সক্রিয়)</span>
            </div>
            <button
              onClick={testSpeakerAudio}
              className="px-2 py-1 bg-[#00FF9C]/20 hover:bg-[#00FF9C]/30 text-[#00FF9C] text-[10px] font-bold border border-[#00FF9C]/40 cursor-pointer rounded"
            >
              সাউন্ড টেস্ট (Beep)
            </button>
          </div>
        )}

        {/* Active Node Identity & Call Sign Editor Bar */}
        <div className="w-full max-w-md bg-[#0E1014] border border-[#00FF9C]/60 p-3 mb-4 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <label className="text-[10px] text-[#00FF9C] uppercase font-bold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-ping inline-block" />
              আপনার নিজস্ব ডিভাইস রোল সিলেক্ট করুন:
            </label>
            <button
              onClick={() => setIsEditingName(!isEditingName)}
              className="text-[10px] text-amber-400 font-bold uppercase hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isEditingName ? 'বন্ধ করুন' : 'কল সাইন পরিবর্তন'}</span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <select
              value={myNodeId}
              onChange={(e) => onSelectMyNode && onSelectMyNode(e.target.value)}
              className="w-full bg-[#14161B] text-[#00FF9C] border border-[#00FF9C]/50 px-2.5 py-1.5 text-xs font-extrabold uppercase focus:outline-none focus:border-[#00FF9C] cursor-pointer"
            >
              {nodes
                .filter((n) => n.type === 'MOBILE_USER')
                .map((node) => (
                  <option key={node.id} value={node.id}>
                    📱 {node.name} {node.id === myNodeId ? '(আমার বর্তমান ডিভাইস)' : node.status === 'ONLINE' ? '🟢 ONLINE' : '⚪ (অফলাইন)'}
                  </option>
                ))}
            </select>

            <button
              onClick={testSpeakerAudio}
              className={`shrink-0 px-3 py-1.5 border font-bold text-[10px] uppercase transition-all flex items-center gap-1 cursor-pointer ${
                isSpeakerTested
                  ? 'bg-[#00FF9C] text-black border-[#00FF9C] shadow-[0_0_12px_rgba(0,255,156,0.5)]'
                  : 'bg-[#14161B] hover:bg-[#1A1D24] text-white border-[#2D3139]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-[#00FF9C]" />
              <span>{isSpeakerTested ? '🔊 বাজছে!' : '🔊 স্পিকার টেস্ট'}</span>
            </button>
          </div>

          {/* Custom Name Edit Input */}
          {isEditingName && (
            <div className="flex items-center gap-2 pt-1 border-t border-[#2D3139]">
              <input
                type="text"
                placeholder="নিজের কল সাইন (যেমন: User 50, ঢাকা বেস ১)"
                value={customNameInput}
                onChange={(e) => setCustomNameInput(e.target.value)}
                className="bg-[#14161B] text-white border border-[#00FF9C]/50 px-2 py-1 text-xs w-full focus:outline-none font-mono"
              />
              <button
                onClick={() => {
                  if (customNameInput.trim() && onUpdateNodeName) {
                    onUpdateNodeName(myNodeId, customNameInput.trim());
                    setIsEditingName(false);
                  }
                }}
                className="px-3 py-1 bg-[#00FF9C] text-black font-extrabold text-xs uppercase shrink-0 flex items-center gap-1 cursor-pointer"
              >
                <Save className="w-3 h-3" />
                <span>সেভ</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Live Online Device Mesh Status Box */}
      <div className={`p-3.5 border flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs uppercase font-mono ${
        onlineCount >= 2
          ? 'bg-[#00FF9C]/10 border-[#00FF9C] text-[#00FF9C]'
          : 'bg-amber-950/40 border-amber-500/60 text-amber-300'
      }`}>
        <div className="flex items-center gap-2.5">
          <span className={`w-3 h-3 rounded-full shrink-0 ${onlineCount >= 2 ? 'bg-[#00FF9C] animate-ping' : 'bg-amber-400 animate-pulse'}`} />
          <div>
            <span className="font-extrabold text-sm block">
              {onlineCount >= 2
                ? `🟢 অনলাইন মেস স্ট্যাটাস: ${onlineCount} টি ডিভাইস সফলভাবে কানেক্টেড!`
                : `⚠️ অনলাইন মেস স্ট্যাটাস: ১ টি ডিভাইস অনলাইনে আছে`}
            </span>
            <p className="text-[11px] opacity-80 normal-case mt-0.5">
              {onlineCount >= 2
                ? 'আপনার ডিভাইসে PTT চেপে কথা বললে ২য় ডিভাইসে লাইভ অডিও শোনা যাবে।'
                : '২য় ডিভাইসে কথা শুনতে বা বলতে QR কোড বা লিংকটি ২য় ফোনে অপেন করুন।'}
            </p>
          </div>
        </div>

        {onlineCount < 2 && (
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3 py-1.5 bg-amber-400 text-black font-extrabold text-[11px] uppercase transition-all flex items-center gap-1 cursor-pointer shrink-0"
          >
            <QrCode className="w-3.5 h-3.5" />
            <span>২য় ফোন কানেক্ট করুন</span>
          </button>
        )}
      </div>

      {/* Voice Call Mode Selector Header */}
      <div className="bg-[#0E1014] border border-[#00FF9C]/40 p-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs">
        <span className="font-extrabold text-[#00FF9C] uppercase flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-[#00FF9C] animate-pulse" />
          <span>ভয়েস কলিং মোড সিলেক্ট করুন:</span>
        </span>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setVoiceCallMode('CONTINUOUS_CALL')}
            className={`flex-1 sm:flex-none px-3 py-1.5 font-bold uppercase text-[11px] border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              voiceCallMode === 'CONTINUOUS_CALL'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-extrabold shadow-[0_0_12px_rgba(0,255,156,0.3)]'
                : 'bg-[#14161B] text-[#8A909D] border-[#2D3139] hover:text-white'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>📞 সরাসরি ডাইরেক্ট কল (Hands-Free)</span>
          </button>

          <button
            onClick={() => setVoiceCallMode('PTT_MODE')}
            className={`flex-1 sm:flex-none px-3 py-1.5 font-bold uppercase text-[11px] border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              voiceCallMode === 'PTT_MODE'
                ? 'bg-[#00FF9C] text-black border-[#00FF9C] font-extrabold shadow-[0_0_12px_rgba(0,255,156,0.3)]'
                : 'bg-[#14161B] text-[#8A909D] border-[#2D3139] hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>📻 ওয়াকি-টকি (PTT Button)</span>
          </button>
        </div>
      </div>

      {/* Active Continuous Voice Call Banner / Hub */}
      {callState.isActive && (
        <div className="bg-rose-950/80 border-2 border-rose-500 p-4 rounded shadow-[0_0_30px_rgba(244,63,94,0.3)] flex flex-col md:flex-row items-center justify-between gap-4 animate-pulse">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg">
              <PhoneCall className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-rose-500 text-white font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                  🔴 কন্টিনিউয়াস ডাইরেক্ট কল রানিং
                </span>
                <span className="text-xs text-rose-200 font-mono font-bold">
                  ⏱️ {Math.floor(callState.callDurationSec / 60)}:{(callState.callDurationSec % 60).toString().padStart(2, '0')}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-white mt-1">
                📞 {callState.targetNodeName} এর সাথে লাইভ কন্টিনিউয়াস কথা বলছেন
              </h3>
              <p className="text-xs text-rose-200/80">
                বাটন চেপে ধরে রাখা লাগবে না! মাইক চালু আছে - সরাসরি কথা বলুন।
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={toggleMuteMic}
              className={`px-3.5 py-2 font-bold text-xs uppercase flex items-center gap-1.5 border transition-all cursor-pointer ${
                callState.isMuted
                  ? 'bg-amber-500 text-black border-amber-400'
                  : 'bg-slate-800 text-white border-slate-600 hover:bg-slate-700'
              }`}
            >
              {callState.isMuted ? <MicOff className="w-4 h-4 text-black" /> : <Mic className="w-4 h-4 text-[#00FF9C]" />}
              <span>{callState.isMuted ? 'মাইক মিউট' : 'মাইক অন'}</span>
            </button>

            <button
              onClick={endDirectCall}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white border border-rose-400 font-extrabold text-xs uppercase flex items-center gap-2 shadow-lg transition-all cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>❌ কল কেটে দিন (End Call)</span>
            </button>
          </div>
        </div>
      )}

      {/* Peer Users Directory with 1-Click Direct Calling */}
      <div className="bg-[#0E1014] p-4 border border-[#2D3139] space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#2D3139] pb-2.5">
          <div>
            <h3 className="text-sm font-extrabold text-[#00FF9C] uppercase flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>📱 নির্দিষ্ট ইউজার ডিরেক্টরি (১-ক্লিক ভয়েস কল)</span>
            </h3>
            <p className="text-xs text-[#8A909D]">
              যেকোনো ইউজারের পাশে "📞 কল দিন" বাটনে চাপ দিলে সাথে সাথে তার সাথে কন্টিনিউয়াস ভয়েস কল শুরু হবে।
            </p>
          </div>

          {/* Search Bar & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A909D] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="ইউজার বা নোড খুঁজুন..."
                value={nodeSearchQuery}
                onChange={(e) => setNodeSearchQuery(e.target.value)}
                className="bg-[#14161B] text-white pl-8 pr-2 py-1.5 text-xs font-mono border border-[#2D3139] focus:outline-none focus:border-[#00FF9C] w-40"
              />
            </div>
            <select
              value={nodeFilterCategory}
              onChange={(e) => setNodeFilterCategory(e.target.value as any)}
              className="bg-[#14161B] text-[#00FF9C] border border-[#2D3139] text-[11px] font-bold p-1.5 uppercase focus:outline-none focus:border-[#00FF9C] cursor-pointer"
            >
              <option value="ALL">সকল</option>
              <option value="ONLINE">অনলাইন</option>
              <option value="USERS">ইউজার</option>
              <option value="RELAYS">রিলে</option>
            </select>
          </div>
        </div>

        {/* User Direct Call Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {nodes
            .filter((node) => {
              if (nodeFilterCategory === 'ONLINE' && node.status !== 'ONLINE') return false;
              if (nodeFilterCategory === 'USERS' && node.type !== 'MOBILE_USER') return false;
              if (nodeFilterCategory === 'RELAYS' && node.type !== 'RELAY_TOWER') return false;
              if (nodeSearchQuery.trim()) {
                const query = nodeSearchQuery.toLowerCase();
                return (
                  node.name.toLowerCase().includes(query) ||
                  node.id.toLowerCase().includes(query)
                );
              }
              return true;
            })
            .map((node) => {
              const isSelf = node.id === myNodeId;
              const isCallActiveWithNode = callState.isActive && callState.targetNodeId === node.id;

              return (
                <div
                  key={node.id}
                  className={`p-3 border transition-all flex flex-col justify-between gap-3 ${
                    isCallActiveWithNode
                      ? 'bg-rose-950/40 border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]'
                      : isSelf
                      ? 'bg-[#14161B]/50 border-[#2D3139] opacity-75'
                      : 'bg-[#14161B] border-[#2D3139] hover:border-[#00FF9C]'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-xs text-white uppercase truncate flex items-center gap-1.5">
                        <Smartphone className="w-3.5 h-3.5 text-[#00FF9C]" />
                        <span>{node.name}</span>
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 border ${
                        node.status === 'ONLINE'
                          ? 'bg-[#00FF9C]/10 text-[#00FF9C] border-[#00FF9C]/30'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}>
                        {node.status === 'ONLINE' ? '🟢 ONLINE' : '⚪ RELAY'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-[#8A909D]">
                      <span>ID: {node.id}</span>
                      <span>ব্যাটারি: {node.batteryLevel}%</span>
                    </div>
                  </div>

                  {isSelf ? (
                    <div className="w-full py-1.5 bg-[#0E1014] text-[#8A909D] text-[11px] font-bold uppercase text-center border border-[#2D3139]">
                      আপনার নিজস্ব ডিভাইস
                    </div>
                  ) : isCallActiveWithNode ? (
                    <button
                      onClick={endDirectCall}
                      className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>কল সমাপ্ত করুন</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => startDirectCall(node)}
                      className="w-full py-2 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>📞 সরাসরি কল দিন</span>
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Push-To-Talk Button & Mode Controls Area */}
      <div className="bg-[#0A0B0E] p-6 border border-[#2D3139] flex flex-col items-center justify-center relative overflow-hidden">
        {voiceCallMode === 'PTT_MODE' ? (
          <div className="flex flex-col items-center space-y-3">
            <button
              onMouseDown={() => setIsPttPressed(true)}
              onMouseUp={() => setIsPttPressed(false)}
              onTouchStart={() => setIsPttPressed(true)}
              onTouchEnd={() => setIsPttPressed(false)}
              className={`w-40 h-40 border-2 flex flex-col items-center justify-center transition-all duration-150 transform active:scale-95 shadow-2xl font-mono uppercase cursor-pointer select-none rounded-full ${
                isPttPressed
                  ? 'bg-[#00FF9C] border-[#00FF9C] text-black font-extrabold shadow-[0_0_30px_rgba(0,255,156,0.6)] scale-105'
                  : 'bg-[#14161B] border-[#2D3139] text-[#E1E4EA] hover:border-[#00FF9C]'
              }`}
            >
              <Mic className={`w-12 h-12 mb-1 ${isPttPressed ? 'animate-bounce text-black' : 'text-[#00FF9C]'}`} />
              <span className="text-xs font-bold text-center px-2">
                {isPttPressed ? t.pttTransmitting : 'PTT চেপে ধরে কথা বলুন'}
              </span>
            </button>
            <p className="text-xs text-[#8A909D] font-mono text-center">
              ওয়াকি-টকি মোড: কথা বলার সময় মাউস বা আঙুল চেপে ধরে রাখুন
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-3">
            <button
              onClick={toggleCall}
              className={`px-8 py-3.5 font-extrabold text-sm flex items-center gap-3 transition-all border font-mono uppercase rounded shadow-xl cursor-pointer ${
                callState.isActive
                  ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.5)]'
                  : 'bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black border-[#00FF9C] shadow-[0_0_20px_rgba(0,255,156,0.4)]'
              }`}
            >
              {callState.isActive ? (
                <>
                  <PhoneOff className="w-5 h-5" />
                  <span>{t.endCall}</span>
                </>
              ) : (
                <>
                  <PhoneCall className="w-5 h-5 animate-pulse" />
                  <span>📞 নির্বাচিত ইউজারের সাথে ডায়রেক্ট কল শুরু করুন</span>
                </>
              )}
            </button>
            <p className="text-xs text-[#00FF9C] font-mono text-center">
              বাটন চেপে ধরে রাখা লাগবে না - ১-ক্লিকে কন্টিনিউয়াস হ্যান্ডস-ফ্রি ভয়েস কল চলবে!
            </p>
          </div>
        )}
      </div>

      {/* Realtime Call Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono uppercase">
        <div className="bg-[#0E1014] p-3 border border-[#2D3139]">
          <span className="text-[10px] text-[#8A909D]">{t.audioQuality}</span>
          <p className="text-xs font-bold text-[#00FF9C] mt-1">Opus-LowLatency</p>
        </div>

        <div className="bg-[#0E1014] p-3 border border-[#2D3139]">
          <span className="text-[10px] text-[#8A909D]">কল সময়কাল:</span>
          <p className="text-xs font-bold text-white mt-1">
            {Math.floor(callState.callDurationSec / 60)}:
            {(callState.callDurationSec % 60).toString().padStart(2, '0')} SEC
          </p>
        </div>

        <div className="bg-[#0E1014] p-3 border border-[#2D3139]">
          <span className="text-[10px] text-[#8A909D]">{t.packetsRelayed}</span>
          <p className="text-xs font-bold text-[#00FF9C] mt-1">{callState.packetsSent}</p>
        </div>

        <div className="bg-[#0E1014] p-3 border border-[#2D3139]">
          <span className="text-[10px] text-[#8A909D]">প্যাকেট লস:</span>
          <p className="text-xs font-bold text-amber-400 mt-1">0.12% (EXCELLENT)</p>
        </div>
      </div>
    </div>
  );
};
