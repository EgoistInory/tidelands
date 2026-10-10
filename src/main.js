import {WorldView} from './scene.js';
import {GameAudio} from './audio.js';
import {ATTACK_DURATION,ATTACK_IMPACT,GATHER_IMPACT} from './action-timing.js';
import {bindPointerControls} from './pointer-controls.js';
import {createWorld,terrain,LANDMARKS,regionAt,dayCycle} from './world.js';
import {freshGame,QUESTS,ITEMS,RECIPES,affordable,craft,canBuild,build,interact,resolveGather,eat,attack,resolveAttack,movePlayer,tick,nearest,nearestEnemy,serialize,restore} from './game.js';

const $=id=>document.getElementById(id);
export function boot({initialState=null,storageKey='tidelands-save-v1'}={}){
  let state=initialState||freshGame(),storage=null,loadError='';
  try{storage=localStorage;const saved=storage.getItem(storageKey);if(saved&&!initialState)state=restore(saved);}catch(error){loadError='旧存档未能读取；你可以开始新旅程或导入备份。';}
  let audioEnabled=true;try{audioEnabled=storage?.getItem(storageKey+'-audio')!=='off';}catch{}
  const audio=new GameAudio({enabled:audioEnabled});let audioUnavailable=false;
  async function unlockAudio(){try{await audio.unlock();}catch{audioUnavailable=true;audio.setEnabled(false);toast('声音暂不可用；游戏可以继续。');}}
  const world=createWorld();let view;
  try{view=new WorldView($('world'),world);}catch(error){$('load-status').textContent='无法启动 3D 渲染。请使用支持 WebGL 2 的浏览器并开启硬件加速。';$('start-button').textContent='3D 渲染不可用';console.error(error);return;}
  let started=false,paused=false,last=performance.now(),uiAt=0,saveAt=0,near=null,placement=null,buildType=null,toastUntil=0,lastQuest=state.quest,panelKind='';
  const keys=new Set(),stick={x:0,z:0},panel=$('panel'),newDialog=$('new-dialog');
  let waypoint=null,renderLost=false,pendingAttack=null,pendingGather=null;
  function cancelAttack(){if(pendingAttack){pendingAttack=null;state.attackAt=-100;}}
  function cancelGather(){if(pendingGather){pendingGather=null;view.gatherAt=-100;}}
  const mapBase=document.createElement('canvas');mapBase.width=220;mapBase.height=220;
  const mc=mapBase.getContext('2d');
  for(let x=0;x<220;x+=2)for(let y=0;y<220;y+=2){const h=terrain(x/220*800-400,y/220*800-400);mc.fillStyle=h<0?'#235e64':h<2?'#d7c991':h>28?'#9aab95':'#698b55';mc.fillRect(x,y,2,2);}
  function toast(text,duration=4200){if(!text)return;$('toast').textContent=text;$('toast').hidden=false;toastUntil=performance.now()+duration;
    if(panel.open){let feedback=$('panel-feedback');if(!feedback){feedback=document.createElement('p');feedback.id='panel-feedback';feedback.setAttribute('role','status');$('panel-body').append(feedback);}feedback.textContent=text;}
  }
  let combatTimer=null,damageTimer=null;
  function combatFeedback(kind,text){
    const output=$('combat-feedback');clearTimeout(combatTimer);
    output.dataset.kind=kind;output.textContent=text;output.hidden=false;
    combatTimer=setTimeout(()=>{output.hidden=true;},1100);
    if(kind==='hurt'){clearTimeout(damageTimer);$('damage-feedback').hidden=false;damageTimer=setTimeout(()=>{$('damage-feedback').hidden=true;},450);}
  }
  function save(){try{if(!storage)throw new Error('Storage unavailable');storage.setItem(storageKey,serialize(state));$('save-state').textContent='已保存';return true;}catch(error){$('save-state').textContent='无法保存，请导出备份';return false;}}
  function map(canvas,large=false){const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.drawImage(mapBase,0,0,w,h);
    const point=(x,z)=>[(x+400)/800*w,(z+400)/800*h];
    for(const o of LANDMARKS){if(!['npc','lighthouse'].includes(o.type))continue;const [x,y]=point(o.x,o.z);ctx.fillStyle=o.type==='npc'?'#efce84':'#f6edcf';ctx.beginPath();ctx.arc(x,y,large?5:3,0,Math.PI*2);ctx.fill();if(large){ctx.font='12px sans-serif';ctx.fillText(o.name,x+8,y+4);}}
    for(const b of state.buildings){const [x,y]=point(b.x,b.z);ctx.fillStyle='#d98e69';ctx.fillRect(x-2,y-2,4,4);}
    if(waypoint){const [x,y]=point(waypoint.x,waypoint.z);ctx.strokeStyle='#efcd73';ctx.beginPath();ctx.arc(x,y,large?9:5,0,Math.PI*2);ctx.stroke();}
    const [x,y]=point(state.player.x,state.player.z);ctx.save();ctx.translate(x,y);ctx.rotate(-state.player.yaw);ctx.fillStyle='#fff4c8';ctx.strokeStyle='#3f4d38';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,large?8:6);ctx.lineTo(large?-5:-4,large?-6:-4);ctx.lineTo(large?5:4,large?-6:-4);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
  }
  function updateUI(){
    $('hp').value=state.player.hp;$('hp-value').textContent=Math.ceil(state.player.hp);$('stamina').value=state.player.stamina;$('stamina-value').textContent=Math.floor(state.player.stamina);
    const enemy=nearestEnemy(state);$('enemy-status').hidden=!enemy;
    if(enemy){
      const name=enemy.type==='boar'?'野猪':'海岸蟹',distance=Math.hypot(enemy.x-state.player.x,enemy.z-state.player.z),hp=Math.ceil(enemy.hp),max=Math.max(enemy.type==='boar'?70:40,hp);
      $('enemy-name').textContent=name;$('enemy-hp').max=max;$('enemy-hp').value=hp;$('enemy-hp').setAttribute('aria-label',`${name}生命`);$('enemy-hp-value').textContent=`${hp} / ${max}`;
      $('enemy-status').dataset.danger=distance<2.9?'close':'near';
      $('enemy-hint').textContent=`${Math.ceil(distance)} 米 · ${distance<2.9?'近身威胁 · 反击或退开':distance<=5.2?'可攻击 · 空格 / 攻击':'正在靠近 · 迎战或拉开距离'}`;
    }
    $('region').textContent=regionAt(state.player.x,state.player.z);$('coordinates').textContent=`位置 X ${state.player.x.toFixed(1)}，Z ${state.player.z.toFixed(1)}；建筑 ${state.buildings.length}；击败 ${state.kills}`;
    const q=QUESTS[state.quest];$('quest-title').textContent=q.title;$('quest-text').textContent=q.text;
    const target=state.quest===0?'keeper':state.quest===3?'botanist':state.quest===4?'explorer':state.quest===5?'lighthouse':null;
    const goal=waypoint||LANDMARKS.find(o=>o.id===target);
    $('quest-hint').textContent=goal?`${waypoint?'导航：自定义标记':q.hint} · ${Math.round(Math.hypot(goal.x-state.player.x,goal.z-state.player.z))} 米`:q.hint;
    const cycle=dayCycle(state.time);$('daytime').textContent=`第 ${cycle.day} 天 · ${cycle.label}`;
    const yaw=((-view.yaw%(Math.PI*2))+Math.PI*2)%(Math.PI*2);$('bearing').textContent=['北','东北','东','东南','南','西南','西','西北'][Math.round(yaw/(Math.PI/4))%8];
    $('food-count').textContent=state.inventory.berry+state.inventory.meal;
    const weaponButton=document.querySelector('[data-slot="axe"], [data-slot="sword"]');
    const weapon=state.inventory.sword?'sword':'axe';weaponButton.dataset.slot=weapon;weaponButton.querySelector('small').textContent=ITEMS[weapon];weaponButton.querySelector('span').textContent=weapon==='sword'?'⚔':'⚒';
    for(const button of document.querySelectorAll('[data-slot]'))button.classList.toggle('selected',button.dataset.slot===(buildType||state.selected));
    $('interact-button').hidden=!near&&!buildType;
    const names={tree:'采集木材',stone:'采集石料',berry:'采集浆果',fiber:'采集纤维',shell:'拾取贝壳',crystal:'采集晶石',npc:'交谈',campfire:'休息',tent:'休息 / 设置营地',workbench:'工作台',lighthouse:'查看灯塔',cottage:'查看小屋',ruin:'阅读石碑'};
    $('interact-label').textContent=buildType?'确认建造':near?`${names[near.type]||'交互'}${near.type==='npc'?' · '+near.name.split(' · ')[1]:''}`:'';
    $('placement-tip').hidden=!buildType;if(buildType)$('placement-tip').textContent=placement?.error||'在前方放置 · E 确认 · Esc 取消';
    map($('minimap'));if(panelKind==='map'&&$('large-map'))map($('large-map'),true);
    if(state.quest!==lastQuest){audio.effect('quest');lastQuest=state.quest;const note=state.quest===6?'归航灯塔已被修复，主线完成！你可以继续自由探索。':`新的目标：${q.title}`;toast(!$('toast').hidden?`${$('toast').textContent}\n${note}`:note,9000);save();}
  }
  function action(){if(!started||paused||pendingGather)return;cancelAttack();if(state.time-state.attackAt<ATTACK_DURATION)return;if(buildType){if(!placement)return;const message=build(state,world.objects,buildType,placement.x,placement.z);toast(message);if(message.startsWith('建造完成')){audio.effect('craft');buildType=null;placement=null;view.setPreview(null);save();view.sync(state);}return;}
    const result=interact(state,near,{defer:true});if(result?.pending){pendingGather=result.pending;view.gatherAt=result.pending.at;state.player.yaw=Math.atan2(near.x-state.player.x,near.z-state.player.z);return;}toast(result,near?.type==='npc'?8500:4200);save();view.sync(state);updateUI();}
  function finishGather(){const message=resolveGather(state,pendingGather);pendingGather=null;if(!message)return;if(message.includes(' +'))audio.effect('gather');toast(message);save();view.sync(state);updateUI();}
  function select(slot){if(paused)return;if(slot!=='food'){cancelAttack();cancelGather();}
    if(slot==='food'){const hp=state.player.hp;toast(eat(state));if(state.player.hp>hp)audio.effect('food');save();}
    else if(['campfire','tent','workbench'].includes(slot))beginBuild(slot);
    else{if(['axe','sword'].includes(slot)&&!state.inventory[slot]){toast(`还没有${ITEMS[slot]}。按 C 查看制作配方。`);return;}state.selected=slot;buildType=null;view.setPreview(null);save();}
    updateUI();
  }
  function beginBuild(type){if(!affordable(state,RECIPES[type].cost)){toast('材料不足。按 C 查看制作所需材料。');return;}buildType=type;view.setPreview(type);closePanel();toast('走到合适的位置，按 E 确认建造；Esc 取消。');}
  function closePanel(){if(renderLost)return;panel.close();panelKind='';paused=false;audio.setActive(true);void unlockAudio();keys.clear();$('world').focus({preventScroll:true});}
  function openPanel(kind){if(!started||renderLost)return;cancelAttack();cancelGather();panelKind=kind;paused=true;$('combat-feedback').hidden=true;$('damage-feedback').hidden=true;audio.setActive(false);keys.clear();resetPointers();
    const titles={bag:'旅人的背包',craft:'制作与建造',map:'群岛地图',pause:'旅途小憩'};$('panel-title').textContent=titles[kind];const body=$('panel-body');body.replaceChildren();
    if(kind==='bag'){
      const inventory=document.createElement('div');inventory.className='inventory';
      for(const [key,label]of Object.entries(ITEMS)){const item=document.createElement('div');item.textContent=label;const count=document.createElement('strong');count.textContent=state.inventory[key];item.append(count);inventory.append(item);}body.append(inventory);
      const food=document.createElement('button');food.textContent='食用食物，恢复生命';food.style.marginTop='18px';food.disabled=!(state.inventory.berry||state.inventory.meal)||state.player.hp>=100;food.onclick=()=>{const hp=state.player.hp,message=eat(state);save();openPanel('bag');toast(message);if(state.player.hp>hp)audio.effect('food',{menu:true});updateUI();};body.append(food);
    }else if(kind==='craft'){
      const intro=document.createElement('p');intro.className='panel-intro';intro.textContent='建筑消耗材料后放置在世界中；制作工具会直接放入背包。';body.append(intro);
      for(const [key,recipe]of Object.entries(RECIPES)){
        const row=document.createElement('div');row.className='recipe';const info=document.createElement('div');const title=document.createElement('h3');title.textContent=recipe.name;const desc=document.createElement('p');desc.textContent=recipe.description;
        const cost=document.createElement('p');cost.className='cost';cost.textContent=Object.entries(recipe.cost).map(([k,n])=>`${ITEMS[k]} ${state.inventory[k]}/${n}`).join(' · ');info.append(title,desc,cost);
        const button=document.createElement('button');const owned=['axe','sword'].includes(key)&&state.inventory[key]>0;const workbenchMissing=key==='sword'&&!state.buildings.some(b=>b.type==='workbench');
        button.textContent=owned?'已拥有':workbenchMissing?'需要工作台':affordable(state,recipe.cost)?'制作':'材料不足';button.disabled=owned||workbenchMissing||!affordable(state,recipe.cost);
        button.onclick=()=>{const message=craft(state,key);if(message==='place')beginBuild(key);else{save();openPanel('craft');toast(message);if(message.startsWith('制作完成'))audio.effect('craft',{menu:true});updateUI();}};row.append(info,button);body.append(row);
      }
    }else if(kind==='map'){
      const canvas=document.createElement('canvas');canvas.width=580;canvas.height=580;canvas.id='large-map';canvas.setAttribute('aria-label','群岛地图，点击设置导航标记');body.append(canvas);map(canvas,true);
      const legend=document.createElement('p');legend.className='map-legend';legend.textContent='金点：岛民 · 白点：灯塔 · 橙点：营地 · 箭头：你 · 点击地图设置导航';body.append(legend);
      canvas.onclick=event=>{const rect=canvas.getBoundingClientRect();waypoint={x:(event.clientX-rect.left)/rect.width*800-400,z:(event.clientY-rect.top)/rect.height*800-400};updateUI();toast('已设置地图标记。任务区会显示距离。');};
      const clear=document.createElement('button');clear.textContent='清除导航标记';clear.onclick=()=>{waypoint=null;updateUI();toast('导航标记已清除，任务提示已恢复。');};body.append(clear);
    }else{
      const menu=document.createElement('div');menu.className='menu';
      for(const [label,fn]of [['继续探索',closePanel],['保存进度',()=>toast(save()?'存档已保存。':'无法保存，请导出备份。')],['导出存档',exportSave],['导入存档',()=>$('import-file').click()],['开始新旅程',()=>newDialog.showModal()]]){const b=document.createElement('button');b.textContent=label;b.onclick=fn;menu.append(b);}
      const sound=document.createElement('button');sound.textContent=audioUnavailable?'声音：暂不可用':audio.enabled?'声音：开':'声音：关';sound.setAttribute('aria-pressed',String(audio.enabled));sound.onclick=async()=>{audio.setEnabled(!audio.enabled);audioUnavailable=false;try{storage?.setItem(storageKey+'-audio',audio.enabled?'on':'off');}catch{}if(audio.enabled)await unlockAudio();sound.textContent=audioUnavailable?'声音：暂不可用':audio.enabled?'声音：开':'声音：关';sound.setAttribute('aria-pressed',String(audio.enabled));};menu.append(sound);
      const hint=document.createElement('p');hint.className='muted';hint.textContent='WASD / 方向键移动，Shift 奔跑，E 交互，空格攻击，B 背包，C 制作，M 地图。手机左侧摇杆移动，拖动空白场景旋转镜头。进度只保存于当前浏览器。';menu.append(hint);body.append(menu);
    }
    if(!panel.open)panel.showModal();
  }
  function exportSave(){const blob=new Blob([serialize(state)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`tidelands-day-${Math.floor(state.time/480)+1}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('存档已导出。');}
  $('import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;
    try{if(file.size>2_000_000)throw new Error('存档文件超过 2 MB');const imported=restore(await file.text());state=imported;waypoint=null;buildType=null;placement=null;view.setPreview(null);view.sync(state);save();closePanel();updateUI();toast('存档已导入。');}catch(error){toast(`导入失败：${error.message}`,7000);}finally{event.target.value='';}
  });
  $('start-button').disabled=false;$('start-button').textContent=state.time>121||state.quest?'继续旅程':'开始旅程';$('load-status').textContent=loadError||'群岛已就绪 · 无需联网';
  $('start-button').onclick=()=>{started=true;audio.setActive(true);void unlockAudio();$('start-screen').hidden=true;$('hud').hidden=false;$('world').focus();last=performance.now();updateUI();toast(state.quest?`欢迎回来。当前目标：${QUESTS[state.quest].title}`:'欢迎来到群岛。向守灯人走去，靠近后按 E 交谈。',7000);};
  $('map-button').onclick=()=>openPanel('map');$('minimap').onclick=()=>openPanel('map');$('pause-button').onclick=()=>openPanel('pause');$('bag-button').onclick=()=>openPanel('bag');$('craft-button').onclick=()=>openPanel('craft');$('panel-close').onclick=closePanel;
  panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});
  function strike(){
    const r=attack(state,{defer:true});
    if(r.pending){cancelGather();pendingAttack=r.pending;audio.effect('swing');}
    view.sync(state);updateUI();
  }
  function finishStrike(){
    const r=resolveAttack(state,pendingAttack);pendingAttack=null;if(!r)return;
    if(r.hits.length)audio.effect('hit');
    const defeated=r.hits.filter(id=>state.enemies.find(e=>e.id===id)?.hp<=0).length;
    combatFeedback(r.hits.length?'hit':'miss',defeated?`击败 ${defeated} 个目标`:r.hits.length?`命中 ${r.hits.length} 个目标`:'未命中 · 靠近目标再攻击');
    view.sync(state);updateUI();
  }
  $('interact-button').onclick=action;$('attack-button').onclick=()=>{if(started&&!paused)strike();};
  for(const button of document.querySelectorAll('[data-slot]'))button.onclick=()=>select(button.dataset.slot);
  $('cancel-new').onclick=()=>newDialog.close();$('confirm-new').onclick=()=>{state=freshGame();waypoint=null;buildType=null;placement=null;view.setPreview(null);view.sync(state);newDialog.close();save();closePanel();updateUI();toast('新的旅程开始了。');};
  const movement={w:[0,-1],a:[-1,0],s:[0,1],d:[1,0],arrowup:[0,-1],arrowleft:[-1,0],arrowdown:[0,1],arrowright:[1,0]};
  function relative(x,z){return {x:x*Math.cos(view.yaw)+z*Math.sin(view.yaw),z:-x*Math.sin(view.yaw)+z*Math.cos(view.yaw)};}
  document.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;const k=event.key.toLowerCase();
    if(k==='escape'){if(newDialog.open)return;if(buildType){buildType=null;placement=null;view.setPreview(null);updateUI();event.preventDefault();}else if(started&&!panel.open){openPanel('pause');event.preventDefault();}return;}
    if(!started||paused)return;
    if(movement[k]){event.preventDefault();if(!keys.has(k)){const [x,z]=movement[k],v=relative(x,z);movePlayer(state,world.objects,v.x,v.z,.06,event.shiftKey);}keys.add(k);return;}
    keys.add(k);if(event.repeat)return;
    if(k==='e')action();else if(k===' '){event.preventDefault();strike();}else if(k==='b')openPanel('bag');else if(k==='c')openPanel('craft');else if(k==='m')openPanel('map');else if(/^[1-6]$/.test(k))select(['hand',state.inventory.sword?'sword':'axe','food','campfire','tent','workbench'][Number(k)-1]);
  });
  document.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()));
  window.addEventListener('blur',()=>{keys.clear();resetPointers();if(started&&!panel.open)openPanel('pause');});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){keys.clear();resetPointers();save();if(started&&!panel.open)openPanel('pause');}});
  const resetPointers=bindPointerControls($('world'),$('joystick'),{
    enabled:()=>started&&!paused,stick,
    look:(dx,dy)=>{view.yaw-=dx*.006;view.pitch=Math.max(.08,Math.min(1.15,view.pitch-dy*.004));},
    zoom:delta=>{view.distance=Math.max(12,Math.min(45,view.distance+delta*.02));}
  });
  window.addEventListener('resize',()=>view.resize());window.addEventListener('pagehide',save);
  $('world').addEventListener('webglcontextlost',event=>{
    event.preventDefault();cancelAttack();cancelGather();renderLost=true;paused=true;keys.clear();resetPointers();audio.setActive(false);
    const saved=save();newDialog.close();$('start-button').disabled=true;$('panel-close').disabled=true;
    $('panel-title').textContent='画面暂时中断';const body=$('panel-body');body.replaceChildren();
    const message=document.createElement('p');message.setAttribute('role','alert');message.textContent=saved?'旅程已暂停，进度已保存。刷新页面后可继续探索。':'旅程已暂停，但进度未能保存。请先导出存档，再刷新页面。';body.append(message);
    const backup=document.createElement('button');backup.textContent='导出存档备份';backup.onclick=exportSave;
    const reload=document.createElement('button');reload.textContent='刷新页面';reload.onclick=()=>location.reload();body.append(backup,reload);
    if(!panel.open)panel.showModal();backup.focus();
  });
  view.sync(state);near=nearest(state,world.objects);
  const startHeight=Math.max(terrain(state.player.x,state.player.z),-.45);
  view.camera.position.set(state.player.x+Math.sin(view.yaw)*view.distance,startHeight+2.4+Math.tan(view.pitch)*view.distance,state.player.z+Math.cos(view.yaw)*view.distance);
  function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;let moving=false;
    if(started&&!paused){let x=stick.x,z=stick.z;for(const k of keys)if(movement[k]){x+=movement[k][0];z+=movement[k][1];}moving=Math.hypot(x,z)>.08;const running=keys.has('shift')&&moving;const v=relative(x,z);movePlayer(state,world.objects,v.x,v.z,dt,running);const feedback={},message=tick(state,dt,running,feedback);
      if(feedback.damage>0){view.hurtAt=state.time;audio.effect('hit');combatFeedback('hurt',feedback.respawned?'倒下了 · 已返回营地':`受到伤害 −${Math.ceil(feedback.damage)}`);}
      if(feedback.respawned){
        cancelAttack();cancelGather();keys.clear();resetPointers();moving=false;buildType=null;placement=null;view.setPreview(null);
        view.gatherAt=-100;view.player.userData.lastPosition=null;
        view.camera.position.set(state.player.x+Math.sin(view.yaw)*view.distance,terrain(state.player.x,state.player.z)+2.4+Math.tan(view.pitch)*view.distance,state.player.z+Math.cos(view.yaw)*view.distance);
        save();updateUI();
      }
      if(pendingAttack&&state.time>=pendingAttack.at+ATTACK_IMPACT)finishStrike();
      if(pendingGather&&state.time>=pendingGather.at+GATHER_IMPACT)finishGather();
      if(message)toast(message,feedback.respawned?9000:4200);near=nearest(state,world.objects);
      if(buildType){const px=state.player.x+Math.sin(state.player.yaw)*6,pz=state.player.z+Math.cos(state.player.yaw)*6;placement={x:px,z:pz,error:canBuild(state,world.objects,buildType,px,pz)};}else placement=null;
      if(now-uiAt>140){view.sync(state);updateUI();uiAt=now;}if(now-saveAt>8000){save();saveAt=now;}
    }
    if(now>toastUntil)$('toast').hidden=true;
    if(!renderLost){view.draw(state,near,placement,moving,dt);if(started&&!paused)audio.update(state.player,state.time,terrain(state.player.x,state.player.z),view.player.userData.footfallCount);}requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
if(document.body.dataset.testHarness!=='true')boot();
