;(function () {
  function normalizeName(name) {
    const s = String(name || '').toLowerCase().trim()
    // Remove common punctuation and collapse spaces to improve matching
    return s.replace(/[.'’\-]/g, ' ').replace(/\s+/g, ' ')
  }

  function parsePlayerMaster(file) {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          try {
            const rows = Array.isArray(results.data) ? results.data : []
            const map = new Map()
            for (const row of rows) {
              let player = '', team = '', position = ''
              for (const [k, v] of Object.entries(row)) {
                const nk = String(k).trim().toLowerCase()
                if (nk === 'player') player = String(v || '').trim()
                else if (nk === 'team') team = String(v || '').trim()
                else if (nk === 'position') position = String(v || '').trim()
              }
              const key = normalizeName(player)
              if (!key) continue
              map.set(key, { team, position })
            }
            resolve(map)
          } catch (err) {
            reject(err)
          }
        },
        error: (err) => reject(err)
      })
    })
  }

  function parsePlayerMasterFromUrl(sheetUrl) {
    const urls = buildCandidateCsvUrls(sheetUrl)
    if (!urls.length) return Promise.reject(new Error('Unrecognized Google Sheets URL'))
    // Try endpoints in order until one succeeds
    return tryFetchCsvSequential(urls)
      .then(csvText => parseCsvToMap(csvText))
      .catch(async (e) => {
        // Fallback: try relative CSVs if hosted alongside the app
        try {
          const csvText = await tryFetchCsvSequential([
            './assets/player_master.csv',
            './Player Season Totals - Natural Stat Trick.csv',
            './player_master.csv'
          ])
          return parseCsvToMap(csvText)
        } catch {
          throw e
        }
      })
  }

  // Prefer local CSV file as the canonical source in this app
  function parsePlayerMasterFromLocal() {
    // Default file path next to index.html
    const candidates = [
      './player_pos_teams.csv',
      './assets/player_pos_teams.csv'
    ]
    return tryFetchCsvSequential(candidates).then(csvText => parseCsvToMap(csvText))
  }

  function parseCsvToMap(csvText) {
    return new Promise((resolve, reject) => {
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          try {
            const rows = Array.isArray(results.data) ? results.data : []
            const map = new Map()
            for (const row of rows) {
              let player = '', team = '', position = ''
              for (const [k, v] of Object.entries(row)) {
                const nk = String(k).trim().toLowerCase()
                if (nk === 'player') player = String(v || '').trim()
                else if (nk === 'team') team = String(v || '').trim()
                else if (nk === 'position') position = String(v || '').trim()
              }
              const key = normalizeName(player)
              if (!key) continue
              map.set(key, { team, position })
            }
            resolve(map)
          } catch (err) {
            reject(err)
          }
        },
        error: (err) => reject(err)
      })
    })
  }

  function tryFetchCsvSequential(urls) {
    let idx = 0
    function next(err) {
      if (idx >= urls.length) return Promise.reject(err || new Error('All endpoints failed'))
      const url = urls[idx++]
      console.info('[PlayerMaster] trying URL:', url)
      return fetch(url, { credentials: 'omit', mode: 'cors' })
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.text()
        })
        .catch(next)
    }
    return next()
  }

  function buildCandidateCsvUrls(sheetUrl) {
    if (!sheetUrl) return ''
    try {
      const u = new URL(sheetUrl)
      const urls = []
      // Extract spreadsheet id and gid
      // Patterns: /spreadsheets/d/{ID}/edit#gid={GID}
      const m = u.pathname.match(/\/spreadsheets\/d\/([^/]+)/)
      const id = m && m[1] ? m[1] : ''
      let gid = '0'
      if (u.hash) {
        const mm = u.hash.match(/gid=(\d+)/)
        if (mm && mm[1]) gid = mm[1]
      } else if (u.searchParams.get('gid')) {
        gid = u.searchParams.get('gid') || '0'
      }
      if (!id) return []
      // 1) Preferred export endpoint
      urls.push(`https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`)
      // 2) gviz CSV endpoint (often works even when not explicitly published)
      urls.push(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&gid=${gid}`)
      // 3) Published CSV endpoint
      urls.push(`https://docs.google.com/spreadsheets/d/${id}/pub?gid=${gid}&single=true&output=csv`)
      return urls
    } catch {
      return []
    }
  }

  function enrichWithMaster(lineups, playerSummaries, lineupPlayers, masterMap) {
    const enrichedSummaries = playerSummaries.map(p => {
      const info = masterMap.get(normalizeName(p.player))
      return {
        ...p,
        team: info ? info.team : (p.team || ''),
        rosterPosition: info && info.position ? info.position : (p.rosterPosition || '')
      }
    })
    const enrichedLineupPlayers = (lineupPlayers || []).map(lp => {
      const info = masterMap.get(normalizeName(lp.player))
      return {
        ...lp,
        team: info ? info.team : (lp.team || ''),
        position: info && info.position ? info.position : (lp.position || '')
      }
    })
    return { playerSummaries: enrichedSummaries, lineupPlayers: enrichedLineupPlayers }
  }

  window.PlayerMaster = {
    parsePlayerMaster,
    parsePlayerMasterFromUrl,
    parsePlayerMasterFromLocal,
    enrichWithMaster
  }
})()


