"""Extract bounded native-video samples; labels are video seconds, not game time."""
import json
from pathlib import Path
import subprocess
from PIL import Image, ImageDraw
root=Path('dist/native-open-lane-motion-2026-11-15')
report=json.loads((root/'report.json').read_text())
ffmpeg='/Users/huxiaocong/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac'
sheet=Image.new('RGB',(900,660),'#eeeeee');draw=ImageDraw.Draw(sheet)
for i,t in enumerate([3,5,7,9,11,13]):
    target=root/f'video-{t:02d}.png'
    if target.exists():raise FileExistsError(target)
    subprocess.run([ffmpeg,'-v','error','-ss',str(t),'-i',report['video'],'-frames:v','1',str(target)],check=True)
    frame=Image.open(target)
    # Native recording is 960x600; retain the central body and its full stride.
    crop=frame.crop((280,150,680,550)).resize((300,300))
    x=(i%3)*300;y=(i//3)*330;sheet.paste(crop,(x,y+30));draw.text((x+8,y+8),f'Video {t}s (not game time)',fill='black')
sheet.save(root/'bounded-motion-sheet.jpg',quality=90)
print(root/'bounded-motion-sheet.jpg')
