import { binary, checksum, crc, evenParity, onesComplementSum, type Step } from './algorithms';

export type Algorithm = 'parity' | 'checksum' | 'crc';
export const DEFAULT_MESSAGE = '10110010';
export const ALGORITHMS = {
  parity: { name: 'Parity', subtitle: 'Count the ones', width: 1, idea: 'One extra bit makes the number of ones even. If the count turns odd, something changed.', rule: 'An even total passes the check.', limit: 'Any even number of bit flips can slip past parity.', parameter: 'Even parity · 1 check bit' },
  checksum: { name: 'Checksum', subtitle: 'Add the message’s groups', width: 4, idea: 'Split your eight message bits into two groups of four. Each group represents a number. Add those two numbers, wrap any carry around, then flip the total’s bits to make the checksum.', rule: 'Add the two received groups and the checksum. A total of 1111 means the check passes.', limit: 'Changes that cancel out in the total can go unnoticed. Swapping the two message groups is one example.', parameter: '4-bit groups · one’s complement' },
  crc: { name: 'CRC-3', subtitle: 'A tiny teaching example', width: 3, idea: 'This CRC-3 teaching example produces three check bits. Divide using the agreed pattern 1011 and XOR, then attach the remainder so the full message divides evenly.', rule: 'A zero remainder means the check passes.', limit: 'An error pattern divisible by the generator can slip through. Our tiny CRC makes this easy to explore.', parameter: 'CRC-3 teaching example · generator 1011' },
} satisfies Record<Algorithm, { name: string; subtitle: string; width: number; idea: string; rule: string; limit: string; parameter: string }>;

export function parseMessage(input: string): number[] {
  const normalized = input.replace(/\s/g, '');
  if (!/^[01]{8}$/.test(normalized)) throw new Error('Enter exactly 8 binary digits (0 or 1). Spaces and newlines are okay.');
  return [...normalized].map(Number);
}

export function simulate(payload: number[], algorithm: Algorithm, flipped: ReadonlySet<number> = new Set()) {
  if (payload.length !== 8) throw new Error('The playground uses exactly 8 payload bits.');
  let check: number[], sender: Step[], receiver: Step[], passed: boolean;
  if (algorithm === 'parity') {
    const result = evenParity(payload);
    check = [result.bit]; sender = result.steps;
  } else if (algorithm === 'checksum') {
    const result = checksum(payload, 4);
    check = result.bits; sender = result.steps;
  } else {
    const result = crc(payload, 3, 0b1011);
    check = result.remainder; sender = result.steps;
  }
  const sent = [...payload, ...check];
  const received = sent.map((bit, index) => bit ^ Number(flipped.has(index)));
  if (algorithm === 'parity') {
    const result = evenParity(received);
    passed = result.ones % 2 === 0;
    receiver = [...result.steps.slice(0, -1), { title: 'Check the total', detail: `${result.ones} ones is ${passed ? 'even: the check passes' : 'odd: an error is detected'}.`, calculation: `${result.ones} mod 2 = ${result.ones % 2}` }];
  } else if (algorithm === 'checksum') {
    const words = [0, 4, 8].map(index => parseInt(received.slice(index, index + 4).join(''), 2));
    const result = onesComplementSum(words, 4);
    passed = result.sum === 15;
    receiver = [
      { title: 'Read the received groups and checksum', detail: 'Split the received frame into groups of four. Groups 1 and 2 contain the received message; group 3 contains the received checksum. Add all three to test whether the total is still 1111.', calculation: `Message group 1: ${binary(words[0], 4)} (${words[0]})\nMessage group 2: ${binary(words[1], 4)} (${words[1]})\nChecksum group:  ${binary(words[2], 4)} (${words[2]})` },
      ...result.steps,
      { title: 'Look for all ones', detail: passed ? 'The total is 1111, so the check passes.' : 'The total is not 1111, so an error is detected.', calculation: `${binary(result.sum, 4)} ${passed ? '=' : '≠'} 1111` },
    ];
  } else {
    const result = crc(received, 3, 0b1011, false);
    passed = result.value === 0;
    receiver = [...result.steps, { title: 'Check the remainder', detail: passed ? 'The remainder is zero, so the check passes.' : 'The remainder is nonzero, so an error is detected.', calculation: `${result.remainder.join('')} ${passed ? '=' : '≠'} 000` }];
  }
  const changed = received.some((bit, index) => bit !== sent[index]);
  return { sent, received, check, passed, changed, missed: passed && changed, changedCount: received.filter((bit, index) => bit !== sent[index]).length,
    steps: [...sender.map(step => ({ ...step, phase: 'Sender' })), ...receiver.map(step => ({ ...step, phase: 'Receiver' }))] };
}

export function exampleFlips(algorithm: Algorithm, example: 'clean' | 'single' | 'miss', payload: number[]): Set<number> {
  if (example === 'clean') return new Set();
  if (example === 'single') return new Set([0]);
  if (algorithm === 'parity') return new Set([0, 1]);
  if (algorithm === 'crc') return new Set([0, 2, 3]); // Error polynomial 1011 followed by zeros.
  return new Set(payload.flatMap((bit, index) => bit !== payload[(index + 4) % 8] ? [index] : []));
}
