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

import { getConfig } from '../config'
import { getUsernames, getPasswordHashes } from './userInfo'
import { getUnsentAlerts, sendAlert } from './sendAlert'
import { getSavedDomHashes } from './domhash'

const hourValue = 1000 * 60 * 60
const dayValue = hourValue * 24

export const passwordHashLimit = 20
export const domHashLimit = 50

export function dateDiffInDays(date1: Date, date2: Date) {
  const diffInMs = date2.getTime() - date1.getTime()
  const diffInDays = diffInMs / dayValue
  return Math.abs(diffInDays)
}

async function cleanData(hashes: { dateAdded: Date }[], hashLimit: number) {
  const config = await getConfig()
  const currentDate = new Date()

  return hashes
    .filter((hash) => {
      return dateDiffInDays(hash.dateAdded, currentDate) < config.registration_expiry
    })
    .sort((hash1, hash2) => {
      return hash2.dateAdded.getTime() - hash1.dateAdded.getTime()
    })
    .slice(0, hashLimit)
}

export async function cleanupUsernamesAndPasswords() {
  const currentDate = new Date()
  const config = await getConfig()

  const usernames = (await getUsernames()).filter((username) => {
    return dateDiffInDays(username.dateAdded, currentDate) < config.registration_expiry
  })

  const passwordHashes = await cleanData(await getPasswordHashes(), passwordHashLimit)

  const datedDomHashes = await cleanData(await getSavedDomHashes(), domHashLimit)

  return new Promise((resolve) => {
    chrome.storage.local.set({ usernames, passwordHashes, datedDomHashes }, () => {
      resolve(true)
    })
  })
}

export async function tryToSendFailedAlerts() {
  const currentDate = new Date()

  let unsentAlerts = (await getUnsentAlerts()).filter((unsentAlert) => {
    return dateDiffInDays(unsentAlert.alert.date, currentDate) < 7
  })

  unsentAlerts = (
    await Promise.all(
      unsentAlerts.map(async (unsentAlert) => {
        const sentAlert = await sendAlert(unsentAlert.alert)
        if (sentAlert) {
          return null
        } else {
          unsentAlert.tries++
          return unsentAlert
        }
      }),
    )
  ).filter((unsentAlert) => !!unsentAlert)

  chrome.storage.local.set({ unsentAlerts })
}

export function timedCleanup() {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setInterval(cleanupUsernamesAndPasswords, hourValue)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setInterval(tryToSendFailedAlerts, hourValue)
}
