// CamFlow Agent — Windows Service Installer
// Installs/uninstalls the agent as a Windows service via node-windows.
// Usage: node service.js --install | --uninstall

import { Service } from 'node-windows';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svc = new Service({
  name: 'CamFlow Agent',
  description:
    'CamFlow local agent — bridges cloud commands to OBS and PTZ hardware',
  script: path.join(__dirname, 'src', 'index.js'),
  env: [
    {
      name: 'NODE_ENV',
      value: 'production',
    },
  ],
  // Working directory where .env file lives
  workingDirectory: 'C:\\ProgramData\\CamFlow\\Agent',
});

svc.on('install', () => {
  console.log('CamFlow Agent service installed. Starting...');
  svc.start();
});

svc.on('alreadyinstalled', () => {
  console.log('CamFlow Agent service already installed.');
});

svc.on('uninstall', () => {
  console.log('CamFlow Agent service uninstalled.');
});

svc.on('error', (err) => {
  console.error('Service error:', err.message);
});

const command = process.argv[2];
if (command === '--install') {
  svc.install();
} else if (command === '--uninstall') {
  svc.uninstall();
} else {
  console.log('Usage: node service.js [--install|--uninstall]');
}
