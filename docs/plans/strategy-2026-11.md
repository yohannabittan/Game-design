# Strategy, November 2026

What the designer has decided about where the project goes. The build chat reads it and builds from it. Each entry quotes the designer's own words. Nothing here is a build instruction until it says **Decided**.

## The three aims (the designer, 2026-11-20)

> "Part of this project for me was to learn how to build a software factory that can operate purely with agents and minimal input, I feel we've learned many things. This was like an underlying meta objective."

> "The other aspect was create fun games for myself because I miss flash games, they made my youth."

> "But there is an economic question of can we generate value with these games which has a number of other aspects and facets to it."

Directions they raised:
- "Some super impressive demo type things with minimal resources."
- "A path for pushing good games out to at least a kind of portfolio website."
- "Research the market, the field, niches, etc. Because we don't have the millions of dollars of marketing of the top games on the Apple Store."

**Status:** under discussion. Not yet decided: which aim leads when they pull apart.

## What the designer added (2026-11-20)

> "krillion.io and perceptio I think it's called and others like the size comparison game are more recent successes of online games that have built a following even if they're not yet very profitable."

> "Definitely exploring what putting our games on platforms would be interesting."

> "Would be good to see what top studios are doing now."

> "We should understand what's needed to be on the App Store."

> "I'd like to see how we could fight the enshittification of the free online games that are all about monetizing and ads and things and just not fun games at all that are grindy idle not skill based etc."

> "Could you find domains [with] the word skill that could be interesting. I'm interested in that for 2 reasons, our games are skill based and also I want to make a consulting firm for building Claude skills for companies."

**Next:** a market research pass (one agent, report to `docs/plans/research-market-2026-11.md`), covering all of the above. Domain checks are part of it: this container cannot look up domains, so the agent checks them on the web.

## Names the designer already owns (2026-11-20)

actio.ai, newmail.ai (their company), armada.builders. Candidates found free: skillwrights.com, skillwright.co/.games/.net/.dev, deft.games, pureskill.games, onethumb.games (details in `research-market-2026-11.md`). **Not decided.**

## Paused (2026-11-20)

The designer: "This was interesting, we'll revisit at another time." Nothing here is decided yet; the build chat carries on with Arena as before. Open when we pick it up: which aim leads when they clash; which name goes to the games, the factory and the consulting firm; whether to try one portal test (CrazyGames Basic Launch); then the original Arena questions (roguelike structure, rank unlocks, champion trial rewards, pace and cost, how we work).

## Aligning the three aims (proposal, 2026-11-20)

> "I think I would be open to having some ads if the game is actually good."

> "Also not ads that give you things that make you better."

> "I'm down to have a first few games with high replay ability, share ability, viral ability and all this for community building."

**Proposed loop (not yet decided):**
1. The designer is the first gate: a game leaves the house only if they played it because they wanted to.
2. Portals are the second gate: CrazyGames Basic Launch (free, no ads, 7–21 days) measures whether strangers come back.
3. Games that pass both get ads on portals; our own site keeps an ad-free version.
4. The games and the factory story are the portfolio for the consulting idea.

**Fair-ads rules so far:**
- Ads only at natural breaks, never mid-play, and capped in frequency.
- **No ad ever gives anything that makes you better** (the designer's rule). An ad reward, if any, is cosmetic only: no power, no revive, no extra try that counts on a board.
- No timers, energy or grind that push you towards ads.
- A way to remove ads, or the ad-free version on our site.

**The first games aim at:** replayability, shareability and community. The working pattern is the daily game (Krillion, Dialed, Wordle): one seeded challenge a day, the same for everyone, and a result card to share. ADR-0023 (share card, daily seed, "beat my run" codes, no server) already plans the plumbing. A shared leaderboard or "rare answer" scoring like Krillion's needs a server: a new cost to decide on later.

## Ikigai (draft for the designer to correct, 2026-11-20)

> "I still think we should be planning our strat and figuring out our ikigai."

| Circle | First draft (orchestrator's guess, from this conversation) |
| --- | --- |
| What we love | Flash-era skill games; playing Arena and Trials; building with agents |
| What we're good at | An agent factory that turns a short idea into a polished, offline web game cheaply; the know-how of running that factory |
| What the world needs | Fun, fair skill games in a market full of ad-stuffed, grindy ones; companies that need help building agent skills and factories |
| What can pay | Agent and skills consulting (likeliest); portal ads on games that pass the fun gate (small); premium Arena (later, unproven) |

**Candidate centre:** "Prove that agents can make games worth playing (fair, skill-based, made with care), and teach companies to build factories like ours." The games are the proof, consulting is the income, and play is the joy.

**Status:** draft; the designer has not answered yet.
