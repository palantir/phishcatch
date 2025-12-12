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
import { getSanitizedUrl } from '../../lib/getSanitizedUrl'
import { createServerAlert } from '../../lib/sendAlert'
import { Alerts, CredentialAlert } from '../../types'
import { AppToaster } from '../toaster'
import { getConfig } from '../../config'
import { getUsernames } from '../../lib/userInfo'
import { getId } from '../../lib/clientId'

class ReportPhishingState {
  @observable isOpen = false

  setPopupState(newStatus: boolean) {
    this.isOpen = newStatus
  }

  createReport() {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const tab = tabs[0]
      if (tab && tab.url) {
        const url = await getSanitizedUrl(tab.url)
        const config = await getConfig()
        const usernames = (await getUsernames()).map((u) => u.username)
        const clientId = await getId()

        const alert: CredentialAlert = {
          type: Alerts.USERREPORT,
          timestamp: Date.now(),
          psk: config.psk,
          clientId,
          content: {
            allAssociatedUsernames: JSON.stringify(usernames),
            alertUrl: url,
            referrer: '',
          }
        }

        const sentAlert = await createServerAlert(alert)
        if (sentAlert) {
          AppToaster.show({ message: `Reported ${url}!`, intent: Intent.SUCCESS })
        } else {
          AppToaster.show({ message: `No server configured - reach out to infosec`, intent: Intent.WARNING })
        }
      } else {
        AppToaster.show({ message: "Couldn't get current URL!", intent: Intent.DANGER })
      }

      this.isOpen = false
    })
  }
}

export const reportPhishingStore = new ReportPhishingState()
