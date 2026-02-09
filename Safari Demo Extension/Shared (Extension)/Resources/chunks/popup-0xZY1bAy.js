import{b as n}from"./browser-BnURzfs5.js";async function $(){console.log("[Safari Demo] Popup script loaded");const s=document.getElementById("app"),[t]=await n.tabs.query({active:!0,currentWindow:!0}),l=t?{title:t.title??"No title",url:t.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:d},{sessionId:u,loadedAt:f},c]=await Promise.all([n.runtime.sendMessage({type:"getCount"}),n.runtime.sendMessage({type:"getSessionInfo"}),n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({name:null,size:0}))]),I=u!=null?`${String(u).slice(0,8)}…`:"—",m=c?.name??null,B=c?.size??0,p=c?.text??null,g=c?.imageDataBase64??null,E=m?`${a(m)} (${b(B)})`:"—",v=p!=null?`<p class="label">Shared text:</p><p class="value shared-text" id="sharedText">${a(p)}</p>`:"",S=g!=null?`<p class="label">Shared image:</p><img class="shared-image" id="sharedImage" src="data:image/jpeg;base64,${g}" alt="Shared" />`:"";s.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared File / Text / Image</h2>
        <p class="label">Last shared:</p>
        <p class="value" id="sharedFile">${E}</p>
        ${v}
        ${S}
        <div class="button-row">
          <button id="refreshSharedFile">Refresh</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${a(l.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${a(l.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${d??0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${a(I)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${a(f??"—")}</p>
        <div class="button-row">
          <button id="refreshSession">Refresh</button>
          <button id="pingBackground">Ping background</button>
          <button id="notifyTab">Notify current tab</button>
        </div>
      </section>
      <section>
        <a href="#" id="options">Open Options</a>
      </section>
    </div>
  `;const h=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"incrementCount"});h(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"clearCount"});h(e)});const y=e=>{const i=document.getElementById("sessionId"),o=document.getElementById("loadedAt");i&&(i.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),o&&(o.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSessionInfo"});y(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"ping"});e?.pong&&y(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!t?.id){alert("No active tab");return}const e=await n.runtime.sendMessage({type:"pingContentScript",tabId:t.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),n.runtime.openOptionsPage()}),document.getElementById("refreshSharedFile")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({name:null,size:0,text:null,imageDataBase64:null})),i=document.getElementById("sharedFile");i&&(i.textContent=e?.name?`${e.name} (${b(e.size??0)})`:"—");const o=document.getElementById("sharedText");o&&(o.textContent=e?.text??"—");const r=document.getElementById("sharedImage");r&&(e?.imageDataBase64?(r.src=`data:image/jpeg;base64,${e.imageDataBase64}`,r.style.display=""):r.style.display="none")})}function b(s){if(s===0)return"0 B";const t=1024,l=["B","KB","MB","GB"],d=Math.floor(Math.log(s)/Math.log(t));return`${(s/Math.pow(t,d)).toFixed(1)} ${l[d]}`}function a(s){const t=document.createElement("div");return t.textContent=s,t.innerHTML}$();
