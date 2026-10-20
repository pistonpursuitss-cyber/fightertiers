# PvP tier system

A static tier-list site (GitHub Pages) that a Discord bot edits by committing to `data/players.json`.

```
Discord /tier set ... -> bot commits data/players.json -> Pages redeploys (~30-60s) -> site polls every 30s
```

## 1. Put the site on GitHub Pages
1. Create a repo and upload `index.html` and `data/players.json` to the root (delete the sample players).
2. Repo Settings > Pages > Deploy from a branch > `main` / root.
3. Your site is at `https://YOURNAME.github.io/REPO/`.

## 2. Create the Discord bot
1. https://discord.com/developers/applications > New Application > Bot tab > Reset Token (copy it).
2. Copy the Application ID (this is `CLIENT_ID`). Enable Developer Mode in Discord and right-click your server to copy `GUILD_ID`.
3. OAuth2 > URL Generator: scopes `bot` and `applications.commands`, no extra permissions needed. Open the URL to invite it.

## 3. Create a GitHub token
GitHub > Settings > Developer settings > Fine-grained tokens > only your repo > Repository permissions > Contents: Read and write.

## 4. Run the bot
```
cd bot
cp .env.example .env     # fill in the values
npm install
npm start
```
Needs Node 20.6+. The bot must stay running, so host it on something always-on (a VPS, Raspberry Pi, Railway, Fly.io, etc.). Never commit `.env`.

## Commands
By default only members with Manage Server can use them. Change this in Server Settings > Integrations > your bot.
- `/tier set player gamemode tier` (HT1 to LT5)
- `/tier remove player [gamemode]`
- `/tier addmode name` / `/tier removemode name`
