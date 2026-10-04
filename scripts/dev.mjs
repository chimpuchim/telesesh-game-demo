// Starts the Socket.IO/API server and the Vite dev server together, with prefixed output.
import { spawn } from 'node:child_process';

const processes = [
  { name: 'server', color: '\x1b[36m', cmd: 'npx', args: ['tsx', 'watch', 'server/index.ts'] },
  { name: 'client', color: '\x1b[35m', cmd: 'npx', args: ['vite'] },
];

const children = processes.map(({ name, color, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = `${color}[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    stream.on('data', (chunk) => {
      for (const line of chunk.toString().split('\n')) {
        if (line.trim()) out.write(prefix + line + '\n');
      }
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${prefix}exited with code ${code}`);
      shutdown(code);
    }
  });
  return child;
});

function shutdown(code = 0) {
  for (const child of children) child.kill('SIGTERM');
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
