// CSS metrics: distinct values / uses of design-system properties in a stylesheet.
const fs=require('fs');const css=fs.readFileSync(process.argv[2],'utf8').replace(/\/\*[\s\S]*?\*\//g,'');
const decls=[...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+);/g)].map(m=>[m[1],m[2].trim()]);
const of=(p)=>decls.filter(([k])=>p.test(k)).map(([,v])=>v);
const stat=(name,vals)=>{const m=new Map();for(const v of vals)m.set(v,(m.get(v)||0)+1);const top=[...m].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([v,n])=>`${v} x${n}`).join(', ');console.log(`${name}: ${m.size} distinct / ${vals.length} uses | ${top}`);};
stat('font-size',of(/^font-size$/));
stat('font-weight',of(/^font-weight$/));
stat('border-radius',of(/^border(-[a-z]+)*-radius$/));
stat('box-shadow',of(/^box-shadow$/));
const sp=of(/^(padding|margin|gap|row-gap|column-gap)(-[a-z]+)*$/).flatMap(v=>[...v.matchAll(/(?<![\w.-])(\d*\.?\d+)px/g)].map(m=>m[1]+'px'));
stat('spacing px (padding/margin/gap)',sp);
stat('transition/animation ms',[...css.matchAll(/(?<![\w.-])(\d+)ms/g)].map(m=>m[1]+'ms'));
const hex=[...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(m=>m[0].toLowerCase());stat('hex colours',hex);
const rgba=[...css.matchAll(/rgba?\([^)]*\)/g)].map(m=>m[0].replace(/\s+/g,''));stat('rgb/rgba literals',rgba);
stat('rgba(90,70,50,…)',rgba.filter(v=>/^rgba\(90,70,50/.test(v)));
stat('rgba(74,59,44,…)',rgba.filter(v=>/^rgba\(74,59,44/.test(v)));
console.log('#2a9d8f uses:',hex.filter(h=>h==='#2a9d8f').length,' #1f776c uses:',hex.filter(h=>h==='#1f776c').length);
console.log('var(--…) refs:',(css.match(/var\(--/g)||[]).length,' color-mix:',(css.match(/color-mix\(/g)||[]).length);
