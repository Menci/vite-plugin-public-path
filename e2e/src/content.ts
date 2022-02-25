import "./style.css";

setTimeout(() => {
  console.log(`PASS! (modernBrowser = ${!import.meta.env.LEGACY})`);
}, 1000);

export {};
