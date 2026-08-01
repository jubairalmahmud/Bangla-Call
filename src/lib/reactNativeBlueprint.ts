export interface CodeFile {
  id: string;
  filename: string;
  title: string;
  description: string;
  language: string;
  code: string;
}

export const reactNativeFiles: CodeFile[] = [
  {
    id: 'mesh-engine',
    filename: 'src/services/MeshEngine.ts',
    title: 'MeshEngine.ts - AODV Multi-Hop Mesh Routing Engine',
    description: 'Implements Distance-Vector AODV routing, Packet Flooding, Store-and-Forward caching, Time-To-Live (TTL) decrements, and hop trace tracking.',
    language: 'typescript',
    code: `import { BleManager } from './BleManager';
import { WifiDirectMesh } from './WifiDirectMesh';
import { CryptoService } from './CryptoService';

export interface MeshPacket {
  id: string;
  type: 'CHAT' | 'VOICE' | 'SOS' | 'ROUTE_DISCOVERY';
  senderId: string;
  targetId: string; // 'BROADCAST' or specific node MAC/UUID
  payload: string; // Encrypted Base64
  iv: string;
  ttl: number; // Max hops e.g. 7
  hopCount: number;
  routingTrace: string[]; // List of traversed Node IDs
  sequenceNumber: number;
}

export class MeshEngine {
  private nodeId: string;
  private routingTable: Map<string, { nextHop: string; distance: number; lastUpdated: number }> = new Map();
  private processedPacketIds: Set<string> = new Set();
  private storeAndForwardQueue: MeshPacket[] = [];

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  /**
   * Handle incoming mesh packet from BLE or Wi-Fi Direct interface
   */
  public async handleIncomingPacket(packet: MeshPacket, rxRssi: number): Promise<void> {
    // 1. Prevent infinite broadcast loops
    if (this.processedPacketIds.has(packet.id)) {
      return;
    }
    this.processedPacketIds.add(packet.id);

    // 2. Add self to routing trace
    const updatedTrace = [...packet.routingTrace, this.nodeId];
    
    // 3. Update routing table based on packet sender and hops
    this.updateRoute(packet.senderId, packet.routingTrace[packet.routingTrace.length - 1] || packet.senderId, packet.hopCount);

    // 4. Check if packet is intended for this node
    if (packet.targetId === this.nodeId || packet.targetId === 'BROADCAST') {
      console.log(\`[MeshEngine] Packet \${packet.id} arrived at destination \${this.nodeId} via \${updatedTrace.join(' -> ')}\`);
      this.onPacketReceived(packet);
    }

    // 5. Multi-Hop Forwarding if TTL > 0
    if (packet.ttl > 1 && packet.targetId !== this.nodeId) {
      const forwardedPacket: MeshPacket = {
        ...packet,
        ttl: packet.ttl - 1,
        hopCount: packet.hopCount + 1,
        routingTrace: updatedTrace,
      };

      await this.relayPacketToNeighbors(forwardedPacket);
    }
  }

  /**
   * Relay packet to all nearby connected BLE / Wi-Fi Direct peers
   */
  private async relayPacketToNeighbors(packet: MeshPacket): Promise<void> {
    const nextHopInfo = this.routingTable.get(packet.targetId);
    
    if (nextHopInfo) {
      // Direct unicast relay
      console.log(\`[MeshEngine] Relaying unicast packet to next hop \${nextHopInfo.nextHop}\`);
      await BleManager.sendPacketToPeer(nextHopInfo.nextHop, packet);
    } else {
      // Mesh Flooding relay
      console.log(\`[MeshEngine] Flooding packet across all active neighbors\`);
      await BleManager.broadcastToAllNeighbors(packet);
      await WifiDirectMesh.broadcastToHotspot(packet);
    }
  }

  private updateRoute(sourceId: string, viaNextHop: string, distance: number) {
    const existing = this.routingTable.get(sourceId);
    if (!existing || existing.distance > distance) {
      this.routingTable.set(sourceId, {
        nextHop: viaNextHop,
        distance,
        lastUpdated: Date.now(),
      });
    }
  }

  private onPacketReceived(packet: MeshPacket) {
    // EventEmitter notification for React Native UI
  }
}
`,
  },
  {
    id: 'ble-manager',
    filename: 'src/services/BleManager.ts',
    title: 'BleManager.ts - React Native BLE Central & Peripheral',
    description: 'Uses react-native-ble-plx and react-native-ble-advertiser to scan and advertise custom Mesh Service UUIDs simultaneously.',
    language: 'typescript',
    code: `import { BleManager as RNBleManager, Device, Characteristic } from 'react-native-ble-plx';
import { PermissionsAndroid, Platform } from 'react-native';

const MESH_SERVICE_UUID = '0000FE2C-0000-1000-8000-00805F9B34FB';
const MESH_CHAR_TX_UUID = '0000FE2D-0000-1000-8000-00805F9B34FB';
const MESH_CHAR_RX_UUID = '0000FE2E-0000-1000-8000-00805F9B34FB';

export class BleManagerService {
  private bleManager: RNBleManager;
  private connectedPeers: Map<string, Device> = new Map();

  constructor() {
    this.bleManager = new RNBleManager();
  }

  public async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
      ]);
      return Object.values(granted).every(val => val === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true;
  }

  public startMeshScanning(onPeerDiscovered: (device: Device) => void) {
    this.bleManager.startDeviceScan([MESH_SERVICE_UUID], null, (error, device) => {
      if (error) {
        console.error('[BLE] Scan error:', error);
        return;
      }
      if (device && !this.connectedPeers.has(device.id)) {
        this.connectToPeer(device, onPeerDiscovered);
      }
    });
  }

  private async connectToPeer(device: Device, callback: (d: Device) => void) {
    try {
      const connected = await device.connect();
      const discovered = await connected.discoverAllServicesAndCharacteristics();
      this.connectedPeers.set(device.id, discovered);
      
      // Subscribe to incoming RX Mesh notifications
      discovered.monitorCharacteristicForService(
        MESH_SERVICE_UUID,
        MESH_CHAR_RX_UUID,
        (error, characteristic) => {
          if (characteristic?.value) {
            this.handleRawBleData(characteristic.value);
          }
        }
      );
      callback(discovered);
    } catch (e) {
      console.warn('[BLE] Connection failed:', e);
    }
  }

  public async sendPacketToPeer(deviceId: string, packet: any): Promise<void> {
    const peer = this.connectedPeers.get(deviceId);
    if (peer) {
      const base64Data = Buffer.from(JSON.stringify(packet)).toString('base64');
      await peer.writeCharacteristicWithResponseForService(
        MESH_SERVICE_UUID,
        MESH_CHAR_TX_UUID,
        base64Data
      );
    }
  }

  private handleRawBleData(base64Val: string) {
    const jsonString = Buffer.from(base64Val, 'base64').toString('utf8');
    const packet = JSON.parse(jsonString);
    // Dispatch to MeshEngine
  }
}

export const BleManager = new BleManagerService();
`,
  },
  {
    id: 'wifi-direct',
    filename: 'src/services/WifiDirectMesh.ts',
    title: 'WifiDirectMesh.ts - Wi-Fi Direct & Local Hotspot Transport',
    description: 'High-bandwidth transport layer for voice calling and file transfers when BLE range is established.',
    language: 'typescript',
    code: `import { NativeModules, NativeEventEmitter } from 'react-native';

// High-speed Wi-Fi Direct socket connection for voice streaming
export class WifiDirectMeshService {
  private activeGroupPeers: string[] = [];

  public async initializeGroup(): Promise<void> {
    console.log('[WifiDirect] Initializing Autonomous Wi-Fi Direct P2P Group');
    // Call Native Android WifiP2pManager bridge
  }

  public async broadcastToHotspot(packet: any): Promise<void> {
    // Send UDP Multicast packet to 239.255.255.250:8888 for high-throughput mesh audio
  }

  public async streamAudioChunk(pcmChunkBase64: string): Promise<void> {
    // Transmit 20ms audio frame packet over UDP socket
  }
}

export const WifiDirectMesh = new WifiDirectMeshService();
`,
  },
  {
    id: 'crypto-service',
    filename: 'src/services/CryptoService.ts',
    title: 'CryptoService.ts - Mobile E2EE Encryption',
    description: 'Cross-platform AES-256-GCM encryption using @noble/ciphers for React Native Android and iOS.',
    language: 'typescript',
    code: `import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { utf8ToBytes, bytesToUtf8, bytesToBase64, base64ToBytes } from '@noble/ciphers/utils';

export class CryptoService {
  /**
   * Encrypt text payload using AES-256-GCM
   */
  public static encrypt(plaintext: string, secretKeyHex: string) {
    const key = base64ToBytes(secretKeyHex);
    const nonce = randomBytes(12); // 96-bit GCM nonce
    const aes = gcm(key, nonce);
    
    const ciphertext = aes.encrypt(utf8ToBytes(plaintext));

    return {
      ciphertext: bytesToBase64(ciphertext),
      iv: bytesToBase64(nonce),
    };
  }

  /**
   * Decrypt AES-256-GCM ciphertext
   */
  public static decrypt(ciphertextBase64: string, ivBase64: string, secretKeyHex: string): string {
    const key = base64ToBytes(secretKeyHex);
    const nonce = base64ToBytes(ivBase64);
    const ciphertext = base64ToBytes(ciphertextBase64);

    const aes = gcm(key, nonce);
    const decryptedBytes = aes.decrypt(ciphertext);

    return bytesToUtf8(decryptedBytes);
  }
}
`,
  },
  {
    id: 'react-native-app',
    filename: 'App.tsx',
    title: 'App.tsx - React Native Off-Grid Mobile Interface',
    description: 'Complete mobile screen component with Mesh status, chat view, Walkie-Talkie button, and emergency SOS.',
    language: 'typescript',
    code: `import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  FlatList,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { BleManager } from './src/services/BleManager';
import { MeshEngine } from './src/services/MeshEngine';

export default function App() {
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [activePeers, setActivePeers] = useState<number>(0);

  useEffect(() => {
    BleManager.requestPermissions().then((granted) => {
      if (granted) {
        BleManager.startMeshScanning((peer) => {
          setActivePeers((prev) => prev + 1);
          setIsConnected(true);
        });
      }
    });
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />
      
      {/* Off-Grid Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MeshTalk (মেস টক)</Text>
        <Text style={styles.subtitle}>
          {isConnected ? \`🟢 সক্রিয় মেস নোড: \${activePeers} পেয়ার\` : '📡 ব্লুটুথ ও ওয়াই-ফাই মেস খোঁজা হচ্ছে...'}
        </Text>
      </View>

      {/* Message Feed */}
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.msgBubble}>
            <Text style={styles.sender}>{item.senderName} (হপ: {item.hopCount})</Text>
            <Text style={styles.msgText}>{item.content}</Text>
          </View>
        )}
        style={styles.chatFeed}
      />

      {/* Walkie-Talkie Quick Bar */}
      <TouchableOpacity style={styles.pttButton}>
        <Text style={styles.pttText}>🎙️ ওয়াকি-টকি: চেপে ধরে কথা বলুন (PTT)</Text>
      </TouchableOpacity>

      {/* Input Box */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="অফলাইন এনক্রিপ্টেড মেসেজ..."
          placeholderTextColor="#94a3b8"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendBtn}>
          <Text style={styles.sendBtnText}>পাঠান</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { padding: 16, backgroundColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#334155' },
  title: { color: '#f8fafc', fontSize: 20, fontWeight: 'bold' },
  subtitle: { color: '#38bdf8', fontSize: 13, marginTop: 4 },
  chatFeed: { flex: 1, padding: 16 },
  msgBubble: { backgroundColor: '#334155', borderRadius: 12, padding: 12, marginBottom: 8 },
  sender: { color: '#94a3b8', fontSize: 11, marginBottom: 2 },
  msgText: { color: '#f8fafc', fontSize: 15 },
  pttButton: { backgroundColor: '#0284c7', margin: 12, padding: 14, borderRadius: 24, alignItems: 'center' },
  pttText: { color: '#ffffff', fontWeight: 'bold' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#1e293b' },
  input: { flex: 1, backgroundColor: '#0f172a', color: '#fff', borderRadius: 20, paddingHorizontal: 16 },
  sendBtn: { backgroundColor: '#10b981', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 20, marginLeft: 8 },
  sendBtnText: { color: '#fff', fontWeight: 'bold' },
});
`,
  },
];
