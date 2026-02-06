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
import * as ReactDOM from 'react-dom'
import '../../assets/normalize.css'
import '../../assets/blueprint-icons.css'
import '../../assets/blueprint.css'
import { App } from '../../components/app'

console.log('PhishCatch: popup script loaded')
const root = document.getElementById('root')
if (root) {
  ReactDOM.render(<App />, root)
  console.log('PhishCatch: React rendered')
} else {
  console.error('PhishCatch: #root element not found')
}
