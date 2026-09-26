// Racha del reto diario: metas, estado visto desde hoy (viva, en peligro, apagada) y celebración una vez al día.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const { nextStreakGoal, isStreakGoal, dailyStreakInfo, claimStreakGoal, recordDailyPlayed } = await import('../src/ui/records.js');

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
