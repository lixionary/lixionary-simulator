# Error Detection — Bit Lab

A browser-only lesson for curious beginners at `/error-detection/`. Enter eight payload bits, choose a method, and flip payload or check bits in the channel. The receiver validates the received frame without access to the original. A separate observer note explains whether corruption actually occurred and whether the check missed it.

## Teaching configurations

| Method | Sender | Receiver | Example blind spot |
| --- | --- | --- | --- |
| Even parity | Append one bit to make the total number of ones even | Count all received ones; even passes | Two flips restore even parity |
| Checksum | Add two four-bit words with end-around carry, then complement | Sum both received words and the check word; `1111` passes | Swapping the two payload words leaves the sum unchanged |
| CRC-3 teaching example | Append three zeros, divide by `1011` using XOR, append the remainder | Divide the received frame without adding zeros; remainder `000` passes | Flipping bits according to a shifted `1011` error pattern |

The calculations are exact. Short messages and small check widths simplify the presentation; detection results and calculation traces are produced by the algorithms, rather than scripted. Every check bit is transmitted and may also be flipped. Changing algorithms preserves payload corruption and clears check-bit corruption. Editing the message clears all flips and restarts the trace. Guided examples restore `10110010` for reproducibility. Input accepts exactly eight binary digits, ignoring whitespace; invalid input pauses the experiment and displays an inline error.

The walkthrough covers both sender and receiver calculations, with Previous/Next controls and a shortcut between phases. It first explains checksum groups and their binary/decimal values before starting a total at zero. All steps occupy the same grid cell, reserving the height of the tallest step at the current screen width so the navigation buttons stay in place. Presets demonstrate clean transmission, a detected single-bit flip, and an undetected error for each method. “No error detected” is a receiver verdict, never a guarantee that nothing changed.

## Real implementations

`src/algorithms.ts` exports pure calculation functions and their traces. The expandable code panel displays that actual source via Vite's raw import. “Run real example” computes the ASCII bytes of `123456789` using the same functions at practical widths:

- 16-bit Internet checksum: `0xF62A`. Bytes form words high-byte first. Pad an odd final byte with a zero low byte, wrap overflow carries, and complement the sum. Padding is used for calculation only. This follows [RFC 1071](https://www.rfc-editor.org/rfc/rfc1071).
- CRC-8/SMBUS: `0xF4`. Polynomial `0x07` (full division pattern `0x107`), initial remainder zero, no reflection, no final XOR. Tests cross-check the existing LTE codec over every possible playground payload.

The four-bit checksum is a teaching configuration, not an Internet packet checksum. The playground is explicitly named a CRC-3 teaching example: its generator `1011` represents x³ + x + 1, so its remainder has three bits even though the generator has four. The initial remainder is `000`, the final XOR value is `000`, and processing is MSB first without reflection. This short generator is chosen for teaching and is agreed by both ends; it is neither derived from the payload nor an initial XOR value. It is not a claim about any particular networking standard. There is no noise waveform, error correction, retransmission, authentication, or backend.

## Validation

Run from the repository root:

```sh
npm test
npm run build
npm run test:browser
BROWSER_PRODUCTION=1 npm run test:browser
```

Unit tests check independent numerical examples, all 256 payloads with single-bit errors at every frame position, checksum padding and carry, CRC-8 agreement with the LTE codec, and intentional undetected errors. Browser tests cover navigation, editing, keyboard flips, method switching, receiver versus observer outcomes, walkthroughs, presets, reset, source examples, and mobile/tablet/desktop layouts.
