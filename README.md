# Silent CQ — Self-Spotting Platform for Amateur Radio Nets

**silent-cq.netlify.app**

Silent CQ is a real-time self-spotting and signal reporting web application designed for amateur radio net operations. Built by 4X1DA (Rich Harel, Modiin, Israel) for the Israeli Ham Radio community and any net that wants smarter, data-driven operations.

## What is a Silent CQ?

In amateur radio, "CQ" is the universal call meaning "I'm here, anyone want to talk?" A **Silent CQ** is the digital equivalent — an operator announces their presence, frequency, mode, and equipment on this platform without transmitting on air. Other stations can see who is active, where they are, and what signal reports they're receiving in real time.

## Features

### Self-Spotting
- Operators post their callsign, grid square, band, mode, frequency, power, antenna, and city
- Active stations appear on a live dashboard updated in real time
- Posts auto-expire after 90 minutes to keep the board current
- Operators can delete their own posts; admin can moderate all posts

### Signal Reporting
- Any station can submit an RST signal report for another active station
- Full RST scale: Not Heard, <5-5, 5-5 through 5-9, 5-9+10, +15, +20, +30
- Cannot report your own station
- Cannot submit duplicate reports
- Reports appear instantly on all connected screens

### Map View
- All active stations plotted on an interactive Leaflet/OpenStreetMap
- AllStar-linked stations use precise GPS coordinates from the AllStar network
- Manual stations use Maidenhead grid square with GPS fallback

### Net Manager (Admin)
- Five pre-configured recurring nets with automatic UTC-based scheduling:
  - **Daily Roundtable Net** — 7.165 MHz LSB (40m, daily)
  - **Israel AllStar Link Net** — 430.900 MHz FM (auto-ingested from Allmon2)
  - **Gal Hameshudar Net** — 145.775 MHz FM (גל המשודר)
  - **Shabbat Morning Net** — 7.130 MHz LSB (weekly)
  - **The Daily Roundtable Net (40/60/80/6)** — multi-band
- Admin creates and manages net sessions
- Participants automatically populated from active Silent CQ posts
- Signal reports flow into net sessions from the live board

### AllStar Integration
- Automatic ingestion of checked-in stations from Allmon2 node 48552 (4X1KS Cloud Node)
- Pulls real callsigns, frequencies, CTCSS tones, and GPS coordinates from AllStar stats API
- Filters out system/bridge nodes (Node 1999, Node 48552) automatically
- AllStar stations appear on the map and in net sessions without manual check-in

### Signal Matrix & PDF Export
- Professional TX/RX signal matrix generated per net session
- Shows who heard whom at what signal strength
- Includes participant metadata: callsign, grid, city, power, antenna
- Downloadable as PDF for net records and club archives

### NotebookLM Export
- Daily 24-hour report exportable as structured Markdown
- Opens Google NotebookLM for AI-powered analysis and presentation generation
- NotebookLM produces professional slide decks, propagation analysis, and net summaries
- Ideal for club presentations and historical net records

### Bilingual Interface
- Full Hebrew and English support
- RTL Hebrew layout on login and UI elements
- Language toggle in header

### Additional Features
- Dark/Light mode toggle
- Condensed View for high-density nets (תצוגה מקוצרת)
- Real-time alerts for new Silent CQ posts
- Today's Report — last 24 hours of activity, admin-moderated
- UTC master clock for all net scheduling (Asia/Jerusalem display with full DST support)
- Smart onboarding — bypass login if profile is saved, prompt only for missing fields

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Maps:** Leaflet + OpenStreetMap
- **Deployment:** Netlify (auto-deploy from GitHub)
- **AllStar Integration:** Allmon2 + AllStarLink Stats API

## Use Cases

- Daily HF voice nets wanting digital check-in and signal reporting
- Net controllers needing structured session logs and PDF records
- Clubs wanting AI-generated presentation reports via NotebookLM
- AllStar/EchoLink linked nets with automatic station ingestion
- Any net wanting real-time propagation data from signal reports

## Roadmap

### Phase 2 (In Development)
- Omni-Rig CAT integration for automatic frequency/mode/power from transceiver
- Live TX indicator showing when a station is transmitting
- Enhanced propagation analysis from accumulated signal matrix data
- Automated NotebookLM pipeline

## About

Built by **Rich Harel (4X1DA)**, Modiin, Israel.  
Retired satellite communications engineer, 5 patents with Viasat (DVB-S2).  
Built for the Israeli Ham Radio community and any net that wants smarter operations.

**Live app:** https://silent-cq.netlify.app  
**GitHub:** https://github.com/radiolink-hue/silent-cq
