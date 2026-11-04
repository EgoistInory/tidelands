"""Keep bounded visual-study evidence, source hashes and paired-image contact sheets."""
import hashlib,json,shutil,sys
from pathlib import Path
from PIL import Image,ImageChops,ImageDraw,ImageStat

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/bedrock-relief-2026-11-04'
RAW=ROOT/'dist/bedrock-relief-2026-11-04-r2'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 r=json.loads((RAW/'raw.json').read_text());assert r['complete'] and len(r['rows'])==12
 OUT.mkdir(exist_ok=True)
 for p,digest in r['sources'].items():assert sha(ROOT/p)==digest,p
 pairs=[]
 for before in r['rows'][::2]:
  after=next(a for a in r['rows'] if a['variant']=='candidate' and (a['site'],a['distance'],a['viewport'])==(before['site'],before['distance'],before['viewport']))
  for field in ['camera','lookAt','buffer','time','player','ground','render']:assert before[field]==after[field]
  for row in [before,after]:
   assert sha(RAW/row['image'])==row['sha256']
   assert row['worldUnchanged'] and row['stateUnchanged'] and row['glError']==0
   assert all(row['authored'].values()) and row['textures']==['ready']*3
  a,b=[Image.open(RAW/row['image']).convert('RGB') for row in [before,after]]
  diff=ImageChops.difference(a,b);stats=ImageStat.Stat(diff)
  pairs.append({'width':before['viewport'][0],'site':before['site'],'distance':before['distance'],'meanAbsoluteRGB':sum(stats.mean)/3,'changedPixelFraction':sum(n for n,v in diff.getcolors(a.width*a.height) if any(v))/(a.width*a.height),'render':before['render']})
 for name,indices in [('highland',[0,1]),('camp-night',[2,3]),('mobile',[4,5])]:
  w=390 if name=='mobile' else 640;rows=[]
  for i in indices:
   before,after=r['rows'][2*i:2*i+2];images=[]
   for row in [before,after]:
    im=Image.open(RAW/row['image']).convert('RGB');im.thumbnail((w,1000));images.append(im)
   h=max(im.height for im in images);strip=Image.new('RGB',(w*2,h+30),'#192723');d=ImageDraw.Draw(strip)
   for j,im in enumerate(images):strip.paste(im,(j*w,30));d.text((j*w+8,8),f"{before['site']} {before['distance']} / {['baseline','candidate'][j]}",fill='white')
   rows.append(strip)
  sheet=Image.new('RGB',(w*2,sum(im.height for im in rows)),'#192723');y=0
  for im in rows:sheet.paste(im,(0,y));y+=im.height
  sheet.save(OUT/(name+'-comparison.jpg'),quality=92)
 shutil.copyfile(RAW/'raw.json',OUT/'raw.json')
 first=ROOT/'dist/bedrock-relief-2026-11-04/raw.json';shutil.copyfile(first,OUT/'attempt-1-raw.json')
 failed=json.loads(first.read_text());assert len(failed['rows'])==8 and failed.get('error')
 for row in failed['rows']:assert sha(first.parent/row['image'])==row['sha256']
 reviewed='--reviewed-reject' in sys.argv
 audit={'complete':True,'candidateIntegrated':False,'fullGoalComplete':False,'m5Complete':False,'rawPath':str(RAW.relative_to(ROOT)),'rows':12,'pairs':pairs,'firstAttempt':{'path':str(first.relative_to(ROOT)),'sha256':sha(first),'reason':'Harness required no requestfailed events despite resolved asset loaders; preserved eight desktop images and original assertion.'},'networkDiagnostics':[{ 'width':c['width'],'consoleWarningsErrors':len(c['logs']),'abortedRequests':len(c['failures'])} for c in r['contexts']],'networkCause':'Unresolved; no clean-network claim. Authored loader promises and all texture states independently ready.','screenshotsReviewed':reviewed,'reviewScope':'Agent inspected all 12 final images through three paired contact sheets, plus original ordinary highland candidate at full size.' if reviewed else 'Pending','decision':'rejected' if reviewed else 'pending','decisionReason':'Interrupted lines read as scratches on smooth bare hills; no new silhouette or spatial layering. Do not promote or continue seam/noise tuning.' if reviewed else None,'motionReviewed':False,'gpuTimingMeasured':False,'physicalDevice':False,'currentOrdinarySave':'docs/native-camp-night-2026-11-04/final-save.json'}
 audit['auditToolSha256']=sha(Path(__file__))
 audit['contactSheets']=[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in sorted(OUT.glob('*-comparison.jpg'))]
 (OUT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n')
 print(json.dumps({'pairs':pairs,'network':audit['networkDiagnostics']}))
if __name__=='__main__':main()
