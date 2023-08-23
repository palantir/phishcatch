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
import { AlertContent, AlertTypes } from '../types'
import { getUsernames } from './userInfo'
import { getId } from './clientId'

interface Alert {
  allAssociatedUsernames: string
  alertUrl: string
  psk: string
  alertTimestamp: number
  clientId: string
  suspectedUsername?: string
  suspectedHost?: string
  referrer?: string
  alertType: AlertTypes
}

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
  const isOldAlert = unsentAlerts.some((currentAlert) => currentAlert.alert.alertTimestamp === newUnsentAlert.alert.alertTimestamp)
  if (isOldAlert) {
    unsentAlerts = unsentAlerts.map((currentAlert) => {
      if (currentAlert.alert.alertTimestamp === newUnsentAlert.alert.alertTimestamp) {
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
    return false
  }
}

export async function createServerAlert(message: AlertContent) {
  const config = await getConfig()

  if (!config.phishcatch_server) {
    return false
  }

  if (checkIfDup(message)) {
    return false
  }

  const data: Alert = {
    alertUrl: message.url,
    allAssociatedUsernames: '',
    psk: '',
    referrer: message.referrer,
    alertTimestamp: message.timestamp,
    alertType: message.alertType,
    suspectedUsername: message.associatedUsername,
    suspectedHost: message.associatedHostname,
    clientId: await getId(),
  }

  const usernames = (await getUsernames()).map((username) => username.username)

  data.allAssociatedUsernames = JSON.stringify(usernames)
  data.psk = config.psk

  const sentAlert = await sendAlert(data)
  if (!sentAlert) {
    void saveUnsentAlert({
      alert: data,
      tries: 1,
    })
  }

  return data
}

export function checkIfDup(message: AlertContent) {
  const thirtySeconds = 30 * 1000

  const dupCheckString = JSON.stringify({
    url: message.url,
    alertType: message.alertType,
    username: message.associatedUsername,
    hostname: message.associatedHostname,
  })

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
