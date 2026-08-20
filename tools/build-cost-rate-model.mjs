// 工具：从游戏配置生成「建筑升级成本 / 产出速率」可视化模型
// 运行：node tools/build-cost-rate-model.mjs
// 产出：数值可视化.html（自包含、可直接双击打开）
import { writeFileSync } from 'node:fs'
import { BUILDINGS, UPGRADE_COST_CONFIG, BASIC_RESOURCES, REFINED_RESOURCES } from '../src/game/config.js'

const RES = { ...BASIC_RESOURCES, ...REFINED_RESOURCES }
const resName = (k) => (RES[k]?.name || k)
const resIcon = (k) => (RES[k]?.icon || '')

// —— 复刻 store.js 的升级成本公式 ——
function getUpgradeCost(building, level) {
  const effMult = level >= UPGRADE_COST_CONFIG.levelThreshold
    ? building.costMultiplier + UPGRADE_COST_CONFIG.multiplierIncrease
    : building.costMultiplier
  const primaryAmount = Math.floor(building.baseCost * Math.pow(effMult, level - 1))
  const primary = { resource: building.costResource, amount: primaryAmount }
  let secondary = null
  if (level >= UPGRADE_COST_CONFIG.levelThreshold) {
    let secResource = null
    if (building.type === 'production') secResource = UPGRADE_COST_CONFIG.productionSecondary
    else if (building.type === 'processing') secResource = UPGRADE_COST_CONFIG.processingSecondary
    if (secResource) {
      const secAmount = Math.floor(building.baseCost * UPGRADE_COST_CONFIG.secondaryRatio
        * Math.pow(effMult, level - UPGRADE_COST_CONFIG.levelThreshold))
      secondary = { resource: secResource, amount: secAmount }
    }
  }
  return { primary, secondary }
}

// —— 复刻 store.js 的产出速率公式（生产力倍率 = 1，人口可调） ——
function getProductionRate(building, level, assigned, recipe) {
  const levelMultiplier = 1 + (level - 1) * (building.ratePerLevel || 0)
  const multiplier = assigned * levelMultiplier
  return recipe.outputs.map(o => ({ resource: o.resource, ratePerSec: o.rate * multiplier }))
}
function getRecipes(building) {
  if (building.recipes) return building.recipes
  return [{ id: 'default', name: building.name, outputs: [{ resource: building.produces, rate: building.baseRate }] }]
}

const typeInfo = { production: '生产', processing: '加工', key: '关键' }

const buildings = BUILDINGS.map(b => {
  const maxLevel = b.maxLevel || 10
  const levels = []
  for (let lv = 1; lv <= maxLevel; lv++) {
    const cost = b.baseCost != null ? getUpgradeCost(b, lv) : null
    levels.push({ level: lv, cost })
  }
  // 产出：每个配方 → 每条产出 → 各级速率（按 1 人口）
  let recipes = getRecipes(b).map(r => ({
    id: r.id, name: r.name, unlockAt: r.unlockAt || 0,
    outputs: r.outputs.map(o => ({
      resource: o.resource,
      ratePerLevel: Array.from({ length: maxLevel }, (_, i) =>
        +(o.rate * 1 * (1 + i * (b.ratePerLevel || 0))).toFixed(3)),
    })),
  }))
  // 加工建筑：批/秒（按 1 人口）
  let process = null
  if (b.type === 'processing' && b.processTime) {
    process = Array.from({ length: maxLevel }, (_, i) =>
      +((1 + i * (b.ratePerLevel || 0)) / b.processTime).toFixed(4))
  }
  return {
    id: b.id, name: b.name, icon: b.icon, type: b.type, typeLabel: typeInfo[b.type] || b.type,
    maxLevel,
    populationSlots: b.populationSlots ? `${b.populationSlots.base}+每级${b.populationSlots.perLevel}` : null,
    cost: b.baseCost != null ? {
      baseCost: b.baseCost, costMultiplier: b.costMultiplier,
      costResource: resName(b.costResource), costResourceIcon: resIcon(b.costResource),
    } : null,
    levels,
    recipes, process,
  }
})

const data = { generated: new Date().toISOString(), buildings,
  res: Object.fromEntries(Object.entries(RES).map(([k, v]) => [k, v.name])) }

// —— HTML 模板 ——
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>《家园》建筑数值可视化模型</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<style>
:root{--bg:#2a1e13;--bg2:#171009;--panel:#2e2316;--accent:#d6a452;--accent-hi:#f2ce84;--text:#ece2cb;--dim:#b5a584;--border:#4a3a24}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(160deg,var(--bg),var(--bg2));color:var(--text);font-family:-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;min-height:100vh}
.wrap{max-width:960px;margin:0 auto;padding:20px}
h1{font-family:Georgia,"Songti SC",serif;color:var(--accent-hi);font-size:1.5em;letter-spacing:1px}
h1 small{font-weight:normal;font-size:0.6em;color:var(--dim);display:block;margin-top:2px;letter-spacing:0}
.controls{display:flex;flex-wrap:wrap;gap:14px;align-items:center;background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin:16px 0}
.controls label{font-size:0.85em;color:var(--dim)}
.controls select,.controls input{background:#22180d;color:var(--text);border:1px solid var(--border);border-radius:6px;padding:6px 8px;font-size:0.95em}
.charts{display:grid;grid-template-columns:1fr;gap:18px}
.card{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:16px 16px 8px;box-shadow:inset 0 1px 0 rgba(255,232,190,0.08),0 4px 12px rgba(0,0,0,.35)}
.card h2{margin:0 0 4px;color:var(--accent);font-size:1em;font-family:Georgia,serif}
.card .sub{color:var(--dim);font-size:0.78em;margin-bottom:10px}
.costRes{font-size:0.8em;color:var(--accent-hi)}
table{width:100%;border-collapse:collapse;font-size:0.8em;margin-top:6px}
th,td{padding:4px 6px;border-bottom:1px solid var(--border);text-align:right}
th{color:var(--dim);font-weight:600}
td:first-child,th:first-child{text-align:left}
.foot{color:var(--dim);font-size:0.7em;margin-top:18px;text-align:center}
</style>
</head>
<body>
<div class="wrap">
  <h1>《家园》建筑数值可视化模型<small>升级成本曲线 &amp; 产出速率曲线（数据实时读取自 config.js）</small></h1>

  <div class="controls">
    <label>建筑
      <select id="bld"></select>
    </label>
    <label>人口
      <input id="pop" type="number" min="1" max="999" value="1" style="width:64px" />
    </label>
    <label>幸福度倍率
      <select id="hap">
        <option value="1">正常 ×1.00（中立）</option>
        <option value="0.85">不开心 ×0.85</option>
        <option value="1.1">开心 ×1.10</option>
      </select>
    </label>
    <label style="margin-left:auto">
      配方：<select id="recipe" style="display:none"></select>
    </label>
  </div>

  <div class="legend" id="legend" style="color:var(--dim);font-size:.8em;margin-bottom:6px"></div>

  <div class="charts">
    <div class="card">
      <h2 id="costTitle">升级成本曲线</h2>
      <div class="sub" id="costSub"></div>
      <canvas id="costChart" height="120"></canvas>
    </div>
    <div class="card">
      <h2 id="rateTitle">产出速率曲线（按 1 人口）</h2>
      <div class="sub" id="rateSub"></div>
      <canvas id="rateChart" height="120"></canvas>
    </div>
    <div class="card">
      <h2>逐级明细表</h2>
      <div id="tableWrap"></div>
    </div>
  </div>
  <div class="foot">生成时间：${new Date().toLocaleString()} · 数值公式与游戏源代码一致</div>
</div>

<script>
const DATA = ${JSON.stringify(data)};

const $ = id => document.getElementById(id);
const bldSel = $('bld'), popInput = $('pop'), hapSel = $('hap'), recipeSel = $('recipe');
let costChart=null, rateChart=null, current=null;

// 填充建筑下拉（按类型分组）
(function initSelect(){
  const types = ['production','processing','key'];
  for(const t of types){
    const list = DATA.buildings.filter(b=>b.type===t);
    if(!list.length) continue;
    const og = document.createElement('optgroup');
    og.label = typeLabel(t);
    list.forEach(b=>{ const o=document.createElement('option'); o.value=b.id; o.textContent=(b.icon+' '+b.name+'  (Lv1~'+b.maxLevel+')'); og.appendChild(o); });
    bldSel.appendChild(og);
  }
  bldSel.value = DATA.buildings[0].id;
})();
function typeLabel(t){ return {production:'🏭 生产建筑',processing:'🔧 加工建筑',key:'🔑 关键建筑'}[t]||t; }

function fmt(n){ return n>=1e6?(n/1e6).toFixed(1)+'M':n>=1e4?(n/1e3).toFixed(1)+'k':(Math.round(n*100)/100); }

function colors(i){
  const palette=['#d6a452','#7a9cc0','#8fae6b','#d26152','#b084d6','#6fc2b5','#e58fb0','#c9c14a'];
  return palette[i%palette.length];
}

function render(){
  const b = DATA.buildings.find(x=>x.id===bldSel.value);
  if(!b) return;
  current = b;
  const pop = +popInput.value || 1;
  const hap = +hapSel.value || 1;

  // 配方选择
  recipeSel.style.display = b.recipes.length>1?'inline-block':'none';
  recipeSel.innerHTML='';
  b.recipes.forEach((r,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=r.name+(r.unlockAt?(' (Lv'+r.unlockAt+' 解锁)'):''); recipeSel.appendChild(o); });
  const recipe = b.recipes[+recipeSel.value||0];
  const maxLv = b.maxLevel;

  $('costTitle').textContent = b.icon + ' ' + b.name + ' —— 升级成本曲线';
  if(b.cost){
    $('costSub').innerHTML = '主资源 <span class="costRes">' + b.cost.costResourceIcon + ' ' + b.cost.costResource + '</span>，基础成本 ' + b.cost.baseCost + '，倍率 ×' + b.cost.costMultiplier + (maxLv>=5 ? '（Lv5+ 主倍率 +0.1 / 追加精炼资源成本）' : '');
  } else { $('costSub').textContent='该建筑无升级成本数据。'; }

  // 成本图表
  const labels = Array.from({length:maxLv},(_,i)=>'Lv'+(i+1));
  const prim = b.levels.map(l=>l.cost?l.cost.primary.amount:0);
  const sec = b.levels.map(l=>l.cost&&l.cost.secondary?l.cost.secondary.amount:0);
  const primRes = b.cost?b.cost.costResource:'—';
  const secRes = b.cost&&b.levels[4]&&b.levels[4].cost&&b.levels[4].cost.secondary?b.levels[4].cost.secondary.resource:null;

  if(costChart) costChart.destroy();
  const ds=[{label:'主成本('+primRes+')',data:prim,backgroundColor:'rgba(214,164,82,.75)',borderColor:'#f2ce84',borderWidth:1}];
  if(sec.some(v=>v>0)) ds.push({label:'二成本('+(secRes||'精炼')+')',data:sec,backgroundColor:'rgba(122,156,192,.75)',borderColor:'#7a9cc0',borderWidth:1});
  costChart=new Chart($('costChart'),{type:'bar',data:{labels,datasets:ds},
    options:{responsive:true,plugins:{legend:{labels:{color:'#ece2cb'}},tooltip:{callbacks:{label:(c)=>' '+c.dataset.label+': '+fmt(c.parsed.y)}}},
      scales:{x:{ticks:{color:'#b5a584'},grid:{color:'rgba(255,232,190,.06)'}},y:{beginAtZero:true,ticks:{color:'#b5a584',callback:v=>fmt(v)},grid:{color:'rgba(255,232,190,.08)'}}}}});

  // 产出图表
  $('rateTitle').textContent = b.icon + ' ' + b.name + ' —— 产出速率曲线（按 ' + pop + ' 人）';
  if(b.recipes.some(r=>r.outputs.length)){
    $('rateSub').textContent = recipe ? ('配方「' + recipe.name + '」：速率 = 单位产出 × ' + pop + '人 × (1 + (等级−1)×ratePerLevel) × 幸福度 ' + hap) : '';
    if(rateChart) rateChart.destroy();
    const rds = recipe.outputs.map((o,i)=>{
      const series = o.ratePerLevel.map(r=>+(r*pop*hap).toFixed(3));
      return {label:(DATA.res[o.resource]||o.resource)+'（单位'+o.rate+'）',data:series,borderColor:colors(i),backgroundColor:colors(i),tension:.25,fill:false,pointRadius:2};
    });
    rateChart=new Chart($('rateChart'),{type:'line',data:{labels,datasets:rds},
      options:{responsive:true,plugins:{legend:{labels:{color:'#ece2cb'}},tooltip:{callbacks:{label:(c)=>' '+c.dataset.label+': '+fmt(c.parsed.y)+'/s'}}},
        scales:{x:{ticks:{color:'#b5a584'},grid:{color:'rgba(255,232,190,.06)'}},y:{beginAtZero:true,ticks:{color:'#b5a584'},grid:{color:'rgba(255,232,190,.08)'}}}}});
  } else if(b.process){
    $('rateSub').textContent = '加工速度（批/s）= 1人 × (1 + (等级−1)×ratePerLevel) ÷ 加工时长 × 幸福度 ' + hap;
    if(rateChart) rateChart.destroy();
    const series = b.process.map(v=>+(v*pop*hap).toFixed(4));
    rateChart=new Chart($('rateChart'),{type:'line',data:{labels,datasets:[{label:'加工速度(批/s)',data:series,borderColor:colors(0),backgroundColor:colors(0),tension:.25,fill:false,pointRadius:2}]},
      options:{responsive:true,plugins:{legend:{labels:{color:'#ece2cb'}},tooltip:{callbacks:{label:(c)=>' '+c.dataset.label+': '+c.parsed.y+' 批/s'}}},
        scales:{x:{ticks:{color:'#b5a584'},grid:{color:'rgba(255,232,190,.06)'}},y:{beginAtZero:true,ticks:{color:'#b5a584'},grid:{color:'rgba(255,232,190,.08)'}}}}});
  } else {
    $('rateSub').textContent='该建筑无直接产出速率（如特殊功能建筑，仅有升级成本）。';
    if(rateChart) rateChart.destroy();
    $('rateChart').getContext('2d').clearRect(0,0,$('rateChart').width,$('rateChart').height);
  }

  // 明细表
  let t='<table><tr><th>等级</th>';
  if(b.cost){ t+='<th>主成本('+primRes+')</th>'+(sec.some(v=>v>0)?'<th>二成本</th>':''); }
  if(recipe&&recipe.outputs.length){ recipe.outputs.forEach(o=>t+='<th>'+(DATA.res[o.resource]||o.resource)+'/s</th>'); }
  else if(b.process){ t+='<th>加工速度(批/s)</th>'; }
  t+='</tr>';
  for(let i=0;i<maxLv;i++){
    t+='<tr><td>Lv'+(i+1)+'</td>';
    if(b.cost){ t+='<td>'+fmt(prim[i])+'</td>'+(sec.some(v=>v>0)?'<td>'+(sec[i]?fmt(sec[i])+' '+secRes:'—')+'</td>':''); }
    if(recipe&&recipe.outputs.length){ recipe.outputs.forEach(o=>t+='<td>'+fmt(o.ratePerLevel[i]*pop*hap)+'</td>'); }
    else if(b.process){ t+='<td>'+fmt(b.process[i]*pop*hap)+'</td>'; }
    t+='</tr>';
  }
  t+='</table>';
  $('tableWrap').innerHTML=t;
}

[bldSel,popInput,hapSel,recipeSel].forEach(el=>el.addEventListener('change',render));
render();
</script>
</body>
</html>
`

writeFileSync(new URL('./数值可视化.html', import.meta.url), html, 'utf-8')
console.log('已生成 tools/数值可视化.html，共 ' + buildings.length + ' 个建筑。')
