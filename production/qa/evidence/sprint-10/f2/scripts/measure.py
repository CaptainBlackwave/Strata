"""Sprint 10 F2: measures every clips/*.webm (real-time app captures) with ffmpeg's ebur128 filter.

Writes clips/loudness-app.json: integrated loudness (LUFS), loudness range (LU), true peak (dBTP).
Run from the repo root:  python3 -I production/qa/evidence/sprint-10/f2/scripts/measure.py [--transcode]
With --transcode each capture is then re-encoded to Opus 96 kb/s in Ogg (to keep the repo small)
and the .webm removed; the table stays the measurement of the original capture.
"""
import glob
import json
import os
import re
import subprocess
import sys

OUT = 'production/qa/evidence/sprint-10/f2/clips/loudness-app.json'
known = {r['clip']: r for r in json.load(open(OUT))} if os.path.exists(OUT) else {}
rows = []
for f in sorted(glob.glob('production/qa/evidence/sprint-10/f2/clips/*.webm')):
    err = subprocess.run(['/usr/bin/ffmpeg', '-hide_banner', '-nostats', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = err[err.rfind('Summary:'):]

    def num(rx):
        m = re.search(rx, s)
        return float(m.group(1)) if m else None

    rows.append({'clip': os.path.basename(f)[:-5], 'I': num(r'I:\s+(-?[\d.]+|-inf) LUFS'), 'LRA': num(r'LRA:\s+(-?[\d.]+) LU'), 'TP': num(r'Peak:\s+(-?[\d.]+|-inf) dBFS')})
    print(rows[-1])
known.update({r['clip']: r for r in rows})  # merge: clips already transcoded keep their measurement
json.dump([known[k] for k in sorted(known) if known[k]['I'] is not None], open(OUT, 'w'), indent=1)

if '--transcode' in sys.argv:
    for f in sorted(glob.glob('production/qa/evidence/sprint-10/f2/clips/*.webm')):
        subprocess.run(['/usr/bin/ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', f, '-c:a', 'libopus', '-b:a', '96k', f[:-5] + '.ogg'], check=True)
        os.remove(f)
