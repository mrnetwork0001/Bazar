# Bazar demo video

The composition that produces `bazar-demo.mp4` — 165 seconds, 1920x1080, 30fps.

Screen recordings and rendered output are **not** in this repository. They are
108MB of binary that every clone would otherwise pay for, and none of it is
readable. What is here is the part worth reading: the composition, the
narration script, and the manifest.

## What is missing, and how to put it back

```
clips/          screen recordings, cut from one continuous capture
vo/             ElevenLabs narration, one mp3 per section
public/clips/   the same clips, where Remotion can reach them
public/vo/      the same narration
out/            rendered video
```

**Narration** regenerates from source — `vo-gen.js` and `vo-add.js` hold the
exact script:

```bash
export ELEVENLABS_API_KEY=...
node vo-gen.js && node vo-add.js
mkdir -p public/vo && cp vo/*.mp3 public/vo/
```

**Clips** come from a single screen recording, cut by timestamp. The offsets
used for this render, against a 127-second capture:

| clip | from | seconds |
| --- | --- | --- |
| landing | 4 | 14 |
| browse | 30 | 20 |
| brief | 56 | 42 |
| sign | 99 | 11 |
| explorer | 110 | 5 |
| dashboard | 115 | 6 |
| permissions | 117 | 6 |
| developers | 122 | 5 |

```bash
ffmpeg -ss <from> -i capture.MOV -t <seconds> \
  -vf "scale=1920:1080:flags=lanczos,fps=30" -an \
  -c:v libx264 -crf 18 -pix_fmt yuv420p clips/<name>.mp4
```

The source capture is 1912x1080; it is scaled rather than letterboxed, since a
0.4% horizontal stretch is invisible and black bars are not.

## Render

```bash
npm ci
npm run render
```

**One thing to know before re-cutting.** The agent-to-agent scene names job
**#56759** and its deliverable `0xe8ac7b74…46c5`. That job is real and
Submitted, but its commitment was hashed before the manifest fix and does not
bind the report body; **#56762** is the equivalent job that does. The film was
finished first and is left as it is deliberately - the numbers on screen are
true, and SUBMISSION.md carries the distinction. Anyone re-rendering for a
later audience should swap the job id and hash in `AgentToAgent`.

`src/Bazar.tsx` holds the whole film — every scene, the timeline at the bottom,
and the reasoning for the timings. Each scene's length is set by its narration:
change a line and the scene has to grow with it, or the last words are cut off.
