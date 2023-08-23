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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-floating-promises */
import * as crypto from 'crypto'
import { handlePasswordEntry } from '../background'
import { hashPasswordWithSalt } from '../lib/generateHash'
import { getPasswordHashes, checkStoredHashes, hashAndSavePassword, removeHash } from '../lib/userInfo'
import { setConfigOverride } from '../config'
import { PasswordContent, PasswordHandlingReturnValue } from '../types'
import { getHashDataIfItExists, checkForExistingAccount } from '../lib/userInfo'
import { getHostFromUrl } from '../lib/getHostFromUrl'

Object.defineProperty(global.self, 'crypto', {
  value: {
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
  },
})

const salt = '0000000000000000000000000000000000'
const passwordOne = 'passwordOne'
const passwordTwo = 'passwordTwo'
const emojiPassword = '🌔🙉🐵🐬🎄🌝💦💧🍃🌻🌹🌹🌷🐀🐴🦄'

const enterpriseDomain = 'corporate.com'
const enterpriseUrl = 'http://corporate.com/login'
const ignoredDomain = 'ignored.com'
const ignoredUrl = 'http://ignored.com/bar'
const protectedUrl = 'http://protected.com'
const evilUrl = 'http://evil.com/foo'

describe('Password hashing should work', () => {
  it('A password should always hash to the same value (given the salt is the same)', async () => {
    await setConfigOverride({
      enterprise_domains: [enterpriseDomain],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [ignoredDomain],
      pbkdf2_iterations: 100000,
      expire_hash_on_use: false,
    })

    const firstHash = await hashPasswordWithSalt(passwordOne, salt)
    expect(firstHash.hash).toEqual(
      '64784cee716bd764a8ca4c51ee4a931d33ab7d2a38ae80ce675c70571f44724b7d8837b2b2f3c9d1f77923a193e0a0ff38dfeaca706e10554fe08afb4caeb519',
    )
  })

  it('If the salt is different, the resulting hash should be too', async () => {
    const firstHash = await hashPasswordWithSalt(passwordOne, salt)
    const secondHash = await hashPasswordWithSalt(passwordOne, '11111111111111111111111111111111111111')
    expect(firstHash.hash).not.toEqual(secondHash.hash)
  })

  it('A different string should not produce the same hash', async () => {
    const firstHash = await hashPasswordWithSalt(passwordOne, salt)
    const secondHash = await hashPasswordWithSalt(passwordTwo, salt)
    expect(firstHash.hash).not.toEqual(secondHash.hash)
  })

  it('Weird strings should produce correct hashes', async () => {
    expect((await hashPasswordWithSalt('', salt)).hash).toEqual(
      '544a34746c7a2c739b0b970dce127cd8f7f21d2ca51bc765968c5dcb5c823fe7e15e3d772e8952b6da87a84be2ca4cbe6696da02300e1f45c601b03ff89dc814',
    )
    expect((await hashPasswordWithSalt('sometext🌖🌕🌕🌕🌕', salt)).hash).toEqual(
      '5c1cf476936f512c75577679e6dab6f82bc8de341a9c441f1771ac30871d6dcf22141c49d6d80958e831a5968f9fc064b743ae1c4e54433649693c72d99aecb4',
    )
    expect((await hashPasswordWithSalt(emojiPassword, salt)).hash).toEqual(
      '665547b2e1f90874099531c891772677a753e1c50e1b9b28bf4fefd74d22222d3e750659275a83d31bac2a5942ed164c9e23dd0764b39fe09d9775fa582ed636',
    )
  })

  it('Passing a bad salt should cause an error', () => {
    expect(hashPasswordWithSalt(passwordOne, '')).rejects.toEqual('No/bad salt! This is unsafe.')
    expect(hashPasswordWithSalt(passwordOne, 'too short')).rejects.toEqual('No/bad salt! This is unsafe.')
  })

  it('Changing the number of iterations should produce a different result', async () => {
    await setConfigOverride({
      enterprise_domains: [enterpriseDomain],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [ignoredDomain],
      pbkdf2_iterations: 100,
    })

    const firstHash = await hashPasswordWithSalt(passwordOne, salt)
    expect(firstHash.hash).not.toEqual(
      '64784cee716bd764a8ca4c51ee4a931d33ab7d2a38ae80ce675c70571f44724b7d8837b2b2f3c9d1f77923a193e0a0ff38dfeaca706e10554fe08afb4caeb519',
    )
  })
})

describe('Hash saving/checking should work', () => {
  it('Password hash saving should work', async () => {
    await hashAndSavePassword(passwordOne, 'username1', 'hostname.com')
    const hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(1)
    expect(typeof hashes[0].dateAdded).toEqual('number')
    expect(typeof hashes[0].salt).toEqual('string')
    expect(hashes[0].salt.length).toBeGreaterThan(10)
    expect(hashes[0].username).toEqual('username1')
    expect(hashes[0].hostname).toEqual('hostname.com')
  })

  it('We should be able to see if a hash matches a password', async () => {
    const passwordOneExists = await checkStoredHashes(passwordOne)
    const passwordTwoExists = await checkStoredHashes(passwordTwo)
    expect(passwordOneExists.hashExists).toEqual(true)
    expect(passwordTwoExists.hashExists).toEqual(false)
  })

  it("The same password shouldn't result in a new hash", async () => {
    let hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(1)

    await hashAndSavePassword(passwordOne)
    await hashAndSavePassword(passwordOne)
    hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(1)
  })

  it('Saving the same password should update the associated metadata', (callback) => {
    let hashes = getPasswordHashes().then((hashes) => {
      const oldHashTimestamp = hashes[0].dateAdded

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      setTimeout(async () => {
        await hashAndSavePassword(passwordOne, 'username2', 'anotherhostname.com')
        hashes = await getPasswordHashes()
        expect(hashes[0].dateAdded).toBeGreaterThan(oldHashTimestamp)
        expect(hashes[0].username).toEqual('username2')
        expect(hashes[0].hostname).toEqual('anotherhostname.com')
        callback()
      }, 100)
    })
  })

  it('Checking for an existing account works', async () => {
    const hashes = await getPasswordHashes()
    let hashIndex = checkForExistingAccount(hashes, 'username2', 'anotherhostname.com')
    expect(hashIndex).toEqual(0)
    hashIndex = checkForExistingAccount(hashes, 'no such user', 'no such hostname')
    expect(hashIndex).toEqual(-1)
  })

  it('A new password with the same username and hostname should replace the old one', async () => {
    let hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(1)
    const oldHash = hashes[0]

    await hashAndSavePassword('ejfowefowfjwefnwefjnjknkjrnnewru', 'username2', 'anotherhostname.com')
    hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(1)
    const newHash = hashes[0]
    expect(oldHash.hash !== newHash.hash)
    expect(oldHash.dateAdded !== newHash.dateAdded)
    expect(oldHash.username === newHash.username)
    expect(oldHash.hostname === newHash.hostname)
    expect(oldHash.salt === newHash.salt)

    await hashAndSavePassword(passwordOne, 'username2', 'anotherhostname.com')
    expect(hashes.length).toEqual(1)
    const newNewHash = hashes[0]
    expect(oldHash.hash === newNewHash.hash)
    expect(oldHash.dateAdded !== newNewHash.dateAdded)
    expect(oldHash.username === newNewHash.username)
    expect(oldHash.hostname === newNewHash.hostname)
    expect(oldHash.salt !== newNewHash.salt)
  })

  it('A different password should result in a new hash', async () => {
    await hashAndSavePassword(passwordTwo)
    const hashes = await getPasswordHashes()
    expect(hashes.length).toEqual(2)
  })

  it('Saving and checking multiple passwords should work', async () => {
    await hashAndSavePassword('jkfkefejf', 'eijijefe', 'kejfjef')
    await hashAndSavePassword('passwordTwo')
    await hashAndSavePassword('oejflkwnefk.newfknwekfjnkwenfkjew')

    expect((await checkStoredHashes('jkfkefejf')).hashExists).toEqual(true)
    expect((await checkStoredHashes('passwordTwo')).hashExists).toEqual(true)
    expect((await checkStoredHashes('oejflkwnefk.newfknwekfjnkwenfkjew')).hashExists).toEqual(true)
  })

  it('We should be able to get hash data by passing a password', async () => {
    const passwordOneData = await getHashDataIfItExists(passwordOne)
    if (!passwordOneData) throw 'no data'
    expect(typeof passwordOneData.dateAdded).toEqual('number')
    expect(typeof passwordOneData.salt).toEqual('string')
    expect(passwordOneData.salt.length).toBeGreaterThan(10)
    expect(passwordOneData.username).toEqual('username2')
    expect(passwordOneData.hostname).toEqual('anotherhostname.com')
  })

  it('Saving and checking weird passwords should work', async () => {
    await hashAndSavePassword(emojiPassword)
    expect((await checkStoredHashes(emojiPassword)).hashExists).toEqual(true)
  })

  it('Storage should not contain plaintext passwords', (done) => {
    const hashArray = [passwordOne, passwordTwo, emojiPassword]

    chrome.storage.local.get(null, (data) => {
      const hashStorageString = JSON.stringify(data)

      const hashStorageContainsPassword = hashArray.reduce((previousValue, currentValue) => {
        if (previousValue === true) {
          return true
        }

        return hashStorageString.includes(currentValue)
      }, false)

      expect(hashStorageContainsPassword).toEqual(false)
      done()
    })
  })

  it('Removing passwords should work', async () => {
    await hashAndSavePassword(emojiPassword)
    await hashAndSavePassword('pwekeofj')

    const hash1Details = await checkStoredHashes(emojiPassword)
    const hash2Details = await checkStoredHashes('pwekeofj')
    expect(hash1Details.hashExists).toEqual(true)
    expect(hash2Details.hashExists).toEqual(true)

    await removeHash(hash1Details.hash.hash)
    await removeHash(hash2Details.hash.hash)

    expect((await checkStoredHashes(emojiPassword)).hashExists).toEqual(false)
    expect((await checkStoredHashes('pwekeofj')).hashExists).toEqual(false)
  })
})

describe('Password message handling works as expected', () => {
  const passwordToBeSaved = 'somerandomtext'

  it('Saving enterprise passwords should work', async () => {
    const message: PasswordContent = {
      password: passwordToBeSaved,
      save: true,
      url: enterpriseUrl,
      referrer: "doesn't matter",
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.EnterpriseSave)
    expect((await checkStoredHashes(passwordToBeSaved)).hashExists).toEqual(true)

    const passwordOneData = await getHashDataIfItExists(passwordToBeSaved)
    if (!passwordOneData) throw 'no data'
    expect(passwordOneData.username).toEqual('exampleUsername')
    expect(passwordOneData.hostname).toEqual(getHostFromUrl(enterpriseUrl))
  })

  it('Not saving enterprise passwords should work', async () => {
    const message: PasswordContent = {
      password: 'someotherrandomtext',
      save: false,
      url: enterpriseUrl,
      referrer: "doesn't matter",
      timestamp: new Date().getTime(),
      username: 'whocares',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.EnterpriseNoSave)
    expect((await checkStoredHashes('someotherrandomtext')).hashExists).toEqual(false)
  })

  it('Reused passwords should alert', async () => {
    const message: PasswordContent = {
      password: passwordToBeSaved,
      save: false,
      url: evilUrl,
      referrer: 'doesntmatter.com',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect((await checkStoredHashes(passwordToBeSaved)).hashExists).toEqual(true)
    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.ReuseAlert)
  })

  it('Ignored domains should not alert even if password is reused', async () => {
    const message: PasswordContent = {
      password: passwordToBeSaved,
      save: false,
      url: ignoredUrl,
      referrer: 'doesntmatter.com',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.NoReuse)
  })

  it('Protected routes should not alert', async () => {
    const message: PasswordContent = {
      password: 'non-reused-password',
      save: false,
      url: protectedUrl,
      referrer: '',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.NoReuse)
  })

  it('Non-Reused passwords should not alert', async () => {
    const message: PasswordContent = {
      password: 'non-reused-password',
      save: false,
      url: evilUrl,
      referrer: 'doesntmatter.com',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.NoReuse)
  })

  it('Setting expire_hash_on_use should prevent passwords from alerting twice', async () => {
    await setConfigOverride({
      enterprise_domains: [enterpriseDomain],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [ignoredDomain],
      pbkdf2_iterations: 100000,
      expire_hash_on_use: true,
    })

    let message: PasswordContent = {
      password: passwordToBeSaved,
      save: true,
      url: enterpriseUrl,
      referrer: 'doesntmatter.com',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.EnterpriseSave)
    expect((await checkStoredHashes(passwordToBeSaved)).hashExists).toEqual(true)

    message = {
      password: passwordToBeSaved,
      save: false,
      url: evilUrl,
      referrer: 'doesntmatter.com',
      timestamp: new Date().getTime(),
      username: 'exampleUsername',
    }

    expect(await handlePasswordEntry(message)).toEqual(PasswordHandlingReturnValue.ReuseAlert)
    expect((await checkStoredHashes(passwordToBeSaved)).hashExists).toEqual(false)
  })
})

describe('Password hash truncation works', () => {
  beforeAll(async () => {
    await setConfigOverride({
      enterprise_domains: [enterpriseDomain],
      phishcatch_server: '',
      psk: '',
      data_expiry: 90,
      display_reuse_alerts: false,
      ignored_domains: [ignoredDomain],
      pbkdf2_iterations: 100000,
      hash_truncation_amount: 10,
    })
  })

  it('Truncating password hashes should work', async () => {
    const firstHash = await hashPasswordWithSalt(passwordOne, salt)
    expect(firstHash.hash).toEqual(
      '64784cee716bd764a8ca4c51ee4a931d33ab7d2a38ae80ce675c70571f44724b7d8837b2b2f3c9d1f77923a193e0a0ff38dfeaca706e10554fe08a',
    )
  })

  it('Saving and checking multiple passwords should work', async () => {
    await hashAndSavePassword('lkef', 'powekfpokr98', 'oiejf9237')
    await hashAndSavePassword('4j2r903jfioemf')
    await hashAndSavePassword('oemfoemfiwe.x.d,<<<')

    expect((await checkStoredHashes('lkef')).hashExists).toEqual(true)
    expect((await checkStoredHashes('4j2r903jfioemf')).hashExists).toEqual(true)
    expect((await checkStoredHashes('oemfoemfiwe.x.d,<<<')).hashExists).toEqual(true)
  })

  it('Saving and checking weird passwords should work', async () => {
    await hashAndSavePassword(emojiPassword)
    expect((await checkStoredHashes(emojiPassword)).hashExists).toEqual(true)
  })
})
