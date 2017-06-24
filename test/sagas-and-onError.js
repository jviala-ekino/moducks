import test from 'tape'
import { applyMiddleware, createStore } from 'redux'
import createSagaMiddleware, { delay, END } from 'redux-saga'
import { call, fork, spawn, take, takeEvery } from 'redux-saga/effects'
import { createModule, flattenSagas, retrieveWorkers } from '../src'

function configureStore(reducer, sagas) {

  const sagaMiddleware = createSagaMiddleware()

  const store = createStore(
    reducer,
    applyMiddleware(sagaMiddleware),
  )

  return {
    ...store,
    runSaga: () => sagaMiddleware.run(function* () {
      yield flattenSagas(sagas)
    }).done,
  }
}

async function callApiAsync(payload) {

  await delay(1)

  if (payload.includes('foo')) {
    return `Success_${payload}`
  } else {
    throw `Failure_${payload}`
  }
}

test('[Sagas and onError] it should automatically wrapped by enhanced takeEvery', assert => {
  assert.plan(1)

  const events = []
  const { myClient, sagas, requestSuccess, requestFailure } = createModule('myClient', {
    REQUEST: {
      saga: function* (action) {
        events.push(`run request: ${action.payload}`)
        const response = yield call(callApiAsync, action.payload)
        events.push(`receive response: ${response}`)
        return requestSuccess(response)
      },
      onError: (e, action) => {
        events.push(`trigger onError: ${e} ${action.payload}`)
        return requestFailure(e)
      },
    },
    REQUEST_SUCCESS: (state, action) => {
      events.push(`trigger request success: ${action.payload}`)
      return state
    },
    REQUEST_FAILURE: (state, action) => {
      events.push(`trigger request failure: ${action.payload}`)
      return state
    },
  }, {})

  const store = configureStore(myClient, sagas)

  store.runSaga().then(() => {
    assert.deepEqual(events, [
      'run request: foo1',
      'run request: bar2',
      'run request: foo3',
      'receive response: Success_foo1',
      'trigger request success: Success_foo1',
      'trigger onError: Failure_bar2 bar2',
      'trigger request failure: Failure_bar2',
      'receive response: Success_foo3',
      'trigger request success: Success_foo3',
    ])
    assert.end()
  })

  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo1' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'bar2' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo3' })
  store.dispatch(END)
})

test('[Sagas and onError] it should work with enhanced takeEvery', assert => {
  assert.plan(1)

  const events = []
  const { myClient, sagas, requestSuccess, requestFailure } = createModule('myClient', {
    REQUEST: {
      saga: ({ type, takeEvery }) => takeEvery(type, function* (action) {
        events.push(`run request: ${action.payload}`)
        const response = yield call(callApiAsync, action.payload)
        events.push(`receive response: ${response}`)
        return requestSuccess(response)
      }),
      onError: (e, action) => {
        events.push(`trigger onError: ${e} ${action.payload}`)
        return requestFailure(e)
      },
    },
    REQUEST_SUCCESS: (state, action) => {
      events.push(`trigger request success: ${action.payload}`)
      return state
    },
    REQUEST_FAILURE: (state, action) => {
      events.push(`trigger request failure: ${action.payload}`)
      return state
    },
  }, {})

  const store = configureStore(myClient, sagas)

  store.runSaga().then(() => {
    assert.deepEqual(events, [
      'run request: foo1',
      'run request: bar2',
      'run request: foo3',
      'receive response: Success_foo1',
      'trigger request success: Success_foo1',
      'trigger onError: Failure_bar2 bar2',
      'trigger request failure: Failure_bar2',
      'receive response: Success_foo3',
      'trigger request success: Success_foo3',
    ])
    assert.end()
  })

  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo1' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'bar2' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo3' })
  store.dispatch(END)
})

test('[Sagas and onError] it should work with enhanced fork', assert => {
  assert.plan(1)

  const events = []
  const { myClient, sagas, requestSuccess, requestFailure } = createModule('myClient', {
    REQUEST: {
      saga: ({ type, fork }) => function* () {
        while (true) { // eslint-disable-line no-constant-condition
          const action = yield take(type)
          yield fork(function* () {
            events.push(`run request: ${action.payload}`)
            const response = yield call(callApiAsync, action.payload)
            events.push(`receive response: ${response}`)
            return requestSuccess(response)
          }, action)
        }
      },
      onError: (e, action) => {
        events.push(`trigger onError: ${e} ${action.payload}`)
        return requestFailure(e)
      },
    },
    REQUEST_SUCCESS: (state, action) => {
      events.push(`trigger request success: ${action.payload}`)
      return state
    },
    REQUEST_FAILURE: (state, action) => {
      events.push(`trigger request failure: ${action.payload}`)
      return state
    },
  }, {})

  const store = configureStore(myClient, sagas)

  store.runSaga().then(() => {
    assert.deepEqual(events, [
      'run request: foo1',
      'run request: bar2',
      'run request: foo3',
      'receive response: Success_foo1',
      'trigger request success: Success_foo1',
      'trigger onError: Failure_bar2 bar2',
      'trigger request failure: Failure_bar2',
      'receive response: Success_foo3',
      'trigger request success: Success_foo3',
    ])
    assert.end()
  })

  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo1' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'bar2' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo3' })
  store.dispatch(END)
})

test('[Sagas and onError] it should work with manually enhanced generator', assert => {
  assert.plan(1)

  const events = []
  const { myClient, sagas, requestSuccess, requestFailure } = createModule('myClient', {
    REQUEST: {
      saga: ({ type, enhance }) => function* () {
        while (true) { // eslint-disable-line no-constant-condition
          const action = yield take(type)
          yield fork(enhance(function* () {
            events.push(`run request: ${action.payload}`)
            const response = yield call(callApiAsync, action.payload)
            events.push(`receive response: ${response}`)
            return requestSuccess(response)
          }), action)
        }
      },
      onError: (e, action) => {
        events.push(`trigger onError: ${e} ${action.payload}`)
        return requestFailure(e)
      },
    },
    REQUEST_SUCCESS: (state, action) => {
      events.push(`trigger request success: ${action.payload}`)
      return state
    },
    REQUEST_FAILURE: (state, action) => {
      events.push(`trigger request failure: ${action.payload}`)
      return state
    },
  }, {})

  const store = configureStore(myClient, sagas)

  store.runSaga().then(() => {
    assert.deepEqual(events, [
      'run request: foo1',
      'run request: bar2',
      'run request: foo3',
      'receive response: Success_foo1',
      'trigger request success: Success_foo1',
      'trigger onError: Failure_bar2 bar2',
      'trigger request failure: Failure_bar2',
      'receive response: Success_foo3',
      'trigger request success: Success_foo3',
    ])
    assert.end()
  })

  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo1' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'bar2' })
  store.dispatch({ type: 'myClient/REQUEST', payload: 'foo3' })
  store.dispatch(END)
})

test('[Sagas and onError] it should bundle additional sagas', assert => {

  const expected1 = {
    foo: function* s1() { },
    bar: function* s2() { },
    baz: function* s3() { },
    qux: function* s4() { },
  }
  const expected2 = {
    foo: takeEvery('dummy/FOO', expected1.foo),
    bar: fork(expected1.bar),
    baz: fork(expected1.baz),
    qux: spawn(expected1.qux),
  }
  const { sagas } = createModule('dummy', {
    FOO: {
      saga: ({ type }) => takeEvery(type, expected1.foo),
    },
    BAR: {
      saga: () => expected1.bar,
    },
  }, {}, {
    baz: expected1.baz,
    qux: spawn(expected1.qux),
  })

  assert.deepEqual(sagas, expected2)
  assert.deepEqual(retrieveWorkers(sagas), expected1)
  assert.end()
})
