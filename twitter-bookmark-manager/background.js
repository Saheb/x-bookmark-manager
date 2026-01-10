// Background service worker for Twitter Bookmark Manager

import { initDB, saveBookmarks, getAllBookmarks, getBookmarkCount, searchBookmarks, deleteBookmark, clearAllBookmarks, exportAsJSON, exportAsCSV } from './db.js';

// Initialize database on extension load
initDB().catch(console.error);

// Message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse).catch(err => {
        console.error('Error handling message:', err);
        sendResponse({ error: err.message });
    });
    return true; // Keep channel open for async response
});

async function handleMessage(message, sender) {
    switch (message.type) {
        case 'SAVE_BOOKMARKS':
            const result = await saveBookmarks(message.bookmarks);
            return { success: true, count: result.total, added: result.added };

        case 'GET_ALL_BOOKMARKS':
            const bookmarks = await getAllBookmarks();
            return { bookmarks };

        case 'GET_BOOKMARK_COUNT':
            const count = await getBookmarkCount();
            return { count };

        case 'SEARCH_BOOKMARKS':
            const results = await searchBookmarks(message.query);
            return { bookmarks: results };

        case 'DELETE_BOOKMARK':
            await deleteBookmark(message.tweetId);
            return { success: true };

        case 'CLEAR_ALL':
            await clearAllBookmarks();
            return { success: true };

        case 'EXPORT_JSON':
            const json = await exportAsJSON();
            return { data: json, filename: 'twitter-bookmarks.json' };

        case 'EXPORT_CSV':
            const csv = await exportAsCSV();
            return { data: csv, filename: 'twitter-bookmarks.csv' };

        case 'TRIGGER_SYNC':
            // Forward to content script in active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab && (tab.url?.includes('twitter.com/i/bookmarks') || tab.url?.includes('x.com/i/bookmarks'))) {
                try {
                    // Wait for content script to acknowledge
                    const response = await chrome.tabs.sendMessage(tab.id, { type: 'START_SCRAPE' });
                    if (response && response.success) {
                        return { success: true, message: 'Sync started' };
                    } else {
                        return { success: false, message: 'Content script not responding. Try refreshing the page.' };
                    }
                } catch (err) {
                    console.error('Error sending to content script:', err);
                    return { success: false, message: 'Could not start sync. Try refreshing the page.' };
                }
            } else {
                return { success: false, message: 'Please navigate to Twitter Bookmarks page first' };
            }

        default:
            return { error: 'Unknown message type' };
    }
}
