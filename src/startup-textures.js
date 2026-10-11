function waitUnlessAborted(promise,signal){
  if(!signal)return promise;
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(new DOMException('准备已中断','AbortError'));
    if(signal.aborted){abort();return;}
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}

export async function prepareSurfaceTextures(surfaces,renderer,{signal,nextFrame=()=>new Promise(requestAnimationFrame),onProgress=()=>{}}={}){
  const check=()=>{if(signal?.aborted)throw new DOMException('准备已中断','AbortError');};
  check();await waitUnlessAborted(Promise.all(surfaces.map(s=>s.loaded)),signal);check();
  const textures=[...new Set(surfaces.flatMap(s=>s.textures))];
  onProgress(0,textures.length);let done=0;
  for(const texture of textures){
    check();await waitUnlessAborted(nextFrame(),signal);check();
    renderer.initTexture(texture);
    const gl=renderer.getContext?.(),error=gl?.getError();
    if(error!==undefined&&error!==gl.NO_ERROR)throw new Error(`地表准备失败（WebGL ${error}）`);
    onProgress(++done,textures.length);
  }
  check();return {uploaded:done,total:textures.length};
}
