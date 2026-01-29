# Sweep

An intelligent email sorting app that learns from your behavior. Drag emails into magic folders and Sweep automatically creates rules to sort future emails from the same sender.

## Features

### Magic Folders
- Folders prefixed with `@` (e.g., `@Newsletters`, `@Shopping`) automatically learn from your actions
- Drag any email into a magic folder to create a sorting rule for that sender
- Future emails from that sender are automatically moved to the same folder
- Create custom magic folders for any category you need

### Email Blackhole
- Special `@Blackhole` folder for unwanted emails
- Emails moved to @Blackhole are automatically marked as read
- Configurable auto-delete timer (default: 7 days)
- Permanently deletes old emails on schedule

### Auto-Archive
- Per-folder archive settings for automatic cleanup
- Archive read emails after a configurable time (hours or days)
- Archive unread emails after a configurable time (marks as read and removes from folder)
- Keeps your magic folders clean without losing emails

### Rules Management
- View all sorting rules in a sortable table
- Sort by status, email pattern, match type, destination, or usage count
- Edit or delete rules manually
- Toggle rules on/off without deleting them
- Search/filter rules by pattern or destination

### Match Types
- **Exact**: Match the complete email address
- **Domain**: Match all emails from a domain (e.g., `@example.com`)
- **Contains**: Match emails containing a pattern

### Email Watching
- Real-time monitoring of your inbox via Gmail push notifications
- Simple toggle to enable/disable watching
- Automatic watch renewal (every 5 days) to maintain continuous monitoring

## Architecture

### Desktop App (Tauri + React)
- Cross-platform desktop application
- Dark mode support
- Onboarding flow for initial setup
- Local token storage for authentication

### Backend (FastAPI + Google Cloud)
- **Cloud Run**: Serverless API hosting
- **Firestore**: User data, rules, and settings storage
- **Pub/Sub**: Gmail push notification handling
- **Cloud Scheduler**: Automated cleanup tasks

### Scheduled Jobs
| Job | Schedule | Purpose |
|-----|----------|---------|
| `blackhole-cleanup` | Daily at 6 AM | Delete old emails from @Blackhole |
| `archive-cleanup` | Hourly | Auto-archive emails based on folder settings |
| `watch-renewal` | Every 5 days | Renew Gmail API watches before expiration |

## API Endpoints

### Rules
- `GET /rules` - List all rules (syncs label names from Gmail)
- `POST /rules` - Create a rule
- `GET /rules/{id}` - Get a specific rule
- `PUT /rules/{id}` - Update a rule
- `DELETE /rules/{id}` - Delete a rule

### Magic Folders
- `GET /magic-folders/list` - List all magic folders (labels starting with @)
- `POST /magic-folders/create` - Create new magic folders
- `DELETE /magic-folders/{id}` - Delete a magic folder and its associated rules
- `GET /magic-folders/{id}/settings` - Get folder archive settings
- `PUT /magic-folders/{id}/settings` - Update folder archive settings

### Settings
- `GET /settings` - Get user settings
- `PUT /settings` - Update user settings (blackhole enabled, delete days)

### Watch
- `GET /watch/status` - Get current watch status
- `POST /watch/start` - Start watching for new emails
- `POST /watch/stop` - Stop watching
- `POST /watch/renew` - Renew the watch
- `POST /watch/renew-all` - Renew watches for all users (scheduler endpoint)

### Cleanup (Scheduler Endpoints)
- `POST /cleanup/blackhole` - Delete old emails from @Blackhole folders
- `POST /cleanup/archive` - Auto-archive emails based on folder settings

### Labels
- `GET /labels` - List user's Gmail labels
- `GET /labels/with-auto-learn` - List labels with auto-learn status

## Tech Stack

- **Frontend**: React, Tailwind CSS, Vite
- **Desktop**: Tauri (Rust)
- **Backend**: Python, FastAPI
- **Database**: Google Cloud Firestore
- **Infrastructure**: Google Cloud Run, Cloud Scheduler, Pub/Sub
- **Email**: Gmail API

## Development

### Frontend
```bash
cd autosort
npm install
npm run tauri dev
```

### Backend
```bash
cd autosort-backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### Build
```bash
cd autosort
npm run tauri build
```

## Deployment

### Backend
```bash
cd autosort-backend
gcloud run deploy autosort-backend --source . --region us-central1 --project autosort-prod
```

### Scheduler Jobs
```bash
# Blackhole cleanup (daily at 6 AM)
gcloud scheduler jobs create http blackhole-cleanup \
  --schedule="0 6 * * *" \
  --uri="https://[BACKEND_URL]/cleanup/blackhole" \
  --http-method=POST

# Archive cleanup (hourly)
gcloud scheduler jobs create http archive-cleanup \
  --schedule="0 * * * *" \
  --uri="https://[BACKEND_URL]/cleanup/archive" \
  --http-method=POST

# Watch renewal (every 5 days)
gcloud scheduler jobs create http watch-renewal \
  --schedule="0 4 */5 * *" \
  --uri="https://[BACKEND_URL]/watch/renew-all" \
  --http-method=POST
```
