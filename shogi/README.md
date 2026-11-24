# NAGI SHOGI

A browser-based shogi site for GitHub Pages, with optional Supabase realtime rooms. No accounts and no login.

## Features
- Local hotseat shogi
- Guest player name saved in `localStorage`
- Stable browser guest ID generated with `crypto.randomUUID()`
- Seven-character room codes
- Realtime room state stored in Supabase
- Responsive board, move history, undo, board flip and sound

## GitHub Pages
Published path: https://nagisinnra.github.io/shogi/

## Supabase setup
1. Open the Supabase SQL Editor.
2. Run `supabase-schema.sql`.
3. In Supabase, make sure Realtime is enabled for `public.rooms`.
4. Open the site and use **SUPABASE SETTINGS** to enter the Project URL and publishable key (or legacy anon key).
5. Enter a name, create a room, then share the seven-character code. Your friend enters that code and joins.

## Database shape

The app uses one table, `public.rooms`, with only these four columns:

| Column | Type | Purpose |
|---|---|---|
| `room_id` | text | Seven-character room code |
| `player1` | jsonb | Host guest ID and display name |
| `player2` | jsonb | Guest ID and display name, null until joined |
| `board_state` | jsonb | Board, hands, turn and move history |

No Supabase Auth calls are made. The browser stores `playerName` and a generated `playerId` in localStorage.

## Security note
This is a no-account casual-play design. The Supabase publishable/anon key is intended for browser use, but the RLS policies in this simple schema allow public room reads and updates. A guest UUID stored in localStorage is an identifier, not authentication: it can be copied or spoofed, and a public client can potentially alter room state. Do not store private information in rooms. For ranked or competitive play, move move-validation and player authorization to a trusted server or Edge Function.
