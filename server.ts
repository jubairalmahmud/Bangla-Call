import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { MeshNode, MeshPacket, ActiveRoute, EmergencyAlert } from './src/types/mesh';
import {
  initDatabase,
  saveOrUpdateUser,
  getUser,
  getAllUsers,
  saveChatMessage,
  getChatHistory,
  saveSharedFile,
  getSharedFiles,
  saveCallLog,
  getCallLogs,
  isDbConnected,
  UserRecord as DbUserRecord,
  CallLogRecord,
} from './src/db/database';

const PORT = 3000;
const app = express();
app.use(express.json({ limit: '50mb' }));

// Persistent Local Database Fallbacks
const DB_FILE_PATH = path.join(process.cwd(), 'mesh_user_db.json');
const AGORA_FILE_PATH = path.join(process.cwd(), 'agora_settings.json');
const CALL_LOGS_FILE_PATH = path.join(process.cwd(), 'call_logs.json');

interface UserRecord {
  code: string;
  name: string;
  phone?: string;
  pin: string;
  profile_photo?: string;
  registeredAt: number;
}

interface AgoraConfig {
  appId: string;
  appCertificate: string;
  mode: 'AGORA' | 'MESH_PCM';
  enabled: boolean;
}

let agoraConfig: AgoraConfig = {
  appId: process.env.AGORA_APP_ID || '8e48363cdc6c4fc696be606b8f3d6f64',
  appCertificate: process.env.AGORA_APP_CERTIFICATE || '2fc1a4e7638a423ca2b96b0f3cd69fcd',
  mode: 'AGORA',
  enabled: true,
};

let callLogsList: CallLogRecord[] = [];

// Load Agora Settings from disk
try {
  if (fs.existsSync(AGORA_FILE_PATH)) {
    const raw = fs.readFileSync(AGORA_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    agoraConfig = { ...agoraConfig, ...parsed };
    // If parsed App ID was old demo key, replace with user's new key
    if (agoraConfig.appId === 'e8992147fd9c48bc8945419fb25dfb3e') {
      agoraConfig.appId = '8e48363cdc6c4fc696be606b8f3d6f64';
      agoraConfig.appCertificate = '2fc1a4e7638a423ca2b96b0f3cd69fcd';
      fs.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
    }
  } else {
    fs.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
  }
} catch (e) {
  console.error('Error reading Agora settings:', e);
}

function saveAgoraConfigToDisk() {
  try {
    fs.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
  } catch (e) {
    console.error('Failed to save Agora settings:', e);
  }
}

// Load Call Logs from disk
try {
  if (fs.existsSync(CALL_LOGS_FILE_PATH)) {
    const raw = fs.readFileSync(CALL_LOGS_FILE_PATH, 'utf-8');
    callLogsList = JSON.parse(raw);
  } else {
    fs.writeFileSync(CALL_LOGS_FILE_PATH, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error('Error reading call logs:', e);
}

function saveCallLogsToDisk() {
  try {
    fs.writeFileSync(CALL_LOGS_FILE_PATH, JSON.stringify(callLogsList.slice(-200), null, 2));
  } catch (e) {
    console.error('Failed to save call logs:', e);
  }
}

let userAccounts: Record<string, UserRecord> = {};

// Load user DB from disk if exists
try {
  if (fs.existsSync(DB_FILE_PATH)) {
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    userAccounts = JSON.parse(raw);
  } else {
    userAccounts = {};
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(userAccounts, null, 2));
  }
} catch (e) {
  console.error('Error reading user DB:', e);
}

function saveUserDbToDisk() {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(userAccounts, null, 2));
  } catch (e) {
    console.error('Failed to save user DB to disk:', e);
  }
}


const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Initial Simulated Mesh Network State (Relay Infrastructure Nodes)
let meshNodes: MeshNode[] = [
  {
    id: 'node-relay-01',
    name: 'রিলে টাওয়ার ১ (Relay Node 01)',
    type: 'RELAY_TOWER',
    status: 'RELAY_ONLY',
    batteryLevel: 100,
    x: 45,
    y: 25,
    signalRange: 45,
    rssi: -62,
    connectedPeers: ['node-relay-02'],
    publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQERelayTowerKey01',
    lastSeen: Date.now(),
    ipAddress: '192.168.43.1',
    bluetoothMac: 'DD:EE:FF:44:55:66',
  },
  {
    id: 'node-relay-02',
    name: 'রিলে নোড ২ (Hilltop Relay 02)',
    type: 'RELAY_TOWER',
    status: 'RELAY_ONLY',
    batteryLevel: 100,
    x: 68,
    y: 42,
    signalRange: 45,
    rssi: -71,
    connectedPeers: ['node-relay-01', 'node-charlie', 'node-sos-beacon'],
    publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQERelayTowerKey02',
    lastSeen: Date.now(),
    ipAddress: '192.168.43.2',
    bluetoothMac: 'FF:EE:DD:66:55:44',
  },
  {
    id: 'node-sos-beacon',
    name: 'জরুরী বকন (Emergency SOS Beacon)',
    type: 'EMERGENCY_BEACON',
    status: 'EMERGENCY_BEACON',
    batteryLevel: 99,
    x: 88,
    y: 18,
    signalRange: 40,
    rssi: -50,
    connectedPeers: ['node-relay-02'],
    publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEASOSBeaconKey2026',
    lastSeen: Date.now(),
    ipAddress: '192.168.43.99',
    bluetoothMac: '99:88:77:66:55:44',
  },
];

// In-Memory Packet Log & Store-and-Forward Queue
let meshPackets: MeshPacket[] = [];
let emergencyAlerts: EmergencyAlert[] = [];
const storeAndForwardQueue: Map<string, MeshPacket[]> = new Map();

/**
 * Calculate dynamic link connectivity based on canvas positions & signal ranges
 */
function recalculateTopology() {
  for (let i = 0; i < meshNodes.length; i++) {
    const nodeA = meshNodes[i];
    nodeA.connectedPeers = [];

    if (nodeA.status === 'OFFLINE') continue;

    for (let j = 0; j < meshNodes.length; j++) {
      if (i === j) continue;
      const nodeB = meshNodes[j];
      if (nodeB.status === 'OFFLINE') continue;

      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Check if within overlapping ranges
      if (distance <= (nodeA.signalRange + nodeB.signalRange) * 0.75) {
        nodeA.connectedPeers.push(nodeB.id);
      }
    }
  }
}

recalculateTopology();

/**
 * Compute multi-hop route between source and target using Breadth-First-Search (BFS) / AODV
 */
function findShortestMeshRoute(sourceId: string, targetId: string): ActiveRoute | null {
  if (sourceId === targetId) return null;

  const queue: { id: string; path: string[] }[] = [{ id: sourceId, path: [sourceId] }];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === targetId) {
      const totalHops = path.length - 1;
      return {
        sourceId,
        destinationId: targetId,
        path,
        totalHops,
        estLatencyMs: totalHops * 14 + 8,
        avgRssi: -50 - totalHops * 12,
      };
    }

    const currNode = meshNodes.find((n) => n.id === id);
    if (currNode && currNode.status !== 'OFFLINE') {
      for (const peerId of currNode.connectedPeers) {
        if (!visited.has(peerId)) {
          visited.add(peerId);
          queue.push({ id: peerId, path: [...path, peerId] });
        }
      }
    }
  }
  return null; // Route unreachable directly
}

// WebSocket Connection Handlers
const activeSockets: Set<WebSocket> = new Set();
let connectionCount = 0;

function broadcastToAllWs(data: object) {
  const json = JSON.stringify(data);
  activeSockets.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

function broadcastToOthersWs(senderWs: WebSocket, data: object) {
  const json = JSON.stringify(data);
  activeSockets.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(json);
    }
  });
}

const clientNodeMap = new Map<WebSocket, string>();

// Candidate node slots for dynamic assignment
const PREDEFINED_USER_NODES = ['node-alpha-self', 'node-bravo', 'node-charlie', 'node-delta'];

wss.on('connection', (ws) => {
  activeSockets.add(ws);

  // Find currently used node IDs
  const usedNodeIds = new Set(Array.from(clientNodeMap.values()));

  // Pick the first unassigned user node ID
  let assignedNodeId = PREDEFINED_USER_NODES.find((id) => !usedNodeIds.has(id));

  if (!assignedNodeId) {
    const socketIndex = activeSockets.size;
    assignedNodeId = `node-device-${socketIndex}`;
    // Add dynamic node if not existing
    if (!meshNodes.find((n) => n.id === assignedNodeId)) {
      meshNodes.push({
        id: assignedNodeId,
        name: `ডিভাইস ${socketIndex} (Peer Node)`,
        type: 'MOBILE_USER',
        status: 'ONLINE',
        batteryLevel: 90,
        x: Math.floor(Math.random() * 60) + 20,
        y: Math.floor(Math.random() * 60) + 20,
        signalRange: 35,
        rssi: -50,
        connectedPeers: ['node-relay-01'],
        publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${assignedNodeId}`,
        lastSeen: Date.now(),
        ipAddress: `192.168.43.${100 + socketIndex}`,
      });
      recalculateTopology();
    }
  }

  clientNodeMap.set(ws, assignedNodeId);

  // Mark assigned node as ONLINE
  const matchedNode = meshNodes.find((n) => n.id === assignedNodeId);
  if (matchedNode) {
    matchedNode.status = 'ONLINE';
    matchedNode.lastSeen = Date.now();
  }

  const onlineCount = activeSockets.size;

  // Send initial state + assigned node info to newly connected client
  ws.send(
    JSON.stringify({
      type: 'INIT_STATE',
      nodes: meshNodes,
      packets: meshPackets.slice(-30),
      emergencyAlerts,
      assignedNodeId,
      assignedNodeName: matchedNode ? matchedNode.name : assignedNodeId,
      onlineCount,
      agoraConfig: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled,
      },
    })
  );

  // Notify everyone of updated topology and online device count
  broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'SET_MY_NODE' || data.type === 'REGISTER_USER') {
        const nodeId = data.nodeId || data.code;
        const name = data.name;
        const pin = data.pin;
        const phone = data.phone;
        const photo = data.profile_photo || data.photo;

        if (nodeId) {
          // Check PIN Security for registered numbers
          const existingAcc = userAccounts[nodeId];
          if (existingAcc && pin && existingAcc.pin !== pin) {
            ws.send(
              JSON.stringify({
                type: 'AUTH_FAILED',
                error: '⚠️ এই ৬-ডিজিটের নাম্বারটি সুরক্ষার জন্য সংরক্ষিত! ভুল পিন (PIN) দেওয়া হয়েছে। সঠিক পিন দিয়ে প্রবেশ করুন।',
              })
            );
            return;
          }

          // Save or update account in persistent local + MySQL DB
          userAccounts[nodeId] = {
            code: nodeId,
            name: name || existingAcc?.name || `ইউজার (${nodeId})`,
            phone: phone || existingAcc?.phone || '',
            pin: pin || existingAcc?.pin || '1234',
            profile_photo: photo || existingAcc?.profile_photo,
            registeredAt: existingAcc?.registeredAt || Date.now(),
          };
          saveUserDbToDisk();

          // Save to MySQL DB if connected
          saveOrUpdateUser({
            code: nodeId,
            name: userAccounts[nodeId].name,
            phone: userAccounts[nodeId].phone,
            pin: userAccounts[nodeId].pin,
            profile_photo: userAccounts[nodeId].profile_photo,
            registeredAt: userAccounts[nodeId].registeredAt,
          });

          const oldNodeId = clientNodeMap.get(ws);
          clientNodeMap.set(ws, nodeId);

          // Re-map candidate node ID (e.g. node-bravo -> 223344) to prevent target mismatch
          if (oldNodeId && oldNodeId !== nodeId) {
            const oldNode = meshNodes.find((n) => n.id === oldNodeId);
            if (oldNode) {
              oldNode.id = nodeId;
            }
          }

          let matchedNode = meshNodes.find((n) => n.id === nodeId);
          if (matchedNode) {
            matchedNode.status = 'ONLINE';
            matchedNode.lastSeen = Date.now();
            if (name) matchedNode.name = name;
            if (photo) matchedNode.avatarUrl = photo;
          } else {
            // Register new 6-digit user node in active topology
            matchedNode = {
              id: nodeId,
              name: name || `ইউজার (${nodeId})`,
              type: 'MOBILE_USER',
              status: 'ONLINE',
              batteryLevel: 95,
              x: Math.floor(Math.random() * 50) + 25,
              y: Math.floor(Math.random() * 50) + 25,
              signalRange: 35,
              rssi: -52,
              connectedPeers: ['node-relay-01', 'node-relay-02'],
              publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${nodeId}`,
              lastSeen: Date.now(),
              avatarUrl: photo,
              ipAddress: `192.168.43.${Math.floor(Math.random() * 150) + 20}`,
            };
            meshNodes.push(matchedNode);
            recalculateTopology();
          }

          ws.send(
            JSON.stringify({
              type: 'AUTH_SUCCESS',
              code: nodeId,
              name: userAccounts[nodeId].name,
              user: userAccounts[nodeId],
            })
          );

          // If old node is no longer used by any active socket, mark offline
          if (oldNodeId && oldNodeId !== nodeId) {
            const isOldStillUsed = Array.from(clientNodeMap.values()).includes(oldNodeId);
            if (!isOldStillUsed) {
              const oldMatched = meshNodes.find((n) => n.id === oldNodeId);
              if (oldMatched && oldMatched.type === 'MOBILE_USER') {
                oldMatched.status = 'OFFLINE';
              }
            }
          }

          broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === 'UPDATE_NODE_NAME') {
        const { id, name } = data;
        const target = meshNodes.find((n) => n.id === id);
        if (target && name) {
          target.name = name;
          if (userAccounts[id]) {
            userAccounts[id].name = name;
            saveUserDbToDisk();
            saveOrUpdateUser(userAccounts[id]);
          }
          broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === 'UPDATE_NODE_POSITION') {
        const { id, x, y, status } = data;
        const target = meshNodes.find((n) => n.id === id);
        if (target) {
          if (x !== undefined) target.x = x;
          if (y !== undefined) target.y = y;
          if (status !== undefined) target.status = status;
          recalculateTopology();
          broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === 'ADD_RELAY_NODE') {
        const newNode: MeshNode = {
          id: `node-relay-${Date.now().toString().slice(-4)}`,
          name: `রিলে নোড ${meshNodes.length + 1} (Relay)`,
          type: 'RELAY_TOWER',
          status: 'RELAY_ONLY',
          batteryLevel: 100,
          x: data.x || 50,
          y: data.y || 50,
          signalRange: 30,
          rssi: -55,
          connectedPeers: [],
          publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${Date.now()}`,
          lastSeen: Date.now(),
        };
        meshNodes.push(newNode);
        recalculateTopology();
        broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount: activeSockets.size });
      } else if (data.type === 'SEND_MESH_PACKET') {
        const packet: MeshPacket = data.packet;
        
        // Find route trace
        const route = findShortestMeshRoute(packet.senderId, packet.targetId);
        if (route) {
          packet.routingTrace = route.path;
          packet.hopCount = route.totalHops;
        } else {
          packet.routingTrace = [packet.senderId, 'node-relay-01', 'DIRECT_MESH_RELAY'];
          packet.hopCount = 1;
        }

        meshPackets.push(packet);

        // Save Chat Message to MySQL DB
        saveChatMessage({
          packetId: packet.id,
          senderId: packet.senderId,
          senderName: packet.senderName,
          targetId: packet.targetId,
          content: packet.encryptedPayload || '',
          type: packet.fileName ? 'FILE' : packet.type === 'VOICE_MEMO' ? 'VOICE' : packet.type === 'EMERGENCY_SOS' ? 'SOS' : 'TEXT',
          encryptedContent: packet.encryptedPayload,
          routingTrace: packet.routingTrace,
          hopCount: packet.hopCount,
          timestamp: packet.timestamp || Date.now(),
        });

        // If File packet, also save to MySQL shared_files
        if (packet.fileName && packet.encryptedPayload) {
          saveSharedFile({
            fileId: packet.id,
            senderId: packet.senderId,
            senderName: packet.senderName,
            fileName: packet.fileName,
            fileType: 'application/octet-stream',
            fileSize: `${Math.round(packet.encryptedPayload.length * 0.75 / 1024)} KB`,
            fileData: packet.encryptedPayload,
            uploadedAt: packet.timestamp || Date.now(),
          });
        }

        broadcastToAllWs({ type: 'PACKET_RELAYED', packet, route });
      } else if (data.type === 'EMERGENCY_SOS_BROADCAST') {
        const alert: EmergencyAlert = data.alert;
        emergencyAlerts.push(alert);
        broadcastToAllWs({ type: 'EMERGENCY_ALERT_RECEIVED', alert });
      } else if (data.type === 'VOICE_CHUNK_STREAM') {
        const senderId = clientNodeMap.get(ws) || data.chunk?.senderId || 'node-alpha-self';
        const senderNode = meshNodes.find((n) => n.id === senderId);
        const senderName = senderNode ? senderNode.name : (data.chunk?.senderName || 'Peer Node');

        const chunkWithSender = {
          ...data.chunk,
          senderId,
          senderName,
        };
        broadcastToOthersWs(ws, { type: 'VOICE_CHUNK_RECEIVED', chunk: chunkWithSender });
      } else if (data.type === 'VOICE_CALL_SIGNAL') {
        const { action, callerId, callerName, targetId } = data;
        const callerNode = meshNodes.find((n) => n.id === callerId) || { name: callerName || callerId };
        const targetNode = meshNodes.find((n) => n.id === targetId);

        if (action === 'INITIATE') {
          // Broadcast INCOMING_CALL signal to target user socket / mesh clients
          broadcastToAllWs({
            type: 'INCOMING_CALL',
            callerId,
            callerName: callerName || callerNode.name,
            targetId,
            timestamp: Date.now(),
          });
        } else if (action === 'ACCEPT') {
          broadcastToAllWs({
            type: 'CALL_ACCEPTED',
            callerId,
            targetId,
            timestamp: Date.now(),
          });
        } else if (action === 'REJECT') {
          broadcastToAllWs({
            type: 'CALL_REJECTED',
            callerId,
            targetId,
            reason: 'User declined call',
          });
        } else if (action === 'END') {
          broadcastToAllWs({
            type: 'CALL_ENDED',
            callerId,
            targetId,
          });
        }
      }
    } catch (err) {
      console.error('WS Error parsing message:', err);
    }
  });

  ws.on('close', () => {
    activeSockets.delete(ws);
    const nodeId = clientNodeMap.get(ws);
    clientNodeMap.delete(ws);

    // If no other socket is using this nodeId, mark node OFFLINE
    if (nodeId) {
      const isStillUsed = Array.from(clientNodeMap.values()).includes(nodeId);
      if (!isStillUsed) {
        const nodeObj = meshNodes.find((n) => n.id === nodeId);
        if (nodeObj && nodeObj.type === 'MOBILE_USER') {
          nodeObj.status = 'OFFLINE';
        }
      }
    }

    broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes, onlineCount: activeSockets.size });
  });
});

function getAreaByCoordinates(x: number, y: number): string {
  if (x < 40 && y < 40) return 'ঢাকা নর্থ (উত্তরা / গুলশান নোড)';
  if (x >= 40 && x < 70 && y < 50) return 'ঢাকা সেন্ট্রাল (মিরপুর / ধানমন্ডি হাব)';
  if (x >= 70 && y < 50) return 'চট্টগ্রাম ইস্ট রেঞ্জ';
  if (y >= 50 && x < 50) return 'সিলেট ও কুমিল্লা মেস জোন';
  return 'ঢাকা সাউথ (সদরঘাট / নারায়ণগঞ্জ কভারেজ)';
}

async function syncDbUsersToMeshNodes() {
  try {
    const dbUserMap = await getAllUsers();
    const dbUsers = Object.values(dbUserMap);
    if (dbUsers.length > 0) {
      dbUsers.forEach((u) => {
        userAccounts[u.code] = {
          code: u.code,
          name: u.name,
          phone: u.phone || '',
          pin: u.pin || '1234',
          profile_photo: u.profile_photo || '',
          registeredAt: u.registeredAt || Date.now(),
        };

        const isOnline = Array.from(clientNodeMap.values()).includes(u.code);
        let matched = meshNodes.find((n) => n.id === u.code);
        if (matched) {
          matched.name = u.name;
          matched.status = isOnline ? 'ONLINE' : 'OFFLINE';
          if (u.profile_photo) matched.avatarUrl = u.profile_photo;
          if (!matched.locationArea) {
            matched.locationArea = getAreaByCoordinates(matched.x, matched.y);
          }
        } else {
          const randX = Math.floor(Math.random() * 50) + 25;
          const randY = Math.floor(Math.random() * 50) + 25;
          meshNodes.push({
            id: u.code,
            name: u.name,
            type: 'MOBILE_USER',
            status: isOnline ? 'ONLINE' : 'OFFLINE',
            batteryLevel: Math.floor(Math.random() * 30) + 70,
            x: randX,
            y: randY,
            signalRange: 35,
            rssi: -55,
            connectedPeers: ['node-relay-01'],
            publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${u.code}`,
            lastSeen: Date.now(),
            avatarUrl: u.profile_photo,
            locationArea: getAreaByCoordinates(randX, randY),
          });
        }
      });
      recalculateTopology();
    }
  } catch (err) {
    console.error('Error syncing DB users to mesh nodes:', err);
  }
}

// Initial DB Sync
initDatabase().then(() => {
  syncDbUsersToMeshNodes();
}).catch((err) => console.error('DB Init error:', err));
app.get('/api/mesh/nodes', (req, res) => {
  res.json({ status: 'ok', nodes: meshNodes });
});

app.get('/api/mesh/route', (req, res) => {
  const { from, to } = req.query;
  if (typeof from === 'string' && typeof to === 'string') {
    const route = findShortestMeshRoute(from, to);
    res.json({ route });
  } else {
    res.status(400).json({ error: 'Missing from/to parameters' });
  }
});

app.post('/api/mesh/reset', (req, res) => {
  recalculateTopology();
  broadcastToAllWs({ type: 'TOPOLOGY_UPDATED', nodes: meshNodes });
  res.json({ success: true, nodes: meshNodes });
});

// Database Status & Operations API
app.get('/api/db/status', (req, res) => {
  res.json({
    connected: isDbConnected(),
    databaseName: process.env.DB_NAME || 'national_banglacallapp',
    host: process.env.DB_HOST || 'localhost',
    userCount: Object.keys(userAccounts).length,
    packetCount: meshPackets.length,
  });
});

app.get('/api/db/users', async (req, res) => {
  try {
    const dbUsers = await getAllUsers();
    const mergedUsers = { ...userAccounts, ...dbUsers };
    res.json({
      success: true,
      users: mergedUsers,
      dbUsers,
      localUsers: userAccounts,
      isDbConnected: isDbConnected(),
      totalUsers: Object.keys(mergedUsers).length,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, localUsers: userAccounts });
  }
});

app.post('/api/db/users/update', async (req, res) => {
  try {
    const { code, name, phone, pin, profile_photo } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'User code is required' });
    }

    const existing: UserRecord = userAccounts[code] || { code, name: name || code, phone: phone || '', pin: pin || '1234', profile_photo: profile_photo || '', registeredAt: Date.now() };
    const updated: UserRecord = {
      code,
      name: name || existing.name,
      phone: phone || existing.phone,
      pin: pin || existing.pin,
      profile_photo: profile_photo || existing.profile_photo,
      registeredAt: existing.registeredAt,
    };

    userAccounts[code] = updated;
    saveUserDbToDisk();

    // Also update matched mesh node
    const matchedNode = meshNodes.find((n) => n.id === code);
    if (matchedNode) {
      matchedNode.name = updated.name;
      if (updated.profile_photo) matchedNode.avatarUrl = updated.profile_photo;
    }

    const savedInDb = await saveOrUpdateUser({
      code: updated.code,
      name: updated.name,
      phone: updated.phone,
      pin: updated.pin,
      profile_photo: updated.profile_photo,
      registeredAt: updated.registeredAt,
    });

    res.json({ success: true, user: updated, savedInDb });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/chat', async (req, res) => {
  try {
    const user1 = req.query.user1 as string;
    const user2 = req.query.user2 as string;
    const history = await getChatHistory(user1, user2);
    res.json({ success: true, history });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db/files', async (req, res) => {
  try {
    const senderId = req.query.senderId as string;
    const files = await getSharedFiles(senderId);
    res.json({ success: true, files });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/files/upload', async (req, res) => {
  try {
    const { fileId, senderId, senderName, fileName, fileType, fileSize, fileData } = req.body;
    if (!fileId || !senderId || !fileName) {
      return res.status(400).json({ error: 'fileId, senderId, and fileName are required' });
    }

    const record = {
      fileId,
      senderId,
      senderName: senderName || senderId,
      fileName,
      fileType: fileType || 'application/octet-stream',
      fileSize: fileSize || '0 KB',
      fileData,
      uploadedAt: Date.now(),
    };

    const saved = await saveSharedFile(record);
    res.json({ success: true, saved, file: record });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Agora Configuration & Settings Endpoints (Master Control)
app.get('/api/agora/token', (req, res) => {
  try {
    const channelName = req.query.channelName as string;

    if (!channelName) {
      return res.status(400).json({ error: 'channelName is required' });
    }

    let token: string | null = null;
    if (agoraConfig.appCertificate) {
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

      token = RtcTokenBuilder.buildTokenWithUid(
        agoraConfig.appId,
        agoraConfig.appCertificate,
        channelName,
        0, // wildcard UID 0 allows any client joining the channel
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    }

    res.json({
      success: true,
      appId: agoraConfig.appId,
      channelName,
      token,
    });
  } catch (err: any) {
    console.error('Error generating Agora token:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/agora/config', (req, res) => {
  res.json({
    success: true,
    appId: agoraConfig.appId,
    appCertificate: agoraConfig.appCertificate ? '••••••••' + agoraConfig.appCertificate.slice(-4) : '',
    hasCertificate: Boolean(agoraConfig.appCertificate),
    mode: agoraConfig.mode,
    enabled: agoraConfig.enabled,
  });
});

app.post('/api/agora/config', (req, res) => {
  try {
    const { appId, appCertificate, mode, enabled } = req.body;
    if (appId !== undefined) agoraConfig.appId = appId.trim();
    if (appCertificate !== undefined && appCertificate !== '••••••••' && !appCertificate.startsWith('••••')) {
      agoraConfig.appCertificate = appCertificate.trim();
    }
    if (mode !== undefined && (mode === 'AGORA' || mode === 'MESH_PCM')) {
      agoraConfig.mode = mode;
    }
    if (enabled !== undefined) agoraConfig.enabled = Boolean(enabled);

    saveAgoraConfigToDisk();

    // Broadcast updated Agora config to all active WebSocket clients
    broadcastToAllWs({
      type: 'AGORA_CONFIG_UPDATED',
      config: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled,
      },
    });

    res.json({
      success: true,
      message: 'Agora настройки আপডেট করা হয়েছে!',
      config: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Call Duration & History Logs Endpoints
app.get('/api/calls/history', async (req, res) => {
  try {
    const userCode = req.query.userCode as string;
    const dbLogs = await getCallLogs(userCode);
    const mergedLogs = dbLogs.length > 0 ? dbLogs : callLogsList;

    // Calculate aggregated stats (total minutes, call counts)
    let totalSeconds = 0;
    const userStats: Record<string, { name: string; totalSeconds: number; callCount: number }> = {};

    mergedLogs.forEach((log) => {
      totalSeconds += log.durationSeconds || 0;

      // Caller stats
      if (!userStats[log.callerCode]) {
        userStats[log.callerCode] = { name: log.callerName || log.callerCode, totalSeconds: 0, callCount: 0 };
      }
      userStats[log.callerCode].totalSeconds += log.durationSeconds || 0;
      userStats[log.callerCode].callCount += 1;

      // Receiver stats
      if (!userStats[log.receiverCode]) {
        userStats[log.receiverCode] = { name: log.receiverName || log.receiverCode, totalSeconds: 0, callCount: 0 };
      }
      userStats[log.receiverCode].totalSeconds += log.durationSeconds || 0;
      userStats[log.receiverCode].callCount += 1;
    });

    const totalMinutes = Number((totalSeconds / 60).toFixed(2));

    res.json({
      success: true,
      logs: mergedLogs,
      summary: {
        totalCalls: mergedLogs.length,
        totalSeconds,
        totalMinutes,
        userStats,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, logs: callLogsList });
  }
});

app.post('/api/calls/log', async (req, res) => {
  try {
    const { callId, callerCode, callerName, receiverCode, receiverName, startTime, endTime, durationSeconds, callMode, status } = req.body;
    if (!callerCode || !receiverCode) {
      return res.status(400).json({ error: 'callerCode and receiverCode are required' });
    }

    const start = startTime || Date.now() - (durationSeconds || 0) * 1000;
    const end = endTime || Date.now();
    const durSec = durationSeconds || Math.max(0, Math.floor((end - start) / 1000));
    const durMin = Number((durSec / 60).toFixed(2));

    const logRecord: CallLogRecord = {
      callId: callId || `call-${Date.now()}`,
      callerCode,
      callerName: callerName || callerCode,
      receiverCode,
      receiverName: receiverName || receiverCode,
      startTime: start,
      endTime: end,
      durationSeconds: durSec,
      durationMinutes: durMin,
      callMode: callMode || agoraConfig.mode || 'AGORA',
      status: status || 'COMPLETED',
    };

    callLogsList.unshift(logRecord);
    saveCallLogsToDisk();

    // Save to MySQL DB
    saveCallLog(logRecord);

    // Broadcast log update to master dashboard / clients
    broadcastToAllWs({ type: 'CALL_LOG_ADDED', log: logRecord });

    res.json({ success: true, log: logRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Setup Vite Development Server or Static Serving
async function startServer() {
  // Initialize MySQL database
  console.log('[Server] Initializing MySQL Database...');
  const dbConnected = await initDatabase();
  if (dbConnected) {
    try {
      const dbUsers = await getAllUsers();
      if (Object.keys(dbUsers).length > 0) {
        userAccounts = { ...userAccounts, ...dbUsers };
        saveUserDbToDisk();
      }
    } catch (e) {
      console.error('[Server] Failed syncing initial DB users:', e);
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[MeshTalk] Server running on http://localhost:${PORT}`);
  });
}

startServer();

