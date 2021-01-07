/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/restrict-plus-operands */
/*
 * TLSH is provided for use under two licenses: Apache OR BSD.
 * Users may opt to use either license depending on the license
 * restictions of the systems with which they plan to integrate
 * the TLSH code.
 */

/* ==============
 * Apache License
 * ==============
 * Copyright 2013 Trend Micro Incorporated
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* ===========
 * BSD License
 * ===========
 * Copyright (c) 2013, Trend Micro Incorporated
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.

 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/*
 * Port of C++ implementation tlsh to javascript.
 *
 * Construct Tlsh object with methods:
 *   update
 *   finale
 *   fromTlshStr
 *   reset
 *   hash
 *   totalDiff
 *
 * See tlsh.html for example use.
 */

// https://raw.githubusercontent.com/trendmicro/tlsh/master/js_ext/tlsh.js
// modified for use in phishcatch (eg type definitions)

import { TLSHInstance, TLSHQuartile } from '../types'

const debug = false
///////////////////////////////////////////////////////////////////////////////////
// From tlsh_util.cpp
const v_table = new Uint8Array([
  1,
  87,
  49,
  12,
  176,
  178,
  102,
  166,
  121,
  193,
  6,
  84,
  249,
  230,
  44,
  163,
  14,
  197,
  213,
  181,
  161,
  85,
  218,
  80,
  64,
  239,
  24,
  226,
  236,
  142,
  38,
  200,
  110,
  177,
  104,
  103,
  141,
  253,
  255,
  50,
  77,
  101,
  81,
  18,
  45,
  96,
  31,
  222,
  25,
  107,
  190,
  70,
  86,
  237,
  240,
  34,
  72,
  242,
  20,
  214,
  244,
  227,
  149,
  235,
  97,
  234,
  57,
  22,
  60,
  250,
  82,
  175,
  208,
  5,
  127,
  199,
  111,
  62,
  135,
  248,
  174,
  169,
  211,
  58,
  66,
  154,
  106,
  195,
  245,
  171,
  17,
  187,
  182,
  179,
  0,
  243,
  132,
  56,
  148,
  75,
  128,
  133,
  158,
  100,
  130,
  126,
  91,
  13,
  153,
  246,
  216,
  219,
  119,
  68,
  223,
  78,
  83,
  88,
  201,
  99,
  122,
  11,
  92,
  32,
  136,
  114,
  52,
  10,
  138,
  30,
  48,
  183,
  156,
  35,
  61,
  26,
  143,
  74,
  251,
  94,
  129,
  162,
  63,
  152,
  170,
  7,
  115,
  167,
  241,
  206,
  3,
  150,
  55,
  59,
  151,
  220,
  90,
  53,
  23,
  131,
  125,
  173,
  15,
  238,
  79,
  95,
  89,
  16,
  105,
  137,
  225,
  224,
  217,
  160,
  37,
  123,
  118,
  73,
  2,
  157,
  46,
  116,
  9,
  145,
  134,
  228,
  207,
  212,
  202,
  215,
  69,
  229,
  27,
  188,
  67,
  124,
  168,
  252,
  42,
  4,
  29,
  108,
  21,
  247,
  19,
  205,
  39,
  203,
  233,
  40,
  186,
  147,
  198,
  192,
  155,
  33,
  164,
  191,
  98,
  204,
  165,
  180,
  117,
  76,
  140,
  36,
  210,
  172,
  41,
  54,
  159,
  8,
  185,
  232,
  113,
  196,
  231,
  47,
  146,
  120,
  51,
  65,
  28,
  144,
  254,
  221,
  93,
  189,
  194,
  139,
  112,
  43,
  71,
  109,
  184,
  209,
])

function b_mapping(salt: number, i: number, j: number, k: number) {
  let h = 0

  h = v_table[h ^ salt]
  h = v_table[h ^ i]
  h = v_table[h ^ j]
  h = v_table[h ^ k]
  return h
}

const LOG_1_5 = 0.4054651
const LOG_1_3 = 0.26236426
const LOG_1_1 = 0.09531018

function l_capturing(len: number) {
  let i
  if (len <= 656) {
    i = Math.floor(Math.log(len) / LOG_1_5)
  } else if (len <= 3199) {
    i = Math.floor(Math.log(len) / LOG_1_3 - 8.72777)
  } else {
    i = Math.floor(Math.log(len) / LOG_1_1 - 62.5472)
  }

  return i & 0xff
}

function swap_byte(i: number) {
  let byte = 0
  byte = ((i & 0xf0) >> 4) & 0x0f
  byte |= ((i & 0x0f) << 4) & 0xf0
  return byte
}

function to_hex(data: Uint8Array, len: number) {
  // Use TLSH.java implementation for to_hex
  let s = new String()
  for (let i = 0; i < len; i++) {
    if (data[i] < 16) {
      s = s.concat('0')
    }
    debug && console.log('to_hex: ' + data[i])
    s = s.concat(data[i].toString(16).toUpperCase())
  }

  return s
}

function from_hex(str: string) {
  // Use TLSH.java implementation for from_hex
  const ret = new Uint8Array(str.length / 2) // unsigned char array}
  for (let i = 0; i < str.length; i += 2) {
    ret[i / 2] = parseInt(str.substring(i, i + 2), 16)
  }
  return ret
}

function mod_diff(x: number, y: number, R: number) {
  let dl = 0
  let dr = 0
  if (y > x) {
    dl = y - x
    dr = x + R - y
  } else {
    dl = x - y
    dr = y + R - x
  }
  return dl > dr ? dr : dl
}

// Use  generateTable() from TLSH.java implementation
function generateTable() {
  const arraySize = 256
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const result: Uint8Array[] = new Array(arraySize)
  for (let i = 0; i < result.length; i++) {
    result[i] = new Uint8Array(arraySize)
  }

  for (let i = 0; i < arraySize; i++) {
    for (let j = 0; j < arraySize; j++) {
      let x = i,
        y = j,
        d,
        diff = 0
      d = Math.abs((x % 4) - (y % 4))
      diff += d == 3 ? 6 : d
      x = Math.floor(x / 4)
      y = Math.floor(y / 4)

      d = Math.abs((x % 4) - (y % 4))
      diff += d == 3 ? 6 : d
      x = Math.floor(x / 4)
      y = Math.floor(y / 4)

      d = Math.abs((x % 4) - (y % 4))
      diff += d == 3 ? 6 : d
      x = Math.floor(x / 4)
      y = Math.floor(y / 4)

      d = Math.abs((x % 4) - (y % 4))
      diff += d == 3 ? 6 : d
      result[i][j] = diff
    }
  }
  return result
}

const bit_pairs_diff_table = generateTable()

function h_distance(len: number, x: Uint8Array, y: Uint8Array) {
  let diff = 0
  for (let i = 0; i < len; i++) {
    debug && console.log('bit_pairs_diff_table[' + x[i] + '][' + y[i] + ']=' + bit_pairs_diff_table[x[i]][y[i]])
    diff += bit_pairs_diff_table[x[i]][y[i]]
  }
  debug && console.log('h_distance returning ' + diff)
  return diff
}

///////////////////////////////////////////////////////////////////////////////////
// from C #defines in tlsh_impl.h and tlsh_impl.cpp
const SLIDING_WND_SIZE = 5
const RNG_SIZE = SLIDING_WND_SIZE
function RNG_IDX(i: number) {
  return (i + RNG_SIZE) % RNG_SIZE
}
const TLSH_CHECKSUM_LEN = 1
const BUCKETS = 256
const EFF_BUCKETS = 128
const CODE_SIZE = 32 // 128 * 2 bits = 32 bytes
const TLSH_STRING_LEN = 70 // 2 + 1 + 32 bytes = 70 hexidecimal chars
const RANGE_LVALUE = 256
const RANGE_QRATIO = 16

function SWAP_UINT(buf: { bucket_copy: Uint32Array }, x: number, y: number) {
  const int_tmp = buf.bucket_copy[x]
  buf.bucket_copy[x] = buf.bucket_copy[y]
  buf.bucket_copy[y] = int_tmp
}

///////////////////////////////////////////////////////////////////////////////////
// TLSH member and non-member functions - from tlsh_impl.cpp

function partition(buf: { bucket_copy: Uint32Array }, left: number, right: number) {
  if (left == right) {
    return left
  }
  if (left + 1 == right) {
    if (buf.bucket_copy[left] > buf.bucket_copy[right]) {
      SWAP_UINT(buf, left, right)
    }
    return left
  }

  let ret = left
  const pivot = (left + right) >> 1

  const val = buf.bucket_copy[pivot]

  buf.bucket_copy[pivot] = buf.bucket_copy[right]
  buf.bucket_copy[right] = val

  for (let i = left; i < right; i++) {
    if (buf.bucket_copy[i] < val) {
      SWAP_UINT(buf, ret, i)
      ret++
    }
  }
  buf.bucket_copy[right] = buf.bucket_copy[ret]
  buf.bucket_copy[ret] = val

  return ret
}

function find_quartile(tlsh: TLSHInstance, quartiles: TLSHQuartile) {
  const buf = {
    bucket_copy: new Uint32Array(EFF_BUCKETS),
  }

  const short_cut_left = new Uint32Array(EFF_BUCKETS)
  const short_cut_right = new Uint32Array(EFF_BUCKETS)
  let spl = 0
  let spr = 0
  const p1 = EFF_BUCKETS / 4 - 1
  const p2 = EFF_BUCKETS / 2 - 1
  const p3 = EFF_BUCKETS - EFF_BUCKETS / 4 - 1
  const end = EFF_BUCKETS - 1

  for (let i = 0; i <= end; i++) {
    buf.bucket_copy[i] = tlsh.a_bucket[i]
  }

  for (let l = 0, r = end; ; ) {
    const ret = partition(buf, l, r)
    if (ret > p2) {
      r = ret - 1
      short_cut_right[spr] = ret
      spr++
    } else if (ret < p2) {
      l = ret + 1
      short_cut_left[spl] = ret
      spl++
    } else {
      quartiles.q2 = buf.bucket_copy[p2]
      break
    }
  }

  short_cut_left[spl] = p2 - 1
  short_cut_right[spr] = p2 + 1

  for (let i = 0, l = 0; i <= spl; i++) {
    let r = short_cut_left[i]
    if (r > p1) {
      for (;;) {
        const ret = partition(buf, l, r)
        if (ret > p1) {
          r = ret - 1
        } else if (ret < p1) {
          l = ret + 1
        } else {
          quartiles.q1 = buf.bucket_copy[p1]
          break
        }
      }
      break
    } else if (r < p1) {
      l = r
    } else {
      quartiles.q1 = buf.bucket_copy[p1]
      break
    }
  }

  for (let i = 0, r = end; i <= spr; i++) {
    let l = short_cut_right[i]
    if (l < p3) {
      for (;;) {
        const ret = partition(buf, l, r)
        if (ret > p3) {
          r = ret - 1
        } else if (ret < p3) {
          l = ret + 1
        } else {
          quartiles.q3 = buf.bucket_copy[p3]
          break
        }
      }
      break
    } else if (l > p3) {
      r = l
    } else {
      quartiles.q3 = buf.bucket_copy[p3]
      break
    }
  }
}

///////////////////////////////////////////////////////////////////////////////////
// Definition of tlsh object
const Tlsh = function (this: TLSHInstance) {
  this.checksum = new Uint8Array(TLSH_CHECKSUM_LEN) // unsigned char array
  this.slide_window = new Uint8Array(SLIDING_WND_SIZE)
  this.a_bucket = new Uint32Array(BUCKETS) // unsigned int array
  this.data_len = 0
  this.tmp_code = new Uint8Array(CODE_SIZE)
  this.Lvalue = 0
  this.Q = 0
  this.lsh_code = ''
  this.lsh_code_valid = false
}

// Use get/setQLo() and get/setQHi() from TLSH.java implementation
function getQLo(Q: number) {
  return Q & 0x0f
}

function getQHi(Q: number) {
  return (Q & 0xf0) >> 4
}

function setQLo(Q: number, x: number) {
  return (Q & 0xf0) | (x & 0x0f)
}

function setQHi(Q: number, x: number) {
  return (Q & 0x0f) | ((x & 0x0f) << 4)
}

// Allow caller to pass in length in case there are embedded null characters, as there
// are in strings str_1 and str_2 (see simple_test.cpp)
//
// length parameter defaults to str.length
Tlsh.prototype.update = function (this: TLSHInstance, str: string, length: number) {
  if (!str || !str.length) {
    debug && console.log('No string or string length')
    return
  }

  length = typeof length !== 'undefined' ? length : str.length

  const data = []
  for (let i = 0; i < length; i++) {
    const code = str.charCodeAt(i)
    if (code > 255) {
      debug && console.log('Unexpected ' + str[i] + ' has value ' + code + ' which is too large')
      // return;
      // TODO: Added this to handle char codes outside of 255 range
      data.push(254 & 0xff)
    } else {
      // Since charCodeAt returns between 0~65536, simply save every character as 2-bytes
      // data.push(code & 0xff00, code & 0xff);
      data.push(code & 0xff)
    }
  }

  if (length != data.length) {
    debug &&
      console.log('Unexpected string length:' + length + ' is not equal to value unsigned char length: ' + data.length)
    return
  }

  let j = this.data_len % RNG_SIZE
  let fed_len = this.data_len

  for (let i = 0; i < length; i++, fed_len++, j = RNG_IDX(j + 1)) {
    this.slide_window[j] = data[i]
    debug && console.log('slide_window[' + j + ']=' + this.slide_window[j])

    if (fed_len >= 4) {
      //only calculate when input >= 5 bytes
      const j_1 = RNG_IDX(j - 1)
      const j_2 = RNG_IDX(j - 2)
      const j_3 = RNG_IDX(j - 3)
      const j_4 = RNG_IDX(j - 4)

      for (let k = 0; k < TLSH_CHECKSUM_LEN; k++) {
        if (k == 0) {
          this.checksum[k] = b_mapping(0, this.slide_window[j], this.slide_window[j_1], this.checksum[k])
          debug && console.log('tlsh.checksum[' + k + ']=' + this.checksum[k])
        } else {
          // use calculated 1 byte checksums to expand the total checksum to 3 bytes
          this.checksum[k] = b_mapping(
            this.checksum[k - 1],
            this.slide_window[j],
            this.slide_window[j_1],
            this.checksum[k],
          )
        }
      }

      let r
      r = b_mapping(2, this.slide_window[j], this.slide_window[j_1], this.slide_window[j_2])
      r = b_mapping(2, this.slide_window[j], this.slide_window[j_1], this.slide_window[j_2])
      r = b_mapping(2, this.slide_window[j], this.slide_window[j_1], this.slide_window[j_2])

      this.a_bucket[r]++
      r = b_mapping(3, this.slide_window[j], this.slide_window[j_1], this.slide_window[j_3])
      this.a_bucket[r]++
      r = b_mapping(5, this.slide_window[j], this.slide_window[j_2], this.slide_window[j_3])
      this.a_bucket[r]++
      r = b_mapping(7, this.slide_window[j], this.slide_window[j_2], this.slide_window[j_4])
      this.a_bucket[r]++
      r = b_mapping(11, this.slide_window[j], this.slide_window[j_1], this.slide_window[j_4])
      this.a_bucket[r]++
      r = b_mapping(13, this.slide_window[j], this.slide_window[j_3], this.slide_window[j_4])
      this.a_bucket[r]++
    }
  }
  this.data_len += length
}

// final is a reserved word
Tlsh.prototype.finale = function (this: TLSHInstance, str: string, length: number) {
  if (str) {
    this.update(str, length)
  }

  // incoming data must more than or equal to 512 bytes
  if (this.data_len < 256) {
    debug && console.log('ERROR: length too small - ' + this.data_len) //  + ")");
  }

  const quartiles = {
    q1: 0,
    q2: 0,
    q3: 0,
  }

  find_quartile(this, quartiles)

  // buckets must be more than 50% non-zero
  let nonzero = 0
  for (let i = 0; i < CODE_SIZE; i++) {
    for (let j = 0; j < 4; j++) {
      if (this.a_bucket[4 * i + j] > 0) {
        nonzero++
      }
    }
  }
  if (nonzero <= (4 * CODE_SIZE) / 2) {
    debug && console.log('ERROR: not enought variation in input - ' + nonzero + ' < ' + (4 * CODE_SIZE) / 2)
  }

  for (let i = 0; i < CODE_SIZE; i++) {
    let h = 0
    for (let j = 0; j < 4; j++) {
      const k = this.a_bucket[4 * i + j]
      if (quartiles.q3 < k) {
        h += 3 << (j * 2) // leave the optimization j*2 = j<<1 or j*2 = j+j for compiler
      } else if (quartiles.q2 < k) {
        h += 2 << (j * 2)
      } else if (quartiles.q1 < k) {
        h += 1 << (j * 2)
      }
    }
    this.tmp_code[i] = h
  }

  this.Lvalue = l_capturing(this.data_len)
  this.Q = setQLo(this.Q, ((quartiles.q1 * 100) / quartiles.q3) % 16)
  this.Q = setQHi(this.Q, ((quartiles.q2 * 100) / quartiles.q3) % 16)
  this.lsh_code_valid = true
}

Tlsh.prototype.hash = function () {
  if (this.lsh_code_valid == false) {
    return 'ERROR IN PROCESSING'
  }

  const tmp = {
    checksum: new Uint8Array(TLSH_CHECKSUM_LEN),
    Lvalue: 0,
    Q: 0,
    tmp_code: new Uint8Array(CODE_SIZE),
  }

  for (let k = 0; k < TLSH_CHECKSUM_LEN; k++) {
    tmp.checksum[k] = swap_byte(this.checksum[k])
    debug &&
      console.log(
        'After swap_byte for checksum: tmp.checksum:' + tmp.checksum[k] + ', tlsh.checksum:' + this.checksum[k],
      )
  }
  tmp.Lvalue = swap_byte(this.Lvalue)
  tmp.Q = swap_byte(this.Q)
  debug && console.log('After swap_byte for Q: tmp.Q:' + tmp.Q + ', tlsh.Q:' + this.Q)
  for (let i = 0; i < CODE_SIZE; i++) {
    tmp.tmp_code[i] = this.tmp_code[CODE_SIZE - 1 - i]
    debug && console.log('tmp.tmp_code[' + i + ']:' + tmp.tmp_code[i])
  }

  this.lsh_code = to_hex(tmp.checksum, TLSH_CHECKSUM_LEN)

  const tmpArray = new Uint8Array(1)
  tmpArray[0] = tmp.Lvalue
  this.lsh_code = this.lsh_code.concat(to_hex(tmpArray, 1))

  tmpArray[0] = tmp.Q
  this.lsh_code = this.lsh_code.concat(to_hex(tmpArray, 1))
  this.lsh_code = this.lsh_code.concat(to_hex(tmp.tmp_code, CODE_SIZE))
  return this.lsh_code
}

Tlsh.prototype.reset = function () {
  this.checksum = new Uint8Array(TLSH_CHECKSUM_LEN)
  this.slide_window = new Uint8Array(SLIDING_WND_SIZE)
  this.a_bucket = new Uint32Array(BUCKETS)
  this.data_len = 0
  this.tmp_code = new Uint8Array(CODE_SIZE)
  this.Lvalue = 0
  this.Q = 0
  this.lsh_code = new String()
  this.lsh_code_valid = false
}

// len_diff defaults to true
Tlsh.prototype.totalDiff = function (this: TLSHInstance, other: TLSHInstance, len_diff: boolean) {
  if (this == other) {
    return 0
  }

  len_diff = typeof len_diff !== 'undefined' ? len_diff : true
  let diff = 0

  if (len_diff) {
    const ldiff = mod_diff(this.Lvalue, other.Lvalue, RANGE_LVALUE)
    if (ldiff == 0) diff = 0
    else if (ldiff == 1) diff = 1
    else diff += ldiff * 12
  }

  const q1diff = mod_diff(getQLo(this.Q), getQLo(other.Q), RANGE_QRATIO)
  if (q1diff <= 1) diff += q1diff
  else diff += (q1diff - 1) * 12

  const q2diff = mod_diff(getQHi(this.Q), getQHi(other.Q), RANGE_QRATIO)
  if (q2diff <= 1) diff += q2diff
  else diff += (q2diff - 1) * 12

  for (let k = 0; k < TLSH_CHECKSUM_LEN; k++) {
    if (this.checksum[k] != other.checksum[k]) {
      diff++
      break
    }
  }

  diff += h_distance(CODE_SIZE, this.tmp_code, other.tmp_code)

  return diff
}

Tlsh.prototype.fromTlshStr = function (this: TLSHInstance, str: string) {
  if (str.length != TLSH_STRING_LEN) {
    debug && console.log('Tlsh.fromTlshStr() - string has wrong length (' + str.length + ' != ' + TLSH_STRING_LEN + ')')
    return
  }
  for (let i = 0; i < TLSH_STRING_LEN; i++) {
    if (!((str[i] >= '0' && str[i] <= '9') || (str[i] >= 'A' && str[i] <= 'F') || (str[i] >= 'a' && str[i] <= 'f'))) {
      debug && console.log('Tlsh.fromTlshStr() - string has invalid (non-hex) characters')
      return
    }
  }

  const tmp = from_hex(str)
  // Order of assignment is based on order of fields in lsh_bin
  // Also note that TLSH_CHECKSUM_LEN is 1
  let i = 0
  this.checksum[i] = swap_byte(tmp[i++])
  this.Lvalue = swap_byte(tmp[i++])
  this.Q = swap_byte(tmp[i++])

  for (let j = 0; j < CODE_SIZE; j++) {
    this.tmp_code[j] = tmp[i + CODE_SIZE - 1 - j]
  }
  this.lsh_code_valid = true
}

export default function TlshConstructor(): TLSHInstance {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return new (Tlsh as any)()
}
