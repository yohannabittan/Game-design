# Market research, November 2026

A research agent's report (2026-11-20), done with web search only: platform docs, RDAP and DNS were blocked from the cloud container. Most platform terms come from search excerpts and third-party guides, so treat figures without a first-party link as unverified. **Domains could not be checked** (see section 7).

## Summary

1. **Browser breakouts still happen with no budget**, but the 2026 ones are short, single-idea toys and daily games, not roguelikes. Dialed reached about 26M plays with no paid marketing once streamers picked it up; Krillion is a solo-made daily trivia game.
2. **Portals pay through ads.** A no-ads game earns nothing on Poki, CrazyGames or GameDistribution, but can be listed there for reach, or put on itch.io and Newgrounds, which need no ads.
3. **"No ads, no grind" is a real but small premium niche.** Premium mobile releases rose 77% in 2025, mostly ports and indie hits; a new, unknown pay-once game is hard to find.
4. **"Built with AI" draws attention and backlash.** Dialed's makers were profiled by BetaKit and Fast Company. The 2026 backlash targets slop and unreviewed output, so "built by agents, reviewed for craft, skill-based" is a defensible framing.
5. **The lesson worth borrowing is fast iteration on small hooks** (Supercell, Voodoo). Revenue is unproven: nothing found shows a solo, no-ads skill game earning real money.

## 1. Recent indie web hits

| The designer said | Most likely | Confidence |
| --- | --- | --- |
| krillion.io | **Krillion**, a free daily trivia game: seven questions, with rarer correct answers worth more ([Peerlist](https://peerlist.io/palashbagchi/project/krillion-space--daily-space-trivia-game), [Beebom](https://beebom.com/minecraft-krillion-trivia-game-launched/)) | High |
| "perceptio" | Possibly **Dialed** (dialed.gg), the colour-memory game ([PC Gamer](https://www.pcgamer.com/games/puzzle/humans-cant-reliably-recall-colours-dialed-gg-is-a-simple-colour-game-that-made-me-realise-i-dont-know-what-pink-looks-like)). No game called Perceptio was found, so this is a guess. | Medium |
| the size comparison game | **Size of Life** by Neal Agarwal (neal.fun), with illustrator Julius Csotonyi, December 2025 ([Laughing Squid](https://laughingsquid.com/size-of-life/)) | High |

| Game | What it is | How it spread | Audience | Money |
| --- | --- | --- | --- | --- |
| Krillion | Daily trivia scored by how rare your answers are; made by a solo developer under a pseudonym | Product Hunt | Unknown | None found |
| Dialed | Memorise five colours, then recreate them with sliders; later sound, time and shape games too | Streamers; Instagram and Discord ([BetaKit](https://betakit.com/meet-the-father-son-duo-hoping-to-turn-their-ai-side-project-into-a-gaming-company/)) | About 26M plays in 239 countries, no paid marketing; Fast Company says nearly 30M plays ([Fast Company](https://www.fastcompany.com/91541596/dialed-color-matching-game)) | Ads, "low tens of thousands" a month (secondary source) |
| neal.fun (Size of Life, Infinite Craft, The Password Game) | Interactive toys | Hacker News, blogs, social media | About 8.4M visits a month site-wide, Sep 2025 (Semrush estimate) | Ads; Agarwal lives off them ([Wikipedia](https://en.wikipedia.org/wiki/Neal_Agarwal)) |
| fly.pieter.com | Multiplayer flight sim built mostly by prompting an AI | The founder's audience on X | About 17k concurrent at peak ([404 Media](https://404media.co/this-game-created-by-ai-vibe-coding-makes-50-000-a-month-yours-probably-wont)) | Ads and sold in-game items; claimed $87k a month early on, reportedly faded since (unverified) |
| Wordle, Connections (NYT) | Daily puzzles | Bought as a funnel into subscriptions | Bundled into NYT subscriptions | Subscription |

**Pattern:** each hit is one idea you can explain in a sentence, play in 30 seconds and clip or share. The money is nearly always ads. None of them is a skill arcade game, so Arena's depth is a different bet.

## 2. Web game platforms (official docs unreachable; unverified unless linked)

| Platform | Requirements | How it pays | Fit for portrait, touch, no ads |
| --- | --- | --- | --- |
| **Poki** | Curated; SDK; responsive, 16:9 support, 30+ FPS ([Poki deals](https://sdk.poki.com/deals)) | Ads: 100% on traffic you send, 50/50 on Poki's own traffic (third-party guide); about 100M players a month; "some developers earn up to $1M a year" ([PocketGamer.biz](https://www.pocketgamer.biz/inside-pokis-vision-for-the-future-of-browser-gaming/)) | Stated spec is 16:9. **No ads conflicts with how it pays.** |
| **CrazyGames** | Basic Launch: 7–21 days with no ads, then Full Launch if the game performs; from 2026-11-23 click-through rate is compared against other games ([docs](https://docs.crazygames.com/requirements/intro/)) | Ad revenue share from Full Launch | **Basic Launch is a free test of demand.** |
| **GameDistribution** | SDK; pause and mute during ads | Ads, non-exclusive | Ads required |
| **itch.io** | Upload HTML5; no SDK, no ads | You choose the platform's share (0–100%, default 10%) ([itch.io](https://itch.io/updates/open-revenue-sharing)) | **Best fit.** Small audience, many game jams. |
| **Newgrounds** | Upload; medals API | No creator ad share found | The Flash-era culture; rewards craft, not money |

## 3. What top studios do now

- **Supercell kills most of its games:** it closed Squad Busters after two years, 75M players and over $100M spent, and is investing more in new games in 2026 ([Game World Observer](https://gameworldobserver.com/2025/10/30/we-were-wrong-supercell-to-shut-down-squad-busters-two-years-after-games-release)). *Borrow:* kill weak prototypes quickly and cheaply.
- **Hybrid-casual (Voodoo, Homa):** test and kill, but it runs on paid installs (cost per install up 30% in 2025, to $0.56) plus ads and in-app purchases. *Borrow the testing, not the model.*
- **Hit rate:** 1 in 120 new match-3 games reached $100k a month in H1 2026 ([PocketGamer.biz](https://www.pocketgamer.biz/puzzle-accounts-for-44-of-casual-mobile-earnings-in-h1-2026/)). Expect most games to earn nothing.
- **UGC platforms (Roblox, Fortnite):** pay out over $1B a year each to creators, but not to skill-arcade audiences. Skip for now.
- **Apple Arcade:** 250+ ad-free games, curated, by pitch. **Netflix** has scaled back its game ambitions.

## 4. The App Store and Google Play

| Item | Finding |
| --- | --- |
| Fees | Apple $99 a year, Google $25 once (neither confirmed this session) |
| Google testing | New personal accounts need a closed test with 12+ testers for 14 days before going live ([Google](https://support.google.com/googleplay/android-developer/answer/14151465)) |
| Wrapping | Capacitor (iOS and Android) or a Trusted Web Activity (Android) |
| Apple guideline 4.2 | Apps that feel like a website are rejected, enforced unevenly. A game with saves, haptics and Game Center is easier to defend. |
| Labels | New age-rating questions since Sep 2026, more due 2027-01-12; privacy label required. A no-tracking game keeps both simple. |
| Discovery | Premium releases rose 77% in 2025 to about 750 a year. A premium game with no budget won't be found without outside attention. |

## 5. Fighting enshittification

- **Balatro** proves a solo premium game can win (5M+ units), but with a publisher, on PC and console, not on the web.
- **Apple Arcade and Netflix** sell "no ads, no purchases" as a feature: the platform buys, not the player.
- **Store labels:** Google Play shows "Contains ads", so a game with neither ads nor purchases can say so honestly.
- **Verdict:** "no ads, no grind, pure skill" is a credible differentiator and a weak product on its own. It works best as a trust signal on a game that is already fun and shareable.

## 6. "Built with AI agents" as a story

- **Dialed** (father and son, AI tools): press coverage, no visible backlash.
- **fly.pieter.com:** press for "built in three hours"; the revenue claim faded.
- **Backlash in 2026:** Epic's "vibe-coded" launcher, a founder's shooter game that was taken down, modders against AI mashups. About half of Steam's October 2026 releases disclosed AI use, and those games get a smaller share of reviews ([Outlook Respawn](https://respawn.outlookindia.com/gaming/gaming-news/steam-ai-disclosures-near-50-in-october-2026)).
- **Takeaway:** lead with the game, and show the process openly (a build diary of the factory). Don't lead with "AI made this."

## 7. Domains

**Availability not checked:** lookups were blocked from the container. The designer checks them on a registrar. Prices are TLD list prices from search (Nov 2026), not checked for premium names:

| Ending | First year | Renewal | Notes |
| --- | --- | --- | --- |
| .com | about $10 | about $11 | Porkbun |
| .games | about $8 (sale) | about $27 | Porkbun; budget for the renewal |
| .ai | about $80–83 | about $80–83 | Cloudflare, Porkbun; **two-year minimum, so about $160+ on day one** (Namecheap about $90, renewing near $115) |
| .co | not found | not found | |

Short or one-word names (skill.games, playskill.com) are the likeliest to be taken or sold as premium; check aftermarkets (Sedo, Afternic, Dan.com) for any that show as taken.

- **The agent's extra ideas:** onethumb.games, skillyard.com, thumbcraft.com, keenhand.games, straightplay.games, plainskill.com, skillbench.ai, craftedskill.ai.
- **Risk, "skill games":** in US news this means gambling machines. Pennsylvania ruled unregulated "skill games" illegal slot machines from October 2026 ([Axios](https://www.axios.com/local/philadelphia/2026/09/22/skill-games-pennsylvania-gambling-deadline-ban)). Keep "skill games" out of a consumer name.
- **Risk, trademarks:** Skillsmith, Skillforge and Skillset are common in education and software. Run a USPTO search before buying.
- **One name or two:** a consultancy name reads as a business and a games name reads as a hobby, so consider two names.

## Three options

| Option | What | Cost | Risk |
| --- | --- | --- | --- |
| **A. Free web release, no ads** | itch.io and Newgrounds with a tip jar; short clips; the factory makes a tiny, clip-friendly game every week or two | Near zero beyond the plan and a domain | Earns little; builds an audience and learning |
| **B. Portal test** | One small game to CrazyGames Basic Launch (free, no ads), Poki if it does well; an ad-free build stays on our own site | Agent time for each SDK | Conflicts with no ads on those platforms; the only proven money path found |
| **C. Premium Arena on mobile, later** | Wrap Arena, add native touches, charge once; pitch Apple Arcade | $99 a year Apple, $25 Google, 12 testers for 14 days | 4.2 rejection risk, poor discovery; only after A shows people play Arena unprompted |

## Domain check via the GoDaddy connector (2026-11-20)

Prices are GoDaddy's (USD); other registrars renew some endings cheaper (Porkbun .games about $27).

| Free at normal price | First year | Renewal |
| --- | --- | --- |
| skillwright.co | $17.99 | $59.99 |
| skillwright.games | $9.99 | $57.99 |
| skillful.games | $9.99 | $57.99 |
| pureskill.games | $9.99 | $57.99 |
| skillset.games | $9.99 | $57.99 |
| onethumb.games | $9.99 | $57.99 |
| keenhand.games | $9.99 | $57.99 |
| craftedskill.ai | $209.98 (2-year minimum) | $159.99 |

Premium (for sale): skillfoundry.com $14,995; plainskill.com $8,888; thumbcraft.com $3,499.

Taken: skillwright.com, skillwright.ai, skillsmith.ai, skillsmith.co, skillforge.ai, skillfoundry.ai, skillworks.ai, skillhouse.ai, skill.games, pureskill.com, skillcade.com, playskill.com, onethumb.com, skillyard.com, skillbench.ai.

### Second round (GoDaddy, 2026-11-20)

Free at normal price: skillwrights.com ($12.99, renews $22.99), skillwright.net ($14.99 / $24.99), skillwright.dev ($15.99 / $23.99), skillwright.studio ($21.99 / $79.99), skillsmith.studio ($21.99 / $79.99), onethumb.studio ($21.99 / $79.99), deft.games, skillforge.games, skillcraft.games, skillpath.games, skillfirst.games ($9.99 / $57.99 each), skillworks.io ($59.99 / $89.99), skillmade.ai ($209.98 for 2 years / $159.99), agentskillfoundry.com, agentskillcraft.com, thumbsplay.com ($12.99 / $22.99).

Premium: skilltap.com $39,995; skillmade.com $11,095; skillworks.co $6,995; fingerplay.com $6,999; skillsmiths.com $4,388; skillsmithy.com $3,499; skillarcade.com $3,000.

Taken: skillwright.io, skillsmith.io, skillful.studio, skilled.games, skillshop.ai, skillhaus.ai/.com, skillkit.ai/.co, skillloom.com, skillmill.ai, skilltree.studio, deftly.games, nimble.games, keen.games, thumbskill.com, skillplay.games, arcadeskill.com, pureplay.games, fairplay.games, noads.games, agentskills.co, skillstack.ai.
