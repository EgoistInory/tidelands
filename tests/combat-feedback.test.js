import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual local UI handler, including its timers, without booting WebGL.
function fixture(){
  let now=0,next=0;const jobs=new Map(),nodes={};
  for(const id of ['combat-feedback','attack-feedback','hurt-feedback','damage-feedback'])nodes[id]={hidden:true,textContent:'',dataset:{}};
  let direct='';Object.defineProperty(nodes['combat-feedback'],'textContent',{get(){return direct||nodes['attack-feedback'].textContent+nodes['hurt-feedback'].textContent;},set(value){direct=value;}});
  const code=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8').match(/  let combatTimer=[\s\S]*?(?=  function save\()/)?.[0];assert(code,'production feedback handler must be present');
  const api=vm.runInNewContext(`(()=>{${code};return {show:combatFeedback,clear:()=>clearCombatFeedback()};})()`,{
    $:id=>nodes[id],setTimeout:(fn,ms)=>{const id=++next;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>jobs.delete(id)
  });
  function advance(ms){const until=now+ms;while(true){const row=[...jobs].filter(([,j])=>j.at<=until).sort((a,b)=>a[1].at-b[1].at)[0];if(!row)break;now=row[1].at;jobs.delete(row[0]);row[1].fn();}now=until;}
  return {api,nodes,advance,jobs};
}

test('confirmed hit and simultaneous damage retain independent readable lifetimes',()=>{
  const {api,nodes,advance}=fixture();api.show('hit','命中 1 个目标');advance(273);api.show('hurt','受到伤害 −7');
  assert(nodes['combat-feedback'].textContent.includes('命中 1 个目标'),'damage must not erase the confirmed hit after 273ms');
  assert(nodes['combat-feedback'].textContent.includes('受到伤害 −7'));
  advance(450);assert(nodes['damage-feedback'].hidden);assert(!nodes['hurt-feedback'].hidden);
  advance(377);assert(nodes['attack-feedback'].hidden);assert(!nodes['hurt-feedback'].hidden);assert(!nodes['combat-feedback'].hidden);
  advance(273);assert(nodes['combat-feedback'].hidden);assert.equal(nodes['combat-feedback'].textContent,'');
});

test('a following empty swing cannot replace a fresh kill confirmation',()=>{
  const {api,nodes,advance}=fixture();api.show('hit','击败 1 个目标');advance(800);api.show('miss','未命中');
  assert(nodes['combat-feedback'].textContent.includes('击败 1 个目标'));
  advance(300);assert(nodes['combat-feedback'].hidden);api.show('miss','未命中');assert.equal(nodes['attack-feedback'].textContent,'未命中');
});

test('pause clears both channels and all old timers before a new encounter',()=>{
  const {api,nodes,advance,jobs}=fixture();api.show('hit','命中');advance(100);api.show('hurt','受伤');api.clear();
  assert.equal(jobs.size,0);assert(nodes['combat-feedback'].hidden);assert(nodes['damage-feedback'].hidden);
  advance(100);api.show('hit','下一次命中');advance(900);assert.equal(nodes['attack-feedback'].textContent,'下一次命中');
  advance(200);assert(nodes['combat-feedback'].hidden);
});
