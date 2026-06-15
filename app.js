// ===== SUPABASE DATA LAYER =====
const PAGE_SIZE = 20;
let lastDoc = null;     // (غير مستخدم — أُبقي للتوافق)
let _adsOffset = 0;     // موضع التحميل للصفحات (pagination)
let allLoaded = false;

// يحوّل صفّ Supabase إلى نفس شكل الكائن الذي يتوقّعه باقي الموقع
function mapRow(d) {
  return {
    id: d.id,
    ref: d.ref || '',
    catId: d.category || d.catId || '',
    type: d.type, action: d.action, status: d.status, views: d.views,
    title: d.title || '',
    price: d.price || 0,
    location: d.location || '',
    city: d.city || '',
    neighborhood: d.neighborhood || '',
    desc: d.description || d.desc || '',
    phone: d.phone || '',
    images: d.images || d.image_urls || [],
    image_ids: d.image_ids || [],
    featured: d.featured || false,
    negotiable: d.negotiable || false,
    rooms: d.rooms, baths: d.baths, area: d.area, kitchens: d.kitchens,
    balconies: d.balconies, living: d.living, storage: d.storage,
    carType: d.car_type, carModel: d.car_model, carYear: d.car_year,
    carKm: d.car_km, carColor: d.car_color, carClass: d.car_class,
    profession: d.profession
  };
}

async function loadAdsFromFirestore(filters = {}) {
  let q = supabaseClient.from('ads').select('*').eq('status', 'active');
  if (filters.category) q = q.eq('category', filters.category);
  if (filters.type) q = q.eq('type', filters.type);
  if (filters.featured) q = q.eq('featured', true);
  q = q.order('created_at', { ascending: false })
       .range(_adsOffset, _adsOffset + PAGE_SIZE - 1);
  const { data, error } = await q;
  if (error) { console.error('Supabase load error:', error); allLoaded = true; return []; }
  if (!data || data.length < PAGE_SIZE) allLoaded = true;
  _adsOffset += (data ? data.length : 0);
  return (data || []).map(mapRow);
}

async function loadMoreAds() {
  if (allLoaded) return;
  const btn = document.getElementById('loadMoreBtn');
  if (btn) { btn.textContent = 'جاري التحميل...'; btn.disabled = true; }
  const newAds = await loadAdsFromFirestore({ category: sC, type: sType, featured: sFeatured });
  listings.push(...newAds);
  renderListings();
  if (btn) { btn.textContent = 'تحميل المزيد'; btn.disabled = false; }
  if (allLoaded && btn) btn.style.display = 'none';
}

function resetPagination() {
  _adsOffset = 0;
  allLoaded = false;
}

async function searchFirestore(queryText) {
  const text = (queryText || '').trim();
  if (text.length < 2) return [];
  const pattern = '%' + text + '%';
  const { data, error } = await supabaseClient
    .from('ads').select('*').eq('status', 'active')
    .or(`title.ilike.${pattern},description.ilike.${pattern},location.ilike.${pattern}`)
    .limit(50);
  if (error) { console.error('Supabase search error:', error); return []; }
  let results = (data || []).map(mapRow);
  const keywords = text.toLowerCase().split(' ').filter(w => w.length > 1);
  if (keywords.length > 1) {
    results = results.filter(ad =>
      keywords.every(kw => (ad.title + ' ' + ad.desc + ' ' + ad.location).toLowerCase().includes(kw))
    );
  }
  return results;
}

async function incrementViews(adId) {
  if (!USE_FIREBASE) return;
  // عدّ المشاهدة مرة واحدة فقط لكل إعلان في الجلسة الواحدة لتقليل الكتابات
  try {
    const seen = JSON.parse(sessionStorage.getItem('tam_viewed') || '[]');
    if (seen.includes(adId)) return;
    seen.push(adId);
    sessionStorage.setItem('tam_viewed', JSON.stringify(seen));
  } catch(e) {}
  try { await supabaseClient.rpc('increment_views', { ad_id: adId }); } catch(e) {}
}

/* ===== DATA ===== */
const CATS=[
  {id:'apt-rent',label:'شقق للإيجار',type:'apartment',action:'rent',color:'#0D9488',img:'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=200&h=200&fit=crop'},
  {id:'apt-sale',label:'شقق للبيع',type:'apartment',action:'sale',color:'#000',img:'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=200&h=200&fit=crop'},
  {id:'car-rent',label:'سيارات للإيجار',type:'car',action:'rent',color:'#7C3AED',img:'cat-car.webp'},
  {id:'car-sale',label:'سيارات للبيع',type:'car',action:'sale',color:'#E11D48',img:'cat-car.webp'},
  {id:'equip-rent',label:'معدات للإيجار',type:'equipment',action:'rent',color:'#D97706',img:'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&h=200&fit=crop'},
  {id:'equip-sale',label:'معدات للبيع',type:'equipment',action:'sale',color:'#B45309',img:'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=200&h=200&fit=crop'},
  {id:'free-ad',label:'إعلانات مجانية',type:'freead',action:'free',color:'#059669',img:'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=200&h=200&fit=crop'}
];
const CITIES=['جبلة','اللاذقية','أخرى'];
const NEIGHBORHOODS={'جبلة':['حي العمارة','حي العزي','حي الدريبة','حي القلعة','حي السوق (المدينة القديمة)','حي الفيض','حي جبيبات شرقية','حي جبيبات غربية','حي النقعة','حي الميناء','حي الكورنيش','حي التغرة','حي الجركس','حي جب جويخة','المتحلق','حي الصليبة','حي المهجع','حي المفيض','ضاحية المجد'],'اللاذقية':['حي العمارة','حي العزي','حي الدريبة','حي القلعة','حي السوق (المدينة القديمة)','حي الفيض','حي جبيبات شرقية','حي جبيبات غربية','حي النقعة','حي الميناء','حي الكورنيش','حي التغرة','حي الجركس','حي جب جويخة','المتحلق','حي الصليبة','حي المهجع','حي المفيض','ضاحية المجد']};
const LOCS=NEIGHBORHOODS['جبلة'];
const LOC_COORDS={
  'حي العمارة':{lat:35.3614,lng:35.9264},
  'حي العزي':{lat:35.3620,lng:35.9270},
  'حي الدريبة':{lat:35.3608,lng:35.9255},
  'حي القلعة':{lat:35.3625,lng:35.9250},
  'حي السوق (المدينة القديمة)':{lat:35.3612,lng:35.9260},
  'حي الفيض':{lat:35.3630,lng:35.9280},
  'حي جبيبات شرقية':{lat:35.3640,lng:35.9300},
  'حي جبيبات غربية':{lat:35.3635,lng:35.9285},
  'حي النقعة':{lat:35.3605,lng:35.9240},
  'حي الميناء':{lat:35.3575,lng:35.9195},
  'حي الكورنيش':{lat:35.3580,lng:35.9200},
  'حي التغرة':{lat:35.3650,lng:35.9310},
  'حي الجركس':{lat:35.3660,lng:35.9320},
  'حي جب جويخة':{lat:35.3645,lng:35.9295},
  'المتحلق':{lat:35.3670,lng:35.9335},
  'حي الصليبة':{lat:35.3600,lng:35.9230},
  'حي المهجع':{lat:35.3680,lng:35.9345},
  'حي المفيض':{lat:35.3690,lng:35.9355},
  'ضاحية المجد':{lat:35.3710,lng:35.9380},
};
const MONTHS=['كانون الثاني','شباط','آذار','نيسان','أيار','حزيران','تموز','آب','أيلول','تشرين الأول','تشرين الثاني','كانون الأول'];
const DAYS=['أحد','إثنين','ثلاثاء','أربعاء','خميس','جمعة','سبت'];

const HERO_IMGS=[
  'hero1.webp',
  'hero2.webp',
  'hero3.webp',
  'hero3.webp'
];

const APT_IMGS=[
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=400&fit=crop'
];
const CAR_IMGS=[
  'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1553440569-bcc63803a83d?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?w=600&h=400&fit=crop'
];
const EQUIP_IMGS=[
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600&h=400&fit=crop'
];
const FREEAD_IMGS=[
  'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
  'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop'
];

let listings=[]


let sC=null, sType=null, sQ='', sFeatured=false, carouselTimers=[];
let calY,calM,_calStart=null,_calEnd=null,_calPrice=0;

const getCat=id=>CATS.find(c=>c.id===id);
const isApt=id=>getCat(id)?.type==='apartment';
const isEquip=id=>getCat(id)?.type==='equipment';
const isCar=id=>getCat(id)?.type==='car';
const isFreeAd=id=>getCat(id)?.type==='freead';
const isRent=id=>id?.includes('rent');

// خلط إعلانات مجانية بشكل دوري — كل N إعلان عادي يظهر إعلان مجاني
function mixFreeAds(mainItems, freeItems, every=3){
  if(!freeItems.length) return mainItems;
  const result=[];
  let freeIdx=0;
  mainItems.forEach((item,i)=>{
    result.push(item);
    if((i+1)%every===0 && freeIdx<freeItems.length){
      result.push(freeItems[freeIdx++]);
    }
  });
  // أضف أي إعلانات مجانية متبقية بالنهاية
  while(freeIdx<freeItems.length) result.push(freeItems[freeIdx++]);
  return result;
}
const fmtPrice=(p,long)=>{
  if(!p && p!==0) return '';
  const unit = long ? ' ل.س جديدة' : ' ل.س.ج';
  return '\u200F' + Number(p).toLocaleString('en-US') + unit;
};

/* ===== SVG ICONS ===== */
function esc(str){
  if(!str && str!==0) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
const ICON={
  bed:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 012 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg>',
  bath:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16a1 1 0 011 1v3a4 4 0 01-4 4H7a4 4 0 01-4-4v-3a1 1 0 011-1z"/><path d="M6 12V5a2 2 0 012-2h3v2.25"/></svg>',
  area:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/></svg>',
  car:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.54 9.43l-1.28-3.84A2 2 0 0017.36 4H6.64a2 2 0 00-1.9 1.59L3.46 9.43A2 2 0 003 10.86V17a1 1 0 001 1h1a2 2 0 004 0h6a2 2 0 004 0h1a1 1 0 001-1v-6.14a2 2 0 00-.46-1.43z"/><circle cx="6.5" cy="14.5" r="1.5"/><circle cx="17.5" cy="14.5" r="1.5"/><path d="M5.41 10l.96-2.88A1 1 0 017.32 6.5h9.36a1 1 0 01.95.62L18.59 10H5.41z"/><line x1="7" y1="4.5" x2="17" y2="4.5"/></svg>',
  model:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  year:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  km:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
  cal:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  chevL:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>',
  chevR:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>',
  kitchen:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>',
  balcony:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13h18"/><path d="M5 13v8"/><path d="M19 13v8"/><path d="M12 13v8"/><path d="M3 21h18"/><path d="M6 3v4"/><path d="M18 3v4"/><rect x="4" y="7" width="16" height="6" rx="2"/></svg>',
  living:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 9V6a2 2 0 00-2-2H6a2 2 0 00-2 2v3"/><path d="M2 11v5a2 2 0 002 2h16a2 2 0 002-2v-5a2 2 0 00-4 0v2H6v-2a2 2 0 00-4 0z"/><path d="M4 18v2"/><path d="M20 18v2"/></svg>',
  storage:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
	  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
	  color:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"/></svg>',
	  type:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 00-.48-.41h-3.84a.48.48 0 00-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58z"/><circle cx="12" cy="12" r="3"/></svg>',
	  prev:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>',
	  next:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>',
	};

/* ===== CAROUSEL ===== */
function clearTimers(){carouselTimers.forEach(t=>clearInterval(t));carouselTimers=[];clearInterval(featScrollTimer);}
function initCarousels(container){
  container.querySelectorAll('.l-img, .det-gallery').forEach(cr=>{
    const imgs=cr.querySelectorAll('img'),dots=cr.querySelectorAll('.l-dots span');
    if(imgs.length<=1)return;
    let cur=0;
    const total=imgs.length;
    const show=i=>{
      cur=((i%total)+total)%total;
      imgs.forEach((m,j)=>m.classList.toggle('act',j===cur));
      dots.forEach((d,j)=>d.classList.toggle('act',j===cur));
    };
    // Auto rotate
    let t=setInterval(()=>show(cur+1),3500);
    carouselTimers.push(t);
    // Touch swipe - skip for cards inside #featScroll (let container scroll)
    const inFeatScroll=cr.closest('#featScroll');
    if(!inFeatScroll){
      let startX=0,startY=0,isDragging=false,direction=null;
      cr.addEventListener('touchstart',e=>{startX=e.touches[0].clientX;startY=e.touches[0].clientY;isDragging=true;direction=null;},{passive:true});
      cr.addEventListener('touchmove',e=>{
        if(!isDragging)return;
        const dx=Math.abs(e.touches[0].clientX-startX);
        const dy=Math.abs(e.touches[0].clientY-startY);
        if(!direction&&(dx>12||dy>12)){direction=dx>dy?'h':'v';}
        if(direction==='h')e.preventDefault();
      },{passive:false});
      cr.addEventListener('touchend',e=>{
        if(!isDragging)return;isDragging=false;
        if(direction!=='h')return;
        const diff=startX-e.changedTouches[0].clientX;
        if(Math.abs(diff)>55){
          clearInterval(t);
          if(diff>0)show(cur+1); else show(cur-1);
        }
        // إذا ما كانت swipe حقيقية، خليها click تكمل
        direction=null;
      },{passive:true});
    }
    // Click on dots
    dots.forEach((d,j)=>d.onclick=e=>{e.stopPropagation();show(j);});
  });
}

/* ===== HERO CAROUSEL ===== */
let heroIdx=0,heroTimer,heroSwipeInit=false;
function updateHeroSlide(){
  const bg=document.getElementById('heroBg');
  const dots=document.getElementById('heroDots');
  bg.querySelectorAll('img').forEach((img,i)=>img.classList.toggle('active',i===heroIdx));
  dots.querySelectorAll('span').forEach((d,i)=>d.classList.toggle('active',i===heroIdx));
}
function startHeroAuto(){
  clearInterval(heroTimer);
  heroTimer=setInterval(()=>{
    heroIdx=(heroIdx+1)%HERO_IMGS.length;
    updateHeroSlide();
  },7000);
}
function initHero(){
  const bg=document.getElementById('heroBg');
  const dots=document.getElementById('heroDots');
  bg.innerHTML=HERO_IMGS.map((src,i)=>`<img src="${src}" alt="" class="${i===0?'active':''}" ${i>0?'loading="lazy"':''}>`).join('');
  dots.innerHTML=HERO_IMGS.map((_,i)=>`<span class="${i===0?'active':''}"></span>`).join('');
  startHeroAuto();
  if(!heroSwipeInit){
    heroSwipeInit=true;
    const heroEl=document.querySelector('.hero');
    let hStartX=0,hStartY=0,swiping=false;
    heroEl.addEventListener('touchstart',e=>{
      hStartX=e.touches[0].clientX;
      hStartY=e.touches[0].clientY;
      swiping=true;
    },{passive:true});
    heroEl.addEventListener('touchmove',e=>{
      if(!swiping)return;
      const dx=Math.abs(e.touches[0].clientX-hStartX);
      const dy=Math.abs(e.touches[0].clientY-hStartY);
      if(dx>dy&&dx>15){e.preventDefault();}
    },{passive:false});
    heroEl.addEventListener('touchend',e=>{
      if(!swiping)return;
      swiping=false;
      const diff=hStartX-e.changedTouches[0].clientX;
      if(Math.abs(diff)>30){
        clearInterval(heroTimer);
        heroIdx=diff>0?(heroIdx+1)%HERO_IMGS.length:(heroIdx-1+HERO_IMGS.length)%HERO_IMGS.length;
        updateHeroSlide();
      }
    },{passive:true});
  }
}

/* ===== RENDER CARD ===== */
function renderCard(l,i,mode){
  const cat=getCat(l.catId),apt=isApt(l.catId),equip=isEquip(l.catId),rent=isRent(l.catId),freead=isFreeAd(l.catId);
  const imgs=l.images?.length?l.images:(apt?[APT_IMGS[0]]:equip?[EQUIP_IMGS[0]]:freead?[FREEAD_IMGS[0]]:[CAR_IMGS[0]]);
  
  let specs='';
  if(apt){
    specs=`<div class="l-spec">${ICON.bed} ${l.rooms||'—'} غرف</div><div class="l-spec">${ICON.bath} ${l.baths||'—'} حمام</div><div class="l-spec">${ICON.area} ${l.area||'—'} م²</div>`;
  }else if(equip || freead){
    specs='';
  }else{
    specs=`<div class="l-spec">${ICON.car} ${l.carType||'—'} ${l.carModel||''}</div><div class="l-spec">${ICON.year} ${l.carYear||'—'}</div>${rent?'':`<div class="l-spec">${ICON.km} ${l.carKm?l.carKm.toLocaleString()+' كم':'—'}</div>`}`;
  }
  
  const imgHTML=imgs.map((s,j)=>`<img src="${s}" alt="${esc(l.title)}" class="${j===0?'act':''}" loading="lazy">`).join('');
  const dotsHTML=imgs.length>1?`<div class="l-dots">${imgs.map((_,j)=>`<span class="${j===0?'act':''}"></span>`).join('')}</div>`:'';
  let badgeClass=l.catId==='apt-rent'?'rent':l.catId==='apt-sale'?'sale':l.catId==='car-rent'?'car-r':l.catId==='car-sale'?'car-s':l.catId==='equip-rent'?'equip-r':l.catId==='free-ad'?'free-ad':'equip-s';
  let badgeLabel=cat?cat.label:'';
  if(badgeLabel.includes('للإيجار')) badgeLabel='إيجار';
  else if(badgeLabel.includes('للبيع')) badgeLabel='بيع';
  
  const showBadge=!freead;

  // Free ad badge on image
  const freeAdBadge=freead?`<span class="l-badge free-ad">إعلان</span>`:'';

  // السعر
  const priceText=freead?'':fmtPrice(l.price);
  const priceSuffix=freead?'':(rent?'<small> / يوم</small>':'');
  const featTextHTML=(l.featured && !freead)?`<span class="l-feat-text">مميز</span>`:'';
  const catLabelHTML=showBadge?`<span class="l-cat-label ${badgeClass}">${badgeLabel}</span>`:'';
  const priceHTML=`<div class="l-footer">
    <div class="l-price-row" style="gap:4px;direction:ltr;justify-content:flex-end;">
      ${catLabelHTML}
      <span class="l-price${freead?' free':''}">${priceText}${priceSuffix}</span>
    </div>
    ${featTextHTML}
  </div>`;

  const featHTML='';

  // Free ads: 1 image only
  const cardImgs=freead?imgs.slice(0,1):imgs;
  const cardImgHTML=cardImgs.map((s,j)=>`<img src="${s}" alt="${esc(l.title)}" class="${j===0?'act':''}" loading="lazy">`).join('');
  const cardDotsHTML=cardImgs.length>1?`<div class="l-dots">${cardImgs.map((_,j)=>`<span class="${j===0?'act':''}"></span>`).join('')}</div>`:'';

  const descHTML=l.desc?`<div class="l-desc">${esc(l.desc).split('\n')[0]}</div>`:'';
  
  // Free ad profession badge
  const professionHTML='';
  
  // Location display: neighborhood / city
  const locDisplay = l.city && l.neighborhood ? `${esc(l.neighborhood)} / ${esc(l.city)}` : (l.location ? esc(l.location) : 'جبلة');

  if(mode==='full'){
    return `<div class="l-card-full af s${Math.min((i%5)+1,5)}" style="direction:rtl" onclick="event.stopPropagation();viewDetail('${l.id}')">
      <div class="l-img">${cardImgHTML}${cardDotsHTML}${featHTML}${freeAdBadge}</div>
      <div class="l-body" style="direction:rtl;text-align:right"><div class="l-title">${esc(l.title)}</div>${professionHTML}${descHTML}<div class="l-specs">${specs}</div><div class="l-loc">${ICON.pin}${locDisplay}</div>${priceHTML}</div>
    </div>`;
  }
  
  return `<div class="l-card af s${Math.min((i%5)+1,5)}" style="direction:rtl" onclick="event.stopPropagation();viewDetail('${l.id}')">
    <div class="l-img">${cardImgHTML}${cardDotsHTML}${featHTML}${freeAdBadge}</div>
    <div class="l-body" style="direction:rtl;text-align:right"><div class="l-title">${esc(l.title)}</div>${professionHTML}${descHTML}<div class="l-specs">${specs}</div><div class="l-loc">${ICON.pin}${locDisplay}</div>${priceHTML}</div>
  </div>`;
}

/* ===== NAVIGATION ===== */
let _activeTab='home';
let _navHistory=[];
let _skipPush=false;

// ===== NAVIGATION STACK =====
// stack داخلي لتتبع كل الصفحات المزارة
const _navStack = [];

function _navPush(state) {
  // احفظ الـ scroll الحالي على آخر عنصر بالـ stack قبل إضافة الصفحة الجديدة
  if (_navStack.length > 0) {
    _navStack[_navStack.length - 1].scrollPos = window.pageYOffset || document.documentElement.scrollTop || 0;
  }
  _navStack.push({...state, scrollPos: 0});
}

function _navReplace(state) {
  if (_navStack.length > 0) {
    _navStack[_navStack.length - 1] = {
      ..._navStack[_navStack.length - 1],
      ...state
    };
  } else {
    _navStack.push({...state, scrollPos: 0});
  }
}

function _navBack() {
  if (_navStack.length <= 1) return null;
  _navStack.pop(); // شيل الصفحة الحالية
  return _navStack[_navStack.length - 1]; // ارجع للسابقة
}


function navTab(tab){
  _activeTab=tab;
  // موبايل ناف
  document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('act'));
  const mBtn=document.querySelector(`.bnav-item[data-p="${tab}"]`);
  if(mBtn)mBtn.classList.add('act');
  // لابتوب ناف
  document.querySelectorAll('.desk-nav-btn').forEach(b=>b.classList.remove('act'));
  const dBtn=document.querySelector(`.desk-nav-btn[data-p="${tab}"]`);
  if(dBtn)dBtn.classList.add('act');

  if(tab==='home'){sC=null;sType=null;sFeatured=false;nav('home');}
  else if(tab==='all-listings'){sC=null;sType=null;sFeatured=false;nav('listings');}
  else if(tab==='cars'){sC=null;sType='car';sFeatured=false;nav('listings');}
  else if(tab==='apts'){sC=null;sType='apartment';sFeatured=false;nav('listings');}
  else if(tab==='equips'){sC=null;sType='equipment';sFeatured=false;nav('listings');}
  else if(tab==='freeads'){sC=null;sType='freead';sFeatured=false;nav('listings');}
}
function nav(page,detailId,keepPage){
  clearTimers();
  if(page!=='detail'){
    const bar=document.getElementById('abBottomBar');if(bar)bar.remove();
    const ov=document.getElementById('bookConfirmOverlay');if(ov)ov.remove();
  }
  document.querySelectorAll('.desk-nav-btn').forEach(b=>b.classList.remove('act'));
  if(page==='home'){const b=document.querySelector('.desk-nav-btn[data-p="home"]');if(b)b.classList.add('act');}
  else if(page==='listings'){
    const tab=sType==='car'?'cars':sType==='apartment'?'apts':sType==='equipment'?'equips':sType==='freead'?'freeads':'all-listings';
    const b=document.querySelector(`.desk-nav-btn[data-p="${tab}"]`);if(b)b.classList.add('act');
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
  document.getElementById('page-'+page).classList.add('act');
  if(page==='home') renderHome();
  if(page==='listings') renderListings(keepPage);
  if(!_skipPush) window.scrollTo({top:0,behavior:'smooth'});
  if(!_skipPush){
    const state={page,sC,sType,sFeatured,sQ,detailId:detailId||null,currentPage:_currentPage};
    history.pushState(state,'',null);
  }
  _skipPush=false;
}

// زر الرجوع بالمتصفح — يتزامن مع _navStack
window.addEventListener('popstate',function(e){
  _skipPush=true;
  const bar=document.getElementById('abBottomBar');if(bar)bar.remove();
  const ov=document.getElementById('bookConfirmOverlay');if(ov)ov.remove();
  if(e.state){
    sC=e.state.sC;sType=e.state.sType;sFeatured=e.state.sFeatured;sQ=e.state.sQ||'';
    if(e.state.currentPage!==undefined) _currentPage=e.state.currentPage;

    if(e.state.page==='detail'&&e.state.detailId){
      viewDetail(e.state.detailId);
    }else if(e.state.page==='listings'){
      _activeTab=sType==='car'?'cars':sType==='apartment'?'apts':sType==='equipment'?'equips':sType==='freead'?'freeads':'all-listings';
      document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('act'));
      const mBtn=document.querySelector(`.bnav-item[data-p="${_activeTab}"]`);
      if(mBtn)mBtn.classList.add('act');
      document.querySelectorAll('.desk-nav-btn').forEach(b=>b.classList.remove('act'));
      const dBtn=document.querySelector(`.desk-nav-btn[data-p="${_activeTab}"]`);
      if(dBtn)dBtn.classList.add('act');
      document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
      document.getElementById('page-listings').classList.add('act');
      renderListings(true);
      if(e.state.scrollPos) setTimeout(()=>window.scrollTo(0,e.state.scrollPos),100);
    }else{
      _activeTab='home';
      document.querySelectorAll('.bnav-item').forEach(b=>b.classList.remove('act'));
      const mBtn=document.querySelector('.bnav-item[data-p="home"]');
      if(mBtn)mBtn.classList.add('act');
      nav('home');
      if(e.state.scrollPos) setTimeout(()=>window.scrollTo(0,e.state.scrollPos),100);
    }
  }
  _skipPush=false;
});

/* ===== HOME ===== */
function renderHome(){
  initHero();
  
  // Categories (merged: شقق + سيارات + معدات + إعلانات مجانية)
  const mergedCats=[
    {type:'apartment',label:'شقق',img:'cat-apt.webp'},
    {type:'car',label:'سيارات',img:'cat-car.webp'},
    {type:'equipment',label:'معدات',img:'cat-equip.webp'},
    {type:'freead',label:'إعلانات مجانية',img:'cat-free.webp'}
  ];
  let catHTML='';
  mergedCats.forEach(c=>{
    const tab=c.type==='apartment'?'apts':c.type==='car'?'cars':c.type==='freead'?'freeads':'equips';
    catHTML+=`<div class="cat-item" onclick="sC=null;sType='${c.type}';navTab('${tab}')">
      <div class="cat-circle"><img src="${c.img}" alt="${c.label}" loading="lazy" style="${c.type==='apartment'?'transform:scale(.83)':''}"></div>
      <div class="cat-label">${c.label}</div>
    </div>`;
  });
  document.getElementById('catGrid').innerHTML=catHTML;
  
  // Featured - المميزة (بدون إعلانات مجانية أبداً)
  const featItems=listings.filter(l=>l.featured && !isFreeAd(l.catId));
  document.getElementById('featScroll').innerHTML=featItems.map((l,i)=>renderCard(l,i)).join('');
  
  // Latest - 16 كروت مع خلط دوري
  const latestNonFree=listings.filter(l=>!isFreeAd(l.catId)).slice(0,13);
  const latestFree=listings.filter(l=>isFreeAd(l.catId)).slice(0,3);
  const latestMixed=mixFreeAds(latestNonFree,latestFree,4);
  document.getElementById('latestGrid').innerHTML=latestMixed.map((l,i)=>renderCard(l,i)).join('');
  
  setTimeout(()=>initCarousels(document.getElementById('page-home')),150);
  // تحريك تلقائي للمميزة على الموبايل فقط
  if(window.innerWidth<1024) setTimeout(()=>initFeaturedAutoScroll(),300);
}

/* ===== FEATURED AUTO-SCROLL (موبايل فقط) ===== */
let featScrollTimer=null;
function fastScrollTo(el,target,duration){
  const start=el.scrollLeft;
  const diff=target-start;
  let startTime=null;
  function step(t){
    if(!startTime)startTime=t;
    const p=Math.min((t-startTime)/duration,1);
    const ease=p<0.5?2*p*p:(1-Math.pow(-2*p+2,2)/2);
    el.scrollLeft=start+diff*ease;
    if(p<1)requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
function initFeaturedAutoScroll(){
  clearInterval(featScrollTimer);
  const el=document.getElementById('featScroll');
  if(!el||!el.children.length)return;
  let idx=0;
  const total=el.children.length;
  featScrollTimer=setInterval(()=>{
    idx++;
    if(idx>=total){idx=0;fastScrollTo(el,0,300);}
    else{const card=el.children[idx];if(card)fastScrollTo(el,card.offsetLeft-el.offsetLeft,300);}
  },3000);
  el.addEventListener('touchstart',()=>clearInterval(featScrollTimer),{passive:true});
  el.addEventListener('touchend',()=>{
    clearInterval(featScrollTimer);
    setTimeout(()=>initFeaturedAutoScroll(),4000);
  },{passive:true});
}
/* ===== ALL CATEGORIES OVERLAY ===== */
function openAllCategories(){
  const allCats=[
    {label:'شقق للإيجار',tab:'apts',type:'apartment',catId:'apt-rent',icon:'🏠',bg:'rgba(13,148,136,.1)',color:'#0D9488'},
    {label:'شقق للبيع',tab:'apts',type:'apartment',catId:'apt-sale',icon:'🏢',bg:'rgba(0,0,0,.1)',color:'#000'},
    {label:'سيارات للإيجار',tab:'cars',type:'car',catId:'car-rent',icon:'🚗',bg:'rgba(124,58,237,.1)',color:'#7C3AED'},
    {label:'سيارات للبيع',tab:'cars',type:'car',catId:'car-sale',icon:'🚘',bg:'rgba(225,29,72,.1)',color:'#E11D48'},
    {label:'معدات للإيجار',tab:'equips',type:'equipment',catId:'equip-rent',icon:'🔧',bg:'rgba(217,119,6,.1)',color:'#D97706'},
    {label:'معدات للبيع',tab:'equips',type:'equipment',catId:'equip-sale',icon:'⚙️',bg:'rgba(180,83,9,.1)',color:'#B45309'},
    {label:'إعلانات مجانية',tab:'freeads',type:'freead',catId:'free-ad',icon:'📢',bg:'rgba(5,150,105,.1)',color:'#059669'},
  ];
  let html='';
  allCats.forEach(c=>{
    const count=listings.filter(l=>l.catId===c.catId).length;
    html+=`<div class="allcats-card" onclick="closeAllCategories();sC='${c.catId}';sType='${c.type}';navTab('${c.tab}')">
      <div class="allcats-card-icon" style="background:${c.bg};color:${c.color}"><span style="font-size:28px">${c.icon}</span></div>
      <div class="allcats-card-label">${c.label}</div>
      <div class="allcats-card-count">${count} إعلان</div>
    </div>`;
  });
  document.getElementById('allCatsGrid').innerHTML=html;
  document.getElementById('allCatsOverlay').classList.add('show');
  document.body.style.overflow='hidden';
}
function closeAllCategories(){
  document.getElementById('allCatsOverlay').classList.remove('show');
  document.body.style.overflow='';
}

/* ===== ADVANCED FILTER SHEET ===== */
let _filters={};

function openFilterSheet(){
  buildFilterOptions();
  document.getElementById('filterOverlay').classList.add('open');
  document.getElementById('filterSheet').classList.add('open');
}
function closeFilterSheet(){
  document.getElementById('filterOverlay').classList.remove('open');
  document.getElementById('filterSheet').classList.remove('open');
}

function buildFilterOptions(){
  const type=sType;
  const typeLabels={apartment:'شقق',car:'سيارات',equipment:'معدات',freead:'إعلانات مجانية'};
  document.getElementById('fsTitle').textContent='فلتر'+(type?' — '+typeLabels[type]:'');
  
  // Get relevant listings for extracting unique values
  const pool=type?listings.filter(l=>getCat(l.catId).type===type):listings;
  
  let html='';
  
  // Location - always show
  const locs=[...new Set(pool.map(l=>l.location))];
  html+=buildChipSection('الموقع / الحي','loc',locs);
  
  if(type==='car'){
    const types=[...new Set(pool.map(l=>l.carType).filter(Boolean))];
    const models=[...new Set(pool.map(l=>l.carModel).filter(Boolean))];
    const classes=[...new Set(pool.map(l=>l.carClass).filter(Boolean))];
    const colors=[...new Set(pool.map(l=>l.carColor).filter(Boolean))];
    const years=[...new Set(pool.map(l=>l.carYear).filter(Boolean))].sort((a,b)=>b-a);
    html+=buildChipSection('نوع السيارة','carType',types);
    html+=buildChipSection('الموديل','carModel',models);
    html+=buildChipSection('الفئة','carClass',classes);
    html+=buildChipSection('اللون','carColor',colors);
    html+=buildChipSection('سنة الصنع','carYear',years.map(y=>y+'+'));
    html+=`<div class="fs-section"><div class="fs-label">الكيلومتراج (كم) — حد أقصى</div><input type="number" class="fs-input" id="fsKm" placeholder="حد أقصى (كم)" value="${_filters.maxKm||''}"></div>`;
  }else if(type==='apartment'){
    const rooms=[...new Set(pool.map(l=>l.rooms).filter(Boolean))].sort((a,b)=>a-b);
    const baths=[...new Set(pool.map(l=>l.baths).filter(Boolean))].sort((a,b)=>a-b);
    html+=buildChipSection('غرف النوم','rooms',rooms);
    html+=buildChipSection('الحمامات','baths',baths);
    html+=`<div class="fs-section"><div class="fs-label">المساحة (م²) — حد أدنى</div><input type="number" class="fs-input" id="fsArea" placeholder="حد أدنى (م²)" value="${_filters.minArea||''}"></div>`;
  }else if(type==='freead'){
    const profs=[...new Set(pool.map(l=>l.profession).filter(Boolean))];
    html+=buildChipSection('المهنة','profession',profs);
  }
  
  // Price range - always
  html+=`<div class="fs-section"><div class="fs-label">السعر — حد أقصى</div><input type="number" class="fs-input" id="fsPrice" placeholder="حد أقصى (ل.س.ج)" value="${_filters.maxPrice||''}"></div>`;
  
  document.getElementById('fsBody').innerHTML=html;
  
  // Restore previous selections
  Object.keys(_filters).forEach(k=>{
    if(Array.isArray(_filters[k])){
      _filters[k].forEach(v=>{
        const chip=document.querySelector(`.fs-chip[data-key="${k}"][data-val="${v}"]`);
        if(chip)chip.classList.add('act');
      });
    }
  });
}

function buildChipSection(label,key,values){
  if(!values.length)return '';
  let html=`<div class="fs-section"><div class="fs-label">${label}</div><div class="fs-chips">`;
  html+=`<button class="fs-chip${!_filters[key]||!_filters[key].length?' act':''}" data-key="${key}" data-val="" onclick="toggleFilterChip(this,'${key}','')">الكل</button>`;
  values.forEach(v=>{
    const sel=_filters[key]&&_filters[key].includes(String(v));
    html+=`<button class="fs-chip${sel?' act':''}" data-key="${key}" data-val="${v}" onclick="toggleFilterChip(this,'${key}','${v}')">${v}</button>`;
  });
  html+=`</div></div>`;
  return html;
}

function toggleFilterChip(el,key,val){
  if(!val){
    // "الكل" clicked - clear this filter
    delete _filters[key];
    el.parentElement.querySelectorAll('.fs-chip').forEach(c=>c.classList.remove('act'));
    el.classList.add('act');
    return;
  }
  // Remove "الكل" active
  const allBtn=el.parentElement.querySelector('.fs-chip[data-val=""]');
  if(allBtn)allBtn.classList.remove('act');
  
  if(!_filters[key])_filters[key]=[];
  const idx=_filters[key].indexOf(val);
  if(idx>-1){
    _filters[key].splice(idx,1);
    el.classList.remove('act');
    if(!_filters[key].length){delete _filters[key];if(allBtn)allBtn.classList.add('act');}
  }else{
    _filters[key].push(val);
    el.classList.add('act');
  }
}

function clearAllFilters(){
  _filters={};
  buildFilterOptions();
}

function applyFilters(){
  // Save input values
  const kmEl=document.getElementById('fsKm');
  const areaEl=document.getElementById('fsArea');
  const priceEl=document.getElementById('fsPrice');
  if(kmEl&&kmEl.value)_filters.maxKm=parseInt(kmEl.value);else delete _filters.maxKm;
  if(areaEl&&areaEl.value)_filters.minArea=parseInt(areaEl.value);else delete _filters.minArea;
  if(priceEl&&priceEl.value)_filters.maxPrice=parseInt(priceEl.value);else delete _filters.maxPrice;
  closeFilterSheet();
  filterListings();
}

function renderListings(keepPage){
  _filters={};
  const typeLabels={apartment:'شقق',car:'سيارات',equipment:'معدات',freead:'إعلانات مجانية'};
  document.getElementById('listTitle').textContent=sFeatured?'إعلانات مميزة':sC?getCat(sC).label:sType?typeLabels[sType]:'جميع الإعلانات';
  if(sQ)document.getElementById('listSearch').value=sQ;
  
  const visibleCats=sType?CATS.filter(c=>c.type===sType):CATS;
  let fb=`<button class="f-btn ${!sC?'act':''}" onclick="sC=null;filterListings()">الكل</button>`;
  if(sType!=='freead'){
    visibleCats.forEach(c=>{
      fb+=`<button class="f-btn ${sC===c.id?'act':''}" onclick="sC='${c.id}';filterListings()">${c.label}</button>`;
    });
  }
  document.getElementById('filterRow').innerHTML=fb;
  filterListings(keepPage);
}

let _currentPage=1;
const PER_PAGE=50;
let _filteredList=[];
let _loadedCount=0;
let _scrollLoading=false;
function filterListings(keepPage){
  clearTimers();
  if(!keepPage) _currentPage=1;
  const q=document.getElementById('listSearch').value.trim();
  const filtered=listings.filter(l=>{
    const mc=!sC||l.catId===sC;
    const mt=!sType||getCat(l.catId).type===sType;
    const mf=!sFeatured||l.featured;
    const ms=!q||l.title.includes(q)||l.desc.includes(q)||l.location.includes(q)||(l.carType||'').includes(q)||(l.carModel||'').includes(q)||(l.profession||'').includes(q);
    if(!(mc&&mt&&mf&&ms))return false;
    
    // Advanced filters
    if(_filters.loc&&_filters.loc.length&&!_filters.loc.includes(l.location))return false;
    if(_filters.carType&&_filters.carType.length&&!_filters.carType.includes(l.carType))return false;
    if(_filters.carModel&&_filters.carModel.length&&!_filters.carModel.includes(l.carModel))return false;
    if(_filters.carClass&&_filters.carClass.length&&!_filters.carClass.includes(l.carClass))return false;
    if(_filters.carColor&&_filters.carColor.length&&!_filters.carColor.includes(l.carColor))return false;
    if(_filters.carYear&&_filters.carYear.length){
      const yrs=_filters.carYear.map(y=>parseInt(y));
      if(!yrs.some(y=>l.carYear>=y))return false;
    }
    if(_filters.rooms&&_filters.rooms.length&&!_filters.rooms.includes(String(l.rooms)))return false;
    if(_filters.baths&&_filters.baths.length&&!_filters.baths.includes(String(l.baths)))return false;
    if(_filters.maxKm&&l.carKm&&l.carKm>_filters.maxKm)return false;
    if(_filters.minArea&&l.area&&l.area<_filters.minArea)return false;
    if(_filters.maxPrice&&l.price>_filters.maxPrice)return false;
    if(_filters.profession&&_filters.profession.length&&!_filters.profession.includes(l.profession))return false;
    
    return true;
  });
  
  const _visCats=sType?CATS.filter(c=>c.type===sType):CATS;
  document.querySelectorAll('#filterRow .f-btn').forEach((b,i)=>{
    if(i===0)b.classList.toggle('act',!sC);
    else b.classList.toggle('act',sC===_visCats[i-1]?.id);
  });
  
  const typeLabels={apartment:'شقق',car:'سيارات',equipment:'معدات',freead:'إعلانات مجانية'};
  document.getElementById('listTitle').textContent=sFeatured?'إعلانات مميزة':sC?getCat(sC).label:sType?typeLabels[sType]:'جميع الإعلانات';
  document.getElementById('listCount').textContent=filtered.length+' إعلان';
  
  // Show free-ad CTA when viewing free ads section
  const freeCtaEl=document.getElementById('freeAdCtaList');
  if(sType==='freead'){
    freeCtaEl.innerHTML=`<a class="free-ad-cta" style="margin:0 0 16px" onclick="openFreeAdModal()">
      <div class="free-ad-cta-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></div>
      <div class="free-ad-cta-text"><strong>أضف إعلانك مجاناً</strong><span>تواصل معنا وننشره بدون رسوم</span></div>
      <div class="free-ad-cta-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg></div>
    </a>`;
  }else{
    freeCtaEl.innerHTML='';
  }
  
  if(!filtered.length){
    document.getElementById('allGrid').innerHTML='';
    document.getElementById('paginationWrap').innerHTML='';
    document.getElementById('emptyState').style.display='block';
  }else{
    document.getElementById('emptyState').style.display='none';
    // خلط الإعلانات المجانية بشكل دوري لما يكون عرض الكل
    if(!sType && !sC && !sFeatured){
      const mainItems=filtered.filter(l=>!isFreeAd(l.catId));
      const freeItems=filtered.filter(l=>isFreeAd(l.catId));
      _filteredList=mixFreeAds(mainItems,freeItems,4);
    }else{
      _filteredList=filtered;
    }
    renderPage(_currentPage);
  }
}

function goToPage(page){
  const state={page:'listings',sC,sType,sFeatured,sQ,detailId:null,currentPage:page};
  history.pushState(state,'',null);
  renderPage(page);
}

function renderPage(page){
  clearTimers();
  _currentPage=page;
  const start = (page - 1) * PER_PAGE;
  const end = Math.min(start + PER_PAGE, _filteredList.length);
  const pageItems = _filteredList.slice(start, end);
  
  document.getElementById('allGrid').innerHTML = pageItems.map((l, i) => renderCard(l, i, 'full')).join('');
  setTimeout(() => initCarousels(document.getElementById('allGrid')), 150);
  
  // Pagination
  renderPagination(page, Math.ceil(_filteredList.length / PER_PAGE), _filteredList.length, start, end);

  // Scroll to top of listings when changing page
  const listEl = document.getElementById('page-listings');
  if(listEl) window.scrollTo({top: listEl.offsetTop - 64, behavior: 'smooth'});
}
function renderPagination(current,totalPages,total,start,end){
  const wrap=document.getElementById('paginationWrap');
  if(totalPages<=1){wrap.innerHTML='';return;}
  
  let html='<div class="pagination-container">';
  // Previous button
  html+=`<button class="pg-btn" ${current===1?'disabled':''} onclick="goToPage(${current-1})">${ICON.prev}</button>`;
  
  // Smart ellipsis: always show first, last, and 2 pages around current
  const pages=[];
  const sidePages = 1; // Number of pages to show on each side of current
  
  if(totalPages <= 7){
    for(let i=1; i<=totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    
    if(current > sidePages + 3){
      pages.push('...');
    }
    
    const lo = Math.max(2, current - sidePages);
    const hi = Math.min(totalPages - 1, current + sidePages);
    
    for(let i=lo; i<=hi; i++){
      if(!pages.includes(i)) pages.push(i);
    }
    
    if(current < totalPages - (sidePages + 2)){
      pages.push('...');
    }
    
    if(!pages.includes(totalPages)) pages.push(totalPages);
  }
  
  pages.forEach(p=>{
    if(p==='...'){
      html+=`<span class="pg-dots">...</span>`;
    }else{
      html+=`<button class="pg-btn${p===current?' act':''}" onclick="goToPage(${p})">${p}</button>`;
    }
  });
  
  // Next button
  html+=`<button class="pg-btn" ${current===totalPages?'disabled':''} onclick="goToPage(${current+1})">${ICON.next}</button>`;
  html+='</div>';
  
  // Info text
  html+=`<div class="pg-info">عرض ${start+1}–${end} من ${total} إعلان</div>`;
  
  wrap.innerHTML=html;
}

/* ===== DETAIL ===== */
function viewDetail(id){
  clearTimers();
  const l=listings.find(x=>x.id===id);if(!l)return;
  window._currentListing=l;

  // Browser history for detail page
  if(!_skipPush){
    const scrollPos = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop;
    const currentState = history.state || {};
    currentState.scrollPos = scrollPos;
    currentState.currentPage = _currentPage;
    history.replaceState(currentState, '', null);

    const state={page:'detail',sC,sType,sFeatured,sQ,detailId:id,currentPage:_currentPage};
    history.pushState(state,'',null);
  }

  // Remove any existing bottom bar
  const oldBar=document.getElementById('abBottomBar');
  if(oldBar)oldBar.remove();
  const oldOverlay=document.getElementById('bookConfirmOverlay');
  if(oldOverlay)oldOverlay.remove();

  // Switch to detail page
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('act'));
  document.getElementById('page-detail').classList.add('act');
  
  // Scroll to top
  window.scrollTo({top:0,behavior:'smooth'});

  const cat=getCat(l.catId),apt=isApt(l.catId),rent=isRent(l.catId);
  const equip=isEquip(l.catId);
  const freead=isFreeAd(l.catId);
  let imgs=l.images?.length?l.images:(apt?[APT_IMGS[0]]:equip?[EQUIP_IMGS[0]]:freead?[FREEAD_IMGS[0]]:[CAR_IMGS[0]]);
  if(freead) imgs=imgs.slice(0,1);
  
  const imgHTML=imgs.map((s,j)=>`<img src="${s}" alt="${esc(l.title)}" class="${j===0?'act':''}" loading="lazy" onclick="openLightbox(${j})">`).join('');
  const dotsHTML=imgs.length>1?`<div class="l-dots">${imgs.map((_,j)=>`<span class="${j===0?'act':''}"></span>`).join('')}</div>`:'';
  let badgeClass=l.catId==='apt-rent'?'rent':l.catId==='apt-sale'?'sale':l.catId==='car-rent'?'car-r':l.catId==='car-sale'?'car-s':l.catId==='equip-rent'?'equip-r':l.catId==='free-ad'?'free-ad':'equip-s';

	  if(rent && apt){
	    // ===== RENTAL APARTMENTS - with Monthly/Daily toggle =====
	    let specsHTML=buildDetailSpecs(l,apt);
	    
	    document.getElementById('detWrap').innerHTML=`
	      <div class="det-gallery af">${imgHTML}${dotsHTML}
	        <button class="det-back" onclick="goBack(event)">${ICON.back}</button>
	        <button class="det-share-top" onclick="event.stopPropagation();shareListing('${l.id}')">${ICON.share}</button>
	      </div>
	      <div class="det-content">
	        <div class="det-title af">${esc(l.title)}</div>
		        <div class="det-meta af s1">
		          <div class="det-meta-item"><span class="det-meta-label">السعر</span><span class="det-meta-val det-meta-price" id="aptRentPrice">${fmtPrice(l.price,true)} <small style="font-size:11px;font-weight:600;color:var(--s400)">/ يوم</small></span></div>
		          <div class="det-meta-item"><span class="det-meta-label">الموقع</span><span class="det-meta-val" onclick="openMap('${esc(l.location)}')" style="cursor:pointer;color:var(--primary)">${l.neighborhood ? esc(l.neighborhood) + ' / ' + esc(l.city) : esc(l.location)}</span></div>
		          <div class="det-meta-item"><span class="det-meta-label">القسم</span><span class="det-meta-val">${cat.label}</span></div>
		          <div class="det-meta-item"><span class="det-meta-label">التفاوض</span><span class="det-meta-val">${l.negotiable ? '<span class="det-meta-neg-yes">✓ قابل للتفاوض</span>' : '<span class="det-meta-neg-no">غير قابل للتفاوض</span>'}</span></div>
		        </div>
	        <div class="det-specs af s2">${specsHTML}</div>
	        ${buildMapSection(l.location)}
	        <div class="det-desc af s3">
	          <h3 class="det-desc-title">الوصف</h3>${esc(l.desc)}
	        </div>


	        <!-- Monthly/Daily Toggle -->
	        <div class="rent-type-toggle af s4">
	          <button class="rt-btn act" id="rtDaily" onclick="switchRentType('daily',${l.price})">إيجار يومي</button>
	          <button class="rt-btn" id="rtMonthly" onclick="switchRentType('monthly',${l.price})">إيجار شهري</button>
	        </div>

	        <!-- Daily Calendar Section -->
	        <div id="dailySection">
	          <div class="rent-cal-layout">
	            <div class="rent-cal-main">
	              <div id="calSection" class="af s4">
	                <div class="cal-box" id="calBox">
	                  <div class="cal-grid-wrap">
	                    <div class="cal-head-title">${ICON.cal} تواريخ الحجز</div>
	                    <div class="cal-nav">
	                      <button onclick="calPrev()">${ICON.prev}</button>
	                      <div class="cal-mn" id="calMonth"></div>
	                      <button onclick="calNext()">${ICON.next}</button>
	                    </div>
	                    <div class="cal-grid" id="calGrid"></div>
	                  </div>
	                  <div class="cal-sum-wrap">
	                    <div class="cal-sum" id="calSummary" style="display:none">
	                      <div class="cal-row"><span class="cl">من</span><span class="cv" id="calFrom"></span></div>
	                      <div class="cal-row"><span class="cl">إلى</span><span class="cv" id="calTo"></span></div>
	                      <div class="cal-row"><span class="cl">المدة</span><span class="cv"><span id="calDays"></span> يوم</span></div>
	                      <div class="cal-row"><span class="cl">الإجمالي</span><span class="cv" id="calTotal"></span></div>
	                      <div style="text-align:center;margin-top:10px"><button class="cal-clear" onclick="clearCal()">مسح التواريخ</button></div>
	                    </div>
	                  </div>
	                </div>

	                <div id="bookFormSection" class="book-section af" style="display:none">
	                  <div class="bf-form-fields">
	                    <div class="bf-group"><label class="bf-label">الاسم الأول</label><input type="text" id="bfName" class="bf-input" placeholder="مثلاً: أحمد"></div>
	                    <div class="bf-group"><label class="bf-label">الكنية</label><input type="text" id="bfLast" class="bf-input" placeholder="مثلاً: علي"></div>
	                    <div class="bf-group"><label class="bf-label">رقم الهاتف</label><input type="tel" id="bfPhone" class="bf-input" placeholder="09xxxxxxxx" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
	                    <div class="bf-group"><label class="bf-label">العنوان <span class="opt-tag">(اختياري)</span></label><input type="text" id="bfAddress" class="bf-input" placeholder="المدينة، الحي"></div>
	                  </div>
	                  <div class="bf-form-footer">
	                    <button class="book-wa-btn" onclick="submitBooking('${l.id}')">${ICON.wa} للتأكيد والاستفسار التواصل عبر واتساب</button>
	                  </div>
	                </div>
	              </div>
	            </div>
	            <div class="rent-book-sidebar">
	              <div class="rent-book-card">
	                <div class="rbc-price" id="abSidePrice">${fmtPrice(l.price,true)} <small>/ يوم</small></div>
	                <div class="rbc-dates" id="abSideDates">حدد التواريخ من الروزنامة</div>
	                <button class="rbc-btn" onclick="handleBookClick()">احجز الآن</button>
	              </div>
	            </div>
	          </div>
	        </div>

	        <!-- Monthly Section -->
	        <div id="monthlySection" style="display:none">
	          <div class="monthly-box af s4">
	            <h3 class="monthly-title">${ICON.cal} مدة الإيجار الشهري</h3>
	            <select class="monthly-select" id="monthlySelect" onchange="selectMonth(this.value,${l.price})">
	              <option value="">— اختر مدة الإيجار —</option>
	            </select>
	            <div class="monthly-summary" id="monthlySummary" style="display:none">
	              <div class="cal-row"><span class="cl">المدة</span><span class="cv" id="monthlyDuration"></span></div>
	              <div class="cal-row"><span class="cl">الإجمالي</span><span class="cv" id="monthlyTotal"></span></div>
	            </div>
	            <div id="monthlyBookForm" class="book-section af" style="display:none;margin-top:16px">
	              <div class="bf-form-fields">
	                <div class="bf-group"><label class="bf-label">الاسم الأول</label><input type="text" id="mbfName" class="bf-input" placeholder="مثلاً: أحمد"></div>
	                <div class="bf-group"><label class="bf-label">الكنية</label><input type="text" id="mbfLast" class="bf-input" placeholder="مثلاً: علي"></div>
	                <div class="bf-group"><label class="bf-label">رقم الهاتف</label><input type="tel" id="mbfPhone" class="bf-input" placeholder="09xxxxxxxx" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
	              </div>
	              <div class="bf-form-footer">
	                <button class="book-wa-btn" onclick="submitMonthlyBooking('${l.id}')">${ICON.wa} للتأكيد والاستفسار التواصل عبر واتساب</button>
	              </div>
	            </div>
	          </div>
	        </div>

	      </div>`;

	    // Add bottom bar (mobile)
	    const bar=document.createElement('div');
	    bar.id='abBottomBar';
	    bar.className='rent-mobile-bar';
	    bar.innerHTML=`
	      <div style="display:flex;flex-direction:column">
	        <div style="font-size:20px;font-weight:900;color:#F6921E" id="abBarPrice">${fmtPrice(l.price,true)} <small style="font-size:12px;font-weight:500;color:#737373">/ يوم</small></div>
	        <div id="abBarDates" onclick="scrollToCal()" style="font-size:12px;color:#F6921E;font-weight:600;text-decoration:underline;cursor:pointer;margin-top:4px">حدد التواريخ</div>
	      </div>
	      <button onclick="handleBookClick()" style="background:linear-gradient(135deg,#000,#1a1a1a);color:#fff;border:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.3)">احجز الآن</button>`;
	    document.body.appendChild(bar);
	    
	    // nav('detail'); // Removed to prevent double history push
	    setTimeout(()=>{
	      initCarousels(document.getElementById('detWrap'));
	      initCalendar(l.price);
	      initMonthlyGrid(l.price);
	    },150);
	    
	  }else if(rent && !equip){
    // ===== RENTAL (Cars with Calendar & Booking) =====
    let specsHTML=buildDetailSpecs(l,apt);
    
    document.getElementById('detWrap').innerHTML=`
      <div class="det-gallery af">${imgHTML}${dotsHTML}
        <button class="det-back" onclick="goBack(event)">${ICON.back}</button>
        <button class="det-share-top" onclick="event.stopPropagation();shareListing('${l.id}')">${ICON.share}</button>
      </div>
	      <div class="det-content">
	        <div class="det-title af">${esc(l.title)}</div>
	        <div class="det-meta af s1">
	          <div class="det-meta-item"><span class="det-meta-label">السعر</span><span class="det-meta-val det-meta-price">${fmtPrice(l.price,true)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">الموقع</span><span class="det-meta-val" onclick="openMap('${esc(l.location)}')" style="cursor:pointer;color:var(--primary)">${l.neighborhood ? esc(l.neighborhood) + ' / ' + esc(l.city) : esc(l.location)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">القسم</span><span class="det-meta-val">${cat.label}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">التفاوض</span><span class="det-meta-val">${l.negotiable ? '<span class="det-meta-neg-yes">✓ قابل للتفاوض</span>' : '<span class="det-meta-neg-no">غير قابل للتفاوض</span>'}</span></div>
	        </div>
        <div class="det-specs af s2">${specsHTML}</div>
        ${buildMapSection(l.location, 'موقع السيارة')}
        <div class="det-desc af s3">
          <h3 class="det-desc-title">الوصف</h3>${esc(l.desc)}
        </div>


        <div class="rent-cal-layout">
          <div class="rent-cal-main">
            <div id="calSection" class="af s4">
              <div class="cal-box" id="calBox">
                <div class="cal-grid-wrap">
                  <div class="cal-head-title">${ICON.cal} تواريخ الحجز</div>
                  <div class="cal-nav">
                    <button onclick="calPrev()">${ICON.prev}</button>
                    <div class="cal-mn" id="calMonth"></div>
                    <button onclick="calNext()">${ICON.next}</button>
                  </div>
                  <div class="cal-grid" id="calGrid"></div>
                </div>
                <div class="cal-sum-wrap">
                  <div class="cal-sum" id="calSummary" style="display:none">
                    <div class="cal-row"><span class="cl">من</span><span class="cv" id="calFrom"></span></div>
                    <div class="cal-row"><span class="cl">إلى</span><span class="cv" id="calTo"></span></div>
                    <div class="cal-row"><span class="cl">المدة</span><span class="cv"><span id="calDays"></span> يوم</span></div>
                    <div class="cal-row"><span class="cl">الإجمالي</span><span class="cv" id="calTotal"></span></div>
                    <div style="text-align:center;margin-top:10px"><button class="cal-clear" onclick="clearCal()">مسح التواريخ</button></div>
                  </div>
                </div>
              </div>

              <div id="bookFormSection" class="book-section af" style="display:none">
                <div class="bf-form-fields">
                  <div class="bf-group"><label class="bf-label">الاسم الأول</label><input type="text" id="bfName" class="bf-input" placeholder="مثلاً: أحمد"></div>
                  <div class="bf-group"><label class="bf-label">الكنية</label><input type="text" id="bfLast" class="bf-input" placeholder="مثلاً: علي"></div>
                  <div class="bf-group"><label class="bf-label">رقم الهاتف</label><input type="tel" id="bfPhone" class="bf-input" placeholder="09xxxxxxxx" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
                  <div class="bf-group"><label class="bf-label">العنوان <span class="opt-tag">(اختياري)</span></label><input type="text" id="bfAddress" class="bf-input" placeholder="المدينة، الحي"></div>
                </div>
                <div class="bf-form-footer">
                  <button class="book-wa-btn" onclick="submitBooking('${l.id}')">${ICON.wa} للتأكيد والاستفسار التواصل عبر واتساب</button>
                </div>
              </div>
            </div>
          </div>

          <div class="rent-book-sidebar">
            <div class="rent-book-card">
              <div class="rbc-price" id="abSidePrice">${fmtPrice(l.price,true)} <small>/ يوم</small></div>
              <div class="rbc-dates" id="abSideDates">حدد التواريخ من الروزنامة</div>
              <button class="rbc-btn" onclick="handleBookClick()">احجز الآن</button>
            </div>
          </div>
        </div>
      </div>`;

    // Add bottom bar for car rental (mobile only)
    const bar=document.createElement('div');
    bar.id='abBottomBar';
    bar.className='rent-mobile-bar';
    bar.innerHTML=`
      <div style="display:flex;flex-direction:column">
        <div style="font-size:20px;font-weight:900;color:#F6921E" id="abBarPrice">${fmtPrice(l.price,true)} <small style="font-size:12px;font-weight:500;color:#737373">/ يوم</small></div>
        <div id="abBarDates" onclick="scrollToCal()" style="font-size:12px;color:#F6921E;font-weight:600;text-decoration:underline;cursor:pointer;margin-top:4px">حدد التواريخ</div>
      </div>
      <button onclick="handleBookClick()" style="background:linear-gradient(135deg,#000,#1a1a1a);color:#fff;border:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.3)">احجز الآن</button>`;
    document.body.appendChild(bar);
    
    // nav('detail'); // Removed to prevent double history push
    setTimeout(()=>{
      initCarousels(document.getElementById('detWrap'));
      initCalendar(l.price);
    },150);
    
  }else if(equip && isRent(l.catId)){
    // ===== EQUIPMENT RENTAL (with Calendar & Booking) =====
    document.getElementById('detWrap').innerHTML=`
      <div class="det-gallery af">${imgHTML}${dotsHTML}
        <button class="det-back" onclick="goBack(event)">${ICON.back}</button>
        <button class="det-share-top" onclick="event.stopPropagation();shareListing('${l.id}')">${ICON.share}</button>
      </div>
	      <div class="det-content">
	        <div class="det-title af">${esc(l.title)}</div>
	        <div class="det-meta af s1">
	          <div class="det-meta-item"><span class="det-meta-label">السعر</span><span class="det-meta-val det-meta-price">${fmtPrice(l.price,true)} <small style="font-size:11px;font-weight:600;color:var(--s400)">/ يوم</small></span></div>
	          <div class="det-meta-item"><span class="det-meta-label">الموقع</span><span class="det-meta-val" onclick="openMap('${esc(l.location)}')" style="cursor:pointer;color:var(--primary)">${l.neighborhood ? esc(l.neighborhood) + ' / ' + esc(l.city) : esc(l.location)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">القسم</span><span class="det-meta-val">${cat.label}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">التفاوض</span><span class="det-meta-val">${l.negotiable ? '<span class="det-meta-neg-yes">✓ قابل للتفاوض</span>' : '<span class="det-meta-neg-no">غير قابل للتفاوض</span>'}</span></div>
	        </div>
	        <div class="det-desc af s2">
	          <h3 class="det-desc-title">الوصف</h3>${esc(l.desc)}
	        </div>

	        <div class="rent-cal-layout">
	          <div class="rent-cal-main">
	            <div id="calSection" class="af s3">
	              <div class="cal-box" id="calBox">
	                <div class="cal-grid-wrap">
	                  <div class="cal-head-title">${ICON.cal} تواريخ الحجز</div>
	                  <div class="cal-nav">
	                    <button onclick="calPrev()">${ICON.prev}</button>
	                    <div class="cal-mn" id="calMonth"></div>
	                    <button onclick="calNext()">${ICON.next}</button>
	                  </div>
	                  <div class="cal-grid" id="calGrid"></div>
	                </div>
	                <div class="cal-sum-wrap">
	                  <div class="cal-sum" id="calSummary" style="display:none">
	                    <div class="cal-row"><span class="cl">من</span><span class="cv" id="calFrom"></span></div>
	                    <div class="cal-row"><span class="cl">إلى</span><span class="cv" id="calTo"></span></div>
	                    <div class="cal-row"><span class="cl">المدة</span><span class="cv"><span id="calDays"></span> يوم</span></div>
	                    <div class="cal-row"><span class="cl">الإجمالي</span><span class="cv" id="calTotal"></span></div>
	                    <div style="text-align:center;margin-top:10px"><button class="cal-clear" onclick="clearCal()">مسح التواريخ</button></div>
	                  </div>
	                </div>
	              </div>

	              <div id="bookFormSection" class="book-section af" style="display:none">
	                <div class="bf-form-fields">
	                  <div class="bf-group"><label class="bf-label">الاسم الأول</label><input type="text" id="bfName" class="bf-input" placeholder="مثلاً: أحمد"></div>
	                  <div class="bf-group"><label class="bf-label">الكنية</label><input type="text" id="bfLast" class="bf-input" placeholder="مثلاً: علي"></div>
	                  <div class="bf-group"><label class="bf-label">رقم الهاتف</label><input type="tel" id="bfPhone" class="bf-input" placeholder="09xxxxxxxx" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
	                  <div class="bf-group"><label class="bf-label">العنوان <span class="opt-tag">(اختياري)</span></label><input type="text" id="bfAddress" class="bf-input" placeholder="المدينة، الحي"></div>
	                </div>
	                <div class="bf-form-footer">
	                  <button class="book-wa-btn" onclick="submitBooking('${l.id}')">${ICON.wa} للتأكيد والاستفسار التواصل عبر واتساب</button>
	                </div>
	              </div>
	            </div>
	          </div>

	          <div class="rent-book-sidebar">
	            <div class="rent-book-card">
	              <div class="rbc-price" id="abSidePrice">${fmtPrice(l.price,true)} <small>/ يوم</small></div>
	              <div class="rbc-dates" id="abSideDates">حدد التواريخ من الروزنامة</div>
	              <button class="rbc-btn" onclick="handleBookClick()">احجز الآن</button>
	            </div>
	          </div>
	        </div>
	      </div>`;

    // Add bottom bar (mobile)
    const bar=document.createElement('div');
    bar.id='abBottomBar';
    bar.className='rent-mobile-bar';
    bar.innerHTML=`
      <div style="display:flex;flex-direction:column">
        <div style="font-size:20px;font-weight:900;color:#F6921E" id="abBarPrice">${fmtPrice(l.price,true)} <small style="font-size:12px;font-weight:500;color:#737373">/ يوم</small></div>
        <div id="abBarDates" onclick="scrollToCal()" style="font-size:12px;color:#F6921E;font-weight:600;text-decoration:underline;cursor:pointer;margin-top:4px">حدد التواريخ</div>
      </div>
      <button onclick="handleBookClick()" style="background:linear-gradient(135deg,#000,#1a1a1a);color:#fff;border:none;border-radius:14px;padding:14px 28px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 20px rgba(0,0,0,.3)">احجز الآن</button>`;
    document.body.appendChild(bar);
    
    setTimeout(()=>{
      initCarousels(document.getElementById('detWrap'));
      initCalendar(l.price);
    },150);

  }else if(freead){
    // ===== FREE ADS - description only, no booking =====
    document.getElementById('detWrap').innerHTML=`
      <div class="det-gallery af">${imgHTML}${dotsHTML}
        <button class="det-back" onclick="goBack(event)">${ICON.back}</button>
        <button class="det-share-top" onclick="event.stopPropagation();shareListing('${l.id}')">${ICON.share}</button>
      </div>
	      <div class="det-content">
	        <div class="det-title af">${esc(l.title)}</div>
	        <div class="det-meta af s1">
	          <div class="det-meta-item"><span class="det-meta-label">النوع</span><span class="det-meta-val">إعلان مجاني</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">الموقع</span><span class="det-meta-val" onclick="openMap('${esc(l.location)}')" style="cursor:pointer;color:var(--primary)">${l.neighborhood ? esc(l.neighborhood) + ' / ' + esc(l.city) : esc(l.location)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">المهنة</span><span class="det-meta-val">${esc(l.profession) || '—'}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">القسم</span><span class="det-meta-val">${cat.label}</span></div>
	        </div>
        <div class="det-desc-container af s2">
	          <div class="det-desc"><h3 class="det-desc-title">الوصف</h3>${esc(l.desc)}</div>
	          <div class="det-actions">
	            <button class="det-wa-btn" onclick="openWA('${l.id}')">${ICON.wa} تواصل عبر واتساب</button>
	            <a class="det-wa-btn" href="tel:+${(l.phone||'963983127483').replace(/[^0-9]/g,'')}" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px;background:#F6921E;color:#fff;border:none;border-radius:14px;padding:14px;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit;width:100%;margin-top:12px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:20px;height:20px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.11 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> اتصال مباشر</a>
	          </div>
        </div>
      </div>`;
    
    // nav('detail'); // Removed to prevent double history push
    setTimeout(()=>initCarousels(document.getElementById('detWrap')),150);

  }else{
    // ===== SALE listings - keep original style =====
    let specsHTML=buildDetailSpecs(l,apt);
    
    document.getElementById('detWrap').innerHTML=`
      <div class="det-gallery af">${imgHTML}${dotsHTML}
        <button class="det-back" onclick="goBack(event)">${ICON.back}</button>
        <button class="det-share-top" onclick="event.stopPropagation();shareListing('${l.id}')">${ICON.share}</button>
      </div>
	      <div class="det-content">
	        <div class="det-title af">${esc(l.title)}</div>
	        <div class="det-meta af s1">
	          <div class="det-meta-item"><span class="det-meta-label">السعر</span><span class="det-meta-val det-meta-price">${fmtPrice(l.price,true)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">الموقع</span><span class="det-meta-val" onclick="openMap('${esc(l.location)}')" style="cursor:pointer;color:var(--primary)">${l.neighborhood ? esc(l.neighborhood) + ' / ' + esc(l.city) : esc(l.location)}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">القسم</span><span class="det-meta-val">${cat.label}</span></div>
	          <div class="det-meta-item"><span class="det-meta-label">التفاوض</span><span class="det-meta-val">${l.negotiable ? '<span class="det-meta-neg-yes">✓ قابل للتفاوض</span>' : '<span class="det-meta-neg-no">غير قابل للتفاوض</span>'}</span></div>
	        </div>
	        <div class="det-specs af s2">${specsHTML}</div>
	        ${buildMapSection(l.location, apt?'موقع العقار':'موقع السيارة')}
	        <div class="det-desc-container af s3">
	          <div class="det-desc"><h3 class="det-desc-title">الوصف</h3>${esc(l.desc)}</div>
	          <div class="det-actions">
	            <button class="det-wa-btn" onclick="openWA('${l.id}')">${ICON.wa} للتأكيد والاستفسار التواصل عبر واتساب</button>
	          </div>
	        </div>
	      </div>`;
    
    // nav('detail'); // Removed to prevent double history push
    setTimeout(()=>initCarousels(document.getElementById('detWrap')),150);
  }
}

function buildDetailSpecs(l,apt){
  if(apt){
    return `
      <div class="det-sp">${ICON.bed}<div><div class="sp-label">غرف النوم</div><div class="sp-val">${l.rooms||'—'}</div></div></div>
      <div class="det-sp">${ICON.bath}<div><div class="sp-label">حمامات</div><div class="sp-val">${l.baths||'—'}</div></div></div>
      <div class="det-sp">${ICON.kitchen}<div><div class="sp-label">مطابخ</div><div class="sp-val">${l.kitchens||'—'}</div></div></div>
      <div class="det-sp">${ICON.living}<div><div class="sp-label">غرف معيشة</div><div class="sp-val">${l.living||'—'}</div></div></div>
      <div class="det-sp">${ICON.balcony}<div><div class="sp-label">شرفات</div><div class="sp-val">${l.balconies||'—'}</div></div></div>
      <div class="det-sp">${ICON.storage}<div><div class="sp-label">غرفة تخزين</div><div class="sp-val">${l.storage?'نعم':'لا'}</div></div></div>
      <div class="det-sp">${ICON.area}<div><div class="sp-label">المساحة</div><div class="sp-val">${l.area||'—'} م²</div></div></div>`;
  }else if(isEquip(l.catId)){
    return '';
  }else{
    return `
      <div class="det-sp">${ICON.car}<div><div class="sp-label">النوع</div><div class="sp-val">${l.carType||'—'}</div></div></div>
      <div class="det-sp">${ICON.model}<div><div class="sp-label">الموديل</div><div class="sp-val">${l.carModel||'—'}</div></div></div>
      <div class="det-sp">${ICON.type}<div><div class="sp-label">الفئة</div><div class="sp-val">${l.carClass||'—'}</div></div></div>
      <div class="det-sp">${ICON.color}<div><div class="sp-label">اللون</div><div class="sp-val">${l.carColor||'—'}</div></div></div>
      <div class="det-sp">${ICON.year}<div><div class="sp-label">سنة الصنع</div><div class="sp-val">${l.carYear||'—'}</div></div></div>
      ${isRent(l.catId)?'':`<div class="det-sp">${ICON.km}<div><div class="sp-label">المسافة</div><div class="sp-val">${l.carKm?l.carKm.toLocaleString()+' كم':'—'}</div></div></div>`}`;
  }
}

/* ===== MONTHLY/DAILY RENT TOGGLE ===== */
let _selectedMonths=null;
let _monthlyPrice=0;

function switchRentType(type,price){
  document.getElementById('rtDaily').classList.toggle('act',type==='daily');
  document.getElementById('rtMonthly').classList.toggle('act',type==='monthly');
  document.getElementById('dailySection').style.display=type==='daily'?'':'none';
  document.getElementById('monthlySection').style.display=type==='monthly'?'':'none';
  // Update price display
  const priceEl=document.getElementById('aptRentPrice');
  if(type==='monthly'){
    priceEl.innerHTML=fmtPrice(price*30,true)+' <small>/ شهر</small>';
  }else{
    priceEl.innerHTML=fmtPrice(price,true)+' <small>/ يوم</small>';
  }
  // Update mobile bar
  const barPrice=document.getElementById('abBarPrice');
  if(barPrice){
    if(type==='monthly') barPrice.innerHTML=fmtPrice(price*30,true)+' <small style="font-size:12px;font-weight:500;color:#737373">/ شهر</small>';
    else barPrice.innerHTML=fmtPrice(price,true)+' <small style="font-size:12px;font-weight:500;color:#737373">/ يوم</small>';
  }
}

function initMonthlyGrid(dailyPrice){
  _monthlyPrice=dailyPrice*30;
  _selectedMonths=null;
  const sel=document.getElementById('monthlySelect');
  let html='<option value="">— اختر مدة الإيجار —</option>';
  for(let i=1;i<=24;i++){
    html+=`<option value="${i}">${i} شهر</option>`;
  }
  html+=`<option value="-1">∞ مدة غير محددة</option>`;
  sel.innerHTML=html;
  document.getElementById('monthlySummary').style.display='none';
  document.getElementById('monthlyBookForm').style.display='none';
}

function selectMonth(val,dailyPrice){
  const m=parseInt(val);
  if(!val||isNaN(m)){_selectedMonths=null;document.getElementById('monthlySummary').style.display='none';document.getElementById('monthlyBookForm').style.display='none';return;}
  _selectedMonths=m;
  const mp=dailyPrice*30;
  const sum=document.getElementById('monthlySummary');
  sum.style.display='block';
  document.getElementById('monthlyBookForm').style.display='block';
  if(m===-1){
    document.getElementById('monthlyDuration').textContent='مدة غير محددة';
    document.getElementById('monthlyTotal').textContent='يُتفق عليه';
  }else{
    document.getElementById('monthlyDuration').textContent=m+' شهر';
    document.getElementById('monthlyTotal').textContent=fmtPrice(mp*m);
  }
  const barPrice=document.getElementById('abBarPrice');
  const barDates=document.getElementById('abBarDates');
  if(barPrice && m!==-1) barPrice.innerHTML=fmtPrice(mp*m)+' <small style="font-size:12px;font-weight:500;color:#737373">/ '+m+' شهر</small>';
  else if(barPrice) barPrice.innerHTML=fmtPrice(mp)+' <small style="font-size:12px;font-weight:500;color:#737373">/ شهر</small>';
  if(barDates) barDates.textContent=m===-1?'مدة مفتوحة':m+' شهر';
}

function submitMonthlyBooking(id){
  const l=listings.find(x=>x.id===id)||window._currentListing;if(!l)return;
  const name=document.getElementById('mbfName').value.trim();
  const last=document.getElementById('mbfLast').value.trim();
  const phone=document.getElementById('mbfPhone').value.trim();
  if(!name||!phone){alert('يرجى تعبئة الاسم ورقم الهاتف');return;}
  if(_selectedMonths === undefined || _selectedMonths === null){alert('يرجى اختيار مدة الإيجار');return;}
  const cat=getCat(l.catId);
  let msg='🔔 *طلب إيجار شهري جديد*\n';
  msg+='━━━━━━━━━━━━━━━━━\n';
  if(l.ref) msg+='🔖 رمز الإعلان: '+l.ref+'\n';msg+='\n';
  msg+='📌 *'+l.title+'*\n';
  msg+='🏷️ '+cat.label+'\n';
  msg+='📍 '+l.location+'، جبلة\n\n';
  msg+='📆 *تفاصيل الإيجار:*\n';
  msg+='▫️ نوع الإيجار: شهري\n';
  msg+='▫️ المدة: '+(_selectedMonths===-1?'♾️ مدة غير محددة':_selectedMonths+' شهر')+'\n';
  msg+='▫️ الإيجار الشهري: '+fmtPrice(l.price*30)+'\n';
  if(_selectedMonths>0) msg+='▫️ 💰 *الإجمالي: '+fmtPrice(l.price*30*_selectedMonths)+'*\n';
  else msg+='▫️ 💰 الإجمالي: يُتفق عليه\n';
  msg+='\n👤 *معلومات المستأجر:*\n';
  msg+='▫️ الاسم: '+name+' '+last+'\n';
  msg+='▫️ الهاتف: '+phone+'\n';
  msg+='\n✅ بانتظار التأكيد\nشكراً لكم 🙏';
  const targetPhone = '963983127483';
  const waUrl = 'https://wa.me/' + targetPhone + '?text=' + encodeURIComponent(msg);
  const win = window.open(waUrl, '_blank');
  if(!win) window.location.href = waUrl;
}

function closeRentDetail(){
  const bar=document.getElementById('abBottomBar');
  if(bar)bar.remove();
  goBack();
}

function scrollToCal(){
  const el=document.getElementById('calSection');
  if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
}

function handleBookClick(){
  if(!_calStart||!_calEnd){
    scrollToCal();
    // Flash the calendar
    const box=document.getElementById('calBox');
    if(box){box.style.borderColor='var(--primary)';box.style.boxShadow='0 0 0 3px rgba(0,0,0,.15)';setTimeout(()=>{box.style.borderColor='#f0f0f0';box.style.boxShadow='none';},1500);}
    return;
  }
  // Show booking form
  const form=document.getElementById('bookFormSection');
  if(form){
    form.style.display='block';
    form.scrollIntoView({behavior:'smooth',block:'center'});
  }
}

function submitBooking(id){
  const l=listings.find(x=>x.id===id)||window._currentListing;if(!l)return;
  const name=document.getElementById('bfName').value.trim();
  const last=document.getElementById('bfLast').value.trim();
  const phone=document.getElementById('bfPhone').value.trim();
  const address=document.getElementById('bfAddress').value.trim();
  const email=(document.getElementById('bfEmail')||{value:''}).value.trim();
  
  if(!name||!last||!phone){
    // highlight required fields
    ['bfName','bfLast','bfPhone'].forEach(fid=>{
      const el=document.getElementById(fid);
      if(!el.value.trim()){el.style.borderColor='var(--rose)';setTimeout(()=>el.style.borderColor='#f0f0f0',2000);}
    });
    return;
  }
  
  const d=(_calStart&&_calEnd)?Math.round((_calEnd-_calStart)/864e5)+1:0;
  const cat=getCat(l.catId);
  let msg='🔔 *طلب حجز جديد*\n';
  msg+='━━━━━━━━━━━━━━━━━\n';
  if(l.ref) msg+='🔖 رمز الإعلان: '+l.ref+'\n';msg+='\n';
  msg+='📌 *'+l.title+'*\n';
  msg+='🏷️ '+cat.label+'\n';
  msg+='📍 '+l.location+'، جبلة\n\n';
  if(_calStart&&_calEnd){
    msg+='📆 *تفاصيل الحجز:*\n';
    msg+='▫️ تاريخ البداية: '+fmtDate(_calStart)+'\n';
    msg+='▫️ تاريخ النهاية: '+fmtDate(_calEnd)+'\n';
    msg+='▫️ عدد الأيام: '+d+' يوم\n';
    msg+='▫️ السعر اليومي: '+fmtPrice(l.price)+'\n';
    msg+='▫️ 💰 *الإجمالي: '+fmtPrice(l.price*d)+'*\n\n';
  }
  msg+='👤 *معلومات المستأجر:*\n';
  msg+='▫️ الاسم: '+name+' '+last+'\n';
  msg+='▫️ الهاتف: '+phone+'\n';
  if(address)msg+='▫️ العنوان: '+address+'\n';
  if(email)msg+='▫️ الإيميل: '+email+'\n';
  msg+='\n✅ بانتظار التأكيد\nشكراً لكم 🙏';
  
  const targetPhone = '963983127483';
  const waUrl = 'https://wa.me/' + targetPhone + '?text=' + encodeURIComponent(msg);
  const win = window.open(waUrl, '_blank');
  if(!win) window.location.href = waUrl;
  
  // Show confirmation overlay
  showBookConfirm();
}

function showBookConfirm(){
  const old=document.getElementById('bookConfirmOverlay');
  if(old)old.remove();
  const ov=document.createElement('div');
  ov.id='bookConfirmOverlay';
  ov.className='book-confirm-overlay';
  ov.innerHTML=`<div class="book-confirm-box">
    <div class="bc-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
    <h3>تم إرسال طلب الحجز!</h3>
    <p>سيتم تأكيد الحجز من قبلنا عبر اتصال هاتفي أو رسالة واتساب أو إيميل</p>
    <button class="bc-close" onclick="document.getElementById('bookConfirmOverlay').remove()">حسناً</button>
  </div>`;
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{if(e.target===ov)ov.remove();});
}

function openMap(loc){
  const q=encodeURIComponent(loc+' جبلة سوريا');
  window.open('https://www.google.com/maps/search/'+q,'_blank');
}

function buildMapSection(loc, label){
  label = label || 'موقع العقار';
  const c=LOC_COORDS[loc]||{lat:35.3614,lng:35.9264};
  return `<div class="det-map-section af s2">
    <h3 class="det-map-title">${ICON.pin} ${label}</h3>
    <p class="det-map-sub">${loc}، جبلة</p>
    <div class="det-map-wrap" onclick="openMap('${loc}')">
      <iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${c.lng-.008}%2C${c.lat-.005}%2C${c.lng+.008}%2C${c.lat+.005}&layer=mapnik" frameborder="0" scrolling="no" loading="lazy" style="width:100%;height:100%;border:0;border-radius:16px;pointer-events:none"></iframe>
      <div class="det-map-overlay">
        <div class="det-map-pin">
          <svg viewBox="0 0 24 24" fill="var(--primary)" stroke="#fff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3" fill="#fff"/></svg>
        </div>
      </div>
      <button class="det-map-expand">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
      </button>
    </div>
    <p class="det-map-hint">اضغط على الخريطة لفتحها في خرائط غوغل</p>
  </div>`;
}

function openWA(id){
  const l=listings.find(x=>x.id===id)||window._currentListing;if(!l)return;
  const cat=getCat(l.catId);const apt=isApt(l.catId);const rent=isRent(l.catId);const eq=isEquip(l.catId);
  const freead=isFreeAd(l.catId);
  let msg='السلام عليكم 👋\n';
  msg+='أنا مهتم بالإعلان التالي:\n';
  if(l.ref) msg+='🔖 رمز الإعلان: '+l.ref+'\n';msg+='\n';
  msg+='📌 *'+l.title+'*\n';
  msg+='🏷️ '+cat.label+'\n';
  msg+='💰 '+fmtPrice(l.price)+(rent?' / يوم':'')+'\n';
  msg+='📍 '+l.location+'، جبلة\n';
  if(apt){msg+='🛏️ '+l.rooms+' غرف | 🚿 '+l.baths+' حمام | 📐 '+l.area+' م²\n';}
  else if(!eq&&!freead){msg+='🚗 '+l.carType+' '+l.carModel+' | 📅 '+l.carYear+'\n';}
  if(_calStart&&_calEnd){
    const d=Math.round((_calEnd-_calStart)/864e5)+1;
    msg+='\n📆 *تفاصيل الحجز:*\n';
    msg+='▫️ من: '+fmtDate(_calStart)+'\n';
    msg+='▫️ إلى: '+fmtDate(_calEnd)+'\n';
    msg+='▫️ المدة: '+d+' يوم\n';
    msg+='▫️ الإجمالي: '+fmtPrice(l.price*d)+'\n';
  }
  msg+='\nأرجو التواصل معي لمزيد من التفاصيل 🙏\nشكراً لكم ✨';
  const targetPhone = freead ? (l.phone||'963983127483').replace(/[^0-9]/g,'') : '963983127483';
  const waUrl = 'https://wa.me/' + targetPhone + '?text=' + encodeURIComponent(msg);
  const win = window.open(waUrl, '_blank');
  if(!win) window.location.href = waUrl;
}

function shareListing(id){
  const l=listings.find(x=>String(x.id)===String(id))||window._currentListing;if(!l)return;
  const cat=getCat(l.catId);const apt=isApt(l.catId);const rent=isRent(l.catId);const eq=isEquip(l.catId);
  const shareUrl=window.location.origin+window.location.pathname+'?id='+l.id;
  let text='✨ *'+esc(l.title)+'* ✨\n\n';
  text+='🏷️ '+cat.label+'\n';
  text+='💰 '+fmtPrice(l.price)+(rent?' / يوم':'')+'\n';
  text+='📍 '+l.location+'، جبلة\n\n';
  if(apt){text+='🛏️ '+l.rooms+' غرف نوم\n🚿 '+l.baths+' حمام\n📐 '+l.area+' م²\n\n';}
  else if(!eq){
    text+='🚗 '+(l.carType||'')+'\n';
    if(l.carYear)text+='📅 سنة الصنع: '+l.carYear+'\n';
    if(l.carColor)text+='🎨 اللون: '+l.carColor+'\n';
    text+='\n';
  }
  if(l.desc)text+='📝 '+l.desc+'\n\n';
  text+='🔗 '+shareUrl;
  if(navigator.share){
    navigator.share({title:l.title,text:text,url:shareUrl}).catch(function(e){
      if(e&&e.name!=='AbortError'){
        window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
      }
    });
  } else {
    window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank');
  }
}

// زر الرجوع الذكي
function goBack(e){
  if(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  const bar = document.getElementById('abBottomBar');
  if(bar) bar.remove();
  const ov = document.getElementById('bookConfirmOverlay');
  if(ov) ov.remove();
  window._currentListing = null;
  _skipPush = true;
  if (history.state && history.state.page === 'detail') {
    history.back();
  } else {
    nav('home');
  }
}

// ===== BLOCKED DATES FROM ADMIN =====
let _adminBlockedDates = {};
async function loadBlockedDates() {
  try {
    const { data } = await supabaseClient.from('settings').select('data').eq('key', 'blocked_dates').maybeSingle();
    if (data && data.data) _adminBlockedDates = data.data;
  } catch(e) { console.error('Error loading blocked dates:', e); }
}
if (USE_FIREBASE) { loadBlockedDates(); }

function initCalendar(price){
  _calPrice=price;const n=new Date();calY=n.getFullYear();calM=n.getMonth();_calStart=null;_calEnd=null;
  if (USE_FIREBASE) {
    loadBlockedDates().then(renderCal).catch(renderCal);
  } else { renderCal(); }
}
function calPrev(){calM--;if(calM<0){calM=11;calY--;}renderCal();}
function calNext(){calM++;if(calM>11){calM=0;calY++;}renderCal();}
function clearCal(){_calStart=null;_calEnd=null;renderCal();}
function renderCal(){
  document.getElementById('calMonth').textContent=MONTHS[calM]+' '+calY;
  const fd=new Date(calY,calM,1).getDay(),dm=new Date(calY,calM+1,0).getDate(),td=new Date();td.setHours(0,0,0,0);
  // Get booked dates for current listing
  const _bookedDates=JSON.parse(localStorage.getItem('tam_booked')||'{}');
  const lid=window._currentListing?window._currentListing.id:null;
  const booked=lid?(_bookedDates[lid]||[]):[];
  const adminBlocked=lid?(_adminBlockedDates[lid]||[]):[];
  const allBlocked=[...booked,...adminBlocked];
  let h=DAYS.map(d=>`<div class="cal-dn">${d}</div>`).join('');
  for(let i=0;i<fd;i++)h+=`<div class="cal-d emp"><span class="cd-in"></span></div>`;
  
  let activeDaysCount = 0;
  if(_calStart && _calEnd) {
    let temp = new Date(_calStart);
    while(temp <= _calEnd) {
      const key = temp.getFullYear()+'-'+(temp.getMonth()+1).toString().padStart(2,'0')+'-'+temp.getDate().toString().padStart(2,'0');
      if(!allBlocked.includes(key)) activeDaysCount++;
      temp.setDate(temp.getDate()+1);
    }
  } else if(_calStart) {
    activeDaysCount = 1;
  }

  for(let d=1;d<=dm;d++){
    const dt=new Date(calY,calM,d),past=dt<td;
    const key=calY+'-'+(calM+1).toString().padStart(2,'0')+'-'+d.toString().padStart(2,'0');
    const isBooked=allBlocked.includes(key);
    let cl='cal-d';
    if(past) cl+=' dis';
    else if(isBooked) cl+=' booked';
    
    if(_calStart&&_calEnd){
      const t=dt.getTime(),s=_calStart.getTime(),e=_calEnd.getTime();
      if(t===s&&t===e)cl+=' sel rs re';else if(t===s)cl+=' rs';else if(t===e)cl+=' re';else if(t>s&&t<e)cl+=' inr';
    }else if(_calStart&&dt.getTime()===_calStart.getTime())cl+=' sel';
    
    h+=`<div class="${cl}" ${past?'':`onclick="pickDay(${calY},${calM},${d})"`}><span class="cd-in">${d}</span></div>`;
  }
  document.getElementById('calGrid').innerHTML=h;
  const sm=document.getElementById('calSummary');
  if(_calStart&&_calEnd){
    sm.style.display='block';
    document.getElementById('calFrom').textContent=fmtDate(_calStart);
    document.getElementById('calTo').textContent=fmtDate(_calEnd);
    document.getElementById('calDays').textContent=activeDaysCount;
    document.getElementById('calTotal').textContent=fmtPrice(_calPrice*activeDaysCount);
  }else{sm.style.display='none';}
  // Update bottom bar dates and price
  const barDates=document.getElementById('abBarDates');
  const barPrice=document.getElementById('abBarPrice');
  const sidePrice=document.getElementById('abSidePrice');
  const sideDates=document.getElementById('abSideDates');
  if(_calStart&&_calEnd){
    if(barDates){barDates.textContent=fmtDate(_calStart)+' – '+fmtDate(_calEnd)+' ('+activeDaysCount+' يوم)';barDates.style.color='#525252';}
    if(barPrice)barPrice.innerHTML=fmtPrice(_calPrice*activeDaysCount)+' <small style="font-size:12px;font-weight:500;color:#737373">/ '+activeDaysCount+' يوم</small>';
    if(sidePrice)sidePrice.innerHTML=fmtPrice(_calPrice*activeDaysCount)+' <small>/ '+activeDaysCount+' يوم</small>';
    if(sideDates)sideDates.textContent=fmtDate(_calStart)+' – '+fmtDate(_calEnd);
  }else{
    if(barDates){barDates.textContent='حدد التواريخ';barDates.style.color='#F6921E';}
    if(barPrice)barPrice.innerHTML=fmtPrice(_calPrice)+' <small style="font-size:12px;font-weight:500;color:#737373">/ يوم</small>';
    if(sidePrice)sidePrice.innerHTML=fmtPrice(_calPrice)+' <small>/ يوم</small>';
    if(sideDates)sideDates.textContent='حدد التواريخ من الروزنامة';
  }
}
function pickDay(y,m,d){
  const dt=new Date(y,m,d);
  if(!_calStart||(_calStart&&_calEnd)){
    _calStart=dt;_calEnd=null;
  }else{
    if(dt < _calStart){ _calEnd = _calStart; _calStart = dt; }
    else _calEnd = dt;
  }
  renderCal();
}
function fmtDate(d){return d.getDate()+' '+MONTHS[d.getMonth()]+' '+d.getFullYear();}

/* ===== SEARCH SUGGESTIONS ===== */
function showSuggestions(q){
  const box=document.getElementById('searchSuggestions');
  if(!box)return;
  q=q.trim();
  if(!q){box.classList.remove('open');box.innerHTML='';return;}
  
  const matched=listings.filter(l=>{
    return l.title.includes(q)||l.desc.includes(q)||l.location.includes(q)||(l.carType||'').includes(q)||(l.carModel||'').includes(q);
  }).slice(0,6);
  
  // Also match locations
  const locMatched=LOCS.filter(loc=>loc.includes(q)).slice(0,3);
  
  if(!matched.length&&!locMatched.length){box.classList.remove('open');box.innerHTML='';return;}
  
  let html='';
  locMatched.forEach(loc=>{
    html+=`<div class="sug-item" onclick="document.getElementById('heroSearch').value='${loc}';closeSuggestions();doSearch()">
      <div class="sug-icon loc"><svg viewBox="0 0 24 24" fill="currentColor" style="width:20px;height:20px"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg></div>
      <div class="sug-text"><h4>${loc}</h4><p>موقع</p></div>
    </div>`;
  });
  matched.forEach(l=>{
    const sugThumb=l.images&&l.images.length?l.images[0]:'';
    html+=`<div class="sug-item" onclick="closeSuggestions();viewDetail('${l.id}')">
      <div class="sug-thumb"><img src="${sugThumb}" alt="${esc(l.title)}" loading="lazy"></div>
      <div class="sug-text"><h4>${esc(l.title)}</h4><p>${esc(l.location)} · ${fmtPrice(l.price)}</p></div>
    </div>`;
  });
  box.innerHTML=html;
  box.classList.add('open');
}
function closeSuggestions(){
  const box=document.getElementById('searchSuggestions');
  if(box){box.classList.remove('open');box.innerHTML='';}
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.search-wrap'))closeSuggestions();
});

/* ===== SEARCH ===== */
function doSearch(){sQ=document.getElementById('heroSearch').value.trim();sC=null;sType=null;nav('listings');}

/* ===== SIDE MENU ===== */
function openMenu(){
  document.getElementById('menuOverlay').classList.add('open');
  document.getElementById('sideMenu').classList.add('open');
}
function closeMenu(){
  document.getElementById('menuOverlay').classList.remove('open');
  document.getElementById('sideMenu').classList.remove('open');
}

/* ===== LAPTOP NAVIGATION ===== */
function showLaptopNav(){
  if(window.innerWidth >= 1024){
    document.querySelectorAll('.laptop-nav-item').forEach(item => item.style.display = 'flex');
  }
}
function hideLaptopNav(){
  if(window.innerWidth < 1024){
    document.querySelectorAll('.laptop-nav-item').forEach(item => item.style.display = 'none');
  }
}
window.addEventListener('resize',()=>{
  if(window.innerWidth>=1024)showLaptopNav();
  else hideLaptopNav();
});


// Free Ad Modal Functions
function openFreeAdModal() {
  document.getElementById('freeAdModalOverlay').classList.add('show');
  backToTerms();
}
function closeFreeAdModal() {
  document.getElementById('freeAdModalOverlay').classList.remove('show');
}
function showFreeAdForm() {
  document.getElementById('freeAdModalTitle').textContent = 'طلب إعلان مجاني';
  document.getElementById('freeAdTerms').style.display = 'none';
  document.getElementById('freeAdTermsBtns').style.display = 'none';
  document.getElementById('freeAdForm').classList.add('show');
  document.getElementById('freeAdFormBtns').style.display = 'flex';
}
function backToTerms() {
  document.getElementById('freeAdModalTitle').textContent = 'شروط الإعلانات المجانية';
  document.getElementById('freeAdTerms').style.display = 'block';
  document.getElementById('freeAdTermsBtns').style.display = 'flex';
  document.getElementById('freeAdForm').classList.remove('show');
  document.getElementById('freeAdFormBtns').style.display = 'none';
}
function toggleOtherProfession() {
  const prof = document.getElementById('faProfession').value;
  document.getElementById('otherProfessionField').style.display = (prof === 'أخرى') ? 'block' : 'none';
}
function sendFreeAdWhatsApp() {
  const name = document.getElementById('faName').value;
  const phone = document.getElementById('faPhone').value;
  const address = document.getElementById('faAddress').value;
  let prof = document.getElementById('faProfession').value;
  if (prof === 'أخرى') prof = document.getElementById('faOtherProfession').value;

  if (!name || !phone || !address || !prof) {
    alert('يرجى ملء جميع الخانات');
    return;
  }

  const text = `مرحباً، أود إضافة إعلان مجاني:
الاسم: ${name}
رقم الهاتف: ${phone}
العنوان: ${address}
المهنة: ${prof}`;
  
  window.open('https://wa.me/963983127483?text=' + encodeURIComponent(text), '_blank');
  closeFreeAdModal();
}

// Init
const _savedState = JSON.parse(sessionStorage.getItem('tam_state') || 'null');
const _isRefresh = !!_savedState;

// Show blur on every load
// No loading effect

history.replaceState(_savedState || {page:'home',sC:null,sType:null,sFeatured:false,sQ:'',detailId:null,currentPage:1,scrollPos:0},'',null);

function restoreState() {
  // ابدأ الـ stack بصفحة الرئيسية كـ base
  if(_navStack.length===0) _navStack.push({page:'home',sC:null,sType:null,sFeatured:false,sQ:'',currentPage:1,scrollPos:0});

  var _urlParams = new URLSearchParams(window.location.search);
  var _sharedId = _urlParams.get('id');
  if (_sharedId) {
    history.replaceState({page:'detail',detailId:_sharedId,sC:null,sType:null,sFeatured:false,sQ:'',currentPage:1},'',window.location.pathname);
    window._pendingShareId = _sharedId;
    return;
  }
  if (_savedState) {
    sC = _savedState.sC;
    sType = _savedState.sType;
    sFeatured = _savedState.sFeatured;
    sQ = _savedState.sQ || '';
    if (_savedState.currentPage) _currentPage = _savedState.currentPage;

    if (_savedState.page === 'detail') {
      // Don't restore detail on refresh - go to listings instead
      _skipPush = true;
      if (_savedState.sType || _savedState.sC) {
        nav('listings', null, true);
      } else {
        renderHome();
      }
    } else if (_savedState.page === 'listings') {
      _skipPush = true;
      nav('listings', null, true);
    } else if (_savedState.page === 'about') {
      _skipPush = true;
      nav('about');
    } else if (_savedState.page === 'contact') {
      _skipPush = true;
      nav('contact');
    } else {
      renderHome();
    }
  } else {
    renderHome();
  }
  // Reset state to current page (not detail)
  const cleanState = {page: _savedState?.page === 'detail' ? (_savedState.sType ? 'listings' : 'home') : (_savedState?.page || 'home'), sC, sType, sFeatured, sQ, detailId: null, currentPage: _currentPage};
  history.replaceState(cleanState, '', null);
  sessionStorage.setItem('tam_state', JSON.stringify(cleanState));
}

if (USE_FIREBASE) {
  // قراءة واحدة عند فتح الصفحة من Supabase
  supabaseClient.from('ads').select('*').eq('status', 'active')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (error) { console.error('Supabase load error:', error); restoreState(); hideSplash(); return; }
      listings = (data || []).map(mapRow);
      restoreState();
      if (window._pendingShareId) {
        var _ad = listings.find(function(x){ return String(x.id)===String(window._pendingShareId); });
        if (_ad) viewDetail(window._pendingShareId); else renderHome();
        window._pendingShareId = null;
      }
      hideSplash();
    });
} else {
  restoreState();
  hideSplash();
}
function hideSplash(){
  var hf=document.getElementById('hideFlash');if(hf)hf.remove();
  var isReload=false;try{isReload=performance.getEntriesByType('navigation')[0].type==='reload';}catch(e){}
  var rs=document.getElementById('refreshSplash');
  if(rs){rs.firstChild.style.opacity='0';setTimeout(()=>rs.remove(),isReload?400:600);}
  setTimeout(showInstallBanner,2000);
}
// Fallback: if splash still showing after 5 seconds, force hide and show page
setTimeout(function(){
  hideSplash();
  if(!listings.length){restoreState();}
},5000);

// ===== LIGHTBOX =====
let _lbImgs=[], _lbIdx=0;
function openLightbox(idx){
  const l=window._currentListing;if(!l||!l.images||!l.images.length)return;
  _lbImgs=l.images;_lbIdx=idx||0;
  const lb=document.getElementById('lightbox');
  lb.querySelector('.lb-img').src=_lbImgs[_lbIdx];
  lb.querySelector('.lb-counter').textContent=(_lbIdx+1)+' / '+_lbImgs.length;
  lb.style.display='flex';
  document.body.style.overflow='hidden';
  if(_lbImgs.length<=1){
    lb.querySelector('.lb-prev').style.display='none';
    lb.querySelector('.lb-next').style.display='none';
  }else{
    lb.querySelector('.lb-prev').style.display='flex';
    lb.querySelector('.lb-next').style.display='flex';
  }
}
function closeLightbox(){
  document.getElementById('lightbox').style.display='none';
  document.body.style.overflow='';
}
function lbNav(dir){
  _lbIdx=((_lbIdx+dir)%_lbImgs.length+_lbImgs.length)%_lbImgs.length;
  const lb=document.getElementById('lightbox');
  lb.querySelector('.lb-img').src=_lbImgs[_lbIdx];
  lb.querySelector('.lb-counter').textContent=(_lbIdx+1)+' / '+_lbImgs.length;
}
// Swipe support for lightbox
(function(){
  var lb,sx=0;
  document.addEventListener('DOMContentLoaded',function(){
    lb=document.getElementById('lightbox');if(!lb)return;
    lb.addEventListener('touchstart',function(e){sx=e.touches[0].clientX;},{passive:true});
    lb.addEventListener('touchend',function(e){
      var diff=sx-e.changedTouches[0].clientX;
      if(Math.abs(diff)>50){diff>0?lbNav(1):lbNav(-1);}
    },{passive:true});
  });
})();
// Keyboard support
document.addEventListener('keydown',function(e){
  var lb=document.getElementById('lightbox');
  if(!lb||lb.style.display==='none')return;
  if(e.key==='Escape')closeLightbox();
  if(e.key==='ArrowLeft')lbNav(1);
  if(e.key==='ArrowRight')lbNav(-1);
});

// ===== SERVICE WORKER =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // استخدام مسار نسبي لضمان العمل على GitHub Pages مع اسم المستودع
    // إضافة معامل v=2 لإجبار المتصفح على تحديث الـ Service Worker وتجاوز الكاش
    const swPath = '/sw.js?v=11';
    navigator.serviceWorker.register(swPath).then(() => {
      // استدعاء نافذة التثبيت بعد تسجيل الـ Service Worker بـ 3 ثوانٍ لضمان ظهورها
      setTimeout(showInstallBanner, 3000);
    }).catch(err => console.error('SW registration failed:', err));
  });
}

// ===== INSTALL BANNER =====
let _deferredPrompt = null;
let _appInstalled = localStorage.getItem('tam_installed') === '1';
let _bannerDismissed = sessionStorage.getItem('tam_banner_dismissed') === '1';

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredPrompt = e;
});

window.addEventListener('appinstalled', () => {
  _appInstalled = true;
  localStorage.setItem('tam_installed', '1');
  const b = document.getElementById('installBanner');
  if (b) b.style.display = 'none';
});

function showInstallBanner() {
  if (_appInstalled || _bannerDismissed) return;
  // Check if running as installed app
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  if (window.navigator.standalone) return;
  const b = document.getElementById('installBanner');
  if (b) b.style.display = 'block';
}

function installApp() {
  if (_deferredPrompt) {
    _deferredPrompt.prompt();
    _deferredPrompt.userChoice.then(r => {
      if (r.outcome === 'accepted') {
        _appInstalled = true;
        localStorage.setItem('tam_installed', '1');
      }
      _deferredPrompt = null;
      document.getElementById('installBanner').style.display = 'none';
    });
  } else {
    // iOS or browsers without beforeinstallprompt
    const b = document.getElementById('installBanner');
    b.querySelector('#installBtn').style.display = 'none';
    b.querySelector('div > div:last-child').innerHTML = '<div style="font-size:12px;color:#737373;line-height:1.6">اضغط على <strong>مشاركة</strong> ثم <strong>إضافة للشاشة الرئيسية</strong></div>';
  }
}

function dismissInstall() {
  _bannerDismissed = true;
  sessionStorage.setItem('tam_banner_dismissed', '1');
  document.getElementById('installBanner').style.display = 'none';
}
