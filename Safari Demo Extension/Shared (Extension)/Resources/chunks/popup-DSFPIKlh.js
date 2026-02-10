import{b as t}from"./browser-BnURzfs5.js";async function y(){console.log("safari-demo:popup: Popup script loaded");const o=document.getElementById("app"),[n]=await t.tabs.query({active:!0,currentWindow:!0}),d=n?{title:n.title??"No title",url:n.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:g},{sessionId:r,loadedAt:m},f]=await Promise.all([t.runtime.sendMessage({type:"getCount"}),t.runtime.sendMessage({type:"getSessionInfo"}),t.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null}))]),h=r!=null?`${String(r).slice(0,8)}…`:"—",i=f?.pdfUrl??null,b=i!=null?`<a class="value url" id="sharedPdfLink" href="${s(i)}" target="_blank" rel="noopener">${s(i)}</a>`:'<p class="value" id="sharedPdfLink">—</p>';o.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared PDF</h2>
        <p class="label">Uploaded PDF URL:</p>
        ${b}
        <div class="button-row">
          <button id="refreshSharedFile">Refresh</button>
          <button id="clearSharedFile">Clear URL</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${s(d.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${s(d.url)}</p>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count: <strong id="count">${g??0}</strong></p>
        <div class="button-row">
          <button id="increment">Increment</button>
          <button id="clear">Clear</button>
        </div>
      </section>
      <section>
        <h2>Background Session</h2>
        <p class="label">Session ID:</p>
        <p class="value debug" id="sessionId">${s(h)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${s(m??"—")}</p>
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
  `;const l=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"incrementCount"});l(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await t.runtime.sendMessage({type:"clearCount"});l(e)});const c=e=>{const a=document.getElementById("sessionId"),p=document.getElementById("loadedAt");a&&(a.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),p&&(p.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"getSessionInfo"});c(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"ping"});e?.pong&&c(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!n?.id){alert("No active tab");return}const e=await t.runtime.sendMessage({type:"pingContentScript",tabId:n.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),t.runtime.openOptionsPage()});const u=e=>{const a=document.getElementById("sharedPdfLink");a&&(e?a.outerHTML=`<a class="value url" id="sharedPdfLink" href="${s(e)}" target="_blank" rel="noopener">${s(e)}</a>`:a.outerHTML='<p class="value" id="sharedPdfLink">—</p>')};document.getElementById("refreshSharedFile")?.addEventListener("click",async()=>{const e=await t.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null}));u(e?.pdfUrl??null)}),document.getElementById("clearSharedFile")?.addEventListener("click",async()=>{(await t.runtime.sendMessage({type:"clearSharedFile"}).catch(()=>({ok:!1})))?.ok!==!1&&u(null)})}function s(o){const n=document.createElement("div");return n.textContent=o,n.innerHTML}y();
