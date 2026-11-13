# CPU Lab

An interactive 8-bit, MIPS-inspired teaching processor at `/cpu/`. It runs entirely in the browser, using the collection's React / TypeScript / Vite setup. This is a custom teaching architecture, not a MIPS emulator.

## Try it

From the repository root, run `npm run dev` and open `/cpu/`. The default program loads RAM address 16 (initially 7), adds five, and stores 12 at address 17. Use Next cycle or Run to follow the pipeline. Previous cycle and the history slider inspect recorded snapshots without executing again.

Choose a preset or edit assembly and select **Assemble & reset**. Edit initial register or RAM bytes using decimal, hexadecimal (`0xFF`), or signed byte values; Enter or leaving the field commits an edit and resets execution. Program edits require assembly. Hardware changes reset execution, retaining the same input bytes. Run pauses automatically at 10,000 cycles; manual stepping can continue. Reset clears history while retaining the selected program, settings, and initial bytes. Choosing a preset replaces the program and input bytes.

## Architecture

- Eight byte registers, r0–r7; r0 is hardwired to zero. Register arithmetic wraps modulo 256. The inspector shows binary, hex, unsigned decimal, and two's-complement signed decimal.
- 256 bytes of unsigned data RAM. Address calculation is unsigned base-register value plus a signed offset (−128 to 127). Addresses outside 0–255 fault rather than wrap. A base register allows access to all 256 bytes.
- Separate program storage, at most 256 instructions. The PC is the next instruction-slot index, not a byte address. There is no binary instruction encoding.
- Literals accept decimal or hex. LI accepts −128 to 255; ADDI and memory offsets accept −128 to 127. Labels are case-sensitive; instructions and registers are case-insensitive. Comments start with `#` or `;`.

| Instruction | Behavior |
| --- | --- |
| `LI rd, byte` | Write a byte literal |
| `ADD rd, ra, rb` | Add register bytes |
| `SUB rd, ra, rb` | Subtract rb from ra |
| `ADDI rd, ra, immediate` | Add a signed immediate |
| `LD rd, offset(base)` | Load one unsigned RAM byte |
| `ST rs, offset(base)` | Store one RAM byte |
| `BEQ ra, rb, label` | Branch when byte values are equal |
| `J label` | Unconditional branch |
| `NOP` | Retire without changing data |
| `HALT` | Stop younger work and drain the pipeline |

## Pipeline and timing

Five stages: IF (fetch), ID (decode/register read), EX (execute), MEM (data memory), WB (write-back). A straight-line program of N instructions takes N + 4 cycles with no hazards. Every cycle snapshot describes the work in that clock; an instruction writes its destination and retires in its WB cycle. Register write-back is available to decode in the same clock, for use by EX on the following clock.

Forwarding sends arithmetic results from MEM to EX and uses WB results through the register file, including branch operands, memory bases, and store data. An immediately dependent load-use pair needs one bubble with forwarding. Without forwarding, an adjacent consumer waits two cycles for register write-back. r0 creates no dependencies.

Branches resolve in EX with sequential fetching until resolution. Taken branches discard the instructions in IF and ID, then fetch the target on the next cycle. There is no branch delay slot or branch prediction. HALT also discards younger instructions. Wrong-path stores never reach MEM. Falling off the program drains the pipeline without a HALT.

A load/store occupies MEM for the selected 1–5 cycles. Additional RAM cycles hold IF, ID, and EX while WB drains; a store writes only once, when its memory access finishes. Runtime address faults discard the faulting and younger instructions after allowing older WB work to retire. No younger register write or RAM write commits.

CPI = cycles / retired instructions; IPC = retired instructions / cycles. NOP and HALT count as retired instructions, while flushed work does not. Dependency-stall and RAM-wait counters are mutually exclusive for a given clock. RAM-wait cycles count only the latency above the first access cycle. The flush counter includes younger instructions discarded by branches, HALT, and faults.

Completed successful runs are compared with the same assembled program and initial bytes under forwarding plus one-cycle RAM. Both runs use the same engine. The comparison is unavailable if either run faults or the default run exceeds 10,000 cycles. Animation speed changes playback only; it does not represent a physical clock frequency.

No caches, OS, interrupts, memory-mapped I/O, console instructions, multiplication/division, or physical gate delays are modeled.

## Implementation and checks

`src/model.ts` contains the assembler, pure `initialState` / `stepCycle` API, bounded `run`, and examples. `stepCycle` returns immutable architectural state, pipeline tokens, cycle events, memory transfers, and stall/flush information. RAM and register arrays share unchanged snapshots to keep history small. The UI shows an 18-cycle timeline window ending at the selected history snapshot, so large runs do not render thousands of columns.

`src/model.test.ts` checks exact timing, faults, squashes, immutability, and sequential equivalence under all hardware settings. Its independent sequential interpreter and deterministic mixed instruction programs check the pipeline's final state. `tests/cpu.spec.ts` covers the browser workflow and responsive layouts.

```sh
npm test
npm run build
npm run test:browser -- tests/cpu.spec.ts
BROWSER_PRODUCTION=1 npm run test:browser
```
