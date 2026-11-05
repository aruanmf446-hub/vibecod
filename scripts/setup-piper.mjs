// Render native Node runtimes also provide Python. Install at build time, never on a gift.
import { mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
if (process.env.PIPER_SKIP_SETUP === '1' || process.env.PIPER_ENABLED === 'false' ||
    (!process.env.RENDER && !process.argv.includes('--force'))) process.exit(0);
const root = process.cwd();
const base = path.join(root, '.piper');
const python = path.join(base, 'venv', 'bin', 'python');
const voices = path.join(base, 'voices');
mkdirSync(voices, { recursive: true });
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit', timeout: 600000 });
if (!existsSync(python)) run('python3', ['-m', 'venv', path.join(base, 'venv')]);
run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', '--no-cache-dir', '-r', 'scripts/piper-requirements.txt']);
run(python, ['-m', 'piper.download_voices', 'pt_BR-faber-medium', '--data-dir', voices]);
console.log('Piper brasileiro preparado para o servidor.');
