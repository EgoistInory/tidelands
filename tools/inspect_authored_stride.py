"""Measure in-place locomotion clock distances from the author's actual RM counterpart."""
import hashlib
import json
import math
import struct
import zipfile
from pathlib import Path
from stage_authored_models import ROOT, ARCHIVES, read_member

if __name__ == '__main__':
    path = ROOT / 'dist/authored-source' / ARCHIVES['animations'][0]
    assert hashlib.sha256(path.read_bytes()).hexdigest() == ARCHIVES['animations'][1]
    member = 'Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard_RM.glb'
    with zipfile.ZipFile(path) as archive: raw = read_member(archive, member)
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 8)[0] == len(raw)
    size = struct.unpack_from('<I', raw, 12)[0]; doc = json.loads(raw[20:20+size]); binary = raw[28+size:]
    def values(index):
        a = doc['accessors'][index]; v = doc['bufferViews'][a['bufferView']]
        assert a['componentType'] == 5126 and a['type'] in ('SCALAR','VEC3')
        width = 1 if a['type'] == 'SCALAR' else 3
        offset = v.get('byteOffset',0)+a.get('byteOffset',0); stride = v.get('byteStride',width*4)
        return [struct.unpack_from('<'+'f'*width,binary,offset+i*stride) for i in range(a['count'])]
    rows = []
    for animation in doc['animations']:
        if animation['name'] not in ('Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Swim_Fwd_Loop'): continue
        channel, = [c for c in animation['channels'] if doc['nodes'][c['target']['node']]['name']=='root' and c['target']['path']=='translation']
        sampler = animation['samplers'][channel['sampler']]; positions = values(sampler['output']); times = values(sampler['input'])
        delta = [positions[-1][i]-positions[0][i] for i in range(3)]
        distance = math.hypot(delta[0],delta[2]); assert abs(delta[1]) < 1e-6 and distance > 0
        duration = times[-1][0]-times[0][0]
        rows.append({'clip':animation['name'],'duration':duration,'rootDelta':delta,'horizontalCycleMeters':distance,'sourceMetersPerSecond':distance/duration})
    assert len(rows) == 4
    report = {'archiveSha256':ARCHIVES['animations'][1], 'sourceMember':member,'sourceGlbSha256':hashlib.sha256(raw).hexdigest(), 'rows':rows,
              'gameRulesChanged':False,'runtimeIntegrated':False,'gameFootSlidingAccepted':False,
              'scope':'Endpoint RM root displacement only. In-place playback uses actual game travel/stride; not evidence for stance-phase no-slip, impact marker, IK or final world scale.'}
    (ROOT/'docs/authored-stride-inventory.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(rows))
