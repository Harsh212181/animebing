export async function onRequest(context) {
  return new Response('✅ Pages Function is working! Path: ' + context.request.url);
}