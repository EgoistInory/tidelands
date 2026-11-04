"""Reconcile preserved images with the measured authority/visible-ground integration gaps."""
import hashlib,json,shutil,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
RAW=ROOT/'dist/continuous-bedrock-2026-11-05';OUT=ROOT/'docs/continuous-bedrock-2026-11-05'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 OUT.mkdir(exist_ok=True);r=json.loads((RAW/'raw.json').read_text());assert r['complete'] and len(r['rows'])==8
 for p,d in r['sources'].items():assert sha(ROOT/p)==d,p
 for row in r['rows']:
  assert sha(RAW/row['image'])==row['sha256'];assert row['worldUnchanged'] and row['stateUnchanged'] and row['glError']==0
  assert all(row['authored'].values()) and row['textures']==['ready']*3
 for row in [v for v in r['rows'] if v['variant']=='candidate']:
  before=next(v for v in r['rows'] if v['variant']=='baseline' and (v['viewport'],v['site'],v['distance'])==(row['viewport'],row['site'],row['distance']))
  for key in ['camera','lookAt','buffer','time','player','ground']:assert before[key]==row[key]
 assert all(not c['logs'] and all(f['failure']['errorText']=='net::ERR_ABORTED' for f in c['failures']) for c in r['contexts'])
 for group,keys,width in [('desktop',[('highland','ordinary'),('highland','overview'),('camp','ordinary')],640),('mobile',[('highland','ordinary')],390)]:
  strips=[]
  for site,distance in keys:
   rows=[next(row for row in r['rows'] if row['viewport'][0]==(1280 if group=='desktop' else 390) and row['site']==site and row['distance']==distance and row['variant']==v) for v in ['baseline','candidate']];images=[]
   for row in rows:
    im=Image.open(RAW/row['image']).convert('RGB');im.thumbnail((width,1000));images.append(im)
   strip=Image.new('RGB',(width*2,max(im.height for im in images)+28),'#192723');draw=ImageDraw.Draw(strip)
   for i,im in enumerate(images):strip.paste(im,(i*width,28));draw.text((i*width+7,7),f"{site} {distance} / {['baseline','continuous'][i]}",fill='white')
   strips.append(strip)
  sheet=Image.new('RGB',(width*2,sum(im.height for im in strips)),'#192723');y=0
  for im in strips:sheet.paste(im,(0,y));y+=im.height
  sheet.save(OUT/(group+'-comparison.jpg'),quality=93)
 shutil.copyfile(RAW/'raw.json',OUT/'raw.json');probe=json.loads((OUT/'integration-probe.json').read_text())
 for key,p in [('worldSourceSha256','src/world.js'),('candidateSourceSha256','tests/continuous-bedrock-candidate.js'),('gameSourceSha256','src/game.js'),('probeSha256','tools/probe_continuous_bedrock.mjs')]:assert probe[key]==sha(ROOT/p)
 reviewed='--reviewed' in sys.argv
 audit={'complete':True,'candidateIntegrated':False,'fullGoalComplete':False,'m5Complete':False,'images':8,'reviewed':reviewed,'visualDecision':'Retain the continuous structure for integration work: desktop ordinary/middle views show ledges. Mobile central ground remains bare; regular terraces, repeated material and overall prototype art are still open. No whole-art acceptance.' if reviewed else 'pending','promotionDecision':'Do not promote before authoritative/visible support, slope traversal, resource accessibility and old-camp usability are reconciled.','integrationProbeSha256':sha(OUT/'integration-probe.json'),'sourceAndImageHashesVerified':True,'nativeInputs':False,'motionReviewed':False,'gpuTimingMeasured':False,'physicalDevice':False,'currentOrdinarySave':'docs/native-camp-night-2026-11-04/final-save.json','networkDiagnostics':[{'width':c['width'],'variant':c['variant'],'abortedRequests':len(c['failures']),'consoleWarningsErrors':len(c['logs'])} for c in r['contexts']],'auditToolSha256':sha(Path(__file__)),'contactSheets':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in sorted(OUT.glob('*-comparison.jpg'))]}
 (OUT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps({'images':8,'reviewed':reviewed,'maxHeightSupportError':probe['mesh']['maxCandidateAuthorityVisibleError'],'rootsOverHalfMetre':probe['resourceRoots']['overHalfMetre'],'promotion':False}))
if __name__=='__main__':main()
