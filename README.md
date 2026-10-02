# LearnTrack

A ready-to-deploy personal learning tracker inspired by Duolingo streaks.

## Deploy

This is a static site. Upload the folder to a Vercel project or connect it to a Git repository. No build command is required. `index.html` is the entry point.

## Features

- Learning tracks
- YouTube lesson allow-list inside the app
- Embedded YouTube player
- Real playback-state watch-time tracking
- Daily minutes/videos goals
- Current streak calculation
- Course completion progress
- Lesson queue
- Dark/light mode
- JSON export/import
- Responsive UI
- Optional YouTube Data API key storage for future playlist import

## Important limitation

A normal website cannot stop a user from opening YouTube separately. LearnTrack only controls and tracks the videos loaded inside its own player.

Browser storage is local to each device. True cross-device sync requires a backend such as Supabase/Postgres plus authentication. The UI and data model are deliberately structured so that cloud persistence can be added without replacing the product.
# learning
