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
    if (!state.lineups.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to view the leaderboard.'))
      return
    }

    const controls = h('div', { class: 'controls' })
    const search = h('input', { type: 'text', placeholder: 'Search Entry Name…', 'aria-label': 'Search Entry Name' })
    controls.appendChild(search)
    container.appendChild(controls)

    const tableWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    const columns = [
      { key: 'rank', label: 'Rank' },
      { key: 'entryId', label: 'EntryId' },
      { key: 'entryName', label: 'EntryName' },
      { key: 'timeRemaining', label: 'TimeRemaining' },
      { key: 'points', label: 'Points' },
      { key: 'lineupRaw', label: 'Lineup' }
    ]
    const sortState = window.AppState.sort.leaderboard
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
          sortState.dir = 'desc'
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
      let rows = state.lineups
      if (term) {
        rows = rows.filter(r => String(r.entryName || '').toLowerCase().includes(term))
      }
      rows = sortData(rows, sortState.key, sortState.dir)
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.rank == null ? '' : String(r.rank)))
        tr.appendChild(h('td', {}, r.entryId || ''))
        tr.appendChild(h('td', {}, r.entryName || ''))
        tr.appendChild(h('td', {}, r.timeRemaining == null ? '' : String(r.timeRemaining)))
        tr.appendChild(h('td', {}, r.points == null ? '' : String(r.points)))
        tr.appendChild(h('td', {}, r.lineupRaw || ''))
        tbody.appendChild(tr)
      }
    }

    search.addEventListener('input', () => apply())
    apply()
  }

  window.Views = window.Views || {}
  window.Views.Leaderboard = { render }
})()


