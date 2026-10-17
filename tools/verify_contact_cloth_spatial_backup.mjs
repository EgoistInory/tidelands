import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {restore} from '../src/game.js';

const path=new URL('../docs/contact-cloth-spatial-normal-save.json',import.meta.url),raw=fs.readFileSync(path,'utf8'),saved=JSON.parse(raw),restored=restore(raw);
assert.deepEqual(restored,saved,'production restore must preserve every exported field');
assert.equal(restored.quest,6);assert.equal(restored.kills,3);assert.equal(restored.player.hp,79);
assert.deepEqual(restored.inventory,{wood:4,stone:5,fiber:6,berry:3,shell:0,crystal:0,axe:1,sword:0,meal:0});
assert.equal(restored.buildings.length,1);
const report={passed:true,sha256:crypto.createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw),player:restored.player,inventory:restored.inventory,quest:restored.quest,kills:restored.kills,buildings:restored.buildings.length,allFieldsPreserved:true,scope:'Actual ordinary UI download, file-based production restore. No runtime injection or new campaign replay.'};
fs.writeFileSync(new URL('../docs/contact-cloth-spatial-backup-audit.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
