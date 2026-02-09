import{b as t}from"./browser-BnURzfs5.js";async function g(){console.log("[Safari Demo] Popup script loaded");const o=document.getElementById("app"),[n]=await t.tabs.query({active:!0,currentWindow:!0}),i=n?{title:n.title??"No title",url:n.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:u},{sessionId:a,loadedAt:p}]=await Promise.all([t.runtime.sendMessage({type:"getCount"}),t.runtime.sendMessage({type:"getSessionInfo"})]),m=a!=null?`${String(a).slice(0,8)}…`:"—";o.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${s(i.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${s(i.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${u??0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${s(m)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${s(p??"—")}</p>
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
  `;const c=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"incrementCount"});c(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"clearCount"});c(e)});const d=e=>{const r=document.getElementById("sessionId"),l=document.getElementById("loadedAt");r&&(r.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),l&&(l.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"getSessionInfo"});d(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"ping"});e?.pong&&d(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!n?.id){alert("No active tab");return}const e=await t.runtime.sendMessage({type:"pingContentScript",tabId:n.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),t.runtime.openOptionsPage()})}function s(o){const n=document.createElement("div");return n.textContent=o,n.innerHTML}g();
