(() => {
  const cfg = window.FISHLOG_CONFIG || {};
  const configured = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.startsWith("YOUR_") &&
                     cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.startsWith("YOUR_");
  const $ = id => document.getElementById(id);
  const state = { client:null, user:null, catches:[], photoFile:null, photoUrl:null, authMode:"signin", view:"catches" };
  const today = new Date().toISOString().slice(0,10);
  $("date-input").value = today;
  $("today-label").textContent = new Intl.DateTimeFormat(undefined,{weekday:"long",month:"long",day:"numeric"}).format(new Date()).toUpperCase();

  function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
  function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
  function showAuth(message=""){ $("auth-view").hidden=false;$("journal-view").hidden=true;$("stats-view").hidden=true;$("auth-message").textContent=message || "Your catches are private to your account."; }
  function showApp(){ $("auth-view").hidden=true;$("journal-view").hidden=state.view!=="catches";$("stats-view").hidden=state.view!=="stats";$("signout-btn").hidden=false;$("user-email").textContent=state.user.email;$("user-avatar").textContent=(state.user.email||"F")[0].toUpperCase(); }
  function setAuthMode(mode){state.authMode=mode;document.querySelectorAll(".auth-tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));$("auth-heading").textContent=mode==="signin"?"Welcome back":"Create your account";$("auth-subtitle").textContent=mode==="signin"?"Sign in to open your fishing journal.":"Start saving your fishing memories."; $("auth-submit").innerHTML=mode==="signin"?'Sign in <span>→</span>':'Create account <span>→</span>'; $("auth-password").autocomplete=mode==="signin"?"current-password":"new-password";$("auth-message").textContent="Your catches are private to your account."}
  async function init(){
    if(!configured || !window.supabase){showAuth("Setup needed: add your Supabase URL and anon key in config.js, then refresh.");return}
    state.client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    const {data:{session}}=await state.client.auth.getSession();
    if(session){state.user=session.user;await loadCatches()}else showAuth();
    state.client.auth.onAuthStateChange(async(_event,session)=>{if(session){state.user=session.user;await loadCatches()}else{state.user=null;state.catches=[];showAuth()}});
  }
  async function loadCatches(){
    const {data,error}=await state.client.from("catches").select("*").order("caught_on",{ascending:false});
    if(error){toast("Couldn't load catches: "+error.message);return}
    state.catches=data||[];showApp();render();
  }
  async function authSubmit(e){
    e.preventDefault();if(!state.client)return;
    const email=$("auth-email").value.trim(),password=$("auth-password").value;
    $("auth-submit").disabled=true;
    try{
      if(state.authMode==="signup"){
        const {data,error}=await state.client.auth.signUp({email,password});
        if(error)throw error;
        if(data.session){toast("Account created!");}else{$("auth-message").textContent="Check your email for a confirmation link, then sign in."}
      }else{const {error}=await state.client.auth.signInWithPassword({email,password});if(error)throw error;toast("Welcome back!")}
    }catch(err){$("auth-message").textContent=err.message}finally{$("auth-submit").disabled=false}
  }
  function formatMeasure(value,unit){return value===null||value===undefined||value===""?"—":`${Number(value).toLocaleString(undefined,{maximumFractionDigits:2})} ${unit}`}
  function render(){
    const catches=state.catches;
    $("total-catches").textContent=catches.length;
    const weighted=catches.filter(c=>c.weight_value!==null&&c.weight_value!==undefined);
    const longest=catches.filter(c=>c.length_value!==null&&c.length_value!==undefined);
    const heavy=weighted.sort((a,b)=>toPounds(b.weight_value,b.weight_unit)-toPounds(a.weight_value,a.weight_unit))[0];
    const long=longest.sort((a,b)=>toInches(b.length_value,b.length_unit)-toInches(a.length_value,a.length_unit))[0];
    $("heaviest-catch").textContent=heavy?formatMeasure(heavy.weight_value,heavy.weight_unit):"—";$("heaviest-species").textContent=heavy?heavy.species:"Add a weight to track it";
    $("longest-catch").textContent=long?formatMeasure(long.length_value,long.length_unit):"—";$("longest-species").textContent=long?long.species:"Add a length to track it";
    const species=[...new Set(catches.map(c=>c.species).filter(Boolean))].sort((a,b)=>a.localeCompare(b));$("species-count").textContent=species.length;
    const filter=$("species-filter"),previous=filter.value;filter.innerHTML='<option value="">All species</option>'+species.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");filter.value=species.includes(previous)?previous:"";
    let visible=catches.filter(c=>(!filter.value||c.species===filter.value));
    const q=$("search-input").value.toLowerCase();visible=visible.filter(c=>[c.species,c.location,c.notes,c.bait].join(" ").toLowerCase().includes(q));
    const sort=$("sort-select").value;
    const sortFn={newest:(a,b)=>b.caught_on.localeCompare(a.caught_on),oldest:(a,b)=>a.caught_on.localeCompare(b.caught_on),species:(a,b)=>a.species.localeCompare(b.species),"weight-desc":(a,b)=>toPounds(b.weight_value,b.weight_unit)-toPounds(a.weight_value,a.weight_unit),"weight-asc":(a,b)=>toPounds(a.weight_value,a.weight_unit)-toPounds(b.weight_value,b.weight_unit),"length-desc":(a,b)=>toInches(b.length_value,b.length_unit)-toInches(a.length_value,a.length_unit),"length-asc":(a,b)=>toInches(a.length_value,a.length_unit)-toInches(b.length_value,b.length_unit)}[sort];
    visible.sort(sortFn);
    $("catch-count").textContent=visible.length;$("catch-grid").innerHTML=visible.map(cardHtml).join("");
    $("empty-state").hidden=visible.length>0;
    $("stats-total").textContent=catches.length;$("stats-species").textContent=species.length;
    const totalLb=weighted.reduce((sum,c)=>sum+toPounds(c.weight_value,c.weight_unit),0);$("stats-weight").textContent=weighted.length?`${totalLb.toFixed(2)} lb`:"—";
    const counts=species.map(s=>({s,n:catches.filter(c=>c.species===s).length})).sort((a,b)=>b.n-a.n);
    $("species-breakdown").innerHTML=counts.length?counts.map(x=>`<div class="break-row"><strong>${escapeHtml(x.s)}</strong><div class="break-track"><div class="break-fill" style="width:${Math.max(4,x.n/catches.length*100)}%"></div></div><span class="break-num">${x.n}</span></div>`).join(""):'<p class="muted">Your species breakdown will appear here once you log some catches.</p>';
  }
  function toPounds(v,u){if(v===null||v===undefined)return -1;return Number(v)*(u==="kg"?2.20462:u==="oz"?1/16:1)}
  function toInches(v,u){if(v===null||v===undefined)return -1;return Number(v)*(u==="cm"?1/2.54:1)}
  function cardHtml(c){
    const date=new Date(c.caught_on+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
    const photo=c.photo_url?`<img src="${escapeHtml(c.photo_url)}" alt="${escapeHtml(c.species)}">`:"🐟";
    return `<article class="catch-card"><div class="catch-photo">${photo}<span class="catch-date">${date}</span></div><div class="catch-body"><div class="catch-title-row"><div><h3 class="catch-title">${escapeHtml(c.species)}</h3><div class="catch-location">${escapeHtml(c.location||"Location not added")}</div></div></div><div class="catch-metrics"><span class="metric">↔ <b>${formatMeasure(c.length_value,c.length_unit)}</b></span><span class="metric">⚖ <b>${formatMeasure(c.weight_value,c.weight_unit)}</b></span></div><div class="catch-notes">${escapeHtml([c.bait,c.notes].filter(Boolean).join(" · ")||"No notes added")}</div><div class="card-actions"><button class="small-action delete" data-delete="${c.id}">Delete</button></div></div></article>`;
  }
  function openModal(){if(!state.user){showAuth("Sign in or create an account before saving catches.");return} $("catch-modal").hidden=false;$("form-error").textContent=""}
  function closeModal(){ $("catch-modal").hidden=true;$("catch-form").reset();$("date-input").value=today;state.photoFile=null;state.photoUrl=null;$("photo-preview").hidden=true;$("photo-placeholder").hidden=false;$("remove-photo").hidden=true;$("identify-btn").disabled=true;$("ai-status").textContent="Upload a photo, then let AI suggest the species."}
  function setPhoto(file){
    if(!file)return;if(!file.type.startsWith("image/")){toast("Please choose an image file.");return}
    state.photoFile=file;const url=URL.createObjectURL(file);$("photo-preview").src=url;$("photo-preview").hidden=false;$("photo-placeholder").hidden=true;$("remove-photo").hidden=false;$("identify-btn").disabled=false;$("ai-status").textContent="Photo ready. Ask AI to identify the fish.";
  }
  async function identify(){
    if(!state.photoFile)return;
    $("identify-btn").disabled=true;$("identify-btn").textContent="Identifying…";$("ai-status").textContent="AI is examining your photo…";
    try{
      const ext=(state.photoFile.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
      const path=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
      const {error:upErr}=await state.client.storage.from("catch-photos").upload(path,state.photoFile,{upsert:false,contentType:state.photoFile.type});
      if(upErr)throw upErr;
      state.photoPath=path;
      const {data:signed,error:signedErr}=await state.client.storage.from("catch-photos").createSignedUrl(path,600);
      if(signedErr)throw signedErr;
      const {data,error}=await state.client.functions.invoke("fish-identify",{body:{image_url:signed.signedUrl}});
      if(error)throw error;
      $("species-input").value=data.species||"";
      $("ai-status").textContent=`AI suggestion: ${data.species||"No clear match"}${data.confidence?` · ${data.confidence} confidence`:""}. ${data.notes||"Review the result before saving."}`;
      toast("Identification complete — review the suggestion.");
    }catch(err){$("ai-status").textContent="AI identification failed: "+err.message;$("form-error").textContent="You can still enter the species manually and save your catch.";toast("AI identification unavailable")}
    finally{$("identify-btn").disabled=false;$("identify-btn").textContent="✦ Identify fish"}
  }
  async function saveCatch(e){
    e.preventDefault();$("form-error").textContent="";if(!state.user)return;
    const species=$("species-input").value.trim();if(!species){$("form-error").textContent="Please enter a species name.";return}
    $("save-catch-btn").disabled=true;$("save-catch-btn").textContent="Saving…";
    try{
      let photoPath=state.photoPath||null,photoUrl=null;
      if(state.photoFile&&!photoPath){
        const ext=(state.photoFile.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
        photoPath=`${state.user.id}/${crypto.randomUUID()}.${ext}`;
        const {error}=await state.client.storage.from("catch-photos").upload(photoPath,state.photoFile,{contentType:state.photoFile.type});
        if(error)throw error;
      }
      if(photoPath){const {data,error}=await state.client.storage.from("catch-photos").createSignedUrl(photoPath,60*60*24*365);if(error)throw error;photoUrl=data.signedUrl}
      const length=$("length-input").value,weight=$("weight-input").value;
      const row={user_id:state.user.id,species,caught_on:$("date-input").value,location:$("location-input").value.trim()||null,bait:$("bait-input").value.trim()||null,notes:$("notes-input").value.trim()||null,length_value:length?Number(length):null,length_unit:$("length-unit").value,weight_value:weight?Number(weight):null,weight_unit:$("weight-unit").value,photo_path:photoPath,photo_url:photoUrl};
      const {error}=await state.client.from("catches").insert(row);if(error)throw error;
      closeModal();await loadCatches();toast("Catch saved to your journal!");
    }catch(err){$("form-error").textContent=err.message}
    finally{$("save-catch-btn").disabled=false;$("save-catch-btn").innerHTML='Save catch <span>→</span>'}
  }
  async function deleteCatch(id){
    if(!confirm("Delete this catch from your journal?"))return;
    const c=state.catches.find(x=>x.id===id);
    const {error}=await state.client.from("catches").delete().eq("id",id);
    if(error){toast(error.message);return}
    if(c?.photo_path)await state.client.storage.from("catch-photos").remove([c.photo_path]);
    await loadCatches();toast("Catch deleted.");
  }
  function setView(view){state.view=view;$("page-title").textContent=view==="stats"?"Statistics":"My catches";document.querySelectorAll(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.view===view));if(state.user)showApp()}
  $("auth-form").addEventListener("submit",authSubmit);
  document.querySelectorAll(".auth-tab").forEach(b=>b.addEventListener("click",()=>setAuthMode(b.dataset.auth)));
  $("signout-btn").addEventListener("click",()=>state.client.auth.signOut());
  $("add-catch-btn").addEventListener("click",openModal);$("empty-add-btn").addEventListener("click",openModal);
  $("close-modal").addEventListener("click",closeModal);$("cancel-modal").addEventListener("click",closeModal);
  $("catch-modal").addEventListener("click",e=>{if(e.target===$("catch-modal"))closeModal()});
  $("upload-zone").addEventListener("click",e=>{if(e.target.id!=="remove-photo")$("fish-photo").click()});
  $("fish-photo").addEventListener("change",e=>setPhoto(e.target.files[0]));
  $("remove-photo").addEventListener("click",e=>{e.stopPropagation();state.photoFile=null;state.photoPath=null;$("photo-preview").hidden=true;$("photo-placeholder").hidden=false;$("remove-photo").hidden=true;$("identify-btn").disabled=true});
  $("upload-zone").addEventListener("dragover",e=>{e.preventDefault();$("upload-zone").style.borderColor="#3b8a7c"});
  $("upload-zone").addEventListener("drop",e=>{e.preventDefault();setPhoto(e.dataTransfer.files[0])});
  $("identify-btn").addEventListener("click",identify);$("catch-form").addEventListener("submit",saveCatch);
  $("search-input").addEventListener("input",render);$("species-filter").addEventListener("change",render);$("sort-select").addEventListener("change",render);
  $("clear-filters").addEventListener("click",()=>{$("search-input").value="";$("species-filter").value="";$("sort-select").value="newest";render()});
  $("catch-grid").addEventListener("click",e=>{const id=e.target.dataset.delete;if(id)deleteCatch(id)});
  document.querySelectorAll(".nav-item").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.view)));
  setAuthMode("signin");init();
})();
