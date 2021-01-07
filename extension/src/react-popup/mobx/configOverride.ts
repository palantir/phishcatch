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
import { AppToaster } from '../toaster'
import { clearConfigOverride, getConfigOverride, setConfigOverride } from '../../config'
import { Prefs } from '../../types'

class configOverrideState {
  @observable overrideFormText = ''

  constructor() {
    void this.loadConfigOverride()
  }

  async loadConfigOverride() {
    const override = await getConfigOverride()
    if (override) {
      this.overrideFormText = JSON.stringify(override, null, 2)
    }
  }

  async setConfigOverride(newConfig: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const config: Prefs = JSON.parse(newConfig)
      await setConfigOverride(config)
      AppToaster.show({ message: 'Saved config override!', intent: 'success' })
    } catch (e) {
      AppToaster.show({ message: "Error setting config! Make sure it's json.", intent: 'danger' })
    }
  }

  async clearConfigOverride() {
    await clearConfigOverride()
    AppToaster.show({ message: 'Cleared config override!', intent: 'success' })
    this.overrideFormText = ''
  }
}

export const configOverrideStore = new configOverrideState()
