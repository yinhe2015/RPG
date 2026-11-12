import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequestSignal} from '../src/request-signal.js';

test('request timeout aborts without cancelling its parent',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const parent=new AbortController(),request=createRequestSignal(70000,parent.signal);
 try{
  t.mock.timers.tick(69999);assert.equal(request.signal.aborted,false);
  t.mock.timers.tick(1);assert.equal(request.signal.aborted,true);
  assert.equal(request.signal.reason.name,'TimeoutError');assert.equal(parent.signal.aborted,false);
 }finally{request.dispose();}
});

test('leaving a battle cancels its pending requests with the original reason',()=>{
 const parent=new AbortController(),request=createRequestSignal(70000,parent.signal);
 try{
  const reason=new DOMException('Battle left','AbortError');parent.abort(reason);
  assert.equal(request.signal.aborted,true);assert.equal(request.signal.reason,reason);
 }finally{request.dispose();}
});

test('requests from an already cancelled battle start aborted',()=>{
 const parent=new AbortController();parent.abort();
 const request=createRequestSignal(70000,parent.signal);
 try{assert.equal(request.signal.aborted,true);assert.equal(request.signal.reason,parent.signal.reason);}
 finally{request.dispose();}
});

test('completed requests detach from later cancellation and timeouts',t=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const parent=new AbortController(),request=createRequestSignal(70000,parent.signal),standalone=createRequestSignal(100000);
 request.dispose();standalone.dispose();parent.abort();t.mock.timers.tick(100000);
 assert.equal(request.signal.aborted,false);assert.equal(standalone.signal.aborted,false);
});
