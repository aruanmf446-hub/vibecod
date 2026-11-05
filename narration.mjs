import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

// Only trusted server announcements can request synthesis; HTTP can only retrieve clips.
export function createPiperTts({ enabled = false, root = '.', python = 'python3', model = '/opt/piper/voices/pt_BR-faber-medium.onnx', comments = false, spawnWorker = spawn, timeoutMs = 45000 } = {}) {
  let worker = null, line = '', retryAt = 0, sampleCache = new Map();
  const jobs = new Map(), clips = new Map();
  function prune() {
    const now = Date.now();
    for (const [id, clip] of clips) if (clip.expires < now) clips.delete(id);
    while (clips.size > 24) clips.delete(clips.keys().next().value);
  }
  function fail() {
    const old = worker; worker = null; line = ''; retryAt = Date.now() + 30000;
    old?.kill();
    for (const job of jobs.values()) { clearTimeout(job.timer); job.resolve(null); }
    jobs.clear();
  }
  function boot() {
    if (worker) return true;
    if (Date.now() < retryAt) return false;
    const child = spawnWorker(python, [path.join(root, 'scripts/piper_worker.py')], {
      env: { ...process.env, PIPER_MODEL: model, OMP_NUM_THREADS: '1', OPENBLAS_NUM_THREADS: '1' },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    worker = child;
    child.once('error', () => { if (worker === child) fail(); });
    child.once('exit', () => { if (worker === child) fail(); });
    child.stderr.on('data', () => {}); // Drain internal errors without exposing paths/text to viewers.
    child.stdin.on('error', () => { if (worker === child) fail(); });
    child.stdout.on('data', chunk => {
      if (worker !== child) return;
      line += chunk.toString();
      if (line.length > 3_000_000) { fail(); return; }
      let end;
      while ((end = line.indexOf('\n')) !== -1) {
        const current = line.slice(0, end); line = line.slice(end + 1);
        try {
          const response = JSON.parse(current), job = jobs.get(response.id);
          if (!job) continue;
          jobs.delete(response.id); clearTimeout(job.timer);
          if (!response.audio || !Number.isFinite(response.duration) || response.duration > 30) { job.resolve(null); continue; }
          const wav = Buffer.from(response.audio, 'base64');
          if (wav.length < 44 || wav.length > 2_000_000 || wav.toString('ascii', 8, 12) !== 'WAVE' || wav.toString('ascii', 0, 4) !== 'RIFF') { job.resolve(null); continue; }
          clips.set(response.id, { wav, expires: Date.now() + 300000 }); prune();
          job.resolve({ audioUrl: '/api/narration/' + response.id, audioDuration: response.duration });
        } catch { fail(); return; }
      }
    });
    return true;
  }
  function generate(text) {
    if (jobs.size >= 6 || !boot()) return Promise.resolve(null);
    return new Promise(resolve => {
      const id = randomUUID();
      const timer = setTimeout(() => { if (jobs.has(id)) fail(); }, timeoutMs);
      jobs.set(id, { resolve, timer });
      worker.stdin.write(JSON.stringify({ id, text: String(text).slice(0, 240) }) + '\n');
    });
  }
  return {
    enabled,
    sample(key = 'sample', text = 'Voz ativada. Prontos para a batalha!') {
      if (!enabled) return Promise.resolve(null);
      let item = sampleCache.get(key);
      if (!item || Date.now() >= item.expires) {
        item = { expires: Date.now() + 240000, duration: 8 };
        item.promise = generate(text).then(clip => {
          if (!clip) { item.expires = Date.now() + 30000; return null; }
          item.duration = clip.audioDuration;
          return clips.get(clip.audioUrl.split('/').pop())?.wav || null;
        });
        sampleCache.set(key, item);
        while (sampleCache.size > 7) sampleCache.delete(sampleCache.keys().next().value);
      }
      return item.promise;
    },
    sampleDuration(key) { return sampleCache.get(key)?.duration || 8; },
    publish(data, send) {
      prune();
      if (!enabled || (data.kind === 'comment' && !comments)) { send(data); return; }
      void generate(data.speech).then(clip => send({ ...data, ...clip }));
    },
    get(id) { prune(); return clips.get(id)?.wav || null; },
    close() { fail(); clips.clear(); sampleCache.clear(); }
  };
}
