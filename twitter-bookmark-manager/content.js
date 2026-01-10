// Content script for scraping Twitter bookmarks

let isScrapingActive = false;
let scrapedTweets = new Map();

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

// Auto-detect if we're on bookmarks page and show indicator
if (window.location.pathname.includes('/i/bookmarks')) {
    console.log('[Twitter Bookmark Manager] Ready to sync bookmarks');
    injectStatusIndicator();
}

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
    updateIndicator('Syncing...', true);

    try {
        await autoScrollAndScrape();

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

async function autoScrollAndScrape() {
    const maxScrollAttempts = 100;
    let scrollAttempts = 0;
    let lastHeight = 0;
    let noNewContentCount = 0;

    while (scrollAttempts < maxScrollAttempts && noNewContentCount < 3) {
        // Scrape visible tweets
        const beforeCount = scrapedTweets.size;
        scrapeTweets();
        const afterCount = scrapedTweets.size;

        updateIndicator(`Syncing... (${afterCount} found)`, true);

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

function scrapeTweets() {
    // Twitter uses article elements for tweets
    const tweetElements = document.querySelectorAll('article[data-testid="tweet"]');

    tweetElements.forEach(tweet => {
        try {
            const tweetData = extractTweetData(tweet);
            if (tweetData && tweetData.tweetId && !scrapedTweets.has(tweetData.tweetId)) {
                scrapedTweets.set(tweetData.tweetId, tweetData);
            }
        } catch (e) {
            console.warn('[Twitter Bookmark Manager] Error extracting tweet:', e);
        }
    });
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
