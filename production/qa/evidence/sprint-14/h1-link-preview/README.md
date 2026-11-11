# Evidence: link preview (sprint 14 H1, sharing §3.3)

From the production build (`npm run build`, `npx vite preview --port 5540 --strictPort`) with `check.cjs`.

| File | Shows |
|---|---|
| `pasted-link-card.png` | The card a chat app would draw from the built page's tags: the preview image, the site, the title and the description |
| `result.json` | The tags as read from the built page, the image's HTTP status, type and size (200, `image/png`, 111 KB), and page errors (none) |

The preview image itself is `public/og.png` (1200 × 630), rendered by `node tools/share/link-preview.cjs` from the palette and the Midday scene colours in `game-config.json`.

**Not checked here:** real apps. The card above is a drawing made from the tags, not WhatsApp, iMessage or Slack. Each caches previews for hours or days, so check a real pasted link after the deploy.
