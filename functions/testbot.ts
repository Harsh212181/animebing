// functions/testbot.ts
export async function onRequest(context: any) {
  return new Response("Functions are working!", {
    headers: { 'Content-Type': 'text/plain' },
  });
}