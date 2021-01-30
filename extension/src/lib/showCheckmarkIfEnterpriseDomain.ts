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

import { DomainType } from '../types'
import { getHostFromUrl } from './getHostFromUrl'
import { getDomainType } from './getDomainType'

async function updateBadge(tab: chrome.tabs.Tab) {
  if (tab.active && tab.url) {
    const host = getHostFromUrl(tab.url)

    if ((await getDomainType(host)) === DomainType.ENTERPRISE) {
      chrome.browserAction.setBadgeText({ text: '✅' })
    } else {
      chrome.browserAction.setBadgeText({ text: '' })
    }
  }
}

export function showCheckmarkIfEnterpriseDomain() {
  try {
    chrome.browserAction.setBadgeBackgroundColor({ color: 'green' })
    chrome.tabs.onUpdated.addListener((tabID, change, tab) => {
      void updateBadge(tab)
    })
    chrome.tabs.onActivated.addListener((activeInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab) => {
        void updateBadge(tab)
      })
    })
  } catch (e) {
    // https://github.com/clarkbw/jest-webextension-mock/pull/127
  }
}
