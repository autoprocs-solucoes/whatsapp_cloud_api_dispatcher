/**
 * Converte o áudio gravado pelo navegador (WebM/Opus) para Ogg/Opus.
 *
 * O Chrome só grava em `audio/webm` ou num MP4 fragmentado, e a Cloud API
 * recusa os dois: o primeiro por tipo não aceito, o segundo porque o
 * processamento dela enxerga `application/octet-stream`. Ogg/Opus é o formato
 * da mensagem de voz do WhatsApp e é aceito em todo lugar.
 *
 * O áudio em si não é recodificado: WebM e Ogg são só embalagens, e os pacotes
 * Opus lá dentro são idênticos. Aqui eles são retirados de uma embalagem e
 * postos na outra — rápido, sem perda e sem depender de nada externo.
 */

// ---------------------------------------------------------------------------
// Leitura do WebM (Matroska é uma árvore de elementos EBML)
// ---------------------------------------------------------------------------

/** Tamanho do id do elemento: vem no número de bits zero à esquerda. */
function idLength(byte: number): number {
  if (byte & 0x80) return 1;
  if (byte & 0x40) return 2;
  if (byte & 0x20) return 3;
  return 4;
}

type Vint = { value: number; length: number; unknown: boolean };

/** Lê um inteiro de tamanho variável (o "vint" do EBML). */
function readVint(data: Uint8Array, offset: number): Vint | null {
  if (offset >= data.length) return null;
  const first = data[offset]!;
  if (first === 0) return null;

  let length = 1;
  let mask = 0x80;
  while (!(first & mask) && length < 8) {
    length++;
    mask >>= 1;
  }
  if (offset + length > data.length) return null;

  let value = first & (mask - 1);
  let allOnes = value === mask - 1;
  for (let i = 1; i < length; i++) {
    const b = data[offset + i]!;
    value = value * 256 + b;
    if (b !== 0xff) allOnes = false;
  }

  return { value, length, unknown: allOnes };
}

const ID_SEGMENT = 0x18538067;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACK_ENTRY = 0xae;
const ID_CODEC_PRIVATE = 0x63a2;
const ID_CLUSTER = 0x1f43b675;
const ID_SIMPLE_BLOCK = 0xa3;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;

/** Elementos que são "caixas": entram em vez de serem pulados. */
const CONTAINERS = new Set([ID_SEGMENT, ID_TRACKS, ID_TRACK_ENTRY, ID_CLUSTER, ID_BLOCK_GROUP]);

type ParsedWebm = { head: Uint8Array | null; packets: Uint8Array[] };

function parseWebm(data: Uint8Array): ParsedWebm {
  const packets: Uint8Array[] = [];
  let head: Uint8Array | null = null;

  const walk = (start: number, end: number) => {
    let pos = start;
    while (pos < end) {
      const idLen = idLength(data[pos]!);
      if (pos + idLen > end) return;

      let id = 0;
      for (let i = 0; i < idLen; i++) id = id * 256 + data[pos + i]!;

      const size = readVint(data, pos + idLen);
      if (!size) return;

      const contentStart = pos + idLen + size.length;
      // Tamanho desconhecido (streaming): vai até o fim do pai.
      const contentEnd = size.unknown ? end : Math.min(contentStart + size.value, end);

      if (CONTAINERS.has(id)) {
        walk(contentStart, contentEnd);
      } else if (id === ID_CODEC_PRIVATE && !head) {
        head = data.subarray(contentStart, contentEnd);
      } else if (id === ID_SIMPLE_BLOCK || id === ID_BLOCK) {
        const track = readVint(data, contentStart);
        if (track) {
          // Depois do número da faixa vêm 2 bytes de timecode e 1 de flags;
          // o resto é o pacote Opus. Áudio do MediaRecorder não usa lacing.
          const frameStart = contentStart + track.length + 3;
          if (frameStart < contentEnd) {
            packets.push(data.subarray(frameStart, contentEnd));
          }
        }
      }

      pos = contentEnd;
    }
  };

  walk(0, data.length);
  return { head, packets };
}

// ---------------------------------------------------------------------------
// Duração dos pacotes (pro granule do Ogg)
// ---------------------------------------------------------------------------

/** Duração em amostras de 48 kHz, lida do primeiro byte (TOC) do pacote. */
function packetSamples(packet: Uint8Array): number {
  if (packet.length === 0) return 0;
  const toc = packet[0]!;
  const config = toc >> 3;

  let ms: number;
  if (config < 12) ms = [10, 20, 40, 60][config % 4]!;
  else if (config < 16) ms = [10, 20][config % 2]!;
  else ms = [2.5, 5, 10, 20][config % 4]!;

  const code = toc & 0b11;
  let frames = 1;
  if (code === 1 || code === 2) frames = 2;
  else if (code === 3) frames = packet.length > 1 ? packet[1]! & 0b111111 : 1;

  return Math.round(ms * 48 * frames);
}

// ---------------------------------------------------------------------------
// Escrita do Ogg
// ---------------------------------------------------------------------------

/** CRC do Ogg: polinômio 0x04c11db7, sem reflexão — não é o CRC32 comum. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let r = i << 24;
    for (let j = 0; j < 8; j++) {
      r = r & 0x80000000 ? ((r << 1) ^ 0x04c11db7) >>> 0 : (r << 1) >>> 0;
    }
    table[i] = r >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc = ((crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff]!) >>> 0;
  }
  return crc >>> 0;
}

function buildPage(params: {
  payload: Uint8Array[];
  headerType: number;
  granule: number;
  serial: number;
  sequence: number;
}): Uint8Array {
  const { payload, headerType, granule, serial, sequence } = params;

  // Cada pacote vira segmentos de até 255 bytes; o último abaixo de 255
  // sinaliza o fim do pacote.
  const segments: number[] = [];
  for (const packet of payload) {
    let left = packet.length;
    while (left >= 255) {
      segments.push(255);
      left -= 255;
    }
    segments.push(left);
  }

  const body = payload.reduce((acc, p) => acc + p.length, 0);
  const page = new Uint8Array(27 + segments.length + body);
  const view = new DataView(page.buffer);

  page.set([0x4f, 0x67, 0x67, 0x53], 0); // "OggS"
  page[4] = 0;
  page[5] = headerType;
  // Granule é 64 bits; áudio de conversa não chega perto de estourar 32.
  view.setUint32(6, granule >>> 0, true);
  view.setUint32(10, Math.floor(granule / 0x100000000), true);
  view.setUint32(14, serial, true);
  view.setUint32(18, sequence, true);
  view.setUint32(22, 0, true); // CRC entra depois
  page[26] = segments.length;
  page.set(segments, 27);

  let offset = 27 + segments.length;
  for (const packet of payload) {
    page.set(packet, offset);
    offset += packet.length;
  }

  view.setUint32(22, crc32(page), true);
  return page;
}

/** OpusHead mínimo, usado quando o WebM não trouxe o CodecPrivate. */
function defaultOpusHead(channels = 1): Uint8Array {
  const head = new Uint8Array(19);
  head.set([0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64], 0); // "OpusHead"
  head[8] = 1; // versão
  head[9] = channels;
  new DataView(head.buffer).setUint16(10, 3840, true); // pre-skip
  new DataView(head.buffer).setUint32(12, 48000, true); // taxa original
  return head;
}

function opusTags(): Uint8Array {
  const vendor = new TextEncoder().encode("dispatcher");
  const tags = new Uint8Array(8 + 4 + vendor.length + 4);
  tags.set([0x4f, 0x70, 0x75, 0x73, 0x54, 0x61, 0x67, 0x73], 0); // "OpusTags"
  const view = new DataView(tags.buffer);
  view.setUint32(8, vendor.length, true);
  tags.set(vendor, 12);
  view.setUint32(12 + vendor.length, 0, true); // nenhum comentário
  return tags;
}

/**
 * Troca a embalagem: recebe os bytes do WebM/Opus e devolve um Ogg/Opus.
 * Devolve `null` quando o arquivo não é Opus — aí o chamador manda o original
 * e deixa a Meta decidir.
 */
export function webmToOgg(webm: Uint8Array): Uint8Array | null {
  const { head, packets } = parseWebm(webm);
  if (packets.length === 0) return null;

  const opusHead =
    head && head.length >= 19 && String.fromCharCode(...head.subarray(0, 8)) === "OpusHead"
      ? head
      : defaultOpusHead();

  const serial = Math.floor(Math.random() * 0xffffffff) >>> 0;
  const pages: Uint8Array[] = [
    buildPage({ payload: [opusHead], headerType: 2, granule: 0, serial, sequence: 0 }),
    buildPage({ payload: [opusTags()], headerType: 0, granule: 0, serial, sequence: 1 }),
  ];

  let granule = 0;
  let sequence = 2;
  // Um pacote por página: simples e sempre válido. Conversa é curta, e o
  // ganho de empacotar vários não compensa o risco de estourar 255 segmentos.
  for (let i = 0; i < packets.length; i++) {
    granule += packetSamples(packets[i]!);
    pages.push(
      buildPage({
        payload: [packets[i]!],
        headerType: i === packets.length - 1 ? 4 : 0,
        granule,
        serial,
        sequence,
      }),
    );
    sequence++;
  }

  const total = pages.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const page of pages) {
    out.set(page, offset);
    offset += page.length;
  }
  return out;
}
