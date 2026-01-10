// Popup script for Twitter Bookmark Manager

let allBookmarks = [];
let filteredBookmarks = [];

// DOM Elements
const syncBtn = document.getElementById('sync-btn');
const exportJsonBtn = document.getElementById('export-json');
const exportCsvBtn = document.getElementById('export-csv');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const bookmarksList = document.getElementById('bookmarks-list');
const bookmarkCount = document.getElementById('bookmark-count');
const statusMessage = document.getElementById('status-message');
const clearAllBtn = document.getElementById('clear-all');
const openViewerBtn = document.getElementById('open-viewer');

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    await loadBookmarks();
    setupEventListeners();
}

function setupEventListeners() {
    syncBtn.addEventListener('click', handleSync);
    exportJsonBtn.addEventListener('click', () => handleExport('json'));
    exportCsvBtn.addEventListener('click', () => handleExport('csv'));
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    clearAllBtn.addEventListener('click', handleClearAll);
    openViewerBtn.addEventListener('click', openViewer);
}

function openViewer() {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
}

async function loadBookmarks() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_ALL_BOOKMARKS' });
        allBookmarks = response.bookmarks || [];
        // Sort by tweet timestamp, most recent first
        allBookmarks.sort((a, b) => new Date(b.timestamp || b.savedAt) - new Date(a.timestamp || a.savedAt));
        filteredBookmarks = allBookmarks;
        updateUI();
    } catch (error) {
        console.error('Error loading bookmarks:', error);
        showStatus('Error loading bookmarks', 'error');
    }
}

function updateUI() {
    bookmarkCount.textContent = allBookmarks.length;
    renderBookmarks(filteredBookmarks);
}

function renderBookmarks(bookmarks) {
    if (bookmarks.length === 0) {
        const isSearching = searchInput.value.trim() !== '';
        bookmarksList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor" opacity="0.3">
          <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/>
        </svg>
        <p>${isSearching ? 'No matching bookmarks' : 'No bookmarks yet'}</p>
        <p class="hint">${isSearching ? 'Try a different search term' : 'Navigate to Twitter Bookmarks and click "Sync"'}</p>
      </div>
    `;
        return;
    }

    bookmarksList.innerHTML = bookmarks.map(bookmark => createBookmarkCard(bookmark)).join('');

    // Add click handlers for cards and delete buttons
    bookmarksList.querySelectorAll('.bookmark-card').forEach(card => {
        const tweetId = card.dataset.tweetId;
        const bookmark = bookmarks.find(b => b.tweetId === tweetId);

        if (bookmark) {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.delete-btn')) {
                    window.open(bookmark.url, '_blank');
                }
            });
        }
    });

    bookmarksList.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const tweetId = btn.dataset.tweetId;
            await handleDelete(tweetId);
        });
    });
}

function createBookmarkCard(bookmark) {
    const date = bookmark.timestamp ? formatDate(bookmark.timestamp) : '';
    const avatarUrl = bookmark.avatarUrl || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%238899a6"><circle cx="12" cy="8" r="4"/><path d="M12 14c-6 0-8 3-8 6v2h16v-2c0-3-2-6-8-6z"/></svg>';

    let mediaHtml = '';
    if (bookmark.mediaUrls && bookmark.mediaUrls.length > 0) {
        const displayMedia = bookmark.mediaUrls.slice(0, 4);
        mediaHtml = `
      <div class="bookmark-media">
        ${displayMedia.map(url => `<img src="${url}" alt="Media" loading="lazy">`).join('')}
      </div>
    `;
    }

    return `
    <div class="bookmark-card" data-tweet-id="${bookmark.tweetId}">
      <div class="bookmark-header">
        <img class="bookmark-avatar" src="${avatarUrl}" alt="${bookmark.authorName}" loading="lazy">
        <div class="bookmark-author">
          <div class="author-name">${escapeHtml(bookmark.authorName)}</div>
          <div class="author-handle">@${escapeHtml(bookmark.authorHandle)}</div>
        </div>
        <div class="bookmark-time">${date}</div>
      </div>
      <div class="bookmark-text">${escapeHtml(bookmark.text)}</div>
      ${mediaHtml}
      <div class="bookmark-actions">
        <button class="delete-btn" data-tweet-id="${bookmark.tweetId}" title="Remove bookmark">
          🗑️ Remove
        </button>
      </div>
    </div>
  `;
}

async function handleSync() {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<div class="spinner"></div> Starting...';

    try {
        // Check if we're on the bookmarks page
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab?.url?.includes('/i/bookmarks')) {
            showStatus('Opening Twitter Bookmarks page...', 'info');
            // Open bookmarks page
            await chrome.tabs.create({ url: 'https://x.com/i/bookmarks' });
            setTimeout(() => {
                showStatus('Navigate to the new tab and click Sync again', 'info');
            }, 1000);
            return;
        }

        const response = await chrome.runtime.sendMessage({ type: 'TRIGGER_SYNC' });

        if (response.success) {
            showStatus('✅ Sync started! Page is scrolling...', 'success');
            syncBtn.innerHTML = '<div class="spinner"></div> Syncing...';
            // Keep popup open a bit so user sees confirmation
            setTimeout(() => window.close(), 2500);
        } else {
            showStatus(response.message || 'Error starting sync', 'error');
            syncBtn.disabled = false;
            syncBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
              </svg>
              Sync Bookmarks
            `;
        }
    } catch (error) {
        console.error('Sync error:', error);
        showStatus('Error syncing bookmarks. Try refreshing the page.', 'error');
        syncBtn.disabled = false;
        syncBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          Sync Bookmarks
        `;
    }
}

async function handleExport(format) {
    try {
        const messageType = format === 'json' ? 'EXPORT_JSON' : 'EXPORT_CSV';
        const response = await chrome.runtime.sendMessage({ type: messageType });

        if (response.data) {
            downloadFile(response.data, response.filename, format === 'json' ? 'application/json' : 'text/csv');
            showStatus(`Exported ${allBookmarks.length} bookmarks as ${format.toUpperCase()}`, 'success');
        }
    } catch (error) {
        console.error('Export error:', error);
        showStatus('Error exporting bookmarks', 'error');
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

function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    clearSearchBtn.style.display = query ? 'block' : 'none';

    if (!query) {
        filteredBookmarks = allBookmarks;
    } else {
        filteredBookmarks = allBookmarks.filter(b =>
            b.text?.toLowerCase().includes(query) ||
            b.authorName?.toLowerCase().includes(query) ||
            b.authorHandle?.toLowerCase().includes(query)
        );
    }

    renderBookmarks(filteredBookmarks);
}

function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';
    filteredBookmarks = allBookmarks;
    renderBookmarks(filteredBookmarks);
}

async function handleDelete(tweetId) {
    if (!confirm('Remove this bookmark?')) return;

    try {
        await chrome.runtime.sendMessage({ type: 'DELETE_BOOKMARK', tweetId });
        allBookmarks = allBookmarks.filter(b => b.tweetId !== tweetId);
        filteredBookmarks = filteredBookmarks.filter(b => b.tweetId !== tweetId);
        updateUI();
        showStatus('Bookmark removed', 'success');
    } catch (error) {
        console.error('Delete error:', error);
        showStatus('Error removing bookmark', 'error');
    }
}

async function handleClearAll() {
    if (!confirm('Clear ALL bookmarks? This cannot be undone.')) return;

    try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL' });
        allBookmarks = [];
        filteredBookmarks = [];
        updateUI();
        showStatus('All bookmarks cleared', 'success');
    } catch (error) {
        console.error('Clear error:', error);
        showStatus('Error clearing bookmarks', 'error');
    }
}

function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    statusMessage.style.display = 'block';

    if (type !== 'info') {
        setTimeout(() => {
            statusMessage.style.display = 'none';
        }, 3000);
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (diffHours < 24) {
            return `${Math.floor(diffHours)}h`;
        } else if (diffDays < 7) {
            return `${Math.floor(diffDays)}d`;
        } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
