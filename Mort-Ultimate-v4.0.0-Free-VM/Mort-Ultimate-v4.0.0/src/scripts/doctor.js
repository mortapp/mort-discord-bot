require('dotenv').config();

const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');
const { runtimeConfig } = require('../config/runtime');
const { getDataDirectory } = require('../services/dataStore');

let ok = true;
console.log(`Mort Doctor v${pkg.version}`);

for (const key of ['DISCORD_TOKEN', 'CLIENT_ID']) {
  if (!process.env[key]) {
    console.log(`❌ Missing ${key}`);
    ok = false;
  } else {
    console.log(`✅ ${key} found`);
  }
}

try {
  const config = runtimeConfig();
  console.log(`✅ Runtime config valid (${config.nodeEnv}, command auto-register: ${config.autoRegisterCommands ? 'ON' : 'OFF'})`);
  if (config.autoRegisterCommands && !process.env.GUILD_ID) {
    console.log('⚠️ AUTO_REGISTER_COMMANDS=true will overwrite global commands on every startup. Prefer npm run register or set a test GUILD_ID.');
  }
} catch (error) {
  console.log(`❌ Invalid runtime configuration: ${error.message}`);
  ok = false;
}

try {
  const directory = getDataDirectory();
  fs.mkdirSync(directory, { recursive: true });
  const probe = path.join(directory, `.mort-write-probe-${process.pid}`);
  fs.writeFileSync(probe, 'ok', { mode: 0o600 });
  fs.unlinkSync(probe);
  console.log(`✅ DATA_FILE directory is writable (${directory})`);
} catch (error) {
  console.log(`❌ DATA_FILE directory is not writable: ${error.message}`);
  ok = false;
}

for (const file of ['src/index.js', 'src/register-commands.js', 'package.json', '.env.example', '.gitignore', '.dockerignore']) {
  if (fs.existsSync(path.resolve(process.cwd(), file))) console.log(`✅ ${file}`);
  else { console.log(`❌ Missing ${file}`); ok = false; }
}

if (!process.env.OWNER_IDS) console.log('⚠️ OWNER_IDS is unset. The server owner can still use sensitive server actions, but configure owners for operational access.');
console.log(ok ? '✅ Mort looks ready for a controlled deploy.' : '❌ Fix the required items above.');
process.exit(ok ? 0 : 1);
