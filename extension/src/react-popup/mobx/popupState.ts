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

import { observable } from 'mobx'
import { getHashesAsTlshInstances } from '../../lib/domhash'
import { getUnsentAlerts } from '../../lib/sendAlert'
import { getPasswordHashes, getUsernames } from '../../lib/userInfo'
import { getConfig } from '../../config'
import { Prefs } from '../../types'
import { AppToaster } from '../toaster'

class StorageState {
  @observable showDebug = false
  @observable configReady = false
  @observable config: Prefs
  @observable usernameList: string[] = []
  @observable passwordHashList: string[] = []
  @observable domHashList: string[] = []
  @observable numberOfUnsentAlerts = 0

  constructor() {
    void this.loadConfig()
  }

  async loadConfig() {
    this.config = await getConfig()
    const passwordHashList = (await getPasswordHashes()).map((hash) => {
      return hash.hash.substring(0, 15) + '...'
    })

    const domHashList: string[] = (await getHashesAsTlshInstances()).map((instance) => {
      return instance.hash().substring(0, 15) + '...'
    })

    this.usernameList = (await getUsernames()).map((username) => username.username)
    this.passwordHashList = passwordHashList
    this.domHashList = domHashList
    this.numberOfUnsentAlerts = (await getUnsentAlerts()).length
    this.configReady = true
  }

  async clearStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        AppToaster.show({ message: 'Cleared local storage!', intent: 'success' })
        resolve(true)
      })
    })
  }
}

export const popupStore = new StorageState()
