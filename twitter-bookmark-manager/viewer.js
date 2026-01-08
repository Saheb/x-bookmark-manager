// Twitter Bookmarks Viewer - Full Page Script
// Import clustering functions inline since ES modules need more setup
// The clustering logic is embedded directly

// Topic definitions with keywords
const TOPICS = {
  'AI & ML': {
    keywords: ['ai', 'gpt', 'llm', 'chatgpt', 'openai', 'anthropic', 'claude', 'machine learning', 'neural', 'model', 'transformer', 'diffusion', 'midjourney', 'stable diffusion', 'gemini', 'llama', 'mistral', 'deep learning', 'training', 'inference', 'rag', 'agent', 'embedding'],
    color: '#8b5cf6',
    icon: '🤖'
  },
  'Tech & Dev': {
    keywords: ['code', 'coding', 'programming', 'developer', 'javascript', 'python', 'typescript', 'react', 'api', 'github', 'git', 'deploy', 'docker', 'kubernetes', 'aws', 'database', 'sql', 'frontend', 'backend', 'devops', 'engineering', 'software', 'build', 'ship', 'debug', 'bug', 'feature', 'framework', 'library', 'npm', 'rust', 'golang'],
    color: '#06b6d4',
    icon: '💻'
  },
  'Startups': {
    keywords: ['startup', 'founder', 'funding', 'vc', 'venture', 'seed', 'series', 'yc', 'y combinator', 'investor', 'investment', 'raise', 'valuation', 'exit', 'ipo', 'acquisition', 'bootstrap', 'saas', 'arr', 'mrr', 'revenue', 'growth', 'scale', 'product market fit', 'pmf'],
    color: '#f59e0b',
    icon: '🚀'
  },
  'Design': {
    keywords: ['design', 'ui', 'ux', 'figma', 'typography', 'visual', 'interface', 'prototype', 'wireframe', 'mockup', 'branding', 'logo', 'illustration', 'animation', 'motion', 'font', 'color', 'layout', 'creative', 'aesthetic'],
    color: '#ec4899',
    icon: '🎨'
  },
  'Crypto & Web3': {
    keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'web3', 'blockchain', 'defi', 'nft', 'token', 'wallet', 'solana', 'sol', 'dao', 'smart contract', 'dapp', 'metaverse'],
    color: '#f97316',
    icon: '⛓️'
  },
  'Career': {
    keywords: ['job', 'jobs', 'hiring', 'career', 'interview', 'resume', 'recruiter', 'salary', 'remote', 'work', 'linkedin', 'offer', 'promotion', 'layoff', 'fired', 'quit', 'team', 'manager', 'leadership'],
    color: '#22c55e',
    icon: '💼'
  },
  'Productivity': {
    keywords: ['productivity', 'habit', 'routine', 'time', 'focus', 'notion', 'obsidian', 'note', 'workflow', 'automation', 'efficiency', 'goals', 'morning', 'sleep', 'health', 'exercise', 'meditation', 'mindset'],
    color: '#3b82f6',
    icon: '⚡'
  },
  'Writing': {
    keywords: ['writing', 'write', 'writer', 'blog', 'newsletter', 'substack', 'content', 'copywriting', 'storytelling', 'thread', 'essay', 'book', 'author', 'publish'],
    color: '#a855f7',
    icon: '✍️'
  }
};

function detectTopics(text) {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  const detectedTopics = [];

  for (const [topicName, config] of Object.entries(TOPICS)) {
    const hasKeyword = config.keywords.some(keyword => {
      if (keyword.includes(' ')) {
        return lowerText.includes(keyword);
      } else {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(lowerText);
      }
    });
    if (hasKeyword) {
      detectedTopics.push(topicName);
    }
  }
  return detectedTopics;
}

function clusterByTopic(bookmarks) {
  const clusters = { 'All': bookmarks };
  for (const topicName of Object.keys(TOPICS)) {
    clusters[topicName] = [];
  }
  clusters['Other'] = [];

  bookmarks.forEach(bookmark => {
    const topics = detectTopics(bookmark.text);
    if (topics.length === 0) {
      clusters['Other'].push(bookmark);
    } else {
      topics.forEach(topic => {
        clusters[topic].push(bookmark);
      });
    }
  });

  // Remove empty clusters
  for (const [topic, items] of Object.entries(clusters)) {
    if (items.length === 0 && topic !== 'All') {
      delete clusters[topic];
    }
  }
  return clusters;
}

function clusterByAuthor(bookmarks) {
  const authorMap = new Map();
  bookmarks.forEach(bookmark => {
    const handle = bookmark.authorHandle;
    if (!handle) return;
    if (!authorMap.has(handle)) {
      authorMap.set(handle, {
        handle,
        name: bookmark.authorName,
        avatarUrl: bookmark.avatarUrl,
        count: 0,
        bookmarks: []
      });
    }
    const author = authorMap.get(handle);
    author.count++;
    author.bookmarks.push(bookmark);
  });
  return Array.from(authorMap.values()).sort((a, b) => b.count - a.count);
}

// State
let allBookmarks = [];
let filteredBookmarks = [];
let currentView = 'grid';
let currentTopic = 'All';
let currentAuthor = '';
let topicClusters = {};
let authorList = [];

// DOM Elements
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const bookmarksContainer = document.getElementById('bookmarks-container');
const totalCountEl = document.getElementById('total-count');
const authorCountEl = document.getElementById('author-count');
const resultsCountEl = document.getElementById('results-count');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const viewGridBtn = document.getElementById('view-grid');
const viewListBtn = document.getElementById('view-list');
const topicFiltersEl = document.getElementById('topic-filters');
const authorSelectEl = document.getElementById('author-select');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  await loadBookmarks();
  setupEventListeners();
}

function setupEventListeners() {
  searchInput.addEventListener('input', handleSearch);
  clearSearchBtn.addEventListener('click', clearSearch);
  exportJsonBtn.addEventListener('click', () => handleExport('json'));
  exportCsvBtn.addEventListener('click', () => handleExport('csv'));
  viewGridBtn.addEventListener('click', () => setView('grid'));
  viewListBtn.addEventListener('click', () => setView('list'));
  authorSelectEl.addEventListener('change', handleAuthorFilter);
}

async function loadBookmarks() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_BOOKMARKS' });
    allBookmarks = response.bookmarks || [];

    // Sort by tweet timestamp, most recent first
    allBookmarks.sort((a, b) => new Date(b.timestamp || b.savedAt) - new Date(a.timestamp || a.savedAt));

    // Build clusters
    topicClusters = clusterByTopic(allBookmarks);
    authorList = clusterByAuthor(allBookmarks);

    // Render filters
    renderTopicPills();
    renderAuthorDropdown();

    // Apply initial filter
    applyFilters();
    updateStats();
  } catch (error) {
    console.error('Error loading bookmarks:', error);
    showError('Error loading bookmarks. Please try again.');
  }
}

function renderTopicPills() {
  const topics = Object.keys(topicClusters);

  topicFiltersEl.innerHTML = topics.map(topic => {
    const count = topicClusters[topic].length;
    const config = TOPICS[topic] || { color: '#1d9bf0', icon: '📌' };
    const isAll = topic === 'All';
    const isOther = topic === 'Other';
    const icon = isAll ? '🔖' : (isOther ? '📌' : config.icon);
    const color = isAll ? '#1d9bf0' : (isOther ? '#71767b' : config.color);

    return `
      <button class="topic-pill ${topic === currentTopic ? 'active' : ''}" 
              data-topic="${topic}" 
              style="--topic-color: ${color}">
        <span>${icon}</span>
        <span>${topic}</span>
        <span class="count">${count}</span>
      </button>
    `;
  }).join('');

  // Add click handlers
  topicFiltersEl.querySelectorAll('.topic-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      currentTopic = pill.dataset.topic;
      renderTopicPills();
      applyFilters();
    });
  });
}

function renderAuthorDropdown() {
  const options = ['<option value="">All Authors</option>'];

  authorList.slice(0, 20).forEach(author => {
    options.push(`<option value="${author.handle}">@${author.handle} (${author.count})</option>`);
  });

  authorSelectEl.innerHTML = options.join('');
  authorSelectEl.value = currentAuthor;
}

function handleAuthorFilter() {
  currentAuthor = authorSelectEl.value;
  applyFilters();
}

function applyFilters() {
  // Start with topic filter
  let bookmarks = currentTopic === 'All' ? allBookmarks : (topicClusters[currentTopic] || []);

  // Apply author filter
  if (currentAuthor) {
    bookmarks = bookmarks.filter(b => b.authorHandle === currentAuthor);
  }

  // Apply search
  const query = searchInput.value.trim().toLowerCase();
  if (query) {
    bookmarks = bookmarks.filter(b =>
      b.text?.toLowerCase().includes(query) ||
      b.authorName?.toLowerCase().includes(query) ||
      b.authorHandle?.toLowerCase().includes(query)
    );
  }

  // Sort by tweet timestamp, most recent first
  bookmarks.sort((a, b) => new Date(b.timestamp || b.savedAt) - new Date(a.timestamp || a.savedAt));

  filteredBookmarks = bookmarks;
  updateResultsCount();
  renderBookmarks(filteredBookmarks);
}

function updateStats() {
  totalCountEl.textContent = allBookmarks.length;
  authorCountEl.textContent = authorList.length;
  updateResultsCount();
}

function updateResultsCount() {
  const parts = [];
  if (currentTopic !== 'All') parts.push(currentTopic);
  if (currentAuthor) parts.push(`@${currentAuthor}`);

  const query = searchInput.value.trim();
  if (query) parts.push(`"${query}"`);

  if (parts.length > 0) {
    resultsCountEl.textContent = `${filteredBookmarks.length} results for ${parts.join(' + ')}`;
  } else {
    resultsCountEl.textContent = `${filteredBookmarks.length} bookmarks`;
  }
}

function handleSearch() {
  const query = searchInput.value.trim();
  clearSearchBtn.style.display = query ? 'block' : 'none';
  applyFilters();
}

function clearSearch() {
  searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  applyFilters();
}

function renderBookmarks(bookmarks) {
  if (bookmarks.length === 0) {
    const hasFilters = currentTopic !== 'All' || currentAuthor || searchInput.value.trim();
    bookmarksContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
        <p>${hasFilters ? 'No matching bookmarks found' : 'No bookmarks saved yet'}</p>
        <p class="hint">${hasFilters ? 'Try adjusting your filters' : 'Use the extension popup to sync your Twitter bookmarks'}</p>
      </div>
    `;
    return;
  }

  bookmarksContainer.className = currentView === 'grid' ? 'bookmarks-grid' : 'bookmarks-list';
  bookmarksContainer.innerHTML = bookmarks.map(bookmark => createBookmarkCard(bookmark)).join('');

  // Add click handlers
  bookmarksContainer.querySelectorAll('.bookmark-card').forEach(card => {
    const tweetId = card.dataset.tweetId;
    const bookmark = bookmarks.find(b => b.tweetId === tweetId);

    if (bookmark) {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.delete-btn') && !e.target.closest('.open-link')) {
          window.open(bookmark.url, '_blank');
        }
      });
    }
  });

  bookmarksContainer.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tweetId = btn.dataset.tweetId;
      await handleDelete(tweetId);
    });
  });
}

function createBookmarkCard(bookmark) {
  const date = bookmark.timestamp ? formatDate(bookmark.timestamp) : '';
  const avatarUrl = bookmark.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%2371767b"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 3-8 6v2h16v-2c0-3-2-6-8-6z"/></svg>';

  // Get topics for this bookmark
  const topics = detectTopics(bookmark.text);
  const topicBadges = topics.slice(0, 2).map(topic => {
    const config = TOPICS[topic];
    return `<span class="topic-badge" style="background: ${config.color}">${config.icon}</span>`;
  }).join('');

  let mediaHtml = '';
  if (bookmark.mediaUrls && bookmark.mediaUrls.length > 0) {
    const displayMedia = bookmark.mediaUrls.slice(0, 4);
    const mediaClass = displayMedia.length === 1 ? 'single' :
      displayMedia.length === 2 ? 'double' :
        displayMedia.length === 3 ? 'triple' : 'quad';
    mediaHtml = `
      <div class="bookmark-media ${mediaClass}">
        ${displayMedia.map(url => `<img src="${url}" alt="Media" loading="lazy">`).join('')}
      </div>
    `;
  }

  return `
    <article class="bookmark-card" data-tweet-id="${bookmark.tweetId}">
      <div class="bookmark-card-content">
        <header class="bookmark-header">
          <img class="bookmark-avatar" src="${avatarUrl}" alt="${escapeHtml(bookmark.authorName)}" loading="lazy">
          <div class="bookmark-author">
            <div class="author-name">${escapeHtml(bookmark.authorName)}</div>
            <div class="author-handle">@${escapeHtml(bookmark.authorHandle)}</div>
          </div>
          ${date ? `<span class="bookmark-time">${date}</span>` : ''}
        </header>
        <div class="bookmark-text">${escapeHtml(bookmark.text)}</div>
        ${topicBadges ? `<div class="bookmark-topics">${topicBadges}</div>` : ''}
        ${mediaHtml}
      </div>
      <footer class="bookmark-footer">
        <a href="${bookmark.url}" target="_blank" class="open-link" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7zm-2 16H5V5h7V3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7z"/>
          </svg>
          View on X
        </a>
        <button class="delete-btn" data-tweet-id="${bookmark.tweetId}">Remove</button>
      </footer>
    </article>
  `;
}

function setView(view) {
  currentView = view;
  viewGridBtn.classList.toggle('active', view === 'grid');
  viewListBtn.classList.toggle('active', view === 'list');
  renderBookmarks(filteredBookmarks);
}

async function handleDelete(tweetId) {
  if (!confirm('Remove this bookmark?')) return;

  try {
    await chrome.runtime.sendMessage({ type: 'DELETE_BOOKMARK', tweetId });
    allBookmarks = allBookmarks.filter(b => b.tweetId !== tweetId);

    // Rebuild clusters
    topicClusters = clusterByTopic(allBookmarks);
    authorList = clusterByAuthor(allBookmarks);

    renderTopicPills();
    renderAuthorDropdown();
    applyFilters();
    updateStats();
  } catch (error) {
    console.error('Delete error:', error);
    showError('Error removing bookmark');
  }
}

async function handleExport(format) {
  try {
    const messageType = format === 'json' ? 'EXPORT_JSON' : 'EXPORT_CSV';
    const response = await chrome.runtime.sendMessage({ type: messageType });

    if (response.data) {
      downloadFile(response.data, response.filename, format === 'json' ? 'application/json' : 'text/csv');
    }
  } catch (error) {
    console.error('Export error:', error);
    showError('Error exporting bookmarks');
  }
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else if (diffDays < 365) {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  } catch {
    return '';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showError(message) {
  bookmarksContainer.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor" style="color: var(--danger);">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      </svg>
      <p>${message}</p>
      <p class="hint">Try refreshing the page or reopening the extension</p>
    </div>
  `;
}
