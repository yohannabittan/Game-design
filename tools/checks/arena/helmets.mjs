// Helmets: the secutor's two-eyehole dome is retired (ADR-0005: the save never stored a helmet, only the weapon, so nothing migrates). A run, a last
// fighter and a rival who carry the axe (the brute, who wore it) load wearing another helmet and the game never asks for the retired painting.
// The tailor's gold crest and red and white plumes are mirrored to trail back (`flip` in TUNING.kit.tailor); bronze and silver are painted trailing back already.
import { VET } from '../arena.mjs';
import { bout } from '../exact.mjs';

export default async function (t) {
  const g0 = await t.boot({ w: 667, h: 375, save: VET });
  await bout(g0, { w: 'axe', kit: ['helmet', 'chest'], arena: 'pit', rack: 1, gold: 20 });
  const data = await g0.ev(() => {
    const E = window.__engine, P = E.game.scenes.play, s = P.state; P.saveRun(E);
    const d = JSON.parse(JSON.stringify(E.save.data));
    d.last = { arena: 'pit', me: JSON.parse(JSON.stringify(s.me)) };
    const f = s.foe, rv = { name: 'Old Rival', ck: null, title: null, champion: true, size: f.size.id, vary: 0, prof: f.prof, weapon: 'axe', set: f.set.id, str: f.str, spd: f.spd, sta: f.sta, shield: false, dual: false, mace: false, partSeed: 123456, gear: [], gaps: {}, pair: null };
    d.rivals = { pit: rv }; d.run.rival = rv; d.run.rack = s.gauntlet.length - 1;
    return d;
  });
  t.ok('the axe run saves', data.run && data.run.me.weapon === 'axe' && data.last.me.weapon === 'axe' && data.rivals.pit.weapon === 'axe', JSON.stringify(data.run && data.run.me.weapon));
  t.ok('no saved helmet name: nothing to migrate', !JSON.stringify(data).includes('secutor'));

  const g = await t.boot({ w: 667, h: 375, raw: { __v: 19, data } });
  await g.ev(() => { const E = window.__engine; E.setScene('play', { resume: E.save.get('run') }); });
  await g.frames(120);
  const s = await g.ev(() => { const E = window.__engine, s = E.game.scenes.play.state; return { scene: E.sceneName, weapon: s.me.weapon, rack: s.rack, plates: s.me.plates.length, name: s.me.name, foe: !!s.foe }; });
  t.ok('the saved axe run resumes with its fighter', s.scene === 'play' && s.weapon === 'axe' && s.foe && s.plates === data.run.me.plates.length && s.name === data.run.me.name, JSON.stringify(s));

  // the menu draws the last fighter, and the rival's bout draws the rival
  await g.ev(() => { const E = window.__engine; E.save.set('run', null); E.setScene('menu'); });
  await g.frames(120);
  await g.ev(() => { const E = window.__engine; E.setScene('play', { seed: 5, arena: 'pit', me: E.save.get('last').me }); });
  await g.frames(120);
  const asked = await g.ev(() => performance.getEntriesByType('resource').map((r) => r.name).filter((n) => n.includes('secutor')));
  t.eq('a rival and a last fighter in axe load, and the retired helmet is never requested', asked, []);
  const fl = await g.ev(() => { const T = window.__engine.game.scenes.play.TUNING.kit; return T.helm.secutor === undefined && ['tailor-crest-gold', 'tailor-plume-red', 'tailor-plume-white'].every((n) => T.tailor[n].flip) && ['tailor-crest-bronze', 'tailor-crest-silver', 'tailor-plume-black'].every((n) => !T.tailor[n].flip); });
  t.ok('the secutor is gone from TUNING and the gold crest and the red and white plumes are mirrored', fl);

}
