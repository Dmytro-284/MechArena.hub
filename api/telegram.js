'use strict';
// =========================================================
//  MECH ARENA HUB — Telegram Bot
//  Webhook: POST /api/telegram
//  Env: BOT_TOKEN
// =========================================================
const path = require('path');
const fs   = require('fs');

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_BASE  = `https://api.telegram.org/bot${BOT_TOKEN}`;
const SITE_URL  = 'https://mech-arena-hub.vercel.app';
const FOOTER    = `\n\n🌐 <a href="${SITE_URL}">mech-arena-hub.vercel.app</a>`;
const MECHS_PER_PAGE = 10;
const ITEMS_PER_PAGE = 10;

// ─── TELEGRAM HELPERS ────────────────────────────────────
async function api(method, body = {}) {
  const r = await fetch(`${API_BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}
async function send(cid, text, extra = {}) {
  return api('sendMessage', { chat_id:cid, text, parse_mode:'HTML', disable_web_page_preview:true, ...extra });
}
async function edit(cid, mid, text, extra = {}) {
  return api('editMessageText', { chat_id:cid, message_id:mid, text, parse_mode:'HTML', disable_web_page_preview:true, ...extra });
}
async function answerCbq(id, text = '') { return api('answerCallbackQuery', { callback_query_id:id, text }); }

function kbd(...rows) { return { inline_keyboard: rows.filter(r => r && r.length) }; }
function btn(t, cb)   { return { text: t, callback_data: cb }; }
function lnk(t, url)  { return { text: t, url }; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n) { return Number(n).toLocaleString('en-US'); }

// ─── DATA FILE LOADER ────────────────────────────────────
function loadFile(fname, vname) {
  const code = fs.readFileSync(path.join(__dirname, '..', fname), 'utf8');
  return (new Function(code + `\nreturn ${vname};`))();
}
let _cc=null, _cl=null, _pc=null, _mc=null, _ms=null;
function calcCosts()  { return _cc || (_cc = loadFile('calc-data-mech-costs.js',   'CALC_MECH_COSTS'));   }
function calcList()   { return _cl || (_cl = loadFile('calc-data-list.js',          'CALC_LIST'));         }
function pilotCosts() { return _pc || (_pc = loadFile('calc-data-pilot-costs.js',   'CALC_PILOT_COSTS')); }
function modCosts()   { return _mc || (_mc = loadFile('calc-data-mod-costs.js',     'CALC_MOD_COSTS'));    }
function modsList()   { return _ms || (_ms = loadFile('calc-data-mods.js',          'CALC_MODS'));         }

// ─── MECH SHORT KEYS (to fit 64-byte callback_data) ──────
const SHORT = {
  juggernaut:'jugg', slingshot:'slngsht', brickhouse:'brkhs',
  gatecrasher:'gcrshr', dreadnought:'drdnt', deathwalker:'dthwlk',
  silverthorn:'slvthn', blizzfrost:'blzfrs', arachnos:'archns',
  guardian:'grdn', redeemer:'rdmr', sentinel:'sntnl',
  scorpius:'scrps', mimicker:'mmckr', lacewing:'lcwng',
  blockhorn:'blckhm', parasite:'parst', citadel:'ctdl',
};
const LONG = Object.fromEntries(Object.entries(SHORT).map(([k,v])=>[v,k]));
function sk(k) { return SHORT[k] || k; }
function lk(s) { return LONG[s]  || s; }
function encMechs(keys) { return keys.filter(Boolean).map(sk).join(','); }
function decMechs(s)    { return s ? s.split(',').filter(Boolean).map(lk) : []; }

// ─── MECH DATABASE ────────────────────────────────────────
const MECHS = {
  paragon:{n:'Paragon',role:'Attacker',rar:'Common',e:32,spd:18,g:1,sr:1,
    a:{n:'Boost',d:'Redirects power to drive systems for a quick speed burst (~+7 km/h). Useful for capturing points or escaping.'},
    p:['Heavy energy (32E) — any weapon combo','Good starter mech for learning','Decent HP for a common mech'],
    c:['Ability is weak — just a speed burst','Outclassed quickly by every specialist','No unique niche once you progress'],
    rk:{1:{h:9000,e:8},2:{h:15700,e:12},3:{h:24200,e:16},4:{h:35100,e:20},5:{h:48800,e:24},6:{h:66100,e:28},7:{h:85400,e:32}}},
  lancer:{n:'Lancer',role:'Scout',rar:'Common',e:16,spd:25,g:1,sr:1,
    a:{n:'Jump Jets',d:'Activates thrusters to jump over walls and reach rooftops. Allows high-ground advantage and projectile dodging.'},
    p:['Iconic ability — unique vertical movement','Fast (25 km/h) — great for beacon capture','Jump lets you dodge Javelin Racks'],
    c:['Only 16E — very limited weapon choice','Map-dependent — useless without vertical terrain','Easy to kill on the ground'],
    rk:{1:{h:9000,e:4},2:{h:15700,e:6},3:{h:24200,e:8},4:{h:35100,e:10},5:{h:48800,e:12},6:{h:66100,e:14},7:{h:85400,e:16}}},
  juggernaut:{n:'Juggernaut',role:'Tank',rar:'Common',e:24,spd:16,g:2,sr:1,
    a:{n:'Personal Shield',d:'Activates a personal shield that protects the Mech from damage.'},
    p:['2nd highest HP in game','360° shield — no weak flanks','Solid mid-game tank'],
    c:['16 km/h — slowest class','Shield bypassed by Arc Torrents, Rocket Mortars','Outclassed by Aegis and Brickhouse late game'],
    rk:{1:{h:13500,e:6},2:{h:24800,e:8},3:{h:43100,e:12},4:{h:66700,e:16},5:{h:87000,e:18},6:{h:112100,e:20},7:{h:152200,e:24}}},
  md:{n:'M.D.',role:'Support',rar:'Common',e:16,spd:18,g:1,sr:1,
    a:{n:'Repair Field',d:'Repairs damage to all friendly Mechs within the field radius.'},
    p:['Only common healer','Useful in organized team play'],
    c:['16E only — very limited weapons','Replaced by Salvor and Guardian at higher ranks','Bots rarely stand still to be healed'],
    rk:{1:{h:9000,e:4},2:{h:18600,e:6},3:{h:28700,e:8},4:{h:41700,e:10},5:{h:56000,e:12},6:{h:78400,e:14},7:{h:101400,e:16}}},
  puma:{n:'Puma',role:'Attacker',rar:'Uncommon',e:32,spd:22,g:2,sr:2,
    a:{n:'Shield Wall',d:'Deploys a static shield that blocks enemy projectiles until it expires or is destroyed.'},
    p:['Cheap Gear Hub filler for stars'],
    c:['No real niche vs Lancer or Shadow','Skip unless needed for progression'],
    rk:{1:{h:6000,e:8},2:{h:12400,e:12},3:{h:19200,e:16},4:{h:27800,e:20},5:{h:38700,e:24},6:{h:52300,e:28},7:{h:67600,e:32}}},
  slingshot:{n:'Slingshot',role:'Scout',rar:'Uncommon',e:24,spd:25,g:2,sr:2,
    a:{n:'Force Dash',d:'Launches this Mech forward. Colliding with any object creates an AOE Smash that deals damage.'},
    p:['Tied fastest speed (25 km/h)','24E — decent weapon capacity','Good early-game assassin'],
    c:['Outclassed by Killshot and Nomad later','Uncommon tier — limited ceiling'],
    rk:{1:{h:6000,e:6},2:{h:11000,e:8},3:{h:19200,e:12},4:{h:29600,e:16},5:{h:38700,e:18},6:{h:49800,e:20},7:{h:67600,e:24}}},
  panther:{n:'Panther',role:'Attacker',rar:'Epic',e:32,spd:20,g:4,sr:3,
    a:{n:'Stasis Barrier',d:'Deploys a barrier that blocks bullets and applies a Stasis Effect to enemies that enter.'},
    p:['32E — heaviest loadout possible','Stasis Barrier uniquely powerful — blocks shots AND counters snipers','Great backline anchor'],
    c:['Ability requires positioning knowledge','Slower than pure scouts at 20 km/h'],
    rk:{1:{h:7500,e:8},2:{h:21900,e:12},3:{h:33900,e:16},4:{h:49100,e:20},5:{h:68300,e:24},6:{h:92400,e:28},7:{h:119500,e:32}}},
  killshot:{n:'Killshot',role:'Scout',rar:'Epic',e:24,spd:25,g:5,sr:3,
    a:{n:'Melee Dash',d:'Launches this Mech forward at high speed. Colliding with any object creates an AOE Smash that deals significant damage.'},
    p:['Tied fastest speed (25 km/h)','Melee Dash is one of the strongest abilities — damage + mobility','5s cooldown — almost always available','Versatile — works in every situation'],
    c:['Lower HP vs tanks — dies fast if caught','Countered by Juggernaut, Ares, Zephyr, Surge','Outclassed by Nomad at legendary tier'],
    rk:{1:{h:7500,e:6},2:{h:19500,e:8},3:{h:33900,e:12},4:{h:52300,e:16},5:{h:68300,e:18},6:{h:88000,e:20},7:{h:119500,e:24}}},
  ares:{n:'Ares',role:'Tank',rar:'Rare',e:24,spd:18,g:3,sr:3,
    a:{n:'Wide Shield',d:'Activates a portable shield that protects the Mech and allies from enemy fire.'},
    p:['Directional shield has no time limit — very durable','EMP explosion on break punishes enemies','Higher speed than Juggernaut at 18 km/h'],
    c:['Flanks completely exposed — back and sides take full damage','Shield HP doesn\'t refresh unless broken','Outclassed by Aegis and Brickhouse later'],
    rk:{1:{h:12000,e:6},2:{h:26200,e:8},3:{h:45600,e:12},4:{h:70400,e:16},5:{h:91900,e:18},6:{h:118400,e:20},7:{h:160800,e:24}}},
  shadow:{n:'Shadow',role:'Scout',rar:'Rare',e:16,spd:22,g:2,sr:1,
    a:{n:'Stealth',d:'While active, the Mech moves faster and is ignored by enemy targeting systems.'},
    p:['Fast for a light mech','Stealth enables invisible beacon captures'],
    c:['16E only — very limited','Stealth breaks immediately on firing','Outclassed by Killshot, Slingshot, Eclipse immediately'],
    rk:{1:{h:6000,e:4},2:{h:14700,e:6},3:{h:22800,e:8},4:{h:33000,e:10},5:{h:46000,e:12},6:{h:62200,e:14},7:{h:80400,e:16}}},
  guardian:{n:'Guardian',role:'Attacker',rar:'Rare',e:32,spd:16,g:3,sr:3,
    a:{n:'System Crash',d:'Disables Weapons and puts Abilities on cooldown. Works through walls.'},
    p:['32E heavy — supports any weapon combo','System Crash disables enemy weapons AND ability through walls','Strong area-denial — can shut down entire team'],
    c:['16 km/h — very slow for an attacker','Hemlock\'s ECM Shot can disable System Crash','Easy backline target'],
    rk:{1:{h:10500,e:8},2:{h:25800,e:12},3:{h:39900,e:16},4:{h:57800,e:20},5:{h:80400,e:24},6:{h:108800,e:28},7:{h:140700,e:32}}},
  cheetah:{n:'Cheetah',role:'Support',rar:'Epic',e:24,spd:20,g:3,sr:3,
    a:{n:'Mines',d:'Drops a proximity mine on the battlefield. Each mine deals intense area damage when triggered.'},
    p:['Area-denial utility — useful for holding beacons','Mines very effective in narrow corridors'],
    c:['Mines visible and avoidable at higher divisions','20 km/h is mediocre for a scout'],
    rk:{1:{h:8300,e:6},2:{h:21400,e:8},3:{h:37200,e:12},4:{h:57600,e:16},5:{h:75100,e:18},6:{h:96800,e:20},7:{h:131400,e:24}}},
  zephyr:{n:'Zephyr',role:'Support',rar:'Epic',e:24,spd:19,g:3,sr:3,
    a:{n:'Shock Pulse',d:'Triggers an energy pulse applying an EMP Effect that stops enemy Mechs from moving or attacking.'},
    p:['EMP disables entire area — massive team utility','Counters Killshot, Surge dashes hard','24E — decent mid-range weapons'],
    c:['Depends on team to capitalize the stun','Medium speed at 19 km/h'],
    rk:{1:{h:7500,e:6},2:{h:19500,e:8},3:{h:33900,e:12},4:{h:52300,e:16},5:{h:68300,e:18},6:{h:88000,e:20},7:{h:119500,e:24}}},
  brickhouse:{n:'Brickhouse',role:'Support',rar:'Legendary',e:24,spd:14,g:7,sr:3,
    a:{n:'Overcharger',d:'Amplify your weapon systems. Works even better on nearby allies. Doubles damage output.'},
    p:['241,500 HP — among the highest HP tanks','Double Damage ability — burst threat unlike any tank','Strong solo-carry potential'],
    c:['14 km/h — extremely slow even for a tank','Skip in Gear Hub — costs too many A-coins'],
    rk:{1:{h:12800,e:6},2:{h:39300,e:8},3:{h:68400,e:12},4:{h:105800,e:16},5:{h:138000,e:18},6:{h:177800,e:20},7:{h:241500,e:24}}},
  redox:{n:'Redox',role:'Attacker',rar:'Legendary',e:32,spd:18,g:4,sr:3,
    a:{n:'Caustic Blast',d:'Emits a chemical burst that applies Stasis and a Corrosion Effect to nearby enemies, slowing and damaging them.'},
    p:['32E — full weapon flexibility','Caustic Blast slows AND corrodes — double debuff'],
    c:['Short range — need melee distance to land ability','Ability less reliable than direct damage'],
    rk:{1:{h:9000,e:8},2:{h:31200,e:12},3:{h:48300,e:16},4:{h:70000,e:20},5:{h:97400,e:24},6:{h:131800,e:28},7:{h:170400,e:32}}},
  surge:{n:'Surge',role:'Scout',rar:'Legendary',e:24,spd:25,g:7,sr:5,
    a:{n:'Storm Dash',d:'Launches forward. Colliding with any object results in an EMP Smash. Applies EMP Debuff to enemies and Stealth Buff to Surge.'},
    p:['One of the best mechs in the game','EMP Dash combines Killshot\'s mobility with Zephyr\'s stun','Tied fastest speed (25 km/h)','Counters Killshot entirely'],
    c:['9,375 A-coins — most expensive unlock in game','Counter: Panther\'s Stasis Barrier blocks the dash stun'],
    rk:{1:{h:9000,e:6},2:{h:27800,e:8},3:{h:48300,e:12},4:{h:74700,e:16},5:{h:97400,e:18},6:{h:125500,e:20},7:{h:170400,e:24}}},
  arachnos:{n:'Arachnos',role:'Support',rar:'Rare',e:32,spd:14,g:4,sr:4,
    a:{n:'Spider Turret',d:'Deploys a small destructible turret that attacks enemies that approach.'},
    p:['32E — can carry heavy weapons for a support','Spider Turret provides passive damage and area pressure'],
    c:['14 km/h — very slow','C-tier at high divisions','Turret is avoidable with awareness'],
    rk:{1:{h:9000,e:8},2:{h:22100,e:12},3:{h:34200,e:16},4:{h:49500,e:20},5:{h:68900,e:24},6:{h:93300,e:28},7:{h:120600,e:32}}},
  stalker:{n:'Stalker',role:'Attacker',rar:'Rare',e:24,spd:22,g:5,sr:4,
    a:{n:'Predator Drive',d:'Overloads core amplifiers, causing the Mech to deal — and take — more damage. Also recovers HP for each enemy destroyed.'},
    p:['Predator Drive boosts damage output temporarily','22 km/h — decent scout speed'],
    c:['Predator Drive increases damage TAKEN too — risky at low HP','Outclassed by Eclipse and Panther'],
    rk:{1:{h:10500,e:6},2:{h:22900,e:8},3:{h:39900,e:12},4:{h:61600,e:16},5:{h:80400,e:18},6:{h:103600,e:20},7:{h:140700,e:24}}},
  tengu:{n:'Tengu',role:'Scout',rar:'Rare',e:16,spd:14,g:4,sr:4,
    a:{n:'Sky Strike',d:'Launches into the air with stealth. Immune to EMP while airborne. On landing, deals heavy damage and applies Stasis.'},
    p:['Sky Strike is EMP-immune while airborne — counters Zephyr and Surge'],
    c:['Only 16E — cannot carry viable weapons','14 km/h slow AND 16E max = worst combo in game','D-tier — avoid'],
    rk:{1:{h:10500,e:4},2:{h:25800,e:6},3:{h:39900,e:8},4:{h:57800,e:10},5:{h:80400,e:12},6:{h:108800,e:14},7:{h:140700,e:16}}},
  aegis:{n:'Aegis',role:'Tank',rar:'Epic',e:24,spd:20,g:6,sr:4,
    a:{n:'Dome Shield',d:'Deploys a dome which blocks enemy weapons and most abilities. Disappears when HP reaches 0 or timer runs out.'},
    p:['Top S-tier tank','215,000 HP — extremely tanky','750k HP dome = nearly indestructible shield for team','20 km/h — fastest tank class','Can fire through own dome'],
    c:['Dashing mechs (Surge) can enter the dome','Hemlock\'s ECM Shot disables Aegis ability','Zephyr EMP passes through dome'],
    rk:{1:{h:13500,e:6},2:{h:35000,e:8},3:{h:60900,e:12},4:{h:94200,e:16},5:{h:122900,e:18},6:{h:158400,e:20},7:{h:215100,e:24}}},
  orion:{n:'Orion',role:'Support',rar:'Epic',e:24,spd:23,g:5,sr:4,
    a:{n:'Hunter\'s Mark',d:'Fire a tracking flare. If you hit, applies Marked Effect and brief Stasis. All attacks against Marked Mechs count as back hits and deal bonus Damage.'},
    p:['Hunter\'s Mark is one of the best damage-amplifying abilities','24E — meta weapons','23 km/h — fast for a support'],
    c:['Flare has travel time — fast mechs can dodge it','Cloaked mechs cannot be targeted'],
    rk:{1:{h:9800,e:6},2:{h:25300,e:8},3:{h:44000,e:12},4:{h:68000,e:16},5:{h:88800,e:18},6:{h:114400,e:20},7:{h:155300,e:24}}},
  redeemer:{n:'Redeemer',role:'Scout',rar:'Epic',e:24,spd:22,g:5,sr:4,
    a:{n:'Backtrack',d:'Returns this Mech to where it was standing moments ago and removes any Debuffs.'},
    p:['Backtrack is a unique defensive tool — escape any situation','Debuff removal is extremely valuable','22 km/h — decent scout speed'],
    c:['Takes practice to use backtrack effectively','Backtrack can sometimes go out of bounds on small maps'],
    rk:{1:{h:10500,e:6},2:{h:27200,e:8},3:{h:47400,e:12},4:{h:73300,e:16},5:{h:95600,e:18},6:{h:123200,e:20},7:{h:167300,e:24}}},
  sentinel:{n:'Sentinel',role:'Tank',rar:'Epic',e:24,spd:15,g:5,sr:4,
    a:{n:'Tall Shield',d:'Deploys a vertical barrier which can block arcing projectiles.'},
    p:['Provides cover for team'],
    c:['Weak overall — skip in Gear Hub','15 km/h — slow and not tanky enough vs Aegis'],
    rk:{1:{h:12800,e:6},2:{h:33100,e:8},3:{h:57500,e:12},4:{h:89000,e:16},5:{h:116100,e:18},6:{h:149600,e:20},7:{h:203100,e:24}}},
  gatecrasher:{n:'Gatecrasher',role:'Attacker',rar:'Legendary',e:32,spd:21,g:10,sr:5,
    a:{n:'Ion Pod',d:'Fires a Pod that sticks and causes an Ion Blast. When sticking to objects, it releases an Ion Beam that deals damage over time through walls.'},
    p:['221,600 HP — 2nd highest among attackers','32E — heaviest loadout','21 km/h — surprisingly fast','Ion Pod enables unique wall-penetration plays'],
    c:['Largest hitbox in game — vulnerable to AOE','Ion Pod is hard to aim','Skip per F2P guide'],
    rk:{1:{h:11700,e:8},2:{h:40600,e:12},3:{h:62800,e:16},4:{h:91000,e:20},5:{h:126700,e:24},6:{h:171400,e:28},7:{h:221600,e:32}}},
  bastion:{n:'Bastion',role:'Tank',rar:'Legendary',e:24,spd:14,g:9,sr:5,
    a:{n:'Blast Shield',d:'Activates a ring shield to absorb damage. When the shield HP hits zero, it releases a spherical explosion with EMP debuff.'},
    p:['340,920 HP — HIGHEST HP in the entire game','Blast Shield explodes when broken — EMP punishes attackers'],
    c:['14 km/h — slowest even by tank standards','F2P guide: skip — inefficient A-coin spend'],
    rk:{1:{h:18000,e:6},2:{h:55560,e:8},3:{h:96600,e:12},4:{h:149400,e:16},5:{h:194880,e:18},6:{h:251040,e:20},7:{h:340920,e:24}}},
  onyx:{n:'Onyx',role:'Attacker',rar:'Legendary',e:32,spd:18,g:9,sr:5,
    a:{n:'Quad Rocket',d:'A built-in Ability Weapon. When activated, launches four rockets that fly in a direct line and deal Splash Damage on impact.'},
    p:['32E + built-in weapon = extremely high damage ceiling','Quad Rocket splash can hit multiple targets'],
    c:['Skip per F2P guide','~100,000 HP is low for a legendary mech'],
    rk:{1:{h:10500,e:8},2:{h:36400,e:12},3:{h:56300,e:16},4:{h:81700,e:20},5:{h:113700,e:24},6:{h:153800,e:28},7:{h:198900,e:32}}},
  eclipse:{n:'Eclipse',role:'Scout',rar:'Legendary',e:24,spd:22,g:7,sr:5,
    a:{n:'Phase Cloak',d:"When active, the Mech's Speed increases, it is ignored by enemy targeting systems, and cannot be affected by Debuffs."},
    p:['S-tier scout','Cloak + speed boost = excellent ambush and escape','24E — meta weapons fit perfectly'],
    c:['Cloak breaks on weapon fire','22 km/h — slightly slower than Surge/Killshot'],
    rk:{1:{h:9000,e:6},2:{h:27800,e:8},3:{h:48300,e:12},4:{h:74700,e:16},5:{h:97400,e:18},6:{h:125500,e:20},7:{h:170400,e:24}}},
  nomad:{n:'Nomad',role:'Scout',rar:'Legendary',e:24,spd:25,g:10,sr:5,
    a:{n:'Chain Dash',d:'Launches the Mech forward taking reduced Damage. If it directly hits a Mech, deals Damage and has a short time to Dash to another Mech.'},
    p:['S-tier — top meta scout','Chain Dash chains across multiple mechs — unique multi-target ability','Tied fastest speed (25 km/h)','Reduced damage during dash'],
    c:['Chaining requires direct hits — can be blocked','Less defensive utility than Eclipse or Deathwalker'],
    rk:{1:{h:9600,e:6},2:{h:29600,e:8},3:{h:51500,e:12},4:{h:79700,e:16},5:{h:103900,e:18},6:{h:133900,e:20},7:{h:181800,e:24}}},
  hemlock:{n:'Hemlock',role:'Support',rar:'Legendary',e:24,spd:20,g:8,sr:5,
    a:{n:'ECM Shot',d:'Applies the Daze effect, disabling its target after a short delay. If the target is damaged, Daze is replaced by a short EMP effect.'},
    p:['S-tier support','ECM Shot counters ability-heavy mechs (Guardian, Aegis)','24E — meta weapon combos','Strong solo carry'],
    c:['Requires landing ECM + follow-up damage for full EMP — skill-based'],
    rk:{1:{h:10800,e:6},2:{h:33300,e:8},3:{h:58000,e:12},4:{h:89600,e:16},5:{h:116900,e:18},6:{h:150600,e:20},7:{h:204500,e:24}}},
  scorpius:{n:'Scorpius',role:'Attacker',rar:'Legendary',e:32,spd:16,g:7,sr:5,
    a:{n:'Javelin Array',d:'A built-in Ability Weapon. Launches a powerful Javelin salvo at its locked target, who is not notified of the lock.'},
    p:['32E — can carry heavy weapons','Javelin Array is homing and silent — enemy has no warning'],
    c:['F2P guide: skip — not worth A-coins','C-tier'],
    rk:{1:{h:9300,e:8},2:{h:32300,e:12},3:{h:49900,e:16},4:{h:72300,e:20},5:{h:100700,e:24},6:{h:136200,e:28},7:{h:176100,e:32}}},
  vortex:{n:'Vortex',role:'Tank',rar:'Legendary',e:24,spd:17,g:8,sr:5,
    a:{n:'Nanobot Field',d:"The Mech's Speed increases and it forms a field dealing continuous Damage to enemies and reducing Damage to the Mech and Teammates."},
    p:['Unique triple-use ability — damage + speed + protection'],
    c:['C-tier competitive play','17 km/h — sluggish','Limited range on nanobot field'],
    rk:{1:{h:17160,e:6},2:{h:52800,e:8},3:{h:91800,e:12},4:{h:141840,e:16},5:{h:185160,e:18},6:{h:238560,e:20},7:{h:323880,e:24}}},
  seeker:{n:'Seeker',role:'Attacker',rar:'Legendary',e:24,spd:22,g:8,sr:5,
    a:{n:'Warp',d:'Teleports to an enemy within range. While teleporting, Seeker cannot take Damage. On arrival, activates a personal Shield and deals Bonus Damage.'},
    p:['24E — meta weapons','Warp is invincible during teleport — immune to all damage'],
    c:['C-tier — ability requires coordination'],
    rk:{1:{h:10200,e:6},2:{h:31500,e:8},3:{h:54700,e:12},4:{h:84600,e:16},5:{h:110400,e:18},6:{h:142300,e:20},7:{h:193200,e:24}}},
  mimicker:{n:'Mimicker',role:'Scout',rar:'Legendary',e:32,spd:22,g:8,sr:5,
    a:{n:'Adaptation',d:'Scans an enemy and gets a temporary boost based on their Role: Damage, Shield, Stealth, Speed, or Repair.'},
    p:['32E — UNIQUE: only scout with heavy energy','Can equip any weapon combo including dual 16E'],
    c:['Mimic ability is situational at high divisions','C-tier currently'],
    rk:{1:{h:9300,e:8},2:{h:32300,e:12},3:{h:49900,e:16},4:{h:72300,e:20},5:{h:100700,e:24},6:{h:136200,e:28},7:{h:176100,e:32}}},
  solis:{n:'Solis',role:'Support',rar:'Legendary',e:32,spd:20,g:8,sr:5,
    a:{n:'Optic Override',d:'Throws an orb applying the Blind effect. Blinded Mechs cannot see and cannot use Weapons or Abilities that require a target lock.'},
    p:['32E — heavy loadout available','Optic Override disables guided weapons AND abilities','Can be used twice before cooldown'],
    c:['C-tier overall','Low HP for a legendary mech'],
    rk:{1:{h:9000,e:8},2:{h:31200,e:12},3:{h:48300,e:16},4:{h:70000,e:20},5:{h:97400,e:24},6:{h:131800,e:28},7:{h:170400,e:32}}},
  lacewing:{n:'Lacewing',role:'Scout',rar:'Legendary',e:24,spd:23,g:8,sr:5,
    a:{n:'Mine Jump',d:'Leaps into the air, dropping a Mine at its position each time it jumps.'},
    p:['23 km/h — near top speed','24E — strong weapon options','B-tier — competitive'],
    c:['Mines deal modest damage at higher divisions'],
    rk:{1:{h:10500,e:6},2:{h:32400,e:8},3:{h:56300,e:12},4:{h:87100,e:16},5:{h:113700,e:18},6:{h:146500,e:20},7:{h:198900,e:24}}},
  blockhorn:{n:'Blockhorn',role:'Tank',rar:'Legendary',e:32,spd:16,g:9,sr:5,
    a:{n:'Barricade',d:'Deploys an impassable Barricade which blocks enemy fire and most Abilities. Has an Amp Zone that increases the Damage dealt by allies within.'},
    p:['32E — full loadout','Barricade provides unique team cover','B-tier — solid defensive anchor'],
    c:['16 km/h tank speed','Barricade is fixed — enemies can go around it'],
    rk:{1:{h:12000,e:8},2:{h:41600,e:12},3:{h:64400,e:16},4:{h:93300,e:20},5:{h:129900,e:24},6:{h:175800,e:28},7:{h:227300,e:32}}},
  deathwalker:{n:'Deathwalker',role:'Tank',rar:'Legendary',e:32,spd:24,g:9,sr:5,
    a:{n:'Reanimate',d:'Once activated, a point appears on the ground. If Deathwalker is killed while active, it returns to that point with 100% of the HP it had at activation, plus a % of total HP.'},
    p:['24 km/h — near-top speed','Reanimate = second chance at life','B-tier — strong late-game'],
    c:['Reanimate point must be placed before taking fatal damage'],
    rk:{1:{h:12000,e:8},2:{h:41600,e:12},3:{h:64400,e:16},4:{h:93300,e:20},5:{h:129900,e:24},6:{h:175800,e:28},7:{h:227300,e:32}}},
  outlaw:{n:'Outlaw',role:'Attacker',rar:'Legendary',e:32,spd:20,g:9,sr:5,
    a:{n:'Foul Play',d:'Targets an enemy Mech, even through walls, to disable its Weapons and put its Ability on Cooldown. Also affects enemies within a certain radius of the target.'},
    p:['Foul Play disables enemy weapons AND ability through walls','A-tier — solid competitive pick','32E — maximum loadout potential'],
    c:['Long cooldown — must choose timing carefully','Has range limit'],
    rk:{1:{h:11300,e:8},2:{h:39000,e:12},3:{h:60400,e:16},4:{h:87500,e:20},5:{h:121800,e:24},6:{h:164800,e:28},7:{h:213100,e:32}}},
  salvor:{n:'Salvor',role:'Support',rar:'Legendary',e:32,spd:24,g:8,sr:5,
    a:{n:'Regen Shot',d:'Locks onto any allied Mech and fires a projectile that heals a portion of their HP and partially heals Salvor. Ability has 3 charges.'},
    p:['Best dedicated healer — fires 3 missiles that heal 60k+ HP if all land','32E — can carry meaningful weapons while healing','24 km/h — fastest support class','A-tier support'],
    c:['Relies on teammates being within range'],
    rk:{1:{h:12000,e:8},2:{h:41600,e:12},3:{h:64400,e:16},4:{h:93300,e:20},5:{h:129900,e:24},6:{h:175800,e:28},7:{h:227300,e:32}}},
  dreadnought:{n:'Dreadnought',role:'Attacker',rar:'Legendary',e:32,spd:17,g:9,sr:5,
    a:{n:'Wipe Out',d:'Rains down missiles in front of Dreadnought, damaging enemies and applying an EMP effect. If this kills an enemy, Speed increases and Ability Cooldown resets.'},
    p:['S-tier attacker','Wipe Out stuns on every rocket hit — massive CC','Kill = instant cooldown reset = chain kills','32E — full loadout'],
    c:['17 km/h — slow for its role','Rockets can be dodged by fast mechs'],
    rk:{1:{h:12000,e:8},2:{h:41600,e:12},3:{h:64400,e:16},4:{h:93300,e:20},5:{h:129900,e:24},6:{h:175800,e:28},7:{h:227300,e:32}}},
  parasite:{n:'Parasite',role:'Tank',rar:'Legendary',e:24,spd:22,g:9,sr:5,
    a:{n:'Redirection',d:'Locks onto an enemy and links with it. While active, Parasite redirects a percentage of Damage it receives to the linked enemy. Parasite also receives less Damage.'},
    p:['Redirection reflects incoming damage back to your target','24E — meta weapon options','B-tier'],
    c:['Damage only redirects while ability is active — timing critical'],
    rk:{1:{h:13800,e:6},2:{h:42600,e:8},3:{h:74100,e:12},4:{h:114500,e:16},5:{h:149400,e:18},6:{h:192500,e:20},7:{h:261300,e:24}}},
  volti:{n:'Volti',role:'Attacker',rar:'Legendary',e:32,spd:19,g:8,sr:5,
    a:{n:'Thunderstorm',d:'Locks on and teleports a drone to the target. The drone projects a damaging zone and applies Shock. Damage does not bypass Shields.'},
    p:['A-tier attacker','Thunderstorm ignores cover — punishes campers and wall-huggers'],
    c:['19 km/h — average attacker speed','Thunderstorm requires staying near target'],
    rk:{1:{h:11000,e:8},2:{h:38000,e:12},3:{h:58800,e:16},4:{h:85200,e:20},5:{h:118500,e:24},6:{h:160400,e:28},7:{h:207400,e:32}}},
  silverthorn:{n:'Silverthorn',role:'Attacker',rar:'Legendary',e:32,spd:20,g:9,sr:5,
    a:{n:'Blade Burst',d:'Fires five blades, damaging and slowing on hit. After a time, the blades retract, dealing Splash Damage around the target(s) based on Damage dealt to them.'},
    p:['A-tier attacker','Blade Burst can theoretically hit entire enemy team','Chain explosions deal massive multi-target damage','32E — full loadout'],
    c:['Blades fire quickly — hard to aim all 5 intentionally'],
    rk:{1:{h:11700,e:8},2:{h:40600,e:12},3:{h:62800,e:16},4:{h:91000,e:20},5:{h:126700,e:24},6:{h:171400,e:28},7:{h:221600,e:32}}},
  blizzfrost:{n:'Blizzfrost',role:'Scout',rar:'Legendary',e:24,spd:20,g:9,sr:5,
    a:{n:'Icy Grip',d:'Creates a zone that freezes enemies and makes Blizzfrost immune to Stasis. Frozen enemies take Damage and cannot move. The more enemies frozen, the less Damage Blizzfrost takes.'},
    p:['B-tier','Freeze is unique — different from EMP stun','Stasis immunity is rare and valuable','24E — meta weapons'],
    c:['Frozen enemies can still shoot back','Speed boost only if no freeze landed'],
    rk:{1:{h:9600,e:6},2:{h:29600,e:8},3:{h:51500,e:12},4:{h:79700,e:16},5:{h:103900,e:18},6:{h:133900,e:20},7:{h:181800,e:24}}},
  citadel:{n:'Citadel',role:'Support',rar:'Legendary',e:24,spd:18,g:10,sr:5,
    a:{n:'Seismic Field',d:'Creates a zone that reduces enemy speed and prevents activation of their movement Abilities. Receives a speed boost and shield, which gains HP for each enemy in the zone.'},
    p:['Unique support tank hybrid — shield for teammates','24E — decent weapon options','B-tier — solid in organized team play'],
    c:['18 km/h — below average speed'],
    rk:{1:{h:17160,e:6},2:{h:52800,e:8},3:{h:91800,e:12},4:{h:141840,e:16},5:{h:185160,e:18},6:{h:238560,e:20},7:{h:323880,e:24}}},
};

// ─── ABILITY RANK STATS ───────────────────────────────────
const MAR = {
  paragon:[['Cooldown','s',[9,9,9,9,9,9,9]],['Duration','s',[6,6,6,6,6,6,6]]],
  lancer:[['Cooldown','s',[5,5,5,5,5,5,5]],['Jump Distance','m',[10,10,10,10,10,10,10]]],
  puma:[['Cooldown','s',[10,10,10,10,10,10,10]],['Duration','s',[10,10,10,10,10,10,10]],['Shield HP','',[7100,12400,19200,27800,38700,52400,67800]]],
  slingshot:[['Cooldown','s',[6,6,6,6,6,6,6]],['Damage','',[2400,3700,6400,9900,12900,16600,22600]],['AOE Radius','m',[12,12,12,12,12,12,12]]],
  juggernaut:[['Cooldown','s',[10,10,10,10,10,10,10]],['Duration','s',[12,12,12,12,12,12,12]],['Shield HP','',[3300,5100,9000,13800,18100,23300,31600]]],
  md:[['Cooldown','s',[12,12,12,12,12,12,12]],['Duration','s',[10,10,10,10,10,10,10]],['Mech Heal/s','',[430,740,1150,1670,2320,3140,4060]],['Team Heal/s','',[860,1490,2300,3340,4640,6280,8130]]],
  guardian:[['Cooldown','s',[15,15,15,15,15,15,15]],['Crash Width','m',[60,60,60,60,60,60,60]],['Crash Range','m',[30,30,30,30,30,30,30]]],
  shadow:[['Cooldown','s',[8,8,8,8,8,8,8]],['Duration','s',[12,12,12,12,12,12,12]]],
  ares:[['Cooldown','s',[12,12,12,12,12,12,12]],['Shield HP','',[4600,7100,12400,19200,25100,32300,43900]]],
  stalker:[['Cooldown','s',[9,9,9,9,9,9,9]],['Duration','s',[9,9,9,9,9,9,9]],['Mech Dmg Boost','',['+50%','+50%','+50%','+50%','+50%','+50%','+50%']]],
  tengu:[['Cooldown','s',[7,7,7,7,7,7,7]],['Damage','',[5700,9800,15200,22000,30700,41500,53600]],['Stasis Duration','s',[5,5,5,5,5,5,5]]],
  arachnos:[['Cooldown','s',[22,22,22,22,22,22,22]],['Turret Damage','',[37,64,100,146,201,272,351]],['Turret Lifetime','s',[10,10,10,10,10,10,10]]],
  redeemer:[['Cooldown','s',[14,14,14,14,14,14,14]],['Backtrack Timer','s',[10,10,10,10,10,10,10]]],
  aegis:[['Cooldown','s',[10,10,10,10,10,10,10]],['Duration','s',[10,10,10,10,10,10,10]],['Dome HP','',[79000,122200,212500,328600,428700,552400,750000]],['Dome Radius','m',[10,10,10,10,10,10,10]]],
  zephyr:[['Cooldown','s',[8,8,8,8,8,8,8]],['Duration','s',[3,3,3,3,3,3,3]],['Radius','m',[30,30,30,30,30,30,30]]],
  cheetah:[['Cooldown','s',[6,6,6,6,6,6,6]],['Mine Damage','',[4000,6200,10800,16600,21700,28000,38000]],['Mine Radius','m',[12,12,12,12,12,12,12]]],
  panther:[['Cooldown','s',[10,10,10,10,10,10,10]],['Duration','s',[10,10,10,10,10,10,10]],['Stasis Time','s',[4,4,4,4,4,4,4]]],
  killshot:[['Cooldown','s',[6,6,6,6,6,6,6]],['Damage','',[7100,10900,19000,29300,38300,49300,66900]],['Dash Distance','m',[40,40,40,40,40,40,40]]],
  sentinel:[['Cooldown','s',[12,12,12,12,12,12,12]],['Shield HP','',[6100,9400,16300,25200,32800,42300,57400]]],
  orion:[['Cooldown','s',[12,12,12,12,12,12,12]],['Dmg Boost','',['+150%','+150%','+150%','+150%','+150%','+150%','+150%']],['Transfer Range','m',[20,20,20,20,20,25,30]]],
  redox:[['Cooldown','s',[8,8,8,8,8,8,8]],['Duration','s',[6,6,6,6,6,6,6]],['Damage','',[4800,8300,12900,18700,26000,35200,45500]],['Radius','m',[30,30,30,30,30,30,30]]],
  scorpius:[['Cooldown','s',[7,7,7,7,7,7,7]],['Damage/Mag','',[960,3588,6804,11412,17808,26556,41076]]],
  surge:[['Cooldown','s',[7,7,7,7,7,7,7]],['Duration','s',[3,3,3,3,3,3,3]],['Dash Distance','m',[40,40,40,40,40,40,40]],['EMP Radius','m',[15,15,15,15,15,15,15]]],
  eclipse:[['Cooldown','s',[10,10,10,10,10,10,10]],['Duration','s',[8,8,8,8,8,8,8]]],
  brickhouse:[['Cooldown','s',[12,12,12,12,12,12,12]],['Duration','s',[10,10,10,10,10,10,10]],['Mech Dmg Boost','',['+50%','+50%','+50%','+50%','+50%','+50%','+50%']],['Team Dmg Boost','',['+100%','+100%','+100%','+100%','+100%','+100%','+100%']]],
  gatecrasher:[['Cooldown','s',[10,10,10,10,10,10,10]],['Blast Damage','',[6300,11000,17000,24600,34300,46400,60000]],['Beam Damage','',[9500,16500,25500,36900,51400,69500,89900]]],
  onyx:[['Cooldown','s',[10,10,10,10,10,10,10]],['Damage/Mag','',[1628,6102,11582,19404,30288,45162,69933]]],
  nomad:[['Cooldown','s',[8,8,8,8,8,8,8]],['Chain Dash Time','s',[3,3,3,3,3,3,3]],['Damage','',[7400,11400,19900,30800,40200,51700,70200]],['Dash Distance','m',[45,45,45,45,45,45,45]],['Dmg Reduction','',['-60%','-60%','-60%','-60%','-60%','-60%','-60%']]],
  lacewing:[['Cooldown','s',[7,7,7,7,7,7,7]],['Mine Damage','',[4000,6200,10800,16600,21700,28000,38000]],['Jump Charges','',[2,2,2,2,2,2,2]]],
  bastion:[['Cooldown','s',[16,16,16,16,16,16,16]],['Shield HP','',[6300,9800,17000,26300,34300,44200,60000]],['Blast Damage','',[2400,3700,6400,10000,13000,16800,22700]],['EMP Duration','s',[1,1,1,1,2,3,3]]],
  vortex:[['Cooldown','s',[10.4,10.4,10.4,10.4,10.4,10.4,10.4]],['Field Damage/s','',[500,800,1300,2100,2700,3500,4700]],['Field Radius','m',[12,12,12,12,12,12,12]]],
  hemlock:[['Cooldown','s',[16,16,16,16,16,16,16]],['Daze Delay','s',[1.5,1.5,1.5,1.5,1.5,1.5,1.5]],['Daze Duration','s',[6,6,6,6,6,6,6]],['EMP Duration','s',[2,2,2,2,2,2,2]]],
  solis:[['Cooldown','s',[8,8,8,8,8,8,8]],['Blind Duration','s',[3,3,3,3,3,3,3]],['Orb Count','',[2,2,2,2,2,2,2]]],
  seeker:[['Cooldown','s',[8,8,8,8,8,8,8]],['Duration','s',[7,7,7,7,7,7,7]],['Shield HP','',[3600,5600,9700,15000,19500,25200,34200]],['Warp Range','m',[100,100,100,100,100,100,100]]],
  outlaw:[['Cooldown','s',[15,15,15,15,15,15,15]],['Range','m',[100,100,100,100,100,100,100]]],
  dreadnought:[['Cooldown','s',[9,9,9,9,9,9,9]],['EMP Duration','s',[2,2,2,2,2,2,2]],['Damage','',[12202,25982,32868,41296,51578,64085,74319]]],
  volti:[['Cooldown','s',[13,13,13,13,13,13,13]],['Duration','s',[6,6,6,6,6,6,6]],['Damage/tick','',[1100,1900,3000,4300,6000,8100,10400]]],
  blizzfrost:[['Cooldown','s',[7,7,7,7,7,7,7]],['Duration','s',[5,5,5,5,5,5,5]],['Damage','',[5300,8100,14200,21900,28600,36800,50000]],['Radius','m',[30,30,30,30,30,30,30]]],
  mimicker:[['Cooldown','s',[9,9,9,9,9,9,9]],['Shield HP','',[9500,16500,25500,36900,51400,69500,89900]]],
  parasite:[['Cooldown','s',[11,11,11,11,11,11,11]],['Duration','s',[12,12,12,12,12,12,12]],['Dmg Reduction','',[' 10%',' 10%',' 10%',' 10%',' 10%',' 10%',' 10%']],['Dmg Redirected','',[' 35%',' 35%',' 35%',' 35%',' 35%',' 35%',' 35%']]],
  blockhorn:[['Cooldown','s',[9,9,9,9,9,9,9]],['Duration','s',[7,7,7,7,7,7,7]],['Barricade HP','',[53000,92200,142600,206700,287600,389100,503100]]],
  deathwalker:[['Cooldown','s',[15,15,15,15,15,15,15]],['Duration','s',[15,15,15,15,15,15,15]],['Invulnerability','s',[3,3,3,3,3,3,3]],['Speed Boost','',['+60%','+60%','+60%','+60%','+60%','+60%','+60%']]],
  citadel:[['Cooldown','s',[10,10,10,10,10,10,10]],['Shield HP','',[13000,20100,35000,54100,70500,90900,123400]]],
  salvor:[['Cooldown','s',[12,12,12,12,12,12,12]],['HP Healed (Ally)','',[6330,11020,17040,24700,34370,46500,60130]],['HP Healed (Self)','',[3190,5540,8570,12420,17280,23380,30230]]],
  silverthorn:[['Cooldown','s',[7,7,7,7,7,7,7]],['Duration','s',[3.5,3.5,3.5,3.5,3.5,3.5,3.5]],['Blade Count','',[5,5,5,5,5,5,5]],['Spd Reduction','',['-40%','-40%','-40%','-40%','-40%','-40%','-40%']]],
};

// ─── MAP DATA ─────────────────────────────────────────────
const MAP_CPC = ['Biogear Lab','Campaings Forge','Elon Station Gray','Forbidden City','Imperial Temple','Mech Arena','Mesa Verde Annex','Paradise Plaza','Patterson Station','Scarlet Atrium','Site 313','Skyship 11','Smokestacks'];
const MAP_5V5 = ['Acropolis','Agora','Artifact X','Backalley','Beatdown Club','Central Station','Colonnade','Constant','Container City','Crane Yard','Crimson Works','Dockyard','EQuilibrium','Fortune Towers','Freight Depot','Frost Rink','Ground Zero','Hanging Gardens','High Bridge','Hope Launchpad','Imperial Temple','Nebula Square','Neon Central','Paradise Plaza','Powder Parkway','Shevchenko Park','Singularity','Skyship 11','Snowdrift Stage','The Stacks','Tunnel of Fate','Two Arches','VMD Lab','ZC Cargo Dock','ZC Control','ZC Shop Floor'];

// ─── ROLE / RARITY ICONS ─────────────────────────────────
const R_ICON = { Attacker:'⚔️', Scout:'🏃', Tank:'🛡️', Support:'💚' };
const RAR_ICON = { Common:'⚪', Uncommon:'🟢', Rare:'🔵', Epic:'🟣', Legendary:'🟡' };
const RAR_TIER_SCORE = { Common:1, Uncommon:2, Rare:3, Epic:4, Legendary:5 };

// ─── SCREEN BUILDERS ─────────────────────────────────────

function menuText() {
  return `⬡ <b>MECH ARENA HUB</b>

Привіт, командире! Обери розділ:${FOOTER}`;
}

function menuKbd() {
  return kbd(
    [btn('🤖 Мехи',   'mechs:all:0'),   btn('⚡ Порівняння', 'cmp:')],
    [btn('🧮 Калькулятор', 'calc'),     btn('🏆 Рейтинг ангара', 'hr:')],
    [btn('🎁 Промо',  'promo'),         btn('🗺️ Карти',  'maps:cpc:0')],
  );
}

// ─ Mechs list ─
function mechsText(role, page) {
  const all = Object.keys(MECHS);
  const filtered = role === 'all' ? all : all.filter(k => MECHS[k].role === role);
  const total = filtered.length;
  const pages = Math.ceil(total / MECHS_PER_PAGE);
  const slice = filtered.slice(page * MECHS_PER_PAGE, (page+1) * MECHS_PER_PAGE);
  const roleLabel = role === 'all' ? 'Всі мехи' : role + 's';
  let txt = `🤖 <b>МЕХИ</b> — ${esc(roleLabel)} (${total})\n\n`;
  slice.forEach(k => {
    const m = MECHS[k];
    txt += `${R_ICON[m.role] || ''}${RAR_ICON[m.rar] || ''} <b>${esc(m.n)}</b> — ⚡${m.e}E · 💨${m.spd}km/h · ❤️${fmt(m.rk[7].h)} HP\n`;
  });
  txt += `\nСторінка ${page+1}/${pages}${FOOTER}`;
  return txt;
}

function mechsKbd(role, page) {
  const all = Object.keys(MECHS);
  const filtered = role === 'all' ? all : all.filter(k => MECHS[k].role === role);
  const total = filtered.length;
  const pages = Math.ceil(total / MECHS_PER_PAGE);
  const slice = filtered.slice(page * MECHS_PER_PAGE, (page+1) * MECHS_PER_PAGE);

  const mechRows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const row = [btn(MECHS[slice[i]].n, `mech:${slice[i]}:1`)];
    if (slice[i+1]) row.push(btn(MECHS[slice[i+1]].n, `mech:${slice[i+1]}:1`));
    mechRows.push(row);
  }
  const nav = [];
  if (page > 0) nav.push(btn('◀ Назад', `mechs:${role}:${page-1}`));
  if (page < pages-1) nav.push(btn('Далі ▶', `mechs:${role}:${page+1}`));

  return kbd(
    [btn(role==='all'?'✅ Всі':'Всі','mechs:all:0'),
     btn(role==='Attacker'?(role==='Attacker'?'✅ ⚔️ ATK':'⚔️ ATK'):'⚔️ ATK','mechs:Attacker:0'),
     btn(role==='Scout'?'✅ 🏃 SCT':'🏃 SCT','mechs:Scout:0'),
     btn(role==='Tank'?'✅ 🛡️ TNK':'🛡️ TNK','mechs:Tank:0'),
     btn(role==='Support'?'✅ 💚 SUP':'💚 SUP','mechs:Support:0')],
    ...mechRows,
    nav.length ? nav : [],
    [btn('🏠 Меню', 'menu')],
  );
}

// ─ Single mech detail ─
function mechText(key, rank) {
  const m = MECHS[key];
  if (!m) return 'Меха не знайдено.';
  rank = Math.min(7, Math.max(1, +rank || 1));
  const rd = m.rk[rank] || m.rk[7];
  const ar = MAR[key] || [];

  let txt = `${R_ICON[m.role]}${RAR_ICON[m.rar]} <b>${esc(m.n)}</b>\n`;
  txt += `<i>${esc(m.role)} · ${esc(m.rar)} · ⚡${m.e}E · 💨${m.spd} km/h · Tier ${m.g}</i>\n\n`;
  txt += `<b>📊 РАНГ ${rank}</b>\n`;
  txt += `❤️ HP: <b>${fmt(rd.h)}</b>\n`;
  txt += `⚡ Енергія: <b>${rd.e}E</b> / ${m.e}E макс\n\n`;
  txt += `<b>⚡ НАВИЧКА: ${esc(m.a.n)}</b>\n`;
  txt += `<i>${esc(m.a.d)}</i>\n`;

  if (ar.length) {
    txt += `\n<b>📈 ПАРАМЕТРИ НАВИЧКИ (Ранг ${rank}):</b>\n`;
    ar.forEach(([lbl, unit, vals]) => {
      const v = vals[rank-1];
      const disp = (typeof v === 'number' && v >= 1000) ? fmt(v) : v;
      txt += `• ${esc(lbl)}: <b>${disp}${unit}</b>\n`;
    });
  }

  if (m.p && m.p.length) {
    txt += `\n✅ <b>ПЛЮСИ:</b>\n`;
    m.p.forEach(p => txt += `• ${esc(p)}\n`);
  }
  if (m.c && m.c.length) {
    txt += `\n❌ <b>МІНУСИ:</b>\n`;
    m.c.forEach(c => txt += `• ${esc(c)}\n`);
  }
  txt += FOOTER;
  return txt;
}

function mechKbd(key, rank) {
  const m = MECHS[key];
  const rankBtns = [1,2,3,4,5,6,7].map(r => {
    const active = r === +rank;
    return btn(active ? `[${r}]` : `${r}`, `mech:${key}:${r}`);
  });
  return kbd(
    rankBtns,
    [btn('◀ До списку', 'mechs:all:0'), btn('🏠 Меню', 'menu')],
  );
}

// ─ Calculator ─
function calcText() {
  return `🧮 <b>КАЛЬКУЛЯТОР</b>\n\nОбери що розраховувати:${FOOTER}`;
}
function calcKbd() {
  return kbd(
    [btn('⚙️ Мехи', 'calc_t:mech'), btn('🔧 Зброя', 'calc_t:weapon')],
    [btn('👤 Пілоти', 'calc_pt:epic'), btn('🧩 Моди', 'calc_mod')],
    [btn('🏠 Меню', 'menu')],
  );
}

// ─ Mech/Weapon calc item list ─
function calcItemsText(type, page) {
  const items = calcList().filter(i => i.type === type);
  const total = items.length;
  const pages = Math.ceil(total / ITEMS_PER_PAGE);
  const lbl = type === 'mech' ? 'Мех' : 'Зброя';
  return `🧮 <b>${lbl.toUpperCase()}И</b> — обери (${total})\nСторінка ${page+1}/${pages}${FOOTER}`;
}

function calcItemsKbd(type, page) {
  const items = calcList().filter(i => i.type === type);
  const total = items.length;
  const pages = Math.ceil(total / ITEMS_PER_PAGE);
  const slice = items.slice(page * ITEMS_PER_PAGE, (page+1) * ITEMS_PER_PAGE);

  const itemRows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const row = [btn(slice[i].list, `calc_i:${type}:${slice[i].list}`)];
    if (slice[i+1]) row.push(btn(slice[i+1].list, `calc_i:${type}:${slice[i+1].list}`));
    itemRows.push(row);
  }
  const nav = [];
  if (page > 0) nav.push(btn('◀ Назад', `calc_t:${type}:${page-1}`));
  if (page < pages-1) nav.push(btn('Далі ▶', `calc_t:${type}:${page+1}`));

  return kbd(
    ...itemRows,
    nav.length ? nav : [],
    [btn('◀ Назад', 'calc'), btn('🏠 Меню', 'menu')],
  );
}

// ─ Calc from star selection ─
function calcFromText(type, name) {
  return `🧮 <b>${esc(name)}</b>\n\nВибери початкову зірку (до максимуму 6★ Lv7):${FOOTER}`;
}
function calcFromKbd(type, name) {
  const rows = [1,2,3,4,5,6].map(s => btn(`${s}★`, `calc_x:${type}:${name}:${s}:1:6:7`));
  return kbd(
    rows.slice(0,3), rows.slice(3,6),
    [btn('◀ Назад', `calc_t:${type}:0`), btn('🏠 Меню', 'menu')],
  );
}

// ─ Calc result ─
function calcResultText(type, name, fs, fl, ts, tl) {
  try {
    const cl = calcList();
    const item = cl.find(i => i.list === name && i.type === type);
    if (!item) return `⚠️ Предмет не знайдено: ${esc(name)}`;

    const key = type === 'mech'
      ? item.rarity + '_mech'
      : item.rarity + '_weapon_' + item.energy;

    const costs = calcCosts();
    const fromIdx = (+fs - 1) * 7 + (+fl - 1);
    const toIdx   = (+ts - 1) * 7 + (+tl - 1);

    let cr = 0, ac = 0, bp = 0;
    for (let i = fromIdx; i < toIdx; i++) {
      const c = costs[i] && costs[i][key];
      if (c) { cr += c.credits || 0; ac += c.acoins || 0; bp += c.blueprints || 0; }
    }

    let txt = `🧮 <b>РЕЗУЛЬТАТ</b>\n\n`;
    txt += `<b>${esc(name)}</b>\n`;
    txt += `${fs}★ Lv${fl} → ${ts}★ Lv${tl}\n\n`;
    if (cr)  txt += `💰 Кредити: <b>${fmt(cr)}</b>\n`;
    if (bp)  txt += `📘 Схеми: <b>${fmt(bp)}</b>\n`;
    if (ac)  txt += `🟡 A-Монети: <b>${fmt(ac)}</b>\n`;
    if (!cr && !bp && !ac) txt += `ℹ️ Дані про вартість відсутні для цього рівня.`;
    txt += FOOTER;
    return txt;
  } catch(e) {
    return `⚠️ Помилка розрахунку: ${esc(e.message)}`;
  }
}

function calcResultKbd(type, name) {
  return kbd(
    [btn('◀ Назад', `calc_i:${type}:${name}`), btn('🏠 Меню', 'menu')],
  );
}

// ─ Pilot calc ─
function pilotText(rar) {
  const COLORS = { rare:'🔵', epic:'🟣', legendary:'🟡' };
  return `👤 <b>КАЛЬКУЛЯТОР ПІЛОТІВ</b>\n\n${COLORS[rar]||''} ${rar.charAt(0).toUpperCase()+rar.slice(1)} Пілот\nВсі пілоти однакової рідкості мають однакову вартість.\n\nОбери початкову зірку (до 6★ Lv7):${FOOTER}`;
}
function pilotKbd(rar) {
  const stars = [1,2,3,4,5,6].map(s => btn(`${s}★`, `calc_px:${rar}:${s}:1:6:7`));
  return kbd(
    [btn('🔵 Rare', `calc_pt:rare`), btn('🟣 Epic', `calc_pt:epic`), btn('🟡 Legendary', `calc_pt:legendary`)],
    stars.slice(0,3), stars.slice(3,6),
    [btn('◀ Назад', 'calc'), btn('🏠 Меню', 'menu')],
  );
}

function pilotResultText(rar, fs, fl, ts, tl) {
  try {
    const costs = pilotCosts();
    const fromIdx = (+fs-1)*7 + (+fl-1);
    const toIdx   = (+ts-1)*7 + (+tl-1);
    let ac=0, marks=0, xp=0;
    for (let i=fromIdx; i<toIdx; i++) {
      const c = costs[i] && costs[i][rar];
      if (c) { ac += c.acoins||0; marks += c.marks||0; xp += c.xp||0; }
    }
    const wins = xp > 0 ? ` (~${fmt(Math.ceil(xp/800))} перемог)` : '';
    let txt = `👤 <b>РЕЗУЛЬТАТ — ${esc(rar.toUpperCase())} ПІЛОТ</b>\n\n`;
    txt += `${fs}★ Lv${fl} → ${ts}★ Lv${tl}\n\n`;
    if (ac)    txt += `🟡 A-Монети: <b>${fmt(ac)}</b>\n`;
    if (marks) txt += `🎖️ Marks: <b>${fmt(marks)}</b>\n`;
    if (xp)    txt += `⭐ XP: <b>${fmt(xp)}</b>${wins}\n`;
    if (!ac && !marks && !xp) txt += 'ℹ️ Дані відсутні.';
    txt += FOOTER;
    return txt;
  } catch(e) {
    return `⚠️ Помилка: ${esc(e.message)}`;
  }
}

// ─ Mod calc ─
function modCalcText(page) {
  const mods = modsList();
  const pages = Math.ceil(mods.length / ITEMS_PER_PAGE);
  return `🧩 <b>МОДИ</b> — Обери мод (${mods.length})\nСторінка ${page+1}/${pages}${FOOTER}`;
}
function modCalcKbd(page) {
  const mods = modsList();
  const pages = Math.ceil(mods.length / ITEMS_PER_PAGE);
  const slice = mods.slice(page * ITEMS_PER_PAGE, (page+1)*ITEMS_PER_PAGE);
  const modRows = [];
  for (let i = 0; i < slice.length; i += 2) {
    const r = [btn(`${slice[i].rarity[0].toUpperCase()} ${slice[i].mod_label.trim()}`, `mod_i:${slice[i].rarity}:${slice[i].mod_name}`)];
    if (slice[i+1]) r.push(btn(`${slice[i+1].rarity[0].toUpperCase()} ${slice[i+1].mod_label.trim()}`, `mod_i:${slice[i+1].rarity}:${slice[i+1].mod_name}`));
    modRows.push(r);
  }
  const nav = [];
  if (page>0) nav.push(btn('◀', `calc_mod:${page-1}`));
  if (page<pages-1) nav.push(btn('▶', `calc_mod:${page+1}`));
  return kbd(...modRows, nav.length?nav:[], [btn('◀ Назад','calc'),btn('🏠 Меню','menu')]);
}

function modFromText(rar, name) {
  const mods = modsList();
  const mod = mods.find(m => m.mod_name === name && m.rarity === rar);
  const lbl = mod ? mod.mod_label.trim() : name;
  return `🧩 <b>${esc(lbl)}</b> (${esc(rar)})\n\nОбери поточний рівень (до L6):${FOOTER}`;
}
function modFromKbd(rar, name) {
  const lvls = [1,2,3,4,5].map(l => btn(`L${l}`, `mod_x:${rar}:${name}:${l}:6`));
  return kbd(lvls, [btn('◀ Назад',`calc_mod:0`),btn('🏠 Меню','menu')]);
}

function modResultText(rar, name, fl, tl) {
  try {
    const mods = modsList();
    const mod = mods.find(m => m.mod_name === name && m.rarity === rar);
    const lbl = mod ? mod.mod_label.trim() : name;
    const costs = modCosts();
    const key = `${rar}_${name}`;
    let basic=0, elite=0;
    costs.forEach(entry => {
      if (entry.level > +fl && entry.level <= +tl) {
        const c = entry[key];
        if (c) { basic += c.basic_mod_parts||0; elite += c.elite_mod_parts||0; }
      }
    });
    let txt = `🧩 <b>РЕЗУЛЬТАТ — МОД</b>\n\n`;
    txt += `<b>${esc(lbl)}</b> (${esc(rar)})\n`;
    txt += `L${fl} → L${tl}\n\n`;
    if (basic) txt += `🔩 Basic Mod Parts: <b>${fmt(basic)}</b>\n`;
    if (elite) txt += `💎 Elite Mod Parts: <b>${fmt(elite)}</b>\n`;
    if (!basic && !elite) txt += 'ℹ️ Дані відсутні.';
    txt += FOOTER;
    return txt;
  } catch(e) {
    return `⚠️ Помилка: ${esc(e.message)}`;
  }
}

// ─ Compare ─
function cmpText(keys) {
  if (!keys.length) {
    return `⚡ <b>ПОРІВНЯННЯ</b>\n\nОбери до 3 мехів для порівняння:${FOOTER}`;
  }
  const mechs = keys.map(k => MECHS[k]).filter(Boolean);
  if (!mechs.length) return `⚡ <b>ПОРІВНЯННЯ</b>\n\nМехи не знайдено.${FOOTER}`;

  let txt = `⚡ <b>ПОРІВНЯННЯ</b> (${keys.join(', ')})\n\n`;
  const stats = [
    ['HP (R7)', m => fmt(m.rk[7].h)],
    ['Energy', m => `${m.e}E`],
    ['Speed', m => `${m.spd} km/h`],
    ['Role', m => m.role],
    ['Rarity', m => m.rar],
    ['Gear Tier', m => `T${m.g}`],
  ];

  // Find best HP and speed
  const maxHP  = Math.max(...mechs.map(m => m.rk[7].h));
  const maxSpd = Math.max(...mechs.map(m => m.spd));

  txt += `<b>${mechs.map(m => esc(m.n)).join(' | ')}</b>\n`;
  txt += '─'.repeat(28) + '\n';
  stats.forEach(([lbl, fn]) => {
    const vals = mechs.map(fn);
    txt += `${lbl}: ${vals.join(' | ')}\n`;
  });

  txt += '\n<b>НАВИЧКИ:</b>\n';
  mechs.forEach(m => {
    txt += `${R_ICON[m.role]} <b>${esc(m.n)}</b>: ${esc(m.a.n)}\n`;
  });

  txt += FOOTER;
  return txt;
}

function cmpKbd(keys) {
  const csv = encMechs(keys);
  const allKeys = Object.keys(MECHS);

  if (keys.length >= 3) {
    // Show result + clear
    return kbd(
      [btn('🗑 Очистити', 'cmp:')],
      [btn('🏠 Меню', 'menu')],
    );
  }

  // Show mech picker (first page only for simplicity, with filter)
  const available = allKeys.filter(k => !keys.includes(k));
  const rows = [];
  for (let i = 0; i < Math.min(available.length, 12); i += 3) {
    rows.push(available.slice(i, i+3).map(k => btn(MECHS[k].n, `cmp_a:${sk(k)}:${csv}`)));
  }

  const actions = keys.length ? [btn('🗑 Очистити', 'cmp:')] : [];
  return kbd(
    ...rows,
    actions.length ? actions : [],
    [btn('🏠 Меню', 'menu')],
  );
}

// ─ Hangar rate ─
const HR_ROLE_SCORE = { Attacker:25, Scout:20, Tank:30, Support:25 };
const IDEAL_ROLES   = { Attacker:2, Scout:1, Tank:1, Support:1 };

function rateHangar(keys) {
  const mechs = keys.map(k => MECHS[k]).filter(Boolean);
  if (!mechs.length) return null;

  const rarScores = mechs.map(m => RAR_TIER_SCORE[m.rar] || 1);
  const avgRar = rarScores.reduce((a,b)=>a+b,0) / mechs.length;
  const rarScore = Math.round(avgRar / 5 * 30);

  const roleCounts = {};
  mechs.forEach(m => roleCounts[m.role] = (roleCounts[m.role]||0)+1);
  const roles = Object.keys(roleCounts).length;
  const diversityScore = Math.round((roles / 4) * 25);

  const avgTier = mechs.map(m=>m.g).reduce((a,b)=>a+b,0)/mechs.length;
  const tierScore = Math.round((avgTier / 10) * 25);

  const metaKeys = ['surge','nomad','aegis','hemlock','eclipse','dreadnought','orion','salvor'];
  const metaCount = keys.filter(k => metaKeys.includes(k)).length;
  const metaScore = Math.round((metaCount / mechs.length) * 20);

  const total = rarScore + diversityScore + tierScore + metaScore;
  const grade = total >= 85 ? 'S' : total >= 70 ? 'A' : total >= 55 ? 'B' : total >= 40 ? 'C' : 'D';

  return { total, grade, rarScore, diversityScore, tierScore, metaScore, roles, mechs };
}

function hrText(keys) {
  if (!keys.length) {
    return `🏆 <b>РЕЙТИНГ АНГАРА</b>\n\nОбери до 5 мехів свого ангара:${FOOTER}`;
  }
  const mechs = keys.map(k => MECHS[k]).filter(Boolean);
  const selected = mechs.map(m => `${R_ICON[m.role]} ${m.n}`).join('\n');
  return `🏆 <b>РЕЙТИНГ АНГАРА</b>\n\nОбрано (${mechs.length}/5):\n${selected}\n\nДодай мехів або натисни "Оцінити":${FOOTER}`;
}

function hrResultText(keys) {
  const r = rateHangar(keys);
  if (!r) return `⚠️ Оберіть мехів для оцінки.`;

  const gradeColors = { S:'🌟', A:'🔥', B:'✅', C:'⚠️', D:'❌' };
  let txt = `🏆 <b>ОЦІНКА АНГАРА</b>\n\n`;
  txt += `<b>Рахунок: ${r.total}/100</b>  ${gradeColors[r.grade]||''} <b>Оцінка: ${r.grade}</b>\n\n`;
  txt += `<b>Деталі:</b>\n`;
  txt += `• Рідкість: ${r.rarScore}/30\n`;
  txt += `• Різноманіття ролей: ${r.diversityScore}/25 (${r.roles}/4 ролей)\n`;
  txt += `• Прогресія Gear Hub: ${r.tierScore}/25\n`;
  txt += `• Мета-мехи: ${r.metaScore}/20\n`;
  txt += `\n<b>Ваш ангар:</b>\n`;
  r.mechs.forEach(m => {
    txt += `${R_ICON[m.role]}${RAR_ICON[m.rar]} ${esc(m.n)} — T${m.g} · ${m.e}E\n`;
  });

  // Recommendations
  const roleCounts = {};
  r.mechs.forEach(m => roleCounts[m.role] = (roleCounts[m.role]||0)+1);
  const missing = ['Attacker','Scout','Tank','Support'].filter(r => !roleCounts[r]);
  if (missing.length) {
    txt += `\n💡 <b>Рекомендації:</b> додай ${missing.join(', ')}\n`;
  }

  txt += FOOTER;
  return txt;
}

function hrKbd(keys, showResult = false) {
  const csv = encMechs(keys);
  if (showResult) {
    return kbd(
      [btn('🗑 Очистити', 'hr:'), btn('🏠 Меню', 'menu')],
    );
  }

  const allKeys = Object.keys(MECHS);
  const available = allKeys.filter(k => !keys.includes(k));

  if (keys.length >= 5) {
    return kbd(
      [btn('⭐ Оцінити ангар', `hr_r:${csv}`)],
      [btn('🗑 Очистити', 'hr:'), btn('🏠 Меню', 'menu')],
    );
  }

  const rows = [];
  for (let i = 0; i < Math.min(available.length, 15); i += 3) {
    rows.push(available.slice(i,i+3).map(k => btn(MECHS[k].n, `hr_a:${sk(k)}:${csv}`)));
  }

  const actions = [btn('🏠 Меню', 'menu')];
  if (keys.length >= 1) actions.unshift(btn('⭐ Оцінити', `hr_r:${csv}`));
  if (keys.length >= 1) actions.unshift(btn('🗑 Очистити', 'hr:'));

  return kbd(
    ...rows,
    actions,
  );
}

// ─ Promo ─
async function promoText() {
  try {
    const r = await fetch(`${SITE_URL}/api/codes`);
    const data = await r.json();
    const codes = data.codes || [];

    if (!codes.length) {
      return `🎁 <b>ПРОМО КОДИ</b>\n\n❌ Зараз немає активних кодів.\nПеревір пізніше!${FOOTER}`;
    }

    let txt = `🎁 <b>АКТИВНІ ПРОМО КОДИ</b> (${codes.length})\n\n`;
    codes.forEach((c, i) => {
      txt += `${i+1}. <code>${esc(c.code)}</code>`;
      if (c.reward) txt += `\n   🎁 ${esc(c.reward)}`;
      txt += '\n\n';
    });
    txt += `⚠️ Коди мають термін дії — активуй якомога швидше!`;
    txt += FOOTER;
    return txt;
  } catch (e) {
    return `🎁 <b>ПРОМО КОДИ</b>\n\n⚠️ Не вдалося завантажити коди.\n<a href="${SITE_URL}/#promo">Відкрий сайт</a> для перегляду кодів.${FOOTER}`;
  }
}

// ─ Maps ─
function mapsText(mode, page) {
  const maps = mode === 'cpc' ? MAP_CPC : MAP_5V5;
  const pages = Math.ceil(maps.length / ITEMS_PER_PAGE);
  const slice = maps.slice(page * ITEMS_PER_PAGE, (page+1)*ITEMS_PER_PAGE);
  const label = mode === 'cpc' ? '📍 CPC — Захоплення точок (13 карт)' : '⚔️ 5v5 Дезматч (36 карт)';
  let txt = `🗺️ <b>ПУТІВНИК КАРТАМИ</b>\n${label}\n\n`;
  slice.forEach((name, i) => {
    txt += `${page * ITEMS_PER_PAGE + i + 1}. ${esc(name)}\n`;
  });
  txt += `\nСторінка ${page+1}/${pages}\n💡 Відкрий повний путівник зі стратегіями на сайті.`;
  txt += FOOTER;
  return txt;
}

function mapsKbd(mode, page) {
  const maps = mode === 'cpc' ? MAP_CPC : MAP_5V5;
  const pages = Math.ceil(maps.length / ITEMS_PER_PAGE);
  const nav = [];
  if (page > 0) nav.push(btn('◀', `maps:${mode}:${page-1}`));
  if (page < pages-1) nav.push(btn('▶', `maps:${mode}:${page+1}`));
  return kbd(
    [btn(mode==='cpc'?'✅ 📍 CPC':'📍 CPC','maps:cpc:0'),
     btn(mode==='5v5'?'✅ ⚔️ 5v5':'⚔️ 5v5','maps:5v5:0')],
    nav.length ? nav : [],
    [lnk('🌐 Відкрити на сайті', `${SITE_URL}#maps`), btn('🏠 Меню', 'menu')],
  );
}

// ─── CALLBACK HANDLERS ───────────────────────────────────
async function handleCallbackQuery(cbq) {
  const cid = cbq.message.chat.id;
  const mid = cbq.message.message_id;
  const d   = cbq.data || '';

  await answerCbq(cbq.id);

  // ─ Helpers
  const upd = (text, keys) => edit(cid, mid, text, { reply_markup: keys });

  // ─ Routing ─
  if (d === 'menu') {
    return upd(menuText(), menuKbd());
  }

  // Mechs list
  if (d.startsWith('mechs:')) {
    const [, role, page] = d.split(':');
    return upd(mechsText(role, +page), mechsKbd(role, +page));
  }

  // Single mech
  if (d.startsWith('mech:')) {
    const [, key, rank] = d.split(':');
    return upd(mechText(key, +rank), mechKbd(key, +rank));
  }

  // Calculator main
  if (d === 'calc') {
    return upd(calcText(), calcKbd());
  }

  // Calc type selector (mech or weapon, with optional page)
  if (d.startsWith('calc_t:')) {
    const parts = d.split(':');
    const type = parts[1];
    const page = +(parts[2] || 0);
    return upd(calcItemsText(type, page), calcItemsKbd(type, page));
  }

  // Calc item selected
  if (d.startsWith('calc_i:')) {
    const [, type, ...rest] = d.split(':');
    const name = rest.join(':');
    return upd(calcFromText(type, name), calcFromKbd(type, name));
  }

  // Calc execute (from:star:level to:star:level)
  if (d.startsWith('calc_x:')) {
    const [, type, ...rest] = d.split(':');
    // rest = name parts + :fs:fl:ts:tl
    // last 4 are fs,fl,ts,tl
    const nums = rest.splice(-4);
    const name = rest.join(':');
    const [fs,fl,ts,tl] = nums;
    return upd(calcResultText(type, name, +fs, +fl, +ts, +tl), calcResultKbd(type, name));
  }

  // Pilot calc
  if (d.startsWith('calc_pt:')) {
    const rar = d.split(':')[1];
    return upd(pilotText(rar), pilotKbd(rar));
  }
  if (d.startsWith('calc_px:')) {
    const [, rar, fs, fl, ts, tl] = d.split(':');
    return upd(pilotResultText(rar, +fs, +fl, +ts, +tl), kbd([btn('◀ Назад',`calc_pt:${rar}`),btn('🏠 Меню','menu')]));
  }

  // Mod calc
  if (d === 'calc_mod' || d.startsWith('calc_mod:')) {
    const page = +(d.split(':')[1] || 0);
    return upd(modCalcText(page), modCalcKbd(page));
  }
  if (d.startsWith('mod_i:')) {
    const [, rar, name] = d.split(':');
    return upd(modFromText(rar, name), modFromKbd(rar, name));
  }
  if (d.startsWith('mod_x:')) {
    const [, rar, name, fl, tl] = d.split(':');
    return upd(modResultText(rar, name, +fl, +tl), kbd([btn('◀ Назад',`mod_i:${rar}:${name}`),btn('🏠 Меню','menu')]));
  }

  // Compare
  if (d === 'cmp:' || d === 'cmp') {
    return upd(cmpText([]), cmpKbd([]));
  }
  if (d.startsWith('cmp:') && d.length > 4) {
    const csv = d.slice(4);
    const keys = decMechs(csv);
    return upd(cmpText(keys), cmpKbd(keys));
  }
  if (d.startsWith('cmp_a:')) {
    const parts = d.slice(6).split(':');
    const newMech = lk(parts[0]);
    const currentKeys = decMechs(parts.slice(1).join(':'));
    const keys = [...new Set([...currentKeys, newMech])].slice(0,3);
    const txt  = cmpText(keys);
    const keyboard = cmpKbd(keys);
    return upd(txt, keyboard);
  }

  // Hangar rate
  if (d === 'hr:' || d === 'hr') {
    return upd(hrText([]), hrKbd([]));
  }
  if (d.startsWith('hr:') && d.length > 3) {
    const csv = d.slice(3);
    const keys = decMechs(csv);
    return upd(hrText(keys), hrKbd(keys));
  }
  if (d.startsWith('hr_a:')) {
    const parts = d.slice(5).split(':');
    const newMech = lk(parts[0]);
    const currentKeys = decMechs(parts.slice(1).join(':'));
    const keys = [...new Set([...currentKeys, newMech])].slice(0,5);
    return upd(hrText(keys), hrKbd(keys));
  }
  if (d.startsWith('hr_r:')) {
    const csv = d.slice(5);
    const keys = decMechs(csv);
    return upd(hrResultText(keys), hrKbd(keys, true));
  }

  // Promo
  if (d === 'promo') {
    const text = await promoText();
    return upd(text, kbd([btn('↻ Оновити', 'promo'), btn('🏠 Меню', 'menu')]));
  }

  // Maps
  if (d.startsWith('maps:')) {
    const [, mode, page] = d.split(':');
    return upd(mapsText(mode, +page), mapsKbd(mode, +page));
  }
}

// ─── MESSAGE HANDLER ─────────────────────────────────────
async function handleMessage(msg) {
  if (!msg || !msg.text) return;
  const cid = msg.chat.id;
  const txt = msg.text.toLowerCase().trim();

  const welcome = () => send(cid, menuText(), { reply_markup: menuKbd() });

  if (['/start','/menu','/help'].includes(txt)) return welcome();
  if (['/mechs','/мехи'].includes(txt))     return send(cid, mechsText('all',0), { reply_markup: mechsKbd('all',0) });
  if (['/calc','/калькулятор'].includes(txt)) return send(cid, calcText(), { reply_markup: calcKbd() });
  if (['/compare','/порівняння'].includes(txt)) return send(cid, cmpText([]), { reply_markup: cmpKbd([]) });
  if (['/hangar','/ангар'].includes(txt))   return send(cid, hrText([]), { reply_markup: hrKbd([]) });
  if (['/promo','/промо'].includes(txt)) {
    const promoTxt = await promoText();
    return send(cid, promoTxt, { reply_markup: kbd([btn('↻ Оновити','promo'),btn('🏠 Меню','menu')]) });
  }
  if (['/maps','/карти'].includes(txt))     return send(cid, mapsText('cpc',0), { reply_markup: mapsKbd('cpc',0) });

  // search mech by name
  const key = Object.keys(MECHS).find(k => MECHS[k].n.toLowerCase() === txt);
  if (key) return send(cid, mechText(key,1), { reply_markup: mechKbd(key,1) });

  // default
  return welcome();
}

// ─── MAIN EXPORT ─────────────────────────────────────────
module.exports = async function(req, res) {
  if (!BOT_TOKEN) {
    return res.status(500).json({ error: 'BOT_TOKEN not set' });
  }
  if (req.method !== 'POST') {
    return res.status(200).send('Mech Arena Hub Bot is running ✅');
  }

  try {
    const update = req.body;
    if (update.message)          await handleMessage(update.message);
    else if (update.callback_query) await handleCallbackQuery(update.callback_query);
  } catch (e) {
    console.error('Bot error:', e.message);
  }

  res.status(200).json({ ok: true });
};
