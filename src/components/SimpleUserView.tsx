import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneCall,
  PhoneOff,
  MessageSquare,
  Mic,
  MicOff,
  Send,
  User,
  ShieldCheck,
  Smartphone,
  Copy,
  Crown,
  Radio,
  Plus,
  BookOpen,
  Delete,
  Search,
  CheckCircle2,
  Lock,
  LogOut,
  UserPlus,
  Phone,
  Hash,
} from 'lucide-react';
import { MeshNode, ChatMessage, LanguageMode } from '../types/mesh';

interface SavedContact {
  id: string;
  name: string;
  code: string; // 6 digit phone code
}

interface SimpleUserViewProps {
  nodes: MeshNode[];
  messages: ChatMessage[];
  myNodeId: string;
  lang: LanguageMode;
  onSendMessage: (targetId: string, content: string) => void;
  onSendSosAlert: (message: string, reason: string) => void;
  onSwitchToMaster: () => void;
  onOpenRelayDashboard: () => void;
  onRegisterUser: (name: string, code: string, pin: string) => void;
  authError?: string;
  incomingCall?: { callerId: string; callerName: string; targetId: string; timestamp: number } | null;
  callSignalState?: { type: 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'ENDED' | 'NONE'; targetId?: string; callerId?: string };
  onSendCallSignal?: (action: 'INITIATE' | 'ACCEPT' | 'REJECT' | 'END', targetId: string, callerName?: string) => void;
  onSendVoiceChunk?: (chunk: { audioData?: string; mimeType?: string; pcmData?: number[]; base64Pcm?: string; sampleRate?: number; senderName: string }) => void;
}

export const SimpleUserView: React.FC<SimpleUserViewProps> = ({
  nodes,
  messages,
  myNodeId,
  lang,
  onSendMessage,
  onSendSosAlert,
  onSwitchToMaster,
  onOpenRelayDashboard,
  onRegisterUser,
  authError,
  incomingCall,
  callSignalState,
  onSendCallSignal,
  onSendVoiceChunk,
}) => {
  // Login / Registration state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    const savedCode = localStorage.getItem('mesh_user_code');
    return !!savedCode && savedCode.length === 6;
  });

  const [inputName, setInputName] = useState<string>(
    () => localStorage.getItem('mesh_user_name') || ''
  );
  const [inputCode, setInputCode] = useState<string>(
    () => localStorage.getItem('mesh_user_code') || ''
  );
  const [inputPin, setInputPin] = useState<string>(
    () => localStorage.getItem('mesh_user_pin') || '1234'
  );
  const [loginError, setLoginError] = useState<string>('');

  // Main UI Tabs
  const [activeTab, setActiveTab] = useState<'DIALER' | 'CONTACTS' | 'CHAT'>('DIALER');

  // Dialer input state
  const [dialerNumber, setDialerNumber] = useState<string>('');

  // Contacts state
  const [contacts, setContacts] = useState<SavedContact[]>(() => {
    const saved = localStorage.getItem('mesh_saved_contacts');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return [];
  });

  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactCode, setNewContactCode] = useState<string>('');
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [contactSearchQuery, setContactSearchQuery] = useState<string>('');

  // Chat Target state
  const [chatTargetCode, setChatTargetCode] = useState<string>('BROADCAST');
  const [chatInput, setChatInput] = useState<string>('');

  // Call state
  const [activeCall, setActiveCall] = useState<{
    isActive: boolean;
    targetCode: string;
    targetName: string;
    durationSec: number;
    isMuted: boolean;
  }>({
    isActive: false,
    targetCode: '',
    targetName: '',
    durationSec: 0,
    isMuted: false,
  });

  const timerRef = useRef<any>(null);

  // Save contacts to localStorage
  useEffect(() => {
    localStorage.setItem('mesh_saved_contacts', JSON.stringify(contacts));
  }, [contacts]);

  // Active Call timer
  useEffect(() => {
    if (activeCall.isActive) {
      timerRef.current = setInterval(() => {
        setActiveCall((prev) => ({ ...prev, durationSec: prev.durationSec + 1 }));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeCall.isActive]);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = inputName.trim();
    const cleanCode = inputCode.trim();
    const cleanPin = inputPin.trim();

    if (!cleanName) {
      setLoginError('অনুগ্রহ করে আপনার নাম লিখুন।');
      return;
    }
    if (!/^\d{6}$/.test(cleanCode)) {
      setLoginError('ফোন কোডটি অবশ্যই ৬ সংখ্যার হতে হবে (যেমন: 123456)।');
      return;
    }
    if (!cleanPin || cleanPin.length < 4) {
      setLoginError('কমপক্ষে ৪ সংখ্যার সিকিউরিটি পিন (PIN) কোড দিন।');
      return;
    }

    setLoginError('');
    onRegisterUser(cleanName, cleanCode, cleanPin);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('mesh_user_code');
    localStorage.removeItem('mesh_user_pin');
    setIsLoggedIn(false);
  };

  const handleDialerKeyPress = (digit: string) => {
    if (dialerNumber.length < 6) {
      setDialerNumber((prev) => prev + digit);
    }
  };

  const handleDialerBackspace = () => {
    setDialerNumber((prev) => prev.slice(0, -1));
  };

  const handleDialerClear = () => {
    setDialerNumber('');
  };

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const callAudioCtxRef = useRef<AudioContext | null>(null);
  const callScriptNodeRef = useRef<ScriptProcessorNode | null>(null);

  // Live Microphone audio streaming during active call with WebAudio PCM Engine
  useEffect(() => {
    if (activeCall.isActive && !activeCall.isMuted) {
      navigator.mediaDevices?.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      }).then((stream) => {
        audioStreamRef.current = stream;

        // Set up WebAudio API PCM Audio Processor for pristine voice quality
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioCtx) {
            const ctx = new AudioCtx();
            callAudioCtxRef.current = ctx;
            const srcNode = ctx.createMediaStreamSource(stream);
            const scriptNode = ctx.createScriptProcessor(2048, 1, 1);
            callScriptNodeRef.current = scriptNode;

            let lastSendTime = 0;
            scriptNode.onaudioprocess = (e) => {
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
                    sampleRate: ctx.sampleRate || 44100,
                    senderName: inputName || myNodeId,
                  });
                }
              }
            };

            srcNode.connect(scriptNode);
            scriptNode.connect(ctx.destination);
          }
        } catch (pcmErr) {
          console.warn('PCM capture setup error:', pcmErr);
        }
      }).catch((err) => {
        console.warn('Microphone permission error:', err);
      });
    } else {
      if (callScriptNodeRef.current) {
        try { callScriptNodeRef.current.disconnect(); } catch (e) {}
        callScriptNodeRef.current = null;
      }
      if (callAudioCtxRef.current) {
        try { callAudioCtxRef.current.close(); } catch (e) {}
        callAudioCtxRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    }

    return () => {
      if (callScriptNodeRef.current) {
        try { callScriptNodeRef.current.disconnect(); } catch (e) {}
        callScriptNodeRef.current = null;
      }
      if (callAudioCtxRef.current) {
        try { callAudioCtxRef.current.close(); } catch (e) {}
        callAudioCtxRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }
    };
  }, [activeCall.isActive, activeCall.isMuted]);

  const handleStartCall = (targetCode: string, targetName?: string) => {
    const matchedNode = nodes.find((n) => n.id === targetCode);
    const matchedContact = contacts.find((c) => c.code === targetCode);

    const displayName =
      targetName ||
      matchedContact?.name ||
      matchedNode?.name ||
      `ইউজার (${targetCode})`;

    onSendCallSignal?.('INITIATE', targetCode, inputName || myNodeId);

    setActiveCall({
      isActive: true,
      targetCode,
      targetName: displayName,
      durationSec: 0,
      isMuted: false,
    });
  };

  const handleRejectOrCutCall = () => {
    if (activeCall.targetCode) {
      onSendCallSignal?.('END', activeCall.targetCode, inputName || myNodeId);
    }
    setActiveCall({
      isActive: false,
      targetCode: '',
      targetName: '',
      durationSec: 0,
      isMuted: false,
    });
  };

  const handleOpenSmsWithNumber = (targetCode: string) => {
    setChatTargetCode(targetCode);
    setActiveTab('CHAT');
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim()) return;
    if (!/^\d{6}$/.test(newContactCode.trim())) return;

    const newC: SavedContact = {
      id: Date.now().toString(),
      name: newContactName.trim(),
      code: newContactCode.trim(),
    };

    setContacts((prev) => [...prev.filter((c) => c.code !== newC.code), newC]);
    setNewContactName('');
    setNewContactCode('');
    setShowAddContactModal(false);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage(chatTargetCode, chatInput.trim());
    setChatInput('');
  };

  const handleQuickSms = (template: string) => {
    onSendMessage(chatTargetCode, template);
  };

  const selfNode = nodes.find((n) => n.id === myNodeId);
  const currentUserCode = localStorage.getItem('mesh_user_code') || myNodeId;
  const currentUserName = localStorage.getItem('mesh_user_name') || selfNode?.name || 'User';

  const relayLink = `${window.location.origin}?mode=relay`;
  const [copiedLink, setCopiedLink] = useState(false);

  const copyRelayLink = () => {
    navigator.clipboard.writeText(relayLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filtered contacts and nodes
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(contactSearchQuery.toLowerCase()) ||
      c.code.includes(contactSearchQuery)
  );

  const registeredUsersInMesh = nodes.filter(
    (n) => n.type === 'MOBILE_USER' && n.id !== currentUserCode
  );

  // IF NOT LOGGED IN - SHOW CLEAN 6-DIGIT CODE LOGIN / REGISTRATION CARD
  if (!isLoggedIn) {
    return (
      <div className="max-w-md mx-auto my-6 p-4 font-mono text-white">
        <div className="bg-[#14161B] border-2 border-[#00FF9C] p-6 shadow-[0_0_40px_rgba(0,255,156,0.2)] rounded space-y-6">
          <div className="text-center space-y-2 border-b border-[#2D3139] pb-4">
            <div className="w-16 h-16 bg-[#00FF9C]/10 border-2 border-[#00FF9C] rounded-full mx-auto flex items-center justify-center text-[#00FF9C] shadow-lg">
              <Smartphone className="w-8 h-8 animate-pulse" />
            </div>
            <h2 className="text-lg font-extrabold text-white uppercase tracking-wide">
              📱 অফ-গ্রিড মেস নেটওয়ার্ক
            </h2>
            <p className="text-xs text-[#8A909D]">
              ইউজার হিসেবে প্রবেশ করতে আপনার নাম এবং বরাদ্দকৃত ৬ সংখ্যার ইউনিক কোড দিন।
            </p>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {(loginError || authError) && (
              <div className="bg-rose-950/80 border border-rose-500 text-rose-200 text-xs p-3 rounded font-bold space-y-1">
                <div>⚠️ {loginError || authError}</div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#00FF9C] uppercase flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>আপনার নাম (Name):</span>
              </label>
              <input
                type="text"
                placeholder="যেমন: রহিম আহমেদ"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full bg-[#0E1014] border border-[#2D3139] focus:border-[#00FF9C] text-white px-3 py-2.5 text-sm rounded focus:outline-none font-bold"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#00FF9C] uppercase flex items-center gap-1.5">
                <Hash className="w-4 h-4" />
                <span>আপনার ৬ সংখ্যার ফোন নাম্বার / কোড:</span>
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="যেমন: 882910"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#0E1014] border border-[#2D3139] focus:border-[#00FF9C] text-[#00FF9C] tracking-widest text-center text-lg font-extrabold px-3 py-2.5 rounded focus:outline-none"
                required
              />
              <p className="text-[10px] text-[#8A909D]">
                * এই ৬ সংখ্যার কোডটি আপনার অনন্য ফোন নম্বর। কল বা মেসেজ গ্রহণের জন্য এটি ব্যবহৃত হবে।
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#00FF9C] uppercase flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>আপনার ৪ সংখ্যার সিকিউরিটি পিন (Security PIN):</span>
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="যেমন: 1234"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#0E1014] border border-[#2D3139] focus:border-[#00FF9C] text-[#00FF9C] tracking-widest text-center text-lg font-extrabold px-3 py-2.5 rounded focus:outline-none"
                required
              />
              <p className="text-[10px] text-[#8A909D]">
                🔒 পিন প্রোটেকশন: এই পিন কোডটি অন্য কেউ আপনার নম্বরটি ব্যবহারের চেষ্টা করলে বাধা দেবে।
              </p>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black font-extrabold text-sm uppercase flex items-center justify-center gap-2 rounded shadow-[0_0_20px_rgba(0,255,156,0.4)] transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>নেটওয়ার্কে সাইন ইন করুন</span>
            </button>
          </form>

          <div className="bg-[#0E1014] p-3 border border-[#2D3139] rounded text-[11px] text-[#8A909D] space-y-1">
            <span className="font-bold text-[#00FF9C] flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>নিরাপদ ও স্থায়ী ডেটা সুরক্ষা:</span>
            </span>
            <p>• আপনার রেজিস্টার্ড নম্বর ও পিন কোড সার্ভারে স্থায়ীভাবে সংরক্ষিত থাকবে।</p>
            <p>• সঠিক পিন কোড ছাড়া অন্য কেউ আপনার নাম্বারে লগইন করতে পারবে না।</p>
            <p>• সিম কার্ড বা সাধারণ মোবাইল নেটওয়ার্ক ছাড়াও মেস তরঙ্গে এটি কাজ করবে।</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 font-mono text-white p-2 sm:p-4">
      {/* Active User WhatsApp/Imo Style Clean Header */}
      <div className="bg-[#14161B] border border-[#2D3139] p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl rounded">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#00FF9C]/10 border-2 border-[#00FF9C] rounded-full flex items-center justify-center text-[#00FF9C] shadow-[0_0_15px_rgba(0,255,156,0.2)]">
            <Smartphone className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-[#00FF9C]/20 text-[#00FF9C] border border-[#00FF9C]/40 px-2 py-0.5 rounded font-extrabold uppercase">
                📱 সক্রিয় মেস একাউন্ট
              </span>
              <span className="text-xs text-[#00FF9C] font-extrabold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#00FF9C] animate-ping" />
                অনলাইন
              </span>
            </div>
            <h2 className="text-base font-extrabold text-white mt-1">
              {currentUserName}{' '}
              <span className="text-[#00FF9C] font-mono tracking-wider bg-[#00FF9C]/10 px-2 py-0.5 border border-[#00FF9C]/30 rounded text-sm">
                [{currentUserCode}]
              </span>
            </h2>
          </div>
        </div>

        {/* Clean Profile & Logout Actions */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-[#00FF9C] bg-[#0E1014] border border-[#00FF9C]/30 px-2.5 py-1 rounded">
            <Lock className="w-3.5 h-3.5" />
            <span>পিন সুরক্ষিত</span>
          </div>

          <button
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/50 text-xs font-bold uppercase flex items-center justify-center gap-1.5 cursor-pointer rounded transition-all"
            title="লগআউট করে অ্যাকাউন্ট পরিবর্তন করুন"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>লগআউট</span>
          </button>
        </div>
      </div>

      {/* Main Mode Navigation (Keypad / Phonebook / Chat) */}
      <div className="grid grid-cols-3 gap-2 bg-[#0E1014] p-1.5 border border-[#2D3139] rounded">
        <button
          onClick={() => setActiveTab('DIALER')}
          className={`py-2.5 px-2 font-extrabold text-xs sm:text-sm uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer rounded ${
            activeTab === 'DIALER'
              ? 'bg-[#00FF9C] text-black shadow-[0_0_15px_rgba(0,255,156,0.3)]'
              : 'bg-[#14161B] text-[#8A909D] hover:text-white'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>📞 কিপ্যাড ডায়ালার</span>
        </button>

        <button
          onClick={() => setActiveTab('CONTACTS')}
          className={`py-2.5 px-2 font-extrabold text-xs sm:text-sm uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer rounded ${
            activeTab === 'CONTACTS'
              ? 'bg-[#00FF9C] text-black shadow-[0_0_15px_rgba(0,255,156,0.3)]'
              : 'bg-[#14161B] text-[#8A909D] hover:text-white'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>📖 ফোনবুক ({contacts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('CHAT')}
          className={`py-2.5 px-2 font-extrabold text-xs sm:text-sm uppercase flex items-center justify-center gap-1.5 transition-all cursor-pointer rounded ${
            activeTab === 'CHAT'
              ? 'bg-[#00FF9C] text-black shadow-[0_0_15px_rgba(0,255,156,0.3)]'
              : 'bg-[#14161B] text-[#8A909D] hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>💬 এসএমএস টেক্সট</span>
        </button>
      </div>

      {/* INCOMING VOICE CALL RINGING MODAL */}
      {incomingCall && !activeCall.isActive && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#14161B] border-2 border-[#00FF9C] rounded-lg p-6 max-w-md w-full shadow-[0_0_50px_rgba(0,255,156,0.4)] text-center space-y-4">
            <div className="w-16 h-16 bg-[#00FF9C]/20 border-2 border-[#00FF9C] rounded-full flex items-center justify-center mx-auto text-[#00FF9C] animate-pulse">
              <PhoneCall className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <span className="text-xs bg-[#00FF9C] text-black font-extrabold px-2.5 py-0.5 rounded uppercase tracking-wider">
                📞 ইনকামিং অফ-গ্রিড ভয়েস কল...
              </span>
              <h3 className="text-2xl font-extrabold text-white mt-2">
                {incomingCall.callerName}
              </h3>
              <p className="text-sm text-[#00FF9C] font-mono font-bold mt-1">
                ৬-ডিজিটের ফোন কোড: [{incomingCall.callerId}]
              </p>
              <p className="text-xs text-[#8A909D] mt-1">
                আপনাকে সরাসরি মেস ভয়েস কল দিচ্ছেন। কল রিসিভ করতে সবুজ বাটনে চাপুন।
              </p>
            </div>

            <div className="flex gap-4 pt-2">
              <button
                onClick={() => {
                  onSendCallSignal?.('ACCEPT', incomingCall.callerId, inputName || myNodeId);
                  setActiveCall({
                    isActive: true,
                    targetCode: incomingCall.callerId,
                    targetName: incomingCall.callerName,
                    durationSec: 0,
                    isMuted: false,
                  });
                }}
                className="flex-1 py-3.5 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black font-extrabold text-sm uppercase rounded flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all"
              >
                <Phone className="w-5 h-5" />
                <span>কল রিসিভ করুন</span>
              </button>

              <button
                onClick={() => {
                  onSendCallSignal?.('REJECT', incomingCall.callerId, inputName || myNodeId);
                }}
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm uppercase rounded flex items-center justify-center gap-2 cursor-pointer shadow-xl transition-all"
              >
                <PhoneOff className="w-5 h-5" />
                <span>রিজেক্ট করুন</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE VOICE CALL BANNER */}
      {activeCall.isActive && (
        <div className="bg-rose-950/90 border-2 border-rose-500 p-5 rounded shadow-[0_0_35px_rgba(244,63,94,0.4)] space-y-4 animate-pulse">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-rose-600 text-white rounded-full flex items-center justify-center shrink-0">
                <PhoneCall className="w-6 h-6 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-rose-500 text-white font-extrabold px-2 py-0.5 rounded uppercase">
                    🔴 ডাইরেক্ট ভয়েস কল রানিং
                  </span>
                  <span className="text-xs text-rose-200 font-mono font-bold">
                    ⏱️ {Math.floor(activeCall.durationSec / 60)}:
                    {(activeCall.durationSec % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white mt-1">
                  📞 {activeCall.targetName} [{activeCall.targetCode}] এর সাথে কল চলছে
                </h3>
                <p className="text-xs text-rose-200/80">
                  সরাসরি কথা বলুন - অফ-গ্রিড ভয়েস স্ট্রিমিং সক্রিয়।
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 font-bold flex items-center gap-1">
                    ⚡ ট্রান্সপোর্ট: Wi-Fi Direct Mesh (হাই-স্পীড কল | 100 Mbps)
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-400 text-emerald-300 font-bold flex items-center gap-1">
                    📡 ব্যাকআপ: Bluetooth 5.3 BLE (150m Range)
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={() =>
                  setActiveCall((prev) => ({ ...prev, isMuted: !prev.isMuted }))
                }
                className={`flex-1 sm:flex-none px-4 py-2.5 font-bold text-xs uppercase flex items-center justify-center gap-2 border transition-all cursor-pointer rounded ${
                  activeCall.isMuted
                    ? 'bg-amber-500 text-black border-amber-400'
                    : 'bg-slate-800 text-white border-slate-600'
                }`}
              >
                {activeCall.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-[#00FF9C]" />}
                <span>{activeCall.isMuted ? 'মাইক মিউট' : 'মাইক অন'}</span>
              </button>

              <button
                onClick={handleRejectOrCutCall}
                className="flex-1 sm:flex-none px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white border border-rose-300 font-extrabold text-xs uppercase flex items-center justify-center gap-2 shadow-xl transition-all cursor-pointer rounded"
              >
                <PhoneOff className="w-4 h-4" />
                <span>❌ কল কেটে দিন (Cut Call)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: KEYPAD DIALER */}
      {activeTab === 'DIALER' && (
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-5 rounded max-w-lg mx-auto">
          {/* Display screen for typed 6-digit code */}
          <div className="bg-[#0E1014] border-2 border-[#00FF9C]/60 p-4 rounded text-center space-y-1 shadow-inner">
            <span className="text-[10px] text-[#8A909D] uppercase tracking-widest font-bold">
              ৬ সংখ্যার ফোন কোড লিখুন:
            </span>
            <div className="text-3xl font-extrabold text-[#00FF9C] tracking-widest h-10 flex items-center justify-center">
              {dialerNumber || <span className="text-slate-700">______</span>}
            </div>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleDialerKeyPress(digit)}
                className="py-3.5 bg-[#0E1014] hover:bg-[#1A1D24] active:bg-[#00FF9C] active:text-black border border-[#2D3139] hover:border-[#00FF9C] text-xl font-extrabold text-white rounded transition-all cursor-pointer shadow-md"
              >
                {digit}
              </button>
            ))}
          </div>

          {/* Controls: Backspace, Clear, Call, SMS */}
          <div className="space-y-3 pt-2">
            <div className="flex gap-2">
              <button
                onClick={handleDialerBackspace}
                disabled={!dialerNumber}
                className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-600 text-xs font-bold uppercase flex items-center justify-center gap-1.5 rounded cursor-pointer"
              >
                <Delete className="w-4 h-4" />
                <span>মুছুন (Delete)</span>
              </button>
              <button
                onClick={handleDialerClear}
                disabled={!dialerNumber}
                className="px-4 py-2 bg-rose-950 hover:bg-rose-900 disabled:opacity-40 text-rose-300 border border-rose-800 text-xs font-bold uppercase rounded cursor-pointer"
              >
                ক্লিয়ার
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleStartCall(dialerNumber)}
                disabled={dialerNumber.length !== 6}
                className="py-3 bg-[#00FF9C] hover:bg-[#00FF9C]/90 disabled:bg-slate-800 disabled:text-slate-600 text-black font-extrabold text-sm uppercase flex items-center justify-center gap-2 rounded shadow-[0_0_15px_rgba(0,255,156,0.3)] transition-all cursor-pointer"
              >
                <PhoneCall className="w-5 h-5" />
                <span>📞 কল দিন</span>
              </button>

              <button
                onClick={() => handleOpenSmsWithNumber(dialerNumber)}
                disabled={dialerNumber.length !== 6}
                className="py-3 bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-600 text-black font-extrabold text-sm uppercase flex items-center justify-center gap-2 rounded shadow-md transition-all cursor-pointer"
              >
                <MessageSquare className="w-5 h-5" />
                <span>💬 এসএমএস</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PHONEBOOK & CONTACTS */}
      {activeTab === 'CONTACTS' && (
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-4 rounded">
          {/* Top Bar with Search & Add Contact Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-[#2D3139] pb-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8A909D]" />
              <input
                type="text"
                placeholder="কন্টাক্ট সার্চ করুন..."
                value={contactSearchQuery}
                onChange={(e) => setContactSearchQuery(e.target.value)}
                className="w-full bg-[#0E1014] border border-[#2D3139] focus:border-[#00FF9C] text-white pl-9 pr-3 py-1.5 text-xs rounded focus:outline-none"
              />
            </div>

            <button
              onClick={() => setShowAddContactModal(true)}
              className="w-full sm:w-auto px-4 py-2 bg-[#00FF9C] text-black font-extrabold text-xs uppercase flex items-center justify-center gap-1.5 rounded hover:bg-[#00FF9C]/90 cursor-pointer shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              <span>নতুন কন্টাক্ট সেভ করুন</span>
            </button>
          </div>

          {/* Add Contact Modal Form */}
          {showAddContactModal && (
            <form
              onSubmit={handleAddContact}
              className="bg-[#0E1014] border-2 border-[#00FF9C] p-4 rounded space-y-3"
            >
              <h4 className="text-xs font-extrabold text-[#00FF9C] uppercase flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                <span>নতুন কন্টাক্ট যোগ করুন:</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="নাম (যেমন: সাব্বির আহমেদ)"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                  className="bg-[#14161B] border border-[#2D3139] focus:border-[#00FF9C] text-white px-3 py-2 text-xs rounded focus:outline-none"
                  required
                />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="৬ সংখ্যার ফোন নম্বর (যেমন: 654321)"
                  value={newContactCode}
                  onChange={(e) => setNewContactCode(e.target.value.replace(/\D/g, ''))}
                  className="bg-[#14161B] border border-[#2D3139] focus:border-[#00FF9C] text-[#00FF9C] px-3 py-2 text-xs rounded font-bold tracking-widest focus:outline-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddContactModal(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#00FF9C] text-black font-extrabold text-xs uppercase rounded cursor-pointer"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          )}

          {/* Saved Contacts List */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-[#8A909D] uppercase tracking-wider">
              📖 সেভ করা কন্টাক্টস ({filteredContacts.length}):
            </h4>

            {filteredContacts.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">কোনো কন্টাক্ট পাওয়া যায়নি।</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredContacts.map((contact) => {
                  const isOnlineInMesh = nodes.some(
                    (n) => n.id === contact.code && n.status === 'ONLINE'
                  );

                  return (
                    <div
                      key={contact.id}
                      className="bg-[#0E1014] border border-[#2D3139] hover:border-[#00FF9C] p-3.5 rounded flex items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#14161B] border border-[#2D3139] rounded-full flex items-center justify-center text-[#00FF9C] font-extrabold text-sm">
                          {contact.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="font-extrabold text-sm text-white">{contact.name}</h5>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 font-bold rounded border ${
                                isOnlineInMesh
                                  ? 'bg-[#00FF9C]/10 text-[#00FF9C] border-[#00FF9C]/30'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}
                            >
                              {isOnlineInMesh ? '🟢 অনলাইন' : '⚪ অফলাইন'}
                            </span>
                          </div>
                          <span className="text-xs font-mono text-[#00FF9C] font-bold">
                            📞 {contact.code}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartCall(contact.code, contact.name)}
                          className="p-2 bg-[#00FF9C] hover:bg-[#00FF9C]/90 text-black font-extrabold rounded cursor-pointer shadow"
                          title="কল দিন"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenSmsWithNumber(contact.code)}
                          className="p-2 bg-cyan-500 hover:bg-cyan-400 text-black font-extrabold rounded cursor-pointer shadow"
                          title="এসএমএস পাঠান"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="p-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded cursor-pointer"
                          title="ডিলিট"
                        >
                          <Delete className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Registered Online Mesh Users Directory */}
          <div className="space-y-3 pt-4 border-t border-[#2D3139]">
            <h4 className="text-xs font-extrabold text-[#00FF9C] uppercase tracking-wider flex items-center justify-between">
              <span>🌐 নেটওয়ার্কে অনলাইন থাকা অন্যান্য সকল ইউজার ({registeredUsersInMesh.length}):</span>
              <span className="text-[10px] text-[#8A909D] font-normal">অফ-গ্রিড মেশ অটো-আবিষ্কার</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {registeredUsersInMesh.map((node) => (
                <div
                  key={node.id}
                  className="bg-[#0E1014] border border-[#2D3139] p-3 rounded flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-[#14161B] border border-[#00FF9C]/40 rounded-full flex items-center justify-center text-[#00FF9C] text-xs font-bold">
                      {node.name.charAt(0)}
                    </div>
                    <div>
                      <h5 className="font-bold text-xs text-white">{node.name}</h5>
                      <span className="text-[11px] font-mono text-[#00FF9C]">
                        কোড: {node.id}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartCall(node.id, node.name)}
                      className="px-2.5 py-1 bg-[#00FF9C] text-black font-extrabold text-[11px] uppercase rounded cursor-pointer"
                    >
                      📞 কল
                    </button>
                    <button
                      onClick={() => handleOpenSmsWithNumber(node.id)}
                      className="px-2.5 py-1 bg-cyan-500 text-black font-extrabold text-[11px] uppercase rounded cursor-pointer"
                    >
                      💬 চ্যাট
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SMS & CHAT MESSAGING */}
      {activeTab === 'CHAT' && (
        <div className="bg-[#14161B] border border-[#2D3139] p-4 space-y-4 rounded">
          {/* Target Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 bg-[#0E1014] p-3 border border-[#2D3139] rounded">
            <label className="text-xs font-bold text-[#00FF9C] uppercase flex items-center gap-1.5">
              <User className="w-4 h-4" />
              <span>প্রাপক নির্বাচন করুন (Recipient):</span>
            </label>
            <select
              value={chatTargetCode}
              onChange={(e) => setChatTargetCode(e.target.value)}
              className="bg-[#14161B] text-[#00FF9C] border border-[#00FF9C]/60 px-3 py-1.5 text-xs font-bold uppercase focus:outline-none focus:border-[#00FF9C] cursor-pointer w-full sm:w-auto rounded"
            >
              <option value="BROADCAST">📢 সকল নোডে সাধারণ এসএমএস (Broadcast All)</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.code}>
                  👤 {c.name} ({c.code})
                </option>
              ))}
              {registeredUsersInMesh.map((node) => (
                <option key={node.id} value={node.id}>
                  📱 {node.name} ({node.id})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Template Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-[#8A909D] uppercase font-bold">
              ⚡ দ্রুত এসএমএস টেমপ্লেট:
            </span>
            <div className="flex flex-wrap gap-2">
              {[
                'আমি ভালো আছি 👍',
                'আমাকে কল করো 📞',
                'জরুরী সাহায্য দরকার 🚨',
                'আমি লোকেশনে পৌঁছে গেছি 📍',
                'তুমি কোথায় আছো? 🗺️',
              ].map((template) => (
                <button
                  key={template}
                  onClick={() => handleQuickSms(template)}
                  className="px-2.5 py-1 bg-[#0E1014] hover:bg-[#1A1D24] border border-[#2D3139] hover:border-[#00FF9C] text-xs text-[#00FF9C] rounded transition-all cursor-pointer"
                >
                  {template}
                </button>
              ))}
            </div>
          </div>

          {/* Message List */}
          <div className="bg-[#0E1014] border border-[#2D3139] h-72 overflow-y-auto p-3 space-y-3 font-mono rounded">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#8A909D] text-xs">
                <MessageSquare className="w-8 h-8 mb-2 opacity-50" />
                <span>কোনো এসএমএস বা মেসেজ নেই। নিচে টাইপ করে পাঠান।</span>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-2.5 rounded border text-xs ${
                      msg.isSelf
                        ? 'bg-[#00FF9C]/10 border-[#00FF9C]/40 text-white'
                        : 'bg-[#14161B] border-[#2D3139] text-[#E1E4EA]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 text-[10px] text-[#8A909D] border-b border-white/10 pb-1 mb-1">
                      <span className="font-bold text-[#00FF9C]">{msg.senderName}</span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-sans">{msg.content}</p>
                    <div className="mt-1 flex items-center justify-end text-[9px] text-[#00FF9C]">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      <span>E2EE AES-256</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              placeholder="মেসেজ বা এসএমএস টাইপ করুন..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 bg-[#0E1014] border border-[#2D3139] focus:border-[#00FF9C] text-white px-3 py-2 text-xs focus:outline-none rounded"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-[#00FF9C] text-black font-extrabold text-xs uppercase flex items-center gap-1.5 hover:bg-[#00FF9C]/90 rounded cursor-pointer shadow"
            >
              <Send className="w-4 h-4" />
              <span>পাঠান</span>
            </button>
          </form>
        </div>
      )}

      {/* Clean Off-Grid Footer Box for Simple Users */}
      <div className="bg-[#0E1014] border border-[#2D3139] p-3 rounded flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[#8A909D]">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#00FF9C]" />
          <span>
            অফ-গ্রিড মেস সিকিউর নেটওয়ার্ক • কোনো ইন্টারনেট বা প্রসেসিং চার্জ নেই।
          </span>
        </div>
        <span className="text-[11px] text-[#00FF9C] font-bold flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-[#00FF9C]" />
          নিরাপদ এন্ড-টু-এন্ড এনক্রিপ্টেড
        </span>
      </div>
    </div>
  );
};
