import * as Sentry from '@sentry/node';
import { config } from './config.js';
Sentry.init({ dsn: config.SENTRY_DSN || undefined, enabled: !!config.SENTRY_DSN, tracesSampleRate: 1, beforeSend(event) { delete event.request; return event; } });
export async function trace<T>(name: string, fn: () => Promise<T>, attrs: Record<string, string | number> = {}): Promise<T> { return Sentry.startSpan({ name, op: name, attributes: attrs }, fn); }
export const captureError = (e: unknown) => Sentry.captureException(e instanceof Error ? new Error(e.message.slice(0, 200)) : new Error('Operation failed'));
export function modelMetrics(usage: any) { const span=Sentry.getActiveSpan(); if(!span)return; if(typeof usage?.inputTokens==='number')span.setAttribute('gen_ai.usage.input_tokens',usage.inputTokens);if(typeof usage?.outputTokens==='number')span.setAttribute('gen_ai.usage.output_tokens',usage.outputTokens);span.setAttribute('scheduleup.inference_billing','local or free endpoint; infrastructure cost excluded'); }
