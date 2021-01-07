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

import { getDomainType } from '../lib/getDomainType'
import { getConfig, setConfigOverride } from '../config'
import { DomainType } from '../types'
import { getHostFromUrl } from '../lib/getHostFromUrl'

const enterpriseDomain = 'corporate.com'
const wildcardEnterpriseDomain = '*.enterprise.com'

const enterpriseUrlWithoutTLD = 'https://foo-bar-baz'

const ignoredDomain = 'ignored.com'
const wildcardIgnoredDomain = '*.notrelevant.com'

const evilDomain = 'evil.com'
const evilSubDomain = 'foo.evil.com'

beforeAll(async () => {
  await setConfigOverride({
    domains: [enterpriseDomain, wildcardEnterpriseDomain],
    phishcatch_server: '',
    psk: '',
    registration_expiry: 90,
    display_reuse_alerts: true,
    ignored_domains: [ignoredDomain, wildcardIgnoredDomain],
    extraAnnoyingAlerts: false,
  })
})

afterAll((done) => {
  chrome.storage.local.clear(done)
})

describe('We should be able to identify enterprise and ignored domains', () => {
  it('Enterprise domains should be recognized as such', async () => {
    expect(await getDomainType(enterpriseDomain)).toBe(DomainType.ENTERPRISE)
  })

  it('Enterprise subdomains should be recognized, given a wildcard', async () => {
    expect(await getDomainType('foo.enterprise.com')).toBe(DomainType.ENTERPRISE)
    expect(await getDomainType('test.foo.enterprise.com')).toBe(DomainType.ENTERPRISE)
  })

  it('Ignored domains should be recognized as such', async () => {
    expect(await getDomainType(ignoredDomain)).toBe(DomainType.IGNORED)
  })

  it('Ignored subdomains should be recognized as such, given a wildcard', async () => {
    expect(await getDomainType('test.notrelevant.com')).toBe(DomainType.IGNORED)
    expect(await getDomainType('foo.test.notrelevant.com')).toBe(DomainType.IGNORED)
  })

  it('Non-enterprise/ignored domains should be recognized as such', async () => {
    expect(await getDomainType(evilDomain)).toBe(DomainType.DANGEROUS)
    expect(await getDomainType(evilSubDomain)).toBe(DomainType.DANGEROUS)
  })

  it('Non-enterprise/ignored domains should be recognized as such even if they include good domains', async () => {
    expect(await getDomainType(enterpriseDomain + '.' + evilDomain)).toBe(DomainType.DANGEROUS)
    expect(await getDomainType(ignoredDomain + '.' + evilDomain)).toBe(DomainType.DANGEROUS)
    expect(await getDomainType('test.foo.enterprise.com.' + evilDomain)).toBe(DomainType.DANGEROUS)
    expect(await getDomainType('foo.test.notrelevant.com.' + evilDomain)).toBe(DomainType.DANGEROUS)
  })

  it('RFC1918/Localhost domains should be ignored', async () => {
    expect(await getDomainType('127.0.0.1')).toBe(DomainType.IGNORED)
    expect(await getDomainType('192.168.1.1')).toBe(DomainType.IGNORED)
    expect(await getDomainType('localhost')).toBe(DomainType.IGNORED)
    expect(await getDomainType('10.2.69.21')).toBe(DomainType.IGNORED)
    expect(await getDomainType('172.16.30.10')).toBe(DomainType.IGNORED)
  })

  it('Domains without tlds should work correctly', async () => {
    await setConfigOverride({
      domains: [enterpriseDomain, wildcardEnterpriseDomain, getHostFromUrl(enterpriseUrlWithoutTLD)],
      phishcatch_server: '',
      psk: '',
      registration_expiry: 90,
      display_reuse_alerts: true,
      ignored_domains: [ignoredDomain, wildcardIgnoredDomain],
      extraAnnoyingAlerts: false,
    })

    expect((await getConfig()).domains.includes('foo-bar-baz'))
    expect(await getDomainType(getHostFromUrl(enterpriseUrlWithoutTLD))).toBe(DomainType.ENTERPRISE)
  })
})
