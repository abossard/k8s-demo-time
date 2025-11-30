# CLI Animation / ASCII Tools

Use these to prototype the ASCII animations in `animations/`:

- **asciinema** (terminal recording + shareable URLs): https://asciinema.org/
- **terminalizer** (record terminal, export GIF/MP4, editable YAML frames): https://github.com/faressoft/terminalizer
- **ttystudio** (tty capture to GIF with frame editing): https://github.com/chjj/ttystudio
- **asciimatics** (Python library for text UIs/animations if you want to render frames programmatically): https://github.com/peterbrittain/asciimatics
- **svg-term-cli** (turn asciinema casts into SVG animations): https://github.com/marionebl/svg-term-cli

**Workflow tip:**
1. Draw the first/last frames from `animations/` as static scenes.
2. Use terminalizer or asciinema to capture the transitions (fade, slide, spawn).
3. Export to GIF/MP4 for reference, or keep `.cast` files for live terminal playback.
