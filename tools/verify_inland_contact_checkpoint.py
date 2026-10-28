"""Verify the declared contact candidate evidence; production remains unchanged."""
from pathlib import Path
import hashlib,json,math
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def sha(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()
def verify():
    prepared=read('docs/inland-contact-cell-preparation.json');data=read('dist/inland-authored-contact-candidate/inland-contact-shapes.json');core=read('docs/inland-contact-core-audit.json');survey=read('docs/inland-root-support-survey.json')
    assert sha('dist/inland-authored-contact-candidate/inland-contact-shapes.json')==prepared['sha256']
    for file,digest in data['sourceHashes'].items():assert sha(file)==digest
    assert prepared['bodyBoxes']==3114 and prepared['cameraBoxes']==3010 and prepared['unionContactCells']==35230 and not data['terrainCulling']
    assert core['verified'] and len(core['rows'])==15 and core['fineBasalCoverageExact'] and core['addedInteriorCells']==216 and core['regrowthBuildRejections']==14
    assert survey['verified'] and survey['nativeRootSamples']==191 and survey['wholeSampledBasalBandAbove35cm']==[] and not survey['rootSupportAccepted']
    observations=read('docs/inland-contact-native-observations.json');rows={r['label']:r for r in observations}
    for row in observations:
        assert row['worldUnchanged'] and row['glError']==0 and row['contactBoxes']==3114 and row['chunks']==1365 and row['maxCameraChunkRadius']<12 and row['visible3D']<=1
    before,blocked,repeat,gather,passed=[rows['desktop-'+name] for name in ['before','blocked','blocked-repeat','gather','depleted-passage']]
    assert .8<math.dist([before['player'][k] for k in ['x','z']],[blocked['player'][k] for k in ['x','z']])<1.1
    assert repeat['player']==blocked['player'] and gather['inventory']['wood']==before['inventory']['wood']+3 and gather['targetDepleted'] and not gather['targetVisible']
    assert gather['gatherTarget'] is not None and passed['player']['z']<blocked['player']['z']-3.5
    saved,restored=[json.loads(rows[key]['serializedState']) for key in ['desktop-explicit-save','desktop-reloaded']]
    durable=['player','inventory','buildings','depleted','quest','kills','time','respawn','discovered','selected']
    for key in durable:assert saved[key]==restored[key],key
    assert len(saved['enemies'])==len(restored['enemies'])==79
    for a,b in zip(saved['enemies'],restored['enemies']):
        for key in ['id','type','x','z','hp','homeX','homeZ']:assert a[key]==b[key],key
        assert b['attackAt']==0
    assert restored['interactAt']==-100
    assert rows['overlap-saved']['player']==rows['overlap-reloaded']['player']
    probe=read('docs/inland-contact-native-overlap-probe.json');assert probe['verified'] and probe['checks'][0]['insideRegisteredWood'] and not probe['checks'][-1]['insideRegisteredWood']
    escape=rows['overlap-native-forward-exit'];assert escape['player']['z']<rows['overlap-second-reload']['player']['z']-4 and not escape['targetDepleted']
    narrow,rest=rows['narrow-legacy-before'],rows['narrow-legacy-rest'];assert narrow['viewport']==narrow['buffer']==[390,844] and narrow['lod']=='mid' and narrow['player']['hp']==62 and rest['player']['hp']==100
    assert narrow['buildings']==rest['buildings'] and rest['near']['type']=='campfire' and rest['targetDepleted'] and not rest['targetVisible']
    images={}
    for name,size in [('desktop-before',(1280,720)),('desktop-after',(1280,720)),('overlap',(1280,720)),('narrow-legacy',(390,844))]:
        path=f'docs/inland-contact-{name}.png'
        with Image.open(ROOT/path) as image:assert image.size==size
        images[path]=sha(path)
    for name in ['native','narrow','final']:assert read(f'docs/inland-contact-{name}-console.json')==[]
    package=read('dist/tidelands-m5-2026-10-27-coastal-contact-budget.json')
    for file,row in package['files'].items():assert sha('docs/LOCAL-DELIVERY.md' if file=='README.md' else file)==row['sha256'],file
    assert sha('dist/tidelands-m5-2026-10-27-coastal-contact-budget.zip')==package['archiveSha256']
    report=dict(verified=True,scope='15 actual core fixtures plus one native current-main resource with declared materials/quest/zero-HP enemy fixtures; isolated storage',rootSurveyOnly=True,all15HeadlessMovementGatherLegacyCamp=True,nativeBodyBlockGatherPass=True,nativeDurableSaveFields=len(durable),nativeEnemyRecordsPreserved=79,expectedTransientResets=['enemy.attackAt','interactAt'],nativeOverlapSavedPlayerUnchanged=True,nativeFullWorldEscapeEndpoint=escape['player'],cameraChunks=1365,maxCameraChunkRadius=escape['maxCameraChunkRadius'],cameraOrbitContactAccepted=False,narrowTouchCampRest=True,nativeNarrowMature3DVisible=False,productionRuntimeFilesUnchanged=len(package['files']),packageSha256=package['archiveSha256'],ordinarySaveTouched=False,productionIntegrated=False,currentCandidateGameLoopGpuOrEnduranceAccepted=False,milestoneM5Complete=False,fullGoalComplete=False,images=images,sources={file:sha(file) for file in ['tests/inland-contact-main.html','tests/inland-contact-renderer.js','tools/inland-contact-volume.mjs','tools/prepare_inland_contact_cells.mjs','tools/verify_inland_contacts.mjs','tools/audit_inland_root_support.mjs']})
    (ROOT/'docs/inland-contact-checkpoint-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k not in ['images','sources']},ensure_ascii=False))
if __name__=='__main__':verify()
