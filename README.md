# SkillStake

SkillStake is a Telegram-first multiplayer skill gaming platform. It brings classic games into Telegram Mini Apps, with room invites, asynchronous turns, match sharing, and a platform coin wallet for cosmetic rewards.

## Games and player features

- Whot, Classic Ludo, Ludo Blitz, Draughts, and Bead 16.
- Telegram Mini App integration for Telegram identity, theme and viewport handling, haptics, and deep links.
- Private room invitations and Telegram links that open a specific match.
- Casual asynchronous turns (up to one hour) and Fast Blitz turns (45 seconds), with persisted turn state and turn notifications when Telegram is configured.
- Match settlement and wallet/escrow flows, plus a non-cash platform coin ledger. Winners and referrers can earn coins; coins are intended for cosmetics.
- Winner share cards with a challenge link, and referral links.
- Website live chat that relays messages between visitors and the configured Telegram admin chat.

## Requirements

- Node.js 20 or later and npm.
- PostgreSQL for persistent player, wallet, match, and coin data.
- A Telegram bot created through [@BotFather](https://t.me/BotFather) for Mini App links, turn DMs, and bot polling.

## Local setup

1. Install packages: `npm install`
2. Copy `.env.example` to `.env` and fill in the values you use. Do not commit `.env`.
3. Create a PostgreSQL database and apply the schema: `npm run db:push`
4. Start the app: `npm run dev`
5. Open the local URL shown in the terminal. Telegram Mini App features require an HTTPS deployment configured with your bot.

Useful commands:

- `npm run dev` — start the app and backend in development mode.
- `npm run lint` — type-check the TypeScript project.
- `npm run build` — build the browser app and backend bundle.
- `npm start` — run the built backend.
- `npm run db:push` — apply the database schema.

## Telegram bot setup

Set these values in `.env` (and the public bot username in the frontend build environment):

- `ADMIN_USERNAME` and `ADMIN_PASSWORD` — private admin dashboard credentials. Configure both; there are no published default credentials.
- `TELEGRAM_BOT_TOKEN` — secret token from BotFather. Keep it server-side.
- `TELEGRAM_BOT_USERNAME` — bot username without `@`.
- `VITE_TELEGRAM_BOT_USERNAME` — same username, available to the web client for invite links.
- `TELEGRAM_MINI_APP_URL` — public HTTPS URL of the Mini App.
- `TELEGRAM_ADMIN_CHAT_ID` — admin chat used for withdrawal/deposit alerts and website live chat.

The bot listener uses Telegram long polling while the server runs. `/start` accepts match payloads such as `match_9876` and replies with an Open Match button. Match links route players to the specified room. When a player completes a turn, the opponent can receive a message such as “⚡ It's your turn in Whot!” with a direct match link. Deposit and withdrawal alerts include admin action buttons. Start the bot in Telegram first so it can message you; Telegram does not allow a bot to initiate a private chat before the user starts it.

For BotFather, configure the Mini App URL and menu button to use the same deployed HTTPS address. Run only one long-polling bot instance per token; polling removes any configured webhook when it starts.

## Environment variables

See `.env.example` for the complete template. At minimum, configure PostgreSQL using `DATABASE_URL` or the individual `SQL_*` values. Telegram and Gemini integrations are optional for local development; their related features need valid credentials. `COINS_PER_GAME_WIN` and `COINS_PER_REFERRAL_GAME` configure platform coin rewards. Platform coins are not cash and cannot be withdrawn.

## Data and deployment notes

- PostgreSQL schema and migration setup are in `database/` and `src/db/`.
- The server persists some local fallback state as JSON files. These files contain player or transaction data and are ignored by Git; use a private persistent volume if you deploy with the fallback store.
- Put secrets in your hosting provider's environment settings. Never publish bot tokens, database credentials, real user records, or wallet data.
- Configure the Telegram bot, HTTPS Mini App URL, database, and any payment/escrow integrations before enabling those production features.


