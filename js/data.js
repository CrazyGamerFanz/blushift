/* ============================================
   BLUSHIFT Beta v0.3 — Data Store
   ============================================ */

const APP_VERSION = 'Beta V1';
const TRIAL_DAYS = 3;

const THEMES = [
  { id:'arctic',   name:'Default' },
  { id:'cyan',     name:'Cyan' },
  { id:'blue',     name:'Blue' },
  { id:'green',    name:'Green' },
  { id:'cyberpunk',name:'Cyber' },
  { id:'sunset',   name:'Sunset' },
  { id:'stealth',  name:'Stealth' },
  { id:'glass',    name:'Glass' },
];

const BACKGROUNDS = [
  { id:'default', name:'Default', css:'none' },
  { id:'grid',    name:'Grid',    css:'linear-gradient(var(--grid-c) 1px,transparent 1px),linear-gradient(90deg,var(--grid-c) 1px,transparent 1px)' },
  { id:'dots',    name:'Dots',    css:'radial-gradient(circle,var(--grid-c) 1px,transparent 1px)' },
];

const PLANS = [
  {
    id:'basic', name:'BASIC', price:'2.99', features:[
      'Blue Bubble Mode (1:1 chats)',
      'Read Receipts',
      'Typing Indicators',
      'Standard media (compressed)',
      '3 Blue Bubble contacts max',
    ]
  },
  {
    id:'pro', name:'PRO', price:'5.99', recommended:true, features:[
      'Everything in Basic',
      'Unlimited Blue Bubble contacts',
      'Group Chat Integration',
      'HD Media Bridge (4K support)',
      'Reaction Parity (Tapbacks)',
      'Priority relay routing',
      'Instant Translation',
      'Polls & Location Sharing',
    ]
  },
  {
    id:'ultra', name:'ULTRA', price:'9.99', features:[
      'Everything in Pro',
      'Identity Vault (multi-device)',
      'Privacy Console (advanced)',
      'Custom bubble styling',
      'Dedicated relay node',
      'Zero-latency priority',
      'Early access to features',
      'Custom text effects',
    ]
  },
];

const CONTACTS = [
  { id:1,  name:'Jordan M.',    initials:'JM', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 234-5678', address:'', notes:'' },
  { id:2,  name:'Sam K.',       initials:'SK', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 345-6789', address:'', notes:'' },
  { id:3,  name:'Alex Rivera',  initials:'AR', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 456-7890', address:'', notes:'' },
  { id:4,  name:'Taylor N.',    initials:'TN', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 567-8901', address:'', notes:'' },
  { id:5,  name:'Morgan L.',    initials:'ML', platform:'Android', blueMode:false, known:true, phone:'+1 (555) 678-9012', address:'', notes:'' },
  { id:6,  name:'Casey W.',     initials:'CW', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 789-0123', address:'', notes:'' },
  { id:7,  name:'Drew P.',      initials:'DP', platform:'iPhone',  blueMode:false, known:true, phone:'+1 (555) 890-1234', address:'', notes:'' },
  { id:8,  name:'Riley Chen',   initials:'RC', platform:'iPhone',  blueMode:true,  known:true, phone:'+1 (555) 901-2345', address:'', notes:'' },
  { id:9,  name:'Unknown',      initials:'??', platform:'iPhone',  blueMode:false, known:false, phone:'', address:'', notes:'' },
];

CONTACTS.forEach(c => { if (c.pfp === undefined) c.pfp = null; });

const GROUPS = [
  {
    id: 'g1',
    name: 'Weekend Trip 🏖️',
    members: [1,2,3],
    photo: null,
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Today 10:00 AM</b>' },
      { id:2, type:'recv', from:1, text:'alright who\'s driving?' },
      { id:3, type:'recv', from:2, text:'I can drive — got my mom\'s SUV' },
      { id:4, type:'sent', text:'perfect I\'ll bring the cooler', ts:Date.now()-60000 },
      { id:5, type:'status', text:'Delivered' },
      { id:6, type:'recv', from:3, text:'wait what time are we leaving?' },
      { id:7, type:'sent', text:'Sam said 7am sharp', ts:Date.now()-30000 },
      { id:8, type:'status', text:'Read 10:05 AM' },
    ],
    preview: 'Sam said 7am sharp',
    time: '10:06 AM',
    unread: 3,
    lastSender: 'You',
  },
  {
    id: 'g2',
    name: 'Project Team',
    members: [4,8],
    photo: null,
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Yesterday 3:00 PM</b>' },
      { id:2, type:'recv', from:4, text:'deadline pushed to next Monday' },
      { id:3, type:'recv', from:8, text:'thank god lol' },
      { id:4, type:'sent', text:'nice — I\'ll use the extra time to polish the UI', ts:Date.now()-86400000 },
      { id:5, type:'status', text:'Delivered' },
    ],
    preview: 'nice — I\'ll use the extra time to polish the UI',
    time: 'Yesterday',
    unread: 0,
    lastSender: 'You',
  },
];

const CONVERSATIONS = {};

function initConversations() {
  CONVERSATIONS[1] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Today 9:38 AM</b>' },
      { id:2, type:'recv', text:'yo are you in for the trip this weekend? group chat got reshuffled', ts:Date.now()-300000 },
      { id:3, type:'recv', text:'also did Sam send you the address?', ts:Date.now()-280000 },
      { id:4, type:'sent', text:"yeah I'm in — just got the new spot. sending now", reaction:'❤️', ts:Date.now()-200000 },
      { id:5, type:'status', text:'Delivered' },
      { id:6, type:'sent', text:'📍 Pier 41 · 7:30 PM', ts:Date.now()-180000 },
      { id:7, type:'status', text:'Read 9:40 AM' },
      { id:8, type:'typing' },
    ],
    preview: 'yo are you in for the trip this weekend?',
    time: '9:41 AM', unread: 2,
  };
  CONVERSATIONS[2] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Today 8:15 AM</b>' },
      { id:2, type:'recv', text:'hey did you get the itinerary I sent last night?', ts:Date.now()-600000 },
      { id:3, type:'sent', text:'yeah looks great! pier 41 right?', ts:Date.now()-580000 },
      { id:4, type:'status', text:'Read 8:20 AM' },
      { id:5, type:'recv', text:'yep. bring sunscreen lol', ts:Date.now()-550000 },
      { id:6, type:'sent', text:'😎 on it', reaction:'👍', ts:Date.now()-540000 },
      { id:7, type:'status', text:'Delivered' },
    ],
    preview: 'yep. bring sunscreen lol',
    time: '8:22 AM', unread: 0,
  };
  CONVERSATIONS[3] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Yesterday 6:45 PM</b>' },
      { id:2, type:'sent', text:'Alex have you tried the new sushi place on Market St?', ts:Date.now()-86400000 },
      { id:3, type:'status', text:'Delivered' },
      { id:4, type:'recv', text:'omg yes!! the salmon was incredible', ts:Date.now()-86300000 },
      { id:5, type:'recv', text:'we should go again this weekend', ts:Date.now()-86200000 },
      { id:6, type:'sent', text:"I'm down. Saturday work?", reaction:'❤️', ts:Date.now()-86100000 },
      { id:7, type:'status', text:'Read 6:52 PM' },
      { id:8, type:'recv', text:'jaja sí! gracias, hablamos mañana 🙌', ts:Date.now()-86000000 },
    ],
    preview: 'jaja sí! gracias, hablamos mañana 🙌',
    time: 'Yesterday', unread: 1,
  };
  CONVERSATIONS[4] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Today 7:00 AM</b>' },
      { id:2, type:'recv', text:'meeting moved to 3pm heads up', ts:Date.now()-900000 },
      { id:3, type:'sent', text:'thanks for the heads up 🙏', ts:Date.now()-880000 },
      { id:4, type:'status', text:'Delivered' },
    ],
    preview: 'meeting moved to 3pm heads up',
    time: '7:02 AM', unread: 0,
  };
  CONVERSATIONS[5] = {
    messages: [
      { id:1, type:'timestamp', text:'SMS · <b>Today 10:12 AM</b>' },
      { id:2, type:'recv', text:'yo check your email I forwarded something', ts:Date.now()-100000 },
      { id:3, type:'sent', text:'got it thanks!', ts:Date.now()-90000 },
      { id:4, type:'status', text:'Sent via SMS' },
    ],
    preview: 'yo check your email I forwarded something',
    time: '10:14 AM', unread: 1,
  };
  CONVERSATIONS[6] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Mon 4:30 PM</b>' },
      { id:2, type:'sent', text:'Casey you still have my charger?', ts:Date.now()-172800000 },
      { id:3, type:'status', text:'Read 4:35 PM' },
      { id:4, type:'recv', text:"oh yeah my bad lol. I'll bring it tomorrow", ts:Date.now()-172700000 },
      { id:5, type:'sent', text:'no rush 👍', ts:Date.now()-172600000 },
      { id:6, type:'status', text:'Delivered' },
    ],
    preview: "oh yeah my bad lol. I'll bring it tomorrow",
    time: 'Mon', unread: 0,
  };
  CONVERSATIONS[7] = {
    messages: [
      { id:1, type:'timestamp', text:'SMS · <b>Last Week</b>' },
      { id:2, type:'recv', text:'are you coming to the game on Friday?', ts:Date.now()-604800000 },
      { id:3, type:'sent', text:'for sure! what time?', ts:Date.now()-604700000 },
      { id:4, type:'status', text:'Sent via SMS' },
      { id:5, type:'recv', text:'gates open at 6', ts:Date.now()-604600000 },
    ],
    preview: 'gates open at 6',
    time: 'Last Fri', unread: 0,
  };
  CONVERSATIONS[8] = {
    messages: [
      { id:1, type:'timestamp', text:'iMessage · <b>Today 11:30 AM</b>' },
      { id:2, type:'recv', text:'Riley here — quick q about the project deadline', ts:Date.now()-50000 },
      { id:3, type:'recv', text:'is it still next Thursday or did it get pushed?', ts:Date.now()-45000 },
      { id:4, type:'sent', text:'pushed to the following Monday 🙌', ts:Date.now()-40000 },
      { id:5, type:'status', text:'Read 11:35 AM' },
      { id:6, type:'recv', text:'perfect tysm!!', ts:Date.now()-35000 },
    ],
    preview: 'perfect tysm!!',
    time: '11:36 AM', unread: 1,
  };
  CONVERSATIONS[9] = {
    messages: [
      { id:1, type:'timestamp', text:'SMS · <b>Today 12:01 PM</b>' },
      { id:2, type:'recv', text:'Hi, this is a message from an unknown number.', ts:Date.now()-10000 },
    ],
    preview: 'Hi, this is a message from an unknown number.',
    time: '12:01 PM', unread: 1,
  };
}

const TRANSLATIONS = {
  'es': { name:'Spanish', samples:{'hello':'hola','yes':'sí','no':'no','thanks':'gracias','how are you':'cómo estás'} },
  'fr': { name:'French', samples:{'hello':'bonjour','yes':'oui','no':'non','thanks':'merci','how are you':'comment allez-vous'} },
  'de': { name:'German', samples:{'hello':'hallo','yes':'ja','no':'nein','thanks':'danke','how are you':'wie geht es dir'} },
  'ja': { name:'Japanese', samples:{'hello':'こんにちは','yes':'はい','no':'いいえ','thanks':'ありがとう','how are you':'お元気ですか'} },
  'ko': { name:'Korean', samples:{'hello':'안녕하세요','yes':'네','no':'아니요','thanks':'감사합니다','how are you':'어떻게 지내세요'} },
  'zh': { name:'Chinese', samples:{'hello':'你好','yes':'是','no':'不','thanks':'谢谢','how are you':'你好吗'} },
  'ar': { name:'Arabic', samples:{'hello':'مرحبا','yes':'نعم','no':'لا','thanks':'شكرا','how are you':'كيف حالك'} },
  'pt': { name:'Portuguese', samples:{'hello':'olá','yes':'sim','no':'não','thanks':'obrigado','how are you':'como vai você'} },
  'hi': { name:'Hindi', samples:{'hello':'नमस्ते','yes':'हाँ','no':'नहीं','thanks':'धन्यवाद','how are you':'आप कैसे हैं'} },
  'ru': { name:'Russian', samples:{'hello':'привет','yes':'да','no':'нет','thanks':'спасибо','how are you':'как дела'} },
};

const EDIT_WINDOW_MS = 15 * 60 * 1000;

const DEFAULT_FILTERS = ['all','unread','groups','known','iPhone','Android'];

let customFilters = JSON.parse(localStorage.getItem('blushift-filters') || '[]');

const EMOJI_CATEGORIES = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🫡','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴','😵','😵‍💫','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Gestures': ['👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄'],
  'People': ['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🕴️','👯','🧖','🧗','🏇','⛷️','🏂','🏋️','🤸','⛹️','🤺','🤾','🏄','🚣','🧘','🛀','🛌'],
  'Animals': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪰','🪲','🪳','🦟','🦗','🕷️','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃','🐂','🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🦮','🐈','🐈‍⬛','🐓','🦃','🦤','🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦫','🦦','🦥','🐁','🐀','🐿️','🦔'],
  'Food': ['🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🫒','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛','🍼','☕','🫖','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾','🧊'],
  'Travel': ['🚗','🚕','🚙','🚌','🚎','🏎️','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🛵','🏍️','🛺','🚲','🛴','🛹','🛼','🚏','🛣️','🛤️','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','✈️','🛫','🛬','💺','🚀','🛸','🚁','🛶','⛵','🚤','🛥️','🛳️','⛴️','🚢','⚓','🗼','🏰','🏯','🎡','🎢','🎠','⛲','⛱️','🏖️','🏝️','🏔️','⛰️','🌋','🗻','🏕️','🏠','🏡','🏢','🏬','🏣','🏤','🏥','🏦','🏨','🏪','🏫','🏩','💒','🏛️','⛪','🕌','🕍','🛕','🕋'],
  'Objects': ['⌚','📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','🕹️','🗜️','💽','💾','💿','📀','📼','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️','🎛️','🧭','⏱️','⏲️','⏰','🕰️','⌛','⏳','📡','🔋','🪫','🔌','💡','🔦','🕯️','🧯','🪣','🛢️','💸','💵','💴','💶','💷','🪙','💰','💳','💎','⚖️','🪜','🧰','🪛','🔧','🔨','⚒️','🛠️','⛏️','🪚','🔩','⚙️','🪤','🧱','⛓️','🧲','🔫','💣','🧨','🪓','🔪','🗡️','⚔️','🛡️','🚬','⚰️','🪦','⚱️','🏺','🔮','📿','🧿','🪬','💈','⚗️','🔭','🔬','🕳️','🩹','🩺','🩻','🩼','💊','💉','🩸','🧬','🦠','🧫','🧪'],
  'Symbols': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉️','☸️','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷️','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','📛','🚫','💯','💢','♨️','🚷','🚯','🚳','🚱','🔞','📵','🚭','❗','❕','❓','❔','‼️','⁉️','🔅','🔆','〽️','⚠️','🚸','🔱','⚜️','🔰','♻️','✅','🈯','💹','❇️','✳️','❎','🌐','💠','Ⓜ️','🌀','💤','🏧','🚾','♿','🅿️','🛗','🈳','🈂️','🛂','🛃','🛄','🛅'],
  'Flags': ['🏁','🚩','🎌','🏴','🏳️','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇸','🇬🇧','🇫🇷','🇩🇪','🇯🇵','🇰🇷','🇨🇳','🇮🇳','🇧🇷','🇲🇽','🇨🇦','🇦🇺','🇪🇸','🇮🇹','🇷🇺','🇸🇦','🇦🇪','🇹🇷','🇵🇭','🇻🇳','🇹🇭','🇮🇩','🇳🇬','🇿🇦','🇪🇬','🇦🇷','🇨🇴','🇵🇪','🇨🇱'],
};

const STICKER_PACKS = [
  {
    id: 'classic', name: 'Classic',
    stickers: ['😀','😎','🥳','🤩','😍','🤯','🥺','😤','💀','🤡','👻','🔥','💯','✨','❤️','👍','👎','🙌','🤝','💪']
  },
  {
    id: 'animals', name: 'Animals',
    stickers: ['🐶','🐱','🐼','🦊','🐸','🐵','🐰','🐻','🦁','🐷','🐨','🐯','🦄','🐔','🐧','🦋','🐝','🐙','🦈','🐳']
  },
  {
    id: 'food', name: 'Food',
    stickers: ['🍕','🍔','🍟','🌮','🍣','🍩','🍪','🧁','🎂','🍰','☕','🍺','🧋','🍿','🌶️','🥑','🍓','🍉','🍌','🥐']
  },
  {
    id: 'custom', name: 'My Stickers',
    stickers: []
  },
];

/* ===== Emoji packs (switchable in settings) ===== */
const EMOJI_PACKS = [
  { id:'native',    name:'Native',    font:"'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Segoe UI Symbol',sans-serif" },
  { id:'microsoft', name:'Microsoft', font:"'Segoe UI Emoji','Segoe UI Symbol','Noto Color Emoji',sans-serif" },
  { id:'apple',     name:'Apple',     font:"'Apple Color Emoji','Noto Color Emoji','Segoe UI Emoji',sans-serif" },
  { id:'whatsapp',  name:'WhatsApp',  font:"'Noto Color Emoji','Segoe UI Emoji',sans-serif" },
];

/* ===== Billing / payment (demo) ===== */
const PAYMENT_METHODS = [
  { id:'pm1', type:'card', brand:'Visa', last4:'4242', exp:'08/27', icon:'💳', primary:true },
];

/* ===== Wallets (Google Pay / Venmo / Cash App) ===== */
const WALLETS = [
  { id:'googlepay', name:'Google Pay', mark:'<span class="gpay-mark"><b>G</b> Pay</span>', color:'#1a73e8' },
  { id:'venmo',     name:'Venmo',      mark:'<span class="venmo-mark">venmo</span>',        color:'#008cff' },
  { id:'cashapp',   name:'Cash App',   mark:'<span class="cash-mark">$Cash</span>',         color:'#00d632' },
];

/* ===== AI Theme Studio — keyword → base hue map ===== */
const THEME_PALETTES = {
  ocean:200, sea:198, marine:205, sky:205, water:200, aqua:185, teal:175, turquoise:172,
  forest:140, jungle:135, grass:110, leaf:120, mint:160, emerald:150, lime:88, sage:130,
  fire:12, flame:18, lava:8, ember:20, magma:6, sunset:24, orange:30, tangerine:28,
  gold:45, amber:42, sun:48, honey:46, brass:44,
  candy:330, bubblegum:325, pink:335, rose:345, blush:350, peach:20, cherry:350,
  blood:0, red:0, ruby:357, crimson:350, scarlet:5,
  royal:250, purple:275, violet:270, amethyst:282, grape:285, lavender:262, plum:300, orchid:310,
  blue:215, sapphire:220, cobalt:225, navy:226, indigo:240, azure:210, denim:218,
  cyber:300, neon:128, vaporwave:295, synthwave:318, retro:34, arcade:285,
  midnight:230, night:235, dusk:255, shadow:240, eclipse:250, obsidian:230,
  coffee:25, mocha:22, espresso:20, sand:40, desert:38, earth:30, clay:18, bronze:32,
  yellow:52, green:130, cyan:185, magenta:305, fuchsia:320, charcoal:220, slate:215,
  galaxy:265, cosmic:280, nebula:290, aurora:160, ice:195, frost:200, arctic:198,
  toxic:95, venom:105, matrix:125, hacker:130, spring:115, autumn:30, winter:205, summer:48,
};
/* low-saturation / monochrome moods */
const THEME_MUTED = ['stealth','shadow','charcoal','slate','obsidian','noir','mono','grey','gray','minimal','ghost','smoke','ash','steel'];

/* ===== Calls log (demo) ===== */
const CALLS = [
  { id:1, contactId:1, dir:'incoming', kind:'audio', time:'9:42 AM',   missed:false },
  { id:2, contactId:8, dir:'incoming', kind:'video', time:'8:15 AM',   missed:true  },
  { id:3, contactId:4, dir:'outgoing', kind:'audio', time:'Yesterday', missed:false },
  { id:4, contactId:9, dir:'incoming', kind:'audio', time:'Yesterday', missed:true  },
  { id:5, contactId:2, dir:'outgoing', kind:'video', time:'Mon',       missed:false },
  { id:6, contactId:3, dir:'outgoing', kind:'audio', time:'Mon',       missed:false },
  { id:7, contactId:6, dir:'incoming', kind:'audio', time:'Sun',       missed:false },
];

/* ===== Voicemail (demo) ===== */
const VOICEMAILS = [
  { id:1, contactId:1, time:'9:30 AM',   dur:'0:34', played:false, transcript:"Hey it's Jordan — call me back about the trip whenever you get a sec, need to lock in the cars." },
  { id:2, contactId:9, time:'Yesterday', dur:'0:48', played:false, transcript:"This is regarding your vehicle's extended warranty. Press one to speak with a representative…" },
  { id:3, contactId:8, time:'Mon',       dur:'0:22', played:true,  transcript:"Riley here, deadline got pushed so no rush on the deck. Talk soon!" },
];

/* ===== Languages for searchable translate ===== */
const LANGUAGES = Object.entries(TRANSLATIONS).map(([code, l]) => ({ code, name: l.name }));

/* ===== App-wide language picker (shown after boot) ===== */
const APP_LANGUAGES = [
  { code:'en', name:'English',    native:'English',           cc:'us' },
  { code:'es', name:'Spanish',    native:'Español',           cc:'es' },
  { code:'fr', name:'French',     native:'Français',          cc:'fr' },
  { code:'de', name:'German',     native:'Deutsch',           cc:'de' },
  { code:'pt', name:'Portuguese', native:'Português',         cc:'br' },
  { code:'it', name:'Italian',    native:'Italiano',          cc:'it' },
  { code:'ru', name:'Russian',    native:'Русский',           cc:'ru' },
  { code:'ja', name:'Japanese',   native:'日本語',             cc:'jp' },
  { code:'ko', name:'Korean',     native:'한국어',             cc:'kr' },
  { code:'zh', name:'Chinese',    native:'中文',               cc:'cn' },
  { code:'ar', name:'Arabic',     native:'العربية',           cc:'sa' },
  { code:'hi', name:'Hindi',      native:'हिन्दी',             cc:'in' },
  { code:'nl', name:'Dutch',      native:'Nederlands',        cc:'nl' },
  { code:'pl', name:'Polish',     native:'Polski',            cc:'pl' },
  { code:'tr', name:'Turkish',    native:'Türkçe',            cc:'tr' },
  { code:'vi', name:'Vietnamese', native:'Tiếng Việt',        cc:'vn' },
  { code:'th', name:'Thai',       native:'ไทย',               cc:'th' },
  { code:'id', name:'Indonesian', native:'Bahasa Indonesia',  cc:'id' },
  { code:'sv', name:'Swedish',    native:'Svenska',           cc:'se' },
  { code:'el', name:'Greek',      native:'Ελληνικά',          cc:'gr' },
  { code:'he', name:'Hebrew',     native:'עברית',             cc:'il' },
  { code:'uk', name:'Ukrainian',  native:'Українська',        cc:'ua' },
  { code:'fa', name:'Persian',    native:'فارسی',             cc:'ir' },
  { code:'ur', name:'Urdu',       native:'اردو',              cc:'pk' },
];
/* real flag image (Windows shows flag EMOJI as plain "US"/"DE" text, so use images) */
function flagImg(cc) {
  if (!cc) return '';
  return `<img class="lang-flag-img" src="https://flagcdn.com/32x24/${cc}.png" srcset="https://flagcdn.com/64x48/${cc}.png 2x" width="28" height="21" alt="" loading="lazy" onerror="this.style.display='none'">`;
}
const RTL_LANGS = ['ar','he','fa','ur'];
