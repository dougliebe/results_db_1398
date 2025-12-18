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

  function render(container, state) {
    container.innerHTML = ''
    if (!state.lineups.length) {
      container.appendChild(h('div', { class: 'empty' }, 'Upload a CSV to search entries.'))
      return
    }

    const controls = h('div', { class: 'controls' })
    const search = h('input', { type: 'text', placeholder: 'Search by Entry ID or Entry Name…', 'aria-label': 'Search Entries' })
    controls.appendChild(search)
    container.appendChild(controls)

    const listWrap = h('div', { class: 'table-wrap' })
    const table = h('table', { class: 'data' })
    const thead = h('thead')
    const hdrRow = h('tr')
    ;['EntryId', 'EntryName', 'Points', 'TimeRemaining'].forEach(label => {
      hdrRow.appendChild(h('th', {}, label))
    })
    thead.appendChild(hdrRow)
    table.appendChild(thead)
    const tbody = h('tbody')
    table.appendChild(tbody)
    listWrap.appendChild(table)

    const detail = h('div', { class: 'note' }, 'Select a row to see lineup details.')

    container.appendChild(listWrap)
    container.appendChild(detail)

    function apply() {
      const term = search.value.trim().toLowerCase()
      let rows = state.lineups
      if (term) {
        rows = rows.filter(r =>
          String(r.entryId || '').toLowerCase().includes(term) ||
          String(r.entryName || '').toLowerCase().includes(term)
        )
      }
      tbody.innerHTML = ''
      for (const r of rows) {
        const tr = h('tr')
        tr.appendChild(h('td', {}, r.entryId || ''))
        tr.appendChild(h('td', {}, r.entryName || ''))
        tr.appendChild(h('td', {}, r.points == null ? '' : String(r.points)))
        tr.appendChild(h('td', {}, r.timeRemaining == null ? '' : String(r.timeRemaining)))
        tr.addEventListener('click', () => {
          detail.innerHTML = ''
          const card = h('div', { class: 'preview' })
          card.appendChild(h('h3', {}, `Entry: ${r.entryName || r.entryId || ''}`))
          const table = h('table')
          const tbody = h('tbody')
          ;[
            ['EntryId', r.entryId || ''],
            ['EntryName', r.entryName || ''],
            ['Rank', r.rank == null ? '' : String(r.rank)],
            ['Points', r.points == null ? '' : String(r.points)],
            ['TimeRemaining', r.timeRemaining == null ? '' : String(r.timeRemaining)],
            ['Lineup', r.lineupRaw || '']
          ].forEach(([k, v]) => {
            const tr = h('tr')
            tr.appendChild(h('td', {}, k))
            tr.appendChild(h('td', {}, v))
            tbody.appendChild(tr)
          })
          table.appendChild(tbody)
          card.appendChild(table)
          detail.appendChild(card)
        })
        tbody.appendChild(tr)
      }
    }

    search.addEventListener('input', () => apply())
    apply()
  }

  window.Views = window.Views || {}
  window.Views.Entries = { render }
})()


