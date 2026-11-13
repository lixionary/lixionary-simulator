import { expect, it } from 'vitest';
import { buildPacket, dnsQuery, httpRequest } from './model';
import { layerBytes } from './inspector';

for (const protocol of ['tcp', 'udp'] as const) {
  it(`${protocol} exposes only the current encapsulation and maps local offsets to frame offsets`, () => {
    const packet = buildPacket('request', 'Request', protocol, 'out', protocol === 'tcp' ? httpRequest('/') : dnsQuery('lab.test'));
    const original = packet.frame.slice();
    const appOffset = protocol === 'tcp' ? 54 : 42;
    for (const layer of [7, 6, 5]) {
      expect(layerBytes(packet, layer, false)).toEqual({ name: protocol === 'tcp' ? 'HTTP message' : 'DNS message', frameOffset: appOffset, bytes: packet.payload });
    }
    expect(layerBytes(packet, 4, false)).toEqual({ name: protocol === 'tcp' ? 'TCP segment' : 'UDP datagram', frameOffset: 34, bytes: packet.transport });
    expect(layerBytes(packet, 3, false)).toEqual({ name: 'IPv4 packet', frameOffset: 14, bytes: packet.ip });
    for (const layer of [2, 1]) expect(layerBytes(packet, layer, false)).toEqual({ name: 'Ethernet frame', frameOffset: 0, bytes: packet.frame });
    expect(packet.frame).toEqual(original);
  });
  it(`${protocol} preserves received corruption at the correct local byte`, () => {
    const packet = buildPacket('request', 'Request', protocol, 'out', protocol === 'tcp' ? httpRequest('/') : dnsQuery('lab.test'), 0, 0, 0x18, 'corrupt');
    for (const layer of [1, 2, 3, 4, 5, 6, 7]) {
      const sent = layerBytes(packet, layer, false), received = layerBytes(packet, layer, true);
      const changed = Array.from(received.bytes).flatMap((byte, i) => byte === sent.bytes[i] ? [] : [i]);
      expect(changed).toEqual([14 + 20 + (protocol === 'tcp' ? 20 : 8) - received.frameOffset]);
      expect(received.bytes[changed[0]]).toBe(sent.bytes[changed[0]] ^ 1);
    }
  });
}

it('removes Ethernet padding and FCS together with its header on the way up', () => {
  const packet = buildPacket('syn', 'SYN', 'tcp', 'out', new Uint8Array(), 1000, 0, 2);
  expect(layerBytes(packet, 2, true).bytes).toHaveLength(64);
  expect(layerBytes(packet, 3, true).bytes).toHaveLength(40);
  expect(layerBytes(packet, 4, true).bytes).toHaveLength(20);
  expect(layerBytes(packet, 5, true).bytes).toHaveLength(0);
  expect(layerBytes(packet, 3, true).bytes).toEqual(packet.ip);
});
