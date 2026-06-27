/* ============================================================
   BLUSHIFT real auth: Spotify OAuth (PKCE) + EmailJS email codes.
   All gated on BLUSHIFT_CONFIG — empty config => demo fallback.
   ============================================================ */
function _cfg() { return window.BLUSHIFT_CONFIG || {}; }
function spotifyConfigured() { return !!_cfg().spotifyClientId; }
function emailjsConfigured() { const e = _cfg().emailjs || {}; return !!(e.serviceId && e.templateId && e.publicKey); }

/* ---------- PKCE helpers ---------- */
function _b64url(buf) { return btoa(String.fromCharCode.apply(null, new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function _randStr(n) { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => ('0' + b.toString(16)).slice(-2)).join(''); }
async function _sha256(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); }
function spotifyRedirectUri() { return location.origin + location.pathname; }   // must be registered in the Spotify app

/* ---------- Spotify sign-in ---------- */
async function spotifyLogin() {
  if (!spotifyConfigured()) return false;
  const verifier = _randStr(48);
  const challenge = _b64url(await _sha256(verifier));
  sessionStorage.setItem('bs_sp_verifier', verifier);
  const params = new URLSearchParams({
    client_id: _cfg().spotifyClientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: 'user-read-email user-read-private'
  });
  location.href = 'https://accounts.spotify.com/authorize?' + params.toString();
  return true;
}
async function handleSpotifyRedirect() {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const verifier = sessionStorage.getItem('bs_sp_verifier');
  if (!code || !verifier || !spotifyConfigured()) return;
  history.replaceState({}, '', location.pathname);   // strip ?code=... from the URL
  try {
    const body = new URLSearchParams({
      client_id: _cfg().spotifyClientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: spotifyRedirectUri(),
      code_verifier: verifier
    });
    const tok = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body
    }).then(r => r.json());
    sessionStorage.removeItem('bs_sp_verifier');
    if (!tok.access_token) return;
    const prof = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: 'Bearer ' + tok.access_token } }).then(r => r.json());
    const a = (typeof getAccount === 'function') ? getAccount() : {};
    a.spotify = { linked: true, real: true, user: prof.display_name || prof.id || 'spotify', email: prof.email || '' };
    if (typeof saveAccount === 'function') saveAccount(a);
    if (typeof toast === 'function') toast('Spotify connected as ' + (prof.display_name || prof.id || 'you') + ' ✓');
    if (typeof closeConnect === 'function') closeConnect();
    if (typeof renderSettings === 'function') { const sv = document.getElementById('viewSettings'); if (sv && sv.classList.contains('active')) renderSettings(); }
  } catch (e) { /* swallow */ }
}

/* ---------- EmailJS verification code ---------- */
async function sendEmailCode(toEmail, code) {
  if (!emailjsConfigured() || !window.emailjs) return false;
  const e = _cfg().emailjs;
  try {
    await emailjs.send(e.serviceId, e.templateId, { to_email: toEmail, email: toEmail, code: code, passcode: code }, { publicKey: e.publicKey });
    return true;
  } catch (err) { return false; }
}

/* run the Spotify callback handler as soon as the page loads */
document.addEventListener('DOMContentLoaded', () => { try { handleSpotifyRedirect(); } catch (e) {} });
