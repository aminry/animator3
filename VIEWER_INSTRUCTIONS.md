# 🎬 How to View the Animations

## Quick Start

### Step 1: Start the Server
```bash
npm run serve
```

### Step 2: Open in Browser
The server will automatically start at:
```
http://localhost:8080/viewer.html
```

Or manually open this URL in your browser.

---

## Why Do I Need a Server?

Modern browsers block local file access for security reasons. When you open `viewer.html` directly (by double-clicking), the browser prevents it from loading the JSON files from the `output/` folder.

The local server solves this by serving the files over HTTP, which browsers allow.

---

## Alternative Commands

```bash
# Start the server (same as npm run serve)
npm run view

# Or run the server directly
node serve.js
```

---

## What You'll See

Once the page loads, you'll see:

- **20 animated test cases** in a beautiful grid layout
- Each animation plays automatically
- Individual controls (Play/Pause/Stop) for each animation
- Global controls to manage all animations at once
- Load status for each animation

---

## Troubleshooting

### Port 8080 is already in use

If you see an error that port 8080 is already in use, you can:

1. Stop the existing server (press Ctrl+C in the terminal where it's running)
2. Or edit `serve.js` and change the PORT number to something else (e.g., 8081)

### Animations still don't load

1. Make sure the server is running (you should see "✅ Server running at http://localhost:8080/")
2. Make sure you're opening `http://localhost:8080/viewer.html` (not just `viewer.html`)
3. Check that the `output/` folder contains the JSON files (run `npm run test:build` if needed)

### Browser shows "Cannot GET /"

Make sure you're accessing:
```
http://localhost:8080/viewer.html
```

Not just:
```
http://localhost:8080/
```

---

## Stopping the Server

Press `Ctrl+C` in the terminal where the server is running.

---

## Quick Commands Reference

```bash
# Generate animations
npm run test:build

# Start server
npm run serve

# Open browser (after server is running)
open http://localhost:8080/viewer.html
```

---

## Need Help?

- Check `QUICKSTART.md` for more details
- Check `README.md` for API documentation
- Check `output/` folder to verify JSON files exist
