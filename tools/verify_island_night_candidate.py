"""Verify a source candidate; this deliberately does not verify a new delivery ZIP."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def sha(p): return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    old=json.loads((ROOT/'dist/tidelands-m5-2026-10-16-enemy-windup.json').read_text())
    changed=[p for p,v in old['files'].items() if sha('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)!=v['sha256']]
    assert set(changed)=={'src/scene.js','src/landscape.js'}
    for suffix,total in [('focused',25),('full',217)]:
        text=(ROOT/f'docs/island-night-{suffix}.txt').read_text()
        assert f'# tests {total}\n' in text and f'# pass {total}\n' in text and '# fail 0\n' in text
    ui=json.loads((ROOT/'docs/island-night-render.json').read_text());assert len(ui['rows'])==10 and len(ui['images'])==10 and not ui['console'] and not ui['ordinarySaveOperated']
    assert all(r['glError']==0 and r['ground']=='ready' for r in ui['rows'])
    assert all(r['frames']==180 for r in ui['rows'][-2:]) and ui['rows'][-1]['viewport']==[390,844]
    assert sha('docs/enemy-windup-normal-save.json')=='3491e7cd995f9a1c473117c19659d337cccc4421644d6b2e5c601352e321eb18'
    images={str(Path(p).relative_to(ROOT)):hashlib.sha256(Path(p).read_bytes()).hexdigest() for p in ui['images']}
    report={'candidateVerified':True,'delivered':False,'changedRuntime':{p:sha(p) for p in changed},'unchangedRuntimeFiles':47,'focusedTests':25,'fullTests':217,'renderedRows':10,'imagesReviewedSha256':images,'evidenceSha256':{f'docs/island-night-{k}':sha(f'docs/island-night-{k}') for k in ['red.txt','focused.txt','full.txt','render.json']},'remaining':'Ruin space still unchanged. Tree height/tint is not distinct species or forest density; night fill still needs whole-scene judgement. No ordinary/package/current-candidate endurance/GPU acceptance. Old c1a9 data remain historical. M5/full goal incomplete.'}
    (ROOT/'docs/island-night-candidate.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['imagesReviewedSha256','evidenceSha256']},ensure_ascii=False))
if __name__=='__main__': verify()
