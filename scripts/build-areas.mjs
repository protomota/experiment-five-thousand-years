import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {events} from '../src/events.ts';
const root=(process.env.ATLAS_WORK_DIR || fileURLToPath(new URL('../.atlas-work', import.meta.url)));
const historical=JSON.parse(await readFile(root+'/cache/cliopatria/cliopatria_polities_only_v021.geojson','utf8')).features;
const urban=JSON.parse(await readFile(root+'/cache/urban.geojson','utf8')).features;
const countries=JSON.parse(await readFile(root+'/cache/countries.geojson','utf8')).features;
const framing=JSON.parse(await readFile(new URL('./area-framing.json',import.meta.url),'utf8'));
const polygons=geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
function ringContains(x,y,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function contains(feature,event){return polygons(feature.geometry).some(polygon=>ringContains(event.lon,event.lat,polygon[0])&&!polygon.slice(1).some(ring=>ringContains(event.lon,event.lat,ring)));}
const specific={uruk:'Sumerian City-States',pyramids:'Old Kingdom of Egypt',indus:'Indus Valley Civilization',hammurabi:'Babylonia',shang:'Shang Dynasty',ashoka:'Maurya Empire',qin:'Qin Dynasty',rome:'Roman Empire',baghdad:'Abbasid Caliphate',angkor:'Khmer Empire',mongols:'Mongol Empire',mali:'Mali Empire',mughal:'Mughal Empire',haiti:'Haiti',meiji:'Empire of Japan',adwa:'Ethiopian Empire',india:'Republic of India',ghana:'Ghana','south-africa':'South Africa'};
await mkdir(root+'/assets/areas',{recursive:true});
const index={};
for(const event of events){
 let feature,kind,label,source,license;
 const focus=framing[event.id];
 const political=specific[event.id]||['Civilizations','Revolutions & independence'].includes(event.category);
 if(political&&focus?.scope!=='urban'){
  const relevant=historical.filter(feature=>event.year>=feature.properties.FromYear&&event.year<=feature.properties.ToYear);
  feature=specific[event.id]?relevant.find(feature=>feature.properties.Name===specific[event.id]):relevant.filter(feature=>contains(feature,event)).sort((a,b)=>a.properties.Area-b.properties.Area)[0];
  if(feature){kind='Historical territory (approximate)';label=feature.properties.Name;source='https://github.com/Seshat-Global-History-Databank/cliopatria';license='CC BY 4.0';}
 }
 if(!feature){feature=urban.find(feature=>contains(feature,event));if(feature){kind='Present-day urban footprint';label=event.place;source='https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-urban-area/';license='Public domain';}}
 if(!feature&&political&&event.year>=2000){feature=countries.find(feature=>contains(feature,event));if(feature){kind='Present-day country outline';label=feature.properties.ADMIN;source='https://www.naturalearthdata.com/';license='Public domain';}}
 if(!feature){const radius=15/111,ring=Array.from({length:97},(_,i)=>{const angle=i/96*Math.PI*2;return [event.lon+Math.cos(angle)*radius/Math.cos(event.lat*Math.PI/180),event.lat+Math.sin(angle)*radius];});feature={geometry:{type:'Polygon',coordinates:[ring]}};kind='Site vicinity · 15 km radius';label=event.place;source='';license='Atlas geographic illustration; not a political border';}
 let angle=0;const lat=event.lat*Math.PI/180;
 for(const polygon of polygons(feature.geometry))for(const [lon2,lat2] of polygon[0]){const otherLat=lat2*Math.PI/180,difference=(lon2-event.lon)*Math.PI/180;angle=Math.max(angle,Math.acos(Math.max(-1,Math.min(1,Math.sin(lat)*Math.sin(otherLat)+Math.cos(lat)*Math.cos(otherLat)*Math.cos(difference)))));}
 const distance=Math.max(1.04,Math.min(3.7,Math.cos(angle)+Math.sin(angle)/Math.tan(17.5*Math.PI/180)*1.18));
 const cameraFocus=focus?{focusDistance:focus.focusDistance}:{};
 const area={label,kind,year:event.year,source,license,geometry:feature.geometry,distance,...cameraFocus};
 await writeFile(root+'/assets/areas/'+event.id+'.json',JSON.stringify(area));index[event.id]={label,kind,distance,...cameraFocus};
}
await writeFile(root+'/assets/areas/index.json',JSON.stringify(index));
console.log('Area outlines built:',Object.keys(index).length,Object.values(index).reduce((counts,item)=>(counts[item.kind]=(counts[item.kind]||0)+1,counts),{}));
