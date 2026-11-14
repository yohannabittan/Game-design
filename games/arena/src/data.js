// Arena: The data tables: the gauntlet, story lines, the deck, champions, body parts, zones, poses. It imports only TUNING, and may be read while modules load.
// Split from game.js by tools/arena-split.mjs (ADR-0024). Only tuning.js and data.js may be read while modules load.

import { TUNING } from './tuning.js';

// ====== DATA TABLES: the gauntlet, story lines, the upgrade deck, body parts, zones and poses ======
// The gauntlet: what each bout may roll (size bands with their weights, armour sets). The fifth is the named champion. His stat points are TUNING.foeStats.
// The ramp: bout 1 is a sparring partner (no feints, no memory, no counters, tells x tell); feints from bout 2, memory from bout 3. A Giant is rare before bout 3.
export const GAUNTLET = [
  { sizes: [['runt', 2], ['lean', 3], ['medium', 3]], armour: ['light'], spar: true, tell: 1.4 },
  { sizes: [['runt', 1.5], ['lean', 3], ['medium', 3], ['big', 1.5], ['giant', 0.3]], armour: ['light', 'medium'], feints: true, counters: true },
  { sizes: [['runt', 1], ['lean', 2], ['medium', 3], ['big', 2.5], ['giant', 1]], armour: ['medium'], feints: true, memory: true, counters: true },
  { sizes: [['runt', 1.5], ['lean', 2], ['medium', 2.5], ['big', 2.5], ['giant', 1.5]], armour: ['medium', 'heavy'], feints: true, memory: true, counters: true },
  { sizes: [['lean', 1.5], ['medium', 2.5], ['big', 3], ['giant', 2]], armour: ['heavy'], champion: true, feints: true, memory: true, counters: true },
];
// his profile's name and its line on his intro card (the shares are TUNING.profiles)
export const PROFILES = {
  brute: { name: 'Brute', line: 'hits hard, never tires, slow feet.' },
  duelist: { name: 'Duelist', line: 'quick hands, quick feet.' },
  glass: { name: 'Glass cannon', line: 'hits hard, tires fast.' },
  tank: { name: 'Tank', line: 'soaks blows, slow to start.' },
  balanced: { name: 'Balanced', line: 'no easy opening.' },
};
export const NAMES = ['Crixus', 'Priscus', 'Verus', 'Celadus', 'Triumphus', 'Tetraites', 'Spiculus', 'Attilius', 'Oenomaus', 'Gannicus', 'Pugnax', 'Calamus', 'Asteropaeus'];
const CHAMPIONS = ['Flamma the Unbroken', 'Marcus the Red', 'Varro of Capua', 'Aurelius the Golden'];
// The later arenas' champions, each tied to your reason in his own words: the tie on his card and the line he says. The Twins are one pairs bout,
// Castor first and Pollux waiting.
export const NEW_CHAMPS = {
  twins: { name: 'Castor', pair: 'Pollux', title: 'Castor and Pollux, the Twins',
    tie: { revenge: 'Their torches lit your village.', debt: "The moneylender's sons. They collect in pairs.", freedom: 'Freed together. They fight to stay that way.', glory: "Pompeii's darlings, both of them.", promise: "Your sister serves at the Twins' table." },
    line: { revenge: 'One of us lit the fire. Guess which.', debt: 'Two of us, one debt. Pay twice.', freedom: 'Free men fight in pairs. You fight alone.', glory: 'They came to see twins. Not you.', promise: 'She pours for both of us. Twice the work.' } },
  hermes: { name: 'Hermes the Swift',
    tie: { revenge: 'He ran the torch from roof to roof.', debt: "He runs the moneylender's errands.", freedom: 'He ran his way free. Nobody catches him.', glory: 'The fastest blade in Pompeii.', promise: 'Your sister runs his errands now.' },
    line: { revenge: 'I was gone before the roofs fell.', debt: 'I collect. Quickly.', freedom: "You can't win freedom you can't catch.", glory: 'Blink, and you miss your own fall.', promise: 'She runs for me now. Can you catch me?' } },
  // (Aquila fights with the gladius, and at half health draws a second one, step 18)
  aquila: { name: "Aquila, the Emperor's Blade", weapon: 'gladius',
    tie: { revenge: "He carried the Emperor's torch.", debt: "The Emperor's purse. Your debt is in it.", freedom: "He holds the wooden sword, by the Emperor's leave.", glory: "Rome's own champion.", promise: "Your sister serves in the Emperor's house." },
    line: { revenge: 'The Emperor ordered it. I obeyed.', debt: 'Your debt bought my armour.', freedom: 'The wooden sword is mine to give. I will not.', glory: 'Rome has one name. Mine.', promise: 'Only the Emperor frees her. Not you.' } },
  // the Colosseum: the Beastmaster fights with his lion waiting at the edge (beast: it steps in when his health falls, TUNING.champs); the Huntress's
  // spear also throws a net (weapon: hers whatever the roll)
  carpophorus: { name: 'Carpophorus the Beastmaster', title: 'Carpophorus and his lion', beast: 'lion',
    tie: { revenge: 'He came with the soldiers, and his cages.', debt: "He feeds the moneylender's beasts.", freedom: "A slave once. Now Rome's beasts obey him.", glory: 'Rome loves his lion more than any man.', promise: 'Your sister feeds his lions.' },
    line: { revenge: 'My lion was a cub that night. Look at him now.', debt: 'Your debt feeds my lion. Every day.', freedom: 'I tamed lions to be free. You are no lion.', glory: 'They came for my lion. Not for you.', promise: 'She feeds my lion. He\'s grown fond of her.' } },
  mevia: { name: 'Mevia the Huntress', weapon: 'spear', female: true,
    tie: { revenge: 'She netted the ones who ran from your village.', debt: 'The moneylender sends her after debtors who run.', freedom: 'She hunts runaways for the bounty.', glory: "The Colosseum's favourite huntress.", promise: 'She caught your sister when she ran.' },
    line: { revenge: 'My net caught your village. It will catch you.', debt: 'Debtors run. I bring them back in a net.', freedom: 'Freedom? I bring runaways back for a living.', glory: 'Rome loves a hunt. Tonight, you are the prey.', promise: 'Your sister ran once. My net was faster.' } },
};
// The beasts: each kind's name, the epithets its card rolls from, and what its tells look like, in one line on its card.
export const BEASTS = {
  lion: { name: 'Lion', epithets: ['the Black-Maned', 'of Numidia', 'the Golden', 'of the Atlas', 'the Scarred', 'the Restless'], tell: 'Crouches, then pounces. Lifts a paw, then swipes.' },
  bear: { name: 'Bear', epithets: ['of Dacia', 'the Mountain', 'of the North', 'the Grey-Muzzled', 'the Broad-Backed', 'of Britannia'], tell: 'Rears up, then mauls. Lowers its head, then shoves.' },
};
// a beast's name on its card: "A LION, THE GOLDEN" or "A BEAR OF DACIA"
export const beastTitle = (d) => `A ${d.name}${d.epithet.startsWith('of ') ? ' ' : ', '}${d.epithet}`;
// The ladder: one run is one arena. rows = which gauntlet rows its bouts roll from (the Grand Games skip the sparring partner); champs = its champion pool;
// who = how its champion is named on the next arena's lock. Its numbers are TUNING.arenas.
export const ARENAS = [
  { id: 'pit', name: 'The Pit', short: 'Pit', who: 'Pit', place: 'Capua', twist: 'The tight ring', rows: [0, 1, 2, 3, 4], champs: CHAMPIONS, champLabel: 'Four champions',
    brutus: 'Everyone starts in the sand. Few leave it.' },
  { id: 'city', name: 'The City arena', short: 'City', who: 'City', place: 'Pompeii', twist: 'Two foes, one at a time', rows: [0, 1, 2, 3, 4], champs: ['twins', 'hermes'], champLabel: 'The Twins or Hermes',
    brutus: 'Pompeii likes a show. Give them one.' },
  { id: 'rome', name: 'The Colosseum', short: 'Colosseum', who: 'Colosseum', place: 'Rome', twist: 'Men and beasts', rows: [0, 1, 2, 3, 4], champs: ['carpophorus', 'mevia'], champLabel: 'Carpophorus or Mevia',
    brutus: "Rome. Fifty thousand eyes. Don't blink." },
  // Step 18: the Grand Games are the champions, one from each arena's pool (pools, by bout) and Aquila last; the Pit's is your Pit rival if one waits
  { id: 'games', name: 'The Grand Games', short: 'Games', who: 'Grand Games', place: 'Rome', twist: 'Every champion of Rome', rows: [1, 2, 3, 4], champs: ['aquila'], champLabel: 'Aquila',
    pools: [CHAMPIONS, ['twins', 'hermes'], ['carpophorus', 'mevia'], ['aquila']], firstRival: 'pit',
    brutus: 'The Emperor himself. I never got this far.' },
];
export const ARENA = Object.fromEntries(ARENAS.map((a) => [a.id, a]));
// the champion's tie and line: a later arena's champion has his own, the Pit's four share theirs
export const champTie = (d, r) => (NEW_CHAMPS[d.ck] ? NEW_CHAMPS[d.ck].tie[r] : CHAMP_TIE[r]);
export const champLine = (d, r) => (NEW_CHAMPS[d.ck] ? NEW_CHAMPS[d.ck].line[r] : CHAMP_LINE[r]);

// Your fighter's story. Each origin is one background (its noun), and each background deals its family's start card. Names carry 'f' or 'm' for the epilogue's and the wall's words.
export const ORIGINS = {
  gaul: { text: 'a farmer from Gaul', noun: 'farmer' }, thrace: { text: 'a Thracian soldier', noun: 'soldier' }, numidia: { text: 'a Numidian horseman', noun: 'horseman' },
  capua: { text: 'a baker from Capua', noun: 'baker' }, ostia: { text: 'a sailor from Ostia', noun: 'sailor' }, alexandria: { text: 'a scribe from Alexandria', noun: 'scribe' },
  // the barracks' three (the ludus): a gladiatrix is always a woman (rollMe gives her a woman's name)
  sparta: { text: 'a gladiatrix from Sparta', noun: 'gladiatrix', female: true }, egypt: { text: 'a freed slave from Egypt', noun: 'freed slave' },
  circus: { text: 'a chariot driver from the Circus', noun: 'charioteer' },
};
// A background deals a common of its family as its start card (the scribe's is the Trickster's one common, your own feint). While the Trickster or the
// Showman is shut in the ludus, the scribe and the baker start with a common of START_ALT's family instead.
export const START_FAM = { soldier: 'wall', horseman: 'dancer', farmer: 'brute', sailor: 'blood', baker: 'show', scribe: 'trick', gladiatrix: 'wall', 'freed slave': 'brute', charioteer: 'dancer' };
export const START_ALT = { show: 'brute', trick: 'wall' };
export const MY_NAMES = [['Gaius', 'm'], ['Lucia', 'f'], ['Decimus', 'm'], ['Aurelia', 'f'], ['Brennus', 'm'], ['Tullia', 'f'], ['Nikandros', 'm'], ['Iuba', 'm']];
// a woman's name for a fighter whose origin needs one: the same roll, moved to the women's names
export function herName(pick) { const F = MY_NAMES.filter((n) => n[1] === 'f'); return F[Math.max(0, MY_NAMES.indexOf(pick)) % F.length]; }
const REASON_NAME = { freedom: 'Freedom', debt: 'Debt', revenge: 'Revenge', glory: 'Glory', promise: 'A promise' };
// Old Brutus, the lanista: three lines per reason, and which one he says at each moment (first intro, later intros, the champion's intro, after a fell, the end of a lost run).
const BRUTUS = {
  freedom: { lines: ['Win the wooden sword and you walk out free.', "Free men don't lose to farmers. Get up.", 'One more, and the gate opens.'], first: 0, intro: 0, champ: 2, won: 0, lost: 1 },
  debt: { lines: ['Your family owes me. Every win pays.', "That one's worth a month of bread.", 'Lose, and the debt grows.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
  revenge: { lines: ["He burned your village. He's waiting at the end.", 'Keep your anger for the champion.', 'Not yet. Him last.'], first: 0, intro: 1, champ: 0, won: 2, lost: 1 },
  glory: { lines: ['Rome wants a name. Make it yours.', "Hear them? They're chanting for you.", 'Glory is loud. Be louder.'], first: 0, intro: 2, champ: 0, won: 1, lost: 2 },
  // the shrine's reason (the ludus): a sister held in the champion's house
  promise: { lines: ['You promised her. Keep it.', "She's waiting in his house. Don't make her wait.", 'One more, and you are at his door.'], first: 0, intro: 1, champ: 2, won: 1, lost: 0 },
};
// a promise climbs: Brutus after each fell
export const PROMISE_WON = ["One down. She'll hear of it.", 'Two. His house is closer.', 'Three. Tell her to be ready.', "Next is him. The key's on his belt."];
export const brutus = (me, moment) => { const B = BRUTUS[me.reason]; return B.lines[B[moment]]; };
// his line for your background, said before your second bout
export const BRUTUS_BG = {
  farmer: 'You plough a field one row at a time. Same here.', soldier: 'Fight like you drilled, soldier. Shield first.', horseman: 'Light feet, horseman. Give him nothing to hit.',
  baker: 'Knead him like dough, baker!', sailor: 'Sea legs, sailor. Let him crash on you.', scribe: 'Read him like a scroll.',
  gladiatrix: 'Sparta sent you. Show him why they fear it.', 'freed slave': "You've broken chains before. Break him.", charioteer: 'No horses here, charioteer. Steer him into the wall.',
};
// Step 19: each origin's innate trait, from Brutus's line for it, and each reason's drive, from his reason's line; their numbers are TUNING.origins
// and TUNING.reasons, read when the line is shown
export const pctOf = (k) => Math.round(Math.abs(k) * 100);
export const TRAITS = {
  gaul: { name: 'Ox-Strong', line: () => `stamina recovers ${pctOf(TUNING.origins.gaul.regen - 1)}% faster` },
  thrace: { name: 'Shield Drill', line: () => `blocks wear your shield ${pctOf(1 / TUNING.origins.thrace.every)}% less` },
  numidia: { name: 'Light Feet', line: () => `dodges cost ${pctOf(1 - TUNING.origins.numidia.dodge)}% less stamina` },
  capua: { name: 'Kneading', line: () => `each quick hit adds ${pctOf(TUNING.origins.capua.step)}% to the next, up to ${pctOf(TUNING.origins.capua.max)}%` },
  ostia: { name: 'Sea Legs', line: () => (TUNING.origins.ostia.push === 0.5 ? 'shoves and knockback move you half as far' : `shoves move you ${pctOf(1 - TUNING.origins.ostia.push)}% less`) },
  alexandria: { name: 'Reads the Scroll', line: () => `a feint's tell shows ${pctOf(TUNING.origins.alexandria.sooner)}% sooner` },
  sparta: { name: 'Spartan Guard', line: () => `the perfect-block window is ${pctOf(TUNING.origins.sparta.perfect - 1)}% wider` },
  egypt: { name: 'Broken Chains', line: () => `once a run, a killing blow leaves you on ${TUNING.origins.egypt.hearts} heart${TUNING.origins.egypt.hearts === 1 ? '' : 's'}` },
  circus: { name: 'Steer Him', line: () => `your shoves drive him ${pctOf(TUNING.origins.circus.push - 1)}% further, and the wall costs him more` },
};
export const DRIVES = {
  freedom: { name: 'Nothing to Lose', line: () => `below a quarter of your hearts, your blows do ${pctOf(TUNING.reasons.freedom.dmg - 1)}% more` },
  debt: { name: 'Every Win Pays', line: () => `${pctOf(TUNING.reasons.debt.gold - 1)}% more gold from every bout` },
  revenge: { name: 'Him Last', line: () => `${pctOf(TUNING.reasons.revenge.dmg - 1)}% more damage against the champion and your rival` },
  glory: { name: 'Louder', line: () => `the crowd's favour builds ${pctOf(TUNING.reasons.glory.fav - 1)}% faster` },
  promise: { name: "She's Waiting", line: () => `${TUNING.reasons.promise.heal} extra heart back for each foe felled` },
};
// revenge climbs: his line before each bout, and after each fell
export const REVENGE = {
  intro: ["He burned your village. He's waiting at the end.", null, 'Keep your anger for the champion.', 'Not yet. Him last.', 'There he is. The man with the torch.'],
  won: ["One down. He's still out there.", 'Good. Let it burn in you.', 'Two more. Keep the fire banked.', 'Next is him. Make him remember the village.'],
};
// The champion is tied to your reason: a line on his card, and what he says.
const CHAMP_TIE = { revenge: 'He burned your village.', debt: "He's in the moneylender's pay.", freedom: 'A freed man, back for the money.', glory: "The crowd's darling.", promise: 'Your sister is a slave in his house.' };
const CHAMP_LINE = { revenge: 'I remember the fire. Do you?', debt: "Your family's debt is my purse.", freedom: 'I was free once. Gold brought me back.', glory: 'They will forget you by morning.',
  promise: 'Your sister? She sweeps my floor. Go home.' };
export const denarii = (n) => n.toLocaleString('en-US');
const EPILOGUE = {
  freedom: (n, f) => `${n} walked out a free ${f ? 'woman' : 'man'}, the wooden sword in hand.`,
  debt: (n, f) => `The debt was paid. ${n} went home to ${f ? 'her' : 'his'} family.`,
  revenge: (n) => `The village was avenged. ${n} finally slept.`,
  glory: (n) => `Rome sang the name ${n} for a generation.`,
  promise: (n, f) => `${n} kept the promise. ${f ? 'Her' : 'His'} sister walked out of the champion's house, free.`,
};
// The City's ending, one per reason: a chapter closed, Rome ahead.
const CITY_END = {
  freedom: (n) => `Pompeii roared for ${n}. The wooden sword waits in Rome.`,
  debt: (n) => `Pompeii paid in silver. ${n}'s family ate meat that winter.`,
  revenge: (n) => `In Pompeii, ${n} learned who gave the order: Rome.`,
  glory: (n) => `Pompeii chanted ${n} until dawn. Rome heard it.`,
  promise: (n) => `In Pompeii, ${n} learned where she had been sold: Rome.`,
};
// The Colosseum's ending, one per reason: Rome has seen you, and the Emperor's games are next.
const ROME_END = {
  freedom: (n) => `${n} walked out past the lions' cages. The wooden sword waits at the Emperor's games.`,
  debt: (n) => `The Colosseum paid ${n} in gold. The moneylender counted it twice.`,
  revenge: (n) => `In the Colosseum, ${n} heard the name at last: Aquila, the Emperor's Blade.`,
  glory: (n) => `Fifty thousand voices learned the name ${n}. The Emperor heard it too.`,
  promise: (n) => `${n} saw her at last, among the Emperor's slaves. One more door.`,
};
// The Grand Games end on the Emperor's thumb, always up (step 10): the crowd's band decides how grand the freedom is, and a full meter is your reason's true ending.
const TRUE_END = {
  debt: 'The Emperor pays your debt himself. The moneylender bows.',
  revenge: "Aquila burned your village on the Emperor's order. The Emperor looks away first.",
  freedom: 'The Emperor hands you the wooden sword. You are free.',
  glory: 'Rome chants your name. They will sing it for a hundred years.',
  promise: 'The Emperor frees your sister. She runs to you across the sand.',
};
const THUMB_END = ['Free. Rome will forget you by spring.', 'Free, and the Emperor nods. Rome will sing of you this year.'];
// the crowd's band: 0 low, 1 middling, 2 full (the top third)
export const bandOf = (fav) => { const B = TUNING.crowd.bands, k = fav / TUNING.crowd.max; return k >= B[1] ? 2 : k >= B[0] ? 1 : 0; };
// how a won run ends: the Pit's epilogue, the City's, the Colosseum's, or the Emperor's thumb
export function endingOf(arenaId, me, fav) {
  if (arenaId === 'games') { const b = bandOf(fav); return b === 2 ? TRUE_END[me.reason] : THUMB_END[b]; }
  if (arenaId === 'city') return CITY_END[me.reason](me.name, me.female);
  if (arenaId === 'rome') return ROME_END[me.reason](me.name);
  return EPILOGUE[me.reason](me.name, me.female);
}
export const storyLine = (me) => `${me.name}, ${ORIGINS[me.origin].text}. Fights for: ${REASON_NAME[me.reason]}.`;

// Brutus's ludus (E): five stations, each unlock one tap for its price in fame (TUNING.ludus.price). Until bought, the armoury's weapons are not in the
// purse, and the barracks' origins and the shrine's reason weigh nothing on their wheels (LUDUS_LOCK), and the Trickster's and the Showman's cards are never dealt. The training
// ground's two are the only power. The tailor's are looks: a tap on one you own steps through its styles (TAILOR), then off.
export const LUDUS = [
  { id: 'armoury', name: 'The Armoury', line: 'New weapons for sale before your first bout', brutus: 'Steel is steel. How you hold it is everything.', items: [
    { id: 'trident', name: 'Trident and net', line: 'A new weapon to buy before your first bout. Longest reach, slow. Your first well-timed block each bout nets him and slows him.' },
    { id: 'sica', name: 'The sica', line: 'A new weapon to buy before your first bout. A short curved blade: quick, and its slashes cut deep.' }] },
  { id: 'barracks', name: 'The Barracks', line: 'New fighters and new card families', brutus: 'New blood in the barracks. Make room.', items: [
    { id: 'sparta', name: 'A gladiatrix', line: 'A new fighter on your origin wheel: a Spartan woman. She starts with a Wall card.' },
    { id: 'egypt', name: 'A freed slave', line: 'A new fighter on your origin wheel, from Egypt. Starts with a Brute card.' },
    { id: 'circus', name: 'A chariot driver', line: 'A new fighter on your origin wheel, from the Circus. Starts with a Dancer card.' },
    { id: 'trick', name: 'The Trickster', line: 'New cards in your picks: feints and tricks to fool him.' },
    { id: 'show', name: 'The Showman', line: 'New cards in your picks: win the crowd, and it fights for you.' }] },
  { id: 'training', name: 'The Training Ground', line: 'A card to start with, and a bigger first pick', brutus: 'Sweat here, so you bleed less out there.', items: [
    { id: 'slot', name: 'Start card', line: 'Choose a card you have picked before. Every run starts with it.' },
    { id: 'fourth', name: 'A fourth card', line: 'Your first pick of each run shows 4 cards, not 3.' }] },
  { id: 'shrine', name: 'The Shrine', line: 'A new reason to fight', brutus: 'Every fighter needs a reason. Pick a good one.', items: [
    { id: 'promise', name: 'A promise', line: "A new reason on your reason wheel: free your sister from the champion's house." }] },
  { id: 'tailor', name: 'The Tailor', line: 'Looks only', brutus: 'Look good. Then fight better than you look.', items: [
    { id: 'crest', name: 'A crest', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'plume', name: 'A plume', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'paint', name: 'Shield paint', line: 'Looks only. Tap it once bought to change its style.' },
    { id: 'cloak', name: 'A cloak', line: 'Looks only. Tap it once bought to change its style.' }] },
  // Step 9: a family's scroll opens its new epic and legendary (DECK's `vault` cards); two scrolls open the set of their two families. needs: the
  // Trickster's and the Showman's scrolls wait for their family in the Barracks
  { id: 'vault', name: "Brutus's Vault", line: 'New cards for your picks, a family a scroll', brutus: 'Old scrolls, old tricks. Buy two, and their set comes too.', items: [
    { id: 'vault-wall', fam: 'wall', name: 'Wall scroll', line: 'New cards in your picks: Bulwark (epic) and Phalanx Master (legendary).' }, { id: 'vault-blood', fam: 'blood', name: 'Blood scroll', line: 'New cards in your picks: Bloodletter (epic) and Crimson Tide (legendary).' },
    { id: 'vault-dancer', fam: 'dancer', name: 'Dancer scroll', line: 'New cards in your picks: Shadow Step (epic) and Wind Dancer (legendary).' }, { id: 'vault-brute', fam: 'brute', name: 'Brute scroll', line: 'New cards in your picks: Crusher (epic) and Colossus (legendary).' },
    { id: 'vault-trick', fam: 'trick', needs: 'trick', name: 'Trickster scroll', line: 'New cards in your picks: Smoke and Mirrors (epic) and Grand Deceiver (legendary).' }, { id: 'vault-show', fam: 'show', needs: 'show', name: 'Showman scroll', line: 'New cards in your picks: Gilded Moment (epic) and Idol of Rome (legendary).' }] },
];
export const LUDUS_ITEM = Object.fromEntries(LUDUS.flatMap((s) => s.items.map((q) => [q.id, { ...q, station: s.id }])));
export const LUDUS_LOCK = new Set(['trident', 'sica', 'sparta', 'egypt', 'circus', 'promise']);
// the tailor's styles: [name, colour]
export const TAILOR = { crest: [['Bronze', '#c8963e'], ['Silver', '#d5dce4'], ['Gold', '#ffd24a']], plume: [['Red', '#c8372a'], ['White', '#efe6cf'], ['Black', '#2a2420']],
  paint: [['Wings', '#efe6cf'], ['Bolt', '#ffd24a'], ['Sun', '#f97316']], cloak: [['Red', '#9b2f2f'], ['Blue', '#2f4a8a'], ['Green', '#2f6d3d']] };
// a family the ludus shuts, and the families the war paints belong to; a fighter rolled before the ludus (no `open`) has every family open
const FAM_LOCK = ['trick', 'show'], FIN_FAM = { falseop: 'trick', showstop: 'show' };
export const famOpen = (me, f) => !FAM_LOCK.includes(f) || !me || !me.open || me.open.includes(f);
// a vault card needs its family's scroll (a set both its families'), on the fighter's `open`; a fighter rolled before the ludus has none
const vaultOpen = (me, c) => !c.vault || (!!me && !!me.open && (c.duo || [c.fam]).every((f) => me.open.includes(`vault-${f}`)));
export const cardOpen = (me, c) => vaultOpen(me, c) && (c.duo ? c.duo.every((f) => famOpen(me, f)) : famOpen(me, c.fam === 'fin' ? FIN_FAM[c.id] : c.fam));
// a veteran's scar line, after the champion he felled
export const SCARS = [(c) => `Scarred by ${c}`, (c) => `${c}'s mark on the brow`, (c) => `A scar from ${c}`];

// The deck: six families, each card one rule and one piece of gear (fam; tier = rarity: 0 common, 1 rare, 2 epic, 3 legendary; key = a keystone, the
// legendary that names its price). slot: where the piece is worn (one piece a slot), gear: its name. needs: a card that is useless without your shield or
// your dodge, or your Feint (or a list of them); bans: what a keystone takes away. Finishers are war paint (TUNING.fin) and a duo is a set bonus; neither takes a slot.
// vault: a Step 9 card, dealt once the vault's scroll for its family is bought (a set: both families'); its legendary grows with each card of its family worn.
// short (step 23): what the card does for you in six words or fewer, the line on its face (line is the full rule, on a long press and the "?").
export const FAMS = {
  wall: { name: 'The Wall', col: '#7dd3fc' }, blood: { name: 'Blood', col: '#f87171' }, dancer: { name: 'The Dancer', col: '#86efac' }, brute: { name: 'The Brute', col: '#fbbf24' },
  trick: { name: 'The Trickster', col: '#a78bfa' }, show: { name: 'The Showman', col: '#f472b6' },
  fin: { name: 'War paint', col: '#e879f9' }, rare: { name: 'Lone piece', col: '#c4b99a' },
};
export const SLOT_NAMES = ['helmet', 'shield', 'weapon', 'chest', 'arms', 'legs', 'cloak', 'belt'];
export const DECK = [
  { id: 'riposte', fam: 'wall', tier: 0, slot: 'arms', gear: 'Bronze Bracers', name: 'Riposte', short: 'Timed block stabs back free', line: 'Block right as his blow lands, and you stab back for free.', needs: 'shield' },
  { id: 'shove', fam: 'wall', tier: 0, slot: 'chest', gear: 'Bronze Phalerae', name: 'Shield Shove', short: 'Timed block pushes him back', line: "A block right as it lands shoves him back. Against the wall, he's stunned.", needs: 'shield' },
  { id: 'braced', fam: 'wall', tier: 0, slot: 'helmet', gear: 'Bronze Crest', name: 'Braced', short: 'Every block earns Momentum', line: 'Every block earns Momentum, not just the well-timed ones.', needs: 'shield' },
  { id: 'thorns', fam: 'wall', tier: 2, slot: 'shield', gear: 'Spiked Shield', name: 'Thorns', short: 'Blocks knock his weapon away', line: 'Each block chips his weapon. Three chips and he drops it.', needs: 'shield' },
  { id: 'standfast', fam: 'wall', tier: 1, slot: 'legs', gear: 'Bronze Boots', name: 'Stand Fast', short: 'At your wall, blocks are perfect', line: 'With your back to the wall, every block counts as perfectly timed.', needs: 'shield' },
  { id: 'ironwall', fam: 'wall', tier: 3, key: true, slot: 'shield', gear: 'Tower Shield', name: 'Iron Wall', short: 'Easy blocks open gaps. No dodge.', line: "Twice the time to time a block, and each one opens a gap. You can't dodge.", needs: 'shield', bans: 'dodge' },
  { id: 'serrated', fam: 'blood', tier: 0, slot: 'weapon', gear: 'Saw-toothed Blade', name: 'Serrated Edge', short: 'Gap stabs make him bleed', line: 'A stab into a gap makes him bleed.' },
  { id: 'rend', fam: 'blood', tier: 0, slot: 'arms', gear: 'Barbed Bracers', name: 'Rend', short: 'Cuts bleed more', line: 'A cut where he has no armour makes him bleed more.' },
  { id: 'vein', fam: 'blood', tier: 1, slot: 'helmet', gear: 'Blood Band', name: 'Open Vein', short: 'Bleeding slows his wind-ups', line: 'While he bleeds, his wind-ups are slower and easier to read.' },
  { id: 'bloodlust', fam: 'blood', tier: 1, slot: 'cloak', gear: 'Wolf Pelt', name: 'Bloodlust', short: 'His bleeding refills your stamina', line: 'While he bleeds, you get your stamina back faster.' },
  { id: 'cruel', fam: 'blood', tier: 2, slot: 'belt', gear: 'Hook Belt', name: 'Cruel Edge', short: 'Bleeding makes gap stabs harder', line: 'The more he bleeds, the harder your stabs into gaps hit.' },
  { id: 'haem', fam: 'blood', tier: 3, key: true, slot: 'weapon', gear: 'Hooked Sica', name: 'Haemorrhage', short: 'Bleed carries over. Bare hits fail.', line: 'His bleeding carries on to the next fighter. Hits on bare skin do nothing.' },
  { id: 'sidestep', fam: 'dancer', tier: 0, slot: 'legs', gear: "Dancer's Sandals", name: 'Sidestep', short: 'Dodge his wind-up to wind him', line: 'Dodge during his wind-up and he stumbles, out of breath.', needs: 'dodge' },
  { id: 'lightfeet', fam: 'dancer', tier: 0, slot: 'belt', gear: 'Ribbon Sash', name: 'Light Feet', short: 'Dodging his wind-up costs nothing', line: 'Dodge during his wind-up and the dodge costs no stamina.', needs: 'dodge' },
  { id: 'blur', fam: 'dancer', tier: 1, slot: 'chest', gear: 'Ghost Silk', name: 'Blur', short: 'Dodge, and he hits your ghost', line: 'Step back and he swings at a ghost of you.', needs: 'dodge' },
  { id: 'matador', fam: 'dancer', tier: 2, slot: 'arms', gear: "Matador's Ribbons", name: 'Matador', short: 'Dodge a stab to stun him', line: 'Dodge a stab or a shield bash and he stumbles, stunned.', needs: 'dodge' },
  { id: 'slip', fam: 'dancer', tier: 1, slot: 'helmet', gear: 'Ribbon Band', name: 'Slip and Stab', short: 'Dodge, then stab: double damage', line: 'Dodge his wind-up, then stab quickly: double damage.', needs: 'dodge' },
  { id: 'untouch', fam: 'dancer', tier: 3, key: true, slot: 'cloak', gear: 'Flowing Cape', name: 'Untouchable', short: 'Free dodges open gaps. No shield.', line: 'Dodges are free, and a dodge during his wind-up opens every gap. No shield.', needs: 'dodge', bans: 'shield' },
  { id: 'heavy', fam: 'brute', tier: 0, slot: 'weapon', gear: 'Iron Pommel', name: 'Heavy Arm', short: 'Overheads break armour twice as fast', line: 'Your smashes from above break armour twice as fast.' },
  { id: 'brawler', fam: 'brute', tier: 0, slot: 'belt', gear: 'Chain Belt', name: 'Brawler', short: `Broken armour earns ${TUNING.cards.brawler} Momentum`, line: 'Breaking a piece of his armour earns 2 Momentum.' },
  { id: 'breaker', fam: 'brute', tier: 2, slot: 'helmet', gear: 'Horned Cap', name: 'Plate Breaker', short: 'Overheads knock armour off', line: 'A smash from above knocks off the armour it hits.' },
  { id: 'bones', fam: 'brute', tier: 1, slot: 'legs', gear: 'Spiked Boots', name: 'Bonebreaker', short: 'Overheads cripple bare limbs', line: 'A smash on a bare leg or arm cripples it at once.' },
  { id: 'jugg', fam: 'brute', tier: 1, slot: 'arms', gear: 'Iron Pauldrons', name: 'Juggernaut', short: 'Lunge through blows at half damage', line: "Lunge through his blow: it hurts half as much and doesn't stop you." },
  { id: 'titan', fam: 'brute', tier: 3, key: true, slot: 'chest', gear: 'Black Plate', name: 'Titan', short: `+${TUNING.cards.titan} hearts. Overheads stagger. No dodge.`, line: `${TUNING.cards.titan} more hearts, and every smash from above staggers him. You can't dodge.`, bans: 'dodge' },
  { id: 'myfeint', fam: 'trick', tier: 0, slot: 'helmet', gear: 'Dark Hood', name: 'Feint', short: 'Pull a lunge back: gap opens', line: 'Push to lunge, then pull back fast: he guards there, and the other side opens.' },
  { id: 'misdir', fam: 'trick', tier: 1, slot: 'weapon', gear: 'Blackened Blade', name: 'Misdirection', short: "Stab your Feint's gap: double damage", line: 'Stab the gap your Feint opened: double damage.', needs: 'feint' },
  { id: 'mindreader', fam: 'trick', tier: 1, slot: 'chest', gear: 'Eye Amulet', name: 'Mind Reader', short: 'Spotting his fake earns Momentum', line: 'Spot his fake and earn 2 Momentum.' },
  { id: 'bait', fam: 'trick', tier: 1, slot: 'shield', gear: 'Spiral Shield', name: 'Bait', short: 'Drop your shield: his wind-up slows', line: 'Lower your shield on purpose: his next wind-up is twice as long.', needs: 'shield' },
  { id: 'unreadable', fam: 'trick', tier: 1, slot: 'legs', gear: 'Soft Boots', name: 'Unreadable', short: 'He never learns your Feints', line: 'He never gets used to your Feints.', needs: 'feint' },
  { id: 'bluff', fam: 'trick', tier: 2, slot: 'arms', gear: 'Knife Bracers', name: 'Double Bluff', short: 'Two Feints open every gap', line: 'Feint twice in a row and every gap opens.', needs: 'feint' },
  { id: 'puppet', fam: 'trick', tier: 3, key: true, slot: 'cloak', gear: "Puppeteer's Mantle", name: 'Puppeteer', short: 'Fakes come often. Hearts capped.', line: `Every third move of his is a fake, and you see it coming. ${TUNING.cards.puppetHearts} hearts at most.` },
  { id: 'flourish', fam: 'show', tier: 0, slot: 'weapon', gear: 'Gilded Sword', name: 'Flourish', short: 'Circle your sword: the crowd cheers', line: 'Draw a fast circle with your sword thumb: the crowd cheers.' },
  { id: 'showboat', fam: 'show', tier: 0, slot: 'cloak', gear: 'Purple Cloak', name: 'Showboat', short: 'The crowd tires half as fast', line: 'The crowd gets bored of you half as fast.' },
  { id: 'playcrowd', fam: 'show', tier: 1, slot: 'arms', gear: 'Gilt Armlets', name: 'Play to the Crowd', short: 'Timed blocks please the crowd double', line: 'Well-timed blocks and spotting fakes please the crowd twice as much.' },
  { id: 'bread', fam: 'show', tier: 1, slot: 'belt', gear: 'Coin Belt', name: 'Bread and Circuses', short: 'A full crowd throws you hearts', get line() { return `With the crowd nearly full, they throw you ${lenN(TUNING.cards.bread)} hearts, once a bout.`; } },
  { id: 'encore', fam: 'show', tier: 1, slot: 'legs', gear: 'Gilded Greaves', name: 'Encore', short: 'High crowd: finishers cost less', line: 'With the crowd high, finishers cost 1 Momentum less.' },
  { id: 'pleaser', fam: 'show', tier: 2, slot: 'helmet', gear: 'Plumed Helm', name: 'Crowd Pleaser', short: 'High crowd: gap stabs triple', line: 'With the crowd high, a stab into a gap does triple damage, and uses some of the crowd.' },
  { id: 'darling', fam: 'show', tier: 3, key: true, slot: 'chest', gear: 'Gilded Harness', name: 'Darling of Rome', short: 'The crowd never tires. Half gold.', line: 'The crowd never gets bored, and when full, he freezes in awe. Half gold.' },
  { id: 'exec', fam: 'fin', tier: 1, gear: 'Red Bar', name: 'Execute', short: 'A gap stab finishes him', line: "3 Momentum, when he's below half health: your next stab into a gap finishes him." },
  { id: 'whirl', fam: 'fin', tier: 1, gear: 'Woad Spiral', name: 'Whirlwind', short: 'Next slash hits every gap', line: '2 Momentum: your next slash hits every gap it crosses.' },
  { id: 'breath', fam: 'fin', tier: 1, gear: 'Chalk Dots', name: 'Second Breath', short: 'All your stamina back', line: '2 Momentum: all your stamina back.' },
  { id: 'disarm', fam: 'fin', tier: 1, gear: 'Ochre Zigzag', name: 'Disarm', short: 'Knock his weapon away', line: '4 Momentum: his weapon flies, and he fights with his fists for 3 seconds.' },
  { id: 'falseop', fam: 'fin', tier: 1, gear: 'Violet Mask', name: 'False Opening', short: 'His next blow misses', line: "3 Momentum: his next blow misses, and he's out of breath." },
  { id: 'showstop', fam: 'fin', tier: 1, gear: 'Gold Laurel', name: 'Showstopper', short: 'The crowd roars; he freezes', line: '3 Momentum: the crowd roars, and he freezes in awe.' },
  { id: 'unbreak', fam: 'rare', tier: 2, slot: 'cloak', gear: 'Lion Pelt', name: 'Unbreakable', short: 'First hit each fight does nothing', line: 'The first hit you take in each fight does nothing.' },
  { id: 'cape', duo: ['dancer', 'wall'], tier: 2, name: "Matador's Cape", short: 'Every second timed block stuns', line: 'Every second well-timed block or dodge stuns him.' },
  { id: 'butcher', duo: ['brute', 'blood'], tier: 2, name: 'Butcher', short: 'Broken armour makes him bleed', line: 'Breaking his armour makes him bleed badly.' },
  { id: 'spiked', duo: ['wall', 'blood'], tier: 2, name: 'Spiked Boss', short: 'Timed blocks make him bleed', line: 'A block right as his blow lands makes him bleed.', needs: 'shield' },
  { id: 'hamstring', duo: ['dancer', 'brute'], tier: 2, name: 'Hamstring', short: 'Dodge, then hit: legs slow', line: 'Dodge his wind-up, then hit quickly: his legs go slow.', needs: 'dodge' },
  { id: 'sucker', duo: ['trick', 'brute'], tier: 2, name: 'Sucker Punch', short: 'Fake, then overhead: he staggers', line: 'Fake, then smash from above: he always staggers.' },
  { id: 'bloodsport', duo: ['show', 'blood'], tier: 2, name: 'Blood Sport', short: 'The crowd loves him bleeding', line: 'The crowd loves it while he bleeds.' },
  { id: 'falsestep', duo: ['trick', 'dancer'], tier: 2, name: 'False Step', short: 'Dodging his wind-up opens a gap', line: 'Dodging his wind-up works like a fake: a gap opens.', needs: 'dodge' },
  { id: 'salute', duo: ['show', 'wall'], tier: 2, name: 'Salute', short: 'High crowd: timed blocks open gaps', line: 'With the crowd high, a well-timed block opens every gap.', needs: 'shield' },
  { id: 'bulwark', vault: true, fam: 'wall', tier: 2, slot: 'shield', gear: 'Bossed Shield', name: 'Bulwark', short: `${TUNING.cards.bulwark} straight blocks wind him`, line: "Three blocks in a row and he's out of breath.", needs: 'shield' },
  { id: 'phalanx', vault: true, fam: 'wall', tier: 3, slot: 'helmet', gear: 'Phalanx Helm', name: 'Phalanx Master', short: 'Wall cards widen timed blocks', line: "Each Wall card you wear makes a well-timed block's window wider.", needs: 'shield' },
  { id: 'letter', vault: true, fam: 'blood', tier: 2, slot: 'belt', gear: "Bloodletter's Belt", name: 'Bloodletter', short: 'His bleeding lasts twice as long', line: 'His bleeding lasts twice as long.' },
  { id: 'tide', vault: true, fam: 'blood', tier: 3, slot: 'cloak', gear: 'Crimson Cloak', name: 'Crimson Tide', short: 'He falls bleeding: you heal', line: `When he falls while bleeding, you heal 1 heart for each bleed on him (${TUNING.cards.tide} at most).` },
  { id: 'shadow', vault: true, fam: 'dancer', tier: 2, slot: 'legs', gear: 'Shadow Sandals', name: 'Shadow Step', short: 'Dodge, then your hit gets through', line: "Dodge his wind-up and your next hit can't be blocked.", needs: 'dodge' },
  { id: 'winddancer', vault: true, fam: 'dancer', tier: 3, slot: 'arms', gear: 'Wind Ribbons', name: 'Wind Dancer', short: 'Dancer cards make dodges longer', line: 'Each Dancer card you wear makes your dodges longer, and his misses leave him open longer.', needs: 'dodge' },
  { id: 'crusher', vault: true, fam: 'brute', tier: 2, slot: 'arms', gear: 'Crusher Gauntlets', name: 'Crusher', short: 'Fast slashes dent armour twice', line: 'A fast slash on his armour dents it twice.' },
  { id: 'colossus', vault: true, fam: 'brute', tier: 3, slot: 'chest', gear: 'Colossus Plate', name: 'Colossus', short: `+${TUNING.cards.colossus} heart per Brute card`, line: 'Each Brute card you wear gives you 1 more heart, and your smashes from above hit harder.' },
  { id: 'smoke', vault: true, fam: 'trick', tier: 2, slot: 'belt', gear: 'Smoke Pouch Belt', name: 'Smoke and Mirrors', short: 'A Feint he bites drains him', line: 'A Feint he falls for drains his stamina.', needs: 'feint' },
  { id: 'deceiver', vault: true, fam: 'trick', tier: 3, slot: 'cloak', gear: 'Mirror Cloak', name: 'Grand Deceiver', short: 'Trickster cards show fakes sooner', line: "Each Trickster card you wear shows his fakes sooner and keeps your Feint's gap open longer." },
  { id: 'gilded', vault: true, fam: 'show', tier: 2, slot: 'helmet', gear: 'Laurel Wreath', name: 'Gilded Moment', short: 'Full crowd: first finisher free', line: 'With the crowd full, your first finisher each bout is free.' },
  { id: 'idol', vault: true, fam: 'show', tier: 3, slot: 'chest', gear: "Idol's Torc", name: 'Idol of Rome', short: 'Showman cards fill the crowd faster', line: 'Each Showman card you wear makes the crowd fill faster and pay more gold.' },
  { id: 'counterstep', vault: true, duo: ['wall', 'dancer'], tier: 2, name: 'Counterstep', short: 'Dodge after a block: free gap', line: 'A dodge right after a block is free and opens a gap.', needs: ['shield', 'dodge'] },
  { id: 'anvil', vault: true, duo: ['wall', 'brute'], tier: 2, name: 'Hammer and Anvil', short: 'Timed block, then overhead breaks armour', line: 'A well-timed block makes your next smash from above break the armour it hits.', needs: 'shield' },
  { id: 'feigned', vault: true, duo: ['wall', 'trick'], tier: 2, name: 'Feigned Guard', short: 'Drop your shield, then riposte', line: 'Lowering your shield on purpose leaves his next blow open to a riposte.', needs: 'shield' },
  { id: 'cuts', vault: true, duo: ['blood', 'dancer'], tier: 2, name: 'Thousand Cuts', short: 'Cut while stepping back: he bleeds', line: 'A cut as you step back makes him bleed.', needs: 'dodge' },
  { id: 'lie', vault: true, duo: ['blood', 'trick'], tier: 2, name: 'Poisoned Lie', short: 'Bitten Feints make him bleed', line: 'A Feint he falls for makes him bleed.', needs: 'feint' },
  { id: 'acrobat', vault: true, duo: ['dancer', 'show'], tier: 2, name: 'Acrobat', short: 'Dodging his wind-up pleases the crowd', line: 'Dodging his wind-up pleases the crowd.', needs: 'dodge' },
  { id: 'spectacle', vault: true, duo: ['brute', 'show'], tier: 2, name: 'Spectacle', short: 'Broken armour fills the crowd', line: 'Breaking his armour fills the crowd.' },
  { id: 'illusion', vault: true, duo: ['trick', 'show'], tier: 2, name: 'Grand Illusion', short: 'Spotting fakes pleases crowd, pays gold', line: 'Spotting his fake pleases the crowd twice as much and earns gold.' },
];
for (const c of DECK) { c.fam = c.fam || 'duo'; c.ab = c.name.split(/[ ']/).filter((w) => /^[A-Z]/.test(w)).map((w) => w[0]).join('').slice(0, 2); }
export const CARD = Object.fromEntries(DECK.map((c) => [c.id, c]));
// The exact numbers behind each card's plain line, shown on its "?" page (all from TUNING)
const ord = (n) => `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10 < 4 ? n % 10 : 0]}`;
const bleeds = (n) => `Bleeding ${n}: he loses ${TUNING.bleed.dmg * n} health a second for ${TUNING.bleed.dur} s.`;
const topPct = () => Math.round(TUNING.crowd.bands[1] * 100);
const CARD_NUMS = {
  riposte: (T, C) => `The counter stab does ${T.attack.jab.dmg} damage.`,
  shove: (T, C) => `He is pushed back ${C.shove} paces. At his wall he is stunned ${C.shoveStun} s.`,
  braced: (T, C) => `${C.braced} Momentum for each block that is not well-timed.`,
  standfast: () => 'Only with your back to your wall.',
  thorns: (T, C) => `${C.thorns} chips and he drops it for ${C.thornsDur} s. A beast is stunned instead.`,
  ironwall: (T) => `The well-timed window grows from ${T.shield.perfect} s to ${T.shield.perfect * 2} s. No dodging.`,
  serrated: () => bleeds(TUNING.cards.serrated),
  rend: () => bleeds(TUNING.cards.rend),
  vein: (T, C) => `His wind-ups take ${Math.round((C.vein - 1) * 100)}% longer while he bleeds.`,
  bloodlust: (T, C) => `${C.bloodlust} stamina for each bleeding, every second.`,
  cruel: (T, C) => `+${C.cruel} damage for each bleeding on him.`,
  haem: () => 'All his bleeding goes to the next fighter. A hit on bare skin does 0.',
  sidestep: (T, C) => `He is out of breath for ${C.sidestep} s.`,
  lightfeet: (T) => `The dodge's ${T.dodge.cost} stamina comes back.`,
  blur: () => 'The ghost takes his next blow.',
  slip: (T, C) => `A stab within ${C.slipWin} s of the dodge does ${C.slip}x damage.`,
  matador: (T, C) => `He is stunned ${C.matador} s.`,
  untouch: (T, C) => `Dodges cost nothing. Every gap opens for ${C.untouch} s. No shield.`,
  heavy: (T, C) => `Smashes dent armour ${C.heavy}x as much. A piece breaks at ${T.armour.dents} dents.`,
  brawler: (T, C) => `${C.brawler} Momentum for each piece you break.`,
  breaker: () => 'The armour is gone at once, however few dents it had.',
  bones: (T) => `A crippled leg moves at ${Math.round(T.lame.legs * 100)}% speed; a crippled arm swings ${Math.round(T.lame.arm * 100)}% slower.`,
  jugg: (T, C) => `His blow costs ${C.jugg}x, rounded up, while you lunge.`,
  titan: (T, C) => `+${C.titan} hearts. Every smash staggers him. No dodging.`,
  myfeint: (T) => `The other gap opens for ${T.myFeint.open} s. A fake costs ${T.myFeint.cost} stamina.`,
  misdir: (T, C) => `${C.misdir}x damage.`,
  mindreader: (T, C) => `${T.mom.read + C.mind} Momentum for each fake you spot.`,
  bait: (T, C) => `Hold the shield ${C.baitHold} s, then lower it. His next wind-up takes ${C.bait}x as long.`,
  unreadable: (T) => `Without it he learns after ${T.myFeint.learn} fakes in ${T.myFeint.learnWin} s.`,
  bluff: (T, C) => `Two fakes within ${C.bluffWin} s open every gap for ${C.bluff} s.`,
  puppet: (T, C) => `One move in ${C.puppet} is a fake. Your hearts are capped at ${C.puppetHearts}.`,
  flourish: (T, C) => `+${C.flourish} crowd, out of ${T.crowd.max}, for each circle.`,
  showboat: (T, C) => `The crowd drains at ${C.showboat}x speed.`,
  playcrowd: (T, C) => `${C.play}x crowd for each.`,
  bread: (T, C) => `${lenN(C.bread)} hearts when the crowd is past ${C.breadAt}%.`,
  encore: (T, C) => `${C.encore} Momentum less, with the crowd past ${topPct()}%.`,
  pleaser: (T, C) => `${C.pleaser}x damage, and it uses ${C.pleaserCost} crowd. With the crowd past ${topPct()}%.`,
  darling: (T, C) => `At ${C.aweAt}% crowd he freezes ${C.awe} s before each exchange. Gold x${C.darlingGold}.`,
  exec: (T) => `${T.fin.exec} Momentum. Below ${Math.round(T.fin.below * 100)}% of his health.`,
  whirl: (T) => `${T.fin.whirl} Momentum, for one slash.`,
  breath: (T) => `${T.fin.breath} Momentum.`,
  disarm: (T, C) => `${T.fin.disarm} Momentum. Fists hit for ${C.fist} at most. A beast is stunned ${T.fin.beastStun} s.`,
  falseop: (T) => `${T.fin.falseop} Momentum. His blow takes ${T.fin.falseWind} s to land, and misses.`,
  showstop: (T) => `${T.fin.showstop} Momentum. The crowd gets +${T.fin.showFav}. He freezes ${T.fin.showAwe} s.`,
  unbreak: () => 'Once in each fight.',
  cape: (T, C) => `Every ${ord(C.cape)} one: he is stunned ${C.capeStun} s.`,
  butcher: () => bleeds(TUNING.cards.butcher),
  spiked: () => bleeds(TUNING.cards.spiked),
  hamstring: (T, C) => `Hit within ${C.hamWin} s of the dodge.`,
  sucker: (T, C) => `Smash within ${C.sucker} s of your fake.`,
  bloodsport: (T, C) => `+${C.bloodSport} crowd for each bleeding, every second.`,
  falsestep: (T) => `The gap opens for ${T.myFeint.open} s.`,
  salute: (T, C) => `Every gap opens for ${C.salute} s, with the crowd past ${topPct()}%.`,
  bulwark: (T, C) => `${C.bulwark} blocks without a hit taken between: he is out of breath for ${C.bulwarkWind} s.`,
  phalanx: (T, C) => `+${Math.round(C.phalanx * 100)}% to the ${T.shield.perfect} s window for each Wall card.`,
  letter: (T, C) => `Each bleeding lasts ${T.bleed.dur * C.letter} s, not ${T.bleed.dur} s.`,
  tide: (T, C) => `1 heart for each bleeding on him, ${C.tide} at most.`,
  shadow: (T, C) => `Within ${C.shadowWin} s of the dodge, your next blow goes through his guard.`,
  winddancer: (T, C) => `For each Dancer card: dodges +${Math.round(C.windDodge * 100)}%, his open time after a miss +${Math.round(C.windOpen * 100)}%.`,
  crusher: (T, C) => `A fast slash dents armour ${C.crusher}x. A piece breaks at ${T.armour.dents} dents.`,
  colossus: (T, C) => `For each Brute card: +${C.colossus} heart and +${Math.round(C.colossusOver * 100)}% smash damage.`,
  smoke: (T, C) => `He loses ${Math.round(C.smoke * 100)}% of his stamina.`,
  deceiver: (T, C) => `For each Trickster card: his fake shows ${Math.round(C.deceiveFake * 100)}% of its wind-up sooner, your Feint's gap stays +${Math.round(C.deceiveOpen * 100)}%.`,
  gilded: (T, C) => `With the crowd past ${C.gildedAt}%: the first finisher costs no Momentum.`,
  idol: (T, C) => `For each Showman card: +${Math.round(C.idolFav * 100)}% crowd, +${Math.round(C.idolGold * 100)}% crowd gold.`,
  counterstep: (T, C) => `A dodge within ${C.counterWin} s of a block costs no stamina. The gap stays open ${T.myFeint.open} s.`,
  anvil: (T, C) => `Smash within ${C.anvilWin} s of the well-timed block.`,
  feigned: (T, C) => `Hold the shield ${C.baitHold} s, then lower it. After his next blow, your hits do ${T.shield.riposteMul}x for ${T.shield.riposte} s.`,
  cuts: (T, C) => `A slash within ${C.cutsWin} s of a backstep. ${bleeds(C.cuts)}`,
  lie: (T, C) => bleeds(C.lie),
  acrobat: (T, C) => `+${C.acrobat} crowd, out of ${T.crowd.max}, for each.`,
  spectacle: (T, C) => `+${C.spectacle} crowd, out of ${T.crowd.max}, for each piece you break.`,
  illusion: (T, C) => `${C.illusion}x crowd and +${C.illusionGold} gold for each fake you spot.`,
};
export const cardNums = (c) => CARD_NUMS[c.id](TUNING, TUNING.cards);
// The armourer's wares. Big ones, then the v1 commons, now sold cheap here.
export const WARES = [
  { id: 'plate', big: true, name: 'Iron plate', line: 'Your {part} is plated' },
  { id: 'whet', big: true, name: 'Whetstone', line: '+1 damage on every hit' },
  { id: 'heart', big: true, name: 'A heart', line: '+{n} hearts to your max, filled' },
  { id: 'token', big: true, name: 'Lucky token', line: '+1 reroll for a draft' },
  { id: 'forge', big: true, name: 'Forged {weapon}', line: 'Your weapon hits 25% harder' },
  { id: 'hide', name: 'Thick Hide', line: `+${TUNING.cards.hide} heart to your max, filled` },
  { id: 'wind', name: 'Big Lungs', line: '+20% stamina' },
  { id: 'wrist', name: 'Quick Wrist', line: 'quick stabs recover 20% faster' },
  { id: 'steady', name: 'Steady Shield', line: 'blocking costs 25% less' },
  { id: 'grip', name: 'Sandal Grip', line: 'steps 20% faster' },
  { id: 'feet', name: 'Quick Feet', line: 'steps 25% faster' },
  { id: 'deepbreath', name: 'Deep Breath', line: 'stamina regenerates 20% faster' },
  { id: 'edge', name: 'Sharp Edge', line: 'bare hits +1' },
  { id: 'tough', name: 'Tough Shield', line: '2 more shield hits' },
  { id: 'stance', name: 'Wide Stance', line: 'no push-back from a bash' },
];
// Rarity has a colour: the card's border and the glint on the worn piece. A set is gold.
export const TIERS = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'], TIER_TINT = ['#c4b99a', '#7dd3fc', '#c084fc', '#fb923c'], DUO_GOLD = '#ffd24a';
export const rarCol = (c) => (c.duo ? DUO_GOLD : TIER_TINT[c.tier]);
// the title a card shows: the piece's name, the war paint's pattern, or the set's name
export const titleOf = (c) => (c.duo ? `${c.name} set` : c.gear);
// The gear worn: the last piece picked for each slot (a migrated run may still hold two for one slot; the later one shows).
export function gearOf(ids) {
  const out = {};
  for (const id of ids) { const c = CARD[id]; if (c && c.slot) out[c.slot] = c; }
  return out;
}
// The gap guards: foe-only pieces, each shutting one joint gap for the bout
export const GUARDS = { 'slot-neck': 'Gorget', 'slot-armpit': 'Manica', 'slot-waist': 'Wide Belt', 'slot-elbow': 'Couters', 'slot-knee': 'Knee Guards' };

// Parts in body units. Arms hang from a joint (their own frame): d is relative to the joint.
export const PARTS = [
  { id: 'head',  shape: 'circle', x: 0.03, y: -0.80, r: 0.08 },
  { id: 'chest', shape: 'rect',   x: 0,    y: -0.60, w: 0.24, h: 0.17 },
  { id: 'belly', shape: 'rect',   x: 0,    y: -0.44, w: 0.20, h: 0.13 },
  { id: 'armF',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.09, h: 0.30, joint: [0.05, -0.67] },
  { id: 'armB',  shape: 'rect',   x: 0,    y: 0.15,  w: 0.085, h: 0.30, joint: [-0.04, -0.67] },
  { id: 'legs',  shape: 'rect',   x: 0,    y: -0.19, w: 0.22, h: 0.38 },
];
// Joint slots: always open, drawn as dark slits. 'frame' names the limb they ride on; 'axis' is the direction (radians, body frame) a thrust must follow to go in.
export const SLOTS = [
  { id: 'slot-neck', label: 'NECK', shape: 'rect', x: 0.03, y: -0.70, w: 0.085, h: 0.05, axis: 0 },
  { id: 'slot-armpit', label: 'ARMPIT', shape: 'rect', x: 0.115, y: -0.60, w: 0.045, h: 0.085, axis: 0.5 },
  { id: 'slot-waist', label: 'WAIST', shape: 'rect', x: 0, y: -0.51, w: 0.21, h: 0.04, axis: 0 },
  { id: 'slot-elbow', label: 'ELBOW', shape: 'rect', x: 0, y: 0.15, w: 0.085, h: 0.04, axis: 0, frame: 'armF' },
  { id: 'slot-knee', label: 'KNEE', shape: 'rect', x: 0.075, y: -0.20, w: 0.045, h: 0.06, axis: 0.3 },
];
// Step 15: his face, which opens as a gap like these when his helmet plate breaks (on the face's front half, a jab going straight in)
export const FACE_SLOT = { id: 'slot-face', label: 'FACE', shape: 'rect', x: 0.085, y: -0.79, w: 0.05, h: 0.075, axis: 0 };
export const ARM_LEN = 0.30, SHOULDER = [0.05, -0.67];
// A beast's body, side view, in its own body units (x forward, y down, origin at its near forepaw). Its parts ride frames set by its pose (poseBeast):
// 'body' (the torso, rearing about the hip), 'head' (the body's, dipped) and the near foreleg 'legF' (from the shoulder joint, like an arm); the hind
// legs stand on the ground. Its gaps are its soft spots: the throat, the foreleg's joint, and the flank (lion) or belly (bear). sh, hp: the shoulders and
// hips (near, far); feet: where each foot stands (fore near, fore far, hind near, hind far); leg: the upper and lower bone of a fore and a hind leg.
export const BEAST_BODY = {
  lion: {
    parts: [
      { id: 'head', shape: 'circle', x: 0.17, y: -0.4, r: 0.075, frame: 'head' },
      { id: 'chest', shape: 'rect', x: 0.04, y: -0.3, w: 0.18, h: 0.18, frame: 'body' },
      { id: 'belly', shape: 'rect', x: -0.15, y: -0.29, w: 0.2, h: 0.15, frame: 'body' },
      { id: 'legF', shape: 'rect', x: 0, y: 0.145, w: 0.06, h: 0.29, joint: [0.05, -0.29] },
      { id: 'legs', shape: 'rect', x: -0.27, y: -0.16, w: 0.12, h: 0.32 },
    ],
    slots: [
      { id: 'slot-throat', label: 'THROAT', shape: 'rect', x: 0.12, y: -0.335, w: 0.045, h: 0.06, axis: 0.5, frame: 'body' },
      { id: 'slot-joint', label: 'JOINT', shape: 'rect', x: 0, y: 0.13, w: 0.065, h: 0.035, axis: 0, frame: 'legF' },
      { id: 'slot-flank', label: 'FLANK', shape: 'rect', x: -0.06, y: -0.3, w: 0.035, h: 0.08, axis: 0.35, frame: 'body' },
    ],
    sh: [[0.05, -0.29], [0.08, -0.3]], hp: [[-0.26, -0.27], [-0.22, -0.28]], feet: [0.04, 0.09, -0.27, -0.22], leg: [[0.15, 0.15], [0.15, 0.16]], hip: [-0.25, -0.27],
  },
  bear: {
    parts: [
      { id: 'head', shape: 'circle', x: 0.17, y: -0.42, r: 0.08, frame: 'head' },
      { id: 'chest', shape: 'rect', x: 0.03, y: -0.32, w: 0.2, h: 0.22, frame: 'body' },
      { id: 'belly', shape: 'rect', x: -0.16, y: -0.31, w: 0.2, h: 0.2, frame: 'body' },
      { id: 'legF', shape: 'rect', x: 0, y: 0.15, w: 0.08, h: 0.3, joint: [0.05, -0.3] },
      { id: 'legs', shape: 'rect', x: -0.27, y: -0.18, w: 0.13, h: 0.36 },
    ],
    slots: [
      { id: 'slot-throat', label: 'THROAT', shape: 'rect', x: 0.125, y: -0.345, w: 0.045, h: 0.06, axis: 0.5, frame: 'body' },
      { id: 'slot-joint', label: 'JOINT', shape: 'rect', x: 0, y: 0.14, w: 0.075, h: 0.035, axis: 0, frame: 'legF' },
      { id: 'slot-belly', label: 'BELLY', shape: 'rect', x: -0.13, y: -0.225, w: 0.12, h: 0.035, axis: 0, frame: 'body' },
    ],
    sh: [[0.05, -0.3], [0.08, -0.31]], hp: [[-0.26, -0.28], [-0.22, -0.29]], feet: [0.05, 0.1, -0.27, -0.22], leg: [[0.15, 0.16], [0.15, 0.17]], hip: [-0.25, -0.28],
  },
};
// a beast's parts: every gap open (a beast wears no guard); barded (step 16), each piece's part plated
export function beastParts(kind, armour = false) {
  const K = BEAST_BODY[kind], on = armour ? Object.values(TUNING.beasts.armour.plates) : [], out = K.parts.map((d) => mkPart(d, on.includes(d.id)));
  for (const d of K.slots) { const q = mkPart(d, false); q.slot = true; out.push(q); }
  return out;
}

// The three zones: where the blow lands (body units), the shield height that blocks it.
export const ZONES = [
  { id: 'high', y: -0.78, label: 'HIGH', sy: -0.8 },
  { id: 'mid',  y: -0.62, label: 'MID', sy: -0.58 },
  { id: 'low',  y: -0.18, label: 'LOW', sy: -0.28 },
];
export const ZONE = Object.fromEntries(ZONES.map((z) => [z.id, z]));
// The foe's weapon arm for each blow: cocked angle and end angle (from forward, y down), lean while winding, crouch, how far the blow lunges (x swing.lunge).
export const POSES = {
  chop:   { cock: -1.55, end: 1.15, lean: -0.18, crouch: 0, lunge: 1 },
  slash:  { cock: -2.9, end: 0.0, lean: -0.08, crouch: 0, lunge: 1 },
  sweep:  { cock: 2.5, end: 0.9, lean: 0.22, crouch: 0.05, lunge: 1 },
  thrust: { cock: 0.1, end: -0.08, lean: -0.16, crouch: 0.01, lunge: 1.7 },
  bash:   { cock: 1.3, end: 0.7, lean: -0.22, crouch: 0, lunge: 1.9 },
  net:    { cock: -2.4, end: 0.2, lean: -0.12, crouch: 0, lunge: 0.6 },
  throw:  { cock: -2.75, end: 0.25, lean: -0.2, crouch: 0.01, lunge: 0.5 },
};
export const ZONE_POSE = { high: 'chop', mid: 'slash', low: 'sweep' };
export const MOVE_ZONE = { chop: 'high', thrust: 'mid', sweep: 'low' };
export const POSE_NAME = { chop: 'CHOP', slash: 'SLASH', sweep: 'SWEEP', thrust: 'THRUST', bash: 'BASH', net: 'NET', throw: 'THROW', pounce: 'POUNCE', swipe: 'SWIPE', maul: 'MAUL', shove: 'SHOVE' };
export const REST_TH = 0.9;

// Your plates follow your rolled set: n of head, chest and legs (the parts the high, mid and low blows land on), heavy also plates the shield arm.
export const ZONE_PART = { high: 'head', mid: 'chest', low: 'legs' };
// The plates the purse sells by the slot (step 11): each one's name and the parts it plates
// (step 24: the manica is sold as a reinforced shield, TUNING.purse.reinforce; it is still worn on the shield arm)
export const PLATES = { helmet: { name: 'Helmet', parts: ['head'] }, chest: { name: 'Chest plate', parts: ['chest', 'belly'] }, manica: { name: 'Reinforced shield', parts: ['armB'] }, greaves: { name: 'Greaves', parts: ['legs'] } };
export const playerParts = (me) => PARTS.map((d) => mkPart(d, me.plates.includes(d.id)));

// ====== RUN STATE AND SMALL HELPERS (continued) ======
export const mkPart = (d, armour) => ({ d, armour, cx: d.x, cy: d.y, slot: false, cut: false, hp: TUNING.part.hp, dents: 0, cracks: [], gashes: [], flash: 0, clang: 0, cool: 0 });
// a count of hearts (yours, the grade's hits) at the bout-length setting, whole
export const lenN = (n) => Math.round(n * TUNING.boutLength);
