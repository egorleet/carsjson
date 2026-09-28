(() => {
  const $ = (selector) => document.querySelector(selector);
  const brandSelect = $('#brand-select');
  const brandPicker = $('#brand-picker');
  const brandToggle = $('#brand-toggle');
  const brandMenu = $('#brand-menu');
  const brandOptions = $('#brand-options');
  const requestCode = $('#request-code');
  const responseCode = $('#response-code');
  const runButton = $('#run-request');
  const status = $('#response-status');
  const apiOrigin = /^https?:$/.test(location.protocol) ? location.origin : 'https://carsjson.pages.dev';
  let language = 'javascript';
  let requestText = '';
  let selectedBrand = { id: 'ABARTH', name: 'Abarth', cyrillic_name: 'Абарт', logo: '/logos/abarth.webp' };
  let brands = [selectedBrand];
  let filteredBrands = brands;
  let activeIndex = -1;
  let searchQuery = '';
  let requestController;
  let requestSequence = 0;

  function endpoint(brand = selectedBrand) {
    return `/v1/brands/${encodeURIComponent(brand.id.toLowerCase())}/models.json`;
  }

  function normalizeSearch(value) {
    return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[_-]/g, ' ');
  }

  function positionBrandMenu() {
    if (brandMenu.hidden) return;
    const bounds = brandPicker.getBoundingClientRect();
    const viewport = window.visualViewport;
    const top = viewport?.offsetTop ?? 0;
    const bottom = top + (viewport?.height ?? window.innerHeight);
    const below = bottom - bounds.bottom;
    const above = bounds.top - top;
    const openAbove = below < 220 && above > below;
    brandMenu.dataset.side = openAbove ? 'up' : 'down';
    const availableHeight = (openAbove ? above : below) - 64;
    brandMenu.style.setProperty('--brand-list-height', `${Math.max(96, Math.min(240, availableHeight))}px`);
  }

  function setActiveBrand(index, scroll = true) {
    activeIndex = index;
    [...brandOptions.children].forEach((option, optionIndex) => {
      option.dataset.active = String(optionIndex === index);
    });
    const active = brandOptions.children[index];
    if (!active) {
      brandSelect.removeAttribute('aria-activedescendant');
      return;
    }
    brandSelect.setAttribute('aria-activedescendant', active.id);
    if (scroll) {
      const bounds = active.getBoundingClientRect();
      const listBounds = brandOptions.getBoundingClientRect();
      if (bounds.top < listBounds.top) brandOptions.scrollTop += bounds.top - listBounds.top;
      if (bounds.bottom > listBounds.bottom) brandOptions.scrollTop += bounds.bottom - listBounds.bottom;
    }
  }

  function renderBrands() {
    const terms = normalizeSearch(searchQuery).trim().split(/\s+/).filter(Boolean);
    filteredBrands = brands.filter(brand => {
      const text = normalizeSearch(`${brand.name} ${brand.id} ${brand.cyrillic_name || ''}`);
      return terms.every(term => text.includes(term));
    });
    const options = filteredBrands.map((brand, index) => {
      const option = document.createElement('div');
      option.id = `brand-option-${index}`;
      option.className = 'brand-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(brand.id === selectedBrand.id));
      option.setAttribute('aria-label', brand.name);
      option.dataset.index = String(index);
      const logo = document.createElement('span');
      logo.className = 'brand-option-logo';
      if (brand.logo) {
        const image = document.createElement('img');
        image.src = brand.logo;
        image.alt = '';
        image.loading = 'lazy';
        logo.append(image);
      }
      const name = document.createElement('span');
      name.className = 'brand-option-name';
      name.textContent = brand.name;
      const id = document.createElement('span');
      id.className = 'brand-option-id';
      id.textContent = brand.id;
      const check = document.createElement('span');
      check.className = 'brand-option-check';
      check.textContent = brand.id === selectedBrand.id ? '✓' : '';
      check.setAttribute('aria-hidden', 'true');
      option.append(logo, name, id, check);
      return option;
    });
    brandOptions.replaceChildren(...options);
    $('#brand-empty').hidden = options.length > 0;
    $('#brand-results').textContent = `${options.length} ${options.length === 1 ? 'brand' : 'brands'}${terms.length ? ' found' : ' available'}`;
    positionBrandMenu();
    const selectedIndex = filteredBrands.findIndex(brand => brand.id === selectedBrand.id);
    setActiveBrand(options.length ? Math.max(0, selectedIndex) : -1);
  }

  function openBrandMenu() {
    if (!brandMenu.hidden) return;
    brandMenu.hidden = false;
    brandSelect.setAttribute('aria-expanded', 'true');
    brandToggle.setAttribute('aria-expanded', 'true');
    brandToggle.setAttribute('aria-label', 'Hide brands');
    searchQuery = '';
    renderBrands();
  }

  function closeBrandMenu() {
    brandMenu.hidden = true;
    brandSelect.setAttribute('aria-expanded', 'false');
    brandSelect.removeAttribute('aria-activedescendant');
    brandToggle.setAttribute('aria-expanded', 'false');
    brandToggle.setAttribute('aria-label', 'Show brands');
    brandSelect.value = selectedBrand.name;
    searchQuery = '';
  }

  function chooseBrand(index) {
    if (!filteredBrands[index]) return;
    selectedBrand = filteredBrands[index];
    closeBrandMenu();
    updateRequest();
    runRequest();
  }

  function showCode(element, text, json = false) {
    // Build text nodes, so source data is never interpreted as HTML.
    const pattern = json
      ? /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?\b/g
      : /'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:const|await|if|throw|new|import|from|with|as)\b/g;
    const fragment = document.createDocumentFragment();
    let offset = 0;
    for (const match of text.matchAll(pattern)) {
      fragment.append(document.createTextNode(text.slice(offset, match.index)));
      const token = document.createElement('span');
      token.textContent = match[0];
      const tail = text.slice(match.index + match[0].length);
      token.className = /^["']/.test(match[0])
        ? json && /^\s*:/.test(tail) ? 'syntax-key' : 'syntax-string'
        : /^-?\d/.test(match[0]) ? 'syntax-number' : 'syntax-literal';
      fragment.append(token);
      offset = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(text.slice(offset)));
    element.replaceChildren(fragment);
  }

  function updateRequest() {
    const url = `${apiOrigin}${endpoint()}`;
    const snippets = {
      javascript: `const response = await fetch(\n  '${url}'\n);\nif (!response.ok) {\n  throw new Error(\`HTTP \${response.status}\`);\n}\nconst models = await response.json();`,
      curl: `curl --fail --silent --show-error \\\n  '${url}'`,
      python: `import json\nfrom urllib.request import urlopen\n\nwith urlopen(\n    '${url}'\n) as response:\n    models = json.load(response)`,
    };
    requestText = snippets[language];
    showCode(requestCode, requestText);
    $('#raw-response').href = endpoint();
  }

  function wireTabs(selector, onSelect) {
    const tabs = [...document.querySelectorAll(selector)];
    function activate(tab, focus = false) {
      tabs.forEach(item => {
        const selected = item === tab;
        item.setAttribute('aria-selected', String(selected));
        item.tabIndex = selected ? 0 : -1;
      });
      if (focus) tab.focus();
      onSelect(tab);
    }
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activate(tab));
      tab.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        if (next !== undefined) {
          event.preventDefault();
          activate(tabs[next], true);
        }
      });
    });
  }

  wireTabs('[data-language]', tab => {
    language = tab.dataset.language;
    $('#request-panel').setAttribute('aria-labelledby', tab.id);
    updateRequest();
  });

  async function fetchJson(url, controller = new AbortController()) {
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function runRequest() {
    const sequence = ++requestSequence;
    requestController?.abort();
    requestController = new AbortController();
    const brand = selectedBrand;
    runButton.disabled = true;
    status.className = 'text-terminal-muted';
    status.textContent = 'Requesting…';
    responseCode.textContent = '// Loading models…';
    $('#response-info').textContent = brand.name;
    const started = performance.now();
    try {
      if (location.protocol === 'file:') throw new Error('Open this page over HTTP to run live requests.');
      const models = await fetchJson(endpoint(brand), requestController);
      if (sequence !== requestSequence) return;
      if (!Array.isArray(models)) throw new Error('Expected a JSON array of models.');
      showCode(responseCode, JSON.stringify(models, null, 2), true);
      status.textContent = `200 OK · ${Math.round(performance.now() - started)} ms`;
      status.className = 'response-success';
      $('#response-info').textContent = `${brand.name} · ${models.length} ${models.length === 1 ? 'model' : 'models'}`;
      responseCode.parentElement.scrollTop = 0;
    } catch (error) {
      if (sequence !== requestSequence) return;
      status.textContent = 'Request failed';
      status.className = 'response-error';
      responseCode.textContent = `Unable to load this response.\n\n${error.name === 'AbortError' ? 'The request timed out.' : error.message}\n\nYou can retry or open the JSON link below.`;
      $('#response-info').textContent = 'No response data received';
    } finally {
      if (sequence === requestSequence) {
        runButton.disabled = false;
        requestController = undefined;
      }
    }
  }
  runButton.addEventListener('click', runRequest);
  brandSelect.addEventListener('focus', () => {
    openBrandMenu();
    brandSelect.select();
  });
  brandSelect.addEventListener('click', () => {
    if (brandMenu.hidden) {
      openBrandMenu();
      brandSelect.select();
    }
  });
  brandSelect.addEventListener('input', () => {
    openBrandMenu();
    searchQuery = brandSelect.value;
    renderBrands();
  });
  brandSelect.addEventListener('keydown', event => {
    if (event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (brandMenu.hidden) openBrandMenu();
      else if (filteredBrands.length) {
        const direction = event.key === 'ArrowDown' ? 1 : -1;
        setActiveBrand((activeIndex + direction + filteredBrands.length) % filteredBrands.length);
      }
    } else if (event.key === 'Enter' && !brandMenu.hidden) {
      event.preventDefault();
      chooseBrand(activeIndex);
    } else if (event.key === 'Escape' && !brandMenu.hidden) {
      event.preventDefault();
      closeBrandMenu();
    } else if (event.key === 'Tab') closeBrandMenu();
  });
  // Keep focus on the combobox while choosing an option with the mouse.
  brandOptions.addEventListener('mousedown', event => event.preventDefault());
  brandOptions.addEventListener('click', event => {
    const option = event.target.closest('[role="option"]');
    if (option) chooseBrand(Number(option.dataset.index));
  });
  brandOptions.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const option = event.target.closest('[role="option"]');
    if (option) setActiveBrand(Number(option.dataset.index), false);
  });
  brandToggle.addEventListener('mousedown', event => event.preventDefault());
  brandToggle.addEventListener('click', () => {
    if (!brandMenu.hidden) closeBrandMenu();
    else {
      brandSelect.focus();
      openBrandMenu();
      brandSelect.select();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (!brandPicker.contains(event.target)) closeBrandMenu();
  });
  brandPicker.addEventListener('focusout', event => {
    if (!brandPicker.contains(event.relatedTarget)) closeBrandMenu();
  });
  window.addEventListener('resize', positionBrandMenu);
  window.addEventListener('scroll', positionBrandMenu, { passive: true });
  window.visualViewport?.addEventListener('resize', positionBrandMenu);
  window.visualViewport?.addEventListener('scroll', positionBrandMenu);

  const commonFields = [
    ['name', 'string', 'Display name from the source.'],
    ['cyrillic_name', 'string', 'Cyrillic name or localized spelling.'],
    ['year_from', 'number | null', 'First year listed in the source.'],
    ['year_to', 'number | null', 'Last year listed in the source.'],
  ];
  const fields = {
    model: [
      ['id', 'string', 'Model identifier, such as 500 or 124_SPIDER.'],
      ['brand_id', 'string', 'Parent brand identifier, such as ABARTH.'],
      ...commonFields,
      ['nameplates', 'string[]', 'Variant names, for example ["500", "500e"]. An empty array means none are listed.'],
    ],
    brand: [
      ['id', 'string', 'Brand identifier, such as ABARTH. Lowercase it when building an endpoint path.'],
      ...commonFields,
      ['logo', 'string', 'Image path relative to the API origin, such as /logos/abarth.webp.'],
    ],
    meta: [
      ['schema_version', 'number', 'The API format version. Currently 1.'],
      ['data_version', 'string', 'SHA-256 fingerprint of the published data and logos. Compare it to detect changes.'],
      ['generated_at', 'string · ISO 8601', 'UTC build timestamp, not the time the source data was collected.'],
      ['brands_count', 'number', 'Number of brands in this snapshot.'],
      ['models_count', 'number', 'Number of models across all brands.'],
      ['logos_count', 'number', 'Number of published brand logos.'],
    ],
  };
  wireTabs('[data-schema]', tab => {
    $('#schema-panel').setAttribute('aria-labelledby', tab.id);
    $('#schema-caption').textContent = `${tab.textContent} object fields`;
    const rows = fields[tab.dataset.schema].map(([name, type, description]) => {
      const row = document.createElement('tr');
      const heading = document.createElement('th');
      heading.scope = 'row';
      heading.textContent = name;
      const cell = document.createElement('td');
      const typeLabel = document.createElement('span');
      typeLabel.textContent = type;
      cell.append(typeLabel, document.createTextNode(description));
      row.append(heading, cell);
      return row;
    });
    $('#schema-rows').replaceChildren(...rows);
  });

  let noticeTimer;
  $('[data-copy="request"]').addEventListener('click', async () => {
    const notice = $('#copy-notice');
    try {
      await navigator.clipboard.writeText(requestText);
      notice.textContent = 'Request copied to clipboard.';
    } catch {
      const range = document.createRange();
      range.selectNodeContents(requestCode);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      notice.textContent = 'Code selected. Press Ctrl+C or ⌘C to copy.';
    }
    clearTimeout(noticeTimer);
    notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 4000);
  });

  updateRequest();
  showCode(responseCode, responseCode.textContent, true);
  if (location.protocol !== 'file:') {
    fetchJson('/v1/brands.json').then(data => {
      if (!Array.isArray(data) || data.length === 0) throw new Error('No brands returned.');
      brands = [...data].sort((a, b) => a.name.localeCompare(b.name, 'en'));
      selectedBrand = brands.find(brand => brand.id === selectedBrand.id) || brands[0];
      if (brandMenu.hidden) brandSelect.value = selectedBrand.name;
      else renderBrands();
      updateRequest();
      return runRequest();
    }).catch(() => {
      $('#brand-hint').textContent = 'Brand list unavailable. Abarth is still available to try.';
    });
  }
})();
