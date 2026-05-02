// ==UserScript==
// @name          Export CAS Pro Task
// @namespace    https://tampermonkey.net/
// @version      1.0.0
// @description   Export CAS Pro Task titles grouped by folder category, with optional dedupe and links.
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'tm-export-task-title-panel';
  const CARD_SELECTOR = '.task-card';
  const TITLE_SELECTOR = 'a.task-title span';
  const FOLDER_SELECTOR = '.folder-link';

  const TEXT = {
    dedupe: '去重',
    includeLink: '链接',
    includePath: '目录',
    totalCount: '任务总数',
    categoryCount: '任务数量',
    depth: '分类层级',
    exportButton: '导出',
    buttonTitle: '按目录分类导出任务',
    depthTitle: '按目录路径的前几级分类',
    noTitles: '没有找到可导出的任务。',
    uncategorized: '未分类',
    filenameSuffix: '任务',
  };

  function getDirectText(element) {
    return Array.from(element.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function getTaskTitle(card) {
    const candidates = Array.from(card.querySelectorAll(TITLE_SELECTOR));

    for (const candidate of candidates) {
      const text = getDirectText(candidate);

      if (text) {
        return text;
      }
    }

    return '';
  }

  function getExportOptions() {
    const dedupeInput = document.getElementById('tm-export-task-title-dedupe');
    const linkInput = document.getElementById('tm-export-task-title-link');
    const pathInput = document.getElementById('tm-export-task-title-path');
    const depthInput = document.getElementById('tm-export-task-title-depth');
    const depth = Number.parseInt(depthInput ? depthInput.value : '2', 10);

    return {
      dedupe: dedupeInput ? dedupeInput.checked : false,
      includeLink: linkInput ? linkInput.checked : false,
      includePath: pathInput ? pathInput.checked : false,
      categoryDepth: Number.isFinite(depth) && depth > 0 ? depth : 2,
    };
  }

  function getFolderPath(card) {
    const folder = card.querySelector(FOLDER_SELECTOR);
    return folder ? folder.textContent.trim() : '';
  }

  function getCategory(path, categoryDepth) {
    const parts = path.split('/').map((part) => part.trim()).filter(Boolean);

    if (parts.length > 0) {
      return parts.slice(0, categoryDepth).join('/');
    }

    return TEXT.uncategorized;
  }

  function buildExportItem(title, path, link, options) {
    const lines = [title];

    if (options.includePath && path) {
      lines.push(`目录: ${path}`);
    }

    if (options.includeLink && link) {
      lines.push(`链接: ${link}`);
    }

    return lines.join('\n');
  }

  function collectGroupedTitles(options) {
    const cards = Array.from(document.querySelectorAll(CARD_SELECTOR));
    const groups = new Map();

    for (const card of cards) {
      const titleLink = card.querySelector('a.task-title');
      const title = getTaskTitle(card);

      if (!title) {
        continue;
      }

      const path = getFolderPath(card);
      const category = getCategory(path, options.categoryDepth);
      const link = titleLink ? titleLink.href : '';
      const item = buildExportItem(title, path, link, options);

      if (!groups.has(category)) {
        groups.set(category, options.dedupe ? new Set() : []);
      }

      const titles = groups.get(category);

      if (options.dedupe) {
        titles.add(item);
      } else {
        titles.push(item);
      }
    }

    return groups;
  }

  function countGroupedItems(groups) {
    let count = 0;

    for (const titles of groups.values()) {
      count += Array.from(titles).length;
    }

    return count;
  }

  function formatGroupedTitles(groups) {
    const sections = [];
    const totalCount = countGroupedItems(groups);

    const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    for (const [category, titles] of sortedGroups) {
      const items = Array.from(titles);
      const lines = [];
      lines.push(`[${category}] (${TEXT.categoryCount}：${items.length})`);
      lines.push(...items);
      sections.push(lines.join('\n'));
    }

    return `${TEXT.totalCount}: ${totalCount}\n\n${sections.join('\n\n')}`.trim();
  }

  function downloadTextFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function getTime() {
    const d = new Date();
    const pad = (value) => String(value).padStart(2, '0');

    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate()),
    ].join('-') + '_' + [pad(d.getHours()), pad(d.getMinutes())].join('-');
  }

  function exportTaskTitles() {
    const options = getExportOptions();
    const groups = collectGroupedTitles(options);

    if (groups.size === 0) {
      alert(TEXT.noTitles);
      return;
    }

    const title = document.title.trim() || 'page';
    const safeTitle = title.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
    const timestamp = getTime();
    const filename = `${safeTitle}_${TEXT.filenameSuffix}_${timestamp}.txt`;
    const content = formatGroupedTitles(groups);

    downloadTextFile(filename, content);
  }

  function createCheckbox(id, label, checked) {
    const wrapper = document.createElement('label');
    const input = document.createElement('input');

    input.id = id;
    input.type = 'checkbox';
    input.checked = checked;

    wrapper.appendChild(input);
    wrapper.appendChild(document.createTextNode(` ${label}`));

    return wrapper;
  }

  function createExportPanel() {
    if (document.getElementById(PANEL_ID)) {
      return;
    }

    const panel = document.createElement('div');
    const optionsRow = document.createElement('div');
    const dedupeLabel = createCheckbox('tm-export-task-title-dedupe', TEXT.dedupe, false);
    const linkLabel = createCheckbox('tm-export-task-title-link', TEXT.includeLink, false);
    const pathLabel = createCheckbox('tm-export-task-title-path', TEXT.includePath, false);
    const depthLabel = document.createElement('label');
    const depthInput = document.createElement('input');
    const button = document.createElement('button');

    panel.id = PANEL_ID;

    depthInput.id = 'tm-export-task-title-depth';
    depthInput.type = 'number';
    depthInput.min = '1';
    depthInput.max = '10';
    depthInput.step = '1';
    depthInput.value = '2';
    depthInput.title = TEXT.depthTitle;

    depthLabel.appendChild(document.createTextNode(`${TEXT.depth} `));
    depthLabel.appendChild(depthInput);

    optionsRow.appendChild(dedupeLabel);
    optionsRow.appendChild(linkLabel);
    optionsRow.appendChild(pathLabel);
    optionsRow.appendChild(depthLabel);

    button.type = 'button';
    button.textContent = TEXT.exportButton;
    button.title = TEXT.buttonTitle;
    button.addEventListener('click', exportTaskTitles);

    panel.appendChild(optionsRow);
    panel.appendChild(button);

    Object.assign(panel.style, {
      position: 'fixed',
      right: '16px',
      bottom: '16px',
      zIndex: '2147483647',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '10px',
      border: '1px solid #1f6feb',
      borderRadius: '10px',
      background: '#fff',
      color: '#24292f',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.18)',
    });

    Object.assign(optionsRow.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      flexWrap: 'wrap',
    });

    Object.assign(depthInput.style, {
      width: '30px',
      padding: '2px 4px',
      border: '1px solid #d0d7de',
      borderRadius: '4px',
      fontSize: '13px',
    });

    Object.assign(button.style, {
      padding: '8px 12px',
      border: '1px solid #1f6feb',
      borderRadius: '6px',
      background: '#1f6feb',
      color: '#fff',
      fontSize: '14px',
      fontFamily: 'Arial, sans-serif',
      lineHeight: '1',
      cursor: 'pointer',
    });

    button.addEventListener('mouseenter', () => {
      button.style.background = '#1158c7';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#1f6feb';
    });

    document.body.appendChild(panel);
  }

  function isTargetPage() {
    return Boolean(
      location.hash.includes('/tasks') &&
      document.querySelector(`${CARD_SELECTOR} a.task-title`) &&
      document.querySelector(`${CARD_SELECTOR} ${FOLDER_SELECTOR}`)
    );
  }

  function syncExportPanel() {
    const panel = document.getElementById(PANEL_ID);

    if (isTargetPage()) {
      createExportPanel();
    } else if (panel) {
      panel.remove();
    }
  }

  let pageObserver = null;
  let syncTimer = null;

  function startPageObserver() {
    if (pageObserver) {
      return;
    }

    pageObserver = new MutationObserver(() => {
      clearTimeout(syncTimer);
      syncTimer = setTimeout(syncExportPanel, 200);
    });

    pageObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function stopPageObserver() {
    if (pageObserver) {
      pageObserver.disconnect();
      pageObserver = null;
    }
  }

  function syncRouteObserver() {
    if (location.hash.includes('/tasks')) {
      startPageObserver();
      syncExportPanel();
      return;
    }

    stopPageObserver();
    syncExportPanel();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncRouteObserver);
  } else {
    syncRouteObserver();
  }

  window.addEventListener('hashchange', syncRouteObserver);
})();
