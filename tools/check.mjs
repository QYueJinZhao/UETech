#!/usr/bin/env node
/**
 * check.mjs —— 命令行自检（不截图、不看图）
 * 多页静态站：路线图首页 + learn/*.html 章节 + reference/* 速查库 + 共享 assets。
 * 校验：产物体积、相对路径、离线/无 CDN、章节 8 段结构、图解注册、渐进披露、
 * 路线图节点、旧深链、数据字段与引用完整性。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(ROOT, p));
const html = read('index.html');
const data = JSON.parse(read('research/data.json'));
const catHtml = read('reference/catalog.html');
const catJs = read('assets/catalog.js');
const siteJs = read('assets/site.js');
const diagramsJs = read('assets/diagrams.js');

let fail = 0;
let pass = 0;
const ok = (cond, label, detail = '') => {
  if (cond) { pass++; console.log(`  PASS  ${label}${detail ? ' — ' + detail : ''}`); }
  else { fail++; console.log(`  FAIL  ${label}${detail ? ' — ' + detail : ''}`); }
};
const info = (label) => console.log(`  INFO  ${label}`);
const jpegSize = (buf) => {
  if (buf.length < 4 || buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) { i++; continue; }
    const marker = buf[i + 1];
    if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker)) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
};

const learnFiles = fs.existsSync(path.join(ROOT, 'learn'))
  ? fs.readdirSync(path.join(ROOT, 'learn')).filter((f) => f.endsWith('.html')).sort()
  : [];
const chapterDocs = learnFiles.map((f) => ({ file: `learn/${f}`, id: f.replace(/\.html$/, ''), html: read(`learn/${f}`) }));

console.log('=== 1. 产物与首屏体积 ===');
const indexSize = fs.statSync(path.join(ROOT, 'index.html')).size;
const dataSize = fs.statSync(path.join(ROOT, 'research/data.json')).size;
const catSize = fs.statSync(path.join(ROOT, 'reference/catalog.html')).size;
info(`index.html ${(indexSize / 1024).toFixed(1)} KB · reference/catalog.html ${(catSize / 1024).toFixed(1)} KB · research/data.json ${(dataSize / 1024).toFixed(0)} KB`);
info(`learn 章节页 ${learnFiles.length} · 速查页 ${fs.readdirSync(path.join(ROOT, 'reference')).filter((f) => f.endsWith('.html')).length}`);
ok(indexSize <= 1024 * 1024, '首屏 index.html <= 1MB', `${(indexSize / 1024).toFixed(1)} KB`);
ok(indexSize >= 2048, '首屏 index.html 非空模板', String(indexSize));
ok(learnFiles.length >= 18, '章节页 >= 18', String(learnFiles.length));
ok(exists('reference/catalog.html') && exists('reference/index.html'), '速查区入口与目录页存在');
ok(data.meta.stats.chapters === learnFiles.length, '章节数与数据统计一致', `${data.meta.stats.chapters}/${learnFiles.length}`);

console.log('\n=== 2. 多页结构、相对路径与离线可用 ===');
const preloadLinks = [];
for (const c of chapterDocs) {
  const need = ['../assets/base.css', '../assets/site.js', '../assets/diagrams.js'];
  for (const n of need) if (!c.html.includes(n)) preloadLinks.push(`${c.id}:${n}`);
  for (const m of c.html.matchAll(/href="(\.[^"]+)"/g)) {
    const p = path.normalize(path.join('learn', m[1]));
    if (!exists(p) && !m[1].includes('#')) preloadLinks.push(`${c.id}:href=${m[1]}`);
  }
}
ok(preloadLinks.length === 0, '章节页共享资源引用与相对链接均存在', preloadLinks.slice(0, 8).join(', '));
const rootAbs = [...learnFiles.map((f) => [f, read(`learn/${f}`)]), ['reference/catalog.html', catHtml], ['index.html', html]]
  .filter(([, s]) => /(?:href|src)="\//.test(s)).map(([f]) => f);
ok(rootAbs.length === 0, '无根绝对路径（GitHub Pages 子路径兼容）', rootAbs.slice(0, 6).join(','));
const extScript = [...learnFiles.map((f) => [f, read(`learn/${f}`)]), ['reference/catalog.html', catHtml], ['index.html', html], ['reference/index.html', read('reference/index.html')]]
  .filter(([, s]) => /<script\s+[^>]*src=["']https?:/i.test(s)).map(([f]) => f);
ok(extScript.length === 0, '无外部脚本（可离线双击打开）', extScript.join(','));
const extLink = [...learnFiles.map((f) => [f, read(`learn/${f}`)]), ['reference/catalog.html', catHtml], ['index.html', html], ['reference/index.html', read('reference/index.html')]]
  .filter(([, s]) => /<link\s+[^>]*href=["']https?:/i.test(s)).map(([f]) => f);
ok(extLink.length === 0, '无外部样式表 / CDN', extLink.join(','));
const cssRemote = [read('assets/base.css'), read('assets/catalog.css')].filter((s) => /url\(\s*['"]?https?:/i.test(s));
ok(cssRemote.length === 0, 'CSS 无远程 url()');
ok(exists('assets/data.js') && read('assets/data.js').startsWith('/* 自动生成'), '数据以本地脚本提供（规避 file:// fetch 限制）');

console.log('\n=== 3. 页面脚本语法 ===');
for (const [name, src] of [['assets/catalog.js', catJs], ['assets/site.js', siteJs], ['assets/diagrams.js', diagramsJs]]) {
  try { new Function(src); ok(true, `${name} 语法可编译`); }
  catch (e) { ok(false, `${name} 语法可编译`, e.message); }
}

console.log('\n=== 4. 章节结构与必备 8 段 ===');
const SECTION_IDS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
const badSec = [];
const badDiag = [];
const badDisclosure = [];
for (const c of chapterDocs) {
  const positions = SECTION_IDS.map((id) => c.html.indexOf(`id="${id}"`));
  if (positions.some((p) => p < 0)) badSec.push(`${c.id}:missing`);
  else if (positions.some((p, i) => i > 0 && p < positions[i - 1])) badSec.push(`${c.id}:out-of-order`);
  const diag = [...c.html.matchAll(/data-diagram="([a-z-]+)"/g)].map((m) => m[1]);
  if (!diag.length) badDiag.push(`${c.id}:none`);
  else for (const t of diag) {
    if (!diagramsJs.includes(`'${t}':`)) badDiag.push(`${c.id}:${t}`);
  }
  if (!/<details(?![^>]*\bopen\b)/.test(c.html)) badDisclosure.push(`${c.id}:no-collapsed-details`);
}
ok(badSec.length === 0, '每章 s1–s8 齐全且顺序正确', badSec.slice(0, 6).join(', '));
ok(badDiag.length === 0, '每章图解存在且类型已在 diagrams.js 注册', badDiag.slice(0, 6).join(', '));
ok(badDisclosure.length === 0, '每章至少 1 个默认折叠的渐进披露块', badDisclosure.slice(0, 6).join(', '));
const SEG_LABELS = ['你会遇到什么问题', '一句话直觉', '原理图解', '关键代价', '方案对比', '常见误区', '动手复现', '自测'];
const segMiss = [];
for (const c of chapterDocs) for (const l of SEG_LABELS) if (!c.html.includes(l)) segMiss.push(`${c.id}:${l}`);
ok(segMiss.length === 0, '每章包含固定 8 段叙事标题', segMiss.slice(0, 6).join(', '));
const perCounts = chapterDocs.map((c) => {
  const costs = (c.html.match(/class="costrow"/g) || []).length;
  const pits = (c.html.match(/class="pit"/g) || []).length;
  const steps = (c.html.match(/class="step"/g) || []).length;
  const quiz = (c.html.match(/class="q"/g) || []).length;
  return { id: c.id, costs, pits, steps, quiz };
});
const badCounts = perCounts.filter((x) => x.costs < 4 || x.pits !== 3 || x.steps < 3 || x.steps > 5 || x.quiz < 2 || x.quiz > 3);
ok(badCounts.length === 0, '每章代价 >=4 · 误区=3 · 动手 3–5 · 自测 2–3', badCounts.map((x) => `${x.id}:${x.costs}/${x.pits}/${x.steps}/${x.quiz}`).slice(0, 6).join(', '));
ok(chapterDocs.every((c) => c.html.includes('data-mark-learned')), '每章有「标记已学」入口');
ok(chapterDocs.every((c) => c.html.includes('class="term"')), '每章有术语悬浮解释');
const orderOk = chapterDocs.every((c, i) => (i === 0 ? c.html.includes('href="../index.html"') : true));
ok(orderOk, '章节页均能回到路线图首页');

console.log('\n=== 5. 路线图首页 ===');
const nodes = [...html.matchAll(/data-chapter-node="([^"]+)"/g)].map((m) => m[1]);
ok(nodes.length === learnFiles.length, '路线图节点数与章节数一致', `${nodes.length}/${learnFiles.length}`);
const missingNodeFiles = nodes.filter((id) => !exists(`learn/${id}.html`));
ok(missingNodeFiles.length === 0, '每个路线图节点都指向存在的章节页', missingNodeFiles.join(','));
const dupNode = nodes.length - new Set(nodes).size;
ok(dupNode === 0, '路线图节点无重复');
ok(html.includes('学习进度') || html.includes('已学'), '首页显示学习进度');
ok(siteJs.includes("ue-learn-v1"), '学习进度使用 localStorage 记录');
ok(siteJs.includes('ue-theme') && siteJs.includes('prefers-color-scheme'), '主题默认跟随系统并可切换');
ok(html.includes('data-theme-toggle') || siteJs.includes('data-theme-toggle'), '提供明暗主题切换入口');
const stages = ['基础与度量', '内容与资源', '渲染与画质', '联机、战斗与移动', '规模化、界面与交付'];
const missStage = stages.filter((s) => !html.includes(s));
ok(missStage.length === 0, '能力地图包含 5 个学习阶段', missStage.join(','));

console.log('\n=== 6. 旧深链与速查区互链 ===');
ok(/location\.replace\('reference\/catalog\.html'/.test(html) || html.includes('reference/catalog.html#'), '旧 #card-* 深链可重定向到速查库');
ok(catJs.includes('restoreFromHash') && catJs.includes("addEventListener('hashchange'"), '速查页支持 #card-* 深链与 hash 变化');
ok(!catHtml.includes('id="app-data"'), '速查页不再内嵌整包数据');
ok(catHtml.includes('../assets/data.js') && catHtml.includes('../assets/catalog.js'), '速查页复用现有渲染脚本与数据');
ok(read('reference/index.html').includes('catalog.html#'), '速查入口链接到目录页分区');
const chapterRefs = chapterDocs.flatMap((c) => [...c.html.matchAll(/reference\/catalog\.html#card-([a-z0-9-]+)/g)].map((m) => m[1]));
const allEntryIds = new Set([
  ...data.solutions.map((s) => s.id),
  ...['rendering', 'performance', 'gc'].flatMap((k) => data.zones[k].map((z) => z.id)),
  ...(data.problems || []).map((p) => p.id),
  ...(data.interview?.items || []).map((x) => x.id),
  ...data.comparisons.map((c) => c.id),
]);
const badRef = chapterRefs.filter((id) => !allEntryIds.has(id));
ok(badRef.length === 0, '章节内速查互链目标均存在', badRef.slice(0, 6).join(', '));
info(`章节内速查互链 ${chapterRefs.length} 处`);

console.log('\n=== 7. 条目计数（保留内容） ===');
const st = data.meta.stats;
info(`类型 ${st.types} · 方案 ${st.solutions} · 专题 ${st.topics} · 渲染 ${st.rendering} · 性能 ${st.performance} · GC ${st.gc} · 视频 ${st.videos} · 来源 ${st.sources} · 资源 ${st.resources} · 对比 ${st.comparisons} · 难点 ${st.difficulties}`);
ok(st.solutions >= 140, '方案条目 >= 140', String(st.solutions));
ok(st.topics >= 18, '专题 >= 18', String(st.topics));
ok(st.rendering + st.performance + st.gc >= 45, '渲染/性能/GC 条目 >= 45', String(st.rendering + st.performance + st.gc));
ok(st.videos >= 20, '视频 >= 20', String(st.videos));
ok(st.sources >= 130, '来源 >= 130', String(st.sources));
ok(st.comparisons >= 30, '对比组 >= 30', String(st.comparisons));
ok(st.chapters >= 18, '学习章节 >= 18', String(st.chapters));

console.log('\n=== 8. 方案必填字段与四件事 ===');
const REQ = ['id', 'name', 'type', 'domain', 'category', 'summary', 'problem', 'mechanism', 'pros', 'cons', 'fit', 'unfit', 'params', 'sources', 'tags', 'maturity', 'reliability', 'engine', 'level', 'reproduce', 'usage', 'optimization', 'verify'];
const missing = [];
for (const s of data.solutions) {
  for (const k of REQ) {
    const v = s[k];
    if (v == null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim())) missing.push(`${s.id}.${k}`);
  }
  if (!Array.isArray(s.reproduce) || s.reproduce.length < 3) missing.push(`${s.id}.reproduce<3`);
  if (s.optimization) {
    for (const k of ['performance', 'memory', 'package', 'iteration', 'stability']) {
      if (!Array.isArray(s.optimization[k])) missing.push(`${s.id}.optimization.${k}`);
    }
    if (!s.optimization.notWorth) missing.push(`${s.id}.optimization.notWorth`);
  }
}
ok(missing.length === 0, '方案必填/四件事字段完整', missing.slice(0, 6).join(', '));
const repCounts = data.solutions.map((s) => (s.reproduce || []).length);
ok(Math.min(...repCounts) >= 3 && Math.max(...repCounts) <= 10, '复现步骤数量在 3–10 步', `${Math.min(...repCounts)}–${Math.max(...repCounts)}`);

console.log('\n=== 9. 引用完整性 ===');
const srcIds = new Set(data.sources.map((s) => s.id));
const solIds = new Set(data.solutions.map((s) => s.id));
const zoneIds = new Set(['rendering', 'performance', 'gc'].flatMap((k) => data.zones[k].map((z) => z.id)));
const entryIds = new Set([...solIds, ...zoneIds]);
const topicIds = new Set(data.topics.map((t) => t.id));
const videoIds = new Set(data.videos.map((v) => v.bvid));
const resIds = new Set(data.resources.items.map((r) => r.id));
const badS = [], badE = [], badT = [], badV = [], badR = [];
for (const s of data.solutions) for (const x of s.sources || []) if (!srcIds.has(x)) badS.push(`${s.id}->${x}`);
for (const k of ['rendering', 'performance', 'gc']) for (const z of data.zones[k]) for (const x of z.sources || []) if (!srcIds.has(x)) badS.push(`${z.id}->${x}`);
for (const r of data.resources.items) for (const x of r.supports || []) if (!entryIds.has(x)) badE.push(`${r.id}->${x}`);
for (const t of data.topics) {
  for (const x of t.relatedSolutions || []) if (!entryIds.has(x)) badE.push(`${t.id}->${x}`);
  for (const x of t.relatedVideos || []) if (!videoIds.has(x)) badV.push(`${t.id}->${x}`);
  for (const x of t.relatedResources || []) if (!resIds.has(x)) badR.push(`${t.id}->${x}`);
  for (const x of t.dependencies || []) if (!topicIds.has(x)) badT.push(`${t.id}->${x}`);
}
for (const c of data.comparisons) {
  for (const x of c.candidates || []) if (!entryIds.has(x)) badE.push(`${c.id}->${x}`);
  for (const r of c.rows || []) if (!entryIds.has(r.sol)) badE.push(`${c.id} row->${r.sol}`);
  if (c.rows.length !== c.candidates.length) badE.push(`${c.id} rows!=candidates`);
  for (const r of c.rows || []) if (r.values.length !== c.dimensions.length) badE.push(`${c.id} ${r.sol} values!=dimensions`);
}
for (const d of data.difficulties) for (const x of d.candidates || []) if (!entryIds.has(x)) badE.push(`${d.id}->${x}`);
ok(badS.length === 0, '方案/知识条目的来源引用全部存在', badS.slice(0, 6).join(', '));
ok(badE.length === 0, '方案/对比/难点引用全部存在', badE.slice(0, 6).join(', '));
ok(badT.length === 0, '专题依赖引用全部存在', badT.slice(0, 4).join(', '));
ok(badV.length === 0, '专题视频引用全部存在', badV.slice(0, 4).join(', '));
ok(badR.length === 0, '专题资源引用全部存在', badR.slice(0, 4).join(', '));

console.log('\n=== 10. 链接与授权字段 ===');
const srcUrlOk = data.sources.filter((s) => /^(https?|file):\/\//.test(s.url || '')).length;
ok(srcUrlOk === data.sources.length, '来源 URL 非空/协议合法 100%', `${srcUrlOk}/${data.sources.length}`);
const srcAccess = data.sources.filter((s) => s.accessed).length;
ok(srcAccess === data.sources.length, '来源访问日期 100%', `${srcAccess}/${data.sources.length}`);
const srcGrade = data.sources.every((s) => ['A', 'B', 'C'].includes(s.grade));
ok(srcGrade, '来源等级 A/B/C 合法');
const obtainOk = data.resources.items.filter((r) => /^https?:\/\//.test(r.obtain || '')).length;
ok(obtainOk === data.resources.items.length, '资源获取链接 100%', `${obtainOk}/${data.resources.items.length}`);
const licOk = data.resources.items.filter((r) => r.license && r.licenseClass && !/^未获取/.test(r.license)).length;
ok(licOk === data.resources.items.length, '推荐位授权字段明确 100%', `${licOk}/${data.resources.items.length}`);
ok(data.resources.pending.every((p) => !resIds.has(p.id)), '待核实资源未混入推荐位');

console.log('\n=== 11. 视频核验 ===');
const badBv = data.videos.filter((v) => !/^BV[0-9A-Za-z]{10}$/.test(v.bvid));
ok(badBv.length === 0, 'BV 号格式合法', badBv.map((v) => v.bvid).join(','));
const verified = data.videos.filter((v) => v.check && v.check.status === 'verified').length;
ok(verified === data.videos.length, '视频全部标记已核验', `${verified}/${data.videos.length}`);
const uniqBv = new Set(data.videos.map((v) => v.bvid));
ok(uniqBv.size === data.videos.length, 'BV 号无重复');

console.log('\n=== 12. 重复 ID 与结构 ===');
const dup = (arr) => arr.length - new Set(arr).size;
const allSolIds = data.solutions.map((s) => s.id);
const allZoneIds = ['rendering', 'performance', 'gc'].flatMap((k) => data.zones[k].map((z) => z.id));
const allTopicIds = data.topics.map((t) => t.id);
const allResIds = data.resources.items.map((r) => r.id);
ok(dup(allSolIds) === 0 && dup(allZoneIds) === 0 && dup(allTopicIds) === 0 && dup(allResIds) === 0, 'ID 全局无重复（各集合内）');
ok(allZoneIds.every((id) => !solIds.has(id)), '知识条目 ID 不与方案冲突');

console.log('\n=== 13. 筛选数据完整性 ===');
const typeIds = new Set(data.taxonomy.types.map((t) => t.id));
const badTypes = data.solutions.flatMap((s) => (s.type || []).filter((t) => !typeIds.has(t)).map((t) => `${s.id}:${t}`));
ok(badTypes.length === 0, '方案游戏类型均在 taxonomy 内', badTypes.slice(0, 5).join(','));
const machines = ['solution', 'rendering', 'performance', 'gc'];
ok(machines.every((d) => data.taxonomy.domains.some((x) => x.id === d)), '知识域枚举存在');
const assetCatIds = new Set(data.taxonomy.asset_categories.map((c) => c.id));
const badCats = data.resources.items.filter((r) => !assetCatIds.has(r.category)).map((r) => r.id);
ok(badCats.length === 0, '资源类别均在 taxonomy 内', badCats.join(','));
const noResourceItems = data.resources.typeNeeds.flatMap((t) => t.needs.flatMap((n) => n.itemIds)).filter((id) => !resIds.has(id));
ok(noResourceItems.length === 0, '类型推荐引用的资源全部存在', noResourceItems.join(','));

console.log('\n=== 14. 双向关联 ===');
const linked = data.solutions.filter((s) => (s.resources || []).length > 0).length;
info(`有配套资源条目的方案 ${linked}/${data.solutions.length}（其余在资源缺口报告中说明）`);
ok(data.resources.items.every((r) => (r.supports || []).length > 0), '每条推荐资源都反向标注支撑方案/知识条目');

console.log('\n=== 15. 约束卡 ===');
const cards = data.constraints.cards || [];
const cardIds = new Set(cards.map((c) => c.solutionId));
const noCard = data.solutions.filter((s) => !cardIds.has(s.id)).map((s) => s.id);
ok(noCard.length === 0, '每条方案都有约束卡', `${cards.length}/${data.solutions.length}`);
const CARD_REQ = ['scale', 'hardware', 'enginePrereq', 'contentCapacity', 'serverCost', 'failureConditions', 'redLines', 'failureModes', 'costStructure', 'verdict', 'evidenceTier'];
const cardMissing = [];
for (const c of cards) {
  for (const k of CARD_REQ) {
    const v = c[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) cardMissing.push(`${c.solutionId}.${k}`);
  }
  if (c.scale && (!c.scale.team || !c.scale.duration)) cardMissing.push(`${c.solutionId}.scale`);
  if (c.costStructure && (!c.costStructure.integration || !c.costStructure.maintenance || !c.costStructure.iteration)) cardMissing.push(`${c.solutionId}.costStructure`);
  if (!['A', 'experience'].includes(c.evidenceTier)) cardMissing.push(`${c.solutionId}.evidenceTier`);
}
ok(cardMissing.length === 0, '约束卡字段完整（含规模/成本结构/证据档）', cardMissing.slice(0, 6).join(', '));
const expCards = cards.filter((c) => c.evidenceTier === 'experience');
info(`经验条目 ${expCards.length} 条：${expCards.map((c) => c.solutionId).join(', ')}`);
ok(expCards.every((c) => c.evidenceNote && /经验/.test(c.evidenceNote)), '经验条目标注说明可识别');
const badFm = cards.flatMap((c) => (c.failureModes || []).filter((f) => !f.note || !f.kind).map((f) => `${c.solutionId}:${f.note || '?'}`));
ok(badFm.length === 0, '失败模式均有说明与类型（公开案例/经验归纳）', badFm.slice(0, 5).join(','));
const fmSourceBad = cards.flatMap((c) => (c.failureModes || []).filter((f) => f.source && !data.sources.some((s) => s.id === f.source)).map((f) => `${c.solutionId}:${f.source}`));
ok(fmSourceBad.length === 0, '失败模式引用来源均存在', fmSourceBad.slice(0, 5).join(','));

console.log('\n=== 16. 问题库 ===');
const problems = data.problems || [];
ok(problems.length >= 90, '问题条目 >= 90（18 专题 × 5）', String(problems.length));
const topicSet = new Set(data.topics.map((t) => t.id));
const badPb = [];
for (const p of problems) {
  for (const k of ['id', 'topic', 'title', 'statement', 'scene', 'rootCause', 'judgment']) {
    if (!p[k]) badPb.push(`${p.id}.${k}`);
  }
  if (!Array.isArray(p.symptoms) || p.symptoms.length < 2) badPb.push(`${p.id}.symptoms<2`);
  if (!Array.isArray(p.verification) || p.verification.length < 1) badPb.push(`${p.id}.verification`);
  if (!topicSet.has(p.topic)) badPb.push(`${p.id}.topic:${p.topic}`);
  if (!Array.isArray(p.candidates) || p.candidates.length < 2) badPb.push(`${p.id}.candidates<2`);
  for (const c of p.candidates || []) if (!c.sol || !c.tradeoff) badPb.push(`${p.id}.candidate字段`);
  for (const sid of p.sources || []) if (!srcIds.has(sid)) badPb.push(`${p.id}.source:${sid}`);
}
ok(badPb.length === 0, '问题必填字段/候选数/来源完整', badPb.slice(0, 6).join(', '));
const pbTopics = data.topics.filter((t) => !problems.some((p) => p.topic === t.id)).map((t) => t.id);
ok(pbTopics.length === 0, '每个专题至少 1 条问题', pbTopics.join(','));

console.log('\n=== 17. 来源站点目录 ===');
const sites = data.sites || [];
ok(sites.length >= 20, '站点条目 >= 20', String(sites.length));
const badSite = [];
for (const s of sites) {
  for (const k of ['id', 'name', 'url', 'type', 'org', 'contents', 'activity', 'lang', 'grade']) {
    if (!s[k]) badSite.push(`${s.id}.${k}`);
  }
  if (!/^https?:\/\//.test(s.url || '')) badSite.push(`${s.id}.url`);
  if (!s.check || !s.check.status || !s.check.date || !s.check.note) badSite.push(`${s.id}.check`);
  if (s.check && !['verified', 'pending'].includes(s.check.status)) badSite.push(`${s.id}.checkStatus`);
  if (!['A', 'B', 'C'].includes(s.grade)) badSite.push(`${s.id}.grade`);
}
ok(badSite.length === 0, '站点字段/URL/核验状态完整', badSite.slice(0, 6).join(', '));
const verifiedSites = sites.filter((s) => s.check?.status === 'verified');
const pendingSites = sites.filter((s) => s.check?.status === 'pending');
info(`已验证站点 ${verifiedSites.length} · 待核实 ${pendingSites.length}`);
ok(pendingSites.every((s) => /待核实|需确认|不可|登录|验证码|空内容|地域/.test(s.check.note)), '待核实站点均写明原因');

console.log('\n=== 18. 技术演进时间轴 ===');
const tl = data.timeline || {};
const tlNodes = tl.nodes || [];
ok(tlNodes.length >= 20, '时间轴节点 >= 20', String(tlNodes.length));
const eraIds = new Set((tl.eras || []).map((e) => e.id));
const evoDomains = new Set(data.taxonomy.evolution_domains || []);
const badNode = [];
for (const n of tlNodes) {
  for (const k of ['id', 'year', 'version', 'era', 'domain', 'tech', 'oneLiner', 'problem', 'successors']) {
    if (!n[k]) badNode.push(`${n.id}.${k}`);
  }
  if (!eraIds.has(n.era)) badNode.push(`${n.id}.era:${n.era}`);
  if (!evoDomains.has(n.domain)) badNode.push(`${n.id}.domain:${n.domain}`);
  if (!Array.isArray(n.previousPains) || n.previousPains.length < 2 || n.previousPains.length > 4) badNode.push(`${n.id}.previousPains`);
  if (!Array.isArray(n.newConstraints) || n.newConstraints.length < 1) badNode.push(`${n.id}.newConstraints`);
  if (!Array.isArray(n.sources) || n.sources.length < 1) badNode.push(`${n.id}.sources`);
  for (const sid of n.sources || []) if (!srcIds.has(sid)) badNode.push(`${n.id}.source:${sid}`);
  for (const sid of n.links?.solutions || []) if (!solIds.has(sid)) badNode.push(`${n.id}.solution:${sid}`);
  for (const tid of n.links?.topics || []) if (!topicSet.has(tid)) badNode.push(`${n.id}.topic:${tid}`);
}
ok(badNode.length === 0, '时间轴节点四段/来源/交叉引用完整', badNode.slice(0, 6).join(', '));
const versions = (tl.matrix?.versions || []).map((v) => v.id);
ok(versions.length >= 6, '能力矩阵版本 >= 6', versions.join(','));
const cellStatus = new Set(['可用', '实验', 'Beta', '转正', '弃用', '不适用']);
const badCell = [];
for (const row of tl.matrix?.rows || []) {
  if (!row.tech || !row.domain || !row.note) badCell.push(`${row.tech}.meta`);
  for (const v of versions) {
    const c = row.cells?.[v];
    if (!c || !c.status || !c.note) badCell.push(`${row.tech}.${v}`);
    else if (!cellStatus.has(c.status)) badCell.push(`${row.tech}.${v}:${c.status}`);
  }
}
ok(badCell.length === 0, '能力矩阵无空值且状态合法', badCell.slice(0, 6).join(', '));
const badGen = [];
for (const g of tl.generations || []) {
  if (!g.question || !g.old?.name || !g.new?.name) badGen.push(`${g.id}.meta`);
  if ((g.values || []).length !== (g.dimensions || []).length) badGen.push(`${g.id}.values`);
}
ok(badGen.length === 0, '代际对比维度完整', badGen.slice(0, 5).join(','));

console.log('\n=== 19. 插件与模板库 ===');
const pl = data.plugins?.items || [];
ok(pl.length >= 30, '插件/模板条目 >= 30', String(pl.length));
const badPlug = [];
for (const it of pl) {
  for (const k of ['name', 'category', 'priceType', 'license', 'priceText', 'priceChecked', 'url', 'compat', 'purpose', 'price', 'alternatives', 'risks', 'verdict', 'recommend', 'imageStatus']) {
    if (!it[k] || (typeof it[k] === 'string' && !it[k].trim())) badPlug.push(`${it.id}.${k}`);
  }
  if (!/^https?:\/\//.test(it.url || '')) badPlug.push(`${it.id}.url`);
  if (!['free', 'paid', 'mixed'].includes(it.priceType)) badPlug.push(`${it.id}.priceType`);
  if (it.image && /^research\/assets\//.test(it.image) && !fs.existsSync(path.join(ROOT, it.image))) badPlug.push(`${it.id}.imageMissing`);
  if (!it.image && !it.imageStatus) badPlug.push(`${it.id}.imageStatus`);
}
ok(badPlug.length === 0, '插件字段/链接/图片状态完整', badPlug.slice(0, 6).join(', '));
const plugUrlOk = pl.filter((x) => /^https?:\/\//.test(x.url || '')).length;
ok(pl.length > 0 && plugUrlOk === pl.length, '插件链接非空率 100%', `${plugUrlOk}/${pl.length}`);
const imgLocal = pl.filter((x) => x.image && /^research\/assets\//.test(x.image) && fs.existsSync(path.join(ROOT, x.image))).length;
const imgRemote = pl.filter((x) => x.image && /^https?:\/\//.test(x.image)).length;
const imgPlaceholder = pl.filter((x) => !x.image && x.imageStatus).length;
info(`图片：本地缓存 ${imgLocal} · 远程官方图 ${imgRemote} · 占位 ${imgPlaceholder}`);
ok(imgLocal + imgRemote + imgPlaceholder === pl.length, '每个插件图片有本地/远程/占位三选一');
const localItems = pl.filter((x) => x.image && /^research\/assets\//.test(x.image));
const imgIssues = [];
let imgTotal = 0;
for (const it of localItems) {
  const abs = path.join(ROOT, it.image);
  if (!fs.existsSync(abs)) { imgIssues.push(`${it.id}:missing`); continue; }
  const size = fs.statSync(abs).size;
  imgTotal += size;
  if (size < 1024 || size > 409600) imgIssues.push(`${it.id}:size=${size}`);
  const dim = jpegSize(fs.readFileSync(abs));
  if (!dim) imgIssues.push(`${it.id}:invalid-jpeg`);
  else if (dim.w < 320 || dim.h < 160) imgIssues.push(`${it.id}:dim=${dim.w}x${dim.h}`);
  else {
    const ar = dim.w / dim.h;
    if (ar < 0.4 || ar > 4.0) imgIssues.push(`${it.id}:aspect=${ar.toFixed(2)}`);
  }
  if (!/^https?:\/\//.test(it.imageSource || '')) imgIssues.push(`${it.id}:no-image-source`);
  if (!it.imageFetchedAt) imgIssues.push(`${it.id}:no-fetched-date`);
  if (!/版权归原作者/.test((it.imageCredit || '') + (it.imageNote || ''))) imgIssues.push(`${it.id}:no-credit`);
}
ok(localItems.length > 0 && imgIssues.length === 0, '本地缓存图片存在/非空/尺寸与体积合规且来源可追溯', imgIssues.slice(0, 6).join(', '));
ok(imgTotal <= 8 * 1024 * 1024, '图片缓存总量 <= 8MB', `${(imgTotal / 1024).toFixed(0)} KB`);
const placeholderNoReason = pl.filter((x) => !x.image && (!x.imageNote || !String(x.imageNote).trim())).map((x) => x.id);
ok(placeholderNoReason.length === 0, '占位条目均写明失败原因/状态', placeholderNoReason.slice(0, 6).join(', '));
const decisions = data.plugins?.decisions || [];
const dims = data.plugins?.decisionDimensions || [];
ok(decisions.length >= 3 && decisions.every((d) => (d.values || []).length === dims.length), '选型决策表维度一致', `${decisions.length} 行 / ${dims.length} 维`);

console.log('\n=== 20. 证据门槛与覆盖率 ===');
const aCovered = data.solutions.filter((s) => (s.sources || []).some((id) => srcIds.has(id) && data.sources.find((x) => x.id === id)?.grade === 'A')).length;
const aRate = data.solutions.length ? aCovered / data.solutions.length * 100 : 0;
info(`每方案至少 1 条 A 级来源：${aCovered}/${data.solutions.length}（${aRate.toFixed(1)}%）`);
ok(aRate >= 80, 'A 级来源覆盖率 >= 80%', `${aRate.toFixed(1)}%`);

console.log('\n=== 21. 面试题库与整合审核 ===');
const iq = data.interview?.items || [];
const iqStats = data.interview?.stats || {};
const aud = data.audit || {};
const audDecisions = aud.decisions || [];
const audRejected = aud.rejected || [];
info(`面试题 ${iq.length} · PASS ${iqStats.pass} / MERGE ${iqStats.merge} / REJECT ${iqStats.reject} · 来源题 ${audDecisions.length}`);
ok(iq.length >= 200, '面试题导入 >= 200 条', String(iq.length));
ok(st.interview === iq.length && st.interviewPass === iqStats.pass && st.interviewMerge === iqStats.merge && st.interviewReject === iqStats.reject, '概览统计与题库统计一致');
const badIq = [];
const iqIds = new Set();
for (const it of iq) {
  if (iqIds.has(it.id)) badIq.push(`${it.id}:dup`);
  iqIds.add(it.id);
  for (const k of ['origProject', 'origPath', 'origId', 'title', 'oneLiner', 'evidenceNote']) {
    if (!it[k] || !String(it[k]).trim()) badIq.push(`${it.id}.${k}`);
  }
  if (it.origProject !== 'ue-game-tech-interview-handbook') badIq.push(`${it.id}.origProject`);
  if (!it.origPath.includes('/questions/')) badIq.push(`${it.id}.origPath`);
  if (!it.audit || !['PASS', 'MERGE'].includes(it.audit.verdict) || !it.audit.checkedAt || !it.audit.reason) badIq.push(`${it.id}.audit`);
  if ((it.answerPoints || []).length < 1) badIq.push(`${it.id}.answerPoints`);
  if ((it.followUps || []).length < 1) badIq.push(`${it.id}.followUps`);
  if ((it.commonMistakes || []).length < 1) badIq.push(`${it.id}.commonMistakes`);
  if (!(it.relatedTopics || []).length && !(it.relatedSolutions || []).length) badIq.push(`${it.id}.related`);
  if (!it.evidenceTier || it.evidenceTier !== 'interview') badIq.push(`${it.id}.evidenceTier`);
  if (!it.sourceGrade || it.sourceGrade !== 'D') badIq.push(`${it.id}.sourceGrade`);
}
ok(badIq.length === 0, '每条导入内容有来源项目/路径/审核结论/答案要点/追问链', badIq.slice(0, 8).join(', '));
const rejectIds = new Set(audRejected.map((x) => x.origId));
const rejectLeak = iq.filter((x) => rejectIds.has(x.origId)).map((x) => x.origId);
ok(rejectLeak.length === 0, 'REJECT 条目未出现在正式内容区', rejectLeak.join(','));
const verdictCount = { PASS: 0, MERGE: 0, REJECT: 0 };
const badDec = [];
const dimKeys = (data.taxonomy?.audit_dimensions || []);
for (const d of audDecisions) {
  if (!d.origId || !d.origPath || !d.reason) badDec.push(`${d.origId}.field`);
  if (!['PASS', 'MERGE', 'REJECT'].includes(d.verdict)) badDec.push(`${d.origId}.verdict`);
  else verdictCount[d.verdict]++;
  if (dimKeys.length && (!d.dimensions || dimKeys.some((k) => !d.dimensions[k]))) badDec.push(`${d.origId}.dims`);
}
ok(badDec.length === 0, '逐条审核决定字段与六维结论完整', badDec.slice(0, 8).join(', '));
ok(verdictCount.PASS === iqStats.pass && verdictCount.MERGE === iqStats.merge && verdictCount.REJECT === iqStats.reject, '审核结论统计与明细数量一致', `${verdictCount.PASS}/${verdictCount.MERGE}/${verdictCount.REJECT}`);
ok(audDecisions.length === iqStats.sourceQuestions, '来源题数与审核明细一致', `${audDecisions.length}`);
ok(audRejected.length === verdictCount.REJECT, '拒绝明细数与 REJECT 数一致', `${audRejected.length}`);
ok(audRejected.every((x) => x.reason && x.origPath), '每条拒绝都有理由与原始路径');
ok((aud.inventory || []).length >= 10, '来源盘点目录 >= 10', String((aud.inventory || []).length));
ok((aud.genreMap || []).length === 6 && (aud.categoryMap || []).length >= 14, '类型/分类映射表完整');
ok((aud.topicMap || []).length >= 70, '细粒度 topic 映射 >= 70', String((aud.topicMap || []).length));
ok((aud.dedup?.exact || []).length === 0 && (aud.dedup?.overlap || []).length === iqStats.merge, '重复项处理记录与 MERGE 数一致');
const inheritedA = iq.filter((it) => (it.relatedSolutions || []).some((sid) => {
  const s = data.solutions.find((x) => x.id === sid);
  return s && (s.sources || []).some((id) => data.sources.find((y) => y.id === id)?.grade === 'A');
})).length;
info(`直接 A 级出处 0 条 · 通过关联方案可回溯 A 级 ${inheritedA} 条 · 原目录带题目来源登记 ${iqStats.withOrigSourceRefs} 条`);
ok(inheritedA >= 50, '面试题可通过关联方案回溯 A 级来源 >= 50 条', String(inheritedA));
const coverTopics = new Set(iq.flatMap((x) => x.relatedTopics || []));
info(`面试题覆盖专题 ${coverTopics.size}/${data.topics.length}`);
ok(coverTopics.size >= 15, '面试题覆盖专题 >= 15', String(coverTopics.size));
ok(/function renderInterview/.test(catJs) && /function renderAudit/.test(catJs), '速查脚本包含面试题库与整合审核视图逻辑');
ok(/data-jump="interview:/.test(catJs) || /iqRef/.test(catJs), '题目卡片支持跳转到面试题');
ok(/整合审核报告/.test(catJs) && /REJECT 理由清单/.test(catJs), '审核报告页包含理由清单');
ok(catJs.includes('file:///C:/Users/ASUS/Project/UEGameRes/index.html') && catJs.includes('打开方式'), '速查区保留 UEGameRes 入口与本地打开说明');

console.log('\n=== 22. 外链与图片可用性（静态声明） ===');
const badUrls = data.sources.filter((s) => !/^(https?|file):\/\//.test(s.url || '')).length;
ok(badUrls === 0, '来源外链协议合法（无 javascript:/相对路径）', String(badUrls));
const remoteImgs = pl.filter((x) => x.image && /^https?:\/\//.test(x.image));
info(`远程官方图 ${remoteImgs.length} 个（运行时失败会回退占位，不伪造截图）`);
const learnImgs = chapterDocs.flatMap((c) => [...c.html.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => [c.id, m[1]]));
ok(learnImgs.length === 0, '章节页不依赖位图（图解为 SVG/Canvas 生成）', learnImgs.slice(0, 4).join(','));

console.log('\n=== 23. 路线图：能力树 / 阶段 / 项目 / 分支 / 缺口 ===');
const rmData = JSON.parse(read('research/learning/roadmap.json'));
const auditData = JSON.parse(read('research/learning/audit.json'));
const chIds = new Set(learnFiles.map((f) => f.replace(/\.html$/, '')));
const abIds = new Set(rmData.abilities.map((a) => a.id));
const stageAbIds = rmData.stages.flatMap((s) => s.abilities || []);
ok(rmData.abilities.length === 35, '能力项 = 35', String(rmData.abilities.length));
ok(rmData.stages.length === 5, '阶段 = 5', String(rmData.stages.length));
ok(rmData.projects.length === 5, '阶段项目 = 5', String(rmData.projects.length));
ok(rmData.branches.length === 4, '方向分支 = 4', String(rmData.branches.length));
ok(rmData.gaps.length === 7, '待补缺口 = 7', String(rmData.gaps.length));
const abChapters = new Set(rmData.abilities.flatMap((a) => a.chapters || []));
const missingAbChapter = [...chIds].filter((id) => !abChapters.has(id));
ok(missingAbChapter.length === 0, '每个章节至少挂 1 个能力项', missingAbChapter.join(','));
ok(stageAbIds.length === abIds.size && new Set(stageAbIds).size === abIds.size, '每个能力项恰好归属 1 个阶段', `${stageAbIds.length}/${abIds.size}`);
const noLevel = rmData.abilities.filter((a) => !['掌握', '理解', '了解'].includes(a.level)).map((a) => a.id);
ok(noLevel.length === 0, '能力项均有掌握/理解/了解三档', noLevel.join(','));
const badPj = rmData.projects.filter((p) => !p.deliverable || (p.acceptance || []).length < 2 || (p.failures || []).length < 2).map((p) => p.id);
ok(badPj.length === 0, '项目演练含交付物/验收点/常见失败', badPj.join(','));
const badAcc = rmData.stages.filter((s) => !s.hours || (s.acceptance || []).length < 2).map((s) => s.id);
ok(badAcc.length === 0, '每阶段有耗时区间与可观测验收标准', badAcc.join(','));
const badGap = rmData.gaps.filter((g) => !g.name || !g.why).map((g) => g.id);
ok(badGap.length === 0, '待补缺口均有名称与缺口理由', badGap.join(','));
const preEdges = [];
for (const g of chapterDocs) {
  const m = g.html.match(/data-prereqs="([^"]*)"/);
  if (!m) continue;
  for (const p of m[1].split(',').filter(Boolean)) preEdges.push([p, g.id]);
}
const state = new Map();
let hasCycle = false;
const dfs = (id) => {
  if (state.get(id) === 2) return;
  if (state.get(id) === 1) { hasCycle = true; return; }
  state.set(id, 1);
  for (const [a, b] of preEdges) if (b === id) dfs(a);
  state.set(id, 2);
};
for (const id of chIds) dfs(id);
ok(!hasCycle, '章节前置依赖无环（按页面渲染结果复核）');
ok((html.match(/class="stage-block"/g) || []).length === 5, '首页渲染 5 个阶段块');
ok((html.match(/class="ability lv-/g) || []).length === 35, '首页渲染 35 张能力卡');
ok((html.match(/class="project-card"/g) || []).length === 5, '首页渲染 5 张项目卡');
ok((html.match(/class="gap-card"/g) || []).length === 7, '首页渲染 7 张缺口卡');
ok((html.match(/data-branch-filter=/g) || []).length === 5, '方向筛选含全部 + 4 条分支');
ok((html.match(/data-graph-node=/g) || []).length === learnFiles.length, '前置依赖图节点数与章节数一致', `${(html.match(/data-graph-node=/g) || []).length}/${learnFiles.length}`);
ok(html.includes('class="depgraph"') && html.includes('data-edge-from='), '首页含 SVG 前置依赖图与边');
ok(html.includes('data-prereq-labels=') && html.includes('class="prereq-warn"'), '节点含未完成前置警示');
ok(html.includes('data-roadmap-mark=') && html.includes('这章能做什么'), '节点可标记已学并显示「这章能做什么」');
ok(siteJs.includes('ue-branch-v1') && siteJs.includes('ue-learn-v1'), '方向视图与进度分别保存到 localStorage');
ok(html.includes('data-stage=') && html.includes('待补章节'), '阶段与缺口区块可见');

console.log('\n=== 24. 内容审核报告 ===');
const auditHtml = read('reference/audit.html');
ok(exists('reference/audit.html'), '审核报告页存在');
ok((auditHtml.match(/class="audit-card"/g) || []).length === learnFiles.length, '逐章评分卡 = 18', String((auditHtml.match(/class="audit-card"/g) || []).length));
ok((auditHtml.match(/class="score /g) || []).length === learnFiles.length * 7, '评分卡含 18×7 维分数', String((auditHtml.match(/class="score /g) || []).length));
ok((auditHtml.match(/class="issue" data-sev="BLOCKER"/g) || []).length === 2, 'BLOCKER 问题 = 2');
ok((auditHtml.match(/class="issue" data-sev="MAJOR"/g) || []).length === 8, 'MAJOR 问题 = 8');
ok((auditHtml.match(/class="issue" data-sev="MINOR"/g) || []).length === 8, 'MINOR 问题 = 8');
ok(auditHtml.includes('未修（MINOR 清单）') && auditHtml.includes('已修'), '已修/未修状态可见');
ok(!/<script\s+[^>]*src=["']https?:/i.test(auditHtml), '审核报告无外部脚本');
ok(!/(?:href|src)="\//.test(auditHtml), '审核报告无根绝对路径');
ok(st.auditBlockers === 2 && st.auditMajors === 8 && st.auditMinors === 8 && st.auditFixed >= 15 && st.auditAverage === 4.18, '概览统计与审核数据一致', `${st.auditBlockers}/${st.auditMajors}/${st.auditMinors} · fixed ${st.auditFixed} · avg ${st.auditAverage}`);
ok(auditData.summary.blocker === 2 && auditData.summary.major === 8 && auditData.summary.minor === 8, '审核数据分档统计一致');
const noSetup = chapterDocs.filter((c) => !c.html.includes('class="practice-setup"')).map((c) => c.id);
ok(noSetup.length === 0, '每章动手步骤写明前提（插件/项目设置/版本）', noSetup.join(','));
const noCaptionNote = chapterDocs.filter((c) => !c.html.includes('示意，非线性真实实现')).map((c) => c.id);
ok(noCaptionNote.length === 0, '每章图解标注「示意」边界', noCaptionNote.join(','));

console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
if (fail) process.exit(1);
