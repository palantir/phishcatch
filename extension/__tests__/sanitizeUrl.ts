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

import { setConfigOverride } from '../config'
import { UrlSanitizationEnum } from '../types'
import { getSanitizedUrl } from '../lib/getSanitizedUrl'

const testUrl =
  'https://www.foo.com/ap/signin?openid.pape.max_auth_age=0&openid.return_to=https%3A%2F%2Fwww.foo.com%2F%3Fref_%3Dnav_signin&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.assoc_handle=usflex&openid.mode=checkid_setup&openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&'
const urlNoParams = 'https://www.foo.com/ap/signin'

describe('Url path-level sanitization should work', () => {
  beforeAll(async () => {
    await setConfigOverride({
      url_sanitization_level: UrlSanitizationEnum.path,
    })
  })

  it('Get parameters should be removed', async () => {
    expect(await getSanitizedUrl(testUrl)).toEqual(urlNoParams)
  })

  it('Urls with no parameters should still work', async () => {
    expect(await getSanitizedUrl(urlNoParams)).toEqual(urlNoParams)
  })

  it('Bad strings should result in blank URLs', async () => {
    expect(await getSanitizedUrl('.jrwnfk.nsrkj')).toEqual('')
    expect(await getSanitizedUrl('')).toEqual('')
  })
})

describe('Url host-level sanitization should work', () => {
  beforeAll(async () => {
    await setConfigOverride({
      url_sanitization_level: UrlSanitizationEnum.host,
    })
  })

  it('Get parameters and the entire path should be removed', async () => {
    expect(await getSanitizedUrl(testUrl)).toEqual('https://www.foo.com')
  })

  it('Urls with no parameters should still work', async () => {
    expect(await getSanitizedUrl(urlNoParams)).toEqual('https://www.foo.com')
  })

  it('Bad strings should result in blank URLs', async () => {
    expect(await getSanitizedUrl('.jrwnfk.nsrkj')).toEqual('')
    expect(await getSanitizedUrl('')).toEqual('')
  })
})

describe('Url no sanitization should work', () => {
  beforeAll(async () => {
    await setConfigOverride({
      url_sanitization_level: UrlSanitizationEnum.none,
    })
  })

  it('Nothing should be removed', async () => {
    expect(await getSanitizedUrl(testUrl)).toEqual(testUrl)
  })

  it('Urls with no parameters should still work', async () => {
    expect(await getSanitizedUrl(urlNoParams)).toEqual(urlNoParams)
  })

  it('Bad strings should result in blank URLs', async () => {
    expect(await getSanitizedUrl('.jrwnfk.nsrkj')).toEqual('')
    expect(await getSanitizedUrl('')).toEqual('')
  })
})
