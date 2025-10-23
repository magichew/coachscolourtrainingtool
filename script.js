/* =========================================================
 Coach’s Colour Tool
 File: script.js
 Description: Full logic – instant, synced previews
 ========================================================= */

/* ---------- Utility Functions ---------- */
function hexToRgb(h){
  const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:{r:0,g:0,b:0};
}
function brightnessFromHex(h){
  const {r,g,b}=hexToRgb(h);
  return (r*299+g*587+b*114)/1000;
}
function getContrastColour(h){
  if(!h||!/^#([0-9a-f]{6})$/i.test(h))return'#fff';
  return brightnessFromHex(h)>130?'#000':'#fff';
}
function rand1to9(){return Math.floor(Math.random()*9)+1;}
function showToast(msg,col){
  const toast=document.getElementById('toast');
  toast.textContent=msg;
  toast.style.background=col;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),1500);
}

/* ---------- Storage (robust) ---------- */
const STORAGE_KEY='coachColourPresets';
function safeParse(json){try{return JSON.parse(json);}catch{return null;}}
function getPresets(){
  const raw=localStorage.getItem(STORAGE_KEY);
  const parsed=raw?safeParse(raw):null;
  return (parsed&&typeof parsed==='object')?parsed:{};
}
function savePresets(presets){localStorage.setItem(STORAGE_KEY,JSON.stringify(presets));}
function ensureDefaultPresent(){
  let presets=getPresets();
  if(!presets||Object.keys(presets).length===0||!presets["Go/No Go"]){
    presets=presets&&typeof presets==='object'?presets:{};
    presets["Go/No Go"]={
      red:true,green:true,blue:false,yellow:false,
      min:1,max:3,numbers:false,numMode:"one",
      split:false,dir:"right"
    };
    savePresets(presets);
  }
  return presets;
}

/* ---------- Elements ---------- */
const home=document.getElementById('homeScreen');
const setup=document.getElementById('setupScreen');
const flash=document.getElementById('flashScreen');
const tileGrid=document.getElementById('tileGrid');
const createBtn=document.getElementById('createBtn');
const homeFromSetup=document.getElementById('homeFromSetup');
const homeFromSession=document.getElementById('homeFromSession');
const homeImportBtn=document.getElementById('homeImportBtn');
const homeExportBtn=document.getElementById('homeExportBtn');
const exportOverlay=document.getElementById('exportOverlay');
const exportSelect=document.getElementById('exportSelect');
const exportConfirm=document.getElementById('exportConfirm');
const exportCancel=document.getElementById('exportCancel');
const deleteOverlay=document.getElementById('deleteOverlay');
const deleteText=document.getElementById('deleteText');
const deleteConfirm=document.getElementById('deleteConfirm');
const deleteCancel=document.getElementById('deleteCancel');
const red=document.getElementById('red');
const green=document.getElementById('green');
const blue=document.getElementById('blue');
const yellow=document.getElementById('yellow');
const minT=document.getElementById('minT');
const maxT=document.getElementById('maxT');
const numbers=document.getElementById('numbers');
const splitMode=document.getElementById('splitMode');
const splitDir=document.getElementById('splitDirection');
const presetSelect=document.getElementById('presetSelect');
const savePresetBtn=document.getElementById('savePresetBtn');
const deletePresetBtn=document.getElementById('deletePresetBtn');
const numberOptions=document.getElementById('numberOptions');
const twoNumbersOption=document.getElementById('twoNumbersOption');
const startBtn=document.getElementById('startBtn');
const stopBtn=document.getElementById('stopBtn');
const numCentre=document.getElementById('numberOverlay');
const numLeft=document.getElementById('numLeft');
const numRight=document.getElementById('numRight');
const numTop=document.getElementById('numTop');
const numBottom=document.getElementById('numBottom');

/* ---------- Screen Switching ---------- */
function showScreen(s){
  [home,setup,flash].forEach(sc=>{
    sc.style.opacity='0';
    sc.style.pointerEvents='none';
  });
  s.style.opacity='1';
  s.style.pointerEvents='auto';
  if(s===home){startTilePreviews();}else{stopTilePreviews();}
}

/* ---------- Tile Previews ---------- */
let newPresets=[],previewLoops={};

function buildHomeGrid(){
  stopTilePreviews();
  tileGrid.innerHTML='';
  const presets=ensureDefaultPresent();
  if(!presets||Object.keys(presets).length===0){
    const empty=document.createElement('div');
    empty.className='tile';
    empty.style.background='#444';
    empty.innerHTML='<div class="tile-name">No presets found</div><div class="tile-time">Tap “Create New Session”</div>';
    tileGrid.appendChild(empty);
    return;
  }

  Object.keys(presets).forEach((name,i)=>{
    const pr=presets[name];
    const tile=document.createElement('div');
    tile.className='tile';
    tile.style.animationDelay=(i*0.1)+'s';
    tile.dataset.preset=name;

    const cols=[];
    if(pr.red)cols.push('#ff0000');
    if(pr.green)cols.push('#00ff00');
    if(pr.blue)cols.push('#0000ff');
    if(pr.yellow)cols.push('#ffff00');

    let bg='#555';
    if(cols.length==1)bg=cols[0];
    else if(cols.length==2)bg=`linear-gradient(135deg,${cols[0]} 50%,${cols[1]} 50%)`;
    else if(cols.length==3)bg=`linear-gradient(135deg,${cols[0]},${cols[1]},${cols[2]})`;
    else if(cols.length==4)bg=`linear-gradient(135deg,${cols[0]} 25%,${cols[1]} 25%,${cols[1]} 50%,${cols[2]} 50%,${cols[2]} 75%,${cols[3]} 75%)`;
    tile.style.background=bg;

    const newBadge=newPresets.includes(name)?'<div class="tile-new">NEW</div>':'';
    tile.innerHTML=`
      ${newBadge}
      <div class="tile-action tile-edit">✎</div>
      <div class="tile-action tile-delete">×</div>
      <div class="tile-prev-wrap"><div class="tile-prev-num one" style="display:none;"></div></div>
      <div class="tile-name">${name}</div>
      <div class="tile-time">${pr.min}–${pr.max}s</div>
    `;
    tile.querySelector('.tile-edit').onclick=(e)=>{e.stopPropagation();loadPreset(name);showScreen(setup);};
    tile.querySelector('.tile-delete').onclick=(e)=>{e.stopPropagation();confirmDelete(name);};
    tile.onclick=()=>{loadPreset(name);startSessionFromPreset();};
    tileGrid.appendChild(tile);
    startOneTilePreview(tile,pr,cols);
  });
  newPresets=[];
}

function stopTilePreviews(){
  Object.values(previewLoops).forEach(loop=>loop.forEach(id=>clearTimeout(id)));
  previewLoops={};
}

/* ---------- Individual Tile Simulation ---------- */
function startOneTilePreview(tile,pr,cols){
  const name=tile.dataset.preset;
  const wrap=tile.querySelector('.tile-prev-wrap');
  wrap.innerHTML='';
  let numEl=null;
  if(pr.numbers){
    if(pr.numMode==='two'&&pr.split){
      numEl=document.createElement('div');
      numEl.className='tile-prev-num two';
      if(pr.dir==='bottom'){
        numEl.classList.add('tb');
        numEl.innerHTML='<span class="top">8</span><span class="bottom">3</span>';
      }else{
        numEl.innerHTML='<span class="left">8</span><span class="right">3</span>';
      }
    }else{
      numEl=document.createElement('div');
      numEl.className='tile-prev-num one';
      numEl.textContent='5';
    }
    wrap.appendChild(numEl);
  }

  const timeMin=Number(pr.min)||1,timeMax=Number(pr.max)||3;
  function nextDelay(){return (Math.random()*(timeMax-timeMin)+timeMin)*1000;}

  function setSplitBackground(c1,c2,dir){
    tile.style.background=`linear-gradient(${dir==='bottom'?'to bottom':'to right'},${c1} 50%,${c2} 50%)`;
  }
  function setSingleBackground(c){tile.style.background=c;}
  function setNumColours(c1,c2){
    if(!numEl)return;
    if(numEl.classList.contains('two')){
      const spans=numEl.querySelectorAll('span');
      if(spans[0])spans[0].style.color=getContrastColour(c1);
      if(spans[1])spans[1].style.color=getContrastColour(c2||c1);
    }else{
      numEl.style.color=getContrastColour(c1);
    }
  }

  // ✅ Instant number + colour change (no fade)
  function step(){
    let c1,c2;
    if(pr.split&&cols.length>=2){
      c1=cols[Math.floor(Math.random()*cols.length)];
      do{c2=cols[Math.floor(Math.random()*cols.length)];}while(c2===c1&&cols.length>1);
      setSplitBackground(c1,c2,pr.dir);
      setNumColours(c1,c2);
    }else{
      c1=cols[Math.floor(Math.random()*cols.length)]||'#555';
      setSingleBackground(c1);
      setNumColours(c1);
    }

    if(pr.numbers){
      if(numEl.classList.contains('two')){
        const spans=numEl.querySelectorAll('span');
        if(spans.length>=2){
          spans[0].textContent=rand1to9();
          spans[1].textContent=rand1to9();
        }
      }else{
        numEl.textContent=rand1to9();
      }
      numEl.style.display='block';
      numEl.style.opacity='1';
    }

    const id=setTimeout(step,nextDelay());
    previewLoops[name]=previewLoops[name]||[];
    previewLoops[name].push(id);
  }

  const startId=setTimeout(step,300+Math.random()*600);
  previewLoops[name]=previewLoops[name]||[];
  previewLoops[name].push(startId);
}

/* ---------- Preset Controls, Import/Export, and Session ---------- */
// (unchanged – same as your previous working version)
function confirmDelete(name){
  if(name==="Go/No Go"){showToast('Cannot delete default preset','#e67e22');return;}
  pendingDelete=name;deleteText.textContent=`Delete preset "${name}"?`;
  deleteOverlay.style.display='flex';
}
deleteCancel.onclick=()=>{deleteOverlay.style.display='none';pendingDelete=null;};
deleteConfirm.onclick=()=>{
  if(!pendingDelete)return;
  const p=getPresets();delete p[pendingDelete];savePresets(p);
  buildHomeGrid();showToast(`Preset "${pendingDelete}" deleted`,'#e74c3c');
  deleteOverlay.style.display='none';pendingDelete=null;
};
function populatePresetDropdown(){
  const p=getPresets();
  presetSelect.innerHTML='<option value="">Select...</option>';
  Object.keys(p).forEach(k=>{
    const o=document.createElement('option');
    o.value=k;o.textContent=k;presetSelect.appendChild(o);
  });
}
function getCurrent(){
  return{
    red:red.checked,green:green.checked,blue:blue.checked,yellow:yellow.checked,
    min:parseFloat(minT.value),max:parseFloat(maxT.value),
    numbers:numbers.checked,
    numMode:document.querySelector('input[name="numMode"]:checked')?.value||'one',
    split:splitMode.checked,dir:splitDir.value
  };
}
function loadPreset(n){
  const p=getPresets()[n];if(!p)return;
  red.checked=p.red;green.checked=p.green;blue.checked=p.blue;yellow.checked=p.yellow;
  minT.value=p.min;maxT.value=p.max;
  numbers.checked=p.numbers;splitMode.checked=p.split;splitDir.value=p.dir;
  if(p.numbers){
    numberOptions.style.display='block';
    document.getElementById(p.numMode==='two'?'twoNumbers':'oneNumber').checked=true;
  }else numberOptions.style.display='none';
  document.getElementById('splitDirectionBox').style.display=splitMode.checked?'block':'none';
  twoNumbersOption.style.display=(numbers.checked&&splitMode.checked)?'flex':'none';
  showToast(`Preset "${n}" loaded`,'#3498db');
}
function savePreset(){
  const name=prompt('Enter name for this preset:');if(!name)return;
  const ps=getPresets();
  if(ps[name]&&name!=="Go/No Go"){
    if(!confirm(`Preset "${name}" exists. Overwrite?`))return;
  }
  ps[name]=getCurrent();savePresets(ps);
  populatePresetDropdown();buildHomeGrid();
  showToast(`Preset "${name}" saved`,'#2ecc71');
}
function deletePreset(){
  const n=presetSelect.value;
  if(!n){showToast('Select a preset','#e67e22');return;}
  if(n==="Go/No Go"){showToast('Cannot delete Go/No Go','#e67e22');return;}
  const p=getPresets();delete p[n];savePresets(p);
  populatePresetDropdown();buildHomeGrid();
  showToast(`Preset "${n}" deleted`,'#e67e22');
}
function openExportModal(){
  const presets=getPresets();
  exportSelect.innerHTML='';
  Object.keys(presets).forEach(k=>{
    const o=document.createElement('option');
    o.value=k;o.textContent=k;exportSelect.appendChild(o);
  });
  exportOverlay.style.display='flex';
}
function closeExportModal(){exportOverlay.style.display='none';}
function confirmExport(){
  const n=exportSelect.value;if(!n)return;
  const p=getPresets();const single={[n]:p[n]};
  const blob=new Blob([JSON.stringify(single,null,2)],{type:'application/json'});
  const link=document.createElement('a');
  const date=new Date().toISOString().split('T')[0];
  link.download=`Coach_Colour_Preset_${n}_${date}.json`;
  link.href=URL.createObjectURL(blob);link.click();
  closeExportModal();showToast(`Preset "${n}" exported`,'#f39c12');
}
function importPresets(){
  const input=document.createElement('input');
  input.type='file';input.accept='.json,application/json';
  input.onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const data=JSON.parse(r.result),curr=getPresets();
        newPresets=[];
        Object.keys(data).forEach(k=>{
          if(curr[k]&&!confirm(`Preset "${k}" exists. Overwrite?`))return;
          if(!curr[k])newPresets.push(k);
          curr[k]=data[k];
        });
        savePresets(curr);populatePresetDropdown();buildHomeGrid();
        showToast('Presets imported','#f39c12');
      }catch{showToast('Invalid file','#e74c3c');}
    };
    r.readAsText(f);
  };
  input.click();
}

/* ---------- Session ---------- */
let running=false,timer;
function startSessionFromPreset(){
  showScreen(flash);
  const cols=[];
  if(red.checked)cols.push('#ff0000');
  if(green.checked)cols.push('#00ff00');
  if(blue.checked)cols.push('#0000ff');
  if(yellow.checked)cols.push('#ffff00');
  flashColours(cols,parseFloat(minT.value),parseFloat(maxT.value),
    numbers.checked,
    document.querySelector('input[name="numMode"]:checked')?.value||'one',
    splitMode.checked,splitDir.value);
}
startBtn.onclick=()=>{showScreen(flash);startSessionFromPreset();};
stopBtn.onclick=stop;
function stop(){
  running=false;clearTimeout(timer);
  [numCentre,numLeft,numRight,numTop,numBottom].forEach(e=>{e.textContent='';e.style.display='none';});
  showScreen(home);
}
function flashColours(cols,min,max,showNum,numMode,split,dir){
  running=true;if(!running)return;
  let c1=null,c2=null;
  if(split&&cols.length>=2){
    c1=cols[Math.floor(Math.random()*cols.length)];
    do{c2=cols[Math.floor(Math.random()*cols.length)];}while(c2===c1&&cols.length>1);
    flash.style.background=`linear-gradient(${dir==='bottom'?'to bottom':'to right'},${c1} 50%,${c2} 50%)`;
  }else{
    c1=cols[Math.floor(Math.random()*cols.length)];
    flash.style.background=c1;
  }
  [numCentre,numLeft,numRight,numTop,numBottom].forEach(e=>{e.textContent='';e.style.display='none';});
  if(showNum){
    if(numMode==='one'||!split){
      const n=rand1to9();
      numCentre.textContent=n;numCentre.style.display='block';numCentre.style.color=getContrastColour(c1);
    }else{
      const n1=rand1to9(),n2=rand1to9();
      if(dir==='bottom'){
        numTop.textContent=n1;numBottom.textContent=n2;
        numTop.style.display='block';numBottom.style.display='block';
        numTop.style.color=getContrastColour(c1);
        numBottom.style.color=getContrastColour(c2);
      }else{
        numLeft.textContent=n1;numRight.textContent=n2;
        numLeft.style.display='block';numRight.style.display='block';
        numLeft.style.color=getContrastColour(c1);
        numRight.style.color=getContrastColour(c2);
      }
    }
  }
  const delay=(Math.random()*(max-min)+min)*1000;
  timer=setTimeout(()=>flashColours(cols,min,max,showNum,numMode,split,dir),delay);
}

/* ---------- Event Listeners ---------- */
createBtn.onclick=()=>showScreen(setup);
homeFromSetup.onclick=()=>showScreen(home);
homeFromSession.onclick=()=>{stop();showScreen(home);};
homeImportBtn.onclick=importPresets;
homeExportBtn.onclick=openExportModal;
exportCancel.onclick=closeExportModal;
exportConfirm.onclick=confirmExport;
savePresetBtn.onclick=savePreset;
deletePresetBtn.onclick=deletePreset;
presetSelect.onchange=()=>{if(presetSelect.value)loadPreset(presetSelect.value);};
splitMode.onchange=()=>{
  document.getElementById('splitDirectionBox').style.display=splitMode.checked?'block':'none';
  twoNumbersOption.style.display=(splitMode.checked&&numbers.checked)?'flex':'none';
};
numbers.onchange=()=>{
  numberOptions.style.display=numbers.checked?'block':'none';
  twoNumbersOption.style.display=(numbers.checked&&splitMode.checked)?'flex':'none';
};

/* ---------- Init ---------- */
function initApp(){
  ensureDefaultPresent();
  populatePresetDropdown();
  buildHomeGrid();
  showScreen(home);
}
window.addEventListener('load',initApp);