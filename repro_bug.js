const fs = require('fs');

const payload = "Hello World";
const base64Payload = Buffer.from(payload).toString('base64'); // "SGVsbG8gV29ybGQ="
const dataUri = `data:application/octet-stream;base64,${base64Payload}`;

console.log("Original Payload:", payload);
console.log("Base64 Payload:", base64Payload);
console.log("Data URI:", dataUri);

// Simulate the bug: passing Data URI directly to Buffer.from(..., 'base64')
const corruptedBuffer = Buffer.from(dataUri, 'base64');
console.log("Corrupted Buffer (Hex):", corruptedBuffer.toString('hex'));
console.log("Corrupted Buffer (String):", corruptedBuffer.toString());

// Simulate the fix: stripping the prefix
const fixedBuffer = Buffer.from(dataUri.split(';base64,').pop(), 'base64');
console.log("Fixed Buffer (String):", fixedBuffer.toString());

if (corruptedBuffer.toString() !== payload) {
    console.log("BUG REPRODUCED: Buffer.from(dataUri, 'base64') corrupted the data.");
} else {
    console.log("No bug found (unexpected).");
}
