// The standalone player needs a readiness signal after the composition's GPU
// setup completes. The render runtime normally supplies this in the editor.
export function filmPage(html,assetBase){
 if(assetBase)html=html.replace('<head>',`<head><base href="${assetBase}">`);
 if(!html.includes('data-atlas-ready'))html=html.replace('</body>','<script data-atlas-ready>Promise.all(Object.values(window.__hf?.buildReady||{})).then(()=>{window.__renderReady=true;});</script></body>');
 return html.replace('3000 BCE — 2000 CE','3000 BCE — 2026 CE');
}
