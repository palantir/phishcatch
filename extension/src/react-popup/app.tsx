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

import { Alignment, Button, Navbar } from '@blueprintjs/core'
import { observer } from 'mobx-react'
import * as React from 'react'
import { popupStore } from './mobx/popupState'
import { Debug } from './debug'
import { Home } from './home'

@observer
export class App extends React.Component {
  faqLink() {
    const faqLink = popupStore.config.faq_link
    if (faqLink) {
      return (
        <Button
          className="bp3-minimal"
          icon="help"
          text="FAQ"
          onClick={() => {
            chrome.tabs.create({ url: faqLink })
          }}
        />
      )
    }
  }

  repoLink() {
    const repoLink = popupStore.config.repo_link
    if (repoLink) {
      return (
        <Button
          className="bp3-minimal"
          icon="git-repo"
          text="Source Code"
          onClick={() => {
            chrome.tabs.create({ url: repoLink })
          }}
        />
      )
    }
  }

  debugLink() {
    if (popupStore.config.enable_debug_gui) {
      return (
        <Button
          onClick={() => {
            void popupStore.loadConfig()
            popupStore.showDebug = true
          }}
          icon={'database'}
          text="Debug"
        />
      )
    }
  }

  render() {
    if (popupStore.showDebug) {
      return <Debug />
    }

    if (!popupStore.configReady) {
      return <div />
    }

    return (
      <div style={{ width: '50em' }} className="bp3-dark">
        <Navbar>
          <Navbar.Group align={Alignment.LEFT}>
            <Navbar.Heading>PhishCatch</Navbar.Heading>
            {(popupStore.config.repo_link || popupStore.config.faq_link) && <Navbar.Divider />}
            {this.faqLink()}
            {this.repoLink()}
            {<Navbar.Divider />}
            {popupStore.config.enable_debug_gui && this.debugLink()}
          </Navbar.Group>
        </Navbar>
        <Home />
      </div>
    )
  }
}
