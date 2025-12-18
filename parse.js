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
    const looksLikePlayer = hasPlayer && !looksLikeLineup
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
      else if (isPlayer) playerRows.push(r)
      // else ignore
    }
    return coerceTypes(lineupRows, playerRows)
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
            if (!lineups.length && !playerSummaries.length) {
              reject(new Error('No recognizable rows found. Check headers or CSV content.'))
              return
            }
            resolve({ lineups, playerSummaries })
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


