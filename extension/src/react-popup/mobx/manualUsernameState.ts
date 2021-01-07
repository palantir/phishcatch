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

import { Intent } from '@blueprintjs/core'
import { observable } from 'mobx'
import { saveUsername } from '../../lib/userInfo'
import { AppToaster } from '../toaster'

class ManualUsernameState {
  @observable isOpen = false
  @observable currentUsername = ''

  setPopupState(newStatus: boolean) {
    this.isOpen = newStatus
    console.log(this.isOpen)
  }

  async hydrateUsername() {
    if (this.currentUsername.length <= 1) {
      AppToaster.show({ message: `This doesn't look like a real username`, intent: Intent.WARNING })
    }
    const username = this.currentUsername
    this.currentUsername = ''
    try {
      if (await saveUsername(username)) {
        AppToaster.show({ message: `Saved username`, intent: Intent.SUCCESS })
        this.setPopupState(false)
      } else {
        AppToaster.show({ message: `Not a valid username`, intent: Intent.WARNING })
      }
    } catch (e) {
      AppToaster.show({ message: `Failed to save username`, intent: Intent.DANGER })
    }
  }
}

export const manualUsernameStore = new ManualUsernameState()
