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

  function buildExposure(state) {
    const lineups = state.lineups || []
    const lp = state.lineupPlayers || []
    const playerSummaries = state.playerSummaries || []
    if (!lineups.length || !lp.length) return []

    const uniqueEntries = Array.from(new Set(lineups.map(l => l.entryId).filter(Boolean)))
    const totalEntries = uniqueEntries.length || 1

    const sortedLineups = lineups.slice().sort((a, b) => (b.points || 0) - (a.points || 0))
    const top20N = Math.max(1, Math.round(sortedLineups.length * 0.20))
    const top10N = Math.max(1, Math.round(sortedLineups.length * 0.10))
    const top01N = Math.max(1, Math.round(sortedLineups.length * 0.01))
    const top20Set = new Set(sortedLineups.slice(0, top20N).map(l => l.entryId))
    const top10Set = new Set(sortedLineups.slice(0, top10N).map(l => l.entryId))
    const top01Set = new Set(sortedLineups.slice(0, top01N).map(l => l.entryId))

    const denom20 = top20Set.size || 1
    const denom10 = top10Set.size || 1
    const denom01 = top01Set.size || 1

    const infoByPlayer = new Map()
    for (const p of playerSummaries) {
      infoByPlayer.set(normalizeName(p.player), {
        team: p.team || '',
        position: p.rosterPosition || '',
        fpts: p.fpts == null ? null : p.fpts
      })
    }

    const agg = new Map()
    for (const r of lp) {
      const key = normalizeName(r.player)
      if (!key) continue
      if (!agg.has(key)) {
        const info = infoByPlayer.get(key) || {}
        agg.set(key, {
          player: r.player || '',
          team: r.team || info.team || '',
          position: r.position || info.position || '',
          salary: '', // not available in inputs
          points: info.fpts != null ? info.fpts : (r.fpts != null ? r.fpts : null),
          entriesAll: new Set(),
          entries20: new Set(),
          entries10: new Set(),
          entries01: new Set()
        })
      }
      const obj = agg.get(key)
      const eid = r.entryId
      if (eid) {
        obj.entriesAll.add(eid)
        if (top20Set.has(eid)) obj.entries20.add(eid)
        if (top10Set.has(eid)) obj.entries10.add(eid)
        if (top01Set.has(eid)) obj.entries01.add(eid)
      }
    }

    const rows = []
    for (const v of agg.values()) {
      const allOwn = (v.entriesAll.size / totalEntries) * 100
      const top20Own = (v.entries20.size / denom20) * 100
      const top10Own = (v.entries10.size / denom10) * 100
      const top01Own = (v.entries01.size / denom01) * 100
      rows.push({
        team: v.team,
        position: v.position,
        player: v.player,
        salary: v.salary,
        points: v.points,
        allOwn,
        top20Own,
        top10Own,
        top01Own
      })
    }
    return rows
  }

  function render(container, state) {
    container.innerHTML = ''
    if (!state.lineupPlayers.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to view field exposure.'))
      return
    }

    const controls = h('div', { class: 'controls' })
    const search = h('input', { type: 'text', placeholder: 'Search Player…', 'aria-label': 'Search Player' })
    const positionSelect = h('select', { 'aria-label': 'Filter by Position' },
      h('option', { value: '' }, 'All Positions')
    )
    const positions = Array.from(new Set(state.lineupPlayers.map(r => r.position).filter(Boolean))).sort()
    positions.forEach(pos => positionSelect.appendChild(h('option', { value: pos }, pos)))
    controls.appendChild(search)
    controls.appendChild(positionSelect)
    container.appendChild(controls)

    const tableWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    const columns = [
      { key: 'team', label: 'Team' },
      { key: 'position', label: 'Pos' },
      { key: 'player', label: 'Player' },
      { key: 'salary', label: 'Salary' },
      { key: 'points', label: 'Points' },
      { key: 'allOwn', label: 'All Own %' },
      { key: 'top20Own', label: 'Top 20% Own' },
      { key: 'top10Own', label: 'Top 10% Own' },
      { key: 'top01Own', label: 'Top 1% Own' }
    ]
    const sortState = window.AppState.sort.fieldExposure
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
          // default sort dir: numeric cols desc, others asc
          sortState.dir = ['allOwn','top20Own','top10Own','top01Own','points','salary'].includes(col.key) ? 'desc' : 'asc'
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
      const term = search.value.trim().toLowerCase()
      const pos = positionSelect.value
      let rows = buildExposure(state)
      if (term) rows = rows.filter(r => String(r.player || '').toLowerCase().includes(term))
      if (pos) rows = rows.filter(r => (r.position || '') === pos)
      rows = sortData(rows, sortState.key, sortState.dir)
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.team || ''))
        tr.appendChild(h('td', {}, r.position || ''))
        tr.appendChild(h('td', {}, r.player || ''))
        tr.appendChild(h('td', {}, r.salary === null || r.salary === undefined ? '' : String(r.salary)))
        tr.appendChild(h('td', {}, r.points == null ? '' : String(r.points)))
        tr.appendChild(h('td', {}, formatPct(r.allOwn)))
        tr.appendChild(h('td', {}, formatPct(r.top20Own)))
        tr.appendChild(h('td', {}, formatPct(r.top10Own)))
        tr.appendChild(h('td', {}, formatPct(r.top01Own)))
        tbody.appendChild(tr)
      }
    }

    search.addEventListener('input', () => apply())
    positionSelect.addEventListener('change', () => apply())
    apply()
  }

  window.Views = window.Views || {}
  window.Views.FieldExposure = { render }
})()


