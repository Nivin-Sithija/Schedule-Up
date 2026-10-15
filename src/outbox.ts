import type { State } from './domain.js';
export function confirmSend(state: State, id: string, providerId: string) {
  const item = state.schedules.find(s => s.id === id);
  if (!item) throw new Error('Send request missing');
  item.status = 'sent'; item.providerId = providerId; delete item.error;
}
export function markUncertain(state: State, id: string, error: string) {
  const item = state.schedules.find(s => s.id === id);
  if (!item) throw new Error('Send request missing');
  if (item.status === 'sent' && item.providerId) { delete item.error; return item.providerId; }
  item.status = 'uncertain'; item.error = error; return undefined;
}
