/**
 * 预加载世界地图 GeoJSON（兼容 file:// 与本地服务器）
 */
(function () {
  'use strict';

  var LOCAL = 'data/world.json';
  var REMOTES = [
    'https://cdn.jsdelivr.net/npm/echarts@5.5.1/map/json/world.json',
    'https://echarts.apache.org/examples/data/asset/geo/world.json',
  ];

  function resolveUrl(path) {
    try {
      return new URL(path, window.location.href).href;
    } catch (e) {
      return path;
    }
  }

  function register(geo) {
    if (!window.echarts || !geo) return false;
    try {
      echarts.registerMap('world', geo);
      return !!echarts.getMap('world');
    } catch (e) {
      return false;
    }
  }

  function fromInline() {
    if (window.__WORLD_GEO) {
      return Promise.resolve(register(window.__WORLD_GEO));
    }
    return Promise.resolve(false);
  }

  function loadViaXhr(url) {
    return new Promise(function (resolve) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onload = function () {
        if (xhr.status === 200 || xhr.status === 0) {
          try {
            resolve(register(JSON.parse(xhr.responseText)));
          } catch (e) {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      };
      xhr.onerror = function () {
        resolve(false);
      };
      xhr.send();
    });
  }

  function loadViaFetch(url) {
    return fetch(url, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('fetch fail');
        return r.json();
      })
      .then(function (geo) {
        return register(geo);
      })
      .catch(function () {
        return false;
      });
  }

  function loadUrl(url) {
    return loadViaXhr(url).then(function (ok) {
      if (ok) return true;
      return loadViaFetch(url);
    });
  }

  function tryChain(urls) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.resolve(false);
      var url = urls[i++];
      return loadUrl(url).then(function (ok) {
        return ok || next();
      });
    }
    return next();
  }

  function waitForEcharts(maxMs) {
    maxMs = maxMs || 8000;
    var start = Date.now();
    return new Promise(function (resolve) {
      function tick() {
        if (window.echarts) {
          resolve(true);
          return;
        }
        if (Date.now() - start >= maxMs) {
          resolve(false);
          return;
        }
        setTimeout(tick, 40);
      }
      tick();
    });
  }

  window.__worldMapReady = waitForEcharts().then(function (hasEcharts) {
    if (!hasEcharts) return false;
    if (echarts.getMap('world')) return true;

    return fromInline().then(function (ok) {
      if (ok) return true;
      return tryChain([resolveUrl(LOCAL)].concat(REMOTES));
    });
  });
})();
