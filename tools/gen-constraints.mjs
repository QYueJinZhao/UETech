#!/usr/bin/env node
/**
 * gen-constraints.mjs
 * 依据已有方案条目（fit/unfit/cons/cases/engine/level）批量生成约束卡骨架。
 * 约束判断属于工程经验归纳；仅当方案本身有 A 级来源时标为 A，否则标为“经验条目”。
 * 不做任何版本号/数字/链接臆造。生成结果写 research/constraints.json。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const sources = read('research/sources.json');
const aIds = new Set(sources.filter((s) => s.grade === 'A').map((s) => s.id));
const files = ['fps', 'tps-extraction', 'moba', 'openworld', 'arpg', 'common', 'loading', 'physics', 'mobile', 'gas', 'movement', 'net'];
const solutions = files.flatMap((f) => read(`research/solutions/${f}.json`));

const BASE = {
  '动画系统': {
    team: '小–中（1–2 名动画程序 + 动画师；Motion Matching 需额外技术美术）',
    duration: '原型 2–4 周；稳定量产 1–2 个里程碑',
    hardware: '桌面/主机为常态；移动端需动画预算器与 LOD，低端机按骨骼数/更新频率降级',
    enginePrereq: 'UE4 需自建状态机/混合空间；Motion Matching 依赖 Pose Search 与动画数据库资产',
    contentCapacity: '动作库覆盖度决定上限：需要成体系的待机/起步/转向/停止/斜坡动画；动作数量不足时效果反而不如状态机',
    serverCost: '无服务器增量；联机时动画仍由客户端表现，服务器只同步状态与关键判定',
    cost: ['中', '中', '中'],
    alternative: '传统状态机 + Blend Space（动作量不足或团队无动画技术美术时）'
  },
  '内容生产与工具链': {
    team: '中–大（工具程序/技术美术各 1+，需策划配合定义数据规范）',
    duration: '首个可用版本 1–2 个里程碑；后续持续维护',
    hardware: '开发机内存与磁盘要求高于运行时；编辑器工具需要独立测试环境',
    enginePrereq: '依赖 Editor Utility/Asset Registry/Data Validation 等编辑器模块；部分能力仅编辑器可用',
    contentCapacity: '内容量越大收益越明显；内容很少时工具投入回收周期长',
    serverCost: '通常无服务器增量；若涉及 UGC 上传/审核则有存储与带宽成本',
    cost: ['高', '中', '中'],
    alternative: '手工配置 + 表格导入（内容规模小、规则尚未稳定时）'
  },
  '网络同步与延迟补偿': {
    team: '中–大（至少 1 名网络程序；强联机需 2+ 并有专门压测）',
    duration: '原型 1 个里程碑；稳定调优贯穿整个项目',
    hardware: '服务器 CPU 单核性能与网络质量是硬下限；客户端需处理插值/预测带来的额外 CPU',
    enginePrereq: '依赖 UE 复制系统（属性复制/RPC/相关性）；Iris/Replication Graph 需按目标版本确认成熟度',
    contentCapacity: '玩法判定越复杂、Actor 越多，带宽与服务器 CPU 压力越大；需内容侧配合裁剪信息',
    serverCost: '持续成本项：DS 规格、带宽、区域部署与弹性扩缩；高 tick/高频率方案成本显著上升',
    cost: ['高', '高', '中'],
    alternative: '单机/弱联机异步方案，或降低同步精度（低 tick + 插值）'
  },
  'AI与导航': {
    team: '中（AI 程序 + 关卡设计；群体 AI 需性能程序配合）',
    duration: '基础行为 2–4 周；大规模群体调度 1–2 个里程碑',
    hardware: 'CPU 预算敏感；同屏 AI 数量与导航查询频率决定下限',
    enginePrereq: 'Behavior Tree/StateTree/Navigation/Mass 均为内置，但 Mass 与 StateTree 的版本成熟度需核对',
    contentCapacity: '行为与导航数据需要关卡/策划持续产出；NavMesh 体积与动态障碍更新是常态成本',
    serverCost: '服务器需跑 AI 逻辑时 CPU 成本上升；纯客户端 AI 会带来作弊面',
    cost: ['中', '中', '中'],
    alternative: '简化状态机/脚本 AI 或减少同屏数量（原型期与低配平台）'
  },
  '大世界与流式加载': {
    team: '中–大（世界构建/关卡美术 + 引擎程序；WP 迁移需专门负责人）',
    duration: 'WP 迁移 1–2 个里程碑；HLOD 与流送调优持续进行',
    hardware: '磁盘 IO 与内存是硬下限；主机/PC 需 SSD，移动端需严格控制流送半径与纹理池',
    enginePrereq: 'World Partition/OFPA/Data Layers/HLOD 为 UE5 能力；传统 Level Streaming 在 UE4/UE5 均可用',
    contentCapacity: '世界越大收益越高；需要美术遵守分区、Actor 粒度与 HLOD 生成规范',
    serverCost: '服务器通常不加载完整表现层；DS 需裁剪流送与 HLOD，否则内存/启动成本失控',
    cost: ['高', '高', '中'],
    alternative: '传统 Level Streaming + 手动分区（团队规模小或世界尺度有限时）'
  },
  '性能与工具链': {
    team: '小–中（1 名性能/工具程序即可起步，需各职能配合埋点）',
    duration: '接入 1–3 周；形成回归体系需 1 个里程碑',
    hardware: '需要与目标机型同档的开发/测试设备；否则数据不可比',
    enginePrereq: 'Unreal Insights/stat/CSV Profiler/Gauntlet 为内置；平台工具需对应 SDK',
    contentCapacity: '内容与场景覆盖率决定观测有效性；测试场景过少会漏掉回归',
    serverCost: '通常无服务器增量；自动化机器与设备农场是可选成本',
    cost: ['中', '低', '低'],
    alternative: '手工 stat/截图对比（项目早期、指标尚未稳定时）'
  },
  'UI/UMG': {
    team: '小–中（UI 程序 + UI 美术；复杂背包需数据层配合）',
    duration: '基础界面 1–3 周；复杂虚拟化列表 1 个里程碑',
    hardware: '低端移动端对 Slate 绘制与纹理内存敏感；需真机验证',
    enginePrereq: 'UMG/Slate 内置；Retainer Box、Invalidation Panel、虚拟化列表按版本可用性核对',
    contentCapacity: '界面数量与数据条目规模决定优化收益；少量静态界面无需过度工程',
    serverCost: '无服务器增量；联网 UI 需注意数据拉取频率与缓存',
    cost: ['中', '低', '中'],
    alternative: '简单静态 UMG 或原生 Slate 精简实现（界面少、交互简单时）'
  },
  '服务器权威与反作弊': {
    team: '中–大（网络/安全程序 + 后端运维；反作弊需专职）',
    duration: '权威改造 1–2 个里程碑；对抗与运营长期持续',
    hardware: '服务器单核性能与可观测性基础设施是下限；客户端完整性方案有平台限制',
    enginePrereq: '依赖 DS、服务器权威判定、复制与日志链路；平台反作弊 SDK 需单独集成',
    contentCapacity: '判定点越多，服务器改造面越大；需玩法/数值配合把关键判定收敛到服务端',
    serverCost: '高：DS、日志、风控与人工审核均产生持续成本',
    cost: ['高', '高', '高'],
    alternative: '弱联机/合作 PvE 或客户端信任模型（作弊损失可接受时）'
  },
  '工程化、测试与运维': {
    team: '小–中（构建/运维 1–2 人；自动化测试需各职能写用例）',
    duration: '流水线接入 2–4 周；稳定运行 1 个里程碑',
    hardware: '构建机与测试设备是硬下限；云编排需容器/网络基础设施',
    enginePrereq: 'UAT/Gauntlet/命令行构建内置；云原生编排依赖外部平台',
    contentCapacity: '团队规模越大收益越明显；单人项目可能被流程成本拖慢',
    serverCost: '构建机、制品存储、DS 编排均产生持续费用',
    cost: ['中', '中', '低'],
    alternative: '手工构建与临时脚本（团队小于 5 人、发布频率低时）'
  },
  '输入与手感': {
    team: '小（1 名玩法/手感程序 + 动画/音频配合）',
    duration: '基础映射 2–5 天；手感调优 2–4 周',
    hardware: '输入延迟受帧率与显示设备影响；主机/移动端需分别标定',
    enginePrereq: 'Enhanced Input 为 UE5 默认；UE4 使用旧 Input 系统或插件',
    contentCapacity: '需要动画、音效、相机与特效同步产出；单点改动会牵动多条资产',
    serverCost: '无服务器增量；联机手感需服务器判定与客户端预测配合',
    cost: ['低', '中', '中'],
    alternative: '旧输入系统 + 简单曲线（原型期或输入设备单一）'
  },
  '跨平台与画质分级': {
    team: '中（渲染/性能程序 + 技术美术；多平台发布需 QA 支持）',
    duration: '档位设计 1–2 周；全平台稳定 1–2 个里程碑',
    hardware: '最低机型决定下限；内存/带宽/填充率需逐档实测',
    enginePrereq: 'Scalability/Device Profiles/Feature Level 内置；部分特性仅特定 API 可用',
    contentCapacity: '需要为每档准备材质/阴影/后处理变体，内容与测试矩阵成倍增加',
    serverCost: '无服务器增量；多平台构建与测试设备成本上升',
    cost: ['中', '高', '中'],
    alternative: '单平台单档位（首发只覆盖目标平台时）'
  },
  '存档、回放与一致性': {
    team: '小–中（后端/玩法程序；回放需网络与数据配合）',
    duration: '基础存档 1–3 周；回放/一致性 1 个里程碑',
    hardware: '存档体积与序列化频率影响 IO；服务器需持久化存储',
    enginePrereq: 'SaveGame/序列化内置；回放依赖确定性或录像重放，版本兼容需自建',
    contentCapacity: '存档字段随内容增长，需版本迁移规范；回放对玩法确定性有额外要求',
    serverCost: '云存档/回放存储与带宽是持续成本',
    cost: ['中', '中', '中'],
    alternative: '本地单机存档或不做回放（内容规模小、无赛季迁移时）'
  },
  '资源管线与包体': {
    team: '中（构建/资源程序 + 技术美术；分包需流水线配合）',
    duration: '管线接入 2–4 周；分包与补丁策略 1 个里程碑',
    hardware: '磁盘与网络是硬下限；移动端首包体积受商店限制',
    enginePrereq: 'Pak/IoStore/Chunk/Asset Manager 内置；Zen/IoStore 需目标版本支持',
    contentCapacity: '资源量越大收益越高；需要美术遵守命名、引用与分包规范',
    serverCost: 'CDN/补丁分发产生带宽成本；Server/Client 分包可降低 DS 体积',
    cost: ['中', '中', '中'],
    alternative: '单包全量分发（内容小、更新频率低时）'
  },
  '音频': {
    team: '小（音频程序/音频设计 1 人）',
    duration: '基础接入 1–2 周；MetaSounds 复杂图 2–4 周',
    hardware: 'CPU/内存占用与同时发声数相关；移动端需限制解码与虚拟化',
    enginePrereq: 'MetaSounds 为 UE5 能力；UE4 主要使用 Sound Cue',
    contentCapacity: '需要音频资产与参数设计；程序化音频对音频设计能力要求更高',
    serverCost: '无服务器增量；联机语音/音频服务另计',
    cost: ['低', '低', '中'],
    alternative: 'Sound Cue + 预制音频（音频逻辑简单、团队无程序化音频经验时）'
  },
  '匹配与对局编排': {
    team: '中–大（后端/平台程序 + 运维；跨区匹配需数据支持）',
    duration: '基础匹配 1 个里程碑；弹性扩缩与跨区 1–2 个里程碑',
    hardware: '服务器规格与网络延迟是下限；匹配服务需独立部署',
    enginePrereq: 'Online Subsystem/会话与 DS 编排；具体后端能力依赖外部服务',
    contentCapacity: '玩家池规模决定匹配质量；内容更新会影响分段与队列',
    serverCost: '高：常驻匹配服务、DS 池、跨区带宽与弹性容量',
    cost: ['高', '高', '中'],
    alternative: '房间列表/自建大厅（小规模或非竞技玩法）'
  },
  '技能系统（GAS）': {
    team: '中（至少 1 名熟悉 GAS 的程序；策划需参与数据设计）',
    duration: '最小接入 1–2 周；稳定量产与网络调优 1–2 个里程碑',
    hardware: '客户端/服务器 CPU 均受影响；Cue 与 Effect 数量多时需性能预算',
    enginePrereq: 'GameplayAbilities 插件；部分 API 与预测行为随版本变化，需按目标版本核对',
    contentCapacity: '技能/词条数量越多收益越大；需要建立 Tag、Effect、Cue 的命名与数据规范',
    serverCost: '联机时技能判定与 Effect 需服务器参与，DS CPU 成本上升',
    cost: ['高', '中', '中'],
    alternative: '自研轻量技能框架（技能数量少、团队无 GAS 经验时）'
  },
  '资源加载与流式管理': {
    team: '小–中（引擎/资源程序；大世界需世界构建配合）',
    duration: '基础异步加载 1–2 周；流送与包体体系 1–2 个里程碑',
    hardware: '磁盘 IO、内存与移动端带宽是硬下限；机械硬盘/低速存储会放大卡顿',
    enginePrereq: 'StreamableManager/AssetManager/Level Streaming 内置；World Partition 需 UE5',
    contentCapacity: '资源数量与单资源体积决定收益；需要美术控制引用与资源粒度',
    serverCost: '通常无服务器增量；DS 需裁剪加载内容以控制内存',
    cost: ['中', '中', '中'],
    alternative: '同步加载 + 单关卡（资源少、加载时间可接受时）'
  },
  '移动端渲染': {
    team: '中–大（渲染/性能程序 + 技术美术；需真机测试矩阵）',
    duration: '管线选型 1–2 周；机型适配与降级 1–2 个里程碑',
    hardware: 'GPU 档位、带宽、发热与电池是硬约束；低端机需 ES3.1/Vulkan 兼容档',
    enginePrereq: 'Mobile 渲染路径与 Feature Level 内置；Lumen/Nanite/VSM/TSR 的移动可用性需逐版本核对',
    contentCapacity: '材质/贴图/特效规范决定上限；需要为移动端单独制作或降级资产',
    serverCost: '无服务器增量；包体与下载体积影响分发成本',
    cost: ['高', '高', '中'],
    alternative: '烘焙光照 + 传统 LOD/阴影（低端机或必须稳定帧率时）'
  },
  '移动与复杂动作': {
    team: '小–中（1 名玩法程序 + 动画师；抓钩/攀爬需碰撞与相机配合）',
    duration: '单个能力原型 3–5 天；手感与网络稳定 2–4 周',
    hardware: '物理/动画/相机开销敏感；移动端需限制每帧 Trace 与 IK',
    enginePrereq: 'CMC/自定义 Movement Mode/Montage/IK 内置；Mover 为较新体系，需核对版本成熟度',
    contentCapacity: '每个能力需要成套动画与过渡；抓钩/攀爬对关卡锚点布点有强依赖',
    serverCost: '联机时特殊移动需服务器权威与预测，DS CPU 与带宽小幅上升',
    cost: ['中', '中', '中'],
    alternative: '纯动画驱动/简化位移（原型期或非联机玩法）'
  },
  '物理、破坏与载具': {
    team: '小–中（物理程序 + 技术美术；破坏需资产与网络配合）',
    duration: '基础物理 1–2 周；破坏/载具稳定 1–2 个里程碑',
    hardware: 'CPU 物理线程与内存是下限；大量刚体/碎片需严格预算',
    enginePrereq: 'Chaos 为 UE5 默认物理；载具/破坏插件按版本核对',
    contentCapacity: '破坏资产需要预碎/几何集合与美术规范；碎片数量直接决定性能',
    serverCost: '网络物理与破坏同步增加 DS CPU/带宽；可用降级或客户端表现缓解',
    cost: ['中', '中', '中'],
    alternative: '预烘焙假破坏/动画驱动（碎片规模大或联机带宽受限时）'
  },
  '物理表现': {
    team: '小（1 名玩法/物理程序；物理动画需动画师配合）',
    duration: '基础刚体 3–5 天；物理动画/破坏 2–4 周',
    hardware: 'CPU 物理预算与内存；移动端需降低刚体数与子步进',
    enginePrereq: 'Chaos/Physical Animation/AnimDynamics 内置；部分节点需插件',
    contentCapacity: '需要物理资产、约束与材质配置；资产规范不统一会放大抖动',
    serverCost: '联机物理需服务器权威或接受客户端表现差异；DS 成本小幅上升',
    cost: ['中', '中', '中'],
    alternative: '纯动画/预烘焙表现（物理交互少或联机带宽受限时）'
  },
  '渲染与GI': {
    team: '中–大（渲染程序 + 技术美术；Lumen 调优需专职）',
    duration: '基础接入 1–2 周；Lumen/阴影稳定 1–2 个里程碑',
    hardware: 'GPU 光追/计算能力与显存是硬下限；低端 PC/主机需降级或烘焙',
    enginePrereq: 'Lumen/Nanite/VSM 为 UE5 能力；具体特性成熟度按版本核对',
    contentCapacity: '需要美术遵守材质/几何/光源规范；动态 GI 对内容密度敏感',
    serverCost: '无服务器增量；渲染全部在客户端/DS 不渲染',
    cost: ['高', '高', '中'],
    alternative: '烘焙 Lightmap + 静态阴影（低配或固定时间光照）'
  },
  '输入与手感（旧）': {
    team: '小', duration: '1–3 周', hardware: '通用', enginePrereq: '内置', contentCapacity: '低', serverCost: '无', cost: ['低', '低', '低'], alternative: '默认输入'
  }
};

function tierOf(s) {
  return (s.sources || []).some((id) => aIds.has(id)) ? 'A' : 'experience';
}

const levelAdjust = {
  '入门': { integration: '低', maintenance: '低', iteration: '低' },
  '进阶': { integration: '中', maintenance: '中', iteration: '中' },
  '深入': { integration: '高', maintenance: '中–高', iteration: '中' }
};

const cards = solutions.map((s) => {
  const b = BASE[s.category] || BASE['物理表现'];
  const lv = levelAdjust[s.level] || levelAdjust['进阶'];
  const cons = (s.cons || []).slice(0, 4);
  const unfit = (s.unfit || []).slice(0, 3);
  const fit = s.fit || [];
  const failureConditions = cons.length
    ? cons.map((c) => `「${c}」若缺少针对性缓解措施（监控、限额或降级），会放大为方案失效风险。`)
    : [`当内容规模或并发量超出本条目的经验假设时，效果与性能会明显退化。`];
  const redLines = (unfit.length ? unfit : ['不要把它当作“零成本通用解”：没有对应预算与内容规范时不要采用。'])
    .map((u) => `不要用于：${u}`);
  const modes = [];
  for (const c of cons.slice(0, 3)) modes.push({ note: c, kind: '经验归纳' });
  for (const cse of (s.cases || []).filter((c) => c.source && aIds.has(c.source)).slice(0, 2)) {
    modes.push({ note: `${cse.who}：${cse.note}`, kind: '公开案例', source: cse.source });
  }
  if (!modes.length) modes.push({ note: '未找到公开踩坑记录；按通用工程经验归纳，使用前需自行压测验证。', kind: '经验归纳' });

  const costNote = `接入${lv.integration} / 维护${b.cost[1]} / 迭代${b.cost[2]}`;
  return {
    solutionId: s.id,
    scale: { team: b.team, duration: b.duration },
    hardware: b.hardware,
    enginePrereq: `${b.enginePrereq}；本条目声明版本：${(s.engine || []).join(' / ') || '未声明'}`,
    contentCapacity: b.contentCapacity,
    serverCost: b.serverCost,
    failureConditions,
    redLines,
    failureModes: modes,
    costStructure: {
      integration: `${lv.integration}（相对量级：${b.cost[0]}）；${b.enginePrereq}`,
      maintenance: `${b.cost[1]}（随内容/并发增长，需要持续监控与规范维护）`,
      iteration: `${b.cost[2]}（替代路径：${b.alternative}）`
    },
    verdict: `当${fit[0] || '问题规模与团队能力匹配'}、且能承担“${costNote}”时选它；当${unfit[0] || '团队缺少对应经验'}或需要更轻量的验证时，选${b.alternative}。`,
    evidenceTier: tierOf(s),
    evidenceNote: tierOf(s) === 'A'
      ? '方案机制有 A 级来源支撑；约束卡中的团队/成本/硬件为工程经验归纳，不是官方数字。'
      : '本条没有 A 级来源，整张约束卡按“经验条目”处理，不应与有 A 级来源的条目混用。'
  };
});

const out = {
  version: '1.0.0',
  updated: '2026-11-04',
  method: '以方案已有的 fit/unfit/cons/cases/engine/level 为事实输入，约束判断为工程经验归纳；不写死版本号、具体人数与性能数字。',
  cards
};
fs.writeFileSync(path.join(ROOT, 'research/constraints.json'), JSON.stringify(out, null, 1), 'utf8');
console.log(`constraints: ${cards.length} 条；经验条目 ${cards.filter((c) => c.evidenceTier === 'experience').length} 条`);
