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

import * as React from 'react'
import { Alert, InputGroup, Intent, Label } from '@blueprintjs/core'
import { observer } from 'mobx-react'
import { manualUsernameStore } from './mobx/manualUsernameState'

export const ManualUsernameForm = observer(() => {
  return (
    <Alert
      isOpen={manualUsernameStore.isOpen}
      cancelButtonText={'Nevermind'}
      canEscapeKeyCancel={true}
      onCancel={() => {
        manualUsernameStore.setPopupState(false)
      }}
      canOutsideClickCancel={true}
      confirmButtonText={'Save username'}
      onConfirm={() => {
        void manualUsernameStore.hydrateUsername()
      }}
      intent={Intent.PRIMARY}
      icon={'manually-entered-data'}
    >
      <Label>
        Input username
        <InputGroup
          type={'password'}
          value={manualUsernameStore.currentUsername}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            manualUsernameStore.currentUsername = event.target.value
          }}
        />
      </Label>
    </Alert>
  )
})
