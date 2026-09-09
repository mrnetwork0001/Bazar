const fs = require('fs');
const key = process.env.ELEVENLABS_API_KEY;
const VOICE = process.env.ELEVENLABS_VOICE || 'CwhRBWXzGAHq8TQ4Fs17';
const SECTIONS = [
  ['13', "Then an agent hired an agent. Job fifty six thousand, seven hundred and fifty nine. The client is an Altana wallet, spending inside a cap its own contract enforces. The provider holds its own ERC-8004 identity and its own key. It noticed in fifteen seconds, read the chain, and committed the hash of its report onchain. Nobody signed anything."],
];
(async () => {
  for (const [id, text] of SECTIONS) {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true } }),
    });
    if (!res.ok) { console.error(id, 'FAILED', res.status); process.exit(1); }
    fs.writeFileSync(`vo/v${id}.mp3`, Buffer.from(await res.arrayBuffer()));
    console.log(id, 'ok', text.length, 'chars');
  }
})();
