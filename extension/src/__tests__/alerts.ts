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
import { createServerAlert, getUnsentAlerts } from '../lib/sendAlert'
import { tryToSendFailedAlerts } from '../lib/timedCleanup'
import { AlertTypes } from '../types'

Object.defineProperty(global.self, 'crypto', {
  value: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
  },
})

const yesterday = new Date()
yesterday.setDate(yesterday.getDate() - 1)

const lastMonth = new Date()
lastMonth.setDate(lastMonth.getDate() - 31)

const alertWithPassword = {
  url: 'eoijeor.com',
  referrer: 'poefoke',
  timestamp: yesterday.getTime(),
  alertType: AlertTypes.REUSE,
  associatedUsername: 'oiwejfojne',
  associatedHostname: 'weoifjowef.com',
  password: 'password',
}

const oldAlert = {
  url: 'kejfkejf.com',
  referrer: 'fefef',
  timestamp: lastMonth.getTime(),
  alertType: AlertTypes.REUSE,
  associatedUsername: 'efjkejflef',
  associatedHostname: 'ekfjlkejflkse.me',
}

beforeAll(async () => {
  await setConfigOverride({
    enterprise_domains: [],
    phishcatch_server: `][][][][';';';';';==,.,+--.<><><`,
    psk: '',
    data_expiry: 90,
    display_reuse_alerts: false,
    ignored_domains: [],
    pbkdf2_iterations: 100000,
  })
})

describe('Alerts should work', () => {
  it('Only includes relevant fields', async () => {
    const alert = await createServerAlert(alertWithPassword)
    expect(!!alert).toEqual(true)
    expect(JSON.stringify(alert).includes('password')).toEqual(false)
  })

  it('Check that we saved the unsent alert to disk', async () => {
    const unsentAlerts = await getUnsentAlerts()
    expect(unsentAlerts.length).toEqual(1)
  })

  it('Tries to send failed alerts', async () => {
    const failedAlerts = await tryToSendFailedAlerts()
    expect(failedAlerts[0].tries).toEqual(2)
  })

  it('Save an old alert to unsent alerts, which should get filtered out', async () => {
    await createServerAlert(oldAlert)
    let unsentAlerts = await getUnsentAlerts()
    expect(unsentAlerts.length).toEqual(2)

    await tryToSendFailedAlerts()
    unsentAlerts = await getUnsentAlerts()
    expect(unsentAlerts.length).toEqual(1)
  })
})
