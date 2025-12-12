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

import { Alerts, NotificationData, CredentialAlert } from '../types'
import { removeHash, getUsernames } from './userInfo'
import { createServerAlert } from './sendAlert'
import { getConfig } from '../config'
import { getId } from './clientId'

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const notificationStorage: Map<string, NotificationData> = new Map()

export function addNotitication(data: NotificationData) {
  notificationStorage.set(data.id, data)
}

export async function handleNotificationClick(notifId: string, btnId: number) {
  const notificationData = notificationStorage.get(notifId)
  if (notificationData) {
    const alertIconUrl = chrome.runtime.getURL('icon.png')
    const config = await getConfig()
    const usernames = (await getUsernames()).map((u) => u.username)
    const clientId = await getId()

    const createFalsePositiveAlert = (): CredentialAlert => ({
      type: Alerts.FALSEPOSITIVE,
      timestamp: Date.now(),
      psk: config.psk,
      clientId,
      content: {
        allAssociatedUsernames: JSON.stringify(usernames),
        alertUrl: notificationData.url,
        referrer: '',
      }
    })

    if (btnId === 0) {
      const opt: chrome.notifications.NotificationOptions = {
        type: 'basic',
        title: 'PhishCatch Alert',
        message: `Reporting false positive and removing matched password`,
        iconUrl: alertIconUrl,
        priority: 2,
      }

      chrome.notifications.create(opt)
      void createServerAlert(createFalsePositiveAlert())
    } else if (btnId === 1) {
      const opt: chrome.notifications.NotificationOptions = {
        type: 'basic',
        title: 'PhishCatch Alert',
        message: `Removing matched password`,
        iconUrl: alertIconUrl,
        priority: 2,
      }

      chrome.notifications.create(opt)
      void createServerAlert(createFalsePositiveAlert())
    }

    void removeHash(notificationData.hash)
  }
}
