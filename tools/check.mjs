#!/usr/bin/env node
/**
 * check.mjs —— 命令行自检（不截图、不看图）
 * 校验 index.html 内嵌数据、字段完整率、引用完整性、链接非空率、
 * 重复 ID、JS 语法、外部资源依赖、文件体积等。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const html = read('index.html');
const data = JSON.parse(read('research/data.json'));

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

console.log('=== 1. 产物与体积 ===');
const htmlSize = fs.statSync(path.join(ROOT, 'index.html')).size;
const dataSize = fs.statSync(path.join(ROOT, 'research/data.json')).size;
info(`index.html ${(htmlSize / 1024).toFixed(0)} KB · research/data.json ${(dataSize / 1024).toFixed(0)} KB`);
ok(htmlSize > 100 * 1024, 'index.html 达到可用体积（>100KB，数据已内嵌）');
ok(htmlSize < 6 * 1024 * 1024, 'index.html 未异常膨胀（<6MB）');

console.log('\n=== 2. 内嵌数据与 HTML 结构 ===');
const m = html.match(/<script id="app-data" type="application\/json">([\s\S]*?)<\/script>/);
ok(!!m, '找到内嵌数据块 #app-data');
let embedded = null;
if (m) {
  try { embedded = JSON.parse(m[1]); ok(true, '内嵌 JSON 可解析'); }
  catch (e) { ok(false, '内嵌 JSON 可解析', e.message); }
}
ok(embedded && embedded.solutions.length === data.solutions.length, '内嵌方案数与 data.json 一致');
ok((html.match(/<script/g) || []).length === (html.match(/<\/script>/g) || []).length, '<script> 标签成对');
ok((html.match(/<details/g) || []).length >= 0 && (html.match(/<style>/g) || []).length === 1, '<style> 标签存在且唯一');
ok(!/<script\s+[^>]*src=/i.test(html), '无外部脚本加载（无 <script src>）');
ok(!/<link\s+[^>]*rel=["']stylesheet/i.test(html), '无外部样式表（无 CDN stylesheet）');
ok(!/url\(\s*['"]?https?:/i.test(html), 'CSS 无远程 url()');
ok(html.includes('file:///C:/Users/ASUS/Project/UEGameRes/index.html'), '包含 UEGameRes 绝对 file:// 入口');
ok(html.includes('打开方式'), '包含本地 file:// 打开方式说明');

// 抽取页面 JS 并做语法编译检查
const scripts = [...html.matchAll(/<script(?![^>]*id="app-data")[^>]*>([\s\S]*?)<\/script>/g)].map((x) => x[1]);
ok(scripts.length >= 1, '找到页面逻辑脚本');
if (scripts.length) {
  try { new Function(scripts.join('\n')); ok(true, '页面 JS 语法可编译'); }
  catch (e) { ok(false, '页面 JS 语法可编译', e.message); }
}

console.log('\n=== 3. 条目计数 ===');
const st = data.meta.stats;
info(`类型 ${st.types} · 方案 ${st.solutions} · 专题 ${st.topics} · 渲染 ${st.rendering} · 性能 ${st.performance} · GC ${st.gc} · 视频 ${st.videos} · 来源 ${st.sources} · 资源 ${st.resources} · 对比 ${st.comparisons} · 难点 ${st.difficulties}`);
ok(st.solutions >= 60, '方案条目 >= 60', String(st.solutions));
ok(st.topics >= 12, '专题 >= 12', String(st.topics));
ok(st.rendering + st.performance + st.gc >= 45, '渲染/性能/GC 条目 >= 45', String(st.rendering + st.performance + st.gc));
ok(st.videos >= 20, '视频 >= 20', String(st.videos));
ok(st.sources >= 60, '来源 >= 60', String(st.sources));
ok(st.comparisons >= 12, '对比组 >= 12', String(st.comparisons));

console.log('\n=== 4. 方案必填字段与四件事 ===');
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

console.log('\n=== 5. 引用完整性 ===');
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

console.log('\n=== 6. 链接与授权字段 ===');
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

console.log('\n=== 7. 视频核验 ===');
const badBv = data.videos.filter((v) => !/^BV[0-9A-Za-z]{10}$/.test(v.bvid));
ok(badBv.length === 0, 'BV 号格式合法', badBv.map((v) => v.bvid).join(','));
const verified = data.videos.filter((v) => v.check && v.check.status === 'verified').length;
ok(verified === data.videos.length, '视频全部标记已核验', `${verified}/${data.videos.length}`);
const uniqBv = new Set(data.videos.map((v) => v.bvid));
ok(uniqBv.size === data.videos.length, 'BV 号无重复');

console.log('\n=== 8. 重复 ID 与结构 ===');
const dup = (arr) => arr.length - new Set(arr).size;
const allSolIds = data.solutions.map((s) => s.id);
const allZoneIds = ['rendering', 'performance', 'gc'].flatMap((k) => data.zones[k].map((z) => z.id));
const allTopicIds = data.topics.map((t) => t.id);
const allResIds = data.resources.items.map((r) => r.id);
ok(dup(allSolIds) === 0 && dup(allZoneIds) === 0 && dup(allTopicIds) === 0 && dup(allResIds) === 0, 'ID 全局无重复（各集合内）');
ok(allZoneIds.every((id) => !solIds.has(id)), '知识条目 ID 不与方案冲突');

console.log('\n=== 9. 筛选数据完整性 ===');
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

console.log('\n=== 10. 双向关联 ===');
const linked = data.solutions.filter((s) => (s.resources || []).length > 0).length;
info(`有配套资源条目的方案 ${linked}/${data.solutions.length}（其余在资源缺口报告中说明）`);
ok(data.resources.items.every((r) => (r.supports || []).length > 0), '每条推荐资源都反向标注支撑方案/知识条目');

console.log('\n=== 11. 约束卡（第三轮 A） ===');
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

console.log('\n=== 12. 问题库（第三轮 B） ===');
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
const noProbLink = data.solutions.filter((s) => !(s.relatedProblems || []).length).length;
info(`未被任何问题引用的方案 ${noProbLink}/${data.solutions.length}（问题库按需覆盖，不强制全量）`);

console.log('\n=== 13. 来源站点目录（第三轮 D） ===');
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

console.log('\n=== 14. 技术演进时间轴 ===');
const tl = data.timeline || {};
const nodes = tl.nodes || [];
ok(nodes.length >= 20, '时间轴节点 >= 20', String(nodes.length));
const eraIds = new Set((tl.eras || []).map((e) => e.id));
const evoDomains = new Set(data.taxonomy.evolution_domains || []);
const badNode = [];
for (const n of nodes) {
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

console.log('\n=== 15. 插件与模板库 ===');
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
const failReasons = [...new Set(pl.filter((x) => x.imageStatus === 'placeholder').map((x) => (x.imageReason || '未分类').split(':')[0]))];
info(`占位失败原因分类：${failReasons.join(' / ') || '无'}`);
info(`本地图片合计 ${(imgTotal / 1024).toFixed(0)} KB（${localItems.length} 张，单张上限 400KB）`);
const decisions = data.plugins?.decisions || [];
const dims = data.plugins?.decisionDimensions || [];
ok(decisions.length >= 3 && decisions.every((d) => (d.values || []).length === dims.length), '选型决策表维度一致', `${decisions.length} 行 / ${dims.length} 维`);

console.log('\n=== 16. 证据门槛与覆盖率 ===');
const aCovered = data.solutions.filter((s) => (s.sources || []).some((id) => srcIds.has(id) && data.sources.find((x) => x.id === id)?.grade === 'A')).length;
const aRate = data.solutions.length ? aCovered / data.solutions.length * 100 : 0;
info(`每方案至少 1 条 A 级来源：${aCovered}/${data.solutions.length}（${aRate.toFixed(1)}%）`);
ok(aRate >= 80, 'A 级来源覆盖率 >= 80%', `${aRate.toFixed(1)}%`);

console.log('\n=== 17. 面试题库与整合审核 ===');
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
  for (const k of ['origProject', 'origPath', 'origId', 'title', 'title', 'oneLiner', 'evidenceNote']) {
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
ok(/function renderInterview/.test(html) && /function renderAudit/.test(html), 'HTML 包含面试题库与整合审核视图逻辑');
ok(/data-jump="interview:/.test(html) || /data-jump=\\"interview:/.test(html) || /iqRef/.test(html), '题目卡片支持跳转到面试题');
ok(/整合审核报告/.test(html) && /REJECT 理由清单/.test(html), '审核报告页包含理由清单');

console.log(`\n=== 结果：${pass} PASS / ${fail} FAIL ===`);
if (fail) process.exit(1);
