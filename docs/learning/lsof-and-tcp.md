# `lsof`, killing dev servers, PID, and TCP

Personal learning note (not project documentation). Captures the `lsof … | xargs kill`
breakdown, what a PID is, and the TCP primer. Move/delete freely — it's not load-bearing
for the repo.

---

## Listing every running dev server

```bash
lsof -nP -iTCP -sTCP:LISTEN | grep -i node
```

### The flags

| Flag                    | Meaning                                        | Why                                                          |
| ----------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `-i`                    | only **i**nternet/network connections          | drops the thousands of regular-file handles                  |
| `-iTCP`                 | narrow to TCP                                  | not UDP                                                      |
| `:3001` (as `-i :3001`) | only port 3001                                 | the actual filter                                            |
| `-s TCP:LISTEN`         | only sockets in **LISTEN** state               | a dev server _listens_; client connections are `ESTABLISHED` |
| `-n`                    | don't resolve IPs → hostnames                  | skips DNS → faster, no hangs                                 |
| `-P`                    | don't resolve **P**ort numbers → service names | shows `3001`, not a guessed service name                     |
| `-t`                    | **t**erse: print _only_ the PID                | makes the output pipeable into `kill`                        |
| `-c node`               | only **c**ommands named `node`                 | filter by program                                            |

## Killing them

```bash
# Surgical — by port (recommended)
lsof -ti :3000 | xargs kill
lsof -ti :3001 | xargs kill          # add -9 only if a plain kill won't die

# Nuke all Next dev servers at once
pkill -f "next dev"
```

---

## `lsof` — "**L**i**s**t **O**pen **F**iles"

Core Unix idea: **everything is a file** — real files, directories, pipes, and _network
sockets too_. A server listening on a port is, to the kernel, just a process holding an
open "file" that happens to be a network socket. So `lsof`, a tool for listing open files,
doubles as "who's holding port 3001?"

It's `l-s-o-f`, and `-i TCP` ("internet, TCP") — the dashes group differently than they look.

### The pipe: `| xargs kill`

`kill` takes PIDs **as arguments**, not from standard input:

```bash
kill 67171        # works
echo 67171 | kill # does NOT work — kill ignores stdin
```

`lsof -t` prints PIDs to stdout. `xargs` is the adapter: it **reads stdin and turns it
into command-line arguments**.

```bash
lsof -ti :3001 | xargs kill
# becomes →  kill 67171
```

Two processes on the port → `lsof -t` prints two PIDs → `xargs` runs `kill 67171 67182`.
That's _why_ `-t` matters: without it `lsof` prints a full table with headers, which `kill`
couldn't parse.

**Why this pattern beats memorizing a PID:** the PID changes every restart; port and
command name are stable. You describe _what_ you want and let the shell resolve it to a
_who_ (PID) at run time.

## PID — Process ID

A unique number the OS hands to every running program. `pnpm dev` → the kernel creates a
process and tags it with an integer like `67171`. That number is how you and tools like
`kill` point at _that specific running thing_.

## TCP — Transmission Control Protocol

The rulebook two programs use to send a **reliable, ordered stream of bytes** over a
network. When your browser talks to the Next dev server on port 3001, TCP is the delivery
contract underneath.

### The 3-way handshake

Before any data flows:

```
client → SYN      "let's talk"
server → SYN-ACK  "ok, I'm here"
client → ACK      "confirmed, sending data now"
```

This is the `LISTEN` state from `lsof -s TCP:LISTEN`: the server sits waiting for that
first `SYN`. A connection past the handshake shows as `ESTABLISHED` — which is why
filtering to `LISTEN` finds the _server_, not its active clients.

### Why it matters / the trade-off

TCP's reliability **costs latency** — every retransmit and acknowledgment is round-trips.
That's why the alternative exists:

- **TCP** — reliable, ordered, slower. Web (HTTP), databases (Postgres on 5433 is TCP),
  SSH, file transfer. Anything where a missing byte ruins everything.
- **UDP** — fire-and-forget, no handshake, no retransmit, no ordering. Faster, lossy.
  Live video, voice, gaming, DNS. A dropped video frame beats freezing to re-fetch it.
