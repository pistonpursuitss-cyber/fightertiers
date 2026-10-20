import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID, GITHUB_TOKEN, GITHUB_REPO,
  GITHUB_BRANCH = 'main', DATA_PATH = 'data/players.json' } = process.env;

const TIERS = ['HT1','LT1','HT2','LT2','HT3','LT3','HT4','LT4','HT5','LT5'];

// ---- Slash command definition ----
const command = new SlashCommandBuilder()
  .setName('tier')
  .setDescription('Manage the PvP tier list')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild) // change who can use it in Server Settings > Integrations
  .addSubcommand(s => s.setName('set').setDescription('Set a player\'s tier in a gamemode')
    .addStringOption(o => o.setName('player').setDescription('Minecraft username').setRequired(true))
    .addStringOption(o => o.setName('gamemode').setDescription('Gamemode, e.g. Sword').setRequired(true))
    .addStringOption(o => o.setName('tier').setDescription('Tier').setRequired(true)
      .addChoices(...TIERS.map(t => ({ name: t, value: t })))))
  .addSubcommand(s => s.setName('remove').setDescription('Remove a player, or just one gamemode')
    .addStringOption(o => o.setName('player').setDescription('Minecraft username').setRequired(true))
    .addStringOption(o => o.setName('gamemode').setDescription('Only remove this gamemode')))
  .addSubcommand(s => s.setName('addmode').setDescription('Add a new gamemode tab')
    .addStringOption(o => o.setName('name').setDescription('Gamemode name').setRequired(true)))
  .addSubcommand(s => s.setName('removemode').setDescription('Delete a gamemode and all its tiers')
    .addStringOption(o => o.setName('name').setDescription('Gamemode name').setRequired(true)));

// ---- GitHub read/write ----
const api = `https://api.github.com/repos/${GITHUB_REPO}/contents/${DATA_PATH}`;
const gh = {
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'tier-bot',
};

async function load() {
  const r = await fetch(`${api}?ref=${GITHUB_BRANCH}`, { headers: gh });
  if (!r.ok) throw new Error(`GitHub read failed (${r.status})`);
  const j = await r.json();
  return { sha: j.sha, data: JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')) };
}

async function save(data, sha, message) {
  const r = await fetch(api, {
    method: 'PUT',
    headers: gh,
    body: JSON.stringify({
      message, sha, branch: GITHUB_BRANCH,
      content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    }),
  });
  if (r.status === 409 || r.status === 422) return false; // file changed under us, retry
  if (!r.ok) throw new Error(`GitHub write failed (${r.status})`);
  return true;
}

async function update(fn, message) {
  for (let i = 0; i < 3; i++) {
    const { sha, data } = await load();
    const result = fn(data);
    if (await save(data, sha, message)) return result;
  }
  throw new Error('Could not save after 3 tries. Try again.');
}

// ---- Command logic (mutates data, returns reply text) ----
const ci = (a, b) => a.toLowerCase() === b.toLowerCase();

function apply(d, sub, o) {
  const modes = d.gamemodes.join(', ');
  const findMode = n => d.gamemodes.find(m => ci(m, n));
  const findPlayer = n => Object.keys(d.players).find(k => ci(k, n));

  if (sub === 'set') {
    const name = o.getString('player').trim();
    const mode = findMode(o.getString('gamemode').trim());
    const tier = o.getString('tier');
    if (!/^\w{3,16}$/.test(name)) throw new Error('That is not a valid Minecraft username.');
    if (!mode) throw new Error(`Unknown gamemode. Available: ${modes}`);
    const key = findPlayer(name) ?? name;
    d.players[key] ??= {};
    d.players[key][mode] = tier;
    return `Set **${key}** to **${tier}** in **${mode}**.`;
  }

  if (sub === 'remove') {
    const key = findPlayer(o.getString('player').trim());
    if (!key) throw new Error('Player not found.');
    const gm = o.getString('gamemode');
    if (gm) {
      const mode = findMode(gm);
      if (!mode || !(mode in d.players[key])) throw new Error(`${key} has no tier in that gamemode.`);
      delete d.players[key][mode];
      if (!Object.keys(d.players[key]).length) delete d.players[key];
      return `Removed **${key}** from **${mode}**.`;
    }
    delete d.players[key];
    return `Removed **${key}** from the tier list.`;
  }

  if (sub === 'addmode') {
    const name = o.getString('name').trim();
    if (!name || name.length > 20) throw new Error('Name must be 1-20 characters.');
    if (findMode(name)) throw new Error('That gamemode already exists.');
    d.gamemodes.push(name);
    return `Added gamemode **${name}**.`;
  }

  if (sub === 'removemode') {
    const mode = findMode(o.getString('name').trim());
    if (!mode) throw new Error(`Unknown gamemode. Available: ${modes}`);
    d.gamemodes = d.gamemodes.filter(m => m !== mode);
    for (const [k, v] of Object.entries(d.players)) {
      delete v[mode];
      if (!Object.keys(v).length) delete d.players[k];
    }
    return `Deleted gamemode **${mode}** and its tiers.`;
  }
}

// ---- Bot ----
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('clientReady', async () => {
  await new REST().setToken(DISCORD_TOKEN)
    .put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: [command.toJSON()] });
  console.log(`Logged in as ${client.user.tag}. Commands registered.`);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() || i.commandName !== 'tier') return;
  await i.deferReply();
  try {
    const sub = i.options.getSubcommand();
    const msg = await update(d => apply(d, sub, i.options), `tier ${sub} by ${i.user.tag}`);
    await i.editReply(`${msg} The site updates in about a minute.`);
  } catch (e) {
    await i.editReply(`Failed: ${e.message}`);
  }
});

client.login(DISCORD_TOKEN);
