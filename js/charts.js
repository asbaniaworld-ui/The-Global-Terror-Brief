/**
 * 全球恐怖袭击样本数据 — 7 幅 ECharts 交互图表 + 叙事解读
 */
(function () {
  'use strict';

  var P = window.TerrorDataParser;

  var THEME = {
    text: '#111111',
    muted: '#666666',
    grid: 'rgba(0,0,0,0.08)',
    crimson: '#8b0000',
    ink: '#111111',
    paper: '#f7f6f4',
    accent: ['#111', '#333', '#555', '#777', '#999', '#bbb', '#8b0000', '#4a4a4a'],
  };

  var chartRegistry = [];
  var summaryCache = null;
  var narrativeTimers = {};
  var narrativeTypewriters = {};
  var narrativePendingFull = {};
  var narrativeGen = {};
  var TYPEWRITER_MS = 32;

  function $(id) {
    return document.getElementById(id);
  }

  function tokenizeHtml(html) {
    var tokens = [];
    var re = /(<[^>]+>)|([^<]+)/g;
    var m;
    while ((m = re.exec(html))) {
      if (m[1]) tokens.push({ type: 'tag', value: m[1] });
      else if (m[2]) tokens.push({ type: 'text', value: m[2] });
    }
    return tokens;
  }

  function visibleTextLength(html) {
    return tokenizeHtml(html).reduce(function (sum, t) {
      return sum + (t.type === 'text' ? t.value.length : 0);
    }, 0);
  }

  function renderTypewriterHtml(html, visibleChars) {
    var tokens = tokenizeHtml(html);
    var remaining = visibleChars;
    var out = '';
    for (var i = 0; i < tokens.length; i += 1) {
      var tok = tokens[i];
      if (tok.type === 'tag') {
        out += tok.value;
      } else {
        if (remaining <= 0) break;
        var n = Math.min(remaining, tok.value.length);
        out += tok.value.slice(0, n);
        remaining -= n;
      }
    }
    return out;
  }

  function bumpNarrativeGen(id) {
    narrativeGen[id] = (narrativeGen[id] || 0) + 1;
    return narrativeGen[id];
  }

  function setNarrativeRevealed(id, revealed) {
    var el = $(id);
    if (!el) return;
    if (revealed) el.classList.add('is-revealed');
    else el.classList.remove('is-revealed');
  }

  function stopTypewriter(id) {
    var tw = narrativeTypewriters[id];
    if (!tw) return;
    if (tw.timer) clearInterval(tw.timer);
    if (tw.delayTimer) clearTimeout(tw.delayTimer);
    narrativeTypewriters[id] = null;
    var el = $(id);
    if (el) el.classList.remove('is-typing');
  }

  function setNarrativeInstant(id, html, opts) {
    opts = opts || {};
    bumpNarrativeGen(id);
    stopTypewriter(id);
    clearTimeout(narrativeTimers[id]);
    var el = $(id);
    if (!el) return;
    el.classList.remove('is-typing');
    var full = html || '';
    narrativePendingFull[id] = full;
    el.innerHTML = full;
    setNarrativeRevealed(id, !!opts.revealed);
  }

  function flushNarrative(id) {
    var full = narrativePendingFull[id];
    if (!full) return false;
    setNarrativeInstant(id, full, { revealed: true });
    return true;
  }

  function setNarrativeTypewriter(id, html, delayMs) {
    var gen = bumpNarrativeGen(id);
    stopTypewriter(id);
    clearTimeout(narrativeTimers[id]);
    setNarrativeRevealed(id, false);
    var el = $(id);
    if (!el) return;
    var full = html || '';
    narrativePendingFull[id] = full;
    if (!full) {
      el.innerHTML = '';
      return;
    }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setNarrativeInstant(id, full);
      return;
    }

    var total = visibleTextLength(full);
    if (total <= 0) {
      el.innerHTML = full;
      return;
    }

    function startTyping() {
      if (narrativeGen[id] !== gen) return;
      var chars = 0;
      var msPerChar = Math.max(16, Math.min(TYPEWRITER_MS, Math.floor(1400 / total)));
      el.classList.add('is-typing');
      var tw = { timer: null, full: full, id: id, gen: gen };
      narrativeTypewriters[id] = tw;
      el.innerHTML = renderTypewriterHtml(full, 0);
      tw.timer = setInterval(function () {
        if (narrativeGen[id] !== gen) {
          stopTypewriter(id);
          return;
        }
        chars += 1;
        if (chars >= total) {
          setNarrativeInstant(id, full);
          return;
        }
        el.innerHTML = renderTypewriterHtml(full, chars);
      }, msPerChar);
    }

    if (delayMs > 0) {
      narrativeTimers[id] = setTimeout(function () {
        if (narrativeGen[id] !== gen) return;
        startTyping();
      }, delayMs);
      narrativeTypewriters[id] = { delayTimer: narrativeTimers[id], full: full, gen: gen };
    } else {
      startTyping();
    }
  }

  function setNarrative(id, html) {
    setNarrativeInstant(id, html);
  }

  function setNarrativeThrottled(id, html, ms) {
    var gen = bumpNarrativeGen(id);
    clearTimeout(narrativeTimers[id]);
    narrativePendingFull[id] = html || '';
    narrativeTimers[id] = setTimeout(function () {
      if (narrativeGen[id] !== gen) return;
      setNarrativeTypewriter(id, html, 0);
    }, ms || 80);
  }

  function bindNarrativeClickReveal(narrativeId) {
    var el = $(narrativeId);
    if (!el || el.__revealClick) return;
    el.__revealClick = true;
    el.addEventListener('click', function () {
      var pending = narrativePendingFull[narrativeId];
      if (!pending) return;
      var typing =
        el.classList.contains('is-typing') ||
        !!narrativeTypewriters[narrativeId] ||
        !!narrativeTimers[narrativeId];
      if (typing || !el.classList.contains('is-revealed')) {
        setNarrativeInstant(narrativeId, pending, { revealed: true });
      }
    });
  }

  function bindAllNarrativeClickReveal() {
    [
      'narrative-map',
      'narrative-timeline',
      'narrative-sankey',
      'narrative-treemap',
      'narrative-region',
      'narrative-parallel',
      'narrative-calendar',
    ].forEach(bindNarrativeClickReveal);
  }

  function perf() {
    return { animation: false, animationDuration: 0, animationThreshold: 1 };
  }

  function tipLines(lines) {
    return lines
      .filter(function (x) {
        return x != null && x !== '';
      })
      .join('<br/>');
  }

  function tooltipBase(chartDom) {
    return {
      confine: true,
      appendTo: chartDom || undefined,
      className: 'chart-tooltip',
      transitionDuration: 0,
      hideDelay: 60,
      showDelay: 0,
      padding: [4, 7],
      backgroundColor: 'rgba(255,255,255,0.98)',
      borderColor: THEME.ink,
      borderWidth: 1,
      textStyle: {
        color: THEME.text,
        fontSize: 11,
        lineHeight: 14,
        fontFamily: 'Inter, sans-serif',
      },
      enterable: true,
      extraCssText:
        'padding:6px 9px!important;min-height:0!important;height:auto!important;max-width:280px;white-space:normal;word-break:break-word;line-height:1.45!important;box-shadow:0 3px 10px rgba(0,0,0,0.12);border-radius:0;',
    };
  }

  function tickerHeightPx() {
    var raw = getComputedStyle(document.documentElement).getPropertyValue('--ticker-h').trim();
    if (raw.indexOf('rem') !== -1) return parseFloat(raw) * 16;
    if (raw.indexOf('px') !== -1) return parseFloat(raw);
    return 36;
  }

  function measureMount(dom) {
    if (!dom) return { w: 0, h: 0 };
    var figure = dom.closest('.figure');
    var shell = dom.closest('.figure__chart');
    var w = shell && shell.clientWidth > 0 ? shell.clientWidth : dom.clientWidth;
    if (w < 80) w = Math.max(200, (window.innerWidth || 360) - 40);

    var h;
    if (shell && shell.clientHeight >= 100) {
      h = shell.clientHeight;
    } else if (figure) {
      var vh = window.innerHeight || document.documentElement.clientHeight || 640;
      var head = figure.querySelector('.figure__head');
      var narr = figure.querySelector('.figure__narrative');
      var chrome =
        (head ? head.offsetHeight : 0) + (narr ? narr.offsetHeight : 0) + tickerHeightPx() + 24;
      h = Math.floor(vh - chrome);
      h = Math.max(140, Math.min(h, Math.floor(vh * 0.62)));
    } else {
      h = Math.max(200, Math.round((window.innerHeight || 640) * 0.45));
    }

    dom.style.width = '100%';
    dom.style.height = h + 'px';
    dom.style.minHeight = h + 'px';
    dom.style.maxHeight = h + 'px';
    dom.style.position = 'relative';
    return { w: Math.max(w, 200), h: h };
  }

  function layoutAllCharts() {
    document.querySelectorAll('.chart-mount').forEach(measureMount);
    chartRegistry.forEach(resizeChart);
  }

  var layoutDebounceTimer;
  function scheduleLayoutAllCharts(delayMs) {
    clearTimeout(layoutDebounceTimer);
    layoutDebounceTimer = setTimeout(function () {
      requestAnimationFrame(layoutAllCharts);
    }, delayMs == null ? 120 : delayMs);
  }

  function resizeChart(chart) {
    if (!chart || chart.isDisposed()) return;
    try {
      var dom = chart.__mount || chart.getDom();
      if (dom) {
        var size = measureMount(dom);
        chart.resize({ width: size.w, height: size.h });
      } else {
        chart.resize();
      }
    } catch (e) { /* ignore */ }
  }

  function bindLayoutWatchers() {
    if (typeof ResizeObserver === 'undefined') return;
    var targets = [
      document.querySelector('.broadsheet__main'),
      document.querySelector('.broadsheet__grid'),
      document.querySelector('.broadsheet__shell'),
    ];
    targets.forEach(function (el) {
      if (!el || el.__chartLayoutRo) return;
      el.__chartLayoutRo = new ResizeObserver(function () {
        scheduleLayoutAllCharts(80);
      });
      el.__chartLayoutRo.observe(el);
    });
  }

  function initChart(dom) {
    if (!dom || !window.echarts) return null;
    dom.removeAttribute('data-placeholder');
    var size = measureMount(dom);
    var ch = echarts.init(dom, null, {
      renderer: 'canvas',
      width: size.w,
      height: size.h,
      useDirtyRect: false,
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    });
    dom.setAttribute('data-chart-ready', '1');
    ch.__mount = dom;
    chartRegistry.push(ch);
    if (typeof ResizeObserver !== 'undefined') {
      var ro = new ResizeObserver(function () {
        scheduleLayoutAllCharts(60);
      });
      ro.observe(dom.closest('.figure__chart') || dom);
      ro.observe(dom);
      ch.__resizeObserver = ro;
    }
    return ch;
  }

  function safeInitChart(id, fn) {
    try {
      var dom = document.getElementById(id);
      if (dom) measureMount(dom);
      var existing = dom && window.echarts && echarts.getInstanceByDom(dom);
      if (existing && id !== 'chart-region') {
        resizeChart(existing);
        return;
      }
      fn();
      if (dom && window.echarts) {
        var inst = echarts.getInstanceByDom(dom);
        if (inst) {
          measureMount(dom);
          inst.resize({ width: dom.clientWidth, height: parseInt(dom.style.height, 10) || dom.clientHeight });
          setTimeout(function () {
            measureMount(dom);
            inst.resize();
          }, 400);
        }
      }
    } catch (err) {
      console.error('图表初始化失败:', id, err);
      var mount = document.getElementById(id);
      if (mount) {
        mount.innerHTML =
          '<p class="chart-error">图表渲染失败：' + (err.message || err) + '</p>';
      }
    }
  }

  function bootAllCharts() {
    document.querySelectorAll('.chart-mount').forEach(measureMount);
    safeInitChart('chart-map', initMap);
    safeInitChart('chart-timeline', initTimeline);
    safeInitChart('chart-sankey', initSankey);
    safeInitChart('chart-treemap', initTreemap);
    safeInitChart('chart-parallel', initParallel);
    safeInitChart('chart-calendar', initCalendar);
    function bootRegion() {
      safeInitChart('chart-region', initRegion);
    }
    if (window.__worldMapReady) {
      window.__worldMapReady.then(bootRegion);
    } else {
      bootRegion();
    }
    [120, 480, 1200].forEach(function (ms) {
      setTimeout(layoutAllCharts, ms);
    });
  }

  function onVisible(panelId, fn) {
    var panel = document.getElementById(panelId);
    if (!panel) return;
    var run = function () {
      fn();
      setTimeout(function () {
        var mount = panel.querySelector('.chart-mount');
        if (mount && window.echarts) {
          var inst = echarts.getInstanceByDom(mount);
          if (inst) inst.resize();
        }
      }, 680);
    };
    if (window.onPanelVisible) {
      window.onPanelVisible(panel, run);
    } else {
      run();
    }
  }

  function killColor(n) {
    if (n >= 10) return THEME.crimson;
    if (n >= 3) return '#555';
    if (n >= 1) return '#888';
    return '#bbb';
  }

  function loadWorldGeo() {
    if (window.echarts && echarts.getMap('world')) {
      return Promise.resolve(true);
    }
    if (window.__worldMapReady) {
      return window.__worldMapReady.then(function (ok) {
        return !!(ok && echarts.getMap('world'));
      });
    }
    return Promise.resolve(false);
  }

  function shortenLabel(str, max) {
    max = max || 26;
    if (!str || str.length <= max) return str;
    return str.slice(0, max - 1) + '…';
  }

  function chartTitle(text, opts) {
    opts = opts || {};
    return {
      text: text,
      subtext: opts.subtext || '',
      left: 'center',
      top: opts.top != null ? opts.top : 4,
      itemGap: 4,
      textStyle: {
        fontSize: 11,
        fontWeight: 600,
        color: THEME.ink,
        fontFamily: 'Libre Baskerville, Georgia, serif',
      },
      subtextStyle: {
        fontSize: 8,
        color: THEME.muted,
        lineHeight: 12,
      },
    };
  }

  /** 图例放在标题下方，避免重叠 */
  function chartLegend(data, top) {
    return {
      data: data,
      left: 'center',
      top: top != null ? top : 38,
      itemGap: 14,
      itemWidth: 16,
      itemHeight: 8,
      textStyle: { color: THEME.muted, fontSize: 9 },
    };
  }

  function gridWithHeader(extra) {
    return Object.assign(
      { left: 44, right: 44, top: 62, bottom: 58, containLabel: true },
      extra || {}
    );
  }

  /** 仅用于映射颜色，不显示组件（避免竖条） */
  function hiddenColorScale(max, opts) {
    opts = opts || {};
    return {
      show: false,
      type: 'continuous',
      min: 0,
      max: Math.max(1, max),
      seriesIndex: opts.seriesIndex != null ? opts.seriesIndex : 0,
      dimension: opts.dimension != null ? opts.dimension : 2,
      inRange: opts.inRange || { color: ['#d8d6d1', '#666', THEME.crimson] },
    };
  }

  /** 底部水平色带图例（平行于底边）；可传 left/right/bottom 定位 */
  function bottomHorizontalLegend(opts) {
    opts = opts || {};
    var barW = opts.width || 140;
    var half = barW / 2;
    var colors = opts.colors || ['#d8d6d1', '#666', THEME.crimson];
    var group = {
      type: 'group',
      bottom: opts.bottom != null ? opts.bottom : 8,
      children: [
        {
          type: 'text',
          x: -half - 16,
          y: 2,
          style: { text: '低', fill: THEME.muted, font: '8px Inter,sans-serif' },
        },
        {
          type: 'rect',
          x: -half,
          y: 6,
          shape: { width: barW, height: 6 },
          style: {
            fill: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: colors[0] },
                { offset: 0.55, color: colors[1] },
                { offset: 1, color: colors[2] },
              ],
            },
          },
        },
        {
          type: 'text',
          x: half + 8,
          y: 2,
          style: { text: '高', fill: THEME.muted, font: '8px Inter,sans-serif' },
        },
      ],
    };
    if (opts.right != null) {
      group.right = opts.right;
    } else {
      group.left = opts.left != null ? opts.left : 'center';
    }
    return group;
  }

  function horizontalVisualBar(max, opts) {
    return hiddenColorScale(max, opts);
  }

  function thinVisualMap(max, opts) {
    return hiddenColorScale(max, opts);
  }

  /** 底部横向 dataZoom 滑块 */
  function horizontalDataZoomSlider(extra) {
    return Object.assign(
      {
        type: 'slider',
        orient: 'horizontal',
        xAxisIndex: 0,
        filterMode: 'filter',
        left: 48,
        right: 48,
        height: 20,
        bottom: 4,
        borderColor: 'transparent',
        backgroundColor: 'rgba(0,0,0,0.06)',
        fillerColor: 'rgba(139,0,0,0.18)',
        handleSize: 18,
        handleStyle: { color: THEME.crimson, borderWidth: 0, shadowBlur: 2, shadowColor: 'rgba(0,0,0,0.2)' },
        moveHandleSize: 8,
        showDetail: false,
        brushSelect: false,
        showDataShadow: true,
        dataBackground: {
          lineStyle: { color: '#aaa', width: 0.5 },
          areaStyle: { color: 'rgba(139,0,0,0.08)' },
        },
        selectedDataBackground: {
          lineStyle: { color: THEME.crimson, width: 0.8 },
          areaStyle: { color: 'rgba(139,0,0,0.15)' },
        },
      },
      extra || {}
    );
  }

  function tip(chart, extra) {
    return Object.assign({}, tooltipBase(chart && chart.__mount), extra || {});
  }

  function axisCrossPointer() {
    return {
      type: 'cross',
      crossStyle: { color: 'rgba(0,0,0,0.12)', width: 1 },
      label: { backgroundColor: '#333', color: '#fff', fontSize: 9 },
      animation: false,
    };
  }

  function bindChartNarrative(chart, narrativeId, onPoint, defaultHtml) {
    bindInteractiveNarrative(chart, narrativeId, onPoint, defaultHtml);
  }

  /** 悬停联动叙事 + 点击锁定 + 点空白取消 */
  function bindInteractiveNarrative(chart, narrativeId, onPoint, defaultHtml, opts) {
    opts = opts || {};
    chart.__narrativeLocked = false;
    chart.__defaultNarrative = defaultHtml;

    function lockHint(html) {
      return html + ' <span class="narr-lock-hint">（已选中 · 点击空白取消）</span>';
    }

    chart.off('mouseover');
    chart.off('globalout');
    chart.off('click');

    chart.on('mouseover', function (p) {
      if (chart.__narrativeLocked || !onPoint) return;
      var html = onPoint(p);
      if (html) setNarrativeThrottled(narrativeId, html, opts.throttle || 80);
    });
    chart.on('globalout', function () {
      if (!chart.__narrativeLocked && defaultHtml) {
        setNarrativeInstant(narrativeId, defaultHtml);
        setNarrativeRevealed(narrativeId, false);
      }
    });
    chart.on('click', function (p) {
      if (!onPoint) return;
      var html = onPoint(p);
      if (!html) return;
      chart.__narrativeLocked = true;
      setNarrativeInstant(narrativeId, lockHint(html), { revealed: true });
    });

    chart.getZr().off('click');
    chart.getZr().on('click', function (e) {
      if (!e.target && chart.__narrativeLocked) {
        chart.__narrativeLocked = false;
        if (defaultHtml) {
          setNarrativeInstant(narrativeId, defaultHtml);
          setNarrativeRevealed(narrativeId, false);
        }
      }
    });
    bindNarrativeClickReveal(narrativeId);
  }

  function fmtCountryTip(country) {
    var ins = P.countryInsight(country);
    if (!ins) return country || '';
    return tipLines([
      '<b>' + ins.country + '</b>',
      '区域：' + ins.region,
      '袭击 <b>' + ins.events + '</b> 起（占样本 ' + ins.pct + '%）',
      '死亡 <b>' + ins.nkill + '</b> 人 · 受伤 <b>' + ins.nwound + '</b> 人',
      '平均每起致死 ' + ins.avgKill + ' 人',
      ins.topAttack
        ? '主要袭击类型：' + ins.topAttack.name + '（' + ins.topAttack.count + ' 起）'
        : '',
      ins.topGroup ? '主要责任组织：' + ins.topGroup.name : '',
    ]);
  }

  function fmtDayTip(date) {
    var ins = P.dayInsight(date);
    if (!ins) return '';
    var avg = ins.events > 0 ? (ins.nkill / ins.events).toFixed(1) : '0';
    return tipLines([
      '<b>' + ins.date + '</b>',
      '袭击 <b>' + ins.events + '</b> 起（占样本 ' + P.pct(ins.events, summaryCache.count) + '）',
      '死亡 <b>' + ins.nkill + '</b> 人 · 受伤 <b>' + ins.nwound + '</b> 人',
      '平均每起致死 ' + avg + ' 人',
      ins.topCountry
        ? '主要国家：' + ins.topCountry.name + '（' + ins.topCountry.count + ' 起）'
        : '',
      ins.topAttack
        ? '主要类型：' + ins.topAttack.name + '（' + ins.topAttack.count + ' 起）'
        : '',
      ins.topGroup ? '主要组织：' + ins.topGroup.name : '',
      ins.topWeapon ? '主要武器：' + ins.topWeapon.name : '',
    ]);
  }

  function fmtSankeyEdgeTip(source, target) {
    var ins = P.sankeyEdgeInsight(source, target);
    if (!ins) return source + ' → ' + target;
    return tipLines([
      '<b>' + ins.source + ' → ' + ins.target + '</b>',
      '事件 <b>' + ins.events + '</b> 起（占样本 ' + ins.pct + '）',
      '死亡 <b>' + ins.nkill + '</b> 人',
      ins.topGroup
        ? '主要组织：' + ins.topGroup.name + '（' + ins.topGroup.count + ' 起）'
        : '',
      ins.topWeapon
        ? '主要武器：' + ins.topWeapon.name + '（' + ins.topWeapon.count + ' 起）'
        : '',
    ]);
  }

  function fmtSankeyNodeTip(name) {
    var ins = P.sankeyNodeInsight(name);
    if (!ins) return '<b>' + name + '</b>';
    return tipLines([
      '<b>' + ins.name + '</b>',
      ins.role,
      '关联事件 <b>' + ins.events + '</b> 起（占样本 ' + ins.pct + '）',
      '死亡 <b>' + ins.nkill + '</b> 人 · 受伤 <b>' + ins.nwound + '</b> 人',
      ins.topPartner
        ? '主要对接：' + ins.topPartner.name + '（' + ins.topPartner.count + ' 起）'
        : '',
      ins.topAttack ? '常见袭击类型：' + ins.topAttack.name : '',
    ]);
  }

  function fmtTreemapTip(d) {
    if (!d || !d.name) return '';
    if (d.nkill != null && d.value && d.children) {
      var gi = P.groupInsight(d.name, false);
      return tipLines([
        '<b>' + d.name + '</b>（恐怖组织）',
        '袭击 <b>' + d.value + '</b> 起（占样本 ' + P.pct(d.value, summaryCache.count) + '）',
        '死亡 <b>' + d.nkill + '</b> 人' + (gi ? ' · 受伤 ' + gi.nwound + ' 人' : ''),
        gi && gi.avgKill ? '平均每起致死 ' + gi.avgKill + ' 人' : '',
        gi && gi.topAttack ? '主要类型：' + gi.topAttack.name : '',
        gi && gi.topCountry ? '高发国家：' + gi.topCountry.name : '',
        '点击矩形下钻查看武器分布',
      ]);
    }
    return tipLines([
      '<b>' + d.name + '</b>（武器类型）',
      '在组织内使用 <b>' + d.value + '</b> 次',
    ]);
  }

  function fmtMonthDayTip(im, id) {
    var ins = P.monthDayInsight(im, id);
    if (!ins) return '';
    return tipLines([
      '<b>' + ins.label + '</b>（样本内各年该月-日累计）',
      '袭击 <b>' + ins.events + '</b> 起（占样本 ' + ins.pct + '）',
      '死亡 <b>' + ins.nkill + '</b> 人 · 受伤 <b>' + ins.nwound + '</b> 人',
      ins.topCountry
        ? '高发国家：' + ins.topCountry.name + '（' + ins.topCountry.count + '）'
        : '',
      ins.topAttack ? '主类型：' + ins.topAttack.name : '',
      ins.topGroup ? '主组织：' + ins.topGroup.name : '',
      '色深＝该日期在样本中越密集',
    ]);
  }

  function fmtWeekTip(cell) {
    var wd = ['日', '一', '二', '三', '四', '五', '六'];
    return tipLines([
      '<b>' + cell.iyear + ' 年第 ' + cell.iweek + ' 周 · 星期' + wd[cell.weekday] + '</b>',
      '袭击 <b>' + cell.events + '</b> 起',
      '死亡 <b>' + cell.nkill + '</b> 人 · 受伤 <b>' + cell.nwound + '</b> 人',
    ]);
  }

  function fmtRegionTip(country) {
    return fmtCountryTip(country);
  }

  function fmtParallelTip(p) {
    var v = p.value;
    if (!v || !v.length) return '';
    return tipLines([
      '<b>样本路径 #' + (p.dataIndex + 1) + '</b>',
      '武器：' + v[0],
      '区域：' + v[1],
      '袭击类型：' + v[2],
      '死亡区间：' + v[3],
      '责任方：' + v[4],
      '悬停可高亮整条路径，便于发现重复组合',
    ]);
  }

  function narrativeFromCountry(ins) {
    if (!ins) return '';
    return (
      '<strong>' + ins.country + '</strong>（' + ins.region + '）：' +
      ins.events + ' 起（' + ins.pct + '%），死亡 ' + ins.nkill + '。' +
      (ins.topAttack ? ' 主类型 <em>' + ins.topAttack.name + '</em>。' : '') +
      (ins.topGroup ? ' 主组织 <em>' + ins.topGroup.name + '</em>。' : '')
    );
  }

  function narrativeFromDay(ins) {
    if (!ins) return '';
    return (
      '<strong>' + ins.date + '</strong>：' + ins.events + ' 起、' + ins.nkill + ' 人死亡。' +
      (ins.topCountry ? ' 当日半数以上袭击集中在 <em>' + ins.topCountry.name + '</em>。' : '') +
      (ins.topAttack ? ' 以 <em>' + ins.topAttack.name + '</em> 为主。' : '')
    );
  }

  function narrativeFromSankeyEdge(ins) {
    if (!ins) return '';
    return (
      '<strong>桑基路径：</strong>「' + ins.source + '」→「' + ins.target + '」' +
      ins.events + ' 起（' + ins.pct + '%），致死 ' + ins.nkill + '。'
    );
  }

  function narrativeFromSankeyNode(ins) {
    if (!ins) return '';
    return (
      '<strong>' + ins.name + '</strong>（' + ins.role + '）：关联 ' + ins.events +
      ' 起。' + (ins.topPartner ? ' 主要对接 <em>' + ins.topPartner.name + '</em>。' : '')
    );
  }

  function narrativeFromTreemap(d) {
    if (!d || !d.name) return '';
    if (d.nkill != null && d.value) {
      return (
        '<strong>' + d.name + '</strong>：' + d.value + ' 起（' + P.pct(d.value, summaryCache.count) + '），' +
        '累计死亡 <em>' + d.nkill + '</em> 人。' +
        (d.children ? ' 点击可查看该组织常用武器。' : '')
      );
    }
    var gi = P.groupInsight(d.name, true);
    return gi
      ? '<strong>' + d.name + '</strong>（武器）：在样本中 ' + gi.events + ' 起，致死 ' + gi.nkill + '。'
      : '';
  }

  function narrativeFromMonthDay(ins) {
    if (!ins) return '';
    return (
      '<strong>' + ins.label + '</strong>：样本内共 ' + ins.events + ' 起，死亡 ' + ins.nkill +
      ' 人。' + (ins.topCountry ? '高发国家 <em>' + ins.topCountry.name + '</em>。' : '') +
      ' 色深表示该「月-日」在样本中越密集。'
    );
  }

  function narrativeFromWeek(cell) {
    if (!cell) return '';
    var wd = ['日', '一', '二', '三', '四', '五', '六'];
    return (
      '<strong>' + cell.iyear + ' 年第 ' + cell.iweek + ' 周 · 星期' + wd[cell.weekday] + '</strong>：' +
      cell.events + ' 起，死亡 ' + cell.nkill + '。'
    );
  }

  function narrativeFromParallel(v) {
    if (!v) return '';
    return (
      '<strong>个案路径：</strong>' + v[2] + ' · ' + v[0] + ' · ' + v[1] +
      ' · 死亡' + v[3] + ' · ' + v[4] + '。'
    );
  }

  function initMap() {
    var dom = $('chart-map');
    if (!dom) return;
    if (echarts.getInstanceByDom(dom)) return;
    if (dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var countries = P.mapCountryAggregates();
    var maxKill = Math.max.apply(
      null,
      countries.map(function (c) { return c.nkill; }).concat([1])
    );

    chart.setOption(Object.assign({
      backgroundColor: '#faf9f7',
      title: chartTitle('全球袭击热点', {
        subtext: '气泡大小与颜色表示死亡人数',
      }),
      graphic: [bottomHorizontalLegend({ bottom: 10 })],
      grid: { left: 48, right: 22, top: 48, bottom: 36, containLabel: true },
      tooltip: tip(chart, {
        trigger: 'item',
        formatter: function (p) {
          return p.data && p.data.country ? fmtCountryTip(p.data.country) : '';
        },
      }),
      visualMap: hiddenColorScale(maxKill, { dimension: 2, seriesIndex: 0 }),
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          yAxisIndex: 0,
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: true,
        },
      ],
      xAxis: {
        type: 'value',
        name: '经度',
        min: -170,
        max: 170,
        nameLocation: 'middle',
        nameGap: 24,
        nameTextStyle: { color: THEME.muted, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: { color: THEME.muted, fontSize: 9 },
      },
      yAxis: {
        type: 'value',
        name: '纬度',
        min: -55,
        max: 75,
        nameLocation: 'middle',
        nameGap: 38,
        nameTextStyle: { color: THEME.muted, fontSize: 10 },
        splitLine: { lineStyle: { color: THEME.grid } },
        axisLabel: { color: THEME.muted, fontSize: 9 },
      },
      series: [
        {
          type: 'scatter',
          triggerEvent: true,
          data: countries.map(function (c) {
            return {
              name: c.country,
              country: c.country,
              events: c.events,
              nkill: c.nkill,
              nwound: c.nwound,
              value: [c.lon, c.lat, c.nkill + 1],
            };
          }),
          symbolSize: function (val) {
            return Math.max(8, Math.min(22, Math.sqrt(val[2]) * 4));
          },
          itemStyle: { color: THEME.crimson, opacity: 0.85 },
          emphasis: {
            scale: 1.2,
            focus: 'self',
            itemStyle: {
              borderColor: '#fff',
              borderWidth: 2,
              shadowBlur: 10,
              shadowColor: 'rgba(139,0,0,0.35)',
            },
          },
        },
      ],
    }, perf()));

    var countriesSorted = countries.slice().sort(function (a, b) { return b.events - a.events; });
    var killLeader = countries.slice().sort(function (a, b) { return b.nkill - a.nkill; })[0];
    var mapDefault =
      '<strong>地理叙事：</strong>样本覆盖 ' + countries.length + ' 个国家。' +
      '事件最多的是 <em>' + countriesSorted[0].country + '</em>（' + countriesSorted[0].events + ' 起），' +
      '死亡最多的是 <em>' + killLeader.country + '</em>（' + killLeader.nkill + ' 人）。' +
      '滚轮缩放、拖拽平移；悬停/点击气泡锁定解读。';
    setNarrative('narrative-map', mapDefault);
    bindInteractiveNarrative(chart, 'narrative-map', function (p) {
      if (!p.data || !p.data.country) return '';
      return narrativeFromCountry(P.countryInsight(p.data.country));
    }, mapDefault);
  }

  function initTimeline() {
    var dom = $('chart-timeline');
    if (!dom || dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var days = P.aggregateByDay();
    var dates = days.map(function (d) { return d.date; });
    var events = days.map(function (d) { return d.events; });
    var kills = days.map(function (d) { return d.nkill; });

    var peakIdx = 0;
    var killPeakIdx = 0;
    events.forEach(function (v, i) {
      if (v > events[peakIdx]) peakIdx = i;
    });
    kills.forEach(function (v, i) {
      if (v > kills[killPeakIdx]) killPeakIdx = i;
    });
    var maxKill = Math.max.apply(null, kills);

    chart.setOption(Object.assign({
      backgroundColor: 'transparent',
      title: chartTitle('时间趋势', {
        subtext: '柱：每日事件数  ·  线：每日死亡人数',
      }),
      tooltip: tip(chart, {
        trigger: 'axis',
        axisPointer: axisCrossPointer(),
        formatter: function (items) {
          if (!items || !items.length) return '';
          var i = items[0].dataIndex;
          return days[i] ? fmtDayTip(days[i].date) : '';
        },
      }),
      legend: chartLegend(
        [
          { name: '事件数', icon: 'rect' },
          {
            name: '死亡',
            icon: 'path://M0 4 L16 4 M8 4 m-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
          },
        ],
        42
      ),
      grid: gridWithHeader({ bottom: 82 }),
      brush: {
        xAxisIndex: 0,
        brushType: 'lineX',
        brushMode: 'single',
        transformable: false,
        throttleType: 'debounce',
        throttleDelay: 200,
        brushStyle: { borderWidth: 1, color: 'rgba(139,0,0,0.12)', borderColor: THEME.crimson },
        outOfBrush: { colorAlpha: 0.25 },
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          filterMode: 'filter',
          start: 0,
          end: 100,
          zoomOnMouseWheel: true,
          moveOnMouseMove: false,
          preventDefaultMouseMove: true,
          minSpan: 8,
        },
        horizontalDataZoomSlider({ bottom: 6 }),
      ],
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: true,
        axisLabel: {
          color: THEME.muted,
          fontSize: 8,
          rotate: 40,
          margin: 12,
          hideOverlap: false,
          interval: function (idx) {
            if (dates.length <= 12) return true;
            return idx % Math.ceil(dates.length / 12) === 0;
          },
          formatter: function (val) {
            if (!val) return '';
            var parts = String(val).split('-');
            if (parts.length >= 3) return parts[1] + '-' + parts[2];
            return val;
          },
        },
        axisLine: { lineStyle: { color: THEME.grid } },
        axisTick: { alignWithLabel: true },
      },
      yAxis: [
        {
          type: 'value',
          name: '事件',
          nameTextStyle: { color: THEME.muted, fontSize: 10 },
          axisLabel: { color: THEME.muted },
          splitLine: { lineStyle: { color: THEME.grid } },
        },
        {
          type: 'value',
          name: '死亡',
          nameTextStyle: { color: THEME.muted, fontSize: 10 },
          axisLabel: { color: THEME.muted },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: '事件数',
          type: 'bar',
          triggerEvent: true,
          data: events,
          itemStyle: { color: '#333' },
          emphasis: { itemStyle: { color: THEME.crimson } },
        },
        {
          name: '死亡',
          type: 'line',
          triggerEvent: true,
          yAxisIndex: 1,
          data: kills,
          smooth: false,
          symbol: 'circle',
          showSymbol: true,
          symbolSize: function (_val, params) {
            var v = kills[params.dataIndex];
            if (params.dataIndex === killPeakIdx) return 18;
            if (v >= maxKill * 0.45) return 12;
            if (v >= maxKill * 0.2) return 7;
            return 0;
          },
          lineStyle: { width: 2, color: THEME.crimson },
          itemStyle: {
            color: THEME.crimson,
            borderColor: '#fff',
            borderWidth: 1,
          },
          emphasis: {
            scale: 1.4,
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(139,0,0,0.35)' },
          },
          markPoint: {
            symbol: 'circle',
            symbolSize: 16,
            label: { show: true, fontSize: 9, color: THEME.crimson, formatter: '{c}' },
            data: [
              {
                name: dates[killPeakIdx],
                coord: [dates[killPeakIdx], kills[killPeakIdx]],
                value: kills[killPeakIdx],
                itemStyle: { color: THEME.crimson, borderColor: '#fff', borderWidth: 1 },
              },
            ],
          },
        },
      ],
    }, perf()));

    var killPeak = days.slice().sort(function (a, b) { return b.nkill - a.nkill; })[0];
    var totalEv = events.reduce(function (s, v) { return s + v; }, 0);
    var avgDaily = (totalEv / days.length).toFixed(1);
    var timelineDefault =
      '<strong>时间叙事：</strong>' + summaryCache.dateMin + ' 至 ' + summaryCache.dateMax +
      ' 共 ' + days.length + ' 天，日均约 <em>' + avgDaily + '</em> 起。' +
      '事件峰值在 <em>' + dates[peakIdx] + '</em>（' + events[peakIdx] + ' 起），' +
      '死亡峰值在 <em>' + killPeak.date + '</em>（' + killPeak.nkill + ' 人）。' +
      '拖底部滑块或滚轮缩放；在图区横向框选日期；悬停/点击柱线锁定当日解读。';
    setNarrative('narrative-timeline', timelineDefault);
    chart.on('updateAxisPointer', function (e) {
      if (chart.__narrativeLocked) return;
      var idx = e.axesInfo && e.axesInfo[0] && e.axesInfo[0].value;
      if (idx == null || !days[idx]) return;
      var ins = P.dayInsight(days[idx].date);
      if (ins) setNarrativeThrottled('narrative-timeline', narrativeFromDay(ins), 120);
    });
    chart.on('brushSelected', function (params) {
      if (chart.__narrativeLocked) return;
      var batch = params.batch && params.batch[0];
      if (!batch || !batch.selected || !batch.selected.length) return;
      var sel = batch.selected[0];
      if (!sel || !sel.dataIndex || !sel.dataIndex.length) return;
      var idxs = sel.dataIndex;
      var evSum = 0;
      var killSum = 0;
      idxs.forEach(function (i) {
        evSum += events[i] || 0;
        killSum += kills[i] || 0;
      });
      setNarrativeThrottled(
        'narrative-timeline',
        '<strong>框选区间：</strong>' + dates[idxs[0]] + ' 至 ' + dates[idxs[idxs.length - 1]] +
          '，共 <em>' + idxs.length + '</em> 天、<em>' + evSum + '</em> 起袭击、' +
          '<em>' + killSum + '</em> 人死亡。',
        160
      );
    });
    chart.on('click', function (p) {
      if (p.dataIndex == null || !days[p.dataIndex]) return;
      var ins = P.dayInsight(days[p.dataIndex].date);
      if (!ins) return;
      chart.__narrativeLocked = true;
      setNarrativeInstant(
        'narrative-timeline',
        narrativeFromDay(ins) + ' <span class="narr-lock-hint">（已选中 · 点击空白取消）</span>',
        { revealed: true }
      );
    });
    chart.getZr().off('click');
    chart.getZr().on('click', function (e) {
      if (e.target || !chart.__narrativeLocked) return;
      chart.__narrativeLocked = false;
      setNarrativeInstant('narrative-timeline', timelineDefault);
      setNarrativeRevealed('narrative-timeline', false);
    });
    chart.on('globalout', function () {
      if (!chart.__narrativeLocked) {
        setNarrativeInstant('narrative-timeline', timelineDefault);
        setNarrativeRevealed('narrative-timeline', false);
      }
    });
    bindNarrativeClickReveal('narrative-timeline');
  }

  function initSankey() {
    var dom = $('chart-sankey');
    if (!dom) return;
    if (window.echarts && echarts.getInstanceByDom(dom)) return;
    if (dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var sk = P.sankeyAttackToTarget(14);

    chart.setOption(
      Object.assign(
        {
          backgroundColor: 'transparent',
          title: chartTitle('袭击流向', { subtext: '左：攻击类型 → 右：目标类型' }),
          tooltip: tip(chart, {
            trigger: 'item',
            formatter: function (p) {
              if (p.dataType === 'edge' && p.data) {
                return fmtSankeyEdgeTip(p.data.source, p.data.target);
              }
              if (p.dataType === 'node' && p.name) {
                return fmtSankeyNodeTip(p.name);
              }
              return '';
            },
          }),
          series: [
            {
              type: 'sankey',
              triggerEvent: true,
              left: '6%',
              right: '6%',
              top: 44,
              bottom: 20,
              nodeWidth: 12,
              nodeGap: 14,
              layoutIterations: 32,
              orient: 'horizontal',
              draggable: false,
              emphasis: {
                focus: 'adjacency',
                lineStyle: { opacity: 0.72 },
                itemStyle: { borderColor: THEME.crimson, borderWidth: 1 },
              },
              blur: {
                itemStyle: { opacity: 0.25 },
                lineStyle: { opacity: 0.08 },
              },
              data: sk.nodes.map(function (n) {
                return { name: n.name };
              }),
              links: sk.links.map(function (l) {
                return {
                  source: l.source,
                  target: l.target,
                  value: l.value,
                };
              }),
              label: {
                show: true,
                color: THEME.text,
                fontSize: 8,
                formatter: function (params) {
                  return shortenLabel(params.name, 24);
                },
              },
              lineStyle: {
                color: THEME.crimson,
                curveness: 0.5,
                opacity: 0.32,
              },
              itemStyle: {
                color: '#333',
                borderColor: '#fff',
                borderWidth: 1,
              },
            },
          ],
        },
        perf()
      )
    );

    var top = sk.links[0];
    var sankeyDefault =
      '<strong>桑基叙事：</strong>左为攻击类型、右为目标类型，带状宽度表示事件量。' +
      (top
        ? ' 最繁忙通道：<em>' + top.source + ' → ' + top.target + '</em>（' + top.value + ' 起）。'
        : '') +
      ' 悬停高亮邻接路径；点击节点/通道锁定解读。';
    setNarrative('narrative-sankey', sankeyDefault);
    bindInteractiveNarrative(chart, 'narrative-sankey', function (p) {
      if (p.dataType === 'edge' && p.data) {
        return narrativeFromSankeyEdge(P.sankeyEdgeInsight(p.data.source, p.data.target));
      }
      if (p.dataType === 'node' && p.name) {
        return narrativeFromSankeyNode(P.sankeyNodeInsight(p.name));
      }
      return '';
    }, sankeyDefault);
  }

  function initTreemap() {
    var dom = $('chart-treemap');
    if (!dom || dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var tree = P.treemapByGroup(12);

    chart.setOption(Object.assign({
      backgroundColor: 'transparent',
      title: chartTitle('恐怖组织'),
      tooltip: tip(chart, {
        formatter: function (p) {
          return fmtTreemapTip(p.data);
        },
      }),
      series: [
        {
          type: 'treemap',
          triggerEvent: true,
          roam: 'scale',
          nodeClick: 'zoomToNode',
          breadcrumb: { show: true, height: 18, itemStyle: { color: THEME.muted, fontSize: 9 } },
          label: { show: true, formatter: '{b}', fontSize: 9, color: '#fff' },
          upperLabel: { show: true, height: 18, color: '#fff', fontSize: 9 },
          emphasis: {
            focus: 'descendant',
            itemStyle: { borderColor: THEME.crimson, borderWidth: 2, gapWidth: 1 },
            label: { fontWeight: 'bold' },
          },
          itemStyle: { borderColor: '#fff', borderWidth: 1, gapWidth: 2 },
          levels: [
            { itemStyle: { borderWidth: 2 } },
            {
              colorSaturation: [0.35, 0.65],
              itemStyle: {
                borderColorSaturation: 0.5,
                gapWidth: 2,
              },
            },
          ],
          data: tree.children,
          visualDimension: 0,
          visualMin: 0,
          visualMax: 80,
          colorMappingBy: 'index',
          color: ['#bbb', '#999', '#777', '#555', '#333', THEME.crimson],
        },
      ],
    }, perf()));

    var topG = tree.children[0];
    var unknownG = tree.children.filter(function (c) { return c.name === 'Unknown'; })[0];
    var treemapDefault =
      '<strong>组织叙事：</strong>矩形面积=袭击次数，颜色深度≈死亡规模。' +
      '<em>' + (topG ? topG.name : '') + '</em> 记录最多（' + (topG ? topG.value : 0) + ' 起）。' +
      (unknownG ? ' 另有大量 <em>Unknown</em> 责任方（' + unknownG.value + ' 起），提示归因困难。' : '') +
      ' 悬停/点击锁定；点击下钻武器，滚轮缩放，面包屑返回。';
    setNarrative('narrative-treemap', treemapDefault);
    bindInteractiveNarrative(chart, 'narrative-treemap', function (p) {
      return p.data && p.data.name ? narrativeFromTreemap(p.data) : '';
    }, treemapDefault);
    chart.on('treemapRootToNode', function (p) {
      if (chart.__narrativeLocked) return;
      if (p.treePathInfo && p.treePathInfo.length > 1) {
        var node = p.treePathInfo[p.treePathInfo.length - 1];
        if (node && node.name) {
          setNarrative(
            'narrative-treemap',
            '<strong>下钻：</strong>正在查看 <em>' + node.name + '</em> 的武器构成。点击面包屑可返回。'
          );
        }
      } else if (chart.__defaultNarrative) {
        setNarrative('narrative-treemap', chart.__defaultNarrative);
      }
    });
  }

  function regionMapOption(chart, countryPoints, maxPt) {
    return Object.assign(
      {
        backgroundColor: '#faf9f7',
        tooltip: tip(chart, {
          trigger: 'item',
          formatter: function (p) {
            if (p.data && p.data.country) return fmtRegionTip(p.data.country);
            return p.name || '';
          },
        }),
        title: chartTitle('地区分布', { subtext: '圆点大小 = 该国袭击次数' }),
        graphic: [bottomHorizontalLegend({ bottom: 8 })],
        visualMap: hiddenColorScale(maxPt, { seriesIndex: 1, dimension: 2 }),
        geo: {
          map: 'world',
          roam: true,
          scaleLimit: { min: 0.85, max: 8 },
          zoom: 1.15,
          center: [20, 20],
          top: 46,
          bottom: 36,
          itemStyle: {
            areaColor: '#e8e6e1',
            borderColor: '#999',
            borderWidth: 0.4,
          },
          emphasis: {
            itemStyle: { areaColor: '#d4d2cd' },
            label: { show: false },
          },
        },
        series: [
          {
            name: '世界底图',
            type: 'map',
            map: 'world',
            geoIndex: 0,
            silent: true,
            itemStyle: {
              areaColor: '#e8e6e1',
              borderColor: '#999',
              borderWidth: 0.4,
            },
            emphasis: { disabled: true },
          },
          {
            name: '袭击次数',
            type: 'scatter',
            triggerEvent: true,
            coordinateSystem: 'geo',
            geoIndex: 0,
            zlevel: 2,
            data: countryPoints.map(function (c) {
              return {
                name: c.country,
                country: c.country,
                value: [c.lon, c.lat, c.events],
                events: c.events,
                nkill: c.nkill,
              };
            }),
            symbolSize: function (val) {
              return Math.max(8, Math.min(40, Math.sqrt(val[2]) * 6.5));
            },
            itemStyle: {
              color: THEME.crimson,
              opacity: 0.9,
              shadowBlur: 6,
              shadowColor: 'rgba(139,0,0,0.25)',
            },
            emphasis: {
              scale: 1.15,
              itemStyle: { borderColor: '#fff', borderWidth: 1 },
              label: {
                show: true,
                formatter: '{b}',
                fontSize: 8,
                color: THEME.ink,
                position: 'right',
              },
            },
            label: { show: false },
          },
        ],
      },
      perf()
    );
  }

  function initRegion() {
    var dom = $('chart-region');
    if (!dom) return;

    var chart = window.echarts && echarts.getInstanceByDom(dom);
    if (!chart) {
      if (dom.__inited) return;
      dom.__inited = true;
      chart = initChart(dom);
      if (!chart) return;
    }

    var countryPoints = P.mapCountryAggregates();
    var maxPt = Math.max.apply(
      null,
      countryPoints.map(function (c) { return c.events; }).concat([1])
    );
    var regions = P.mapRegionAggregates();
    var zh = P.regionLabelsZh();

    function bindRegionEvents(hasWorld) {
      var topC = countryPoints.slice().sort(function (a, b) { return b.events - a.events; })[0];
      var lead = regions.slice().sort(function (a, b) { return b.value - a.value; })[0];
      var leadIns = lead && lead.insight;
      var regionDefault =
        '<strong>地图叙事：</strong>' +
        (hasWorld ? '世界地图按国家打点' : '地图加载失败，已用坐标示意') +
        '，<em>圆点越大 = 袭击次数越多</em>（' + countryPoints.length + ' 国）。' +
        (topC ? ' 最多的是 <em>' + topC.country + '</em>（' + topC.events + ' 起）。' : '') +
        (leadIns
          ? ' <em>' + (zh[lead.name] || lead.name) + '</em> 区域占比 ' + leadIns.pct + '%。'
          : '') +
        ' 可拖拽缩放地图，悬停/点击圆点锁定解读。';
      setNarrative('narrative-region', regionDefault);
      if (!chart.__regionNarrativeBound) {
        chart.__regionNarrativeBound = true;
        bindInteractiveNarrative(chart, 'narrative-region', function (p) {
          if (p.data && p.data.country) {
            return narrativeFromCountry(P.countryInsight(p.data.country));
          }
          return '';
        }, regionDefault);
      } else {
        chart.__defaultNarrative = regionDefault;
        if (!chart.__narrativeLocked) {
          setNarrativeInstant('narrative-region', regionDefault);
          setNarrativeRevealed('narrative-region', false);
        }
      }
    }

    function paintRegion(hasWorld) {
      if (hasWorld) {
        chart.setOption(regionMapOption(chart, countryPoints, maxPt), true);
      } else {
        chart.setOption(
          Object.assign(
            {
              backgroundColor: '#faf9f7',
              title: {
                text: '地图数据未加载',
                subtext: '请确认 data/world.json 存在并刷新',
                left: 'center',
                top: 'middle',
                textStyle: { fontSize: 11, color: THEME.muted, fontWeight: 'normal' },
                subtextStyle: { fontSize: 9, color: THEME.muted },
              },
            },
            perf()
          ),
          true
        );
      }
      bindRegionEvents(hasWorld);
      measureMount(dom);
      resizeChart(chart);
    }

    loadWorldGeo().then(function (ok) {
      paintRegion(!!ok && !!echarts.getMap('world'));
    });
  }

  function initCalendar() {
    var dom = $('chart-calendar');
    if (!dom || dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var sum = summaryCache || P.summary();
    var rangeStart = sum.dateMin;
    var rangeEnd = sum.dateMax;
    var calData = P.calendarDailyHeatmapData();
    var days = P.aggregateByDay();
    var maxEv = 0;
    days.forEach(function (d) {
      if (d.events > maxEv) maxEv = d.events;
    });
    if (!maxEv) maxEv = 1;

    var weekPack = P.weekGridHeatmapFocused();
    var weekData = weekPack.data;
    var weekLabels = weekPack.labels;
    var weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];
    var maxWeekEv = 0;
    weekData.forEach(function (row) {
      if (row[2] > maxWeekEv) maxWeekEv = row[2];
    });
    if (!maxWeekEv) maxWeekEv = 1;

    var peak = days.slice().sort(function (a, b) { return b.events - a.events; })[0];
    var rangeLabel = rangeStart === rangeEnd ? rangeStart : rangeStart + ' 至 ' + rangeEnd;

    chart.setOption(Object.assign({
      backgroundColor: 'transparent',
      title: [
        {
          text: '样本期 · 公历日（' + days.length + ' 天）',
          left: 10,
          top: 0,
          textStyle: { fontSize: 9, fontWeight: 600, color: THEME.text },
        },
        {
          text: '周度 · ISO 第 ' + weekPack.minWeek + '–' + weekPack.maxWeek + ' 周',
          left: 10,
          top: '48%',
          textStyle: { fontSize: 9, fontWeight: 600, color: THEME.text },
        },
      ],
      tooltip: tip(chart, {
        trigger: 'item',
        formatter: function (p) {
          if (!p || p.data == null) return '';
          if (p.seriesType === 'heatmap' && p.seriesIndex === 1) {
            var cell = p.data[3];
            return cell ? fmtWeekTip(cell) : '';
          }
          var raw = p.data;
          var dateStr = Array.isArray(raw) ? raw[0] : raw;
          if (!dateStr) return '';
          return fmtDayTip(String(dateStr));
        },
      }),
      visualMap: [
        hiddenColorScale(maxEv, {
          seriesIndex: 0,
          dimension: 1,
          inRange: {
            color: ['#f0efec', '#d4d2cc', '#a8a6a0', '#6b6964', '#8b0000'],
          },
        }),
        hiddenColorScale(maxWeekEv, {
          seriesIndex: 1,
          dimension: 2,
          inRange: {
            color: ['#f7f6f4', '#ccc', '#888', '#444', '#8b0000'],
          },
        }),
      ],
      graphic: [
        bottomHorizontalLegend({
          right: 10,
          bottom: '56%',
          width: 100,
          colors: ['#f0efec', '#6b6964', '#8b0000'],
        }),
        bottomHorizontalLegend({
          bottom: 6,
          width: 100,
          colors: ['#f7f6f4', '#888', '#8b0000'],
        }),
      ],
      calendar: {
        top: 20,
        left: 28,
        right: 16,
        bottom: '60%',
        range: [rangeStart, rangeEnd],
        cellSize: ['auto', 18],
        splitLine: { show: true, lineStyle: { color: THEME.grid, width: 0.5 } },
        itemStyle: {
          borderWidth: 0.5,
          borderColor: '#fff',
          color: '#faf9f7',
        },
        yearLabel: { show: false },
        monthLabel: {
          nameMap: 'cn',
          color: THEME.muted,
          fontSize: 9,
        },
        dayLabel: {
          firstDay: 1,
          nameMap: ['日', '一', '二', '三', '四', '五', '六'],
          color: THEME.muted,
          fontSize: 8,
        },
      },
      grid: {
        top: '55%',
        left: 40,
        right: 16,
        bottom: 32,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: weekLabels,
        splitArea: { show: true },
        axisLabel: { color: THEME.muted, fontSize: 8, interval: 0 },
        axisLine: { lineStyle: { color: THEME.grid } },
      },
      yAxis: {
        type: 'category',
        data: weekdayLabels,
        splitArea: { show: true },
        axisLabel: { color: THEME.muted, fontSize: 9 },
        axisLine: { lineStyle: { color: THEME.grid } },
      },
      series: [
        {
          type: 'heatmap',
          triggerEvent: true,
          coordinateSystem: 'calendar',
          data: calData,
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(139,0,0,0.4)', borderColor: THEME.ink, borderWidth: 1 },
          },
        },
        {
          type: 'heatmap',
          triggerEvent: true,
          data: weekData,
          label: {
            show: true,
            formatter: function (p) {
              return p.data[2] > 0 ? p.data[2] : '';
            },
            fontSize: 8,
            color: THEME.ink,
          },
          emphasis: {
            itemStyle: { borderColor: THEME.ink, borderWidth: 1, shadowBlur: 6 },
            label: { fontWeight: 'bold', fontSize: 9 },
          },
        },
      ],
    }, perf()));

    var calendarDefault =
      '<strong>周期叙事：</strong>样本覆盖 <em>' + rangeLabel + '</em>（' + days.length + ' 天），' +
      '上图按<strong>实际日期</strong>逐日计数，下图仅展示有数据的 ISO 周（W' +
      weekPack.minWeek + '–W' + weekPack.maxWeek + '）。' +
      (peak
        ? ' 最密集的是 <em>' + peak.date + '</em>（' + peak.events + ' 起）。'
        : '') +
      ' 悬停/点击格子锁定解读。';
    setNarrative('narrative-calendar', calendarDefault);
    bindInteractiveNarrative(chart, 'narrative-calendar', function (p) {
      if (p.seriesIndex === 1 && p.data && p.data[3]) {
        return narrativeFromWeek(p.data[3]);
      }
      if (p.seriesIndex === 0 && p.data) {
        var dateStr = Array.isArray(p.data) ? p.data[0] : p.data;
        return narrativeFromDay(P.dayInsight(String(dateStr)));
      }
      return '';
    }, calendarDefault);
  }

  function initParallel() {
    var dom = $('chart-parallel');
    if (!dom || dom.__inited) return;
    dom.__inited = true;
    var chart = initChart(dom);
    if (!chart) return;

    var dims = P.parallelDimensions();
    var schema = dims.map(function (d) {
      return { dim: d.dim, name: d.name, type: 'category', data: d.values };
    });
    var data = P.parallelSample(100);

    chart.setOption(Object.assign({
      backgroundColor: 'transparent',
      tooltip: tip(chart, {
        show: true,
        trigger: 'item',
        formatter: fmtParallelTip,
      }),
      brush: {
        parallelAxisIndex: 'all',
        brushType: 'lineX',
        brushMode: 'single',
        throttleType: 'debounce',
        throttleDelay: 300,
        brushStyle: { borderWidth: 1, color: 'rgba(139,0,0,0.12)', borderColor: THEME.crimson },
        outOfBrush: { opacity: 0.06 },
      },
      parallelAxis: schema.map(function (s) {
        return {
          dim: s.dim,
          name: s.name,
          nameLocation: 'start',
          nameGap: 14,
          nameTextStyle: { fontSize: 9, color: THEME.text },
          type: 'category',
          data: s.data,
          axisLine: { lineStyle: { color: THEME.grid } },
          axisTick: { show: false },
          axisLabel: { color: THEME.muted, fontSize: 7, interval: 'auto', width: 44, overflow: 'truncate' },
        };
      }),
      parallel: {
        left: 48,
        right: 48,
        top: 8,
        bottom: 10,
        parallelAxisDefault: {
          type: 'category',
          nameLocation: 'start',
          nameGap: 14,
          nameTextStyle: { fontSize: 9, color: THEME.text },
        },
      },
      series: [
        {
          type: 'parallel',
          triggerEvent: true,
          lineStyle: { width: 0.5, opacity: 0.18, color: '#666' },
          emphasis: { lineStyle: { width: 1.2, opacity: 0.7, color: THEME.crimson } },
          inactiveOpacity: 0.03,
          activeOpacity: 0.85,
          progressive: 80,
          data: data,
        },
      ],
    }, perf()));

    var parallelDefault =
      '<strong>多维叙事：</strong>平行坐标展示 ' + data.length + ' 条抽样路径。' +
      '若多条线在某两轴间重叠，说明该武器—区域或类型—死亡区间组合反复出现。' +
      '在轴上<strong>拖拽刷选</strong>可筛选路径；悬停/点击单线锁定解读。';
    setNarrative('narrative-parallel', parallelDefault);
    bindInteractiveNarrative(chart, 'narrative-parallel', function (p) {
      return p.value ? narrativeFromParallel(p.value) : '';
    }, parallelDefault);
    chart.on('brushSelected', function (params) {
      if (chart.__narrativeLocked) return;
      var batch = params.batch && params.batch[0];
      if (!batch || !batch.selected || !batch.selected.length) return;
      var sel = batch.selected[0];
      var count = sel && sel.dataIndex ? sel.dataIndex.length : 0;
      if (!count) return;
      setNarrativeThrottled(
        'narrative-parallel',
        '<strong>刷选结果：</strong>当前筛选保留 <em>' + count + '</em> 条路径（占 ' +
          P.pct(count, data.length) + '）。可继续调整刷选或点击空白恢复。',
        200
      );
    });
  }

  function updatePageCopy(sum) {
    var deck = $('lead-deck');
    if (deck) {
      var regions = P.aggregateByRegion();
      var lead = regions[0];
      var zh = P.regionLabelsZh();
      deck.textContent =
        '本样本记录 ' + sum.count + ' 起恐怖袭击（' + sum.dateMin + ' 至 ' + sum.dateMax + '），' +
        '共致 ' + sum.totalKill + ' 人死亡、' + sum.totalWound + ' 人受伤。' +
        (lead
          ? ' 其中 ' + (zh[lead.name] || lead.name) + ' 事件最多（' + lead.value + ' 起）。'
          : '') +
        ' 向下滚动，七幅图表将依次浮现；悬停/点击/刷选可联动上方叙事解读。';
    }
    var stat = $('edition-stat');
    if (stat) stat.textContent = sum.count + ' Events · ' + sum.totalKill + ' Fatalities';
  }

  function loadData() {
    if (!P) throw new Error('data-parser.js 未加载');
    var rows = window.TERROR_ATTACKS_DATA;
    if (!rows || !rows.length) {
      throw new Error('terror-data.js 未加载或数据为空');
    }
    P.setRecords(rows);
    summaryCache = P.summary();
    updatePageCopy(summaryCache);
    document.dispatchEvent(
      new CustomEvent('dashboard:data-ready', { detail: summaryCache })
    );
    return summaryCache;
  }

  window.ChartMounts = {
    map: $('chart-map'),
    timeline: $('chart-timeline'),
    sankey: $('chart-sankey'),
    treemap: $('chart-treemap'),
    region: $('chart-region'),
    parallel: $('chart-parallel'),
    calendar: $('chart-calendar'),
  };

  window.DashboardCharts = {
    layoutAllCharts: layoutAllCharts,
    resizeAll: layoutAllCharts,
  };

  var onViewportChange = function () {
    scheduleLayoutAllCharts(160);
  };
  window.addEventListener('resize', onViewportChange);
  window.addEventListener('orientationchange', onViewportChange);
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onViewportChange);
  }

  document.addEventListener('panel:visible', function (ev) {
    var panel = ev.target;
    if (!panel || !panel.querySelectorAll) return;
    scheduleLayoutAllCharts(0);
    scheduleLayoutAllCharts(480);
    scheduleLayoutAllCharts(920);
    var chartShell = panel.querySelector('.figure__chart');
    if (chartShell) {
      chartShell.addEventListener('animationend', function handler(e) {
        if (e.animationName === 'fig-ink' || e.animationName === 'fig-rise') {
          chartShell.removeEventListener('animationend', handler);
          layoutAllCharts();
        }
      });
    }
  });

  try {
    if (!window.echarts) {
      throw new Error('ECharts 未加载（请联网刷新，或检查 CDN 是否被拦截）');
    }
    if (!window.TerrorDataParser) {
      throw new Error('data-parser.js 未加载');
    }
    if (!window.TERROR_ATTACKS_DATA || !window.TERROR_ATTACKS_DATA.length) {
      throw new Error('terror-data.js 未加载或为空');
    }
    loadData();
    bindAllNarrativeClickReveal();
    bindLayoutWatchers();
    onVisible('fig-01', function () { safeInitChart('chart-map', initMap); });
    onVisible('fig-02', function () { safeInitChart('chart-timeline', initTimeline); });
    onVisible('fig-03', function () { safeInitChart('chart-sankey', initSankey); });
    onVisible('fig-04', function () { safeInitChart('chart-treemap', initTreemap); });
    onVisible('fig-05', function () { safeInitChart('chart-region', initRegion); });
    onVisible('fig-06', function () { safeInitChart('chart-parallel', initParallel); });
    onVisible('fig-07', function () { safeInitChart('chart-calendar', initCalendar); });

    function scheduleBoot() {
      requestAnimationFrame(function () {
        requestAnimationFrame(bootAllCharts);
      });
    }
    if (document.readyState === 'complete') {
      scheduleBoot();
    } else {
      window.addEventListener('load', scheduleBoot);
    }
  } catch (err) {
    console.error(err);
    document.querySelectorAll('.chart-mount').forEach(function (el) {
      el.innerHTML = '<p class="chart-error">加载失败：' + err.message + '</p>';
    });
    setNarrative('narrative-map', '请确认已引入 js/terror-data.js，并直接双击打开 index.html 即可（无需本地服务器）。');
  }
})();
