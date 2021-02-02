// Copyright 2021 Palantir Technologies
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

import { cleanupUsernamesAndPasswords, dateDiffInDays, domHashLimit, passwordHashLimit } from '../lib/timedCleanup'
import { getPasswordHashes, getUsernames } from '../lib/userInfo'
import { setConfigOverride } from '../config'
import { DatedDomHash, PasswordHash, Username } from '../types'
import { getSavedDomHashes } from '../lib/domhash'

afterAll((done) => {
  chrome.storage.local.clear(done)
})

beforeAll(async () => {
  await setConfigOverride({
    enterprise_domains: [],
    phishcatch_server: '',
    psk: '',
    data_expiry: 30,
    display_reuse_alerts: true,
    ignored_domains: [],
  })
})

describe('User data should expire after the configured period of time', () => {
  beforeAll(async () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const lastMonth = new Date()
    lastMonth.setDate(lastMonth.getDate() - 31)
    const currentPasswordHashes: PasswordHash[] = [
      { hash: '00000000', salt: '00000', dateAdded: lastMonth.getTime(), username: '', hostname: '' },
      { hash: '11111111', salt: '11111', dateAdded: yesterday.getTime(), username: '', hostname: '' },
    ]

    const currentDomHashes: DatedDomHash[] = [
      { hash: '00000000', source: '', dateAdded: lastMonth.getTime() },
      { hash: '11111111', source: '', dateAdded: yesterday.getTime() },
    ]

    const currentUsernames: Username[] = [
      { username: '00000000', dateAdded: lastMonth.getTime() },
      { username: '11111111', dateAdded: yesterday.getTime() },
    ]

    return new Promise((resolve) => {
      chrome.storage.local.set(
        { passwordHashes: currentPasswordHashes, datedDomHashes: currentDomHashes, usernames: currentUsernames },
        () => {
          resolve(true)
        },
      )
    })
  })

  it('Diff in days should work', () => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const lastMonth = new Date()
    lastMonth.setDate(lastMonth.getDate() - 31)

    const today = new Date()

    expect(dateDiffInDays(today.getTime(), yesterday.getTime())).toEqual(1)
    expect(dateDiffInDays(today.getTime(), lastMonth.getTime())).toEqual(31)
    expect(dateDiffInDays(lastMonth.getTime(), today.getTime())).toEqual(31)
  })

  it('Old hashes should be deleted', async () => {
    let currentPasswordHashes = await getPasswordHashes()
    expect(currentPasswordHashes.length).toEqual(2)
    let currentDomHashes = await getSavedDomHashes()
    expect(currentDomHashes.length).toEqual(2)
    let currentUsernames = await getUsernames()
    expect(currentUsernames.length).toEqual(2)

    await cleanupUsernamesAndPasswords()
    currentPasswordHashes = await getPasswordHashes()
    expect(currentPasswordHashes.length).toEqual(1)
    expect(currentPasswordHashes[0].hash).toEqual('11111111')

    currentDomHashes = await getSavedDomHashes()
    expect(currentDomHashes.length).toEqual(1)
    expect(currentDomHashes[0].hash).toEqual('11111111')

    currentUsernames = await getUsernames()
    expect(currentUsernames.length).toEqual(1)
    expect(currentUsernames[0].username).toEqual('11111111')
  })
})

describe(`For performance reasons we shouldn't store an excessive number of hashes`, () => {
  beforeAll(async () => {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 1)
    const currentPasswordHashes: PasswordHash[] = [
      { hash: '11111111', salt: '11111', dateAdded: new Date().getTime(), username: '', hostname: '' },
    ]
    for (let i = 0; i < 200; i++) {
      currentPasswordHashes.push({
        hash: '00000000',
        salt: '00000',
        dateAdded: oldDate.getTime(),
        username: '',
        hostname: '',
      })
    }

    const currentDomHashes: DatedDomHash[] = [{ hash: '11111111', source: '', dateAdded: new Date().getTime() }]

    for (let i = 0; i < 200; i++) {
      currentDomHashes.push({ hash: '00000000', source: '', dateAdded: oldDate.getTime() })
    }

    return new Promise((resolve) => {
      chrome.storage.local.set({ passwordHashes: currentPasswordHashes }, () => {
        chrome.storage.local.set({ datedDomHashes: currentDomHashes }, () => {
          resolve(true)
        })
      })
    })
  })

  it('Excess hashes should be deleted', async () => {
    let currentPasswordHashes = await getPasswordHashes()
    expect(currentPasswordHashes.length).toEqual(201)
    let currentDomHashes = await getSavedDomHashes()
    expect(currentDomHashes.length).toEqual(201)

    await cleanupUsernamesAndPasswords()
    currentPasswordHashes = await getPasswordHashes()
    expect(currentPasswordHashes.length).toEqual(passwordHashLimit)
    expect(currentPasswordHashes.some((hash: PasswordHash) => hash.hash === '11111111')).toEqual(true)

    currentDomHashes = await getSavedDomHashes()
    expect(currentDomHashes.length).toEqual(domHashLimit)
    expect(currentDomHashes.some((hash: DatedDomHash) => hash.hash === '11111111')).toEqual(true)
  })
})
