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
import { getId } from '../lib/clientId'

Object.defineProperty(global.self, 'crypto', {
  value: {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    getRandomValues: (arr: any) => crypto.randomBytes(arr.length),
  },
})

describe('Alerts should work', () => {
  it('Trying to get an ID when none exists should create one', async () => {
    const id = await getId()
    expect(typeof id).toEqual('string')
    expect(id.length).toBeGreaterThan(10)
    const newId = await getId()
    expect(newId).toEqual(id)
  })
})
