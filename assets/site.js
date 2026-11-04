/* 共享站点逻辑：主题、术语解释、学习进度、章节交互、路线图渲染。纯原生 JS。 */
(function (global) {
  'use strict';
  var KEY = 'ue-learn-v1';
  var THEME = 'ue-theme';

  function safeGet(k) { try { return global.localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { global.localStorage.setItem(k, v); } catch (e) {} }

  /* ---------- 主题 ---------- */
  function systemDark() {
    return global.matchMedia && global.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function applyTheme(mode) {
    var dark = mode === 'dark' || (mode === 'auto' && systemDark());
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    safeSet(THEME, mode);
    var btns = document.querySelectorAll('[data-theme-toggle]');
    var label = mode === 'auto' ? '跟随系统' : (mode === 'dark' ? '深色' : '浅色');
    for (var i = 0; i < btns.length; i++) {
      btns[i].textContent = '主题：' + label;
      btns[i].setAttribute('aria-label', '当前主题 ' + label + '，点击切换');
    }
  }
  function initTheme() {
    var saved = safeGet(THEME) || 'auto';
    applyTheme(saved);
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-theme-toggle]');
      if (!b) return;
      var cur = safeGet(THEME) || 'auto';
      applyTheme(cur === 'auto' ? 'light' : cur === 'light' ? 'dark' : 'auto');
    });
    if (global.matchMedia) {
      var mq = global.matchMedia('(prefers-color-scheme: dark)');
      var onChange = function () { if ((safeGet(THEME) || 'auto') === 'auto') applyTheme('auto'); };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    }
  }

  /* ---------- 学习进度 ---------- */
  function readProgress() {
    try { return JSON.parse(safeGet(KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function isLearned(id) { return !!readProgress()[id]; }
  function setLearned(id, on) {
    var p = readProgress();
    if (on) p[id] = new Date().toISOString().slice(0, 10); else delete p[id];
    safeSet(KEY, JSON.stringify(p));
    document.dispatchEvent(new CustomEvent('ue-progress'));
  }

  /* ---------- 术语解释 ---------- */
  function initTerms() {
    var tip = null;
    function hide() { if (tip) { tip.classList.remove('on'); } }
    function show(el) {
      var def = el.getAttribute('data-def');
      if (!def) return;
      if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
      tip.textContent = def;
      tip.style.left = '0px'; tip.style.top = '0px';
      tip.classList.add('on');
      var r = el.getBoundingClientRect();
      var tw = tip.offsetWidth, th = tip.offsetHeight;
      var left = Math.min(Math.max(8, r.left), global.innerWidth - tw - 8);
      var top = r.bottom + 8;
      if (top + th > global.innerHeight - 8) top = r.top - th - 8;
      tip.style.left = left + 'px';
      tip.style.top = Math.max(8, top) + 'px';
    }
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('.term');
      if (t) show(t);
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest('.term')) hide();
    });
    document.addEventListener('focusin', function (e) {
      var t = e.target.closest && e.target.closest('.term');
      if (t) show(t);
    });
    document.addEventListener('focusout', hide);
    document.addEventListener('scroll', hide, { passive: true });
  }

  /* ---------- 章节交互 ---------- */
  function initChapter() {
    var id = document.body.getAttribute('data-chapter');
    if (!id) return;
    var bar = document.getElementById('readbar');
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      var secs = document.querySelectorAll('.screen[id]');
      var cur = '';
      for (var i = 0; i < secs.length; i++) {
        if (secs[i].getBoundingClientRect().top <= 120) cur = secs[i].id;
      }
      var links = document.querySelectorAll('.rail a');
      for (var j = 0; j < links.length; j++) {
        links[j].classList.toggle('on', links[j].getAttribute('href') === '#' + cur);
      }
    }
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var mark = document.querySelector('[data-mark-learned]');
    function paintMark() {
      if (!mark) return;
      var on = isLearned(id);
      mark.textContent = on ? '已学会（点击取消）' : '标记为已学会';
      mark.classList.toggle('primary', on);
      mark.classList.toggle('ghost', !on);
    }
    if (mark) {
      paintMark();
      mark.addEventListener('click', function () { setLearned(id, !isLearned(id)); paintMark(); });
      document.addEventListener('ue-progress', paintMark);
    }

    var qs = document.querySelectorAll('.q');
    for (var k = 0; k < qs.length; k++) {
      (function (q) {
        var btns = q.querySelectorAll('.qopts button');
        for (var m = 0; m < btns.length; m++) {
          btns[m].addEventListener('click', function () { q.classList.add('open'); });
        }
        var rev = q.querySelector('.reveal');
        if (rev) rev.addEventListener('click', function () { q.classList.toggle('open'); });
      })(qs[k]);
    }

    var done = document.getElementById('rail-done');
    if (done) done.style.display = isLearned(id) ? 'block' : 'none';
    document.addEventListener('ue-progress', function () {
      if (done) done.style.display = isLearned(id) ? 'block' : 'none';
    });
  }

  /* ---------- 路线图 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function initRoadmap() {
    var mount = document.getElementById('roadmap');
    if (!mount) return;
    var nodes = Array.prototype.slice.call(mount.querySelectorAll('[data-chapter-node]'));
    if (!nodes.length) return;
    var graphNodes = Array.prototype.slice.call(document.querySelectorAll('[data-graph-node]'));
    var edges = Array.prototype.slice.call(document.querySelectorAll('[data-edge-from]'));
    var filters = Array.prototype.slice.call(document.querySelectorAll('[data-branch-filter]'));
    var infos = Array.prototype.slice.call(document.querySelectorAll('[data-branch-info]'));
    var stageBlocks = Array.prototype.slice.call(mount.querySelectorAll('[data-stage]'));
    var note = document.getElementById('branch-note');
    var BRANCH_KEY = 'ue-branch-v1';
    var active = safeGet(BRANCH_KEY) || 'all';

    function chapterBranches(el) {
      return (el.getAttribute('data-branches') || '').split(' ').filter(Boolean);
    }
    function branchLabel(id) {
      for (var i = 0; i < filters.length; i++) {
        if (filters[i].getAttribute('data-branch-filter') === id) return filters[i].textContent.trim();
      }
      return id;
    }
    function warnPrereq(n) {
      var ids = (n.getAttribute('data-prereqs') || '').split(',').filter(Boolean);
      var labels = (n.getAttribute('data-prereq-labels') || '').split('|');
      var missing = [];
      for (var i = 0; i < ids.length; i++) if (!isLearned(ids[i])) missing.push(labels[i] || ids[i]);
      var warn = n.querySelector('.prereq-warn');
      if (warn) {
        warn.hidden = missing.length === 0;
        warn.textContent = missing.length ? '前置未完成：' + missing.join('、') : '';
      }
      n.classList.toggle('blocked', missing.length > 0);
    }
    function paint() {
      var done = 0;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        var id = n.getAttribute('data-chapter-node');
        var on = isLearned(id);
        n.classList.toggle('done', on);
        var badge = n.querySelector('.learned');
        if (badge) badge.hidden = !on;
        var btn = n.querySelector('[data-roadmap-mark]');
        if (btn) btn.textContent = on ? '已学（点击取消）' : '标记已学';
        warnPrereq(n);
        if (on) done++;
      }
      var pctEl = document.getElementById('pct');
      var fill = document.getElementById('fill');
      if (pctEl) pctEl.textContent = Math.round(done / nodes.length * 100) + '%';
      if (fill) fill.style.width = (done / nodes.length * 100) + '%';
      var txt = document.getElementById('progress-note');
      if (txt) txt.textContent = '已学 ' + done + ' / ' + nodes.length + ' 章 · 进度只保存在本机浏览器（localStorage），不上传。';
      for (var g = 0; g < graphNodes.length; g++) {
        var gn = graphNodes[g];
        gn.classList.toggle('done', isLearned(gn.getAttribute('data-graph-node')));
      }
    }
    function applyBranch(b) {
      active = b;
      safeSet(BRANCH_KEY, b);
      var visible = 0;
      for (var i = 0; i < nodes.length; i++) {
        var show = b === 'all' || chapterBranches(nodes[i]).indexOf(b) >= 0;
        nodes[i].hidden = !show;
        if (show) visible++;
      }
      for (var s = 0; s < stageBlocks.length; s++) {
        stageBlocks[s].hidden = !stageBlocks[s].querySelector('[data-chapter-node]:not([hidden])');
      }
      for (var j = 0; j < filters.length; j++) {
        filters[j].classList.toggle('on', filters[j].getAttribute('data-branch-filter') === b);
      }
      for (var k = 0; k < infos.length; k++) infos[k].hidden = infos[k].getAttribute('data-branch-info') !== b;
      var dim = {};
      for (var g = 0; g < graphNodes.length; g++) {
        var gid = graphNodes[g].getAttribute('data-graph-node');
        var off = b !== 'all' && chapterBranches(graphNodes[g]).indexOf(b) < 0;
        graphNodes[g].classList.toggle('dim', off);
        dim[gid] = off;
      }
      for (var e = 0; e < edges.length; e++) {
        var f = edges[e].getAttribute('data-edge-from');
        var t = edges[e].getAttribute('data-edge-to');
        edges[e].classList.toggle('dim', !!(dim[f] || dim[t]));
      }
      if (note) {
        note.textContent = b === 'all'
          ? '主线：按 5 个阶段推进。切换方向后只显示该方向需要的章节，并给出与主线的差异、重点与额外缺口。'
          : '当前视图：' + branchLabel(b) + ' · 显示 ' + visible + ' / ' + nodes.length + ' 章。节点下方的「这章能做什么」是该方向真正要拿到的能力。';
      }
    }
    paint();
    applyBranch(active);
    mount.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-roadmap-mark]');
      if (!b) return;
      e.preventDefault();
      var id = b.getAttribute('data-roadmap-mark');
      setLearned(id, !isLearned(id));
    });
    for (var f = 0; f < filters.length; f++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          applyBranch(btn.getAttribute('data-branch-filter'));
          paint();
        });
      })(filters[f]);
    }
    document.addEventListener('ue-progress', paint);
  }

  /* ---------- 启动 ---------- */
  function boot() {
    initTheme();
    initTerms();
    initChapter();
    initRoadmap();
  }
  global.UE = {
    isLearned: isLearned, setLearned: setLearned, readProgress: readProgress,
    applyTheme: applyTheme, boot: boot
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
