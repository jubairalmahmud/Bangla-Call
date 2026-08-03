import mysql from 'mysql2/promise';

// Default configuration with cPanel credentials fallback
const DB_HOST = process.env.DB_HOST || 's3378.usc1.stableserver.net';
const DB_USER = process.env.DB_USER || 'national_banglacallapp';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Banglacallapp@2026';
const DB_NAME = process.env.DB_NAME || 'national_banglacallapp';
const DB_PORT = Number(process.env.DB_PORT) || 3306;

export interface UserRecord {
  code: string;
  name: string;
  phone?: string;
  pin: string;
  profile_photo?: string;
  registeredAt: number;
}

export interface ChatMessageRecord {
  id?: number;
  packetId: string;
  senderId: string;
  senderName: string;
  targetId: string;
  content: string;
  type: 'TEXT' | 'VOICE' | 'SOS' | 'FILE';
  encryptedContent?: string;
  routingTrace?: string[];
  hopCount?: number;
  timestamp: number;
}

export interface SharedFileRecord {
  id?: number;
  fileId: string;
  senderId: string;
  senderName: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  fileData?: string; // Base64 data or path
  uploadedAt: number;
}

export interface CallLogRecord {
  id?: number;
  callId: string;
  callerCode: string;
  callerName: string;
  receiverCode: string;
  receiverName: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  durationMinutes: number;
  callMode: 'AGORA' | 'MESH_PCM';
  status: 'COMPLETED' | 'MISSED' | 'DECLINED';
}

let pool: mysql.Pool | null = null;
let isConnected = false;

export async function initDatabase() {
  try {
    console.log(`[Database] Attempting connection to MySQL DB '${DB_NAME}' on '${DB_HOST}:${DB_PORT}'...`);
    
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Test connection
    const connection = await pool.getConnection();
    console.log(`[Database] ✅ MySQL Database Connected Successfully!`);
    connection.release();
    isConnected = true;

    // Create Tables if not exist
    await createTables();
    return true;
  } catch (error: any) {
    console.warn(`[Database] ⚠️ MySQL Connection failed (${error.message}). Running in fallback local mode.`);
    isConnected = false;
    return false;
  }
}

async function createTables() {
  if (!pool || !isConnected) return;

  try {
    // 1. Users Table (নাম, নাম্বার, ইউজার আইডি/কোড, পিন, প্রোফাইল ছবি)
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

    // 2. Chat History Table (চ্যাট হিস্টোরি - টেক্সট, ভয়েস, ফাইলের মেসেজ)
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

    // 3. Shared Files Table (শেয়ার করা সব ধরনের ফাইল)
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

    // 4. Call Logs Table (ভয়েস কলের সময়সীমা, কত মিনিট কথা হয়েছে তার হিস্ট্রি)
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

    console.log('[Database] ✅ All MySQL database tables initialized (users, chat_history, shared_files, call_logs).');
  } catch (err) {
    console.error('[Database] ❌ Error creating tables:', err);
  }
}

// User Operations
export async function saveOrUpdateUser(user: UserRecord): Promise<boolean> {
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
        user.registeredAt || Date.now(),
      ]
    );
    return true;
  } catch (err) {
    console.error('[Database] Save user failed:', err);
    return false;
  }
}

export async function getUser(code: string): Promise<UserRecord | null> {
  if (!pool || !isConnected) return null;
  try {
    const [rows]: any = await pool.query('SELECT * FROM users WHERE code = ? LIMIT 1', [code]);
    if (rows && rows.length > 0) {
      const row = rows[0];
      return {
        code: row.code,
        name: row.name,
        phone: row.phone || undefined,
        pin: row.pin,
        profile_photo: row.profile_photo || undefined,
        registeredAt: Number(row.registered_at),
      };
    }
  } catch (err) {
    console.error('[Database] Get user failed:', err);
  }
  return null;
}

export async function getAllUsers(): Promise<Record<string, UserRecord>> {
  const result: Record<string, UserRecord> = {};
  if (!pool || !isConnected) return result;
  try {
    const [rows]: any = await pool.query('SELECT * FROM users');
    if (Array.isArray(rows)) {
      for (const row of rows) {
        result[row.code] = {
          code: row.code,
          name: row.name,
          phone: row.phone || undefined,
          pin: row.pin,
          profile_photo: row.profile_photo || undefined,
          registeredAt: Number(row.registered_at),
        };
      }
    }
  } catch (err) {
    console.error('[Database] Get all users failed:', err);
  }
  return result;
}

// Chat History Operations
export async function saveChatMessage(msg: ChatMessageRecord): Promise<boolean> {
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
        msg.timestamp,
      ]
    );
    return true;
  } catch (err) {
    console.error('[Database] Save chat message failed:', err);
    return false;
  }
}

export async function getChatHistory(user1: string, user2?: string, limit: number = 50): Promise<ChatMessageRecord[]> {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT * FROM chat_history`;
    let params: any[] = [];

    if (user1 && user2) {
      query += ` WHERE (sender_id = ? AND target_id = ?) OR (sender_id = ? AND target_id = ?) OR target_id = 'BROADCAST'`;
      params = [user1, user2, user2, user1];
    } else if (user1) {
      query += ` WHERE sender_id = ? OR target_id = ? OR target_id = 'BROADCAST'`;
      params = [user1, user1];
    }

    query += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const [rows]: any = await pool.query(query, params);
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
        timestamp: Number(row.timestamp),
      }));
    }
  } catch (err) {
    console.error('[Database] Get chat history failed:', err);
  }
  return [];
}

// Shared File Operations
export async function saveSharedFile(file: SharedFileRecord): Promise<boolean> {
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
        file.uploadedAt || Date.now(),
      ]
    );
    return true;
  } catch (err) {
    console.error('[Database] Save shared file failed:', err);
    return false;
  }
}

export async function getSharedFiles(senderId?: string): Promise<SharedFileRecord[]> {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT id, file_id, sender_id, sender_name, file_name, file_type, file_size, uploaded_at FROM shared_files`;
    let params: any[] = [];
    if (senderId) {
      query += ` WHERE sender_id = ?`;
      params.push(senderId);
    }
    query += ` ORDER BY uploaded_at DESC LIMIT 50`;

    const [rows]: any = await pool.query(query, params);
    if (Array.isArray(rows)) {
      return rows.map((row) => ({
        id: row.id,
        fileId: row.file_id,
        senderId: row.sender_id,
        senderName: row.sender_name,
        fileName: row.file_name,
        fileType: row.file_type,
        fileSize: row.file_size,
        uploadedAt: Number(row.uploaded_at),
      }));
    }
  } catch (err) {
    console.error('[Database] Get shared files failed:', err);
  }
  return [];
}

// Call Logs Operations
export async function saveCallLog(log: CallLogRecord): Promise<boolean> {
  if (!pool || !isConnected) return false;
  try {
    const durSec = log.durationSeconds || Math.max(0, Math.floor((log.endTime - log.startTime) / 1000));
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
        log.callMode || 'MESH_PCM',
        log.status || 'COMPLETED',
      ]
    );
    return true;
  } catch (err) {
    console.error('[Database] Save call log failed:', err);
    return false;
  }
}

export async function getCallLogs(userCode?: string): Promise<CallLogRecord[]> {
  if (!pool || !isConnected) return [];
  try {
    let query = `SELECT * FROM call_logs`;
    let params: any[] = [];
    if (userCode) {
      query += ` WHERE caller_code = ? OR receiver_code = ?`;
      params = [userCode, userCode];
    }
    query += ` ORDER BY start_time DESC LIMIT 100`;

    const [rows]: any = await pool.query(query, params);
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
        status: row.status,
      }));
    }
  } catch (err) {
    console.error('[Database] Get call logs failed:', err);
  }
  return [];
}

export function isDbConnected(): boolean {
  return isConnected;
}
