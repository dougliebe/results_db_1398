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

  function render(container, state) {
    container.innerHTML = ''
    if (!state.lineupPlayers.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to view lineup players.'))
      return
    }

    const controls = h('div', { class: 'controls' })
    const searchEntry = h('input', { type: 'text', placeholder: 'Search Entry Name…', 'aria-label': 'Search Entry Name' })
    const searchPlayer = h('input', { type: 'text', placeholder: 'Search Player…', 'aria-label': 'Search Player' })
    const positionSelect = h('select', { 'aria-label': 'Filter by Position' },
      h('option', { value: '' }, 'All Positions')
    )
    const positions = Array.from(new Set(state.lineupPlayers.map(r => r.position).filter(Boolean))).sort()
    positions.forEach(pos => positionSelect.appendChild(h('option', { value: pos }, pos)))
    controls.appendChild(searchEntry)
    controls.appendChild(searchPlayer)
    controls.appendChild(positionSelect)
    container.appendChild(controls)

    const tableWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    const columns = [
      { key: 'entryId', label: 'EntryId' },
      { key: 'entryName', label: 'EntryName' },
      { key: 'player', label: 'Player' },
      { key: 'team', label: 'Team' },
      { key: 'position', label: 'Position' },
      { key: 'fpts', label: 'FPTS' }
    ]
    const sortState = window.AppState.sort.lineupPlayers
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
          sortState.dir = 'asc'
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
      const termEntry = searchEntry.value.trim().toLowerCase()
      const termPlayer = searchPlayer.value.trim().toLowerCase()
      const pos = positionSelect.value
      let rows = state.lineupPlayers
      if (termEntry) rows = rows.filter(r => String(r.entryName || '').toLowerCase().includes(termEntry))
      if (termPlayer) rows = rows.filter(r => String(r.player || '').toLowerCase().includes(termPlayer))
      if (pos) rows = rows.filter(r => (r.position || '') === pos)
      rows = sortData(rows, sortState.key, sortState.dir)
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.entryId || ''))
        tr.appendChild(h('td', {}, r.entryName || ''))
        tr.appendChild(h('td', {}, r.player || ''))
        tr.appendChild(h('td', {}, r.team || ''))
        tr.appendChild(h('td', {}, r.position || ''))
        tr.appendChild(h('td', {}, r.fpts == null ? '' : String(r.fpts)))
        tbody.appendChild(tr)
      }
    }

    searchEntry.addEventListener('input', () => apply())
    searchPlayer.addEventListener('input', () => apply())
    positionSelect.addEventListener('change', () => apply())
    apply()
  }

  window.Views = window.Views || {}
  window.Views.LineupPlayers = { render }
})()


