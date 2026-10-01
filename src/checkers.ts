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

const telegramCheck = async (url: string, html: string): Promise<TelegramCheckResult> => {
  // 1. Detect expired / revoked invite link
  const isInvite = url.includes('/+') || url.includes('/joinchat/')
  const hasExpiredNotice =
    html.includes('tgme_page_icon_expired') ||
    /link has expired|invite link is expired|no longer active|invite link was revoked/i.test(html)
  
  // Generic "You are invited to a group chat" fallback with NO title means the invite is invalid/dead
  const isGenericBlankInvite = isInvite && html.includes('You are invited to a') && !html.includes('tgme_page_title')

  if (hasExpiredNotice || isGenericBlankInvite) {
    return {
      status: 'expired',
      platform: 'telegram',
      metadata: null,
      reason: 'Invite link is expired or revoked',
    }
  }

  // 2. Detect blocked / banned / restricted channels
  const isBlocked =
    html.includes('tgme_page_blocked') ||
    /this channel is blocked|channel can\'t be displayed|blocked due to copyright|violation of the Telegram Terms of Service/i.test(html)

  if (isBlocked) {
    const title = extractText(html, 'tgme_page_title')
    return {
      status: 'invalid',
      platform: 'telegram',
      metadata: title ? {
        title,
        description: null,
        photo: null,
        type: 'channel',
        memberCount: null,
        memberCountRaw: null,
        isRestricted: true,
        restrictionReason: 'Channel blocked or restricted due to copyright/terms violation',
      } : null,
      reason: 'Channel is blocked or restricted by Telegram',
    }
  }

  // 3. Check for valid title
  if (html.includes('tgme_page_title')) {
    const rawTitle = extractText(html, 'tgme_page_title')
    // Clean up checkmark symbols that Telegram appends in title text if verified
    const title = rawTitle ? rawTitle.replace(/\s*✔\s*$/, '').trim() : null
    const description = extractText(html, 'tgme_page_description')
    const extra = extractText(html, 'tgme_page_extra')
    const photo = extractImgSrc(html, 'tgme_page_photo_image')
    const actionText = extractText(html, 'tgme_page_action') || ''

    // Badges & flags
    const isVerified =
      html.includes('tgme_page_title_verified') ||
      html.includes('verified-icon') ||
      (rawTitle?.includes('✔') ?? false)

    const isScam = html.includes('tgme_badge_scam') || /<span[^>]*class="[^"]*badge[^"]*"[^>]*>scam<\/span>/i.test(html)
    const isFake = html.includes('tgme_badge_fake') || /<span[^>]*class="[^"]*badge[^"]*"[^>]*>fake<\/span>/i.test(html)
    const isJoinRequest = /request to join|join request/i.test(actionText) || /request to join/i.test(html)

    // Entity type determination
    let type: TelegramCheckResult['metadata'] extends infer T ? T extends { type: infer U } ? U : never : never = null
    let memberCount: number | null = null
    let memberCountRaw: string | null = null

    const actionLower = actionText.toLowerCase()
    const extraLower = (extra || '').toLowerCase()

    if (actionLower.includes('start bot') || (extra && extra.startsWith('@') && extraLower.endsWith('bot'))) {
      type = 'bot'
    } else if (extraLower.includes('subscriber')) {
      type = 'channel'
    } else if (extraLower.includes('member') || extraLower.includes('online')) {
      type = 'group'
    } else if (isInvite) {
      type = 'group'
    } else {
      type = 'user'
    }

    if (extra) {
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
        isVerified,
        isScam,
        isFake,
        isJoinRequest,
      },
    }
  }

  return { status: 'invalid', platform: 'telegram', metadata: null, reason: 'Channel, group, or user not found' }
}

const parseMegaHandle = (url: string): { handle: string | null; isFolder: boolean } => {
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    const hash = u.hash

    // Format 1: https://mega.nz/folder/HANDLE#KEY
    const folderMatch = path.match(/\/folder\/([a-zA-Z0-9_-]+)/)
    if (folderMatch) return { handle: folderMatch[1], isFolder: true }

    // Format 2: https://mega.nz/file/HANDLE#KEY
    const fileMatch = path.match(/\/file\/([a-zA-Z0-9_-]+)/)
    if (fileMatch) return { handle: fileMatch[1], isFolder: false }

    // Format 3: Legacy https://mega.nz/#F!HANDLE!KEY
    if (hash.startsWith('#F!') || hash.startsWith('#!F!')) {
      const parts = hash.split('!')
      if (parts[1]) return { handle: parts[1], isFolder: true }
    }

    // Format 4: Legacy https://mega.nz/#!HANDLE!KEY
    if (hash.startsWith('#!')) {
      const parts = hash.split('!')
      if (parts[1]) return { handle: parts[1], isFolder: false }
    }

    return { handle: null, isFolder: false }
  } catch {
    return { handle: null, isFolder: false }
  }
}

const verifyMegaApiHandle = async (handle: string, isFolder: boolean): Promise<{ exists: boolean; status: 'valid' | 'invalid' | 'expired'; reason?: string } | null> => {
  try {
    const apiUrl = isFolder
      ? `https://g.api.mega.co.nz/cs?id=${Date.now()}&n=${handle}`
      : `https://g.api.mega.co.nz/cs?id=${Date.now()}`

    const cmd = isFolder ? [{ a: 'f', c: 1, r: 1 }] : [{ a: 'g', p: handle }]

    const res = await fetch(apiUrl, {
      method: 'POST',
      body: JSON.stringify(cmd),
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
    })

    if (!res.ok) return null
    const data = await res.json()

    // MEGA API Error Codes:
    // -2: ENOENT (Object not found / does not exist)
    // -9: EACCESS (Access denied / requires decryption key, but object exists)
    // -11: EEXPIRED (Link has expired)
    // -16: EBLOCKED (Link blocked / TOS violation)
    // -18: EKEY (Temporary key error, object exists)
    const errCode = Array.isArray(data) ? (typeof data[0] === 'number' ? data[0] : null) : (typeof data === 'number' ? data : null)

    if (errCode === -2) {
      return { exists: false, status: 'invalid', reason: 'File or folder does not exist on MEGA' }
    }
    if (errCode === -11) {
      return { exists: false, status: 'expired', reason: 'MEGA link has expired' }
    }
    if (errCode === -16) {
      return { exists: false, status: 'invalid', reason: 'MEGA link blocked due to copyright or terms violation' }
    }
    if (errCode === -9 || errCode === -18 || Array.isArray(data)) {
      return { exists: true, status: 'valid' }
    }

    return null
  } catch {
    return null
  }
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
    if (path.startsWith('/folder') || u.hash.includes('F!')) type = 'folder'
    else if (path.startsWith('/file') || u.hash.startsWith('#!')) type = 'file'
    else if (path.startsWith('/chat')) type = 'chat'
    else type = 'unknown'
  } catch {}

  // 1. Check for explicit HTML removal/takedown notices
  const isHtmlExpiredOrRemoved =
    html.includes('The file you are trying to download is no longer available') ||
    html.includes('This file has been removed due to a copyright infringement') ||
    html.includes('The link you are trying to access is not valid') ||
    /file has been removed|link is no longer valid|folder is not available/i.test(html)

  if (isHtmlExpiredOrRemoved) {
    return {
      status: 'expired',
      platform: 'mega',
      metadata: null,
      reason: 'File or folder is no longer available on MEGA',
    }
  }

  // 2. Query MEGA client API for the exact object handle
  const { handle, isFolder } = parseMegaHandle(url)
  if (handle) {
    const apiCheck = await verifyMegaApiHandle(handle, isFolder)
    if (apiCheck) {
      if (apiCheck.status === 'invalid' || apiCheck.status === 'expired') {
        return {
          status: apiCheck.status,
          platform: 'mega',
          metadata: null,
          reason: apiCheck.reason,
        }
      }
    }
  }

  // 3. Check for generic empty shell titles with no metadata
  const genericTitles = ['file folder on mega', 'file on mega', 'folder on mega']
  const isGenericBlank = title && genericTitles.includes(title.toLowerCase()) && !description

  if (isGenericBlank && !handle) {
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
      reason: 'No file or folder metadata found',
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

  return { status: 'invalid', platform: 'mega', metadata: null, reason: 'MEGA link is invalid or unreachable' }
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

const MAX_REDIRECTS = 3

const fetchAndCheck = async (url: string, platform: Platform): Promise<CheckResult> => {
  try {
    let currentUrl = url
    let redirectCount = 0
    let res: Response | null = null

    while (redirectCount <= MAX_REDIRECTS) {
      res = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(10000),
      })

      // Check if redirect response (301, 302, 303, 307, 308)
      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) break

        const nextUrl = new URL(location, currentUrl).toString()
        const targetCheck = validateFetchTarget(nextUrl)
        if (!targetCheck.ok) {
          return { status: 'invalid', platform, metadata: null }
        }

        currentUrl = nextUrl
        redirectCount++
        continue
      }

      break
    }

    if (!res) {
      return { status: 'unknown', platform, metadata: null }
    }

    const html = await readTextWithLimit(res)

    let result: CheckResult
    switch (platform) {
      case 'telegram':
        result = await telegramCheck(currentUrl, html)
        break
      case 'mega':
        result = await megaCheck(currentUrl, html, res.status)
        break
      default:
        result = await genericCheck(currentUrl, html, res.status)
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
