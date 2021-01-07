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
import { Alert, Intent } from '@blueprintjs/core'
import { observer } from 'mobx-react'
import { reportPhishingStore } from './mobx/reportPhishingState'

export const ReportPhishingPopup = observer(() => {
  return (
    <Alert
      isOpen={reportPhishingStore.isOpen}
      cancelButtonText={'Nevermind'}
      canEscapeKeyCancel={true}
      onCancel={() => {
        reportPhishingStore.setPopupState(false)
      }}
      canOutsideClickCancel={true}
      confirmButtonText={'This is phishing'}
      onConfirm={() => {
        reportPhishingStore.createReport()
      }}
      intent={Intent.PRIMARY}
      icon={'warning-sign'}
    >
      Does this look like a phishing page? Bias towards reporting.
    </Alert>
  )
})
