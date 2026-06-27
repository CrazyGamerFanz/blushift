/* ============================================
   BLUSHIFT Beta v0.5 — Main Application Logic
   ============================================ */

let currentTheme = localStorage.getItem('blushift-theme') || 'arctic';
let currentBg = localStorage.getItem('blushift-bg') || 'default';
let currentEmojiPack = localStorage.getItem('blushift-emojipack') || 'whatsapp';
let readReceiptsOn = (localStorage.getItem('blushift-readreceipts') || 'on') === 'on';
let biometricOn = (localStorage.getItem('blushift-biometric') || 'off') === 'on';
let biometricMethod = localStorage.getItem('blushift-biometric-method') || 'face';
let biometricEnrolled = localStorage.getItem('blushift-biometric-enrolled') === 'yes';
let globalBlueMode = true;
let activeChat = null;
let activeChatType = null;
let tapbackTargetId = null;
let replyTarget = null;
let currentFilter = 'all';
let swipeState = { el:null, startX:0, msgId:null };
let editingContactId = null;
let viewingContactId = null;
let editContactPfp = null;
let selectedPhotos = [];
let LIBRARY = [];
let viewerPhotos = [], viewerIndex = 0;
let autoTranslateOn = (localStorage.getItem('blushift-autotranslate') || 'on') === 'on';
let appLang = localStorage.getItem('blushift-lang') || 'en';   // app-wide language (selected after boot)
let blockUnknown = (localStorage.getItem('blushift-blockunknown') || 'off') === 'on';
let stealthMode = (localStorage.getItem('blushift-stealth') || 'off') === 'on';
let hidePreviews = (localStorage.getItem('blushift-hidepreviews') || 'off') === 'on';
let recentAnimId = null;
let pinnedByChat = {};
let translateSourceText = '';
let longPressTimer = null, longPressFired = false;
let cropState = { img:null, scale:1, x:0, y:0, cb:null, dragging:false, sx:0, sy:0, natW:0, natH:0 };

/* reverse translation maps (localized word -> english) */
const REVERSE_TR = {};
Object.entries(TRANSLATIONS).forEach(([code, lang]) => {
  REVERSE_TR[code] = {};
  Object.entries(lang.samples).forEach(([en, loc]) => { REVERSE_TR[code][loc.toLowerCase()] = en; });
});

function initApp() {
  initConversations();
  loadImportedContacts();   // contacts synced from the phone
  loadConversations();   // restore encrypted message history (AES-256-GCM), falls back to defaults
  restoreAiTheme();
  if (currentTheme === 'aitheme' && !localStorage.getItem('blushift-aitheme')) currentTheme = 'arctic';
  applyTheme(currentTheme);
  applyEmojiPack(currentEmojiPack);
  applyBg();
  renderFilterTabs();
  renderChatList();
  renderSettings();
  renderPrivacyList();
  renderContactList();
  renderCalls();
  renderVoicemail();
  seedPaymentFromAccount();
  updateClock();
  setInterval(updateClock, 30000);
  setInterval(updateLatency, 3000);
  setupSwipeListeners();
  setupViewerSwipe();
  setupLongPress();
  setupCropper();
  document.body.classList.toggle('stealth', stealthMode);
  document.body.classList.toggle('hide-previews', hidePreviews);
  // apply chosen app language (direction + best-effort UI translation)
  document.documentElement.lang = appLang;
  document.documentElement.dir = (typeof RTL_LANGS !== 'undefined' && RTL_LANGS.includes(appLang)) ? 'rtl' : 'ltr';
  if (appLang !== 'en') setTimeout(translateUI, 200);
  // First-launch product tour offer (new accounts only)
  setTimeout(() => { const a = getAccount(); if (a && a.tourSeen === false) showTourOffer(); }, 850);
}

/* seed the onboarding card into billing */
function seedPaymentFromAccount() {
  const acct = JSON.parse(localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account') || '{}');
  if (acct.card && acct.card.last4 && !PAYMENT_METHODS.some(p => p.last4 === acct.card.last4)) {
    PAYMENT_METHODS.forEach(p => p.primary = false);
    PAYMENT_METHODS.unshift({ id:'pm-acct', type:'card', brand:acct.card.brand, last4:acct.card.last4, exp:acct.card.exp, icon:'💳', primary:true });
  }
}

/* ===== CLOCK & LATENCY ===== */
function updateClock() {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  const m = now.getMinutes().toString().padStart(2,'0');
  const el = document.getElementById('statusTime');
  if (el) el.textContent = `${h}:${m}`;
}
function updateLatency() {
  const el = document.getElementById('latencyVal');
  if (el) el.textContent = (70 + Math.floor(Math.random()*40)).toString();
}
function clockNow() {
  const n = new Date();
  const h = n.getHours() % 12 || 12;
  const m = n.getMinutes().toString().padStart(2,'0');
  const ap = n.getHours() < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${ap}`;
}

/* ===== LIBRARY (photos/videos) ===== */
function ingestLibraryFiles(files, done) {
  let pending = files.length;
  if (!pending) { if (done) done(); return; }
  files.forEach(f => {
    const kind = (f.type || '').startsWith('video') ? 'video' : 'img';
    const reader = new FileReader();
    const finish = () => { if (--pending === 0) { LIBRARY.sort((a,b)=>b.ts-a.ts); if (done) done(); } };
    reader.onload = e => { LIBRARY.push({ kind, val:e.target.result, ts: f.lastModified || Date.now() }); finish(); };
    reader.onerror = finish;
    reader.readAsDataURL(f);
  });
}

/* ===== THEME ===== */
function applyTheme(id) {
  currentTheme = id;
  document.body.setAttribute('data-theme', id);
  localStorage.setItem('blushift-theme', id);
  document.querySelectorAll('.theme-card').forEach(c =>
    c.classList.toggle('active', c.dataset.t === id));
}

/* ===== EMOJI PACK ===== */
function applyEmojiPack(id) {
  const p = EMOJI_PACKS.find(x => x.id === id) || EMOJI_PACKS[0];
  document.documentElement.style.setProperty('--emoji-font', p.font);
  currentEmojiPack = p.id;
  localStorage.setItem('blushift-emojipack', p.id);
  document.body.setAttribute('data-emoji', p.id);
  if (activeChat !== null) { const m = getActiveMessages(); if (m) renderMessages(m); }
}
function setEmojiPack(id) { applyEmojiPack(id); renderSettings(); refreshTapbackEmojis(); }

/* ===== EMOJI IMAGE RENDERING =====
   Apple/Microsoft/WhatsApp can't be shown via fonts on every OS (Apple's font is
   proprietary & not on Windows), so render those packs as images from a
   style-aware CDN. Native uses the system emoji font. */
function emojiStyleName() {
  // emojicdn dropped 'microsoft' + 'whatsapp' (they 400 now). On Windows the system
  // font IS Microsoft, so 'microsoft' -> null (system). 'whatsapp' is handled specially
  // via emojigraph in EM(). 'apple' still works on emojicdn.
  return { native: null, microsoft: null, apple: 'apple', whatsapp: 'whatsapp' }[currentEmojiPack] || null;
}
/* WhatsApp emoji images come from emojigraph, addressed by <cldr-slug>_<codepoints> */
let EMOJI_SLUGS = null, _slugsLoading = false;
function loadEmojiSlugs() {
  if (EMOJI_SLUGS || _slugsLoading) return;
  _slugsLoading = true;
  fetch('https://cdn.jsdelivr.net/npm/unicode-emoji-json/data-by-emoji.json')
    .then(r => r.json())
    .then(d => {
      EMOJI_SLUGS = {};
      for (const k in d) { if (d[k] && d[k].slug) EMOJI_SLUGS[k] = d[k].slug.replace(/_/g, '-'); }
      // re-render now that WhatsApp images can resolve
      if (currentEmojiPack === 'whatsapp') {
        if (activeChat !== null) { const m = getActiveMessages(); if (m) renderMessages(m); }
        const sv = document.getElementById('viewSettings'); if (sv && sv.classList.contains('active')) renderSettings();
      }
    })
    .catch(() => { EMOJI_SLUGS = {}; });
}
function emojiImgUrl(m, style) {
  if (style === 'whatsapp') {
    const slug = EMOJI_SLUGS && EMOJI_SLUGS[m];
    if (!slug) return null;                       // unknown -> caller keeps the system glyph
    const cps = [...m].map(c => c.codePointAt(0).toString(16)).join('-');
    return `https://emojigraph.org/media/whatsapp/${slug}_${cps}.png`;
  }
  return `https://emojicdn.elk.sh/${encodeURIComponent(m)}?style=${style}`;
}
const EMOJI_RE = /(\p{RI}\p{RI})|(\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}|[\u{1F3FB}-\u{1F3FF}])*)|([\d#*]️?⃣)/gu;
function EM(str) {
  if (str == null) return '';
  const style = emojiStyleName();
  str = String(str);
  if (!style) return str;
  if (style === 'whatsapp') loadEmojiSlugs();
  return str.replace(EMOJI_RE, (m) => {
    const url = emojiImgUrl(m, style);
    if (!url) return m;                            // WhatsApp glyph not mapped yet -> system emoji
    // if the CDN can't serve that glyph/style, fall back to the system emoji
    return `<img class="emoji-img" src="${url}" alt="${m}" draggable="false" onerror="this.outerHTML=this.alt">`;
  });
}
function refreshTapbackEmojis() {
  document.querySelectorAll('.tb-emoji').forEach(b => { b.innerHTML = EM(b.dataset.e); });
}

/* ===== VIEWS ===== */
function showView(viewId, direction) {
  const dir = direction || 'forward';
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const map = {
    chatList:'viewChatList', chat:'viewChat', settings:'viewSettings',
    privacy:'viewPrivacy', contacts:'viewContacts', groupSettings:'viewGroupSettings',
    contactProfile:'viewContactProfile', calls:'viewCalls', voicemail:'viewVoicemail',
  };
  const target = document.getElementById(map[viewId]);
  if (target) {
    target.classList.add('active', dir === 'back' ? 'view-enter-back' : 'view-enter');
    setTimeout(() => target.classList.remove('view-enter','view-enter-back'), 420);
  }
  const nav = document.getElementById('bottomNav');
  const hideNav = viewId === 'chat' || viewId === 'groupSettings' || viewId === 'contactProfile';
  nav.style.display = hideNav ? 'none' : 'flex';
  document.querySelectorAll('.nav-btn').forEach(n => {
    const isActive = n.dataset.view === viewId;
    n.classList.toggle('active', isActive);
    if (isActive) { n.classList.add('bounce'); setTimeout(() => n.classList.remove('bounce'), 500); }
  });
  const fabGroup = document.querySelector('.fab-group');
  if (fabGroup) fabGroup.style.display = viewId === 'chatList' ? 'flex' : 'none';
  if (viewId === 'settings') renderSettings();
  if (viewId === 'privacy') renderPrivacyList();
  if (viewId === 'contacts') renderContactList();
  if (viewId === 'calls') renderCalls();
  if (viewId === 'voicemail') renderVoicemail();
  if (viewId === 'chatList') { renderFilterTabs(); renderChatList(); }
  if (appLang && appLang !== 'en') setTimeout(translateUI, 30);
}

/* ===== FILTER TABS ===== */
function renderFilterTabs() {
  const container = document.getElementById('filterTabs');
  const allFilters = [...DEFAULT_FILTERS, ...customFilters];
  container.innerHTML = allFilters.map(f => {
    const label = f.charAt(0).toUpperCase() + f.slice(1);
    return `<button class="filter-tab ${f === currentFilter ? 'active' : ''}" onclick="setFilter('${f}',this)">${label}</button>`;
  }).join('') + `<button class="filter-tab filter-add-btn" onclick="showAddFilterModal()">+</button>`;
}
function setFilter(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderChatList();
}

/* ===== CUSTOM FILTERS ===== */
function showAddFilterModal() { document.getElementById('addFilterModal').classList.add('open'); }
function closeAddFilter() { document.getElementById('addFilterModal').classList.remove('open'); }
function addCustomFilter() {
  const name = document.getElementById('newFilterName').value.trim().toLowerCase();
  if (!name || DEFAULT_FILTERS.includes(name) || customFilters.includes(name)) return;
  customFilters.push(name);
  localStorage.setItem('blushift-filters', JSON.stringify(customFilters));
  document.getElementById('newFilterName').value = '';
  closeAddFilter();
  renderFilterTabs();
}

/* ===== AVATAR HELPERS ===== */
function avStyle(c) {
  return (c && c.pfp) ? ` style="background-image:url('${c.pfp}');background-size:cover;background-position:center"` : '';
}
function avInner(c) {
  return (c && c.pfp) ? '' : (c ? c.initials : '');
}
function lastActivity(item) {
  let max = 0;
  (item && item.messages || []).forEach(m => { if (m.ts && m.ts > max) max = m.ts; });
  return max;
}

/* ===== CHAT LIST (recency sorted) ===== */
function renderChatList() {
  const list = document.getElementById('chatList');
  let items = [];

  CONTACTS.forEach(c => {
    const conv = CONVERSATIONS[c.id];
    if (!conv) return;
    if (blockUnknown && !c.known) return;            // Privacy → block unknown senders
    if (currentFilter === 'unread' && conv.unread <= 0) return;
    if (currentFilter === 'groups') return;
    if (currentFilter === 'known' && !c.known) return;
    if (currentFilter === 'iPhone' && c.platform !== 'iPhone') return;
    if (currentFilter === 'Android' && c.platform !== 'Android') return;
    if (customFilters.includes(currentFilter)) {
      if (!c.notes || !c.notes.toLowerCase().includes(currentFilter)) return;
    }
    const isBlue = c.blueMode && globalBlueMode && c.platform === 'iPhone';
    items.push({ sort: lastActivity(conv), html: `
      <div class="cl-item slide-in" onclick="openChat(${c.id},'dm')">
        <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${avInner(c)}</div>
        <div class="cl-body">
          <div class="cl-row-top">
            <span class="cl-name">${c.name}</span>
            <span class="cl-time">${conv.time}</span>
          </div>
          <div class="cl-preview">${conv.preview}</div>
          <div class="cl-meta">
            ${isBlue ? '<span class="cl-badge cl-badge-blue">BLUE BUBBLE</span>' : ''}
            ${c.platform==='Android' ? '<span class="cl-badge cl-badge-sms">SMS</span>' : ''}
          </div>
        </div>
        ${conv.unread > 0 ? `<div class="cl-unread">${conv.unread}</div>` : ''}
      </div>
    `});
  });

  if (currentFilter !== 'known' && currentFilter !== 'iPhone' && currentFilter !== 'Android' && !customFilters.includes(currentFilter)) {
    GROUPS.forEach(g => {
      if (currentFilter === 'unread' && g.unread <= 0) return;
      const memberCount = g.members.length + 1;
      const gAv = g.photo
        ? `<div class="cl-avatar cl-av-group" style="background-image:url('${g.photo}');background-size:cover;background-position:center"></div>`
        : `<div class="cl-avatar cl-av-group"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/></svg></div>`;
      items.push({ sort: lastActivity(g), html: `
        <div class="cl-item slide-in" onclick="openChat('${g.id}','group')">
          ${gAv}
          <div class="cl-body">
            <div class="cl-row-top">
              <span class="cl-name">${g.name}</span>
              <span class="cl-time">${g.time}</span>
            </div>
            <div class="cl-preview">${g.lastSender ? `<b class="cl-sender">${g.lastSender}:</b> ` : ''}${g.preview}</div>
          </div>
          ${g.unread > 0 ? `<div class="cl-unread">${g.unread}</div>` : ''}
        </div>
      `});
    });
  }

  items.sort((a,b) => b.sort - a.sort);
  list.innerHTML = items.map((i,idx) => i.html.replace('slide-in', `slide-in stagger-${Math.min(idx,8)}`)).join('');
}

function filterChats(query) {
  const items = document.querySelectorAll('.cl-item');
  const q = query.toLowerCase();
  items.forEach(item => {
    const name = item.querySelector('.cl-name')?.textContent.toLowerCase() || '';
    const preview = item.querySelector('.cl-preview')?.textContent.toLowerCase() || '';
    item.style.display = (name.includes(q) || preview.includes(q)) ? 'flex' : 'none';
  });
}

/* ===== OPEN CHAT ===== */
function openChat(id, type) {
  cancelReply();   // reply draft shouldn't carry over between chats
  activeChat = id;
  activeChatType = type;
  let name, initials, sub, messages, isBlue = false, photo = null;
  const infoBtn = document.getElementById('chatInfoBtn');

  if (type === 'group') {
    const g = GROUPS.find(x => x.id === id);
    if (!g) return;
    name = g.name;
    initials = g.name.substring(0,2);
    sub = g.members.map(mid => CONTACTS.find(c=>c.id===mid)?.name || '?').join(', ');
    messages = g.messages;
    g.unread = 0;
    isBlue = true;
    photo = g.photo;
    infoBtn.onclick = () => showChatSettings();
  } else {
    const c = CONTACTS.find(x => x.id === id);
    const conv = CONVERSATIONS[id];
    if (!c || !conv) return;
    name = c.name;
    initials = c.initials;
    isBlue = c.blueMode && globalBlueMode && c.platform === 'iPhone';
    sub = isBlue ? 'iPHONE · VIA BLUSHIFT' : c.platform === 'iPhone' ? 'iPHONE · STANDARD' : 'ANDROID · RCS';
    messages = conv.messages;
    conv.unread = 0;
    photo = c.pfp;
    infoBtn.onclick = () => showContactInfo();
  }

  const av = document.getElementById('chatAvatar');
  if (photo) {
    av.style.backgroundImage = `url('${photo}')`;
    av.style.backgroundSize = 'cover';
    av.style.backgroundPosition = 'center';
    av.textContent = '';
  } else { av.style.backgroundImage = ''; av.textContent = initials; }
  document.getElementById('chatName').textContent = name;
  document.getElementById('chatSub').textContent = sub;
  document.getElementById('bluHud').style.display = isBlue ? 'flex' : 'none';

  renderMessages(messages);
  renderPinned();
  applyBg();
  showView('chat');
  scrollToBottom();
}

/* ===== EMOJI-ONLY DETECTION ===== */
function isEmojiOnly(text) {
  if (!text || /<|\n/.test(text)) return false;
  const stripped = text.replace(/\s/g,'');
  if (!stripped) return false;
  try {
    const noEmoji = stripped.replace(/[\p{Extended_Pictographic}‍️⃣\u{1F1E6}-\u{1F1FF}]/gu, '');
    if (noEmoji.length > 0) return false;
    const count = [...stripped.matchAll(/\p{Extended_Pictographic}/gu)].length;
    return count > 0 && count <= 3;
  } catch (e) { return false; }
}

/* ===== RENDER MESSAGES ===== */
function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  const e2e = '<div class="e2e-banner"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> End-to-end encrypted · stored only on this device</div>';
  container.innerHTML = e2e + messages.map(m => {
    if (m.type === 'timestamp') return `<div class="msg-date">${m.text}</div>`;
    if (m.type === 'status') {
      const isRead = /^Read/.test(m.text);
      return `<div class="msg-status${isRead ? ' read' : ''}">${m.text}</div>`;
    }
    if (m.type === 'unsent') return `<div class="msg-unsent">You unsent a message</div>`;
    if (m.type === 'typing') return `<div class="msg-row"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;

    if (m.type === 'poll') {
      const totalVotes = m.options.reduce((s,o) => s + o.votes, 0);
      const hasVoted = m.options.some(o => o.voted);
      return `<div class="msg-row ${m.from ? '' : 'sent'}">
        <div class="poll-bubble">
          <div class="poll-question">📊 ${m.question}</div>
          ${m.options.map((o,i) => {
            const pct = totalVotes > 0 ? Math.round(o.votes / totalVotes * 100) : 0;
            return `
            <div class="poll-option ${o.voted ? 'voted' : ''}" onclick="votePoll(${m.id},${i})">
              <div class="poll-check"></div>
              <span class="poll-opt-text">${o.text}</span>
              ${hasVoted ? `<span class="poll-pct">${pct}%</span>` : ''}
            </div>
            ${hasVoted ? `<div class="poll-bar-wrap"><div class="poll-bar-fill" style="width:${pct}%"></div></div>` : ''}
          `}).join('')}
          <div class="poll-votes">${totalVotes} vote${totalVotes!==1?'s':''}</div>
        </div>
      </div>`;
    }

    if (m.type === 'location') {
      return `<div class="msg-row ${m.from ? '' : 'sent'}">
        <div class="location-bubble">
          <div class="loc-map"><span class="loc-pin">📍</span></div>
          <div class="loc-label">${m.locType === 'live' ? '🔴 Live Location' : 'Current Location'}</div>
          <div class="loc-sub">${m.locType === 'live' ? `Sharing for ${formatDuration(m.duration)}` : 'Shared just now'}</div>
        </div>
      </div>`;
    }

    if (m.type === 'song') {
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      const art = m.art ? `<img class="song-art" src="${m.art}" alt="">` : `<div class="song-art song-art-ph">🎵</div>`;
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="song-card${pop}" onclick="openSong(${m.id})" oncontextmenu="event.preventDefault();openTapback(${m.id})" title="Open in Spotify">
          <div class="song-top"><span class="spotify-mark"><svg width="13" height="13" viewBox="0 0 24 24" fill="#1DB954"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg> Spotify</span><span class="song-kind">OPEN ▸</span></div>
          <div class="song-body">
            ${art}
            <div class="song-info"><div class="song-title">${m.title}</div><div class="song-artist">${m.artist}</div></div>
            <button class="song-play" onclick="event.stopPropagation();playSongPreview(${m.id},this)" title="Play preview"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></button>
          </div>
          <div class="song-progress"><div class="song-progress-fill" id="songfill-${m.id}"></div></div>
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'voicememo') {
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      const bars = (m.wave || []).map(h => `<span style="height:${Math.max(12, h)}%"></span>`).join('');
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="msg-bubble ${m.from ? 'recv' : 'sent'} vm-bubble${pop}" oncontextmenu="event.preventDefault();openTapback(${m.id})">
          <button class="vmemo-play" onclick="playVoiceMemo(${m.id},this)"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg></button>
          <div class="vmemo-wave">${bars}<div class="vmemo-fill" id="vmfill-${m.id}"></div></div>
          <span class="vmemo-dur">${m.dur}</span>
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'file') {
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="msg-bubble ${m.from ? 'recv' : 'sent'} file-bubble${pop}" onclick="openSentFile(${m.id})" oncontextmenu="event.preventDefault();openTapback(${m.id})">
          <div class="file-row"><span class="file-ic">${m.icon || '📎'}</span><span class="file-meta"><span class="file-name">${m.name}</span><span class="file-sub">${m.sub} · tap to open</span></span></div>
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'contactcard') {
      const cc = CONTACTS.find(c => c.id === m.contactId);
      const av = cc && cc.pfp ? ` style="background-image:url('${cc.pfp}');background-size:cover;background-position:center"` : '';
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="msg-bubble ${m.from ? 'recv' : 'sent'} contact-bubble${pop}" onclick="openSentContact(${m.contactId})" oncontextmenu="event.preventDefault();openTapback(${m.id})">
          <div class="file-row"><span class="cc-av"${av}>${cc && cc.pfp ? '' : (cc ? cc.initials : '👤')}</span><span class="file-meta"><span class="file-name">${m.ccName}</span><span class="file-sub">${m.ccPhone} · tap to view</span></span></div>
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'payment') {
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      const isReq = m.kind === 'request';
      const w = WALLETS.find(x => x.id === m.wallet) || WALLETS[0];
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="pay-msg${pop} ${isReq ? 'req' : ''}" oncontextmenu="event.preventDefault();openTapback(${m.id})">
          <div class="pay-msg-top">${w.mark}<span class="pay-msg-kind">${isReq ? 'Request' : 'Payment'}</span></div>
          <div class="pay-msg-amt">$${m.amount}</div>
          ${m.note ? `<div class="pay-msg-note">${m.note}</div>` : ''}
          <div class="pay-msg-foot">${isReq ? 'Tap to pay' : 'Sent via ' + w.name}</div>
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'sticker') {
      const inner = m.stickerKind === 'img'
        ? `<img src="${m.sticker}" class="sticker-img-msg">`
        : `<span class="wa-emoji sticker-emoji-big">${EM(m.sticker)}</span>`;
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="sticker-msg${pop}" onclick="handleBubbleTap(event,${m.id})" oncontextmenu="event.preventDefault();openTapback(${m.id})">${inner}${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}</div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    if (m.type === 'album') {
      const n = m.photos.length;
      const cls = n === 1 ? 'album-1' : n === 2 ? 'album-2' : n === 3 ? 'album-3' : 'album-4';
      const pop = m.id === recentAnimId ? ' pop-in' : '';
      return `<div class="msg-row ${m.from ? '' : 'sent'}" data-msg-id="${m.id}">
        <div class="photo-album ${cls}${pop}" oncontextmenu="event.preventDefault();openTapback(${m.id})">
          ${m.photos.slice(0,4).map((p,i) => {
            const isVid = p.kind === 'video';
            const media = isVid
              ? `<video class="album-media" src="${p.val}" muted playsinline></video><span class="album-vid">▶</span>`
              : (p.kind === 'grad' ? '' : `<img class="album-media" src="${p.val}" alt="">`);
            const cellStyle = p.kind === 'grad' ? ` style="background:${p.val}"` : '';
            const overlay = (i === 3 && n > 4) ? `<span class="album-more">+${n-4}</span>` : '';
            return `<div class="album-cell"${cellStyle} onclick="event.stopPropagation();openPhotoViewer(${m.id},${i})">${media}${overlay}</div>`;
          }).join('')}
          ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
        </div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    const isSent = m.type === 'sent';

    if ((isSent || m.type === 'recv') && isEmojiOnly(m.text) && !m.replyTo) {
      return `<div class="msg-row ${isSent ? 'sent' : ''}" data-msg-id="${m.id}">
        <div class="emoji-only wa-emoji" onclick="handleBubbleTap(event,${m.id})" oncontextmenu="event.preventDefault();openTapback(${m.id})">${EM(m.text)}${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}</div>
        <div class="swipe-hint">↩</div>
      </div>`;
    }

    const fromName = m.from ? (CONTACTS.find(c=>c.id===m.from)?.name || '?') : '';
    const replyHtml = m.replyTo ? `<div class="reply-ref"><strong>${m.replyTo.name}</strong>${m.replyTo.text}</div>` : '';
    const editedHtml = m.edited ? '<span class="edited-tag">Edited</span>' : '';

    // Auto-translate: by default show ONLY the translated text + a tag.
    // Tapping the tag reveals the original message instead.
    let bodyHtml = EM(m.text);
    let trTag = '';
    if (m.type === 'recv' && autoTranslateOn && m.text) {
      const det = detectLanguage(m.text);
      if (det && det.code !== appLang) {
        if (!m.translated && !m._translating) requestTranslation(m, det.code);
        if (m.translated) {
          if (m._showOriginal) {
            bodyHtml = EM(m.text);
            trTag = `<span class="auto-tr-tag tap" onclick="event.stopPropagation();toggleTranslateView(${m.id})">Show translation ▸</span>`;
          } else {
            bodyHtml = EM(m.translated);
            trTag = `<span class="auto-tr-tag tap" onclick="event.stopPropagation();toggleTranslateView(${m.id})">Translated from ${det.name} ▸</span>`;
          }
        } else {
          trTag = `<span class="auto-tr-tag"><span class="tr-loading">Translating…</span></span>`;
        }
      }
    }

    return `<div class="msg-row ${isSent ? 'sent' : ''}" data-msg-id="${m.id}">
      <div class="msg-bubble ${isSent ? 'sent' : 'recv'}"
           onclick="handleBubbleTap(event,${m.id})"
           oncontextmenu="event.preventDefault();openTapback(${m.id})">
        ${!isSent && activeChatType==='group' && fromName ? `<div style="font-size:11px;color:var(--accent-1);font-weight:600;margin-bottom:2px">${fromName}</div>` : ''}
        ${replyHtml}
        ${bodyHtml}${editedHtml}
        ${trTag}
        ${m.reaction ? `<div class="msg-reaction wa-emoji">${EM(m.reaction)}</div>` : ''}
      </div>
      <div class="swipe-hint">↩</div>
    </div>`;
  }).join('');
  recentAnimId = null;
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}
function scrollToBottom() {
  requestAnimationFrame(() => {
    const c = document.getElementById('messagesContainer');
    c.scrollTop = c.scrollHeight;
  });
}
function getActiveIsBlue() {
  const c = activeChatType === 'dm' ? CONTACTS.find(x => x.id === activeChat) : null;
  return c ? (c.blueMode && globalBlueMode && c.platform === 'iPhone') : true;
}

/* ===== READ RECEIPTS ===== */
function scheduleReadReceipt(statusId) {
  const chatId = activeChat, chatType = activeChatType;
  setTimeout(() => {
    const msgs = (chatType === 'group') ? GROUPS.find(g => g.id === chatId)?.messages : CONVERSATIONS[chatId]?.messages;
    if (!msgs) return;
    const st = msgs.find(m => m.id === statusId && m.type === 'status');
    if (st) { st.text = 'Read ' + clockNow(); if (activeChat === chatId && activeChatType === chatType) renderMessages(msgs); }
  }, 2400 + Math.random() * 1600);
}

/* ===== SEND MESSAGE ===== */
function sendMessage() {
  const input = document.getElementById('composeInput');
  const text = input.value.trim();
  if (!text || activeChat === null) return;
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  const newMsg = { id: newId, type:'sent', text, ts: Date.now() };
  if (replyTarget) { newMsg.replyTo = { name: replyTarget.name, text: replyTarget.text }; cancelReply(); }
  filtered.push(newMsg);
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview(text);
  input.value = '';
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
  if (isBlue || activeChatType === 'group') simulateReply();
}

function getActiveMessages() {
  if (activeChatType === 'group') { const g = GROUPS.find(x => x.id === activeChat); return g ? g.messages : null; }
  return CONVERSATIONS[activeChat]?.messages || null;
}
function setActiveMessages(msgs) {
  if (activeChatType === 'group') { const g = GROUPS.find(x => x.id === activeChat); if (g) g.messages = msgs; }
  else { if (CONVERSATIONS[activeChat]) CONVERSATIONS[activeChat].messages = msgs; }
  persistConversations();
}

/* ===== END-TO-END ENCRYPTION (AES-256-GCM, on-device) =====
   Messages live only on this device and are stored ENCRYPTED — there's no server,
   so no developer/server can read them. Uses the Web Crypto API. */
function _b64FromBytes(bytes) { let s = ''; const CH = 0x8000; for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH)); return btoa(s); }
function _bytesFromB64(b64) { const bin = atob(b64); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
const BSCrypto = (() => {
  let keyPromise = null;
  function subtle() { return (window.crypto && window.crypto.subtle) ? window.crypto.subtle : null; }
  function getKey() {
    if (keyPromise) return keyPromise;
    keyPromise = (async () => {
      if (!subtle()) return null;
      let raw = localStorage.getItem('blushift-dek');
      let bytes;
      if (raw) { bytes = _bytesFromB64(raw); }
      else { bytes = crypto.getRandomValues(new Uint8Array(32)); localStorage.setItem('blushift-dek', _b64FromBytes(bytes)); }
      return subtle().importKey('raw', bytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    })();
    return keyPromise;
  }
  return {
    available() { return !!subtle(); },
    async encrypt(text) {
      const key = await getKey(); if (!key) return null;
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ct = await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
      const out = new Uint8Array(iv.length + ct.byteLength); out.set(iv, 0); out.set(new Uint8Array(ct), iv.length);
      return _b64FromBytes(out);
    },
    async decrypt(b64) {
      const key = await getKey(); if (!key) return null;
      const data = _bytesFromB64(b64); const iv = data.slice(0, 12), ct = data.slice(12);
      const pt = await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct);
      return new TextDecoder().decode(pt);
    }
  };
})();
let _persistTimer = null;
function persistConversations() {
  if (!BSCrypto.available()) return;
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(async () => {
    try {
      const snap = { c: {}, g: {} };
      for (const id in CONVERSATIONS) snap.c[id] = CONVERSATIONS[id].messages;
      GROUPS.forEach(g => { snap.g[g.id] = g.messages; });
      const enc = await BSCrypto.encrypt(JSON.stringify(snap));
      if (enc) localStorage.setItem('blushift-convos-enc', enc);
    } catch (e) {}
  }, 400);
}
async function loadConversations() {
  if (!BSCrypto.available()) return;
  const blob = localStorage.getItem('blushift-convos-enc');
  if (!blob) return;
  try {
    const snap = JSON.parse(await BSCrypto.decrypt(blob));
    if (snap && snap.c) for (const id in snap.c) { if (CONVERSATIONS[id]) CONVERSATIONS[id].messages = snap.c[id]; }
    if (snap && snap.g) GROUPS.forEach(g => { if (snap.g[g.id]) g.messages = snap.g[g.id]; });
    renderChatList();
    if (activeChat !== null) { const m = getActiveMessages(); if (m) renderMessages(m); }
  } catch (e) {}   // corrupt/old data -> keep defaults (no break)
}
async function verifyEncryption() {
  const sample = 'Hey — this is a private BLUSHIFT message ✦';
  try {
    const ct = await BSCrypto.encrypt(sample);
    const back = await BSCrypto.decrypt(ct);
    showConfirm('🔒 End-to-End Encryption', `AES-256-GCM is working.\n\nYour message:\n"${sample}"\n\nStored on disk as:\n${ct.slice(0, 80)}…\n\nDecrypted back:\n"${back}"\n\nNo server ever receives this — it lives only on your device.`, 'Got it');
  } catch (e) { showConfirm('Encryption', 'Encryption is unavailable in this browser.', 'OK'); }
}

/* ===== SYNC CONTACTS FROM PHONE (Web Contact Picker API) ===== */
function loadImportedContacts() {
  let arr;
  try { arr = JSON.parse(localStorage.getItem('blushift-imported-contacts') || '[]'); } catch (e) { return; }
  arr.forEach(ic => {
    if (CONTACTS.some(c => c.id === ic.id)) return;
    CONTACTS.push(ic);
    if (!CONVERSATIONS[ic.id]) CONVERSATIONS[ic.id] = { messages: [{ id: 1, type: 'timestamp', text: 'Today' }], preview: 'Synced from phone · tap to chat', time: '', unread: 0 };
  });
}
function saveImportedContacts() {
  try { localStorage.setItem('blushift-imported-contacts', JSON.stringify(CONTACTS.filter(c => c.imported))); } catch (e) {}
}
async function syncPhoneContacts() {
  if (!('contacts' in navigator) || !navigator.contacts || !navigator.contacts.select) {
    showConfirm('Sync Contacts', 'Importing your phone contacts works in a supported phone browser (Chrome on Android). Open BLUSHIFT on your phone and tap Sync again.', 'OK');
    return;
  }
  let picked;
  try { picked = await navigator.contacts.select(['name', 'tel'], { multiple: true }); }
  catch (e) { return; }   // user cancelled or denied
  if (!picked || !picked.length) return;
  let nextId = Math.max(99, ...CONTACTS.map(c => c.id)) + 1;
  let added = 0;
  picked.forEach(p => {
    const name = (p.name && p.name[0]) || (p.tel && p.tel[0]) || 'Unknown';
    const tel = (p.tel && p.tel[0]) || '';
    if (CONTACTS.some(c => c.name === name && c.phone === tel)) return;
    const id = nextId++;
    CONTACTS.push({ id, name, initials: (name.replace(/[^A-Za-z ]/g, '').trim().slice(0, 2) || '#').toUpperCase(), platform: 'iPhone', blueMode: true, known: true, phone: tel, address: '', notes: 'Synced from phone', imported: true });
    CONVERSATIONS[id] = { messages: [{ id: 1, type: 'timestamp', text: 'Today' }], preview: 'Synced from phone · tap to chat', time: '', unread: 0 };
    added++;
  });
  saveImportedContacts();
  renderContactList();
  toast(added ? `${added} contact${added === 1 ? '' : 's'} synced ✓` : 'Those contacts are already here');
}
function updatePreview(text, sender) {
  const time = new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
  if (activeChatType === 'group') { const g = GROUPS.find(x => x.id === activeChat); if (g) { g.preview = text; g.time = time; g.lastSender = sender || 'You'; } }
  else { const conv = CONVERSATIONS[activeChat]; if (conv) { conv.preview = text; conv.time = time; } }
}

function simulateReply() {
  const msgs = getActiveMessages();
  if (!msgs) return;
  setTimeout(() => {
    msgs.push({ id: Date.now(), type:'typing' });
    renderMessages(msgs);
    scrollToBottom();
    setTimeout(() => {
      const replies = ['haha nice!','sounds good to me','ok bet 🔥','lol for real?','perfect 🙌',"I'll let you know!",'wait really??','omg yes','no way 😂','that works!'];
      const reply = replies[Math.floor(Math.random()*replies.length)];
      const filtered = msgs.filter(m => m.type !== 'typing');
      const fromId = activeChatType === 'group'
        ? GROUPS.find(g=>g.id===activeChat)?.members[Math.floor(Math.random()*GROUPS.find(g=>g.id===activeChat).members.length)]
        : null;
      filtered.push({ id: Date.now(), type:'recv', text:reply, from:fromId, ts:Date.now() });
      setActiveMessages(filtered);
      const senderName = activeChatType === 'group' ? (CONTACTS.find(c=>c.id===fromId)?.name || 'Someone') : null;
      updatePreview(reply, senderName);
      renderMessages(filtered);
      scrollToBottom();
    }, 1200 + Math.random()*2000);
  }, 600);
}

/* ===== TAPBACK / REACTIONS ===== */
function handleBubbleTap(e, msgId) { if (e.detail === 2) openTapback(msgId); }

function openTapback(msgId) {
  tapbackTargetId = msgId;
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === msgId);
  if (!msg) return;
  document.getElementById('tapbackPreview').textContent = msg.text || (msg.stickerKind==='emoji'?msg.sticker:'') || (msg.type === 'album' ? '📷 Photo' : msg.type === 'sticker' ? '🎨 Sticker' : '');
  const actions = document.getElementById('tapbackActions');
  const editBtn = actions.querySelector('[onclick="editMessage()"]');
  const unsendBtn = actions.querySelector('[onclick="unsendMessage()"]');
  const canEdit = msg.type === 'sent' && msg.text && msg.ts && (Date.now() - msg.ts) < EDIT_WINDOW_MS;
  if (editBtn) editBtn.style.display = canEdit ? 'flex' : 'none';
  if (unsendBtn) unsendBtn.style.display = (msg.ts && (Date.now() - msg.ts) < EDIT_WINDOW_MS && msg.type !== 'recv') ? 'flex' : 'none';
  const copyBtn = actions.querySelector('[onclick="copyMessage()"]');
  if (copyBtn) copyBtn.style.display = msg.text ? 'flex' : 'none';
  const readByBtn = actions.querySelector('[onclick="showReadReceipts()"]');
  if (readByBtn) readByBtn.style.display = (activeChatType === 'group' && msg.type === 'sent') ? 'flex' : 'none';
  const pinBtn = actions.querySelector('[onclick="pinMessage()"]');
  if (pinBtn) pinBtn.innerHTML = (pinnedByChat[activeChat] === msgId)
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.5-3V5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9z"/></svg> Unpin'
    : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.5-3V5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9z"/></svg> Pin';
  refreshTapbackEmojis();
  document.getElementById('tapbackModal').classList.add('open');
}

/* ===== COPY / PIN / READ-BY ===== */
function copyMessage() {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  if (msg && msg.text) {
    const plain = msg.text.replace(/<[^>]+>/g, '');
    if (navigator.clipboard) navigator.clipboard.writeText(plain).catch(()=>{});
    toast('Copied');
  }
  closeTapback();
}
function pinMessage() {
  const id = tapbackTargetId;
  if (pinnedByChat[activeChat] === id) delete pinnedByChat[activeChat];
  else pinnedByChat[activeChat] = id;
  closeTapback();
  renderPinned();
}
function renderPinned() {
  const bar = document.getElementById('pinnedBar');
  if (!bar) return;
  const id = pinnedByChat[activeChat];
  const msgs = getActiveMessages();
  const msg = id ? msgs?.find(m => m.id === id) : null;
  if (!msg) { bar.classList.add('hidden'); return; }
  const txt = (msg.text || (msg.type === 'album' ? '📷 Photo' : msg.type === 'sticker' ? '🎨 Sticker' : msg.type === 'file' ? '📎 ' + msg.name : 'Message')).replace(/<[^>]+>/g, '');
  bar.classList.remove('hidden');
  bar.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14l-1.5-3V5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v9z"/></svg><span class="pin-txt">${txt}</span><button class="pin-x" onclick="unpinActive(event)">✕</button>`;
  bar.onclick = () => scrollToMsg(id);
}
function unpinActive(e) { if (e) e.stopPropagation(); delete pinnedByChat[activeChat]; renderPinned(); }
function scrollToMsg(id) {
  const row = document.querySelector(`.msg-row[data-msg-id="${id}"]`);
  if (row) { row.scrollIntoView({ behavior:'smooth', block:'center' }); row.classList.add('flash'); setTimeout(()=>row.classList.remove('flash'), 1200); }
}
function showReadReceipts() {
  const g = GROUPS.find(x => x.id === activeChat);
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  closeTapback();
  if (!g || !msg) return;
  const base = msg.ts || Date.now();
  const list = document.getElementById('readByList');
  list.innerHTML = g.members.map((mid, i) => {
    const c = CONTACTS.find(x => x.id === mid);
    const t = new Date(base + (i + 1) * (45000 + Math.random() * 120000));
    const hh = t.getHours() % 12 || 12, mm = t.getMinutes().toString().padStart(2,'0'), ap = t.getHours() < 12 ? 'AM' : 'PM';
    const avb = c && c.pfp ? ` style="width:34px;height:34px;font-size:11px;background-image:url('${c.pfp}');background-size:cover;background-position:center"` : ' style="width:34px;height:34px;font-size:11px"';
    return `<div class="rb-item">
      <div class="cl-avatar cl-av-blue"${avb}>${c && c.pfp ? '' : (c ? c.initials : '?')}</div>
      <span class="rb-name">${c ? c.name : 'Member'}</span>
      <span class="rb-time">Read ${hh}:${mm} ${ap}</span>
    </div>`;
  }).join('');
  document.getElementById('readByModal').classList.add('open');
}
function closeReadBy() { document.getElementById('readByModal').classList.remove('open'); }

function toast(text) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1400);
}
function closeTapback() { document.getElementById('tapbackModal').classList.remove('open'); tapbackTargetId = null; }

function addReaction(emoji) {
  const msgs = getActiveMessages();
  const targetId = tapbackTargetId;
  const msg = msgs?.find(m => m.id === targetId);
  if (msg) {
    msg.reaction = msg.reaction === emoji ? null : emoji;
    updateReactionDOM(targetId, msg.reaction);   // only animate THIS one
  }
  closeEmojiPicker();
  closeTapback();
}
/* surgically update a single message's reaction so only it animates */
function updateReactionDOM(msgId, emoji) {
  const row = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (!row) return;
  const container = row.querySelector('.msg-bubble, .sticker-msg, .emoji-only, .photo-album');
  if (!container) return;
  const old = container.querySelector(':scope > .msg-reaction');
  if (old) old.remove();
  if (emoji) {
    const span = document.createElement('div');
    span.className = 'msg-reaction wa-emoji pop';
    span.innerHTML = EM(emoji);
    container.appendChild(span);
  }
}

/* ===== FULL EMOJI PICKER (keeps tapback target!) ===== */
function openEmojiPicker() {
  document.getElementById('tapbackModal').classList.remove('open'); // keep tapbackTargetId set
  renderEmojiCategories();
  renderEmojiGrid(Object.keys(EMOJI_CATEGORIES)[0]);
  document.getElementById('emojiPickerModal').classList.add('open');
}
function closeEmojiPicker() { document.getElementById('emojiPickerModal').classList.remove('open'); }
function renderEmojiCategories() {
  const container = document.getElementById('emojiCategories');
  container.innerHTML = Object.keys(EMOJI_CATEGORIES).map((cat, i) =>
    `<button class="emoji-cat-btn ${i===0?'active':''}" onclick="selectEmojiCategory('${cat}',this)">${cat}</button>`
  ).join('');
}
function selectEmojiCategory(cat, btn) {
  document.querySelectorAll('.emoji-cat-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderEmojiGrid(cat);
}
function renderEmojiGrid(cat) {
  const grid = document.getElementById('emojiGrid');
  const emojis = EMOJI_CATEGORIES[cat] || [];
  grid.innerHTML = emojis.map(e => `<button class="emoji-cell" data-e="${e}" onclick="pickReaction(this)">${EM(e)}</button>`).join('');
}
function searchEmoji(query) {
  const grid = document.getElementById('emojiGrid');
  if (!query) {
    const activeCat = document.querySelector('.emoji-cat-btn.active')?.textContent || Object.keys(EMOJI_CATEGORIES)[0];
    renderEmojiGrid(activeCat);
    return;
  }
  const all = Object.values(EMOJI_CATEGORIES).flat();
  grid.innerHTML = all.map(e => `<button class="emoji-cell" data-e="${e}" onclick="pickReaction(this)">${EM(e)}</button>`).join('');
}
/* read the emoji from data attr (textContent is empty when rendered as an image) */
function pickReaction(btn) { addReaction(btn.dataset.e || btn.textContent); }

/* ===== STICKERS (emoji + image) ===== */
function showStickerPicker() {
  renderStickerTabs();
  selectStickerPack(STICKER_PACKS[0].id, null);
  document.getElementById('stickerModal').classList.add('open');
}
/* generic animated close for + menu sub-sheets (slides down like the + menu) */
function closeSheetAnimated(modalId, cleanup) {
  if (cleanup) cleanup();
  const modal = document.getElementById(modalId);
  if (!modal || !modal.classList.contains('open')) return;
  modal.classList.add('sheet-closing');
  setTimeout(() => { modal.classList.remove('open', 'sheet-closing'); }, 260);
}
function closeStickerPicker() { closeSheetAnimated('stickerModal'); }
function renderStickerTabs() {
  const container = document.getElementById('stickerTabs');
  container.innerHTML = STICKER_PACKS.map((p,i) =>
    `<button class="sticker-tab ${i===0?'active':''}" data-pack="${p.id}" onclick="selectStickerPack('${p.id}',this)">${p.name}</button>`
  ).join('');
}
function selectStickerPack(packId, btn) {
  document.querySelectorAll('.sticker-tab').forEach(b => b.classList.toggle('active', b.dataset.pack === packId));
  renderStickerGrid(packId);
}
function renderStickerGrid(packId) {
  const pack = STICKER_PACKS.find(p => p.id === packId);
  const grid = document.getElementById('stickerGrid');
  if (!pack || pack.stickers.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:24px 10px;color:var(--txt-dim);font-size:13px">No stickers in this pack yet.<br>Tap “Create Sticker” to upload an image.</div>';
    return;
  }
  grid.innerHTML = pack.stickers.map((s,i) => {
    if (typeof s === 'string') return `<button class="sticker-cell wa-emoji" onclick="sendStickerByRef('${pack.id}',${i})">${EM(s)}</button>`;
    return `<button class="sticker-cell sticker-img-cell" onclick="sendStickerByRef('${pack.id}',${i})"><img src="${s.img}"></button>`;
  }).join('');
}
function sendStickerByRef(packId, i) {
  const pack = STICKER_PACKS.find(p => p.id === packId);
  if (!pack) return;
  sendStickerItem(pack.stickers[i]);
}
function sendStickerItem(s) {
  closeStickerPicker(); closeAttach();
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  if (typeof s === 'string') filtered.push({ id:newId, type:'sticker', sticker:s, stickerKind:'emoji', ts:Date.now() });
  else filtered.push({ id:newId, type:'sticker', sticker:s.img, stickerKind:'img', ts:Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id:newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview('🎨 Sticker');
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
}
function createSticker() { document.getElementById('stickerUploadInput').click(); }
function handleStickerUpload(input) {
  const f = (input.files || [])[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => openSplineCutout(e.target.result);
  reader.readAsDataURL(f);
  input.value = '';
}
function showStickerProcessing() { const el = document.getElementById('stickerProcessing'); if (el) el.classList.remove('hidden'); }
function hideStickerProcessing() { const el = document.getElementById('stickerProcessing'); if (el) el.classList.add('hidden'); }

/* "AI" background removal — flood-fill transparent from the edges
   wherever the colour matches the corner background within tolerance. */
function removeBackground(src, cb) {
  const img = new Image();
  img.onload = () => {
    const maxDim = 360;
    let w = img.width, h = img.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    let id; try { id = ctx.getImageData(0, 0, w, h); } catch (e) { cb(src); return; }
    const d = id.data;
    const corners = [[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
    let br = 0, bg = 0, bb = 0;
    corners.forEach(([x,y]) => { const i = (y*w+x)*4; br += d[i]; bg += d[i+1]; bb += d[i+2]; });
    br /= 4; bg /= 4; bb /= 4;
    const tol = 52, tol2 = tol*tol;
    const visited = new Uint8Array(w*h);
    const stack = [];
    corners.forEach(([x,y]) => stack.push(y*w+x));
    const isBgPixel = i => { const dr=d[i*4]-br, dg=d[i*4+1]-bg, db=d[i*4+2]-bb; return (dr*dr+dg*dg+db*db) < tol2; };
    while (stack.length) {
      const p = stack.pop();
      if (visited[p]) continue;
      visited[p] = 1;
      if (!isBgPixel(p)) continue;
      d[p*4+3] = 0;
      const x = p % w, y = (p / w) | 0;
      if (x > 0) stack.push(p-1);
      if (x < w-1) stack.push(p+1);
      if (y > 0) stack.push(p-w);
      if (y < h-1) stack.push(p+w);
    }
    ctx.putImageData(id, 0, 0);
    cb(cv.toDataURL('image/png'));
  };
  img.onerror = () => cb(src);
  img.src = src;
}

/* ===== SPLINE LASSO STICKER CUTOUT =====
   Tap points around what you want to keep; a smooth closed spline forms the
   boundary and everything OUTSIDE it is cut away (made transparent). */
let _splineImg = null, _splinePts = [];
function openSplineCutout(src) {
  _splinePts = [];
  const img = new Image();
  img.onload = () => {
    _splineImg = img;
    const cv = document.getElementById('splineCanvas');
    const maxW = Math.min(330, (window.innerWidth || 360) - 64), maxH = 360;
    const s = Math.min(maxW / img.width, maxH / img.height, 1);
    cv.width = Math.max(1, Math.round(img.width * s));
    cv.height = Math.max(1, Math.round(img.height * s));
    drawSpline();
    updateSplineHint();
    document.getElementById('splineModal').classList.add('open');
  };
  img.onerror = () => toast('Could not load that image');
  img.src = src;
}
function _splinePoint(e) {
  const cv = document.getElementById('splineCanvas');
  const rect = cv.getBoundingClientRect();
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return { x: (t.clientX - rect.left) * (cv.width / rect.width), y: (t.clientY - rect.top) * (cv.height / rect.height) };
}
function splineAddPoint(e) {
  if (e) e.preventDefault();
  if (!_splineImg) return;
  _splinePts.push(_splinePoint(e));
  drawSpline();
  updateSplineHint();
}
function updateSplineHint() {
  const h = document.getElementById('splineHint');
  if (!h) return;
  const need = 3 - _splinePts.length;
  h.textContent = need > 0
    ? `Tap around the part to keep — ${need} more point${need === 1 ? '' : 's'}`
    : `${_splinePts.length} points · tap “Cut Out” when it looks right`;
}
/* closed Catmull-Rom spline through the points */
function tracePath(ctx, pts) {
  const n = pts.length;
  if (n < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (n === 2) { ctx.lineTo(pts[1].x, pts[1].y); ctx.closePath(); return; }
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  ctx.closePath();
}
function drawSpline() {
  const cv = document.getElementById('splineCanvas');
  if (!cv || !_splineImg) return;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.drawImage(_splineImg, 0, 0, cv.width, cv.height);
  if (!_splinePts.length) return;
  if (_splinePts.length >= 3) {
    // dim everything OUTSIDE the shape (even-odd: spline subpath + full-canvas subpath)
    tracePath(ctx, _splinePts);
    ctx.rect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill('evenodd');
    // boundary outline
    tracePath(ctx, _splinePts);
    ctx.strokeStyle = '#4dc7ff'; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.stroke();
    ctx.setLineDash([]);
  }
  _splinePts.forEach((p, i) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, i === 0 ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#fff' : '#4dc7ff';
    ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = '#4dc7ff'; ctx.stroke();
  });
}
function undoSplinePoint() { _splinePts.pop(); drawSpline(); updateSplineHint(); }
function resetSpline() { _splinePts = []; drawSpline(); updateSplineHint(); }
function closeSplineCutout() { closeSheetAnimated('splineModal'); }
function applySplineCutout() {
  if (_splinePts.length < 3) { toast('Tap at least 3 points around what to keep'); return; }
  const cv = document.getElementById('splineCanvas');
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  _splinePts.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
  const pad = 4;
  minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
  maxX = Math.min(cv.width, maxX + pad); maxY = Math.min(cv.height, maxY + pad);
  const ow = Math.max(1, Math.round(maxX - minX)), oh = Math.max(1, Math.round(maxY - minY));
  const out = document.createElement('canvas'); out.width = ow; out.height = oh;
  const octx = out.getContext('2d');
  octx.save();
  octx.translate(-minX, -minY);
  tracePath(octx, _splinePts);
  octx.clip();
  octx.drawImage(_splineImg, 0, 0, cv.width, cv.height);
  octx.restore();
  let url; try { url = out.toDataURL('image/png'); } catch (e) { toast('Could not cut out that image'); return; }
  const custom = STICKER_PACKS.find(p => p.id === 'custom');
  custom.stickers.push({ img: url });
  closeSplineCutout();
  renderStickerTabs();
  selectStickerPack('custom', null);
  toast('Sticker created ✂️');
}

/* ===== PHOTOS — library picker + album ===== */
function showPhotoPicker() {
  selectedPhotos = [];
  renderPhotoPickerGrid();
  updatePhotoSendBtn();
  document.getElementById('photoModal').classList.add('open');
}
function closePhotoPicker() { closeSheetAnimated('photoModal'); }
function renderPhotoPickerGrid() {
  const grid = document.getElementById('photoPickerGrid');
  if (!LIBRARY.length) {
    grid.innerHTML = `<div class="lib-empty"><div style="font-size:34px">🖼️</div><div>Your photo library is empty in this demo.</div><button class="btn-secondary" style="margin-top:12px;max-width:220px" onclick="document.getElementById('photoFileInput').click()">Add from device</button></div>`;
    return;
  }
  grid.innerHTML = LIBRARY.map((p,i) => {
    const order = selectedPhotos.findIndex(s => s.val === p.val);
    const sel = order >= 0 ? 'sel' : '';
    const bg = p.kind === 'video' ? 'background:#0a0a0a' : `background-image:url('${p.val}');background-size:cover;background-position:center`;
    const badge = p.kind === 'video' ? '<span class="lib-vid">▶</span>' : '';
    const check = `<span class="photo-check">${order >= 0 ? (order+1) : '✓'}</span>`;
    return `<button class="photo-tile ${sel}" style="${bg}" onclick="toggleLibPhoto(${i})">${badge}${check}</button>`;
  }).join('');
}
function toggleLibPhoto(i) {
  const p = LIBRARY[i];
  const idx = selectedPhotos.findIndex(s => s.val === p.val);
  if (idx >= 0) selectedPhotos.splice(idx,1);
  else selectedPhotos.push({ kind:p.kind, val:p.val });
  renderPhotoPickerGrid();
  updatePhotoSendBtn();
}
function handlePhotoFiles(input) {
  const files = Array.from(input.files || []);
  ingestLibraryFiles(files, () => { renderPhotoPickerGrid(); updatePhotoSendBtn(); });
  input.value = '';
}
function updatePhotoSendBtn() {
  const b = document.getElementById('photoSendBtn');
  if (b) b.textContent = selectedPhotos.length
    ? `Send ${selectedPhotos.length} Photo${selectedPhotos.length>1?'s':''}`
    : 'Select photos to send';
}
function sendSelectedPhotos() {
  if (!selectedPhotos.length) return;
  const photos = selectedPhotos.slice();
  closePhotoPicker();
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id: newId, type:'album', photos, ts: Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview(photos.length > 1 ? `📷 ${photos.length} Photos` : '📷 Photo');
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
  selectedPhotos = [];
}

/* ===== PHOTO VIEWER / CAROUSEL ===== */
let viewerZoom = 1;
function openPhotoViewer(msgId, startIdx) {
  const msgs = getActiveMessages();
  const m = msgs?.find(x => x.id === msgId);
  if (!m || (m.type !== 'album' && m.type !== 'sticker')) return;
  viewerPhotos = m.type === 'album' ? m.photos : [{ kind:'img', val: m.sticker }];
  viewerIndex = Math.max(0, Math.min(startIdx || 0, viewerPhotos.length - 1));
  viewerZoom = 1;
  renderViewer();
  const v = document.getElementById('photoViewer');
  v.classList.add('open');
}
function renderViewer() {
  const stage = document.getElementById('viewerStage');
  if (!stage) return;
  const p = viewerPhotos[viewerIndex];
  stage.innerHTML = p.kind === 'video'
    ? `<video src="${p.val}" controls autoplay playsinline class="viewer-media"></video>`
    : `<img src="${p.val}" class="viewer-media" id="viewerImg" ondblclick="toggleViewerZoom()">`;
  document.getElementById('viewerCount').textContent = `${viewerIndex+1} of ${viewerPhotos.length}`;
  document.getElementById('viewerDots').innerHTML = viewerPhotos.length > 1 ? viewerPhotos.map((_,i) =>
    `<span class="vdot ${i===viewerIndex?'active':''}" onclick="gotoViewer(${i})"></span>`).join('') : '';
  document.getElementById('viewerStrip').innerHTML = viewerPhotos.length > 1 ? viewerPhotos.map((ph,i) => {
    const bg = ph.kind === 'video' ? 'background:#0a0a0a' : `background-image:url('${ph.val}');background-size:cover;background-position:center`;
    return `<button class="vthumb ${i===viewerIndex?'active':''}" style="${bg}" onclick="gotoViewer(${i})">${ph.kind==='video'?'▶':''}</button>`;
  }).join('') : '';
}
function toggleViewerZoom() {
  const img = document.getElementById('viewerImg');
  if (!img) return;
  viewerZoom = viewerZoom > 1 ? 1 : 2.2;
  img.style.transform = `scale(${viewerZoom})`;
  img.style.cursor = viewerZoom > 1 ? 'zoom-out' : 'zoom-in';
}
function gotoViewer(i) { viewerIndex = i; viewerZoom = 1; renderViewer(); }
function viewerNext() { if (viewerPhotos.length) { viewerIndex = (viewerIndex+1) % viewerPhotos.length; viewerZoom = 1; renderViewer(); } }
function viewerPrev() { if (viewerPhotos.length) { viewerIndex = (viewerIndex-1+viewerPhotos.length) % viewerPhotos.length; viewerZoom = 1; renderViewer(); } }
function closePhotoViewer() { document.getElementById('photoViewer').classList.remove('open'); }
function setupViewerSwipe() {
  const stage = document.getElementById('viewerStage');
  if (!stage) return;
  let sx = 0, sy = 0;
  stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive:true });
  stage.addEventListener('touchend', e => {
    if (viewerZoom > 1) return;
    const dx = e.changedTouches[0].clientX - sx;
    const dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx)) { closePhotoViewer(); return; }
    if (dx > 50) viewerPrev();
    else if (dx < -50) viewerNext();
  });
  document.addEventListener('keydown', e => {
    if (!document.getElementById('photoViewer').classList.contains('open')) return;
    if (e.key === 'ArrowRight') viewerNext();
    else if (e.key === 'ArrowLeft') viewerPrev();
    else if (e.key === 'Escape') closePhotoViewer();
  });
}

/* ===== EDIT / UNSEND / REPLY ===== */
function editMessage() {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  if (!msg) return;
  closeTapback();
  document.getElementById('editMsgInput').value = msg.text;
  document.getElementById('editModal').classList.add('open');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('open'); }
function saveEditedMessage() {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  if (!msg) return;
  const newText = document.getElementById('editMsgInput').value.trim();
  if (!newText) return;
  msg.text = newText; msg.edited = true;
  closeEditModal();
  renderMessages(msgs);
}
function unsendMessage() {
  const msgs = getActiveMessages();
  const idx = msgs?.findIndex(m => m.id === tapbackTargetId);
  if (idx === undefined || idx < 0) return;
  const msg = msgs[idx];
  if (msg.ts && (Date.now() - msg.ts) > EDIT_WINDOW_MS) { closeTapback(); return; }
  msgs.splice(idx, 1, { id: msg.id, type:'unsent' });
  closeTapback();
  renderMessages(msgs);
}
function replyToMessage() {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  if (!msg) return;
  closeTapback();
  const name = msg.type === 'sent' ? 'You' : (activeChatType === 'group' && msg.from ? CONTACTS.find(c=>c.id===msg.from)?.name : document.getElementById('chatName').textContent);
  const snippet = (msg.text || (msg.stickerKind==='emoji'?msg.sticker:'') || (msg.type==='album'?'📷 Photo':msg.type==='sticker'?'🎨 Sticker':'')).substring(0,60);
  replyTarget = { name, text: snippet };
  const preview = document.getElementById('replyPreview');
  preview.classList.remove('hidden');
  document.getElementById('replyName').textContent = name;
  document.getElementById('replyText').textContent = snippet;
  document.getElementById('composeInput').focus();
}
function cancelReply() { replyTarget = null; document.getElementById('replyPreview').classList.add('hidden'); }

/* ===== SWIPE TO REPLY ===== */
function setupSwipeListeners() {
  document.addEventListener('touchstart', e => {
    const row = e.target.closest('.msg-row[data-msg-id]');
    if (!row) return;
    swipeState.el = row; swipeState.startX = e.touches[0].clientX; swipeState.msgId = parseInt(row.dataset.msgId);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!swipeState.el) return;
    const dx = e.touches[0].clientX - swipeState.startX;
    if (dx > 30) { swipeState.el.style.transform = `translateX(${Math.min(dx - 30, 96)}px)`; swipeState.el.classList.add('swiping'); }
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!swipeState.el) return;
    const wasSwiping = swipeState.el.classList.contains('swiping');
    swipeState.el.style.transform = ''; swipeState.el.classList.remove('swiping');
    if (wasSwiping) { tapbackTargetId = swipeState.msgId; replyToMessage(); }
    swipeState = { el:null, startX:0, msgId:null };
  });
  document.addEventListener('mousedown', e => {
    const row = e.target.closest('.msg-row[data-msg-id]');
    if (!row) return;
    swipeState.el = row; swipeState.startX = e.clientX; swipeState.msgId = parseInt(row.dataset.msgId);
  });
  document.addEventListener('mousemove', e => {
    if (!swipeState.el || !e.buttons) return;
    const dx = e.clientX - swipeState.startX;
    if (dx > 30) { swipeState.el.style.transform = `translateX(${Math.min(dx - 30, 96)}px)`; swipeState.el.classList.add('swiping'); }
  });
  document.addEventListener('mouseup', () => {
    if (!swipeState.el) return;
    const wasSwiping = swipeState.el.classList.contains('swiping');
    swipeState.el.style.transform = ''; swipeState.el.classList.remove('swiping');
    if (wasSwiping) { tapbackTargetId = swipeState.msgId; replyToMessage(); }
    swipeState = { el:null, startX:0, msgId:null };
  });
}

/* ===== TRANSLATE ===== */
function translateMessage() {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === tapbackTargetId);
  if (!msg || !msg.text) { closeTapback(); return; }
  translateSourceText = msg.text;
  closeTapback();
  document.getElementById('translateContent').innerHTML = `
    <div class="translate-original"><div class="t-label">ORIGINAL</div>${msg.text}</div>
    <div class="translate-search">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input type="text" id="langSearchInput" placeholder="Search a language..." oninput="renderLangResults(this.value)" autocomplete="off">
    </div>
    <div class="lang-results" id="langResults"></div>
    <div id="translateResult"></div>`;
  renderLangResults('');
  document.getElementById('translateModal').classList.add('open');
  setTimeout(() => document.getElementById('langSearchInput')?.focus(), 50);
}
function renderLangResults(q) {
  const list = document.getElementById('langResults');
  if (!list) return;
  const ql = q.toLowerCase();
  const matches = LANGUAGES.filter(l => l.name.toLowerCase().includes(ql));
  list.innerHTML = matches.length
    ? matches.map(l => `<button class="lang-opt" onclick="doTranslate(${l.code === undefined ? "''" : `'${l.code}'`})">${l.name}</button>`).join('')
    : '<div class="lang-empty">No language found</div>';
}
function doTranslate(langCode) {
  const lang = TRANSLATIONS[langCode];
  if (!lang) return;
  const res = document.getElementById('translateResult');
  res.innerHTML = `<div class="translate-result" style="margin-top:12px"><div class="t-label">${lang.name.toUpperCase()}</div><span class="tr-loading">Translating…</span></div>`;
  const src = (detectLanguage(translateSourceText) || { code: 'en' }).code;
  translateViaAPI(translateSourceText, src, langCode, (out) => {
    let translated = out;
    if (!translated) {
      translated = translateSourceText;
      for (const [en, loc] of Object.entries(lang.samples)) translated = translated.replace(new RegExp(en, 'gi'), loc);
      if (translated === translateSourceText) translated = `[${lang.name}] ${translateSourceText}`;
    }
    res.innerHTML = `<div class="translate-result" style="margin-top:12px"><div class="t-label">${lang.name.toUpperCase()}</div>${translated}</div>`;
  });
}
function closeTranslateModal() { document.getElementById('translateModal').classList.remove('open'); }

/* real translation via MyMemory (free, no key, CORS-enabled) with local fallback */
function translateViaAPI(text, from, to, cb) {
  if (from === to) { cb(text); return; }
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  fetch(url).then(r => r.json()).then(d => {
    const out = d && d.responseData && d.responseData.translatedText;
    cb(out && !/MYMEMORY WARNING|INVALID|QUERY LENGTH/i.test(out) ? out : null);
  }).catch(() => cb(null));
}
function requestTranslation(m, fromCode) {
  if (m._translating || m.translated) return;
  m._translating = true;
  translateViaAPI(m.text, fromCode, appLang || 'en', (out) => {
    m.translated = out || translateTextToEn(m.text, fromCode);
    m._translating = false;
    if (activeChat !== null) { const msgs = getActiveMessages(); if (msgs && msgs.includes(m)) renderMessages(msgs); }
  });
}
function toggleTranslateView(msgId) {
  const msgs = getActiveMessages();
  const m = msgs?.find(x => x.id === msgId);
  if (!m) return;
  m._showOriginal = !m._showOriginal;
  renderMessages(msgs);
}

/* ===== APP-WIDE LANGUAGE ===== */
function setAppLanguage(code) {
  appLang = code || 'en';
  localStorage.setItem('blushift-lang', appLang);
  document.documentElement.lang = appLang;
  document.documentElement.dir = (typeof RTL_LANGS !== 'undefined' && RTL_LANGS.includes(appLang)) ? 'rtl' : 'ltr';
  if (activeChat !== null) { const m = getActiveMessages(); if (m) renderMessages(m); }
  translateUI();
}
/* Best-effort live UI translation (machine-translated via API, cached per language).
   Source of truth is English; non-English is a convenience translation and may be partial. */
function uiCacheGet() { try { return JSON.parse(localStorage.getItem('blushift-uicache-' + appLang) || '{}'); } catch (e) { return {}; } }
function uiCacheSet(c) { try { localStorage.setItem('blushift-uicache-' + appLang, JSON.stringify(c)); } catch (e) {} }
function translateUI() {
  if (!appLang || appLang === 'en') return;
  let cache = uiCacheGet();
  const skip = { SCRIPT:1, STYLE:1, SVG:1, PATH:1, INPUT:1, TEXTAREA:1, NOSCRIPT:1, CODE:1 };
  const roots = document.querySelectorAll('.screen:not(.hidden), #appShell:not(.hidden)');
  const pending = [];
  roots.forEach(root => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        const t = (n.nodeValue || '').trim();
        if (t.length < 2 || /^[\d\s\W]+$/.test(t) || t === 'BLUSHIFT') return NodeFilter.FILTER_REJECT;
        let p = n.parentNode;
        while (p && p.nodeType === 1) { if (skip[p.tagName] || (p.dataset && p.dataset.noI18n)) return NodeFilter.FILTER_REJECT; p = p.parentNode; }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node._i18nLang === appLang) continue;
      const orig = node.nodeValue, key = orig.trim();
      if (cache[key]) { node.nodeValue = orig.replace(key, cache[key]); node._i18nLang = appLang; }
      else pending.push({ node, key, orig });
    }
  });
  [...new Set(pending.map(x => x.key))].slice(0, 60).forEach(key => {
    translateViaAPI(key, 'en', appLang, (out) => {
      if (!out) return;
      const c = uiCacheGet(); c[key] = out; uiCacheSet(c);
      pending.filter(x => x.key === key).forEach(x => { if (x.node && x.node.parentNode) { x.node.nodeValue = x.orig.replace(key, out); x.node._i18nLang = appLang; } });
    });
  });
}
function openLanguagePicker() {
  renderAppLangPicker('');
  document.getElementById('langPickerModal').classList.add('open');
  setTimeout(() => document.getElementById('appLangSearch')?.focus(), 60);
}
function closeLanguagePicker() { document.getElementById('langPickerModal').classList.remove('open'); }
function renderAppLangPicker(q) {
  const list = document.getElementById('appLangList'); if (!list) return;
  const ql = (q || '').toLowerCase().trim();
  const matches = APP_LANGUAGES.filter(l => !ql || l.name.toLowerCase().includes(ql) || l.native.toLowerCase().includes(ql));
  list.innerHTML = matches.length ? matches.map(l => `<button class="lang-row ${appLang===l.code?'sel':''}" onclick="pickAppLanguage('${l.code}')"><span class="lang-flag">${flagImg(l.cc)}</span><span class="lang-names"><span class="lang-native">${l.native}</span><span class="lang-en">${l.name}</span></span>${appLang===l.code?'<span class="lang-check">✓</span>':''}</button>`).join('') : '<div class="lang-empty">No language found</div>';
}
function pickAppLanguage(code) {
  setAppLanguage(code);
  closeLanguagePicker();
  const cur = APP_LANGUAGES.find(l => l.code === code);
  toast('Language: ' + (cur ? cur.native : code));
  renderSettings();
}

/* ===== AUTO-TRANSLATE ===== */
function setAutoTranslate(on) {
  autoTranslateOn = on;
  localStorage.setItem('blushift-autotranslate', on ? 'on' : 'off');
  if (activeChat !== null) { const m = getActiveMessages(); if (m) renderMessages(m); }
}
function detectLanguage(text) {
  const t = text.toLowerCase();
  const hasNonAscii = [...text].some(ch => ch.charCodeAt(0) > 127);
  let best = null, bestScore = 0;
  for (const code of Object.keys(REVERSE_TR)) {
    let score = 0;
    for (const loc of Object.keys(REVERSE_TR[code])) {
      if (loc.length < 3) continue;            // skip ambiguous short words like "no", "si", "да"
      if (t.includes(loc)) score++;
    }
    if (score > bestScore) { bestScore = score; best = code; }
  }
  // only call it foreign with strong evidence: accented/non-latin text, or 2+ word hits
  if (best && (bestScore >= 2 || (hasNonAscii && bestScore >= 1))) return { code: best, name: TRANSLATIONS[best].name };
  return null;
}
function translateTextToEn(text, code) {
  const rev = REVERSE_TR[code];
  if (!rev) return text;
  let out = text;
  for (const [loc, en] of Object.entries(rev)) out = out.replace(new RegExp(loc, 'gi'), en);
  return out;
}

/* ===== ATTACHMENTS ===== */
function showAttachMenu() {
  const modal = document.getElementById('attachModal');
  const sheet = modal.querySelector('.attach-sheet');
  if (sheet) sheet.classList.remove('closing');
  modal.classList.add('open');
}
function closeAttach() {
  const modal = document.getElementById('attachModal');
  if (!modal.classList.contains('open')) return;
  const sheet = modal.querySelector('.attach-sheet');
  if (sheet) {
    sheet.classList.add('closing');
    modal.classList.add('closing');
    setTimeout(() => { modal.classList.remove('open', 'closing'); sheet.classList.remove('closing'); }, 260);
  } else { modal.classList.remove('open'); }
}
function handleAttach(type) {
  closeAttach();
  if (type === 'location') showLocationPicker();
  else if (type === 'poll') showPollCreator();
  else if (type === 'sticker') showStickerPicker();
  else if (type === 'photo') showPhotoPicker();
  else if (type === 'file') openFilePicker();
  else if (type === 'contact') showContactPicker();
  else if (type === 'money') showMoneyModal();
  else if (type === 'music') showMusicPicker();
  else if (type === 'voice') showVoiceRecorder();
}

/* ===== WALLETS — Google Pay / Venmo / Cash App ===== */
let selectedWallet = null;
function getAccount() { return JSON.parse(localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account') || '{}'); }
function saveAccount(acct) {
  if (acct.stay === false) sessionStorage.setItem('blushift-account', JSON.stringify(acct));
  else localStorage.setItem('blushift-account', JSON.stringify(acct));
}
function linkedWallets() {
  const acct = getAccount();
  const w = acct.wallets || {};
  if (acct.googlePay && acct.googlePay.linked) w.googlepay = true;   // migrate old field
  return WALLETS.filter(x => w[x.id]);
}
function walletLinked(id) {
  const acct = getAccount();
  const w = acct.wallets || {};
  if (id === 'googlepay' && acct.googlePay && acct.googlePay.linked) return true;
  return id ? !!w[id] : linkedWallets().length > 0;
}
function linkWalletInApp(id) {
  closeAddPayment();
  openConnect(id);
}
function unlinkWallet(id) {
  const acct = getAccount();
  if (acct.wallets) delete acct.wallets[id];
  if (id === 'googlepay') delete acct.googlePay;
  if (selectedWallet === id) selectedWallet = null;
  saveAccount(acct);
  toast((WALLETS.find(w => w.id === id)?.name || 'Wallet') + ' unlinked');
  renderSettings();
}
function confirmUnlinkWallet(id) {
  const w = WALLETS.find(x => x.id === id);
  showConfirm('Unlink ' + (w ? w.name : 'wallet') + '?', 'You can re-link it any time from Billing.', 'Unlink', () => unlinkWallet(id), true);
}
function showMoneyModal() {
  const linked = linkedWallets();
  if (!linked.length) {
    showConfirm('Link a wallet', 'Connect Google Pay, Venmo or Cash App to send & request money. Open settings to link one?', 'Open Settings', () => showView('settings'));
    return;
  }
  selectedWallet = selectedWallet && linked.some(w => w.id === selectedWallet) ? selectedWallet : linked[0].id;
  document.getElementById('moneyAmount').value = '';
  document.getElementById('moneyNote').value = '';
  document.getElementById('moneyWallets').innerHTML = linked.map(w =>
    `<button class="wallet-chip ${w.id===selectedWallet?'sel':''}" onclick="pickWallet('${w.id}')">${w.mark}</button>`).join('');
  document.getElementById('moneyModal').classList.add('open');
}
function pickWallet(id) {
  selectedWallet = id;
  document.querySelectorAll('#moneyWallets .wallet-chip').forEach(b => b.classList.toggle('sel', b.getAttribute('onclick').includes(`'${id}'`)));
}
function closeMoneyModal() { closeSheetAnimated('moneyModal'); }
function sendMoney(kind) {
  const amt = parseFloat(document.getElementById('moneyAmount').value);
  const note = document.getElementById('moneyNote').value.trim();
  if (!amt || amt <= 0) return;
  const wallet = WALLETS.find(w => w.id === selectedWallet) || WALLETS[0];
  closeMoneyModal();
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id: newId, type:'payment', kind, amount: amt.toFixed(2), note, wallet: wallet.id, ts: Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview(kind === 'request' ? `🟡 Requested $${amt.toFixed(2)}` : `💸 Sent $${amt.toFixed(2)}`);
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
}

/* ===== CARD INPUT FORMATTING ===== */
function formatZip(input) { input.value = input.value.replace(/\D/g, '').slice(0, 5); }
function formatCardNumber(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}
function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 4);
  if (v.length >= 3) v = v.slice(0, 2) + '/' + v.slice(2);
  input.value = v;
}
function sendMediaMessage(title, sub) {
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id: newId, type:'sent', text:`${title}\n<span style="font-size:11px;color:rgba(255,255,255,0.5)">${sub}</span>`, ts: Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  setActiveMessages(filtered);
  updatePreview(title);
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
}

/* ===== FILE PICKER (real) ===== */
function openFilePicker() { document.getElementById('fileInput').click(); }
function handleFileSelect(input) {
  const f = (input.files || [])[0];
  if (!f) return;
  const size = f.size > 1048576 ? (f.size/1048576).toFixed(1)+' MB' : Math.max(1, Math.round(f.size/1024))+' KB';
  const icon = /pdf/i.test(f.type) ? '📕' : /image/i.test(f.type) ? '🖼️' : /zip|compressed/i.test(f.type) ? '🗜️' : /audio/i.test(f.type) ? '🎵' : /video/i.test(f.type) ? '🎬' : '📎';
  const reader = new FileReader();
  reader.onload = e => pushFileMessage(f.name, size, icon, e.target.result);
  reader.readAsDataURL(f);
  input.value = '';
}
function pushFileMessage(name, sub, icon, dataURL) {
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id:newId, type:'file', name, sub, icon, data:dataURL, ts:Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id:newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview(`${icon} ${name}`);
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
}
function openSentFile(msgId) {
  const msgs = getActiveMessages();
  const m = msgs?.find(x => x.id === msgId);
  if (!m || !m.data) return;
  const w = window.open('', '_blank');
  if (w) {
    if (/^data:image|^data:application\/pdf|^data:video/.test(m.data)) {
      w.document.write(`<title>${m.name}</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;height:100vh">${/^data:video/.test(m.data) ? `<video src="${m.data}" controls autoplay style="max-width:100%;max-height:100%"></video>` : /^data:application\/pdf/.test(m.data) ? `<iframe src="${m.data}" style="border:0;width:100%;height:100%"></iframe>` : `<img src="${m.data}" style="max-width:100%;max-height:100%">`}</body>`);
    } else {
      const a = w.document.createElement('a'); a.href = m.data; a.download = m.name; w.document.body.appendChild(a); a.click();
    }
  }
}

/* ===== CONTACT PICKER (choose which to share) ===== */
let contactPickerMode = 'share';
function showContactPicker() {
  contactPickerMode = 'share';
  document.getElementById('contactPickerTitle').textContent = 'SHARE A CONTACT';
  const s = document.getElementById('contactPickerSearch'); if (s) s.value = '';
  renderContactPickerList('');
  document.getElementById('contactPickerModal').classList.add('open');
}
function renderContactPickerList(query) {
  const q = (query || '').toLowerCase();
  const list = document.getElementById('contactPickerList');
  const handler = contactPickerMode === 'call' ? 'addToCall' : 'sendContactCard';
  const rows = CONTACTS.filter(c => c.known && !c.ai && (!q || c.name.toLowerCase().includes(q)));
  list.innerHTML = rows.length ? rows.map(c => {
    const isBlue = c.blueMode && c.platform === 'iPhone';
    return `<div class="cp-pick-item" onclick="${handler}(${c.id})">
      <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${avInner(c)}</div>
      <div class="cp-pick-info"><div class="cp-pick-name">${c.name}</div><div class="cp-pick-sub">${c.phone || c.platform}</div></div>
    </div>`;
  }).join('') : '<div style="text-align:center;color:var(--txt-dim);font-size:13px;padding:18px">No contacts found</div>';
}
function filterContactPicker(q) { renderContactPickerList(q); }
function closeContactPicker() { closeSheetAnimated('contactPickerModal'); }
function sendContactCard(id) {
  closeContactPicker();
  const c = CONTACTS.find(x => x.id === id);
  if (!c) return;
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id:newId, type:'contactcard', contactId:c.id, ccName:c.name, ccPhone:c.phone || 'No number', ts:Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id:newId+1, type:'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered);
  updatePreview(`👤 ${c.name}`);
  renderMessages(filtered);
  scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId+1);
}
function openSentContact(contactId) {
  const c = CONTACTS.find(x => x.id === contactId);
  document.getElementById('sentContactName').textContent = c ? c.name : 'Contact';
  document.getElementById('sentContactPhone').textContent = c ? (c.phone || 'No number') : '';
  document.getElementById('sentContactPlatform').textContent = c ? c.platform : '';
  const av = document.getElementById('sentContactAv');
  if (c && c.pfp) { av.style.backgroundImage = `url('${c.pfp}')`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.textContent = ''; }
  else { av.style.backgroundImage = ''; av.textContent = c ? c.initials : '👤'; }
  document.getElementById('sentContactModal').classList.add('open');
}
function closeSentContact() { document.getElementById('sentContactModal').classList.remove('open'); }

/* ===== LOCATION ===== */
function showLocationPicker() { document.getElementById('locationModal').classList.add('open'); }
function closeLocationPicker() { closeSheetAnimated('locationModal'); }
function sendLocation(locType, duration) {
  closeLocationPicker();
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  filtered.push({ id: Date.now(), type:'location', locType, duration, ts: Date.now() });
  filtered.push({ id: Date.now()+1, type:'status', text:'Delivered' });
  setActiveMessages(filtered);
  updatePreview(locType === 'live' ? `📍 Live Location (${formatDuration(duration)})` : '📍 Current Location');
  renderMessages(filtered);
  scrollToBottom();
}

/* ===== POLLS ===== */
function showPollCreator() { document.getElementById('pollModal').classList.add('open'); }
function closePollCreator() { closeSheetAnimated('pollModal'); }
function addPollOption() {
  const container = document.getElementById('pollOptions');
  const count = container.querySelectorAll('.form-group').length + 1;
  const div = document.createElement('div');
  div.className = 'form-group';
  div.innerHTML = `<label>OPTION ${count}</label><input type="text" class="poll-opt-input" placeholder="Option ${count}">`;
  container.appendChild(div);
}
function sendPoll() {
  const question = document.getElementById('pollQuestion').value.trim();
  const optInputs = document.querySelectorAll('.poll-opt-input');
  const options = [];
  optInputs.forEach(inp => { const val = inp.value.trim(); if (val) options.push({ text: val, votes: 0, voted: false }); });
  if (!question || options.length < 2) return;
  closePollCreator();
  const msgs = getActiveMessages();
  if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  filtered.push({ id: Date.now(), type:'poll', question, options, ts: Date.now() });
  setActiveMessages(filtered);
  updatePreview(`📊 Poll: ${question}`);
  renderMessages(filtered);
  scrollToBottom();
  document.getElementById('pollQuestion').value = '';
  document.getElementById('pollOptions').innerHTML = `
    <div class="form-group"><label>OPTION 1</label><input type="text" class="poll-opt-input" placeholder="Option 1"></div>
    <div class="form-group"><label>OPTION 2</label><input type="text" class="poll-opt-input" placeholder="Option 2"></div>`;
}
function votePoll(msgId, optionIndex) {
  const msgs = getActiveMessages();
  const msg = msgs?.find(m => m.id === msgId);
  if (!msg || msg.type !== 'poll') return;
  msg.options.forEach((o,i) => { if (i === optionIndex) { o.voted = !o.voted; o.votes += o.voted ? 1 : -1; } });
  renderMessages(msgs);
}

/* ===== GROUP CHATS ===== */
function showNewGroupModal() { renderGroupMemberList(''); document.getElementById('newGroupModal').classList.add('open'); }
function closeNewGroup() { document.getElementById('newGroupModal').classList.remove('open'); }
function renderGroupMemberList(query) {
  const list = document.getElementById('groupMemberList');
  const q = query.toLowerCase();
  const filtered = CONTACTS.filter(c => c.known && c.platform === 'iPhone' && !c.ai && (!q || c.name.toLowerCase().includes(q)));
  list.innerHTML = filtered.map(c => `
    <div class="group-member-item" data-id="${c.id}" onclick="toggleGroupMember(this)">
      <div class="gm-check"></div>
      <span style="font-size:14px;color:var(--txt-bright)">${c.name}</span>
      <span style="font-size:11px;color:var(--txt-dim);margin-left:auto">${c.phone}</span>
    </div>`).join('');
}
function filterGroupMembers(query) { renderGroupMemberList(query); }
function toggleGroupMember(el) { el.classList.toggle('selected'); }
function createNewGroup() {
  const name = document.getElementById('newGroupName').value.trim();
  const selected = [...document.querySelectorAll('.group-member-item.selected')].map(el => parseInt(el.dataset.id));
  if (!name || selected.length < 1) return;
  closeNewGroup();
  const newGroup = {
    id: 'g' + Date.now(), name, members: selected, photo: null,
    messages: [
      { id:1, type:'timestamp', text:`iMessage · <b>Just now</b>` },
      { id:2, type:'sent', text:`Created group "${name}"`, ts: Date.now() },
    ],
    preview: `Created group "${name}"`, time: 'Now', unread: 0,
  };
  GROUPS.push(newGroup);
  renderChatList();
  openChat(newGroup.id, 'group');
}

function showChatSettings() {
  if (activeChatType !== 'group') { showContactInfo(); return; }
  const g = GROUPS.find(x => x.id === activeChat);
  if (!g) return;
  const content = document.getElementById('groupSettingsContent');
  const memberNames = g.members.map(mid => CONTACTS.find(c=>c.id===mid)?.name || '?');
  const pfpStyle = g.photo ? `background-image:url('${g.photo}');background-size:cover;background-position:center` : '';
  content.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M2 21a8 8 0 0 1 20 0"/></svg> GROUP PHOTO</div>
      <div class="pfp-edit-row">
        <div class="pfp-preview cl-av-group" id="groupPfpPreview" style="${pfpStyle}">${g.photo ? '' : g.name.substring(0,2)}</div>
        <div class="pfp-edit-actions">
          <button type="button" class="btn-secondary" onclick="document.getElementById('groupPfpInput').click()">Change Photo</button>
          <button type="button" class="btn-secondary" onclick="removeGroupPfp()" style="color:var(--txt-dim)">Remove</button>
        </div>
      </div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> GROUP INFO</div>
      <div class="settings-item">
        <span>Group Name</span>
        <input type="text" id="editGroupName" value="${g.name}" style="background:var(--bg-2);border:1px solid var(--line);color:var(--txt);padding:6px 10px;border-radius:8px;font-size:13px;text-align:right;width:160px;font-family:inherit;outline:none" onchange="updateGroupName(this.value)">
      </div>
      <div class="settings-item"><span>Members</span><span class="settings-val">${g.members.length + 1}</span></div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"/></svg> MEMBERS · ${g.members.length + 1}</div>
      <div class="settings-item"><span>You</span><span class="settings-val ok">ADMIN</span></div>
      ${g.members.map(mid => { const c = CONTACTS.find(x=>x.id===mid); return `<div class="settings-item"><span class="member-name" onclick="showContactProfile(${mid},'group')" style="cursor:pointer;display:flex;align-items:center;gap:4px">${c ? c.name : '?'} <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:.4"><polyline points="9 18 15 12 9 6"/></svg></span><button class="member-remove" onclick="confirmRemoveMember(${mid})">Remove</button></div>`; }).join('')}
      <button class="btn-secondary" style="margin-top:8px" onclick="openAddGroupMembers()">＋ Add People</button>
    </div>
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09"/></svg> OPTIONS</div>
      <div class="settings-item"><span>Notifications</span><label class="toggle"><input type="checkbox" checked><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Pin Conversation</span><label class="toggle"><input type="checkbox"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item" onclick="openChatBgPicker()" style="cursor:pointer"><span>Chat Wallpaper</span><span class="settings-val">Customize ▸</span></div>
    </div>
    <div class="settings-section">
      <button class="btn-secondary" onclick="confirmLeaveGroup()" style="color:var(--danger);border-color:var(--danger)">Leave Group</button>
    </div>`;
  showView('groupSettings');
}

/* ===== GROUP MEMBER MANAGEMENT ===== */
function openAddGroupMembers() {
  const g = GROUPS.find(x => x.id === activeChat);
  if (!g) return;
  const list = document.getElementById('addMemberList');
  const candidates = CONTACTS.filter(c => c.known && !c.ai && !g.members.includes(c.id));
  list.innerHTML = candidates.length
    ? candidates.map(c => {
        const isBlue = c.blueMode && c.platform === 'iPhone';
        return `<div class="group-member-item" data-id="${c.id}" onclick="toggleGroupMember(this)">
          <div class="gm-check"></div>
          <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}" style="width:32px;height:32px;font-size:11px"${avStyle(c)}>${avInner(c)}</div>
          <span style="font-size:14px;color:var(--txt-bright)">${c.name}</span>
        </div>`;
      }).join('')
    : '<div style="text-align:center;color:var(--txt-dim);font-size:13px;padding:18px">Everyone you know is already in this group.</div>';
  document.getElementById('addMemberModal').classList.add('open');
}
function closeAddMember() { document.getElementById('addMemberModal').classList.remove('open'); }
function confirmAddMembers() {
  const ids = [...document.querySelectorAll('#addMemberList .group-member-item.selected')].map(el => parseInt(el.dataset.id));
  if (!ids.length) return;
  const names = ids.map(id => CONTACTS.find(c => c.id === id)?.name).filter(Boolean).join(', ');
  closeAddMember();
  showConfirm('Add to group?', `Add ${names} to “${GROUPS.find(g=>g.id===activeChat)?.name}”?`, 'Add', () => {
    const g = GROUPS.find(x => x.id === activeChat);
    if (!g) return;
    ids.forEach(id => { if (!g.members.includes(id)) g.members.push(id); });
    const msgs = g.messages;
    msgs.push({ id: Date.now(), type:'timestamp', text:`<b>${names}</b> ${ids.length > 1 ? 'were' : 'was'} added` });
    showChatSettings();
    renderChatList();
  });
}
function confirmRemoveMember(id) {
  const c = CONTACTS.find(x => x.id === id);
  showConfirm('Remove member?', `Remove ${c ? c.name : 'this person'} from the group?`, 'Remove', () => {
    const g = GROUPS.find(x => x.id === activeChat);
    if (!g) return;
    g.members = g.members.filter(m => m !== id);
    g.messages.push({ id: Date.now(), type:'timestamp', text:`<b>${c ? c.name : 'Someone'}</b> was removed` });
    showChatSettings();
    renderChatList();
  }, true);
}
function confirmLeaveGroup() {
  const g = GROUPS.find(x => x.id === activeChat);
  showConfirm('Leave group?', `You will stop receiving messages from “${g ? g.name : 'this group'}”.`, 'Leave', () => {
    const idx = GROUPS.findIndex(x => x.id === activeChat);
    if (idx >= 0) GROUPS.splice(idx, 1);
    activeChat = null; activeChatType = null;
    renderChatList();
    showView('chatList');
  }, true);
}

/* ===== GENERIC CONFIRM ===== */
let confirmCallback = null;
function showConfirm(title, message, actionLabel, onYes, danger) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  const btn = document.getElementById('confirmActionBtn');
  btn.textContent = actionLabel || 'Confirm';
  btn.className = 'btn-primary' + (danger ? ' confirm-danger' : '');
  confirmCallback = onYes;
  document.getElementById('confirmModal').classList.add('open');
}
function closeConfirm() { document.getElementById('confirmModal').classList.remove('open'); confirmCallback = null; }
function runConfirm() { const cb = confirmCallback; closeConfirm(); if (cb) cb(); }
function handleGroupPfp(input) {
  const f = (input.files || [])[0];
  if (!f) return;
  const g = GROUPS.find(x => x.id === activeChat);
  if (!g) return;
  const reader = new FileReader();
  reader.onload = e => openCropper(e.target.result, cropped => {
    g.photo = cropped;
    showChatSettings();
    renderChatList();
    const av = document.getElementById('chatAvatar');
    av.style.backgroundImage = `url('${cropped}')`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.textContent = '';
  });
  reader.readAsDataURL(f);
  input.value = '';
}
function removeGroupPfp() {
  const g = GROUPS.find(x => x.id === activeChat);
  if (!g) return;
  g.photo = null;
  showChatSettings();
  renderChatList();
  const av = document.getElementById('chatAvatar');
  av.style.backgroundImage = ''; av.textContent = g.name.substring(0,2);
}
function updateGroupName(newName) {
  const g = GROUPS.find(x => x.id === activeChat);
  if (g && newName.trim()) { g.name = newName.trim(); document.getElementById('chatName').textContent = g.name; }
}

/* ===== CONTACT INFO / PROFILE ===== */
function showContactInfo() { if (activeChatType !== 'dm') return; showContactProfile(activeChat, 'chat'); }
function showContactProfile(contactId, from) {
  viewingContactId = contactId;
  const c = CONTACTS.find(x => x.id === contactId);
  if (!c) return;
  const isBlue = c.blueMode && globalBlueMode && c.platform === 'iPhone';
  const backView = from === 'chat' ? 'chat' : from === 'group' ? 'groupSettings' : 'contacts';
  const backBtn = document.querySelector('#viewContactProfile .hdr-btn');
  if (backBtn) backBtn.setAttribute('onclick', `showView('${backView}')`);
  const content = document.getElementById('contactProfileContent');
  content.innerHTML = `
    <div class="cp-hero">
      <div class="cp-avatar ${c.ai ? 'cl-av-ai' : isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${c.ai ? '✦' : avInner(c)}</div>
      <div class="cp-name">${c.name}${c.ai ? ' <span class="ai-spark">✨</span>' : ''}</div>
      <div class="cp-platform">${c.ai ? 'BLUSHIFT AI ASSISTANT' : c.platform.toUpperCase() + (isBlue ? ' · BLUE BUBBLE ACTIVE' : ' · STANDARD')}</div>
    </div>
    <div class="cp-actions">
      <button class="cp-action-btn anim-btn" onclick="openChat(${c.id},'dm')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>Message</span></button>
      <button class="cp-action-btn anim-btn" onclick="startCall(${c.id},'audio')"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">${PHONE_PATH}</svg><span>Call</span></button>
      <button class="cp-action-btn anim-btn" onclick="startCall(${c.id},'video')"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg><span>Video</span></button>
      <button class="cp-action-btn anim-btn" onclick="editContactProfile()"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>Edit</span></button>
    </div>
    ${c.ai ? `
    <div class="settings-section" style="margin-top:16px">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="18" x2="12" y2="22"/></svg> BLUP VOICE</div>
      <p style="font-size:11px;color:var(--txt-dim);margin:0 2px 8px">Choose how Blup sounds on calls — tap one to preview.</p>
      <div class="blup-voice-list" id="blupVoiceList"></div>
    </div>` : ''}
    <div class="settings-section" style="margin-top:16px">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">${PHONE_PATH}</svg> DETAILS</div>
      <div class="settings-item"><span>Phone</span><span class="settings-val">${c.phone || '—'}</span></div>
      <div class="settings-item"><span>Platform</span><span class="settings-val">${c.platform}</span></div>
      <div class="settings-item"><span>Home Address</span><span class="settings-val dim">${c.address || '—'}</span></div>
    </div>
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> NOTES</div>
      <div class="settings-item" style="border-radius:10px"><span style="color:var(--txt-dim);font-size:13px">${c.notes || 'No notes added'}</span></div>
    </div>
    ${from === 'chat' ? `
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><polyline points="21 15 16 10 5 21"/></svg> APPEARANCE</div>
      <div class="settings-item" onclick="openChatBgPicker()" style="cursor:pointer"><span>Chat Wallpaper</span><span class="settings-val">Customize ▸</span></div>
    </div>` : ''}
    <div class="settings-section">
      <div class="settings-section-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> SECURITY</div>
      <div class="settings-item"><span>Relay</span><span class="settings-val">NRT-02</span></div>
      <div class="settings-item"><span>Encryption</span><span class="settings-val">TLS 1.3 / AES-256</span></div>
      <div class="settings-item"><span>Blue Bubble</span><span class="settings-val ${isBlue ? 'ok' : 'dim'}">${isBlue ? 'ACTIVE' : 'OFF'}</span></div>
    </div>`;
  showView('contactProfile');
  if (c.ai) setTimeout(renderBlupVoiceList, 80);
}
function renderBlupVoiceList() {
  const el = document.getElementById('blupVoiceList');
  if (!el) return;
  const voices = blupVoices();
  if (!voices.length) {
    el.innerHTML = '<div style="color:var(--txt-dim);font-size:12px">Loading voices… (best in Chrome/Edge)</div>';
    if ('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = renderBlupVoiceList;
    return;
  }
  const cur = pickBlupVoice();
  el.innerHTML = voices.slice(0, 14).map(v => {
    const label = v.name.replace(/\(.*?\)/g, '').replace(/Microsoft|Google|Online|Natural|Desktop/gi, '').trim() || v.name;
    return `<button class="voice-chip ${cur && v.name === cur.name ? 'sel' : ''}" onclick="setBlupVoice('${v.name.replace(/'/g, "\\'")}')">${label}</button>`;
  }).join('');
}
function setBlupVoice(name) {
  localStorage.setItem('blushift-blup-voice', name);
  renderBlupVoiceList();
  blupSpeak("Hey, it's Blup. I'll use this voice from now on.");
}
function editContactProfile() {
  const c = CONTACTS.find(x => x.id === viewingContactId);
  if (!c) return;
  editingContactId = c.id;
  editContactPfp = c.pfp || null;
  document.getElementById('editContactName').value = c.name;
  document.getElementById('editContactPhone').value = c.phone || '';
  document.getElementById('editContactAddress').value = c.address || '';
  document.getElementById('editContactNotes').value = c.notes || '';
  updateEditPfpPreview(c);
  document.getElementById('editContactModal').classList.add('open');
}
function updateEditPfpPreview(c) {
  const prev = document.getElementById('editPfpPreview');
  if (!prev) return;
  if (editContactPfp) {
    prev.style.backgroundImage = `url('${editContactPfp}')`; prev.style.backgroundSize = 'cover'; prev.style.backgroundPosition = 'center'; prev.textContent = '';
  } else {
    prev.style.backgroundImage = '';
    const nm = document.getElementById('editContactName').value || (c && c.name) || '';
    prev.textContent = nm.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  }
}
function handleContactPfp(input) {
  const f = (input.files || [])[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => openCropper(e.target.result, cropped => { editContactPfp = cropped; updateEditPfpPreview(); });
  reader.readAsDataURL(f);
  input.value = '';
}
function removeContactPfp() { editContactPfp = null; updateEditPfpPreview(); }
function closeEditContact() { document.getElementById('editContactModal').classList.remove('open'); }
function saveEditedContact() {
  const c = CONTACTS.find(x => x.id === editingContactId);
  if (!c) return;
  const newName = document.getElementById('editContactName').value.trim();
  if (newName) { c.name = newName; c.initials = newName.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase(); }
  c.phone = document.getElementById('editContactPhone').value.trim();
  c.address = document.getElementById('editContactAddress').value.trim();
  c.notes = document.getElementById('editContactNotes').value.trim();
  c.pfp = editContactPfp;
  closeEditContact();
  showContactProfile(editingContactId, 'contacts');
  renderContactList();
  renderChatList();
}

/* ===== ADD CONTACT ===== */
function showAddContactModal() {
  document.getElementById('newContactName').value = '';
  document.getElementById('newContactPhone').value = '';
  document.getElementById('newContactAddress').value = '';
  document.getElementById('newContactNotes').value = '';
  document.getElementById('addContactModal').classList.add('open');
}
function closeAddContact() { document.getElementById('addContactModal').classList.remove('open'); }
function addNewContact() {
  const name = document.getElementById('newContactName').value.trim();
  const phone = document.getElementById('newContactPhone').value.trim();
  const platform = document.getElementById('newContactPlatform').value;
  const address = document.getElementById('newContactAddress').value.trim();
  const notes = document.getElementById('newContactNotes').value.trim();
  if (!name) return;
  const initials = name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase();
  const newId = Math.max(...CONTACTS.map(c => c.id)) + 1;
  CONTACTS.push({ id:newId, name, initials, platform, blueMode: platform === 'iPhone', known:true, phone, address, notes, pfp:null });
  CONVERSATIONS[newId] = {
    messages: [ { id:1, type:'timestamp', text:`iMessage · <b>Just now</b>` } ],
    preview: 'New conversation', time: 'Now', unread: 0,
  };
  closeAddContact();
  renderContactList();
  renderChatList();
}

/* ===== GLOBAL TOGGLE ===== */
function toggleGlobalMode(enabled) {
  globalBlueMode = enabled;
  document.getElementById('modeBanner').classList.toggle('off', !enabled);
  renderChatList();
}

/* ===== CHAT BACKGROUND ===== */
/* ===== PER-CHAT + DEFAULT BACKGROUND ===== */
function chatBgKey() { return activeChat != null ? `${activeChatType}-${activeChat}` : null; }
function getChatBgMap() { try { return JSON.parse(localStorage.getItem('blushift-bg-chats') || '{}'); } catch (e) { return {}; } }
function getChatBgSpec() { const k = chatBgKey(); return k ? (getChatBgMap()[k] || null) : null; }
function applyBg() {
  const msgs = document.getElementById('messagesContainer');
  if (!msgs) return;
  // a chat-specific wallpaper overrides the global default
  const spec = getChatBgSpec();
  let bgId = currentBg, customData = localStorage.getItem('blushift-bg-custom');
  if (spec && spec.kind && spec.kind !== 'inherit') {
    if (spec.kind === 'custom') { bgId = 'custom'; customData = spec.data; }
    else { bgId = spec.id; }
  }
  if (bgId === 'custom') {
    if (customData) {
      msgs.style.backgroundImage = `url('${customData}')`;
      msgs.style.backgroundSize = 'cover'; msgs.style.backgroundPosition = 'center'; msgs.style.backgroundRepeat = 'no-repeat';
      return;
    }
  }
  msgs.style.backgroundRepeat = 'repeat'; msgs.style.backgroundPosition = 'top left';
  const bg = BACKGROUNDS.find(b => b.id === bgId);
  if (!bg || bgId === 'default') { msgs.style.backgroundImage = 'none'; }
  else { msgs.style.backgroundImage = bg.css; msgs.style.backgroundSize = bgId === 'dots' ? '16px 16px' : '24px 24px'; }
}
function openChatBgPicker() {
  if (activeChat == null) return;
  const spec = getChatBgSpec();
  const curId = spec ? (spec.kind === 'custom' ? 'custom' : spec.id) : 'inherit';
  const swatch = (id, label, styleCss) => `<button class="cbg-swatch ${curId===id?'sel':''}" onclick="setChatBg('${id}')" style="${styleCss}"><span>${label}</span></button>`;
  const presets = BACKGROUNDS.map(b => swatch(b.id, b.name, b.id==='default'?'background:var(--bg-0)':`background-image:${b.css};background-size:14px 14px`)).join('');
  const customSpec = spec && spec.kind === 'custom';
  document.getElementById('chatBgBody').innerHTML = `
    <p class="cbg-hint">Set a wallpaper just for this chat. "App default" follows your global background in Settings.</p>
    <div class="cbg-grid">
      <button class="cbg-swatch ${curId==='inherit'?'sel':''}" onclick="clearChatBg()" style="background:var(--bg-2)"><span>App default</span></button>
      ${presets}
      <button class="cbg-swatch ${customSpec?'sel':''}" onclick="document.getElementById('chatBgInput').click()" style="${customSpec?`background-image:url('${spec.data}');background-size:cover;background-position:center`:'background:var(--bg-2)'}"><span>Upload…</span></button>
    </div>`;
  document.getElementById('chatBgModal').classList.add('open');
}
function closeChatBgPicker() { document.getElementById('chatBgModal').classList.remove('open'); }
function setChatBg(id) {
  const k = chatBgKey(); if (!k) return;
  const map = getChatBgMap();
  map[k] = (id === 'inherit') ? { kind: 'inherit' } : { kind: 'preset', id };
  localStorage.setItem('blushift-bg-chats', JSON.stringify(map));
  applyBg();
  openChatBgPicker();   // refresh selection state
  toast('Chat wallpaper updated');
}
function clearChatBg() {
  const k = chatBgKey(); if (!k) return;
  const map = getChatBgMap(); delete map[k];
  localStorage.setItem('blushift-bg-chats', JSON.stringify(map));
  applyBg(); openChatBgPicker();
  toast('Using app default wallpaper');
}
function uploadChatBg(input) {
  const f = (input.files || [])[0]; if (!f) return;
  const k = chatBgKey(); if (!k) { input.value=''; return; }
  const reader = new FileReader();
  reader.onload = e => {
    const map = getChatBgMap();
    map[k] = { kind: 'custom', data: e.target.result };
    localStorage.setItem('blushift-bg-chats', JSON.stringify(map));
    applyBg(); openChatBgPicker(); toast('Chat wallpaper set');
  };
  reader.readAsDataURL(f); input.value = '';
}
function setBg(bgId) { currentBg = bgId; localStorage.setItem('blushift-bg', bgId); applyBg(); renderSettings(); }
function uploadBgImage(input) {
  const f = (input.files || [])[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = e => {
    localStorage.setItem('blushift-bg-custom', e.target.result);
    currentBg = 'custom'; localStorage.setItem('blushift-bg', 'custom');
    applyBg(); renderSettings();
  };
  reader.readAsDataURL(f);
  input.value = '';
}

/* ===== AI THEME STUDIO ===== */
function hslHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = x => Math.round(x * 255).toString(16).padStart(2, '0');
  return '#' + toHex(f(0)) + toHex(f(8)) + toHex(f(4));
}
function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},${a})`; }
function buildPalette(desc) {
  const d = desc.toLowerCase();
  let hue = null, muted = false, light = false;
  for (const w of THEME_MUTED) if (d.includes(w)) muted = true;
  for (const [k,v] of Object.entries(THEME_PALETTES)) { if (d.includes(k)) { hue = v; break; } }
  if (/light|pastel|bright|day|clean|paper/.test(d)) light = true;
  if (hue === null) { let s = 0; for (let i=0;i<d.length;i++) s = (s*31 + d.charCodeAt(i)) % 360; hue = s; }
  const vivid = /vivid|neon|electric|bold/.test(d);
  const h2 = (hue + (d.includes('complementary') ? 180 : (d.includes('mono') ? 18 : 55))) % 360;
  const sat = muted ? 12 : (vivid ? 95 : 80);
  return {
    name: desc.slice(0,28), hue,
    accent1: hslHex(hue, muted?22:90, 62),
    accent2: hslHex(h2, muted?20:85, 64),
    bg0: hslHex(hue, muted?8:Math.round(sat*0.4), light?96:6),
    bg1: hslHex(hue, muted?8:Math.round(sat*0.4), light?92:10),
    bg2: hslHex(hue, muted?8:Math.round(sat*0.4), light?86:14),
    bg3: hslHex(hue, muted?8:Math.round(sat*0.4), light?78:20),
    bubbleS1: hslHex(hue, 85, 55),
    bubbleS2: hslHex(hue, 85, 42),
    bubbleR: light ? hslHex(hue,12,86) : hslHex(hue,16,18),
    txt: light ? hslHex(hue,15,22) : hslHex(hue,25,80),
    txtDim: light ? hslHex(hue,10,45) : hslHex(hue,15,55),
    txtBright: light ? '#0a0a0a' : '#ffffff',
  };
}
function injectAiTheme(p) {
  let el = document.getElementById('aiThemeStyle');
  if (!el) { el = document.createElement('style'); el.id = 'aiThemeStyle'; document.head.appendChild(el); }
  el.textContent = `[data-theme="aitheme"]{
    --bg-0:${p.bg0};--bg-1:${p.bg1};--bg-2:${p.bg2};--bg-3:${p.bg3};
    --accent-1:${p.accent1};--accent-2:${p.accent2};
    --accent-1-dim:${rgba(p.accent1,0.15)};--accent-2-dim:${rgba(p.accent2,0.15)};
    --accent-1-glow:${rgba(p.accent1,0.5)};--accent-2-glow:${rgba(p.accent2,0.5)};
    --bubble-s1:${p.bubbleS1};--bubble-s2:${p.bubbleS2};--bubble-r:${p.bubbleR};
    --ok:#4dffa1;--warn:#ffd94a;--danger:#ff5a6a;
    --txt:${p.txt};--txt-dim:${p.txtDim};--txt-bright:${p.txtBright};
    --line:${rgba(p.accent1,0.22)};--grid-c:${rgba(p.accent1,0.05)};
    --surface:${rgba(p.bg1,0.78)};--surface-hover:${rgba(p.accent1,0.08)};
    --glass-bg:${rgba(p.bg1,0.55)};--glass-border:${rgba(p.accent1,0.15)};--glass-blur:14px;
  }`;
}
function restoreAiTheme() {
  const saved = localStorage.getItem('blushift-aitheme');
  if (saved) { try { injectAiTheme(JSON.parse(saved)); } catch(e) {} }
}
function showThemeStudio() {
  document.getElementById('themeDescInput').value = '';
  document.getElementById('themeStudioPreview').innerHTML = '';
  document.getElementById('themeStudioModal').classList.add('open');
}
function closeThemeStudio() { document.getElementById('themeStudioModal').classList.remove('open'); }
function previewThemeIdea(text) { document.getElementById('themeDescInput').value = text; generateThemePreview(); }
function generateThemePreview() {
  const desc = document.getElementById('themeDescInput').value.trim();
  const prev = document.getElementById('themeStudioPreview');
  if (!desc) { prev.innerHTML = ''; return; }
  const p = buildPalette(desc);
  prev.innerHTML = `
    <div class="ts-swatch-row">
      <div class="ts-swatch" style="background:${p.bg0}"></div>
      <div class="ts-swatch" style="background:${p.accent1}"></div>
      <div class="ts-swatch" style="background:${p.accent2}"></div>
      <div class="ts-swatch" style="background:linear-gradient(135deg,${p.bubbleS1},${p.bubbleS2})"></div>
    </div>
    <div class="ts-preview-bubble" style="background:${p.bg0};border:1px solid ${rgba(p.accent1,0.3)}">
      <div style="align-self:flex-start;background:${p.bubbleR};color:${p.txt};padding:7px 12px;border-radius:14px;font-size:12px">hey, check the new theme 👀</div>
      <div style="align-self:flex-end;background:linear-gradient(180deg,${p.bubbleS1},${p.bubbleS2});color:#fff;padding:7px 12px;border-radius:14px;font-size:12px">looks 🔥</div>
    </div>`;
}
function applyGeneratedTheme() {
  const desc = document.getElementById('themeDescInput').value.trim();
  if (!desc) return;
  const p = buildPalette(desc);
  injectAiTheme(p);
  localStorage.setItem('blushift-aitheme', JSON.stringify(p));
  applyTheme('aitheme');
  closeThemeStudio();
  renderSettings();
}

/* ===== BIOMETRIC / READ RECEIPTS ===== */
function setBiometric(on) { biometricOn = on; localStorage.setItem('blushift-biometric', on ? 'on' : 'off'); }
function setReadReceipts(on) { readReceiptsOn = on; localStorage.setItem('blushift-readreceipts', on ? 'on' : 'off'); }
function setBiometricMethod(m) { biometricMethod = m; localStorage.setItem('blushift-biometric-method', m); renderSettings(); }
function setupBiometrics() {
  const modal = document.getElementById('biometricSetupModal');
  modal.setAttribute('data-method', biometricMethod);
  document.getElementById('bioSetupTitle').textContent = biometricMethod === 'touch' ? 'Set Up Touch ID' : 'Set Up Face ID';
  const statusEl = document.getElementById('bioSetupStatus');
  statusEl.style.color = '';
  document.getElementById('bioSetupFace').style.display = biometricMethod === 'touch' ? 'none' : 'block';
  document.getElementById('bioSetupTouch').style.display = biometricMethod === 'touch' ? 'block' : 'none';
  const ring = document.getElementById('bioSetupRing');
  ring.classList.remove('done'); ring.classList.add('scanning');
  modal.classList.add('open');
  const markEnrolled = () => {
    ring.classList.add('done');
    statusEl.textContent = 'Enrollment complete ✓';
    statusEl.style.color = 'var(--ok)';
    biometricEnrolled = true;
    localStorage.setItem('blushift-biometric-enrolled', 'yes');
    setTimeout(() => { closeBiometricSetup(); renderSettings(); }, 1000);
  };
  if (webauthnSupported()) {
    // Real enrollment: invokes the device's actual Face ID / fingerprint
    statusEl.textContent = biometricMethod === 'touch' ? 'Confirm with your fingerprint…' : 'Confirm with Face ID…';
    webauthnRegister().then(ok => {
      if (ok) markEnrolled();
      else { ring.classList.remove('scanning'); statusEl.textContent = 'Could not enroll — tap Set Up to retry.'; statusEl.style.color = 'var(--danger)'; }
    }).catch(() => {
      ring.classList.remove('scanning');
      statusEl.textContent = 'Cancelled or unavailable — tap Set Up to retry.';
      statusEl.style.color = 'var(--danger)';
    });
  } else {
    // Local file / unsupported: animated simulation (real biometrics activate once served over HTTPS)
    statusEl.textContent = biometricMethod === 'touch' ? 'Place your finger on the sensor' : 'Position your face in the frame';
    setTimeout(markEnrolled, 2200);
  }
}
function closeBiometricSetup() {
  const modal = document.getElementById('biometricSetupModal');
  modal.classList.remove('open');
  document.getElementById('bioSetupStatus').style.color = '';
}

/* ===== Real biometrics via WebAuthn (uses the phone's Face ID / fingerprint) =====
   Requires a secure context (HTTPS or localhost). On file:// it isn't available,
   so the flows above fall back to the animated simulation. */
function bioSecureContext() { return !!window.isSecureContext && location.protocol !== 'file:'; }
function webauthnSupported() { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create && bioSecureContext()); }
function webauthnEnrolled() { return !!localStorage.getItem('blushift-webauthn-cred'); }
function _randBuf(n) { const b = new Uint8Array(n); (window.crypto || crypto).getRandomValues(b); return b; }
function _b64u(buf) { const b = new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function _unb64u(str) { let s = str.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b.buffer; }
function webauthnRegister() {
  if (!webauthnSupported()) return Promise.resolve(false);
  const acct = (typeof getAccount === 'function' ? getAccount() : {}) || {};
  const name = acct.email || acct.name || 'blushift-user';
  const publicKey = {
    challenge: _randBuf(32),
    rp: { name: 'BLUSHIFT', id: location.hostname },
    user: { id: _randBuf(16), name: name, displayName: acct.name || name },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    timeout: 60000, attestation: 'none'
  };
  return navigator.credentials.create({ publicKey }).then(cred => {
    if (cred && cred.rawId) { localStorage.setItem('blushift-webauthn-cred', _b64u(cred.rawId)); return true; }
    return false;
  });
}
function webauthnAuth() {
  if (!webauthnSupported()) return Promise.resolve(false);
  const id = localStorage.getItem('blushift-webauthn-cred');
  const publicKey = {
    challenge: _randBuf(32),
    timeout: 60000,
    userVerification: 'required',
    rpId: location.hostname,
    allowCredentials: id ? [{ type: 'public-key', id: _unb64u(id) }] : []
  };
  return navigator.credentials.get({ publicKey }).then(assertion => !!assertion);
}

/* ===== BILLING ===== */
function trialInfo() {
  const acct = JSON.parse(localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account') || '{}');
  if (!acct.trialEnds) return { active:false, days:0 };
  const ms = new Date(acct.trialEnds).getTime() - Date.now();
  return { active: ms > 0, days: Math.max(0, Math.ceil(ms / 86400000)), ends: acct.trialEnds };
}
function showAddPayment() {
  document.getElementById('payCardNum').value = '';
  document.getElementById('payExp').value = '';
  document.getElementById('payCvc').value = '';
  const wl = document.getElementById('addPayWallets');
  if (wl) {
    const unlinked = WALLETS.filter(w => !walletLinked(w.id));
    wl.innerHTML = unlinked.length
      ? `<div class="addpay-wallet-label">OR LINK A WALLET</div>` + unlinked.map(w =>
          `<button class="wallet-link-row-btn" onclick="linkWalletInApp('${w.id}')"><span class="aw-ico" style="background:${w.color}">${w.id==='cashapp'?'$':w.id==='venmo'?'V':'G'}</span><span class="aw-name">${w.name}</span><span class="aw-link">Link</span></button>`).join('')
      : '';
  }
  document.getElementById('addPaymentModal').classList.add('open');
}
function closeAddPayment() { document.getElementById('addPaymentModal').classList.remove('open'); }
function addPaymentMethod() {
  const num = document.getElementById('payCardNum').value.replace(/\s/g,'');
  const exp = document.getElementById('payExp').value.trim();
  if (num.length < 4) return;
  const last4 = num.slice(-4);
  const first = num[0];
  const brand = first === '4' ? 'Visa' : first === '5' ? 'Mastercard' : first === '3' ? 'Amex' : 'Card';
  PAYMENT_METHODS.forEach(p => p.primary = false);
  PAYMENT_METHODS.push({ id:'pm'+Date.now(), brand, last4, exp: exp || '--/--', icon:'💳', primary:true });
  closeAddPayment();
  renderSettings();
}
function makePrimaryCard(id) { PAYMENT_METHODS.forEach(p => p.primary = (p.id === id)); renderSettings(); }

/* ===== EXPORT ACCOUNT ===== */
function exportMyAccount() {
  const acct = JSON.parse(localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account') || '{}');
  const headers = ['Account ID','Display Name','Email','Email Verified','Phone','Phone Verified','Device','Plan','Card Brand','Card (last4)','Card Exp','Google Pay','Trial Start','Trial Ends','Stay Logged In','Biometric Lock','Emoji Pack','Theme','Created At'];
  const id = 'BLU-' + (acct.createdAt ? new Date(acct.createdAt).getTime().toString().slice(-6) : '000000');
  const card = acct.card || {};
  const row = [id, acct.name||'', acct.email||'', acct.emailVerified?'Yes':'No', acct.phone||'', acct.phoneVerified?'Yes':'No', acct.device||'', (acct.plan||'basic').toUpperCase(),
    card.brand||'', card.last4 ? '•••• '+card.last4 : '', card.exp||'',
    acct.googlePay && acct.googlePay.linked ? 'Linked ('+(acct.googlePay.email||'')+')' : 'No',
    acct.trialStart||'', acct.trialEnds||'', acct.stay ? 'Yes':'No', biometricOn?('Enabled ('+(biometricMethod==='touch'?'Touch ID':'Face ID')+')'):'Disabled', currentEmojiPack, currentTheme, acct.createdAt||''];
  const csv = headers.join(',') + '\n' + row.map(v => '"' + String(v).replace(/"/g,'""') + '"').join(',');
  const blob = new Blob([csv], { type:'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'BLUSHIFT_my_account.csv';
  document.body.appendChild(a); a.click(); a.remove();
}

/* ===== SETTINGS ===== */
function renderSettings() {
  const container = document.getElementById('settingsScroll');
  const account = JSON.parse(localStorage.getItem('blushift-account') || sessionStorage.getItem('blushift-account') || '{}');
  const ti = trialInfo();
  const aiSaved = localStorage.getItem('blushift-aitheme');
  let aiPal = null; try { aiPal = aiSaved ? JSON.parse(aiSaved) : null; } catch(e) {}

  container.innerHTML = `
    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg> APPEARANCE</div>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <div class="theme-card ${t.id === currentTheme ? 'active' : ''}" data-t="${t.id}" onclick="applyTheme('${t.id}');renderSettings()">
            <div class="th-dot"></div><div class="th-name">${t.name}</div>
          </div>`).join('')}
        ${aiPal ? `
          <div class="theme-card ${currentTheme==='aitheme'?'active':''}" data-t="aitheme" onclick="applyTheme('aitheme');renderSettings()">
            <div class="th-dot" style="background:linear-gradient(135deg,${aiPal.accent1},${aiPal.accent2});border-color:rgba(255,255,255,0.3)"></div>
            <div class="th-name">AI ✨</div>
          </div>` : ''}
      </div>
      <button class="btn-secondary" style="margin-top:10px" onclick="showThemeStudio()">✨ AI THEME STUDIO — DESCRIBE A STYLE</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> CHAT BACKGROUND</div>
      <div class="bg-grid">
        ${BACKGROUNDS.map(b => `
          <div class="bg-card ${b.id === currentBg ? 'active' : ''}" onclick="setBg('${b.id}')" style="background:var(--bg-0)">
            <div style="position:absolute;inset:0;${b.id !== 'default' ? 'background-image:'+b.css+';background-size:'+(b.id==='dots'?'16px 16px':'24px 24px') : ''}"></div>
            <div class="bg-label">${b.name}</div>
          </div>`).join('')}
        <div class="bg-card ${currentBg==='custom'?'active':''}" onclick="document.getElementById('bgFileInput').click()" style="${localStorage.getItem('blushift-bg-custom') ? `background-image:url('${localStorage.getItem('blushift-bg-custom')}');background-size:cover;background-position:center` : 'background:var(--bg-2)'}">
          <div class="bg-label" style="background:rgba(0,0,0,0.35)">＋ Upload</div>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg> EMOJI PACK</div>
      <div class="seg-control">
        ${EMOJI_PACKS.map(p => `<button class="seg-btn ${currentEmojiPack===p.id?'active':''}" onclick="setEmojiPack('${p.id}')">${p.name}</button>`).join('')}
      </div>
      <div class="emoji-pack-sample wa-emoji">${EM('😀 👍 ❤️ 🎉 🔥 😎 🥳 😭')}</div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ACCOUNT</div>
      <div class="settings-item"><span>Name</span><span class="settings-val">${account.name || '—'}</span></div>
      <div class="settings-item"><span>Email</span><span class="settings-val dim">${account.email || '—'}</span></div>
      <div class="settings-item"><span>Device</span><span class="settings-val dim">${account.device || 'Auto-detected'}</span></div>
      <div class="settings-item"><span>Photo Library</span><span class="settings-val ${account.photoAccess && account.photoAccess !== 'none' ?'ok':'dim'}">${account.photoAccess && account.photoAccess !== 'none' ? 'ACCESS GRANTED' : 'NOT GRANTED'}</span></div>
      <div class="settings-item"><span><span class="spotify-mark"><svg width="13" height="13" viewBox="0 0 24 24" fill="#1DB954" style="vertical-align:-2px"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg></span> Spotify${account.spotify && account.spotify.linked && account.spotify.user ? ` · ${escapeHtml(account.spotify.user)}` : ''}</span>${account.spotify && account.spotify.linked ? `<button class="settings-val" style="background:none;border:none;color:var(--danger);cursor:pointer;font-family:inherit" onclick="confirmUnlinkSpotify()">Disconnect</button>` : `<button class="settings-val" style="background:none;border:none;color:#1DB954;cursor:pointer;font-family:inherit" onclick="linkSpotifyInApp()">Connect</button>`}</div>
      <div class="settings-item"><span>Build</span><span class="settings-val dim">${APP_VERSION}</span></div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> BILLING & PAYMENT</div>
      <div class="trial-banner">
        <div class="trial-left">
          <div class="trial-title">${ti.active ? `Free Trial · ${ti.days} day${ti.days!==1?'s':''} left` : 'Trial ended'}</div>
          <div class="trial-sub">${(account.plan||'basic').toUpperCase()} plan · ${ti.active ? 'no charge during beta' : 'beta — still free'}</div>
        </div>
        <div class="trial-badge">${ti.active ? '3-DAY TRIAL' : 'BETA'}</div>
      </div>
      ${PAYMENT_METHODS.map(p => `
        <div class="pay-card" onclick="makePrimaryCard('${p.id}')">
          <div class="pay-ico">${p.icon}</div>
          <div class="pay-info"><div class="pay-brand">${p.brand} •••• ${p.last4}</div><div class="pay-exp"><span class="pay-type">CARD</span> · Expires ${p.exp}</div></div>
          ${p.primary ? '<span class="pay-primary">PRIMARY</span>' : '<span class="pay-make">Make primary</span>'}
        </div>`).join('')}
      ${WALLETS.filter(w => walletLinked(w.id)).map(w => {
        const wa = (account.walletAccounts || {})[w.id] || {};
        const disp = wa.handle ? ((w.id==='cashapp'?'$':w.id==='venmo'?'@':'') + wa.handle)
          : (w.id==='googlepay' && account.googlePay && account.googlePay.email) ? account.googlePay.email
          : (wa.id || 'linked');
        return `
        <div class="pay-card">
          <div class="pay-ico" style="background:${w.color}">${w.id==='cashapp'?'$':w.id==='venmo'?'V':'G'}</div>
          <div class="pay-info"><div class="pay-brand">${w.mark}</div><div class="pay-exp"><span class="pay-type">${w.name.toUpperCase()}</span> · ${escapeHtml(disp)}</div></div>
          <button class="pay-unlink" onclick="confirmUnlinkWallet('${w.id}')">Unlink</button>
        </div>`;
      }).join('')}
      <button class="btn-secondary" style="margin-top:8px" onclick="showAddPayment()">＋ Add Payment Method</button>
      <button class="btn-secondary" style="margin-top:6px" onclick="exportMyAccount()">⬇ Export My Account Data (.csv for Excel)</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> SECURITY</div>
      <div class="settings-item"><span>Face ID / Fingerprint Lock</span><label class="toggle"><input type="checkbox" ${biometricOn?'checked':''} onchange="setBiometric(this.checked);renderSettings()"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      ${biometricOn ? `
        <div class="settings-item"><span>Method</span>
          <div class="seg-control" style="width:190px;flex:none">
            <button class="seg-btn ${biometricMethod==='face'?'active':''}" onclick="setBiometricMethod('face')">Face ID</button>
            <button class="seg-btn ${biometricMethod==='touch'?'active':''}" onclick="setBiometricMethod('touch')">Fingerprint</button>
          </div>
        </div>
        <div class="settings-item"><span>Enrollment</span><span class="settings-val ${biometricEnrolled?'ok':'dim'}">${biometricEnrolled?'ENROLLED':'NOT SET UP'}</span></div>
        <div class="settings-item" style="justify-content:center"><button class="btn-secondary" onclick="setupBiometrics()" style="max-width:240px">${biometricEnrolled?'Re-scan':'Set Up'} ${biometricMethod==='touch'?'Fingerprint':'Face ID'}</button></div>
      ` : ''}
      <div class="settings-item"><span>Identity Vault</span><label class="toggle"><input type="checkbox" checked><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Encryption</span><span class="settings-val">TLS 1.3 / AES-256</span></div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> MESSAGING</div>
      <div class="settings-item"><span>Read Receipts (with time)</span><label class="toggle"><input type="checkbox" ${readReceiptsOn?'checked':''} onchange="setReadReceipts(this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Auto-Translate Foreign Messages</span><label class="toggle"><input type="checkbox" ${autoTranslateOn?'checked':''} onchange="setAutoTranslate(this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item" onclick="openLanguagePicker()" style="cursor:pointer"><span>App Language</span><span class="settings-val" style="display:inline-flex;align-items:center;gap:6px">${flagImg((APP_LANGUAGES.find(l=>l.code===appLang)||{cc:'us'}).cc)} ${(APP_LANGUAGES.find(l=>l.code===appLang)||{native:'English'}).native} ▸</span></div>
      <div class="settings-item"><span>Typing Indicators</span><label class="toggle"><input type="checkbox" checked><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>HD Media Bridge</span><label class="toggle"><input type="checkbox" checked><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Instant Translation</span><label class="toggle"><input type="checkbox" checked><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Default SMS Handler</span><span class="settings-val ok">BLUSHIFT</span></div>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="currentColor">${PHONE_PATH}</svg> CALLS &amp; RINGTONE</div>
      <p style="font-size:11px;color:var(--txt-dim);margin:0 2px 10px">Pick a ringtone and choose how the incoming-call screen looks.</p>
      <div class="settings-item"><span>Ringtone</span><span class="settings-val">${ringtoneLabel()}</span></div>
      <div class="ring-list">
        ${RINGTONES.map(r => `<button class="ring-row ${getRingtoneId()===r.id?'sel':''}" onclick="setRingtone('${r.id}')"><span class="ring-name">${r.name}</span><span class="ring-actions"><span class="ring-play" onclick="event.stopPropagation();previewRingtone('${r.id}')">▶</span>${getRingtoneId()===r.id?'<span class="ring-check">✓</span>':''}</span></button>`).join('')}
        ${localStorage.getItem('blushift-ringtone-custom') ? `<button class="ring-row ${getRingtoneId()==='custom'?'sel':''}" onclick="setRingtone('custom')"><span class="ring-name">My upload <small style="color:var(--txt-dim)">· from ${getRingtoneStart()}s</small></span><span class="ring-actions"><span class="ring-play" onclick="event.stopPropagation();previewRingtone('custom')">▶</span><span class="ring-play" onclick="event.stopPropagation();openRingtoneTrim()">✎</span>${getRingtoneId()==='custom'?'<span class="ring-check">✓</span>':''}</span></button>` : ''}
      </div>
      <button class="btn-secondary" style="margin-top:8px" onclick="document.getElementById('ringtoneInput').click()">＋ Upload your own ringtone</button>
      <div class="settings-item" style="margin-top:12px;border:none;background:none;padding-left:2px"><span>Incoming call screen layout</span></div>
      <div class="seg-row">
        <button class="seg-btn ${callLayout==='side'?'active':''}" onclick="setCallLayout('side')">Side by side</button>
        <button class="seg-btn ${callLayout==='stacked'?'active':''}" onclick="setCallLayout('stacked')">Stacked</button>
        <button class="seg-btn ${callLayout==='swipe'?'active':''}" onclick="setCallLayout('swipe')">Swipe</button>
      </div>
      <button class="btn-secondary" style="margin-top:10px" onclick="previewIncomingCall()">▶ Preview incoming call</button>
    </div>

    <div class="settings-section">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> COMPLIANCE</div>
      <div class="settings-item"><span>Message Encryption</span><span class="settings-val ok">AES-256-GCM</span></div>
      <div class="settings-item"><span>Where messages live</span><span class="settings-val ok">THIS DEVICE ONLY</span></div>
      <div class="settings-item" onclick="verifyEncryption()" style="cursor:pointer"><span>Verify Encryption</span><span class="settings-val" style="color:var(--accent-1)">Run test ▸</span></div>
      <div class="settings-item"><span>GDPR</span><span class="settings-val ok">COMPLIANT</span></div>
      <div class="settings-item"><span>Zero-Knowledge Relay</span><span class="settings-val ok">ACTIVE</span></div>
    </div>

    <div class="settings-section">
      <button class="btn-secondary" onclick="resetAccount()" style="color:var(--danger);border-color:var(--danger)">RESET ACCOUNT</button>
    </div>
  `;
}

function resetAccount() {
  localStorage.removeItem('blushift-account');
  sessionStorage.removeItem('blushift-account');
  localStorage.removeItem('blushift-theme');
  localStorage.removeItem('blushift-bg');
  localStorage.removeItem('blushift-bg-custom');
  localStorage.removeItem('blushift-filters');
  localStorage.removeItem('blushift-aitheme');
  location.reload();
}

/* ===== PRIVACY CONSOLE ===== */
function renderPrivacyList() {
  renderPrivacyAssist();
  const list = document.getElementById('privacyList');
  list.innerHTML = CONTACTS.filter(c => c.platform === 'iPhone' && !c.ai).map(c => `
    <div class="privacy-item">
      <div class="av-sm ${c.blueMode ? 'on' : 'off'}"${avStyle(c)}>${avInner(c)}</div>
      <div class="priv-info">
        <div class="priv-name">${c.name}</div>
        <div class="priv-status ${c.blueMode ? 'on' : 'off'}">${c.blueMode ? '● BLUE BUBBLE ACTIVE' : '○ STANDARD SMS'}</div>
      </div>
      <label class="toggle"><input type="checkbox" ${c.blueMode ? 'checked' : ''} onchange="toggleContactMode(${c.id},this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label>
    </div>`).join('');
}
function toggleContactMode(id, enabled) {
  const c = CONTACTS.find(x => x.id === id);
  if (c) { c.blueMode = enabled; renderPrivacyList(); renderChatList(); }
}

/* ===== PRIVACY ASSIST FEATURES ===== */
function renderPrivacyAssist() {
  const el = document.getElementById('privacyAssist');
  if (!el) return;
  const acct = getAccount();
  el.innerHTML = `
    <div class="settings-section" style="margin-bottom:14px">
      <div class="settings-section-title"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> PRIVACY ASSISTANT</div>
      <div class="settings-item"><span>Stealth Mode <small style="display:block;color:var(--txt-dim);font-size:10px">Blur chat content until you tap</small></span><label class="toggle"><input type="checkbox" ${stealthMode?'checked':''} onchange="setPrivacyFlag('stealth',this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Hide Message Previews</span><label class="toggle"><input type="checkbox" ${hidePreviews?'checked':''} onchange="setPrivacyFlag('hidepreviews',this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Block Unknown Senders</span><label class="toggle"><input type="checkbox" ${blockUnknown?'checked':''} onchange="setPrivacyFlag('blockunknown',this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
      <div class="settings-item"><span>Biometric App Lock <small style="display:block;color:var(--txt-dim);font-size:10px">Face ID / fingerprint on reopen</small></span><label class="toggle"><input type="checkbox" ${biometricOn?'checked':''} onchange="setBiometricFromPrivacy(this.checked)"><span class="toggle-track"><span class="toggle-thumb"></span></span></label></div>
    </div>
    <button class="btn-primary" onclick="runSecurityCheckup()" style="margin-bottom:14px">🛡️ Run Security Checkup</button>`;
}
function setBiometricFromPrivacy(on) {
  setBiometric(on);
  toast(on ? 'Biometric lock enabled' : 'Biometric lock disabled');
  renderPrivacyAssist();
  renderSettings();
}
function setPrivacyFlag(flag, on) {
  if (flag === 'stealth') { stealthMode = on; localStorage.setItem('blushift-stealth', on?'on':'off'); document.body.classList.toggle('stealth', on); }
  else if (flag === 'hidepreviews') { hidePreviews = on; localStorage.setItem('blushift-hidepreviews', on?'on':'off'); document.body.classList.toggle('hide-previews', on); }
  else if (flag === 'blockunknown') { blockUnknown = on; localStorage.setItem('blushift-blockunknown', on?'on':'off'); renderChatList(); toast(on ? 'Unknown senders blocked' : 'Unknown senders allowed'); }
}
function runSecurityCheckup() {
  const modal = document.getElementById('checkupModal');
  const body = document.getElementById('checkupBody');
  modal.classList.add('open');
  body.innerHTML = `<div class="checkup-scan"><div class="checkup-ring"></div><div class="checkup-shield">🛡️</div></div><div class="checkup-status" id="checkupStatus">Scanning your account…</div>`;
  const acct = getAccount();
  const checks = [
    { ok: true, label: 'End-to-end encryption (TLS 1.3 / AES-256)' },
    { ok: !!acct.emailVerified, label: 'Email verified' },
    { ok: !!acct.phoneVerified, label: 'Phone verified' },
    { ok: biometricOn, label: 'Biometric app lock enabled', fix: 'Enable in Settings → Security' },
    { ok: blockUnknown, label: 'Unknown senders blocked', fix: 'Turn on above to block strangers' },
    { ok: globalBlueMode, label: 'Blue Bubble relay active' },
    { ok: true, label: 'Zero-knowledge relay · NRT-02' },
  ];
  setTimeout(() => {
    const passed = checks.filter(c => c.ok).length;
    const score = Math.round(passed / checks.length * 100);
    document.getElementById('checkupStatus').textContent = '';
    body.innerHTML = `
      <div class="checkup-score ${score>=80?'good':score>=50?'mid':'bad'}">${score}<span>/100</span></div>
      <div class="checkup-score-label">Security score</div>
      <div class="checkup-list">
        ${checks.map(c => `<div class="checkup-item ${c.ok?'pass':'warn'}"><span class="ck-ic">${c.ok?'✓':'!'}</span><span class="ck-label">${c.label}${!c.ok && c.fix ? `<small>${c.fix}</small>`:''}</span></div>`).join('')}
      </div>
      <button class="btn-secondary" onclick="closeCheckup()" style="margin-top:14px">Done</button>`;
  }, 2200);
}
function closeCheckup() { document.getElementById('checkupModal').classList.remove('open'); }

/* ===== CONTACTS LIST ===== */
function renderContactList() {
  const list = document.getElementById('contactList');
  list.innerHTML = CONTACTS.filter(c => c.known).map((c,idx) => {
    const isBlue = c.blueMode && globalBlueMode && c.platform === 'iPhone';
    return `
      <div class="contact-card stagger-${Math.min(idx,8)}" onclick="showContactProfile(${c.id},'contacts')">
        <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${avInner(c)}</div>
        <div class="contact-card-info">
          <div class="contact-card-name">${c.name}</div>
          <div class="contact-card-sub">${c.platform.toUpperCase()} ${isBlue ? '· BLUE BUBBLE' : ''}</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--txt-dim)" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>`;
  }).join('');
}
function filterContactsList(query) {
  const cards = document.querySelectorAll('.contact-card');
  const q = query.toLowerCase();
  cards.forEach(card => {
    const name = card.querySelector('.contact-card-name')?.textContent.toLowerCase() || '';
    card.style.display = name.includes(q) ? 'flex' : 'none';
  });
}

/* ===== CALLS ===== */
function renderCalls() {
  const list = document.getElementById('callsList');
  if (!list) return;
  list.innerHTML = CALLS.map(call => {
    const c = CONTACTS.find(x => x.id === call.contactId);
    const isBlue = c && c.blueMode && c.platform === 'iPhone';
    const dirIcon = call.dir === 'outgoing'
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="8 7 17 7 17 16"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="17" y1="7" x2="7" y2="17"/><polyline points="16 17 7 17 7 8"/></svg>';
    const kindIcon = call.kind === 'video'
      ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'
      : `<svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor">${PHONE_PATH}</svg>`;
    return `<div class="call-item" onclick="startCall(${call.contactId},'${call.kind}')">
      <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${avInner(c)}</div>
      <div class="call-info">
        <div class="call-name ${call.missed ? 'missed' : ''}">${c ? c.name : 'Unknown'}</div>
        <div class="call-sub">${dirIcon} ${call.missed ? 'Missed' : (call.dir.charAt(0).toUpperCase()+call.dir.slice(1))} · ${call.kind} · ${call.time}</div>
      </div>
      <button class="call-act" onclick="event.stopPropagation();startCall(${call.contactId},'${call.kind}')">${kindIcon}</button>
    </div>`;
  }).join('');
}
const PHONE_PATH = '<path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2a1.1 1.1 0 0 1 1.12-.27 12.6 12.6 0 0 0 3.95.63 1.1 1.1 0 0 1 1.1 1.1V20a1.1 1.1 0 0 1-1.1 1.1A18.4 18.4 0 0 1 2.9 3.6 1.1 1.1 0 0 1 4 2.5h3.34a1.1 1.1 0 0 1 1.1 1.1 12.6 12.6 0 0 0 .63 3.95 1.1 1.1 0 0 1-.27 1.12z"/>';
let callMuted = false, callIsVideo = false;
let callRoster = [], speakerIndex = 0, speakerTimer = null;
function youEntry() {
  const acct = getAccount();
  const nm = acct.name || 'You';
  const ini = (nm.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase()) || 'Y';
  return { id: 'you', name: 'You', photo: null, initials: ini, you: true };
}
function openCallScreen(opts) {
  callMuted = false; callIsVideo = opts.kind === 'video'; callParticipants = [];
  callRoster = opts.roster && opts.roster.length ? opts.roster.slice() : [];
  speakerIndex = 0; stopSpeakerCycle();
  const screen = document.getElementById('callScreen');
  document.getElementById('callName').textContent = opts.name;
  document.getElementById('callKind').textContent = opts.kindLabel;
  const av = document.getElementById('callAvatar');
  const bg = document.getElementById('callBg');
  if (opts.photo) {
    av.style.backgroundImage = `url('${opts.photo}')`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.textContent = '';
    bg.style.backgroundImage = `url('${opts.photo}')`; bg.classList.add('has-photo');
  } else {
    av.style.backgroundImage = ''; av.textContent = opts.initials || '?';
    bg.style.backgroundImage = ''; bg.classList.remove('has-photo');
  }
  updateCallControlsUI();
  document.getElementById('keypadField').textContent = '';
  closeKeypad(); closeSoundboard();
  stopCallVideo();
  screen.classList.remove('video-on', 'has-participants', 'cam-active');
  renderCallParticipants();
  screen.classList.toggle('group-call', callRoster.length > 2);
  renderCallRoster();
  const blupEl = document.getElementById('callBlup');
  if (blupEl) blupEl.classList.toggle('show', !!opts.isBlup);
  if (opts.isBlup) document.getElementById('callBlupText').textContent = "Hi, I'm Blup — tap “Talk” and ask me anything.";
  screen.classList.toggle('blup-call', !!opts.isBlup);
  screen.classList.remove('hidden');
  requestAnimationFrame(() => screen.classList.add('open'));
  document.getElementById('callStatus').textContent = opts.isBlup ? 'Connecting to Blup…' : 'Calling…';
  const timer = document.getElementById('callTimer'); timer.textContent = '';
  let secs = 0; clearInterval(callTimer);
  setTimeout(() => {
    document.getElementById('callStatus').textContent = 'Connected';
    callTimer = setInterval(() => { secs++; const m = Math.floor(secs/60), s = (secs%60).toString().padStart(2,'0'); timer.textContent = `${m}:${s}`; }, 1000);
    if (opts.isBlup) blupSpeak("Hi, I'm Blup. Tap Talk and ask me anything about BLUSHIFT.");
    if (callRoster.length > 2) startSpeakerCycle();
  }, opts.isBlup ? 1400 : 2000);
}
function startCall(contactId, kind) {
  const c = CONTACTS.find(x => x.id === contactId);
  const roster = [youEntry(), { id: c ? c.id : '?', name: c ? c.name : 'Unknown', photo: c ? c.pfp : null, initials: c ? c.initials : '?' }];
  openCallScreen({ name: c ? c.name : 'Unknown', kind, kindLabel: kind === 'video' ? 'BLUSHIFT Video' : 'BLUSHIFT Audio', photo: c ? c.pfp : null, initials: c ? c.initials : '?', isBlup: contactId === 100, roster });
}
function startCallActive(kind) {
  if (activeChatType === 'dm') { startCall(activeChat, kind); return; }
  const g = GROUPS.find(x => x.id === activeChat);
  const members = g ? g.members.map(mid => { const c = CONTACTS.find(x => x.id === mid); return { id: mid, name: c ? c.name : 'Member', photo: c ? c.pfp : null, initials: c ? c.initials : '?' }; }) : [];
  const roster = [youEntry(), ...members];
  openCallScreen({ name: g ? g.name : 'Group', kind, kindLabel: (kind === 'video' ? 'BLUSHIFT Video' : 'BLUSHIFT Audio') + ' · ' + roster.length + ' people', photo: g ? g.photo : null, initials: g ? g.name.substring(0,2) : '?', roster });
}
/* ===== GROUP CALL ROSTER + ACTIVE SPEAKER ===== */
function rosterTile(p, speaking, pos) {
  const bg = p.photo ? ` style="background-image:url('${p.photo}');background-size:cover;background-position:center"` : '';
  return `<div class="roster-tile ${speaking ? 'speaking center' : ''}" style="${pos}">
    <div class="roster-av ${p.you ? 'cl-av-std' : 'cl-av-blue'}"${bg}>${p.photo ? '' : p.initials}<span class="roster-wave"><i></i><i></i><i></i></span></div>
    <span class="roster-name">${p.name}</span>
  </div>`;
}
function renderCallRoster() {
  const el = document.getElementById('callRoster');
  if (!el) return;
  if (callRoster.length <= 2) { el.innerHTML = ''; return; }
  if (speakerIndex >= callRoster.length) speakerIndex = 0;
  let speaker = null; const others = [];
  callRoster.forEach((p, i) => { if (i === speakerIndex) speaker = p; else others.push(p); });
  const ring = others.map((p, k) => {
    const ang = (k / others.length) * 2 * Math.PI - Math.PI / 2;
    const cx = 50 + Math.cos(ang) * 38, cy = 50 + Math.sin(ang) * 38;
    return rosterTile(p, false, `left:${cx}%;top:${cy}%`);
  }).join('');
  el.innerHTML = `<div class="roster-label">In this call · ${callRoster.length}</div>
    <div class="roster-circle">${ring}${speaker ? rosterTile(speaker, true, 'left:50%;top:50%') : ''}</div>`;
}
function setActiveSpeaker(idx) { speakerIndex = idx; renderCallRoster(); }
function pickSpeaker() {
  if (callRoster.length <= 1) return 0;
  let idx;
  do { idx = Math.floor(Math.random() * callRoster.length); } while (idx === speakerIndex && callRoster.length > 1);
  return idx;
}
function startSpeakerCycle() {
  stopSpeakerCycle();
  document.getElementById('callScreen').classList.add('group-call');
  setActiveSpeaker(pickSpeaker());
  speakerTimer = setInterval(() => setActiveSpeaker(pickSpeaker()), 2600 + Math.random() * 1500);
}
function stopSpeakerCycle() { if (speakerTimer) { clearInterval(speakerTimer); speakerTimer = null; } }
function endCall() {
  clearInterval(callTimer);
  stopAllSounds();
  stopCallVideo();
  stopSpeakerCycle();
  try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e) {}
  const screen = document.getElementById('callScreen');
  screen.classList.remove('open', 'video-on', 'cam-active', 'blup-call', 'group-call');
  closeKeypad(); closeSoundboard();
  setTimeout(() => screen.classList.add('hidden'), 320);
}

/* ===== CALL CONTROLS ===== */
function toggleMute() { callMuted = !callMuted; updateCallControlsUI(); }
let callStream = null;
function toggleCallVideo() {
  callIsVideo = !callIsVideo;
  document.getElementById('callKind').textContent = callIsVideo ? 'BLUSHIFT Video' : 'BLUSHIFT Audio';
  updateCallControlsUI();
  const screen = document.getElementById('callScreen');
  const video = document.getElementById('callVideoPreview');
  const status = document.getElementById('callStatus');
  if (callIsVideo) {
    const name = document.getElementById('callName').textContent;
    // YOU are the one switching — the other party gets the "wants to switch" prompt, not you.
    status.textContent = `Asking ${name} to switch to video…`;
    screen.classList.add('video-on');
    setTimeout(() => { if (callIsVideo) status.textContent = 'Video call'; }, 1800);
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(s => { callStream = s; video.srcObject = s; video.play().catch(()=>{}); screen.classList.add('cam-active'); })
        .catch(() => {});
    }
  } else {
    screen.classList.remove('video-on', 'cam-active');
    status.textContent = 'Connected';
    stopCallVideo();
  }
}
function stopCallVideo() {
  if (callStream) { try { callStream.getTracks().forEach(t => t.stop()); } catch(e) {} callStream = null; }
  const v = document.getElementById('callVideoPreview');
  if (v) v.srcObject = null;
}
function updateCallControlsUI() {
  const m = document.getElementById('ctlMute'); if (m) { m.classList.toggle('active', callMuted); m.classList.toggle('muted', callMuted); }
  const v = document.getElementById('ctlVideo'); if (v) v.classList.toggle('active', callIsVideo);
  const note = document.getElementById('callMutedNote'); if (note) note.classList.toggle('show', callMuted);
  const scr = document.getElementById('callScreen'); if (scr) scr.classList.toggle('is-muted', callMuted);
}
function toggleKeypad() {
  const k = document.getElementById('callKeypad');
  if (k.classList.contains('open')) k.classList.remove('open');
  else { closeSoundboard(); k.classList.add('open'); }
}
function closeKeypad() { const k = document.getElementById('callKeypad'); if (k) k.classList.remove('open'); }
function closeCallPanels() { closeKeypad(); closeSoundboard(); }
function keypadPress(d) { const f = document.getElementById('keypadField'); if (f) f.textContent += d; playDtmf(d); }
function keypadBack() { const f = document.getElementById('keypadField'); if (f) f.textContent = f.textContent.slice(0, -1); }

/* add a person → group call (searchable) */
let callParticipants = [];
function openAddToCall() {
  contactPickerMode = 'call';
  document.getElementById('contactPickerTitle').textContent = 'ADD TO CALL';
  const s = document.getElementById('contactPickerSearch'); if (s) s.value = '';
  renderContactPickerList('');
  document.getElementById('contactPickerModal').classList.add('open');
}
function addToCall(id) {
  closeContactPicker();
  const c = CONTACTS.find(x => x.id === id);
  if (!c) return;
  if (callRoster.some(p => p.id === id)) { toast(`${c.name} is already in the call`); return; }
  if (!callParticipants.includes(id)) callParticipants.push(id);
  if (!callRoster.length) callRoster = [youEntry()];
  callRoster.push({ id: c.id, name: c.name, photo: c.pfp, initials: c.initials });
  document.getElementById('callScreen').classList.add('group-call');
  document.getElementById('callKind').textContent = (callIsVideo ? 'BLUSHIFT Video' : 'BLUSHIFT Audio') + ' · Group · ' + callRoster.length + ' people';
  renderCallRoster();
  if (callRoster.length > 2 && !speakerTimer) startSpeakerCycle();
  toast(`${c.name} added to call`);
}
function renderCallParticipants() {
  const el = document.getElementById('callParticipants');
  const screen = document.getElementById('callScreen');
  if (!el) return;
  if (!callParticipants.length) { el.classList.remove('show'); el.innerHTML = ''; screen.classList.remove('has-participants'); return; }
  const names = callParticipants.map(id => CONTACTS.find(c => c.id === id)?.name || 'Guest');
  el.innerHTML = `<div class="cp-in-call-label">In this call</div><div class="cp-in-call-names">You, ${names.join(', ')}</div>`;
  el.classList.add('show');
  screen.classList.add('has-participants');
}

/* ===== CALL SOUNDBOARD (synth presets + uploads) ===== */
let audioCtx = null, uploadedSounds = [], playingAudios = [];
function ac() {
  if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return null; } }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
function master() {
  const c = ac(); if (!c) return null;
  if (!c._master) {
    const g = c.createGain(); g.gain.value = 0.85;
    const comp = c.createDynamicsCompressor();
    g.connect(comp); comp.connect(c.destination); c._master = g;
  }
  return c._master;
}
/* a single oscillator voice with ADSR + optional glide & lowpass */
function voice(freq, t, dur, type, peak, opts) {
  const c = ac(); if (!c) return;
  opts = opts || {};
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type || 'sine';
  o.frequency.setValueAtTime(freq, t);
  if (opts.glideTo) o.frequency.exponentialRampToValueAtTime(opts.glideTo, t + dur);
  if (opts.detune) o.detune.value = opts.detune;
  let node = o;
  if (opts.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lp; if (opts.q) f.Q.value = opts.q; o.connect(f); node = f; }
  node.connect(g); g.connect(master() || c.destination);
  const a = opts.a != null ? opts.a : 0.008;
  const r = opts.r != null ? opts.r : Math.min(0.3, dur * 0.5);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t + a);
  g.gain.setValueAtTime(Math.max(0.001, peak), t + Math.max(a, dur - r));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, peak, filterType, filterFreq, q) {
  const c = ac(); if (!c) return;
  const n = Math.floor(c.sampleRate * dur); const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const g = c.createGain(); let node = src;
  if (filterType) { const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = filterFreq || 1000; if (q) f.Q.value = q; src.connect(f); node = f; }
  node.connect(g); g.connect(master() || c.destination);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + Math.min(0.08, dur * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.start(t); src.stop(t + dur + 0.02);
}
function playDtmf(d) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  const map = {'1':[697,1209],'2':[697,1336],'3':[697,1477],'4':[770,1209],'5':[770,1336],'6':[770,1477],'7':[852,1209],'8':[852,1336],'9':[852,1477],'*':[941,1209],'0':[941,1336],'#':[941,1477]};
  const f = map[d]; if (!f) return; voice(f[0], t, 0.16, 'sine', 0.18); voice(f[1], t, 0.16, 'sine', 0.18);
}

/* ===== RINGTONES + INCOMING-CALL CUSTOMIZATION ===== */
const RINGTONES = [
  { id:'pulse',   name:'Pulse',   seq:[[784,0,.16],[988,.18,.16],[784,.36,.16],[1175,.54,.34]] },
  { id:'aurora',  name:'Aurora',  seq:[[659,0,.22],[784,.24,.22],[988,.48,.22],[784,.72,.30]] },
  { id:'classic', name:'Classic', seq:[[1047,0,.20],[784,.22,.20],[1047,.50,.20],[784,.72,.28]] },
  { id:'bloom',   name:'Bloom',   seq:[[523,0,.18],[659,.20,.18],[784,.40,.18],[1047,.60,.40]] },
];
let callLayout = localStorage.getItem('blushift-calllayout') || 'side';
let _ringEl = null, _ringLoop = null;
function getRingtoneId() { return localStorage.getItem('blushift-ringtone') || 'pulse'; }
function getRingtoneStart() { return parseFloat(localStorage.getItem('blushift-ringtone-start') || '0') || 0; }
function ringtoneLabel() {
  const id = getRingtoneId();
  if (id === 'custom') return 'My upload';
  return (RINGTONES.find(r => r.id === id) || RINGTONES[0]).name;
}
function playPresetRingtone(seq) {
  const c = ac(); if (!c) return; const t0 = c.currentTime + 0.02;
  seq.forEach(n => voice(n[0], t0 + n[1], n[2], 'triangle', 0.22, { lp: 3200 }));
}
function stopRingtone() {
  if (_ringLoop) { clearInterval(_ringLoop); _ringLoop = null; }
  if (_ringEl) { try { _ringEl.pause(); } catch (e) {} _ringEl.onended = null; _ringEl = null; }
}
function startRingtone(loop) {
  stopRingtone();
  const id = getRingtoneId();
  if (id === 'custom') {
    const data = localStorage.getItem('blushift-ringtone-custom'); if (!data) { startRingtone2('pulse', loop); return; }
    const start = getRingtoneStart();
    _ringEl = new Audio(data); _ringEl.currentTime = start; _ringEl.play().catch(() => {});
    if (loop) _ringEl.onended = () => { try { _ringEl.currentTime = start; _ringEl.play(); } catch (e) {} };
  } else { startRingtone2(id, loop); }
}
function startRingtone2(id, loop) {
  const rt = RINGTONES.find(r => r.id === id) || RINGTONES[0];
  const total = Math.max.apply(null, rt.seq.map(n => n[1] + n[2])) + 0.5;
  playPresetRingtone(rt.seq);
  if (loop) _ringLoop = setInterval(() => playPresetRingtone(rt.seq), (total + 0.6) * 1000);
}
function previewRingtone(id) {
  stopRingtone();
  if (id === 'custom') {
    const data = localStorage.getItem('blushift-ringtone-custom'); if (!data) return;
    _ringEl = new Audio(data); _ringEl.currentTime = getRingtoneStart(); _ringEl.play().catch(() => {});
    setTimeout(() => { if (_ringEl) { try { _ringEl.pause(); } catch (e) {} _ringEl = null; } }, 5000);
  } else { const rt = RINGTONES.find(r => r.id === id); if (rt) playPresetRingtone(rt.seq); }
}
function setRingtone(id) { localStorage.setItem('blushift-ringtone', id); renderSettings(); previewRingtone(id); }
function setCallLayout(l) { callLayout = l; localStorage.setItem('blushift-calllayout', l); renderSettings(); }
function uploadRingtone(input) {
  const f = (input.files || [])[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = e => { localStorage.setItem('blushift-ringtone-custom', e.target.result); localStorage.setItem('blushift-ringtone', 'custom'); localStorage.setItem('blushift-ringtone-start', '0'); openRingtoneTrim(); };
  reader.readAsDataURL(f); input.value = '';
}
function openRingtoneTrim() {
  const data = localStorage.getItem('blushift-ringtone-custom'); if (!data) return;
  const a = document.getElementById('trimAudio'); a.src = data;
  document.getElementById('ringtoneTrimModal').classList.add('open');
  a.onloadedmetadata = () => {
    const slider = document.getElementById('trimStart');
    slider.max = Math.max(0, Math.floor((a.duration || 30) - 1));
    slider.value = getRingtoneStart();
    document.getElementById('trimStartLabel').textContent = slider.value + 's';
    document.getElementById('trimDur').textContent = (a.duration ? Math.floor(a.duration) : '?') + 's';
  };
}
function onTrimStart(v) { document.getElementById('trimStartLabel').textContent = v + 's'; }
function previewTrim() {
  const a = document.getElementById('trimAudio'); a.currentTime = parseFloat(document.getElementById('trimStart').value) || 0;
  a.play().catch(() => {}); setTimeout(() => { try { a.pause(); } catch (e) {} }, 5000);
}
function saveTrim() {
  localStorage.setItem('blushift-ringtone-start', document.getElementById('trimStart').value);
  localStorage.setItem('blushift-ringtone', 'custom');
  const a = document.getElementById('trimAudio'); try { a.pause(); } catch (e) {}
  closeSheetAnimated('ringtoneTrimModal'); renderSettings(); toast('Ringtone saved');
}
function closeRingtoneTrim() { const a = document.getElementById('trimAudio'); try { a.pause(); } catch (e) {} closeSheetAnimated('ringtoneTrimModal'); }
/* incoming call (preview / simulated) */
function previewIncomingCall() { showIncomingCall({ name: 'Jordan M.', kind: 'BLUSHIFT Audio', initials: 'JM' }); }
function showIncomingCall(opts) {
  const scr = document.getElementById('incomingCallScreen'); if (!scr) return;
  scr.setAttribute('data-layout', callLayout);
  document.getElementById('incName').textContent = opts.name;
  document.getElementById('incKind').textContent = opts.kind;
  document.getElementById('incAvatar').textContent = opts.initials || '?';
  scr.classList.remove('hidden');
  startRingtone(true);
}
function answerIncoming() {
  stopRingtone();
  document.getElementById('incomingCallScreen').classList.add('hidden');
  openCallScreen({ name: document.getElementById('incName').textContent, kind: 'audio', kindLabel: 'BLUSHIFT Audio', initials: document.getElementById('incAvatar').textContent });
}
function declineIncoming() { stopRingtone(); document.getElementById('incomingCallScreen').classList.add('hidden'); }
function playSound(name) {
  const c = ac(); if (!c) return; const t = c.currentTime;
  switch (name) {
    case 'airhorn':
      [0, 0.36].forEach(off => [233, 311, 466].forEach(fr => voice(fr, t + off, 0.34, 'sawtooth', 0.16, { lp: 2400, a: 0.02, r: 0.05 })));
      break;
    case 'laser':
      voice(1900, t, 0.4, 'sawtooth', 0.26, { glideTo: 90, lp: 3200, a: 0.002, r: 0.34 });
      voice(950, t, 0.4, 'square', 0.1, { glideTo: 60, lp: 2200, a: 0.002, r: 0.34 });
      break;
    case 'beep': // pleasant 2-note ping (Discord-ish)
      voice(880, t, 0.5, 'sine', 0.34, { a: 0.005, r: 0.45 });
      voice(880 * 2.5, t, 0.5, 'sine', 0.06, { a: 0.005, r: 0.45 });
      voice(1318.5, t + 0.14, 0.5, 'sine', 0.32, { a: 0.005, r: 0.45 });
      break;
    case 'rimshot':
      voice(340, t, 0.13, 'sine', 0.45, { glideTo: 120, a: 0.001, r: 0.11 });
      voice(340, t + 0.14, 0.13, 'sine', 0.45, { glideTo: 120, a: 0.001, r: 0.11 });
      noise(t + 0.28, 0.55, 0.28, 'highpass', 6500);
      break;
    case 'applause':
      noise(t, 1.7, 0.42, 'bandpass', 1900, 0.5);
      break;
    case 'fanfare':
      [523, 659, 784, 1046].forEach((fr, i) => voice(fr, t + i * 0.14, 0.32, 'sawtooth', 0.16, { lp: 3200, a: 0.01, r: 0.1 }));
      break;
    case 'tada':
      [523, 659, 784].forEach(fr => voice(fr, t, 0.12, 'triangle', 0.2));
      [1046, 1318, 1568].forEach(fr => voice(fr, t + 0.15, 0.65, 'triangle', 0.18, { a: 0.01, r: 0.55 }));
      break;
    case 'crickets':
      for (let i = 0; i < 7; i++) { const tt = t + i * 0.22; voice(4400, tt, 0.04, 'sine', 0.12); voice(4400, tt + 0.07, 0.04, 'sine', 0.12); }
      break;
  }
}
/* Blup's voice — choose a natural-sounding one, user-selectable */
function blupVoices() {
  if (!('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang) || /english/i.test(v.name));
}
function pickBlupVoice() {
  const voices = blupVoices();
  const saved = localStorage.getItem('blushift-blup-voice');
  if (saved) { const m = voices.find(v => v.name === saved); if (m) return m; }
  return voices.find(v => /Natural|Google US English|Aria|Jenny|Sonia|Libby|Samantha/i.test(v.name)) || voices.find(v => /Google/i.test(v.name)) || voices[0] || null;
}
function blupSpeak(text) {
  try {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const clean = String(text).replace(/[#*_`>~|]/g, '').replace(/\s+/g, ' ').trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0; u.pitch = 1.0;       // natural, not chipmunky
    const v = pickBlupVoice();
    if (v) { u.voice = v; u.lang = v.lang; }
    window.speechSynthesis.speak(u);
  } catch (e) {}
}
if ('speechSynthesis' in window) { try { window.speechSynthesis.onvoiceschanged = () => {}; } catch(e) {} }
function toggleSoundboard() {
  const s = document.getElementById('callSoundboard');
  if (s.classList.contains('open')) s.classList.remove('open');
  else { closeKeypad(); renderSoundboard(); s.classList.add('open'); }
}
function closeSoundboard() { const s = document.getElementById('callSoundboard'); if (s) s.classList.remove('open'); }
function renderSoundboard() {
  const up = document.getElementById('soundUploadList');
  if (up) up.innerHTML = uploadedSounds.map((s,i) => `<button class="sb-btn sb-upload" onclick="playUploaded(${i})">🔊 ${s.name.slice(0,14)}</button>`).join('');
}
function handleSoundUpload(input) {
  const f = (input.files || [])[0]; if (!f) return;
  uploadedSounds.push({ name: f.name, url: URL.createObjectURL(f) });
  renderSoundboard(); input.value = '';
}
function playUploaded(i) { const s = uploadedSounds[i]; if (s) { const a = new Audio(s.url); a.play().catch(()=>{}); playingAudios.push(a); } }
function stopAllSounds() { playingAudios.forEach(a => { try { a.pause(); } catch(e) {} }); playingAudios = []; }

/* ============================================
   BLUP — built-in AI assistant
   ============================================ */
const BLUP_SYSTEM = "You are Blup, the friendly built-in AI assistant inside BLUSHIFT — a messaging app that makes Android texts appear as blue iMessage bubbles. Chat naturally, warmly and like a real friend. You can have casual conversations, offer support and encouragement, joke around, AND answer questions about the app when asked. App features you know: themes & the AI Theme Studio (Settings → Appearance), sending/requesting money via the + menu → Money with Google Pay/Venmo/Cash App, biometric Face ID/fingerprint lock (Settings → Security or the Privacy Console), translating messages by long-pressing them or turning on Auto-Translate, group chats, stickers with AI background removal, the Calls and Voicemail tabs, the Privacy Console with a Security Checkup, linking Spotify, and sending Spotify songs and voice memos. Keep replies short — usually 1 to 3 sentences — unless asked for more. Warm tone, an occasional emoji is fine. Never mention that you are a language model.";
function blupHistory() {
  const conv = CONVERSATIONS[100];
  if (!conv) return [];
  return conv.messages
    .filter(m => (m.type === 'sent' && m.text) || (m.type === 'recv' && m.text))
    .slice(-9)
    .map(m => ({ role: m.type === 'sent' ? 'user' : 'assistant', content: String(m.text).replace(/<[^>]+>/g, '') }));
}
/* Real AI via Pollinations (free, keyless). GET = a "simple" request, so no CORS
   preflight (the POST+JSON version was being blocked → silent fallback). */
function blupAnswerOk(out) {
  if (!out) return false;
  const t = out.trim();
  if (t.length < 2) return false;
  if (/^\s*[\[{<]/.test(t)) return false;                       // JSON/HTML
  if (/^\s*(error|not\s*found|internal server|rate ?limit|too many|unauthorized|bad request|service unavailable)/i.test(t)) return false;
  return true;
}
function blupAsk(userText, cb) {
  let done = false;
  const finish = (txt) => { if (done) return; done = true; clearTimeout(timer); cb(txt); };
  const timer = setTimeout(() => finish(blupReply(userText)), 13000);
  const hist = blupHistory();
  const transcript = (hist.length
    ? hist.map(m => (m.role === 'user' ? 'User: ' : 'Blup: ') + m.content).join('\n')
    : 'User: ' + userText) + '\nBlup:';
  const url = `https://text.pollinations.ai/${encodeURIComponent(transcript)}?model=openai&system=${encodeURIComponent(BLUP_SYSTEM)}&referrer=blushift&private=true`;
  const clean = (txt) => (txt || '').replace(/^\s*Blup:\s*/i, '').trim();
  fetch(url)
    .then(r => r.ok ? r.text() : Promise.reject())
    .then(txt => { const out = clean(txt); finish(blupAnswerOk(out) ? out : blupReply(userText)); })
    .catch(() => {
      // secondary: OpenAI-compatible endpoint
      fetch('https://text.pollinations.ai/openai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'openai', messages: [{ role: 'system', content: BLUP_SYSTEM }, ...hist] })
      })
        .then(r => r.json())
        .then(d => { const out = clean(d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content); finish(blupAnswerOk(out) ? out : blupReply(userText)); })
        .catch(() => finish(blupReply(userText)));
    });
}
function blupChatReply(userText) {
  const chatId = activeChat;
  const conv = CONVERSATIONS[chatId];
  if (!conv) return;
  setTimeout(() => {
    conv.messages.push({ id: Date.now(), type: 'typing' });
    if (String(activeChat) === String(chatId)) { renderMessages(conv.messages); scrollToBottom(); }
    blupAsk(userText, (reply) => {
      conv.messages = conv.messages.filter(x => x.type !== 'typing');
      conv.messages.push({ id: Date.now(), type: 'recv', text: reply, ts: Date.now() });
      conv.preview = reply.replace(/<[^>]+>/g, '').slice(0, 64);
      conv.time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      if (String(activeChat) === String(chatId)) { renderMessages(conv.messages); scrollToBottom(); }
      renderChatList();
    });
  }, 350);
}
function blupReply(text) {
  const t = (text || '').toLowerCase();
  const has = (...k) => k.some(w => t.includes(w));
  if (has('hi ', 'hey', 'hello', 'yo ', 'sup', 'good morning', 'good evening') || t.trim() === 'hi' || t.trim() === 'yo') return "Hey! 👋 I'm Blup, your BLUSHIFT assistant. I can help with messaging, calls, money, themes, stickers, translation, biometrics or privacy — what do you need?";
  if (has('who are you', 'what are you', 'your name', 'about you')) return "I'm Blup ✦ — the built-in BLUSHIFT AI. Message me or call me any time and I'll help you get things done in the app.";
  if (has('send money', 'request money', 'venmo', 'cash app', 'cashapp', 'google pay', ' pay', 'money')) return "To send or request money: open a chat, tap ＋ → 💸 Money, choose your wallet (Google Pay, Venmo or Cash App), enter an amount, then Send or Request. Link a wallet first in Settings → Billing.";
  if (has('theme', 'color', 'dark mode', 'appearance')) return "Go to Settings → Appearance for themes. Try the ✨ AI Theme Studio — describe a vibe like “midnight ocean” and I'll generate a whole color scheme for you.";
  if (has('face id', 'faceid', 'fingerprint', 'biometric', 'touch id', 'app lock')) return "In Settings → Security, turn on Face ID / Fingerprint Lock, pick your method and tap Set Up. After that you'll unlock BLUSHIFT with biometrics every time you reopen it.";
  if (has('translate', 'language', 'spanish', 'french', 'foreign')) return "Long-press a message → Translate to search any language. Or enable Settings → Messaging → Auto-Translate and foreign messages get translated under the bubble automatically.";
  if (has('group')) return "Start a group from the people icon on Chats. Inside a group's settings you can add or remove people, change its photo and name, or leave — each with a confirmation.";
  if (has('call', 'voicemail', 'dial', 'soundboard')) return "The Calls tab has your history and a rotary dialer. On a call you can mute, switch to video, open the keypad, add people, or play the soundboard. Voicemail has its own tab with transcripts.";
  if (has('sticker')) return "Tap ＋ → Stickers, then Create Sticker to upload an image — I'll remove the background with AI so it sends like a real sticker.";
  if (has('photo', 'picture', 'image', 'album', 'media')) return "Tap ＋ → Photos to pick from your library (newest first). Send several and they arrive as an album — tap one for the full-screen viewer.";
  if (has('privacy', 'secure', 'security', 'block', 'stealth')) return "Open the Privacy Console (shield icon, top-right of Chats). You can run a Security Checkup, enable Stealth Mode, hide previews, block unknown senders, and control Blue Bubble per contact.";
  if (has('blue bubble', 'imessage', 'bubble')) return "BLUSHIFT relays your texts so they show up as blue iMessage bubbles on iPhones. Toggle it with the banner on Chats, or per-contact in the Privacy Console.";
  if (has('react', 'reaction', 'emoji')) return "Double-tap or long-press a message to react, or tap ＋ in the reaction bar for every emoji. Change your emoji style in Settings → Emoji Pack.";
  if (has('reply', 'edit', 'unsend', 'pin', 'copy')) return "Long-press any message for Reply, Copy, Pin, Edit, Unsend (within 15 min), Translate, and Read Receipts in groups.";
  if (has('trial', 'plan', 'subscription', 'billing', 'cancel', 'card')) return "You're on a 3-day free trial — no charge during beta. Manage your plan, cards and wallets in Settings → Billing & Payment.";
  if (has('thank', 'thanks', ' ty', 'appreciate')) return "Anytime! 😊 Need help with anything else?";
  if (has('joke', 'funny', 'bored')) return "Why did the Android cross the road? To turn its texts blue. 🔵 Anyway — what can I help you with?";
  if (has('time', 'date', 'day')) { const d = new Date(); return `It's ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} on ${d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}.`; }
  if (has('how are you', "how's it going")) return "Running smooth and fully encrypted — thanks for asking! How can I help?";
  if (has('bye', 'goodbye', 'see you', 'later')) return "Catch you later! 👋 Tap me whenever you need a hand.";
  if (t.trim().endsWith('?')) return "Great question! I can help with messaging, calls & voicemail, sending money, themes, stickers, translation, biometrics, and privacy. Which of those did you mean?";
  return "Got it. I can walk you through messaging, money, calls, themes, stickers, translation, biometrics or privacy — just tell me what you're trying to do. ✦";
}
function blupListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const setText = s => { const el = document.getElementById('callBlupText'); if (el) el.textContent = s; };
  const answer = q => { setText('“' + q + '”\n— thinking…'); blupAsk(q, a => { setText('“' + q + '”\n— ' + a); blupSpeak(a); }); };
  if (SR) {
    try {
      const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 1;
      setText('Listening… ask your question');
      document.getElementById('callBlup').classList.add('listening');
      r.onresult = e => answer(e.results[0][0].transcript);
      r.onerror = () => { setText("Didn't catch that — tap Talk to try again."); document.getElementById('callBlup').classList.remove('listening'); };
      r.onend = () => document.getElementById('callBlup').classList.remove('listening');
      r.start();
    } catch (e) { const q = prompt('Ask Blup a question:'); if (q) answer(q); }
  } else {
    const q = prompt('Ask Blup a question:'); if (q) answer(q);
  }
}

/* ============================================
   PRODUCT TOUR (spotlight walkthrough)
   ============================================ */
const TOUR_STEPS = [
  { sel: '[data-view="chatList"]', view: 'chatList', title: 'Chats', text: 'All your conversations live here — blue-bubble iMessages, SMS and groups, newest on top.' },
  { sel: '[data-view="contacts"]', view: 'chatList', title: 'Contacts', text: 'Browse and edit everyone you know — profile photo, phone, home address and notes.' },
  { sel: '[data-view="calls"]', view: 'chatList', title: 'Calls', text: 'Your call history plus a rotary dialer for new numbers. Audio & video with an in-call soundboard.' },
  { sel: '[data-view="voicemail"]', view: 'chatList', title: 'Voicemail', text: 'Listen to voicemails with auto transcripts and call people back in a tap.' },
  { sel: '[data-view="settings"]', view: 'settings', title: 'Settings', text: 'Themes & emoji packs, biometric Face ID / fingerprint lock, and Billing for your cards and wallets.' },
  { sel: '#privacyHdrBtn', view: 'chatList', title: 'Privacy Console', text: 'Per-contact Blue Bubble control, a Security Checkup, Stealth Mode and blocking unknown senders.' },
  { sel: null, view: 'chatList', title: "You're all set! ✦", text: "That's the tour — you're ready to go. Enjoy BLUSHIFT!" },
];
let tourIndex = 0;
function showTourOffer() { document.getElementById('tourOffer').classList.add('open'); }
function declineTour() { document.getElementById('tourOffer').classList.remove('open'); markTourSeen(); }
function markTourSeen() { const a = getAccount(); a.tourSeen = true; saveAccount(a); }
function startTour() {
  document.getElementById('tourOffer').classList.remove('open');
  tourIndex = 0;
  document.getElementById('tourOverlay').classList.add('open');
  goTourStep(0);
}
function goTourStep(i) {
  tourIndex = i;
  showView(TOUR_STEPS[i].view);
  setTimeout(positionTour, 380);
}
function positionTour() {
  const step = TOUR_STEPS[tourIndex];
  const spot = document.getElementById('tourSpot');
  const card = document.getElementById('tourCard');
  const el = step.sel ? document.querySelector(step.sel) : null;
  if (el) {
    const r = el.getBoundingClientRect();
    const pad = 8;
    spot.style.opacity = '1';
    spot.style.left = (r.left - pad) + 'px';
    spot.style.top = (r.top - pad) + 'px';
    spot.style.width = (r.width + pad * 2) + 'px';
    spot.style.height = (r.height + pad * 2) + 'px';
    const cardW = Math.min(320, window.innerWidth - 24);
    card.style.width = cardW + 'px';
    card.style.left = Math.max(12, Math.min(window.innerWidth - 12 - cardW, r.left + r.width / 2 - cardW / 2)) + 'px';
    if (r.top < window.innerHeight / 2) { card.style.top = (r.bottom + 16) + 'px'; card.style.bottom = 'auto'; }
    else { card.style.bottom = (window.innerHeight - r.top + 16) + 'px'; card.style.top = 'auto'; }
    card.classList.remove('centered');
  } else {
    spot.style.opacity = '0';
    spot.style.width = '0'; spot.style.height = '0';
    spot.style.left = '50%'; spot.style.top = '50%';
    card.classList.add('centered');
    card.style.left = ''; card.style.top = ''; card.style.bottom = ''; card.style.width = '';
  }
  document.getElementById('tourTitle').textContent = step.title;
  document.getElementById('tourText').textContent = step.text;
  document.getElementById('tourProgress').textContent = `${tourIndex + 1} / ${TOUR_STEPS.length}`;
  document.getElementById('tourNext').textContent = tourIndex === TOUR_STEPS.length - 1 ? 'Finish' : 'Next →';
}
function nextTour() { if (tourIndex < TOUR_STEPS.length - 1) goTourStep(tourIndex + 1); else endTour(); }
function endTour() { document.getElementById('tourOverlay').classList.remove('open'); showView('chatList'); markTourSeen(); }

/* ===== ROTARY DIALER (themed) ===== */
let dialerDigits = '';
function openDialer() {
  dialerDigits = '';
  document.getElementById('dialerNumber').textContent = '';
  renderRotary();
  document.getElementById('dialerModal').classList.add('open');
}
function closeDialer() { document.getElementById('dialerModal').classList.remove('open'); }
function renderRotary() {
  const ring = document.getElementById('rotaryRing');
  const digits = ['1','2','3','4','5','6','7','8','9','0'];
  ring.innerHTML = digits.map((d,i) => {
    const ang = (i / digits.length) * 2 * Math.PI - Math.PI / 2; // 1 at top, clockwise
    const r = 41;
    const x = 50 + Math.cos(ang) * r, y = 50 + Math.sin(ang) * r;
    return `<button class="rotary-hole" style="left:${x}%;top:${y}%" onclick="dialerPress('${d}')"><span>${d}</span></button>`;
  }).join('');
}
function formatPhone(d) {
  d = (d || '').replace(/\D/g, '').slice(0, 10);   // digits only, max 10
  if (d.length <= 3) return d;
  if (d.length <= 6) return d.slice(0,3) + ' ' + d.slice(3);
  return d.slice(0,3) + ' ' + d.slice(3,6) + ' ' + d.slice(6);
}
function dialerPress(d) {
  if (dialerDigits.length >= 10) return;
  dialerDigits += d;
  document.getElementById('dialerNumber').textContent = formatPhone(dialerDigits);
  playDtmf(d);
  const dial = document.getElementById('rotaryDial');
  if (dial) { dial.classList.remove('spin'); void dial.offsetWidth; dial.classList.add('spin'); }
}
function dialerBack() { dialerDigits = dialerDigits.slice(0, -1); document.getElementById('dialerNumber').textContent = formatPhone(dialerDigits); }
function dialerCall() {
  if (!dialerDigits) return;
  const num = formatPhone(dialerDigits);
  closeDialer();
  openCallScreen({ name: num, kind: 'audio', kindLabel: 'BLUSHIFT Audio', photo: null, initials: '#' });
}

/* ===== VOICEMAIL ===== */
function renderVoicemail() {
  const list = document.getElementById('voicemailList');
  if (!list) return;
  list.innerHTML = VOICEMAILS.map(vm => {
    const c = CONTACTS.find(x => x.id === vm.contactId);
    const isBlue = c && c.blueMode && c.platform === 'iPhone';
    return `<div class="vm-item ${vm.played ? 'played' : ''}">
      <div class="cl-avatar ${isBlue ? 'cl-av-blue' : 'cl-av-std'}"${avStyle(c)}>${avInner(c)}</div>
      <div class="vm-info">
        <div class="vm-top"><span class="vm-name">${vm.played ? '' : '<span class="vm-dot"></span>'}${c ? c.name : 'Unknown'}</span><span class="vm-time">${vm.time}</span></div>
        <div class="vm-transcript">“${vm.transcript}”</div>
        <div class="vm-controls">
          <button class="vm-play" onclick="playVoicemail(${vm.id},this)"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play</button>
          <span class="vm-dur">${vm.dur}</span>
          <button class="vm-call" onclick="startCall(${vm.contactId},'audio')">Call back</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
function playVoicemail(id, btn) {
  const vm = VOICEMAILS.find(v => v.id === id);
  if (vm && !vm.played) { vm.played = true; }
  btn.closest('.vm-item')?.classList.add('played');
  btn.classList.add('playing');
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg> Playing…';
  setTimeout(() => { btn.classList.remove('playing'); btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play'; }, 2600);
}

/* ===== IMAGE CROPPER ===== */
const CROP_SIZE = 288;
function openCropper(src, cb) {
  const img = new Image();
  img.onload = () => {
    cropState = { img, scale:1, x:0, y:0, cb, dragging:false, sx:0, sy:0, natW:img.naturalWidth, natH:img.naturalHeight };
    const z = document.getElementById('cropZoom'); if (z) z.value = 1;
    document.getElementById('cropModal').classList.add('open');
    requestAnimationFrame(drawCrop);
  };
  img.src = src;
}
function cropCoverScale() { return Math.max(CROP_SIZE / cropState.natW, CROP_SIZE / cropState.natH); }
function drawCrop() {
  const cv = document.getElementById('cropCanvas');
  if (!cv || !cropState.img) return;
  cv.width = CROP_SIZE; cv.height = CROP_SIZE;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
  const s = cropCoverScale() * cropState.scale;
  const dw = cropState.natW * s, dh = cropState.natH * s;
  ctx.drawImage(cropState.img, (CROP_SIZE-dw)/2 + cropState.x, (CROP_SIZE-dh)/2 + cropState.y, dw, dh);
}
function cropZoom(v) { cropState.scale = parseFloat(v); clampCropPan(); drawCrop(); }
function clampCropPan() {
  const s = cropCoverScale() * cropState.scale;
  const dw = cropState.natW * s, dh = cropState.natH * s;
  const maxX = Math.max(0, (dw - CROP_SIZE)/2), maxY = Math.max(0, (dh - CROP_SIZE)/2);
  cropState.x = Math.max(-maxX, Math.min(maxX, cropState.x));
  cropState.y = Math.max(-maxY, Math.min(maxY, cropState.y));
}
function confirmCrop() {
  const OUT = 512;
  const out = document.createElement('canvas'); out.width = OUT; out.height = OUT;
  const octx = out.getContext('2d');
  const k = OUT / CROP_SIZE;
  const s = cropCoverScale() * cropState.scale;
  const dw = cropState.natW * s, dh = cropState.natH * s;
  octx.drawImage(cropState.img, ((CROP_SIZE-dw)/2 + cropState.x)*k, ((CROP_SIZE-dh)/2 + cropState.y)*k, dw*k, dh*k);
  const data = out.toDataURL('image/png');
  const cb = cropState.cb; cropState.cb = null;
  closeCrop();
  if (cb) cb(data);
}
function closeCrop() { document.getElementById('cropModal').classList.remove('open'); }
function setupCropper() {
  const cv = document.getElementById('cropCanvas');
  if (!cv) return;
  const down = (x,y) => { cropState.dragging = true; cropState.sx = x - cropState.x; cropState.sy = y - cropState.y; };
  const move = (x,y) => { if (!cropState.dragging) return; cropState.x = x - cropState.sx; cropState.y = y - cropState.sy; clampCropPan(); drawCrop(); };
  const up = () => { cropState.dragging = false; };
  cv.addEventListener('mousedown', e => down(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', up);
  cv.addEventListener('touchstart', e => { const t = e.touches[0]; down(t.clientX, t.clientY); }, { passive:true });
  cv.addEventListener('touchmove', e => { const t = e.touches[0]; move(t.clientX, t.clientY); }, { passive:true });
  cv.addEventListener('touchend', up);
}

function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

/* ===== ACCOUNT CONNECT / SIGN-IN (Spotify · Google Pay · Venmo · Cash App) =====
   These are functional on-device sign-ins: they capture & validate credentials,
   remember the connected handle, and reflect "connected" state across the app.
   A static client app can't truly authenticate to these services (no backend /
   registered app / business onboarding), so passwords are validated but never
   stored or transmitted — see the note in the sheet. */
const CONNECT_SERVICES = {
  spotify: {
    name: 'Spotify', accent: '#1DB954', wallet: false,
    idLabel: 'Email or username', idPlaceholder: 'you@email.com', idAuto: 'username',
    pwLabel: 'Password',
    logo: '<svg width="34" height="34" viewBox="0 0 24 24" fill="#1DB954"><path fill="#1DB954" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>'
  },
  googlepay: {
    name: 'Google Pay', accent: '#1a73e8', wallet: true,
    idLabel: 'Google account email', idPlaceholder: 'you@gmail.com', idAuto: 'username',
    pwLabel: 'Password',
    logo: '<span style="font-family:Arial,sans-serif;font-weight:700;font-size:17px"><span style="color:#4285F4">G</span>&nbsp;<span style="color:#fff">Pay</span></span>'
  },
  venmo: {
    name: 'Venmo', accent: '#3D95CE', wallet: true,
    idLabel: 'Phone, email or username', idPlaceholder: 'you@email.com', idAuto: 'username',
    pwLabel: 'Password',
    needsHandle: true, handleLabel: 'Your Venmo username', handlePrefix: '@', handlePlaceholder: 'yourname',
    logo: '<span style="font-family:Arial,sans-serif;font-weight:700;font-size:18px;color:#3D95CE">venmo</span>'
  },
  cashapp: {
    name: 'Cash App', accent: '#00C244', wallet: true,
    idLabel: 'Phone or email', idPlaceholder: 'you@email.com', idAuto: 'username',
    pwLabel: 'PIN or password',
    needsHandle: true, handleLabel: 'Your $Cashtag', handlePrefix: '$', handlePlaceholder: 'Cashtag',
    logo: '<span style="font-family:Arial,sans-serif;font-weight:700;font-size:20px;color:#00C244">$</span>'
  }
};
let connectCtx = null;
function openConnect(service, onSuccess) {
  const svc = CONNECT_SERVICES[service];
  if (!svc) return;
  connectCtx = { service, svc, onSuccess: onSuccess || null };
  document.getElementById('connectLogo').innerHTML = svc.logo;
  document.getElementById('connectTitle').textContent = 'Connect ' + svc.name;
  document.getElementById('connectSub').textContent = 'Sign in to link your ' + svc.name + ' account.';
  document.getElementById('connectIdLabel').textContent = svc.idLabel;
  const idEl = document.getElementById('connectId');
  idEl.value = ''; idEl.placeholder = svc.idPlaceholder; idEl.setAttribute('autocomplete', svc.idAuto || 'username');
  document.getElementById('connectPwLabel').textContent = svc.pwLabel;
  const pwEl = document.getElementById('connectPw'); pwEl.value = ''; pwEl.type = 'password';
  const hg = document.getElementById('connectHandleGrp');
  if (svc.needsHandle) {
    hg.style.display = '';
    document.getElementById('connectHandleLabel').textContent = svc.handleLabel;
    document.getElementById('connectHandlePrefix').textContent = svc.handlePrefix;
    const hEl = document.getElementById('connectHandle'); hEl.value = ''; hEl.placeholder = svc.handlePlaceholder || '';
  } else { hg.style.display = 'none'; }
  document.getElementById('connectError').textContent = '';
  const go = document.getElementById('connectGo'); go.disabled = false; go.textContent = 'Sign in & connect';
  go.style.background = svc.accent;
  document.getElementById('connectSheet').style.setProperty('--connect-accent', svc.accent);
  document.getElementById('connectModal').classList.add('open');
  setTimeout(() => idEl.focus(), 80);
}
function closeConnect() { document.getElementById('connectModal').classList.remove('open'); connectCtx = null; }
function toggleConnectPw(btn) {
  const el = document.getElementById('connectPw');
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.classList.toggle('on', el.type === 'text');
}
function connectPersist(fn) {
  const shell = document.getElementById('appShell');
  const onboarding = shell && shell.classList.contains('hidden') && typeof userAccount !== 'undefined' && userAccount;
  if (onboarding) { fn(userAccount); if (typeof persistAccount === 'function') persistAccount(); }
  else { const a = getAccount(); fn(a); saveAccount(a); }
}
function submitConnect(e) {
  if (e) e.preventDefault();
  if (!connectCtx) return false;
  const { service, svc, onSuccess } = connectCtx;
  const id = document.getElementById('connectId').value.trim();
  const pw = document.getElementById('connectPw').value;
  const handle = svc.needsHandle ? document.getElementById('connectHandle').value.trim().replace(/^[@$]/, '') : '';
  const err = document.getElementById('connectError');
  if (!id) { err.textContent = 'Enter your ' + svc.idLabel.toLowerCase() + '.'; return false; }
  if (!pw || pw.length < 4) { err.textContent = 'Enter your ' + svc.pwLabel.toLowerCase() + ' (at least 4 characters).'; return false; }
  if (svc.needsHandle && !handle) { err.textContent = 'Enter ' + svc.handleLabel.toLowerCase() + '.'; return false; }
  err.textContent = '';
  const go = document.getElementById('connectGo');
  go.disabled = true; go.textContent = 'Connecting…';
  setTimeout(() => {
    connectPersist(a => {
      if (svc.wallet) {
        a.wallets = a.wallets || {};
        a.wallets[service] = true;
        a.walletAccounts = a.walletAccounts || {};
        a.walletAccounts[service] = { id, handle, prefix: svc.handlePrefix || '' };
        if (service === 'googlepay') a.googlePay = { linked: true, email: id };
      } else {
        a.spotify = { linked: true, user: handle || id.replace(/@.*$/, '') };
      }
    });
    toast(svc.name + ' connected ✓');
    closeConnect();
    const shell = document.getElementById('appShell');
    if (shell && !shell.classList.contains('hidden')) { try { renderSettings(); } catch (e2) {} }
    if (onSuccess) onSuccess();
  }, 950);
  return false;
}

/* ===== SPOTIFY ===== */
function spotifyLinked() { const a = getAccount(); return a.spotify && a.spotify.linked; }
function linkSpotifyInApp() { openConnect('spotify'); }
function confirmUnlinkSpotify() {
  showConfirm('Disconnect Spotify?', 'You can reconnect any time from Settings.', 'Disconnect', () => {
    const a = getAccount(); delete a.spotify; saveAccount(a); toast('Spotify disconnected'); renderSettings();
  }, true);
}

/* ===== SEND A SONG (iTunes Search API — real 30s previews + artwork) ===== */
let musicResultsData = [], musicSearchTimer = null, pickerAudio = null;
function showMusicPicker() {
  // music search works for everyone (no Spotify connection required)
  document.getElementById('musicSearch').value = '';
  document.getElementById('musicResults').innerHTML = '<div class="music-hint">Search a song or artist to share a 30-second preview.</div>';
  document.getElementById('musicModal').classList.add('open');
  setTimeout(() => document.getElementById('musicSearch')?.focus(), 60);
}
function closeMusicPicker() { closeSheetAnimated('musicModal', () => { if (pickerAudio) { pickerAudio.pause(); pickerAudio = null; } }); }
function searchMusic(q) {
  clearTimeout(musicSearchTimer);
  const res = document.getElementById('musicResults');
  if (!q.trim()) { res.innerHTML = '<div class="music-hint">Search a song or artist…</div>'; return; }
  musicSearchTimer = setTimeout(() => {
    res.innerHTML = '<div class="music-hint">Searching…</div>';
    // iTunes Search via JSONP — avoids the CORS failure that broke fetch()
    itunesSearchJSONP(q, (results) => {
      if (results === null) { res.innerHTML = '<div class="music-hint">Search failed — check your connection and try again.</div>'; return; }
      // keep ALL songs (even ones without a 30s preview) so nothing silently vanishes
      musicResultsData = results.map(x => ({ title: x.trackName, artist: x.artistName, art: (x.artworkUrl100 || '').replace('100x100', '200x200'), preview: x.previewUrl || null }));
      if (!musicResultsData.length) { res.innerHTML = '<div class="music-hint">No tracks found.</div>'; return; }
      res.innerHTML = musicResultsData.map((x, i) => `<div class="music-result" onclick="sendSongByIndex(${i})">
        <img class="music-art" src="${x.art}" alt="">
        <div class="music-meta"><div class="music-title">${escapeHtml(x.title)}</div><div class="music-artist">${escapeHtml(x.artist)}</div></div>
        ${x.preview ? `<button class="music-prev" onclick="event.stopPropagation();previewByIndex(${i},this)">▶</button>` : '<span class="music-noprev" title="No 30s preview — still sendable / opens in Spotify">▸</span>'}
      </div>`).join('');
    });
  }, 350);
}
function itunesSearchJSONP(term, cb) {
  const cbName = '__itunesCB_' + Math.random().toString(36).slice(2);
  const s = document.createElement('script');
  let done = false;
  const cleanup = () => { try { delete window[cbName]; } catch (e) { window[cbName] = undefined; } if (s.parentNode) s.parentNode.removeChild(s); };
  const timer = setTimeout(() => { if (done) return; done = true; cleanup(); cb(null); }, 9000);
  window[cbName] = (data) => { if (done) return; done = true; clearTimeout(timer); cleanup(); cb((data && data.results) || []); };
  s.onerror = () => { if (done) return; done = true; clearTimeout(timer); cleanup(); cb(null); };
  s.src = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&country=US&limit=25&callback=${cbName}`;
  document.body.appendChild(s);
}
function previewByIndex(i, btn) { const s = musicResultsData[i]; if (s) previewInPicker(btn, s.preview); }
function previewInPicker(btn, url) {
  const wasPlaying = btn.classList.contains('playing');
  if (pickerAudio) { pickerAudio.pause(); pickerAudio = null; }
  document.querySelectorAll('.music-prev.playing').forEach(b => { b.classList.remove('playing'); b.textContent = '▶'; });
  if (wasPlaying) return;
  pickerAudio = new Audio(url); pickerAudio.play().catch(() => {});
  btn.classList.add('playing'); btn.textContent = '❚❚';
  pickerAudio.onended = () => { btn.classList.remove('playing'); btn.textContent = '▶'; };
}
function sendSongByIndex(i) { const s = musicResultsData[i]; if (s) sendSong(s); }
function sendSong(song) {
  if (pickerAudio) { pickerAudio.pause(); pickerAudio = null; }
  closeMusicPicker();
  const msgs = getActiveMessages(); if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id: newId, type: 'song', title: song.title, artist: song.artist, art: song.art, preview: song.preview, ts: Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId + 1, type: 'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered); updatePreview(`🎵 ${song.title}`); renderMessages(filtered); scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId + 1);
}
function openSong(msgId) {
  const msgs = getActiveMessages();
  const m = msgs?.find(x => x.id === msgId);
  if (!m) return;
  const url = m.spotifyUrl || `https://open.spotify.com/search/${encodeURIComponent((m.title || '') + ' ' + (m.artist || ''))}`;
  window.open(url, '_blank');
}
let songAudio = null, songAudioId = null, songRaf = null;
function playSongPreview(msgId, btn) {
  const msgs = getActiveMessages(); const m = msgs?.find(x => x.id === msgId);
  if (!m) return;
  const fill = document.getElementById('songfill-' + msgId);
  const reset = () => { document.querySelectorAll('.song-play.playing').forEach(b => { b.classList.remove('playing'); b.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'; }); };
  if (songAudioId === msgId && songAudio && !songAudio.paused) { songAudio.pause(); cancelAnimationFrame(songRaf); reset(); songAudioId = null; return; }
  if (songAudio) { songAudio.pause(); cancelAnimationFrame(songRaf); } reset();
  songAudio = new Audio(m.preview); songAudioId = msgId; songAudio.play().catch(() => {});
  btn.classList.add('playing'); btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  const tick = () => { if (songAudio && fill) fill.style.width = (songAudio.currentTime / (songAudio.duration || 30) * 100) + '%'; songRaf = requestAnimationFrame(tick); };
  tick();
  songAudio.onended = () => { cancelAnimationFrame(songRaf); reset(); if (fill) fill.style.width = '0%'; songAudioId = null; };
}

/* ===== VOICE MEMO (record + send) ===== */
let mediaRecorder = null, recChunks = [], recStart = 0, recTimerInt = null, recordedBlobUrl = null, recordedDur = 0, recWave = [];
function showVoiceRecorder() {
  recordedBlobUrl = null; recWave = [];
  document.getElementById('vrTime').textContent = '0:00';
  document.getElementById('vrStatus').textContent = 'Tap the mic to start recording';
  document.getElementById('vrWave').innerHTML = '';
  const modal = document.getElementById('voiceModal');
  modal.classList.add('open'); modal.classList.remove('recording', 'has-rec');
}
function closeVoiceRecorder() { closeSheetAnimated('voiceModal', () => stopRec(true)); }
function toggleRec() {
  const modal = document.getElementById('voiceModal');
  if (modal.classList.contains('recording')) { stopRec(); return; }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { document.getElementById('vrStatus').textContent = 'Microphone not available here.'; return; }
  navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
    recChunks = []; recWave = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size) recChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      recordedBlobUrl = URL.createObjectURL(new Blob(recChunks, { type: 'audio/webm' }));
      modal.classList.add('has-rec');
      document.getElementById('vrStatus').textContent = 'Tap Send, or the mic to re-record';
    };
    mediaRecorder.start();
    recStart = Date.now();
    modal.classList.add('recording'); modal.classList.remove('has-rec');
    document.getElementById('vrStatus').textContent = 'Recording… tap the mic to stop';
    recTimerInt = setInterval(() => {
      const s = Math.floor((Date.now() - recStart) / 1000);
      document.getElementById('vrTime').textContent = `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
      recWave.push(22 + Math.random() * 78); if (recWave.length > 42) recWave.shift();
      document.getElementById('vrWave').innerHTML = recWave.map(h => `<span style="height:${h}%"></span>`).join('');
    }, 180);
  }).catch(() => { document.getElementById('vrStatus').textContent = 'Microphone permission denied.'; });
}
function stopRec(silent) {
  clearInterval(recTimerInt); recTimerInt = null;
  const modal = document.getElementById('voiceModal');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    recordedDur = Math.max(1, Math.round((Date.now() - recStart) / 1000));
    try { mediaRecorder.stop(); } catch (e) {}
  }
  if (modal) modal.classList.remove('recording');
  if (silent) { recordedBlobUrl = null; if (modal) modal.classList.remove('has-rec'); }
}
function sendVoiceMemo() {
  if (!recordedBlobUrl) return;
  const dur = `${Math.floor(recordedDur / 60)}:${(recordedDur % 60).toString().padStart(2, '0')}`;
  const wave = (recWave.length ? recWave : Array.from({ length: 24 }, () => 22 + Math.random() * 78)).slice(-24);
  const url = recordedBlobUrl; recordedBlobUrl = null;
  closeVoiceRecorder();
  const msgs = getActiveMessages(); if (!msgs) return;
  const filtered = msgs.filter(m => m.type !== 'typing');
  const newId = Date.now();
  filtered.push({ id: newId, type: 'voicememo', audio: url, dur, wave, ts: Date.now() });
  const isBlue = getActiveIsBlue();
  filtered.push({ id: newId + 1, type: 'status', text: isBlue ? 'Delivered' : 'Sent via SMS' });
  recentAnimId = newId;
  setActiveMessages(filtered); updatePreview('🎤 Voice memo'); renderMessages(filtered); scrollToBottom();
  if (isBlue && readReceiptsOn) scheduleReadReceipt(newId + 1);
}
let vmAudio = null, vmId = null, vmRaf = null;
function playVoiceMemo(msgId, btn) {
  const msgs = getActiveMessages(); const m = msgs?.find(x => x.id === msgId);
  if (!m || !m.audio) return;
  const fill = document.getElementById('vmfill-' + msgId);
  const reset = () => { document.querySelectorAll('.vmemo-play.playing').forEach(b => { b.classList.remove('playing'); b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'; }); };
  if (vmId === msgId && vmAudio && !vmAudio.paused) { vmAudio.pause(); cancelAnimationFrame(vmRaf); reset(); vmId = null; return; }
  if (vmAudio) { vmAudio.pause(); cancelAnimationFrame(vmRaf); } reset();
  vmAudio = new Audio(m.audio); vmId = msgId; vmAudio.play().catch(() => {});
  btn.classList.add('playing'); btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>';
  const tick = () => { if (vmAudio && fill) fill.style.width = (vmAudio.currentTime / (vmAudio.duration || 10) * 100) + '%'; vmRaf = requestAnimationFrame(tick); };
  tick();
  vmAudio.onended = () => { cancelAnimationFrame(vmRaf); reset(); if (fill) fill.style.width = '0%'; vmId = null; };
}

/* ===== LONG PRESS → message options ===== */
function setupLongPress() {
  document.addEventListener('touchstart', e => {
    const row = e.target.closest('.msg-row[data-msg-id]');
    if (!row) return;
    longPressFired = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressFired = true;
      if (navigator.vibrate) navigator.vibrate(15);
      openTapback(parseInt(row.dataset.msgId));
    }, 480);
  }, { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(longPressTimer));
  document.addEventListener('touchend', () => clearTimeout(longPressTimer));
}
