/**
 * 滚动时逐个浮现图表面板
 * 图表初始化后可在 panel 变为 visible 时 resize（ECharts 等）
 */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  var panels = document.querySelectorAll('[data-reveal]');
  if (!panels.length) return;

  window.onPanelVisible = function (panelEl, callback) {
    if (!panelEl || typeof callback !== 'function') return;
    if (panelEl.classList.contains('is-visible')) {
      callback();
      return;
    }
    panelEl.addEventListener('panel:visible', function handler() {
      panelEl.removeEventListener('panel:visible', handler);
      callback();
    });
  };

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    panels.forEach(function (el) {
      el.classList.add('is-visible');
      el.dispatchEvent(new CustomEvent('panel:visible', { bubbles: true }));
    });
    return;
  }

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
        entry.target.dispatchEvent(new CustomEvent('panel:visible', { bubbles: true }));
      });
    },
    {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.08,
    }
  );

  panels.forEach(function (panel) {
    observer.observe(panel);
  });

  function revealInViewPanels() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    panels.forEach(function (panel) {
      if (panel.classList.contains('is-visible')) return;
      var rect = panel.getBoundingClientRect();
      if (rect.top < vh * 0.92 && rect.bottom > vh * 0.05) {
        panel.classList.add('is-visible');
        panel.dispatchEvent(new CustomEvent('panel:visible', { bubbles: true }));
      }
    });
  }

  window.addEventListener('load', function () {
    revealInViewPanels();
    setTimeout(revealInViewPanels, 300);
    if (window.DashboardCharts && window.DashboardCharts.layoutAllCharts) {
      setTimeout(window.DashboardCharts.layoutAllCharts, 400);
    }
  });
})();
