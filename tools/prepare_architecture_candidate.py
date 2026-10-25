"""Build a fresh isolated architecture candidate from the immutable local package."""
from pathlib import Path
import hashlib
import json
import shutil
import zipfile

ROOT=Path(__file__).resolve().parents[1]
target=ROOT/'dist/architecture-candidate'
assert not target.exists(), 'Existing candidate preserved; do not overwrite.'
baseline=ROOT/'dist/architecture-baseline'
assert not baseline.exists(), 'Existing baseline preserved; do not overwrite.'
manifest=json.loads((ROOT/'dist/tidelands-m5-2026-10-25-terrain-composition.json').read_text())
archive=ROOT/'dist'/manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['archiveSha256']
with zipfile.ZipFile(archive) as bundle:
    assert all(not Path(name).is_absolute() and '..' not in Path(name).parts for name in bundle.namelist())
    bundle.extractall(target)
    bundle.extractall(baseline)
runtime=target/'tidelands-local'
for name,item in manifest['files'].items():
    assert hashlib.sha256((runtime/name).read_bytes()).hexdigest()==item['sha256'], name
for name in ['camp-surface','camp-architecture']:
    content=(ROOT/'tests'/f'{name}-candidate.js').read_text().replace("'../src/", "'./").replace("'./camp-surface-candidate.js'", "'./camp-surface.js'")
    (runtime/'src'/f'{name}.js').write_text(content)
p=runtime/'src/scene.js';scene=p.read_text()
start=scene.index('export function buildingModel(type){');end=scene.index('function landmarkModel(',start)
scene=scene[:start]+"""export function buildingModel(type,cache=null,options={}){
  if(type==='tent'&&!materials.has('tent-cloth'))materials.set('tent-cloth',createTextileMaterial(0xb9a77c,{side:THREE.DoubleSide,roughness:1}));
  return createCampBuilding(type,cache,{...options,clothMaterial:materials.get('tent-cloth'),ashMaterial:type==='campfire'?material(0x302e28):null});
}
"""+scene[end:]
scene=scene.replace("import {createFlame,updateCampfire}","import {createCampBuilding} from './camp-architecture.js';\nimport {createFlame,updateCampfire}")
scene=scene.replace('this.buildings=new Map();','this.buildings=new Map();this.architectureSurfaceCache=new Map();')
scene=scene.replace('const g=buildingModel(b.type);','const g=buildingModel(b.type,this.architectureSurfaceCache);g.updateMatrixWorld(true);mergeStaticParts(g);')
scene=scene.replace('const model=buildingModel(type),','const model=buildingModel(type,null,{surfaces:false}),')
p.write_text(scene)
shutil.copytree(ROOT/'tests',runtime/'tests')
(runtime/'docs').mkdir(exist_ok=True)
shutil.copy2(ROOT/'docs/landform-identity-baseline.json',runtime/'docs/landform-identity-baseline.json')
print(runtime)
