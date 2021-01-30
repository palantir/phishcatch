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

import * as crypto from 'crypto'
import { setConfigOverride } from '../config'
import { getUsernames, hashAndSavePassword, saveUsername } from '../lib/userInfo'

Object.defineProperty(global.self, 'crypto', {
  value: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
  },
})

afterAll((done) => {
  chrome.storage.local.clear(done)
})

const username = 'myusername@corporate.com'
const anotherUsername = 'other@corporate.com'
const weirdUsername = '🐷🐮🐠🐍🐨🌑🌨☃🔥⚡@corporate.com'

afterAll((done) => {
  chrome.storage.local.clear(done)
})

describe('Usernames should be saved and retrieved correctly', () => {
  it('Usernames should be saved', async () => {
    await saveUsername(username)
    const usernames = (await getUsernames()).map((name) => name.username)
    expect(usernames.includes(username)).toEqual(true)
    expect(usernames.includes(anotherUsername)).toEqual(false)
  })

  it("Saving the same username over and over shouldn't create a bunch of usernames", async () => {
    await saveUsername(username)
    await saveUsername(username)
    await saveUsername(username)
    await saveUsername(username)
    const usernames = await getUsernames()
    expect(usernames.length).toEqual(1)
  })

  it("Usernames should still work even if there's more than one", async () => {
    await saveUsername(anotherUsername)
    const usernames = (await getUsernames()).map((name) => name.username)
    expect(usernames.includes(anotherUsername)).toEqual(true)
  })

  it('Weird usernames should be saved', async () => {
    await saveUsername(weirdUsername)
    const usernames = (await getUsernames()).map((name) => name.username)
    expect(usernames.includes(weirdUsername)).toEqual(true)
  })

  it('Passwords should not be saved as usernames', async () => {
    const password = 'mypassword'

    await hashAndSavePassword(password)
    expect(await saveUsername(password)).toEqual(false)

    const usernames = (await getUsernames()).map((name) => name.username)
    expect(usernames.includes(password)).toEqual(false)
  })

  it('Usernames must match a username regex if one is defined', async () => {
    await setConfigOverride({
      enterprise_domains: [],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [],
      pbkdf2_iterations: 100000,
      // eslint-disable-next-line prettier/prettier
      username_regexes: ['^[a-z0-9](\.?[a-z0-9]){5,}@corporate.com$'],
    })

    const password = 'anotherpassword'
    const validEmail = 'validemail@corporate.com'

    expect(await saveUsername(password)).toEqual(false)
    expect(await saveUsername(validEmail)).toEqual(true)

    const usernames = (await getUsernames()).map((name) => name.username)
    expect(usernames.includes(password)).toEqual(false)
    expect(usernames.includes(validEmail)).toEqual(true)
  })
})
