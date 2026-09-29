// Ink, layers 1 to 3 and the v0.2 dynamic needle, the v0.3 needle inertia and the v0.4 gap hint: the mechanic, the progression, the juice, a speed-driven ink radius with momentum, and a highlight for the gaps that are hard to find. Hold the tattoo gun, lay ink inside the stencil, never leave the line three times.
// Grey box: shapes and four colours only. Ten stencils, authored as data and verified with tools/sim-ink.mjs.

import { clamp, dist, ease } from './engine.js';

// Design-space units unless stated. Names match PRD section 16; the rest are marked.
const TUNING = {
  designW: 360,          // Design space width
  designH: 640,          // Design space height
  needleOffset: 56,      // Screen pixels from the finger to the needle tip, straight up
  needleR: 7,            // Needle radius; ink is laid within this of the needle centre
  cellSize: 3,           // Coverage grid cell size
  sampleSpacing: 2,      // Distance between path samples along the needle's movement
  slipTolerance: 2,      // The needle centre may be this far outside the outline before a slip counts
  maxSlips: 3,           // Third slip ruins the piece
  starPercents: [70, 80, 90, 95, 99], // Percentage thresholds for 1 to 5 stars
  passPercent: 70,       // Below this at the timer is a fail
  timerMultEarly: 2.2,   // Timer is this times the perfect-path time to 99 percent, stencils 1 to 4 (read by tools/sim-ink.mjs)
  timerMultMid: 1.9,     // Same for stencils 6 to 9
  timerMultBoss: 1.7,    // Boss stencil 5 (stencil 10 uses timerMultFinal)
  timerMultFinal: 1.6,   // Boss stencil 10
  inkStrokeWidth: 14,    // Drawn ink stroke width at the classic radius (twice needleR); the dynamic needle scales it with the radius
  outlineWidth: 2,       // Stencil outline width
  particleCap: 200,      // Max live particles; every emit is trimmed to fit

  // Layer 1 additions, not in the PRD table.
  bg: '#5a3a2c',         // Skin field; the engine reads this name and fills the whole screen with it
  stencilBlue: '#9bd6ff',// Goal: the stencil outline
  inkColor: '#090d18',   // Progress: near-black with a blue cast
  slipRed: '#ef4444',    // Danger: slip marks and the slip counter
  machineBody: '#1a1d29',
  machineEdge: '#c9ced8',
  cardColor: '#1b1410',
  textColor: '#f4ece4',
  starColor: '#ffd166',
  buttonFill: '#3b82f6',
  buttonAltFill: '#3a2a22',
  endHold: 0.6,          // Seconds the finished piece stays on screen before the card
  hudTop: 16,            // Screen px from the safe-area top to the HUD
  slipMarkSize: 6,       // Half-length of a slip cross
  machineGripW: 22,      // Screen px width of the machine at the finger
  machineTubeW: 8,       // Screen px width of the machine near the needle
  circlePoints: 96,      // Vertices of the circle stencil polygon

  // Layer 2 additions.
  gridCols: 5,           // Stencil select tiles per row
  gridGap: 8,            // Gap between tiles (screen px)
  tileH: 92,             // Tile height (screen px, at least 44)
  lockColor: '#7a6558',
  inkLayerMaxDpr: 2,     // The cached ink layer is drawn at most this many pixels per CSS pixel

  // v0.2 dynamic needle (PRD v0.2 section E; the game since v0.4). Speeds are design units per second of finger travel.
  slowSpeed: 175,        // At or below this speed the ink radius is needleR * wideScale
  fastSpeed: 520,        // At or above this speed the ink radius is needleR * thinScale
  wideScale: 1.8,        // Radius multiplier when slow
  thinScale: 0.65,       // Radius multiplier when fast
  speedWindow: 24,       // Units of travel over which speed is measured (never per frame)

  // v0.3 needle inertia (PRD v0.3 sections A, E). The Flowy values won the phone playtest. Radius units are design units per second.
  growRate: 14,          // Radius units per second the ink radius widens toward its target
  shrinkRate: 30,        // Radius units per second it narrows toward its target
  floorScale: 0.8,       // The radius never drops below needleR * floorScale
  physicsStep: 1 / 120,  // Fixed step (seconds) for integrating the radius while the finger holds still
  holdGap: 0.06,         // Seconds without a movement event before the finger counts as holding still

  // v0.4 gap hint (PRD v0.4 section E). Cosmetic: never changes coverage, slips, the timer or stars.
  hintPercent: 95,       // Fill percentage at which the hint turns on (101 turns it off)
  hintShare: 0.1,        // A cluster of unfilled cells is shown when it holds at least this share of the unfilled cells
  hintEvery: 0.25,       // Seconds between hint recomputations
  hintAlphaMin: 0.15,    // Pulse floor
  hintAlphaMax: 0.45,    // Pulse peak
  hintPeriod: 1.2,       // Pulse period, seconds

  // Layer 3: feel only. Nothing here touches coverage, slips, the timer, stars or saves. Seconds, screen px and design units as marked.
  juice: {
    settleSec: 0.22, settleFrom: 0.82,       // Machine scale pop on touch down (scale about the needle tip, so the tip never moves)
    vibAmp: 0.9, vibHz: 55, vibHold: 0.09,   // Machine body vibration (screen px, Hz, seconds it lingers after the last ink)
    glintHz: 13, glintLen: 4.5,              // Needle tip sparkle rate and half-length (screen px)
    tickEvery: 42, tickMinGap: 0.085,        // Needle tick: design units of inked travel, and the minimum seconds between ticks
    tickFreq: 1900, tickFreqAlt: 1500, tickDur: 0.02, tickGain: 0.035,
    sprayMinSpeed: 240, sprayGap: 0.035, sprayCount: 2, spraySpeed: 70, sprayLife: 0.35, spraySize: 1.8, // Tip specks (design units per second for the speed gate)
    inkSheen: '#4a64ad',                     // Second ink tone for bursts
    slipFlashSec: 0.45, slipPopSec: 0.3, slipPopFrom: 1.5, // Outline red flash, counter pop
    slipShake: 2, slipShakeSec: 0.15, slipHaptic: 30, ruinHaptic: 50, slipBurst: 6,
    pctStepFrom: 1.1, pctStepSec: 0.18,      // Whole-percent step at or past the first star threshold
    pctThresholdFrom: 1.35, pctThresholdSec: 0.32, pctStarSec: 0.7, // Crossing a star threshold: bigger pop and the number turns star colour
    timerPulseFrom: 1.18, timerPulseSec: 0.28, timerPulseSecs: 5, // Timer pulse each second in the last few seconds
    timerTickSecs: 3, timerTickFreq: 700, timerTickDur: 0.03, timerTickGain: 0.05,
    finishHaptic: 30, finishFlashSec: 0.3, finishFlashAlpha: 0.55, finishFlashColor: '#eaf6ff',
    burstPoints: 36, burstPer: 3, burstSpeed: 110, burstLife: 0.75, burstSize: 3.6,
    outlineFadeSec: 0.5, outlineEndAlpha: 0.12, machineFadeSec: 0.25,
    smearSec: 0.5, smearDrop: 3, smearColor: '#80838c', loseDelay: 0.2,
    cardSlideSec: 0.45, cardDim: 0.55, cardFrom: 0.5, // Card slide-up and dim; the slide starts this fraction of the screen height below
    starDelay: 0.2, starStagger: 0.08, starSec: 0.25, starBurst: 5,
    buttonGap: 0.08, buttonPopSec: 0.18,     // Buttons appear this long after the last star lands, and pop in
    cleanDelay: 0.1, cleanPopSec: 0.3, cleanSweepSec: 0.7, cleanSweepAlpha: 0.4, cleanSweepColor: '#9bd6ff',
    menuPopDelay: 0.18, menuPopSec: 0.4, menuPopFrom: 0.8,
  },
};
const T = TUNING;
const J = T.juice;

const circle = (cx, cy, r, n = T.circlePoints) =>
  Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * Math.PI * i) / n), cy + r * Math.sin((2 * Math.PI * i) / n)]);

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

// Stencil data. `shape` is a list of closed polygons in the 360x640 design space, even-odd (a polygon inside another is a hole).
// Entries are pasted from the content shards' JSON (see docs/games/ink/README.md); tools/sim-ink.mjs verifies each one.
const STENCILS = [
  {
    // Teaches: hold and move, fill the middle fast, the edge is round and forgiving.
    // Intended path: a spiral from the centre out at 12 units per turn (needleR 7 leaves no gap), then one lap 3 units inside the rim.
    // About 4500 units of travel, 14.9 s to 99 percent at 300 units/s; timer 2.2x per the PRD rule.
    name: 'Circle', timer: 33, boss: false,
    shape: [circle(180, 320, 125)],
  },
  // Teaches tip 3 (lift at corners) and tip 1. Path: sweep rows through the table and body, then ride each of the seven edges 3.5 units inside, lifting at every corner and at the bottom point.
  { name: "Diamond", timer: 32, boss: false, shape: [[[130,150],[230,150],[295,262],[295,276],[180,540],[65,276],[65,262]]] },
  // Teaches tip 2 (work along the edge, never across it) at the top notch. Path: sweep rows in each lobe, lifting at the notch instead of crossing it, then ride the outline inside the edge, round the notch, and lift at the bottom point.
  { name: "Heart", timer: 27, boss: false, shape: [[[180,238.7],[185.4,233],[191.3,228],[197.5,223.7],[204.2,220.2],[211.1,217.6],[218.2,215.8],[225.4,214.9],[232.6,214.9],[239.8,215.8],[246.9,217.6],[253.8,220.2],[260.5,223.7],[266.7,228],[272.6,233],[278,238.7],[282.9,245.1],[287.1,252],[290.7,259.4],[293.7,267.2],[295.9,275.4],[297.4,283.7],[298.2,292.3],[298.2,300.8],[297.4,309.3],[295.9,317.7],[293.7,325.8],[290.7,333.7],[287.1,341.1],[282.9,348],[278,354.4],[180,470],[82,354.4],[77.1,348],[72.9,341.1],[69.3,333.7],[66.3,325.8],[64.1,317.7],[62.6,309.3],[61.8,300.8],[61.8,292.3],[62.6,283.7],[64.1,275.4],[66.3,267.2],[69.3,259.4],[72.9,252],[77.1,245.1],[82,238.7],[87.4,233],[93.3,228],[99.5,223.7],[106.2,220.2],[113.1,217.6],[120.2,215.8],[127.4,214.9],[134.6,214.9],[141.8,215.8],[148.9,217.6],[155.8,220.2],[162.5,223.7],[168.7,228],[174.6,233]]] },
  // Teaches tip 3 hard: five sharp tips. Path: sweep the body and each arm in short rows, then ride each arm up one side and down the other 3.5 units inside the edge, lifting at every tip.
  { name: "Star", timer: 24, boss: false, shape: [[[180,200],[217,299],[322.7,303.6],[239.9,369.5],[268.2,471.4],[180,413],[91.8,471.4],[120.1,369.5],[37.3,303.6],[143,299]]] },
  // Boss, teaches tip 4. Path: ride the line a needle width inside, outer edge then inner edge, then the middle lane, tip to tip at constant speed, lifting at each tip.
  { name: "Crescent", timer: 19, boss: true, shape: [[[338.2,144.7],[312.7,133.6],[286,125.4],[258.3,120.5],[230,119],[201.5,121.2],[173.3,127.1],[146,136.7],[120,150],[95.8,166.7],[74.1,186.6],[55.2,209.3],[39.6,234.5],[27.5,261.7],[19.3,290.2],[15.1,319.5],[14.9,349.1],[18.8,378.3],[26.5,406.7],[38,433.5],[52.7,458.5],[70.5,481.1],[91,501.1],[113.6,518.1],[138,532.2],[163.7,543.1],[190.3,551],[196.5,551],[201.9,547.8],[205,542.5],[205,536.3],[201.9,530.9],[196.5,527.8],[173.6,519],[152.3,507],[133,492.3],[116,475.4],[101.4,456.6],[89.3,436.3],[80,414.9],[73.4,392.8],[69.5,370.1],[68.2,347.3],[69.7,324.7],[73.6,302.4],[80.1,280.8],[89.1,260.1],[100.3,240.5],[113.8,222.2],[129.4,205.5],[146.9,190.7],[166.2,178],[187.2,167.6],[209.4,159.8],[232.7,154.8],[256.6,152.8],[280.8,154],[304.8,158.4],[328,166.4],[334.2,167.5],[340,165.4],[344,160.6],[345.1,154.5],[342.9,148.7]]] },
  // Teaches tips 2 and 3 together. Path: ride the inside of each of the seven edges in turn (never across), lifting at every point, then fill the middle with slanted rows.
  { name: "Bolt", timer: 30, boss: false, shape: [[[166,110],[298,110],[234,272],[310,272],[98,560],[170,352],[50,352]]] },
  // Teaches tip 4 on a convex and a concave edge. Path: three concentric laps of the 35-unit band, outer edge lane, inner edge lane, then the middle, spiralling between laps with no lift.
  { name: "Halo", timer: 20, boss: false, shape: [[[345,335],[341.8,367.2],[332.4,398.1],[317.2,426.7],[296.7,451.7],[271.7,472.2],[243.1,487.4],[212.2,496.8],[180,500],[147.8,496.8],[116.9,487.4],[88.3,472.2],[63.3,451.7],[42.8,426.7],[27.6,398.1],[18.2,367.2],[15,335],[18.2,302.8],[27.6,271.9],[42.8,243.3],[63.3,218.3],[88.3,197.8],[116.9,182.6],[147.8,173.2],[180,170],[212.2,173.2],[243.1,182.6],[271.7,197.8],[296.7,218.3],[317.2,243.3],[332.4,271.9],[341.8,302.8]],[[310,335],[307.5,360.4],[300.1,384.7],[288.1,407.2],[271.9,426.9],[252.2,443.1],[229.7,455.1],[205.4,462.5],[180,465],[154.6,462.5],[130.3,455.1],[107.8,443.1],[88.1,426.9],[71.9,407.2],[59.9,384.7],[52.5,360.4],[50,335],[52.5,309.6],[59.9,285.3],[71.9,262.8],[88.1,243.1],[107.8,226.9],[130.3,214.9],[154.6,207.5],[180,205],[205.4,207.5],[229.7,214.9],[252.2,226.9],[271.9,243.1],[288.1,262.8],[300.1,285.3],[307.5,309.6]]] },
  // Teaches tip 6, plan a path with no re-crossing: one lobe at a time. Path: for each of the four lobes a full lap 1.5 units inside the rim, then a spiral in to the middle at 13 units a turn, lift between lobes; a small spiral for the centre; lift; then down the stem.
  { name: "Clover", timer: 54, boss: false, shape: [[[105.2,138.5],[116,138],[127,139.1],[137.5,141.6],[143,143.6],[148,145.8],[157.5,151.3],[166,157.9],[173.5,165.6],[180,174.4],[183.5,169.3],[187.5,164.4],[191.7,160],[196.5,155.7],[201.5,151.9],[206.9,148.5],[212.5,145.6],[218,143.2],[224,141.2],[230,139.7],[236,138.6],[242.5,138.1],[249,138.1],[255,138.5],[261,139.5],[267,140.9],[277,144.4],[286,149],[294.6,155],[302.5,162.2],[309.4,170.5],[314.9,179.5],[319.2,189],[322.1,199],[323.2,205],[323.8,211],[324,217],[323.7,223],[322.9,229],[321.8,234.5],[320.1,240.5],[318,246],[315.5,251.5],[312.5,256.8],[309.4,261.5],[305.5,266.4],[301.5,270.8],[297,275],[292.5,278.6],[287.6,282],[294,286.5],[299.8,291.5],[305,297],[309.7,303],[313.8,309.5],[317.4,316.5],[320.1,323.5],[322.1,331],[323.4,338.5],[324,346],[323.8,354],[322.8,361.5],[321.1,369],[318.6,376.5],[315.5,383.5],[311.5,390.4],[306.3,397.5],[300.5,403.8],[294,409.5],[286.8,414.5],[279,418.7],[271,421.9],[262.5,424.2],[254,425.6],[245.5,426],[237,425.5],[228.5,424],[220,421.5],[212,418.2],[204.5,414],[198,409.5],[190.5,402.8],[190.3,403],[193.6,424],[200.6,460],[202.9,473.5],[204.7,487],[205.9,501],[206.1,511],[205.9,521],[204.6,537],[201.9,554],[201,555.7],[199,556.9],[197,556.9],[195.5,556.2],[194.5,555],[194,553],[196.1,537],[197,521.5],[196.8,507.5],[195,489.5],[191.1,467.5],[180.5,420],[176.2,395.5],[176,395.3],[172.1,400],[167.8,404.5],[159.5,411.4],[150.5,416.9],[140.5,421.4],[130,424.3],[119,425.8],[108,425.8],[97,424.1],[86.5,421],[76.5,416.4],[71.6,413.5],[67,410.2],[58.7,403],[51.5,394.7],[45.6,385.5],[41,375.5],[37.9,365],[36.8,359],[36.2,353],[36,347],[36.3,341],[37.1,335],[38.2,329.5],[39.9,323.5],[42,318],[44.5,312.5],[47.5,307.2],[50.6,302.5],[54.5,297.6],[58.5,293.2],[63,289],[67.5,285.4],[72.4,282],[67.3,278.5],[62.4,274.5],[57.7,270],[53.5,265.2],[49.9,260.5],[46.5,255],[43.6,249.5],[41,243.5],[39,237.5],[37.6,231.5],[36.6,225.5],[36.1,219],[36.1,212.5],[36.6,206.5],[37.7,200],[39.2,194],[41,188.5],[43.3,183],[45.9,178],[48.9,173],[52.1,168.5],[55.9,164],[59.7,160],[64,156.1],[68.5,152.6],[73.2,149.5],[78.5,146.5],[83.5,144.2],[94,140.6],[99.5,139.4]]] },
  // Teaches tips 4 and 5, edges first while fresh then flood. Path: the bow as five closed laps with a lift between each, first the rim lap 1.5 inside the edge, then the hole-edge lap, then three flood laps between them; the two collars; the shaft edge lanes 6 inside each side, then the middle lane; lift; each tooth as two lanes 6 inside its edges, lifting at every tip.
  { name: "Key", timer: 28, boss: false, shape: [[[172.7,114.3],[177.5,114],[182.5,114],[187.5,114.3],[192.5,114.7],[197.5,115.4],[202.3,116.3],[207.3,117.5],[212,118.8],[216.8,120.4],[221.3,122.2],[225.8,124.2],[230.3,126.4],[234.8,128.9],[238.9,131.5],[243,134.3],[247,137.3],[250.9,140.5],[254.5,143.8],[258,147.3],[261.4,151],[264.5,154.8],[267.5,158.8],[270.5,163],[273.1,167.3],[275.5,171.5],[277.7,176],[279.7,180.5],[281.6,185.3],[283.2,190],[284.5,194.8],[285.6,199.5],[286.6,204.5],[287.3,209.8],[287.8,215.3],[288,220.5],[287.9,226],[287.6,231.5],[287,236.8],[286.1,242.3],[284.9,247.5],[283.5,252.8],[281.9,257.8],[280,262.8],[277.8,267.8],[275.5,272.5],[272.8,277.3],[270,281.8],[266.8,286.3],[263.5,290.5],[259.8,294.8],[256.2,298.5],[252.3,302.3],[248.2,305.8],[244,309],[239.5,312.1],[234.9,315],[230.3,317.6],[225.5,319.9],[220.5,322.1],[215.5,324],[210.5,325.6],[205.5,326.9],[200,328.1],[194.3,329.1],[194,329.3],[194,340],[203.8,340],[204,340.3],[204,352.8],[203.8,353],[194,353],[194,359],[198.8,359],[199,359.3],[199,370.8],[198.8,371],[194,371],[194,470],[243.8,470],[244,470.3],[244,490.8],[243.8,491],[194,491],[194,505],[229.8,505],[230,505.3],[230,525.8],[229.8,526],[194,526],[194,539],[245.8,539],[246,539.3],[246,559.8],[245.8,560],[166.3,560],[166,559.8],[166,371],[161.3,371],[161,370.8],[161,359.3],[161.3,359],[166,359],[166,353],[156.3,353],[156,352.8],[156,340.3],[156.3,340],[166,340],[166,329.3],[165.8,329.1],[161,328.3],[156.3,327.4],[148.5,325.3],[140.5,322.5],[132.8,319.1],[125.3,315.1],[118,310.4],[111.2,305.3],[104.8,299.5],[98.8,293.3],[93.4,286.5],[88.6,279.5],[84.3,272],[80.6,264.3],[77.6,256.3],[75.2,248],[73.4,239.5],[72.7,234],[72.2,228.5],[72,223],[72.1,217.3],[72.5,211.5],[73.2,206],[74.2,200.5],[75.4,195],[77,189.5],[78.8,184.3],[80.9,179],[83.3,174],[85.9,169],[88.8,164.2],[91.9,159.5],[95.3,155],[98.8,150.8],[102.8,146.5],[106.8,142.6],[111,138.9],[115.5,135.4],[120,132.2],[124.8,129.2],[129.8,126.4],[134.8,123.9],[140,121.7],[145.3,119.7],[150.5,118.1],[156,116.7],[161.5,115.6],[167,114.8]],[[180,170],[174.8,170.3],[169.8,171],[164.8,172.3],[160,174],[155.3,176.3],[151,178.8],[147,181.8],[143.3,185.2],[139.8,189],[136.8,193],[134.3,197.3],[132,202],[130.3,206.8],[129,211.8],[128.3,216.8],[128,222],[128.3,227.3],[129,232.3],[130.3,237.3],[132,242],[134.3,246.7],[136.8,251],[139.8,255],[143.2,258.8],[147,262.2],[151,265.2],[155.3,267.8],[160,270],[164.8,271.7],[169.8,273],[174.8,273.7],[180,274],[185.3,273.7],[190.3,273],[195.3,271.7],[200,270],[204.7,267.8],[209,265.2],[213,262.2],[216.8,258.8],[220.2,255],[223.2,251],[225.8,246.7],[228,242],[229.7,237.3],[231,232.3],[231.7,227.3],[232,222],[231.7,216.8],[231,211.8],[229.7,206.8],[228,202],[225.8,197.3],[223.2,193],[220.2,189],[216.8,185.3],[213,181.8],[209,178.8],[204.7,176.3],[200,174],[195.3,172.3],[190.3,171],[185.3,170.3]]] },
  // Boss, teaches everything with a tight timer. Path: three lanes along the body from tail to head (one 6.5 units inside each edge, one down the middle, converging at the tips), lifting at the tail tip and the snout; follow every bend without cutting the inside.
  { name: "Snake", timer: 22, boss: true, shape: [[[95.2,546.3],[107.1,545.2],[119,543.5],[130.7,541.4],[163.3,534.8],[173.3,533.1],[183.4,531.6],[193.6,530.5],[203.8,529.6],[237.9,527.6],[250.5,526.7],[263.9,525.2],[268.8,524.2],[271.5,523.2],[274.1,522.1],[276.5,520.7],[279.4,518.7],[281.5,516.9],[283.9,514.5],[285.6,512.4],[287.6,509.5],[289.1,506.5],[290.2,504],[291,501.4],[291.6,498.7],[291.9,496],[292,493.3],[291.9,490.6],[291.3,487.2],[290,482.7],[288.2,479],[285.5,475],[282.8,472],[279.1,469],[275.6,466.9],[271.8,465.3],[267.2,464.1],[244.1,461.9],[200.4,455.8],[189.9,454.6],[179.5,453.8],[169,453.3],[158.4,453.2],[124.6,454],[113.3,454.1],[102.8,453.9],[93.2,453.4],[87.9,452.8],[81.5,451.3],[76.6,449.5],[70.6,446.8],[65,443.3],[59.8,439.3],[55.1,434.7],[51.7,430.6],[48,425.2],[45.6,420.5],[43.1,414.4],[41.3,408.1],[40.3,401.6],[40,395],[40.4,388.4],[41.6,381.9],[43.5,375.6],[46.1,369.6],[48.7,365],[52.5,359.6],[56,355.6],[59.8,352],[65,347.9],[69.4,345.1],[74.1,342.8],[79,340.8],[84.1,339.3],[89.2,338.3],[112.6,336.1],[156.1,330],[167.4,328.7],[177.8,327.9],[189.3,327.3],[200.7,327.2],[236.9,328],[249.5,328.1],[264.5,327.5],[267.2,327.2],[269.9,326.6],[272.5,325.7],[275,324.7],[277.4,323.4],[279.7,321.9],[281.8,320.2],[283.8,318.3],[285.5,316.3],[287.1,314],[288.5,311.7],[289.7,309.2],[290.6,306.7],[291.3,304],[291.8,301.4],[292,298.6],[292,295.9],[291.7,293.2],[290.8,289.2],[289.1,284.8],[286.8,280.6],[283.8,276.9],[280.2,273.8],[276.2,271.2],[271.8,269.3],[267.9,268.2],[265.2,267.8],[254.5,267],[244.1,265.9],[200.4,259.7],[189.9,258.5],[180.4,257.8],[169.9,257.3],[158.4,257.2],[124.6,258],[113.3,258.1],[102.8,257.9],[93.2,257.4],[87.9,256.7],[82.8,255.6],[77.8,254],[72.9,251.9],[68.3,249.4],[63.9,246.5],[59.8,243.3],[56,239.6],[52.5,235.6],[49.4,231.4],[46.7,226.8],[44,220.8],[42.3,215.9],[40.8,209.4],[40.1,204.2],[40,198.9],[40.3,193.7],[41.3,187.2],[42.7,182.1],[44.5,177.1],[47.4,171.2],[50.2,166.8],[53.3,162.6],[57.8,157.7],[61.8,154.3],[67.2,150.5],[71.8,147.9],[77.8,145.2],[84.1,143.3],[90.6,142.1],[106.9,140.7],[125.2,138.6],[145.1,137.2],[154.3,136.1],[157.3,135.4],[160.3,134.3],[171.3,128.8],[175.4,127],[178.5,125.9],[181.7,125.2],[183.8,125],[191.3,126.2],[200.7,128],[211,130.3],[225,133.9],[249.6,140.7],[258.6,143.2],[263.6,145],[264.7,145.5],[263.7,146.2],[260.8,147.6],[253.8,150.2],[245.7,152.6],[231.4,156],[199.7,162.5],[185.6,166],[182.8,165.9],[179,165.2],[168.3,161.7],[164.3,160.6],[160.3,160],[157.4,160],[149.6,161.3],[132.1,165.3],[125.1,166.7],[109.7,168.6],[94.1,169.8],[91.4,170.3],[88.8,171],[86.3,172],[83.8,173.2],[81.5,174.6],[78.7,176.6],[76.7,178.4],[74.9,180.4],[73.2,182.6],[71.8,184.9],[70.6,187.4],[69.6,189.9],[68.8,192.5],[68.3,195.2],[68,197.9],[68,201.3],[68.3,204],[68.8,206.7],[70.3,211.2],[72.1,214.9],[74.5,218.2],[77.2,221.3],[80.9,224.3],[84.4,226.4],[88.2,228],[92.8,229.2],[95.5,229.5],[100.9,229.8],[114.3,230.1],[126,230],[152.1,229.3],[165.5,229.2],[178,229.6],[190.5,230.5],[208,232.5],[246.4,238],[270.8,240.3],[275.9,241.3],[281,242.8],[285.9,244.7],[289.4,246.5],[295,249.9],[300.2,254],[304.9,258.6],[308.3,262.6],[312,268.1],[315,274],[317.3,280.1],[318.7,285.2],[319.7,291.7],[320,297],[319.7,303.5],[318.7,310],[317.3,315.1],[315,321.3],[312,327.1],[308.3,332.6],[304.9,336.7],[301.2,340.4],[297.2,343.8],[291.7,347.5],[287.1,349.9],[281,352.4],[275.9,353.9],[270.8,355],[262.4,355.7],[248.8,356.1],[235.4,356],[200.7,355.2],[190.1,355.3],[179.6,355.8],[171,356.5],[161.5,357.5],[120,363.4],[107.6,364.8],[94.8,365.8],[90.1,366.7],[87.5,367.5],[85,368.6],[82.6,369.9],[80.3,371.4],[78.2,373.1],[76.2,374.9],[74.5,377],[72.9,379.2],[71.5,381.6],[70.3,384],[69.4,386.6],[68.7,389.2],[68.2,391.9],[68,394.6],[68,397.3],[68.3,400.1],[69.4,404.7],[70.9,408.5],[73.2,412.6],[76.2,416.3],[79.8,419.5],[83.8,422.1],[88.2,424],[92.1,425.1],[97.1,425.6],[110.5,426.1],[123.1,426.1],[149,425.4],[161.3,425.2],[174.9,425.5],[188.4,426.3],[207,428.4],[246.4,434],[270.8,436.3],[274.6,437],[279.7,438.4],[283.4,439.8],[287.1,441.3],[292.8,444.5],[297.2,447.5],[301.2,450.9],[304.9,454.6],[309.1,459.7],[312,464.1],[314.4,468.8],[316.5,473.7],[318.4,479.9],[319.4,485.1],[319.9,490.4],[320,495.6],[319.6,500.9],[318.7,506.1],[317.3,511.2],[315.5,516.1],[312.6,522],[310.5,525.4],[308.2,528.6],[303.9,533.5],[301,536.2],[298,538.7],[292.5,542.3],[289.1,544.2],[285.5,545.8],[279.4,547.9],[275.6,548.8],[271.8,549.4],[268,549.8],[263.3,549.9],[255,549.7],[246.7,549.3],[233.5,548.2],[199.7,544.6],[188.9,543.8],[179.1,543.4],[166.2,543.5],[153.3,544.2],[141.4,545.1],[111.4,548.1],[95.4,549.2]],[[191.9,135.8],[191.6,137.4],[190.6,138.6],[189.2,139.2],[187.6,139.2],[186.2,138.6],[185.3,137.4],[184.9,135.8],[185.3,134.3],[186.2,133.1],[187.6,132.4],[189.2,132.4],[190.6,133.1],[191.6,134.3]],[[192.5,154.8],[192.1,156.3],[191.2,157.6],[189.8,158.2],[188.2,158.2],[186.8,157.6],[185.8,156.3],[185.5,154.8],[185.8,153.3],[186.8,152.1],[188.2,151.4],[189.8,151.4],[191.2,152.1],[192.1,153.3]]] },
];

// ---------- Geometry ----------

function pointInShape(shape, x, y) {
  let inside = false;
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// Nearest point on any outline edge: { d, x, y }.
function nearestEdge(shape, x, y) {
  let best = { d: Infinity, x, y };
  for (const poly of shape) {
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [ax, ay] = poly[j], [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay;
      const t = clamp(((x - ax) * ex + (y - ay) * ey) / (ex * ex + ey * ey || 1), 0, 1);
      const px = ax + ex * t, py = ay + ey * t;
      const d = dist(x, y, px, py);
      if (d < best.d) best = { d, x: px, y: py };
    }
  }
  return best;
}

// Coverage grid, built once per stencil. Cells whose centre is inside the stencil are the ones that count.
const gridCache = [];
function gridFor(idx) {
  if (gridCache[idx]) return gridCache[idx];
  const shape = STENCILS[idx].shape, cs = T.cellSize;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const poly of shape) for (const [x, y] of poly) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const cols = Math.ceil((x1 - x0) / cs), rows = Math.ceil((y1 - y0) / cs);
  const inside = new Uint8Array(cols * rows);
  let total = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    if (pointInShape(shape, x0 + (i + 0.5) * cs, y0 + (j + 0.5) * cs)) { inside[j * cols + i] = 1; total++; }
  }
  return (gridCache[idx] = { x0, y0, cols, rows, inside, total });
}

// ---------- Play state ----------

const S = {}; // the current attempt; the card reads it to draw the finished piece
let menuPopIdx = -1; // set by the card when stars went up; the menu pops that tile once

function view(E) {
  const s = Math.min(E.w / T.designW, E.h / T.designH);
  return { s, ox: (E.w - T.designW * s) / 2, oy: (E.h - T.designH * s) / 2 };
}

// ---------- Gap hint (v0.4) ----------
// Once the fill reaches hintPercent, the unfilled cells are grouped into 4-neighbour clusters on the coverage grid, and every cluster holding at least
// hintShare of all unfilled cells is glowed (drawn in drawPiece). Recomputed every hintEvery seconds from update; reads coverage, never writes it.

const newHint = (g) => {
  const n = g.cols * g.rows;
  return { label: new Int32Array(n), queue: new Int32Array(n), size: new Int32Array(n + 1), shown: new Int32Array(n), n: 0, clusters: 0, remaining: 0 };
};

function computeHint() {
  const h = S.hint, { cols, rows, inside } = S.g, inked = S.inked, lab = h.label, q = h.queue, total = cols * rows;
  lab.fill(0);
  let id = 0, remaining = 0;
  for (let k0 = 0; k0 < total; k0++) {
    if (!inside[k0] || inked[k0] || lab[k0]) continue;
    id++; lab[k0] = id;
    let qh = 0, qt = 0; q[qt++] = k0;
    while (qh < qt) {
      const k = q[qh++], i = k % cols;
      if (i > 0 && inside[k - 1] && !inked[k - 1] && !lab[k - 1]) { lab[k - 1] = id; q[qt++] = k - 1; }
      if (i < cols - 1 && inside[k + 1] && !inked[k + 1] && !lab[k + 1]) { lab[k + 1] = id; q[qt++] = k + 1; }
      if (k >= cols && inside[k - cols] && !inked[k - cols] && !lab[k - cols]) { lab[k - cols] = id; q[qt++] = k - cols; }
      if (k < total - cols && inside[k + cols] && !inked[k + cols] && !lab[k + cols]) { lab[k + cols] = id; q[qt++] = k + cols; }
    }
    h.size[id] = qt; remaining += qt;
  }
  h.clusters = id; h.remaining = remaining;
  const need = T.hintShare * remaining;
  let n = 0;
  for (let k = 0; k < total; k++) if (lab[k] && h.size[lab[k]] >= need) h.shown[n++] = k;
  h.n = n;
}

function hintStep(dt) {
  if (S.ended || !S.started) return;
  if (percent() < T.hintPercent) { S.hint.n = 0; S.hintT = 0; return; }
  S.hintT -= dt;
  if (S.hintT <= 0) { S.hintT = T.hintEvery; computeHint(); }
}

// The glow is a pulsing stencil-blue fill over the shown clusters' cells, drawn under the ink layer and under the outline (see drawPiece), so ink hides it
// at once and the outline stays clean. Two passes, a faint slightly larger one first, give it soft edges. Cells are not clipped to the stencil (a clip
// per frame costs more than the glow); a boundary cell can spill about two pixels past the outline.
function drawHint(ctx, E, v) {
  const h = S.hint, g = S.g, cs = T.cellSize;
  const a = T.hintAlphaMin + (T.hintAlphaMax - T.hintAlphaMin) * (0.5 - 0.5 * Math.cos((2 * Math.PI * E.time) / T.hintPeriod));
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  ctx.fillStyle = T.stencilBlue;
  for (let pass = 0; pass < 2; pass++) {
    const pad = pass ? 0 : 0.9;
    ctx.globalAlpha = pass ? a : a * 0.4;
    ctx.beginPath();
    for (let i = 0; i < h.n; i++) { const k = h.shown[i]; ctx.rect(g.x0 + (k % g.cols) * cs - pad, g.y0 + Math.floor(k / g.cols) * cs - pad, cs + 2 * pad, cs + 2 * pad); }
    ctx.fill();
  }
  ctx.restore();
}

// ---------- Juice (layer 3) ----------
// Cosmetic only: these read the attempt and never write coverage, slips, the timer or the stars. Times are E.time stamps; -9 means long ago.
// The headless simulator's stand-in engine has no tween, so every effect that needs the engine's helpers is skipped there.

const newFx = () => ({
  downT: -9, inkT: -9, tickAcc: 0, tickT: -9, tickAlt: 0, sprayT: -9, laid: false, speed: 0, px: 0, py: 0, hasP: false,
  slipT: -9, slipPopT: -9, pct: 0, pctT: -9, pctFrom: 1, pctStarT: -9, sec: -1, secT: -9,
  endT: -9, flashT: -9, smear: 0, pendName: null, pendAt: 0,
});

// Scale that eases from `from` to 1 with an overshoot (outBack); 1 outside [0, dur).
const pop = (age, dur, from) => (age < 0 || age >= dur ? 1 : from + (1 - from) * ease.outBack(age / dur));

const EMIT = { x: 0, y: 0, count: 0, color: '', speed: 0, life: 0, size: 0, gravity: 0, drag: 0.96, spread: Math.PI * 2, angle: 0 };
function emit(E, x, y, count, color, speed, life, size, spread = Math.PI * 2, angle = 0) {
  const room = T.particleCap - E.particles.list.length;
  if (room <= 0) return;
  Object.assign(EMIT, { x, y, count: Math.min(count, room), color, speed, life, size, spread, angle });
  E.particles.emit(EMIT);
}
const toScreen = (E, x, y) => { const v = view(E); return [v.ox + x * v.s, v.oy + y * v.s]; };

// One ink sample was laid: note it for the vibration and glint, and tick every tickEvery units of travel, never faster than tickMinGap.
function fxInk(E) {
  if (!E.tween) return;
  const f = S.fx, now = E.time;
  f.inkT = now; f.laid = true;
  f.tickAcc += T.sampleSpacing;
  if (f.tickAcc >= J.tickEvery && now - f.tickT >= J.tickMinGap && E.audio.beep) {
    f.tickAcc = 0; f.tickT = now; f.tickAlt ^= 1;
    E.audio.beep({ freq: f.tickAlt ? J.tickFreq : J.tickFreqAlt, dur: J.tickDur, type: 'triangle', gain: J.tickGain });
  }
}

function scaledText(ctx, E, str, x, y, k, opts) {
  ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
  E.text(str, 0, 0, opts);
  ctx.restore();
}

// A few ink specks off the tip while the needle is laying ink fast.
function sprayTip(E, p) {
  if (!E.tween) return;
  const f = S.fx;
  if (!f.laid || S.ended || f.speed < J.sprayMinSpeed || E.time - f.sprayT < J.sprayGap) return;
  f.sprayT = E.time;
  emit(E, p.x, p.y - T.needleOffset, J.sprayCount, T.inkColor, J.spraySpeed, J.sprayLife, J.spraySize);
}

// A slip was just counted at the exit point (x, y in design units).
function fxSlip(E, x, y) {
  if (!E.tween) return;
  const f = S.fx;
  f.slipT = f.slipPopT = E.time;
  E.shake(J.slipShake, J.slipShakeSec);
  E.haptic(S.slips >= T.maxSlips ? J.ruinHaptic : J.slipHaptic);
  const [sx, sy] = toScreen(E, x, y);
  emit(E, sx, sy, J.slipBurst, T.slipRed, 90, 0.35, 2.4);
}

// The stencil ended: sounds, haptic and the end-of-piece effects. The card follows after endHold.
function fxFinish(E, reason) {
  if (!E.tween) return;
  const f = S.fx, now = E.time;
  f.endT = now;
  if (reason === 'full') {
    E.audio.play('win'); E.haptic(J.finishHaptic);
    f.flashT = now;
    fxBurst(E);
  } else if (reason === 'time') {
    E.audio.play(percent() >= T.starPercents[0] ? 'win' : 'lose');
  } else {
    f.pendName = 'lose'; f.pendAt = now + J.loseDelay; // after the miss sound
    E.tween(J.smearSec, (k) => { f.smear = k; }, ease.outQuad);
  }
}

// Ink specks along the whole outline, evenly spaced.
function fxBurst(E) {
  const v = view(E);
  let len = 0;
  for (const poly of S.st.shape) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) len += dist(poly[j][0], poly[j][1], poly[i][0], poly[i][1]);
  const step = len / J.burstPoints;
  let next = 0, run = 0, n = 0;
  for (const poly of S.st.shape) for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const ax = poly[j][0], ay = poly[j][1], bx = poly[i][0], by = poly[i][1], el = dist(ax, ay, bx, by);
    while (next <= run + el && n < J.burstPoints) {
      const t = el ? (next - run) / el : 0;
      emit(E, v.ox + (ax + (bx - ax) * t) * v.s, v.oy + (ay + (by - ay) * t) * v.s, J.burstPer, n % 2 ? J.inkSheen : T.inkColor, J.burstSpeed, J.burstLife, J.burstSize);
      next += step; n++;
    }
    run += el;
  }
}

// Per frame while playing: needle speed, whole-percent pops, timer pulse and ticks, delayed sounds.
function fxUpdate(dt, E) {
  const f = S.fx, now = E.time;
  if (S.last) {
    f.speed = f.hasP ? f.speed + (dist(S.last.x, S.last.y, f.px, f.py) / Math.max(dt, 0.001) - f.speed) * 0.35 : 0;
    f.px = S.last.x; f.py = S.last.y; f.hasP = true;
  } else { f.hasP = false; f.speed = 0; }
  const p = percent();
  if (p !== f.pct) {
    let crossed = false;
    for (const th of T.starPercents) if (f.pct < th && p >= th) crossed = true;
    f.pct = p;
    if (p >= T.starPercents[0]) { f.pctT = now; f.pctFrom = crossed ? J.pctThresholdFrom : J.pctStepFrom; }
    if (crossed) f.pctStarT = now;
  }
  if (S.started && !S.ended) {
    const sec = Math.ceil(S.time);
    if (sec !== f.sec) {
      f.sec = sec; f.secT = now;
      if (sec >= 1 && sec <= J.timerTickSecs) E.audio.beep({ freq: J.timerTickFreq, dur: J.timerTickDur, type: 'sine', gain: J.timerTickGain });
    }
  }
  if (f.pendName && now >= f.pendAt) { E.audio.play(f.pendName); f.pendName = null; }
}

function newAttempt(idx) {
  const st = STENCILS[idx], g = gridFor(idx);
  Object.assign(S, {
    idx, st, g,
    inked: new Uint8Array(g.cols * g.rows), count: 0,
    strokes: [], stroke: null, marks: [],
    slips: 0, time: st.timer, started: false, ended: null, holdT: 0,
    pid: null, last: null, lastT: 0, carry: 0, armed: false,
    finger: null, r: T.needleR, hist: newHist(), sT: 0, idle: 0, acc: 0, pushR: 0,
    layer: null, layerK: 0, inkDone: [],
    grey: null, greyK: 0, fx: newFx(),
    hint: newHint(g), hintT: 0,
  });
}

const percent = () => Math.floor((S.count * 100) / S.g.total);
const starsFor = (pct) => T.starPercents.filter((p) => pct >= p).length;

// Speed history for the dynamic needle: cumulative travel and time at the last path samples since touch down (a ring, no allocation per sample).
const HIST = 64;
const newHist = () => ({ d: new Float64Array(HIST), t: new Float64Array(HIST), head: 0, n: 0, cum: 0 });
function histPush(h, cum, t) {
  h.head = (h.head + 1) % HIST; h.d[h.head] = cum; h.t[h.head] = t; if (h.n < HIST) h.n++;
}
// Finger speed over the last speedWindow units of travel, or -1 with no travel yet. With less travel than the window it uses what there is.
// `idle` is time spent holding still since the newest sample, so a pause drags the measured speed down.
function windowSpeed(h, idle = 0) {
  const target = h.cum - Math.min(T.speedWindow, (HIST - 2) * T.sampleSpacing);
  let k = h.head, cnt = 1, d0 = h.d[k], t0 = h.t[k];
  while (cnt < h.n) {
    const prev = (k + HIST - 1) % HIST;
    if (h.d[prev] <= target) { // interpolate the time at cumulative distance `target` between prev and k
      const span = h.d[k] - h.d[prev], f = span > 0 ? (target - h.d[prev]) / span : 0;
      d0 = target; t0 = h.t[prev] + (h.t[k] - h.t[prev]) * f;
      return (h.cum - d0) / Math.max(h.t[h.head] - t0 + idle, 1e-4);
    }
    k = prev; cnt++; d0 = h.d[k]; t0 = h.t[k];
  }
  const dd = h.cum - d0;
  if (dd > 0) return dd / Math.max(h.t[h.head] - t0 + idle, 1e-4);
  return idle > 0 ? 0 : -1; // no travel yet: unknown, or stopped if the finger has been holding still
}
// Target ink radius for a finger speed: wide when slow, thin when fast, linear between; never below the floor. Unknown speed is neutral.
function radiusFor(speed) {
  if (speed < 0) return T.needleR;
  const u = clamp((speed - T.slowSpeed) / Math.max(T.fastSpeed - T.slowSpeed, 1e-6), 0, 1);
  return Math.max(T.needleR * (T.wideScale + (T.thinScale - T.wideScale) * u), T.needleR * T.floorScale);
}
// Inertia: the radius moves toward its target over dt seconds at growRate while widening and shrinkRate while narrowing.
function stepRadius(dt, speed) {
  const goal = radiusFor(speed);
  S.r = clamp(S.r < goal ? Math.min(goal, S.r + T.growRate * dt) : Math.max(goal, S.r - T.shrinkRate * dt), T.needleR * T.floorScale, Infinity);
}

// Lay ink on every inside cell whose centre is within R of (x, y).
function inkAt(x, y, R) {
  const { g } = S, cs = T.cellSize;
  const i0 = Math.max(0, Math.floor((x - R - g.x0) / cs)), i1 = Math.min(g.cols - 1, Math.floor((x + R - g.x0) / cs));
  const j0 = Math.max(0, Math.floor((y - R - g.y0) / cs)), j1 = Math.min(g.rows - 1, Math.floor((y + R - g.y0) / cs));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * g.cols + i;
    if (!g.inside[k] || S.inked[k]) continue;
    if (dist(x, y, g.x0 + (i + 0.5) * cs, g.y0 + (j + 0.5) * cs) <= R) { S.inked[k] = 1; S.count++; }
  }
}

// One path sample. Inside: ink. Outside: no ink; a slip counts only if the needle had been inside and is now past the tolerance.
function sample(E, x, y, r) {
  if (S.ended) return;
  S.r = r;
  if (pointInShape(S.st.shape, x, y)) {
    S.armed = true;
    if (!S.stroke) { S.stroke = []; S.strokes.push(S.stroke); }
    S.stroke.push(x, y, r); S.pushR = r;
    inkAt(x, y, r);
    fxInk(E);
    if (S.count === S.g.total) finish(E, 'full');
    return;
  }
  S.stroke = null;
  checkSlip(E, x, y);
}

// Count a slip if the needle had been inside and (x, y) is outside past the tolerance. Ink is never laid here.
function checkSlip(E, x, y) {
  if (!S.armed || S.ended || pointInShape(S.st.shape, x, y)) return;
  const e = nearestEdge(S.st.shape, x, y);
  if (e.d <= T.slipTolerance) return;
  S.armed = false; S.stroke = null;
  S.slips++;
  S.marks.push({ x: e.x, y: e.y });
  E.audio.play('miss');
  fxSlip(E, e.x, e.y);
  if (S.slips >= T.maxSlips) finish(E, 'ruined');
}

// Walk the needle from its last position to (x, y) at time tm (seconds), sampling every sampleSpacing along the way.
// Each sample gets the time it would have had on that straight segment, so the speed window depends on positions and speeds, not on how events were cut.
function moveNeedle(E, x, y, tm) {
  const h = S.hist;
  if (!S.last) {
    S.last = { x, y }; S.lastT = tm; S.carry = 0; S.sT = tm; S.idle = 0; S.acc = 0;
    h.n = 0; h.cum = 0; histPush(h, 0, tm);
    S.r = Math.max(T.needleR, T.needleR * T.floorScale);
    sample(E, x, y, S.r);
    return;
  }
  const dx = x - S.last.x, dy = y - S.last.y, len = Math.hypot(dx, dy);
  if (len === 0) return;
  const ux = dx / len, uy = dy / len, dt = tm - S.lastT;
  S.idle = 0; S.acc = 0;
  let t = T.sampleSpacing - S.carry; // distance along this segment to the next sample
  while (t <= len && !S.ended) {
    const ts = S.lastT + dt * (t / len);
    h.cum += T.sampleSpacing; histPush(h, h.cum, ts);
    stepRadius(Math.max(0, ts - S.sT), windowSpeed(h)); S.sT = Math.max(S.sT, ts);
    sample(E, S.last.x + ux * t, S.last.y + uy * t, S.r);
    t += T.sampleSpacing;
  }
  S.carry = T.sampleSpacing - (t - len);
  S.last = { x, y }; S.lastT = tm;
  checkSlip(E, x, y); // the real needle position too, so a reversal apex between samples still counts
}

// Holding still: the finger sends no events, but time passes. In fixed steps the radius keeps swelling toward the slow size, and the disc it lays
// grows with it (never past the slow radius). Runs from update, so it is the same code the simulator's holds use.
function holdStep(E, dt) {
  if (S.pid === null || !S.last || S.ended) return;
  S.idle += dt;
  if (S.idle < T.holdGap) return;
  S.acc += dt;
  while (S.acc >= T.physicsStep) {
    S.acc -= T.physicsStep; S.sT += T.physicsStep;
    stepRadius(T.physicsStep, windowSpeed(S.hist, S.idle));
  }
  if (S.stroke && S.r > S.pushR + 0.05 && pointInShape(S.st.shape, S.last.x, S.last.y)) {
    S.pushR = S.r; S.stroke.push(S.last.x, S.last.y, S.r); inkAt(S.last.x, S.last.y, S.r);
    if (S.count === S.g.total) finish(E, 'full');
  }
}

function finish(E, reason) {
  if (S.ended) return;
  S.ended = reason;
  S.holdT = T.endHold;
  S.stroke = null;
  fxFinish(E, reason);
}

// Seconds at which a pointer event happened. The harness stamps p.t; the engine's pointers carry none, so the real clock is read.
const eventTime = (p) => (typeof p.t === 'number' ? p.t : performance.now() / 1000);

function needleFromPointer(p, E) {
  const v = view(E);
  return { x: (p.x - v.ox) / v.s, y: (p.y - T.needleOffset - v.oy) / v.s };
}

function liftFinger() {
  S.pid = null; S.last = null; S.stroke = null; S.armed = false; S.finger = null;
}

// ---------- Drawing ----------

function shapePath(ctx, shape) {
  ctx.beginPath();
  for (const poly of shape) {
    poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  }
}

// The ink lives on an offscreen layer (design space, clipped to the stencil like the score) that only ever receives new
// segments; each frame just blits it. A resize changes the layer scale, so it is rebuilt from the stored strokes.
function syncInk(E, v) {
  const k = v.s * Math.min(E.dpr || 1, T.inkLayerMaxDpr);
  const w = Math.ceil(T.designW * k), h = Math.ceil(T.designH * k);
  if (!S.layer || S.layerK !== k) {
    S.layer = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    S.layerK = k; S.inkDone = [];
    const c = S.layer.getContext('2d');
    c.setTransform(k, 0, 0, k, 0, 0);
    shapePath(c, S.st.shape); c.clip('evenodd');
    c.strokeStyle = T.inkColor; c.fillStyle = T.inkColor;
    c.lineCap = 'round'; c.lineJoin = 'round';
  }
  const c = S.layer.getContext('2d');
  // Strokes are flat lists of x, y, radius. Each segment is drawn at its own width, so a slow stroke is fat and a fast one thin.
  const wk = T.inkStrokeWidth / (2 * T.needleR);
  S.strokes.forEach((pts, n) => {
    const done = S.inkDone[n] || 0;
    if (done >= pts.length) return;
    if (pts.length === 3) { c.beginPath(); c.arc(pts[0], pts[1], pts[2] * wk, 0, Math.PI * 2); c.fill(); }
    else {
      for (let i = Math.max(3, done); i < pts.length; i += 3) {
        if (pts[i] === pts[i - 3] && pts[i + 1] === pts[i - 2]) { c.beginPath(); c.arc(pts[i], pts[i + 1], pts[i + 2] * wk, 0, Math.PI * 2); c.fill(); continue; } // a hold: the disc swells in place
        c.lineWidth = (pts[i - 1] + pts[i + 2]) * wk;
        c.beginPath(); c.moveTo(pts[i - 3], pts[i - 2]); c.lineTo(pts[i], pts[i + 1]); c.stroke();
      }
    }
    S.inkDone[n] = pts.length;
  });
}

// The ruined piece's grey ink: the ink layer's shape filled grey, built once when the smear starts (and again after a resize).
function syncGrey(v) {
  if (S.grey && S.greyK === S.layerK) return;
  S.grey = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S.layer.width, S.layer.height) : Object.assign(document.createElement('canvas'), { width: S.layer.width, height: S.layer.height });
  S.greyK = S.layerK;
  const c = S.grey.getContext('2d');
  c.drawImage(S.layer, 0, 0);
  c.globalCompositeOperation = 'source-in';
  c.fillStyle = J.smearColor; c.fillRect(0, 0, S.grey.width, S.grey.height);
}

function drawPiece(ctx, E) {
  const v = view(E), shape = S.st.shape, f = S.fx, now = E.time;
  syncInk(E, v);
  const W = T.designW * v.s, H = T.designH * v.s;
  if (!S.ended && S.hint.n) drawHint(ctx, E, v); // under the ink, over the skin
  ctx.drawImage(S.layer, v.ox, v.oy, W, H);
  if (f.smear > 0) {
    syncGrey(v);
    ctx.globalAlpha = f.smear;
    ctx.drawImage(S.grey, v.ox, v.oy + f.smear * J.smearDrop * v.s, W, H * (1 + f.smear * 0.01));
    ctx.globalAlpha = 1;
  }
  ctx.save();
  ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
  const flash = 1 - (now - f.flashT) / J.finishFlashSec;
  if (flash > 0 && flash <= 1) {
    shapePath(ctx, shape);
    ctx.globalAlpha = flash * J.finishFlashAlpha; ctx.fillStyle = J.finishFlashColor; ctx.fill('evenodd'); ctx.globalAlpha = 1;
  }
  const fade = f.endT > 0 ? clamp((now - f.endT) / J.outlineFadeSec, 0, 1) : 0, a = 1 - (1 - J.outlineEndAlpha) * ease.outQuad(fade);
  shapePath(ctx, shape);
  ctx.lineJoin = 'round';
  ctx.globalAlpha = a; ctx.strokeStyle = T.stencilBlue; ctx.lineWidth = T.outlineWidth; ctx.stroke();
  const red = 1 - (now - f.slipT) / J.slipFlashSec;
  if (red > 0 && red <= 1) { ctx.globalAlpha = red * a; ctx.strokeStyle = T.slipRed; ctx.lineWidth = T.outlineWidth + 1.5; ctx.stroke(); }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = T.slipRed; ctx.lineWidth = 3; ctx.lineCap = 'round';
  const m = T.slipMarkSize;
  for (const k of S.marks) {
    ctx.beginPath();
    ctx.moveTo(k.x - m, k.y - m); ctx.lineTo(k.x + m, k.y + m);
    ctx.moveTo(k.x + m, k.y - m); ctx.lineTo(k.x - m, k.y + m);
    ctx.stroke();
  }
  ctx.restore();
}

// The tattoo machine, in screen pixels: grip at the finger, tube, needle, and a ring showing the ink radius at the tip.
// Drawn relative to the tip so the settle pop never moves the point that inks; the body shivers while ink is being laid.
function drawMachine(ctx, E) {
  const f = S.finger; if (!f) return;
  const fx = S.fx, now = E.time, s = view(E).s, off = T.needleOffset;
  const out = fx.endT > 0 ? clamp((now - fx.endT) / J.machineFadeSec, 0, 1) : 0;
  if (out >= 1) return;
  const gw = T.machineGripW / 2, tw = T.machineTubeW / 2, neck = 12;
  const vib = now - fx.inkT < J.vibHold && !S.ended ? Math.sin(now * J.vibHz * 2 * Math.PI) * J.vibAmp : 0;
  ctx.save();
  ctx.globalAlpha = 1 - out;
  ctx.translate(f.x, f.y - off);
  const sc = pop(now - fx.downT, J.settleSec, J.settleFrom);
  ctx.scale(sc, sc);
  ctx.save();
  ctx.translate(vib, 0);
  ctx.fillStyle = T.machineBody; ctx.strokeStyle = T.machineEdge; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(-gw, off); ctx.lineTo(-tw, neck); ctx.lineTo(tw, neck); ctx.lineTo(gw, off); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, neck); ctx.lineTo(0, 0); ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  const base = ctx.globalAlpha;
  ctx.strokeStyle = T.machineEdge;
  ctx.beginPath(); ctx.arc(0, 0, S.r * s, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.globalAlpha = base * 0.8; ctx.stroke(); ctx.globalAlpha = base;
  ctx.fillStyle = T.machineEdge;
  ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  // Glint: a small four-point sparkle that breathes, brighter and longer while inking.
  const g = 0.5 + 0.5 * Math.sin(now * J.glintHz), laying = now - fx.inkT < J.vibHold, L = J.glintLen * (0.5 + g) * (laying ? 1.5 : 1);
  ctx.globalAlpha = base * (laying ? 0.5 + 0.5 * g : 0.25 + 0.35 * g);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(L, 0); ctx.moveTo(0, -L); ctx.lineTo(0, L); ctx.stroke();
  ctx.restore();
}

function drawStar(ctx, cx, cy, R, filled) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? R * 0.45 : R, a = -Math.PI / 2 + (i * Math.PI) / 5;
    i ? ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  ctx.closePath();
  if (filled) { ctx.fillStyle = T.starColor; ctx.fill(); }
  else { ctx.strokeStyle = T.lockColor; ctx.lineWidth = R > 8 ? 2 : 1; ctx.lineJoin = 'round'; ctx.stroke(); }
}

function drawLock(ctx, cx, cy) {
  ctx.fillStyle = T.lockColor; ctx.strokeStyle = T.lockColor; ctx.lineWidth = 3;
  ctx.fillRect(cx - 9, cy - 2, 18, 14);
  ctx.beginPath(); ctx.arc(cx, cy - 2, 6, Math.PI, 0); ctx.stroke();
}

// ---------- Progress (saved) ----------
// unlocked: highest unlocked stencil index. best: percentage per stencil. stars: best stars per stencil. clean: a zero-slip pass per stencil.

function progress(E) {
  const best = E.save.get('best', {}), stars = E.save.get('stars', {}), clean = E.save.get('clean', {});
  const unlocked = clamp(E.save.get('unlocked', 0), 0, STENCILS.length - 1);
  let total = 0;
  for (let i = 0; i < STENCILS.length; i++) total += stars[i] || 0;
  return { best, stars, clean, unlocked, total };
}

function recordResult(E, idx, { pct, stars, ruined, clean }) {
  const p = progress(E);
  if (!ruined && pct > (p.best[idx] || 0)) E.save.set('best', { ...p.best, [idx]: pct });
  if (stars > (p.stars[idx] || 0)) E.save.set('stars', { ...p.stars, [idx]: stars });
  if (clean && !p.clean[idx]) E.save.set('clean', { ...p.clean, [idx]: true });
  if (stars >= 1) E.save.set('unlocked', Math.max(p.unlocked, Math.min(idx + 1, STENCILS.length - 1)));
}

// ---------- Scenes ----------

const menu = {
  enter(E) { this.btnPlay = null; this.btnMute = null; this.tiles = []; this.popIdx = menuPopIdx; this.popT = E.time; menuPopIdx = -1; },
  render(ctx, E) {
    const cx = E.w / 2, p = progress(E), gap = T.gridGap, cols = T.gridCols;
    E.text('INK', cx, E.safe.top + E.h * 0.08, { size: 48, weight: '800', color: T.textColor });
    E.text(`Stars ${p.total} / ${STENCILS.length * T.starPercents.length}`, cx, E.safe.top + E.h * 0.08 + 40, { size: 18, color: T.starColor });

    const m = 16, tw = (E.w - 2 * m - (cols - 1) * gap) / cols, th = T.tileH, top = E.safe.top + E.h * 0.08 + 68;
    this.tiles = [];
    STENCILS.forEach((st, i) => {
      const x = m + (i % cols) * (tw + gap), y = top + Math.floor(i / cols) * (th + gap);
      const locked = i > p.unlocked, cleared = (p.stars[i] || 0) > 0;
      const k = i === this.popIdx ? pop(E.time - this.popT - J.menuPopDelay, J.menuPopSec, J.menuPopFrom) : 1;
      ctx.save();
      if (k !== 1) { ctx.translate(x + tw / 2, y + th / 2); ctx.scale(k, k); ctx.translate(-(x + tw / 2), -(y + th / 2)); }
      E.roundRect(x, y, tw, th, 10, locked ? '#3a281f' : T.cardColor, cleared ? T.stencilBlue : locked ? '#4a3428' : T.lockColor);
      E.text(`${i + 1}`, x + tw / 2, y + 18, { size: 20, weight: '800', color: locked ? T.lockColor : T.textColor });
      if (locked) drawLock(ctx, x + tw / 2, y + th / 2 + 2);
      else {
        if (st.boss) E.text('Boss', x + tw / 2, y + 40, { size: 14, color: T.textColor });
        if (p.clean[i]) E.text('Clean', x + tw / 2, y + 58, { size: 14, weight: '800', color: T.stencilBlue });
        const step = (tw - 6) / T.starPercents.length;
        for (let k = 0; k < T.starPercents.length; k++) drawStar(ctx, x + 3 + step * (k + 0.5), y + th - 12, step * 0.46, k < (p.stars[i] || 0));
      }
      ctx.restore();
      this.tiles.push({ x, y, w: tw, h: th, idx: i, locked });
    });

    const py = top + Math.ceil(STENCILS.length / cols) * (th + gap) + 44;
    this.btnPlay = E.button(p.unlocked > 0 ? `Play ${p.unlocked + 1}` : 'Play', cx, py, { fill: T.buttonFill, h: 64, size: 24 });
    this.btnMute = E.button(E.audio.muted ? 'Sound: off' : 'Sound: on', cx, py + 80, { fill: T.buttonAltFill, w: 170, h: 48, size: 16 });
  },
  onTap(p, E) {
    if (E.hit(this.btnPlay, p)) { E.audio.play('tap'); E.setScene('play', { stencil: progress(E).unlocked }); return; }
    if (E.hit(this.btnMute, p)) { E.audio.toggleMute(); E.audio.play('tap'); return; }
    const t = this.tiles.find((t) => !t.locked && E.hit(t, p));
    if (t) { E.audio.play('tap'); E.setScene('play', { stencil: t.idx }); }
  },
};

const play = {
  enter(E, { stencil = 0 } = {}) { newAttempt(clamp(stencil, 0, STENCILS.length - 1)); },
  update(dt, E) {
    holdStep(E, dt);
    hintStep(dt);
    fxUpdate(dt, E);
    if (S.ended) {
      S.holdT -= dt;
      if (S.holdT <= 0) this.toCard(E);
      return;
    }
    if (!S.started) return;
    S.time -= dt;
    if (S.time <= 0) { S.time = 0; finish(E, 'time'); }
  },
  toCard(E) {
    const pct = percent(), ruined = S.ended === 'ruined';
    const stars = ruined ? 0 : starsFor(pct);
    const failed = ruined || pct < T.passPercent;
    const clean = !failed && S.slips === 0;
    const starsUp = stars > (progress(E).stars[S.idx] || 0);
    recordResult(E, S.idx, { pct, stars, ruined, clean });
    E.setScene('over', { idx: S.idx, pct, stars, failed, clean, best: progress(E).best[S.idx] || 0, boss: S.st.boss, last: S.idx === STENCILS.length - 1, starsUp });
  },
  onPointerDown(p, E) {
    if (S.ended) return;
    if (S.pid !== null) { if (E.pointers.has(S.pid)) return; liftFinger(); } // a lost up or cancel must not lock out inking
    S.pid = p.id; S.started = true; S.finger = { x: p.x, y: p.y };
    E.audio.play('tap');
    S.fx.downT = E.time;
    const n = needleFromPointer(p, E);
    moveNeedle(E, n.x, n.y, eventTime(p));
  },
  onPointerMove(p, E) {
    if (p.id !== S.pid || S.ended) return;
    S.finger = { x: p.x, y: p.y };
    const n = needleFromPointer(p, E);
    S.fx.laid = false;
    moveNeedle(E, n.x, n.y, eventTime(p));
    sprayTip(E, p);
  },
  onPointerUp(p, E) { if (p.id === S.pid) liftFinger(); },
  render(ctx, E) {
    drawPiece(ctx, E);
    drawMachine(ctx, E);
    const top = E.safe.top + T.hudTop, cx = E.w / 2, now = E.time, f = S.fx;
    // Percentage: pops on each whole-percent step from the first star threshold up, harder on a threshold, and glows star colour after one.
    const pk = pop(now - f.pctT, f.pctFrom === J.pctThresholdFrom ? J.pctThresholdSec : J.pctStepSec, f.pctFrom);
    const pstr = `${percent()}%`;
    scaledText(ctx, E, pstr, cx, top + 30, pk, { size: 60, weight: '800', color: T.textColor });
    const glow = 1 - (now - f.pctStarT) / J.pctStarSec;
    if (glow > 0 && glow <= 1) scaledText(ctx, E, pstr, cx, top + 30, pk, { size: 60, weight: '800', color: T.starColor, alpha: glow });
    // Timer: pulses each second in the last few; the colour rule is the old one.
    const tk = S.started && !S.ended && S.time <= J.timerPulseSecs ? pop(now - f.secT, J.timerPulseSec, J.timerPulseFrom) : 1;
    scaledText(ctx, E, `${Math.ceil(S.time)}`, 16, top + 28, tk, { size: 48, weight: '800', align: 'left', color: S.time <= 5 && S.started ? T.slipRed : T.textColor });
    scaledText(ctx, E, `${S.slips}/${T.maxSlips}`, E.w - 16, top + 28, pop(now - f.slipPopT, J.slipPopSec, J.slipPopFrom), { size: 26, weight: '800', align: 'right', color: S.slips ? T.slipRed : T.textColor });
  },
};

// The card. Timeline (seconds from enter): the card slides up; stars pop in one by one with a coin each; then "Clean" flourishes;
// the buttons appear only after the beat and only then take taps, so a tap during the animation is never swallowed by a button.
const over = {
  enter(E, params) {
    this.p = params;
    this.btnMain = null; this.btnMenu = null;
    this.t = 0; this.coins = 0;
    const n = params.stars;
    this.starsEnd = J.starDelay + Math.max(0, n - 1) * J.starStagger + J.starSec;
    this.buttonsAt = Math.max(J.cardSlideSec, n ? this.starsEnd : 0) + J.buttonGap; // about 0.75 s with five stars
    this.sweepAt = params.clean ? this.starsEnd + J.cleanDelay : Infinity;
  },
  cardBox(E) {
    const w = Math.min(320, E.w - 32), h = 392;
    return { w, h, x: E.w / 2 - w / 2, y: Math.max(E.safe.top + 16, (E.h - h) / 2) };
  },
  slideOffset(E) {
    const b = this.cardBox(E), k = ease.outBack(clamp(this.t / J.cardSlideSec, 0, 1));
    return (1 - k) * (E.h * J.cardFrom + b.h);
  },
  update(dt, E) {
    this.t += dt;
    const n = this.p.stars;
    while (this.coins < n && this.t >= J.starDelay + this.coins * J.starStagger) {
      const i = this.coins++, b = this.cardBox(E);
      E.audio.play('coin');
      emit(E, E.w / 2 + (i - 2) * 44, b.y + 134 + this.slideOffset(E), J.starBurst, T.starColor, 90, 0.4, 2.6);
    }
  },
  render(ctx, E) {
    const p = this.p, cx = E.w / 2, t = this.t, b = this.cardBox(E), { w, h, x, y } = b;
    drawPiece(ctx, E);
    ctx.fillStyle = `rgba(0,0,0,${J.cardDim * clamp(t / (J.cardSlideSec * 0.5), 0, 1)})`; ctx.fillRect(0, 0, E.w, E.h);

    ctx.save();
    ctx.translate(0, this.slideOffset(E));
    E.roundRect(x, y, w, h, 20, T.cardColor, T.stencilBlue);
    if (p.boss) E.text('Boss', cx, y + 24, { size: 16, weight: '800', color: T.stencilBlue });
    E.text(`${p.pct}%`, cx, y + 68, { size: 72, weight: '800', color: T.textColor });
    for (let i = 0; i < 5; i++) {
      if (i >= p.stars) { drawStar(ctx, cx + (i - 2) * 44, y + 134, 18, false); continue; }
      const k = clamp((t - (J.starDelay + i * J.starStagger)) / J.starSec, 0, 1);
      if (k <= 0) { drawStar(ctx, cx + (i - 2) * 44, y + 134, 18, false); continue; }
      drawStar(ctx, cx + (i - 2) * 44, y + 134, 18 * ease.outBack(k), true);
    }
    if (p.clean) {
      const ck = pop(t - this.sweepAt, J.cleanPopSec, 0);
      if (t >= this.sweepAt) scaledText(ctx, E, 'Clean', cx, y + 180, ck, { size: 22, weight: '800', color: T.stencilBlue });
    }
    E.text(`Best ${p.best}%`, cx, y + 214, { size: 18, color: '#b8a698' });
    ctx.restore();

    if (p.clean && t >= this.sweepAt) this.drawSweep(ctx, E, (t - this.sweepAt) / J.cleanSweepSec);

    this.btnMain = this.btnMenu = null;
    if (t < this.buttonsAt) return;
    // Primary: Again on a fail, Next on a pass, Menu on a pass of the last stencil. Secondary Menu always, unless it is already primary.
    const menuIsPrimary = !p.failed && p.last, bk = pop(t - this.buttonsAt, J.buttonPopSec, 0.85);
    ctx.save();
    const zoom = (cy) => { ctx.translate(cx, cy); ctx.scale(bk, bk); ctx.translate(-cx, -cy); };
    ctx.save(); zoom(y + 270);
    this.btnMain = E.button(p.failed ? 'Again' : p.last ? 'Menu' : 'Next', cx, y + 270, { w: w - 48, fill: T.buttonFill, size: 22 });
    ctx.restore();
    if (!menuIsPrimary) { ctx.save(); zoom(y + 340); this.btnMenu = E.button('Menu', cx, y + 340, { w: w - 48, h: 48, fill: T.buttonAltFill, size: 18 }); ctx.restore(); }
    ctx.restore();
  },
  // Clean flourish: a soft blue band sweeps across the piece, clipped to the stencil shape.
  drawSweep(ctx, E, k) {
    if (k >= 1) return;
    const v = view(E);
    ctx.save();
    ctx.translate(v.ox, v.oy); ctx.scale(v.s, v.s);
    shapePath(ctx, S.st.shape); ctx.clip('evenodd');
    ctx.translate(T.designW / 2, T.designH / 2); ctx.rotate(-0.5);
    ctx.translate(-480 + 960 * ease.inOut(k), 0);
    ctx.fillStyle = J.cleanSweepColor;
    const a = J.cleanSweepAlpha * Math.sin(Math.PI * k);
    ctx.globalAlpha = a * 0.35; ctx.fillRect(-60, -700, 120, 1400);
    ctx.globalAlpha = a * 0.5; ctx.fillRect(-32, -700, 64, 1400);
    ctx.globalAlpha = a; ctx.fillRect(-12, -700, 24, 1400);
    ctx.restore();
  },
  onTap(p, E) {
    if (this.t < this.buttonsAt || !this.btnMain) return;
    if (E.hit(this.btnMain, p)) {
      E.audio.play('tap');
      const q = this.p;
      if (q.failed) E.setScene('play', { stencil: q.idx });
      else if (q.last) { menuPopIdx = q.starsUp ? q.idx : -1; E.setScene('menu'); }
      else E.setScene('play', { stencil: q.idx + 1 });
    } else if (this.btnMenu && E.hit(this.btnMenu, p)) { E.audio.play('tap'); menuPopIdx = this.p.starsUp ? this.p.idx : -1; E.setScene('menu'); }
  },
};

export const game = {
  slug: 'ink',
  title: 'Ink',
  saveVersion: 4,
  // v1 saved only best percentages: derive stars and the unlock from them. v3 kept bests per needle mode; v4 has one needle, so the dynamic bests become the bests
  // and every earlier best (all made with the classic needle) is dropped. Stars, clean and unlocks are kept.
  migrate(data, fromVersion) {
    if (fromVersion < 2) {
      const best = data.best || {}, stars = {};
      let unlocked = 0;
      for (const id of Object.keys(best)) {
        const n = starsFor(best[id]);
        if (n) { stars[id] = n; unlocked = Math.max(unlocked, Number(id) + 1); }
      }
      data.stars = stars; data.clean = {}; data.unlocked = Math.min(unlocked, STENCILS.length - 1);
    }
    if (fromVersion < 4) { data.best = (fromVersion >= 3 && data.bests && data.bests.dynamic) || {}; delete data.bests; delete data.needleMode; }
    // The tune panel now holds only the hint; drop saved needle and juice experiment values so they cannot override the new defaults.
    if (fromVersion < 4 && data.__tune) data.__tune = Object.fromEntries(Object.entries(data.__tune).filter(([k]) => k.startsWith('hint')));
    return data;
  },
  TUNING,
  // TUNE tab: the gap hint only. Whole feels first (presets), two sliders under them. Both read TUNING at use time, so they apply live.
  experiments: [
    { key: 'hintPercent', label: 'Hint starts at (percent)', min: 85, max: 100, step: 1 },
    { key: 'hintShare', label: 'Gap share shown (of what is left)', min: 0.02, max: 0.5, step: 0.01 },
  ],
  presets: [
    { label: 'Late', values: { hintPercent: 97, hintShare: 0.15 } },
    { label: 'Standard', values: { hintPercent: 95, hintShare: 0.1 } },
    { label: 'Early', values: { hintPercent: 90, hintShare: 0.05 } },
    { label: 'Off', values: { hintPercent: 101, hintShare: 1 } },
  ],
  start: 'menu',
  scenes: { menu, play, over },
  // Read by tools/sim-ink.mjs so the simulator runs the real coverage and slip code.
  sim: { stencils: STENCILS, percent, slips: () => S.slips, ended: () => S.ended, inked: () => S.inked, grid: () => S.g, radius: () => S.r, hint: () => S.hint, computeHint },
};
