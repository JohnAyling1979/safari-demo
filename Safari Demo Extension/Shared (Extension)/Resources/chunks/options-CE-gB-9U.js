import{b as o}from"./browser-BnURzfs5.js";async function c(){console.log("[Safari Demo] Options script loaded");const a=document.getElementById("app"),{demoCount:n=0,theme:e="light"}=await o.storage.local.get(["demoCount","theme"]);a.innerHTML=`
    <div class="options">
      <h1>Options</h1>
      <section>
        <h2>Theme</h2>
        <label>
          <input type="radio" name="theme" value="light" ${e==="light"?"checked":""} />
          Light
        </label>
        <label>
          <input type="radio" name="theme" value="dark" ${e==="dark"?"checked":""} />
          Dark
        </label>
      </section>
      <section>
        <h2>Storage Demo</h2>
        <p>Message count from storage: <strong id="count">${n}</strong></p>
      </section>
    </div>
  `,document.querySelectorAll('input[name="theme"]').forEach(i=>{i.addEventListener("change",s=>{const t=s.target.value;o.storage.local.set({theme:t}),document.body.dataset.theme=t})}),document.body.dataset.theme=e}c();
