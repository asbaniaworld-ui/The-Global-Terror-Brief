/**
 * 全球恐怖袭击样本数据解析与聚合
 * 源：全球恐怖袭击信息数据（样本数据）.xlsx → data/terror-attacks.json
 */
(function (global) {
  'use strict';

  var records = [];

  /** 国家/地区 → [经度, 纬度]（质心近似，用于无坐标散点） */
  var COUNTRY_CENTROIDS = {
    Afghanistan: [67.7, 33.9],
    Argentina: [-63.6, -38.4],
    Australia: [133.8, -25.3],
    'Burkina Faso': [-1.6, 12.2],
    Cameroon: [12.4, 7.4],
    'Central African Republic': [20.9, 6.6],
    Chile: [-71.5, -35.7],
    China: [104.2, 35.9],
    Colombia: [-74.3, 4.6],
    Cyprus: [33.4, 35.1],
    'Democratic Republic of the Congo': [23.7, -2.9],
    Egypt: [30.8, 26.8],
    Ethiopia: [39.6, 9.1],
    Germany: [10.5, 51.2],
    Ghana: [-1.0, 7.9],
    Greece: [21.8, 39.1],
    India: [78.9, 20.6],
    Iraq: [43.7, 33.2],
    Israel: [34.9, 31.0],
    Kazakhstan: [66.9, 48.0],
    Kenya: [37.9, -0.02],
    Lebanon: [35.9, 33.9],
    Mali: [-3.5, 17.6],
    Mozambique: [35.5, -18.7],
    Nepal: [84.1, 28.4],
    Netherlands: [5.3, 52.1],
    'New Caledonia': [165.6, -21.1],
    Niger: [9.4, 17.6],
    Nigeria: [8.7, 9.1],
    Pakistan: [69.3, 30.4],
    Philippines: [122.0, 12.9],
    Russia: [105.3, 61.5],
    'Saudi Arabia': [45.1, 23.9],
    Somalia: [46.2, 5.2],
    Sudan: [30.2, 12.9],
    Syria: [38.9, 34.8],
    Thailand: [100.9, 15.9],
    'Trinidad and Tobago': [-61.2, 10.4],
    Tunisia: [9.5, 33.9],
    Turkey: [35.2, 39.0],
    'United Kingdom': [-3.4, 55.4],
    'United States': [-95.7, 37.1],
    Venezuela: [-66.6, 6.4],
    'West Bank and Gaza Strip': [35.2, 31.9],
    Yemen: [48.5, 15.6],
  };

  function num(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : Math.max(0, n);
  }

  function norm(s) {
    if (s == null || s === '') return 'Unknown';
    return String(s).trim();
  }

  function firstToken(s) {
    var t = norm(s);
    var i = t.indexOf(',');
    return i > -1 ? t.slice(0, i).trim() : t;
  }

  function setRecords(rows) {
    records = (rows || []).map(function (r) {
      var d = r.date ? String(r.date).slice(0, 10) : null;
      return {
        eventId: norm(r.eventId),
        date: d,
        country: norm(r.country),
        city: norm(r.city),
        group: norm(r.group),
        nkill: num(r.nkill),
        nwound: num(r.nwound),
        targetType: norm(r.targetType),
        region: norm(r.region),
        attackType: norm(r.attackType),
        attackTypeShort: firstToken(r.attackType),
        weaponType: norm(r.weaponType),
        weaponTypeShort: firstToken(r.weaponType),
      };
    }).filter(function (r) { return r.date; });
  }

  function getRecords() {
    return records.slice();
  }

  function summary() {
    var totalKill = 0;
    var totalWound = 0;
    var dates = [];
    records.forEach(function (r) {
      totalKill += r.nkill;
      totalWound += r.nwound;
      dates.push(r.date);
    });
    dates.sort();
    return {
      count: records.length,
      totalKill: totalKill,
      totalWound: totalWound,
      dateMin: dates[0] || '',
      dateMax: dates[dates.length - 1] || '',
    };
  }

  function aggregateByDay() {
    var map = {};
    records.forEach(function (r) {
      if (!map[r.date]) map[r.date] = { date: r.date, events: 0, nkill: 0, nwound: 0 };
      map[r.date].events += 1;
      map[r.date].nkill += r.nkill;
      map[r.date].nwound += r.nwound;
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }

  /** 从 YYYY-MM-DD 解析发生月、日（对应源数据 imonth / iday） */
  function parseMonthDay(dateStr) {
    if (!dateStr) return null;
    var parts = String(dateStr).slice(0, 10).split('-');
    if (parts.length < 3) return null;
    var imonth = parseInt(parts[1], 10);
    var iday = parseInt(parts[2], 10);
    if (isNaN(imonth) || isNaN(iday) || imonth < 1 || imonth > 12 || iday < 1 || iday > 31) {
      return null;
    }
    return { imonth: imonth, iday: iday };
  }

  /** 按公历月-日聚合（跨年份叠加，用于年度周期性日历热力图） */
  function aggregateByMonthDay() {
    var map = {};
    records.forEach(function (r) {
      var md = parseMonthDay(r.date);
      if (!md) return;
      var key = md.imonth + '-' + md.iday;
      if (!map[key]) {
        map[key] = {
          imonth: md.imonth,
          iday: md.iday,
          events: 0,
          nkill: 0,
          nwound: 0,
          dates: {},
        };
      }
      map[key].events += 1;
      map[key].nkill += r.nkill;
      map[key].nwound += r.nwound;
      map[key].dates[r.date] = true;
    });
    return Object.keys(map)
      .sort(function (a, b) {
        var pa = a.split('-').map(Number);
        var pb = b.split('-').map(Number);
        return pa[0] - pb[0] || pa[1] - pb[1];
      })
      .map(function (k) {
        var o = map[k];
        o.spanYears = Object.keys(o.dates).length;
        delete o.dates;
        return o;
      });
  }

  /** ECharts 日历热力图序列：[ 'YYYY-MM-DD', count ]（按实际日期，非月-日叠加） */
  function calendarDailyHeatmapData() {
    return aggregateByDay().map(function (d) {
      return [d.date, d.events];
    });
  }

  /** ECharts 日历热力图序列：[ 'YYYY-MM-DD', count ] */
  function calendarHeatmapData(refYear) {
    refYear = refYear || 2020;
    var rows = aggregateByMonthDay();
    return rows.map(function (d) {
      var mm = ('0' + d.imonth).slice(-2);
      var dd = ('0' + d.iday).slice(-2);
      return [refYear + '-' + mm + '-' + dd, d.events];
    });
  }

  /** ISO 周序（1–53）与星期（0=周日 … 6=周六） */
  function isoWeekParts(dateStr) {
    var d = new Date(dateStr + 'T12:00:00');
    if (isNaN(d.getTime())) return null;
    var day = d.getDay();
    var thu = new Date(d);
    thu.setDate(d.getDate() + 4 - (day || 7));
    var yearStart = new Date(thu.getFullYear(), 0, 1);
    var week = Math.ceil((((thu - yearStart) / 86400000) + 1) / 7);
    return { iyear: thu.getFullYear(), iweek: week, weekday: day };
  }

  /** 周度网格：按 ISO 周 × 星期聚合 */
  function aggregateByWeekGrid() {
    var map = {};
    records.forEach(function (r) {
      var w = isoWeekParts(r.date);
      if (!w) return;
      var key = w.iyear + '-' + w.iweek + '-' + w.weekday;
      if (!map[key]) {
        map[key] = {
          iyear: w.iyear,
          iweek: w.iweek,
          weekday: w.weekday,
          events: 0,
          nkill: 0,
          nwound: 0,
        };
      }
      map[key].events += 1;
      map[key].nkill += r.nkill;
      map[key].nwound += r.nwound;
    });
    return Object.values(map);
  }

  function weekGridHeatmapData() {
    var cells = aggregateByWeekGrid();
    var maxWeek = 1;
    cells.forEach(function (c) {
      if (c.iweek > maxWeek) maxWeek = c.iweek;
    });
    var data = cells.map(function (c) {
      return [c.iweek - 1, c.weekday, c.events, c];
    });
    return { data: data, maxWeek: maxWeek };
  }

  /** 周度网格：仅包含有数据的 ISO 周区间（避免 W1–W52 大量空白） */
  function weekGridHeatmapFocused() {
    var cells = aggregateByWeekGrid();
    if (!cells.length) {
      return { data: [], labels: ['W1'], minWeek: 1, maxWeek: 1 };
    }
    var minWeek = cells[0].iweek;
    var maxWeek = cells[0].iweek;
    cells.forEach(function (c) {
      if (c.iweek < minWeek) minWeek = c.iweek;
      if (c.iweek > maxWeek) maxWeek = c.iweek;
    });
    var labels = [];
    for (var w = minWeek; w <= maxWeek; w += 1) {
      labels.push('W' + w);
    }
    var data = cells.map(function (c) {
      return [c.iweek - minWeek, c.weekday, c.events, c];
    });
    return { data: data, labels: labels, minWeek: minWeek, maxWeek: maxWeek };
  }

  function monthDayInsight(imonth, iday) {
    var subset = records.filter(function (r) {
      var md = parseMonthDay(r.date);
      return md && md.imonth === imonth && md.iday === iday;
    });
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var tc = topCount(subset, function (r) { return r.country; });
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    var tg = topCount(subset, function (r) { return r.group; });
    var tw = topCount(subset, function (r) { return r.weaponTypeShort; });
    var years = {};
    subset.forEach(function (r) {
      years[String(r.date).slice(0, 4)] = true;
    });
    return {
      imonth: imonth,
      iday: iday,
      label: imonth + '月' + iday + '日',
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      pct: pct(subset.length, records.length),
      topCountry: tc[0],
      topAttack: ta[0],
      topGroup: tg[0],
      topWeapon: tw[0],
      yearSpan: Object.keys(years).length,
    };
  }

  /** 区域质心（地图呈现用） */
  var REGION_CENTROIDS = {
    'South Asia': [78, 22],
    'Middle East & North Africa': [38, 28],
    'Sub-Saharan Africa': [20, 2],
    'Southeast Asia': [118, 8],
    'Western Europe': [8, 48],
    'South America': [-58, -12],
    'North America': [-98, 42],
    'Eastern Europe': [28, 48],
    'Australasia & Oceania': [140, -25],
    'Central Asia': [65, 42],
  };

  function mapRegionAggregates() {
    var regions = aggregateByRegion();
    return regions
      .map(function (r) {
        var c = REGION_CENTROIDS[r.name];
        if (!c) return null;
        return {
          name: r.name,
          value: r.value,
          nkill: r.nkill,
          nwound: 0,
          lon: c[0],
          lat: c[1],
          insight: regionInsight(r.name),
        };
      })
      .filter(Boolean);
  }

  function countryMapSeriesData() {
    return mapCountryAggregates().map(function (c) {
      return {
        name: c.country,
        value: c.events,
        nkill: c.nkill,
      };
    });
  }

  function aggregateByRegion() {
    var map = {};
    records.forEach(function (r) {
      var key = r.region;
      if (!map[key]) map[key] = { name: key, value: 0, nkill: 0 };
      map[key].value += 1;
      map[key].nkill += r.nkill;
    });
    return Object.values(map).sort(function (a, b) { return b.value - a.value; });
  }

  /** 按国家聚合（地图用，减少散点数量） */
  function mapCountryAggregates() {
    var map = {};
    records.forEach(function (r) {
      var c = COUNTRY_CENTROIDS[r.country];
      if (!c) return;
      if (!map[r.country]) {
        map[r.country] = {
          country: r.country,
          events: 0,
          nkill: 0,
          nwound: 0,
          lon: c[0],
          lat: c[1],
        };
      }
      map[r.country].events += 1;
      map[r.country].nkill += r.nkill;
      map[r.country].nwound += r.nwound;
    });
    return Object.values(map);
  }

  function mapScatterPoints() {
    var jitter = function (seed) {
      return ((seed * 9301 + 49297) % 233280) / 233280 * 4 - 2;
    };
    return records.map(function (r, i) {
      var c = COUNTRY_CENTROIDS[r.country];
      if (!c) return null;
      return {
        name: r.city !== 'Unknown' ? r.city + ', ' + r.country : r.country,
        value: [c[0] + jitter(i) * 0.35, c[1] + jitter(i + 7) * 0.25, r.nkill + 1],
        nkill: r.nkill,
        nwound: r.nwound,
        attackType: r.attackTypeShort,
        group: r.group,
        date: r.date,
        country: r.country,
      };
    }).filter(Boolean);
  }

  function sankeyAttackToTarget(limit) {
    var map = {};
    records.forEach(function (r) {
      var src = r.attackTypeShort;
      var tgt = r.targetType.length > 28 ? firstToken(r.targetType) : r.targetType;
      var key = src + '\0' + tgt;
      map[key] = (map[key] || 0) + 1;
    });
    var links = Object.keys(map).map(function (k) {
      var p = k.split('\0');
      return { source: p[0], target: p[1], value: map[k] };
    }).sort(function (a, b) { return b.value - a.value; });
    if (limit) links = links.slice(0, limit);
    var nodes = {};
    links.forEach(function (l) {
      nodes[l.source] = true;
      nodes[l.target] = true;
    });
    return {
      nodes: Object.keys(nodes).map(function (n) { return { name: n }; }),
      links: links,
    };
  }

  function treemapByGroup(topN) {
    topN = topN || 12;
    var map = {};
    records.forEach(function (r) {
      var g = r.group;
      if (!map[g]) map[g] = { name: g, value: 0, nkill: 0, weapons: {} };
      map[g].value += 1;
      map[g].nkill += r.nkill;
      var w = r.weaponTypeShort;
      map[g].weapons[w] = (map[g].weapons[w] || 0) + 1;
    });
    var sorted = Object.values(map).sort(function (a, b) { return b.value - a.value; });
    var top = sorted.slice(0, topN);
    var rest = sorted.slice(topN);
    var children = top.map(function (g) {
      return {
        name: g.name,
        value: g.value,
        nkill: g.nkill,
        children: Object.keys(g.weapons).map(function (w) {
          return { name: w, value: g.weapons[w] };
        }).sort(function (a, b) { return b.value - a.value; }),
      };
    });
    if (rest.length) {
      var otherVal = rest.reduce(function (s, x) { return s + x.value; }, 0);
      var otherKill = rest.reduce(function (s, x) { return s + x.nkill; }, 0);
      var wOther = {};
      rest.forEach(function (g) {
        Object.keys(g.weapons).forEach(function (w) {
          wOther[w] = (wOther[w] || 0) + g.weapons[w];
        });
      });
      children.push({
        name: 'Other Groups',
        value: otherVal,
        nkill: otherKill,
        children: Object.keys(wOther).map(function (w) {
          return { name: w, value: wOther[w] };
        }).sort(function (a, b) { return b.value - a.value; }).slice(0, 8),
      });
    }
    return { name: 'Organizations', children: children };
  }

  function parallelSample(max) {
    max = max || 120;
    var step = Math.max(1, Math.floor(records.length / max));
    var out = [];
    for (var i = 0; i < records.length; i += step) {
      var r = records[i];
      var killBand =
        r.nkill === 0 ? '0' :
        r.nkill <= 2 ? '1-2' :
        r.nkill <= 10 ? '3-10' : '10+';
      out.push([
        r.weaponTypeShort,
        r.region,
        r.attackTypeShort,
        killBand,
        r.group.length > 22 ? r.group.slice(0, 20) + '…' : r.group,
      ]);
    }
    return out;
  }

  function parallelDimensions() {
    return [
      { dim: 0, name: '武器', values: uniqDim(0) },
      { dim: 1, name: '区域', values: uniqDim(1) },
      { dim: 2, name: '袭击类型', values: uniqDim(2) },
      { dim: 3, name: '死亡区间', values: ['0', '1-2', '3-10', '10+'] },
      { dim: 4, name: '责任方', values: topGroups(8) },
    ];
  }

  function uniqDim(dimIdx) {
    var s = {};
    parallelSample(700).forEach(function (row) {
      s[row[dimIdx]] = true;
    });
    return Object.keys(s).sort();
  }

  function topGroups(n) {
    var map = {};
    records.forEach(function (r) {
      map[r.group] = (map[r.group] || 0) + 1;
    });
    return Object.keys(map).sort(function (a, b) { return map[b] - map[a]; }).slice(0, n);
  }

  function regionLabelsZh() {
    return {
      'South Asia': '南亚',
      'Middle East & North Africa': '中东与北非',
      'Sub-Saharan Africa': '撒哈拉以南非洲',
      'Southeast Asia': '东南亚',
      'Western Europe': '西欧',
      'South America': '南美',
      'North America': '北美',
      'Eastern Europe': '东欧',
      'Australasia & Oceania': '大洋洲',
      'Central Asia': '中亚',
    };
  }

  function topCount(subset, keyFn) {
    var map = {};
    subset.forEach(function (r) {
      var k = keyFn(r);
      map[k] = (map[k] || 0) + 1;
    });
    return Object.keys(map)
      .sort(function (a, b) { return map[b] - map[a]; })
      .map(function (name) { return { name: name, count: map[name] }; });
  }

  function pct(part, whole) {
    if (!whole) return '0';
    return ((part / whole) * 100).toFixed(1);
  }

  function regionInsight(region) {
    var subset = records.filter(function (r) { return r.region === region; });
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    var tg = topCount(subset, function (r) { return r.group; });
    var tt = topCount(subset, function (r) { return r.targetType; });
    var tw = topCount(subset, function (r) { return r.weaponTypeShort; });
    return {
      region: region,
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      pct: pct(subset.length, records.length),
      killPct: pct(nkill, summary().totalKill),
      avgKill: (nkill / subset.length).toFixed(1),
      topAttack: ta[0],
      topGroup: tg[0],
      topTarget: tt[0],
      topWeapon: tw[0],
    };
  }

  function countryInsight(country) {
    var subset = records.filter(function (r) { return r.country === country; });
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    var tg = topCount(subset, function (r) { return r.group; });
    return {
      country: country,
      region: subset[0].region,
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      pct: pct(subset.length, records.length),
      avgKill: (nkill / subset.length).toFixed(1),
      topAttack: ta[0],
      topGroup: tg[0],
    };
  }

  function dayInsight(date) {
    var subset = records.filter(function (r) { return r.date === date; });
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var tc = topCount(subset, function (r) { return r.country; });
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    var tg = topCount(subset, function (r) { return r.group; });
    var tw = topCount(subset, function (r) { return r.weaponTypeShort; });
    return {
      date: date,
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      topCountry: tc[0],
      topAttack: ta[0],
      topGroup: tg[0],
      topWeapon: tw[0],
    };
  }

  function sankeyEdgeInsight(source, target) {
    var subset = records.filter(function (r) {
      var tgt = r.targetType.length > 28 ? firstToken(r.targetType) : r.targetType;
      return r.attackTypeShort === source && tgt === target;
    });
    if (!subset.length) return null;
    var nkill = 0;
    subset.forEach(function (r) { nkill += r.nkill; });
    var tg = topCount(subset, function (r) { return r.group; });
    var tw = topCount(subset, function (r) { return r.weaponTypeShort; });
    return {
      source: source,
      target: target,
      events: subset.length,
      nkill: nkill,
      pct: pct(subset.length, records.length),
      topGroup: tg[0],
      topWeapon: tw[0],
    };
  }

  function groupInsight(name, isWeapon) {
    var subset;
    if (isWeapon) {
      subset = records.filter(function (r) { return r.weaponTypeShort === name; });
    } else {
      subset = records.filter(function (r) { return r.group === name; });
    }
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    var tc = topCount(subset, function (r) { return r.country; });
    var tg = topCount(subset, function (r) { return r.group; });
    return {
      name: name,
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      pct: pct(subset.length, records.length),
      avgKill: (nkill / subset.length).toFixed(1),
      topAttack: ta[0],
      topCountry: tc[0],
      topGroup: tg[0],
      isWeapon: !!isWeapon,
    };
  }

  function sankeyNodeInsight(name) {
    var asAttack = records.filter(function (r) { return r.attackTypeShort === name; });
    var asTarget = records.filter(function (r) {
      var tgt = r.targetType.length > 28 ? firstToken(r.targetType) : r.targetType;
      return tgt === name;
    });
    var subset;
    var role;
    var partnerFn;
    if (asAttack.length >= asTarget.length) {
      subset = asAttack;
      role = '攻击类型（左侧节点）';
      partnerFn = function (r) {
        return r.targetType.length > 28 ? firstToken(r.targetType) : r.targetType;
      };
    } else {
      subset = asTarget;
      role = '目标类型（右侧节点）';
      partnerFn = function (r) { return r.attackTypeShort; };
    }
    if (!subset.length) return null;
    var nkill = 0;
    var nwound = 0;
    subset.forEach(function (r) {
      nkill += r.nkill;
      nwound += r.nwound;
    });
    var tp = topCount(subset, partnerFn);
    var ta = topCount(subset, function (r) { return r.attackTypeShort; });
    return {
      name: name,
      role: role,
      events: subset.length,
      nkill: nkill,
      nwound: nwound,
      pct: pct(subset.length, records.length),
      topPartner: tp[0],
      topAttack: ta[0],
    };
  }

  global.TerrorDataParser = {
    setRecords: setRecords,
    getRecords: getRecords,
    summary: summary,
    aggregateByDay: aggregateByDay,
    parseMonthDay: parseMonthDay,
    aggregateByMonthDay: aggregateByMonthDay,
    calendarHeatmapData: calendarHeatmapData,
    calendarDailyHeatmapData: calendarDailyHeatmapData,
    aggregateByWeekGrid: aggregateByWeekGrid,
    weekGridHeatmapData: weekGridHeatmapData,
    weekGridHeatmapFocused: weekGridHeatmapFocused,
    monthDayInsight: monthDayInsight,
    aggregateByRegion: aggregateByRegion,
    mapRegionAggregates: mapRegionAggregates,
    countryMapSeriesData: countryMapSeriesData,
    REGION_CENTROIDS: REGION_CENTROIDS,
    mapCountryAggregates: mapCountryAggregates,
    mapScatterPoints: mapScatterPoints,
    sankeyAttackToTarget: sankeyAttackToTarget,
    treemapByGroup: treemapByGroup,
    parallelSample: parallelSample,
    parallelDimensions: parallelDimensions,
    regionLabelsZh: regionLabelsZh,
    regionInsight: regionInsight,
    countryInsight: countryInsight,
    dayInsight: dayInsight,
    sankeyEdgeInsight: sankeyEdgeInsight,
    sankeyNodeInsight: sankeyNodeInsight,
    groupInsight: groupInsight,
    topCount: topCount,
    pct: pct,
    COUNTRY_CENTROIDS: COUNTRY_CENTROIDS,
  };
})(typeof window !== 'undefined' ? window : this);
