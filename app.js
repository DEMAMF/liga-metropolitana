
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.LIGA_CONFIG;
const ready=!!(cfg?.url?.startsWith('https://')&&cfg?.anonKey&&!cfg.anonKey.startsWith('PEGAR_'));
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=ready?createClient(cfg.url,cfg.anonKey):null;

let admin=false,selected=null,clubs=[],categories=[],matches=[],scorers=[],announcements=[],cards=[],sanctions=[];

function status(s,error=false){
  $('#status').textContent=s;
  $('#status').classList.toggle('error',error);
}

function page(id){
  $$('.page').forEach(e=>e.classList.toggle('hidden',e.id!==id));
  $$('#tabs button').forEach(e=>e.classList.toggle('active',e.dataset.page===id));
}

$$('#tabs button').forEach(b=>b.onclick=()=>page(b.dataset.page));

const name=(list,id)=>list.find(x=>String(x.id)===String(id))?.name||'—';

function options(sel,list){
  $$(sel).forEach(el=>{
    const old=el.value;
    el.innerHTML=list.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    if(list.some(x=>String(x.id)===old))el.value=old;
  });
}

function matchView(m){
  return `<div class="match"><span>${esc(name(clubs,m.home_id))}</span><b>${m.home_goals??'—'} – ${m.away_goals??'—'}</b><span>${esc(name(clubs,m.away_id))}</span></div><small>${esc(name(categories,m.category_id))} · ${esc(m.round)} · ${esc(m.match_date||'Fecha pendiente')}</small>`;
}

function calculateStandings(categoryId){
  const table=Object.fromEntries(clubs.map(c=>[c.id,{
    id:c.id,pj:0,pg:0,pe:0,pp:0,gf:0,gc:0,pts:0
  }]));

  matches.filter(m=>String(m.category_id)===String(categoryId)&&m.home_goals!=null&&m.away_goals!=null).forEach(m=>{
    const a=table[m.home_id],b=table[m.away_id];
    if(!a||!b)return;

    a.pj++;b.pj++;
    a.gf+=Number(m.home_goals);a.gc+=Number(m.away_goals);
    b.gf+=Number(m.away_goals);b.gc+=Number(m.home_goals);

    if(Number(m.home_goals)>Number(m.away_goals)){
      a.pg++;b.pp++;a.pts+=3;
    }else if(Number(m.home_goals)<Number(m.away_goals)){
      b.pg++;a.pp++;b.pts+=3;
    }else{
      a.pe++;b.pe++;a.pts++;b.pts++;
    }
  });

  return Object.values(table).sort((a,b)=>
    b.pts-a.pts||
    (b.gf-b.gc)-(a.gf-a.gc)||
    b.gf-a.gf||
    name(clubs,a.id).localeCompare(name(clubs,b.id),'es')
  );
}


function renderGeneral(){
  const body=$('#generalStandings');
  if(!body)return;

  if(!clubs.length){
    body.innerHTML='<tr><td colspan="3">No hay clubes cargados.</td></tr>';
    return;
  }

  const totals=Object.fromEntries(
    clubs.map(c=>[String(c.id),{id:c.id,pts:0}])
  );

  categories.forEach(category=>{
    calculateStandings(category.id).forEach(row=>{
      const club=totals[String(row.id)];
      if(club)club.pts+=Number(row.pts)||0;
    });
  });

  body.innerHTML=Object.values(totals)
    .sort((a,b)=>b.pts-a.pts||name(clubs,a.id).localeCompare(name(clubs,b.id),'es'))
    .map((x,i)=>`<tr><td>${i+1}</td><td>${esc(name(clubs,x.id))}</td><td class="n"><b>${x.pts}</b></td></tr>`)
    .join('');
}
function renderFairPlay(){
  const box=$('#fairPlayTable');
  if(!box)return;

  if(!cards.length){
    box.innerHTML='<p>Todavía no hay tarjetas registradas.</p>';
    return;
  }

  const rows=cards.map(c=>{
    const type=String(c.card_type||'').toLowerCase();
    const points=type==='roja'?3:type==='amarilla'?1:0;
    const match=matches.find(m=>String(m.id)===String(c.match_id));
    return {...c,points,match};
  }).sort((a,b)=>b.points-a.points||String(a.player_name).localeCompare(String(b.player_name),'es'));

  box.innerHTML=`<div class="scroll"><table>
    <thead><tr><th>Jugador/a</th><th>Club</th><th>Categoría</th><th>Tarjeta</th><th class="n">Puntos</th><th>Partido</th></tr></thead>
    <tbody>${rows.map(c=>`<tr>
      <td>${esc(c.player_name)}</td>
      <td>${esc(name(clubs,c.club_id))}</td>
      <td>${esc(name(categories,c.category_id))}</td>
      <td>${String(c.card_type).toLowerCase()==='roja'?'🔴 Roja':'🟨 Amarilla'}</td>
      <td class="n">${c.points}</td>
      <td>${c.match?`${esc(name(clubs,c.match.home_id))} ${c.match.home_goals??'—'}-${c.match.away_goals??'—'} ${esc(name(clubs,c.match.away_id))} · ${esc(c.match.round)}`:esc(c.notes||c.card_date||'—')}</td>
    </tr>`).join('')}</tbody>
  </table></div><p>Amarilla: 1 punto. Roja: 3 puntos. Menor puntaje indica mejor Fair Play.</p>`;
}

function renderSanctions(){
  const box=$('#sanctionsList');
  if(!box)return;

  const active=sanctions.filter(s=>s.status==='activa');

  if(!sanctions.length){
    box.innerHTML='<p>No hay sanciones registradas.</p>';
    return;
  }

  box.innerHTML=`<div class="scroll"><table>
    <thead><tr><th>Jugador/a</th><th>Club</th><th>Categoría</th><th>Motivo</th><th>Fechas impuestas</th><th>Fechas cumplidas</th><th>Pendientes</th><th>Estado</th></tr></thead>
    <tbody>${sanctions.map(s=>{
      const imposed=Number(s.dates_imposed)||0;
      const served=Number(s.dates_served)||0;
      const remaining=Math.max(0,imposed-served);
      return `<tr>
        <td>${esc(s.player_name)}</td>
        <td>${esc(name(clubs,s.club_id))}</td>
        <td>${esc(name(categories,s.category_id))}</td>
        <td>${esc(s.reason||s.notes||'—')}</td>
        <td class="n">${imposed}</td>
        <td class="n">${served}</td>
        <td class="n"><b>${remaining}</b></td>
        <td>${esc(s.status||'—')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function render(){
  $('#clubN').textContent=clubs.length;
  $('#matchN').textContent=matches.filter(m=>m.home_goals!=null&&m.away_goals!=null).length;
  $('#goalN').textContent=matches.reduce((s,m)=>s+(Number(m.home_goals)||0)+(Number(m.away_goals)||0),0);

  $('#recent').innerHTML=matches.filter(m=>m.home_goals!=null&&m.away_goals!=null).slice(0,5).map(matchView).join('')||'<p>Sin resultados todavía.</p>';

  $('#fixtures').innerHTML=matches.filter(m=>String(m.category_id)===String(selected)).map(matchView).join('')||'<p>Sin partidos cargados en esta categoría.</p>';

  $('#announcements').innerHTML=announcements.map(a=>`<div><h3>${esc(a.title)}</h3><p style="white-space:pre-wrap">${esc(a.body)}</p><small>${new Date(a.created_at).toLocaleDateString('es-AR')}</small><hr></div>`).join('')||'<p>Sin comunicados.</p>';

  const standings=calculateStandings(selected);
  $('#standings').innerHTML=standings.map((x,i)=>`<tr><td>${i+1}</td><td>${esc(name(clubs,x.id))}</td>${['pj','pg','pe','pp','gf','gc'].map(k=>`<td class="n">${x[k]}</td>`).join('')}<td class="n">${x.gf-x.gc}</td><td class="n"><b>${x.pts}</b></td></tr>`).join('');

  const grouped=new Map();
  scorers.filter(s=>String(s.category_id)===String(selected)).forEach(s=>{
    const key=JSON.stringify([s.player.trim().toLowerCase(),s.club_id]);
    const x=grouped.get(key)||{...s,goals:0};
    x.goals+=Number(s.goals)||0;
    grouped.set(key,x);
  });

  $('#scorers').innerHTML=[...grouped.values()].sort((a,b)=>b.goals-a.goals).map(s=>`<tr><td>${esc(s.player)}</td><td>${esc(name(clubs,s.club_id))}</td><td class="n">${s.goals}</td></tr>`).join('')||'<tr><td colspan="3">Sin goleadores cargados.</td></tr>';

  renderGeneral();
  renderFairPlay();
  renderSanctions();

  $('#adminMatches').innerHTML=matches.map(m=>`<div class="row" style="margin:8px 0"><small>${esc(name(categories,m.category_id))}: ${esc(name(clubs,m.home_id))} ${m.home_goals??'—'}-${m.away_goals??'—'} ${esc(name(clubs,m.away_id))}</small><button class="alt" data-delete="matches" data-id="${m.id}">Eliminar</button></div>`).join('');

  $('#adminScorers').innerHTML=scorers.map(s=>`<div class="row" style="margin:8px 0"><small>${esc(s.player)} · ${esc(name(clubs,s.club_id))} · ${s.goals}</small><button class="alt" data-delete="scorers" data-id="${s.id}">Eliminar</button></div>`).join('');

  $('#adminAnnouncements').innerHTML=announcements.map(a=>`<div class="row" style="margin:8px 0"><small>${esc(a.title)}</small><button class="alt" data-delete="announcements" data-id="${a.id}">Eliminar</button></div>`).join('');
}

$$('.filter').forEach(e=>e.onchange=()=>{
  selected=Number(e.value);
  $$('.filter').forEach(x=>x.value=e.value);
  render();
});

async function load(){
  if(!db)return;
  try{
    const tables=['clubs','categories','matches','scorers','announcements','cards','disciplinary_sanctions'];
    const result=await Promise.all(tables.map(t=>db.from(t).select('*')));
    const error=result.find(x=>x.error)?.error;
    if(error)throw error;

    [clubs,categories,matches,scorers,announcements,cards,sanctions]=result.map(x=>x.data);

    categories.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    matches.sort((a,b)=>String(b.match_date||'').localeCompare(String(a.match_date||''))||b.id-a.id);
    announcements.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));

    selected=categories.some(x=>String(x.id)===String(selected))?selected:categories[0]?.id;

    options('.categories',categories);
    options('.clubs',clubs);
    options('.filter',categories);
    $$('.filter').forEach(x=>x.value=selected??'');

    render();
    status('Información actualizada.');
  }catch(e){
    status('Error de lectura: '+e.message,true);
  }
}

async function authState(){
  if(!db)return;
  const {data:{user}}=await db.auth.getUser();
  admin=false;
  if(user){
    const {data,error}=await db.rpc('is_admin');
    admin=!error&&data===true;
  }
  $('#adminTab').classList.toggle('hidden',!admin);
  $('#loginToggle').textContent=admin?'Panel administrador':'Acceso administrador';
  if(!admin&&!$('#admin').classList.contains('hidden'))page('inicio');
}

$('#loginToggle').onclick=()=>page(admin?'admin':'login');

$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  if(!db)return;
  const {error}=await db.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});
  $('#password').value='';
  if(error){status('Ingreso rechazado: '+error.message,true);return;}
  await authState();
  if(admin){page('admin');status('Sesión de administrador iniciada.');}
  else{
    await db.auth.signOut();
    status('Esta cuenta no tiene permisos de administrador.',true);
  }
};

$('#logout').onclick=async()=>{
  await db.auth.signOut();
  await authState();
  page('inicio');
  status('Sesión cerrada.');
};

async function insert(form,table,transform=x=>x){
  if(!admin)return;
  const data=transform(Object.fromEntries(new FormData(form)));
  const {error}=await db.from(table).insert(data);
  if(error){status('No se guardó: '+error.message,true);return;}
  form.reset();
  await load();
  status('Guardado correctamente.');
}

$('#clubForm').onsubmit=e=>{
  e.preventDefault();
  insert(e.target,'clubs',x=>({name:x.name.trim()}));
};

$('#matchForm').onsubmit=e=>{
  e.preventDefault();
  insert(e.target,'matches',x=>{
    x.category_id=+x.category_id;
    x.home_id=+x.home_id;
    x.away_id=+x.away_id;
    x.home_goals=+x.home_goals;
    x.away_goals=+x.away_goals;
    if(x.home_id===x.away_id)throw Error('El local y visitante deben ser distintos');
    return x;
  }).catch(err=>status(err.message,true));
};

$('#scorerForm').onsubmit=e=>{
  e.preventDefault();
  insert(e.target,'scorers',x=>({...x,player:x.player.trim(),club_id:+x.club_id,category_id:+x.category_id,goals:+x.goals}));
};

$('#announcementForm').onsubmit=e=>{
  e.preventDefault();
  insert(e.target,'announcements');
};

$('#admin').onclick=async e=>{
  const b=e.target.closest('[data-delete]');
  if(!b||!admin||!confirm('¿Eliminar este registro?'))return;
  const {error}=await db.from(b.dataset.delete).delete().eq('id',Number(b.dataset.id));
  if(error)status(error.message,true);
  else await load();
};

if(!ready){
  status('Falta configurar config.js con la URL y la clave pública de Supabase.',true);
}else{
  await authState();
  await load();
  db.auth.onAuthStateChange(()=>{setTimeout(authState,0);});
}
