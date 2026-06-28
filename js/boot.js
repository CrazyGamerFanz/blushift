/* ============================================
   BLUSHIFT Beta v0.6 — Boot Sequence & Onboarding
   ============================================ */

const BOOT_MESSAGES = [
  'LOADING MODULES...','INITIALIZING RELAY...','HANDSHAKE NRT-02...','VERIFYING IDENTITY...',
  'ENCRYPTING CHANNEL...','SYNCING CONTACTS...','CALIBRATING SPOOF SIG...','READY.',
];

let userAccount = null;
let emailCode = '', phoneCode = '';

function detectDevice() {
  const ua = navigator.userAgent.toLowerCase();
  if (/samsung|sm-/i.test(ua)) return 'Samsung Galaxy';
  if (/pixel/i.test(ua)) return 'Google Pixel';
  if (/oneplus/i.test(ua)) return 'OnePlus';
  if (/huawei/i.test(ua)) return 'Huawei';
  if (/xiaomi|redmi|poco/i.test(ua)) return 'Xiaomi';
  if (/oppo/i.test(ua)) return 'Oppo';
  if (/vivo/i.test(ua)) return 'Vivo';
  if (/motorola|moto/i.test(ua)) return 'Motorola';
  if (/lg /i.test(ua)) return 'LG';
  if (/sony|xperia/i.test(ua)) return 'Sony Xperia';
  if (/android/i.test(ua)) { const v = ua.match(/android\s*([\d.]+)/); return 'Android ' + (v ? v[1] : ''); }
  if (/iphone|ipad/i.test(ua)) return 'iOS (Demo)';
  if (/windows/i.test(ua)) return 'Windows (Demo)';
  if (/macintosh|mac os/i.test(ua)) return 'macOS (Demo)';
  if (/linux/i.test(ua)) return 'Linux (Demo)';
  return 'Unknown Device';
}

function loadStoredAccount() {
  const raw = localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account');
  return raw ? JSON.parse(raw) : null;
}

function initBoot() {
  createParticles();
  const label = document.getElementById('detectedDeviceLabel');
  if (label) label.textContent = detectDevice();
  const saved = loadStoredAccount();
  if (saved) { userAccount = saved; skipToApp(); return; }
  runBootSequence();
}

/* ===== LANGUAGE SELECT (after boot, before sign-in) ===== */
function showLanguageSelect() {
  const boot = document.getElementById('bootScreen');
  if (boot) boot.style.display = 'none';
  const scr = document.getElementById('languageScreen');
  scr.classList.remove('hidden');
  scr.classList.add('entering');
  renderLangSelect('');
}
function renderLangSelect(q) {
  const list = document.getElementById('langSelectList');
  if (!list) return;
  const ql = (q || '').toLowerCase().trim();
  const matches = APP_LANGUAGES.filter(l => !ql || l.name.toLowerCase().includes(ql) || l.native.toLowerCase().includes(ql) || l.code === ql);
  list.innerHTML = matches.length
    ? matches.map(l => `<button class="lang-row ${appLang === l.code ? 'sel' : ''}" onclick="chooseAppLanguage('${l.code}')">
        <span class="lang-flag">${flagImg(l.cc)}</span>
        <span class="lang-names"><span class="lang-native">${l.native}</span><span class="lang-en">${l.name}</span></span>
        ${appLang === l.code ? '<span class="lang-check">✓</span>' : ''}
      </button>`).join('')
    : '<div class="lang-empty">No language found</div>';
}
function chooseAppLanguage(code) {
  setAppLanguage(code);
  const scr = document.getElementById('languageScreen');
  scr.classList.add('exiting');
  setTimeout(() => { scr.classList.add('hidden'); scr.classList.remove('exiting','entering'); showSignup(); if (typeof translateUI === 'function') setTimeout(translateUI, 120); }, 350);
}

function createParticles() {
  const container = document.getElementById('bootParticles');
  if (!container) return;
  for (let i = 0; i < 40; i++) {
    const p = document.createElement('div');
    p.className = 'boot-particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = (3 + Math.random() * 5) + 's';
    p.style.animationDelay = (Math.random() * 4) + 's';
    p.style.width = p.style.height = (1 + Math.random() * 2.5) + 'px';
    container.appendChild(p);
  }
}

function runBootSequence() {
  const bar = document.getElementById('bootProgress');
  const status = document.getElementById('bootStatus');
  let step = 0;
  const interval = setInterval(() => {
    if (step >= BOOT_MESSAGES.length) { clearInterval(interval); setTimeout(showLanguageSelect, 600); return; }
    status.textContent = BOOT_MESSAGES[step];
    bar.style.width = ((step + 1) / BOOT_MESSAGES.length * 100) + '%';
    step++;
  }, 430);
}

/* generic screen transition */
function gotoScreen(fromId, toId, prep) {
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);
  from.classList.add('exiting');
  setTimeout(() => {
    from.classList.add('hidden');
    from.classList.remove('exiting','entering');
    if (prep) prep();
    to.classList.remove('hidden');
    to.classList.add('entering');
    // keep the whole onboarding flow in the selected language
    if (typeof translateUI === 'function' && typeof appLang !== 'undefined' && appLang !== 'en') setTimeout(translateUI, 80);
  }, fromId === 'bootScreen' ? 700 : 400);
}

function showSignup() { gotoScreen('bootScreen', 'signupScreen'); }

const EYE_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
function togglePwd(id, btn) {
  const el = document.getElementById(id);
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.innerHTML = show ? EYE_OFF_SVG : EYE_SVG;
}

function gen6() { return Math.floor(100000 + Math.random() * 900000).toString(); }

function handleSignup(e) {
  e.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const stay = document.getElementById('stayLoggedIn').checked;
  const err = document.getElementById('signupError');

  if (!name || !email || !phone || !password) { err.textContent = 'Please fill in every field.'; return false; }
  if (password.length < 8) { err.textContent = 'Password must be at least 8 characters.'; return false; }
  if (password !== confirm) { err.textContent = 'Passwords do not match.'; return false; }
  err.textContent = '';

  const now = new Date();
  const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 86400000);
  userAccount = {
    name, email, phone, device: detectDevice(),
    createdAt: now.toISOString(),
    trialStart: now.toISOString().slice(0,10),
    trialEnds: trialEnds.toISOString().slice(0,10),
    stay, plan: null, photoAccess: 'none',
    emailVerified: false, phoneVerified: false, card: null,
    tourSeen: false,
  };

  emailCode = gen6();
  document.getElementById('emailVerifyTarget').textContent = email;
  const eHint = document.getElementById('emailCodeHint');
  if (typeof emailjsConfigured === 'function' && emailjsConfigured()) {
    eHint.textContent = 'Sending a code to ' + email + '…';
    sendEmailCode(email, emailCode).then(ok => { eHint.textContent = ok ? '📧 Code sent — check your email (and spam folder).' : 'Email send failed · Demo code: ' + emailCode; });
  } else {
    eHint.textContent = 'Demo code: ' + emailCode;
  }
  document.getElementById('emailCodeInput').value = '';
  document.getElementById('emailVerifyError').textContent = '';
  gotoScreen('signupScreen', 'emailVerifyScreen');
  return false;
}

function verifyEmail() {
  const v = document.getElementById('emailCodeInput').value.trim();
  if (v !== emailCode) { document.getElementById('emailVerifyError').textContent = 'Incorrect code. Try the demo code shown above.'; return; }
  userAccount.emailVerified = true;
  phoneCode = gen6();
  document.getElementById('phoneVerifyTarget').textContent = userAccount.phone;
  document.getElementById('phoneCodeHint').textContent = 'Demo code: ' + phoneCode;
  document.getElementById('phoneCodeInput').value = '';
  document.getElementById('phoneVerifyError').textContent = '';
  gotoScreen('emailVerifyScreen', 'phoneVerifyScreen');
}
function resendEmail() { emailCode = gen6(); document.getElementById('emailCodeHint').textContent = 'Demo code: ' + emailCode; }

function verifyPhone() {
  const v = document.getElementById('phoneCodeInput').value.trim();
  if (v !== phoneCode) { document.getElementById('phoneVerifyError').textContent = 'Incorrect code. Try the demo code shown above.'; return; }
  userAccount.phoneVerified = true;
  gotoScreen('phoneVerifyScreen', 'photoPermScreen');
}
function resendPhone() { phoneCode = gen6(); document.getElementById('phoneCodeHint').textContent = 'Demo code: ' + phoneCode; }

/* ===== PHOTO LIBRARY PERMISSION (3 options) ===== */
let pendingPhotoScope = 'none';
function allowPhotos(scope) {
  pendingPhotoScope = scope;
  if (scope === 'none') { userAccount.photoAccess = 'none'; afterPhotoPermission(); return; }
  document.getElementById('libraryInput').click(); // full or some -> pick media
}
function handleLibraryFiles(input) {
  const files = Array.from(input.files || []);
  userAccount.photoAccess = pendingPhotoScope === 'some' ? 'limited' : 'full';
  if (!files.length) { afterPhotoPermission(); return; }
  ingestLibraryFiles(files, afterPhotoPermission);
}
function afterPhotoPermission() { gotoScreen('photoPermScreen', 'planScreen', renderPlanCards); }

function renderPlanCards() {
  const container = document.getElementById('planCards');
  container.innerHTML = PLANS.map(p => `
    <div class="plan-card ${p.recommended ? 'recommended' : ''}" onclick="selectPlan('${p.id}')">
      <div class="plan-name">${p.name}</div>
      <div class="plan-price"><span class="cur">$</span>${p.price}<span class="per"> /mo</span>
        <span class="free-tag">3-DAY FREE TRIAL · FREE IN BETA</span></div>
      <ul class="plan-features">${p.features.map(f => `<li>${f}</li>`).join('')}</ul>
    </div>`).join('');
}

function selectPlan(planId) {
  userAccount.plan = planId;
  const planObj = PLANS.find(p => p.id === planId);
  document.getElementById('cardPlanName').textContent = planObj ? `${planObj.name} · $${planObj.price}/mo` : '';
  gotoScreen('planScreen', 'cardScreen');
}

function saveCard(e) {
  if (e) e.preventDefault();
  const num = document.getElementById('cardNumber').value.replace(/\s/g,'');
  const name = document.getElementById('cardName').value.trim();
  const exp = document.getElementById('cardExp').value.trim();
  const cvc = document.getElementById('cardCvc').value.trim();
  const zip = document.getElementById('cardZip').value.trim();
  const err = document.getElementById('cardError');
  if (num.length < 13 || !name || !/^\d{2}\/\d{2}$/.test(exp) || cvc.length < 3) {
    err.textContent = 'Enter valid card details (any test card works).'; return false;
  }
  err.textContent = '';
  const first = num[0];
  const brand = first === '4' ? 'Visa' : first === '5' ? 'Mastercard' : first === '3' ? 'Amex' : 'Card';
  userAccount.card = { brand, last4: num.slice(-4), exp, name, zip };
  persistAccount();
  showSpotifyConnect();
  return false;
}
function skipCard() { userAccount.card = null; persistAccount(); showSpotifyConnect(); }
function showSpotifyConnect() { gotoScreen('cardScreen', 'spotifyScreen'); }
function connectSpotify() {
  // Real Spotify login (OAuth) verifies the actual account on Spotify's own page.
  // Spotify is the last onboarding step, so persist the (complete) account first;
  // on return from Spotify the app launches already signed in.
  if (typeof spotifyConfigured === 'function' && spotifyConfigured()) {
    if (typeof userAccount !== 'undefined' && userAccount) persistAccount();
    spotifyLogin();
    return;
  }
  // (fallback only if no Spotify Client ID is configured)
  openConnect('spotify', () => {
    const btn = document.getElementById('spotifyBtn');
    if (btn) { btn.textContent = '✓ Connected'; btn.classList.add('linked'); }
    setTimeout(showTransition, 500);
  });
}
function skipSpotify() { userAccount.spotify = { linked: false }; persistAccount(); showTransition(); }
function linkWallet(id, btn) {
  openConnect(id, () => {
    if (btn) { btn.classList.add('linked'); const st = btn.querySelector('.wl-status'); if (st) st.textContent = '✓ Linked'; }
  });
}

function persistAccount() {
  const data = JSON.stringify(userAccount);
  if (userAccount.stay) { localStorage.setItem('blushift-account', data); sessionStorage.removeItem('blushift-account'); }
  else { sessionStorage.setItem('blushift-account', data); localStorage.removeItem('blushift-account'); }
}

/* ===== COOLER WELCOME ===== */
function showTransition() {
  const card = document.getElementById('spotifyScreen');
  card.classList.add('exiting');
  setTimeout(() => {
    card.classList.add('hidden'); card.classList.remove('exiting');
    const trans = document.getElementById('transitionScreen');
    trans.classList.remove('hidden');
    trans.classList.add('entering');
    document.getElementById('transitionName').textContent = userAccount.name.toUpperCase();
    spawnWelcomeFX();
    setTimeout(() => {
      trans.classList.add('exiting');
      setTimeout(() => { trans.classList.add('hidden'); trans.classList.remove('exiting','entering'); launchApp(); }, 600);
    }, 3000);
  }, 400);
}
/* futuristic welcome — particles streaking inward, constrained to the phone frame */
function spawnWelcomeFX() {
  const wrap = document.getElementById('welcomeFX');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < 28; i++) {
    const s = document.createElement('div');
    s.className = 'fx-streak';
    const ang = (i / 28) * Math.PI * 2;
    s.style.setProperty('--tx', Math.cos(ang) * 60 + '%');
    s.style.setProperty('--ty', Math.sin(ang) * 60 + '%');
    s.style.animationDelay = (Math.random() * 0.6) + 's';
    wrap.appendChild(s);
  }
  for (let i = 0; i < 16; i++) {
    const d = document.createElement('div');
    d.className = 'fx-bit';
    d.style.left = Math.random() * 100 + '%';
    d.style.top = Math.random() * 100 + '%';
    d.style.animationDelay = (Math.random() * 1.2) + 's';
    wrap.appendChild(d);
  }
}

function skipToApp() {
  document.getElementById('bootScreen').style.display = 'none';
  if (localStorage.getItem('blushift-biometric') === 'on') showBiometricLock();
  else launchApp();
}

/* ===== BIOMETRIC LOCK ===== */
function showBiometricLock() {
  const lock = document.getElementById('biometricScreen');
  if (!lock) { launchApp(); return; }
  const method = localStorage.getItem('blushift-biometric-method') || 'face';
  lock.setAttribute('data-method', method);
  document.getElementById('bioMethodLabel').textContent = method === 'touch' ? 'Touch ID' : 'Face ID';
  document.getElementById('bioFaceIcon').style.display = method === 'touch' ? 'none' : 'block';
  document.getElementById('bioTouchIcon').style.display = method === 'touch' ? 'block' : 'none';
  lock.classList.remove('hidden'); lock.classList.add('entering');
  const nm = document.getElementById('bioName');
  if (nm && userAccount) nm.textContent = userAccount.name;
  document.getElementById('bioStatus').textContent = 'Tap to authenticate';
  document.getElementById('bioStatus').style.color = '';
  const ring = document.getElementById('bioRing');
  if (ring) ring.classList.remove('scanning');
}
function runBiometricAuth() {
  const ring = document.getElementById('bioRing');
  const status = document.getElementById('bioStatus');
  if (ring) ring.classList.add('scanning');
  status.style.color = '';
  status.textContent = 'Scanning...';
  const success = () => {
    status.textContent = 'Identity verified ✓';
    status.style.color = 'var(--ok, #4dffa1)';
    setTimeout(() => {
      const lock = document.getElementById('biometricScreen');
      lock.classList.add('exiting');
      setTimeout(() => { lock.classList.add('hidden'); lock.classList.remove('exiting','entering'); launchApp(); }, 450);
    }, 600);
  };
  const fail = (msg) => {
    if (ring) ring.classList.remove('scanning');
    status.textContent = msg || 'Not recognized — tap to try again.';
    status.style.color = 'var(--danger, #ff5a7a)';
  };
  // Real Face ID / fingerprint when enrolled & served over HTTPS; otherwise animated fallback
  if (typeof webauthnSupported === 'function' && webauthnSupported() && webauthnEnrolled()) {
    webauthnAuth().then(ok => ok ? success() : fail()).catch(() => fail('Authentication cancelled — tap to try again.'));
  } else {
    setTimeout(success, 1300);
  }
}

function launchApp() {
  const app = document.getElementById('appShell');
  app.classList.remove('hidden');
  app.style.animation = 'fade-in 0.5s ease';
  initApp();
}

document.addEventListener('DOMContentLoaded', initBoot);
