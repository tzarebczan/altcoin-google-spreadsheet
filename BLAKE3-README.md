# BLAKE3 JavaScript Implementation

A detailed, precise, and optimized pure JavaScript implementation of the BLAKE3 cryptographic hash function.

## Overview

BLAKE3 is a cryptographic hash function that is:
- **Fast**: Significantly faster than MD5, SHA-1, SHA-2, SHA-3, and BLAKE2
- **Secure**: 128-bit security level, resistant to length extension attacks
- **Parallel**: Highly parallelizable tree structure (1024-byte chunks)
- **Versatile**: Works as a hash, MAC, KDF, and XOF (extendable output function)
- **Simple**: Fewer rounds (7 vs 10) and simpler algorithm than BLAKE2

## Features

✅ **Complete Implementation**
- Full BLAKE3 specification compliance
- All three modes: hash, keyed_hash, derive_key
- Extendable output (XOF) support
- Binary tree structure for parallel processing

✅ **Optimized for JavaScript**
- Efficient 32-bit operations
- Minimal memory allocations
- Clean, readable code structure
- No external dependencies

✅ **Cross-Platform**
- Node.js / CommonJS
- Browser / ES modules
- Google Apps Script
- Any JavaScript environment

## Installation

### For Node.js

```javascript
const BLAKE3 = require('./blake3.js');
```

### For Browsers

```html
<script src="blake3.js"></script>
<script>
  const hash = BLAKE3.hashHex('Hello, World!');
  console.log(hash);
</script>
```

### For Google Apps Script

1. Create a new script file in your Google Apps Script project
2. Copy the contents of `blake3.js` into the file
3. Use the global `BLAKE3` object in your code

## Quick Start

### Basic Hashing

```javascript
// Hash a string (returns hex string)
const hash = BLAKE3.hashHex('Hello, BLAKE3!');
console.log(hash);
// Output: 32-byte hash as 64-character hex string

// Hash a string (returns Uint8Array)
const hashBytes = BLAKE3.hash('Hello, BLAKE3!');
console.log(hashBytes); // Uint8Array(32)
```

### Incremental Hashing

```javascript
// For large data or streaming
const hasher = new BLAKE3.Hasher();
hasher.update('Part 1');
hasher.update('Part 2');
hasher.update('Part 3');
const hash = hasher.finalizeHex();
```

### Extendable Output (XOF)

```javascript
// Get any length output (up to 2^64 bytes)
const hash16 = BLAKE3.hashHex('data', 16);  // 16 bytes
const hash64 = BLAKE3.hashHex('data', 64);  // 64 bytes
const hash128 = BLAKE3.hashHex('data', 128); // 128 bytes
```

## API Reference

### Simple Functions

#### `BLAKE3.hash(input, outputLength = 32)`

Hash input data and return bytes.

- **input**: `Uint8Array` or `string` - Data to hash
- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `Uint8Array` - Hash output

```javascript
const hash = BLAKE3.hash('Hello, World!');
console.log(hash); // Uint8Array(32)
```

#### `BLAKE3.hashHex(input, outputLength = 32)`

Hash input data and return hex string.

- **input**: `Uint8Array` or `string` - Data to hash
- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `string` - Hex-encoded hash

```javascript
const hash = BLAKE3.hashHex('Hello, World!');
console.log(hash); // "fa11a3..."
```

### Keyed Hashing (MAC)

#### `BLAKE3.keyedHash(key, input, outputLength = 32)`

Compute a keyed hash (Message Authentication Code).

- **key**: `Uint8Array` or `string` - 32-byte key
- **input**: `Uint8Array` or `string` - Data to hash
- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `Uint8Array` - Hash output

```javascript
const key = new Uint8Array(32); // Your secret key
const mac = BLAKE3.keyedHash(key, 'Message to authenticate');
```

**Use Cases:**
- Message authentication codes (MAC)
- HMAC replacement (faster, simpler)
- Authenticated encryption
- API request signing

### Key Derivation

#### `BLAKE3.deriveKey(context, keyMaterial, outputLength = 32)`

Derive a subkey from key material with domain separation.

- **context**: `string` - Context for domain separation
- **keyMaterial**: `Uint8Array` or `string` - Source key material
- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `Uint8Array` - Derived key

```javascript
const derivedKey = BLAKE3.deriveKey(
  'my-app-encryption-key-v1',
  'source-key-material',
  32
);
```

**Use Cases:**
- Derive multiple keys from one master key
- Domain separation for different purposes
- Key hierarchy creation
- Deterministic key generation

### Hasher Class

#### `new BLAKE3.Hasher()`

Create a new hasher for incremental hashing.

```javascript
const hasher = new BLAKE3.Hasher();
hasher.update('Part 1');
hasher.update('Part 2');
const hash = hasher.finalize();
```

#### `hasher.update(input)`

Add data to the hash.

- **input**: `Uint8Array` or `string` - Data to add
- **Returns**: `Hasher` - This hasher (for chaining)

```javascript
hasher.update('First part').update('Second part');
```

#### `hasher.finalize(outputLength = 32)`

Finalize the hash and return output bytes.

- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `Uint8Array` - Hash output

```javascript
const hash = hasher.finalize();
const longHash = hasher.finalize(64); // 64-byte output
```

#### `hasher.finalizeHex(outputLength = 32)`

Finalize the hash and return hex string.

- **outputLength**: `number` - Output length in bytes (default: 32)
- **Returns**: `string` - Hex-encoded hash

```javascript
const hashHex = hasher.finalizeHex();
```

## Advanced Usage

### Content-Addressed Storage

```javascript
function storeContent(data) {
  const address = BLAKE3.hashHex(data);
  localStorage.setItem(address, data);
  return address;
}

function retrieveContent(address) {
  return localStorage.getItem(address);
}
```

### File Integrity Verification

```javascript
function hashFile(fileContent) {
  return BLAKE3.hashHex(fileContent);
}

function verifyFile(fileContent, expectedHash) {
  const actualHash = hashFile(fileContent);
  return actualHash === expectedHash;
}

// Usage
const content = readFile('document.txt');
const hash = hashFile(content);
console.log('File hash:', hash);

// Later, verify integrity
if (verifyFile(content, hash)) {
  console.log('File is intact');
} else {
  console.log('File has been modified!');
}
```

### Merkle Tree Construction

```javascript
function buildMerkleTree(leaves) {
  // Hash all leaves
  let level = leaves.map(leaf => BLAKE3.hash(leaf));

  // Build tree bottom-up
  while (level.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        // Hash pair
        const combined = new Uint8Array(64);
        combined.set(level[i], 0);
        combined.set(level[i + 1], 32);
        nextLevel.push(BLAKE3.hash(combined));
      } else {
        // Odd one out, promote to next level
        nextLevel.push(level[i]);
      }
    }
    level = nextLevel;
  }

  return level[0]; // Root hash
}
```

### Deterministic Random Number Generation

```javascript
function deterministicRandom(seed, index, outputBytes = 32) {
  const context = `random-v1-${index}`;
  return BLAKE3.deriveKey(context, seed, outputBytes);
}

// Generate deterministic random values
const seed = 'my-secret-seed';
const random1 = deterministicRandom(seed, 0);
const random2 = deterministicRandom(seed, 1);
const random3 = deterministicRandom(seed, 2);
```

## Google Apps Script Examples

### Hash Spreadsheet Data

```javascript
function hashSpreadsheetRow() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var range = sheet.getRange('A1:D1');
  var data = range.getValues()[0];

  // Concatenate row data
  var dataString = data.join('|');

  // Compute hash
  var hash = BLAKE3.hashHex(dataString);

  // Store hash in column E
  sheet.getRange('E1').setValue(hash);

  Logger.log('Hash: ' + hash);
}
```

### Verify Data Integrity

```javascript
function verifyDataIntegrity() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getRange('A1:D1').getValues()[0];
  var storedHash = sheet.getRange('E1').getValue();

  var dataString = data.join('|');
  var currentHash = BLAKE3.hashHex(dataString);

  if (currentHash === storedHash) {
    SpreadsheetApp.getUi().alert('✓ Data is intact');
  } else {
    SpreadsheetApp.getUi().alert('✗ Data has been modified!');
  }
}
```

### Generate Unique Content IDs

```javascript
function generateContentIds() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();

  // Skip header row
  for (var i = 1; i < data.length; i++) {
    var rowData = data[i].join('|');

    // Generate short content ID (first 16 hex chars = 8 bytes)
    var contentId = BLAKE3.hashHex(rowData).substring(0, 16);

    // Write to next available column
    var col = data[i].length + 1;
    sheet.getRange(i + 1, col).setValue(contentId);
  }
}
```

### Deduplication

```javascript
function deduplicateData() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var data = sheet.getDataRange().getValues();
  var seen = {};
  var duplicates = [];

  for (var i = 1; i < data.length; i++) {
    var rowData = data[i].join('|');
    var hash = BLAKE3.hashHex(rowData);

    if (seen[hash]) {
      duplicates.push(i + 1); // Store row number (1-indexed)
    } else {
      seen[hash] = true;
    }
  }

  if (duplicates.length > 0) {
    Logger.log('Found duplicates at rows: ' + duplicates.join(', '));
  } else {
    Logger.log('No duplicates found');
  }
}
```

## Technical Specifications

### Algorithm Details

- **Word size**: 32 bits
- **Block size**: 64 bytes (16 words)
- **Chunk size**: 1024 bytes
- **Compression rounds**: 7 (vs 10 in BLAKE2)
- **IV constants**: Same as SHA-256
- **Output**: 32 bytes default (extendable to 2^64 - 1 bytes)
- **Security**: 128-bit collision resistance

### Tree Structure

BLAKE3 uses a binary tree structure:

```
             Root
            /    \
         Parent1  Parent2
        /   \     /    \
    Chunk1 Chunk2 Chunk3 Chunk4
```

- Input is divided into 1024-byte chunks
- Each chunk becomes a leaf in the binary tree
- Parent nodes combine child hashes
- Supports parallel processing at chunk and block levels

### Performance Characteristics

**Advantages:**
- 5x faster than BLAKE2 (single-threaded)
- 20x+ faster than BLAKE2 (multi-threaded, large inputs)
- Faster than MD5 while being cryptographically secure
- Highly parallelizable

**JavaScript Performance:**
- ~10-50 MB/s (single-threaded, depends on engine)
- Memory efficient (minimal allocations)
- No external dependencies

## Security Considerations

### ✅ Appropriate Uses

- File integrity verification (checksums)
- Content-addressed storage
- Merkle trees and authenticated data structures
- Message authentication codes (MAC)
- Key derivation functions (KDF)
- General-purpose hashing

### ⚠️ Inappropriate Uses

- **Password hashing**: BLAKE3 is too fast! Use Argon2, bcrypt, or scrypt
- **Password-based key derivation**: Use Argon2id or PBKDF2
- **Proof of work**: Too fast, not memory-hard

### Best Practices

1. **For passwords**: Use Argon2id, not BLAKE3
2. **For API keys**: Use `deriveKey()` with unique contexts
3. **For MACs**: Use `keyedHash()` with a secret key
4. **For hashing**: Use `hash()` or `hashHex()`
5. **For file integrity**: Store hash alongside file metadata

### Known Limitations

- Not a memory-hard function (unlike Argon2)
- Not designed for password hashing
- Requires proper key management for keyed modes

## Testing

Run the test suite:

```javascript
// Load blake3.js first
// Then load and run blake3-test.js
```

The test suite includes:
- Official BLAKE3 test vectors
- Chunk boundary tests (1024-byte boundaries)
- Incremental hashing tests
- Keyed hash tests
- Key derivation tests
- Performance benchmarks

## Algorithm Flow

### Simple Hash

```
Input → Split into 1024-byte chunks → Hash each chunk →
Build binary tree → Merge parent nodes → Root hash → Output
```

### Chunk Processing

```
Chunk (1024 bytes) → Split into blocks (64 bytes each) →
Compress each block → Chain outputs → Chunk output
```

### Compression Function

```
Initialize state (chaining value + IV + counter + flags) →
7 rounds of mixing (G function) →
Message permutation between rounds →
XOR final state → Output (32 bytes)
```

## Comparison with Other Hashes

| Algorithm | Speed | Security | Use Case |
|-----------|-------|----------|----------|
| **BLAKE3** | ⚡⚡⚡⚡⚡ | 🔒🔒🔒🔒 | General hashing, MAC, KDF |
| BLAKE2 | ⚡⚡⚡ | 🔒🔒🔒🔒 | General hashing, MAC |
| SHA-256 | ⚡⚡ | 🔒🔒🔒🔒 | Legacy compatibility |
| SHA-3 | ⚡ | 🔒🔒🔒🔒 | High security requirements |
| MD5 | ⚡⚡⚡⚡ | 🔒 | Checksums only (broken) |
| Argon2 | ⚡ | 🔒🔒🔒🔒🔒 | Password hashing |

## References

### Official Specification
- [C2SP BLAKE3 Specification](https://github.com/C2SP/C2SP/blob/main/BLAKE3.md)
- [BLAKE3 Paper](https://github.com/BLAKE3-team/BLAKE3-specs)
- [Official Rust/C Implementation](https://github.com/BLAKE3-team/BLAKE3)

### Additional Resources
- [BLAKE3 Announcement](https://github.com/BLAKE3-team/BLAKE3/blob/master/media/BLAKE3.pdf)
- [Fleek Network BLAKE3 Case Study](https://blog.fleek.network/post/fleek-network-blake3-case-study/)
- [Wikipedia: BLAKE (hash function)](https://en.wikipedia.org/wiki/BLAKE_(hash_function))

## License

This implementation is dual-licensed under:
- **MIT License** - See LICENSE file
- **Public Domain (CC0)** - Same as official BLAKE3

Choose whichever license works best for your project.

## Credits

Based on the BLAKE3 cryptographic hash function specification by:
- Jack O'Connor
- Jean-Philippe Aumasson
- Samuel Neves
- Zooko Wilcox-O'Hearn

JavaScript implementation created following the official specification.

## Changelog

### Version 1.0.0 (2025-12-09)
- Initial implementation
- Full BLAKE3 specification compliance
- All three modes: hash, keyed_hash, derive_key
- Extendable output (XOF) support
- Comprehensive test suite
- Google Apps Script examples
- Optimized for JavaScript performance

## Support

For issues, questions, or contributions related to this implementation,
please refer to the repository where this code is hosted.

For BLAKE3 specification questions, see the official BLAKE3 repository:
https://github.com/BLAKE3-team/BLAKE3

---

**Made with ⚡ by following the official BLAKE3 specification**
