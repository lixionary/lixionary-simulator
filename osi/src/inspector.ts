import type { Packet } from './model';

/** Bytes present at the current layer, before that layer passes its payload upward. */
export function layerBytes(packet: Packet, layer: number, received: boolean) {
  const frame = received ? packet.received : packet.frame;
  const ipEnd = 14 + packet.ip.length;
  const transportStart = ipEnd - packet.transport.length;
  const payloadStart = ipEnd - packet.payload.length;
  const start = layer <= 2 ? 0 : layer === 3 ? 14 : layer === 4 ? transportStart : payloadStart;
  const end = layer <= 2 ? frame.length : ipEnd;
  const name = layer <= 2 ? 'Ethernet frame' : layer === 3 ? 'IPv4 packet' : layer === 4
    ? packet.protocol === 'tcp' ? 'TCP segment' : 'UDP datagram'
    : packet.protocol === 'tcp' ? 'HTTP message' : 'DNS message';
  return { name, frameOffset: start, bytes: frame.slice(start, end) };
}
