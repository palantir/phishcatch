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

import { Button, Card, TextArea } from '@blueprintjs/core'
import { observer } from 'mobx-react'
import * as React from 'react'
import { configOverrideStore } from './mobx/configOverride'
import { popupStore } from './mobx/popupState'

@observer
export class ConfigOverrideForm extends React.Component {
  constructor(props: unknown) {
    super(props)
  }

  render() {
    return (
      <div>
        <Card>
          <h3>Config Override:</h3>
          <TextArea
            growVertically={true}
            large={true}
            value={configOverrideStore.overrideFormText}
            onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
              configOverrideStore.overrideFormText = event.target.value
            }}
            spellCheck={false}
            style={{ width: '100%' }}
          />
          <div style={{ marginTop: '1.5em' }}>
            <Button
              intent={'primary'}
              onClick={async () => {
                try {
                  await configOverrideStore.setConfigOverride(configOverrideStore.overrideFormText)
                  await popupStore.loadConfig()
                } catch (e) {}
              }}
            >
              Save
            </Button>
            <Button
              style={{ marginLeft: '1.5em' }}
              intent={'warning'}
              onClick={async () => {
                await configOverrideStore.clearConfigOverride()
                this.setState({ currentText: '' })
                await popupStore.loadConfig()
              }}
            >
              Clear
            </Button>
          </div>
        </Card>
      </div>
    )
  }
}
