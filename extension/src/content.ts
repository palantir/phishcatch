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

import { debounce } from './content-lib/debounce'
import { getSanitizedUrl } from './lib/getSanitizedUrl'
import { getDomainType } from './lib/getDomainType'
import { DomainType, PasswordContent, UsernameContent } from './types'
import { getConfig } from './config'

// wait for page to load before doing anything
function ready(callbackFunc: () => void) {
  if (document.readyState !== 'loading') {
    callbackFunc()
  } else if (document.addEventListener) {
    document.addEventListener('DOMContentLoaded', callbackFunc)
  }
}

function runHardCodedUsernameScrapers() {
  if (window.location.hostname === 'login.microsoftonline.com') {
    const displayNameNode = document.getElementById('displayName')
    if (displayNameNode) {
      void saveUsername(displayNameNode.textContent)
    }
  }
}

async function scrapeUsernames() {
  const config = await getConfig()

  runHardCodedUsernameScrapers()

  config.username_selectors.forEach((selector) => {
    const usernameNode = document.querySelector(selector)
    if (usernameNode.nodeName === 'input') {
      const usernameFormNode = <HTMLInputElement>usernameNode
      if (usernameFormNode.value && usernameFormNode.type !== 'password') {
        void saveUsername(usernameFormNode.value)
      }
    } else if (usernameNode.textContent) {
      void saveUsername(usernameNode.textContent)
    }
  })
}

// Send the password to the background script to be hashed and compared
async function checkPassword(password: string, save: boolean) {
  const content: PasswordContent = {
    password,
    save,
    url: await getSanitizedUrl(location.href),
    referrer: await getSanitizedUrl(document.referrer),
    timestamp: new Date(),
  }
  chrome.runtime.sendMessage({
    msgtype: 'password',
    content,
  })

  if (save) {
    void scrapeUsernames()
  }
}

// Send username to the background script to be saved
async function saveUsername(username: string) {
  if (typeof username === 'string') {
    return
  }

  const content: UsernameContent = {
    username,
    url: await getSanitizedUrl(location.href),
    dom: document.getElementsByTagName('body')[0].innerHTML,
  }
  chrome.runtime.sendMessage({
    msgtype: 'username',
    content,
  })
}

function entepriseFormSubmissionTrigger(event: KeyboardEvent) {
  if (event.key == 'U+000A' || event.key == 'Enter' || event.keyCode == 13) {
    const target = event.target as HTMLInputElement
    if (target.nodeName === 'INPUT' && target.type === 'password') {
      void checkPassword(target.value, true)
    }
    return false
  }
}

function enterpriseFocusOutTrigger(event: FocusEvent) {
  const target = event.target as HTMLInputElement

  if (target.nodeName === 'INPUT' && target.type === 'password') {
    void checkPassword(target.value, true)
  }
}

// Debounce password checks to avoid hashing the password on every single input
const debouncedCheckPassword = debounce(checkPassword, 100)

function inputChangedTrigger(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.nodeName === 'INPUT' && target.type === 'password') {
    debouncedCheckPassword(target.value, false)
  }
}

async function checkDomHash() {
  chrome.runtime.sendMessage({
    msgtype: 'domstring',
    content: {
      dom: document.getElementsByTagName('body')[0].innerHTML,
      url: await getSanitizedUrl(location.href),
    },
  })
}

ready(() => {
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    if ((await getDomainType(window.location.hostname)) === DomainType.ENTERPRISE) {
      document.addEventListener('focusout', void enterpriseFocusOutTrigger, false)
      window.addEventListener('keydown', entepriseFormSubmissionTrigger, true)
      void checkDomHash()
    } else if ((await getDomainType(window.location.hostname)) === DomainType.DANGEROUS) {
      document.addEventListener('input', inputChangedTrigger, false)
      void checkDomHash()
    }
  }, 1500)
})
