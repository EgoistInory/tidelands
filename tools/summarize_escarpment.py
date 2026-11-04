"""Audit the preserved regional geometry studies; contact sheets are diagnostics, not acceptance."""
import hashlib,json,shutil,sys
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'docs/escarpment-2026-11-05'
PATHS={'procedural':'dist/escarpment-2026-11-05-r2','scanned':'dist/escarpment-scanned-2026-11-05','embedded':'dist/escarpment-embedded-2026-11-05'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 OUT.mkdir(exist_ok=True);reports={};rows={};stats=[]
 for variant,folder in PATHS.items():
  base=ROOT/folder;r=json.loads((base/'raw.json').read_text());assert r['complete'] and len(r['rows'])==12
  for p,digest in r['sources'].items():assert sha(ROOT/p)==digest,p
  reports[variant]=r;shutil.copyfile(base/'raw.json',OUT/(variant+'-raw.json'))
  for row in r['rows']:
   assert sha(base/row['image'])==row['sha256']
   assert row['worldUnchanged'] and row['stateUnchanged'] and row['glError']==0
   assert all(row['authored'].values()) and row['textures']==['ready']*3
   key=(row['viewport'][0],row['site'],row['distance']);rows[variant,key,row['variant']]=(base/row['image'],row)
   if row['variant']=='candidate':
    before=rows[variant,key,'baseline'][1]
    for field in ['camera','lookAt','buffer','time','player','ground']:assert before[field]==row[field]
    stats.append({'variant':variant,'width':key[0],'site':key[1],'distance':key[2],'before':before['render'],'after':row['render']})
  assert all(not c['logs'] and all(f['failure']['errorText']=='net::ERR_ABORTED' for f in c['failures']) for c in r['contexts'])
 keys=[key for v,key,kind in rows if v=='procedural' and kind=='baseline']
 for key in keys:
  baseline=rows['procedural',key,'baseline'][1]['sha256']
  assert all(rows[v,key,'baseline'][1]['sha256']==baseline for v in PATHS),'Baseline pixels differ; do not deduplicate their review.'
 def strip(key,width=320):
  entries=[('baseline',rows['procedural',key,'baseline'][0])]+[(v,rows[v,key,'candidate'][0]) for v in PATHS]
  cells=[]
  for label,p in entries:
   im=Image.open(p).convert('RGB');im.thumbnail((width,1000));cell=Image.new('RGB',(width,im.height+28),'#192723');cell.paste(im,(0,28));ImageDraw.Draw(cell).text((6,7),f'{key[1]} {key[2]} / {label}',fill='white');cells.append(cell)
  return cells
 def save(name,cells,columns):
  width=max(c.width for c in cells);heights=[max(c.height for c in cells[i:i+columns]) for i in range(0,len(cells),columns)];sheet=Image.new('RGB',(width*columns,sum(heights)),'#192723');y=0
  for start,h in zip(range(0,len(cells),columns),heights):
   for j,c in enumerate(cells[start:start+columns]):sheet.paste(c,(j*width,y))
   y+=h
  sheet.save(OUT/name,quality=93)
 save('desktop-highland.jpg',[im for d in ['ordinary','overview','far'] for im in strip((1280,'highland',d))],4)
 save('mobile-highland.jpg',strip((390,'highland','ordinary'),390),2)
 save('desktop-camp-control.jpg',strip((1280,'camp','ordinary')),4)
 save('mobile-camp-control.jpg',strip((390,'camp','ordinary'),390),2)
 first=ROOT/'dist/escarpment-2026-11-05/raw.json';failed=json.loads(first.read_text());assert 'ERR_CONNECTION_REFUSED' in failed['error'] and not failed['rows'];shutil.copyfile(first,OUT/'server-unavailable-raw.json')
 reviewed='--reviewed' in sys.argv
 audit={'complete':True,'candidateIntegrated':False,'m5Complete':False,'fullGoalComplete':False,'screenImageCount':36,'pixelIdenticalBaselinesDeduplicated':True,'uniqueReviewImages':24,'reviewed':reviewed,'decisions':{'procedural':'reject: pale angular pillars','scanned':'reject: detached stretched slabs','embedded':'reject: burial reduces slabs but leaves the ordinary/mobile bare slope largely unchanged'} if reviewed else {},'contactImplementation':'Not implemented; the visual gate failed before gameplay integration. No movement, build, camera-contact or reachability acceptance claimed.','gpuTimingMeasured':False,'motionReviewed':False,'physicalDevice':False,'stats':stats,'network':[{'variant':v,'contexts':[{'width':c['width'],'abortedRequests':len(c['failures']),'consoleWarningsErrors':len(c['logs'])} for c in r['contexts']]} for v,r in reports.items()],'sourceAndImageHashesVerified':True,'firstFailurePath':str(first.relative_to(ROOT)),'firstFailureSha256':sha(first),'currentOrdinarySave':'docs/native-camp-night-2026-11-04/final-save.json','auditToolSha256':sha(Path(__file__)),'contactSheets':[{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in sorted(OUT.glob('*.jpg'))]}
 (OUT/'audit.json').write_text(json.dumps(audit,indent=2)+'\n');print(json.dumps({'images':36,'uniqueImages':24,'reviewed':reviewed,'planCount':reports['embedded']['rows'][0]['escarpments']['count'],'stats':stats}))
if __name__=='__main__':main()
