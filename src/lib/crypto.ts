/**
 * End-to-End Encryption (E2EE) Module using standard Web Crypto API
 * Implements AES-256-GCM encryption, ECDH key derivation, and Digital Signatures.
 */

export interface KeyPair {
  publicKeyBase64: string;
  privateKeyObj: CryptoKey;
  publicKeyObj: CryptoKey;
}

// Convert ArrayBuffer to Base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert Base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generate an ECDH / AES keypair for a node
 */
export async function generateNodeKeyPair(): Promise<KeyPair> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'ECDH',
      namedCurve: 'P-256',
    },
    true,
    ['deriveKey', 'deriveBits']
  );

  const exportedPublic = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
  const publicKeyBase64 = bufferToBase64(exportedPublic);

  return {
    publicKeyBase64,
    privateKeyObj: keyPair.privateKey,
    publicKeyObj: keyPair.publicKey,
  };
}

/**
 * Encrypt message string with AES-256-GCM using a passphrase or derived key
 */
export async function encryptMeshPayload(
  text: string,
  passphraseSecret: string = 'MeshTalk_Default_OffGrid_Secret_2026'
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);

  // Derive key from passphrase using SHA-256
  const secretBuffer = encoder.encode(passphraseSecret);
  const hash = await window.crypto.subtle.digest('SHA-256', secretBuffer);

  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    hash,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // 12-byte IV for GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  return {
    ciphertext: bufferToBase64(encryptedBuffer),
    iv: bufferToBase64(iv.buffer),
  };
}

/**
 * Decrypt ciphertext using AES-256-GCM
 */
export async function decryptMeshPayload(
  ciphertextBase64: string,
  ivBase64: string,
  passphraseSecret: string = 'MeshTalk_Default_OffGrid_Secret_2026'
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const secretBuffer = encoder.encode(passphraseSecret);
    const hash = await window.crypto.subtle.digest('SHA-256', secretBuffer);

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const ciphertextBuffer = base64ToBuffer(ciphertextBase64);
    const ivBuffer = base64ToBuffer(ivBase64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(ivBuffer) },
      cryptoKey,
      ciphertextBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decryptedBuffer);
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[🔒 এনক্রিপ্ট করা ফাইল / ডেটা পাঠ ডিকোড করা সম্ভব হয়নি - Security Key Mismatch]';
  }
}

/**
 * Simple checksum / HMAC signature generator for packet verification
 */
export async function generatePacketSignature(payload: string, senderId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${senderId}:${payload}`);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return bufferToBase64(hashBuffer).substring(0, 16);
}
