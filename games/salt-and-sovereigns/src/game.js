"use strict";
/* =====================================================================
   Salt & Sovereigns — Open Waters
   Single-file top-down 2D pirate trading game (HTML5 Canvas)
   ===================================================================== */

const SAVE_KEY = "salt_sovereigns_canvas_v1";
const SAVE_VER = 10;
const SLOT_KEY = "salt_sovereigns_slots_v1";   // multi-voyage save slots

/* v3.4 — Captain Level: a separate track from Maritime Rank (which is built
   purely from empire/property score). This one earns experience from EVERY
   kind of play — trading, contracts, smuggling, combat, auctions, property —
   so a privateer, a smuggler and a merchant all level up their captain the
   same way even if they never touch each other's systems. Titles only; it
   does not gate or unlock anything, so it can't destabilise existing balance. */
const CAPTAIN_TITLES = [
  "Deckhand", "Able Seaman", "Quartermaster's Mate", "Bosun", "First Mate",
  "Sailing Master", "Privateer Captain", "Post-Captain", "Commodore", "Admiral of the Salt",
];
const LEVEL_XP = [0, 150, 400, 800, 1400, 2200, 3200, 4500, 6200, 8500];
function levelFromXp(xp){
  let lvl = 1;
  for(let i = 1; i < LEVEL_XP.length; i++){ if(xp >= LEVEL_XP[i]) lvl = i + 1; }
  return lvl;
}
function captainTitle(lvl){ return CAPTAIN_TITLES[clamp(lvl, 1, CAPTAIN_TITLES.length) - 1]; }
function xpToNext(xp){
  const lvl = levelFromXp(xp);
  if(lvl >= CAPTAIN_TITLES.length) return null;   // maxed out
  return { need: LEVEL_XP[lvl], have: xp };
}
/* Every XP-earning action anywhere in the game funnels through here so the
   level-up toast and title never have to be duplicated at each call site. */
function gainXp(amount, reason){
  if(!G || !isFinite(amount) || amount <= 0) return;
  const before = levelFromXp(G.xp || 0);
  G.xp = (G.xp || 0) + Math.round(amount);
  const after = levelFromXp(G.xp);
  if(after > before){
    setTimeout(()=>toast(`⭐ Level up — you're now a ${captainTitle(after)} (Level ${after}).`, {kind:"save", life:4200}), 300);
  }
}

/* v1.5 — lifetime statistics. Every field defaults to 0 so old saves upgrade cleanly. */
function freshStats(){
  return {
    smugglingRuns:0, smugglingSuccess:0, smugglingFail:0,
    timesCaught:0, timesEscaped:0, timesInspected:0, timesHidden:0, contrabandSold:0,
    neverCaughtStreak:0, bestNeverCaughtStreak:0,
    islandsVisited:0, portDockings:0, daysPassed:0, shipwrecks:0, reefHits:0,
    goldEarned:0, goldSpent:0, bestTradeProfit:0, biggestBuy:0, biggestSale:0,
    goodsBought:0, goodsSold:0,
    navalEncounters:0, navalWins:0, navalEscapes:0, navalLosses:0, cargoLost:0,
    shipUpgrades:0, servicesBought:0, jobsCompleted:0, jobsFailed:0, repairs:0,
    legalJobPay:0, contrabandPay:0, passiveCollected:0, auctionsWon:0,
    auctionsWonRare:0, auctionsWonEpic:0, auctionsWonLegendary:0,
    bountyEarnings:0, highestBounty:0,
    seenPorts:{},
  };
}
function normalizeStats(s){
  const base = freshStats();
  if(s && typeof s === "object"){
    for(const k in base){
      if(k === "seenPorts"){ base.seenPorts = (s.seenPorts && typeof s.seenPorts === "object") ? {...s.seenPorts} : {}; }
      else if(isFinite(Number(s[k]))) base[k] = Number(s[k]);
    }
  }
  return base;
}
function freshUpgrades(){ return { speed:0, accel:0, turn:0, hull:0 }; }
function freshCrew(){ return { navigator:false, lookout:false, gunner:false, quartermaster:false }; }
function freshCosmetic(){ return { hull:"oak", sail:"cream" }; }
function freshGrand(){ return { ironhull:false, charter:false, clipper:false, galleon:false }; }

/* v2.8 — Legendary Ships. `active` is the owned ship's key currently flagged (or
   null for your original ship); `owned` lists every legendary hull you've
   commissioned so you can switch freely between them. `activeBonus` is the
   EXACT {hp, cargo} delta the active ship currently adds to G.hpMax/G.cargoMax —
   see activateLegendary() for why this must be tracked explicitly rather than
   recomputed from a fixed "base", so switching never drifts or duplicates hull
   points no matter how many Shipwright/Grand Fitting purchases happen between
   switches. `galleonBlueprint` is set by the Black Market Auction's Legendary
   Vessel Blueprint prize and gates the Royal Galleon. */
function freshLegendary(){ return { active:null, owned:[], activeBonus:{hp:0,cargo:0}, galleonBlueprint:false }; }

/* v2.3 — Passive gold flow. A small drip from business ventures the captain buys
   into; it pays out each in-game day (i.e. each night you Rest) and piles up in a
   ledger you collect at any port. Designed as the foundation for Port Real Estate
   later, so it is kept as its own G.passive block. */
function freshPassive(){ return { accrued:0, ventures:0, lastCollectDay:1 }; }
const VENTURE_INCOME = 45;      // gold per in-game day, per venture share
const VENTURE_MAX    = 12;      // late-game ceiling → +540/day
function ventureCost(n){ return 2500 + n * 1500; }              // escalating buy-in
function passiveDailyRate(){ return ((G.passive && G.passive.ventures) || 0) * VENTURE_INCOME; }
function accruePassive(){        // called once per day advance
  if(!G.passive) G.passive = freshPassive();
  G.passive.accrued += passiveDailyRate();
}

/* =====================================================================
   v2.5 — Port Real Estate & Businesses ("Empire").
   One business per port, drawn straight from that port's existing type/
   produces/specialty (see the `business` field on each PORTS entry). Two
   kinds:
     "production" — makes a real, existing GOODS commodity over time, into
                     a per-property store the player collects on a visit.
     "shipyard" / "trade" / "storage" — a standing bonus felt only at that
                     port, so owning it still gives a reason to come back.
   Levels 1-3. Fully self-contained in G.properties, keyed by port id.
   ===================================================================== */
const PROP_MAX_LEVEL = 3;
const PROP_BUY_COST = 16000;                          // level 0 -> 1 (purchase)
const PROP_UPGRADE_COST = { 2: 28000, 3: 52000 };     // cost to reach level 2 / level 3
const PROP_STORAGE_DAYS = 12;                          // production storage cap ≈ this many days' output
const PROP_LEVEL_TARGET = { 1: 150, 2: 320, 3: 600 };  // gold-equivalent output/day, scaled by the good's own price
const SHIPYARD_DISCOUNT = { 1: 0.05, 2: 0.10, 3: 0.15 };
const TRADEHOUSE_BONUS  = { 1: 0.03, 2: 0.06, 3: 0.10 };
const WAREHOUSE_CAP     = { 1: 150, 2: 300, 3: 450 };

function freshProperties(){ return {}; }
function propOwned(portId){ const p = G.properties && G.properties[portId]; return p && p.level > 0 ? p : null; }
function propDef(portId){ const p = portById(portId); return p && p.business; }
/* production rate: cheaper goods produce more units, pricier goods fewer —
   keeps every production business worth roughly the same at a given level */
function propRate(portId, level){
  const def = propDef(portId); if(!def || def.kind !== "production") return 0;
  const g = GOODS.find(x => x.id === def.good);
  return Math.max(1, Math.round(PROP_LEVEL_TARGET[level] / g.base));
}
function propCap(portId, level){ return propRate(portId, level) * PROP_STORAGE_DAYS; }
function propUpgradeCost(level){ return level <= 0 ? PROP_BUY_COST : (PROP_UPGRADE_COST[level + 1] || 0); }

function buyOrUpgradeProperty(portId){
  const def = propDef(portId);
  if(!def) return;
  if(!G.properties) G.properties = freshProperties();
  const cur = G.properties[portId] || { level: 0, stored: 0 };
  if(cur.level >= PROP_MAX_LEVEL){ toast(`${def.name} is already fully developed.`); return; }
  const cost = propUpgradeCost(cur.level);
  if(G.gold < cost){ toast(`${cur.level === 0 ? "Buying into" : "Upgrading"} ${def.name} costs ${fmt(cost)} gold.`); return; }
  spend(cost);
  cur.level += 1;
  if(cur.stored == null) cur.stored = 0;
  G.properties[portId] = cur;
  bump("servicesBought");
  gainXp(20, "property");
  toast(cur.level === 1
    ? `⚓ ${def.name} acquired — Level 1. Another stone in your empire.`
    : `⚓ ${def.name} expanded to Level ${cur.level}.`, {kind:"save", life:4200});
  afterTrade();
}
function collectProperty(portId){
  const def = propDef(portId); const own = propOwned(portId);
  if(!def || !own || def.kind !== "production") return;
  const amt = Math.min(own.stored || 0, G.cargoMax - totalCargo());
  if(amt <= 0){
    toast((own.stored || 0) <= 0 ? "Nothing ready to collect yet." : "Your hold is full — sell or store cargo first.");
    return;
  }
  const had = G.cargo[def.good] || 0, avg = G.avg[def.good] || GOODS.find(x=>x.id===def.good).base;
  G.cargo[def.good] = had + amt;
  G.avg[def.good] = (had * avg + amt * 0) / (had + amt);   // produced goods cost nothing to make
  own.stored -= amt;
  toast(`Collected ${amt} ${goodName(def.good)} from ${def.name}.`, {kind:"save"});
  afterTrade();
}
/* utility-property effects — additive bonuses at the property's own port only */
function shipyardDiscount(portId){
  const own = propOwned(portId); const def = propDef(portId);
  return (own && def && def.kind === "shipyard") ? SHIPYARD_DISCOUNT[own.level] : 0;
}
function tradeHouseBonus(portId){
  const own = propOwned(portId); const def = propDef(portId);
  return (own && def && def.kind === "trade") ? TRADEHOUSE_BONUS[own.level] : 0;
}
function warehouseCap(portId){
  const own = propOwned(portId); const def = propDef(portId);
  return (own && def && def.kind === "storage") ? WAREHOUSE_CAP[own.level] : 0;
}
function warehouseStoreAll(){
  const port = currentPort; if(!port) return;
  const cap = warehouseCap(port.id);
  if(cap <= 0) return;
  let room = cap - storedCargo(), moved = 0;
  if(room <= 0){ toast("The warehouse is full."); return; }
  for(const g of GOODS){
    if(room <= 0) break;
    const qty = G.cargo[g.id] || 0; if(qty <= 0) continue;
    const take = Math.min(qty, room);
    G.cargo[g.id] -= take;
    G.storage[g.id] = (G.storage[g.id] || 0) + take;
    room -= take; moved += take;
  }
  if(moved <= 0){ toast("Nothing in your hold to store."); return; }
  toast(`Stored ${moved} cargo in the ${propDef(port.id).name}.`, {kind:"save"});
  afterTrade();
}
function warehouseRetrieveAll(){
  const port = currentPort; if(!port) return;
  let space = G.cargoMax - totalCargo(), moved = 0;
  if(space <= 0){ toast("Your hold is full."); return; }
  for(const g of GOODS){
    if(space <= 0) break;
    const qty = (G.storage && G.storage[g.id]) || 0; if(qty <= 0) continue;
    const take = Math.min(qty, space);
    G.storage[g.id] -= take;
    G.cargo[g.id] = (G.cargo[g.id] || 0) + take;
    space -= take; moved += take;
  }
  if(moved <= 0){ toast("Nothing in the warehouse to retrieve."); return; }
  toast(`Brought ${moved} cargo back aboard from the warehouse.`, {kind:"save"});
  afterTrade();
}
function accrueProperties(){     // called once per day advance, alongside accruePassive
  if(!G.properties) G.properties = freshProperties();
  for(const p of PORTS){
    const own = G.properties[p.id];
    if(!own || own.level <= 0 || !p.business || p.business.kind !== "production") continue;
    const cap = propCap(p.id, own.level);
    own.stored = Math.min(cap, (own.stored || 0) + propRate(p.id, own.level));
  }
}

/* =====================================================================
   v2.6 — Trade Monopolies. A read-only layer computed live from the Port
   Real Estate a captain already owns (G.properties) — nothing new is saved.
   For every good with a production business, influence rises with that
   property's level and how full its stockpile is running (i.e. real,
   ongoing supply — not just a one-time purchase). Effects are small,
   capped, and applied as bonuses on top of the existing market, never by
   changing priceAt/normalPrice or the buy/sell-pressure formula itself.
   ===================================================================== */
const MONOPOLY_GOODS = ["rum", "sugar", "gems", "fish", "ore"];   // the goods that have a production property
const INFLUENCE_TIERS = [
  { min: 85, name: "Monopoly" },
  { min: 60, name: "Dominant Supplier" },
  { min: 30, name: "Major Trader" },
  { min: 1,  name: "Local Supplier" },
  { min: 0,  name: "No Influence" },
];
/* the port that produces a given good, if any */
function monopolyPort(goodId){ return PORTS.find(p => p.business && p.business.kind === "production" && p.business.good === goodId); }
/* 0-100 trade influence score for a good, derived from the property you own for it */
function tradeInfluence(goodId){
  const port = monopolyPort(goodId); if(!port) return 0;
  const own = propOwned(port.id); if(!own) return 0;
  // levels alone walk through Local Supplier (L1) -> Major Trader (L2) -> Dominant Supplier (L3);
  // only a level-3 business run at a near-full stockpile actually reaches Monopoly
  const levelPct = [0, 20, 45, 75][own.level] || 0;
  const cap = propCap(port.id, own.level);
  const flowBonus = cap > 0 ? Math.round((own.stored / cap) * 10) : 0;   // an active, well-stocked business edges higher
  return clamp(levelPct + flowBonus, 0, 100);
}
function influenceTierName(pct){ return (INFLUENCE_TIERS.find(t => pct >= t.min) || INFLUENCE_TIERS[INFLUENCE_TIERS.length - 1]).name; }
/* bounded, symmetric trade bonus by tier — never more than ±10% */
function influenceBonus(goodId){
  const pct = tradeInfluence(goodId);
  if(pct >= 85) return 0.10;
  if(pct >= 60) return 0.06;
  if(pct >= 30) return 0.03;
  return 0;
}
/* Dominant Suppliers and Monopolies feel steadier local prices for their good */
function influencePressureMult(goodId){
  const pct = tradeInfluence(goodId);
  if(pct >= 85) return 0.5;
  if(pct >= 60) return 0.75;
  return 1;
}
/* a light, capped bonus on supply-contract payouts for a good you dominate */
function influenceContractMult(goodId){ return tradeInfluence(goodId) >= 60 ? 1.15 : 1; }
/* the title the isles know you by — emerges from existing stats + influence, nothing new tracked */
function empireIdentity(){
  const candidates = [];
  const titleFor = { rum:"Rum Baron", sugar:"Sugar King", gems:"Gem Tycoon", fish:"Fish Monger Supreme", ore:"Iron Magnate" };
  for(const gid of MONOPOLY_GOODS){
    const pct = tradeInfluence(gid);
    if(pct >= 30) candidates.push({ title: titleFor[gid], score: pct });
  }
  const infra = ["portroyal", "nassau", "maracaibo"].filter(id => propOwned(id)).length;
  if(infra >= 2) candidates.push({ title: "Shipping Baron", score: 35 + infra * 12 });
  const s = G.stats || {};
  if((s.contrabandPay || 0) > 2000 && (s.contrabandPay || 0) > (s.legalJobPay || 0))
    candidates.push({ title: "Smuggling Tycoon", score: Math.min(95, (s.contrabandPay || 0) / 400) });
  if((s.jobsCompleted || 0) >= 15)
    candidates.push({ title: "Contract Merchant", score: Math.min(90, (s.jobsCompleted || 0) * 3) });
  if(!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].title;
}

/* =====================================================================
   v2.7 — Black Market Auctions. Rare, time-limited gold sinks that spawn
   at a random pirate haven and must be reached before they lapse. Fully
   self-contained in G.auction (null when none is running); only ever
   pays out through the existing earn()/spend()/G.cargo/G.hpMax/G.cargoMax/
   G.cannons/G.falseHolds fields — no new mechanics of its own.
   ===================================================================== */
const AUCTION_SPAWN_CHANCE = 0.15;     // rolled once per Rest, only if no auction is already running
const AUCTION_WINDOW_DAYS  = [3, 5];   // days you have to reach the port before it lapses
const AUCTION_MAX_ROUNDS   = 8;        // hard cap so a bidding war always resolves

const AUCTION_RARITY = {
  rare:      { label: "Rare",      order: 0, weight: 0.60, startMin: 8000,  startMax: 15000,  rivalMult: 1.0 },
  epic:      { label: "Epic",      order: 1, weight: 0.30, startMin: 25000, startMax: 45000,  rivalMult: 1.4 },
  legendary: { label: "Legendary", order: 2, weight: 0.10, startMin: 60000, startMax: 120000, rivalMult: 2.2 },
};
const AUCTION_ITEMS = {
  rare: [
    { key:"treasuremap", name:"Treasure Map", icon:"🗺️",
      desc:"A route to a forgotten cache of gold, marked in another captain's hand.",
      apply(){ const g = earn(6000 + Math.floor(Math.random() * 4000)); return `+${fmt(g)} gold from the buried cache.`; } },
    { key:"rarecargo", name:"Rare Cargo Contract", icon:"📜",
      desc:"A sealed contract for a hold of fine silk, no questions asked.",
      apply(){
        const take = Math.min(20, G.cargoMax - totalCargo());
        if(take <= 0) return "Your hold was full — the silk was left on the dock.";
        const had = G.cargo.silk || 0, avg = G.avg.silk || GOODS.find(x=>x.id==="silk").base;
        G.cargo.silk = had + take; G.avg.silk = (had*avg) / (had + take);
        return `+${take} Silk delivered straight to your hold.`;
      } },
    { key:"hiddencompartment", name:"Smuggler's Hidden Compartment", icon:"🗝️",
      desc:"Master joinery — one more place the harbourmaster will never find.",
      apply(){
        if((G.falseHolds || 0) < 3){ G.falseHolds = (G.falseHolds || 0) + 1; return "A new false hold, fitted in secret."; }
        const g = earn(5000); return `Every hold's already hidden — paid out ${fmt(g)} gold instead.`;
      } },
  ],
  epic: [
    { key:"cannonupgrade", name:"Rare Cannon Casting", icon:"💣",
      desc:"A masterwork cannon, cast by a name spoken only in whispers.",
      apply(){
        if((G.cannons || 0) < CANNON_MAX){ G.cannons = (G.cannons || 0) + 1; return "A free pair of cannons, run straight out."; }
        const g = earn(8000); return `Your guns are already full — paid out ${fmt(g)} gold instead.`;
      } },
    { key:"shipcomponent", name:"Unique Ship Component", icon:"⚙️",
      desc:"A reinforced keel fitting — shipwrights say there's only one like it.",
      apply(){ G.hpMax += 25; G.hp += 25; return "+25 max hull, permanently."; } },
  ],
  legendary: [
    { key:"blueprint", name:"Legendary Vessel Blueprint", icon:"📐",
      desc:"Shipwrights speak of this hull in hushed tones. Whoever holds it holds a legend.",
      apply(){
        G.cargoMax += 50; G.hpMax += 40; G.hp += 40; const g = earn(15000);
        if(!G.legendary) G.legendary = freshLegendary();
        G.legendary.galleonBlueprint = true;   // v2.8 — unlocks the Royal Galleon commission
        return `+50 cargo, +40 max hull, ${fmt(g)} gold, and the Royal Galleon's blueprint — the legend made real.`; } },
  ],
};
const AUCTION_ARCHETYPES = [
  { key:"reckless", name:"Reckless Pirate",  desc:"Bids wild and fast — doesn't always think it through.",
    budgetMin:15000, budgetMax:60000,  overbid:0.75, jumpMin:1.15, jumpMax:1.60 },
  { key:"merchant", name:"Wealthy Merchant", desc:"Deep pockets, and in no hurry to spend them.",
    budgetMin:40000, budgetMax:140000, overbid:0.50, jumpMin:1.05, jumpMax:1.20 },
  { key:"defector", name:"Navy Defector",    desc:"Quiet. Never short of coin, or short of reasons why.",
    budgetMin:30000, budgetMax:100000, overbid:0.45, jumpMin:1.08, jumpMax:1.30 },
  { key:"hunter",   name:"Treasure Hunter",  desc:"Wants this one badly — and it shows.",
    budgetMin:20000, budgetMax:80000,  overbid:0.65, jumpMin:1.10, jumpMax:1.40 },
  { key:"tycoon",   name:"Rival Tycoon",     desc:"Bids to win, almost whatever it costs.",
    budgetMin:50000, budgetMax:180000, overbid:0.58, jumpMin:1.10, jumpMax:1.25 },
];

function rollAuctionRarity(){
  const r = Math.random();
  let acc = 0;
  for(const key of ["rare", "epic", "legendary"]){
    acc += AUCTION_RARITY[key].weight;
    if(r < acc) return key;
  }
  return "rare";
}
function auctionIncrement(bid){ return Math.max(500, Math.round(bid * (0.08 + Math.random() * 0.06))); }
function auctionLog(entry){ if(G.auction){ G.auction.log = (G.auction.log || []).concat(entry).slice(-8); } }

/* try to start a new auction — called once per Rest; no-ops if one is already running */
function maybeSpawnAuction(){
  if(G.auction) return;
  if(Math.random() >= AUCTION_SPAWN_CHANCE) return;
  const havens = PORTS.filter(p => p.faction === "haven");
  const port = havens[Math.floor(Math.random() * havens.length)];
  const rarity = rollAuctionRarity();
  const meta = AUCTION_RARITY[rarity];
  const itemDef = AUCTION_ITEMS[rarity][Math.floor(Math.random() * AUCTION_ITEMS[rarity].length)];
  const startBid = Math.round(meta.startMin + Math.random() * (meta.startMax - meta.startMin));

  const pool = AUCTION_ARCHETYPES.slice();
  const rivalCount = 2 + Math.floor(Math.random() * 2);   // 2-3 rivals
  const rivals = [];
  for(let i = 0; i < rivalCount && pool.length; i++){
    const idx = Math.floor(Math.random() * pool.length);
    const a = pool.splice(idx, 1)[0];
    const budget = Math.round((a.budgetMin + Math.random() * (a.budgetMax - a.budgetMin)) * meta.rivalMult);
    rivals.push({ name:a.name, archetype:a.key, desc:a.desc, budget, overbid:a.overbid, jumpMin:a.jumpMin, jumpMax:a.jumpMax, dropped:false });
  }

  G.auction = {
    id: Math.random().toString(36).slice(2, 9),
    portId: port.id,
    spawnDay: G.day,
    expiresDay: G.day + AUCTION_WINDOW_DAYS[0] + Math.floor(Math.random() * (AUCTION_WINDOW_DAYS[1] - AUCTION_WINDOW_DAYS[0] + 1)),
    rarity, itemKey: itemDef.key,
    startBid, currentBid: startBid, leader: null, rounds: 0,
    rivals, log: [], resolved: false, result: null,
  };
  toast(`⚠ BLACK MARKET AUCTION — word reaches you of a ${meta.label.toUpperCase()} item up for bid at ${port.name}. Be there by Day ${G.auction.expiresDay}.`,
    { kind:"warn", life:5200 });
}
function auctionItemDef(){ return G.auction && AUCTION_ITEMS[G.auction.rarity].find(i => i.key === G.auction.itemKey); }
function auctionExpireCheck(){
  if(!G.auction || G.auction.resolved) return;
  if(G.day > G.auction.expiresDay){
    toast(`The black market auction at ${portById(G.auction.portId).name} came and went without you.`, {kind:"warn"});
    G.auction = null;
  }
}
function auctionActiveAt(portId){
  return G.auction && !G.auction.resolved && G.auction.portId === portId && G.day <= G.auction.expiresDay;
}

function openAuction(){
  if(!G.auction) return;
  auctionLog(G.auction.rounds === 0 ? "The bidding floor opens." : "You step back up to the bidding floor.");
  overlayOpen("auctionModal");
  renderAuction();
}
function closeAuction(){
  const port = currentPort;
  overlayDrop("auctionModal");   // don't auto-resume open water — the trade window opens next
  if(G.auction && G.auction.resolved) G.auction = null;   // fully settled — clear the slot for a future auction
  saveLocal();
  if(port) proceedToTrade(port);
  else resumeFromOverlays();
}
/* the next bid is rolled once and shown to the player — what you see is what you pay,
   only the rivals' reaction to it is left uncertain */
function auctionNextBid(){
  const a = G.auction; if(!a) return 0;
  if(a.pendingNext == null) a.pendingNext = a.currentBid + auctionIncrement(a.currentBid);
  return a.pendingNext;
}

function auctionPlaceBid(){
  const a = G.auction; if(!a || a.resolved) return;
  const bid = auctionNextBid();
  if(G.gold < bid){ toast("You can't cover that bid."); return; }
  a.pendingNext = null;   // spent — the next round rolls a fresh one
  a.currentBid = bid; a.leader = "player"; a.rounds += 1;
  auctionLog(`You bid ${fmt(bid)} gold.`);

  // one rival — the most willing — may answer your bid
  const live = a.rivals.filter(r => !r.dropped);
  for(const r of live){ if(r.budget < a.currentBid * 1.05) r.dropped = true; }
  const willing = a.rivals.filter(r => !r.dropped && Math.random() < r.overbid);
  if(willing.length && a.rounds < AUCTION_MAX_ROUNDS){
    const r = willing[Math.floor(Math.random() * willing.length)];
    const raise = Math.round(a.currentBid * (r.jumpMin + Math.random() * (r.jumpMax - r.jumpMin)));
    if(raise <= r.budget){
      a.currentBid = raise; a.leader = r.name;
      auctionLog(`💰 ${r.name} raises to ${fmt(raise)} gold!`);
    }else{
      r.dropped = true;
      auctionLog(`${r.name} shakes their head and steps back.`);
    }
  }

  if(a.rounds >= AUCTION_MAX_ROUNDS && a.leader !== "player"){
    auctionLog("The auctioneer calls time — bidding is closed.");
    auctionResolve();
  }else if(a.leader === "player"){
    const stillLive = a.rivals.some(r => !r.dropped);
    if(!stillLive){ auctionLog("No one else is bidding. Going once… going twice…"); auctionResolve(); }
  }
  renderAuction();
  saveLocal();
}
function auctionWalkAway(){
  const a = G.auction; if(!a || a.resolved) return;
  a.resolved = true; a.result = "walked";
  const item = auctionItemDef();
  toast(`You step back from the bidding — the ${item ? item.name : "item"} goes to another buyer.`, {kind:"warn"});
  renderAuction(); saveLocal();
}
function auctionResolve(){
  const a = G.auction; if(!a || a.resolved) return;
  a.resolved = true;
  const item = auctionItemDef();
  if(a.leader === "player"){
    spend(a.currentBid);
    const resultText = item.apply();
    a.result = "won";
    bump("servicesBought"); bump("auctionsWon");
    if(a.rarity === "rare") bump("auctionsWonRare");
    else if(a.rarity === "epic") bump("auctionsWonEpic");
    else if(a.rarity === "legendary") bump("auctionsWonLegendary");
    gainXp(50, "auction");
    toast(`🏆 SOLD — you win the ${item.name} for ${fmt(a.currentBid)} gold! ${resultText}`, {kind:"save", life:6000});
  }else{
    a.result = "lost";
    toast(`SOLD — ${a.leader} takes the ${item.name} for ${fmt(a.currentBid)} gold.`, {kind:"warn", life:4600});
  }
}
function renderAuction(){
  const a = G.auction;
  const modal = document.getElementById("auctionModal");
  if(!a || !modal) return;
  const item = auctionItemDef();
  const meta = AUCTION_RARITY[a.rarity];
  document.getElementById("aucTitle").innerHTML =
    `${item.icon} ${item.name} <span class="rarity-tag rarity-${a.rarity}">${meta.label}</span>`;
  document.getElementById("aucDesc").textContent = item.desc;
  document.getElementById("aucCurBid").textContent = fmt(a.currentBid);
  document.getElementById("aucLeader").textContent = a.leader === "player" ? "You" : (a.leader || "—");
  document.getElementById("aucGold").textContent = fmt(G.gold);
  document.getElementById("aucNext").textContent = fmt(auctionNextBid());
  document.getElementById("aucRivals").innerHTML = a.rivals.map(r =>
    `<div class="auc-rival${r.dropped ? " out" : ""}${a.leader === r.name ? " leading" : ""}">
      <b>${r.name}</b><span class="muted">${r.desc}</span>
      <span class="auc-rival-state">${r.dropped ? "dropped out" : (a.leader === r.name ? "leading" : "still bidding")}</span>
    </div>`).join("");
  document.getElementById("aucLog").innerHTML = (a.log || []).map(l => `<div>${l}</div>`).join("");
  const logEl = document.getElementById("aucLog"); logEl.scrollTop = logEl.scrollHeight;

  const bidBtn = document.getElementById("aucBidBtn");
  const walkBtn = document.getElementById("aucWalkBtn");
  const closeBtn = document.getElementById("aucCloseBtn");
  const resultEl = document.getElementById("aucResult");
  if(a.resolved){
    bidBtn.hidden = true; walkBtn.hidden = true; closeBtn.hidden = false;
    resultEl.hidden = false;
    resultEl.textContent =
      a.result === "won" ? `You won the ${item.name}!` :
      a.result === "walked" ? "You walked away from the bidding." :
      `${a.leader} won the ${item.name}.`;
  }else{
    bidBtn.hidden = false; walkBtn.hidden = false; closeBtn.hidden = true;
    resultEl.hidden = true; resultEl.textContent = "";
    bidBtn.textContent = `Place Bid — ${fmt(auctionNextBid())} gold`;
    bidBtn.disabled = G.gold < auctionNextBid();
  }
}
const CREW_DEFS = [
  { key:"navigator",    name:"Navigator",    cost:900,  desc:"Reads the water — reef strikes do 45% less hull damage." },
  { key:"lookout",      name:"Lookout",      cost:800,  desc:"Spots trouble early — boarding countdown +2s, patrols warn sooner." },
  { key:"gunner",       name:"Master Gunner",cost:1100, desc:"Doubles your weight in a fight against a patrol." },
  { key:"quartermaster",name:"Quartermaster",cost:950,  desc:"Works the docks — your own trades move local prices half as much." },
];
const HULL_PAINT = { oak:"#5a3a22", black:"#26221f", green:"#2f4a34", crimson:"#5a2424", azure:"#28405a", ivory:"#8a7a5e",
  steel:"#6c7580", ember:"#8a3a1e" };   // v2.9 — steel unlocks at Magnate rank, ember at Maritime Tycoon
const SAIL_PAINT = { cream:"#efe6cf", red:"#c85a4a", black:"#2c2c2c", blue:"#5a7fae", gold:"#e6c15a",
  violet:"#7a5aa8", noir:"#141414" };   // v2.9 — same rank gate as the matching hull colours
/* rank index (into RANK_DEFS) required to unlock each cosmetic — everything not
   listed here has always been free, so old saves are unaffected */
const RANK_PAINT_GATE = { steel:4, ember:6, violet:4, noir:6 };
const FORTUNE_TARGET = 1000000;        // v1.9 — the real long-term goal: build a Fortune
const WORLD = { w: 6400, h: 4400 };   // v1.6 — larger open sea, 8 ports

/* v1.9.1 — an ordered wealth ladder: two early checkpoints, four Grand Fittings, the Fortune.
   10k → 25k → 45k → 150k → 250k → 500k → 1,000,000 */
const WIN_TARGET       = 10000;       // "established trader" — an early checkpoint, not the end
const SEASONED_TARGET  = 25000;       // "seasoned trader" — second checkpoint

/* Grand Fittings: large, wealth-gated milestone upgrades, priced on the ladder */
const GRAND_DEFS = [
  { key:"ironhull", name:"Ironbound Hull",      cost:45000,
    desc:"+50 max hull and −25% to ALL damage taken — reef, cannon and boarding." },
  { key:"charter",  name:"Master's Charter",    cost:150000,
    desc:"+40% on every contract payout and prize you take from a patrol." },
  { key:"clipper",  name:"Bluewater Clipper Rig", cost:250000,
    desc:"+22% top speed and +16% acceleration — stacks on Shipwright work." },
  { key:"galleon",  name:"Galleon Conversion",  cost:500000,
    desc:"+60 cargo, +25 max hull, and room for two more contracts (6 total)." },
];

/* v2.8 — Legendary Ships: whole vessels, not upgrades. Every multiplier applies
   to your CURRENT hpMax/cargoMax at the moment you switch (see
   activateLegendary()), so upgrades you've already bought still matter — but
   each one is a real trade-off, never a strict improvement on your own ship. */
const LEGENDARY_SHIPS = [
  { key:"shadowsloop", name:"Shadow Sloop", icon:"🌑",
    tagline:"Built to outrun trouble, not survive it.",
    cost:180000, unlock:{ type:"gold" },
    hullMult:0.70, cargoMult:0.60, speedMult:1.28, accelMult:1.32, turnMult:1.38, combatBonus:-8,
    passiveName:"Silent Running", passiveDesc:"Boarding crews take 2 extra seconds to grapple you.",
    weakness:"Thin hull and a small hold — a single bad reef or broadside costs you dearly." },
  { key:"ironclad", name:"Ironclad Dredger", icon:"⚙️",
    tagline:"Slow as a fortress, and built like one.",
    cost:260000, unlock:{ type:"milestone", reason:"Requires Seasoned Trader status (25,000 net worth) and the Ironbound Hull fitted." },
    hullMult:1.55, cargoMult:1.15, speedMult:0.70, accelMult:0.65, turnMult:0.68, combatBonus:18,
    passiveName:"Iron Hull", passiveDesc:"An extra 15% off all damage taken, stacking with Ironbound Hull.",
    weakness:"Sluggish and slow to turn — patrols and reefs alike are hard to escape." },
  { key:"royalgalleon", name:"Royal Galleon", icon:"👑",
    tagline:"A crown vessel in all but name — vast hold, real broadsides, never nimble.",
    cost:420000, unlock:{ type:"blueprint", reason:"Requires the Legendary Vessel Blueprint, won at a Black Market Auction." },
    hullMult:1.30, cargoMult:1.75, speedMult:0.85, accelMult:0.80, turnMult:0.72, combatBonus:12,
    passiveName:"Royal Warrant", passiveDesc:"Crown ports are 35% less likely to flag you for a dock inspection.",
    weakness:"Enormous upfront cost, and she turns like the fortress she resembles." },
  { key:"ghostrunner", name:"Ghost Runner", icon:"👻",
    tagline:"Not built to fight — built to have never been there at all.",
    cost:320000, unlock:{ type:"achievement", streak:12, reason:"Requires a best never-caught streak of 12 port dockings." },
    hullMult:0.85, cargoMult:0.80, speedMult:1.15, accelMult:1.12, turnMult:1.22, combatBonus:-4,
    passiveName:"Vanishing Trick", passiveDesc:"Fleeing a patrol raises no wanted level and costs half the usual hull damage.",
    weakness:"Still can't stand and fight — and her hold isn't built for a heavy cargo run." },
];
function legendaryDef(key){ return LEGENDARY_SHIPS.find(s => s.key === key); }
function activeLegendaryDef(){ return (G.legendary && G.legendary.active) ? legendaryDef(G.legendary.active) : null; }
function legendaryUnlockStatus(def){
  const L = G.legendary || freshLegendary();
  if(def.unlock.type === "gold") return { ok:true, reason:"" };
  if(def.unlock.type === "milestone"){
    const ok = !!(G.seasoned && G.grand && G.grand.ironhull);
    return { ok, reason: def.unlock.reason };
  }
  if(def.unlock.type === "blueprint"){
    const ok = !!L.galleonBlueprint;
    return { ok, reason: def.unlock.reason };
  }
  if(def.unlock.type === "achievement"){
    const ok = ((G.stats && G.stats.bestNeverCaughtStreak) || 0) >= def.unlock.streak;
    return { ok, reason: def.unlock.reason };
  }
  return { ok:false, reason:"Not available." };
}
/* Speed/accel/turn are never mutated — updateShip() reads this live, same pattern
   as Shipwright levels and the Bluewater Clipper Rig. Zero drift risk. */
function legendaryPhysMult(){
  const def = activeLegendaryDef();
  return def ? { speed:def.speedMult, accel:def.accelMult, turn:def.turnMult } : { speed:1, accel:1, turn:1 };
}
/* Hull/cargo, by contrast, are permanent additive fields elsewhere in the game
   (Shipwright, Grand Fittings, Port Real Estate), so a legendary ship's bonus is
   applied as an explicit, tracked delta: switching away subtracts EXACTLY what
   was added, restoring the true grown base, before the new ship's delta (computed
   off that restored base) is applied. This is exact and reversible no matter how
   many upgrades were bought in between — see the design note in the changelog. */
function activateLegendary(key){
  if(!G.legendary) G.legendary = freshLegendary();
  if(G.legendary.active === key) return;
  const old = G.legendary.activeBonus || { hp:0, cargo:0 };
  G.hpMax = Math.max(20, G.hpMax - old.hp);
  G.hp = G.hp - old.hp;
  G.cargoMax = Math.max(10, G.cargoMax - old.cargo);
  let nb = { hp:0, cargo:0 };
  if(key){
    const def = legendaryDef(key);
    if(def){
      nb.hp = Math.round(G.hpMax * (def.hullMult - 1));
      nb.cargo = Math.round(G.cargoMax * (def.cargoMult - 1));
    }
  }
  G.hpMax += nb.hp; G.hp += nb.hp; G.cargoMax += nb.cargo;
  G.hp = clamp(G.hp, 1, G.hpMax);
  G.legendary.activeBonus = nb;
  G.legendary.active = key;
}
function buyLegendary(key){
  const def = legendaryDef(key);
  if(!def) return;
  if(!G.legendary) G.legendary = freshLegendary();
  if(G.legendary.owned.includes(key)){
    activateLegendary(key);
    toast(`⚜️ ${def.name} raised as your flagship.`, {kind:"save"});
    afterTrade();
    return;
  }
  const gate = legendaryUnlockStatus(def);
  if(!gate.ok){ toast(gate.reason || `${def.name} isn't available yet.`); return; }
  const price = legendaryPrice(def);
  if(G.gold < price){ toast(`${def.name} is a ${fmt(price)} Sovereign commission — save toward it.`); return; }
  spend(price);
  G.legendary.owned.push(key);
  bump("shipUpgrades"); bump("servicesBought");
  activateLegendary(key);
  toast(`⚜️ ${def.name} commissioned and raised as your flagship!`, {kind:"save", life:4500});
  afterTrade();
}
function setFlagship(key){
  if(!G.legendary) G.legendary = freshLegendary();
  if(key !== null && !G.legendary.owned.includes(key)) return;
  if(G.legendary.active === key) return;
  activateLegendary(key);
  toast(key ? `⚜️ ${legendaryDef(key).name} raised as your flagship.` : "Your original ship is your flagship again.", {kind:"save"});
  afterTrade();
}

/* =====================================================================
   v2.9 — Empire Progression. A rank ladder layered ON TOP of the existing
   Fortune goal (FORTUNE_TARGET stays the win condition — untouched). Ranks
   are driven by an "Empire Score" that reads several already-tracked paths
   to power, so no single activity is required: raw net worth still counts
   for most of it, but properties, business levels, contracts, smuggling
   runs, auction wins, trade influence and legendary ships owned all add
   their own share. Purely additive/derived — nothing here is persisted
   except the highest rank you've already been congratulated for, so a
   rank-up toast never fires twice for the same milestone.
   ===================================================================== */
const RANK_DEFS = [
  { key:"unknown",  name:"Unknown Captain",      score:0 },
  { key:"trader",   name:"Trader",               score:4000 },
  { key:"merchant", name:"Established Merchant", score:12000 },
  { key:"wealthy",  name:"Wealthy Captain",      score:30000 },
  { key:"magnate",  name:"Magnate",              score:80000 },
  { key:"baron",    name:"Trade Baron",          score:200000 },
  { key:"tycoon",   name:"Maritime Tycoon",      score:450000 },
  { key:"legendary",name:"Legendary Captain",    score:Infinity, requireWon:true },   // true Fortune only
];
function empireScore(){
  const props = PORTS.filter(p => propOwned(p.id));
  const propLevels = props.reduce((s, p) => s + propOwned(p.id).level, 0);
  const infl = MONOPOLY_GOODS.reduce((s, gid) => s + tradeInfluence(gid), 0);
  const stats = G.stats || freshStats();
  const shipsOwned = (G.legendary && G.legendary.owned.length) || 0;
  return Math.round(
    netWorth()
    + props.length * 6000
    + propLevels * 2500
    + (stats.jobsCompleted || 0) * 250
    + (stats.smugglingSuccess || 0) * 500
    + (stats.auctionsWon || 0) * 4000
    + shipsOwned * 12000
    + infl * 150
  );
}
function empireRankIndex(){
  const score = empireScore();
  let idx = 0;
  for(let i = 0; i < RANK_DEFS.length; i++){
    const r = RANK_DEFS[i];
    if(r.requireWon){ if(G.won) idx = i; }
    else if(score >= r.score) idx = i;
  }
  return idx;
}
function empireRank(){ return RANK_DEFS[empireRankIndex()]; }
/* small, additive rank perks — never removes or blocks anything the player
   could already do, only sweetens it a little at higher rank */
function rankLegendaryDiscount(){ return 1 - clamp(empireRankIndex(), 0, 5) * 0.02; }   // up to −10% at Trade Baron+
function legendaryPrice(def){ return Math.round(def.cost * rankLegendaryDiscount()); }
function paintUnlocked(key){ return empireRankIndex() >= (RANK_PAINT_GATE[key] || 0); }
function checkEmpireRank(){
  if(!G.empireRankSeen) G.empireRankSeen = 0;
  const idx = empireRankIndex();
  if(idx > G.empireRankSeen){
    G.empireRankSeen = idx;
    const r = RANK_DEFS[idx];
    toast(`🎖️ Maritime Rank: ${r.name.toUpperCase()} — your reputation precedes you.`, {kind:"save", life:5200});
  }
}

/* ---------- World data ---------- */
const GOODS = [
  { id:"rum",     name:"Rum",         desc:"Barrels of dark island rum",     base:45,  vol:0.55 },
  { id:"sugar",   name:"Sugar",       desc:"Sacks of raw cane sugar",        base:30,  vol:0.42 },
  { id:"fish",    name:"Salt Fish",   desc:"Barrels of salted cod",          base:26,  vol:0.50 },
  { id:"ore",     name:"Iron Ore",    desc:"Crates of raw iron ore",         base:52,  vol:0.40 },
  { id:"spice",   name:"Spice",       desc:"Pepper, clove and nutmeg",       base:120, vol:0.78 },
  { id:"silk",    name:"Silk",        desc:"Bolts of eastern silk",          base:200, vol:0.85 },
  { id:"tobacco", name:"Tobacco",     desc:"Pressed leaf tobacco",           base:70,  vol:0.60 },
  { id:"powder",  name:"Powder &amp; Shot", desc:"Kegs of powder and iron shot", base:95, vol:0.38 },
  { id:"tea",     name:"Tea",         desc:"Chests of green and black tea",  base:85,  vol:0.66 },
  { id:"gems",    name:"Cut Gems",    desc:"Pouches of cut stones",          base:340, vol:1.05 },

  /* ---- CONTRABAND: 300–500% margins, bought cheap in havens, fenced at Crown ports ---- */
  { id:"royaljewels", name:"Royal Jewels", desc:"Stolen crown regalia — hang if caught",
    base:900, vol:0.55, illegal:true, origin:["tortuga","nassau"] },
  { id:"blackpowder", name:"Black Powder", desc:"Unlicensed war powder for the highest bidder",
    base:280, vol:0.45, illegal:true, origin:["tortuga","maracaibo","ironcliff"] },
  { id:"relics",      name:"Cursed Relics", desc:"Plundered idols nobody admits wanting",
    base:640, vol:0.95, illegal:true, origin:["maracaibo","nassau"] },
];
/* ids of the illegal goods, for quick checks */
const CONTRA_IDS = GOODS.filter(g => g.illegal).map(g => g.id);

const PORTS = [
  { id:"tortuga",   name:"Tortuga",   x:640,  y:900,  r:88,  faction:"haven",
    type:"Pirate Haven", landmark:"lighthouse",
    blurb:"Lawless free port — rum and powder run cheap",
    produces:["rum","powder"], specialty:"Rum, Powder, and the black market",
    cheap:["rum","powder"],       dear:["silk","gems"],
    business:{ key:"distillery", kind:"production", good:"rum", name:"Rum Distillery", icon:"🥃",
      desc:"Ferments cane into barrels of Rum for your hold." } },
  { id:"portroyal", name:"Port Royal",x:2150, y:560,  r:96,  faction:"crown",
    type:"Crown Fortress", landmark:"fort",
    blurb:"Crown harbour, heavy customs, thirsty garrison",
    produces:["powder","tobacco"], specialty:"Munitions and Crown tobacco",
    cheap:["powder","tobacco"],   dear:["rum","spice"],
    business:{ key:"shipyard", kind:"shipyard", name:"Crown Shipyard", icon:"⚓",
      desc:"A stake in the naval yard — cheaper Repairs, Shipwright work and Cannons here." } },
  { id:"havana",    name:"Havana",    x:3900, y:780,  r:92,  faction:"crown",
    type:"Plantation Colony", landmark:"windmill",
    blurb:"Sugar and tobacco capital of the islands",
    produces:["sugar","tobacco"], specialty:"Sugar and tobacco plantations",
    cheap:["sugar","tobacco"],    dear:["tea","gems"],
    business:{ key:"plantation", kind:"production", good:"sugar", name:"Sugar Plantation", icon:"🌾",
      desc:"Cane fields that fill your hold with Sugar." } },
  { id:"nassau",    name:"Nassau",    x:5450, y:1850, r:84,  faction:"haven",
    type:"Pirate Republic", landmark:"stalls",
    blurb:"Pirate republic — buys anything, asks nothing",
    produces:["rum","sugar"], specialty:"A free market that asks no questions",
    cheap:["rum","sugar"],        dear:["powder","silk"],
    business:{ key:"tradehouse", kind:"trade", name:"Free Trading House", icon:"⚖️",
      desc:"A cut of the harbour brokerage — better prices when you sell here." } },
  { id:"cartagena", name:"Cartagena", x:2950, y:2550, r:100, faction:"crown",
    type:"Treasure Port", landmark:"cathedral",
    blurb:"Treasure-fleet port where cut gems flow",
    produces:["gems","spice"], specialty:"Cut gems from the treasure fleet",
    cheap:["gems","spice"],       dear:["tobacco","sugar"],
    business:{ key:"gemconcession", kind:"production", good:"gems", name:"Gem Concession", icon:"💎",
      desc:"A licensed claim on the treasure fleet's cut gems." } },
  { id:"maracaibo", name:"Maracaibo", x:1000, y:3450, r:90,  faction:"haven",
    type:"Lagoon Trading Post", landmark:"pagoda",
    blurb:"Remote lagoon trading in exotic eastern goods",
    produces:["spice","silk","tea"], specialty:"Exotic eastern spice, silk and tea",
    cheap:["spice","silk","tea"], dear:["rum","powder","sugar"],
    business:{ key:"warehouse", kind:"storage", name:"Lagoon Warehouse", icon:"🏬",
      desc:"Hidden, secure storage — stockpile cargo here without using ship's hold." } },
  { id:"saltmarsh", name:"Saltmarsh", x:4400, y:3550, r:82,  faction:"haven",
    type:"Fishing Village", landmark:"fishracks",
    blurb:"Salt fish and cheap grog off every jetty",
    produces:["fish","rum"], specialty:"Salt fish hauled in by the ton",
    cheap:["fish","rum"],         dear:["gems","silk","ore"],
    business:{ key:"fishery", kind:"production", good:"fish", name:"Fishery", icon:"🐟",
      desc:"Boats and racks that bring in barrels of Salt Fish." } },
  { id:"ironcliff", name:"Ironcliff", x:5650, y:3150, r:94,  faction:"crown",
    type:"Mining Colony", landmark:"headframe",
    blurb:"Ore and shot from the cliff mines, under Crown guard",
    produces:["ore","powder"], specialty:"Iron ore and forge work",
    cheap:["ore","powder"],       dear:["tea","spice","fish"],
    business:{ key:"mine", kind:"production", good:"ore", name:"Iron Mine", icon:"⛏️",
      desc:"A claim in the cliff mines, digging up crates of Iron Ore." } },
];
const isCrown = p => (typeof p === "string" ? portById(p) : p).faction === "crown";
const isHaven = p => (typeof p === "string" ? portById(p) : p).faction === "haven";

/* =====================================================================
   CHANGE LOG — newest entry first. To ship an update, copy one
   { version, title, ts, sections:[{ h, points:[] }] } block to the TOP
   of this array. `ts` is wall-clock EST: { y, mo:1-12, d, h:0-23, mi }.
   ===================================================================== */
const LOG_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtLogTime(t){
  const ap  = t.h >= 12 ? "PM" : "AM";
  const h12 = (t.h % 12) || 12;
  return `${LOG_MONTHS[t.mo - 1]} ${t.d}, ${t.y} – ${h12}:${String(t.mi).padStart(2, "0")} ${ap} EST`;
}
const CHANGELOG = [
  {
    version: "v2.7",
    title: "Black Market Auctions",
    ts: { y: 2026, mo: 9, d: 11, h: 7, mi: 0 },
    sections: [
      { h: "Rare, Time-Limited Auctions", points: [
        "A secret auction can now open at a random pirate haven — rarely, and never while one is already running. Word reaches you the moment it starts, with a deadline to actually get there; a small badge on screen counts down the days while it's live.",
        "Miss the window and it's gone — dock at the right port before it lapses to take a seat at the bidding floor.",
      ]},
      { h: "Real Bidding Against Rival Captains", points: [
        "2-3 rivals join every auction, drawn from five archetypes — Reckless Pirate, Wealthy Merchant, Navy Defector, Treasure Hunter, Rival Tycoon — each with its own budget and willingness to overbid. You see the current bid, who's leading, your gold, the next bid, and a live log of rival activity; you decide whether to raise or walk away.",
      ]},
      { h: "Genuinely Rare Prizes", points: [
        "Three rarity tiers — Rare, Epic, Legendary — weighted so legendary items stay rare, with starting bids from 8,000 up to 120,000 gold. Prizes are real and permanent: gold caches, a hold of silk, a free false hold, a free cannon pair, +25 max hull, or the Legendary Vessel Blueprint (+50 cargo, +40 hull and a gold windfall at once).",
      ]},
    ],
  },
  {
    version: "v2.6",
    title: "Trade Monopolies",
    ts: { y: 2026, mo: 9, d: 11, h: 6, mi: 0 },
    sections: [
      { h: "Trade Influence", points: [
        "The Empire tab now shows your Trade Influence in every commodity that has a production property — Rum, Sugar, Gems, Salt Fish and Iron Ore — from No Influence up through Local Supplier, Major Trader, Dominant Supplier to Monopoly, driven entirely by the level (and how full the stockpile is running) of the property you already own for it.",
        "Each tier is worth a small, capped buy discount and sell bonus (up to ±10%), and Dominant Supplier / Monopoly also steady that good's local price swings and pay a bonus on matching Supply contracts. The underlying market and prices are untouched — this only ever tilts a transaction slightly in your favour.",
      ]},
      { h: "An Emerging Reputation", points: [
        "A title now appears on the Empire tab — Sugar King, Iron Magnate, Rum Baron, Gem Tycoon, Shipping Baron, Smuggling Tycoon, Contract Merchant — worked out from your existing influence and stats, never chosen up front.",
      ]},
    ],
  },
  {
    version: "v2.5",
    title: "Port Real Estate — Build Your Empire",
    ts: { y: 2026, mo: 9, d: 11, h: 5, mi: 0 },
    sections: [
      { h: "One Business Per Port", points: [
        "Every port now has its own business, drawn from what it already produces: Rum Distillery (Tortuga), Sugar Plantation (Havana), Gem Concession (Cartagena), Fishery (Saltmarsh), Iron Mine (Ironcliff), plus three infrastructure businesses — Crown Shipyard (Port Royal, cheaper ship services), Free Trading House (Nassau, extra gold when you sell there) and Lagoon Warehouse (Maracaibo, off-ship cargo storage).",
        "New Empire tab in the port screen: buy in, see your level, production and stockpile, upgrade (Level 1→3, each level pricier), and collect what's piled up. A production business fills a capped stockpile with a real, existing good over time — visit to bring it aboard.",
      ]},
      { h: "Strategy, Not Autopilot", points: [
        "Fully developing one property costs up to ~96,000 gold, so owning everything isn't the obvious move — specializing in sugar, iron, rum or shipping infrastructure are all real, different paths.",
        "Utility businesses only help at their own port, giving every property a reason to sail back.",
      ]},
    ],
  },
  {
    version: "v2.4",
    title: "Dashboard Help Tooltip",
    ts: { y: 2026, mo: 9, d: 11, h: 4, mi: 0 },
    sections: [
      { h: "Quick Reference", points: [
        "A small \"?\" next to Ship's Dashboard now shows a plain-language tooltip on hover explaining every stat — Gold, Cargo, Health, Speed, Wanted, Lifetime Earned, Net Worth, Fortune, Holdings and Playtime. No new screen, just a quick reminder for new players.",
        "Fixed a display bug (from the Business Holdings update) where the Holdings dashboard row could stay visible with 0 ventures owned.",
      ]},
    ],
  },
  {
    version: "v2.3",
    title: "Passive Gold — Business Holdings",
    ts: { y: 2026, mo: 9, d: 11, h: 3, mi: 0 },
    sections: [
      { h: "Business Holdings", points: [
        "New Port Service: buy a stake in a business venture (from 2,500 gold, up to 12) and it pays 45 gold per in-game day into a ledger. The takings pile up while you sail, trade, smuggle and fight, and you Collect the lot at any port.",
        "The card shows your source, your rate per day, the accrued total and when the next payout lands. A Holdings line also appears on the dashboard once you own a venture.",
        "Deliberately a slow return — fully investing costs ~150k for +540/day, so active trading, contracts, combat and smuggling stay by far the fastest way to real wealth. Built as its own block so Port Real Estate can plug into it later.",
      ]},
    ],
  },
  {
    version: "v2.2",
    title: "Reef Visibility Fix & Consistent Service Quantities",
    ts: { y: 2026, mo: 9, d: 11, h: 1, mi: 30 },
    sections: [
      { h: "Rocks half-hidden behind islands", points: [
        "A voyage carried over from before the map grew could still hold reef positions that now fall inside a repositioned island, so the island drew over the rock and only a sliver showed. On load, any such mislaid (or out-of-bounds) reef is now nudged to the nearest clear water — same rock, same size, same collision, just no longer buried. Reefs already in open water and every new voyage are untouched, and the world's render order is unchanged.",
      ]},
      { h: "Port Service quantities", points: [
        "One shared ×1 / ×5 / Max selector at the top of Port Services now applies to every repeatable purchase — Cargo Hold, Shipwright upgrades, Cannons and False Cargo Holds. Cumulative cost is charged correctly, the buy stops when you can't afford another or hit the cap, and a toast reports how many were bought and the total spent. One-time services (Crew, Insurance, Grand Fittings, Repair, Paint) stay single-purchase.",
      ]},
    ],
  },
  {
    version: "v2.1",
    title: "Hide HUD & a Proper Captain's Manual",
    ts: { y: 2026, mo: 9, d: 11, h: 0, mi: 30 },
    sections: [
      { h: "Hide HUD", points: [
        "New Hide HUD button (bottom-right) and H key tuck away the title bar and the Ship's Dashboard for a clean view. The minimap, the M charts, warnings, notifications and the dock prompt all keep working, and your choice is remembered.",
      ]},
      { h: "Captain's Manual", points: [
        "The Help button now opens a tabbed in-game manual — Getting Started, Trading, Ships, Navigation, Combat & Navy, Economy, Controls, Tips — so you can jump straight to what you need instead of scrolling one long page. Also reachable from the pause menu and the title screen.",
        "Every entry is written from the live mechanics. The title screen's intro was trimmed to a short quick-start now that the full reference lives in the manual.",
      ]},
    ],
  },
  {
    version: "v2.0",
    title: "Reef-Aware Navy — Outmanoeuvre the Pursuit",
    ts: { y: 2026, mo: 9, d: 10, h: 23, mi: 30 },
    sections: [
      { h: "Navy Reads the Water", points: [
        "Navy cutters now steer around reefs that lie in their path — a rock dead ahead makes them slip to one side and take a wider, slower line instead of ploughing straight through.",
        "In dense reef clusters they ease off the throttle to pick their way; a cutter that clips a rock scrapes and loses speed. They never wedge or get stuck — a crawling cutter bolts back for open water.",
      ]},
      { h: "Escaping Is a Skill", points: [
        "Cut tight past a reef with the Navy right behind you and they must go around — you open real distance. In open water the chase is unchanged and still theirs to win.",
        "Reef-reading skill scales with your wanted level: at 5 stars they cut far closer and slow far less, so the environment is your best tool when the heat is highest.",
        "The wanted level, sight range, out-sail break-off, search and boarding systems are all untouched.",
      ]},
    ],
  },
  {
    version: "v1.9",
    title: "The Fortune Goal — Long-Term Progression",
    ts: { y: 2026, mo: 9, d: 10, h: 22, mi: 30 },
    sections: [
      { h: "A Real Long-Term Goal", points: [
        "The win goal is now a Fortune — a net worth of 1,000,000 Sovereigns. The dashboard shows a live Fortune progress bar and figure so the long-term target is always visible.",
        "An ordered wealth ladder: 10,000 (established trader) → 25,000 (seasoned trader) → 45,000 / 150,000 / 250,000 / 500,000 (the four Grand Fittings) → 1,000,000 (Fortune).",
        "Old saves that already 'won' the 10,000 goal keep every bit of progress — they simply become established traders and are re-aimed at the Fortune.",
      ]},
      { h: "Grand Fittings (milestones)", points: [
        "New Port Service: Ironbound Hull (45k — +50 hull, −25% all damage), Master's Charter (150k — +40% on every contract and prize payout), Bluewater Clipper Rig (250k — +22% speed / +16% acceleration) and Galleon Conversion (500k — +60 cargo, +25 hull, 6 contract slots).",
        "Shipwright upgrades now go to Level 8 (levels 6-8 are milestone-priced) and the Gunfoundry runs out up to 6 cannons.",
      ]},
      { h: "Balance", points: [
        "Early-game prices and upgrade costs are unchanged. Only the new high-end milestones are expensive, and the Master's Charter makes wealthy captains earn faster — so the money → stronger ship → bigger earnings loop keeps turning.",
        "Rival captains on the leaderboard now sail with fortunes of their own to chase.",
      ]},
    ],
  },
  {
    version: "v1.8",
    title: "Friends — Codes, Requests & Profiles",
    ts: { y: 2026, mo: 9, d: 10, h: 21, mi: 30 },
    sections: [
      { h: "Friends List", points: [
        "New Settings ➔ Friends screen. Every captain has a short friend code (SSW-XXXX-XXXX) shown on their profile and copyable from the Friends screen.",
        "Paste a friend's full share code to send a friend request; it appears in an Incoming list with Accept / Decline. Accepted friends join your list and your leaderboard.",
      ]},
      { h: "Friend Profiles", points: [
        "Click any friend (or leaderboard captain) to open a full profile built from the snapshot in their code — day reached, contracts, smuggling record, naval record, distance sailed and more.",
      ]},
      { h: "Honest About the Server", points: [
        "This is a local browser game with no backend, so friend data is simply the last code a captain shared — the Friends screen says so, and no live/online status is faked. The data model is built so a real server could slot in later.",
      ]},
    ],
  },
  {
    version: "v1.7",
    title: "Gameplay — Legal Contracts, Crew, Naval Combat & Ship Feel",
    ts: { y: 2026, mo: 9, d: 10, h: 20, mi: 0 },
    sections: [
      { h: "Legal Contracts", points: [
        "New Contracts tab at every port: cargo deliveries, passenger runs, supply orders and dispatch courier jobs — each with a destination, a deadline and a fixed payout. Hold up to four at once; contract cargo fills your hold and is shown there. A fresh board appears each time you Rest.",
        "Contracts count toward Lifetime Earnings and the new Contracts & Playstyle statistics, so a pure legal-merchant run is now fully viable.",
      ]},
      { h: "Naval Combat", points: [
        "Encounters now show a Danger tier (Patrol → Heavy Pursuit) and a Fight option with a shown win chance. Win → gold, salvage, the cutter is sunk and a star drops. Lose → you lose cargo and gold, take heavy hull damage and limp back to port.",
        "Hiding contraband is now partial — you see exactly how much stayed covered vs. was exposed, and can still run after a bad search.",
      ]},
      { h: "Crew, Guns & Colours", points: [
        "New Port Services: sign on a Navigator (−45% reef damage), Lookout (+2s boarding window), Master Gunner (double fight weight) or Quartermaster (your trades move prices half as much); a Gunfoundry for up to 4 cannons; and a Shipyard to repaint hull and sails.",
      ]},
      { h: "Ship Feel", points: [
        "Slightly faster top speed, sharper acceleration and turning — the drag that gives the ship its drift is unchanged.",
      ]},
    ],
  },
  {
    version: "v1.6",
    title: "A Wider World — Bigger Map, Island Identities & Market Charts",
    ts: { y: 2026, mo: 9, d: 10, h: 17, mi: 30 },
    sections: [
      { h: "Bigger Sea, More Ports", points: [
        "The open sea is roughly half again as large, now with 8 ports instead of 6 — added Saltmarsh (a fishing village) and Ironcliff (a Crown mining colony), plus two new goods: Salt Fish and Iron Ore.",
      ]},
      { h: "Island Identities", points: [
        "Every island now has its own type, colours, buildings and a landmark — lighthouse, fort, windmill, cathedral, pagoda, fish racks, mine headframe, market stalls — plus docked boats and buoys in the shallows.",
        "Each port lists a Specialty and the goods it produces cheaply, shown in both the dock screen and the Ports chart.",
      ]},
      { h: "Charts Rebuilt", points: [
        "The M chart is now tabbed: Map (a larger navigation chart), Market (best buy / best sell / profit-per-unit for every commodity across all ports), and Ports (per-island info + prices).",
      ]},
    ],
  },
  {
    version: "v1.5",
    title: "Quality of Life — Earnings, Stats, Profiles, Save Slots & Services",
    ts: { y: 2026, mo: 9, d: 10, h: 15, mi: 0 },
    sections: [
      { h: "Money, Clearly Defined", points: [
        "New Lifetime Earnings stat: every gold you earn is counted for good and never drops when you spend. The dashboard now shows Gold, Lifetime earned and Net worth (gold + cargo value + ship & upgrade value) as separate lines.",
      ]},
      { h: "Leaderboard & Profiles", points: [
        "The leaderboard is now ranked by Lifetime Earnings (then net worth, then playtime) — playing longer no longer means ranking higher.",
        "Click any captain — yourself, a rival, or an imported friend — to open a full profile card of their record.",
      ]},
      { h: "Statistics Page", points: [
        "New Settings ➔ Statistics screen tracking smuggling, sailing, economy, combat and progression — including your current and longest Never-Caught streak.",
      ]},
      { h: "Save Slots", points: [
        "New Voyages screen (Settings ➔ Voyages, or from the title screen) with three save slots to keep several runs going. The title screen's Continue card now spells out exactly which voyage will load.",
        "Save data is versioned and upgraded field-by-field — older saves keep all their progress and gain the new stats at zero.",
      ]},
      { h: "Port Services", points: [
        "Expand Cargo Hold gained ×1 / ×5 / Max buying.",
        "New Shipwright (permanent speed / acceleration / turning / hull upgrades — drift is untouched) and Hull Insurance (a wreck then costs far less gold and cargo).",
      ]},
    ],
  },
  {
    version: "v1.4",
    title: "Priority 1 — Market Clarity, Rocks, Water & Naval Fixes",
    ts: { y: 2026, mo: 9, d: 10, h: 12, mi: 0 },
    sections: [
      { h: "Market Readability", points: [
        "Every commodity now shows its current price, this port's normal price, the % gap, a plain 🟢 GREAT BUY / 🟡 FAIR / 🔴 GREAT SELL verdict, and the day-over-day direction — all judged against a consistent normal price, not against other islands.",
      ]},
      { h: "Market Price Manipulation", points: [
        "Buying in bulk now raises a commodity's local price and selling in bulk drops it, with a toast explaining why; resting each night lets that demand pressure partly recover.",
        "Added a 🛏 Rest 1 Day button inside the Market tab that advances the day and shows exactly which prices moved here, without leaving the screen.",
      ]},
      { h: "Visibility Fixes", points: [
        "Reefs redrawn with hard silhouettes and bright foam, and made clearly visible on both the minimap and the full chart.",
        "The full chart marks held cargo with a bold teal OWN badge and row highlight.",
        "Ocean surface re-done so its ripples stay anchored to the water instead of sliding with the camera — much easier on the eyes over long sessions.",
      ]},
      { h: "Notifications", points: [
        "Notifications moved to a dedicated top-centre layer that always sits above every menu, stacks up to four, and never hides behind Settings, the Map or save screens.",
      ]},
      { h: "Naval Encounter Fixes", points: [
        "Cutters no longer capture on contact — a 3-second boarding countdown gives you a window to turn, drift or run out of grapple range.",
        "Patrols now spawn a fair distance off instead of across the whole map; each cutter that loses your trail turns back on its own and drops a star, so danger actually winds down.",
        "Dock inspections with a clean hold and only 1★ no longer happen.",
      ]},
    ],
  },
  {
    version: "v1.3",
    title: "Change Log, Playtime Leaderboard & Captain Names",
    ts: { y: 2026, mo: 9, d: 9, h: 21, mi: 30 },
    sections: [
      { h: "In-Game Change Log", points: [
        "Added a Logs button to the top menu opening this parchment patch-notes modal, with every entry stamped in 12-hour EST (e.g. Sep 9, 2026 – 8:50 PM EST).",
      ]},
      { h: "Captain Name Picker", points: [
        "New games (and the first Leaderboard open) now prompt for a custom Captain Name that flies on the board and travels inside every save & export code.",
      ]},
      { h: "Live Playtime Timer", points: [
        "The dashboard and Leaderboard track total time played in exact 00h 00m 00s format; idle time in a background tab is not counted.",
      ]},
      { h: "Captains' Leaderboard", points: [
        "Added a Leaderboard button ranking captains by playtime then net worth, pre-loaded with rivals King Caden (14h 22m 45s) and Twin Gemini (08h 15m 10s); paste a friend's save code to add them to your board.",
      ]},
    ],
  },
  {
    version: "v1.2",
    title: "Smuggling, Law Enforcement & UI Redesign",
    ts: { y: 2026, mo: 9, d: 9, h: 20, mi: 50 },
    sections: [
      { h: "Contraband & Market Expansion", points: [
        "Introduced high-risk illegal trade goods (Royal Jewels, Black Powder, Cursed Relics) that buy cheap in pirate havens and flip for 3x–5x profit at Crown ports.",
      ]},
      { h: "Navy Wanted Level System", points: [
        "Added a dynamic 1–5 Star heat level where higher stars spawn aggressive Navy Patrol Cutters that actively chase your ship in open waters.",
      ]},
      { h: "Inspection Countermeasures", points: [
        "Added options at Crown ports to Bribe officials, Slip Inspections, or Flee, along with a purchasable 'False Cargo Hold' port service to hide illegal goods.",
      ]},
      { h: "Parchment UI Overhaul", points: [
        "Redesigned the full interface with classic parchment panels, dark wood borders, updated dashboard stat tracking, and new interactive port tabs.",
      ]},
    ],
  },
];

/* ---------- Leaderboard: rival captains to beat (playtime + net worth) ---------- */
/* v3.1 — rival "profile" now uses the exact same field names as the player's
   own G.stats (see freshStats()), plus day/distSailed alongside it, so the
   Record card can share one renderer (recordStatsHTML) across you, rivals,
   and imported friends instead of three hand-matched field lists drifting
   apart from each other. */
const RIVAL_CAPTAINS = [
  { name: "King Caden",  secs: 14*3600 + 22*60 + 45, worth: 615000, earned: 902000, rival: true,
    profile:{ day:118, islandsVisited:8, portDockings:340, goodsBought:8100, goodsSold:6700,
      contrabandSold:5200, jobsCompleted:210, smugglingRuns:96, timesCaught:9, timesEscaped:74,
      bestNeverCaughtStreak:19, navalWins:41, navalLosses:5, cargoLost:640, repairs:88, distSailed:2140000 } },
  { name: "Twin Gemini", secs:  8*3600 + 15*60 + 10, worth: 188000, earned: 271000, rival: true,
    profile:{ day:63, islandsVisited:8, portDockings:150, goodsBought:2800, goodsSold:2400,
      contrabandSold:1600, jobsCompleted:96, smugglingRuns:34, timesCaught:4, timesEscaped:31,
      bestNeverCaughtStreak:9, navalWins:14, navalLosses:3, cargoLost:220, repairs:37, distSailed:820000 } },
];
/* built-in rivals double as sample friends so the Friends list is never empty */
RIVAL_CAPTAINS.forEach(r => { r.code = genFriendCode(r.name); r.online = r.name === "King Caden"; });

/* v1.8 — short shareable handle, deterministic from the captain name */
function genFriendCode(str){
  str = String(str || "captain");
  let h = 2166136261 >>> 0;
  for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chunk = seed => { let s = "", x = seed >>> 0; for(let i = 0; i < 4; i++){ s += A[x % A.length]; x = Math.floor(x / A.length); } return s; };
  return `SSW-${chunk(h)}-${chunk(Math.imul(h ^ 0x9e3779b9, 2654435761))}`;
}
function myFriendCode(){
  if(!G) return "SSW-····-····";
  if(!G.friendCode) G.friendCode = genFriendCode(G.captain || "captain");
  return G.friendCode;
}
/* total play time -> "00h 00m 00s" */
function fmtPlay(s){
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(sec).padStart(2,"0")}s`;
}

/* one source of truth for the friend-code instruction — dropped into every .friend-slot */
const FRIEND_CODE_HTML =
  '<div class="friend-callout"><b>YOUR FRIEND CODE LOCATION:</b> ' +
  'Go to Settings ⚙️ ➔ click Export / Import ➔ copy the generated text string. ' +
  'Send this code to your friends so they can paste it into their game and load your progress or compare Leaderboard stats!</div>';

const START = { gold:800, cargoMax:40, hp:100, hpMax:100 };

/* v2.2 — keep persisted reefs in valid open water.
   A voyage carried over from before the map grew (and the islands moved) can
   still hold reef coordinates that now land inside a repositioned island. The
   reef is drawn first and the island then paints over it, so the rock looks
   half-hidden behind the land. This nudges only those mislaid reefs — and any
   that ended up out of bounds — to the nearest clear water. Count, radius and
   collision are untouched; a reef that is already in open water never moves. */
function sanitizeReefs(reefs){
  if(!Array.isArray(reefs) || !reefs.length) return reefs;
  const inBounds = (x, y, r) =>
    x > 200 + r && x < WORLD.w - 200 - r && y > 200 + r && y < WORLD.h - 200 - r;
  const clearOf = (x, y, r, self) => {
    if(!inBounds(x, y, r)) return false;
    for(const p of PORTS){ if(Math.hypot(p.x - x, p.y - y) < p.r + r + 160) return false; }
    for(const o of reefs){ if(o !== self && Math.hypot(o.x - x, o.y - y) < o.r + r + 90) return false; }
    return true;
  };
  const rnd = mulberry32(0x5EEDED);
  for(const rf of reefs){
    if(!isFinite(rf.r) || rf.r < 8) rf.r = 34;             // repair a broken radius so the rock can render
    if(!isFinite(rf.x) || !isFinite(rf.y)){ rf.x = WORLD.w * 0.5; rf.y = WORLD.h * 0.5; }
    if(clearOf(rf.x, rf.y, rf.r, rf)) continue;            // already fine — leave it exactly where it is
    let moved = false;
    // first try: shove it straight out past the island it is fouling
    let near = null, nd = Infinity;
    for(const p of PORTS){ const d = Math.hypot(p.x - rf.x, p.y - rf.y); if(d < nd){ nd = d; near = p; } }
    if(near){
      const a  = Math.atan2(rf.y - near.y, rf.x - near.x) || (rnd() * Math.PI * 2);
      const nx = near.x + Math.cos(a) * (near.r + rf.r + 230);
      const ny = near.y + Math.sin(a) * (near.r + rf.r + 230);
      if(clearOf(nx, ny, rf.r, rf)){ rf.x = nx; rf.y = ny; moved = true; }
    }
    // fallback: drop it in the first clear random spot
    for(let i = 0; i < 400 && !moved; i++){
      const nx = 220 + rnd() * (WORLD.w - 440);
      const ny = 220 + rnd() * (WORLD.h - 440);
      if(clearOf(nx, ny, rf.r, rf)){ rf.x = nx; rf.y = ny; moved = true; }
    }
    if(moved) rf._poly = null;   // its cached silhouette is rebuilt for the new spot
  }
  return reefs;
}

/* Reefs — hazards. Generated deterministically-ish but stored in save. */
function makeReefs(){
  const reefs = [];
  const rnd = mulberry32(0xC0FFEE);
  let tries = 0;
  while(reefs.length < 46 && tries < 9000){
    tries++;
    const x = 200 + rnd()*(WORLD.w-400);
    const y = 200 + rnd()*(WORLD.h-400);
    const r = 24 + rnd()*32;
    // keep clear of ports
    let ok = true;
    for(const p of PORTS){ if(Math.hypot(p.x-x,p.y-y) < p.r + 260){ ok=false; break; } }
    // keep clear of spawn
    if(Math.hypot(x-PORTS[0].x, y-(PORTS[0].y+220)) < 300) ok = false;
    for(const rf of reefs){ if(Math.hypot(rf.x-x,rf.y-y) < rf.r+r+120){ ok=false; break; } }
    if(ok) reefs.push({x,y,r});
  }
  return reefs;
}
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- Helpers ---------- */
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const fmt = n => Math.round(n).toLocaleString("en-US");
const goodName = id => { const g = GOODS.find(x=>x.id===id); return g?g.name.replace(/&amp;/g,"&"):id; };
const portById = id => PORTS.find(p=>p.id===id);
/* v1.9 — compact Fortune progress label for the dashboard */
function fortuneLabel(nw){
  if(nw >= FORTUNE_TARGET) return "✓ FORTUNE MADE";
  const pct = nw / FORTUNE_TARGET * 100;
  return `${fmt(nw)} / 1M · ${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%`;
}

/* ---------- Game state ---------- */
let G = null;
let keys = {};
let cam = { x:0, y:0 };
let canvas, ctx, mini, mctx, mapCv, mapCtx;
let lastT = 0;
let paused = true;
let wake = [];
let shake = 0;
let hintEl, miniTipEl, dpr = 1;

/* ---------- Market ---------- */
function freshMarket(){
  const m = {};
  for(const p of PORTS){
    m[p.id] = {};
    for(const g of GOODS) m[p.id][g.id] = { mult: 0.7 + Math.random()*0.7, prev: null, dem: 1 };
  }
  return m;
}
function priceAt(portId, goodId){
  const g = GOODS.find(x=>x.id===goodId);
  const p = portById(portId);
  const cell = G.market[portId][goodId];
  const dem = cell.dem || 1;                 // v1.4 local demand pressure from your own trading
  let price = g.base * cell.mult;
  if(g.illegal){
    // smuggler's price at the source haven; a fortune at a Crown port; modest at other havens
    if(g.origin.includes(portId))   price *= 0.85;
    else if(p.faction === "crown")  price *= (3.4 + cell.mult * 0.9);   // ~4–5x base
    else                            price *= 1.7;
    return Math.max(1, Math.round(price * dem));
  }
  if(p.cheap.includes(goodId)) price *= 0.70;
  if(p.dear.includes(goodId))  price *= 1.36;
  return Math.max(1, Math.round(price * dem));
}
function driftMarkets(strength){
  for(const p of PORTS){
    for(const g of GOODS){
      const cell = G.market[p.id][g.id];
      const noise = (Math.random()-0.5) * 2 * g.vol * strength;
      cell.mult += (1.0 - cell.mult) * (0.10 * strength * 4) + noise;
      cell.mult = clamp(cell.mult, 0.26, 3.4);
      // v1.4 — your buy/sell demand pressure partially recovers toward neutral each rest
      if(cell.dem == null) cell.dem = 1;
      cell.dem += (1 - cell.dem) * clamp(0.5 * strength, 0, 0.9);
      if(Math.abs(cell.dem - 1) < 0.01) cell.dem = 1;
    }
  }
}
function snapshotPrices(){
  for(const p of PORTS)
    for(const g of GOODS)
      G.market[p.id][g.id].prev = priceAt(p.id, g.id);
}

/* ---------- Persistence ---------- */
function serialize(){
  return {
    v:SAVE_VER, day:G.day, gold:G.gold, cargoMax:G.cargoMax,
    hp:G.hp, hpMax:G.hpMax,
    cargo:G.cargo, avg:G.avg, market:G.market,
    ship:{ x:G.ship.x, y:G.ship.y, a:G.ship.a },
    reefs:G.reefs, voyages:G.voyages, bestTrade:G.bestTrade, won:G.won,
    established:!!G.established, seasoned:!!G.seasoned,
    grand:G.grand || freshGrand(),
    distSailed:Math.round(G.distSailed),
    wanted:G.wanted, falseHolds:G.falseHolds,
    captain:G.captain || "", playSecs:Math.round(G.playSecs || 0),
    worth:netWorth(),                       // snapshot so shared codes rank without a full replay
    lifetimeEarnings:Math.round(G.lifetimeEarnings || 0),
    stats:G.stats || freshStats(),
    upgrades:G.upgrades || freshUpgrades(),
    storage:G.storage || {},
    insured:!!G.insured,
    crew:G.crew || freshCrew(),
    cosmetic:G.cosmetic || freshCosmetic(),
    cannons:G.cannons || 0,
    jobs:Array.isArray(G.jobs) ? G.jobs : [],
    passive:G.passive || freshPassive(),
    properties:G.properties || freshProperties(),
    auction:G.auction || null,
    legendary:G.legendary || freshLegendary(),
    empireRankSeen:G.empireRankSeen || 0,
    friendCode:G.friendCode || "",
    xp:Math.max(0, Math.round(G.xp || 0)),
    rivals:Array.isArray(G.rivals) ? G.rivals.slice(0, 30) : [],
    friendRequests:Array.isArray(G.friendRequests) ? G.friendRequests.slice(0, 20) : [],
  };
}
/* v1.5 — forgiving loader: any older save is upgraded field-by-field, never rejected. */
function migrateSave(o){
  o = Object.assign({}, o);
  const v = Number(o.v) || 1;
  if(v < 3){
    o.stats = o.stats || {};
    o.upgrades = o.upgrades || {};
    o.storage = o.storage || {};
    if(o.lifetimeEarnings == null){
      // best-effort seed for pre-v3 voyages: their current worth is a fair floor
      o.lifetimeEarnings = Math.max(0, Math.round(Number(o.worth) || Number(o.gold) || 0));
    }
  }
  if(v < 4){
    o.crew = o.crew || {};
    o.cosmetic = o.cosmetic || {};
    o.jobs = Array.isArray(o.jobs) ? o.jobs : [];
    o.cannons = o.cannons || 0;
    o.friendRequests = Array.isArray(o.friendRequests) ? o.friendRequests : [];
  }
  // v1.9 — the win goal moved from 10k to a 1,000,000 Fortune. A save that already
  // "won" the old 10k goal keeps all its progress but is re-aimed at the Fortune:
  // the old completion becomes the "established trader" checkpoint instead.
  o.grand = o.grand || {};
  if(o.won && (Number(o.worth) || 0) < FORTUNE_TARGET){
    o.won = false;
    o.established = true;
  }
  // re-flag the early checkpoints from a save's own net-worth snapshot
  const wv = Number(o.worth) || 0;
  if(wv >= WIN_TARGET)      o.established = true;
  if(wv >= SEASONED_TARGET) o.seasoned = true;
  if(v < 5){
    o.passive = o.passive || {};   // v2.3 — passive gold flow; old saves start with nothing invested
  }
  if(v < 6){
    o.properties = o.properties || {};   // v2.5 — Port Real Estate; old saves own nothing yet
  }
  if(v < 7){
    o.auction = o.auction || null;   // v2.7 — Black Market Auctions; nothing was running on an old save
  }
  if(v < 8){
    o.legendary = o.legendary || freshLegendary();   // v2.8 — Legendary Ships; old saves own none yet
  }
  if(v < 9){
    // v2.9 — Empire Progression; old saves start at 0 so the very next trade
    // announces whatever rank their existing progress has already earned.
    o.empireRankSeen = 0;
  }
  if(v < 10){
    // v3.4 — Captain Level; give an existing voyage a fair starting XP rather
    // than 0, seeded from progress it's already made (never worse than fresh).
    const seed = Math.round((Number(o.lifetimeEarnings) || 0) / 40 + (Number(o.stats && o.stats.jobsCompleted) || 0) * 25);
    o.xp = Math.max(0, seed);
  }
  o.v = SAVE_VER;
  return o;
}
function deserialize(o){
  if(!o || typeof o !== "object") throw new Error("no save data");
  o = migrateSave(o);
  const g = {
    day:Number(o.day)||1,
    gold:Math.max(0,Number(o.gold)||0),
    cargoMax:Number(o.cargoMax)||START.cargoMax,
    hpMax:Number(o.hpMax)||START.hpMax,
    hp:Number(o.hp),
    cargo:{}, avg:{}, market:{},
    voyages:Number(o.voyages)||0,
    bestTrade:Number(o.bestTrade)||0,
    won:!!o.won,
    established:!!o.established,
    seasoned:!!o.seasoned,
    grand:(()=>{ const g = freshGrand(), src = o.grand || {}; for(const k in g) g[k] = !!src[k]; return g; })(),
    distSailed:Number(o.distSailed)||0,
    reefs:sanitizeReefs(Array.isArray(o.reefs)&&o.reefs.length ? o.reefs.map(r=>({x:+r.x,y:+r.y,r:+r.r})) : makeReefs()),
    dockCooldown:null,
    invuln:0,
    wanted:clamp(Math.round(Number(o.wanted)||0), 0, 5),
    falseHolds:clamp(Math.round(Number(o.falseHolds)||0), 0, 3),
    navy:[],
    captain:(typeof o.captain === "string" ? o.captain : "").slice(0, 24),
    playSecs:Math.max(0, Number(o.playSecs) || 0),
    lifetimeEarnings:Math.max(0, Number(o.lifetimeEarnings) || 0),
    stats:normalizeStats(o.stats),
    upgrades:(()=>{ const u = o.upgrades || {}; return {
      speed:clamp(Math.round(Number(u.speed)||0),0,5),
      accel:clamp(Math.round(Number(u.accel)||0),0,5),
      turn: clamp(Math.round(Number(u.turn) ||0),0,5),
      hull: clamp(Math.round(Number(u.hull) ||0),0,5),
    }; })(),
    storage:(()=>{ const st = {}; for(const gd of GOODS){ const n = o.storage && Number(o.storage[gd.id]); st[gd.id] = (isFinite(n)&&n>0)?Math.floor(n):0; } return st; })(),
    insured:!!o.insured,
    crew:(()=>{ const c = freshCrew(), src = o.crew || {}; for(const k in c) c[k] = !!src[k]; return c; })(),
    cosmetic:(()=>{ const src = o.cosmetic || {}; return {
      hull: HULL_PAINT[src.hull] ? src.hull : "oak",
      sail: SAIL_PAINT[src.sail] ? src.sail : "cream",
    }; })(),
    cannons:clamp(Math.round(Number(o.cannons)||0), 0, 4),
    jobs:(Array.isArray(o.jobs) ? o.jobs : []).filter(j => j && j.from && j.to && j.type)
      .map(j => ({
        id:String(j.id || Math.random().toString(36).slice(2)),
        type:String(j.type), from:String(j.from), to:String(j.to),
        good:(j.good ? String(j.good) : null), qty:Math.max(0, Math.round(Number(j.qty)||0)),
        reward:Math.max(0, Math.round(Number(j.reward)||0)),
        acceptedDay:Math.max(1, Math.round(Number(j.acceptedDay)||1)),
        dayLimit:Math.max(1, Math.round(Number(j.dayLimit)||8)),
        title:String(j.title || "Contract"),
      })).slice(0, 4),
    passive:(()=>{ const p = o.passive || {}; return {
      accrued: Math.max(0, Number(p.accrued) || 0),
      ventures: clamp(Math.round(Number(p.ventures) || 0), 0, VENTURE_MAX),
      lastCollectDay: Math.max(1, Math.round(Number(p.lastCollectDay) || Number(o.day) || 1)),
    }; })(),
    properties:(()=>{
      const out = {}; const src = (o.properties && typeof o.properties === "object") ? o.properties : {};
      for(const p of PORTS){
        const raw = src[p.id]; if(!raw || !p.business) continue;
        const level = clamp(Math.round(Number(raw.level) || 0), 0, PROP_MAX_LEVEL);
        if(level <= 0) continue;
        const stored = p.business.kind === "production"
          ? clamp(Math.round(Number(raw.stored) || 0), 0, propCap(p.id, level))
          : 0;
        out[p.id] = { level, stored };
      }
      return out;
    })(),
    auction:(()=>{
      try{
        const a = o.auction;
        if(!a || typeof a !== "object") return null;
        if(!portById(a.portId)) return null;
        if(!AUCTION_RARITY[a.rarity]) return null;
        const itemDef = (AUCTION_ITEMS[a.rarity] || []).find(i => i.key === a.itemKey);
        if(!itemDef) return null;
        const rivals = (Array.isArray(a.rivals) ? a.rivals : [])
          .filter(r => r && typeof r.name === "string" && AUCTION_ARCHETYPES.some(ar => ar.key === r.archetype))
          .map(r => {
            const ar = AUCTION_ARCHETYPES.find(x => x.key === r.archetype);
            return {
              name: String(r.name).slice(0, 40), archetype: ar.key, desc: ar.desc,
              budget: Math.max(0, Math.round(Number(r.budget) || 0)),
              overbid: ar.overbid, jumpMin: ar.jumpMin, jumpMax: ar.jumpMax,
              dropped: !!r.dropped,
            };
          }).slice(0, 5);
        if(!rivals.length) return null;
        if(a.resolved) return null;   // a fully-settled auction never needs to be restored — the slot is free
        const startBid = Math.max(100, Math.round(Number(a.startBid) || AUCTION_RARITY[a.rarity].startMin));
        const currentBid = Math.max(startBid, Math.round(Number(a.currentBid) || startBid));
        const leader = a.leader === "player" || rivals.some(r => r.name === a.leader) ? a.leader : null;
        return {
          id: typeof a.id === "string" ? a.id.slice(0, 16) : Math.random().toString(36).slice(2, 9),
          portId: a.portId, spawnDay: Math.max(1, Math.round(Number(a.spawnDay) || 1)),
          expiresDay: Math.max(1, Math.round(Number(a.expiresDay) || (Number(o.day) || 1) + 3)),
          rarity: a.rarity, itemKey: a.itemKey,
          startBid, currentBid, leader,
          rounds: clamp(Math.round(Number(a.rounds) || 0), 0, AUCTION_MAX_ROUNDS),
          rivals, log: Array.isArray(a.log) ? a.log.filter(l => typeof l === "string").slice(-8) : [],
          resolved: !!a.resolved,
          result: ["won", "lost", "walked"].includes(a.result) ? a.result : null,
        };
      }catch(_){ return null; }
    })(),
    legendary:(()=>{
      const src = (o.legendary && typeof o.legendary === "object") ? o.legendary : {};
      const owned = (Array.isArray(src.owned) ? src.owned : []).filter(k => !!legendaryDef(k)).slice(0, LEGENDARY_SHIPS.length);
      let active = (typeof src.active === "string" && owned.includes(src.active)) ? src.active : null;
      let bonus = { hp:0, cargo:0 };
      if(active && src.activeBonus && typeof src.activeBonus === "object"){
        const bh = Number(src.activeBonus.hp), bc = Number(src.activeBonus.cargo);
        bonus = { hp: isFinite(bh) ? clamp(Math.round(bh), -2000, 2000) : 0, cargo: isFinite(bc) ? clamp(Math.round(bc), -2000, 2000) : 0 };
      }else{
        active = null;   // untrusted delta — drop the flagship rather than risk a silent stat exploit
      }
      return { active, owned, activeBonus:bonus, galleonBlueprint:!!src.galleonBlueprint };
    })(),
    empireRankSeen:clamp(Math.round(Number(o.empireRankSeen) || 0), 0, RANK_DEFS.length - 1),
    friendCode:(typeof o.friendCode === "string" && /^SSW-/.test(o.friendCode)) ? o.friendCode : "",
    xp:Math.max(0, Math.round(Number(o.xp) || 0)),
    rivals:Array.isArray(o.rivals)
      ? o.rivals.filter(r => r && typeof r.name === "string")
                .map(r => ({
                  name: String(r.name).slice(0,24),
                  code: (typeof r.code === "string") ? r.code.slice(0, 16) : "",
                  secs: Math.max(0, Number(r.secs)||0),
                  worth: Math.max(0, Number(r.worth)||0),
                  earned: Math.max(0, Number(r.earned != null ? r.earned : r.worth)||0),
                  addedDay: Math.max(0, Number(r.addedDay)||0),
                  snap: (r.snap && typeof r.snap === "object") ? r.snap : null,
                }))
                .slice(0, 30)
      : [],
    friendRequests:Array.isArray(o.friendRequests)
      ? o.friendRequests.filter(r => r && typeof r.name === "string")
                .map(r => ({
                  name: String(r.name).slice(0,24),
                  code: (typeof r.code === "string") ? r.code.slice(0, 16) : "",
                  secs: Math.max(0, Number(r.secs)||0),
                  worth: Math.max(0, Number(r.worth)||0),
                  earned: Math.max(0, Number(r.earned != null ? r.earned : r.worth)||0),
                  snap: (r.snap && typeof r.snap === "object") ? r.snap : null,
                }))
                .slice(0, 20)
      : [],
  };
  if(!isFinite(g.hp)) g.hp = g.hpMax;
  g.hp = clamp(g.hp,0,g.hpMax);

  for(const gd of GOODS){
    const c = o.cargo && Number(o.cargo[gd.id]);
    g.cargo[gd.id] = (isFinite(c)&&c>0) ? Math.floor(c) : 0;
    const a = o.avg && Number(o.avg[gd.id]);
    g.avg[gd.id] = (isFinite(a)&&a>0) ? a : gd.base;
  }
  const fm = freshMarket();
  for(const p of PORTS){
    g.market[p.id] = {};
    for(const gd of GOODS){
      const src = o.market && o.market[p.id] && o.market[p.id][gd.id];
      const mult = src && isFinite(Number(src.mult)) ? clamp(Number(src.mult),0.26,3.4) : fm[p.id][gd.id].mult;
      const dem  = src && isFinite(Number(src.dem))  ? clamp(Number(src.dem),0.35,3)   : 1;
      g.market[p.id][gd.id] = { mult, prev:null, dem };
    }
  }
  const sx = o.ship && Number(o.ship.x), sy = o.ship && Number(o.ship.y), sa = o.ship && Number(o.ship.a);
  g.ship = {
    x: isFinite(sx) ? clamp(sx,40,WORLD.w-40) : PORTS[0].x,
    y: isFinite(sy) ? clamp(sy,40,WORLD.h-40) : PORTS[0].y + 230,
    a: isFinite(sa) ? sa : -Math.PI/2,
    vx:0, vy:0, spd:0,
  };
  return g;
}

function toSaveCode(){
  return "SnSW2:" + btoa(unescape(encodeURIComponent(JSON.stringify(serialize()))));
}
function fromSaveCode(code){
  code = String(code||"").trim();
  if(code.startsWith("SnSW2:")) code = code.slice(6);
  return deserialize(JSON.parse(decodeURIComponent(escape(atob(code)))));
}
function saveLocal(){
  try{ localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); }
  catch(e){ console.warn("save failed", e); }
}
function clearLocal(){
  try{ localStorage.removeItem(SAVE_KEY); }
  catch(e){ console.warn("clear failed", e); }
}
function loadLocal(){
  try{
    const raw = localStorage.getItem(SAVE_KEY);
    if(!raw) return null;
    return deserialize(JSON.parse(raw));
  }catch(e){ console.warn("load failed", e); return null; }
}

/* ---------- New game ---------- */
function newGame(){
  const g = {
    day:1, gold:START.gold, cargoMax:START.cargoMax,
    hp:START.hp, hpMax:START.hpMax,
    cargo:{}, avg:{}, market:freshMarket(),
    voyages:0, bestTrade:0, won:false, established:false, seasoned:false, grand:freshGrand(), distSailed:0,
    reefs:makeReefs(), dockCooldown:null, invuln:0,
    wanted:0, falseHolds:0, navy:[],
    captain:"", playSecs:0, rivals:[],
    lifetimeEarnings:0, stats:freshStats(), upgrades:freshUpgrades(), storage:{}, insured:false,
    crew:freshCrew(), cosmetic:freshCosmetic(), cannons:0, jobs:[],
    passive:freshPassive(), properties:freshProperties(), auction:null,
    legendary:freshLegendary(), empireRankSeen:0,
    friendCode:"", friendRequests:[], xp:0,
    ship:{ x:PORTS[0].x, y:PORTS[0].y + 230, a:-Math.PI/2, vx:0, vy:0, spd:0 },
  };
  for(const gd of GOODS){ g.cargo[gd.id]=0; g.avg[gd.id]=gd.base; g.storage[gd.id]=0; }
  G = g;
  snapshotPrices();
  saveLocal();
}

/* ---------- Economy actions ---------- */
let qtyMode = "max";
function tradeQty(kind, portId, goodId){
  if(qtyMode === "max"){
    if(kind === "buy"){
      const price = priceAt(portId, goodId);
      const space = G.cargoMax - totalCargo();
      return Math.max(0, Math.min(Math.floor(G.gold/price), space));
    }
    return G.cargo[goodId];
  }
  return parseInt(qtyMode,10) || 1;
}
function goodsInHold(){ return Object.values(G.cargo).reduce((s,n)=>s+n,0); }
/* v1.7 — contract cargo (delivery crates + passenger berths) also fills the hold */
function jobReserved(){
  if(!Array.isArray(G.jobs)) return 0;
  return G.jobs.reduce((s,j)=> s + (j.type === "supply" ? 0 : (j.qty || 0)), 0);
}
function totalCargo(){ return goodsInHold() + jobReserved(); }
function storedCargo(){ return G.storage ? Object.values(G.storage).reduce((s,n)=>s+(n||0),0) : 0; }

/* v1.5 — one path for GAINING gold: it also feeds Lifetime Earnings, which never
   goes down when you spend. Starting gold is NOT counted as earned. */
function earn(n){
  n = Math.max(0, Math.round(n));
  G.gold += n;
  G.lifetimeEarnings = (G.lifetimeEarnings || 0) + n;
  if(G.stats) G.stats.goldEarned += n;
  return n;
}
function spend(n){
  n = Math.max(0, Math.round(n));
  G.gold -= n;
  if(G.stats) G.stats.goldSpent += n;
  return n;
}
function bump(stat, by){ if(G.stats && isFinite(G.stats[stat])) G.stats[stat] += (by == null ? 1 : by); }

/* value of permanent ship investment — folded into Net Worth */
function upgradeValue(){
  const u = G.upgrades || {};
  let v = (G.cargoMax - START.cargoMax) * 16;
  v += ((u.speed||0) + (u.accel||0) + (u.turn||0) + (u.hull||0)) * 260;
  v += (G.falseHolds || 0) * 240;
  const gr = G.grand || {};
  if(gr.ironhull) v += 22000;   // v1.9 — Grand Fittings carry real resale value
  if(gr.charter)  v += 75000;
  if(gr.clipper)  v += 125000;
  if(gr.galleon)  v += 260000;
  v += propertyAssetValue();   // v2.5 — owned Port Real Estate carries resale value too
  return v;
}
/* v2.5 — resale-ish value of every owned property, based on what was actually paid in */
function propertyAssetValue(){
  if(!G.properties) return 0;
  let v = 0;
  for(const pid in G.properties){
    const own = G.properties[pid]; if(!own || own.level <= 0) continue;
    let paid = PROP_BUY_COST;
    for(let lv = 2; lv <= own.level; lv++) paid += (PROP_UPGRADE_COST[lv] || 0);
    v += Math.round(paid * 0.65);
  }
  return v;
}
function cargoValue(){
  const nearest = nearestPort().port;
  let w = 0;
  for(const g of GOODS){
    if(G.cargo[g.id] > 0)              w += G.cargo[g.id]  * priceAt(nearest.id, g.id);
    if((G.storage && G.storage[g.id])) w += G.storage[g.id] * priceAt(nearest.id, g.id);
  }
  return Math.round(w);
}
/* Net Worth = spendable gold + cargo value (hold + warehouse) + ship/upgrade value */
function netWorth(){
  return Math.round(G.gold + cargoValue() + upgradeValue());
}

/* v1.4 — trading in size moves the LOCAL price against you (Quartermaster halves it) */
function pressureScale(){ return (G.crew && G.crew.quartermaster) ? 0.5 : 1; }
function applyBuyPressure(portId, goodId, qty){
  const cell = G.market[portId][goodId];
  const g = GOODS.find(x=>x.id===goodId);
  cell.dem = cell.dem || 1;
  cell.dem *= (1 + Math.min(0.5, (qty/40) * (0.35 + g.vol*0.3)) * pressureScale() * influencePressureMult(goodId));
  cell.dem = clamp(cell.dem, 0.35, 3);
}
function applySellPressure(portId, goodId, qty){
  const cell = G.market[portId][goodId];
  const g = GOODS.find(x=>x.id===goodId);
  cell.dem = cell.dem || 1;
  cell.dem *= (1 - Math.min(0.4, (qty/40) * (0.35 + g.vol*0.3)) * pressureScale() * influencePressureMult(goodId));
  cell.dem = clamp(cell.dem, 0.35, 3);
}

function buy(portId, goodId){
  const price = priceAt(portId, goodId);
  let qty = tradeQty("buy", portId, goodId);
  qty = Math.min(qty, G.cargoMax - totalCargo(), Math.floor(G.gold/price));
  if(qty <= 0){ toast(G.cargoMax-totalCargo()<=0 ? "The hold is full." : "Not enough gold."); return; }
  const monoDisc = Math.round(qty * price * influenceBonus(goodId));   // v2.6 — Trade Monopoly buy discount
  const cost = qty*price - monoDisc, had = G.cargo[goodId], pAvg = G.avg[goodId]||price;
  spend(cost);
  G.cargo[goodId] = had + qty;
  G.avg[goodId] = (had*pAvg + qty*(cost/qty))/(had+qty);
  bump("goodsBought", qty);
  if(cost > (G.stats ? G.stats.biggestBuy : 0)) G.stats.biggestBuy = cost;
  toast(`+${qty} ${goodName(goodId)} · −${fmt(cost)} gold${monoDisc > 0 ? ` (−${fmt(monoDisc)} Trade Influence)` : ""} · hold ${totalCargo()}/${G.cargoMax}`);
  applyBuyPressure(portId, goodId, qty);
  const after = priceAt(portId, goodId);
  const up = Math.round((after - price)/price*100);
  if(up >= 3) toast(`📈 ${goodName(goodId)} price +${up}% at ${portById(portId).name} — heavy buying raised local demand.`, {life:3400});
  gainXp(2, "trade");
  afterTrade();
}
function sell(portId, goodId){
  let qty = Math.min(tradeQty("sell", portId, goodId), G.cargo[goodId]);
  if(qty <= 0){ toast("You hold none of that."); return; }
  const price = priceAt(portId, goodId);
  const thBonus   = Math.round(qty * price * tradeHouseBonus(portId));   // v2.5 — Trading House cut, own port only
  const monoBonus = Math.round(qty * price * influenceBonus(goodId));    // v2.6 — Trade Monopoly sell bonus, anywhere
  const bonus = thBonus + monoBonus;
  const rev = qty*price + bonus, avg = G.avg[goodId]||price;
  const profit = Math.round((price-avg)*qty) + bonus;
  earn(rev);
  G.cargo[goodId] -= qty;
  if(G.cargo[goodId] <= 0) G.avg[goodId] = GOODS.find(x=>x.id===goodId).base;
  if(profit > G.bestTrade) G.bestTrade = profit;
  bump("goodsSold", qty);
  if(profit > (G.stats ? G.stats.bestTradeProfit : 0)) G.stats.bestTradeProfit = profit;
  if(rev > (G.stats ? G.stats.biggestSale : 0)) G.stats.biggestSale = rev;
  const bonusTxt = [thBonus > 0 ? `+${fmt(thBonus)} Trading House` : null, monoBonus > 0 ? `+${fmt(monoBonus)} Trade Influence` : null].filter(Boolean).join(", ");
  toast(`Sold ${qty} ${goodName(goodId)} · +${fmt(rev)} gold${bonusTxt ? ` (${bonusTxt})` : ""} · profit ${profit>=0?"+":"−"}${fmt(Math.abs(profit))}`);
  applySellPressure(portId, goodId, qty);
  const afterP = priceAt(portId, goodId);
  const down = Math.round((price - afterP)/price*100);
  if(down >= 3) toast(`📉 ${goodName(goodId)} price −${down}% at ${portById(portId).name} — you saturated the local market.`, {life:3400});
  // fencing contraband at a Crown port gets you noticed
  const gd = GOODS.find(x=>x.id===goodId);
  if(gd && gd.illegal && isCrown(portId)){
    bump("contrabandSold", qty);
    bump("contrabandPay", rev);
    bump("smugglingRuns");
    bump("smugglingSuccess");
    bump("neverCaughtStreak");
    if(G.stats && G.stats.neverCaughtStreak > G.stats.bestNeverCaughtStreak)
      G.stats.bestNeverCaughtStreak = G.stats.neverCaughtStreak;
    if(Math.random() < 0.45){
      raiseWanted(1);
      setTimeout(()=>toast(`⚠ WANTED LEVEL +1 — word of your contraband sale reached the ${portById(portId).name} garrison.`, {kind:"warn"}), 500);
    }
    gainXp(10, "smuggling");
  }
  gainXp(3 + (profit > 0 ? Math.min(10, Math.round(profit / 50)) : 0), "trade");
  afterTrade();
}
/* v3.2 — Space, when the trade modal is open, sells every held good at the
   current port in one press. Reuses sell() exactly (same bonuses, contraband
   fencing, wanted-level rolls) by borrowing "max" quantity mode for the loop,
   then restoring whatever quantity mode the player had selected. */
function sellAllHere(){
  if(!currentPort) return;
  const ids = Object.keys(G.cargo).filter(id => G.cargo[id] > 0);
  if(!ids.length){ toast("Nothing in the hold to sell."); return; }
  const savedMode = qtyMode;
  qtyMode = "max";
  for(const id of ids) sell(currentPort.id, id);
  qtyMode = savedMode;
}
function repairHull(portId){
  const need = G.hpMax - G.hp;
  if(need <= 0){ toast("Hull is sound."); return; }
  const unit = Math.max(1, Math.round(7 * (1 - shipyardDiscount(portId))));   // v2.5 — Crown Shipyard discount
  const can = Math.min(need, Math.floor(G.gold/unit));
  if(can <= 0){ toast("Can't afford repairs."); return; }
  spend(can*unit); G.hp += can;
  bump("repairs");
  toast(`Repaired ${can} hull for ${fmt(can*unit)}.`);
  afterTrade();
}
/* v2.2 — one shared quantity mode for every repeatable Port Service ("1" | "5" | "max") */
let svcQtyMode = "1";
function svcQtySuffix(){ return svcQtyMode === "max" ? " · Max" : (svcQtyMode === "1" ? "" : " ×" + svcQtyMode); }

/* v2.2 — buy a repeatable upgrade N times through one code path.
   opts:
     level()  -> current count / level (read live)
     cost()   -> gold for the NEXT purchase at the current level (read live)
     apply()  -> perform one purchase (increments the level, side effects)
     cap      -> hard maximum level (Infinity if none)
     maxSteps -> iteration ceiling for "max" when cap is Infinity (default 40)
   Stops on: reaching the cap, running out of gold, or the maxSteps ceiling. */
function multiBuy(opts){
  const cap = (opts.cap == null) ? Infinity : opts.cap;
  let want;
  if(svcQtyMode === "max"){
    want = isFinite(cap) ? (cap - opts.level()) : (opts.maxSteps || 40);
  }else{
    want = parseInt(svcQtyMode, 10) || 1;
    if(isFinite(cap)) want = Math.min(want, cap - opts.level());
  }
  want = Math.max(0, want);
  let bought = 0, spentTotal = 0;
  for(let i = 0; i < want; i++){
    if(opts.level() >= cap) break;
    const c = opts.cost();
    if(!isFinite(c) || G.gold < c) break;
    spend(c); spentTotal += c;
    opts.apply();
    bought++;
  }
  return { bought, spentTotal };
}

function holdExpandCost(step){ return 320 + (G.cargoMax - START.cargoMax + step*10) * 24; }
function expandHold(){
  const res = multiBuy({
    cap: Infinity, maxSteps: 40,
    level: () => (G.cargoMax - START.cargoMax) / 10,
    cost:  () => holdExpandCost(0),               // holdExpandCost reads G.cargoMax live
    apply: () => { G.cargoMax += 10; bump("servicesBought"); },
  });
  if(res.bought === 0){ toast(`The shipwright wants ${fmt(holdExpandCost(0))} for the next 10 crates.`); return; }
  toast(`Hold expanded +${res.bought*10} to ${G.cargoMax} · −${fmt(res.spentTotal)} gold`);
  afterTrade();
}
const REST_COST = 8;   // a night's lodging at the inn
/* The ONLY thing that advances the calendar and shifts every port's prices. */
function restAdvance(){
  if(G.gold < REST_COST){ toast(`Not enough gold for a night's lodging (${REST_COST}).`); return; }
  spend(REST_COST);
  G.day += 1;
  bump("daysPassed");
  accruePassive();       // v2.3 — business ventures pay the day's takings into the ledger
  accrueProperties();    // v2.5 — owned production properties add to their stockpile
  auctionExpireCheck();  // v2.7 — a black market auction you never reached lapses
  maybeSpawnAuction();   // v2.7 — rare chance a new one opens somewhere
  expireJobs();          // contracts past their deadline lapse overnight
  if(currentPort) jobBoard = rollJobBoard(currentPort);   // fresh board each morning
  snapshotPrices();      // remember today's prices so the trend arrows read day-over-day
  driftMarkets(0.85);    // markets shift overnight, everywhere at once
  toast(`Rested at the inn — Day ${G.day}. Word of new prices arrives from every port.`);
  if(passiveDailyRate() > 0){
    setTimeout(()=>toast(`🏦 Your holdings earned ${fmt(passiveDailyRate())} gold — ${fmt(Math.floor(G.passive.accrued))} waiting in the ledger.`), 350);
  }
  // the Navy's attention slowly wanders — but not while you're sitting on contraband
  if((G.wanted||0) > 0 && !carryingContraband() && Math.random() < 0.3){
    lowerWanted(1);
    setTimeout(()=>toast(`The Navy's interest cools — wanted level ${starStr(G.wanted)}.`), 450);
  }
  afterTrade();
}
/* v1.4 — Rest without leaving the Market screen; shows what shifted here */
function restFromMarket(){
  if(!currentPort){ restAdvance(); return; }
  const pid = currentPort.id;
  const before = {};
  for(const g of GOODS) before[g.id] = priceAt(pid, g.id);
  const day0 = G.day;
  restAdvance();
  if(G.day === day0) return;   // couldn't afford lodging
  const moves = GOODS.map(g => {
    const now = priceAt(pid, g.id);
    return { name: goodName(g.id), pct: Math.round((now - before[g.id]) / before[g.id] * 100) };
  }).filter(m => Math.abs(m.pct) >= 2)
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4);
  const txt = moves.length
    ? moves.map(m => `${m.name} ${m.pct > 0 ? "▲" : "▼"}${Math.abs(m.pct)}%`).join(" · ")
    : "prices held steady here";
  const el = document.getElementById("mktRestSummary");
  if(el) el.textContent = `Day ${day0} → Day ${G.day}: ${txt}`;
}

function afterTrade(){
  checkWin();
  checkEmpireRank();
  saveLocal();
  renderDash();
  renderTrade(currentPort);
}
function checkWin(){
  const nw = netWorth();
  // early checkpoints — you're on your feet, but the real goal is the Fortune
  if(!G.established && nw >= WIN_TARGET){
    G.established = true;
    gainXp(100, "milestone");
    toast(`⚓ You're an established trader — net worth past ${fmt(WIN_TARGET)}. Now build a Fortune: ${fmt(FORTUNE_TARGET)} Sovereigns.`, {life:5200});
  }
  if(!G.seasoned && nw >= SEASONED_TARGET){
    G.seasoned = true;
    gainXp(250, "milestone");
    toast(`⚓ Seasoned trader — net worth past ${fmt(SEASONED_TARGET)}. The first Grand Fitting is within reach.`, {life:4600});
  }
  // the long-term goal
  if(!G.won && nw >= FORTUNE_TARGET){
    G.won = true;
    gainXp(1000, "milestone");
    toast(`🏆 A FORTUNE MADE — net worth past ${fmt(FORTUNE_TARGET)} Sovereigns. You've built a trading empire.`, {kind:"save", life:6500});
  }
}

/* =====================================================================
   Smuggling · Navy inspections · 1–5 star Wanted level · Navy patrols
   ===================================================================== */
function carryingContraband(){ return CONTRA_IDS.some(id => G.cargo[id] > 0); }
function contrabandList(){
  return CONTRA_IDS.filter(id => G.cargo[id] > 0).map(id => ({ id, qty: G.cargo[id] }));
}
function contrabandValue(portId){
  let v = 0;
  for(const id of CONTRA_IDS) if(G.cargo[id] > 0) v += G.cargo[id] * priceAt(portId, id);
  return v;
}
function starStr(n){ n = clamp(n|0, 0, 5); return n > 0 ? "★".repeat(n) + "☆".repeat(5 - n) : "clean"; }
function hideOdds(){ return clamp(0.30 + (G.falseHolds || 0) * 0.22, 0, 0.94); }
function bribeCost(val){ return Math.round(90 + val * 0.30 + (G.wanted || 0) * 130); }

function raiseWanted(n){
  const before = G.wanted || 0;
  G.wanted = clamp(before + n, 0, 5);
  if(G.wanted !== before) syncNavy();
}
function lowerWanted(n){
  const before = G.wanted || 0;
  G.wanted = clamp(before - n, 0, 5);
  if(G.wanted !== before) syncNavy();
}

/* ---- Navy patrols: proximity-based pursuit you can actually shake ---- */
const NAVY_SIGHT  = 1050;   // patrols acquire the player inside this range
const NAVY_LOSE   = 1350;   // ...or break off outright once this far behind
const NAVY_BREAK  = 3.5;    // ...or if you simply out-sail them for this many seconds
const NAVY_GIVEUP = 6;      // seconds chasing a cold trail before they give up
const NAVY_CAUTION_RANGE = 340;   // v2.0 — reef edge within this counts as "dangerous water"
let navyPursuitT  = 0;      // seconds the current chase has run
let navyChaseReal = false;  // has this chase lasted long enough to "count" as one
let navyWasHunting = false;

/* v2.0 — reef-aware steering. A cutter still drives hard for its target, but it
   reads the water: rocks that lie in its path push its heading aside so it takes a
   wider, safer line, and it eases the throttle in dense reef clusters. That is the
   opening the player uses — cut tight through the rocks and the Navy must go around.
   `skill` rises with the wanted level, so at 5 stars they cut far closer and slow
   far less. It never fully overrides the chase, so open water is still theirs. */
function navySteer(n, tx, ty, skill){
  const toX = tx - n.x, toY = ty - n.y;
  const toLen = Math.hypot(toX, toY) || 1;
  const hx = toX / toLen, hy = toY / toLen;         // desired heading (unit)
  const avoidRange = 210 - skill * 78;              // tighter margin at higher wanted
  let steerX = hx, steerY = hy, near = 0;

  for(const rf of G.reefs){
    const dx = n.x - rf.x, dy = n.y - rf.y;
    const dd = Math.hypot(dx, dy) || 1;
    const edge = dd - rf.r - 20;                    // gap from the hull to the rock
    if(edge < NAVY_CAUTION_RANGE) near++;
    if(edge >= avoidRange) continue;

    // only give way to rocks that are ahead of the desired heading
    const ahead = ((rf.x - n.x) * hx + (rf.y - n.y) * hy) / dd;   // -1..1
    if(ahead < -0.25) continue;

    const prox = clamp((avoidRange - edge) / avoidRange, 0, 1.3);
    const w = prox * prox * (0.4 + 0.9 * Math.max(0, ahead));

    // ease away from the rock, and — the important part — slip past it to ONE side
    steerX += (dx / dd) * w * 0.9;
    steerY += (dy / dd) * w * 0.9;
    const cross = hx * (rf.y - n.y) - hy * (rf.x - n.x);   // sign = which side the rock is on
    let side = cross > 0 ? -1 : 1;
    if(Math.abs(cross) < dd * 0.22) side = n._tie || 1;    // rock dead ahead: consistent tiebreak
    steerX += (-hy) * side * w * 1.35;
    steerY += ( hx) * side * w * 1.35;
  }
  const ang = Math.atan2(steerY, steerX);
  const capFloor = 0.52 + skill * 0.20;             // 1★ ≈ 0.65, 5★ ≈ 0.72 of full speed
  const capMul = Math.max(capFloor, 1 - near * 0.11);
  return { ang, capMul, near };
}

/* v1.4 — boarding countdown: a cutter that catches you does NOT capture instantly.
   You get a short window to turn, drift, or run before the inspection begins. */
let navyBoardingT = 0, navyBoardingShip = null;
function showBoardWarn(secs){
  const el = document.getElementById("boardWarn");
  if(!el) return;
  el.innerHTML = `⚠ NAVAL SHIP CLOSING IN<small>Inspection in ${secs}…  turn, drift, or run</small>`;
  el.classList.add("show");
}
function hideBoardWarn(){
  const el = document.getElementById("boardWarn");
  if(el) el.classList.remove("show");
}
function resetBoarding(){ navyBoardingT = 0; navyBoardingShip = null; hideBoardWarn(); }

function crownPortList(){ return PORTS.filter(p => p.faction === "crown"); }
function anyNavyHunting(){ return !!(G.navy && G.navy.some(n => n.state === "hunt")); }

function spawnPatrol(){
  // v1.4 — spawn on a ring a fair distance off (never right on top of you, never
  // across the whole map): far enough for a head start, close enough to feel fair.
  let x, y, tries = 0;
  do{
    const ang  = Math.random() * Math.PI * 2;
    const dist = 950 + Math.random() * 600;
    x = clamp(G.ship.x + Math.cos(ang) * dist, 60, WORLD.w - 60);
    y = clamp(G.ship.y + Math.sin(ang) * dist, 60, WORLD.h - 60);
    tries++;
  }while(tries < 12 && G.reefs && G.reefs.some(rf => Math.hypot(rf.x - x, rf.y - y) < rf.r + 70));
  // a fresh crime sends someone toward where you were — you can still slip the net
  return { x, y, a: 0, vx: 0, vy: 0, state: "search",
           lastSeen: { x: G.ship.x, y: G.ship.y }, searchT: 0,
           anchor: { x, y }, wanderT: 0, gainT: 0, prevD: 99999,
           cautious: false, crawlT: 0, reefBumpT: 0,
           _tie: Math.random() < 0.5 ? -1 : 1 };
}
function patrolFix(n){   // backfill fields on any partial / legacy patrol object
  if(!n.state) n.state = "search";
  if(!n.lastSeen) n.lastSeen = { x: G.ship.x, y: G.ship.y };
  if(n.searchT == null) n.searchT = 0;
  if(!n.anchor) n.anchor = { x: n.x, y: n.y };
  if(n.wanderT == null) n.wanderT = 0;
  if(n.gainT == null) n.gainT = 0;
  if(n.prevD == null) n.prevD = 99999;
  if(n.crawlT == null) n.crawlT = 0;
  if(n.reefBumpT == null) n.reefBumpT = 0;
  if(n._tie == null) n._tie = Math.random() < 0.5 ? -1 : 1;
}
function syncNavy(){
  if(!G.navy) G.navy = [];
  const want = G.wanted || 0;
  while(G.navy.length < want) G.navy.push(spawnPatrol());
  while(G.navy.length > want) G.navy.pop();
  G.navy.forEach(patrolFix);
}
function updateNavy(dt){
  if(!G.navy) G.navy = [];
  if(G.navy.length !== (G.wanted || 0)) syncNavy();
  if((G.wanted || 0) <= 0){ navyPursuitT = 0; navyChaseReal = false; navyWasHunting = false; if(navyBoardingT > 0 || navyBoardingShip) resetBoarding(); return; }

  // 130 (1★) → 250 (5★). Below 5★ you can slowly out-sail them; at 5★ they match you.
  const pMax  = 100 + G.wanted * 30;
  const accel = 210;
  const skill = 0.55 + (G.wanted || 0) * 0.09;   // v2.0 — reef-reading skill rises with heat
  let anyHunting = false, boarded = false;

  for(const n of G.navy){
    patrolFix(n);
    const d = Math.hypot(G.ship.x - n.x, G.ship.y - n.y);

    // acquire / lose the trail
    if(d <= NAVY_SIGHT){
      const freshLock = n.state !== "hunt";
      n.state = "hunt";
      n.lastSeen.x = G.ship.x; n.lastSeen.y = G.ship.y;
      n.searchT = 0;
      // if you keep steadily gaining ground on them, they peel off ("can't keep pace")
      if(freshLock){ n.gainT = 0; }
      else if(d > n.prevD + 0.4){ n.gainT = (n.gainT || 0) + dt; }
      else { n.gainT = 0; }
      n.prevD = d;
      if((n.gainT || 0) > NAVY_BREAK){ n.state = "search"; n.searchT = 0; n.gainT = 0; }
    }else if(n.state === "hunt" && d > NAVY_LOSE){
      n.state = "search"; n.searchT = 0; n.gainT = 0;
    }else if(n.state === "search"){
      n.gainT = 0;
      n.searchT += dt;
      // v1.4 — persistence depends on what you're carrying. Clean hold: they lose
      // interest fairly soon. Contraband aboard: they hunt much longer.
      const giveup = carryingContraband() ? NAVY_GIVEUP * 2.4 : NAVY_GIVEUP;
      if(n.searchT > giveup) n.done = true;   // this cutter breaks off for good
    }
    if(n.state === "hunt") anyHunting = true;

    // target point + speed for this state
    let tx, ty, cap;
    if(n.state === "hunt"){
      // v2.0 — lead a moving target a little, harder at higher wanted
      const lead = skill * 0.32;
      tx = clamp(G.ship.x + G.ship.vx * lead, 0, WORLD.w);
      ty = clamp(G.ship.y + G.ship.vy * lead, 0, WORLD.h);
      cap = pMax;
    }else if(n.state === "search"){
      tx = n.lastSeen.x; ty = n.lastSeen.y; cap = pMax * 0.7;
      if(Math.hypot(tx - n.x, ty - n.y) < 60){   // cold trail — cast about
        n.wanderT -= dt;
        if(n.wanderT <= 0){
          n.wanderT = 1.4 + Math.random()*1.6;
          n.lastSeen.x = clamp(n.x + (Math.random()-0.5)*700, 0, WORLD.w);
          n.lastSeen.y = clamp(n.y + (Math.random()-0.5)*700, 0, WORLD.h);
        }
        cap = pMax * 0.4;
      }
    }else{   // idle — loiter near a Crown port
      tx = n.anchor.x; ty = n.anchor.y; cap = pMax * 0.42;
      if(Math.hypot(tx - n.x, ty - n.y) < 120){
        n.wanderT -= dt;
        if(n.wanderT <= 0){
          n.wanderT = 6 + Math.random()*5;
          const cp = crownPortList()[Math.floor(Math.random()*crownPortList().length)];
          n.anchor = { x: cp.x, y: cp.y };
        }
      }
    }

    // v2.0 — reef-aware steering while pursuing; plain beeline when just loitering
    let ang, capEff = cap;
    if(n.state === "hunt" || n.state === "search"){
      const st = navySteer(n, tx, ty, skill);
      ang = st.ang;
      capEff = cap * st.capMul;
      n.cautious = st.near >= 3;
    }else{
      ang = Math.atan2(ty - n.y, tx - n.x);
      n.cautious = false;
    }
    n.a = ang;
    n.vx += Math.cos(ang) * accel * dt;
    n.vy += Math.sin(ang) * accel * dt;
    const df = Math.pow(0.9, dt); n.vx *= df; n.vy *= df;
    const sp = Math.hypot(n.vx, n.vy);
    if(sp > capEff){ n.vx *= capEff/sp; n.vy *= capEff/sp; }
    n.x = clamp(n.x + n.vx*dt, 0, WORLD.w);
    n.y = clamp(n.y + n.vy*dt, 0, WORLD.h);

    // v2.0 — soft reef contact: never a hard stop or a stick, but scraping a rock
    // costs the cutter speed. This is what a baited "bad line" looks like.
    for(const rf of G.reefs){
      const dx = n.x - rf.x, dy = n.y - rf.y;
      const dd = Math.hypot(dx, dy) || 1;
      const minD = rf.r + 15;
      if(dd < minD){
        const nx = dx / dd, ny = dy / dd;
        n.x = rf.x + nx * minD; n.y = rf.y + ny * minD;
        const into = n.vx * nx + n.vy * ny;
        if(into < 0){ n.vx -= into * nx; n.vy -= into * ny; }   // remove inward velocity only
        n.vx *= 0.66; n.vy *= 0.66;                             // scrape
        n.reefBumpT = 0.6;
      }
    }
    if(n.reefBumpT > 0) n.reefBumpT -= dt;

    // v2.0 — anti-stuck: a cutter that crawls in reef water too long bolts for open sea
    const nspd = Math.hypot(n.vx, n.vy);
    if((n.state === "hunt" || n.state === "search") && nspd < 26 && n.cautious){
      n.crawlT = (n.crawlT || 0) + dt;
    }else{
      n.crawlT = Math.max(0, (n.crawlT || 0) - dt * 2);
    }
    if((n.crawlT || 0) > 1.3){
      let ox = 0, oy = 0;
      for(const rf of G.reefs){
        const dx = n.x - rf.x, dy = n.y - rf.y, dd = Math.hypot(dx, dy) || 1;
        if(dd < 320){ ox += dx / dd; oy += dy / dd; }
      }
      const oa = Math.atan2(oy, ox);
      n.vx += Math.cos(oa) * accel * 1.7 * dt;
      n.vy += Math.sin(oa) * accel * 1.7 * dt;
      if((n.crawlT || 0) > 2.4) n.crawlT = 0;
    }

    // v1.4 — a cutter drawing alongside starts a boarding COUNTDOWN, not an instant capture
    if(n.state === "hunt" && d < 60 && G.invuln <= 0 && navyBoardingT <= 0 && !boarded){
      navyBoardingShip = n;
      navyBoardingT = (G.crew && G.crew.lookout) ? 5.0 : 3.0;   // v1.7 — Lookout buys you time
      { const legDef = activeLegendaryDef();
        if(legDef && legDef.key === "shadowsloop") navyBoardingT += 2.0; }   // v2.8 — Silent Running
    }
  }

  // ---- boarding countdown: you can still turn, drift or run out of grapple range ----
  if(navyBoardingT > 0 && navyBoardingShip){
    navyBoardingT -= dt;
    const bd = Math.hypot(G.ship.x - navyBoardingShip.x, G.ship.y - navyBoardingShip.y);
    if(bd > 340 || navyBoardingShip.done || navyBoardingShip.state !== "hunt"){
      resetBoarding();
      toast("You slip out of their grapple range!", {kind:"warn"});
    }else if(navyBoardingT <= 0){
      const p = navyBoardingShip;
      resetBoarding();
      p.state = "search"; p.searchT = 0;          // after the inspection they fall back to searching
      showNavyInspection(nearestPort().port, "patrol", p);
      return;
    }else{
      showBoardWarn(Math.max(1, Math.ceil(navyBoardingT)));
    }
  }else if(navyBoardingT <= 0 && navyBoardingShip){
    resetBoarding();
  }

  // ---- patrols that broke off for good: remove them, and each one drops a star ----
  const quit = G.navy.filter(n => n.done);
  if(quit.length){
    G.navy = G.navy.filter(n => !n.done);
    lowerWanted(quit.length);
    toast(quit.length > 1
      ? `${quit.length} Navy cutters lose your trail — wanted ${starStr(G.wanted)}.`
      : `A Navy cutter loses your trail and turns back — wanted ${starStr(G.wanted)}.`, {kind:"warn"});
    saveLocal();
  }

  // chase-state edges (handled after the loop so lowerWanted can resize G.navy safely)
  if(anyHunting){
    navyPursuitT += dt;
    if(navyPursuitT > 2.5) navyChaseReal = true;
    if(!navyWasHunting) toast("⚠ A Navy cutter has your scent — open water will shake it.", {kind:"warn", life:3400});
  }else{
    if(navyWasHunting && navyChaseReal && (G.wanted || 0) > 0 && !carryingContraband()){
      lowerWanted(1);
      toast(`Lost them in your wake — wanted level ${starStr(G.wanted)}.`, {kind:"warn"});
      saveLocal();
    }
    navyPursuitT = 0;
    navyChaseReal = false;
  }
  navyWasHunting = anyHunting;
}

let navyCtx = null;   // { port, context:"dock"|"patrol" }
function shouldInspect(port){
  // v1.4 — only inspect at the dock for a real reason: contraband in the hold, or
  // a serious (2★+) bounty. A single star with a clean hold is left alone, so you
  // never get boarded for "nothing".
  const legDef = activeLegendaryDef();
  const warrant = (legDef && legDef.key === "royalgalleon") ? 0.65 : 1;   // v2.8 — Royal Warrant
  if(carryingContraband()) return Math.random() < clamp(0.50 + (G.wanted||0) * 0.08, 0, 0.95) * warrant;
  if((G.wanted||0) >= 2)   return Math.random() < clamp(0.10 * (G.wanted - 1), 0, 0.4) * warrant;
  return false;
}
/* v1.7 — danger tiers so the player understands the threat */
const DANGER_TIERS = ["—", "Patrol", "Pursuit", "Interception", "Dangerous Waters", "Heavy Pursuit"];
function dangerTier(){ return clamp(G.wanted || 0, 0, 5); }
function combatPower(){
  return 25
    + (G.hp / G.hpMax) * 25
    + (G.cannons || 0) * 16
    + ((G.crew && G.crew.gunner) ? 24 : 0)
    + (((G.upgrades && G.upgrades.hull) || 0) + ((G.upgrades && G.upgrades.speed) || 0)) * 4
    + ((activeLegendaryDef() && activeLegendaryDef().combatBonus) || 0);   // v2.8 — Legendary Ships
}
function enemyPower(){ return 28 + dangerTier() * 15; }
function fightOdds(){ const pp = combatPower(), ep = enemyPower(); return pp / (pp + ep); }

function showNavyInspection(port, context, enemyShip){
  navyCtx = { port, context, ship: enemyShip || null };
  bump("navalEncounters");
  resetBoarding();
  G.ship.vx = G.ship.vy = G.ship.spd = 0;
  const contra = contrabandList();
  const val   = contrabandValue(port.id);
  const bribe = bribeCost(val);
  const tier  = dangerTier();
  const contraTxt = contra.length
    ? contra.map(c => `${c.qty}× ${goodName(c.id)}`).join(", ")
    : "nothing in the hold — but your name is on their list";

  document.getElementById("navyTitle").textContent =
    `⚓ Navy Encounter — ${DANGER_TIERS[Math.max(1,tier)] || "Patrol"} (Danger ${Math.max(1,tier)})`;
  document.getElementById("navyBody").innerHTML =
    `<p>${context === "patrol"
      ? `A <b>Navy patrol cutter</b> runs you down on the open sea and grapples alongside.`
      : `A <b>Navy cutter</b> blocks the harbour mouth of <b>${port.name}</b> and orders you to heave to.`}</p>
     <p>Their boarding officers will turn up: <span class="contra">${contraTxt}</span>.</p>
     <p class="nmuted">Danger ${Math.max(1,tier)} · ${DANGER_TIERS[Math.max(1,tier)]} &nbsp;·&nbsp; Wanted ${starStr(G.wanted)} &nbsp;·&nbsp; Purse ${fmt(G.gold)} &nbsp;·&nbsp; Hull ${Math.round(G.hp)}/${G.hpMax} &nbsp;·&nbsp; Guns ${G.cannons||0}/${CANNON_MAX}</p>`;

  const bribeBtn = document.getElementById("navyBribeBtn");
  bribeBtn.textContent = `Bribe the officers — ${fmt(bribe)} gold`;
  bribeBtn.disabled = G.gold < bribe;
  bribeBtn.dataset.cost = bribe;

  const hideBtn = document.getElementById("navyHideBtn");
  if(contra.length === 0){
    hideBtn.textContent = `Hide it — nothing to hide`;
    hideBtn.disabled = true;
  }else if((G.falseHolds || 0) > 0){
    hideBtn.textContent = `Hide it in the false holds — ~${Math.round(hideOdds()*100)}% stays covered`;
    hideBtn.disabled = false;
  }else{
    hideBtn.textContent = `Hide it — needs a False Cargo Hold`;
    hideBtn.disabled = true;
  }
  const fightBtn = document.getElementById("navyFightBtn");
  fightBtn.textContent = `Fight her — about ${Math.round(fightOdds()*100)}% to win`;
  document.getElementById("navyFleeBtn").textContent = `Run for it — +1★ and they give chase`;

  overlayOpen("navyModal");
}
function navyResume(){
  const { port, context } = navyCtx || {};
  navyCtx = null;
  if(context === "dock"){
    overlayDrop("navyModal");     // don't resume — the trade window opens next
    proceedToTrade(port);
  }else{
    G.invuln = 3;
    G.ship.vx = G.ship.vy = G.ship.spd = 0;
    saveLocal();
    overlayClose("navyModal");    // back to open water
  }
}
function navyBribe(){
  const cost = +document.getElementById("navyBribeBtn").dataset.cost || bribeCost(contrabandValue((navyCtx||{}).port ? navyCtx.port.id : PORTS[0].id));
  if(G.gold < cost){ toast("Not enough gold to bribe them."); return; }
  spend(cost);
  toast(`You press ${fmt(cost)} gold into the officer's glove. "Nothing to see here."`);
  saveLocal();
  navyResume();
}
/* v1.7 — partial cover: a fraction of contraband stays hidden, the rest is exposed */
function navyHide(){
  if((G.falseHolds || 0) <= 0) return;
  bump("timesInspected");
  const port = (navyCtx || {}).port || PORTS[0];
  const contra = contrabandList();
  const totalContra = contra.reduce((s, c) => s + c.qty, 0);
  const coverFrac = hideOdds();
  // how much stays covered, per good, weighted by cover fraction + a little luck
  let hiddenTot = 0, exposedTot = 0, fine = 0;
  for(const c of contra){
    let hid = Math.round(c.qty * clamp(coverFrac + (Math.random() - 0.5) * 0.2, 0, 1));
    hid = clamp(hid, 0, c.qty);
    const exp = c.qty - hid;
    hiddenTot += hid; exposedTot += exp;
    if(exp > 0){
      fine += exp * priceAt(port.id, c.id) * 0.4;
      G.cargo[c.id] = hid;
      if(hid <= 0) G.avg[c.id] = GOODS.find(x=>x.id===c.id).base;
    }
  }
  if(exposedTot === 0){
    bump("timesHidden"); bump("smugglingSuccess"); bump("neverCaughtStreak");
    if(G.stats && G.stats.neverCaughtStreak > G.stats.bestNeverCaughtStreak)
      G.stats.bestNeverCaughtStreak = G.stats.neverCaughtStreak;
    toast(`Every bulkhead rapped — all ${hiddenTot} contraband stayed covered. You're waved on.`, {kind:"warn"});
    saveLocal();
    navyResume();
  }else{
    fine = Math.min(G.gold, Math.round(fine));
    spend(fine);
    raiseWanted(1);
    bump("timesCaught"); bump("smugglingFail"); bump("cargoLost", exposedTot);
    if(G.stats) G.stats.neverCaughtStreak = 0;
    toast(`⚠ SEARCHED — Hidden: ${hiddenTot}/${totalContra} · Exposed: ${exposedTot} seized · ${fmt(fine)} gold fined · wanted ${starStr(G.wanted)}. You could still run.`, {kind:"warn", life:5000});
    saveLocal();
    navyResume();
  }
}
/* v1.7 — stand and fight the patrol. Win = reward + it's gone. Lose = it hurts. */
function navyFight(){
  bump("timesInspected");
  const port = (navyCtx || {}).port || nearestPort().port;
  const ctx  = navyCtx || {};
  const win  = Math.random() < fightOdds();
  navyCtx = null;

  if(win){
    bump("navalWins");
    gainXp(30, "combat");
    lowerWanted(1);
    if(ctx.ship && G.navy) G.navy = G.navy.filter(n => n !== ctx.ship);
    syncNavy();
    const hurt = 8 + Math.round(Math.random() * 14);
    applyDamage(hurt, true);
    const gold = Math.round((130 + dangerTier() * 95 + Math.round(Math.random() * 120)) * charterMult());
    earn(gold);
    bump("bountyEarnings", gold);
    if(G.stats && gold > (G.stats.highestBounty || 0)) G.stats.highestBounty = gold;
    // salvage: sometimes powder/ore/gems, or contraband from their own seized locker
    const loot = [];
    if(Math.random() < 0.7){
      const pick = ["powder","ore","gems","tea"][Math.floor(Math.random()*4)];
      const q = 2 + Math.floor(Math.random()*5);
      const space = G.cargoMax - totalCargo();
      const take = Math.min(q, Math.max(0, space));
      if(take > 0){ G.cargo[pick] += take; loot.push(`${take} ${goodName(pick)}`); }
    }
    if(dangerTier() >= 3 && Math.random() < 0.4){
      const space = G.cargoMax - totalCargo();
      if(space > 0){ const q = Math.min(2, space); G.cargo.royaljewels += q; loot.push(`${q} Royal Jewels (from their locker)`); }
    }
    G.invuln = 3.5;
    G.ship.vx = G.ship.vy = G.ship.spd = 0;
    toast(`⚔ You take her! +${fmt(gold)} gold${loot.length ? " · salvage: " + loot.join(", ") : ""} · −${hurt} hull · wanted ${starStr(G.wanted)}.`, {kind:"save", life:5200});
    saveLocal();
    if(ctx.context === "dock"){ overlayDrop("navyModal"); proceedToTrade(port); }
    else overlayClose("navyModal");
  }else{
    bump("navalLosses");
    const goldLost = Math.round(G.gold * (0.12 + Math.random() * 0.13));
    G.gold -= goldLost;
    let cargoLost = 0;
    for(const gd of GOODS){
      if(G.cargo[gd.id] <= 0) continue;
      const drop = Math.ceil(G.cargo[gd.id] * (0.25 + Math.random() * 0.25));
      G.cargo[gd.id] -= drop; cargoLost += drop;
    }
    bump("cargoLost", cargoLost);
    const hurt = 28 + Math.round(Math.random() * 22);
    shake = 20;
    applyDamage(hurt, true);          // may trigger shipwreck() which tows you to port
    if(G.hp > 0){
      // forced back to the nearest port to lick your wounds
      const ang = Math.atan2(G.ship.y - port.y, G.ship.x - port.x);
      G.ship.x = clamp(port.x + Math.cos(ang) * (port.r + 170), 40, WORLD.w - 40);
      G.ship.y = clamp(port.y + Math.sin(ang) * (port.r + 170), 40, WORLD.h - 40);
      G.dockCooldown = port.id;
      G.invuln = 3.5;
      G.ship.vx = G.ship.vy = G.ship.spd = 0;
    }
    toast(`⚔ Beaten off — ${cargoLost} cargo lost, ${fmt(goldLost)} gold gone, −${hurt} hull. Limp back to ${port.name} and restock.`, {kind:"warn", life:5600});
    saveLocal();
    overlayClose("navyModal");
  }
}
function navyFlee(){
  const legDef = activeLegendaryDef();
  const ghost = legDef && legDef.key === "ghostrunner";   // v2.8 — Vanishing Trick
  if(!ghost) raiseWanted(1);
  bump("timesEscaped"); bump("navalEscapes");
  const hurt = Math.round((8 + Math.round(Math.random() * 14)) * (ghost ? 0.5 : 1));
  applyDamage(hurt, true);
  shake = 16;
  const { port, context } = navyCtx || {};
  navyCtx = null;
  if(context === "dock" && port){
    const ang = Math.atan2(G.ship.y - port.y, G.ship.x - port.x);
    const d = port.r + SHIP.rad + 155;
    G.ship.x = clamp(port.x + Math.cos(ang)*d, 40, WORLD.w - 40);
    G.ship.y = clamp(port.y + Math.sin(ang)*d, 40, WORLD.h - 40);
    G.ship.a = ang;
    G.dockCooldown = port.id;
  }
  G.ship.vx = G.ship.vy = G.ship.spd = 0;
  G.invuln = 3.5;
  syncNavy();
  toast(`Sails full, you run! The Navy opens fire — −${hurt} hull, wanted level ${starStr(G.wanted)}.`);
  saveLocal();
  overlayClose("navyModal");    // fled — back to open water
}

/* ---------- smuggler services (shipwright + pirate havens) ---------- */
const FALSE_HOLD_MAX = 3;
function falseHoldCost(n){ return 380 + n * 320; }
function buyFalseHold(){
  if((G.falseHolds || 0) >= FALSE_HOLD_MAX){ toast("She's got as many hidden holds as her ribs will take."); return; }
  const res = multiBuy({
    cap: FALSE_HOLD_MAX,
    level: () => G.falseHolds || 0,
    cost:  () => falseHoldCost(G.falseHolds || 0),
    apply: () => { G.falseHolds = (G.falseHolds || 0) + 1; bump("servicesBought"); },
  });
  if(res.bought === 0){ toast(`The carpenter wants ${fmt(falseHoldCost(G.falseHolds || 0))} for the work.`); return; }
  toast(`Hidden compartments fitted — ${G.falseHolds}/${FALSE_HOLD_MAX}${res.bought > 1 ? ` (+${res.bought})` : ""} · −${fmt(res.spentTotal)} gold. Inspection odds improved.`);
  afterTrade();
}
function payOffOfficials(){
  if((G.wanted || 0) <= 0){ toast("Your name's already clean."); return; }
  const cost = 200 + G.wanted * G.wanted * 90;
  if(G.gold < cost){ toast(`The officials want ${fmt(cost)} to lose the paperwork.`); return; }
  spend(cost); G.wanted = 0; syncNavy(); bump("servicesBought");
  toast("Gold vanishes into a back room. Every bounty on you is quietly torn up.");
  afterTrade();
}
function buyFalseColours(){
  if((G.wanted || 0) <= 0){ toast("No sense hiding — you're not wanted."); return; }
  const cost = 520;
  if(G.gold < cost){ toast(`Forged papers and colours cost ${fmt(cost)}.`); return; }
  spend(cost); lowerWanted(2); bump("servicesBought");
  toast(`New flag, new papers, new name. Wanted level down to ${starStr(G.wanted)}.`);
  afterTrade();
}

/* ---------- v1.5 shipwright upgrades + insurance ---------- */
const SW_DEFS = [
  { key:"speed", name:"Rigging & Sails", desc:"+6% top speed",        base:600 },
  { key:"accel", name:"Trim & Ballast",  desc:"+9% acceleration",     base:520 },
  { key:"turn",  name:"Rudder & Helm",   desc:"+9% turning",          base:520 },
  { key:"hull",  name:"Oak Planking",    desc:"+15 max hull",         base:640 },
];
const SW_MAX_LEVEL = 8;   // v1.9 — raised from 5; levels 6-8 are milestone-priced
function swCost(def){
  const lv = G.upgrades[def.key] || 0;
  let cost = lv < 5 ? def.base + lv * Math.round(def.base * 0.8)          // early game unchanged
                     : Math.round(def.base * (6 + (lv - 4) * 6));         // L6≈×12, L7≈×18, L8≈×24
  if(currentPort) cost = Math.max(1, Math.round(cost * (1 - shipyardDiscount(currentPort.id))));   // v2.5
  return cost;
}
function buyShipwright(key){
  const def = SW_DEFS.find(d => d.key === key);
  if(!def) return;
  if((G.upgrades[key] || 0) >= SW_MAX_LEVEL){ toast("That's as far as the shipwright will take her."); return; }
  const res = multiBuy({
    cap: SW_MAX_LEVEL,
    level: () => G.upgrades[key] || 0,
    cost:  () => swCost(def),          // swCost reads G.upgrades[key] live — always the next level
    apply: () => {
      G.upgrades[key] = (G.upgrades[key] || 0) + 1;
      if(key === "hull"){ G.hpMax += 15; G.hp += 15; }
      bump("shipUpgrades"); bump("servicesBought");
    },
  });
  if(res.bought === 0){ toast(`The shipwright wants ${fmt(swCost(def))} for that work.`); return; }
  toast(`${def.name} → level ${G.upgrades[key]}${res.bought > 1 ? ` (+${res.bought} levels)` : ""} · −${fmt(res.spentTotal)} gold`);
  afterTrade();
}
function insuranceCost(){ return 260 + Math.round(cargoValue() * 0.05); }
function buyInsurance(){
  if(G.insured){ toast("You're already covered until your next mishap."); return; }
  const cost = insuranceCost();
  if(G.gold < cost){ toast(`The underwriters want ${fmt(cost)} for a policy.`); return; }
  spend(cost); G.insured = true; bump("servicesBought");
  toast(`Insured — a wreck now costs far less gold and cargo (pays out once).`);
  afterTrade();
}

/* v1.9 — Grand Fittings: large one-time milestone upgrades for a wealthy captain */
function buyGrand(key){
  const def = GRAND_DEFS.find(d => d.key === key);
  if(!def || !G.grand) return;
  if(G.grand[key]){ toast(`${def.name} is already fitted.`); return; }
  if(G.gold < def.cost){ toast(`${def.name} is a ${fmt(def.cost)} Sovereign job — save toward it.`); return; }
  spend(def.cost); G.grand[key] = true;
  bump("shipUpgrades"); bump("servicesBought");
  if(key === "ironhull"){ G.hpMax += 50; G.hp += 50; }
  if(key === "galleon"){ G.cargoMax += 60; G.hpMax += 25; G.hp += 25; }
  toast(`⚓ ${def.name} fitted — a milestone on the road to a Fortune.`, {kind:"save", life:4200});
  afterTrade();
}
function jobSlotMax(){ return 4 + ((G.grand && G.grand.galleon) ? 2 : 0); }
/* +40% on contract & prize payouts once the Master's Charter is signed */
function charterMult(){ return (G.grand && G.grand.charter) ? 1.4 : 1; }

/* v2.3 — Business Holdings: buy into a venture, collect the accrued ledger.
   Small, predictable, and never a replacement for actually playing. */
function buyVenture(){
  if(!G.passive) G.passive = freshPassive();
  if(G.passive.ventures >= VENTURE_MAX){ toast("You already hold every venture the guild will sell you."); return; }
  const cost = ventureCost(G.passive.ventures);
  if(G.gold < cost){ toast(`A stake in another venture costs ${fmt(cost)} gold.`); return; }
  spend(cost);
  G.passive.ventures += 1;
  bump("servicesBought");
  toast(`Venture bought — your holdings pay ${fmt(passiveDailyRate())} gold/day from tomorrow.`, {kind:"save"});
  afterTrade();
}
function collectPassive(){
  if(!G.passive) G.passive = freshPassive();
  const amt = Math.floor(G.passive.accrued);
  if(amt <= 0){
    toast(G.passive.ventures > 0
      ? "Nothing in the ledger yet — your holdings pay out each night you Rest."
      : "You hold no ventures. Buy one to start earning while you sail.");
    return;
  }
  earn(amt);
  G.passive.accrued -= amt;
  G.passive.lastCollectDay = G.day;
  bump("passiveCollected", amt);
  toast(`🏦 Collected ${fmt(amt)} gold from your business holdings.`, {kind:"save"});
  afterTrade();
}

/* =====================================================================
   v1.7 — Crew · Ship colours · Legal jobs (contracts)
   ===================================================================== */
function hireCrew(key){
  const def = CREW_DEFS.find(d => d.key === key);
  if(!def) return;
  if(G.crew[key]){ toast(`${def.name} is already aboard.`); return; }
  if(G.gold < def.cost){ toast(`${def.name} won't sign on for less than ${fmt(def.cost)}.`); return; }
  spend(def.cost); G.crew[key] = true; bump("servicesBought");
  toast(`${def.name} signs the articles and comes aboard.`);
  afterTrade();
}
function paintShip(part, choice){
  const table = part === "hull" ? HULL_PAINT : SAIL_PAINT;
  if(!table[choice]) return;
  if(!paintUnlocked(choice)){ toast(`That colour isn't unlocked yet — reach ${RANK_DEFS[RANK_PAINT_GATE[choice]].name} rank first.`); return; }
  const cost = 180;
  if(G.cosmetic[part] === choice){ toast("She's already that colour."); return; }
  if(G.gold < cost){ toast(`The painters want ${fmt(cost)} gold.`); return; }
  spend(cost); G.cosmetic[part] = choice; bump("servicesBought");
  toast(`Fresh ${part === "hull" ? "paint on the hull" : "canvas on the yards"}.`);
  afterTrade();
}
const CANNON_MAX = 6;   // v1.9 — raised from 4; the top pairs are a milestone
function cannonCost(n){
  const base = n < 4 ? 700 + n * 520 : 2200 + (n - 3) * 1800;
  const disc = currentPort ? shipyardDiscount(currentPort.id) : 0;   // v2.5 — Crown Shipyard discount
  return Math.max(1, Math.round(base * (1 - disc)));
}
function buyCannons(){
  if((G.cannons || 0) >= CANNON_MAX){ toast("She's carrying all the iron her deck will bear."); return; }
  const res = multiBuy({
    cap: CANNON_MAX,
    level: () => G.cannons || 0,
    cost:  () => cannonCost(G.cannons || 0),
    apply: () => { G.cannons = (G.cannons || 0) + 1; bump("shipUpgrades"); bump("servicesBought"); },
  });
  if(res.bought === 0){ toast(`The gunfounder wants ${fmt(cannonCost(G.cannons || 0))} for another pair.`); return; }
  toast(`Guns run out — cannons at ${G.cannons}/${CANNON_MAX}${res.bought > 1 ? ` (+${res.bought} pairs)` : ""} · −${fmt(res.spentTotal)} gold.`);
  afterTrade();
}

/* ---- Legal jobs / contracts ---- */
const JOB_GOODS = ["sugar","fish","ore","tobacco","rum","tea","spice"];
function portDist(aId, bId){ const a = portById(aId), b = portById(bId); return Math.hypot(a.x-b.x, a.y-b.y); }
function rollJobBoard(port){
  const board = [];
  const others = PORTS.filter(p => p.id !== port.id);
  const n = 2 + (Math.random() < 0.6 ? 1 : 0);
  for(let i = 0; i < n; i++){
    const to = others[Math.floor(Math.random() * others.length)];
    const dist = portDist(port.id, to.id);
    const distK = dist / 1400;
    const roll = Math.random();
    let job;
    if(roll < 0.42){
      const qty = 6 + Math.floor(Math.random() * 12);
      job = { type:"delivery", qty,
        reward: Math.round((70 + qty * 14) * (1 + distK * 0.9)),
        title:`Deliver ${qty} crates of cargo to ${to.name}` };
    }else if(roll < 0.68){
      job = { type:"passenger", qty:2,
        reward: Math.round((150 + 90) * (1 + distK * 1.3)),
        title:`Carry a paying passenger to ${to.name}` };
    }else if(roll < 0.86){
      const good = JOB_GOODS[Math.floor(Math.random() * JOB_GOODS.length)];
      const qty = 5 + Math.floor(Math.random() * 8);
      const prem = Math.round(normalPrice(to.id, good) * qty * 1.35 * (1 + distK * 0.4));
      job = { type:"supply", good, qty, reward: prem,
        title:`Supply ${qty} ${goodName(good)} to ${to.name}` };
    }else{
      job = { type:"courier", qty:1,
        reward: Math.round((90) * (1 + distK * 1.1)),
        title:`Run sealed dispatches to ${to.name}` };
    }
    job.id = Math.random().toString(36).slice(2, 9);
    job.from = port.id; job.to = to.id;
    job.reward = Math.round(job.reward * charterMult());   // v1.9 — Master's Charter
    if(job.type === "supply") job.reward = Math.round(job.reward * influenceContractMult(job.good));   // v2.6 — Dominant/Monopoly supply bonus
    job.dayLimit = job.type === "courier" ? 5 : (7 + Math.round(distK * 3));
    if(!job.good) job.good = null;
    board.push(job);
  }
  return board;
}
let jobBoard = [];
function acceptJob(idx){
  const job = jobBoard[idx];
  if(!job) return;
  if((G.jobs || []).length >= jobSlotMax()){ toast(`You can only hold ${jobSlotMax()} contracts at once.`); return; }
  const reserve = job.type === "supply" ? 0 : job.qty;
  if(reserve > 0 && totalCargo() + reserve > G.cargoMax){ toast(`Not enough free hold — this contract needs ${reserve} space.`); return; }
  if(job.type === "supply" && (G.cargo[job.good] || 0) < 1){
    toast(`Accepted — now buy ${job.qty} ${goodName(job.good)} and carry it to ${portById(job.to).name}.`);
  }
  G.jobs = G.jobs || [];
  G.jobs.push({ ...job, acceptedDay: G.day });
  jobBoard.splice(idx, 1);
  toast(`Contract taken: ${job.title}. ${fmt(job.reward)} gold on delivery.`);
  afterTrade();
}
function abandonJob(id){
  const j = (G.jobs || []).find(x => x.id === id);
  if(!j) return;
  G.jobs = G.jobs.filter(x => x.id !== id);
  bump("jobsFailed");
  toast(`Contract abandoned — ${j.title}.`, {kind:"warn"});
  afterTrade();
}
function resolveJobsAt(port){
  if(!Array.isArray(G.jobs) || !G.jobs.length) return;
  const done = [];
  for(const j of G.jobs){
    if(j.to !== port.id) continue;
    if(j.type === "supply"){
      if((G.cargo[j.good] || 0) < j.qty) continue;   // haven't brought the goods yet
      G.cargo[j.good] -= j.qty;
      if(G.cargo[j.good] <= 0) G.avg[j.good] = GOODS.find(x=>x.id===j.good).base;
    }
    done.push(j);
  }
  for(const j of done){
    G.jobs = G.jobs.filter(x => x.id !== j.id);
    earn(j.reward);
    bump("jobsCompleted"); bump("legalJobPay", j.reward);
    gainXp(j.type === "supply" ? 40 : 25, "contract");
    setTimeout(()=>toast(`✓ Contract complete — ${j.title}. +${fmt(j.reward)} gold.`, {kind:"save", life:3600}), 250);
  }
}
function expireJobs(){
  if(!Array.isArray(G.jobs) || !G.jobs.length) return;
  const dead = G.jobs.filter(j => G.day - j.acceptedDay > j.dayLimit);
  if(!dead.length) return;
  G.jobs = G.jobs.filter(j => G.day - j.acceptedDay <= j.dayLimit);
  for(const j of dead){ bump("jobsFailed"); }
  toast(`${dead.length > 1 ? dead.length + " contracts have" : "A contract has"} run past the deadline and lapsed.`, {kind:"warn", life:3600});
}

/* ---------- Docking ---------- */
let currentPort = null;
let dockTarget = null;   // port the ship is close enough to dock at (press E)
function openTrade(port){
  currentPort = port;
  dockTarget = null;
  paused = true;                 // stop the world the instant we touch a harbour
  G.voyages += 1;
  bump("portDockings");
  if(G.stats){ if(!G.stats.seenPorts[port.id]){ G.stats.seenPorts[port.id] = 1; G.stats.islandsVisited = Object.keys(G.stats.seenPorts).length; } }
  G.ship.vx = G.ship.vy = G.ship.spd = 0;
  // Navy Entry Inspection — Crown ports check smugglers (and wanted captains) at the harbour mouth
  if(isCrown(port) && shouldInspect(port)){
    showNavyInspection(port, "dock");
    return;   // the trade window only opens once the inspection is resolved
  }
  // v2.7 — a live black market auction at this port takes the floor before trade does
  if(auctionActiveAt(port.id)){
    saveLocal();
    openAuction();
    return;
  }
  proceedToTrade(port);
}
function proceedToTrade(port){
  currentPort = port;
  tradeTab = "mkt";   // every dock opens on the Market tab
  // Prices are FROZEN while travelling and docking — they only move on "Rest & Advance Time".
  resolveJobsAt(port);            // pay out any contracts bound for here
  jobBoard = rollJobBoard(port);  // fresh contracts on the board
  maybeDockEvent(port);
  checkWin();
  saveLocal();
  renderTrade(port);
  renderDash();
  overlayOpen("tradeModal");
}
function maybeDockEvent(port){
  const r = Math.random();
  if(r < 0.10){
    const fine = spend(Math.min(G.gold, 30 + Math.round(G.gold*0.05)));
    setTimeout(()=>toast(`Customs at ${port.name} levied ${fmt(fine)} in 'fees'.`), 300);
  }else if(r < 0.20){
    const gain = earn(50 + Math.round(Math.random()*130));
    setTimeout(()=>toast(`A smuggling contact paid you ${fmt(gain)} on the quiet.`), 300);
  }else if(r < 0.30 && totalCargo() > 0){
    const held = Object.keys(G.cargo).filter(k=>G.cargo[k]>0);
    const gd = held[Math.floor(Math.random()*held.length)];
    const lost = Math.max(1, Math.round(G.cargo[gd]*0.15));
    G.cargo[gd] -= lost;
    bump("cargoLost", lost);
    setTimeout(()=>toast(`Dockhands 'lost' ${lost} ${goodName(gd)} in the unloading.`), 300);
  }
}
function closeTrade(){
  const p = currentPort;
  if(p){
    // shove the ship just clear of the harbour, pointing away from the island
    const ang = Math.atan2(G.ship.y - p.y, G.ship.x - p.x);
    const d = p.r + SHIP.rad + 120;
    G.ship.x = clamp(p.x + Math.cos(ang)*d, 40, WORLD.w-40);
    G.ship.y = clamp(p.y + Math.sin(ang)*d, 40, WORLD.h-40);
    G.ship.a = ang;
    G.dockCooldown = p.id;
  }
  G.ship.vx = G.ship.vy = G.ship.spd = 0;
  currentPort = null;
  overlayClose("tradeModal");    // -> resumeFromOverlays -> beginPlay
}

function nearestPort(){
  let best = null, bd = Infinity;
  for(const p of PORTS){
    const d = Math.hypot(p.x - G.ship.x, p.y - G.ship.y);
    if(d < bd){ bd = d; best = p; }
  }
  return { port:best, dist:bd };
}

/* ---------- Ship physics ---------- */
/* v1.7 — a touch faster & more responsive; drag (and the drift it gives) is unchanged */
const SHIP = { rad:15, accel:262, reverse:138, turn:2.72, drag:0.86, maxSpd:278 };

function updateShip(dt){
  const s = G.ship;
  const up    = keys["w"]||keys["arrowup"];
  const down  = keys["s"]||keys["arrowdown"];
  const left  = keys["a"]||keys["arrowleft"];
  const right = keys["d"]||keys["arrowright"];

  // v1.5 — shipwright upgrades. Drag (and therefore drift/inertia) is untouched.
  const u = G.upgrades || {};
  const clip = (G.grand && G.grand.clipper) ? 1 : 0;   // v1.9 — Bluewater Clipper Rig
  const legM = legendaryPhysMult();                    // v2.8 — Legendary Ships
  const maxSpd  = SHIP.maxSpd  * (1 + (u.speed||0) * 0.06) * (1 + clip * 0.22) * legM.speed;
  const accelF  = SHIP.accel   * (1 + (u.accel||0) * 0.09) * (1 + clip * 0.16) * legM.accel;
  // v3.1 — a ship's turning circle is roughly speed / turn-rate, so raw top speed
  // growth from Shipwright levels + Clipper (which has no turn stat of its own)
  // used to widen the turning circle far faster than turnF grew, making upgraded
  // ships feel like they'd lost their brakes. Folding half that same speed growth
  // into turnF keeps the circle from ballooning while still letting a maxed-out
  // hull feel heavier than a stock one. Legendary turnMult is untouched below —
  // that's each ship's own deliberate handling personality (e.g. Ironclad stays sluggish).
  const speedGrowth = (1 + (u.speed||0) * 0.06) * (1 + clip * 0.22);
  const turnF   = SHIP.turn    * (1 + (u.turn ||0) * 0.09) * (1 + (speedGrowth - 1) * 0.5) * legM.turn;

  // turning — a touch sharper when moving
  const turnScale = 0.45 + 0.55 * clamp(s.spd / maxSpd, 0, 1);
  if(left)  s.a -= turnF * turnScale * dt;
  if(right) s.a += turnF * turnScale * dt;

  // thrust along heading
  let ax = 0, ay = 0;
  if(up){   ax += Math.cos(s.a) * accelF; ay += Math.sin(s.a) * accelF; }
  if(down){ ax -= Math.cos(s.a) * SHIP.reverse; ay -= Math.sin(s.a) * SHIP.reverse; }
  s.vx += ax * dt; s.vy += ay * dt;

  // water drag
  const dragF = Math.pow(SHIP.drag, dt);
  s.vx *= dragF; s.vy *= dragF;

  // clamp speed
  s.spd = Math.hypot(s.vx, s.vy);
  if(s.spd > maxSpd){ const k = maxSpd/s.spd; s.vx*=k; s.vy*=k; s.spd = maxSpd; }

  const nx = s.x + s.vx * dt;
  const ny = s.y + s.vy * dt;

  // world bounds
  s.x = clamp(nx, SHIP.rad, WORLD.w - SHIP.rad);
  s.y = clamp(ny, SHIP.rad, WORLD.h - SHIP.rad);
  if(s.x !== nx) s.vx *= -0.3;
  if(s.y !== ny) s.vy *= -0.3;

  // distance travelled (log only — the calendar and markets do NOT move while
  // sailing; only "Rest & Advance Time" in a port advances the day / shifts prices)
  const moved = s.spd * dt;
  G.distSailed += moved;

  if(G.invuln > 0) G.invuln -= dt;

  // wake particles
  if(s.spd > 40 && Math.random() < s.spd/260){
    wake.push({
      x: s.x - Math.cos(s.a)*14 + (Math.random()-0.5)*8,
      y: s.y - Math.sin(s.a)*14 + (Math.random()-0.5)*8,
      life: 1, r: 2 + Math.random()*3,
    });
  }

  // ---- collisions ----
  // reefs
  for(const rf of G.reefs){
    const d = Math.hypot(rf.x - s.x, rf.y - s.y);
    const minD = rf.r + SHIP.rad;
    if(d < minD){
      const nxn = (s.x - rf.x)/(d||1), nyn = (s.y - rf.y)/(d||1);
      s.x = rf.x + nxn*minD; s.y = rf.y + nyn*minD;
      const into = s.vx*nxn + s.vy*nyn;
      if(into < 0){ s.vx -= 1.7*into*nxn; s.vy -= 1.7*into*nyn; }
      s.vx *= 0.5; s.vy *= 0.5;
      if(G.invuln <= 0){
        let hurt = clamp(6 + s.spd*0.06, 6, 26);
        if(G.crew && G.crew.navigator) hurt *= 0.55;   // v1.7 — Navigator reads the water
        applyDamage(hurt, true);
        G.invuln = 0.8;
        bump("reefHits");
        shake = Math.min(14, 6 + hurt*0.4);
        toast(`Struck a reef! −${Math.round(hurt)} hull.`, {kind:"warn"});
        saveLocal();
      }
    }
  }

  // ports — solid islands; docking now requires an E key press
  dockTarget = null;
  let dockBest = Infinity;
  for(const p of PORTS){
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    const solid = p.r + SHIP.rad;           // you cannot sail through the island
    if(d < solid){
      const nxn = (s.x - p.x)/(d||1), nyn = (s.y - p.y)/(d||1);
      s.x = p.x + nxn*solid; s.y = p.y + nyn*solid;
      const into = s.vx*nxn + s.vy*nyn;
      if(into < 0){ s.vx -= 1.4*into*nxn; s.vy -= 1.4*into*nyn; }
      s.vx *= 0.55; s.vy *= 0.55;
    }
    // within docking range and not on cooldown -> eligible for the prompt
    if(d < solid + 78 && G.dockCooldown !== p.id && d < dockBest){
      dockBest = d; dockTarget = p;
    }
  }
  // clear cooldown as soon as we're just outside docking range — so you can
  // turn straight back around and re-dock without a long detour
  if(G.dockCooldown){
    const cp = portById(G.dockCooldown);
    if(Math.hypot(cp.x - s.x, cp.y - s.y) > cp.r + SHIP.rad + 88) G.dockCooldown = null;
  }
}

/* Called when the player presses the dock key near a port */
function tryDock(){
  if(paused || !dockTarget) return;
  openTrade(dockTarget);
}

function applyDamage(amount, hard){
  if(G.grand && G.grand.ironhull) amount *= 0.75;   // v1.9 — Ironbound Hull
  const legDef = activeLegendaryDef();
  if(legDef && legDef.key === "ironclad") amount *= 0.85;   // v2.8 — Iron Hull passive
  G.hp = Math.max(0, G.hp - amount);
  if(G.hp <= 0) shipwreck();
}
function shipwreck(){
  // v1.5 — Insurance (a Port Service) softens the blow considerably
  const goldRate  = G.insured ? 0.20 : 0.50;
  const cargoKeep = G.insured ? 0.75 : 0.50;
  const lost = Math.round(G.gold * goldRate);
  G.gold -= lost;
  let cargoLost = 0;
  for(const gd of GOODS){
    const keep = Math.floor(G.cargo[gd.id] * cargoKeep);
    cargoLost += G.cargo[gd.id] - keep;
    G.cargo[gd.id] = keep;
  }
  G.hp = 55;
  bump("shipwrecks"); bump("cargoLost", cargoLost);
  const wasInsured = G.insured;
  G.insured = false;   // the policy pays out once
  const { port } = nearestPort();
  G.ship.x = port.x; G.ship.y = port.y + port.r + 130;
  G.ship.vx = G.ship.vy = G.ship.spd = 0;
  G.invuln = 2.5;
  G.dockCooldown = port.id;
  shake = 20;
  toast(`⚠ WRECKED — salvaged and towed to ${port.name}. Lost ${fmt(lost)} gold${wasInsured ? " (insurance paid out)" : ""} and some cargo.`, {kind:"warn", life:4600});
  saveLocal();
}

/* ---------- Camera ---------- */
function updateCamera(){
  const vw = canvas.width / dpr, vh = canvas.height / dpr;
  let tx = G.ship.x - vw/2, ty = G.ship.y - vh/2;
  tx = clamp(tx, 0, Math.max(0, WORLD.w - vw));
  ty = clamp(ty, 0, Math.max(0, WORLD.h - vh));
  cam.x += (tx - cam.x) * 0.12;
  cam.y += (ty - cam.y) * 0.12;
}

/* ---------- Rendering ---------- */
function draw(){
  const vw = canvas.width / dpr, vh = canvas.height / dpr;
  ctx.save();
  let sx = 0, sy = 0;
  if(shake > 0.3){ sx = (Math.random()-0.5)*shake; sy = (Math.random()-0.5)*shake; shake *= 0.86; } else shake = 0;
  ctx.translate(-cam.x + sx, -cam.y + sy);

  // ocean
  drawOcean(vw, vh);

  // reefs (cached rock polygons, animated foam)
  for(const rf of G.reefs) drawReef(rf);

  // ports (pre-rendered sprites — the art never changes)
  for(const p of PORTS){
    if(!p._spr) buildPortSprite(p);
    ctx.drawImage(p._spr.cv, p.x - p._spr.S/2, p.y - p._spr.S/2, p._spr.S, p._spr.S);
  }

  // wake
  ctx.fillStyle = "#bfe6ef";
  for(const w of wake){
    ctx.globalAlpha = w.life * 0.5;
    ctx.beginPath(); ctx.arc(w.x, w.y, w.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // navy patrols, then the player ship on top
  drawNavy();
  drawShip();

  ctx.restore();

  // docking prompt — only rebuild the DOM when the target port actually changes
  if(dockTarget && !paused){
    if(_hintPortId !== dockTarget.id){
      _hintPortId = dockTarget.id;
      hintEl.innerHTML =
        `Press <span class="keycap">E</span> to dock at <b>${dockTarget.name}</b>`;
    }
    hintEl.classList.add("show");
  }else{ _hintPortId = null; hintEl.classList.remove("show"); }

  drawMinimap();
}
let _hintPortId = null;

/* --------- world-art caches: rebuilt only when G / reefs change --------- */
function buildReefPoly(rf){
  const rnd = mulberry32(Math.floor(rf.x*13 + rf.y));
  const pts = [];
  for(let i=0;i<=8;i++){
    const ang = i/8 * Math.PI*2;
    const rr = rf.r * (0.6 + rnd()*0.5);
    pts.push([Math.cos(ang)*rr, Math.sin(ang)*rr]);
  }
  rf._poly = pts;
}
let miniStatic = null;
function buildMiniStatic(){
  const W = mini.width, H = mini.height;
  if(!miniStatic){ miniStatic = document.createElement("canvas"); miniStatic.width = W; miniStatic.height = H; }
  const c = miniStatic.getContext("2d");
  c.clearRect(0,0,W,H);
  const bg = c.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#26221b"); bg.addColorStop(1,"#1a1712");
  c.fillStyle = bg; c.fillRect(0,0,W,H);
  c.fillStyle = "rgba(120,80,30,.28)";
  c.fillRect(0,0,W,6); c.fillRect(0,H-6,W,6); c.fillRect(0,0,5,H); c.fillRect(W-5,0,5,H);
  const sx = W / WORLD.w, sy = H / WORLD.h;
  for(const rf of G.reefs){
    c.fillStyle = "#0c1013"; c.beginPath(); c.arc(rf.x*sx, rf.y*sy, 2.3, 0, Math.PI*2); c.fill();
    c.fillStyle = "#aab5c0"; c.beginPath(); c.arc(rf.x*sx, rf.y*sy, 1.4, 0, Math.PI*2); c.fill();
  }
  for(const p of PORTS){
    // v3.2 — Crown vs Haven now reads at a glance, matching the same colours
    // used everywhere else in the UI (.tm-faction.crown / .haven)
    const core = isCrown(p) ? "#e58a5c" : "#4caf50";
    c.fillStyle = "#3a2c1a"; c.beginPath(); c.arc(p.x*sx, p.y*sy, 4, 0, Math.PI*2); c.fill();
    c.fillStyle = core;      c.beginPath(); c.arc(p.x*sx, p.y*sy, 2.4, 0, Math.PI*2); c.fill();
  }
  c.strokeStyle = "#7a4712"; c.lineWidth = 2; c.strokeRect(1,1,W-2,H-2);
}
function rebuildWorldCaches(){
  if(!G || !G.reefs) return;
  for(const rf of G.reefs) buildReefPoly(rf);
  buildMiniStatic();
}

function drawOcean(vw, vh){
  // v1.4 — a calm, camera-stable ocean. Every pattern is anchored to WORLD
  // coordinates (never to camera/ship motion) and only breathes gently in place,
  // so sailing in any direction feels like moving across a still sea, not the
  // sea sliding under you.
  const t = performance.now() / 1000;

  const g = ctx.createLinearGradient(0, cam.y, 0, cam.y + vh);
  g.addColorStop(0, "#0e2c3a");
  g.addColorStop(1, "#0a2430");
  ctx.fillStyle = g;
  ctx.fillRect(cam.x - 40, cam.y - 40, vw + 80, vh + 80);

  const cell = 130;
  const x0 = Math.floor((cam.x - cell) / cell) * cell;
  const y0 = Math.floor((cam.y - cell) / cell) * cell;
  const x1 = cam.x + vw + cell, y1 = cam.y + vh + cell;

  // soft swell lines — fixed to the water, only their width/height eases in place
  ctx.save();
  ctx.strokeStyle = "rgba(120,190,205,0.09)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  for(let x = x0; x < x1; x += cell){
    for(let y = y0; y < y1; y += cell){
      const ph = Math.sin(t * 0.6 + (x + y) * 0.006);
      const w  = 30 + ph * 7;
      const yy = y + Math.sin(t * 0.45 + x * 0.008) * 3;
      ctx.moveTo(x - w, yy);
      ctx.quadraticCurveTo(x, yy - 6, x + w, yy);
    }
  }
  ctx.stroke();
  ctx.restore();

  // sparse glints that twinkle where they sit — no drift
  ctx.save();
  ctx.fillStyle = "rgba(200,235,242,1)";
  for(let x = x0; x < x1; x += cell){
    for(let y = y0; y < y1; y += cell){
      const seed = x * 0.013 + y * 0.007;
      const tw = Math.sin(t * 1.0 + seed * 7);
      if(tw > 0.86){
        ctx.globalAlpha = (tw - 0.86) / 0.14 * 0.45;
        ctx.fillRect(x + Math.sin(seed * 13) * 46, y + Math.cos(seed * 17) * 46, 2, 2);
      }
    }
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // world edge
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 8;
  ctx.strokeRect(0, 0, WORLD.w, WORLD.h);
}

function drawReef(rf){
  if(!rf._poly) buildReefPoly(rf);
  ctx.save();
  ctx.translate(rf.x, rf.y);
  const P = rf._poly;
  // white foam ring — stronger contrast against the water
  ctx.globalAlpha = 0.55 + 0.18*Math.sin(performance.now()/600 + rf.x);
  ctx.fillStyle = "rgba(230,248,250,0.32)";
  ctx.beginPath(); ctx.arc(0,0, rf.r + 13, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  // dark drop shadow gives the rock a hard silhouette
  ctx.fillStyle = "rgba(6,14,18,0.85)";
  ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]+4);
  for(let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]+4);
  ctx.closePath(); ctx.fill();
  // rock body — pale blue-grey, clearly reads against the teal sea
  ctx.fillStyle = "#5c6672";
  ctx.strokeStyle = "#232a31";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(P[0][0], P[0][1]);
  for(let i = 1; i < P.length; i++) ctx.lineTo(P[i][0], P[i][1]);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // lit faces
  ctx.fillStyle = "#7c8794";
  ctx.beginPath(); ctx.arc(-rf.r*0.22, -rf.r*0.2, rf.r*0.34, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = "#9aa4ae";
  ctx.beginPath(); ctx.arc(-rf.r*0.3, -rf.r*0.3, rf.r*0.15, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

/* v1.6 — per-island palette + landmark so every port is recognisable at a glance */
const ISLAND_STYLE = {
  "Pirate Haven":       { sand:"#b9a066", grass:"#4a5a2c", grass2:"#586b34", roof:"#3a2a1c", wall:"#6b4a34", flag:"#0e0e0e" },
  "Crown Fortress":     { sand:"#c2b48c", grass:"#5c6b3a", grass2:"#6b7a45", roof:"#7d8894", wall:"#9aa2ab", flag:"#b5202b" },
  "Plantation Colony":  { sand:"#d8c48a", grass:"#5a8a3a", grass2:"#6fa048", roof:"#8a4a2c", wall:"#c8a878", flag:"#b5202b" },
  "Pirate Republic":    { sand:"#bfa96e", grass:"#556b34", grass2:"#657a3f", roof:"#4a3524", wall:"#7a5a3c", flag:"#0e0e0e" },
  "Treasure Port":      { sand:"#ccbe96", grass:"#4f6b3a", grass2:"#5f7a44", roof:"#6a6f7a", wall:"#b8b0a0", flag:"#b5202b" },
  "Lagoon Trading Post": { sand:"#c8b884", grass:"#3f7a52", grass2:"#4f9060", roof:"#8a3a4a", wall:"#a86b7a", flag:"#e0b23a" },
  "Fishing Village":    { sand:"#c4b284", grass:"#4a6b4a", grass2:"#5a7d55", roof:"#3a5a6a", wall:"#7a8a8a", flag:"#0e0e0e" },
  "Mining Colony":      { sand:"#b8a880", grass:"#5a5540", grass2:"#6a6350", roof:"#4a4038", wall:"#6a5f52", flag:"#b5202b" },
};

function drawPortArt(g, p){
  const st = ISLAND_STYLE[p.type] || ISLAND_STYLE["Pirate Haven"];

  // shallows
  const sg = g.createRadialGradient(0,0,p.r*0.6, 0,0,p.r+70);
  sg.addColorStop(0, "rgba(90,190,200,0.35)");
  sg.addColorStop(1, "rgba(90,190,200,0)");
  g.fillStyle = sg;
  g.beginPath(); g.arc(0,0, p.r+70, 0, Math.PI*2); g.fill();

  // beach + grass
  g.fillStyle = st.sand;
  g.beginPath(); g.arc(0,0, p.r, 0, Math.PI*2); g.fill();
  g.fillStyle = st.grass;
  g.beginPath(); g.arc(0,0, p.r*0.74, 0, Math.PI*2); g.fill();
  g.fillStyle = st.grass2;
  g.beginPath(); g.arc(-p.r*0.15, -p.r*0.12, p.r*0.5, 0, Math.PI*2); g.fill();

  // ---- environmental detail: docked boats + a buoy in the shallows ----
  g.save();
  for(let i = 0; i < 3; i++){
    const a = p.r*0.55 + i*0.9, dist = p.r + 30 + (i%2)*14;
    const bx = Math.cos(a)*dist, by = Math.sin(a)*dist;
    g.save(); g.translate(bx, by); g.rotate(a + Math.PI/2);
    g.fillStyle = i === 0 && (p.type.includes("Pirate")) ? "#241a12" : "#6b4a2a";
    g.beginPath(); g.moveTo(8,0); g.quadraticCurveTo(0,4,-8,3); g.lineTo(-8,-3); g.quadraticCurveTo(0,-4,8,0); g.fill();
    g.strokeStyle = "#d8cdb8"; g.lineWidth = 1; g.beginPath(); g.moveTo(0,-3); g.lineTo(0,-9); g.stroke();
    g.restore();
  }
  // buoy
  g.fillStyle = "#c0332b";
  g.beginPath(); g.arc(Math.cos(-0.6)*(p.r+52), Math.sin(-0.6)*(p.r+52), 3.5, 0, Math.PI*2); g.fill();
  g.restore();

  // dock
  g.fillStyle = "#6b4a2a";
  g.fillRect(-6, p.r*0.55, 12, p.r*0.7);
  for(let i=0;i<3;i++) g.fillRect(-16, p.r*0.6 + i*p.r*0.22, 32, 5);

  // ---- type-specific buildings + landmark ----
  const R = p.r;
  g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 1;
  const house = (x,y,w,h,wall,roof)=>{
    g.fillStyle = wall || st.wall; g.fillRect(x, y, w, h);
    g.fillStyle = roof || st.roof;
    g.beginPath(); g.moveTo(x-2, y); g.lineTo(x+w/2, y-h*0.6); g.lineTo(x+w+2, y); g.closePath(); g.fill();
  };
  house(-R*0.5, -R*0.08, R*0.26, R*0.26);
  house( R*0.16, -R*0.02, R*0.28, R*0.22);
  house(-R*0.12,  R*0.12, R*0.22, R*0.18);

  g.save();
  switch(p.landmark){
    case "lighthouse":
      g.fillStyle = "#e7e2d4"; g.fillRect(R*0.34, -R*0.5, R*0.12, R*0.5);
      g.fillStyle = "#b5202b"; g.fillRect(R*0.34, -R*0.34, R*0.12, R*0.08);
      g.fillStyle = "#ffd873"; g.beginPath(); g.arc(R*0.4, -R*0.52, R*0.07, 0, Math.PI*2); g.fill();
      break;
    case "fort":
      g.fillStyle = st.wall;
      g.fillRect(-R*0.34, -R*0.42, R*0.68, R*0.32);
      g.fillStyle = st.roof;
      for(let i=0;i<5;i++) g.fillRect(-R*0.34 + i*R*0.15, -R*0.5, R*0.09, R*0.1);
      g.fillStyle = "#40484f";
      for(let i=0;i<3;i++){ g.beginPath(); g.arc(-R*0.2 + i*R*0.2, -R*0.16, R*0.03, 0, Math.PI*2); g.fill(); }
      break;
    case "windmill":
      g.fillStyle = "#d8cdb0"; g.fillRect(-R*0.06, -R*0.5, R*0.12, R*0.4);
      g.strokeStyle = "#5a3f28"; g.lineWidth = 3;
      for(let i=0;i<4;i++){ const a=i*Math.PI/2 + performance.now()/1600;
        g.beginPath(); g.moveTo(0,-R*0.46); g.lineTo(Math.cos(a)*R*0.3, -R*0.46 + Math.sin(a)*R*0.3); g.stroke(); }
      break;
    case "stalls":
      for(let i=0;i<4;i++){
        g.fillStyle = ["#b5202b","#e0b23a","#3f7a52","#4a6b9c"][i];
        g.fillRect(-R*0.4 + i*R*0.22, -R*0.06, R*0.16, R*0.05);
      }
      break;
    case "cathedral":
      g.fillStyle = "#c9c3b4"; g.fillRect(-R*0.1, -R*0.5, R*0.2, R*0.42);
      g.beginPath(); g.moveTo(-R*0.12,-R*0.5); g.lineTo(0,-R*0.66); g.lineTo(R*0.12,-R*0.5); g.closePath(); g.fill();
      g.strokeStyle = "#7a6a3a"; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0,-R*0.66); g.lineTo(0,-R*0.74); g.moveTo(-R*0.04,-R*0.7); g.lineTo(R*0.04,-R*0.7); g.stroke();
      break;
    case "pagoda":
      g.fillStyle = "#8a3a4a";
      for(let i=0;i<3;i++){ const w = R*0.3 - i*R*0.08;
        g.beginPath(); g.moveTo(-w, -R*0.14 - i*R*0.13); g.lineTo(0, -R*0.24 - i*R*0.13); g.lineTo(w, -R*0.14 - i*R*0.13); g.closePath(); g.fill(); }
      break;
    case "fishracks":
      g.strokeStyle = "#4a3524"; g.lineWidth = 2;
      for(let i=0;i<3;i++){ const y = -R*0.3 + i*R*0.14;
        g.beginPath(); g.moveTo(-R*0.4, y); g.lineTo(R*0.4, y); g.stroke();
        for(let k=0;k<6;k++){ g.fillStyle="#cbb98a"; g.fillRect(-R*0.36 + k*R*0.13, y-2, R*0.05, 4); } }
      break;
    case "headframe":
      g.strokeStyle = "#3a3228"; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-R*0.2, -R*0.05); g.lineTo(-R*0.06, -R*0.5);
      g.lineTo(R*0.06, -R*0.5); g.lineTo(R*0.2, -R*0.05); g.stroke();
      g.beginPath(); g.moveTo(-R*0.06,-R*0.5); g.lineTo(R*0.18,-R*0.34); g.stroke();
      g.fillStyle = "#5a4a3a";
      for(const [cx,cy] of [[R*0.3,R*0.2],[-R*0.34,R*0.24],[R*0.36,-R*0.02]]){
        g.beginPath(); g.arc(cx,cy,R*0.07,0,Math.PI*2); g.fill();
      }
      break;
  }
  g.restore();

  // palms only for warm islands
  if(["Pirate Haven","Plantation Colony","Lagoon Trading Post","Pirate Republic"].includes(p.type)){
    for(const [px,py] of [[R*0.35,R*0.4],[-R*0.42,R*0.32]]){
      g.strokeStyle = "#6b4a2a"; g.lineWidth = 4;
      g.beginPath(); g.moveTo(px,py); g.quadraticCurveTo(px+6,py-14,px+3,py-26); g.stroke();
      g.strokeStyle = "#2f6b32"; g.lineWidth = 5;
      for(let k=0;k<5;k++){ const a = k/5*Math.PI*2;
        g.beginPath(); g.moveTo(px+3,py-26);
        g.quadraticCurveTo(px+3+Math.cos(a)*10, py-26+Math.sin(a)*10-4, px+3+Math.cos(a)*18, py-26+Math.sin(a)*18);
        g.stroke(); }
    }
  }

  // flag — colour by faction/type
  g.strokeStyle = "#222"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0,-R*0.2); g.lineTo(0,-R*0.58); g.stroke();
  g.fillStyle = st.flag;
  g.beginPath(); g.moveTo(0,-R*0.58); g.lineTo(R*0.24,-R*0.5); g.lineTo(0,-R*0.42); g.closePath(); g.fill();

  // name label
  g.font = "bold 17px Georgia, serif";
  g.textAlign = "center";
  g.lineWidth = 4; g.strokeStyle = "rgba(0,0,0,0.7)";
  g.strokeText(p.name, 0, -R - 16);
  g.fillStyle = "#ffd873";
  g.fillText(p.name, 0, -R - 16);
  g.font = "italic 11px Georgia, serif";
  g.lineWidth = 3; g.strokeStyle = "rgba(0,0,0,0.6)";
  g.strokeText(p.type, 0, -R - 3);
  g.fillStyle = st.flag === "#b5202b" ? "#f0b6a0" : "#cfe3c8";
  g.fillText(p.type, 0, -R - 3);
}

/* pre-render a port to an offscreen 2× sprite (its art never changes) */
function buildPortSprite(p){
  const S  = 2 * (p.r + 96);
  const cv = document.createElement("canvas");
  cv.width = cv.height = Math.ceil(S * 2);
  const g = cv.getContext("2d");
  g.scale(2, 2);
  g.translate(S/2, S/2);
  drawPortArt(g, p);
  p._spr = { cv, S };
}
function buildPortSprites(){ for(const p of PORTS) buildPortSprite(p); }

function drawShip(){
  const s = G.ship;
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(s.a);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath(); ctx.ellipse(2,3, 20, 11, 0, 0, Math.PI*2); ctx.fill();

  // hull (v1.7 — paintable)
  ctx.fillStyle = HULL_PAINT[(G.cosmetic && G.cosmetic.hull) || "oak"] || "#5a3a22";
  ctx.strokeStyle = "#341f10";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.quadraticCurveTo(6, 11, -14, 9);
  ctx.lineTo(-16, -9);
  ctx.quadraticCurveTo(6, -11, 20, 0);
  ctx.closePath(); ctx.fill(); ctx.stroke();

  // deck
  ctx.fillStyle = "#7a5233";
  ctx.beginPath();
  ctx.moveTo(14, 0);
  ctx.quadraticCurveTo(4, 7, -11, 6);
  ctx.lineTo(-12, -6);
  ctx.quadraticCurveTo(4, -7, 14, 0);
  ctx.closePath(); ctx.fill();

  // mast + sail (billows with speed; v1.7 — paintable)
  const bill = clamp(s.spd/220, 0.1, 1);
  ctx.fillStyle = SAIL_PAINT[(G.cosmetic && G.cosmetic.sail) || "cream"] || "#efe6cf";
  ctx.strokeStyle = "#b7ac8d";
  ctx.beginPath();
  ctx.moveTo(-2, -8);
  ctx.quadraticCurveTo(10 + bill*8, 0, -2, 8);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  // sail stripe
  ctx.strokeStyle = "#a5372f"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(1,-4); ctx.lineTo(3+bill*4,0); ctx.lineTo(1,4); ctx.stroke();

  ctx.fillStyle = "#2a1c10";
  ctx.beginPath(); ctx.arc(-2, 0, 2, 0, Math.PI*2); ctx.fill();

  // little jolly roger at the stern
  ctx.strokeStyle = "#111"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-15,-8); ctx.lineTo(-15,-15); ctx.stroke();
  ctx.fillStyle = "#0e0e0e";
  ctx.beginPath(); ctx.moveTo(-15,-15); ctx.lineTo(-8,-13); ctx.lineTo(-15,-11); ctx.closePath(); ctx.fill();

  ctx.restore();

  // low-hull warning ring
  if(G.hp <= 25){
    ctx.save();
    ctx.strokeStyle = "rgba(207,90,78," + (0.4+0.3*Math.sin(performance.now()/150)) + ")";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }
}

function drawNavy(){
  if(!G.navy) return;
  for(const n of G.navy){
    ctx.save();
    ctx.translate(n.x, n.y);
    ctx.rotate(n.a);
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath(); ctx.ellipse(2,3, 19, 10, 0, 0, Math.PI*2); ctx.fill();
    // navy blue-grey hull
    ctx.fillStyle = "#33465e"; ctx.strokeStyle = "#18222f"; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(19,0); ctx.quadraticCurveTo(6,10,-13,8); ctx.lineTo(-15,-8);
    ctx.quadraticCurveTo(6,-10,19,0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#46617f";
    ctx.beginPath();
    ctx.moveTo(13,0); ctx.quadraticCurveTo(4,6,-10,5); ctx.lineTo(-11,-5);
    ctx.quadraticCurveTo(4,-6,13,0); ctx.closePath(); ctx.fill();
    // crisp white sail with a red ensign cross
    ctx.fillStyle = "#eef2f6"; ctx.strokeStyle = "#c3ccd4";
    ctx.beginPath(); ctx.moveTo(-1,-8); ctx.quadraticCurveTo(11,0,-1,8); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = "#b5202b"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(3,-4); ctx.lineTo(3,4); ctx.moveTo(0,0); ctx.lineTo(7,0); ctx.stroke();
    ctx.restore();
    // pulsing pursuit ring only while actively hunting
    if(n.state === "hunt"){
      ctx.save();
      ctx.strokeStyle = "rgba(181,32,43," + (0.30 + 0.32*Math.sin(performance.now()/150)) + ")";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(n.x, n.y, 24, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
    // state marker above the hull
    if(n.state === "hunt" || n.state === "search"){
      ctx.save();
      ctx.font = "bold 15px Georgia, serif";
      ctx.textAlign = "center";
      ctx.fillStyle = n.state === "hunt" ? "#ff5a4a" : "rgba(230,220,200,.7)";
      ctx.fillText(n.state === "hunt" ? "!" : "?", n.x, n.y - 26);
      ctx.restore();
    }
  }
}

/* v3.3 — every port with an active contract bound for it, so the map and
   minimap can point at "where do I need to go" without opening Contracts.
   Ports map to the single soonest-expiring job if more than one is headed there. */
function jobDestinations(){
  const byPort = {};
  if(Array.isArray(G.jobs)) for(const j of G.jobs){
    const left = j.dayLimit - (G.day - j.acceptedDay);
    if(!byPort[j.to] || left < byPort[j.to].left) byPort[j.to] = { left };
  }
  return byPort;
}
function drawJobFlag(c, x, y, size, left){
  // a small pennant above the port dot; amber normally, red once time is short
  const urgent = left <= 2;
  c.save();
  c.translate(x, y);
  c.strokeStyle = urgent ? "#e5645a" : "#ffce85"; c.lineWidth = Math.max(1, size*0.18);
  c.beginPath(); c.moveTo(0,0); c.lineTo(0,-size*2.2); c.stroke();
  c.fillStyle = urgent ? "#e5645a" : "#ffce85";
  c.beginPath();
  c.moveTo(0,-size*2.2); c.lineTo(size*1.6,-size*1.7); c.lineTo(0,-size*1.2);
  c.closePath(); c.fill();
  c.restore();
}
function drawMinimap(){
  const W = mini.width, H = mini.height;
  const sx = W / WORLD.w, sy = H / WORLD.h;
  // parchment chart + reef/port dots + frame are pre-rendered once (they never move)
  if(!miniStatic) buildMiniStatic();
  mctx.drawImage(miniStatic, 0, 0);
  // contract destinations — a small flag above the port, red once due soon
  const dests = jobDestinations();
  for(const pid in dests){
    const p = portById(pid); if(!p) continue;
    drawJobFlag(mctx, p.x*sx, p.y*sy - 3, 2.6, dests[pid].left);
  }
  // navy patrols — blue marks; red ring only when hunting you
  if(G.navy) for(const n of G.navy){
    mctx.fillStyle = "#5a86c0";
    mctx.beginPath(); mctx.arc(n.x*sx, n.y*sy, 2.6, 0, Math.PI*2); mctx.fill();
    if(n.state === "hunt"){
      mctx.strokeStyle = "#b5202b"; mctx.lineWidth = 1;
      mctx.beginPath(); mctx.arc(n.x*sx, n.y*sy, 4, 0, Math.PI*2); mctx.stroke();
    }
  }
  // ship — a red "you are here" marker
  const s = G.ship;
  mctx.save();
  mctx.translate(s.x*sx, s.y*sy);
  mctx.rotate(s.a);
  mctx.fillStyle = "#d24e40";
  mctx.beginPath(); mctx.moveTo(6,0); mctx.lineTo(-4,-4); mctx.lineTo(-4,4); mctx.closePath(); mctx.fill();
  mctx.restore();
}

/* ---------- Mini-map port tooltips ---------- */
function onMiniHover(e){
  const rect = mini.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (mini.width  / rect.width);
  const my = (e.clientY - rect.top)  * (mini.height / rect.height);
  const sx = mini.width / WORLD.w, sy = mini.height / WORLD.h;

  let hit = null, hd = 9;
  for(const p of PORTS){
    const d = Math.hypot(p.x*sx - mx, p.y*sy - my);
    if(d < hd){ hd = d; hit = p; }
  }
  if(!hit){ miniTipEl.classList.remove("show"); _miniTipPort = null; return; }

  // only rebuild the tooltip HTML when the hovered port actually changes
  if(_miniTipPort !== hit.id){
    _miniTipPort = hit.id;
    const rows = GOODS.map(g=>{
      const price = priceAt(hit.id, g.id);
      return { name: goodName(g.id), price, r: price / normalPrice(hit.id, g.id) };
    });
    const buys  = rows.slice().sort((a,b)=>a.r - b.r).slice(0,3);
    const sells = rows.slice().sort((a,b)=>b.r - a.r).slice(0,3);
    miniTipEl.innerHTML =
      `<div class="mt-name">${hit.name}</div>` +
      `<div class="mt-sec"><span class="deal-low">▼ Best to buy</span><br>` +
        buys.map(x=>`${x.name} <b>${fmt(x.price)}</b>`).join(" · ") + `</div>` +
      `<div class="mt-sec"><span class="deal-high">▲ Best to sell</span><br>` +
        sells.map(x=>`${x.name} <b>${fmt(x.price)}</b>`).join(" · ") + `</div>`;
  }

  miniTipEl.style.left = clamp(e.clientX - 260, 8, window.innerWidth  - 270) + "px";
  miniTipEl.style.top  = clamp(e.clientY + 16, 8, window.innerHeight - 130) + "px";
  miniTipEl.classList.add("show");
}
let _miniTipPort = null;

/* ---------- Full chart / map (toggle with M) ---------- */
function openMap(){
  if(anyOverlay()) return;          // never stack over another menu
  overlayOpen("mapModal");          // .show first so the canvas has real dimensions
  setMapTab("map");
}
function closeMap(){ overlayClose("mapModal"); }
function toggleMap(){
  if(overlayShown("mapModal")) closeMap();
  else openMap();
}

/* ---------- Pause menu (toggle with ESC) ---------- */
let pauseSaveTimer = null;
function openPauseMenu(){
  if(anyOverlay()) return;
  overlayOpen("pauseModal");
  document.getElementById("pauseBadge").classList.add("show");
}
function closePauseMenu(){
  document.getElementById("pauseBadge").classList.remove("show");
  document.getElementById("pauseSaveMsg").classList.remove("show");
  overlayClose("pauseModal");
}
function quickSave(){
  saveLocal();
  const m = document.getElementById("pauseSaveMsg");
  m.classList.remove("show");
  void m.offsetWidth;          // restart the flash animation
  m.classList.add("show");
  clearTimeout(pauseSaveTimer);
  pauseSaveTimer = setTimeout(()=>m.classList.remove("show"), 1800);
  toast("✓ Voyage saved", {kind:"save"});
}

function dealRank(portId, goodId, price){
  const r = price / normalPrice(portId, goodId);
  return r <= 0.90 ? 0 : (r >= 1.10 ? 2 : 1);
}

/* ---------- change log ---------- */
function renderChangelog(){
  document.getElementById("logBody").innerHTML = CHANGELOG.map(e => `
    <div class="log-entry">
      <h3>${e.version} — ${e.title}</h3>
      <span class="log-ts">${fmtLogTime(e.ts)}</span>
      ${e.sections.map(s => `
        <div class="log-sec">
          <h4>${s.h}</h4>
          <ul>${s.points.map(p => `<li>${p}</li>`).join("")}</ul>
        </div>`).join("")}
    </div>`).join("");
  document.getElementById("logVer").textContent = "Current build: " + (CHANGELOG[0] ? CHANGELOG[0].version : "—");
}

/* =====================================================================
   v2.1 — Hide HUD toggle
   ===================================================================== */
function setHUDHidden(hidden){
  document.body.classList.toggle("ui-hidden", hidden);
  const b = document.getElementById("uiToggle");
  if(b){
    b.textContent = hidden ? "👁 Show HUD" : "🙈 Hide HUD";
    b.classList.toggle("hidden-state", hidden);
  }
  try{ localStorage.setItem("ss_hud_hidden", hidden ? "1" : "0"); }catch(_){}
}
function toggleHUD(){ setHUDHidden(!document.body.classList.contains("ui-hidden")); }

/* =====================================================================
   v2.1 — Captain's Manual: a tabbed in-game reference.
   Content is written from the live mechanics — nothing here is aspirational.
   ===================================================================== */
const K = s => `<span class="keycap">${s}</span>`;
const HELP = {
  start: `
    <div class="help-lede">You are a trading captain in an open sea of 8 port islands. Buy goods cheap in one
      port, carry them to a port where they sell dear, and turn the profit into a stronger ship — over and
      over — until you have built a <b>Fortune of 1,000,000 Sovereigns</b>.</div>
    <div class="help-sec"><h4>The objective</h4>
      <ul>
        <li>Grow your <b>Net Worth</b> to <b>1,000,000 Sovereigns</b>. The dashboard shows a live Fortune bar.</li>
        <li>Milestones along the way: <b>10k</b> established trader → <b>25k</b> seasoned → then the four
          Grand Fittings at <b>45k / 150k / 250k / 500k</b> → <b>1,000,000</b>.</li>
        <li>There is no time limit and no lose condition for being poor — take it at your own pace.</li>
      </ul></div>
    <div class="help-sec"><h4>Your first few minutes</h4>
      <ul>
        <li>You begin near <b>Tortuga</b> with <b>800 gold</b> and an empty hold.</li>
        <li>Steer with ${K('W')}${K('A')}${K('S')}${K('D')} or the ${K('Arrows')}. Sail into a port and ease
          off the throttle at the harbour — the trading window opens automatically.</li>
        <li>On the <b>Market</b> tab, buy a good marked <b>🟢 GREAT BUY</b>. Press ${K('M')} and check the
          <b>Market</b> tab to see which port pays the most for it.</li>
        <li>Sail there, dock, sell on its Market tab. Repeat with the profit.</li>
      </ul></div>
    <div class="help-sec"><h4>Staying afloat</h4>
      <ul>
        <li><b>Reefs</b> (pale rocks) gash your hull. Lose all your hull and you are wrecked, towed to the
          nearest port and lose gold and cargo — repair at any port before it gets that far.</li>
        <li>The game auto-saves to this browser after every port visit.</li>
      </ul></div>`,

  trade: `
    <div class="help-sec"><h4>Buying &amp; selling</h4>
      <ul>
        <li>Trade on the <b>Market</b> tab of any port. The quantity toggle (${K('×1')} ${K('×5')} ${K('×10')} ${K('Max')})
          sets how much each Buy/Sell button moves; Max is limited by your gold, hold space and cargo held.</li>
        <li>Every good shows its <b>current price</b>, this port's <b>normal price</b>, the % gap, a plain
          verdict — <b>🟢 GREAT BUY / 🟡 FAIR / 🔴 GREAT SELL</b> — and an arrow for how it moved since
          yesterday.</li>
        <li>Verdicts compare the price to <i>this port's own normal price</i>, never to other ports.</li>
      </ul></div>
    <div class="help-sec"><h4>How prices move</h4>
      <ul>
        <li>Prices are <b>frozen while you sail</b>. They only change when you <b>Rest &amp; Advance Time</b> —
          the 🛏 button on the Market tab, or the Rest service.</li>
        <li>Buying a lot of one good <b>raises</b> its price at that port; selling a lot <b>lowers</b> it. The
          effect is immediate and shown in a toast. It partly recovers each time you Rest.</li>
        <li>Each island has a <b>specialty</b> (shown at the top of its port screen) — it produces those goods
          cheaply and pays poorly for them.</li>
      </ul></div>
    <div class="help-sec"><h4>Contraband (high risk)</h4>
      <ul>
        <li><b>Royal Jewels, Black Powder, Cursed Relics</b> buy cheap in <b>pirate havens</b> and fence for
          roughly <b>3–5×</b> at <b>Crown ports</b>.</li>
        <li>Dock at a Crown port carrying it and the Navy may inspect you at the harbour mouth. Selling it
          there can raise your Wanted level.</li>
      </ul></div>
    <div class="help-sec"><h4>Contracts (steady, legal income)</h4>
      <ul>
        <li>The <b>Contracts</b> tab offers cargo deliveries, passenger runs, supply orders and courier jobs,
          each with a destination port, a day deadline and a fixed payout.</li>
        <li>Contract cargo fills your hold and shows in the Hold tab. Deliver at the destination to be paid;
          a lapsed deadline just cancels the job.</li>
        <li>Hold up to <b>4</b> contracts (<b>6</b> with the Galleon Conversion). A fresh board appears each
          time you Rest.</li>
      </ul></div>
    <div class="help-sec"><h4>Planning routes</h4>
      <ul>
        <li>Press ${K('M')} → <b>Market</b> tab for a table of the best buy port, best sell port and
          profit-per-unit for every good, right now.</li>
        <li>Hover a port on the minimap for its current best buys and sells.</li>
      </ul></div>`,

  ships: `
    <div class="help-sec"><h4>Handling</h4>
      <ul>
        <li>The ship carries <b>momentum</b> — it keeps gliding and <b>drifts</b> through turns. Ease the
          throttle and turn early; you can drift around rocks on purpose.</li>
        <li>Forward accelerates, back brakes / reverses, left/right turn (sharper at speed).</li>
      </ul></div>
    <div class="help-sec"><h4>Hull &amp; repair</h4>
      <ul>
        <li>Reef strikes and lost fights damage the hull. <b>Repair Hull</b> (Port Services) patches it for
          7 gold per point.</li>
        <li>At 0 hull you are wrecked: towed to the nearest port, losing ~half your gold and cargo (far less
          with Insurance).</li>
      </ul></div>
    <div class="help-sec"><h4>Port Services &amp; upgrades</h4>
      <ul>
        <li><b>Expand Cargo Hold</b> — +10 crates per step, buy ${K('×1')} ${K('×5')} ${K('Max')}.</li>
        <li><b>Shipwright</b> — permanent Rigging &amp; Sails (speed), Trim &amp; Ballast (acceleration),
          Rudder &amp; Helm (turning) and Oak Planking (+15 hull), up to <b>Level 8</b>. Drift is untouched.</li>
        <li><b>Sign On Crew</b> (one-time): Navigator (−45% reef damage), Lookout (+2s boarding window),
          Master Gunner (doubles your weight in a fight), Quartermaster (your trades move prices half as much).</li>
        <li><b>Gunfoundry</b> — up to <b>6 cannons</b>, improving your odds when you Fight a patrol.</li>
        <li><b>Hull Insurance</b> — a wreck then costs 20% gold and keeps 75% cargo (pays out once).</li>
        <li><b>False Cargo Hold</b> — up to 3, each improves the share of contraband that stays hidden in an
          inspection.</li>
        <li><b>Shipyard</b> — repaint hull and sails (cosmetic only).</li>
      </ul></div>
    <div class="help-sec"><h4>Grand Fittings (milestones)</h4>
      <ul>
        <li><b>Ironbound Hull</b> (45k) — +50 max hull, −25% to all damage.</li>
        <li><b>Master's Charter</b> (150k) — +40% on every contract payout and battle prize.</li>
        <li><b>Bluewater Clipper Rig</b> (250k) — +22% top speed, +16% acceleration.</li>
        <li><b>Galleon Conversion</b> (500k) — +60 cargo, +25 hull, room for 6 contracts.</li>
      </ul></div>`,

  nav: `
    <div class="help-sec"><h4>Getting around</h4>
      <ul>
        <li>Islands are solid — you cannot sail through them. Reefs are the pale rocks; give them room.</li>
        <li>The world has <b>8 ports</b>, each with a faction (Crown or pirate haven), a type and a specialty
          shown when you dock.</li>
      </ul></div>
    <div class="help-sec"><h4>The minimap (top-right)</h4>
      <ul>
        <li>Red arrow = your ship · <span style="color:#e58a5c;font-weight:bold;">orange dots</span> = Crown
          ports · <span style="color:#4caf50;font-weight:bold;">green dots</span> = pirate havens ·
          pale dots = reefs · blue dots = Navy cutters (red ring when one is actively hunting you).</li>
        <li>A small <span style="color:#ffce85;font-weight:bold;">⚑ flag</span> over a port means a contract
          in your hold is bound there — it turns <span style="color:#e5645a;font-weight:bold;">red</span>
          once the deadline is close.</li>
        <li><b>Hover a port</b> on the minimap for its best buys and sells right now.</li>
        <li>The minimap stays on screen even when the HUD is hidden.</li>
      </ul></div>
    <div class="help-sec"><h4>The full charts — ${K('M')}</h4>
      <ul>
        <li><b>Map</b> — a large navigation chart of the whole sea: ports, reefs, your ship, any Navy, and
          a flag over any port a contract needs delivered to. A thin gold ring marks a port where you own
          a business.</li>
        <li><b>Market</b> — best buy / best sell / profit-per-unit for every commodity across all ports.</li>
        <li><b>Ports</b> — a card per island: its type, specialty and current prices with buy/sell verdicts.</li>
        <li>Press ${K('M')} again, or Close, to weigh anchor. The charts pause the game while open.</li>
      </ul></div>`,

  navy: `
    <div class="help-sec"><h4>Getting wanted</h4>
      <ul>
        <li>Smuggling contraband through Crown ports, being caught in an inspection, and fleeing all raise
          your <b>Wanted level (1–5 ★)</b>. Each star is one <b>Navy cutter</b> at sea.</li>
        <li>The dashboard and a badge show your Wanted level; the badge reads <b>NAVY IN PURSUIT</b> when a
          cutter has your scent and <b>LIE LOW</b> when they have lost it.</li>
      </ul></div>
    <div class="help-sec"><h4>The chase</h4>
      <ul>
        <li>Cutters only chase while you are in their <b>sight</b> (about 1000). Open water and a head start
          shake them — losing a cutter drops a star.</li>
        <li>They <b>read the water</b>: cut tight past a reef with a cutter right behind you and it must take
          a wider, slower line — you open real distance. Dense reef clusters slow them most. Reefs are your
          best escape tool at high Wanted; in open water the chase is theirs.</li>
        <li>Carrying contraband makes them hunt far longer before giving up. A clean hold and 1★ is left
          alone at the docks entirely.</li>
        <li><b>Rest</b> in a port also cools the Navy's interest — but not while you are holding contraband.</li>
      </ul></div>
    <div class="help-sec"><h4>Boarding &amp; the inspection</h4>
      <ul>
        <li>A cutter drawing alongside starts a <b>3-second boarding countdown</b> (5s with a Lookout).
          Turn, drift or run out of grapple range in that window to escape it.</li>
        <li>If it boards you, choose: <b>Bribe</b> (gold) · <b>Hide</b> (false holds cover part of your
          contraband; you can still run afterward) · <b>Fight</b> · <b>Flee</b> (+1★, they open fire).</li>
        <li><b>Fight</b> shows your win chance (better with cannons, a Master Gunner and full hull). Win →
          gold, salvage and the cutter sinks (−1★). Lose → you lose cargo and gold, take heavy hull damage
          and limp back to port.</li>
      </ul></div>
    <div class="help-sec"><h4>Clearing your name</h4>
      <ul>
        <li>At any <b>pirate haven</b> while wanted: <b>Pay Off Officials</b> (wipes all stars) or
          <b>Buy False Colours</b> (drops 2 stars).</li>
      </ul></div>`,

  money: `
    <div class="help-sec"><h4>The three numbers</h4>
      <ul>
        <li><b>Gold</b> — what you can spend right now.</li>
        <li><b>Lifetime Earnings</b> — every gold you have <i>earned</i> this voyage. It never falls when you
          spend.</li>
        <li><b>Net Worth</b> — Gold + the value of cargo you hold + the value of your ship and upgrades. This
          is the number that must reach <b>1,000,000</b>.</li>
      </ul></div>
    <div class="help-sec"><h4>Where money goes</h4>
      <ul>
        <li>Cargo hold expansion, Shipwright upgrades, crew, cannons, repairs, insurance, contract-ready
          goods, and the four Grand Fittings.</li>
        <li><b>Master's Charter</b> (150k) raises all contract and prize income by 40% — buying it makes every
          later run pay more, which is the heart of the money → stronger ship → bigger earnings loop.</li>
      </ul></div>
    <div class="help-sec"><h4>Passive income &amp; Empire</h4>
      <ul>
        <li><b>Business Holdings</b> (Services tab, any port) — buy shares in a generic venture; each pays a
          small amount of gold every in-game day. Collect it at any port.</li>
        <li><b>Empire</b> tab — every port has its own business tied to what it produces (a Distillery, Sugar
          Plantation, Iron Mine…), plus three infrastructure businesses: a Shipyard (cheaper ship services),
          a Trading House (a bit more gold when you sell there) and a Warehouse (stockpile cargo off your
          ship). Production businesses fill up with real cargo over time — visit to collect it.</li>
        <li><b>Trade Influence</b> (Empire tab) — the higher your production property's level, the more say you
          have over that commodity: Local Supplier → Major Trader → Dominant Supplier → Monopoly. Each tier
          gives a small buy discount and sell bonus (up to ±10%), and Dominant/Monopoly also steadies that
          good's local price swings. It never overrides the market — just tilts it a little in your favour.</li>
      </ul></div>
    <div class="help-sec"><h4>Two ways to play</h4>
      <ul>
        <li><b>Legal merchant</b> — trade the price gaps, run contracts, avoid the Navy. Steady and safe.</li>
        <li><b>Smuggler</b> — contraband for 3–5× margins, at the cost of Navy heat, inspections and chases.</li>
        <li>You can mix both. Statistics (Settings → Statistics) tracks each side, including your longest
          never-caught streak.</li>
      </ul></div>
    <div class="help-sec"><h4>Captain Level</h4>
      <ul>
        <li>Separate from Maritime Rank (which is built purely from your empire), your <b>Captain Level</b>
          rises from experience earned by anything you actually do — trading, contracts, smuggling, naval
          fights, auctions and property. A legal merchant and a pirate captain both level up.</li>
        <li>Ten levels, Deckhand up to Admiral of the Salt — see it on My Captain (Settings → My Captain)
          and in Statistics → Progression. It's a title and a record of your career, not a gate: nothing in
          the game is locked behind it.</li>
      </ul></div>
    <div class="help-sec"><h4>Leaderboard &amp; friends</h4>
      <ul>
        <li>The Leaderboard (Settings → Leaderboard) ranks captains by <b>Lifetime Earnings</b>. Click any
          name for their profile.</li>
        <li>Friends (Settings → Friends) let you add other captains by code and compare voyages.</li>
      </ul></div>`,

  controls: `
    <div class="help-sec"><h4>Sailing</h4>
      <div class="help-kv"><span class="k">Steer</span><span class="v">${K('W')}${K('A')}${K('S')}${K('D')} or ${K('↑')}${K('↓')}${K('←')}${K('→')}</span></div>
      <div class="help-kv"><span class="k">Throttle</span><span class="v">forward = accelerate · back = brake / reverse</span></div>
      <div class="help-kv"><span class="k">Dock</span><span class="v">${K('E')} when the prompt shows near a port</span></div>
    </div>
    <div class="help-sec"><h4>At the dock</h4>
      <div class="help-kv"><span class="k">Sell everything</span><span class="v">${K('Space')} — sells your whole hold at this port in one press</span></div>
      <div class="help-kv"><span class="k">Set Sail</span><span class="v">${K('Enter')} — leave port and get back underway</span></div>
      <div class="help-kv"><span class="k">Switch tabs</span><span class="v">${K('A')}${K('D')} or ${K('←')}${K('→')} — page through Market · Services · Contracts · Empire · Fleet · Hold</span></div>
    </div>
    <div class="help-sec"><h4>Screens</h4>
      <div class="help-kv"><span class="k">Charts</span><span class="v">${K('M')} — open / close the full Map · Market · Ports</span></div>
      <div class="help-kv"><span class="k">Switch chart tabs</span><span class="v">${K('A')}${K('D')} or ${K('←')}${K('→')} — page through Map · Market · Ports while the charts are open</span></div>
      <div class="help-kv"><span class="k">Pause</span><span class="v">${K('Esc')} — pause menu, or close the current menu</span></div>
      <div class="help-kv"><span class="k">Hide HUD</span><span class="v">${K('H')} or the <b>Hide HUD</b> button (bottom-right)</span></div>
    </div>
    <div class="help-sec"><h4>Menus &amp; mouse</h4>
      <ul>
        <li>Most menus close with ${K('Esc')} or by clicking the dark backdrop. Trading and inspection
          windows have their own buttons instead.</li>
        <li>Hover a port on the minimap for a price tip.</li>
        <li>Top-left buttons: <b>Map</b>, <b>📖 Manual</b>, <b>⚙️ Settings</b>, <b>New Game</b>. Settings holds
          Save, Friend Code, Change Log, Leaderboard, Statistics, My Captain and Voyages.</li>
      </ul></div>
    <div class="help-sec"><h4>Hiding the HUD</h4>
      <ul>
        <li>Hiding the HUD tucks away the top-left title bar and the Ship's Dashboard for a clean view.</li>
        <li>The <b>minimap stays visible</b>, and ${K('M')}, warnings, notifications and the dock prompt all
          keep working. Press ${K('H')} or the button again to bring the HUD back. Your choice is remembered.</li>
      </ul></div>`,

  tips: `
    <div class="help-sec"><h4>Trading</h4>
      <ul>
        <li>Plan on the ${K('M')} <b>Market</b> chart first — it names the best buy and sell port for every
          good, so you sail with a purpose instead of guessing.</li>
        <li>Don't dump a full hold in one port. Selling a lot tanks the local price; split big loads across
          ports, or Rest to let the price recover.</li>
        <li>Prices only move when you Rest, so there's no rush between ports — take the safe line around reefs.</li>
      </ul></div>
    <div class="help-sec"><h4>The Navy</h4>
      <ul>
        <li>When a cutter is on you, head for rocks — bait it into a bad line and you'll gain the distance
          you need to break its sight and drop a star.</li>
        <li>Sell contraband fast. While it's aboard, patrols hunt far longer and Rest won't cool them.</li>
        <li>A <b>Lookout</b> gives you 5 seconds instead of 3 to slip a boarding — worth it for a smuggler.</li>
      </ul></div>
    <div class="help-sec"><h4>Money &amp; ship</h4>
      <ul>
        <li>Keep a hull buffer. An uninsured wreck costs half your gold; Insurance (or an Ironbound Hull)
          turns a disaster into a setback.</li>
        <li>A <b>Navigator</b> pays for itself quickly if your routes run near reefs.</li>
        <li>Aim your early savings at <b>Master's Charter</b> — the sooner your income is +40%, the faster
          everything after it comes.</li>
        <li>Use <b>Voyages</b> (Settings) to keep more than one run going.</li>
      </ul></div>`,
};
let helpTab = "start";
function renderHelp(tab){
  helpTab = tab || helpTab;
  document.querySelectorAll("#helpTabs button").forEach(b => b.classList.toggle("on", b.dataset.htab === helpTab));
  const body = document.getElementById("helpBody");
  body.innerHTML = HELP[helpTab] || "";
  body.scrollTop = 0;
}
function openHelp(){
  document.getElementById("helpVer").textContent = "Build " + (CHANGELOG[0] ? CHANGELOG[0].version : "");
  renderHelp(helpTab);
  overlayOpen("helpModal");
}

/* ---------- Captain name · live playtime · leaderboard ---------- */
const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" }[c]));

let pendingAfterCaptain = null;
function ensureCaptain(then){
  if(G && G.captain && G.captain.trim()){ if(then) then(); return; }
  pendingAfterCaptain = then || null;
  const inp = document.getElementById("captainInput");
  inp.value = "";
  overlayOpen("captainModal");
  setTimeout(()=>{ try{ inp.focus(); }catch(_){} }, 60);
}
function confirmCaptain(){
  const raw = document.getElementById("captainInput").value.trim().slice(0, 24);
  G.captain = raw || ("Captain " + (100 + Math.floor(Math.random() * 900)));
  saveLocal();
  overlayDrop("captainModal");        // drop without auto-resume — the callback decides what's next
  toast(`Welcome aboard, ${G.captain}.`);
  const cb = pendingAfterCaptain; pendingAfterCaptain = null;
  if(cb) cb();
  else resumeFromOverlays();
}

/* live playtime — its own 1s interval, so menu / paused time counts, but not idle-away time */
let _playLast = (typeof performance !== "undefined") ? performance.now() : 0;
function tickPlaytime(){
  const now = performance.now();
  const dt = (now - _playLast) / 1000;
  _playLast = now;
  const inGame = !overlayShown("startModal") && !overlayShown("captainModal");
  if(G && inGame && dt > 0 && dt < 5 && document.visibilityState === "visible"){
    G.playSecs = (G.playSecs || 0) + dt;
  }
  updatePlayclock();
  if(overlayShown("lbModal")) renderLeaderboard();
}
let _playStr = "";
function updatePlayclock(){
  if(!G) return;
  const s = fmtPlay(G.playSecs);
  if(s === _playStr) return;              // the string only changes once a second
  _playStr = s;
  const el = document.getElementById("dPlay");
  if(el) el.textContent = s;
}

function leaderboardRows(){
  const rows = RIVAL_CAPTAINS.map(r => ({ ...r, earned: r.earned || r.worth }));
  const rivalNames = new Set(RIVAL_CAPTAINS.map(r => r.name.toLowerCase()));
  for(const r of (G.rivals || [])){
    if(rivalNames.has(r.name.toLowerCase())) continue;
    rows.push({ name: r.name, secs: r.secs, worth: r.worth, earned: (r.earned != null ? r.earned : r.worth), imported: true, snap: r.snap || null });
  }
  rows.push({ name: (G.captain || "You"), secs: G.playSecs || 0, worth: netWorth(), earned: (G.lifetimeEarnings || 0), you: true });
  // v1.5 — primary rank is Lifetime Earnings, tie-break by net worth, then playtime
  rows.sort((a, b) => (b.earned - a.earned) || (b.worth - a.worth) || (b.secs - a.secs));
  return rows;
}
let _lbRows = [];
function renderLeaderboard(){
  _lbRows = leaderboardRows();
  document.getElementById("lbBody").innerHTML = _lbRows.map((r, i) => {
    const tag = r.you ? '<span class="lb-tag you">you</span>'
              : r.rival ? '<span class="lb-tag rival">rival</span>'
              : '<span class="lb-tag friend">friend</span>';
    return `<div class="lb-row${r.you ? " you" : ""}">
      <span class="lb-rank">${i + 1}</span>
      <span class="lb-name" data-lb="${i}">${escHtml(r.name)} ${tag}</span>
      <span class="lb-worth">${fmt(r.earned)}</span>
      <span class="lb-worth">${fmt(r.worth)}</span>
      <span class="lb-time">${fmtPlay(r.secs)}</span>
    </div>`;
  }).join("");
  document.querySelectorAll("#lbBody [data-lb]").forEach(el => {
    el.onclick = () => openProfileFromRow(_lbRows[+el.dataset.lb]);
  });
  document.getElementById("lbYouLine").textContent =
    `${G.captain || "You"} · ${fmt(G.lifetimeEarnings || 0)} lifetime · ${fmt(netWorth())} net worth · ${fmtPlay(G.playSecs)} played`;
}

/* =====================================================================
   v1.5 — Captain profile · Statistics page · Save slots
   ===================================================================== */
function statRow(label, val){ return `<div class="stat-cell"><span>${label}</span><b>${val}</b></div>`; }

/* v3.1 — single canonical "Record" card shared by you, rivals, and imported
   friends. Takes a G.stats-shaped object (run it through normalizeStats first)
   plus the two fields that live outside G.stats (day, distSailed). This is the
   one place that decides what a "record" is, so player and rival/friend cards
   can never quietly drift into different definitions again. */
function recordStatsHTML(st, day, distSailed){
  return `
    ${statRow("Day reached", day)}
    ${statRow("Islands visited", st.islandsVisited + " / " + PORTS.length)}
    ${statRow("Port dockings", st.portDockings)}
    ${statRow("Goods bought / sold", fmt(st.goodsBought) + " / " + fmt(st.goodsSold))}
    ${statRow("Contraband sold", fmt(st.contrabandSold))}
    ${statRow("Legal contracts", st.jobsCompleted)}
    ${statRow("Times caught", st.timesCaught)}
    ${statRow("Times escaped", st.timesEscaped)}
    ${statRow("Longest never-caught streak", st.bestNeverCaughtStreak)}
    ${statRow("Naval won / lost", st.navalWins + " / " + st.navalLosses)}
    ${statRow("Cargo lost", fmt(st.cargoLost))}
    ${statRow("Ships repaired", st.repairs)}
    ${statRow("Distance sailed", fmt(Math.round((distSailed || 0) / 100)) + " lg")}
  `;
}

function openProfileFromRow(r){
  if(!r) return;
  if(r.you){ openMyProfile(); return; }
  if(r.snap && typeof openFriendProfile === "function"){ openFriendProfile(r.name); return; }
  const p = r.profile || {};
  const st = normalizeStats(p);
  const body = `
    <div class="stat-hero">
      <div><i>Lifetime</i><b>${fmt(r.earned)}</b></div>
      <div><i>Net Worth</i><b>${fmt(r.worth)}</b></div>
      <div><i>Playtime</i><b>${fmtPlay(r.secs)}</b></div>
    </div>
    <div class="stat-group"><h4>Record</h4><div class="stat-grid">
      ${recordStatsHTML(st, p.day ?? "—", p.distSailed)}
    </div></div>`;
  document.getElementById("profName").textContent = r.name;
  document.getElementById("profRank").textContent = r.rival ? "Rival Captain" : (r.imported ? "Friend" : "");
  document.getElementById("profNote").textContent = r.rival
    ? "A famous name on the boards. Beat their Lifetime Earnings to climb."
    : "Imported from a friend code — shows the snapshot they shared.";
  document.getElementById("profBody").innerHTML = body;
  overlayOpen("profileModal");
}
function openMyProfile(){
  const s = normalizeStats(G.stats);
  const rows = _lbRows.length ? _lbRows : leaderboardRows();
  const rank = rows.findIndex(x => x.you) + 1;
  const lvl = levelFromXp(G.xp || 0), next = xpToNext(G.xp || 0);
  document.getElementById("profName").textContent = G.captain || "You";
  document.getElementById("profRank").textContent = rank ? `Rank #${rank}` : "";
  document.getElementById("profNote").textContent =
    `Level ${lvl} — ${captainTitle(lvl)} · Your voyage so far · friend code ${myFriendCode()}`;
  document.getElementById("profBody").innerHTML = `
    <div class="stat-hero">
      <div><i>Gold</i><b>${fmt(G.gold)}</b></div>
      <div><i>Lifetime</i><b>${fmt(G.lifetimeEarnings || 0)}</b></div>
      <div><i>Net Worth</i><b>${fmt(netWorth())}</b></div>
      <div><i>Playtime</i><b>${fmtPlay(G.playSecs)}</b></div>
      <div><i>Level</i><b>${lvl}${next ? " / " + CAPTAIN_TITLES.length : " (max)"}</b></div>
    </div>
    <div class="stat-group"><h4>Record</h4><div class="stat-grid">
      ${recordStatsHTML(s, G.day, G.distSailed)}
    </div></div>`;
  overlayOpen("profileModal");
}

function renderStats(){
  const s = G.stats || freshStats();
  document.getElementById("statsBody").innerHTML = `
    <div class="stat-hero">
      <div><i>Gold</i><b>${fmt(G.gold)}</b></div>
      <div><i>Lifetime earned</i><b>${fmt(G.lifetimeEarnings || 0)}</b></div>
      <div><i>Net worth</i><b>${fmt(netWorth())}</b></div>
      <div><i>Playtime</i><b>${fmtPlay(G.playSecs)}</b></div>
    </div>
    <div class="stat-group"><h4>Smuggling</h4><div class="stat-grid">
      ${statRow("Smuggling runs", s.smugglingRuns)}
      ${statRow("Successful runs", s.smugglingSuccess)}
      ${statRow("Failed runs", s.smugglingFail)}
      ${statRow("Times inspected", s.timesInspected)}
      ${statRow("Times hidden OK", s.timesHidden)}
      ${statRow("Times caught", s.timesCaught)}
      ${statRow("Times escaped", s.timesEscaped)}
      ${statRow("Contraband sold", fmt(s.contrabandSold))}
      ${statRow("Never-caught streak", s.neverCaughtStreak)}
      ${statRow("Longest streak", s.bestNeverCaughtStreak)}
    </div></div>
    <div class="stat-group"><h4>Sailing</h4><div class="stat-grid">
      ${statRow("Distance sailed", fmt(Math.round(G.distSailed / 100)) + " lg")}
      ${statRow("Islands visited", s.islandsVisited + " / " + PORTS.length)}
      ${statRow("Port dockings", s.portDockings)}
      ${statRow("Days passed", s.daysPassed)}
      ${statRow("Shipwrecks", s.shipwrecks)}
      ${statRow("Reef collisions", s.reefHits)}
    </div></div>
    <div class="stat-group"><h4>Economy</h4><div class="stat-grid">
      ${statRow("Total gold earned", fmt(s.goldEarned))}
      ${statRow("Total gold spent", fmt(s.goldSpent))}
      ${statRow("Best trade profit", fmt(s.bestTradeProfit))}
      ${statRow("Biggest purchase", fmt(s.biggestBuy))}
      ${statRow("Biggest sale", fmt(s.biggestSale))}
      ${statRow("Goods bought", fmt(s.goodsBought))}
      ${statRow("Goods sold", fmt(s.goodsSold))}
      ${statRow("Passive income collected", fmt(s.passiveCollected))}
      ${statRow("Business ventures", ((G.passive && G.passive.ventures) || 0) + " / " + VENTURE_MAX)}
      ${statRow("Properties owned", PORTS.filter(p => propOwned(p.id)).length + " / " + PORTS.length)}
    </div></div>
    <div class="stat-group"><h4>Combat &amp; Navy</h4><div class="stat-grid">
      ${statRow("Naval encounters", s.navalEncounters)}
      ${statRow("Patrols defeated", s.navalWins)}
      ${statRow("Fights lost", s.navalLosses)}
      ${statRow("Encounters escaped", s.navalEscapes)}
      ${statRow("Cargo lost", fmt(s.cargoLost))}
    </div></div>
    <div class="stat-group"><h4>Contracts &amp; Playstyle</h4><div class="stat-grid">
      ${statRow("Legal contracts done", s.jobsCompleted)}
      ${statRow("Contracts failed", s.jobsFailed)}
      ${statRow("Legal contract pay", fmt(s.legalJobPay))}
      ${statRow("Contraband takings", fmt(s.contrabandPay))}
      ${statRow("Active contracts", (G.jobs || []).length + " / " + jobSlotMax())}
    </div></div>
    <div class="stat-group"><h4>Progression</h4><div class="stat-grid">
      ${statRow("Captain level", levelFromXp(G.xp || 0) + " — " + captainTitle(levelFromXp(G.xp || 0)))}
      ${statRow("Experience", xpToNext(G.xp || 0) ? fmt(G.xp || 0) + " / " + fmt(xpToNext(G.xp || 0).need) : fmt(G.xp || 0) + " (max level)")}
      ${statRow("Fortune progress", fmt(netWorth()) + " / " + fmt(FORTUNE_TARGET))}
      ${statRow("Milestone", G.won ? "Fortune made 🏆" : (G.seasoned ? "Seasoned trader" : (G.established ? "Established trader" : "Getting started")))}
      ${statRow("Cargo capacity", G.cargoMax)}
      ${statRow("Ship upgrades", s.shipUpgrades)}
      ${statRow("Cannons", (G.cannons || 0) + " / " + CANNON_MAX)}
      ${statRow("Crew aboard", Object.values(G.crew || {}).filter(Boolean).length + " / 4")}
      ${statRow("Grand fittings", Object.values(G.grand || {}).filter(Boolean).length + " / " + GRAND_DEFS.length)}
      ${statRow("Services bought", s.servicesBought)}
      ${statRow("Hull repairs", s.repairs)}
      ${statRow("False holds", (G.falseHolds || 0) + " / 3")}
    </div></div>`;
}
function openStats(){ renderStats(); overlayOpen("statsModal"); }

/* =====================================================================
   v3.0 — Empire Dashboard. A read-only summary screen: every number here
   is read straight from systems that already exist (netWorth/upgradeValue,
   G.properties, G.passive, tradeInfluence, G.stats, G.legendary, G.auction
   history via G.stats, empireScore/RANK_DEFS) — nothing new is computed
   or stored except two tiny stat counters (bountyEarnings/highestBounty,
   and the per-rarity auction-win counts) that just give visibility into
   gold and prizes the existing Navy/Auction systems already hand out.
   ===================================================================== */
function empireDashStrongestGood(){
  let best = null;
  for(const gid of MONOPOLY_GOODS){
    const pct = tradeInfluence(gid);
    if(!best || pct > best.pct) best = { gid, pct };
  }
  return best;
}
function empireDashProfitableGood(){
  const nearest = nearestPort().port;
  let best = null;
  for(const g of GOODS){
    const held = G.cargo[g.id] || 0;
    if(held <= 0) continue;
    const margin = priceAt(nearest.id, g.id) - (G.avg[g.id] || g.base);
    if(!best || margin > best.margin) best = { g, margin };
  }
  return best;
}
function renderEmpireDash(){
  const s = G.stats || freshStats();
  const nw = netWorth();

  // ---- WEALTH ----
  const wealthHTML = `
    <div class="stat-hero">
      <div><i>Gold</i><b>${fmt(G.gold)}</b></div>
      <div><i>Net worth</i><b>${fmt(nw)}</b></div>
      <div><i>Lifetime earnings</i><b>${fmt(G.lifetimeEarnings || 0)}</b></div>
      <div><i>Fortune progress</i><b>${fmt(nw)} / ${fmt(FORTUNE_TARGET)}</b></div>
    </div>`;

  // ---- PROPERTIES ----
  const ownedProps = PORTS.filter(p => propOwned(p.id));
  const storedTotal = ownedProps.reduce((sum, p) => {
    const own = propOwned(p.id);
    return sum + (p.business && p.business.kind === "production" ? own.stored : 0);
  }, 0);
  const propsHTML = `<div class="stat-group"><h4>🏘️ Properties</h4><div class="stat-grid">
    ${statRow("Properties owned", ownedProps.length + " / " + PORTS.length)}
    ${statRow("Total property value", fmt(propertyAssetValue()))}
    ${statRow("Passive income", "+" + fmt(passiveDailyRate()) + " gold/day")}
    ${statRow("Stored production", fmt(storedTotal) + " units")}
  </div></div>`;

  // ---- TRADE ----
  const strongest = empireDashStrongestGood();
  const profitable = empireDashProfitableGood();
  const tradeHTML = `<div class="stat-group"><h4>⚖️ Trade</h4><div class="stat-grid">
    ${statRow("Strongest commodity", strongest && strongest.pct > 0 ? `${goodName(strongest.gid)} (${influenceTierName(strongest.pct)})` : "— none yet —")}
    ${statRow("Trade influence", strongest ? strongest.pct + "%" : "0%")}
    ${statRow("Most profitable commodity", profitable ? `${goodName(profitable.g.id)} (+${fmt(Math.round(profitable.margin))}/unit)` : "— nothing held —")}
    ${statRow("Best trade achievement", fmt(s.bestTradeProfit) + " gold profit")}
  </div></div>`;

  // ---- BOUNTIES ---- (Navy patrol prizes — the game's existing "bounty" income)
  const bountiesHTML = `<div class="stat-group"><h4>💀 Bounties</h4><div class="stat-grid">
    ${statRow("Bounties completed", s.navalWins)}
    ${statRow("Highest bounty", fmt(s.highestBounty || 0))}
    ${statRow("Total bounty earnings", fmt(s.bountyEarnings || 0))}
  </div></div>`;

  // ---- FLEET ----
  const leg = G.legendary || freshLegendary();
  const activeDef = activeLegendaryDef();
  const fleetValue = leg.owned.reduce((sum, key) => { const d = legendaryDef(key); return sum + (d ? d.cost : 0); }, 0);
  const fleetHTML = `<div class="stat-group"><h4>⛵ Fleet</h4><div class="stat-grid">
    ${statRow("Current ship", activeDef ? `${activeDef.icon} ${activeDef.name}` : "Your Original Ship")}
    ${statRow("Ships owned", (leg.owned.length + 1) + " / " + (LEGENDARY_SHIPS.length + 1))}
    ${statRow("Legendary ships", leg.owned.length + " / " + LEGENDARY_SHIPS.length)}
    ${statRow("Total fleet value", fmt(fleetValue))}
  </div></div>`;

  // ---- AUCTIONS ----
  const auctionsHTML = `<div class="stat-group"><h4>🔨 Auctions</h4><div class="stat-grid">
    ${statRow("Rare items acquired", s.auctionsWonRare || 0)}
    ${statRow("Legendary items acquired", s.auctionsWonLegendary || 0)}
  </div></div>`;

  // ---- RANK ----
  const rIdx = empireRankIndex(), rank = RANK_DEFS[rIdx], next = RANK_DEFS[rIdx + 1];
  const score = empireScore();
  const rankHTML = `<div class="stat-group"><h4>🎖️ Rank</h4><div class="stat-grid">
    ${statRow("Current Empire Rank", rank.name)}
    ${statRow("Next milestone", next ? next.name : "None — highest rank held")}
    ${statRow("Progress toward next", next ? `${fmt(score)} / ${fmt(next.score)}` : "Fortune achieved 🏆")}
  </div></div>`;

  document.getElementById("empireDashBody").innerHTML =
    wealthHTML + propsHTML + tradeHTML + bountiesHTML + fleetHTML + auctionsHTML + rankHTML;
}
function openEmpireDash(){ renderEmpireDash(); overlayOpen("empireDashModal"); }

/* ---- Save slots ---- */
function readSlots(){
  try{ const a = JSON.parse(localStorage.getItem(SLOT_KEY) || "[]"); return Array.isArray(a) ? a : []; }
  catch(_){ return []; }
}
function writeSlots(a){ try{ localStorage.setItem(SLOT_KEY, JSON.stringify(a.slice(0, 3))); }catch(_){} }
function slotMeta(code){
  try{
    const raw = code.startsWith("SnSW2:") ? code.slice(6) : code;
    const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
    return {
      captain: (o.captain || "Unnamed").slice(0, 24),
      day: Number(o.day) || 1,
      worth: Math.round(Number(o.worth) || 0),
      earned: Math.round(Number(o.lifetimeEarnings) || Number(o.worth) || 0),
      secs: Math.round(Number(o.playSecs) || 0),
    };
  }catch(_){ return null; }
}
function renderSlots(){
  const slots = readSlots();
  const msg = document.getElementById("slotMsg");
  if(msg) msg.textContent = "";
  let html = "";
  for(let i = 0; i < 3; i++){
    const code = slots[i];
    const m = code ? slotMeta(code) : null;
    if(m){
      html += `<div class="slot-card filled">
        <div class="slot-title">Voyage ${i + 1} — ${escHtml(m.captain)}</div>
        <div class="slot-meta">Day ${m.day} · ${fmt(m.earned)} lifetime · ${fmt(m.worth)} net worth · ${fmtPlay(m.secs)} played</div>
        <div class="slot-btns">
          <button class="btn gold" data-slot-load="${i}">Load</button>
          <button class="btn" data-slot-save="${i}">Overwrite with current</button>
          <button class="btn danger" data-slot-del="${i}">Delete</button>
        </div>
      </div>`;
    }else{
      html += `<div class="slot-card">
        <div class="slot-title">Voyage ${i + 1} — Empty Slot</div>
        <div class="slot-meta">Save your current voyage here to keep more than one run going.</div>
        <div class="slot-btns"><button class="btn gold" data-slot-save="${i}">Save current voyage here</button></div>
      </div>`;
    }
  }
  document.getElementById("slotList").innerHTML = html;
  document.querySelectorAll("[data-slot-save]").forEach(b => b.onclick = () => slotSave(+b.dataset.slotSave));
  document.querySelectorAll("[data-slot-load]").forEach(b => b.onclick = () => slotLoad(+b.dataset.slotLoad));
  document.querySelectorAll("[data-slot-del]").forEach(b => b.onclick = () => slotDelete(+b.dataset.slotDel));
}
function slotSave(i){
  const slots = readSlots();
  slots[i] = toSaveCode();
  writeSlots(slots);
  renderSlots();
  document.getElementById("slotMsg").textContent = `Saved current voyage to slot ${i + 1}.`;
  toast(`✓ Saved to Voyage ${i + 1}`, {kind:"save"});
}
function slotLoad(i){
  const slots = readSlots();
  if(!slots[i]) return;
  let next;
  try{ next = fromSaveCode(slots[i]); }
  catch(e){ document.getElementById("slotMsg").textContent = "That slot is corrupted and can't be loaded."; return; }
  try{ localStorage.setItem(SAVE_KEY + "_prev", localStorage.getItem(SAVE_KEY) || ""); }catch(_){}
  G = next;
  snapshotPrices(); syncNavy(); rebuildWorldCaches(); resetBoarding();
  saveLocal();
  overlayCloseAll();
  toast(`Voyage ${i + 1} loaded — welcome back, ${G.captain || "captain"}.`);
  beginPlay();
}
function slotDelete(i){
  const slots = readSlots();
  slots[i] = null;
  writeSlots(slots);
  renderSlots();
  document.getElementById("slotMsg").textContent = `Slot ${i + 1} cleared.`;
}
function openVoyages(){ renderSlots(); overlayOpen("voyagesModal"); }
function openLeaderboard(){
  // may be called with Settings still on the stack — the captain gate + overlayOpen handle it
  ensureCaptain(()=>{
    renderLeaderboard();
    document.getElementById("lbRivalMsg").textContent = "";
    overlayOpen("lbModal");
  });
}
function addRivalFromCode(){
  const box = document.getElementById("lbRivalCode");
  const msg = document.getElementById("lbRivalMsg");
  const code = box.value.trim();
  if(!code){ msg.textContent = "Paste a friend's save code first."; return; }
  try{
    const raw = code.startsWith("SnSW2:") ? code.slice(6) : code;
    const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
    const name = (typeof o.captain === "string" ? o.captain : "").trim().slice(0, 24);
    if(!name) throw new Error("that save has no captain name");
    const secs   = Math.max(0, Number(o.playSecs) || 0);
    const worth  = Math.max(0, Number(o.worth) || 0);
    const earned = Math.max(0, Number(o.lifetimeEarnings) || worth);
    G.rivals = (G.rivals || []).filter(r => r.name.toLowerCase() !== name.toLowerCase());
    G.rivals.push({ name, secs, worth, earned });
    G.rivals = G.rivals.slice(-20);
    saveLocal();
    box.value = "";
    msg.textContent = `Added ${name} — ${fmt(earned)} lifetime, ${fmt(worth)} net worth.`;
    renderLeaderboard();
  }catch(e){
    msg.textContent = "Couldn't read that code: " + e.message;
  }
}

/* =====================================================================
   v1.8 — Friends list · friend requests · friend profiles
   (local-only: no server is faked; friend data is the last code they shared)
   ===================================================================== */
function parseShareCode(code){
  const raw = code.trim().startsWith("SnSW2:") ? code.trim().slice(6) : code.trim();
  const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
  const name = (typeof o.captain === "string" ? o.captain : "").trim().slice(0, 24);
  if(!name) throw new Error("no captain name in that code");
  return {
    name,
    code: genFriendCode(name),
    secs:   Math.max(0, Number(o.playSecs) || 0),
    worth:  Math.max(0, Number(o.worth) || 0),
    earned: Math.max(0, Number(o.lifetimeEarnings) || Number(o.worth) || 0),
    snap:   o,
  };
}
function friendAddRequest(){
  const box = document.getElementById("friendAddBox");
  const msg = document.getElementById("friendAddMsg");
  const code = box.value.trim();
  if(!code){ msg.textContent = "Paste a friend's SnSW2:… code first."; return; }
  let p;
  try{ p = parseShareCode(code); }
  catch(e){ msg.textContent = "That doesn't look like a valid code."; return; }
  if(p.name.toLowerCase() === (G.captain || "").toLowerCase()){ msg.textContent = "That's your own code, captain."; return; }
  if((G.rivals || []).some(r => r.name.toLowerCase() === p.name.toLowerCase())){ msg.textContent = `${p.name} is already on your friends list.`; return; }
  G.friendRequests = (G.friendRequests || []).filter(r => r.name.toLowerCase() !== p.name.toLowerCase());
  G.friendRequests.push(p);
  G.friendRequests = G.friendRequests.slice(-20);
  saveLocal();
  box.value = "";
  msg.textContent = `Friend request from ${p.name} is waiting below.`;
  toast(`👤 Friend request — ${p.name} wants to add you.`, {life:3600});
  renderFriends();
}
function acceptFriendRequest(name){
  const req = (G.friendRequests || []).find(r => r.name === name);
  if(!req) return;
  G.friendRequests = G.friendRequests.filter(r => r.name !== name);
  G.rivals = (G.rivals || []).filter(r => r.name.toLowerCase() !== name.toLowerCase());
  G.rivals.push({ name: req.name, code: req.code, secs: req.secs, worth: req.worth, earned: req.earned, addedDay: G.day, snap: req.snap });
  G.rivals = G.rivals.slice(-30);
  saveLocal();
  toast(`${req.name} added to your friends.`, {kind:"save"});
  renderFriends();
  if(overlayShown("lbModal")) renderLeaderboard();
}
function declineFriendRequest(name){
  G.friendRequests = (G.friendRequests || []).filter(r => r.name !== name);
  saveLocal();
  renderFriends();
}
function removeFriend(name){
  G.rivals = (G.rivals || []).filter(r => r.name !== name);
  saveLocal();
  renderFriends();
  if(overlayShown("lbModal")) renderLeaderboard();
}
function allFriends(){
  // built-in rivals + imported friends, de-duped by name
  const seen = new Set();
  const list = [];
  for(const r of RIVAL_CAPTAINS){ seen.add(r.name.toLowerCase()); list.push({ ...r, builtin: true }); }
  for(const r of (G.rivals || [])){
    if(seen.has(r.name.toLowerCase())) continue;
    seen.add(r.name.toLowerCase());
    list.push({ ...r });
  }
  return list.sort((a, b) => (b.earned || b.worth) - (a.earned || a.worth));
}
function renderFriends(){
  document.getElementById("myFriendCode").textContent = myFriendCode();

  const reqs = G.friendRequests || [];
  document.getElementById("friendReqWrap").hidden = reqs.length === 0;
  document.getElementById("friendReqList").innerHTML = reqs.map(r => `
    <div class="friend-row">
      <span class="fr-name" style="cursor:default">👤 ${escHtml(r.name)}</span>
      <span class="fr-stat"><b>${fmt(r.earned)}</b> lifetime · ${fmtPlay(r.secs)}</span>
      <button class="btn buy" data-acc="${escHtml(r.name)}">Accept</button>
      <button class="btn danger" data-dec="${escHtml(r.name)}">Decline</button>
    </div>`).join("");
  document.querySelectorAll("#friendReqList [data-acc]").forEach(b => b.onclick = () => acceptFriendRequest(b.dataset.acc));
  document.querySelectorAll("#friendReqList [data-dec]").forEach(b => b.onclick = () => declineFriendRequest(b.dataset.dec));

  const friends = allFriends();
  document.getElementById("friendList").innerHTML = friends.length ? friends.map(r => {
    const dot = r.builtin ? (r.online ? '<span class="fr-dot" title="active">🟢</span>' : '<span class="fr-dot" title="idle">⚪</span>')
                          : '<span class="fr-dot" title="shared snapshot">⚓</span>';
    return `<div class="friend-row">
      ${dot}
      <span class="fr-name" data-friend="${escHtml(r.name)}">${escHtml(r.name)}</span>
      <span class="fr-stat"><b>${fmt(r.earned || r.worth)}</b> lifetime · ${fmt(r.worth)} net · ${fmtPlay(r.secs)}</span>
      ${r.builtin ? "" : `<button class="btn danger" data-rm="${escHtml(r.name)}">Remove</button>`}
    </div>`;
  }).join("") : `<div class="friend-empty">No friends yet — paste a code above to send a request.</div>`;
  document.querySelectorAll("#friendList [data-friend]").forEach(b => b.onclick = () => openFriendProfile(b.dataset.friend));
  document.querySelectorAll("#friendList [data-rm]").forEach(b => b.onclick = () => removeFriend(b.dataset.rm));
}
function openFriendProfile(name){
  const r = allFriends().find(x => x.name === name);
  if(!r) return;
  if(r.builtin){ openProfileFromRow({ name: r.name, rival: true, earned: r.earned, worth: r.worth, secs: r.secs, profile: r.profile }); return; }
  if(r.snap){
    const o = r.snap;
    const s = normalizeStats(o.stats);
    document.getElementById("profName").textContent = r.name;
    document.getElementById("profRank").textContent = "Friend";
    document.getElementById("profNote").textContent = `Friend code ${r.code || genFriendCode(r.name)} · snapshot from Day ${Number(o.day)||1}${r.addedDay ? ` · added Day ${r.addedDay}` : ""}.`;
    document.getElementById("profBody").innerHTML = `
      <div class="stat-hero">
        <div><i>Gold</i><b>${fmt(Number(o.gold)||0)}</b></div>
        <div><i>Lifetime</i><b>${fmt(r.earned)}</b></div>
        <div><i>Net Worth</i><b>${fmt(r.worth)}</b></div>
        <div><i>Playtime</i><b>${fmtPlay(r.secs)}</b></div>
      </div>
      <div class="stat-group"><h4>Record</h4><div class="stat-grid">
        ${recordStatsHTML(s, Number(o.day)||1, Number(o.distSailed)||0)}
      </div></div>`;
    overlayOpen("profileModal");
    return;
  }
  openProfileFromRow({ name: r.name, imported: true, earned: r.earned, worth: r.worth, secs: r.secs });
}
function openFriends(){
  ensureCaptain(()=>{ renderFriends(); overlayOpen("friendsModal"); });
}

let mapTab = "map";
function setMapTab(t){
  mapTab = t;
  document.querySelectorAll("#mapTabs button").forEach(b => b.classList.toggle("on", b.dataset.mtab === t));
  document.getElementById("mapTabMap").hidden    = t !== "map";
  document.getElementById("mapTabMarket").hidden = t !== "market";
  document.getElementById("mapTabPorts").hidden  = t !== "ports";
  renderMap();
}
function renderMap(){
  if(mapTab === "map")         renderMapChart();
  else if(mapTab === "market") renderMapMarket();
  else                         renderMapPorts();
}

function renderMapChart(){ drawBigMap(); }

/* v1.6 — Market Intelligence: best buy / best sell / route profit for every good */
function renderMapMarket(){
  const near = nearestPort().port;
  const rows = GOODS.map(g => {
    let lo = null, hi = null;
    for(const p of PORTS){
      const pr = priceAt(p.id, g.id);
      if(!lo || pr < lo.pr) lo = { pr, port: p };
      if(!hi || pr > hi.pr) hi = { pr, port: p };
    }
    return { g, lo, hi, profit: hi.pr - lo.pr, owned: G.cargo[g.id] > 0 };
  }).sort((a, b) => b.profit - a.profit);
  document.getElementById("mapMarket").innerHTML = `
    <table class="mi-table">
      <thead><tr><th>Commodity</th><th>Best buy</th><th>Best sell</th><th>Profit / unit</th></tr></thead>
      <tbody>${rows.map(r => `
        <tr class="${r.owned ? "mi-owned" : ""}">
          <td class="mi-good">${r.g.name}${r.g.illegal ? ' <span class="contra-tag">⚠</span>' : ""}${r.owned ? ` <span class="own-badge">OWN ${G.cargo[r.g.id]}</span>` : ""}</td>
          <td><span class="mi-buy">${fmt(r.lo.pr)}</span> <span class="mi-where">${r.lo.port.name}</span></td>
          <td><span class="mi-sell">${fmt(r.hi.pr)}</span> <span class="mi-where">${r.hi.port.name}</span></td>
          <td class="mi-profit">+${fmt(r.profit)}</td>
        </tr>`).join("")}</tbody>
    </table>`;
}

function renderMapPorts(){
  const near = nearestPort().port;
  const jobDests = jobDestinations();
  document.getElementById("mapPorts").innerHTML = PORTS.map(p=>{
    const rows = GOODS.map(g=>{
      const price = priceAt(p.id, g.id);
      return { g, price, rank: dealRank(p.id, g.id, price), ratio: price / normalPrice(p.id, g.id) };
    }).sort((a,b)=> a.rank - b.rank || a.ratio - b.ratio);
    const body = rows.map(({g, price})=>{
      const owned = G.cargo[g.id] > 0;
      return `<tr class="${owned ? 'owned-row' : ''}">
        <td class="g${owned ? ' owned' : ''}">${g.name}${owned ? ` <span class="own-badge">OWN ${G.cargo[g.id]}</span>` : ''}</td>
        <td class="pr">${fmt(price)}</td>
        <td>${dealMark(p.id, g.id, price)}</td>
      </tr>`;
    }).join("");
    const here = p.id === near.id;
    const dest = jobDests[p.id];
    return `<div class="map-port${here ? ' here' : ''}">
      <div class="mp-head">
        <span class="mp-name">${p.name}</span>
        <span class="mp-tag mp-type">${p.type}${isCrown(p) ? ' ⚓' : ' 🏴‍☠️'}</span>
        ${here ? '<span class="mp-tag">◈ nearest</span>' : ''}
        ${dest ? `<span class="mp-tag" style="color:${dest.left <= 2 ? '#e5645a' : '#ffce85'};">⚑ contract due · ${dest.left}d</span>` : ''}
        <span class="mp-blurb">${p.blurb}</span>
        <span class="mp-specialty">◆ Produces: ${p.specialty}</span>
      </div>
      <table class="map-mkt">${body}</table>
    </div>`;
  }).join("");
}

function drawBigMap(){
  const c = mapCtx;
  // match the canvas bitmap to the space CSS gave it, so it fills cleanly with no scrollbars
  const cw = Math.max(320, Math.round(mapCv.clientWidth  || 900));
  const ch = Math.max(200, Math.round(mapCv.clientHeight || 470));
  if(mapCv.width  !== cw) mapCv.width  = cw;
  if(mapCv.height !== ch) mapCv.height = ch;
  const W = mapCv.width, H = mapCv.height;
  c.clearRect(0,0,W,H);
  const bg = c.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#26221b"); bg.addColorStop(1,"#1a1712");
  c.fillStyle = bg; c.fillRect(0,0,W,H);
  c.fillStyle = "rgba(120,80,30,.24)";
  c.fillRect(0,0,W,8); c.fillRect(0,H-8,W,8); c.fillRect(0,0,7,H); c.fillRect(W-7,0,7,H);

  const pad = 46;
  const scale = Math.min((W-pad*2)/WORLD.w, (H-pad*2)/WORLD.h);
  const ox = (W - WORLD.w*scale)/2, oy = (H - WORLD.h*scale)/2;
  const X = wx => ox + wx*scale, Y = wy => oy + wy*scale;

  // faint chart grid
  c.strokeStyle = "rgba(220,190,140,.12)"; c.lineWidth = 1;
  for(let i=1;i<4;i++){ const gx = ox + WORLD.w*scale*i/4;
    c.beginPath(); c.moveTo(gx,oy); c.lineTo(gx,oy+WORLD.h*scale); c.stroke(); }
  for(let i=1;i<3;i++){ const gy = oy + WORLD.h*scale*i/3;
    c.beginPath(); c.moveTo(ox,gy); c.lineTo(ox+WORLD.w*scale,gy); c.stroke(); }

  // reefs — pale rocks with a dark halo so they read without drowning the islands
  for(const rf of G.reefs){
    c.fillStyle = "rgba(8,12,15,.7)"; c.beginPath(); c.arc(X(rf.x), Y(rf.y), 3.4, 0, Math.PI*2); c.fill();
    c.fillStyle = "#aab5c0";          c.beginPath(); c.arc(X(rf.x), Y(rf.y), 2.2, 0, Math.PI*2); c.fill();
  }

  // ports
  const jobDests = jobDestinations();
  c.textAlign = "center"; c.font = "bold 13px Georgia, serif";
  for(const p of PORTS){
    const px = X(p.x), py = Y(p.y);
    // v3.2 — same Crown (orange) / Haven (green) colours as the port badge
    // in the trade modal, so the chart reads at a glance without a legend.
    const core = isCrown(p) ? "#e58a5c" : "#4caf50";
    const own = propOwned(p.id);
    c.fillStyle = "#3a2c1a";
    c.beginPath(); c.arc(px, py, 7, 0, Math.PI*2); c.fill();
    c.fillStyle = core;
    c.beginPath(); c.arc(px, py, 4, 0, Math.PI*2); c.fill();
    if(own){   // a thin gold ring marks a port where you own a business
      c.strokeStyle = "#f5c05a"; c.lineWidth = 1.4;
      c.beginPath(); c.arc(px, py, 9, 0, Math.PI*2); c.stroke();
    }
    c.fillStyle = "#ece5d7";
    c.fillText(p.name, px, py - 14);
    // v3.3 — a contract destination gets a small pennant above its name
    if(jobDests[p.id]) drawJobFlag(c, px, py - 30, 3, jobDests[p.id].left);
  }

  // navy patrols — red ring only on the ones hunting you
  if(G.navy) for(const n of G.navy){
    c.fillStyle = "#5a86c0";
    c.beginPath(); c.arc(X(n.x), Y(n.y), 4, 0, Math.PI*2); c.fill();
    if(n.state === "hunt"){
      c.strokeStyle = "#b5202b"; c.lineWidth = 1.5;
      c.beginPath(); c.arc(X(n.x), Y(n.y), 6.5, 0, Math.PI*2); c.stroke();
    }
  }
  const hunter = G.navy && G.navy.find(n => n.state === "hunt");
  if(hunter){
    c.fillStyle = "#e5645a"; c.font = "italic 11px Georgia, serif";
    c.fillText("navy in pursuit", X(hunter.x), Y(hunter.y) - 12);
  }

  // ship — "your ship"
  const s = G.ship;
  c.save();
  c.translate(X(s.x), Y(s.y)); c.rotate(s.a);
  c.fillStyle = "#d24e40";
  c.beginPath(); c.moveTo(9,0); c.lineTo(-6,-6); c.lineTo(-6,6); c.closePath(); c.fill();
  c.restore();
  c.fillStyle = "#d24e40"; c.font = "italic 11px Georgia, serif";
  c.fillText("your ship", X(s.x), Y(s.y) + 20);

  c.strokeStyle = "#7a4712"; c.lineWidth = 2;
  c.strokeRect(1,1,W-2,H-2);
}

/* ---------- HUD render ---------- */
/* dashboard element refs, resolved once */
let D = null;
function cacheDashEls(){
  D = {};
  ["dGold","dCargo","dHp","dSpd","dNet","dLife","dFortune","dHoldings","drowHoldings","dashDay","mCargo","mHp","mFortune","dWanted","wantedBadge","auctionBadge"]
    .forEach(id => D[id] = document.getElementById(id));
}
const _dashLast = {};
function setDash(key, val){ if(_dashLast[key] !== val){ _dashLast[key] = val; D[key].textContent = val; } }

function renderDash(){
  if(!D) cacheDashEls();
  const used = totalCargo();
  setDash("dGold",   fmt(G.gold));                      // dirty-checked — these rarely change per-frame
  setDash("dCargo",  `${used} / ${G.cargoMax}`);
  const nw = netWorth();
  setDash("dNet",    fmt(nw));
  setDash("dLife",   fmt(G.lifetimeEarnings || 0));
  setDash("dFortune", fortuneLabel(nw));
  setDash("dashDay", "Day " + G.day);
  // v2.3 — passive holdings row appears once you own a venture
  const pv = G.passive;
  if(pv && pv.ventures > 0){
    if(D.drowHoldings) D.drowHoldings.hidden = false;
    setDash("dHoldings", `+${fmt(passiveDailyRate())}/day · ${fmt(Math.floor(pv.accrued))} held`);
  }else if(D.drowHoldings){
    D.drowHoldings.hidden = true;
  }
  setDash("dHp",     String(Math.round(G.hp)));
  D.dSpd.textContent = (G.ship.spd/10).toFixed(1) + " kn";   // changes constantly — always write
  updatePlayclock();
  D.mCargo.style.transform = `scaleX(${clamp(used/G.cargoMax,0,1)})`;
  D.mHp.style.transform    = `scaleX(${clamp(G.hp/G.hpMax,0,1)})`;
  D.mFortune.style.transform = `scaleX(${clamp(nw / FORTUNE_TARGET, 0, 1)})`;

  const w = G.wanted || 0;
  D.dWanted.textContent = w > 0 ? ("★".repeat(w) + "☆".repeat(5 - w)) : "— clean —";
  D.dWanted.style.color = w > 0 ? "#e0563e" : "#8fae7a";
  const wb = D.wantedBadge;
  if(w > 0){
    const hunted = anyNavyHunting();
    wb.textContent = hunted
      ? `⚠ WANTED ${"★".repeat(w)} — NAVY IN PURSUIT`
      : `WANTED ${"★".repeat(w)} — LIE LOW`;
    wb.classList.toggle("calm", !hunted);
    wb.classList.add("show");
  }else{
    wb.classList.remove("show");
    wb.classList.remove("calm");
  }

  // v2.7 — a small always-on reminder while a black market auction is live and unresolved
  const ab = D.auctionBadge;
  if(G.auction && !G.auction.resolved){
    const left = G.auction.expiresDay - G.day;
    ab.textContent = `🏴 Black Market Auction — ${portById(G.auction.portId).name} · ${Math.max(0, left)} day${left === 1 ? "" : "s"} left`;
    ab.classList.add("show");
  }else{
    ab.classList.remove("show");
  }
}

function trendMark(cur, prev){
  if(prev == null || cur === prev) return `<span class="flat">—</span>`;
  const pct = ((cur - prev)/prev)*100;
  return cur > prev
    ? `<span class="up">▲ ${pct.toFixed(0)}%</span>`
    : `<span class="down">▼ ${Math.abs(pct).toFixed(0)}%</span>`;
}

/* "Normal" price = the base price with only this port's standing modifier,
   i.e. what the good costs here when the market multiplier sits at 1.0. */
function normalPrice(portId, goodId){
  const g = GOODS.find(x=>x.id===goodId);
  const p = portById(portId);
  let price = g.base;
  if(g.illegal){
    if(g.origin.includes(portId))   price *= 0.85;
    else if(p.faction === "crown")  price *= 3.9;
    else                            price *= 1.7;
    return Math.max(1, Math.round(price));
  }
  if(p.cheap.includes(goodId)) price *= 0.70;
  if(p.dear.includes(goodId))  price *= 1.36;
  return Math.max(1, Math.round(price));
}
/* v1.4 — one consistent classification: current price vs this port's NORMAL price. */
function dealInfo(portId, goodId, price){
  const norm = normalPrice(portId, goodId);
  const pct  = Math.round((price - norm) / norm * 100);
  const r    = price / norm;
  if(r <= 0.90) return { norm, pct, cls:"low",  label:"🟢 GREAT BUY" };
  if(r >= 1.10) return { norm, pct, cls:"high", label:"🔴 GREAT SELL" };
  return { norm, pct, cls:"fair", label:"🟡 FAIR PRICE" };
}
/* short form for the map table */
function dealMark(portId, goodId, price){
  const d = dealInfo(portId, goodId, price);
  if(d.cls === "low")  return `<span class="deal-low">🟢 ${Math.abs(d.pct)}% BUY</span>`;
  if(d.cls === "high") return `<span class="deal-high">🔴 ${d.pct}% SELL</span>`;
  return `<span class="flat">🟡 fair</span>`;
}
/* full pill for the market list */
function dealPill(portId, goodId, price){
  const d = dealInfo(portId, goodId, price);
  return `<span class="deal-pill ${d.cls}">${d.label}<br>${dealPhrase(d.pct)}</span>`;
}
function dealPhrase(pct){
  if(pct > 0)  return `▲ ${pct}% above normal`;
  if(pct < 0)  return `▼ ${Math.abs(pct)}% below normal`;
  return "at normal price";
}

/* ---------- tabbed trade screen ---------- */
let tradeTab = "mkt";
function setTradeTab(t){
  tradeTab = t;
  document.querySelectorAll("#tmTabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === t));
  document.getElementById("tabMkt").hidden  = t !== "mkt";
  document.getElementById("tabJob").hidden  = t !== "job";
  document.getElementById("tabSvc").hidden  = t !== "svc";
  document.getElementById("tabEmpire").hidden = t !== "empire";
  document.getElementById("tabFleet").hidden = t !== "fleet";
  document.getElementById("tabHold").hidden = t !== "hold";
}

function mktRowHTML(port, g, price){
  const cell = G.market[port.id][g.id];
  const held = G.cargo[g.id];
  const avg  = held > 0 ? Math.round(G.avg[g.id]) : null;
  const canBuy = G.gold >= price && totalCargo() < G.cargoMax;
  let pos = `<span class="mk-none">— not held —</span>`;
  if(held > 0){
    const delta = price - avg;
    const cls = delta >= 0 ? "up" : "down";
    pos = `<b>${held}</b> held · avg ${fmt(avg)}<br>` +
          `<span class="mk-delta ${cls}">${delta >= 0 ? "+" : "−"}${fmt(Math.abs(delta))}/unit here</span>`;
  }
  return `<div class="mkt-row">
    <div class="mk-name">
      <span class="mk-title">${g.name}${g.illegal ? ' <span class="contra-tag">⚠</span>' : ''}</span>
      <span class="mk-desc">${g.desc}</span>
    </div>
    <div class="mk-mid">
      <span class="mk-price">${fmt(price)}<span class="mk-norm">normal ${fmt(normalPrice(port.id, g.id))}</span></span>
      ${dealPill(port.id, g.id, price)}
      <span class="mk-trend">${trendMark(price, cell.prev)}<br><span class="mk-norm">vs. yesterday</span></span>
    </div>
    <div class="mk-pos">${pos}</div>
    <div class="mk-act">
      <button class="btn buy" data-buy="${g.id}" ${canBuy ? "" : "disabled"}>Buy</button>
      <button class="btn sell" data-sell="${g.id}" ${held > 0 ? "" : "disabled"}>Sell</button>
    </div>
  </div>`;
}

function renderTrade(port){
  if(!port) return;

  // ---- header ----
  document.getElementById("tPort").textContent = port.name;
  const fac = document.getElementById("tFaction");
  fac.className = "tm-faction " + (isCrown(port) ? "crown" : "haven");
  fac.textContent = isCrown(port) ? "⚓ Crown Port — inspects contraband" : "🏴‍☠️ Pirate Haven — no inspections";
  document.getElementById("tmDay").textContent   = G.day;
  document.getElementById("tmPurse").textContent = fmt(G.gold);
  const used = totalCargo();
  document.getElementById("tmCargo").textContent = `${used} / ${G.cargoMax}`;
  document.getElementById("tmCargoFill").style.transform = `scaleX(${clamp(used / G.cargoMax, 0, 1)})`;

  document.getElementById("tBlurb").innerHTML =
    `<b class="mp-type">${port.type}</b> — ${port.blurb}.<br>` +
    `<span class="mp-specialty" style="display:inline;">◆ Specialty: ${port.specialty}.</span> &nbsp;` +
    `<span class="held">Cheap:</span> ${port.cheap.map(goodName).join(", ")} · ` +
    `<span class="down">Pays well:</span> ${port.dear.map(goodName).join(", ")}`;
  {
    const nw = netWorth();
    document.getElementById("tWinLine").innerHTML = G.won
      ? `<div class="win-line">🏆 FORTUNE ACHIEVED — net worth ${fmt(nw)} Sovereigns. A true trading empire.</div>`
      : `<div class="win-line progress">Fortune &nbsp;<b>${fmt(nw)} / ${fmt(FORTUNE_TARGET)}</b> Sovereigns` +
        `${G.established ? "" : ` &nbsp;·&nbsp; established trader at ${fmt(WIN_TARGET)}`}</div>`;
  }

  // ---- market (legal goods first, contraband walled off) ----
  const ordered = GOODS.map(g => {
    const price = priceAt(port.id, g.id);
    return { g, price, ratio: price / normalPrice(port.id, g.id) };
  }).sort((a, b) => a.ratio - b.ratio);
  const legal = ordered.filter(x => !x.g.illegal);
  const black = ordered.filter(x => x.g.illegal);
  document.getElementById("mktLegal").innerHTML = legal.map(x => mktRowHTML(port, x.g, x.price)).join("");
  document.getElementById("mktBlack").innerHTML = black.map(x => mktRowHTML(port, x.g, x.price)).join("");
  document.querySelectorAll("#tabMkt [data-buy]").forEach(b => b.onclick = () => buy(port.id, b.dataset.buy));
  document.querySelectorAll("#tabMkt [data-sell]").forEach(b => b.onclick = () => sell(port.id, b.dataset.sell));

  // ---- port services ----
  const repNeed = G.hpMax - G.hp;
  document.getElementById("repairInfo").textContent = repNeed <= 0
    ? "Hull is sound — nothing to patch." : `${Math.round(repNeed)} damage · 7 gold / point · full ≈ ${fmt(repNeed * 7)} gold`;
  svcState("svcRepair", "repairBtn", repNeed <= 0 || G.gold < 7);

  const holdCost = holdExpandCost(0);
  document.getElementById("holdInfo").textContent = `+10 crates per step · next step ${fmt(holdCost)} gold · hold is now ${G.cargoMax}`;
  document.getElementById("holdBtn").textContent = "Expand Hold" + svcQtySuffix();
  svcState("svcHold", "holdBtn", G.gold < holdCost);

  // ---- shipwright ----
  document.getElementById("shipwrightList").innerHTML = SW_DEFS.map(def => {
    const lv = G.upgrades[def.key] || 0;
    const maxed = lv >= SW_MAX_LEVEL;
    const cost = swCost(def);
    const tierMark = lv >= 5 ? ' <span class="sw-lv" style="color:#ffce85">◆</span>' : '';
    return `<div class="sw-row">
      <span>${def.name} <span class="sw-lv">Lv ${lv}/${SW_MAX_LEVEL}</span>${tierMark}<br><span class="muted">${def.desc}</span></span>
      <button class="btn" data-sw="${def.key}" ${maxed || G.gold < cost ? "disabled" : ""}>${maxed ? "MAX" : fmt(cost) + svcQtySuffix()}</button>
    </div>`;
  }).join("");
  document.querySelectorAll("#shipwrightList [data-sw]").forEach(b => b.onclick = () => buyShipwright(b.dataset.sw));

  // ---- grand fittings (milestones) ----
  document.getElementById("grandList").innerHTML = GRAND_DEFS.map(def => {
    const has = G.grand && G.grand[def.key];
    return `<div class="sw-row">
      <span>${def.name}${has ? ' <span class="sw-lv">fitted ✓</span>' : ''}<br><span class="muted">${def.desc}</span></span>
      <button class="btn gold" data-grand="${def.key}" ${has || G.gold < def.cost ? "disabled" : ""}>${has ? "✓" : fmt(def.cost)}</button>
    </div>`;
  }).join("");
  document.querySelectorAll("#grandList [data-grand]").forEach(b => b.onclick = () => buyGrand(b.dataset.grand));

  // ---- insurance ----
  const insC = insuranceCost();
  document.getElementById("insuranceInfo").textContent = G.insured
    ? "Covered — your next wreck costs far less, then the policy expires."
    : `${fmt(insC)} gold · a wreck then costs 20% gold / keeps 75% cargo (one payout)`;
  document.getElementById("insuranceBtn").textContent = G.insured ? "Insured ✓" : "Buy Policy";
  svcState("svcInsurance", "insuranceBtn", G.insured || G.gold < insC);

  document.getElementById("restInfo").textContent = `${REST_COST} gold lodging · wakes Day ${G.day + 1} · re-rolls every port's prices`;
  svcState("svcRest", "restBtn", G.gold < REST_COST);
  const mrb = document.getElementById("mktRestBtn");
  if(mrb){ mrb.textContent = `🛏 Rest 1 Day — ${REST_COST}g`; mrb.disabled = G.gold < REST_COST; }

  // ---- business holdings (passive income) ----
  {
    const pv = G.passive || freshPassive();
    const rate = passiveDailyRate();
    const acc  = Math.floor(pv.accrued);
    const maxed = pv.ventures >= VENTURE_MAX;
    const nextCost = ventureCost(pv.ventures);
    const src = pv.ventures === 0 ? "No ventures yet" : `${pv.ventures}/${VENTURE_MAX} venture${pv.ventures === 1 ? "" : "s"}`;
    document.getElementById("holdingsInfo").innerHTML =
      `<b>Source:</b> ${src} · <span class="hd-rate">+${fmt(rate)} gold / day</span><br>` +
      `<b>Accrued:</b> <span class="hd-acc">${fmt(acc)}</span> gold · next payout Day ${G.day + 1} (at your next Rest)<br>` +
      (maxed
        ? `Holdings are at their limit.`
        : `Buy a stake: <b>${fmt(nextCost)}</b> gold → +${VENTURE_INCOME}/day. Passive gold never replaces trading — it's a slow return on your empire.`);
    const cb = document.getElementById("collectHoldingsBtn");
    cb.textContent = acc > 0 ? `Collect ${fmt(acc)}` : "Collect";
    cb.disabled = acc <= 0;
    const vb = document.getElementById("buyVentureBtn");
    vb.textContent = maxed ? "Ventures maxed" : `Buy Venture — ${fmt(nextCost)}`;
    vb.disabled = maxed || G.gold < nextCost;
    document.getElementById("svcHoldings").classList.toggle("off", acc <= 0 && (maxed || G.gold < nextCost));
  }

  const fhCost = falseHoldCost(G.falseHolds || 0);
  const fhFull = (G.falseHolds || 0) >= FALSE_HOLD_MAX;
  document.getElementById("falseHoldInfo").textContent = fhFull
    ? `Hidden holds fitted: ${FALSE_HOLD_MAX} / ${FALSE_HOLD_MAX} — she'll take no more.`
    : `Hidden hold ${(G.falseHolds || 0) + 1} / ${FALSE_HOLD_MAX} · ${fmt(fhCost)} gold · +22% to slip an inspection`;
  document.getElementById("falseHoldBtn").textContent = fhFull ? "Fit Hidden Hold" : "Fit Hidden Hold" + svcQtySuffix();
  svcState("svcFalseHold", "falseHoldBtn", fhFull || G.gold < fhCost);

  const smug = document.getElementById("smugglerServices");
  if(isHaven(port) && (G.wanted || 0) > 0){
    smug.style.display = "";
    const payCost = 200 + G.wanted * G.wanted * 90;
    document.getElementById("payoffInfo").textContent = `Bribe the harbour officials · ${fmt(payCost)} gold · wipes all ${G.wanted}★`;
    svcState("svcPayoff", "payoffBtn", G.gold < payCost);
    const flagCost = 520;
    document.getElementById("falseFlagInfo").textContent = `Forged papers & fresh colours · ${fmt(flagCost)} gold · drops 2★`;
    svcState("svcFlag", "falseFlagBtn", G.gold < flagCost);
  }else{
    smug.style.display = "none";
  }

  // ---- crew ----
  document.getElementById("crewList").innerHTML = CREW_DEFS.map(def => {
    const has = G.crew && G.crew[def.key];
    return `<div class="sw-row">
      <span>${def.name}${has ? ' <span class="sw-lv">aboard</span>' : ''}<br><span class="muted">${def.desc}</span></span>
      <button class="btn" data-crew="${def.key}" ${has || G.gold < def.cost ? "disabled" : ""}>${has ? "✓" : fmt(def.cost)}</button>
    </div>`;
  }).join("");
  document.querySelectorAll("#crewList [data-crew]").forEach(b => b.onclick = () => hireCrew(b.dataset.crew));

  // ---- guns ----
  const gunsFull = (G.cannons || 0) >= CANNON_MAX;
  const gunsCost = cannonCost(G.cannons || 0);
  document.getElementById("gunsInfo").textContent = gunsFull
    ? `Guns: ${CANNON_MAX} / ${CANNON_MAX} — a full broadside.`
    : `Guns ${G.cannons || 0} / ${CANNON_MAX} · next pair ${fmt(gunsCost)} gold · better odds when you Fight a patrol`;
  document.getElementById("gunsBtn").textContent = gunsFull ? "Run Out More Guns" : "Run Out More Guns" + svcQtySuffix();
  svcState("svcGuns", "gunsBtn", gunsFull || G.gold < gunsCost);

  // ---- paint ----
  const chips = (part, table) => Object.keys(table).map(k => {
    const locked = !paintUnlocked(k);
    const rankName = locked ? RANK_DEFS[RANK_PAINT_GATE[k]].name : "";
    return `<button class="paint-chip ${G.cosmetic[part] === k ? "on" : ""} ${locked ? "off" : ""}" style="background:${table[k]}"
      data-paint="${part}" data-choice="${k}" title="${locked ? `Unlocks at ${rankName} rank` : k}" ${locked ? "disabled" : ""}></button>`;
  }).join("");
  document.getElementById("paintHull").innerHTML = chips("hull", HULL_PAINT);
  document.getElementById("paintSail").innerHTML = chips("sail", SAIL_PAINT);
  document.querySelectorAll("#svcPaint [data-paint]").forEach(b => b.onclick = () => paintShip(b.dataset.paint, b.dataset.choice));

  // ---- contracts ----
  renderJobs(port);

  // ---- empire (port real estate) ----
  renderEmpire(port);

  // ---- fleet (legendary ships) ----
  renderFleet();

  // ---- hold ----
  renderHoldPanel(port);

  document.getElementById("tPurse").textContent = `Purse: ${fmt(G.gold)} sovereigns`;
  setTradeTab(tradeTab);
}

function jobLine(j){
  const dest = portById(j.to) || { name: "—" };
  const need = j.type === "supply" ? `carry ${j.qty} ${goodName(j.good)}` :
               j.type === "passenger" ? "2 berths" :
               j.type === "courier" ? "1 berth" : `${j.qty} hold space`;
  return { dest, need };
}
function renderJobs(port){
  const active = G.jobs || [];
  const aEl = document.getElementById("jobActive");
  const hdr = aEl.previousElementSibling;
  if(hdr && hdr.classList.contains("job-h")) hdr.textContent = `Active contracts (${active.length} / ${jobSlotMax()})`;
  aEl.innerHTML = active.length ? active.map(j => {
    const { dest } = jobLine(j);
    const left = j.dayLimit - (G.day - j.acceptedDay);
    const supplyReady = j.type === "supply" && (G.cargo[j.good] || 0) >= j.qty;
    return `<div class="job-card active">
      <div class="job-main">
        <span class="job-title">${j.title}</span>
        <span class="job-sub">→ ${dest.name} · <span class="${left <= 1 ? "job-late" : ""}">${left} day${left===1?"":"s"} left</span>${j.type === "supply" ? ` · ${supplyReady ? "cargo ready ✓" : `need ${j.qty} ${goodName(j.good)}`}` : ""}</span>
      </div>
      <span class="job-reward">+${fmt(j.reward)}</span>
      <button class="btn danger" data-abandon="${j.id}">Abandon</button>
    </div>`;
  }).join("") : `<div class="job-empty">No active contracts. Take one from the board below.</div>`;
  aEl.querySelectorAll("[data-abandon]").forEach(b => b.onclick = () => abandonJob(b.dataset.abandon));

  const bEl = document.getElementById("jobBoardList");
  bEl.innerHTML = jobBoard.length ? jobBoard.map((j, i) => {
    const { dest, need } = jobLine(j);
    return `<div class="job-card">
      <div class="job-main">
        <span class="job-title">${j.title}</span>
        <span class="job-sub">→ ${dest.name} · needs ${need} · ${j.dayLimit}-day deadline</span>
      </div>
      <span class="job-reward">+${fmt(j.reward)}</span>
      <button class="btn buy" data-accept="${i}">Accept</button>
    </div>`;
  }).join("") : `<div class="job-empty">No contracts on offer here today — Rest to see a new board.</div>`;
  bEl.querySelectorAll("[data-accept]").forEach(b => b.onclick = () => acceptJob(+b.dataset.accept));
}

/* v2.5 — Empire tab: the current port's business, plus a roll-call of everything owned */
function empireStatLine(p){
  const o = propOwned(p.id), d = p.business;
  if(!o || !d) return "";
  if(d.kind === "production") return `${o.stored}/${propCap(p.id, o.level)} ${goodName(d.good)} stored · +${propRate(p.id, o.level)}/day`;
  if(d.kind === "shipyard")   return `−${Math.round(SHIPYARD_DISCOUNT[o.level] * 100)}% Repairs/Shipwright/Cannons at ${p.name}`;
  if(d.kind === "trade")      return `+${Math.round(TRADEHOUSE_BONUS[o.level] * 100)}% gold selling at ${p.name}`;
  if(d.kind === "storage")    return `${storedCargo()}/${warehouseCap(p.id)} cargo stockpiled`;
  return "";
}
function renderEmpire(port){
  const def = port.business;
  const own = propOwned(port.id);
  const hereEl = document.getElementById("empireHere");

  if(!def){
    hereEl.innerHTML = `<div class="job-empty">No business opportunity at ${port.name}.</div>`;
  }else{
    const nextCost = propUpgradeCost(own ? own.level : 0);
    const maxed = own && own.level >= PROP_MAX_LEVEL;
    let lines = `<span class="job-sub">${def.desc}</span>`;
    if(!own){
      lines += `<span class="job-sub">Not owned · buy-in <b>${fmt(nextCost)}</b> gold for Level 1</span>`;
    }else{
      lines += `<span class="job-sub">Level <b>${own.level}</b> / ${PROP_MAX_LEVEL} · ${empireStatLine(port)}</span>`;
    }
    let btns = "";
    if(!maxed) btns += `<button class="btn gold" id="empireBuyBtn">${!own ? "Buy — " : "Upgrade — "}${fmt(nextCost)}</button>`;
    else btns += `<span class="muted">Fully developed</span>`;
    if(own && def.kind === "production") btns += `<button class="btn" id="empireCollectBtn" ${own.stored > 0 ? "" : "disabled"}>Collect${own.stored > 0 ? " " + own.stored : ""}</button>`;
    if(own && def.kind === "storage"){
      btns += `<button class="btn" id="empireStoreBtn">Store Cargo</button>`;
      btns += `<button class="btn" id="empireRetrieveBtn">Retrieve All</button>`;
    }
    hereEl.innerHTML = `<div class="job-card active" style="align-items:flex-start;">
      <div class="job-main">
        <span class="job-title">${def.icon} ${def.name} <span class="muted">— ${port.name}</span></span>
        ${lines}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;">${btns}</div>
    </div>`;
    const buyBtn = document.getElementById("empireBuyBtn");
    if(buyBtn){ buyBtn.disabled = G.gold < nextCost; buyBtn.onclick = () => buyOrUpgradeProperty(port.id); }
    const colBtn = document.getElementById("empireCollectBtn");
    if(colBtn) colBtn.onclick = () => collectProperty(port.id);
    const stoBtn = document.getElementById("empireStoreBtn");
    if(stoBtn) stoBtn.onclick = () => warehouseStoreAll();
    const retBtn = document.getElementById("empireRetrieveBtn");
    if(retBtn) retBtn.onclick = () => warehouseRetrieveAll();
  }

  const owned = PORTS.filter(p => propOwned(p.id));
  document.getElementById("empireList").innerHTML = owned.length ? owned.map(p => {
    const o = propOwned(p.id), d = p.business;
    return `<div class="job-card">
      <div class="job-main">
        <span class="job-title">${d.icon} ${d.name} <span class="muted">— ${p.name}</span></span>
        <span class="job-sub">Level ${o.level}/${PROP_MAX_LEVEL} · ${empireStatLine(p)}</span>
      </div>
    </div>`;
  }).join("") : `<div class="job-empty">You own no properties yet — buy your first at the port you're visiting.</div>`;

  // v3.2 — "Investment opportunities": every business you don't yet own, across
  // every port, so the Empire tab tells you where to go instead of only ever
  // showing what you already have.
  const unowned = PORTS.filter(p => p.business && !propOwned(p.id));
  document.getElementById("empireOpportunities").innerHTML = unowned.length ? unowned.map(p => {
    const d = p.business, here = p.id === port.id;
    return `<div class="job-card${here ? " active" : ""}">
      <div class="job-main">
        <span class="job-title">${d.icon} ${d.name} <span class="muted">— ${p.name}${here ? " (here)" : ""}</span></span>
        <span class="job-sub">${d.desc}</span>
        <span class="job-sub">Buy-in <b>${fmt(propUpgradeCost(0))}</b> gold for Level 1</span>
      </div>
    </div>`;
  }).join("") : `<div class="job-empty">You've bought into every business opportunity in the isles.</div>`;

  // ---- v2.6 — empire identity badge ----
  const idTitle = empireIdentity();
  // ---- v2.9 — maritime rank ----
  const rIdx = empireRankIndex(), rank = RANK_DEFS[rIdx], next = RANK_DEFS[rIdx + 1];
  const rankLine = next
    ? `Maritime Rank: <span style="color:#fff;">${rank.name.toUpperCase()}</span> &nbsp;·&nbsp; ${fmt(empireScore())} / ${fmt(next.score)} toward ${next.name}`
    : `Maritime Rank: <span style="color:#fff;">${rank.name.toUpperCase()}</span> &nbsp;·&nbsp; the highest honour the isles give`;
  document.getElementById("empireIdentity").innerHTML =
    `<div class="empire-badge">🎖️ ${rankLine}</div>` +
    (idTitle ? `<div class="empire-badge">🏆 Known across the isles as: <span style="color:#fff;">${idTitle}</span></div>` : "");

  // ---- v2.6 — trade influence per commodity ----
  const rows = MONOPOLY_GOODS.map(gid => ({ gid, pct: tradeInfluence(gid) })).sort((a, b) => b.pct - a.pct);
  document.getElementById("empireInfluence").innerHTML = rows.map(r => {
    const tier = influenceTierName(r.pct);
    const bonusPct = Math.round(influenceBonus(r.gid) * 100);
    const extra = r.pct >= 60 ? ` · −${Math.round((1 - influencePressureMult(r.gid)) * 100)}% price swings` : "";
    return `<div class="job-card">
      <div class="job-main">
        <div class="inf-row">
          <span class="inf-name">${goodName(r.gid)}</span>
          <span class="inf-bar"><i style="transform:scaleX(${clamp(r.pct / 100, 0, 1)});"></i></span>
          <span class="inf-pct">${r.pct}%</span>
        </div>
        <span class="job-sub">${tier}${bonusPct > 0 ? ` · ±${bonusPct}% buy/sell${extra}` : ""}</span>
      </div>
    </div>`;
  }).join("");
}

/* v2.8 — Fleet tab: current flagship banner, then every legendary hull with its
   real stats, passive, weakness and acquisition gate. */
function fleetStatRow(label, mult, higherIsBetter){
  const pct = Math.round((mult - 1) * 100);
  const good = higherIsBetter ? pct > 0 : pct < 0;
  const bad  = higherIsBetter ? pct < 0 : pct > 0;
  const cls = pct === 0 ? "" : (good ? "up" : bad ? "down" : "");
  return `<span class="mk-delta ${cls}">${label} ${pct >= 0 ? "+" : ""}${pct}%</span>`;
}
function renderFleet(){
  if(!G.legendary) G.legendary = freshLegendary();
  const L = G.legendary;
  const activeDef = activeLegendaryDef();
  const disc = Math.round((1 - rankLegendaryDiscount()) * 100);
  document.getElementById("fleetCurrent").innerHTML = `<div class="job-card active" style="align-items:flex-start;">
    <div class="job-main">
      <span class="job-title">${activeDef ? activeDef.icon + " " + activeDef.name : "⛵ Your Original Ship"} <span class="muted">— current flagship</span></span>
      <span class="job-sub">Hull ${G.hpMax} · Cargo ${G.cargoMax}${activeDef ? " · " + activeDef.passiveName + ": " + activeDef.passiveDesc : ""}</span>
      ${disc > 0 ? `<span class="job-sub">Maritime Rank: ${empireRank().name} — commissions ${disc}% off</span>` : ""}
    </div>
    ${L.active !== null ? `<button class="btn" id="fleetStockBtn">Sail the Original Ship</button>` : ""}
  </div>`;
  const stockBtn = document.getElementById("fleetStockBtn");
  if(stockBtn) stockBtn.onclick = () => setFlagship(null);

  document.getElementById("fleetList").innerHTML = LEGENDARY_SHIPS.map(def => {
    const owned = L.owned.includes(def.key);
    const isActive = L.active === def.key;
    const gate = legendaryUnlockStatus(def);
    const trueHp = G.hpMax - (L.activeBonus.hp || 0), trueCargo = G.cargoMax - (L.activeBonus.cargo || 0);
    const prevHp = Math.round(trueHp * def.hullMult), prevCargo = Math.round(trueCargo * def.cargoMult);
    let btn;
    const price = legendaryPrice(def);
    const discounted = price < def.cost;
    if(isActive) btn = `<span class="muted">Flagship ✓</span>`;
    else if(owned) btn = `<button class="btn" data-fleet-switch="${def.key}">Set Active</button>`;
    else if(!gate.ok) btn = `<span class="muted" title="${gate.reason}">🔒 Locked</span>`;
    else btn = `<button class="btn gold" data-fleet-buy="${def.key}" ${G.gold < price ? "disabled" : ""}>Commission — ${fmt(price)}${discounted ? ` <s class="muted">${fmt(def.cost)}</s>` : ""}</button>`;
    return `<div class="job-card" style="align-items:flex-start;">
      <div class="job-main">
        <span class="job-title">${def.icon} ${def.name}${owned ? ' <span class="sw-lv">owned</span>' : ""}</span>
        <span class="job-sub">${def.tagline}</span>
        <span class="job-sub">Hull ${prevHp} · Cargo ${prevCargo} ·
          ${fleetStatRow("Spd", def.speedMult, true)} ${fleetStatRow("Accel", def.accelMult, true)} ${fleetStatRow("Turn", def.turnMult, true)}
          ${fleetStatRow("Combat", 1 + def.combatBonus / 25, true)}</span>
        <span class="job-sub"><b>${def.passiveName}:</b> ${def.passiveDesc}</span>
        <span class="job-sub down">Weakness: ${def.weakness}</span>
        ${!owned && !gate.ok ? `<span class="job-sub down">${gate.reason}</span>` : ""}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:stretch;">${btn}</div>
    </div>`;
  }).join("");
  document.querySelectorAll("#fleetList [data-fleet-buy]").forEach(b => b.onclick = () => buyLegendary(b.dataset.fleetBuy));
  document.querySelectorAll("#fleetList [data-fleet-switch]").forEach(b => b.onclick = () => setFlagship(b.dataset.fleetSwitch));
}

function svcState(cardId, btnId, disabled){
  document.getElementById(btnId).disabled = disabled;
  document.getElementById(cardId).classList.toggle("off", disabled);
}

function renderHoldPanel(port){
  const carried = GOODS.filter(g => G.cargo[g.id] > 0);
  const list = document.getElementById("holdList");
  const empty = document.getElementById("holdEmpty");
  const sum = document.getElementById("holdSummary");
  const contractRows = (G.jobs || []).filter(j => j.type !== "supply").map(j =>
    `<div class="hold-row">
      <div class="hd-name job"><b>📋 Contract cargo</b> — ${j.qty} ${j.type === "passenger" ? "berths" : "crates"} for ${portById(j.to).name}</div>
      <div class="hd-nums"><span><i>Reward on delivery</i><b>${fmt(j.reward)}</b></span></div>
    </div>`).join("");
  if(carried.length === 0 && !contractRows){
    list.innerHTML = "";
    empty.hidden = false;
    sum.hidden = true;
    return;
  }
  empty.hidden = true;
  let totVal = 0, totPL = 0;
  list.innerHTML = contractRows + carried.map(g => {
    const qty = G.cargo[g.id];
    const avg = Math.round(G.avg[g.id]);
    const price = priceAt(port.id, g.id);
    const val = qty * price;
    const pl  = Math.round((price - avg) * qty);
    totVal += val; totPL += pl;
    const cls = pl >= 0 ? "up" : "down";
    return `<div class="hold-row">
      <div class="hd-name">${g.name}${g.illegal ? ' <span class="contra-tag">⚠</span>' : ''}</div>
      <div class="hd-nums">
        <span><i>Carrying</i><b>${qty}</b></span>
        <span><i>Avg paid</i><b>${fmt(avg)}</b></span>
        <span><i>Value here</i><b>${fmt(val)}</b></span>
        <span class="hd-pl ${cls}"><i>P/L here</i><b>${pl >= 0 ? "+" : "−"}${fmt(Math.abs(pl))}</b></span>
      </div>
      <button class="btn sell" data-hsell="${g.id}">Sell</button>
    </div>`;
  }).join("");
  list.querySelectorAll("[data-hsell]").forEach(b => b.onclick = () => sell(port.id, b.dataset.hsell));
  if(carried.length === 0){ sum.hidden = true; return; }
  sum.hidden = false;
  const plCls = totPL >= 0 ? "up" : "down";
  sum.innerHTML = `Hold value here: ${fmt(totVal)} gold &nbsp;·&nbsp; ` +
    `Unrealised P/L: <span class="${plCls}">${totPL >= 0 ? "+" : "−"}${fmt(Math.abs(totPL))}</span>`;
}

/* ---------- Toast / notification layer (v1.4 — always above every modal) ---------- */
let _toasts = [];
function toast(msg, opts){
  opts = opts || {};
  const layer = document.getElementById("toastLayer");
  if(!layer){ console.log("toast:", msg); return; }
  const el = document.createElement("div");
  el.className = "toast-item" + (opts.kind ? " " + opts.kind : "");
  el.textContent = msg;
  layer.appendChild(el);
  requestAnimationFrame(()=>el.classList.add("show"));
  const rec = { el };
  rec.t = setTimeout(()=>{
    el.classList.remove("show");
    setTimeout(()=>{ el.remove(); _toasts = _toasts.filter(x=>x!==rec); }, 280);
  }, opts.life || 2800);
  _toasts.push(rec);
  while(_toasts.length > 4){
    const old = _toasts.shift();
    clearTimeout(old.t);
    old.el.classList.remove("show");
    setTimeout(()=>old.el.remove(), 280);
  }
}

/* ---------- Main loop ---------- */
let loopRunning = false;     // guards against ever starting two rAF chains at once
function loop(now){
  if(paused){ loopRunning = false; return; }
  let dt = (now - lastT) / 1000;
  lastT = now;
  if(dt > 0.05) dt = 0.05;   // clamp big gaps (tab switch)

  updateShip(dt);
  if(paused){ loopRunning = false; return; }   // updateShip may have triggered a Navy inspection
  updateNavy(dt);
  if(paused){ loopRunning = false; return; }   // updateNavy may have triggered a patrol interception
  updateCamera();

  // age wake
  for(let i=wake.length-1;i>=0;i--){
    wake[i].life -= dt * 0.8;
    wake[i].r += dt * 6;
    if(wake[i].life <= 0) wake.splice(i,1);
  }

  draw();
  renderDash();

  requestAnimationFrame(loop);
}

/* ---------- Resize ---------- */
function resize(){
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + "px";
  canvas.style.height = window.innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if(overlayShown("mapModal")) renderMap();
}

/* =========================================================================
   Overlay manager — the single place every modal opens & closes through.
   Keeps a stack, freezes the game while ANY overlay is up, and resumes only
   once the last one is gone. Bespoke content logic (trade window, navy
   inspection, …) lives in its own function and just registers via these.
   ========================================================================= */
const OVERLAY_LOCKED = new Set(["tradeModal", "navyModal", "captainModal", "startModal"]);
let overlayStack = [];
const overlayEl = id => document.getElementById(id);
function anyOverlay(){ return overlayStack.length > 0; }
function overlayShown(id){ return overlayStack.includes(id); }
function topOverlay(){ return overlayStack[overlayStack.length - 1] || null; }

function overlayOpen(id){
  const el = overlayEl(id);
  if(!el) return;
  el.classList.add("show");
  if(overlayStack.includes(id)) return;            // never register a duplicate
  if(overlayStack.length === 0) paused = true;     // first overlay freezes the world
  overlayStack.push(id);
}
/* remove from the stack + hide, but DO NOT resume the game */
function overlayDrop(id){
  const el = overlayEl(id);
  if(el) el.classList.remove("show");
  overlayStack = overlayStack.filter(x => x !== id);
}
/* remove + hide, and resume the game if nothing is left on top */
function overlayClose(id){
  overlayDrop(id);
  if(overlayStack.length === 0) resumeFromOverlays();
}
function overlayCloseAll(){
  overlayStack.slice().forEach(id => { const el = overlayEl(id); if(el) el.classList.remove("show"); });
  overlayStack = [];
}
function resumeFromOverlays(){
  if(anyOverlay()) return;                         // something is still up — stay frozen
  overlayEl("pauseBadge").classList.remove("show");
  beginPlay();
}
/* backdrop click / ESC — dismiss the current top overlay (locked ones ignore it) */
function dismissTopOverlay(){
  const id = topOverlay();
  if(!id || OVERLAY_LOCKED.has(id)) return;
  if(id === "mapModal")     { closeMap();       return; }
  if(id === "pauseModal")   { closePauseMenu(); return; }
  if(id === "auctionModal"){ closeAuction();    return; }
  overlayClose(id);
}


/* ---------- Wiring ---------- */
/* v3.2 — keyboard tab paging for the two tabbed modals. A/D and Left/Right
   cycle through whichever modal is on top; this is generic paging, not a
   dedicated shortcut for any one tab (Help and Contracts still only open
   through their buttons, per design). */
const TRADE_TAB_ORDER = ["mkt","svc","job","empire","fleet","hold"];
const MAP_TAB_ORDER = ["map","market","ports"];
function cycleTab(order, cur, dir, setter){
  const i = order.indexOf(cur);
  setter(order[(i + dir + order.length) % order.length]);
}
function wire(){
  addEventListener("keydown", e=>{
    const k = e.key.toLowerCase();
    const typing = /^(input|textarea)$/i.test(e.target && e.target.tagName || "");
    if(["arrowup","arrowdown","arrowleft","arrowright"," "].includes(k) && !typing) e.preventDefault();
    if(k === "e" && !e.repeat && !typing) tryDock();
    if(k === " " && !e.repeat && !typing && topOverlay() === "tradeModal") sellAllHere();
    if(k === "enter" && !e.repeat && !typing && topOverlay() === "tradeModal") closeTrade();
    if(k === "m" && !e.repeat && !typing) toggleMap();
    if(k === "h" && !e.repeat && !typing) toggleHUD();
    if((k === "a" || k === "arrowleft" || k === "d" || k === "arrowright") && !e.repeat && !typing){
      const dir = (k === "a" || k === "arrowleft") ? -1 : 1;
      const top = topOverlay();
      if(top === "tradeModal") cycleTab(TRADE_TAB_ORDER, tradeTab, dir, setTradeTab);
      else if(top === "mapModal") cycleTab(MAP_TAB_ORDER, mapTab, dir, setMapTab);
    }
    if(k === "escape" && !e.repeat && !typing){
      if(anyOverlay()) dismissTopOverlay();   // closes the top-most closable overlay (locked ones ignore)
      else openPauseMenu();
    }
    keys[k] = true;
  });
  addEventListener("keyup", e=>{ keys[e.key.toLowerCase()] = false; });
  addEventListener("blur", ()=>{ keys = {}; });
  addEventListener("resize", resize);

  // mini-map port tooltips
  mini.addEventListener("mousemove", onMiniHover);
  mini.addEventListener("mouseleave", ()=>miniTipEl.classList.remove("show"));

  // every [data-close] button and every backdrop click go through the overlay manager
  document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>overlayClose(b.dataset.close));
  document.querySelectorAll(".modal-back").forEach(mb=>{
    mb.addEventListener("click", e=>{ if(e.target === mb) dismissTopOverlay(); });
  });

  document.getElementById("mapBtn").onclick = openMap;
  document.getElementById("mapCloseBtn").onclick = closeMap;
  document.querySelectorAll("#mapTabs button").forEach(b=>{
    b.onclick = ()=>setMapTab(b.dataset.mtab);
  });

  document.getElementById("resumeBtn").onclick = closePauseMenu;
  document.getElementById("quickSaveBtn").onclick = quickSave;
  document.getElementById("pauseMenuBtn").onclick = ()=>{
    overlayDrop("pauseModal");
    document.getElementById("pauseBadge").classList.remove("show");
    document.getElementById("pauseSaveMsg").classList.remove("show");
    openStartMenu("");
  };

  document.getElementById("helpBtn").onclick = openHelp;
  document.getElementById("startHelpBtn").onclick = openHelp;
  document.getElementById("pauseHelpBtn").onclick = openHelp;
  document.querySelectorAll("#helpTabs button").forEach(b=>{
    b.onclick = ()=>renderHelp(b.dataset.htab);
  });
  document.getElementById("uiToggle").onclick = toggleHUD;
  document.getElementById("newBtn").onclick  = ()=>
    openStartMenu("Start a fresh voyage below, or hit Continue Voyage to keep your current run.");

  // ---- Settings hub ----
  document.getElementById("settingsBtn").onclick = openSettings;
  document.getElementById("setSaveBtn").onclick  = ()=>{ saveLocal(); toast("✓ Voyage saved to this browser", {kind:"save"}); };
  document.getElementById("setIoBtn").onclick    = ()=>{ refreshIoModal(); overlayOpen("ioModal"); };
  document.getElementById("setLogBtn").onclick   = ()=>{ renderChangelog();  overlayOpen("logModal"); };
  document.getElementById("setLbBtn").onclick    = openLeaderboard;
  document.getElementById("setStatsBtn").onclick   = ()=>ensureCaptain(openStats);
  document.getElementById("setEmpireBtn").onclick  = ()=>ensureCaptain(openEmpireDash);
  document.getElementById("setProfileBtn").onclick = ()=>ensureCaptain(openMyProfile);
  document.getElementById("setFriendsBtn").onclick = openFriends;
  document.getElementById("setVoyagesBtn").onclick = openVoyages;
  document.getElementById("friendAddBtn").onclick  = friendAddRequest;
  document.getElementById("fcCopyBtn").onclick     = async ()=>{
    const btn = document.getElementById("fcCopyBtn");
    let ok = false;
    try{ await navigator.clipboard.writeText(myFriendCode()); ok = true; }catch(_){}
    btn.textContent = ok ? "Copied ✓" : "Copy failed";
    setTimeout(()=>{ btn.textContent = "📋 Copy"; }, 1600);
  };
  document.getElementById("startSlotsBtn").onclick = openVoyages;

  document.getElementById("captainOkBtn").onclick = confirmCaptain;
  document.getElementById("captainInput").addEventListener("keydown", e=>{
    if(e.key === "Enter"){ e.preventDefault(); confirmCaptain(); }
  });
  document.getElementById("lbAddBtn").onclick = addRivalFromCode;

  document.getElementById("setSailBtn").onclick = closeTrade;

  document.querySelectorAll("#tmTabs button").forEach(b=>{
    b.onclick = ()=>setTradeTab(b.dataset.tab);
  });

  document.querySelectorAll("#qtyToggle button").forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll("#qtyToggle button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      qtyMode = b.dataset.q;
    };
  });
  document.querySelectorAll("#svcQty button").forEach(b=>{
    b.onclick = ()=>{
      document.querySelectorAll("#svcQty button").forEach(x=>x.classList.remove("on"));
      b.classList.add("on");
      svcQtyMode = b.dataset.q;
      if(currentPort) renderTrade(currentPort);
    };
  });

  document.getElementById("repairBtn").onclick = ()=>repairHull(currentPort.id);
  document.getElementById("holdBtn").onclick   = ()=>expandHold();
  document.getElementById("restBtn").onclick   = ()=>restAdvance();
  document.getElementById("mktRestBtn").onclick = ()=>restFromMarket();
  document.getElementById("insuranceBtn").onclick = ()=>buyInsurance();
  document.getElementById("collectHoldingsBtn").onclick = ()=>collectPassive();
  document.getElementById("buyVentureBtn").onclick = ()=>buyVenture();
  document.getElementById("falseHoldBtn").onclick = ()=>buyFalseHold();
  document.getElementById("payoffBtn").onclick    = ()=>payOffOfficials();
  document.getElementById("falseFlagBtn").onclick = ()=>buyFalseColours();

  document.getElementById("navyBribeBtn").onclick = ()=>navyBribe();
  document.getElementById("navyHideBtn").onclick  = ()=>navyHide();
  document.getElementById("navyFightBtn").onclick = ()=>navyFight();
  document.getElementById("navyFleeBtn").onclick  = ()=>navyFlee();

  document.getElementById("aucBidBtn").onclick   = ()=>auctionPlaceBid();
  document.getElementById("aucWalkBtn").onclick  = ()=>auctionWalkAway();
  document.getElementById("aucCloseBtn").onclick = ()=>closeAuction();

  // ---- Export / Import (Friend Code) ----
  document.getElementById("copyBtn").onclick = async ()=>{
    const box = document.getElementById("exportBox");
    const btn = document.getElementById("copyBtn");
    let ok = false;
    try{ await navigator.clipboard.writeText(box.value); ok = true; }
    catch(_){
      box.focus(); box.select();
      try{ ok = !!(document.execCommand && document.execCommand("copy")); }catch(__){}
    }
    btn.textContent = ok ? "Copied ✓" : "Select all, then Ctrl+C";
    setTimeout(()=>{ btn.textContent = "📋 Copy Friend Code"; }, 1800);
    if(ok) toast("Friend code copied to clipboard.");
  };
  document.getElementById("downloadBtn").onclick = ()=>{
    const blob = new Blob([document.getElementById("exportBox").value], {type:"text/plain"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `salt-sovereigns-${(G.captain||"captain").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-day${G.day}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 800);
  };
  document.getElementById("importBtn").onclick = ()=>{
    const raw = document.getElementById("importBox").value.trim();
    const msg = document.getElementById("importMsg");
    if(!raw){ msg.textContent = "Paste a friend code first."; return; }
    let next;
    try{ next = fromSaveCode(raw); }
    catch(e){ msg.textContent = "That doesn't look like a valid friend code."; return; }
    try{ localStorage.setItem(SAVE_KEY + "_prev", localStorage.getItem(SAVE_KEY) || ""); }catch(_){}
    G = next;
    snapshotPrices();
    syncNavy();
    rebuildWorldCaches();
    saveLocal();
    overlayCloseAll();
    toast(`Friend code loaded — welcome aboard, ${G.captain || "captain"}.`);
    beginPlay();
  };

  // ---- Start / New Game ----
  document.getElementById("continueBtn").onclick = ()=>overlayClose("startModal");
  document.getElementById("startNewBtn").onclick = ()=>{
    clearLocal();
    newGame();
    rebuildWorldCaches();
    resetBoarding();
    refreshContinueCard(false);
    toast("A fresh ship and an empty purse. Good luck.");
    overlayClose("startModal");   // -> resume -> beginPlay -> captain-name gate
  };

  addEventListener("beforeunload", ()=>{ try{ saveLocal(); }catch(_){} });
}

/* v1.5 — the Continue card: show exactly which voyage is about to be resumed */
function refreshContinueCard(hasSave){
  const card = document.getElementById("continueCard");
  const btn  = document.getElementById("continueBtn");
  if(!hasSave || !G){ card.style.display = "none"; btn.style.display = "none"; return; }
  btn.style.display = "";
  const used = totalCargo();
  card.style.display = "";
  card.innerHTML =
    `<b style="color:#ffce85;">CONTINUE VOYAGE</b><br>` +
    `Captain <b>${escHtml(G.captain || "Unnamed")}</b> &nbsp;·&nbsp; Maritime Rank: <b style="color:#ffce85;">${empireRank().name.toUpperCase()}</b><br>` +
    `Day ${G.day} &nbsp;·&nbsp; near ${escHtml(nearestPort().port.name)}<br>` +
    `Gold ${fmt(G.gold)} &nbsp;·&nbsp; Lifetime ${fmt(G.lifetimeEarnings || 0)} &nbsp;·&nbsp; Net worth ${fmt(netWorth())}<br>` +
    `Playtime ${fmtPlay(G.playSecs)} &nbsp;·&nbsp; Cargo ${used}/${G.cargoMax} &nbsp;·&nbsp; ` +
    `Wanted ${(G.wanted||0) > 0 ? "★".repeat(G.wanted) : "clean"}`;
}

/* opens the title / help screen (Continue Voyage · New Game live inside it) */
function openStartMenu(msg){
  saveLocal();
  document.getElementById("startMsg").textContent = msg || "";
  refreshContinueCard(true);
  overlayOpen("startModal");
}
function openSettings(){
  if(anyOverlay()) return;
  document.getElementById("setVer").textContent =
    "Salt & Sovereigns · Build " + (CHANGELOG[0] ? CHANGELOG[0].version : "");
  overlayOpen("settingsModal");
}
function refreshIoModal(){
  document.getElementById("exportBox").value = toSaveCode();
  document.getElementById("importBox").value = "";
  document.getElementById("importMsg").textContent = "";
  document.getElementById("copyBtn").textContent = "📋 Copy Friend Code";
}

function beginPlay(){
  if(anyOverlay()) return;                    // a modal is still up — stay frozen
  if(!G.captain || !G.captain.trim()){ ensureCaptain(beginPlay); return; }
  if(!G.friendCode) G.friendCode = genFriendCode(G.captain);   // v1.8 — lock in the friend code
  paused = false;
  resetBoarding();
  lastT = performance.now();
  cam.x = clamp(G.ship.x - window.innerWidth/2, 0, Math.max(0, WORLD.w - window.innerWidth));
  cam.y = clamp(G.ship.y - window.innerHeight/2, 0, Math.max(0, WORLD.h - window.innerHeight));
  renderDash();
  if(!loopRunning){ loopRunning = true; requestAnimationFrame(loop); }
}

/* ---------- Boot ---------- */
function boot(){
  canvas = document.getElementById("game");
  ctx = canvas.getContext("2d");
  mini = document.getElementById("minimap");
  mctx = mini.getContext("2d");
  mapCv = document.getElementById("mapCanvas");
  mapCtx = mapCv.getContext("2d");
  hintEl = document.getElementById("hint");
  miniTipEl = document.getElementById("miniTip");
  resize();
  wire();

  const loaded = loadLocal();
  if(loaded){
    G = loaded;
    snapshotPrices();
    document.getElementById("startMsg").textContent = "";
    refreshContinueCard(true);
  }else{
    newGame();
    refreshContinueCard(false);
  }
  syncNavy();                 // rebuild the Navy patrol fleet to match the wanted level
  buildPortSprites();         // static port art — render once
  rebuildWorldCaches();       // reef polygons + the mini-map's static layer

  // drop the friend-code instruction into every callout slot from one source of truth
  document.querySelectorAll(".friend-slot").forEach(el => { el.innerHTML = FRIEND_CODE_HTML; });

  renderDash();
  try{ setHUDHidden(localStorage.getItem("ss_hud_hidden") === "1"); }catch(_){}
  _playLast = performance.now();
  if(!playtimeTimer) playtimeTimer = setInterval(tickPlaytime, 1000);   // one live-playtime clock
  updateCamera(); draw();     // one frozen frame behind the start modal
  overlayOpen("startModal");
}
let playtimeTimer = null;

boot();
