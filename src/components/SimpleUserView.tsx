import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  RefreshCw,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Globe,
  Bell,
  Shield,
  Slash,
  Disc,
  Cloud,
  Info,
  Volume2,
  VolumeX,
  Bluetooth,
  Grid,
  Video,
  Pause,
  Play,
  Paperclip,
  Image as ImageIcon,
  Smile,
  QrCode,
  ChevronRight,
  ChevronDown,
  CheckCheck,
  X,
  Home as HomeIcon,
  Sparkles,
  Share2,
} from 'lucide-react';
import { MeshNode, ChatMessage, LanguageMode } from '../types/mesh';
import { agoraVoiceEngine } from '../lib/agoraCallEngine';

interface SavedContact {
  id: string;
  name: string;
  code: string;
  avatar?: string;
  isFavorite?: boolean;
}

interface RecentCallLog {
  id: string;
  name: string;
  code: string;
  type: 'INCOMING' | 'OUTGOING' | 'MISSED';
  time: string;
  avatar?: string;
}

interface ConversationItem {
  id: string;
  name: string;
  code: string;
  lastMsg: string;
  time: string;
  unreadCount?: number;
  avatar?: string;
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

// Default high quality avatar placeholders
const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&auto=format&fit=crop&q=80',
];

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

  // Main Bottom Navigation Tabs: HOME | CALLS | CONTACTS | MESSAGES | SETTINGS
  const [activeTab, setActiveTab] = useState<'HOME' | 'CALLS' | 'CONTACTS' | 'MESSAGES' | 'SETTINGS'>('HOME');

  // UI Settings
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('mesh_dark_mode') === 'true';
  });
  const [currentLang, setCurrentLang] = useState<'BN' | 'EN'>('BN');
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(true);

  // Dialer state
  const [dialerNumber, setDialerNumber] = useState<string>('');

  // Contacts state
  const [contacts, setContacts] = useState<SavedContact[]>(() => {
    const saved = localStorage.getItem('mesh_saved_contacts');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [newContactName, setNewContactName] = useState<string>('');
  const [newContactCode, setNewContactCode] = useState<string>('');
  const [showAddContactModal, setShowAddContactModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Recent Calls log state
  const [recentCalls, setRecentCalls] = useState<RecentCallLog[]>(() => {
    const saved = localStorage.getItem('mesh_recent_calls');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('mesh_recent_calls', JSON.stringify(recentCalls));
  }, [recentCalls]);

  // Messages / Conversations list
  const [selectedConversationCode, setSelectedConversationCode] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState<string>('');

  // Active Call state
  const [activeCall, setActiveCall] = useState<{
    isActive: boolean;
    targetCode: string;
    targetName: string;
    durationSec: number;
    isMuted: boolean;
    isSpeaker: boolean;
    isBluetooth: boolean;
    isHold: boolean;
    isRecording: boolean;
    isVideo: boolean;
    showKeypad: boolean;
    avatar?: string;
  }>({
    isActive: false,
    targetCode: '',
    targetName: '',
    durationSec: 0,
    isMuted: false,
    isSpeaker: false,
    isBluetooth: false,
    isHold: false,
    isRecording: false,
    isVideo: false,
    showKeypad: false,
  });

  const timerRef = useRef<any>(null);

  // Calling Engine Mode (1-Click Switcher between Agora HD & Mesh PCM)
  const [callingEngineMode, setCallingEngineMode] = useState<'AGORA' | 'MESH_PCM'>('AGORA');
  const [agoraAppId, setAgoraAppId] = useState<string>('8e48363cdc6c4fc696be606b8f3d6f64');

  const fetchAgoraConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/agora/config');
      const data = await res.json();
      if (data && data.success) {
        if (data.appId) setAgoraAppId(data.appId);
        if (data.mode) setCallingEngineMode(data.mode);
      }
    } catch (e) {
      console.error('Error fetching Agora config in user view:', e);
    }
  }, []);

  useEffect(() => {
    fetchAgoraConfig();
  }, [fetchAgoraConfig]);

  // Save contacts & dark mode
  useEffect(() => {
    localStorage.setItem('mesh_saved_contacts', JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    localStorage.setItem('mesh_dark_mode', isDarkMode ? 'true' : 'false');
  }, [isDarkMode]);

  // DB Users Sync
  const [isSyncingDb, setIsSyncingDb] = useState<boolean>(false);
  const [dbUsersCount, setDbUsersCount] = useState<number>(0);

  const fetchDbUsers = useCallback(async () => {
    setIsSyncingDb(true);
    try {
      const res = await fetch('/api/db/users');
      const data = await res.json();
      if (data && data.users) {
        const dbUsersMap = data.users;
        setDbUsersCount(Object.keys(dbUsersMap).length);

        setContacts((prevContacts) => {
          const updated = [...prevContacts];
          Object.values(dbUsersMap).forEach((u: any, idx: number) => {
            if (u.code && !updated.some((c) => c.code === u.code)) {
              updated.push({
                id: `db-${u.code}`,
                name: u.name || `User ${u.code}`,
                code: u.code,
                avatar: DEFAULT_AVATARS[idx % DEFAULT_AVATARS.length],
              });
            }
          });
          return updated;
        });
      }
    } catch (e) {
      console.error('Error fetching DB users:', e);
    } finally {
      setIsSyncingDb(false);
    }
  }, []);

  useEffect(() => {
    fetchDbUsers();
  }, [fetchDbUsers]);

  // Ringtone Synthesizer Effect for Incoming Calls
  useEffect(() => {
    if (incomingCall && !activeCall.isActive) {
      let audioCtx: AudioContext | null = null;
      let intervalId: any = null;
      let isStopped = false;

      const triggerRingtonePulse = () => {
        if (isStopped) return;
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContextClass) return;
          if (!audioCtx || audioCtx.state === 'closed') {
            audioCtx = new AudioContextClass();
          }

          if (audioCtx.state === 'suspended') {
            audioCtx.resume();
          }

          const osc1 = audioCtx.createOscillator();
          const osc2 = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();

          osc1.type = 'sine';
          osc2.type = 'sine';
          osc1.frequency.setValueAtTime(440, audioCtx.currentTime);
          osc2.frequency.setValueAtTime(480, audioCtx.currentTime);

          gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
          gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 0.05);
          gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime + 1.2);
          gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);

          osc1.connect(gainNode);
          osc2.connect(gainNode);
          gainNode.connect(audioCtx.destination);

          osc1.start();
          osc2.start();
          osc1.stop(audioCtx.currentTime + 1.5);
          osc2.stop(audioCtx.currentTime + 1.5);
        } catch (err) {
          console.error('Ringtone sound error:', err);
        }
      };

      triggerRingtonePulse();
      intervalId = setInterval(triggerRingtonePulse, 2400);

      return () => {
        isStopped = true;
        if (intervalId) clearInterval(intervalId);
        if (audioCtx) {
          try { audioCtx.close(); } catch (e) {}
        }
      };
    }
  }, [incomingCall, activeCall.isActive]);

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
    if (dialerNumber.length < 12) {
      setDialerNumber((prev) => prev + digit);
    }
  };

  const handleDialerBackspace = () => {
    setDialerNumber((prev) => prev.slice(0, -1));
  };

  const handleStartCall = (targetCode: string, targetName?: string) => {
    const cleanCode = targetCode.trim();
    if (!cleanCode) return;

    const matchedContact = contacts.find((c) => c.code === cleanCode);
    const finalName = targetName || matchedContact?.name || `Caller ${cleanCode}`;
    const avatar = matchedContact?.avatar || DEFAULT_AVATARS[0];

    onSendCallSignal?.('INITIATE', cleanCode, inputName || myNodeId);

    if (callingEngineMode === 'AGORA') {
      const channelName = `banglacall_${[inputCode || myNodeId, cleanCode].sort().join('_')}`;
      agoraVoiceEngine.joinAudioChannel(agoraAppId, channelName, inputCode || myNodeId);
    }

    setActiveCall({
      isActive: true,
      targetCode: cleanCode,
      targetName: finalName,
      durationSec: 0,
      isMuted: false,
      isSpeaker: false,
      isBluetooth: false,
      isHold: false,
      isRecording: false,
      isVideo: false,
      showKeypad: false,
      avatar,
    });

    // Add to recent calls
    setRecentCalls((prev) => [
      {
        id: `rc-${Date.now()}`,
        name: finalName,
        code: cleanCode,
        type: 'OUTGOING',
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        avatar,
      },
      ...prev,
    ]);
  };

  const handleRejectOrCutCall = () => {
    if (activeCall.targetCode) {
      onSendCallSignal?.('END', activeCall.targetCode, inputName || myNodeId);
    }
    if (callingEngineMode === 'AGORA') {
      agoraVoiceEngine.leaveAudioChannel();
    }
    setActiveCall({
      isActive: false,
      targetCode: '',
      targetName: '',
      durationSec: 0,
      isMuted: false,
      isSpeaker: false,
      isBluetooth: false,
      isHold: false,
      isRecording: false,
      isVideo: false,
      showKeypad: false,
    });
  };

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactName.trim() || !newContactCode.trim()) return;

    const newContact: SavedContact = {
      id: `c-${Date.now()}`,
      name: newContactName.trim(),
      code: newContactCode.trim(),
      avatar: DEFAULT_AVATARS[contacts.length % DEFAULT_AVATARS.length],
      isFavorite: true,
    };

    setContacts((prev) => [...prev, newContact]);
    setNewContactName('');
    setNewContactCode('');
    setShowAddContactModal(false);
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const handleOpenSmsWithNumber = (code: string) => {
    setSelectedConversationCode(code);
    setActiveTab('MESSAGES');
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedConversationCode) return;
    onSendMessage(selectedConversationCode, chatInput.trim());
    setChatInput('');
  };

  // Helper formatting for call timer
  const formatTimer = (secs: number) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const currentUserName = inputName || 'Mesh User';
  const currentUserCode = inputCode || '123456';

  const registeredUsersInMesh = nodes.filter(
    (n) => n.id !== myNodeId && n.id !== inputCode
  );

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.includes(searchQuery)
  );

  // Dynamic conversation items derived from actual messages and contacts
  const conversationsList: ConversationItem[] = React.useMemo(() => {
    const convMap: Record<
      string,
      { lastMsg: string; time: string; timestamp: number; unreadCount: number; name: string; avatar?: string }
    > = {};

    messages.forEach((m) => {
      const partnerCode = m.isSelf ? m.targetId : m.senderId;
      if (!partnerCode || partnerCode === 'BROADCAST') return;

      const matchedContact = contacts.find((c) => c.code === partnerCode);
      const name = m.isSelf
        ? matchedContact?.name || `User ${partnerCode}`
        : m.senderName || matchedContact?.name || `User ${partnerCode}`;

      const charCodeSum = partnerCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
      const avatar =
        matchedContact?.avatar || DEFAULT_AVATARS[charCodeSum % DEFAULT_AVATARS.length];
      const timeStr = new Date(m.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      if (!convMap[partnerCode] || m.timestamp > convMap[partnerCode].timestamp) {
        convMap[partnerCode] = {
          lastMsg: m.type === 'VOICE' ? '🎙️ ভয়েস মেসেজ' : m.content,
          time: timeStr,
          timestamp: m.timestamp,
          unreadCount: m.isSelf ? 0 : 1,
          name,
          avatar,
        };
      }
    });

    return Object.entries(convMap).map(([code, val]) => ({
      id: `conv-${code}`,
      name: val.name,
      code,
      lastMsg: val.lastMsg,
      time: val.time,
      unreadCount: val.unreadCount,
      avatar: val.avatar,
    }));
  }, [messages, contacts]);

  // Colors based on Light / Dark mode
  const bgClass = isDarkMode ? 'bg-[#0f1117] text-white' : 'bg-[#f4f5fa] text-slate-900';
  const cardBgClass = isDarkMode ? 'bg-[#1a1d26] border-[#2a2e3d]' : 'bg-white border-slate-200 shadow-sm';
  const subTextClass = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  // LOGIN SCREEN
  if (!isLoggedIn) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-4 font-sans ${bgClass}`}>
        <div className={`w-full max-w-md p-6 rounded-2xl border ${cardBgClass} space-y-6 shadow-2xl`}>
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-600/10 border-2 border-blue-500 rounded-2xl flex items-center justify-center mx-auto text-blue-600">
              <PhoneCall className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">BanglaCall HD</h1>
            <p className="text-xs text-slate-500">
              অফ-গ্রিড মেস তরঙ্গ ও আগোরা ভয়েস নেটওয়ার্কে সাইন ইন করুন
            </p>
          </div>

          {loginError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs rounded-xl font-medium">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">আপনার নাম:</label>
              <input
                type="text"
                placeholder="যেমন: সাব্বির আহমেদ"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                ৬ সংখ্যার ইউনিক ফোন নম্বর কোড:
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="যেমন: 123456"
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold tracking-widest text-center text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                ৪ সংখ্যার সিকিউরিটি পিন:
              </label>
              <input
                type="password"
                maxLength={4}
                placeholder="যেমন: 1234"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-lg font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2 text-sm"
            >
              <CheckCircle2 className="w-5 h-5" />
              <span>নেটওয়ার্কে প্রবেশ করুন</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen font-sans pb-24 ${bgClass}`}>
      {/* Mobile Frame Container */}
      <div className="max-w-md mx-auto min-h-screen flex flex-col justify-between relative shadow-2xl bg-inherit">
        
        {/* iOS Dynamic Island & Status Bar Top */}
        <div className="pt-3 px-6 pb-2 flex items-center justify-between text-xs font-bold opacity-80 select-none">
          <span>9:41</span>
          <div className="w-24 h-5 bg-black rounded-full flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px]">5G</span>
            <div className="w-5 h-2.5 border border-current rounded-xs p-0.5 flex items-center">
              <div className="w-full h-full bg-current rounded-2xs" />
            </div>
          </div>
        </div>

        {/* Global Engine Switcher Banner */}
        <div className="px-4 py-1.5">
          <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-blue-500 animate-pulse" />
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {callingEngineMode === 'AGORA' ? 'AGORA HD VOICE ACTIVE' : 'MESH PCM OFFLINE'}
              </span>
            </div>
            <button
              onClick={() => setCallingEngineMode((prev) => (prev === 'AGORA' ? 'MESH_PCM' : 'AGORA'))}
              className="px-2.5 py-1 bg-blue-600 text-white text-[10px] font-bold rounded-lg shadow-sm hover:bg-blue-700 cursor-pointer"
            >
              {callingEngineMode === 'AGORA' ? 'Switch to Mesh PCM' : 'Switch to Agora'}
            </button>
          </div>
        </div>

        {/* MAIN BODY CONTENT BASED ON ACTIVE TAB */}
        <div className="flex-1 px-4 py-2 space-y-4 overflow-y-auto">

          {/* TAB 1: HOME (Image 6) */}
          {activeTab === 'HOME' && (
            <div className="space-y-5">
              {/* Top Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search for contacts"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-200/60 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              {/* Favorite Contacts Horizontal Row (Image 6) */}
              <div className="space-y-2">
                <h3 className="text-base font-bold tracking-tight">Favorite Contacts</h3>
                {contacts.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs ${subTextClass} ${cardBgClass}`}>
                    কোনো প্রিয় কন্টাক্ট সেভ করা নেই। "Contacts" ট্যাবে গিয়ে নতুন নম্বর যোগ করুন।
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        onClick={() => handleStartCall(contact.code, contact.name)}
                        className={`min-w-[90px] p-3 rounded-2xl border text-center flex flex-col items-center gap-1.5 cursor-pointer hover:scale-105 transition-all ${cardBgClass}`}
                      >
                        <div className="relative">
                          <img
                            src={contact.avatar || DEFAULT_AVATARS[0]}
                            alt={contact.name}
                            className="w-14 h-14 rounded-full object-cover border-2 border-blue-500/30"
                          />
                          <span className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white absolute bottom-0 right-0" />
                        </div>
                        <span className="font-bold text-xs truncate max-w-[70px]">{contact.name}</span>
                        <span className="text-[10px] text-slate-400">Contacts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Calls Section (Image 6) */}
              <div className="space-y-2">
                <h3 className="text-base font-bold tracking-tight">Recent Calls</h3>
                {recentCalls.length === 0 ? (
                  <div className={`p-4 rounded-2xl border text-center text-xs ${subTextClass} ${cardBgClass}`}>
                    কোনো সাম্প্রতিক কল রেকর্ড নেই।
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentCalls.map((log) => (
                      <div
                        key={log.id}
                        onClick={() => handleStartCall(log.code, log.name)}
                        className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:opacity-90 transition-all ${cardBgClass}`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center text-white ${
                              log.type === 'INCOMING'
                                ? 'bg-emerald-600'
                                : log.type === 'MISSED'
                                ? 'bg-rose-600'
                                : 'bg-blue-600'
                            }`}
                          >
                            <PhoneCall className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm">{log.name}</h4>
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Phone className="w-3 h-3" /> Call
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-slate-400">{log.time}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CALLS / KEYPAD DIALER (Image 5) */}
          {activeTab === 'CALLS' && (
            <div className="space-y-5 flex flex-col justify-between h-full pt-2">
              {/* Top Quick Actions */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowAddContactModal(true)}
                  className={`px-4 py-2.5 rounded-2xl border font-semibold text-xs flex items-center gap-2 cursor-pointer ${cardBgClass}`}
                >
                  <UserPlus className="w-4 h-4 text-blue-500" />
                  <span>Add Contact</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setDialerNumber(text.replace(/\D/g, '').slice(0, 10));
                    } catch (e) {}
                  }}
                  className={`px-4 py-2.5 rounded-2xl border font-semibold text-xs flex items-center gap-2 cursor-pointer ${cardBgClass}`}
                >
                  <Copy className="w-4 h-4 text-blue-500" />
                  <span>Paste Number</span>
                </button>
              </div>

              {/* Number Display Screen */}
              <div className="text-center py-4">
                <div className="text-4xl font-extrabold tracking-widest min-h-[48px] flex items-center justify-center text-blue-600 dark:text-blue-400">
                  {dialerNumber || <span className="text-slate-300 dark:text-slate-700">______</span>}
                </div>
              </div>

              {/* Clean Keypad Grid */}
              <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto w-full">
                {[
                  { num: '1', sub: '' },
                  { num: '2', sub: 'ABC' },
                  { num: '3', sub: 'DEF' },
                  { num: '4', sub: 'GHI' },
                  { num: '5', sub: 'JKL' },
                  { num: '6', sub: 'MNO' },
                  { num: '7', sub: 'PQRS' },
                  { num: '8', sub: 'TUV' },
                  { num: '9', sub: 'WXYZ' },
                  { num: '*', sub: '' },
                  { num: '0', sub: '+' },
                  { num: '#', sub: '' },
                ].map((item) => (
                  <button
                    key={item.num}
                    onClick={() => handleDialerKeyPress(item.num)}
                    className={`w-16 h-16 mx-auto rounded-full border flex flex-col items-center justify-center cursor-pointer hover:bg-blue-500/10 active:scale-95 transition-all ${cardBgClass}`}
                  >
                    <span className="text-2xl font-bold leading-none">{item.num}</span>
                    {item.sub && <span className="text-[9px] text-slate-400 font-semibold">{item.sub}</span>}
                  </button>
                ))}
              </div>

              {/* Bottom Action Controls */}
              <div className="flex items-center justify-center gap-6 pt-4 relative">
                <button
                  onClick={() => handleStartCall(dialerNumber)}
                  disabled={!dialerNumber}
                  className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 cursor-pointer active:scale-95 transition-all"
                >
                  <PhoneCall className="w-8 h-8" />
                </button>

                {dialerNumber && (
                  <button
                    onClick={handleDialerBackspace}
                    className="p-3 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 cursor-pointer"
                  >
                    <X className="w-6 h-6" />
                  </button>
                )}

                <button
                  onClick={() => setShowAddContactModal(true)}
                  className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center absolute right-2 bottom-2 shadow-md hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: CONTACTS */}
          {activeTab === 'CONTACTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold">Contacts</h3>
                <button
                  onClick={() => setShowAddContactModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" /> Add New
                </button>
              </div>

              {/* Contacts Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-200/60 border-slate-300 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-2">
                {filteredContacts.length === 0 ? (
                  <div className={`p-8 rounded-2xl border text-center space-y-2 ${subTextClass} ${cardBgClass}`}>
                    <User className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                    <p className="text-sm font-semibold">কোনো কন্টাক্ট সেভ করা নেই</p>
                    <p className="text-xs">নতুন কন্টাক্ট সেভ করতে উপরের "+ Add New" বাটনে চাপুন</p>
                  </div>
                ) : (
                  filteredContacts.map((c) => (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between ${cardBgClass}`}
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={c.avatar || DEFAULT_AVATARS[0]}
                          alt={c.name}
                          className="w-11 h-11 rounded-full object-cover"
                        />
                        <div>
                          <h4 className="font-bold text-sm">{c.name}</h4>
                          <span className="text-xs text-blue-500 font-semibold">{c.code}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartCall(c.code, c.name)}
                          className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 cursor-pointer"
                        >
                          <PhoneCall className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenSmsWithNumber(c.code)}
                          className="p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id)}
                          className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full cursor-pointer"
                        >
                          <Delete className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: MESSAGES (Image 2) */}
          {activeTab === 'MESSAGES' && (
            <div className="space-y-4">
              {!selectedConversationCode ? (
                <>
                  {/* Messages Top Header with Badge & New Chat (Image 2) */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-2xl font-black tracking-tight">Messages</h2>
                      <span className="w-6 h-6 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                        {conversationsList.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        if (contacts.length > 0) setSelectedConversationCode(contacts[0].code);
                      }}
                      className="p-2 rounded-xl bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 cursor-pointer"
                    >
                      <MessageSquare className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Messages Search Bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search"
                      className={`w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        isDarkMode ? 'bg-slate-800/80 border-slate-700 text-white' : 'bg-slate-200/60 border-slate-300 text-slate-900'
                      }`}
                    />
                  </div>

                  {/* Conversation List (Image 2) */}
                  <div className="space-y-2">
                    {conversationsList.length === 0 ? (
                      <div className={`p-8 rounded-2xl border text-center space-y-2 ${subTextClass} ${cardBgClass}`}>
                        <MessageSquare className="w-10 h-10 mx-auto text-slate-400 opacity-60" />
                        <p className="text-sm font-semibold">কোনো মেসেজ হিস্ট্রি বা চ্যাট নেই</p>
                        <p className="text-xs">নতুন বার্তা পাঠাতে "Contacts" বা ডায়াল প্যাড ব্যবহার করুন</p>
                      </div>
                    ) : (
                      conversationsList.map((conv) => (
                        <div
                          key={conv.id}
                          onClick={() => setSelectedConversationCode(conv.code)}
                          className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer hover:opacity-90 transition-all ${cardBgClass}`}
                        >
                          <div className="flex items-center gap-3">
                            <img
                              src={conv.avatar}
                              alt={conv.name}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                            <div>
                              <h4 className="font-bold text-sm">{conv.name}</h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <CheckCheck className="w-3.5 h-3.5 text-amber-500" />
                                <span>{conv.lastMsg}</span>
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-slate-400 font-semibold">{conv.time}</span>
                            {conv.unreadCount ? (
                              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                                {conv.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* Selected Active Messaging Chat Screen */
                <div className="flex flex-col h-[75vh] justify-between">
                  {/* Active Chat Header */}
                  <div className={`p-3 rounded-2xl border flex items-center justify-between ${cardBgClass}`}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedConversationCode(null)}
                        className="p-1 rounded-lg text-blue-500 font-bold text-xs"
                      >
                        ← Back
                      </button>
                      <h4 className="font-bold text-sm">
                        {contacts.find((c) => c.code === selectedConversationCode)?.name || `User ${selectedConversationCode}`}
                      </h4>
                    </div>
                    <button
                      onClick={() => handleStartCall(selectedConversationCode)}
                      className="p-2 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 cursor-pointer"
                    >
                      <PhoneCall className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Messages Stream */}
                  <div className="flex-1 overflow-y-auto py-3 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center text-xs text-slate-400 pt-10">
                        এখনো কোনো চ্যাট বার্তা নেই। নিচে টাইপ করে পাঠান।
                      </div>
                    ) : (
                      messages.map((m) => (
                        <div
                          key={m.id}
                          className={`flex ${m.isSelf ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[75%] p-3 rounded-2xl text-xs font-medium ${
                              m.isSelf
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white rounded-bl-none'
                            }`}
                          >
                            <p>{m.content}</p>
                            <span className="text-[9px] opacity-70 block text-right mt-1">
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Bottom Messaging Waveform Bar (Image 2) */}
                  <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-2">
                    <button type="button" className="p-2 text-slate-400 hover:text-blue-500">
                      <ImageIcon className="w-5 h-5" />
                    </button>
                    <button type="button" className="p-2 text-slate-400 hover:text-blue-500">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 bg-slate-200 dark:bg-slate-800 rounded-full px-3 py-1.5 flex items-center gap-2 border border-slate-300 dark:border-slate-700">
                      <Mic className="w-4 h-4 text-blue-500" />
                      <input
                        type="text"
                        placeholder="Say or type..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        className="bg-transparent border-none text-xs w-full focus:outline-none"
                      />
                      <Smile className="w-4 h-4 text-amber-500" />
                    </div>

                    <button
                      type="submit"
                      className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full cursor-pointer shadow-md"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: SETTINGS & PROFILE (Image 1) */}
          {activeTab === 'SETTINGS' && (
            <div className="space-y-4">
              {/* Profile Top Card (Image 1) */}
              <div className={`p-4 rounded-3xl border flex items-center justify-between ${cardBgClass}`}>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={DEFAULT_AVATARS[0]}
                      alt="User photo"
                      className="w-16 h-16 rounded-full object-cover border-2 border-blue-500"
                    />
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 bg-white dark:bg-slate-900 rounded-full absolute bottom-0 right-0" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{currentUserName}</h2>
                    <p className="text-xs text-slate-500">Phone {currentUserCode}</p>
                  </div>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 cursor-pointer"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Unique QR Code Card (Image 1) */}
              <div className={`p-5 rounded-3xl border text-center space-y-3 ${cardBgClass}`}>
                <h3 className="font-bold text-sm">Unique QR Code</h3>
                <div className="p-4 bg-white rounded-2xl inline-block border border-slate-200 shadow-inner">
                  {/* Generated QR Code SVG representing User Code */}
                  <svg className="w-36 h-36 mx-auto" viewBox="0 0 100 100">
                    <rect x="0" y="0" width="100" height="100" fill="#ffffff" />
                    <path
                      d="M10 10 h30 v30 h-30 z M15 15 h20 v20 h-20 z M20 20 h10 v10 h-10 z"
                      fill="#000000"
                    />
                    <path
                      d="M60 10 h30 v30 h-30 z M65 15 h20 v20 h-20 z M70 20 h10 v10 h-10 z"
                      fill="#000000"
                    />
                    <path
                      d="M10 60 h30 v30 h-30 z M15 65 h20 v20 h-20 z M20 70 h10 v10 h-10 z"
                      fill="#000000"
                    />
                    {/* Interior QR Code matrix pattern */}
                    <rect x="45" y="15" width="8" height="8" fill="#000" />
                    <rect x="45" y="30" width="8" height="8" fill="#000" />
                    <rect x="60" y="50" width="10" height="10" fill="#000" />
                    <rect x="75" y="65" width="12" height="12" fill="#000" />
                    <rect x="50" y="70" width="15" height="10" fill="#000" />
                    <rect x="25" y="45" width="10" height="10" fill="#000" />
                  </svg>
                </div>
              </div>

              {/* Settings Options Grouped Card (Image 1) */}
              <div className={`p-4 rounded-3xl border space-y-3 ${cardBgClass}`}>
                <div className="flex items-center gap-2 text-sm font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                  <SettingsIcon className="w-4 h-4 text-blue-500" />
                  <span>Settings</span>
                </div>

                <div className="space-y-1 divide-y divide-slate-100 dark:divide-slate-800/60">
                  {/* Dark Mode Toggle */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Moon className="w-4 h-4 text-slate-500" />
                      <span>Dark Mode</span>
                    </div>
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        isDarkMode ? 'bg-blue-600' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 transition-all ${
                          isDarkMode ? 'left-6.5' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Language Option */}
                  <div
                    onClick={() => setCurrentLang(currentLang === 'BN' ? 'EN' : 'BN')}
                    className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80"
                  >
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Globe className="w-4 h-4 text-slate-500" />
                      <span>Language</span>
                    </div>
                    <span className="text-xs font-bold text-blue-500">
                      {currentLang === 'BN' ? 'বাংলা' : 'English'}
                    </span>
                  </div>

                  {/* Notifications Option */}
                  <div className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Bell className="w-4 h-4 text-slate-500" />
                      <span>Notifications</span>
                    </div>
                    <span className="text-xs text-slate-400 font-semibold">On</span>
                  </div>

                  {/* Privacy Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Lock className="w-4 h-4 text-slate-500" />
                      <span>Privacy</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Security Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Shield className="w-4 h-4 text-slate-500" />
                      <span>Security</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Block List Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Slash className="w-4 h-4 text-slate-500" />
                      <span>Block List</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Call Recording Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Disc className="w-4 h-4 text-slate-500" />
                      <span>Call Recording</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* Backup & Restore Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Cloud className="w-4 h-4 text-slate-500" />
                      <span>Backup & Restore</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>

                  {/* About Option */}
                  <div className="flex items-center justify-between py-2.5 cursor-pointer hover:opacity-80">
                    <div className="flex items-center gap-3 text-sm font-medium">
                      <Info className="w-4 h-4 text-slate-500" />
                      <span>About BanglaCall</span>
                    </div>
                    <span className="text-xs text-slate-400">v2.4.0</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* BOTTOM NAVIGATION TAB BAR (Image 6) */}
        <div className={`border-t py-2 px-4 flex items-center justify-around fixed bottom-0 left-0 right-0 max-w-md mx-auto z-40 ${
          isDarkMode ? 'bg-[#1a1d26] border-slate-800' : 'bg-white border-slate-200'
        }`}>
          {[
            { id: 'HOME', label: 'Home', icon: HomeIcon },
            { id: 'CALLS', label: 'Calls', icon: Phone },
            { id: 'CONTACTS', label: 'Contacts', icon: User },
            { id: 'MESSAGES', label: 'Messages', icon: MessageSquare },
            { id: 'SETTINGS', label: 'Settings', icon: SettingsIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center gap-1 cursor-pointer transition-all ${
                  isActive ? 'text-blue-600 dark:text-blue-400 scale-105' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className={`p-1 rounded-xl ${isActive ? 'bg-blue-500/10' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold">{tab.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* INCOMING CALL OVERLAY (Image 3) */}
      {incomingCall && !activeCall.isActive && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col justify-between p-6 text-white text-center">
          {/* Top Dynamic Island Notch */}
          <div className="w-28 h-7 bg-black rounded-full mx-auto mt-2 border border-slate-800" />

          {/* Center Backdrop Avatar & Caller Info (Image 3) */}
          <div className="space-y-4 my-auto">
            <img
              src={DEFAULT_AVATARS[1]}
              alt={incomingCall.callerName}
              className="w-32 h-32 rounded-full object-cover mx-auto border-4 border-white/20 shadow-2xl animate-pulse"
            />
            <div>
              <h2 className="text-3xl font-extrabold">{incomingCall.callerName}</h2>
              <p className="text-lg text-slate-300 font-mono mt-1">+{incomingCall.callerId}</p>
            </div>

            {/* Answer / Decline Action Controls (Image 3) */}
            <div className="flex items-center justify-center gap-6 pt-8 max-w-xs mx-auto">
              {/* Swipe/Click to Answer (Green) */}
              <button
                onClick={() => {
                  onSendCallSignal?.('ACCEPT', incomingCall.callerId, inputName || myNodeId);
                  if (callingEngineMode === 'AGORA') {
                    const channelName = `banglacall_${[inputCode || myNodeId, incomingCall.callerId].sort().join('_')}`;
                    agoraVoiceEngine.joinAudioChannel(agoraAppId, channelName, inputCode || myNodeId);
                  }
                  setActiveCall({
                    isActive: true,
                    targetCode: incomingCall.callerId,
                    targetName: incomingCall.callerName,
                    durationSec: 0,
                    isMuted: false,
                    isSpeaker: false,
                    isBluetooth: false,
                    isHold: false,
                    isRecording: false,
                    isVideo: false,
                    showKeypad: false,
                    avatar: DEFAULT_AVATARS[1],
                  });
                }}
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-full flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/40 cursor-pointer active:scale-95 transition-all"
              >
                <PhoneCall className="w-6 h-6" />
                <span className="text-xs">Swipe to Answer</span>
              </button>

              {/* Swipe/Click to Decline (Red) */}
              <button
                onClick={() => {
                  onSendCallSignal?.('REJECT', incomingCall.callerId, inputName || myNodeId);
                }}
                className="flex-1 py-4 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-full flex items-center justify-center gap-2 shadow-lg shadow-rose-600/40 cursor-pointer active:scale-95 transition-all"
              >
                <PhoneOff className="w-6 h-6" />
                <span className="text-xs">Swipe to Decline</span>
              </button>
            </div>
          </div>

          {/* Bottom Quick Reply & Block Caller Buttons (Image 3) */}
          <div className="flex items-center justify-center gap-4 pb-6">
            <button className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md flex items-center gap-2 cursor-pointer">
              <MessageSquare className="w-4 h-4" />
              <span>Quick Reply</span>
            </button>
            <button className="px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-md flex items-center gap-2 cursor-pointer">
              <Slash className="w-4 h-4" />
              <span>Block Caller</span>
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE IN-CALL SCREEN (Image 4) */}
      {activeCall.isActive && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col justify-between p-6 max-w-md mx-auto shadow-2xl">
          {/* Top Notch Bar */}
          <div className="pt-2 flex items-center justify-between text-xs opacity-70">
            <span>9:41</span>
            <div className="w-24 h-5 bg-black rounded-full" />
            <span>5G</span>
          </div>

          {/* Caller Profile & Timer (Image 4) */}
          <div className="text-center space-y-3 my-auto">
            <img
              src={activeCall.avatar || DEFAULT_AVATARS[0]}
              alt={activeCall.targetName}
              className="w-28 h-28 rounded-full object-cover mx-auto border-4 border-blue-500/20 shadow-xl"
            />
            <div>
              <h2 className="text-2xl font-bold">{activeCall.targetName}</h2>
              <p className="text-lg font-mono font-semibold text-slate-500 mt-1">
                {formatTimer(activeCall.durationSec)}
              </p>
            </div>

            {/* 8 Control Action Buttons Grid (Image 4) */}
            <div className="grid grid-cols-4 gap-4 pt-8 max-w-xs mx-auto">
              {/* 1. Mute */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isMuted: !p.isMuted }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isMuted ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  {activeCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </div>
                <span className="text-[11px] font-medium">Mute</span>
              </button>

              {/* 2. Speaker */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isSpeaker: !p.isSpeaker }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isSpeaker ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  {activeCall.isSpeaker ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
                </div>
                <span className="text-[11px] font-medium">Speaker</span>
              </button>

              {/* 3. Bluetooth */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isBluetooth: !p.isBluetooth }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isBluetooth ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  <Bluetooth className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Bluetooth</span>
              </button>

              {/* 4. Keypad */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, showKeypad: !p.showKeypad }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <Grid className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Keypad</span>
              </button>

              {/* 5. Add Call */}
              <button className="flex flex-col items-center gap-1.5 cursor-pointer">
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <UserPlus className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Add Call</span>
              </button>

              {/* 6. Hold */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isHold: !p.isHold }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isHold ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  <Pause className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Hold</span>
              </button>

              {/* 7. Record */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isRecording: !p.isRecording }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  <Disc className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Record</span>
              </button>

              {/* 8. Video Call */}
              <button
                onClick={() => setActiveCall((p) => ({ ...p, isVideo: !p.isVideo }))}
                className="flex flex-col items-center gap-1.5 cursor-pointer"
              >
                <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  activeCall.isVideo ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}>
                  <Video className="w-6 h-6" />
                </div>
                <span className="text-[11px] font-medium">Video Call</span>
              </button>
            </div>
          </div>

          {/* Large Red End Call Button at Bottom Center (Image 4) */}
          <div className="flex justify-center pb-8">
            <button
              onClick={handleRejectOrCutCall}
              className="w-16 h-16 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/40 cursor-pointer active:scale-95 transition-all"
            >
              <PhoneOff className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}

      {/* Add Contact Modal Form */}
      {showAddContactModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddContact}
            className={`w-full max-w-sm p-5 rounded-3xl border space-y-4 shadow-2xl ${cardBgClass}`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base">Add New Contact</h3>
              <button
                type="button"
                onClick={() => setShowAddContactModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Contact Name"
                value={newContactName}
                onChange={(e) => setNewContactName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800"
                required
              />
              <input
                type="text"
                maxLength={6}
                placeholder="6-Digit Phone Code"
                value={newContactCode}
                onChange={(e) => setNewContactCode(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-sm font-bold tracking-widest text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-800"
                required
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddContactModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                Save Contact
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
