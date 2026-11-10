(() => {
  'use strict';
  const screens=window.DESIGN_SCREENS;
  const byId=new Map(screens.map(s=>[s.id,s]));
  const frame=document.getElementById('screen-frame');
  const theme=document.getElementById('theme'),accent=document.getElementById('accent'),state=document.getElementById('state');
  const colors={Blue:['#1d4ed8','#60a5fa'],Indigo:['#4338ca','#a5b4fc'],Purple:['#7e22ce','#c084fc'],Pink:['#be185d','#f9a8d4'],Red:['#b91c1c','#fca5a5'],Orange:['#c2410c','#fdba74'],Amber:['#92400e','#fcd34d'],Green:['#15803d','#86efac'],Teal:['#0f766e','#5eead4'],Slate:['#475569','#cbd5e1']};
  accent.innerHTML=Object.keys(colors).map(c=>`<option>${c}</option>`).join('');
  const groups=[...new Set(screens.map(s=>s.group))];
  document.getElementById('screen-nav').innerHTML=groups.map(group=>`<div class="gallery-section">${group}</div>${screens.filter(s=>s.group===group).map(s=>`<a class="gallery-link" href="#${s.id}" data-id="${s.id}"><span class="ordinal">${s.id.slice(0,2)}</span>${s.name}</a>`).join('')}`).join('');
  let selected=byId.has(location.hash.slice(1))?location.hash.slice(1):'03-home';
  let currentState='default';
  function skin(){const dark=theme.value==='dark'||(theme.value==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=dark?'dark':'light';const c=colors[accent.value][dark?1:0];document.documentElement.style.setProperty('--accent',c);document.documentElement.style.setProperty('--accent-soft',`color-mix(in srgb, ${c} ${dark?'12':'8'}%, ${dark?'#151c28':'#ffffff'})`);}
  function updateInfo(){const s=byId.get(selected),idx=screens.indexOf(s);document.getElementById('screen-title').textContent=s.name;document.getElementById('screen-surface').textContent=s.surface;document.getElementById('screen-progress').textContent=`${idx+1} of ${screens.length}`;document.getElementById('previous').disabled=idx===0;document.getElementById('next').disabled=idx===screens.length-1;state.innerHTML=s.states.map(v=>`<option value="${v}" ${v===currentState?'selected':''}>${v==='default'?'Default':v.replaceAll('-',' ')}</option>`).join('');document.getElementById('notes-link').href=`${s.id}/design.md`;document.getElementById('standalone-link').href=`${s.id}/index.html?state=${currentState}&theme=${theme.value}&accent=${accent.value}`;document.querySelectorAll('[data-id]').forEach(a=>a.classList.toggle('active',a.dataset.id===selected));history.replaceState(null,'',`#${selected}`);}
  function open(id,variant='default'){if(!byId.has(id))return;selected=id;currentState=variant;updateInfo();frame.src=`${id}/index.html?embed=1&state=${variant}&theme=${theme.value}&accent=${accent.value}`;}
  function settings(){skin();frame.contentWindow.postMessage({type:'design-settings',theme:theme.value,accent:accent.value,state:state.value},'*');currentState=state.value;updateInfo();}
  document.querySelectorAll('[data-id]').forEach(a=>a.addEventListener('click',event=>{event.preventDefault();open(a.dataset.id);}));
  document.getElementById('previous').addEventListener('click',()=>open(screens[screens.findIndex(s=>s.id===selected)-1].id));
  document.getElementById('next').addEventListener('click',()=>open(screens[screens.findIndex(s=>s.id===selected)+1].id));
  theme.addEventListener('change',settings);accent.addEventListener('change',settings);state.addEventListener('change',settings);
  document.getElementById('width').addEventListener('change',event=>{frame.style.width=event.target.value==='fluid'?'100%':`${event.target.value}px`;document.getElementById('stage').style.justifyContent=event.target.value==='fluid'||Number(event.target.value)<document.getElementById('stage').clientWidth?'center':'flex-start';});
  window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(next!==selected&&byId.has(next))open(next);});
  window.addEventListener('message',event=>{if(event.source!==frame.contentWindow||event.data?.type!=='design-screen')return;const d=event.data;if(!byId.has(d.id))return;selected=d.id;currentState=d.state;if(d.theme)theme.value=d.theme;if(d.accent)accent.value=d.accent;skin();updateInfo();});
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',skin);
  skin();open(selected);
})();
