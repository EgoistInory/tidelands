import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWeatheredRock} from '../src/rock.js';
import {createTree} from '../src/tree.js';

test('resource boulders have a broad mineral face rather than a continuously rounded dome',()=>{
  const rock=createWeatheredRock(1.8),p=rock.geometry.attributes.position,n=rock.geometry.attributes.normal;
  const top=[];
  for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))<.45&&Math.abs(p.getZ(i))<.45&&p.getY(i)>1){top.push(p.getY(i));assert.ok(n.getY(i)>.999,'interior of the upper face has a stable plane normal');}
  assert.ok(top.length>=12);assert.ok(Math.max(...top)-Math.min(...top)<.002,'a broad upper face survives triangulation');
  rock.geometry.dispose();
});

test('all regional crowns carry coherent lower-to-upper value masses within the existing mesh budget',()=>{
  for(const form of ['coast','forest','highland','shoal']){
    const tree=createTree(form),leaf=tree.children.find(m=>m.material.alphaTest>0),p=leaf.geometry.attributes.position,c=leaf.geometry.attributes.color;
    const rows=Array.from({length:p.count},(_,i)=>({y:p.getY(i),value:c.getY(i)})).sort((a,b)=>a.y-b.y),q=Math.floor(rows.length/4),mean=a=>a.reduce((s,r)=>s+r.value,0)/a.length;
    assert.ok(mean(rows.slice(-q))-mean(rows.slice(0,q))>.10,form+' has a readable lit upper mass and darker underside');
    assert.ok(p.count/3<=2016,'shade does not add leaves or draw calls');
    tree.traverse(m=>m.geometry?.dispose());
  }
});
