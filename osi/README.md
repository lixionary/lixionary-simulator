# Packet Lab — OSI Seven Layers

An interactive browser-only networking lesson at `/osi/`. Two directly connected hosts exchange either HTTP/1.1 over TCP port 80 or a DNS A query over UDP port 53. The collection page links to this lab. No backend, account, or runtime network access is needed.

## Using the lesson

Choose TCP/HTTP or UDP/DNS, enter a request path or domain name, and select 10BASE-T or 100BASE-TX. Step through the journey or play it at 0.5×–4× speed. Click either host's OSI layers to explore their responsibilities. The packet selector and full timeline jump to specific exchanges. Changing application inputs, transport, physical layer, or fault resets playback; Reset also restores the speed and defaults.

The inspector shows actual serialized headers and application messages. Its hexadecimal view colors each byte by envelope; clicking a byte opens the corresponding transmitted signal window. The number field selects other frame offsets. CRC-32 calculations show both the numerical CRC and the least-significant-byte-first FCS stored in the frame. Preamble and SFD are outside the frame and excluded from the FCS.

Try clean delivery, corruption of the first request data frame, or dropping that frame. Corruption flips the low bit of the first application byte **after PHY decoding**, preserving the original FCS. This is a deliberately labeled bit-error abstraction, not an analog impairment. The receiver validates the received bytes, without consulting the original. A failed FCS stops at layer 2. No upper-layer packet is delivered or acknowledged. A dropped frame never arrives for validation.

TCP retransmits the identical request bytes with the same sequence number after a shortened teaching timeout. Subsequent traffic is clean. UDP has no transport retry; the DNS application times out, with application retries explicitly disabled. Successful UDP delivery returns a simulated A record of `192.0.2.42` with TTL 60 seconds. DNS also supports TCP in real deployments.

## Protocol model

`src/model.ts` contains pure message/packet builders, receiver validation, and journey generation. `src/physical.ts` contains the copper encoders and known-state decoders. React renders the calculations rather than scripting checksum verdicts.

- Fixed endpoints: client `192.168.1.10`, MAC `02:00:00:00:00:0A`, ephemeral port `49152`; server `192.168.1.20`, MAC `02:00:00:00:00:14`, port `80` or `53`. Both share a subnet; peer MACs are preconfigured.
- HTTP uses a GET origin-form request, Host `lab.test`, and `Connection: close`. The server returns `200 OK`, a UTF-8 text body, and its exact byte Content-Length. The server's address is preconfigured; HTTP does not trigger the separate DNS lesson.
- DNS uses transaction ID `0x1234`, length-prefixed labels, one A/IN question, and a fixed response that echoes the question and uses a name compression pointer for the answer. Names accept ASCII letters, digits, and interior hyphens, up to 63 characters per label and 253 overall. This peer answers locally; recursive resolution is not modeled.
- TCP uses a 20-byte header, a fixed illustrative receive window, no options, and initial sequence numbers 1000/5000. The handshake, request and response ACKs, and four-way FIN close use byte-accurate sequence/acknowledgment arithmetic, including SYN/FIN consuming one sequence number. Control packets are summarized in single steps; request and response visit all seven conceptual layers.
- UDP uses its real eight-byte header and a nonzero checksum. Both transports use the 16-bit Internet checksum over the IPv4 pseudo-header, transport header, and payload. Odd data gets a zero low byte for calculation only; a computed UDP checksum of zero is transmitted as `FFFF`.
- IPv4 uses a 20-byte header, protocol 6 or 17, TTL 64, Don't Fragment, total length, and header checksum. One request/response message fits in one packet. Reusing a fixed IP ID is intentional for these unfragmented, DF-marked teaching packets.
- Ethernet II adds MAC addresses, EtherType `0800`, zero padding to a 46-byte minimum payload, and a four-byte CRC-32/FCS. CRC parameters: polynomial `04C11DB7` (reflected implementation `EDB88320`), initial/final XOR `FFFFFFFF`, reflected input/output. FCS covers destination MAC through padding; minimum frame length is 64 bytes excluding preamble/SFD.
- Presentation and session are **conceptual responsibilities**, provided by application software here. No extra layer-5/6 headers or TLS are invented. TCP connections are layer-4 mechanisms.

## Copper model

Both modes assume an established full-duplex twisted-pair link with suitable crossover/auto-MDI-X and two active pairs, one per direction. The connector is 8P8C, commonly called RJ45. No negotiation, link pulses, collision detection, or cable electrical characteristics are modeled.

**10BASE-T:** seven `55` preamble octets and `D5` SFD precede the frame. Octets serialize least significant bit first. Manchester encodes 1 as a low-to-high mid-bit transition and 0 as high-to-low, a documented polarity convention. Each bit lasts 100 ns; each half-bit lasts 50 ns.

**100BASE-TX:** low nibble precedes high nibble. Standard 4B/5B mappings produce code groups, J/K replaces the first preamble octet, and T/R ends the frame. The trace includes sixteen idle groups before J/K and twelve after T/R. A reproducible PN sequence with recurrence `s[n] = s[n−11] XOR s[n−9]`, initialized with eleven ones, is XORed with the code bits. This known-state teaching window does not claim to model a real continuously running PHY's exact startup state. Each scrambled 1 advances the MLT-3 phase `0 → +1 → 0 → −1 → 0`; 0 holds it. This is the net NRZI/MLT-3 transition rule. Code bits last 8 ns (125 million per second for 100 Mb/s data).

Both encoders calculate the full stream, while the UI shows a short selected window. Signal levels are normalized, not voltages. The known-state decoder assumes synchronization and recovers clean encoded frames for verification; it does not perform clock recovery, equalization, or general synchronization. No forward error correction is implied. CRC-32/FCS is a **layer-2** check, independent of the layer-1 waveform. A passing checksum detects no error; it does not guarantee an unchanged or authentic message.

Out of scope: real sockets, ARP, switches, routing, recursive DNS, fragmentation, segmentation across multiple packets, congestion control, arbitrary loss scheduling, TIME-WAIT timing, analog noise, and physical clock recovery. Playback and retransmission timeouts are teaching durations rather than performance measurements.

## Validation

From the repository root:

```sh
npm test
npm run build
npm run test:browser
BROWSER_PRODUCTION=1 npm run test:browser
```

Numerical tests cover an independent full Ethernet/TCP SYN fixture (Python `struct`/`zlib`), known checksum/CRC vectors, exact DNS serialization, padding and pseudoheaders, every single-bit error in a frame, layered checks, TCP sequence progression, faults and retries, input boundaries, all 4B/5B codes, scrambler recurrence, MLT-3 transitions, and frame encode/decode round trips. Browser tests cover transport/PHY switching, fields and waveforms, delivery/failure outcomes, playback/reset/input validation, keyboard/reduced-motion controls, and 390/768/1440 px layouts.

The shared Vite/TypeScript/test configuration includes this lab. Existing Docker and GitHub deployment checks include `/osi/`; no separate hosting service is introduced.

## References

- [HTTP/1.1 — RFC 9112](https://www.rfc-editor.org/rfc/rfc9112.html)
- [TCP — RFC 9293](https://www.rfc-editor.org/rfc/rfc9293.html)
- [UDP — RFC 768](https://www.rfc-editor.org/rfc/rfc768)
- [DNS — RFC 1035](https://www.rfc-editor.org/rfc/rfc1035)
- [Internet checksum — RFC 1071](https://www.rfc-editor.org/rfc/rfc1071)
- IEEE 802.3, Ethernet MAC framing and FCS
- [TI DP83847 PHY datasheet: Manchester, 4B/5B, scrambling and MLT-3](https://www.ti.com/lit/ds/symlink/dp83847.pdf)
