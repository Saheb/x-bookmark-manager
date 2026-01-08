// Bookmark Clustering - Topic detection and grouping

// Topic definitions with keywords
const TOPICS = {
    'AI & ML': {
        keywords: ['ai', 'gpt', 'llm', 'chatgpt', 'openai', 'anthropic', 'claude', 'machine learning', 'neural', 'model', 'transformer', 'diffusion', 'midjourney', 'stable diffusion', 'gemini', 'llama', 'mistral', 'deep learning', 'training', 'inference', 'rag', 'agent', 'embedding'],
        color: '#8b5cf6', // purple
        icon: '🤖'
    },
    'Tech & Dev': {
        keywords: ['code', 'coding', 'programming', 'developer', 'javascript', 'python', 'typescript', 'react', 'api', 'github', 'git', 'deploy', 'docker', 'kubernetes', 'aws', 'database', 'sql', 'frontend', 'backend', 'devops', 'engineering', 'software', 'build', 'ship', 'debug', 'bug', 'feature', 'framework', 'library', 'npm', 'rust', 'golang'],
        color: '#06b6d4', // cyan
        icon: '💻'
    },
    'Startups': {
        keywords: ['startup', 'founder', 'funding', 'vc', 'venture', 'seed', 'series', 'yc', 'y combinator', 'investor', 'investment', 'raise', 'valuation', 'exit', 'ipo', 'acquisition', 'bootstrap', 'saas', 'arr', 'mrr', 'revenue', 'growth', 'scale', 'product market fit', 'pmf'],
        color: '#f59e0b', // amber
        icon: '🚀'
    },
    'Design': {
        keywords: ['design', 'ui', 'ux', 'figma', 'typography', 'visual', 'interface', 'prototype', 'wireframe', 'mockup', 'branding', 'logo', 'illustration', 'animation', 'motion', 'font', 'color', 'layout', 'creative', 'aesthetic'],
        color: '#ec4899', // pink
        icon: '🎨'
    },
    'Crypto & Web3': {
        keywords: ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'web3', 'blockchain', 'defi', 'nft', 'token', 'wallet', 'solana', 'sol', 'dao', 'smart contract', 'dapp', 'metaverse'],
        color: '#f97316', // orange
        icon: '⛓️'
    },
    'Career': {
        keywords: ['job', 'jobs', 'hiring', 'career', 'interview', 'resume', 'recruiter', 'salary', 'remote', 'work', 'linkedin', 'offer', 'promotion', 'layoff', 'fired', 'quit', 'team', 'manager', 'leadership'],
        color: '#22c55e', // green
        icon: '💼'
    },
    'Productivity': {
        keywords: ['productivity', 'habit', 'routine', 'time', 'focus', 'notion', 'obsidian', 'note', 'workflow', 'automation', 'efficiency', 'goals', 'morning', 'sleep', 'health', 'exercise', 'meditation', 'mindset'],
        color: '#3b82f6', // blue
        icon: '⚡'
    },
    'Writing': {
        keywords: ['writing', 'write', 'writer', 'blog', 'newsletter', 'substack', 'content', 'copywriting', 'storytelling', 'thread', 'essay', 'book', 'author', 'publish'],
        color: '#a855f7', // violet
        icon: '✍️'
    }
};

/**
 * Detect topics from tweet text
 * @param {string} text - Tweet content
 * @returns {string[]} - Array of detected topic names
 */
export function detectTopics(text) {
    if (!text) return [];

    const lowerText = text.toLowerCase();
    const detectedTopics = [];

    for (const [topicName, config] of Object.entries(TOPICS)) {
        const hasKeyword = config.keywords.some(keyword => {
            // Word boundary matching for single words, contains for phrases
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

/**
 * Get topic configuration
 * @param {string} topicName 
 * @returns {Object} - Topic config with color and icon
 */
export function getTopicConfig(topicName) {
    return TOPICS[topicName] || { color: '#71767b', icon: '📌' };
}

/**
 * Get all available topics
 * @returns {Object} - All topic definitions
 */
export function getAllTopics() {
    return TOPICS;
}

/**
 * Cluster bookmarks by topic
 * @param {Array} bookmarks - Array of bookmark objects
 * @returns {Object} - Bookmarks grouped by topic
 */
export function clusterByTopic(bookmarks) {
    const clusters = {
        'All': bookmarks
    };

    // Initialize topic clusters
    for (const topicName of Object.keys(TOPICS)) {
        clusters[topicName] = [];
    }
    clusters['Other'] = [];

    // Assign bookmarks to clusters
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

    // Remove empty clusters (except All and Other)
    for (const [topic, items] of Object.entries(clusters)) {
        if (items.length === 0 && topic !== 'All' && topic !== 'Other') {
            delete clusters[topic];
        }
    }

    return clusters;
}

/**
 * Cluster bookmarks by author
 * @param {Array} bookmarks - Array of bookmark objects
 * @returns {Array} - Authors sorted by bookmark count
 */
export function clusterByAuthor(bookmarks) {
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

    // Sort by count descending
    return Array.from(authorMap.values())
        .sort((a, b) => b.count - a.count);
}

/**
 * Get top authors
 * @param {Array} bookmarks 
 * @param {number} limit 
 * @returns {Array}
 */
export function getTopAuthors(bookmarks, limit = 10) {
    return clusterByAuthor(bookmarks).slice(0, limit);
}
