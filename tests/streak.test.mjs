// Racha del reto diario: metas, estado visto desde hoy (viva, en peligro, apagada) y celebración una vez al día.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { nextStreakGoal, isStreakGoal, dailyStreakInfo, claimStreakGoal, recordDailyPlayed, setStreakFrozen } = await import('../src/ui/records.js');

const R = daily => ({ daily: { days: {}, streak: 0, bestStreak: 0, last: null, ...daily } });

test('metas de la racha: 3, 7, 15, 30… y cada 100 después de 365', () => {
  assert.deepEqual([0, 2, 3, 6, 7, 14, 29, 99, 364, 365, 399].map(nextStreakGoal), [3, 3, 7, 7, 15, 15, 30, 100, 365, 400, 400]);
  assert.ok(isStreakGoal(7) && isStreakGoal(365) && isStreakGoal(500));
  assert.ok(!isStreakGoal(8) && !isStreakGoal(450));
});

test('estado de la racha: jugada hoy, en peligro, apagada o sin empezar', () => {
  assert.deepEqual(dailyStreakInfo('2026-03-10', R({ streak: 5, last: '2026-03-10' })), { n: 5, today: true, atRisk: false, lost: 0 });
  assert.deepEqual(dailyStreakInfo('2026-03-10', R({ streak: 5, last: '2026-03-09' })), { n: 5, today: false, atRisk: true, lost: 0 });
  assert.deepEqual(dailyStreakInfo('2026-03-10', R({ streak: 5, last: '2026-03-07' })), { n: 0, today: false, atRisk: false, lost: 5 });
  assert.deepEqual(dailyStreakInfo('2026-03-10', R({ streak: 1, last: '2026-03-07' })), { n: 0, today: false, atRisk: false, lost: 0 });
  assert.deepEqual(dailyStreakInfo('2026-03-01', R({ streak: 2, last: '2026-02-28' })).atRisk, true); // cambio de mes
});

test('la meta se celebra una sola vez al día, aunque se repita el reto', () => {
  store.clear();
  for (const d of ['2026-03-01', '2026-03-02']) recordDailyPlayed(d);
  assert.equal(claimStreakGoal('2026-03-02'), false); // racha 2: aún no es meta
  recordDailyPlayed('2026-03-03');
  assert.equal(claimStreakGoal('2026-03-03'), true);  // racha 3
  assert.equal(claimStreakGoal('2026-03-03'), false); // otra partida el mismo día
});

test('racha congelada (regalo de early tester): no se pierde sin jugar, sigue sumando y, al descongelarla, hay que jugar hoy', () => {
  store.clear();
  for (const d of ['2026-03-01', '2026-03-02', '2026-03-03']) recordDailyPlayed(d);
  setStreakFrozen(true, '2026-03-03');
  assert.deepEqual(dailyStreakInfo('2026-03-20'), { n: 3, today: false, atRisk: false, lost: 0, frozen: true }, 'días después, viva');
  recordDailyPlayed('2026-03-20');
  assert.equal(dailyStreakInfo('2026-03-20').n, 4, 'jugando, sigue sumando');
  setStreakFrozen(false, '2026-03-25');
  assert.deepEqual(dailyStreakInfo('2026-03-25'), { n: 4, today: false, atRisk: true, lost: 0 }, 'descongelada: viva hoy, en peligro');
  recordDailyPlayed('2026-03-25');
  assert.equal(dailyStreakInfo('2026-03-25').n, 5);
});

test('estadísticas del reto diario: días jugados y ganados, distribución con tu mejor de cada día y arranque desde lo guardado', async () => {
  const { recordEnd, dailyStats } = await import('../src/ui/records.js');
  store.clear();
  const win = (date, turns) => recordEnd('daily', { won: true, date, stats: { misTurnos: turns - 1, golpes: 3 } });
  recordDailyPlayed('2026-04-01'); win('2026-04-01', 5);
  recordDailyPlayed('2026-04-02'); win('2026-04-02', 7); win('2026-04-02', 4); // repetido el mismo día: cuenta el mejor
  recordDailyPlayed('2026-04-03'); recordEnd('daily', { won: false, date: '2026-04-03', stats: { misTurnos: 6 } });
  recordDailyPlayed('2026-04-03'); // (otra vez el mismo día: no suma)
  const st = dailyStats('2026-04-03');
  assert.deepEqual({ played: st.played, won: st.won, pct: st.pct, streak: st.streak, best: st.best }, { played: 3, won: 2, pct: 67, streak: 3, best: 3 });
  assert.deepEqual(Object.fromEntries(Object.entries(st.dist).filter(([, n]) => n)), { 4: 1, 5: 1 });
  assert.equal(dailyStats('2026-04-02').today, 4, 'el resultado de hoy (para resaltarlo)');
  // estadísticas guardadas antes de existir los contadores: se sacan de los días guardados
  store.set('chaoticgolf_stats', JSON.stringify({ version: 1, daily: { days: { '2026-04-01': { best: 6 }, '2026-04-02': { best: null }, '2026-04-03': { best: 6 } }, streak: 3, bestStreak: 5, last: '2026-04-03' } }));
  const old = dailyStats('2026-04-03');
  assert.deepEqual({ played: old.played, won: old.won, dist: old.dist }, { played: 5, won: 2, dist: { 6: 2 } });
});
