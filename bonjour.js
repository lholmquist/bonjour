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
const path = require('path');
const express = require('express');
const session = require('express-session');
const zipkin = require('./lib/zipkin');
const api = require('./lib/api');

const app = express();

app.use(express.static(path.join(__dirname, 'public/swagger')));

// Create a session-store to be used by both the express-session
// middleware and the keycloak middleware.
const memoryStore = new session.MemoryStore();

app.use(session({
  secret: 'mySecret',
  resave: false,
  saveUninitialized: true,
  store: memoryStore
}));

// Use our zipkin integration
app.use(zipkin);

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Setup Circuit
const roi = require('roi');
const circuitBreaker = require('opossum');

const nextService = 'ola';

// circuit breaker
const circuitOptions = {
  maxFailures: 5,
  timeout: 1000,
  resetTimeout: 10000,
  name: nextService,
  group: `http://{$nextService}:8080`
};

// Circuit Breaker fallback function
function fallback () {
  return [`The ${nextService} service is currently unavailable.`];
}

// Setup the circuit breaker
const circuit = circuitBreaker(roi.get, circuitOptions);
circuit.fallback(fallback);

// Pass the MemoryStore, circuit and the nextservice name into the api route
app.use('/api', api.routes({memoryStore, circuit, nextService}));

// Create a SSE stream for streaming Hystrix Data
app.get('/hystrix.stream', (request, response) => {
  response.writeHead(200, {'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive'});
  response.write('retry: 10000\n');
  response.write('event: connecttime\n');
  circuit.hystrixStats.getHystrixStream().pipe(response);
});

// default route (should be swagger)
app.get('/', (req, res) => res.send('Logged out'));

const server = app.listen(8080, '0.0.0.0', () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('Bonjour service running at http://%s:%s', host, port);
});
