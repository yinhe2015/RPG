// Keep cancellation and timeouts working without AbortSignal.any/timeout.
// Dispose only after the response body (including a stream) has been consumed.
export function createRequestSignal(timeoutMs,parent){
 const controller=new AbortController();
 const cancel=()=>controller.abort(parent.reason);
 const timer=setTimeout(()=>controller.abort(new DOMException('请求超时，请重试。','TimeoutError')),timeoutMs);
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 return {
  signal:controller.signal,
  dispose(){clearTimeout(timer);parent?.removeEventListener('abort',cancel);},
 };
}
