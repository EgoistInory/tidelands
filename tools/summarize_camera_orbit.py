import hashlib,json
from pathlib import Path
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'docs/camera-orbit-2026-11-05'
def load(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def sheet(name,items,columns=2,width=480,height=328):
 result=Image.new('RGB',(width*columns,height*((len(items)+columns-1)//columns)),'#192723')
 for i,(p,label) in enumerate(items):
  im=Image.open(p).convert('RGB');im.thumbnail((width,height-28));x=(i%columns)*width;y=(i//columns)*height;result.paste(im,(x,y+28));ImageDraw.Draw(result).text((x+8,y+8),label,fill='white')
 result.save(E/(name+'.jpg'),quality=93)
def main():
 cases=[ROOT/'dist'/n for n in ['camera-orbit-r2-new-field-pose-2026-11-05','camera-orbit-r2-mobile-field-pose-2026-11-05']]
 sheet('fixed-cases',[(cases[0]/'after.png','Captured desktop input: 97.32 -> 7.32 degrees'),(cases[1]/'after.png','Captured 390px input: 141.10 -> 8.90 degrees')],width=640,height=628)
 for folder,label in [('camera-orbit-r2-native-2026-11-05','native-journey'),('camera-orbit-r2-combat-2026-11-05','live-combat')]:
  d=ROOT/'dist'/folder;r=load(d/'raw.json');sheet(label,[(d/p['image'],p['name']+f" HP{p['player']['hp']} kills{p['kills']}") for p in r['phases']])
 d=ROOT/'dist/camera-orbit-r2-save-compat-2026-11-05';r=load(d/'raw.json');sheet('save-compat',[(d/im['image'],im['image']) for row in r['rows'] for im in row['images']],height=548)
 d=ROOT/'dist/camera-orbit-r2-remaining-case-2026-11-05';sheet('remaining-camera',[(d/'before.png','Unresolved R2 transition: before'),(d/'after.png','Unresolved R2 transition: after')])
 frames=sorted((ROOT/'dist/camera-orbit-combat-samples-2026-11-05').glob('*.png'));chosen=frames[::2];assert len(frames)==26;sheet('combat-video-samples',[(p,p.name) for p in chosen],columns=4)
 video=ROOT/'dist/camera-orbit-r2-combat-2026-11-05'/load(ROOT/'dist/camera-orbit-r2-combat-2026-11-05/raw.json')['video']
 (E/'video-samples.json').write_text(json.dumps({'video':str(video.relative_to(ROOT)),'videoSha256':sha(video),'requestedSeekSeconds':12,'requestedDurationSeconds':12,'requestedFps':2,'decodedFrames':len(frames),'contactFrames':[p.name for p in chosen],'framesSha256':{p.name:sha(p) for p in frames},'wholeVideoReviewed':False,'audioListened':False},indent=2)+'\n')
 print(json.dumps({'contacts':6,'decodedFrames':len(frames),'contactFrames':len(chosen)}))
if __name__=='__main__':main()
