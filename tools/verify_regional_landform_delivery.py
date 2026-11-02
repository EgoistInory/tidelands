"""Verify this finite local delivery and its real UI evidence; M5 stays incomplete."""
import hashlib,json,zipfile
from pathlib import Path,PurePosixPath
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-11-02-regional-landforms-r2'
OLD='tidelands-m5-2026-10-29-ground-support'
def digest(data):return hashlib.sha256(data).hexdigest()
def read(path):return json.loads((ROOT/path).read_text())
def verify():
    package=read('dist/'+NAME+'.json');old=read('dist/'+OLD+'.json')
    archive=ROOT/'dist'/package['archive'];target=ROOT/'dist'/NAME
    assert digest(archive.read_bytes())==package['archiveSha256']
    assert len(package['files'])==209 and package['archiveEntries']==210 and not package['fullGoalComplete']
    changed={p for p in set(old['files'])|set(package['files']) if old['files'].get(p)!=package['files'].get(p)}
    assert changed=={'README.md','src/terrain-composition.js','src/inland.js','src/main.js'},changed
    with zipfile.ZipFile(archive) as z:
        assert len(z.infolist())==210 and z.testzip() is None
        assert all(not PurePosixPath(i.filename).is_absolute() and '..' not in PurePosixPath(i.filename).parts and i.filename.startswith('tidelands-local/') for i in z.infolist())
        for p,row in package['files'].items():
            assert digest(z.read('tidelands-local/'+p))==row['sha256'],p
            assert digest((ROOT/('docs/LOCAL-DELIVERY.md' if p=='README.md' else p)).read_bytes())==row['sha256'],p
        if not target.exists():target.mkdir();z.extractall(target)
    for p,row in package['files'].items():assert digest((target/'tidelands-local'/p).read_bytes())==row['sha256'],p
    assert digest((ROOT/'dist'/old['archive']).read_bytes())==old['archiveSha256']=='ee606c25629a7b9f704fc504d661abea31264244b52027a9530253c60ca8301f'
    assert digest((ROOT/'docs/beacon-footing-normal-save.json').read_bytes())=='33455473ff0e92097db6351e2ea421e498accde405ee5a9482ae8ef16d55bb29'
    report={'packageVerified':True,'package':{k:package[k] for k in ['archive','archiveBytes','archiveSha256','archiveEntries']},'runtimeInputs':209,'changedInputs':sorted(changed),'nativeUiVerified':False,'milestoneM5Complete':False,'fullGoalComplete':False}
    proof=ROOT/'docs/regional-landform-package-main-restore.json'
    if proof.exists():
        ui=json.loads(proof.read_text());assert ui['complete'] and ui['mobileReloadExact'] and ui['cleanConsole'] and not ui['runtimeOutsideBase'] and ui['distance']>1
        assert ui['entry'].endswith('/dist/'+NAME+'/tidelands-local/')
        for p,h in ui['sources'].items():assert digest((target/'tidelands-local'/p).read_bytes())==h,p
        assert ui['rows'][-1]['viewport']=={'width':390,'height':844} and ui['rows'][-1]['canvas']==[585,1266]
        for row in ui['rows']:
            if 'image' in row:assert digest((ROOT/'dist/regional-package-main-restore-2026-11-02-r2'/row['image']).read_bytes())==row['sha256']
        report.update(nativeUiVerified=True,ordinaryCopyMoveMeters=ui['distance'],mobileViewport=[390,844],mobileBuffer=[585,1266])
    (ROOT/'docs/regional-landform-package-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':verify()
