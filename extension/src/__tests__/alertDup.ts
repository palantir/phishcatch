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

import { checkIfDup } from '../lib/sendAlert'
import { AlertContent, AlertTypes } from '../types'

jest.setTimeout(60000)

const alertOne: AlertContent = {
  url: 'efefef',
  referrer: 'efffd',
  timestamp: 1234,
  alertType: AlertTypes.DOMHASH,
  associatedUsername: 'fefelmrg',
  associatedHostname: 'fefe',
}
const alertTwo: AlertContent = {
  url: '4894jre.com',
  referrer: 'efkef',
  timestamp: 12345,
  alertType: AlertTypes.FALSEPOSITIVE,
  associatedUsername: 'fefelmrg',
  associatedHostname: 'fefe',
}

describe('Duplicate alerts should not be sent within 30 seconds', () => {
  it('Properly detect duplicate alerts', (callback) => {
    expect(checkIfDup(alertOne)).toEqual(false)

    setTimeout(() => {
      expect(checkIfDup(alertOne)).toEqual(true)
      expect(checkIfDup(alertTwo)).toEqual(false)
    }, 15 * 1000)

    setTimeout(() => {
      expect(checkIfDup(alertOne)).toEqual(false)
      expect(checkIfDup(alertTwo)).toEqual(true)
      callback()
    }, 31 * 1000)
  })
})
