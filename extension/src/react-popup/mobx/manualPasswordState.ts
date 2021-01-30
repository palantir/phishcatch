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

import { Intent } from '@blueprintjs/core'
import { observable } from 'mobx'
import { hashAndSavePassword } from '../../lib/userInfo'
import { AppToaster } from '../toaster'

class ManualPasswordState {
  @observable isOpen = false
  @observable currentPassword = ''

  setPopupState(newStatus: boolean) {
    this.isOpen = newStatus
  }

  async hydratePassword() {
    if (this.currentPassword.length <= 1) {
      AppToaster.show({ message: `This doesn't look like a real password`, intent: Intent.WARNING })
    }
    const password = this.currentPassword
    this.currentPassword = ''
    try {
      await hashAndSavePassword(password)
      AppToaster.show({ message: `Successfully hashed and saved password`, intent: Intent.SUCCESS })
      this.setPopupState(false)
    } catch (e) {
      AppToaster.show({ message: `Failed to hash and save password`, intent: Intent.DANGER })
    }
  }
}

export const manualPasswordStore = new ManualPasswordState()
