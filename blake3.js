/**
 * BLAKE3 - Cryptographic Hash Function
 *
 * A detailed, precise, and optimized JavaScript implementation of BLAKE3
 * Based on the official BLAKE3 specification (C2SP)
 *
 * Features:
 * - Fast cryptographic hashing with 128-bit security
 * - Parallelizable tree structure (1024-byte chunks)
 * - Support for hash, keyed_hash, and derive_key modes
 * - Extendable output (XOF) support
 * - Default 256-bit (32-byte) output
 *
 * References:
 * - https://github.com/C2SP/C2SP/blob/main/BLAKE3.md
 * - https://github.com/BLAKE3-team/BLAKE3
 *
 * @author Based on BLAKE3 specification
 * @license MIT / Public Domain (CC0)
 */

'use strict';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Initial values - same as SHA-256 IV
 * These are the first 32 bits of the fractional parts of the square roots
 * of the first 8 primes (2, 3, 5, 7, 11, 13, 17, 19)
 */
const IV = new Uint32Array([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
]);

/**
 * Message permutation schedule
 * This single permutation is applied iteratively in each round
 */
const MSG_PERMUTATION = new Uint8Array([
  2, 6, 3, 10, 7, 0, 4, 13, 1, 11, 12, 5, 9, 14, 15, 8
]);

// Architecture parameters
const BLOCK_LEN = 64;        // 64 bytes = 16 words
const CHUNK_LEN = 1024;      // 1024 bytes per chunk
const OUT_LEN = 32;          // Default output length (256 bits)
const KEY_LEN = 32;          // Key length for keyed mode
const MAX_DEPTH = 54;        // Maximum tree depth (for safety)

// Number of rounds in compression function
const ROUNDS = 7;

// Domain separation flags (can be combined with bitwise OR)
const CHUNK_START = 1 << 0;           // 0x01 - First block of a chunk
const CHUNK_END = 1 << 1;             // 0x02 - Last block of a chunk
const PARENT = 1 << 2;                // 0x04 - Parent node (not a chunk)
const ROOT = 1 << 3;                  // 0x08 - Root finalization
const KEYED_HASH = 1 << 4;            // 0x10 - Keyed hash mode
const DERIVE_KEY_CONTEXT = 1 << 5;    // 0x20 - Key derivation context
const DERIVE_KEY_MATERIAL = 1 << 6;   // 0x40 - Key derivation material

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Right rotation of 32-bit unsigned integer
 * Optimized for JavaScript's 32-bit integer operations
 */
function rotr32(x, n) {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Add two 32-bit unsigned integers with wrapping
 */
function add32(a, b) {
  return (a + b) >>> 0;
}

/**
 * Convert byte array to 32-bit words (little-endian)
 */
function bytesToWords(bytes, start, words, wordCount) {
  for (let i = 0; i < wordCount; i++) {
    const offset = start + i * 4;
    words[i] = (
      bytes[offset] |
      (bytes[offset + 1] << 8) |
      (bytes[offset + 2] << 16) |
      (bytes[offset + 3] << 24)
    ) >>> 0;
  }
}

/**
 * Convert 32-bit words to bytes (little-endian)
 */
function wordsToBytes(words, wordCount, bytes, start) {
  for (let i = 0; i < wordCount; i++) {
    const offset = start + i * 4;
    const word = words[i];
    bytes[offset] = word & 0xff;
    bytes[offset + 1] = (word >>> 8) & 0xff;
    bytes[offset + 2] = (word >>> 16) & 0xff;
    bytes[offset + 3] = (word >>> 24) & 0xff;
  }
}

/**
 * Convert string to UTF-8 byte array
 */
function stringToBytes(str) {
  const encoder = typeof TextEncoder !== 'undefined'
    ? new TextEncoder()
    : { encode: s => unescape(encodeURIComponent(s)).split('').map(c => c.charCodeAt(0)) };
  return new Uint8Array(encoder.encode(str));
}

// ============================================================================
// COMPRESSION FUNCTION
// ============================================================================

/**
 * The G mixing function
 * Operates on four state words with two message words
 * Uses addition mod 2^32, XOR, and rotations (16, 12, 8, 7 bits)
 *
 * @param {Uint32Array} state - The 16-word state
 * @param {number} a - Index of first state word
 * @param {number} b - Index of second state word
 * @param {number} c - Index of third state word
 * @param {number} d - Index of fourth state word
 * @param {number} mx - First message word
 * @param {number} my - Second message word
 */
function g(state, a, b, c, d, mx, my) {
  state[a] = add32(add32(state[a], state[b]), mx);
  state[d] = rotr32(state[d] ^ state[a], 16);
  state[c] = add32(state[c], state[d]);
  state[b] = rotr32(state[b] ^ state[c], 12);
  state[a] = add32(add32(state[a], state[b]), my);
  state[d] = rotr32(state[d] ^ state[a], 8);
  state[c] = add32(state[c], state[d]);
  state[b] = rotr32(state[b] ^ state[c], 7);
}

/**
 * Apply one round of mixing
 * Performs 8 G-function calls: 4 column-wise, then 4 diagonal
 *
 * @param {Uint32Array} state - The 16-word state
 * @param {Uint32Array} m - The 16-word message block
 */
function round(state, m) {
  // Column-wise mixing
  g(state, 0, 4, 8, 12, m[0], m[1]);
  g(state, 1, 5, 9, 13, m[2], m[3]);
  g(state, 2, 6, 10, 14, m[4], m[5]);
  g(state, 3, 7, 11, 15, m[6], m[7]);

  // Diagonal mixing
  g(state, 0, 5, 10, 15, m[8], m[9]);
  g(state, 1, 6, 11, 12, m[10], m[11]);
  g(state, 2, 7, 8, 13, m[12], m[13]);
  g(state, 3, 4, 9, 14, m[14], m[15]);
}

/**
 * Permute the message words for the next round
 * Applies the MSG_PERMUTATION schedule in-place
 *
 * @param {Uint32Array} m - The 16-word message block
 */
function permuteMsg(m) {
  const permuted = new Uint32Array(16);
  for (let i = 0; i < 16; i++) {
    permuted[i] = m[MSG_PERMUTATION[i]];
  }
  m.set(permuted);
}

/**
 * BLAKE3 compression function
 * Compresses a 64-byte block with a chaining value
 *
 * @param {Uint32Array} chainingValue - 8-word chaining value (input state)
 * @param {Uint8Array} blockBytes - 64-byte block to compress
 * @param {number} counter - Chunk counter (64-bit, lower 32 bits)
 * @param {number} blockLen - Number of bytes in block (usually 64)
 * @param {number} flags - Domain separation flags
 * @returns {Uint32Array} - 16-word output (first 8 used as chaining value)
 */
function compress(chainingValue, blockBytes, counter, blockLen, flags) {
  // Convert block bytes to words
  const blockWords = new Uint32Array(16);
  bytesToWords(blockBytes, 0, blockWords, 16);

  // Initialize 16-word state
  const state = new Uint32Array(16);

  // First 8 words: chaining value
  state.set(chainingValue, 0);

  // Next 4 words: IV
  state.set(IV.subarray(0, 4), 8);

  // Last 4 words: counter (low), counter (high=0), block length, flags
  state[12] = counter >>> 0;
  state[13] = 0; // High 32 bits of counter (we use 32-bit counters)
  state[14] = blockLen >>> 0;
  state[15] = flags >>> 0;

  // Perform 7 rounds
  const msg = new Uint32Array(blockWords);
  for (let i = 0; i < ROUNDS; i++) {
    round(state, msg);
    permuteMsg(msg);
  }

  // XOR the two halves together
  for (let i = 0; i < 8; i++) {
    state[i] ^= state[i + 8];
    state[i + 8] ^= chainingValue[i];
  }

  return state;
}

/**
 * Extract first 8 words (chaining value) from compression output
 */
function firstHalf(compressionOutput) {
  return compressionOutput.subarray(0, 8);
}

/**
 * Get the full 16-word output from compression
 */
function fullOutput(compressionOutput) {
  return compressionOutput;
}

// ============================================================================
// CHUNK AND OUTPUT PROCESSING
// ============================================================================

/**
 * Output reader for extendable output
 * Can produce arbitrary-length output from a compression result
 */
class Output {
  constructor(inputChainingValue, blockWords, counter, blockLen, flags) {
    this.inputChainingValue = new Uint32Array(inputChainingValue);
    this.blockWords = new Uint8Array(64);
    wordsToBytes(blockWords, 16, this.blockWords, 0);
    this.counter = counter;
    this.blockLen = blockLen;
    this.flags = flags;
  }

  /**
   * Get the chaining value (first 32 bytes of output)
   */
  chainingValue() {
    return firstHalf(compress(
      this.inputChainingValue,
      this.blockWords,
      this.counter,
      this.blockLen,
      this.flags
    ));
  }

  /**
   * Get root output bytes (supports XOF - extendable output)
   * Can generate up to 2^64 bytes by incrementing output counter
   *
   * @param {number} length - Number of output bytes desired
   * @returns {Uint8Array} - Output bytes
   */
  rootOutputBytes(length) {
    const output = new Uint8Array(length);
    let outputBlockCounter = 0;
    let offset = 0;

    while (offset < length) {
      const blockWords = new Uint32Array(16);
      bytesToWords(this.blockWords, 0, blockWords, 16);

      const words = compress(
        this.inputChainingValue,
        this.blockWords,
        outputBlockCounter,
        this.blockLen,
        this.flags | ROOT
      );

      // Convert words to bytes and copy
      const bytesToCopy = Math.min(64, length - offset);
      wordsToBytes(words, 16, output, offset);

      offset += bytesToCopy;
      outputBlockCounter++;
    }

    return output;
  }
}

/**
 * Chunk state - processes a single 1024-byte chunk
 */
class ChunkState {
  constructor(key, chunkCounter, flags) {
    this.chainingValue = new Uint32Array(key);
    this.chunkCounter = chunkCounter;
    this.block = new Uint8Array(BLOCK_LEN);
    this.blockLen = 0;
    this.blocksCompressed = 0;
    this.flags = flags;
  }

  /**
   * Get the number of bytes in this chunk so far
   */
  len() {
    return BLOCK_LEN * this.blocksCompressed + this.blockLen;
  }

  /**
   * Get the starting flags for the current block
   */
  startFlag() {
    return this.blocksCompressed === 0 ? CHUNK_START : 0;
  }

  /**
   * Update the chunk with input bytes
   */
  update(input) {
    let inputOffset = 0;

    while (inputOffset < input.length) {
      // If the block is full, compress it
      if (this.blockLen === BLOCK_LEN) {
        const blockWords = new Uint32Array(16);
        bytesToWords(this.block, 0, blockWords, 16);

        this.chainingValue = firstHalf(compress(
          this.chainingValue,
          this.block,
          this.chunkCounter,
          BLOCK_LEN,
          this.flags | this.startFlag()
        ));

        this.blocksCompressed++;
        this.block = new Uint8Array(BLOCK_LEN);
        this.blockLen = 0;
      }

      // Copy input to block
      const bytesToCopy = Math.min(BLOCK_LEN - this.blockLen, input.length - inputOffset);
      this.block.set(input.subarray(inputOffset, inputOffset + bytesToCopy), this.blockLen);
      this.blockLen += bytesToCopy;
      inputOffset += bytesToCopy;
    }
  }

  /**
   * Finalize the chunk and return its Output
   */
  output() {
    const blockWords = new Uint32Array(16);
    bytesToWords(this.block, 0, blockWords, 16);

    return new Output(
      this.chainingValue,
      blockWords,
      this.chunkCounter,
      this.blockLen,
      this.flags | this.startFlag() | CHUNK_END
    );
  }
}

/**
 * Merge two parent nodes in the tree
 * Left and right are chaining values (8 words each)
 */
function parentOutput(leftChildCV, rightChildCV, key, flags) {
  // Concatenate the two child CVs into a 64-byte block
  const blockWords = new Uint32Array(16);
  blockWords.set(leftChildCV, 0);
  blockWords.set(rightChildCV, 8);

  const blockBytes = new Uint8Array(64);
  wordsToBytes(blockWords, 16, blockBytes, 0);

  return new Output(key, blockWords, 0, BLOCK_LEN, PARENT | flags);
}

/**
 * Merge the chaining values in the CV stack
 * Pops parent nodes as needed to maintain tree structure
 */
function addChunkChainingValue(cvStack, newCV, totalChunks) {
  // Keep merging as long as there are complete subtrees
  let chunksProcessed = totalChunks;
  let currentCV = newCV;

  while (chunksProcessed > 0 && (chunksProcessed & 1) === 0) {
    currentCV = parentOutput(cvStack.pop(), currentCV, IV, 0).chainingValue();
    chunksProcessed >>= 1;
  }

  cvStack.push(currentCV);
}

/**
 * Merge all remaining chaining values in the stack
 * Returns the root chaining value
 */
function mergeStack(cvStack, key, flags) {
  if (cvStack.length === 0) {
    return new Uint32Array(IV);
  }

  if (cvStack.length === 1) {
    return cvStack[0];
  }

  // Merge from right to left
  let cv = cvStack[cvStack.length - 1];
  for (let i = cvStack.length - 2; i >= 0; i--) {
    cv = parentOutput(cvStack[i], cv, key, flags).chainingValue();
  }

  return cv;
}

// ============================================================================
// HASHER - Main Interface
// ============================================================================

/**
 * BLAKE3 Hasher
 * Main interface for hashing data
 */
class Hasher {
  /**
   * Create a new hasher
   * @param {Uint32Array} key - 8-word key (for keyed mode) or IV
   * @param {number} flags - Domain separation flags
   */
  constructor(key = IV, flags = 0) {
    this.chunkState = new ChunkState(key, 0, flags);
    this.key = new Uint32Array(key);
    this.cvStack = [];
    this.flags = flags;
  }

  /**
   * Update the hasher with new input data
   * @param {Uint8Array|string} input - Input data to hash
   * @returns {Hasher} - This hasher (for chaining)
   */
  update(input) {
    // Convert string to bytes if needed
    if (typeof input === 'string') {
      input = stringToBytes(input);
    }

    let inputOffset = 0;

    while (inputOffset < input.length) {
      // If the current chunk is full, finalize it and start a new one
      if (this.chunkState.len() === CHUNK_LEN) {
        const chunkCV = this.chunkState.output().chainingValue();
        const totalChunks = this.chunkState.chunkCounter + 1;
        addChunkChainingValue(this.cvStack, chunkCV, totalChunks);
        this.chunkState = new ChunkState(this.key, totalChunks, this.flags);
      }

      // Add data to the current chunk
      const bytesToCopy = Math.min(CHUNK_LEN - this.chunkState.len(), input.length - inputOffset);
      this.chunkState.update(input.subarray(inputOffset, inputOffset + bytesToCopy));
      inputOffset += bytesToCopy;
    }

    return this;
  }

  /**
   * Finalize the hash and return output
   * @param {number} length - Output length in bytes (default: 32)
   * @returns {Uint8Array} - Hash output
   */
  finalize(length = OUT_LEN) {
    // Get the output from the current (final) chunk
    const output = this.chunkState.output();
    const parentNodesCV = mergeStack(this.cvStack, this.key, this.flags);

    // If there were previous chunks, merge with final chunk
    if (this.cvStack.length === 0) {
      // Only one chunk - use it directly as root
      return output.rootOutputBytes(length);
    } else {
      // Multiple chunks - merge parent nodes with final chunk
      const rootOutput = parentOutput(
        parentNodesCV,
        output.chainingValue(),
        this.key,
        this.flags
      );
      return rootOutput.rootOutputBytes(length);
    }
  }

  /**
   * Finalize and return output as hex string
   * @param {number} length - Output length in bytes (default: 32)
   * @returns {string} - Hex-encoded hash
   */
  finalizeHex(length = OUT_LEN) {
    const bytes = this.finalize(length);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Hash input data with BLAKE3 (unkeyed mode)
 * @param {Uint8Array|string} input - Data to hash
 * @param {number} outputLength - Output length in bytes (default: 32)
 * @returns {Uint8Array} - Hash output
 */
function hash(input, outputLength = OUT_LEN) {
  const hasher = new Hasher();
  hasher.update(input);
  return hasher.finalize(outputLength);
}

/**
 * Hash input data with BLAKE3 and return hex string
 * @param {Uint8Array|string} input - Data to hash
 * @param {number} outputLength - Output length in bytes (default: 32)
 * @returns {string} - Hex-encoded hash
 */
function hashHex(input, outputLength = OUT_LEN) {
  const bytes = hash(input, outputLength);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Keyed hash mode - hash with a 32-byte key
 * @param {Uint8Array|string} key - 32-byte key
 * @param {Uint8Array|string} input - Data to hash
 * @param {number} outputLength - Output length in bytes (default: 32)
 * @returns {Uint8Array} - Hash output
 */
function keyedHash(key, input, outputLength = OUT_LEN) {
  if (typeof key === 'string') {
    key = stringToBytes(key);
  }

  if (key.length !== KEY_LEN) {
    throw new Error(`Key must be exactly ${KEY_LEN} bytes`);
  }

  const keyWords = new Uint32Array(8);
  bytesToWords(key, 0, keyWords, 8);

  const hasher = new Hasher(keyWords, KEYED_HASH);
  hasher.update(input);
  return hasher.finalize(outputLength);
}

/**
 * Key derivation mode - derive a subkey from context and key material
 * @param {string} context - Context string (domain separation)
 * @param {Uint8Array|string} keyMaterial - Source key material
 * @param {number} outputLength - Output length in bytes (default: 32)
 * @returns {Uint8Array} - Derived key
 */
function deriveKey(context, keyMaterial, outputLength = OUT_LEN) {
  // First hash the context to get the key for the second hash
  const contextHasher = new Hasher(IV, DERIVE_KEY_CONTEXT);
  contextHasher.update(context);
  const contextKey = contextHasher.finalize(KEY_LEN);

  const contextKeyWords = new Uint32Array(8);
  bytesToWords(contextKey, 0, contextKeyWords, 8);

  // Then hash the key material with the context key
  const materialHasher = new Hasher(contextKeyWords, DERIVE_KEY_MATERIAL);
  materialHasher.update(keyMaterial);
  return materialHasher.finalize(outputLength);
}

// ============================================================================
// EXPORTS
// ============================================================================

// For Node.js / CommonJS
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    hash,
    hashHex,
    keyedHash,
    deriveKey,
    Hasher,
    BLAKE3: {
      hash,
      hashHex,
      keyedHash,
      deriveKey,
      Hasher
    }
  };
}

// For browsers / global scope
if (typeof window !== 'undefined') {
  window.BLAKE3 = {
    hash,
    hashHex,
    keyedHash,
    deriveKey,
    Hasher
  };
}

// For Google Apps Script
if (typeof global !== 'undefined') {
  global.BLAKE3 = {
    hash,
    hashHex,
    keyedHash,
    deriveKey,
    Hasher
  };
}
