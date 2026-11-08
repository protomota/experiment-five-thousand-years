import {defineConfig} from 'vite';
const release='https://media.protomota.com/five-thousand-years/releases/20261108-atlas-01';
const cdn=process.env.ATLAS_CDN_BASE?.replace(/\/$/,'');
const assetBase=process.env.ATLAS_ASSET_BASE || `${cdn || release}/assets/`;
export default defineConfig({
 base:cdn?`${cdn}/app/`:'/',
 publicDir:cdn?false:'public',
 define:{__ATLAS_ASSET_BASE__:JSON.stringify(assetBase),__ATLAS_PAGE_BASE__:JSON.stringify(process.env.ATLAS_PAGE_BASE||'/')},
 plugins:[{name:'atlas-asset-urls',enforce:'pre',transform(code,id){if(id.endsWith('/src/style.css'))return code.replaceAll("url('/assets/",`url('${assetBase}`);},transformIndexHtml(html){return html.replaceAll('__ATLAS_SOCIAL_IMAGE__',`${cdn||release}/assets/atlas-card.webp`);}}],
 cacheDir:process.env.ATLAS_CACHE_DIR||'node_modules/.vite',
 build:{outDir:process.env.ATLAS_OUTPUT_DIR||'dist',emptyOutDir:true},
 server:{allowedHosts:['five-thousand-years.ngrok.app']}
});
