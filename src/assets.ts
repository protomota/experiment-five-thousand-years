declare const __ATLAS_ASSET_BASE__:string;
declare const __ATLAS_PAGE_BASE__:string;
const assetBase=typeof __ATLAS_ASSET_BASE__==='string'?__ATLAS_ASSET_BASE__:'/assets/';
const pageBase=typeof __ATLAS_PAGE_BASE__==='string'?__ATLAS_PAGE_BASE__:'/';
export const assetUrl=(path:string)=>assetBase+path.split('/').map(encodeURIComponent).join('/');
export const pageUrl=(path:string)=>pageBase+path;
