"""Audit the combined delivery without treating waveform or save-UI checks as full acceptance."""
import array,hashlib,json,math,wave,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
NAME='tidelands-m5-2026-10-16-motion-sound'
def read(p):return json.loads((ROOT/p).read_text())
def sha(p):return hashlib.sha256((ROOT/p).read_bytes()).hexdigest()
def verify():
    package=read(f'dist/{NAME}.json');delivery=read(f'docs/{NAME}-verification.json');old=read('dist/tidelands-m5-2026-10-16-island-spaces.json')
    assert delivery['passed'] and delivery['checkedFiles']==51 and delivery['archiveEntries']==52
    assert sha('dist/'+package['archive'])==package['archiveSha256']
    with zipfile.ZipFile(ROOT/'dist'/package['archive']) as z:
        assert z.testzip() is None
        for name,record in package['files'].items():
            assert sha('docs/LOCAL-DELIVERY.md' if name=='README.md' else name)==record['sha256'],name
            assert hashlib.sha256(z.read('tidelands-local/'+name)).hexdigest()==record['sha256']
            assert hashlib.sha256((Path(delivery['extractedPath'])/name).read_bytes()).hexdigest()==record['sha256']
    changed=[name for name in old['files'] if old['files'][name]['sha256']!=package['files'][name]['sha256']]
    assert set(changed)=={'README.md','src/camera.js','src/character.js'}
    for path,count in [('docs/sound-mix-tests.txt',224),('docs/world-contact-audio-focused.txt',17)]:
        text=(ROOT/path).read_text();assert f'# tests {count}\n' in text and f'# pass {count}\n' in text and '# fail 0\n' in text
    text=(ROOT/'docs/motion-sound-pack-tests.txt').read_text();assert 'Ran 4 tests' in text and '\nOK\n' in text
    body=read('docs/terrain-locomotion-candidate.json');assert body['candidateVerified']
    assert all(sha(path)==digest for path,digest in body['changedRuntime'].items())
    data=read('docs/sound-mix-render.json');media=read('docs/sound-mix-media.json')
    assert data['data']['complete'] and not data['console'] and len(data['data']['reports'])==len(media)==4
    assert all(m['readyState']==4 and m['duration']==10 and m['error'] is None for m in media)
    downloads={r['kind']:r['path'] for r in read('docs/sound-mix-downloads.json')};sounds={}
    for r in data['data']['reports']:
        assert r['seconds']==10 and r['sampleRate']==48000 and r['finite'] and r['unclipped'] and 0<r['peak']<1
        assert r['maxQueued']<=12 and r['remainingBeforeDispose']==0 and r['disposed'] and len(r['events'])==18
        assert all(abs(e['actualTime']-e['scheduled'])<=128/48000 for e in r['events'])
        events={e['scheduled']:e for e in r['events']}
        if r['kind']=='pause-mute':
            assert events[2]['after']==0 and events[2.5]['after']==1 and events[3]['after']==0 and events[3.5]['after']==1
            assert events[4]['after']==0 and not events[4]['enabled'] and r['tail']['peak']==0
        else:
            assert events[5]['after']==12 and events[6]['before']==0 and events[6.5]['after']==1
        path='docs/sound-mix-'+r['kind']+'.wav';assert sha(path)==hashlib.sha256(Path(downloads[r['kind']]).read_bytes()).hexdigest()
        with wave.open(str(ROOT/path),'rb') as w:
            assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(1,2,48000,480000)
            samples=array.array('h',w.readframes(480000))
        peak=max(abs(x) for x in samples)/32767;rms=math.sqrt(sum(x*x for x in samples)/len(samples))/32767
        assert abs(peak-r['peak'])<1/32767 and abs(rms-r['rms'])<1/32767
        sounds[r['kind']]={'sha256':sha(path),'bytes':(ROOT/path).stat().st_size,'peak':r['peak'],'maxVoices':r['maxQueued']}
    normal=read('docs/motion-sound-normal-ui.json');rows=normal['rows']
    assert normal['nativeInput'] and not normal['fixtureImported'] and not normal['runtimeEdited'] and not normal['console'] and not normal['newOrdinaryDownload']
    assert len(rows)==4 and rows[0]['coordinates']!=rows[1]['coordinates'] and rows[1]['saveState']=='已保存'
    assert rows[2]['coordinates']==rows[3]['coordinates'] and rows[0]['bag']==rows[2]['bag']==rows[3]['bag']
    assert all(r['hp']=='79' and r['quest']=='群岛，再次相连' and '建筑 1；击败 3' in r['coordinates'] for r in rows)
    assert rows[2]['viewport']==[390,844] and rows[2]['scrollWidth']==390
    assert sha('docs/island-spaces-normal-save.json')=='e750698e0f888933e089bf8b0e76ebd9890c36d9bd8fcc1b3f5188f80709439c'
    images=['docs/sound-mix-review.png']+normal['images']
    evidence=['docs/sound-mix-render.json','docs/sound-mix-media.json','docs/sound-mix-downloads.json','docs/motion-sound-normal-ui.json','docs/sound-mix-tests.txt','docs/world-contact-audio-focused.txt','docs/motion-sound-pack-tests.txt']+images
    report={'passed':True,'archive':package['archive'],'archiveSha256':package['archiveSha256'],'runtimeFiles':51,'fullTests':224,'audioContactFocusedTests':17,'packageTests':4,'changedFromIslandSpaces':changed,'audioSourceUnchanged':package['files']['src/audio.js']==old['files']['src/audio.js'],'soundMixes':sounds,'currentImagesReviewed':images,'evidenceSha256':{p:sha(p) for p in evidence},'motionEvidence':'docs/terrain-locomotion-candidate.json (same camera/character modules, six old/new world routes; initial camera-only audit predates character correction)','ordinaryRestoresStable':True,'newOrdinaryJsonDownloaded':False,'ordinaryLastUiCoordinates':rows[3]['coordinates'],'newFullMainPathReplayed':False,'newEnduranceReplayed':False,'newGpuReplayed':False,'audioListening':False,'realMobileHardware':False,'m5Complete':False,'fullGoalComplete':False,'limits':'Mixed mono offline fixtures and actual WAV files; native ordinary continuation/save/two restores. Prior7ddGPU/c1a9endurance are historical. The pre-pause HUD coordinate sample is not an exact saved-position measurement; the two no-input restores agree at displayed precision. Numerical/contact evidence does not establish audio aesthetics or complete3Aquality.'}
    (ROOT/'docs/motion-sound-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['evidenceSha256','currentImagesReviewed']},ensure_ascii=False))
if __name__=='__main__':verify()
