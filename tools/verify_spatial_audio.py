"""Audit real WebAudio stereo cue and production-main-loop fixture evidence."""
import array
import hashlib
import json
import math
from pathlib import Path
import sys
import wave
ROOT=Path(__file__).resolve().parents[1]
SOURCE_SHA={'src/audio.js': 'a6a2389758c10f73fc1b4e912b65c2d5ddaf271f2240cc1c6c79fa9859be5837', 'src/main.js': '9b3fd782512a39a1eb1d565129f156241778d9be0f135acb72fdf7e737d065ac', 'tests/spatial-audio-review.html': '6f89f1335d3fd15347440ad13eed4de73fe7096457552def487d26b075cf247d', 'tests/spatial-game-review.html': '08f5d07a88cc0ccbdf4b2e0369e38d6c34aae287ca675410436017daeb16253b'}

def read(n):return json.loads((ROOT/n).read_text())
def sha(n):return hashlib.sha256((ROOT/n).read_bytes()).hexdigest()
def verify():
    assert all(sha(n)==h for n,h in SOURCE_SHA.items()), 'source drift'
    native=read('docs/spatial-audio-native.json');s=native['sample'];assert not native['console']
    assert s['complete'] and s['channels']==2 and s['sampleRate']==48000 and s['seconds']==11
    assert s['created']==s['disconnected']==5 and s['remaining']==0 and s['disposed']
    with wave.open(str(ROOT/'docs/spatial-audio-native.wav'),'rb') as w:
        assert (w.getnchannels(),w.getsampwidth(),w.getframerate(),w.getnframes())==(2,2,48000,528000)
        samples=array.array('h',w.readframes(w.getnframes()))
        if sys.byteorder!='little':samples.byteswap()
    assert (ROOT/'docs/spatial-audio-native.wav').stat().st_size==s['bytes']==2112044
    for i,event in enumerate(s['events']):
        start,end=round((.5+i)*48000),round((.9+i)*48000)
        for channel in range(2):
            values=[samples[n*2+channel]/32767 for n in range(start,end)]
            rms=math.sqrt(sum(v*v for v in values)/len(values));peak=max(map(abs,values))
            assert abs(rms-event['channels'][channel]['rms'])<1/32767 and abs(peak-event['channels'][channel]['peak'])<1/32767
    e={r['name']:r for r in s['events']};rms=lambda n,c:e[n]['channels'][c]['rms']
    assert rms('left',0)>3*rms('left',1) and rms('right',1)>3*rms('right',0) and rms('turn',1)>3*rms('turn',0)
    assert 0<rms('far',1)<rms('near',1)*.4
    for n in ['paused','muted']:assert rms(n,0)==rms(n,1)==0 and e[n]['before']==e[n]['after']==0
    for n in ['menu','fallback','center']:assert rms(n,0)==rms(n,1)>0
    center_energy_db=10*math.log10(sum(c['rms']**2 for c in e['center']['channels'])/sum(c['rms']**2 for c in e['near']['channels']))
    game=read('docs/spatial-game-current.json');g=game['sample'];assert not game['console'] and not g['active'] and g['voices']==0 and g['nodes']==g['disconnected']==4 and g['glError']==0
    assert any(e['options']['pan']>.5 for e in g['events']) and any(e['options']['pan']<-.5 for e in g['events'])
    for event in g['events']:
        assert event['after']>event['before'] and event['context']=='running'
        assert abs(event['nativePanAfter80ms']-event['options']['pan'])<1e-6
        p,c,e=event['player'],event['camera'],event['enemy'];yaw=math.atan2(c['x']-p['x'],c['z']-p['z']);dx,dz=e['x']-p['x'],e['z']-p['z'];d=math.hypot(dx,dz)
        assert abs(event['options']['pan']-.85*(dx*math.cos(yaw)-dz*math.sin(yaw))/d)<1e-8
    m=game['muted'];assert not m['enabled'] and not m['active'] and m['voices']==0 and m['nodes']==4 and m['events'][-1]['before']==m['events'][-1]['after']==0
    assert m['events'][-1]['nativePanAfter80ms'] is None
    evidence=['docs/spatial-audio-native.wav','docs/spatial-audio-native.json','docs/spatial-audio-native.jpg','docs/spatial-game-current.json','docs/spatial-game-current.jpg','docs/spatial-game-initial-observation.json']
    result={'passed':True,'sourceSha256':SOURCE_SHA,'evidenceSha256':{n:sha(n) for n in evidence},'nativeStereoVerified':True,'mainLoopSpatialCueVerified':True,'wavBytes':2112044,'centerVsNearStereoEnergyDb':center_energy_db,'equalPowerAcrossPanAccepted':False,'createdAndReleased':5,'gameCreatedAndReleased':4,'nativeDraggedCamera':True,'ordinarySaveChanged':False,'candidateDelivered':False,'audioListened':False,'m5Complete':False,'fullGoalComplete':False,'limits':'11s isolated stereo cue with muted background/same noise slice and proxy lifecycle; PCM quantization checked, not overall mix/audition. Native main loop starts declared one-crab fixture/own key, user-like drag, then harness auto-pauses through UI at negative pan. Immediate AudioParam.value observation returned0 before audio quantum;80ms native read proves applied value. No production changes this verification batch; ordinary journey, phone and combined long-run remain separate.'}
    (ROOT/'docs/spatial-audio-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in result.items() if k not in ['sourceSha256','evidenceSha256']},ensure_ascii=False))
if __name__=='__main__':verify()
