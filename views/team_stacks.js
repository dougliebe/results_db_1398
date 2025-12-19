;(function () {
  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'class') el.className = v
      else if (k === 'html') el.innerHTML = v
      else el.setAttribute(k, v)
    }
    for (const ch of children) {
      if (ch === null || ch === undefined) continue
      el.appendChild(typeof ch === 'string' ? document.createTextNode(ch) : ch)
    }
    return el
  }

  function sortData(data, key, dir) {
    const mult = dir === 'desc' ? -1 : 1
    const copy = data.slice()
    copy.sort((a, b) => {
      const va = a[key]; const vb = b[key]
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
      return String(va).localeCompare(String(vb)) * mult
    })
    return copy
  }

  function normalizeName(name) {
    return String(name || '').toLowerCase().trim().replace(/[.'’\-]/g, ' ').replace(/\s+/g, ' ')
  }

  function formatPct(n) {
    if (n == null || !isFinite(n)) return ''
    return (Math.round(n * 10) / 10).toFixed(1) + '%'
  }

  function combinations(arr, maxK) {
    const out = []
    const n = arr.length
    function rec(start, k, chosen) {
      if (k >= 2) out.push(chosen.slice())
      if (k === maxK) return
      for (let i = start; i < n; i++) {
        chosen.push(arr[i])
        rec(i + 1, k + 1, chosen)
        chosen.pop()
      }
    }
    rec(0, 0, [])
    return out
  }

  function buildStacks(state, maxSize) {
    const lp = state.lineupPlayers || []
    const lineups = state.lineups || []
    if (!lp.length || !lineups.length) return []
    const totalEntries = new Set(lineups.map(l => l.entryId).filter(Boolean)).size || 1

    // Group by entryId -> team -> [{player, position}]
    const byEntryTeam = new Map()
    for (const r of lp) {
      if (!r.entryId || !r.team) continue
      let teams = byEntryTeam.get(r.entryId)
      if (!teams) { teams = new Map(); byEntryTeam.set(r.entryId, teams) }
      const teamKey = r.team
      let arr = teams.get(teamKey)
      if (!arr) { arr = []; teams.set(teamKey, arr) }
      const label = `${r.position || ''} ${r.player || ''}`.trim()
      arr.push({ label, playerNorm: normalizeName(r.player), position: r.position || '', player: r.player || '' })
    }

    // Aggregate stacks: key = team|joinedKey
    const stacks = new Map()
    for (const [entryId, teams] of byEntryTeam.entries()) {
      for (const [team, players] of teams.entries()) {
        // Deduplicate players within entry/team by normalized name
        const uniqMap = new Map()
        for (const p of players) {
          if (!uniqMap.has(p.playerNorm)) uniqMap.set(p.playerNorm, p)
        }
        const uniq = Array.from(uniqMap.values())
        // Sort by player name for deterministic keys
        uniq.sort((a, b) => a.player.localeCompare(b.player))
        // Generate combinations up to maxSize
        const combs = combinations(uniq, maxSize)
        for (const combo of combs) {
          const keyParts = combo.map(p => `${p.position || ''} ${p.player}`.trim())
          const keyJoined = keyParts.join(' || ')
          const key = `${team}||${keyJoined}`
          let agg = stacks.get(key)
          if (!agg) {
            agg = { team, stackLabels: keyParts, playerCnt: combo.length, entries: new Set() }
            stacks.set(key, agg)
          }
          agg.entries.add(entryId)
        }
      }
    }

    const rows = []
    for (const agg of stacks.values()) {
      rows.push({
        team: agg.team,
        stack: agg.stackLabels.join(', '),
        player_cnt: agg.playerCnt,
        ownPct: (agg.entries.size / totalEntries) * 100
      })
    }
    return rows
  }

  function render(container, state) {
    container.innerHTML = ''
    if (!state.lineupPlayers.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to view team stacks.'))
      return
    }

    const controls = h('div', { class: 'controls' })
    const search = h('input', { type: 'text', placeholder: 'Search stack (comma-separated)…', 'aria-label': 'Search Stack' })
    const teamSelect = h('select', { 'aria-label': 'Filter by Team' },
      h('option', { value: '' }, 'All Teams')
    )
    const teams = Array.from(new Set(state.lineupPlayers.map(r => r.team).filter(Boolean))).sort()
    teams.forEach(t => teamSelect.appendChild(h('option', { value: t }, t)))
    const maxSizeSelect = h('select', { 'aria-label': 'Max Stack Size' },
      h('option', { value: '2' }, 'Up to 2'),
      h('option', { value: '3' }, 'Up to 3'),
      h('option', { value: '4', selected: 'selected' }, 'Up to 4')
    )
    controls.appendChild(search)
    controls.appendChild(teamSelect)
    controls.appendChild(maxSizeSelect)
    container.appendChild(controls)

    const tableWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    const columns = [
      { key: 'team', label: 'Team' },
      { key: 'stack', label: 'Stack' },
      { key: 'player_cnt', label: 'Players' },
      { key: 'ownPct', label: 'Own %' }
    ]
    const sortState = window.AppState.sort.teamStacks
    columns.forEach(col => {
      const th = h('th')
      const wrap = h('span', { class: 'th-sort' }, col.label,
        h('span', { class: 'arrow asc' }, '▲'),
        h('span', { class: 'arrow desc' }, '▼')
      )
      if (sortState.key === col.key) wrap.classList.add(sortState.dir)
      th.appendChild(wrap)
      th.addEventListener('click', () => {
        if (sortState.key === col.key) {
          sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc'
        } else {
          sortState.key = col.key
          sortState.dir = col.key === 'ownPct' ? 'desc' : 'asc'
        }
        render(container, state)
      })
      hdrRow.appendChild(th)
    })
    thead.appendChild(hdrRow)
    table.appendChild(thead)
    const tbody = h('tbody')
    table.appendChild(tbody)
    tableWrap.appendChild(table)
    container.appendChild(tableWrap)

    function apply() {
      const team = teamSelect.value
      const maxSize = parseInt(maxSizeSelect.value, 10) || 4
      const q = search.value.trim()
      const terms = q ? q.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []
      let rows = buildStacks(state, maxSize)
      if (team) rows = rows.filter(r => r.team === team)
      if (terms.length) {
        rows = rows.filter(r => {
          const stackStr = String(r.stack || '').toLowerCase()
          // AND match: all terms must appear in the stack string
          return terms.every(t => stackStr.includes(t))
        })
      }
      rows = sortData(rows, sortState.key, sortState.dir)
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.team || ''))
        tr.appendChild(h('td', {}, r.stack || ''))
        tr.appendChild(h('td', {}, String(r.player_cnt)))
        tr.appendChild(h('td', {}, formatPct(r.ownPct)))
        tbody.appendChild(tr)
      }
    }

    search.addEventListener('input', () => apply())
    teamSelect.addEventListener('change', () => apply())
    maxSizeSelect.addEventListener('change', () => apply())
    apply()
  }

  window.Views = window.Views || {}
  window.Views.TeamStacks = { render }
})()


