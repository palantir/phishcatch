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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Prefs, UrlSanitizationEnum } from './types'
import { dateDiffInDays } from './lib/timedCleanup'

interface configCache {
  config: Prefs
  timestamp: Date
}

const defaults: Prefs = {
  data_expiry: 30,
  display_reuse_alerts: true,
  enable_debug_gui: true,
  enterprise_domains: [],
  expire_hash_on_use: true,
  faq_link: null,
  hash_truncation_amount: 0,
  ignored_domains: [],
  manual_password_entry: false,
  pbkdf2_iterations: 100000,
  phishcatch_server: '',
  psk: '',
  repo_link: null,
  url_sanitization_level: UrlSanitizationEnum.host,
  username_regexes: [],
  username_selectors: [],
  banned_urls: [],
}

let configCache: configCache | false = false

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'managed') {
    clearCache()
  }
})

// eslint-disable-next-line @typescript-eslint/ban-types
export async function setConfigOverride(newConfig: Object) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ configOverride: newConfig }, () => {
        clearCache()
        resolve(true)
      })
    } catch (e) {
      reject()
    }
  })
}

export async function clearConfigOverride() {
  return new Promise((resolve) => {
    chrome.storage.local.set({ configOverride: false }, () => {
      resolve(true)
    })
  })
}

export async function getConfigOverride(): Promise<Prefs | false> {
  return new Promise((resolve) => {
    chrome.storage.local.get('configOverride', (data) => {
      if (data.configOverride) {
        const prefs = { ...defaults }

        Object.keys(data.configOverride).forEach((key) => {
          const value = data.configOverride[key]
          if (value || value === false) {
            ;(prefs as any)[key] = value
          }
        })
        resolve(prefs)
      } else {
        resolve(false)
      }
    })
  })
}

async function getManagedPreferences(): Promise<Prefs> {
  const prefs = { ...defaults }

  return new Promise((resolve) => {
    chrome.storage.managed.get(Object.keys(prefs), (storedPrefs: Prefs) => {
      Object.keys(storedPrefs).forEach((key) => {
        const value = (storedPrefs as any)[key]
        if (value || value === false) {
          ;(prefs as any)[key] = value
        }
      })

      resolve(prefs)
    })
  })
}

export function clearCache() {
  configCache = false
}

export async function getConfig(): Promise<Prefs> {
  if (configCache) {
    const cacheAgeInMinutes = dateDiffInDays(new Date().getTime(), configCache.timestamp.getTime())
    if (cacheAgeInMinutes < 10) {
      return configCache.config
    } else {
      clearCache()
    }
  }

  const configs = await Promise.all([getManagedPreferences(), getConfigOverride()])
  const managedConfig = configs[0]
  const configOverride = configs[1]

  let config: Prefs
  if (configOverride) {
    config = configOverride
  } else {
    config = managedConfig
  }

  configCache = {
    config,
    timestamp: new Date(),
  }
  return config
}
