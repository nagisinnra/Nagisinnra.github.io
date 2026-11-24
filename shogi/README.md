# NAGI SHOGI

Responsive browser shogi game hosted on GitHub Pages with optional Supabase realtime rooms.

## Included
- 9×9 board, traditional pieces, local hotseat play
- Legal movement, king-safety filtering, promotion, captures and drops
- Nifu and dead-rank drop restrictions
- Move history, undo, board flip, move hints and optional sound
- Supabase anonymous auth, room creation/joining and realtime sync

## Deploy
This site is published from `shogi/` in `nagisinnra/Nagisinnra.github.io`.
URL: https://nagisinnra.github.io/shogi/

## Supabase
1. Enable Anonymous Sign-Ins in Authentication → Providers.
2. Run `supabase-schema.sql` in SQL Editor.
3. In the site, open SUPABASE SETTINGS and enter the project URL and publishable key (or legacy anon key).
4. Create a room on one device and join using its code on another.

Never expose the service_role key or database password.

## Current scope
This is an early playable release. Pawn-drop mate is not checked. Online RPC checks player identity, turn ownership and board shape, but does not independently validate every shogi rule; use it for casual matches only. No clock, ranking, account profile, spectator mode or matchmaking yet.
