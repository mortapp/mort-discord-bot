require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');
const required = ['DISCORD_TOKEN', 'CLIENT_ID'];
let ok = true;
console.log(`Mort Doctor v${pkg.version}`);
for (const key of required) {
  if (!process.env[key]) {
    console.log(`❌ Missing ${key}`);
    ok = false;
  } else {
    console.log(`✅ ${key} found`);
  }
}
for (const file of ['src/index.js', 'src/register-commands.js', 'package.json']) {
  if (fs.existsSync(path.resolve(process.cwd(), file))) console.log(`✅ ${file}`);
  else { console.log(`❌ Missing ${file}`); ok = false; }
}
console.log(ok ? '✅ Mort looks ready.' : '❌ Fix the missing items above.');
process.exit(ok ? 0 : 1);
