(function() {
  const $ = (sel) => document.querySelector(sel);
  const statsEl = $('#stats');
  const resultsEl = $('#results');

  // Form mode elements
  const localityEl = $('#locality');
  const postalEl = $('#postal');
  const specialtySel = $('#specialtySelect');
  const hasWebsiteEl = $('#hasWebsite');
  const resetBtn = $('#resetForm');

  // AI mode elements
  const aiQueryEl = $('#aiQuery');

  // Tabs
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const tabForm = $('#tab-form');
  const tabAi = $('#tab-ai');

  let data = { records: [], specialties: [] };
  let examplesData = { examples: [] };
  let activeTab = 'form';

  const fetchData = async () => {
    const [lawRes, exRes] = await Promise.all([
      fetch('data/abogados.json'),
      fetch('data/especialidades.json')
    ]);
    data = await lawRes.json();
    examplesData = await exRes.json();

    renderSpecialties(data.specialties);
    renderStats();
    applyFilters();
  };

  const renderSpecialties = (specialties) => {
    if (!specialties || !specialties.length || !specialtySel) return;
    const options = ['<option value="">Todas las especialidades</option>']
      .concat(specialties.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
    specialtySel.innerHTML = options.join('');
  };

  const renderStats = (extra = '') => {
    const base = `Registros: ${data.count} · Hoja: ${data.sheet}`;
    statsEl.textContent = extra ? `${base} · ${extra}` : base;
  };

  const escapeHtml = (str) => String(str).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  const normalize = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

  // Form mode
  const applyFilters = () => {
    const locality = normalize(localityEl.value);
    const postal = normalize(postalEl.value);
    const spec = normalize(specialtySel ? specialtySel.value : '');
    const onlyWeb = hasWebsiteEl.checked;

    const filtered = data.records.filter(r => {
      const byLocality = !locality || normalize(r.nameAddress).includes(locality) || normalize(r.contact).includes(locality);
      const byPostal = !postal || normalize(r.postalCode).includes(postal);
      const bySpec = !spec || normalize(r.specialty).includes(spec);
      const byWeb = !onlyWeb || !!r.website;
      return byLocality && byPostal && bySpec && byWeb;
    });

    renderResults(filtered);
    renderStats(`Filtrados: ${filtered.length}`);
  };

  // AI mode: solo input de palabras clave que retorna lista de abogados compatibles
  const applyAiSearch = () => {
    const q = normalize(aiQueryEl.value);
    if (!q) {
      resultsEl.innerHTML = '<div class="no-results">Escribe palabras clave para ver abogados compatibles.</div>';
      renderStats(`Registros: ${data.count}`);
      return;
    }

    // Detectar especialidades relacionadas desde ejemplos prácticos
    const matchedSpecs = new Set(
      (examplesData.examples || [])
        .filter(e => normalize(e.example).includes(q) || normalize(e.whenToUse).includes(q) || normalize(e.specialty).includes(q))
        .map(e => normalize(e.specialty))
    );

    // Filtrar abogados por especialidad coincidente y por texto directo
    const bySpec = matchedSpecs.size
      ? data.records.filter(r => matchedSpecs.has(normalize(r.specialty)))
      : [];

    const byText = data.records.filter(r => {
      return normalize(r.nameAddress).includes(q) || normalize(r.contact).includes(q) || normalize(r.specialty).includes(q);
    });

    // Unir y deduplicar resultados
    const key = (r) => `${normalize(r.nameAddress)}|${normalize(r.specialty)}|${normalize(r.postalCode || '')}`;
    const map = new Map();
    [...bySpec, ...byText].forEach(r => { if (!map.has(key(r))) map.set(key(r), r); });
    const combined = Array.from(map.values());

    if (!combined.length) {
      resultsEl.innerHTML = '<div class="no-results">Sin coincidencias. Prueba con otras palabras clave.</div>';
      renderStats('Coincidencias: 0');
      return;
    }

    renderResults(combined);
    renderStats(`Coincidencias: ${combined.length}`);
  };

  const cardHtml = (r) => {
    const websiteLink = r.website ? `<a href="${escapeHtml(r.website)}" target="_blank" rel="noopener">Web</a>` : '<span class="badge">Sin web</span>';
    const sourceBadge = r.source ? `<span class="badge">Fuente: ${escapeHtml(r.source)}</span>` : '';
    const contactText = r.contact ? escapeHtml(r.contact) : 'Sin datos de contacto disponibles';
    const postalText = r.postalCode ? escapeHtml(r.postalCode) : '';

    return `
      <article class="card">
        <h3>${escapeHtml(r.nameAddress)}</h3>
        <div class="meta">${postalText} · ${escapeHtml(r.specialty)}</div>
        <p>${contactText}</p>
        <div>${websiteLink} ${sourceBadge}</div>
      </article>
    `;
  };

  const renderResults = (items) => {
    if (!items.length) {
      resultsEl.innerHTML = '<div class="no-results">Sin resultados. Prueba ajustando los filtros.</div>';
      return;
    }
    resultsEl.innerHTML = items.map(cardHtml).join('');
  };

  // Tab switching
  const setActiveTab = (tab) => {
    activeTab = tab;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    tabForm.hidden = tab !== 'form';
    tabAi.hidden = tab !== 'ai';

    if (tab === 'form') {
      applyFilters();
    } else {
      applyAiSearch();
    }
  };

  tabs.forEach(t => {
    t.addEventListener('click', () => setActiveTab(t.dataset.tab));
  });

  // Form events
  localityEl.addEventListener('input', applyFilters);
  postalEl.addEventListener('input', applyFilters);
  if (specialtySel) specialtySel.addEventListener('change', applyFilters);
  hasWebsiteEl.addEventListener('change', applyFilters);

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      localityEl.value = '';
      postalEl.value = '';
      if (specialtySel) specialtySel.value = '';
      hasWebsiteEl.checked = false;
      applyFilters();
    });
  }

  // AI events
  ['input', 'change'].forEach(evt => {
    if (aiQueryEl) aiQueryEl.addEventListener(evt, applyAiSearch);
  });

  // Inicio
  fetchData().catch(err => {
    resultsEl.innerHTML = `<div class="no-results">Error cargando datos: ${escapeHtml(err.message)}</div>`;
  });
})();