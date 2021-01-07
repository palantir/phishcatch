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

import { getConfig } from './config'
import {
  PageMessage,
  UsernameContent,
  PasswordContent,
  DomstringContent,
  PasswordHandlingReturnValue,
  DomainType,
  AlertTypes,
} from './types'
import { hashAndSavePassword as hashAndSavePassword, saveUsername, checkStoredHashes } from './lib/userInfo'
import { checkDOMHash, saveDOMHash } from './lib/domhash'
import { showCheckmarkIfEnterpriseDomain } from './lib/showCheckmarkIfEnterpriseDomain'
import { createServerAlert } from './lib/sendAlert'
import { getDomainType } from './lib/getDomainType'
import { getHostFromUrl } from './lib/getHostFromUrl'
import { timedCleanup } from './lib/timedCleanup'
import { addNotitication, handleNotificationClick } from './lib/handleNotificationClick'

export async function receiveMessage(message: PageMessage): Promise<void> {
  switch (message.msgtype) {
    case 'debug': {
      break
    }
    case 'username': {
      const content = <UsernameContent>message.content

      if ((await getDomainType(getHostFromUrl(content.url))) === DomainType.ENTERPRISE) {
        void saveUsername(content.username)
        void saveDOMHash(content.dom, content.url)
      }
      break
    }
    case 'password': {
      const content = <PasswordContent>message.content
      if (content.password) {
        void handlePasswordEntry(content)
      }
      break
    }
    case 'domstring': {
      const content = <DomstringContent>message.content
      void checkDOMHash(content.dom, content.url)
      break
    }
  }
}

//check if the site the password was entered into is a corporate site
export async function handlePasswordEntry(message: PasswordContent) {
  const url = message.url
  const host = getHostFromUrl(url)
  const password = message.password
  const config = await getConfig()

  if ((await getDomainType(host)) === DomainType.ENTERPRISE) {
    if (message.save) {
      await hashAndSavePassword(password)
      return PasswordHandlingReturnValue.EnterpriseSave
    }
    return PasswordHandlingReturnValue.EnterpriseNoSave
  } else if ((await getDomainType(host)) === DomainType.DANGEROUS) {
    const hashData = await checkStoredHashes(password)
    if (hashData.hashExists) {
      void createServerAlert({ ...message, alertType: AlertTypes.REUSE })

      if (config.display_reuse_alerts) {
        // Iconurl: https://www.flaticon.com/free-icon/hacker_1995788?term=phish&page=1&position=49
        const alertIconUrl = chrome.runtime.getURL('icon.png')
        const opt: chrome.notifications.NotificationOptions = {
          type: 'basic',
          title: 'PhishCatch Alert',
          message: `PhishCatch has detected corporate password re-use with the url: ${url}\n`,
          iconUrl: alertIconUrl,
          requireInteraction: true,
          priority: 2,
          buttons: [{ title: 'This is a false positive' }, { title: `That wasn't my enterprise password` }],
        }

        chrome.notifications.create(opt, (id) => {
          addNotitication({ id, hash: hashData.hash.hash, url })
        })

        if (config.extra_annoying_alerts) {
          alert('You may have just entered your password on a phishing page! Probably best to ping infosec.')
        }
      }

      return PasswordHandlingReturnValue.ReuseAlert
    }
  } else {
    return PasswordHandlingReturnValue.IgnoredDomain
  }

  return PasswordHandlingReturnValue.NoReuse
}

function setup() {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  chrome.runtime.onMessage.addListener(receiveMessage)
  chrome.notifications.onButtonClicked.addListener(handleNotificationClick)

  void showCheckmarkIfEnterpriseDomain()
  timedCleanup()
}

setup()
