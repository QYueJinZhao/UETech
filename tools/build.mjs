#!/usr/bin/env node
/**
 * build.mjs
 * 1) 读取 research/ 下所有分文件
 * 2) 做引用完整性 / 枚举取值 / 必填字段校验
 * 3) 聚合写出 research/data.json
 * 4) 注入 tools/template.html，生成自包含 index.html（无 CDN、离线可开）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => path.join(ROOT, p);
const readJson = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const taxonomy = readJson('research/taxonomy.json');
const sources = readJson('research/sources.json');
const derivations = readJson('research/derivations.json');
const topics = readJson('research/topics.json');
const videos = readJson('research/videos.json');
const resources = readJson('research/resources.json');
const roadmap = readJson('research/roadmap.json');
const difficulties = readJson('research/difficulties.json');
const comparisons = readJson('research/comparisons.json');
const constraints = readJson('research/constraints.json');
const siteDir = readJson('research/sources-sites.json');
const timeline = readJson('research/timeline.json');
const plugins = readJson('research/plugins.json');
const interview = readJson('research/interview/questions.json');
const audit = readJson('research/integration-audit.json');
const problemFiles = fs.readdirSync(R('research/problems')).filter((f) => f.endsWith('.json')).sort();
const problems = problemFiles.flatMap((f) => readJson(`research/problems/${f}`));
const zones = {
  rendering: readJson('research/zones/rendering.json'),
  performance: readJson('research/zones/performance.json'),
  gc: readJson('research/zones/gc.json'),
};
const solutionFiles = ['fps', 'tps-extraction', 'moba', 'openworld', 'arpg', 'common', 'loading', 'physics', 'mobile', 'gas', 'movement', 'net'];
const solutions = solutionFiles.flatMap((f) => readJson(`research/solutions/${f}.json`));

/* ---------------- 枚举与索引 ---------------- */
const typeIds = new Set(taxonomy.types.map((t) => t.id));
const categoryIds = new Set(taxonomy.categories.map((t) => t.id));
const engineIds = new Set(taxonomy.engine_versions);
const maturityIds = new Set(taxonomy.maturity);
const reliabilityIds = new Set(taxonomy.reliability);
const levelIds = new Set(taxonomy.levels);
const assetCategoryIds = new Set(taxonomy.asset_categories.map((t) => t.id));

const srcById = new Map();
const solById = new Map();
const topicById = new Map();
const videoByBv = new Map();
const resById = new Map();
const cmpById = new Map();
const diffById = new Map();
const deriveById = new Map();

function addUnique(map, id, item, kind) {
  if (!id) return err(`${kind} 条目缺少 id`);
  if (map.has(id)) return err(`${kind} id 重复：${id}`);
  map.set(id, item);
}

for (const s of sources) {
  addUnique(srcById, s.id, s, 'source');
  if (!s.title) err(`source ${s.id} 缺少 title`);
  if (!/^(https?|file):\/\//.test(s.url || '')) err(`source ${s.id} url 非 http(s)/file：${s.url}`);
  if (!reliabilityIds.has(s.grade)) err(`source ${s.id} grade 非法：${s.grade}`);
  if (!s.accessed) err(`source ${s.id} 缺少 accessed`);
}
for (const s of solutions) {
  addUnique(solById, s.id, s, 'solution');
  const req = ['name', 'type', 'domain', 'category', 'summary', 'problem', 'mechanism', 'pros', 'cons', 'fit', 'unfit', 'params', 'sources', 'tags', 'maturity', 'reliability', 'engine', 'level', 'reproduce', 'usage', 'optimization', 'verify'];
  for (const k of req) {
    const v = s[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim())) {
      err(`solution ${s.id} 必填字段为空：${k}`);
    }
  }
  if (s.domain !== 'solution') err(`solution ${s.id} domain 应为 solution`);
  if (!Array.isArray(s.type) || !s.type.length) err(`solution ${s.id} type 为空`);
  for (const t of s.type) if (!typeIds.has(t)) err(`solution ${s.id} type 非法：${t}`);
  if (!categoryIds.has(s.category)) err(`solution ${s.id} category 非法：${s.category}`);
  if (!maturityIds.has(s.maturity)) err(`solution ${s.id} maturity 非法：${s.maturity}`);
  if (!reliabilityIds.has(s.reliability)) err(`solution ${s.id} reliability 非法：${s.reliability}`);
  if (!levelIds.has(s.level)) err(`solution ${s.id} level 非法：${s.level}`);
  for (const e of s.engine || []) if (!engineIds.has(e)) warn(`solution ${s.id} engine 不在枚举：${e}`);
  for (const sid of s.sources || []) if (!srcById.has(sid)) err(`solution ${s.id} 引用不存在的 source：${sid}`);
  if (!Array.isArray(s.optimization) && typeof s.optimization !== 'object') err(`solution ${s.id} optimization 非对象`);
}
const zoneIds = new Set();
for (const [dom, arr] of Object.entries(zones)) {
  for (const z of arr) {
    if (zoneIds.has(z.id)) err(`zone id 重复：${z.id}`);
    zoneIds.add(z.id);
    if (z.domain !== dom) err(`zone ${z.id} domain 应为 ${dom}`);
    if (!z.name || !z.summary || !z.problem || !z.mechanism || !z.cost) err(`zone ${z.id} 缺少核心字段`);
    if (!reliabilityIds.has(z.reliability)) err(`zone ${z.id} reliability 非法：${z.reliability}`);
    if (!levelIds.has(z.level)) err(`zone ${z.id} level 非法：${z.level}`);
    for (const sid of z.sources || []) if (!srcById.has(sid)) err(`zone ${z.id} 引用不存在的 source：${sid}`);
  }
}
const zoneById = new Map();
for (const [dom, arr] of Object.entries(zones)) for (const z of arr) zoneById.set(z.id, { ...z, _dom: dom });
const entryById = new Map([...solById, ...zoneById]);
for (const v of videos) {
  if (!v.bvid) { err('video 缺少 bvid'); continue; }
  if (videoByBv.has(v.bvid)) err(`video BV 重复：${v.bvid}`);
  videoByBv.set(v.bvid, v);
  if (!/^BV[0-9A-Za-z]{10}$/.test(v.bvid)) warn(`video bvid 格式可疑：${v.bvid}`);
  if (!v.title || !v.up || !v.duration) err(`video ${v.bvid} 缺少 title/up/duration`);
  if (v.check && v.check.status !== 'verified') warn(`video ${v.bvid} 未核验：${v.check.status}`);
  if (!levelIds.has(v.level)) warn(`video ${v.bvid} level 非法：${v.level}`);
}
for (const t of topics) addUnique(topicById, t.id, t, 'topic');
for (const t of topics) {
  for (const k of ['name', 'objective']) if (!t[k]) err(`topic ${t.id} 缺少 ${k}`);
  for (const sid of t.relatedSolutions || []) if (!entryById.has(sid)) err(`topic ${t.id} 引用不存在的方案/知识条目：${sid}`);
  for (const bv of t.relatedVideos || []) if (!videoByBv.has(bv)) err(`topic ${t.id} 引用不存在的视频：${bv}`);
  for (const did of t.dependencies || []) if (!topicById.has(did) && did !== t.id) err(`topic ${t.id} 依赖不存在的专题：${did}`);
}
for (const v of videos) if (v.topic && !topicById.has(v.topic)) warn(`video ${v.bvid} topic 不存在：${v.topic}`);
for (const it of resources.items) {
  addUnique(resById, it.id, it, 'resource');
  for (const k of ['name', 'category', 'license', 'licenseClass', 'obtain']) if (!it[k]) err(`resource ${it.id} 缺少 ${k}`);
  if (!assetCategoryIds.has(it.category)) warn(`resource ${it.id} category 不在 taxonomy：${it.category}`);
  for (const sid of it.supports || []) if (!entryById.has(sid)) err(`resource ${it.id} supports 不存在：${sid}`);
  for (const t of it.forTypes || []) if (!typeIds.has(t)) err(`resource ${it.id} forTypes 非法：${t}`);
  if (!/^https?:\/\//.test(it.obtain || '')) warn(`resource ${it.id} obtain 非 http(s)：${it.obtain}`);
}
for (const tn of resources.typeNeeds) {
  if (!typeIds.has(tn.type)) err(`typeNeeds 类型非法：${tn.type}`);
  for (const n of tn.needs) {
    if (!assetCategoryIds.has(n.category)) warn(`typeNeeds ${tn.type} category 不在枚举：${n.category}`);
    for (const iid of n.itemIds) if (!resById.has(iid)) err(`typeNeeds ${tn.type} 引用不存在的资源：${iid}`);
  }
}
for (const p of resources.pending) {
  if (resById.has(p.id)) err(`pending ${p.id} 同时出现在推荐位`);
}
for (const c of comparisons) {
  addUnique(cmpById, c.id, c, 'comparison');
  for (const sid of c.candidates || []) if (!entryById.has(sid)) err(`comparison ${c.id} candidate 不存在：${sid}`);
  for (const r of c.rows || []) {
    if (!entryById.has(r.sol)) err(`comparison ${c.id} row sol 不存在：${r.sol}`);
    if (r.values.length !== c.dimensions.length) err(`comparison ${c.id} ${r.sol} 维度值数量与 dimensions 不一致`);
  }
  if (c.rows.length !== c.candidates.length) err(`comparison ${c.id} rows 与 candidates 数量不一致`);
  for (const sid of c.sources || []) if (!srcById.has(sid)) err(`comparison ${c.id} source 不存在：${sid}`);
}
for (const d of difficulties) {
  addUnique(diffById, d.id, d, 'difficulty');
  if (!typeIds.has(d.type)) err(`difficulty ${d.id} type 非法：${d.type}`);
  for (const sid of d.candidates || []) if (!entryById.has(sid)) err(`difficulty ${d.id} candidate 不存在：${sid}`);
  for (const sid of d.sources || []) if (!srcById.has(sid)) err(`difficulty ${d.id} source 不存在：${sid}`);
}
for (const d of derivations) {
  addUnique(deriveById, d.id, d, 'derivation');
  if (!String(d.type).split('/').every((t) => typeIds.has(t))) err(`derivation ${d.id} type 非法：${d.type}`);
  for (const sid of d.mainstream?.sources || []) if (!srcById.has(sid)) err(`derivation ${d.id} source 不存在：${sid}`);
  for (const c of d.mainstream?.cases || []) if (c.source && !srcById.has(c.source)) err(`derivation ${d.id} case source 不存在：${c.source}`);
}
for (const st of roadmap.stages) {
  for (const r of st.required) for (const sid of r.sources || []) if (!srcById.has(sid)) err(`roadmap ${st.id} source 不存在：${sid}`);
  for (const tid of st.crossRefs?.topics || []) if (!topicById.has(tid)) err(`roadmap ${st.id} topic 不存在：${tid}`);
  for (const sid of st.crossRefs?.solutions || []) if (!entryById.has(sid)) err(`roadmap ${st.id} solution 不存在：${sid}`);
  for (const bv of st.crossRefs?.videos || []) if (!videoByBv.has(bv)) warn(`roadmap ${st.id} video 未入库：${bv}`);
}
for (const dc of roadmap.directions) {
  for (const tid of dc.crossRefs?.topics || []) if (!topicById.has(tid)) err(`direction ${dc.id} topic 不存在：${tid}`);
  for (const sid of dc.crossRefs?.solutions || []) if (!entryById.has(sid)) err(`direction ${dc.id} solution 不存在：${sid}`);
}

/* ---------------- 第三轮新增实体 ---------------- */
const cardById = new Map();
for (const c of constraints.cards || []) {
  addUnique(cardById, c.solutionId, c, 'constraint');
  if (!solById.has(c.solutionId)) err(`constraint ${c.solutionId} 没有对应方案`);
  for (const k of ['scale', 'hardware', 'enginePrereq', 'contentCapacity', 'serverCost', 'failureConditions', 'redLines', 'failureModes', 'costStructure', 'verdict', 'evidenceTier', 'evidenceNote']) {
    const v = c[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && Object.values(v).some((x) => !x))) err(`constraint ${c.solutionId} 缺少/空字段：${k}`);
  }
  if (!c.scale?.team || !c.scale?.duration) err(`constraint ${c.solutionId} scale.team/duration 为空`);
  if (!['A', 'experience'].includes(c.evidenceTier)) err(`constraint ${c.solutionId} evidenceTier 非法：${c.evidenceTier}`);
  for (const m of c.failureModes || []) {
    if (!m.note) err(`constraint ${c.solutionId} failureMode 缺 note`);
    if (m.source && !srcById.has(m.source)) err(`constraint ${c.solutionId} failureMode source 不存在：${m.source}`);
  }
}
if (cardById.size !== solutions.length) err(`约束卡覆盖 ${cardById.size}/${solutions.length}，存在缺卡方案`);
const experienceCards = (constraints.cards || []).filter((c) => c.evidenceTier === 'experience').length;

const problemById = new Map();
for (const p of problems) {
  addUnique(problemById, p.id, p, 'problem');
  for (const k of ['topic', 'title', 'statement', 'scene', 'symptoms', 'rootCauseClass', 'rootCause', 'candidates', 'judgment', 'verification']) {
    const v = p[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) err(`problem ${p.id} 缺少/空字段：${k}`);
  }
  if (!topicById.has(p.topic)) err(`problem ${p.id} topic 不存在：${p.topic}`);
  for (const t of p.types || []) if (!typeIds.has(t)) err(`problem ${p.id} types 非法：${t}`);
  if ((p.candidates || []).length < 2) err(`problem ${p.id} 候选方案少于 2 条`);
  for (const c of p.candidates || []) {
    if (!entryById.has(c.sol)) err(`problem ${p.id} 候选不存在：${c.sol}`);
    if (!c.tradeoff) err(`problem ${p.id} 候选 ${c.sol} 缺少取舍说明`);
  }
  for (const sid of p.sources || []) if (!srcById.has(sid)) err(`problem ${p.id} source 不存在：${sid}`);
}

const siteTypes = new Set(['官方', '社区', '个人', '媒体', '学术', '机构']);
const siteById = new Map();
for (const s of (siteDir.sites || []).concat(siteDir.pending || [])) {
  addUnique(siteById, s.id, s, 'site');
  for (const k of ['name', 'url', 'type', 'org', 'contents', 'activity', 'lang', 'grade', 'check']) {
    if (!s[k]) err(`site ${s.id} 缺少：${k}`);
  }
  if (!/^https?:\/\//.test(s.url || '')) err(`site ${s.id} url 非 http(s)：${s.url}`);
  if (!siteTypes.has(s.type)) err(`site ${s.id} type 非法：${s.type}`);
  if (!reliabilityIds.has(s.grade)) err(`site ${s.id} grade 非法：${s.grade}`);
  if (!['verified', 'pending', 'rejected'].includes(s.check?.status)) err(`site ${s.id} check.status 非法`);
}

const evoDomains = new Set(taxonomy.evolution_domains);
const tlById = new Map();
for (const n of timeline.nodes || []) {
  addUnique(tlById, n.id, n, 'timeline');
  for (const k of ['year', 'version', 'era', 'domain', 'tech', 'oneLiner', 'problem', 'previousPains', 'newConstraints', 'successors', 'sources']) {
    const v = n[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) err(`timeline ${n.id} 缺少/空字段：${k}`);
  }
  if (!evoDomains.has(n.domain)) err(`timeline ${n.id} domain 非法：${n.domain}`);
  if ((n.previousPains || []).length < 2 || (n.previousPains || []).length > 4) err(`timeline ${n.id} previousPains 需 2–4 条`);
  if ((n.newConstraints || []).length < 1) err(`timeline ${n.id} newConstraints 为空`);
  for (const sid of n.sources || []) if (!srcById.has(sid)) err(`timeline ${n.id} source 不存在：${sid}`);
  for (const sid of n.links?.solutions || []) if (!entryById.has(sid)) err(`timeline ${n.id} link solution 不存在：${sid}`);
  for (const tid of n.links?.topics || []) if (!topicById.has(tid)) err(`timeline ${n.id} link topic 不存在：${tid}`);
  for (const cid of n.links?.comparisons || []) if (!cmpById.has(cid)) err(`timeline ${n.id} link comparison 不存在：${cid}`);
}
const capVersions = (timeline.matrix?.versions || []).map((v) => v.id);
const capStatus = new Set(['可用', '实验', 'Beta', '转正', '弃用', '不适用']);
for (const r of timeline.matrix?.rows || []) {
  if (!r.tech || !r.domain) err(`matrix 行缺 tech/domain`);
  for (const v of capVersions) {
    const c = (r.cells || {})[v];
    if (!c || !c.status || !c.note) err(`matrix ${r.tech} ${v} 空值`);
    else if (!capStatus.has(c.status)) err(`matrix ${r.tech} ${v} status 非法：${c.status}`);
  }
}
for (const g of timeline.generations || []) {
  if (!g.id || !g.question || !g.old?.name || !g.new?.name) err(`generation 缺 id/question/old/new`);
  if ((g.values || []).length !== (g.dimensions || []).length) err(`generation ${g.id} 维度值数量不一致`);
  for (const s of [g.old?.source, g.new?.source]) if (s && !srcById.has(s)) err(`generation ${g.id} source 不存在：${s}`);
}

const pluginCats = new Set(taxonomy.plugin_categories.map((c) => c.id));
const pluginLic = new Set(taxonomy.plugin_license);
const pluginRec = new Set(taxonomy.plugin_recommend);
const pluginById = new Map();
for (const it of plugins.items || []) {
  addUnique(pluginById, it.id, it, 'plugin');
  for (const k of ['name', 'category', 'priceType', 'license', 'priceText', 'priceChecked', 'url', 'compat', 'purpose', 'price', 'alternatives', 'risks', 'verdict', 'recommend', 'imageStatus']) {
    const v = it[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) err(`plugin ${it.id} 缺少/空字段：${k}`);
  }
  if (!pluginCats.has(it.category)) err(`plugin ${it.id} category 非法：${it.category}`);
  if (!['free', 'paid', 'mixed'].includes(it.priceType)) err(`plugin ${it.id} priceType 非法`);
  if (!pluginLic.has(it.license)) err(`plugin ${it.id} license 非法：${it.license}`);
  if (!pluginRec.has(it.recommend)) err(`plugin ${it.id} recommend 非法：${it.recommend}`);
  if (!/^https?:\/\//.test(it.url || '')) err(`plugin ${it.id} url 非 http(s)：${it.url}`);
  if (!it.image && !it.imageStatus) err(`plugin ${it.id} 缺图片与图片状态`);
  for (const sid of it.sources || []) if (!srcById.has(sid)) err(`plugin ${it.id} source 不存在：${sid}`);
}
for (const d of plugins.decisions || []) {
  if (!d.option || (d.values || []).length !== (plugins.decisionDimensions || []).length) err(`plugin decision ${d.option} 维度值数量不一致`);
}

/* ---------------- 面试题库与整合审核 ---------------- */
const iqGenres = new Set(['core', 'arpg', 'fps', 'rts', 'slg', 'smg']);
const iqKinds = new Set(['技术原理', '系统设计', '排障', '代码审查', '现场编码', '项目复盘', '行为面']);
const iqVerdict = new Set(['PASS', 'MERGE']);
const iqById = new Map();
for (const it of interview.items || []) {
  addUnique(iqById, it.id, it, 'interview');
  for (const k of ['origId', 'origPath', 'origProject', 'origTitle', 'genre', 'difficulty', 'questionKind', 'title', 'oneLiner', 'answerPoints', 'answer30s', 'commonMistakes', 'followUps', 'audit', 'evidenceTier', 'sourceGrade', 'evidenceNote']) {
    const v = it[k];
    if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) err(`interview ${it.id} 缺少/空字段：${k}`);
  }
  if (!iqGenres.has(it.genre)) err(`interview ${it.id} genre 非法：${it.genre}`);
  if (!levelIds.has(it.difficulty)) err(`interview ${it.id} difficulty 非法：${it.difficulty}`);
  if (!iqKinds.has(it.questionKind)) err(`interview ${it.id} questionKind 非法：${it.questionKind}`);
  if (!iqVerdict.has(it.audit?.verdict)) err(`interview ${it.id} audit.verdict 非法：${it.audit?.verdict}`);
  if (!it.audit?.checkedAt) err(`interview ${it.id} 缺审核时间`);
  if (!it.audit?.reason) err(`interview ${it.id} 缺审核理由`);
  if (!it.origPath.includes('/questions/')) err(`interview ${it.id} origPath 非题目路径：${it.origPath}`);
  for (const t of it.types || []) if (!typeIds.has(t)) err(`interview ${it.id} type 非法：${t}`);
  for (const t of it.topics || []) if (!topicById.has(t)) err(`interview ${it.id} topic 不存在：${t}`);
  for (const t of it.relatedTopics || []) if (!topicById.has(t)) err(`interview ${it.id} relatedTopic 不存在：${t}`);
  for (const sid of it.relatedSolutions || []) if (!entryById.has(sid)) err(`interview ${it.id} relatedSolution 不存在：${sid}`);
  for (const pid of it.relatedProblems || []) if (!problemById.has(pid)) err(`interview ${it.id} relatedProblem 不存在：${pid}`);
  for (const cid of it.relatedComparisons || []) if (!cmpById.has(cid)) err(`interview ${it.id} relatedComparison 不存在：${cid}`);
  if ((it.answerPoints || []).length < 1) err(`interview ${it.id} 缺参考答案要点`);
  if ((it.followUps || []).length < 1) err(`interview ${it.id} 缺追问链`);
  if (!(it.relatedTopics || []).length && !(it.relatedSolutions || []).length) err(`interview ${it.id} 无关联专题/方案`);
  if (!it.evidenceNote || !/无外部|面试经验|无出处/.test(it.evidenceNote)) warn(`interview ${it.id} 证据说明未写明无外部来源`);
}
for (const s of solutions) s.interviewQuestions = [];
for (const p of problems) p.interviewQuestions = [];
for (const t of topics) t.interviewQuestions = [];
for (const it of interview.items || []) {
  for (const sid of it.relatedSolutions || []) solById.get(sid)?.interviewQuestions.push(it.id);
  for (const pid of it.relatedProblems || []) problemById.get(pid)?.interviewQuestions.push(it.id);
  for (const tid of it.relatedTopics || []) topicById.get(tid)?.interviewQuestions.push(it.id);
}

const auditStats = audit.stats || {};
const decisions = audit.decisions || [];
const auditCounts = { PASS: 0, MERGE: 0, REJECT: 0 };
for (const d of decisions) {
  if (!d.origId || !d.origPath || !d.verdict || !d.reason) err(`audit decision 缺字段：${d.origId}`);
  if (!['PASS', 'MERGE', 'REJECT'].includes(d.verdict)) err(`audit decision ${d.origId} verdict 非法：${d.verdict}`);
  auditCounts[d.verdict]++;
}
const rejectedIds = (audit.rejected || []).map((x) => x.origId);
if (auditCounts.REJECT !== rejectedIds.length) err(`审核统计不一致：REJECT ${auditCounts.REJECT} vs 拒绝明细 ${rejectedIds.length}`);
if (auditStats.sourceQuestions !== decisions.length) err(`审核统计不一致：sourceQuestions ${auditStats.sourceQuestions} vs decisions ${decisions.length}`);
if (auditStats.pass !== auditCounts.PASS) err(`审核统计不一致：PASS ${auditStats.pass} vs ${auditCounts.PASS}`);
if (auditStats.merge !== auditCounts.MERGE) err(`审核统计不一致：MERGE ${auditStats.merge} vs ${auditCounts.MERGE}`);
if (auditStats.reject !== auditCounts.REJECT) err(`审核统计不一致：REJECT ${auditStats.reject} vs ${auditCounts.REJECT}`);
if (auditStats.imported !== (interview.items || []).length) err(`导入数量不一致：stats ${auditStats.imported} vs items ${(interview.items || []).length}`);
for (const rid of rejectedIds) {
  if ((interview.items || []).some((it) => it.origId === rid)) err(`REJECT 条目出现在正式内容区：${rid}`);
  if (!decisions.some((d) => d.origId === rid && d.verdict === 'REJECT')) err(`REJECT 明细缺少 decision：${rid}`);
}
for (const it of interview.items || []) {
  const d = decisions.find((x) => x.origId === it.origId);
  if (!d) err(`导入条目缺审核决定：${it.origId}`);
  else if (d.verdict !== it.audit.verdict) err(`导入条目审核结论与明细不一致：${it.origId}`);
}
if ((audit.inventory || []).length < 10) err('来源盘点目录少于 10 条');
if ((audit.genreMap || []).length !== 6) err('类型映射表不是 6 条');
if ((audit.categoryMap || []).length < 14) err('分类映射表少于 14 条');
if ((audit.topicMap || []).length < 70) err('细粒度 topic 映射少于 70 条');


for (const s of solutions) {
  const list = resources.items.filter((it) => (it.supports || []).includes(s.id)).map((it) => it.id);
  s.resources = list;
  s.constraint = cardById.get(s.id) || null;
  s.relatedProblems = problems.filter((p) => (p.candidates || []).some((c) => c.sol === s.id)).map((p) => p.id);
}
const srcRefCount = new Map();
const bump = (ids) => (ids || []).forEach((id) => srcRefCount.set(id, (srcRefCount.get(id) || 0) + 1));
solutions.forEach((s) => bump(s.sources));
Object.values(zones).flat().forEach((z) => bump(z.sources));
comparisons.forEach((c) => bump(c.sources));
difficulties.forEach((d) => bump(d.sources));
derivations.forEach((d) => { bump(d.mainstream?.sources); (d.mainstream?.cases || []).forEach((c) => bump([c.source])); });
roadmap.stages.forEach((s) => s.required.forEach((r) => bump(r.sources)));
problems.forEach((p) => bump(p.sources));
timeline.nodes.forEach((n) => bump(n.sources));
timeline.generations.forEach((g) => bump([g.old?.source, g.new?.source]));
plugins.items.forEach((it) => bump(it.sources));
bump(resources.meta.localSources);
for (const sid of resources.meta.localSources || []) if (!srcById.has(sid)) err(`resources.meta.localSources 引用不存在：${sid}`);

const sourceOut = sources.map((s) => ({ ...s, refCount: srcRefCount.get(s.id) || 0 }));
const unreferencedSources = sourceOut.filter((s) => s.refCount === 0).map((s) => s.id);
if (unreferencedSources.length) warn(`未被任何条目引用的来源 ${unreferencedSources.length} 条：${unreferencedSources.join(', ')}`);

const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const siteOut = [...(siteDir.sites || []), ...(siteDir.pending || [])].map((s) => {
  const h = hostOf(s.url);
  const matched = sourceOut.filter((x) => hostOf(x.url) === h || hostOf(x.url).endsWith('.' + h));
  return { ...s, sourceCount: matched.length, refCount: matched.reduce((a, x) => a + x.refCount, 0) };
});

for (const it of plugins.items || []) {
  if (it.image && /^research\/assets\//.test(it.image) && !fs.existsSync(R(it.image))) err(`plugin ${it.id} 本地图片不存在：${it.image}`);
}

const aCoveredSolutions = solutions.filter((s) => (s.sources || []).some((id) => srcById.get(id)?.grade === 'A')).length;
const stats = {
  types: taxonomy.types.length,
  solutions: solutions.length,
  solutionsByType: taxonomy.types.map((t) => ({ type: t.id, count: solutions.filter((s) => s.type.includes(t.id)).length })),
  extraSolutions: solutions.filter((s) => s.extra).length,
  topics: topics.length,
  rendering: zones.rendering.length,
  performance: zones.performance.length,
  gc: zones.gc.length,
  videos: videos.length,
  sources: sources.length,
  sourcesByGrade: { A: sources.filter((s) => s.grade === 'A').length, B: sources.filter((s) => s.grade === 'B').length, C: sources.filter((s) => s.grade === 'C').length },
  resources: resources.items.length,
  pendingResources: resources.pending.length,
  comparisons: comparisons.length,
  difficulties: difficulties.length,
  derivations: derivations.length,
  roadmapStages: roadmap.stages.length,
  roadmapDirections: roadmap.directions.length,
  constraints: cardById.size,
  constraintsExperience: experienceCards,
  aCoveredSolutions,
  aCoverage: solutions.length ? Math.round((aCoveredSolutions / solutions.length) * 1000) / 10 : 0,
  problems: problems.length,
  problemsByTopic: topics.map((t) => ({ topic: t.id, count: problems.filter((p) => p.topic === t.id).length })),
  sites: (siteDir.sites || []).length,
  sitesPending: (siteDir.pending || []).length,
  timelineNodes: (timeline.nodes || []).length,
  plugins: (plugins.items || []).length,
  pluginImages: (plugins.items || []).filter((it) => it.image).length,
  pluginPendingImages: (plugins.items || []).filter((it) => !it.image).length,
  interview: (interview.items || []).length,
  interviewPass: (interview.items || []).filter((it) => it.audit.verdict === 'PASS').length,
  interviewMerge: (interview.items || []).filter((it) => it.audit.verdict === 'MERGE').length,
  interviewReject: rejectedIds.length,
  interviewSourceQuestions: decisions.length,
  interviewByGenre: ['core', 'arpg', 'fps', 'rts', 'slg', 'smg'].map((g) => ({ genre: g, count: (interview.items || []).filter((it) => it.genre === g).length })),
  interviewByTopic: topics.map((t) => ({ topic: t.id, count: (interview.items || []).filter((it) => (it.relatedTopics || []).includes(t.id)).length })),
  interviewInheritedA: (interview.items || []).filter((it) => (it.relatedSolutions || []).some((sid) => (solById.get(sid)?.sources || []).some((s) => srcById.get(s)?.grade === 'A'))).length,
  interviewWithOrigRefs: (interview.items || []).filter((it) => (it.origSourceRefs || []).length).length,
  auditDirectories: (audit.inventory || []).length,
  auditMappingRows: (audit.genreMap || []).length + (audit.categoryMap || []).length + (audit.topicMap || []).length,
  auditRejected: rejectedIds.length,
};

const DATA = {
  meta: {
    generated: new Date().toISOString(),
    title: 'UE 游戏技术方案情报库',
    version: '1.0.0',
    stats,
    warnings,
    errors,
    resourceRoot: resources.meta.sourceRoot,
  },
  taxonomy,
  sources: sourceOut,
  derivations,
  solutions,
  zones,
  topics,
  videos,
  resources,
  roadmap,
  difficulties,
  comparisons,
  constraints,
  problems,
  sites: siteOut,
  timeline,
  plugins,
  interview,
  audit,
};

/* ============================================================
   学习章节：数据驱动（research/learning/chapters/*.json）
   ============================================================ */
const STAGES = [
  { id: 'base', label: '基础', hint: '先建立坐标系' },
  { id: 'resource', label: '资源与包体', hint: '内容怎么进游戏' },
  { id: 'render', label: '渲染与画质', hint: '看得见的部分' },
  { id: 'system', label: '玩法系统', hint: '联机、战斗、移动' },
  { id: 'ops', label: '工程与上线', hint: '从能跑到能发' },
];
const STAGE_BY_ID = Object.fromEntries(STAGES.map((s) => [s.id, s]));
const PARTIAL = process.argv.includes('--partial');
const CH_DIR = 'research/learning/chapters';
const chFiles = fs.existsSync(R(CH_DIR)) ? fs.readdirSync(R(CH_DIR)).filter((f) => f.endsWith('.json')).sort() : [];
const chapters = chFiles.map((f) => readJson(`${CH_DIR}/${f}`));
const learningAudit = readJson('research/learning/audit.json');
const learningRoadmap = readJson('research/learning/roadmap.json');
const diagramsSrc = fs.readFileSync(R('assets/diagrams.js'), 'utf8');
const probById = new Map(problems.map((p) => [p.id, p]));

const chById = new Map();
for (const c of chapters) {
  if (!c.id) { err('章节缺少 id'); continue; }
  if (chById.has(c.id)) err(`章节 id 重复：${c.id}`);
  chById.set(c.id, c);
}
for (const c of chapters) {
  const missing = ['id', 'order', 'stage', 'topicId', 'title', 'shortTitle', 'level', 'durationMin', 'summary', 'scenario', 'intuition', 'diagram', 'principle', 'costs', 'comparison', 'pitfalls', 'practice', 'quiz', 'terms', 'refs']
    .filter((k) => c[k] == null || (Array.isArray(c[k]) && !c[k].length) || (typeof c[k] === 'string' && !c[k].trim()));
  if (missing.length) err(`章节 ${c.id} 缺少字段：${missing.join(',')}`);
  if (!STAGE_BY_ID[c.stage]) err(`章节 ${c.id} stage 非法：${c.stage}`);
  if (!topicById.has(c.topicId)) err(`章节 ${c.id} topicId 不存在：${c.topicId}`);
  if (typeof c.order !== 'number') err(`章节 ${c.id} order 非数字`);
  if (typeof c.durationMin !== 'number' || c.durationMin < 15 || c.durationMin > 180) err(`章节 ${c.id} durationMin 不合理：${c.durationMin}`);
  for (const p of c.prereqs || []) if (!chById.has(p) && p !== c.id && !PARTIAL) err(`章节 ${c.id} 前置不存在：${p}`);
  if (!c.scenario || !c.scenario.title || !c.scenario.body || !Array.isArray(c.scenario.symptoms) || c.scenario.symptoms.length < 2) err(`章节 ${c.id} scenario 不完整`);
  if (!c.intuition || !c.intuition.one || !c.intuition.body || !c.intuition.limit) err(`章节 ${c.id} intuition 不完整`);
  if (!c.diagram || !/^[a-z-]+$/.test(c.diagram.type || '') || !c.diagram.title || !c.diagram.caption) err(`章节 ${c.id} diagram 不完整`);
  else if (!diagramsSrc.includes(`'${c.diagram.type}':`)) err(`章节 ${c.id} 图解类型未在 assets/diagrams.js 注册：${c.diagram.type}`);
  if (Array.isArray(c.principle) && (c.principle.length < 3 || c.principle.length > 5)) err(`章节 ${c.id} principle 应为 3–5 句`);
  if (Array.isArray(c.costs) && c.costs.length < 4) err(`章节 ${c.id} costs 至少 4 项`);
  for (const cost of c.costs || []) {
    if (!cost.label || !cost.note) err(`章节 ${c.id} cost 缺少 label/note`);
    if (!(cost.level >= 1 && cost.level <= 5)) err(`章节 ${c.id} cost level 应在 1–5：${cost.label}`);
  }
  const cmp = c.comparison || {};
  if (!cmp.title || !Array.isArray(cmp.dims) || cmp.dims.length < 4 || cmp.dims.length > 6) err(`章节 ${c.id} comparison dims 应为 4–6 维`);
  if (!Array.isArray(cmp.options) || cmp.options.length < 2 || cmp.options.length > 3) err(`章节 ${c.id} comparison 应有 2–3 个候选`);
  for (const o of cmp.options || []) {
    if (!o.name || !o.take) err(`章节 ${c.id} comparison 候选缺少 name/take`);
    if (!Array.isArray(o.values) || o.values.length !== (cmp.dims || []).length) err(`章节 ${c.id} 候选 ${o.name} 维度值数量不一致`);
    if (o.solutionId && !entryById.has(o.solutionId)) err(`章节 ${c.id} 候选引用不存在的方案：${o.solutionId}`);
  }
  if (Array.isArray(c.pitfalls) && c.pitfalls.length !== 3) err(`章节 ${c.id} pitfalls 应恰好 3 条`);
  for (const it of c.pitfalls || []) if (!it.wrong || !it.right) err(`章节 ${c.id} pitfall 缺少 wrong/right`);
  if (Array.isArray(c.practice) && (c.practice.length < 3 || c.practice.length > 5)) err(`章节 ${c.id} practice 应为 3–5 步`);
  for (const st of c.practice || []) if (!st.do || !st.expect) err(`章节 ${c.id} practice 步骤缺少 do/expect`);
  if (Array.isArray(c.quiz) && (c.quiz.length < 2 || c.quiz.length > 3)) err(`章节 ${c.id} quiz 应为 2–3 题`);
  for (const q of c.quiz || []) {
    if (!q.q || !q.answer || !Array.isArray(q.refs) || !q.refs.length) err(`章节 ${c.id} quiz 题缺少 q/answer/refs`);
    for (const r of q.refs || []) if (!r.kind || !r.id) err(`章节 ${c.id} quiz ref 缺少 kind/id`);
  }
  if (!c.terms || !c.terms.length) err(`章节 ${c.id} 缺少术语表`);
  const refs = c.refs || {};
  if (refs.comparisonId && !cmpById.has(refs.comparisonId)) err(`章节 ${c.id} 引用不存在的对比：${refs.comparisonId}`);
  for (const sid of refs.solutions || []) if (!entryById.has(sid)) err(`章节 ${c.id} 引用不存在的方案：${sid}`);
  for (const pid of refs.problems || []) if (!probById.has(pid)) err(`章节 ${c.id} 引用不存在的问题：${pid}`);
  for (const iid of refs.interviews || []) if (!iqById.has(iid)) err(`章节 ${c.id} 引用不存在的面试题：${iid}`);
}
const orders = chapters.map((c) => c.order).sort((a, b) => a - b);
if (chapters.length && !PARTIAL && orders.some((o, i) => o !== i + 1)) err(`章节 order 必须从 1 连续编号：${orders.join(',')}`);
if (chapters.length && chapters.filter((c) => c.stage === 'base').length === 0) warn('缺少基础阶段章节');
for (const st of STAGES) if (!chapters.some((c) => c.stage === st.id)) warn(`阶段 ${st.label} 没有章节`);

/* ---------------- 内容审核数据校验 ---------------- */
const AUDIT_DIMS = (learningAudit.meta.dimensions || []).map((d) => d.id);
const SEVERITIES = ['BLOCKER', 'MAJOR', 'MINOR'];
const auditChById = new Map((learningAudit.chapters || []).map((a) => [a.id, a]));
if (!learningAudit.chapters || learningAudit.chapters.length !== chapters.length) {
  err(`审核章节数 ${(learningAudit.chapters || []).length} 与章节数 ${chapters.length} 不一致`);
}
for (const c of chapters) {
  const a = auditChById.get(c.id);
  if (!a) { err(`审核数据缺少章节：${c.id}`); continue; }
  for (const d of AUDIT_DIMS) if (!(a.scores && a.scores[d] >= 1 && a.scores[d] <= 5)) err(`审核 ${c.id} 维度 ${d} 分数应在 1–5`);
  for (const d of AUDIT_DIMS) if (!a.evidence || !a.evidence[d] || !String(a.evidence[d]).trim()) err(`审核 ${c.id} 维度 ${d} 缺少证据`);
}
for (const it of learningAudit.issues || []) {
  for (const k of ['id', 'chapter', 'location', 'dimension', 'severity', 'problem', 'why', 'fix']) {
    if (!it[k] || !String(it[k]).trim()) err(`审核问题 ${it.id || '?'} 缺少 ${k}`);
  }
  if (!SEVERITIES.includes(it.severity)) err(`审核问题 ${it.id} severity 非法：${it.severity}`);
  const chapterParts = String(it.chapter).split(/[/、,+\s]+/).filter(Boolean);
  const chapterOk = chapterParts.length > 0 && chapterParts.every((x) => auditChById.has(x) || x === '全站');
  if (!chapterOk && !it.chapter.includes('章')) err(`审核问题 ${it.id} 章节不存在：${it.chapter}`);
  if (typeof it.fixed !== 'boolean') err(`审核问题 ${it.id} fixed 应为布尔值`);
}
const issueCounts = { BLOCKER: 0, MAJOR: 0, MINOR: 0 };
for (const it of learningAudit.issues || []) issueCounts[it.severity] = (issueCounts[it.severity] || 0) + 1;
const fixedCounts = { BLOCKER: 0, MAJOR: 0, MINOR: 0 };
for (const it of learningAudit.issues || []) if (it.fixed) fixedCounts[it.severity] = (fixedCounts[it.severity] || 0) + 1;
for (const s of SEVERITIES) {
  if (learningAudit.summary[`blocker`] !== undefined && s === 'BLOCKER' && learningAudit.summary.blocker !== issueCounts.BLOCKER) err(`审核统计 BLOCKER 不一致：${learningAudit.summary.blocker}/${issueCounts.BLOCKER}`);
  if (learningAudit.summary[`major`] !== undefined && s === 'MAJOR' && learningAudit.summary.major !== issueCounts.MAJOR) err(`审核统计 MAJOR 不一致：${learningAudit.summary.major}/${issueCounts.MAJOR}`);
  if (learningAudit.summary[`minor`] !== undefined && s === 'MINOR' && learningAudit.summary.minor !== issueCounts.MINOR) err(`审核统计 MINOR 不一致：${learningAudit.summary.minor}/${issueCounts.MINOR}`);
}
if (learningAudit.summary.fixedBlocker !== fixedCounts.BLOCKER) err(`审核统计 fixedBlocker 不一致：${learningAudit.summary.fixedBlocker}/${fixedCounts.BLOCKER}`);
if (learningAudit.summary.fixedMajor !== fixedCounts.MAJOR) err(`审核统计 fixedMajor 不一致：${learningAudit.summary.fixedMajor}/${fixedCounts.MAJOR}`);
if (learningAudit.summary.fixedMinor !== fixedCounts.MINOR) err(`审核统计 fixedMinor 不一致：${learningAudit.summary.fixedMinor}/${fixedCounts.MINOR}`);
if (learningAudit.summary.openMinor !== issueCounts.MINOR - fixedCounts.MINOR) err(`审核统计 openMinor 不一致：${learningAudit.summary.openMinor}/${issueCounts.MINOR - fixedCounts.MINOR}`);
if (issueCounts.BLOCKER + issueCounts.MAJOR + issueCounts.MINOR !== learningAudit.issues.length) err('审核问题总数与分档之和不一致');
const scoreValues = (learningAudit.chapters || []).flatMap((a) => AUDIT_DIMS.map((d) => a.scores[d]));
const avgScore = scoreValues.length ? Math.round((scoreValues.reduce((s, v) => s + v, 0) / scoreValues.length) * 100) / 100 : 0;
if (learningAudit.summary.averageScore !== avgScore) err(`审核统计 averageScore 不一致：${learningAudit.summary.averageScore}/${avgScore}`);
if (fixedCounts.BLOCKER !== issueCounts.BLOCKER) err(`仍有未修 BLOCKER：${issueCounts.BLOCKER - fixedCounts.BLOCKER}`);
if (fixedCounts.MAJOR !== issueCounts.MAJOR) err(`仍有未修 MAJOR：${issueCounts.MAJOR - fixedCounts.MAJOR}`);

/* ---------------- 路线图数据校验 ---------------- */
const rm = learningRoadmap;
const LEVELS = ['掌握', '理解', '了解'];
const abById = new Map();
for (const a of rm.abilities || []) {
  if (!a.id || abById.has(a.id)) err(`能力项 id 缺失或重复：${a.id}`);
  else abById.set(a.id, a);
  if (!a.name || !String(a.name).trim()) err(`能力项 ${a.id} 缺少 name`);
  if (!LEVELS.includes(a.level)) err(`能力项 ${a.id} level 非法：${a.level}`);
  if (!Array.isArray(a.chapters) || !a.chapters.length) err(`能力项 ${a.id} 未挂章节`);
  for (const cid of a.chapters || []) if (!chById.has(cid)) err(`能力项 ${a.id} 章节不存在：${cid}`);
  const refs = a.refs || {};
  if (!Array.isArray(refs.solutions) || !Array.isArray(refs.problems) || !Array.isArray(refs.interviews)) err(`能力项 ${a.id} refs 不完整`);
  for (const sid of refs.solutions || []) if (!entryById.has(sid)) err(`能力项 ${a.id} 引用不存在的方案：${sid}`);
  for (const pid of refs.problems || []) if (!probById.has(pid)) err(`能力项 ${a.id} 引用不存在的问题：${pid}`);
  for (const iid of refs.interviews || []) if (!iqById.has(iid)) err(`能力项 ${a.id} 引用不存在的面试题：${iid}`);
}
for (const c of chapters) {
  const covered = (rm.abilities || []).some((a) => (a.chapters || []).includes(c.id));
  if (!covered) err(`章节 ${c.id} 未被任何能力项覆盖`);
}
const projectById = new Map();
for (const p of rm.projects || []) {
  if (!p.id || projectById.has(p.id)) err(`项目 id 缺失或重复：${p.id}`);
  else projectById.set(p.id, p);
  for (const k of ['name', 'stageId', 'deliverable']) if (!p[k] || !String(p[k]).trim()) err(`项目 ${p.id} 缺少 ${k}`);
  if (!Array.isArray(p.acceptance) || p.acceptance.length < 2) err(`项目 ${p.id} 验收点应至少 2 条`);
  if (!Array.isArray(p.failures) || p.failures.length < 2) err(`项目 ${p.id} 常见失败应至少 2 条`);
}
if ((rm.projects || []).length < 5) err(`项目演练应至少 5 个，当前 ${(rm.projects || []).length}`);
if ((rm.stages || []).length !== 5) err(`阶段数应为 5，当前 ${(rm.stages || []).length}`);
const stageById = new Map();
for (const st of rm.stages || []) {
  if (!st.id || stageById.has(st.id)) err(`阶段 id 缺失或重复：${st.id}`);
  else stageById.set(st.id, st);
  if (!st.name || !st.goal) err(`阶段 ${st.id} 缺少 name/goal`);
  if (!Array.isArray(st.acceptance) || st.acceptance.length < 2) err(`阶段 ${st.id} 验收标准应至少 2 条`);
  if (!st.hours || !String(st.hours).trim()) err(`阶段 ${st.id} 缺少预计耗时`);
  if (!Array.isArray(st.chapters) || !st.chapters.length) err(`阶段 ${st.id} 未挂章节`);
  for (const cid of st.chapters || []) if (!chById.has(cid)) err(`阶段 ${st.id} 章节不存在：${cid}`);
  if (!Array.isArray(st.abilities) || !st.abilities.length) err(`阶段 ${st.id} 未挂能力项`);
  for (const aid of st.abilities || []) if (!abById.has(aid)) err(`阶段 ${st.id} 能力项不存在：${aid}`);
  if (!st.projectId || !projectById.has(st.projectId)) err(`阶段 ${st.id} 项目不存在：${st.projectId}`);
  else if (projectById.get(st.projectId).stageId !== st.id) err(`阶段 ${st.id} 项目 ${st.projectId} stageId 不匹配`);
}
const stageChapterIds = (rm.stages || []).flatMap((s) => s.chapters || []);
if (new Set(stageChapterIds).size !== chapters.length) err(`阶段章节并集应覆盖全部 ${chapters.length} 章，当前 ${new Set(stageChapterIds).size}`);
for (const cid of stageChapterIds) if (!chById.has(cid)) err(`阶段引用不存在的章节：${cid}`);
if ((rm.branches || []).length !== 4) err(`方向分支应为 4，当前 ${(rm.branches || []).length}`);
const branchById = new Map();
for (const b of rm.branches || []) {
  if (!b.id || branchById.has(b.id)) err(`方向 id 缺失或重复：${b.id}`);
  else branchById.set(b.id, b);
  for (const k of ['name', 'mainDiff', 'focus']) if (!b[k] || !String(b[k]).trim()) err(`方向 ${b.id} 缺少 ${k}`);
  if (!Array.isArray(b.chapters) || b.chapters.length < 6) err(`方向 ${b.id} 章节路线过短`);
  for (const cid of b.chapters || []) if (!chById.has(cid)) err(`方向 ${b.id} 章节不存在：${cid}`);
  for (const aid of b.extraAbilities || []) if (!abById.has(aid)) err(`方向 ${b.id} 能力项不存在：${aid}`);
  for (const gid of b.extraGaps || []) if (!(rm.gaps || []).some((g) => g.id === gid)) err(`方向 ${b.id} 缺口不存在：${gid}`);
}
if ((rm.gaps || []).length < 5) err(`待补章节应至少 5 条，当前 ${(rm.gaps || []).length}`);
for (const g of rm.gaps || []) {
  for (const k of ['id', 'name', 'why']) if (!g[k] || !String(g[k]).trim()) err(`缺口 ${g.id || '?'} 缺少 ${k}`);
  for (const bid of g.neededBy || []) if (!branchById.has(bid)) err(`缺口 ${g.id} 方向不存在：${bid}`);
}
for (const n of rm.prereqNotes || []) {
  if (!chById.has(n.from) || !chById.has(n.to)) err(`前置说明引用不存在的章节：${n.from} → ${n.to}`);
  if (!['must', 'parallel'].includes(n.kind)) err(`前置说明 ${n.from}→${n.to} kind 非法`);
  if (!n.skipCost || !String(n.skipCost).trim()) err(`前置说明 ${n.from}→${n.to} 缺少跳过代价`);
}
for (const pg of rm.parallelGroups || []) {
  if (!stageById.has(pg.stageId)) err(`并行组阶段不存在：${pg.stageId}`);
  for (const cid of pg.chapters || []) if (!chById.has(cid)) err(`并行组章节不存在：${cid}`);
}
/* 前置无环 */
const visitState = new Map();
let cycleMsg = '';
const dfsPrereq = (id, stack) => {
  if (visitState.get(id) === 2) return;
  if (visitState.get(id) === 1) { cycleMsg = stack.concat(id).join(' → '); return; }
  visitState.set(id, 1);
  for (const p of (chById.get(id) || {}).prereqs || []) dfsPrereq(p, stack.concat(id));
  visitState.set(id, 2);
};
for (const c of chapters) dfsPrereq(c.id, []);
if (cycleMsg) err(`章节前置存在环：${cycleMsg}`);

stats.chapters = chapters.length;
stats.diagramTypes = new Set(chapters.map((c) => c.diagram && c.diagram.type)).size;
stats.abilities = (rm.abilities || []).length;
stats.stages = (rm.stages || []).length;
stats.projects = (rm.projects || []).length;
stats.branches = (rm.branches || []).length;
stats.gaps = (rm.gaps || []).length;
stats.auditBlockers = issueCounts.BLOCKER;
stats.auditMajors = issueCounts.MAJOR;
stats.auditMinors = issueCounts.MINOR;
stats.auditFixed = (learningAudit.issues || []).filter((x) => x.fixed).length;
stats.auditAverage = avgScore;
fs.writeFileSync(R('research/data.json'), JSON.stringify(DATA, null, 1), 'utf8');

/* ---------------- 生成 HTML ---------------- */
const payload = JSON.stringify(DATA).replace(/</g, '\\u003c');
const template = fs.readFileSync(R('tools/template.html'), 'utf8');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const apply = (tpl, map) => {
  let out = tpl;
  for (const [k, v] of Object.entries(map)) out = out.split('__' + k + '__').join(v);
  return out;
};

/* 术语首次出现加悬浮解释（每章每术语只标一次） */
function makeDecorator(terms) {
  const used = {};
  return (text) => {
    let out = esc(text);
    const list = (terms || []).slice().sort((a, b) => b.term.length - a.term.length);
    for (const t of list) {
      if (used[t.term]) continue;
      const et = esc(t.term);
      const i = out.indexOf(et);
      if (i >= 0) {
        used[t.term] = 1;
        out = out.slice(0, i) + `<span class="term" tabindex="0" data-def="${esc(t.def)}">${et}</span>` + out.slice(i + et.length);
      }
    }
    return out;
  };
}

const REF_LABEL = { solution: '方案', problem: '问题', interview: '面试题', comparison: '对比' };
const refHref = (id) => `../reference/catalog.html#card-${id}`;
function refChip(kind, id, label) {
  return `<a href="${refHref(id)}">${REF_LABEL[kind] || kind}：${esc(label)}</a>`;
}

function renderChapterBody(c) {
  const D = makeDecorator(c.terms);
  const sections = [];
  // 1 场景
  sections.push(`<section class="screen" id="s1">
  <div class="label"><span class="idx">01</span><h2>你会遇到什么问题</h2></div>
  <div class="body">
    <div class="scene">
      <h3>${esc(c.scenario.title)}</h3>
      <p>${D(c.scenario.body)}</p>
      <div class="symptoms"><b>常见症状：</b><ul>${c.scenario.symptoms.map((s) => `<li>${D(s)}</li>`).join('')}</ul></div>
    </div>
  </div>
</section>`);
  // 2 直觉
  sections.push(`<section class="screen" id="s2">
  <div class="label"><span class="idx">02</span><h2>一句话直觉</h2></div>
  <div class="body">
    <blockquote class="intuition">${D(c.intuition.one)}</blockquote>
    <p>${D(c.intuition.body)}</p>
    <p class="note">类比的边界：${D(c.intuition.limit)}</p>
  </div>
</section>`);
  // 3 原理
  const diagram = `<div class="diagram-wrap"><div data-diagram="${esc(c.diagram.type)}" data-title="${esc(c.diagram.title)}" data-caption="${esc(c.diagram.caption)}" data-params="${esc(JSON.stringify(c.diagram.params || {}))}"></div></div>`;
  sections.push(`<section class="screen" id="s3">
  <div class="label"><span class="idx">03</span><h2>原理图解</h2></div>
  <div class="body">
    ${diagram}
    ${c.principle.map((p) => `<p>${D(p)}</p>`).join('')}
    <details class="detail"><summary>展开：再深一层的机制与边界</summary><div class="dbody">${D(c.detail || c.intuition.limit)}</div></details>
  </div>
</section>`);
  // 4 代价
  const costRows = c.costs.map((x) => {
    let bars = '';
    for (let i = 1; i <= 5; i++) bars += `<i class="${i <= x.level ? 'on' : ''}${i <= x.level && x.level >= 4 ? ' hot' : ''}"></i>`;
    return `<div class="costrow"><span class="cl">${esc(x.label)}</span><div class="bars">${bars}</div><span class="note">${D(x.note)}</span></div>`;
  }).join('');
  sections.push(`<section class="screen" id="s4">
  <div class="label"><span class="idx">04</span><h2>关键代价</h2></div>
  <div class="body">
    <div class="costbars">${costRows}</div>
    <p class="costnote">条形为相对量级（1–5 档），不对应具体毫秒、兆字节或人力数字。判断取舍时看「哪一项不可接受」，而不是追求每项都低。</p>
    ${c.costNote ? `<p class="note">${D(c.costNote)}</p>` : ''}
  </div>
</section>`);
  // 5 对比
  const optCards = c.comparison.options.map((o) => {
    const rows = c.comparison.dims.map((d, i) => `<div><dt>${esc(d)}</dt><dd>${esc(o.values[i])}</dd></div>`).join('');
    return `<div class="cmp-card">
      <h4>${esc(o.name)}</h4>
      ${o.solutionId ? `<a class="sid" href="${refHref(o.solutionId)}">${esc(o.solutionId)}</a>` : '<span class="sid">—</span>'}
      <dl>${rows}</dl>
      <div class="take">${D(o.take)}</div>
    </div>`;
  }).join('');
  sections.push(`<section class="screen" id="s5">
  <div class="label"><span class="idx">05</span><h2>方案对比</h2></div>
  <div class="body">
    <div class="cmp-head"><h3>${esc(c.comparison.title)}</h3></div>
    <div class="cmp-dims">${c.comparison.dims.map((d) => `<span>${esc(d)}</span>`).join('')}</div>
    <div class="cmp-grid">${optCards}</div>
    <p class="note">统一维度只用于比较取舍；没有「最好」的模型，只有在当前约束下可接受的错误。</p>
  </div>
</section>`);
  // 6 误区
  sections.push(`<section class="screen" id="s6">
  <div class="label"><span class="idx">06</span><h2>常见误区</h2></div>
  <div class="body">
    <div class="pitfalls">${c.pitfalls.map((p, i) => `<div class="pit"><div class="wrong"><b>误区 ${i + 1}</b>${D(p.wrong)}</div><div class="right"><b>正确理解</b>${D(p.right)}</div></div>`).join('')}</div>
  </div>
</section>`);
  // 7 动手
  sections.push(`<section class="screen" id="s7">
  <div class="label"><span class="idx">07</span><h2>动手复现</h2></div>
  <div class="body">
    ${c.practiceNote ? `<p class="practice-setup"><b>前提：</b>${D(c.practiceNote)}</p>` : ''}
    <div class="steps">${c.practice.map((s, i) => `<div class="step"><div class="do"><b>0${i + 1}</b>${D(s.do)}</div><div class="expect"><b>预期现象：</b>${D(s.expect)}</div></div>`).join('')}</div>
    <p class="practice-warn">步骤在编辑器内 5 步以内可复现；预期现象用来自检机制是否成立，不要求截图一致。</p>
  </div>
</section>`);
  // 8 自测
  sections.push(`<section class="screen" id="s8">
  <div class="label"><span class="idx">08</span><h2>自测</h2></div>
  <div class="body">
    <div class="quiz">${c.quiz.map((q, i) => {
      const refs = q.refs.map((r) => {
        const label = r.kind === 'solution' ? (entryById.get(r.id) || {}).name
          : r.kind === 'problem' ? (probById.get(r.id) || {}).title
            : r.kind === 'interview' ? (iqById.get(r.id) || {}).title
              : r.kind === 'comparison' ? ((cmpById.get(r.id) || {}).title || (cmpById.get(r.id) || {}).name || (cmpById.get(r.id) || {}).question) : r.id;
        return refChip(r.kind, r.id, label || r.id);
      }).join('');
      return `<div class="q"><div class="qt">${i + 1}. ${D(q.q)}</div><div class="qopts"><button type="button">显示解析</button></div>
      <div class="ans"><b>解析：</b>${D(q.answer)}<div class="refs">${refs}</div></div></div>`;
    }).join('')}</div>
    <details class="detail"><summary>展开：本章关联的速查条目</summary><div class="dbody">${(
      (c.refs.solutions || []).map((id) => refChip('solution', id, (entryById.get(id) || {}).name || id)).join(' ') + ' ' +
      (c.refs.problems || []).map((id) => refChip('problem', id, (probById.get(id) || {}).title || id)).join(' ') + ' ' +
      (c.refs.interviews || []).map((id) => refChip('interview', id, (iqById.get(id) || {}).title || id)).join(' ')
    )}</div></details>
  </div>
</section>`);
  return sections.join('\n');
}

const CH_TEMPLATE = fs.readFileSync(R('tools/chapter-template.html'), 'utf8');
const CHAPTER_RAIL = [
  ['s1', '01 场景'], ['s2', '02 直觉'], ['s3', '03 原理'], ['s4', '04 代价'],
  ['s5', '05 对比'], ['s6', '06 误区'], ['s7', '07 动手'], ['s8', '08 自测'],
];
for (const c of chapters) {
  const prev = chapters.find((x) => x.order === c.order - 1);
  const next = chapters.find((x) => x.order === c.order + 1);
  const pre = (c.prereqs || []).map((p) => (chById.get(p) || {}).shortTitle || p).join('、') || '无（可直接开始）';
  const entryLinks = [
    ...(c.refs.solutions || []).map((id) => refChip('solution', id, (entryById.get(id) || {}).name || id)),
    ...(c.refs.problems || []).map((id) => refChip('problem', id, (probById.get(id) || {}).title || id)),
    ...(c.refs.interviews || []).map((id) => refChip('interview', id, (iqById.get(id) || {}).title || id)),
    ...(c.refs.comparisonId ? [refChip('comparison', c.refs.comparisonId, (cmpById.get(c.refs.comparisonId) || {}).title || (cmpById.get(c.refs.comparisonId) || {}).name || (cmpById.get(c.refs.comparisonId) || {}).question || c.refs.comparisonId)] : []),
  ].join('');
  const nav = [
    prev ? `<a class="btn ghost" href="${esc(prev.id)}.html">← 上一章 · ${esc(prev.shortTitle)}</a>` : '',
    next ? `<a class="btn ghost" href="${esc(next.id)}.html">下一章 · ${esc(next.shortTitle)} →</a>` : '<a class="btn ghost" href="../index.html">回到路线图 →</a>',
  ].join('');
  const html = apply(CH_TEMPLATE, {
    TITLE: esc(c.title),
    DESC: esc(c.summary),
    ID: esc(c.id),
    STAGE: esc(STAGE_BY_ID[c.stage].label),
    ORDER: String(c.order).padStart(2, '0'),
    DURATION: String(c.durationMin),
    LEVEL: esc(c.level),
    PREREQ: esc(pre),
    SUMMARY: esc(c.summary),
    RAIL: CHAPTER_RAIL.map(([id, label], i) => `<a href="#${id}">${label}</a>${i === 7 ? '' : ''}`).join(''),
    BODY: renderChapterBody(c),
    ENTRY_LINKS: entryLinks,
    PREVNEXT: nav,
  });
  fs.writeFileSync(R(`learn/${c.id}.html`), html, 'utf8');
}

/* ---------------- 路线图首页：能力树 + 阶段 + 项目 + 方向 + 依赖 ---------------- */
const roadmapTpl = fs.readFileSync(R('tools/roadmap-template.html'), 'utf8');
const chAbilities = (cid) => (rm.abilities || []).filter((a) => (a.chapters || []).includes(cid));
const chBranches = (cid) => (rm.branches || []).filter((b) => (b.chapters || []).includes(cid)).map((b) => b.id);
const abLevelClass = (lv) => (lv === '掌握' ? 'lv-master' : lv === '理解' ? 'lv-understand' : 'lv-know');
const branchName = (id) => (branchById.get(id) || {}).name || id;

const nodeHtml = (c) => {
  const abs = chAbilities(c.id);
  const branches = chBranches(c.id);
  const preIds = c.prereqs || [];
  const preLabels = preIds.map((p) => (chById.get(p) || {}).shortTitle || p);
  const abLine = abs.slice(0, 3).map((a) => a.name).join('；') || '本章为后续章节提供前置概念';
  return `<div class="node" data-chapter-node="${esc(c.id)}" data-prereqs="${esc(preIds.join(','))}" data-prereq-labels="${esc(preLabels.join('|'))}" data-branches="${esc(branches.join(' '))}" data-abilities="${esc(abs.map((a) => a.id).join(' '))}">
    <div class="n-top"><i class="dot"></i><span class="learned" hidden>已学</span><button class="mark" type="button" data-roadmap-mark="${esc(c.id)}">标记已学</button></div>
    <a class="n-title" href="learn/${esc(c.id)}.html">${esc(c.shortTitle)}</a>
    <div class="n-meta"><span>约 ${c.durationMin} 分钟</span><span>${esc(c.level)}</span><span>${abs.length} 个能力项</span></div>
    <div class="n-enable"><b>这章能做什么</b><span>${esc(abLine)}</span></div>
    <div class="prereq">前置：${esc(preLabels.join('、') || '无')}</div>
    <div class="prereq-warn" hidden></div>
  </div>`;
};

const abilityChips = (ids) => ids.map((aid) => {
  const a = abById.get(aid);
  if (!a) return '';
  return `<div class="ability ${abLevelClass(a.level)}"><span class="lv">${esc(a.level)}</span><b>${esc(a.name)}</b><span class="ach">${a.chapters.map((cid) => esc((chById.get(cid) || {}).shortTitle || cid)).join(' / ')}</span></div>`;
}).join('');

const stageHtml = (st) => {
  const pj = projectById.get(st.projectId);
  const nodes = st.chapters.map((cid) => nodeHtml(chById.get(cid))).join('');
  return `<section class="stage-block" id="stage-${esc(st.id)}" data-stage="${esc(st.id)}">
    <header class="stage-head">
      <div class="stage-kicker">阶段 ${st.order} / ${(rm.stages || []).length}</div>
      <h2>${esc(st.name)}</h2>
      <p class="stage-goal">${esc(st.goal)}</p>
      <div class="stage-meta"><span>${esc(st.hours)}</span><span>${st.chapters.length} 章</span><span>${st.abilities.length} 个能力项</span></div>
      <div class="accept"><b>验收标准（可观测，不是「学完」）</b><ul>${st.acceptance.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    </header>
    <div class="ability-list">${abilityChips(st.abilities)}</div>
    <div class="node-grid">${nodes}</div>
    <div class="project-card">
      <div class="pj-kicker">阶段项目 · ${esc(pj.id)}</div>
      <h3>${esc(pj.name)}</h3>
      <p><b>交付物</b>${esc(pj.deliverable)}</p>
      <div class="pj-cols">
        <div><b>验收点</b><ul>${pj.acceptance.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
        <div class="pj-fail"><b>常见失败方式</b><ul>${pj.failures.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
      </div>
    </div>
  </section>`;
};
const stagesHtml = (rm.stages || []).slice().sort((a, b) => a.order - b.order).map(stageHtml).join('');

/* 前置依赖 SVG */
const stageOrdered = (rm.stages || []).slice().sort((a, b) => a.order - b.order);
const nodeW = 170, nodeH = 38, colStep = 240, rowStep = 66;
const pos = new Map();
stageOrdered.forEach((st, si) => {
  st.chapters.forEach((cid, ri) => {
    pos.set(cid, { x: 40 + si * colStep, y: 34 + ri * rowStep, si });
  });
});
const edgePaths = [];
for (const c of chapters) {
  for (const p of c.prereqs || []) {
    const a = pos.get(p), b = pos.get(c.id);
    if (!a || !b) continue;
    const d = a.si === b.si
      ? `M ${a.x + nodeW / 2} ${a.y + nodeH} C ${a.x + nodeW / 2} ${a.y + nodeH + 16}, ${b.x + nodeW / 2} ${b.y - 16}, ${b.x + nodeW / 2} ${b.y}`
      : `M ${a.x + nodeW} ${a.y + nodeH / 2} C ${a.x + nodeW + 34} ${a.y + nodeH / 2}, ${b.x - 34} ${b.y + nodeH / 2}, ${b.x} ${b.y + nodeH / 2}`;
    edgePaths.push(`<path class="edge" data-edge-from="${esc(p)}" data-edge-to="${esc(c.id)}" d="${d}" marker-end="url(#arrow)"/>`);
  }
}
const graphNodes = stageOrdered.map((st, si) => {
  const label = `<text class="gstage" x="${40 + si * colStep}" y="18">阶段 ${st.order}</text>`;
  const boxes = st.chapters.map((cid) => {
    const c = chById.get(cid);
    const p = pos.get(cid);
    return `<a href="learn/${esc(cid)}.html"><g class="gnode" data-graph-node="${esc(cid)}" data-branches="${esc(chBranches(cid).join(' '))}"><rect x="${p.x}" y="${p.y}" width="${nodeW}" height="${nodeH}" rx="8"/><text x="${p.x + nodeW / 2}" y="${p.y + 24}" text-anchor="middle">${esc(c.shortTitle)}</text></g></a>`;
  }).join('');
  return label + boxes;
}).join('');
const graphH = 34 + Math.max(...stageOrdered.map((s) => s.chapters.length)) * rowStep + 20;
const graphSvg = `<svg class="depgraph" viewBox="0 0 1240 ${graphH}" role="img" aria-label="章节前置依赖图：箭头表示必须先学">
  <defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="arrowhead"/></marker></defs>
  ${edgePaths.join('')}
  ${graphNodes}
</svg>`;

const prereqHtml = (rm.prereqNotes || []).map((n) => `<div class="pnote" data-prereq-from="${esc(n.from)}" data-prereq-to="${esc(n.to)}">
  <div class="pnote-head"><b>${esc((chById.get(n.from) || {}).shortTitle || n.from)}</b><span class="arrow">→</span><b>${esc((chById.get(n.to) || {}).shortTitle || n.to)}</b><span class="kind">${n.kind === 'must' ? '必须先学' : '可并行'}</span></div>
  <p>${esc(n.skipCost)}</p>
</div>`).join('');
const parallelHtml = (rm.parallelGroups || []).map((g) => `<div class="parallel"><b>阶段 ${(stageById.get(g.stageId) || {}).order || '?'} 可并行</b><span>${g.chapters.map((cid) => esc((chById.get(cid) || {}).shortTitle || cid)).join(' / ')}</span><p>${esc(g.note)}</p></div>`).join('');

const branchInfoHtml = (rm.branches || []).map((b) => `<div class="branch-info" data-branch-info="${esc(b.id)}" hidden>
  <div class="bi-head"><b>${esc(b.name)}</b><span>${esc(b.short)}</span></div>
  <p><b>与主线的差异</b>${esc(b.mainDiff)}</p>
  <p><b>重点</b>${esc(b.focus)}</p>
  <p><b>额外缺口</b>${b.extraGaps.map((gid) => esc((rm.gaps.find((g) => g.id === gid) || {}).name || gid)).join('、')}</p>
</div>`).join('');

const gapsHtml = (rm.gaps || []).map((g, i) => `<div class="gap-card">
  <div class="gap-kicker">待补 ${String(i + 1).padStart(2, '0')}</div>
  <h3>${esc(g.name)}</h3>
  <p>${esc(g.why)}</p>
  <div class="gap-tags">${(g.neededBy || []).map((bid) => `<span>${esc(branchName(bid))}</span>`).join('')}</div>
</div>`).join('');

const first = chapters.slice().sort((a, b) => a.order - b.order)[0];
const roadmapHtml = apply(roadmapTpl, {
  FIRST_ID: first ? first.id : 'render-basics',
  BRANCH_FILTERS: (rm.branches || []).map((b) => `<button class="branchbtn" type="button" data-branch-filter="${esc(b.id)}">${esc(b.name)}</button>`).join(''),
  BRANCH_INFO: branchInfoHtml,
  STAGES: stagesHtml,
    DEPGRAPH: graphSvg,
  PREREQ: prereqHtml,
  PARALLEL: parallelHtml,
  GAPS: gapsHtml,
  STATS: esc(`${(rm.abilities || []).length} 个能力项 · ${(rm.stages || []).length} 个阶段 · ${(rm.projects || []).length} 个项目演练 · ${(rm.branches || []).length} 条方向分支 · ${(rm.gaps || []).length} 个待补缺口`),
  AUDIT: esc(`审核 ${issueCounts.BLOCKER} BLOCKER / ${issueCounts.MAJOR} MAJOR / ${issueCounts.MINOR} MINOR，已修 ${fixedCounts.BLOCKER + fixedCounts.MAJOR} 条 BLOCKER+MAJOR`),
});
fs.writeFileSync(R('index.html'), roadmapHtml, 'utf8');

/* ---------------- 内容审核报告页 ---------------- */
const auditTpl = fs.readFileSync(R('tools/audit-template.html'), 'utf8');
const dimName = (id) => (learningAudit.meta.dimensions.find((d) => d.id === id) || {}).name || id;
const auditScoresHtml = (learningAudit.chapters || []).map((a, i) => {
  const c = chById.get(a.id) || {};
  const chips = AUDIT_DIMS.map((d) => `<div class="score ${a.scores[d] <= 3 ? 'low' : a.scores[d] >= 5 ? 'high' : ''}"><span>${esc(dimName(d))}</span><b>${a.scores[d]}</b></div>`).join('');
  return `<article class="audit-card">
    <header><h3>${String(i + 1).padStart(2, '0')} · ${esc(c.title || a.title)}</h3><span class="mono">${esc(a.id)}</span></header>
    <div class="scoregrid">${chips}</div>
    <details class="detail"><summary>展开：逐维证据</summary><div class="dbody"><dl>${AUDIT_DIMS.map((d) => `<dt>${esc(dimName(d))} · ${a.scores[d]}/5</dt><dd>${esc(a.evidence[d])}</dd>`).join('')}</dl></div></details>
  </article>`;
}).join('');
const auditIssuesHtml = SEVERITIES.map((sev) => {
  const list = (learningAudit.issues || []).filter((it) => it.severity === sev);
  return `<div class="sevgroup" data-sev-group="${sev}"><h3><span class="sev ${sev.toLowerCase()}">${sev}</span> ${list.length} 条</h3>${list.map((it) => `<article class="issue" data-sev="${sev}">
    <div class="issue-head"><span class="mono">${esc(it.id)}</span><span>${esc(it.chapter)} · ${esc(it.location)}</span><span class="fixed ${it.fixed ? '' : 'open'}">${it.fixed ? '已修' : '未修（MINOR 清单）'}</span></div>
    <p><b>问题</b>${esc(it.problem)}</p>
    <p><b>为什么是问题</b>${esc(it.why)}</p>
    <p><b>改法</b>${esc(it.fix)}</p>
    <p class="dim">维度：${esc(dimName(it.dimension))}</p>
  </article>`).join('')}</div>`;
}).join('');
const auditHtml = apply(auditTpl, {
  SUMMARY: esc(`共审 ${learningAudit.chapters.length} 章 × ${AUDIT_DIMS.length} 维；平均 ${avgScore}/5。BLOCKER ${issueCounts.BLOCKER} 条（已修 ${fixedCounts.BLOCKER}）、MAJOR ${issueCounts.MAJOR} 条（已修 ${fixedCounts.MAJOR}）、MINOR ${issueCounts.MINOR} 条（已修 ${fixedCounts.MINOR}、列出 ${issueCounts.MINOR - fixedCounts.MINOR}）。`),
  STATS: `<div class="astat"><b>${issueCounts.BLOCKER}</b><span>BLOCKER<br>已修 ${fixedCounts.BLOCKER}</span></div><div class="astat"><b>${issueCounts.MAJOR}</b><span>MAJOR<br>已修 ${fixedCounts.MAJOR}</span></div><div class="astat"><b>${issueCounts.MINOR}</b><span>MINOR<br>已修 ${fixedCounts.MINOR}</span></div><div class="astat"><b>${avgScore}</b><span>平均分<br>满分 5</span></div>`,
  SCORES: auditScoresHtml,
  ISSUES: auditIssuesHtml,
  DATE: esc(learningAudit.meta.generated),
  SCOPE: esc(learningAudit.meta.scope),
  STANDARD: esc(learningAudit.meta.standard),
});
fs.writeFileSync(R('reference/audit.html'), auditHtml, 'utf8');

/* ---------------- 速查区：复用原 SPA ---------------- */
const dataJs = '/* 自动生成：速查库完整数据。仅供 reference/ 页面加载，避免 fetch 在 file:// 下失败。 */\nwindow.UE_DATA=' + payload + ';\n';
fs.writeFileSync(R('assets/data.js'), dataJs, 'utf8');

const styleM = template.match(/<style>([\s\S]*?)<\/style>/);
if (!styleM) err('tools/template.html 未找到 <style> 块');
else fs.writeFileSync(R('assets/catalog.css'), styleM[1], 'utf8');
const jsM = template.match(/<script>\s*(\(function\(\)\{[\s\S]*?\}\)\(\);)\s*<\/script>/);
if (!jsM) err('tools/template.html 未找到主脚本块');
if (!template.includes('__APP_DATA__')) err('tools/template.html 缺少 __APP_DATA__ 占位符');
if (styleM && jsM && template.includes('__APP_DATA__')) {
  let catJs = jsM[1];
  catJs = catJs.replace("const D = JSON.parse(document.getElementById('app-data').textContent);", 'const D = window.UE_DATA;');
  catJs = catJs.replace('src="${esc(p.image)}"', 'src="${esc(p.image && p.image.indexOf(\'research/\')===0 ? \'../\'+p.image : p.image)}"');
  const restore =
`function restoreFromHash(){
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
`;
  const marker = '/* ---------- 渲染入口 ---------- */';
  if (catJs.includes(marker)) catJs = catJs.replace(marker, restore + marker);
  else err('catalog 脚本缺少渲染入口标记');
  const lastRender = catJs.lastIndexOf('render();');
  if (lastRender > 0) catJs = catJs.slice(0, lastRender) + 'render();\nrestoreFromHash();' + catJs.slice(lastRender + 'render();'.length);
  else err('catalog 脚本缺少 render() 入口');
  fs.writeFileSync(R('assets/catalog.js'), catJs, 'utf8');

  let catHtml = template
    .replace(/<title>[\s\S]*?<\/title>/, '<title>速查库 · UE 技术方案情报库</title>')
    .replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="../assets/catalog.css">')
    .replace(/<script id="app-data"[\s\S]*?<\/script>/, '<script src="../assets/data.js"></script>')
    .replace(/<script>\s*\(function\(\)\{[\s\S]*?\}\)\(\);\s*<\/script>/, '<script src="../assets/catalog.js"></script>');
  catHtml = catHtml.replace('<div class="searchbox">', '<a href="../index.html" style="color:var(--dim);font-size:12px;white-space:nowrap;text-decoration:none;flex:none">← 学习路线</a><div class="searchbox">');
  fs.writeFileSync(R('reference/catalog.html'), catHtml, 'utf8');
}

/* 速查区入口页 */
const refTpl = fs.readFileSync(R('tools/reference-hub-template.html'), 'utf8');
const cards = [
  ['方案库', 'solutions', `${stats.solutions} 条`, '按类型/知识域/难度筛选；含约束卡、复现步骤与来源等级。'],
  ['问题库', 'problems', `${stats.problems} 条`, '从症状出发，给候选方案与验证度量。'],
  ['面试题库', 'interview', `${stats.interview} 题`, '参考答案、常见答错点、追问链；标注审核结论与溯源。'],
  ['对比视图', 'compare', `${stats.comparisons} 组`, '统一维度看取舍，不做排行榜。'],
  ['技术专题', 'topics', `${stats.topics} 个`, '专题目标、依赖关系与关联方案。'],
  ['技术演进', 'timeline', `${stats.timelineNodes} 个节点`, '按版本梳理机制变化，避免用过时结论。'],
  ['插件', 'plugins', `${stats.plugins} 个`, '兼容版本、授权与推荐度。'],
  ['来源 / 站点', 'sources', `${stats.sources} 条`, 'A/B/C 来源等级、访问日期与站点可用性。'],
  ['整合审核报告', 'audit', `PASS ${stats.interviewPass} / MERGE ${stats.interviewMerge} / REJECT ${stats.interviewReject}`, '逐条判断与拒绝理由，可复核。'],
  ['内容审核报告', 'audit.html', `${stats.auditBlockers} BLOCKER / ${stats.auditMajors} MAJOR / ${stats.auditMinors} MINOR`, '18 章 × 7 维评分、逐条证据与修复状态；未修的 MINOR 也在清单里。'],
];
const refCards = cards.map(([name, sec, n, desc]) => {
  const href = sec.endsWith('.html') ? sec : `catalog.html#${sec}`;
  return `<a class="ref-card" href="${href}"><b>${esc(name)}</b><span class="n">${esc(n)}</span><span>${esc(desc)}</span></a>`;
}).join('');
const refHtml = apply(refTpl, {
  STATS: esc(`方案 ${stats.solutions} · 问题 ${stats.problems} · 面试题 ${stats.interview}（PASS ${stats.interviewPass} / MERGE ${stats.interviewMerge} / REJECT ${stats.interviewReject}） · 专题 ${stats.topics} · 对比 ${stats.comparisons} · 来源 ${stats.sources} · 插件 ${stats.plugins}`),
  CARDS: refCards,
});
fs.writeFileSync(R('reference/index.html'), refHtml, 'utf8');

console.log('=== 构建统计 ===');
console.log(JSON.stringify(stats, null, 1));
console.log(`\n来源：${stats.sources}（A ${stats.sourcesByGrade.A} / B ${stats.sourcesByGrade.B} / C ${stats.sourcesByGrade.C}）`);
console.log(`方案：${stats.solutions}（额外发现 ${stats.extraSolutions}）`);
console.log(`章节：${chapters.length} · 图解类型：${stats.diagramTypes}`);
const kb = (p) => (fs.existsSync(R(p)) ? (fs.statSync(R(p)).size / 1024).toFixed(0) + ' KB' : '未生成');
console.log(`产物：research/data.json ${kb('research/data.json')} · index.html ${kb('index.html')} · assets/data.js ${kb('assets/data.js')} · learn 页 ${chapters.length} · reference 页 2`);
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条：`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.error(`\n错误 ${errors.length} 条：`);
  errors.forEach((e) => console.error('  x ' + e));
  process.exit(1);
}
console.log('\n构建完成：index.html + learn/*.html + reference/*.html');
