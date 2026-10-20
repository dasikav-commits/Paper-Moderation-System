import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const extraArgs = process.argv.slice(2);
const portFlagIndex = extraArgs.findIndex((a) => a === '-p' || a === '--port');
const port =
  portFlagIndex !== -1 && extraArgs[portFlagIndex + 1]
    ? extraArgs[portFlagIndex + 1]
    : process.env.PORT || '3000';

const hostFlags = extraArgs.some((a) => a === '-H' || a === '--hostname')
  ? []
  : ['-H', '0.0.0.0'];
const portFlags = portFlagIndex !== -1 ? [] : ['-p', String(port)];

const codespaceName = process.env.CODESPACE_NAME;
const forwardingDomain =
  process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
const codespaceUrl = codespaceName
  ? `https://${codespaceName}-${port}.${forwardingDomain}`
  : null;

if (codespaceUrl) {
  console.log('');
  console.log('========================================================================');
  console.log('  GitHub Codespaces Detected!');
  console.log(`  Open your app using THIS URL in your browser:`);
  console.log(`  -> ${codespaceUrl}`);
  console.log('  (Or click the "Ports" tab next to "Terminal" -> Globe icon on 3000)');
  console.log('========================================================================');
  console.log('');
}

const nextBin = path.join(rootDir, 'node_modules', '.bin', 'next');
const child = spawn(nextBin, ['dev', ...hostFlags, ...portFlags, ...extraArgs], {
  cwd: rootDir,
  stdio: 'inherit',
  env: process.env,
  shell: process.platform === 'win32',
});

// Once Next.js starts listening locally in GitHub Codespaces, trigger $BROWSER automatically
if (codespaceUrl && process.env.BROWSER) {
  const pollReady = async () => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        const res = await fetch(`http://127.0.0.1:${port}`, { redirect: 'manual' });
        if (res.status > 0) {
          console.log(`\nOpening in browser: ${codespaceUrl}\n`);
          const opener = spawn(process.env.BROWSER, [codespaceUrl], {
            stdio: 'ignore',
            detached: true,
          });
          opener.unref();
          return;
        }
      } catch {
        // Server still warming up
      }
    }
  };
  pollReady().catch(() => {});
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (!child.killed) {
      child.kill(sig);
    }
  });
}

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
