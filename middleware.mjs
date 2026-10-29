// Magpie gateway middleware for Responses item IDs that become invalid when
// a conversation is moved between upstream channels.

const DEFAULTS = Object.freeze({
  enabled: true,
  providers: ["*"],
  models: [],
  mode: "safe",
  dropItemReferences: false,
  stripPreviousResponseId: false,
  stripConversation: false,
})

function stringList(value, fallback, field) {
  if (value === undefined) return fallback
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new Error(`${field} must be an array of strings`)
  }
  return value.map((item) => item.trim())
}

function normalize(options) {
  const input = options && typeof options === "object" && !Array.isArray(options) ? options : {}
  const raw = input.middleware && typeof input.middleware === "object" && !Array.isArray(input.middleware)
    ? input.middleware
    : {}
  const mode = raw.mode ?? DEFAULTS.mode
  if (mode !== "safe" && mode !== "aggressive") throw new Error("middleware.mode must be safe or aggressive")
  return {
    enabled: raw.enabled === undefined ? DEFAULTS.enabled : Boolean(raw.enabled),
    providers: stringList(raw.providers, DEFAULTS.providers, "middleware.providers"),
    models: stringList(raw.models, DEFAULTS.models, "middleware.models"),
    mode,
    dropItemReferences: raw.dropItemReferences === undefined ? DEFAULTS.dropItemReferences : Boolean(raw.dropItemReferences),
    stripPreviousResponseId: raw.stripPreviousResponseId === undefined
      ? DEFAULTS.stripPreviousResponseId
      : Boolean(raw.stripPreviousResponseId),
    stripConversation: raw.stripConversation === undefined
      ? DEFAULTS.stripConversation
      : Boolean(raw.stripConversation),
  }
}

function patternMatches(value, patterns) {
  if (!patterns.length) return true
  const text = String(value ?? "")
  return patterns.some((pattern) => {
    if (pattern === "*") return true
    if (!pattern.includes("*")) return pattern === text
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
    return new RegExp("^" + escaped + "$").test(text)
  })
}

function targetMatches(provider, options, ctx) {
  if (!patternMatches(provider?.id, options.providers)) return false
  if (!options.models.length) return true
  return patternMatches(ctx?.model, options.models) || patternMatches(provider?.model, options.models)
}

function looksLikeFullHistory(input) {
  if (!Array.isArray(input) || input.length < 2) return false
  const hasDeveloper = input.some((item) => item && typeof item === "object" && (item.role === "developer" || item.role === "system"))
  const hasUser = input.some((item) => item && typeof item === "object" && item.role === "user")
  return hasDeveloper && hasUser
}

function repair(body, options) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined
  let value
  try {
    value = JSON.parse(JSON.stringify(body))
  } catch {
    return undefined
  }

  const hasPrevious = Object.hasOwn(value, "previous_response_id")
    && value.previous_response_id !== undefined
    && value.previous_response_id !== null
    && value.previous_response_id !== ""
  const hasConversation = Object.hasOwn(value, "conversation")
    && value.conversation !== undefined
    && value.conversation !== null
    && value.conversation !== ""
  const fullHistory = looksLikeFullHistory(value.input)
  const references = Array.isArray(value.input)
    ? value.input.filter((item) => item && typeof item === "object" && !Array.isArray(item) && item.type === "item_reference")
    : []

  if (options.mode === "safe" && references.length && !options.dropItemReferences) return undefined

  let changed = false
  const canStripPointer = options.mode === "aggressive" || fullHistory
  if (hasPrevious && options.stripPreviousResponseId && canStripPointer) {
    delete value.previous_response_id
    changed = true
  }
  if (hasConversation && options.stripConversation && canStripPointer) {
    delete value.conversation
    changed = true
  }
  if (Array.isArray(value.input)) {
    const kept = []
    for (const item of value.input) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        kept.push(item)
        continue
      }
      if (item.type === "item_reference") {
        if (options.dropItemReferences) {
          changed = true
          continue
        }
        kept.push(item)
        continue
      }
      if (Object.hasOwn(item, "id")) {
        delete item.id
        changed = true
      }
      kept.push(item)
    }
    value.input = kept
  }
  return changed ? value : undefined
}

export function onProvider(body, ctx) {
  const options = normalize(ctx?.options)
  if (!options.enabled) return undefined
  if (ctx?.protocol && ctx.protocol !== "responses") return undefined
  if (!targetMatches(ctx?.provider, options, ctx)) return undefined
  return repair(body, options)
}

export const _internal = { normalize, patternMatches, targetMatches, looksLikeFullHistory, repair }
