import { setPrice } from './estimate.mjs';
const patterns = {aws:/\bs3\b/i,azure:/blob|data lake|azure storage/i,gcp:/cloud storage|storage bucket/i,ibm:/object storage|\bcos\b/i};
export const storageNodes = p => p.nodes.filter(n=>patterns[n.data.provider]?.test(`${n.data.label} ${n.data.service || ''}`));
const sources = {'AWS public Price List':'https://pricing.us-east-1.amazonaws.com/','Azure Retail Prices API':'https://prices.azure.com/','Google Cloud Billing Catalog':'https://cloud.google.com/'};
export function applyPriceQuotes(project, quotes) {
 let p=project;
 for(const quote of quotes||[]){
  if(!sources[quote.source] || !quote.url?.startsWith(sources[quote.source]) || !['GB-month','GiB-month'].includes(quote.unit))continue;
  for(const n of storageNodes(p)){
   const existing=p.estimate?.prices?.[n.id];
   if(n.data.provider!==quote.provider || n.data.config?.region!==quote.region || existing?.source && !sources[existing.source])continue;
   // Shared usage is decimal GB; preserve the conversion in the quote note.
   const factor=quote.unit==='GiB-month'?1e9/(1024**3):1;
   p=setPrice(p,n.id,{price:quote.price*factor,currency:quote.currency,source:quote.source,url:quote.url,date:quote.date,region:quote.region,service:quote.service,tierLimit:quote.tierLimit,note:quote.coverage+(factor!==1?`; provider GiB converted from decimal GB using ${factor}`:'')});
  }
 }
 return p;
}
export async function fetchStoragePrices(session,project){
 const quotes=[],errors=[];
 const selections=[...new Map(storageNodes(project).filter(n=>n.data.config?.region && !/select|unknown/i.test(n.data.config.region)).map(n=>[`${n.data.provider}:${n.data.config.region}`,{provider:n.data.provider,region:n.data.config.region}])).values()];
 for(const selection of selections){
  try{
   const response=await fetch('/api/pricing/storage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.token}`},body:JSON.stringify({projectId:project.id,...selection}),signal:AbortSignal.timeout(20000)});
   const value=await response.json();
   if(!response.ok || value.available===false){errors.push({provider:selection.provider,reason:value.reason||value.detail,sourceUrl:value.sourceUrl});continue;}
   quotes.push(value);
  }catch(e){errors.push({provider:selection.provider,reason:e.message});}
 }
 return {quotes,errors};
}
