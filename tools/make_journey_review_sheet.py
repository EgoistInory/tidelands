"""Bounded video-frame review of the native journey; no audio or frame-exact game-time claim."""
from pathlib import Path
import json,subprocess,argparse
from PIL import Image,ImageDraw
p=argparse.ArgumentParser();p.add_argument('folder');args=p.parse_args();root=Path(args.folder)
r=json.loads((root/'raw.json').read_text());ffmpeg='/Users/huxiaocong/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac'
sheet=Image.new('RGB',(1280,1560),'#eeeeee');draw=ImageDraw.Draw(sheet)
for i,t in enumerate([15,75,105,210,330,450,555,590]):
    target=root/f'review-video-{t:03d}.png';assert not target.exists()
    subprocess.run([ffmpeg,'-v','error','-ss',str(t),'-i',str(root/r['video']),'-frames:v','1',str(target)],check=True)
    assert target.exists(),'Video is shorter than the declared sample point'
    with Image.open(target) as image:thumbnail=image.convert('RGB').resize((640,360))
    x=(i%2)*640;y=(i//2)*390;sheet.paste(thumbnail,(x,y+30));draw.text((x+8,y+8),f'Video {t}s / whole frame / not game-clock alignment',fill='black')
target=root/'bounded-journey-sheet.jpg';assert not target.exists();sheet.save(target,quality=90);print(target)
