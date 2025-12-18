;(function () {
  const state = {
    lineups: [],
    playerSummaries: [],
    parsed: false,
    sort: {
      leaderboard: { key: 'points', dir: 'desc' },
      players: { key: 'percentDrafted', dir: 'desc' }
    }
  }

  function $(id) { return document.getElementById(id) }

  function setStatus(message) {
    $('uploadStatus').textContent = message || ''
  }

  function uniqueCount(array, key) {
    const set = new Set()
    for (const row of array) {
      const v = row[key]
      if (v !== null && v !== undefined && String(v).trim() !== '') set.add(String(v))
    }
    return set.size
  }

  function updateSummary() {
    $('statLineups').textContent = state.lineups.length
    $('statPlayers').textContent = state.playerSummaries.length
    $('statUniqueEntries').textContent = uniqueCount(state.lineups, 'entryId')
    $('statUniquePlayers').textContent = uniqueCount(state.playerSummaries, 'player')

    const preview = $('previewBlocks')
    preview.innerHTML = ''
    if (state.lineups.length) {
      preview.appendChild(makePreviewBlock(
        'Lineups (first 5)',
        ['Rank', 'EntryId', 'EntryName', 'TimeRemaining', 'Points'],
        state.lineups.slice(0, 5).map(r => [
          r.rank ?? '', r.entryId ?? '', r.entryName ?? '', r.timeRemaining ?? '', r.points ?? ''
        ])
      ))
    }
    if (state.playerSummaries.length) {
      preview.appendChild(makePreviewBlock(
        'Players (first 5)',
        ['Player', 'Roster Position', '%Drafted', 'FPTS'],
        state.playerSummaries.slice(0, 5).map(r => [
          r.player ?? '', r.rosterPosition ?? '', r.percentDrafted ?? '', r.fpts ?? ''
        ])
      ))
    }
  }

  function makePreviewBlock(title, headers, rows) {
    const wrap = document.createElement('div')
    wrap.className = 'preview'
    wrap.innerHTML = `<h3>${title}</h3>`
    const table = document.createElement('table')
    const thead = document.createElement('thead')
    const trh = document.createElement('tr')
    headers.forEach(h => {
      const th = document.createElement('th')
      th.textContent = h
      trh.appendChild(th)
    })
    thead.appendChild(trh)
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    rows.forEach(r => {
      const tr = document.createElement('tr')
      r.forEach(v => {
        const td = document.createElement('td')
        td.textContent = v
        tr.appendChild(td)
      })
      tbody.appendChild(tr)
    })
    table.appendChild(tbody)
    wrap.appendChild(table)
    return wrap
  }

  function renderCurrentTab() {
    const active = document.querySelector('.tab-panel.active')
    if (!active) return
    if (active.id === 'leaderboardView') {
      window.Views.Leaderboard.render(active, state)
    } else if (active.id === 'playersView') {
      window.Views.Players.render(active, state)
    } else if (active.id === 'entriesView') {
      window.Views.Entries.render(active, state)
    }
  }

  function activateTab(targetId) {
    document.querySelectorAll('.tab').forEach(btn => {
      const isActive = btn.dataset.target === targetId
      btn.classList.toggle('active', isActive)
      btn.setAttribute('aria-selected', String(isActive))
    })
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === targetId)
    })
    renderCurrentTab()
  }

  function wireTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => activateTab(btn.dataset.target))
    })
  }

  function wireUploader() {
    const fileInput = $('fileInput')
    const dropzone = $('dropzone')

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0]
      if (file) handleFile(file)
    })

    ;['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation()
        dropzone.classList.add('dragover')
      })
    })
    ;['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, (e) => {
        e.preventDefault(); e.stopPropagation()
        dropzone.classList.remove('dragover')
      })
    })
    dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) handleFile(file)
    })
  }

  async function handleFile(file) {
    setStatus(`Parsing “${file.name}”...`)
    try {
      const result = await window.ParseUtils.parseFile(file)
      state.lineups = result.lineups
      state.playerSummaries = result.playerSummaries
      state.parsed = true
      updateSummary()
      renderCurrentTab()
      setStatus(`Loaded ${state.lineups.length} lineup rows and ${state.playerSummaries.length} player rows.`)
    } catch (err) {
      console.error(err)
      setStatus(`Failed to parse file: ${err && err.message ? err.message : String(err)}`)
    }
  }

  function init() {
    wireTabs()
    wireUploader()
    updateSummary()
    renderCurrentTab()
  }

  document.addEventListener('DOMContentLoaded', init)
  window.AppState = state
})()


