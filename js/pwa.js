/* ===== BLUSHIFT PWA: installable app on phone =====
   Registers the service worker and offers an Install affordance.
   Only active over http(s) (a hosted URL) — does nothing when opened from a file. */
(function () {
  var httpHosted = location.protocol === 'http:' || location.protocol === 'https:';

  // Register the service worker (enables offline + installability)
  if (httpHosted && 'serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }

  var deferredPrompt = null;

  function injectStyles() {
    if (document.getElementById('pwaBannerStyle')) return;
    var s = document.createElement('style');
    s.id = 'pwaBannerStyle';
    s.textContent =
      '#pwaBanner{position:fixed;left:12px;right:12px;bottom:14px;z-index:99999;display:flex;align-items:center;gap:12px;' +
      'padding:12px 14px;border-radius:16px;background:rgba(16,22,38,0.96);border:1px solid rgba(120,160,255,0.28);' +
      'box-shadow:0 14px 40px rgba(0,0,0,0.5);backdrop-filter:blur(14px);color:#eaf0ff;font-family:Inter,system-ui,sans-serif;' +
      'transform:translateY(140%);transition:transform .35s cubic-bezier(.2,.9,.3,1);max-width:460px;margin:0 auto;}' +
      '#pwaBanner.show{transform:translateY(0);}' +
      '#pwaBanner .pwa-ic{width:40px;height:40px;border-radius:11px;flex:0 0 auto;display:flex;align-items:center;justify-content:center;' +
      'background:linear-gradient(135deg,#3d7bff,#7b53ff);font-weight:800;font-family:Orbitron,sans-serif;color:#fff;font-size:20px;}' +
      '#pwaBanner .pwa-tx{flex:1;min-width:0;}' +
      '#pwaBanner .pwa-tt{font-weight:700;font-size:13.5px;}' +
      '#pwaBanner .pwa-sb{font-size:11.5px;color:#9fb0d6;margin-top:1px;line-height:1.35;}' +
      '#pwaBanner .pwa-go{flex:0 0 auto;border:none;cursor:pointer;background:linear-gradient(135deg,#3d7bff,#7b53ff);color:#fff;' +
      'font-weight:700;font-size:12.5px;padding:9px 14px;border-radius:11px;font-family:inherit;}' +
      '#pwaBanner .pwa-cl{flex:0 0 auto;border:none;background:none;color:#7e8db0;cursor:pointer;font-size:18px;line-height:1;padding:4px;}';
    document.head.appendChild(s);
  }

  function buildBanner(title, sub, actionLabel, onAction) {
    injectStyles();
    var old = document.getElementById('pwaBanner');
    if (old) old.remove();
    var el = document.createElement('div');
    el.id = 'pwaBanner';
    var actionHtml = actionLabel ? '<button class="pwa-go" id="pwaGo">' + actionLabel + '</button>' : '';
    el.innerHTML =
      '<div class="pwa-ic">B</div>' +
      '<div class="pwa-tx"><div class="pwa-tt">' + title + '</div><div class="pwa-sb">' + sub + '</div></div>' +
      actionHtml +
      '<button class="pwa-cl" id="pwaClose" aria-label="Dismiss">×</button>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    document.getElementById('pwaClose').onclick = dismissBanner;
    if (actionLabel) document.getElementById('pwaGo').onclick = onAction;
  }

  function dismissBanner() {
    var el = document.getElementById('pwaBanner');
    if (el) { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 350); }
    try { sessionStorage.setItem('blushift-install-dismissed', '1'); } catch (e) {}
  }

  function doInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    deferredPrompt.userChoice.finally(function () { deferredPrompt = null; dismissBanner(); });
  }

  // Android / desktop Chrome: native install prompt
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (isStandalone()) return;
    try { if (sessionStorage.getItem('blushift-install-dismissed')) return; } catch (er) {}
    setTimeout(function () {
      buildBanner('Install BLUSHIFT', 'Add it to your home screen for the full app experience.', 'Install', doInstall);
    }, 2500);
  });

  window.addEventListener('appinstalled', function () { dismissBanner(); });

  // iOS Safari: no prompt event — show Add-to-Home-Screen hint once
  window.addEventListener('load', function () {
    if (!httpHosted || isStandalone()) return;
    if (isIOS()) {
      try { if (sessionStorage.getItem('blushift-install-dismissed')) return; } catch (er) {}
      setTimeout(function () {
        buildBanner('Install BLUSHIFT', 'Tap the Share button, then “Add to Home Screen”.', null, null);
      }, 2800);
    }
  });

  // Allow other code (e.g. a Settings button) to trigger install
  window.pwaInstall = doInstall;
  window.pwaCanInstall = function () { return !!deferredPrompt; };
})();
