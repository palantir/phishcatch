// Copyright 2020 Palantir Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as fs from 'fs'
import {
  checkDOMHash,
  getHashesAsTlshInstances,
  getSavedDomHashes,
  getTlshInstance,
  hashesMatch,
  saveDOMHash,
} from '../lib/domhash'
import { setConfigOverride } from '../config'
import { getHostFromUrl } from '../lib/getHostFromUrl'

const enterpriseUrl = 'http://corporate.com'
const evilUrl = 'http://evil.com'
const ignoredUrl = 'http://ignored.com'

const baseText = '<html>hello world</html>'
const baseTextHash = '0E7000EF20300008000808002CE00AE8000020C28300880002E02C3022E0A3C2CCC808'
const similarText = '<html>hello world 2</html>'
const veryDifferentText =
  'kdrjnfkjerfkjrekjferjkbfjkbrsbjkdsrbjk.srabjk.srbjkbjksrbherbrbdrbhjkdvh vjn ejoefejnfljewfljewfkjwefhke'

const baseTextWithUnicode = '<html>hello emoji world 😳😞😞💤💤💩💩👩‍👩‍👦👼👨‍👨‍👦👯😼😦👃</html>'
const baseTextWithUnicodeHash = '5FA004DD141001140014440C1DF44DC501041070DFC4100C51DDD0315D1053C4CC4500'
const similarTextWithUnicode = '<html>hello emoji world 🙏😄🤔👲👈😻👋👋😾👤🗣🗣</html>'
const veryDifferentTextWithUnicode =
  '💤😳😇👈👩‍👩‍👧‍👦💼🎹🏸🏌🎟⚾🏀🎽🎣🎰🏩🚀🚏🚋🎆🎠 lsekfmlkewfjewflnwelfmlwemflmweflme 🏕🏚🚇🚇💵💊💊💊💊📽📽💊📼📸🔌📄📊📉📈📉📈📉📈📉📉📈📈📈📈📈📈📈📈📈📈📈📈📈📈📈📈🇮🇹🇫🇯🇲🇶🇲🇬🇭🇳🇪🇨🇳🇨🇰🇮🇬🇷 ekfmkemfemf'

const authDom = fs.readFileSync('./src/__tests__/samples/authdom.txt').toString()
const evilNginxDom = fs.readFileSync('./src/__tests__/samples/evilnginxdom.txt').toString()
const redditDom = fs.readFileSync('./src/__tests__/samples/redditdom.txt').toString()

beforeAll(async () => {
  await setConfigOverride({
    domains: ['corporate.com'],
    phishcatch_server: '',
    psk: '',
    registration_expiry: 90,
    display_reuse_alerts: true,
    ignored_domains: [ignoredUrl],
    extraAnnoyingAlerts: false,
  })
})

afterAll((done) => {
  chrome.storage.local.clear(done)
})

describe('Fuzzy hashing should work', () => {
  it('The same text should always hash the same', () => {
    const firstHash = getTlshInstance(baseText).hash()
    expect(firstHash).toEqual(baseTextHash)
  })

  it('Different text should always be different', () => {
    const firstHash = getTlshInstance(baseText).hash()
    const secondHash = getTlshInstance(similarText).hash()
    const thirdHash = getTlshInstance(veryDifferentText).hash()
    expect(firstHash).not.toEqual(secondHash)
    expect(secondHash).not.toEqual(thirdHash)
    expect(thirdHash).not.toEqual(firstHash)
  })

  it('Similar text should match', () => {
    const firstHash = getTlshInstance(baseText)
    const secondHash = getTlshInstance(similarText)
    expect(hashesMatch(firstHash, secondHash)).toEqual(true)
  })

  it('Dissimilar text should not', () => {
    const firstHash = getTlshInstance(baseText)
    const secondHash = getTlshInstance(veryDifferentText)
    expect(hashesMatch(firstHash, secondHash)).toEqual(false)
  })
})

describe('Fuzzy hashing should work with strings containing weird characters', () => {
  it('The same text should always hash the same', () => {
    const firstHash = getTlshInstance(baseTextWithUnicode).hash()
    expect(firstHash).toEqual(baseTextWithUnicodeHash)
  })

  it('Different text should always be different', () => {
    const firstHash = getTlshInstance(baseTextWithUnicode).hash()
    const secondHash = getTlshInstance(similarTextWithUnicode).hash()
    const thirdHash = getTlshInstance(veryDifferentTextWithUnicode).hash()
    expect(firstHash).not.toEqual(secondHash)
    expect(secondHash).not.toEqual(thirdHash)
    expect(thirdHash).not.toEqual(firstHash)
  })

  it('Similar text should match', () => {
    const firstHash = getTlshInstance(baseTextWithUnicode)
    const secondHash = getTlshInstance(similarTextWithUnicode)
    expect(hashesMatch(firstHash, secondHash)).toEqual(true)
  })

  it('Dissimilar text should not', () => {
    const firstHash = getTlshInstance(baseTextWithUnicode)
    const secondHash = getTlshInstance(veryDifferentTextWithUnicode)
    expect(hashesMatch(firstHash, secondHash)).toEqual(false)
  })
})

describe('Hash saving/checking should work', () => {
  it('The same text should always hash and save the same', async () => {
    await saveDOMHash(baseText, enterpriseUrl)
    const domHashes = await getHashesAsTlshInstances()
    expect(domHashes.length).toEqual(1)
    expect(domHashes[0].hash()).toEqual(baseTextHash)
  })

  it('Hash metadata should exist', async () => {
    const domHashes = await getSavedDomHashes()
    const datedDomHash = domHashes[0]
    expect(datedDomHash.dateAdded).toBeInstanceOf(Date)
    expect(datedDomHash.source).toEqual(getHostFromUrl(enterpriseUrl))
  })

  it("Saving the same hash shouldn't increase the number of hashes", async () => {
    await saveDOMHash(baseText, enterpriseUrl)

    const domHashes = await getHashesAsTlshInstances()
    expect(domHashes.length).toEqual(1)
  })

  it("Saving similar hashes shouldn't increase the number of hashes", async () => {
    await saveDOMHash(similarText, enterpriseUrl)

    const domHashes = await getHashesAsTlshInstances()
    expect(domHashes.length).toEqual(1)
  })

  it('Saving the same hash should update the timestamp', async (callback) => {
    let domHashes = await getSavedDomHashes()
    const datedDomHash = domHashes[0]
    const originalDate = datedDomHash.dateAdded.getTime()

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(async () => {
      await saveDOMHash(baseText, enterpriseUrl)
      domHashes = await getSavedDomHashes()

      expect(domHashes[0].dateAdded.getTime()).toBeGreaterThan(originalDate)
      callback()
    }, 10)
  })

  it('We should alert if we see an enterprise-looking hash coming from a non-enterprise domain', async () => {
    expect(await checkDOMHash(baseText, evilUrl)).toEqual(true)
    expect(await checkDOMHash(similarText, evilUrl)).toEqual(true)
    expect(await checkDOMHash(veryDifferentText, evilUrl)).toEqual(false)
    expect(await checkDOMHash(baseText, enterpriseUrl)).toEqual(false)
  })
})

describe('Real website doms should work', () => {
  it('Hashing different doms should produce different results', () => {
    const firstHash = getTlshInstance(authDom).hash()
    const secondHash = getTlshInstance(evilNginxDom).hash()
    const thirdHash = getTlshInstance(redditDom).hash()
    expect(firstHash).not.toEqual(secondHash)
    expect(secondHash).not.toEqual(thirdHash)
    expect(thirdHash).not.toEqual(firstHash)
  })

  it('No dom should match pre-existing hashes', async () => {
    expect(await checkDOMHash(authDom, evilUrl)).toEqual(false)
    expect(await checkDOMHash(evilNginxDom, evilUrl)).toEqual(false)
    expect(await checkDOMHash(redditDom, evilUrl)).toEqual(false)
  })

  it('Evil doms should be detected as such', async () => {
    await saveDOMHash(authDom, enterpriseUrl)
    const firstHash = getTlshInstance(authDom)
    const secondHash = getTlshInstance(evilNginxDom)

    expect(await checkDOMHash(evilNginxDom, evilUrl)).toEqual(true)
  })

  it('Innocuous doms should not', async () => {
    expect(await checkDOMHash(redditDom, evilUrl)).toEqual(false)
  })
})
