import { ALL_DAYS_JP } from '../templates/default/render.js';

let templatesList = [];
let currentTemplateModule = null;

// 各テンプレート固有の読み込み済み画像をキャッシュするオブジェクト
const loadedAssets = {};

let currentColor = '#85c7f2';
const titleFontSelect = document.getElementById('titleFontSelect');
const bodyFontSelect = document.getElementById('bodyFontSelect');
const templateSelect = document.getElementById('templateSelect');
const fontFileUpload = document.getElementById('fontFileUpload');

let titleFont = titleFontSelect.value;
let bodyFont = bodyFontSelect.value;

let uploadedImage = null;
let bgImage = null;
let areaBgColor = '#ffffff';
let bgType = 'color';

let imgX = 750;
let imgY = 220;
let imgScale = 1.0;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;

const canvas = document.getElementById('scheduleCanvas');
const ctx = canvas.getContext('2d');
const startDateInput = document.getElementById('startDate');
const themeColorPicker = document.getElementById('themeColorPicker');
const scheduleInputsContainer = document.getElementById('scheduleInputs');
const zoomRange = document.getElementById('zoomRange');
const bgTypeSelect = document.getElementById('bgTypeSelect');
const areaBgColorInput = document.getElementById('areaBgColor');
const bgImageUpload = document.getElementById('bgImageUpload');
const clearBgImgBtn = document.getElementById('clearBgImgBtn');
const illustCaptionInput = document.getElementById('illustCaption');

function getInitialMonday() {
  const d = new Date();
  const jstDate = new Date(d.getTime() + (9 * 60 * 60 * 1000) + (d.getTimezoneOffset() * 60 * 1000));
  const day = jstDate.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  jstDate.setDate(jstDate.getDate() + diff);

  const year = jstDate.getFullYear();
  const month = String(jstDate.getMonth() + 1).padStart(2, '0');
  const date = String(jstDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

// テンプレートの初期化と読込
async function initTemplates() {
  try {
    const res = await fetch('./manifest.json');
    const data = await res.json();
    templatesList = data.templates;

    templateSelect.innerHTML = '';
    templatesList.forEach(tpl => {
      const opt = document.createElement('option');
      opt.value = tpl.id;
      opt.textContent = tpl.name;
      templateSelect.appendChild(opt);
    });

    if (templatesList.length > 0) {
      await loadTemplate(templatesList[0].id);
    }
  } catch (err) {
    console.error('マニフェストの読み込みに失敗しました:', err);
  }
}

// テンプレート変更時の読み込み＆画像プリロード関数
async function loadTemplate(templateId) {
  const tpl = templatesList.find(t => t.id === templateId);
  if (!tpl) return;

  try {
    // 1. 描画モジュールの動的インポート
    currentTemplateModule = await import(`.${tpl.path}render.js`);

    // 2. サイバーパンクなど、特定テンプレート専用の画像プリロード
    if (templateId === 'cyberpunk') {
      if (!loadedAssets[templateId]) {
        loadedAssets[templateId] = {};
        await Promise.all([
          loadImage(`${tpl.path}background.png`).then(img => loadedAssets[templateId].background = img),
          loadImage(`${tpl.path}gray_out.png`).then(img => loadedAssets[templateId].gray_out = img),
          loadImage(`${tpl.path}credit.png`).then(img => loadedAssets[templateId].credit = img)
        ]);
      }
    }

    drawSchedule();
  } catch (err) {
    console.error('テンプレートの読み込みに失敗しました:', err);
  }
}

// 画像を非同期でロードするヘルパー関数
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

templateSelect.addEventListener('change', (e) => {
  loadTemplate(e.target.value);
});

// カスタムフォントファイルの動的読み込み処理
fontFileUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const fontBuffer = await file.arrayBuffer();
    // 拡張子を除いたファイル名をフォントファミリー名として登録
    const fontName = file.name.replace(/\.[^/.]+$/, "");
    const newFontFace = new FontFace(fontName, fontBuffer);

    await newFontFace.load();
    document.fonts.add(newFontFace);

    const fontVal = `'${fontName}', sans-serif`;

    // タイトルフォントと本文フォントの選択肢に追加
    const optTitle = document.createElement('option');
    optTitle.value = fontVal;
    optTitle.textContent = `カスタム: ${fontName}`;
    titleFontSelect.appendChild(optTitle);

    const optBody = document.createElement('option');
    optBody.value = fontVal;
    optBody.textContent = `カスタム: ${fontName}`;
    bodyFontSelect.appendChild(optBody);

    // 追加したフォントを即時適用
    titleFontSelect.value = fontVal;
    titleFont = fontVal;

    document.fonts.ready.then(() => drawSchedule());
  } catch (err) {
    console.error('フォントの読み込みに失敗しました:', err);
    alert('フォントファイルの読み込みに失敗しました。対応形式（.ttf / .otf / .woff）かご確認ください。');
  }
});

function createInputs() {
  startDateInput.value = getInitialMonday();
  updateInputLabels();

  document.querySelectorAll('input, select').forEach(input => {
    if(input.id !== 'themeColorPicker' && input.id !== 'areaBgColor' && input.id !== 'fontFileUpload') {
      input.addEventListener('input', drawSchedule);
    }
  });
}

function updateInputLabels() {
  const weekInfo = getWeekDayInfo(startDateInput.value);
  
  if (scheduleInputsContainer.children.length === 0) {
    weekInfo.forEach((info, idx) => {
      const row = document.createElement('div');
      row.className = 'day-row';
      row.innerHTML = `
        <span class="day-label" id="label-${idx}">${info.jpName}:</span>
        <input type="text" class="text-input" id="text-${idx}" placeholder="内容をここに記載">
        <input type="text" class="time-input" id="time-${idx}" placeholder="時間">
        <button type="button" class="btn-off" onclick="window.setOff(${idx})">おやすみ</button>
      `;
      scheduleInputsContainer.appendChild(row);
    });
  } else {
    weekInfo.forEach((info, idx) => {
      const labelEl = document.getElementById(`label-${idx}`);
      if (labelEl) {
        labelEl.textContent = `${info.jpName}:`;
      }
    });
  }
}

const ALL_DAYS_EN = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

function getWeekDayInfo(baseDateStr) {
  const baseDate = baseDateStr ? new Date(baseDateStr) : new Date();
  const result = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(baseDate);
    cur.setDate(baseDate.getDate() + i);
    const dayIdx = cur.getDay();
    result.push({
      date: cur,
      jpName: ALL_DAYS_JP[dayIdx],
      enName: ALL_DAYS_EN[dayIdx]
    });
  }
  return result;
}

window.setOff = function(idx) {
  const textInput = document.getElementById(`text-${idx}`);
  const timeInput = document.getElementById(`time-${idx}`);
  if (textInput.value === 'おやすみ') {
    textInput.value = '';
    timeInput.disabled = false;
    timeInput.style.opacity = '1';
  } else {
    textInput.value = 'おやすみ';
    timeInput.value = '';
    timeInput.disabled = true;
    timeInput.style.opacity = '0.4';
  }
  drawSchedule();
};

startDateInput.addEventListener('change', () => {
  updateInputLabels();
  drawSchedule();
});

titleFontSelect.addEventListener('change', (e) => {
  titleFont = e.target.value;
  document.fonts.ready.then(() => drawSchedule());
});

bodyFontSelect.addEventListener('change', (e) => {
  bodyFont = e.target.value;
  document.fonts.ready.then(() => drawSchedule());
});

document.getElementById('colorPicker').addEventListener('click', (e) => {
  if (e.target.classList.contains('color-btn')) {
    document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
    currentColor = e.target.getAttribute('data-color');
    themeColorPicker.value = currentColor;
    drawSchedule();
  }
});

themeColorPicker.addEventListener('input', (e) => {
  currentColor = e.target.value;
  document.querySelectorAll('.color-btn').forEach(btn => btn.classList.remove('active'));
  drawSchedule();
});

bgTypeSelect.addEventListener('change', (e) => {
  bgType = e.target.value;
  if (bgType === 'color') {
    document.getElementById('bgColorContainer').style.display = 'block';
    document.getElementById('bgImageContainer').style.display = 'none';
  } else {
    document.getElementById('bgColorContainer').style.display = 'none';
    document.getElementById('bgImageContainer').style.display = 'flex';
  }
  drawSchedule();
});

areaBgColorInput.addEventListener('input', (e) => {
  areaBgColor = e.target.value;
  drawSchedule();
});

bgImageUpload.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        bgImage = img;
        clearBgImgBtn.style.display = 'inline-block';
        drawSchedule();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

clearBgImgBtn.addEventListener('click', () => {
  bgImage = null;
  bgImageUpload.value = '';
  clearBgImgBtn.style.display = 'none';
  drawSchedule();
});

document.getElementById('imageUpload').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        uploadedImage = img;
        resetImagePosition();
        document.getElementById('imageControls').style.display = 'flex';
        drawSchedule();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

function resetImagePosition() {
  if (!uploadedImage) return;
  const baseScale = Math.max(360 / uploadedImage.width, 460 / uploadedImage.height);
  imgScale = baseScale;
  zoomRange.value = 1.0;
  imgX = 750;
  imgY = 220;
}

document.getElementById('resetImgBtn').addEventListener('click', () => {
  resetImagePosition();
  drawSchedule();
});

zoomRange.addEventListener('input', (e) => {
  if (!uploadedImage) return;
  const baseScale = Math.max(360 / uploadedImage.width, 460 / uploadedImage.height);
  imgScale = baseScale * parseFloat(e.target.value);
  drawSchedule();
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (x >= 560 && x <= 940 && y >= 20 && y <= 520) {
    isDragging = true;
    dragStartX = x - imgX;
    dragStartY = y - imgY;
  }
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging) return;
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  imgX = x - dragStartX;
  imgY = y - dragStartY;
  drawSchedule();
});

window.addEventListener('mouseup', () => { isDragging = false; });

canvas.addEventListener('wheel', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);

  if (x >= 560 && x <= 940 && y >= 20 && y <= 520 && uploadedImage) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    const currentSliderVal = parseFloat(zoomRange.value);
    const newVal = Math.min(Math.max(currentSliderVal + delta, 0.2), 3.0);
    zoomRange.value = newVal;

    const baseScale = Math.max(360 / uploadedImage.width, 460 / uploadedImage.height);
    imgScale = baseScale * newVal;
    drawSchedule();
  }
}, { passive: false });

function drawSchedule() {
  if (!currentTemplateModule || typeof currentTemplateModule.render !== 'function') return;

  const textInputs = {};
  const timeInputs = {};
  for (let i = 0; i < 7; i++) {
    textInputs[i] = document.getElementById(`text-${i}`)?.value || '';
    timeInputs[i] = document.getElementById(`time-${i}`)?.value || '';
  }

  const currentTemplateId = templateSelect.value;

  const state = {
    currentColor,
    bodyFont,
    titleFont,
    uploadedImage,
    bgImage,
    areaBgColor,
    bgType,
    imgX,
    imgY,
    imgScale,
    illustCaption: illustCaptionInput.value,
    startDateInputVal: startDateInput.value,
    textInputs,
    timeInputs,
    assets: loadedAssets[currentTemplateId] || {}
  };

  currentTemplateModule.render(ctx, canvas, state);
}

document.getElementById('downloadBtn').addEventListener('click', async () => {
  const filename = `schedule_${startDateInput.value}.png`;
  
  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'PNG Image',
          accept: { 'image/png': ['.png'] },
        }],
      });
      const writable = await handle.createWritable();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await writable.write(blob);
      await writable.close();
      return;
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('ファイル保存エラー:', err);
      } else {
        return;
      }
    }
  }

  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
});

document.fonts.ready.then(async () => {
  createInputs();
  await initTemplates();
});