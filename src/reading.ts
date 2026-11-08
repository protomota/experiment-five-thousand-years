export interface ReadingSource {
 title:string;url:string;revision:number;license:string;licenseUrl:string;note:string;
}
export interface Reading {
 id:string;sections:{heading:string;paragraphs:string[]}[];wordCount:number;source:ReadingSource;
}
export const readings=new Map<string,Reading>();
const requests=new Map<string,Promise<Reading>>();
export async function loadReading(id:string):Promise<Reading>{
 const cached=readings.get(id);if(cached)return cached;
 const pending=requests.get(id);if(pending)return pending;
 const request=(async()=>{
  const response=await fetch(assetUrl(`reading/${id}.json`));
  if(!response.ok)throw new Error('Reading unavailable');
  const article:Reading=await response.json();
  if(article.id!==id||!article.sections.length)throw new Error('Invalid reading');
  readings.set(id,article);return article;
 })();
 requests.set(id,request);
 try{return await request;}finally{requests.delete(id);}
}
import {assetUrl} from './assets';
