import{b as n}from"./browser-BnURzfs5.js";async function v(){console.log("[Safari Demo] Popup script loaded");const s=document.getElementById("app"),[t]=await n.tabs.query({active:!0,currentWindow:!0}),a=t?{title:t.title??"No title",url:t.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:c},{sessionId:d,loadedAt:h},r]=await Promise.all([n.runtime.sendMessage({type:"getCount"}),n.runtime.sendMessage({type:"getSessionInfo"}),n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({name:null,size:0}))]),y=d!=null?`${String(d).slice(0,8)}…`:"—",l=r?.name??null,b=r?.size??0,f=l?`${i(l)} (${g(b)})`:"—";s.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared File</h2>
        <p class="label">Last shared:</p>
        <p class="value" id="sharedFile">${f}</p>
        <div class="button-row">
          <button id="refreshSharedFile">Refresh</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${i(a.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${i(a.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${c??0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${i(y)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${i(h??"—")}</p>
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
  `;const u=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"incrementCount"});u(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"clearCount"});u(e)});const p=e=>{const o=document.getElementById("sessionId"),m=document.getElementById("loadedAt");o&&(o.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),m&&(m.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSessionInfo"});p(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"ping"});e?.pong&&p(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!t?.id){alert("No active tab");return}const e=await n.runtime.sendMessage({type:"pingContentScript",tabId:t.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),n.runtime.openOptionsPage()}),document.getElementById("refreshSharedFile")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({name:null,size:0})),o=document.getElementById("sharedFile");o&&(o.textContent=e?.name?`${e.name} (${g(e.size??0)})`:"—")})}function g(s){if(s===0)return"0 B";const t=1024,a=["B","KB","MB","GB"],c=Math.floor(Math.log(s)/Math.log(t));return`${(s/Math.pow(t,c)).toFixed(1)} ${a[c]}`}function i(s){const t=document.createElement("div");return t.textContent=s,t.innerHTML}v();
