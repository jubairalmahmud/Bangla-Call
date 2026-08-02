export type ProtocolType = 'BLE_5_3' | 'WIFI_DIRECT' | 'HYBRID_MESH';

export type NodeStatus = 'ONLINE' | 'RELAY_ONLY' | 'OFFLINE' | 'EMERGENCY_BEACON';

export type MeshNodeType = 'MOBILE_USER' | 'RELAY_TOWER' | 'BASE_STATION' | 'EMERGENCY_BEACON';

export interface MeshNode {
  id: string;
  name: string;
  type: MeshNodeType;
  status: NodeStatus;
  batteryLevel: number; // 0-100
  x: number; // canvas percentage 0-100
  y: number; // canvas percentage 0-100
  signalRange: number; // range radius in canvas units
  rssi: number; // -30 (strong) to -100 (weak) dBm
  connectedPeers: string[]; // Node IDs directly in range
  publicKey: string; // Base64 public key for E2EE
  lastSeen: number;
  isSelf?: boolean;
  avatarUrl?: string;
  ipAddress?: string;
  bluetoothMac?: string;
  locationArea?: string;
}

export interface MeshLink {
  fromNodeId: string;
  toNodeId: string;
  protocol: ProtocolType;
  rssi: number;
  quality: number; // 0-100%
  latencyMs: number;
}

export type PacketType = 'CHAT_TEXT' | 'VOICE_MEMO' | 'VOICE_STREAM' | 'ROUTING_DISCOVERY' | 'EMERGENCY_SOS' | 'KEY_EXCHANGE' | 'ACK';

export interface MeshPacket {
  id: string;
  type: PacketType;
  senderId: string;
  senderName: string;
  targetId: string; // 'BROADCAST' or specific node ID
  encryptedPayload: string; // IV + Ciphertext
  iv: string; // Base64 IV for AES-GCM
  authTag?: string;
  timestamp: number;
  ttl: number; // Time to live (e.g., 5 hops)
  hopCount: number; // Current hops taken
  routingTrace: string[]; // Array of Node IDs the packet traversed
  sequenceNumber: number;
  signature: string;
  audioDuration?: number; // for voice memo/stream
  fileName?: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  targetId: string;
  content: string; // Plaintext if decrypted, or fallback
  encryptedContent: string;
  timestamp: number;
  isDelivered: boolean;
  hopCount: number;
  routingTrace: string[];
  type: 'TEXT' | 'VOICE' | 'SOS' | 'FILE';
  audioBlobUrl?: string;
  fileDetails?: { name: string; size: string; type: string };
  isEncrypted: boolean;
  isSelf: boolean;
}

export interface ActiveRoute {
  sourceId: string;
  destinationId: string;
  path: string[]; // Node IDs in sequence e.g., ['A', 'B', 'C']
  totalHops: number;
  estLatencyMs: number;
  avgRssi: number;
}

export interface EmergencyAlert {
  id: string;
  senderId: string;
  senderName: string;
  locationName: string;
  coordinates: { lat: number; lng: number };
  message: string;
  timestamp: number;
  hopTrace: string[];
  acknowledgedBy: string[];
}

export interface VoiceCallState {
  isActive: boolean;
  targetNodeId: string | null;
  targetNodeName: string | null;
  isMuted: boolean;
  isSpeaking: boolean;
  callDurationSec: number;
  qualityScore: number;
  bitrateKbps: number;
  packetsSent: number;
  packetsReceived: number;
  mode: 'WALKIE_TALKIE_PTT' | 'DUPLEX_CALL';
}

export type LanguageMode = 'BN' | 'EN';

export type ActiveTab = 'TOPOLOGY' | 'CHAT' | 'WALKIE_TALKIE' | 'CROWD_GPS' | 'REACT_NATIVE_EXPORT' | 'LOGS';
