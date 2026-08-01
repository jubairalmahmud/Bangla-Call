import { LanguageMode } from '../types/mesh';

export const translations: Record<LanguageMode, Record<string, string>> = {
  BN: {
    appTitle: 'মেস টক (MeshTalk)',
    appSubtitle: 'অফলাইন মেস কলিং ও এনক্রিপ্টেড চ্যাট',
    offGridActive: 'অফলাইন নেটওয়ার্ক সক্রিয় (সেলুলার/ইন্টারনেট ছাড়া)',
    connectedNodes: 'সংযুক্ত ডিভাইস নোড',
    activeHops: 'সর্বোচ্চ রিলে হপ',
    networkHealth: 'নেটওয়ার্ক হেলথ',
    tabTopology: 'মেস নেটওয়ার্ক ম্যাপ',
    tabChat: 'এনক্রিপ্টেড চ্যাট',
    tabWalkieTalkie: 'ওয়াকি-টকি ও ভয়েস কল',
    tabCrowdGps: 'ক্রাউড জিপিএস নেটওয়ার্ক',
    tabReactNativeExport: 'রিয়েক্ট নেটিভ কোড এক্সপোর্ট',
    tabLogs: 'প্যাকেট ফিল্টার ও লগ',
    
    // Topology panel
    meshTopologyTitle: 'মেস নেটওয়ার্ক টপোলজি (BLE + Wi-Fi Direct)',
    topologyDesc: 'নোডগুলো টেনে দূরত্ব পরিবর্তন করুন বা সংকেতের মান দেখুন। রেঞ্জের বাইরে থাকা ডিভাইসে রিলে নোড (Relay) এর মাধ্যমে ডাটা অটো-রুট হবে।',
    addRelayNode: '+ রিলে নোড যোগ করুন',
    triggerFailure: 'নোড পাওয়ার অফ / ফেইল করুন',
    resetNetwork: 'টপোলজি রিসেট',
    rssiLabel: 'সংকেত মান (RSSI):',
    directRange: 'সরাসরি কানেকশন (Direct Hop)',
    multiHopRoute: 'মাল্টি-হপ রিলে পথ (Relay Hop)',
    outOfRange: 'রেঞ্জের বাইরে (Out of Range)',
    activeRouteTitle: 'সক্রিয় মেস রুট ট্র্যাকার:',
    packetTrace: 'প্যাকেট রুট ট্রেইল:',
    hopsCount: 'হপ গণনা:',
    estLatency: 'আনুমানিক লেটেন্সি:',

    // Chat panel
    chatTitle: 'অফলাইন ই-টু-ই এনক্রিপ্টেড মেস মেসেঞ্জার',
    selectNode: 'বার্তা পাঠানোর জন্য ডিভাইস নির্বাচন করুন:',
    allBroadcast: '📢 অল মেস ব্রডকাস্ট (সবাই পাবে)',
    typePlaceholder: 'এনক্রিপ্টেড মেসেজ লিখুন...',
    sendBtn: 'পাঠান',
    voiceMemoBtn: 'ভয়েস নোট রেকর্ড',
    sosAlertBtn: '🚨 জরুরী SOS ব্রডকাস্ট',
    inspectPacket: 'প্যাকেট দেখুন',
    storeAndForwardAlert: '⚠️ টার্গেট ডিভাইস অফলাইনে আছে। মেসেজটি রিলে নোডে স্টোর রাখা হয়েছে এবং ডিভাইসটি রেঞ্জে আসলেই পৌঁছে যাবে।',
    e2eeBadge: 'AES-256-GCM E2EE সুরক্ষিত',
    relayedBy: 'দ্বারা রিলেড:',

    // Walkie Talkie / Voice Call
    walkieTalkieTitle: 'অফলাইন ওয়াকি-টকি ও ২-ওয়ে ভয়েস কল',
    pushToTalkDesc: 'বাটনটি চেপে ধরে কথা বলুন (Push-To-Talk) অথবা ফুল ডুপ্লেক্স কল চালু করুন। ভয়েস প্যাকটগুলো BLE/Wi-Fi মেস দিয়ে রিয়েল-টাইমে পৌঁছাবে।',
    pttButton: '🎙️ কথা বলতে বাটন চেপে রাখুন (PTT)',
    pttTransmitting: '🔊 ভয়েস ট্রান্সমিট হচ্ছে...',
    startCall: '📞 ভয়েস কল চালু করুন',
    endCall: '🔴 কল শেষ করুন',
    callActive: '🟢 পিয়ার-টু-পিয়ার ভয়েস কল চলছে',
    bitrateLabel: 'ভয়েস বিটরেট:',
    audioQuality: 'কোডেক ও মান:',
    packetsRelayed: 'স্থানান্তরিত মেস অডিও প্যাকেট:',

    // Emergency Modal
    emergencyTitle: 'জরুরী মেস নেটওয়ার্ক বন্যা সতর্কবার্তা (SOS Alert)',
    emergencyDesc: 'এই হাই-প্রায়োরিটি বার্তাটি নেটওয়ার্কের রাউটিং টেবিল পাশ কাটিয়ে সকল সক্রিয় রিলে নোডে সর্বোচ্চ গতিতে ফ্ল্যাশ ব্রডকাস্ট করা হবে।',
    sosLocation: 'জিপিএস স্থানাঙ্ক:',
    sosReason: 'জরুরী সহায়তার বিষয়:',
    sendSosBtn: '🚨 মেস SOS বন্যা চালু করুন',

    // React Native Export
    rnExportTitle: 'রিয়েক্ট নেটিভ (React Native) সোর্স কোড হাব',
    rnExportSubtitle: 'অ্যান্ড্রয়েড (Android) ও আইওএস (iOS) অ্যাপের জন্য প্রস্তুত TypeScript আর্কিটেকচার সোর্স কোড।',
    copyCode: 'কোড কপি করুন',
    copied: 'কপি হয়েছে!',
    fileMeshEngine: 'MeshEngine.ts (রাউটিং ও এওডিভি অ্যালগরিদম)',
    fileBleManager: 'BleManager.ts (ব্লুটুথ BLE সেন্ট্রাল/পেরিফ্যারাল)',
    fileWifiMesh: 'WifiDirectMesh.ts (ওয়াই-ফাই হটস্পট মেস)',
    fileCrypto: 'CryptoService.ts (AES-256 E2EE এনক্রিপশন)',
    fileApp: 'App.tsx (মোবাইল অ্যাপ ইউজার ইন্টারফেস)',

    // Inspector
    wireInspectorTitle: 'প্যাকেট মেস ওয়্যার ইন্সপেক্টর (Wire Inspector)',
    rawCiphertext: 'এনক্রিপ্টেড সাইফারটেক্সট:',
    ivIv: 'ইনিশিয়ালাইজেশন ভেক্টর (IV):',
    ttlHops: 'টিটিএল (TTL) / হপ সংখ্যা:',
    signatureHash: 'ডিজিটাল সিগনেচার হ্যাশ:',

    // General
    selfDevice: 'আপনার ডিভাইস (Self)',
    relayNode: 'রিলে নোড (Relay)',
    battery: 'ব্যাটারি',
  },
  EN: {
    appTitle: 'MeshTalk',
    appSubtitle: 'Offline Cross-Platform Mesh Calling & Encrypted Chat',
    offGridActive: 'Off-Grid Network Active (No Cell/Internet)',
    connectedNodes: 'Connected Peer Nodes',
    activeHops: 'Max Relay Hops',
    networkHealth: 'Network Health',
    tabTopology: 'Mesh Network Topology',
    tabChat: 'E2EE Chat',
    tabWalkieTalkie: 'Walkie-Talkie & Call',
    tabCrowdGps: 'Crowd GPS Network',
    tabReactNativeExport: 'React Native Export Hub',
    tabLogs: 'Mesh Packet Logs',

    // Topology panel
    meshTopologyTitle: 'Mesh Network Topology (BLE 5.3 + Wi-Fi Direct)',
    topologyDesc: 'Drag nodes to change physical distances. Out-of-range nodes automatically route packets through intermediate Relay Nodes using multi-hop mesh forwarding.',
    addRelayNode: '+ Add Relay Node',
    triggerFailure: 'Toggle Battery / Node Failure',
    resetNetwork: 'Reset Topology',
    rssiLabel: 'Signal Strength (RSSI):',
    directRange: 'Direct Hop Link',
    multiHopRoute: 'Multi-Hop Relay Path',
    outOfRange: 'Out of Range',
    activeRouteTitle: 'Active Multi-Hop Route Tracker:',
    packetTrace: 'Packet Route Trace:',
    hopsCount: 'Hops Count:',
    estLatency: 'Est. Latency:',

    // Chat panel
    chatTitle: 'Off-Grid End-to-End Encrypted Messenger',
    selectNode: 'Select Target Mesh Peer:',
    allBroadcast: '📢 All Mesh Broadcast',
    typePlaceholder: 'Type encrypted message...',
    sendBtn: 'Send',
    voiceMemoBtn: 'Voice Memo',
    sosAlertBtn: '🚨 Emergency SOS',
    inspectPacket: 'Inspect Wire Packet',
    storeAndForwardAlert: '⚠️ Target node is offline/out of range. Message stored in Relay Node queue and will deliver automatically when target rejoins.',
    e2eeBadge: 'AES-256-GCM E2EE Secured',
    relayedBy: 'Relayed via:',

    // Walkie Talkie / Voice Call
    walkieTalkieTitle: 'Offline Walkie-Talkie & P2P Voice Call',
    pushToTalkDesc: 'Hold the button to broadcast voice (Push-To-Talk) or initiate a 2-way call over local BLE / Wi-Fi Direct mesh channels.',
    pttButton: '🎙️ Hold to Speak (PTT)',
    pttTransmitting: '🔊 Transmitting Audio Frame...',
    startCall: '📞 Start Voice Call',
    endCall: '🔴 End Voice Call',
    callActive: '🟢 Peer-to-Peer Voice Session Active',
    bitrateLabel: 'Audio Bitrate:',
    audioQuality: 'Codec & Quality:',
    packetsRelayed: 'Mesh Audio Packets Streamed:',

    // Emergency Modal
    emergencyTitle: 'Emergency SOS Mesh Flooding Alert',
    emergencyDesc: 'This high-priority message bypasses standard routing tables and floods across all active relay nodes in the mesh for immediate awareness.',
    sosLocation: 'GPS Coordinates:',
    sosReason: 'Emergency Assistance Type:',
    sendSosBtn: '🚨 Broadcast SOS Flood Alert',

    // React Native Export
    rnExportTitle: 'React Native Cross-Platform Source Code Hub',
    rnExportSubtitle: 'Production-ready TypeScript architecture for building the Android & iOS mobile app.',
    copyCode: 'Copy Source Code',
    copied: 'Copied to Clipboard!',
    fileMeshEngine: 'MeshEngine.ts (AODV Mesh Routing)',
    fileBleManager: 'BleManager.ts (BLE Central & Peripheral)',
    fileWifiMesh: 'WifiDirectMesh.ts (Wi-Fi Direct Peer Mesh)',
    fileCrypto: 'CryptoService.ts (E2EE Encryption)',
    fileApp: 'App.tsx (Mobile UI)',

    // Inspector
    wireInspectorTitle: 'Mesh Wire Packet Inspector',
    rawCiphertext: 'Encrypted Ciphertext:',
    ivIv: 'Initialization Vector (IV):',
    ttlHops: 'TTL / Hop Count:',
    signatureHash: 'Digital Signature Hash:',

    // General
    selfDevice: 'Your Device (Self)',
    relayNode: 'Relay Node',
    battery: 'Battery',
  },
};
