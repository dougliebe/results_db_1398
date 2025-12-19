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

  function normalizeName(name) {
    return String(name || '').toLowerCase().trim().replace(/[.'’\-]/g, ' ').replace(/\s+/g, ' ')
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

  function buildDuplicates(state) {
    const lp = state.lineupPlayers || []
    const lineups = state.lineups || []
    if (!lp.length || !lineups.length) return []
    // Map entryId -> username
    const eidToUser = new Map()
    for (const l of lineups) {
      if (l.entryId) eidToUser.set(l.entryId, (l.username || l.entryName || '').trim())
    }
    // Map entryId -> set of normalized player names
    const eidToPlayers = new Map()
    for (const r of lp) {
      if (!r.entryId || !r.player) continue
      const set = eidToPlayers.get(r.entryId) || new Set()
      set.add(normalizeName(r.player))
      eidToPlayers.set(r.entryId, set)
    }
    // Build signature per entryId (sorted normalized names)
    const sigToEntries = new Map()
    const sigToLineupPretty = new Map()
    for (const [eid, set] of eidToPlayers.entries()) {
      const arr = Array.from(set.values()).sort()
      const sig = arr.join('||')
      let group = sigToEntries.get(sig)
      if (!group) { group = []; sigToEntries.set(sig, group) }
      group.push(eid)
      // Build pretty lineup string once per signature from current entry values
      if (!sigToLineupPretty.has(sig)) {
        // Reconstruct using original labels where possible
        const prettyPlayers = []
        for (const r of lp.filter(x => x.entryId === eid)) {
          if (arr.includes(normalizeName(r.player))) {
            prettyPlayers.push(`${r.position || ''} ${r.player}`.trim())
          }
        }
        // Deduplicate pretty players by normalized name and sort
        const seen = new Map()
        for (const p of prettyPlayers) {
          const nn = normalizeName(p.replace(/^(c|d|w|g|util)\s+/i, ''))
          if (!seen.has(nn)) seen.set(nn, p)
        }
        const sorted = Array.from(seen.values()).sort((a, b) => a.localeCompare(b))
        sigToLineupPretty.set(sig, sorted.join(', '))
      }
    }
    // Build rows
    const rows = []
    for (const [sig, eids] of sigToEntries.entries()) {
      if (!eids.length) continue
      const users = new Set()
      for (const eid of eids) {
        const u = eidToUser.get(eid)
        if (u) users.add(u)
      }
      rows.push({
        lineup: sigToLineupPretty.get(sig) || '',
        num_entries: eids.length,
        num_users: users.size
      })
    }
    return rows
  }

  function render(container, state) {
    container.innerHTML = ''
    if (!state.lineupPlayers.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to view duplicate lineups.'))
      return
    }
    const controls = h('div', { class: 'controls' })
    container.appendChild(controls)

    const tableWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    const columns = [
      { key: 'lineup', label: 'Lineup' },
      { key: 'num_entries', label: 'Num Entries' },
      { key: 'num_users', label: 'Num Users' }
    ]
    const sortState = window.AppState.sort.duplicates || (window.AppState.sort.duplicates = { key: 'num_entries', dir: 'desc' })
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
          sortState.dir = col.key.startsWith('num_') ? 'desc' : 'asc'
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
      let rows = buildDuplicates(state)
      rows = rows.filter(r => r.num_entries > 1) // only show actual duplicates
      rows = sortData(rows, sortState.key, sortState.dir)
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.lineup || ''))
        tr.appendChild(h('td', {}, String(r.num_entries)))
        tr.appendChild(h('td', {}, String(r.num_users)))
        tbody.appendChild(tr)
      }
    }

    apply()
  }

  window.Views = window.Views || {}
  window.Views.Duplicates = { render }
})()


