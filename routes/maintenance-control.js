<!-- À ajouter à la fin du <script> de admin-gerant.html, avant la dernière fermeture -->

/* ═══════ CONTRÔLE MAINTENANCE ═══════ */
(function(){
  // Ajouter un bouton maintenance en haut du dashboard
  setTimeout(()=>{
    const dashboard = document.querySelector('div[class*="dash"]');
    if(!dashboard) return;
    
    const maintBtn = document.createElement('button');
    maintBtn.className = 'btn btn-soft';
    maintBtn.textContent = '🔧 Maintenance';
    maintBtn.style.cssText = 'margin-bottom:1rem;width:100%;';
    maintBtn.onclick = toggleMaintenancePanel;
    
    // Injecter le bouton après le titre
    const title = document.querySelector('h1');
    if(title && title.parentElement) {
      title.parentElement.insertBefore(maintBtn, title.nextSibling);
    }
  }, 500);
})();

function toggleMaintenancePanel(){
  let panel = document.getElementById('maintenancePanel');
  if(panel){ panel.remove(); return; }
  
  panel = document.createElement('div');
  panel.id = 'maintenancePanel';
  panel.style.cssText = `
    background:var(--cream);border:2px solid var(--gold);border-radius:12px;
    padding:1.5rem;margin:1rem 0;max-width:550px;
  `;
  
  const mainStatus = checkMaintenanceStatus();
  const withInscription = localStorage.getItem('maintenanceWithInscription') === 'true';
  
  panel.innerHTML = `
    <h3 style="color:var(--green-deep);margin-bottom:1rem;font-size:1.3rem;">🔧 Maintenance du site</h3>
    <div id="mainStatus" style="font-size:0.9rem;margin-bottom:1rem;padding:0.8rem;background:#fff;border-radius:8px;border-left:4px solid ${mainStatus.active?'var(--gold)':'var(--green)'};">
      ${mainStatus.active 
        ? `<strong style="color:var(--gold);">🟡 Site en maintenance</strong><br><small>Retour prévu à : ${mainStatus.returnTime}</small><br><small>${withInscription ? '✅ Avec bouton inscription' : '❌ Sans bouton inscription'}</small>`
        : `<strong style="color:var(--green);">🟢 Site actif</strong>`
      }
    </div>
    
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
      <button class="btn btn-bad" onclick="activateMaintenance(true)" style="flex:1;font-size:0.85rem;">🔧 Maintenance<br><small>AVEC inscription</small></button>
      <button class="btn btn-orange" onclick="activateMaintenance(false)" style="flex:1;font-size:0.85rem;background:#D97706;">🔧 Maintenance<br><small>SANS inscription</small></button>
      <button class="btn btn-green" onclick="deactivateMaintenance()" style="flex:1;">Désactiver</button>
    </div>
    
    <div style="margin-top:1rem;">
      <label style="font-size:0.8rem;color:var(--text-muted);font-weight:700;">Retour prévu à :</label>
      <div style="display:flex;gap:0.5rem;margin-top:0.5rem;">
        <input type="time" id="mainTime" value="${new Date().toTimeString().slice(0,5)}" 
          style="flex:1;padding:0.7rem;border:1px solid var(--beige);border-radius:8px;font-family:inherit;font-size:0.95rem;">
        <button class="btn btn-gold" onclick="updateMaintenanceTime()" style="padding:0.7rem 1.2rem;white-space:nowrap;">Mettre à jour</button>
      </div>
    </div>
  `;
  
  const dashboard = document.querySelector('[class*="dash"]') || document.body;
  dashboard.insertBefore(panel, dashboard.firstChild);
}

function checkMaintenanceStatus(){
  const endTime = localStorage.getItem('maintenanceUntil');
  if(!endTime) return { active: false };
  
  const now = new Date().getTime();
  const end = parseInt(endTime);
  const active = end > now;
  
  if(!active) return { active: false };
  
  const date = new Date(end);
  const h = String(date.getHours()).padStart(2,'0');
  const m = String(date.getMinutes()).padStart(2,'0');
  return { active: true, returnTime: h + ':' + m };
}

function activateMaintenance(withInscription){
  const time = document.getElementById('mainTime');
  if(!time) return;
  
  const [h, m] = time.value.split(':').map(Number);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  
  // Si l'heure est déjà passée aujourd'hui, prendre demain
  if(end <= now) end.setDate(end.getDate() + 1);
  
  localStorage.setItem('maintenanceUntil', end.getTime());
  localStorage.setItem('maintenanceWithInscription', withInscription ? 'true' : 'false');
  
  const mode = withInscription ? 'AVEC inscription' : 'SANS inscription';
  toast('✅ Maintenance activée ' + mode);
  toggleMaintenancePanel();
}

function deactivateMaintenance(){
  localStorage.removeItem('maintenanceUntil');
  toast('✅ Maintenance désactivée — site actif');
  toggleMaintenancePanel();
}

function updateMaintenanceTime(){
  const status = checkMaintenanceStatus();
  if(!status.active){ toast('⚠️ Activez la maintenance d\'abord'); return; }
  
  const time = document.getElementById('mainTime');
  if(!time) return;
  
  const [h, m] = time.value.split(':').map(Number);
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
  
  if(end <= now) end.setDate(end.getDate() + 1);
  
  localStorage.setItem('maintenanceUntil', end.getTime());
  toast('✅ Heure de retour mise à jour : ' + h + ':' + m);
  toggleMaintenancePanel();
}
