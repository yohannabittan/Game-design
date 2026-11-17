// Arena: what changed in each build, as things to try (shown by the menu's "What's new" card, newest first).
// The orchestrator adds an entry on top at every landing: v is the build number (the number in sw.js's CACHE_VERSION; tools/docs-check.mjs keeps them equal),
// then the date and two to five short lines, each a thing to try, in plain words. Only the newest TUNING.notes.shown entries are shown.
export const NOTES = [
  { v: 81, date: '17 Nov', lines: ['Training (Skip or replay it from the menu): your partner is now your own size, so blows land where your arm goes.'] },
  { v: 80, date: '17 Nov', lines: ['Push your thumb straight at him: it is a jab now, with every weapon, one or two.', 'Try a spear or an axe: pushes no longer come out as slashes or as nothing.', 'A very slow push still does nothing: push like you mean it.'] },
  { v: 79, date: '14 Nov', lines: ['Buy a second weapon in the Arms slot: you now hold both forward.', 'Your blows go hand to hand: right, left, right, left. Keep your thumb down and push again: the free hand is already up.', 'No shield: block with crossed blades, as before.'] },
  { v: 78, date: '14 Nov', lines: ['Tailor crests sit a little further back on the head; the gold one a little higher too.'] },
  { v: 77, date: '14 Nov', lines: ['Wear a crest from the Tailor: bronze, silver and gold now hang their tail down the back of your neck. v75 had them the wrong way round.'] },
  { v: 76, date: '14 Nov', lines: ['Take a side bow and draw it: the block buttons go dark, because your shield is on your back.', 'Same with a knife raised, mid-swap or a broken shield. They light up again when a block would work.'] },
  { v: 75, date: '14 Nov', lines: ['Crests and plumes now sweep back over the head, as they should.', 'Fight an axe man: the round two-eyehole helmet is gone. He wears a Gallic, murmillo or Thracian helmet instead.'] },
  { v: 74, date: '14 Nov', lines: ['This card is new: tap the build number on the menu after any update.', 'Tap › for the builds before this one.', 'Today’s other updates: the long spear (v73), the block warning on small and big fighters (v72), heavier knives and the sica’s point (v71), the hurried overhead (v70).'] },
  { v: 73, date: '14 Nov', lines: ['Take a spear: it is as long as his now.', 'Let a foe step in close and push: your hand slides up the shaft and the point still lands.', 'The trident does the same.'] },
  { v: 72, date: '14 Nov', lines: ['Play a runt or a giant and watch the block warning: it sits on your own head, chest and legs now.'] },
  { v: 71, date: '14 Nov', lines: ['Throw a knife into a gap: it now hits for 12, and 4 on bare skin.', 'Push with the sica: its point stabs now.', 'With Haemorrhage, a hit on bare skin shows NO BITE and nothing else.', 'Slash a plate: it says DENTED or GLANCES OFF.', 'Armoured bears and lions wear plate on the head and chest only.'] },
  { v: 70, date: '14 Nov', lines: ['Throw an overhead in a hurry: lift and chop, no pause at the top.', 'A slash with a big back-swing is now an overhead: say if that catches you out.', 'In the training yard, copy the ghost thumb: it moves at a speed you can match.'] },
  { v: 69, date: '14 Nov', lines: ['Each blow looks like itself: a jab’s streak, a slash’s smear, an overhead’s chop; sparks on plate, blood on skin.'] },
];
