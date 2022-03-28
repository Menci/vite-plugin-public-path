import "./style.css";

// @ts-ignore
$("#app").html("Test external jQuery!");

setTimeout(() => {
  console.log(`PASS! (modernBrowser = ${!import.meta.env.LEGACY})`);
}, 1000);

export {};
