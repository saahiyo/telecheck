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

export const logInfo = (event: string, payload: Record<string, unknown> = {}) => {
  console.info(formatPayload({ level: 'info', event, timestamp: new Date().toISOString(), ...payload }))
}

export const logError = (event: string, payload: Record<string, unknown> = {}) => {
  errorCount += 1
  console.error(formatPayload({ level: 'error', event, timestamp: new Date().toISOString(), ...payload }))
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
    logError('request.failed', {
      requestId,
      method,
      path,
      message,
    })
    throw error
  } finally {
    const durationMs = Date.now() - startTime
    const status = c.res?.status ?? 500

    incrementCounter(requestCounts, `${method} ${path}`)
    incrementCounter(statusCounts, `${status}`)

    c.header('X-Response-Time-Ms', durationMs.toString())

    logInfo('request.end', {
      requestId,
      method,
      path,
      status,
      durationMs,
    })
  }
}

export const getMetrics = (): MetricsSnapshot => ({
  requests: Object.fromEntries(requestCounts),
  statusCodes: Object.fromEntries(statusCounts),
  errors: errorCount,
  uptimeMs: Date.now() - startedAt,
})
