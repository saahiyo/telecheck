export type Platform = 'telegram' | 'mega' | 'unknown'
export type CheckStatus = 'valid' | 'invalid' | 'expired' | 'unknown'

export type TelegramEntityType = 'channel' | 'group' | 'user'
export type MegaEntityType = 'folder' | 'file' | 'chat' | 'unknown'

export type TelegramMetadata = {
  title: string | null
  description: string | null
  photo: string | null
  type: TelegramEntityType | null
  memberCount: number | null
  memberCountRaw: string | null
}

export type MegaMetadata = {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
  type: MegaEntityType | null
}

export type GenericMetadata = {
  title: string | null
  description: string | null
  image: string | null
  siteName: string | null
}

export type LinkMetadata = TelegramMetadata | MegaMetadata | GenericMetadata | null

export type TelegramCheckResult = {
  status: 'valid' | 'invalid'
  platform: 'telegram'
  metadata: TelegramMetadata | null
}

export type MegaCheckResult = {
  status: 'valid' | 'invalid' | 'expired'
  platform: 'mega'
  metadata: MegaMetadata | null
}

export type UnknownCheckResult = {
  status: 'valid' | 'invalid'
  platform: 'unknown'
  metadata: GenericMetadata | null
}

export type CheckResult =
  | TelegramCheckResult
  | MegaCheckResult
  | UnknownCheckResult
  | {
      status: 'unknown'
      platform: Platform
      metadata: null
    }

export type HttpCheckResult = CheckResult & {
  cached: boolean
}

export type ContributorIdentityPayload = {
  contributor_id?: unknown
  device_id?: unknown
  recovery_key?: unknown
  contributor_username?: unknown
}

export type BatchRequestBody = ContributorIdentityPayload & {
  links?: unknown
}

export type BatchResultItem = HttpCheckResult & {
  url: string
}

export type RevalidationAction = 'kept' | 'deleted'

export type RevalidationResultItem = {
  url: string
  action: RevalidationAction
  status: CheckStatus
}

export type LinkRow = {
  url: string
}

export type HttpCheckOptions = {
  skipCache?: boolean
  knownCacheMiss?: boolean
  contributorId?: number | null
  removeInvalidStored?: boolean
  saveValidResult?: boolean
  waitForSave?: boolean
}

export type FetchTargetValidation =
  | { ok: true; platform: Platform }
  | { ok: false; platform: Platform; reason: string }
