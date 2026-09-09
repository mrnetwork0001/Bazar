// Generates the narration with ElevenLabs.
//   export ELEVENLABS_API_KEY=...  &&  node vo-gen.js
// Voice matches the one used across these project videos.
const fs = require('fs');
const key = process.env.ELEVENLABS_API_KEY;
if (!key) { console.error('Set ELEVENLABS_API_KEY'); process.exit(1); }
const VOICE = process.env.ELEVENLABS_VOICE || 'CwhRBWXzGAHq8TQ4Fs17';
const MODEL = 'eleven_multilingual_v2';

const SECTIONS = [
  ['01', "BNB Smart Chain has more than three hundred and ten thousand registered agent identities. The registry is a flat list. A name, a description, an owner. Nothing in it tells you which of them can do the job you actually have."],
  ['02', "Bazar is the front door. One index, two ways in. A storefront for people, and a REST router for other agents."],
  ['03', "Identity, reputation and declared endpoints, read live from the ERC-8004 registries. No return figures, no service levels, no uptime, because the registries publish none of that, and Bazar does not invent numbers."],
  ['04', "Hiring opens a real job on the ERC-8183 commerce kernel. You write the brief. You name the budget. Nothing is quoted, because no registry publishes a price."],
  ['05', "Five contract calls. Create the job. Register the settlement policy. Record the budget. Approve the kernel. Fund the escrow."],
  ['06', "The budget leaves the wallet and the kernel holds it. It releases when the work is accepted, and it returns to you if the deadline passes with nothing delivered."],
  ['07', "The job is on BNB mainnet, and anyone can read it back from the chain. Bazar is not the record. The kernel is."],
  ['08', "An agent can hold its own wallet, too. Through Altana, a session key carries a call allowlist, a spend cap and an expiry. Registered onchain, revocable in one transaction."],
  ['09', "Job fifty six thousand, seven hundred and forty seven was funded exactly that way. Five calls as a single intent, signed by the agent's own key, inside a cap its account enforced. No wallet prompt at any point."],
  ['10', "And the same index answers to machines. Six endpoints, no key, no signup."],
  ['11', "Bazar. Hire onchain agents on BNB Chain."],
];

const total = SECTIONS.reduce((n, s) => n + s[1].length, 0);
console.log('characters to generate:', total);

(async () => {
  for (const [id, text] of SECTIONS) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true } }),
    });
    if (!res.ok) { console.error(id, 'FAILED', res.status, (await res.text()).slice(0, 200)); process.exit(1); }
    fs.writeFileSync(`vo/v${id}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(id, 'ok', text.length, 'chars');
  }
})();
