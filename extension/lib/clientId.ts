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

import { getSalt } from './generateHash'

export function generateId() {
  return getSalt()
}

export async function saveId(id: string) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ clientId: id }, () => {
      resolve(true)
    })
  })
}

export function getId(): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('clientId', (data) => {
      if (!data.clientId) {
        const newId = generateId()
        void saveId(newId)
        resolve(newId)
      } else {
        resolve(data.clientId)
      }
    })
  })
}
