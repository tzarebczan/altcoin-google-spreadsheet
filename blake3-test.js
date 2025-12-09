/**
 * BLAKE3 Test Suite and Usage Examples
 *
 * This file contains:
 * - Usage examples for all BLAKE3 modes
 * - Test vectors from the official BLAKE3 test suite
 * - Performance benchmarks
 * - Integration examples
 */

// Load BLAKE3 implementation
// For Node.js: const BLAKE3 = require('./blake3.js');
// For browsers/Apps Script: Load blake3.js first

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

console.log('=== BLAKE3 Usage Examples ===\n');

// Example 1: Simple hashing (default 32-byte output)
console.log('1. Simple Hash:');
const simpleHash = BLAKE3.hashHex('Hello, BLAKE3!');
console.log(`   Input: "Hello, BLAKE3!"`);
console.log(`   Hash:  ${simpleHash}`);
console.log();

// Example 2: Hash with custom output length (XOF - extendable output)
console.log('2. Extendable Output (XOF):');
const shortHash = BLAKE3.hashHex('BLAKE3 XOF', 16); // 16 bytes = 128 bits
const longHash = BLAKE3.hashHex('BLAKE3 XOF', 64);  // 64 bytes = 512 bits
console.log(`   16-byte hash: ${shortHash}`);
console.log(`   64-byte hash: ${longHash}`);
console.log();

// Example 3: Incremental hashing (for large data)
console.log('3. Incremental Hashing:');
const hasher = new BLAKE3.Hasher();
hasher.update('Part 1: ');
hasher.update('Part 2: ');
hasher.update('Part 3');
const incrementalHash = hasher.finalizeHex();
console.log(`   Incremental hash: ${incrementalHash}`);
console.log();

// Example 4: Keyed hashing (MAC - Message Authentication Code)
console.log('4. Keyed Hash (MAC):');
const key = new Uint8Array(32); // 32-byte key
for (let i = 0; i < 32; i++) key[i] = i;
const macHash = BLAKE3.keyedHash(key, 'Authenticated message');
const macHex = Array.from(macHash).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(`   MAC: ${macHex}`);
console.log();

// Example 5: Key derivation
console.log('5. Key Derivation:');
const derivedKey = BLAKE3.deriveKey(
  'my-application-v1',  // Context for domain separation
  'source-key-material', // Source key material
  32                     // Output length
);
const derivedHex = Array.from(derivedKey).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(`   Derived key: ${derivedHex}`);
console.log();

// ============================================================================
// TEST VECTORS
// ============================================================================

console.log('=== BLAKE3 Test Vectors ===\n');

/**
 * Official test vectors from BLAKE3 specification
 * These verify correctness of the implementation
 */
const testVectors = [
  {
    name: 'Empty input',
    input: '',
    expected: 'af1349b9f5f9a1a6a0404dea36dcc9499bcb25c9adc112b7cc9a93cae41f3262'
  },
  {
    name: 'Single byte',
    input: new Uint8Array([0x00]),
    expected: '2d3adedff11b61f14c886e35afa036736dcd87a74d27b5c1510225d0f592e213'
  },
  {
    name: 'Two bytes',
    input: new Uint8Array([0x00, 0x01]),
    expected: 'baf1e39d29a47fe4e71bc0e8a85e1f3e1ca90b79c6e49c9a7eaccd0e20f8e027'
  },
  {
    name: 'Three bytes',
    input: new Uint8Array([0x00, 0x01, 0x02]),
    expected: 'e1be4d7a8ab5560aa4199eea339849ba8e293d55ca0a81006726d184519e647f'
  },
  {
    name: 'Four bytes',
    input: new Uint8Array([0x00, 0x01, 0x02, 0x03]),
    expected: 'f30f5ab28fe047904037f77b6da4fea1e27241c5d132afa1c45e931b4ebd5ec4'
  },
  {
    name: 'ASCII text',
    input: 'abc',
    expected: '6437b3ac38465133ffb63b75273a8db548c558465d79db03fd359c6cd5bd9d85'
  }
];

// Run test vectors
let passedTests = 0;
let totalTests = testVectors.length;

testVectors.forEach(test => {
  const result = BLAKE3.hashHex(test.input);
  const passed = result === test.expected;

  console.log(`Test: ${test.name}`);
  console.log(`  Expected: ${test.expected}`);
  console.log(`  Got:      ${result}`);
  console.log(`  Status:   ${passed ? '✓ PASS' : '✗ FAIL'}`);
  console.log();

  if (passed) passedTests++;
});

console.log(`Test Results: ${passedTests}/${totalTests} passed\n`);

// ============================================================================
// CHUNK BOUNDARY TESTS
// ============================================================================

console.log('=== Chunk Boundary Tests ===\n');

// Test hashing data at chunk boundaries (1024 bytes)
const chunkTests = [
  { size: 1023, name: 'Just under 1 chunk' },
  { size: 1024, name: 'Exactly 1 chunk' },
  { size: 1025, name: 'Just over 1 chunk' },
  { size: 2048, name: 'Exactly 2 chunks' },
  { size: 3000, name: 'Between 2-3 chunks' }
];

chunkTests.forEach(test => {
  const data = new Uint8Array(test.size);
  for (let i = 0; i < test.size; i++) {
    data[i] = i & 0xff;
  }

  const hash = BLAKE3.hashHex(data);
  console.log(`${test.name} (${test.size} bytes):`);
  console.log(`  Hash: ${hash}`);
  console.log();
});

// ============================================================================
// PERFORMANCE BENCHMARKS
// ============================================================================

console.log('=== Performance Benchmarks ===\n');

/**
 * Simple performance test
 * Measures throughput for different data sizes
 */
function benchmarkHash(size, iterations = 100) {
  const data = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    data[i] = i & 0xff;
  }

  const startTime = Date.now();

  for (let i = 0; i < iterations; i++) {
    BLAKE3.hash(data);
  }

  const endTime = Date.now();
  const totalTime = endTime - startTime;
  const avgTime = totalTime / iterations;
  const throughput = (size * iterations) / (totalTime / 1000) / (1024 * 1024); // MB/s

  return {
    avgTime: avgTime.toFixed(2),
    throughput: throughput.toFixed(2)
  };
}

const benchmarks = [
  { size: 64, name: '64 bytes (1 block)' },
  { size: 1024, name: '1 KB (1 chunk)' },
  { size: 4096, name: '4 KB' },
  { size: 16384, name: '16 KB' },
  { size: 65536, name: '64 KB' }
];

benchmarks.forEach(bench => {
  const result = benchmarkHash(bench.size, bench.size > 10000 ? 10 : 100);
  console.log(`${bench.name}:`);
  console.log(`  Avg time: ${result.avgTime} ms`);
  console.log(`  Throughput: ${result.throughput} MB/s`);
  console.log();
});

// ============================================================================
// INTEGRATION EXAMPLES
// ============================================================================

console.log('=== Integration Examples ===\n');

// Example: File integrity checking
console.log('1. File Integrity Check:');
function hashFile(fileContent) {
  return BLAKE3.hashHex(fileContent);
}

const fileContent = 'This is file content...';
const fileHash = hashFile(fileContent);
console.log(`   File hash: ${fileHash}`);
console.log(`   Use this hash to verify file integrity later.`);
console.log();

// Example: Password-based key derivation (combine with Argon2 in production!)
console.log('2. Password-Based Key Derivation:');
console.log('   Note: BLAKE3 is NOT a password hash! Use Argon2 for passwords.');
console.log('   This example shows key derivation from an already-hashed password.');
function deriveEncryptionKey(passwordHash, salt, keyId) {
  const context = `encryption-key-${keyId}`;
  const material = passwordHash + salt;
  return BLAKE3.deriveKey(context, material, 32);
}

const passwordHash = 'already-hashed-with-argon2';
const salt = 'random-salt-value';
const encKey = deriveEncryptionKey(passwordHash, salt, 'v1');
const encKeyHex = Array.from(encKey).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(`   Derived encryption key: ${encKeyHex}`);
console.log();

// Example: Content-addressed storage
console.log('3. Content-Addressed Storage:');
function contentAddress(data) {
  return BLAKE3.hashHex(data);
}

const content1 = 'First document content';
const content2 = 'Second document content';
console.log(`   Document 1 address: ${contentAddress(content1)}`);
console.log(`   Document 2 address: ${contentAddress(content2)}`);
console.log();

// Example: Merkle tree construction
console.log('4. Merkle Tree (Simple Example):');
function hashPair(left, right) {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return BLAKE3.hash(combined);
}

const leaf1 = BLAKE3.hash('data1');
const leaf2 = BLAKE3.hash('data2');
const leaf3 = BLAKE3.hash('data3');
const leaf4 = BLAKE3.hash('data4');

const node1 = hashPair(leaf1, leaf2);
const node2 = hashPair(leaf3, leaf4);
const root = hashPair(node1, node2);

const rootHex = Array.from(root).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(`   Merkle root: ${rootHex}`);
console.log();

// ============================================================================
// GOOGLE APPS SCRIPT SPECIFIC EXAMPLES
// ============================================================================

console.log('=== Google Apps Script Examples ===\n');

console.log('1. Hash Spreadsheet Data:');
console.log(`
function hashSpreadsheetRow() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getRange('A1:D1').getValues()[0];
  var dataString = data.join('|');
  var hash = BLAKE3.hashHex(dataString);
  sheet.getRange('E1').setValue(hash);
}
`);

console.log('2. Verify Data Integrity:');
console.log(`
function verifyDataIntegrity() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getRange('A1:D1').getValues()[0];
  var storedHash = sheet.getRange('E1').getValue();

  var dataString = data.join('|');
  var currentHash = BLAKE3.hashHex(dataString);

  if (currentHash === storedHash) {
    Logger.log('Data is intact');
  } else {
    Logger.log('Data has been modified!');
  }
}
`);

console.log('3. Generate Content IDs:');
console.log(`
function generateContentIds() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var rowData = data[i].join('|');
    var contentId = BLAKE3.hashHex(rowData).substring(0, 16);
    sheet.getRange(i + 1, data[i].length + 1).setValue(contentId);
  }
}
`);

console.log('\n=== All Tests Complete ===');
