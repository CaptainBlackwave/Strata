"""Sprint 10 F2 (D65): levels the scene table in src/ui/music.ts to a target integrated loudness.

Reads clips/loudness-offline.json (written by render-offline.cjs) and scales each scene's
vol, swell and layerLevel together by 10^((target - measured) / 20), i.e. the whole voice.
Run from the repo root:  python3 -I production/qa/evidence/sprint-10/f2/scripts/level.py -38.5
"""
import json
import re
import sys

target = float(sys.argv[1])
rows = {r['clip']: r for r in json.load(open('production/qa/evidence/sprint-10/f2/clips/loudness-offline.json'))}
path = 'src/ui/music.ts'
src = open(path).read()


def fix(m):
    line, sid = m.group(0), m.group(1)
    f = 10 ** ((target - rows[sid]['I']) / 20)
    for k in ['vol', 'swell', 'layerLevel']:
        line = re.sub(r'(%s: )([\d.]+)' % k, lambda mm: mm.group(1) + ('%.4f' % (float(mm.group(2)) * f)).rstrip('0').rstrip('.'), line)
    return line


open(path, 'w').write(re.sub(r'^  (\w+): \{ root: .*$', fix, src, flags=re.M))
