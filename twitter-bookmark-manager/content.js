// Content script for scraping Twitter bookmarks

let isScrapingActive = false;
let scrapedTweets = new Map();
let indicatorInjected = false;

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_SCRAPE') {
        startScraping();
        sendResponse({ success: true });
    } else if (message.type === 'GET_SCRAPE_STATUS') {
        sendResponse({
            isActive: isScrapingActive,
            count: scrapedTweets.size
        });
    }
    return true;
});

// Check if we're on bookmarks page and inject indicator
function checkAndInjectIndicator() {
    const isBookmarksPage = window.location.pathname.includes('/i/bookmarks');
    const indicator = document.getElementById('tbm-indicator');

    if (isBookmarksPage && !indicator) {
        console.log('[Twitter Bookmark Manager] Bookmarks page detected, injecting sync button');
        injectStatusIndicator();
        indicatorInjected = true;
    } else if (!isBookmarksPage && indicator) {
        // Remove indicator if we navigated away
        indicator.remove();
        indicatorInjected = false;
    }
}

// Initial check
checkAndInjectIndicator();

// Monitor for SPA navigation (Twitter is a single-page app)
let lastUrl = window.location.href;
const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        checkAndInjectIndicator();
    }
});

// Observe document for URL changes (Twitter uses history.pushState)
urlObserver.observe(document.body, { childList: true, subtree: true });

// Also check periodically in case mutations are missed
setInterval(checkAndInjectIndicator, 2000);

function injectStatusIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'tbm-indicator';
    indicator.innerHTML = `
    <style>
      #tbm-indicator {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: linear-gradient(135deg, #1d9bf0 0%, #1a8cd8 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 30px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 4px 20px rgba(29, 155, 240, 0.4);
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #tbm-indicator:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 25px rgba(29, 155, 240, 0.5);
      }
      #tbm-indicator.syncing {
        background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
      }
      #tbm-indicator .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        display: none;
      }
      #tbm-indicator.syncing .spinner {
        display: block;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    <div class="spinner"></div>
    <span class="text">📚 Sync Bookmarks</span>
  `;
    document.body.appendChild(indicator);

    indicator.addEventListener('click', () => {
        if (!isScrapingActive) {
            startScraping();
        }
    });
}

function updateIndicator(text, isSyncing = false) {
    const indicator = document.getElementById('tbm-indicator');
    if (indicator) {
        indicator.querySelector('.text').textContent = text;
        indicator.classList.toggle('syncing', isSyncing);
    }
}

async function startScraping() {
    if (isScrapingActive) return;

    isScrapingActive = true;
    scrapedTweets.clear();
    updateIndicator('Loading...', true);

    try {
        // Fetch existing bookmark IDs for smart sync
        const existingResponse = await chrome.runtime.sendMessage({ type: 'GET_BOOKMARK_IDS' });
        const existingIds = new Set(existingResponse.ids || []);

        updateIndicator(`Syncing... (${existingIds.size} existing)`, true);

        // Smart scroll - stops when hitting known bookmarks
        await autoScrollAndScrape(existingIds);

        // Send collected bookmarks to background
        const bookmarks = Array.from(scrapedTweets.values());
        let addedCount = 0;

        if (bookmarks.length > 0) {
            const response = await chrome.runtime.sendMessage({
                type: 'SAVE_BOOKMARKS',
                bookmarks: bookmarks
            });
            addedCount = response && response.added !== undefined ? response.added : bookmarks.length;
        }

        updateIndicator(`✅ Added ${addedCount} new bookmarks`, false);
        setTimeout(() => updateIndicator('📚 Sync Bookmarks', false), 3000);

    } catch (error) {
        console.error('[Twitter Bookmark Manager] Error:', error);
        updateIndicator('❌ Error syncing', false);
        setTimeout(() => updateIndicator('📚 Sync Bookmarks', false), 3000);
    }

    isScrapingActive = false;
}

async function autoScrollAndScrape(existingIds) {
    const maxScrollAttempts = 100;
    let scrollAttempts = 0;
    let lastHeight = 0;
    let noNewContentCount = 0;
    let consecutiveKnownCount = 0;
    const STOP_AFTER_KNOWN = 3; // Stop after finding 3 consecutive known bookmarks

    while (scrollAttempts < maxScrollAttempts && noNewContentCount < 3) {
        // Scrape visible tweets
        const beforeCount = scrapedTweets.size;
        const knownFound = scrapeTweets(existingIds);
        const afterCount = scrapedTweets.size;

        // Track consecutive known bookmarks
        if (knownFound > 0 && afterCount === beforeCount) {
            consecutiveKnownCount += knownFound;
        } else if (afterCount > beforeCount) {
            consecutiveKnownCount = 0; // Reset when we find new bookmarks
        }

        const newCount = afterCount - (existingIds.size - consecutiveKnownCount);
        updateIndicator(`Syncing... (${afterCount} found, ${consecutiveKnownCount} known)`, true);

        // Stop if we've hit too many known bookmarks in a row
        if (consecutiveKnownCount >= STOP_AFTER_KNOWN) {
            console.log('[Twitter Bookmark Manager] Stopping early - found known bookmarks');
            break;
        }

        // Check if we got new content
        if (afterCount === beforeCount) {
            noNewContentCount++;
        } else {
            noNewContentCount = 0;
        }

        // Scroll down
        const currentHeight = document.documentElement.scrollHeight;
        window.scrollTo(0, currentHeight);

        // Wait for new content to load
        await sleep(1500);

        // Check if page height changed
        if (document.documentElement.scrollHeight === lastHeight) {
            noNewContentCount++;
        }
        lastHeight = document.documentElement.scrollHeight;

        scrollAttempts++;
    }
}

function scrapeTweets(existingIds = new Set()) {
    // Twitter uses article elements for tweets
    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');
    let knownCount = 0;

    tweetElements.forEach(tweet => {
        try {
            const tweetData = extractTweetData(tweet);
            if (tweetData && tweetData.tweetId) {
                if (existingIds.has(tweetData.tweetId)) {
                    knownCount++;
                }
                if (!scrapedTweets.has(tweetData.tweetId)) {
                    scrapedTweets.set(tweetData.tweetId, tweetData);
                }
            }
        } catch (e) {
            console.warn('[Twitter Bookmark Manager] Error extracting tweet:', e);
        }
    });

    return knownCount;
}

function extractTweetData(tweetElement) {
    // Get tweet link to extract ID
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    if (!tweetLink) return null;

    const href = tweetLink.getAttribute('href');
    const statusMatch = href.match(/\/status\/(\d+)/);
    if (!statusMatch) return null;

    const tweetId = statusMatch[1];

    // Extract author info
    const authorLink = tweetElement.querySelector('a[href^="/"][role="link"]');
    const authorHandle = authorLink?.getAttribute('href')?.replace('/', '') || '';

    const authorNameEl = tweetElement.querySelector('[data-testid="User-Name"]');
    const authorName = authorNameEl?.querySelector('span')?.textContent || '';

    // Extract avatar
    const avatarImg = tweetElement.querySelector('img[src*="profile_images"]');
    const avatarUrl = avatarImg?.getAttribute('src') || '';

    // Extract tweet text
    const tweetTextEl = tweetElement.querySelector('[data-testid="tweetText"]');
    const text = tweetTextEl?.textContent || '';

    // Extract timestamp
    const timeEl = tweetElement.querySelector('time');
    const timestamp = timeEl?.getAttribute('datetime') || '';

    // Extract media
    const mediaUrls = [];
    const images = tweetElement.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    images.forEach(img => {
        mediaUrls.push(img.getAttribute('src'));
    });

    // Extract video thumbnail if present
    const videos = tweetElement.querySelectorAll('video');
    videos.forEach(video => {
        const poster = video.getAttribute('poster');
        if (poster) mediaUrls.push(poster);
    });

    return {
        tweetId,
        authorName,
        authorHandle,
        avatarUrl,
        text,
        timestamp,
        url: `https://twitter.com${href}`,
        mediaUrls,
        savedAt: new Date().toISOString()
    };
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
