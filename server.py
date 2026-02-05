from flask import Flask, request, jsonify, send_from_directory
import os
import base64
from datetime import datetime

app = Flask(__name__, static_folder='.', static_url_path='')

PHOTOS_DIR = os.path.join(os.path.dirname(__file__), 'photos')
os.makedirs(PHOTOS_DIR, exist_ok=True)


@app.route('/api/photos', methods=['GET'])
def list_photos():
    files = [f for f in os.listdir(PHOTOS_DIR) if os.path.isfile(os.path.join(PHOTOS_DIR, f))]
    files.sort(reverse=True)
    # return relative URLs
    urls = [f'photos/{f}' for f in files]
    return jsonify(urls)


@app.route('/api/upload', methods=['POST'])
def upload_photo():
    data = request.json.get('data') if request.is_json else None
    if not data:
        return jsonify({'error': 'no data'}), 400

    # data is expected to be dataURL like "data:image/png;base64,...."
    if ',' in data:
        header, b64 = data.split(',', 1)
    else:
        return jsonify({'error': 'invalid data'}), 400

    try:
        binary = base64.b64decode(b64)
    except Exception as e:
        return jsonify({'error': 'decode error', 'detail': str(e)}), 400

    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    ext = 'png'
    if 'image/jpeg' in header:
        ext = 'jpg'
    filename = f'photo_{ts}.{ext}'
    path = os.path.join(PHOTOS_DIR, filename)
    with open(path, 'wb') as f:
        f.write(binary)

    return jsonify({'url': f'photos/{filename}'})


# serve photos directory directly via static route
@app.route('/photos/<path:filename>')
def serve_photo(filename):
    return send_from_directory(PHOTOS_DIR, filename)


@app.route('/')
def index():
    # serve index.html from project root
    return send_from_directory('.', 'index.html')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    print(f'Serving on http://{args.host}:{args.port} (Flask)')
    app.run(host=args.host, port=args.port, debug=True)
