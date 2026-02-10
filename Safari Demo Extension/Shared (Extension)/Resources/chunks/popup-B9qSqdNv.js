import{b as n}from"./browser-BnURzfs5.js";async function v(){console.log("safari-demo:popup: Popup script loaded");const o=document.getElementById("app"),[s]=await n.tabs.query({active:!0,currentWindow:!0}),i=s?{title:s.title??"No title",url:s.url??"No URL"}:{title:"N/A",url:"N/A"},[{count:g},{sessionId:l,loadedAt:m},b]=await Promise.all([n.runtime.sendMessage({type:"getCount"}),n.runtime.sendMessage({type:"getSessionInfo"}),n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null}))]),y=l!=null?`${String(l).slice(0,8)}…`:"—",d=b?.pdfUrl??null,h=d!=null?`<a class="value url" id="sharedPdfLink" href="${a(d)}" target="_blank" rel="noopener">${a(d)}</a>`:'<p class="value" id="sharedPdfLink">—</p>',c=(e=>{if(!e)return!1;try{return new URL(e).pathname.toLowerCase().endsWith(".pdf")}catch{return e.toLowerCase().endsWith(".pdf")}})(s?.url);o.innerHTML=`
    <div class="popup">
      <h1>Safari Demo</h1>
      <section>
        <h2>Shared PDF</h2>
        <p class="label">Uploaded PDF URL:</p>
        ${h}
        <div class="button-row">
          <button id="uploadCurrentPdf" ${c?"":"disabled"}>Upload current PDF</button>
          <button id="refreshSharedFile">Refresh</button>
          <button id="clearSharedFile">Clear URL</button>
        </div>
      </section>
      <section>
        <h2>Current Tab</h2>
        <p class="label">Title:</p>
        <p class="value">${a(i.title)}</p>
        <p class="label">URL:</p>
        <p class="value url">${a(i.url)}</p>
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
        <p class="value debug" id="sessionId">${a(y)}</p>
        <p class="label">Loaded at:</p>
        <p class="value debug" id="loadedAt">${a(m??"—")}</p>
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
  `;const u=e=>{document.getElementById("count").textContent=String(e??0)};document.getElementById("increment")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"incrementCount"});u(e)}),document.getElementById("clear")?.addEventListener("click",async()=>{const{count:e}=await n.runtime.sendMessage({type:"clearCount"});u(e)});const p=e=>{const t=document.getElementById("sessionId"),f=document.getElementById("loadedAt");t&&(t.textContent=e.sessionId!=null?`${String(e.sessionId).slice(0,8)}…`:"—"),f&&(f.textContent=e.loadedAt??"—")};document.getElementById("refreshSession")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSessionInfo"});p(e)}),document.getElementById("pingBackground")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"ping"});e?.pong&&p(e)}),document.getElementById("notifyTab")?.addEventListener("click",async()=>{if(!s?.id){alert("No active tab");return}const e=await n.runtime.sendMessage({type:"pingContentScript",tabId:s.id});e?.error&&alert(`Error: ${e.error}`)}),document.getElementById("options")?.addEventListener("click",e=>{e.preventDefault(),n.runtime.openOptionsPage()});const r=e=>{const t=document.getElementById("sharedPdfLink");t&&(e?t.outerHTML=`<a class="value url" id="sharedPdfLink" href="${a(e)}" target="_blank" rel="noopener">${a(e)}</a>`:t.outerHTML='<p class="value" id="sharedPdfLink">—</p>')};document.getElementById("uploadCurrentPdf")?.addEventListener("click",async()=>{const e=document.getElementById("uploadCurrentPdf");e&&(e.textContent="Uploading…",e.disabled=!0);try{const t=await n.runtime.sendMessage({type:"uploadCurrentTabPdf"});console.log("uploadCurrentTabPdf response:",t),t?.ok===!0&&t?.pdfUrl?r(t.pdfUrl):alert(t?.error??"Upload failed")}catch(t){alert(String(t))}finally{e&&(e.textContent="Upload current PDF",e.disabled=!c)}}),document.getElementById("refreshSharedFile")?.addEventListener("click",async()=>{const e=await n.runtime.sendMessage({type:"getSharedFile"}).catch(()=>({pdfUrl:null}));r(e?.pdfUrl??null)}),document.getElementById("clearSharedFile")?.addEventListener("click",async()=>{(await n.runtime.sendMessage({type:"clearSharedFile"}).catch(()=>({ok:!1})))?.ok!==!1&&r(null)})}function a(o){const s=document.createElement("div");return s.textContent=o,s.innerHTML}v();
