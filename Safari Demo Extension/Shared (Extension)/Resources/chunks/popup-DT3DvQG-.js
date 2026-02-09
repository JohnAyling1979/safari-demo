import{b as t}from"./browser-BnURzfs5.js";async function h(){console.log("[Safari Demo] Popup script loaded");const i=document.getElementById("app"),[n]=await t.tabs.query({active:!0,currentWindow:!0}),r=n?{title:n.title??"No title",url:n.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:p},{sessionId:l,loadedAt:g},m]=await Promise.all([t.runtime.sendMessage({type:"getCount"}),t.runtime.sendMessage({type:"getSessionInfo"}),t.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null}))]),f=l!=null?`${String(l).slice(0,8)}…`:"—",d=m?.pdfUrl??null,b=d!=null?`<a class="value url" id="sharedPdfLink" href="${s(d)}" target="_blank" rel="noopener">${s(d)}</a>`:'<p class="value" id="sharedPdfLink">—</p>';i.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared PDF</h2>
        <p class="label">Uploaded PDF URL:</p>
        ${b}
        <div class="button-row">
          <button id="refreshSharedFile">Refresh</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${s(r.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${s(r.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${p??0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${s(f)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${s(g??"—")}</p>
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
  `;const c=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"incrementCount"});c(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"clearCount"});c(e)});const u=e=>{const o=document.getElementById("sessionId"),a=document.getElementById("loadedAt");o&&(o.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),a&&(a.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"getSessionInfo"});u(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"ping"});e?.pong&&u(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!n?.id){alert("No active tab");return}const e=await t.runtime.sendMessage({type:"pingContentScript",tabId:n.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),t.runtime.openOptionsPage()}),document.getElementById("refreshSharedFile")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null})),o=document.getElementById("sharedPdfLink");if(o){const a=e?.pdfUrl??null;a?o.outerHTML=`<a class="value url" id="sharedPdfLink" href="${s(a)}" target="_blank" rel="noopener">${s(a)}</a>`:o.outerHTML='<p class="value" id="sharedPdfLink">—</p>'}})}function s(i){const n=document.createElement("div");return n.textContent=i,n.innerHTML}h();
