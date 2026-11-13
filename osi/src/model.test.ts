import { describe, expect, it } from 'vitest';
import { DEFAULTS, buildPacket, checksum, concat, crc32, dnsQuery, dnsResponse, httpRequest, httpResponse, inspectReceived, read16, read32, simulate, text, validateConfig } from './model';
import { CODES, decodeManchester, decodeMlt3, decodePhysical, encodePhysical, manchester, mlt3, scramble, wireBits } from './physical';
const bytes = (s: string) => Uint8Array.from(s.match(/../g)!.map(n => parseInt(n, 16)));
const toHex = (b: Uint8Array) => Array.from(b).map(n => n.toString(16).padStart(2, '0')).join('');

describe('wire serialization and checks', () => {
  it('matches a TCP SYN frame independently generated with Python struct and zlib', () => {
    const expected = '02000000001402000000000a080045000028000140004006b760c0a8010ac0a80114c0000050000003e8000000005002ffff683b000000000000000060f2c488';
    const p = buildPacket('syn', 'SYN', 'tcp', 'out', new Uint8Array(), 1000, 0, 2);
    expect(toHex(p.frame)).toBe(expected);
    expect(p.padding).toBe(6);
    expect(p.frame.length).toBe(64);
    expect(inspectReceived(bytes(expected))).toEqual({ fcs: true, ip: true, transport: true });
  });
  it('uses published checksum and CRC-32 known vectors, including odd-byte padding', () => {
    expect(checksum(bytes('0001f203f4f5f6f7'))).toBe(0x220D);
    expect(checksum(new TextEncoder().encode('123456789'))).toBe(0xF62A);
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xCBF43926);
    expect(crc32(new Uint8Array())).toBe(0);
    expect(checksum(bytes('ffff0001'))).toBe(0xFFFE);
  });
  it('serializes actual HTTP messages and byte-accurate Content-Length', () => {
    expect(text(httpRequest('/learn?q=osi'))).toBe('GET /learn?q=osi HTTP/1.1\r\nHost: lab.test\r\nConnection: close\r\n\r\n');
    const [head, body] = text(httpResponse()).split('\r\n\r\n');
    expect(head).toContain('Content-Length: ' + new TextEncoder().encode(body).length);
    expect(body).toBe('Hello from Packet Lab!\n');
  });
  it('serializes a DNS query and response with matching IDs and a compression pointer', () => {
    expect(toHex(dnsQuery('lab.test'))).toBe('123401000001000000000000036c616204746573740000010001');
    expect(toHex(dnsResponse('lab.test'))).toBe('123481800001000100000000036c616204746573740000010001c00c000100010000003c0004c000022a');
  });
  it('checks transport pseudoheaders for TCP and UDP in both directions', () => {
    for (const protocol of ['tcp', 'udp'] as const) for (const direction of ['out', 'back'] as const) for (const count of [1, 2, 19, 255]) {
      const p = buildPacket('data', 'data', protocol, direction, Uint8Array.from({ length: count }, (_, i) => i));
      expect(inspectReceived(p.frame)).toEqual({ fcs: true, ip: true, transport: true });
      expect(read16(p.ip, 2)).toBe(20 + p.transport.length);
      expect(read16(p.transport, direction === 'out' ? 2 : 0)).toBe(protocol === 'tcp' ? 80 : 53);
      if (protocol === 'udp') expect(read16(p.transport, 4)).toBe(8 + count);
      expect(p.frame.length).toBe(Math.max(64, 14 + p.ip.length + 4));
    }
  });
  it('discards every single-bit frame corruption, including check bits', () => {
    const p = buildPacket('data', 'data', 'udp', 'out', dnsQuery('lab.test'));
    for (let bit = 0; bit < p.frame.length * 8; bit++) {
      const f = p.frame.slice(); f[bit >>> 3] ^= 1 << (bit % 8);
      expect(inspectReceived(f)).toEqual({ fcs: false, ip: false, transport: false });
    }
  });
  it('can distinguish a bad transport checksum inside a valid Ethernet envelope', () => {
    const p = buildPacket('data', 'data', 'udp', 'out', dnsQuery('lab.test'));
    const f = p.frame.slice(); f[43] ^= 1;
    const crc = crc32(f.slice(0, -4));
    f.set([crc & 255, crc >>> 8 & 255, crc >>> 16 & 255, crc >>> 24], f.length - 4);
    expect(inspectReceived(f)).toEqual({ fcs: true, ip: true, transport: false });
  });
  it('validates the IPv4 header separately and rejects truncated frames', () => {
    expect(inspectReceived(new Uint8Array())).toEqual({ fcs: false, ip: false, transport: false });
    const p = buildPacket('data', 'data', 'udp', 'out', dnsQuery('lab.test'));
    const f = p.frame.slice(); f[22] ^= 1;
    const crc = crc32(f.slice(0, -4));
    f.set([crc & 255, crc >>> 8 & 255, crc >>> 16 & 255, crc >>> 24], f.length - 4);
    expect(inspectReceived(f)).toEqual({ fcs: true, ip: false, transport: false });
  });
});

describe('journey outcomes and transport state', () => {
  it('visits every conceptual layer in both directions without invented headers', () => {
    for (const protocol of ['tcp', 'udp'] as const) {
      const steps = simulate({ ...DEFAULTS, protocol });
      for (const id of ['request', 'response']) for (const side of ['sender', 'receiver']) expect(steps.filter(s => s.packet?.id === id && s.side === side && s.kind === 'layer').map(s => s.layer).sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
      expect(steps.at(-1)?.result).toBe('success');
      expect(steps.at(-1)?.packet?.direction).toBe('back');
      for (const s of steps) if (s.packet) expect(inspectReceived(s.packet.received).transport).toBe(true);
    }
  });
  it('tracks TCP byte sequence numbers, SYN, ACK, response, and FIN', () => {
    const steps = simulate(DEFAULTS);
    const packets = [...new Map(steps.filter(s => s.packet).map(s => [s.packet!.id, s.packet!])).values()];
    const byId = Object.fromEntries(packets.map(p => [p.id, p]));
    expect(packets.map(p => p.id)).toEqual(['syn', 'synack', 'established', 'request', 'requestack', 'response', 'responseack', 'fin', 'finack', 'serverfin', 'closed']);
    const clientEnd = 1001 + httpRequest('/').length, serverEnd = 5001 + httpResponse().length;
    expect(byId.synack.ack).toBe(1001);
    expect(byId.established.ack).toBe(5001);
    expect(byId.requestack.ack).toBe(clientEnd);
    expect(byId.response.seq).toBe(5001);
    expect(byId.response.ack).toBe(clientEnd);
    expect(byId.responseack.ack).toBe(serverEnd);
    expect(byId.closed.seq).toBe(clientEnd + 1);
    expect(byId.closed.ack).toBe(serverEnd + 1);
    expect(read32(byId.closed.transport, 8)).toBe(serverEnd + 1);
  });
  for (const fault of ['corrupt', 'drop'] as const) {
    it(`TCP recovers from ${fault} with identical bytes and sequence number`, () => {
      const steps = simulate({ ...DEFAULTS, fault });
      const request = steps.find(s => s.packet?.id === 'request')!.packet!;
      const retry = steps.find(s => s.packet?.id === 'retry')!.packet!;
      expect(retry.frame).toEqual(request.frame);
      expect(retry.seq).toBe(request.seq);
      expect(steps.filter(s => s.packet?.id === 'request' && s.side === 'receiver').map(s => s.layer)).toEqual(fault === 'corrupt' ? [1, 2] : []);
      expect(steps.filter(s => s.kind === 'timeout')).toHaveLength(1);
      expect(steps.at(-1)?.result).toBe('success');
    });
    it(`UDP times out after ${fault}, with no retry or response`, () => {
      const steps = simulate({ ...DEFAULTS, protocol: 'udp', fault });
      expect(steps.at(-1)).toMatchObject({ result: 'failure', layer: 7, kind: 'timeout' });
      expect(steps.some(s => s.packet && s.packet.id !== 'request')).toBe(false);
      expect(steps.filter(s => s.packet?.id === 'request' && s.side === 'receiver').map(s => s.layer)).toEqual(fault === 'corrupt' ? [1, 2] : []);
    });
  }
  it('validates application inputs, including boundaries, before simulation', () => {
    for (const path of ['/', '/a?x=2', '/' + 'x'.repeat(79)]) expect(validateConfig({ ...DEFAULTS, path })).toBe('');
    for (const path of ['', 'x', '/a b', '/a#fragment', '/bad%escape', '/\r\n', '/' + 'x'.repeat(80), '/é']) expect(validateConfig({ ...DEFAULTS, path })).not.toBe('');
    for (const name of ['a', 'lab.test', 'a'.repeat(63) + '.test']) expect(validateConfig({ ...DEFAULTS, protocol: 'udp', name })).toBe('');
    for (const name of ['', '.test', 'a..test', '-a.test', 'a-.test', 'a'.repeat(64), 'é.test', ['a'.repeat(63), 'a'.repeat(63), 'a'.repeat(63), 'a'.repeat(62)].join('.')]) expect(validateConfig({ ...DEFAULTS, protocol: 'udp', name })).not.toBe('');
    expect(() => simulate({ ...DEFAULTS, path: 'bad' })).toThrow();
  });
});

describe('copper encoding', () => {
  it('serializes Ethernet bits least significant bit first and encodes Manchester transitions', () => {
    expect(wireBits(bytes('d5'))).toEqual([1, 0, 1, 0, 1, 0, 1, 1]);
    expect(manchester([1, 0, 0, 1])).toEqual([-1, 1, 1, -1, 1, -1, -1, 1]);
    expect(decodeManchester(manchester([1, 0, 0, 1]))).toEqual([1, 0, 0, 1]);
    expect(() => decodeManchester([1, 1])).toThrow();
    expect(() => decodeManchester([1])).toThrow();
  });
  it('uses the standard sixteen 4B/5B data mappings', () => {
    expect(CODES.join(' ')).toBe('11110 01001 10100 10101 01010 01011 01110 01111 10010 10011 10110 10111 11010 11011 11100 11101');
    const frame = Uint8Array.from({ length: 256 }, (_, i) => i);
    const trace = encodePhysical(frame, '100base-tx');
    for (let i = 0; i < frame.length; i++) {
      const offset = trace.owners.indexOf(i);
      expect(trace.coded.slice(offset, offset + 10).join('')).toBe(CODES[i & 15] + CODES[i >>> 4]);
    }
    expect(trace.coded.slice(80, 90).join('')).toBe('1100010001');
    const tail = trace.owners.indexOf(frame.length);
    expect(trace.coded.slice(tail, tail + 10).join('')).toBe('0110100111');
  });
  it('matches the stated scrambler recurrence and reverses it with the same PN stream', () => {
    // Independent reference: polynomial long recurrence over an immutable history.
    const history = Array(11).fill(1);
    for (let n = 11; n < 111; n++) history[n] = history[n - 11] ^ history[n - 9];
    expect(scramble(Array(100).fill(0))).toEqual(history.slice(11));
    expect(scramble(Array(11).fill(0))).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    const input = wireBits(bytes('0123456789abcdef'));
    expect(scramble(scramble(input))).toEqual(input);
  });
  it('advances MLT-3 on a one and holds on a zero', () => {
    const input = [1, 1, 0, 1, 1, 1, 0, 1];
    expect(mlt3(input)).toEqual([1, 0, 0, -1, 0, 1, 1, 0]);
    expect(decodeMlt3(mlt3(input))).toEqual(input);
  });
  it('round-trips complete frames including padding/FCS at both line rates', () => {
    for (const phy of ['10base-t', '100base-tx'] as const) for (const frame of [Uint8Array.from({ length: 256 }, (_, i) => i), buildPacket('syn', 'SYN', 'tcp', 'out', new Uint8Array(), 1000, 0, 2).frame, buildPacket('dns', 'DNS', 'udp', 'out', dnsQuery('lab.test')).frame]) {
      const trace = encodePhysical(frame, phy);
      expect(decodePhysical(trace)).toEqual(frame);
      expect(trace.owners.length).toBe(trace.levels.length);
      expect(trace.tickNs).toBe(phy === '10base-t' ? 50 : 8);
      expect(trace.wire.slice(0, 8)).toEqual(bytes('55555555555555d5'));
      expect(concat(trace.wire.slice(8))).toEqual(frame);
    }
  });
});
