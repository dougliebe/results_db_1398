;(function () {
  const CANON = {
    rank: 'rank',
    entryid: 'entryId',
    entryname: 'entryName',
    timeremaining: 'timeRemaining',
    points: 'points',
    lineup: 'lineupRaw',
    player: 'player',
    rosterposition: 'rosterPosition',
    '%drafted': 'percentDrafted',
    drafted: 'percentDrafted',
    fpts: 'fpts'
  }

  function toKey(header) {
    if (!header && header !== 0) return ''
    const raw = String(header).trim()
    if (!raw) return ''
    const key = raw.toLowerCase().replace(/\s+/g, '').replace(/\./g, '')
    return CANON[key] || ''
  }

  function coerceNumber(val) {
    if (val === null || val === undefined) return null
    const s = String(val).trim()
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  function coercePercent(val) {
    if (val === null || val === undefined) return null
    const s = String(val).trim().replace(/%/g, '')
    if (!s) return null
    const n = Number(s)
    return Number.isFinite(n) ? n : null
  }

  function normalizeRow(original) {
    const normalized = {}
    for (const [k, v] of Object.entries(original)) {
      const key = toKey(k)
      if (!key) continue
      normalized[key] = v
    }
    return normalized
  }

  function isNonEmpty(val) {
    return val !== null && val !== undefined && String(val).trim() !== ''
  }

  function classifyRow(row) {
    const hasEntryId = isNonEmpty(row.entryId)
    const hasLineup = isNonEmpty(row.lineupRaw)
    const hasRank = isNonEmpty(row.rank)
    const hasPlayer = isNonEmpty(row.player)
    const looksLikeLineup = hasEntryId || hasLineup || hasRank
    // Important: player summaries can coexist on the same CSV row as lineup data.
    // We should collect player rows whenever a player cell exists, regardless of lineup presence.
    const looksLikePlayer = hasPlayer
    return { isLineup: looksLikeLineup, isPlayer: looksLikePlayer }
  }

  function coerceTypes(lineupRows, playerRows) {
    const normalizedLineups = lineupRows.map(r => {
      return {
        rank: coerceNumber(r.rank),
        entryId: isNonEmpty(r.entryId) ? String(r.entryId).trim() : '',
        entryName: isNonEmpty(r.entryName) ? String(r.entryName).trim() : '',
        timeRemaining: coerceNumber(r.timeRemaining),
        points: coerceNumber(r.points),
        lineupRaw: isNonEmpty(r.lineupRaw) ? String(r.lineupRaw).trim() : ''
      }
    })
    const normalizedPlayers = playerRows.map(r => {
      return {
        player: isNonEmpty(r.player) ? String(r.player).trim() : '',
        rosterPosition: isNonEmpty(r.rosterPosition) ? String(r.rosterPosition).trim() : '',
        percentDrafted: coercePercent(r.percentDrafted),
        fpts: coerceNumber(r.fpts)
      }
    })
    return { lineups: normalizedLineups, playerSummaries: normalizedPlayers }
  }

  function splitTables(rows) {
    const lineupRows = []
    const playerRows = []
    for (const raw of rows) {
      const r = normalizeRow(raw)
      const { isLineup, isPlayer } = classifyRow(r)
      if (isLineup) lineupRows.push(r)
      if (isPlayer) playerRows.push(r)
      // else ignore
    }
    return coerceTypes(lineupRows, playerRows)
  }

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase()
  }

  function buildPlayerIndex(playerSummaries) {
    const byName = new Map()
    for (const p of playerSummaries) {
      const key = normalizeName(p.player)
      if (!key) continue
      // prefer first occurrence
      if (!byName.has(key)) byName.set(key, p)
    }
    return byName
  }

  // Explode lineupRaw into individual player names by inserting delimiters before position tokens.
  // We primarily split on C|D|W|G (per user guidance) and also handle UTIL to cover common data.
  function extractPlayersFromLineup(lineupRaw) {
    if (!lineupRaw) return []
    let s = String(lineupRaw)
    // Ensure leading delimiter if starts with a position token
    s = s.replace(/^\s*(C|D|W|G|UTIL)\s+/i, '|$1 ')
    // Insert delimiter before known position tokens
    s = s.replace(/\s(C|D|W|G|UTIL)\s/gi, (m, g1) => `|${g1} `)
    const chunks = s.split('|').map(c => c.trim()).filter(Boolean)
    const players = []
    for (const chunk of chunks) {
      // Remove the leading position token if present, then trim
      const cleaned = chunk.replace(/^(?:C|D|W|G|UTIL)\s+/i, '').trim()
      if (!cleaned) continue
      // cleaned should be a player full name (may contain spaces)
      players.push(cleaned)
    }
    return players
  }

  function extractTokenNamePairs(lineupRaw) {
    if (!lineupRaw) return []
    let s = String(lineupRaw)
    s = s.replace(/^\s*(C|D|W|G|UTIL)\s+/i, '|$1 ')
    s = s.replace(/\s(C|D|W|G|UTIL)\s/gi, (m, g1) => `|${g1} `)
    const chunks = s.split('|').map(c => c.trim()).filter(Boolean)
    const pairs = []
    for (const chunk of chunks) {
      const m = /^(C|D|W|G|UTIL)\s+(.+)$/.exec(chunk)
      if (m) {
        const token = m[1].toUpperCase()
        const name = m[2].trim()
        if (name) pairs.push({ token, name })
      }
    }
    return pairs
  }

  function collectInferredPositions(lineups) {
    const countsByPlayer = new Map()
    for (const l of lineups) {
      const pairs = extractTokenNamePairs(l.lineupRaw)
      for (const { token, name } of pairs) {
        const norm = normalizeName(name)
        if (!norm) continue
        if (!countsByPlayer.has(norm)) countsByPlayer.set(norm, { C: 0, D: 0, W: 0, G: 0 })
        if (token === 'UTIL') continue
        countsByPlayer.get(norm)[token] += 1
      }
    }
    const inferred = new Map()
    for (const [playerNorm, counts] of countsByPlayer.entries()) {
      const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
      const [best, bestCount] = entries[0]
      if (bestCount > 0) inferred.set(playerNorm, best)
    }
    return inferred
  }

  function explodeLineups(lineups, playerSummaries) {
    const index = buildPlayerIndex(playerSummaries)
    const rows = []
    for (const l of lineups) {
      const pairs = extractTokenNamePairs(l.lineupRaw)
      for (const { name: nm } of pairs) {
        const p = index.get(normalizeName(nm))
        rows.push({
          entryId: l.entryId || '',
          entryName: l.entryName || '',
          player: nm,
          position: p ? (p.rosterPosition || '') : '',
          fpts: p && p.fpts != null ? p.fpts : null
        })
      }
    }
    return rows
  }

  function parseFile(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          try {
            const rows = Array.isArray(results.data) ? results.data : []
            const { lineups, playerSummaries } = splitTables(rows)
            const inferred = collectInferredPositions(lineups)
            const playerSummariesEnriched = playerSummaries.map(p => {
              const inferredPos = inferred.get(normalizeName(p.player))
              const finalPos = inferredPos || p.rosterPosition || ''
              return { ...p, rosterPosition: finalPos }
            })
            const lineupPlayers = explodeLineups(lineups, playerSummariesEnriched)
            if (!lineups.length && !playerSummaries.length) {
              reject(new Error('No recognizable rows found. Check headers or CSV content.'))
              return
            }
            resolve({ lineups, playerSummaries: playerSummariesEnriched, lineupPlayers })
          } catch (err) {
            reject(err)
          }
        },
        error: (err) => reject(err)
      })
    })
  }

  window.ParseUtils = {
    parseFile
  }
})()


