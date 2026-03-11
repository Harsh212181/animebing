 export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  
  // Add a test header to every response
  const response = await next();
  response.headers.set('X-Test-Function', 'executed');
  
  // Special header for detail pages
  if (url.pathname.startsWith('/detail/')) {
    response.headers.set('X-Detail-Page', 'true');
  }
  
  return response;
}