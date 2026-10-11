/* Lazy interactive 3D terrain — real DEM + public basemap, never a fabricated hole map.
 * Libraries and map tiles load only after visitors request the view.
 */
const SDK="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.js";
const CSS="https://unpkg.com/maplibre-gl@5.6.0/dist/maplibre-gl.css";
const STYLE="https://tiles.openfreemap.org/styles/liberty";
const TERRAIN="https://tiles.mapterhorn.com/tilejson.json";
let libraryPromise=null;
function loadSdk(){
 if(window.maplibregl)return Promise.resolve(window.maplibregl);
 if(libraryPromise)return libraryPromise;
 libraryPromise=new Promise((resolve,reject)=>{
  const link=document.createElement("link");link.rel="stylesheet";link.href=CSS;document.head.appendChild(link);
  const s=document.createElement("script");s.src=SDK;s.async=true;
  s.onload=()=>window.maplibregl?resolve(window.maplibregl):reject(new Error("Map renderer unavailable"));
  s.onerror=()=>reject(new Error("Map renderer could not load"));
  document.head.appendChild(s);
 });
 return libraryPromise;
}
function mapFailure(box,message){
 const status=box.querySelector(".terrain-status");
 const launcher=box.querySelector(".terrain-launch");
 const fallback=box.querySelector(".terrain-fallback");
 if(status)status.textContent=message;
 if(launcher)launcher.disabled=false;
 if(fallback)fallback.hidden=false;
}
async function initTerrain(box){
 const btn=box.querySelector(".terrain-launch"),holder=box.querySelector(".terrain-canvas");
 const cover=box.querySelector(".terrain-cover");
 const fallback=box.querySelector(".terrain-fallback");
 const status=box.querySelector(".terrain-status");
 const lat=Number(box.dataset.lat),lon=Number(box.dataset.lon);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180||!lat||!lon){
  mapFailure(box,"正確な位置情報がないため地形ビューは利用できません。");
  return;
 }
 btn.disabled=true;
 if(status)status.textContent="立体地形を読み込み中…";
 cover.hidden=true;
 try{
  const lib=await loadSdk();
  if(!lib.supported())throw new Error("WebGL not supported");
  holder.hidden=false;
  const map=new lib.Map({container:holder,style:STYLE,center:[lon,lat],
    zoom:12.8,pitch:63,bearing:-26,maxPitch:83,attributionControl:true});
  box._map=map;
  const timeout=setTimeout(()=>{
    if(!box._loaded)mapFailure(box,"地図の読み込みに時間がかかっています。通常の地図でも位置を確認できます。");
  },18000);
  map.on("load",()=>{
    box._loaded=true;clearTimeout(timeout);
    new lib.Marker({color:"#ec775b"}).setLngLat([lon,lat]).addTo(map);
    map.addControl(new lib.NavigationControl({visualizePitch:true}),'top-right');
    const modeButton=box.querySelector(".terrain-mode");
    const threeD=()=>{
      map.setPitch(63);
      map.setBearing(-26);
      map.easeTo({pitch:63,bearing:-26,duration:500});
      if(map.getSource("layr-terrain"))map.setTerrain({source:"layr-terrain",exaggeration:1.2});
    };
    try{
      map.addSource("layr-terrain",{type:"raster-dem",url:TERRAIN});
      map.setTerrain({source:"layr-terrain",exaggeration:1.2});
      status.textContent="実際の標高データを使った立体地形です。";
    }catch{
      status.textContent="立体地形を読み込めませんでした。位置の地図を表示しています。";
    }
    btn.hidden=true;
    modeButton.hidden=false;
    modeButton.dataset.view="3d";
    modeButton.addEventListener("click",()=>{
      if(modeButton.dataset.view==="3d"){
        map.setTerrain(null);map.easeTo({pitch:0,bearing:0,duration:350});
        modeButton.textContent="3D 地形に戻す ↗";modeButton.dataset.view="2d";
      }else{
        threeD();modeButton.textContent="2D 地図で見る";modeButton.dataset.view="3d";
      }
    });
    fallback.hidden=false;
    map.resize();
  });
  map.on("error",e=>{
    if(e?.error?.message&&status&&box._loaded&&/terrain|dem|tilejson/i.test(e.error.message))
      status.textContent="標高データの取得に失敗しました。地図自体は操作できます。";
  });
 }catch(e){
  holder.hidden=true;cover.hidden=false;
  mapFailure(box,"この端末では立体表示できません。通常の地図から確認してください。");
 }
}
document.addEventListener("click",event=>{
 const btn=event.target.closest(".terrain-launch");
 if(btn){const box=btn.closest(".terrain-view");if(box)initTerrain(box);}
});
