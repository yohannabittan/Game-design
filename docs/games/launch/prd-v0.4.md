# Launch PRD v0.4 Build A: true steering, the first pairs of mechanisms, and an honest camera

Status: locked 2026-10-01. Builds on v0.3 (dev launch-v11). Feel-first rules of v0.3 stand: a dev-channel build, big TUNE knobs, only section G gates it; the balance pass comes after the designer's playtest.

Source: the designer on v0.3: "I've enjoyed that it feels more steerable and that I can do more, but we need to talk about true steerability: horizontal velocity and downward velocity." Decisions in chat: the parachute just killed the run, which makes no sense; slam a jelly and hit is a reward, slam and miss is a penalty ("hit harder for better reward when it's perfect", the Tiny Wings motto); a perfect jelly chain carrying weak equipment to the end is a good sign for a skill game; positive mechanisms need negative twins (similar concepts reskinned); and the camera must stop splitting the world when high.

## A. Physics: trade between the two speeds, never just destroy

Today drop taxes forward speed 25 percent per slam and the parachute bleeds about 40 percent per second, so both are brakes and holding boost dominates. From now on the two non-boost actions convert speed between the axes.

- **Parachute is a glider.** While open, fall speed converts into forward speed with a lift-to-drag ratio: high and fast it sinks slowly and keeps most of its forward speed (a long flat glide); slow, it stalls and floats. Opening it while falling fast flares (a short upward pop that spends fall speed). Net effect: spends height to buy distance. Tunables `glideRatio`, `glideSink`, `stallSpeed`, `flare`.
- **Condense is a slam that relaunches.** The impact speed comes back as a launch at `slamAngle` (about 40 degrees), keeping forward speed instead of taxing it: on plain ground `slamGround` (about 0.8) of the impact speed; on a jelly `slamJelly` (about 1.05) when centred, falling to plain-ground value at the jelly's edge (a centre band of `jellySweet` of its width). Dropping from higher hits harder. A slam that lands on nothing useful costs speed (the miss penalty). Each jelly is single use; a top-speed cap `maxSpeed` bounds any chain. A perfect chain may carry base equipment far: that is intended.
- **Boost is the corrector.** Limited fizz, refilled by centred jelly slams (`slamFizz`) and clouds; thrust fades with speed as in v0.3; boosting while condensed adds to the slam. Holding boost from the launch must no longer be the best plan (G4).
- The range finder shows each action's result as in v0.3.

## B. Mechanisms: first pairs (positive and negative twins)

Every negative is readable before it happens, punishes one lazy habit, sits on a severity ladder (tax, brake, deflect, stop; only caramel stops), resolves deterministically, and is marked by the range finder when the arc meets it.

| Positive | Negative twin | Behaviour |
|---|---|---|
| **Oven-vent thermal** (Bakery on): a shimmering warm column from a vent | **Freezer vent** (Bakery on): a frosty cold column | gliding inside a thermal adds upward speed (rise); inside a freezer column it pushes down. Not gliding: a small effect only. |
| **Mint jelly** with the slam bonus (A) | **Marshmallow pad** (Candy Meadow on): soft, white, puffy, clearly not a jelly | swallows the bounce: a slam sinks in and stalls (keeps little speed), a light touch rolls off slow. |
| **Candy-cane hill, downhill face** (Candy Meadow on): a smooth striped hill | **The uphill face** of the same hill | slamming onto a downslope turns fall into forward speed (the Tiny Wings move); slamming into an upslope crashes and loses most speed; flying off an upslope launches. Hills are terrain the ground follows, so plain touches follow the slope too. |

Placement: each object first appears early enough that a normal flight meets it (the thermal and freezer within the first 300 m; hills and marshmallow from 500 m); density rises with distance. Geysers and clouds move earlier too, so every place's mechanism is met in the first few sessions (Soda Springs and Gingerbread Town distances may shorten; the harness reports where a good player's median flight ends).

## C. Camera: one honest mapping

Today the view zooms to 0.45, then pans the sky while the ground band stays pinned, so the drawn ground is not where the ground is and the range finder goes below it. Replace with one mapping used for everything:

- zoom out further (`zoomMin` about 0.3) with the mochi kept at its minimum sprite size;
- above that, compress height smoothly (true to scale near the ground, each extra metre taking less screen higher up), with the ground always on screen;
- the mochi, the range finder, birds, clouds, thermals and every object use the same mapping, so the arc always ends on the drawn ground at the correct horizontal place; the "m up" label stays; the dotted drop line goes.
- Drawing only: the physics is unchanged.

## D. TUNE

At most four sliders on screen: glide, slam power, jelly bonus, boost thrust; Floaty and Punchy presets updated to the new physics.

## E. Out of scope (Build B)

Chocolate river skipping, sugar rings, gumball cannons, bees, storm clouds, gum strands, fans, ants; the menu overlap fix may ride along if trivial.

## G. Must-holds

1. Deterministic at 30, 60 and 120 fps with every new object and action.
2. Careless profile reaches 500 m on at least 40 percent of flights at base.
3. Nothing stuck; every flight ends; no infinite chain (the speed cap holds).
4. Steering beats holding: for the good profile, a glide-and-slam policy flies further than "hold boost from launch" on most seeds, and a centred-slam policy beats a never-slam policy.
5. Camera: on very high flights (the highest the harness can make), the ground stays on screen and the range finder's end is on the drawn ground every frame (checked in Chromium).
6. Frame time within 10 percent of v0.3 in flight.
7. Saves migrate; 14 px and 44 px; smoke passes.

## H. Shop v2 (Build A2, right after the designer tunes Build A's feel; prices in the balance pass)

Designer: "upgrades should reskin something, either the launcher or the character, or the glider or the slam ability; it could also be stuff like a sugar shield that puts you in a transparent bubble and gives you one missed slam with no penalty." Rule: every level of every upgrade visibly reskins one of four things (launcher, mochi, glider, slam), and gear lowers the skill needed, never replaces it. Seven upgrades, three levels each, one verb each:

| Upgrade | Verb | Effect per level | Reskins (level 1 / 2 / 3) |
|---|---|---|---|
| Spring Coil | launch | more launch power | launcher: copper coil / brass double coil / gold coil with sparks on fire |
| Steady Gauge | launch | slower gauge, wider zones | launcher: plain dial / brass dial with a glass face / gold dial that glows in the gold zone |
| Brass Telescope | read | longer range finder | launcher: spyglass / brass telescope / observatory dome on the machine; the arc's dots turn brass then gold |
| Fizz Tank (Cola Rocket folded in) | boost | more fizz, then stronger thrust | mochi: one bottle / twin bottles / a gold siphon; the boost trail goes cola, cherry, golden |
| Sugar Glaze | glide | better glide ratio, later stall | glider: rice-paper sail / spun-sugar sail / stained candy-glass sail that catches the light |
| Pounding Mallet | slam | wider jelly sweet centre (not a stronger slam) | slam: dust puff / sugar burst / a shockwave ring with sprinkles; the machine carries a wooden then lacquered then gold mallet |
| Sugar Shield | forgive | level 1: one missed slam per flight costs nothing; level 2: also bounces off one marshmallow or freezer push; level 3: two charges | mochi: a transparent sugar bubble that pops with a crystal sound when used, re-forming on the next flight |

Toasted Crust from the chat discussion is dropped in favour of the Sugar Shield (one defensive upgrade). The shop card shows the next level's look; the mochi and machine show every owned level at once. Saves migrate (Cola Rocket levels become Fizz Tank levels beyond Fizz Tank's own, capped; Sugar Glaze levels kept with the new meaning).
