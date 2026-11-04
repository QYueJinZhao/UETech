/* 交互图解组件库。每种图解都能用滑块/按钮改变关键参数，用图形解释机制。
   所有图均为「示意，非线性真实实现」；数值只表达相对量级。 */
(function () {
  'use strict';
  var A = 'var(--accent)', AM = 'var(--amber)', M = 'var(--muted)', L = 'var(--line)',
      L2 = 'var(--line-2)', INK = 'var(--ink)', INK2 = 'var(--ink-2)',
      PAPER = 'var(--paper)', PAPER2 = 'var(--paper-2)', OK = 'var(--ok)', BAD = 'var(--bad)';
  var FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function txt(x, y, s, o) {
    o = o || {};
    return '<text x="' + x + '" y="' + y + '" font-family="' + FONT + '" font-size="' + (o.size || 11) +
      '" fill="' + (o.fill || M) + '" font-weight="' + (o.weight || 400) + '" text-anchor="' + (o.anchor || 'start') + '">' + esc(s) + '</text>';
  }
  function rect(x, y, w, h, o) {
    o = o || {};
    return '<rect x="' + x + '" y="' + y + '" width="' + Math.max(0, w) + '" height="' + h + '" rx="' + (o.rx == null ? 6 : o.rx) +
      '" fill="' + (o.fill || 'none') + '" stroke="' + (o.stroke || L) + '" stroke-width="' + (o.sw || 1) +
      '" stroke-dasharray="' + (o.dash || '') + '" opacity="' + (o.op == null ? 1 : o.op) + '"/>';
  }
  function line(x1, y1, x2, y2, o) {
    o = o || {};
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (o.stroke || L2) +
      '" stroke-width="' + (o.sw || 1) + '" stroke-dasharray="' + (o.dash || '') + '" opacity="' + (o.op == null ? 1 : o.op) + '"/>';
  }
  function bar(x, y, w, h, pct, o) {
    o = o || {};
    return rect(x, y, w, h, { fill: PAPER, stroke: L, rx: 4 }) +
      rect(x, y, Math.max(0, Math.min(1, pct)) * w, h, { fill: o.fill || A, stroke: 'none', rx: 4, op: o.op == null ? 1 : o.op });
  }

  /* 统一外壳：标题 + 画布 + 控件 + 读数 + 说明 */
  function shell(root, spec) {
    var cap = spec.caption || '';
    if (cap && !/示意/.test(cap)) cap += ' 示意，非线性真实实现。';
    root.innerHTML = '<div class="d-head"><b>' + esc(spec.title) + '</b><span>拖动参数看机制变化</span></div>' +
      '<div class="d-canvas"></div><div class="controls"></div><div class="readout"></div>' +
      '<div class="caption">' + esc(cap) + '</div>';
    var canvas = root.querySelector('.d-canvas');
    var ctrls = root.querySelector('.controls');
    var readout = root.querySelector('.readout');
    var state = {};
    (spec.controls || []).forEach(function (c) {
      state[c.key] = c.value;
      var lab = document.createElement('label');
      var name = document.createElement('span'); name.textContent = c.label;
      var inp = document.createElement('input');
      inp.type = 'range'; inp.min = c.min; inp.max = c.max; inp.step = c.step || 1; inp.value = c.value;
      inp.setAttribute('aria-label', c.label);
      var out = document.createElement('output');
      var fmt = c.format || function (v) { return v; };
      out.textContent = fmt(c.value);
      inp.addEventListener('input', function () {
        state[c.key] = Number(inp.value);
        out.textContent = fmt(state[c.key]);
        paint();
      });
      lab.appendChild(name); lab.appendChild(inp); lab.appendChild(out);
      ctrls.appendChild(lab);
    });
    // 按钮组（可选）
    (spec.buttons || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'iconbtn'; btn.type = 'button'; btn.textContent = b.label;
      btn.addEventListener('click', function () { b.onClick(state, paint, root); });
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px';
      wrap.appendChild(btn); ctrls.appendChild(wrap);
    });
    function paint() {
      var r = spec.draw(state, canvas, root);
      if (r && r.svg) canvas.innerHTML = r.svg;
      if (r && r.readout) readout.innerHTML = r.readout;
    }
    paint();
    if (spec.after) spec.after(root, state, paint);
  }

  /* ============================================================
     1. 帧预算：CPU(Game+Render) 与 GPU 并行，取较大者
     ============================================================ */
  function frameBudget(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '一帧的时间预算怎么被吃掉',
      caption: p.caption || 'CPU 与 GPU 并行工作，帧时间取二者较大值；任何一个线程超预算，整体就掉帧。',
      controls: [
        { key: 'fps', label: '目标帧率', min: 30, max: 120, step: 1, value: 60, format: function (v) { return v + ' fps'; } },
        { key: 'game', label: 'GameThread 负载', min: 10, max: 110, step: 1, value: 55, format: function (v) { return v + '%'; } },
        { key: 'render', label: 'RenderThread 负载', min: 10, max: 110, step: 1, value: 42, format: function (v) { return v + '%'; } },
        { key: 'gpu', label: 'GPU 负载', min: 10, max: 130, step: 1, value: 88, format: function (v) { return v + '%'; } }
      ],
      draw: function (s) {
        var W = 760, H = 250, x0 = 120, w = 580;
        var cpu = s.game + s.render, gpu = s.gpu;
        var scale = Math.max(120, cpu, gpu) * 1.05;
        var cpuPct = Math.min(1.25, cpu / 100), gpuPct = Math.min(1.25, gpu / 100);
        var budgetX = x0 + (100 / scale) * w;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="帧预算分解">';
        svg += txt(x0, 24, '预算 ' + (1000 / s.fps).toFixed(1) + ' ms / 帧', { size: 12, fill: INK, weight: 600 });
        svg += txt(x0, 42, '按各线程占预算的比例显示，不代表真实硬件耗时', { size: 10 });
        // CPU 行
        svg += txt(10, 88, 'CPU', { size: 11, fill: INK2, weight: 600 });
        var gx = x0, gPct = Math.min(1.25, s.game / scale);
        svg += rect(gx, 72, gPct * w, 30, { fill: A, stroke: 'none', op: .85 });
        svg += txt(gx + 8, 91, 'Game ' + s.game + '%', { size: 11, fill: '#fff' });
        gx += gPct * w;
        var rPct = Math.min(1.25 - gPct, s.render / scale);
        svg += rect(gx, 72, Math.max(0, rPct * w), 30, { fill: A, stroke: 'none', op: .45 });
        if (rPct > .04) svg += txt(gx + 8, 91, 'Render ' + s.render + '%', { size: 11, fill: INK });
        // GPU 行
        svg += txt(10, 146, 'GPU', { size: 11, fill: INK2, weight: 600 });
        svg += bar(x0, 130, w, 30, gpuPct, { fill: AM });
        svg += txt(x0 + 8, 149, 'GPU 工作 ' + s.gpu + '%', { size: 11, fill: INK });
        // 预算线
        svg += line(budgetX, 52, budgetX, 190, { stroke: BAD, sw: 1.5, dash: '5 4' });
        svg += txt(budgetX + 6, 60, '预算线', { size: 10, fill: BAD });
        // 结论
        var bottleneck = cpu >= gpu ? 'CPU（Game+Render 串行）' : 'GPU';
        var over = Math.max(cpu, gpu) > 100;
        svg += txt(x0, 214, over ? '超出预算：瓶颈在 ' + bottleneck : '未超预算：仍有 ' + (100 - Math.max(cpu, gpu)) + '% 余量', { size: 12, fill: over ? BAD : OK, weight: 600 });
        svg += txt(x0, 232, '降低分辨率/画质主要是降 GPU；减少 Tick、Actor 遍历、UI 重建主要是降 CPU。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: 'CPU 合计 <b>' + cpu + '%</b> · GPU <b>' + gpu + '%</b> · 帧时间由 <b>' + bottleneck + '</b> 决定。'
        };
      }
    });
  }

  /* ============================================================
     2. Lumen：屏幕空间追踪 vs Surface Cache 回退
     ============================================================ */
  function lumenTrace(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '一条间接光射线是怎么找到颜色的',
      caption: p.caption || 'Lumen 先尝试屏幕空间追踪；射线离开屏幕后回退到表面缓存/距离场，bounce 次数越多收敛越好但成本越高。',
      controls: [
        { key: 'bounces', label: '反弹次数', min: 1, max: 4, step: 1, value: 2, format: function (v) { return v + ' 次'; } },
        { key: 'coverage', label: '屏幕内可见比例', min: 20, max: 95, step: 1, value: 65, format: function (v) { return v + '%'; } }
      ],
      buttons: [{ label: '发射光线', onClick: function (s, paint, root) {
        var svg = root.querySelector('svg');
        if (!svg) return;
        var rays = svg.querySelectorAll('.ray');
        for (var i = 0; i < rays.length; i++) {
          rays[i].style.transition = 'none';
          rays[i].style.strokeDashoffset = '600';
          /* 强制回流后播放 */
          void rays[i].getBoundingClientRect();
          rays[i].style.transition = 'stroke-dashoffset .9s ease';
          rays[i].style.strokeDashoffset = '0';
        }
      } }],
      draw: function (s) {
        var W = 760, H = 320;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Lumen 追踪示意">';
        // 房间
        svg += rect(70, 60, 620, 200, { fill: PAPER, stroke: L, rx: 8 });
        svg += line(70, 210, 690, 210, { stroke: L2 }); // 地面
        svg += rect(500, 150, 90, 60, { fill: AM, stroke: 'none', op: .25 }); // 发光面板
        svg += txt(545, 185, '发光面', { size: 10, fill: AM, anchor: 'middle' });
        svg += rect(210, 120, 80, 90, { fill: L, stroke: L2, op: .5 }); // 遮挡物
        svg += txt(250, 170, '遮挡物', { size: 10, anchor: 'middle' });
        // 相机
        svg += rect(90, 150, 26, 34, { fill: INK, stroke: 'none' });
        svg += txt(103, 202, '相机', { size: 10, anchor: 'middle' });
        // 屏幕空间边界
        svg += rect(110, 74, 330, 172, { stroke: A, sw: 1.2, dash: '6 5', rx: 2 });
        svg += txt(118, 90, '屏幕空间内', { size: 10, fill: A });
        svg += txt(452, 90, '屏幕外 → Surface Cache 回退', { size: 10, fill: AM });
        // 射线：命中屏幕内 / 回退
        var n = s.bounces;
        var inCount = Math.max(1, Math.round(6 * s.coverage / 100));
        var rays = [];
        for (var i = 0; i < 6; i++) {
          var inScreen = i < inCount;
          var px = 150 + i * 38, py = 100 + (i % 3) * 40;
          var hx = inScreen ? px + 120 : 560;
          var hy = inScreen ? 200 : 170;
          var d = 'M110 167 L' + hx + ' ' + hy;
          var x = hx, y = hy;
          for (var b = 0; b < n; b++) {
            var nx = inScreen ? Math.min(660, x + 70) : 545;
            var ny = inScreen ? Math.max(84, y - 42) : 180;
            d += ' L' + nx + ' ' + ny;
            x = nx; y = ny;
          }
          rays.push('<path class="ray" d="' + d + '" fill="none" stroke="' + (inScreen ? A : AM) + '" stroke-width="1.2" stroke-dasharray="600" stroke-dashoffset="0" opacity="' + (0.75 - b * 0.02) + '"/>');
        }
        svg += rays.join('');
        // 噪点：bounce 越多越少
        var dots = '';
        var count = Math.round(70 / n);
        for (var k = 0; k < count; k++) {
          var dx = 130 + ((k * 53) % 540), dy = 80 + ((k * 37) % 160);
          dots += '<circle cx="' + dx + '" cy="' + dy + '" r="1" fill="' + M + '" opacity=".35"/>';
        }
        svg += dots;
        svg += '</svg>';
        return {
          svg: svg,
          readout: '屏幕空间命中 <b>' + s.coverage + '%</b> · 回退 <b>' + (100 - s.coverage) + '%</b> · 反弹 <b>' + n + '</b> 次时噪点相对少，但每多一次反弹就多一轮追踪与着色。'
        };
      }
    });
  }

  /* ============================================================
     3. 预测与回滚时序
     ============================================================ */
  function netPrediction(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '客户端预测与服务端校正的时间线',
      caption: p.caption || '客户端先按输入本地模拟；服务器在 RTT/2 后收到，再过 RTT/2 把权威状态送回，客户端回滚并重演。',
      controls: [
        { key: 'rtt', label: 'RTT', min: 20, max: 240, step: 10, value: 80, format: function (v) { return v + ' ms'; } },
        { key: 'speed', label: '预测速度', min: 1, max: 5, step: 1, value: 3, format: function (v) { return v + ' 格/帧'; } }
      ],
      draw: function (s) {
        var W = 760, H = 330, x0 = 90, w = 600;
        var tMax = 260; // 时间窗
        function X(t) { return x0 + Math.min(1, t / tMax) * w; }
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="预测回滚时序">';
        // 时间轴
        svg += line(x0, 60, x0 + w, 60, { stroke: L2 });
        for (var t = 0; t <= tMax; t += 40) {
          svg += line(X(t), 56, X(t), 64, { stroke: L2 });
          svg += txt(X(t), 48, t + 'ms', { size: 9, anchor: 'middle' });
        }
        var half = s.rtt / 2;
        // 客户端行 / 服务端行
        svg += txt(10, 108, '客户端', { size: 11, fill: INK2, weight: 600 });
        svg += txt(10, 198, '服务端', { size: 11, fill: INK2, weight: 600 });
        svg += line(x0, 120, x0 + w, 120, { stroke: L, dash: '4 4' });
        svg += line(x0, 215, x0 + w, 215, { stroke: L, dash: '4 4' });
        // 输入
        svg += rect(X(0) - 4, 108, 32, 24, { fill: A, stroke: 'none', op: .85 });
        svg += txt(X(0) + 12, 124, '输入', { size: 9, fill: '#fff', anchor: 'middle' });
        // 上行
        svg += line(X(0) + 28, 120, X(half), 215, { stroke: A, sw: 1.5, dash: '4 4' });
        svg += txt(X(half / 2), 172, '上行 ' + half + 'ms', { size: 9, fill: A, anchor: 'middle' });
        // 服务端处理
        svg += rect(X(half), 202, 46, 24, { fill: OK, stroke: 'none', op: .8 });
        svg += txt(X(half) + 23, 218, '裁定', { size: 9, fill: '#fff', anchor: 'middle' });
        // 下行
        svg += line(X(half) + 46, 215, X(s.rtt), 120, { stroke: OK, sw: 1.5, dash: '4 4' });
        svg += txt(X(half + 20), 172, '下行 ' + half + 'ms', { size: 9, fill: OK, anchor: 'middle' });
        // 预测结果与权威结果
        var predX = X(s.rtt), err = Math.round(s.speed * (s.rtt / 2) / 40);
        svg += rect(predX - 8, 128, 18, 18, { fill: A, stroke: 'none' });
        svg += txt(predX + 1, 142, '预测', { size: 9, fill: '#fff', anchor: 'middle' });
        svg += rect(predX + 30 + err * 3, 156, 18, 18, { fill: OK, stroke: 'none', op: .9 });
        svg += txt(predX + 39 + err * 3, 170, '权威', { size: 9, fill: '#fff', anchor: 'middle' });
        svg += line(predX + 8, 146, predX + 30 + err * 3, 156, { stroke: BAD, sw: 1.2 });
        svg += txt(predX + 20, 196, '偏差 ' + err + ' 格', { size: 10, fill: BAD });
        svg += line(predX, 120, predX, 235, { stroke: A, dash: '3 3', op: .6 });
        // 回滚
        svg += rect(predX - 20, 245, 120, 26, { fill: AM, stroke: 'none', op: .18 });
        svg += txt(predX - 10, 262, '回滚到权威帧，重演 ' + Math.max(1, Math.round(s.rtt / 2 / 16.6)) + ' 帧输入', { size: 10, fill: AM });
        svg += txt(x0, 300, 'RTT 越大，预测偏差与需要重演的帧数越多；对不可预测的结果（随机/目标切换）应延迟确认而不是硬猜。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: 'RTT <b>' + s.rtt + 'ms</b> · 服务端可见延迟 <b>' + half + 'ms</b> · 一次预测约需重演 <b>' + Math.max(1, Math.round(s.rtt / 2 / 16.6)) + '</b> 帧。'
        };
      }
    });
  }

  /* ============================================================
     4. TBDR 带宽流向
     ============================================================ */
  function tbdrFlow(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '移动端 TBDR 的带宽流向',
      caption: p.caption || 'TBDR 先把三角形放进 tile 的片上内存，再统一着色；半透明无法靠 Early-Z 剔除，overdraw 直接变成重复着色与带宽。',
      controls: [
        { key: 'overdraw', label: '半透明 overdraw', min: 1, max: 8, step: 1, value: 3, format: function (v) { return v + '×'; } },
        { key: 'res', label: '渲染分辨率', min: 50, max: 100, step: 5, value: 100, format: function (v) { return v + '%'; } }
      ],
      draw: function (s) {
        var W = 760, H = 320;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="TBDR 带宽示意">';
        // 系统内存
        svg += rect(40, 60, 180, 210, { fill: PAPER, stroke: L, rx: 8 });
        svg += txt(50, 82, '系统内存（DRAM）', { size: 11, fill: INK2, weight: 600 });
        svg += rect(56, 96, 148, 28, { fill: A, stroke: 'none', op: .2 });
        svg += txt(66, 115, '纹理 / RT', { size: 10 });
        // 片上内存
        svg += rect(280, 60, 220, 210, { fill: AM, stroke: AM, rx: 8, op: .08 });
        svg += txt(290, 82, 'Tile 片上内存', { size: 11, fill: AM, weight: 600 });
        var tiles = '';
        for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
          tiles += rect(300 + c * 44, 100 + r * 44, 36, 36, { fill: AM, stroke: 'none', op: .18 + (r * 4 + c) * .015 });
        }
        svg += tiles;
        svg += txt(300, 246, '深度/模板先过，可见像素才着色', { size: 9 });
        // 输出
        svg += rect(560, 60, 160, 210, { fill: PAPER, stroke: L, rx: 8 });
        svg += txt(570, 82, '屏幕', { size: 11, fill: INK2, weight: 600 });
        svg += rect(576, 100, 128, 90, { fill: L, stroke: 'none', op: .5 });
        svg += txt(640, 146, 'resolve', { size: 10, anchor: 'middle' });
        // 箭头
        svg += line(220, 112, 280, 112, { stroke: A, sw: 1.5 });
        svg += txt(224, 106, '采样', { size: 9, fill: A });
        svg += line(500, 112, 560, 112, { stroke: AM, sw: 1.5 });
        svg += txt(506, 106, '写回', { size: 9, fill: AM });
        // 带宽条
        var load = Math.min(1, (s.overdraw * s.res / 100) / 8);
        svg += txt(40, 292, 'DRAM 带宽压力', { size: 10, fill: INK2 });
        svg += bar(150, 280, 560, 16, load, { fill: load > .75 ? BAD : AM });
        svg += txt(150 + 8, 293, (s.overdraw * s.res / 100).toFixed(1) + ' 单位', { size: 10, fill: INK });
        svg += '</svg>';
        return {
          svg: svg,
          readout: 'overdraw <b>' + s.overdraw + '×</b>、分辨率 <b>' + s.res + '%</b>：半透明层数增加会线性抬高着色与 resolve 带宽；先降层数和分辨率，比砍材质精度更有效。'
        };
      }
    });
  }

  /* ============================================================
     5. PSO 首次命中卡顿
     ============================================================ */
  function psoHitch(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || 'PSO 未命中时的一帧尖峰',
      caption: p.caption || '预缓存覆盖不到的材质/顶点组合会在首次出现时创建 PSO，造成单帧长尖峰；覆盖率越高，尖峰越少。',
      controls: [
        { key: 'coverage', label: '预缓存覆盖率', min: 0, max: 100, step: 5, value: 60, format: function (v) { return v + '%'; } },
        { key: 'variants', label: '材质变体数', min: 10, max: 200, step: 5, value: 80, format: function (v) { return v + ' 个'; } }
      ],
      buttons: [{ label: '播放首次出现', onClick: function (s, paint, root) {
        var svg = root.querySelector('svg');
        if (!svg) return;
        var ph = svg.querySelector('#ph');
        if (!ph) return;
        ph.style.transition = 'none';
        ph.setAttribute('transform', 'translate(0,0)');
        void ph.getBoundingClientRect();
        ph.style.transition = 'transform 2.6s linear';
        ph.setAttribute('transform', 'translate(640,0)');
      } }],
      draw: function (s) {
        var W = 760, H = 300, x0 = 40, w = 650, baseY = 210;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="PSO 卡顿示意">';
        svg += line(x0, baseY, x0 + w, baseY, { stroke: L2 });
        svg += txt(x0, 24, '逐帧时间（相对高度）', { size: 11, fill: INK2, weight: 600 });
        var miss = Math.max(0, Math.round(s.variants * (1 - s.coverage / 100) / 8));
        for (var i = 0; i < 65; i++) {
          var h = 8 + (i % 5) * 2;
          var spike = false;
          if (i < miss) spike = (i % 7 === 3);
          if (spike) h = 80 + (i % 3) * 20;
          svg += rect(x0 + i * 10, baseY - h, 6, h, { fill: spike ? BAD : A, stroke: 'none', op: spike ? .9 : .45, rx: 1 });
        }
        svg += line(x0, baseY - 60, x0 + w, baseY - 60, { stroke: BAD, dash: '4 4', op: .5 });
        svg += txt(x0 + w - 70, baseY - 66, '卡顿阈值', { size: 9, fill: BAD });
        svg += '<g id="ph"><line x1="' + x0 + '" y1="34" x2="' + x0 + '" y2="' + (baseY + 6) + '" stroke="' + AM + '" stroke-width="1.5"/><circle cx="' + x0 + '" cy="34" r="3" fill="' + AM + '"/></g>';
        svg += txt(x0, 258, '未命中 PSO 约 ' + miss + ' 帧；真正致命的是「首次使用」那一刻的长帧，而不是平均帧率。', { size: 10, fill: miss > 8 ? BAD : M });
        svg += txt(x0, 276, '验证必须在打包真机上做首次出现路径，编辑器/热缓存下常常复现不了。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: '覆盖率 <b>' + s.coverage + '%</b> · 变体 <b>' + s.variants + '</b> · 预计仍有 <b>' + miss + '</b> 个首次命中点需要预热或裁剪。'
        };
      }
    });
  }

  /* ============================================================
     6. 加载：同步 vs 异步
     ============================================================ */
  function loadFlow(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '同步与异步加载对主线程的影响',
      caption: p.caption || '同步加载会让 GameThread 等 I/O 与反序列化；异步加载把等待移出主线程，但需要处理「未完成状态」与失败回退。',
      controls: [
        { key: 'size', label: '资产体积', min: 1, max: 10, step: 1, value: 6, format: function (v) { return v + ' 单位'; } },
        { key: 'budget', label: '可接受单帧卡顿', min: 1, max: 5, step: 1, value: 2, format: function (v) { return v + ' 单位'; } }
      ],
      buttons: [{ label: '切换 同步/异步', onClick: function (s, paint) { s.async = !s.async; paint(); } }],
      after: function (root, s) { s.async = false; },
      draw: function (s) {
        var W = 760, H = 300, x0 = 90, w = 600;
        var async = !!s.async;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="加载时序示意">';
        svg += txt(10, 70, 'GameThread', { size: 11, fill: INK2, weight: 600 });
        svg += txt(10, 180, 'I/O', { size: 11, fill: INK2, weight: 600 });
        svg += line(x0, 90, x0 + w, 90, { stroke: L, dash: '4 4' });
        svg += line(x0, 195, x0 + w, 195, { stroke: L, dash: '4 4' });
        svg += txt(x0, 30, async ? '异步加载' : '同步加载', { size: 13, fill: async ? OK : BAD, weight: 700 });
        // 时间刻度
        svg += rect(x0 + 60, 70, 30, 26, { fill: A, stroke: 'none', op: .8 });
        svg += txt(x0 + 75, 87, '请求', { size: 9, fill: '#fff', anchor: 'middle' });
        if (!async) {
          var block = 120 + s.size * 26;
          svg += rect(x0 + 90, 70, block, 26, { fill: BAD, stroke: 'none', op: .25 });
          svg += txt(x0 + 100, 87, '阻塞 ' + block + '（含反序列化）', { size: 10, fill: BAD });
          svg += line(x0 + 90, 195, x0 + 90 + block, 195, { stroke: M, dash: '4 4' });
          svg += txt(x0 + 90 + block + 10, 140, '这一帧被拉长 → hitch', { size: 10, fill: BAD });
        } else {
          svg += rect(x0 + 90, 195, 60 + s.size * 24, 26, { fill: AM, stroke: 'none', op: .3 });
          svg += txt(x0 + 100, 212, '后台读取 / 反序列化', { size: 10, fill: AM });
          svg += line(x0 + 90, 195, x0 + 90 + 60 + s.size * 24, 195, { stroke: M, dash: '4 4' });
          svg += rect(x0 + 200, 70, 26, 26, { fill: OK, stroke: 'none', op: .8 });
          svg += txt(x0 + 213, 87, '回调', { size: 9, fill: '#fff', anchor: 'middle' });
          svg += txt(x0 + 240, 140, '主线程只在回调与绑定对象时有小开销', { size: 10, fill: OK });
        }
        // 预算线
        svg += line(x0, 255, x0 + w, 255, { stroke: L });
        svg += txt(x0, 280, '可接受单帧卡顿 ' + s.budget + ' 单位：' + (async ? '异步路径仍在预算内，但要保证回调前状态可用。' : (s.size * 26 + 120 > 300 ? '同步路径大概率超预算。' : '同步路径也可能勉强接受，但不该用在关键交互。')), { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: async ? '当前：<b>异步</b>。收益是把 I/O 与反序列化移出主线程；代价是加载中状态、失败回退、生命周期（对象是否被回收）。'
            : '当前：<b>同步</b>。实现简单，但阻塞时间随体积线性增长；只适合启动早期或极小资产。'
        };
      }
    });
  }

  /* ============================================================
     7. World Partition 网格流送
     ============================================================ */
  function wpGrid(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || 'World Partition 的加载半径与单元状态',
      caption: p.caption || '以流送源为中心，半径内单元加载，外圈由 HLOD 代理，再远卸载；单元过小管理开销大，过大内存峰值高。',
      controls: [
        { key: 'radius', label: '加载半径', min: 1, max: 4, step: 1, value: 2, format: function (v) { return v + ' 格'; } },
        { key: 'pos', label: '流送源位置', min: 1, max: 9, step: 1, value: 5, format: function (v) { return '格 ' + v; } }
      ],
      buttons: [{ label: '自动巡视', onClick: function (s, paint, root) {
        var i = 1, dir = 1;
        if (root._tour) clearInterval(root._tour);
        root._tour = setInterval(function () {
          if (i >= 9) dir = -1; if (i <= 1) dir = 1;
          i += dir;
          var inp = root.querySelectorAll('input[type=range]')[1];
          if (inp) { inp.value = i; inp.dispatchEvent(new Event('input')); }
        }, 700);
      } }],
      draw: function (s) {
        var W = 760, H = 380, gx = 150, gy = 40, cell = 34;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="World Partition 网格流送">';
        for (var r = 0; r < 9; r++) for (var c = 0; c < 9; c++) {
          var cx = (r + 1), cyc = (c + 1);
          var d = Math.max(Math.abs(cx - 5), Math.abs(cyc - s.pos)); // 横轴 pos
          var fill = PAPER, stroke = L, op = 1;
          if (d <= s.radius) { fill = A; op = .22; stroke = A; }
          else if (d <= s.radius + 2) { fill = AM; op = .16; stroke = AM; }
          svg += rect(gx + c * cell, gy + r * cell, cell - 2, cell - 2, { fill: fill, stroke: stroke, op: op, rx: 3 });
        }
        // 流送源
        var px = gx + (s.pos - 1) * cell + cell / 2, py = gy + 4 * cell + cell / 2;
        svg += '<circle cx="' + px + '" cy="' + py + '" r="7" fill="' + INK + '"/><circle cx="' + px + '" cy="' + py + '" r="3" fill="' + PAPER + '"/>';
        svg += txt(px, py - 14, '玩家/相机', { size: 9, anchor: 'middle', fill: INK2 });
        // 图例
        svg += rect(470, 60, 12, 12, { fill: A, op: .22, stroke: A }); svg += txt(490, 71, '已加载（完整精度）', { size: 10 });
        svg += rect(470, 86, 12, 12, { fill: AM, op: .16, stroke: AM }); svg += txt(490, 97, 'HLOD / 代理', { size: 10 });
        svg += rect(470, 112, 12, 12, { fill: PAPER, stroke: L }); svg += txt(490, 123, '未加载', { size: 10 });
        svg += txt(470, 160, '内存峰值', { size: 10, fill: INK2 });
        var loaded = 0;
        for (var rr = 0; rr < 9; rr++) for (var cc = 0; cc < 9; cc++) {
          var dd = Math.max(Math.abs((rr + 1) - 5), Math.abs((cc + 1) - s.pos));
          if (dd <= s.radius) loaded++;
        }
        svg += bar(470, 170, 200, 12, loaded / 81, { fill: A });
        svg += txt(470, 200, loaded + ' / 81 单元常驻', { size: 10, fill: M });
        svg += txt(40, 340, '加载半径小 → 常驻内存低，但切换频繁、管理开销大；半径大 → 内存峰值高。', { size: 10 });
        svg += txt(40, 358, 'HLOD 要在加载半径之外接管，否则会在边界出现「完整精度 ↔ 代理」的跳变。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: '半径 <b>' + s.radius + '</b> 格 · 常驻 <b>' + loaded + '/81</b> 单元 · 外圈 HLOD 负责远景，切换距离应大于加载半径以避免穿帮。'
        };
      }
    });
  }

  /* ============================================================
     8. Chunk 分包与首包
     ============================================================ */
  function chunkPack(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '首包、区域包与共享包的关系',
      caption: p.caption || '首包只放启动必需内容；区域包按玩法/地图分块；共享包放跨区域依赖。跨块引用会迫使玩家提前下载或重复打包。',
      controls: [
        { key: 'zones', label: '区域包数量', min: 2, max: 8, step: 1, value: 4, format: function (v) { return v + ' 个'; } },
        { key: 'shared', label: '共享依赖比例', min: 0, max: 60, step: 5, value: 20, format: function (v) { return v + '%'; } }
      ],
      draw: function (s) {
        var W = 760, H = 300, n = s.zones;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Chunk 分包示意">';
        // 首包
        svg += rect(40, 50, 130, 60, { fill: A, stroke: A, op: .2 });
        svg += txt(50, 74, '首包', { size: 12, fill: INK, weight: 600 });
        svg += txt(50, 90, '启动 / 主菜单 / 第一关', { size: 9 });
        // 区域包
        var bw = Math.min(62, 520 / n);
        for (var i = 0; i < n; i++) {
          var x = 200 + i * (bw + 10);
          svg += rect(x, 50, bw, 60, { fill: AM, stroke: AM, op: .12 });
          svg += txt(x + bw / 2, 74, '区域 ' + (i + 1), { size: 10, anchor: 'middle' });
          svg += txt(x + bw / 2, 90, '按需下载', { size: 9, anchor: 'middle' });
        }
        // 共享包
        var sw = 200 + s.shared / 100 * 300;
        svg += rect(40, 150, sw, 34, { fill: L, stroke: L2, op: .5 });
        svg += txt(48, 172, '共享包：跨区域通用资源', { size: 10 });
        svg += txt(40 + sw + 8, 172, s.shared + '%', { size: 10, fill: M });
        // 依赖箭头
        for (var j = 0; j < n; j++) {
          svg += line(200 + j * (bw + 10) + bw / 2, 150, 200 + j * (bw + 10) + bw / 2, 128, { stroke: L2, dash: '4 4' });
        }
        svg += txt(40, 230, '首包 ≈ 启动必需 + 共享包的一部分；跨块引用越多，首包或切换时的下载峰值越高。', { size: 10 });
        svg += txt(40, 248, '验证：打包后对比「首包大小 / 补丁增量 / 首次进入某区域的下载量」，而不是只看总包体。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: '区域 <b>' + n + '</b> 个 · 共享依赖 <b>' + s.shared + '%</b>：共享越多，首包越重、补丁越容易连带；共享太少则重复打包。'
        };
      }
    });
  }

  /* ============================================================
     9. GC 标记-清除
     ============================================================ */
  function gcMark(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '标记-清除在对象引用图上做什么',
      caption: p.caption || '从根集出发沿引用遍历标记可达对象，未标记的在清除阶段释放；引用深度与对象数量直接决定标记时间。',
      controls: [
        { key: 'count', label: '对象数量', min: 10, max: 60, step: 1, value: 30, format: function (v) { return v + ' 个'; } }
      ],
      buttons: [
        { label: '标记', onClick: function (s, paint, root) {
          var nodes = root.querySelectorAll('[data-node]');
          var i = 0;
          if (root._gc) clearInterval(root._gc);
          nodes.forEach(function (n) { n.setAttribute('opacity', '.25'); });
          root._gc = setInterval(function () {
            if (i >= nodes.length) { clearInterval(root._gc); return; }
            var n = nodes[i++];
            n.setAttribute('opacity', '1');
            n.querySelector('circle').setAttribute('fill', A);
          }, 45);
        } },
        { label: '清除', onClick: function (s, paint, root) {
          root.querySelectorAll('[data-node]').forEach(function (n) {
            if (n.getAttribute('data-root') !== '1') {
              var c = n.querySelector('circle');
              if (c.getAttribute('fill') === A) return;
              n.style.transition = 'opacity .4s'; n.setAttribute('opacity', '.12');
            }
          });
        } },
        { label: '重置', onClick: function (s, paint) { paint(); } }
      ],
      draw: function (s) {
        var W = 760, H = 340, cx = 380, cy = 180, R = 120;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="GC 标记清除示意">';
        var n = s.count;
        var nodes = [];
        for (var i = 0; i < n; i++) {
          var ang = (i / n) * Math.PI * 2;
          var rr = i === 0 ? 0 : (i % 3 === 0 ? R * 1.35 : R * (0.55 + (i % 4) * 0.22));
          var x = cx + Math.cos(ang) * rr, y = cy + Math.sin(ang) * rr;
          nodes.push({ x: x, y: y, root: i === 0 });
        }
        for (var j = 1; j < n; j++) {
          var p = nodes[j - 1];
          svg += line(p.x, p.y, nodes[j].x, nodes[j].y, { stroke: L2, op: .6 });
          if (j % 4 === 0) svg += line(nodes[0].x, nodes[0].y, nodes[j].x, nodes[j].y, { stroke: L2, op: .35 });
        }
        for (var k = 0; k < n; k++) {
          var nd = nodes[k];
          svg += '<g data-node="' + k + '" data-root="' + (nd.root ? 1 : 0) + '" opacity=".85">' +
            '<circle cx="' + nd.x + '" cy="' + nd.y + '" r="' + (nd.root ? 8 : 5) + '" fill="' + (nd.root ? INK : M) + '"/>' +
            (nd.root ? txt(nd.x, nd.y - 14, '根集', { size: 10, anchor: 'middle', fill: INK2 }) : '') + '</g>';
        }
        svg += txt(40, 40, '对象数 ' + n + ' · 引用边 ' + (n - 1 + Math.floor(n / 4)) + ' 条', { size: 10, fill: INK2 });
        svg += txt(40, 316, '对象越多、引用越深，标记遍历越长；集群把一组对象的遍历合并，减少重复访问。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: '点击「标记」查看可达对象；点击「清除」释放不可达对象。对象数 <b>' + n + '</b> 时，标记成本随对象与边数增长。'
        };
      }
    });
  }

  /* ============================================================
     10. GAS 预测键时序
     ============================================================ */
  function gasPred(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || 'PredictionKey：预测、确认与回滚',
      caption: p.caption || '客户端生成 PredictionKey 并预测 Effect；服务器执行后确认或拒绝。拒绝时客户端必须回滚预测性属性与表现。',
      controls: [
        { key: 'window', label: '预测窗口', min: 1, max: 5, step: 1, value: 3, format: function (v) { return v + ' 帧'; } }
      ],
      buttons: [
        { label: '服务器接受', onClick: function (s, paint, root) { root._reject = false; paint(); } },
        { label: '服务器拒绝', onClick: function (s, paint, root) { root._reject = true; paint(); } }
      ],
      after: function (root, s) { root._reject = false; },
      draw: function (s, canvas, root) {
        var W = 760, H = 320, x0 = 100, w = 580;
        var reject = !!canvas.closest('.diagram') && root._reject;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="GAS 预测键时序">';
        svg += txt(10, 100, '客户端', { size: 11, fill: INK2, weight: 600 });
        svg += txt(10, 200, '服务端', { size: 11, fill: INK2, weight: 600 });
        svg += line(x0, 112, x0 + w, 112, { stroke: L, dash: '4 4' });
        svg += line(x0, 212, x0 + w, 212, { stroke: L, dash: '4 4' });
        // 激活
        svg += rect(x0, 96, 96, 28, { fill: A, stroke: 'none', op: .85 });
        svg += txt(x0 + 48, 114, '激活 Ability', { size: 10, fill: '#fff', anchor: 'middle' });
        svg += txt(x0 + 100, 138, '生成 PredictionKey', { size: 9, fill: A });
        // 预测效果
        svg += rect(x0 + 10, 148, 150, 24, { fill: A, stroke: A, dash: '3 3' });
        svg += txt(x0 + 20, 164, '预测：扣费/冷却/表现', { size: 9 });
        // 上行
        svg += line(x0 + 100, 112, x0 + 250, 212, { stroke: A, dash: '4 4' });
        // 服务端
        svg += rect(x0 + 250, 196, 120, 30, { fill: reject ? BAD : OK, stroke: 'none', op: .85 });
        svg += txt(x0 + 310, 215, reject ? '校验失败' : '执行并确认', { size: 10, fill: '#fff', anchor: 'middle' });
        svg += line(x0 + 370, 212, x0 + 520, 112, { stroke: reject ? BAD : OK, dash: '4 4' });
        // 客户端结果
        if (reject) {
          svg += rect(x0 + 440, 80, 150, 26, { fill: BAD, stroke: 'none', op: .15 });
          svg += txt(x0 + 452, 97, '回滚属性 + 撤销表现', { size: 9, fill: BAD });
        } else {
          svg += rect(x0 + 440, 80, 150, 26, { fill: OK, stroke: 'none', op: .15 });
          svg += txt(x0 + 452, 97, '确认：保留预测值', { size: 9, fill: OK });
        }
        svg += txt(x0, 262, '可预测：扣费、冷却、即时表现；不可预测：随机结果、目标选择、服务器裁决的命中。', { size: 10 });
        svg += txt(x0, 280, '预测窗口 ' + s.window + ' 帧：窗口越长越容易「先看到再被撤销」，需要表现层做平滑。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: reject ? '服务器<b>拒绝</b>：客户端必须回滚预测的属性与 Cue，否则出现「技能播了但没扣血」。'
            : '服务器<b>接受</b>：预测值被确认；若预测范围选错（如随机伤害），确认后仍会出现数值跳动。'
        };
      }
    });
  }

  /* ============================================================
     11. 视野裁剪与信息泄露
     ============================================================ */
  function visionCull(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '服务器该下发多少信息',
      caption: p.caption || '服务器只同步视野内/相关性高的 Actor；把隐藏实体坐标也下发，等于把透视作弊的原料送到客户端。',
      controls: [
        { key: 'radius', label: '视野半径', min: 2, max: 6, step: 1, value: 4, format: function (v) { return v + ' 格'; } }
      ],
      buttons: [{ label: '切换 下发隐藏实体', onClick: function (s, paint, root) { root._leak = !root._leak; paint(); } }],
      after: function (root) { root._leak = false; },
      draw: function (s, canvas, root) {
        var W = 760, H = 330, gx = 120, gy = 50, cell = 30;
        var leak = !!root._leak;
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="视野裁剪示意">';
        for (var r = 0; r < 7; r++) for (var c = 0; c < 11; c++) {
          svg += rect(gx + c * cell, gy + r * cell, cell - 1, cell - 1, { fill: PAPER, stroke: L, rx: 2 });
        }
        var px = gx + 5 * cell + cell / 2, py = gy + 3 * cell + cell / 2;
        var rad = s.radius * cell;
        svg += '<circle cx="' + px + '" cy="' + py + '" r="' + rad + '" fill="' + A + '" opacity=".1" stroke="' + A + '" stroke-dasharray="4 4"/>';
        svg += '<circle cx="' + px + '" cy="' + py + '" r="6" fill="' + INK + '"/>';
        var actors = [[2, 1], [8, 2], [1, 5], [9, 5], [6, 6], [3, 4], [10, 3]];
        var leaked = 0;
        actors.forEach(function (a) {
          var ax = gx + a[0] * cell + cell / 2, ay = gy + a[1] * cell + cell / 2;
          var inside = Math.hypot(ax - px, ay - py) <= rad;
          if (inside || leak) {
            svg += '<circle cx="' + ax + '" cy="' + ay + '" r="5" fill="' + (inside ? OK : BAD) + '"/>';
            if (!inside) leaked++;
          } else {
            svg += '<circle cx="' + ax + '" cy="' + ay + '" r="4" fill="' + L2 + '" opacity=".5"/>';
          }
        });
        svg += txt(560, 70, '绿：视野内（应下发）', { size: 10, fill: OK });
        svg += txt(560, 90, '红：视野外（不应下发）', { size: 10, fill: BAD });
        svg += txt(560, 110, '灰：服务器保留', { size: 10, fill: M });
        svg += txt(40, 290, leak ? '当前开启「下发隐藏实体」：客户端拿到 ' + leaked + ' 个视野外坐标，透视/雷达外挂可直接利用。'
          : '当前只下发视野内实体：作弊者无法从网络包中还原隐藏位置。', { size: 10, fill: leak ? BAD : OK });
        svg += txt(40, 308, '真正的安全边界在服务器「决定发什么」，而不是客户端「决定显示什么」。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: leak ? '泄露 <b>' + leaked + '</b> 个隐藏实体坐标：这是信息层面的作弊面，客户端反作弊无法弥补。'
            : '视野半径 <b>' + s.radius + '</b> 格 · 下发的实体都在视野/相关性范围内。'
        };
      }
    });
  }

  /* ============================================================
     12. 物理碎片预算
     ============================================================ */
  function physicsBudget(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '碎片数量、休眠与同步成本',
      caption: p.caption || '碎片越多，物理求解与绘制成本越高；联机时全量同步轨迹带宽爆炸，主流做法只同步断裂状态，碎片本地演出。',
      controls: [
        { key: 'frags', label: '同时活动碎片', min: 50, max: 5000, step: 50, value: 800, format: function (v) { return v; } },
        { key: 'sleep', label: '休眠阈值', min: 1, max: 5, step: 1, value: 3, format: function (v) { return '档 ' + v; } }
      ],
      buttons: [{ label: '切换 全量同步轨迹', onClick: function (s, paint, root) { root._full = !root._full; paint(); } }],
      after: function (root) { root._full = false; },
      draw: function (s, canvas, root) {
        var W = 760, H = 300;
        var full = !!root._full;
        var load = Math.min(1, (s.frags / 5000) * (1 - (s.sleep - 1) * 0.12) * 1.2);
        var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="物理碎片预算">';
        svg += txt(40, 30, '物理线程负载', { size: 11, fill: INK2, weight: 600 });
        svg += bar(40, 42, 680, 20, load, { fill: load > .8 ? BAD : AM });
        svg += txt(48, 57, Math.round(load * 100) + '%（相对量级）', { size: 10, fill: INK });
        svg += txt(40, 92, '网络带宽（同步碎片轨迹）', { size: 11, fill: INK2, weight: 600 });
        var bw = full ? Math.min(1, s.frags / 2000) : Math.min(.12, s.frags / 20000);
        svg += bar(40, 104, 680, 20, bw, { fill: full ? BAD : OK });
        svg += txt(48, 119, full ? '全量轨迹：随碎片数线性增长' : '仅同步断裂状态：近似常数', { size: 10, fill: INK });
        svg += txt(40, 168, '碎片 ' + s.frags + ' · 休眠档 ' + s.sleep + '：休眠与物理 LOD 能把远处碎片移出求解。', { size: 10 });
        svg += txt(40, 186, '碎片上限、存活时间、碰撞代理是必须写进设计的三条红线。', { size: 10 });
        // 碎片示意
        for (var i = 0; i < 24; i++) {
          var x = 40 + (i * 29) % 680, y = 220 + (i * 17) % 50;
          svg += '<rect x="' + x + '" y="' + y + '" width="7" height="5" fill="' + (i % 4 === 0 ? BAD : AM) + '" opacity=".5"/>';
        }
        svg += '</svg>';
        return {
          svg: svg,
          readout: full ? '全量同步：带宽随碎片数增长，是高延迟下抖动与服务器成本的来源。'
            : '只同步断裂状态：带宽近似常数；碎片运动在客户端本地模拟或用缓存演出，允许轻微不一致。'
        };
      }
    });
  }

  /* ============================================================
     13. 动画选型成本
     ============================================================ */
  function animCost(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '状态机与 Motion Matching 的成本曲线',
      caption: p.caption || '状态机靠人工连边控制精确；Motion Matching 从姿势库检索，移动更自然，但内存与检索成本随库规模上升。',
      controls: [
        { key: 'poses', label: '姿势库规模', min: 100, max: 2000, step: 50, value: 600, format: function (v) { return v + ' 条'; } },
        { key: 'actors', label: '同屏角色', min: 1, max: 80, step: 1, value: 20, format: function (v) { return v + ' 个'; } }
      ],
      buttons: [{ label: '切换 状态机 / Motion Matching', onClick: function (s, paint, root) { root._mm = !root._mm; paint(); } }],
      after: function (root) { root._mm = true; },
      draw: function (s, canvas, root) {
        var W = 760, H = 300;
        var mm = !!root._mm;
        var mem = mm ? Math.min(1, s.poses / 1600) : Math.min(.35, s.poses / 12000);
        var cpu = mm ? Math.min(1, (s.poses / 2000) * .45 + s.actors / 100) : Math.min(.55, s.actors / 100 + .18);
        var svg = '<svg viewBox="0 0 760 300" role="img" aria-label="动画成本曲线">';
        svg += txt(40, 28, mm ? 'Motion Matching（姿势库检索）' : '状态机 / Blend Space（人工连边）', { size: 13, fill: mm ? A : AM, weight: 700 });
        svg += txt(40, 74, '内存（动画数据）', { size: 11, fill: INK2 });
        svg += bar(40, 84, 660, 18, mem, { fill: A });
        svg += txt(48, 98, Math.round(mem * 100) + '%（相对量级）', { size: 10, fill: INK });
        svg += txt(40, 140, 'CPU（评估 + 更新）', { size: 11, fill: INK2 });
        svg += bar(40, 150, 660, 18, cpu, { fill: cpu > .8 ? BAD : OK });
        svg += txt(48, 164, Math.round(cpu * 100) + '%（' + s.actors + ' 角色同屏）', { size: 10, fill: INK });
        svg += txt(40, 208, mm ? '适合移动：自然过渡、减少连边；不适合精确到帧的战斗动作。' : '适合战斗：可精确控制帧窗口与打断；大量状态连边会产生组合爆炸。', { size: 10 });
        svg += txt(40, 226, '大量 NPC 的通行做法：按距离降频/降 LOD，远处不跑完整动画。', { size: 10 });
        // 曲线
        var pts = '';
        for (var i = 0; i <= 60; i++) {
          var x = 40 + i * 11;
          var y = 280 - (mm ? (i / 60) * 90 : Math.min(70, 8 + Math.pow(i / 60, 2) * 120));
          pts += (i ? ' L' : 'M') + x + ' ' + y;
        }
        svg += '<path d="' + pts + '" fill="none" stroke="' + (mm ? A : AM) + '" stroke-width="1.5"/>';
        svg += txt(40, 292, '横轴：姿势/状态规模 → 纵轴：成本（示意）', { size: 9 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: mm ? 'Motion Matching：<b>内存随库规模</b>，检索 CPU 随角色数；移动自然，但战斗帧控制弱。'
            : '状态机：<b>内存低</b>，连边维护成本高；战斗可控，但状态组合爆炸。'
        };
      }
    });
  }

  /* ============================================================
     14. 特殊移动状态与合法性
     ============================================================ */
  function moveState(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '抓钩成功与失败的分支',
      caption: p.caption || '特殊移动是状态机：锚点合法性校验失败必须回退到安全状态；联机时服务器权威校验，客户端预测失败要平滑回滚。',
      controls: [
        { key: 'valid', label: '锚点合法概率', min: 0, max: 100, step: 5, value: 80, format: function (v) { return v + '%'; } }
      ],
      buttons: [{ label: '尝试抓钩', onClick: function (s, paint, root) {
        root._seed = (root._seed || 0) + 1;
        paint();
      } }],
      after: function (root) { root._seed = 0; },
      draw: function (s, canvas, root) {
        var W = 760, H = 320;
        var ok = ((root._seed * 37 + 11) % 100) < s.valid;
        var nodes = [
          { id: 'run', label: 'Run', x: 60, y: 230 },
          { id: 'jump', label: 'Jump', x: 230, y: 130 },
          { id: 'grapple', label: 'Grapple', x: 420, y: 70 },
          { id: 'fall', label: 'Fall', x: 420, y: 230 },
          { id: 'climb', label: 'Climb', x: 600, y: 130 }
        ];
        var by = {};
        nodes.forEach(function (n) { by[n.id] = n; });
        var svg = '<svg viewBox="0 0 760 320" role="img" aria-label="特殊移动状态图">';
        nodes.forEach(function (n) {
          svg += rect(n.x - 34, n.y - 16, 68, 32, { fill: n.id === 'grapple' && ok ? A : PAPER, stroke: n.id === 'grapple' && ok ? A : L2, op: .9 });
          svg += txt(n.x, n.y + 4, n.label, { size: 10, anchor: 'middle', fill: n.id === 'grapple' && ok ? '#fff' : INK });
        });
        svg += line(94, 222, 196, 146, { stroke: A, sw: 1.2 });
        svg += line(264, 130, 386, 82, { stroke: ok ? A : BAD, sw: 1.6, dash: ok ? '' : '5 4' });
        svg += txt(300, 96, ok ? '锚点合法' : '锚点非法', { size: 10, fill: ok ? OK : BAD });
        svg += line(264, 146, 386, 222, { stroke: BAD, sw: 1.2, dash: '5 4' });
        svg += txt(300, 190, '失败 → 回退', { size: 10, fill: BAD });
        svg += line(454, 78, 566, 130, { stroke: AM, sw: 1.2 });
        svg += txt(470, 100, '到顶', { size: 9, fill: AM });
        svg += txt(40, 40, '独立检查：距离 / 法线 / 表面材质 / 遮挡 / 服务器校验', { size: 10, fill: INK2 });
        svg += txt(40, 60, '上次尝试：' + (ok ? '成功进入 Grapple' : '失败，保持 Run/Fall'), { size: 10, fill: ok ? OK : BAD });
        svg += txt(40, 296, '关键：失败分支必须有明确的下一个状态与动画，否则会出现卡在墙边或原地抖动。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: ok ? '本次尝试<b>成功</b>：进入 Grapple，联机时仍需服务器复核锚点与位移。'
            : '本次尝试<b>失败</b>：回退到 Run/Fall，不能停留在非法状态。'
        };
      }
    });
  }

  /* ============================================================
     15. 群体 AI 分层
     ============================================================ */
  function crowdLod(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '同屏单位的更新分层',
      caption: p.caption || '近处用完整 Actor + 行为树，中距离用 Mass 批量模拟，远处降频/休眠；按距离分层是控制 CPU 的主要手段。',
      controls: [
        { key: 'units', label: '同屏单位', min: 100, max: 2000, step: 50, value: 600, format: function (v) { return v; } },
        { key: 'near', label: '近处比例', min: 5, max: 40, step: 5, value: 15, format: function (v) { return v + '%'; } }
      ],
      draw: function (s) {
        var W = 760, H = 320, gx = 60, gy = 40;
        var svg = '<svg viewBox="0 0 760 320" role="img" aria-label="群体 AI 分层示意">';
        // 距离环
        for (var r = 0; r < 3; r++) {
          svg += '<circle cx="' + (gx + 180) + '" cy="' + (gy + 130) + '" r="' + (60 + r * 55) + '" fill="none" stroke="' + (r === 0 ? A : r === 1 ? AM : L2) + '" stroke-dasharray="4 4" opacity=".6"/>';
        }
        svg += '<circle cx="' + (gx + 180) + '" cy="' + (gy + 130) + '" r="7" fill="' + INK + '"/>';
        var nearN = Math.round(s.units * s.near / 100);
        var midN = Math.round(s.units * (1 - s.near / 100) * .6);
        var farN = s.units - nearN - midN;
        // 点
        for (var i = 0; i < 160; i++) {
          var ang = (i * 2.399) % (Math.PI * 2);
          var rr = 20 + ((i * 13) % 160);
          var x = gx + 180 + Math.cos(ang) * rr, y = gy + 130 + Math.sin(ang) * rr;
          var col = rr < 60 ? A : rr < 115 ? AM : L2;
          svg += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + col + '" opacity="' + (rr < 60 ? .9 : .55) + '"/>';
        }
        svg += txt(480, 70, '近处：Actor + 行为树/StateTree', { size: 10, fill: A });
        svg += txt(480, 92, '中景：Mass 批量模拟', { size: 10, fill: AM });
        svg += txt(480, 114, '远处：降频 / 休眠', { size: 10, fill: M });
        svg += txt(480, 156, 'Actor ' + nearN + ' · Mass ' + midN + ' · 休眠 ' + farN, { size: 10, fill: INK2 });
        var load = Math.min(1, nearN * .5 / 100 + midN / 800 + farN / 4000);
        svg += txt(480, 186, 'CPU 相对负载', { size: 10, fill: INK2 });
        svg += bar(480, 196, 220, 14, load, { fill: load > .8 ? BAD : OK });
        svg += txt(480, 230, Math.round(load * 100) + '%', { size: 10, fill: M });
        svg += txt(40, 296, '每帧都跑完整行为树是常见爆炸点；分层后近处仍要保证反应，远处允许「看起来在动」。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: '近处 <b>' + nearN + '</b> 个完整 Actor · 中景 <b>' + midN + '</b> 个 Mass · 远处 <b>' + farN + '</b> 个休眠/降频。'
        };
      }
    });
  }

  /* ============================================================
     16. UI 层叠与 overdraw
     ============================================================ */
  function uiOverdraw(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || 'UI 层叠、失效重绘与 overdraw',
      caption: p.caption || '每层半透明 UI 都会叠加一次绘制；Retainer/Invalidation 缓存不常变的部分，把每帧重建移出热路径。',
      controls: [
        { key: 'layers', label: '半透明层数', min: 1, max: 8, step: 1, value: 4, format: function (v) { return v + ' 层'; } },
        { key: 'ticks', label: '每帧更新控件', min: 0, max: 300, step: 10, value: 120, format: function (v) { return v + ' 个'; } }
      ],
      buttons: [{ label: '切换 Retainer / Invalidation', onClick: function (s, paint, root) { root._cache = !root._cache; paint(); } }],
      after: function (root) { root._cache = false; },
      draw: function (s, canvas, root) {
        var W = 760, H = 300;
        var cache = !!root._cache;
        var gpu = Math.min(1, s.layers / 8);
        var cpu = Math.min(1, cache ? s.ticks / 900 + .04 : s.ticks / 300);
        var svg = '<svg viewBox="0 0 760 300" role="img" aria-label="UI overdraw 示意">';
        for (var i = 0; i < s.layers; i++) {
          svg += rect(40 + i * 6, 60 + i * 14, 260, 90, { fill: AM, stroke: AM, op: .06 });
        }
        svg += txt(40, 44, '半透明层叠：' + s.layers + ' 层 → overdraw 累加', { size: 10, fill: INK2 });
        svg += txt(360, 74, 'GPU（绘制/填充）', { size: 11, fill: INK2 });
        svg += bar(360, 84, 340, 16, gpu, { fill: gpu > .7 ? BAD : AM });
        svg += txt(360, 124, 'CPU（布局 + 每帧更新）', { size: 11, fill: INK2 });
        svg += bar(360, 134, 340, 16, cpu, { fill: cpu > .7 ? BAD : OK });
        svg += txt(360, 176, cache ? '缓存开启：静态层不重建，仅失效区域重绘' : '缓存关闭：每帧重建/重排，控件越多越慢', { size: 10, fill: cache ? OK : BAD });
        svg += txt(40, 236, '虚拟化列表：只实例化可见条目；事件驱动：只在数值变化时 SetText。', { size: 10 });
        svg += txt(40, 254, 'UI 的坑常在「看不见的成本」：每帧 Tick、全量重排、半透明叠加。', { size: 10 });
        svg += '</svg>';
        return {
          svg: svg,
          readout: (cache ? '<b>已开启缓存</b>：' : '<b>未开启缓存</b>：') + '层数 <b>' + s.layers + '</b> · 每帧更新 <b>' + s.ticks + '</b> 个控件。'
        };
      }
    });
  }

  /* ============================================================
     17. CI 性能门槛
     ============================================================ */
  function ciPipeline(root, p) {
    p = p || {};
    shell(root, {
      title: p.title || '性能回归门槛如何阻断发布',
      caption: p.caption || '固定场景在真机上跑基线，超过阈值即失败；没有基线的自动化只能证明「能跑」，不能证明「没退化」。',
      controls: [
        { key: 'threshold', label: '阈值余量', min: 0, max: 20, step: 1, value: 8, format: function (v) { return v + '%'; } },
        { key: 'coverage', label: '场景覆盖率', min: 10, max: 100, step: 10, value: 60, format: function (v) { return v + '%'; } }
      ],
      buttons: [{ label: '模拟一次性能回退', onClick: function (s, paint, root) { root._reg = !root._reg; paint(); } }],
      after: function (root) { root._reg = false; },
      draw: function (s, canvas, root) {
        var W = 760, H = 300, y = 80;
        var reg = !!root._reg;
        var stages = ['Build', 'Cook', '自动化', '性能门槛', '发布'];
        var svg = '<svg viewBox="0 0 760 300" role="img" aria-label="CI 流水线">';
        var blocked = reg && (100 - s.threshold < 12);
        stages.forEach(function (name, i) {
          var x = 30 + i * 145;
          var fail = blocked && i === 3;
          svg += rect(x, y, 120, 42, { fill: fail ? BAD : A, stroke: 'none', op: fail ? .85 : .18, rx: 8 });
          svg += txt(x + 60, y + 26, name, { size: 11, anchor: 'middle', fill: fail ? '#fff' : INK });
          if (i < 4) svg += line(x + 120, y + 21, x + 145, y + 21, { stroke: L2 });
        });
        svg += txt(30, 52, reg ? '本次构建：性能回退 12%（模拟）' : '本次构建：无回退', { size: 11, fill: reg ? BAD : OK, weight: 600 });
        svg += txt(30, 160, '阈值余量 ' + s.threshold + '%：余量太小会被噪声误伤，太大则放过大退化。', { size: 10 });
        svg += txt(30, 178, '场景覆盖率 ' + s.coverage + '%：只覆盖主菜单的回归，等于没覆盖。', { size: 10 });
        svg += txt(30, 210, blocked ? '结果：性能门槛失败 → 阻断发布（这是门槛存在的意义）' : '结果：通过 → 允许进入发布流程', { size: 11, fill: blocked ? BAD : OK });
        // 基线对比
        svg += txt(30, 250, '基线', { size: 9 });
        svg += bar(80, 240, 300, 12, .6, { fill: L2 });
        svg += txt(30, 274, '本次', { size: 9 });
        svg += bar(80, 264, 300, 12, reg ? .72 : .59, { fill: reg ? BAD : OK });
        svg += '</svg>';
        return {
          svg: svg,
          readout: blocked ? '性能门槛<b>阻断</b>本次发布：这类阻断必须来自固定场景 + 真机 + 基线，不是人工感觉。'
            : '流水线<b>通过</b>；覆盖率与阈值仍需按项目维护，避免「假绿」。'
        };
      }
    });
  }

  /* ============================================================
     18. 反作弊：视野已由 11 覆盖；此处补充 18 章工程不需要
     ============================================================ */

  var TYPES = {
    'frame-budget': frameBudget,
    'lumen-trace': lumenTrace,
    'net-prediction': netPrediction,
    'tbdr-flow': tbdrFlow,
    'pso-hitch': psoHitch,
    'load-flow': loadFlow,
    'wp-grid': wpGrid,
    'chunk-pack': chunkPack,
    'gc-mark': gcMark,
    'gas-pred': gasPred,
    'vision-cull': visionCull,
    'physics-budget': physicsBudget,
    'anim-cost': animCost,
    'move-state': moveState,
    'crowd-lod': crowdLod,
    'ui-overdraw': uiOverdraw,
    'ci-pipeline': ciPipeline
  };

  function boot() {
    var hosts = document.querySelectorAll('[data-diagram]');
    for (var i = 0; i < hosts.length; i++) {
      var h = hosts[i];
      var type = h.getAttribute('data-diagram');
      var fn = TYPES[type];
      var params = {};
      try { params = JSON.parse(h.getAttribute('data-params') || '{}'); } catch (e) {}
      params.title = h.getAttribute('data-title') || params.title;
      params.caption = h.getAttribute('data-caption') || params.caption;
      h.classList.add('diagram');
      if (!fn) {
        h.innerHTML = '<div class="d-head"><b>图解组件缺失</b></div><div class="caption">类型 ' + type + ' 未注册。</div>';
        continue;
      }
      fn(h, params);
    }
  }
  window.UE_DIAGRAM_TYPES = Object.keys(TYPES);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
