export type Protocol = 'tcp' | 'udp';
export type Phy = '10base-t' | '100base-tx';
export type Fault = 'clean' | 'corrupt' | 'drop';
export type Config = { protocol: Protocol; phy: Phy; fault: Fault; path: string; name: string };
export const DEFAULTS: Config = { protocol: 'tcp', phy: '10base-t', fault: 'clean', path: '/', name: 'lab.test' };
export const CLIENT = { ip: [192, 168, 1, 10], mac: [2, 0, 0, 0, 0, 10], port: 49152 };
export const SERVER = { ip: [192, 168, 1, 20], mac: [2, 0, 0, 0, 0, 20] };
export const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
const ascii = (s: string) => new TextEncoder().encode(s);
export const hex = (n: number, width = 2) => n.toString(16).toUpperCase().padStart(width, '0');
export const concat = (...parts: (Uint8Array | number[])[]) => Uint8Array.from(parts.flatMap(p => Array.from(p)));
const u16 = (n: number) => [n >>> 8 & 255, n & 255];
const u32 = (n: number) => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
export const read16 = (b: Uint8Array, o: number) => b[o] * 256 + b[o + 1];
export const read32 = (b: Uint8Array, o: number) => (b[o] * 16777216 + b[o + 1] * 65536 + b[o + 2] * 256 + b[o + 3]) >>> 0;

export function validateConfig(c: Config) {
  if (c.protocol === 'tcp' && (!/^\/[\x21-\x7E]{0,79}$/.test(c.path) || c.path.includes('#') || /%(?![0-9a-fA-F]{2})/.test(c.path))) return 'Use a path beginning with /, up to 80 printable ASCII characters, without spaces or # fragments. Encode percent escapes as %HH.';
  if (c.protocol === 'udp' && (c.name.length > 253 || !c.name.split('.').every(label => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label)))) return 'Use a domain such as lab.test: labels of 1–63 letters, digits, or interior hyphens; up to 253 characters.';
  return '';
}

/** RFC 1071: odd input is padded for calculation only. */
export function checksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < bytes.length; i += 2) sum += (bytes[i] << 8) + (bytes[i + 1] ?? 0);
  while (sum >>> 16) sum = (sum & 65535) + (sum >>> 16);
  return (~sum) & 65535;
}
/** Ethernet CRC-32: reflected 0x04C11DB7, init/xorout FFFFFFFF. */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
export function httpRequest(path: string) { return ascii(`GET ${path} HTTP/1.1\r\nHost: lab.test\r\nConnection: close\r\n\r\n`); }
export function httpResponse() {
  const body = 'Hello from Packet Lab!\n';
  return ascii(`HTTP/1.1 200 OK\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: ${ascii(body).length}\r\nConnection: close\r\n\r\n${body}`);
}
export function dnsQuery(name: string) {
  const question = concat(...name.split('.').map(label => concat([label.length], ascii(label))), [0, 0, 1, 0, 1]);
  return concat([0x12, 0x34, 0x01, 0, 0, 1, 0, 0, 0, 0, 0, 0], question);
}
export function dnsResponse(name: string) {
  return concat([0x12, 0x34, 0x81, 0x80, 0, 1, 0, 1, 0, 0, 0, 0], dnsQuery(name).slice(12), [0xC0, 0x0C, 0, 1, 0, 1, 0, 0, 0, 60, 0, 4, 192, 0, 2, 42]);
}
export type Packet = {
  id: string; title: string; direction: 'out' | 'back'; protocol: Protocol; payload: Uint8Array;
  transport: Uint8Array; ip: Uint8Array; frame: Uint8Array; received: Uint8Array;
  seq: number; ack: number; flags: number; fault: Fault; padding: number;
};
export function buildPacket(id: string, title: string, protocol: Protocol, direction: 'out' | 'back', payload = new Uint8Array(), seq = 0, ack = 0, flags = 0x18, fault: Fault = 'clean'): Packet {
  const out = direction === 'out';
  const source = out ? CLIENT : SERVER, dest = out ? SERVER : CLIENT;
  const service = protocol === 'tcp' ? 80 : 53;
  const sport = out ? CLIENT.port : service, dport = out ? service : CLIENT.port;
  const header = protocol === 'tcp'
    ? concat(u16(sport), u16(dport), u32(seq), u32(ack), [0x50, flags], u16(65535), [0, 0, 0, 0])
    : concat(u16(sport), u16(dport), u16(8 + payload.length), [0, 0]);
  const transport = concat(header, payload);
  const pseudo = concat(source.ip, dest.ip, [0, protocol === 'tcp' ? 6 : 17], u16(transport.length));
  const check = checksum(concat(pseudo, transport)) || (protocol === 'udp' ? 65535 : 0);
  transport.set(u16(check), protocol === 'tcp' ? 16 : 6);
  const ipHeader = concat([0x45, 0], u16(20 + transport.length), [0, 1, 0x40, 0, 64, protocol === 'tcp' ? 6 : 17, 0, 0], source.ip, dest.ip);
  ipHeader.set(u16(checksum(ipHeader)), 10);
  const ip = concat(ipHeader, transport);
  const padding = Math.max(0, 46 - ip.length);
  const body = concat(dest.mac, source.mac, [8, 0], ip, new Uint8Array(padding));
  const crc = crc32(body);
  const frame = concat(body, [crc & 255, crc >>> 8 & 255, crc >>> 16 & 255, crc >>> 24]);
  const received = frame.slice();
  // Teaching fault applied after PHY decoding, in the first application byte.
  if (fault === 'corrupt') received[14 + 20 + header.length] ^= 1;
  return { id, title, direction, protocol, payload, transport, ip, frame, received, seq, ack, flags, fault, padding };
}
export function inspectReceived(frame: Uint8Array) {
  if (frame.length < 64) return { fcs: false, ip: false, transport: false };
  const o = frame.length - 4;
  const receivedCrc = (frame[o] + frame[o + 1] * 256 + frame[o + 2] * 65536 + frame[o + 3] * 16777216) >>> 0;
  const fcs = crc32(frame.slice(0, o)) === receivedCrc;
  if (!fcs || read16(frame, 12) !== 0x0800) return { fcs, ip: false, transport: false };
  const ip = frame.slice(14, 14 + read16(frame, 16));
  const ihl = (ip[0] & 15) * 4;
  if (ihl !== 20 || ip.length < ihl || ip.length !== read16(ip, 2) || checksum(ip.slice(0, ihl)) !== 0) return { fcs, ip: false, transport: false };
  const segment = ip.slice(ihl);
  const valid = checksum(concat(ip.slice(12, 20), [0, ip[9]], u16(segment.length), segment)) === 0;
  return { fcs, ip: true, transport: valid };
}

export const LAYERS = [
  { n: 7, name: 'Application', unit: 'Message', short: 'Give the message meaning.', detail: 'HTTP requests a resource; DNS asks for an address. The application understands the message and decides what to do with it.' },
  { n: 6, name: 'Presentation', unit: 'Representation', short: 'Agree on a representation.', detail: 'HTTP uses a text message format and a UTF-8 response body. DNS uses binary fields and length-prefixed name labels. These functions live in application software here; there is no extra layer-6 header or TLS.' },
  { n: 5, name: 'Session', unit: 'Conversation', short: 'Keep track of the conversation.', detail: 'HTTP relates a request to its response; DNS uses a transaction ID. These are conceptual session responsibilities, handled by the applications here. A TCP connection is a layer-4 mechanism, not a separate session header.' },
  { n: 4, name: 'Transport', unit: 'Segment / datagram', short: 'Reach the right process.', detail: 'Ports identify application endpoints. TCP adds connection setup, byte sequence numbers, acknowledgments, and retransmission. UDP sends independent datagrams with a checksum and no transport retry.' },
  { n: 3, name: 'Network', unit: 'IPv4 packet', short: 'Address the destination host.', detail: 'IPv4 carries source and destination IP addresses, a protocol number, and a header checksum. Both hosts are on the same subnet in this experiment; there is no router.' },
  { n: 2, name: 'Data link', unit: 'Ethernet frame', short: 'Wrap it for the local link.', detail: 'Ethernet II adds destination and source MAC addresses, EtherType, minimum-length padding when needed, and a CRC-32 frame check sequence. A receiver discards a frame with a bad FCS. Ethernet does not retransmit it.' },
  { n: 1, name: 'Physical', unit: 'Electrical signal', short: 'Turn bits into transitions.', detail: 'The PHY encodes and decodes signals on twisted-pair copper. 10BASE-T uses Manchester; 100BASE-TX uses 4B/5B, scrambling, and MLT-3. Coding helps signal transmission; it does not repair corrupted frames.' },
];
export type Step = { title: string; detail: string; layer: number; side: 'sender' | 'receiver' | 'wire'; packet?: Packet; kind: 'layer' | 'control' | 'timeout' | 'outcome'; result?: 'success' | 'failure' };
export function simulate(config: Config): Step[] {
  const error = validateConfig(config);
  if (error) throw new Error(error);
  const steps: Step[] = [];
  const tcp = config.protocol === 'tcp';
  const control = (id: string, title: string, dir: 'out' | 'back', seq: number, ack: number, flags: number, detail: string) => {
    steps.push({ title, detail, layer: 4, side: 'wire', kind: 'control', packet: buildPacket(id, title, 'tcp', dir, new Uint8Array(), seq, ack, flags) });
  };
  function journey(packet: Packet) {
    const request = packet.direction === 'out';
    for (const layer of LAYERS) steps.push({ title: `${request ? 'Client' : 'Server'} · ${layer.name}`, detail: layer.short + ' ' + (layer.n === 7 ? packet.title : layer.detail), layer: layer.n, side: 'sender', kind: 'layer', packet });
    steps.push({ title: packet.fault === 'drop' ? 'Frame lost in transit' : 'Across the copper', detail: packet.fault === 'drop' ? 'This frame never arrives. The receiver sends no transport acknowledgment.' : packet.fault === 'corrupt' ? 'Teaching impairment: flip one decoded application-data bit after PHY decoding. Keep the original FCS. This is a bit-error abstraction, not analog noise.' : 'The receiver decodes the electrical signal back into frame bits.', layer: 1, side: 'wire', kind: 'layer', packet });
    if (packet.fault === 'drop') return;
    const checks = inspectReceived(packet.received);
    for (const layer of [...LAYERS].reverse()) {
      const failed = layer.n === 2 && !checks.fcs;
      steps.push({ title: failed ? 'Bad FCS · discard frame' : `${request ? 'Server' : 'Client'} · ${layer.name}`, detail: failed ? 'CRC-32 over the received frame does not match its FCS. Discard at layer 2; no IPv4 packet, transport data, or application message is delivered.' : layer.n === 2 ? 'CRC-32 matches the received FCS. Remove the Ethernet envelope and deliver the IPv4 packet.' : layer.n === 3 ? 'IPv4 header checksum passes. Read protocol ' + (tcp ? '6 for TCP.' : '17 for UDP.') : layer.n === 4 ? 'Transport checksum passes. ' + (tcp ? 'Sequence numbers identify these bytes in the stream.' : 'Deliver the datagram to ' + (request ? 'DNS port 53.' : 'the client port.')) : layer.n === 7 ? (request ? 'The server receives and understands the request.' : 'The client receives the response. ' + (tcp ? 'HTTP status: 200 OK.' : 'DNS answer: 192.0.2.42.')) : layer.detail, layer: layer.n, side: 'receiver', kind: 'layer', packet });
      if (failed) break;
    }
  }
  if (tcp) {
    control('syn', 'SYN · open a connection', 'out', 1000, 0, 2, 'Client port 49152 → server port 80. Initial sequence number 1000; SYN consumes one sequence number.');
    control('synack', 'SYN + ACK · accept', 'back', 5000, 1001, 0x12, 'Server acknowledges 1001 and offers initial sequence number 5000.');
    control('established', 'ACK · connection established', 'out', 1001, 5001, 0x10, 'Both ends can now exchange bytes. Pure ACKs consume no sequence numbers.');
  }
  const request = tcp ? httpRequest(config.path) : dnsQuery(config.name);
  journey(buildPacket('request', tcp ? 'HTTP GET ' + config.path : 'DNS A query · ' + config.name, config.protocol, 'out', request, tcp ? 1001 : 0, tcp ? 5001 : 0, 0x18, config.fault));
  if (config.fault !== 'clean') {
    steps.push({ title: tcp ? 'No ACK · retransmission timeout' : 'DNS application timeout', detail: tcp ? 'No acknowledgment arrived for the request bytes. After a shortened teaching timeout, TCP resends the same bytes with the same sequence number. The one-time fault is now gone.' : 'UDP provides no acknowledgment or automatic retry. The DNS application gives up after a shortened teaching timeout; application-level retries are disabled in this lesson.', layer: tcp ? 4 : 7, side: 'sender', kind: 'timeout', result: tcp ? undefined : 'failure' });
    if (!tcp) return steps;
    journey(buildPacket('retry', 'TCP retransmission · same HTTP request bytes', 'tcp', 'out', request, 1001, 5001));
  }
  const nextClient = 1001 + request.length;
  if (tcp) control('requestack', 'ACK · request bytes received', 'back', 5001, nextClient, 0x10, `Server expects client byte ${nextClient}. The TCP acknowledgment confirms bytes, not application processing.`);
  const response = tcp ? httpResponse() : dnsResponse(config.name);
  const responsePacket = buildPacket('response', tcp ? 'HTTP/1.1 200 OK' : 'DNS A answer · 192.0.2.42', config.protocol, 'back', response, tcp ? 5001 : 0, tcp ? nextClient : 0);
  journey(responsePacket);
  if (tcp) {
    const nextServer = 5001 + response.length;
    control('responseack', 'ACK · response bytes received', 'out', nextClient, nextServer, 0x10, `Client expects server byte ${nextServer}.`);
    control('fin', 'FIN + ACK · client closes', 'out', nextClient, nextServer, 0x11, 'Client finishes sending. FIN consumes one sequence number.');
    control('finack', 'ACK · server acknowledges FIN', 'back', nextServer, nextClient + 1, 0x10, 'The server acknowledges the client’s half-close.');
    control('serverfin', 'FIN + ACK · server closes', 'back', nextServer, nextClient + 1, 0x11, 'The server finishes sending. Its FIN also consumes one sequence number.');
    control('closed', 'ACK · both directions closed', 'out', nextClient + 1, nextServer + 1, 0x10, 'The final acknowledgment completes this illustrated exchange. TCP TIME-WAIT is outside the playback.');
  }
  steps.push({ title: 'Journey complete', detail: tcp ? 'The client received a complete HTTP response, and the connection closed.' : 'The client matched DNS transaction 0x1234 and received the A record 192.0.2.42.', layer: 7, side: 'receiver', kind: 'outcome', result: 'success', packet: responsePacket });
  return steps;
}
