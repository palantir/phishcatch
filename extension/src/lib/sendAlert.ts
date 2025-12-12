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

import { getConfig } from '../config'
import { Alert, Alerts } from '../types'
import { getUsernames } from './userInfo'
import { getId } from './clientId'

interface UnsentAlert {
  alert: Alert
  tries: number
}

export async function getUnsentAlerts(): Promise<UnsentAlert[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get('unsentAlerts', (data) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const unsentAlerts: UnsentAlert[] = data.unsentAlerts || []
      resolve(unsentAlerts)
    })
  })
}

export async function saveUnsentAlert(newUnsentAlert: UnsentAlert) {
  let unsentAlerts = await getUnsentAlerts()
  const isOldAlert = unsentAlerts.some((currentAlert) => {
    currentAlert.alert.timestamp === newUnsentAlert.alert.timestamp
  })

  if (isOldAlert) {
    unsentAlerts = unsentAlerts.map((currentAlert) => {
      if (currentAlert.alert.timestamp === newUnsentAlert.alert.timestamp) {
        currentAlert = newUnsentAlert
      }

      return currentAlert
    })
  } else {
    unsentAlerts.push(newUnsentAlert)
  }

  return new Promise((resolve) => {
    chrome.storage.local.set({ unsentAlerts }, () => {
      resolve(true)
    })
  })
}

export async function sendAlert(alert: Alert) {
  const config = await getConfig()
  const url_alert = `${config.phishcatch_server}/alert`

  try {
    const response = await fetch(url_alert, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(alert),
    })

    if (response.status === 200) {
      return true
    } else {
      return false
    }
  } catch (error) {
    // Log so we actually know what the failure is
    console.error("sendAlert failed", error);
    return false
  }
}

export async function createServerAlert(alert: Alert) {
  const config = await getConfig()

  if (!config.phishcatch_server) {
    return false
  }

  // Populate PSK and clientId for all alerts
  const clientId = await getId()
  alert.psk = config.psk
  alert.clientId = clientId

  // For credential alerts, we need to populate additional fields
  if (alert.type !== Alerts.CONVERSATION) {
    // only check for duplicates if it is not a conversation
    if (checkIfDup(alert)) {
      return false
    }

    const usernames = (await getUsernames()).map((username) => username.username)
    alert.content.allAssociatedUsernames = JSON.stringify(usernames)
  }

  const sentAlert = await sendAlert(alert)
  if (!sentAlert) {
    void saveUnsentAlert({
      alert,
      tries: 1,
    })
  }

  return alert
}

export function checkIfDup(alert: Alert) {
  const thirtySeconds = 30 * 1000

  let dupCheckString: string
  if (alert.type === Alerts.CONVERSATION) {
    dupCheckString = JSON.stringify({
      type: alert.type,
      url: alert.content.request.url,
      timestamp: alert.timestamp,
    })
  } else {
    dupCheckString = JSON.stringify({
      type: alert.type,
      url: alert.content.alertUrl,
      username: alert.content.suspectedUsername,
      hostname: alert.content.suspectedHost,
      timestamp: alert.timestamp,
    })
  }

  if (recentAlerts.has(dupCheckString)) {
    const dupDate = recentAlerts.get(dupCheckString)
    if (!dupDate) {
      throw 'no date'
    }

    if (new Date().getTime() - dupDate.getTime() < thirtySeconds) {
      return true
    } else {
      recentAlerts.delete(dupCheckString)
    }
  } else {
    recentAlerts.set(dupCheckString, new Date())
  }

  return false
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
let recentAlerts: Map<string, Date> = new Map()

setTimeout(() => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  recentAlerts = new Map()
}, 24 * 60 * 60 * 1000)
