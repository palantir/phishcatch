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

import { Button, Card, Elevation } from '@blueprintjs/core'
import { observer } from 'mobx-react'
import * as React from 'react'
import { popupStore } from './mobx/popupState'
import { ConfigOverrideForm } from './configOverrideForm'
import { AppToaster } from './toaster'

function makeLi(thing: string) {
  return <li key={thing}>{thing}</li>
}

@observer
export class Debug extends React.Component {
  render() {
    const usernames = popupStore.usernameList.map(makeLi)
    const passwords = popupStore.passwordHashList.map(makeLi)
    const domHashes = popupStore.domHashList.map(makeLi)

    return (
      <div style={{ width: '50em', margin: '3em' }}>
        <h1>PhishCatch Debug</h1>

        <Card elevation={Elevation.TWO}>
          <h3>Current Config:</h3>
          <pre>{JSON.stringify(popupStore.config, null, 2)}</pre>

          <Button
            style={{ marginTop: '1.5em' }}
            intent="primary"
            onClick={async () => {
              await popupStore.loadConfig()
              AppToaster.show({ message: 'Refreshed config!', intent: 'success' })
            }}
          >
            Reload Config
          </Button>
        </Card>

        {<ConfigOverrideForm />}

        <Card elevation={Elevation.TWO}>
          <h3>Current Data:</h3>

          <h5>Usernames</h5>
          <ul>{usernames}</ul>

          <h5>Password Hashes</h5>
          <ul>{passwords}</ul>

          <h5>DOM Hashes</h5>
          <ul>{domHashes}</ul>

          <h5>Unsent Alerts</h5>
          <ul>{popupStore.numberOfUnsentAlerts}</ul>
        </Card>
      </div>
    )
  }
}
