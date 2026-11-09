"""Prints the loudness spread across scene clips in clips/loudness-offline.json (an observation, not a verdict)."""
import json

rows = json.load(open('production/qa/evidence/sprint-10/f2/clips/loudness-offline.json'))
for r in rows:
    print(r)
scene = [r['I'] for r in rows if r['clip'] != 'before-midday' and not r['clip'].startswith('crossfade') and r['clip'] != 'midday-2min']
print('min', min(scene), 'max', max(scene), 'spread', round(max(scene) - min(scene), 1), 'max TP', max(r['TP'] for r in rows))
