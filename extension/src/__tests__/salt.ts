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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as crypto from 'crypto'
import { getSalt } from '../lib/generateHash'

describe('Salt should work', () => {
  it('Salts should be long', () => {
    const saltOne = getSalt()
    expect(saltOne.length).toEqual(32)
  })

  it('Salts should be different', () => {
    const saltOne = getSalt()
    const saltTwo = getSalt()
    expect(saltOne).not.toEqual(saltTwo)
  })
})
