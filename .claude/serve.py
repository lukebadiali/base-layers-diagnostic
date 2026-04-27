#!/usr/bin/env python3
import os, sys
os.chdir("/Users/lukebadiali/Documents/BeDeveloped/BeDeveloped/AI Projects/base-layers-app")
import http.server, socketserver
PORT = int(os.environ.get("PORT", "5178"))
Handler = http.server.SimpleHTTPRequestHandler
class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True
with ReusableTCPServer(("", PORT), Handler) as httpd:
    sys.stderr.write(f"serving at http://localhost:{PORT}\n")
    sys.stderr.flush()
    httpd.serve_forever()
