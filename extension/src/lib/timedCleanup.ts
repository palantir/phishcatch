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
import { getUsernames, getPasswordHashes } from './userInfo'
import { getUnsentAlerts, sendAlert } from './sendAlert'
import { getSavedDomHashes } from './domhash'

const hourValue = 1000 * 60 * 60
const dayValue = hourValue * 24

export const passwordHashLimit = 20
export const domHashLimit = 50

export function dateDiffInDays(date1: number, date2: number) {
  const diffInMs = date2 - date1
  const diffInDays = diffInMs / dayValue
  return Math.abs(diffInDays)
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

async function cleanData(hashes: { dateAdded: number }[], hashLimit: number) {
  const config = await getConfig()
  const currentDate = new Date().getTime()

  return hashes
    .map((hash) => {
      if (typeof hash.dateAdded !== 'number') {
        hash.dateAdded = new Date().getTime()
      }

      return hash
    })
    .filter((hash) => {
      return dateDiffInDays(hash.dateAdded, currentDate) < config.data_expiry
    })
    .sort((hash1, hash2) => {
      return hash2.dateAdded - hash1.dateAdded
    })
    .slice(0, hashLimit)
}

export async function cleanupUsernamesAndPasswords() {
  const currentDate = new Date().getTime()
  const config = await getConfig()

  const usernames = (await getUsernames()).filter((username) => {
    return dateDiffInDays(username.dateAdded, currentDate) < config.data_expiry
  })

  const passwordHashes = await cleanData(await getPasswordHashes(), passwordHashLimit)

  const datedDomHashes = await cleanData(await getSavedDomHashes(), domHashLimit)

  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        usernames,
        passwordHashes,
        datedDomHashes,
      },
      () => {
        resolve(true)
      },
    )
  })
}

export async function tryToSendFailedAlerts() {
  const currentDate = new Date().getTime()

  let unsentAlerts = (await getUnsentAlerts()).filter((unsentAlert) => {
    const dateDiff = dateDiffInDays(unsentAlert.alert.alertTimestamp, currentDate)

    return dateDiff < 30
  })

  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  ).filter(notEmpty)

  chrome.storage.local.set({ unsentAlerts })

  return unsentAlerts
}

export function timedCleanup() {
  void tryToSendFailedAlerts()
  void cleanupUsernamesAndPasswords()

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setInterval(cleanupUsernamesAndPasswords, hourValue)

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setInterval(tryToSendFailedAlerts, hourValue)
}
