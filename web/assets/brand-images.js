/* Use actual LAYR assets from the official brand site; fall back across known editions. */
function setupBrandAsset(image) {
  const urls=(image.dataset.fallbackSources||"").split("|").map(x=>x.trim()).filter(Boolean);
  let n=0;
  const loadNext=()=>{
    if(n>=urls.length){
      image.closest(".home-image,.promo-photo,.site-brand")?.classList.add("brand-image-unavailable");
      image.hidden=true;
      return;
    }
    image.src=urls[n++];
  };
  image.addEventListener("error",loadNext);
  if(image.complete&&image.naturalWidth===0)loadNext();
}
document.querySelectorAll("img[data-fallback-sources]").forEach(setupBrandAsset);
