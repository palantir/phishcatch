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

import TlshConstructor from './tlsh'
import { getConfig } from '../config'
import { DomainType, TLSHInstance, DatedDomHash, AlertTypes } from '../types'
import { getDomainType } from './getDomainType'
import { createServerAlert } from './sendAlert'
import { getHostFromUrl } from './getHostFromUrl'

// these indicate an error in tlsh
const forbiddenHashes = new Set([
  '0000000000000000000000000000000000000000000000000000000000000000000000',
  'ERROR IN PROCESSING',
])

export function getTlshInstance(str: string) {
  const instance = TlshConstructor()
  instance.update(str)
  instance.finale()

  return instance
}

export async function alertUser(host: string) {
  const config = await getConfig()

  void createServerAlert({
    timestamp: new Date(),
    alertType: AlertTypes.DOMHASH,
    referrer: '',
    url: host,
  })

  if (config.display_reuse_alerts) {
    // Iconurl: https://www.flaticon.com/free-icon/hacker_1995788?term=phish&page=1&position=49
    const alertIconUrl = chrome.runtime.getURL('icon.png')
    const opt = {
      type: 'basic',
      title: 'PhishCatch Alert',
      message: `PhishCatch has detected a likely phishing page at: ${host}\n`,
      iconUrl: alertIconUrl,
    }

    chrome.notifications.create(opt)

    if (config.extra_annoying_alerts) {
      alert("This looks like a phishing page! Be careful. Ask infosec if you're not sure what to do.")
    }
  }
}

export function loadTlshInstanceFromHash(hash: string) {
  const instance = TlshConstructor()
  instance.fromTlshStr(hash)
  return instance
}

export function hashesMatch(firstInstance: TLSHInstance, secondInstance: TLSHInstance, minDistance = 100) {
  const distance = firstInstance.totalDiff(secondInstance)

  return distance < minDistance
}

export async function saveDOMHash(dom: string, url: string) {
  if (!dom) {
    return
  }

  const instance = getTlshInstance(dom)
  const currentHash = instance.hash()
  if (forbiddenHashes.has(currentHash)) {
    console.error('hit a forbidden hash, not saving', currentHash)
    throw new Error('Forbidden hash!')
  }

  const savedDatedHashes = await getSavedDomHashes()
  const currentHashes = savedDatedHashes.map((hash) => {
    return loadTlshInstanceFromHash(hash.hash)
  })

  const existingHashIndex = currentHashes.findIndex((storedInstance) => {
    if (storedInstance.hash() === currentHash) {
      return true
    }
    return hashesMatch(storedInstance, instance)
  })

  return new Promise((resolve) => {
    if (existingHashIndex !== -1) {
      savedDatedHashes[existingHashIndex].dateAdded = new Date()
      resolve(true)
    } else {
      savedDatedHashes.push({ hash: currentHash, dateAdded: new Date(), source: getHostFromUrl(url) })

      chrome.storage.local.set({ domTlshHashes: currentHashes }, () => {
        resolve(true)
      })
    }
  })
}

export async function getSavedDomHashes(): Promise<DatedDomHash[]> {
  return new Promise((resolve) => {
    chrome.storage.local.get('datedDomHashes', (data: { datedDomHashes: DatedDomHash[] | undefined }) => {
      const hashes: DatedDomHash[] = data.datedDomHashes || []

      if (!data.datedDomHashes) {
        chrome.storage.local.set({ datedDomHashes: hashes }, () => {
          resolve(hashes)
        })
      } else {
        resolve(hashes)
      }
    })
  })
}

export async function getHashesAsTlshInstances(): Promise<TLSHInstance[]> {
  const currentHashes = await getSavedDomHashes()

  return currentHashes.map((hash: DatedDomHash) => {
    return loadTlshInstanceFromHash(hash.hash)
  })
}

export async function checkDOMHash(dom: string, url: string) {
  if (!dom) {
    throw 'No dom'
  }
  const host = getHostFromUrl(url)

  if ((await getDomainType(host)) === DomainType.DANGEROUS) {
    const newInstance: TLSHInstance = getTlshInstance(dom)
    const domHashes = await getHashesAsTlshInstances()
    if (domHashes.some((corporateInstance) => hashesMatch(corporateInstance, newInstance))) {
      await alertUser(url)
      return true
    }
  }

  return false
}
