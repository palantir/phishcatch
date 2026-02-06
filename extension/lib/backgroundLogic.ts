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

import { browser } from 'wxt/browser'
import { getConfig } from '../utils/config'
import {
  PageMessage,
  UsernameContent,
  PasswordContent,
  DomstringContent,
  PasswordHandlingReturnValue,
  DomainType,
  AlertTypes,
  PasswordHash,
} from '../utils/types'
import { hashAndSavePassword as hashAndSavePassword, saveUsername, getHashDataIfItExists, removeHash } from './userInfo'
import { checkDOMHash, saveDOMHash } from './domhash'
import { createServerAlert } from './sendAlert'
import { getDomainType } from './getDomainType'
import { getHostFromUrl } from './getHostFromUrl'
import { addNotitication } from './handleNotificationClick'

export async function receiveMessage(message: PageMessage): Promise<void> {
  switch (message.msgtype) {
    case 'debug': {
      break
    }
    case 'username': {
      const content = message.content as UsernameContent

      if ((await getDomainType(getHostFromUrl(content.url))) === DomainType.ENTERPRISE) {
        void saveUsername(content.username)
        void saveDOMHash(content.dom, content.url)
      }
      break
    }
    case 'password': {
      const content = message.content as PasswordContent
      if (content.password) {
        void handlePasswordEntry(content)
      }
      break
    }
    case 'domstring': {
      const content = message.content as DomstringContent
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

  if ((await getDomainType(host)) === DomainType.ENTERPRISE) {
    if (message.save) {
      await hashAndSavePassword(password, message.username, host)
      return PasswordHandlingReturnValue.EnterpriseSave
    }
    return PasswordHandlingReturnValue.EnterpriseNoSave
  } else if ((await getDomainType(host)) === DomainType.DANGEROUS) {
    const hashData = await getHashDataIfItExists(password)
    if (hashData) {
      await handlePasswordLeak(message, hashData)
      return PasswordHandlingReturnValue.ReuseAlert
    }
  } else {
    return PasswordHandlingReturnValue.IgnoredDomain
  }

  return PasswordHandlingReturnValue.NoReuse
}

async function handlePasswordLeak(message: PasswordContent, hashData: PasswordHash) {
  const config = await getConfig()
  const alertContent = {
    ...message,
    alertType: AlertTypes.REUSE,
    associatedHostname: hashData.hostname || '',
    associatedUsername: hashData.username || '',
  }

  void createServerAlert(alertContent)

  if (config.display_reuse_alerts) {
    // Iconurl: https://www.flaticon.com/free-icon/hacker_1995788?term=phish&page=1&position=49
    const alertIconUrl = browser.runtime.getURL('icon.png')
    const opt: chrome.notifications.NotificationOptions = {
      type: 'basic',
      title: 'PhishCatch Alert',
      message: `PhishCatch has detected enterprise password re-use on the url: ${message.url}\n`,
      iconUrl: alertIconUrl,
      requireInteraction: true,
      priority: 2,
      buttons: [{ title: 'This is a false positive' }, { title: `That wasn't my enterprise password` }],
    }

    const id = await browser.notifications.create(opt)
    addNotitication({ id, hash: hashData.hash, url: message.url })
  }

  if (config.expire_hash_on_use) {
    await removeHash(hashData.hash)
  }
}
