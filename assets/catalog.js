(function(){
'use strict';
const D = window.UE_DATA;
const qEl = document.getElementById('q');
const main = document.getElementById('main');
const navEl = document.getElementById('nav');

const NAV = [
  {id:'overview',label:'概览'},
  {id:'topics',label:'技术专题'},
  {id:'solutions',label:'方案库'},
  {id:'rendering',label:'渲染知识'},
  {id:'performance',label:'性能分析'},
  {id:'gc',label:'GC / 内存'},
  {id:'problems',label:'问题库'},
  {id:'compare',label:'对比视图'},
  {id:'difficulty',label:'技术难点'},
  {id:'derivation',label:'第一性原理'},
  {id:'roadmap',label:'成长路线'},
  {id:'timeline',label:'技术演进'},
  {id:'interview',label:'面试题库'},
  {id:'audit',label:'整合审核'},
  {id:'plugins',label:'插件与模板'},
  {id:'videos',label:'视频库'},
  {id:'resources',label:'资源库'},
  {id:'sites',label:'来源站点'},
  {id:'sources',label:'来源清单'}
];
const SEC_LABEL = Object.fromEntries(NAV.map(n=>[n.id,n.label]));

/* ---------- 索引 ---------- */
const solById = Object.fromEntries(D.solutions.map(s=>[s.id,s]));
const topicById = Object.fromEntries(D.topics.map(t=>[t.id,t]));
const srcById = Object.fromEntries(D.sources.map(s=>[s.id,s]));
const vidByBv = Object.fromEntries(D.videos.map(v=>[v.bvid,v]));
const resById = Object.fromEntries(D.resources.items.map(r=>[r.id,r]));
const cmpById = Object.fromEntries(D.comparisons.map(c=>[c.id,c]));
const diffById = Object.fromEntries(D.difficulties.map(c=>[c.id,c]));
const deriveById = Object.fromEntries(D.derivations.map(c=>[c.id,c]));
const zoneById = Object.fromEntries(['rendering','performance','gc'].flatMap(k=>D.zones[k].map(z=>[z.id,{...z,_dom:k}])));
const assetCatLabel = Object.fromEntries(D.taxonomy.asset_categories.map(c=>[c.id,c.label]));
const cardBySol = Object.fromEntries((D.constraints.cards||[]).map(c=>[c.solutionId,c]));
const probById = Object.fromEntries((D.problems||[]).map(p=>[p.id,p]));
const siteById = Object.fromEntries((D.sites||[]).map(s=>[s.id,s]));
const tlNodes = D.timeline.nodes||[];
const tlNodeById = Object.fromEntries(tlNodes.map(n=>[n.id,n]));
const pluginById = Object.fromEntries((D.plugins.items||[]).map(p=>[p.id,p]));
const iqItems = (D.interview&&D.interview.items)||[];
const iqById = Object.fromEntries(iqItems.map(x=>[x.id,x]));
const iqGenreLabel = Object.fromEntries((D.taxonomy.interview_genres||[]).map(g=>[g.id,g.label]));
const iqStats = (D.interview&&D.interview.stats)||{};
const A = D.audit||{};
const auditDecisions = A.decisions||[];
const auditById = Object.fromEntries(auditDecisions.map(d=>[d.origId,d]));
const evoDomainLabel = Object.fromEntries((D.taxonomy.evolution_domains||[]).map(d=>[d,d]));
const plugCatLabel = Object.fromEntries((D.taxonomy.plugin_categories||[]).map(x=>[x.id,x.label]));
const siteTypeLabel = {官方:'官方',社区:'社区',个人:'个人',媒体:'媒体',学术:'学术',机构:'机构'};
const priceLabel = {free:'免费',paid:'付费',mixed:'免费+付费档'};

/* ---------- 工具 ---------- */
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
window.imgFail=function(img){
  const d=document.createElement('div'); d.className='ph';
  d.innerHTML='官方图加载失败，已回退占位<small>请从官方页面查看，不使用第三方截图</small>';
  img.replaceWith(d);
};
const fmtNum=n=>n>=10000?(n/10000).toFixed(1)+'万':String(n);
const fmtDur=s=>{const m=Math.floor(s/60),ss=String(s%60).padStart(2,'0');return m+':'+ss;};
function truncate(s,n){s=String(s||'');return s.length>n?s.slice(0,n)+'…':s;}

function solRef(id,label){
  const s=solById[id];
  if(s) return `<a class="ref" data-jump="solution:${id}" href="#card-${id}">${esc(label||s.name)}</a>`;
  const z=zoneById[id];
  if(z) return `<a class="ref" data-jump="zone:${id}" href="#card-${id}">${esc(label||z.name)}</a>`;
  return `<span class="ref">${esc(id)}?（未收录）</span>`;
}
function topicRef(id,label){
  const t=topicById[id];
  if(!t) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="topic:${id}" href="#card-${id}">${esc(label||t.name)}</a>`;
}
function zoneRef(id,label){
  const z=zoneById[id];
  if(!z) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="zone:${id}" href="#card-${id}">${esc(label||z.name)}</a>`;
}
function probRef(id,label){
  const p=probById[id];
  if(!p) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="problem:${id}" href="#card-${id}">${esc(label||p.title)}</a>`;
}
function tlRef(id,label){
  const n=tlNodeById[id];
  if(!n) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="timeline:${id}" href="#card-${id}">${esc(label||n.tech)}</a>`;
}
function siteRef(id,label){
  const s=siteById[id];
  if(!s) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="site:${id}" href="#card-${id}">${esc(label||s.name)}</a>`;
}
function pluginRef(id,label){
  const p=pluginById[id];
  if(!p) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="plugin:${id}" href="#card-${id}">${esc(label||p.name)}</a>`;
}
function cmpRef(id,label){
  const c=cmpById[id];
  if(!c) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="comparison:${id}" href="#card-${id}">${esc(label||c.title||c.name||c.question||id)}</a>`;
}
function iqRef(id,label){
  const x=iqById[id];
  if(!x) return `<span class="ref">${esc(id)}?</span>`;
  return `<a class="ref" data-jump="interview:${id}" href="#card-${id}">${esc(label||truncate(x.title,28))}</a>`;
}
function srcRefs(ids){
  return (ids||[]).map(id=>{
    const s=srcById[id];
    if(!s) return `<span class="ref">${esc(id)}?</span>`;
    return `<a class="ref s-${esc(s.grade)}" data-jump="source:${id}" href="#card-${id}" title="${esc(s.title)}">${esc(id)} · ${esc(s.grade)}级</a>`;
  }).join('') || '<span class="meta">无</span>';
}
function resRefs(ids){
  return (ids||[]).map(id=>{
    const r=resById[id];
    if(!r) return `<span class="ref">${esc(id)}（未收录）</span>`;
    return `<a class="ref res" data-jump="resource:${id}" href="#card-${id}">${esc(r.name)}</a>`;
  }).join('') || '<span class="meta">暂无已核验的配套条目</span>';
}
function videoRefs(bvs){
  return (bvs||[]).map(bv=>{
    const v=vidByBv[bv];
    if(!v) return `<span class="ref">${esc(bv)}（未收录）</span>`;
    return `<a class="ref video" data-jump="video:${bv}" href="#card-${bv}">${esc(truncate(v.title,26))}</a>`;
  }).join('') || '<span class="meta">暂无</span>';
}
function paramsTable(ps){
  if(!ps||!ps.length) return '<span class="meta">未列出</span>';
  return `<table class="kv"><tbody>${ps.map(p=>`<tr><td>${esc(p.k)}</td><td>${esc(p.v)}${p.note?` <span class="meta">— ${esc(p.note)}</span>`:''}</td></tr>`).join('')}</tbody></table>`;
}
function listBlock(title,items,cls){
  if(!items||!items.length) return '';
  return `<div class="block ${cls||''}"><div class="t">${esc(title)}</div><ul>${items.map(i=>`<li>${i}</li>`).join('')}</ul></div>`;
}

/* ---------- 状态与筛选 ---------- */
const state = {
  section:'overview', q:'', lastSection:'overview',
  gDomain:'all', gLevel:'all', gKind:'all',
  sol:{types:[],cats:[],eng:'all',mat:'all',rel:'all',lvl:'all'},
  zone:{cat:'all',lvl:'all',rel:'all'},
  vid:{cat:'all',lvl:'all',dur:'all',lang:'all',type:'all'},
  res:{types:[],cats:[],lic:'all'},
  src:{grade:'all',kind:'all'},
  prob:{topic:'all',type:'all',symptom:'',root:'all'},
  site:{grade:'all',status:'all',type:'all'},
  tl:{era:'all',domain:'all'},
  plug:{cat:'all',pay:'all',lic:'all',compat:'all',rec:'all'},
  iq:{genre:'all',topic:'all',diff:'all',kind:'all',verdict:'all',kw:''},
  aud:{verdict:'all',genre:'all'},
  diffType:'all'
};
function getPath(p){return p.split('.').reduce((o,k)=>o[k],state);}
function setPath(p,v){const ks=p.split('.');const o=ks.slice(0,-1).reduce((x,k)=>x[k],state);o[ks[ks.length-1]]=v;}

/* ---------- 导航 ---------- */
function renderNav(){
  navEl.innerHTML = NAV.map(n=>`<button class="navbtn ${state.section===n.id?'on':''}" data-nav="${n.id}">${n.label}</button>`).join('');
}

/* ---------- 通用筛选条 ---------- */
function chips(key,opts,selected){
  return `<div class="chips">${opts.map(o=>{
    const on = Array.isArray(selected) ? selected.includes(o.id) : selected===o.id;
    const n = o.count!==undefined?`<span class="n">${o.count}</span>`:'';
    return `<button class="chip ${on?'on':''}" data-tog="${key}" data-val="${esc(o.id)}">${esc(o.label)}${n}</button>`;
  }).join('')}</div>`;
}
function selBox(key,opts,value,label){
  return `<label class="flabel">${esc(label)}</label><select class="fsel" data-sel="${key}">${opts.map(o=>`<option value="${esc(o.id)}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`).join('')}</select>`;
}
const ALL={id:'all',label:'全部'};
function optAll(arr){return [ALL].concat(arr.map(x=>({id:x,label:x})));}

/* ---------- 专题地图 ---------- */
let mapSeq=0;
function topicLevels(){
  const memo={};
  const depsOf=t=>(t.dependencies||[]).filter(d=>topicById[d]);
  function lv(t){
    if(memo[t.id]!==undefined) return memo[t.id];
    memo[t.id]=0;
    const ps=depsOf(t);
    let m=0;
    for(const p of ps){m=Math.max(m,1+lv(topicById[p]));}
    memo[t.id]=m;
    return m;
  }
  D.topics.forEach(lv);
  return memo;
}
function topicMapSvg(){
  const lv=topicLevels();
  const cols={};
  D.topics.forEach(t=>{const l=lv[t.id];(cols[l]=cols[l]||[]).push(t);});
  const maxLv=Math.max(...Object.keys(cols).map(Number));
  const colW=250, boxW=168, boxH=46, rowH=60, padX=24, padY=36;
  let maxRows=1;
  Object.values(cols).forEach(a=>maxRows=Math.max(maxRows,a.length));
  const W=padX*2+maxLv*colW+boxW, H=padY+maxRows*rowH+16;
  const pos={};
  Object.keys(cols).forEach(l=>{
    cols[l].forEach((t,i)=>{
      pos[t.id]={x:padX+Number(l)*colW,y:padY+i*rowH};
    });
  });
  const edges=[];
  D.topics.forEach(t=>{
    (t.dependencies||[]).forEach(d=>{
      if(!pos[d]||!pos[t.id]) return;
      const a=pos[d], b=pos[t.id];
      edges.push(`<path class="tmap-edge" d="M${a.x+boxW} ${a.y+boxH/2} C${a.x+boxW+40} ${a.y+boxH/2} ${b.x-40} ${b.y+boxH/2} ${b.x} ${b.y+boxH/2}"/>`);
    });
  });
  const nodes=D.topics.map(t=>{
    const p=pos[t.id];
    const name=t.name.replace('专题','');
    return `<g class="tmap-n" data-jump="topic:${t.id}" style="cursor:pointer">
      <rect x="${p.x}" y="${p.y}" width="${boxW}" height="${boxH}" rx="7"></rect>
      <text x="${p.x+10}" y="${p.y+20}">${esc(truncate(name,13))}</text>
      <text class="lvl" x="${p.x+10}" y="${p.y+36}">第 ${Number(lv[t.id])} 层 · ${esc(t.relatedSolutions.length)} 个方案</text>
      <title>${esc(t.name)}：${esc(t.objective)}</title>
    </g>`;
  }).join('');
  return `<div class="mapwrap"><svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" role="img" aria-label="专题依赖地图">
    <text class="tmap-title" x="${padX}" y="18">专题地图：箭头表示前置依赖（点击节点跳转专题）</text>
    ${edges.join('')}${nodes}
  </svg></div>`;
}

/* ---------- 概览 ---------- */
function renderOverview(){
  const st=D.meta.stats;
  const statCard=(n,l)=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  const mainstream=D.derivations.map(d=>`<div class="block"><div class="t">${esc(d.type)} · 主流做法拼图</div><p>${esc(d.mainstream.summary)}</p><div>${srcRefs(d.mainstream.sources)}</div></div>`).join('');
  return `
  <section class="hero">
    <h2>UE 游戏技术方案情报库</h2>
    <p class="lede">按「技术专题 → 方案谱系 → 第一性原理推导 → 可对比条目」组织，覆盖 FPS / TPS / 搜打撤 / MOBA / 开放世界 / ARPG 与通用工程。每条结论标注来源等级与访问日期；查不到一手来源的结论显式标注缺口。</p>
    <div class="stats">
      ${statCard(st.types,'游戏类型')}
      ${statCard(st.solutions,'方案条目')}
      ${statCard(st.topics,'技术专题')}
      ${statCard(st.rendering+st.performance+st.gc,'渲染/性能/GC 条目')}
      ${statCard(st.problems,'问题库')}
      ${statCard(st.timelineNodes,'技术演进节点')}
      ${statCard(st.plugins,'插件/模板')}
      ${statCard(iqItems.length,'面试题')}
      ${statCard(st.sources,'来源')}
      ${statCard(st.videos,'B 站视频')}
    </div>
    <div class="meta" style="margin:2px 0 8px">对比 ${st.comparisons} 组 · 资源 ${st.resources} 项（待核实 ${st.pendingResources}） · 难点 ${st.difficulties} 条 · 站点 ${st.sites}（待核实 ${st.sitesPending}） · 约束卡 ${st.constraints}（经验条目 ${st.constraintsExperience}） · A 级来源覆盖 ${st.aCoverage}% · 插件图片待补 ${st.pluginPendingImages} · 面试题 ${st.interview}（PASS ${st.interviewPass} / MERGE ${st.interviewMerge} / REJECT ${st.interviewReject}） · 审核目录 ${st.auditDirectories} · 来源 ${st.sources} 条（A 级 ${st.sourcesByGrade.A}）</div>
    <div class="note blue">建议阅读顺序：先看「技术专题」建立知识框架 → 用「方案库」查具体方案与约束卡 → 到「问题库」按症状倒推方案 → 用「对比视图 / 技术演进」看取舍与代际 → 用「来源清单 / 来源站点」追一手资料。</div>
  </section>

  <div class="sectionhead"><h2>专题地图</h2><span class="count">依赖关系：渲染基础 → GI/性能/移动端；资源加载 → 大世界流式；网络 → GAS/反作弊/复杂移动；物理 → 网络/性能</span></div>
  ${topicMapSvg()}

  <div class="sectionhead"><h2>覆盖范围</h2><span class="count">按类型的方案数量</span></div>
  <div class="grid g4">
    ${st.solutionsByType.map(x=>`<div class="block"><div class="t">${esc(x.type)}</div><b style="font-size:20px">${x.count}</b><div class="meta">条方案（含跨类型复用）</div></div>`).join('')}
    <div class="block"><div class="t">通用 / 额外发现</div><b style="font-size:20px">${st.solutionsByType.find(x=>x.type==='通用').count}</b><div class="meta">额外发现 ${st.extraSolutions} 条</div></div>
  </div>

  <div class="sectionhead"><h2>各类型主流做法拼图</h2><span class="count">基于公开演讲 / 文档，来源可追</span></div>
  <div class="grid g2">${mainstream}</div>

  <div class="sectionhead"><h2>快速入口</h2></div>
  <div class="grid g3">
    <div class="block"><div class="t">按问题找方案</div><p>从「技术难点」进入：每个类型列出难点 → 候选方案 → 当前主流做法 → 风险。</p><a class="ref" data-jump="section:difficulty" href="#difficulty">打开技术难点</a></div>
    <div class="block"><div class="t">按取舍找方案</div><p>从「对比视图」进入：同一问题的 2–3 个候选按统一维度横向比较。</p><a class="ref" data-jump="section:compare" href="#compare">打开对比视图</a></div>
    <div class="block"><div class="t">按学习路径</div><p>从「成长路线」进入：0 入门 → 1 系统掌握 → 2 专项深入 → 3 架构与团队。</p><a class="ref" data-jump="section:roadmap" href="#roadmap">打开成长路线</a></div>
  </div>
  <div class="note">离线说明：本页数据内嵌，除 B 站视频与 UEGameRes 跳转外不依赖网络。视频卡片标注“外部链接，需联网”。</div>`;
}

/* ---------- 方案卡片 ---------- */
function constraintCard(c){
  if(!c) return '<div class="note bad">缺少约束卡（数据缺口，按 FAIL 处理）</div>';
  const exp=c.evidenceTier==='experience';
  const fm=(c.failureModes||[]).map(f=>{
    const src=f.source?` <a class="ref s-${esc((srcById[f.source]||{}).grade||'C')}" data-jump="source:${f.source}" href="#card-${f.source}">${esc(f.source)}</a>`:'';
    return `<div class="fm"><span class="k ${f.source?'src':'exp'}">${esc(f.kind||'经验归纳')}</span><span>${esc(f.note)}${src}</span></div>`;
  }).join('');
  return `<div class="ccard ${exp?'exp':''}">
    <div class="ch"><b>约束卡</b>${exp?`<span class="badge exp">经验条目（无 A 级一手来源）</span>`:'<span class="badge aplus">A 级来源覆盖</span>'}<span class="tiny">适用规模 / 硬件下限 / 失效条件 / 红线 / 成本结构</span></div>
    ${exp&&c.evidenceNote?`<div class="note bad" style="margin:4px 0 8px">${esc(c.evidenceNote)}</div>`:''}
    <table class="kv"><tbody>
      <tr><td>适用规模</td><td>${esc(c.scale.team)} · 工期：${esc(c.scale.duration)}</td></tr>
      <tr><td>硬件/平台</td><td>${esc(c.hardware)}</td></tr>
      <tr><td>引擎前提</td><td>${esc(c.enginePrereq)}</td></tr>
      <tr><td>内容产能</td><td>${esc(c.contentCapacity)}</td></tr>
      <tr><td>服务器/运维</td><td>${esc(c.serverCost)}</td></tr>
    </tbody></table>
    <h4>失效条件</h4><ul>${(c.failureConditions||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <h4>不适用红线</h4><ul>${(c.redLines||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
    <h4>失败模式</h4>${fm||'<div class="meta">未列出</div>'}
    <h4>成本结构（相对量级）</h4>
    <table class="kv"><tbody>
      <tr><td>接入</td><td>${esc(c.costStructure.integration)}</td></tr>
      <tr><td>维护</td><td>${esc(c.costStructure.maintenance)}</td></tr>
      <tr><td>迭代</td><td>${esc(c.costStructure.iteration)}</td></tr>
    </tbody></table>
    <div class="verdict"><b>结论：</b>${esc(c.verdict)}</div>
  </div>`;
}
function solCard(s){
  const res = s.resources && s.resources.length ? resRefs(s.resources) : '<span class="meta">暂无已核验的配套资源条目</span>';
  const pros = listBlock('优点',s.pros,'good');
  const cons = listBlock('代价与坑',s.cons,'bad');
  const opt = s.optimization && typeof s.optimization==='object' ? `<table class="kv"><tbody>
    <tr><td>性能</td><td>${(s.optimization.performance||[]).map(esc).join('；')||'—'}</td></tr>
    <tr><td>内存</td><td>${(s.optimization.memory||[]).map(esc).join('；')||'—'}</td></tr>
    <tr><td>包体</td><td>${(s.optimization.package||[]).map(esc).join('；')||'—'}</td></tr>
    <tr><td>迭代效率</td><td>${(s.optimization.iteration||[]).map(esc).join('；')||'—'}</td></tr>
    <tr><td>稳定性</td><td>${(s.optimization.stability||[]).map(esc).join('；')||'—'}</td></tr>
    <tr><td>什么时候不值得</td><td>${esc(s.optimization.notWorth||'—')}</td></tr>
  </tbody></table>` : '<span class="meta">未列出</span>';
  return `<article class="card sol" id="card-${s.id}">
    <div class="card-top">
      <div class="badges">
        ${s.type.map(t=>`<span class="badge type">${esc(t)}</span>`).join('')}
        <span class="badge lvl">${esc(s.level)}</span>
        <span class="badge rel-${esc(s.reliability)}">来源 ${esc(s.reliability)} 级</span>
        <span class="badge mat">${esc(s.maturity)}</span>
        ${s.constraint?.evidenceTier==='experience'?'<span class="badge exp">经验条目</span>':'<span class="badge aplus">A 级证据</span>'}
        ${s.extra?'<span class="badge extra">额外发现</span>':''}
      </div>
      <h3>${esc(s.name)}</h3>
      <p class="sum">${esc(s.summary)}</p>
      <div class="meta">${esc(s.id)} · ${esc(s.category)} · ${(s.engine||[]).map(esc).join(' / ')}</div>
    </div>
    <details>
      <summary>展开：约束卡 / 问题 / 原理 / 取舍 / 复现 / 使用 / 优化 / 验证 / 来源 / 资源</summary>
      <div class="body">
        <div class="two">
          <div class="block"><div class="t">解决的问题</div>${esc(s.problem)}</div>
          <div class="block"><div class="t">原理 / 机制</div>${esc(s.mechanism)}</div>
        </div>
        <div class="two" style="margin-top:12px">${pros}${cons}</div>
        <div class="two" style="margin-top:12px">
          ${listBlock('适用场景',s.fit,'good')}
          ${listBlock('不适用场景',s.unfit,'warn')}
        </div>
        ${constraintCard(s.constraint||cardBySol[s.id])}
        ${(s.relatedProblems||[]).length?`<h4>关联问题（问题库）</h4><div>${s.relatedProblems.map(p=>probRef(p)).join('')}</div>`:''}
        ${(s.interviewQuestions||[]).length?`<h4>关联面试题（已合并 ${s.interviewQuestions.length} 条）</h4><div>${s.interviewQuestions.slice(0,6).map(id=>iqRef(id)).join('')}</div>`:''}
        <h4>关键参数与量级</h4>
        ${paramsTable(s.params)}
        <h4>如何复现（最小可运行验证路径）</h4>
        <ol>${(s.reproduce||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
        <h4>如何使用（接入方式 / 参数 / 集成点 / 版本差异）</h4>
        <ul>${(s.usage||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <h4>可优化点</h4>
        ${opt}
        <h4>验证与度量</h4>
        <ul>${(s.verify||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        ${s.cases&&s.cases.length?`<h4>实战案例</h4><table class="kv"><tbody>${s.cases.map(c=>`<tr><td>${esc(c.who)}</td><td>${esc(c.note)} ${c.source?srcRefs([c.source]):''}</td></tr>`).join('')}</tbody></table>`:'<h4>实战案例</h4><div class="meta">未找到可直接引用的公开案例；本条依据官方文档/通用工程实践推导，不臆造案例。</div>'}
        ${s.gap?`<div class="note bad">证据缺口：${esc(s.gap)}</div>`:''}
        <h4>配套资源（UEGameRes）</h4>
        <div>${res}</div>
        <h4>来源</h4>
        <div>${srcRefs(s.sources)}</div>
        <div class="tags">${(s.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
    </details>
  </article>`;
}
function filterSolutions(){
  const f=state.sol;
  return D.solutions.filter(s=>
    (!f.types.length || s.type.some(t=>f.types.includes(t))) &&
    (!f.cats.length || f.cats.includes(s.category)) &&
    (f.eng==='all' || (s.engine||[]).includes(f.eng)) &&
    (f.mat==='all' || s.maturity===f.mat) &&
    (f.rel==='all' || s.reliability===f.rel) &&
    (f.lvl==='all' || s.level===f.lvl)
  );
}
function renderSolutions(){
  const typeOpts=D.taxonomy.types.map(t=>({id:t.id,label:t.label,count:D.solutions.filter(s=>s.type.includes(t.id)).length}));
  const catOpts=D.taxonomy.categories.map(c=>({id:c.id,label:c.label,count:D.solutions.filter(s=>s.category===c.id).length}));
  const list=filterSolutions();
  return `
  <div class="sectionhead"><h2>方案库</h2><span class="count">${list.length} / ${D.solutions.length} 条 · 每条含“如何复现 / 如何使用 / 可优化点 / 验证与度量”</span></div>
  <div class="filters">
    <div class="frow"><span class="flabel">游戏类型</span>${chips('sol.types',typeOpts,state.sol.types)}</div>
    <div class="frow"><span class="flabel">技术分类</span>${chips('sol.cats',catOpts,state.sol.cats)}</div>
    <div class="frow">
      ${selBox('sol.eng',[{id:'all',label:'全部版本'}].concat(D.taxonomy.engine_versions.map(e=>({id:e,label:e}))),state.sol.eng,'引擎版本')}
      ${selBox('sol.mat',[{id:'all',label:'全部成熟度'}].concat(D.taxonomy.maturity.map(e=>({id:e,label:e}))),state.sol.mat,'成熟度')}
      ${selBox('sol.rel',[{id:'all',label:'全部等级'}].concat(D.taxonomy.reliability.map(e=>({id:e,label:e+' 级'}))),state.sol.rel,'可靠性')}
      ${selBox('sol.lvl',[{id:'all',label:'全部难度'}].concat(D.taxonomy.levels.map(e=>({id:e,label:e}))),state.sol.lvl,'难度')}
      <button class="btn" data-reset="sol">重置</button>
    </div>
  </div>
  ${list.length?`<div class="grid g2">${list.map(solCard).join('')}</div>`:`<div class="empty">没有符合条件的方案，试试放宽筛选。</div>`}`;
}

/* ---------- 知识专区 ---------- */
const ZONE_META={
  rendering:{title:'渲染知识',desc:'从几何/光栅到 GI/阴影/后处理/上采样，再到 UE 专属 Nanite、Lumen、VSM、TSR、Substrate、RDG 与调试工具链。每条给出“解决什么问题 / 代价 / 适用场景 / 来源与评级”。',cats:D.taxonomy.rendering_subdomains},
  performance:{title:'性能分析',desc:'Unreal Insights 全通道、stat 命令族、CSV Profiler、平台工具（PIX/RenderDoc/Arm/Xcode/VTune）与预算方法论、自动化回归。',cats:D.taxonomy.performance_subdomains},
  gc:{title:'GC / 内存',desc:'UObject 标记-清除、增量 GC、GC 集群、引用语义与对象生命周期；卡顿成因、观测手段、容器分配习惯与“对象池 vs GC”取舍。',cats:D.taxonomy.gc_subdomains}
};
function zoneCard(z){
  return `<article class="card" id="card-${z.id}">
    <div class="card-top">
      <div class="badges"><span class="badge type">${esc(z.category)}</span><span class="badge lvl">${esc(z.level)}</span><span class="badge rel-${esc(z.reliability)}">来源 ${esc(z.reliability)} 级</span></div>
      <h3>${esc(z.name)}</h3>
      <p class="sum">${esc(z.summary)}</p>
      <div class="meta">${esc(z.id)} · ${(z.type||[]).map(esc).join(' / ')}</div>
    </div>
    <details>
      <summary>展开：问题 / 原理 / 代价 / 适用 / 参数 / 来源</summary>
      <div class="body">
        <div class="two">
          <div class="block"><div class="t">解决什么问题</div>${esc(z.problem)}</div>
          <div class="block"><div class="t">原理 / 机制</div>${esc(z.mechanism)}</div>
        </div>
        <div class="block bad" style="margin-top:12px"><div class="t">代价与限制</div>${esc(z.cost)}</div>
        <div class="two" style="margin-top:12px">
          ${listBlock('适用场景',z.fit,'good')}
          ${listBlock('不适用 / 慎用',z.unfit,'warn')}
        </div>
        <h4>关键参数与量级</h4>
        ${paramsTable(z.params)}
        <h4>来源</h4>
        <div>${srcRefs(z.sources)}</div>
        <div class="tags">${(z.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>
      </div>
    </details>
  </article>`;
}
function renderZone(dom){
  const meta=ZONE_META[dom];
  const all=D.zones[dom];
  const f=state.zone;
  const catOpts=meta.cats.map(c=>({id:c,label:c,count:all.filter(z=>z.category===c).length}));
  const list=all.filter(z=>
    (f.cat==='all'||z.category===f.cat) &&
    (f.lvl==='all'||z.level===f.lvl) &&
    (f.rel==='all'||z.reliability===f.rel)
  );
  return `
  <div class="sectionhead"><h2>${meta.title}</h2><span class="count">${list.length} / ${all.length} 条</span></div>
  <p class="lede">${meta.desc}</p>
  <div class="filters">
    <div class="frow"><span class="flabel">子类</span>${chips('zone.cat',[{id:'all',label:'全部'}].concat(catOpts),f.cat)}</div>
    <div class="frow">
      ${selBox('zone.lvl',[{id:'all',label:'全部难度'}].concat(D.taxonomy.levels.map(e=>({id:e,label:e}))),f.lvl,'难度')}
      ${selBox('zone.rel',[{id:'all',label:'全部等级'}].concat(D.taxonomy.reliability.map(e=>({id:e,label:e+' 级'}))),f.rel,'可靠性')}
      <button class="btn" data-reset="zone">重置</button>
    </div>
  </div>
  ${list.length?`<div class="grid g2">${list.map(zoneCard).join('')}</div>`:`<div class="empty">没有符合条件的条目。</div>`}`;
}

/* ---------- 专题 ---------- */
function topicCard(t){
  const path=(t.learningPath||[]).map(p=>`<tr><td>${esc(p.stage)}</td><td><ul style="margin:0">${(p.items||[]).map(i=>`<li>${esc(i)}</li>`).join('')}</ul></td></tr>`).join('');
  return `<article class="card" id="card-${t.id}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">专题</span>
        <span class="badge">${esc(t.id)}</span>
        <span class="badge lvl">${(t.relatedSolutions||[]).length} 个关联方案</span>
        <span class="badge">${(t.relatedVideos||[]).length} 个视频</span>
      </div>
      <h3>${esc(t.name)}</h3>
      <p class="sum">${esc(t.objective)}</p>
    </div>
    <details>
      <summary>展开：目标 / 前置 / 问题拆解 / 谱系 / 术语 / 学习路径 / 自测 / 误区 / 关联</summary>
      <div class="body">
        <div class="two">
          <div class="block"><div class="t">前置知识</div><ul>${(t.prerequisites||[]).map(x=>`<li>${esc(x)}</li>`).join('')||'<li>无</li>'}</ul></div>
          <div class="block"><div class="t">依赖专题</div>${(t.dependencies||[]).length?`<div>${t.dependencies.map(d=>topicRef(d)).join('')}</div>`:'<span class="meta">无（可作为入口专题）</span>'}</div>
        </div>
        <h4>核心问题拆解</h4>
        <ul>${(t.coreQuestions||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <h4>方案谱系（演进脉络 → 当前主流）</h4>
        <ol>${(t.lineage||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
        <h4>关键概念与术语</h4>
        <div>${(t.terms||[]).map(x=>`<span class="tag">${esc(x)}</span>`).join('')}</div>
        <h4>按阶段学习路径</h4>
        <table class="kv"><tbody>${path}</tbody></table>
        <h4>关联方案条目</h4>
        <div>${(t.relatedSolutions||[]).map(id=>solRef(id)).join('')}</div>
        <h4>关联视频</h4>
        <div>${videoRefs(t.relatedVideos)}</div>
        <h4>关联资源</h4>
        <div>${(t.relatedResources||[]).length?resRefs(t.relatedResources):'<span class="meta">暂无已核验条目</span>'}</div>
        <h4>自测问题</h4>
        <ol>${(t.selfTest||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol>
        <h4>常见误区</h4>
        <ul>${(t.pitfalls||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
      </div>
    </details>
  </article>`;
}
function renderTopics(){
  return `
  <div class="sectionhead"><h2>技术专题</h2><span class="count">${D.topics.length} 个专题 · 可系统学习的单元</span></div>
  <p class="lede">每个专题包含目标与前置、核心问题、方案谱系、术语、分阶段学习路径、关联方案与视频、自测问题与常见误区。专题之间用依赖箭头连接。</p>
  ${topicMapSvg()}
  <div class="grid g2">${D.topics.map(topicCard).join('')}</div>`;
}

/* ---------- 对比 ---------- */
function compareCard(c){
  const head=(c.dimensions||[]).map(d=>`<th>${esc(d)}</th>`).join('');
  const rows=(c.rows||[]).map(r=>{
    const s=solById[r.sol];
    return `<tr id="row-${c.id}-${r.sol}"><td>${solRef(r.sol)}<div class="meta">${esc(s?s.maturity:'')}</div></td>${(r.values||[]).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`;
  }).join('');
  return `<article class="card" id="card-${c.id}" style="margin-bottom:16px">
    <div class="card-top">
      <div class="badges">${(c.type||[]).map(t=>`<span class="badge type">${esc(t)}</span>`).join('')}<span class="badge">${esc(c.id)}</span></div>
      <h3>${esc(c.name)}</h3>
      <p class="sum">${esc(c.problem)}</p>
    </div>
    <div class="body">
      <div class="tablewrap"><table class="data cmp"><thead><tr><th>候选方案</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <div class="verdict"><b>结论：</b>${esc(c.verdict)}</div>
      <div style="margin-top:6px">${srcRefs(c.sources)}</div>
    </div>
  </article>`;
}
function renderCompare(){
  return `<div class="sectionhead"><h2>对比视图</h2><span class="count">${D.comparisons.length} 组同问题候选 · 维度统一</span></div>
  <p class="lede">同一问题至少 2–3 个候选方案，按统一维度横向比较；表格首列固定，便于宽屏阅读。</p>
  ${D.comparisons.map(compareCard).join('')}`;
}

/* ---------- 难点 ---------- */
function difficultyCard(d){
  return `<article class="card" id="card-${d.id}" style="margin-bottom:12px">
    <div class="card-top">
      <div class="badges"><span class="badge type">${esc(d.type)}</span>${d.extra?'<span class="badge extra">额外发现</span>':''}<span class="badge">${esc(d.id)}</span></div>
      <h3>${esc(d.name)}</h3>
      <p class="sum">${esc(d.description)}</p>
    </div>
    <div class="body">
      <h4>候选方案</h4>
      <div>${(d.candidates||[]).map(id=>solRef(id)).join('')}</div>
      <h4>当前主流做法</h4>
      <p>${esc(d.mainstream)}</p>
      <h4>风险</h4>
      <ul>${(d.risks||[]).map(r=>`<li>${esc(r)}</li>`).join('')}</ul>
      <h4>来源</h4><div>${srcRefs(d.sources)}</div>
    </div>
  </article>`;
}
function renderDifficulty(){
  const types=D.taxonomy.types.map(t=>t.id);
  const list=D.difficulties.filter(d=>state.diffType==='all'||d.type===state.diffType);
  const grouped=types.map(t=>({type:t,items:list.filter(d=>d.type===t)})).filter(g=>g.items.length);
  return `<div class="sectionhead"><h2>技术难点专区</h2><span class="count">${list.length} / ${D.difficulties.length} 条</span></div>
  <p class="lede">按类型列出难点 → 候选方案 → 当前主流做法 → 风险。每条都可跳到对应方案与来源。</p>
  <div class="filters"><div class="frow"><span class="flabel">游戏类型</span>${chips('diffType',[{id:'all',label:'全部'}].concat(D.taxonomy.types.map(t=>({id:t.id,label:t.label,count:D.difficulties.filter(d=>d.type===t.id).length}))),state.diffType)}</div></div>
  ${grouped.map(g=>`<div class="sectionhead"><h2>${esc(g.type)}</h2><span class="count">${g.items.length} 条</span></div>${g.items.map(difficultyCard).join('')}`).join('')||'<div class="empty">没有符合条件的难点。</div>'}`;
}

/* ---------- 推导 ---------- */
function deriveCard(d){
  const cons=(d.constraints||[]).map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.value)}</td><td>${esc(c.note||'')}</td></tr>`).join('');
  const vars=(d.variables||[]).map(v=>`<tr><td>${esc(v.name)}</td><td>${esc(v.tradeoff)}</td></tr>`).join('');
  const chain=(d.chain||[]).map(c=>`<div class="row"><div>${esc(c.from)}</div><div class="arrow">→</div><div>${esc(c.to)}</div><div class="need">需求：${esc(c.need)}</div></div>`).join('');
  const rollback=Array.isArray(d.rollback)
    ? `<ul>${d.rollback.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p>${esc(d.rollback||'—')}</p>`;
  return `<article class="card" id="card-${d.id}" style="margin-bottom:16px">
    <div class="card-top"><div class="badges"><span class="badge type">${esc(d.type)}</span><span class="badge">${esc(d.id)}</span></div>
      <h3>${esc(d.type)} 的第一性原理推导</h3><p class="sum"><b>目标函数：</b>${esc(d.goal)}</p></div>
    <div class="body">
      <h4>硬约束</h4><table class="kv"><thead><tr><th>约束</th><th>量级/取值</th><th>说明</th></tr></thead><tbody>${cons}</tbody></table>
      <h4>可变量与代价</h4><table class="kv"><tbody>${vars}</tbody></table>
      <h4>推导链（约束 → 技术需求 → 方案）</h4><div class="dchain">${chain}</div>
      <h4>回退方案</h4>${rollback}
      <h4>主流工作室做法拼图</h4>
      <p>${esc(d.mainstream.summary)}</p>
      <table class="kv"><tbody>${(d.mainstream.cases||[]).map(c=>`<tr><td>${esc(c.who)}</td><td>${esc(c.note)} ${c.source?srcRefs([c.source]):''}</td></tr>`).join('')}</tbody></table>
      <div style="margin-top:6px">${srcRefs(d.mainstream.sources)}</div>
      ${(d.gaps||[]).length?`<div class="note bad"><b>已知缺口：</b>${(d.gaps||[]).map(esc).join('；')}</div>`:''}
    </div>
  </article>`;
}
function renderDerivation(){
  return `<div class="sectionhead"><h2>第一性原理推导</h2><span class="count">${D.derivations.length} 个类型</span></div>
  <p class="lede">先写目标函数与硬约束，再推导技术需求，最后映射到具体 UE 方案。推导链显式列出，不用“结论堆链接”替代。</p>
  ${D.derivations.map(deriveCard).join('')}`;
}

/* ---------- 成长路线 ---------- */
const STAGE_TL={
  'stage-0':['tl-blueprint','tl-lightmap','tl-staticlod'],
  'stage-1':['tl-taa','tl-csm','tl-levelstreaming','tl-sequencer','tl-soundcue'],
  'stage-2':['tl-nanite','tl-lumen','tl-vsm','tl-tsr','tl-chaos','tl-iris'],
  'stage-3':['tl-worldpartition','tl-datalayers','tl-substrate','tl-pcg','tl-motionmatching','tl-mover']
};
const STAGE_PLUG={
  'stage-0':['plug-lyra','plug-action-rpg','plug-enhanced-input','plug-python-editor'],
  'stage-1':['plug-gas','plug-common-ui','plug-iris','plug-replication-graph'],
  'stage-2':['plug-niagara','plug-chaos','plug-control-rig','plug-pcg','plug-renderdoc'],
  'stage-3':['plug-wwise','plug-houdini-engine','plug-substance','plug-massai']
};
function renderRoadmap(){
  const stages=D.roadmap.stages.map((st,i)=>{
    const req=(st.required||[]).map(r=>`<tr><td>${esc(r.title)}</td><td><span class="badge ${r.basis==='公开资料支撑'?'rel-A':'extra'}">${esc(r.basis)}</span></td><td>${srcRefs(r.sources)}</td></tr>`).join('');
    return `<article class="card stage" id="card-${st.id}" style="margin-bottom:16px">
      <div class="stagewrap">
        <div class="no">${i}</div>
        <div class="card-top">
          <div class="badges"><span class="badge type">${esc(st.name)}</span><span class="badge lvl">${esc(st.duration)}</span></div>
          <h3>${esc(st.name)}</h3><p class="sum">${esc(st.goal)}</p>
        </div>
        <div class="body">
          <h4>必读资料</h4><table class="kv"><thead><tr><th>资料</th><th>依据类型</th><th>来源</th></tr></thead><tbody>${req}</tbody></table>
          <h4>必做小项目</h4><ul>${(st.projects||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>
          <h4>验收标准</h4><ul>${(st.acceptance||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>
          <h4>交叉引用</h4>
          <div>${(st.crossRefs.topics||[]).map(id=>topicRef(id)).join('')}${(st.crossRefs.solutions||[]).map(id=>solRef(id)).join('')}${videoRefs(st.crossRefs.videos)}</div>
          <h4>该阶段对应哪个版本引入的技术</h4>
          <div>${(STAGE_TL[st.id]||[]).map(id=>tlRef(id)).join('')||'<span class="meta">本阶段以通用基础为主，暂无版本型技术节点。</span>'}</div>
          <h4>该阶段适合接触的插件/示例</h4>
          <div>${(STAGE_PLUG[st.id]||[]).map(id=>pluginRef(id)).join('')} <a class="ref" data-jump="section:plugins" href="#plugins">打开插件与模板库</a></div>
        </div>
      </div>
    </article>`;
  }).join('');
  const dirs=D.roadmap.directions.map(d=>`<div class="card" id="card-${d.id}">
    <div class="card-top"><div class="badges"><span class="badge type">方向</span><span class="badge">${esc(d.id)}</span></div>
    <h3>${esc(d.name)}</h3><p class="sum">适合：${esc(d.forWhom)}</p></div>
    <div class="body"><h4>路线</h4><ol>${(d.path||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ol>
    <h4>交叉引用</h4><div>${(d.crossRefs.topics||[]).map(id=>topicRef(id)).join('')}${(d.crossRefs.solutions||[]).map(id=>solRef(id)).join('')}</div></div>
  </div>`).join('');
  return `<div class="sectionhead"><h2>学习成长路线</h2><span class="count">${D.roadmap.stages.length} 个阶段 · ${D.roadmap.directions.length} 个方向</span></div>
  <div class="note">${D.roadmap.notes.map(esc).join(' ')}</div>
  ${stages}
  <div class="sectionhead"><h2>分方向可选路线</h2></div>
  <div class="grid g2">${dirs}</div>`;
}

/* ---------- 视频 ---------- */
function durBucket(s){return s<1800?'short':(s<3600?'mid':'long');}
const DUR_LABEL={short:'<30 分钟',mid:'30–60 分钟',long:'>60 分钟'};
function videoCard(v){
  const cat=D.taxonomy.types;
  return `<article class="card vcard" id="card-${v.bvid}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">${esc(v.category)}</span>
        <span class="badge lvl">${esc(v.level)}</span>
        <span class="badge ${v.type==='官方'?'rel-A':''}">${esc(v.type)}</span>
        <span class="badge">${esc(v.language)}</span>
      </div>
      <a class="vt" href="https://www.bilibili.com/video/${v.bvid}" target="_blank" rel="noopener">${esc(v.title)}</a>
      <div class="vmeta"><span>UP：${esc(v.up)}</span><span>${esc(v.bvid)}</span><span>${fmtDur(v.duration)}</span><span>${esc(v.pubdate)}</span></div>
      <div class="vmeta"><span>播放 ${fmtNum(v.views)}</span><span>核验：${esc(v.check.date)} · ${esc(v.check.status)}</span>${v.topic&&topicById[v.topic]?topicRef(v.topic):''}</div>
    </div>
    <div class="body">
      <p class="rnote">${esc(v.summary)}</p>
      <ul class="vpts">${(v.points||[]).map(p=>`<li>${esc(p)}</li>`).join('')}</ul>
      <div style="margin-top:8px"><a class="ref video" href="https://www.bilibili.com/video/${v.bvid}" target="_blank" rel="noopener">B 站打开</a><span class="ext">外部链接，需联网</span></div>
      <div class="meta" style="margin-top:4px">可靠性：${esc(v.reliability)} · 类型：${esc(v.type)} · 已用 view API 核对 BV 与标题/UP</div>
    </div>
  </article>`;
}
function renderVideos(){
  const f=state.vid;
  const cats=[...new Set(D.videos.map(v=>v.category))];
  const list=D.videos.filter(v=>
    (f.cat==='all'||v.category===f.cat) &&
    (f.lvl==='all'||v.level===f.lvl) &&
    (f.dur==='all'||durBucket(v.duration)===f.dur) &&
    (f.lang==='all'||v.language===f.lang) &&
    (f.type==='all'||v.type===f.type)
  );
  return `<div class="sectionhead"><h2>B 站视频库</h2><span class="count">${list.length} / ${D.videos.length} 条 · 全部经 view API 核对</span></div>
  <div class="note">视频为外部链接，需联网。列表内 BV 号与标题/UP 主已通过 bilibili view API 逐条核验（2026-11-04）；无法核验的视频不进入本条清单。</div>
  <div class="filters">
    <div class="frow"><span class="flabel">分类</span>${chips('vid.cat',[{id:'all',label:'全部'}].concat(cats.map(c=>({id:c,label:c,count:D.videos.filter(v=>v.category===c).length}))),f.cat)}</div>
    <div class="frow">
      ${selBox('vid.lvl',[{id:'all',label:'全部难度'}].concat(D.taxonomy.levels.map(e=>({id:e,label:e}))),f.lvl,'难度')}
      ${selBox('vid.dur',[{id:'all',label:'全部时长'}].concat(Object.keys(DUR_LABEL).map(k=>({id:k,label:DUR_LABEL[k]}))),f.dur,'时长')}
      ${selBox('vid.lang',[{id:'all',label:'全部语言'}].concat([...new Set(D.videos.map(v=>v.language))].map(l=>({id:l,label:l}))),f.lang,'语言')}
      ${selBox('vid.type',[{id:'all',label:'全部来源'}].concat(['官方','个人教程','搬运'].map(l=>({id:l,label:l}))),f.type,'官方/个人')}
      <button class="btn" data-reset="vid">重置</button>
    </div>
  </div>
  ${list.length?`<div class="grid g2">${list.map(videoCard).join('')}</div>`:'<div class="empty">没有符合条件的视频。</div>'}`;
}

/* ---------- 资源库 ---------- */
function licenseBadgeClass(lc){
  if(lc.indexOf('UE 限定')>=0) return 'license-UE';
  if(lc.indexOf('署名')>=0) return 'license-attr';
  return 'license-free';
}
function openLink(id){
  const base='file:///C:/Users/ASUS/Project/UEGameRes/index.html';
  return base+'#item-'+encodeURIComponent(id);
}
function resItemCard(it){
  const sup=(it.supports||[]).map(id=>solRef(id)).join('');
  return `<article class="card" id="card-${it.id}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">${esc(assetCatLabel[it.category]||it.category)}</span>
        <span class="badge lic">${esc(it.licenseClass)}</span>
        <span class="badge">${it.priceType==='free'?'免费':'付费/需确认'}</span>
        ${it.forTypes.map(t=>`<span class="badge">${esc(t)}</span>`).join('')}
      </div>
      <div class="rname">${esc(it.name)}</div>
      <div class="meta">${esc(it.id)} · ${esc(it.subcategory||'')} · 授权：${esc(it.license)}</div>
    </div>
    <div class="body">
      <p class="rnote">${esc(it.note)}</p>
      <div style="margin:6px 0"><b style="font-size:11px;color:var(--dim2)">支撑的技术方案：</b>${sup||'<span class="meta">未标注</span>'}</div>
      <div><a class="ref res" href="${openLink(it.id)}" target="_blank" rel="noopener">在 UEGameRes 打开该条目</a> <a class="ref" href="${esc(it.obtain)}" target="_blank" rel="noopener">原始获取页</a><span class="ext">外部链接，需联网</span></div>
    </div>
  </article>`;
}
function renderResources(){
  const f=state.res;
  const items=D.resources.items;
  const types=[...new Set(items.flatMap(i=>i.forTypes))];
  const licClasses=[...new Set(items.map(i=>i.licenseClass))];
  const list=items.filter(i=>
    (!f.types.length||i.forTypes.some(t=>f.types.includes(t))) &&
    (!f.cats.length||f.cats.includes(i.category)) &&
    (f.lic==='all'||i.licenseClass===f.lic)
  );
  const needs=D.resources.typeNeeds.map(tn=>`<div class="card" style="margin-bottom:12px">
    <div class="card-top"><div class="badges"><span class="badge type">${esc(tn.type)}</span><span class="badge">${tn.needs.length} 类内容需求</span></div><h3>${esc(tn.type)}：典型内容需求 → 可复用条目</h3></div>
    <div class="body">${tn.needs.map(n=>`<div class="block" style="margin-bottom:8px"><div class="t">${esc(n.need)} · ${esc(assetCatLabel[n.category]||n.category)}</div><div>${resRefs(n.itemIds)}</div></div>`).join('')}
    ${tn.gap?`<div class="note bad" style="margin-top:10px">覆盖缺口：${esc(tn.gap)}</div>`:''}</div>
  </div>`).join('');
  const gaps=D.resources.gapReport.map(g=>`<tr><td><span class="badge ${g.priority==='P0'?'rel-C':'rel-B'}">${esc(g.priority)}</span></td><td>${esc(g.area)}</td><td>${esc(g.suggestion)}</td><td>${esc(g.reason)}</td></tr>`).join('');
  const pending=D.resources.pending.map(p=>`<tr><td>${esc(p.id)}</td><td>${esc(p.name)}</td><td>${esc(p.license)}</td><td>${esc(p.reason)}</td></tr>`).join('');
  return `<div class="sectionhead"><h2>资源库（对接 UEGameRes）</h2><span class="count">${list.length} / ${items.length} 条可复用资产 · ${D.resources.pending.length} 条待核实</span></div>
  <div class="note blue"><b>打开方式：</b><ul>${D.resources.meta.openGuide.map(g=>`<li>${esc(g)}</li>`).join('')}</ul></div>
  <div class="note"><b>授权规则：</b>${esc(D.resources.meta.licensePolicy)}</div>
  <div class="block" style="margin:10px 0"><div class="t">本地参考来源（UEGameRes，只读引用）</div>${srcRefs(D.resources.meta.localSources)}</div>
  <div class="sectionhead"><h2>按游戏类型的资源推荐</h2><span class="count">需求 ←→ UEGameRes 条目（双向可跳转）</span></div>
  ${needs}
  <div class="sectionhead"><h2>全部推荐条目</h2><span class="count">仅收录授权明确且免费的资源</span></div>
  <div class="filters">
    <div class="frow"><span class="flabel">游戏类型</span>${chips('res.types',types.map(t=>({id:t,label:t,count:items.filter(i=>i.forTypes.includes(t)).length})),f.types)}</div>
    <div class="frow"><span class="flabel">资产类别</span>${chips('res.cats',D.taxonomy.asset_categories.map(c=>({id:c.id,label:c.label,count:items.filter(i=>i.category===c.id).length})),f.cats)}</div>
    <div class="frow">
      ${selBox('res.lic',[{id:'all',label:'全部授权'}].concat(licClasses.map(l=>({id:l,label:l}))),f.lic,'授权')}
      <button class="btn" data-reset="res">重置</button>
    </div>
  </div>
  ${list.length?`<div class="grid g2">${list.map(resItemCard).join('')}</div>`:'<div class="empty">没有符合条件的资源。</div>'}
  <div class="sectionhead"><h2>资源缺口报告</h2><span class="count">仅给建议，不执行采集</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>优先级</th><th>缺口领域</th><th>建议补充方向</th><th>原因</th></tr></thead><tbody>${gaps}</tbody></table></div>
  <div class="sectionhead"><h2>待核实资源</h2><span class="count">授权未获取/不明确，不进入推荐位</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>ID</th><th>名称</th><th>授权状态</th><th>原因</th></tr></thead><tbody>${pending}</tbody></table></div>`;
}

/* ---------- 来源 ---------- */
function renderSources(){
  const f=state.src;
  const list=D.sources.filter(s=>
    (f.grade==='all'||s.grade===f.grade) &&
    (f.kind==='all'||s.kind===f.kind)
  );
  const kinds=[...new Set(D.sources.map(s=>s.kind))];
  return `<div class="sectionhead"><h2>来源清单</h2><span class="count">${list.length} / ${D.sources.length} 条 · A ${D.meta.stats.sourcesByGrade.A} / B ${D.meta.stats.sourcesByGrade.B} / C ${D.meta.stats.sourcesByGrade.C}</span></div>
  <p class="lede">A：Epic 官方文档 / 演讲 / 源码与发布说明；B：论文、大厂工程博客、经典书籍；C：二手解读（仅作线索）。每条标注访问日期与链接核验状态。</p>
  <div class="filters">
    <div class="frow"><span class="flabel">等级</span>${chips('src.grade',[{id:'all',label:'全部'},{id:'A',label:'A 级'},{id:'B',label:'B 级'},{id:'C',label:'C 级'}],f.grade)}</div>
    <div class="frow">${selBox('src.kind',[{id:'all',label:'全部类型'}].concat(kinds.map(k=>({id:k,label:k}))),f.kind,'来源类型')}</div>
  </div>
  <div class="tablewrap"><table class="data"><thead><tr><th>ID</th><th>标题</th><th>发布方</th><th>类型</th><th>等级</th><th>访问日期</th><th>链接状态</th></tr></thead><tbody>
  ${list.map(s=>`<tr id="card-${s.id}"><td>${esc(s.id)}</td><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a><div class="meta">${esc(truncate(s.url,90))}</div></td><td>${esc(s.publisher||'')}</td><td>${esc(s.kind)}</td><td><span class="badge rel-${esc(s.grade)}">${esc(s.grade)}</span></td><td>${esc(s.accessed)}</td><td>${esc(s.link_status||'')}<div class="meta">引用 ${s.refCount} 次</div></td></tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- 问题库 ---------- */
function problemCard(p){
  const t=topicById[p.topic];
  const cand=(p.candidates||[]).map(c=>`<div class="pcand"><div>${solRef(c.sol)}</div><div class="tr">取舍：${esc(c.tradeoff)}</div></div>`).join('');
  return `<article class="card pcard" id="card-${p.id}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">${esc(t?t.name:p.topic)}</span>
        ${(p.types||[]).map(x=>`<span class="badge">${esc(x)}</span>`).join('')}
        <span class="badge lvl">${esc(p.rootCauseClass)}</span>
        <span class="badge">${(p.candidates||[]).length} 个候选</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <p class="sum stmt">${esc(p.statement)}</p>
      <div class="meta">${esc(p.id)} · 根因分类：${esc(p.rootCauseClass)}</div>
    </div>
    <details>
      <summary>展开：场景 / 症状 / 根因 / 候选方案（含取舍）/ 判断依据 / 验证方法 / 来源</summary>
      <div class="body">
        <div class="two">
          <div class="block"><div class="t">出现场景</div>${esc(p.scene)}</div>
          <div class="block warn"><div class="t">可观测症状</div><ul>${(p.symptoms||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        </div>
        <div class="block bad" style="margin-top:12px"><div class="t">根因（${esc(p.rootCauseClass)}）</div>${esc(p.rootCause)}</div>
        <h4>候选方案（含取舍）</h4>${cand||'<div class="meta">未列出</div>'}
        <h4>判断依据</h4><p>${esc(p.judgment)}</p>
        <h4>验证方法</h4><ul>${(p.verification||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>
        <h4>来源</h4><div>${srcRefs(p.sources)}</div>
        ${(p.interviewQuestions||[]).length?`<h4>关联面试题</h4><div>${p.interviewQuestions.slice(0,6).map(id=>iqRef(id)).join('')}</div>`:''}
      </div>
    </details>
  </article>`;
}
function renderProblems(){
  const f=state.prob;
  const q=(f.symptom||'').toLowerCase();
  const roots=[...new Set(D.problems.map(p=>p.rootCauseClass))].sort();
  const list=D.problems.filter(p=>
    (f.topic==='all'||p.topic===f.topic) &&
    (f.type==='all'||(p.types||[]).includes(f.type)) &&
    (f.root==='all'||p.rootCauseClass===f.root) &&
    (!q || (p.symptoms||[]).join(' ').toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
  );
  return `<div class="sectionhead"><h2>问题库</h2><span class="count">${list.length} / ${D.problems.length} 条 · 18 个专题各 5 条</span></div>
  <p class="lede">从“真实可观测症状”倒推根因与候选方案。每条问题至少 2 个候选并写明取舍；问题与方案卡片双向跳转。</p>
  <div class="filters">
    <div class="frow"><span class="flabel">专题</span>${chips('prob.topic',[{id:'all',label:'全部'}].concat(D.topics.map(t=>({id:t.id,label:t.name.replace('专题',''),count:D.problems.filter(p=>p.topic===t.id).length}))),f.topic)}</div>
    <div class="frow"><span class="flabel">游戏类型</span>${chips('prob.type',[{id:'all',label:'全部'}].concat(D.taxonomy.types.map(t=>({id:t.id,label:t.label,count:D.problems.filter(p=>(p.types||[]).includes(t.id)).length}))),f.type)}</div>
    <div class="frow">
      ${selBox('prob.root',[{id:'all',label:'全部根因'}].concat(roots.map(r=>({id:r,label:r}))) ,f.root,'根因分类')}
      <label class="flabel">症状关键词</label><input class="fsel" style="min-width:190px" data-inp="prob.symptom" value="${esc(f.symptom)}" placeholder="如 卡顿 / 带宽 / 接缝 / 漂移">
      <button class="btn" data-reset="prob">重置</button>
    </div>
  </div>
  ${list.length?`<div class="grid g2">${list.map(problemCard).join('')}</div>`:'<div class="empty">没有符合条件的问题，试试放宽筛选或清空症状关键词。</div>'}`;
}

/* ---------- 来源站点 ---------- */
function siteCard(s){
  const st=s.check?.status==='verified';
  return `<article class="card sitecard" id="card-${s.id}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">${esc(s.type)}</span>
        <span class="badge rel-${esc(s.grade)}">${esc(s.grade)} 级</span>
        <span class="badge ${st?'aplus':'exp'}">${st?'已验证':'待核实'}</span>
        <span class="badge">${esc(s.lang)}</span>
        <span class="badge">引用 ${s.refCount||0} 次</span>
      </div>
      <h3>${esc(s.name)}</h3>
      <div class="url"><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.url)}</a></div>
    </div>
    <div class="body">
      <p class="rnote">${esc(s.contents)}</p>
      <table class="kv"><tbody>
        <tr><td>作者/组织</td><td>${esc(s.org)}</td></tr>
        <tr><td>活跃度</td><td>${esc(s.activity)}</td></tr>
        <tr><td>核验</td><td>${esc(s.check.date)} · ${esc(s.check.status)}<div class="tiny">${esc(s.check.note)}</div></td></tr>
        <tr><td>本库引用</td><td>来源条目 ${s.sourceCount||0} 条 · 被引用 ${s.refCount||0} 次</td></tr>
      </tbody></table>
    </div>
  </article>`;
}
function renderSites(){
  const f=state.site;
  const list=D.sites.filter(s=>
    (f.grade==='all'||s.grade===f.grade) &&
    (f.status==='all'||s.check.status===f.status) &&
    (f.type==='all'||s.type===f.type)
  );
  const verified=list.filter(s=>s.check.status==='verified');
  const pending=list.filter(s=>s.check.status!=='verified');
  return `<div class="sectionhead"><h2>来源站点目录</h2><span class="count">${D.sites.length} 个站点 · 已验证 ${D.sites.filter(s=>s.check.status==='verified').length} · 待核实 ${D.sites.filter(s=>s.check.status!=='verified').length}</span></div>
  <p class="lede">逐站核验可访问性与 URL/名称一致性；打不开或需登录的放入“待核实”，不硬塞进已验证列表。引用次数由构建脚本按域名统计，不手工填写。</p>
  <div class="filters">
    <div class="frow"><span class="flabel">等级</span>${chips('site.grade',[{id:'all',label:'全部'},{id:'A',label:'A 级'},{id:'B',label:'B 级'},{id:'C',label:'C 级'}],f.grade)}</div>
    <div class="frow">
      ${selBox('site.status',[{id:'all',label:'全部状态'},{id:'verified',label:'已验证'},{id:'pending',label:'待核实'}],f.status,'核验状态')}
      ${selBox('site.type',[{id:'all',label:'全部类型'}].concat([...new Set(D.sites.map(s=>s.type))].map(t=>({id:t,label:t}))),f.type,'站点类型')}
      <button class="btn" data-reset="site">重置</button>
    </div>
  </div>
  <div class="sectionhead"><h2>已验证站点</h2><span class="count">${verified.length} 个</span></div>
  ${verified.length?`<div class="grid g2">${verified.map(siteCard).join('')}</div>`:'<div class="empty">没有符合条件的已验证站点。</div>'}
  <div class="sectionhead"><h2>待核实</h2><span class="count">${pending.length} 个 · 明确标注原因，不默认可信</span></div>
  ${pending.length?`<div class="grid g2">${pending.map(siteCard).join('')}</div>`:'<div class="empty">当前筛选下没有待核实站点。</div>'}`;
}

/* ---------- 技术演进 ---------- */
function tlNodeCard(n){
  const era=(D.timeline.eras||[]).find(e=>e.id===n.era);
  const relCmp=D.comparisons.filter(c=>(c.candidates||[]).some(id=>(n.links?.solutions||[]).includes(id))).map(c=>cmpRef(c.id));
  return `<article class="card" id="card-${n.id}">
    <div class="card-top">
      <div class="badges">
        <span class="badge type">${esc(n.domain)}</span>
        <span class="badge lvl">${esc(n.year)}</span>
        <span class="badge">${esc(n.version)}</span>
        ${era?`<span class="badge">${esc(era.label)}</span>`:''}
      </div>
      <h3>${esc(n.tech)}</h3>
      <p class="sum">${esc(n.oneLiner)}</p>
      <div class="meta">${esc(n.id)}</div>
    </div>
    <details>
      <summary>展开四段：解决的问题 / 上一代痛点 / 引入的新约束 / 后续演进</summary>
      <div class="body">
        <div class="block"><div class="t">它解决的问题</div>${esc(n.problem)}</div>
        <div class="two" style="margin-top:12px">
          ${listBlock('上一代技术的痛点',n.previousPains,'warn')}
          ${listBlock('引入的新约束',n.newConstraints,'bad')}
        </div>
        <div class="block" style="margin-top:12px"><div class="t">后续演进 / 被谁取代</div><ul>${(n.successors||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>
        ${n.note?`<div class="note">${esc(n.note)}</div>`:''}
        ${(n.links?.solutions||[]).length?`<h4>关联方案</h4><div>${n.links.solutions.map(id=>solRef(id)).join('')}</div>`:''}
        ${(n.links?.topics||[]).length?`<h4>关联专题</h4><div>${n.links.topics.map(id=>topicRef(id)).join('')}</div>`:''}
        ${relCmp.length?`<h4>关联对比组</h4><div>${relCmp.join('')}</div>`:''}
        <h4>来源</h4><div>${srcRefs(n.sources)}</div>
      </div>
    </details>
  </article>`;
}
function renderTimeline(){
  const f=state.tl;
  const list=tlNodes.filter(n=>(f.era==='all'||n.era===f.era)&&(f.domain==='all'||n.domain===f.domain));
  const eras=(D.timeline.eras||[]);
  const domains=[...new Set(tlNodes.map(n=>n.domain))];
  const rail=list.map(n=>`<div class="tlnode" data-jump="timeline:${n.id}">
      <div class="yr">${esc(n.year)}</div>
      <div class="dom">${esc(n.domain)}</div>
      <div class="tech">${esc(n.tech)}</div>
      <div class="ver">${esc(n.version)}</div>
    </div>`).join('');
  const cols=D.timeline.matrix.versions.map(v=>`<th>${esc(v.label||v.id)}</th>`).join('');
  const matrixRows=D.timeline.matrix.rows.map(r=>`<tr><td>${esc(r.tech)}<div class="tiny">${esc(r.domain)} · ${esc(r.note||'')}</div></td>${D.timeline.matrix.versions.map(v=>{
    const c=(r.cells||{})[v.id];
    return `<td class="c">${c?`<span class="st ${esc(c.status)}">${esc(c.status)}</span><div class="tiny">${esc(c.note)}</div>`:'<span class="meta">—</span>'}</td>`;
  }).join('')}</tr>`).join('');
  const genRows=D.timeline.generations.map(g=>`<tr><td>${esc(g.question)}</td><td>${esc(g.old.name)}<div class="tiny">${srcRefs([g.old.source])}</div></td><td>${esc(g.new.name)}<div class="tiny">${srcRefs([g.new.source])}</div></td>${(g.values||[]).map(v=>`<td>${esc(v)}</td>`).join('')}</tr>`).join('');
  return `<div class="sectionhead"><h2>UE 技术演进</h2><span class="count">${list.length} / ${tlNodes.length} 个节点 · ${D.timeline.generations.length} 组代际对比</span></div>
  <p class="lede">按“什么时间出现什么技术 → 它替谁解决什么问题 → 上一代为什么不够 → 新技术自己带来什么约束”组织。年份与版本逐条给来源；无法精确到版本写“约”并在卡片注明依据。</p>
  <div class="note">${esc(D.timeline.note||'')}</div>
  <div class="filters">
    <div class="frow"><span class="flabel">年代</span>${chips('tl.era',[{id:'all',label:'全部'}].concat(eras.map(e=>({id:e.id,label:e.label+'（'+e.range+'）',count:tlNodes.filter(n=>n.era===e.id).length}))),f.era)}</div>
    <div class="frow"><span class="flabel">领域</span>${chips('tl.domain',[{id:'all',label:'全部'}].concat(domains.map(d=>({id:d,label:d,count:tlNodes.filter(n=>n.domain===d).length}))),f.domain)}</div>
  </div>
  <div class="tlscroll"><div class="tlrail">${rail||'<div class="empty">当前筛选下没有节点。</div>'}</div></div>
  <div class="grid g2">${list.map(tlNodeCard).join('')}</div>
  <div class="sectionhead"><h2>版本—能力矩阵</h2><span class="count">可用 / 实验 / Beta / 转正 / 弃用 / 不适用</span></div>
  <p class="lede">用于选型：先看状态，再看备注里的规模建议。5.4 之后的能力以官方 release notes/博客为准，未能逐条核实的状态保守标注。</p>
  <div class="tablewrap"><table class="data matrix"><thead><tr><th>技术</th>${cols}</tr></thead><tbody>${matrixRows}</tbody></table></div>
  <div class="sectionhead"><h2>代际对比</h2><span class="count">同一问题的旧方案 vs 新方案</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>问题</th><th>旧方案</th><th>新方案</th>${(D.timeline.generations[0]?.dimensions||[]).map(d=>`<th>${esc(d)}</th>`).join('')}</tr></thead><tbody>${genRows}</tbody></table></div>
  <h4>与本时间轴节点相关的对比组</h4>
  <div>${D.comparisons.filter(c=>(c.candidates||[]).some(id=>tlNodes.some(n=>(n.links?.solutions||[]).includes(id)))).map(c=>cmpRef(c.id)).join('')||'<span class="meta">无</span>'}</div>`;
}

/* ---------- 插件与模板库 ---------- */
const PLUGIN_TOPIC={online:['topic-net','topic-anticheat'],water:['topic-render-basics','topic-gi'],weather:['topic-render-basics','topic-gi'],render:['topic-render-basics','topic-gi','topic-shader-pso'],physics:['topic-physics'],animation:['topic-animation'],ai:['topic-ai-nav'],audio:[],tool:['topic-engineering','topic-asset'],editor:['topic-engineering'],platform:['topic-engineering'],template:['topic-engineering']};
function compatFamily(c){
  if(/UE5\.2|UE5\.3/.test(c)) return 'UE5.2+';
  if(/UE4/.test(c)&&/UE5/.test(c)) return 'UE4/UE5';
  if(/DCC|Visual Studio/.test(c)) return '外部工具/DCC';
  return 'UE5';
}
function pluginCard(p){
  const imgOk=p.image && (/^https?:/.test(p.image)||/\.(jpg|jpeg|png|webp|gif)$/i.test(p.image));
  const thumb=imgOk?`<img src="${esc(p.image && p.image.indexOf('research/')===0 ? '../'+p.image : p.image)}" alt="${esc(p.name)}" loading="lazy" onerror="imgFail(this)">`
    :`<div class="ph">官方图待补<small>${esc(p.imageNote||'未缓存官方商店图；请从官方页面查看，避免伪造截图')}</small></div>`;
  const topics=(PLUGIN_TOPIC[p.category]||[]).filter(id=>topicById[id]);
  return `<article class="pc" id="card-${p.id}">
    <div class="pthumb">${thumb}</div>
    <div class="pbody">
      <div class="badges">
        <span class="badge type">${esc(plugCatLabel[p.category]||p.category)}</span>
        <span class="badge ${p.priceType==='free'?'aplus':''}">${esc(priceLabel[p.priceType]||p.priceType)}</span>
        <span class="badge lic">${esc(p.license)}</span>
        <span class="badge ${p.recommend==='优先评估'?'aplus':(p.recommend==='谨慎使用'||p.recommend==='待核实'?'exp':'')}">${esc(p.recommend)}</span>
      </div>
      <h3>${esc(p.name)}</h3>
      <p class="purpose">${esc(p.purpose)}</p>
      <div class="prow"><b>价格/授权：</b>${esc(p.price)}（${esc(p.license)}）<div class="tiny">查询日期 ${esc(p.priceChecked)}</div></div>
      <div class="prow"><b>兼容：</b>${esc(p.compat)}</div>
      <div class="pfoot">
        <a class="ref" href="${esc(p.url)}" target="_blank" rel="noopener">官方页面</a>
        ${topics.map(id=>topicRef(id)).join('')}
      </div>
    </div>
    <details><summary>展开：替代方案 / 风险 / 结论 / 图片来源 / 来源</summary>
      <div class="body">
        <div class="block good"><div class="t">替代方案与“什么时候不需要”</div>${esc(p.alternatives)}</div>
        <div class="block bad" style="margin-top:10px"><div class="t">风险</div>${esc(p.risks)}</div>
        <div class="verdict"><b>结论：</b>${esc(p.verdict)}</div>
        <div class="tiny" style="margin-top:8px">图片：${imgOk?`来源 <a href="${esc(p.imageSource||p.url)}" target="_blank" rel="noopener">${esc(p.imageSource||p.url)}</a> · 抓取 ${esc(p.imageFetchedAt||'日期未记录')} · 版权归原作者，仅作索引用途。`:'官方图待补（不使用非官方截图，不以合成图替代）。'}</div>
        <h4>来源</h4><div>${srcRefs(p.sources)}</div>
      </div>
    </details>
  </article>`;
}
function renderPlugins(){
  const f=state.plug;
  const P=D.plugins.items;
  const list=P.filter(p=>
    (f.cat==='all'||p.category===f.cat) &&
    (f.pay==='all'||p.priceType===f.pay) &&
    (f.lic==='all'||p.license===f.lic) &&
    (f.rec==='all'||p.recommend===f.rec) &&
    (f.compat==='all'||compatFamily(p.compat)===f.compat)
  );
  const dims=D.plugins.decisionDimensions;
  const decisions=D.plugins.decisions.map(d=>`<tr><td>${esc(d.option)}</td>${d.values.map(v=>`<td>${esc(v)}</td>`).join('')}<td>${esc(d.note)}</td></tr>`).join('');
  const cached=P.filter(p=>p.image).length;
  return `<div class="sectionhead"><h2>插件与模板库</h2><span class="count">${list.length} / ${P.length} 条 · 图片本地缓存 ${cached} · 占位 ${P.length-cached}</span></div>
  <p class="lede">判断“该不该买/该不该用”：用途、价格与授权、兼容性、替代方案、风险与结论逐条给出。价格只写官方定价页可核实的内容，查不到写“需询价”；图片不伪造，缺图显示占位。</p>
  <div class="note">${esc(D.plugins.note||'')}</div>
  <div class="sectionhead"><h2>选型决策表</h2><span class="count">内置 vs 免费示例 vs 商业插件 vs 自研</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>路径</th>${dims.map(d=>`<th>${esc(d)}</th>`).join('')}<th>说明</th></tr></thead><tbody>${decisions}</tbody></table></div>
  <div class="sectionhead"><h2>全部条目</h2><span class="count">可按类别/付费/授权/兼容/推荐度筛选</span></div>
  <div class="filters">
    <div class="frow"><span class="flabel">类别</span>${chips('plug.cat',[{id:'all',label:'全部'}].concat(D.taxonomy.plugin_categories.map(c=>({id:c.id,label:c.label,count:P.filter(p=>p.category===c.id).length}))),f.cat)}</div>
    <div class="frow">
      ${selBox('plug.pay',[{id:'all',label:'全部付费类型'},{id:'free',label:'免费'},{id:'paid',label:'付费'},{id:'mixed',label:'免费+付费档'}],f.pay,'付费')}
      ${selBox('plug.lic',[{id:'all',label:'全部授权'}].concat(D.taxonomy.plugin_license.map(l=>({id:l,label:l}))),f.lic,'授权')}
      ${selBox('plug.compat',[{id:'all',label:'全部兼容'},{id:'UE4/UE5',label:'UE4 / UE5'},{id:'UE5',label:'UE5'},{id:'UE5.2+',label:'UE5.2+'},{id:'外部工具/DCC',label:'外部工具/DCC'}],f.compat,'兼容版本')}
      ${selBox('plug.rec',[{id:'all',label:'全部推荐度'}].concat(D.taxonomy.plugin_recommend.map(r=>({id:r,label:r}))),f.rec,'推荐度')}
      <button class="btn" data-reset="plug">重置</button>
    </div>
  </div>
  ${list.length?`<div class="pgrid">${list.map(pluginCard).join('')}</div>`:'<div class="empty">没有符合条件的插件条目。</div>'}`;
}

/* ---------- 面试题库 ---------- */
const iqVerdictLabel = {PASS:'PASS 可直接入库',MERGE:'MERGE 合并入库',REJECT:'REJECT 拒绝'};
function iqCard(x){
  const v=x.audit.verdict;
  const badges = `<div class="badges">
    <span class="badge type">${esc(iqGenreLabel[x.genre]||x.genre)}</span>
    <span class="badge lvl">${esc(x.difficulty)}</span>
    <span class="badge">${esc(x.questionKind)}</span>
    <span class="badge v-${v.toLowerCase()}">${esc(iqVerdictLabel[v]||v)}</span>
    <span class="badge grade-d">证据 D · 面试经验</span>
  </div>`;
  const points=(x.answerPoints||[]).map(p=>`<li>${esc(p)}</li>`).join('');
  const mistakes=(x.commonMistakes||[]).map(m=>`<li><span class="badge">${esc(m.kind||'边界')}</span> ${esc(m.note)}</li>`).join('');
  const follow=(x.followUps||[]).map(f=>`<li><b>${esc(f.q)}</b><div class="tiny">${esc(f.a)}</div></li>`).join('');
  const rel=[];
  (x.relatedSolutions||[]).forEach(id=>rel.push(solRef(id)));
  (x.relatedProblems||[]).forEach(id=>rel.push(probRef(id)));
  (x.relatedComparisons||[]).forEach(id=>rel.push(cmpRef(id)));
  (x.relatedTopics||[]).forEach(id=>rel.push(topicRef(id)));
  return `<div class="iqcard" id="card-${esc(x.id)}">
    <div class="iqtop">
      ${badges}
      <h3>${esc(x.title)}</h3>
      <div class="iqmeta"><span>${esc(x.id)}</span><span>${esc(x.origId)}</span><span>${esc(x.role||'')}</span><span>${esc(x.stage||'')}</span></div>
      <div class="oneliner">${esc(x.oneLiner)}</div>
    </div>
    <details><summary>参考答案（折叠）</summary><div class="iqbody">
      ${x.answer30s?`<h4>30 秒回答</h4><p>${esc(x.answer30s)}</p>`:''}
      <h4>3 分钟要点</h4><ol>${points}</ol>
      ${x.verify?`<h4>如何验证</h4><p class="tiny">${esc(x.verify)}</p>`:''}
    </div></details>
    <details><summary>常见答错点 / 失败边界</summary><div class="iqbody"><ul>${mistakes||'<li class="tiny">原题未单列答错点。</li>'}</ul></div></details>
    <details><summary>追问链（${(x.followUps||[]).length}）</summary><div class="iqbody"><ul>${follow||'<li class="tiny">无</li>'}</ul></div></details>
    <details><summary>关联方案 / 问题 / 专题</summary><div class="iqbody">
      <div>${rel.join('')||'<span class="meta">无</span>'}</div>
      <div class="tiny" style="margin-top:6px">${esc(x.evidenceNote)}</div>
    </div></details>
    <div class="iqbody prov">溯源：${esc(x.origProject)} · ${esc(x.origPath)} · 原始 ID ${esc(x.origId)} · 审核 ${esc(x.audit.checkedAt)} · 结论 ${esc(v)}<br>${esc(x.audit.reason)}</div>
  </div>`;
}
function renderInterview(){
  const f=state.iq;
  const list=iqItems.filter(x=>{
    if(f.genre!=='all'&&x.genre!==f.genre) return false;
    if(f.topic!=='all'&&!(x.relatedTopics||[]).includes(f.topic)) return false;
    if(f.diff!=='all'&&x.difficulty!==f.diff) return false;
    if(f.kind!=='all'&&x.questionKind!==f.kind) return false;
    if(f.verdict!=='all'&&x.audit.verdict!==f.verdict) return false;
    if(f.kw){const k=f.kw.toLowerCase();const s=[x.title,x.oneLiner,x.answer30s,...(x.answerPoints||[]),...(x.tags||[]),x.origId].join(' ').toLowerCase();if(s.indexOf(k)<0)return false;}
    return true;
  });
  const genres=(D.taxonomy.interview_genres||[]).map(g=>({id:g.id,label:g.label,count:iqItems.filter(x=>x.genre===g.id).length}));
  return `<div class="sectionhead"><h2>面试题库</h2><span class="count">${iqItems.length} 道 · PASS ${iqStats.pass||0} / MERGE ${iqStats.merge||0} / REJECT ${iqStats.reject||0}</span></div>
  <div class="note blue">来源项目 <b>ue-game-tech-interview-handbook</b>（只读整合）。原题全部无外部链接，因此按“面试经验/说法”入库（证据 D），<b>不作为 A/B 级技术事实</b>；涉及具体数字与版本结论时，以关联方案里的来源为准。参考答案默认折叠。</div>
  <div class="note">统计：直接 A 级出处 0 条；通过关联方案可回溯 A 级来源 ${iqStats.inheritedA||0} 条；原目录带题目来源登记 ${iqStats.withOrigSourceRefs||0} 条（仅题单/公司评论，不是技术出处）。</div>
  <div class="filters">
    <div class="frow"><span class="flabel">类型</span>${chips('iq.genre',[{id:'all',label:'全部'}].concat(genres),f.genre)}</div>
    <div class="frow">
      ${selBox('iq.topic',[{id:'all',label:'全部专题'}].concat(D.topics.map(t=>({id:t.id,label:t.name}))),f.topic,'专题')}
      ${selBox('iq.diff',[{id:'all',label:'全部难度'},{id:'入门',label:'入门'},{id:'进阶',label:'进阶'},{id:'深入',label:'深入'}],f.diff,'难度')}
      ${selBox('iq.kind',[{id:'all',label:'全部题型'}].concat(D.taxonomy.interview_kinds.map(k=>({id:k,label:k}))),f.kind,'题型')}
      ${selBox('iq.verdict',[{id:'all',label:'全部审核结论'},{id:'PASS',label:'PASS'},{id:'MERGE',label:'MERGE'}],f.verdict,'审核')}
      <label class="flabel">关键词</label><input class="fsel" style="min-width:180px" data-inp="iq.kw" value="${esc(f.kw)}" placeholder="标题/答案/标签/原始ID">
      <button class="btn" data-reset="iq">重置</button>
    </div>
  </div>
  <div class="sectionhead"><h2>题目</h2><span class="count">${list.length} / ${iqItems.length}</span></div>
  ${list.length?`<div class="iqgrid">${list.map(iqCard).join('')}</div>`:'<div class="empty">没有符合条件的题目。</div>'}`;
}

/* ---------- 整合审核报告 ---------- */
function renderAudit(){
  const f=state.aud;
  const s=A.stats||{};
  const list=auditDecisions.filter(d=>(f.verdict==='all'||d.verdict===f.verdict)&&(f.genre==='all'||d.genre===f.genre));
  const inv=(A.inventory||[]).map(x=>`<tr><td>${esc(x.dir)}</td><td>${esc(x.files==null?'—':x.files)}</td><td>${esc(x.form)}</td><td>${esc(x.status)}</td><td>${esc(x.verdict)}</td><td>${esc(x.note)}</td></tr>`).join('');
  const cat=(A.categoryMap||[]).map(x=>`<tr><td>${esc(x.orig)}</td><td>${esc(x.label)}</td><td>${(x.target||[]).map(t=>topicRef(t)).join('')}</td><td>${esc(x.note||'按分类映射')}</td></tr>`).join('');
  const gm=(A.genreMap||[]).map(x=>`<tr><td>${esc(x.label)}</td><td>${(x.targetTypes||[]).map(esc).join(' / ')}</td><td>${(x.topics||[]).map(t=>topicRef(t)).join('')}</td><td>${esc(x.note||'直接映射')}</td></tr>`).join('');
  const tm=(A.topicMap||[]).map(x=>`<tr><td>${esc(x.orig)}</td><td>${esc(x.label)}</td><td>${(x.target||[]).map(t=>topicRef(t)).join('')}</td><td>${esc(x.strategy)}</td></tr>`).join('');
  const rejected=(A.rejected||[]).map(x=>`<div class="reject-item"><div class="t">${esc(x.origId)} · ${esc(x.title)}</div><div class="m">${esc(x.origPath)}</div><div class="reason">${esc(x.reason)}</div></div>`).join('');
  const overlap=(A.dedup&&A.dedup.overlap||[]).map(x=>`<tr><td>${esc(x.origId)}</td><td>${(x.targets||[]).map(t=>entryRef(t)).join('')}</td><td class="reason">${esc(x.note)}</td></tr>`).join('');
  const dims=d=>d&&d.dimensions?`${esc(d.dimensions.fact)}；来源：${esc(d.dimensions.source)}；版本：${esc(d.dimensions.version)}`:''; 
  const rows=list.map(d=>`<tr><td><span class="badge v-${d.verdict.toLowerCase()}">${esc(d.verdict)}</span></td><td>${esc(d.origId)}</td><td>${esc(d.title)}</td><td>${(d.targets||[]).map(t=>entryRef(t)).join('')||'—'}</td><td class="reason">${esc(d.reason)}<div class="tiny">${dims(d)}</div></td></tr>`).join('');
  return `<div class="sectionhead"><h2>整合审核报告</h2><span class="count">来源 ${s.sourceQuestions||0} 道 · 逐条有结论</span></div>
  <div class="note">审核口径：每条都要有事实、来源、版本、时效、完整性、一致性六个维度的结论。完整重复、部分重叠、全新分别标注；<b>REJECT 只出现在本页，不进正式内容区</b>。原文 0 个外链，因此除 5 条越界题外，其余按“面试经验”入库并标 D 级证据，不冒充官方事实。</div>
  <div class="audit-sum">
    <div class="stat"><b>${s.sourceQuestions||0}</b><span>来源题目</span></div>
    <div class="stat"><b>${s.pass||0}</b><span>PASS 直接入库</span></div>
    <div class="stat"><b>${s.merge||0}</b><span>MERGE 合并入库</span></div>
    <div class="stat"><b>${s.reject||0}</b><span>REJECT 拒绝</span></div>
    <div class="stat"><b>${s.imported||0}</b><span>正式内容区条目</span></div>
  </div>
  <div class="meta">全新 ${s.newEntries||0} 条 · 合并 ${s.mergedEntries||0} 条 · 完全重复 ${s.exactDuplicates||0} 条 · 部分重叠 ${s.overlaps||0} 条 · 弱相似保留 ${s.weakOverlapsKept||0} 条 · 有题目来源登记 ${s.withOrigSourceRefs||0} 条 · 通过关联方案可回溯 A 级 ${s.inheritedACovered||0} 条</div>

  <div class="sectionhead"><h2>一、来源盘点</h2><span class="count">目录 / 文件数 / 形态 / 处理</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>目录</th><th>文件数</th><th>内容形态</th><th>处理</th><th>结论</th><th>说明</th></tr></thead><tbody>${inv}</tbody></table></div>

  <div class="sectionhead"><h2>二、映射表</h2><span class="count">类型 6 · 分类 ${(A.categoryMap||[]).length} · 细粒度 topic ${(A.topicMap||[]).length}</span></div>
  <div class="tablewrap"><table class="data"><thead><tr><th>原类型</th><th>目标类型</th><th>目标专题</th><th>说明</th></tr></thead><tbody>${gm}</tbody></table></div>
  <div class="tablewrap" style="margin-top:12px"><table class="data"><thead><tr><th>原分类</th><th>名称</th><th>目标专题</th><th>说明</th></tr></thead><tbody>${cat}</tbody></table></div>
  <details style="margin-top:12px"><summary>展开 74 条细粒度 topic 映射</summary><div class="tablewrap"><table class="data"><thead><tr><th>原 topic</th><th>名称</th><th>目标专题</th><th>策略</th></tr></thead><tbody>${tm}</tbody></table></div></details>

  <div class="sectionhead"><h2>三、重复项处理</h2><span class="count">完全重复 ${s.exactDuplicates||0} · 部分重叠 ${(A.dedup&&A.dedup.overlap||[]).length} · 弱相似保留 ${(A.dedup&&A.dedup.weakOverlap||[]).length}</span></div>
  <div class="note">完全重复指同一问题同一结论、可直接删一条；本次未发现。部分重叠指机制与现有方案/问题同源，保留原方案与约束卡，把新题作为问法/追问链并入并回链；弱相似指关键词相近但考察角度不同，保留独立题目，避免为了“看起来整齐”抹掉新问法。</div>
  <div class="tablewrap"><table class="data"><thead><tr><th>原始 ID</th><th>合并到</th><th>处理说明</th></tr></thead><tbody>${overlap||'<tr><td colspan="3">无</td></tr>'}</tbody></table></div>

  <div class="sectionhead"><h2>四、REJECT 理由清单</h2><span class="count">${(A.rejected||[]).length} 条</span></div>
  ${rejected||'<div class="empty">无拒绝条目。</div>'}

  <div class="sectionhead"><h2>五、逐条结论</h2><span class="count">${list.length} / ${auditDecisions.length}</span></div>
  <div class="filters">
    <div class="frow"><span class="flabel">结论</span>${chips('aud.verdict',[{id:'all',label:'全部'},{id:'PASS',label:'PASS'},{id:'MERGE',label:'MERGE'},{id:'REJECT',label:'REJECT'}],f.verdict)}</div>
    <div class="frow">${selBox('aud.genre',[{id:'all',label:'全部类型'}].concat((D.taxonomy.interview_genres||[]).map(g=>({id:g.id,label:g.label}))),f.genre,'类型')}<button class="btn" data-reset="aud">重置</button></div>
  </div>
  <div class="tablewrap"><table class="data"><thead><tr><th>结论</th><th>原始 ID</th><th>题目</th><th>合并到</th><th>理由 / 六维核验摘要</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function entryRef(id){
  if(solById[id]) return solRef(id);
  if(probById[id]) return probRef(id);
  if(cmpById[id]) return cmpRef(id);
  if(topicById[id]) return topicRef(id);
  return `<span class="ref">${esc(id)}?</span>`;
}

/* ---------- 全局搜索 ---------- */
const DOCS=(function(){
  const docs=[];
  const push=(kind,id,section,domain,level,title,meta,search,snippet,kinds)=>docs.push({kind,id,section,domain,level,title,meta,search:(title+' '+search).toLowerCase(),snippet,kinds:kinds||[]});
  D.solutions.forEach(s=>push('solution',s.id,'solutions','solution',s.level,s.name,`${s.type.join('/')} · ${s.category} · ${s.id}`,[s.name,s.summary,s.problem,s.mechanism,s.category,...(s.aliases||[]),...(s.tags||[]),...s.type].join(' '),s.summary));
  ['rendering','performance','gc'].forEach(dom=>D.zones[dom].forEach(z=>push('zone',z.id,dom,dom,z.level,z.name,`${SEC_LABEL[dom]} · ${z.category} · ${z.id}`,[z.name,z.summary,z.problem,z.mechanism,z.cost,z.category,...(z.aliases||[]),...(z.tags||[])].join(' '),z.summary)));
  D.topics.forEach(t=>push('topic',t.id,'topics','topic',null,t.name,'技术专题 · '+t.id,[t.name,t.objective,...(t.prerequisites||[]),...(t.coreQuestions||[]),...(t.terms||[]),...(t.lineage||[])].join(' '),t.objective));
  D.videos.forEach(v=>push('video',v.bvid,'videos','video',v.level,v.title,`${v.up} · ${v.category} · ${v.bvid}`,[v.title,v.up,v.summary,...(v.points||[]),v.category].join(' '),v.summary,['视频']));
  D.resources.items.forEach(it=>push('resource',it.id,'resources','resource',null,it.name,`${assetCatLabel[it.category]||it.category} · ${it.licenseClass} · ${it.id}`,[it.name,it.note,it.subcategory||'',it.license,it.licenseClass,...(it.forTypes||[])].join(' '),it.note,['资源']));
  D.sources.forEach(s=>push('source',s.id,'sources','source',null,s.title,`${s.publisher} · ${s.kind} · ${s.grade} 级`,[s.title,s.publisher||'',s.note||'',s.kind,s.url].join(' '),s.note||s.title,[s.kind]));
  D.comparisons.forEach(c=>push('comparison',c.id,'compare','compare',null,c.name,'对比组 · '+c.id,[c.name,c.problem,c.verdict,...(c.dimensions||[])].join(' '),c.problem));
  D.difficulties.forEach(d=>push('difficulty',d.id,'difficulty','difficulty',null,`${d.type}：${d.name}`,'技术难点 · '+d.id,[d.name,d.description,d.mainstream,...(d.risks||[])].join(' '),d.description));
  D.derivations.forEach(d=>push('derivation',d.id,'derivation','method',null,`${d.type} 的第一性原理推导`,'推导链 · '+d.id,[d.type,d.goal,...(d.constraints||[]).map(c=>c.name+' '+c.value+' '+(c.note||'')),...(d.chain||[]).map(c=>c.from+' '+c.to+' '+c.need)].join(' '),d.goal));
  D.roadmap.stages.forEach(s=>push('stage',s.id,'roadmap','roadmap',null,s.name,'成长路线阶段 · '+s.id,[s.name,s.goal,...(s.projects||[]),...(s.acceptance||[])].join(' '),s.goal));
  D.problems.forEach(p=>push('problem',p.id,'problems','problem',null,p.title,`问题库 · ${p.rootCauseClass} · ${p.id}`,[p.title,p.statement,p.scene,...(p.symptoms||[]),p.rootCause,p.judgment,...(p.candidates||[]).map(c=>(solById[c.sol]||{}).name||''),...(p.candidates||[]).map(c=>c.tradeoff)].join(' '),p.statement,['问题']));
  D.sites.forEach(s=>push('site',s.id,'sites','sites',null,s.name,`${s.type} · ${s.lang} · ${s.grade} 级`,[s.name,s.org,s.contents,s.activity,s.url,s.check.note].join(' '),s.contents,['来源站点']));
  tlNodes.forEach(n=>push('timeline',n.id,'timeline','timeline',null,n.tech,`技术演进 · ${n.domain} · ${n.year}`,[n.tech,n.oneLiner,n.problem,n.version,...(n.previousPains||[]),...(n.newConstraints||[]),...(n.successors||[])].join(' '),n.oneLiner,['技术演进']));
  D.plugins.items.forEach(p=>push('plugin',p.id,'plugins','plugins',null,p.name,`${plugCatLabel[p.category]||p.category} · ${p.price} · ${p.recommend}`,[p.name,p.purpose,p.price,p.license,p.compat,p.alternatives,p.risks,p.verdict].join(' '),p.purpose,['插件']));
  iqItems.forEach(x=>push('interview',x.id,'interview','interview',x.difficulty,x.title,`${iqGenreLabel[x.genre]||x.genre} · ${x.questionKind} · ${x.audit.verdict}`,[x.title,x.oneLiner,x.answer30s,...(x.answerPoints||[]),...(x.tags||[]),x.origId].join(' '),x.oneLiner,['面试题']));
  auditDecisions.forEach(d=>push('audit',d.origId,'audit','audit',null,d.title,`审核 ${d.verdict} · ${d.genre}`,[d.title,d.reason,...(d.targets||[])].join(' '),d.reason,['审核']));
  const KINDS={solution:'方案',topic:'专题',zone:'知识条目',video:'视频',resource:'资源',source:'来源',comparison:'对比组',difficulty:'难点',derivation:'推导',stage:'路线阶段',problem:'问题',site:'来源站点',timeline:'技术演进',plugin:'插件',interview:'面试题',audit:'审核记录'};
  docs.forEach(d=>d.kindLabel=KINDS[d.kind]);
  return docs;
})();
function matchDoc(d,terms,dom,level,kind){
  if(dom!=='all' && d.domain!==dom) return false;
  if(level!=='all' && d.level!==level) return false;
  if(kind!=='all' && !(d.kinds||[]).includes(kind)) return false;
  return terms.every(t=>d.search.indexOf(t)>=0);
}
function renderSearch(){
  const terms=state.q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits=DOCS.filter(d=>matchDoc(d,terms,state.gDomain,state.gLevel,state.gKind));
  const order=['solution','topic','zone','problem','interview','video','resource','source','comparison','difficulty','derivation','stage','timeline','plugin','site','audit'];
  const groups=order.map(k=>({k,items:hits.filter(d=>d.kind===k)})).filter(g=>g.items.length);
  const total=hits.length;
  return `<div class="sectionhead"><h2>${state.q?'搜索结果':'全部条目'}</h2><span class="count">${state.q?'“'+esc(state.q)+'” · ':''}${total} 条</span></div>
  <div class="note">搜索覆盖方案名、中文别名、关键词、专题、视频、资源与来源；可用顶部“知识域 / 难度 / 资源类型”进一步收窄。</div>
  ${groups.length?groups.map(g=>`<div class="sectionhead"><h2>${esc(g.items[0].kindLabel)}</h2><span class="count">${g.items.length} 条</span></div>
    <div class="tablewrap">${g.items.map(d=>`<div class="searchhit" data-jump="${d.kind}:${d.id}">
      <div class="k">${esc(d.kindLabel)}</div>
      <div><div class="t">${esc(d.title)}</div><div class="m">${esc(d.meta)}</div><div class="m">${esc(truncate(d.snippet,120))}</div></div>
    </div>`).join('')}</div>`).join(''):`<div class="empty">没有匹配结果。试试更短的关键词，或清空顶部筛选。</div>`}`;
}

/* ---------- 跳转 ---------- */
function jump(kind,id){
  const secMap={solution:'solutions',topic:'topics',source:'sources',video:'videos',resource:'resources',comparison:'compare',difficulty:'difficulty',derivation:'derivation',stage:'roadmap',problem:'problems',site:'sites',timeline:'timeline',plugin:'plugins',interview:'interview',audit:'audit'};
  if(kind==='section'){ state.section=id; state.q=''; qEl.value=''; render(); window.scrollTo({top:0}); return; }
  if(kind==='zone'){
    const z=zoneById[id];
    state.section=z?z._dom:'rendering';
  }else if(secMap[kind]){
    state.section=secMap[kind];
  }else return;
  state.q=''; qEl.value='';
  render();
  setTimeout(()=>{
    const el=document.getElementById('card-'+id);
    if(!el){ return; }
    const det=el.querySelector('details'); if(det) det.open=true;
    el.scrollIntoView({block:'center'});
    el.classList.add('flash');
    setTimeout(()=>el.classList.remove('flash'),1800);
  },30);
}

/* ---------- 事件 ---------- */
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-nav]');
  if(nav){ state.section=nav.dataset.nav; state.q=''; qEl.value=''; state.lastSection=state.section; render(); return; }
  const j=e.target.closest('[data-jump]');
  if(j){ e.preventDefault(); const raw=j.dataset.jump; const i=raw.indexOf(':'); jump(raw.slice(0,i),raw.slice(i+1)); return; }
  const t=e.target.closest('[data-tog]');
  if(t){
    const key=t.dataset.tog, val=t.dataset.val;
    if(key==='diffType'){ state.diffType=val; }
    else {
      const cur=getPath(key);
      if(Array.isArray(cur)){
        const idx=cur.indexOf(val);
        if(idx>=0) cur.splice(idx,1); else cur.push(val);
      } else setPath(key,val);
    }
    render(); return;
  }
  const r=e.target.closest('[data-reset]');
  if(r){
    const k=r.dataset.reset;
    if(k==='sol') state.sol={types:[],cats:[],eng:'all',mat:'all',rel:'all',lvl:'all'};
    if(k==='zone') state.zone={cat:'all',lvl:'all',rel:'all'};
    if(k==='vid') state.vid={cat:'all',lvl:'all',dur:'all',lang:'all',type:'all'};
    if(k==='res') state.res={types:[],cats:[],lic:'all'};
    if(k==='prob') state.prob={topic:'all',type:'all',symptom:'',root:'all'};
    if(k==='site') state.site={grade:'all',status:'all',type:'all'};
    if(k==='plug') state.plug={cat:'all',pay:'all',lic:'all',compat:'all',rec:'all'};
    if(k==='iq') state.iq={genre:'all',topic:'all',diff:'all',kind:'all',verdict:'all',kw:''};
    if(k==='aud') state.aud={verdict:'all',genre:'all'};
    render(); return;
  }
});
document.addEventListener('change',e=>{
  const inp=e.target.closest('[data-inp]');
  if(inp){ setPath(inp.dataset.inp, inp.value.trim()); render(); return; }
  const s=e.target.closest('[data-sel]');
  if(!s) return;
  setPath(s.dataset.sel,s.value);
  if(s.dataset.sel==='gDomain'||s.dataset.sel==='gLevel'||s.dataset.sel==='gKind'){
    if(state.section!=='search' && !state.q) state.lastSection=state.section;
    state.section='search';
  }
  render();
});
let qTimer=null;
qEl.addEventListener('input',()=>{
  clearTimeout(qTimer);
  qTimer=setTimeout(()=>{
    state.q=qEl.value.trim();
    if(state.q){
      if(state.section!=='search') state.lastSection=state.section;
      state.section='search';
      render();
    } else {
      if(state.section==='search' && state.lastSection!=='search') state.section=state.lastSection;
      render();
    }
  },120);
});

function restoreFromHash(){
  const h=(location.hash||'').replace(/^#/,'');
  if(!h) return;
  if(h.indexOf('card-')===0){
    const id=h.slice(5);
    const kinds=[['solution',solById],['topic',topicById],['zone',zoneById],['problem',probById],['source',srcById],['video',vidByBv],['resource',resById],['comparison',cmpById],['difficulty',diffById],['derivation',deriveById],['site',siteById],['plugin',pluginById],['interview',iqById]];
    for(const pair of kinds){ if(pair[1] && pair[1][id]){ jump(pair[0],id); return; } }
    const tn=(D.timeline.nodes||[]).find(n=>n.id===id);
    if(tn){ jump('timeline',id); return; }
    return;
  }
  state.section=h; state.q=''; qEl.value=''; render();
}
window.addEventListener('hashchange',restoreFromHash);
/* ---------- 渲染入口 ---------- */
function render(){
  renderNav();
  if(state.q || state.section==='search'){ main.innerHTML=renderSearch(); return; }
  const fn={
    overview:renderOverview, topics:renderTopics, solutions:renderSolutions,
    rendering:()=>renderZone('rendering'), performance:()=>renderZone('performance'), gc:()=>renderZone('gc'),
    compare:renderCompare, difficulty:renderDifficulty, derivation:renderDerivation,
    roadmap:renderRoadmap, videos:renderVideos, resources:renderResources, sources:renderSources,
    problems:renderProblems, sites:renderSites, timeline:renderTimeline, plugins:renderPlugins,
    interview:renderInterview, audit:renderAudit
  }[state.section]||renderOverview;
  main.innerHTML=fn();
}
document.getElementById('subtitle').textContent =
  `方案 ${D.meta.stats.solutions} · 问题 ${D.meta.stats.problems} · 面试 ${D.meta.stats.interview} · 演进 ${D.meta.stats.timelineNodes} · 插件 ${D.meta.stats.plugins} · 专题 ${D.meta.stats.topics} · 视频 ${D.meta.stats.videos} · 来源 ${D.meta.stats.sources}`;
document.getElementById('geninfo').textContent =
  `生成时间 ${D.meta.generated.slice(0,19).replace('T',' ')} UTC · 数据文件 research/data.json · 本页为自包含 HTML（数据内嵌，无 CDN）`;
render();
restoreFromHash();
})();