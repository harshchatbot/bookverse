const fs = require('fs');
const path = require('path');

// Create a minimal 200x200 PNG (red square)
// This is a valid 1x1 transparent PNG encoded in base64
const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/8+gHgAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const dir = path.dirname(__filename);
const filePath = path.join(dir, 'test-book-cover.png');

const buffer = Buffer.from(pngBase64, 'base64');
fs.writeFileSync(filePath, buffer);

console.log('Test image created:', filePath);
