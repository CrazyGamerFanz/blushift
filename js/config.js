/* ============================================================
   BLUSHIFT integration config
   Fill these in (or paste the values to Claude and they'll be inserted).
   While blank, the app falls back to the built-in demo flow — nothing breaks.
   ============================================================ */
window.BLUSHIFT_CONFIG = {
  // --- Spotify real sign-in (OAuth PKCE) ---
  // 1. Go to https://developer.spotify.com/dashboard  ->  Create app
  // 2. Add these EXACT Redirect URIs in the app settings:
  //       https://crazygamerfanz.github.io/blushift/
  //       https://crazygamerfanz.github.io/blushift/BLUSHIFT%20Beta%20V1.html
  //       https://blushift-rouge.vercel.app/
  //       https://blushift-rouge.vercel.app/BLUSHIFT%20Beta%20V1.html
  // 3. Copy the app's Client ID into the line below.
  spotifyClientId: '4ffacc81b1cd4d4782d0d3562c0c09fd',

  // --- Email verification (EmailJS) ---
  // 1. Create a free account at https://www.emailjs.com
  // 2. Add an Email Service (e.g. Gmail) -> note the Service ID
  // 3. Create an Email Template with variables {{to_email}} and {{code}} -> note the Template ID
  //    (template body should contain the code, e.g. "Your BLUSHIFT code is {{code}}")
  // 4. Account -> General -> copy your Public Key
  emailjs: { serviceId: 'service_j60pejk', templateId: 'template_qtkat18', publicKey: 'vWyuKti4SZdmNXbgN' },
};
