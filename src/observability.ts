import { randomUUID } from 'node:crypto'
import type { Context, Next } from 'hono'

type MetricsSnapshot = {
  requests: Record<string, number>
  statusCodes: Record<string, number>
  errors: number
  uptimeMs: number
}

const startedAt = Date.now()
const requestCounts = new Map<string, number>()
const statusCounts = new Map<string, number>()
let errorCount = 0

const formatPayload = (payload: Record<string, unknown>) => {
  return JSON.stringify(payload)
}

const incrementCounter = (map: Map<string, number>, key: string) => {
  map.set(key, (map.get(key) || 0) + 1)
}

export interface TelemetryEvent {
  id: string
  level: 'info' | 'warn' | 'error'
  event: string
  timestamp: string
  payload: Record<string, unknown>
}

export interface ErrorReport {
  id: string
  timestamp: string
  message: string
  stack?: string
  method?: string
  path?: string
  ip?: string
  requestId?: string
  status?: number
  context?: Record<string, unknown>
}

const MAX_EVENT_LOGS = 100
const MAX_ERROR_LOGS = 50

const eventBuffer: TelemetryEvent[] = []
const errorBuffer: ErrorReport[] = []

let logSink: ((entry: any) => Promise<void> | void) | null = null

export const setLogSink = (sink: (entry: any) => Promise<void> | void) => {
  logSink = sink
}

const pushEvent = (level: 'info' | 'warn' | 'error', event: string, payload: Record<string, unknown> = {}) => {
  const item: TelemetryEvent = {
    id: randomUUID(),
    level,
    event,
    timestamp: new Date().toISOString(),
    payload,
  }
  eventBuffer.unshift(item)
  if (eventBuffer.length > MAX_EVENT_LOGS) {
    eventBuffer.pop()
  }

  if (logSink) {
    try {
      logSink({
        level,
        event,
        message: (payload.message as string) || (payload.event as string) || event,
        requestId: payload.requestId as string,
        status: payload.status as number,
        method: payload.method as string,
        path: payload.path as string,
        ip: payload.ip as string,
        payload,
      })
    } catch {}
  }
}

export const logInfo = (event: string, payload: Record<string, unknown> = {}) => {
  pushEvent('info', event, payload)
  console.info(formatPayload({ level: 'info', event, timestamp: new Date().toISOString(), ...payload }))
}

export const logWarn = (event: string, payload: Record<string, unknown> = {}) => {
  pushEvent('warn', event, payload)
  console.warn(formatPayload({ level: 'warn', event, timestamp: new Date().toISOString(), ...payload }))
}

export const logError = (event: string, payload: Record<string, unknown> = {}) => {
  errorCount += 1
  pushEvent('error', event, payload)
  
  const report: ErrorReport = {
    id: (payload.requestId as string) || randomUUID(),
    timestamp: new Date().toISOString(),
    message: String(payload.message || event),
    stack: typeof payload.stack === 'string' ? payload.stack : undefined,
    method: typeof payload.method === 'string' ? payload.method : undefined,
    path: typeof payload.path === 'string' ? payload.path : undefined,
    ip: typeof payload.ip === 'string' ? payload.ip : undefined,
    requestId: typeof payload.requestId === 'string' ? payload.requestId : undefined,
    status: typeof payload.status === 'number' ? payload.status : 500,
    context: payload,
  }
  errorBuffer.unshift(report)
  if (errorBuffer.length > MAX_ERROR_LOGS) {
    errorBuffer.pop()
  }

  console.error(formatPayload({ level: 'error', event, timestamp: new Date().toISOString(), ...payload }))
}

export const getTelemetryData = (limit = 50) => {
  return {
    summary: {
      uptimeMs: Date.now() - startedAt,
      totalErrors: errorCount,
      totalRequests: Object.values(Object.fromEntries(requestCounts)).reduce((a, b) => a + b, 0),
      statusCodes: Object.fromEntries(statusCounts),
      routes: Object.fromEntries(requestCounts),
    },
    recentEvents: eventBuffer.slice(0, limit),
    recentErrors: errorBuffer.slice(0, limit),
  }
}

export const clearTelemetryBuffer = () => {
  eventBuffer.length = 0
  errorBuffer.length = 0
}

export const observabilityMiddleware = async (c: Context, next: Next) => {
  const requestId = c.req.header('x-request-id') || randomUUID()
  const startTime = Date.now()
  const method = c.req.method
  const path = c.req.path
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || 'unknown'
  const userAgent = c.req.header('user-agent') || 'unknown'

  c.set('requestId', requestId)
  c.header('X-Request-ID', requestId)

  logInfo('request.start', {
    requestId,
    method,
    path,
    ip,
    userAgent,
  })

  try {
    await next()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    logError('request.failed', {
      requestId,
      method,
      path,
      ip,
      message,
      stack,
    })
    throw error
  } finally {
    const durationMs = Date.now() - startTime
    const status = c.res?.status ?? 500

    incrementCounter(requestCounts, `${method} ${path}`)
    incrementCounter(statusCounts, `${status}`)

    c.header('X-Response-Time-Ms', durationMs.toString())

    if (status >= 400) {
      if (status >= 500) {
        logError('http.error', {
          requestId,
          method,
          path,
          status,
          ip,
          durationMs,
        })
      } else {
        logWarn('http.client_error', {
          requestId,
          method,
          path,
          status,
          ip,
          durationMs,
        })
      }
    } else {
      logInfo('request.end', {
        requestId,
        method,
        path,
        status,
        durationMs,
      })
    }
  }
}

export const getMetrics = (): MetricsSnapshot => ({
  requests: Object.fromEntries(requestCounts),
  statusCodes: Object.fromEntries(statusCounts),
  errors: errorCount,
  uptimeMs: Date.now() - startedAt,
})
