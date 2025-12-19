;(function () {
  const state = {
    lineups: [],
    playerSummaries: [],
    lineupPlayers: [],
    masterMap: null,
    parsed: false,
    sort: {
      leaderboard: { key: 'points', dir: 'desc' },
      players: { key: 'percentDrafted', dir: 'desc' },
      lineupPlayers: { key: 'entryId', dir: 'asc' },
      fieldExposure: { key: 'allOwn', dir: 'desc' },
      teamStacks: { key: 'ownPct', dir: 'desc' }
    }
  }

  function $(id) { return document.getElementById(id) }

  function setStatus(message) {
    $('uploadStatus').textContent = message || ''
  }

  function setMasterStatus(message) {
    const el = $('masterStatus')
    if (el) el.textContent = message || ''
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
    } else if (active.id === 'lineupPlayersView') {
      window.Views.LineupPlayers.render(active, state)
    } else if (active.id === 'fieldExposureView') {
      window.Views.FieldExposure.render(active, state)
    } else if (active.id === 'teamStacksView') {
      window.Views.TeamStacks.render(active, state)
    } else if (active.id === 'duplicatesView') {
      window.Views.Duplicates.render(active, state)
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

  function wireMasterUploader() {
    const fileInput = $('playerMasterInput')
    const dropzone = $('dropzoneMaster')
    const urlInput = $('playerMasterUrl')
    const loadBtn = $('loadPlayerMasterBtn')
    if (!fileInput || !dropzone) return

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0]
      if (file) await handleMasterFile(file)
    })
    if (loadBtn && urlInput) {
      loadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim()
        if (!url) {
          setMasterStatus('Please paste a Google Sheets URL.')
          return
        }
        await handleMasterUrl(url)
      })
    }
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
    dropzone.addEventListener('drop', async (e) => {
      const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]
      if (file) await handleMasterFile(file)
    })
  }

  async function handleFile(file) {
    setStatus(`Parsing “${file.name}”...`)
    try {
      const result = await window.ParseUtils.parseFile(file)
      state.lineups = result.lineups
      state.playerSummaries = result.playerSummaries
      state.lineupPlayers = result.lineupPlayers || []
      // If a master map is already loaded, enrich immediately
      if (state.masterMap) {
        const enriched = window.PlayerMaster.enrichWithMaster(
          state.lineups, state.playerSummaries, state.lineupPlayers, state.masterMap
        )
        state.playerSummaries = enriched.playerSummaries
        state.lineupPlayers = enriched.lineupPlayers
      }
      state.parsed = true
      updateSummary()
      renderCurrentTab()
      setStatus(`Loaded ${state.lineups.length} lineup rows, ${state.playerSummaries.length} player rows, and ${state.lineupPlayers.length} lineup-player rows.`)
    } catch (err) {
      console.error(err)
      setStatus(`Failed to parse file: ${err && err.message ? err.message : String(err)}`)
    }
  }

  async function handleMasterFile(file) {
    setMasterStatus(`Parsing player master “${file.name}”...`)
    try {
      const master = await window.PlayerMaster.parsePlayerMaster(file)
      state.masterMap = master
      // Enrich current data if available
      const enriched = window.PlayerMaster.enrichWithMaster(
        state.lineups || [],
        state.playerSummaries || [],
        state.lineupPlayers || [],
        master
      )
      state.playerSummaries = enriched.playerSummaries
      state.lineupPlayers = enriched.lineupPlayers
      updateSummary()
      renderCurrentTab()
      setMasterStatus(`Player master loaded (${master.size} players). Views updated.`)
    } catch (err) {
      console.error(err)
      setMasterStatus(`Failed to parse player master: ${err && err.message ? err.message : String(err)}`)
    }
  }

  async function handleMasterUrl(url) {
    setMasterStatus(`Loading player master from Google Sheets...`)
    try {
      const master = await window.PlayerMaster.parsePlayerMasterFromUrl(url)
      state.masterMap = master
      const enriched = window.PlayerMaster.enrichWithMaster(
        state.lineups || [],
        state.playerSummaries || [],
        state.lineupPlayers || [],
        master
      )
      state.playerSummaries = enriched.playerSummaries
      state.lineupPlayers = enriched.lineupPlayers
      updateSummary()
      renderCurrentTab()
      setMasterStatus(`Player master loaded from Sheets (${master.size} players).`)
    } catch (err) {
      console.error(err)
      setMasterStatus(`Failed to load from Sheets: ${err && err.message ? err.message : String(err)}`)
    }
  }

  // Auto-load local player master (no user action required)
  async function preloadMasterFromLocal() {
    try {
      const master = await window.PlayerMaster.parsePlayerMasterFromLocal()
      state.masterMap = master
      // If contest CSV already parsed, enrich now
      if (state.parsed) {
        const enriched = window.PlayerMaster.enrichWithMaster(
          state.lineups || [],
          state.playerSummaries || [],
          state.lineupPlayers || [],
          master
        )
        state.playerSummaries = enriched.playerSummaries
        state.lineupPlayers = enriched.lineupPlayers
        updateSummary()
        renderCurrentTab()
      }
      setMasterStatus(`Player master preloaded (${master.size} players).`)
    } catch (err) {
      // Silent or brief note; site can still function without master
      setMasterStatus(`Could not preload local player master.`)
    }
  }

  function init() {
    wireTabs()
    wireUploader()
    wireMasterUploader()
    // Fire and forget; enrich once available
    preloadMasterFromLocal()
    updateSummary()
    renderCurrentTab()
  }

  document.addEventListener('DOMContentLoaded', init)
  window.AppState = state
})()


