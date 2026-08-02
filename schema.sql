-- ============================================================
-- BANGLA CALL APP - MYSQL DATABASE SCHEMA
-- DATABASE: national_banglacallapp
-- ============================================================

-- 1. Users Table (ইউজার আইডি, নাম, ফোন নাম্বার, পিন, প্রোফাইল ছবি)
CREATE TABLE IF NOT EXISTS users (
  code VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50) DEFAULT NULL,
  pin VARCHAR(50) NOT NULL DEFAULT '1234',
  profile_photo LONGTEXT DEFAULT NULL,
  registered_at BIGINT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Chat History Table (মেসেজ এবং চ্যাট হিস্টোরি - টেক্সট, ভয়েস, ভয়েস মেমো, SOS)
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

-- 3. Shared Files Table (শেয়ার করা ডকুমেন্ট, অডিও, ছবি ও অন্যান্য ফাইল)
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


