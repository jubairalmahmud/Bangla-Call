var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_http = __toESM(require("http"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_ws = require("ws");
var import_vite = require("vite");
var import_agora_token = __toESM(require("agora-token"), 1);

// src/db/database.ts
var import_promise = __toESM(require("mysql2/promise"), 1);
var DB_HOST = process.env.DB_HOST || "s3378.usc1.stableserver.net";
var DB_USER = process.env.DB_USER || "national_banglacallapp";
var DB_PASSWORD = process.env.DB_PASSWORD || "Banglacallapp@2026";
var DB_NAME = process.env.DB_NAME || "national_banglacallapp";
var DB_PORT = Number(process.env.DB_PORT) || 3306;
var pool = null;
var isConnected = false;
async function initDatabase() {
  const hostsToTry = Array.from(/* @__PURE__ */ new Set([DB_HOST, "s3378.usc1.stableserver.net", "localhost"])).filter(Boolean);
  for (const host of hostsToTry) {
    try {
      console.log(`[Database] Attempting connection to MySQL DB '${DB_NAME}' on '${host}:${DB_PORT}'...`);
      const testPool = import_promise.default.createPool({
        host,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        port: DB_PORT,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 3e3
      });
      const connection = await testPool.getConnection();
      console.log(`[Database] \u2705 MySQL Database Connected Successfully to host '${host}'!`);
      connection.release();
      pool = testPool;
      isConnected = true;
      await createTables();
      return true;
    } catch (error) {
      console.warn(`[Database] MySQL connection attempt to '${host}' failed (${error.message}).`);
    }
  }
  console.warn(`[Database] \u26A0\uFE0F Could not connect to MySQL server on any host. Running in fallback local JSON storage mode.`);
  isConnected = false;
  return false;
}
async function createTables() {
  if (!pool || !isConnected) return;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        code VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        pin VARCHAR(50) NOT NULL DEFAULT '1234',
        profile_photo LONGTEXT DEFAULT NULL,
        registered_at BIGINT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        packet_id VARCHAR(100) NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        target_id VARCHAR(64) NOT NULL,
        content LONGTEXT NOT NULL,
        msg_type VARCHAR(50) NOT NULL DEFAULT 'TEXT',
        encrypted_content LONGTEXT DEFAULT NULL,
        routing_trace TEXT DEFAULT NULL,
        hop_count INT DEFAULT 0,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender_target (sender_id, target_id),
        INDEX idx_timestamp (timestamp)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shared_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        file_id VARCHAR(100) UNIQUE NOT NULL,
        sender_id VARCHAR(64) NOT NULL,
        sender_name VARCHAR(255) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_type VARCHAR(100) NOT NULL,
        file_size VARCHAR(50) NOT NULL,
        file_data LONGTEXT DEFAULT NULL,
        uploaded_at BIGINT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender_file (sender_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        call_id VARCHAR(100) NOT NULL,
        caller_code VARCHAR(64) NOT NULL,
        caller_name VARCHAR(255) NOT NULL,
        receiver_code VARCHAR(64) NOT NULL,
        receiver_name VARCHAR(255) NOT NULL,
        start_time BIGINT NOT NULL,
        end_time BIGINT NOT NULL,
        duration_seconds INT NOT NULL DEFAULT 0,
        duration_minutes DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        call_mode VARCHAR(50) NOT NULL DEFAULT 'MESH_PCM',
        status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_caller (caller_code),
        INDEX idx_receiver (receiver_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log("[Database] \u2705 All MySQL database tables initialized (users, chat_history, shared_files, call_logs).");
  } catch (err) {
    console.error("[Database] \u274C Error creating tables:", err);
  }
}
async function saveOrUpdateUser(user) {
  if (!pool || !isConnected) return false;
  try {
    await pool.query(
      `INSERT INTO users (code, name, phone, pin, profile_photo, registered_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         phone = COALESCE(VALUES(phone), phone),
         pin = VALUES(pin),
         profile_photo = COALESCE(VALUES(profile_photo), profile_photo),
         registered_at = VALUES(registered_at)`,
      [
        user.code,
        user.name,
        user.phone || null,
        user.pin,
        user.profile_photo || null,
        user.registeredAt || Date.now()
      ]
    );
    return true;
  } catch (err) {
    console.error("[Database] Save user failed:", err);
    return false;
  }
}
async function getAllUsers() {
  const result = {};
  if (!pool || !isConnected) return result;
  try {
    const [rows] = await pool.query("SELECT * FROM users");
    if (Array.isArray(rows)) {
      for (const row of rows) {
        result[row.code] = {
          code: row.code,
          name: row.name,
          phone: row.phone || void 0,
          pin: row.pin,
          profile_photo: row.profile_photo || void 0,
          registeredAt: Number(row.registered_at)
        };
      }
    }
  } catch (err) {
    console.error("[Database] Get all users failed:", err);
  }
  return result;
}
async function saveChatMessage(msg) {
  if (!pool || !isConnected) return false;
  try {
    await pool.query(
      `INSERT INTO chat_history (packet_id, sender_id, sender_name, target_id, content, msg_type, encrypted_content, routing_trace, hop_count, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        msg.packetId,
        msg.senderId,
        msg.senderName,
        msg.targetId,
        msg.content,
        msg.type,
        msg.encryptedContent || null,
        JSON.stringify(msg.routingTrace || []),
        msg.hopCount || 0,
        msg.timestamp
      ]
    );
    return true;
  } catch (err) {
    console.error("[Database] Save chat message failed:", err);
    return false;
  }
}
async function getChatHistory(user1, user2, limit = 50) {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT * FROM chat_history`;
    let params = [];
    if (user1 && user2) {
      query += ` WHERE (sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?) OR target_id = 'BROADCAST'`;
      params = [user1, user2, user2, user1];
    } else if (user1) {
      query += ` WHERE sender_id = ? OR target_id = ? OR target_id = 'BROADCAST'`;
      params = [user1, user1];
    }
    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);
    const [rows] = await pool.query(query, params);
    if (Array.isArray(rows)) {
      return rows.reverse().map((row) => ({
        id: row.id,
        packetId: row.packet_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        targetId: row.target_id,
        content: row.content,
        type: row.msg_type,
        encryptedContent: row.encrypted_content,
        routingTrace: row.routing_trace ? JSON.parse(row.routing_trace) : [],
        hopCount: row.hop_count,
        timestamp: Number(row.timestamp)
      }));
    }
  } catch (err) {
    console.error("[Database] Get chat history failed:", err);
  }
  return [];
}
async function saveSharedFile(file) {
  if (!pool || !isConnected) return false;
  try {
    await pool.query(
      `INSERT INTO shared_files (file_id, sender_id, sender_name, file_name, file_type, file_size, file_data, uploaded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         file_name = VALUES(file_name),
         file_size = VALUES(file_size),
         file_data = VALUES(file_data)`,
      [
        file.fileId,
        file.senderId,
        file.senderName,
        file.fileName,
        file.fileType,
        file.fileSize,
        file.fileData || null,
        file.uploadedAt || Date.now()
      ]
    );
    return true;
  } catch (err) {
    console.error("[Database] Save shared file failed:", err);
    return false;
  }
}
async function getSharedFiles(senderId) {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT id, file_id, sender_id, sender_name, file_name, file_type, file_size, uploaded_at FROM shared_files`;
    let params = [];
    if (senderId) {
      query += ` WHERE sender_id = ?`;
      params.push(senderId);
    }
    query += ` ORDER BY uploaded_at DESC LIMIT 50`;
    const [rows] = await pool.query(query, params);
    if (Array.isArray(rows)) {
      return rows.map((row) => ({
        id: row.id,
        fileId: row.file_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        uploadedAt: Number(row.uploaded_at)
      }));
    }
  } catch (err) {
    console.error("[Database] Get shared files failed:", err);
  }
  return [];
}
async function saveCallLog(log) {
  if (!pool || !isConnected) return false;
  try {
    const durSec = log.durationSeconds || Math.max(0, Math.floor((log.endTime - log.startTime) / 1e3));
    const durMin = Number((durSec / 60).toFixed(2));
    await pool.query(
      `INSERT INTO call_logs (call_id, caller_code, caller_name, receiver_code, receiver_name, start_time, end_time, duration_seconds, duration_minutes, call_mode, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.callId,
        log.callerCode,
        log.callerName,
        log.receiverCode,
        log.receiverName,
        log.startTime,
        log.endTime || Date.now(),
        durSec,
        durMin,
        log.callMode || "MESH_PCM",
        log.status || "COMPLETED"
      ]
    );
    return true;
  } catch (err) {
    console.error("[Database] Save call log failed:", err);
    return false;
  }
}
async function getCallLogs(userCode) {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT * FROM call_logs`;
    let params = [];
    if (userCode) {
      query += ` WHERE caller_code = ? OR receiver_code = ?`;
      params = [userCode, userCode];
    }
    query += ` ORDER BY start_time DESC LIMIT 100`;
    const [rows] = await pool.query(query, params);
    if (Array.isArray(rows)) {
      return rows.map((row) => ({
        id: row.id,
        callId: row.call_id,
        callerCode: row.caller_code,
        callerName: row.caller_name,
        receiverCode: row.receiver_code,
        receiverName: row.receiver_name,
        startTime: Number(row.start_time),
        endTime: Number(row.end_time),
        durationSeconds: row.duration_seconds,
        durationMinutes: Number(row.duration_minutes),
        callMode: row.call_mode,
        status: row.status
      }));
    }
  } catch (err) {
    console.error("[Database] Get call logs failed:", err);
  }
  return [];
}
function isDbConnected() {
  return isConnected;
}

// server.ts
var { RtcTokenBuilder, RtcRole } = import_agora_token.default;
var PORT = 3e3;
var app = (0, import_express.default)();
app.use(import_express.default.json({ limit: "50mb" }));
var DB_FILE_PATH = import_path.default.join(process.cwd(), "mesh_user_db.json");
var AGORA_FILE_PATH = import_path.default.join(process.cwd(), "agora_settings.json");
var CALL_LOGS_FILE_PATH = import_path.default.join(process.cwd(), "call_logs.json");
var agoraConfig = {
  appId: process.env.AGORA_APP_ID || "8e48363cdc6c4fc696be606b8f3d6f64",
  appCertificate: process.env.AGORA_APP_CERTIFICATE || "2fc1a4e7638a423ca2b96b0f3cd69fcd",
  mode: "AGORA",
  enabled: true
};
var callLogsList = [];
try {
  if (import_fs.default.existsSync(AGORA_FILE_PATH)) {
    const raw = import_fs.default.readFileSync(AGORA_FILE_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    agoraConfig = { ...agoraConfig, ...parsed };
    if (agoraConfig.appId === "e8992147fd9c48bc8945419fb25dfb3e") {
      agoraConfig.appId = "8e48363cdc6c4fc696be606b8f3d6f64";
      agoraConfig.appCertificate = "2fc1a4e7638a423ca2b96b0f3cd69fcd";
      import_fs.default.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
    }
  } else {
    import_fs.default.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
  }
} catch (e) {
  console.error("Error reading Agora settings:", e);
}
function saveAgoraConfigToDisk() {
  try {
    import_fs.default.writeFileSync(AGORA_FILE_PATH, JSON.stringify(agoraConfig, null, 2));
  } catch (e) {
    console.error("Failed to save Agora settings:", e);
  }
}
try {
  if (import_fs.default.existsSync(CALL_LOGS_FILE_PATH)) {
    const raw = import_fs.default.readFileSync(CALL_LOGS_FILE_PATH, "utf-8");
    callLogsList = JSON.parse(raw);
  } else {
    import_fs.default.writeFileSync(CALL_LOGS_FILE_PATH, JSON.stringify([], null, 2));
  }
} catch (e) {
  console.error("Error reading call logs:", e);
}
function saveCallLogsToDisk() {
  try {
    import_fs.default.writeFileSync(CALL_LOGS_FILE_PATH, JSON.stringify(callLogsList.slice(-200), null, 2));
  } catch (e) {
    console.error("Failed to save call logs:", e);
  }
}
var userAccounts = {};
try {
  if (import_fs.default.existsSync(DB_FILE_PATH)) {
    const raw = import_fs.default.readFileSync(DB_FILE_PATH, "utf-8");
    userAccounts = JSON.parse(raw);
  } else {
    userAccounts = {};
    import_fs.default.writeFileSync(DB_FILE_PATH, JSON.stringify(userAccounts, null, 2));
  }
} catch (e) {
  console.error("Error reading user DB:", e);
}
function saveUserDbToDisk() {
  try {
    import_fs.default.writeFileSync(DB_FILE_PATH, JSON.stringify(userAccounts, null, 2));
  } catch (e) {
    console.error("Failed to save user DB to disk:", e);
  }
}
var server = import_http.default.createServer(app);
var wss = new import_ws.WebSocketServer({ server });
var meshNodes = [
  {
    id: "node-relay-01",
    name: "\u09B0\u09BF\u09B2\u09C7 \u099F\u09BE\u0993\u09AF\u09BC\u09BE\u09B0 \u09E7 (Relay Node 01)",
    type: "RELAY_TOWER",
    status: "RELAY_ONLY",
    batteryLevel: 100,
    x: 45,
    y: 25,
    signalRange: 45,
    rssi: -62,
    connectedPeers: ["node-relay-02"],
    publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQERelayTowerKey01",
    lastSeen: Date.now(),
    ipAddress: "192.168.43.1",
    bluetoothMac: "DD:EE:FF:44:55:66"
  },
  {
    id: "node-relay-02",
    name: "\u09B0\u09BF\u09B2\u09C7 \u09A8\u09CB\u09A1 \u09E8 (Hilltop Relay 02)",
    type: "RELAY_TOWER",
    status: "RELAY_ONLY",
    batteryLevel: 100,
    x: 68,
    y: 42,
    signalRange: 45,
    rssi: -71,
    connectedPeers: ["node-relay-01", "node-charlie", "node-sos-beacon"],
    publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQERelayTowerKey02",
    lastSeen: Date.now(),
    ipAddress: "192.168.43.2",
    bluetoothMac: "FF:EE:DD:66:55:44"
  },
  {
    id: "node-sos-beacon",
    name: "\u099C\u09B0\u09C1\u09B0\u09C0 \u09AC\u0995\u09A8 (Emergency SOS Beacon)",
    type: "EMERGENCY_BEACON",
    status: "EMERGENCY_BEACON",
    batteryLevel: 99,
    x: 88,
    y: 18,
    signalRange: 40,
    rssi: -50,
    connectedPeers: ["node-relay-02"],
    publicKey: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEASOSBeaconKey2026",
    lastSeen: Date.now(),
    ipAddress: "192.168.43.99",
    bluetoothMac: "99:88:77:66:55:44"
  }
];
var meshPackets = [];
var emergencyAlerts = [];
function recalculateTopology() {
  for (let i = 0; i < meshNodes.length; i++) {
    const nodeA = meshNodes[i];
    nodeA.connectedPeers = [];
    if (nodeA.status === "OFFLINE") continue;
    for (let j = 0; j < meshNodes.length; j++) {
      if (i === j) continue;
      const nodeB = meshNodes[j];
      if (nodeB.status === "OFFLINE") continue;
      const dx = nodeA.x - nodeB.x;
      const dy = nodeA.y - nodeB.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance <= (nodeA.signalRange + nodeB.signalRange) * 0.75) {
        nodeA.connectedPeers.push(nodeB.id);
      }
    }
  }
}
recalculateTopology();
function findShortestMeshRoute(sourceId, targetId) {
  if (sourceId === targetId) return null;
  const queue = [{ id: sourceId, path: [sourceId] }];
  const visited = /* @__PURE__ */ new Set([sourceId]);
  while (queue.length > 0) {
    const { id, path: path2 } = queue.shift();
    if (id === targetId) {
      const totalHops = path2.length - 1;
      return {
        sourceId,
        destinationId: targetId,
        path: path2,
        totalHops,
        estLatencyMs: totalHops * 14 + 8,
        avgRssi: -50 - totalHops * 12
      };
    }
    const currNode = meshNodes.find((n) => n.id === id);
    if (currNode && currNode.status !== "OFFLINE") {
      for (const peerId of currNode.connectedPeers) {
        if (!visited.has(peerId)) {
          visited.add(peerId);
          queue.push({ id: peerId, path: [...path2, peerId] });
        }
      }
    }
  }
  return null;
}
var activeSockets = /* @__PURE__ */ new Set();
function broadcastToAllWs(data) {
  const json = JSON.stringify(data);
  activeSockets.forEach((client) => {
    if (client.readyState === import_ws.WebSocket.OPEN) {
      client.send(json);
    }
  });
}
function broadcastToOthersWs(senderWs, data) {
  const json = JSON.stringify(data);
  activeSockets.forEach((client) => {
    if (client !== senderWs && client.readyState === import_ws.WebSocket.OPEN) {
      client.send(json);
    }
  });
}
var clientNodeMap = /* @__PURE__ */ new Map();
var PREDEFINED_USER_NODES = ["node-alpha-self", "node-bravo", "node-charlie", "node-delta"];
wss.on("connection", (ws) => {
  activeSockets.add(ws);
  const usedNodeIds = new Set(Array.from(clientNodeMap.values()));
  let assignedNodeId = PREDEFINED_USER_NODES.find((id) => !usedNodeIds.has(id));
  if (!assignedNodeId) {
    const socketIndex = activeSockets.size;
    assignedNodeId = `node-device-${socketIndex}`;
    if (!meshNodes.find((n) => n.id === assignedNodeId)) {
      meshNodes.push({
        id: assignedNodeId,
        name: `\u09A1\u09BF\u09AD\u09BE\u0987\u09B8 ${socketIndex} (Peer Node)`,
        type: "MOBILE_USER",
        status: "ONLINE",
        batteryLevel: 90,
        x: Math.floor(Math.random() * 60) + 20,
        y: Math.floor(Math.random() * 60) + 20,
        signalRange: 35,
        rssi: -50,
        connectedPeers: ["node-relay-01"],
        publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${assignedNodeId}`,
        lastSeen: Date.now(),
        ipAddress: `192.168.43.${100 + socketIndex}`
      });
      recalculateTopology();
    }
  }
  clientNodeMap.set(ws, assignedNodeId);
  const matchedNode = meshNodes.find((n) => n.id === assignedNodeId);
  if (matchedNode) {
    matchedNode.status = "ONLINE";
    matchedNode.lastSeen = Date.now();
  }
  const onlineCount = activeSockets.size;
  ws.send(
    JSON.stringify({
      type: "INIT_STATE",
      nodes: meshNodes,
      packets: meshPackets.slice(-30),
      emergencyAlerts,
      assignedNodeId,
      assignedNodeName: matchedNode ? matchedNode.name : assignedNodeId,
      onlineCount,
      agoraConfig: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled
      }
    })
  );
  broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount });
  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === "SET_MY_NODE" || data.type === "REGISTER_USER") {
        const nodeId = data.nodeId || data.code;
        const name = data.name;
        const pin = data.pin;
        const phone = data.phone;
        const photo = data.profile_photo || data.photo;
        if (nodeId) {
          const existingAcc = userAccounts[nodeId];
          if (existingAcc && pin && existingAcc.pin !== pin) {
            ws.send(
              JSON.stringify({
                type: "AUTH_FAILED",
                error: "\u26A0\uFE0F \u098F\u0987 \u09EC-\u09A1\u09BF\u099C\u09BF\u099F\u09C7\u09B0 \u09A8\u09BE\u09AE\u09CD\u09AC\u09BE\u09B0\u099F\u09BF \u09B8\u09C1\u09B0\u0995\u09CD\u09B7\u09BE\u09B0 \u099C\u09A8\u09CD\u09AF \u09B8\u0982\u09B0\u0995\u09CD\u09B7\u09BF\u09A4! \u09AD\u09C1\u09B2 \u09AA\u09BF\u09A8 (PIN) \u09A6\u09C7\u0993\u09DF\u09BE \u09B9\u09DF\u09C7\u099B\u09C7\u0964 \u09B8\u09A0\u09BF\u0995 \u09AA\u09BF\u09A8 \u09A6\u09BF\u09DF\u09C7 \u09AA\u09CD\u09B0\u09AC\u09C7\u09B6 \u0995\u09B0\u09C1\u09A8\u0964"
              })
            );
            return;
          }
          userAccounts[nodeId] = {
            code: nodeId,
            name: name || existingAcc?.name || `\u0987\u0989\u099C\u09BE\u09B0 (${nodeId})`,
            phone: phone || existingAcc?.phone || "",
            pin: pin || existingAcc?.pin || "1234",
            profile_photo: photo || existingAcc?.profile_photo,
            registeredAt: existingAcc?.registeredAt || Date.now()
          };
          saveUserDbToDisk();
          saveOrUpdateUser({
            code: nodeId,
            name: userAccounts[nodeId].name,
            phone: userAccounts[nodeId].phone,
            pin: userAccounts[nodeId].pin,
            profile_photo: userAccounts[nodeId].profile_photo,
            registeredAt: userAccounts[nodeId].registeredAt
          });
          const oldNodeId = clientNodeMap.get(ws);
          clientNodeMap.set(ws, nodeId);
          if (oldNodeId && oldNodeId !== nodeId) {
            const oldNode = meshNodes.find((n) => n.id === oldNodeId);
            if (oldNode) {
              oldNode.id = nodeId;
            }
          }
          let matchedNode2 = meshNodes.find((n) => n.id === nodeId);
          if (matchedNode2) {
            matchedNode2.status = "ONLINE";
            matchedNode2.lastSeen = Date.now();
            if (name) matchedNode2.name = name;
            if (photo) matchedNode2.avatarUrl = photo;
          } else {
            matchedNode2 = {
              id: nodeId,
              name: name || `\u0987\u0989\u099C\u09BE\u09B0 (${nodeId})`,
              type: "MOBILE_USER",
              status: "ONLINE",
              batteryLevel: 95,
              x: Math.floor(Math.random() * 50) + 25,
              y: Math.floor(Math.random() * 50) + 25,
              signalRange: 35,
              rssi: -52,
              connectedPeers: ["node-relay-01", "node-relay-02"],
              publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${nodeId}`,
              lastSeen: Date.now(),
              avatarUrl: photo,
              ipAddress: `192.168.43.${Math.floor(Math.random() * 150) + 20}`
            };
            meshNodes.push(matchedNode2);
            recalculateTopology();
          }
          ws.send(
            JSON.stringify({
              type: "AUTH_SUCCESS",
              code: nodeId,
              name: userAccounts[nodeId].name,
              user: userAccounts[nodeId]
            })
          );
          if (oldNodeId && oldNodeId !== nodeId) {
            const isOldStillUsed = Array.from(clientNodeMap.values()).includes(oldNodeId);
            if (!isOldStillUsed) {
              const oldMatched = meshNodes.find((n) => n.id === oldNodeId);
              if (oldMatched && oldMatched.type === "MOBILE_USER") {
                oldMatched.status = "OFFLINE";
              }
            }
          }
          broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === "UPDATE_NODE_NAME") {
        const { id, name } = data;
        const target = meshNodes.find((n) => n.id === id);
        if (target && name) {
          target.name = name;
          if (userAccounts[id]) {
            userAccounts[id].name = name;
            saveUserDbToDisk();
            saveOrUpdateUser(userAccounts[id]);
          }
          broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === "UPDATE_NODE_POSITION") {
        const { id, x, y, status } = data;
        const target = meshNodes.find((n) => n.id === id);
        if (target) {
          if (x !== void 0) target.x = x;
          if (y !== void 0) target.y = y;
          if (status !== void 0) target.status = status;
          recalculateTopology();
          broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount: activeSockets.size });
        }
      } else if (data.type === "ADD_RELAY_NODE") {
        const newNode = {
          id: `node-relay-${Date.now().toString().slice(-4)}`,
          name: `\u09B0\u09BF\u09B2\u09C7 \u09A8\u09CB\u09A1 ${meshNodes.length + 1} (Relay)`,
          type: "RELAY_TOWER",
          status: "RELAY_ONLY",
          batteryLevel: 100,
          x: data.x || 50,
          y: data.y || 50,
          signalRange: 30,
          rssi: -55,
          connectedPeers: [],
          publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${Date.now()}`,
          lastSeen: Date.now()
        };
        meshNodes.push(newNode);
        recalculateTopology();
        broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount: activeSockets.size });
      } else if (data.type === "SEND_MESH_PACKET") {
        const packet = data.packet;
        const route = findShortestMeshRoute(packet.senderId, packet.targetId);
        if (route) {
          packet.routingTrace = route.path;
          packet.hopCount = route.totalHops;
        } else {
          packet.routingTrace = [packet.senderId, "node-relay-01", "DIRECT_MESH_RELAY"];
          packet.hopCount = 1;
        }
        meshPackets.push(packet);
        saveChatMessage({
          packetId: packet.id,
          senderId: packet.senderId,
          senderName: packet.senderName,
          targetId: packet.targetId,
          content: packet.encryptedPayload || "",
          type: packet.fileName ? "FILE" : packet.type === "VOICE_MEMO" ? "VOICE" : packet.type === "EMERGENCY_SOS" ? "SOS" : "TEXT",
          encryptedContent: packet.encryptedPayload,
          routingTrace: packet.routingTrace,
          hopCount: packet.hopCount,
          timestamp: packet.timestamp || Date.now()
        });
        if (packet.fileName && packet.encryptedPayload) {
          saveSharedFile({
            fileId: packet.id,
            senderId: packet.senderId,
            senderName: packet.senderName,
            fileName: packet.fileName,
            fileType: "application/octet-stream",
            fileSize: `${Math.round(packet.encryptedPayload.length * 0.75 / 1024)} KB`,
            fileData: packet.encryptedPayload,
            uploadedAt: packet.timestamp || Date.now()
          });
        }
        broadcastToAllWs({ type: "PACKET_RELAYED", packet, route });
      } else if (data.type === "EMERGENCY_SOS_BROADCAST") {
        const alert = data.alert;
        emergencyAlerts.push(alert);
        broadcastToAllWs({ type: "EMERGENCY_ALERT_RECEIVED", alert });
      } else if (data.type === "VOICE_CHUNK_STREAM") {
        const senderId = clientNodeMap.get(ws) || data.chunk?.senderId || "node-alpha-self";
        const senderNode = meshNodes.find((n) => n.id === senderId);
        const senderName = senderNode ? senderNode.name : data.chunk?.senderName || "Peer Node";
        const chunkWithSender = {
          ...data.chunk,
          senderId,
          senderName
        };
        broadcastToOthersWs(ws, { type: "VOICE_CHUNK_RECEIVED", chunk: chunkWithSender });
      } else if (data.type === "VOICE_CALL_SIGNAL") {
        const { action, callerId, callerName, targetId } = data;
        const callerNode = meshNodes.find((n) => n.id === callerId) || { name: callerName || callerId };
        const targetNode = meshNodes.find((n) => n.id === targetId);
        if (action === "INITIATE") {
          broadcastToAllWs({
            type: "INCOMING_CALL",
            callerId,
            callerName: callerName || callerNode.name,
            targetId,
            timestamp: Date.now()
          });
        } else if (action === "ACCEPT") {
          broadcastToAllWs({
            type: "CALL_ACCEPTED",
            callerId,
            targetId,
            timestamp: Date.now()
          });
        } else if (action === "REJECT") {
          broadcastToAllWs({
            type: "CALL_REJECTED",
            callerId,
            targetId,
            reason: "User declined call"
          });
        } else if (action === "END") {
          broadcastToAllWs({
            type: "CALL_ENDED",
            callerId,
            targetId
          });
        }
      }
    } catch (err) {
      console.error("WS Error parsing message:", err);
    }
  });
  ws.on("close", () => {
    activeSockets.delete(ws);
    const nodeId = clientNodeMap.get(ws);
    clientNodeMap.delete(ws);
    if (nodeId) {
      const isStillUsed = Array.from(clientNodeMap.values()).includes(nodeId);
      if (!isStillUsed) {
        const nodeObj = meshNodes.find((n) => n.id === nodeId);
        if (nodeObj && nodeObj.type === "MOBILE_USER") {
          nodeObj.status = "OFFLINE";
        }
      }
    }
    broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes, onlineCount: activeSockets.size });
  });
});
function getAreaByCoordinates(x, y) {
  if (x < 40 && y < 40) return "\u09A2\u09BE\u0995\u09BE \u09A8\u09B0\u09CD\u09A5 (\u0989\u09A4\u09CD\u09A4\u09B0\u09BE / \u0997\u09C1\u09B2\u09B6\u09BE\u09A8 \u09A8\u09CB\u09A1)";
  if (x >= 40 && x < 70 && y < 50) return "\u09A2\u09BE\u0995\u09BE \u09B8\u09C7\u09A8\u09CD\u099F\u09CD\u09B0\u09BE\u09B2 (\u09AE\u09BF\u09B0\u09AA\u09C1\u09B0 / \u09A7\u09BE\u09A8\u09AE\u09A8\u09CD\u09A1\u09BF \u09B9\u09BE\u09AC)";
  if (x >= 70 && y < 50) return "\u099A\u099F\u09CD\u099F\u0997\u09CD\u09B0\u09BE\u09AE \u0987\u09B8\u09CD\u099F \u09B0\u09C7\u099E\u09CD\u099C";
  if (y >= 50 && x < 50) return "\u09B8\u09BF\u09B2\u09C7\u099F \u0993 \u0995\u09C1\u09AE\u09BF\u09B2\u09CD\u09B2\u09BE \u09AE\u09C7\u09B8 \u099C\u09CB\u09A8";
  return "\u09A2\u09BE\u0995\u09BE \u09B8\u09BE\u0989\u09A5 (\u09B8\u09A6\u09B0\u0998\u09BE\u099F / \u09A8\u09BE\u09B0\u09BE\u09DF\u09A3\u0997\u099E\u09CD\u099C \u0995\u09AD\u09BE\u09B0\u09C7\u099C)";
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
          phone: u.phone || "",
          pin: u.pin || "1234",
          profile_photo: u.profile_photo || "",
          registeredAt: u.registeredAt || Date.now()
        };
        const isOnline = Array.from(clientNodeMap.values()).includes(u.code);
        let matched = meshNodes.find((n) => n.id === u.code);
        if (matched) {
          matched.name = u.name;
          matched.status = isOnline ? "ONLINE" : "OFFLINE";
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
            type: "MOBILE_USER",
            status: isOnline ? "ONLINE" : "OFFLINE",
            batteryLevel: Math.floor(Math.random() * 30) + 70,
            x: randX,
            y: randY,
            signalRange: 35,
            rssi: -55,
            connectedPeers: ["node-relay-01"],
            publicKey: `MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A${u.code}`,
            lastSeen: Date.now(),
            avatarUrl: u.profile_photo,
            locationArea: getAreaByCoordinates(randX, randY)
          });
        }
      });
      recalculateTopology();
    }
  } catch (err) {
    console.error("Error syncing DB users to mesh nodes:", err);
  }
}
initDatabase().then(() => {
  syncDbUsersToMeshNodes();
}).catch((err) => console.error("DB Init error:", err));
app.get("/api/mesh/nodes", (req, res) => {
  res.json({ status: "ok", nodes: meshNodes });
});
app.get("/api/mesh/route", (req, res) => {
  const { from, to } = req.query;
  if (typeof from === "string" && typeof to === "string") {
    const route = findShortestMeshRoute(from, to);
    res.json({ route });
  } else {
    res.status(400).json({ error: "Missing from/to parameters" });
  }
});
app.post("/api/mesh/reset", (req, res) => {
  recalculateTopology();
  broadcastToAllWs({ type: "TOPOLOGY_UPDATED", nodes: meshNodes });
  res.json({ success: true, nodes: meshNodes });
});
app.get("/api/db/status", (req, res) => {
  res.json({
    connected: isDbConnected(),
    databaseName: process.env.DB_NAME || "national_banglacallapp",
    host: process.env.DB_HOST || "localhost",
    userCount: Object.keys(userAccounts).length,
    packetCount: meshPackets.length
  });
});
app.get("/api/db/users", async (req, res) => {
  try {
    const dbUsers = await getAllUsers();
    const mergedUsers = { ...userAccounts, ...dbUsers };
    res.json({
      success: true,
      users: mergedUsers,
      dbUsers,
      localUsers: userAccounts,
      isDbConnected: isDbConnected(),
      totalUsers: Object.keys(mergedUsers).length
    });
  } catch (err) {
    res.status(500).json({ error: err.message, localUsers: userAccounts });
  }
});
app.post("/api/db/users/update", async (req, res) => {
  try {
    const { code, name, phone, pin, profile_photo } = req.body;
    if (!code) {
      return res.status(400).json({ error: "User code is required" });
    }
    const existing = userAccounts[code] || { code, name: name || code, phone: phone || "", pin: pin || "1234", profile_photo: profile_photo || "", registeredAt: Date.now() };
    const updated = {
      code,
      name: name || existing.name,
      phone: phone || existing.phone,
      pin: pin || existing.pin,
      profile_photo: profile_photo || existing.profile_photo,
      registeredAt: existing.registeredAt
    };
    userAccounts[code] = updated;
    saveUserDbToDisk();
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
      registeredAt: updated.registeredAt
    });
    res.json({ success: true, user: updated, savedInDb });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/db/chat", async (req, res) => {
  try {
    const user1 = req.query.user1;
    const user2 = req.query.user2;
    const history = await getChatHistory(user1, user2);
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/db/files", async (req, res) => {
  try {
    const senderId = req.query.senderId;
    const files = await getSharedFiles(senderId);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/db/files/upload", async (req, res) => {
  try {
    const { fileId, senderId, senderName, fileName, fileType, fileSize, fileData } = req.body;
    if (!fileId || !senderId || !fileName) {
      return res.status(400).json({ error: "fileId, senderId, and fileName are required" });
    }
    const record = {
      fileId,
      senderId,
      senderName: senderName || senderId,
      fileName,
      fileType: fileType || "application/octet-stream",
      fileSize: fileSize || "0 KB",
      fileData,
      uploadedAt: Date.now()
    };
    const saved = await saveSharedFile(record);
    res.json({ success: true, saved, file: record });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/agora/token", (req, res) => {
  try {
    const channelName = req.query.channelName;
    if (!channelName) {
      return res.status(400).json({ error: "channelName is required" });
    }
    let token = null;
    if (agoraConfig.appCertificate) {
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1e3);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
      token = RtcTokenBuilder.buildTokenWithUid(
        agoraConfig.appId,
        agoraConfig.appCertificate,
        channelName,
        0,
        // wildcard UID 0 allows any client joining the channel
        RtcRole.PUBLISHER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
    }
    res.json({
      success: true,
      appId: agoraConfig.appId,
      channelName,
      token
    });
  } catch (err) {
    console.error("Error generating Agora token:", err);
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/agora/config", (req, res) => {
  res.json({
    success: true,
    appId: agoraConfig.appId,
    appCertificate: agoraConfig.appCertificate ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" + agoraConfig.appCertificate.slice(-4) : "",
    hasCertificate: Boolean(agoraConfig.appCertificate),
    mode: agoraConfig.mode,
    enabled: agoraConfig.enabled
  });
});
app.post("/api/agora/config", (req, res) => {
  try {
    const { appId, appCertificate, mode, enabled } = req.body;
    if (appId !== void 0) agoraConfig.appId = appId.trim();
    if (appCertificate !== void 0 && appCertificate !== "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" && !appCertificate.startsWith("\u2022\u2022\u2022\u2022")) {
      agoraConfig.appCertificate = appCertificate.trim();
    }
    if (mode !== void 0 && (mode === "AGORA" || mode === "MESH_PCM")) {
      agoraConfig.mode = mode;
    }
    if (enabled !== void 0) agoraConfig.enabled = Boolean(enabled);
    saveAgoraConfigToDisk();
    broadcastToAllWs({
      type: "AGORA_CONFIG_UPDATED",
      config: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled
      }
    });
    res.json({
      success: true,
      message: "Agora \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0986\u09AA\u09A1\u09C7\u099F \u0995\u09B0\u09BE \u09B9\u09DF\u09C7\u099B\u09C7!",
      config: {
        appId: agoraConfig.appId,
        mode: agoraConfig.mode,
        enabled: agoraConfig.enabled
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/calls/history", async (req, res) => {
  try {
    const userCode = req.query.userCode;
    const dbLogs = await getCallLogs(userCode);
    const mergedLogs = dbLogs.length > 0 ? dbLogs : callLogsList;
    let totalSeconds = 0;
    const userStats = {};
    mergedLogs.forEach((log) => {
      totalSeconds += log.durationSeconds || 0;
      if (!userStats[log.callerCode]) {
        userStats[log.callerCode] = { name: log.callerName || log.callerCode, totalSeconds: 0, callCount: 0 };
      }
      userStats[log.callerCode].totalSeconds += log.durationSeconds || 0;
      userStats[log.callerCode].callCount += 1;
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
        userStats
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message, logs: callLogsList });
  }
});
app.post("/api/calls/log", async (req, res) => {
  try {
    const { callId, callerCode, callerName, receiverCode, receiverName, startTime, endTime, durationSeconds, callMode, status } = req.body;
    if (!callerCode || !receiverCode) {
      return res.status(400).json({ error: "callerCode and receiverCode are required" });
    }
    const start = startTime || Date.now() - (durationSeconds || 0) * 1e3;
    const end = endTime || Date.now();
    const durSec = durationSeconds || Math.max(0, Math.floor((end - start) / 1e3));
    const durMin = Number((durSec / 60).toFixed(2));
    const logRecord = {
      callId: callId || `call-${Date.now()}`,
      callerCode,
      callerName: callerName || callerCode,
      receiverCode,
      receiverName: receiverName || receiverCode,
      startTime: start,
      endTime: end,
      durationSeconds: durSec,
      durationMinutes: durMin,
      callMode: callMode || agoraConfig.mode || "AGORA",
      status: status || "COMPLETED"
    };
    callLogsList.unshift(logRecord);
    saveCallLogsToDisk();
    saveCallLog(logRecord);
    broadcastToAllWs({ type: "CALL_LOG_ADDED", log: logRecord });
    res.json({ success: true, log: logRecord });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[MeshTalk] Server running on http://localhost:${PORT}`);
  });
  (async () => {
    console.log("[Server] Initializing MySQL Database...");
    const dbConnected = await initDatabase();
    if (dbConnected) {
      try {
        const dbUsers = await getAllUsers();
        if (Object.keys(dbUsers).length > 0) {
          userAccounts = { ...userAccounts, ...dbUsers };
          saveUserDbToDisk();
        }
      } catch (e) {
        console.error("[Server] Failed syncing initial DB users:", e);
      }
    }
  })();
}
startServer();
//# sourceMappingURL=server.cjs.map
