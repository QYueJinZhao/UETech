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

fs.writeFileSync(R('research/data.json'), JSON.stringify(DATA, null, 1), 'utf8');

/* ---------------- 生成 HTML ---------------- */
const payload = JSON.stringify(DATA).replace(/</g, '\\u003c');
const template = fs.readFileSync(R('tools/template.html'), 'utf8');
if (!template.includes('__APP_DATA__')) {
  err('tools/template.html 缺少 __APP_DATA__ 占位符');
} else {
  const html = template.split('__APP_DATA__').join(payload);
  fs.writeFileSync(R('index.html'), html, 'utf8');
}

console.log('=== 构建统计 ===');
console.log(JSON.stringify(stats, null, 1));
console.log(`\n来源：${stats.sources}（A ${stats.sourcesByGrade.A} / B ${stats.sourcesByGrade.B} / C ${stats.sourcesByGrade.C}）`);
console.log(`方案：${stats.solutions}（额外发现 ${stats.extraSolutions}）`);
console.log(`产物：research/data.json ${(fs.statSync(R('research/data.json')).size / 1024).toFixed(0)} KB；index.html ${fs.existsSync(R('index.html')) ? (fs.statSync(R('index.html')).size / 1024).toFixed(0) + ' KB' : '未生成'}`);
if (warnings.length) {
  console.log(`\n警告 ${warnings.length} 条：`);
  warnings.forEach((w) => console.log('  - ' + w));
}
if (errors.length) {
  console.error(`\n错误 ${errors.length} 条：`);
  errors.forEach((e) => console.error('  x ' + e));
  process.exit(1);
}
console.log('\n构建完成：index.html');
