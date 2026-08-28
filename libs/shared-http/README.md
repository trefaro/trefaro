# shared-http

How both clients talk to the server: the typed `ApiClient`, the API base URL
token, `ApiError` (which turns a problem response into something a page can
render), and the socket.io connection.

One place, so a change to error handling or to the base path reaches both
clients — and so relative URLs keep working identically behind the Angular dev
server's proxy and behind NGINX.

```bash
nx test shared-http
```
