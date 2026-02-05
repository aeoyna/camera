from werkzeug.serving import run_simple
from werkzeug.middleware.shared_data import SharedDataMiddleware
import os
import socket

# Get local IP
hostname = socket.gethostname()
local_ip = socket.gethostbyname(hostname)

# Middleware to serve static files from current directory
app = SharedDataMiddleware(None, 
    {'/': os.getcwd()}
)

if __name__ == '__main__':
    print(f"Starting Secure Server (HTTPS)...")
    print(f"Access URL: https://{local_ip}:8443/index.html")
    print("Note: You will see a security warning in the browser. Using 'Advanced' -> 'Proceed' is safe here.")
    
    # ssl_context='adhoc' generates a new self-signed cert on startup
    run_simple('0.0.0.0', 8443, app, ssl_context='adhoc')
