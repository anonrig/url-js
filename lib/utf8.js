/* jshint esversion: 8 */
/* jshint node: true */

"use strict";
/**
 * @function encode_utf8
 * @description Taken from [fast-text-encoding]{@link https://github.com/samthor/fast-text-encoding}
 * @param {string} string
 * @returns {Uint8Array}
 */
function encode_utf8(string) {
  const len = string.length;

  let pos = 0;
  let at = 0; // output position
  let tlen = Math.max(32, len + (len >>> 1) + 7);
  let target = new Uint8Array((tlen >>> 3) << 3);

  while (pos < len) {
    let value = string.charCodeAt(pos++);

    if (value >= 0xd800 && value <= 0xdbff) {
      if (pos < len) {
        let extra = string.charCodeAt(pos);

        if ((extra & 0xfc00) === 0xdc00) {
          ++pos;
          value = ((value & 0x3ff) << 10) + (extra & 0x3ff) + 0x10000;
        }
      }

      if (value >= 0xd800 && value <= 0xdbff) {
        continue; // drop lone surrogate
      }
    }

    // expand the buffer if we couldn't write 4 bytes
    if (at > (target.length - 4)) {
      tlen += 8;
      tlen *= 1.0 + ((pos / len) * 2);
      tlen = (tlen >>> 3) << 3;

      target = target.slice(0, tlen);
    }

    if ((value & 0xffffff80) === 0) {
      // 1-byte
      target[at++] = value; // ASCII
      continue;
    } else if ((value & 0xfffff800) === 0) {
      // 2-byte
      target[at++] = ((value >>> 6) & 0x1f) | 0xc0;
    } else if ((value & 0xffff0000) === 0) {
      // 3-byte
      target[at++] = ((value >>> 12) & 0x0f) | 0xe0;
      target[at++] = ((value >>> 6) & 0x3f) | 0x80;
    } else if ((value & 0xffe00000) === 0) {
      // 4-byte
      target[at++] = ((value >>> 18) & 0x07) | 0xf0;
      target[at++] = ((value >>> 12) & 0x3f) | 0x80;
      target[at++] = ((value >>> 6) & 0x3f) | 0x80;
    } else {
      continue; // out of range
    }

    target[at++] = (value & 0x3f) | 0x80;
  }

  return target.slice(0, at);
}

/**
 * @function decode_utf8
 * @param {Uint8Array} buffer
 * @returns {string}
 */
function decode_utf8(buffer) {
  return Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength).toString(
    "utf-8",
  );
}

module.exports = { encode_utf8, decode_utf8 };
