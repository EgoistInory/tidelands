"""Audit downloaded/staged CC0 evidence and isolated trials, without accepting game quality."""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


if __name__ == '__main__':
    staging = json.loads((ROOT / 'docs/authored-model-staging.json').read_text())
    browser = json.loads((ROOT / 'docs/authored-avatar-browser.json').read_text())
    loader = json.loads((ROOT / 'docs/authored-review-loader.json').read_text())
    for name, expected in loader['files'].items():
        assert digest(ROOT / name) == expected
    for row in staging['archives'].values():
        assert digest(ROOT / 'dist/authored-source' / row['filename']) == row['sha256']
    for name, row in staging['files'].items():
        path = ROOT / staging['stagedDirectory'] / name
        assert path.stat().st_size == row['bytes'] and digest(path) == row['sha256']
    assert len(staging['models']['animations']['animations']) == 43
    for model in staging['models'].values():
        assert model['licenseVerified'] and model['skins'][0]['jointCount'] == 65
    assert staging['models']['male']['triangles'] == 14318
    assert staging['models']['female']['triangles'] == 15060
    assert not staging['runtimeIntegrated']
    assert len(browser['rows']) == 6 and browser['console'] == []
    frames = 0
    for row in browser['rows']:
        state = row['state']
        assert state['ready'] and not state['running'] and not state['hidden'] and state['glError'] == 0
        assert len(state['metadata']['jointNames']) == 65 and len(state['metadata']['offeredClips']) == 43
        assert all(math.isfinite(v) for xyz in state['joints'].values() for v in xyz)
        assert (ROOT / row['image']).read_bytes().startswith(b'\xff\xd8\xff')
        if state['frames']:
            assert state['frames'] == 180 and len(state['poses']) == 6 and state['raf']['samples'] == 179
            assert all(math.isfinite(v) for pose in state['poses'] for xyz in pose['joints'].values() for v in xyz)
            first = state['poses'][0]['joints']
            assert max(math.dist(first[name], xyz) for pose in state['poses'][1:] for name, xyz in pose['joints'].items()) > .01
            frames += state['frames']
    assert frames == 720
    assert any(row['state']['clip'] == 'Swim_Fwd_Loop' for row in browser['rows'])
    for kind, name in [('base', 'quaternius-base-standard.txt'), ('animations', 'quaternius-animation-standard.txt')]:
        assert digest(ROOT / 'docs/licenses' / name) == staging['licenses'][kind]
    result = {'downloadedArchivesVerified': True, 'stagedFilesVerified': len(staging['files']), 'isolatedLoadAndMotionObserved': True,
              'archiveLicensesObserved': True, 'animationClipsInventoried': 43, 'isolatedTrialFrames': frames,
              'images': {row['image']: digest(ROOT / row['image']) for row in browser['rows']},
              'swimStandingFloorOcclusionObserved': True, 'swimHeightAdaptationAccepted': False,
              'directBoneNameTrialOnly': True, 'outfitDelivered': False, 'runtimeIntegrated': False,
              'fullM5Complete': False, 'fullGoalComplete': False,
              'scope': 'Source archives, exact licenses, staged hashes and raw bone-name playback only. Standing-floor swim trial visibly intersects floor; no game rig/IK/equipment, outfit, root/retarget correction, texture performance, device or final quality acceptance.'}
    (ROOT / 'docs/authored-model-audit.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'archivesVerified': True, 'stagedFiles': len(staging['files']), 'actualClips': 43, 'trialFrames': frames, 'runtimeIntegrated': False, 'swimHeightAccepted': False}))
