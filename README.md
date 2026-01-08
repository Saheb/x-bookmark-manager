# X Bookmark Manager

A Chrome extension to sync, search, and organize your Twitter/X bookmarks locally with intelligent topic clustering.

![X Bookmark Manager](https://img.shields.io/badge/Chrome-Extension-blue?logo=googlechrome)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **🔄 Sync Bookmarks** - Automatically scroll and capture all your Twitter/X bookmarks
- **🔍 Powerful Search** - Search by tweet text, author name, or handle
- **🏷️ Smart Clustering** - Auto-categorize bookmarks by topic:
  - 🤖 AI & ML
  - 💻 Tech & Dev
  - 🚀 Startups
  - 🎨 Design
  - ⛓️ Crypto & Web3
  - 💼 Career
  - ⚡ Productivity
  - ✍️ Writing
- **👤 Author Filtering** - Filter by your most bookmarked authors
- **📊 Full-Page Viewer** - Browse bookmarks in a dedicated tab with grid/list views
- **📥 Export** - Download as JSON or CSV
- **🌙 Dark Theme** - Premium dark mode UI

## 📦 Installation

1. **Download or clone** this repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/x-bookmark-manager.git
   ```

2. **Open Chrome Extensions**:
   - Navigate to `chrome://extensions`
   - Enable **Developer mode** (toggle in top right)

3. **Load the extension**:
   - Click **Load unpacked**
   - Select the `twitter-bookmark-manager` folder

4. **Pin the extension** (optional):
   - Click the puzzle icon in Chrome toolbar
   - Pin "Twitter Bookmark Manager"

## 🚀 Usage

### Syncing Bookmarks

1. Go to [twitter.com/i/bookmarks](https://twitter.com/i/bookmarks) or [x.com/i/bookmarks](https://x.com/i/bookmarks)
2. Click the floating **"📚 Sync Bookmarks"** button at the bottom right
3. Wait while it auto-scrolls and captures your bookmarks
4. You'll see a success message when complete

### Viewing Bookmarks

**Option 1: Popup**
- Click the extension icon in your toolbar
- Search and browse bookmarks in the popup

**Option 2: Full-Page Viewer** (recommended)
- Click the extension icon
- Click the **gradient button** (🔗) to open in a new tab
- Use topic pills and author dropdown to filter
- Toggle between grid and list views

### Filtering & Searching

- **Topic Pills**: Click any topic to filter (AI, Tech, Startups, etc.)
- **Author Dropdown**: Select an author to see only their bookmarks
- **Search Bar**: Type to search across text, names, and handles
- **Combine Filters**: Use topic + author + search together

### Exporting

- Click **Export JSON** or **Export CSV** in the sidebar
- File downloads automatically

## 🔧 Technical Details

- **Storage**: IndexedDB (local, no server)
- **Permissions**: Only accesses twitter.com/x.com bookmarks page
- **Privacy**: All data stays on your device

## 📁 Project Structure

```
twitter-bookmark-manager/
├── manifest.json      # Extension configuration
├── background.js      # Service worker for messaging
├── content.js         # Bookmark scraping logic
├── db.js              # IndexedDB storage layer
├── clustering.js      # Topic detection algorithms
├── popup.html/css/js  # Extension popup UI
├── viewer.html/css/js # Full-page viewer UI
└── icons/             # Extension icons
```

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## 📄 License

MIT License - feel free to use and modify.

---

Made with ❤️ for better bookmark management
