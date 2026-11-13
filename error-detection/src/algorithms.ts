/** Actual calculation code, also displayed in the lab's source panel. Bits are MSB first. */
export type Step = { title: string; detail: string; calculation: string };
export const binary = (value: number, width: number) => value.toString(2).padStart(width, '0');

export function validateBits(bits: number[]) {
  if (!bits.length || bits.some(bit => bit !== 0 && bit !== 1)) throw new Error('Expected a nonempty array of binary digits.');
}

export function evenParity(bits: number[]) {
  validateBits(bits);
  let ones = 0;
  const steps: Step[] = bits.map((bit, index) => {
    ones += bit;
    return { title: `Count bit ${index + 1}`, detail: `Read ${bit}. There ${ones === 1 ? 'is' : 'are'} now ${ones} ${ones === 1 ? 'one' : 'ones'}.`, calculation: `${bits.slice(0, index + 1).join('')} → ${ones} ones` };
  });
  const bit = ones % 2;
  steps.push({ title: 'Find the parity bit', detail: `${ones} is ${bit ? 'odd, so append 1' : 'even, so append 0'} to make the total even.`, calculation: `${bits.join('')} + [${bit}] → ${ones + bit} ones` });
  return { bit, ones, steps };
}

/** End-around carry: each overflow is added back at the right-hand end. */
export function onesComplementSum(words: number[], width: 4 | 16) {
  const mask = 2 ** width - 1;
  if (!words.length || words.some(word => !Number.isInteger(word) || word < 0 || word > mask)) throw new Error('Words must fit the selected width.');
  let sum = 0;
  const steps: Step[] = [{ title: 'Start the total at zero', detail: 'No groups have been added yet, so the total starts at zero. This zero is just an empty total, not an extra part of the message.', calculation: `Total: ${binary(0, width)} (0)` }];
  words.forEach((word, index) => {
    const previous = sum;
    sum += word;
    steps.push({ title: `Add group ${index + 1} to the total`, detail: `Group ${index + 1} is ${binary(word, width)} in binary, which means ${word} in decimal. Add this group’s value to the total so far (${previous}). The binary and decimal lines show the same addition.`, calculation: `Binary:  ${binary(previous, width)} + ${binary(word, width)} = ${binary(sum, width)}\nDecimal: ${previous} + ${word} = ${sum}` });
    while (sum > mask) {
      const carry = Math.floor(sum / (mask + 1)), low = sum & mask;
      sum = low + carry;
      steps.push({ title: 'Wrap the carry around', detail: `The result needs more than ${width} bits. Keep the rightmost ${width} bits and add the extra left-hand bit back into the total. This is called end-around carry.`, calculation: `Keep:  ${binary(low, width)}\nCarry: ${binary(carry, width)}\nAdd:   ${binary(low, width)} + ${binary(carry, width)} = ${binary(sum, width)}` });
    }
  });
  return { sum, steps };
}

/** Pad a partial final word on the right with zeros; padding is not transmitted. */
export function checksum(bits: number[], width: 4 | 16) {
  validateBits(bits);
  const words: number[] = [];
  for (let index = 0; index < bits.length; index += width) {
    words.push(parseInt(bits.slice(index, index + width).join('').padEnd(width, '0'), 2));
  }
  const result = onesComplementSum(words, width);
  const value = result.sum ^ (2 ** width - 1);
  const groups = words.map((word, index) => `Group ${index + 1}: ${binary(word, width)}`);
  const values = words.map((word, index) => {
    const placeValues = [...binary(word, width)].flatMap((bit, bitIndex) => bit === '1' ? [2 ** (width - bitIndex - 1)] : []);
    const expansion = placeValues.length > 1 ? `${placeValues.join(' + ')} = ` : '';
    return `Group ${index + 1}: ${binary(word, width)} = ${expansion}${word}`;
  });
  const steps = [
    { title: `Split the message into ${width}-bit groups`, detail: `Each group comes straight from the message. A “word” in checksum terminology just means one group of bits. We will add the numbers represented by these groups.${bits.length % width ? ' Pad the final group on the right with zeros for the calculation only.' : ''}`, calculation: groups.join('\n') },
    { title: 'Read the groups as numbers', detail: 'Binary uses place values, just like decimal. Read the bits from right to left as 1, 2, 4, 8, and so on. Add the place values where a bit is 1. These are the message bits written as numbers, not extra numbers we chose.', calculation: values.join('\n') },
    ...result.steps,
    { title: 'Flip the total’s bits to make the checksum', detail: 'Change every 0 to 1 and every 1 to 0. This is called the one’s complement. The total and its checksum now add up to all ones; that is what the receiver will check.', calculation: `Total:    ${binary(result.sum, width)} (${result.sum})\nChecksum: ${binary(value, width)} (${value})\nTogether: ${binary(2 ** width - 1, width)} (${2 ** width - 1})` },
  ];
  return { value, bits: [...binary(value, width)].map(Number), words, steps };
}

/** Polynomial long division over GF(2): XOR takes the place of subtraction.
 * The polynomial includes its leading 1. Initial zero; no reflection or final XOR.
 */
export function crc(bits: number[], width: number, polynomial: number, appendZeros = true) {
  validateBits(bits);
  if (!Number.isInteger(width) || width < 1 || width > 16 || !Number.isInteger(polynomial) || polynomial < 2 ** width || polynomial >= 2 ** (width + 1) || polynomial % 2 !== 1) throw new Error('Use a degree-1 to degree-16 polynomial with leading and trailing 1.');
  const work = [...bits, ...Array(appendZeros ? width : 0).fill(0)];
  while (work.length < width) work.unshift(0);
  const divisor = [...binary(polynomial, width + 1)].map(Number);
  const steps: Step[] = [
    { title: 'Start with the agreed CRC settings', detail: `This CRC produces ${width} check bits. Sender and receiver agree on the divisor ${divisor.join('')} before sending anything. The initial remainder and final XOR value are both zero. The divisor is not an initial XOR value or a number taken from the message.`, calculation: `Divisor: ${divisor.join('')}\nInitial remainder: ${binary(0, width)}\nFinal XOR: ${binary(0, width)}` },
    { title: appendZeros ? `Make room for ${width} check bits` : 'Divide the received frame', detail: appendZeros ? `Append ${width} zeros before dividing by ${divisor.join('')}. These spaces will hold the ${width}-bit remainder.` : `Divide the complete received frame by ${divisor.join('')}. No extra zeros this time.`, calculation: work.join('') },
    { title: 'Use XOR instead of subtraction', detail: 'XOR compares two bits: equal bits give 0, different bits give 1. There is no carry or borrowing. At each division step, line up the divisor with the next 1 and XOR those bits.', calculation: '0 XOR 0 = 0\n1 XOR 1 = 0\n0 XOR 1 = 1\n1 XOR 0 = 1' },
  ];
  for (let index = 0; index < work.length - width; index++) {
    const before = work.join('');
    if (work[index]) {
      for (let j = 0; j <= width; j++) work[index + j] ^= divisor[j];
      steps.push({ title: `XOR at position ${index + 1}`, detail: 'Line up the generator with this 1. Equal bits become 0; different bits become 1.', calculation: `${before}\n${' '.repeat(index)}${divisor.join('')}  XOR\n${'─'.repeat(work.length)}\n${work.join('')}` });
    } else {
      steps.push({ title: `Skip position ${index + 1}`, detail: 'This bit is already zero. Move one place to the right.', calculation: `${before}\n${' '.repeat(index)}↑ skip 0` });
    }
  }
  const remainder = work.slice(-width);
  steps.push({ title: 'Read the remainder', detail: `The last ${width} bits are the remainder.`, calculation: remainder.join('') });
  return { remainder, value: parseInt(remainder.join(''), 2), steps };
}

/** Byte order is preserved, with the high byte of each 16-bit word first. */
export function byteBits(bytes: Uint8Array): number[] {
  return Array.from(bytes).flatMap(byte => [...binary(byte, 8)].map(Number));
}
