/**
 * JBoss, Home of Professional Open Source
 * Copyright 2016, Red Hat, Inc. and/or its affiliates, and individual
 * contributors by the @authors tag. See the copyright.txt in the
 * distribution for a full listing of individual contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License")
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const express = require('express');
const router = express.Router();

const circuitBreaker = require('opossum');

const circuitBreakerOptions = {
  maxFailures: process.env.CB_MAX_FAIL || 5,
  timeout: process.env.CB_TIMEOUT || 1000,
  resetTimeout: process.env.CB_RESET_TIMEOUT || 10000
};

function fallback () {
  return 'Service is falling back';
}

const baseline = process.env.CB_BASELINE || 20;
let delay = baseline;

function flakeFunction () {
  return new Promise((resolve, reject) => {
    if (delay > 1000) {
      return reject('Flakey Service is Flakey');
    }

    setTimeout(() => {
      console.log('replying with flakey response after delay of ', delay);
      resolve(`Sending flakey service. Current Delay at ${delay}`);
      delay = delay * 2;
    }, delay);
  });
}

setInterval(() => {
  if (delay !== baseline) {
    delay = baseline;
    console.log('resetting flakey service delay', delay);
  }
}, 20000);

const circuit = circuitBreaker(flakeFunction, circuitBreakerOptions);
circuit.fallback(fallback);

router.get('/', (request, response) => {
  circuit.fire().then((result) => {
    response.send(result);
  }).catch((err) => {
    response.send(err);
  });
});

// Simple endpoint to easily view our circuit breaker options;
router.get('/breakeroptions', (request, response) => {
  response.send(Object.assign({}, circuitBreakerOptions, {basline: baseline}));
});

module.exports = exports = router;
