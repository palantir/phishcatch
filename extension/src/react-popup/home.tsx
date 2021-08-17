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

import * as React from 'react'
import { Button, Card, Tooltip } from '@blueprintjs/core'
import { popupStore } from './mobx/popupState'
import { reportPhishingStore } from './mobx/reportPhishingState'
import { ReportPhishingPopup } from './reportPhishingPopup'
import { ManualPasswordForm } from './manualPasswordForm'
import { ManualUsernameForm } from './manualUsernameForm'
import { manualPasswordStore } from './mobx/manualPasswordState'
import { manualUsernameStore } from './mobx/manualUsernameState'

export function Home() {
  return (
    <div>
      <Card>
        <p>
          PhishCatch is a browser extension that prevents corporate passwords from being leaked and sends infosec an
          alert when they are.
        </p>
      </Card>

      <Card style={{ paddingTop: '1.5em', display: 'grid', justifyContent: 'space-evenly', gridAutoFlow: 'column' }}>
        {popupStore.config.phishcatch_server && (
          <Button
            intent="success"
            onClick={() => {
              reportPhishingStore.setPopupState(true)
            }}
            icon={'warning-sign'}
          >
            Report Current Page
          </Button>
        )}

        {popupStore.config.manual_password_entry && (
          <Tooltip content={`Manually hash and save a password so that reuse can be detected`}>
            <Button
              intent="primary"
              onClick={() => {
                manualPasswordStore.setPopupState(true)
              }}
              icon={'manually-entered-data'}
            >
              Input password
            </Button>
          </Tooltip>
        )}

        <Tooltip content={`Save a username`}>
          <Button
            intent="primary"
            onClick={() => {
              manualUsernameStore.setPopupState(true)
            }}
            icon={'manually-entered-data'}
          >
            Input username
          </Button>
        </Tooltip>

        <Button
          intent="danger"
          onClick={() => {
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            chrome.storage.local.clear(async () => {
              await popupStore.clearStorage()
              await popupStore.loadConfig()
            })
          }}
          icon={'trash'}
        >
          Clear Storage
        </Button>
      </Card>

      <ReportPhishingPopup />
      <ManualPasswordForm />
      <ManualUsernameForm />
    </div>
  )
}
