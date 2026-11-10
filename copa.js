import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.LIGA_CONFIG;
const db = cfg?.url && cfg?.anonKey ? createClient(cfg.url, cfg.anonKey) : null;
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const crestBase = 'https://raw.githubusercontent.com/DEMAMF/liga-metropolitana/main/escudos/';
const crestFiles = {
  'Villa Coll':'VILLA COLL.png','CDSV':'CDSV.png','Defensores de Glew':'DEFENSORES DE GLEW.png',
  'Malvinas':'MALVINAS.png','Lirico':'LIRICO.png','Sakura':'SAKURA.png','Santa Ana':'SANTA ANA.png'
};
const clubs = ['Villa Coll','CDSV','Defensores de Glew','Malvinas','Lirico','Sakura','Santa Ana'];
const categories = ['Sub-15 Femenino','Sub-17 Femenino','1ª Femenino','6ª División','5ª División','4ª División','3ª División','1ª División','Senior'];
const copaCategories = categories.filter(c => c !== 'Sub-15 Femenino');
const ties = [
  {id:'QF1',title:'Cuartos · Partido 1',home:'CDSV',away:'Santa Ana'},
  {id:'QF2',title:'Cuartos · Partido 2',home:'Defensores de Glew',away:'Sakura'},
  {id:'QF3',title:'Cuartos · Partido 3',home:'Malvinas',away:'Lirico'},
  {id:'SF1',title:'Semifinal 1',home:'Villa Coll',away:null},
  {id:'SF2',title:'Semifinal 2',home:null,away:null},
  {id:'FINAL',title:'Final',home:null,away:null}
];
let admin = false, matches = [], scorers = [], cards = [], selectedCategory = 'Sub-17 Femenino';

function crest(club, size=34) {
  const file = crestFiles[club];
  return file ? '<img src="'+crestBase+encodeURIComponent(file)+'" alt="Escudo '+esc(club)+'" loading="eager" style="display:inline-block;width:34px;height:34px;object-fit:contain;flex:0 0 34px" onerror="this.style.display=\'none\'">' : '';
}
function team(club) { return club ? '<span class="copa-team">'+crest(club)+'<b>'+esc(club)+'</b></span>' : '<span class="copa-team copa-pending">Por definir</span>'; }
function score(m) { return m && m.home_goals !== null && m.away_goals !== null ? m.home_goals+' - '+m.away_goals : 'vs'; }
function matchFor(tie, cat) { return matches.find(m => m.tie_code===tie && m.category===cat); }

function tieStats(tieId) {
  const rows = matches.filter(m => m.tie_code===tieId && m.home_goals !== null && m.away_goals !== null);
  const base = ties.find(t=>t.id===tieId);
  if (!base || !base.home || !base.away || rows.length !== 8) return null;
  const stats = {};
  [base.home,base.away].forEach(c=>stats[c]={club:c,pts:0,gf:0,gc:0,fp:0});
  rows.forEach(m=>{
    const h=stats[m.home_club], a=stats[m.away_club];
    if(!h||!a)return;
    h.gf += Number(m.home_goals); h.gc += Number(m.away_goals);
    a.gf += Number(m.away_goals); a.gc += Number(m.home_goals);
    if(m.home_goals>m.away_goals)h.pts+=3;
    else if(m.home_goals<m.away_goals)a.pts+=3;
    else {h.pts++;a.pts++;}
  });
  cards.filter(c=>rows.some(m=>m.id===c.match_id)).forEach(c=>{
    if(stats[c.club_name])stats[c.club_name].fp += c.card_type==='Roja'?3:1;
  });
  const sorted=Object.values(stats).sort((a,b)=>b.pts-a.pts||b.gf-a.gf||(b.gf-b.gc)-(a.gf-a.gc)||a.fp-b.fp);
  const [one,two]=sorted;
  const equal=one.pts===two.pts&&one.gf===two.gf&&(one.gf-one.gc)===(two.gf-two.gc)&&one.fp===two.fp;
  return {rows,stats,sorted,winner:equal?null:one.club,complete:rows.length===8,tied:equal};
}
function resolveBracket() {
  const q1=tieStats('QF1')?.winner, q2=tieStats('QF2')?.winner, q3=tieStats('QF3')?.winner;
  ties.find(t=>t.id==='SF1').away=q3||null;
  const sf2=ties.find(t=>t.id==='SF2'); sf2.home=q1||null; sf2.away=q2||null;
  const f=ties.find(t=>t.id==='FINAL');
  f.home=tieStats('SF1')?.winner||null; f.away=tieStats('SF2')?.winner||null;
}
function tieCard(t) {
  const stats=tieStats(t.id);
  const home=t.home, away=t.away;
  return '<article class="copa-tie"><div class="copa-tie-head">'+esc(t.title)+'</div>'+
    '<div class="copa-tie-teams">'+team(home)+'<strong class="copa-versus">VS</strong>'+team(away)+'</div>'+
    '<div class="copa-tie-meta">'+(stats ? (stats.winner ? 'Clasificado: <b>'+esc(stats.winner)+'</b>' : stats.tied ? 'Empate total: pendiente de resolución' : stats.rows.length+'/8 categorías cargadas') : 'La llave se define con las 8 categorías')+'</div>'+
    '<div class="copa-mini-results">'+copaCategories.map(cat=>{const m=matchFor(t.id,cat);return '<span>'+esc(cat.replace(' División','').replace(' Femenino',' F.'))+': <b>'+score(m)+'</b></span>';}).join('')+'</div></article>';
}
function renderBracket() {
  resolveBracket();
  $('#copaBracket').innerHTML='<div class="copa-round"><h3>Cuartos de final</h3>'+ties.slice(0,3).map(tieCard).join('')+'</div>'+
    '<div class="copa-round"><h3>Semifinales</h3>'+ties.slice(3,5).map(tieCard).join('')+'</div>'+
    '<div class="copa-round copa-final"><h3>Final</h3>'+tieCard(ties[5])+'</div>';
}
function renderAggregate() {
  const totals=Object.fromEntries(clubs.map(c=>[c,{club:c,pts:0,gf:0,gc:0,fp:0,pj:0}]));
  matches.filter(m=>m.home_goals!==null&&m.away_goals!==null).forEach(m=>{
    const h=totals[m.home_club],a=totals[m.away_club]; if(!h||!a)return;
    h.pj++;a.pj++;h.gf+=m.home_goals;h.gc+=m.away_goals;a.gf+=m.away_goals;a.gc+=m.home_goals;
    if(m.home_goals>m.away_goals)h.pts+=3;else if(m.home_goals<m.away_goals)a.pts+=3;else{h.pts++;a.pts++;}
  });
  cards.forEach(c=>{if(totals[c.club_name])totals[c.club_name].fp+=c.card_type==='Roja'?3:1;});
  const rows=Object.values(totals).sort((a,b)=>b.pts-a.pts||b.gf-a.gf||(b.gf-b.gc)-(a.gf-a.gc)||a.fp-b.fp);
  $('#copaAggregate').innerHTML=rows.map((r,i)=>'<tr><td>'+ (i+1)+'</td><td><span class="copa-table-team">'+crest(r.club)+esc(r.club)+'</span></td><td>'+r.pts+'</td><td>'+r.pj+'</td><td>'+r.gf+'</td><td>'+r.gc+'</td><td>'+(r.gf-r.gc)+'</td></tr>').join('');
  $('#copaFairplay').innerHTML=rows.slice().sort((a,b)=>a.fp-b.fp).map((r,i)=>'<tr><td>'+(i+1)+'</td><td><span class="copa-table-team">'+crest(r.club)+esc(r.club)+'</span></td><td>'+r.fp+'</td></tr>').join('');
}
function renderScorers() {
  const cat=$('#copaScorerCategory').value;
  const rows=scorers.filter(s=>s.category===cat).sort((a,b)=>b.goals-a.goals);
  $('#copaScorers').innerHTML=rows.map(s=>'<tr><td>'+esc(s.player_name)+'</td><td><span class="copa-table-team">'+crest(s.club_name)+esc(s.club_name)+'</span></td><td>'+s.goals+'</td></tr>').join('')||'<tr><td colspan="3">Todavía no hay goleadores cargados.</td></tr>';
}
function renderCardMatchOptions() {
  const select = document.querySelector('#copaCardForm select[name="match_id"]');
  if(!select)return;
  const old=select.value;
  select.innerHTML='<option value="">Seleccionar partido</option>'+matches.map(m=>'<option value="'+m.id+'">'+esc(m.tie_code)+' · '+esc(m.category)+' · '+esc(m.home_club)+' vs '+esc(m.away_club)+'</option>').join('');
  if([...select.options].some(o=>o.value===old))select.value=old;
}
function renderAdminMatches() {
  $('#copaAdminMatches').innerHTML=ties.map(t=>'<div class="copa-admin-tie"><h4>'+esc(t.title)+' · '+esc(t.home||'Por definir')+' vs '+esc(t.away||'Por definir')+'</h4><div class="copa-admin-grid">'+copaCategories.map(cat=>{
    const m=matchFor(t.id,cat);
    return '<form class="copa-score-form" data-tie="'+t.id+'" data-category="'+esc(cat)+'"><label>'+esc(cat)+'</label><input name="match_date" type="date" value="'+(m?.match_date||'')+'" aria-label="Fecha del partido"><input name="home_goals" type="number" min="0" placeholder="Local" value="'+(m?.home_goals??'')+'" required><input name="away_goals" type="number" min="0" placeholder="Visita" value="'+(m?.away_goals??'')+'" required><button>Guardar</button></form>';
  }).join('')+'</div></div>').join('');
}
async function load() {
  if(!db){$('#copaStatus').textContent='Falta configurar Supabase en config.js.';return;}
  const results=await Promise.all([
    db.from('copa_matches').select('*'),
    db.from('copa_scorers').select('*'),
    db.from('copa_cards').select('*')
  ]);
  const err=results.find(r=>r.error)?.error;
  if(err){$('#copaStatus').textContent='No se pudieron cargar los datos de Copa. Ejecutá primero el SQL de configuración en Supabase. Detalle: '+err.message;return;}
  [matches,scorers,cards]=results.map(r=>r.data||[]);
  matches.forEach(m=>{m.home_goals=m.home_goals===null?null:Number(m.home_goals);m.away_goals=m.away_goals===null?null:Number(m.away_goals);});
  $('#copaStatus').textContent='Datos de Copa actualizados desde Supabase.';
  renderBracket();renderAggregate();renderScorers();
  if(admin){renderAdminMatches();renderCardMatchOptions();}
}
async function checkAdmin() {
  if(!db)return;
  const {data:{user}}=await db.auth.getUser();
  if(!user)return;
  const {data,error}=await db.rpc('is_admin');
  admin=!error&&data===true;
  $('#copaAdminPanel').hidden=!admin;
  $('#copaLoginInfo').textContent=admin?'Administrador habilitado.':'Ingresá con tu cuenta administradora desde el acceso de la Liga.';
  if(admin){renderAdminMatches();renderCardMatchOptions();}
}
async function saveScore(form) {
  const t=form.dataset.tie,cat=form.dataset.category;
  const tie=ties.find(x=>x.id===t);resolveBracket();
  if(!tie?.home||!tie?.away){alert('Este cruce todavía no tiene los dos equipos definidos.');return;}
  const payload={tie_code:t,category:cat,home_club:tie.home,away_club:tie.away,match_date:form.elements.match_date.value||null,home_goals:Number(form.elements.home_goals.value),away_goals:Number(form.elements.away_goals.value)};
  const existing=matchFor(t,cat);
  const result=existing?await db.from('copa_matches').update(payload).eq('id',existing.id):await db.from('copa_matches').insert(payload);
  if(result.error){$('#copaStatus').textContent='Error al guardar: '+result.error.message;return;}
  await load();
}
$('#copaScorerCategory').addEventListener('change',renderScorers);
$('#copaAdminMatches').addEventListener('submit',async e=>{
  const f=e.target.closest('.copa-score-form');if(!f)return;e.preventDefault();if(admin)await saveScore(f);
});
$('#copaScorerForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!admin)return;
  const f=e.target,fd=new FormData(f);
  const {error}=await db.from('copa_scorers').insert({player_name:String(fd.get('player_name')).trim(),club_name:fd.get('club_name'),category:fd.get('category'),goals:Number(fd.get('goals'))});
  if(error){$('#copaStatus').textContent=error.message;return;}f.reset();await load();
});
$('#copaCardForm').addEventListener('submit',async e=>{
  e.preventDefault();if(!admin)return;
  const f=e.target,fd=new FormData(f);
  const {error}=await db.from('copa_cards').insert({player_name:String(fd.get('player_name')).trim(),club_name:fd.get('club_name'),category:fd.get('category'),card_type:fd.get('card_type'),match_id:fd.get('match_id')?Number(fd.get('match_id')):null});
  if(error){$('#copaStatus').textContent=error.message;return;}f.reset();await load();
});
$('#copaReset').addEventListener('click',async()=>{
  if(!admin)return;
  const first=confirm('ATENCIÓN: esto borrará todos los resultados, goleadores y tarjetas de la Copa de Clubes 2026. No afecta los datos históricos de la Liga. ¿Querés continuar?');
  if(!first)return;
  const second=prompt('Para confirmar, escribí REINICIAR COPA');
  if(second!=='REINICIAR COPA')return;
  const a=await db.from('copa_cards').delete().not('id','is',null);
  const b=await db.from('copa_scorers').delete().not('id','is',null);
  const c=await db.from('copa_matches').delete().not('id','is',null);
  const err=a.error||b.error||c.error;
  if(err)$('#copaStatus').textContent='No se pudo completar el reinicio: '+err.message;else await load();
});
$('#copaLogin').addEventListener('click',async()=>{
  if(!db)return;
  const email=prompt('Correo de administrador');if(!email)return;
  const password=prompt('Contraseña');if(!password)return;
  const {error}=await db.auth.signInWithPassword({email,password});
  if(error){$('#copaStatus').textContent='No se pudo iniciar sesión: '+error.message;return;}
  await checkAdmin();await load();
});
$('#copaLogout').addEventListener('click',async()=>{await db.auth.signOut();admin=false;$('#copaAdminPanel').hidden=true;});
$('#copaDocumentList').innerHTML='<p>Los reglamentos, boletines y resoluciones se muestran desde la sección Documentación oficial de la Liga.</p><a href="./index.html#documentos" id="copaDocsLink">Ir a Documentación oficial</a>';
if(db){await checkAdmin();await load();db.auth.onAuthStateChange(()=>setTimeout(async()=>{await checkAdmin();await load();},0));}
