// The service worker normally answers shares (public/sw.js). This only runs if
// it isn't active yet, e.g. right after installing the app.
export function POST(request: Request) {
  return Response.redirect(new URL("/debrief?shared=retry", request.url), 303)
}
