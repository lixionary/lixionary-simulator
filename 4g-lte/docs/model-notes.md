# Numerical conventions and teaching simplifications

The original `4g-simulator.md` remains unchanged. This implementation preserves its small teaching model while resolving its timing and mathematical inconsistencies. It is not a standards-compliant LTE modem.

## Source, framing, CRC, and coding

- ASCII input uses bytes 0–127 serialized MSB first, eight bits per character. Empty text, non-ASCII text, and more than 128 characters are rejected. Binary input ignores whitespace, requires 0/1 digits, and is limited to 1,024 bits. The engine preserves decoded byte values; non-printable or non-ASCII bytes are displayed as `·`, except newline.
- CRC-8 uses polynomial `0x07`; CRC-16 uses `0x1021`. Both use initial remainder zero, no reflection, no final XOR, and MSB-first polynomial division. This CRC-16 convention is XMODEM, not CCITT-FALSE. Check values for `123456789` are `0xF4` and `0x31C3`. Appending the remainder produces a zero remainder on verification.
- Hamming words use positions `[p1,p2,d1,p3,d2,d3,d4]`. Zero padding completes a four-bit input group. A syndrome identifies a position to flip. More than one error can cause miscorrection; the displayed count reports attempted corrections.
- Convolutional coding uses `(7,5)` generators, K=3, zero initial state, and two zero termination bits. Viterbi starts and ends in state `00`. Hard metrics count mismatches; soft metrics maximize correlation with signed LLRs. Termination bits are removed after decoding.
- Codewords fill enough sequential slots to hold the whole message. No puncturing or payload truncation is performed. Final-slot padding follows the codeword, is scrambled and transmitted, and is removed before FEC decoding. Payload, transport, codeword, and padding lengths are known framing metadata.
- Gold scrambling follows the length-31 recurrences with `Nc=1600`. `x1(0)=1` with remaining initial bits zero; `x2(i)` is bit `i` of the user’s direct 31-bit `c_init`. The seed is not automatically derived from LTE RNTI/cell/slot fields. One sequence covers the complete teaching transmission. Descrambling XORs hard bits or reverses the LLR sign where the Gold bit is one.

## Modulation and resources

- BPSK maps 0 to −1 and 1 to +1. For square QAM, even word bits form I and odd bits form Q. Each axis uses increasing binary-reflected Gray labels for ascending odd levels. Normalization factors are 1, √2, √10, √42, and √170 as documented.
- Physical row order is increasing frequency: `[-90,-75,-60,-45,-30,-15,+15,+30,+45,+60,+75,+90]` kHz, corresponding to FFT bins `[58,59,60,61,62,63,1,2,3,4,5,6]`. The grid displays positive frequencies at the top. DC bin 0 and bins 7–57 are zero: 51 guard bins, correcting the original receiver section's count of 50.
- Slots contain seven OFDM symbols for the 16-sample prefix, or six for the 32-sample prefix. CRS pilots are fixed `1+j0`, at documented row/symbol positions. Pilots take priority over optional one/two-column control allocations.
- Control symbols are deterministic QPSK teaching metadata, not encoded LTE DCI. PSS reserves the last column and SSS the penultimate column in slots 0 or 10 modulo 20. The start-slot selector selects 0 or 10 and subsequent slots advance in order.
- PSS uses twelve selected elements (`n=25..30,32..37`) of the document's root-25 Zadoff–Chu formula. SSS uses a short deterministic XOR of shifted length-31 m-sequences. Both illustrate resource reservation and are explicitly simplified; PSS/SSS acquisition, cell-ID detection, and control decoding are not simulated. CP-based symbol timing is implemented separately below.

## OFDM and time

- FFT and IFFT both use unitary `1/√64` normalization. This preserves energy and keeps time-domain and FFT-domain noise variance consistent.
- With 64 samples and 15 kHz spacing, sample rate is 960 kHz, sample period is 1.041667 μs, and useful symbol duration is 66.666667 μs.
- A 16-sample prefix lasts 16.666667 μs. Seven 80-sample symbols form a 583.333333 μs teaching slot. A 32-sample prefix lasts 33.333333 μs; six 96-sample symbols form a 600 μs teaching slot. These do not represent LTE’s actual prefix durations or 0.5 ms slot. They replace the conflicting timing claims in the original specification.
- The prefix copies the last useful samples exactly. Multipath convolution runs across the whole stream, including boundaries between slots; there is no reset or circular convolution at each symbol. The receiver observes the configured 64-sample FFT windows.
- PAPR is `10 log10(max |x|² / mean |x|²)` across the entire prefix-bearing transmitted stream. The selected-symbol envelope is an inspection plot, not the domain over which this global metric is computed. Discrete-sample PAPR is not an analog oversampled peak estimate.

## Channel

All phases below are radians. Preset taps use the document's reduced delays, with fixed phases chosen to produce repeatable multipath effects. Gains are amplitudes and are not power-normalized.

| Profile | Delays (samples) | Gains | Phases |
| --- | --- | --- | --- |
| AWGN | 0 | 1 | 0 |
| EPA | 0, 2, 5 | 1, 10^(−7/20), 10^(−15/20) | 0, 0.6, −1.1 |
| ETU | 0, 4, 10, 15 | 1, 0.85, 0.65, 0.45 | 0, 2.4, −0.9, 1.6 |

- Custom channels have 1–6 taps with integer delays 0–28, gains 0–1, and editable phase. At least one gain must be nonzero. A tap at exactly the prefix length remains within its protection.
- Profiles are static, reduced teaching models; they do not implement the standardized full EPA/ETU power-delay profiles or a spatial propagation model.
- CFO rotates samples continuously by `exp(j 2π ε n/64)`, including prefixes and slot boundaries. Here `n` is the absolute capture sample index, including arrival delay. ε ranges from −0.5 to +0.5, equivalent to ±7.5 kHz.
- Noise variance is `mean(|y_multipath|²) × 10^(−SNR/10)`. Independent real/imaginary Gaussian components each have half that variance. A seeded Mulberry32 generator and Box–Muller transform produce reproducible samples. Noise-off gives variance zero.
- Receiver CFO compensation selects either the exact configured offset (ideal correction) or a frequency-offset estimate from CP correlation (measured correction).

## CP timing acquisition

- Arrival delay adds 0–63 noise-only samples before the received signal. The capture retains the full final channel echo and adds 256 noise-only trailing samples. The main waveform plots remain aligned to the actual arrival for comparison; acquisition operates on the separate delayed capture.
- Defaults preserve ideal timing and known-offset CFO compensation. Ideal mode uses the configured arrival; manual mode uses a selected CP start in 0–95; CP mode uses the measured correlation peak. Switching timing changes the actual samples passed into the FFT, affecting equalization, decoding, EVM, BER, and CRC.
- For candidate CP start `d`, FFT length `N=64`, prefix `L`, and symbol stride `T=N+L`, compute `P(d)=Σ_s Σ_i conj(r[d+sT+i]) × r[d+sT+i+N]`, where `i=0..L−1`. Sum over up to eight available transmitted symbols. This uses only received samples and known symbol dimensions; it does not consult the transmitted payload, actual arrival delay, channel taps, or pilots.
- Normalize using `M(d)=|P(d)|²/(Eprefix(d) × Etail(d))`. This squared coherence lies between 0 and 1; energy products below `1e−20` yield zero. Search `d=0..T−1` and choose the largest metric, using the earliest index for exact ties. Strong/partial/weak labels use 0.7 and 0.3 as teaching thresholds, not calibrated lock probabilities.
- The capture is assumed to begin within the first symbol period, with known FFT/prefix lengths and framing metadata. Repetition identifies symbol timing phase; CP alone cannot identify frame boundaries, slot numbers, or a cell. PSS/SSS would provide additional identity and acquisition information in a complete LTE receiver.
- FFT symbol `s` starts at `d_used+sT+L`, then reads 64 samples. The detector is a coarse timing estimator: noise, sparse occupied bandwidth, or multipath can broaden or displace the peak. A high repetition score does not guarantee successful decoding.
- The theoretical guard-protected range for a CP-start assumption is `[arrival+maxTapDelay−L, arrival+minTapDelay]`. These bounds use ground truth solely to explain the chosen FFT window; they are not used by the detector. A start within this range prevents inter-symbol spill under the static model, but pilot interpolation can still leave errors. If the lower bound exceeds the upper bound, no choice fully protects the FFT window.
- Fractional CFO is `ε_hat=arg(P(d_peak))/(2π)`; the corresponding frequency is `ε_hat × 15 kHz`. Because samples are separated by 64, the estimate is ambiguous at the ±0.5-subcarrier endpoints and beyond. Its unambiguous range is strictly within ±7.5 kHz. Timing error, interference, and noise affect the phase estimate.
- With CP-based CFO correction enabled, rotate the absolute capture by `exp(−j2π ε_hat n/64)` before extracting FFT windows. The actual configured CFO does not enter this correction.
- The receiver view animates a probe over already computed candidates. Probe windows and selected sample pairs use actual captured samples, including idle noise. The displayed waveform pair is from the inspected symbol; the detection score averages the first up to eight symbols. Applying the probe selects manual timing; applying CP synchronization selects measured timing.
- True channel response plots use nominal transmit timing. Pilot estimates also contain the phase slope introduced by any offset of the receiver's FFT window.

## Receiver and metrics

- LS estimates divide received pilots by their known unit value. Frequency interpolation uses physical frequency positions, accounting for the omitted DC carrier; edges clamp to the nearest pilot. Time interpolation occurs between the two pilot-bearing symbols and clamps outside them. Interpolation operates on complex values, not wrapped phase.
- True `H(k)=Σ αp exp(−j2π bin(k)τp/64)` is used only for comparison plots and tests. Equalization uses received-pilot estimates. Sparse interpolation can leave residual error even without AWGN and with sufficient prefix.
- ZF uses `H* / |H|²`; MMSE uses `H* / (|H|² + σ²)` with unit symbol energy and actual FFT-domain noise variance. Denominators are floored at `1e−12`. This corrects the document's use of `1/SNR` without accounting for occupied subcarriers and time-domain power.
- MMSE shrinks the constellation. Demapping compares symbols with the correspondingly scaled reference constellation and uses post-equalization variance `σ² |W|²`, avoiding wrong decision thresholds for high-order QAM.
- Max-log LLR is `(min distance to bit-1 points − min distance to bit-0 points) / σ_eq²`. Positive therefore favors zero, matching the document's intended semantics while correcting its reversed equation. Variance floors and ±1e6 confidence limits keep noise-off and near-null cases finite.
- Soft confidence is computed in all modes for teaching. Hamming uses hard syndrome decoding; only soft Viterbi uses confidence magnitudes.
- Pre-FEC BER compares received descrambled codeword bits with the transmitted codeword, including termination/coding padding but excluding resource padding. Post-FEC BER compares the decoded transport block (payload plus CRC), excluding coding tails and all padding.
- EVM compares equalized and original transmitted symbols over codeword-bearing data elements, excluding pure resource-padding symbols. The final partial symbol may include tracked padding bits. The displayed EVM retains MMSE shrinkage.
- CRC disabled reports “Not checked”. Failed CRC reports NACK/requested retransmission, without actually simulating HARQ. CRC can miss some error patterns; actual comparison BER remains visible independently.
- The Viterbi diagram illustrates connectivity only, not a computed survivor path. The radio illustration animates packet flow through a computed transmission; playback selects actual data symbols and never changes the underlying samples.

## References

- [3GPP TS 36.211 / ETSI TS 136 211, physical channels and modulation](https://www.etsi.org/deliver/etsi_ts/136200_136299/136211/15.08.01_60/ts_136211v150801p.pdf)
- [MathWorks: digital baseband modulation and LLR definition](https://www.mathworks.com/help/comm/ug/digital-baseband-modulation.html)
- [MathWorks: LTE frequency offset and timing correlation from cyclic prefixes](https://www.mathworks.com/help/lte/ref/ltefrequencyoffset.html)

The simulator intentionally omits RF carrier generation, antennas/MIMO, mobility geometry, MAC scheduling, full LTE coding/rate matching, cell/frame acquisition, and automatic retransmission. It computes the documented baseband teaching pipeline and CP-based symbol timing entirely in the browser.
