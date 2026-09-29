const fs = require('fs');
const p = process.argv[2];
const a = parseInt(process.argv[3] || '1');
const b = parseInt(process.argv[4] || String(a + 200));
const lines = fs.readFileSync(p, 'utf8').split(/\r?\n/);
for (let i = a; i <= Math.min(b, lines.length); i++) console.log(i + ' | ' + lines[i - 1]);
