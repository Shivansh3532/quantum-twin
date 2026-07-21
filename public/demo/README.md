# Demo media (reserved paths)

The homepage and demo automatically use these files **when present** — no code change needed, just add the file and redeploy.

## Walkthrough video (final submission asset)

| Path | Used for |
|------|----------|
| `public/demo/quantum-twin-demo.mp4` | The "See a complete migration" player on the homepage. |
| `public/demo/quantum-twin-demo-poster.webp` | Poster frame shown before the video plays. |

Until the MP4 exists, the homepage shows a clean fallback (or a screenshot, see below) instead of a broken player.

## Screenshots (`public/demo/screens/`)

Optimized captures of the real running app. The homepage preview uses the first of these that exists:

| Filename | Route | Viewport | Product state |
|----------|-------|----------|---------------|
| `home-desktop.png` | `/` | 1280×720 | Homepage hero + flow |
| `demo-decision.png` | `/demo` | 1280×720 | Recorded run, deterministic decision |

Add more captures freely (`home-mobile.png`, `support.png`, …). Never commit AI-generated imagery here — these must be real screenshots of the running application.
