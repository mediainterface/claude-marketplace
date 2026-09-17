# /pr-review — how findings and comments are written (ELI5, from the start)

Reference for [SKILL.md](SKILL.md), handed **verbatim** to every review subagent as part of the
shared dispatch block. It binds from the moment a subagent writes a finding's `summary`, `why`,
and `suggestion` — the triage report and the posted comments reuse that wording nearly verbatim,
nothing is "simplified later". A finding reads like a note from a teammate — German, informal
"du" — and must be understandable for a colleague who doesn't live in this code.

## The recipe, in order

1. **The concrete observation, at the spot** — what you see at this line, named specifically
   (the symbol, the call), not "there may be an issue in this area".
2. **What goes wrong, told as a tiny concrete story** — „wenn X passiert, bleibt Y hängen".
   Skip it if the line already shows the consequence.
3. **A concrete suggestion or a genuine question** — what to do instead, or what you're unsure of.

## The language contract

- **Everyday words.** Describe what happens instead of naming the pattern or mechanism:
  „die Meldung verschwindet nie" statt „es wird kein terminaler Statusübergang emittiert".
- **No shorthand the reader must decode** — kein „i.V.m.", „vgl.", kein Feature-Kürzel; ein
  Fachbegriff ist nur dann ok, wenn die kommentierte Zeile ihn selbst benutzt.
- **At most 3 short sentences of prose per finding.** If the story doesn't fit, it is probably
  two findings — or it is an enumeration that belongs in bullets (next rule).
- **Use Markdown bullets when the finding enumerates.** Several affected spots, several options,
  several steps of the same kind: one-line bullets under a short lead-in sentence. A single
  connected story (observation → consequence → suggestion) stays prose.
- No preamble („Sieht gut aus, aber…"), no restating the code back, no severity labels in the
  text, no AI throat-clearing. If something could be intentional, ask rather than assert.

## Examples

**Good** (simple story, short, asks instead of asserting):
> Wenn während des Neuverbindens die Lizenz wegfällt, wird hier zwar abgebrochen, aber kein
> neuer Status gemeldet — die Toolbar zeigt dann dauerhaft „Verbinde neu…". Kannst du beim
> Abbruch z. B. `idle` melden, oder ist das gewollt?

**Good** (enumeration as bullets — grasped at a glance instead of packed into prose):
> Der neue Badge existiert jetzt dreimal fast identisch:
> - `RecordingBadge` in `toolbar/`
> - `SessionBadge` in `session-list/`
> - hier noch mal inline
>
> Können wir das auf eine Komponente mit `variant`-Prop zusammenziehen?

**Bad** (technically correct, but shorthand the reader must decode):
> Der teardown-Zweig von `abortReconnectCycle` emittiert keinen terminalen Status, i.V.m.
> `onLicenseInfoChanged` → `cleanup()` persistiert der reconnecting-State im Store.

**Bad** (verbose, restates the code, no substance — and no evidence a reviewer could check):
> I noticed that in this section of the code there appears to be a potential concern. The logging
> statement may inadvertently expose sensitive information. Please consider refactoring this.
