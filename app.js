import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';

const cfg=window.LIGA_CONFIG;
const ready=!!(cfg?.url?.startsWith('https://')&&cfg?.anonKey&&!cfg.anonKey.startsWith('PEGAR_'));
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const db=ready?createClient(cfg.url,cfg.anonKey):null;

let admin=false,selected=null,clubs=[],categories=[],matches=[],scorers=[],announcements=[],cards=[],sanctions=[];

function status(s,error=false){
  const box=$('#status');
  if(!box)return;
  box.textContent=s;
  box.classList.toggle('error',error);
}

function page(id){
  $$('.page').forEach(e=>e.classList.toggle('hidden',e.id!==id));
  $$('#tabs button').forEach(e=>e.classList.toggle('active',e.dataset.page===id));

  if(id==='documentos')loadDocuments();
  if(id==='admin'&&admin)loadAdminDocuments();
}

$$('#tabs button').forEach(b=>b.onclick=()=>page(b.dataset.page));

const name=(list,id)=>list.find(x=>String(x.id)===String(id))?.name||'—';

const ESCUDOS_BASE='https://raw.githubusercontent.com/DEMAMF/liga-amf/main/escudos/';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toUpperCase().replace(/\s+/g,' ');

const crestFiles={
  'VILLA COOL':'VILLA COLL.png',
  'VILLA COLL':'VILLA COLL.png',
  'CDSV':'CDSV.png',
  'DEFENSORES DE GLEW':'DEFENSORES DE GLEW.png',
  'MALVINAS':'MALVINAS.png',
  'LIRICO':'LIRICO.png',
  'LIRICO FUTSAL':'LIRICO.png',
  'SAKURA':'SAKURA.png',
  'SANTA ANA':'SANTA ANA.png'
};

function getCrestImg(clubName){
  const file=crestFiles[norm(clubName)];
  if(!file)return '';
  return `<img src="${ESCUDOS_BASE}${encodeURIComponent(file)}" alt="" loading="lazy" style="width:28px;height:28px;object-fit:contain;flex:none;" onerror="this.remove()">`;
}

function clubLabel(id){
  const n=name(clubs,id);
  const img=getCrestImg(n);
  return `<span class="club-cell"><span>${esc(n)}</span>${img}</span>`;
}

function options(sel,list){
  $$(sel).forEach(el=>{
    const old=el.value;
    el.innerHTML=list.map(x=>`<option value="${x.id}">${esc(x.name)}</option>`).join('');
    if(list.some(x=>String(x.id)===old))el.value=old;
  });
}

function matchView(m){
  const homeName = name(clubs, m.home_id);
  const awayName = name(clubs, m.away_id);
  return `
    <div class="match-card">
      <div class="match-main">
        <div class="match-team home">
          <span>${esc(homeName)}</span>
          ${getCrestImg(homeName)}
        </div>
        <div class="match-score">${m.home_goals??'—'} – ${m.away_goals??'—'}</div>
        <div class="match-team away">
          ${getCrestImg(awayName)}
          <span>${esc(awayName)}</span>
        </div>
      </div>
      <div class="match-info">
        <span><b>${esc(name(categories,m.category_id))}</b> · ${esc(m.round)}</span>
        <span>${esc(m.match_date||'Fecha pendiente')}</span>
      </div>
    </div>
  `;
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
  if(!clubs.length){body.innerHTML='<tr><td colspan="3">No hay clubes cargados.</td></tr>';return;}

  const totals=Object.fromEntries(clubs.map(c=>[String(c.id),{id:c.id,pts:0}]));
  categories.forEach(category=>{
    calculateStandings(category.id).forEach(row=>{
      const club=totals[String(row.id)];
      if(club)club.pts+=Number(row.pts)||0;
    });
  });

  body.innerHTML=Object.values(totals)
    .sort((a,b)=>b.pts-a.pts||name(clubs,a.id).localeCompare(name(clubs,b.id),'es'))
    .map((x,i)=>`<tr><td>${i+1}</td><td>${clubLabel(x.id)}</td><td class="n"><b>${x.pts}</b></td></tr>`)
    .join('');
}

function renderFairPlay(){
  const box=$('#fairPlayTable');
  if(!box)return;
  if(!cards.length){box.innerHTML='<p>Todavía no hay tarjetas registradas.</p>';return;}

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
      <td>${clubLabel(c.club_id)}</td>
      <td>${esc(name(categories,c.category_id))}</td>
      <td>${String(c.card_type).toLowerCase()==='roja'?'🔴 Roja':'🟨 Amarilla'}</td>
      <td class="n">${c.points}</td>
      <td>${c.match?`${name(clubs,c.match.home_id)} vs ${name(clubs,c.match.away_id)}`:esc(c.notes||c.card_date||'—')}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function renderSanctions(){
  const box=$('#sanctionsList');
  if(!box)return;
  if(!sanctions.length){box.innerHTML='<p>No hay sanciones registradas.</p>';return;}

  box.innerHTML=`<div class="scroll"><table>
    <thead><tr><th>Jugador/a</th><th>Club</th><th>Categoría</th><th>Motivo</th><th>Impuestas</th><th>Cumplidas</th><th>Pendientes</th><th>Estado</th></tr></thead>
    <tbody>${sanctions.map(s=>{
      const imposed=Number(s.dates_imposed)||0;
      const served=Number(s.dates_served)||0;
      const remaining=Math.max(0,imposed-served);
      return `<tr>
        <td>${esc(s.player_name)}</td>
        <td>${clubLabel(s.club_id)}</td>
        <td>${esc(name(categories,s.category_id))}</td>
        <td>${esc(s.reason||s.notes||'—')}</td>
        <td class="n">${imposed}</td><td class="n">${served}</td><td class="n"><b>${remaining}</b></td>
        <td>${esc(s.status||'—')}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function render(){
  if($('#clubN'))$('#clubN').textContent=clubs.length;
  if($('#matchN'))$('#matchN').textContent=matches.filter(m=>m.home_goals!=null&&m.away_goals!=null).length;
  if($('#goalN'))$('#goalN').textContent=matches.reduce((s,m)=>s+(Number(m.home_goals)||0)+(Number(m.away_goals)||0),0);

  if($('#recent'))$('#recent').innerHTML=matches.filter(m=>m.home_goals!=null&&m.away_goals!=null).slice(0,5).map(matchView).join('')||'<p style="color:var(--muted)">Sin resultados todavía.</p>';
  if($('#fixtures'))$('#fixtures').innerHTML=matches.filter(m=>String(m.category_id)===String(selected)).map(matchView).join('')||'<p style="color:var(--muted)">Sin partidos cargados en esta categoría.</p>';

  if($('#announcements'))$('#announcements').innerHTML=announcements.map(a=>`<div style="margin-bottom:16px"><h3 style="margin-bottom:4px">${esc(a.title)}</h3><p style="margin:0; font-size:14px">${esc(a.body)}</p><small style="color:var(--muted)">${new Date(a.created_at).toLocaleDateString('es-AR')}</small></div>`).join('')||'<p style="color:var(--muted)">Sin comunicados.</p>';

  const standings=calculateStandings(selected);
  if($('#standings'))$('#standings').innerHTML=standings.map((x,i)=>`<tr><td>${i+1}</td><td>${clubLabel(x.id)}</td><td class="n"><b>${x.pts}</b></td>${['pj','pg','pe','pp','gf','gc'].map(k=>`<td class="n">${x[k]}</td>`).join('')}<td class="n">${x.gf-x.gc}</td></tr>`).join('');

  const grouped=new Map();
  scorers.filter(s=>String(s.category_id)===String(selected)).forEach(s=>{
    const key=JSON.stringify([String(s.player||'').trim().toLowerCase(),s.club_id]);
    const x=grouped.get(key)||{...s,goals:0};
    x.goals+=Number(s.goals)||0;
    grouped.set(key,x);
  });
  if($('#scorers'))$('#scorers').innerHTML=[...grouped.values()].sort((a,b)=>b.goals-a.goals).map(s=>`<tr><td>${esc(s.player)}</td><td>${clubLabel(s.club_id)}</td><td class="n">${s.goals}</td></tr>`).join('')||'<tr><td colspan="3">Sin goleadores cargados.</td></tr>';

  renderGeneral();
  renderFairPlay();
  renderSanctions();

  if($('#adminMatches'))$('#adminMatches').innerHTML=matches.map(m=>`<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border:1px solid var(--border); border-radius:10px; margin-bottom:8px;"><span style="font-size:13px"><b>${esc(name(categories,m.category_id))}</b> · ${esc(name(clubs,m.home_id))} ${m.home_goals??'—'}-${m.away_goals??'—'} ${esc(name(clubs,m.away_id))}</span><button class="alt" style="padding:6px 12px; font-size:12px" data-delete="matches" data-id="${m.id}">Eliminar</button></div>`).join('')||'<p style="color:var(--muted); font-size:13px">No hay partidos cargados.</p>';

  if($('#adminScorers'))$('#adminScorers').innerHTML=scorers.map(s=>`<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid var(--border); border-radius:8px; margin-bottom:6px;"><span style="font-size:13px">${esc(s.player)} (${esc(name(clubs,s.club_id))}) - ${s.goals} goles</span><button class="alt" style="padding:4px 10px; font-size:11px" data-delete="scorers" data-id="${s.id}">Eliminar</button></div>`).join('')||'';

  if($('#adminAnnouncements'))$('#adminAnnouncements').innerHTML=announcements.map(a=>`<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid var(--border); border-radius:8px; margin-bottom:6px;"><span style="font-size:13px"><b>${esc(a.title)}</b></span><button class="alt" style="padding:4px 10px; font-size:11px" data-delete="announcements" data-id="${a.id}">Eliminar</button></div>`).join('')||'';
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

    [clubs,categories,matches,scorers,announcements,cards,sanctions]=result.map(x=>x.data||[]);

    categories.sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
    matches.sort((a,b)=>String(b.match_date||'').localeCompare(String(a.match_date||''))||b.id-a.id);
    announcements.sort((a,b)=>String(b.created_at||'').localeCompare(String(a.created_at||'')));

    selected=categories.some(x=>String(x.id)===String(selected))?selected:categories[0]?.id;

    options('.categories',categories);
    options('.clubs',clubs);
    options('.filter',categories);
    $$('.filter').forEach(x=>x.value=selected??'');

    render();
    status('Información actualizada correctamente.');
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
  if($('#adminTab'))$('#adminTab').classList.toggle('hidden',!admin);
  if($('#loginToggle'))$('#loginToggle').textContent=admin?'Panel Administrador':'Acceso Administrador';
  if(!admin&&$('#admin')&&!$('#admin').classList.contains('hidden'))page('inicio');
  if(admin)await loadAdminDocuments();
}

$('#loginToggle')?.addEventListener('click',()=>page(admin?'admin':'login'));

$('#loginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!db)return;
  const {error}=await db.auth.signInWithPassword({email:$('#email').value,password:$('#password').value});
  $('#password').value='';
  if(error){status('Ingreso rechazado: '+error.message,true);return;}
  await authState();
  if(admin){page('admin');status('Sesión de administrador iniciada.');}
  else{await db.auth.signOut();status('La cuenta no tiene permisos de administrador.',true);}
});

$('#logout')?.addEventListener('click',async()=>{
  await db.auth.signOut();
  await authState();
  page('inicio');
  status('Sesión cerrada.');
});

$('#clubForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!admin)return;
  const nameVal = e.target.elements.name.value.trim();
  db.from('clubs').insert({name: nameVal}).then(({error})=>{
    if(error){status('Error: '+error.message,true);return;}
    e.target.reset(); load(); status('Club agregado con éxito.');
  });
});

$('#matchForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!admin)return;
  const rawData = Object.fromEntries(new FormData(e.target));

  const payload = {
    category_id: Number(rawData.category_id),
    round: rawData.round.trim(),
    match_date: rawData.match_date,
    home_id: Number(rawData.home_id),
    away_id: Number(rawData.away_id),
    home_goals: Number(rawData.home_goals),
    away_goals: Number(rawData.away_goals)
  };

  if(payload.home_id === payload.away_id){status('El local y visitante deben ser distintos.',true);return;}

  const {error}=await db.from('matches').insert(payload);
  if(error){status('Error: '+error.message,true);return;}
  e.target.reset(); load(); status('Resultado guardado correctamente.');
});

$('#scorerForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!admin)return;
  const fd = Object.fromEntries(new FormData(e.target));
  db.from('scorers').insert({player:fd.player.trim(), club_id:+fd.club_id, category_id:+fd.category_id, goals:+fd.goals}).then(({error})=>{
    if(error){status('Error: '+error.message,true);return;}
    e.target.reset(); load(); status('Goleador registrado.');
  });
});

$('#announcementForm')?.addEventListener('submit',e=>{
  e.preventDefault();
  if(!admin)return;
  const fd = Object.fromEntries(new FormData(e.target));
  db.from('announcements').insert({title:fd.title.trim(), body:fd.body.trim()}).then(({error})=>{
    if(error){status('Error: '+error.message,true);return;}
    e.target.reset(); load(); status('Comunicado publicado.');
  });
});

$('#admin')?.addEventListener('click',async e=>{
  const b=e.target.closest('[data-delete]');
  if(!b||!admin||!confirm('¿Eliminar este registro permanentemente?'))return;
  const {error}=await db.from(b.dataset.delete).delete().eq('id',Number(b.dataset.id));
  if(error)status(error.message,true);
  else load();
});

async function loadDocuments(){
  const box=$('#documentsList');
  if(!box||!db)return;
  box.innerHTML='<p>Cargando documentos...</p>';
  let query=db.from('official_documents').select('*').order('doc_date',{ascending:false});
  const filter=$('#documentType')?.value;
  if(filter)query=query.eq('doc_type',filter);
  const {data,error}=await query;
  if(error){box.innerHTML='<p>Error: '+esc(error.message)+'</p>';return;};
  if(!data||!data.length){box.innerHTML='<p>No hay documentos publicados.</p>';return;}

  const types={tribunal:'Tribunal de Disciplina', reglamento:'Reglamento', circular:'Circular oficial'};
  box.innerHTML=data.map(d=>{
    const file=db.storage.from('documentos-oficiales').getPublicUrl(d.file_path).data.publicUrl;
    return `
      <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; gap:12px; box-shadow:0 2px 6px rgba(0,0,0,.02)">
        <div>
          <h4 style="margin:0 0 4px; color:var(--navy)">${esc(d.title)}</h4>
          <p style="margin:0; font-size:12px; color:var(--muted)">${esc(types[d.doc_type]||d.doc_type)} · ${esc(d.doc_date||'—')}</p>
        </div>
        <a href="${esc(file)}" target="_blank" rel="noopener"><button type="button" style="padding:8px 14px; font-size:13px">Descargar PDF</button></a>
      </div>
    `;
  }).join('');
}
$('#documentType')?.addEventListener('change',loadDocuments);

$('#documentForm')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!admin){status('Sin permisos de administrador.',true);return;}
  const form=e.target;
  const file=form.elements.pdf.files[0];
  if(!file||file.type!=='application/pdf'){status('Seleccioná un archivo PDF válido.',true);return;}

  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${form.elements.doc_type.value}/${Date.now()}-${safeName}`;
  status('Subiendo PDF...');
  const {data:{user}}=await db.auth.getUser();
  const {error:uploadError}=await db.storage.from('documentos-oficiales').upload(path,file,{contentType:'application/pdf'});
  if(uploadError){status('Error al subir PDF: '+uploadError.message,true);return;}

  const {error:insertError}=await db.from('official_documents').insert({
    title:form.elements.title.value.trim(),
    doc_type:form.elements.doc_type.value,
    tournament:form.elements.tournament.value.trim()||null,
    doc_date:form.elements.doc_date.value,
    file_path:path,
    created_by:user.id
  });
  if(insertError){await db.storage.from('documentos-oficiales').remove([path]);status('Error: '+insertError.message,true);return;}
  form.reset(); status('Documento publicado con éxito.'); loadDocuments(); loadAdminDocuments();
});

async function loadAdminDocuments(){
  const box=$('#adminDocuments');
  if(!box||!admin||!db)return;
  const {data,error}=await db.from('official_documents').select('*').order('created_at',{ascending:false});
  if(error){box.innerHTML='<p>'+esc(error.message)+'</p>';return;}
  box.innerHTML=(data||[]).map(d=>`<div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:#f8fafc; border:1px solid var(--border); border-radius:8px; margin-bottom:6px;"><span style="font-size:13px">${esc(d.title)}</span><button class="alt" style="padding:4px 10px; font-size:11px" data-doc-delete="${d.id}">Eliminar</button></div>`).join('')||'<p style="color:var(--muted); font-size:13px">No hay documentos cargados.</p>';
}

$('#adminDocuments')?.addEventListener('click',async e=>{
  const button=e.target.closest('[data-doc-delete]');
  if(!button||!admin||!confirm('¿Eliminar este documento?'))return;
  const {data:doc}=await db.from('official_documents').select('file_path').eq('id',button.dataset.docDelete).single();
  if(doc) await db.storage.from('documentos-oficiales').remove([doc.file_path]);
  await db.from('official_documents').delete().eq('id',button.dataset.docDelete);
  status('Documento eliminado.'); loadDocuments(); loadAdminDocuments();
});

if(!ready){
  status('Falta configurar config.js con la URL y la clave pública de Supabase.',true);
}else{
  await authState();
  await load();
  await loadDocuments();
  db.auth.onAuthStateChange(()=>{setTimeout(async()=>{await authState();if(admin)await loadAdminDocuments();},0);});
}
