# ESP32 Wi-Fi Diagnostics Dashboard

A static GitHub Pages dashboard for monitoring four numeric Wi-Fi/device diagnostics reported by an ESP32 through ThingSpeak.

## Dashboard layout

The first screen prioritizes four large current-value cards:

1. **Wi-Fi signal (RSSI)** — Field 1, dBm (usually a negative value such as `-58`).
2. **Network latency** — Field 2, milliseconds.
3. **Device uptime** — Field 3, minutes.
4. **Wi-Fi reconnects** — Field 4, count.

Scroll below the four current values to see the four corresponding history graphs. The graphs are secondary to the current readings.

## Configure ThingSpeak

1. Create a ThingSpeak channel with four numeric fields using the mapping above.
2. Make the channel **public** so this public website can read it without exposing an API key. If you keep it private, the read-only API key placed in this website is visible to every visitor.
3. Open `config.js` and set `CHANNEL_ID` to your channel ID.
4. If the channel is private, set `READ_API_KEY` to its read-only key. Do not put the Write API Key in this file.
5. Commit the files and publish the repository root with GitHub Pages.

The dashboard refreshes at a minimum interval of 15 seconds and retrieves the latest 60 entries by default. Edit `REFRESH_MS`, `RESULTS`, metric labels, units, or field mapping in `config.js` as needed.

## ThingSpeak field mapping

| ThingSpeak field | Expected value | Unit |
|---|---|---|
| Field 1 | Wi-Fi RSSI from `WiFi.RSSI()` | dBm |
| Field 2 | Network probe/round-trip latency | ms |
| Field 3 | Device uptime | minutes |
| Field 4 | Wi-Fi reconnect counter | count |

All four fields must contain numeric values for their respective cards and graphs to display. If a particular field is empty, its card will show `—` until the ESP32 sends a value.

## Publish with GitHub Pages

1. Create a repository named `wifi-diagnostics`.
2. Upload the contents of this folder to the repository root (`index.html`, `styles.css`, `app.js`, `config.js`, and `.nojekyll`).
3. In **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/(root)`, then save.
4. GitHub will show the published site URL in the Pages settings.

**Repository privacy:** GitHub Pages can publish a site from a private repository only on plans that support Pages for private repositories (GitHub Pro for personal accounts, or qualifying organization plans). On GitHub Free, the Pages source repository must be public. The published website itself is public either way. Check your plan before uploading private source code.

## Security notes

- Never commit the ThingSpeak **Write API Key**.
- The website only reads the channel.
- A public channel ID is not a secret. Anyone can read a public channel.
- A read-only key embedded in a public website is not secret; use a public channel if public read access is acceptable.

## Files

- `index.html` — page structure and four headline value cards.
- `styles.css` — responsive styling.
- `app.js` — ThingSpeak fetch, current value rendering, and four history charts.
- `config.js` — channel, refresh interval, and metric/field configuration.
- `.nojekyll` — tells GitHub Pages not to run Jekyll processing.
