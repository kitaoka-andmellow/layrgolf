/* Natural-language date interpretation for Japan; no availability claim is inferred. */
const WEEKDAYS=["日","月","火","水","木","金","土"];
const TOKYO="Asia/Tokyo";
function parts(date){
  const p=new Intl.DateTimeFormat("en-US",{timeZone:TOKYO,year:"numeric",month:"numeric",day:"numeric"}).formatToParts(date);
  const obj=Object.fromEntries(p.filter(x=>["year","month","day"].includes(x.type)).map(x=>[x.type,Number(x.value)]));
  return obj;
}
function utc(y,m,d){
  const value=new Date(Date.UTC(y,m-1,d));
  return value.getUTCFullYear()===y&&value.getUTCMonth()===m-1&&value.getUTCDate()===d?value:null;
}
function dateObject(value,today,mode="explicit"){
  if(!value)return null;
  const iso=`${value.getUTCFullYear()}-${String(value.getUTCMonth()+1).padStart(2,"0")}-${String(value.getUTCDate()).padStart(2,"0")}`;
  const weekday=value.getUTCDay();
  const label=`${value.getUTCMonth()+1}月${value.getUTCDate()}日（${WEEKDAYS[weekday]}）`;
  const past=value.getTime()<today.getTime();
  return {iso,label,weekday,weekend:weekday===0||weekday===6,past,mode};
}
const addDays=(value,n)=>new Date(value.getTime()+n*86400000);
export function parseJapaneseDate(raw,reference=new Date()){
  const s=String(raw||"").normalize("NFKC");
  if(!s.trim())return null;
  const p=parts(reference),today=utc(p.year,p.month,p.day);
  if(!today)return null;
  let m=s.match(/(?:^|[^\d])((?:20)?\d{2})[\/\-年](\d{1,2})[\/\-月](\d{1,2})日?(?!\d)/);
  if(m){
    const year=Number(m[1])<100?2000+Number(m[1]):Number(m[1]);
    return dateObject(utc(year,Number(m[2]),Number(m[3])),today);
  }
  m=s.match(/(?:^|[^\d])(\d{1,2})[\/\-月](\d{1,2})日?(?!\d)/);
  if(m){
    const month=Number(m[1]),day=Number(m[2]);
    let year=p.year,value=utc(year,month,day);
    if(value&&value<today)value=utc(++year,month,day);
    return dateObject(value,today);
  }
  if(/明後日|あさって/.test(s))return dateObject(addDays(today,2),today,"relative");
  if(/明日|あす/.test(s))return dateObject(addDays(today,1),today,"relative");
  if(/今日|本日/.test(s))return dateObject(today,today,"relative");
  const weekend=s.match(/(再来週末|来週末|今週末|週末)/);
  if(weekend){
    const weeks=weekend[1]==="再来週末"?2:weekend[1]==="来週末"?1:0;
    const startOfWeek=addDays(today,-((today.getUTCDay()+6)%7));
    let saturday=addDays(startOfWeek,5+weeks*7);
    if(weekend[1]==="週末"&&saturday<today)saturday=addDays(saturday,7);
    if(weekend[1]==="今週末"&&saturday<today)saturday=addDays(saturday,7);
    return dateObject(saturday,today,"relative");
  }
  const rel=s.match(/(再来週|来週|今週|今度の)?\s*(?:の)?\s*(?:([月火水木金土日])曜日?|週末)/);
  if(rel){
    const pref=rel[1]||"";
    const selected=rel[2]||"土";
    const day="日月火水木金土".indexOf(selected);
    // Reference weeks start on Monday (JST).
    const startOfWeek=addDays(today,-((today.getUTCDay()+6)%7));
    let week=pref==="再来週"?2:pref==="来週"?1:0;
    let result=addDays(startOfWeek,week*7+(day+6)%7);
    if(!pref&&result<today)result=addDays(result,7);
    if(pref==="今週"&&result<today)result=addDays(result,7);
    return dateObject(result,today,"relative");
  }
  return null;
}
