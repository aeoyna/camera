// HTTPS Check
if (location.protocol !== 'https:' && location.hostname !== 'localhost' && !location.hostname.includes('127.0.0.1')) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:#000;color:#fff;z-index:9999;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;text-align:center;';
  overlay.innerHTML = '<h1>⚠️ セキュリティ制限</h1><p>カメラを使用するには<br>HTTPS接続が必要です。</p><br><p>以下を押して移動してください:</p><br><a href="' + location.href.replace('http:', 'https:') + '" style="color:#4da6ff;font-size:18px;background:#333;padding:10px 20px;border-radius:4px;text-decoration:none;">HTTPS版へ移動する</a>';
  document.body.appendChild(overlay);
  throw new Error('HTTPS Required');
}

const shutter = document.getElementById('shutter');
const thumb = document.getElementById('thumb');
const modeItems = document.querySelectorAll('.mode-item');

let stream = null;
let imageCapture = null;

// IndexedDB helper (変更なし)
const DB_NAME = 'camera-db';
const DB_STORE = 'photos';
let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        const os = db.createObjectStore(DB_STORE, { keyPath: 'id', autoIncrement: true });
        os.createIndex('ts', 'ts');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function savePhotoToDB(dataUrl) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const item = { data: dataUrl, ts: Date.now() };
    const rq = store.add(item);
    rq.onsuccess = () => resolve(rq.result);
    rq.onerror = () => reject(rq.error);
  });
}

async function getAllPhotosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const store = tx.objectStore(DB_STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const list = req.result || [];
      list.sort((a, b) => b.ts - a.ts);
      resolve(list);
    };
    req.onerror = () => reject(req.error);
  });
}

let currentFacingMode = 'environment';

async function startCamera() {
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
  }

  // Mirroring logic: flip if user (front) camera
  if (currentFacingMode === 'user') {
    video.classList.add('mirrored');
  } else {
    video.classList.remove('mirrored');
  }

  try {
    // High Resolution Constraints
    const constraints = {
      video: {
        facingMode: { exact: currentFacingMode },
        width: { ideal: 3840 },
        height: { ideal: 2160 }
      },
      audio: false
    };

    stream = await navigator.mediaDevices.getUserMedia(constraints);
    stream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = stream;
    // Android等でブラックアウト回避のため明示的に再生
    await video.play();

    // Show actual resolution for debugging
    setTimeout(() => {
      showToast(`解像度: ${video.videoWidth} x ${video.videoHeight}`);
    }, 1000);

    // Init Zoom
    initZoom(stream);
    // Init ImageCapture (High Quality Photo)
    initImageCapture(stream);

  } catch (e) {
    console.warn(`Camera start failed with mode ${currentFacingMode}:`, e);

    // フォールバック
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: currentFacingMode },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      initZoom(stream);
    } catch (err2) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        await video.play();
        initZoom(stream);
      } catch (err3) {
        alert('カメラの起動に失敗しました: ' + err3.message);
      }
    }
  }
}

// Zoom Logic
const zoomContainer = document.getElementById('zoom-container');
const zoomSlider = document.getElementById('zoom-slider');

function initZoom(stream) {
  if (!stream) return;
  const track = stream.getVideoTracks()[0];
  if (!track) return;

  const caps = track.getCapabilities();

  if (caps.zoom) {
    // Native Zoom Supported
    zoomContainer.classList.add('visible');
    zoomSlider.min = caps.zoom.min;
    zoomSlider.max = caps.zoom.max;
    zoomSlider.step = caps.zoom.step || 0.1;
    zoomSlider.value = track.getSettings().zoom || 1;

    zoomSlider.oninput = () => {
      track.applyConstraints({
        advanced: [{ zoom: parseFloat(zoomSlider.value) }]
      }).catch(e => console.error('Zoom failed', e));
    };
  } else {
    // Native Zoom Not Supported
    console.log('Native zoom not supported');
    zoomContainer.classList.remove('visible');
  }
}

// Add event listener if it doesn't exist yet (to be safe, though we know it's missing)
const switchBtn = document.getElementById('switch-btn');
if (switchBtn) {
  switchBtn.addEventListener('click', () => {
    currentFacingMode = (currentFacingMode === 'environment') ? 'user' : 'environment';

    // Visual feedback
    switchBtn.style.transform = 'rotate(180deg)';
    setTimeout(() => switchBtn.style.transform = 'none', 300);

    startCamera();
  });
}

startCamera();

// シャッターボタンの処理
// Old shutter listener removed


const galleryOverlay = document.createElement('div');
galleryOverlay.id = 'gallery-overlay';
galleryOverlay.style.position = 'fixed';
galleryOverlay.style.inset = '0';
galleryOverlay.style.background = 'rgba(0,0,0,0.9)';
galleryOverlay.style.display = 'none';
galleryOverlay.style.zIndex = 70;
galleryOverlay.style.flexDirection = 'column';
// Header
galleryOverlay.innerHTML = `
  <div style="padding: 16px; display: flex; justify-content: space-between;">
    <button id="gallery-del-all" class="btn danger" style="font-size:12px;">すべて削除</button>
    <button id="gallery-dl-all" class="btn primary" style="font-size:12px;">すべて保存 (ZIP)</button>
  </div>
  <div id="gallery-grid" style="flex:1; display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:4px; padding:0 16px 100px; overflow-y:auto; align-content: flex-start;"></div>
  
  <div style="position:fixed; bottom:30px; left:0; right:0; display:flex; justify-content:center; pointer-events:none;">
    <button id="gallery-close" class="shutter-close-btn">×</button>
  </div>
`;
document.body.appendChild(galleryOverlay);

// ギャラリーボタンは HTML 側の `#gallery-btn` を使う
if (thumb) {
  thumb.addEventListener('click', () => {
    galleryOverlay.style.display = 'flex';
    fetchGallery();
  });
}

document.getElementById('gallery-close').addEventListener('click', () => {
  galleryOverlay.style.display = 'none';
});

async function deleteAllPhotosFromDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const rq = store.clear();
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}

document.getElementById('gallery-del-all').addEventListener('click', async () => {
  if (!confirm('本当に全てのデータを削除しますか？\nこの操作は取り消せません。')) return;

  try {
    await deleteAllPhotosFromDB();
    showToast('すべて削除しました');
    fetchGallery();
    // Reset thumbnail to default if needed, or just leave last one (it will clear on reload)
    thumb.removeAttribute('src');
  } catch (e) {
    console.error(e);
    alert('削除に失敗しました');
  }
});

// Download All Logic
document.getElementById('gallery-dl-all').addEventListener('click', async () => {
  const btn = document.getElementById('gallery-dl-all');
  if (btn.disabled) return;

  try {
    const list = await getAllPhotosFromDB();
    if (list.length === 0) {
      showToast('データがありません');
      return;
    }

    if (typeof JSZip === 'undefined') {
      alert('ZIPライブラリの読み込みに失敗しました');
      return;
    }

    btn.disabled = true;
    btn.textContent = '作成中...';

    const zip = new JSZip();
    const folder = zip.folder("camera_app_photos");

    list.forEach((item, index) => {
      // DataURL: data:image/png;base64,.....
      const parts = item.data.split(',');
      const mime = parts[0].match(/:(.*?);/)[1];
      const ext = mime.includes('video') ? 'webm' : 'png';
      const b64 = parts[1];
      const date = new Date(item.ts).toISOString().replace(/[:.]/g, '-');
      folder.file(`capture_${date}_${index}.${ext}`, b64, { base64: true });
    });

    const content = await zip.generateAsync({ type: "blob" });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(content);
    a.download = `camera_backup_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showToast('ZIPを保存しました');
  } catch (e) {
    console.error(e);
    alert('エラーが発生しました: ' + e);
  } finally {
    btn.disabled = false;
    btn.textContent = 'すべて保存 (ZIP)';
  }
});

// Old fetchGallery removed


function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.position = 'fixed';
    t.style.left = '50%';
    t.style.bottom = '140px'; // モード切替に被らないよう少し上に
    t.style.transform = 'translateX(-50%)';
    t.style.background = 'rgba(255,255,255,0.9)';
    t.style.color = '#000';
    t.style.padding = '8px 16px';
    t.style.borderRadius = '20px';
    t.style.fontSize = '14px';
    t.style.fontWeight = 'bold';
    t.style.zIndex = 120;
    t.style.transition = 'opacity 0.3s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._hideTimeout);
  t._hideTimeout = setTimeout(() => { t.style.opacity = '0'; }, 1000);
}

// Mode handling
let currentMode = 'photo';
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

// Overlay Elements
const blurTop = document.getElementById('blur-top');
const blurBottom = document.getElementById('blur-bottom');
const onionSkin = document.getElementById('onion-skin');

modeItems.forEach(mi => mi.addEventListener('click', () => {
  modeItems.forEach(m => m.classList.remove('active'));
  mi.classList.add('active');

  // Previous mode cleanup
  document.body.classList.remove(`mode-${currentMode}`);

  currentMode = mi.dataset.mode || 'photo';
  console.log('Mode switched to:', currentMode);

  // New mode setup
  document.body.classList.add(`mode-${currentMode}`);

  // Specific UI toggles (handled by CSS mostly, but onion skin needs check)
  if (currentMode !== 'stopmotion') {
    onionSkin.classList.remove('active');
  } else if (onionSkin.src) {
    onionSkin.classList.add('active');
  }
}));

// ... [Keep existing DB/Lightbox code as is, assumed to be between existing blocks in file, but here I am replacing large chunks so I need be careful. The instruction says replace capturing logic]
// I will keep the Lightbox/DB code IF it was part of the target block. 
// However, the target I used before was extensive. 
// Let's look at the "Target Content" carefully.
// I will target only the `handlePhotoShutter` and related parts to minimize risk, OR replace the whole bottom logic again if safe.
// To be safe, I will implement `handlePhotoShutter` with the new logic.

// ... [Keeping Lightbox/DB code requires matching perfectly. Instead, I will use a smaller replace for mode listener and a separate one for shutter]

// Let's split this into two calls for safety? 
// Actually, I can replace `modeItems` logic easily.
// And `handlePhotoShutter` easily.

// UPDATE: I will do this in one go if I can match the logic block.
// The file has:
// 181: let currentMode ...
// ...
// 186: modeItems.forEach...
// ...
// 333: shutter.addEventListener...
// 
// I will replace `modeItems` block first.

// [See tool call below]

// --- New Features: Lightbox, Delete, Download ---

async function deletePhotoFromDB(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const rq = store.delete(id);
    rq.onsuccess = () => resolve();
    rq.onerror = () => reject(rq.error);
  });
}

// Lightbox HTML (Update for video support if needed, simple img for now)
const lightboxOverlay = document.createElement('div');
lightboxOverlay.id = 'lightbox-overlay';
lightboxOverlay.style.display = 'none';
lightboxOverlay.innerHTML = `
  <div class="lightbox-content">
    <img id="lightbox-img" alt="preview" />
    <video id="lightbox-video" controls style="display:none;max-width:100%;max-height:100%"></video>
  </div>
  <div class="lightbox-actions">
    <button id="lb-close" class="btn ghost">閉じる</button>
    <div style="flex:1"></div>
    <button id="lb-delete" class="btn danger">削除</button>
    <button id="lb-download" class="btn primary">保存</button>
  </div>
`;
document.body.appendChild(lightboxOverlay);

const lbImg = document.getElementById('lightbox-img');
const lbVideo = document.getElementById('lightbox-video');
let currentPhotoId = null;
let currentItemData = null; // Store data for download

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-download').addEventListener('click', () => {
  if (!currentItemData) return;
  const a = document.createElement('a');
  a.href = currentItemData;
  const ext = currentItemData.startsWith('data:video') ? 'webm' : 'png';
  a.download = `capture_${Date.now()}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('保存しました');
});

document.getElementById('lb-delete').addEventListener('click', async () => {
  if (!currentPhotoId) return;
  if (!confirm('このデータを削除しますか？')) return;

  try {
    await deletePhotoFromDB(currentPhotoId);
    showToast('削除しました');
    closeLightbox();
    fetchGallery(); // Refresh grid
  } catch (e) {
    console.error(e);
    showToast('削除機能エラー');
  }
});

function openLightbox(item) {
  currentPhotoId = item.id;
  currentItemData = item.data;
  lightboxOverlay.style.display = 'flex';

  if (item.data.startsWith('data:video')) {
    lbImg.style.display = 'none';
    lbVideo.style.display = 'block';
    lbVideo.src = item.data;
  } else {
    lbVideo.style.display = 'none';
    lbImg.style.display = 'block';
    lbImg.src = item.data;
  }
}

function closeLightbox() {
  lightboxOverlay.style.display = 'none';
  lbImg.src = '';
  lbVideo.src = '';
  currentPhotoId = null;
}

// Update fetchGallery to add click handlers
async function fetchGallery() {
  try {
    const list = await getAllPhotosFromDB();
    const grid = document.getElementById('gallery-grid');
    grid.innerHTML = '';

    if (list.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;opacity:0.6">データがありません</div>';
      return;
    }

    list.forEach(item => {
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.cursor = 'pointer';
      container.onclick = () => openLightbox(item);

      if (item.data.startsWith('data:video')) {
        const videoEl = document.createElement('video');
        videoEl.src = item.data;
        videoEl.className = 'gallery-thumb';
        videoEl.muted = true;
        // videoEl.play(); // Auto play thumbnails? heavy

        // Video badge
        const badge = document.createElement('div');
        badge.textContent = '▶';
        badge.style.position = 'absolute';
        badge.style.top = '50%';
        badge.style.left = '50%';
        badge.style.transform = 'translate(-50%, -50%)';
        badge.style.color = '#fff';
        badge.style.fontSize = '24px';
        badge.style.textShadow = '0 0 10px rgba(0,0,0,0.5)';
        badge.style.pointerEvents = 'none';

        container.appendChild(videoEl);
        container.appendChild(badge);
      } else {
        const img = document.createElement('img');
        img.src = item.data;
        img.className = 'gallery-thumb';
        container.appendChild(img);
      }
      grid.appendChild(container);
    });
  } catch (e) {
    console.error('fetchGallery error', e);
  }
}

// Shutter Handler Logic
// Shutter Logic with Hold support
let shutterTimer = null;
let burstInterval = null;
let isLongPress = false;

// Helpers to handle both Mouse and Touch
const startPress = (e) => {
  e.preventDefault(); // prevent focus/selection
  if (shutterTimer) return; // already pressed

  isLongPress = false;
  shutter.classList.add('active'); // Visual feedback immediately

  // START TIMER for Long Press detection (e.g. 500ms)
  shutterTimer = setTimeout(() => {
    isLongPress = true;
    handleLongPressStart();
  }, 400); // 400ms threshold for "Hold"
};

const endPress = (e) => {
  if (e) e.preventDefault();

  shutter.classList.remove('active');
  clearTimeout(shutterTimer);
  shutterTimer = null;

  if (isLongPress) {
    handleLongPressEnd();
  } else {
    // Short Tap
    handleTap();
  }

  // Cleanup burst if any
  if (burstInterval) {
    clearInterval(burstInterval);
    burstInterval = null;
  }
};

// Attack listeners
shutter.addEventListener('mousedown', startPress);
shutter.addEventListener('touchstart', startPress);

shutter.addEventListener('mouseup', endPress);
shutter.addEventListener('touchend', endPress);
shutter.addEventListener('mouseleave', () => {
  if (shutterTimer || isLongPress) endPress();
});


function handleTap() {
  if (currentMode === 'video') {
    // Toggle recording on tap
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  } else {
    // Photo modes: Single shot
    handlePhotoShutter();
  }
}

function handleLongPressStart() {
  if (currentMode === 'video') {
    // Video: Ensure recording starts if not already
    if (!isRecording) {
      startRecording();
    }
  } else {
    // Photo: Start Burst
    showToast('連写中...');
    handlePhotoShutter(); // First shot
    burstInterval = setInterval(() => {
      handlePhotoShutter(true); // Burst shots
    }, 200);
  }
}

function handleLongPressEnd() {
  if (currentMode === 'video') {
    // Video: Stop recording if it was a hold action
    // (User wanted "Hold to Record", so release means stop)
    if (isRecording) {
      stopRecording();
    }
  } else {
    // Photo: Stop burst
    clearInterval(burstInterval);
    burstInterval = null;
    showToast('連写終了');
  }
}

function handlePhotoShutter() {
  // captureAndSave() called directly
  captureAndSave();
}



// Initialize ImageCapture
function initImageCapture(stream) {
  try {
    const track = stream.getVideoTracks()[0];
    if (track && window.ImageCapture) {
      imageCapture = new ImageCapture(track);
    } else {
      imageCapture = null;
    }
  } catch (e) {
    console.warn('ImageCapture init failed', e);
    imageCapture = null;
  }
}

// Modified captureAndSave to use ImageCapture for Photo mode
async function captureAndSave(isBurst = false) {
  if (!video.videoWidth || !video.videoHeight) return;

  // Optimize: Use High Quality ImageCapture for standard 'photo' mode (single shot)
  if (currentMode === 'photo' && !isBurst && imageCapture) {
    try {
      // flash anim
      shutter.classList.add('flash');
      setTimeout(() => shutter.classList.remove('flash'), 160);

      const blob = await imageCapture.takePhoto();

      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        thumb.src = dataUrl;
        savePhotoToDB(dataUrl).then(() => {
          showToast('高画質で保存しました');
          fetchGallery();
        });
      };
      reader.readAsDataURL(blob);
      return; // Exit, don't run canvas logic
    } catch (e) {
      console.warn('ImageCapture failed, falling back to canvas', e);
      // Fallback to canvas below
    }
  }

  // --- HTML Canvas Capture (Fallback & Special Modes) ---
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');

  // Mirror if needed
  if (video.classList.contains('mirrored')) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }

  // 1. Draw original video
  ctx.filter = 'none';
  if (currentMode === 'night') {
    // Canvas filter for Night mode (matches CSS)
    ctx.filter = 'brightness(1.5) contrast(1.1) saturate(1.2)';
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none'; // reset

  // 2. Post-processing (Miniature)
  if (currentMode === 'miniature') {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(0,0,0,0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height * 0.2);
    ctx.fillRect(0, canvas.height * 0.8, canvas.width, canvas.height * 0.2);
  }

  const data = canvas.toDataURL('image/jpeg', 0.9); // JPEG for speed

  // Animation (if not already handled by ImageCapture block)
  if (!isBurst) {
    shutter.classList.add('flash');
    setTimeout(() => shutter.classList.remove('flash'), 160);
  }

  // Save
  thumb.src = data;
  savePhotoToDB(data).then(() => {
    if (!isBurst) showToast('保存しました');
    fetchGallery();
  });

  // Stop Motion Logic
  if (currentMode === 'stopmotion') {
    onionSkin.src = data;
    onionSkin.classList.add('active');
  }
}

// handleBestShot removed


function handleVideoShutter() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!stream) return;

  recordedChunks = [];
  try {
    const options = { mimeType: 'video/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      // Fallback
      delete options.mimeType;
    }
    mediaRecorder = new MediaRecorder(stream, options);
  } catch (e) {
    alert('録画を開始できませんでした: ' + e);
    return;
  }

  mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      recordedChunks.push(event.data);
    }
  };

  mediaRecorder.onstop = saveVideo;

  mediaRecorder.start();
  isRecording = true;
  shutter.classList.add('recording');
  showToast('録画開始...');
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  isRecording = false;
  shutter.classList.remove('recording');
  showToast('録画終了');
}

function saveVideo() {
  const blob = new Blob(recordedChunks, { type: 'video/webm' });
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    savePhotoToDB(dataUrl).then(() => {
      showToast('動画を保存しました');
      fetchGallery();
      // Update thumbnail with a generic video icon or first frame?
      // For now, simple
    });
  };
  reader.readAsDataURL(blob);
}
