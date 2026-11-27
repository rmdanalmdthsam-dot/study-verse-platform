import { spawnSync } from 'node:child_process';
import { loadEnv } from 'vite';

const env = loadEnv('production', process.cwd(), 'VITE_');
const apiBaseUrl = env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  console.error('Set VITE_API_BASE_URL to the HTTPS origin of the deployed StudyVerse API before building the mobile app.');
  process.exit(1);
}

try {
  const parsedUrl = new URL(apiBaseUrl);
  if (
    parsedUrl.protocol !== 'https:' ||
    parsedUrl.pathname !== '/' ||
    parsedUrl.search ||
    parsedUrl.hash ||
    parsedUrl.username ||
    parsedUrl.password
  ) {
    throw new Error();
  }
} catch {
  console.error('VITE_API_BASE_URL must be an HTTPS origin, for example https://studyverse.example.com.');
  process.exit(1);
}

const isWindows = process.platform === 'win32';
const commandShell = process.env.ComSpec || 'cmd.exe';

for (const command of [
  isWindows ? [commandShell, ['/d', '/s', '/c', 'npm.cmd run build']] : ['npm', ['run', 'build']],
  isWindows ? [commandShell, ['/d', '/s', '/c', 'npx.cmd cap sync']] : ['npx', ['cap', 'sync']]
]) {
  const [executable, args] = command;
  const result = spawnSync(executable, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
