import "./root.css";

setTimeout(() => {
  import("./content");
}, 0);

setTimeout(() => {
  import("./simple-style.css");
}, 0);

setTimeout(() => {
  import("./simple");
}, 0);

export {};
