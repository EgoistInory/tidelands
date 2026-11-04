import hashlib,json,shutil
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];RAW=ROOT/'dist/bedrock-delivery-review-2026-11-05';OUT=ROOT/'docs/bedrock-delivery-2026-11-05'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main():
 r=json.loads((RAW/'raw.json').read_text());assert r['complete'] and len(r['rows'])==15
 for p,d in r['sourceSha256'].items():assert sha(ROOT/p)==d,p
 for row in r['rows']:
  assert sha(RAW/row['image'])==row['sha256'];assert row['glError']==0 and row['worldUnchanged'] and row['stateUnchanged'] and all(row['authored'].values())
 for context in r['contexts']:
  assert not context['logs']
  if context.get('video'):assert sha(RAW/context['video'])==context['videoSha256']
 pairs=[]
 for row in r['rows']:
  if row['variant']!='current' or row['kind']!='static':continue
  old=next(p for p in r['rows'] if p['variant']=='baseline' and p['site']==row['site'] and p['distance']==row['distance'] and p['width']==row['width'])
  for k in ['camera','lookAt','buffer']:assert old[k]==row[k]
  pairs.append((old,row))
 for name,chosen,width in [('four-island',pairs[:4],640),('highland-near',[pairs[4]],640),('mobile',pairs[5:],390)]:
  strips=[]
  for before,after in chosen:
   images=[]
   for row in [before,after]:
    im=Image.open(RAW/row['image']).convert('RGB');im.thumbnail((width,1000));images.append(im)
   strip=Image.new('RGB',(width*2,max(im.height for im in images)+28),'#192723');draw=ImageDraw.Draw(strip)
   for i,im in enumerate(images):strip.paste(im,(i*width,28));draw.text((i*width+7,7),f"{before['site']} {before['distance']} / {['baseline','current'][i]}",fill='white')
   strips.append(strip)
  sheet=Image.new('RGB',(width*2,sum(im.height for im in strips)),'#192723');y=0
  for im in strips:sheet.paste(im,(0,y));y+=im.height
  sheet.save(OUT/(name+'-comparison.jpg'),quality=93)
 shutil.copyfile(RAW/'raw.json',OUT/'render-raw.json')
 motion=next(p for p in r['rows'] if p['kind']=='motion');Image.open(RAW/motion['image']).convert('RGB').save(OUT/'motion-end.jpg',quality=93)
 print(json.dumps({'imagesVerified':15,'pairs':len(pairs),'motion':motion['motion'],'video':[c.get('video') for c in r['contexts'] if c.get('video')]}))
if __name__=='__main__':main()
