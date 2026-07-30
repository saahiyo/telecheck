import {
  type CheckResult,
  type CheckStatus,
  type FetchTargetValidation,
  type HttpCheckOptions,
  type HttpCheckResult,
  type MegaCheckResult,
  type Platform,
  type TelegramCheckResult,
  type UnknownCheckResult,
} from './types.js'
import {
  deleteLinks,
  incrementStat,
  saveLink,
} from './db.js'
import {
  checkRateLimit,
  deleteFromCache,
  getFromCache,
  incrementRedisStat,
  isUniqueCheck24h,
  setInCache,
  singleflight,
} from './redis.js'

const MAX_URL_LENGTH = 2048
const MAX_FETCH_BYTES = 1024 * 1024
const ALLOWED_FETCH_HOSTS = new Set(['t.me', 'telegram.me', 'telegram.org', 'mega.nz', 'mega.co.nz'])

export const normalize = (input: string) => {
  let s = input.trim()
  if (!s) return ''

  if (s.startsWith('@')) return `https://t.me/${s.slice(1)}`
  if (/^[A-Za-z0-9_]{5,32}$/.test(s)) return `https://t.me/${s}`
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s

  return s
}

export const normalizeHostname = (hostname: string): string => {
  return hostname.toLowerCase().replace(/^\[(.*)\]$/, '$1').replace(/\.$/, '')
}

export const detectPlatform = (url: string): Platform => {
  try {
    const u = new URL(url)
    const host = normalizeHostname(u.hostname)
    if (host === 't.me' || host === 'telegram.me' || host === 'telegram.org') return 'telegram'
    if (host === 'mega.nz' || host === 'mega.co.nz') return 'mega'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

export const isPrivateHostname = (hostname: string): boolean => {
  const host = normalizeHostname(hostname)
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return true

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (ipv4) {
    const parts = ipv4.slice(1).map(Number)
    if (parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true
    const [a, b] = parts
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    )
  }

  return host === '::1' || host === '::' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')
}

export const validateFetchTarget = (url: string): FetchTargetValidation => {
  const platform = detectPlatform(url)

  if (!url || url.length > MAX_URL_LENGTH) {
    return { ok: false, platform, reason: 'URL is empty or too long' }
  }

  try {
    const parsed = new URL(url)
    const hostname = normalizeHostname(parsed.hostname)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, platform, reason: 'Unsupported URL protocol' }
    }

    if (parsed.username || parsed.password) {
      return { ok: false, platform, reason: 'URL credentials are not allowed' }
    }

    if (isPrivateHostname(hostname)) {
      return { ok: false, platform, reason: 'Private or local host is not allowed' }
    }

    if (!ALLOWED_FETCH_HOSTS.has(hostname) || platform === 'unknown') {
      return { ok: false, platform, reason: 'Only Telegram and MEGA links are supported' }
    }

    return { ok: true, platform }
  } catch {
    return { ok: false, platform, reason: 'Invalid URL' }
  }
}

const extractText = (html: string, className: string): string | null => {
  const regex = new RegExp(`<div[^>]*class="[^"]*${className}[^"]*"[^>]*>([\\s\\S]*?)</div>`)
  const match = html.match(regex)
  if (!match) return null
  return match[1].replace(/<[^>]+>/g, '').trim()
}

const extractImgSrc = (html: string, className: string): string | null => {
  const regex = new RegExp(`<img[^>]*class="[^"]*${className}[^"]*"[^>]*src="([^"]+)"`)
  const match = html.match(regex)
  return match ? match[1] : null
}

const extractMeta = (html: string, property: string): string | null => {
  const ogRegex = new RegExp(`<meta[^>]*property="${property}"[^>]*content="([^"]*)"`, 'i')
  const ogMatch = html.match(ogRegex)
  if (ogMatch) return ogMatch[1]

  const nameRegex = new RegExp(`<meta[^>]*name="${property}"[^>]*content="([^"]*)"`, 'i')
  const nameMatch = html.match(nameRegex)
  if (nameMatch) return nameMatch[1]

  return null
}

const extractPageTitle = (html: string): string | null => {
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  return match ? match[1].trim() : null
}

const telegramCheck = async (_url: string, html: string): Promise<TelegramCheckResult> => {
  if (html.includes('tgme_page_title')) {
    const title = extractText(html, 'tgme_page_title')
    const description = extractText(html, 'tgme_page_description')
    const extra = extractText(html, 'tgme_page_extra')
    const photo = extractImgSrc(html, 'tgme_page_photo_image')

    let type: TelegramCheckResult['metadata'] extends infer T ? T extends { type: infer U } ? U : never : never = null
    let memberCount: number | null = null
    let memberCountRaw: string | null = null
    if (extra) {
      if (extra.toLowerCase().includes('subscriber')) type = 'channel'
      else if (extra.toLowerCase().includes('member')) type = 'group'
      else if (extra.toLowerCase().includes('online')) type = 'group'
      else type = 'user'
      memberCountRaw = extra
      const memberCountText = extra.split(',', 1)[0]
      const digits = memberCountText.replace(/[^\d]/g, '')
      memberCount = digits ? parseInt(digits, 10) : null
    }

    return {
      status: 'valid',
      platform: 'telegram',
      metadata: {
        title: title || null,
        description: description || null,
        photo: photo || null,
        type,
        memberCount,
        memberCountRaw,
      },
    }
  }

  return { status: 'invalid', platform: 'telegram', metadata: null }
}

const megaCheck = async (url: string, html: string, httpStatus: number): Promise<MegaCheckResult> => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  let type: MegaCheckResult['metadata'] extends infer T ? T extends { type: infer U } ? U : never : never = null
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (path.startsWith('/folder')) type = 'folder'
    else if (path.startsWith('/file')) type = 'file'
    else if (path.startsWith('/chat')) type = 'chat'
    else type = 'unknown'
  } catch {}

  const genericTitles = ['file folder on mega', 'file on mega', 'folder on mega']
  const isExpired = title && genericTitles.includes(title.toLowerCase()) && !description

  if (isExpired) {
    return {
      status: 'expired',
      platform: 'mega',
      metadata: {
        title: title || null,
        description: null,
        image: image || null,
        siteName: siteName || null,
        type,
      },
    }
  }

  if (title || httpStatus === 200) {
    return {
      status: 'valid',
      platform: 'mega',
      metadata: {
        title: title || null,
        description: description || null,
        image: image || null,
        siteName: siteName || null,
        type,
      },
    }
  }

  return { status: 'invalid', platform: 'mega', metadata: null }
}

const genericCheck = async (_url: string, html: string, httpStatus: number): Promise<UnknownCheckResult> => {
  const title = extractMeta(html, 'og:title') || extractPageTitle(html)
  const description = extractMeta(html, 'og:description') || extractMeta(html, 'description')
  const image = extractMeta(html, 'og:image')
  const siteName = extractMeta(html, 'og:site_name')

  if (title || httpStatus === 200) {
    return {
      status: 'valid',
      platform: 'unknown',
      metadata: {
        title: title || null,
        description: description || null,
        image: image || null,
        siteName: siteName || null,
      },
    }
  }

  return { status: 'invalid', platform: 'unknown', metadata: null }
}

const readTextWithLimit = async (res: Response): Promise<string> => {
  const contentLength = Number(res.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_FETCH_BYTES) {
    throw new Error('Response body too large')
  }

  if (!res.body) return res.text()

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let received = 0
  let text = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    received += value.byteLength
    if (received > MAX_FETCH_BYTES) {
      await reader.cancel().catch(() => {})
      throw new Error('Response body too large')
    }
    text += decoder.decode(value, { stream: true })
  }

  text += decoder.decode()
  return text
}

const shouldRemoveStoredLink = (status: CheckStatus): boolean => {
  return status === 'invalid' || status === 'expired'
}

const removeStoredLinkIfInvalid = (url: string, result: CheckResult): void => {
  if (!shouldRemoveStoredLink(result.status)) return

  deleteLinks([url]).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[WARN] Failed to remove invalid stored link ${url}:`, message)
  })
  deleteFromCache(url).catch(() => {})
}

const fetchAndCheck = async (url: string, platform: Platform): Promise<CheckResult> => {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(10000),
    })
    const html = await readTextWithLimit(res)

    let result: CheckResult
    switch (platform) {
      case 'telegram':
        result = await telegramCheck(url, html)
        break
      case 'mega':
        result = await megaCheck(url, html, res.status)
        break
      default:
        result = await genericCheck(url, html, res.status)
        break
    }

    const isUnique = await isUniqueCheck24h(url)
    if (isUnique) {
      incrementStat('totalChecks').catch(() => {})
      incrementRedisStat('totalChecks').catch(() => {})
      const statKey = result.status === 'valid' ? 'valid' : result.status === 'invalid' || result.status === 'expired' ? 'invalid' : 'unknown'
      incrementStat(statKey).catch(() => {})
      incrementRedisStat(statKey).catch(() => {})
    }

    await setInCache(url, result)
    return result
  } catch {
    const isUnique = await isUniqueCheck24h(url)
    if (isUnique) {
      incrementStat('unknown').catch(() => {})
      incrementRedisStat('unknown').catch(() => {})
    }
    return { status: 'unknown', platform, metadata: null }
  }
}

export const httpCheck = async (url: string, options: HttpCheckOptions = {}): Promise<HttpCheckResult> => {
  const {
    skipCache = false,
    knownCacheMiss = false,
    contributorId = null,
    removeInvalidStored = false,
    saveValidResult = true,
    waitForSave = false,
  } = options

  const target = validateFetchTarget(url)
  if (!target.ok) {
    const isUnique = await isUniqueCheck24h(url)
    if (isUnique) {
      incrementStat('invalid').catch(() => {})
      incrementRedisStat('invalid').catch(() => {})
    }
    const result: CheckResult = { status: 'invalid', platform: target.platform, metadata: null }
    if (removeInvalidStored) removeStoredLinkIfInvalid(url, result)
    return { ...result, cached: false }
  }

  if (!skipCache && !knownCacheMiss) {
    const cached = await getFromCache(url)
    if (cached) {
      incrementStat('cacheHits').catch(() => {})
      incrementRedisStat('cacheHits').catch(() => {})
      const result = cached as CheckResult
      if (removeInvalidStored) {
        removeStoredLinkIfInvalid(url, result)
      }
      return { ...result, cached: true }
    }
  }
  if (!knownCacheMiss) {
    incrementStat('cacheMisses').catch(() => {})
    incrementRedisStat('cacheMisses').catch(() => {})
  }

  const result = await singleflight(`check:${url}`, () => fetchAndCheck(url, target.platform))

  if (saveValidResult && result.status === 'valid') {
    const saveResult = saveLink(url, result.platform, result.status, result.metadata, contributorId)
    if (waitForSave) await saveResult.catch(() => {})
    else saveResult.catch(() => {})
  } else if (removeInvalidStored) {
    removeStoredLinkIfInvalid(url, result)
  }

  return { ...result, cached: false }
}

export const getClientIp = (c: any): string => {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    c.req.header('cf-connecting-ip') ||
    'unknown'
  )
}

export const getClientIpHash = async (c: any): Promise<string> => {
  const ip = getClientIp(c)
  return hashIp(ip)
}

const hashIp = async (ip: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(ip + '_telecheck_salt_v1')
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const getIdentityValue = (value: unknown, maxLength = 128): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return null
  return trimmed
}

export const getContributorIdentityInput = async (c: any, body?: { [key: string]: unknown }) => {
  const deviceId =
    getIdentityValue(body?.device_id) ||
    getIdentityValue(body?.contributor_id) ||
    getIdentityValue(c.req.query('device_id')) ||
    getIdentityValue(c.req.query('contributor_id'))
  const recoveryKey = getIdentityValue(body?.recovery_key)

  return {
    ipHash: await getClientIpHash(c),
    deviceId,
    recoveryKey,
  }
}

export const getRateLimitHeaders = async (c: any, type: 'single' | 'batch' | 'validate') => {
  const ip = getClientIp(c)
  const rl = await checkRateLimit(ip, type)
  if (rl.limit) {
    c.header('X-RateLimit-Limit', rl.limit.toString())
    c.header('X-RateLimit-Remaining', rl.remaining.toString())
    c.header('X-RateLimit-Reset', rl.reset.toString())
  }
  return rl
}
