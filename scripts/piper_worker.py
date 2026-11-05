"""Private JSON-lines worker: one CPU session, no public port or user filenames."""
import base64
import io
import json
import os
import resource
import sys
import time
import wave
from pathlib import Path
import onnxruntime as ort
from piper import PiperVoice
from piper.config import PiperConfig

model = Path(os.environ['PIPER_MODEL'])
options = ort.SessionOptions()
options.intra_op_num_threads = 1
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(model), sess_options=options, providers=['CPUExecutionProvider'])
voice = PiperVoice(session=session, config=PiperConfig.from_dict(json.loads(Path(str(model) + '.json').read_text())))
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        text = str(request['text'])[:240].replace('[', '').replace(']', '')
        started = time.monotonic()
        output = io.BytesIO()
        with wave.open(output, 'wb') as wav:
            voice.synthesize_wav(text, wav)
        audio = output.getvalue()
        with wave.open(io.BytesIO(audio), 'rb') as wav:
            duration = wav.getnframes() / wav.getframerate()
        if len(audio) > 2_000_000 or duration > 30:
            raise ValueError('Clip too long')
        result = {'id': request['id'], 'audio': base64.b64encode(audio).decode(), 'duration': duration,
                  'elapsed_ms': round((time.monotonic() - started) * 1000),
                  'peak_rss_mb': round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 1)}
    except Exception:
        result = {'id': request.get('id'), 'error': 'synthesis_failed'}
    print(json.dumps(result), flush=True)
