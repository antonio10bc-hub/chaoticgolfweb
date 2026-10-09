// Buscador de niveles de Lo básico por lección: genera tableros pequeños al azar con las piezas y la mano de la
// lección, y se queda con los que la enseñan de verdad: TODAS las soluciones pasan por lo que pide (`need`, de
// lib/basics-needs.mjs), cada carta hace falta, ninguna pieza sobra y la dificultad cae en su banda. Guarda los mejores en
// puzzle-candidates/basics-<lección>.json y los enseña en ASCII con su solución (copiarlos a tools/basics-design.mjs).
//   node tools/basics-search.mjs <lección> [intentos=4000] [semilla=1] [cuántos=4]
// Las lecciones están en la tabla LESSONS (añadir más ahí). Campos de una lección:
//   cols, rows       tamaño (número o [mín, máx])
//   tiles            { tipo: n } (river: un tramo vertical de 2-4; lake: una mancha de 1-3; portal: una pareja; dice: con caras)
//   riverEdge        el río llega al borde de abajo (desemboca fuera)
//   decoys           pelotas de obstáculo (número o rango) · ballOn / holeOn / decoyOn: encima de una pieza de ese tipo
//   spawn / home     la salida de la pelota / la casilla inicial del hoyo en otra casilla
//   hand             { fixed: [...] } o { pool: [...], n, plus?: [...] } (plus: una más de esa lista)
//   season           'spring' | 'summer' | 'autumn' | 'winter' · snow: la bola de nieve · wind: el viento soplando
//   train            la vía (una vuelta a un rectángulo) · cars: vagones
//   coins / gold     monedas (número) y la casilla dorada (casino) · seed: con azar, una semilla propia
//   need             claves de NEED que deben cumplir todas las soluciones · band: [ratio mín, máx] · max: jugadas
import fs from 'node:fs';
import { plays, quality, describe } from './lib/basics-solver.mjs';
import { drawLevel, ring } from './lib/basics-ascii.mjs';
import { NEED } from './lib/basics-needs.mjs';
import { windRoute } from '../src/engine/seasons.js';

const [lesson, TRIES = 4000, SEED = 1, SHOW = 4] = process.argv.slice(2);
let st = (+SEED * 2654435761) >>> 0;
const rnd = () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const ri = n => Math.floor(rnd() * n), pick = a => a[ri(a.length)], range = r => Array.isArray(r) ? r[0] + ri(r[1] - r[0] + 1) : (r || 0);
const HOLE = ['hoyoUp', 'hoyoDown', 'hoyoLeft', 'hoyoRight'], OHOLE = ['oHoyoUp', 'oHoyoDown', 'oHoyoLeft', 'oHoyoRight'], CLUBS = ['palo1', 'palo2', 'palo3'];
const BASE = [...CLUBS, ...HOLE];

const LESSONS = {
  /* ---------- palos, hoyo y clásica (fase 1) ---------- */
  chain:    { cols: [4, 6], rows: [4, 7], decoys: 2, hand: { pool: [...BASE, 'oPalo1', 'dedo'], n: 2 }, need: ['chain'], band: [.0005, .6] },
  /* ---------- agua ---------- */
  riverFall:  { cols: [4, 6], rows: [5, 6], tiles: { river: 1 }, riverEdge: true, spawn: true, hand: { pool: BASE, n: 2 }, need: ['riverFall'], band: [.01, .4] },
  riverPush:  { cols: [4, 6], rows: [5, 7], tiles: { river: 1 }, decoys: 1, hand: { pool: [...BASE, 'oPalo1'], n: 2 }, need: ['riverPush'], band: [.005, .4] },
  holeRiver:  { cols: [4, 6], rows: [5, 7], tiles: { river: 1 }, hand: { pool: BASE, n: 2 }, need: ['holeRiver'], band: [.02, .4] },
  placeRiver: { cols: [4, 5], rows: [5, 6], hand: { pool: BASE, n: 1, plus: ['river'] }, need: ['placed'], anyNeed: ['river', 'holeRiver'], band: [.002, .4], max: 8000 },
  lakeHome:   { cols: [4, 6], rows: [4, 6], tiles: { lake: 1 }, spawn: true, hand: { pool: BASE, n: 2 }, need: ['lake'], band: [.01, .4] },
  holeLake:   { cols: [4, 6], rows: [4, 6], tiles: { lake: 1 }, home: true, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['holeLake'], band: [.01, .4] },
  riverLake:  { cols: [4, 6], rows: [5, 7], tiles: { river: 1, lake: 1 }, lakeAtMouth: true, spawn: true, hand: { pool: BASE, n: 2 }, need: ['river', 'lake'], band: [.005, .4] },
  placeLake:  { cols: [4, 5], rows: [4, 6], spawn: true, hand: { pool: BASE, n: 1, plus: ['lake'] }, need: ['placed'], anyNeed: ['lake', 'holeLake'], band: [.001, .4], max: 8000 },
  dedoRiver:  { cols: [4, 6], rows: [5, 6], tiles: { river: 1 }, hand: { pool: BASE, n: 1, plus: ['dedo'] }, need: ['dedo', 'river'], band: [.002, .3] },
  /* ---------- minigolf ---------- */
  long:       { cols: [6, 8], rows: [6, 8], hand: { pool: ['palo4', 'palo5', ...BASE], n: 2 }, need: ['long'], band: [.01, .3], dmin: 4 },
  cornerBack: { cols: [4, 6], rows: [5, 7], tiles: { corner: 1 }, hand: { pool: [...BASE, 'palo4'], n: 2 }, need: ['bump'], band: [.02, .4] },
  launchHit:  { cols: [5, 7], rows: [5, 7], tiles: { launcher: 1 }, decoys: 1, hand: { pool: BASE, n: 2 }, need: ['launchHit'], band: [.005, .4] },
  launchFall: { cols: [4, 6], rows: [4, 6], tiles: { launcher: 1 }, spawn: true, hand: { pool: BASE, n: 2 }, need: ['launchFall'], band: [.005, .4] },
  launch2:    { cols: [5, 7], rows: [5, 7], tiles: { launcher: 2 }, hand: { pool: BASE, n: 2 }, need: ['launch2'], band: [.005, .4] },
  holeLaunch: { cols: [5, 7], rows: [5, 7], tiles: { launcher: 1 }, hand: { pool: BASE, n: 2 }, need: ['holeLaunch'], band: [.01, .4] },
  tunnel:     { cols: [4, 6], rows: [4, 6], tiles: { tunnel: 1 }, seed: true, hand: { pool: BASE, n: 2 }, need: ['tunnel'], band: [.01, .4] },
  placeBlock: { cols: [4, 5], rows: [4, 6], hand: { pool: [...BASE, 'palo4'], n: 1, plus: ['block'] }, need: ['placed', 'bump'], band: [.001, .4], max: 8000 },
  placeLauncher: { cols: [5, 6], rows: [5, 6], hand: { pool: BASE, n: 1, plus: ['launcher'] }, need: ['placed', 'launch'], band: [.0005, .4], max: 20000 },
  holeBounce: { cols: [4, 6], rows: [5, 7], tiles: { block: 1, corner: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, anyNeed: ['holeBump', 'holeDeflect'], band: [.01, .4] },
  /* ---------- tren ---------- */
  trainHole:  { cols: [5, 7], rows: [5, 7], train: true, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['holeShove', 'swallow'], band: [.005, .4] },
  trainLine:  { cols: [5, 7], rows: [5, 7], train: true, decoys: 1, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove'], band: [.005, .4] },
  trainFall:  { cols: [5, 7], rows: [5, 7], train: true, spawn: true, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainFall'], band: [.005, .4] },
  wagonRide:  { cols: [5, 7], rows: [5, 7], train: true, hand: { fixed: ['vagon'], plus: ['oTren1', 'trenVuelta', 'palo2', 'palo3'] }, need: ['wagon', 'ride'], band: [.005, .5] },
  wagonHole:  { cols: [5, 7], rows: [5, 7], train: true, hand: { fixed: ['vagon'], plus: ['oTren1', 'trenVuelta', 'palo2', 'palo1'] }, need: ['wagon', 'holeRide'], band: [.005, .5] },
  wagonExit:  { cols: [5, 7], rows: [5, 7], train: true, cars: 1, ballOnWagon: true, hand: { pool: BASE, n: 2 }, need: ['trapExit'], band: [.005, .5] },
  /* ---------- estaciones ---------- */
  wind:       { cols: [5, 6], rows: [5, 6], season: 'spring', wind: true, spawn: true, hand: { pool: BASE, n: 2 }, need: ['wind'], band: [.005, .4] },
  plantBall:  { cols: [4, 6], rows: [4, 6], season: 'spring', tiles: { plant: 1 }, spawn: true, hand: { pool: BASE, n: 2 }, need: ['eaten'], band: [.005, .4] },
  plantHole:  { cols: [4, 6], rows: [4, 6], season: 'spring', tiles: { plant: 1 }, home: true, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['holeEaten'], band: [.005, .4] },
  fireBurn:   { cols: [4, 6], rows: [4, 6], season: 'summer', tiles: { fire: 2 }, spawn: true, hand: { pool: BASE, n: 2 }, need: ['burn'], band: [.005, .4] },
  fireCard:   { cols: [4, 6], rows: [4, 6], season: 'summer', hand: { pool: BASE, n: 1, plus: ['incendio'] }, need: ['fireCard', 'flare'], band: [.001, .4], max: 8000 },
  leaf:       { cols: [4, 6], rows: [5, 6], season: 'autumn', tiles: { leaf: 2 }, hand: { pool: BASE, n: 2 }, need: ['leaf'], band: [.01, .4] },
  puddle:     { cols: [4, 6], rows: [5, 6], season: 'autumn', tiles: { puddle: 2 }, hand: { pool: BASE, n: 2 }, need: ['puddle'], band: [.01, .4] },
  ice:        { cols: [4, 6], rows: [5, 6], season: 'winter', tiles: { ice: 2 }, hand: { pool: BASE, n: 2 }, need: ['slide'], band: [.01, .4] },
  iceDedo:    { cols: [4, 6], rows: [4, 6], season: 'winter', tiles: { ice: 2 }, hand: { pool: BASE, n: 1, plus: ['dedo'] }, need: ['slide', 'dedo'], band: [.002, .4] },
  snowBall:   { cols: [5, 6], rows: [5, 6], season: 'winter', snow: true, hand: { pool: BASE, n: 1, plus: ['oNieve'] }, need: ['snowBall'], band: [.005, .4] },
  snowHole:   { cols: [5, 6], rows: [5, 6], season: 'winter', snow: true, hand: { pool: BASE, n: 1, plus: ['oNieve'] }, need: ['snowHole'], band: [.005, .4] },
  springIce:  { cols: [4, 6], rows: [4, 6], season: 'winter', tiles: { ice: 1 }, spawn: true, hand: { pool: BASE, n: 1, plus: ['estacion'] }, need: ['season', 'eaten'], band: [.002, .4] },
  summerPlant: { cols: [4, 6], rows: [4, 6], season: 'spring', tiles: { plant: 2 }, hand: { pool: BASE, n: 1, plus: ['estacion'] }, need: ['season'], band: [.002, .4] },
  /* ---------- multiverso ---------- */
  bhCopy:     { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'copySink'], band: [.01, .4] },
  pickOwn:    { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'pickOwn', 'copySink'], band: [.002, .4] },
  copyGone:   { cols: [4, 6], rows: [4, 6], tiles: { blackhole: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'copyGone'], band: [.002, .4] },
  placeBH:    { cols: [4, 5], rows: [4, 6], hand: { pool: BASE, n: 1, plus: ['agujeroNegro'] }, need: ['placed', 'absorb'], band: [.001, .4], max: 8000 },
  holeSplit:  { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['holeSplit'], band: [.005, .4] },
  gravCopy:   { cols: [4, 6], rows: [4, 6], tiles: { blackhole: 1 }, hand: { pool: BASE, n: 1, plus: ['gravedad', 'oGravedad'] }, need: ['absorb', 'gpullCopy'], band: [.001, .5] },
  meteorCopy: { cols: [4, 5], rows: [4, 5], tiles: { blackhole: 1 }, seed: true, hand: { pool: BASE, n: 1, plus: ['meteoritos'] }, need: ['absorb', 'meteorCopy'], band: [.001, .6] },
  holeCopyGone: { cols: [4, 6], rows: [4, 6], tiles: { blackhole: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['holeSplit', 'holeCopyGone'], band: [.001, .5] },
  dedoSplit:  { cols: [4, 6], rows: [4, 6], tiles: { blackhole: 1 }, hand: { pool: BASE, n: 1, plus: ['dedo'] }, need: ['absorb', 'dedo', 'copySink'], band: [.001, .5] },
  rock:       { cols: [4, 6], rows: [5, 7], tiles: { meteorite: 2 }, hand: { pool: [...BASE, 'palo4'], n: 2 }, need: ['rockBump'], band: [.01, .4] },
  meteor:     { cols: [4, 5], rows: [4, 5], seed: true, spawn: true, hand: { pool: BASE, n: 1, plus: ['meteoritos'] }, need: ['meteor'], band: [.005, .5] },
  gravityHole: { cols: [4, 6], rows: [4, 6], hand: { pool: BASE, n: 1, plus: ['gravedad'] }, need: ['gpullHole', 'swallow'], band: [.002, .4] },
  gravity1:   { cols: [4, 6], rows: [4, 6], hand: { pool: BASE, n: 1, plus: ['oGravedad'] }, need: ['gpullBall'], band: [.002, .4] },
  clash:      { cols: [4, 6], rows: [4, 6], decoys: [1, 2], hand: { pool: [...BASE, 'oPalo1'], n: 1, plus: ['gravedad', 'oGravedad'] }, need: ['clash'], band: [.0005, .6] },
  gstuck:     { cols: [4, 6], rows: [4, 6], tiles: { meteorite: 1, block: 1 }, decoys: [0, 1], hand: { pool: [...BASE, ...OHOLE], n: 1, plus: ['gravedad', 'oGravedad'] }, need: ['gstuck', 'gravity'], band: [.0005, .6] },
  /* ---------- casino ---------- */
  diceDedo:   { cols: [4, 6], rows: [4, 6], tiles: { dice: 1 }, hand: { pool: BASE, n: 1, plus: ['dedo'] }, need: ['dice', 'dedo'], band: [.002, .4] },
  diceTwice:  { cols: [4, 6], rows: [4, 7], tiles: { dice: 1 }, hand: { pool: [...BASE, ...OHOLE, 'oPalo1', 'palo4'], n: 2 }, need: ['diceTwice'], band: [.0005, .6] },
  placeDice:  { cols: [4, 5], rows: [4, 6], seed: true, hand: { pool: BASE, n: 1, plus: ['dado'] }, need: ['placed', 'dice'], band: [.001, .4], max: 8000 },
  coinHeads:  { cols: [4, 6], rows: [4, 6], coins: 1, seed: true, hand: { pool: BASE, n: 1 }, need: ['coin', 'heads'], band: [.005, .5] },
  coinTails:  { cols: [4, 6], rows: [4, 6], coins: 1, seed: true, spawn: true, hand: { pool: BASE, n: 2 }, need: ['coin', 'tails'], band: [.005, .5] },
  holeCoin:   { cols: [4, 6], rows: [4, 6], coins: 1, seed: true, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['holeCoin'], band: [.005, .5] },
  goldWin:    { cols: [4, 6], rows: [4, 6], gold: true, seed: true, hand: { pool: BASE, n: 2 }, need: ['gold'], band: [.005, .5] },
  roulette:   { cols: [4, 6], rows: [4, 6], gold: true, seed: true, spawn: true, hand: { pool: BASE, n: 1, plus: ['ruleta'] }, need: ['roulette', 'goHome'], band: [.005, .5] },
  /* ---------- Lo no tan básico ---------- */
  palo10:     { cols: [11, 12], rows: [5, 6], hand: { pool: BASE, n: 1, plus: ['palo10'] }, need: ['palo10'], band: [.005, .3], dmin: 6 },
  iriHit:     { cols: [5, 6], rows: [5, 6], decoys: [1, 2], hand: { pool: BASE, n: 1, plus: ['paloIri'] }, need: ['iri', 'iriHit'], band: [.005, .4] },
  iriBounce:  { cols: [5, 6], rows: [5, 6], tiles: { block: 1, corner: 1 }, decoys: 1, hand: { pool: BASE, n: 1, plus: ['paloIri'] }, need: ['iri', 'iriBump'], band: [.003, .4] },
  launchLake: { cols: [5, 6], rows: [5, 6], tiles: { launcher: 1, lake: 1 }, spawn: true, hand: { pool: BASE, n: 2 }, need: ['launch', 'lake'], band: [.0003, .7] },
  riverThrough: { cols: [4, 6], rows: [5, 7], tiles: { river: 1, corner: 1 }, cornerAtMouth: true, hand: { pool: [...BASE, 'oPalo1'], n: 2 }, need: ['river', 'deflect'], band: [.003, .4] },
  riverPortal: { cols: [5, 6], rows: [5, 7], tiles: { river: 1, portal: 1 }, portalAtMouth: true, hand: { pool: [...BASE, 'oPalo1'], n: 2 }, need: ['river', 'portal'], band: [.003, .4] },
  launchBunker: { cols: [5, 6], rows: [5, 6], tiles: { launcher: 1, bunker: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['launch', 'bunker'], band: [.003, .4] },
  launchPortal: { cols: [5, 6], rows: [5, 7], tiles: { launcher: 1, portal: 1 }, hand: { pool: [...BASE, 'oPalo1'], n: 2 }, need: ['launch', 'portal'], band: [.003, .4] },
  trainRiver: { cols: [5, 7], rows: [5, 7], train: true, tiles: { river: 1 }, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove', 'river'], band: [.003, .4] },
  trainLake:  { cols: [5, 7], rows: [5, 7], train: true, tiles: { lake: 1 }, spawn: true, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove', 'lake'], band: [.0003, .7] },
  trainBunker: { cols: [5, 7], rows: [5, 7], train: true, tiles: { bunker: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove', 'bunker'], band: [.003, .4] },
  trainPortal: { cols: [5, 7], rows: [5, 7], train: true, tiles: { portal: 1 }, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove', 'portal'], band: [.003, .4] },
  trainLaunch: { cols: [5, 7], rows: [5, 7], train: true, tiles: { launcher: 1 }, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['trainShove', 'launch'], band: [.003, .4] },
  firePortal: { cols: [5, 6], rows: [5, 6], season: 'summer', tiles: { fire: 1, portal: 1 }, hand: { pool: BASE, n: 2 }, need: ['flare', 'portal'], band: [.0003, .7] },
  iceBunker:  { cols: [4, 6], rows: [5, 6], season: 'winter', tiles: { ice: 1, bunker: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['slide', 'bunker'], band: [.003, .4] },
  snowBlock:  { cols: [5, 6], rows: [5, 6], season: 'winter', snow: true, tiles: { block: 1 }, hand: { pool: BASE, n: 1, plus: ['oNieve'] }, need: ['snowBall'], ess: ['block'], band: [.003, .4] },
  plantCopy:  { cols: [5, 6], rows: [5, 6], season: 'spring', tiles: { plant: 1, blackhole: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'copyEaten', 'copySink'], band: [.001, .4] },
  fireLaunch: { cols: [5, 6], rows: [5, 6], season: 'summer', tiles: { fire: 1, launcher: 1 }, hand: { pool: BASE, n: 2 }, need: ['flare', 'launch'], band: [.0003, .7] },
  copyLake:   { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1, lake: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'copyLake'], band: [.001, .4] },
  bhPortal:   { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1, portal: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'teleportAny', 'copySink'], band: [.001, .4] },
  gravBlock:  { cols: [4, 6], rows: [4, 6], tiles: { block: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 1, plus: ['gravedad', 'oGravedad'] }, need: ['gravity', 'gstuck'], band: [.0003, .7] },
  gravRiver:  { cols: [4, 6], rows: [5, 6], tiles: { river: 1 }, hand: { pool: BASE, n: 1, plus: ['gravedad', 'oGravedad'] }, need: ['gpullBall', 'river'], band: [.001, .5] },
  rockIri:    { cols: [5, 6], rows: [5, 6], tiles: { meteorite: 2 }, decoys: [0, 1], hand: { pool: BASE, n: 1, plus: ['paloIri'] }, need: ['iri', 'iriBump'], band: [.0003, .7] },
  dicePortal: { cols: [5, 6], rows: [5, 6], tiles: { dice: 1, portal: 1 }, hand: { pool: [...BASE, ...OHOLE, 'oPalo1'], n: 2 }, need: ['dicePortal'], band: [.0003, .7] },
  iriDice:    { cols: [5, 6], rows: [5, 6], tiles: { dice: 1 }, decoys: [0, 1], hand: { pool: BASE, n: 1, plus: ['paloIri'] }, need: ['iri', 'dice'], band: [.002, .5] },
  coinDedo:   { cols: [4, 5], rows: [4, 5], coins: 1, seed: true, hand: { pool: BASE, n: 0, plus: ['dedo'] }, need: ['coin', 'heads', 'dedo'], band: [.001, .5] },
  diceLaunch: { cols: [5, 6], rows: [5, 6], tiles: { dice: 1, launcher: 1 }, hand: { pool: [...BASE, ...OHOLE, 'oPalo1'], n: 2 }, anyNeed: ['dice', 'holeDice'], need: ['launch'], band: [.0003, .7] },
  goldCopy:   { cols: [5, 6], rows: [5, 6], tiles: { blackhole: 1 }, gold: true, seed: true, hand: { pool: BASE, n: 2 }, need: ['absorb', 'roulette'], band: [.0003, .7] },
  diceBunker: { cols: [5, 6], rows: [5, 6], tiles: { dice: 1, bunker: 1 }, hand: { pool: [...BASE, ...OHOLE], n: 2 }, need: ['dice', 'bunker'], band: [.0003, .7] },
  waterMini:  { cols: [5, 6], rows: [5, 6], tiles: { river: 1, block: 1, corner: 1 }, hand: { pool: [...BASE, 'palo4'], n: 2 }, need: ['river'], anyNeed: ['bump', 'deflect', 'holeBump', 'holeDeflect'], band: [.0005, .6] },
  final5:     { cols: [6, 7], rows: [6, 7], tiles: { river: 1, dice: 1, portal: 1 }, hand: { pool: [...BASE, 'oPalo1', ...OHOLE], n: 2 }, anyNeed: ['dice', 'holeDice'], need: ['teleportAny'], band: [.0005, .6] },
  final6:     { cols: [6, 7], rows: [6, 7], season: 'autumn', tiles: { leaf: 2, blackhole: 1, launcher: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb', 'leaf'], band: [.0005, .6] },
  final1:     { cols: [6, 7], rows: [6, 7], tiles: { river: 1, launcher: 1, portal: 1 }, hand: { pool: [...BASE, 'oPalo1'], n: 2, plus: OHOLE }, need: ['river', 'launch'], anyNeed: ['portal', 'holePortal'], band: [.0003, .7] },
  final2:     { cols: [6, 7], rows: [6, 7], season: 'winter', tiles: { ice: 1, dice: 1, bunker: 1 }, hand: { pool: [...BASE, 'oPalo1'], n: 2 }, need: ['slide', 'dice'], band: [.001, .3] },
  final3:     { cols: [6, 7], rows: [6, 7], train: true, tiles: { blackhole: 1 }, hand: { pool: BASE, n: 1, plus: ['oTren1', 'trenVuelta'] }, need: ['absorb', 'trainShove'], band: [.001, .4] },
  final4:     { cols: [6, 7], rows: [6, 7], season: 'summer', tiles: { fire: 1, launcher: 1, blackhole: 1 }, hand: { pool: BASE, n: 2 }, need: ['absorb'], anyNeed: ['flare', 'launch'], band: [.001, .4] },
}[lesson];
if (!LESSONS) throw new Error('lección ' + lesson);
const T = LESSONS;

function build() {
  const cols = range(T.cols), rows = range(T.rows), used = new Set(), k = (x, y) => x + ',' + y;
  const inB = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const free = (x, y) => inB(x, y) && !used.has(k(x, y));
  const cell = (ok = () => true) => { for (let i = 0; i < 200; i++) { const x = ri(cols), y = ri(rows); if (free(x, y) && ok(x, y)) { used.add(k(x, y)); return { x, y }; } } return null; };
  const L = { version: 1, puzzle: true, cols, rows, tiles: [], parCells: [], deckCounts: { palo1: 3, palo2: 3, palo3: 3 } };
  // la vía del tren, antes que nada (las piezas no van encima)
  let track = null;
  if (T.train) {
    const x0 = ri(cols - 2), y0 = ri(rows - 2), x1 = x0 + 2 + ri(cols - x0 - 2), y1 = y0 + 2 + ri(rows - y0 - 2);
    L.train = ring(x0, y0, x1, y1, { stop: ri(4), cars: T.cars || 0 });
    track = new Set(L.train.path.map(([x, y]) => k(x, y)));
  }
  const offTrack = (x, y) => !track?.has(k(x, y));
  for (const [type, n] of Object.entries(T.tiles || {})) for (let i = 0; i < n; i++) {
    if (type === 'river') {
      const len = 2 + ri(3), x = ri(cols), y0 = T.riverEdge ? rows - len : ri(rows - len);
      const cs = Array.from({ length: len }, (_, j) => ({ x, y: y0 + j }));
      if (!cs.every(c => free(c.x, c.y) && offTrack(c.x, c.y))) return null;
      cs.forEach(c => { used.add(k(c.x, c.y)); L.tiles.push({ type, ...c }); });
      if (T.cornerAtMouth || T.portalAtMouth) { const m = { x, y: y0 + len }; if (!free(m.x, m.y)) return null; used.add(k(m.x, m.y)); L.tiles.push(T.cornerAtMouth ? { type: 'corner', ...m, rot: pick([0, 1, 2, 3]) } : { type: 'portal', ...m }); }
      if (T.lakeAtMouth) { const m = { x, y: y0 + len }; if (!free(m.x, m.y)) return null; used.add(k(m.x, m.y)); L.tiles.push({ type: 'lake', ...m }); }
    } else if ((type === 'lake' && T.lakeAtMouth) || (type === 'corner' && T.cornerAtMouth)) continue;
    else if (type === 'portal' && T.portalAtMouth) { const c = cell(offTrack); if (!c) return null; L.tiles.push({ type, ...c }); }
    else if (type === 'lake') {
      const c0 = cell(offTrack); if (!c0) return null; const cs = [c0]; L.tiles.push({ type, ...c0 });
      for (let j = 0, n2 = ri(3); j < 20 && cs.length < n2 + 1; j++) { const b = pick(cs), d = pick([[1, 0], [-1, 0], [0, 1], [0, -1]]); const c = { x: b.x + d[0], y: b.y + d[1] }; if (free(c.x, c.y) && offTrack(c.x, c.y)) { used.add(k(c.x, c.y)); cs.push(c); L.tiles.push({ type, ...c }); } }
    } else if (type === 'portal') {
      const a = cell(offTrack), b = cell(offTrack); if (!a || !b) return null;
      L.tiles.push({ type, ...a }, { type, ...b });
    } else {
      const c = cell(offTrack); if (!c) return null;
      const tl = { type, ...c };
      if (type === 'corner' || type === 'launcher') { const r = ri(4); if (r) tl.rot = r; }
      if (type === 'dice') { const t = 1 + ri(6), side = [1, 2, 3, 4, 5, 6].filter(f => f !== t && f !== 7 - t), n = pick(side); Object.assign(tl, { t, n, e: pick(side.filter(f => f !== n && f !== 7 - n)) }); }
      L.tiles.push(tl);
    }
  }
  // pelota, hoyo y obstáculos: sobre una pieza si la lección lo pide (ballOn / holeOn / decoyOn)
  const onTile = type => { const tl = L.tiles.find(q => q.type === type && !q.taken); if (!tl) return null; tl.taken = true; return { x: tl.x, y: tl.y }; };
  const loco = L.train && k(...L.train.path[L.train.pos]);
  const notLoco = (x, y) => k(x, y) !== loco;
  let ball;
  if (T.ballOnWagon) { const [x, y] = L.train.path[(L.train.pos - 1 + L.train.path.length) % L.train.path.length]; ball = { x, y }; used.add(k(x, y)); }
  else ball = T.ballOn ? onTile(T.ballOn) : cell(notLoco);
  const hole = T.holeOn ? onTile(T.holeOn) : cell(notLoco);
  if (!ball || !hole || Math.abs(ball.x - hole.x) + Math.abs(ball.y - hole.y) < (T.dmin || 2)) return null;
  Object.assign(L, { hole, ball });
  const extraBalls = [];
  for (let i = 0, nd = range(T.decoys); i < nd; i++) { const c = i === 0 && T.decoyOn ? onTile(T.decoyOn) : cell(notLoco); if (!c) return null; extraBalls.push(c); }
  if (extraBalls.length) L.extraBalls = extraBalls;
  L.tiles.forEach(t => delete t.taken);
  if (T.spawn) { const c = cell(notLoco); if (!c) return null; L.spawn = c; }
  if (T.home) { const c = cell(notLoco); if (!c) return null; L.home = c; }
  if (T.season) {
    L.season = { now: T.season };
    if (T.snow) { const c = cell(offTrack); if (!c) return null; L.season.snow = c; }
    if (T.wind) {
      const path = windRoute(cols, rows, rnd, (x, y) => x === hole.x && y === hole.y, (x, y) => (x === ball.x && y === ball.y) || (L.spawn && x === L.spawn.x && y === L.spawn.y));
      if (!path) return null;
      L.season.wind = { path, on: true };
    }
  }
  if (T.coins || T.gold) {
    const coins = []; for (let i = 0; i < (T.coins || 0); i++) { const c = cell(offTrack); if (!c) return null; coins.push(c); }
    let gold = null; if (T.gold) { gold = cell((x, y) => offTrack(x, y) && x > 0 && x < cols - 1); if (!gold) return null; }
    L.gamble = { gold, coins };
  }
  if (T.seed) L.seed = 1 + ri(99999);
  let hand;
  if (T.hand.fixed) { hand = [...T.hand.fixed]; if (T.hand.plus) hand.push(pick(T.hand.plus)); }
  else {
    hand = [];
    while (hand.length < T.hand.n) { const c = pick(T.hand.pool); if (!hand.includes(c)) hand.push(c); }
    if (T.hand.plus) hand.push(pick(T.hand.plus));
  }
  L.hand = hand.sort(() => rnd() - .5);
  return L;
}

const needAll = (T.need || []).map(n => { if (!NEED[n]) throw new Error('need ' + n); return NEED[n]; });
const needAny = (T.anyNeed || []).map(n => NEED[n]);
const teaches = evs => needAll.every(f => f(evs)) && (!needAny.length || needAny.some(f => f(evs)));
let best = [];
const [rmin, rmax] = T.band, mid = Math.sqrt(rmin * rmax);
for (let i = 0; i < +TRIES; i++) {
  const L = build(); if (!L) continue;
  const all = plays(L, { events: true, cap: T.max || 3000 }); if (!all) continue;
  const wins = all.filter(s => s.win); if (!wins.length) continue;
  const ratio = wins.length / all.length;
  if (ratio < rmin || ratio > rmax) continue;
  if (!wins.every(w => teaches(w.evs))) continue;
  if (T.ess && T.ess.some(tp => plays({ ...L, tiles: L.tiles.filter(q => q.type !== tp) }, { cap: 3000 })?.some(x => x.win))) continue;
  const q = quality(L, { need: teaches });
  if (!q.ok || q.idleTiles.length || q.idleDecoys.length) continue;
  const score = Math.abs(Math.log(q.ratio / mid)) + .08 * (L.cols * L.rows - 25) + .15 * L.tiles.length + .25 * (L.extraBalls?.length || 0) + .2 * L.hand.length;
  const key = JSON.stringify([L.hole, L.ball, L.tiles, L.extraBalls, L.hand]);
  if (best.some(b => b.key === key)) continue;
  best.push({ score, key, ratio: +q.ratio.toFixed(3), wins: q.wins, total: q.total, L, sol: q.sol });
  best.sort((a, b) => a.score - b.score); best = best.slice(0, 12);
}
fs.mkdirSync('puzzle-candidates', { recursive: true });
fs.writeFileSync(`puzzle-candidates/basics-${lesson}.json`, JSON.stringify(best.map(({ key, ...b }) => b), null, 1));
if (!best.length) console.log(lesson, ': nada');
for (const [n, b] of best.slice(0, +SHOW).entries()) {
  const extra = { ...(b.L.season ? { season: b.L.season } : {}), ...(b.L.train ? { train: b.L.train } : {}), ...(b.L.seed ? { seed: b.L.seed } : {}), ...(b.L.spawn ? { spawn: b.L.spawn } : {}), ...(b.L.home ? { home: b.L.home } : {}) };
  console.log(`\n#${n} ${lesson} ${b.L.cols}x${b.L.rows} ratio ${b.ratio} (${b.wins}/${b.total}) mano: ${b.L.hand.join(' ')} ${JSON.stringify(extra)}`);
  console.log(drawLevel(b.L) + 'solución: ' + describe(b.L, b.sol));
}
