import { render } from "preact";
import "./index.css";
import { AppRouter } from "./platform/router/AppRouter";

render(<AppRouter />, document.getElementById("app")!);
