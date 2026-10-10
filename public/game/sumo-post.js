/* Sumo Bounce — post-process layer (bloom). 2026-08-30 그래픽 고도화. 네온 스레드 파일럿
   neon-post.js 3차판 이식 + 실기기 교훈 반영(동적 품질 3단계·히스테리시스·크로스페이드).
   게임 로직은 이 파일을 «모른다». 게임은 세계를 2D 캔버스(scene)에 그리고, 이 레이어가 그
   비트맵을 WebGL 텍스처로 받아 저해상도 블러 2겹을 가산해 화면용 WebGL 캔버스에 뿌린다.
   HUD 문자·애나운스·비네트는 원래 #gameCanvas(투명)에 블룸 «위에» 그린다 — 글자는 번지지 않는다.
   WebGL 이 없거나 컨텍스트를 잃으면 init() 이 false 를 돌려주고 게임은 예전 경로(단일 캔버스,
   shadowBlur 폴백)로 그린다.
   ── 셰이더 규율 (네온 3차 「장애물이 계속 깜빡거려」 실기기 사고 반영) ──
   · bright-pass 는 «다운샘플 전» 원본 텍셀 «각각»에 soft-knee 문턱을 걸고 나서 평균한다(블록 N×N, N=4 또는 8).
     평균 뒤 문턱은 얇은 선이 블록 경계에 걸리는 위상에 따라 k 가 0↔1 로 튀어 스크롤·이동 시 깜빡였다.
     텍셀별 문턱이면 블룸 에너지가 «덮는 면적에 비례» — 위상 무관. 텍셀 페치 수는 전해상도 1패스와 동일.
   · 정밀도 highp(GL_FRAGMENT_PRECISION_HIGH 시). 전해상도 샘플 좌표는 varying 대신 gl_FragCoord(항상 highp),
     scene 텍스처는 NEAREST(합성 시 1:1 정확 복사) — iOS fp16 mediump 에서 얇은 선 샘플이 흔들리는 문제 차단.
   · 품질 단계: 2 = bright(4×4)→1/4 블러(타이트)→1/8 블러(와이드) · 1 = bright(4×4)→1/8 블러(와이드만, 1/4 블러 생략)
     · 0 = bright(8×8)→1/8 블러(와이드만, 1/4 단계 자체 생략) · off. (구판의 1/2 해상도 단계는 텍셀별 문턱에서는
     4×4 직접 블록과 결과가 같아 순비용이라 제거.)
   ── 단계 전환 규율 ──
   · bright-pass 문턱 .80 + soft-knee .14 (규칙 5): 선수 몸통·피부·눈 흰자(최대 lum .79)는 문턱 «아래», 흰 코어·트레일·스파크(≥.94)만
     «완전» 번짐 — 핵심 오브젝트의 번짐량이 품질 단계에 «의존하지 않게» 한다(_gfx_evidence_260830/lum_audit.json).
   · 판정: 플레이 중 프레임 간격 90프레임(1.5s) 창에서 22ms 초과가 25% 를 넘으면 «강등 후보».
   · 히스테리시스: 한 단계에 «최소 8초» 머문다(강등·승격 모두). 승격은 «15초 조용»(창마다 22ms 초과 < 5/90)
     해야 하고, 세션당 «최대 2회». off(폴백)는 «한 번·불가역» — 컨텍스트 손실도 같다.
   · 전환은 «크로스페이드 400ms»: 블룸 가중치(k1/k2)와 게임 쪽 품질값(qf: 파티클 상한·배경 동적 레이어)을
     이전 단계 값에서 새 단계 값으로 보간한다. 페이드 중에는 두 단계 중 «비싼 쪽» 경로로 그린다(급변 0).
   · 캔버스·DPR 은 여기서 건드리지 않는다(게임 쪽이 런 시작 시 결정, 플레이 중 보류).
   · 전환마다 P.log 에 {t,from,to,why,bad} 를 남긴다(하네스가 «5초 안 2회 이상 전환 = 0» 을 검증). */
(function(){
"use strict";
var PREC="#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n";
var VS="attribute vec2 a;varying vec2 v;void main(){v=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
/* bright pass + N×N 다운샘플: 출력 텍셀 하나 = 원본 N×N 블록. 텍셀마다 soft-knee 문턱 → 평균.
   원본은 위가 0행(캔버스 업로드), FBO 는 아래가 0행이라 y 를 여기서 한 번 뒤집는다(UNPACK_FLIP_Y 안 씀).
   블록이 가장자리를 넘치면 CLAMP_TO_EDGE 가 가장자리 텍셀을 되풀이한다(무시 가능). */
function brightSrc(N){
  return PREC+"uniform sampler2D s;uniform vec2 res;uniform float thr;uniform float knee;"+
  "vec3 br(vec2 t){vec3 c=texture2D(s,t).rgb;float l=dot(c,vec3(.2126,.7152,.0722));float k=clamp((l-thr)/knee,0.,1.);k=k*k*(3.-2.*k);return c*k;}"+
  "void main(){vec2 b=floor(gl_FragCoord.xy)*"+N+".;float y0=res.y-b.y-"+N+".;vec3 a=vec3(0.);"+
  "for(int j=0;j<"+N+";j++){for(int i=0;i<"+N+";i++){a+=br((vec2(b.x+float(i),y0+float(j))+.5)/res);}}gl_FragColor=vec4(a*"+(1/(N*N))+",1.);}";
}
/* 2x2 bilinear downsample (1/4 → 1/8) — 문턱은 이미 텍셀별로 지나갔다 */
var FS_DOWN=PREC+"varying vec2 v;uniform sampler2D s;uniform vec2 px;"+
"void main(){vec3 c=(texture2D(s,v+px*vec2(-.5,-.5)).rgb+texture2D(s,v+px*vec2(.5,-.5)).rgb+texture2D(s,v+px*vec2(-.5,.5)).rgb+texture2D(s,v+px*vec2(.5,.5)).rgb)*.25;gl_FragColor=vec4(c,1.);}";
/* separable gaussian, 5 linear taps (= 9 texel) */
var FS_BLUR=PREC+"varying vec2 v;uniform sampler2D s;uniform vec2 d;"+
"void main(){vec3 c=texture2D(s,v).rgb*.2270270270;"+
"c+=(texture2D(s,v+d*1.3846153846).rgb+texture2D(s,v-d*1.3846153846).rgb)*.3162162162;"+
"c+=(texture2D(s,v+d*3.2307692308).rgb+texture2D(s,v-d*3.2307692308).rgb)*.0702702703;gl_FragColor=vec4(c,1.);}";
/* 합성: scene 은 gl_FragCoord 로 1:1 정확 샘플(NEAREST), 블러 2겹은 가중 k1/k2 로 가산 */
var FS_COMP=PREC+"uniform sampler2D s;uniform sampler2D b1;uniform sampler2D b2;uniform vec2 res;uniform float k1;uniform float k2;"+
"void main(){vec2 u=gl_FragCoord.xy/res;vec3 c=texture2D(s,vec2(u.x,1.-u.y)).rgb+texture2D(b1,u).rgb*k1+texture2D(b2,u).rgb*k2;gl_FragColor=vec4(min(c,1.),1.);}";

var P={supported:false,on:false,auto:true,autoOff:false,level:2,levelMax:2,qf:2,threshold:.80,knee:.14,tight:.55,wide:.40,
  scene:null,sctx:null,glc:null,gl:null,W:0,H:0,lost:false,frames:0,uploadMode:"",highp:false,
  log:[],changes:0,promotions:0,pathLevel:2,k1e:.55,k2e:.40,
  DWELL:8000,QUIET:15000,MAXPROMO:2,FADE:400};
var prog={},fbo={},quad=null,sceneTex=null,gl=null;
var nowMs=function(){return (typeof performance!=="undefined"&&performance.now)?performance.now():Date.now()};

function compile(type,src){
  var sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);
  if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS)){throw new Error("shader: "+gl.getShaderInfoLog(sh))}
  return sh;
}
function link(fs){
  var p=gl.createProgram();gl.attachShader(p,compile(gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs));
  gl.bindAttribLocation(p,0,"a");gl.linkProgram(p);
  if(!gl.getProgramParameter(p,gl.LINK_STATUS)){throw new Error("link: "+gl.getProgramInfoLog(p))}
  var u={},n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
  for(var i=0;i<n;i++){var inf=gl.getActiveUniform(p,i);u[inf.name]=gl.getUniformLocation(p,inf.name)}
  return{p:p,u:u};
}
function makeTex(w,h,nearest){
  var t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
  var f=nearest?gl.NEAREST:gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,f);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,f);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(w)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
  return t;
}
function makeFbo(w,h){
  var t=makeTex(w,h,false),f=gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER,f);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,t,0);
  var ok=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  if(!ok)throw new Error("fbo incomplete");
  return{f:f,t:t,w:w,h:h};
}
function delFbo(o){if(!o)return;gl.deleteFramebuffer(o.f);gl.deleteTexture(o.t)}
function alloc(W,H){
  var w1=Math.max(1,Math.ceil(W/4)),h1=Math.max(1,Math.ceil(H/4)),w2=Math.max(1,Math.ceil(W/8)),h2=Math.max(1,Math.ceil(H/8));
  delFbo(fbo.a1);delFbo(fbo.b1);delFbo(fbo.a2);delFbo(fbo.b2);
  fbo.a1=makeFbo(w1,h1);fbo.b1=makeFbo(w1,h1);fbo.a2=makeFbo(w2,h2);fbo.b2=makeFbo(w2,h2);
  if(sceneTex)gl.deleteTexture(sceneTex);
  sceneTex=makeTex(0,0,true);
  P.uploadMode="";
  P.W=W;P.H=H;
}
function pass(pr,target,bind){
  gl.useProgram(pr.p);
  gl.bindFramebuffer(gl.FRAMEBUFFER,target?target.f:null);
  gl.viewport(0,0,target?target.w:P.W,target?target.h:P.H);
  bind(pr.u);
  gl.drawArrays(gl.TRIANGLES,0,3);
}
function tex(unit,t){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t)}
function setup(){
  prog={};fbo={};sceneTex=null;
  prog.bright4=link(brightSrc(4));prog.bright8=link(brightSrc(8));prog.down=link(FS_DOWN);prog.blur=link(FS_BLUR);prog.comp=link(FS_COMP);
  var pf=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);P.highp=!!(pf&&pf.precision>0);
  quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  P.W=0;P.H=0;
}

/* ── 단계 전환 컨트롤러 ── */
var fade=null;            // {t0, k1a,k2a,qa, k1b,k2b,qb, path, toOff}
var lastChangeT=0,noisyT=-1e9;
/* 단계별 합성 가중치. 페이드 중엔 두 단계 중 비싼 경로(path)로 그리므로 텍스처 의미가 같다:
   2 = a1(1/4 타이트) + a2(1/8 와이드), 1·0 = a2 만(타이트 몫 일부를 와이드에 얹음 — 빛의 양 보존), -1(off) = 0. */
function gainsFor(L){
  if(L>=2)return{k1:P.tight,k2:P.wide};
  if(L>=0)return{k1:0,k2:P.wide+P.tight*.6};
  return{k1:0,k2:0};
}
function finishOff(){
  P.on=false;P.autoOff=true;P.qf=0;
  if(P.glc)P.glc.style.visibility="hidden";
}
function change(to,why,bad){
  var now=nowMs(),from=P.level;
  var g=gainsFor(to);
  fade={t0:now,k1a:P.k1e,k2a:P.k2e,qa:P.qf,k1b:g.k1,k2b:g.k2,qb:Math.max(0,to),path:Math.max(from,to),toOff:to<0};
  P.log.push({t:Math.round(now),from:from,to:to,why:why,bad:bad});
  P.changes++;lastChangeT=now;wn=0;wi=0;
  if(to>=0)P.level=to;else P.autoOff=true;   // off 는 페이드가 끝난 뒤 finishOff() — 이후 불가역
  try{console.info("[sumo-post] level "+from+" -> "+(to<0?"off":to)+" ("+why+", "+bad+"/90 > 22ms)")}catch(_){}
}
/* 매 프레임: 페이드 진행(가중치·qf 보간). 끝나면 목표 경로로 고정. */
function tick(){
  if(!fade){P.pathLevel=P.level;return}
  var e=Math.min(1,(nowMs()-fade.t0)/P.FADE);e=e*e*(3-2*e);
  P.k1e=fade.k1a+(fade.k1b-fade.k1a)*e;P.k2e=fade.k2a+(fade.k2b-fade.k2a)*e;P.qf=fade.qa+(fade.qb-fade.qa)*e;
  P.pathLevel=fade.path;
  if(e>=1){var off=fade.toOff;fade=null;P.pathLevel=P.level;if(off)finishOff()}
}

P.init=function(gameCanvas){
  try{
    if(typeof window==="undefined"||!window.WebGLRenderingContext)return false;
    if(/[?&]bloom=off\b/.test(location.search))return false;
    var m=/[?&]bloom=(\d)/.exec(location.search);if(m){P.level=Math.max(0,Math.min(2,+m[1]));P.levelMax=P.level}
    /* 검증용 노브(하네스 A/B 전용) — 문턱·니 오버라이드 */
    var mt=/[?&]bloomthr=([\d.]+)/.exec(location.search);if(mt)P.threshold=Math.max(0,Math.min(1,+mt[1]));
    var mk=/[?&]bloomknee=([\d.]+)/.exec(location.search);if(mk)P.knee=Math.max(.01,Math.min(1,+mk[1]));
    var glc=document.createElement("canvas");
    glc.id="sumoGL";glc.setAttribute("aria-hidden","true");
    glc.style.cssText="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    var attrs={alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:"high-performance",failIfMajorPerformanceCaveat:false};
    gl=glc.getContext("webgl",attrs)||glc.getContext("experimental-webgl",attrs);
    if(!gl)return false;
    P.gl=gl;P.glc=glc;
    setup();
    P.scene=document.createElement("canvas");
    P.sctx=P.scene.getContext("2d",{alpha:false});
    if(!P.sctx)return false;
    gameCanvas.parentNode.insertBefore(glc,gameCanvas);
    /* 컨텍스트 손실 = 폴백 «한 번·불가역». 복구 이벤트가 와도 돌아오지 않는다(깜빡임 원천 차단). */
    glc.addEventListener("webglcontextlost",function(e){
      P.lost=true;fade=null;
      if(P.on){P.log.push({t:Math.round(nowMs()),from:P.level,to:-1,why:"contextlost",bad:0});P.changes++}
      finishOff();
      try{console.warn("[sumo-post] context lost -> fallback (permanent)")}catch(_){}
    },false);
    var g=gainsFor(P.level);P.k1e=g.k1;P.k2e=g.k2;P.qf=P.level;P.pathLevel=P.level;
    lastChangeT=nowMs();
    P.supported=true;P.on=true;
    return true;
  }catch(e){try{console.warn("[sumo-post] disabled:",e&&e.message)}catch(_){}P.supported=false;P.on=false;return false}
};
/* 프레임 시작: 세계를 그릴 2D 컨텍스트(블룸 켜짐) 또는 null(꺼짐 → 게임이 #gameCanvas 에 직접). */
P.begin=function(W,H){
  tick();
  if(!P.supported||!P.on||P.lost)return null;
  if(P.scene.width!==W||P.scene.height!==H){P.scene.width=W;P.scene.height=H}
  if(P.glc.width!==W||P.glc.height!==H){P.glc.width=W;P.glc.height=H}
  if(P.W!==W||P.H!==H)alloc(W,H);
  P.sctx.setTransform(1,0,0,1,0,0);
  return P.sctx;
};
/* 프레임 끝: 업로드 → bright(텍셀별 문턱)+블록 다운샘플 → 블러 → 합성. 경로는 pathLevel(페이드 중엔 비싼 쪽), 가중치는 보간값.
   경로 2: bright4→a1, a1 블러(타이트), a1→a2 다운, a2 블러(와이드)
   경로 1: bright4→a1, a1→a2 다운, a2 블러            (1/4 블러 2패스 생략)
   경로 0: bright8→a2, a2 블러                        (1/4 단계 자체 생략) */
P.end=function(){
  if(!P.supported||!P.on||P.lost)return;
  var W=P.W,H=P.H;
  tex(0,sceneTex);
  if(P.uploadMode!=="sub"){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,P.scene);P.uploadMode="sub"}
  else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,P.scene);
  var a1=fbo.a1,b1=fbo.b1,a2=fbo.a2,b2=fbo.b2,L=P.pathLevel,k1=P.k1e,k2=P.k2e;
  var bindBright=function(u){tex(0,sceneTex);gl.uniform1i(u.s,0);gl.uniform2f(u.res,W,H);gl.uniform1f(u.thr,P.threshold);gl.uniform1f(u.knee,P.knee)};
  if(L>=1){
    pass(prog.bright4,a1,bindBright);
    if(L>=2){
      pass(prog.blur,b1,function(u){tex(0,a1.t);gl.uniform1i(u.s,0);gl.uniform2f(u.d,1/a1.w,0)});
      pass(prog.blur,a1,function(u){tex(0,b1.t);gl.uniform1i(u.s,0);gl.uniform2f(u.d,0,1/a1.h)});
    }else k1=0;
    pass(prog.down,a2,function(u){tex(0,a1.t);gl.uniform1i(u.s,0);gl.uniform2f(u.px,1/a1.w,1/a1.h)});
  }else{
    pass(prog.bright8,a2,bindBright);
    k1=0;
  }
  pass(prog.blur,b2,function(u){tex(0,a2.t);gl.uniform1i(u.s,0);gl.uniform2f(u.d,1/a2.w,0)});
  pass(prog.blur,a2,function(u){tex(0,b2.t);gl.uniform1i(u.s,0);gl.uniform2f(u.d,0,1/a2.h)});
  pass(prog.comp,null,function(u){tex(0,sceneTex);tex(1,a1.t);tex(2,a2.t);gl.uniform1i(u.s,0);gl.uniform1i(u.b1,1);gl.uniform1i(u.b2,2);gl.uniform2f(u.res,W,H);gl.uniform1f(u.k1,k1);gl.uniform1f(u.k2,k2)});
  P.frames++;
};
/* 수동 on/off — 한 번 자동 off 됐거나 컨텍스트를 잃었으면 다시 켜지지 않는다(불가역). */
P.setEnabled=function(v){if(!P.supported)return;
  if(v&&(P.autoOff||P.lost))return;
  P.on=!!v;if(P.glc)P.glc.style.visibility=P.on?"visible":"hidden"};
/* 60fps 감시: 게임이 플레이 중 프레임 간격을 넣어준다. 90프레임 창(비중첩)마다 판정.
   22ms 초과 > 22/90 → 강등 후보(체류 8초 지나야 실행). 22ms 초과 ≥ 5/90 → «시끄러움» 표시(승격 15초 카운트 리셋).
   0/90 이고 15초 조용·체류 8초·승격 2회 미만이면 한 단계 승격. 페이드 중엔 판정 안 함. */
var win=new Float32Array(90),wi=0,wn=0;
P.sample=function(ms){
  if(!P.auto||!P.on||P.autoOff||P.lost)return;
  win[wi]=ms;wi=(wi+1)%90;if(wn<90)wn++;
  if(wn<90)return;
  var bad=0;for(var i=0;i<90;i++)if(win[i]>22)bad++;
  wn=0;wi=0;
  var now=nowMs();
  if(bad>=5)noisyT=now;
  if(fade)return;
  if(bad>22){
    if(now-lastChangeT<P.DWELL)return;
    change(P.level>0?P.level-1:-1,"bad",bad);
    return;
  }
  if(bad===0&&P.level<P.levelMax&&P.promotions<P.MAXPROMO&&now-noisyT>=P.QUIET&&now-lastChangeT>=P.DWELL){
    P.promotions++;change(P.level+1,"quiet",bad);
  }
};
P.resetWindow=function(){wn=0;wi=0};
window.SumoPost=P;
})();
